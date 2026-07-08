import { describe, it, expect, beforeEach } from 'vitest'
import { preBuy, postBuy, preBuy2, postBuy2 } from '../src/modules/buystate'

// Minimal game stub — buystate only touches game.global's 4 buy fields.
beforeEach(() => {
  ;(globalThis as any).game = { global: { buyAmt: 1, firing: true, lockTooltip: false, maxSplit: 7 } }
})

describe('buystate preBuy/postBuy', () => {
  it('restores the 4 buy fields after they are mutated', () => {
    preBuy()
    const g = (globalThis as any).game.global
    g.buyAmt = 999; g.firing = false; g.lockTooltip = true; g.maxSplit = 0
    postBuy()
    expect(g).toEqual({ buyAmt: 1, firing: true, lockTooltip: false, maxSplit: 7 })
  })

  it('preBuy2/postBuy2 round-trip via an explicit array', () => {
    const saved = preBuy2()
    const g = (globalThis as any).game.global
    g.buyAmt = 42; g.firing = false; g.lockTooltip = true; g.maxSplit = 3
    postBuy2(saved)
    expect(g).toEqual({ buyAmt: 1, firing: true, lockTooltip: false, maxSplit: 7 })
  })
})
