// #107 — a settings description is a COMPOSED RECORD, not a prose blob.
//
// Every tooltip this file emits is assembled from named facets. The point is not tidiness: it is that
// the facets a user most needs (and that authors most often omit) become *structurally* present rather
// than depending on whoever wrote the sentence remembering to mention them.
//
// The four facets below exist because each maps to a defect found in the wild:
//   overwritten  — the Farmer/Lumberjack/Miner boxes are rewritten every tick in the default mode.
//                  They LOOK editable and are not. Nothing said so. (#106/#107)
//   ignoredWhen  — a setting that silently does nothing in some mode/universe/zone.
//   cannot       — the asymmetry a user would otherwise file as a bug: MaxScientists is a CAP and can
//                  only ever LOWER the count; a value above Auto does nothing.
//   noSpeedup    — #106 measured even INFINITE free science as inside the noise floor. A tooltip must
//                  not imply a speedup nobody measured.
//
// What is NOT here, deliberately: the default value. It is derived at the seam from createSetting's own
// `defaultValue` argument (settings-engine.ts `defaultFacet`), so it cannot disagree with the code.
// A description that spells out its own default is a bug — the two copies drift, and several had.
export interface Tip {
    /** One sentence: what this setting does. Required — a tooltip with no `what` says nothing. */
    what: string;
    /** Optional detail: mechanics, recommended usage, worked example. */
    how?: string;
    /** AT (or the game) writes this box itself. Full sentence stating WHEN — the condition is the whole point. */
    overwritten?: string;
    /** When this setting does nothing at all. Full sentence. */
    ignoredWhen?: string;
    /** What this setting cannot do — the asymmetry that reads as a bug if unstated. Full sentence. */
    cannot?: string;
    /** Emit the "control only, not a speedup" disclaimer. */
    noSpeedup?: boolean;
}

const NO_SPEEDUP = 'Control only — this does not make your run faster.';

/**
 * Compose a settings description. Facets render in a fixed order, most load-bearing first: a user who
 * reads only the first line should learn the thing that would otherwise waste their time.
 */
export function tip(t: Tip): string {
    const parts: string[] = [t.what];
    // Warnings before elaboration: "this box is a lie" outranks "here is how to use the box".
    if (t.overwritten) parts.push('<b>AT writes this box.</b> ' + t.overwritten);
    if (t.ignoredWhen) parts.push('<b>Ignored:</b> ' + t.ignoredWhen);
    if (t.cannot) parts.push('<b>Cannot:</b> ' + t.cannot);
    if (t.how) parts.push(t.how);
    if (t.noSpeedup) parts.push('<i>' + NO_SPEEDUP + '</i>');
    return parts.join('<br><br>');
}

/**
 * Render a live numeric table straight out of the code that owns it, e.g. the worker-ratio tiers.
 * The BuyJobsNew tooltip hand-copied `MODULES["jobs"].autoRatio1..7` and got every single tier wrong,
 * plus omitted a whole 7th tier. Interpolating from the source table makes that class of error
 * unrepresentable: edit the table and the tooltip follows.
 */
export function tierTable(rows: Array<{ when: string; ratio: readonly number[] }>): string {
    return rows.map((r) => r.ratio.join(' / ') + ' &mdash; ' + r.when).join('<br>');
}
