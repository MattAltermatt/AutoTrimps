// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #177 / #205 — a refused buyMap() must not be recorded as a purchase.
//
// `buyMap()`'s 100-map guard sits INSIDE its affordability branch (.trimps-game/main.js:6588-6607):
//
//     if (cost > 0 && game.resources.fragments.owned >= cost){
//         if (game.global.mapsOwnedArray.length >= 100) { message("Woah, that's a lot of maps…"); return -2; }
//         game.resources.fragments.owned -= cost;  createMap(newLevel);  …  return 1;
//     }
//
// so AT's own `updateMapCost(true) <= fragments.owned` pre-check passes EXACTLY when `-2` comes back.
// Nothing is created, nothing is spent, and `mapsOwnedArray` is untouched — but the fork then set its
// bought flag unconditionally and read `mapsOwnedArray[length - 1].id`, which is the map the player
// already owned. All five praid slots bound the SAME id, the "Failed to Prestige Raid" bail was
// suppressed by the always-true flags, AT ran one leftover map five times, and with recycling on it
// spliced a map the player never meant to lose.
//
// The 96-99 band is the nastier half and is covered below: SOME buys succeed, so the raid reports five
// maps bought and silently skips up to four of its five target prestige levels.
//
// Reaching 100 is a consequence of AT's own behaviour, not an exotic state: `Praiding()` recycles only
// inside its `AutoMaps == 0` arm and `RAMPreset` only when `PR: Recycle` is on (default false), so each
// raid zone leaks up to five maps. `scripts/sim/make-fixtures.mjs` builds `07-map-cap-u1` around
// exactly this cap.

let praiding: typeof import('../src/modules/other-praiding')
let amp: typeof import('../src/modules/mapfunctions-amp')

const g = globalThis as any

/**
 * The observation point. `pMapN` / `repMapN` are NOT usable here: both engines run the map they just
 * bought inside the same call and then clear the slot (Praiding's `AutoMaps == 0` arm recycles and
 * blanks every `repMapN` before returning), so asserting on them reports `undefined` for a slot that
 * worked — and every "no id was captured" assertion would pass vacuously against a build with the
 * whole fix removed. `selectMap` is the durable evidence of which maps AT actually committed to.
 */
let selected: string[] = []
let recycled: unknown[] = []

/**
 * Every way `buyMap()` says no. `-2` is the cap; `-1` is an out-of-range map level; `-3` is the real
 * "you cannot afford it"; `undefined` is the paused-game path. A repair keyed to the ONE code the
 * finding happened to name (`!== -2`) passes every cap test and still adopts a phantom map on the
 * other three, so the fixture must be able to return each of them.
 */
const REFUSALS = [-2, -1, -3, undefined] as const

/** Faithful to main.js:6588-6607 + 6025 (createMap pushes to the tail). */
function installBuyMap(refusal: number | undefined = -2) {
  g.buyMapCalls = 0
  g.buyMap = () => {
    g.buyMapCalls++
    if (g.game.global.mapsOwnedArray.length >= 100) return refusal // the game refuses, spends nothing
    g.game.global.mapsOwnedArray.push({
      id: `new${g.game.global.mapsOwnedArray.length + 1}`,
      level: g.game.global.world,
      location: 'Plentiful',
      noRecycle: false,
    })
    return 1
  }
}

function ownMaps(n: number) {
  g.game.global.mapsOwnedArray = Array.from({ length: n }, (_, i) => ({
    id: `old${i + 1}`,
    level: 999,
    location: 'Plentiful',
    noRecycle: false,
  }))
}

const setMV = (id: string, value: unknown) => {
  g.autoTrimpSettings[id] = { type: 'multiValue', value }
}
const setBool = (id: string, enabled: boolean) => {
  g.autoTrimpSettings[id] = { type: 'boolean', enabled }
}

const WORLD = 495 // %10 === 5, so plusMapToRun5() clears pcheckmap5's gate

beforeAll(async () => {
  g.MODULES = {}
  g.autoTrimpSettings = {}
  g.getPlayerCritChance = () => 0 // read at module load (mapfunctions.ts:26)
  praiding = await import('../src/modules/other-praiding')
  amp = await import('../src/modules/mapfunctions-amp')
})

