// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { maxOneShotPower, directDamage, challengeDamage, survive } from '../src/modules/stance'
import { makeMinimalGame } from './harness/gameFixture'

// Phase 1 · Wave 1 characterization net for stance.ts (issue #26). These golden masters pin the
// current faithful-port behaviour BEFORE @ts-nocheck is removed, so the strict-TS conversion is
// provably behaviour-preserving. Two archetypes, matching the design spec:
//   - maxOneShotPower  → pure predicate (game+settings → int), return == golden master

describe('stance.maxOneShotPower — Layer-1 golden master (pure predicate)', () => {
  beforeEach(() => {
    // Free-identifier deps resolved via the bridge at runtime; stub them for the unit.
    ;(globalThis as any).getCurrentEnemy = () => ({ health: 1 })
    ;(globalThis as any).getEmpowerment = () => ''
  })

  it('returns 1 when Overkill is not unlocked', () => {
    ;(globalThis as any).game = makeMinimalGame({
      portal: { Overkill: { level: 0 } },
    })
    // power starts 2, Overkill.level == 0 → early return 1
    expect(maxOneShotPower(false)).toBe(1)
  })

  it('returns the base power of 2 with Overkill unlocked and no bonuses', () => {
    ;(globalThis as any).game = makeMinimalGame({
      portal: { Overkill: { level: 3 } },
      talents: { overkill: { purchased: false } },
      global: { uberNature: '' },
    })
    expect(maxOneShotPower(false)).toBe(2)
  })

  it('stacks overkill-mastery, uber Ice, and both Ice-empowerment breakpoints to 7', () => {
    ;(globalThis as any).getEmpowerment = () => 'Ice'
    ;(globalThis as any).game = makeMinimalGame({
      portal: { Overkill: { level: 5 } },
      talents: { overkill: { purchased: true } }, // +1 → 3
      global: { uberNature: 'Ice' }, // +2 → 5
      empowerments: { Ice: { getLevel: () => 100 } }, // >=50 +1 → 6, >=100 +1 → 7
    })
    expect(maxOneShotPower(false)).toBe(7)
  })
})

// directDamage is the ONLY function whose control flow changed in the true-TS conversion
// (the dodgeDaily hoist). All params are passed explicitly so the calc pre-init short-circuits;
// brokenPlanet=false keeps the pierce=0 recompute a no-op. Golden masters pin the harm output.
describe('stance.directDamage — Layer-1 golden master (control-flow-changed fn)', () => {
  function setup(enemy: Record<string, unknown>, enemyDamage: number, over: Record<string, unknown> = {}) {
    ;(globalThis as any).getCurrentEnemy = () => enemy
    ;(globalThis as any).calcSpecificEnemyAttack = () => enemyDamage
    ;(globalThis as any).challengeActive = () => false
    ;(globalThis as any).game = makeMinimalGame({
      global: { voidBuff: '', challengeActive: '', mapsActive: false, brokenPlanet: false, dailyChallenge: {} },
      badGuys: { Turtlimp: { fast: false } },
      ...over,
    })
  }

  it('zeroes harm on a non-daily one-shot (the hoisted dodgeDaily === undefined branch)', () => {
    // enemyFast=false, dodgeDaily undefined (not a Daily), minDamage(1000) > enemyHealth(500)
    // → `!enemyFast && !dodgeDaily && minDamage > enemyHealth` → harm = 0. This is exactly the
    // path the var→let hoist had to preserve.
    setup({ health: 500, corrupted: '', name: 'Turtlimp', mutation: '' }, 200)
    expect(directDamage(10, 0, 100, 1000, 2)).toBe(0)
  })

  it('takes blocked damage when the enemy is not one-shot', () => {
    // harm = max(200 - 10 block, 0 pierce, 0) = 190 ; minDamage(100) < enemyHealth(500), no zeroing
    setup({ health: 500, corrupted: '', name: 'Turtlimp', mutation: '' }, 200)
    expect(directDamage(10, 0, 100, 100, 2)).toBe(190)
  })

  it('applies pierce when block exceeds enemy damage', () => {
    // harm = max(200 - 250 block, 0.5*200 pierce, 0) = 100
    setup({ health: 500, corrupted: '', name: 'Turtlimp', mutation: '' }, 200)
    expect(directDamage(250, 0.5, 100, 100, 2)).toBe(100)
  })

  it('doubles harm on a double-attack when not a one-shot', () => {
    // voidBuff doubleAttack → isDoubleAttack; harm 190 *2 = 380 ; enemyFast=true so no zeroing
    setup({ health: 500, corrupted: '', name: 'Turtlimp', mutation: '' }, 200, {
      global: { voidBuff: 'doubleAttack', challengeActive: '', mapsActive: false, brokenPlanet: false, dailyChallenge: {} },
    })
    expect(directDamage(10, 0, 100, 100, 2)).toBe(380)
  })
})

