// The scaffold `updateCustomButtons()` needs before it will run to completion in jsdom.
//
// It exists because that function is ~150 lines of unguarded DOM dereferences on its way to anything
// worth asserting: it walks EVERY entry in autoTrimpSettings doing
// `document.getElementById(item.id).parentNode` with the null check one line too late, and it writes a
// dozen dropdowns back onto <select>s by id. Miss one and it throws long before the branch under test.
//
// Two files need this (tests/phantom-settings-68-79.test.ts for the #68/#79 visibility rows,
// tests/nom-farm-carveout.regression.test.ts for #209), and a second hand-maintained copy of a
// 40-line DOM scaffold is a stale copy waiting to happen — so there is exactly one.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..', '..')
const VIS = resolve(ROOT, 'src/modules/settings-visibility.ts')

/**
 * Every setting updateCustomButtons reaches through `autoTrimpSettings.<id>.selected` — i.e. DIRECTLY,
 * not via getPageSetting — and then writes onto a <select>. Each one must exist and have a live row or
 * the function throws.
 *
 * DERIVED from the source, not transcribed. The list used to be a hand-maintained array with a comment
 * saying which grep produced it, which is a copy of a code-owned fact and rots the moment a dropdown is
 * added: the symptom would be a confusing mid-function TypeError in an unrelated test, not a clear
 * failure here.
 */
export function directDropdownIds(): string[] {
  const src = readFileSync(VIS, 'utf8')
  const ids = new Set<string>()
  for (const m of src.matchAll(/autoTrimpSettings\.([A-Za-z0-9_]+)\.selected/g)) ids.add(m[1])
  return [...ids].sort()
}

/**
 * A row shaped the way updateCustomButtons expects: an element inside a parent it can style.
 *
 * The parent's `display` is deliberately left UNSET. turnOn() is what writes 'inline-block', and
 * tests assert on that — presetting it here would make those assertions pass without the code under
 * test doing anything, which is the #66 false-green shape.
 */
export function row(id: string): HTMLElement {
  const existing = document.getElementById(id)
  if (existing) return existing
  const parent = document.createElement('div')
  parent.setAttribute('data-phantom-row', '')
  const el = document.createElement('div')
  el.id = id
  parent.appendChild(el)
  document.body.appendChild(parent)
  return el
}

/** Seed a settings record AND its row. The record carries its own `id` — the walk dereferences it. */
export function def(id: string, type: string, extra: Record<string, unknown>): void {
  ;(globalThis as any).autoTrimpSettings[id] = { id, name: id, type, ...extra }
  row(id)
}

export function setSelect(id: string, selected: string): void {
  ;(globalThis as any).autoTrimpSettings[id] = { id, name: id, type: 'dropdown', selected }
}

/** Every direct-dropdown record + row, plus the handful of elements/settings read non-null. */
export function dropdownScaffold(): void {
  for (const id of directDropdownIds()) {
    setSelect(id, 'Off')
    row(id)
  }
  row('autoMapBtn')
  def('AutoMaps', 'multitoggle', { value: 0 })
  def('RAutoMaps', 'multitoggle', { value: 0 })
}

/** Drop the rows this scaffold created. Does NOT touch tests/setup.ts's shared scaffold. */
export function clearScaffoldRows(): void {
  for (const el of document.querySelectorAll('[data-phantom-row]')) el.remove()
}

/** The minimal `game` shape updateCustomButtons walks. Callers override `global.universe` etc. */
export function baseGame(): any {
  return {
    options: { menu: { darkTheme: { enabled: false } } },
    permaBoneBonuses: { boosts: { owned: 0 } },
    global: { challengeActive: '', universe: 2, world: 1 },
    talents: {},
    upgrades: {},
    buildings: {},
    jobs: {},
    portal: {},
    stats: {},
    resources: {},
    unlocks: { imps: {} },
    worldUnlocks: { easterEgg: { locked: true } },
    mapUnlocks: {},
    achievements: {},
    c2: {},
    empowerments: {},
  }
}
