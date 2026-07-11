// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// Regression net for #58: U2 (radon) armor-magic was silently dead. `RbuyArms` (other.ts) is the
// armor buyer invoked by `Rarmormagic` (the only live caller, AutoTrimps2.js:348). It was gated on
// `getPageSetting('RBuyArmorNew')` — a PHANTOM setting (never createSetting'd), so getPageSetting
// returns false (utils.ts:58) and RbuyArms ALWAYS early-returned. Its live caller Rarmormagic already
// gates on the real Rcarmormagic/Rdarmormagic, so the phantom re-gate was a bad copy-paste of U1
// buyArms (where BuyArmorNew IS real + also drives the main U1 buy loop). Fix: drop the phantom gate.
//
// This test PINS the fixed behavior: with RBuyArmorNew UNSET (the real, phantom condition), calling
// RbuyArms must still buy armor. It is RED against the pre-fix gate (0 buys) and GREEN after.

let other: typeof import('../src/modules/other')

const ARMOR = ['Shield', 'Boots', 'Helmet', 'Pants', 'Shoulderguards', 'Breastplate', 'Gambeson']

beforeAll(async () => {
  ;(globalThis as any).MODULES = {} // other.ts writes MODULES["other"] at load
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).playerSpire = { drawInfo: () => {} } // other.ts reassigns playerSpire.drawInfo at load
  ;(globalThis as any).nextWorld = () => {} // other.ts wraps nextWorld at load (other.ts:556)
  other = await import('../src/modules/other')
})

let buyEquipmentCalls: unknown[][]
beforeEach(() => {
  buyEquipmentCalls = []
  // RCapEquiparm is a real 'value' setting RbuyArms reads for the level cap. RBuyArmorNew is
  // deliberately ABSENT — that is the phantom condition the bug lived under (getPageSetting → false).
  ;(globalThis as any).autoTrimpSettings = { RCapEquiparm: { type: 'value', value: '50' } }
  ;(globalThis as any).game = {
    global: { buyAmt: 1, firing: false, lockTooltip: false, maxSplit: 1 },
    equipment: Object.fromEntries(ARMOR.map((n) => [n, { level: 0, locked: false }])),
  }
  ;(globalThis as any).preBuy = vi.fn()
  ;(globalThis as any).postBuy = vi.fn()
  ;(globalThis as any).canAffordBuilding = vi.fn(() => true)
  ;(globalThis as any).buyEquipment = vi.fn((...args: unknown[]) => { buyEquipmentCalls.push(args); return true })
})

describe('#58: RbuyArms buys armor even when RBuyArmorNew is unset (phantom)', () => {
  it('calls buyEquipment for the affordable armor pieces (no longer early-returns)', () => {
    other.RbuyArms()
    // All 7 armor pieces are level 0 < cap 50, affordable, and Gambeson unlocked → all should buy.
    expect(buyEquipmentCalls.map((a) => a[0])).toEqual(ARMOR)
  })

  it('respects the level cap (a maxed piece is skipped)', () => {
    ;(globalThis as any).game.equipment.Shield.level = 50 // == cap → not < cap → skipped
    other.RbuyArms()
    expect(buyEquipmentCalls.map((a) => a[0])).toEqual(ARMOR.filter((n) => n !== 'Shield'))
  })
})
