// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #233/#250 — getPotencyMod's drift from the game's breed() potency chain.
//
// AT carries THREE copies of this formula (query.ts:getPotencyMod, breedtimer.ts:potencyMod,
// breedtimer.ts:ATGA2). That is the whole reason both defects exist: #22's parity fix added the
// Archaeology/Quagmire multipliers to two of the three, and the `game.portal.Pheromones.level`
// read was wrong in all three at once. So this file asserts two things — parity against the game's
// own chain, and AGREEMENT between the copies, which is the invariant that keeps breaking.

const G = globalThis as any
let query: typeof import('../src/modules/query')
let breedtimer: typeof import('../src/modules/breedtimer')

beforeAll(async () => {
  G.MODULES = {}
  G.Decimal = (await import('decimal.js')).default
  document.body.insertAdjacentHTML('beforeend', `<div id="trimps"><div class="row"></div></div><div id="trimpsFighting"></div>`)
  breedtimer = await import('../src/modules/breedtimer')
  query = await import('../src/modules/query')
})

/**
 * .trimps-game/main.js:5589-5636 — the game's own potency chain, transcribed. Deliberately NOT a
 * table of expected numbers: the oracle is the clone's sequence of multipliers, so a structural slip
 * anywhere in AT's copy shows up rather than just the one value I thought to pin.
 *
 * Genes are excluded (the game applies them via DecimalBreed after the heirloom step) and so are the
 * U2 GeneAttack/GeneHealth /50 divisors, which NO AT copy mirrors — see #250, which explicitly scopes
 * that out as pre-existing and shared rather than drift specific to one file.
 */
function gamePotencyMod(s: any): number {
  let m = s.potency
  if (s.book > 0) m *= Math.pow(1.1, s.book)
  if (s.nursery > 0) m *= Math.pow(1.01, s.nursery)
  if (s.venimp) m *= Math.pow(1.003, s.venimp)
  if (s.brokenPlanet) m /= 10
  if (s.pheromones > 0) m *= 1 + s.pheromones * s.pheromonesMod
  if (s.quickTrimps) m *= 2
  if (s.toxicityStacks > 0) m *= Math.pow(s.toxicityStackMult, s.toxicityStacks)
  if (s.archaeology) m *= s.archaeologyMult
  if (s.quagmire) m *= s.quagmireMult
  if (s.slowBreed) m *= 0.2
  return m
}

/** Build a `game` + free-identifier world from a flat spec, for both AT copies at once. */
function world(s: any) {
  const challenge = s.archaeology ? 'Archaeology' : s.quagmire ? 'Quagmire' : s.toxicityStacks > 0 ? 'Toxicity' : ''
  G.game = {
    resources: { trimps: { potency: s.potency, realMax: () => 1e6 } },
    upgrades: { Potency: { done: s.book } },
    buildings: { Nursery: { owned: s.nursery } },
    unlocks: { impCount: { Venimp: s.venimp } },
    global: {
      brokenPlanet: s.brokenPlanet,
      universe: s.universe,
      challengeActive: challenge,
      dailyChallenge: {},
      voidBuff: s.slowBreed ? 'slowBreed' : '',
    },
    // BOTH allocations present and DIFFERENT — a copy reading `.level` in U2 cannot pass by luck.
    portal: { Pheromones: { level: s.u1Level, radLevel: s.u2Level, modifier: s.pheromonesMod } },
    singleRunBonuses: { quickTrimps: { owned: s.quickTrimps } },
    jobs: { Geneticist: { owned: 0, locked: true } },
    challenges: {
      Toxicity: { stacks: s.toxicityStacks, stackMult: s.toxicityStackMult },
      Archaeology: { getStatMult: () => s.archaeologyMult },
      Quagmire: { getExhaustMult: () => s.quagmireMult },
    },
  }
  G.getPerkLevel = (what: string) =>
    what === 'Pheromones' ? (G.game.global.universe === 2 ? s.u2Level : s.u1Level) : 0
  G.challengeActive = (c: string) => G.game.global.challengeActive === c
  G.dailyModifiers = { dysfunctional: { getMult: () => 1 }, toxic: { getMult: () => 1 } }
  G.calcHeirloomBonus = (_s: string, _t: string, v: number) => v
  G.calcHeirloomBonusDecimal = (_s: string, _t: string, v: any) => v
  return { ...s, pheromones: s.universe === 2 ? s.u2Level : s.u1Level }
}

