// @vitest-environment jsdom
//
// Behavioral characterization for settings-engine.ts (#46 — "net first" before #39).
//
// #39 will normalize the control taxonomy (toggle / cycle / action) and how each kind renders +
// responds to a click. Those semantics live entirely in three functions here:
//   - parseNum        — pure string→number parsing used by the value-entry appliers
//   - settingChanged  — THE click handler: boolean flip, multitoggle cycle-mod-length, dropdown read
//   - createSetting   — THE render path: per-`type` stored-object shape + button DOM
// This file pins their CURRENT behavior (quirks included, e.g. the `settingBtntrue` class string and
// the dead `valueNegative` branch at engine.ts:59) so a #39 taxonomy change regenerates the
// src-bundle byte-golden as an INTENTIONAL, reviewed diff instead of a silent one.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createSetting,
  settingChanged,
  parseNum,
  autoSetValue,
} from '../src/modules/settings-engine'

// ─── parseNum: pure, zero-dep golden master ──────────────────────────────────────────────────────
// autoSetValue lowercases input before calling parseNum, so the K/M/B suffix table is matched
// case-insensitively only for already-lowercased strings — characterize with lowercase inputs.
describe('settings-engine · parseNum (pure)', () => {
  it('parses e-notation via floor(mantissa * 10^exp)', () => {
    expect(parseNum('2e5')).toBe(200000)
    expect(parseNum('1.5e3')).toBe(1500)
  })

  it("takes the e-branch even when the exponent string is '0' (non-empty string is truthy)", () => {
    expect(parseNum('1e0')).toBe(1)
  })

  it('parses K/M/B suffixes via round(mantissa * 1000^base)', () => {
    expect(parseNum('200k')).toBe(200000) // base 1
    expect(parseNum('2.5m')).toBe(2500000) // base 2
    expect(parseNum('3b')).toBe(3000000000) // base 3
  })

  it('falls back to parseFloat for a plain number and for negatives', () => {
    expect(parseNum('42')).toBe(42)
    expect(parseNum('-1')).toBe(-1)
  })
})

