// @vitest-environment jsdom
//
// #80 — RcalcOurDmg applied three Daily MULTIPLIERS with `+=` / `-=`.
//
// `dailyModifiers.oddTrimpNerf.getMult()`, `.evenTrimpBuff.getMult()` and `.rampage.getMult()` all
// return MULTIPLIERS (0.2 … 3.0), and the game applies all three with `*=`
// (.trimps-game/main.js:12356-12358). RcalcOurDmg added / subtracted them instead, so on any realistic
// damage number the modifier vanished into rounding: a Daily that should cut damage to 20% instead
// left it at `dmg + 0.2`. AT's whole U2 map-tier / H:D decision stack ran on that number.
//
// ⚠️ WHY THIS FILE EXISTS. The L0 proof net is STRUCTURALLY BLIND to RcalcOurDmg (#98). It records only
// buyJob/buyBuilding/buyEquipment/buyUpgrade events (#90), and every corpus save decodes to HZE=3 /
// world=4 — U2 is unreachable, a Daily doubly so. MEASURED on this branch: with the fix applied,
// injecting `number *= 1000000` into RcalcOurDmg still passes the ENTIRE sim suite GREEN (15 files /
// 49 tests). So "the proof net stayed green" is a MEANINGLESS statement about this change. THIS FILE is
// the evidence. Pattern: tests/calc.damageTrio.test.ts.
//
// It drives the REAL path end to end — production's own `initializeAllSettings()` (settings-defs) →
// the REAL `createSetting` (settings-engine) → the REAL `getPageSetting` (utils) → the REAL
// `RcalcOurDmg` (calc). `getPageSetting` is NEVER mocked.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RcalcOurDmg } from '../src/modules/calc'
import { createSetting } from '../src/modules/settings-engine'
import { initializeAllSettings } from '../src/modules/settings-defs'
import { makeMinimalGame } from './harness/gameFixture'

const G = globalThis as any

// ════════════════════════════════════════════════════════════════════════════════════════════════
// THE GAME IS THE ORACLE — transcription net.
//
// Every number this file asserts is derived from these four formulas. If the pinned clone ever moves
// them, THIS BLOCK fails first and names the drift, rather than every damage assertion below failing
// with an inscrutable off-by-a-multiplier. It is the cheap form of the cross-source contract check:
// the game declares, in one place, exactly which Daily modifiers are multiplicative.
// ════════════════════════════════════════════════════════════════════════════════════════════════
// (jsdom's import.meta.url is not a file: URL — resolve from the repo root, as the sim harness does.)
const GAME_SRC = readFileSync(resolve(process.cwd(), '.trimps-game/main.js'), 'utf8')

describe('#80 oracle: the game source still says what these tests assume', () => {
  it('applies all three modifiers MULTIPLICATIVELY to Trimp baseAttack (main.js:12356-12358)', () => {
    expect(GAME_SRC).toContain("baseAttack *= applyDailyMultipliers('rampage', 1);")
    expect(GAME_SRC).toContain(
      "if (game.global.world % 2 === 1) baseAttack *= applyDailyMultipliers('oddTrimpNerf', 1);",
    )
    expect(GAME_SRC).toContain(
      "if (game.global.world % 2 === 0) baseAttack *= applyDailyMultipliers('evenTrimpBuff', 1);",
    )
  })

  it('the ABSENT case is the multiplicative identity 1, not 0 (main.js:12226 applyDailyMultipliers)', () => {
    // function applyDailyMultipliers(modifier, value = 1) { … if undefined return value; … }
    expect(GAME_SRC).toContain("if (typeof dailyChallenge[modifier] === 'undefined') return value;")
  })

  it('the getMult bodies are the ones transcribed into MULT below', () => {
    expect(GAME_SRC).toContain('return 1 - (str * 0.02);') // oddTrimpNerf  main.js:14633
    expect(GAME_SRC).toContain('return 1 + (str * 0.2);') //  evenTrimpBuff main.js:14646
    expect(GAME_SRC).toContain('var realStrength = Math.ceil(str / 10);') // rampage main.js:14785
    expect(GAME_SRC).toContain('return 1 + (0.01 * realStrength * stacks);') //        main.js:14786
  })
})

