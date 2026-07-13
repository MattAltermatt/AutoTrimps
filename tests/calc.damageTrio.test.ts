// @vitest-environment jsdom
//
// #69 ship D — the damage trio (`45stacks` / `fullice` / `addpoison`).
//
// These three booleans were `createSetting`'d with the STRING 'false'. A string is truthy, and JS `==`
// never coerces it, so `'false' == true` and `'false' == false` are BOTH false. Every one of their
// readers in calcOurDmg is an `== true` / `== false` equality test, so BOTH arms were dead and the
// Anticipation and Ice multipliers were silently dropped from calcOurDmg entirely — AT underestimated
// its own damage, which feeds every downstream H:D / stance / map-vs-world decision.
//
// ⚠️ WHY THIS FILE EXISTS. The L0 proof net is STRUCTURALLY BLIND to this code path: it records only
// buyJob/buyBuilding/buyEquipment/buyUpgrade events (#90), and the 4-save corpus never reaches
// `antiStacks > 0` or an Ice empowerment. Measured: with the fix applied, injecting a 1,000,000×
// multiplier into the restored Anticipation arm still passes the ENTIRE sim suite GREEN. So a green
// proof net is NOT evidence that this change is safe. This file IS the evidence.
//
// It drives the REAL path end to end — production's own `initializeAllSettings()` (settings-defs) →
// the REAL `createSetting` (settings-engine) → the REAL `getPageSetting` (utils) → the REAL
// `calcOurDmg` (calc). `getPageSetting` is NEVER mocked. That is what makes it an anti-false-green
// net: re-quoting a default in settings-defs.ts flips the stored `enabled` back to the string 'false'
// (the ship-A coercion is gated on `typeof defaultValue === 'boolean'`, so it stays inert), both
// equality arms go dead again, and these tests go RED.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { addPoison, calcOurDmg } from '../src/modules/calc'
import { createSetting } from '../src/modules/settings-engine'
import { initializeAllSettings } from '../src/modules/settings-defs'
import { makeMinimalGame } from './harness/gameFixture'

const G = globalThis as any

// ── The REAL settings pipeline ──────────────────────────────────────────────────────────────────
// initializeAllSettings() is production's 571-call catalog. Running it (rather than hand-calling
// createSetting with a default this test chose) is the whole point: the DEFAULT UNDER TEST IS THE ONE
// IN settings-defs.ts. Harness per tests/settings-inventory.test.ts — a self-returning callable Proxy
// from getElementById absorbs the interleaved layout strays; the created control DIVs are real jsdom
// nodes so renderControlFace works unmodified.
const anyEl: any = new Proxy(function () {}, { get: () => anyEl, apply: () => anyEl, set: () => true })

function bootRealSettings(): void {
  G.autoTrimpSettings = {}
  G.ATversion = 'test' // createSetting stamps it into the store on every call
  G.createSetting = createSetting // defs.ts calls it as a bridge free identifier
  G.modifyParentNode = () => {}
  G.settingsProfileMakeGUI = () => {}
  document.getElementById = (() => anyEl) as typeof document.getElementById
  initializeAllSettings()
}

// The value settingChanged() writes on a click is `!enabled` — a REAL boolean. So flipping `.enabled`
// directly is exactly the production write, not a fabricated record.
function setToggle(id: string, value: boolean): void {
  G.autoTrimpSettings[id].enabled = value
}

// The bug, reconstructed. This is what createSetting stored while the declaration read `'false'`:
// a raw string, which the ship-A coercion deliberately leaves alone (it is gated on
// `typeof defaultValue === 'boolean'`). Used only by the before/after test.
function reQuote(id: string): void {
  G.autoTrimpSettings[id].enabled = 'false'
}

