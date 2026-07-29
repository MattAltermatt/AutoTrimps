// @vitest-environment jsdom
//
// Regression net for #172 — the dump perk was persisted as a positional index into a list whose
// membership grows with unlocks.
//
// `populateDumpPerkList` builds the #dumpPerk options from `getVariablePerks()`, which filters on
// `game.portal[X].locked` — so the option list's LENGTH AND ORDER change as perks unlock. Restoring a
// bare `selectedIndex` therefore re-points at a different perk the moment anything unlocks earlier in
// `perkHolder`, and `spendHelium` then pours ALL leftover helium into the wrong perk, silently.
// `populateDumpPerkList` runs once per page load, so nothing re-derives it.
//
// jsdom rather than the full clone boot: the defect is entirely in the dropdown's build/restore pair
// (a <select>, an option list, and two localStorage keys), so driving those directly tests the
// mechanism without booting a game to reach it.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(__dirname, '../src/modules/perks.ts'), 'utf8')

/**
 * The real restore logic, extracted from the module source so the test cannot drift from it. perks.ts
 * is a globalThis-seam module with a hard game dependency, so importing it here is not possible —
 * but a hand-retyped copy of the function would be testing my copy, not the shipped code (this repo
 * has a name for that: derive, don't retype). Slicing the actual function text keeps them identical.
 */
