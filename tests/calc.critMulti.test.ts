// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { expectedCritMulti, getCritMulti } from '../src/modules/calc'

// #199/#212/#295 — the crit multiplier.
//
// The oracle here is not a hand-computed constant: it is the game's OWN rolling code, transcribed
// from .trimps-game/main.js:15833-15859 and sampled. `expectedCritMulti` claims to be the mean of
// that process, so the test asserts exactly that claim, over a spread of regimes. A closed-form
// test against numbers I derived myself would just re-assert my own reading of the game.

/** Deterministic RNG so a failure is reproducible and the suite never flakes. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** .trimps-game/main.js:16506 — `base ** (critTier - 1)`, with base 5 and no Fluffy/talent bonus. */
const MEGA_BASE = 5
function gameMegaCritDamageMult(critTier: number): number {
  return Math.pow(MEGA_BASE, critTier - 1)
}

/**
 * ONE attack's crit multiplier, transcribed verbatim from main.js:15833-15859.
 * This is the process `expectedCritMulti` must be the mean of.
 */
function gameRollOnce(critChance: number, critD: number, doubleCritChance: number, rng: () => number): number {
  let mult = 1
  let critTier = 0
  let chance = critChance

  if (chance > 0) {
    critTier = Math.floor(chance)
    chance = chance % 1
    if (rng() < chance) critTier++
    if (doubleCritChance > 0 && rng() < doubleCritChance) critTier++
    if (critTier > 0) {
      mult *= critD
      if (critTier > 1) mult *= gameMegaCritDamageMult(critTier)
    }
  }

  if (critChance < 0) {
    if (rng() < Math.abs(critChance)) mult *= 0.2
  }

  return mult
}

function sampleMean(critChance: number, critD: number, doubleCritChance: number, seed: number): number {
  const rng = mulberry32(seed)
  const N = 400_000
  let total = 0
  for (let i = 0; i < N; i++) total += gameRollOnce(critChance, critD, doubleCritChance, rng)
  return total / N
}

beforeEach(() => {
  ;(globalThis as any).getMegaCritDamageMult = gameMegaCritDamageMult
})

describe('expectedCritMulti is the mean of the game\'s own roll', () => {
  const CASES: Array<[string, number, number, number]> = [
    // label                          critChance  critD  doubleCritChance
    ['no crits at all',                      0,      4,    0],
    ['sub-tier-1 (the #199 regime)',       0.4,      4,    0],
    ['sub-tier-1, critD 1',                0.4,      1,    0],
    ['exactly tier 1',                       1,      4,    0],
    ['tier 1 to 2',                        1.5,      4,    0],
    ['deep tiers',                         3.25,     6,    0],
    ['capped tier',                          9,      6,    0],
    ['double crit from tier 0',            0.4,      4,   0.3],
    ['double crit from tier 1',            1.4,      4,   0.3],
    ['double crit, certain',               0.5,      4,    1],
    ['negative (the #295 regime)',        -0.3,      4,    0],
    ['negative, deep',                    -0.9,      4,    0],
  ]

  it.each(CASES)('%s', (_label, critChance, critD, doubleCritChance) => {
    const predicted = expectedCritMulti(critChance, critD, doubleCritChance)
    const observed = sampleMean(critChance, critD, doubleCritChance, 12345)
    // 1.5% of the observed mean: comfortably inside sampling error at N=400k, far tighter than any
    // of the defects under test (#199 is a 5x error, #295 a 20% one).
    expect(Math.abs(predicted - observed) / observed).toBeLessThan(0.015)
  })
})

