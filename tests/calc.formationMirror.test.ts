// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getTrimpAttack, calcOurHealth, calcOurBlock, calcOurDmg } from '../src/modules/calc'
import { makeMinimalGame } from './harness/gameFixture'

// #290/#294 — the formation mirror. Decision 1 of the review-fix campaign is "a mirror must match the
// pinned clone exactly", so this pins AT's four formation sites against the clone's own guards.
//
// Every formation 0-5 is driven at every site. A W-only test would have passed against the broken
// build at calcOurBlock (W is right there by accident) and would have missed that #290's own one-line
// patch regresses the formation-NEUTRAL path, which is only visible by checking W against D/H/B/S.

const CLONE = resolve(process.env.TRIMPS_GAME_DIR ?? '.trimps-game', 'main.js')

/** Formations the game recognises. 5 is W (uber Wind). */
const ALL_FORMATIONS = [0, 1, 2, 3, 4, 5] as const

// ---------------------------------------------------------------------------------------------
// The clone is the oracle. Derive its rule from source rather than retyping it, so an upstream bump
// that changes the guard reddens here instead of silently drifting AT's mirror out of parity.
// ---------------------------------------------------------------------------------------------

describe('the clone still exempts formation 5 from every stat multiplier', () => {
  const src = readFileSync(CLONE, 'utf8')

  // `if (game.global.formation !== 0 && game.global.formation !== 5) { <stat> *= ... ? 4 : 0.5 }`
  const guards = [...src.matchAll(
    /game\.global\.formation\s*!==\s*0\s*&&\s*game\.global\.formation\s*!==\s*5/g,
  )]

  it('guards attack, health and block on `!== 0 && !== 5` at four or more sites', () => {
    // main.js:11774 (soldierHealthMax), :11925 (healthTemp), :12002 (attack), :12013 (block difs),
    // :12209 (getBaseBlock). If this count drops, upstream changed the rule — do not "fix" the test.
    expect(guards.length).toBeGreaterThanOrEqual(4)
  })

  it('has no `case 5` in setFormation — entering W applies nothing', () => {
    const applySwitch = src.slice(src.indexOf('function setFormation'))
    const body = applySwitch.slice(0, applySwitch.indexOf('\nfunction '))
    // The switch that applies the new formation covers 1-4 only.
    expect(body).toMatch(/case 4:/)
    expect(body).not.toMatch(/case 5:/)
  })

  it('scans a corpus that actually contains the shapes it looks for (anti-false-green)', () => {
    // If the read silently returned an empty/wrong file, every assertion above degrades to vacuous.
    expect(src.length).toBeGreaterThan(100_000)
    expect(src).toContain('function setFormation')
  })
})

// ---------------------------------------------------------------------------------------------
// Behavioural golden masters. One neutral fixture; formation is the only variable.
// ---------------------------------------------------------------------------------------------

/** The multiplier the game applies to each stat, per formation. Mirrors main.js's three guards. */
const GAME_ATTACK_MULT: Record<number, number> = { 0: 1, 1: 0.5, 2: 4, 3: 0.5, 4: 0.5, 5: 1 }
const GAME_HEALTH_MULT: Record<number, number> = { 0: 1, 1: 4, 2: 0.5, 3: 0.5, 4: 0.5, 5: 1 }
const GAME_BLOCK_MULT: Record<number, number> = { 0: 1, 1: 0.5, 2: 0.5, 3: 4, 4: 0.5, 5: 1 }

const noMult = { getTrimpMult: () => 1 }

