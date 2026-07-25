// #151 Tier B — the mechanical net over the persisted-id migration TABLE.
//
// The unit suite (tests/settings-migrations.test.ts) proves the primitive moves values correctly.
// This one proves the DATA is sane against production reality, which is where the dangerous mistakes
// live: a typo'd target is a phantom setting, a target that has ever existed before is a #68
// resurrection, and a source that is still live silently deletes a working setting.
//
// ═══ WHY EVERY ASSERTION IS PAIRED WITH A SYNTHETIC BAD ROW ══════════════════════════════════════
// The shipped table is empty on the commit that introduces it, and small forever after. An
// `expect(offenders).toEqual([])` over an empty table passes without executing a single comparison —
// it is exactly the "gate optimized for greenness" this repo has been bitten by three times (#67, the
// lint grep that never matched, the wrapped @ts-nocheck). So each rule is expressed as a PREDICATE
// and that predicate is fed a row it must reject. The net therefore proves it can go red on the
// commit that adds it, not on some future commit that happens to introduce a bug.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SETTING_ID_MIGRATIONS, type SettingIdMigration } from '../../src/modules/settings-migrations'

const defsSrc = readFileSync(resolve('src/modules/settings-defs.ts'), 'utf8')
const utilsSrc = readFileSync(resolve('src/modules/utils.ts'), 'utf8')

/** Every id production actually declares, read from source the same way settings-wired does. */
const DEFINED = new Set([...defsSrc.matchAll(/createSetting\(\s*'([^']+)'/g)].map((m) => m[1]))

/** Every key inside the two frozen serializeSettings preset blobs. */
const BLOB_KEYS = new Set(
  [...utilsSrc.matchAll(/return '(\{".*?\})';/gs)].flatMap((m) => Object.keys(JSON.parse(m[1]))),
)

const BAD_LIVE_SOURCE: SettingIdMigration = { from: 'PauseScript', to: 'X', since: 't', why: 'synthetic' }
const BAD_PHANTOM_TARGET: SettingIdMigration = { from: 'x', to: 'NotASetting151', since: 't', why: 'synthetic' }
const BAD_BLOB_TARGET: SettingIdMigration = { from: 'mapcuntoff', to: 'mapcutoff', since: 't', why: 'synthetic' }

// ── the three rules, as predicates ────────────────────────────────────────────────────────────────
const sourceIsRetired = (r: SettingIdMigration) => !DEFINED.has(r.from)
const targetIsLive = (r: SettingIdMigration) => DEFINED.has(r.to)
const targetIsUnused = (r: SettingIdMigration) => !BLOB_KEYS.has(r.to)

describe('settings id-migration table', () => {
  it('the corpus itself is non-trivial (anti-false-green: an empty parse passes everything)', () => {
    expect(DEFINED.size).toBeGreaterThan(500)
    expect(BLOB_KEYS.size).toBeGreaterThan(200)
    expect(DEFINED.has('PauseScript')).toBe(true)
    expect(BLOB_KEYS.has('mapcutoff')).toBe(true) // the landmine this net exists to refuse
  })

  it('no `from` is still a live setting — migrating off a live id deletes a working setting', () => {
    expect(SETTING_ID_MIGRATIONS.filter((r) => !sourceIsRetired(r)).map((r) => r.from)).toEqual([])
    expect(sourceIsRetired(BAD_LIVE_SOURCE)).toBe(false) // the predicate can reject
  })

  it('every `to` is a live setting — a typo\'d target migrates a value into a phantom', () => {
    expect(SETTING_ID_MIGRATIONS.filter((r) => !targetIsLive(r)).map((r) => r.to)).toEqual([])
    expect(targetIsLive(BAD_PHANTOM_TARGET)).toBe(false)
  })

  it('no `to` appears in a frozen preset blob — that is a #68 resurrection waiting to fire', () => {
    // serializeSettings550() carries "mapcutoff":4, a key no build has ever defined. Renaming
    // mapcuntoff → mapcutoff would hand every z550-preset user a five-year-old 4 in place of their
    // configured value, because createSetting applies its default only when nothing is stored.
    expect(SETTING_ID_MIGRATIONS.filter((r) => !targetIsUnused(r)).map((r) => r.to)).toEqual([])
    expect(targetIsUnused(BAD_BLOB_TARGET)).toBe(false)
  })

  it('the seam is wired into createSetting and sits ABOVE the persisted read', () => {
    // The ordering is the whole contract: below `var loaded = autoTrimpSettings[id]` the migration is
    // a no-op, because `loaded === undefined ? defaultValue : loaded` has already chosen the default.
    // A source-text assertion is the right shape here — the behavioural proof is the boot test, but
    // this catches someone "tidying" the call to a more natural-looking place.
    const engineSrc = readFileSync(resolve('src/modules/settings-engine.ts'), 'utf8')
    const call = engineSrc.indexOf('migrateLegacyId(autoTrimpSettings, id)')
    const read = engineSrc.indexOf('var loaded = autoTrimpSettings[id]')
    expect(call).toBeGreaterThan(-1)
    expect(read).toBeGreaterThan(-1)
    expect(call).toBeLessThan(read)
  })
})
