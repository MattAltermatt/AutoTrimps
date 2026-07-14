import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'
import { assertHydrated } from './harness/gameFixture'

// #114 — "DAS: Normal" (Hdshrine option 2) was a NO-OP, behaviourally identical to "Daily AutoShrine On".
//
// autoshrine() chose its settings with
//     var mode = game.global.challengeActive == "Daily" ? "Daily" : "Standard";
// and never read Hdshrine's value at all. The dispatcher (AutoTrimps2.js:258) calls autoshrine() for
// `== 1 || == 2` alike, so both options ran the same code over the same Daily-specific ids. Nothing
// throws and nothing looks broken; the option simply did not exist in the behaviour.
//
// The label promises precisely the choice that line was making blindly: on a Daily, use my NORMAL
// (non-daily) shrine settings instead of the Daily set.
//
// HOW THIS IS OBSERVED, and the harness trap it walked into first: spying on `window.getPageSetting`
// captures NOTHING. other.ts imports getPageSetting from './utils', so its calls resolve through the
// module binding, not the global — patching window intercepts none of them. (The anti-false-green
// assertion caught that, which is the entire reason it is there.) So instead: configure the Daily and
// the Normal id-sets DIFFERENTLY, such that only ONE of them can fire, and watch the real actuator —
// game.permaBoneBonuses.boosts.consume().

const U1_SAVE = readFileSync(resolve('tests/fixtures/saves/02-mid-u1.txt'), 'utf8')

/**
 * On a Daily, with the NORMAL shrine set armed for this zone and the DAILY set armed for no zone at
 * all, run autoshrine() and report whether a bone charge was actually spent.
 *
 * option 1 ("Daily AutoShrine On") -> reads the Daily set  -> no zone matches -> must NOT consume.
 * option 2 ("DAS: Normal")         -> reads the Normal set -> this zone matches -> must consume.
 */
function consumedOnDaily(option: number): boolean {
  const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: U1_SAVE })
  assertHydrated(game)
  expect(typeof window.autoshrine).toBe('function')

  const world = game.global.world
  game.global.challengeActive = 'Daily'
  game.global.lastClearedCell = 50 // well past any cell gate below
  game.permaBoneBonuses.boosts.charges = 5

  // The NORMAL set: on, armed for THIS zone, at cell 1, wanting 5 charges.
  window.setPageSetting('Hshrine', true)
  window.setPageSetting('Hshrinezone', [world])
  window.setPageSetting('Hshrineamount', [5])
  window.setPageSetting('Hshrinecell', [1])
  window.autoTrimpSettings.Hshrinecharge.value = 0

  // The DAILY set: armed for a zone we are NOT in, so it can never fire.
  window.setPageSetting('Hdshrine', option)
  window.setPageSetting('Hdshrinezone', [world + 500])
  window.setPageSetting('Hdshrineamount', [5])
  window.setPageSetting('Hdshrinecell', [1])

  let consumed = 0
  const realConsume = game.permaBoneBonuses.boosts.consume
  game.permaBoneBonuses.boosts.consume = function (...args: unknown[]) {
    consumed++
    return realConsume.apply(this, args)
  }
  try {
    window.autoshrine()
  } finally {
    game.permaBoneBonuses.boosts.consume = realConsume
  }
  return consumed > 0
}

describe('#114: "DAS: Normal" reads your NORMAL shrine settings on a Daily', () => {
  const dailyOn = consumedOnDaily(1)
  const dasNormal = consumedOnDaily(2)

  it('option 1 ("Daily AutoShrine On") uses the DAILY set — which is armed for another zone, so nothing fires', () => {
    expect(dailyOn).toBe(false)
  })

  it('option 2 ("DAS: Normal") uses the NORMAL set — which IS armed for this zone, so it fires', () => {
    // Before the fix this was `false`: option 2 read the Daily set exactly like option 1, so the user's
    // normal shrine configuration was ignored and the option did nothing whatsoever.
    expect(dasNormal).toBe(true)
  })

  it('the two options are actually DIFFERENT now', () => {
    // The one assertion that must fail on the pre-#114 code, whatever the details.
    expect(dasNormal).not.toBe(dailyOn)
  })
})
