// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  calcOurBlock,
  calcOurHealth,
  calcCorruptionScale,
  badGuyCritMult,
  getCritMulti,
  calcEnemyBaseHealth,
  calcEnemyBaseAttack,
  RcalcEnemyBaseHealth,
} from '../src/modules/calc'
import { makeMinimalGame } from './harness/gameFixture'

// Phase 1 · Wave 1 characterization net for calc.ts (issue #27), the crown-jewel prediction math.
// These golden masters pin the current faithful-port behaviour so the strict-TS conversion (types
// only — every function body is byte-identical) is provably behaviour-preserving. They span every
// combat-math family: our block/health, enemy attack/health (U1 + U2 radon), corruption scaling,
// and the crit multipliers — exactly where silent balance drift (the #24/#25 class) would hide.
// getTrimpAttack has its own golden master in calc.getTrimpAttack.test.ts (the Phase-0 spike).
//
// Transcendental enemy-scaling expectations were derived by an INDEPENDENT re-implementation of
// the legacy formula (not read back from the function), so they are a true oracle, not circular.
// The multiplier composers use clean integer fixtures that are hand-verifiable inline.

describe('calc.calcOurBlock — Layer-1 golden master (block composer)', () => {
  beforeEach(() => {
    ;(globalThis as any).calcHeirloomBonus = () => 0 // trimpBlock / trainerEfficiency → no-op
  })

  function fixture(over: Record<string, unknown> = {}) {
    return makeMinimalGame({
      buildings: { Gym: { owned: 2, increase: { by: 5 } } }, // gymStrength 10
      equipment: { Shield: { blockNow: false, level: 0, blockCalculated: 0 } },
      jobs: { Trainer: { owned: 0, modifier: 0 } },
      resources: { trimps: { maxSoldiers: 3 } },
      global: { formation: 0, radioStacks: 0 },
      ...over,
    })
  }

  it('gym block × soldiers, no stance', () => {
    ;(globalThis as any).game = fixture()
    // block 10 (gym) × 3 soldiers = 30
    expect(calcOurBlock(false)).toBe(30)
  })

  it('applies the ×4 barrier-formation multiplier when stance + formation 3', () => {
    ;(globalThis as any).game = fixture({ global: { formation: 3, radioStacks: 0 } })
    // 10 gym × 3 soldiers = 30, then formation-3 ×4 = 120
    expect(calcOurBlock(true)).toBe(120)
  })
})

describe('calc.calcOurHealth — Layer-1 golden master (health composer)', () => {
  beforeEach(() => {
    ;(globalThis as any).calcHeirloomBonus = () => 0
    ;(globalThis as any).challengeActive = () => false
    ;(globalThis as any).mutations = { Magma: { active: () => false } }
  })

  it('base 50 × soldiers with all multipliers neutral', () => {
    const one = () => 1
    ;(globalThis as any).game = makeMinimalGame({
      resources: { trimps: { maxSoldiers: 10 } },
      equipment: {
        Shield: { locked: 1 }, Boots: { locked: 1 }, Helmet: { locked: 1 }, Pants: { locked: 1 },
        Shoulderguards: { locked: 1 }, Breastplate: { locked: 1 }, Gambeson: { locked: 1 },
      },
      goldenUpgrades: { Battle: { currentBonus: 0 } },
      portal: { Toughness: { level: 0 }, Toughness_II: { level: 0 }, Resilience: { level: 0 } },
      challenges: {
        Frigid: { getTrimpMult: one }, Mayhem: { getTrimpMult: one },
        Pandemonium: { getTrimpMult: one }, Desolation: { getTrimpMult: one },
      },
      jobs: { Geneticist: { owned: 0 }, Amalgamator: { owned: 0 } },
      talents: { voidPower: { purchased: false } },
      global: {
        formation: 0, challengeActive: '', dailyChallenge: {}, radioStacks: 0,
        totalSquaredReward: 0, voidBuff: '', lastLowGen: 0,
      },
    })
    // 50 base × 10 soldiers, every conditional multiplier neutral → 500
    expect(calcOurHealth(false)).toBe(500)
  })
})

describe('calc.calcCorruptionScale — Layer-1 golden master', () => {
  beforeEach(() => {
    ;(globalThis as any).prettify = (n: number) => n // parseFloat(prettify(x)) → x
  })

  it('scales base by 1.05^floor((zone-150)/6) outside a corruption challenge', () => {
    ;(globalThis as any).game = makeMinimalGame({ global: { challengeActive: '' } })
    expect(calcCorruptionScale(150, 10)).toBe(10) // scales 0
    expect(calcCorruptionScale(156, 10)).toBeCloseTo(10.5, 10) // scales 1 → 10 × 1.05
  })

  it('uses startPoint 1 during a Corrupted challenge', () => {
    ;(globalThis as any).game = makeMinimalGame({ global: { challengeActive: 'Corrupted' } })
    expect(calcCorruptionScale(1, 10)).toBe(10) // (1-1)/6 → scales 0
  })
})

