import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'
import { assertHydrated } from './harness/gameFixture'

// #125 — the zone-1 bootstrap arm of buyJobs() used to hire ONLY while the colony sat below 90% of its
// cap, and it returns unconditionally, so (unlike the general arm below it) it had no full-colony path
// at all. A trap catches `1 + Bait` Trimps and the zone-1 population cap is 10, so at Bait >= 9 the
// FIRST trap fills the colony to 100% of realMax. `10 < 9` is false, from that trap onward, forever:
// zero workers were ever hired, and the `return` denied every other hiring path.
//
// The cascade is the whole run. No Farmers means no food income, and the game's `upgrades` trigger
// (config.js: trimps >= 2 AND food >= 15) is what reveals Science — so Science never appeared, Battle
// was never bought, and nothing ever fought. Reproduced live: 3+ minutes at world 1 / cell -1 with
// 19 wasted Traps, food pinned below 9.
//
// The 0.9 gate was guarding the breeding pool, but freeWorkerSlots() (`ceil(realMax/2) - employed`)
// already reserves half the colony for breeding. It was redundant, and at high Bait it was fatal.
//
// The L0 net cannot see any of this: the corpus has no world-1 fixture and this arm is gated on
// `world === 1`. The evidence has to be hand-built, so it is built here.

const U1_SAVE = readFileSync(resolve('tests/fixtures/saves/02-mid-u1.txt'), 'utf8')

/**
 * Put the game in the exact zone-1 bootstrap state, with the colony at `fillFraction` of its cap,
 * and report which jobs AT tries to hire on one buyJobs() tick.
 */
function jobsHiredAtZone1(fillFraction: number): string[] {
  const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: U1_SAVE })
  assertHydrated(game)
  expect(typeof window.buyJobs).toBe('function')

  // The bootstrap arm: world 1, and a helium total a real post-portal veteran actually has.
  game.global.world = 1
  game.global.totalHeliumEarned = 1360
  game.global.challengeActive = ''
  game.global.runningChallengeSquared = false

  // A colony filled to `fillFraction` of its cap, with nobody employed yet — which is precisely the
  // state one Bait-9 trap produces at fillFraction = 1.
  const cap = game.resources.trimps.realMax()
  game.resources.trimps.owned = cap * fillFraction
  game.jobs.Farmer.owned = 0
  game.jobs.Lumberjack.owned = 0
  game.jobs.Farmer.locked = 0
  game.jobs.Lumberjack.locked = 0

  // Enough food to afford a Farmer (cost: 5) and clear the arm's own `food > 5` threshold.
  game.resources.food.owned = 10

  const hired: string[] = []
  const realBuyJob = window.buyJob
  window.buyJob = (job: string, ...rest: unknown[]) => {
    // game.global.firing is how AT distinguishes a hire from a fire (see safeFireJob).
    if (!game.global.firing) hired.push(job)
    return realBuyJob.call(window, job, ...rest)
  }
  try {
    window.buyJobs()
  } finally {
    window.buyJob = realBuyJob
  }
  return [...new Set(hired)]
}

describe('#125: AT hires workers at zone 1 even when one Bait-9 trap has already filled the colony', () => {
  const halfFull = jobsHiredAtZone1(0.5)
  const full = jobsHiredAtZone1(1)

  it('anti-false-green: below the old 90% gate AT does hire — so the harness can see a hire at all', () => {
    // If AT hires nothing here, every assertion below passes vacuously and this test proves nothing.
    expect(halfFull).toContain('Farmer')
  })

  it('hires a Farmer with the colony at 100% of its cap (the Bait >= 9 case that soft-locked the run)', () => {
    expect(full).toContain('Farmer')
  })

  it('still leaves the breeding pool intact — hiring is bounded by freeWorkerSlots(), not by the pop-full gate', () => {
    const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: U1_SAVE })
    assertHydrated(game)
    game.global.world = 1
    game.global.totalHeliumEarned = 1360
    game.global.challengeActive = ''
    const cap = game.resources.trimps.realMax()
    game.resources.trimps.owned = cap
    game.jobs.Farmer.owned = 0
    game.jobs.Lumberjack.owned = 0
    game.resources.food.owned = 1e12

    // Half the colony is reserved for breeding, so no number of ticks may employ more than ceil(cap/2).
    for (let i = 0; i < 200; i++) window.buyJobs()
    expect(game.resources.trimps.employed).toBeLessThanOrEqual(Math.ceil(cap / 2))
    expect(game.resources.trimps.employed).toBeGreaterThan(0)
  })
})
