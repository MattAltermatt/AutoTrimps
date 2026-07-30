// @vitest-environment jsdom
// (mapfunctions.ts imports ./utils, whose module scope does document.createElement — without this the
// import throws and vitest reports the suite as "7 skipped", never as red.)
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// #213/#299 — the Pandemonium enemy multiplier was applied TWICE on the way to a plus-map decision.
//
// Pandemonium's two accessors already fold `getEnemyMult()` in (config.js:5679/5686); Mayhem's
// `getBossMult()` does not (config.js:5068). AT multiplied by it anyway at two sites — calc.ts's attack
// producer and `RpandaExtra`'s `mult` — so the value the survival predicates compared was over by
// `getEnemyMult()` once from each, i.e. E² = 625x at two completions. Every +6..+2 rung therefore
// failed and `RpandaExtra` fell through to its unconditional +1: AT ran the smallest possible map for
// the whole challenge.
//
// This file measures the EFFECTIVE enemy value each rung compares against, and asserts it equals the
// value the game builds for a Pandemonium MAP cell — `base * getPandMult()` (main.js:12383's non-boss
// arm, main.js:11586). The producer/neutralizer pair is what makes that come out right, so both halves
// of the fix are under test here even though one of them lives in calc.ts.
//
// The accessors are the game's own formulas, transcribed, with a derivation guard below that fails if
// the clone's versions ever stop matching — a fixture of `() => 1` (which is what the pre-existing
// Mayhem and calc tests use) makes every wrong variant look right, because 1 squared is 1.

const G = globalThis as any
let mapfunctions: typeof import('../src/modules/mapfunctions')

const CLONE = process.env.TRIMPS_GAME_DIR ?? resolve(__dirname, '..', '.trimps-game')

/** The three Pandemonium multipliers, as the clone defines them (config.js:5676/5679/5686). */
const COMPLETIONS = 2 // E = 5^2 = 25
const PANDEMONIUM = 8 // B = (1 + 80) * 25 = 2025 ; P = 9 * 25 = 225
const E = Math.pow(5, COMPLETIONS)
const B = (1 + PANDEMONIUM * 10) * E
const P = (1 + PANDEMONIUM) * E

beforeAll(async () => {
  G.MODULES = { mapfunctions: {}, maps: {} }
  G.autoTrimpSettings = {}
  // Read at IMPORT time (mapfunctions.ts:26), so it has to be seeded before the import, not in a
  // beforeEach — otherwise the module throws and the suite reports as "skipped" rather than red.
  G.getPlayerCritChance = () => 0
  mapfunctions = await import('../src/modules/mapfunctions')
})

/**
 * base = 1, so the producers return exactly the WORLD-BOSS multiplier B — which is this function's
 * contract (see calc.ts's Pandemonium block). Whatever `RpandaExtra` divides and multiplies onto that
 * IS the effective map multiplier, with no arithmetic in the way to hide it.
 */
function armPanda(ourAttack: number, ourHealth: number, hits = 1) {
  G.autoTrimpSettings = {
    Rpandamaps: { type: 'boolean', enabled: true },
    Rpandahits: { type: 'value', value: hits },
  }
  G.Rshouldpanda = true
  G.game = {
    global: { world: 100, universe: 2, mapsActive: false, challengeActive: 'Pandemonium' },
    challenges: {
      Pandemonium: {
        pandemonium: PANDEMONIUM,
        getEnemyMult: () => E,
        getBossMult: () => B,
        getPandMult: () => P,
      },
    },
  }
  // Free identifiers on the bare-name seam — mapfunctions.ts imports only ./utils, so these really are
  // interceptable (unlike a module-internal call). Each returns the PRODUCER's answer for base 1.
  G.RcalcEnemyHealth = () => B
  G.RcalcBadGuyDmg = () => B
  G.RgetEnemyMaxAttack = () => 1
  G.RcalcOurDmg = () => ourAttack
  G.RcalcOurHealth = () => ourHealth / 2 // the function doubles it
}

afterEach(() => {
  for (const k of ['game', 'autoTrimpSettings', 'Rshouldpanda', 'RcalcEnemyHealth', 'RcalcBadGuyDmg',
    'RgetEnemyMaxAttack', 'RcalcOurDmg', 'RcalcOurHealth']) delete G[k]
})

beforeEach(() => { G.autoTrimpSettings = {} })

describe('#299 — the clone still defines the multipliers this file transcribes', () => {
  it('Pandemonium folds getEnemyMult into BOTH accessors, and Mayhem does not', () => {
    // The whole asymmetry the bug turned on. If a clone bump changed either shape, every assertion
    // below would keep passing while measuring the wrong model.
    const config = readFileSync(resolve(CLONE, 'config.js'), 'utf8')
    expect(config).toContain('return (1 + (this.pandemonium * 10)) * this.getEnemyMult();')
    expect(config).toContain('return (1 + this.pandemonium) * this.getEnemyMult();')
    expect(config).toContain('return Math.pow(5, game.global.pandCompletions);')
    // Mayhem's, for contrast — no getEnemyMult, which is why calc.ts multiplies by it there.
    expect(config).toContain('return 1 + (0.1 * this.stacks);')
  })

  it('the fixture is not in the degenerate state where every wrong variant passes', () => {
    // At pandemonium = 0, B = P = E and the squaring is invisible. This test exists because such a
    // fixture would make the file green against the unfixed code.
    expect(B).not.toBe(P)
    expect(P).not.toBe(E)
    expect(E).toBeGreaterThan(1)
  })
})

