// @vitest-environment jsdom
//
// #151 Tier B — the END-TO-END proof that a veteran's stored values survive the id rename.
//
// tests/settings-migrations.test.ts proves the primitive with synthetic tables. This file proves the
// SEAM: that the real table, driven through a real settings boot, actually rehomes a real user's
// values before createSetting can apply a default over them.
//
// ═══ WHY EVERY SEEDED VALUE IS OFF-DEFAULT, AND WHY THAT IS THE ENTIRE TEST ══════════════════════
// The obvious fixture to reach for is tests/fixtures/at-settings/p18-z2-balance-stall.json — a real
// user's exported blob that carries all of these ids and is already booted by the sim suite. It is
// USELESS for this purpose, and dangerously so: every one of its values is byte-identical to the
// setting's declared default.
//
//     dmgcuntoff "4" / default '4'      spireshitbuy false / default false
//     mapcuntoff "4" / default '4'      fuckjobs     false / default false
//     Rdmgcuntoff "1" / default '1'     Rmapcuntoff  "1"   / default '1'
//
// So migration-correct, migration-no-ops, and migration-never-written all produce identical results
// against it. The same is true of the L0 proof net, whose fixtures boot with empty localStorage —
// baseline-zero stays at zero here no matter what ships, and citing it as evidence for THIS change
// would be false. That is #90/#98 "reach is not sensitivity" exactly: the code runs, it just cannot
// matter. Every value below is therefore chosen so that no default could produce it.
//
// Mutation-proven; see the matrix in the commit body. The control that matters most: re-seed VETERAN
// with the declared defaults and delete the migration — this suite must go GREEN. That is the proof
// that the off-default values are load-bearing rather than decorative.

import { describe, it, expect, beforeAll } from 'vitest'

/** Retired id -> the off-default value a veteran is holding. No default can produce any of these. */
const VETERAN_VALUES: Record<string, unknown> = {
  dmgcuntoff: '9', //  default '4'
  Rdmgcuntoff: '6', //  default '1'
  mapcuntoff: '7', //  default '4'
  Rmapcuntoff: '3', //  default '1'
  spireshitbuy: true, //  default false
  fuckjobs: true, //  default false
}

/** Current id -> what the veteran's value must decode to after migration. */
const EXPECTED: Record<string, unknown> = {
  EquipDamageCutoff: 9, // 'value' decodes via parseFloat
  REquipDamageCutoff: 6,
  MapDamageCutoff: 7,
  RMapDamageCutoff: 3,
  SpirePrepGear: true,
  HideJobBoxes: true,
}

/** Current id -> its declared default, for the fresh-install arm. */
const DEFAULTS: Record<string, unknown> = {
  EquipDamageCutoff: 4,
  REquipDamageCutoff: 1,
  MapDamageCutoff: 4,
  RMapDamageCutoff: 1,
  SpirePrepGear: false,
  HideJobBoxes: false,
}

const RETIRED = Object.keys(VETERAN_VALUES)
const CURRENT = Object.keys(EXPECTED)

let utils: typeof import('../src/modules/utils')
let initializeAllSettings: () => void
const store = () => (globalThis as any).autoTrimpSettings as Record<string, any>

beforeAll(async () => {
  // Same harness idiom as tests/nets/settings-types.test.ts — a self-returning callable Proxy so every
  // DOM stray inside the 576 defs no-ops.
  const anyEl: any = new Proxy(function () {}, { get: () => anyEl, apply: () => anyEl, set: () => true })
  document.getElementById = (() => anyEl) as typeof document.getElementById
  ;(globalThis as any).modifyParentNode = () => {}
  ;(globalThis as any).settingsProfileMakeGUI = () => {}
  ;(globalThis as any).game = { options: { menu: { darkTheme: { enabled: 0 } } } }
  ;(globalThis as any).ATversion = 'net-id-migration'

  const backing = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k: string, v: string) => void backing.set(k, String(v)),
    removeItem: (k: string) => void backing.delete(k),
  }

  const engine = await import('../src/modules/settings-engine')
  utils = await import('../src/modules/utils')
  ;({ initializeAllSettings } = await import('../src/modules/settings-defs'))
  ;(globalThis as any).createSetting = engine.createSetting
  ;(globalThis as any).getPageSetting = utils.getPageSetting
})

