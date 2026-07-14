// #102 regression net — compareModuleVars()/exportModuleVars() threw before the startup chain finished.
//
// Reproduced on a REAL boot before the fix (full Trimps game + the freshly-built AT bundle in jsdom —
// the same instrument the sim suites use). bootGame() evaluates the bundle and stubs setTimeout, which
// is EXACTLY the pre-delayStartAgain state a real player is in for the first 8 seconds:
//
//   MODULES keys: 16   MODULESdefault keys: 0
//   window.exportModuleVars()   → TypeError: Cannot read properties of undefined (reading 'voidCheckPercent')
//   window.compareModuleVars()  → TypeError: Cannot read properties of undefined (reading 'voidCheckPercent')
//
// MODULESdefault was seeded in ONE place — delayStartAgain() (AutoTrimps2.js), at 2 × startupDelay =
// 8s. The settings GUI mounts at 4s (delayStart → initializeAutoTrimps), so for four seconds the
// Import/Export tab's Export button and "Reset Module Vars" are clickable and both throw. Reset is the
// worst of them: it throws AFTER `ATrunning = false`, so AT stays dead until the page is reloaded.
//
// ⚠️ THE ISSUE'S PROPOSED FIX IS NOT SUFFICIENT ON ITS OWN, and this file is what proves it. "Populate
// MODULESdefault eagerly at module-eval time" leaves `MODULES.graphs` out — legacy/Graphs.js registers
// it and the build emits Graphs.js AFTER the src IIFE. compareModuleVars() iterates Object.keys(MODULES),
// so `MODULESdefault['graphs']` would be undefined and it would throw on the very same line. Hence BOTH
// halves: the eager seed (src/main.ts) and a TOTAL read (a module with no recorded default reports no
// overrides). The `graphs` case below is the one that goes red if only half the fix is present.
//
// The L0 proof net is BLIND to all of this — it records buy events only, and never runs guiLoop or the
// GUI (#90/#98). Nothing here may be justified by "the sim stayed green".

import { describe, it, expect, beforeEach } from 'vitest'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'

/**
 * A real game + real AT bundle in jsdom, with the setTimeout startup chain NOT run — i.e. the first 8
 * seconds of a real page. Deliberately does NOT hand-seed MODULESdefault (as the #76 suite does): the
 * whole point is that the bundle must seed it itself.
 */
function boot(): any {
  return (bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE }) as any).window
}

