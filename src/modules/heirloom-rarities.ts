// #194 — the heirloom rarity ladder, owned in ONE place.
//
// This is a GAME constant, mirrored: `game.heirlooms.rarityNames` (.trimps-game/config.js:7928). The
// index into it IS the rarity — `createHeirloom` builds a loom's display name as
// `rarityNames[rarity] + " " + type` (main.js:7967), and every `loom.rarity` AT compares against is
// that same index.
//
// It is a mirror rather than a live read of `game.heirlooms.rarityNames` because the consumer that
// needs it first is `createSetting`, which builds the "Rarity to Keep" dropdown during the settings
// define-pass — and that pass must produce the same option list under the unit harness (where `game`
// is a fixture) as it does in the browser. A list that changes shape with the fixture would make the
// persistence contract depend on test scaffolding. tests/nets/heirloom-rarities.test.ts pins this
// array against the clone's own config.js, so the mirror cannot drift without a red.
//
// WHAT WENT WRONG WITHOUT IT. The dropdown was hand-transcribed as
// ["Any","Common","Uncommon","Rare",…] — one label short at the bottom and one invented in the
// middle. So "Common" resolved to threshold 0, which is BASIC, and therefore behaved identically to
// "Any" (every heirloom clears `rarity >= 0`, and all of them collected the scoring bonus); while
// "Uncommon", a rarity Trimps has never had, was the option that actually meant "Common or better".
// Everything from "Rare" up happened to be correct, which is why it survived. `heirlooms.ts` then
// hand-transcribed the SAME ladder a second time as a thirteen-branch if/else chain — so the label
// list and the index mapping were two independent copies of one game-owned fact, and both are now
// derived from this array instead.
//
// ⚠️ ORDER IS THE MEANING. The position of each name is its rarity index; this is not a display list
// that can be re-sorted.

export const HEIRLOOM_RARITY_NAMES: readonly string[] = [
    'Basic',
    'Common',
    'Rare',
    'Epic',
    'Legendary',
    'Magnificent',
    'Ethereal',
    'Magmatic',
    'Plagued',
    'Radiating',
    'Hazardous',
    'Enigmatic',
    'Mutated',
] as const;

/** The "no threshold" option, which is not a rarity and so is not in the game's array. */
export const HEIRLOOM_RARITY_ANY = 'Any';

/** Every option the "Rarity to Keep" dropdown offers, in order. */
export const HEIRLOOM_RARITY_OPTIONS: readonly string[] = [HEIRLOOM_RARITY_ANY, ...HEIRLOOM_RARITY_NAMES];

/**
 * The rarity threshold a "Rarity to Keep" selection means.
 *
 * 'Any' and 'Basic' both resolve to 0 — truthfully, this time: Basic IS rarity 0, so "Basic or
 * better" and "any rarity" are the same filter. An unrecognised value (a stored pick from a build
 * whose list differed, arriving before the migration runs) resolves to 0, which is the declared
 * default's meaning and the permissive direction.
 */
export function heirloomRarityThreshold(selected: unknown): number {
    if (selected === HEIRLOOM_RARITY_ANY) return 0;
    const i = HEIRLOOM_RARITY_NAMES.indexOf(String(selected));
    return i === -1 ? 0 : i;
}
