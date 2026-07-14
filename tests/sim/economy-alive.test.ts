import { describe, it, expect } from 'vitest'
import { TEST_BUNDLE } from './bundle'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installSeededRandom } from '../../scripts/sim/seededRandom.mjs'
import { stepWithAT, runTicks } from '../../scripts/sim/driver.mjs'

// #122 — ANTI-FALSE-GREEN NET for the sim harness itself. Sibling of offline-flag.test.ts (#66),
// and the same disease: a stub in boot.mjs silently disabled a whole game subsystem while every
// gate stayed green.
//
// boot.mjs stubs `window.setTimeout = () => 0`. The game calls checkTriggers() during play from
// exactly one place — costUpdatesTimeout(), a `setTimeout(costUpdatesTimeout, 250)` loop
// (main.js:17970) — so under the stub it NEVER FIRED. Forge is a *trigger*, not an upgrade
// (config.js:13226, fires at >=350 metal), so:
//
//     Forge never unlocks  ->  metal.max pinned at 500  ->  Coordination (507 metal at done=2)
//     is permanently unaffordable
//
// AutoTrimps bought Coordination ZERO times in the entire history of the proof net, and the deep
// fixtures ran metal-capped (owned === max === 500) on up to 100% of their ticks. Every metal, gear,
// storage and housing conclusion the sim ever produced was measured against a dead economy.
//
// driver.mjs's tickOnce() now calls checkTriggers() per tick. These tests assert the economy is
// ALIVE, so a future re-stub cannot quietly re-freeze it.

const load = (name: string) => readFileSync(resolve('tests/fixtures/saves', name + '.txt'), 'utf8')

const bootAT = (save: string) => {
  const boot = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: load(save) })
  installSeededRandom(boot.window, 1)
  return boot
}

describe('sim/economy-alive (#122)', () => {
  it('triggers FIRE during a run — Forge unlocks, so metal storage can grow past 500', () => {
    const { window, game } = bootAT('02-mid-u1')
    expect(game.buildings.Forge.locked).toBe(1) // precondition: it starts locked on this save
    expect(game.resources.metal.max).toBe(500)

    // Unlocking Forge is necessary but not sufficient: metal.max only moves once AT *builds* one,
    // which it does well inside this save's recorded corpus budget (1500 ticks).
    stepWithAT(window, 1500)

    // Pre-#122 both of these held their boot values for any tick budget, on every save in the corpus.
    expect(window.game.buildings.Forge.locked).toBe(0)
    expect(window.game.resources.metal.max).toBeGreaterThan(500)
  }, 120_000)

  // The three behavioural tests above prove triggers fire AT LEAST ONCE during a run — they do not pin
  // the cadence. A regression that called checkTriggers() exactly once (say, only at boot) would still
  // unlock Forge somewhere inside a 1500-tick budget and pass all of them. The triggers are one-shot
  // latches so that is nearly harmless in practice, but "nearly" is how the 500-metal cap survived for
  // the harness's whole existence. Pin the cadence directly.
  it('checkTriggers fires ONCE PER TICK, not once per run', () => {
    const { window } = bootGame({ saveString: load('02-mid-u1') })
    let calls = 0
    const orig = window.checkTriggers
    window.checkTriggers = function (...a: unknown[]) {
      calls++
      return orig.apply(this, a)
    }

    runTicks(window, 50)

    expect(calls).toBe(50)
  })

  it('AT actually BUYS Coordination — the upgrade a 500-metal cap made permanently unaffordable', () => {
    const { window, game } = bootAT('06-deep-u1')
    const before = game.upgrades.Coordination.done

    stepWithAT(window, 2000)

    // Coordination is the single highest-leverage purchase in the game (it is what grows the army).
    // Pre-#122 this delta was exactly 0 — corpus-wide, forever.
    expect(window.game.upgrades.Coordination.done).toBeGreaterThan(before)
  }, 120_000)

  it('the deep corpus is NOT metal-capped on nearly every tick', () => {
    const { window } = bootAT('06-deep-u1')

    let capped = 0
    const TICKS = 1000
    for (let i = 0; i < TICKS; i++) {
      stepWithAT(window, 1)
      const m = window.game.resources.metal
      if (m.owned >= m.max) capped++
    }

    // Pre-#122: 100% of ticks (owned === max === 500 from the moment the save loaded — the bot was
    // pouring income into a full bucket). A cap that is never relieved makes every metal-spending
    // experiment the sim can run meaningless, which is how #57 was designed against a premise that
    // was structurally unobservable here.
    expect(capped / TICKS).toBeLessThan(0.5)
  }, 120_000)
})
