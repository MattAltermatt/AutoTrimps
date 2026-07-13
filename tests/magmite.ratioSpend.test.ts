// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { createSetting } from '../src/modules/settings-engine'

// magmite.ts writes `MODULES["magmite"]` at MODULE-EVAL time (the globalThis seam the whole port runs on
// — see legacy-bridge.ts). A static `import` is HOISTED above any top-level assignment, so the registry
// must be seeded and the module pulled in DYNAMICALLY, or collection dies on
// `ReferenceError: MODULES is not defined` before a single test runs.
let magmite: typeof import('../src/modules/magmite')
beforeAll(async () => {
  ;(globalThis as any).MODULES = { magmite: {} }
  magmite = await import('../src/modules/magmite')
})

// #87's throw site #2, and it fires on FACTORY DEFAULTS.
//
// `autoMagmiteSpender()` is dispatched from legacy/AutoTrimps2.js:200 — near the TOP of the U1 block.
// A throw there kills everything ordered after it, every tick, forever: nature, buyUpgrades, autoshrine,
// the coordinator, ALL buildings, the generator, ALL jobs, autoPortal, ALL of combat, stance, spire,
// raiding, golden upgrades. Gathering still runs (it is dispatched earlier), so the player watches
// resources climb to the cap while nothing is ever bought and the run never advances or portals — with
// every AT toggle still showing ON.
//
// The trigger is not exotic. All four ratio settings default to -1 ("Use -1 or 0 to not spend on this"):
//
//   effspend  = (-1 > 0) ? … : 0   →  0        (all four)
//   effspendr = (0  > 0) ? … : 0   →  0        (all four)
//   effr      = (eff > 0) ? … : 1  →  1        (nothing spent yet)
//   efffinal  = effspendr - effr   →  -1       ← ALL FOUR
//   if (efffinal !== -1) push(…)   →  never fires  ⇒  ratios === []
//   ratios[0] === efffinal         →  undefined === -1  →  false, ×4
//   ⇒ miRatio() falls off the end and returns undefined
//   ⇒ game.generatorUpgrades[undefined] is undefined
//   ⇒ upgrader.cost() → TypeError
//
// So: tick "Ratio Spending", leave the ratios alone, and AutoTrimps half-dies. The `-1` default is the
// setting's own documented "don't spend on this" value — the crash is what the DEFAULT configuration does.

const UPGRADES = ['Efficiency', 'Capacity', 'Supply', 'Overclocker'] as const

function seedSettings(ratios: Record<string, number>) {
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).document.body.innerHTML = '<div id="Magma"></div>'
  createSetting('ratiospend', 'Ratio Spending', '', 'boolean', true, null, 'Magma')
  for (const [id, v] of Object.entries(ratios))
    createSetting(id, id, 'Use -1 or 0 to not spend on this.', 'value', v, null, 'Magma')
}

function seedGame(magmite_ = 1e9, spent = 0) {
  ;(globalThis as any).game = {
    global: { magmite: magmite_ },
    generatorUpgrades: Object.fromEntries(
      UPGRADES.map((n) => [n, { upgrades: spent, cost: () => 100, done: spent }]),
    ),
    permanentGeneratorUpgrades: {},
  }
}

beforeEach(() => {
  ;(globalThis as any).debug = vi.fn()
  ;(globalThis as any).buyGeneratorUpgrade = vi.fn()
  ;(globalThis as any).MODULES = { magmite: {} }
  ;(globalThis as any).ATversion = 'test' // createSetting stamps it into the settings record
})

describe('#87/#15: autoMagmiteSpender must not throw on the factory-default ratios', () => {
  it('THE BUG: Ratio Spending ON with every ratio at its -1 default', () => {
    // This is a fresh install where the player ticked one checkbox. Nothing else.
    seedSettings({ effratio: -1, capratio: -1, supratio: -1, ocratio: -1 })
    seedGame()

    // Before the fix this threw:
    //   TypeError: Cannot read properties of undefined (reading 'cost')
    // and every automation after magmite in mainLoop died with it, every tick, until reload.
    expect(() => magmite.autoMagmiteSpender()).not.toThrow()

    // And it must do the semantically right thing: -1 means "do not spend on this", for all four.
    // So the correct behavior is to spend on NOTHING — not to crash, and not to pick one arbitrarily.
    expect((globalThis as any).buyGeneratorUpgrade).not.toHaveBeenCalled()
  })

  it('POSITIVE CONTROL: a configured ratio still spends — the guard did not just disable the feature', () => {
    // The load-bearing half. A "fix" that makes the function return early always would pass the test
    // above and silently kill Ratio Spending for the players who actually use it.
    seedSettings({ effratio: 100, capratio: -1, supratio: -1, ocratio: -1 })
    seedGame()

    magmite.autoMagmiteSpender()
    expect((globalThis as any).buyGeneratorUpgrade).toHaveBeenCalledWith('Efficiency')
  })

  it('miRatio() returns undefined when no ratio is configured — that is the shape autoMagmiteSpender must handle', () => {
    seedSettings({ effratio: -1, capratio: -1, supratio: -1, ocratio: -1 })
    seedGame()
    // Pinned deliberately: the fix belongs at the CALLER (treat "no ratio configured" as "spend nothing"),
    // not by inventing a fallback pick inside miRatio(). Choosing which upgrade to buy when the player
    // configured none would be inventing behavior — and picking one is a balance decision, not a repair.
    expect(magmite.miRatio()).toBeUndefined()
  })

  it('a ratio of 0 also means "do not spend" (the tooltip says -1 OR 0)', () => {
    seedSettings({ effratio: 0, capratio: 0, supratio: 0, ocratio: 0 })
    seedGame()
    expect(() => magmite.autoMagmiteSpender()).not.toThrow()
    expect((globalThis as any).buyGeneratorUpgrade).not.toHaveBeenCalled()
  })
})
