// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// Proof-net Phase 1 · L1a branch-adequate golden for jobs.ts (issue #28 char → #proof-net beachhead).
// workerRatios / RworkerRatios are pure decisions → setPageSetting actuators: each picks a
// [Farmer, Lumberjack, Miner] ratio from game state and writes the three ratio settings. We spy-log
// via the settings store (setPageSetting writes autoTrimpSettings[key].value), pinning the FULL
// branch table (spec §8 DEPTH: every balance-sensitive branch gets an edge fixture) so the
// idiomatic refactor is provably behaviour-preserving on every arm.

let workerRatios: () => void
let RworkerRatios: () => void

beforeAll(async () => {
  // jobs.ts registers MODULES["jobs"] + ratio arrays at import time; seed MODULES first.
  ;(globalThis as any).MODULES = {}
  const mod = await import('../src/modules/jobs')
  workerRatios = mod.workerRatios
  RworkerRatios = mod.RworkerRatios
})

function ratioStore() {
  return {
    FarmerRatio: { type: 'value', value: 0 },
    LumberjackRatio: { type: 'value', value: 0 },
    MinerRatio: { type: 'value', value: 0 },
    RFarmerRatio: { type: 'value', value: 0 },
    RLumberjackRatio: { type: 'value', value: 0 },
    RMinerRatio: { type: 'value', value: 0 },
  }
}
function readRatios() {
  const s = (globalThis as any).autoTrimpSettings
  return [s.FarmerRatio.value, s.LumberjackRatio.value, s.MinerRatio.value]
}
function readRRatios() {
  const s = (globalThis as any).autoTrimpSettings
  return [s.RFarmerRatio.value, s.RLumberjackRatio.value, s.RMinerRatio.value]
}
// A fixture keyed on the branch condition; Tribute/realMax default to the "not taken" side so
// each test isolates exactly one arm of the if/else-if chain.
function gameFor(over: {
  world?: number
  tribute?: number
  realMax?: number
  challengeActive?: string
}) {
  return makeMinimalGame({
    global: { world: over.world ?? 20, challengeActive: over.challengeActive ?? '' },
    buildings: { Tribute: { owned: over.tribute ?? 0 } },
    resources: { trimps: { realMax: () => over.realMax ?? 1000 } },
  })
}

describe('jobs.workerRatios — L1a branch-adequate golden (U1 ratio decision table)', () => {
  beforeEach(() => {
    ;(globalThis as any).autoTrimpSettings = ratioStore()
    ;(globalThis as any).challengeActive = () => false
    ;(globalThis as any).mutations = { Magma: { active: () => false } }
    // clear any custom ratio a prior test set on the shared MODULES singleton
    ;(globalThis as any).MODULES.jobs.customRatio = undefined
  })

  it('customRatio (when set) wins over every zone/tribute branch', () => {
    ;(globalThis as any).MODULES.jobs.customRatio = [9, 8, 7]
    ;(globalThis as any).game = gameFor({ world: 300, tribute: 5000, realMax: 9e9 })
    workerRatios()
    expect(readRatios()).toEqual([9, 8, 7])
  })

  it('world >= 300 selects autoRatio7 = [1, 1, 98]', () => {
    ;(globalThis as any).game = gameFor({ world: 300 })
    workerRatios()
    expect(readRatios()).toEqual([1, 1, 98])
  })

  it('Tribute > 3000 && Magma active selects autoRatio6 = [1, 7, 12]', () => {
    ;(globalThis as any).mutations = { Magma: { active: () => true } }
    ;(globalThis as any).game = gameFor({ world: 20, tribute: 3001 })
    workerRatios()
    expect(readRatios()).toEqual([1, 7, 12])
  })

  it('Tribute > 1500 selects autoRatio5 = [1, 2, 22]', () => {
    ;(globalThis as any).game = gameFor({ world: 20, tribute: 1501 })
    workerRatios()
    expect(readRatios()).toEqual([1, 2, 22])
  })

  it('Tribute > 1000 selects autoRatio4 = [1, 1.1, 10]', () => {
    ;(globalThis as any).game = gameFor({ world: 20, tribute: 1001 })
    workerRatios()
    expect(readRatios()).toEqual([1, 1.1, 10])
  })

  it('realMax > 3e6 selects autoRatio3 = [3, 1, 4]', () => {
    ;(globalThis as any).game = gameFor({ world: 20, realMax: 3e6 + 1 })
    workerRatios()
    expect(readRatios()).toEqual([3, 1, 4])
  })

  it('realMax > 3e5 selects autoRatio2 = [3, 3.1, 5]', () => {
    ;(globalThis as any).game = gameFor({ world: 20, realMax: 3e5 + 1 })
    workerRatios()
    expect(readRatios()).toEqual([3, 3.1, 5])
  })

  it('a small colony (default branch) selects autoRatio1 = [1.1, 1.15, 1.2]', () => {
    ;(globalThis as any).game = gameFor({ world: 20, realMax: 1000 })
    workerRatios()
    expect(readRatios()).toEqual([1.1, 1.15, 1.2])
  })

  it('the Metal challenge overrides to [4, 5, 0]', () => {
    ;(globalThis as any).challengeActive = (n: string) => n === 'Metal'
    ;(globalThis as any).game = gameFor({ world: 300, challengeActive: 'Metal' })
    workerRatios()
    expect(readRatios()).toEqual([4, 5, 0])
  })

  it('the Watch challenge overrides to autoRatio1 regardless of zone', () => {
    ;(globalThis as any).challengeActive = (n: string) => n === 'Watch'
    ;(globalThis as any).game = gameFor({ world: 300, challengeActive: 'Watch' })
    workerRatios()
    expect(readRatios()).toEqual([1.1, 1.15, 1.2])
  })
})

