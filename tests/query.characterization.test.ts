import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getEnemyMaxAttack,
  getEnemyMaxHealth,
  getCorruptScale,
  getCorruptedCellsNum,
  isBuildingInQueue,
  getScienceCostToUpgrade,
  getCurrentEnemy,
  getPerSecBeforeManual,
  checkJobPercentageCost,
  setScienceNeeded,
  RsetScienceNeeded,
  getPotencyMod,
  getArmyTime,
} from '../src/modules/query'

// Phase-2 characterization net for query.ts (proof-net #51). Pins the *behavior* of the minified
// pure-predicate fns before the idiomatic un-minify, so a transcription slip fails loudly.
// Scaling fns use ratio assertions (shared terms cancel, like query.z300) — robust to float error
// and independent of the code's exact constants; discrete fns assert exact structural results.

const rel = (a: number, b: number) => Math.abs(a / b - 1)

function setGame(g: Record<string, unknown>) {
  ;(globalThis as any).game = g
}

afterEach(() => {
  delete (globalThis as any).game
  delete (globalThis as any).mutations
})

describe('query getEnemyMaxAttack (U1, base 50)', () => {
  beforeEach(() => {
    setGame({ global: { mapsActive: false }, badGuys: { Snimp: { attack: 1 } } })
  })

  it('world>=60 tier scales by sqrt·3.27^(dw/2)·1.15^dw (level=100 saturates the linear term)', () => {
    const ratio = getEnemyMaxAttack(70, 100, 'Snimp') / getEnemyMaxAttack(65, 100, 'Snimp')
    const expected = Math.sqrt(70 / 65) * Math.pow(3.27, 2.5) * Math.pow(1.15, 5)
    expect(rel(ratio, expected)).toBeLessThan(1e-6)
  })

  it('world<60 tier scales by sqrt·3.27^(dw/2) (the 0.375/0.7 + 0.85 coeffs cancel in-tier)', () => {
    const ratio = getEnemyMaxAttack(50, 100, 'Snimp') / getEnemyMaxAttack(40, 100, 'Snimp')
    const expected = Math.sqrt(50 / 40) * Math.pow(3.27, 5)
    expect(rel(ratio, expected)).toBeLessThan(1e-6)
  })

  it('the 4th arg (difficulty) is a direct multiplier', () => {
    // large world → floor error negligible → ratio ≈ the multiplier
    const ratio = getEnemyMaxAttack(65, 100, 'Snimp', 3) / getEnemyMaxAttack(65, 100, 'Snimp')
    expect(rel(ratio, 3)).toBeLessThan(1e-6)
  })

  it('the 5th arg (corrupt) swaps badGuys.attack for getCorruptScale("attack")', () => {
    ;(globalThis as any).mutations = { Corruption: { statScale: (n: number) => n * 5 } }
    // corrupt path uses statScale(3); non-corrupt uses badGuys.attack (=1)
    const ratio =
      getEnemyMaxAttack(65, 100, 'Snimp', undefined, true) / getEnemyMaxAttack(65, 100, 'Snimp')
    expect(rel(ratio, 15)).toBeLessThan(1e-6) // statScale(3) = 15
  })

  it('world==1 and world==2 special arms produce finite positive floors', () => {
    expect(getEnemyMaxAttack(1, 100, 'Snimp')).toBeGreaterThan(0)
    expect(Number.isFinite(getEnemyMaxAttack(1, 100, 'Snimp'))).toBe(true)
    expect(getEnemyMaxAttack(2, 100, 'Snimp')).toBeGreaterThan(0)
  })
})

