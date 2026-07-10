// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  addPoison,
  calcOurDmg,
  highDamageShield,
  calcDailyAttackMod,
  badGuyChallengeMult,
  calcEnemyAttackCore,
  calcSpecificEnemyAttack,
  calcSpire,
  calcBadGuyDmg,
  calcEnemyHealth,
  calcEnemyHealthCore,
  calcSpecificEnemyHealth,
  calcHDratio,
  calcCurrentStance,
  getTotalHealthMod,
  stormdynamicHD,
  desodynamicHD,
  rMutationAttack,
  rCalcMutationAttack,
  rCalcMutationHealth,
  RgetCritMulti,
  RcalcOurDmg,
  RcalcOurHealth,
  RcalcDailyAttackMod,
  RcalcDailyHealthMod,
  RcalcBadGuyDmg,
  RcalcEnemyHealth,
  RcalcEnemyHealthMod,
  RcalcHDratio,
} from '../src/modules/calc'
import { makeMinimalGame } from './harness/gameFixture'

// Phase-2 proof-net (#51) characterization net for calc.ts — the depth (L1) layer pinning the
// combat-prediction math BEFORE the idiomatic un-minify + var→const/let + ==→=== modernization.
// Complements the pre-existing tests/calc.test.ts (calcOurBlock / calcOurHealth / calcCorruptionScale
// / badGuyCritMult / getCritMulti / calcEnemyBaseHealth / calcEnemyBaseAttack / RcalcEnemyBaseHealth)
// and tests/calc.getTrimpAttack.test.ts, both left untouched. Here we pin the ~31 functions those two
// files leave uncovered, with edge fixtures on every balance-sensitive branch a ==→=== conversion
// touches (challenge arms, universe, formation, crit tiers, gamma-burst owned flag, world thresholds).
// These golden masters lock current behaviour so any transcription/conversion slip fails loudly.

// ── Shared free-identifier stubs ────────────────────────────────────────────────────────────────
// calc.ts reads a large ambient combat seam (challengeActive/getEmpowerment/Fluffy/autoBattle/
// u2Mutations/dailyModifiers/alchObj/playerSpireTraps/sugarRush/mutations/calcHeirloomBonus/…).
// `neutralCombat()` seeds them all to identity (×1 / false / 0) so a golden asserts the *base*
// passes through; individual tests override the one lever they exercise.
const G = globalThis as any

function neutralCombat(over: Record<string, unknown> = {}): void {
  G.challengeActive = () => false
  G.getEmpowerment = () => ''
  G.getRetainModifier = () => 1
  // calcHeirloomBonus has two conventions: the 4-arg (output=true) form returns a bonus PERCENTAGE
  // (neutral 0); the 3-arg form returns the value multiplied by the bonus (neutral = base unchanged).
  G.calcHeirloomBonus = (_s: string, _t: string, base: number, output?: boolean) => (output ? 0 : base)
  G.getPlayerCritChance = () => 0
  G.getPlayerCritDamageMult = () => 1
  G.getMegaCritDamageMult = () => 1
  G.getPlayerDoubleCritChance = () => 0
  // calc.ts calls the IMPORTED getPageSetting (utils.ts), which reads globalThis.autoTrimpSettings.
  // An empty store → getPageSetting returns false for every key. Tests override individual settings.
  G.autoTrimpSettings = {}
  G.getBadCoordLevel = () => 1
  G.getScientistLevel = () => 0
  G.getCurrentEnemy = () => ({ name: 'Snimp', corrupted: '', attack: 1, health: 1 })
  G.getCurrentMapObject = () => ({ location: 'map', level: 1, difficulty: 1 })
  G.getCurrentMapCell = () => ({ level: 1 })
  G.getCurrentWorldCell = () => ({ level: 50 })
  G.getEnemyMaxAttack = () => 1
  G.RgetEnemyMaxAttack = () => 1
  G.getCorruptedCellsNum = () => 0
  G.getCorruptScale = () => 1
  G.isActiveSpireAT = () => false
  G.disActiveSpireAT = () => false
  G.checkIfLiquidZone = () => false
  G.getEnergyShieldMult = () => 0
  G.gammaBurstPct = 0
  G.trimpAA = 1
  G.critCC = 1
  G.critDD = 1
  G.mutations = {
    Magma: { active: () => false, getTrimpDecay: () => 1, start: () => 1 },
    Corruption: { active: () => false },
    Healthy: { active: () => false, cellCount: () => 0 },
  }
  G.Fluffy = {
    isActive: () => false,
    isRewardActive: () => 0,
    getDamageModifier: () => 1,
    rewardConfig: { SADailies: { attackMod: () => 1 }, scaledHealth: { mult: () => 1 } },
  }
  G.autoBattle = {
    oneTimers: { Burstier: { owned: false } },
    bonuses: { Stats: { getMult: () => 1 } },
  }
  G.u2Mutations = {
    tree: {
      Attack: { purchased: false }, Brains: { purchased: false, getBonus: () => 1 },
      GeneAttack: { purchased: false }, Health: { purchased: false }, GeneHealth: { purchased: false },
      Unrage: { purchased: false },
    },
    types: {
      Compression: { attack: () => 0, health: () => 0, cellCount: () => 1 },
      Nova: { trimpAttackMult: () => 1 },
    },
  }
  G.dailyModifiers = {}
  G.alchObj = { getPotionEffect: () => 1, getEnemyStats: () => 0 }
  G.playerSpireTraps = { Strength: { owned: false, getWorldBonus: () => 0 } }
  G.sugarRush = { getAttackStrength: () => 1 }
  Object.assign(G, over)
}

