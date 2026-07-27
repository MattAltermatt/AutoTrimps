// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// L1b branch net for the gem-housing AFFORDABILITY FALL-THROUGH in buyGemEfficientHousing.
//
// The sim test (tests/sim/gem-housing-fallthrough.test.ts) proves the fix on a real z60 save; this
// file pins the four branch outcomes in isolation, because the sim fixture only exercises ONE of
// them. Each case here is mutation-checked — see the comment on each `it`.
//
// The rule under test, in the loop that picks a gem-housing target:
//   winner blocked on a NON-gem resource  -> paint orange, fall through to the next-best candidate
//   winner blocked on GEMS themselves     -> break, buy nothing, keep saving
//   winner is Warpstation                 -> break regardless (carve-out: its metal cost is 10x its
//                                            gem cost, and three settings already own that trade)
//   winner already nulled (skipWarp etc.) -> break, unchanged

let buildings: typeof import('../src/modules/buildings')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  buildings = await import('../src/modules/buildings')
})

let buyCalls: string[]

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

// Gem prices chosen so the ranking order is unambiguous and matches the real game's shape at depth:
// Gateway is the best gems-per-pop deal, Collector second, Mansion a distant third.
const BASE_GEM_PRICE: Record<string, number> = {
  Gateway: 5.8e9,      // /100 pop   = 5.8e7  <- ranks first
  Collector: 5.0e11,   // /5000 pop  = 1.0e8
  Mansion: 8.3e9,      // /20 pop    = 4.15e8
  Warpstation: 1.0e14, // /10000 pop = 1.0e10
}
/** Per-test mutable copy — the Warpstation case needs a candidate ranked BELOW Warpstation. */
let GEM_PRICE: Record<string, number> = { ...BASE_GEM_PRICE }
const POP: Record<string, number> = { Gateway: 100, Collector: 5000, Mansion: 20, Warpstation: 10000 }

/** Unlock exactly `names`; everything else in the gem-housing list stays locked. */
function seedHousing(names: string[]) {
  const game = (globalThis as any).game
  for (const n of ['Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector', 'Warpstation']) {
    game.buildings[n] = {
      locked: names.includes(n) ? 0 : 1,
      owned: 0,
      purchased: 0,
      increase: { what: 'trimps.max', by: POP[n] ?? 20 },
      cost: { gems: [1, 1.1] },
    }
  }
}

beforeEach(() => {
  mountBuildingDivs()
  buyCalls = []
  GEM_PRICE = { ...BASE_GEM_PRICE }
  // Reset per test: MODULES is seeded once in beforeAll, so without this a leftover
  // `{ autoGigas: false }` from one test leaks into later ones and silently satisfies `firstGigaOK`
  // for a case that meant to control it explicitly.
  ;(globalThis as any).MODULES = { upgrades: {} }
  ;(globalThis as any).game = makeMinimalGame({
    buildings: {},
    upgrades: {},
    global: { world: 60, universe: 1, buyAmt: 1, firing: false },
  })
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).isBuildingInQueue = () => false
  ;(globalThis as any).preBuy2 = vi.fn(() => ({ oldBuyAmt: 1 }))
  ;(globalThis as any).postBuy2 = vi.fn()
  ;(globalThis as any).bwRewardUnlocked = () => false
  ;(globalThis as any).calculateMaxAfford = () => 1
  ;(globalThis as any).canAffordCoordinationTrimps = () => true
  ;(globalThis as any).getPerkLevel = () => 0
  // Bare global declared in main-loop.ts (the former AutoTrimps2.js); buyGemEfficientHousing writes
  // it as a free identifier, which is a strict-ESM ReferenceError unless it exists on globalThis.
  ;(globalThis as any).bestBuilding = null
  ;(globalThis as any).buyBuilding = vi.fn((name: string) => buyCalls.push(name))
  ;(globalThis as any).getBuildingItemPrice = (b: any, item: string) => {
    if (item !== 'gems') return 0
    const name = Object.keys(GEM_PRICE).find((n) => (globalThis as any).game.buildings[n] === b)
    return GEM_PRICE[name ?? ''] ?? 100
  }
  const game = (globalThis as any).game
  game.resources.gems = { owned: 1e12, max: -1 } // enough for Gateway + Mansion, NOT for Collector
  game.portal.Resourceful = { level: 0, modifier: 0.05 }
})

const borderOf = (id: string) => document.getElementById(id)!.style.border

