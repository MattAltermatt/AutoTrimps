// Produce the committed oracle action traces: run the FROZEN faithful oracle bundle against each
// save in the corpus (× seeds) and write the resulting native-mutator trace. These committed
// goldens are what a refactored working build is diffed against — the oracle is recorded ONCE, so
// per-CI cost is a cheap file diff, not a live two-build race. Re-record only when re-baselining an
// approved fix or on a deliberate ../trimps-game version bump.
//
// NOTE: single seed for now (installSeededRandom makes each run fully deterministic, so one seed
// already validates the harness end-to-end). Multi-seed averaging + the c8/v8 differential coverage
// meter are a documented follow-up (they broaden coverage; they are not required for a working gate).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { runTrace } from './trace.mjs'

const ORACLE = resolve('tests/fixtures/oracle/autotrimps.oracle.user.js')
const SAVES_DIR = resolve('tests/fixtures/saves')
const TRACES = resolve('tests/fixtures/traces')
const SEEDS = [1]
const TICKS = 1500

const saves = readdirSync(SAVES_DIR).filter((f) => f.endsWith('.txt'))
for (const s of saves) {
  const saveString = readFileSync(resolve(SAVES_DIR, s), 'utf8')
  for (const seed of SEEDS) {
    const trace = runTrace({ atBundlePath: ORACLE, saveString, seed, ticks: TICKS })
    const name = `${s.replace(/\.txt$/, '')}.${seed}.trace.json`
    writeFileSync(resolve(TRACES, name), JSON.stringify(trace), 'utf8')
    console.log('[record-oracle]', name, '·', trace.length, 'events')
  }
}
