// A VIRTUAL TIMER QUEUE for the sim (#126).
//
// boot.mjs stubs `window.setTimeout = () => 0` to stop the game driving itself — the driver owns the
// tick. That stub is a blunt instrument, and it has now cost us two real subsystems:
//
//   #122  checkTriggers() never fired  -> Forge never unlocked -> the whole metal economy was frozen
//   #126  createHeirloom() never fired -> stacked void-map completions silently drop their rewards
//
// #122 was fixable by hand because checkTriggers is a NAMED function the driver can just call. #126 is
// not: the game schedules its heirloom rewards as ANONYMOUS closures (main.js:15679),
//
//     for (let x = 0; x < currentMapObj.stacked; x++)
//       setTimeout((function (z) { return function () { if (rewardingTimeoutHeirlooms) createHeirloom(z) } })(game.global.world), timeout * (x + 1))
//
// so there is nothing to call by name. The only honest fix is to make setTimeout actually WORK — in game
// time, deterministically, pumped by the driver.
//
// ── WHY NOT JUST LET EVERYTHING THROUGH ─────────────────────────────────────────────────────────────
// Three of the game's timers are SELF-DRIVING LOOPS, and running them would break the harness rather
// than fix it:
//
//   gameTimeout        (main.js:20002/20012/20027/20393) — re-enters the game loop. The driver exists
//                      precisely to replace it; letting it run would double-drive every tick.
//   autoSave           (main.js:41/46/20391) — LZString-compresses the whole game into localStorage on
//                      a 10s loop. Pure cost, no behaviour the net observes.
//   costUpdatesTimeout (main.js:17970) — its ONLY state-bearing call is checkTriggers(), which the
//                      driver already makes explicitly (#122). Letting it through would double-call it
//                      and also run four checkButtons() DOM sweeps every 250ms of game time, which in
//                      jsdom is enormously expensive for zero behavioural gain.
//
// So the queue runs everything EXCEPT those three, matched BY IDENTITY (not by name — the game's
// callbacks are mostly anonymous). Everything else the stub used to kill is either DOM-cosmetic (Fluffy
// tooltips, the GA indicator, goRadial) or inert here (the Kongregate login retry, screenReaderAssert
// under usingScreenReader=false) — harmless to run, and running them is more faithful than not.
//
// ⚠️ INSTALL AFTER load(). The offline-progress replay (main.js:2971) is itself a setTimeout loop, and
// boot tears it down with offlineProgress.finish(true) (#66). If the queue were live during load() that
// replay would enter it and re-drive offline progress. bootGame installs this only once the save is
// loaded and the replay is finished.

/**
 * Install a deterministic, game-time timer queue on `window`.
 *
 * Time comes from the caller (the frozen clock's now()), never Date.now(), so the queue is as
 * reproducible as the rest of the sim: the same tick count always fires the same callbacks.
 *
 * @param {any} window
 * @param {() => number} now  current GAME time in ms (game.global.start + game.global.time)
 * @returns {{ pump: () => number, pending: () => number }} pump() runs everything now due; returns how many ran.
 */
export function installVirtualTimers(window, now) {
  // The self-driving loops, by identity. Captured lazily: gameTimeout/autoSave/costUpdatesTimeout are
  // globals on `window` after the game's scripts eval, but a caller could install this earlier.
  const isSelfDriving = (fn) =>
    fn === window.gameTimeout || fn === window.autoSave || fn === window.costUpdatesTimeout

  let nextId = 1
  /** @type {Map<number, { due: number, fn: Function, args: unknown[] }>} */
  const queue = new Map()

  window.setTimeout = (fn, delay = 0, ...args) => {
    if (typeof fn !== 'function') return 0 // the game never passes a string, but don't eval one if it did
    if (isSelfDriving(fn)) return 0 // dropped on purpose — see the header
    const id = nextId++
    queue.set(id, { due: now() + (Number(delay) || 0), fn, args })
    return id
  }
  window.clearTimeout = (id) => { queue.delete(id) }

  // setInterval stays dead. Its only consumer is playerSpire's floating-text renderer
  // (playerSpire.js:2385), which mutates a local array of DOM nodes and never touches game state — and a
  // self-rescheduling interval in a pumped queue is an easy way to build an accidental infinite loop.
  window.setInterval = () => 0
  window.clearInterval = () => {}

  /** Run every callback whose game-time deadline has passed. Returns how many fired. */
  const pump = () => {
    let ran = 0
    // Re-check each pass: a callback may schedule another (the game staggers stacked-void heirlooms at
    // timeout*(x+1)). Bounded so a pathological self-rescheduling callback cannot hang the sim.
    for (let pass = 0; pass < 100; pass++) {
      const due = [...queue.entries()]
        .filter(([, t]) => t.due <= now())
        .sort((a, b) => a[1].due - b[1].due || a[0] - b[0]) // deadline, then insertion order — total and stable
      if (!due.length) break
      for (const [id, t] of due) {
        if (!queue.has(id)) continue // a previous callback in this batch may have cleared it
        queue.delete(id)
        t.fn(...t.args)
        ran++
      }
    }
    return ran
  }

  return { pump, pending: () => queue.size }
}
