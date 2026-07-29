// @vitest-environment jsdom
//
// #201 / #202 / #215 / #217 — the jobs allocator's NaN seam, its locked-job hires, and the Watch arm.
//
// The unifying defect in #201/#202 is that a NON-FINITE ratio does not stay non-finite. AT's settings
// layer stores `parseNum('')` === NaN with no validation (settings-engine.ts `autoSetValue`), and
// JSON.stringify persists NaN as `null`, which parseFloat reads back as NaN — so a single blank ratio
// box is a permanent state, not a transient one. Both allocators then LAUNDER that NaN into a large
// finite number, each by defeating a comparison rather than by any explicit conversion:
//
//   U1 ratiobuy   `toBuy <= canBuy ? toBuy : canBuy`   NaN loses, so the CAP becomes the ORDER
//   U2 RbuyJobs   `> 0` skip, then `<= 0` skip          NaN loses BOTH, so it reaches native buyJob
//
// That is why neither is caught by `safeBuyJob`'s `Number.isFinite` refusal, which sits right there in
// the same file: U1 never passes it a NaN (it passes the laundered cap), and U2 never calls it at all.
//
// EVERY test here drives the real orchestrator — `buyJobs()` / `RbuyJobs()` — rather than the helper
// under test. Asserting on `safeBuyJob(NaN)` directly would pass against the unfixed build, because
// the bug is precisely that the unfixed build never hands it a NaN.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

let jobs: typeof import('../src/modules/jobs')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  jobs = await import('../src/modules/jobs')
})

let buyJobCalls: { title: string; buyAmt: unknown; firing: boolean }[]

beforeEach(() => {
  buyJobCalls = []
  ;(globalThis as any).buyJob = vi.fn((title: string) => {
    const g = (globalThis as any).game
    buyJobCalls.push({ title, buyAmt: g.global.buyAmt, firing: g.global.firing })
  })
  ;(globalThis as any).preBuy2 = vi.fn(() => ({}))
  ;(globalThis as any).postBuy2 = vi.fn()
  ;(globalThis as any).prettify = (x: unknown) => String(x)
  ;(globalThis as any).canAffordJob = () => true
  ;(globalThis as any).challengeActive = () => false
  ;(globalThis as any).breedFire = false
  ;(globalThis as any).scienceNeeded = 0
  ;(globalThis as any).getMaxAffordable = () => 0
  for (const f of ['Rshouldtimefarm', 'Rdshouldtimefarm', 'Rshouldsmithyfarm', 'Rshouldtributefarm', 'Rshouldshipfarm', 'Rshouldhypofarm']) {
    ;(globalThis as any)[f] = false
  }
})

/** Any buyAmt the allocator is about to hand to native buyJob that is not a finite number. */
const nonFinite = () =>
  buyJobCalls.filter((c) => typeof c.buyAmt !== 'number' || !Number.isFinite(c.buyAmt as number))

// ---------------------------------------------------------------------------------------------
// #202 — U1
// ---------------------------------------------------------------------------------------------

/**
 * A colony at 100% of realMax, so buyJobs falls past the non-Watch early return and reaches the
 * ratiobuy allocator. `ratio` is what the Farmer box holds — NaN models a blank one.
 */
function u1RatioTick(farmerRatio: number, lumberjackRatio = 1, minerRatio = 1) {
  ;(globalThis as any).autoTrimpSettings = {
    FarmerRatio: { type: 'value', value: farmerRatio },
    LumberjackRatio: { type: 'value', value: lumberjackRatio },
    MinerRatio: { type: 'value', value: minerRatio },
    MaxScientists: { type: 'value', value: 0 }, // silence the scientist arm; not what these pin
    MaxTrainers: { type: 'value', value: 0 },
    MaxExplorers: { type: 'value', value: 0 },
    buynojobsc: { type: 'boolean', value: false },
    ScientistPercent: { type: 'value', value: -1 },
  }
  ;(globalThis as any).game = makeMinimalGame({
    global: { world: 30, totalHeliumEarned: 0, firing: false, buyAmt: 1, maxSplit: 1, challengeActive: '', runningChallengeSquared: false },
    resources: {
      trimps: { owned: 100000, realMax: () => 100000, employed: 30000 },
      food: { owned: 1e12 },
    },
    jobs: {
      Farmer: { owned: 10000, locked: false, cost: { food: 5 } },
      Lumberjack: { owned: 10000, locked: false, cost: { food: 5 } },
      Miner: { owned: 10000, locked: false, cost: { food: 20 } },
      Scientist: { owned: 0, locked: false, cost: { food: 100 } },
      Trainer: { owned: 0, locked: true },
      Explorer: { owned: 0, locked: true },
      Magmamancer: { owned: 0, locked: true },
    },
  })
  jobs.buyJobs()
  return buyJobCalls
}

