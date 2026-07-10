// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// Proof-net Phase 1 · L1b actuator spy-log for jobs.ts (the beachhead's actuator archetype, spec §11).
// These fns' RETURN is meaningless: they smuggle game.global.buyAmt/firing then call the native
// `buyJob` for pure side-effect (jobs.ts:41,48). So the CONTRACT is the ordered native-call log +
// the smuggled (buyAmt, firing) state AT CALL TIME — not the args (which are always title,true,true).
// The spy therefore snapshots game.global.buyAmt/firing on each buyJob call.

let jobs: typeof import('../src/modules/jobs')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  jobs = await import('../src/modules/jobs')
})

// Native-mutator spy: records the ordered buyJob calls WITH the smuggled decision state.
let buyJobCalls: { title: string; buyAmt: unknown; firing: boolean }[]
function installBuyJobSpy(opts: { decrementsEmployed?: boolean } = {}) {
  buyJobCalls = []
  ;(globalThis as any).buyJob = vi.fn((title: string) => {
    const g = (globalThis as any).game
    buyJobCalls.push({ title, buyAmt: g.global.buyAmt, firing: g.global.firing })
    // The real buyJob changes employed; safeFireJob's loop only terminates on that mutation.
    if (opts.decrementsEmployed) g.resources.trimps.employed += 1000
  })
}

beforeEach(() => {
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).preBuy2 = vi.fn(() => ({}))
  ;(globalThis as any).postBuy2 = vi.fn()
  ;(globalThis as any).prettify = (x: unknown) => String(x)
  ;(globalThis as any).canAffordJob = () => true
  installBuyJobSpy()
})

function gameWithWorkers(realMax: number, employed: number, over: Record<string, unknown> = {}) {
  return makeMinimalGame({
    global: { firing: false, buyAmt: 1, maxSplit: 1 },
    resources: { trimps: { realMax: () => realMax, employed } },
    ...over,
  })
}

describe('jobs.safeBuyJob — L1b actuator spy-log (hire/fire smuggle + native buyJob)', () => {
  it('hires: amount>0, affordable, free workers → buyJob(buyAmt=amount, firing=false)', () => {
    ;(globalThis as any).game = gameWithWorkers(1000, 0) // freeWorkers = ceil(500) - 0 = 500 > 0
    const ret = jobs.safeBuyJob('Farmer', 5)
    expect(ret).toBe(true)
    expect(buyJobCalls).toEqual([{ title: 'Farmer', buyAmt: 5, firing: false }])
  })

  it('falls back to Max when the exact amount is unaffordable but Max is', () => {
    let n = 0
    ;(globalThis as any).canAffordJob = () => n++ > 0 // first check false, second (after Max) true
    ;(globalThis as any).game = gameWithWorkers(1000, 0)
    jobs.safeBuyJob('Farmer', 5)
    expect(buyJobCalls).toEqual([{ title: 'Farmer', buyAmt: 'Max', firing: false }])
  })

  it('fires: amount<0 → firing=true, buyAmt=abs(amount), always buys', () => {
    ;(globalThis as any).game = gameWithWorkers(1000, 0)
    jobs.safeBuyJob('Farmer', -3)
    expect(buyJobCalls).toEqual([{ title: 'Farmer', buyAmt: 3, firing: true }])
  })

  it('is a no-op for amount==0 / NaN / Infinity (returns false, no buyJob)', () => {
    ;(globalThis as any).game = gameWithWorkers(1000, 0)
    expect(jobs.safeBuyJob('Farmer', 0)).toBe(false)
    expect(jobs.safeBuyJob('Farmer', NaN)).toBe(false)
    expect(jobs.safeBuyJob('Farmer', Infinity)).toBe(false)
    expect(buyJobCalls).toEqual([])
  })

  it('does not buy when unaffordable even at Max (but still returns true)', () => {
    ;(globalThis as any).canAffordJob = () => false
    ;(globalThis as any).game = gameWithWorkers(1000, 0)
    expect(jobs.safeBuyJob('Farmer', 5)).toBe(true)
    expect(buyJobCalls).toEqual([])
  })

  it('does not hire when there are no free workers (employed >= half realMax)', () => {
    ;(globalThis as any).game = gameWithWorkers(1000, 500) // freeWorkers = 500 - 500 = 0
    jobs.safeBuyJob('Farmer', 5)
    expect(buyJobCalls).toEqual([])
  })
})

