// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

// #119 — dATGA2Auto mode 1 is labelled "ATGA: Auto No Spire" and fired ONLY INSIDE A SPIRE.
//
//   breedtimer.ts:163   dATGA2Auto == 1 && disActiveSpireAT() && challengeActive == "Daily"
//   other.ts:92         disActiveSpireAT() === (challengeActive == 'Daily' && game.global.spireActive && …)
//
// so the guard was true exactly when a Daily Spire IS active — the precise inverse of the option's own
// name. The fix negates it. Mode 2 ("Auto Dailies", the default) is unconditional on a Daily: unchanged.
//
// WHY A HAND-BUILT TEST: the L0 proof net is BLIND here. `ATGA2` defaults to false, so every corpus save
// has ATGA off and baseline-zero is vacuous for this code — citing its green would be the exact
// reach-vs-sensitivity mistake recorded in #98. The evidence has to be made, not borrowed.
//
// THE OBSERVABLE: `dailyModifiers.plague.getMult` is called ONLY from inside the auto block
// (breedtimer.ts:164). Spying on it answers precisely one question — did the block run? — without
// having to drive ATGA2() all the way to a hire/fire decision.
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

/**
 * Drive ATGA2() on a PLAGUE Daily with dATGA2Auto = `mode`, with a Daily Spire active or not, and
 * report whether the auto-timer block executed.
 */
function autoBlockRan(mode: number, spireActive: boolean): boolean {
  const plagueGetMult = vi.fn(() => 1)

  G.calcHeirloomBonusDecimal = (_s: string, _t: string, v: any) => v
  G.challengeActive = () => false
  G.dailyModifiers = {
    dysfunctional: { getMult: () => 1 },
    toxic: { getMult: () => 1 },
    plague: { getMult: plagueGetMult },
    bogged: { getMult: () => 1 },
  }
  // The lever under test. Mirrors other.ts:92 — true iff a Daily Spire is active.
  G.disActiveSpireAT = () => spireActive
  G.isActiveSpireAT = () => false
  G.getNextGeneticistCost = () => Infinity // never actually hire; we only care whether the block ran
  G.addGeneticist = () => {}
  G.removeGeneticist = () => {}

  G.autoTrimpSettings = {
    ATGA2: { type: 'boolean', enabled: true },
    ATGA2timer: val(30), // a positive base timer — the outer gate (#115) is CORRECT and stays shut otherwise
    ATGA2gen: val(1),
    dATGA2Auto: { type: 'multitoggle', value: mode },
    // every other override off, so only the auto block can move `target`
    zATGA2timer: val(-1), ztATGA2timer: val(-1), ATGA2timerz: val(-1), ATGA2timerzt: val(-1),
    sATGA2timer: val(-1), dsATGA2timer: val(-1), dATGA2timer: val(-1), dhATGA2timer: val(-1),
    cATGA2timer: val(-1), chATGA2timer: val(-1),
  }

  G.game = {
    resources: {
      trimps: { employed: 100, potency: 0.0085, owned: 1000, realMax: () => 1e6, getCurrentSend: () => 0 },
      food: { owned: 0 },
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
      challengeActive: 'Daily',
      spireActive: spireActive,
      brokenPlanet: false,
      voidBuff: '',
      world: 200,
      highestLevelCleared: 400,
      mapExtraBonus: '',
      lastSoldierSentAt: 0,
      runningChallengeSquared: false,
      // a PLAGUE daily — the condition the auto block requires
      dailyChallenge: { plague: { strength: 10 } },
    },
  }

  breedtimer.ATGA2()
  return plagueGetMult.mock.calls.length > 0
}

describe('#119: "Auto No Spire" stands down inside a Spire, instead of only running there', () => {
  it('anti-false-green: the harness really reaches the auto block at all', () => {
    // Mode 2 ("Auto Dailies") is unconditional on a Bogged/Plague Daily. If THIS is false, the fixture
    // never gets near the code under test and every assertion below is vacuous.
    expect(autoBlockRan(2, false)).toBe(true)
    expect(autoBlockRan(2, true)).toBe(true) // …and mode 2 is unaffected by the Spire, before and after
  })

  it('mode 1 ("Auto No Spire") RUNS when no Daily Spire is active', () => {
    // Before the fix this was FALSE — the option did nothing in the one situation its name describes.
    expect(autoBlockRan(1, false)).toBe(true)
  })

  it('mode 1 ("Auto No Spire") STANDS DOWN inside a Daily Spire', () => {
    // Before the fix this was TRUE — the option fired ONLY here, the exact inverse of its label.
    expect(autoBlockRan(1, true)).toBe(false)
  })

  it('the option is not simply dead — it discriminates on the Spire', () => {
    // The single assertion that must fail on the pre-#119 code whichever way the polarity is read.
    expect(autoBlockRan(1, false)).not.toBe(autoBlockRan(1, true))
  })
})