describe('#202 — a blank U1 ratio box must not turn ratiobuy’s CAP into the purchase order', () => {
  it('anti-false-green: with three real ratios the allocator DOES hire', () => {
    const calls = u1RatioTick(1)
    // Without this, every assertion below is satisfied by a harness that never reaches ratiobuy at
    // all — which is exactly how five nets in Session 4 passed against a broken build.
    expect(calls.length).toBeGreaterThan(0)
    expect(nonFinite()).toEqual([])
  })

  it('with FarmerRatio blank, no ratio worker is hired and nothing non-finite reaches buyJob', () => {
    const calls = u1RatioTick(NaN)
    // `toBuy` is NaN for all three (totalRatio is NaN), so Math.min keeps it NaN and safeBuyJob's
    // line-80 refusal declines each one. BEFORE the fix: `NaN <= canBuy` was false, so `amount`
    // became canBuy — the entire unemployed pool — and Farmer swallowed every free workspace in one
    // tick while Lumberjack and Miner were then declined for want of slots.
    expect(nonFinite()).toEqual([])
    expect(calls, `ratiobuy hired on a NaN ratio: ${JSON.stringify(calls)}`).toEqual([])
  })

  it('a finite demand passes through the cap UNCHANGED — the min picks toBuy, not canBuy', () => {
    // Aimed at `Math.max`, not at the bug. Swapping min for max leaves every NaN assertion above
    // satisfied (NaN loses to max as well) while silently ordering the whole unemployed pool on
    // every ordinary tick, so the NaN tests alone cannot tell the two apart.
    //
    // freeWorkers = ceil(100000/2) - 30000 = 20000; TDW = 20000 + 10000*3 = 50000.
    // Farmer at 99:1:1 → floor(99/101 * 50000) - 10000 = 39009, against canBuy = 70000.
    // min → 39009 (correct). max → 70000. The two differ by the entire breeding pool.
    const calls = u1RatioTick(99, 1, 1)
    const farmer = calls.find((c) => c.title === 'Farmer')
    expect(farmer).toBeDefined()
    expect(farmer!.buyAmt).toBe(39009)
  })

  it('documents WHY the finite case above is the only one available: the cap cannot bind', () => {
    // Worth recording, because it explains why there is no "clamped to the pool" test here and stops
    // the next person adding one and quietly weakening the fixture to make it pass.
    //
    // toBuy - canBuy reduces to `ceil(realMax/2) + (F+L+M) - owned`, so the cap binds only when the
    // three ratio jobs already exceed HALF the colony cap. But `employed` includes them, so that same
    // condition drives freeWorkerSlots() = ceil(realMax/2) - employed negative — and safeBuyJob
    // refuses on `freeWorkers > 0` before the amount is ever used. Every state where canBuy is the
    // smaller operand is a state where nothing is hired at all.
    //
    // Consequence: `canBuy` is not a functioning cap in any consistent game state; the real limits
    // are safeBuyJob's `freeWorkers > 0` and canAffordJob. Its ONE observable effect was the
    // inversion this fix removes — which is a fair description of how the bug survived so long.
    const realMax = 100000
    const owned = realMax // ratiobuy is only reached at >= 90% of realMax
    for (const flm of [10000, 30000, 45000, 60000]) {
      const employed = flm * 3
      const freeWorkers = Math.ceil(realMax / 2) - employed
      const capBinds = Math.ceil(realMax / 2) + flm * 3 - owned > 0
      if (capBinds) expect(freeWorkers).toBeLessThanOrEqual(0)
    }
  })

  it('ratios summing to ZERO make toBuy INFINITE, not NaN — and that must be refused too', () => {
    // Found by mutation-testing, and it broke the first version of the fix. `Math.min` propagates NaN
    // but NOT Infinity: Math.min(Infinity, canBuy) is canBuy, which is the original bug's outcome
    // exactly. This is the ONE ratio expression that divides by totalRatio rather than by a constant,
    // so 1 / -1 / 0 sums to zero with a positive numerator and gives `1/0` = Infinity.
    //
    // Reachable as ordinary user input: `FarmerRatio` is a `value` setting and autoSetValue validates
    // nothing, so a typed "-1" is stored and persisted verbatim.
    const calls = u1RatioTick(1, -1, 0)
    expect(nonFinite()).toEqual([])
    expect(calls, `an infinite demand was hired: ${JSON.stringify(calls)}`).toEqual([])
  })

  it('all three ratios at 0 is the same defect with no invalid input at all (0/0)', () => {
    // Every box holds a perfectly valid number. totalRatio is 0, so `jobratio / totalRatio` is `0/0`
    // → NaN on the very same line — no blank box, no typo, nothing for validation to reject.
    const calls = u1RatioTick(0, 0, 0)
    expect(nonFinite()).toEqual([])
    expect(calls).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
// #201 — U2
// ---------------------------------------------------------------------------------------------

function u2RatioTick(rFarmerRatio: number) {
  ;(globalThis as any).autoTrimpSettings = {
    RFarmerRatio: { type: 'value', value: rFarmerRatio },
    RLumberjackRatio: { type: 'value', value: 1 },
    RMinerRatio: { type: 'value', value: 1 },
  }
  ;(globalThis as any).game = makeMinimalGame({
    global: { world: 10, firing: false, buyAmt: 1, maxSplit: 1 },
    resources: {
      trimps: { owned: 100, realMax: () => 1000, employed: 0 },
      food: { owned: 1e9 },
    },
    jobs: {
      Farmer: { owned: 10, locked: false, cost: { food: 1 } },
      Lumberjack: { owned: 10, locked: false, cost: { food: 1 } },
      Miner: { owned: 10, locked: false, cost: { food: 1 } },
      Scientist: { owned: 10, locked: false, cost: { food: 1 } },
      Explorer: { owned: 0, locked: true },
      Meteorologist: { owned: 0, locked: true, cost: { food: [1, 1.1] } },
      Worshipper: { owned: 0, locked: true, getCost: () => 1e9 },
    },
  })
  jobs.RbuyJobs()
  return buyJobCalls
}

describe('#201 — RbuyJobs must never hand a non-finite buyAmt to native buyJob', () => {
  it('anti-false-green: with three real ratios RbuyJobs DOES reach buyJob', () => {
    expect(u2RatioTick(1).length).toBeGreaterThan(0)
    expect(nonFinite()).toEqual([])
  })

  it('an INFINITE ratio is refused too — the guard is isFinite, not !isNaN', () => {
    // Aimed squarely at the near-miss repair this repo has already shipped twice (#237): `!isNaN(x)`
    // reads like a finiteness check and accepts ±Infinity, which JSON.stringify also writes as null.
    // parseFloat('Infinity') is Infinity, so the settings layer can deliver one.
    const calls = u2RatioTick(Infinity)
    expect(nonFinite()).toEqual([])
    expect(calls).toEqual([])
  })

  it('with RFarmerRatio blank, the allocator bails instead of buying eight times', () => {
    const calls = u2RatioTick(NaN)
    // BEFORE the fix every one of the four ratio workers fell through BOTH loop filters (`NaN > 0`
    // and `NaN <= 0` are each false), so this was 8 native buyJob calls per tick with buyAmt NaN.
    // Native buyJob has no defence — it was never supposed to need one — and it runs
    // `food.owned -= 5 * NaN` and `jobs[x].owned += NaN`, which the autosave then persists as null.
    expect(nonFinite(), `non-finite buyAmt reached native buyJob: ${JSON.stringify(nonFinite())}`).toEqual([])
    expect(calls).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
// #215 — locked jobs
// ---------------------------------------------------------------------------------------------

/**
 * The early-game F/L/M trickle: a veteran (totalHeliumEarned > 5000) on a fresh post-portal run, so
 * the world-1 bootstrap arm is skipped and execution reaches the trickle with jobs still locked.
 */
function trickleTick(locked: { Miner: boolean; Lumberjack: boolean; Farmer: boolean }) {
  ;(globalThis as any).autoTrimpSettings = {
    FarmerRatio: { type: 'value', value: 1 },
    LumberjackRatio: { type: 'value', value: 1 },
    MinerRatio: { type: 'value', value: 1 },
    MaxScientists: { type: 'value', value: 0 },
    ScientistPercent: { type: 'value', value: -1 },
    buynojobsc: { type: 'boolean', value: false },
  }
  ;(globalThis as any).game = makeMinimalGame({
    // world 2, not 1: p18-z2-balance-stall proves the trickle has NO world gate — the finding's
    // "zone 1 only" framing was wrong, and a world-1 fixture would have tested the bootstrap arm.
    global: { world: 2, totalHeliumEarned: 8286, firing: false, buyAmt: 1, maxSplit: 1, challengeActive: '', runningChallengeSquared: false },
    resources: {
      trimps: { owned: 300, realMax: () => 452, employed: 40 },
      food: { owned: 500 },
    },
    jobs: {
      Farmer: { owned: 20, locked: locked.Farmer, cost: { food: 5 } },
      Lumberjack: { owned: 20, locked: locked.Lumberjack, cost: { food: 5 } },
      Miner: { owned: 0, locked: locked.Miner, cost: { food: 20 } },
      Scientist: { owned: 10, locked: false, cost: { food: 100 } },
      Magmamancer: { owned: 0, locked: true },
    },
  })
  jobs.buyJobs()
  return buyJobCalls.map((c) => c.title)
}

describe('#215 — the trickle must not hire a job the player has not unlocked', () => {
  it('anti-false-green: with everything unlocked the trickle hires all three', () => {
    const hired = trickleTick({ Miner: false, Lumberjack: false, Farmer: false })
    // Proves the fixture actually REACHES the trickle. Without it, "no locked hire" is satisfied by
    // a fixture that hires nothing for some unrelated reason.
    expect(hired).toEqual(['Miner', 'Farmer', 'Lumberjack'])
  })

  it('a locked Miner is not hired, and the unlocked siblings still are', () => {
    const hired = trickleTick({ Miner: true, Lumberjack: false, Farmer: false })
    // Both halves matter: skipping the locked one is the fix, and still hiring the others is what
    // stops the fix from being an accidental "hire nothing" regression.
    expect(hired).not.toContain('Miner')
    expect(hired).toEqual(['Farmer', 'Lumberjack'])
  })

  it('every job locked → nothing is hired at all', () => {
    expect(trickleTick({ Miner: true, Lumberjack: true, Farmer: true })).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
// #217 — the Watch scientist arm
// ---------------------------------------------------------------------------------------------

/**
 * A Watch run under 90% of realMax, which is the gate at the top of the Watch arm. `sci` is the
 * current Scientist count; the arm's target is totalDistributableWorkers / 10.
 */
function watchTick(sci: number) {
  ;(globalThis as any).challengeActive = (what?: string) => what === 'Watch'
  ;(globalThis as any).autoTrimpSettings = {
    FarmerRatio: { type: 'value', value: 1 },
    LumberjackRatio: { type: 'value', value: 1 },
    MinerRatio: { type: 'value', value: 1 },
    MaxScientists: { type: 'value', value: -1 },
    MaxTrainers: { type: 'value', value: 0 },
    MaxExplorers: { type: 'value', value: 0 },
    ScientistPercent: { type: 'value', value: -1 },
    buynojobsc: { type: 'boolean', value: false },
  }
  ;(globalThis as any).MODULES.jobs = { ...(globalThis as any).MODULES.jobs, scientistRatio2: 10 }
  ;(globalThis as any).game = makeMinimalGame({
    global: { world: 180, totalHeliumEarned: 1e6, firing: false, buyAmt: 1, maxSplit: 1, challengeActive: 'Watch', runningChallengeSquared: false },
    resources: {
      // 50% of realMax: under the 0.9 gate, over the 0.1 one.
      trimps: { owned: 5000, realMax: () => 10000, employed: 1000 },
      food: { owned: 1e12 },
    },
    jobs: {
      Farmer: { owned: 300, locked: false, cost: { food: 5 } },
      Lumberjack: { owned: 300, locked: false, cost: { food: 5 } },
      Miner: { owned: 300, locked: false, cost: { food: 20 } },
      Scientist: { owned: sci, locked: false, cost: { food: 100 } },
      Trainer: { owned: 0, locked: true },
      Explorer: { owned: 0, locked: true },
      Magmamancer: { owned: 0, locked: true },
    },
  })
  jobs.buyJobs()
  return buyJobCalls
}

describe('#217 — the Watch scientist arm subtracted the count twice', () => {
  it('hires in the band the old gate could not see (target/2 <= owned < target)', () => {
    // freeWorkers = ceil(10000/2) - 1000 = 4000; TDW = 4000 + 300*3 = 4900; target = 489.
    // The old gate was `owned < floor(target - owned)`, i.e. `2*owned < target` — false at 300, so
    // the arm hit `else return` and bailed out of the ENTIRE rest of buyJobs. The corrected gate is
    // `target - owned > 0`, true at 300.
    const sciBuys = watchTick(300).filter((c) => c.title === 'Scientist')
    expect(sciBuys.length).toBeGreaterThan(0)
    // 489, not the 490 the arithmetic suggests: the target is `(scientistRatio / totalRatio) * TDW`
    // with scientistRatio itself `totalRatio / 10`, so it evaluates ((3/10)/3) * 4900 — and
    // (3/10)/3 is 0.09999999999999999, giving 489.99999999999994 before the floor. That quirk is
    // faithful to the main arm, which computes the target the same way, so it is pinned rather than
    // corrected: changing it would silently shift scientist counts on every U1 tick.
    expect(sciBuys[0].buyAmt).toBe(189)
    // Not a FIRE. The double-subtract produced 489 - 300 - 300 = -111, which safeBuyJob turns into
    // `firing = true` — the arm would have SHED scientists had the gate ever let it through.
    expect(sciBuys[0].firing).toBe(false)
  })

  it('inside the OLD dead band, the rest of buyJobs now runs instead of being skipped', () => {
    // Renamed after review: this fixture is `owned < target` — the band the old gate could not see
    // (`2*owned < target` was false at 300 against a target of 489) — NOT the steady state. It proves
    // the dead band is closed, which is what #217 turns on. The steady state is the test below, and
    // conflating the two is exactly the overclaiming-test-name failure this repo keeps finding.
    const titles = watchTick(300).map((c) => c.title)
    expect(titles.filter((t) => t !== 'Scientist').length).toBeGreaterThan(0)
  })

  it('at or above target it returns rather than over-hiring', () => {
    const sciBuys = watchTick(600).filter((c) => c.title === 'Scientist')
    expect(sciBuys).toEqual([])
  })

  // WHY THE `else return` IS LEFT IN PLACE — AND THE ASYMMETRY THAT IS NOT #217's TO FIX.
  //
  // Review flagged that at the steady state (owned >= target) the corrected gate still returns, bailing
  // out of the rest of buyJobs. I first wrote this test asserting the branches were SYMMETRIC — that
  // the general branch bails identically while breeding — and the test failed, which is the only
  // reason the claim did not ship as a comment. They are not symmetric:
  //
  //   Watch,     breeding, owned >= target  ->  hires NOTHING, returns
  //   non-Watch, breeding                   ->  hires the F/L/M trickle, THEN returns
  //
  // Both do return before Trainers/Explorers/ratiobuy/Magmamancers, so nothing is stranded that the
  // general branch reaches. But the Watch arm has no trickle at all, so during a Watch run AT hires
  // nothing whatsoever while breeding once scientists are at target.
  //
  // That asymmetry is PRE-EXISTING and independent of #217: on the old code the same state took the
  // same `else return` (at owned 600 against target 489, `600 < floor(489-600)` is also false). #217
  // is the double-subtract, and narrowing the dead band from `target/2 <= owned` to `owned >= target`
  // is the whole of its fix. Adding a trickle to the Watch arm would be a behaviour change nobody
  // asked for, in a challenge no fixture reaches — filed instead of smuggled in here.
  it('Watch hires nothing while breeding at target, whereas the general branch still trickles', () => {
    const watchTitles = watchTick(600).map((c) => c.title)
    expect(watchTitles).toEqual([])

    // Same colony state, Watch OFF — the general branch's trickle fires. This is the assertion that
    // falsified the "symmetric" story, so it is pinned rather than described.
    ;(globalThis as any).challengeActive = () => false
    ;(globalThis as any).game.global.challengeActive = ''
    buyJobCalls = []
    jobs.buyJobs()
    expect(buyJobCalls.map((c) => c.title)).toEqual(['Miner', 'Farmer', 'Lumberjack'])
  })

  it('once the colony FILLS, the Watch gate is bypassed and the rest of buyJobs does run', () => {
    // The other half of the symmetry argument, and the assertion that actually retires the stranding
    // concern: the allocator is not unreachable under Watch, it is reachable at the point it was
    // always meant to be. At >= 90% of realMax the Watch block's outer gate is false, so execution
    // falls past it entirely to the main scientist arm, Trainers, Explorers and ratiobuy.
    watchTick(600)
    const g = (globalThis as any).game
    g.resources.trimps.owned = g.resources.trimps.realMax() // 100% — over the 0.9 gate
    buyJobCalls = []
    jobs.buyJobs()
    expect(buyJobCalls.map((c) => c.title).filter((t) => t !== 'Scientist').length).toBeGreaterThan(0)
  })

  it('a locked Scientist is never hired', () => {
    const calls = watchTick(300)
    expect(calls.length).toBeGreaterThan(0) // the control: this fixture does reach the arm
    ;(globalThis as any).game.jobs.Scientist.locked = true
    buyJobCalls = []
    jobs.buyJobs()
    expect(buyJobCalls.filter((c) => c.title === 'Scientist')).toEqual([])
  })
})
