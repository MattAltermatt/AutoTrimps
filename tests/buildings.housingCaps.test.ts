// @vitest-environment jsdom
//
// #95 — RbuyBuildings must never read an INDEX-KEYED housing cap.
//
// A `housingTargets` pre-filter in RbuyBuildings iterated `for (const house in HousingTypes)`. `for..in`
// over an ARRAY yields the index STRINGS '0'..'6', so the cap lookup was getPageSetting('RMax0') …
// getPageSetting('RMax6') — seven ids that were never createSetting'd, every one returning `false`. The
// array it built was then never read. The identical filter already lives, correctly, inside
// mostEfficientHousing() (`for..of`, real `RMax<name>` ids), which is what the buy loop actually calls.
//
// This net pins the OBSERVABLE consequence rather than the source text: drive RbuyBuildings() and record
// every settings key it touches. Restoring the deleted loop makes RMax0..RMax6 reappear in the log and
// turns this red. The anti-false-green half is just as load-bearing — it asserts the housing path really
// executed by requiring the REAL `RMax<name>` ids to show up.
//
// Why the settings-reverse net did NOT catch this: its ALLOWED_DYNAMIC list waves through the
// non-literal argument `'RMax' + house` as "keyed by housing name". At the buggy site `house` was an
// index, not a name — the allowlist entry was laundering the bug. A dynamic id is only as safe as the
// claim written next to it.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'

let buildings: typeof import('../src/modules/buildings')

// Imported once, before any test wipes the body — utils.ts appends its log-filter button at load.
beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  buildings = await import('../src/modules/buildings')
})

/** Every settings id getPageSetting looked up during the run. */
let touched: string[]

const ALL_BUILDINGS = [
  'Hut', 'House', 'Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector', 'Warpstation',
  'Wormhole', 'Gym', 'Tribute', 'Nursery', 'Barn', 'Shed', 'Forge', 'Smithy', 'Microchip',
  'Laboratory',
]

const HOUSING = ['Hut', 'House', 'Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector']

/**
 * getPageSetting's first act is `autoTrimpSettings.hasOwnProperty(id)`, which on a Proxy runs the
 * getOwnPropertyDescriptor trap — so this records EVERY id the module asks for, including the ones that
 * do not exist. That is the whole point: the phantoms are invisible to a scan of the settings that DO.
 */
function recordingSettings(seed: Record<string, unknown>) {
  return new Proxy(seed, {
    getOwnPropertyDescriptor(t, p) {
      if (typeof p === 'string') touched.push(p)
      return Reflect.getOwnPropertyDescriptor(t, p)
    },
  })
}

function value(id: string, v: number) {
  return { id, name: id, type: 'value', value: String(v) }
}

beforeEach(() => {
  touched = []
  document.body.innerHTML = ''
  for (const id of ALL_BUILDINGS) {
    const d = document.createElement('div')
    d.id = id
    document.body.appendChild(d)
  }

  const seed: Record<string, unknown> = {
    // Every real housing cap, generous so the buy loop is free to run.
    ...Object.fromEntries(HOUSING.map((h) => [`RMax${h}`, value(`RMax${h}`, 100)])),
    RMaxTribute: value('RMaxTribute', -1),
    RMaxLabs: value('RMaxLabs', 0),
    Rnurtureon: { id: 'Rnurtureon', name: 'Rnurtureon', type: 'boolean', enabled: false },
    Rhypostorage: { id: 'Rhypostorage', name: 'Rhypostorage', type: 'boolean', enabled: false },
  }
  ;(globalThis as any).autoTrimpSettings = recordingSettings(seed)

  const base: Record<string, any> = {}
  for (const id of ALL_BUILDINGS) {
    base[id] = { locked: 0, owned: 0, purchased: 0, cost: { wood: [100, 1.2] }, increase: { what: 'trimps.max', by: 3 } }
  }
  base.Hub = { locked: 1 }
  base.Smithy.locked = 1
  base.Microchip.locked = 1
  base.Tribute.locked = 1
  base.Laboratory.locked = 1

  ;(globalThis as any).MODULES = { buildings: {} }
  ;(globalThis as any).game = {
    global: { world: 20, autoStorage: true, challengeActive: '', buyAmt: 1 },
    buildings: base,
    resources: { wood: { owned: 0, max: 1e6 } },
  }
  ;(globalThis as any).getPsString = () => 1
  ;(globalThis as any).toggleAutoStorage = vi.fn()
  ;(globalThis as any).canAffordBuilding = () => false // let mostEfficientHousing run, then stop the do/while
  ;(globalThis as any).buyBuilding = vi.fn()
  // #83 §1 wrapped RbuyBuildings in preBuy2()/postBuy2() and pinned game.global.buyAmt = 1, because the
  // bare canAffordBuilding() gates were pricing the player's ambient UI buy-amount (10/25/100) and then
  // buying ONE — so U2 housing died for anyone not on 1 or Max. These are free globals from the legacy
  // seam; this fixture predates that fix and did not stub them.
  ;(globalThis as any).preBuy2 = () => (globalThis as any).game.global.buyAmt
  ;(globalThis as any).postBuy2 = (old: unknown) => {
    ;(globalThis as any).game.global.buyAmt = old
  }
  ;(globalThis as any).getMaxAffordable = () => 1
  ;(globalThis as any).isBuildingInQueue = () => false
  ;(globalThis as any).calcHeirloomBonus = (_a: unknown, _b: unknown, v: number) => v
  ;(globalThis as any).Rhyposhouldwood = true
})

afterEach(() => {
  for (const k of [
    'game', 'autoTrimpSettings', 'MODULES', 'getPsString', 'toggleAutoStorage', 'canAffordBuilding',
    'buyBuilding', 'getMaxAffordable', 'isBuildingInQueue', 'calcHeirloomBonus', 'Rhyposhouldwood',
  ]) delete (globalThis as any)[k]
})

describe('#95 — RbuyBuildings reads housing caps by NAME, never by index', () => {
  it('reads no RMax<index> phantom (RMax0..RMax6)', () => {
    buildings.RbuyBuildings()

    const phantoms = touched.filter((id) => /^RMax\d+$/.test(id))
    expect(phantoms, `RbuyBuildings read index-keyed housing caps: ${[...new Set(phantoms)].join(', ')}`).toEqual([])
  })

  it('ANTI-FALSE-GREEN: it does read the real RMax<name> caps, so the housing path really ran', () => {
    buildings.RbuyBuildings()

    for (const h of HOUSING) {
      expect(touched, `RMax${h} was never read — the housing path did not execute`).toContain(`RMax${h}`)
    }
  })

  it('mostEfficientHousing honours a by-NAME cap (the filter the deleted loop was aping)', () => {
    // Cap Huts at 0 while everything else stays open: the selector must not return 'Hut'.
    ;(globalThis as any).autoTrimpSettings.RMaxHut = value('RMaxHut', 0)
    expect(buildings.mostEfficientHousing()).not.toBe('Hut')

    // With the cap lifted, Hut is the cheapest housing in this fixture and wins.
    ;(globalThis as any).autoTrimpSettings.RMaxHut = value('RMaxHut', 100)
    expect(buildings.mostEfficientHousing()).toBe('Hut')
  })
})
