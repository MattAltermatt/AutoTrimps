import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { stepWithAT } from '../../scripts/sim/driver.mjs'
import { TEST_BUNDLE } from './bundle'

// #313 — THE END-TO-END CONTROL FOR THE ANTICIPATION ACTUATOR.
//
// `tests/breedtimer.ATGAanticipation.test.ts` pins what the function WRITES. This pins that those
// writes actually buy Anticipation stacks in the real game, booted from a real world-71 save with the
// real bundle — which is the only place the claim can be tested, because the mechanism is two game
// functions apart: breed() pads `lastBreedTime` at full population (main.js:5759) and the dispatch
// path converts it to `antiStacks` 6000 lines away (main.js:11683).
//
// WHY THIS CANNOT BE baseline-zero'S JOB: the setting is default OFF and no CORPUS member turns it
// on, so every recorded trace is of a bot with this lever down. That is deliberate — it keeps the
// change purely additive and forces no oracle re-pin — but it means the L0 net is structurally
// vacuous here, exactly as it was for the whole Geneticist subsystem before #313's rig. Evidence for
// a default-OFF feature has to be MADE, not borrowed (#98).
//
// THE ASSERTION IS AN INEQUALITY BETWEEN TWO RUNS, not a threshold on one. A bare `antiStacks >= 30`
// would also pass on a build where something else entirely drove the clock; the OFF arm is what makes
// the ON arm attributable. Both arms are the same save, same seed, same tick count — the setting is
// the only difference.
const load = (name: string) => readFileSync(resolve('tests/fixtures/saves', name + '.txt'), 'utf8')

/** Peak `antiStacks` over the run. Peak rather than final because the counter is RESET at every army
 *  dispatch (main.js:11690) — sampling the end lands on whatever the last cycle happened to be, which
 *  is a coin flip, and a flaky net is worse than none. */
function peakAntiStacks(fixture: string, atSettings: Record<string, unknown>, ticks: number) {
  const { window, game } = bootGame({
    saveString: load(fixture),
    fixedNow: 'lastOnline',
    withAutoTrimps: true,
    atBundlePath: TEST_BUNDLE,
    atSettings,
  })

  // Anti-false-green, three ways. The save must start with the lever DOWN and the game option at its
  // own default, or "AT turned it on" is unfalsifiable; and Anticipation must actually be levelled, or
  // main.js:11682 never computes stacks at all and both arms trivially read 0.
  expect(game.options.menu.geneSend.enabled).toBe(0)
  expect(game.global.GeneticistassistSetting).toBe(-1)
  expect(game.portal.Anticipation.level).toBeGreaterThan(0)

  let peak = 0
  for (let i = 0; i < ticks / 10; i++) {
    stepWithAT(window, 10)
    peak = Math.max(peak, game.global.antiStacks || 0)
  }
  return { peak, game }
}

// `patience` is unpurchased on both fixtures, so the cap is 30 (main.js:11684). Asserted rather than
// assumed — buy the talent upstream and a hardcoded 30 here would silently become the wrong target.
const TICKS = 1500

describe('ATGAanticipation reaches the Anticipation cap at world 71 (#313)', () => {
  for (const fixture of ['15-geneticist-u1', '16-amalg-u1']) {
    it(`${fixture}: the setting is what produces the stacks`, () => {
      const off = peakAntiStacks(fixture, { ATGAanticipation: false }, TICKS)
      expect(off.game.talents.patience.purchased).toBe(false)
      const cap = 30

      const on = peakAntiStacks(fixture, { ATGAanticipation: true }, TICKS)

      // The lever moved the two game values it owns...
      expect(on.game.options.menu.geneSend.enabled).toBe(3)
      expect(on.game.global.GeneticistassistSetting).toBe(cap)

      // ...and that produced stacks the same bot cannot reach without it.
      expect(on.peak).toBe(cap)
      expect(off.peak).toBeLessThan(cap)

      // ZERO GENETICISTS. This is the whole finding: the cap is reached without paying the ~389
      // Geneticists (against a food cap near 72) that stretching the breed timer to 30 s would cost.
      // ATGA2 is off in both arms, so nothing hired — if this ever reads non-zero, the run is no
      // longer isolating the actuator under test.
      expect(on.game.jobs.Geneticist.owned).toBe(0)
    })
  }
})
