import { describe, it, expect } from 'vitest'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { runTicks, runUntil } from '../../scripts/sim/driver.mjs'

describe('sim/driver', () => {
  it('gameLoop(null) accumulates gathered resources over ticks', () => {
    const { window, game } = bootGame()
    game.global.playerGathering = 'wood'
    const before = game.resources.wood.owned
    runTicks(window, 300)
    expect(game.resources.wood.owned).toBeGreaterThan(before)
  })

  it('advances game.global.time one game-tick per driver tick (unblocks time-gated logic)', () => {
    const { window, game } = bootGame()
    const before = game.global.time
    runTicks(window, 100)
    // gameTimeout advances time by 1000/settings.speed per tick (main.js:20016)
    expect(game.global.time).toBeCloseTo(before + 100 * (1000 / game.settings.speed), 5)
  })

  it('runUntil stops as soon as the predicate holds and reports tick count', () => {
    const { window, game } = bootGame()
    game.global.playerGathering = 'wood'
    const { ticks, reached } = runUntil(window, (g: any) => g.resources.wood.owned >= 50, 100000)
    expect(reached).toBe(true)
    expect(ticks).toBeGreaterThan(0)
  })
})