function loadRestoreFn(): (d: HTMLSelectElement, idKey: string, nameKey: string) => void {
  const start = SRC.indexOf('function restoreDumpSelection(')
  expect(start).toBeGreaterThan(-1)
  // Walk braces to find the end of the function body, so this survives edits to its length.
  let depth = 0
  let end = -1
  for (let i = SRC.indexOf('{', start); i < SRC.length; i++) {
    if (SRC[i] === '{') depth++
    else if (SRC[i] === '}') {
      depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  expect(end).toBeGreaterThan(start)
  const body = SRC.slice(start, end)
    .replace(/: HTMLSelectElement/g, '')
    .replace(/: string/g, '')
    .replace(/: void/g, '')
    .replace(/\$dropdown\.options\[o\]!/g, '$dropdown.options[o]')
  // eslint-disable-next-line no-new-func
  return new Function(`${body}; return restoreDumpSelection;`)() as any
}

const restoreDumpSelection = loadRestoreFn()

/** Build the option list exactly as populateDumpPerkList does: one per unlocked perk, then "None". */
function buildDropdown(perkNames: string[]): HTMLSelectElement {
  const el = document.createElement('select')
  el.innerHTML =
    perkNames.map((n) => `<option id='${n}Dump'>${n[0]!.toUpperCase()}${n.slice(1)}</option>`).join('') +
    `<option id='none'>None</option>`
  return el
}

const ID_KEY = 'AutoperkSelectedDumpPresetID'
const NAME_KEY = 'AutoperkSelectedDumpPresetName'

// This project's jsdom environment does not expose `localStorage` as a global, so supply a minimal
// in-memory one. It is a platform dependency, not the thing under test — the logic being exercised is
// the name-vs-index selection, and stubbing storage keeps that deterministic rather than depending on
// jsdom's origin handling.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
}

// The finding's worked example, before and after Overkill unlocks at position 10.
const LOCKED = ['looting', 'toughness', 'power', 'motivation', 'pheromones', 'artisanistry', 'carpentry',
  'resilience', 'coordinated', 'resourceful', 'cunning', 'curious', 'classy', 'toughness_II',
  'power_II', 'motivation_II', 'carpentry_II', 'looting_II']
const UNLOCKED = ['looting', 'toughness', 'power', 'motivation', 'pheromones', 'artisanistry', 'carpentry',
  'resilience', 'coordinated', 'resourceful', 'overkill', 'cunning', 'curious', 'classy', 'toughness_II',
  'power_II', 'motivation_II', 'carpentry_II', 'looting_II']

describe('#172 — the dump perk survives a perk unlocking earlier in the list', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('POSITIVE CONTROL: the fixture reproduces the index shift the finding describes', () => {
    // Anti-false-green. If the two option lists did not actually shift, every test below would pass
    // against a build with the fix removed — there would be nothing to get wrong.
    const before = buildDropdown(LOCKED)
    const after = buildDropdown(UNLOCKED)
    // This is the finding's worked example, reproduced exactly: the saved slot held looting_II, and
    // after Overkill is inserted at position 10 that same slot resolves to carpentry_II.
    expect(before.options[17]!.value).toBe('Looting_II')
    expect(after.options[17]!.value).toBe('Carpentry_II')
    expect(after.options.length).toBe(before.options.length + 1)
  })

  it('restores the SAME perk after an earlier perk unlocks', () => {
    // Save while Overkill is locked...
    const before = buildDropdown(LOCKED)
    before.selectedIndex = 17
    const chosen = before.options[before.selectedIndex]!.value
    localStorage.setItem(ID_KEY, String(before.selectedIndex))
    localStorage.setItem(NAME_KEY, chosen)

    // ...then reload with Overkill unlocked, which shifts everything after position 10.
    const after = buildDropdown(UNLOCKED)
    restoreDumpSelection(after, ID_KEY, NAME_KEY)

    expect(after.options[after.selectedIndex]!.value).toBe(chosen)
    expect(after.selectedIndex).toBe(18) // it MOVED — restoring 17 would land on carpentry_II
  })

  it('still restores correctly when nothing has shifted', () => {
    // Parity half: the common case must be untouched.
    const first = buildDropdown(UNLOCKED)
    first.selectedIndex = 3
    localStorage.setItem(ID_KEY, '3')
    localStorage.setItem(NAME_KEY, first.options[3]!.value)

    const second = buildDropdown(UNLOCKED)
    restoreDumpSelection(second, ID_KEY, NAME_KEY)

    expect(second.selectedIndex).toBe(3)
    expect(second.options[second.selectedIndex]!.value).toBe('Motivation')
  })

  it('restores "None" by name rather than by trailing position', () => {
    const first = buildDropdown(LOCKED)
    first.selectedIndex = first.options.length - 1
    localStorage.setItem(ID_KEY, String(first.selectedIndex))
    localStorage.setItem(NAME_KEY, 'None')

    const second = buildDropdown(UNLOCKED)
    restoreDumpSelection(second, ID_KEY, NAME_KEY)

    expect(second.options[second.selectedIndex]!.value).toBe('None')
  })

  it('falls back to the stored index when no name was ever written', () => {
    // A store written before saveDumpPerk started persisting the name. The index is all there is.
    localStorage.setItem(ID_KEY, '5')
    const el = buildDropdown(UNLOCKED)
    restoreDumpSelection(el, ID_KEY, NAME_KEY)
    expect(el.selectedIndex).toBe(5)
  })

  it('defaults to the last perk (just above "None") on a fresh store', () => {
    const el = buildDropdown(UNLOCKED)
    restoreDumpSelection(el, ID_KEY, NAME_KEY)
    expect(el.selectedIndex).toBe(el.length - 2)
    expect(el.options[el.selectedIndex]!.value).toBe('Looting_II')
  })

  it('census: neither universe restores a bare selectedIndex any more', () => {
    // Both twins must route through the shared helper — the finding named the U1 site and mentioned
    // the U2 one in passing, and a fix applied to only one would leave the class half-open.
    expect(SRC).not.toMatch(/selectedIndex = Number\(loadLastDump\)/)
    expect(SRC.match(/restoreDumpSelection\(\$dumpDropdown,/g)?.length).toBe(2)
    expect(SRC).toContain("'AutoperkSelectedDumpPresetName'")
    expect(SRC).toContain("'RAutoperkSelectedDumpPresetName'")
  })
})
