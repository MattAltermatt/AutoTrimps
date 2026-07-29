// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// #203 — mostEfficientEquipment is an argmax over stat-per-resource that never excluded LOCKED
// slots, so a locked slot could WIN. Arbalest and Gambeson are the two U2 slots that start locked
// and they are exactly the ones that win: at level 0 their next-level cost is the lowest in the
// list, so log(value)/log(cost) is the highest. RautoEquip commits to the returned name, the game
// refuses the purchase, `keepBuying` never flips, and the do/while exits — U2 AutoEquip buys ZERO
// levels for the entire run. The oracle recorded that deadlock as correct behaviour, which is why
// the L0 differential is blind to it and this net has to exist.
//
// WHY THIS FILE AND NOT THE CHARACTERIZATION SUITE: that suite's selector assertion
// (equipment.characterization.test.ts:269) is `expect([...,'Arbalest']).toContain(weapon)` — it
// ACCEPTS Arbalest as a winner and its fixture leaves every slot unlocked, so it passes identically
// against the broken build and the fixed one. A golden master that pinned the bug is not a net.
//
// MUTANTS THIS FILE IS AIMED AT (the near-miss repairs, not the revert — a revert only proves the
// net sees the bug we already knew about):
//   1. `if (game.equipment[i].locked === true) continue` — reads correctly at the call site and
//      filters NOTHING, because the game stores `locked` as a NUMBER (1/0), never a boolean. Killed
//      by using the numeric form in every fixture below.
//   2. filtering the OUTPUT instead of the loop (blank the winner if it turns out locked) — leaves
//      the runner-up unselected and returns ''. Killed by asserting the winner is a real slot name.
//   3. placing the guard AFTER the statPerResource assignment — killed by the runaway-favourite
//      fixtures, where the locked slot would already have claimed the slot.

let equipment: typeof import('../src/modules/equipment')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  ;(globalThis as any).needGymystic = false
  ;(globalThis as any).autoTrimpSettings = {}
  equipment = await import('../src/modules/equipment')
})

const WEAPONS = ['Dagger', 'Mace', 'Polearm', 'Battleaxe', 'Greatsword', 'Arbalest']
const ARMOUR = ['Boots', 'Helmet', 'Pants', 'Shoulderguards', 'Breastplate', 'Gambeson', 'Shield']

/**
 * Builds the U2 RequipmentList slot set. `locked` is written as a NUMBER on purpose — that is the
 * game's own representation (config.js ships `locked: 1`), and it is what kills mutant 1.
 */
function u2Game(locked: Record<string, number> = {}, over: Record<string, any> = {}): any {
  const equipment: Record<string, any> = {}
  for (const name of [...WEAPONS, ...ARMOUR]) {
    equipment[name] = {
      locked: locked[name] ?? 0,
      level: 10, // a deep-ish level so an UNLOCKED slot's cost is meaningfully above a level-0 one
      prestige: 1,
      attackCalculated: WEAPONS.includes(name) ? 10 : 0,
      healthCalculated: ARMOUR.includes(name) ? 10 : 0,
      cost: { metal: [40, 1.2], wood: [40, 1.2] },
    }
  }
  return makeMinimalGame({
    global: {
      world: 100, challengeActive: '', universe: 2,
      prestige: { attack: 1, health: 1, block: 1 },
    },
    equipment,
    portal: {
      Artisanistry: { modifier: 0, level: 0, radLevel: 0 },
      Equality: { modifier: 0.9, radLevel: 5 },
    },
    challenges: { Pandemonium: { getEnemyMult: () => 1, isEquipBlocked: () => false } },
    ...over,
  })
}

/** Makes `name` the runaway argmax: level 0 (cheapest next level) and the best stat. */
function makeFavourite(game: any, name: string, stat: 'attackCalculated' | 'healthCalculated') {
  game.equipment[name].level = 0
  game.equipment[name][stat] = 1e9
}

describe('#203 — mostEfficientEquipment must not rank LOCKED slots', () => {
  it('CONTROL: an UNLOCKED Arbalest that is the best buy DOES win (the net can see the difference)', () => {
    const game = u2Game()
    makeFavourite(game, 'Arbalest', 'attackCalculated')
    ;(globalThis as any).game = game
    ;(globalThis as any).autoBattle = { oneTimers: { Artisan: { owned: false, getMult: () => 1 } } }

    const [weapon] = equipment.mostEfficientEquipment()
    // Anti-false-green: if this ever stops holding, the fixtures below prove nothing — they would
    // be asserting "not Arbalest" against a build where Arbalest could never have won anyway.
    expect(weapon).toBe('Arbalest')
  })

  it('a LOCKED Arbalest never wins the weapon slot, and a real weapon wins instead', () => {
    const game = u2Game({ Arbalest: 1 })
    makeFavourite(game, 'Arbalest', 'attackCalculated')
    ;(globalThis as any).game = game
    ;(globalThis as any).autoBattle = { oneTimers: { Artisan: { owned: false, getMult: () => 1 } } }

    const [weapon] = equipment.mostEfficientEquipment()
    expect(weapon).not.toBe('Arbalest')
    // Kills mutant 2: filtering the OUTPUT would leave '' here, which the caller treats as a slot
    // name and hands to buyEquipment — a different flavour of the same deadlock.
    expect(weapon).not.toBe('')
    expect(WEAPONS.filter(w => w !== 'Arbalest')).toContain(weapon)
  })

  it('a LOCKED Gambeson never wins the armour slot, and a real armour piece wins instead', () => {
    const game = u2Game({ Gambeson: 1 })
    makeFavourite(game, 'Gambeson', 'healthCalculated')
    ;(globalThis as any).game = game
    ;(globalThis as any).autoBattle = { oneTimers: { Artisan: { owned: false, getMult: () => 1 } } }

    const [, armour] = equipment.mostEfficientEquipment()
    expect(armour).not.toBe('Gambeson')
    expect(armour).not.toBe('')
    expect(ARMOUR.filter(a => a !== 'Gambeson')).toContain(armour)
  })

  it('the realistic U2 opening — BOTH start locked and BOTH are the cheapest — still returns two real slots', () => {
    const game = u2Game({ Arbalest: 1, Gambeson: 1 })
    makeFavourite(game, 'Arbalest', 'attackCalculated')
    makeFavourite(game, 'Gambeson', 'healthCalculated')
    ;(globalThis as any).game = game
    ;(globalThis as any).autoBattle = { oneTimers: { Artisan: { owned: false, getMult: () => 1 } } }

    const [weapon, armour] = equipment.mostEfficientEquipment()
    expect(weapon).not.toBe('Arbalest')
    expect(armour).not.toBe('Gambeson')
    expect(weapon).not.toBe('')
    expect(armour).not.toBe('')
  })

  it('`locked` is honoured in its NUMERIC form — a truthy 1, not a boolean true', () => {
    // Mutant 1 lives here. `locked === true` is false for `locked: 1`, so a strict-equality repair
    // ranks the locked slot exactly as before while looking correct at the call site. The game ships
    // `locked: 1` (config.js), so the boolean form this mutant expects does not occur in production.
    const game = u2Game({ Arbalest: 1 })
    makeFavourite(game, 'Arbalest', 'attackCalculated')
    expect(typeof game.equipment.Arbalest.locked).toBe('number')
    ;(globalThis as any).game = game
    ;(globalThis as any).autoBattle = { oneTimers: { Artisan: { owned: false, getMult: () => 1 } } }

    expect(equipment.mostEfficientEquipment()[0]).not.toBe('Arbalest')
  })
})
