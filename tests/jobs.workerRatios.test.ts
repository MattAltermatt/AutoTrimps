// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// Phase 1 · Wave 1 characterization for jobs.ts (issue #28). workerRatios is a pure decision →
// setPageSetting actuator: it picks a [Farmer, Lumberjack, Miner] ratio from game state and writes
// the three ratio settings. We spy-log via the settings store (setPageSetting writes
// autoTrimpSettings[key].value), pinning the branch table so the strict-TS conversion is
// provably behaviour-preserving.

let workerRatios: () => void

beforeAll(async () => {
  // jobs.ts registers MODULES["jobs"] + ratio arrays at import time; seed MODULES first.
  ;(globalThis as any).MODULES = {}
  workerRatios = (await import('../src/modules/jobs')).workerRatios
})

function ratioStore() {
  return {
    FarmerRatio: { type: 'value', value: 0 },
    LumberjackRatio: { type: 'value', value: 0 },
    MinerRatio: { type: 'value', value: 0 },
  }
}
function readRatios() {
  const s = (globalThis as any).autoTrimpSettings
  return [s.FarmerRatio.value, s.LumberjackRatio.value, s.MinerRatio.value]
}

describe('jobs.workerRatios — Layer-1 spy-log (ratio decision table)', () => {
  beforeEach(() => {
    ;(globalThis as any).autoTrimpSettings = ratioStore()
    ;(globalThis as any).challengeActive = () => false
    ;(globalThis as any).mutations = { Magma: { active: () => false } }
  })

  it('world >= 300 selects autoRatio7 = [1, 1, 98]', () => {
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 300, challengeActive: '' },
      buildings: { Tribute: { owned: 0 } },
      resources: { trimps: { realMax: () => 100 } },
    })
    workerRatios()
    expect(readRatios()).toEqual([1, 1, 98])
  })

  it('a small colony (default branch) selects autoRatio1 = [1.1, 1.15, 1.2]', () => {
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 20, challengeActive: '' },
      buildings: { Tribute: { owned: 0 } },
      resources: { trimps: { realMax: () => 1000 } }, // < 300000 → autoRatio1
    })
    workerRatios()
    expect(readRatios()).toEqual([1.1, 1.15, 1.2])
  })

  it('the Metal challenge overrides to [4, 5, 0]', () => {
    ;(globalThis as any).challengeActive = (n: string) => n === 'Metal'
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 300, challengeActive: 'Metal' },
      buildings: { Tribute: { owned: 0 } },
      resources: { trimps: { realMax: () => 100 } },
    })
    workerRatios()
    expect(readRatios()).toEqual([4, 5, 0])
  })

  it('the Watch challenge overrides to autoRatio1 regardless of zone', () => {
    ;(globalThis as any).challengeActive = (n: string) => n === 'Watch'
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 300, challengeActive: 'Watch' },
      buildings: { Tribute: { owned: 0 } },
      resources: { trimps: { realMax: () => 100 } },
    })
    workerRatios()
    expect(readRatios()).toEqual([1.1, 1.15, 1.2])
  })
})
