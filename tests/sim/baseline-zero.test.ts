import { describeSim } from './guard'
import { it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { runTrace, diffTraces } from '../../scripts/sim/trace.mjs'
import { assertTraceMatches } from '../../scripts/sim/manifest.mjs'

// THE KEYSTONE: the current HEAD build, run against the committed oracle traces, must diff to ∅.
// This validates the whole harness AND confirms the working build is behavior-preserving on the
// decision path. A non-empty result is a real finding to document — NOT something to wave through.
// Requires the current bundle: run `npm run build` first.
//
// Committed-trace design (spec §5.3): the oracle traces are recorded ONCE from the frozen faithful
// bundle and pin clone + harness + runtime. On a deliberate clone bump OR a runtime bump (node/jsdom)
// that makes the old traces unreproducible, re-record via `node scripts/sim/record-oracle.mjs` (spec
// §5.6/§14) — that is the sanctioned re-baseline path, NOT switching to a live-vs-live diff (which
// would cancel exactly the shared-input regressions this absolute anchor is here to catch, and admits
// an ∅==∅ false-green). The non-empty floor below is the guard against a degenerate re-record.
const HEAD = resolve('dist/autotrimps.user.js')
const TRACES = resolve('tests/fixtures/traces')
const manifest = JSON.parse(readFileSync(resolve(TRACES, 'manifest.json'), 'utf8'))
const traceFiles = readdirSync(TRACES).filter((f) => f.endsWith('.trace.json'))

describeSim('baseline-zero (HEAD build reproduces the oracle traces)', () => {
  for (const tf of traceFiles) {
    it(`${tf}: current build reproduces the oracle trace`, () => {
      const m = tf.match(/^(.*)\.(\d+)\.trace\.json$/)
      if (!m) throw new Error(`bad trace filename: ${tf}`)
      const save = m[1]
      const seed = Number(m[2])
      const oracle = JSON.parse(readFileSync(resolve(TRACES, tf), 'utf8'))
      const saveString = readFileSync(resolve('tests/fixtures/saves', save + '.txt'), 'utf8')
      // Floor: a degenerate re-record (AT makes zero decisions under a broken runtime) would commit
      // an empty oracle; a working build that ALSO does nothing would then diff to ∅ and pass while
      // testing nothing. Reject an empty oracle outright (adversarial-review guardrail).
      expect(oracle.length, `oracle trace ${tf} is degenerate (0 events) — re-record produced nothing`).toBeGreaterThan(0)
      const working = runTrace({ atBundlePath: HEAD, saveString, seed, ticks: 1500 })
      expect(() => assertTraceMatches(diffTraces(oracle, working), save, manifest)).not.toThrow()
    }, 30_000)
  }
})
