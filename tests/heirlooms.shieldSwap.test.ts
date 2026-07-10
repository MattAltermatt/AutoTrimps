// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'

// Regression for #49: HeirloomShieldSwapped's rarity guard was `if (!game.global.ShieldEquipped.rarity
// >= 10) return`, which operator-precedence-parses as `(!rarity) >= 10` — a boolean compared to a
// number, ALWAYS false — so the guard never fired and the gammaBurst body ran for every equipped
// shield, including rarity < 10. The live game gates gammaBurst on rarity >= 10 (trimps-game
// main.js:6612 / main.js:6836), so the fork wrongly credited sub-10 shields a gammaBurst adjustment
// in calc.ts. Fixed to `if (rarity < 10) return`.

let HeirloomShieldSwapped: () => void

beforeAll(async () => {
  // heirlooms.ts reads game.options at import time (mirrors heirlooms.loomSwap.test.ts).
  ;(globalThis as any).game = { options: { menu: { showHeirloomAnimations: { enabled: false } } } }
  HeirloomShieldSwapped = (await import('../src/modules/heirlooms')).HeirloomShieldSwapped
})

describe('HeirloomShieldSwapped rarity guard (#49)', () => {
  beforeEach(() => {
    // 300% gammaBurst → gammaBurstPct 3 when the body runs.
    ;(globalThis as any).getHeirloomBonus = vi.fn(() => 300)
    // Sentinels distinct from any value the body would write, so we can prove non-writes.
    ;(globalThis as any).gammaBurstPct = -1
    ;(globalThis as any).shieldEquipped = 'SENTINEL'
  })

  it('rarity >= 10: sets gammaBurstPct from the bonus and latches shieldEquipped', () => {
    ;(globalThis as any).game.global = { ShieldEquipped: { rarity: 10, id: 'shield-A' } }
    HeirloomShieldSwapped()
    expect((globalThis as any).gammaBurstPct).toBe(3) // 300 / 100
    expect((globalThis as any).shieldEquipped).toBe('shield-A')
  })

  it('rarity < 10: returns early, leaving gammaBurstPct and shieldEquipped untouched', () => {
    // Pre-fix this ran the body and set gammaBurstPct = 3 (bug); post-fix it early-returns.
    ;(globalThis as any).game.global = { ShieldEquipped: { rarity: 9, id: 'shield-B' } }
    HeirloomShieldSwapped()
    expect((globalThis as any).gammaBurstPct).toBe(-1)
    expect((globalThis as any).shieldEquipped).toBe('SENTINEL')
  })

  it('rarity >= 10 with zero bonus falls back to gammaBurstPct = 1', () => {
    ;(globalThis as any).getHeirloomBonus = vi.fn(() => 0)
    ;(globalThis as any).game.global = { ShieldEquipped: { rarity: 12, id: 'shield-C' } }
    HeirloomShieldSwapped()
    expect((globalThis as any).gammaBurstPct).toBe(1)
    expect((globalThis as any).shieldEquipped).toBe('shield-C')
  })
})
