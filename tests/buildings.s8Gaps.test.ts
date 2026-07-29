// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// S8 gap closure — #200 and #245 shipped WITHOUT a test that fails without them, which the campaign
// plan forbids outright ("Every fix ships a test that fails without it. No exceptions"). A fresh
// reviewer found the reason each was invisible to the existing characterization suite, and both
// reasons are the same shape the repo has been bitten by four times: the code is REACHED but its
// answer feeds a state that cannot depend on it.
//
//   #200 — every mostEfficientHousing test uses the shared bld() fixture, which hardcodes
//          `base.Hub = { locked: 1 }` and is never overridden. The whole fix lives inside
//          `if (!game.buildings.Hub.locked)`, so no test in that file executes a single line of it.
//   #245 — every buyBuildings test sets `Wormhole: { locked: 1 }`, so the clamp never runs.
//
// This file is separate rather than appended so the gap closure is legible as one unit in review.

let buildings: typeof import('../src/modules/buildings')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  buildings = await import('../src/modules/buildings')
})

type BuyCall = { building: unknown; buyAmt: unknown; args: unknown[] }
let buyCalls: BuyCall[]

const ALL_BUILDINGS = [
  'Hut', 'House', 'Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector', 'Warpstation',
  'Wormhole', 'Gym', 'Tribute', 'Nursery', 'Barn', 'Shed', 'Forge', 'Smithy', 'Microchip',
  'Laboratory',
]

beforeEach(() => {
  document.body.innerHTML = ''
  for (const id of ALL_BUILDINGS) {
    const d = document.createElement('div')
    d.id = id
    document.body.appendChild(d)
  }
  buyCalls = []
  ;(globalThis as any).buyBuilding = vi.fn((...args: unknown[]) => {
    buyCalls.push({ building: args[0], buyAmt: (globalThis as any).game.global.buyAmt, args })
  })
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
  ;(globalThis as any).autoBattle = { oneTimers: { Collectology: { owned: false, getHubs: () => 1 } } }
  // Mirrors the module-load cutoffs (buildings.ts:19-21); a bare {} would NaN the buyStorage
  // thresholds. Deliberately WITHOUT `upgrades: { autoGigas: false }` — the characterization file's
  // beforeEach injects that, but production never writes it (it is a grandfathered entry in
  // tests/nets/modules-fields.ts's KNOWN_TEST_LIE, a SHRINKING baseline). Copying the stub set
  // wholesale added a third instance and that net caught it. Production sees `undefined` there,
  // which is falsy, so omitting it is also the more faithful fixture.
  ;(globalThis as any).MODULES = {
    buildings: { storageMainCutoff: 0.85, storageLowlvlCutoff1: 0.7, storageLowlvlCutoff2: 0.5 },
  }
})

