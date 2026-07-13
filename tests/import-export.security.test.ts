// #76 regression net — two defects in import-export.ts, both reproduced on a REAL boot before the
// fix (full Trimps game + the freshly-built AT bundle in jsdom, i.e. the same instrument the sim
// suites use — no re-implementation of either function):
//
//  (A) cleanupAutoTrimps() deleted every autoTrimpSettings key with no DOM node. On a fully-booted
//      settings UI exactly ONE of the 548 keys has no node — `ATversion`, a bare string, not a
//      setting record — and it is the key loadPageVariables() gates the whole saved file on. Click
//      "Cleanup Saved Settings" (which fired on tooltip RENDER, before any confirm) → any
//      saveSettings() → refresh → all 548 settings back to defaults, permanently. Measured, before:
//        KEYS WITH NO DOM NODE (1): ["ATversion"] / DELETED (1): ["ATversion"] / AFTER RELOAD: 0 keys
//
//  (B) importModuleVars() eval()'d each `;`-terminated line of the import textarea. Pasting
//      `window.__PWNED__=1;` set it — arbitrary code execution in page context (@grant none).
//      It was ALSO a no-op on the exporter's own output: exportModuleVars() has emitted JSON since
//      2016 (`{"jobs":{"autoRatio7":[…]}}`, no `;` anywhere), so the eval always ran on the empty
//      string. Export → import round-tripped NOTHING. The bar for the fix is that it round-trips.
//
// The L0 proof net is BLIND to all of this (it records buy events only — #98). Nothing here may be
// justified by "the sim stayed green".

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'

// A real game + real AT bundle in jsdom. bootGame() runs AT's settings init but not the
// setTimeout startup chain, so MODULESdefault (AutoTrimps2.js `delayStartAgain`) is seeded here
// exactly as the game seeds it. Without it compareModuleVars()/the importer have no defaults to
// diff against — and the importer, correctly, then accepts nothing.
function boot(): any {
  const { window } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE }) as any
  window.MODULESdefault = JSON.parse(JSON.stringify(window.MODULES))
  return window
}

function pasteIntoImportBox(w: any, text: string) {
  let box = w.document.getElementById('importBox')
  if (!box) {
    box = w.document.createElement('textarea')
    box.id = 'importBox'
    w.document.body.appendChild(box)
  }
  box.value = text
}