const BASE = {
  potency: 0.0085, book: 0, nursery: 0, venimp: 0, brokenPlanet: false,
  u1Level: 7, u2Level: 40, pheromonesMod: 0.1, universe: 1,
  quickTrimps: false, toxicityStacks: 0, toxicityStackMult: 1.05,
  archaeology: false, archaeologyMult: 1, quagmire: false, quagmireMult: 1, slowBreed: false,
}

const CASES: Array<[string, any]> = [
  ['neutral U1', {}],
  ['neutral U2 (radLevel, not level)', { universe: 2 }],
  ['full economy chain', { book: 5, nursery: 30, venimp: 12, brokenPlanet: true }],
  ['#233 quickTrimps owned', { quickTrimps: true }],
  ['#233 quickTrimps owned, U2', { quickTrimps: true, universe: 2 }],
  ['#250 Archaeology', { archaeology: true, archaeologyMult: 0.37 }],
  ['#250 Quagmire', { quagmire: true, quagmireMult: 0.21 }],
  ['Toxicity stacks', { toxicityStacks: 40 }],
  ['slowBreed void buff', { slowBreed: true }],
  ['everything at once, U2', {
    book: 5, nursery: 30, venimp: 12, brokenPlanet: true, universe: 2,
    quickTrimps: true, archaeology: true, archaeologyMult: 0.37, slowBreed: true,
  }],
]

describe('query.getPotencyMod matches the game chain (#233, #250)', () => {
  it.each(CASES)('%s', (_label, over) => {
    const s = world({ ...BASE, ...over })
    expect(query.getPotencyMod()).toBeCloseTo(gamePotencyMod(s), 12)
  })
})

describe('the copies of the chain agree with each other', () => {
  // This is the invariant that actually keeps breaking: #22 fixed two copies and missed the third,
  // and the Pheromones read was wrong in all three simultaneously.
  //
  // The two functions do NOT return the same quantity — breedtimer's tail is
  // `return potencyMod.div(10).add(1)`, i.e. the per-tick breeding RATE, where query returns the raw
  // potency multiplier. Everything before that tail is the same chain, so that is what is compared.
  // (Asserting raw equality is what a careless version of this test would do; it fails, and "fixing"
  // it by loosening the tolerance would have hidden the whole point.)
  const asRate = (m: number) => m / 10 + 1

  it.each(CASES)('%s — breedtimer.potencyMod === 1 + query.getPotencyMod()/10', (_label, over) => {
    world({ ...BASE, ...over })
    const fromQuery = asRate(query.getPotencyMod())
    const fromBreedtimer = Number(breedtimer.potencyMod().toString())
    expect(fromBreedtimer).toBeCloseTo(fromQuery, 12)
  })

  it('anti-false-green: the cases actually move the answer', () => {
    // If every CASE collapsed to the same number, the agreement above would be trivially satisfiable.
    const seen = CASES.map(([, over]) => {
      world({ ...BASE, ...over })
      return query.getPotencyMod()
    })
    expect(new Set(seen.map((v) => v.toPrecision(12))).size).toBeGreaterThanOrEqual(CASES.length - 1)
  })
})

describe('the named defects, driven directly', () => {
  beforeEach(() => world(BASE))

  it('#233: quickTrimps is read from singleRunBonuses, not the field the game deleted in 4.8', () => {
    const off = query.getPotencyMod()
    world({ ...BASE, quickTrimps: true })
    expect(query.getPotencyMod()).toBeCloseTo(off * 2, 12)
    // The pre-fix read. Setting ONLY the dead field must now change nothing — otherwise the fix
    // merely added a second source rather than replacing the first.
    world(BASE)
    G.game.unlocks.quickTrimps = true
    expect(query.getPotencyMod()).toBeCloseTo(off, 12)
  })

  it('#250: U2 uses radLevel — and the two allocations are genuinely different in the fixture', () => {
    expect(BASE.u1Level).not.toBe(BASE.u2Level) // else this test proves nothing
    const u1 = query.getPotencyMod()
    world({ ...BASE, universe: 2 })
    const u2 = query.getPotencyMod()
    expect(u2).not.toBeCloseTo(u1, 12)
    expect(u2 / BASE.potency).toBeCloseTo(1 + BASE.u2Level * BASE.pheromonesMod, 12)
  })

  it('#250: Archaeology and Quagmire each move the answer', () => {
    const off = query.getPotencyMod()
    world({ ...BASE, archaeology: true, archaeologyMult: 0.37 })
    expect(query.getPotencyMod()).toBeCloseTo(off * 0.37, 12)
    world({ ...BASE, quagmire: true, quagmireMult: 0.21 })
    expect(query.getPotencyMod()).toBeCloseTo(off * 0.21, 12)
  })
})
