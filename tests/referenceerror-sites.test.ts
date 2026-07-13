// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// Regression net for #79 — seven live strict-mode ReferenceErrors that shipped for months behind
// `@ts-expect-error #32 latent` markers. Both are the SAME bug class already fixed once in #22
// (heirlooms.ts loom-swap): a bare identifier with no binding anywhere in src/, legacy/ or the game.
// A read of an unbound name is a ReferenceError, not `undefined` — and mainLoop has no try/catch
// (#87), so each throw killed every automation ordered after it, on every tick, forever.
//
//   portal.ts   doPortal / RdoPortal → `loom`   (never bound; the finder's return value was dropped)
//   mapfunctions-amp.ts RAMPreset(true) ×5      → `recyle`  (typo for the in-scope `recycle`)
//
// Both sites are REACHABLE from mainLoop (AutoTrimps2.js:228 autoPortal → doPortal;
// AutoTrimps2.js:300 RautoMap → maps.ts:1196 RAMPreset(true)). These tests drive the crashing
// branch directly and assert it completes and actuates.

let portal: typeof import('../src/modules/portal')
let amp: typeof import('../src/modules/mapfunctions-amp')

// Mirrors the real createSetting types (settings-defs.ts:751 / :141 / :527).
const setText = (id: string, value: string) => {
  ;(globalThis as any).autoTrimpSettings[id] = { type: 'textValue', value }
}
const setBool = (id: string, enabled: boolean) => {
  ;(globalThis as any).autoTrimpSettings[id] = { type: 'boolean', enabled }
}

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).game = { options: { menu: { showHeirloomAnimations: { enabled: false } } } }
  // heirlooms.ts (highdmgshield) is reached by bare name via the legacy bridge, not by import.
  const heirlooms = await import('../src/modules/heirlooms')
  Object.assign(globalThis, heirlooms)
  portal = await import('../src/modules/portal')
  amp = await import('../src/modules/mapfunctions-amp')
})

describe('#79 portal.ts — bare `loom` in doPortal / RdoPortal was a ReferenceError', () => {
  const myLoom = { name: 'MyShield' }

  beforeEach(() => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = {
      global: {
        portalActive: true,
        heirloomsCarried: [{ name: 'Other' }, myLoom],
        ShieldEquipped: { name: 'Other' },
      },
    }
    // The equip branch is the only thing under test; stub everything (R)doPortal reaches afterwards
    // so the function can run to completion — the point of the test is that it *reaches* the end.
    ;(globalThis as any).selectHeirloom = vi.fn()
    ;(globalThis as any).equipHeirloom = vi.fn()
    for (const name of [
      'portalClicked', 'autoMagmiteSpender', 'autoheirlooms3', 'activateClicked', 'cancelPortal',
      'viewPortalUpgrades', 'numTab', 'buyPortalUpgrade', 'c2runner', 'selectChallenge',
      'checkCompleteDailies', 'getDailyChallenge', 'getDailyTimeString', 'swapPortalUniverse',
      'activatePortal', 'RactivatePortal', 'resetVars', 'RresetVars',
    ]) {
      ;(globalThis as any)[name] = vi.fn()
    }
    ;(globalThis as any).portalWindowOpen = false
    ;(globalThis as any).portalUniverse = 1
    ;(globalThis as any).lastHeliumZone = 0
    ;(globalThis as any).zonePostpone = 0
    ;(globalThis as any).lastRadonZone = 0
    ;(globalThis as any).RzonePostpone = 0
    setText('highdmg', 'MyShield')
  })

  for (const fn of ['doPortal', 'RdoPortal'] as const) {
    it(`${fn}() equips the high-damage shield instead of throwing`, () => {
      expect(() => (portal as any)[fn]()).not.toThrow()
      // index 1 = myLoom's position in heirloomsCarried — proves the finder's value reached indexOf.
      expect((globalThis as any).selectHeirloom).toHaveBeenCalledWith(1, 'heirloomsCarried', true)
      expect((globalThis as any).equipHeirloom).toHaveBeenCalledOnce()
    })

    it(`${fn}() does nothing (and does not throw) when no carried heirloom matches 'highdmg'`, () => {
      setText('highdmg', 'NotCarried')
      expect(() => (portal as any)[fn]()).not.toThrow()
      expect((globalThis as any).selectHeirloom).not.toHaveBeenCalled()
    })
  }
})

describe('#79 mapfunctions-amp.ts — bare `recyle` in RAMPreset(true) was a ReferenceError', () => {
  beforeEach(() => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = { global: {} }
    ;(globalThis as any).recycleMap = vi.fn()
    ;(globalThis as any).getMapIndex = (id: unknown) => id
    for (let i = 1; i <= 5; i++) {
      ;(globalThis as any)[`RdAMPrepMap${i}`] = `dmap${i}`
      ;(globalThis as any)[`RAMPrepMap${i}`] = `map${i}`
    }
  })

  it('daily arm: recycles all five prep maps and CLEARS them (the clear was unreachable)', () => {
    setBool('RdAMPraidrecycle', true)
    expect(() => amp.RAMPreset(true)).not.toThrow()
    expect((globalThis as any).recycleMap).toHaveBeenCalledTimes(5)
    expect((globalThis as any).recycleMap).toHaveBeenCalledWith('dmap1')
    expect((globalThis as any).recycleMap).toHaveBeenCalledWith('dmap5')
    // The permanent wedge: maps.ts:1195 re-enters RAMPreset(true) forever while these stay set.
    for (let i = 1; i <= 5; i++) {
      expect((globalThis as any)[`RdAMPrepMap${i}`]).toBeUndefined()
    }
  })

  it('daily arm: honours recycle=false — clears the prep maps without recycling', () => {
    setBool('RdAMPraidrecycle', false)
    expect(() => amp.RAMPreset(true)).not.toThrow()
    expect((globalThis as any).recycleMap).not.toHaveBeenCalled()
    for (let i = 1; i <= 5; i++) {
      expect((globalThis as any)[`RdAMPrepMap${i}`]).toBeUndefined()
    }
  })

  it('non-daily arm (the never-broken twin) still behaves identically', () => {
    setBool('RAMPraidrecycle', true)
    expect(() => amp.RAMPreset(false)).not.toThrow()
    expect((globalThis as any).recycleMap).toHaveBeenCalledTimes(5)
    for (let i = 1; i <= 5; i++) {
      expect((globalThis as any)[`RAMPrepMap${i}`]).toBeUndefined()
    }
  })
})