beforeEach(() => {
  document.body.innerHTML = `
    <select id="biomeAdvMapsSelect"><option value="Random"></option><option value="Depths"></option><option value="Plentiful"></option></select>
    <select id="advExtraLevelSelect"><option value="0"></option><option value="5"></option><option value="6"></option></select>
    <select id="advSpecialSelect"><option value="0"></option><option value="p"></option><option value="fa"></option></select>
    <input id="lootAdvMapsRange" value="0"><input id="difficultyAdvMapsRange" value="9">
    <input id="sizeAdvMapsRange" value="9">
    <span id="advPerfectCheckbox" class="niceCheckbox" data-checked="false"></span>
    <input id="mapLevelInput" value="${WORLD}">
    <div id="log"></div>`

  g.autoTrimpSettings = {
    AutoMaps: { type: 'multitoggle', value: 1 },
    RAutoMaps: { type: 'multitoggle', value: 1 },
  }
  g.selectedMap = undefined // maps.ts state RAMP writes on its run blocks (bridge global)
  g.game = {
    global: {
      world: WORLD,
      lastClearedCell: 98,
      challengeActive: '',
      preMapsActive: true,
      mapsActive: false,
      repeatMap: false,
      mapsOwnedArray: [],
      selectedMapPreset: 1,
    },
    resources: { fragments: { owned: Infinity } },
    // `timestamps` is read by message2 (utils.ts:258); untyped debug() calls always reach it.
    options: { menu: { repeatUntil: { enabled: 0 }, climbBw: { enabled: 0 }, timestamps: { enabled: 0 } } },
  }
  // Native collaborators AT calls through. Deliberately inert: this test is about ONE decision —
  // whether a refusal is recorded as a purchase — so nothing else may move state.
  g.updateMapCost = () => 1 // always affordable, which is precisely the -2 precondition
  selected = []
  recycled = []
  g.selectMap = (id: string) => selected.push(id)
  g.runMap = () => {}
  g.mapsClicked = () => {}
  g.repeatClicked = () => {}
  g.recycleMap = (idx: unknown) => recycled.push(idx)
  g.getMapIndex = (id: string) => id
  g.getCurrentMapObject = () => ({ id: 'x', level: WORLD, location: 'Plentiful' })
  g.RlastMapWeWereIn = undefined
  g.lastMapWeWereIn = undefined
  g.toggleSetting = () => {}
  g.swapNiceCheckbox = () => {}
  // debug() is a REAL import inside these modules, so it cannot be stubbed on globalThis — seed the
  // logging infra it reads as free globals instead (the maps.characterization precedent).
  g.enableDebug = false
  g.ATmessageLogTabVisible = false
  g.lastmessagecount = 0
  g.trimMessages = () => {}
  g.getCurrentTime = () => ''
  g.updatePortalTimer = () => ''
  g.message2 = () => {}
  installBuyMap()

  // U1 praid state
  for (const n of [1, 2, 3, 4, 5]) {
    g[`pMap${n}`] = undefined
    g[`mapbought${n}`] = false
    g[`repMap${n}`] = undefined
    g[`RAMPpMap${n}`] = undefined
    g[`RAMPmapbought${n}`] = false
  }
  g.prestraid = false
  g.failpraid = false
  g.prestraidon = false
  g.praidDone = false
  g.Rshoulddopraid = true
  g.RAMPfragmappy = undefined
  g.RAMPfragmappybought = false
  g.Rgetequips = () => 5 // prestiges outstanding, so every RAMP slot is armed
})

const boughtFlags = (prefix: string) => [1, 2, 3, 4, 5].map((n) => g[`${prefix}mapbought${n}`])