describe('query getEnemyMaxHealth (U1, base 130)', () => {
  beforeEach(() => {
    setGame({ global: { mapsActive: false }, badGuys: { Grimp: { health: 1 } } })
  })

  it('world>=60 tier scales by sqrt·3.265^(dw/2)·1.1^dw', () => {
    const ratio = getEnemyMaxHealth(70, 100) / getEnemyMaxHealth(65, 100)
    const expected = Math.sqrt(70 / 65) * Math.pow(3.265, 2.5) * Math.pow(1.1, 5)
    expect(rel(ratio, expected)).toBeLessThan(1e-6)
  })

  it('world<60 tier scales by sqrt·3.265^(dw/2)', () => {
    const ratio = getEnemyMaxHealth(50, 100) / getEnemyMaxHealth(40, 100)
    const expected = Math.sqrt(50 / 40) * Math.pow(3.265, 5)
    expect(rel(ratio, expected)).toBeLessThan(1e-6)
  })

  it('level defaults to 30 when falsy', () => {
    expect(getEnemyMaxHealth(65)).toBe(getEnemyMaxHealth(65, 30))
  })

  it('the 3rd arg (corrupt) swaps Grimp.health for getCorruptScale("health")', () => {
    ;(globalThis as any).mutations = { Corruption: { statScale: (n: number) => n * 2 } }
    const ratio = getEnemyMaxHealth(65, 100, true) / getEnemyMaxHealth(65, 100)
    expect(rel(ratio, 20)).toBeLessThan(1e-6) // statScale(10) = 20
  })

  it('world==2 && level<10 special arm produces a finite positive floor', () => {
    expect(getEnemyMaxHealth(2, 5)).toBeGreaterThan(0)
    expect(getEnemyMaxHealth(1, 100)).toBeGreaterThan(0)
  })
})

describe('query getCorruptScale', () => {
  beforeEach(() => {
    ;(globalThis as any).mutations = { Corruption: { statScale: (n: number) => n * 100 } }
  })
  it('maps attack→statScale(3), health→statScale(10), else undefined', () => {
    expect(getCorruptScale('attack')).toBe(300)
    expect(getCorruptScale('health')).toBe(1000)
    expect(getCorruptScale('other')).toBeUndefined()
  })
})

describe('query getCorruptedCellsNum', () => {
  it('counts Corruption cells in gridArray excluding the final cell', () => {
    setGame({
      global: {
        gridArray: [
          { mutation: 'Corruption' },
          { mutation: 'Healthy' },
          { mutation: 'Corruption' },
          { mutation: 'Corruption' }, // final cell — excluded by len-1 loop bound
        ],
      },
    })
    expect(getCorruptedCellsNum()).toBe(2)
  })
})

describe('query isBuildingInQueue', () => {
  it('substring-matches the buildingsQueue entries', () => {
    setGame({ global: { buildingsQueue: ['Hut.5', 'House.3'] } })
    expect(isBuildingInQueue('Hut')).toBe(true)
    expect(isBuildingInQueue('Mansion')).toBeUndefined()
  })
})

describe('query getScienceCostToUpgrade', () => {
  it('geometric cost floor(base·mult^done) for array-cost upgrades', () => {
    setGame({ upgrades: { Miner: { done: 3, cost: { resources: { science: [100, 2] } } } } })
    expect(getScienceCostToUpgrade('Miner')).toBe(800) // 100·2^3
  })
  it('scalar science cost returned as-is', () => {
    setGame({ upgrades: { Flat: { done: 5, cost: { resources: { science: 42 } } } } })
    expect(getScienceCostToUpgrade('Flat')).toBe(42)
  })
  it('no science cost → 0', () => {
    setGame({ upgrades: { Free: { done: 0, cost: { resources: {} } } } })
    expect(getScienceCostToUpgrade('Free')).toBe(0)
  })
})

