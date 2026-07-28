// Settings-profile regression net — #211 and #255. Both are data-loss bugs on a control that is
// built for EVERY user (settings-defs.ts:3010 calls settingsProfileMakeGUI() unconditionally), and
// both are structurally invisible to the L0 proof net: they terminate in localStorage and the DOM,
// never in one of the twelve wrapped native mutators, so `baseline-zero` is no evidence about them
// in either direction and may not be cited for this change.
//
//  #211  onDeleteProfile() mapped dropdown index → array index as `index - 3` with no lower bound.
//        The three leading <option>s are fixed commands, and the BOOT selection is index 0
//        ("Current", import-export.ts:62) — so the very first click of "<Delete Profile" computed
//        target = -3, and Array.prototype.splice counts a negative start FROM THE END. With five
//        saved profiles it destroyed the third one, permanently (safeSetItems overwrites the key in
//        the same call), while the confirm tooltip read "You are about to delete the Current
//        settings profile". #85 predicted this when #72 revived the GUI; the guard never landed.
//
//  #255  nameAndSaveNewProfile() persisted the RAW textarea value while confirmedSwitchNow() reads
//        the name back as `options[index].text`, which the HTML spec strips and collapses. One
//        trailing space therefore made a saved profile permanently unloadable — the Confirm button
//        did nothing, with no error, across reloads. Its `profname == null` empty-name guard could
//        never fire either (a textarea's .value is always a string, and '' == null is false).
//
// Instrument: the real AT bundle in jsdom on a real game boot, the same one tests/
// import-export.security.test.ts uses. Nothing here re-implements either function.

// NOTE: the default node environment on purpose — bootGame() builds its OWN jsdom around the real
// game plus the freshly-built bundle. Opting this file into the jsdom environment (the per-file
// docblock the other DOM suites use) makes boot.mjs's `new URL('.', import.meta.url)` throw
// "The URL must be of scheme file". Do not add one. Mentioning the pragma in a comment is enough to
// trigger it, which is how this note earned its careful wording.
import { describe, it, expect, beforeEach } from 'vitest'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'

const PROFILES = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']

function boot(stored: string[] = PROFILES): any {
  const { window } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE }) as any
  window.localStorage.setItem(
    'ATSelectedSettingsProfile',
    JSON.stringify(stored.map((name) => ({ name, data: {} }))),
  )
  // Rebuild the dropdown against the profiles just seeded. This is the same builder the boot path
  // runs (settings-defs.ts:3010) and it self-populates via initializeSettingsProfiles() since #72.
  window.settingsProfileMakeGUI()
  return window
}

const storedNames = (w: any): string[] =>
  JSON.parse(w.localStorage.getItem('ATSelectedSettingsProfile')).map((p: any) => p.name)

const dropdown = (w: any): HTMLSelectElement => w.document.getElementById('settingsProfiles')

const optionLabels = (w: any): string[] =>
  Array.from(dropdown(w).options).map((o: any) => o.text)

