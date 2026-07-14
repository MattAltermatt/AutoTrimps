// #107 — the worker-ratio tier table, owned in ONE place.
//
// These seven [Farmer, Lumberjack, Miner] presets are what "Auto Worker Ratios" writes into the three
// ratio boxes every tick. They used to live only as `MODULES["jobs"].autoRatioN` assignments, and the
// BuyJobsNew tooltip described them by HAND — getting all six documented tiers wrong, omitting the
// seventh, and implying an ordering the selector does not use. A tooltip that hand-copies a table is a
// second copy of that table, and second copies rot.
//
// So the table lives here: a pure module with no imports and no side effects, which both jobs.ts (which
// publishes it onto MODULES for the bot to read) and settings-defs.ts (which renders it into the
// tooltip) consume. Edit a number here and the tooltip follows it — being wrong is no longer
// representable.
//
// `condition` is part of the table for the same reason. It mirrors the if/else chain in workerRatios();
// keeping the prose next to the numbers it describes is the whole point of this file.
//
// ORDER IS LOAD-BEARING: workerRatios()/RworkerRatios() test these top-to-bottom and the FIRST match
// wins. That is why `world >= 300` sits above the Tribute tiers — past zone 300 it beats all of them,
// which the old tooltip's "then… then…" phrasing actively denied.

export interface RatioTier {
    /** [Farmer, Lumberjack, Miner] — unnormalised weights; only the proportions matter. */
    readonly ratio: readonly [number, number, number];
    /** When this tier is selected, in the user's terms. First match wins. */
    readonly condition: string;
    /** The `MODULES["jobs"]` key this tier is published under, for the bot's own reads. */
    readonly key: string;
}

export const RATIO_TIERS: readonly RatioTier[] = [
    { key: 'autoRatio7', ratio: [1, 1, 98], condition: 'from zone 300 (this beats every rule below)' },
    { key: 'autoRatio6', ratio: [1, 7, 12], condition: 'over 3000 Tributes, in Magma' },
    { key: 'autoRatio5', ratio: [1, 2, 22], condition: 'over 1500 Tributes' },
    { key: 'autoRatio4', ratio: [1, 1.1, 10], condition: 'over 1000 Tributes' },
    { key: 'autoRatio3', ratio: [3, 1, 4], condition: 'over 3M max Trimps' },
    { key: 'autoRatio2', ratio: [3, 3.1, 5], condition: 'over 300k max Trimps' },
    { key: 'autoRatio1', ratio: [1.1, 1.15, 1.2], condition: 'otherwise' },
] as const;

/**
 * The tier a given `MODULES["jobs"]` key names. Used by jobs.ts to publish, keeping the values
 * single-sourced. Returns a FRESH array each call: U1 and U2 previously held distinct array literals
 * (`autoRatio7` and `RautoRatio7` are both [1,1,98]) and handing both universes one shared object would
 * quietly couple them if anything ever mutated a tier in place. Nothing does today — but "nothing
 * mutates it today" is not a property worth betting the job allocator on.
 */
export function ratioFor(key: string): number[] {
    const tier = RATIO_TIERS.find((t) => t.key === key);
    if (!tier) throw new Error('unknown ratio tier: ' + key);
    return [...tier.ratio];
}
