import { describe, it, expect } from 'vitest'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { snapshot } from '../../scripts/sim/metrics.mjs'

describe('sim/metrics', () => {
  it('reads a stable numeric shape from a booted game', () => {
    const { game } = bootGame()
    const s = snapshot(game)
    expect(s.world).toBe(1)
    for (const k of ['food', 'wood', 'metal', 'science', 'trimps', 'scientists'] as const) {
      expect(typeof s[k]).toBe('number')
    }
  })
})