describe('query getCurrentEnemy', () => {
  it('reads the world gridArray at lastClearedCell+offset when not in maps', () => {
    setGame({
      global: {
        mapsActive: false,
        preMapsActive: false,
        lastClearedCell: 1,
        gridArray: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }],
      },
    })
    expect(getCurrentEnemy()).toEqual({ name: 'c' }) // lastClearedCell(1)+1
    expect(getCurrentEnemy(2)).toEqual({ name: 'd' })
  })

  it('reads the map gridArray when mapsActive and not preMapsActive', () => {
    setGame({
      global: {
        mapsActive: true,
        preMapsActive: false,
        lastClearedMapCell: 0,
        gridArray: [{ name: 'wa' }, { name: 'wb' }],
        mapGridArray: [{ name: 'ma' }, { name: 'mb' }],
      },
    })
    expect(getCurrentEnemy()).toEqual({ name: 'mb' }) // lastClearedMapCell(0)+1
  })

  it('preMapsActive without mapsActive leaves the return value undefined', () => {
    // documented deliberate behavior (query.ts header + inline comment): the outer
    // (mapsActive||preMapsActive) guard is true but the inner (mapsActive && !preMapsActive)
    // guard is false, so b is never assigned. L0 does not cover this fn — this is its only net.
    setGame({
      global: {
        mapsActive: false,
        preMapsActive: true,
        lastClearedCell: 1,
        gridArray: [{ name: 'a' }, { name: 'b' }],
      },
    })
    expect(getCurrentEnemy()).toBeUndefined()
  })
})

describe('query getPerSecBeforeManual (per-branch multiplier arming)', () => {
  // base = owned·modifier = 10·2 = 20; every multiplier is asserted against this base.
  // calcHeirloomBonus is stubbed to identity so the terminal Staff-speed bonus doesn't perturb.
  const JOB = 'Farmer'
  function baseGame(over: Record<string, any> = {}) {
    const g: Record<string, any> = {
      global: { challengeActive: '', world: 2 },
      jobs: {
        Farmer: { increase: 'food', owned: 10, modifier: 2 },
        Magmamancer: { owned: 0, getBonusPercent: () => 1 },
      },
      portal: {
        Motivation: { level: 0, modifier: 0.1 },
        Motivation_II: { level: 0, modifier: 0.05 },
        Meditation: { level: 0, getBonusPercent: () => 0 },
      },
      challenges: {
        Toxicity: { lootMult: 2, stacks: 50 },
        Balance: { getGatherMult: () => 0.7 },
        Decay: { stacks: 10 },
      },
    }
    // shallow-ish merge for the fields tests override
    for (const k of Object.keys(over)) g[k] = { ...(g[k] || {}), ...over[k] }
    return g
  }

  beforeEach(() => {
    ;(globalThis as any).calcHeirloomBonus = (_t: string, _s: string, v: number) => v
    ;(globalThis as any).dailyModifiers = {
      dedication: { getMult: () => 1.3 },
      famine: { getMult: () => 1.2 },
    }
  })
  afterEach(() => {
    delete (globalThis as any).calcHeirloomBonus
    delete (globalThis as any).dailyModifiers
  })

  it('returns 0 for a custom-increase job', () => {
    const g = baseGame()
    g.jobs.Farmer.increase = 'custom'
    setGame(g)
    expect(getPerSecBeforeManual(JOB)).toBe(0)
  })

  it('returns 0 when the job is unowned', () => {
    const g = baseGame()
    g.jobs.Farmer.owned = 0
    setGame(g)
    expect(getPerSecBeforeManual(JOB)).toBe(0)
  })

  it('base output is owned·modifier with no bonuses', () => {
    setGame(baseGame())
    expect(getPerSecBeforeManual(JOB)).toBe(20)
  })

  it('Motivation adds level·modifier of the base', () => {
    setGame(baseGame({ portal: { Motivation: { level: 1, modifier: 0.1 } } }))
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(22, 6) // 20 + 20·1·0.1
  })

  it('Motivation_II multiplies by 1+level·modifier', () => {
    setGame(baseGame({ portal: { Motivation_II: { level: 1, modifier: 0.05 } } }))
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(21, 6) // 20·1.05
  })

  it('Meditation multiplies by the .toFixed(2)-coerced bonus (string-coercion quirk preserved)', () => {
    setGame(baseGame({ portal: { Meditation: { level: 1, getBonusPercent: () => 50 } } }))
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(30, 6) // 20·(1+0.01·50).toFixed(2)=1.50
  })

  it('Magmamancer bonus applies only to metal jobs', () => {
    const g = baseGame()
    g.jobs.Farmer.increase = 'metal'
    g.jobs.Magmamancer = { owned: 1, getBonusPercent: () => 3 }
    setGame(g)
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(60, 6) // 20·3
  })

  it('Meditate challenge multiplies by 1.25', () => {
    setGame(baseGame({ global: { challengeActive: 'Meditate' } }))
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(25, 6)
  })

  it('Size challenge multiplies by 1.5', () => {
    setGame(baseGame({ global: { challengeActive: 'Size' } }))
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(30, 6)
  })

  it('Toxicity multiplies by 1 + lootMult·stacks/100', () => {
    setGame(baseGame({ global: { challengeActive: 'Toxicity' } }))
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(40, 6) // 20·(1 + 2·50/100)=20·2
  })

  it('Balance multiplies by getGatherMult()', () => {
    setGame(baseGame({ global: { challengeActive: 'Balance' } }))
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(14, 6) // 20·0.7
  })

  it('Decay multiplies by 10·0.995^stacks', () => {
    setGame(baseGame({ global: { challengeActive: 'Decay' } }))
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(20 * 10 * Math.pow(0.995, 10), 6)
  })

  it('Watch challenge halves output', () => {
    setGame(baseGame({ global: { challengeActive: 'Watch' } }))
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(10, 6)
  })

  it('Lead challenge doubles on odd worlds only', () => {
    setGame(baseGame({ global: { challengeActive: 'Lead', world: 3 } }))
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(40, 6) // odd world → ·2
    setGame(baseGame({ global: { challengeActive: 'Lead', world: 4 } }))
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(20, 6) // even world → unchanged
  })

  it('Daily dedication multiplies by its getMult; famine skips fragments/science increases', () => {
    setGame(
      baseGame({ global: { challengeActive: 'Daily', dailyChallenge: { dedication: { strength: 5 } } } }),
    )
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(26, 6) // 20·1.3

    const gf = baseGame({ global: { challengeActive: 'Daily', dailyChallenge: { famine: { strength: 5 } } } })
    gf.jobs.Farmer.increase = 'science' // famine excluded for science
    setGame(gf)
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(20, 6) // famine does NOT apply
  })

  it('the terminal Staff-speed heirloom bonus is applied (identity stub → base unchanged)', () => {
    ;(globalThis as any).calcHeirloomBonus = (_t: string, _s: string, v: number) => v * 4
    setGame(baseGame())
    expect(getPerSecBeforeManual(JOB)).toBeCloseTo(80, 6) // 20·4
  })
})