describe('U1 Praiding() at the game 100-map cap (#177)', () => {
  beforeEach(() => {
    setMV('Praidingzone', [WORLD])
    setMV('Praidingcell', [-1])
  })

  it.each(REFUSALS)('commits to no map at all when every buy is refused with %s', (refusal) => {
    installBuyMap(refusal)
    ownMaps(100)
    praiding.Praiding()

    expect(g.buyMapCalls).toBeGreaterThan(0) // the buy really was attempted — not gated out upstream
    // FAILED BEFORE THE FIX: every `mapboughtN = true` ran unconditionally and every `pMapN` was bound
    // to `old100`, so AT selected and ran one map the player already owned, five times over.
    expect(selected).toEqual([])
    // Nothing was created and nothing was spent — and, critically, none of the player's own maps was
    // recycled. That splice was the irreversible half of this bug.
    expect(g.game.global.mapsOwnedArray).toHaveLength(100)
    expect(recycled).toEqual([])
    // With no flag latched, the existing "can't afford / too weak" bail is reachable again; before the
    // fix the always-true flags suppressed it and the failure was never surfaced to the user at all.
    expect(g.failpraid).toBe(true)
    // And no slot is left holding a phantom id. This is the assertion that catches the near-miss that
    // gates the FLAG but still captures `mapsOwnedArray[length - 1].id`: the buy block is guarded by
    // `pMapN == undefined`, so a stale id parks that slot permanently — nothing ever retries it.
    expect([g.pMap1, g.pMap2, g.pMap3, g.pMap4, g.pMap5]).toEqual([
      undefined, undefined, undefined, undefined, undefined,
    ])
  })

  it('commits only to genuinely-new maps in the 96-99 band, never an alias', () => {
    // The nastier half: SOME buys succeed. Before the fix the refused slots all aliased the same
    // pre-existing id, so the raid reported five maps bought and ran one map five times.
    ownMaps(98)
    praiding.Praiding()

    expect(selected.length).toBeGreaterThan(0)
    expect(new Set(selected).size).toBe(selected.length) // no map is run twice
    for (const id of selected) expect(id.startsWith('new')).toBe(true) // never a pre-existing map
    // Exactly as many maps were created as AT committed to — nothing was invented.
    expect(g.game.global.mapsOwnedArray.length).toBe(98 + selected.length)
    for (const id of recycled) expect(String(id).startsWith('new')).toBe(true)

    // No slot is left PARKED. This is the assertion that catches the near-miss which gates the flag
    // but still captures `mapsOwnedArray[length - 1].id`: a refused slot keeps a phantom id, and both
    // its buy block (`pMapN == undefined`) and the raid-complete transition at :1129 (which requires
    // every `pMapN` undefined) are then blocked forever. In the all-refused case the failure bail
    // blanks them anyway, so ONLY the partial band can see this — which is why it is asserted here.
    expect([g.pMap1, g.pMap2, g.pMap3, g.pMap4, g.pMap5]).toEqual([
      undefined, undefined, undefined, undefined, undefined,
    ])
  })

  it('still buys and runs all five with room to spare (the fix must not break the working case)', () => {
    ownMaps(10)
    praiding.Praiding()
    // Bought slot-5-first (highest prestige, so `new11` is slot 5) and RUN slot-1-first, hence the
    // reversal. Pinned as an ordered list rather than a set because that ordering is the raid.
    expect(selected).toEqual(['new15', 'new14', 'new13', 'new12', 'new11'])
    expect(g.game.global.mapsOwnedArray).toHaveLength(15)
  })
})

describe('U2 RAMP() at the game 100-map cap (#205)', () => {
  beforeEach(() => {
    setMV('RAMPraidzone', [WORLD])
    setMV('RAMPraidraid', [WORLD + 5])
    setMV('RAMPraidcell', [-1])
    setBool('RAMPraidrecycle', false)
    g.autoTrimpSettings['RAMPraidfrag'] = { type: 'multitoggle', value: 0 } // skip the frag-farm arm
  })

  it.each(REFUSALS)('records nothing when every buy is refused with %s', (refusal) => {
    installBuyMap(refusal)
    ownMaps(100)
    amp.RAMP()

    expect(g.buyMapCalls).toBe(5)
    expect(boughtFlags('RAMP')).toEqual([false, false, false, false, false])
    expect(selected).toEqual([])
    expect(g.game.global.mapsOwnedArray).toHaveLength(100)
    expect([g.RAMPpMap1, g.RAMPpMap2, g.RAMPpMap3, g.RAMPpMap4, g.RAMPpMap5]).toEqual([
      undefined, undefined, undefined, undefined, undefined,
    ])
  })

  it('binds five DISTINCT ids in the partial band instead of aliasing one map', () => {
    ownMaps(99) // only the first buy can succeed
    amp.RAMP()
    expect(new Set(selected).size).toBe(selected.length)
    expect(selected.every((id) => id.startsWith('new'))).toBe(true)
    expect(g.game.global.mapsOwnedArray.length).toBe(99 + selected.length)
  })

  it('buys all five with room to spare', () => {
    ownMaps(0)
    amp.RAMP()
    expect(boughtFlags('RAMP')).toEqual([true, true, true, true, true])
    expect(new Set(selected).size).toBe(5)
  })
})
