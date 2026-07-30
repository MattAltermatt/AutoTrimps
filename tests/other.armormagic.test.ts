// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// #70 regression, U1 half — armormagic()'s "CAM: H:D" arm (index 2 of BOTH `carmormagic` and
// `darmormagic`) compared calcHDratio() against `MODULES["maps"].enoughDamageCutoff`, a field NOTHING
// anywhere ever assigns. `n >= undefined` is always false, so the middle option of both multitoggles
// was a silent no-op — dead for every U1 player since it was written, while reading like working code.
//
// The fix reads getPageSetting('MapDamageCutoff'), the H:D threshold the tooltip already promises ("the H:D
// you have defined in maps"). NOT by giving the MODULES field a value — that would mean inventing a
// balance number. Units check out: maps.ts:408 computes `enoughDamage = ourBaseDamage * MapDamageCutoff >
// enemyHealth`, i.e. `HD < MapDamageCutoff`, and calcHDratio() is `calcEnemyHealth() / ourBaseDamage`. So
// `calcHDratio() >= MapDamageCutoff` is exactly the complement — "not enough damage ⇒ buy armor".
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
    // MapDamageCutoff is the U1 H:D threshold the ==2 arm now reads (default '4', settings-defs.ts:392).
    MapDamageCutoff: { type: 'value', value: '4' },
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

// #234 — armormagic() now takes the MODE as a parameter; the dispatcher picks it from the context
// that admitted the call (Daily -> darmormagic, C2 -> carmormagic) instead of the body OR-ing both.
// Every assertion below is about a MODE, so they carry over unchanged; only the driver moves.
let mode = 0
const setCarmormagic = (value: number) => {
  mode = value
  ;(globalThis as any).autoTrimpSettings.carmormagic = { type: 'multitoggle', value }
}
const bought = () => buyEquipmentCalls.map((a) => a[0])

describe('#70: U1 armormagic "CAM: H:D" arm is live (it read a MODULES field nothing ever wrote)', () => {
  it('the phantom field is still unwritten — the fix repointed the READ, it did not mint a value', () => {
    // If someone "fixes" #70 by assigning MODULES.maps.enoughDamageCutoff instead, that is a new
    // game-balance literal and this goes red. The correct fix borrows the maintainer's existing default.
    expect((globalThis as any).MODULES?.maps?.enoughDamageCutoff).toBeUndefined()
  })

  it('carmormagic=2 (H:D) + H:D at/above MapDamageCutoff → buys armor', () => {
    setCarmormagic(2)
    ;(globalThis as any).calcHDratio = vi.fn(() => 9) // 9 >= 4 → under-damaged → buy armor
    other.armormagic(mode)
    expect(bought()).toEqual(ARMOR)
  })

  it('carmormagic=2 (H:D) + H:D below MapDamageCutoff → does NOT buy', () => {
    setCarmormagic(2)
    ;(globalThis as any).calcHDratio = vi.fn(() => 1) // 1 < 4 → damage is fine → no armor
    other.armormagic(mode)
    expect(bought()).toEqual([])
    // Before the fix BOTH of these cases bought nothing (`n >= undefined` is always false). The pair
    // above + this one is what proves the arm is live AND threshold-sensitive, not merely reachable.
  })

  it('the arm tracks the PLAYER\'s MapDamageCutoff, not a hardcoded number', () => {
    setCarmormagic(2)
    ;(globalThis as any).calcHDratio = vi.fn(() => 3)
    ;(globalThis as any).autoTrimpSettings.MapDamageCutoff.value = '10' // 3 < 10 → no buy
    other.armormagic(mode)
    expect(bought()).toEqual([])

    buyEquipmentCalls.length = 0
    ;(globalThis as any).autoTrimpSettings.MapDamageCutoff.value = '2' // 3 >= 2 → buy
    other.armormagic(mode)
    expect(bought()).toEqual(ARMOR)
  })

  it('the H:D arm still respects the health gate', () => {
    setCarmormagic(2)
    ;(globalThis as any).calcHDratio = vi.fn(() => 9)
    ;(globalThis as any).game.global.soldierHealth = 50 // 50 > 40% of 100 → gate NOT met
    other.armormagic(mode)
    expect(bought()).toEqual([])
  })

  it('carmormagic=3 (Always) + low health → buys, regardless of H:D', () => {
    setCarmormagic(3)
    ;(globalThis as any).calcHDratio = vi.fn(() => 0.01) // far below the cutoff — irrelevant on this arm
    other.armormagic(mode)
    expect(bought()).toEqual(ARMOR)
  })

  it('carmormagic=0 (Off) → does not buy', () => {
    setCarmormagic(0)
    ;(globalThis as any).calcHDratio = vi.fn(() => 9)
    other.armormagic(mode)
    expect(bought()).toEqual([])
  })
})

describe('#234: the mode comes from the caller — the body reads NEITHER multitoggle', () => {
  beforeEach(() => {
    // Both settings armed at "Always", the mode that fires unconditionally on low health. Pre-fix the
    // body OR'd them, so EITHER of these satisfied the third arm no matter which context called.
    ;(globalThis as any).autoTrimpSettings.carmormagic = { type: 'multitoggle', value: 3 }
    ;(globalThis as any).autoTrimpSettings.darmormagic = { type: 'multitoggle', value: 3 }
  })

  it('mode 1 below the zone gate does NOT buy, even with both settings at 3', () => {
    // THE BUG: a bogged Daily configured "DAM: Above 80%" (mode 1) below that zone used to buy anyway,
    // because carmormagic == 3 satisfied the Always arm. world 10 vs armormagicworld = floor(100*0.8).
    ;(globalThis as any).game.global.world = 10
    other.armormagic(1)
    expect(bought()).toEqual([])
  })

  it('mode 2 below the H:D cutoff does NOT buy, even with both settings at 3', () => {
    ;(globalThis as any).calcHDratio = vi.fn(() => 1) // 1 < MapDamageCutoff 4
    other.armormagic(2)
    expect(bought()).toEqual([])
  })

  it('mode 0 (Off) does NOT buy, even with both settings at 3', () => {
    other.armormagic(0)
    expect(bought()).toEqual([])
  })

  it('anti-false-green: mode 3 with the SAME settings does buy', () => {
    // Without this, a body that never buys would satisfy all three assertions above.
    other.armormagic(3)
    expect(bought()).toEqual(ARMOR)
  })

  it('and the settings are genuinely irrelevant — clearing both changes nothing', () => {
    delete (globalThis as any).autoTrimpSettings.carmormagic
    delete (globalThis as any).autoTrimpSettings.darmormagic
    other.armormagic(3)
    expect(bought()).toEqual(ARMOR)
  })
})