describe('query checkJobPercentageCost', () => {
  it('geometric cost, affordable → [true, percent-of-owned]', () => {
    setGame({
      global: { buyAmt: 2 },
      jobs: { Farmer: { owned: 0, cost: { food: [10, 2] } } },
      resources: { food: { owned: 100 } },
    })
    // f = floor(10·2^0·((2^2-1)/(2-1))) = 30; 100 ≥ 30 → [true, (100·30/100).toFixed(1)]
    expect(checkJobPercentageCost('Farmer')).toEqual([true, '30.0'])
  })

  it('linear cost (cost[1] undefined) → cost = base·amount', () => {
    setGame({
      global: { buyAmt: 2 },
      jobs: { Farmer: { owned: 0, cost: { food: 5 } } },
      resources: { food: { owned: 100 } },
    })
    // f = 5·2 = 10; affordable → [true, (100·10/100).toFixed(1)]
    expect(checkJobPercentageCost('Farmer')).toEqual([true, '10.0'])
  })

  it('not affordable → [false, timeToMax] via getPsString/calculateTimeToMax', () => {
    ;(globalThis as any).getPsString = () => 5
    ;(globalThis as any).calculateTimeToMax = () => '99s'
    setGame({
      global: { buyAmt: 2 },
      jobs: { Farmer: { owned: 0, cost: { food: [10, 2] } } },
      resources: { food: { owned: 10 } },
    })
    expect(checkJobPercentageCost('Farmer')).toEqual([false, '99s'])
    delete (globalThis as any).getPsString
    delete (globalThis as any).calculateTimeToMax
  })

  it('explicit amount arg overrides game.global.buyAmt', () => {
    setGame({
      global: { buyAmt: 99 },
      jobs: { Farmer: { owned: 0, cost: { food: 5 } } },
      resources: { food: { owned: 100 } },
    })
    // amount=1 override → f = 5·1 = 5 → [true, '5.0']
    expect(checkJobPercentageCost('Farmer', 1)).toEqual([true, '5.0'])
  })
})

