// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// #218 — estimateEquipsForZone's cost total had two independent understatements:
//   1. getTotalMultiCost prices a run of n levels starting from level ZERO, but the slot is already
//      at game.equipment[equip].level and the game charges base * scaling^level. The whole sum was
//      therefore short by scaling^level — 1.2^20 ~ 38x at level 20.
//   2. Shield is priced in WOOD, every other slot in METAL, and both were summed into one figure
//      that maps.ts:1352 compares against game.resources.metal.owned.
// Both understate the farm target, so AT stops equip-farming early and returns to a zone whose gear
// it still cannot afford.
//
// WHY THIS FILE AND NOT THE CHARACTERIZATION SUITE: that suite's ONLY assertion for this function is
// the zero case — `expect(r[0]).toBe(0)` with `bonusLevels` empty, so the accumulation loop never
// executes a single iteration. It passes identically against every version of the formula. Reach is
// not sensitivity: the function was called, but its answer fed a case that could not depend on it.
//
// The expectations here are DERIVED from the returned bonusLevels and the game's own price formula,
// never hardcoded level counts — the selector upstream is free to change which slots it picks
// without rotting this file.

let equipment: typeof import('../src/modules/equipment')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  ;(globalThis as any).needGymystic = false
  ;(globalThis as any).autoTrimpSettings = {}
  equipment = await import('../src/modules/equipment')
})

const WEAPONS = ['Dagger', 'Mace', 'Polearm', 'Battleaxe', 'Greatsword', 'Arbalest']
const ARMOUR = ['Boots', 'Helmet', 'Pants', 'Shoulderguards', 'Breastplate', 'Gambeson', 'Shield']

/** The game's own compounding-cost closed form (equipment.ts getTotalMultiCost, isCompounding). */
function multiCost(base: number, n: number, scaling: number) {
  return base * ((1 - Math.pow(scaling, n)) / (1 - scaling))
}

function u2Game(levels: Record<string, number> = {}) {
  const equipment: Record<string, any> = {}
  for (const name of [...WEAPONS, ...ARMOUR]) {
    equipment[name] = {
      locked: 0,
      level: levels[name] ?? 0,
      prestige: 1,
      attackCalculated: WEAPONS.includes(name) ? 10 : 0,
      healthCalculated: ARMOUR.includes(name) ? 10 : 0,
      cost: { metal: [40, 1.2], wood: [40, 1.2] },
    }
  }
  return makeMinimalGame({
    global: {
      world: 100, challengeActive: '', universe: 2, mapBonus: 10,
      prestige: { attack: 1, health: 1, block: 1 },
    },
    equipment,
    resources: { metal: { owned: 1e9 }, wood: { owned: 1e9 } },
    portal: {
      Artisanistry: { modifier: 0, level: 0, radLevel: 0 },
      Equality: { modifier: 0.9, radLevel: 0 },
    },
    challenges: { Pandemonium: { getEnemyMult: () => 1, isEquipBlocked: () => false } },
  })
}

/**
 * Puts the estimator in a state where it genuinely wants levels, so bonusLevels is non-empty.
 * Deliberately MODEST: an extreme deficit runs the selector past MAX_EQUIP_DELTA (700) and takes the
 * `return [Infinity, bonusLevels]` early exit, which is only two elements long — the accumulation
 * loop under test never runs and index [2] does not exist. mapBonus is 10 so the `< 10` branch does
 * not multiply the attack requirement by 5 on top.
 */
function needGear(levels: Record<string, number> = {}) {
  ;(globalThis as any).RcalcBadGuyDmg = () => 50
  ;(globalThis as any).RcalcOurHealth = () => 10
  ;(globalThis as any).RgetEnemyMaxHealth = () => 50
  ;(globalThis as any).RcalcOurDmg = () => 10
  ;(globalThis as any).RcalcHDratio = () => 2
  ;(globalThis as any).RgetEnemyMaxAttack = () => 1e6
  ;(globalThis as any).getTotalHealthMod = () => 1
  ;(globalThis as any).autoBattle = { oneTimers: { Artisan: { owned: false, getMult: () => 1 } } }
  ;(globalThis as any).autoTrimpSettings = { Rhitssurvived: { type: 'value', value: 1 } }
  ;(globalThis as any).game = u2Game(levels)
}