// ─── settingChanged: the click semantics #39 changes ─────────────────────────────────────────────
describe('settings-engine · settingChanged (click semantics)', () => {
  let saveSettings: ReturnType<typeof vi.fn>
  let updateCustomButtons: ReturnType<typeof vi.fn>
  let checkPortalSettings: ReturnType<typeof vi.fn>

  beforeEach(() => {
    saveSettings = vi.fn()
    updateCustomButtons = vi.fn()
    checkPortalSettings = vi.fn()
    ;(globalThis as any).saveSettings = saveSettings
    ;(globalThis as any).updateCustomButtons = updateCustomButtons
    ;(globalThis as any).checkPortalSettings = checkPortalSettings
    ;(globalThis as any).autoTrimpSettings = {}
    // byId (utils.ts) is only reached by the dropdown branch — stub it to the real lookup.
    ;(globalThis as any).byId = (elId: string) => document.getElementById(elId)
    document.body.innerHTML = ''
  })

  function mountButton(id: string) {
    document.body.innerHTML = `<div id="${id}"></div>`
  }

  it('boolean: flips enabled and rewrites the class (quirky settingBtntrue/false string)', () => {
    ;(globalThis as any).autoTrimpSettings['Foo'] = { id: 'Foo', type: 'boolean', enabled: false }
    mountButton('Foo')

    settingChanged('Foo')
    expect((globalThis as any).autoTrimpSettings['Foo'].enabled).toBe(true)
    expect(document.getElementById('Foo')!.getAttribute('class')).toBe(
      'noselect settingsBtn settingBtntrue',
    )

    settingChanged('Foo')
    expect((globalThis as any).autoTrimpSettings['Foo'].enabled).toBe(false)
    expect(document.getElementById('Foo')!.getAttribute('class')).toBe(
      'noselect settingsBtn settingBtnfalse',
    )
  })

  it('multitoggle: cycles value forward and wraps at name.length, updating label + class', () => {
    ;(globalThis as any).autoTrimpSettings['Bar'] = {
      id: 'Bar',
      type: 'multitoggle',
      value: 0,
      name: ['Off', 'Some', 'All'],
    }
    mountButton('Bar')

    settingChanged('Bar') // 0 → 1
    expect((globalThis as any).autoTrimpSettings['Bar'].value).toBe(1)
    expect(document.getElementById('Bar')!.textContent).toBe('Some')
    expect(document.getElementById('Bar')!.getAttribute('class')).toBe(
      'noselect settingsBtn settingBtn1',
    )

    settingChanged('Bar') // 1 → 2 (last index, no wrap yet)
    expect((globalThis as any).autoTrimpSettings['Bar'].value).toBe(2)
    expect(document.getElementById('Bar')!.textContent).toBe('All')

    settingChanged('Bar') // 2 → 0 (wraps: 3 > length-1)
    expect((globalThis as any).autoTrimpSettings['Bar'].value).toBe(0)
    expect(document.getElementById('Bar')!.textContent).toBe('Off')
  })

  it('dropdown: reads the selected <option> back into btn.selected', () => {
    ;(globalThis as any).autoTrimpSettings['Drop'] = { id: 'Drop', type: 'dropdown', selected: 'a' }
    document.body.innerHTML =
      '<select id="Drop"><option value="a">a</option><option value="c" selected>c</option></select>'
    settingChanged('Drop')
    expect((globalThis as any).autoTrimpSettings['Drop'].selected).toBe('c')
  })

  it('dropdown "Prestige": also writes a PrestigeBackup entry with the selected value', () => {
    ;(globalThis as any).autoTrimpSettings['Prestige'] = {
      id: 'Prestige',
      type: 'dropdown',
      selected: 'Off',
    }
    document.body.innerHTML =
      '<select id="Prestige"><option value="Off">Off</option><option value="Copper" selected>Copper</option></select>'
    settingChanged('Prestige')
    expect((globalThis as any).autoTrimpSettings['PrestigeBackup']).toEqual({
      selected: 'Copper',
      name: 'PrestigeBackup',
      id: 'PrestigeBackup',
    })
  })

  it('always fires the downstream updateCustomButtons → saveSettings → checkPortalSettings trio', () => {
    ;(globalThis as any).autoTrimpSettings['Foo'] = { id: 'Foo', type: 'boolean', enabled: false }
    mountButton('Foo')
    settingChanged('Foo')
    expect(updateCustomButtons).toHaveBeenCalledOnce()
    expect(saveSettings).toHaveBeenCalledOnce()
    expect(checkPortalSettings).toHaveBeenCalledOnce()
  })
})

// ─── autoSetValue: the value-apply + label-formatting path (reached on Apply / Enter) ────────────
describe('settings-engine · autoSetValue (value-apply formatting)', () => {
  beforeEach(() => {
    ;(globalThis as any).saveSettings = vi.fn()
    ;(globalThis as any).checkPortalSettings = vi.fn()
    ;(globalThis as any).unlockTooltip = vi.fn()
    ;(globalThis as any).tooltip = vi.fn()
    // prettify is the game number-formatter — a recognizable stub proves the positive branch used it.
    ;(globalThis as any).prettify = (n: unknown) => `P(${n})`
    ;(globalThis as any).autoTrimpSettings = {}
  })

  // mounts the shared #customNumberBox input + the label div the formatting writes into.
  function mount(id: string, boxValue: string) {
    document.body.innerHTML = `<input id="customNumberBox" value="${boxValue}"><div id="${id}"></div>`
    ;(globalThis as any).autoTrimpSettings[id] = { id, type: 'value', value: 0 }
  }

  it('positive value: parses via parseNum and labels with prettify(num)', () => {
    mount('V', '2e5')
    autoSetValue('V', false, false)
    expect((globalThis as any).autoTrimpSettings['V'].value).toBe(200000)
    expect(document.getElementById('V')!.textContent!.endsWith('P(200000)')).toBe(true)
  })

  it('value -1 with negatives disallowed: renders the infinity icon span', () => {
    mount('V', '-1')
    autoSetValue('V', false, false)
    expect((globalThis as any).autoTrimpSettings['V'].value).toBe(-1)
    expect(document.getElementById('V')!.innerHTML).toContain('icon-infinity')
  })

  it('negative allowed: keeps the negative and labels via prettify (no infinity)', () => {
    mount('V', '-3')
    autoSetValue('V', true, false)
    expect((globalThis as any).autoTrimpSettings['V'].value).toBe(-3)
    expect(document.getElementById('V')!.textContent!.endsWith('P(-3)')).toBe(true)
  })

  it('multi: parses a comma list to an array and labels with "first+"', () => {
    mount('V', '5,10')
    autoSetValue('V', false, true)
    expect((globalThis as any).autoTrimpSettings['V'].value).toEqual([5, 10])
    expect(document.getElementById('V')!.textContent!.endsWith('5+')).toBe(true)
  })
})