describe('query setScienceNeeded / RsetScienceNeeded (global-mutation loops)', () => {
  afterEach(() => {
    delete (globalThis as any).upgradeList
    delete (globalThis as any).RupgradeList
    delete (globalThis as any).needGymystic
    delete (globalThis as any).scienceNeeded
    delete (globalThis as any).RscienceNeeded
  })

  it('sums science cost over allowed>done upgrades; adds Gymystic when it is allowed>done', () => {
    ;(globalThis as any).scienceNeeded = 0 // pre-exist the global the bare assignment writes
    ;(globalThis as any).upgradeList = ['A', 'B', 'C']
    setGame({
      global: { world: 5, totalHeliumEarned: 999999 },
      upgrades: {
        A: { allowed: 2, done: 0, cost: { resources: { science: [100, 1] } } }, // 100
        B: { allowed: 1, done: 1, cost: { resources: { science: 999 } } }, // allowed==done → skipped
        C: { allowed: 3, done: 0, cost: { resources: { science: 50 } } }, // 50
        Gymystic: { allowed: 1, done: 0, cost: { resources: { science: 25 } } }, // +25
      },
    })
    setScienceNeeded()
    expect((globalThis as any).scienceNeeded).toBe(175) // 100 + 50 + 25
  })

  it('skips Speed upgrades at world 1 with low helium', () => {
    ;(globalThis as any).scienceNeeded = 0
    ;(globalThis as any).upgradeList = ['Speed2', 'Miner']
    setGame({
      global: { world: 1, totalHeliumEarned: 1000 },
      upgrades: {
        Speed2: { allowed: 1, done: 0, cost: { resources: { science: 500 } } }, // skipped (Speed, w1, ≤1000 He)
        Miner: { allowed: 1, done: 0, cost: { resources: { science: 80 } } }, // 80
        Gymystic: { allowed: 0, done: 0, cost: { resources: { science: 5000000 } } },
      },
    })
    setScienceNeeded()
    expect((globalThis as any).scienceNeeded).toBe(80)
  })

  // Regression (#63): needGymystic is a loader global hardcoded `true` (AutoTrimps2.js) and never
  // reset, so setScienceNeeded used to add Gymystic's flat 5,000,000 science cost unconditionally —
  // even with Gymystic locked/unavailable and no upgrades pending. scienceNeeded never reached 0, so
  // gather.ts's needScience stayed true and AT researched forever (and never fell through to its
  // Turkimp→metal branch). The check is now live: allowed > done.
  it('#63: adds NOTHING for a locked/unavailable Gymystic even when the stale needGymystic is true', () => {
    ;(globalThis as any).scienceNeeded = 0
    ;(globalThis as any).upgradeList = ['A']
    ;(globalThis as any).needGymystic = true // the stale loader value, as it is in a live session
    setGame({
      global: { world: 16, totalHeliumEarned: 579 },
      upgrades: {
        A: { allowed: 1, done: 1, cost: { resources: { science: 100 } } }, // done → skipped
        Gymystic: { locked: 1, allowed: 0, done: 0, cost: { resources: { science: 5000000 } } },
      },
    })
    setScienceNeeded()
    expect((globalThis as any).scienceNeeded).toBe(0)
  })

  it('RsetScienceNeeded mirrors with RupgradeList + totalRadonEarned', () => {
    ;(globalThis as any).RscienceNeeded = 0
    ;(globalThis as any).RupgradeList = ['Speed2', 'Miner']
    setGame({
      global: { world: 1, totalRadonEarned: 1000 },
      upgrades: {
        Speed2: { allowed: 1, done: 0, cost: { resources: { science: 500 } } }, // skipped
        Miner: { allowed: 1, done: 0, cost: { resources: { science: 80 } } }, // 80
      },
    })
    RsetScienceNeeded()
    expect((globalThis as any).RscienceNeeded).toBe(80)
  })
})