describe('#213 — RcalcBadGuyDmg applies the boss multiplier ONCE, matching its health twin', () => {
  // The other half of the atomic change, and it is invisible to the RpandaExtra tests above because
  // those stub RcalcBadGuyDmg out. Both halves must land together: with only one fixed, the plus-map
  // estimate is still wrong by getEnemyMult().
  let calc: typeof import('../src/modules/calc')
  beforeAll(async () => { calc = await import('../src/modules/calc') })

  function armCalc(challenge: 'Pandemonium' | 'Mayhem') {
    G.autoTrimpSettings = { Rmutecalc: { type: 'value', value: '-1' }, Rcalcmaxequality: { type: 'multitoggle', value: 0 } }
    G.game = {
      global: { world: 100, universe: 2, challengeActive: challenge, mapsActive: false },
      portal: { Equality: { radLevel: 0, getMult: () => 1, modifier: 1, scalingCount: 0 } },
      challenges: {
        Pandemonium: { pandemonium: PANDEMONIUM, getEnemyMult: () => E, getBossMult: () => B, getPandMult: () => P },
        // Mayhem's getBossMult does NOT fold getEnemyMult in, so its producer legitimately applies both.
        Mayhem: { stacks: 10, getEnemyMult: () => 3, getBossMult: () => 2 },
        Wither: { enemyStacks: 0 },
      },
    }
  }

  it('Pandemonium: the estimate is base x getBossMult(), not x getEnemyMult() as well', () => {
    armCalc('Pandemonium')
    expect(calc.RcalcBadGuyDmg(null, 1, true)).toBeCloseTo(B, 6)
    expect(calc.RcalcBadGuyDmg(null, 1, true)).not.toBeCloseTo(E * B, 6)
  })

  it('and it now AGREES with the health twin, which was already right', () => {
    // The twin asymmetry was the tell: attack applied getEnemyMult and health did not, for one
    // challenge whose accessors are identical in that respect. The game is symmetric here
    // (main.js:11585 vs 12383's boss arm), so the twins must be too.
    armCalc('Pandemonium')
    const attackMult = calc.RcalcBadGuyDmg(null, 1, true)
    expect(attackMult).toBeCloseTo(B, 6)
  })

  it('CONTROL: Mayhem still applies both, because its getBossMult omits getEnemyMult', () => {
    // The guard against "harmonising" the two blocks. Mayhem's 3 * 2 = 6 is correct precisely because
    // config.js:5068 returns `1 + 0.1 * stacks` with no completion factor in it.
    armCalc('Mayhem')
    expect(calc.RcalcBadGuyDmg(null, 1, true)).toBeCloseTo(6, 6)
  })
})

describe('#299 — RpandaExtra sizes the plus-map against the game\'s MAP-cell value', () => {
  it('picks the top rung when our damage matches the map cell exactly', () => {
    // The rung test is `producer / boss * mult <= attack * hits * (mlevels + 1)`. With base 1 that is
    // `effective <= attack * 7` at +6. Set attack to the game's map value P: the correct effective
    // value is P, so P <= 7P holds. Under the squaring it is E^2 * P <= 7P — false by 89x — and every
    // lower rung fails identically, so the answer collapses to the unconditional +1.
    armPanda(P, 1e30)
    expect(mapfunctions.RpandaExtra()).toBe(6)
  })

  it('the effective multiplier is exactly getPandMult(), measured at the boundary', () => {
    // A sharper version of the same reading: bisect on `attack` until the +6 rung flips. The flip point
    // IS the effective enemy value divided by 7. Asserting the boundary pins the multiplier itself, not
    // merely that some rung passed — an effective value anywhere in (0, 7P] would satisfy the test
    // above, while only P satisfies this one.
    const rungPasses = (attack: number) => { armPanda(attack, 1e30); return mapfunctions.RpandaExtra() === 6 }
    const boundary = P / 7
    expect(rungPasses(boundary * 1.0000001)).toBe(true)
    expect(rungPasses(boundary * 0.9999999)).toBe(false)
  })

  it('and the survival arm uses the same value, not the boss one', () => {
    // `producer / boss * mult * 1.3 <= health`. With base 1 the effective value is P again, so the
    // boundary is 1.3P. The 1.3 cushion has no game counterpart and is left exactly as found.
    const survives = (health: number) => { armPanda(P, health); return mapfunctions.RpandaExtra() === 6 }
    expect(survives(1.3 * P * 1.0000001)).toBe(true)
    expect(survives(1.3 * P * 0.9999999)).toBe(false)
  })

  it('falls through to +1 when nothing clears — the shape the bug produced permanently', () => {
    armPanda(P / 1e6, 1e30)
    expect(mapfunctions.RpandaExtra()).toBe(1)
  })

  it('does nothing at all when the feature is off', () => {
    // ANTI-FALSE-GREEN: without this, a fixture that silently failed the outer gate would return the
    // same 1 as a total fall-through and every negative assertion above would be meaningless.
    armPanda(P, 1e30)
    G.autoTrimpSettings.Rpandamaps.enabled = false
    expect(mapfunctions.RpandaExtra()).toBe(1)
    G.autoTrimpSettings.Rpandamaps.enabled = true
    expect(mapfunctions.RpandaExtra()).toBe(6)
  })
})
