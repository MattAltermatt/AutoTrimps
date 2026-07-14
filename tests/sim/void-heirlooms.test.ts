import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installSeededRandom } from '../../scripts/sim/seededRandom.mjs'
import { installFrozenClock } from '../../scripts/sim/clock.mjs'
import { runTicks } from '../../scripts/sim/driver.mjs'

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// #126 — the SECOND subsystem the `setTimeout = () => 0` stub silently disabled. Sibling of #122
// (checkTriggers, the frozen metal economy) and #66 (the stuck usingRealTimeOffline flag). Same
// disease every time: a stubbed environment quietly removing game behaviour while every gate stays
// green.
//
// On completing a STACKED void map the game pays out one heirloom PER STACK, and it schedules each of
// them on a timer (main.js:15679):
//
//     for (let x = 0; x < currentMapObj.stacked; x++)
//       setTimeout((function (z) { return function () { if (rewardingTimeoutHeirlooms) createHeirloom(z) } })(...), timeout * (x + 1))
//
// Under the stub those callbacks never ran, so every stacked-void completion in the sim dropped its
// rewards. Unlike #122's checkTriggers there was nothing to call by name — they are ANONYMOUS closures
// — so the fix had to make setTimeout actually work (scripts/sim/timers.mjs: a virtual, game-time,
// deterministic queue that the driver pumps, with the three self-driving loops blocklisted).
//
// This test drives the GAME'S OWN completion path (fight() -> isVoid -> the loop above), not a
// mechanism of our own invention. Measured, both ways, on 06-deep-u1 with stacked = 2:
//
//     old stub        createHeirloom x1   <- the synchronous reward only; BOTH deferred ones dropped
//     virtual timers  createHeirloom x3   <- 1 synchronous + 1 per stack
//
// ⚠️ NOTE the coverage boundary, and do not mistake this test for L0 coverage: NO corpus save runs void
// maps, let alone stacked ones (stacking needs Fluffy.getVoidStackCount() > 1 — deep endgame). So the
// L0 differential cannot see this region at all and baseline-zero is green either way. That is exactly
// why this test exists as a direct, end-to-end assertion instead.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const STACKED = 2

/** Arm a stacked void map, stand on its last cell, and hand back a heirloom counter. */
function armStackedVoid(disableTimers = false) {
  const saveString = readFileSync(resolve('tests/fixtures/saves/06-deep-u1.txt'), 'utf8')
  const { window: w, game: g } = bootGame({ saveString })
  installSeededRandom(w, 1)
  installFrozenClock(w)
  if (disableTimers) w.__simTimers = null // reproduce the pre-#126 stub exactly

  let heirlooms = 0
  const orig = w.createHeirloom
  w.createHeirloom = function (...a: unknown[]) {
    heirlooms++
    return orig.apply(this, a)
  }

  // Created through the game's OWN createVoidMap(). The `stacked` field is then poked, because the real
  // stacking path (main.js:6691) requires Fluffy.getVoidStackCount() > 1 — a deep-endgame state. Same
  // doctrine as the fixtures: field-poke to ARM the branch, then let the game's own code run it.
  w.createVoidMap()
  const voids = g.global.mapsOwnedArray.filter((m: { location: string }) => m.location === 'Void')
  const vm = voids[voids.length - 1]
  vm.stacked = STACKED

  w.selectMap(vm.id)
  w.runMap()
  expect(g.global.mapsActive, 'failed to enter the void map').toBe(true)

  // Sit on the last cell so a single kill completes the map. The final enemy is dropped to 1 HP because
  // a void enemy at this depth is otherwise unkillable by this save — the map COMPLETION is what is
  // under test here, not the combat (08-starved-u1 is the fixture that tests combat).
  const grid = g.global.mapGridArray
  g.global.lastClearedMapCell = grid.length - 2
  grid[grid.length - 1].health = 1
  grid[grid.length - 1].maxHealth = 1

  runTicks(w, 60)
  expect(w.game.global.mapsActive, 'the void map never completed — the test proves nothing').toBe(false)
  return heirlooms
}

describe('void heirlooms — stacked void completions pay out (#126)', () => {
  it('a stacked void map grants one heirloom PER STACK', () => {
    // 1 synchronous + one per stack. Pinned as a floor rather than an exact count: the point is that the
    // DEFERRED rewards arrive, and an exact pin would turn any unrelated reward change into a puzzle.
    expect(armStackedVoid()).toBeGreaterThanOrEqual(1 + STACKED)
  }, 120_000)

  it('MUTATION CHECK: with the timers stubbed out, the deferred rewards are silently DROPPED', () => {
    // This is the bug, reproduced. It is here so the test above cannot quietly stop proving anything:
    // if someone removes the pump, the assertion above fails and this one still passes, and the pair
    // says exactly what broke. A stacked-void completion must NOT pay out its per-stack heirlooms when
    // the timer queue is gone.
    expect(armStackedVoid(true)).toBeLessThan(1 + STACKED)
  }, 120_000)
})
