// One active-play tick. We bypass gameTimeout's wall-clock make-up loop (which would spawn
// spurious catch-up ticks under a tight loop), but MUST replicate its clock bookkeeping
// (main.js:20016-17): `game.global.time += 1000/game.settings.speed`. Without it, time-gated
// AT logic never fires — notably fightManual()'s `if (time < 1000) return` resend guard, which
// froze combat after the first army death. lastOnline = start + time holds dif=0 so no offline/
// make-up branch triggers. Tick count is still the clock; the clock is just consistent with it.
function tickOnce(window) {
  const g = window.game
  g.global.time += 1000 / g.settings.speed
  g.global.lastOnline = g.global.start + g.global.time
  window.gameLoop(null)
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
