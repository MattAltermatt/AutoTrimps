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

/** Build a window from explicit per-row field values, so a row can carry an EMPTY box. */
function buildRows(rowsIn: { zone: string; cell?: string; setting?: string; level?: string }[]) {
  const rows: string[] = ['<div id="windowError"></div>', '<div id="tooltipDiv"></div>']
  for (let x = 0; x < 30; x++) {
    const r = rowsIn[x]
    rows.push(`<input id="windowZone${x}" value="${r ? r.zone : '-1'}">`)
    rows.push(`<input id="windowCell${x}" value="${r?.cell ?? '50'}">`)
    rows.push(`<input id="windowSetting${x}" value="${r?.setting ?? '7'}">`)
    rows.push(`<input id="windowLevel${x}" value="${r?.level ?? '0'}">`)
  }
  document.body.innerHTML = rows.join('')
}

beforeEach(() => {
  vi.clearAllMocks()
  g().autoTrimpSettings = {
    Rshrinezone: { type: 'multiValue', value: [] },
    Rshrinecell: { type: 'multiValue', value: [] },
    Rshrineamount: { type: 'multiValue', value: [] },
    Rblackbogzone: { type: 'multiValue', value: [] },
    Rblackbogamount: { type: 'multiValue', value: [] },
    Rinsanityfarmzone: { type: 'multiValue', value: [] },
    Rinsanityfarmcell: { type: 'multiValue', value: [] },
    Rinsanityfarmstack: { type: 'multiValue', value: [] },
    Rinsanityfarmlevel: { type: 'multiValue', value: [] },
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

// ── #179 — the Quagmire comparator ───────────────────────────────────────────────────────────────
//
// Quagmire takes the `else` branch of the sort, which read
// `if (a.zone == b.zone) return (a.zone > b.zone) ? 1 : -1` — a body that returns a value ONLY for
// equal zones. Every distinct-zone pair fell off the end and returned undefined, which ES SortCompare
// coerces to +0, so the rows were stored in the order typed. The consumer Rbogs() prefix-sums the
// amounts up to `indexOf(world)`, which is only "every lower zone" on an ascending array.
describe('#179: the Quagmire window sorts its rows by zone', () => {
  it('stores zones ascending regardless of the order they were entered', () => {
    buildRows([
      { zone: '70', setting: '40' },
      { zone: '30', setting: '20' },
      { zone: '50', setting: '10' },
    ])
    settingsWindowSave('Quagmire - U2')

    expect(g().autoTrimpSettings.Rblackbogzone.value).toEqual([30, 50, 70])
    // The amounts must travel WITH their zones, not be sorted independently.
    expect(g().autoTrimpSettings.Rblackbogamount.value).toEqual(['20', '10', '40'])
  })

  it('the prefix sum the consumer computes is now monotonic in zone', () => {
    buildRows([
      { zone: '70', setting: '40' },
      { zone: '30', setting: '20' },
      { zone: '50', setting: '10' },
    ])
    settingsWindowSave('Quagmire - U2')

    // Replay Rbogs()'s own loop (mapfunctions.ts:628-644) for each configured zone.
    const zones = g().autoTrimpSettings.Rblackbogzone.value as number[]
    const amounts = g().autoTrimpSettings.Rblackbogamount.value as string[]
    const stackSumAt = (world: number) => {
      const idx = zones.indexOf(world)
      let sum = 0
      for (let i = 0; i < idx + 1; i++) sum += parseInt(amounts[i]!)
      return sum
    }
    // A later zone must never carry a SMALLER running total than an earlier one. Unsorted this read
    // 40 / 30 / 60 for worlds 70 / 30 / 50 — the z70 tier stricter than the z30 tier.
    expect([stackSumAt(30), stackSumAt(50), stackSumAt(70)]).toEqual([20, 30, 70])
  })

  it('already-ascending input is left alone', () => {
    buildRows([
      { zone: '30', setting: '20' },
      { zone: '50', setting: '10' },
      { zone: '70', setting: '40' },
    ])
    settingsWindowSave('Quagmire - U2')
    expect(g().autoTrimpSettings.Rblackbogzone.value).toEqual([30, 50, 70])
    expect(g().autoTrimpSettings.Rblackbogamount.value).toEqual(['20', '10', '40'])
  })
})

// ── #180 — NaN cell / level survive the clamps ───────────────────────────────────────────────────
//
// `parseInt('', 10)` is NaN, and NaN fails BOTH `< 1` and `> 100`, so an emptied Cell box was stored
// unclamped. Every consumer gate is `lastClearedCell + 2 >= cell`, and `x >= NaN` is always false, so
// the row existed, looked configured, and never fired — while the popup redisplayed it as 81, because
// its hydration falls back to 81 for any FALSY stored value and NaN is falsy.
describe('#180: an emptied Cell or Map Level box cannot persist as NaN', () => {
  it('an empty Cell box stores the default the popup would redisplay, not NaN', () => {
    buildRows([{ zone: '20', cell: '', setting: '5' }])
    settingsWindowSave('Shrine - U2')

    const stored = g().autoTrimpSettings.Rshrinecell.value
    expect(stored).toHaveLength(1)
    expect(Number.isNaN(stored[0])).toBe(false)
    expect(stored[0]).toBe(81)
  })

  it('the stored cell passes the gate every consumer actually uses', () => {
    buildRows([{ zone: '20', cell: '', setting: '5' }])
    settingsWindowSave('Shrine - U2')

    const cell = g().autoTrimpSettings.Rshrinecell.value[0]
    // mapfunctions.ts:456/497/603 — `game.global.lastClearedCell + 2 >= cell`. With NaN this was
    // false for every possible lastClearedCell, which is what made the preset permanently inert.
    expect(98 + 2 >= cell).toBe(true)
  })

  it('an empty Map Level box stores 0, not NaN', () => {
    buildRows([{ zone: '20', cell: '50', setting: '5', level: '' }])
    settingsWindowSave('Insanity - U2')

    const stored = g().autoTrimpSettings.Rinsanityfarmlevel.value
    expect(Number.isNaN(stored[0])).toBe(false)
    expect(stored[0]).toBe(0)
  })

  it('a real cell value is still stored and still clamped', () => {
    buildRows([{ zone: '20', cell: '50' }, { zone: '21', cell: '250' }, { zone: '22', cell: '0' }])
    settingsWindowSave('Shrine - U2')
    expect(g().autoTrimpSettings.Rshrinecell.value).toEqual([50, 100, 1])
  })
})

// ── #193 — the overflowY cleanup raced the reopen ────────────────────────────────────────────────
describe('#193: an in-place Save leaves the reopened window scrollable', () => {
  // MAZLookalike is called module-internally, so a global stub cannot intercept it (the #127/#129
  // lesson). Drive the REAL one — it is what sets maxHeight + overflowY:'scroll' inline at MAZ.ts:314-316
  // — by supplying the handful of engine globals and static nodes it touches.
  function enableRealReopen() {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="tipText"></div><div id="tipTitle"></div><div id="tipCost"></div>',
    )
    g().swapClass = (prefix: string, add: string, el: HTMLElement) => {
      el.className = el.className
        .split(' ')
        .filter((c) => c && !c.startsWith(prefix))
        .concat(add)
        .join(' ')
    }
    g().game = { global: { lockTooltip: false, world: 20 } }
  }

  it('the reopen\'s overflowY survives the cleanup', () => {
    buildRows([{ zone: '20' }])
    enableRealReopen()

    settingsWindowSave('Shrine - U2', true)

    const el = document.getElementById('tooltipDiv')!
    // Neither #tooltipDiv nor .tooltipExtraLg declares an overflow (tabs.css:244-246, styleBak.css:196-204),
    // so an empty inline value means `visible`: a window capped at 85vh whose rows and Save/Cancel
    // buttons spill outside it with no scrollbar to reach them.
    expect(el.style.overflowY).toBe('scroll')
    expect(el.style.maxHeight).not.toBe('')
  })

  it('the close path (no reopen) still clears it', () => {
    buildRows([{ zone: '20' }])
    document.getElementById('tooltipDiv')!.style.overflowY = 'scroll'
    settingsWindowSave('Shrine - U2')
    expect(document.getElementById('tooltipDiv')!.style.overflowY).toBe('')
  })
})
