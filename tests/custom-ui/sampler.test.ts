import { describe, it, expect, beforeEach } from 'vitest'
import { sampleTick, history, resetSampler, RESOURCES } from '../../src/modules/custom-ui/tiles/sampler'

describe('sampler ring buffer', () => {
  beforeEach(() => {
    resetSampler()
    ;(globalThis as any).game = {
      resources: { food: { owned: 1 }, wood: { owned: 2 }, metal: { owned: 3 }, science: { owned: 4 } },
    }
  })

  it('samples all four resources', () => {
    sampleTick()
    expect(RESOURCES.every((r) => history(r).length === 1)).toBe(true)
    expect(history('wood')[0]).toBe(2)
  })

  it('caps at 60 (drops oldest)', () => {
    for (let i = 0; i < 70; i++) {
      ;(globalThis as any).game.resources.food.owned = i
      sampleTick()
    }
    const h = history('food')
    expect(h.length).toBe(60)
    expect(h[h.length - 1]).toBe(69)
    expect(h[0]).toBe(10)
  })
})