describe('calc.badGuyCritMult — Layer-1 golden master (crit branches)', () => {
  beforeEach(() => {
    // getPageSetting is imported from utils and reads autoTrimpSettings; empty store → false
    // (IgnoreCrits: false !== 2 and !== 1, same branch as 0).
    ;(globalThis as any).autoTrimpSettings = {}
  })

  function setup(over: Record<string, unknown> = {}) {
    ;(globalThis as any).game = makeMinimalGame({
      global: { challengeActive: '', voidBuff: '', dailyChallenge: {} },
      challenges: {},
      ...over,
    })
  }

  it('corruptCrit → ×5 at full crit power', () => {
    setup()
    expect(badGuyCritMult({ corrupted: 'corruptCrit' }, 2, 10, 100)).toBe(5)
  })

  it('healthyCrit → ×7', () => {
    setup()
    expect(badGuyCritMult({ corrupted: 'healthyCrit' }, 2, 10, 100)).toBe(7)
  })

  it('Crushed challenge with health above block → ×5 challenge mult', () => {
    setup({ global: { challengeActive: 'Crushed', voidBuff: '', dailyChallenge: {} } })
    // regular 1 (no corrupt) × challenge 5 (crushed, health 100 > block 10) = 5
    expect(badGuyCritMult({ corrupted: '' }, 2, 10, 100)).toBe(5)
  })
})

describe('calc.getCritMulti — Layer-1 golden master', () => {
  beforeEach(() => {
    ;(globalThis as any).autoTrimpSettings = {} // imported getPageSetting → false for all keys
    ;(globalThis as any).getPlayerCritDamageMult = () => 2
    ;(globalThis as any).getMegaCritDamageMult = (tier: number) => tier // identity
    ;(globalThis as any).getPlayerDoubleCritChance = () => 0
    ;(globalThis as any).game = makeMinimalGame({ global: { challengeActive: '' } })
  })

  it('integer crit chance → lowTier only × critDamage', () => {
    ;(globalThis as any).getPlayerCritChance = () => 1
    // ((1-0)*mega(1) + 0*mega(1)) * 1 * CritD(2) = 1 * 2 = 2
    expect(getCritMulti(false)).toBe(2)
  })

  it('fractional crit chance blends low/high tiers', () => {
    ;(globalThis as any).getPlayerCritChance = () => 1.5
    // (0.5*mega(1) + 0.5*mega(2)) * 1 * 2 = (0.5 + 1) * 2 = 3
    expect(getCritMulti(false)).toBe(3)
  })
})

// Enemy-scaling formulas — expectations from an independent re-derivation of the legacy math.
describe('calc.calcEnemyBaseHealth / calcEnemyBaseAttack — Layer-1 golden master (U1 scaling)', () => {
  beforeEach(() => {
    ;(globalThis as any).game = makeMinimalGame({
      badGuys: { Snimp: { health: 1, attack: 1 } },
      global: { mapsActive: false },
    })
  })

  it('base health at zone 5 (pre-planet branch)', () => {
    expect(calcEnemyBaseHealth(5, 50, 'Snimp')).toBeCloseTo(2395.3454337187586, 6)
  })

  it('base health at zone 60 (post-planet exponential branch)', () => {
    expect(calcEnemyBaseHealth(60, 50, 'Snimp')).toBeCloseTo(2.6010562269595694e18, -6)
  })

  it('base attack at zone 5 (floored)', () => {
    // signature is (type, zone, cell, name) — distinct from calcEnemyBaseHealth(zone, level, name)
    expect(calcEnemyBaseAttack('world', 5, 50, 'Snimp')).toBe(1326)
  })

  // zone 1/2 boundary arms (#51 net-depth follow-up — the zone===1 / zone===2 literal branches
  // the general suite skipped; guards a future edit to those exact early-game coefficients).
  it('base attack at zone 1 (zone===1 arm: ×0.35 then 0.2/0.75 split)', () => {
    expect(calcEnemyBaseAttack('world', 1, 50, 'Snimp')).toBe(16)
  })

  it('base attack at zone 2 (zone===2 arm: ×0.5 then 0.32/0.68 split)', () => {
    expect(calcEnemyBaseAttack('world', 2, 50, 'Snimp')).toBe(73)
  })
})

describe('calc.RcalcEnemyBaseHealth — Layer-1 golden master (U2 radon scaling)', () => {
  it('universe 1 base health at world 30', () => {
    ;(globalThis as any).game = makeMinimalGame({
      badGuys: { Snimp: { health: 1 } },
      global: { universe: 1, mapsActive: false },
    })
    expect(RcalcEnemyBaseHealth(30, 50, 'Snimp')).toBe(15870854667)
  })

  it('universe 2 base health at world 60 (radon hard-scaling)', () => {
    ;(globalThis as any).game = makeMinimalGame({
      badGuys: { Snimp: { health: 1 } },
      global: { universe: 2, mapsActive: false },
    })
    expect(RcalcEnemyBaseHealth(60, 50, 'Snimp')).toBeCloseTo(1.1718945345624699e33, -27)
  })
})
