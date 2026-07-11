// Corpus coverage meter (#47). The proof-net differential (baseline-zero) only guards decisions that
// bottom out in a native mutator the corpus actually reaches. Full c8/v8 LINE coverage over src/ is a
// dead end here: the bundle runs as an anonymous `window.eval` blob inside jsdom, invisible to
// NODE_V8_COVERAGE without fragile sourceURL+sourcemap-through-VM plumbing (probed 2026-07-10, #47).
// So we measure coverage at the granularity the differential actually gates at — the native-mutator
// seam (the same ~8 fns recorder.mjs wraps). This tells a refactorer, loudly, which decision families
// the corpus exercises (a change there is differential-guarded) and which it does NOT (a change there
// needs an L1 unit test — the risk is made loud, not silent). Per-module line coverage is folded into
// #51 where code actually changes.
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// The full native-mutator seam recorder.mjs fingerprints. Mirror it (kept in sync deliberately).
export const ALL_MUTATORS = ['buyJob', 'buyBuilding', 'buyUpgrade', 'runMap', 'selectMap', 'buyEquipment', 'setFormation', 'recycleMap']

/**
 * Read the committed oracle traces and report which mutators each save exercises, the corpus-wide
 * union, and the mutators NO save reaches. Computed from the committed traces (the oracle's frozen
 * behavior) so it is fast + deterministic and doubles as a degenerate-re-record guard at mutator
 * granularity (a re-record that quietly drops a mutator shows up here).
 * @param {string} [tracesDir]
 * @returns {{ perSave: Record<string,string[]>, union: string[], uncovered: string[] }}
 */
export function coverageFromTraces(tracesDir = resolve('tests/fixtures/traces')) {
  const perSaveSets = {}
  const union = new Set()
  for (const f of readdirSync(tracesDir).filter((x) => x.endsWith('.trace.json'))) {
    const save = f.replace(/\.\d+\.trace\.json$/, '')
    const trace = JSON.parse(readFileSync(resolve(tracesDir, f), 'utf8'))
    ;(perSaveSets[save] ||= new Set())
    for (const e of trace) {
      perSaveSets[save].add(e.fn)
      union.add(e.fn)
    }
  }
  const perSave = {}
  for (const s of Object.keys(perSaveSets).sort()) perSave[s] = [...perSaveSets[s]].sort()
  return {
    perSave,
    union: [...union].sort(),
    uncovered: ALL_MUTATORS.filter((m) => !union.has(m)),
  }
}

// CLI: print the report.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { perSave, union, uncovered } = coverageFromTraces()
  console.log('[coverage] per-save mutator reach:')
  for (const [s, fns] of Object.entries(perSave)) console.log(`  ${s.padEnd(20)} ${fns.join(', ')}`)
  console.log(`[coverage] corpus union (${union.length}/${ALL_MUTATORS.length}): ${union.join(', ')}`)
  console.log(`[coverage] NEVER exercised (differential-blind): ${uncovered.join(', ') || '(none — full mutator coverage)'}`)
}