describe('buildings/gem-housing affordability fall-through', () => {
  // MUTATION: delete the fall-through block -> buyCalls is [] and Gateway stays green.
  it('falls through to the next-best candidate when the winner is blocked on a NON-gem resource', () => {
    seedHousing(['Gateway', 'Mansion'])
    // Gateway wins the ranking but is unaffordable; gems alone would cover it (1e12 > 5.8e9), so the
    // blocker is something the ranking never looked at. Mansion is affordable.
    ;(globalThis as any).canAffordBuilding = (name: string) => name !== 'Gateway'

    buildings.buyGemEfficientHousing()

    expect(buyCalls).toEqual(['Mansion'])
    // The skipped winner must be repainted, not left green — a green-but-not-bought border is a lie,
    // and orange is the convention the pre-existing wall branch already used.
    expect(borderOf('Gateway')).toBe('1px solid orange')
  })

  // MUTATION: drop the `gemsAffordable(...)` clause -> this buys a Mansion at 7x worse gems/pop.
  it('does NOT fall through when the winner is blocked on GEMS itself — it keeps saving', () => {
    seedHousing(['Collector', 'Mansion'])
    ;(globalThis as any).game.resources.gems.owned = 1e10 // < Collector's 5e11, > Mansion's 8.3e9
    ;(globalThis as any).canAffordBuilding = (name: string) => name !== 'Collector'

    buildings.buyGemEfficientHousing()

    expect(buyCalls).toEqual([])
    expect(borderOf('Collector')).toBe('1px solid rgb(0, 204, 0)')
  })

  // MUTATION: drop the `!== "Warpstation"` carve-out -> buyCalls becomes ['Mansion'], which is the
  // shape that moves the 12-warp-u1 L0 trace by ~2100 events (gems diverted out of the Gigastation
  // cycle). Mansion is priced BELOW Warpstation here on purpose: without a candidate ranked after
  // Warpstation, removing the carve-out merely nulls the winner, and "nulled" and "unaffordable
  // winner" both buy nothing — the assertion would pass either way and prove nothing.
  it('never falls through a Warpstation — the Gigastation trade is owned by its own settings', () => {
    GEM_PRICE.Mansion = 1e13 // /20 pop = 5.0e11, ranks AFTER Warpstation's 1.0e10
    seedHousing(['Warpstation', 'Collector', 'Mansion'])
    ;(globalThis as any).game.resources.gems.owned = 1e15 // affords everything, gem-wise
    // Warpstation ranks second here, so cap Collector out of the loop to make it the winner — the
    // same position it reaches naturally at depth (past ~41 Collectors it ranks first outright).
    ;(globalThis as any).autoTrimpSettings = { MaxCollector: { type: 'value', value: '0' } }
    ;(globalThis as any).canAffordBuilding = (name: string) => name !== 'Warpstation'

    buildings.buyGemEfficientHousing()

    expect(buyCalls).toEqual([])
  })

  // MUTATION: paint the nulled candidate via `bestGemBuilding` instead of `keysSorted[best]`
  // -> getElementById(null) returns null and the `!` assertion throws.
  it('a nulled winner with no candidates behind it terminates cleanly', () => {
    seedHousing(['Warpstation'])
    ;(globalThis as any).autoTrimpSettings = {
      WarpstationCap: { type: 'boolean', enabled: true },
      FirstGigastation: { type: 'value', value: '1' },
      DeltaGigastation: { type: 'value', value: '1' },
    }
    const game = (globalThis as any).game
    game.buildings.Warpstation.owned = 99 // >= the giga cap -> skipWarp nulls the winner
    game.upgrades.Gigastation = { done: 1 }
    ;(globalThis as any).MODULES['upgrades'] = { autoGigas: false }
    ;(globalThis as any).canAffordBuilding = () => false

    expect(() => buildings.buyGemEfficientHousing()).not.toThrow()
    expect(buyCalls).toEqual([])
  })
})

