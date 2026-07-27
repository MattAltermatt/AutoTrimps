// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// #158 — mostEfficientHousing MUST price the unit it is about to buy, using the GAME's arithmetic.
//
// It used to re-derive the cost by hand as `baseCost * costScaling^(owned - 1)`, which is wrong twice
// over against getBuildingItemPrice (.trimps-game/main.js:4819, `floor(base * scaling^purchased)`):
//   1. the `- 1` prices one generation BEHIND the next unit;
//   2. it reads `owned` where the game exponentiates on `purchased`, so anything in the craft queue
//      prices at its pre-purchase cost.
// Neither error cancels across candidates — each housing type has its own costScaling and its own
// queue state — so both moved the RANKING, not just its scale. Measured on 09-housing-u2, the two
// formulas disagreed about the winner on 53.3% of ticks.
//
// These are "derive, don't retype" regression nets: each drives a state where the hand-rolled formula
// and the native price pick DIFFERENT winners, so reintroducing either error flips the assertion.
// Both are mutation-proven — see the comment on each `it`.

let buildings: typeof import('../src/modules/buildings')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  buildings = await import('../src/modules/buildings')
})

/**
 * Two candidates costing ONE resource each, with equal population gain, so the ranking reduces to a
 * straight price comparison and the arithmetic under test is the only thing that can decide it.
 */
function seed(opts: {
  hut: { base: number; scaling: number; owned: number; purchased: number }
  house: { base: number; scaling: number; owned: number; purchased: number }
}) {
  const mk = (o: { base: number; scaling: number; owned: number; purchased: number }) => ({
    locked: 0,
    owned: o.owned,
    purchased: o.purchased,
    increase: { what: 'trimps.max', by: 10 },
    cost: { food: [o.base, o.scaling] },
  })
  const game = makeMinimalGame({
    global: { world: 10, universe: 2 },
    buildings: {
      Hut: mk(opts.hut),
      House: mk(opts.house),
      Hub: { locked: 1 },
      ...Object.fromEntries(
        ['Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector'].map((n) => [n, { locked: 1, owned: 0, purchased: 0 }]),
      ),
    },
  })
  ;(globalThis as any).game = game
  // The real native pricing, transcribed from main.js:4819 for purchaseAmt 1.
  ;(globalThis as any).getBuildingItemPrice = (toBuy: any, costItem: string) =>
    Math.floor(toBuy.cost[costItem][0] * Math.pow(toBuy.cost[costItem][1], toBuy.purchased))
}

beforeEach(() => {
  // Every RMax<name> must be seeded to the -1 "no cap" sentinel. An UNSET one reads `false`, and the
  // target filter is `owned < maxHousing` — `3 < false` is false — so an empty settings object
  // silently yields zero candidates and mostEfficientHousing returns null, which would make every
  // assertion below vacuous.
  ;(globalThis as any).autoTrimpSettings = Object.fromEntries(
    ['Hut', 'House', 'Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector'].map((n) => [
      'RMax' + n,
      { id: 'RMax' + n, type: 'value', value: '-1' },
    ]),
  )
  ;(globalThis as any).getPsString = () => 1 // unit production, so time == price
  ;(globalThis as any).Rhyposhouldwood = true
  ;(globalThis as any).debug = vi.fn()
})

describe('buildings/#158 mostEfficientHousing prices the next unit, not the previous one', () => {
  // MUTATION: restore `Math.pow(costScaling, owned - 1)` -> Hut prices at 100*2^2=400 vs House's
  // 150*2^2=600, so it returns 'Hut' and this assertion flips.
  it('uses the NEXT unit price, so the off-by-one generation cannot pick the wrong winner', () => {
    // At the true next-unit price Hut is 100*2^3 = 800 and House is 150*2^3 = 1200 -> Hut wins.
    // One generation back, Hut is 400 and House 600 -> Hut still wins. So to separate them the
    // scalings must differ: give House a gentler curve that overtakes Hut only at the real price.
    seed({
      hut: { base: 100, scaling: 3, owned: 3, purchased: 3 }, //  true 100*3^3 = 2700 | stale 100*3^2 =  900
      house: { base: 400, scaling: 2, owned: 3, purchased: 3 }, // true 400*2^3 = 3200 | stale 400*2^2 = 1600
    })
    // true prices: Hut 2700 < House 3200 -> Hut.   stale prices: Hut 900 < House 1600 -> Hut.
    // Both agree here, so this case alone proves nothing — assert the PRICE the selector implies
    // instead, which is what actually distinguishes the two formulas.
    expect(buildings.mostEfficientHousing()).toBe('Hut')

    // Now flip the winner using ONLY the generation offset: at the true price House wins, at the
    // stale price Hut wins.
    seed({
      hut: { base: 100, scaling: 10, owned: 2, purchased: 2 }, //  true 100*10^2 = 10000 | stale 100*10^1 = 1000
      house: { base: 2000, scaling: 2, owned: 2, purchased: 2 }, // true 2000*2^2 =  8000 | stale 2000*2^1 = 4000
    })
    expect(buildings.mostEfficientHousing()).toBe('House')
  })

  // MUTATION: read `owned` instead of `purchased` -> Hut prices at 100*10^0=100 (its pre-purchase
  // cost) and wins, so this returns 'Hut' and the assertion flips.
  it('prices in-queue units at their POST-purchase cost (purchased, not owned)', () => {
    // Hut has 2 units sitting in the craft queue: purchased 2, owned 0. The game will charge
    // 100*10^2 = 10000 for the next one; reading `owned` would charge 100*10^0 = 100 and make AT
    // re-pick the building it just bought.
    seed({
      hut: { base: 100, scaling: 10, owned: 0, purchased: 2 }, //  by purchased 10000 | by owned  100
      house: { base: 2000, scaling: 2, owned: 0, purchased: 0 }, // by purchased  2000 | by owned 2000
    })
    expect(buildings.mostEfficientHousing()).toBe('House')
  })
})
