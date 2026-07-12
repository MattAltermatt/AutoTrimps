import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describeSim } from './guard'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installSeededRandom } from '../../scripts/sim/seededRandom.mjs'
import { stepWithAT } from '../../scripts/sim/driver.mjs'

// #66 — ANTI-FALSE-GREEN NET for the sim harness itself.
//
// Loading a save with elapsed time kicks off the game's offline-progress replay, which sets
// `usingRealTimeOffline = true` (main.js:2901). In a browser that replay self-terminates on a
// setTimeout loop; the sim stubs setTimeout out, so the flag stuck true forever. AutoTrimps gates
// two subsystems on it (AutoTrimps2.js):
//
//     if (!usingRealTimeOffline) { setScienceNeeded(); autoLevelEquipment(); }
//
// so EVERY AT-driven sim run silently had gear-buying and science tracking disabled: AT banked metal
// to its storage cap and never equipped anything. The sim still *looked* alive (it fought, ran maps,
// hired jobs), which is exactly why it went unnoticed — the tests only asserted "AT calls mutators",
// and buyJob alone satisfied that.
//
// These tests assert the harness is honest about the thing it was silently lying about.

const load = (name: string) => readFileSync(resolve('tests/fixtures/saves', name + '.txt'), 'utf8')

describeSim('sim/offline-flag (#66)', () => {
  it('loading a save leaves usingRealTimeOffline FALSE (offline replay is torn down)', () => {
    const { window } = bootGame({ saveString: load('02-mid-u1') })
    expect(window.usingRealTimeOffline).toBe(false)
  })

  it('a bare newGame() boot is also not in offline mode', () => {
    const { window } = bootGame()
    expect(window.usingRealTimeOffline).toBe(false)
  })

  it('AT actually buys EQUIPMENT — the subsystem the stuck flag disabled', () => {
    const { window } = bootGame({ withAutoTrimps: true, saveString: load('02-mid-u1') })
    installSeededRandom(window, 1)

    let buyEquipmentCalls = 0
    const orig = window.buyEquipment
    window.buyEquipment = function (...a: unknown[]) {
      buyEquipmentCalls++
      return orig.apply(this, a)
    }

    stepWithAT(window, 4000)

    // Pre-#66 this was exactly 0 for any tick budget. It is the whole point of the fix: a sim that
    // never equips cannot be used to reason about gear, damage, or progression speed.
    expect(buyEquipmentCalls).toBeGreaterThan(0)
  })

  it('AT tracks science needs — the other subsystem behind the same gate', () => {
    const { window } = bootGame({ withAutoTrimps: true, saveString: load('02-mid-u1') })
    installSeededRandom(window, 1)
    // setScienceNeeded() assigns the global; if it never runs the global stays undefined.
    stepWithAT(window, 200)
    expect(typeof window.scienceNeeded).toBe('number')
  })
})
