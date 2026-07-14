// One active-play tick. We bypass gameTimeout's wall-clock make-up loop (which would spawn
// spurious catch-up ticks under a tight loop), but MUST replicate its clock bookkeeping
// (main.js:20016-17): `game.global.time += 1000/game.settings.speed`. Without it, time-gated
// AT logic never fires — notably fightManual()'s `if (time < 1000) return` resend guard, which
// froze combat after the first army death. lastOnline = start + time holds dif=0 so no offline/
// make-up branch triggers. Tick count is still the clock; the clock is just consistent with it.
//
// checkTriggers() is the SAME SPECIES OF DEBT, and it cost us the entire metal economy (#122).
// boot.mjs stubs `window.setTimeout = () => 0` to suppress the game's self-driving loops. The game
// calls checkTriggers() from exactly one place during play — costUpdatesTimeout() (main.js:17970),
// a `setTimeout(costUpdatesTimeout, 250)` loop — so under the stub IT NEVER FIRED. Forge is a
// trigger, not an upgrade (config.js:13226, fires at >=350 metal), so Forge never unlocked, so
// metal.max stayed pinned at 500 on every save in the corpus, so Coordination (507 metal at done=2)
// was permanently unaffordable: AutoTrimps bought it ZERO times in the entire history of the proof
// net, and the deep fixtures ran metal-capped on up to 100% of their ticks.
//
// Why only this one of costUpdatesTimeout's five calls: the other four are `checkButtons(...)`,
// which resolves to updateButtonColor (DOM class swaps) + updateSRBuyAmt — and updateSRBuyAmt is a
// no-op while `usingScreenReader` is false, which boot.mjs sets. Its one call that COULD mutate,
// Archaeology.checkAutomator(), only buys when passed `makePurchase`, and checkButtons never passes
// it. They are state-pure here; cherry-picking checkTriggers is shown, not assumed. (The rest of the
// stub's casualties are autoSave, the offline replay loop — already torn down in boot per #66 — DOM
// tooltips, a Kongregate login retry, and gameTimeout itself, which this driver deliberately replaces.)
//
// Cadence: the real loop runs 4x per game-second and this runs once. For every RESOURCE-cost trigger
// — which is all of them that matter here, Forge included — that is exact, not approximate: resources
// only move inside gameLoop, so such a trigger can only become newly-affordable immediately after one.
// It is NOT exact in general, and the exception is worth knowing: two triggers have non-resource costs
// (`Lumberjack` costs `jobs: { Farmer: 1 }`, config.js:13261; `breeding`'s special cost reads
// trimps.owned - trimps.employed, :13346), and BOTH of those are moved by AT's own buyJob/hiring inside
// mainLoop() — which stepWithAT runs AFTER this call. So a trigger armed by AT's own action, rather than
// by gameLoop income, is seen one tick late. Harmless (they are one-shot latches, and a tick is 1s of
// game time), but do not generalize the "exact" claim past resource-cost triggers.
function tickOnce(window) {
  const g = window.game
  g.global.time += 1000 / g.settings.speed
  g.global.lastOnline = g.global.start + g.global.time
  window.gameLoop(null)
  window.checkTriggers()
  // #126 — deliver any timers the game scheduled this tick (stacked-void heirloom rewards are the one
  // that pays out state; the rest are DOM). boot.mjs installs the queue; timers.mjs says what it drops.
  window.__simTimers?.pump()
}

// Never gameLoop(true) (offline craft divergence). Drive the active path via tickOnce.
export function runTicks(window, count) {
  for (let i = 0; i < count; i++) tickOnce(window)
}

export function runUntil(window, predicate, maxTicks = 5_000_000) {
  let ticks = 0
  while (!predicate(window.game) && ticks < maxTicks) {
    tickOnce(window)
    ticks++
  }
  return { ticks, reached: predicate(window.game) }
}

export function ticksToZone(window, targetZone, maxTicks = 5_000_000) {
  return runUntil(window, g => g.global.world >= targetZone, maxTicks)
}

// Advance the game AND run AutoTrimps' mainLoop in lockstep (default every tick, matching
// real play's ~1 AT decision per game-tick). Requires bootGame({ withAutoTrimps: true }).
export function stepWithAT(window, ticks, atEvery = 1) {
  const mainLoop = window.mainLoop
  if (typeof mainLoop !== 'function') {
    throw new Error('AutoTrimps mainLoop not found — boot with { withAutoTrimps: true }')
  }
  for (let i = 0; i < ticks; i++) {
    tickOnce(window)
    if (i % atEvery === 0) mainLoop()
  }
}
