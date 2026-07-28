import { describe, it, expect } from 'vitest'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installFrozenClock } from '../../scripts/sim/clock.mjs'
import { runTicks } from '../../scripts/sim/driver.mjs'

describe('frozen clock', () => {
  it('Date.now() equals game.global.start + game.global.time', () => {
    const { window, game } = bootGame()
    installFrozenClock(window)
    expect(window.Date.now()).toBe((game.global.start || 0) + (game.global.time || 0))
  })

  // ⚠️ THE PIN ITSELF WAS UNGUARDED (found by the 2026-07-28 instrument audit). Neither test below
  // can see `g.global.start = fixedStart` (clock.mjs:13) — the first reads game.global.start on both
  // sides of its own equation, so it holds whatever the origin is, and the second measures a DELTA,
  // which cancels any constant offset by construction. Delete the pin and both still pass.
  //
  // That line is the half of the claim the ORACLE depends on: load()/newGame stamps game.global.start
  // from real wall-clock BEFORE this shim installs, so without the pin every recorded trace carries a
  // different time origin and any absolute-time branch drifts run to run.
  //
  // Asserted against an EXPLICIT non-default fixedStart so the assertion is deterministic. The
  // tempting form — booting twice and comparing absolute Date.now() — is NOT used: two boots landing
  // in the same millisecond would make it pass vacuously, and a test that can pass for the wrong
  // reason is the exact defect this audit exists to find.
  it('the time origin is PINNED to fixedStart — the property the oracle depends on', () => {
    const { window, game } = bootGame()
    installFrozenClock(window, { fixedStart: 1_234_567_890_000 })
    expect(game.global.start).toBe(1_234_567_890_000)
    expect(window.Date.now()).toBe(1_234_567_890_000 + (game.global.time || 0))
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