// The game's own getMult functions, transcribed verbatim from the bodies pinned above.
const MULT = {
  oddTrimpNerf: (str: number) => 1 - str * 0.02, //  str 15…40 → 0.70 … 0.20
  evenTrimpBuff: (str: number) => 1 + str * 0.2, //  str  1…10 → 1.20 … 3.00
  rampage: (str: number, stacks: number) => 1 + 0.01 * Math.ceil(str / 10) * stacks,
}

// ── The REAL settings pipeline (never mock getPageSetting) ──────────────────────────────────────
// RcalcOurDmg reads getPageSetting('Rcalcfrenzy') and getPageSetting('Rcalcmaxequality'); both are
// resolved from production's own 571-call catalog, not from a store this test fabricated.
const anyEl: any = new Proxy(function () {}, { get: () => anyEl, apply: () => anyEl, set: () => true })

function bootRealSettings(): void {
  G.autoTrimpSettings = {}
  G.ATversion = 'test'
  G.createSetting = createSetting
  G.modifyParentNode = () => {}
  G.settingsProfileMakeGUI = () => {}
  document.getElementById = (() => anyEl) as typeof document.getElementById
  initializeAllSettings()
}

// ── Combat seam: every multiplier in RcalcOurDmg pinned to identity ─────────────────────────────
function neutralU2(): void {
  G.calcHeirloomBonus = (_s: string, _t: string, base: number, output?: boolean) => (output ? 0 : base)
  G.getPlayerCritChance = () => 0
  G.getPlayerCritDamageMult = () => 1
  G.getMegaCritDamageMult = () => 1
  G.getPlayerDoubleCritChance = () => 0
  G.gammaBurstPct = 0
  G.Fluffy = {
    isRewardActive: () => 0,
    getDamageModifier: () => 1,
    rewardConfig: { SADailies: { attackMod: () => 1 } },
  }
  G.autoBattle = { oneTimers: { Burstier: { owned: false } }, bonuses: { Stats: { getMult: () => 1 } } }
  G.u2Mutations = {
    tree: {
      Attack: { purchased: false }, Brains: { purchased: false, getBonus: () => 1 },
      GeneAttack: { purchased: false },
    },
    types: { Nova: { trimpAttackMult: () => 1 } },
  }
  G.alchObj = { getPotionEffect: () => 1 }
  G.playerSpireTraps = { Strength: { owned: false, getWorldBonus: () => 0 } }
  G.sugarRush = { getAttackStrength: () => 1 }
  // The game's real formulas — the ONLY levers these tests pull.
  G.dailyModifiers = {
    oddTrimpNerf: { getMult: MULT.oddTrimpNerf },
    evenTrimpBuff: { getMult: MULT.evenTrimpBuff },
    rampage: { getMult: MULT.rampage },
  }
}

// 6 base (all six weapons locked) × 10 maxSoldiers = 60, and every other multiplier is identity, so
// RcalcOurDmg('avg') === 60 EXACTLY. Any deviation is attributable to the one Daily lever under test.
const BASE = 60

