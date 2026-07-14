import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'
import { assertHydrated } from './harness/gameFixture'

// #113 — ATspirebreed() overrides the player's Geneticistassist (breed) timer for the duration of a
// Spire and is meant to put the original back on the way out. It never did.
//
// The capture was `var prespiretimer` INSIDE the function. `var` is function-scoped, and the mainLoop
// calls ATspirebreed() fresh every tick, so the local was re-initialised to `undefined` on every call.
// The two branches are also mutually exclusive by construction — the capture needs `spireActive`, the
// restore needs `!spireActive` — so they can never run in the same invocation. The restore therefore
// assigned `undefined` to game.global.GeneticistassistSetting EVERY time, blanking the player's setting
// instead of restoring it.
//
// This is a cross-tick state bug, so it is only observable by calling the function repeatedly, the way
// the mainLoop does. A single call cannot see it, which is why it survived.

const U1_SAVE = readFileSync(resolve('tests/fixtures/saves/02-mid-u1.txt'), 'utf8')

const PLAYERS_OWN_TIMER = 42
const SPIRE_TIMER = 7

/** Boot U1 and drive ATspirebreed() across the enter/exit of a Spire, one call per simulated tick. */
function runSpireCycle(): { insideSpire: unknown; afterSpire: unknown } {
  const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: U1_SAVE })
  assertHydrated(game)

  expect(typeof window.ATspirebreed).toBe('function')

  window.setPageSetting('SpireBreedTimer', SPIRE_TIMER)
  window.setPageSetting('IgnoreSpiresUntil', 0) // <= world, so the Spire logic is allowed to run

  game.global.GeneticistassistSetting = PLAYERS_OWN_TIMER

  // --- enter the Spire, and tick a few times as the mainLoop would
  game.global.spireActive = true
  window.ATspirebreed()
  window.ATspirebreed()
  window.ATspirebreed()
  const insideSpire = game.global.GeneticistassistSetting

  // --- leave the Spire, and tick again
  game.global.spireActive = false
  window.ATspirebreed()
  const afterSpire = game.global.GeneticistassistSetting

  return { insideSpire, afterSpire }
}

describe('#113: SpireBreedTimer restores the timer you had before the Spire', () => {
  const { insideSpire, afterSpire } = runSpireCycle()

  it('anti-false-green: the override really fires, so the restore has something to undo', () => {
    // If AT never took the timer over, "it was restored" would be trivially true and prove nothing.
    expect(insideSpire).toBe(SPIRE_TIMER)
    expect(insideSpire).not.toBe(PLAYERS_OWN_TIMER)
  })

  it('on leaving the Spire, the player gets their OWN timer back', () => {
    // Before the fix this was `undefined` — the player's setting was silently blanked on every Spire
    // exit, and AT is the only thing that touches it, so there was nothing to notice until breeding
    // misbehaved much later.
    expect(afterSpire).toBe(PLAYERS_OWN_TIMER)
    expect(afterSpire).not.toBeUndefined()
  })
})
