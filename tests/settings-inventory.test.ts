// @vitest-environment jsdom
//
// Control-inventory golden for settings-defs.ts (#46 — "net first" before #39/#41).
//
// initializeAllSettings() is 569 sequential createSetting(...) calls — the authoritative catalog of
// every AutoTrimps control. ORDER + COMPLETENESS are the persistence contract (a dropped/renamed/
// reordered call silently kills that setting's saved value). The src-bundle byte-golden pins the
// SOURCE bytes; this pins the RUNTIME catalog (id → labels → type → default → tab), decoupled from
// how defs.ts is written. So when #39/#41 refactors the taxonomy (e.g. extracts a declarative
// table), the byte-golden regenerates but THIS stays green iff the same controls are still declared
// in the same order — proving the refactor preserved the catalog.
//
// Harness: inject a recorder as the global `createSetting` (defs.ts calls it as a bridge free
// identifier), stub `modifyParentNode`, and hand back a self-returning callable Proxy from
// getElementById so the interleaved layout strays (.parentNode.insertAdjacentHTML / .style.setProperty
// / .innerHTML) all no-op. Then snapshot the recorded tuples.

import { describe, it, expect, beforeAll } from 'vitest'

type Tuple = {
  id: unknown
  name: unknown
  type: unknown
  default: unknown
  list: unknown
  container: unknown
}

let inventory: Tuple[]

beforeAll(async () => {
  inventory = []

  // Self-returning callable Proxy: any property access or call returns itself, any set succeeds.
  // Covers getElementById('x').parentNode.insertAdjacentHTML(...), .style.setProperty(...),
  // .innerHTML = ..., .setAttribute(...) — every DOM stray in initializeAllSettings.
  const anyEl: any = new Proxy(function () {}, {
    get: () => anyEl,
    apply: () => anyEl,
    set: () => true,
  })
  const origGetById = document.getElementById.bind(document)
  document.getElementById = (() => anyEl) as typeof document.getElementById

  ;(globalThis as any).createSetting = (
    id: unknown,
    name: unknown,
    _description: unknown,
    type: unknown,
    defaultValue: unknown,
    list: unknown,
    container: unknown,
  ) => {
    inventory.push({ id, name, type, default: defaultValue, list, container })
  }
  ;(globalThis as any).modifyParentNode = () => {}
  ;(globalThis as any).settingsProfileMakeGUI = () => {}

  const { initializeAllSettings } = await import('../src/modules/settings-defs')
  initializeAllSettings()

  document.getElementById = origGetById
})

describe('settings-defs · control-inventory golden', () => {
  it('declares the expected number of controls (byte-golden-independent count)', () => {
    expect(inventory.length).toMatchInlineSnapshot(`575`)
  })

  it('every control has exactly one type — no id declared twice (a dup silently overwrites state)', () => {
    const byId = new Map<unknown, unknown>()
    const dups: string[] = []
    for (const c of inventory) {
      if (byId.has(c.id)) dups.push(`${c.id} (${byId.get(c.id)} vs ${c.type})`)
      else byId.set(c.id, c.type)
    }
    expect(dups).toEqual([])
  })

  it('every control declares a known type kind', () => {
    const KNOWN = new Set([
      'boolean',
      'value',
      'valueNegative',
      'multiValue',
      'textValue',
      'dropdown',
      'infoclick',
      'multitoggle',
      'action',
    ])
    const unknown = inventory.filter((c) => !KNOWN.has(c.type as string)).map((c) => `${c.id}:${c.type}`)
    expect(unknown).toEqual([])
  })

  it('pins the full ordered (id, type, tab) catalog as a golden', () => {
    // Compact projection — labels/descriptions are prose that churns; id+type+tab is the semantic
    // contract. A reorder, retype, or moved tab shows up as a reviewable snapshot diff.
    const catalog = inventory.map((c) => `${c.id}\t${c.type}\t${c.container}`)
    expect(catalog).toMatchSnapshot()
  })

  it('spot-checks a few well-known controls survive with their kind', () => {
    const find = (id: string) => inventory.find((c) => c.id === id)
    expect(find('ManualGather2')?.type).toBe('multitoggle')
    expect(find('PauseScript')?.type).toBe('boolean')
    expect(find('radonsettings')?.type).toBe('multitoggle')
    expect(find('AutoPortal')?.type).toBe('dropdown')
  })
})
