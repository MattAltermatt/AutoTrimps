// @vitest-environment node
//
// #87 — THE BEHAVIORAL PROOF. tests/nets/mainloop-guarded.test.ts proves the boundary is *there*
// (structurally, in the AST). This file proves it WORKS: that a throw in one automation no longer
// prevents a later one from running, on the real v5.10.1 clone, driving the real mainLoop.
//
// The shape of every test here is the same, and it is deliberately the shape #87 could not survive:
//
//   1. make an EARLY automation throw,
//   2. assert a LATER automation still ran        (containment),
//   3. assert the throw REALLY HAPPENED           (no false green — see below),
//   4. assert it was REPORTED, once, on both channels (it surfaces; it is not swallowed).
//
// Step 3 is not decoration. Without it, a test that patched the wrong global — or that ran a save
// where the "early" automation was gated off — would pass by simply never throwing, and would certify
// a boundary that does not exist. atGuardErrors is the receipt: it says the throw occurred and was
// contained, which is precisely the claim under test.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../scripts/sim/boot.mjs'
import { TEST_BUNDLE } from './sim/bundle'

const SAVE = readFileSync(resolve('tests/fixtures/saves/02-mid-u1.txt'), 'utf8')

function boot() {
  const { window } = bootGame({
    withAutoTrimps: true,
    atBundlePath: TEST_BUNDLE,
    saveString: SAVE,
  }) as unknown as { window: Record<string, any> }
  // A fresh jsdom per test means a fresh module scope, hence a fresh throttle latch. Assert it rather
  // than assume it: a latch leaking across tests would make the throttle assertions below meaningless.
  expect(window.atGuardErrors).toEqual({})
  return window
}

let window: Record<string, any>
let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  window = boot()
})
afterEach(() => consoleError.mockRestore())

describe('#87 — a throw in one automation no longer decapitates the rest of the tick', () => {
  it('POSITIVE CONTROL: the fixture is real, and an unpatched tick runs clean', () => {
    // Anti-false-green, and also the load-bearing assertion for the whole L0 prediction: on a real
    // corpus save, a NORMAL tick trips ZERO guards. If this ever goes red, the boundary is masking a
    // live crash and the traces you are about to trust are the traces of a broken AT.
    expect(typeof window.mainLoop).toBe('function')
    expect(typeof window.atGuard).toBe('function')
    expect(window.game.global.universe).toBe(1)
    expect(typeof window.game.buildings.Shed.cost.wood).toBe('function') // the #66 tripwire
    window.mainLoop()
    expect(window.atGuardErrors).toEqual({})
  })

  it('mainCleanup() throwing does not stop computeTopTarget() — the two ends of the U1 tick', () => {
    // mainCleanup is dispatched in the PREAMBLE (before the universe blocks) and computeTopTarget is
    // dispatched UNCONDITIONALLY partway down U1, so this pair needs no settings to be set up and it
    // spans most of the loop. Pre-#87 this was a total kill: mainCleanup threw, and computeTopTarget —
    // along with every building, job, portal, combat, stance, spire, raid and golden dispatch below it
    // — never ran again, on any tick, for the rest of the session.
    const later = vi.fn()
    window.computeTopTarget = later
    window.mainCleanup = () => {
      throw new Error('injected: mainCleanup')
    }

    expect(() => window.mainLoop()).not.toThrow() // the tick itself survives
    expect(window.atGuardErrors.mainCleanup?.count).toBe(1) // …and the throw REALLY happened
    expect(window.atGuardErrors.mainCleanup.message).toBe('injected: mainCleanup')
    expect(later).toHaveBeenCalledTimes(1) // …and the automation below it still ran
  })

  it('an early U1 automation throwing does not stop a late one (buyUpgrades -> computeTopTarget)', () => {
    // The #87 issue's own U1 walkthrough, minus the magmite bug (#84 fixed it): a throw at the top of
    // the U1 block used to kill upgrades, shrine, coordinator, ALL buildings, ALL jobs, the portal, ALL
    // combat, stance, spire, raiding and golden. Here the throw is contained to one name.
    const later = vi.fn()
    window.computeTopTarget = later
    window.buyUpgrades = () => {
      throw new Error('injected: buyUpgrades')
    }
    window.autoTrimpSettings.BuyUpgradesNew.value = 1 // != 0, so the dispatch actually fires

    window.mainLoop()
    expect(window.atGuardErrors.buyUpgrades?.count).toBe(1)
    expect(later).toHaveBeenCalledTimes(1)
  })

  it('the guard CONTAINS but does not RECOVER — the throwing automation stays broken', () => {
    // Constraint 1 from the issue, asserted rather than asserted-in-prose. atGuard() does not retry,
    // does not substitute a default, and does not "fix" anything. buyUpgrades is still broken; it is
    // simply no longer everyone else's problem.
    const broken = vi.fn(() => {
      throw new Error('injected')
    })
    window.buyUpgrades = broken
    window.autoTrimpSettings.BuyUpgradesNew.value = 1

    window.mainLoop()
    window.mainLoop()
    expect(broken).toHaveBeenCalledTimes(2) // it is re-attempted every tick — no silent disabling
    expect(window.atGuardErrors.buyUpgrades.count).toBe(2) // and every failure is counted
  })

  it('SURFACES on both channels, and THROTTLES to one report per name per session', () => {
    // Constraints 2 and 3. At runInterval=100 an unlatched report is ~10 lines/sec forever, which is
    // how a diagnostic becomes noise the player learns to ignore. First failure: full report on BOTH
    // console.error and AT's own message log. Every repeat: counted, silent.
    const debug = vi.fn()
    window.debug = debug
    window.buyUpgrades = () => {
      throw new Error('injected: boom')
    }
    window.autoTrimpSettings.BuyUpgradesNew.value = 1

    for (let i = 0; i < 25; i++) window.mainLoop()

    expect(window.atGuardErrors.buyUpgrades.count).toBe(25) // all 25 counted…
    const mine = consoleError.mock.calls.filter((c: unknown[]) => String(c[0]).includes('buyUpgrades'))
    expect(mine.length).toBe(1) // …exactly one console.error
    expect(String(mine[0][0])).toContain('threw and was skipped')
    expect(mine[0][1]).toBeInstanceOf(Error) // the Error object itself, so the stack is inspectable

    const logged = debug.mock.calls.filter((c) => String(c[0]).includes('buyUpgrades'))
    expect(logged.length).toBe(1) // …and exactly one line in AT's message log (utils.ts debug)
    expect(String(logged[0][0])).toContain('injected: boom') // carrying the real message, not a shrug
  })

  it('a reporter that itself throws cannot take down the boundary', () => {
    // The boundary's own logging touches settings and the DOM (debug() reads getPageSetting and writes
    // to the message log), so it is entirely capable of throwing during early boot. A boundary whose
    // reporter can crash the boundary is not a boundary.
    window.debug = () => {
      throw new Error('the reporter is broken too')
    }
    const later = vi.fn()
    window.computeTopTarget = later
    window.mainCleanup = () => {
      throw new Error('injected')
    }

    expect(() => window.mainLoop()).not.toThrow()
    expect(later).toHaveBeenCalledTimes(1)
  })
})

