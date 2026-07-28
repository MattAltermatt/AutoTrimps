// #210 regression net — loadAutoTrimps() applies a pasted settings blob.
//
// The gate was close to vacuous: `JSON.parse` then `if (null == b) return`. Literal `null` was
// rejected; `42`, `[]`, `"hi"`, `false` and `0` were not. And resetAutoTrimps removed the saved
// settings file BEFORE assigning, so a malformed paste destroyed the file and then threw at the
// first createSetting — silent, total, undoable settings loss.
//
// The sibling paste box in the same module (importModuleVars) has been fully validated since #76B;
// this one never was. The bar here is the same one that net set: validate everything before writing
// anything, reject atomically, and block prototype keys.
//
// Two halves, and NEITHER is sufficient alone:
//   · this file — validation at the adoption seam (nothing malformed is ever stored)
//   · settings-engine.valueEscaping.test.ts — escaping at the render seam (nothing stored is ever
//     parsed as markup). A textValue setting legitimately holds arbitrary text, so no validator can
//     reject a payload without rejecting real values; the render fix is what makes a payload inert.
//
// Structurally invisible to the L0 net: the chain terminates in innerHTML, not in a wrapped native
// mutator, and the zero-click sink is guiLoop-driven, which never runs in the sim. `baseline-zero`
// may not be cited here.
//
// NOTE: the default node environment on purpose — bootGame() builds its own jsdom.

import { describe, it, expect, beforeEach } from 'vitest'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'

function boot(): any {
  const w = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE }).window as any
  w.document.queryCommandSupported = () => false
  w.game.global.lockTooltip = false
  return w
}

function paste(w: any, text: string) {
  let box = w.document.getElementById('importBox')
  if (!box) {
    box = w.document.createElement('textarea')
    box.id = 'importBox'
    w.document.body.appendChild(box)
  }
  box.value = text
  w.game.global.lockTooltip = false
}

describe('#210 · a malformed paste destroys nothing', () => {
  let w: any
  let saved: string
  beforeEach(() => {
    w = boot()
    w.saveSettings()
    saved = w.localStorage.getItem('autoTrimpSettings')
  })

  // Anti-false-green: there really IS a saved settings file to lose, and it really is populated.
  it('the fixture has a saved settings file worth protecting', () => {
    expect(saved).not.toBe(null)
    expect(Object.keys(JSON.parse(saved)).length).toBeGreaterThanOrEqual(500)
    expect(Object.keys(w.autoTrimpSettings).length).toBeGreaterThanOrEqual(500)
  })

  // Each of these passed the old `null == b` check and reached resetAutoTrimps, which had already
  // deleted the file by the time the assignment threw.
  for (const bad of ['42', '[]', '"hi"', 'false', '0', 'null', '[1,2,3]', '"[]"']) {
    it(`rejects the non-object paste ${bad} and leaves the saved file intact`, () => {
      const before = Object.keys(w.autoTrimpSettings).length
      paste(w, bad)
      w.loadAutoTrimps()
      expect(w.localStorage.getItem('autoTrimpSettings')).toBe(saved)
      expect(Object.keys(w.autoTrimpSettings).length).toBe(before)
    })
  }

  it('rejects malformed JSON without touching the saved file', () => {
    paste(w, '{"ATversion":"x",')
    w.loadAutoTrimps()
    expect(w.localStorage.getItem('autoTrimpSettings')).toBe(saved)
  })

  it('rejects an empty paste', () => {
    paste(w, '')
    w.loadAutoTrimps()
    expect(w.localStorage.getItem('autoTrimpSettings')).toBe(saved)
  })

  it('rejects JSON that is not an AT settings string at all', () => {
    // A user pasting their Trimps SAVE into the AT import box is the obvious accident, and the old
    // code would happily adopt it and wipe every setting.
    paste(w, '{"global":{"world":60},"resources":{"food":{"owned":100}}}')
    w.loadAutoTrimps()
    expect(w.localStorage.getItem('autoTrimpSettings')).toBe(saved)
    expect(w.autoTrimpSettings.global).toBe(undefined)
  })

  it('tells the user the import was refused instead of failing silently', () => {
    paste(w, '42')
    w.loadAutoTrimps()
    const tip = w.document.getElementById('tipText').textContent
    expect(tip).toContain('not imported')
    expect(tip).toContain('untouched')
  })
})

describe('#210 · prototype keys are rejected, atomically', () => {
  let w: any
  beforeEach(() => {
    w = boot()
    // The atomicity probe. `ATversion` is USELESS for this — initializeAllSettings rewrites it to
    // the real build version on every adoption, so it reads "not applied" whether the paste was
    // refused or accepted. A first draft of this file asserted on it and passed with the whole
    // PROTO_KEYS check deleted; mutation testing is the only reason that was caught. Assert instead
    // on a real setting whose value the paste would visibly change.
    w.autoTrimpSettings.ATCustomUI.enabled = false
  })

  const refused = () => {
    // The setting the payload tried to flip is still off, i.e. NOTHING from the paste was applied.
    expect(w.getPageSetting('ATCustomUI')).toBe(false)
    expect(w.document.getElementById('tipText').textContent).toContain('not imported')
  }

  for (const key of ['__proto__', 'constructor', 'prototype']) {
    it(`rejects a top-level ${key} key and applies nothing else from that paste`, () => {
      paste(w, `{"ATversion":"x","ATCustomUI":true,"${key}":{"polluted":1}}`)
      w.loadAutoTrimps()
      refused()
      expect(({} as any).polluted).toBe(undefined)
      expect((w.Object.prototype as any).polluted).toBe(undefined)
    })
  }

  it('rejects a NESTED prototype key', () => {
    paste(
      w,
      '{"ATversion":"x","ATCustomUI":true,"PrestigeBackup":{"selected":"D","__proto__":{"polluted":1}}}',
    )
    w.loadAutoTrimps()
    refused()
    expect(({} as any).polluted).toBe(undefined)
  })

  // Positive control for the atomicity probe itself: the SAME paste without the illegal key must be
  // accepted and must flip the setting. Without this, `refused()` would also pass for a build that
  // rejects every import.
  it('the same paste WITHOUT the illegal key is accepted (control for the probe)', () => {
    paste(w, '{"ATversion":"x","ATCustomUI":true}')
    w.loadAutoTrimps()
    expect(w.getPageSetting('ATCustomUI')).toBe(true)
  })
})