function u2Game(over: Record<string, unknown> = {}): Record<string, unknown> {
  return makeMinimalGame({
    global: {
      world: 100, universe: 2, challengeActive: '', achievementBonus: 0, mapBonus: 0, roboTrimpLevel: 0,
      totalSquaredReward: 0, sugarRush: 0, novaMutStacks: 0, dailyChallenge: {}, mapsActive: false,
    },
    equipment: {
      Dagger: { locked: 1 }, Mace: { locked: 1 }, Polearm: { locked: 1 }, Battleaxe: { locked: 1 },
      Greatsword: { locked: 1 }, Arbalest: { locked: 1 },
    },
    resources: { trimps: { maxSoldiers: 10 } },
    buildings: { Smithy: { owned: 0, getMult: () => 1 } },
    portal: {
      Power: { radLevel: 0, modifier: 0 }, Range: { radLevel: 0 }, Frenzy: { radLevel: 0 },
      Tenacity: { getMult: () => 1 }, Hunger: { getMult: () => 1 }, Observation: { getMult: () => 1 },
      Championism: { getMult: () => 1 },
      Equality: { radLevel: 0, scalingCount: 0, getMult: () => 1, getModifier: () => 1 },
    },
    goldenUpgrades: { Battle: { currentBonus: 0 } },
    talents: {
      mapBattery: { purchased: false }, herbalist: { purchased: false, getBonus: () => 1 },
      daily: { purchased: false },
    },
    challenges: {
      Mayhem: { getTrimpMult: () => 1 }, Pandemonium: { getTrimpMult: () => 1 },
      Desolation: { getTrimpMult: () => 1, trimpAttackMult: () => 1 },
      Melt: { stacks: 0 }, Unbalance: { getAttackMult: () => 1 }, Quagmire: { getExhaustMult: () => 1 },
      Revenge: { getMult: () => 1 }, Quest: { getAttackMult: () => 1 }, Archaeology: { getStatMult: () => 1 },
      Berserk: { getAttackMult: () => 1 }, Nurture: { boostsActive: () => false, getStatBoost: () => 1 },
      Smithless: { fakeSmithies: 0 },
    },
    singleRunBonuses: { sharpTrimps: { owned: false } },
    options: { menu: { darkTheme: { enabled: 1 } } }, // createSetting's select branch reads it
    ...over,
  })
}

// Convenience: a live Daily at `world`, with `dailyChallenge` as given.
function daily(dailyChallenge: Record<string, unknown>, world = 100, legsForDays = false): void {
  const base = u2Game()
  G.game = u2Game({
    global: { ...(base.global as object), challengeActive: 'Daily', world, dailyChallenge },
    talents: { ...(base.talents as object), daily: { purchased: legsForDays } },
  })
}

beforeEach(() => {
  neutralU2()
  G.game = u2Game() // must precede bootRealSettings: createSetting's select branch reads game.options
  bootRealSettings()
})

