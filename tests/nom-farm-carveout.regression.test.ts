// @vitest-environment jsdom
//
// #209 regression net — a 1 Hz RENDER function must not own a 10 Hz AUTOMATION global.
//
// `shouldFarm` is written and read by autoMap(), which runs every 100 ms. updateCustomButtons() — a
// render function dispatched from guiLoop every 1000 ms — also wrote it: `if (universe == 1 &&
// getPageSetting('DisableFarm') <= 0) shouldFarm = false`, on the SHIPPED DEFAULT of DisableFarm (-1),
// plus the U2 twin. Because maps.ts had no per-tick writer for the `<= 0` case, that render write was
// the only reset, arriving between two autoMap ticks — so one autoMap call in ten read `false` at its
// shouldDoMaps / shouldFarmLowerZone tests and then wrote `true` further down in the Nom block. The
// same invocation disagreeing with itself flipped siphlvl between world-10 and world-Siphonology.level
// and toggled the game's repeatClicked() roughly once a second.
//
// ⚠️ THE PROOF NET IS BLIND TO HALF OF THIS BY CONSTRUCTION. scripts/sim/boot.mjs stubs setInterval
// dead, so guiLoop — and therefore updateCustomButtons — NEVER RUNS in L0. `baseline-zero` staying
// green is not evidence that the deleted write is gone; it is evidence the net cannot see it. That
// half is proven here, by hand, by driving the real function. (The maps.ts half IS sim-visible, and
// the one at-settings fixture carries DisableFarm/RDisableFarm = -1, so it does exercise the new arm.)

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { row, def, dropdownScaffold, clearScaffoldRows, baseGame } from './harness/updateCustomButtons'

const ROOT = resolve(__dirname, '..')

/**
 * Source with `//` line comments stripped.
 *
 * Load-bearing for every source assertion below, and the reason is not hypothetical: the comments
 * this change ADDED quote the deleted code verbatim ("`shouldFarm = shouldFarm || false` was here"),
 * so a naive regex over the raw file matches the explanation of the fix and reports the fix missing.
 * Grepping prose and calling it evidence about code is its own small false-green.
 */
const code = (rel: string) =>
  readFileSync(resolve(ROOT, rel), 'utf8')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')

// ─── Half 1: the render function no longer touches the global ────────────────────────────────────

describe('#209 — updateCustomButtons does not write shouldFarm', () => {
  let vis: typeof import('../src/modules/settings-visibility')

  beforeEach(async () => {
    // Do NOT reset document.body — tests/setup.ts installs the shared scaffold that utils.ts and
    // heirlooms.ts append to at module load, and wiping it makes those imports throw.
    clearScaffoldRows()
    ;(globalThis as any).MODULES = {}
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = baseGame()
    ;(globalThis as any).debug = vi.fn()
    ;(globalThis as any).bwRewardUnlocked = () => false
    ;(globalThis as any).renderControlFace = () => {}
    ;(globalThis as any).prettify = (n: unknown) => String(n)
    Object.assign(globalThis, await import('../src/modules/utils'))
    vis = await import('../src/modules/settings-visibility')
  })

  /** The state autoMap leaves behind when its Nom carve-out has just fired. */
  const arm = (universe: number) => {
    dropdownScaffold()
    row('autoMapBtn')
    def('DisableFarm', 'value', { value: -1 }) // the SHIPPED default — `-1 <= 0` is true
    def('RDisableFarm', 'value', { value: -1 })
    def('FarmWhenNomStacks7', 'boolean', { enabled: true })
    def('MaxMapBonuslimit', 'value', { value: 10 })
    ;(globalThis as any).game.global.universe = universe
    ;(globalThis as any).shouldFarm = true
    ;(globalThis as any).RshouldFarm = true
  }

  it('TRIPWIRE: the gate that used to fire really is satisfied by this fixture', () => {
    // Without this the test below could pass because the branch was never reachable rather than
    // because the write is gone — the #66 false-green shape.
    arm(1)
    const gps = (globalThis as any).getPageSetting
    expect(gps('DisableFarm')).toBe(-1)
    expect(gps('DisableFarm') <= 0).toBe(true)
    expect((globalThis as any).game.global.universe).toBe(1)
  })

  it('U1: leaves shouldFarm exactly as autoMap left it', () => {
    arm(1)
    vis.updateCustomButtons()
    expect((globalThis as any).shouldFarm).toBe(true)
  })

  it('U2: leaves RshouldFarm exactly as RautoMap left it', () => {
    arm(2)
    vis.updateCustomButtons()
    expect((globalThis as any).RshouldFarm).toBe(true)
  })

  it('the write is gone from the source, in both universes', () => {
    // Belt to the braces above: the behavioural tests drive ONE call, and a write reintroduced under a
    // condition this fixture happens not to satisfy would slip past them. There is no legitimate reason
    // for this file to assign either global — it is a render function.
    const assignments = [...code('src/modules/settings-visibility.ts').matchAll(/\bR?shouldFarm\s*=[^=]/g)]
      .map((m) => m[0].trim())
    expect(assignments).toEqual([])
  })
})