describe('jobs.safeFireJob — L1b actuator spy-log (doubling fire loop)', () => {
  it('fires with firing=true and doubles buyAmt until employed changes; returns x/2', () => {
    ;(globalThis as any).game = gameWithWorkers(1000, 0, { jobs: { Farmer: { owned: 50 } } })
    installBuyJobSpy({ decrementsEmployed: true }) // first buyJob bumps employed → loop exits
    const ret = jobs.safeFireJob('Farmer')
    // x starts 1: buyAmt=1, buyJob fires (employed now changes), x*=2 → 2; loop condition now false.
    expect(buyJobCalls).toEqual([{ title: 'Farmer', buyAmt: 1, firing: true }])
    expect(ret).toBe(1) // x/2 = 2/2
  })

  it('returns 0 immediately when the job is unowned', () => {
    ;(globalThis as any).game = gameWithWorkers(1000, 0, { jobs: { Farmer: { owned: 0 } } })
    expect(jobs.safeFireJob('Farmer')).toBe(0)
    expect(buyJobCalls).toEqual([])
  })
})

// buyJobs orchestrator: the Watch scientist-override (jobs.ts:118) is already L0-covered by the
// 03-challenge-watch save, so L1 here targets the branches the seeded U1 corpus (world 4+) CANNOT
// reach — the world==1 opening gate and the realMax<=3e5 breeding-gate sub-branch (spec §8: L1
// depth covers the cold branches L0 breadth can't).
describe('jobs.buyJobs — L1b actuator spy-log (cold-on-corpus branches)', () => {
  beforeEach(() => {
    // ratio settings read at buyJobs top (lines 84-88); the rest of the fixture is per-test.
    ;(globalThis as any).autoTrimpSettings = {
      FarmerRatio: { type: 'value', value: 1 },
      LumberjackRatio: { type: 'value', value: 1 },
      MinerRatio: { type: 'value', value: 1 },
    }
    ;(globalThis as any).challengeActive = () => false
    ;(globalThis as any).breedFire = false
    ;(globalThis as any).scienceNeeded = 0
  })

  it('world==1 opening gate: hires one Farmer then one Miner (Farmer==Lumberjack==0)', () => {
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 1, totalHeliumEarned: 0, firing: false, buyAmt: 1, maxSplit: 1 },
      resources: {
        trimps: { owned: 100, realMax: () => 1000, employed: 0 },
        food: { owned: 100 },
      },
      jobs: {
        Farmer: { owned: 0 },
        Lumberjack: { owned: 0, locked: false },
        Miner: { owned: 0, locked: false },
      },
    })
    jobs.buyJobs()
    expect(buyJobCalls).toEqual([
      { title: 'Farmer', buyAmt: 1, firing: false },
      { title: 'Miner', buyAmt: 1, firing: false },
    ])
  })

  it('breeding-gate (realMax<=3e5, breeding>33%): hires Miner, Farmer, Lumberjack then returns', () => {
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 5, totalHeliumEarned: 1e9, challengeActive: '', firing: false, buyAmt: 1, maxSplit: 1 },
      resources: {
        trimps: { owned: 500, realMax: () => 1000, employed: 0 }, // breeding=500 > 330; owned<900
        food: { owned: 100 },
      },
      jobs: {
        Farmer: { owned: 5, locked: false }, // !=0 → skips the line-111 gate; <10 → skips line-113
        Lumberjack: { owned: 0, locked: false },
        Miner: { owned: 0, locked: false },
        Scientist: { owned: 0, locked: false },
      },
    })
    jobs.buyJobs()
    expect(buyJobCalls).toEqual([
      { title: 'Miner', buyAmt: 1, firing: false },
      { title: 'Farmer', buyAmt: 1, firing: false },
      { title: 'Lumberjack', buyAmt: 1, firing: false },
    ])
  })
})

