// Count a trace change BY EVENT, not by index. `diffTraces` (trace.mjs) aligns positionally, so a
// single inserted event at tick 9 reports as "1167 divergences" — a number that looks like the wholly
// shifted trajectory the re-pin rule exists to refuse, when the honest reading is "3 events inserted,
// every pre-existing event unchanged" (see the #69 note in build-oracle.mjs, which counted it by hand).
//
// Every oracle re-pin / re-record has to write that honest count into the trace manifest's
// `proofItLaundersNothing` ledger, and the count has been produced by an ad-hoc throwaway script each
// time. This is that script, committed, so the ledger's numbers are re-derivable rather than retyped.
//
// The key is `fn` + `args` and deliberately NOT `tick`: a fix that makes AT reach the same decision one
// tick earlier has changed WHEN, not WHAT, and an LCS keyed on tick would report every later event as
// replaced. Ticks are still surfaced in the sample rows so a pure-timing shift stays visible.
//
// Usage:  node scripts/sim/event-diff.mjs <before-dir> [after-dir]
//   before-dir  directory of *.trace.json to treat as the BEFORE side (e.g. a copy of the committed
//               traces taken before a re-record)
//   after-dir   defaults to tests/fixtures/traces (the freshly recorded side)
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CORPUS } from './corpus.mjs'

/** @param {{fn: string, args: unknown[]}} e */
const key = (e) => `${e.fn}(${JSON.stringify(e.args)})`

/**
 * Longest common subsequence over event keys. Returns the LCS length plus the aligned edit script.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {{lcs: number, script: Array<{op: 'keep'|'del'|'ins', ai: number, bi: number}>}}
 */
export function lcsDiff(a, b) {
  const n = a.length
  const m = b.length
  // (n+1)*(m+1) Int32 cells. The corpus tops out near 2,100 events per trace (~18MB), and a trace an
  // order of magnitude larger would mean the corpus changed shape, not that this tool needs to be
  // cleverer — so the simple full-matrix DP is the right trade for an auditable ledger number.
  const dp = new Int32Array((n + 1) * (m + 1))
  const at = (/** @type {number} */ i, /** @type {number} */ j) => i * (m + 1) + j
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[at(i, j)] = a[i] === b[j] ? dp[at(i + 1, j + 1)] + 1 : Math.max(dp[at(i + 1, j)], dp[at(i, j + 1)])
    }
  }
  /** @type {Array<{op: 'keep'|'del'|'ins', ai: number, bi: number}>} */
  const script = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      script.push({ op: 'keep', ai: i, bi: j })
      i++
      j++
    } else if (dp[at(i + 1, j)] >= dp[at(i, j + 1)]) {
      script.push({ op: 'del', ai: i, bi: j })
      i++
    } else {
      script.push({ op: 'ins', ai: i, bi: j })
      j++
    }
  }
  for (; i < n; i++) script.push({ op: 'del', ai: i, bi: j })
  for (; j < m; j++) script.push({ op: 'ins', ai: i, bi: j })
  return { lcs: dp[at(0, 0)], script }
}

/**
 * @param {string} beforePath
 * @param {string} afterPath
 */
export function compareTraceFiles(beforePath, afterPath) {
  const beforeRaw = readFileSync(beforePath, 'utf8')
  const afterRaw = readFileSync(afterPath, 'utf8')
  const before = JSON.parse(beforeRaw)
  const after = JSON.parse(afterRaw)
  const { script } = lcsDiff(before.map(key), after.map(key))
  const deleted = script.filter((s) => s.op === 'del')
  const inserted = script.filter((s) => s.op === 'ins')
  return {
    identical: beforeRaw === afterRaw,
    beforeEvents: before.length,
    afterEvents: after.length,
    deleted: deleted.length,
    inserted: inserted.length,
    // First few edits, with ticks, so a reader can name the cause instead of trusting the count.
    sample: script
      .filter((s) => s.op !== 'keep')
      .slice(0, 4)
      .map((s) => (s.op === 'del' ? `- ${before[s.ai].tick}: ${key(before[s.ai])}` : `+ ${after[s.bi].tick}: ${key(after[s.bi])}`)),
  }
}

// CLI only when run directly — the LCS is unit-tested (tests/sim/event-diff.test.ts), which imports
// this module, and a bare `process.exit(2)` at import time would take the test runner down with it.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const beforeDir = process.argv[2]
  const afterDir = process.argv[3] ?? 'tests/fixtures/traces'
  if (!beforeDir) {
    console.error('usage: node scripts/sim/event-diff.mjs <before-dir> [after-dir=tests/fixtures/traces]')
    process.exit(2)
  }

  let moved = 0
  let identical = 0
  console.log('fixture                 before  after   ins    del   verdict')
  console.log('----------------------  ------  -----  -----  -----  -------------------')
  for (const { name, seeds } of CORPUS) {
    for (const seed of seeds) {
      const file = `${name}.${seed}.trace.json`
      const b = resolve(join(beforeDir, file))
      const a = resolve(join(afterDir, file))
      if (!existsSync(b) || !existsSync(a)) {
        console.log(`${file.padEnd(22)}  MISSING (${existsSync(b) ? 'after' : 'before'} side absent)`)
        continue
      }
      const r = compareTraceFiles(b, a)
      if (r.identical) identical++
      else moved++
      const verdict = r.identical ? 'BYTE-IDENTICAL' : `${r.inserted + r.deleted} event edits`
      console.log(
        `${file.replace('.trace.json', '').padEnd(22)}  ${String(r.beforeEvents).padStart(6)}  ${String(r.afterEvents).padStart(5)}  ${String(r.inserted).padStart(5)}  ${String(r.deleted).padStart(5)}  ${verdict}`,
      )
      for (const s of r.sample) console.log(`                        ${s}`)
    }
  }
  console.log('----------------------  ------  -----  -----  -----  -------------------')
  console.log(`${identical} byte-identical (controls) · ${moved} moved`)
}
