// Records AutoTrimps' externally-observable decisions: the ordered sequence of native game
// mutators it calls. The whole bot's behavior bottoms out in these ~10 functions, so wrapping
// them fingerprints every module at one seam that is INVARIANT under internal refactoring —
// the property that lets the differential survive code moving across module boundaries.
//
// #90 — `buyMap` and `recycleBelow` were MISSING, and their absence is why the map half of the bot
// looked unreachable. The issue framed the hole as "4 of 8 mutators never fire" and diagnosed it as
// pure corpus depth. It is BOTH, and the recorder half was the bigger miss: AT creates every map it
// runs through `buyMap()` (38 callsites across maps.ts / mapfunctions.ts / mapfunctions-amp.ts) and
// mass-recycles through `recycleBelow(true)` (3 callsites). NEITHER was wrapped. Meanwhile the
// `recycleMap` that WAS wrapped is only the rare cap-corner fallback — AT reaches it only when
// `buyMap()` returns -2 twice, i.e. at the game's 100-map cap (main.js:6597), so it stays legitimately
// unfired on any sane corpus. Wrapping the wrong function and then blaming the saves is the exact
// shape of the #66 mistake: a coverage gap is a HYPOTHESIS until you check that the code path is even
// being watched.
export const MUTATORS = [
  'buyJob', 'buyBuilding', 'buyUpgrade', 'buyEquipment',
  'buyMap', 'selectMap', 'runMap', 'recycleMap', 'recycleBelow', 'setFormation',
]

// Stable, JSON-comparable arg capture (object args → their JSON form).
const norm = (args) => args.map((x) => (x && typeof x === 'object') ? JSON.stringify(x) : x)

/**
 * Wrap the native mutators on `window`; each call pushes `{ tick, fn, args }` onto the returned
 * trace, then delegates to the original. `getTick` supplies the current tick index.
 * @param {any} window
 * @param {() => number} getTick
 * @returns {{ tick: number, fn: string, args: unknown[] }[]}
 */
export function installRecorder(window, getTick) {
  const trace = []
  for (const fn of MUTATORS) {
    const orig = window[fn]
    // THROW, don't skip. This used to `continue` past any name that wasn't a function — a silent
    // hole of exactly the #67 shape: misspell a mutator, or let the game rename one upstream, and the
    // recorder just quietly stops watching it. The net would stay green while going blind, which is
    // the one failure mode it must never have. If a mutator is missing, the harness is broken; say so.
    if (typeof orig !== 'function') {
      throw new Error(
        `[recorder] native mutator '${fn}' is not a function on window (got ${typeof orig}). The game ` +
          'may have renamed it, or the bundle failed to boot. Refusing to record a trace that silently ' +
          'omits a mutator — fix the name in MUTATORS or the boot, do not skip it.',
      )
    }
    window[fn] = function (...args) {
      trace.push({ tick: getTick(), fn, args: norm(args) })
      return orig.apply(this, args)
    }
  }
  return trace
}
