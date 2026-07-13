import { describe, it, expect } from 'vitest'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { TEST_BUNDLE } from './bundle'

// #105 — the atSettings seam.
//
// THE GAP IT CLOSES. Every proof-net trace ever recorded was of a bot running FACTORY-DEFAULT settings.
// AT seeds `autoTrimpSettings` in loadPageVariables() by reading localStorage, and jsdom's localStorage is
// empty, so `bootSettingsUI()` handed every setting its createSetting default and nothing could ever change
// one. That is a structural blind spot, not a gap in the corpus: most of AT's behaviour is settings-gated,
// so any feature behind a non-default setting was untestable by L0 BY CONSTRUCTION — no save, however deep,
// could reach it.
//
// The two fixtures that need it (Hypothermia, deep-housing) are U2-only and are deferred with #105. The
// seam ships now because it is universe-agnostic and cheap, and because a settings-gated U1 fixture is
// exactly what verifying #106 (the scientist-ratio report) will want.

describe('#105: bootGame({ atSettings }) — the net can finally run a NON-default bot', () => {
  it('seeds a setting, and getPageSetting reads back the seeded value', () => {
    // MaxScientists is a plain `value` setting whose default is -1. Drive it to a real cap and prove the
    // read-back goes through AT's own getPageSetting (not just the raw object), so the per-type field
    // mapping (enabled / value / selected) is exercised end to end.
    const { window } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE })
    expect(window.getPageSetting('MaxScientists')).toBe(-1) // the createSetting default

    const seeded = bootGame({
      withAutoTrimps: true, atBundlePath: TEST_BUNDLE,
      atSettings: { MaxScientists: '250' },
    })
    expect(seeded.window.getPageSetting('MaxScientists')).toBe(250)
  })

  it('seeds every setting TYPE the harness will need (boolean / multiValue / multitoggle)', () => {
    // getPageSetting dispatches on `type` and reads a DIFFERENT field for each (enabled / value / selected),
    // so a seam that only handled `value` would silently no-op on booleans and dropdowns — and a fixture
    // built on it would "enable" a feature that stayed off, then report a green as proof.
    const { window } = bootGame({
      withAutoTrimps: true, atBundlePath: TEST_BUNDLE,
      atSettings: {
        Rhypostorage: true,      // boolean  → .enabled
        Rhypofarmstack: [5],     // multiValue → .value, read back through Array.from().map(parseInt)
        AutoStance: 3,           // multitoggle → .value, read back through parseInt
      },
    })
    expect(window.getPageSetting('Rhypostorage')).toBe(true)
    expect(window.getPageSetting('Rhypofarmstack')).toEqual([5])
    expect(window.getPageSetting('AutoStance')).toBe(3)
  })

  it('ANTI-PHANTOM: seeding an id production never createSetting-s THROWS', () => {
    // The failure this guard exists to prevent, and it is the #58/#68 phantom-setting class aimed at the
    // net itself. setPageSetting returns false for an unknown id — so a typo would seed NOTHING, silently.
    // The fixture would then "cover" a feature it never actually enabled, the differential would be green,
    // and that green would be cited as proof. Make it loud instead.
    expect(() => bootGame({
      withAutoTrimps: true, atBundlePath: TEST_BUNDLE,
      atSettings: { Rhypofarmstck: [5] }, // note the typo
    })).toThrow(/never createSetting/)
  })

  it('omitting atSettings leaves every default untouched (the existing corpus is unaffected)', () => {
    // The 8 committed fixtures pass no settings, so their traces MUST be byte-identical to before this
    // seam existed. Pin that the hook is inert when unused — additive, not a re-pin.
    const { window } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE })
    expect(window.getPageSetting('MaxScientists')).toBe(-1)
    expect(window.getPageSetting('Rhypofarmstack')).toEqual([-1]) // the "unset" sentinel (#96)
  })
})
