import { describe, it, expect } from 'vitest'
import { TEST_BUNDLE } from './bundle'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installFrozenClock } from '../../scripts/sim/clock.mjs'
import { installSeededRandom } from '../../scripts/sim/seededRandom.mjs'
import { stepWithAT } from '../../scripts/sim/driver.mjs'
import { assertHydrated } from '../harness/gameFixture'

const load = (name: string) => readFileSync(resolve('tests/fixtures/saves', name + '.txt'), 'utf8')

describe('synthetic save corpus', () => {
  it('01-early-u1 loads, hydrated, at a progressed U1 zone', () => {
    const { game } = bootGame({ saveString: load('01-early-u1') })
    assertHydrated(game)
    expect(game.global.world).toBeGreaterThanOrEqual(1)
    expect(game.global.universe ?? 1).toBe(1)
  })

  it('02-mid-u1 loads + hydrated', () => {
    const { game } = bootGame({ saveString: load('02-mid-u1') })
    assertHydrated(game)
  })

  it('03-challenge-watch loads with the Watch challenge armed', () => {
    const { game } = bootGame({ saveString: load('03-challenge-watch') })
    assertHydrated(game)
    expect(game.global.challengeActive).toBe('Watch')
  })

  it('the corpus is NON-VACUOUS: AT calls native mutators (a fresh newGame would not)', () => {
    const { window: w } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: load('01-early-u1') })
    installSeededRandom(w, 1)
    installFrozenClock(w)
    let calls = 0
    for (const fn of ['buyJob', 'buyBuilding', 'buyUpgrade', 'buyEquipment', 'setFormation', 'runMap']) {
      const orig = w[fn]
      if (typeof orig === 'function') w[fn] = function (...a: unknown[]) { calls++; return orig.apply(this, a) }
    }
    stepWithAT(w, 1500)
    expect(calls).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE DEPTH TRIPWIRE (#90/#98). The mutator-reach pins in corpus-coverage.test.ts read the committed
// TRACES — so they prove the oracle once behaved a certain way, not that the SAVES still contain the
// state that made it behave that way. If a future regeneration quietly produces a shallower 06 (say the
// perk grant stops applying, or the play-forward stalls a zone earlier), the traces would be re-recorded
// to match and every set-based assertion would go on passing. The net would go blind AGAIN, silently,
// and the coverage test would certify it.
//
// So this asserts the PRECONDITIONS directly, on the decoded saves: the specific game-state flags that
// gate the code we care about. Each one is the actual `if` that AT branches on, cited to its line:
//
//   mapsUnlocked        maps.ts:253      — false ⇒ calcOurDmg is short-circuited out of every map
//                                          decision. This single flag is the whole of #98.
//   Formations.done     stance.ts:224    — falsy ⇒ autoStance() returns before any setFormation call.
//   Anticipation perk   main.js:11682    — level 0 ⇒ antiStacks pinned at 0 forever ⇒ calcOurDmg's
//                                          Anticipation arm is dead code (the arm #98 injected into).
//   100-map cap         main.js:6597     — the sole gate behind every recycleBelow/recycleMap callsite.
//
// This is the #66 lesson written as a test: a coverage claim is a hypothesis until you verify the path
// can RUN. Reading the trace tells you what happened; reading the save tells you what CAN happen.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('corpus depth tripwire — the saves reach the code the net claims to guard', () => {
  it('05-maps-u1 has maps UNLOCKED, so maps.ts:253 evaluates calcOurDmg instead of short-circuiting', () => {
    const { game } = bootGame({ saveString: load('05-maps-u1') })
    assertHydrated(game)
    expect(game.global.mapsUnlocked).toBe(true)
    expect(game.global.world).toBeGreaterThanOrEqual(6)
  })

  it('06-deep-u1 is a POST-PORTAL state: formations legal + Anticipation perk (antiStacks can leave 0)', () => {
    const { game } = bootGame({ saveString: load('06-deep-u1') })
    assertHydrated(game)
    expect(game.global.mapsUnlocked).toBe(true)
    // Without this, autoStance() returns at stance.ts:224 and setFormation is NEVER called.
    expect(game.upgrades.Formations.done).toBeTruthy()
    expect(game.upgrades.Dominance.done).toBeTruthy()
    // Without this, main.js:11682 never runs and antiStacks is pinned at 0 — which is exactly what made
    // calcOurDmg's Anticipation arm unreachable, and a 1e6x multiplier there invisible (#98).
    expect(game.portal.Anticipation.level).toBeGreaterThan(0)
    expect(game.global.totalPortals).toBeGreaterThan(0)
    // AT needs fragments to buy a map at all; a save that lands here broke and cannot map.
    expect(game.resources.fragments.owned).toBeGreaterThan(0)
  })

  it('06-deep-u1 actually ACCRUES antiStacks under play — the perk is wired, not just present', () => {
    const { window: w, game: g } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: load('06-deep-u1') })
    installSeededRandom(w, 1)
    installFrozenClock(w)
    let maxAnti = 0
    for (let i = 0; i < 1500; i++) {
      stepWithAT(w, 1)
      if (g.global.antiStacks > maxAnti) maxAnti = g.global.antiStacks
    }
    // Presence of the perk is not the same as the stack counter moving. Assert the OBSERVED value —
    // this is the assertion that would have caught #66, and the one #98 needed and did not have.
    expect(maxAnti).toBeGreaterThan(0)
  }, 120_000)

  it('07-map-cap-u1 sits ON the 100-map cap — the sole gate behind recycleBelow/recycleMap', () => {
    const { game } = bootGame({ saveString: load('07-map-cap-u1') })
    assertHydrated(game)
    // main.js:6597 returns -2 from buyMap() at >= 100. Below the cap, AT's whole recycle-recovery
    // branch is unreachable and both mutators go dark.
    expect(game.global.mapsOwnedArray.length).toBeGreaterThanOrEqual(100)
  })

  // The most load-bearing precondition in the corpus, and the least obvious. 06 REACHES the damage code
  // and is still blind to it, because `enoughDamage = (ourBaseDamage * cutoff > enemyHealth)` is already
  // TRUE there — a saturated threshold absorbs any buff you throw at it. 08 is the one save where that
  // predicate sits on the FALSE side, which is what makes calcOurDmg's output able to change a decision
  // at all. tests/sim/damage-sensitivity.test.ts is the mutation proof; this is the cheap precondition
  // check that tells you WHICH property broke when that one goes red.
  it('08-starved-u1 keeps the damage threshold UNSATURATED — enoughDamage stays FALSE under play', () => {
    const { window: w, game: g } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: load('08-starved-u1') })
    installSeededRandom(w, 1)
    installFrozenClock(w)

    let ticksAntiPositive = 0
    let ticksEnoughDamage = 0
    for (let i = 0; i < 500; i++) {
      stepWithAT(w, 1)
      if (g.global.antiStacks > 0) ticksAntiPositive++
      if (w.enoughDamage) ticksEnoughDamage++
    }

    // The Anticipation arm of calcOurDmg must be LIVE — antiStacks > 0 requires the perk (main.js:11682).
    // On 01-05 this is structurally 0 (totalPortals = 0 ⇒ no perks), which is why the arm #98 injected
    // into was dead code there.
    expect(ticksAntiPositive).toBeGreaterThan(400)

    // And AT must remain damage-STARVED, so the threshold can still flip. If a future regeneration hands
    // 08 more damage (a stray perk, a deeper base save), this goes red — and the mutation test would
    // otherwise have gone quietly, uselessly green.
    expect(ticksEnoughDamage).toBe(0)
  }, 120_000)
})
