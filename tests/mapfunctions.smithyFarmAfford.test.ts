// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #300 — Smithy Farming stands down once the remaining Smithies are already affordable.
//
// RsmithyCalc's four result blocks are ALL guarded by `!afford`, so with an affordable goal it fell
// off the end and returned `undefined`, which five call sites consumed differently. The worst was
// RselectSmithy: a map created with no special has `bonus === undefined`, and `undefined == undefined`
// is TRUE, so the match loop bound to any unrelated bonus-less map AT owned.
//
// The window was long, not a race: the game increments Smithy.owned only when the build QUEUE
// completes while `purchased` increments at buy time, so `afford && owned < target` held for the
// whole build.

const G = globalThis as any
let mf: typeof import('../src/modules/mapfunctions')

beforeAll(async () => {
  G.MODULES = {}
  G.Decimal = (await import('decimal.js')).default
  document.body.insertAdjacentHTML("beforeend",
    `<div id="trimps"><div class="row"></div></div><div id="trimpsFighting"></div>` +
    `<select id="biomeAdvMapsSelect"><option>Random</option><option>Farmlands</option><option>Plentiful</option><option>Depths</option></select>` +
    `<select id="advSpecialSelect"><option>0</option><option>lc</option><option>hc</option><option>lwc</option><option>swc</option><option>lmc</option><option>smc</option></select>` +
    `<input id="mapLevelInput"><select id="advExtraLevelSelect"><option>0</option><option>1</option><option>2</option></select>`)
  // mapfunctions.ts evaluates `2 < getPlayerCritChance()` at IMPORT time (mapfunctions.ts:26). A
  // suite that cannot load reports as SKIPPED rather than red, which is the one outcome that looks
  // like nothing is wrong — so seed it before the import, not in a beforeEach.
  G.getPlayerCritChance = () => 0
  mf = await import('../src/modules/mapfunctions')
})

let affordable: boolean

function arm(over: { owned?: number; target?: number; cell?: number; world?: number } = {}) {
  const world = over.world ?? 200
  affordable = true
  G.canAffordBuilding = () => affordable
  // A real price, so the unaffordable arms actually see a NEGATIVE deficit — with a price of 0 the
  // `smithywood < 0` tests never fire and RsmithyCalc returns undefined for the wrong reason.
  G.getBuildingItemPrice = () => 100
  G.getHighestLevelCleared = () => 100
  // RmapLevelCalc (reached via RsmithyCalc(true, ...)) reads the U2 HD ratio.
  G.RcalcHDratio = () => 1.5
  G.updateMapCost = () => 0
  G.RfragCalc = () => {}
  G.byId = (id: string) => document.getElementById(id)
  // mapfunctions reads this as a BARE identifier; jsdom's named-element window access does not reach
  // the module's globalThis, so publish it the way the bridge does.
  G.biomeAdvMapsSelect = document.getElementById('biomeAdvMapsSelect')
  G.autoTrimpSettings = {
    Rsmithyfarmzone: { type: 'multiValue', value: [String(world)] },
    Rsmithyfarmcell: { type: 'multiValue', value: ['1'] },
    Rsmithyfarmamount: { type: 'multiValue', value: [String(over.target ?? 10)] },
  }
  G.game = {
    global: { world, lastClearedCell: 90, farmlandsUnlocked: true, mapsOwnedArray: [] },
    buildings: { Smithy: { owned: over.owned ?? 0 } },
    resources: { wood: { owned: 0 }, metal: { owned: 0 }, gems: { owned: 0 }, fragments: { owned: 1e9 } },
  }
  G.Rshouldsmithyfarm = false
}

beforeEach(() => arm())

describe('#300 — the Rshouldsmithyfarm gate requires an UNAFFORDABLE goal', () => {
  it('anti-false-green: it DOES engage when the goal is unaffordable', () => {
    // Without this every "stands down" assertion is satisfiable by a gate that never fires.
    arm({ owned: 0, target: 10 })
    affordable = false
    mf.RsmithyFarm(false)
    expect(G.Rshouldsmithyfarm).toBe(true)
  })

  it('stands down when the remaining Smithies are already affordable', () => {
    arm({ owned: 0, target: 10 })
    affordable = true
    mf.RsmithyFarm(false)
    expect(G.Rshouldsmithyfarm).toBe(false)
  })

  it('still stands down when the target is already met, regardless of affordability', () => {
    arm({ owned: 10, target: 10 })
    affordable = false
    mf.RsmithyFarm(false)
    expect(G.Rshouldsmithyfarm).toBe(false)
  })

  it('the `amount` accessor is unaffected — it must keep returning the target', () => {
    arm({ owned: 0, target: 7 })
    expect(mf.RsmithyFarm(true)).toBe(7)
  })
})