/** Re-derives the two totals the function should have produced, from what it says it wants to buy. */
function expected(bonusLevels: Record<string, number>, levels: Record<string, number>) {
  let metal = 0
  let wood = 0
  for (const equip of Object.keys(bonusLevels)) {
    const isWood = equip === 'Shield'
    const at = levels[equip] ?? 0
    const cost = multiCost(40, bonusLevels[equip], 1.2) * Math.pow(1.2, at)
    if (isWood) wood += cost
    else metal += cost
  }
  return { metal, wood }
}

describe('#218 — estimateEquipsForZone prices levels from where the slot actually sits', () => {
  it('sanity: the fixture reaches a NON-EMPTY bonusLevels (otherwise every assertion below is vacuous)', () => {
    needGear()
    const [, bonusLevels] = equipment.estimateEquipsForZone() as [number, Record<string, number>, number, number]
    // This is the anti-false-green guard. The characterization suite's only estimateEquipsForZone
    // assertion runs with bonusLevels === {}, where the accumulation loop body never executes — which
    // is exactly why it could not catch #218. If this ever goes empty, this whole file stops testing.
    expect(Object.keys(bonusLevels).length).toBeGreaterThan(0)
  })

  it('at level 0 the level offset is 1, so the total matches the plain compounding sum', () => {
    needGear()
    const r = equipment.estimateEquipsForZone() as [number, Record<string, number>, number, number]
    const exp = expected(r[1], {})
    expect(r[0]).toBeCloseTo(exp.metal, 6)
  })

  it('a slot ALREADY at level 20 costs 1.2^20 more than the same run at level 0', () => {
    // The bug: getTotalMultiCost priced every run from zero, so these two came out identical.
    needGear()
    const flat = equipment.estimateEquipsForZone() as [number, Record<string, number>, number, number]

    const deepLevels: Record<string, number> = {}
    for (const name of [...WEAPONS, ...ARMOUR]) deepLevels[name] = 20
    needGear(deepLevels)
    const deep = equipment.estimateEquipsForZone() as [number, Record<string, number>, number, number]

    expect(deep[0]).toBeGreaterThan(flat[0])
    // Derived, not asserted as a magic number: each slot's run is scaled by 1.2^20.
    const exp = expected(deep[1], deepLevels)
    expect(deep[0]).toBeCloseTo(exp.metal, 6)
  })

  it('WOOD is reported separately and never folded into the metal figure', () => {
    // maps.ts:1352 compares index [0] against game.resources.metal.owned, so a wood cost living in
    // [0] makes AT farm metal to cover a wood bill.
    //
    // THIS TEST HAD A HOLE AND MUTATION TESTING FOUND IT. The first version guarded the decisive
    // assertion behind `if (exp.wood > 0)` and used a fixture where Shield never won the armour slot,
    // so exp.wood was 0, the guard skipped, and the mutant that splits wood out and then adds it to
    // the metal total anyway passed 5/5. A conditional assertion is not an assertion — the fixture
    // now FORCES Shield into bonusLevels and asserts that precondition before relying on it.
    needGear()
    // Make Shield the runaway armour pick: same cost basis as its rivals, an order more health.
    ;(globalThis as any).game.equipment.Shield.healthCalculated = 1e4

    const r = equipment.estimateEquipsForZone() as [number, Record<string, number>, number, number]
    const exp = expected(r[1], {})

    // Precondition, asserted rather than assumed: without Shield in the set there is no wood cost at
    // all and everything below is vacuously true.
    expect(Object.keys(r[1])).toContain('Shield')
    expect(exp.wood).toBeGreaterThan(0)

    expect(r[0]).toBeCloseTo(exp.metal, 6)
    expect(r[3]).toBeCloseTo(exp.wood, 6)
    // The mutant this exists to kill: wood computed correctly into [3] AND still added to [0].
    expect(r[0]).toBeLessThan(exp.metal + exp.wood)
  })

  it('the return shape is APPENDED to, not reordered — maps.ts:971 reads index [2]', () => {
    needGear()
    const r = equipment.estimateEquipsForZone() as [number, Record<string, number>, number, number]
    expect(typeof r[0]).toBe('number')
    expect(typeof r[1]).toBe('object')
    expect(typeof r[2]).toBe('number') // tempEqualityUse — the one index another module reads
    expect(typeof r[3]).toBe('number')
  })
})
