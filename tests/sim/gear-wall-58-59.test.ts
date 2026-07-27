import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TEST_BUNDLE } from './bundle'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installSeededRandom } from '../../scripts/sim/seededRandom.mjs'
import { stepWithAT } from '../../scripts/sim/driver.mjs'

// #153 — THE ZONE 58-59 GEAR WALL MUST STAY GONE.
//
// `MODULES["equipment"].waitTill60` (equipment.ts, removed in this change) hardcoded `Wall = true`
// for every piece but Gym while `58 <= world < 60`, and separately suppressed the whole prestige-buy
// branch over the same window. Its stated premise — "cost drops down to 10%" at zone 60 — is false:
// equipment price is `base * 1.2^level * getEquipPriceMult()` and getEquipPriceMult (main.js:4712)
// never reads game.global.world, nor does getNextPrestigeCost (main.js:5953).
//
// ⚠️ THE L0 ORACLE CANNOT SEE THIS. Every corpus fixture sits at z2-z6 except 12-warp-u1, which
// starts at z62 — so NOT ONE of them is inside the 58-59 window, and `baseline-zero` stayed green
// through both the buggy and the fixed build. A green proof net was never evidence here; it was
// evidence the net could not look. This fixture is the eye that was missing.
//
// 13-z58-gearwall-u1 is a real user save: U1, portal 50, zone 58, 3.9e14 metal banked, gear at
// levels 1-6 with three affordable prestiges (Greatersword 8.95e13, Bestplate 9.90e13) sitting
// unbought. Measured with the wall in place, 5 seeds x 40,000 ticks: AT bought NOTHING — gear levels
// and prestige count byte-identical to the save's own, on every seed, for the entire run, while the
// hoard grew to 9e14. So this assertion is mutation-proven: restore the wall and it goes red.
const SAVE = () => readFileSync(resolve('tests/fixtures/saves/13-z58-gearwall-u1.txt'), 'utf8').trim()

const gearLevels = (game: any) =>
  Object.values<any>(game.equipment).reduce((a, e) => a + (e.locked ? 0 : e.level), 0)
const prestiges = (game: any) =>
  Object.values<any>(game.equipment).reduce((a, e) => a + (e.locked ? 0 : e.prestige), 0)

describe('sim/gear wall (zones 58-59)', () => {
  it('the fixture is inside the window the wall used to cover', () => {
    const { game } = bootGame({ saveString: SAVE(), fixedNow: 'lastOnline' })
    expect(game.global.universe ?? 1).toBe(1)
    expect(game.global.world).toBeGreaterThanOrEqual(58)
    expect(game.global.world).toBeLessThan(60)
    // The wall was never about affordability — it fired with the bank overflowing.
    expect(game.resources.metal.owned).toBeGreaterThan(1e14)
  })

  it('AT converts its banked metal into gear at zone 58 instead of hoarding it', () => {
    const { window: w, game } = bootGame({
      withAutoTrimps: true,
      atBundlePath: TEST_BUNDLE,
      saveString: SAVE(),
      fixedNow: 'lastOnline',
    })
    installSeededRandom(w, 1)

    const before = { levels: gearLevels(game), prestiges: prestiges(game), metal: game.resources.metal.owned }
    stepWithAT(w, 600)
    const after = { levels: gearLevels(w.game), prestiges: prestiges(w.game), metal: w.game.resources.metal.owned }

    // Assert on STATE, not on a spy: a converted module's internal calls never route through the
    // global, so intercepting window.buyEquipment reports a confident 0 while the code demonstrably
    // runs (#127/#129). Prestiges reset an item's level to 1 (prestigeEquipment, main.js:5915), so
    // the LEVEL sum can legitimately fall while AT is buying hard — prestige count is the honest
    // "did it spend?" signal, and metal is the corroborating one (income cannot outrun a real spend
    // here: with the wall in place the bank only ever grew, 3.9e14 -> 9e14 over 40k ticks).
    expect(after.prestiges).toBeGreaterThan(before.prestiges)
    expect(after.metal).toBeLessThan(before.metal)
  })
})
