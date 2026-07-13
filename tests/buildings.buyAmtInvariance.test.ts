import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'
import { assertHydrated } from './harness/gameFixture'

// #83 §1 — `game.global.buyAmt` is a PLAYER UI PREFERENCE (the 1/10/25/100/Max buttons), not an
// automation input. No AutoTrimps decision may depend on it.
//
// The game's canAffordBuilding(what, ...) prices the ambient buyAmt when no forceAmt is passed
// (.trimps-game/main.js:4752). RbuyBuildings() gated housing and Microchip on a BARE
// canAffordBuilding(x) and then bought exactly ONE — so at buyAmt=10/25/100 (and Max) the gate
// priced N units, answered "no", and the entire U2 housing + Microchip tree silently stopped.
// U1's buyBuildings() never had this because it pins `game.global.buyAmt = 1` behind preBuy2()
// (buildings.ts:225-230). #69 ship C turned RbuyBuildings() on for every U2 player for the first
// time, which promoted this from latent to live.
//
// This suite boots the REAL Trimps clone + the REAL built bundle (the same rig the L0 proof net
// uses) and sweeps the flag. The ONLY variable across rows is game.global.buyAmt.

const U2_SAVE = readFileSync(resolve('tests/fixtures/saves/04-u2-radon.txt'), 'utf8')
const BUY_AMTS: (number | string)[] = [1, 10, 25, 100, 'Max']

/**
 * Boot U2, hand the player enough food+wood for a couple of Houses, record every buyBuilding()
 * the AT function performs, and return what it bought.
 */
function housingBoughtAt(buyAmt: number | string): { bought: string[]; buyAmtAfter: unknown } {
  const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: U2_SAVE })
  assertHydrated(game)

  // Anti-false-green: the fix is a no-op unless RbuyBuildings actually reaches the housing loop.
  expect(typeof window.RbuyBuildings).toBe('function')

  game.resources.food.owned = 30020
  game.resources.wood.owned = 30020

  const bought: string[] = []
  const realBuy = window.buyBuilding
  window.buyBuilding = (what: string, ...rest: unknown[]) => {
    bought.push(what)
    return realBuy.call(window, what, ...rest)
  }

  game.global.buyAmt = buyAmt
  window.RbuyBuildings()
  const buyAmtAfter = game.global.buyAmt
  window.buyBuilding = realBuy

  return { bought: bought.filter((b) => b !== 'Shed'), buyAmtAfter }
}

describe('#83 §1: RbuyBuildings is invariant under the player\'s buy-amount selector', () => {
  const results = new Map<number | string, { bought: string[]; buyAmtAfter: unknown }>()

  for (const amt of BUY_AMTS) {
    it(`buys housing at buyAmt=${amt}`, () => {
      const r = housingBoughtAt(amt)
      results.set(amt, r)

      // The bug: at 10/25/100/Max this list was EMPTY. Only buyAmt=1 ever bought anything.
      expect(r.bought.length).toBeGreaterThan(0)
      expect(r.bought).toContain('House')
    })

    it(`restores the player's buyAmt=${amt} afterwards`, () => {
      const r = results.get(amt) ?? housingBoughtAt(amt)
      // Silently leaving the player pinned to 1 would be its own bug — postBuy2() must undo it.
      expect(r.buyAmtAfter).toBe(amt)
    })
  }

  it('the buy set is IDENTICAL across all five buy-amounts', () => {
    const sets = BUY_AMTS.map((a) => (results.get(a) ?? housingBoughtAt(a)).bought.join(','))
    // Same save, same settings — only the UI flag differs. Every row must agree.
    expect(new Set(sets).size).toBe(1)
    expect(sets[0]).not.toBe('') // anti-vacuous: it must have bought SOMETHING
  })
})
