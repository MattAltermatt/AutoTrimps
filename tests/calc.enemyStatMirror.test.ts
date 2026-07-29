// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { calcEnemyBaseHealth, calcEnemyBaseAttack } from '../src/modules/calc'

// #198/#244/#296 — AT's mirrors of the game's getEnemyHealth / getEnemyAttack.
//
// Decision 1 = A: "a mirror must match the pinned clone exactly." So the oracle is not a table of
// numbers I typed — it is the clone's own two formulas, transcribed once here and diffed across a
// grid. A hand-written expected value would just re-assert my reading of the game; a grid diff
// against the transcription catches a structural slip anywhere in the curve.

const CLONE_DIR = process.env.TRIMPS_GAME_DIR ?? '.trimps-game'
const CONFIG = resolve(CLONE_DIR, 'config.js')

/** .trimps-game/config.js:8621+ — the imp stats the two formulas multiply in. */
const BAD_GUYS: Record<string, { health: number; attack: number }> = {
  Snimp: { health: 0.8, attack: 1.05 },
  Blimp: { health: 2, attack: 1 },
  Improbability: { health: 6, attack: 1 },
}

// ── the oracle: .trimps-game/config.js getEnemyHealth / getEnemyAttack, transcribed ────────────────

function gameHealth(world: number, level: number, name: string, mapsActive = false): number {
  let amt = 0
  amt += 130 * Math.sqrt(world) * Math.pow(3.265, world / 2)
  amt -= 110
  if (world === 1 || (world === 2 && level < 10)) {
    amt *= 0.6
    amt = amt * 0.25 + amt * 0.72 * (level / 100)
  } else if (world < 60) {
    amt = amt * 0.4 + amt * 0.4 * (level / 110)
  } else {
    amt = amt * 0.5 + amt * 0.8 * (level / 100)
    amt *= Math.pow(1.1, world - 59)
  }
  if (world < 60) amt *= 0.75
  if (world > 5 && mapsActive) amt *= 1.1
  amt *= BAD_GUYS[name].health
  return amt
}

function gameAttack(world: number, level: number, name: string, mapsActive = false): number {
  let amt = 0
  amt += 50 * Math.sqrt(world) * Math.pow(3.27, world / 2)
  amt -= 10
  if (world === 1) {
    amt *= 0.35
    amt = amt * 0.2 + amt * 0.75 * (level / 100)
  } else if (world === 2) {
    amt *= 0.5
    amt = amt * 0.32 + amt * 0.68 * (level / 100)
  } else if (world < 60) {
    amt = amt * 0.375 + amt * 0.7 * (level / 100)
  } else {
    amt = amt * 0.4 + amt * 0.9 * (level / 100)
    amt *= Math.pow(1.15, world - 59)
  }
  if (world < 60) amt *= 0.85
  if (world > 6 && mapsActive) amt *= 1.1
  amt *= BAD_GUYS[name].attack
  return Math.floor(amt)
}

// ── the transcription must still match the file it claims to transcribe ────────────────────────────

describe('the clone still has the guards this oracle transcribes', () => {
  const src = readFileSync(CONFIG, 'utf8')

  it('health: `world < 60` 0.75, map `> 5`, imp gated on ignoreImpStat — NOT on world', () => {
    expect(src).toMatch(/if \(world < 60\) amt \*= 0\.75;/)
    expect(src).toMatch(/if \(world > 5 && game\.global\.mapsActive\) amt \*= 1\.1;/)
    // THE #198 CLAIM: the imp multiplier's only gate is the parameter.
    expect(src).toMatch(/if \(!ignoreImpStat\)\s*\n?\s*amt \*= game\.badGuys\[name\]\.health;/)
  })

  it('attack: `world < 60` 0.85 as its own statement, map `> 6` — the deliberate asymmetry', () => {
    expect(src).toMatch(/if \(world < 60\) amt \*= 0\.85;/)
    expect(src).toMatch(/if \(world > 6 && game\.global\.mapsActive\) amt \*= 1\.1;/)
  })

  it('anti-false-green: the file read is really config.js', () => {
    // Without this, a bad path makes every toMatch above fail loudly rather than silently — but a
    // TRUNCATED read could still satisfy some. Pin the corpus.
    expect(src.length).toBeGreaterThan(100_000)
    expect(src).toContain('getEnemyHealth: function')
    expect(src).toContain('getEnemyAttack: function')
  })
})

// ── the behavioural diff ───────────────────────────────────────────────────────────────────────────

const ZONES = [1, 2, 3, 5, 6, 7, 10, 30, 55, 58, 59, 60, 61, 62, 67, 80, 150]
const LEVELS = [1, 9, 50, 99]
const IMPS = ['Snimp', 'Blimp', 'Improbability']

beforeEach(() => {
  ;(globalThis as any).game = { badGuys: BAD_GUYS, global: { mapsActive: false } }
})