/** A veteran's flat localStorage blob: retired ids, bare primitives, and the ATversion load gate. */
function veteranBlob(values: Record<string, unknown> = VETERAN_VALUES): string {
  return JSON.stringify({ ATversion: '5.9.9-pre-rename', ...values })
}

/** Production's own boot order: localStorage -> loadPageVariables -> initializeAllSettings. */
function bootFrom(blob: string | null) {
  if (blob === null) localStorage.removeItem('autoTrimpSettings')
  else localStorage.setItem('autoTrimpSettings', blob)
  ;(globalThis as any).autoTrimpSettings = {}
  utils.loadPageVariables()
  initializeAllSettings()
}

describe('#151 persisted setting id migration', () => {
  it('a veteran keeps every configured value under the new id', () => {
    bootFrom(veteranBlob())
    for (const [id, want] of Object.entries(EXPECTED)) {
      expect({ id, got: utils.getPageSetting(id) }).toEqual({ id, got: want })
    }
  })

  it('and the retired keys are gone from the store AND from what gets persisted', () => {
    bootFrom(veteranBlob())
    const persisted = JSON.parse(utils.serializeSettings())
    for (const old of RETIRED) {
      expect({ old, inStore: Object.prototype.hasOwnProperty.call(store(), old) }).toEqual({ old, inStore: false })
      expect({ old, persisted: Object.prototype.hasOwnProperty.call(persisted, old) }).toEqual({ old, persisted: false })
    }
  })

  it('a fresh install takes the declared defaults and never invents a retired key', () => {
    bootFrom(null)
    for (const [id, want] of Object.entries(DEFAULTS)) {
      expect({ id, got: utils.getPageSetting(id) }).toEqual({ id, got: want })
    }
    const persisted = JSON.parse(utils.serializeSettings())
    expect(RETIRED.filter((o) => o in persisted)).toEqual([])
  })

  it('the import seam migrates too — this is the path a boot-time hook would have missed', () => {
    // resetAutoTrimps() assigns the pasted/profile blob straight onto autoTrimpSettings and calls
    // initializeAllSettings() directly, never touching loadPageVariables(). Reproduced exactly.
    ;(globalThis as any).autoTrimpSettings = JSON.parse(veteranBlob())
    initializeAllSettings()
    for (const [id, want] of Object.entries(EXPECTED)) {
      expect({ id, got: utils.getPageSetting(id) }).toEqual({ id, got: want })
    }
    expect(RETIRED.filter((o) => Object.prototype.hasOwnProperty.call(store(), o))).toEqual([])
  })

  it('a pre-rename PRESET re-introduces retired keys, and the next init migrates them again', () => {
    // Both frozen preset blobs still carry spireshitbuy and fuckjobs, deliberately — they are the
    // migration's input, not its output. Importing one must not strand those two settings.
    ;(globalThis as any).autoTrimpSettings = JSON.parse(utils.serializeSettings550())
    initializeAllSettings()
    expect(utils.getPageSetting('SpirePrepGear')).toBe(true) // z550 preset sets it on
    expect(utils.getPageSetting('HideJobBoxes')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(store(), 'spireshitbuy')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(store(), 'fuckjobs')).toBe(false)
  })

  it('is idempotent across a save/reload cycle', () => {
    bootFrom(veteranBlob())
    const first = utils.serializeSettings()
    bootFrom(first)
    expect(utils.serializeSettings()).toBe(first)
  })

  it('does not revert a later edit — the delete is what makes this true', () => {
    // Copy-without-delete passes every assertion above and still breaks the setting permanently:
    // the stale key gets re-copied over the user's edit on the next init.
    bootFrom(veteranBlob())
    store()['MapDamageCutoff'].value = '12'
    bootFrom(utils.serializeSettings())
    expect(utils.getPageSetting('MapDamageCutoff')).toBe(12)
  })

  it('the fixture is actually off-default (anti-false-green: defaults would prove nothing)', () => {
    // The control. If any seeded value ever equals its declared default, the arm above stops being
    // able to tell a working migration from a missing one — which is exactly why the real-user
    // fixture p18-z2-balance-stall.json cannot be used here.
    for (const current of CURRENT) {
      expect({ current, differsFromDefault: EXPECTED[current] !== DEFAULTS[current] }).toEqual({
        current,
        differsFromDefault: true,
      })
    }
  })
})
