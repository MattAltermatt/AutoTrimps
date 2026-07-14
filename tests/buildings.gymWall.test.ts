import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'
import { assertHydrated } from './harness/gameFixture'

// #112 — GymWall's default (-1) is TRUTHY, so the "disabled" default silently clamped Gym purchases
// to one at a time and discarded the DecaBuild / DoubleBuild bulk-buy bonus.
//
// WHY THIS TEST EXISTS AT ALL, rather than trusting the L0 proof net:
// the net records `buyBuilding("Gym", true, true)` and does NOT record `game.global.buyAmt` — the one
// value this bug and its fix are entirely about. The corpus also has no DecaBuild/DoubleBuild reward,
// so `buyAmt` is pinned to 1 there regardless and the bug cannot even fire. baseline-zero is therefore
// GREEN both before and after the fix: it is structurally blind to this. A green net is not evidence
// here, and treating it as evidence is exactly the mistake #98 was filed for. So the evidence is built
// by hand: boot the real clone + the real bundle, grant DecaBuild, and read buyAmt at the call.
//
// Documented semantics (the setting's own description): "-1 or 0 to disable", and "setting to 1 does
// nothing besides stopping gyms from being bought 2 at a time due to the mastery". So:
//   -1, 0  -> no clamp: bulk buying (DecaBuild's 10) survives
//    1     -> clamp to 1  (the mastery-suppression case)
//   >1     -> clamp to 1, AND the wood wall applies (tested separately by the wall's own `> 1` gate)

const U1_SAVE = readFileSync(resolve('tests/fixtures/saves/02-mid-u1.txt'), 'utf8')

/** Boot U1, grant DecaBuild + plenty of wood, and report the buyAmt in force when Gym is bought. */
function gymBuyAmtAt(gymWall: number): unknown {
  const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: U1_SAVE })
  assertHydrated(game)

  expect(typeof window.safeBuyBuilding).toBe('function')

  // The bulk-buy bonus is the whole point: without it safeBuyBuilding pins buyAmt to 1 anyway and the
  // GymWall clamp is unobservable. Grant it explicitly rather than hunting a save that happens to have it.
  window.bwRewardUnlocked = (reward: string) => reward === 'DecaBuild'

  game.buildings.Gym.locked = false
  game.resources.wood.owned = 1e12

  window.setPageSetting('GymWall', gymWall)

  let seen: unknown = 'NEVER BOUGHT'
  const realBuy = window.buyBuilding
  window.buyBuilding = (what: string, ...rest: unknown[]) => {
    if (what === 'Gym') seen = game.global.buyAmt
    return realBuy.call(window, what, ...rest)
  }
  window.safeBuyBuilding('Gym')
  window.buyBuilding = realBuy

  return seen
}

describe('#112: GymWall only clamps Gym buying when it is actually switched on', () => {
  it('anti-false-green: with the bonus granted and the wall off, a Gym really is bought in bulk', () => {
    // If this row ever reports 'NEVER BOUGHT', every assertion below passes vacuously — the harness
    // would be proving nothing at all.
    expect(gymBuyAmtAt(-1)).toBe(10)
  })

  it('-1 (the DEFAULT, documented as "disable") does NOT clamp — this is the bug', () => {
    // Before the fix this returned 1: `if (getPageSetting('GymWall'))` is TRUE for -1, so every user on
    // the default lost their DecaBuild bonus on Gyms and nothing said so.
    expect(gymBuyAmtAt(-1)).toBe(10)
  })

  it('0 (also documented as "disable") does NOT clamp', () => {
    expect(gymBuyAmtAt(0)).toBe(10)
  })

  it('1 DOES clamp to a single Gym (its documented sole effect)', () => {
    expect(gymBuyAmtAt(1)).toBe(1)
  })

  it('a real wall value (>1) DOES clamp to a single Gym', () => {
    expect(gymBuyAmtAt(5)).toBe(1)
  })
})
