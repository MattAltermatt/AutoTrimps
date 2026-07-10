import { it, expect } from 'vitest'
import { describeSim } from './guard'
import { bootGame } from '../../scripts/sim/boot.mjs'

describeSim('sim/boot', () => {
  it('boots the game into jsdom with a live game object at world 1', () => {
    const { game } = bootGame()
    expect(typeof game).toBe('object')
    expect(game.global.world).toBe(1)
  })

  it('passes the anti-false-green tripwire (game methods are real functions)', () => {
    const { game } = bootGame()
    expect(typeof game.buildings.Shed.cost.wood).toBe('function')
  })
})