afterEach(() => {
  for (const k of [
    'game', 'challengeActive', 'getEmpowerment', 'getRetainModifier', 'calcHeirloomBonus',
    'getPlayerCritChance', 'getPlayerCritDamageMult', 'getMegaCritDamageMult', 'getPlayerDoubleCritChance',
    'getPageSetting', 'getBadCoordLevel', 'getScientistLevel', 'getCurrentEnemy', 'getCurrentMapObject',
    'getCurrentMapCell', 'getCurrentWorldCell', 'getEnemyMaxAttack', 'RgetEnemyMaxAttack',
    'getCorruptedCellsNum', 'getCorruptScale', 'isActiveSpireAT', 'disActiveSpireAT', 'checkIfLiquidZone',
    'getEnergyShieldMult', 'gammaBurstPct', 'trimpAA', 'critCC', 'critDD', 'mutations', 'Fluffy',
    'autoBattle', 'u2Mutations', 'dailyModifiers', 'alchObj', 'playerSpireTraps', 'sugarRush',
    'autoTrimpSettings', 'baseMinDamage', 'baseMaxDamage', 'baseDamage', 'baseHealth', 'baseBlock',
    'getPlayerCritChance',
  ]) delete G[k]
})

// A `game` skeleton wide enough for the U1 offense/health composers (calcOurDmg / calcOurHealth deps).
function u1CombatGame(over: Record<string, unknown> = {}): Record<string, unknown> {
  return makeMinimalGame({
    global: {
      world: 100, formation: 0, challengeActive: '', antiStacks: 0, mapBonus: 0, achievementBonus: 0,
      roboTrimpLevel: 0, voidBuff: '', totalSquaredReward: 0, sugarRush: 0, spireRows: 0, uberNature: '',
      dailyChallenge: {}, radioStacks: 0, lastLowGen: 0, mapsActive: false, spireActive: false,
    },
    equipment: {
      Dagger: { locked: 1 }, Mace: { locked: 1 }, Polearm: { locked: 1 }, Battleaxe: { locked: 1 },
      Greatsword: { locked: 1 }, Arbalest: { locked: 1 },
      Shield: { locked: 1, blockNow: false, level: 0, blockCalculated: 0 }, Boots: { locked: 1 },
      Helmet: { locked: 1 }, Pants: { locked: 1 }, Shoulderguards: { locked: 1 }, Breastplate: { locked: 1 },
      Gambeson: { locked: 1 },
    },
    resources: { trimps: { maxSoldiers: 10 } },
    portal: {
      Power: { level: 0, modifier: 0 }, Power_II: { level: 0, modifier: 0 },
      Anticipation: { level: 0, modifier: 0 }, Range: { level: 0 },
      Toughness: { level: 0, modifier: 0 }, Toughness_II: { level: 0, modifier: 0 }, Resilience: { level: 0, modifier: 0 },
    },
    jobs: {
      Amalgamator: { owned: 0, getDamageMult: () => 1, getHealthMult: () => 1 }, Magmamancer: { getBonusPercent: () => 1 },
      Geneticist: { owned: 0 },
    },
    challenges: {
      Electricity: { stacks: 0 }, Decay: { stacks: 0 }, Lead: { stacks: 0 },
      Frigid: { getTrimpMult: () => 1, getEnemyMult: () => 1 }, Mayhem: { getTrimpMult: () => 1 },
      Pandemonium: { getTrimpMult: () => 1 }, Desolation: { getTrimpMult: () => 1 },
      Life: { getHealthMult: () => 1 }, Balance: { getHealthMult: () => 1 },
    },
    goldenUpgrades: { Battle: { currentBonus: 0 } },
    talents: {
      mapBattery: { purchased: false }, voidPower: { purchased: false }, voidPower2: { purchased: false },
      voidPower3: { purchased: false }, magmamancer: { purchased: false }, stillRowing2: { purchased: false },
      voidMastery: { purchased: false }, healthStrength: { purchased: false }, herbalist: { purchased: false, getBonus: () => 1 },
      scry: { purchased: false }, daily: { purchased: false },
    },
    empowerments: {
      Ice: { getDamageModifier: () => 0, getCombatModifier: () => 1 },
      Poison: { getModifier: () => 0, getDamage: () => 0 },
    },
    stats: { totalVoidMaps: { value: 0 } },
    singleRunBonuses: { sharpTrimps: { owned: false } },
    ...over,
  })
}

// ══ Family A — offense/defense misc ═════════════════════════════════════════════════════════════