afterEach(() => {
  for (const k of [
    'game', 'autoTrimpSettings', 'ATversion', 'createSetting', 'modifyParentNode', 'settingsProfileMakeGUI',
    'calcHeirloomBonus', 'getPlayerCritChance', 'getPlayerCritDamageMult', 'getMegaCritDamageMult',
    'getPlayerDoubleCritChance', 'gammaBurstPct', 'Fluffy', 'autoBattle', 'u2Mutations', 'alchObj',
    'dailyModifiers', 'playerSpireTraps', 'sugarRush',
  ]) delete G[k]
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('#80 harness is live (anti-false-green)', () => {
  it('production’s createSetting catalog really ran', () => {
    expect(Object.keys(G.autoTrimpSettings).length).toBeGreaterThan(500)
  })

  it('the neutral U2 baseline is exactly 60 — every other multiplier is identity', () => {
    expect(RcalcOurDmg('avg', false, true)).toBe(BASE)
  })

  it('the transcribed formulas produce the strengths these tests use', () => {
    expect(MULT.oddTrimpNerf(40)).toBeCloseTo(0.2, 12) // the max nerf: 20% attack
    expect(MULT.oddTrimpNerf(15)).toBeCloseTo(0.7, 12) // the min nerf
    expect(MULT.evenTrimpBuff(5)).toBeCloseTo(2.0, 12) // ×2
    expect(MULT.evenTrimpBuff(10)).toBeCloseTo(3.0, 12) // the max buff: ×3
    expect(MULT.rampage(35, 25)).toBeCloseTo(2.0, 12) // ceil(35/10)=4 → 1 + 0.01×4×25
    expect(MULT.rampage(35, 0)).toBe(1) // zero stacks ⇒ multiplicative identity
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// THE MONEY SHOT — a RATIO, not a delta. The `+=` code passes any "did the number move?" test
// (it moves by 0.2). It fails these by 5×.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('oddTrimpNerf — MULTIPLIES attack on ODD zones (main.js:12357)', () => {
  it('str 40 on an odd zone ⇒ ×0.2 ⇒ 12 (the `+=` bug returned 60.2)', () => {
    daily({ oddTrimpNerf: { strength: 40 } }, 101)
    expect(RcalcOurDmg('avg', false, true)).toBeCloseTo(12, 10) // 60 × 0.2
  })

  it('str 15 on an odd zone ⇒ ×0.7 ⇒ 42', () => {
    daily({ oddTrimpNerf: { strength: 15 } }, 101)
    expect(RcalcOurDmg('avg', false, true)).toBeCloseTo(42, 10) // 60 × 0.7
  })

  it('the ratio to the un-modified run IS getMult(str), for every legal strength', () => {
    for (let str = 15; str <= 40; str++) {
      daily({}, 101)
      const without = RcalcOurDmg('avg', false, true)!
      daily({ oddTrimpNerf: { strength: str } }, 101)
      const withMod = RcalcOurDmg('avg', false, true)!
      expect(withMod / without).toBeCloseTo(MULT.oddTrimpNerf(str), 10)
    }
  })

  it('does NOT apply on an even zone', () => {
    daily({ oddTrimpNerf: { strength: 40 } }, 100)
    expect(RcalcOurDmg('avg', false, true)).toBe(BASE)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('evenTrimpBuff — MULTIPLIES attack on EVEN zones (main.js:12358)', () => {
  it('str 5 on an even zone ⇒ ×2 ⇒ 120 (the `-=` bug returned 58)', () => {
    daily({ evenTrimpBuff: { strength: 5 } }, 100)
    expect(RcalcOurDmg('avg', false, true)).toBeCloseTo(120, 10) // 60 × 2.0
  })

  it('str 10 (the cap) on an even zone ⇒ ×3 ⇒ 180', () => {
    daily({ evenTrimpBuff: { strength: 10 } }, 100)
    expect(RcalcOurDmg('avg', false, true)).toBeCloseTo(180, 10) // 60 × 3.0
  })

  it('the ratio to the un-modified run IS getMult(str), for every legal strength', () => {
    for (let str = 1; str <= 10; str++) {
      daily({}, 100)
      const without = RcalcOurDmg('avg', false, true)!
      daily({ evenTrimpBuff: { strength: str } }, 100)
      const withMod = RcalcOurDmg('avg', false, true)!
      expect(withMod / without).toBeCloseTo(MULT.evenTrimpBuff(str), 10)
    }
  })

  it('does NOT apply on an odd zone', () => {
    daily({ evenTrimpBuff: { strength: 5 } }, 101)
    expect(RcalcOurDmg('avg', false, true)).toBe(BASE)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('rampage — MULTIPLIES attack on EVERY zone (main.js:12356)', () => {
  it('str 35 / 25 stacks ⇒ ×2 ⇒ 120 (the `-=` bug returned 58)', () => {
    daily({ rampage: { strength: 35, stacks: 25 } }, 100)
    expect(RcalcOurDmg('avg', false, true)).toBeCloseTo(120, 10) // 60 × (1 + 0.01×4×25)
  })

  it('ZERO stacks ⇒ the multiplicative identity ⇒ 60 (the `-=` bug returned 59)', () => {
    // The sharpest statement of the operator bug: getMult returns 1 — a no-op — and the old code
    // still moved the damage, because it SUBTRACTED that 1.
    daily({ rampage: { strength: 35, stacks: 0 } }, 100)
    expect(RcalcOurDmg('avg', false, true)).toBe(BASE)
  })

  it('applies on odd zones too (it is not parity-gated)', () => {
    daily({ rampage: { strength: 35, stacks: 25 } }, 101)
    expect(RcalcOurDmg('avg', false, true)).toBeCloseTo(120, 10)
  })

  it('the ratio to the un-modified run IS getMult(str, stacks)', () => {
    for (const [str, stacks] of [[10, 10], [20, 30], [35, 25], [40, 5]] as const) {
      daily({}, 100)
      const without = RcalcOurDmg('avg', false, true)!
      daily({ rampage: { strength: str, stacks } }, 100)
      const withMod = RcalcOurDmg('avg', false, true)!
      expect(withMod / without).toBeCloseTo(MULT.rampage(str, stacks), 10)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// The ABSENT case must be the multiplicative identity 1, not 0. `*= 0` would zero the damage — and
// maps.ts:958 short-circuits ALL map automation on `RcalcOurDmg("avg", …) <= 0`.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('absent modifiers ⇒ identity, not annihilation', () => {
  it('a Daily with NONE of the three rolled ⇒ 60, not 0', () => {
    daily({}, 101)
    expect(RcalcOurDmg('avg', false, true)).toBe(BASE)
  })

  it('an odd zone with only evenTrimpBuff rolled ⇒ 60 (its arm is skipped, not zeroed)', () => {
    daily({ evenTrimpBuff: { strength: 5 } }, 101)
    expect(RcalcOurDmg('avg', false, true)).toBe(BASE)
  })

  it('outside a Daily the whole block is inert, even with modifiers present in dailyChallenge', () => {
    const base = u2Game()
    G.game = u2Game({
      global: {
        ...(base.global as object), challengeActive: '', world: 101,
        dailyChallenge: { oddTrimpNerf: { strength: 40 }, rampage: { strength: 35, stacks: 25 } },
      },
    })
    expect(RcalcOurDmg('avg', false, true)).toBe(BASE)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('composition — the three stack multiplicatively with each other and with Legs for Days', () => {
  it('rampage ×2 AND oddTrimpNerf ×0.2 on an odd zone ⇒ 60 × 2 × 0.2 = 24', () => {
    daily({ oddTrimpNerf: { strength: 40 }, rampage: { strength: 35, stacks: 25 } }, 101)
    expect(RcalcOurDmg('avg', false, true)).toBeCloseTo(24, 10)
  })

  it('rampage ×2 AND evenTrimpBuff ×2 on an even zone ⇒ 60 × 2 × 2 = 240', () => {
    daily({ evenTrimpBuff: { strength: 5 }, rampage: { strength: 35, stacks: 25 } }, 100)
    expect(RcalcOurDmg('avg', false, true)).toBeCloseTo(240, 10)
  })

  it('Legs for Days (×1.5) composes with the nerf ⇒ 60 × 1.5 × 0.2 = 18', () => {
    daily({ oddTrimpNerf: { strength: 40 } }, 101, true)
    expect(RcalcOurDmg('avg', false, true)).toBeCloseTo(18, 10)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// SCALE INVARIANCE — the property the `+=` code could never have.
//
// This is what made the bug so damaging: the modifier is a RATIO, so its effect must be independent of
// the magnitude of the damage. Under `+=`, a ±0.2 / ±2.0 delta vanishes into a 6e10 damage number, so
// the modifier degraded into an exact no-op precisely where the stakes were highest.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('the modifier is scale-invariant (the `+=` bug was worst at realistic damage)', () => {
  it('at 6e10 base damage the nerf still cuts to exactly 20%', () => {
    const base = u2Game()
    G.game = u2Game({
      global: {
        ...(base.global as object), challengeActive: 'Daily', world: 101,
        dailyChallenge: { oddTrimpNerf: { strength: 40 } },
      },
      resources: { trimps: { maxSoldiers: 1e10 } }, // 6 × 1e10 = 6e10 un-modified
    })
    expect(RcalcOurDmg('avg', false, true)).toBeCloseTo(1.2e10, 0) // 6e10 × 0.2
    // The old code computed 6e10 + 0.2 === 6e10 (the delta is below float resolution): the Daily was a
    // literal no-op, and AT believed it hit 5× harder than it did on every odd zone.
  })
})