afterEach(() => {
  for (const k of [
    'game', 'autoTrimpSettings', 'isBuildingInQueue', 'preBuy2', 'postBuy2', 'bwRewardUnlocked',
    'canAffordBuilding', 'buyBuilding', 'getBuildingItemPrice', 'calculateMaxAfford',
    'canAffordCoordinationTrimps', 'calcOurBlock', 'getPierceAmt', 'calcSpecificEnemyAttack',
    'calcBadGuyDmg', 'getEnemyMaxAttack', 'calcOurHealth', 'evaluateEquipmentEfficiency',
    'isActiveSpireAT', 'disActiveSpireAT', 'calcHeirloomBonus', 'simpleSeconds', 'scaleToCurrentMap',
    'smithylogic', 'getPsString', 'toggleAutoStorage', 'questcheck', 'RcalcHDratio',
    'getMaxAffordable', 'Rhyposhouldwood', 'bestBuilding', 'autoBattle',
  ]) delete (globalThis as any)[k]
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// #200 — the Hub population bonus
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('#200 — mostEfficientHousing mirrors the game\'s Hub grant, not +500', () => {
  const RMAX_UNLIMITED: Record<string, unknown> = {}
  for (const h of ['Hut', 'House', 'Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector']) {
    RMAX_UNLIMITED['RMax' + h] = { type: 'valueNegative', value: -1 }
  }

  /**
   * Two candidates only, with the REAL game population gains (config.js: Hut 3, Collector 5000) and
   * a Hub that is UNLOCKED — the state the shared bld() fixture can never produce.
   *
   * The scoring is worstTime = baseCost * scaling^(owned-1) / (avgProduction * housingBonus), argmin.
   * Scaling is 1 and getPsString is pinned at 1, so worstTime reduces to baseCost / housingBonus.
   * Costs are picked so the buggy and fixed builds DISAGREE, which is the only thing that can go red:
   *
   *   housingBonus     Hut            Collector      winner
   *   ---------------  -------------  -------------  ---------
   *   bug   (+500)     3+500  =  503  5000+500=5500  Collector   1000/503 = 1.99 > 5000/5500 = 0.91
   *   fixed (+25000)   3+25000=25003  5000+25000     Hut         1000/25003= .04 < 5000/30000 = .167
   *
   * Understating the shared Hub term compresses a 1667x spread in own-gain into near-parity, which is
   * exactly why the error does not cancel out of the argmin.
   */
  function twoCandidateGame(collectology = false): any {
    const b: Record<string, any> = {}
    for (const id of ALL_BUILDINGS) b[id] = { locked: 1, owned: 0, purchased: 0, increase: { by: 3 } }
    b.Hut = { locked: 0, owned: 0, purchased: 0, increase: { by: 3 }, cost: { food: [1000, 1] } }
    b.Collector = { locked: 0, owned: 0, purchased: 0, increase: { by: 5000 }, cost: { gems: [5000, 1] } }
    b.Hub = { locked: 0, owned: 0, purchased: 0, increase: { by: 25000 } }
    ;(globalThis as any).autoBattle = {
      oneTimers: { Collectology: { owned: collectology, getHubs: () => 4 } },
    }
    return makeMinimalGame({ buildings: b })
  }

  it('anti-false-green: with the Hub LOCKED the bonus is absent and the cheap-per-pop Collector wins', () => {
    // This is the state the existing suite is permanently stuck in. It proves the fixture reaches the
    // selector at all, and that the Hub branch is what flips the answer below — not some other term.
    ;(globalThis as any).autoTrimpSettings = { ...RMAX_UNLIMITED }
    const game = twoCandidateGame()
    game.buildings.Hub.locked = 1
    ;(globalThis as any).game = game
    expect(buildings.mostEfficientHousing()).toBe('Collector')
  })

  it('with the Hub UNLOCKED the 25000-per-unit grant flips the winner to Hut', () => {
    // Under the old `+= 500` this returns 'Collector'. That is the whole bug: a 50x understatement
    // of a term shared by both candidates still moves the argmin, because it is added to per-candidate
    // gains that differ by three orders of magnitude.
    ;(globalThis as any).autoTrimpSettings = { ...RMAX_UNLIMITED }
    ;(globalThis as any).game = twoCandidateGame()
    expect(buildings.mostEfficientHousing()).toBe('Hut')
  })

  it('Collectology multiplies the Collector\'s Hub grant and wins it back', () => {
    // The one case where the Hub term is NOT uniform across candidates, so it is the case most able
    // to move the argmin — and the one a flat `+= 25000` constant would silently get wrong.
    //   Collector bonus = 5000 + 25000*4 = 105000 → 5000/105000 = 0.0476
    //   Hut       bonus = 3    + 25000   =  25003 → 1000/25003  = 0.0400
    // Still Hut. Push the Hut's cost up so Collectology is the deciding term:
    ;(globalThis as any).autoTrimpSettings = { ...RMAX_UNLIMITED }
    const game = twoCandidateGame(true)
    game.buildings.Hut.cost = { food: [2000, 1] } // 2000/25003 = 0.0800 > 0.0476
    ;(globalThis as any).game = game
    expect(buildings.mostEfficientHousing()).toBe('Collector')

    // And with Collectology OFF at the same costs the Collector loses, so the assertion above is
    // carried by getHubs() and nothing else.
    const off = twoCandidateGame(false)
    off.buildings.Hut.cost = { food: [2000, 1] } // 2000/25003 = 0.0800 < 5000/30000 = 0.1667
    ;(globalThis as any).game = off
    expect(buildings.mostEfficientHousing()).toBe('Hut')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// #245 — the U1 Wormhole cap clamp
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('#245 — buyBuildings clamps the Wormhole stack to the room under MaxWormhole', () => {
  function wormholeGame(purchased: number) {
    const b: Record<string, any> = {}
    for (const id of ALL_BUILDINGS) b[id] = { locked: 1, owned: 0, purchased: 0, increase: { by: 3 } }
    b.Wormhole = { locked: 0, owned: purchased, purchased, increase: { by: 3 } }
    b.Hub = { locked: 1 }
    return makeMinimalGame({
      global: { buyAmt: 1, firing: false, maxSplit: 1, world: 5, challengeActive: '', brokenPlanet: false, formation: 0 },
      buildings: b,
      equipment: { Shield: { blockNow: false } },
      upgrades: { Gymystic: { allowed: 0, done: 0, modifier: 1 } },
      portal: { Resourceful: { modifier: 0, level: 0 } },
    })
  }

  it('DecaBuild + 3 slots left under the cap → buys exactly 3, not a full stack of 10', () => {
    // The bug: the gate tested `owned < MaxWormhole` and then handed safeBuyBuilding NO amount, so the
    // 10 → 2 → 1 ladder bought 10 and overshot the cap by 7. Wormholes are priced in HELIUM, which is
    // helium not spent on perks at the next portal.
    ;(globalThis as any).bwRewardUnlocked = (r: string) => r === 'DecaBuild'
    ;(globalThis as any).autoTrimpSettings = {
      MaxWormhole: { type: 'value', value: 10 },
      BuyBuildingsNew: { type: 'multitoggle', value: 1 },
      hidebuildings: { type: 'boolean', value: false },
    }
    ;(globalThis as any).game = wormholeGame(7)
    buildings.buyBuildings()

    const wh = buyCalls.filter((c) => c.building === 'Wormhole')
    expect(wh).toHaveLength(1)
    // safeBuyBuilding's amount path forwards the stack size as the 4th native argument.
    expect(wh[0].args[3]).toBe(3)
  })

  it('room LARGER than the bulk size still buys only the bulk size — the clamp is a min, not an override', () => {
    // Near-miss mutant: passing `room` directly instead of Math.min(bulkBuyAmount(), room) would buy
    // 50 here, silently discarding the DecaBuild ladder's meaning.
    ;(globalThis as any).bwRewardUnlocked = (r: string) => r === 'DecaBuild'
    ;(globalThis as any).autoTrimpSettings = {
      MaxWormhole: { type: 'value', value: 50 },
      BuyBuildingsNew: { type: 'multitoggle', value: 1 },
      hidebuildings: { type: 'boolean', value: false },
    }
    ;(globalThis as any).game = wormholeGame(0)
    buildings.buyBuildings()

    const wh = buyCalls.filter((c) => c.building === 'Wormhole')
    expect(wh).toHaveLength(1)
    expect(wh[0].args[3]).toBe(10)
  })

  it('at the cap exactly, nothing is bought', () => {
    ;(globalThis as any).bwRewardUnlocked = (r: string) => r === 'DecaBuild'
    ;(globalThis as any).autoTrimpSettings = {
      MaxWormhole: { type: 'value', value: 10 },
      BuyBuildingsNew: { type: 'multitoggle', value: 1 },
      hidebuildings: { type: 'boolean', value: false },
    }
    ;(globalThis as any).game = wormholeGame(10)
    buildings.buyBuildings()
    expect(buyCalls.filter((c) => c.building === 'Wormhole')).toEqual([])
  })

  it('MaxWormhole 0 means NEVER BUY — its documented semantics, and #214 must not change them', () => {
    // MaxWormhole is one of the two shipped defaults that depend on 0 meaning "never build" (the other
    // is RMaxLabs). It is the reason the #214 panel could not adopt `< 1` as a global uncap rule, so
    // this assertion is also the guard on that decision.
    ;(globalThis as any).bwRewardUnlocked = (r: string) => r === 'DecaBuild'
    ;(globalThis as any).autoTrimpSettings = {
      MaxWormhole: { type: 'value', value: 0 },
      BuyBuildingsNew: { type: 'multitoggle', value: 1 },
      hidebuildings: { type: 'boolean', value: false },
    }
    ;(globalThis as any).game = wormholeGame(0)
    buildings.buyBuildings()
    expect(buyCalls.filter((c) => c.building === 'Wormhole')).toEqual([])
  })
})