describe('calc.addPoison', () => {
  beforeEach(() => neutralCombat())
  it('returns 0 when the active empowerment is not Poison', () => {
    G.game = makeMinimalGame({ global: { world: 100 } })
    expect(addPoison()).toBe(0)
  })
  it('returns the raw poison damage when realDamage=true', () => {
    G.getEmpowerment = () => 'Poison'
    G.game = makeMinimalGame({ global: { world: 100 }, empowerments: { Poison: { getDamage: () => 42 } } })
    expect(addPoison(true)).toBe(42)
  })
  it('returns damage × retain modifier when the addpoison setting is on', () => {
    G.getEmpowerment = () => 'Poison'
    G.autoTrimpSettings = { addpoison: { type: 'boolean', enabled: true } }
    G.getRetainModifier = () => 0.5
    G.game = makeMinimalGame({ global: { world: 100 }, empowerments: { Poison: { getDamage: () => 40 } } })
    expect(addPoison(false)).toBe(20)
  })
})

describe('calc.calcOurDmg — offense composer', () => {
  beforeEach(() => neutralCombat())
  it('avg = base attack (all multipliers neutral, no flucts, incStance)', () => {
    // getTrimpAttack: base 6, no equipment (all locked), ×10 soldiers = 60. getCritMulti → 1 (crit 0).
    G.game = u1CombatGame()
    expect(calcOurDmg('avg', true, false)).toBe(60)
  })
  it('min = avg × 0.8 and max = avg × 1.2 (crit-multi split, no flucts)', () => {
    G.game = u1CombatGame()
    expect(calcOurDmg('min', true, false)).toBeCloseTo(48, 9)
    expect(calcOurDmg('max', true, false)).toBeCloseTo(72, 9)
  })
  it('Electricity stacks apply the (1 - stacks×0.1) attack debuff', () => {
    G.game = u1CombatGame({ challenges: {
      Electricity: { stacks: 3 }, Decay: { stacks: 0 }, Lead: { stacks: 0 },
      Frigid: { getTrimpMult: () => 1 }, Mayhem: { getTrimpMult: () => 1 },
      Pandemonium: { getTrimpMult: () => 1 }, Desolation: { getTrimpMult: () => 1 }, Life: { getHealthMult: () => 1 },
    } })
    expect(calcOurDmg('avg', true, false)).toBeCloseTo(42, 9) // 60 × (1 - 0.3)
  })
  it('getTrimpAttack formation==2 arm bakes ×4 when incStance keeps it (no calcOurDmg ÷4 cancel)', () => {
    G.game = u1CombatGame({ global: { world: 100, formation: 2, challengeActive: '', antiStacks: 0, mapBonus: 0,
      achievementBonus: 0, roboTrimpLevel: 0, voidBuff: '', totalSquaredReward: 0, sugarRush: 0, spireRows: 0,
      uberNature: '', dailyChallenge: {}, radioStacks: 0, mapsActive: false, spireActive: false } })
    // getTrimpAttack: 6 base ×10 soldiers = 60, formation==2 → ×4 = 240. incStance=true → calcOurDmg skips its
    // own ÷4, so the formation arm is observable. (With incStance=false the ×4 and ÷4 cancel back to 60.)
    expect(calcOurDmg('avg', true, false)).toBe(240)
    expect(calcOurDmg('avg', false, false)).toBe(60) // cancel case, pins the calcOurDmg formation==2 ÷4 branch
  })
})

describe('calc.highDamageShield', () => {
  beforeEach(() => neutralCombat())
  it('sets critCC/critDD/trimpAA when the equipped shield matches the highdmg setting (non-daily)', () => {
    G.autoTrimpSettings = { highdmg: { type: 'textValue', value: 'Fury' } }
    G.getPlayerCritChance = () => 3
    G.getPlayerCritDamageMult = () => 9
    G.calcHeirloomBonus = () => 50 // 4-arg trimpAttack → 50; /100 → 0.5
    G.game = makeMinimalGame({ global: { challengeActive: '', ShieldEquipped: { name: 'Fury' } } })
    highDamageShield()
    expect(G.critCC).toBe(3)
    expect(G.critDD).toBe(9)
    expect(G.trimpAA).toBe(0.5)
  })
  it('leaves globals untouched when the shield name does not match', () => {
    G.autoTrimpSettings = { highdmg: { type: 'textValue', value: 'Fury' } }
    G.critCC = 1; G.critDD = 1; G.trimpAA = 1
    G.game = makeMinimalGame({ global: { challengeActive: '', ShieldEquipped: { name: 'Other' } } })
    highDamageShield()
    expect(G.critCC).toBe(1)
  })
})

// ══ Family B — enemy attack ═════════════════════════════════════════════════════════════════════

describe('calc.calcDailyAttackMod', () => {
  beforeEach(() => neutralCombat())
  it('passes the number through unchanged outside a Daily challenge', () => {
    G.game = makeMinimalGame({ global: { challengeActive: '', mapsActive: false, dailyChallenge: {} } })
    expect(calcDailyAttackMod(100)).toBe(100)
  })
  it('applies badStrength daily mod inside Daily', () => {
    G.dailyModifiers = { badStrength: { getMult: () => 2 }, badMapStrength: { getMult: () => 1 }, bloodthirst: { getMult: () => 1 } }
    G.game = makeMinimalGame({ global: { challengeActive: 'Daily', mapsActive: false, dailyChallenge: { badStrength: { strength: 1 } } } })
    expect(calcDailyAttackMod(100)).toBe(200)
  })
})

