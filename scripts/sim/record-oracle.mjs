// Produce the committed oracle action traces: run the FROZEN faithful oracle bundle against each
// save in the corpus (× seeds) and write the resulting native-mutator trace. These committed
// goldens are what a refactored working build is diffed against — the oracle is recorded ONCE, so
// per-CI cost is a cheap file diff, not a live two-build race. Re-record only when re-baselining an
// approved fix or on a deliberate ../trimps-game version bump.
//
// Multi-seed (#47): each seed pins a distinct combat-RNG timing path (verified — the same save
// yields distinct traces per seed as fight outcomes shift buy/upgrade cadence). Recording all seeds
// and gating the working build against each broadens branch coverage over the ~41 unseeded combat
// Math.random sites the design calls out. installSeededRandom makes every (save,seed) run fully
// deterministic, so the committed per-seed traces are reproducible. Per-save seed/tick budgets live
// in corpus.mjs (04-u2-radon is bounded — see the note there).
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runTrace } from './trace.mjs'
import { CORPUS } from './corpus.mjs'

const ORACLE = resolve('tests/fixtures/oracle/autotrimps.oracle.user.js')
const SAVES_DIR = resolve('tests/fixtures/saves')
const TRACES = resolve('tests/fixtures/traces')

for (const { name: saveName, seeds, ticks } of CORPUS) {
  const saveString = readFileSync(resolve(SAVES_DIR, `${saveName}.txt`), 'utf8')
  for (const seed of seeds) {
    const trace = runTrace({ atBundlePath: ORACLE, saveString, seed, ticks })
    const name = `${saveName}.${seed}.trace.json`
    writeFileSync(resolve(TRACES, name), JSON.stringify(trace), 'utf8')
    console.log('[record-oracle]', name, '·', trace.length, 'events')
  }
}
