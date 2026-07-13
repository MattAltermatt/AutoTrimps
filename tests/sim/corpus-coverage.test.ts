import { describe, it, expect } from 'vitest'
import { coverageFromTraces, ALL_MUTATORS } from '../../scripts/sim/coverage.mjs'

// Makes the proof-net's REAL coverage loud instead of implied. The differential (baseline-zero) only
// guards decisions that reach a native mutator the corpus exercises; everything else is invisible to
// it. This pins that reach so BOTH directions are caught: a degenerate re-record that quietly drops a
// mutator (coverage LOSS) fails here, and a new/deeper save that reaches a combat mutator (coverage
// GAIN) also fails here — prompting a celebratory pin update rather than silently shifting the net's
// scope. Reads only committed traces, so it runs in CI too (no ../trimps-game clone needed).
//
// ⚠️ #66 — THESE PINS ONCE ENSHRINED A BUG. The previous version asserted buyEquipment was uncovered
// and explained it away as an honest corpus-depth gap: "the corpus is early-U1 ... so it NEVER ...
// buys equipment". That reasoning was WRONG. AT was not failing to reach the gear code because the
// saves were shallow — it was because scripts/sim/boot.mjs left `usingRealTimeOffline` stuck true, so
// AT's mainLoop skipped autoLevelEquipment() on EVERY run (#66). The "documented gap" wording made a
// harness bug read as a considered design decision, and this test then locked it in place. Fixing
// boot.mjs turned all three U1 saves green for buyEquipment with NO corpus change at all.
//
// Lesson for whoever edits these pins next: an uncovered mutator is a HYPOTHESIS ("the corpus doesn't
// reach it"), not a fact. Verify AT actually attempts the call and is merely priced out — don't
// assume the code path ran at all.
describe('corpus mutator coverage (loud, pinned)', () => {
  const { perSave, union, uncovered } = coverageFromTraces()

  it('exercises the economy mutators AND equipment (#66 unblocked buyEquipment)', () => {
    expect(union).toEqual(['buyBuilding', 'buyEquipment', 'buyJob', 'buyUpgrade'])
  })

  // The REMAINING gap, now genuinely corpus-depth: the corpus is early-U1 + a field-poked U2, so it
  // never runs/picks/recycles a map or sets a formation. Those are covered by L1 unit depth, not this
  // L0 differential. Reaching real map/combat states headless needs long-progression jsdom can't
  // cheaply reach (#47 finding). If this list SHRINKS again, verify WHY before celebrating — per the
  // #66 note above, the cause may be a harness fix rather than a deeper save.
  it('does NOT exercise map/formation mutators (corpus-depth gap)', () => {
    expect(uncovered).toEqual(['runMap', 'selectMap', 'setFormation', 'recycleMap'])
    expect(union.length + uncovered.length).toBe(ALL_MUTATORS.length)
  })

  it('per-save reach is pinned (a coverage regression fails loudly)', () => {
    expect(perSave).toEqual({
      // All three U1 saves now reach buyEquipment. Pre-#66 every one of them was blind to it.
      '01-early-u1': ['buyBuilding', 'buyEquipment', 'buyJob', 'buyUpgrade'],
      '02-mid-u1': ['buyBuilding', 'buyEquipment', 'buyJob'],
      '03-challenge-watch': ['buyBuilding', 'buyEquipment', 'buyJob'],
      // #69 ship C: U2 now reaches buyBuilding for the FIRST TIME. RBuyBuildingsNew's default was the
      // STRING 'true' and its only gate is `== true`, so RbuyBuildings() had never executed — and in U2
      // it is the ONLY building automation, so U2 players got neither housing nor storage.
      //
      // ⚠️ THE COMMENT THAT USED TO SIT HERE WAS FALSE, and it is worth recording why, because it is
      // exactly the failure this file was warned about at the top. It read: "U2 is unchanged by #66 —
      // the stuck flag gated a branch inside `if (universe == 1)`". It does not: legacy/AutoTrimps2.js
      // gates RsetScienceNeeded() on the same `!usingRealTimeOffline` INSIDE the `universe == 2` block,
      // so U2's science was equally dark. And U2 showed no buyEquipment not because #66 spared it, but
      // because `Requipon` defaults false, so RautoEquip never runs in the sim AT ALL. The invariance
      // was a coincidence, and the comment promoted it to evidence — inside a passing assertion, where
      // the next person auditing #66 would have believed it. (#74)
      //
      // Rule, stated so it does not happen a third time: a comment inside an assertion that explains
      // WHY a value is what it is must cite the file:line that makes it so.
      '04-u2-radon': ['buyBuilding', 'buyJob', 'buyUpgrade'],
    })
  })
})