describe('#87 — guiLoop is four boundaries, not one comma expression', () => {
  it('updateCustomButtons() throwing no longer costs the AFK overlay and the grids', () => {
    // It shipped as `a(), b(), c && d(), e && f()` — a single expression statement. A throw in `a()`
    // took b, c/d and e/f with it, every 1000ms, forever.
    const afk = vi.fn()
    window.MODULES.performance.isAFK = true
    window.MODULES.performance.UpdateAFKOverlay = afk
    window.updateCustomButtons = () => {
      throw new Error('injected: updateCustomButtons')
    }

    expect(() => window.guiLoop()).not.toThrow()
    expect(window.atGuardErrors.updateCustomButtons?.count).toBe(1)
    expect(afk).toHaveBeenCalledTimes(1)
  })
})

describe('#87 — the ATrunning latch cannot be stranded by a throw', () => {
  // mainLoop's first statement is `if (ATrunning == false) return;`. A throw after ATrunning=false and
  // before it is restored does not skip a tick — it switches AutoTrimps OFF until the page is reloaded.
  // #71a was exactly that (resetModuleVars threw on a bare `storedMODULES`), so this is not theoretical.
  // Both clearing sites now restore the latch in a `finally`.
  it('resetModuleVars(): a throw in the deferred body still restores ATrunning', () => {
    // boot.mjs stubs window.setTimeout to a no-op (the sim drives its own clock), so the 101ms defer
    // would never fire here. Run the deferred body inline: the `finally` under test is inside that
    // callback, and whether it is reached via the event loop or directly is irrelevant to it.
    const deferred: (() => void)[] = []
    window.setTimeout = (fn: () => void) => (deferred.push(fn), 0)
    window.ATrunning = true
    // The throw has to be injected at a name the body reaches through the GLOBAL seam — its two
    // function calls (compareModuleVars, safeSetItems) are bundle-local bindings inside the src IIFE
    // and a `window.x = …` patch cannot reach them. `MODULESdefault` is a real AutoTrimps2.js global,
    // so a circular value makes the body's own JSON.stringify throw, which is a faithful stand-in for
    // the #71a ReferenceError that sat on exactly this line.
    const circular: any = {}
    circular.self = circular
    window.MODULESdefault = circular

    window.resetModuleVars()
    expect(window.ATrunning).toBe(false) // the window is open…
    expect(deferred.length).toBe(1) // …and the body really was deferred (#71a: it used to run inline)
    expect(() => deferred[0]()).toThrow(/circular/i) // …the body really throws…
    expect(window.ATrunning).toBe(true) // …and the `finally` closed it anyway. AT lives.
  })

  it('resetAutoTrimps(): a throw in the settings-DOM rebuild still restores ATrunning', () => {
    window.ATrunning = true
    window.initializeAllTabs = () => {
      throw new Error('injected: initializeAllTabs')
    }
    // The body is immediately-invoked (a pre-existing defect, out of scope here), so the throw
    // propagates synchronously out of resetAutoTrimps — which is precisely the path that used to
    // strand the latch.
    expect(() => window.resetAutoTrimps()).toThrow('injected: initializeAllTabs')
    expect(window.ATrunning).toBe(true)
  })
})