// challengeDamage is the most branch-dense function in the module. Params passed explicitly;
// soldierHealthMax===soldierHealth makes the missingHealth recompute a no-op; brokenPlanet=false
// makes the pierce recompute 0. These pin the drain / bleed / no-op harm branches.
describe('stance.challengeDamage — Layer-1 golden master (branch-dense fn)', () => {
  function setup(over: Record<string, unknown> = {}, challengeActiveFn: (n: string) => unknown = () => false) {
    ;(globalThis as any).getCurrentEnemy = () => ({ health: 500, corrupted: '' })
    ;(globalThis as any).calcSpecificEnemyAttack = () => 50
    ;(globalThis as any).challengeActive = challengeActiveFn
    ;(globalThis as any).game = makeMinimalGame({
      global: {
        challengeActive: '', voidBuff: '', brokenPlanet: false, mapsActive: false,
        soldierHealthMax: 1000, soldierHealth: 1000, dailyChallenge: {},
      },
      challenges: { Electricity: { stacks: 0 }, Lead: { stacks: 0 } },
      ...over,
    })
  }

  it('returns 0 harm with no active challenge and no bleed', () => {
    setup()
    expect(challengeDamage(1000, 100, 200, 0, 10, 0, 2)).toBe(0)
  })

  it('drains 5% of max health under Nom', () => {
    setup({}, (n: string) => n === 'Nom') // drainChallenge → 0.05 ; 1000 * 0.05 = 50
    expect(challengeDamage(1000, 100, 200, 0, 10, 0, 2)).toBe(50)
  })

  it('bleeds 20% of current (max − missing) health under the bleed voidBuff', () => {
    // voidBuff bleed → challengeDamage 0.20 ; (1000 − 200) * 0.20 = 160
    setup({
      global: {
        challengeActive: '', voidBuff: 'bleed', brokenPlanet: false, mapsActive: false,
        soldierHealthMax: 1000, soldierHealth: 1000, dailyChallenge: {},
      },
    })
    expect(challengeDamage(1000, 100, 200, 200, 10, 0, 2)).toBe(160)
  })
})

// survive() is the branch-densest survival predicate and the actual combat-formation decision
// (autoStance loops over it). It composes directDamage + challengeDamage for real, so
// this is an end-to-end golden master: base* combat globals set on globalThis, leaf deps stubbed,
// enemy fully at/under our damage. Pins the true/false survival verdict — the highest-value guard
// against silent balance drift in the formation picker.
describe('stance.survive — Layer-1 golden master (formation-decision predicate)', () => {
  function setupCombat(enemyDamage: number, over: Record<string, unknown> = {}) {
    ;(globalThis as any).baseHealth = 1000
    ;(globalThis as any).baseBlock = 100
    ;(globalThis as any).baseMinDamage = 1000
    ;(globalThis as any).baseMaxDamage = 2000
    ;(globalThis as any).addPoison = () => 0
    ;(globalThis as any).getPierceAmt = () => 0
    ;(globalThis as any).calcOurBlock = () => 50
    ;(globalThis as any).getCurrentEnemy = () => ({ health: 500, corrupted: '', name: 'Turtlimp', mutation: '' })
    ;(globalThis as any).calcSpecificEnemyAttack = () => enemyDamage
    ;(globalThis as any).challengeActive = () => false
    ;(globalThis as any).game = makeMinimalGame({
      global: {
        voidBuff: '', challengeActive: '', brokenPlanet: false, mapsActive: false, spireActive: false,
        soldierHealthMax: 1000, soldierHealth: 1000, formation: 0, lastLowGen: 0, dailyChallenge: {},
      },
      upgrades: { Formations: { done: true }, Dominance: { done: true }, Barrier: { done: true } },
      badGuys: { Turtlimp: { fast: false } },
      jobs: { Geneticist: { owned: 0 } },
      resources: { trimps: { owned: 0, realMax: () => 0 } },
      challenges: { Electricity: { stacks: 0 }, Lead: { stacks: 0 } },
      ...over,
    })
  }

  it('survives in H formation when the enemy barely dents our block', () => {
    // H: health*4, block/2 → 50; enemyDamage 50 → directDamage harm 0; no challenge → harm 0;
    // health(4000) − missingHealth(0) > 0 → true
    setupCombat(50)
    expect(survive('H', 2, true)).toBe(true)
  })

  it('does not survive when enemy damage overwhelms block and health', () => {
    // enemyDamage 100000 ≫ block; not a one-shot boundary → harm huge; healthier path also fails
    setupCombat(100000)
    expect(survive('H', 2, true)).toBe(false)
  })
})
