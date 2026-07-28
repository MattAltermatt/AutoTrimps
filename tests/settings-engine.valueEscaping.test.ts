// #235/#210 — a persisted setting value is UNTRUSTED TEXT, and it must never be parsed as markup.
//
// Importing another player's settings string is the documented feature (utils.ts ships two
// third-party preset blobs), the userscript runs `@grant none` in page context, and the game page
// carries no CSP — so a stored value can carry an attacker's payload and reach the DOM with full
// same-origin privilege. Three sinks spliced one into an HTML string:
//
//   settings-visibility.ts  `elem.innerHTML = item.name + ': ' + item.value[0] + '+'`
//                           ZERO-CLICK: updateCustomButtons runs synchronously from resetAutoTrimps
//                           and then every second from guiLoop, so the payload fired on the import
//                           itself. The `== -1` infinity guard never shielded it.
//   settings-engine.ts      `value="${autoTrimpSettings[id].value}"` in both input tooltips.
//                           `" onfocus="…` attached a handler that the function's own box.focus()
//                           fired. And the boring, commoner half: a plain `"` in a heirloom name
//                           truncated the box, and Apply wrote the truncation back — silent data
//                           loss, up to total erasure when the value STARTED with a quote.
//   import-export.ts        the export textarea and the profile-name tooltips.
//
// This file is the net for the CLASS, not for three lines: it plants a payload in EVERY
// value / valueNegative / multiValue / textValue control the build declares and asserts (a) nothing
// is ever injected and (b) the value round-trips byte-identically. A fix that escapes two lines and
// leaves the next one open fails here.
//
// The L0 proof net cannot see any of this — the chain terminates in innerHTML, not in one of the
// twelve wrapped native mutators, and the zero-click sink is driven by guiLoop, which never runs in
// the sim (setInterval is stubbed dead in boot.mjs). `baseline-zero` may not be cited for this file.
//
// NOTE: the default node environment on purpose — bootGame() builds its own jsdom.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'

// Breaks out of a double-quoted HTML attribute AND out of a text node, and announces itself twice:
// as a live handler (`onerror`) and as an element that simply should not exist (`img`).
const PAYLOAD = '"><img src=x onerror="globalThis.__PWNED__ = 1">'
// The quieter half of #235 — no injection, just a quote and an entity. Both used to be mangled.
const QUOTED = 'Frozen "Ice" Shield'
const ENTITY = 'Rock &amp; Roll'

const VALUE_TYPES = ['value', 'valueNegative', 'multiValue', 'textValue']

let w: any
let ids: Record<string, string[]>

beforeAll(() => {
  w = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE }).window
  ids = {}
  for (const t of VALUE_TYPES) ids[t] = []
  for (const key of Object.keys(w.autoTrimpSettings)) {
    const rec = w.autoTrimpSettings[key]
    if (rec && VALUE_TYPES.includes(rec.type)) ids[rec.type].push(key)
  }
})

const injected = (root: any): any =>
  root && (root.querySelector('img, iframe, script, object, embed, svg') as any)

describe('#235 · the corpus this net runs over is real', () => {
  // Anti-false-green, and the reason this is the FIRST test in the file: every assertion below is a
  // loop over `ids`. An empty or near-empty corpus makes the whole suite pass while proving nothing,
  // which is exactly the failure mode #67 was about. The counts come from the finding's own grep.
  it('every value-bearing control type is present in the expected numbers', () => {
    expect(ids.value.length).toBeGreaterThanOrEqual(200)
    expect(ids.multiValue.length).toBeGreaterThanOrEqual(60)
    expect(ids.textValue.length).toBeGreaterThanOrEqual(28)
    expect(ids.valueNegative.length).toBeGreaterThanOrEqual(4)
    const total = VALUE_TYPES.reduce((n, t) => n + ids[t].length, 0)
    expect(total).toBeGreaterThanOrEqual(300)
  })

  it('the settings DOM those controls render into really exists', () => {
    const mounted = ids.value.filter((id) => w.document.getElementById(id) != null)
    expect(mounted.length).toBeGreaterThanOrEqual(200)
  })
})