describe('calc.badGuyChallengeMult — challenge arm selector', () => {
  beforeEach(() => neutralCombat())
  function g(challengeActive: string, over: Record<string, unknown> = {}) {
    G.game = makeMinimalGame({ global: { challengeActive, world: 100 }, challenges: {}, ...over })
  }
  it('returns 1 with no challenge active', () => { g(''); expect(badGuyChallengeMult()).toBe(1) })
  it('Meditate → ×1.5', () => { G.challengeActive = (n: string) => n === 'Meditate'; g(''); expect(badGuyChallengeMult()).toBe(1.5) })
  it('Watch → ×1.25', () => { G.challengeActive = (n: string) => n === 'Watch'; g(''); expect(badGuyChallengeMult()).toBe(1.25) })
  it('Corrupted → ×3', () => { g('Corrupted'); expect(badGuyChallengeMult()).toBe(3) })
  it('Domination → ×2.5', () => { g('Domination'); expect(badGuyChallengeMult()).toBe(2.5) })
  it('Coordinate → ×getBadCoordLevel()', () => { G.getBadCoordLevel = () => 8; g('Coordinate'); expect(badGuyChallengeMult()).toBe(8) })
  it('Scientist L5 → ×10', () => { G.getScientistLevel = () => 5; g('Scientist'); expect(badGuyChallengeMult()).toBe(10) })
  it('Eradicated → oblitMult (scaleModifier × zoneScaling^zoneModifier)', () => {
    g('Eradicated', { challenges: { Eradicated: { scaleModifier: 2, zoneScaleFreq: 50, zoneScaling: 10 } } })
    // zoneModifier floor(100/50)=2 → 2 × 10^2 = 200
    expect(badGuyChallengeMult()).toBe(200)
  })
})

describe('calc.calcEnemyAttackCore — enemy attack core', () => {
  beforeEach(() => neutralCombat())
  function g(over: Record<string, unknown> = {}) {
    G.game = makeMinimalGame({
      global: { mapsActive: false, spireActive: false, world: 50, challengeActive: '', dailyChallenge: {} },
      badGuys: { Snimp: { attack: 1 } }, challenges: {},
      ...over,
    })
  }
  it('max = 1.2 × base, min = 0.8 × base (world type, custom attack passthrough)', () => {
    g()
    const max = calcEnemyAttackCore('world', 50, 50, 'Snimp', false, 1000)
    const min = calcEnemyAttackCore('world', 50, 50, 'Snimp', true, 1000)
    expect(max).toBeCloseTo(1200, 6)
    expect(min).toBeCloseTo(800, 6)
  })
  it('Corrupted challenge multiplies attack ×3', () => {
    g({ global: { mapsActive: false, spireActive: false, world: 50, challengeActive: 'Corrupted', dailyChallenge: {} } })
    const withC = calcEnemyAttackCore('world', 50, 50, 'Snimp', false, 1000)
    expect(withC).toBeCloseTo(3600, 6) // 1.2 × 1000 × 3
  })
  it('Coordinate multiplies by the ceil(×1.25) accumulation over zones', () => {
    g({ global: { mapsActive: false, spireActive: false, world: 4, challengeActive: 'Coordinate', dailyChallenge: {} } })
    // amt over i=1..3: 1→2→3→4 (ceil(1×1.25)=2, ceil(2×1.25)=3, ceil(3×1.25)=4)
    const v = calcEnemyAttackCore('world', 4, 50, 'Snimp', false, 100)
    expect(v).toBeCloseTo(1.2 * 100 * 4, 6)
  })
})

describe('calc.calcSpecificEnemyAttack', () => {
  beforeEach(() => neutralCombat())
  it('returns 1 when there is no current enemy', () => {
    G.getCurrentEnemy = () => undefined
    G.game = makeMinimalGame({ global: { mapsActive: false } })
    expect(calcSpecificEnemyAttack()).toBe(1)
  })
})

describe('calc.calcSpire', () => {
  beforeEach(() => neutralCombat())
  it('U1 attack: base × mod^exitCell × badGuys.attack', () => {
    G.game = makeMinimalGame({
      global: {
        challengeActive: '', universe: 1, world: 100, spireLevel: 0,
        getEnemyAttack: () => 100, gridArray: [{ name: 'Snimp' }],
      },
      badGuys: { Snimp: { attack: 2 } },
    })
    // exitCell 0 → mod^0 = 1 → base 100 × 1 × badGuys.attack 2 = 200
    expect(calcSpire(0, 'Snimp', 'attack')).toBe(200)
  })
  it('U2 attack: base × 200^(spireLevel+1)', () => {
    G.game = makeMinimalGame({
      global: {
        challengeActive: '', universe: 2, world: 300, spireLevel: 1,
        getEnemyAttack: () => 5, gridArray: [{ name: 'Snimp' }],
      },
      badGuys: { Snimp: { attack: 1 } },
    })
    // cell 0 !== 99 → enemy = name 'Snimp'; base = getEnemyAttack=5 → ×200^2 = 200000
    expect(calcSpire(0, 'Snimp', 'attack')).toBe(200000)
  })
})

