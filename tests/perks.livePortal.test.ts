// @vitest-environment node
//
// Regression net for #82 — AutoPerks was DEFINED behind `if (game.global.universe == 1)`, a
// condition evaluated once, at script-load time. Trimps reassigns game.global.universe live inside
// resetGame() (updates.js:4681) and never reloads the page, so a player who loads in U2 and portals
// into U1 was left with `AutoPerks === {}` — the whole feature gone for the session, and AT's own
// call site throwing mid-portal.
//
// The complementary half: RAutoPerks' METHODS are defined unconditionally, but its GUI is built
// only when the page LOADED in U2 — so a U1 -> U2 portal leaves RAutoPerks.clickAllocate() reading
// a #RratioPreset that was never built, and it null-derefs.
//
// These tests boot the REAL v5.10.1 clone in jsdom with the REAL AT bundle, seed the universe the
// way a save would, and then flip it the way the game does. Nothing about perks.ts is mocked.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { bootGame } from '../scripts/sim/boot.mjs'
import { TEST_BUNDLE } from './sim/bundle'

// #171 — a `TestPriorityQueue` stub used to be injected here, on the belief (stated in the comment it
// carried) that "perks.ts injects FastPriorityQueue via a remote <script> tag". That stopped being
// true in #75, which bundled the queue, and the stub was DEAD long before it was removed: the bundle
// declared `function FastPriorityQueue(...)` at global scope, and a global function declaration
// overwrites a property assigned onto the same global object, so `window.eval(bundle)` clobbered it.
//
// Which means this suite was silently running against the real, BROKEN vendored queue — while the
// stub, whose `splice` always removes, was exactly the correct implementation that would have hidden
// #171 had it actually been in play. A mock that cannot take effect is worse than no mock: it reads
// as coverage. Since #171 the queue is an npm dependency bundled into the IIFE, so there is nothing
// to supply and nothing to shadow — these tests exercise the shipped queue, which is the point.

/** Boot the clone with `universe` already set, THEN load AT — i.e. AT starts up in that universe. */
function bootInUniverse(universe: 1 | 2): Record<string, any> {
  const { window } = bootGame({}) as unknown as { window: Record<string, any> }
  window.game.global.universe = universe
  Object.assign(window, {
    GM_getValue: () => undefined,
    GM_setValue: () => {},
    GM_xmlhttpRequest: () => {},
    unsafeWindow: window,
  })
  window.eval(readFileSync(TEST_BUNDLE, 'utf8'))
  window.loadPageVariables?.()
  window.bootSettingsUI?.()
  return window
}

const has = (w: Record<string, any>, id: string) => w.document.getElementById(id) !== null

describe('#82 — AutoPerks must survive a live portal between universes', () => {
  it('POSITIVE CONTROL: each universe builds its own GUI when the page LOADS in it', () => {
    // Anti-false-green: if the boot never built any GUI, the tests below would pass vacuously.
    const u1 = bootInUniverse(1)
    expect(has(u1, 'ratioPreset'), 'U1 load must build #ratioPreset').toBe(true)
    expect(has(u1, 'RratioPreset')).toBe(false)

    const u2 = bootInUniverse(2)
    expect(has(u2, 'RratioPreset'), 'U2 load must build #RratioPreset').toBe(true)
    expect(has(u2, 'ratioPreset')).toBe(false)
  })

  it('AutoPerks methods are defined regardless of the universe the page loaded in', () => {
    // The core defect: these were all missing when the page loaded in U2.
    for (const universe of [1, 2] as const) {
      const w = bootInUniverse(universe)
      expect(
        typeof w.AutoPerks.clickAllocate,
        `AutoPerks.clickAllocate missing after loading in U${universe}`,
      ).toBe('function')
      expect(typeof w.AutoPerks.initialise).toBe('function')
      expect(typeof w.AutoPerks.displayGUI).toBe('function')
      expect(typeof w.RAutoPerks.clickAllocate).toBe('function')
    }
  })

  it('loaded in U2, portalled into U1: clickAllocate runs and mounts the U1 GUI', () => {
    const w = bootInUniverse(2)
    expect(has(w, 'ratioPreset')).toBe(false) // U1 GUI legitimately not built yet

    w.game.global.universe = 1 // what resetGame() does on a portal (updates.js:4681)

    expect(() => w.AutoPerks.clickAllocate()).not.toThrow()
    expect(has(w, 'ratioPreset'), 'the U1 GUI must be mounted lazily on use').toBe(true)
  })

  it('loaded in U1, portalled into U2: RclickAllocate runs and mounts the U2 GUI', () => {
    const w = bootInUniverse(1)
    expect(has(w, 'RratioPreset')).toBe(false)

    w.game.global.universe = 2

    expect(() => w.RAutoPerks.clickAllocate()).not.toThrow()
    expect(has(w, 'RratioPreset'), 'the U2 GUI must be mounted lazily on use').toBe(true)
  })

  it('re-mounting does not duplicate the two DOM ids both universes share', () => {
    // AutoPerks.displayGUI and RAutoPerks.displayGUI BOTH create #allocatorBtn1 and #customRatios.
    // A naive lazy mount would leave two of each after a portal.
    const w = bootInUniverse(1)
    w.game.global.universe = 2
    w.RAutoPerks.clickAllocate()

    for (const id of ['allocatorBtn1', 'customRatios']) {
      const n = w.document.querySelectorAll(`[id="${id}"]`).length
      expect(n, `#${id} is duplicated after a live portal`).toBe(1)
    }
    // ...and the stale universe's select is gone, so nothing reads the wrong universe's ratios.
    expect(has(w, 'ratioPreset')).toBe(false)
    expect(has(w, 'RratioPreset')).toBe(true)
  })

  it('ensureGUI is idempotent — calling clickAllocate twice does not rebuild or duplicate', () => {
    const w = bootInUniverse(1)
    w.AutoPerks.clickAllocate()
    w.AutoPerks.clickAllocate()
    expect(w.document.querySelectorAll('[id="ratioPreset"]').length).toBe(1)
    expect(w.document.querySelectorAll('[id="allocatorBtn1"]').length).toBe(1)
  })
})
