import { describe, it, expect } from 'vitest'
import { coverageFromTraces, ALL_MUTATORS } from '../../scripts/sim/coverage.mjs'
import { MUTATORS } from '../../scripts/sim/recorder.mjs'

// Makes the proof-net's REAL coverage loud instead of implied. The differential (baseline-zero) only
// guards decisions that reach a native mutator the corpus exercises; everything else is invisible to
// it. This pins that reach so BOTH directions are caught: a degenerate re-record that quietly drops a
// mutator (coverage LOSS) fails here, and a new/deeper save that reaches a new mutator (coverage GAIN)
// also fails here — prompting a celebratory pin update rather than silently shifting the net's scope.
// Reads only committed traces, so it is fast and needs no boot.
//
// ⚠️ #66 — THESE PINS ONCE ENSHRINED A BUG. An older version asserted buyEquipment was uncovered and
// explained it away as an honest corpus-depth gap: "the corpus is early-U1 ... so it NEVER ... buys
// equipment". That reasoning was WRONG. AT was not failing to reach the gear code because the saves
// were shallow — it was because scripts/sim/boot.mjs left `usingRealTimeOffline` stuck true, so AT's
// mainLoop skipped autoLevelEquipment() on EVERY run (#66). The "documented gap" wording made a harness
// bug read as a considered design decision, and this test then locked it in place.
//
// ⚠️ #90/#98 — AND THEN IT HAPPENED AGAIN, IN THIS EXACT FILE. The version this one replaces asserted
//     it('does NOT exercise map/formation mutators (corpus-depth gap)')
//     expect(uncovered).toEqual(['runMap', 'selectMap', 'setFormation', 'recycleMap'])
// and called it "genuinely corpus-depth". It was not genuinely anything — it was TWO unverified
// hypotheses wearing a passing assertion as a disguise:
//   1. The recorder was watching the WRONG FUNCTIONS. AT creates every map it runs via `buyMap()` (38
//      callsites) and mass-recycles via `recycleBelow()` (3). NEITHER was in MUTATORS. Of course they
//      recorded zero events — nothing was listening. And the `recycleMap` that WAS wrapped is only the
//      cap-corner fallback, so it was never going to fire on an ordinary save.
//   2. The corpus could not reach maps AT ALL: all four saves have `mapsUnlocked === false`, and
//      maps.ts:253 short-circuits the `calcOurDmg` call entirely in that state. So the net was blind to
//      combat math, and #98 proved it: a 1,000,000x damage multiplier passed the whole sim suite GREEN.
// Both are fixed. The corpus now reaches 10/10 mutators, and the 1e6x control goes RED.
//
// THE RULE, since twice is a pattern: an uncovered mutator is a HYPOTHESIS, never a fact — and
// "corpus-depth gap" is the most seductive way to write a hypothesis down as a fact. Before that phrase
// goes into this file again, check (a) that the recorder actually wraps the function AT calls, and (b)
// that some save actually reaches the code. Then prove it by MUTATION: break the thing and watch the
// net go red. Reading cannot establish this; only running can.
describe('corpus mutator coverage (loud, pinned)', () => {
  const { perSave, counts, union, uncovered } = coverageFromTraces()

  it('coverage.mjs mirrors the recorder — the two lists cannot drift', () => {
    expect(ALL_MUTATORS).toEqual([...MUTATORS])
  })

  // THE TRIPWIRE. Every mutator the recorder wraps must actually fire somewhere in the corpus. This is
  // the assertion the old file could not make, and it is the one that keeps the net honest: it is now
  // impossible to add a mutator to MUTATORS and leave it unreached, or to let a corpus regression
  // quietly drop one, without a red test. There is no "documented gap" escape hatch any more — to add a
  // mutator you must also add a save that reaches it.
  it('EVERY recorded mutator fires somewhere in the corpus — zero blind mutators', () => {
    expect(uncovered).toEqual([])
    expect(union).toEqual([...ALL_MUTATORS].sort())
  })

  it('per-save reach is pinned (a coverage regression fails loudly)', () => {
    expect(perSave).toEqual({
      // The four shallow saves. All are world=4 / mapsUnlocked=false, so they see the BUY PATH ONLY —
      // which is now a stated property of these four fixtures rather than an unnoticed property of the
      // entire corpus. 05/06/07 are the ones that watch the bot.
      '01-early-u1': ['buyBuilding', 'buyEquipment', 'buyJob', 'buyUpgrade'],
      '02-mid-u1': ['buyBuilding', 'buyEquipment', 'buyJob'],
      '03-challenge-watch': ['buyBuilding', 'buyEquipment', 'buyJob'],
      // #69 ship C: U2 reaches buyBuilding because RBuyBuildingsNew's default was the STRING 'true' and
      // its only gate is `== true`, so RbuyBuildings() had never executed. U2 shows no buyEquipment
      // because `Requipon` defaults false, so RautoEquip never runs in the sim at all (#74).
      '04-u2-radon': ['buyBuilding', 'buyJob', 'buyUpgrade'],
      // 05 is the honest play-forward to mapsUnlocked. AT is damage-walled inside a map here (measured
      // HD ratio 23x, fragments=1), so it makes no map calls. Its value is not a rich trace — it is that
      // maps.ts:253 EVALUATES calcOurDmg here instead of short-circuiting past it.
      '05-maps-u1': ['buyBuilding', 'buyJob'],
      // 06 is the fixture that made the net able to see combat: a post-portal state where AT sets a
      // formation nearly every tick (stance.ts survive() reads calcOurDmg) and buys/selects/runs maps at
      // each zone transition (maps.ts enoughDamage -> shouldDoMaps reads calcOurDmg).
      '06-deep-u1': ['buyBuilding', 'buyJob', 'buyMap', 'buyUpgrade', 'runMap', 'selectMap', 'setFormation'],
      // 07 sits ON the game's 100-map cap — the sole gate behind every recycleBelow/recycleMap callsite
      // in AT (`buyMap() == -2`, main.js:6597). It is the only save that can reach either.
      '07-map-cap-u1': ['buyBuilding', 'buyJob', 'buyMap', 'buyUpgrade', 'recycleBelow', 'recycleMap', 'runMap', 'selectMap', 'setFormation'],
      // 08 is the DAMAGE-SENSITIVITY fixture. Its mutator list is unremarkable on purpose — its value is
      // not reach but SATURATION: it is the only save where enoughDamage is false, so calcOurDmg's output
      // can still flip a decision. A 1e6x damage injection produces 1542 divergences here and ZERO on
      // every other save in the corpus. See tests/sim/damage-sensitivity.test.ts.
      '08-starved-u1': ['buyBuilding', 'buyEquipment', 'buyJob', 'buyUpgrade', 'setFormation'],
    })
  })

  // Anti-degeneracy floor. A re-record under a broken runtime could commit near-empty traces that still
  // satisfy every set-based assertion above — the mutator NAMES all still appear if each fires once. Pin
  // the VOLUME too, so a trace that collapses to a handful of events cannot pass itself off as coverage.
  it('the map/formation traces are non-degenerate (volume floor, not just presence)', () => {
    expect(counts['06-deep-u1'].setFormation).toBeGreaterThan(1000)
    expect(counts['06-deep-u1'].selectMap).toBeGreaterThanOrEqual(3)
    expect(counts['07-map-cap-u1'].buyMap).toBeGreaterThanOrEqual(2)
    expect(counts['07-map-cap-u1'].recycleBelow).toBeGreaterThanOrEqual(1)
    expect(counts['07-map-cap-u1'].recycleMap).toBeGreaterThanOrEqual(1)
    expect(counts['08-starved-u1'].setFormation).toBeGreaterThan(1000)
  })
})
