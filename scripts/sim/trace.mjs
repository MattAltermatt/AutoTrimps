// The differential runner: boot a given AutoTrimps build against a save under a fixed seed +
// frozen clock, self-play N ticks, and return the recorded native-mutator action trace. Diffing
// two traces (oracle build vs working build) under identical inputs isolates any behavior change
// to the refactor — every jsdom/clock/RNG detail is identical across both and cancels.
import { bootGame } from './boot.mjs'
import { installFrozenClock } from './clock.mjs'
import { installSeededRandom } from './seededRandom.mjs'
import { installRecorder } from './recorder.mjs'
import { stepWithAT } from './driver.mjs'

/**
 * @param {{ atBundlePath: string, saveString: string, seed: number, ticks: number, atSettings?: Record<string, unknown> }} opts
 * @returns {{ tick: number, fn: string, args: unknown[] }[]}
 */
export function runTrace({ atBundlePath, saveString, seed, ticks, atSettings }) {
  const { window } = bootGame({ withAutoTrimps: true, atBundlePath, saveString, atSettings })
  installSeededRandom(window, seed)
  installFrozenClock(window)
  let tick = 0
  const trace = installRecorder(window, () => tick)
  for (let i = 0; i < ticks; i++) {
    tick = i
    stepWithAT(window, 1)
  }
  assertNoGuardedCrash(window, saveString, seed)
  return trace
}

/**
 * #87 — THE ERROR BOUNDARY MUST NOT BECOME A LAUNDERING HATCH.
 *
 * atGuard() exists so a throw in one automation cannot decapitate the tick for a PLAYER. But the same
 * mechanism, left unattended, would quietly absorb a crash in the TEST HARNESS — and a swallowed crash
 * is a trace recorded from a half-dead AT. That is worse than the bug it fixes: before #87 a throw at
 * least propagated out of mainLoop() and blew the sim up loudly (driver.mjs calls mainLoop() with no
 * try/catch, which is exactly why the corpus was known to be throw-free).
 *
 * So the harness re-arms the alarm the boundary disarms: any guard that fires during a traced run is a
 * hard failure, at the point of recording. A crash cannot be recorded into an oracle, and it cannot be
 * diffed to a green baseline-zero. In production, contain. In the net, still explode.
 */
function assertNoGuardedCrash(window, saveString, seed) {
  const errs = window.atGuardErrors
  // Anti-false-green: if the bundle HAS the boundary, it must have the receipts too. An atGuardErrors
  // that went missing (a bridge regression, a rename) would otherwise make this check pass vacuously
  // forever — the #66 shape, where a blind harness reports green.
  if (typeof window.atGuard !== 'function') return // an older bundle (the committed oracle) — nothing to read
  if (!errs || typeof errs !== 'object') {
    throw new Error(
      'sim: the bundle exports atGuard() but not atGuardErrors — the #87 crash check cannot see anything. ' +
        'Check that src/modules/guard.ts is still spread by legacy-bridge.ts.',
    )
  }
  const names = Object.keys(errs)
  if (names.length === 0) return
  const detail = names.map((n) => `  ${n}() x${errs[n].count} — ${errs[n].message}`).join('\n')
  throw new Error(
    `sim: AutoTrimps THREW during a traced run (seed ${seed}, save ${saveString.length} chars). atGuard() ` +
      `contained it — which is right for a player and WRONG for a recorded trace: the run continued with ` +
      `that automation dead, so every event after it is the behavior of a broken AT.\n${detail}\n` +
      `Fix the throw. Do NOT relax this check, and do NOT record an oracle over it.`,
  )
}

/**
 * Ordered divergences between an oracle trace and a working trace. Empty ⇒ behavior-identical.
 * @param {{tick:number,fn:string,args:unknown[]}[]} oracle
 * @param {{tick:number,fn:string,args:unknown[]}[]} working
 * @returns {{ index: number, oracle: unknown, working: unknown }[]}
 */
export function diffTraces(oracle, working) {
  const out = []
  const n = Math.max(oracle.length, working.length)
  for (let i = 0; i < n; i++) {
    const a = oracle[i]
    const b = working[i]
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ index: i, oracle: a ?? null, working: b ?? null })
  }
  return out
}