// ── Combat seam ─────────────────────────────────────────────────────────────────────────────────
function neutralCombat(): void {
  G.challengeActive = () => false
  G.getEmpowerment = () => ''
  G.getRetainModifier = () => 1
  G.calcHeirloomBonus = (_s: string, _t: string, base: number, output?: boolean) => (output ? 0 : base)
  G.getPlayerCritChance = () => 0
  G.getPlayerCritDamageMult = () => 1
  G.getMegaCritDamageMult = () => 1
  G.getPlayerDoubleCritChance = () => 0
  G.gammaBurstPct = 0
  G.mutations = {
    Magma: { active: () => false, getTrimpDecay: () => 1 },
    Corruption: { active: () => false },
    Healthy: { active: () => false, cellCount: () => 0 },
  }
  G.Fluffy = { isActive: () => false, isRewardActive: () => 0, getDamageModifier: () => 1 }
  G.autoBattle = { oneTimers: { Burstier: { owned: false } } }
  G.dailyModifiers = {}
  G.playerSpireTraps = { Strength: { owned: false, getWorldBonus: () => 0 } }
  G.sugarRush = { getAttackStrength: () => 1 }
}

// All six weapons locked + maxSoldiers 10 + no Power perk + formation 0 ⇒ getTrimpAttack() === 60.
// Every other multiplier in calcOurDmg is seeded to identity, so calcOurDmg('avg') === 60 exactly,
// and any deviation from 60 is attributable to the one lever a given test pulls.
const BASE = 60

function combatGame(over: Record<string, unknown> = {}): Record<string, unknown> {
  return makeMinimalGame({
    global: {
      world: 100, formation: 0, challengeActive: '', antiStacks: 0, mapBonus: 0, achievementBonus: 0,
      roboTrimpLevel: 0, voidBuff: '', totalSquaredReward: 0, sugarRush: 0, spireRows: 0, uberNature: '',
      dailyChallenge: {}, radioStacks: 0, mapsActive: false,
    },
    equipment: {
      Dagger: { locked: 1 }, Mace: { locked: 1 }, Polearm: { locked: 1 }, Battleaxe: { locked: 1 },
      Greatsword: { locked: 1 }, Arbalest: { locked: 1 },
    },
    resources: { trimps: { maxSoldiers: 10 } },
    portal: {
      Power: { level: 0, modifier: 0 }, Power_II: { level: 0, modifier: 0 },
      Anticipation: { level: 0, modifier: 0 }, Range: { level: 0 },
    },
    jobs: { Amalgamator: { owned: 0, getDamageMult: () => 1 }, Magmamancer: { getBonusPercent: () => 1 } },
    challenges: {
      Electricity: { stacks: 0 }, Decay: { stacks: 0 },
      Frigid: { getTrimpMult: () => 1 }, Mayhem: { getTrimpMult: () => 1 },
      Pandemonium: { getTrimpMult: () => 1 }, Desolation: { getTrimpMult: () => 1 },
      Life: { getHealthMult: () => 1 },
    },
    goldenUpgrades: { Battle: { currentBonus: 0 } },
    talents: {
      mapBattery: { purchased: false }, voidPower: { purchased: false }, voidPower2: { purchased: false },
      voidPower3: { purchased: false }, magmamancer: { purchased: false }, stillRowing2: { purchased: false },
      voidMastery: { purchased: false }, healthStrength: { purchased: false },
      herbalist: { purchased: false, getBonus: () => 1 }, scry: { purchased: false }, daily: { purchased: false },
    },
    empowerments: {
      Ice: { getDamageModifier: () => 0 },
      Poison: { getModifier: () => 0, getDamage: () => 0 },
    },
    stats: { totalVoidMaps: { value: 0 } },
    singleRunBonuses: { sharpTrimps: { owned: false } },
    options: { menu: { darkTheme: { enabled: 1 } } }, // createSetting's select branch reads it
    ...over,
  })
}

beforeEach(() => {
  neutralCombat()
  G.game = combatGame() // must precede bootRealSettings: createSetting's select branch reads game.options
  bootRealSettings()
})

