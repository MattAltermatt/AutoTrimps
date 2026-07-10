// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// Proof-net Phase 1 · L2 semantic invariant for jobs.ts (spec §L2 — the createSetting-id-catalog
// analogue: a STRUCTURAL assertion decoupled from byte/emit that survives re-baselining).
//
// jobs.ts has no single declarable ordered-priority LIST like settings' 569-id catalog — its buy
// order is control-flow- and fire/buy-phase-dependent. But it carries one clean, load-bearing
// structural invariant, stated verbatim in the source (jobs.ts:495 "Do non-ratio/limited jobs
// first"): in RbuyJobs the LIMITED jobs (Explorer, Meteorologist, Worshipper) are always bought
// BEFORE any ratio worker (Farmer/Lumberjack/Miner/Scientist). We assert that ordering as a
// property over multiple states — it must hold regardless of which subset fires. The finer exact
// sequences are pinned by the L1 spy-logs (jobs.actuators.test.ts); this guards the phase boundary.

let jobs: typeof import('../src/modules/jobs')
beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  jobs = await import('../src/modules/jobs')
})

let calls: string[]
beforeEach(() => {
  calls = []
  ;(globalThis as any).buyJob = vi.fn((title: string) => calls.push(title))
  ;(globalThis as any).autoTrimpSettings = {
    RFarmerRatio: { type: 'value', value: 1 },
    RLumberjackRatio: { type: 'value', value: 1 },
    RMinerRatio: { type: 'value', value: 1 },
  }
  for (const f of ['Rshouldtimefarm', 'Rdshouldtimefarm', 'Rshouldsmithyfarm', 'Rshouldtributefarm', 'Rshouldshipfarm', 'Rshouldhypofarm']) {
    ;(globalThis as any)[f] = false
  }
})

const LIMITED = ['Explorer', 'Meteorologist', 'Worshipper']
const RATIO = ['Farmer', 'Lumberjack', 'Miner', 'Scientist']

// Assert every limited-job call precedes every ratio-worker call in the emitted order.
function assertLimitedBeforeRatio(seq: string[]) {
  const lastLimited = Math.max(-1, ...seq.map((t, i) => (LIMITED.includes(t) ? i : -1)))
  const firstRatio = seq.findIndex((t) => RATIO.includes(t))
  if (lastLimited >= 0 && firstRatio >= 0) {
    expect(lastLimited).toBeLessThan(firstRatio)
  }
}

function rbuyFixture(over: { rMaxExplorers?: number; affordable?: number; ships?: number; food?: number } = {}) {
  ;(globalThis as any).getMaxAffordable = () => over.affordable ?? 0
  ;(globalThis as any).autoTrimpSettings.RMaxExplorers = { type: 'value', value: over.rMaxExplorers ?? 0 }
  return makeMinimalGame({
    global: { world: 10, firing: false, buyAmt: 1, maxSplit: 1 },
    resources: {
      trimps: { owned: 100, realMax: () => 1000, employed: 0 },
      food: { owned: over.food ?? 1e9 },
    },
    jobs: {
      Farmer: { owned: 10, locked: false, cost: { food: 1 } },
      Lumberjack: { owned: 10, locked: false, cost: { food: 1 } },
      Miner: { owned: 10, locked: false, cost: { food: 1 } },
      Scientist: { owned: 10, locked: false, cost: { food: 1 } },
      Explorer: { owned: 0, locked: false, cost: { food: [1, 1.1] } },
      Meteorologist: { owned: 0, locked: false, cost: { food: [1, 1.1] } },
      Worshipper: { owned: 0, locked: false, getCost: () => (over.food ?? 1e9) / (over.ships ?? 1) },
    },
  })
}

describe('jobs.RbuyJobs — L2 invariant: limited jobs before ratio workers', () => {
  it('all three limited jobs fire, then ratio workers (never interleaved)', () => {
    ;(globalThis as any).game = rbuyFixture({ rMaxExplorers: -1, affordable: 5, ships: 3 })
    jobs.RbuyJobs()
    // sanity: the fixture actually exercises both phases
    expect(calls.filter((t) => LIMITED.includes(t)).length).toBeGreaterThan(0)
    expect(calls.filter((t) => RATIO.includes(t)).length).toBeGreaterThan(0)
    assertLimitedBeforeRatio(calls)
  })

  it('invariant holds when only some limited jobs are affordable', () => {
    // affordable=0 → no Explorer/Meteorologist; only Worshipper (ships) among limited
    ;(globalThis as any).game = rbuyFixture({ rMaxExplorers: 0, affordable: 0, ships: 2 })
    jobs.RbuyJobs()
    assertLimitedBeforeRatio(calls)
  })

  it('invariant holds trivially when no limited jobs fire (pure ratio distribution)', () => {
    ;(globalThis as any).game = rbuyFixture({ rMaxExplorers: 0, affordable: 0, food: 0 })
    jobs.RbuyJobs()
    expect(calls.filter((t) => LIMITED.includes(t))).toEqual([])
    assertLimitedBeforeRatio(calls) // vacuously true; documents the boundary
  })
})