// ─── (B) importModuleVars — parse, never execute ────────────────────────────────────────────────
describe('#76B · importModuleVars parses the exporter grammar and executes nothing', () => {
  let w: any
  beforeEach(() => {
    w = boot()
  })

  it('pasted JavaScript is NOT executed (this line used to set __PWNED__)', () => {
    pasteIntoImportBox(w, 'window.__PWNED__=1;\nMODULES.jobs.autoRatio7=[9,9,9];\n')
    w.importModuleVars()
    expect(w.__PWNED__).toBe(undefined)
    // and nothing was applied: the paste is not valid JSON, so the whole import is rejected
    expect(w.MODULES.jobs.autoRatio7).toEqual(w.MODULESdefault.jobs.autoRatio7)
    expect(w.localStorage.getItem('storedMODULES')).toBe(null)
  })

  it('an exfiltration payload is rejected, not run', () => {
    pasteIntoImportBox(w, "window.__EXFIL__ = localStorage.getItem('trimpSave1');")
    w.importModuleVars()
    expect(w.__EXFIL__).toBe(undefined)
  })

  // THE CORRECTNESS BAR: export → import → deep-equal, across every value shape MODULES holds
  // (number / boolean / array<number> / array<string> / nested plain object / a null default).
  it('ROUND-TRIP: exportModuleVars() → importModuleVars() restores every changed variable', () => {
    const mutations: [string, string, any][] = [
      ['breedtimer', 'voidCheckPercent', 42], // number
      ['equipment', 'alwaysLvl2', true], // boolean
      ['jobs', 'autoRatio7', [11, 22, 33]], // array<number>
      ['fightinfo', 'powerful', ['Snimp', 'Kongs']], // array<string>
      ['fightinfo', 'colors', { bone: '#111111', exotic: '#222222', powerful: '#333333', fast: '#444444' }], // object
      ['jobs', 'customRatio', [1, 2, 3, 4]], // default is null ⇒ any literal is a valid set
    ]
    for (const [mod, key, v] of mutations) {
      expect(Object.prototype.hasOwnProperty.call(w.MODULESdefault[mod], key)).toBe(true) // fixture is real
      w.MODULES[mod][key] = v
    }

    const exported = w.exportModuleVars()
    expect(JSON.parse(exported)).toEqual({
      breedtimer: { voidCheckPercent: 42 },
      equipment: { alwaysLvl2: true },
      jobs: { autoRatio7: [11, 22, 33], customRatio: [1, 2, 3, 4] },
      fightinfo: { powerful: ['Snimp', 'Kongs'], colors: { bone: '#111111', exotic: '#222222', powerful: '#333333', fast: '#444444' } },
    })

    // wipe every override, then import the exported string back
    w.MODULES = JSON.parse(JSON.stringify(w.MODULESdefault))
    for (const [mod, key] of mutations) expect(w.MODULES[mod][key]).toEqual(w.MODULESdefault[mod][key])

    pasteIntoImportBox(w, exported)
    w.importModuleVars()

    for (const [mod, key, v] of mutations) expect(w.MODULES[mod][key]).toEqual(v)
    // and the overrides were persisted for the next refresh (#71 — this is compareModuleVars(),
    // NOT a `storedMODULES` identifier, which nothing assigns)
    expect(JSON.parse(w.localStorage.getItem('storedMODULES'))).toEqual(JSON.parse(exported))
  })

  it('an empty override set round-trips as {}', () => {
    pasteIntoImportBox(w, w.exportModuleVars())
    w.importModuleVars()
    expect(w.localStorage.getItem('storedMODULES')).toBe('{}')
  })

  // Everything the exporter cannot emit is refused — and refused ATOMICALLY (the eval could
  // half-apply: it ran line 1 before throwing on line 2).
  const rejected: [string, string][] = [
    ['malformed JSON', 'not json at all'],
    ['a JSON array at top level', '[1,2,3]'],
    ['a JSON scalar at top level', '42'],
    ['an unknown module', '{"evilmod":{"x":1}}'],
    ['an unknown variable', '{"jobs":{"notAField":1}}'],
    ['a wrong-typed variable (array where a number lives)', '{"breedtimer":{"voidCheckPercent":[1,2]}}'],
    ['a wrong-typed variable (number where an array lives)', '{"jobs":{"autoRatio7":7}}'],
    ['a module whose body is not an object', '{"jobs":7}'],
    ['prototype pollution at module level', '{"__proto__":{"polluted":1}}'],
    ['prototype pollution at field level', '{"jobs":{"__proto__":{"polluted":1}}}'],
  ]
  for (const [label, payload] of rejected) {
    it(`rejects ${label}, applies nothing`, () => {
      const before = JSON.stringify(w.MODULES)
      pasteIntoImportBox(w, payload)
      w.importModuleVars()
      expect(JSON.stringify(w.MODULES)).toBe(before)
      expect(w.localStorage.getItem('storedMODULES')).toBe(null) // no write at all on a reject
      expect(({} as any).polluted).toBe(undefined)
      expect((w.Object.prototype as any).polluted).toBe(undefined)
    })
  }

  it('a valid entry alongside an invalid one applies NEITHER (atomic)', () => {
    pasteIntoImportBox(w, '{"breedtimer":{"voidCheckPercent":42},"jobs":{"notAField":1}}')
    w.importModuleVars()
    expect(w.MODULES.breedtimer.voidCheckPercent).toBe(w.MODULESdefault.breedtimer.voidCheckPercent)
    expect(w.localStorage.getItem('storedMODULES')).toBe(null)
  })
})