describe('calc.calcBadGuyDmg', () => {
  beforeEach(() => neutralCombat())
  it('passes attack through with default flucts → min = floor(attack × 0.8)', () => {
    G.game = makeMinimalGame({ global: { challengeActive: '', usingShriek: false } })
    expect(calcBadGuyDmg(null, 1000, false, false, false)).toBe(800)
  })
  it('max = ceil(attack + attack × 0.2)', () => {
    G.game = makeMinimalGame({ global: { challengeActive: '', usingShriek: false } })
    expect(calcBadGuyDmg(null, 1000, false, true, false)).toBe(1200)
  })
  it('disableFlucts returns the raw number', () => {
    G.game = makeMinimalGame({ global: { challengeActive: '', usingShriek: false } })
    expect(calcBadGuyDmg(null, 1000, false, false, true)).toBe(1000)
  })
  it('Domination at boss cell 98 → ×2.5', () => {
    G.game = makeMinimalGame({ global: { challengeActive: 'Domination', lastClearedCell: 98, usingShriek: false } })
    expect(calcBadGuyDmg(null, 1000, false, false, true)).toBe(2500)
  })
  it('Domination off-boss → ×0.1', () => {
    G.game = makeMinimalGame({ global: { challengeActive: 'Domination', lastClearedCell: 50, usingShriek: false } })
    expect(calcBadGuyDmg(null, 1000, false, false, true)).toBeCloseTo(100, 6)
  })
})

// ══ Family C — enemy health ═════════════════════════════════════════════════════════════════════

describe('calc.calcEnemyHealth — U1 enemy health composer', () => {
  beforeEach(() => neutralCombat())
  function g(over: Record<string, unknown> = {}) {
    G.game = makeMinimalGame({
      global: { world: 50, challengeActive: '', universe: 1, mapsActive: false, spireActive: false, lastClearedCell: 0 },
      badGuys: { Snimp: { health: 1 } }, challenges: { Lead: { stacks: 0 }, Frigid: { getEnemyMult: () => 1 } },
      ...over,
    })
  }
  it('map=true in U1 halves the base health', () => {
    g()
    const world = calcEnemyHealth(50, false)
    const map = calcEnemyHealth(50, true)
    expect(map).toBeCloseTo(world * 0.5, 3)
  })
  it('Toxicity doubles health', () => {
    G.challengeActive = (n: string) => n === 'Toxicity'
    g()
    const base = (() => { G.challengeActive = () => false; const b = calcEnemyHealth(50, false); G.challengeActive = (n: string) => n === 'Toxicity'; return b })()
    expect(calcEnemyHealth(50, false)).toBeCloseTo(base * 2, 3)
  })
})

describe('calc.calcEnemyHealthCore', () => {
  beforeEach(() => neutralCombat())
  function g(over: Record<string, unknown> = {}) {
    G.game = makeMinimalGame({
      global: { world: 50, mapsActive: false, spireActive: false, challengeActive: '', dailyChallenge: {} },
      badGuys: { Turtlimp: { health: 1 }, Snimp: { health: 1 } }, challenges: { Frigid: { getEnemyMult: () => 1 } },
      ...over,
    })
  }
  it('custom health passthrough (world type, no challenge) → returns customHealth', () => {
    g()
    expect(calcEnemyHealthCore('world', 50, 50, 'Snimp', 500)).toBe(500)
  })
  it('Life challenge → ×11', () => {
    g({ global: { world: 50, mapsActive: false, spireActive: false, challengeActive: 'Life', dailyChallenge: {} } })
    expect(calcEnemyHealthCore('world', 50, 50, 'Snimp', 500)).toBe(5500)
  })
})

describe('calc.calcSpecificEnemyHealth', () => {
  beforeEach(() => neutralCombat())
  it('returns -1 when the target cell has no enemy', () => {
    G.game = makeMinimalGame({ global: { mapsActive: false, world: 50, gridArray: [], challengeActive: '' } })
    expect(calcSpecificEnemyHealth('world', 50, 1)).toBe(-1)
  })
})

// ══ Family D — HD/stance/misc ═══════════════════════════════════════════════════════════════════

describe('calc.calcHDratio', () => {
  beforeEach(() => neutralCombat())
  it('ratio = calcEnemyHealth() / ourBaseDamage (no shield-swap branch)', () => {
    G.game = u1CombatGame({
      global: { world: 50, formation: 0, challengeActive: '', antiStacks: 0, mapBonus: 0, achievementBonus: 0,
        roboTrimpLevel: 0, voidBuff: '', totalSquaredReward: 0, sugarRush: 0, spireRows: 0, uberNature: '',
        dailyChallenge: {}, radioStacks: 0, mapsActive: false, spireActive: false, universe: 1, lastClearedCell: 0,
        ShieldEquipped: { name: '' } },
      badGuys: { Snimp: { health: 1 } },
    })
    G.game.challenges.Lead = { stacks: 0 }
    G.game.challenges.Frigid = { getTrimpMult: () => 1, getEnemyMult: () => 1 }
    const ratio = calcHDratio()
    // ourBaseDamage = calcOurDmg('avg',false,true): base 60, formation 0 (no penalty) = 60
    const ourDmg = calcOurDmg('avg', false, true)!
    const enemyHealth = calcEnemyHealth()
    expect(ratio).toBeCloseTo(enemyHealth / ourDmg, 6)
  })
})

