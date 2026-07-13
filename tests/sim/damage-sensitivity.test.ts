import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { TEST_BUNDLE } from './bundle'
import { runTrace, diffTraces } from '../../scripts/sim/trace.mjs'

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE NET'S OWN POSITIVE CONTROL (#98). This test breaks AutoTrimps on purpose and asserts that the
// proof net NOTICES. It is the answer to the question the project could not answer for months:
//
//     "The proof net is green. Does that mean anything?"
//
// For combat math the honest answer used to be NO. #98 measured it: with a 1,000,000x multiplier
// injected into calcOurDmg, the ENTIRE sim suite passed green — baseline-zero included. A millionfold
// damage misestimate was invisible to the repo's behavioral safety gate, so "I shipped it and the net
// stayed green" was a meaningless sentence for anything touching damage.
//
// WHY IT WAS BLIND — two causes, both now fixed, and the second is the interesting one:
//
//   1. REACH. Every corpus save decoded to world=4 with `mapsUnlocked === false`, and maps.ts:253 opens
//      `if (!game.global.mapsUnlocked || calcOurDmg(...) <= 0) { enoughDamage = true; ... return }`.
//      calcOurDmg was short-circuited out of every recorded decision. Saves 05/06/07 fix the reach.
//
//   2. SATURATION — and reach alone did NOT fix this. Even on 06 (deep, mapping, formations, calcOurDmg
//      genuinely called every tick) the 1e6x injection STILL diffed to zero. AT's damage decisions are
//      THRESHOLD predicates — `enoughDamage = (ourBaseDamage * cutoff > enemyHealth)` — and on 06 that
//      predicate is already TRUE (dmg 1528 x cutoff 4 vs enemy health 3831). Multiplying an already-true
//      predicate's input by a million leaves it true. Nothing moves. **Calling the function is not the
//      same as depending on its answer.** 08-starved-u1 exists for exactly this: damage-starved but
//      perked, so enoughDamage is FALSE on all 2000 ticks and the threshold sits UNSATURATED.
//
// So this test is a MUTATION test, not an assertion about code shape: it patches the built bundle,
// re-runs the differential, and demands a red. If someone later shallows the corpus, removes 08, or
// re-saturates its damage, this test goes red and says why — the net can never quietly go blind again.
//
// ⚠️ If you are reading this because it FAILED: do not delete it and do not weaken it. A failure here
// means the proof net has lost its ability to see combat regressions, which means every green
// baseline-zero result for damage-related code is now worthless. Fix the corpus, not the test.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const SAVES = resolve('tests/fixtures/saves')
const TRACES = resolve('tests/fixtures/traces')

// The save whose damage threshold is unsaturated. This is the ONLY fixture on which a damage buff is
// observable — see the note above, and scripts/sim/make-fixtures.mjs's 08 header.
const SENSITIVE_SAVE = '08-starved-u1'
const SEED = 1
const TICKS = 2000

/**
 * Inject a 1,000,000x damage multiplier into the BUILT bundle's calcOurDmg, on the Anticipation arm —
 * byte-for-byte the mutation #98 reported passing green. Patching the emitted bundle rather than src/
 * keeps the mutation contained to this test: nothing on disk in src/ is touched, so there is no way for
 * a positive control to escape into a commit (which is how #67's champion agent poisoned its own tree).
 */
function injectDamageBug(bundleSource: string): string {
  const fnStart = bundleSource.indexOf('function calcOurDmg2(')
  expect(fnStart, 'anchor "function calcOurDmg2(" not found — the bundle shape changed').toBeGreaterThan(-1)

  // Splice in immediately after the two Anticipation arms, i.e. right before the mapBonus block. Search
  // forward FROM calcOurDmg2 so we cannot accidentally patch a different function that also reads
  // mapBonus (RcalcOurDmg has a similar shape).
  const ANCHOR = 'if (game.global.mapBonus > 0) {'
  const at = bundleSource.indexOf(ANCHOR, fnStart)
  expect(at, `anchor "${ANCHOR}" not found inside calcOurDmg2 — the bundle shape changed`).toBeGreaterThan(-1)

  const mutant =
    bundleSource.slice(0, at) +
    'if (game.global.antiStacks > 0) number *= 1000000;\n    ' +
    bundleSource.slice(at)

  // ANTI-FALSE-GREEN. If the splice silently no-ops (anchor moved, string mismatch), the "mutant" bundle
  // is identical to the clean one, the differential correctly reports zero, and this test would conclude
  // "the net is blind" — or worse, a future refactor of the assertion would conclude the opposite. Prove
  // the patch actually landed before drawing any conclusion from the run.
  expect(mutant.length).toBeGreaterThan(bundleSource.length)
  expect(mutant).toContain('number *= 1000000')
  return mutant
}

describe('damage sensitivity — the proof net can SEE a combat regression (#98 positive control)', () => {
  const saveString = readFileSync(resolve(SAVES, `${SENSITIVE_SAVE}.txt`), 'utf8')
  const oracle = JSON.parse(readFileSync(resolve(TRACES, `${SENSITIVE_SAVE}.${SEED}.trace.json`), 'utf8'))

  // The negative control for the positive control. Without this, a harness so broken that it diverges on
  // EVERYTHING would make the test below pass for entirely the wrong reason. Assert the clean build is
  // silent on this save first, so the red we demand next is attributable to the injected bug alone.
  it('NEGATIVE control: the clean build reproduces the oracle trace exactly (diff = ∅)', () => {
    const clean = runTrace({ atBundlePath: TEST_BUNDLE, saveString, seed: SEED, ticks: TICKS })
    expect(diffTraces(oracle, clean)).toEqual([])
  }, 120_000)

  // THE ACCEPTANCE TEST for #90/#98. This is the assertion the repo did not have and needed most.
  it('POSITIVE control: a 1,000,000x damage bug makes the net go RED (it used to pass GREEN)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'at-damage-mutant-'))
    const mutantPath = join(dir, 'mutant.user.js')
    writeFileSync(mutantPath, injectDamageBug(readFileSync(TEST_BUNDLE, 'utf8')), 'utf8')

    const mutant = runTrace({ atBundlePath: mutantPath, saveString, seed: SEED, ticks: TICKS })
    const divergences = diffTraces(oracle, mutant)

    // Measured at 1542 on this fixture. Pin a floor well below it rather than the exact number: the point
    // is that the net SEES the bug, and an exact pin would turn every innocent re-record into a puzzle.
    // A floor of 100 is far above the zero this produced before 08 existed, and far below the real value.
    expect(
      divergences.length,
      'A 1,000,000x damage multiplier produced ZERO divergences. The proof net is BLIND to combat math ' +
        'again — exactly the #98 state. Do not "fix" this by deleting the test: the corpus has lost its ' +
        'unsaturated damage threshold (check that 08-starved-u1 still has enoughDamage === false).',
    ).toBeGreaterThan(100)
  }, 120_000)
})
