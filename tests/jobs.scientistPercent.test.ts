// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #106 — the ScientistPercent control.
//
// WHY THE SETTING EXISTS AT ALL, since a reviewer will reasonably ask why a constant wasn't just retuned:
// no constant CAN be right. `game.global.playerModifier` DOUBLES with every Speedbook while a scientist's
// output is flat within a run, so the divisor at which scientists out-produce the player's own hands
// HALVES every Speedbook — measured on a real save, the "correct" divisor spans 7772 -> 0.47 inside a
// single run. 25 is right for about one Speedbook's worth of the game. A fixed ratio cannot track an
// exponential, which is why this is a user control and not a better number.
//
// ⚠️ AND IT IS NOT A SPEEDUP. 8 seeds x 20,000 ticks on a real save: even INFINITE free science is -5.1%
// against a +/-3.5% noise floor. The tooltip says so. Do not let a future change quietly imply otherwise.
//
// The three guards below are each a bug this repo has ALREADY shipped once, so they are the priority:
//   NaN  -> Auto, never "zero scientists"  (the #96 class: a non-numeric default coercing to NaN and
//                                           reading as a legitimate "off", silently, forever)
//   100  -> clamped                        (D = 0 => floor(TDW/0) = Infinity => safeBuyJob(Infinity)
//                                           and F/L/M go NaN — the bot is destroyed)
//   0    -> a LEGITIMATE "no scientists"   (must not be confused with the NaN case)

let jobs: typeof import('../src/modules/jobs')
const g = () => globalThis as any

beforeAll(async () => {
  g().MODULES = {}
  g().autoTrimpSettings = {}
  g().game = { global: {}, jobs: {}, resources: {} }
  jobs = await import('../src/modules/jobs')
})

beforeEach(() => {
  g().autoTrimpSettings = {}
})

const LEGACY = 25 // the everyday divisor the pre-#106 table would have chosen

describe('#106 scientistDivisor — the percentage → divisor mapping', () => {
  it('D = (100 - s) / s, so s% of the workforce ends up as scientists', () => {
    // Scientists sit OUTSIDE totalDistributableWorkers, so with pool P = TDW + S the fixed point is
    // S = P/(D+1). Hence D = (100-s)/s gives exactly s%. Spot-check the identity end to end.
    for (const s of [1, 5, 10, 25, 50, 90]) {
      const D = jobs.scientistDivisor(s, LEGACY)
      expect(D).toBeCloseTo((100 - s) / s, 10)
      // …and the fixed point really is s% of the pool:
      expect((1 / (D + 1)) * 100).toBeCloseTo(s, 10)
    }
  })

  it('the LEGACY constants back-map to sensible percentages (the sanity check on the parameterisation)', () => {
    // If the mapping is right, today's hardcoded divisors must correspond to plausible shares. They do —
    // and this is the evidence that a percentage is the correct unit rather than a re-skin of a divisor.
    const share = (D: number) => (1 / (D + 1)) * 100
    expect(share(25)).toBeCloseTo(3.85, 2)   // the everyday default
    expect(share(10)).toBeCloseTo(9.09, 2)   // Farmer < 100, and Watch
    expect(share(100)).toBeCloseTo(0.99, 2)  // world >= 300
  })

  it('5% (the user\'s stated want) => D = 19', () => {
    expect(jobs.scientistDivisor(5, LEGACY)).toBe(19)
  })
})