describe('#211 · onDeleteProfile must never splice a negative index', () => {
  let w: any
  beforeEach(() => {
    w = boot()
  })

  // Anti-false-green. Every assertion below is about a dropdown that really carries the three fixed
  // options followed by the five stored profiles; if the builder silently no-op'd (it early-returns
  // when the "Import Export" tab div is missing, :38) the deletes would trivially "not destroy"
  // anything and this whole file would pass while testing nothing.
  it('the fixture really builds the dropdown the bug needs', () => {
    expect(optionLabels(w)).toEqual(['Current', 'Reset to Default', 'Save New...', ...PROFILES])
    expect(dropdown(w).selectedIndex).toBe(0)
    expect(dropdown(w).options[0].id).toBe('customProfileCurrent')
    expect(storedNames(w)).toEqual(PROFILES)
  })

  it('deleting from the BOOT selection ("Current", index 0) destroys no stored profile', () => {
    expect(dropdown(w).selectedIndex).toBe(0)
    w.onDeleteProfile()
    // BEFORE: target = 0 - 3 = -3 → splice(-3, 1) → 'gamma' destroyed.
    expect(storedNames(w)).toEqual(PROFILES)
  })

  it('deleting from "Reset to Default" (index 1) destroys no stored profile', () => {
    dropdown(w).selectedIndex = 1 // where the factory-reset confirm parks the dropdown (:885)
    w.onDeleteProfile()
    // BEFORE: target = -2 → 'delta' destroyed.
    expect(storedNames(w)).toEqual(PROFILES)
  })

  it('deleting from "Save New..." (index 2) destroys no stored profile', () => {
    dropdown(w).selectedIndex = 2
    w.onDeleteProfile()
    // BEFORE: target = -1 → the LAST profile, 'epsilon', destroyed.
    expect(storedNames(w)).toEqual(PROFILES)
  })

  // The fixed options must also survive. `options.remove(index)` ran before the splice, so a delete
  // at index 0 permanently removed "Current" from the dropdown and put every later index off by one
  // for the rest of the page session — which is how the cascade in #211 destroyed a SECOND profile.
  it('a refused delete leaves the dropdown untouched, so later deletes stay aligned', () => {
    dropdown(w).selectedIndex = 0
    w.onDeleteProfile()
    expect(optionLabels(w)).toEqual(['Current', 'Reset to Default', 'Save New...', ...PROFILES])

    // and the next, legitimate delete still targets what the user selected
    dropdown(w).selectedIndex = 3
    expect(dropdown(w).value).toBe('alpha')
    w.onDeleteProfile()
    expect(storedNames(w)).toEqual(['beta', 'gamma', 'delta', 'epsilon'])
  })

  // Positive control: the feature still works. A net that only proves "nothing was deleted" is
  // satisfied by a function that deletes nothing at all.
  it('deleting a real profile removes THAT profile and no other', () => {
    dropdown(w).selectedIndex = 5
    expect(dropdown(w).value).toBe('gamma')
    w.onDeleteProfile()
    expect(storedNames(w)).toEqual(['alpha', 'beta', 'delta', 'epsilon'])
    expect(optionLabels(w)).toEqual([
      'Current', 'Reset to Default', 'Save New...', 'alpha', 'beta', 'delta', 'epsilon',
    ])
  })

  // Every subsequent delete must keep hitting the right row — the off-by-one cascade was the half of
  // #211 that destroyed profiles the user had already looked away from.
  it('repeated deletes stay aligned with the store', () => {
    for (const [pick, left] of [
      [3, ['beta', 'gamma', 'delta', 'epsilon']],
      [3, ['gamma', 'delta', 'epsilon']],
      [5, ['gamma', 'delta']],
    ] as [number, string[]][]) {
      dropdown(w).selectedIndex = pick
      w.onDeleteProfile()
      expect(storedNames(w)).toEqual(left)
    }
  })

  it('the confirmation tooltip is not even offered for a fixed option', () => {
    // ImportExportTooltip early-returns while game.global.lockTooltip is set, and a fresh boot is
    // still showing the game's own "Welcome to Trimps!" tooltip. Clear it, or this test asserts
    // about the welcome text and passes for the wrong reason.
    w.game.global.lockTooltip = false
    dropdown(w).selectedIndex = 0
    w.onDeleteProfileHandler()
    const title = w.document.getElementById('tipTitle').innerHTML
    // BEFORE: "<b>WARNING:</b> Delete Profile???" with body text naming "Current".
    expect(title).not.toContain('Delete Profile')
    expect(w.document.getElementById('tipText').textContent).toContain('nothing to delete')
  })
})

