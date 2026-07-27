// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// #158 — AN EXECUTING WITNESS FOR A DEFECT WE HAVE DELIBERATELY NOT FIXED.
//
// `mostEfficientHousing` (src/modules/buildings.ts) re-derives a building's cost by hand as
// `baseCost * costScaling^(owned - 1)`. The game charges `floor(base * scaling^purchased)`
// (getBuildingItemPrice, .trimps-game/main.js:4819). Two errors, and neither cancels across
// candidates because housing scalings differ per tier (Hut 1.24 … Collector 1.12), so dividing each
// by a different factor moves the argmin:
//   1. the `- 1` prices one generation BEHIND the unit about to be bought;
//   2. it reads `owned` where the game exponentiates on `purchased`, so a queued unit prices at its
//      pre-purchase cost — which makes the selector re-pick what it just queued, safeBuyBuilding's
//      isBuildingInQueue guard reject it, and RbuyBuildings' do/while exit after one buy per tick.
//
// These tests pin the CURRENT (wrong) behaviour on purpose. They are not endorsing it — they exist
// so the defect executes on every CI run instead of living in a comment nobody re-checks, and so an
// accidental future "fix" goes RED and points here rather than silently moving the proof-net oracle.
// See the block comment at the call site for why it is parked: correcting it moves 09-housing-u2's
// trace, and the census fixtures' negative control cannot be satisfied by a waiver — only by
// re-pinning the oracle across 37+ commits, which the measured benefit does not justify.
//
// ⚠️ IF YOU ARE HERE BECAUSE THESE WENT RED: you have changed the pricing. That is fine, but it is
// #158, not a refactor. Read the call-site comment and the issue before regenerating anything.

let buildings: typeof import('../src/modules/buildings')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  buildings = await import('../src/modules/buildings')
})

/** Two single-resource candidates with equal population gain, so ranking reduces to price alone. */
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
  ;(globalThis as any).game = makeMinimalGame({
    global: { world: 10, universe: 2 },
    buildings: {
      Hut: mk(opts.hut),
      House: mk(opts.house),
      Hub: { locked: 1 },
      ...Object.fromEntries(
        ['Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector'].map((n) => [
          n,
          { locked: 1, owned: 0, purchased: 0 },
        ]),
      ),
    },
  })
}

/** The game's own pricing, transcribed from main.js:4819 for purchaseAmt 1. */
const nativePrice = (b: any, item: string) =>
  Math.floor(b.cost[item][0] * Math.pow(b.cost[item][1], b.purchased))

beforeEach(() => {
  // Every RMax<name> must be a real -1 sentinel. UNSET reads `false`, and the target filter is
  // `owned < maxHousing` — `3 < false` is false — so an empty settings object yields zero candidates
  // and mostEfficientHousing returns null, making every assertion below vacuously true.
  ;(globalThis as any).autoTrimpSettings = Object.fromEntries(
    ['Hut', 'House', 'Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector'].map((n) => [
      'RMax' + n,
      { id: 'RMax' + n, type: 'value', value: '-1' },
    ]),
  )
  ;(globalThis as any).getPsString = () => 1 // unit production, so time == price
  ;(globalThis as any).Rhyposhouldwood = true
  ;(globalThis as any).debug = vi.fn()
  ;(globalThis as any).getBuildingItemPrice = nativePrice
})

describe('#158 — mostEfficientHousing prices a unit the game never charges for', () => {
  it('picks the WRONG winner when the off-by-one generation decides it', () => {
    // Native: Hut 100*10^2 = 10000, House 2000*2^2 = 8000 -> House is genuinely cheaper.
    // Hand-rolled (owned-1): Hut 100*10^1 = 1000, House 2000*2^1 = 4000 -> picks Hut.
    seed({
      hut: { base: 100, scaling: 10, owned: 2, purchased: 2 },
      house: { base: 2000, scaling: 2, owned: 2, purchased: 2 },
    })
    const g = (globalThis as any).game
    expect(nativePrice(g.buildings.House, 'food')).toBeLessThan(nativePrice(g.buildings.Hut, 'food'))

    // The defect, pinned: it takes the more expensive building.
    expect(buildings.mostEfficientHousing()).toBe('Hut')
  })

  it('prices an in-queue unit at its PRE-purchase cost, so it re-picks what it just queued', () => {
    // Hut has 2 units in the craft queue: purchased 2, owned 0. The game will charge
    // 100*10^2 = 10000 for the next one; the hand-rolled formula charges 100*10^(0-1) = 10.
    seed({
      hut: { base: 100, scaling: 10, owned: 0, purchased: 2 },
      house: { base: 2000, scaling: 2, owned: 0, purchased: 0 },
    })
    const g = (globalThis as any).game
    expect(nativePrice(g.buildings.House, 'food')).toBeLessThan(nativePrice(g.buildings.Hut, 'food'))

    // The defect, pinned: the just-queued Hut still wins. safeBuyBuilding's isBuildingInQueue guard
    // then rejects it and RbuyBuildings' do/while exits, which is the one-buy-per-tick cap.
    expect(buildings.mostEfficientHousing()).toBe('Hut')
  })

  it('coincides with the game when scalings are equal and nothing is queued — why this hid so long', () => {
    // Documents the blind spot, and claims nothing more than that. With EQUAL scalings the `- 1`
    // becomes a common factor that cancels out of the ratio comparison, and with an empty queue
    // `owned === purchased`, so both errors vanish together and the two formulas agree on the winner
    // (native 800 vs 3200; hand-rolled 400 vs 1600 — same order).
    //
    // ⚠️ This is NOT a regression guard. Because both errors are neutralised here, this fixture also
    // passes under a PARTIAL fix (correcting either error alone) and under the full fix. It cannot
    // discriminate, and it is not mutation-proven — the two tests above are the gate. Its only job is
    // to record why casual testing misses this: pick two tiers with the same scaling and an idle
    // queue and the defect is invisible. Real housing scalings all differ (1.24 … 1.12), so the
    // coincidence never actually occurs in game — which is the point.
    seed({
      hut: { base: 100, scaling: 2, owned: 3, purchased: 3 },
      house: { base: 400, scaling: 2, owned: 3, purchased: 3 },
    })
    expect(buildings.mostEfficientHousing()).toBe('Hut')
  })
})