describe('#106 scientistDivisor — the three guards', () => {
  it('AUTO (-1) falls back to whatever the legacy table chose — this is what makes the default byte-identical', () => {
    expect(jobs.scientistDivisor(-1, 25)).toBe(25)
    expect(jobs.scientistDivisor(-1, 10)).toBe(10)   // the Farmer<100 / Watch arm
    expect(jobs.scientistDivisor(-1, 100)).toBe(100) // the world>=300 arm
  })

  it('🚨 GUARD 1 — a NaN / blank / "undefined" value means AUTO, never zero scientists', () => {
    // THE #96 BUG, aimed at this setting. `parseFloat('')` and `parseFloat('undefined')` are NaN, and
    // `NaN > 0` is false — so a naive `pct > 0 ? … : legacy` check would look correct and silently hire
    // ZERO scientists forever on an empty box. Falling back to the legacy divisor is the only safe read.
    expect(jobs.scientistDivisor(NaN, LEGACY)).toBe(LEGACY)
    expect(jobs.scientistDivisor(parseFloat(''), LEGACY)).toBe(LEGACY)
    expect(jobs.scientistDivisor(parseFloat('undefined'), LEGACY)).toBe(LEGACY)
    expect(jobs.scientistDivisor(Infinity, LEGACY)).toBe(LEGACY)
    expect(jobs.scientistDivisor(-Infinity, LEGACY)).toBe(LEGACY)
    // …and anti-vacuous: it is NOT just returning LEGACY for everything.
    expect(jobs.scientistDivisor(5, LEGACY)).not.toBe(LEGACY)
  })

  it('🚨 GUARD 2 — s = 100 is CLAMPED (D = 0 would mean Infinity scientists and NaN workers)', () => {
    // floor(TDW / 0) === Infinity => safeBuyJob('Scientist', Infinity), and every F/L/M target goes NaN.
    // This is the one input that can destroy the bot outright, so pin that it can never produce D = 0.
    for (const s of [90, 95, 100, 1000]) {
      const D = jobs.scientistDivisor(s, LEGACY)
      expect(D).toBeGreaterThan(0)
      expect(Number.isFinite(D)).toBe(true)
      expect(D).toBe((100 - 90) / 90) // all clamp to the 90% ceiling
    }
  })

  it('GUARD 3 — s = 0 is a LEGITIMATE "hire no scientists", and is NOT the NaN case', () => {
    // Infinity is the correct divisor here: floor(TDW / Infinity) === 0. It must be distinguishable from
    // guard 1 — a user who types 0 means it; a user with an empty box does not.
    expect(jobs.scientistDivisor(0, LEGACY)).toBe(Infinity)
    expect(Math.floor(1000 / jobs.scientistDivisor(0, LEGACY))).toBe(0)
    expect(jobs.scientistDivisor(0, LEGACY)).not.toBe(jobs.scientistDivisor(NaN, LEGACY))
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// The two behaviours the POSITIVE CONTROL discovered — both would otherwise be user-visible lies.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('#106 — what the setting can and cannot do (found by running it, not by reading it)', () => {
  it('🪤 THE RATCHET: the target can only ever RAISE the count, because buyJobs never FIRES scientists', () => {
    // Every scientist hire in buyJobs is gated on `buyScientists > 0`; there is no safeFireJob('Scientist')
    // anywhere in the U1 path (only U2's RbuyJobs has RsafeFireJob). So a target BELOW the current count
    // computes negative and does nothing at all.
    //
    // This is not academic — it is what made the first positive control read as a FAILURE. On every corpus
    // save Farmer < 100, so Auto uses divisor 10 = 9.09%; asking for 5% is asking for FEWER, and fewer is
    // unreachable. The setting looked inert. It was not: it was being asked to do the one thing it cannot.
    //
    // Pin the arithmetic that makes it so, and keep the tooltip honest about it.
    const pool = 1000
    const autoTarget = Math.floor(pool / jobs.scientistDivisor(-1, 10))  // Auto @ divisor 10 -> 100
    const lowTarget = Math.floor(pool / jobs.scientistDivisor(5, 10))    // 5% -> D=19 -> 52
    const highTarget = Math.floor(pool / jobs.scientistDivisor(25, 10))  // 25% -> D=3 -> 333

    expect(lowTarget).toBeLessThan(autoTarget)    // asking for less than Auto...
    expect(highTarget).toBeGreaterThan(autoTarget) // ...vs asking for more.
    // With `owned` already at Auto's level, only the HIGHER target yields a positive buy.
    expect(lowTarget - autoTarget).toBeLessThan(0)     // negative => no hire => no visible change
    expect(highTarget - autoTarget).toBeGreaterThan(0) // positive => hires => the trace moves
  })

  it('0 must mean ZERO — the bootstrap floor has to respect it, or the setting lies', () => {
    // jobs.ts hires 1 scientist/tick up to 10 REGARDLESS of the ratio (the `Scientist.owned < 10` arm).
    // Measured: with ScientistPercent = 0 the bot still ended up with 10 scientists — while the tooltip
    // said "hire no Scientists". The bootstrap now checks ScientistPercent too. This test pins the
    // arithmetic half; the gate itself is asserted in the live sim (see the #106 positive control).
    expect(jobs.scientistDivisor(0, 10)).toBe(Infinity)
    expect(Math.floor(500 / jobs.scientistDivisor(0, 10))).toBe(0)
  })
})
