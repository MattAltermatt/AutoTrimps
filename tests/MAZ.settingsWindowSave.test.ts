// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// #83 §6 — settingsWindowSave() threw and silently saved NOTHING once a MAZ window held 30 rows.
//
// `var` is function-scoped, and the setting-KEY variables shared names with the row-VALUE variables:
//
//     for (var x = 0; x < 30; x++) {
//         var zone;                                     // function-scoped!
//         ... zone = 'Rshrinezone';                     // the KEY (re-assigned every iteration)
//         if (!zone2 || zone2.value == "-1") continue;  // an UNFILLED row bails here
//         zone = parseInt(byId('windowZone'+x).value);  // CLOBBERS the key with a NUMBER
//     }
//     autoTrimpSettings[zone].value = [];               // <- zone is now e.g. 41
//
// It only ever worked because the dispatch re-assigned the key at the TOP of each iteration: as long
// as the LAST iteration hit the `continue` (an unfilled row), `zone` survived the loop as the key
// string. Fill all 30 rows — the maximum the window allows — and the last iteration falls through, so
// `zone` ends the loop as a number, `autoTrimpSettings[41]` is undefined, and the post-loop write
// throws `Cannot set properties of undefined`. No error surfaces in the UI. A cliff, not a gradient.

vi.mock('../src/modules/utils', () => ({ saveSettings: vi.fn() }))
import { saveSettings } from '../src/modules/utils'
import { settingsWindowSave } from '../src/modules/MAZ'

const g = () => globalThis as any

/** Build a MAZ window DOM with `filled` filled rows out of 30. Unfilled rows carry the -1 sentinel. */
function buildWindow(filled: number) {
  const rows: string[] = ['<div id="windowError"></div>', '<div id="tooltipDiv"></div>']
  for (let x = 0; x < 30; x++) {
    const zone = x < filled ? String(10 + x) : '-1'
    rows.push(`<input id="windowZone${x}" value="${zone}">`)
    rows.push(`<input id="windowCell${x}" value="50">`)
    rows.push(`<input id="windowSetting${x}" value="7">`)
  }
  document.body.innerHTML = rows.join('')
}

beforeEach(() => {
  vi.clearAllMocks()
  g().autoTrimpSettings = {
    Rshrinezone: { type: 'multiValue', value: [] },
    Rshrinecell: { type: 'multiValue', value: [] },
    Rshrineamount: { type: 'multiValue', value: [] },
  }
  g().byId = (id: string) => document.getElementById(id)
  g().cancelTooltip = () => {}
  g().MAZLookalike = () => {}
})

describe('#83 §6: settingsWindowSave survives a full 30-row MAZ window', () => {
  it('control: 29 filled rows save fine (this always worked)', () => {
    buildWindow(29)
    settingsWindowSave('Shrine - U2')

    expect(g().autoTrimpSettings.Rshrinezone.value).toHaveLength(29)
    expect(saveSettings).toHaveBeenCalledTimes(1)
  })

  it('THE BUG: 30 filled rows — the window maximum — save all 30 presets', () => {
    buildWindow(30)

    // Before the fix this threw TypeError: Cannot set properties of undefined (setting 'value').
    expect(() => settingsWindowSave('Shrine - U2')).not.toThrow()

    expect(g().autoTrimpSettings.Rshrinezone.value).toHaveLength(30)
    expect(g().autoTrimpSettings.Rshrinecell.value).toHaveLength(30)
    expect(g().autoTrimpSettings.Rshrineamount.value).toHaveLength(30)
    expect(saveSettings).toHaveBeenCalledTimes(1)
  })

  it('the saved values are the rows the player actually entered (zones 10..39)', () => {
    buildWindow(30)
    settingsWindowSave('Shrine - U2')

    expect(g().autoTrimpSettings.Rshrinezone.value).toEqual(
      Array.from({ length: 30 }, (_, i) => 10 + i),
    )
    // cell is clamped to <=100, setting is the raw field value
    expect(g().autoTrimpSettings.Rshrinecell.value.every((c: number) => c === 50)).toBe(true)
    expect(g().autoTrimpSettings.Rshrineamount.value.every((s: string) => s === '7')).toBe(true)
  })

  it('an empty window (zero filled rows) still resets cleanly rather than throwing', () => {
    g().autoTrimpSettings.Rshrinezone.value = [99]
    buildWindow(0)

    expect(() => settingsWindowSave('Shrine - U2')).not.toThrow()
    expect(g().autoTrimpSettings.Rshrinezone.value).toEqual([])
  })
})