// RbuyJobs (radon/U2 actuator) is ENTIRELY cold on the U1 corpus — L0 cannot reach it, so this L1
// spy-log is its only net. It carries the live #32 marker (jobs.ts:488): the misplaced paren makes
// freeWorkers = ceil(realMax/2) - employed, never capped by `owned`. This fixture deliberately sets
// owned (100) < realMax/2 (500) so the bug is LIVE — pinning the CURRENT (buggy) buy amounts.
// Task 4 flips these with `// fix: #32` when the paren is corrected.
describe('jobs.RbuyJobs — L1b actuator spy-log (radon; hosts the #32 freeWorkers marker)', () => {
  beforeEach(() => {
    ;(globalThis as any).autoTrimpSettings = {
      RFarmerRatio: { type: 'value', value: 1 },
      RLumberjackRatio: { type: 'value', value: 1 },
      RMinerRatio: { type: 'value', value: 1 },
    }
    ;(globalThis as any).getMaxAffordable = () => 0 // no Explorers/Meteorologists
    // focus-farming flags off → allIn = "" → the normal desiredRatios path
    for (const f of ['Rshouldtimefarm', 'Rdshouldtimefarm', 'Rshouldsmithyfarm', 'Rshouldtributefarm', 'Rshouldshipfarm', 'Rshouldhypofarm']) {
      ;(globalThis as any)[f] = false
    }
  })

  it('#32 LIVE: owned(100) < realMax/2(500) → freeWorkers uses the uncapped 500 (buggy)', () => {
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
    // freeWorkers(488, buggy) = 500; +sum(currentworkers=40) = 540; scientistMod=4 (Farmer<100, world<50);
    // desiredRatios=[4,4,4,1] totalFraction=13; desiredWorkers = floor(540*r/13 - current).
    expect(buyJobCalls).toEqual([
      { title: 'Farmer', buyAmt: 156, firing: false },
      { title: 'Lumberjack', buyAmt: 156, firing: false },
      { title: 'Miner', buyAmt: 156, firing: false },
      { title: 'Scientist', buyAmt: 31, firing: false },
    ])
  })
})

// The R* single-worker helpers are line-for-line mirrors of their U1 siblings; one equivalence
// assertion guards the mirror from drifting during the refactor.
describe('jobs.RsafeBuyJob / RsafeFireJob — mirror equivalence with safe* siblings', () => {
  it('RsafeBuyJob hires identically to safeBuyJob', () => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = makeMinimalGame({
      global: { firing: false, buyAmt: 1, maxSplit: 1 },
      resources: { trimps: { realMax: () => 1000, employed: 0 } },
    })
    jobs.RsafeBuyJob('Farmer', 5)
    expect(buyJobCalls).toEqual([{ title: 'Farmer', buyAmt: 5, firing: false }])
  })

  it('RsafeFireJob returns 0 immediately on an unowned job', () => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = makeMinimalGame({
      global: { firing: false, buyAmt: 1 },
      resources: { trimps: { realMax: () => 1000, employed: 0 } },
      jobs: { Farmer: { owned: 0 } },
    })
    expect(jobs.RsafeFireJob('Farmer')).toBe(0)
    expect(buyJobCalls).toEqual([])
  })
})

describe('jobs.RquestbuyJobs — L1b actuator spy-log (radon quest jobs)', () => {
  it('farmer-quest (questcheck==10): fires nothing owned, buys the farmer allotment', () => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).questcheck = () => 10
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 6, firing: false, buyAmt: 1 },
      resources: { trimps: { owned: 0, realMax: () => 1000, employed: 0 } },
      jobs: {
        Farmer: { owned: 0, locked: false },
        Lumberjack: { owned: 0, locked: false },
        Miner: { owned: 0, locked: false },
        Scientist: { owned: 0, locked: false },
        Explorer: { owned: 0, locked: false },
      },
    })
    jobs.RquestbuyJobs()
    // totalDistributableWorkers=(500+0)/5=100 → *5=500 (q==10 arm) → −farmerkeep(5)=495; farmer-only
    // arm fires empty Lumberjack/Miner (owned 0 → no-op) then RsafeBuyJob('Farmer', 495).
    expect(buyJobCalls).toEqual([{ title: 'Farmer', buyAmt: 495, firing: false }])
  })
})
