// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  calcBaseDamageinX,
  calcBaseDamageinX2,
  calcBaseDamageInX,
  autoStance,
  autoStance2,
  windStance,
  oneShotZone,
  oneShotPower,
} from '../src/modules/stance'
import { makeMinimalGame } from './harness/gameFixture'

// Phase-2 characterization net for stance.ts (proof-net #51). Complements the pre-existing
// tests/stance.test.ts (which pins maxOneShotPower / autoStanceNew / directDamage / challengeDamage
// / survive / debugStance) by pinning the functions that file leaves UNtouched — the two minified
// base-damage setters being un-minified here, plus the balance-sensitive decision entry points
// (autoStance formation-selector, autoStance2/windStance world+stance thresholds, oneShot overkill
// loops). These golden masters lock current behaviour BEFORE the idiomatic un-minify so any
// transcription slip fails loudly.

// Track calcOurDmg call args so the un-minify of the two setters is provably arg-faithful.
let dmgCalls: unknown[][]

function stubCombatLeaves(over: { min?: number; max?: number; avg?: number; health?: number; block?: number } = {}) {
  dmgCalls = []
  // The base* combat globals are ambient (AutoTrimps2 / globalThis seam). Seed the property so the
  // setters' strict-mode bare assignments target an existing global (a deleted global would throw).
  for (const k of ['baseDamage', 'baseBlock', 'baseHealth', 'baseMinDamage', 'baseMaxDamage']) {
    ;(globalThis as any)[k] = 0
  }
  ;(globalThis as any).calcOurDmg = (...args: unknown[]) => {
    dmgCalls.push(args)
    const kind = args[0]
    if (kind === 'min') return over.min ?? 1000
    if (kind === 'max') return over.max ?? 2000
    return over.avg ?? 1500 // "avg"
  }
  ;(globalThis as any).calcOurHealth = () => over.health ?? 1000
  ;(globalThis as any).calcOurBlock = () => over.block ?? 100
}

afterEach(() => {
  for (const k of [
    'game', 'calcOurDmg', 'calcOurHealth', 'calcOurBlock', 'setFormation', 'getCurrentEnemy',
    'getEmpowerment', 'addPoison', 'getPierceAmt', 'calcSpecificEnemyAttack', 'calcEnemyHealth',
    'calcSpecificEnemyHealth', 'challengeActive', 'calcCurrentStance', 'autoTrimpSettings',
    'lowHeirloom', 'highHeirloom', 'dlowHeirloom', 'dhighHeirloom',
    'baseDamage', 'baseBlock', 'baseHealth', 'baseMinDamage', 'baseMaxDamage',
  ]) delete (globalThis as any)[k]
})

// ── The two minified setters being un-minified (transcription-risk guards) ──────────────────────
describe('stance.calcBaseDamageinX — minified setter being un-minified', () => {
  it('sets baseDamage from calcOurDmg("avg",false,true), block from soldierCurrentBlock, health from soldierHealthMax', () => {
    stubCombatLeaves()
    ;(globalThis as any).game = makeMinimalGame({
      global: { soldierCurrentBlock: 42, soldierHealthMax: 777 },
    })
    calcBaseDamageinX()
    expect((globalThis as any).baseDamage).toBe(1500)
    expect((globalThis as any).baseBlock).toBe(42)
    expect((globalThis as any).baseHealth).toBe(777)
    // exact arg tuple to calcOurDmg (the only dmg call this fn makes)
    expect(dmgCalls).toEqual([['avg', false, true]])
  })
})

describe('stance.calcBaseDamageinX2 — minified setter being un-minified', () => {
  it('sets baseDamage from calcOurDmg("avg",false,true), block from calcOurBlock(), health from calcOurHealth()', () => {
    stubCombatLeaves({ block: 55, health: 888 })
    ;(globalThis as any).game = makeMinimalGame({})
    calcBaseDamageinX2()
    expect((globalThis as any).baseDamage).toBe(1500)
    expect((globalThis as any).baseBlock).toBe(55)
    expect((globalThis as any).baseHealth).toBe(888)
    expect(dmgCalls).toEqual([['avg', false, true]])
  })
})