// ─── createSetting: the per-type render path #39 changes ─────────────────────────────────────────
describe('settings-engine · createSetting (per-type stored shape)', () => {
  beforeEach(() => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).ATversion = 'test-version'
    ;(globalThis as any).game = { options: { menu: { darkTheme: { enabled: 0 } } } }
    document.body.innerHTML = '<div id="autoSettings"></div>'
  })

  it('boolean: stores {enabled: defaultValue||false} and a settingChanged onclick', () => {
    createSetting('B1', 'Toggle Me', 'desc', 'boolean', true, undefined, undefined)
    expect((globalThis as any).autoTrimpSettings['B1']).toMatchObject({
      id: 'B1',
      type: 'boolean',
      enabled: true,
    })
    const btn = document.getElementById('B1')!
    expect(btn.getAttribute('onclick')).toBe('settingChanged("B1")')
    expect(btn.getAttribute('class')).toBe('noselect settingsBtn settingBtntrue')
    expect(btn.textContent).toBe('Toggle Me')
  })

  it('value: stores {value: defaultValue} with the btn-info class', () => {
    createSetting('V1', 'Amount', 'desc', 'value', 42, undefined, undefined)
    expect((globalThis as any).autoTrimpSettings['V1']).toMatchObject({ type: 'value', value: 42 })
    expect(document.getElementById('V1')!.getAttribute('class')).toBe('noselect settingsBtn btn-info')
  })

  it('multitoggle: stores {value: defaultValue||0} and labels the button from name[value]', () => {
    createSetting('M1', ['Off', 'On'], 'desc', 'multitoggle', 1, undefined, undefined)
    expect((globalThis as any).autoTrimpSettings['M1']).toMatchObject({ type: 'multitoggle', value: 1 })
    expect(document.getElementById('M1')!.textContent).toBe('On')
    expect(document.getElementById('M1')!.getAttribute('class')).toBe(
      'noselect settingsBtn settingBtn1',
    )
  })

  it('dropdown: stores {selected, list} and builds an <option> per list entry', () => {
    createSetting('D1', 'Pick', 'desc', 'dropdown', 'b', ['a', 'b', 'c'], undefined)
    expect((globalThis as any).autoTrimpSettings['D1']).toMatchObject({
      type: 'dropdown',
      selected: 'b',
      list: ['a', 'b', 'c'],
    })
    const sel = document.getElementById('D1') as HTMLSelectElement
    expect(sel.tagName).toBe('SELECT')
    expect(sel.querySelectorAll('option')).toHaveLength(3)
    expect(sel.value).toBe('b')
  })

  it('action: fires raw defaultValue JS on click and creates NO stored setting (early return)', () => {
    createSetting('A1', 'Do It', 'desc', 'action', 'doThing()', undefined, undefined)
    expect((globalThis as any).autoTrimpSettings['A1']).toBeUndefined()
    expect(document.getElementById('A1')!.getAttribute('onclick')).toBe('doThing()')
  })

  it('infoclick: wires an ImportExportTooltip onclick and creates NO stored setting (early return)', () => {
    createSetting('I1', 'Info', 'desc', 'infoclick', 'payload', undefined, undefined)
    expect((globalThis as any).autoTrimpSettings['I1']).toBeUndefined()
    expect(document.getElementById('I1')!.getAttribute('onclick')).toBe(
      "ImportExportTooltip('payload', 'update')",
    )
  })

  it('stamps autoTrimpSettings.ATversion after a stateful control is created', () => {
    createSetting('B2', 'X', 'desc', 'boolean', false, undefined, undefined)
    expect((globalThis as any).autoTrimpSettings['ATversion']).toBe('test-version')
  })
})
