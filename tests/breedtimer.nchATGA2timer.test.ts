// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

// `nchATGA2timer` ("ATGA: T: C: Hard") is the unsquared counterpart of `chATGA2timer`
// ("ATGA: T: C2: Hard"): a breed timer for the harder ordinary challenges, gated on the challenge
// being ACTIVE rather than on a zone, so that completing it mid-run (Electricity/Mapocalypse clear
// The Prison at 80, config.js:3616 sets `game.global.challengeActive = ""`) drops ATGA back to the
// base timer for the rest of the run with no extra bookkeeping.
//
// WHY A HAND-BUILT TEST: `ATGA2` defaults to false, so every L0 corpus save has ATGA off entirely
// and `baseline-zero` is vacuous for this whole function — citing its green here would be the
// reach-vs-sensitivity mistake recorded in #98. The evidence has to be made, not borrowed.
//
// THE OBSERVABLE: `target` is a local. But it is the ONLY thing that differs between these fixtures,
// and ATGA2() ends by comparing it against the (fixed) current breed time — so a LARGE target means
// hire and a SMALL one means fire. Spying on addGeneticist/removeGeneticist therefore reads back
// which timer won, and does it through the real decision path rather than around it.
const G = globalThis as any
let breedtimer: typeof import('../src/modules/breedtimer')

beforeAll(async () => {
  G.MODULES = {}
  G.Decimal = (await import('decimal.js')).default
  document.body.insertAdjacentHTML('beforeend', `<div id="trimps"><div class="row"></div></div><div id="trimpsFighting"></div>`)
  breedtimer = await import('../src/modules/breedtimer')
})

/** A settings record shaped the way utils.getPageSetting reads it. */
const val = (v: number) => ({ type: 'value', value: v })

type Case = {
  /** Which challenges `challengeActive(name)` reports as running. */
  active?: string[]
  /** `game.global.runningChallengeSquared`. */
  squared?: boolean
  /** The setting under test. */
  nch?: number
  /** The squared sibling, to prove the two rows do not bleed into each other. */
  ch?: number
  /** `isActiveSpireAT()` — the row the new setting's tooltip says can override it. */
  spire?: boolean
  /** The Spire timer, which only matters while `spire` is true. */
  sTimer?: number
  /** The After-Z pair (zone, timer), which the tooltip says this setting overrides. */
  afterZ?: [number, number]
}

/**
 * Drive ATGA2() and report which arm it took.
 *
 * The base timer is 1s and the hard timer is 600s against a breed time of ~4.9s, so the two arms are
 * far apart in both directions: whichever target wins is unambiguous from the spy that fired.
 */
function decision(
  { active = [], squared = false, nch = -1, ch = -1, spire = false, sTimer = -1, afterZ = [-1, -1] }: Case,
): 'hire' | 'fire' | 'neither' {
  const add = vi.fn()
  const remove = vi.fn()

  G.calcHeirloomBonusDecimal = (_s: string, _t: string, v: any) => v
  G.challengeActive = (what: string) => active.includes(what)
  G.dailyModifiers = {
    dysfunctional: { getMult: () => 1 },
    toxic: { getMult: () => 1 },
    plague: { getMult: () => 1 },
    bogged: { getMult: () => 1 },
  }
  G.disActiveSpireAT = () => false
  G.isActiveSpireAT = () => spire
  G.getNextGeneticistCost = () => 1 // cheap, so the Gen-% gate never masks a hire
  G.addGeneticist = add
  G.removeGeneticist = remove

  G.autoTrimpSettings = {
    ATGA2: { type: 'boolean', enabled: true },
    ATGA2timer: val(1), // base target 1s — well BELOW the breed time, so the fallback arm FIRES
    ATGA2gen: val(100),
    dATGA2Auto: { type: 'multitoggle', value: 0 }, // Manual: the auto block must not move `target`
    zATGA2timer: val(-1), ztATGA2timer: val(-1),
    ATGA2timerz: val(afterZ[0]), ATGA2timerzt: val(afterZ[1]),
    sATGA2timer: val(sTimer), dsATGA2timer: val(-1), dATGA2timer: val(-1), dhATGA2timer: val(-1),
    cATGA2timer: val(-1), chATGA2timer: val(ch), nchATGA2timer: val(nch),
  }

  G.game = {
    resources: {
      trimps: { employed: 0, potency: 0.0085, owned: 1e5, realMax: () => 1e6, getCurrentSend: () => 1e5 },
      food: { owned: 1e6 },
    },
    permaBoneBonuses: { multitasking: { owned: 0, mult: () => 0 } },
    upgrades: { Potency: { done: 0 } },
    buildings: { Nursery: { owned: 0 } },
    unlocks: { impCount: { Venimp: 0 } },
    portal: { Pheromones: { level: 0, modifier: 0.1 }, Agility: { level: 0, modifier: 0.1 } },
    singleRunBonuses: { quickTrimps: { owned: false } },
    talents: { hyperspeed: { purchased: false }, hyperspeed2: { purchased: false } },
    options: { menu: { gaFire: { enabled: 0 } } },
    challenges: {
      Toxicity: { stacks: 0, stackMult: 1.05 },
      Archaeology: { getStatMult: () => 1 },
      Quagmire: { getExhaustMult: () => 1 },
    },
    jobs: { Geneticist: { owned: 0, locked: false } },
    global: {
      challengeActive: active[0] ?? '',
      spireActive: false,
      brokenPlanet: false,
      voidBuff: '',
      world: 70,
      highestLevelCleared: 200,
      mapExtraBonus: '',
      lastSoldierSentAt: Date.now(),
      runningChallengeSquared: squared,
      dailyChallenge: {},
    },
  }

  breedtimer.ATGA2()
  if (add.mock.calls.length > 0) return 'hire'
  if (remove.mock.calls.length > 0) return 'fire'
  return 'neither'
}