// ─── (A) cleanupAutoTrimps — purge stale ids, never the live file ───────────────────────────────
describe('#76A · cleanupAutoTrimps purges stale ids and cannot destroy the settings file', () => {
  let w: any
  beforeEach(() => {
    w = boot()
  })

  it('the settings file survives cleanup → save → reload (it used to come back EMPTY)', () => {
    const before = Object.keys(w.autoTrimpSettings).length
    expect(before).toBeGreaterThan(500) // anti-false-green: the UI really booted
    expect(w.autoTrimpSettings['ATversion']).toBeTruthy()

    w.cleanupAutoTrimps()
    expect(w.autoTrimpSettings['ATversion']).toBeTruthy() // the load gate key must survive
    expect(Object.keys(w.autoTrimpSettings).length).toBe(before) // a clean boot has nothing stale

    w.saveSettings()
    expect(JSON.parse(w.localStorage.getItem('autoTrimpSettings'))['ATversion']).toBeTruthy()

    w.autoTrimpSettings = {}
    w.loadPageVariables()
    expect(Object.keys(w.autoTrimpSettings).length).toBe(before) // file accepted, not rejected
    expect(w.getPageSetting('BuyBuildings')).not.toBe(undefined)
  })

  it('"has no DOM node" is NOT the predicate — ATversion has none and is not a setting', () => {
    const orphans = Object.keys(w.autoTrimpSettings).filter(
      (k) => w.document.getElementById(w.autoTrimpSettings[k]?.id) == null,
    )
    // This is the whole bug in one line: the old predicate deleted exactly this set.
    expect(orphans).toEqual(['ATversion'])
    expect(w.cleanupCandidates()).toEqual([])
  })

  it('it DOES purge a stale id from an older version (its actual job — #68 depends on this)', () => {
    // serializeSettings() round-trips unknown keys forever and loadPageVariables() restores the whole
    // blob, so a 2020-era id lives in the file until this purge removes it. It must still work: a
    // stale id is not inert — re-minting that id resurrects the user's old value.
    w.autoTrimpSettings['Ronlystackedvoids'] = { id: 'Ronlystackedvoids', type: 'boolean', enabled: true }
    w.autoTrimpSettings['hardcorewindmax'] = '-1' // a real junk key, frozen in serializeSettings60()
    expect(w.cleanupCandidates().sort()).toEqual(['Ronlystackedvoids', 'hardcorewindmax'])

    expect(w.cleanupAutoTrimps().sort()).toEqual(['Ronlystackedvoids', 'hardcorewindmax'])
    expect(w.autoTrimpSettings['Ronlystackedvoids']).toBe(undefined)
    expect(w.autoTrimpSettings['hardcorewindmax']).toBe(undefined)
    expect(w.autoTrimpSettings['ATversion']).toBeTruthy()
    expect(w.getPageSetting('BuyBuildings')).not.toBe(undefined) // live settings untouched
  })

  it('opening the tooltip does not delete anything — the delete needs an explicit confirm', () => {
    w.autoTrimpSettings['Ronlystackedvoids'] = { id: 'Ronlystackedvoids', type: 'boolean', enabled: true }
    w.game.global.lockTooltip = false
    w.ImportExportTooltip('CleanupAutoTrimps', 'update')

    // pure render: still there, and the confirm button names the count
    expect(w.autoTrimpSettings['Ronlystackedvoids']).toBeTruthy()
    const cost = w.document.getElementById('tipCost').innerHTML
    expect(cost).toContain('Delete 1')
    expect(cost).toContain('cleanupAutoTrimps()')
    expect(w.document.getElementById('tipText').innerHTML).toContain('Ronlystackedvoids')
  })

  it('an unbooted settings engine purges NOTHING (an empty id census is not "no settings exist")', () => {
    // The catastrophic shape of this function is "delete everything I cannot account for". If the
    // census is empty because createSetting never ran, accounting for nothing must delete nothing.
    const stale = { onlykey: { id: 'onlykey', type: 'boolean', enabled: true } }
    const saved = w.autoTrimpSettings
    w.autoTrimpSettings = stale
    w.definedSettingIds.clear() // simulate "createSetting never ran"
    expect(w.cleanupAutoTrimps()).toEqual([])
    expect(w.autoTrimpSettings).toEqual(stale)
    w.autoTrimpSettings = saved
  })
})

// ─── the permanent sink net ─────────────────────────────────────────────────────────────────────
// oxlint's no-eval / no-new-func / no-implied-eval are ON and `npm run lint --deny-warnings` is a
// real gate — so a new eval in src/ cannot land WITHOUT a suppression comment. This closes the other
// half: a suppression cannot land either. (The old eval carried exactly such a suppression.)
describe('#76 · no dynamic-code sink may be re-introduced into src/', () => {
  it('no file in src/ suppresses no-eval / no-new-func / no-implied-eval', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (e.name.endsWith('.ts')) {
          for (const [i, line] of readFileSync(p, 'utf8').split('\n').entries()) {
            if (/(oxlint|eslint)-disable[\w-]*[^\n]*\b(no-eval|no-new-func|no-implied-eval)\b/.test(line)) {
              offenders.push(`${p}:${i + 1}`)
            }
          }
        }
      }
    }
    walk('src')
    expect(offenders).toEqual([])
  })
})
