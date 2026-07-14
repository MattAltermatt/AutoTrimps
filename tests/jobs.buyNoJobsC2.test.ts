import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'
import { assertHydrated } from './harness/gameFixture'

// #117 — "No F/L/M in C2" (`buynojobsc`) was createSetting'd, rendered, visibility-toggled and saved to
// localStorage for years while NOTHING read it: `getPageSetting('buynojobsc')` appeared nowhere in src/
// or legacy/. A control that accepts input and dispatches nothing is a lie told to the user. It is now
// wired: while a Challenge² is running, AT stops HIRING Farmers/Lumberjacks/Miners.
//
// Two things this must prove, and the second matters as much as the first:
//   1. ON + in a C² -> AT does not hire F/L/M.
//   2. OFF -> byte-identical to before. Default is false, so an untouched install must be unchanged;
//      that is what keeps the L0 traces still and what makes this safe to ship.
//
// The observable is the real actuator: game.buyJob(), which safeBuyJob() drives.

const U1_SAVE = readFileSync(resolve('tests/fixtures/saves/02-mid-u1.txt'), 'utf8')

/** Run buyJobs() and report which jobs AT tried to hire. */
function jobsHired(opts: { setting: boolean; inC2: boolean }): string[] {
  const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: U1_SAVE })
  assertHydrated(game)
  expect(typeof window.buyJobs).toBe('function')

  window.setPageSetting('buynojobsc', opts.setting)
  game.global.runningChallengeSquared = opts.inC2

  // Give AT a reason to hire: plenty of food and free worker slots.
  game.resources.food.owned = 1e12
  game.resources.trimps.owned = 1e6
  game.resources.trimps.employed = 0

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

const FLM = ['Farmer', 'Lumberjack', 'Miner']

describe('#117: "No F/L/M in C2" stops hiring Farmers/Lumberjacks/Miners during a Challenge²', () => {
  const offInC2 = jobsHired({ setting: false, inC2: true })
  const onInC2 = jobsHired({ setting: true, inC2: true })
  const onOutsideC2 = jobsHired({ setting: true, inC2: false })

  it('anti-false-green: with the setting OFF, AT really does hire F/L/M in a C² — so there is something to suppress', () => {
    // If AT hires nothing here, every assertion below passes vacuously and this test proves nothing.
    expect(offInC2.some((j) => FLM.includes(j))).toBe(true)
  })

  it('ON + in a C² ⇒ no Farmer, Lumberjack or Miner is hired', () => {
    expect(onInC2.filter((j) => FLM.includes(j))).toEqual([])
  })

  it('ON + NOT in a C² ⇒ unchanged; the setting is scoped to Challenge² only', () => {
    expect(onOutsideC2.some((j) => FLM.includes(j))).toBe(true)
  })

  it('OFF is byte-identical to the old behaviour — the default must not move for anyone', () => {
    // The load-bearing safety property: `buynojobsc` defaults to false, so an untouched install has to
    // behave exactly as it did before this setting was wired. This is what keeps the L0 traces still.
    expect(jobsHired({ setting: false, inC2: false })).toEqual(offInC2)
  })
})
