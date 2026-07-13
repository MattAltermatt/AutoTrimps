import { describe, it, expect } from 'vitest'
import { sweep } from '../../scripts/sim/sweep.mjs'
import { runTicks } from '../../scripts/sim/driver.mjs'

describe('sim/sweep', () => {
  const runOne = (window: any, game: any) => {
    game.global.playerGathering = 'wood'
    runTicks(window, 200)
    return Math.floor(game.resources.wood.owned)
  }

  it('same seeds → identical samples (determinism)', () => {
    const a = sweep({ values: [0], seeds: [1], runOne })
    const b = sweep({ values: [0], seeds: [1], runOne })
    expect(a[0].samples).toEqual(b[0].samples)
  })

  it('averages N seeds into a mean per value', () => {
    const r = sweep({ values: [0], seeds: [1, 2, 3], runOne })
    expect(r[0].samples).toHaveLength(3)
    expect(r[0].mean).toBeGreaterThan(0)
  })
})