describe('stance.calcBaseDamageInX (capital I) — the 5-field setter', () => {
  it('sets min/max/avg damage + health(false) + block(false), each from its own leaf call', () => {
    stubCombatLeaves({ min: 111, max: 222, avg: 333, health: 444, block: 555 })
    ;(globalThis as any).game = makeMinimalGame({})
    calcBaseDamageInX()
    expect((globalThis as any).baseMinDamage).toBe(111)
    expect((globalThis as any).baseMaxDamage).toBe(222)
    expect((globalThis as any).baseDamage).toBe(333)
    expect((globalThis as any).baseHealth).toBe(444)
    expect((globalThis as any).baseBlock).toBe(555)
    expect(dmgCalls).toEqual([['min', false, true], ['max', false, true], ['avg', false, true]])
  })
})

// ── autoStance: the formation-selection decision (balance-sensitive branch) ──────────────────────
describe('stance.autoStance — formation selector spy-log', () => {
  let formationCalls: unknown[]
  function setupCombat(over: Record<string, unknown> = {}) {
    formationCalls = []
    stubCombatLeaves() // min 1000 / max 2000 / avg 1500 / health 1000 / block 100
    ;(globalThis as any).setFormation = vi.fn((f: unknown) => formationCalls.push(f))
    ;(globalThis as any).addPoison = () => 0
    ;(globalThis as any).getPierceAmt = () => 0
    ;(globalThis as any).getCurrentEnemy = () => ({ health: 500, corrupted: '', name: 'Turtlimp', mutation: '' })
    ;(globalThis as any).calcSpecificEnemyAttack = () => 50
    ;(globalThis as any).challengeActive = () => false
    ;(globalThis as any).autoTrimpSettings = { AutoStance: { type: 'boolean', enabled: true } }
    ;(globalThis as any).game = makeMinimalGame({
      global: {
        voidBuff: '', challengeActive: '', brokenPlanet: false, mapsActive: false, spireActive: false,
        preMapsActive: false, soldierHealth: 1000, soldierHealthMax: 1000, formation: 0, lastLowGen: 0,
        lastClearedCell: 0, gridArray: [{}], dailyChallenge: {},
      },
      upgrades: { Formations: { done: true }, Dominance: { done: true }, Barrier: { done: true } },
      badGuys: { Turtlimp: { fast: false } },
      jobs: { Geneticist: { owned: 0 } },
      resources: { trimps: { owned: 0, realMax: () => 0 } },
      challenges: { Electricity: { stacks: 0 }, Lead: { stacks: 0 } },
      ...over,
    })
  }

  it('picks D formation (setFormation(2)) when D survives the mega crit', () => {
    // survive("D",2) passes first (block/2=50, enemyDamage 50 → harm 0; health 500 > 0) → setFormation(2)
    setupCombat()
    autoStance()
    expect(formationCalls).toEqual([2])
  })

  it('returns early (true, no setFormation) when AutoStance is off', () => {
    setupCombat()
    ;(globalThis as any).autoTrimpSettings = { AutoStance: { type: 'boolean', enabled: false } }
    expect(autoStance()).toBe(true)
    expect(formationCalls).toEqual([])
  })

  it('delegates to autoStance2 (setFormation(2)) under Domination at the boss cell', () => {
    setupCombat({
      global: {
        voidBuff: '', challengeActive: 'Domination', brokenPlanet: false, mapsActive: false,
        spireActive: false, preMapsActive: false, soldierHealth: 1000, soldierHealthMax: 1000,
        formation: 0, lastLowGen: 0, lastClearedCell: 98, gridArray: [{}], dailyChallenge: {}, world: 200,
      },
    })
    autoStance()
    // autoStance2: world 200 > 70, formation 0 != 2 → setFormation(2)
    expect(formationCalls).toEqual([2])
  })
})

// ── autoStance2: world threshold + formation guard ──────────────────────────────────────────────
describe('stance.autoStance2 — world/formation guards', () => {
  let formationCalls: unknown[]
  function setup(over: Record<string, unknown> = {}) {
    formationCalls = []
    ;(globalThis as any).setFormation = vi.fn((f: unknown) => formationCalls.push(f))
    ;(globalThis as any).autoTrimpSettings = { AutoStance: { type: 'boolean', enabled: true } }
    ;(globalThis as any).game = makeMinimalGame({
      global: { gridArray: [{}], soldierHealth: 100, world: 200, formation: 0 },
      upgrades: { Formations: { done: true } },
      ...over,
    })
  }

  it('sets formation 2 when world > 70 and not already on 2', () => {
    setup()
    autoStance2()
    expect(formationCalls).toEqual([2])
  })

  it('does nothing at world <= 70 (the zone threshold)', () => {
    setup({ global: { gridArray: [{}], soldierHealth: 100, world: 70, formation: 0 } })
    autoStance2()
    expect(formationCalls).toEqual([])
  })

  it('does nothing when already on formation 2', () => {
    setup({ global: { gridArray: [{}], soldierHealth: 100, world: 200, formation: 2 } })
    autoStance2()
    expect(formationCalls).toEqual([])
  })
})

