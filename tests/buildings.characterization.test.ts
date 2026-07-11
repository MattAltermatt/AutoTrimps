// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// Phase-2 characterization net for buildings.ts (proof-net #51) — the building-buyer actuator module.
// Archetypes per the design spec (§4):
//   L1b actuator spy-logs — safeBuyBuilding / RsafeBuyBuilding / buyFoodEfficientHousing /
//     buyGemEfficientHousing / buyBuildings / buyStorage / RbuyFoodEfficientHousing /
//     RbuyGemEfficientHousing / RbuyStorage / RbuyBuildings. Their RETURN is (mostly) meaningless;
//     the CONTRACT is the ordered native-mutator call log: buyBuilding(name,true,true[,amt]) WITH the
//     smuggled decision state (game.global.buyAmt / firing / maxSplit) captured AT CALL TIME (the
//     jobs.ts:41,48 precedent — safeBuyBuilding smuggles buyAmt then calls native buyBuilding).
//   L1a pure-predicate golden master — mostEfficientHousing (housing-selector), return == frozen value.
// Every exported decision fn has >=1 assertion; every ==/!= that the idiomatic pass converts to
// ===/!== is driven to its live/true state by some fixture so a mistranscription fails loudly.
//
// getPageSetting / debug are REAL imports inside buildings.ts; they read the global autoTrimpSettings.
// Seeding it (never mocking the util) is the jobs.ts / upgrades.ts precedent. All other collaborators
// (native buyBuilding + game-global helper fns) are stubbed on globalThis.

let buildings: typeof import('../src/modules/buildings')
let coordinatorAllowsFn: typeof import('../src/modules/coordinator').coordinatorAllows

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  buildings = await import('../src/modules/buildings')
  // #57: safeBuyBuilding calls coordinatorAllows as a bare-name bridge global. Wire the REAL guard
  // so the coordinator tests exercise genuine integration (import after MODULES exists — coordinator.ts
  // sets MODULES["coordinator"] at load).
  coordinatorAllowsFn = (await import('../src/modules/coordinator')).coordinatorAllows
})

// ── native-mutator spy: ordered buyBuilding calls WITH the smuggled decision state ──────────────
type BuyCall = { building: unknown; buyAmt: unknown; firing: unknown; maxSplit: unknown; args: unknown[] }
let buyCalls: BuyCall[]
function installBuySpy() {
  buyCalls = []
  ;(globalThis as any).buyBuilding = vi.fn((...args: unknown[]) => {
    const g = (globalThis as any).game
    buyCalls.push({
      building: args[0],
      buyAmt: g.global.buyAmt,
      firing: g.global.firing,
      maxSplit: g.global.maxSplit,
      args,
    })
  })
}

// Every building div the DOM-touching fns paint. jsdom getElementById would return null otherwise
// (buildings.ts uses `!` non-null assertions), throwing on `.style.border`.
const ALL_BUILDINGS = [
  'Hut', 'House', 'Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector', 'Warpstation',
  'Wormhole', 'Gym', 'Tribute', 'Nursery', 'Barn', 'Shed', 'Forge', 'Smithy', 'Microchip',
  'Laboratory',
]
function mountBuildingDivs() {
  document.body.innerHTML = ''
  for (const id of ALL_BUILDINGS) {
    const d = document.createElement('div')
    d.id = id
    document.body.appendChild(d)
  }
}

// Benign defaults for every helper global buildings.ts reads; individual tests override.
beforeEach(() => {
  mountBuildingDivs()
  installBuySpy()
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).isBuildingInQueue = () => false
  ;(globalThis as any).preBuy2 = vi.fn(() => ({ oldBuyAmt: 1 }))
  ;(globalThis as any).postBuy2 = vi.fn()
  ;(globalThis as any).bwRewardUnlocked = () => false
  ;(globalThis as any).canAffordBuilding = () => true
  ;(globalThis as any).getBuildingItemPrice = () => 100
  ;(globalThis as any).calculateMaxAfford = () => 1
  ;(globalThis as any).canAffordCoordinationTrimps = () => true
  ;(globalThis as any).calcOurBlock = () => 0
  ;(globalThis as any).getPierceAmt = () => 0
  ;(globalThis as any).calcSpecificEnemyAttack = () => 0
  ;(globalThis as any).calcBadGuyDmg = () => 0
  ;(globalThis as any).getEnemyMaxAttack = () => 0
  ;(globalThis as any).calcOurHealth = () => 0
  ;(globalThis as any).evaluateEquipmentEfficiency = () => ({ Wall: false, Factor: 1 })
  ;(globalThis as any).isActiveSpireAT = () => false
  ;(globalThis as any).disActiveSpireAT = () => false
  ;(globalThis as any).calcHeirloomBonus = (_a: unknown, _b: unknown, v: number) => v
  ;(globalThis as any).simpleSeconds = () => 0
  ;(globalThis as any).scaleToCurrentMap = (v: number) => v
  ;(globalThis as any).smithylogic = () => true
  ;(globalThis as any).getPsString = () => 1
  ;(globalThis as any).toggleAutoStorage = vi.fn()
  ;(globalThis as any).questcheck = () => 0
  ;(globalThis as any).RcalcHDratio = () => 0
  ;(globalThis as any).getMaxAffordable = () => 1
  ;(globalThis as any).Rhyposhouldwood = true
  ;(globalThis as any).bestBuilding = null
  // Mirror the module-load cutoffs (buildings.ts:19-21); a bare {} would drop them and NaN the
  // buyStorage thresholds.
  ;(globalThis as any).MODULES = {
    buildings: { storageMainCutoff: 0.85, storageLowlvlCutoff1: 0.7, storageLowlvlCutoff2: 0.5 },
    upgrades: { autoGigas: false },
    // #57 coordinator: inert by default (active:false → guard returns true) so every existing
    // safeBuyBuilding assertion stays byte-faithful. Individual tests flip it on to exercise blocking.
    coordinator: { active: false, topTarget: null, reserved: {} },
  }
  ;(globalThis as any).coordinatorAllows = coordinatorAllowsFn
})

