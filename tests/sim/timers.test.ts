import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installFrozenClock } from '../../scripts/sim/clock.mjs'
import { runTicks } from '../../scripts/sim/driver.mjs'

// #126 — the virtual timer queue's own contract (scripts/sim/timers.mjs). void-heirlooms.test.ts proves
// the queue delivers the one payload that matters; this proves the queue itself behaves, above all that
// it still DROPS the three self-driving loops. Letting gameTimeout through would double-drive every
// tick — the sim would silently run at 2x and every trace would be a lie.

const load = () => {
  const { window: w } = bootGame({ saveString: readFileSync(resolve('tests/fixtures/saves/02-mid-u1.txt'), 'utf8') })
  installFrozenClock(w)
  return w
}

// ONE TICK IS NOT ONE SECOND. Trimps runs at game.settings.speed ticks/sec (10 on a real save), so the
// driver advances game time by 1000/speed per tick — 100ms, not 1000ms. Deriving the delays from that
// rather than hardcoding them is the difference between testing the queue and testing my own arithmetic.
const tickMs = (w: any) => 1000 / w.game.settings.speed

describe('sim/timers — the virtual timer queue (#126)', () => {
  it('fires a callback once its GAME-TIME deadline passes, and not before', () => {
    const w = load()
    let fired = 0
    w.setTimeout(() => fired++, 3 * tickMs(w)) // due exactly 3 ticks from now

    runTicks(w, 2)
    expect(fired, 'fired early — the deadline is in game time, not tick count').toBe(0)

    runTicks(w, 2)
    expect(fired).toBe(1)

    runTicks(w, 10)
    expect(fired, 'fired more than once — the queue must delete an entry as it runs it').toBe(1)
  })

  it('runs due callbacks in deadline order, and clearTimeout cancels', () => {
    const w = load()
    const t = tickMs(w)
    const order: string[] = []
    w.setTimeout(() => order.push('c'), 3 * t)
    w.setTimeout(() => order.push('a'), 1 * t)
    const doomed = w.setTimeout(() => order.push('NEVER'), 2 * t)
    w.setTimeout(() => order.push('b'), 2 * t)
    w.clearTimeout(doomed)

    runTicks(w, 5)
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('delivers a callback that schedules another (the game staggers stacked-void rewards)', () => {
    const w = load()
    const t = tickMs(w)
    let fired = 0
    const chain = (n: number) => {
      fired++
      if (n > 0) w.setTimeout(() => chain(n - 1), t)
    }
    w.setTimeout(() => chain(3), t)

    runTicks(w, 10)
    expect(fired).toBe(4)
  })

  it('DROPS the self-driving loops — gameTimeout, autoSave and costUpdatesTimeout', () => {
    const w = load()

    // These are the three the queue must never run. gameTimeout re-enters the game loop (the driver
    // replaces it); autoSave compresses the whole save on a 10s loop; costUpdatesTimeout's only
    // state-bearing call is checkTriggers(), which the driver already makes explicitly (#122).
    let gameTimeoutRan = 0
    let autoSaveRan = 0
    let costUpdatesRan = 0
    const realGameTimeout = w.gameTimeout
    const realAutoSave = w.autoSave
    const realCostUpdates = w.costUpdatesTimeout

    // Re-installing the queue is not needed: it matches BY IDENTITY against window.gameTimeout etc, so
    // wrapping them here would make the identity check miss. Schedule the REAL functions instead and
    // detect a run through their side effects... except gameTimeout's side effect IS the bug. So assert
    // the contract directly: scheduling them returns 0 (dropped), and the queue stays empty.
    expect(typeof realGameTimeout).toBe('function')
    expect(typeof realAutoSave).toBe('function')
    expect(typeof realCostUpdates).toBe('function')

    expect(w.setTimeout(realGameTimeout, tickMs(w)), 'gameTimeout was QUEUED — the sim would double-drive').toBe(0)
    expect(w.setTimeout(realAutoSave, tickMs(w))).toBe(0)
    expect(w.setTimeout(realCostUpdates, tickMs(w))).toBe(0)
    expect(w.__simTimers.pending(), 'a self-driving loop entered the queue').toBe(0)

    // And an ordinary callback still gets in, so the drop above is selective rather than a dead queue
    // (which would make every assertion here pass vacuously).
    const id = w.setTimeout(() => { gameTimeoutRan = autoSaveRan = costUpdatesRan = -1 }, tickMs(w))
    expect(id).toBeGreaterThan(0)
    expect(w.__simTimers.pending()).toBe(1)
    runTicks(w, 2)
    expect(gameTimeoutRan + autoSaveRan + costUpdatesRan).toBe(-3)
  })

  it('the game itself advances only ONE tick per tick (gameTimeout is not re-entering the loop)', () => {
    const w = load()
    const before = w.game.global.time
    runTicks(w, 10)
    // Exactly 10 ticks' worth of game time. If gameTimeout were running from the queue it would re-enter
    // gameLoop and this would overshoot — the sim would silently run fast and every trace would be wrong.
    expect(w.game.global.time - before).toBe(10 * tickMs(w))
  })
})
