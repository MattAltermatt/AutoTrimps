// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// #70 regression, U1 half — armormagic()'s "CAM: H:D" arm (index 2 of BOTH `carmormagic` and
// `darmormagic`) compared calcHDratio() against `MODULES["maps"].enoughDamageCutoff`, a field NOTHING
// anywhere ever assigns. `n >= undefined` is always false, so the middle option of both multitoggles
// was a silent no-op — dead for every U1 player since it was written, while reading like working code.
//
// The fix reads getPageSetting('mapcuntoff'), the H:D threshold the tooltip already promises ("the H:D
// you have defined in maps"). NOT by giving the MODULES field a value — that would mean inventing a
// balance number. Units check out: maps.ts:408 computes `enoughDamage = ourBaseDamage * mapcuntoff >
// enemyHealth`, i.e. `HD < mapcuntoff`, and calcHDratio() is `calcEnemyHealth() / ourBaseDamage`. So
// `calcHDratio() >= mapcuntoff` is exactly the complement — "not enough damage ⇒ buy armor".
//
// The U1 half had NO test at all before this file; other.rarmormagic.test.ts covers the U2 twin.

let other: typeof import('../src/modules/other')

const ARMOR = ['Shield', 'Boots', 'Helmet', 'Pants', 'Shoulderguards', 'Breastplate', 'Gambeson']

beforeAll(async () => {
  ;(globalThis as any).MODULES = {} // production's real starting shape — no phantom fields injected
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).playerSpire = { drawInfo: () => {} }
  ;(globalThis as any).nextWorld = () => {}
  other = await import('../src/modules/other')
})

let buyEquipmentCalls: unknown[][]

beforeEach(() => {
  buyEquipmentCalls = []
  ;(globalThis as any).autoTrimpSettings = {
    // mapcuntoff is the U1 H:D threshold the ==2 arm now reads (default '4', settings-defs.ts:392).
    mapcuntoff: { type: 'value', value: '4' },
    CapEquiparm: { type: 'value', value: '50' }, // buyArms' armour-level cap
    BuyArmorNew: { type: 'multitoggle', value: 1 }, // buyArms early-returns unless this is 1 or 3
  }
  ;(globalThis as any).game = {
    global: {
      buyAmt: 1, firing: false, lockTooltip: false, maxSplit: 1,
      world: 100, highestLevelCleared: 99,
      soldierHealth: 10, soldierHealthMax: 100, // 10 <= 40% of 100 → the health gate is MET
    },
    equipment: Object.fromEntries(ARMOR.map((n) => [n, { level: 0, locked: false }])),
  }
  ;(globalThis as any).preBuy = vi.fn()
  ;(globalThis as any).postBuy = vi.fn()
  ;(globalThis as any).canAffordBuilding = vi.fn(() => true)
  ;(globalThis as any).buyEquipment = vi.fn((...args: unknown[]) => { buyEquipmentCalls.push(args); return true })
  ;(globalThis as any).calcHDratio = vi.fn(() => 1)
})

const setCarmormagic = (value: number) => {
  ;(globalThis as any).autoTrimpSettings.carmormagic = { type: 'multitoggle', value }
}
const bought = () => buyEquipmentCalls.map((a) => a[0])

describe('#70: U1 armormagic "CAM: H:D" arm is live (it read a MODULES field nothing ever wrote)', () => {
  it('the phantom field is still unwritten — the fix repointed the READ, it did not mint a value', () => {
    // If someone "fixes" #70 by assigning MODULES.maps.enoughDamageCutoff instead, that is a new
    // game-balance literal and this goes red. The correct fix borrows the maintainer's existing default.
    expect((globalThis as any).MODULES?.maps?.enoughDamageCutoff).toBeUndefined()
  })

  it('carmormagic=2 (H:D) + H:D at/above mapcuntoff → buys armor', () => {
    setCarmormagic(2)
    ;(globalThis as any).calcHDratio = vi.fn(() => 9) // 9 >= 4 → under-damaged → buy armor
    other.armormagic()
    expect(bought()).toEqual(ARMOR)
  })

  it('carmormagic=2 (H:D) + H:D below mapcuntoff → does NOT buy', () => {
    setCarmormagic(2)
    ;(globalThis as any).calcHDratio = vi.fn(() => 1) // 1 < 4 → damage is fine → no armor
    other.armormagic()
    expect(bought()).toEqual([])
    // Before the fix BOTH of these cases bought nothing (`n >= undefined` is always false). The pair
    // above + this one is what proves the arm is live AND threshold-sensitive, not merely reachable.
  })

  it('the arm tracks the PLAYER\'s mapcuntoff, not a hardcoded number', () => {
    setCarmormagic(2)
    ;(globalThis as any).calcHDratio = vi.fn(() => 3)
    ;(globalThis as any).autoTrimpSettings.mapcuntoff.value = '10' // 3 < 10 → no buy
    other.armormagic()
    expect(bought()).toEqual([])

    buyEquipmentCalls.length = 0
    ;(globalThis as any).autoTrimpSettings.mapcuntoff.value = '2' // 3 >= 2 → buy
    other.armormagic()
    expect(bought()).toEqual(ARMOR)
  })

  it('the H:D arm still respects the health gate', () => {
    setCarmormagic(2)
    ;(globalThis as any).calcHDratio = vi.fn(() => 9)
    ;(globalThis as any).game.global.soldierHealth = 50 // 50 > 40% of 100 → gate NOT met
    other.armormagic()
    expect(bought()).toEqual([])
  })

  it('carmormagic=3 (Always) + low health → buys, regardless of H:D', () => {
    setCarmormagic(3)
    ;(globalThis as any).calcHDratio = vi.fn(() => 0.01) // far below the cutoff — irrelevant on this arm
    other.armormagic()
    expect(bought()).toEqual(ARMOR)
  })

  it('carmormagic=0 (Off) → does not buy', () => {
    setCarmormagic(0)
    ;(globalThis as any).calcHDratio = vi.fn(() => 9)
    other.armormagic()
    expect(bought()).toEqual([])
  })
})
