// @vitest-environment jsdom
//
// #253 — the battle-screen "Auto Maps" button is a two-state control over a THREE-state setting.
//
// AutoMaps is Off / On / Unique. `toggleAutoMaps` wrote a hard-coded 1 on the off→on transition, and
// getPageSetting returns parseInt, so 2 ("Unique") is truthy: one off/on cycle demoted it to "On"
// with no message. Five behaviours are gated on exactly `== 2` (maps.ts:166-170), and the U2 twin
// inverts the sense (`runUniques = RAutoMaps == 1`), so the same two clicks turn uniques ON for a U2
// player who had turned them off.
//
// Not visible to the L0 net: it needs a click, and the sim dispatches none.

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('#253 — toggleAutoMaps preserves the user’s mode across an off/on cycle', () => {
  let menu: typeof import('../src/modules/settings-menu')
  let utils: typeof import('../src/modules/utils')

  beforeEach(async () => {
    vi.resetModules() // the remembered mode is module-scoped — every test starts from a fresh module
    ;(globalThis as any).game = {
      global: { universe: 1 },
      options: { menu: { darkTheme: { enabled: 0 } } },
    }
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).safeSetItems = vi.fn()
    // saveSettings() re-stamps the version key (#76's load-gate defence) before serializing.
    ;(globalThis as any).ATversion = 'test-version'
    if (!document.getElementById('autoMapBtn')) {
      const btn = document.createElement('div')
      btn.id = 'autoMapBtn'
      document.body.appendChild(btn)
    }
    utils = await import('../src/modules/utils')
    Object.assign(globalThis, utils) // getPageSetting / setPageSetting / saveSettings by bare name
    menu = await import('../src/modules/settings-menu')
  })

  const seed = (id: string, value: number) => {
    ;(globalThis as any).autoTrimpSettings[id] = { id, name: id, type: 'multitoggle', value }
    if (!document.getElementById(id)) {
      const el = document.createElement('div')
      el.id = id
      document.body.appendChild(el)
    }
  }

  it('TRIPWIRE: 2 really is truthy through getPageSetting, which is why the bug existed', () => {
    seed('AutoMaps', 2)
    expect(utils.getPageSetting('AutoMaps')).toBe(2)
    expect(!!utils.getPageSetting('AutoMaps')).toBe(true) // …so the old code took the "turn off" arm
  })

  it('U1: Unique (2) survives an off/on cycle', () => {
    seed('AutoMaps', 2)
    menu.toggleAutoMaps() // → off
    expect(utils.getPageSetting('AutoMaps')).toBe(0)
    menu.toggleAutoMaps() // → back on
    expect(utils.getPageSetting('AutoMaps')).toBe(2)
  })

  it('U1: On (1) still round-trips to 1', () => {
    // The anti-over-fix: the common case must not move.
    seed('AutoMaps', 1)
    menu.toggleAutoMaps()
    expect(utils.getPageSetting('AutoMaps')).toBe(0)
    menu.toggleAutoMaps()
    expect(utils.getPageSetting('AutoMaps')).toBe(1)
  })

  it('U1: starting from Off with nothing remembered still turns on to 1', () => {
    // The page-reload-while-off case. It degrades to exactly the old hard-coded behaviour, so it
    // cannot regress anyone — but it must be pinned, or a future change to the fallback is silent.
    seed('AutoMaps', 0)
    menu.toggleAutoMaps()
    expect(utils.getPageSetting('AutoMaps')).toBe(1)
  })

  it('U2: "No Unique" (2) survives an off/on cycle — where the demotion INVERTED the meaning', () => {
    // maps.ts:1322 is `runUniques = getPageSetting('RAutoMaps') == 1`, so demoting 2 → 1 does not
    // just lose a mode, it switches uniques ON for a player who had them off.
    ;(globalThis as any).game.global.universe = 2
    seed('RAutoMaps', 2)
    menu.toggleAutoMaps()
    expect(utils.getPageSetting('RAutoMaps')).toBe(0)
    menu.toggleAutoMaps()
    expect(utils.getPageSetting('RAutoMaps')).toBe(2)
  })

  it('the two universes remember independently', () => {
    seed('AutoMaps', 1)
    seed('RAutoMaps', 2)
    menu.toggleAutoMaps() // U1 off, remembers 1
    ;(globalThis as any).game.global.universe = 2
    menu.toggleAutoMaps() // U2 off, remembers 2
    menu.toggleAutoMaps() // U2 on → 2
    expect(utils.getPageSetting('RAutoMaps')).toBe(2)
    ;(globalThis as any).game.global.universe = 1
    menu.toggleAutoMaps() // U1 on → 1, not 2
    expect(utils.getPageSetting('AutoMaps')).toBe(1)
  })
})

// ─── #252: the cycle counter must not concatenate ────────────────────────────────────────────────

describe('#252 — the multitoggle counter renders a number, not a concatenation', () => {
  beforeEach(async () => {
    ;(globalThis as any).autoTrimpSettings = {}
  })

  it('a STRING default of "0" renders (1/3), not (01/3)', async () => {
    // Four multitoggles are declared with the string '0' (the #69 family). createSetting stores that
    // verbatim and clampMultitoggle leaves an in-range value byte-identical, so the render path is
    // where it surfaced: `'0' + 1` is '01'. It self-corrected after the first click, which is why it
    // shipped — settingChanged's `btn.value++` coerces.
    const { renderControlFace } = await import('../src/modules/settings-engine')
    const el = document.createElement('div')
    renderControlFace(el, { type: 'multitoggle', value: '0', name: ['A', 'B', 'C'] })
    expect(el.querySelector('.settingCount')!.textContent).toBe('(1/3)')
  })

  it('a numeric value is unchanged', async () => {
    const { renderControlFace } = await import('../src/modules/settings-engine')
    for (const [value, expected] of [[0, '(1/3)'], [1, '(2/3)'], [2, '(3/3)']] as const) {
      const el = document.createElement('div')
      renderControlFace(el, { type: 'multitoggle', value, name: ['A', 'B', 'C'] })
      expect(el.querySelector('.settingCount')!.textContent).toBe(expected)
    }
  })
})
