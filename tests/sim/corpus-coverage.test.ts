import { describe, it, expect } from 'vitest'
import { coverageFromTraces, ALL_MUTATORS } from '../../scripts/sim/coverage.mjs'

// Makes the proof-net's REAL coverage loud instead of implied. The differential (baseline-zero) only
// guards decisions that reach a native mutator the corpus exercises; everything else is invisible to
// it. This pins that reach so BOTH directions are caught: a degenerate re-record that quietly drops a
// mutator (coverage LOSS) fails here, and a new/deeper save that reaches a combat mutator (coverage
// GAIN) also fails here — prompting a celebratory pin update rather than silently shifting the net's
// scope. Reads only committed traces, so it runs in CI too (no ../trimps-game clone needed).
describe('corpus mutator coverage (loud, pinned)', () => {
  const { perSave, union, uncovered } = coverageFromTraces()

  it('exercises exactly the economy mutators (buyJob/buyBuilding/buyUpgrade)', () => {
    expect(union).toEqual(['buyBuilding', 'buyJob', 'buyUpgrade'])
  })

  // The honest gap: the corpus is early-U1 + a field-poked U2, so it NEVER runs a map, picks a map,
  // recycles one, sets a formation, or buys equipment. Combat/maps/equipment decisions are covered by
  // L1 unit depth, not this L0 differential; #58 live-drives the U2 gear path. Reaching real map/combat
  // states headless needs long-progression jsdom can't cheaply reach (#47 finding). If this list ever
  // SHRINKS, a deeper save landed — celebrate and update the pins here + the design's coverage note.
  it('does NOT exercise maps/combat/equipment mutators (documented gap)', () => {
    expect(uncovered).toEqual(['runMap', 'selectMap', 'buyEquipment', 'setFormation', 'recycleMap'])
    expect(union.length + uncovered.length).toBe(ALL_MUTATORS.length)
  })

  it('per-save reach is pinned (a coverage regression fails loudly)', () => {
    expect(perSave).toEqual({
      '01-early-u1': ['buyJob', 'buyUpgrade'],
      '02-mid-u1': ['buyBuilding', 'buyJob'],
      '03-challenge-watch': ['buyJob', 'buyUpgrade'],
      '04-u2-radon': ['buyJob', 'buyUpgrade'],
    })
  })
})