// ─── Half 2: the reset now lives in the owner, and it is symmetric ───────────────────────────────

describe('#209 — autoMap owns the DisableFarm reset (executed verbatim from maps.ts)', () => {
  // Read the real arm out of the shipped file and run it. A retyped copy of these lines would pass
  // forever no matter what maps.ts actually says — the same reason tests/dispatch-holes.regression
  // extracts the BuyBuildingsNew dispatch instead of transcribing it.
  const extract = (needle: string) => {
    const src = readFileSync(resolve(ROOT, 'src/modules/maps.ts'), 'utf8').split('\n')
    const start = src.findIndex((l) => l.includes(needle))
    if (start < 0) throw new Error(`maps.ts no longer contains ${needle}`)
    let depth = 0
    for (let i = start; i < src.length; i++) {
      for (const ch of src[i]) {
        if (ch === '{') depth++
        else if (ch === '}') depth--
      }
      // The arm ends at the line that closes the `else` block — depth back to 0 AFTER at least one `{`.
      if (depth === 0 && i > start) return src.slice(start, i + 1).join('\n')
    }
    throw new Error(`unbalanced braces after ${needle}`)
  }

  const U1 = extract("if (getPageSetting('DisableFarm') > 0) {")
  const U2 = extract("if (getPageSetting('RDisableFarm') > 0) {")

  it('TRIPWIRE: both arms really were extracted, and both have an else', () => {
    for (const [name, block] of [['U1', U1], ['U2', U2]] as const) {
      expect(block, name).toContain('> 0')
      expect(block, name).toContain('else')
      expect(block, name).toContain('repeatUntil')
      expect(block.split('\n').length, name).toBeLessThan(12) // not a runaway slice of the file
    }
    expect(U1).toContain('shouldFarm = false')
    expect(U2).toContain('RshouldFarm = false')
  })

  /** Run one arm as one autoMap tick and report what it left in the global. */
  const tick = (block: string, global: string, setting: string, disableFarm: number, hd: number) => {
    const sandbox: any = vm.createContext({
      getPageSetting: (id: string) => (id === setting ? disableFarm : false),
      calcHDratio: () => hd,
      RcalcHDratio: () => hd,
      game: { options: { menu: { repeatUntil: { enabled: 0 } } } },
      toggleSetting: () => {},
      [global]: 'UNTOUCHED',
    })
    vm.runInContext(block, sandbox)
    return sandbox[global]
  }

  it('POSITIVE CONTROL: with DisableFarm > 0 the arm still decides from the H:D ratio', () => {
    // If these fail the harness is not reaching the assignment and nothing below means anything.
    expect(tick(U1, 'shouldFarm', 'DisableFarm', 16, 20)).toBe(true) // 20 >= 16 → farm
    expect(tick(U1, 'shouldFarm', 'DisableFarm', 16, 4)).toBe(false) // 4 < 16 → do not
    expect(tick(U2, 'RshouldFarm', 'RDisableFarm', 16, 20)).toBe(true)
    expect(tick(U2, 'RshouldFarm', 'RDisableFarm', 16, 4)).toBe(false)
  })

  it('with DisableFarm <= 0 the arm resets the global itself — it used to leave it alone', () => {
    // This is the fix. Before it, the `<= 0` case fell through with NO writer, which is why a render
    // function 10x slower than this loop ended up owning the value.
    for (const off of [-1, 0]) {
      expect(tick(U1, 'shouldFarm', 'DisableFarm', off, 20)).toBe(false)
      expect(tick(U2, 'RshouldFarm', 'RDisableFarm', off, 20)).toBe(false)
    }
  })

  it('the reset does not depend on the H:D ratio (it is a reset, not a decision)', () => {
    for (const hd of [0, 1, 10, 1e9]) {
      expect(tick(U1, 'shouldFarm', 'DisableFarm', -1, hd)).toBe(false)
      expect(tick(U2, 'RshouldFarm', 'RDisableFarm', -1, hd)).toBe(false)
    }
  })
})

// ─── Half 3: the dead sibling is gone ────────────────────────────────────────────────────────────

describe('#209 — the `x = x || false` no-op is gone from both universes', () => {
  it('maps.ts no longer contains a self-assigning shouldFarm', () => {
    // `shouldFarm = shouldFarm || false` is `shouldFarm` for every boolean — it never reset anything.
    // It is worth pinning because it is the shape that made the defect survive review: it LOOKS like
    // the reset, so a reader checking "is there a reset in autoMap?" found one and moved on.
    const src = code('src/modules/maps.ts')
    expect(src).not.toMatch(/shouldFarm\s*=\s*shouldFarm\s*\|\|/)
    expect(src).not.toMatch(/RshouldFarm\s*=\s*RshouldFarm\s*\|\|/)
    // …and the arms that replaced it are really there (anti-false-green: an EMPTY file also passes).
    expect(src).toMatch(/else\s*\{\s*shouldFarm = false;\s*\}/)
    expect(src).toMatch(/else\s*\{\s*RshouldFarm = false;\s*\}/)
  })
})
