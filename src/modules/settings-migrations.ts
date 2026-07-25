// The FIRST persisted-setting-id migration in this fork (#151 Tier B). Read this header before
// adding a row — the mechanism is small, but the failure mode is silent data loss for real users.
//
// ── WHY A MIGRATION IS NEEDED AT ALL ──────────────────────────────────────────────────────────────
// `createSetting` applies its declared default ONLY when nothing is stored: every type arm reads
// `var loaded = autoTrimpSettings[id]` and then `loaded === undefined ? defaultValue : loaded`. And
// `serializeSettings` (utils.ts) re-emits every key it finds via its `default:` fall-through, known
// type or not. So a bare id rename is a silent data-loss bug: the NEW id has nothing stored and
// takes the default, while the user's configured value sits inert in localStorage under the OLD id.
// #68 is the canonical incident in this repo.
//
// ── WHY THE SEAM IS `createSetting` AND NOT BOOT ──────────────────────────────────────────────────
// The obvious design is a one-shot pass after `loadPageVariables()`. It is wrong, because that is
// only ONE of four ways a settings store gets adopted. The other three all bypass it and go straight
// to `initializeAllSettings()`:
//   · a pasted import string          — loadAutoTrimps() → resetAutoTrimps()
//   · a saved settings PROFILE        — confirmedSwitchNow() → resetAutoTrimps(); note profiles live
//                                       in a SEPARATE localStorage key (ATSelectedSettingsProfile),
//                                       are frozen at save time, and are never rewritten — so a user
//                                       can re-inject decade-old ids at any point in the future
//   · factory reset                   — resetAutoTrimps() with no argument
// Hooking `createSetting` covers all four BY CONSTRUCTION rather than by enumerating seams and
// hoping none is ever added. It also means the migration is idempotent and unconditional: it re-runs
// on every settings init and finds nothing to do once the store is clean.
//
// ── WHY THE OLD KEY IS DELETED ────────────────────────────────────────────────────────────────────
// Copy-without-delete looks safer and is not. The stale key would be re-copied over the new id on
// EVERY subsequent init, so the user edits the setting, saves, reloads — and their edit is silently
// reverted. The setting becomes permanently uneditable. Deleting also disarms the #68 resurrection
// hazard and stops `cleanupCandidates()` listing the key forever.
//
// ── WHAT THIS DELIBERATELY DOES NOT DO ────────────────────────────────────────────────────────────
// It never throws, never logs, and never writes to localStorage. It runs inside the settings-define
// pass; a throw there strands the boot, and `debug()` is useless that early anyway. The next natural
// `saveSettings()` flushes the result — which also means a wrong migration is recoverable by simply
// not saving, instead of being destructive on the spot.

export type SettingIdMigration = {
    /** The retired id. MUST NOT be a live `createSetting` id — asserted by the net. */
    readonly from: string
    /** The current id. MUST be a live `createSetting` id — asserted by the net. */
    readonly to: string
    /** AT version that shipped this row, so the table reads as a dated log. */
    readonly since: string
    /** Why the id was retired. One line; it is the only record a future reader gets. */
    readonly why: string
}

// ⚠️ BEFORE ADDING A ROW, run `git log --all -S"createSetting('<to>'"` and confirm it is EMPTY.
// A `to` that has EVER existed as a setting id resurrects that old stored value instead of applying
// your default (#68). This is not hypothetical: `serializeSettings550()` in utils.ts carries a junk
// `"mapcutoff":4` that no build has ever defined, so the "obvious" typo fix mapcuntoff → mapcutoff
// would have handed every z550-preset user a five-year-old 4. The net refuses any `to` found in
// either frozen preset blob for exactly that reason.
export const SETTING_ID_MIGRATIONS: readonly SettingIdMigration[] = []

/**
 * Move a retired id's stored value onto its current id, in place, if the retired key is present.
 *
 * Returns the `from` id that was moved, or `null` if nothing happened. Pure with respect to
 * everything except `store`, and the table is injectable so the nets can drive it with synthetic
 * rows rather than the shipped ones.
 *
 * OLD WINS when both keys are present. "Both present" can only mean this store has not been migrated
 * yet — a migrated store no longer contains `from` — so the old key is by definition the one
 * production was actually reading. It is also what happens when a user imports a pre-rename preset
 * or an old settings profile on top of an already-migrated install, and in that case the freshly
 * imported value is the one they just asked for.
 */
export function migrateLegacyId(
    store: Record<string, any>,
    to: string,
    table: readonly SettingIdMigration[] = SETTING_ID_MIGRATIONS,
): string | null {
    if (store === null || typeof store !== 'object') return null

    // `hasOwnProperty` via the prototype, not `in` and not a bare method call: `store` comes straight
    // out of JSON.parse, so it inherits Object.prototype ('constructor' in store is true), and a
    // settings blob is attacker-adjacent enough that a stored key named 'hasOwnProperty' should not
    // be able to break the boot.
    const has = (k: string) => Object.prototype.hasOwnProperty.call(store, k)

    for (const row of table) {
        if (row.to !== to) continue
        if (!has(row.from)) continue
        store[to] = retag(store[row.from], to)
        delete store[row.from]
        return row.from
    }
    return null
}

/**
 * Persisted values are normally bare primitives — `serializeSettings` flattens each record down to
 * its `enabled`/`value`/`selected` field. A few are whole RECORDS: both frozen preset blobs carry
 * `"PrestigeBackup":{"id":"PrestigeBackup",…}`, and `serializeSettings550()` also carries `EnableAFK`
 * and `ChangeLog` that way.
 *
 * That matters here because `createSetting`'s rehydrate guard is `!(loaded && id == loaded.id &&
 * loaded.type === type)`. A record moved under a new id still carries its OLD `.id`, so the guard
 * fails, the record is rebuilt, and the WHOLE OBJECT becomes the new `enabled`/`value` — permanently
 * truthy, and then written back into localStorage nested. Retagging costs one line and closes the
 * class before it can bite. None of the currently-shipped rows move a record; this is here so that
 * the first one that does is not a bug.
 */
function retag(value: any, to: string): any {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && 'id' in value) {
        value.id = to
    }
    return value
}
