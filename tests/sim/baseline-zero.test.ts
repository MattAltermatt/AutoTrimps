import { describeSim } from './guard'
import { beforeAll, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildUserscript } from '../../scripts/build-userscript.mjs'
import { runTrace, diffTraces } from '../../scripts/sim/trace.mjs'
import { assertTraceMatches } from '../../scripts/sim/manifest.mjs'
import { CORPUS } from '../../scripts/sim/corpus.mjs'

// THE KEYSTONE: the current build, run against the committed oracle traces, must diff to ∅ (or only
// to a manifest-waived, reviewed fix). This validates the whole harness AND confirms the working
// build is behavior-preserving on the decision path. A non-empty result is a real finding to
// document — NOT something to wave through. The bundle is built IN-PROCESS here (buildUserscript),
// so the gate always reflects live src/ — no stale-`dist` footgun and no `npm run build` prerequisite.
//
// Committed-trace design (spec §5.3): the oracle traces are recorded ONCE from the frozen faithful
// bundle and pin clone + harness + runtime. On a deliberate clone bump OR a runtime bump (node/jsdom)
// that makes the old traces unreproducible, re-record via `node scripts/sim/record-oracle.mjs` (spec
// §5.6/§14) — that is the sanctioned re-baseline path, NOT switching to a live-vs-live diff (which
// would cancel exactly the shared-input regressions this absolute anchor is here to catch, and admits
// an ∅==∅ false-green). The non-empty floor below is the guard against a degenerate re-record.
//
// Per-save seed/tick budgets come from corpus.mjs (04-u2-radon is single-seed + short — see its note).
const SAVES = resolve('tests/fixtures/saves')
const TRACES = resolve('tests/fixtures/traces')
const manifest = JSON.parse(readFileSync(resolve(TRACES, 'manifest.json'), 'utf8'))

let workingBundle: string

describeSim('baseline-zero (current build reproduces the oracle traces)', () => {
  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'at-baseline-'))
    workingBundle = join(dir, 'working.user.js')
    writeFileSync(workingBundle, await buildUserscript(), 'utf8')
  }, 60_000)

  for (const { name, seeds, ticks } of CORPUS) {
    for (const seed of seeds) {
      it(`${name}.${seed}: current build reproduces the oracle trace`, () => {
        const oracle = JSON.parse(readFileSync(resolve(TRACES, `${name}.${seed}.trace.json`), 'utf8'))
        const saveString = readFileSync(resolve(SAVES, `${name}.txt`), 'utf8')
        // Floor: a degenerate re-record (AT makes zero decisions under a broken runtime) would commit
        // an empty oracle; a working build that ALSO does nothing would then diff to ∅ and pass while
        // testing nothing. Reject an empty oracle outright (adversarial-review guardrail).
        expect(oracle.length, `oracle trace ${name}.${seed} is degenerate (0 events) — re-record produced nothing`).toBeGreaterThan(0)
        const working = runTrace({ atBundlePath: workingBundle, saveString, seed, ticks })
        expect(() => assertTraceMatches(diffTraces(oracle, working), name, manifest)).not.toThrow()
      }, 30_000)
    }
  }
})