describe('the specific defects, named', () => {
  it('#199: a non-crit is priced at 1, not getMegaCritDamageMult(0) = 0.2', () => {
    // critChance 0 means the game never enters the crit branch: the multiplier is exactly 1.
    expect(expectedCritMulti(0, 4, 0)).toBe(1)
    // And just below tier 1, the floor arm must contribute 1 per non-crit — not 0.2 * critD.
    // Old formula: (1-0.4)*megaCrit(0) + 0.4*megaCrit(1) = 0.6*0.2 + 0.4*1 = 0.52, times critD 1 = 0.52.
    expect(expectedCritMulti(0.4, 1, 0)).toBeCloseTo(0.6 * 1 + 0.4 * 1, 10)
    expect(expectedCritMulti(0.4, 1, 0)).toBe(1)
  })

  it('#199: getMegaCritDamageMult is never called below tier 1', () => {
    const seen: number[] = []
    ;(globalThis as any).getMegaCritDamageMult = (t: number) => { seen.push(t); return gameMegaCritDamageMult(t) }
    for (const c of [-0.9, -0.3, 0, 0.4, 1, 1.5, 3.25, 9]) expectedCritMulti(c, 4, 0.3)
    expect(seen.length).toBeGreaterThan(0)          // anti-false-green: it IS called somewhere
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(1)
  })

  it('#295: a negative crit chance is a 0.2 penalty roll, never a negative tier', () => {
    expect(expectedCritMulti(-0.3, 4, 0)).toBeCloseTo(0.3 * 0.2 + 0.7, 10)
    // Never below the game's floor of 0.2, and never above 1 — a penalty cannot become a bonus.
    for (const c of [-0.05, -0.5, -1, -3]) {
      const m = expectedCritMulti(c, 4, 0)
      expect(m).toBeGreaterThanOrEqual(0.2)
      expect(m).toBeLessThanOrEqual(1)
    }
  })

  it('#295: critD does not leak into the negative arm', () => {
    // The game multiplies by 0.2 and never touches critDamage when critChance < 0.
    expect(expectedCritMulti(-0.4, 1, 0)).toBe(expectedCritMulti(-0.4, 99, 0))
  })
})

describe('#212: the high-damage-shield swap is gated on `high`', () => {
  // The branch's observable effect is that it CALLS highDamageShield(), which writes globalThis
  // critCC / critDD / trimpAA. Asserting the returned number would be silent here: the fixture's
  // getPlayerCritChance is the same function highDamageShield reads, so the swap is numerically a
  // no-op and a return-value test would pass against both the fixed and the broken build.
  const SENTINEL = -999

  beforeEach(() => {
    ;(globalThis as any).game = {
      global: { challengeActive: 'Daily', ShieldEquipped: { name: 'shieldA' } },
    }
    // Every precondition of the Daily arm is SATISFIED, so `high` is the only thing that can stop it.
    ;(globalThis as any).autoTrimpSettings = {
      use3daily: { type: 'boolean', enabled: true },
      dhighdmg: { type: 'textValue', value: 'shieldA' },
      AutoStance: { type: 'multitoggle', value: '3' },
      highdmg: { type: 'textValue', value: 'shieldA' },
    }
    ;(globalThis as any).textSettingIsSet = () => true
    ;(globalThis as any).getPlayerCritChance = () => 0.4
    ;(globalThis as any).getPlayerCritDamageMult = () => 4
    ;(globalThis as any).getPlayerDoubleCritChance = () => 0
    ;(globalThis as any).calcHeirloomBonus = () => 0
    ;(globalThis as any).critCC = SENTINEL
    ;(globalThis as any).critDD = SENTINEL
    ;(globalThis as any).trimpAA = SENTINEL
  })

  it('does NOT call highDamageShield when high is false', () => {
    getCritMulti(false)
    expect((globalThis as any).critCC).toBe(SENTINEL)
    expect((globalThis as any).critDD).toBe(SENTINEL)
    expect((globalThis as any).trimpAA).toBe(SENTINEL)
  })

  it('does NOT call it when high is omitted entirely', () => {
    getCritMulti()
    expect((globalThis as any).critCC).toBe(SENTINEL)
  })

  it('DOES call it when high is true — the gate is real, not just always-off', () => {
    // Drives the OTHER starting state. A test that only proved "false does nothing" would pass just
    // as well against a build with the branch deleted outright.
    getCritMulti(true)
    expect((globalThis as any).critCC).toBe(0.4)
    expect((globalThis as any).critDD).toBe(4)
    expect((globalThis as any).trimpAA).not.toBe(SENTINEL)
  })

  it('is gated per-arm: the non-Daily arm stays shut during a Daily even when high is true', () => {
    ;(globalThis as any).autoTrimpSettings.use3daily = { type: 'boolean', enabled: false }
    getCritMulti(true)
    // AutoStance==3 && highdmg is set, but challengeActive IS "Daily", so neither arm may fire.
    expect((globalThis as any).critCC).toBe(SENTINEL)
  })
})