describe('calc.calcCurrentStance', () => {
  beforeEach(() => neutralCombat())
  it('returns a defined stance value on a plain non-Wind world (heirloom-switch branch)', () => {
    G.game = u1CombatGame({
      global: { world: 50, formation: 0, challengeActive: '', antiStacks: 0, mapBonus: 0, achievementBonus: 0,
        roboTrimpLevel: 0, voidBuff: '', totalSquaredReward: 0, sugarRush: 0, spireRows: 0, uberNature: '',
        dailyChallenge: {}, radioStacks: 0, mapsActive: false, spireActive: false, fighting: false,
        ShieldEquipped: { name: '' } },
    })
    G.getEmpowerment = () => ''
    // uberNature !== Wind → else branch; ehealth default 1; usehigh true (getEmpowerment != Wind) → returns 12
    expect(calcCurrentStance()).toBe(12)
  })
})

// calc.calcBaseDamageInX test removed in Phase 3 (#51): calc's copy was dead (stance's wins at
// global scope) and has been deleted from calc.ts. The live copy is pinned by
// tests/stance.characterization.test.ts ('stance.calcBaseDamageInX (capital I) — the 5-field setter').

describe('calc.getTotalHealthMod', () => {
  beforeEach(() => neutralCombat())
  it('returns 1 when every multiplier is neutral', () => {
    G.game = makeMinimalGame({
      global: { challengeActive: '', totalSquaredReward: 0, dailyChallenge: {} },
      buildings: { Smithy: { getMult: () => 1 } },
      portal: { Toughness: { radLevel: 0, modifier: 0 }, Resilience: { modifier: 0, radLevel: 0 },
        Observation: { getMult: () => 1 }, Championism: { getMult: () => 1 } },
      goldenUpgrades: { Battle: { currentBonus: 0 } },
      challenges: {
        Revenge: { getMult: () => 1 }, Wither: { getTrimpHealthMult: () => 1 }, Insanity: { getHealthMult: () => 1 },
        Berserk: { frenzyStacks: 0, getHealthMult: () => 1 }, Nurture: { boostsActive: () => false, getStatBoost: () => 1 },
        Mayhem: { getTrimpMult: () => 1 }, Pandemonium: { getTrimpMult: () => 1 }, Desolation: { getTrimpMult: () => 1, trimpHealthMult: () => 1 },
      },
    })
    expect(getTotalHealthMod()).toBe(1)
  })
})

describe('calc.stormdynamicHD / desodynamicHD', () => {
  beforeEach(() => neutralCombat())
  it('stormdynamicHD returns 1 when the Storm setting is off (empty settings store)', () => {
    G.game = makeMinimalGame({ global: { world: 100, challengeActive: '' } })
    expect(stormdynamicHD()).toBe(1)
  })
  it('desodynamicHD returns 1 when the Deso setting is off (empty settings store)', () => {
    G.game = makeMinimalGame({ global: { world: 100, challengeActive: '' } })
    expect(desodynamicHD()).toBe(1)
  })
})