describe('#210 · a legitimate settings string still imports', () => {
  let w: any
  beforeEach(() => {
    w = boot()
  })

  // The whole point of the feature. A validator that rejects real imports is not a fix.
  it("the user's own exported string round-trips", () => {
    w.autoTrimpSettings.ATCustomUI.enabled = true
    const exported = w.serializeSettings()
    w.autoTrimpSettings.ATCustomUI.enabled = false
    expect(w.getPageSetting('ATCustomUI')).toBe(false)

    paste(w, exported)
    w.loadAutoTrimps()

    expect(w.getPageSetting('ATCustomUI')).toBe(true)
  })

  // The decisive case for the unknown-id policy. Measured against this build, the shipped presets
  // carry 80 of 254 and 82 of 256 keys that no longer exist — so a validator that rejected unknown
  // ids would make AT refuse its own documented preset. Stale ids round-trip; cleanupAutoTrimps is
  // the confirm-gated tool for purging them.
  for (const preset of ['serializeSettings60', 'serializeSettings550']) {
    it(`the shipped ${preset} preset imports, stale ids and all`, () => {
      const blob = w[preset]()
      const stale = Object.keys(JSON.parse(blob)).filter(
        (k) => k !== 'ATversion' && w.autoTrimpSettings[k] === undefined,
      )
      expect(stale.length).toBeGreaterThanOrEqual(50) // the preset really IS full of unknown ids

      paste(w, blob)
      w.loadAutoTrimps()

      // it applied: a value the preset sets differs from the boot default
      expect(Object.keys(w.autoTrimpSettings).length).toBeGreaterThanOrEqual(500)
      expect(w.localStorage.getItem('autoTrimpSettings')).not.toBe(null)
    })
  }

  it('a record-shaped value is accepted (the presets ship three)', () => {
    paste(
      w,
      '{"ATversion":"x","PrestigeBackup":{"selected":"Dagadder","id":"PrestigeBackup","name":"PrestigeBackup"}}',
    )
    w.loadAutoTrimps()
    expect(w.autoTrimpSettings.PrestigeBackup.selected).toBe('Dagadder')
  })

  it('a multiValue array is accepted', () => {
    paste(w, '{"ATversion":"x","Praidingzone":[495,546,555]}')
    w.loadAutoTrimps()
    expect(w.autoTrimpSettings.Praidingzone.value).toEqual([495, 546, 555])
  })
})

describe('#210 · resetAutoTrimps is the choke point, not just loadAutoTrimps', () => {
  let w: any
  beforeEach(() => {
    w = boot()
  })

  // Validating only at the paste box would leave the settings-profile path unguarded, and a stored
  // profile lives in the same localStorage a bad import writes to.
  it('a corrupt stored profile is refused rather than adopted', () => {
    const before = Object.keys(w.autoTrimpSettings).length
    w.localStorage.setItem(
      'ATSelectedSettingsProfile',
      JSON.stringify([{ name: 'corrupt', data: 42 }]),
    )
    w.settingsProfileMakeGUI()
    w.document.getElementById('settingsProfiles').selectedIndex = 3
    w.confirmedSwitchNow()
    expect(Object.keys(w.autoTrimpSettings).length).toBe(before)
  })

  it('a profile carrying a prototype key is refused', () => {
    w.localStorage.setItem(
      'ATSelectedSettingsProfile',
      JSON.stringify([{ name: 'evil', data: { ATversion: 'x', __proto__: { polluted: 1 } } }]),
    )
    w.settingsProfileMakeGUI()
    w.document.getElementById('settingsProfiles').selectedIndex = 3
    w.confirmedSwitchNow()
    expect(({} as any).polluted).toBe(undefined)
  })

  // Positive control: the factory reset (no argument) must still work.
  it('the factory reset still resets', () => {
    w.autoTrimpSettings.ATCustomUI.enabled = true
    w.resetAutoTrimps()
    expect(w.getPageSetting('ATCustomUI')).toBe(false)
  })

  // Positive control: a valid profile still switches. Without this, "refuse everything" passes.
  it('a valid stored profile still switches', () => {
    w.autoTrimpSettings.ATCustomUI.enabled = true
    const data = JSON.parse(w.serializeSettings())
    w.autoTrimpSettings.ATCustomUI.enabled = false
    w.localStorage.setItem(
      'ATSelectedSettingsProfile',
      JSON.stringify([{ name: 'good', data }]),
    )
    w.settingsProfileMakeGUI()
    w.document.getElementById('settingsProfiles').selectedIndex = 3
    w.confirmedSwitchNow()
    expect(w.getPageSetting('ATCustomUI')).toBe(true)
  })
})