describe('query getPotencyMod (per-multiplier arming)', () => {
  // base potency = 10; Pheromones level 0 → its always-applied (1+level·mod) term is ×1.
  function baseGame(over: Record<string, any> = {}) {
    const g: Record<string, any> = {
      global: { challengeActive: '', brokenPlanet: false, voidBuff: '' },
      resources: { trimps: { potency: 10 } },
      upgrades: { Potency: { done: 0 } },
      buildings: { Nursery: { owned: 0 } },
      unlocks: { impCount: { Venimp: 0 }, quickTrimps: false },
      portal: { Pheromones: { level: 0, modifier: 0.1 } },
      jobs: { Geneticist: { owned: 0 } },
      challenges: { Toxicity: { stacks: 0, stackMult: 1.05 } },
    }
    for (const k of Object.keys(over)) g[k] = { ...(g[k] || {}), ...over[k] }
    return g
  }
  beforeEach(() => {
    ;(globalThis as any).calcHeirloomBonus = (_t: string, _s: string, v: number) => v
    ;(globalThis as any).dailyModifiers = {
      dysfunctional: { getMult: () => 1.5 },
      toxic: { getMult: () => 1.3 },
    }
  })
  afterEach(() => {
    delete (globalThis as any).calcHeirloomBonus
    delete (globalThis as any).dailyModifiers
  })

  it('base = trimps.potency with no bonuses', () => {
    setGame(baseGame())
    expect(getPotencyMod()).toBeCloseTo(10, 6)
  })
  it('Potency book multiplies by 1.1^done', () => {
    setGame(baseGame({ upgrades: { Potency: { done: 3 } } }))
    expect(getPotencyMod()).toBeCloseTo(10 * Math.pow(1.1, 3), 6)
  })
  it('Nursery multiplies by 1.01^owned', () => {
    setGame(baseGame({ buildings: { Nursery: { owned: 5 } } }))
    expect(getPotencyMod()).toBeCloseTo(10 * Math.pow(1.01, 5), 6)
  })
  it('Venimp multiplies by 1.003^count', () => {
    setGame(baseGame({ unlocks: { impCount: { Venimp: 4 }, quickTrimps: false } }))
    expect(getPotencyMod()).toBeCloseTo(10 * Math.pow(1.003, 4), 6)
  })
  it('brokenPlanet divides by 10', () => {
    setGame(baseGame({ global: { brokenPlanet: true } }))
    expect(getPotencyMod()).toBeCloseTo(1, 6)
  })
  it('Pheromones multiplies by 1+level·modifier', () => {
    setGame(baseGame({ portal: { Pheromones: { level: 2, modifier: 0.1 } } }))
    expect(getPotencyMod()).toBeCloseTo(12, 6) // 10·1.2
  })
  it('Geneticist multiplies by 0.98^(owned+extraGenes)', () => {
    setGame(baseGame({ jobs: { Geneticist: { owned: 4 } } }))
    expect(getPotencyMod()).toBeCloseTo(10 * Math.pow(0.98, 4), 6)
    expect(getPotencyMod(2)).toBeCloseTo(10 * Math.pow(0.98, 6), 6) // +howManyMoreGenes
  })
  it('quickTrimps doubles', () => {
    setGame(baseGame({ unlocks: { impCount: { Venimp: 0 }, quickTrimps: true } }))
    expect(getPotencyMod()).toBeCloseTo(20, 6)
  })
  it('Daily dysfunctional and toxic each multiply by their getMult', () => {
    setGame(
      baseGame({
        global: {
          challengeActive: 'Daily',
          dailyChallenge: { dysfunctional: { strength: 1 }, toxic: { strength: 1, stacks: 1 } },
        },
      }),
    )
    expect(getPotencyMod()).toBeCloseTo(10 * 1.5 * 1.3, 6)
  })
  it('Toxicity multiplies by stackMult^stacks when stacked', () => {
    setGame(baseGame({ global: { challengeActive: 'Toxicity' }, challenges: { Toxicity: { stacks: 3, stackMult: 1.05 } } }))
    expect(getPotencyMod()).toBeCloseTo(10 * Math.pow(1.05, 3), 6)
  })
  it('voidBuff slowBreed multiplies by 0.2', () => {
    setGame(baseGame({ global: { voidBuff: 'slowBreed' } }))
    expect(getPotencyMod()).toBeCloseTo(2, 6)
  })
  it('the terminal Shield-breedSpeed heirloom bonus is applied', () => {
    ;(globalThis as any).calcHeirloomBonus = (_t: string, _s: string, v: number) => v * 3
    setGame(baseGame())
    expect(getPotencyMod()).toBeCloseTo(30, 6)
  })
})