describe('calcEnemyBaseHealth matches the clone across the whole grid (#198)', () => {
  it('anti-false-green: the grid is non-empty and spans the z60 boundary', () => {
    // `bad.toEqual([])` is satisfied just as well by a grid that never ran. Pin the shape.
    expect(ZONES.length * LEVELS.length * IMPS.length).toBe(204)
    expect(ZONES.filter((z) => z < 60).length).toBeGreaterThan(0)
    expect(ZONES.filter((z) => z >= 60).length).toBeGreaterThan(0)
    expect(new Set(IMPS.map((n) => BAD_GUYS[n].health)).size).toBe(3) // three DISTINCT imp stats
  })

  it('every zone x level x imp agrees exactly', () => {
    const bad: string[] = []
    let compared = 0
    for (const z of ZONES)
      for (const l of LEVELS)
        for (const n of IMPS) {
          const got = calcEnemyBaseHealth(z, l, n)
          const want = gameHealth(z, l, n)
          compared++
          if (Math.abs(got / want - 1) > 1e-12) bad.push(`z${z} l${l} ${n}: AT=${got} game=${want} ratio=${(got / want).toFixed(6)}`)
        }
    expect(compared).toBe(204)
    expect(bad).toEqual([])
  })

  it('#198 specifically: the imp multiplier survives past z60', () => {
    // The pre-fix code trapped it inside `zone < 60`, so these three collapsed to the same number.
    const z62 = IMPS.map((n) => calcEnemyBaseHealth(62, 50, n))
    expect(new Set(z62).size).toBe(3)
    // And the ratios are exactly the imp stats — which a `zone < 60`-trapped version cannot produce.
    expect(z62[1] / z62[0]).toBeCloseTo(BAD_GUYS.Blimp.health / BAD_GUYS.Snimp.health, 10)
    expect(z62[2] / z62[0]).toBeCloseTo(BAD_GUYS.Improbability.health / BAD_GUYS.Snimp.health, 10)
  })

  it('#198: no 25% discontinuity at the z59 -> z60 break-the-planet step', () => {
    // Pre-fix, AT's step was 5.1676x where the game's is 4.1341x, purely from dropping Snimp's 0.8.
    const step = calcEnemyBaseHealth(60, 50, 'Snimp') / calcEnemyBaseHealth(59, 50, 'Snimp')
    const gameStep = gameHealth(60, 50, 'Snimp') / gameHealth(59, 50, 'Snimp')
    expect(step).toBeCloseTo(gameStep, 10)
  })
})

describe('calcEnemyBaseAttack matches the clone across the whole grid (#244, #296)', () => {
  it('every zone x level x imp agrees exactly, in world and in maps', () => {
    const bad: string[] = []
    let compared = 0
    for (const z of ZONES)
      for (const l of LEVELS)
        for (const n of IMPS)
          for (const isMap of [false, true]) {
            const got = calcEnemyBaseAttack(isMap ? 'map' : 'world', z, l, n)
            const want = gameAttack(z, l, n, isMap)
            compared++
            if (got !== want) bad.push(`z${z} l${l} ${n} ${isMap ? 'map' : 'world'}: AT=${got} game=${want}`)
          }
    expect(compared).toBe(408)
    expect(bad).toEqual([])
  })

  it('#296: zones 1 and 2 get the pre-break-planet 0.85', () => {
    // Pre-fix these were 1/0.85 = ~18% high, because 0.85 sat inside the `zone < 60` arm that
    // zones 1 and 2 never take. Compare against the same curve WITHOUT the 0.85 to prove the
    // factor is really being applied rather than the test agreeing with a coincidence.
    for (const z of [1, 2]) {
      const got = calcEnemyBaseAttack('world', z, 50, 'Snimp')
      expect(got).toBe(gameAttack(z, 50, 'Snimp'))
      expect(got).not.toBe(Math.floor(gameAttack(z, 50, 'Snimp') / 0.85))
    }
  })

  it('#244: the map x1.1 starts at level 7, not 6 — and health really does differ', () => {
    // The two thresholds genuinely differ in the game; this pins that AT no longer cross-copies them.
    expect(calcEnemyBaseAttack('map', 6, 50, 'Snimp')).toBe(calcEnemyBaseAttack('world', 6, 50, 'Snimp'))
    expect(calcEnemyBaseAttack('map', 7, 50, 'Snimp')).not.toBe(calcEnemyBaseAttack('world', 7, 50, 'Snimp'))
    // ...while the HEALTH sibling's own threshold is 5 (asserted against the clone above, and the
    // reason #298 exists rather than this test simply covering it).
    expect(gameHealth(6, 50, 'Snimp', true) / gameHealth(6, 50, 'Snimp', false)).toBeCloseTo(1.1, 10)
  })
})
