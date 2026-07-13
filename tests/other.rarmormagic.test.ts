// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// Regression net for #59: U2 (radon) armor-magic for Nom/Tox challenges was silently dead. `Rarmormagic`
// (other.ts, the live caller at AutoTrimps2.js:348) routes to `RbuyArms` when `getPageSetting('Rcarmormagic')`
// (or the real `Rdarmormagic`) is set to 1/2/3 AND health is low. `Rcarmormagic` was a PHANTOM setting
// (never createSetting'd → getPageSetting returns false, utils.ts:58), so `false == 1/2/3` was always false
// and the Rcarmormagic branch never fired. Fix: add the missing createSetting (settings-defs.ts), mirroring
// U1's `carmormagic` byte-for-byte (same options → same == index semantics as U1 `armormagic`).
//
// This pins the reader routing: with Rcarmormagic set to a real value + the health gate met, Rarmormagic
// must call RbuyArms. The index parity (1=Above 80%, 2=H:D, 3=Always) matches U1 armormagic exactly.

let other: typeof import('../src/modules/other')

const ARMOR = ['Shield', 'Boots', 'Helmet', 'Pants', 'Shoulderguards', 'Breastplate', 'Gambeson']

beforeAll(async () => {
  ;(globalThis as any).MODULES = { maps: { RenoughDamageCutoff: 1 } } // Rarmormagic reads MODULES["maps"] for the ==2 path
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).playerSpire = { drawInfo: () => {} }
  ;(globalThis as any).nextWorld = () => {}
  other = await import('../src/modules/other')
})

let buyEquipmentCalls: unknown[][]
function baseGame(overrides: Record<string, unknown> = {}) {
  return {
    global: {
      buyAmt: 1, firing: false, lockTooltip: false, maxSplit: 1,
      world: 100, highestLevelCleared: 99,
      soldierHealth: 10, soldierHealthMax: 100, // 10 <= 40% of 100 → health gate MET
      ...overrides,
    },
    equipment: Object.fromEntries(ARMOR.map((n) => [n, { level: 0, locked: false }])),
  }
}

beforeEach(() => {
  buyEquipmentCalls = []
  // #68/#74: was `RCapEquiparm` — a phantom (deleted upstream 2020) that production can never read.
  // RbuyArms now reads the live U2 armour cap, so seed the id production actually uses.
  ;(globalThis as any).autoTrimpSettings = { Requipcaphealth: { type: 'value', value: '50' } }
  ;(globalThis as any).game = baseGame()
  ;(globalThis as any).preBuy = vi.fn()
  ;(globalThis as any).postBuy = vi.fn()
  ;(globalThis as any).canAffordBuilding = vi.fn(() => true)
  ;(globalThis as any).buyEquipment = vi.fn((...args: unknown[]) => { buyEquipmentCalls.push(args); return true })
  ;(globalThis as any).RcalcHDratio = vi.fn(() => 1e9) // >= cutoff, for the ==2 path
})

const setRcarmormagic = (value: number) => {
  ;(globalThis as any).autoTrimpSettings.Rcarmormagic = { type: 'multitoggle', value }
}

describe('#59: Rarmormagic routes the real Rcarmormagic gate to RbuyArms', () => {
  it('Rcarmormagic=3 (Always) + low health → buys all affordable armor', () => {
    setRcarmormagic(3)
    other.Rarmormagic()
    expect(buyEquipmentCalls.map((a) => a[0])).toEqual(ARMOR)
  })

  it('Rcarmormagic=0 (Off) → does not buy (the phantom-era default, no fire)', () => {
    setRcarmormagic(0)
    other.Rarmormagic()
    expect(buyEquipmentCalls).toEqual([])
  })

  it('Rcarmormagic=3 but health above 40% → health gate blocks the buy', () => {
    setRcarmormagic(3)
    ;(globalThis as any).game.global.soldierHealth = 50 // 50 > 40% of 100 → gate NOT met
    other.Rarmormagic()
    expect(buyEquipmentCalls).toEqual([])
  })

  it('Rcarmormagic=1 (Above 80%) requires world >= 0.8*(HZE+1); below it does not fire', () => {
    setRcarmormagic(1)
    ;(globalThis as any).game.global.world = 10 // armormagicworld = floor(100*0.8)=80 → 10 < 80 → no fire
    other.Rarmormagic()
    expect(buyEquipmentCalls).toEqual([])
  })
})
