import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'
import { assertHydrated } from './harness/gameFixture'

// #94 — the U2 building buyers must be VISIBLE to the #57 Purchase Coordinator.
//
// `coordinatorAllows` was only ever consulted at `safeBuyBuilding` — the U1 chokepoint. U2 does not
// go through it: in U2 the mainLoop never calls buyBuildings(), only RbuyBuildings(), which made
// SEVEN direct native buyBuilding() calls (Shed / Smithy ×2 / Microchip / housing / Tribute /
// Laboratory) plus one more inside RbuyStorage. Four of those spend METAL — the one pool the
// coordinator actually reserves. So with PurchaseCoordinator ON, U2 would reserve metal for a top
// target and then spend it out from under the reservation on the very next line.
//
// It was latent until #69 ship C, which turned RbuyBuildings on for every U2 player for the first
// time (its gate compared a STRING to `true`). This suite is the standing proof it stays closed.
//
// WHY THIS BOOTS THE REAL CLONE AND THE REAL BUNDLE: a unit test with a stubbed buyBuilding proves
// only that the code I just wrote calls the function I just wrote. The thing under test is whether
// AT's *shipped* U2 building path can spend metal the coordinator has reserved — so the game is the
// real game, the prices are the game's own getBuildingItemPrice, and the only thing injected is the
// coordinator context (which is exactly what computeTopTarget() would write).

const U2_SAVE = readFileSync(resolve('tests/fixtures/saves/04-u2-radon.txt'), 'utf8')

type CoordCtx = { active: boolean; topTarget: unknown; reserved: Record<string, number> }

/**
 * Boot U2, fund a House (food+wood+metal), install `coord` as the coordinator context, run
 * RbuyBuildings() and report every building it bought.
 */
function u2BuysWith(coord: CoordCtx): { bought: string[]; houseMetalCost: number; metalOwned: number } {
  const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: U2_SAVE })
  assertHydrated(game)
  expect(typeof window.RbuyBuildings).toBe('function')
  // Anti-false-green: if the bridge ever stops publishing the guard, this suite must not quietly
  // "pass" by never blocking anything.
  expect(typeof window.coordinatorAllowsBuilding).toBe('function')

  game.resources.food.owned = 30020
  game.resources.wood.owned = 30020
  game.resources.metal.owned = 30020

  // The game's own price for the buy RbuyBuildings is about to attempt (forceAmt 1, as #83 §1 pins).
  const houseMetalCost = window.getBuildingItemPrice(game.buildings.House, 'metal', false, 1)
  expect(houseMetalCost).toBeGreaterThan(0) // House really does cost metal — the premise of the test

  window.MODULES['coordinator'] = coord

  const bought: string[] = []
  const realBuy = window.buyBuilding
  window.buyBuilding = (what: string, ...rest: unknown[]) => {
    bought.push(what)
    return realBuy.call(window, what, ...rest)
  }
  window.RbuyBuildings()
  window.buyBuilding = realBuy

  return { bought, houseMetalCost, metalOwned: 30020 }
}

const TARGET = { kind: 'building', name: 'Warpstation' } as const

