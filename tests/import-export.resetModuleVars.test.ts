// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest'

// #71a regression — resetModuleVars() ("Reset Module Vars" GUI button) had two defects:
//
//  1. It persisted `JSON.stringify(storedMODULES)`, reading a name NOTHING in the shipped bundle ever
//     assigns → ReferenceError. It threw AFTER `ATrunning = false` and BEFORE the line restoring it, so
//     the button did not merely fail — it stopped AutoTrimps DEAD until the page was reloaded. Fixed by
//     persisting `compareModuleVars()`, which is what both of its sibling writers persist
//     (AutoTrimps2.js:380 and importModuleVars()). After MODULES := MODULESdefault that diff is `{}` —
//     the correct "no overrides" state, matching the localStorage.removeItem on the line before.
//
//  2. `setTimeout((function(){…})(a), 101)` IMMEDIATELY INVOKED the closure and passed setTimeout its
//     `undefined` return. There was no 101ms defer at all. The ATrunning false→true window only means
//     anything if the body is deferred past the in-flight mainLoop tick — so it is now really deferred.

let importExport: typeof import('../src/modules/import-export')

const DEFAULTS = { maps: { advSpecialMapMod_numZones: 3 }, jobs: { ratio: [1, 2, 3] } }

/**
 * This repo's jsdom environment does NOT expose `localStorage` as a global (verified), and
 * resetModuleVars() calls `localStorage.removeItem`. Supply a minimal in-memory Storage — the removal
 * is part of the behavior under test (it is the line the reset pairs with persisting the empty diff).
 */
const localStore = new Map<string, string>()
const fakeLocalStorage = {
  getItem: (k: string) => (localStore.has(k) ? localStore.get(k)! : null),
  setItem: (k: string, v: string) => { localStore.set(k, String(v)) },
  removeItem: (k: string) => { localStore.delete(k) },
  clear: () => { localStore.clear() },
}

beforeAll(async () => {
  // import-export.ts runs settingsProfileMakeGUI() + initializeSettingsProfiles() at module-eval time,
  // which touch MODULES, game.options.menu.darkTheme and localStorage. Seed them BEFORE the dynamic
  // import or the module throws on load.
  ;(globalThis as any).localStorage = fakeLocalStorage
  ;(globalThis as any).game = {
    options: { menu: { showHeirloomAnimations: { enabled: false }, darkTheme: { enabled: 1 } } },
  }
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).MODULES = JSON.parse(JSON.stringify(DEFAULTS))
  ;(globalThis as any).MODULESdefault = JSON.parse(JSON.stringify(DEFAULTS))
  importExport = await import('../src/modules/import-export')
})

const STALE = JSON.stringify({ maps: { advSpecialMapMod_numZones: 9 } })

beforeEach(() => {
  vi.useFakeTimers()
  ;(globalThis as any).MODULESdefault = JSON.parse(JSON.stringify(DEFAULTS))
  // A user who has overridden a module var — this is what the reset must throw away.
  ;(globalThis as any).MODULES = JSON.parse(JSON.stringify(DEFAULTS))
  ;(globalThis as any).MODULES.maps.advSpecialMapMod_numZones = 9
  ;(globalThis as any).ATrunning = true
  ;(globalThis as any).debug = vi.fn()
  // NOTE: safeSetItems is a REAL import from utils.ts (not a global), so it cannot be spied on
  // globalThis — it genuinely writes to localStorage. Assert against the store; that exercises the
  // real persistence path rather than a stub of it.
  localStore.clear()
  fakeLocalStorage.setItem('storedMODULES', STALE)
})

afterEach(() => { vi.useRealTimers() })

describe('#71a: resetModuleVars no longer throws ReferenceError (and AT keeps running)', () => {
  it('the phantom `storedMODULES` identifier is created by nothing, anywhere', () => {
    // The severity pin: it is absent from the global object, which is exactly why the old bare read
    // was a ReferenceError rather than a benign `undefined`. (The *string* 'storedMODULES' is still a
    // live localStorage KEY — that was never the bug.)
    expect('storedMODULES' in globalThis).toBe(false)
  })

  it('does not throw, and restores ATrunning (it used to halt AT until page reload)', () => {
    expect(() => importExport.resetModuleVars()).not.toThrow()
    expect((globalThis as any).ATrunning).toBe(false) // paused while the reset is pending
    expect(() => vi.runAllTimers()).not.toThrow()
    expect((globalThis as any).ATrunning).toBe(true) // ← the line the ReferenceError never reached
  })

  it('actually DEFERS the body — it used to run synchronously (the IIFE bug)', () => {
    // `setTimeout((function(){…})(a), 101)` invoked the closure immediately and handed setTimeout
    // `undefined`. Pin the defer: before the timers run, nothing has been reset yet.
    importExport.resetModuleVars()
    expect((globalThis as any).MODULES.maps.advSpecialMapMod_numZones).toBe(9) // untouched — still deferred
    expect(fakeLocalStorage.getItem('storedMODULES')).toBe(STALE) // not yet rewritten
    vi.runAllTimers()
    expect((globalThis as any).MODULES.maps.advSpecialMapMod_numZones).toBe(3) // now reset to default
  })

  it('resets MODULES to a deep COPY of MODULESdefault (mutating one must not corrupt the other)', () => {
    importExport.resetModuleVars()
    vi.runAllTimers()
    expect((globalThis as any).MODULES).toEqual(DEFAULTS)
    ;(globalThis as any).MODULES.jobs.ratio.push(99)
    expect((globalThis as any).MODULESdefault.jobs.ratio).toEqual([1, 2, 3])
  })

  it('persists the compareModuleVars() diff — which after the reset is the empty "no overrides" state', () => {
    importExport.resetModuleVars()
    vi.runAllTimers()
    // The semantic the fix restores: MODULES now equals MODULESdefault, so the stored override diff is
    // `{}`. Anything else would re-apply the very overrides the button exists to clear.
    expect(fakeLocalStorage.getItem('storedMODULES')).toBe('{}')
    expect(importExport.compareModuleVars()).toEqual({})
  })

  it('compareModuleVars() is the right source — it reports overrides while they exist', () => {
    // Anti-false-green for the assertion above: if compareModuleVars() always returned {}, the "{}"
    // expectation would prove nothing. It does not — it returns the live diff.
    expect(importExport.compareModuleVars()).toEqual({ maps: { advSpecialMapMod_numZones: 9 } })
  })
})