// ══ Family E — U2 radon R-mirrors ═══════════════════════════════════════════════════════════════
// A `game` skeleton wide enough for the U2 offense/health composers (RcalcOurDmg / RcalcOurHealth).
function u2CombatGame(over: Record<string, unknown> = {}): Record<string, unknown> {
  return makeMinimalGame({
    global: {
      world: 100, universe: 2, challengeActive: '', achievementBonus: 0, mapBonus: 0, roboTrimpLevel: 0,
      totalSquaredReward: 0, sugarRush: 0, novaMutStacks: 0, mayhemCompletions: 0, pandCompletions: 0,
      desoCompletions: 0, dailyChallenge: {}, mapsActive: false,
    },
    equipment: {
      Dagger: { locked: 1 }, Mace: { locked: 1 }, Polearm: { locked: 1 }, Battleaxe: { locked: 1 },
      Greatsword: { locked: 1 }, Arbalest: { locked: 1 },
      Shield: { locked: 1 }, Boots: { locked: 1 }, Helmet: { locked: 1 }, Pants: { locked: 1 },
      Shoulderguards: { locked: 1 }, Breastplate: { locked: 1 }, Gambeson: { locked: 1 },
    },
    resources: { trimps: { maxSoldiers: 10 } },
    buildings: { Smithy: { owned: 0, getMult: () => 1 }, Antenna: { owned: 0 }, Laboratory: { owned: 0, getEnemyMult: () => 1 } },
    jobs: { Meteorologist: { getExtraMult: () => 1 } },
    portal: {
      Power: { radLevel: 0, modifier: 0 }, Range: { radLevel: 0 }, Frenzy: { radLevel: 0 },
      Tenacity: { getMult: () => 1 }, Hunger: { getMult: () => 1 }, Observation: { radLevel: 0, getMult: () => 1 },
      Championism: { radLevel: 0, getMult: () => 1 }, Toughness: { radLevel: 0, modifier: 0 }, Resilience: { radLevel: 0, modifier: 0 },
      Equality: { radLevel: 0, scalingCount: 0, modifier: 1, getMult: () => 1, getModifier: () => 1 },
    },
    goldenUpgrades: { Battle: { currentBonus: 0 } },
    talents: {
      mapBattery: { purchased: false }, herbalist: { purchased: false, getBonus: () => 1 }, daily: { purchased: false },
    },
    challenges: {
      Mayhem: { getTrimpMult: () => 1, getEnemyMult: () => 1, getBossMult: () => 1 },
      Pandemonium: { getTrimpMult: () => 1, getEnemyMult: () => 1, getBossMult: () => 1 },
      Desolation: { getTrimpMult: () => 1, getEnemyMult: () => 1, trimpAttackMult: () => 1, trimpHealthMult: () => 1 },
      Melt: { stacks: 0 }, Unbalance: { getAttackMult: () => 1 }, Quagmire: { getExhaustMult: () => 1 },
      Revenge: { stacks: 0, getMult: () => 1 }, Quest: { getAttackMult: () => 1, getHealthMult: () => 1 },
      Archaeology: { getStatMult: () => 1 }, Berserk: { getAttackMult: () => 1, frenzyStacks: 0, getHealthMult: () => 1 },
      Nurture: { boostsActive: () => false, getStatBoost: () => 1 }, Smithless: { fakeSmithies: 0 },
      Wither: { trimpStacks: 0, getTrimpHealthMult: () => 1, enemyStacks: 0, getEnemyAttackMult: () => 1 },
      Insanity: { getHealthMult: () => 1 }, Storm: { getAttackMult: () => 1, getHealthMult: () => 1 },
      Exterminate: { getSwarmMult: () => 1 }, Hypothermia: { getEnemyMult: () => 1 }, Glass: { attackMult: () => 1, healthMult: () => 1 },
      Mayhem2: {}, Frigid: { getEnemyMult: () => 1 },
    },
    singleRunBonuses: { sharpTrimps: { owned: false } },
    badGuys: { Snimp: { health: 1 } },
    ...over,
  })
}

describe('calc.RgetCritMulti', () => {
  beforeEach(() => neutralCombat())
  it('returns CritD when crit chance is 0 (no crit tiers)', () => {
    G.getPlayerCritChance = () => 0
    G.getPlayerCritDamageMult = () => 1
    G.game = makeMinimalGame({})
    // ((1-0)*mega(0) + 0*mega(0)) * doubleFactor(1) * CritD(1) = 1
    expect(RgetCritMulti()).toBe(1)
  })
  it('blends low/high tiers at fractional crit chance', () => {
    G.getPlayerCritChance = () => 1.5
    G.getPlayerCritDamageMult = () => 2
    G.getMegaCritDamageMult = (t: number) => t // identity
    G.game = makeMinimalGame({})
    // (0.5*mega(1) + 0.5*mega(2)) * 1 * 2 = (0.5 + 1) * 2 = 3
    expect(RgetCritMulti()).toBe(3)
  })
})

describe('calc.RcalcOurDmg — U2 offense composer', () => {
  beforeEach(() => neutralCombat())
  it('avg = base attack with every multiplier neutral', () => {
    G.game = u2CombatGame()
    // 6 base ×10 soldiers = 60, all mults ×1, RgetCritMulti 1
    expect(RcalcOurDmg('avg', false)).toBe(60)
  })
  it('min = avg × (Range.radLevel×0.02 + 0.8), max = avg × 1.2', () => {
    G.game = u2CombatGame()
    expect(RcalcOurDmg('min', false)).toBeCloseTo(48, 9) // 60 × 0.8
    expect(RcalcOurDmg('max', false)).toBeCloseTo(72, 9) // 60 × 1.2
  })
  it('Melt challenge applies 5 × 0.99^stacks', () => {
    G.game = u2CombatGame({ global: { world: 100, universe: 2, challengeActive: 'Melt', achievementBonus: 0, mapBonus: 0,
      roboTrimpLevel: 0, totalSquaredReward: 0, sugarRush: 0, novaMutStacks: 0, dailyChallenge: {}, mapsActive: false } })
    G.game.challenges.Melt = { stacks: 10 }
    // 60 × 5 × 0.99^10
    expect(RcalcOurDmg('avg', false)).toBeCloseTo(60 * 5 * Math.pow(0.99, 10), 6)
  })
})

describe('calc.RcalcOurHealth — U2 health composer', () => {
  beforeEach(() => neutralCombat())
  it('base 50 × soldiers with every multiplier neutral', () => {
    G.game = u2CombatGame()
    expect(RcalcOurHealth()).toBe(500)
  })
  it('u2Mutations Health tree adds ×1.5', () => {
    neutralCombat()
    G.u2Mutations.tree.Health.purchased = true
    G.game = u2CombatGame()
    expect(RcalcOurHealth()).toBe(750)
  })
})

