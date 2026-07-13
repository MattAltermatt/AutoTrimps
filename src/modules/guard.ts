// #87 — THE ERROR BOUNDARY FOR mainLoop / guiLoop.
//
// Before this file existed, `legacy/AutoTrimps2.js` contained not one `try` and not one `catch`. The
// tick was a bare `setInterval(mainLoop, 100)` dispatching ~60 automations in fixed sequential order,
// so a throw in ANY one of them skipped **every automation ordered after it** — and because
// setInterval re-invokes a throwing callback unchanged, it did so again on the next tick, and every
// tick after, forever. One unguarded `equips[0][1]` in ab.ts was not "a bug in the AB solver"; it was
// a permanent, cascading outage of every U2 automation below it (buildings, jobs, portal, combat,
// stance, heirlooms, golden). That is why the crash-class bugs in review v2 were all HIGH: this loop
// was the amplifier under them.
//
// The contract, in four lines:
//
//   1. CONTAIN, DO NOT RECOVER. atGuard() makes the OTHER 59 automations run. It does NOT make the
//      throwing one work. Every mechanism fix is still required; this only stops one of them from
//      taking the whole tick hostage.
//   2. DO NOT SWALLOW. A caught error surfaces in AT's own message log (debug) AND in console.error.
//      The pre-existing `window.onerror -> console.log` path (utils.ts) is read by nobody, and a
//      boundary that hides errors is strictly worse than no boundary — it converts a loud permanent
//      outage into a quiet permanent misbehaviour.
//   3. THROTTLE. At runInterval = 100 an unguarded throw would emit ~10 log lines/sec forever. Latch
//      per-function, per-session: the FIRST failure of a given name is reported in full (message +
//      stack), and every repeat is counted but silent.
//   4. NEVER BECOME A LAUNDERING HATCH. Every catch is *counted*, and the counts are readable
//      (`atGuardErrors`). tests/sim/guard-silence.test.ts asserts the whole L0 corpus runs with ZERO
//      caught errors — so "the guard quietly ate a new crash" cannot pass CI. The guard is a shield
//      for players; in the test harness a throw must still be a failure.
//
// Note on the throttle: other-praiding.ts reaches for this pattern by hand with `failbwraid` and gets
// it wrong on one path (#83 — the AutoMaps==2 branch never latches, so it re-throws every tick). A
// hand-rolled latch per bug does not scale and is exactly what keeps going wrong. This is the one latch.

/** Per-name failure record. Bounded by the number of distinct guard names — never grows per tick. */
export interface AtGuardError {
    /** How many times this name has thrown this session. Counts every occurrence, throttle or not. */
    count: number
    /** The first failure's message — the one that was actually reported. */
    message: string
    /** The first failure's stack, when the thrown value carried one. */
    stack?: string
}

/**
 * Every guard name that has thrown this session, with its occurrence count.
 *
 * This object is the anti-laundering surface: it is published on globalThis by the bridge, the sim
 * reads it, and a corpus run that trips a guard is a RED test rather than a silently-contained crash.
 * Never make the guard quieter without asking what this map would have shown you.
 */
// (There is deliberately no atGuardReset(): the throttle latches for the life of a session, and a test
// that wants a clean latch boots a clean window. An export whose only caller is a test is dead code in
// the shipped bundle — tests/nets/reachability.test.ts (#85) is right to refuse it.)
export const atGuardErrors: Record<string, AtGuardError> = {}

/**
 * Run one mainLoop/guiLoop dispatch inside an error boundary.
 *
 * `name` is the throttle key and the label the player sees, so it must be unique per dispatch SITE
 * (not merely per function): `buyWeps` fires from three different U1 call sites, and knowing WHICH
 * one is failing is the whole value of the log line.
 */
export function atGuard(name: string, fn: () => void): void {
    try {
        fn()
    } catch (e: any) {
        const first = !atGuardErrors[name]
        const message = (e && e.message) || String(e)
        if (first) atGuardErrors[name] = { count: 1, message, stack: e && e.stack }
        else atGuardErrors[name].count++
        if (!first) return // throttled: counted, but not re-reported

        // Surfacing is best-effort on BOTH channels and must never itself take down the tick — debug()
        // reads settings and touches the DOM, so it is entirely capable of throwing during early boot.
        // A boundary whose reporter can crash the boundary is not a boundary.
        try {
            console.error(`[AutoTrimps] ${name}() threw and was skipped — the rest of the tick still ran.`, e)
        } catch {
            /* console is not load-bearing */
        }
        try {
            debug(
                `AutoTrimps: ${name}() threw and was skipped — ${message}. The rest of the tick still ran; ` +
                    `this automation is disabled until the error is fixed (further failures are silenced).`,
                'other',
            )
        } catch {
            /* the message log is not load-bearing either */
        }
    }
}