describe('query getArmyTime', () => {
  afterEach(() => {
    delete (globalThis as any).trimpsEffectivelyEmployed
    delete (globalThis as any).calcHeirloomBonus
  })
  it('returns adjustedMax / (breeding · potencyMod)', () => {
    ;(globalThis as any).trimpsEffectivelyEmployed = () => 20
    ;(globalThis as any).calcHeirloomBonus = (_t: string, _s: string, v: number) => v
    setGame({
      global: { challengeActive: '', brokenPlanet: false, voidBuff: '' },
      resources: { trimps: { owned: 120, realMax: () => 500, maxSoldiers: 50, potency: 2 } },
      upgrades: { Potency: { done: 0 } },
      buildings: { Nursery: { owned: 0 } },
      unlocks: { impCount: { Venimp: 0 }, quickTrimps: false },
      portal: { Pheromones: { level: 0, modifier: 0.1 }, Coordinated: { level: 0 } },
      jobs: { Geneticist: { owned: 0 } },
      challenges: { Toxicity: { stacks: 0, stackMult: 1 } },
    })
    // breeding = 120-20 = 100; potencyMod = 2; adjustedMax = maxSoldiers(50) [Coordinated.level 0]
    // addTime = 50 / (100·2) = 0.25
    expect(getArmyTime()).toBeCloseTo(0.25, 6)
  })
  it('uses Coordinated.currentSend when Coordinated is leveled', () => {
    ;(globalThis as any).trimpsEffectivelyEmployed = () => 0
    ;(globalThis as any).calcHeirloomBonus = (_t: string, _s: string, v: number) => v
    setGame({
      global: { challengeActive: '', brokenPlanet: false, voidBuff: '' },
      resources: { trimps: { owned: 100, realMax: () => 500, maxSoldiers: 999, potency: 1 } },
      upgrades: { Potency: { done: 0 } },
      buildings: { Nursery: { owned: 0 } },
      unlocks: { impCount: { Venimp: 0 }, quickTrimps: false },
      portal: { Pheromones: { level: 0, modifier: 0.1 }, Coordinated: { level: 5, currentSend: 40 } },
      jobs: { Geneticist: { owned: 0 } },
      challenges: { Toxicity: { stacks: 0, stackMult: 1 } },
    })
    // adjustedMax = currentSend(40); breeding=100; potencyMod=1 → 40/100 = 0.4
    expect(getArmyTime()).toBeCloseTo(0.4, 6)
  })
})