describe('#255 · a saved profile name must round-trip through the dropdown', () => {
  let w: any
  beforeEach(() => {
    w = boot([])
  })

  function nameNewProfile(name: string) {
    let box = w.document.getElementById('setSettingsNameTooltip')
    if (!box) {
      box = w.document.createElement('textarea')
      box.id = 'setSettingsNameTooltip'
      w.document.body.appendChild(box)
    }
    box.value = name
    w.nameAndSaveNewProfile()
  }

  // The exact shape that cost a user their profile: "Zone 60 " is stored raw, the <option> reports
  // "Zone 60", the by-name filter returns nothing and Confirm silently does nothing, forever.
  it('a name with a trailing space is stored as the dropdown reports it', () => {
    nameNewProfile('Zone 60 ')
    expect(storedNames(w)).toEqual(['Zone 60'])
    const opt = dropdown(w).options[dropdown(w).options.length - 1]
    expect(opt.text).toBe(storedNames(w)[0]) // the two sides are ONE string
  })

  it('leading, trailing and doubled internal whitespace all collapse the same way', () => {
    nameNewProfile('  Deep   Void \t Farm  ')
    expect(storedNames(w)).toEqual(['Deep Void Farm'])
    expect(dropdown(w).options[3].text).toBe('Deep Void Farm')
  })

  // The end-to-end claim: a profile saved with awkward whitespace can actually be LOADED again.
  // confirmedSwitchNow calls resetAutoTrimps internally, which cannot be spied by reassigning the
  // global (#127/#129) — so assert on state: resetAutoTrimps writes the profile's data into
  // autoTrimpSettings and removes the saved settings key.
  it('a whitespace-carrying profile can be switched into', () => {
    // ATCustomUI is a real declared boolean (settings-defs.ts, default false), so the round trip
    // exercises the actual serialize → store → createSetting rehydration path rather than a key the
    // rebuild would drop.
    w.autoTrimpSettings.ATCustomUI.enabled = true
    nameNewProfile('Zone 60 ')
    w.autoTrimpSettings.ATCustomUI.enabled = false
    expect(w.getPageSetting('ATCustomUI')).toBe(false)

    dropdown(w).selectedIndex = 3
    expect(dropdown(w).value).toBe('Zone 60')
    w.confirmedSwitchNow()

    // BEFORE: the filter matched nothing, :103 had no else, and NOTHING happened.
    expect(w.getPageSetting('ATCustomUI')).toBe(true)
  })

  it('an empty name is rejected — no blank row, nothing stored', () => {
    nameNewProfile('')
    // BEFORE: `'' == null` is false, so the guard was dead and '' was saved.
    expect(storedNames(w)).toEqual([])
    expect(optionLabels(w)).toEqual(['Current', 'Reset to Default', 'Save New...'])
  })

  it('a whitespace-only name is rejected', () => {
    nameNewProfile('   \t \n ')
    expect(storedNames(w)).toEqual([])
    expect(optionLabels(w)).toEqual(['Current', 'Reset to Default', 'Save New...'])
  })

  it('a duplicate name is rejected — the by-name lookup must stay a function of the selection', () => {
    nameNewProfile('Speedrun')
    nameNewProfile('Speedrun')
    expect(storedNames(w)).toEqual(['Speedrun'])
    expect(optionLabels(w)).toEqual(['Current', 'Reset to Default', 'Save New...', 'Speedrun'])
  })

  it('a name that only DIFFERS by whitespace is a duplicate too', () => {
    nameNewProfile('Speedrun')
    nameNewProfile('  Speedrun  ')
    expect(storedNames(w)).toEqual(['Speedrun'])
  })

  // Positive control: ordinary names still save, and two distinct names both survive.
  it('two distinct names both save and both appear in the dropdown', () => {
    nameNewProfile('Speedrun')
    nameNewProfile('Deep Farm')
    expect(storedNames(w)).toEqual(['Speedrun', 'Deep Farm'])
    expect(optionLabels(w)).toEqual([
      'Current', 'Reset to Default', 'Save New...', 'Speedrun', 'Deep Farm',
    ])
  })
})
