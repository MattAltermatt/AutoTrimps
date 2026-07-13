// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { settingChanged } from '../src/modules/settings-engine'

// #83 §7 — the magmite auto-spend safety debounce was keyed on a setting id that does not exist.
//
//     if (id == 'AutoMagmiteSpender2' && btn.value == 1) {   // <- no such createSetting, anywhere
//         magmiteSpenderChanged = true;
//         setTimeout(() => { magmiteSpenderChanged = false }, 5000);
//     }
//
// The live control is `spendmagmite` (settings-defs.ts:740 — a multitoggle:
// ['Spend Magmite OFF', 'Spend Magmite (Portal)', 'Spend Magmite Always']). `AutoMagmiteSpender2`
// appears ONLY in the two frozen legacy default-settings JSON blobs (utils.ts:51/54) and in this dead
// comparison — there is no createSetting for it in src/ or legacy/. And settingChanged is only ever
// invoked as `settingChanged("<id>")` from a createSetting'd button, so id can only ever be a live id.
//
// magmiteSpenderChanged is written in exactly one place — that dead branch — so it was `false`
// forever, leaving the consumer unguarded:
//
//     // legacy/AutoTrimps2.js:200
//     if (getPageSetting('spendmagmite') == 2 && !magmiteSpenderChanged) autoMagmiteSpender();
//
// A player CYCLING PAST "Spend Magmite Always" (index 2) on the way back to OFF had their entire
// magmite bank dumped on the very next tick. The 5-second grace window never existed.

const g = () => globalThis as any

/** The real control, exactly as settings-defs.ts:740 creates it. */
function mountSpendMagmite(value: number) {
  const el = document.createElement('div')
  el.setAttribute('id', 'spendmagmite')
  document.body.appendChild(el)
  g().autoTrimpSettings = {
    spendmagmite: {
      id: 'spendmagmite',
      type: 'multitoggle',
      name: ['Spend Magmite OFF', 'Spend Magmite (Portal)', 'Spend Magmite Always'],
      value,
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = ''
  g().magmiteSpenderChanged = false
  g().renderControlFace = () => {}
  g().updateCustomButtons = () => {}
  g().saveSettings = () => {}
  g().debug = () => {}
  g().checkPortalSettings = () => {}
})

afterEach(() => vi.useRealTimers())

describe('#83 §7: the Spend Magmite debounce arms on the real setting', () => {
  it('cycling the spendmagmite control INTO "Spend Magmite Always" arms the debounce', () => {
    mountSpendMagmite(1) // currently "Spend Magmite (Portal)"; one click -> 2 = "Always"

    settingChanged('spendmagmite')

    expect(g().autoTrimpSettings.spendmagmite.value).toBe(2) // we really landed on "Always"
    // The 5s grace window that lets the player keep cycling past it.
    expect(g().magmiteSpenderChanged).toBe(true)
  })

  it('=> AutoTrimps2.js:200 does NOT fire autoMagmiteSpender on the next tick', () => {
    mountSpendMagmite(1)
    settingChanged('spendmagmite')

    // The exact guard from legacy/AutoTrimps2.js:200.
    const wouldSpend = g().autoTrimpSettings.spendmagmite.value == 2 && !g().magmiteSpenderChanged
    expect(wouldSpend).toBe(false)
  })

  it('the window expires after 5 seconds, and only then may it spend', () => {
    mountSpendMagmite(1)
    settingChanged('spendmagmite')
    expect(g().magmiteSpenderChanged).toBe(true)

    vi.advanceTimersByTime(5000)

    expect(g().magmiteSpenderChanged).toBe(false)
    const wouldSpend = g().autoTrimpSettings.spendmagmite.value == 2 && !g().magmiteSpenderChanged
    expect(wouldSpend).toBe(true) // the player settled on "Always" -> spending is now correct
  })

  it('does not arm on the other transitions (OFF -> Portal)', () => {
    mountSpendMagmite(0)
    settingChanged('spendmagmite')
    expect(g().autoTrimpSettings.spendmagmite.value).toBe(1)
    expect(g().magmiteSpenderChanged).toBe(false)
  })

  it('does not arm for an unrelated multitoggle sitting at value 1', () => {
    // A REAL neighbouring setting (settings-defs.ts:747), not a synthetic id — the settings-reverse
    // net rejects tests that seed ids production never createSetting's, and it is right to.
    const el = document.createElement('div')
    el.setAttribute('id', 'spendmagmitesetting')
    document.body.appendChild(el)
    g().autoTrimpSettings = {
      spendmagmitesetting: {
        id: 'spendmagmitesetting',
        type: 'multitoggle',
        name: ['Normal', 'Normal & No OC', 'OneTime Only', 'OneTime & OC'],
        value: 1,
      },
    }

    settingChanged('spendmagmitesetting')

    expect(g().autoTrimpSettings.spendmagmitesetting.value).toBe(2)
    expect(g().magmiteSpenderChanged).toBe(false) // the guard is id-specific, not value-specific
  })
})