describe('#300 — RsmithyCalc returns undefined in the affordable state, and consumers refuse it', () => {
  it('the affordable state really does produce undefined (the root the gate exists for)', () => {
    arm({ owned: 0, target: 10 })
    affordable = true
    expect(mf.RsmithyCalc(false, true, false, false)).toBeUndefined()
    expect(mf.RsmithyCalc(false, false, true, false)).toBeUndefined()
    expect(mf.RsmithyCalc(false, false, false, true)).toBeUndefined()
  })

  it('and produces real values when unaffordable — so the above is about afford, not the fixture', () => {
    arm({ owned: 0, target: 10 })
    affordable = false
    expect(typeof mf.RsmithyCalc(false, true, false, false)).toBe('string')
    expect(typeof mf.RsmithyCalc(false, false, true, false)).toBe('string')
  })

  it('RselectSmithy refuses to match on an undefined special', () => {
    arm({ owned: 0, target: 10 })
    affordable = true
    // A bonus-less owned map at exactly the level the match loop wants — the LEVEL has to line up or
    // the loop bails before it ever reaches the `bonus` comparison, and the test proves nothing.
    // (The first version planted it at world level while RmapLevelCalc returns 1 here; the guard
    // mutant survived 8/8 because the loop never got that far.)
    const levelzones = mf.RsmithyCalc(true, false, false, false) as number
    expect(levelzones).not.toBe(0)
    const bonusless = { noRecycle: false, level: 200 + levelzones, bonus: undefined, id: 'map99' }
    expect(bonusless.bonus == mf.RsmithyCalc(false, false, true, false)).toBe(true)
    G.game.global.mapsOwnedArray = [bonusless]
    expect(mf.RselectSmithy()).toBe('create')
  })

  it('RsmithyFarmMap leaves the selects alone rather than writing undefined into them', () => {
    // The game reads these RAW: updateMapCost does `if (biomeAdvMapsSelect.value != "Random")
    // baseCost *= 2`, and assigning undefined lands as "" — so the pre-fix map was DOUBLE-priced and
    // named "<prefix> undefined". A sentinel proves the write did not happen at all.
    arm({ owned: 0, target: 10 })
    affordable = true
    const biome = document.getElementById('biomeAdvMapsSelect') as HTMLSelectElement
    const special = document.getElementById('advSpecialSelect') as HTMLSelectElement
    biome.value = 'Random'
    special.value = '0'
    mf.RsmithyFarmMap()
    expect(biome.value).toBe('Random')
    expect(special.value).toBe('0')
  })

  it('...and DOES write them when there is a real shortfall to farm', () => {
    arm({ owned: 0, target: 10 })
    affordable = false
    const biome = document.getElementById('biomeAdvMapsSelect') as HTMLSelectElement
    const special = document.getElementById('advSpecialSelect') as HTMLSelectElement
    biome.value = 'Random'
    special.value = '0'
    mf.RsmithyFarmMap()
    expect(biome.value).not.toBe('Random')
    expect(special.value).not.toBe('0')
    expect(special.value).not.toBe('undefined')
  })

  it('RselectSmithy still matches a genuinely correct map when the special is real', () => {

    arm({ owned: 0, target: 10 })
    affordable = false
    const special = mf.RsmithyCalc(false, false, true, false)
    const levelzones = mf.RsmithyCalc(true, false, false, false)
    G.game.global.mapsOwnedArray = [
      { noRecycle: false, level: 200 + (levelzones as number), bonus: special, id: 'map42' },
    ]
    expect(mf.RselectSmithy()).toBe('map42')
  })
})

describe('#225 — RmapLevelCalc\'s negative ladder reaches -2 and -3', () => {
  // The three negative arms are separate `if`s, so ORDER decides the answer: they used to test the
  // LARGEST threshold first, and any HD past 10000 also passes 5000 and 500, so -1 always won and
  // -2/-3 were dead stores. The positive ladder below them is ordered loosest-first, which is what
  // makes the same last-write-wins idiom correct there.
  //
  // HD is `RcalcHDratio() / 1.5`, so the stub is the threshold times 1.5.
  const levelAt = (hd: number) => {
    G.RcalcHDratio = () => hd * 1.5
    return mf.RmapLevelCalc()
  }

  it.each([
    [20000, -3], [10000, -3],
    [9999, -2], [5000, -2],
    [4999, -1], [500, -1],
    [499, 0], [40, 0],
    // Positive rows sit just INSIDE each band rather than exactly on the boundary: the stub feeds
    // `hd * 1.5` and production divides by 1.5 again, so 0.1 round-trips to 0.10000000000000002 and
    // fails its own `<= 0.1`. That is an artifact of driving the ratio through the stub, not a
    // production defect — the #225-critical negative rows are integers and land exactly.
    [0.9, 1], [0.4, 2], [0.09, 3], [0.04, 4], [0.009, 5], [0.004, 6], [0.00009, 7], [0.00004, 8],
  ])('HD %f -> level %i', (hd, expected) => {
    expect(levelAt(hd as number)).toBe(expected)
  })

  it('anti-false-green: the ladder is monotone and actually spans -3..8', () => {
    // If every row collapsed to one value the table above would be trivially satisfiable.
    const seen = [20000, 9999, 4999, 499, 0.9, 0.00004].map((hd) => levelAt(hd))
    expect(new Set(seen).size).toBe(6)
    expect(Math.min(...seen)).toBe(-3)
    expect(Math.max(...seen)).toBe(8)
  })
})
