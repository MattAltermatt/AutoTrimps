// #151 Tier B — unit proof of the persisted-id migration primitive.
//
// Every case here drives an INJECTED synthetic table, never the shipped one. That is deliberate:
// it proves the mechanism independently of which ids happen to be in flight, so this file does not
// churn when a row is added, and a row added later cannot quietly change what "proven" means.
// The end-to-end proof that the seam is wired into createSetting lives in
// tests/settings-id-migration.test.ts, which drives the REAL table through a real boot.
//
// MUTATION-PROVEN. Each case names the specific mutant it kills; see the table in the commit body.
// The two that matter most and are easy to get wrong:
//   · FALSY VALUES. `false` is the stored value of most boolean settings, and `0` is a legitimate
//     multitoggle index. A migration written with `if (store[from])` instead of a presence check
//     silently refuses to move exactly the values users are most likely to have.
//   · DELETE. Copy-without-delete passes a naive "did the value arrive" assertion and still breaks
//     the setting permanently, because the stale key is re-copied over the user's edit on every
//     subsequent init. `re-copies over a later edit` below is the case that catches it.

import { describe, it, expect } from 'vitest'
import {
  migrateLegacyId,
  SETTING_ID_MIGRATIONS as SHIPPED,
  type SettingIdMigration,
} from '../src/modules/settings-migrations'

const TABLE: readonly SettingIdMigration[] = [
  { from: 'oldid', to: 'NewId', since: 'test', why: 'unit fixture' },
  { from: 'otherold', to: 'OtherNew', since: 'test', why: 'unit fixture' },
]

describe('migrateLegacyId', () => {
  it('moves a stored value onto the new id and reports which id it moved', () => {
    const store: Record<string, any> = { oldid: '9', untouched: 'x' }
    expect(migrateLegacyId(store, 'NewId', TABLE)).toBe('oldid')
    expect(store.NewId).toBe('9')
    expect(store.untouched).toBe('x')
  })

  it('DELETES the retired key — leaving it makes the setting permanently uneditable', () => {
    const store: Record<string, any> = { oldid: '9' }
    migrateLegacyId(store, 'NewId', TABLE)
    expect(Object.prototype.hasOwnProperty.call(store, 'oldid')).toBe(false)
    expect(Object.keys(store)).toEqual(['NewId'])
  })

  it('does not re-copy over a later edit (the whole reason the delete exists)', () => {
    const store: Record<string, any> = { oldid: '9' }
    migrateLegacyId(store, 'NewId', TABLE)
    // the user edits the setting and it is saved…
    store.NewId = '42'
    // …and every subsequent settings init re-runs the migration.
    expect(migrateLegacyId(store, 'NewId', TABLE)).toBe(null)
    expect(store.NewId).toBe('42')
  })

  it.each([
    ['false', false],
    ['zero', 0],
    ['empty string', ''],
    ['null', null],
  ])('moves a falsy stored value: %s', (_label, v) => {
    // `false` is what most boolean settings actually store, and 0 is a real multitoggle index.
    // A presence check is required here; a truthiness check drops precisely these.
    const store: Record<string, any> = { oldid: v }
    expect(migrateLegacyId(store, 'NewId', TABLE)).toBe('oldid')
    expect(store.NewId).toBe(v)
    expect(Object.prototype.hasOwnProperty.call(store, 'oldid')).toBe(false)
  })

  it('OLD WINS when both keys are present — both present means "not yet migrated"', () => {
    // Reachable in production: import a pre-rename preset or an old settings profile on top of an
    // already-migrated install. The imported value is the one the user just asked for.
    const store: Record<string, any> = { oldid: '9', NewId: '4' }
    expect(migrateLegacyId(store, 'NewId', TABLE)).toBe('oldid')
    expect(store.NewId).toBe('9')
    expect(Object.prototype.hasOwnProperty.call(store, 'oldid')).toBe(false)
  })

  it('is idempotent — a second pass over a clean store is a no-op', () => {
    const store: Record<string, any> = { oldid: '9' }
    migrateLegacyId(store, 'NewId', TABLE)
    const after = JSON.stringify(store)
    expect(migrateLegacyId(store, 'NewId', TABLE)).toBe(null)
    expect(JSON.stringify(store)).toBe(after)
  })

  it('no-ops for an id with no table row (which today is all 576 of them)', () => {
    const store: Record<string, any> = { oldid: '9' }
    expect(migrateLegacyId(store, 'SomeUnrelatedSetting', TABLE)).toBe(null)
    expect(store).toEqual({ oldid: '9' })
  })

  it('no-ops when the retired key is absent (a fresh install)', () => {
    const store: Record<string, any> = {}
    expect(migrateLegacyId(store, 'NewId', TABLE)).toBe(null)
    expect(store).toEqual({})
  })

  it('only touches the row matching the requested id', () => {
    const store: Record<string, any> = { oldid: '9', otherold: '7' }
    migrateLegacyId(store, 'NewId', TABLE)
    expect(store.NewId).toBe('9')
    expect(store.otherold).toBe('7')
    expect(store.OtherNew).toBeUndefined()
  })

  it('retags a moved RECORD so createSetting does not rebuild it into a nested object', () => {
    // The frozen preset blobs carry records like {"PrestigeBackup":{"id":"PrestigeBackup",…}}.
    // createSetting's rehydrate guard is `loaded && id == loaded.id && loaded.type === type`, so a
    // record whose .id still names the OLD key fails it and the whole object becomes the value.
    const store: Record<string, any> = { oldid: { id: 'oldid', selected: 'Dagadder' } }
    migrateLegacyId(store, 'NewId', TABLE)
    expect(store.NewId).toEqual({ id: 'NewId', selected: 'Dagadder' })
  })

  it('does not retag an array (multiValue settings store arrays, and they have no id)', () => {
    const store: Record<string, any> = { oldid: [495, 510] }
    migrateLegacyId(store, 'NewId', TABLE)
    expect(store.NewId).toEqual([495, 510])
  })

  it('is not fooled by inherited Object.prototype keys', () => {
    // The store comes straight out of JSON.parse, so `'constructor' in store` is true. A migration
    // written with `in` rather than hasOwnProperty would "move" a prototype method.
    const store: Record<string, any> = {}
    const table = [{ from: 'constructor', to: 'NewId', since: 't', why: 't' }] as const
    expect(migrateLegacyId(store, 'NewId', table)).toBe(null)
    expect(store.NewId).toBeUndefined()
  })

  it('survives a store that is not an object — it must never throw inside the boot', () => {
    expect(migrateLegacyId(null as any, 'NewId', TABLE)).toBe(null)
    expect(migrateLegacyId(undefined as any, 'NewId', TABLE)).toBe(null)
    expect(migrateLegacyId('nonsense' as any, 'NewId', TABLE)).toBe(null)
  })

  it('the shipped table is well-formed (vacuous while empty, real the moment a row lands)', () => {
    // Guards the invariants the mechanical net asserts against production, restated here so the
    // primitive's own contract does not depend on that net existing.
    const froms = SHIPPED.map((r) => r.from)
    const tos = SHIPPED.map((r) => r.to)
    expect(new Set(froms).size).toBe(froms.length)
    expect(new Set(tos).size).toBe(tos.length)
    expect(tos.filter((t) => froms.includes(t))).toEqual([]) // no chains, no cycles
    for (const r of SHIPPED) {
      expect(r.from).not.toBe(r.to)
      expect(r.since.length).toBeGreaterThan(0)
      expect(r.why.length).toBeGreaterThan(10)
    }
  })
})