describe('#235 · ZERO-CLICK — updateCustomButtons never renders a stored value as markup', () => {
  it('a payload in every multiValue control injects nothing and executes nothing', () => {
    delete w.__PWNED__
    for (const id of ids.multiValue) w.autoTrimpSettings[id].value = [PAYLOAD]

    w.updateCustomButtons()

    expect(w.__PWNED__).toBe(undefined)
    let rendered = 0
    const renderedIds: string[] = []
    for (const id of ids.multiValue) {
      const el = w.document.getElementById(id)
      if (el == null) continue
      expect(injected(el)).toBe(null)
      // The payload must survive AS TEXT where the control was actually repainted — a fix that
      // blanked the label would also pass "nothing was injected".
      if (el.textContent.includes("<img")) { rendered++; renderedIds.push(id) }
    }
    // …and the sink must genuinely have been REACHED. updateCustomButtons skips any control whose
    // parent is display:none, so most multiValue ids do not repaint on a default view; without a
    // positive count here the test would pass because the loop touched nothing.
    //
    // Exactly two repaint on a default boot, and `Praidingzone` is the one the whole ZERO-CLICK
    // severity argument rests on: it is turnOn'd when radonsettings == 0, which is its declared
    // default, so a payload reaches innerHTML for a user who has changed no setting at all. Pinning
    // it BY NAME is deliberate — if a defaults change ever hides it, the zero-click reach has moved
    // and this net should say so rather than quietly measure something else.
    expect(rendered).toBe(2)
    expect(renderedIds).toContain('Praidingzone')
    // nothing leaked into the wider settings panel
    expect(injected(w.document.getElementById('autoSettings'))).toBe(null)
  })

  it('the infinity glyph still renders for the -1 sentinel (positive control)', () => {
    const id = ids.multiValue[0]
    w.autoTrimpSettings[id].value = [-1]
    w.updateCustomButtons()
    const el = w.document.getElementById(id)
    // This branch legitimately needs an element. It must be a real <span>, built as a node.
    expect(el.querySelector('span.icon-infinity')).not.toBe(null)
    expect(el.textContent).toContain(w.autoTrimpSettings[id].name)
  })

  it('a payload in every textValue control injects nothing', () => {
    delete w.__PWNED__
    for (const id of ids.textValue) w.autoTrimpSettings[id].value = PAYLOAD
    w.updateCustomButtons()
    expect(w.__PWNED__).toBe(undefined)
    for (const id of ids.textValue) {
      const el = w.document.getElementById(id)
      if (el != null) expect(injected(el)).toBe(null)
    }
  })
})

describe('#235 · ONE-CLICK — the input tooltips parse no stored value as markup', () => {
  function openNumberBox(id: string) {
    w.game.global.lockTooltip = false
    w.autoSetValueToolTip(id, 'net', false, false)
    return w.document.getElementById('customNumberBox')
  }
  function openTextBox(id: string) {
    w.game.global.lockTooltip = false
    w.autoSetTextToolTip(id, 'net')
    return w.document.getElementById('customTextBox')
  }

  it('every numeric-box control (value / valueNegative / multiValue) is safe and lossless', () => {
    delete w.__PWNED__
    for (const t of ['value', 'valueNegative', 'multiValue']) {
      for (const id of ids[t]) {
        w.autoTrimpSettings[id].value = PAYLOAD
        const box = openNumberBox(id)
        expect(injected(w.document.getElementById('tipText'))).toBe(null)
        // byte-identical: the box shows what is stored, so Apply cannot write back a truncation
        expect(box.value).toBe(PAYLOAD)
      }
    }
    expect(w.__PWNED__).toBe(undefined)
  })

  it('every textValue control is safe and lossless', () => {
    delete w.__PWNED__
    for (const id of ids.textValue) {
      w.autoTrimpSettings[id].value = PAYLOAD
      const box = openTextBox(id)
      expect(injected(w.document.getElementById('tipText'))).toBe(null)
      expect(box.value).toBe(PAYLOAD)
    }
    expect(w.__PWNED__).toBe(undefined)
  })

  // The quiet half, and the one a real user actually hits. No attacker anywhere in this test.
  it('a quoted value round-trips instead of being truncated', () => {
    const id = ids.textValue[0]
    w.autoTrimpSettings[id].value = QUOTED
    expect(openTextBox(id).value).toBe(QUOTED) // BEFORE: 'Frozen '
  })

  it('a value that STARTS with a quote is not erased', () => {
    const id = ids.textValue[0]
    w.autoTrimpSettings[id].value = '"Big Boy"'
    expect(openTextBox(id).value).toBe('"Big Boy"') // BEFORE: '' — all nine characters gone
  })

  it('a literal entity sequence is not silently decoded', () => {
    // The game htmlEncodes heirloom names and heirlooms.ts matches with exact string equality, so a
    // decoded `&amp;` -> `&` breaks the swap. The attribute parser used to decode it.
    const id = ids.textValue[0]
    w.autoTrimpSettings[id].value = ENTITY
    expect(openTextBox(id).value).toBe(ENTITY) // BEFORE: 'Rock & Roll'
  })

  // Positive control: the tooltip is really being built, so "no injection" is a claim about a
  // rendered tooltip rather than about an empty div.
  it('the tooltip really renders its input and its Apply button', () => {
    const id = ids.textValue[0]
    w.autoTrimpSettings[id].value = 'Gardens'
    const box = openTextBox(id)
    expect(box).not.toBe(null)
    expect(box.value).toBe('Gardens')
    expect(w.document.getElementById('tipCost').textContent).toContain('Apply')
  })
})

