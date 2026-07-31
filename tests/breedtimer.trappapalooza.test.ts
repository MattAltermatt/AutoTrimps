// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

// #315 — ATGA MUST NOT HIRE WHILE THE GAME HAS STOPPED BREEDING.
//
// ⚠️ CORRECTED 2026-07-31 (#316 review). READ THIS BEFORE THE PARAGRAPH BELOW. Only the **Trapper**
// case here describes reachable play. ATGA2's sole dispatch is main-loop.ts:262, inside the
// `if (game.global.universe == 1)` block, and Trappapalooza is `blockU1: true` — so the Trappapalooza
// case exercises a state the game cannot produce, and this fixture pairs it with a THIRD impossible
// value: `jobs.Geneticist.locked: false`, which in U2 requires `brokenPlanet`, set only by
// planetBreaker() under `universe == 1`. The guard is correct and stays (see breedtimer.ts:215), but
// it is defence-in-depth, not a live repair, and the reachability is pinned as executable assertions
// in tests/breedtimer.atga-dispatch.test.ts rather than claimed in prose here.
//
// The lesson is the file's real value: #315 verified its PREMISE (breed() does stop for both) and
// never verified its REACHABILITY, and a test name is a claim. Kept parameterised over both names
// because the guard genuinely does stand down for both — that assertion is true, it is just not
// evidence about U1 play.
//
// `breed()` early-returns for BOTH Trapper and Trappapalooza (main.js:5575) and ATGA's guard named only
// Trapper. Under Trappapalooza that return is upstream of every quantity the servo models:
//
//   potencyMod is never applied            → the breed penalty ATGA is servoing against does not exist
//   lastBreedTime never accumulates        → zero Anticipation stacks (main.js:11683)
//   updateStoredGenInfo() never runs       → lowestGen stays at its -1 reset (main.js:5791-5797), and
//                                            startFight gates the health bonus on `lowestGen >= 0`
//                                            (main.js:11745), so 1.01^N never applies either
//
// So the Geneticists are pure cost — no health, no stacks, no breed effect — and ATGA hires up to 10 per
// tick, bounded only by the food cap, on a cycle Trappapalooza makes FAST (it sends 25% armies,
// main.js:5459). Strictly worse than not running.
//
// ASSERT THE BEHAVIOUR, NOT THE PREDICATE. The fixture drives `challengeActive()` and
// `game.global.challengeActive` consistently, exactly as the game does, so a guard spelled either way
// passes and a guard that names only Trapper fails. That is deliberate: the defect is "ATGA acts while
// breeding is off", not "the source contains a particular string".
const G = globalThis as any
let breedtimer: typeof import('../src/modules/breedtimer')

beforeAll(async () => {
  G.MODULES = {}
  G.Decimal = (await import('decimal.js')).default
  if (!document.getElementById('trimps')) {
    document.body.insertAdjacentHTML('beforeend', `<div id="trimps"><div class="row"></div></div><div id="trimpsFighting"></div>`)
  }
  breedtimer = await import('../src/modules/breedtimer')
})

const val = (v: number) => ({ type: 'value', value: v })

/** Run ATGA2() under the named challenge and report whether it moved any Geneticists. */
function acted(challenge: string): boolean {
  const add = vi.fn()
  const remove = vi.fn()

  G.calcHeirloomBonusDecimal = (_s: string, _t: string, v: any) => v
  // Both readers agree, as they do in the real game: challengeActive() consults multiChallenge then the
  // scalar (main.js:1753), and neither Trapper nor Trappapalooza is a multiChallenge member.
  G.challengeActive = (what: string) => what === challenge
  G.dailyModifiers = { dysfunctional: { getMult: () => 1 }, toxic: { getMult: () => 1 }, plague: { getMult: () => 1 }, bogged: { getMult: () => 1 } }
  G.disActiveSpireAT = () => false
  G.isActiveSpireAT = () => false
  G.getNextGeneticistCost = () => 1 // cheap, so the ATGA2gen food gate can never mask the decision
  G.addGeneticist = add
  G.removeGeneticist = remove

  G.autoTrimpSettings = {
    ATGA2: { type: 'boolean', enabled: true },
    // 600s target against a ~5s breed time: the hire arm, and by a wide margin.
    ATGA2timer: val(600),
    ATGA2gen: val(100),
    dATGA2Auto: { type: 'multitoggle', value: 0 },
    zATGA2timer: val(-1), ztATGA2timer: val(-1), ATGA2timerz: val(-1), ATGA2timerzt: val(-1),
    sATGA2timer: val(-1), dsATGA2timer: val(-1), dATGA2timer: val(-1), dhATGA2timer: val(-1),
    cATGA2timer: val(-1), chATGA2timer: val(-1), nchATGA2timer: val(-1),
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
    talents: { hyperspeed: { purchased: false }, hyperspeed2: { purchased: false }, patience: { purchased: false } },
    options: { menu: { gaFire: { enabled: 0 } } },
    challenges: { Toxicity: { stacks: 0, stackMult: 1.05 }, Archaeology: { getStatMult: () => 1 }, Quagmire: { getExhaustMult: () => 1 } },
    jobs: { Geneticist: { owned: 0, locked: false } },
    global: {
      challengeActive: challenge,
      spireActive: false, brokenPlanet: false, voidBuff: '', world: 70,
      highestLevelCleared: 200, mapExtraBonus: '', lastSoldierSentAt: Date.now(),
      runningChallengeSquared: false, dailyChallenge: {},
    },
  }

  breedtimer.ATGA2()
  return add.mock.calls.length > 0 || remove.mock.calls.length > 0
}

describe('ATGA stands down wherever breeding is stopped (#315)', () => {
  it('anti-false-green: this fixture DOES hire when nothing blocks it', () => {
    // Without this the two assertions below are satisfied by a servo that never hires in this fixture at
    // all — a green that proves the guard works when nothing was ever going to happen. Every other
    // assertion in the file is read against this one.
    expect(acted('')).toBe(true)
    expect(acted('Frigid')).toBe(true)
  })

  it.each(['Trapper', 'Trappapalooza'])('hires nothing during %s', (challenge) => {
    expect(acted(challenge)).toBe(false)
  })
})
