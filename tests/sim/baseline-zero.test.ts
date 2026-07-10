import { describeSim } from './guard'
import { it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { runTrace, diffTraces } from '../../scripts/sim/trace.mjs'
import { assertTraceMatches } from '../../scripts/sim/manifest.mjs'

// THE KEYSTONE: the current HEAD build, run against the committed oracle traces with ZERO
// modernization, must diff to ∅. This validates the whole harness AND confirms #33–#39 were
// behavior-preserving on the decision path. A non-empty result is a real finding to document
// (a post-Phase-1 drift, or a harness bug) — NOT something to wave through.
// Requires the current bundle: run `npm run build` first.
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
      const working = runTrace({ atBundlePath: HEAD, saveString, seed, ticks: 1500 })
      expect(() => assertTraceMatches(diffTraces(oracle, working), save, manifest)).not.toThrow()
    }, 30_000)
  }
})