// The behavioural tests above prove the three KNOWN sinks are shut. This one forbids a fourth: it
// is the difference between fixing three lines and closing the class. Both renderers below have a
// flat, checkable rule — the every-tick repaint loop builds text and nodes, never markup, and the
// two input tooltips carry no value= attribute for a stored value to be spliced into.
describe('#235 · the render paths structurally cannot splice a stored value into markup', () => {
  // Comments are stripped first, so the prose in the very files under test (which necessarily quotes
  // the old buggy lines to explain them) cannot satisfy or trip the scan. Derived from source on
  // every run — nothing here restates a count that could drift.
  const sourceOf = (mod: string): string =>
    readFileSync(resolve(__dirname, '../src/modules', mod), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')

  it('settings-visibility assigns innerHTML nowhere — the zero-click sink cannot come back', () => {
    const hits = sourceOf('settings-visibility.ts')
      .split('\n')
      .filter((l) => /\.innerHTML\s*=/.test(l))
    expect(hits).toEqual([])
  })

  it('neither input tooltip emits a value= attribute for the stored value', () => {
    const src = sourceOf('settings-engine.ts')
    // The template literals that build #customNumberBox / #customTextBox must carry no value=.
    const inputs = src.split('\n').filter((l) => /<input id="custom(Number|Text)Box"/.test(l))
    expect(inputs.length).toBe(2) // anti-false-green: the lines this rule is about still exist
    for (const line of inputs) expect(line).not.toMatch(/value=/)
  })

  it('the stored value is instead assigned as a DOM property (positive control)', () => {
    const src = sourceOf('settings-engine.ts')
    expect(src).toContain('box.value = autoTrimpSettings[id].value')
    expect(src.split('box.value = autoTrimpSettings[id].value').length - 1).toBe(2)
  })
})

// Found by the branch's own code review, AFTER the three sinks above were already fixed and netted.
// MAZ.ts is a FOURTH sink of the same class and the largest: twenty-nine splices of
// `autoTrimpSettings[…].value[x]` into markup that reaches innerHTML, across the fourteen preset
// editors. It is also the one that proves escaping would have been the wrong fix — every attribute
// in that builder is SINGLE-quoted, and escapeHtml() does not escape `'`, so the obvious patch
// would have left it wide open. Removing the splice is what actually closes it.
//
// Reached exactly like #210: a multiValue element is legitimately a string, so no import validator
// can reject the payload; one click on the preset's `*maz` button used to run it.
describe('#235 · the MAZ preset editors parse no stored value as markup', () => {
  // titleText → the `zone` setting MAZLookalike reads. The TITLES are derived from the wiring in
  // settings-defs.ts rather than retyped, so adding a fifteenth preset reddens this file instead of
  // silently leaving it uncovered — a hand-copied list is exactly the drift #235's sibling findings
  // were made of.
  const mazTitles = (): string[] => {
    const defs = readFileSync(resolve(__dirname, '../src/modules/settings-defs.ts'), 'utf8')
    return [...defs.matchAll(/MAZLookalike\("([^"]+)"/g)].map((m) => m[1])
  }
  const ZONE_OF: Record<string, string> = {
    'Time Farm': 'Rtimefarmzone',
    'dTime Farm': 'Rdtimefarmzone',
    'Smithy Farm': 'Rsmithyfarmzone',
    'Tribute Farm': 'Rtributefarmzone',
    'Shrine - U1': 'Hshrinezone',
    'Shrine - U1 (Daily)': 'Hdshrinezone',
    'Shrine - U2': 'Rshrinezone',
    'Shrine - U2 (Daily)': 'Rdshrinezone',
    Quagmire: 'Rblackbogzone',
    Insanity: 'Rinsanityfarmzone',
    Alch: 'Ralchfarmzone',
    Hypo: 'Rhypofarmzone',
    Praid: 'RAMPraidzone',
    dPraid: 'RdAMPraidzone',
  }
  const PRESETS: [string, string][] = mazTitles().map((t) => [t, ZONE_OF[t]])

  const openPreset = (title: string) => {
    w.game.global.lockTooltip = false
    w.MAZLookalike(title)
    return w.document.getElementById('tipText')
  }

  it('the preset dispatch table this net iterates is real and complete', () => {
    // Anti-false-green: if a title stopped resolving, MAZLookalike would render an empty grid and
    // every "no injection" assertion below would pass vacuously.
    expect(PRESETS.length).toBe(14)
    for (const [title, zoneId] of PRESETS) {
      expect(zoneId, `no zone setting mapped for MAZ preset "${title}"`).toBeDefined()
      expect(w.autoTrimpSettings[zoneId], `unknown setting id ${zoneId}`).toBeDefined()
    }
    const tip = openPreset('Praid')
    expect(tip.querySelectorAll('input').length).toBeGreaterThan(0)
  })

  it('a payload in any preset row injects nothing and executes nothing', () => {
    delete w.__PWNED__
    // Single-quote-first, because that is the shape escapeHtml() would have let through.
    const SQ = "' onfocus='globalThis.__PWNED__ = 1' x='"
    for (const [title, zoneId] of PRESETS) {
      w.autoTrimpSettings[zoneId].value = [SQ, PAYLOAD]
      const tip = openPreset(title)
      expect(injected(tip)).toBe(null)
      expect(tip.querySelector('[onfocus]')).toBe(null)
    }
    expect(w.__PWNED__).toBe(undefined)
  })

  it('the values still REACH the inputs — the fix must not blank the editor', () => {
    // The positive control, and the one that matters: a "fix" that stops rendering the user's saved
    // preset would also pass every assertion above.
    const [, zoneId] = PRESETS.find(([t]) => t === 'Praid')!
    w.autoTrimpSettings[zoneId].value = [123, 456]
    openPreset('Praid')
    expect(w.document.getElementById('windowZone0').value).toBe('123')
    expect(w.document.getElementById('windowZone1').value).toBe('456')
  })

  it('a hostile value lands as an empty number field, never as markup', () => {
    // These rows are `type='number'`, so the browser sanitises a non-numeric assignment to ''. That
    // is the correct outcome and worth pinning: the payload reaches the DOM as a REJECTED VALUE on
    // an input rather than as parsed markup. Contrast the textValue box in settings-engine, which
    // must preserve arbitrary text byte-for-byte — asserted separately above.
    const [, zoneId] = PRESETS.find(([t]) => t === 'Praid')!
    w.autoTrimpSettings[zoneId].value = ["' onfocus='globalThis.__PWNED__ = 1' x='", 7]
    openPreset('Praid')
    expect(w.document.getElementById('windowZone0').value).toBe('')
    expect(w.document.getElementById('windowZone0').getAttribute('onfocus')).toBe(null)
    expect(w.document.getElementById('windowZone1').value).toBe('7')
  })

  it('MAZ.ts splices no stored value into markup at all (static rule)', () => {
    const src = readFileSync(resolve(__dirname, '../src/modules/MAZ.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
    expect(src.match(/value='" \+ vals\./g)).toBe(null)
    expect(src).toContain('setRowFieldValue')
  })
})

describe('#235 · the export and profile tooltips escape what they splice', () => {
  it('a payload stored in a setting cannot break out of the export textarea', () => {
    delete w.__PWNED__
    const id = ids.textValue[0]
    w.autoTrimpSettings[id].value = '</textarea><img src=x onerror="globalThis.__PWNED__ = 1">'
    // jsdom implements neither of the clipboard commands the branch feature-detects.
    w.document.queryCommandSupported = () => false
    w.game.global.lockTooltip = false
    w.ImportExportTooltip('ExportAutoTrimps')
    const tip = w.document.getElementById('tipText')
    expect(injected(tip)).toBe(null)
    expect(w.__PWNED__).toBe(undefined)
    // and the exported string is still the real, complete one — escaping must not corrupt the export
    expect(w.document.getElementById('exportArea').value).toBe(w.serializeSettings())
  })

  it('a profile name cannot inject through the delete-confirmation tooltip', () => {
    delete w.__PWNED__
    w.localStorage.setItem(
      'ATSelectedSettingsProfile',
      JSON.stringify([{ name: '<img src=x onerror="globalThis.__PWNED__ = 1">', data: {} }]),
    )
    w.settingsProfileMakeGUI()
    w.document.getElementById('settingsProfiles').selectedIndex = 3
    w.game.global.lockTooltip = false
    w.onDeleteProfileHandler()
    expect(injected(w.document.getElementById('tipText'))).toBe(null)
    expect(w.__PWNED__).toBe(undefined)
  })

  it('a profile name cannot inject through the generic message tooltip', () => {
    delete w.__PWNED__
    w.game.global.lockTooltip = false
    w.ImportExportTooltip('message', 'Loaded: <img src=x onerror="globalThis.__PWNED__ = 1">')
    expect(injected(w.document.getElementById('tipText'))).toBe(null)
    expect(w.__PWNED__).toBe(undefined)
    expect(w.document.getElementById('tipText').textContent).toContain('Loaded:')
  })
})