describe('#94: RbuyBuildings routes its buys through the #57 coordinator', () => {
  it('coordinator OFF → U2 buys housing exactly as before (byte-faithful default)', () => {
    const { bought } = u2BuysWith({ active: false, topTarget: TARGET, reserved: { metal: 1e9 } })
    // Inactive, so even an absurd reserve is inert. This is the shipped default and it must not move.
    expect(bought).toContain('House')
  })

  it('coordinator ON with no target → allows everything', () => {
    const { bought } = u2BuysWith({ active: true, topTarget: null, reserved: {} })
    expect(bought).toContain('House')
  })

  it('coordinator ON with a metal reserve the buy would dip into → the U2 House buy is BLOCKED', () => {
    // Reserve nearly all the metal: owned(30020) - houseMetalCost < reserved → coordinatorAllows false.
    const { bought, houseMetalCost, metalOwned } = u2BuysWith({
      active: true,
      topTarget: TARGET,
      reserved: { metal: metalReserveThatBlocks(30020, 1) },
    })
    expect(metalOwned - houseMetalCost).toBeLessThan(metalReserveThatBlocks(30020, 1)) // the guard's arithmetic, restated
    // THE ASSERTION #94 EXISTS FOR. Before the fix this said ['House', ...] — the coordinator never
    // saw the call at all.
    expect(bought).not.toContain('House')
    expect(bought).not.toContain('Mansion')
    expect(bought).not.toContain('Hotel')
    expect(bought).not.toContain('Resort')
  })

  it('coordinator ON with a reserve the buy CLEARS → the House buy still happens (no deadlock)', () => {
    // A reserve small enough that buying a House leaves the reserve intact must NOT block: a guard
    // that blocks everything would "pass" the test above for the wrong reason.
    const { bought } = u2BuysWith({ active: true, topTarget: TARGET, reserved: { metal: 1 } })
    expect(bought).toContain('House')
  })

  it('coordinator ON never blocks the TARGET building itself', () => {
    // Same crushing reserve as the blocking case, but House IS the target → allowed. This is the
    // guaranteed-release property: a reserve can never starve the thing it is reserving for.
    const { bought } = u2BuysWith({
      active: true,
      topTarget: { kind: 'building', name: 'House' },
      reserved: { metal: metalReserveThatBlocks(30020, 1) },
    })
    expect(bought).toContain('House')
  })

  it('a non-metal building is unaffected by a metal reserve, and its metal price is never asked', () => {
    // Phase 1 reserves METAL only. Blocking a food/wood buy on a metal reserve would be a regression —
    // and asking getBuildingItemPrice for a resource a building does not cost makes the native throw,
    // which is why the chokepoint must short-circuit before it prices. Asserted against the real game
    // object rather than through RbuyBuildings, because in this save every food/wood-only U2 building
    // (Tribute/Smithy/Laboratory/Microchip) is still `locked`, so House is the only buy that fires.
    const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: U2_SAVE })
    assertHydrated(game)
    window.MODULES['coordinator'] = { active: true, topTarget: TARGET, reserved: { metal: 1e30 } }

    expect(game.buildings.Barn.cost.metal).toBeUndefined() // premise: Barn costs food, not metal
    expect(window.coordinatorAllowsBuilding('Barn', 1)).toBe(true)
    expect(game.buildings.Gym.cost.metal).toBeUndefined() // premise: Gym costs wood
    expect(window.coordinatorAllowsBuilding('Gym', 1)).toBe(true)
    // …and the metal-costed one under the same reserve is blocked, so the above is not vacuous.
    expect(window.coordinatorAllowsBuilding('House', 1)).toBe(false)
  })
})

describe('#94: what the coordinator still CANNOT see (recorded, not fixed)', () => {
  it("computeTopTarget produces NO target in U2 today — the Phase-1 scorer is Warpstation-only", () => {
    // Measured, not assumed. Warpstation is `blockU2` (config.js) and never unlocks in U2, so
    // computeTopTarget()'s `game.buildings.Warpstation.locked` early-return fires on every U2 tick and
    // the reserve stays empty. That is WHY #94 was harmless in practice even with the setting on —
    // and it is exactly why this must be fixed BEFORE a U2 scorer lands, not after: the day someone
    // adds one, the bypass becomes a live accounting bug with no test to catch it. This test is that
    // test's tripwire — if it ever goes red, a U2 target now exists and the guard above is load-bearing.
    const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: U2_SAVE })
    assertHydrated(game)
    expect(game.global.universe).toBe(2)
    expect(game.buildings.Warpstation.locked).toBe(1)

    window.autoTrimpSettings['PurchaseCoordinator'].enabled = true
    window.computeTopTarget()
    expect(window.MODULES['coordinator'].active).toBe(true) // the setting really is on…
    expect(window.MODULES['coordinator'].topTarget).toBe(null) // …and it still targets nothing in U2.
  })

  it('RbuyBuildings force-enables the game-native autoStorage, an un-interceptable metal spender', () => {
    // The honest half of #94. AT's `__syncAutoStorageOnce()` flips `game.global.autoStorage` on, and
    // the GAME's own gameLoop then calls autoStorage() (.trimps-game/main.js:19958 → :18391), which
    // does `buyBuilding(storage[x], false, true)` for Barn/Shed/**FORGE**. Forge costs metal. That call
    // is native game code on the game's tick — it can never route through AT's chokepoint, so a metal
    // reserve can be spent by a buyer the coordinator does not know exists.
    //
    // This test does not assert that is FIXED. It asserts the hazard is REAL and pins it, so that if a
    // future change stops force-enabling autoStorage (or starts intercepting it) somebody has to come
    // back and read this. See the issue filed from #94 for the analysis.
    const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: U2_SAVE })
    assertHydrated(game)
    expect(game.global.autoStorage).toBe(false)

    window.MODULES['coordinator'] = { active: true, topTarget: TARGET, reserved: { metal: 1e30 } }
    window.RbuyBuildings()

    // AT turned on a spender it does not control, while holding a metal reservation.
    expect(game.global.autoStorage).toBe(true)
    expect(game.buildings.Forge.cost.metal).toBeDefined() // …and what that spender buys includes metal.
  })
})

/** Any reserve strictly greater than (owned - cost) blocks; owned-1 is safely above every cost>=1. */
function metalReserveThatBlocks(owned: number, _amt: number): number {
  return owned - 1
}
