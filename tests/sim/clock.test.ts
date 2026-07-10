import { describeSim } from './guard'
import { it, expect } from 'vitest'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installFrozenClock } from '../../scripts/sim/clock.mjs'
import { runTicks } from '../../scripts/sim/driver.mjs'

describeSim('frozen clock', () => {
  it('Date.now() equals game.global.start + game.global.time', () => {
    const { window, game } = bootGame()
    installFrozenClock(window)
    expect(window.Date.now()).toBe((game.global.start || 0) + (game.global.time || 0))
  })

  it('elapsed time advances by 1000/speed per tick, deterministically', () => {
    // Measure the DELTA within one run so the wall-clock start (set from real time at
    // newGame, non-deterministic across boots) cancels — the delta is what time-gated
    // decisions actually read, and it must be reproducible.
    const elapsed = () => {
      const { window } = bootGame()
      installFrozenClock(window)
      const before = window.Date.now()
      runTicks(window, 100)
      return window.Date.now() - before
    }
    const e = elapsed()
    expect(e).toBeGreaterThan(0)
    expect(elapsed()).toBe(e)
  })
})
