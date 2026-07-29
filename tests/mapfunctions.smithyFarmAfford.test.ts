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
  document.body.insertAdjacentHTML('beforeend', `<div id="trimps"><div class="row"></div></div><div id="trimpsFighting"></div>`)
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
  G.autoTrimpSettings = {
    Rsmithyfarmzone: { type: 'multiValue', value: [String(world)] },
    Rsmithyfarmcell: { type: 'multiValue', value: ['1'] },
    Rsmithyfarmamount: { type: 'multiValue', value: [String(over.target ?? 10)] },
  }
  G.game = {
    global: { world, lastClearedCell: 90, farmlandsUnlocked: true, mapsOwnedArray: [] },
    buildings: { Smithy: { owned: over.owned ?? 0 } },
    resources: { wood: { owned: 0 }, metal: { owned: 0 }, gems: { owned: 0 } },
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
    // A bonus-less owned map at exactly the right level: the pre-fix loop matched it, because
    // `undefined == undefined`. Prove that shape is real, then that RselectSmithy no longer takes it.
    const bonusless = { noRecycle: false, level: 200, bonus: undefined, id: 'map99' }
    expect(bonusless.bonus == mf.RsmithyCalc(false, false, true, false)).toBe(true)
    G.game.global.mapsOwnedArray = [bonusless]
    expect(mf.RselectSmithy()).toBe('create')
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
