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
 * @param {{ atBundlePath: string, saveString: string, seed: number, ticks: number }} opts
 * @returns {{ tick: number, fn: string, args: unknown[] }[]}
 */
export function runTrace({ atBundlePath, saveString, seed, ticks }) {
  const { window } = bootGame({ withAutoTrimps: true, atBundlePath, saveString })
  installSeededRandom(window, seed)
  installFrozenClock(window)
  let tick = 0
  const trace = installRecorder(window, () => tick)
  for (let i = 0; i < ticks; i++) {
    tick = i
    stepWithAT(window, 1)
  }
  return trace
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
