// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// S8 gap closure — #207 shipped WITHOUT a test that fails without it, which the campaign plan
// forbids ("Every fix ships a test that fails without it. No exceptions"). A fresh reviewer found
// there is no `tests/other.buyWeps*` or `tests/other.buyArms*` file at all: the U2 sibling RbuyArms
// has one (other.rbuyArms.test.ts, #58) and the U1 twins fixed here had none.
//
// THE BUG: `CapEquip2` ("Weapon Level Cap") and `CapEquiparm` ("Armor Level Cap") both document
// "Disable with -1 or 0" in their own tooltips (settings-defs.ts:1054-1061). The raw setting was
// spliced straight into `level < getPageSetting('CapEquip2')`, and `level < -1` / `level < 0` is
// FALSE for every slot at every level — so the documented disable value turned buyWeps and buyArms
// into total no-ops. The exact opposite of "no cap": the user asks for uncapped buying and gets none.
//
// The U2 sibling (RbuyArms, other.ts ~:301) and the equipment.ts wall (`cap > 0 && level >= cap`)
// already normalise `<= 0` to "uncapped". The U1 twins never got that #68-era fix.

let other: typeof import('../src/modules/other')

const WEAPONS = ['Dagger', 'Mace', 'Polearm', 'Battleaxe', 'Greatsword', 'Arbalest']
const ARMOUR = ['Shield', 'Boots', 'Helmet', 'Pants', 'Shoulderguards', 'Breastplate', 'Gambeson']

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).playerSpire = { drawInfo: () => {} }
  ;(globalThis as any).nextWorld = () => {}
  other = await import('../src/modules/other')
})

let buyEquipmentCalls: unknown[][]

function seed(settings: Record<string, unknown>, levels: Record<string, number> = {}) {
  ;(globalThis as any).autoTrimpSettings = {
    // Both buyers gate on their New-style dispatch first; 1 is the "buy levels + upgrades" arm.
    BuyWeaponsNew: { type: 'multitoggle', value: 1 },
    BuyArmorNew: { type: 'multitoggle', value: 1 },
    gearamounttobuy: { type: 'value', value: 1 },
    ...settings,
  }
  ;(globalThis as any).game = {
    global: { buyAmt: 1, firing: false, lockTooltip: false, maxSplit: 1 },
    equipment: Object.fromEntries(
      [...WEAPONS, ...ARMOUR].map((n) => [n, { level: levels[n] ?? 0, locked: false }]),
    ),
  }
}

beforeEach(() => {
  buyEquipmentCalls = []
  ;(globalThis as any).preBuy = vi.fn()
  ;(globalThis as any).postBuy = vi.fn()
  ;(globalThis as any).canAffordBuilding = vi.fn(() => true)
  ;(globalThis as any).buyEquipment = vi.fn((...args: unknown[]) => { buyEquipmentCalls.push(args); return true })
})

describe('#207 — the documented "disable" value must mean NO CAP, not "buy nothing"', () => {
  it('anti-false-green: a normal positive cap buys every slot under it', () => {
    // Proves the fixture reaches the buy loop at all. Without this, every assertion below could be
    // passing because nothing runs rather than because the cap is handled.
    seed({ CapEquip2: { type: 'value', value: 10 }, CapEquiparm: { type: 'value', value: 10 } })
    other.buyWeps()
    other.buyArms()
    expect(buyEquipmentCalls.map((a) => a[0])).toEqual([...WEAPONS, ...ARMOUR])
  })

  it('a positive cap still WALLS a slot that has reached it', () => {
    // The cap must keep working — a fix that simply deleted the comparison would pass the -1/0 cases
    // below and silently uncap every user.
    seed(
      { CapEquip2: { type: 'value', value: 10 }, CapEquiparm: { type: 'value', value: 10 } },
      { Dagger: 10, Shield: 10 },
    )
    other.buyWeps()
    other.buyArms()
    const bought = buyEquipmentCalls.map((a) => a[0])
    expect(bought).not.toContain('Dagger')
    expect(bought).not.toContain('Shield')
    expect(bought).toContain('Mace')
    expect(bought).toContain('Boots')
  })

  for (const disable of [-1, 0]) {
    it(`CapEquip2 = ${disable} means UNCAPPED — every weapon still buys, at any level`, () => {
      // RED before the fix: `level < -1` and `level < 0` are false for all six slots, so buyWeps
      // called buyEquipment zero times and the user's "disable the cap" produced "buy no weapons".
      seed(
        { CapEquip2: { type: 'value', value: disable }, CapEquiparm: { type: 'value', value: 10 } },
        Object.fromEntries(WEAPONS.map((n) => [n, 999])), // far above any plausible cap
      )
      other.buyWeps()
      expect(buyEquipmentCalls.map((a) => a[0])).toEqual(WEAPONS)
    })

    it(`CapEquiparm = ${disable} means UNCAPPED — every armour slot still buys, at any level`, () => {
      seed(
        { CapEquip2: { type: 'value', value: 10 }, CapEquiparm: { type: 'value', value: disable } },
        Object.fromEntries(ARMOUR.map((n) => [n, 999])),
      )
      other.buyArms()
      expect(buyEquipmentCalls.map((a) => a[0])).toEqual(ARMOUR)
    })
  }

  it('the locked-slot guards survive the change — Arbalest and Gambeson are still skipped', () => {
    // Both buyers carry a per-slot `!locked` guard that the cap hoist must not have disturbed.
    // (This is also the U1 half of #203's rule, applied per-slot rather than at a ranking.)
    seed({ CapEquip2: { type: 'value', value: -1 }, CapEquiparm: { type: 'value', value: -1 } })
    ;(globalThis as any).game.equipment.Arbalest.locked = true
    ;(globalThis as any).game.equipment.Gambeson.locked = true
    other.buyWeps()
    other.buyArms()
    const bought = buyEquipmentCalls.map((a) => a[0])
    expect(bought).not.toContain('Arbalest')
    expect(bought).not.toContain('Gambeson')
    expect(bought).toContain('Dagger')
    expect(bought).toContain('Shield')
  })
})
