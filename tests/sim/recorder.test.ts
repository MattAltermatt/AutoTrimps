import { describe, it, expect } from 'vitest'
import { TEST_BUNDLE } from './bundle'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installFrozenClock } from '../../scripts/sim/clock.mjs'
import { installSeededRandom } from '../../scripts/sim/seededRandom.mjs'
import { installRecorder, MUTATORS, DEDUPE_ON_CHANGE } from '../../scripts/sim/recorder.mjs'
import { stepWithAT } from '../../scripts/sim/driver.mjs'

// DERIVED, not retyped. This was a hand-copied list — and it had already drifted: it omitted
// `buyMap` and `recycleBelow`, which have been in MUTATORS since #90, and passed only because
// neither fires on 01-early-u1. A stale copy here does not just fail to catch a wrongly-recorded
// fn, it asserts the WRONG contract while looking green.
const MUT: readonly string[] = MUTATORS
const SAVE = () => readFileSync(resolve('tests/fixtures/saves/01-early-u1.txt'), 'utf8')

function run(seed = 1, ticks = 800) {
  const { window } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: SAVE() })
  installSeededRandom(window, seed)
  installFrozenClock(window)
  let tick = 0
  const trace = installRecorder(window, () => tick)
  for (let i = 0; i < ticks; i++) {
    tick = i
    stepWithAT(window, 1)
  }
  return trace
}

describe('native-mutator recorder', () => {
  it('records native-mutator calls with fn + args + tick', () => {
    const trace = run()
    expect(trace.length).toBeGreaterThan(0)
    for (const e of trace) {
      expect(MUT).toContain(e.fn)
      expect(typeof e.tick).toBe('number')
      expect(Array.isArray(e.args)).toBe(true)
    }
  }, 30_000)

  it('is DETERMINISTIC across two identical runs (seed + save + frozen clock fixed)', () => {
    expect(run(7)).toEqual(run(7))
  }, 30_000)

  // #196 — setGather is recorded ON TRANSITION, not per call. AT re-asserts the gather target every
  // tick (measured 1500/1500 on every fixture) across only two or three distinct values, so a
  // call-for-call recording is ~1500 rows of re-assertion per run and drowns the actual decision.
  it('records a DEDUPE_ON_CHANGE mutator only when its argument changes', () => {
    const trace = run(1, 800)
    const gather = trace.filter((e: { fn: string }) => e.fn === 'setGather')

    expect(DEDUPE_ON_CHANGE.has('setGather')).toBe(true)
    // Anti-false-green: it must actually be RECORDED, or "no consecutive duplicates" is vacuous.
    expect(gather.length).toBeGreaterThan(0)
    // Far fewer rows than ticks — the whole point. AT called it on every one of the 800 ticks.
    expect(gather.length).toBeLessThan(400)

    // The defining property: no two consecutive recorded values are equal.
    const args = gather.map((e: { args: unknown[] }) => JSON.stringify(e.args))
    const repeats = args.filter((a, i) => i > 0 && a === args[i - 1])
    expect(repeats).toEqual([])

    // ...and it really is a transition SEQUENCE, not one row: the target changes during the run.
    expect(new Set(args).size).toBeGreaterThan(1)
  }, 30_000)
})