// ── windStance: calcCurrentStance → (stance, heirloom-tier) mapping ─────────────────────────────
describe('stance.windStance — stance-tier mapping', () => {
  let formationCalls: unknown[]
  let heirloomCalls: string[]
  function setup(currentStance: number, challengeActive = '') {
    formationCalls = []
    heirloomCalls = []
    ;(globalThis as any).setFormation = vi.fn((f: unknown) => formationCalls.push(f))
    ;(globalThis as any).calcCurrentStance = () => currentStance
    for (const h of ['lowHeirloom', 'highHeirloom', 'dlowHeirloom', 'dhighHeirloom']) {
      ;(globalThis as any)[h] = () => heirloomCalls.push(h)
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { gridArray: [{}], soldierHealth: 100, world: 200, challengeActive },
      upgrades: { Formations: { done: true } },
    })
  }

  it('non-daily stance 5 → setFormation(5) + lowHeirloom', () => {
    setup(5)
    windStance()
    expect(formationCalls).toEqual([5])
    expect(heirloomCalls).toEqual(['lowHeirloom'])
  })

  it('non-daily stance 15 → setFormation(5) + highHeirloom (the high-tier arm)', () => {
    setup(15)
    windStance()
    expect(formationCalls).toEqual([5])
    expect(heirloomCalls).toEqual(['highHeirloom'])
  })

  it('non-daily stance 10 → setFormation(0) + highHeirloom', () => {
    setup(10)
    windStance()
    expect(formationCalls).toEqual([0])
    expect(heirloomCalls).toEqual(['highHeirloom'])
  })

  it('daily stance 12 → setFormation(2) + dhighHeirloom (daily branch)', () => {
    setup(12, 'Daily')
    windStance()
    expect(formationCalls).toEqual([2])
    expect(heirloomCalls).toEqual(['dhighHeirloom'])
  })

  it('bails (no setFormation call resolves to default 2) at world <= 70', () => {
    setup(5)
    ;(globalThis as any).game = makeMinimalGame({
      global: { gridArray: [{}], soldierHealth: 100, world: 70, challengeActive: '' },
      upgrades: { Formations: { done: true } },
    })
    windStance()
    expect(formationCalls).toEqual([])
  })
})

// ── oneShotZone / oneShotPower: overkill loop math ──────────────────────────────────────────────
describe('stance.oneShotZone — overkill one-shot count', () => {
  beforeEach(() => {
    ;(globalThis as any).addPoison = () => 0
    ;(globalThis as any).getCurrentEnemy = () => ({ health: 1, level: 1 })
    ;(globalThis as any).getEmpowerment = () => ''
    ;(globalThis as any).calcEnemyHealth = () => 100
  })

  it('one-shots exactly the enemies our damage covers before overkill decay drains it', () => {
    stubCombatLeaves({ min: 250 }) // maxOrMin falsy → "min" = 250 damage
    ;(globalThis as any).game = makeMinimalGame({
      portal: { Overkill: { level: 30 } }, // maxOneShotPower: level>0 & no bonuses → 2
      talents: { overkill: { purchased: false } },
      global: { uberNature: '', world: 100 },
    })
    // power1: 250-100=150 (>=0). leftover *= 0.005*30 = 0.15 → 150*0.15=22.5
    // power2: 22.5-100=-77.5 (<0) → return power-1 = 1
    expect(oneShotZone(100)).toBe(1)
  })
})

describe('stance.oneShotPower — overkill one-shot count vs current enemy chain', () => {
  it('returns 0 when the current enemy is not one-shot', () => {
    stubCombatLeaves({ min: 50 })
    ;(globalThis as any).addPoison = () => 0
    ;(globalThis as any).getEmpowerment = () => ''
    ;(globalThis as any).getCurrentEnemy = (n?: number) => (n && n > 1 ? undefined : { health: 500, level: 1 })
    ;(globalThis as any).calcSpecificEnemyHealth = () => 100
    ;(globalThis as any).game = makeMinimalGame({
      portal: { Overkill: { level: 30 } },
      talents: { overkill: { purchased: false } },
      global: { uberNature: '' },
    })
    // power1: damageLeft 50 - enemy.health 500 = -450 < 0 → return power-1 = 0
    expect(oneShotPower()).toBe(0)
  })
})