// #155 — A NULLED WINNER MUST NOT TAKE THE REST OF THE LIST DOWN WITH IT.
//
// `skipWarp` (the Gigastation cap at buildings.ts:246-250 and the metal wall at :251-255) sets
// `bestGemBuilding = null` to mean "do not buy a Warpstation this tick". The loop then fell to the
// unconditional `break`, so every lower-ranked candidate went with it — an affordable, uncapped
// Collector sitting right behind a giga-capped Warpstation was simply never considered.
//
// ⚠️ THE L0 CORPUS CANNOT REACH THIS. Measured on 12-warp-u1 over 45,000 ticks (world 62 -> 85):
// Warpstation is the eligible top-ranked candidate for 30,951 of those ticks, but `skipWarp` fires
// ZERO times, because `firstGigaOK` requires `game.upgrades.Gigastation.done > 0` and the fixture
// never buys a Gigastation. (Its other disjunct, `MODULES["upgrades"].autoGigas == false`, is dead
// code — the field is never assigned anywhere in src/, catalogued as #70 in
// tests/nets/modules-fields.test.ts:186 — so `firstGigaOK` reduces to the Gigastation term alone.)
// Gigastation is structurally blind to the proof net by construction, per #128/#132. So
// `baseline-zero` staying green across this change is NOT evidence; these branch tests are the
// only gate, which is why each is mutation-proven separately.
describe('buildings/#155 giga-capped Warpstation must not block the rest of the list', () => {
  /** Warpstation priced to rank FIRST, as it does at depth; Collector affordable behind it. */
  function seedGigaCapped() {
    GEM_PRICE.Warpstation = 5.0e11 // /10000 pop = 5.0e7, ranks ahead of Collector's 1.0e8
    seedHousing(['Warpstation', 'Collector', 'Mansion'])
    const game = (globalThis as any).game
    game.resources.gems.owned = 1e15
    game.buildings.Warpstation.owned = 999 // >= the giga cap
    game.upgrades.Gigastation = { done: 5 }
    ;(globalThis as any).autoTrimpSettings = {
      WarpstationCap: { type: 'boolean', enabled: true },
      FirstGigastation: { type: 'value', value: '1' },
      DeltaGigastation: { type: 'value', value: '1' },
    }
    ;(globalThis as any).canAffordBuilding = () => true
  }

  // MUTATION: restore the unconditional `break` in place of the `bestGemBuilding === null`
  // continue -> buyCalls becomes [] (the pre-#155 dead end, reproduced).
  it('falls through a giga-capped Warpstation to the affordable Collector behind it', () => {
    seedGigaCapped()

    buildings.buyGemEfficientHousing()

    expect(buyCalls).toEqual(['Collector'])
    expect(borderOf('Warpstation')).toBe('1px solid orange')
  })

  // MUTATION: move the `bestGemBuilding === null` continue ABOVE the coord-buy block -> the
  // override is preempted and buyCalls becomes ['Collector'] instead of ['Warpstation'].
  it('still honours the WarpstationCoordBuy override, which deliberately beats the cap', () => {
    seedGigaCapped()
    ;(globalThis as any).autoTrimpSettings.WarpstationCoordBuy = { type: 'boolean', enabled: true }
    // The override fires only when the next Coordination is unaffordable AND the Warpstations we
    // could buy would close the population gap.
    ;(globalThis as any).canAffordCoordinationTrimps = () => false
    ;(globalThis as any).calculateMaxAfford = () => 100
    const game = (globalThis as any).game
    game.portal.Coordinated = { level: 0 }
    game.portal.Carpentry = { level: 0 }
    game.portal.Carpentry_II = { level: 0, modifier: 0 }
    game.resources.trimps = { maxSoldiers: 1, realMax: () => 0 }

    buildings.buyGemEfficientHousing()

    expect(buyCalls).toEqual(['Warpstation'])
  })

  // MUTATION: restore the unconditional `break` -> buyCalls becomes [].
  // Guards the OTHER skipWarp source (WarpstationWall3, the metal wall) through the same path.
  it('falls through a metal-walled Warpstation too', () => {
    seedGigaCapped()
    ;(globalThis as any).autoTrimpSettings = {
      WarpstationWall3: { type: 'value', value: '2' },
    }
    const game = (globalThis as any).game
    game.resources.metal = { owned: 1 } // wall trips: price >> metal/2
    game.portal.Resourceful = { level: 0, modifier: 0.05 }
    ;(globalThis as any).getBuildingItemPrice = (b: any, item: string) => {
      if (item === 'metal') return 1e12
      if (item !== 'gems') return 0
      const g = (globalThis as any).game
      const name = Object.keys(GEM_PRICE).find((n) => g.buildings[n] === b)
      return GEM_PRICE[name ?? ''] ?? 100
    }

    buildings.buyGemEfficientHousing()

    expect(buyCalls).toEqual(['Collector'])
  })
})