describe('jobs.RworkerRatios — L1a branch-adequate golden (radon/U2 ratio decision table)', () => {
  beforeEach(() => {
    ;(globalThis as any).autoTrimpSettings = ratioStore()
    ;(globalThis as any).mutations = { Magma: { active: () => false } }
    ;(globalThis as any).MODULES.jobs.RcustomRatio = undefined
  })

  it('RcustomRatio (when set) wins over every branch', () => {
    ;(globalThis as any).MODULES.jobs.RcustomRatio = [6, 5, 4]
    ;(globalThis as any).game = gameFor({ world: 300, tribute: 5000, realMax: 9e9 })
    RworkerRatios()
    expect(readRRatios()).toEqual([6, 5, 4])
  })

  it('world >= 300 selects RautoRatio7 = [1, 1, 98]', () => {
    ;(globalThis as any).game = gameFor({ world: 300 })
    RworkerRatios()
    expect(readRRatios()).toEqual([1, 1, 98])
  })

  it('Tribute > 3000 && Magma active selects RautoRatio6 = [1, 7, 12]', () => {
    ;(globalThis as any).mutations = { Magma: { active: () => true } }
    ;(globalThis as any).game = gameFor({ world: 20, tribute: 3001 })
    RworkerRatios()
    expect(readRRatios()).toEqual([1, 7, 12])
  })

  it('Tribute > 1500 selects RautoRatio5 = [1, 2, 22]', () => {
    ;(globalThis as any).game = gameFor({ world: 20, tribute: 1501 })
    RworkerRatios()
    expect(readRRatios()).toEqual([1, 2, 22])
  })

  it('Tribute > 1000 selects RautoRatio4 = [1, 1.1, 10]', () => {
    ;(globalThis as any).game = gameFor({ world: 20, tribute: 1001 })
    RworkerRatios()
    expect(readRRatios()).toEqual([1, 1.1, 10])
  })

  it('realMax > 3e6 selects RautoRatio3 = [3, 1, 4]', () => {
    ;(globalThis as any).game = gameFor({ world: 20, realMax: 3e6 + 1 })
    RworkerRatios()
    expect(readRRatios()).toEqual([3, 1, 4])
  })

  it('realMax > 3e5 selects RautoRatio2 = [3, 3.1, 5]', () => {
    ;(globalThis as any).game = gameFor({ world: 20, realMax: 3e5 + 1 })
    RworkerRatios()
    expect(readRRatios()).toEqual([3, 3.1, 5])
  })

  it('the Transmute challenge (small colony) selects [4, 5, 0]', () => {
    ;(globalThis as any).game = gameFor({ world: 20, realMax: 1000, challengeActive: 'Transmute' })
    RworkerRatios()
    expect(readRRatios()).toEqual([4, 5, 0])
  })

  it('a small colony (default branch) selects RautoRatio1 = [1.1, 1.15, 1.2]', () => {
    ;(globalThis as any).game = gameFor({ world: 20, realMax: 1000 })
    RworkerRatios()
    expect(readRRatios()).toEqual([1.1, 1.15, 1.2])
  })
})