afterEach(() => {
  for (const k of [
    'game', 'autoTrimpSettings', 'ATversion', 'createSetting', 'modifyParentNode', 'settingsProfileMakeGUI',
    'challengeActive', 'getEmpowerment', 'getRetainModifier', 'calcHeirloomBonus', 'getPlayerCritChance',
    'getPlayerCritDamageMult', 'getMegaCritDamageMult', 'getPlayerDoubleCritChance', 'gammaBurstPct',
    'mutations', 'Fluffy', 'autoBattle', 'dailyModifiers', 'playerSpireTraps', 'sugarRush',
  ]) delete G[k]
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// The defaults, as production actually stores them. If any of these three go back to a string
// literal in settings-defs.ts, THIS block fails first and names the setting.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('the damage trio is stored as a REAL boolean (anti-false-green)', () => {
  it('the harness really ran production’s createSetting catalog', () => {
    // Tripwire: if initializeAllSettings silently no-op'd, every assertion below would be vacuous.
    expect(Object.keys(G.autoTrimpSettings).length).toBeGreaterThan(500)
  })

  for (const id of ['45stacks', 'fullice', 'addpoison']) {
    it(`${id}: getPageSetting returns the boolean false, not the string 'false'`, () => {
      const stored = G.autoTrimpSettings[id].enabled
      expect(typeof stored).toBe('boolean')
      expect(stored).toBe(false)
      // The load-bearing consequence: the `== false` arm is REACHABLE again.
      // eslint-disable-next-line eqeqeq -- the point: `==` against a string default matches NEITHER arm
      expect(stored == false).toBe(true)
      // eslint-disable-next-line eqeqeq
      expect(stored == true).toBe(false)
    })
  }
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// THE MONEY SHOT — the bug, stated as a test.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('#69 before/after: the Anticipation multiplier is no longer dropped', () => {
  // Anticipation ⇒ ×((antiStacks × level × modifier) + 1) = ((5 × 10 × 0.1) + 1) = ×6.
  // Mirrors the game's own formula at .trimps-game/main.js:12277
  //   anticipation: () => game.global.antiStacks * getPerkLevel('Anticipation') * modifier + 1
  // and getTrimpAttack() (calc.ts:51-74) contains no Anticipation term, so there is no double-count.
  beforeEach(() => {
    G.game = combatGame({
      global: { ...(combatGame().global as object), antiStacks: 5 },
      portal: { ...(combatGame().portal as object), Anticipation: { level: 10, modifier: 0.1 } },
    })
  })

  it('BEFORE (string default): both == arms dead ⇒ the multiplier is dropped entirely', () => {
    reQuote('45stacks')
    expect(calcOurDmg('avg')).toBe(BASE) // 60 — Anticipation contributes NOTHING
  })

  it('AFTER (boolean default): the == false arm runs ⇒ ×6', () => {
    expect(calcOurDmg('avg')).toBe(360) // 60 × 6
  })

  it('the fix strictly INCREASES AT’s estimate of its own damage', () => {
    const after = calcOurDmg('avg')!
    reQuote('45stacks')
    const before = calcOurDmg('avg')!
    expect(after).toBeGreaterThan(before)
    expect(after / before).toBe(6) // exactly the Anticipation multiplier that was being lost
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('45stacks — Antistack Calc', () => {
  const anticipating = () =>
    combatGame({
      global: { ...(combatGame().global as object), antiStacks: 5 },
      portal: { ...(combatGame().portal as object), Anticipation: { level: 10, modifier: 0.1 } },
    })

  it('default (false) + antiStacks > 0 ⇒ scales by the LIVE stack count', () => {
    G.game = anticipating()
    expect(calcOurDmg('avg')).toBe(360) // 60 × ((5 × 10 × 0.1) + 1)
  })

  it('true ⇒ assumes a FULL 45 stacks (the windstacking arm)', () => {
    G.game = anticipating()
    setToggle('45stacks', true)
    expect(calcOurDmg('avg')).toBe(2760) // 60 × ((45 × 10 × 0.1) + 1)
  })

  it('antiStacks === 0 ⇒ neither arm applies, whatever the setting', () => {
    expect(calcOurDmg('avg')).toBe(BASE)
    setToggle('45stacks', true)
    expect(calcOurDmg('avg')).toBe(BASE)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('fullice — Ice Calc', () => {
  const icy = (mod: number) =>
    combatGame({ empowerments: { Ice: { getDamageModifier: () => mod }, Poison: { getModifier: () => 0, getDamage: () => 0 } } })

  it('default (false) + Ice ⇒ ×(getDamageModifier() + 1), the game’s own formula', () => {
    // .trimps-game/main.js:12287 — iceEmpowerment: () => 1 + game.empowerments.Ice.getDamageModifier()
    G.getEmpowerment = () => 'Ice'
    G.game = icy(1.4)
    expect(calcOurDmg('avg')).toBeCloseTo(144, 10) // 60 × 2.4
  })

  it('true + Ice ⇒ the flat consistent-level arm (×2)', () => {
    G.getEmpowerment = () => 'Ice'
    G.game = icy(1.4)
    setToggle('fullice', true)
    expect(calcOurDmg('avg')).toBe(120) // 60 × 2 — the enemy debuff is ignored
  })

  it('true + Ice + naturesWrath ⇒ ×3', () => {
    G.getEmpowerment = () => 'Ice'
    G.Fluffy.isRewardActive = (r: string) => (r === 'naturesWrath' ? 1 : 0)
    G.game = icy(1.4)
    setToggle('fullice', true)
    expect(calcOurDmg('avg')).toBe(180) // 60 × 3
  })

  it('non-Ice empowerment ⇒ no multiplier on either arm', () => {
    G.game = icy(1.4)
    expect(calcOurDmg('avg')).toBe(BASE)
    setToggle('fullice', true)
    expect(calcOurDmg('avg')).toBe(BASE)
  })

  it('BEFORE (string default): both arms dead ⇒ the Ice multiplier is dropped entirely', () => {
    G.getEmpowerment = () => 'Ice'
    G.game = icy(1.4)
    reQuote('fullice')
    expect(calcOurDmg('avg')).toBe(BASE)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('addpoison — Poison Calc', () => {
  const poisoned = () =>
    combatGame({ empowerments: { Ice: { getDamageModifier: () => 0 }, Poison: { getModifier: () => 0.5, getDamage: () => 40 } } })

  it('default (false) ⇒ no poison term in calcOurDmg', () => {
    G.getEmpowerment = () => 'Poison'
    G.game = poisoned()
    expect(calcOurDmg('avg')).toBe(BASE)
  })

  it('true ⇒ ×(1 + getModifier()) × 4', () => {
    G.getEmpowerment = () => 'Poison'
    G.game = poisoned()
    setToggle('addpoison', true)
    expect(calcOurDmg('avg')).toBe(360) // 60 × 1.5 × 4
  })

  // addPoison() (calc.ts:39) is the TRUTHY reader — the asymmetry that made this setting behave as
  // silently ON in one place and OFF in the other. With the string default it returned poison damage;
  // with the real boolean it correctly returns 0 until the user opts in.
  it('addPoison(): default (false) ⇒ 0; string default would have leaked damage', () => {
    G.getEmpowerment = () => 'Poison'
    G.getRetainModifier = () => 0.5
    G.game = poisoned()
    expect(addPoison()).toBe(0)
    reQuote('addpoison')
    expect(addPoison()).toBe(20) // the bug: truthy 'false' ⇒ 40 × 0.5 — ON without being asked
  })

  it('addPoison(): true ⇒ damage × retain modifier', () => {
    G.getEmpowerment = () => 'Poison'
    G.getRetainModifier = () => 0.5
    G.game = poisoned()
    setToggle('addpoison', true)
    expect(addPoison()).toBe(20)
  })
})
