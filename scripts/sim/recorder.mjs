// Records AutoTrimps' externally-observable decisions: the ordered sequence of native game
// mutators it calls. The whole bot's behavior bottoms out in these ~8 functions, so wrapping
// them fingerprints every module at one seam that is INVARIANT under internal refactoring —
// the property that lets the differential survive code moving across module boundaries.
const MUTATORS = ['buyJob', 'buyBuilding', 'buyUpgrade', 'runMap', 'selectMap', 'buyEquipment', 'setFormation', 'recycleMap']

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
    if (typeof orig !== 'function') continue
    window[fn] = function (...args) {
      trace.push({ tick: getTick(), fn, args: norm(args) })
      return orig.apply(this, args)
    }
  }
  return trace
}