afterEach(() => {
  for (const k of [
    'game', 'autoTrimpSettings', 'isBuildingInQueue', 'preBuy2', 'postBuy2', 'bwRewardUnlocked',
    'canAffordBuilding', 'buyBuilding', 'getBuildingItemPrice', 'calculateMaxAfford',
    'canAffordCoordinationTrimps', 'calcOurBlock', 'getPierceAmt', 'calcSpecificEnemyAttack',
    'calcBadGuyDmg', 'getEnemyMaxAttack', 'calcOurHealth', 'evaluateEquipmentEfficiency',
    'isActiveSpireAT', 'disActiveSpireAT', 'calcHeirloomBonus', 'simpleSeconds', 'scaleToCurrentMap',
    'smithylogic', 'getPsString', 'toggleAutoStorage', 'questcheck', 'RcalcHDratio',
    'getMaxAffordable', 'Rhyposhouldwood', 'bestBuilding',
  ]) delete (globalThis as any)[k]
})

// building fixture helper — every building defaults unlocked (locked 0) with owned 0.
function bld(over: Record<string, any> = {}) {
  const base: Record<string, any> = {}
  for (const id of ALL_BUILDINGS) base[id] = { locked: 0, owned: 0, purchased: 0, increase: { what: 'trimps.max', by: 3 } }
  base.Hut.increase.by = 3
  base.Hub = { locked: 1 } // housing bonus building (mostEfficientHousing reads it)
  for (const [k, v] of Object.entries(over)) base[k] = { ...base[k], ...v }
  return base
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — safeBuyBuilding (native buyBuilding + smuggled buyAmt/firing/maxSplit)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('buildings.safeBuyBuilding — L1b actuator spy-log', () => {
  function game(over: Record<string, unknown> = {}) {
    return makeMinimalGame({
      global: { buyAmt: 1, firing: true, maxSplit: 1 },
      buildings: bld(),
      ...over,
    })
  }

  // #57 coordinator guard at the safeBuyBuilding chokepoint. Gym is given an explicit metal cost so
  // the metal-reserve guard actually engages (real Gym costs wood — see the non-metal test below).
  const withMetalCost = { buildings: { Gym: { cost: { metal: [100, 1.5] } } }, resources: { metal: { owned: 1000 } } }

  it('coordinator inert when inactive: the guard does not block a normal buy (byte-faithful)', () => {
    ;(globalThis as any).game = game(withMetalCost)
    MODULES['coordinator'] = { active: false, topTarget: { kind: 'building', name: 'Warpstation' }, reserved: { metal: 1e9 } }
    expect(buildings.safeBuyBuilding('Gym')).toBe(true) // inactive → guard allows despite the huge reserve
    expect(buyCalls.length).toBe(1)
  })

  it('coordinator blocks a lesser metal buy when active with a reserve it would dip into', () => {
    ;(globalThis as any).game = game(withMetalCost)
    MODULES['coordinator'] = { active: true, topTarget: { kind: 'building', name: 'Warpstation' }, reserved: { metal: 1000 } }
    // Gym metal cost 100 (stubbed) → owned 1000 - 100 = 900 < reserved 1000 → deferred.
    expect(buildings.safeBuyBuilding('Gym')).toBe(false)
    expect(buyCalls.length).toBe(0)
  })

  it('coordinator never blocks the target building itself', () => {
    ;(globalThis as any).game = game(withMetalCost)
    MODULES['coordinator'] = { active: true, topTarget: { kind: 'building', name: 'Gym' }, reserved: { metal: 1e9 } }
    expect(buildings.safeBuyBuilding('Gym')).toBe(true) // it IS the target → allowed
    expect(buyCalls.length).toBe(1)
  })

  it('coordinator skips a building with NO metal cost — never asks its metal price (regression)', () => {
    // Reproduce the native getBuildingItemPrice throw on a missing cost key. Tribute costs food only;
    // a metal-only guard would crash mainLoop the instant the setting is on. The cost?.metal guard
    // must skip the lookup entirely.
    ;(globalThis as any).getBuildingItemPrice = (toBuy: any, costItem: string) => {
      const c = toBuy.cost?.[costItem]
      if (c === undefined) throw new TypeError("Cannot read properties of undefined (reading '1')")
      return 100
    }
    ;(globalThis as any).game = game({ buildings: { Tribute: { cost: { food: [100, 1.5] } } }, resources: { metal: { owned: 1000 } } })
    MODULES['coordinator'] = { active: true, topTarget: { kind: 'building', name: 'Warpstation' }, reserved: { metal: 1e9 } }
    expect(() => buildings.safeBuyBuilding('Tribute')).not.toThrow() // no metal cost → guard skipped, no crash
    expect(buyCalls.length).toBe(1) // and it buys normally
  })

  it('normal building (non-Gym/Warpstation/Trap): buyAmt=1, firing cleared, buys, returns true', () => {
    ;(globalThis as any).game = game()
    expect(buildings.safeBuyBuilding('Hut')).toBe(true)
    expect(buyCalls).toEqual([{ building: 'Hut', buyAmt: 1, firing: false, maxSplit: 1, args: ['Hut', true, true] }])
  })

  it('locked building: returns false, no buy', () => {
    ;(globalThis as any).game = game({ buildings: bld({ Hut: { locked: 1 } }) })
    expect(buildings.safeBuyBuilding('Hut')).toBe(false)
    expect(buyCalls).toEqual([])
  })

  it('already queued: returns false, no buy', () => {
    ;(globalThis as any).isBuildingInQueue = () => true
    ;(globalThis as any).game = game()
    expect(buildings.safeBuyBuilding('Hut')).toBe(false)
    expect(buyCalls).toEqual([])
  })

  it('unaffordable: returns false, postBuy2 restores, no buy', () => {
    ;(globalThis as any).canAffordBuilding = () => false
    ;(globalThis as any).game = game()
    expect(buildings.safeBuyBuilding('Hut')).toBe(false)
    expect(((globalThis as any).postBuy2 as any).mock.calls.length).toBe(1)
    expect(buyCalls).toEqual([])
  })

  it('DecaBuild reward → buyAmt=10 when affordable', () => {
    ;(globalThis as any).bwRewardUnlocked = (r: string) => r === 'DecaBuild'
    ;(globalThis as any).game = game()
    buildings.safeBuyBuilding('Hut')
    expect(buyCalls[0].buyAmt).toBe(10)
  })

  it('DoubleBuild reward → buyAmt=2 when affordable', () => {
    ;(globalThis as any).bwRewardUnlocked = (r: string) => r === 'DoubleBuild'
    ;(globalThis as any).game = game()
    buildings.safeBuyBuilding('Hut')
    expect(buyCalls[0].buyAmt).toBe(2)
  })

  // L59: building == 'Gym' (true) — GymWall on forces buyAmt back to 1
  it('Gym with GymWall set: forces buyAmt=1 (Gym==’Gym’ live-true branch)', () => {
    ;(globalThis as any).bwRewardUnlocked = (r: string) => r === 'DecaBuild' // would set buyAmt=10
    ;(globalThis as any).autoTrimpSettings = { GymWall: { type: 'value', value: 5 } }
    ;(globalThis as any).game = game()
    buildings.safeBuyBuilding('Gym')
    expect(buyCalls).toEqual([{ building: 'Gym', buyAmt: 1, firing: false, maxSplit: 1, args: ['Gym', true, true] }])
  })

  // L62: building == 'Warpstation' (true), owned < 2 → buyAmt='Max', maxSplit=1, returns undefined
  it('Warpstation owned<2: buyAmt=Max + maxSplit=1, buys, returns undefined', () => {
    ;(globalThis as any).game = game({ buildings: bld({ Warpstation: { owned: 0 } }) })
    const ret = buildings.safeBuyBuilding('Warpstation')
    expect(ret).toBeUndefined()
    expect(buyCalls).toEqual([{ building: 'Warpstation', buyAmt: 'Max', firing: false, maxSplit: 1, args: ['Warpstation', true, true] }])
  })

  // L62/66: Warpstation owned >= 2 → buyAmt=1
  it('Warpstation owned>=2: buyAmt=1', () => {
    ;(globalThis as any).game = game({ buildings: bld({ Warpstation: { owned: 5 } }) })
    buildings.safeBuyBuilding('Warpstation')
    expect(buyCalls[0].buyAmt).toBe(1)
    expect(buyCalls[0].building).toBe('Warpstation')
  })

  // L74: building != 'Trap' (FALSE branch) — Trap suppresses the debug log but still buys
  it('Trap building: buys (the != "Trap" false branch — no debug, buy still fires)', () => {
    ;(globalThis as any).game = game({ buildings: bld({ Trap: { locked: 0, owned: 0 } }) })
    expect(buildings.safeBuyBuilding('Trap')).toBe(true)
    expect(buyCalls[0].building).toBe('Trap')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — RsafeBuyBuilding
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('buildings.RsafeBuyBuilding — L1b actuator spy-log', () => {
  function game(over: Record<string, unknown> = {}) {
    return makeMinimalGame({ global: { buyAmt: 1, firing: true, maxSplit: 1 }, buildings: bld(), ...over })
  }

  it('buys an unlocked, affordable building, returns true', () => {
    ;(globalThis as any).game = game()
    expect(buildings.RsafeBuyBuilding('Hut')).toBe(true)
    expect(buyCalls).toEqual([{ building: 'Hut', buyAmt: 1, firing: false, maxSplit: 1, args: ['Hut', true, true] }])
  })

  it('locked: returns false, no buy', () => {
    ;(globalThis as any).game = game({ buildings: bld({ Hut: { locked: 1 } }) })
    expect(buildings.RsafeBuyBuilding('Hut')).toBe(false)
    expect(buyCalls).toEqual([])
  })

  it('unaffordable: returns false, no buy', () => {
    ;(globalThis as any).canAffordBuilding = () => false
    ;(globalThis as any).game = game()
    expect(buildings.RsafeBuyBuilding('Hut')).toBe(false)
    expect(buyCalls).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — buyFoodEfficientHousing (picks the lowest food-ratio housing, then safeBuyBuilding)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('buildings.buyFoodEfficientHousing — L1b actuator spy-log', () => {
  it('buys the most food-efficient unlocked housing (lowest price/increase ratio)', () => {
    // Hut price 30 / by 3 = 10 ; House price 300 / by 3 = 100 → Hut wins
    ;(globalThis as any).getBuildingItemPrice = (b: any) => (b.increase.by === 3 && b.__name === 'Hut' ? 30 : 300)
    // encode a name onto each building so the stub can distinguish
    const buildingsObj = bld({
      Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 },
    })
    buildingsObj.Hut.__name = 'Hut'; buildingsObj.House.__name = 'House'
    ;(globalThis as any).game = makeMinimalGame({ global: { buyAmt: 1, firing: false, maxSplit: 1 }, buildings: buildingsObj })
    buildings.buyFoodEfficientHousing()
    expect(buyCalls.map((c) => c.building)).toEqual(['Hut'])
  })

  // L110: buildOrder.length == 0 → early return, no buy
  it('no unlocked housing (buildOrder empty) → returns without buying', () => {
    ;(globalThis as any).game = makeMinimalGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1 },
      buildings: bld({ Hut: { locked: 1 }, House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 } }),
    })
    buildings.buyFoodEfficientHousing()
    expect(buyCalls).toEqual([])
  })

  it('respects Max* limit: housing at its Max is filtered out (border painted orange)', () => {
    ;(globalThis as any).autoTrimpSettings = { MaxHut: { type: 'value', value: 5 } }
    ;(globalThis as any).getBuildingItemPrice = () => 30
    const buildingsObj = bld({
      Hut: { owned: 5 }, // owned >= Max 5 → filtered
      Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 },
    })
    ;(globalThis as any).game = makeMinimalGame({ global: { buyAmt: 1, firing: false, maxSplit: 1 }, buildings: buildingsObj })
    buildings.buyFoodEfficientHousing()
    // Hut filtered → only House remains → House bought
    expect(buyCalls.map((c) => c.building)).toEqual(['House'])
    expect(document.getElementById('Hut')!.style.border).toContain('orange')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — buyGemEfficientHousing (gem-ratio housing + Gateway/Warpstation walls + coord-buy)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('buildings.buyGemEfficientHousing — L1b actuator spy-log', () => {
  it('buys the lowest gem-ratio unlocked housing and sets bestBuilding', () => {
    // Only Mansion + Hotel unlocked; Mansion cheaper
    ;(globalThis as any).getBuildingItemPrice = (b: any) => (b.__name === 'Mansion' ? 30 : 300)
    const buildingsObj = bld({
      Gateway: { locked: 1 }, Collector: { locked: 1 }, Warpstation: { locked: 1 },
    })
    buildingsObj.Mansion.__name = 'Mansion'; buildingsObj.Hotel.__name = 'Hotel'
    ;(globalThis as any).game = makeMinimalGame({ global: { buyAmt: 1, firing: false, maxSplit: 1 }, buildings: buildingsObj })
    buildings.buyGemEfficientHousing()
    expect(buyCalls.map((c) => c.building)).toEqual(['Mansion'])
    expect((globalThis as any).bestBuilding).toBe('Mansion')
  })

  // L148: bestGemBuilding == "Gateway" (true) + GatewayWall wall blocks it
  it('Gateway wall: bestGemBuilding=="Gateway" but wall trips → nulled, nothing bought', () => {
    ;(globalThis as any).autoTrimpSettings = { GatewayWall: { type: 'value', value: 2 } }
    // only Gateway unlocked → it is the sole candidate
    ;(globalThis as any).getBuildingItemPrice = () => 999 // > fragments/GatewayWall → wall trips
    const buildingsObj = bld({
      Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 }, Collector: { locked: 1 }, Warpstation: { locked: 1 },
    })
    ;(globalThis as any).game = makeMinimalGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1 },
      buildings: buildingsObj,
      resources: { fragments: { owned: 100 } },
      portal: { Resourceful: { modifier: 0, level: 0 } },
    })
    buildings.buyGemEfficientHousing()
    expect(buyCalls).toEqual([])
  })

  // L157/163: bestGemBuilding == "Warpstation" (true) — WarpstationCap gate skips it
  it('Warpstation cap (WarpstationCap): bestGemBuilding=="Warpstation" skipped → nothing bought', () => {
    ;(globalThis as any).autoTrimpSettings = {
      WarpstationCap: { type: 'boolean', enabled: true },
      DeltaGigastation: { type: 'value', value: 0 },
      FirstGigastation: { type: 'value', value: 0 },
    }
    const buildingsObj = bld({
      Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 }, Gateway: { locked: 1 }, Collector: { locked: 1 },
      Warpstation: { locked: 0, owned: 10 },
    })
    ;(globalThis as any).game = makeMinimalGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1 },
      buildings: buildingsObj,
      upgrades: { Gigastation: { done: 1 } }, // firstGigaOK true
      portal: { Resourceful: { modifier: 0, level: 0 } },
    })
    ;(globalThis as any).MODULES = { buildings: {}, upgrades: { autoGigas: false } } // firstGigaOK true → gigaCapped true (owned 10 >= 0)
    buildings.buyGemEfficientHousing()
    expect(buyCalls).toEqual([])
  })

  // L180/181: toTip.increase.what == "trimps.max" (true) — deep coord-buy path
  it('Warpstation coord-buy path drives increase.what=="trimps.max" branch and re-selects Warpstation', () => {
    ;(globalThis as any).autoTrimpSettings = {
      WarpstationWall3: { type: 'value', value: 2 }, // warpwallpct > 1 → skipWarp when metal wall trips
      WarpstationCoordBuy: { type: 'boolean', enabled: true },
    }
    ;(globalThis as any).getBuildingItemPrice = () => 1e9 // metal price huge → wall trips → skipWarp
    ;(globalThis as any).canAffordCoordinationTrimps = () => false // enters the coord recompute
    ;(globalThis as any).calculateMaxAfford = () => 100
    const buildingsObj = bld({
      Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 }, Gateway: { locked: 1 }, Collector: { locked: 1 },
      Warpstation: { locked: 0, owned: 10, increase: { what: 'trimps.max', by: 1000 } },
    })
    ;(globalThis as any).game = makeMinimalGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1 },
      buildings: buildingsObj,
      upgrades: { Coordination: { allowed: 0, done: 0 } },
      resources: { metal: { owned: 1 }, trimps: { maxSoldiers: 10, realMax: () => 100 } },
      portal: {
        Resourceful: { modifier: 0, level: 0 },
        Coordinated: { level: 1, modifier: 0.98, currentSend: 10 },
        Carpentry: { level: 5 }, // increase.what == 'trimps.max' → increase *= 1.1^5
        Carpentry_II: { level: 0, modifier: 0 },
      },
    })
    // amtToGo = (10*3) - 100 = -70 < increase*howMany → bestGemBuilding re-set to "Warpstation"
    buildings.buyGemEfficientHousing()
    expect(buyCalls.map((c) => c.building)).toEqual(['Warpstation'])
  })

  // L192: Carpentry_II clause `toTip.increase.what === "trimps.max"` — the test above sets
  // Carpentry_II.level:0 so `Carpentry_II.level && ...` short-circuits BEFORE the ===. This variant
  // sets Carpentry_II.level:1 (and Carpentry.level:0 so the _I clause short-circuits instead), driving
  // the _II increase.what === "trimps.max" operand to a live evaluation.
  it('coord-buy Carpentry_II clause drives the _II increase.what==="trimps.max" operand live', () => {
    ;(globalThis as any).autoTrimpSettings = {
      WarpstationWall3: { type: 'value', value: 2 },
      WarpstationCoordBuy: { type: 'boolean', enabled: true },
    }
    ;(globalThis as any).getBuildingItemPrice = () => 1e9
    ;(globalThis as any).canAffordCoordinationTrimps = () => false
    ;(globalThis as any).calculateMaxAfford = () => 100
    const buildingsObj = bld({
      Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 }, Gateway: { locked: 1 }, Collector: { locked: 1 },
      Warpstation: { locked: 0, owned: 10, increase: { what: 'trimps.max', by: 1000 } },
    })
    ;(globalThis as any).game = makeMinimalGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1 },
      buildings: buildingsObj,
      upgrades: { Coordination: { allowed: 0, done: 0 } },
      resources: { metal: { owned: 1 }, trimps: { maxSoldiers: 10, realMax: () => 100 } },
      portal: {
        Resourceful: { modifier: 0, level: 0 },
        Coordinated: { level: 1, modifier: 0.98, currentSend: 10 },
        Carpentry: { level: 0 }, // _I clause short-circuits on level 0
        Carpentry_II: { level: 1, modifier: 0.5 }, // _II clause fires → increase.what === 'trimps.max' evaluated
      },
    })
    // increase = 1000 * (1 + 0.5*1) = 1500; amtToGo = -70 < 1500*100 → re-selects Warpstation
    buildings.buyGemEfficientHousing()
    expect(buyCalls.map((c) => c.building)).toEqual(['Warpstation'])
  })

  // L154: `keysSorted[best] !== "Gateway"` — the first two operands (owned<max, max==-1) are made
  // false and GemEfficiencyIgnoresMax truthy so the !=="Gateway" operand evaluates live.
  it('GemEfficiencyIgnoresMax drives the keysSorted!=="Gateway" operand live (buys a maxed-out non-Gateway)', () => {
    ;(globalThis as any).autoTrimpSettings = {
      GemEfficiencyIgnoresMax: { type: 'boolean', enabled: true },
      MaxMansion: { type: 'value', value: 5 },
    }
    // Only Mansion unlocked, owned === Max 5 → owned<max false, max==-1 false → third operand fires
    const buildingsObj = bld({
      Hotel: { locked: 1 }, Resort: { locked: 1 }, Gateway: { locked: 1 }, Collector: { locked: 1 }, Warpstation: { locked: 1 },
      Mansion: { locked: 0, owned: 5 },
    })
    ;(globalThis as any).game = makeMinimalGame({ global: { buyAmt: 1, firing: false, maxSplit: 1 }, buildings: buildingsObj })
    buildings.buyGemEfficientHousing()
    expect(buyCalls.map((c) => c.building)).toEqual(['Mansion'])
    expect((globalThis as any).bestBuilding).toBe('Mansion')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — buyBuildings (orchestrator: food/gem housing + Wormhole/Gym/Tribute/Nursery)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('buildings.buyBuildings — L1b orchestrator spy-log', () => {
  // hidebuild short-circuits the housing calls; every housing locked so those are no-ops here.
  function baseGame(over: Record<string, unknown> = {}) {
    const b = bld({
      Hut: { locked: 1 }, House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 },
      Gateway: { locked: 1 }, Collector: { locked: 1 }, Warpstation: { locked: 1 },
      Wormhole: { locked: 1 }, Gym: { locked: 1 }, Tribute: { locked: 1 }, Nursery: { locked: 1 },
    })
    return makeMinimalGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1, world: 5, challengeActive: '', brokenPlanet: false, formation: 0 },
      buildings: b,
      equipment: { Shield: { blockNow: false } },
      upgrades: { Gymystic: { allowed: 0, done: 0, modifier: 1 } },
      portal: { Resourceful: { modifier: 0, level: 0 } },
      ...over,
    })
  }

  it('all-locked, hidebuild off: buys nothing', () => {
    ;(globalThis as any).game = baseGame()
    buildings.buyBuildings()
    expect(buyCalls).toEqual([])
  })

  // L287: Nursery.locked == 0 (true) + zone/max gates → buys Nursery
  it('Nursery: unlocked + past NoNurseriesUntil + under MaxNursery → buys', () => {
    ;(globalThis as any).autoTrimpSettings = {
      NoNurseriesUntil: { type: 'value', value: 1 }, MaxNursery: { type: 'valueNegative', value: -1 },
      NurseryWall: { type: 'value', value: 0 },
    }
    ;(globalThis as any).game = baseGame({
      buildings: bld({
        Hut: { locked: 1 }, House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 },
        Gateway: { locked: 1 }, Collector: { locked: 1 }, Warpstation: { locked: 1 },
        Wormhole: { locked: 1 }, Gym: { locked: 1 }, Tribute: { locked: 1 }, Nursery: { locked: 0, owned: 0 },
      }),
    })
    buildings.buyBuildings()
    expect(buyCalls.map((c) => c.building)).toEqual(['Nursery'])
  })

  // L220: formation == 3 (true) reached via DynamicGyms + brokenPlanet pierce path
  it('Gym dynamic path with formation==3 + brokenPlanet: exercises the pierce/formation branch', () => {
    ;(globalThis as any).autoTrimpSettings = {
      MaxGym: { type: 'valueNegative', value: -1 },
      DynamicGyms: { type: 'boolean', enabled: true },
      GymWall: { type: 'value', value: 0 },
    }
    ;(globalThis as any).calcOurBlock = () => 1e9 // huge block → all *DamageOK true → skipGym
    ;(globalThis as any).getPierceAmt = () => 0.1
    ;(globalThis as any).game = baseGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1, world: 300, challengeActive: '', brokenPlanet: true, formation: 3, dailyChallenge: {} },
      buildings: bld({
        Hut: { locked: 1 }, House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 },
        Gateway: { locked: 1 }, Collector: { locked: 1 }, Warpstation: { locked: 1 },
        Wormhole: { locked: 1 }, Gym: { locked: 0, owned: 0 }, Tribute: { locked: 1 }, Nursery: { locked: 1 },
      }),
      upgrades: { Gymystic: { allowed: 0, done: 0, modifier: 1 } },
    })
    buildings.buyBuildings()
    // block huge → skipGym → Gymystic allowed==done so the buy guard also short-circuits → no buy
    expect(buyCalls).toEqual([])
  })

  // L256: Tribute unlocked + MaxTribute gate → buys Tribute
  it('Tribute: unlocked + under MaxTribute → buys', () => {
    ;(globalThis as any).autoTrimpSettings = { MaxTribute: { type: 'valueNegative', value: -1 } }
    ;(globalThis as any).game = baseGame({
      buildings: bld({
        Hut: { locked: 1 }, House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 },
        Gateway: { locked: 1 }, Collector: { locked: 1 }, Warpstation: { locked: 1 },
        Wormhole: { locked: 1 }, Gym: { locked: 1 }, Tribute: { locked: 0, owned: 0 }, Nursery: { locked: 1 },
      }),
    })
    buildings.buyBuildings()
    expect(buyCalls.map((c) => c.building)).toEqual(['Tribute'])
  })

  // L239: `game.global.challengeActive !== "Daily" || typeof game.global.dailyChallenge.explosive === "undefined"`.
  // Every other test has challengeActive!=="Daily" (true) so the || short-circuits before the typeof. These two
  // drive challengeActive:'Daily' so the typeof ... === "undefined" operand evaluates live (both truth values).
  function dailyGymGame(dailyChallenge: Record<string, unknown>) {
    return baseGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1, world: 300, challengeActive: 'Daily', brokenPlanet: false, formation: 0, dailyChallenge },
      buildings: bld({
        Hut: { locked: 1 }, House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 },
        Gateway: { locked: 1 }, Collector: { locked: 1 }, Warpstation: { locked: 1 },
        Wormhole: { locked: 1 }, Gym: { locked: 0, owned: 0 }, Tribute: { locked: 1 }, Nursery: { locked: 1 },
      }),
      upgrades: { Gymystic: { allowed: 0, done: 0, modifier: 1 } },
    })
  }

  it('Daily with no explosive: typeof explosive==="undefined" evaluates true (skipGym via huge block, no buy)', () => {
    ;(globalThis as any).autoTrimpSettings = {
      MaxGym: { type: 'valueNegative', value: -1 },
      DynamicGyms: { type: 'boolean', enabled: true },
      GymWall: { type: 'value', value: 0 },
    }
    ;(globalThis as any).calcOurBlock = () => 1e9 // block huge → all *DamageOK true → skipGym
    ;(globalThis as any).game = dailyGymGame({}) // no explosive key → typeof "undefined" === "undefined" → true
    buildings.buyBuildings()
    expect(buyCalls).toEqual([])
  })

  it('Daily WITH explosive defined: typeof explosive==="undefined" evaluates false (still skipGym via huge block)', () => {
    ;(globalThis as any).autoTrimpSettings = {
      MaxGym: { type: 'valueNegative', value: -1 },
      DynamicGyms: { type: 'boolean', enabled: true },
      GymWall: { type: 'value', value: 0 },
    }
    ;(globalThis as any).calcOurBlock = () => 1e9
    ;(globalThis as any).game = dailyGymGame({ explosive: true }) // typeof "boolean" === "undefined" → false
    buildings.buyBuildings()
    expect(buyCalls).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — buyStorage (Barn/Shed/Forge over the cutoff)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('buildings.buyStorage — L1b actuator spy-log', () => {
  function game(world: number, ownedFrac: number) {
    // owned = ownedFrac * max ; max=100 so cutoffs are easy to reason about
    return makeMinimalGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1, world, mapsActive: false },
      buildings: bld(),
      resources: {
        food: { owned: ownedFrac * 100, max: 100 },
        wood: { owned: ownedFrac * 100, max: 100 },
        metal: { owned: ownedFrac * 100, max: 100 },
      },
      portal: { Packrat: { level: 0, modifier: 0 } },
      triggers: { Barn: { done: true }, Shed: { done: true }, Forge: { done: true } },
      unlocks: { imps: { Jestimp: false } },
    })
  }

  // L311: world == 1 (true) uses the low-lvl cutoff1 (0.7)
  it('world==1: buys storage once owned > max*0.7 (lowlvl cutoff1)', () => {
    ;(globalThis as any).game = game(1, 0.75) // 0.75 > 0.7 → buys all three
    buildings.buyStorage()
    expect(buyCalls.map((c) => c.building).sort()).toEqual(['Barn', 'Forge', 'Shed'])
  })

  it('world==1 below cutoff1: no buy', () => {
    ;(globalThis as any).game = game(1, 0.6) // 0.6 < 0.7 → no buy
    buildings.buyStorage()
    expect(buyCalls).toEqual([])
  })

  // world >= 2 && < 10 → cutoff2 (0.5)
  it('world 5 (2..9): buys once owned > max*0.5 (lowlvl cutoff2)', () => {
    ;(globalThis as any).game = game(5, 0.55)
    buildings.buyStorage()
    expect(buyCalls.map((c) => c.building).sort()).toEqual(['Barn', 'Forge', 'Shed'])
  })

  // world >= 10 → main cutoff (0.85)
  it('world 20 (>=10): buys once owned > max*0.85 (main cutoff)', () => {
    ;(globalThis as any).game = game(20, 0.9)
    buildings.buyStorage()
    expect(buyCalls.map((c) => c.building).sort()).toEqual(['Barn', 'Forge', 'Shed'])
  })

  it('trigger not done: no buy even over cutoff', () => {
    const g = game(20, 0.9)
    ;(g as any).triggers = { Barn: { done: false }, Shed: { done: false }, Forge: { done: false } }
    ;(globalThis as any).game = g
    buildings.buyStorage()
    expect(buyCalls).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — RbuyFoodEfficientHousing / RbuyGemEfficientHousing
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('buildings.RbuyFoodEfficientHousing — L1b actuator spy-log', () => {
  it('buys the lowest food-ratio housing when smithylogic passes', () => {
    ;(globalThis as any).autoTrimpSettings = { RMaxHut: { type: 'valueNegative', value: -1 } }
    ;(globalThis as any).getBuildingItemPrice = (b: any) => (b.__name === 'Hut' ? 30 : 300)
    const buildingsObj = bld({
      House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 },
    })
    buildingsObj.Hut.__name = 'Hut'
    ;(globalThis as any).game = makeMinimalGame({ global: { buyAmt: 1, firing: false, maxSplit: 1 }, buildings: buildingsObj })
    buildings.RbuyFoodEfficientHousing()
    expect(buyCalls.map((c) => c.building)).toEqual(['Hut'])
  })

  it('smithylogic false → no buy', () => {
    ;(globalThis as any).smithylogic = () => false
    ;(globalThis as any).autoTrimpSettings = { RMaxHut: { type: 'valueNegative', value: -1 } }
    ;(globalThis as any).game = makeMinimalGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1 },
      buildings: bld({ House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 } }),
    })
    buildings.RbuyFoodEfficientHousing()
    expect(buyCalls).toEqual([])
  })
})

