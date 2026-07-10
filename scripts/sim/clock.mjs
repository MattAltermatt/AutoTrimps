// Fake-clock shim for the proof-net differential. AT decision branches read wall-clock deltas
// (maps.ts preSpireFarming, jobs.ts timeOnZone, other.ts antistack); driver.mjs advances
// game.global.time but does NOT freeze new Date()/Date.now(), so those reads are non-deterministic
// and degenerate (~0) in a tight loop. This slaves the wall clock to the game's own bookkeeping:
// after install, window.Date.now() === game.global.start + game.global.time, so every read
// advances deterministically with tick count and is identical across the oracle and working builds.
export function installFrozenClock(window) {
  const g = window.game
  const now = () => (g.global.start || 0) + (g.global.time || 0)
  const RealDate = window.Date
  class FrozenDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [now()]))
    }
    static now() {
      return now()
    }
  }
  window.Date = FrozenDate
  if (window.performance) window.performance.now = () => now()
  return now
}
