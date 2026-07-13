// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// #69 ship C — the AutoStorage one-shot guard.
//
// RbuyBuildings() had never executed in production: its only gate is `getPageSetting('RBuyBuildingsNew')
// == true` (legacy/AutoTrimps2.js), and the default was the STRING 'true', which is never `== true`.
// Unquoting that default switches the whole function on for every U2 player for the first time — so its
// never-run body had to be audited as new code, and one line in it was user-hostile:
//
//     else { if (!game.global.autoStorage) { toggleAutoStorage(false); } }
//
// The game's toggleAutoStorage(false) is a FLIP, not a setter (.trimps-game/main.js:18378 —
// `if (!noChange) game.global.autoStorage = !game.global.autoStorage`). Guarded only on the flag being
// off, it re-fires the moment the player turns AutoStorage off — so AT would force it back on ~100ms
// later, every tick, forever, with no opt-out anywhere in the settings. The setting's own tooltip only
// promises to "enable Vanilla AutoStorage if its off"; holding it on against the player is a different
// thing entirely.
//
// The fix is a one-shot: enable it once per page load if it is off, then respect the player. These tests
// pin BOTH halves — it must turn on once, and it must NOT fight the player afterwards.

let buildings: typeof import('../src/modules/buildings')
let toggleCalls: number

// The one-shot flag is module state, so each test needs a fresh module instance.
async function freshModule() {
  vi.resetModules()
  toggleCalls = 0
  ;(globalThis as any).toggleAutoStorage = vi.fn((noChange?: boolean) => {
    toggleCalls++
    // Mirror the real game: a flip unless noChange.
    if (!noChange) (globalThis as any).game.global.autoStorage = !(globalThis as any).game.global.autoStorage
  })
  buildings = await import('../src/modules/buildings')
}

beforeEach(async () => {
  ;(globalThis as any).MODULES = { buildings: {} }
  ;(globalThis as any).game = { global: { autoStorage: false } }
  await freshModule()
})

/** Drive just the AutoStorage arm the way RbuyBuildings' `else` branch does. */
function autoStorageTick() {
  buildings.__syncAutoStorageOnce()
}

describe('#69 ship C: AT enables AutoStorage once, then respects the player', () => {
  it('turns AutoStorage ON when the player has it off', () => {
    expect((globalThis as any).game.global.autoStorage).toBe(false)
    autoStorageTick()
    expect((globalThis as any).game.global.autoStorage).toBe(true)
    expect(toggleCalls).toBe(1)
  })

  it('does not re-toggle once it is already on (the flip would turn it back OFF)', () => {
    autoStorageTick()
    autoStorageTick()
    autoStorageTick()
    expect((globalThis as any).game.global.autoStorage).toBe(true)
    expect(toggleCalls).toBe(1) // still exactly one — a second flip would have turned it off
  })

  it('THE BUG: does NOT force AutoStorage back on after the player turns it off', () => {
    autoStorageTick() // AT enables it once
    expect((globalThis as any).game.global.autoStorage).toBe(true)

    // The player clicks the game's AutoStorage button.
    ;(globalThis as any).game.global.autoStorage = false

    // AT keeps ticking. Before the one-shot guard, EVERY one of these re-seized the button.
    for (let i = 0; i < 50; i++) autoStorageTick()

    expect((globalThis as any).game.global.autoStorage).toBe(false) // the player's choice survives
    expect(toggleCalls).toBe(1) // AT never touched it again
  })

  it('leaves AutoStorage alone entirely when the player already had it on', () => {
    ;(globalThis as any).game.global.autoStorage = true
    for (let i = 0; i < 10; i++) autoStorageTick()
    expect((globalThis as any).game.global.autoStorage).toBe(true)
    expect(toggleCalls).toBe(0)
  })
})
