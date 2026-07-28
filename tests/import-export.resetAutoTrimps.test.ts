// resetAutoTrimps regression net — #243 and #241. Both are invisible to the L0 proof net:
// resetAutoTrimps is reached only from inline onclick strings (the sim never clicks) and nothing
// here terminates in one of the twelve wrapped native mutators. `baseline-zero` is not evidence
// about this file in either direction.
//
//  #243  `setTimeout((function(d){ …body… } as any)(a), 101)` invoked the closure immediately and
//        handed setTimeout its `undefined` return — the #71a shape, still live in the twin. The fix
//        is NOT the #71a fix: a real defer regresses the factory-reset dropdown (the onclick tail
//        `settingsProfiles.selectedIndex = 1` would land on the select the deferred rebuild is about
//        to replace). The timer was dropped and the synchronous order kept, so what this net pins is
//        (a) no stray timer is scheduled and (b) the body really did run by the time the call returns.
//
//  #241  the body called initializeSettingsProfiles() directly, but initializeAllSettings() already
//        ends in settingsProfileMakeGUI() → initializeSettingsProfiles() (since #72). Every import,
//        profile switch and factory reset therefore appended every saved profile a SECOND time.
//
// NOTE: the default node environment on purpose — bootGame() builds its own jsdom.

import { describe, it, expect, beforeEach } from 'vitest'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'

const PROFILES = ['alpha', 'beta', 'gamma']

function boot(): any {
  const { window } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE }) as any
  window.localStorage.setItem(
    'ATSelectedSettingsProfile',
    JSON.stringify(PROFILES.map((name) => ({ name, data: {} }))),
  )
  window.settingsProfileMakeGUI()
  return window
}

const optionLabels = (w: any): string[] =>
  Array.from((w.document.getElementById('settingsProfiles') as HTMLSelectElement).options).map(
    (o: any) => o.text,
  )

describe('#241 · a settings rebuild populates the profile dropdown exactly once', () => {
  let w: any
  beforeEach(() => {
    w = boot()
  })

  // Anti-false-green: the dropdown really is built and really does carry the three saved profiles,
  // so "no duplicates" below is a claim about a populated list rather than an empty one.
  it('the boot state is three fixed options plus each saved profile once', () => {
    expect(optionLabels(w)).toEqual(['Current', 'Reset to Default', 'Save New...', ...PROFILES])
  })

  it('a factory reset does not duplicate the saved profiles', () => {
    w.resetAutoTrimps()
    // BEFORE: ['Current','Reset to Default','Save New...','alpha','beta','gamma',
    //          'alpha','beta','gamma']
    expect(optionLabels(w)).toEqual(['Current', 'Reset to Default', 'Save New...', ...PROFILES])
  })

  it('an imported settings blob does not duplicate the saved profiles', () => {
    w.resetAutoTrimps(JSON.parse(w.serializeSettings()), 'alpha')
    expect(optionLabels(w)).toEqual(['Current', 'Reset to Default', 'Save New...', ...PROFILES])
  })

  it('repeated resets do not accumulate', () => {
    w.resetAutoTrimps()
    w.resetAutoTrimps()
    w.resetAutoTrimps()
    expect(optionLabels(w)).toEqual(['Current', 'Reset to Default', 'Save New...', ...PROFILES])
  })

  // The population must still HAPPEN. A net that only forbids duplicates is satisfied by deleting
  // both calls, which would leave a user's profiles invisible after every import.
  it('the profiles are still listed after a reset (positive control)', () => {
    w.resetAutoTrimps()
    for (const name of PROFILES) expect(optionLabels(w)).toContain(name)
  })
})

describe('#243 · resetAutoTrimps schedules no timer and completes before it returns', () => {
  let w: any
  let scheduled: any[]
  beforeEach(() => {
    w = boot()
    scheduled = []
    const realSetTimeout = w.setTimeout
    w.setTimeout = (handler: any, delay: any) => {
      scheduled.push({ handler, delay })
      return realSetTimeout(handler, delay)
    }
  })

  it('no setTimeout is scheduled at all — least of all one with a non-callable handler', () => {
    w.resetAutoTrimps()
    // BEFORE: exactly one entry, `{ handler: undefined, delay: 101 }` — the closure's return value.
    // Per the HTML spec a non-callable TimerHandler is stringified and compiled as a classic script.
    expect(scheduled.map((s) => s.delay)).toEqual([])
    expect(scheduled.every((s) => typeof s.handler === 'function')).toBe(true)
  })

  // The body ran, and it ran BEFORE the call returned. Asserting the timer is gone is only half the
  // claim — the other half is that dropping it did not defer or drop the work.
  it('the settings DOM is already rebuilt when the call returns', () => {
    const before = w.document.getElementById('autoSettings')
    expect(before).not.toBe(null)
    w.resetAutoTrimps()
    const after = w.document.getElementById('autoSettings')
    expect(after).not.toBe(null)
    expect(after).not.toBe(before) // torn down and rebuilt, synchronously
  })

  it('the ATrunning latch is closed again by the time the call returns', () => {
    w.ATrunning = true
    w.resetAutoTrimps()
    expect(w.ATrunning).toBe(true)
  })
})
