import { describe, it, expect, beforeEach } from 'vitest'
import { sampleTick, history, resetSampler, RESOURCES, POP } from '../../src/modules/custom-ui/tiles/sampler'

describe('sampler ring buffer', () => {
  beforeEach(() => {
    resetSampler()
    ;(globalThis as any).game = {
      resources: {
        food: { owned: 1 }, wood: { owned: 2 }, metal: { owned: 3 }, science: { owned: 4 },
        fragments: { owned: 5 }, gems: { owned: 6 }, helium: { owned: 7 }, trimps: { owned: 8 },
      },
    }
  })

  it('samples all seven flat resources', () => {
    sampleTick()
    expect(RESOURCES.every((r) => history(r).length === 1)).toBe(true)
    expect(history('wood')[0]).toBe(2)
    expect(history('fragments')[0]).toBe(5)
    expect(history('gems')[0]).toBe(6)
    expect(history('helium')[0]).toBe(7)
  })

  it('samples population into the POP buffer', () => {
    sampleTick()
    expect(history(POP).length).toBe(1)
    expect(history(POP)[0]).toBe(8)
  })

  it('population buffer caps at 60 like the resources', () => {
    for (let i = 0; i < 70; i++) {
      ;(globalThis as any).game.resources.trimps.owned = i
      sampleTick()
    }
    const h = history(POP)
    expect(h.length).toBe(60)
    expect(h[h.length - 1]).toBe(69)
    expect(h[0]).toBe(10)
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
