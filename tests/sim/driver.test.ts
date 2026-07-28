import { describe, it, expect } from 'vitest'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installSeededRandom } from '../../scripts/sim/seededRandom.mjs'
import { runTicks, runUntil } from '../../scripts/sim/driver.mjs'

// #259 — two of the three claims here were unfalsified by any mutation in the Phase 0 audit, so
// `driver.test.ts: PROVEN` rested on one assertion out of three. Both are strengthened below to
// assert the thing their names already promised, and each now has a mutation that reddens it:
//
//   claim 1  runTicks(n) must scale with n   ← reddened by capping the loop at a constant
//   claim 3  runUntil must stop MINIMALLY    ← reddened by making it overshoot the predicate
//
// The old forms passed under both mutations: "wood went up" is true of a run capped at 50 ticks,
// and "reached === true, ticks > 0" is true of a runUntil that overshoots by any amount.
const boot = () => {
  const { window, game } = bootGame()
  installSeededRandom(window, 1) // both boots must be the same run for a minimality comparison
  return { window, game }
}

describe('sim/driver', () => {
  it('gameLoop(null) accumulates gathered resources IN PROPORTION to the tick count', () => {
    const short = boot()
    short.game.global.playerGathering = 'wood'
    const shortBefore = short.game.resources.wood.owned
    runTicks(short.window, 100)
    const shortGain = short.game.resources.wood.owned - shortBefore

    const long = boot()
    long.game.global.playerGathering = 'wood'
    const longBefore = long.game.resources.wood.owned
    runTicks(long.window, 300)
    const longGain = long.game.resources.wood.owned - longBefore

    expect(shortGain).toBeGreaterThan(0)
    // The claim that "wood went up" cannot distinguish a driver that honours `count` from one that
    // runs a fixed number of ticks and ignores it. This can.
    expect(longGain).toBeGreaterThan(shortGain)
  })

  it('advances game.global.time one game-tick per driver tick (unblocks time-gated logic)', () => {
    const { window, game } = bootGame()
    const before = game.global.time
    runTicks(window, 100)
    // gameTimeout advances time by 1000/settings.speed per tick (main.js:20016)
    expect(game.global.time).toBeCloseTo(before + 100 * (1000 / game.settings.speed), 5)
  })

  it('runUntil stops as soon as the predicate holds — MINIMALLY, not merely eventually', () => {
    const predicate = (g: any) => g.resources.wood.owned >= 50

    const a = boot()
    a.game.global.playerGathering = 'wood'
    const { ticks, reached } = runUntil(a.window, predicate, 100000)
    expect(reached).toBe(true)
    expect(ticks).toBeGreaterThan(0)

    // "as soon as" is the load-bearing word, and `reached === true` cannot check it: a runUntil that
    // overshoots by any number of ticks satisfies that just as well. Minimality is what makes
    // ticksToZone's answer a measurement rather than an upper bound — and #142/#146 both turned on
    // tick counts being exact. Replay one tick short on an identical run: the predicate must be FALSE.
    const b = boot()
    b.game.global.playerGathering = 'wood'
    runTicks(b.window, ticks - 1)
    expect(predicate(b.game), `runUntil overshot: the predicate already held at tick ${ticks - 1}`).toBe(false)
  })
})
