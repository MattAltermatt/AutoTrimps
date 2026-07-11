// @vitest-environment jsdom
// jsdom: coordinator.ts imports getPageSetting from utils.ts, which touches `document` at module load.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// Phase-1 unit net for coordinator.ts (#57). The guard is a pure predicate over plain
// game.resources[x].owned data (no game methods), so a minimal hand-authored fixture suffices —
// this is the L1a pure-predicate archetype, not the newGame()-overlay actuator path.

let coordinator: typeof import('../src/modules/coordinator')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  coordinator = await import('../src/modules/coordinator')
})

beforeEach(() => {
  ;(globalThis as any).game = makeMinimalGame({
    resources: { metal: { owned: 1000 }, food: { owned: 1000 } },
  })
  ;(globalThis as any).MODULES['coordinator'] = { active: false, topTarget: null, reserved: {} }
})

describe('coordinatorAllows', () => {
  it('allows everything when inactive (even with a target + reserve)', () => {
    MODULES['coordinator'].active = false
    MODULES['coordinator'].topTarget = { kind: 'building', name: 'Warpstation' }
    MODULES['coordinator'].reserved = { metal: 900 }
    expect(coordinator.coordinatorAllows('Gym', 'metal', 500)).toBe(true)
  })

  it('allows everything when active but no target', () => {
    MODULES['coordinator'].active = true
    MODULES['coordinator'].topTarget = null
    expect(coordinator.coordinatorAllows('Gym', 'metal', 500)).toBe(true)
  })

  it('never blocks the target itself, even spending into the reserve', () => {
    MODULES['coordinator'].active = true
    MODULES['coordinator'].topTarget = { kind: 'building', name: 'Warpstation' }
    MODULES['coordinator'].reserved = { metal: 900 }
    expect(coordinator.coordinatorAllows('Warpstation', 'metal', 950)).toBe(true)
  })

  it('blocks a lesser buy that would dip into the reserve', () => {
    MODULES['coordinator'].active = true
    MODULES['coordinator'].topTarget = { kind: 'building', name: 'Warpstation' }
    MODULES['coordinator'].reserved = { metal: 900 }
    // owned 1000 - cost 500 = 500 < reserved 900 → blocked
    expect(coordinator.coordinatorAllows('Gym', 'metal', 500)).toBe(false)
  })

  it('allows a lesser buy that stays above the reserve', () => {
    MODULES['coordinator'].active = true
    MODULES['coordinator'].topTarget = { kind: 'building', name: 'Warpstation' }
    MODULES['coordinator'].reserved = { metal: 900 }
    game.resources.metal.owned = 2000 // 2000 - 500 = 1500 >= 900 → allowed
    expect(coordinator.coordinatorAllows('Gym', 'metal', 500)).toBe(true)
  })

  it('ignores reserves in a different (uncontended) pool', () => {
    MODULES['coordinator'].active = true
    MODULES['coordinator'].topTarget = { kind: 'building', name: 'Warpstation' }
    MODULES['coordinator'].reserved = { metal: 900 }
    // Food is not reserved → a food buy is unaffected regardless of the metal reserve.
    expect(coordinator.coordinatorAllows('Hut', 'food', 500)).toBe(true)
  })
})

describe('computeTopTarget', () => {
  let safeBuySpy: ReturnType<typeof vi.fn>
  beforeEach(() => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).canAffordCoordinationTrimps = () => false
    ;(globalThis as any).getBuildingItemPrice = () => 250
    safeBuySpy = vi.fn()
    ;(globalThis as any).safeBuyBuilding = safeBuySpy
    ;(globalThis as any).game = makeMinimalGame({
      resources: { trimps: { maxSoldiers: 10, realMax: () => 0 }, metal: { owned: 1000 } },
      upgrades: { Coordination: { allowed: 5, done: 2 } },
      buildings: { Warpstation: { locked: false, increase: { what: 'trimps.max', by: 100 } } },
      portal: { Coordinated: { level: 0 } },
    })
    ;(globalThis as any).MODULES['coordinator'] = { active: false, topTarget: null, reserved: {} }
  })

  const setSetting = (on: boolean) => {
    ;(globalThis as any).autoTrimpSettings.PurchaseCoordinator = { type: 'boolean', enabled: on }
  }

  it('stays inactive + clears target when the toggle is off', () => {
    setSetting(false)
    MODULES['coordinator'].topTarget = { kind: 'building', name: 'Warpstation' } // stale from a prior tick
    coordinator.computeTopTarget()
    expect(MODULES['coordinator'].active).toBe(false)
    expect(MODULES['coordinator'].topTarget).toBeNull()
    expect(safeBuySpy).not.toHaveBeenCalled()
  })

  it('reserves metal + delegates the buy to safeBuyBuilding when Coordination is needed but unaffordable', () => {
    setSetting(true)
    coordinator.computeTopTarget()
    expect(MODULES['coordinator'].active).toBe(true)
    expect(MODULES['coordinator'].topTarget).toEqual({ kind: 'building', name: 'Warpstation' })
    expect(MODULES['coordinator'].reserved.metal).toBe(250) // metal held so it accumulates
    // safeBuyBuilding self-gates on its own forced buyAmt: it buys iff affordable, no-op otherwise —
    // so we always delegate (no ambient-buyAmt coupling), and it is a safe no-op while accumulating.
    expect(safeBuySpy).toHaveBeenCalledWith('Warpstation')
  })

  it('no target + no buy when Coordination is already affordable', () => {
    setSetting(true)
    ;(globalThis as any).canAffordCoordinationTrimps = () => true
    coordinator.computeTopTarget()
    expect(MODULES['coordinator'].topTarget).toBeNull()
    expect(safeBuySpy).not.toHaveBeenCalled()
  })

  it('no target + no buy when Coordination is not needed (allowed == done)', () => {
    setSetting(true)
    game.upgrades.Coordination.done = 5
    coordinator.computeTopTarget()
    expect(MODULES['coordinator'].topTarget).toBeNull()
    expect(safeBuySpy).not.toHaveBeenCalled()
  })

  it('no target + no buy when population already covers the next send (amtToGo <= 0)', () => {
    setSetting(true)
    game.resources.trimps.realMax = () => 1e9 // realMax >> maxSoldiers*3 → amtToGo <= 0
    coordinator.computeTopTarget()
    expect(MODULES['coordinator'].topTarget).toBeNull()
    expect(safeBuySpy).not.toHaveBeenCalled()
  })
})