describe('#102 · MODULESdefault is seeded at bundle-eval, so the module-var fns never throw', () => {
  let w: any
  beforeEach(() => {
    w = boot()
  })

  it('anti-false-green: the fixture really is the pre-startup-chain state, with MODULES fully built', () => {
    // If MODULES were empty, every assertion below would pass vacuously — this is the #66 failure mode.
    expect(Object.keys(w.MODULES).length).toBeGreaterThanOrEqual(16)
    expect(w.MODULES.breedtimer.voidCheckPercent).toBe(95) // the field the pre-fix TypeError named
    // The startup chain has NOT run: delayStartAgain (which also starts mainLoop/guiLoop) never fired.
    // So anything MODULESdefault contains was put there by the bundle itself, which is the fix.
    expect(typeof w.setInterval).toBe('function')
    expect(w.game.global.addonUser).not.toBe(true) // delayStartAgain sets this — proof it did not run
  })

  it('MODULESdefault is populated at bundle-eval time — every src-owned module has a default', () => {
    const mods = Object.keys(w.MODULES).filter((m: string) => m !== 'graphs')
    expect(mods.length).toBeGreaterThanOrEqual(15)
    for (const m of mods)
      expect(Object.prototype.hasOwnProperty.call(w.MODULESdefault, m), `MODULESdefault is missing '${m}'`).toBe(true)
    expect(w.MODULESdefault.breedtimer.voidCheckPercent).toBe(95)
    expect(w.MODULESdefault.jobs.autoRatio7).toEqual([1, 1, 98])
  })

  it('MODULES.graphs is registered by legacy/Graphs.js AFTER the src IIFE — so it is NOT in the eager seed', () => {
    // This is not incidental — it is the reason the eager seed alone cannot be the whole fix. Pinned so
    // that a future MANIFEST reorder (or a Graphs port) is a red test rather than a silent re-break.
    expect(w.MODULES.graphs).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(w.MODULESdefault, 'graphs')).toBe(false)
  })

  it('compareModuleVars() does not throw, and on a fresh boot reports no overrides', () => {
    expect(() => w.compareModuleVars()).not.toThrow()
    expect(w.compareModuleVars()).toEqual({})
  })

  it('exportModuleVars() does not throw (the Export button, clickable from 4s)', () => {
    expect(() => w.exportModuleVars()).not.toThrow()
    expect(w.exportModuleVars()).toBe('{}')
  })

  it('resetModuleVars() restores the DEFAULTS — before the fix it wiped MODULES to {} outright', () => {
    // The pre-fix failure here is not the TypeError, it is worse and quieter: `MODULES =
    // JSON.parse(JSON.stringify(MODULESdefault))` with an unseeded default assigns MODULES = {}. Every
    // subsequent `MODULES["maps"].something` in the tick then throws, i.e. clicking "Reset Module Vars"
    // in the first 8 seconds DELETED the module config wholesale. (compareModuleVars() then does not
    // throw at all — it iterates the now-empty MODULES — so the crash surfaces somewhere else entirely.)
    // boot.mjs stubs setTimeout, so drive the deferred body by hand; that body IS resetModuleVars.
    const deferred: Array<() => void> = []
    w.setTimeout = (fn: () => void) => (deferred.push(fn), 0)

    w.MODULES.jobs.scientistRatio = 99
    w.resetModuleVars()
    expect(w.ATrunning).toBe(false) // the window is open — a throw in the body would leave it here
    expect(deferred.length).toBe(1)

    expect(() => deferred[0]()).not.toThrow()
    expect(w.ATrunning).toBe(true) // …and it closed, so AT is not dead
    expect(Object.keys(w.MODULES).length).toBeGreaterThanOrEqual(15) // NOT {}
    expect(w.MODULES.jobs.scientistRatio).toBe(25) // the declared default, restored
    expect(w.localStorage.getItem('storedMODULES')).toBe('{}') // "no overrides" (#71a)
  })

  it('the seed is a deep CLONE — mutating MODULES must not corrupt MODULESdefault', () => {
    w.MODULES.jobs.autoRatio7.push(7)
    expect(w.MODULESdefault.jobs.autoRatio7).toEqual([1, 1, 98])
  })

  it('it still DETECTS overrides — the diff is real, not a blanket {}', () => {
    // Anti-false-green for "reports no overrides" above: if compareModuleVars() had been made total by
    // returning {} unconditionally, every assertion in this file would pass and the feature would be dead.
    w.MODULES.jobs.scientistRatio = 99
    w.MODULES.breedtimer.voidCheckPercent = 42
    expect(w.compareModuleVars()).toEqual({ jobs: { scientistRatio: 99 }, breedtimer: { voidCheckPercent: 42 } })
    expect(w.exportModuleVars()).toContain('"scientistRatio":99')
  })

  it('TOTAL: with MODULESdefault wiped entirely it returns {} instead of throwing', () => {
    // The fallback the issue asks for, and the state a page is in before ANY seeding: "no overrides yet".
    w.MODULESdefault = {}
    expect(() => w.compareModuleVars()).not.toThrow()
    expect(w.compareModuleVars()).toEqual({})
    expect(w.exportModuleVars()).toBe('{}')
  })

  it('after delayStartAgain re-seeds (8s), graphs gains a default and diffs normally — unchanged from today', () => {
    w.MODULESdefault = JSON.parse(JSON.stringify(w.MODULES)) // what delayStartAgain does
    expect(w.compareModuleVars()).toEqual({})
    w.MODULES.graphs.useDarkAlways = true
    expect(w.compareModuleVars()).toEqual({ graphs: { useDarkAlways: true } })
  })
})