function seedGlobals() {
  ;(globalThis as any).mutations = { Magma: { active: () => false, getTrimpDecay: () => 1 } }
  ;(globalThis as any).dailyModifiers = {}
  ;(globalThis as any).challengeActive = () => false
  ;(globalThis as any).calcHeirloomBonus = (_t: string, _m: string, n: number) => n ?? 0
  ;(globalThis as any).autoBattle = { oneTimers: { Burstier: { owned: false } } }
  ;(globalThis as any).Fluffy = {
    isActive: () => false,
    getDamageModifier: () => 1,
    isRewardActive: () => false,
  }
  ;(globalThis as any).gammaBurstPct = 0
  ;(globalThis as any).getMegaCritDamageMult = () => 1
  // getPageSetting is a MODULE import inside calc.ts, so stubbing the global would not intercept it
  // (see CLAUDE.md: "you cannot spy on a converted module by reassigning the global"). Drive the
  // primitive it actually reads instead — an empty store makes every getPageSetting return false.
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).textSettingIsSet = () => false
  ;(globalThis as any).getPlayerDoubleCritChance = () => 0
  ;(globalThis as any).getEmpowerment = () => ''
  ;(globalThis as any).playerSpireTraps = { Strength: { owned: false, getWorldBonus: () => 0 } }
  ;(globalThis as any).sugarRush = { getAttackStrength: () => 1 }
  // getCritMulti is calc.ts's OWN export, so it cannot be stubbed from globalThis either — neutralise
  // it through its inputs: zero crit chance and a crit damage of exactly 1.
  ;(globalThis as any).getPlayerCritChance = () => 0
  ;(globalThis as any).getPlayerCritDamageMult = () => 1
  ;(globalThis as any).calcBadGuyDmg = () => 1
  ;(globalThis as any).getEnemyMaxAttack = () => 1
  ;(globalThis as any).mutations.Healthy = { active: () => false, cellCount: () => 0 }
  ;(globalThis as any).mutations.Corruption = { active: () => false }
}

/** Base attack 10 * 10 soldiers = 100 before any formation factor. */
function gameWith(formation: number) {
  return makeMinimalGame({
    global: {
      formation,
      world: 1,
      challengeActive: '',
      dailyChallenge: {},
      lastLowGen: 0,
      radioStacks: 0,
      totalSquaredReward: 0,
      voidBuff: false,
      brokenPlanet: false,
      antiStacks: 0,
      mapBonus: 0,
      achievementBonus: 0,
      roboTrimpLevel: 0,
      spireRows: 0,
      sugarRush: 0,
      uberNature: '',
    },
    equipment: {
      Dagger: { locked: 0, attackCalculated: 10, level: 1 },
      Mace: { locked: 1 }, Polearm: { locked: 1 }, Battleaxe: { locked: 1 },
      Greatsword: { locked: 1 }, Arbalest: { locked: 1 },
      Shield: { locked: 1, blockNow: false, level: 0, blockCalculated: 0, healthCalculated: 0 },
      Boots: { locked: 1 }, Helmet: { locked: 1 }, Pants: { locked: 1 },
      Shoulderguards: { locked: 1 }, Breastplate: { locked: 1 }, Gambeson: { locked: 1 },
    },
    resources: { trimps: { maxSoldiers: 10 } },
    portal: {
      Power: { level: 0, modifier: 0 }, Power_II: { level: 0, modifier: 0 },
      Toughness: { level: 0, modifier: 0 }, Toughness_II: { level: 0, modifier: 0 },
      Resilience: { level: 0, modifier: 0 },
      Range: { level: 0, modifier: 0 },
      Anticipation: { level: 0, modifier: 0 },
      Relentlessness: { level: 0, modifier: 0 },
      Criticality: { level: 0, modifier: 0 },
recycle: { level: 0 },
    },
    goldenUpgrades: { Battle: { currentBonus: 0 } },
    challenges: {
      Frigid: noMult, Mayhem: noMult, Pandemonium: noMult, Desolation: noMult,
      Electricity: { stacks: 0 }, Decay: { stacks: 0 }, Life: { getHealthMult: () => 1 },
    },
    jobs: {
      Geneticist: { owned: 0 },
      Trainer: { owned: 0, modifier: 0 },
      Amalgamator: { owned: 0, getHealthMult: () => 1, getDamageMult: () => 1 },
      Magmamancer: { getBonusPercent: () => 1 },
    },
    buildings: { Gym: { owned: 100, increase: { by: 1 } } }, // block base 100 * 10 soldiers = 1000
    talents: {
      voidPower: { purchased: false }, voidPower2: {}, voidPower3: {},
      scry: { purchased: false }, mapBattery: { purchased: false },
      magmamancer: { purchased: false }, stillRowing2: { purchased: false },
      voidMastery: { purchased: false }, healthStrength: { purchased: false },
      herbalist: { purchased: false, getBonus: () => 1 }, daily: { purchased: false },
    },
    empowerments: { Ice: { getDamageModifier: () => 0 }, Poison: { getModifier: () => 0 } },
    singleRunBonuses: { sharpTrimps: { owned: false } },
    stats: { totalVoidMaps: { value: 0 } },
  })
}

