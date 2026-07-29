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
    /** AT version + issue that shipped this row. package.json 6.0.0 predates this wave, so the issue
     *  number is what actually discriminates -- version alone cannot. */
    readonly since: string
    /** Why the id was retired. One line; it is the only record a future reader gets. */
    readonly why: string
    /**
     * Optional value rewrite applied while the value moves from `from` to `to`.
     *
     * #194 is why this exists, and the shape of that problem is worth stating because it will recur.
     * A dropdown's stored value is its LABEL, so correcting an option list can leave the same string
     * meaning two different things: `raretokeep` offered "Common" for rarity 0, and the corrected
     * list offers "Common" for rarity 1. A migration keyed on the value alone therefore CANNOT be
     * idempotent — it cannot distinguish "an old store that needs moving" from "a new store where
     * the user deliberately picked that option", so it re-fires on every boot and silently overwrites
     * the user's choice, permanently. (A value-migration table was written first and this is exactly
     * what its own test caught.)
     *
     * Riding on the id move fixes that by construction: `migrateLegacyId` DELETES the old key, so the
     * trigger is the presence of a key that a migrated store no longer has — not the value, which is
     * ambiguous. The same property that makes the id table safe makes the transform safe.
     *
     * Must be pure and total: it runs during the settings define-pass, where a throw strands the boot.
     */
    readonly transform?: (value: unknown) => unknown
}

// ⚠️ BEFORE ADDING A ROW, run `git log --all -S"createSetting('<to>'"` and confirm it is EMPTY.
// A `to` that has EVER existed as a setting id resurrects that old stored value instead of applying
// your default (#68). This is not hypothetical: `serializeSettings550()` in utils.ts carries a junk
// `"mapcutoff":4` that no build has ever defined, so the "obvious" typo fix mapcuntoff → mapcutoff
// would have handed every z550-preset user a five-year-old 4. The net refuses any `to` found in
// either frozen preset blob for exactly that reason.
export const SETTING_ID_MIGRATIONS: readonly SettingIdMigration[] = [
    // The four cut-off ids are a TYPO nobody chose ("cuntoff" for "cutoff"), and they are absent from
    // both frozen preset blobs — so once migrated, nothing re-introduces them and the delete is
    // durable. Each U1/U2 pair moves together: settings-wired derives its twin list as "id X is a twin
    // iff 'R' + X also exists", so renaming one half dissolves the pair. That assertion WAS a floor
    // (twins > 50, actual 57), which meant a dissolved pair would have stayed GREEN while silently
    // dropping the U2 half from visibility checking — hence the exact toBe(57) pin, plus a membership
    // check naming both pairs, added alongside these rows.
    { from: 'dmgcuntoff', to: 'EquipDamageCutoff', since: '6.0.0 (#151)', why: 'typo of cut-off; the AutoEquip damage threshold' },
    { from: 'Rdmgcuntoff', to: 'REquipDamageCutoff', since: '6.0.0 (#151)', why: 'typo of cut-off; U2 twin of EquipDamageCutoff' },
    { from: 'mapcuntoff', to: 'MapDamageCutoff', since: '6.0.0 (#151)', why: 'typo of cut-off; the map H:D threshold' },
    { from: 'Rmapcuntoff', to: 'RMapDamageCutoff', since: '6.0.0 (#151)', why: 'typo of cut-off; U2 twin of MapDamageCutoff' },

    // NOT `mapcutoff` for the row above, however obvious that looks: serializeSettings550() already
    // carries a junk "mapcutoff":4 that no build has ever defined, so every user who imported the
    // z550 preset holds one. Migrating onto it would hand them a five-year-old 4 in place of their
    // configured value. The mechanical net refuses any `to` found in either blob for this reason.

    // These two are in BOTH frozen blobs, which is fine and is precisely why the seam is createSetting
    // rather than boot: importing a pre-rename preset re-introduces the old key, and the very next
    // initializeAllSettings() — which an import triggers directly — migrates it again.
    // #194 — the ONLY row so far that exists for its `transform` rather than for its name. `raretokeep`
    // offered ["Any","Common","Uncommon","Rare",…] against a game whose rarities are
    // ['Basic','Common','Rare',…] (config.js:7928), so its bottom two labels were shifted by one:
    // "Common" resolved to threshold 0 — which is BASIC, i.e. it filtered nothing — and "Uncommon", a
    // rarity Trimps does not have, was the option that actually meant "Common or better".
    //
    // Correcting the list in place was not available. The corrected list still contains the string
    // "Common", now meaning rarity 1, so a value-keyed migration cannot tell an un-migrated store from
    // a new user who deliberately picked Common, and would overwrite the latter on every boot forever.
    // Riding the id move makes the trigger the OLD KEY's presence, which a migrated store no longer
    // has. `HeirloomRarityToKeep` is confirmed absent from all history and from both frozen preset
    // blobs, so it carries no #68 resurrection hazard. Net effect: every existing user keeps the exact
    // threshold they had, and only the word describing it changes. (User decision, 2026-07-28.)
    {
        from: 'raretokeep', to: 'HeirloomRarityToKeep', since: '6.0.0 (#194)',
        why: 'option list was one label short at the bottom and invented "Uncommon"; the labels now mirror game.heirlooms.rarityNames',
        transform: (v) => (v === 'Common' ? 'Basic' : v === 'Uncommon' ? 'Common' : v),
    },

    { from: 'spireshitbuy', to: 'SpirePrepGear', since: '6.0.0 (#151)', why: 'profanity; buys cheap prep gear before a Spire' },
    { from: 'fuckjobs', to: 'HideJobBoxes', since: '6.0.0 (#151)', why: 'profanity; hides the job boxes, and that is all it does' },

    // DELIBERATELY ABSENT, recorded so nobody re-derives the same wrong answer from the id alone:
    //   · `hidebuildings`  — not profane. Its name IS misleading (ON means "Gyms only", and per
    //     main-loop.ts it makes AT buy MORE than OFF, not less), but that is a LABEL defect with a
    //     free fix, not worth a migration across its four behavioural consumers and six fixtures.
    //   · `screwessence`   — "screw" is mild, and its accurate name is its existing label,
    //     "Remaining Essence Only". The proposed `IgnoreEssence` names the OFF state: reading it ON
    //     means RESPECT remaining essence. Risk with no naming gain.
    //   · `fuckanti`       — profane, but it is a PHANTOM: never createSetting'd, read nowhere, alive
    //     only inside the two frozen blobs. A migration cannot help it because there is no target to
    //     migrate to. Its disposition is cleanupCandidates(), not a rename.
]

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
        store[to] = applyTransform(retag(store[row.from], to), row.transform)
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

/**
 * Run a row's `transform` over the stored value, handling both shapes retag() does.
 *
 * A dropdown normally persists as a bare string (serializeSettings flattens the record down to its
 * `selected`), but both frozen preset blobs carry a few ids as WHOLE RECORDS — utils.ts's
 * serializeSettings60() has `"PrestigeBackup":{"selected":"Dagadder",…}` — so a transform that only
 * understood the primitive form would silently skip exactly the users who imported a preset.
 *
 * Never throws: this runs inside the settings define-pass, where a throw strands the boot. A
 * transform that fails leaves the value as it was, which is the same outcome as having no row at all.
 */
function applyTransform(value: any, transform?: (v: unknown) => unknown): any {
    if (!transform) return value
    try {
        if (value !== null && typeof value === 'object' && !Array.isArray(value) && 'selected' in value) {
            value.selected = transform(value.selected)
            return value
        }
        return transform(value)
    } catch {
        return value
    }
}