describe('buildings.RbuyGemEfficientHousing — L1b actuator spy-log', () => {
  it('buys the lowest gem-ratio housing and sets bestBuilding', () => {
    ;(globalThis as any).autoTrimpSettings = { RMaxMansion: { type: 'valueNegative', value: -1 } }
    ;(globalThis as any).getBuildingItemPrice = (b: any) => (b.__name === 'Mansion' ? 30 : 300)
    const buildingsObj = bld({
      Hotel: { locked: 1 }, Resort: { locked: 1 }, Gateway: { locked: 1 }, Collector: { locked: 1 },
    })
    buildingsObj.Mansion.__name = 'Mansion'
    ;(globalThis as any).game = makeMinimalGame({ global: { buyAmt: 1, firing: false, maxSplit: 1 }, buildings: buildingsObj })
    buildings.RbuyGemEfficientHousing()
    expect(buyCalls.map((c) => c.building)).toEqual(['Mansion'])
    expect((globalThis as any).bestBuilding).toBe('Mansion')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — mostEfficientHousing (pure-ish housing selector, golden master)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('buildings.mostEfficientHousing — L1a golden master', () => {
  // RMax<house> = -1 → getPageSetting returns -1 → maxHousing Infinity (owned < it). Unset would
  // return false and break the `owned < maxHousing` gate, filtering every housing out.
  const RMAX_UNLIMITED: Record<string, unknown> = {}
  for (const h of ['Hut', 'House', 'Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector']) {
    RMAX_UNLIMITED['RMax' + h] = { type: 'valueNegative', value: -1 }
  }

  // L477: mostEfficient.name == "" (true) → null when no housing qualifies
  it('all housing locked → null', () => {
    ;(globalThis as any).autoTrimpSettings = { ...RMAX_UNLIMITED }
    ;(globalThis as any).game = makeMinimalGame({
      buildings: bld({
        Hut: { locked: 1 }, House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 },
        Resort: { locked: 1 }, Gateway: { locked: 1 }, Collector: { locked: 1 },
      }),
    })
    expect(buildings.mostEfficientHousing()).toBeNull()
  })

  it('single unlocked housing → returns that housing name', () => {
    ;(globalThis as any).autoTrimpSettings = { ...RMAX_UNLIMITED }
    const buildingsObj = bld({
      House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 },
      Gateway: { locked: 1 }, Collector: { locked: 1 },
    })
    buildingsObj.Hut.cost = { food: [125, 1.24], wood: [75, 1.24] }
    ;(globalThis as any).game = makeMinimalGame({ buildings: buildingsObj })
    expect(buildings.mostEfficientHousing()).toBe('Hut')
  })

  // L469: resource == 'wood' (true) && !Rhyposhouldwood → worstTime Infinity → deprioritized
  it('wood-costed housing is deprioritized (Infinity) when Rhyposhouldwood is false', () => {
    ;(globalThis as any).Rhyposhouldwood = false
    ;(globalThis as any).autoTrimpSettings = { ...RMAX_UNLIMITED }
    const buildingsObj = bld({
      Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 }, Gateway: { locked: 1 }, Collector: { locked: 1 },
    })
    buildingsObj.Hut.cost = { wood: [75, 1.24] } // only wood → worstTime Infinity
    buildingsObj.House.cost = { food: [125, 1.24] } // only food → finite → wins
    ;(globalThis as any).game = makeMinimalGame({ buildings: buildingsObj })
    expect(buildings.mostEfficientHousing()).toBe('House')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — RbuyStorage (radon storage over max)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('buildings.RbuyStorage — L1b actuator spy-log', () => {
  function game(over: Record<string, unknown> = {}) {
    return makeMinimalGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1, universe: 2, mapsActive: false, currentMapId: '', mapsOwnedArray: [] },
      buildings: bld(),
      resources: {
        food: { owned: 100, max: 50 }, wood: { owned: 100, max: 50 }, metal: { owned: 100, max: 50 },
      },
      portal: { Packrat: { level: 0, radLevel: 0, modifier: 0 } },
      ...over,
    })
  }

  // L511: universe == 1 (true) uses Packrat.level; universe 2 uses radLevel
  it('universe==1 path: buys storage for each requested resource over max', () => {
    ;(globalThis as any).game = game({ global: { buyAmt: 1, firing: false, maxSplit: 1, universe: 1, mapsActive: false, currentMapId: '', mapsOwnedArray: [] } })
    buildings.RbuyStorage(true, true, true)
    // owned*1.1=110 > max 50 → each buys via native buyBuilding(name,true,true,1)
    expect(buyCalls.map((c) => c.building).sort()).toEqual(['Barn', 'Forge', 'Shed'])
    expect(buyCalls[0].args).toEqual(['Barn', true, true, 1])
  })

  it('universe==2 path buys too (radLevel packrat)', () => {
    ;(globalThis as any).game = game()
    buildings.RbuyStorage(true, false, false)
    expect(buyCalls.map((c) => c.building)).toEqual(['Barn'])
  })

  // L498/499: Map.id == currentMap (true) && Map.name == "Atlantrimp"/"Trimple Of Doom"
  it('on Atlantrimp map: isOnTrimple doubles projection (still buys over max)', () => {
    ;(globalThis as any).game = game({
      global: {
        buyAmt: 1, firing: false, maxSplit: 1, universe: 2, mapsActive: true, currentMapId: 'map3',
        mapsOwnedArray: [{ id: 'map3', name: 'Atlantrimp' }],
      },
    })
    buildings.RbuyStorage(true, false, false)
    // isOnTrimple → jestImps = owned*2 = 200 > max 50 → buys
    expect(buyCalls.map((c) => c.building)).toEqual(['Barn'])
  })

  // L510: the 2nd operand `Map.name === "Trimple Of Doom"` — the Atlantrimp test above short-circuits
  // the || on the first operand; this fixture names the map "Trimple Of Doom" so the 2nd === evaluates live.
  it('on Trimple Of Doom map: 2nd name=== operand evaluates live → isOnTrimple, buys over max', () => {
    ;(globalThis as any).game = game({
      global: {
        buyAmt: 1, firing: false, maxSplit: 1, universe: 2, mapsActive: true, currentMapId: 'map7',
        mapsOwnedArray: [{ id: 'map7', name: 'Trimple Of Doom' }],
      },
    })
    buildings.RbuyStorage(true, false, false)
    expect(buyCalls.map((c) => c.building)).toEqual(['Barn'])
  })

  it('under max: no buy', () => {
    ;(globalThis as any).game = game({
      resources: { food: { owned: 10, max: 500 }, wood: { owned: 10, max: 500 }, metal: { owned: 10, max: 500 } },
    })
    buildings.RbuyStorage(true, true, true)
    expect(buyCalls).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — RbuyBuildings (radon orchestrator: storage/smithy/microchip/housing/tribute/labs)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('buildings.RbuyBuildings — L1b orchestrator spy-log', () => {
  function baseGame(over: Record<string, unknown> = {}) {
    const b = bld({
      Hut: { locked: 1 }, House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 },
      Gateway: { locked: 1 }, Collector: { locked: 1 },
      Smithy: { locked: 1 }, Microchip: { locked: 1 }, Tribute: { locked: 1 }, Laboratory: { locked: 1 },
      Shed: { owned: 0, purchased: 0 },
    })
    return makeMinimalGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1, world: 5, challengeActive: '', autoStorage: true },
      buildings: b,
      resources: { food: { owned: 0, max: 100 }, wood: { owned: 0, max: 100 }, metal: { owned: 0, max: 100 } },
      portal: { Packrat: { level: 0, radLevel: 0, modifier: 0 } },
      ...over,
    })
  }

  it('nothing unlocked/affordable: no buildings bought (autoStorage toggled only)', () => {
    ;(globalThis as any).autoTrimpSettings = { Rnurtureon: { type: 'boolean', enabled: false } }
    ;(globalThis as any).canAffordBuilding = () => false
    ;(globalThis as any).game = baseGame()
    buildings.RbuyBuildings()
    expect(buyCalls).toEqual([])
  })

  // L555: `game.global.challengeActive === "Hypothermia"` — no other test enters this ~35-line block, so
  // its 9 var conversions + the === + the bonfire/woodmax/hypofarm math + the Shed buy + RbuyStorage(true,
  // false,true) were all unexercised. This fixture drives the "farm" (else) branch end-to-end and asserts
  // the ordered native-call log: buyBuilding('Shed',…) then RbuyStorage's Barn+Forge buys.
  it('Hypothermia farm branch: buys Shed then RbuyStorage food+metal (ordered native-call log)', () => {
    ;(globalThis as any).autoTrimpSettings = {
      Rhypostorage: { type: 'boolean', enabled: true },
      Rhypofarmzone: { type: 'multiValue', value: ['10', '20'] }, // → [10,20]
      Rhypofarmstack: { type: 'multiValue', value: ['5', '5'] }, // → [5,5]
      Rnurtureon: { type: 'boolean', enabled: false },
    }
    ;(globalThis as any).game = baseGame({
      // world 10 is IN Rhypofarmzone (indexOf 0) and NOT past its last entry (20) → the farm/else branch.
      global: { buyAmt: 1, firing: false, maxSplit: 1, world: 10, universe: 2, challengeActive: 'Hypothermia', autoStorage: true, mapsActive: false, currentMapId: '', mapsOwnedArray: [] },
      challenges: { Hypothermia: { totalBonfires: 0 } },
      // wood.max drives woodmax; food/metal over their (50) max so RbuyStorage(true,false,true) buys both.
      resources: {
        food: { owned: 100, max: 50 }, wood: { owned: 0, max: 100 }, metal: { owned: 100, max: 50 },
      },
    })
    buildings.RbuyBuildings()
    // Shed: targetprice(≈1.05e18) >= 1e10 && woodmax(100)*2^0 < targetprice → buy.
    // RbuyStorage: food(110>50)→Barn, metal(110>50)→Forge. Everything else locked → no further buys.
    expect(buyCalls.map((c) => c.building)).toEqual(['Shed', 'Barn', 'Forge'])
    expect(buyCalls.map((c) => c.args)).toEqual([
      ['Shed', true, true, 1],
      ['Barn', true, true, 1],
      ['Forge', true, true, 1],
    ])
    expect((globalThis as any).toggleAutoStorage).toHaveBeenCalledWith(false)
  })

  // L591/594: challengeActive == 'Quest' + questcheck() == 7 → Smithy bought once, smithybought set
  it('Smithy on Quest: questcheck()==7 → buys Smithy', () => {
    ;(globalThis as any).autoTrimpSettings = { Rnurtureon: { type: 'boolean', enabled: false }, Rmapcuntoff: { type: 'value', value: 999 } }
    ;(globalThis as any).questcheck = () => 7
    ;(globalThis as any).game = baseGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1, world: 5, challengeActive: 'Quest', autoStorage: true },
      buildings: bld({
        Hut: { locked: 1 }, House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 },
        Gateway: { locked: 1 }, Collector: { locked: 1 },
        Smithy: { locked: 0 }, Microchip: { locked: 1 }, Tribute: { locked: 1 }, Laboratory: { locked: 1 },
      }),
    })
    buildings.RbuyBuildings()
    expect(buyCalls.map((c) => c.building)).toContain('Smithy')
  })

  it('Housing loop: mostEfficientHousing pick bought while affordable (single pass)', () => {
    ;(globalThis as any).autoTrimpSettings = { Rnurtureon: { type: 'boolean', enabled: false }, RMaxHut: { type: 'valueNegative', value: -1 } }
    let bought = 0
    // affordable only for the first housing buy so the do/while terminates
    ;(globalThis as any).canAffordBuilding = (name: string) => name === 'Hut' && bought++ === 0
    const buildingsObj = bld({
      House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 },
      Gateway: { locked: 1 }, Collector: { locked: 1 },
      Smithy: { locked: 1 }, Microchip: { locked: 1 }, Tribute: { locked: 1 }, Laboratory: { locked: 1 },
      Hut: { locked: 0, owned: 0, purchased: 0, cost: { food: [125, 1.24] } },
    })
    ;(globalThis as any).game = baseGame({ buildings: buildingsObj })
    buildings.RbuyBuildings()
    expect(buyCalls.map((c) => c.building)).toContain('Hut')
  })

  // L646: Rnurtureon == true → Laboratory bought when unlocked + under RMaxLabs
  it('Labs: Rnurtureon on + Laboratory unlocked + under RMaxLabs → buys Laboratory', () => {
    ;(globalThis as any).autoTrimpSettings = {
      Rnurtureon: { type: 'boolean', enabled: true },
      RMaxLabs: { type: 'valueNegative', value: -1 },
    }
    ;(globalThis as any).canAffordBuilding = () => false // suppress smithy/microchip/housing
    ;(globalThis as any).game = baseGame({
      buildings: bld({
        Hut: { locked: 1 }, House: { locked: 1 }, Mansion: { locked: 1 }, Hotel: { locked: 1 }, Resort: { locked: 1 },
        Gateway: { locked: 1 }, Collector: { locked: 1 },
        Smithy: { locked: 1 }, Microchip: { locked: 1 }, Tribute: { locked: 1 }, Laboratory: { locked: 0, owned: 0 },
      }),
    })
    buildings.RbuyBuildings()
    expect(buyCalls.map((c) => c.building)).toEqual(['Laboratory'])
  })
})