describe('calc.ts mirrors the clone at every formation', () => {
  beforeEach(seedGlobals)

  const BASE_ATTACK = 100 // 6 + 10*1 → 16? no: dmg starts at 6, +10 = 16, *10 soldiers = 160
  void BASE_ATTACK

  it.each(ALL_FORMATIONS)('getTrimpAttack applies the game\'s attack factor in formation %i', (f) => {
    ;(globalThis as any).game = gameWith(f)
    const neutral = 160 // (6 + 10*1) * 10 maxSoldiers
    expect(getTrimpAttack()).toBe(neutral * GAME_ATTACK_MULT[f])
  })

  it.each(ALL_FORMATIONS)('calcOurHealth(true) applies the game\'s health factor in formation %i', (f) => {
    ;(globalThis as any).game = gameWith(f)
    const neutral = 500 // 50 base * 10 maxSoldiers, no gear health
    expect(calcOurHealth(true)).toBe(neutral * GAME_HEALTH_MULT[f])
  })

  it.each(ALL_FORMATIONS)('calcOurBlock(true) applies the game\'s block factor in formation %i', (f) => {
    ;(globalThis as any).game = gameWith(f)
    const neutral = 1000 // Gym 100 * increase.by 1 * 10 maxSoldiers
    expect(calcOurBlock(true)).toBe(neutral * GAME_BLOCK_MULT[f])
  })

  it.each(ALL_FORMATIONS)('calcOurHealth(false) is formation-neutral in formation %i', (f) => {
    ;(globalThis as any).game = gameWith(f)
    expect(calcOurHealth(false)).toBe(500)
  })

  it.each(ALL_FORMATIONS)('calcOurBlock(false) is formation-neutral in formation %i', (f) => {
    ;(globalThis as any).game = gameWith(f)
    expect(calcOurBlock(false)).toBe(1000)
  })
})

describe('calcOurDmg: the neutralizer and getTrimpAttack must agree', () => {
  beforeEach(seedGlobals)

  // This is the claim that #290 got backwards, written as an assertion rather than a comment.
  // `incStance = false` divides out whatever getTrimpAttack applied, so the answer is the SAME in
  // every formation. Break either site alone and one of these six rows goes red.
  it.each(ALL_FORMATIONS)('calcOurDmg(avg, incStance=false) is formation-neutral in formation %i', (f) => {
    ;(globalThis as any).game = gameWith(f)
    expect(calcOurDmg('avg', false, false)).toBe(160)
  })

  // And `incStance = true` keeps the factor — which is where W was actually 2x low before #294.
  it.each(ALL_FORMATIONS)('calcOurDmg(avg, incStance=true) carries the game\'s factor in formation %i', (f) => {
    ;(globalThis as any).game = gameWith(f)
    expect(calcOurDmg('avg', true, false)).toBe(160 * GAME_ATTACK_MULT[f])
  })

  it('W is not silently equal to X — the two paths would be indistinguishable if both were neutral', () => {
    // Guards the fixture itself: if every multiplier were 1, the tables above prove nothing.
    expect(GAME_ATTACK_MULT[2]).not.toBe(GAME_ATTACK_MULT[5])
    expect(GAME_HEALTH_MULT[1]).not.toBe(GAME_HEALTH_MULT[5])
    expect(GAME_BLOCK_MULT[3]).not.toBe(GAME_BLOCK_MULT[5])
    expect(GAME_BLOCK_MULT[1]).not.toBe(GAME_BLOCK_MULT[5]) // the arm calcOurBlock was missing
  })
})