describe('calc.RcalcDailyAttackMod / RcalcDailyHealthMod', () => {
  beforeEach(() => neutralCombat())
  it('both pass through unchanged outside a Daily challenge', () => {
    G.game = makeMinimalGame({ global: { challengeActive: '', mapsActive: false, dailyChallenge: {} } })
    expect(RcalcDailyAttackMod(100)).toBe(100)
    expect(RcalcDailyHealthMod(100)).toBe(100)
  })
  it('RcalcDailyHealthMod applies badHealth inside Daily', () => {
    G.dailyModifiers = { badHealth: { getMult: () => 2 }, empower: { getMult: () => 1 } }
    G.game = makeMinimalGame({ global: { challengeActive: 'Daily', dailyChallenge: { badHealth: { strength: 1 } } } })
    expect(RcalcDailyHealthMod(100)).toBe(200)
  })
})

describe('calc.RcalcBadGuyDmg', () => {
  beforeEach(() => neutralCombat())
  it('passes the attack through with no challenge / no equality', () => {
    G.game = u2CombatGame({ global: { world: 100, universe: 2, challengeActive: '', mapsActive: false, usingShriek: false, dailyChallenge: {} } })
    expect(RcalcBadGuyDmg(null, 1000, false)).toBe(1000)
  })
  it('Unbalance challenge multiplies enemy attack ×1.5', () => {
    G.game = u2CombatGame({ global: { world: 100, universe: 2, challengeActive: 'Unbalance', mapsActive: false, usingShriek: false, dailyChallenge: {} } })
    expect(RcalcBadGuyDmg(null, 1000, false)).toBe(1500)
  })
})

describe('calc.RcalcEnemyHealth / RcalcEnemyHealthMod', () => {
  beforeEach(() => neutralCombat())
  it('RcalcEnemyHealth == RcalcEnemyBaseHealth(world,50,Snimp) with no challenge', () => {
    G.game = u2CombatGame({ global: { world: 30, universe: 1, challengeActive: '', mapsActive: false, dailyChallenge: {} } })
    // universe 1 base at world 30, level 50 — matches the value pinned in calc.test.ts
    expect(RcalcEnemyHealth(30)).toBe(15870854667)
  })
  it('Unbalance doubles health', () => {
    G.game = u2CombatGame({ global: { world: 30, universe: 1, challengeActive: 'Unbalance', mapsActive: false, dailyChallenge: {} } })
    expect(RcalcEnemyHealth(30)).toBe(15870854667 * 2)
  })
  it('RcalcEnemyHealthMod computes base at an explicit cell/name', () => {
    G.game = u2CombatGame({ global: { world: 30, universe: 1, challengeActive: '', mapsActive: false, dailyChallenge: {} } })
    expect(RcalcEnemyHealthMod(30, 50, 'Snimp')).toBe(15870854667)
  })
})

describe('calc.rMutationAttack / rMutationHealth', () => {
  beforeEach(() => neutralCombat())
  it('rMutationAttack: no compression/no NVA-NVX, world 201 → baseAttack × 1.01^0', () => {
    G.RgetEnemyMaxAttack = () => 100
    G.game = makeMinimalGame({ global: { world: 201 } })
    const cell = { cs: false, cc: false, u2Mutation: 'RGE', level: 50, name: 'Snimp' }
    expect(rMutationAttack(cell)).toBeCloseTo(100, 6)
  })
  it('rMutationAttack: NVX multiplies base ×10', () => {
    G.RgetEnemyMaxAttack = () => 100
    G.game = makeMinimalGame({ global: { world: 201 } })
    const cell = { cs: false, cc: false, u2Mutation: 'NVX', level: 50, name: 'Snimp' }
    expect(rMutationAttack(cell)).toBeCloseTo(1000, 6)
  })
})

describe('calc.rCalcMutationAttack / rCalcMutationHealth', () => {
  beforeEach(() => neutralCombat())
  it('rCalcMutationAttack returns undefined when no grid cell carries a mutation', () => {
    G.game = makeMinimalGame({ global: { world: 201, gridArray: [{ u2Mutation: '' }, { u2Mutation: '' }] } })
    expect(rCalcMutationAttack()).toBeUndefined()
  })
  it('rCalcMutationHealth returns undefined when no grid cell carries a mutation', () => {
    G.game = makeMinimalGame({ global: { world: 201, gridArray: [{ u2Mutation: '' }] } })
    expect(rCalcMutationHealth()).toBeUndefined()
  })
})

describe('calc.RcalcHDratio', () => {
  beforeEach(() => neutralCombat())
  it('ratio = RcalcEnemyHealth(world) / RcalcOurDmg(avg)', () => {
    G.game = u2CombatGame({ global: { world: 30, universe: 1, challengeActive: '', achievementBonus: 0, mapBonus: 0,
      roboTrimpLevel: 0, totalSquaredReward: 0, sugarRush: 0, novaMutStacks: 0, mayhemCompletions: 0, pandCompletions: 0,
      desoCompletions: 0, dailyChallenge: {}, mapsActive: false } })
    const ratio = RcalcHDratio()
    const ourDmg = RcalcOurDmg('avg', false, true)
    const enemyHealth = RcalcEnemyHealth(G.game.global.world)!
    expect(ratio).toBeCloseTo(enemyHealth / ourDmg, 6)
  })
})