describe('ATGA: T: C: Hard — the unsquared hard-challenge breed timer', () => {
  it('anti-false-green: the two arms really are distinguishable in this fixture', () => {
    // If BOTH of these are not what they say, every assertion below is reading noise rather than a
    // decision. `fire` is the base-timer arm (1s target, ~5s breed time) and `hire` is the 600s arm.
    expect(decision({ active: ['Electricity'] })).toBe('fire') // setting unset → base timer
    expect(decision({ active: ['Electricity'], nch: 600 })).toBe('hire') // setting set → it wins
  })

  it.each(['Electricity', 'Mapocalypse', 'Nom', 'Toxicity'])('applies during an unsquared %s run', (name) => {
    expect(decision({ active: [name], nch: 600 })).toBe('hire')
  })

  it('stands down the moment the challenge completes mid-run', () => {
    // The Prison (80) cleared: config.js:3616 blanks `challengeActive`, so nothing reports active any
    // more even though the portal is the same one. The target must fall back to the base timer.
    expect(decision({ active: [], nch: 600 })).toBe('fire')
  })

  it('does not fire during ANY unsquared challenge — only the hard ones', () => {
    // Guards against the row being widened to "a challenge is running" — Balance is not in the set.
    expect(decision({ active: ['Balance'], nch: 600 })).toBe('fire')
  })

  it('leaves the squared run to ATGA: T: C2: Hard', () => {
    // Same challenge, squared. The unsquared setting must not reach it…
    expect(decision({ active: ['Electricity'], squared: true, nch: 600 })).toBe('fire')
    // …and the squared setting still does, which is what makes the line above a boundary and not a
    // dead fixture.
    expect(decision({ active: ['Electricity'], squared: true, ch: 600 })).toBe('hire')
  })

  it('the squared setting does not reach an unsquared run either', () => {
    expect(decision({ active: ['Electricity'], squared: false, ch: 600 })).toBe('fire')
  })

  // The two remaining sentences of the setting's own tooltip, written as assertions rather than left
  // as prose. Both are pure ORDERING claims about breedtimer.ts:143-173, and ordering is exactly what
  // a mutant moves without touching a single predicate — so without these, a row swapped above or
  // below its neighbour passes the whole file.
  it('overrides Before/After Z, as the tooltip claims', () => {
    // After-Z alone at world 70: zone 60 reached, 1s timer → fire.
    expect(decision({ active: ['Electricity'], afterZ: [60, 1] })).toBe('fire')
    // …and the hard timer must beat it.
    expect(decision({ active: ['Electricity'], nch: 600, afterZ: [60, 1] })).toBe('hire')
  })

  it('is itself overridden by the Spire timer, as the tooltip claims', () => {
    // Anti-false-green: with no Spire active the Spire timer must NOT be what decided this.
    expect(decision({ active: ['Electricity'], nch: 600, spire: false, sTimer: 1 })).toBe('hire')
    // Spire active: its 1s timer is the last row to write `target`, so it wins and the arm flips.
    expect(decision({ active: ['Electricity'], nch: 600, spire: true, sTimer: 1 })).toBe('fire')
  })
})
