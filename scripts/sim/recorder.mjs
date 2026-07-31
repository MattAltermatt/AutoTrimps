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
// #196 — `setGather` unblinds gather.ts (384 lines), which had NO mutator terminus and therefore no
// visibility at all. It needed no new fixture: AT already calls it on 100% of the corpus. What it
// needed was the right RECORDING SEMANTICS — see DEDUPE_ON_CHANGE below.
// #313 — `addGeneticist` / `removeGeneticist` are ATGA2()'s ONLY outputs (breedtimer.ts:202/210), and
// neither routes through `buyJob`: both mutate `game.jobs.Geneticist.owned` directly (main.js:5282/5287).
// So until they were wrapped, every hire and fire the Geneticist servo made was invisible here, and any
// census row aimed at the breed timer would have returned BLIND with nothing listening — the #90 shape
// verbatim ("of course they recorded zero events"). AT calls them as free identifiers, which resolve
// through globalThis, so wrapping `window` does intercept them; that is NOT true of a converted module's
// internal calls (#127), and the distinction is why this works.
export const MUTATORS = [
  'buyJob', 'buyBuilding', 'buyUpgrade', 'buyEquipment',
  'buyMap', 'selectMap', 'runMap', 'recycleMap', 'recycleBelow', 'setFormation',
  'setGather',
  'addGeneticist', 'removeGeneticist',
]

// Mutators recorded only when their arguments CHANGE from the previous recorded call.
//
// AT re-asserts the gather target every single tick, so `setGather` fires exactly `ticks` times per
// run — measured 1500/1500 on every fixture — while taking only two or three distinct values ever.
// Recording all of them would add ~31,500 near-identical rows across the corpus and drown the
// signal in re-assertions; the DECISION AT actually makes is the transition sequence
// (trimps -> buildings -> metal -> ...), measured at 10-225 per run.
//
// This is deliberately a NARROW, DECLARED exception rather than a general "compress the trace"
// behaviour: everything not named here is still recorded call-for-call, because for the buy/map
// mutators repetition IS information (buying the same building twice is not the same as once).
export const DEDUPE_ON_CHANGE = new Set(['setGather'])

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
  /** last recorded args per DEDUPE_ON_CHANGE mutator, so a re-assertion is not recorded twice */
  const lastArgs = new Map()
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
      const a = norm(args)
      if (DEDUPE_ON_CHANGE.has(fn)) {
        const key = JSON.stringify(a)
        if (lastArgs.get(fn) === key) return orig.apply(this, args)
        lastArgs.set(fn, key)
      }
      trace.push({ tick: getTick(), fn, args: a })
      return orig.apply(this, args)
    }
  }
  return trace
}
