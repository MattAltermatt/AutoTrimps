import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { TEST_BUNDLE } from './bundle'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installSeededRandom } from '../../scripts/sim/seededRandom.mjs'
import { installFrozenClock } from '../../scripts/sim/clock.mjs'
import { stepWithAT } from '../../scripts/sim/driver.mjs'
import { runTrace, diffTraces } from '../../scripts/sim/trace.mjs'
import { CORPUS } from '../../scripts/sim/corpus.mjs'

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// #127 — AT'S HIGHEST-CONSEQUENCE ACTION, which the proof net had NEVER ONCE SEEN.
//
// doPortal() resets the entire run. It had never executed in a single sim run, for TWO independent
// reasons, and keeping them apart matters because only one of them is the setTimeout stub:
//
//   1. `autoPortal()` returns unless `game.global.portalActive`, which no corpus save had, and the
//      AutoPortal setting defaults to "Off". The path was dark before timers even came into it.
//   2. In "Helium Per Hour" mode the portal is SCHEDULED (portal.ts:45, timeout + 100 = 5100ms), so the
//      old `setTimeout = () => 0` stub swallowed it outright. "Custom" mode calls doPortal()
//      SYNCHRONOUSLY, so it never depended on timers at all — measured, both ways.
//
// So 11-portal-u1 uses He/Hr precisely BECAUSE it is the mode the stub killed, and these tests pin both
// halves: that AT really portals, and that it stops portaling if #126's timer queue goes away.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const SAVE = '11-portal-u1'
const entry = CORPUS.find((c: { name: string }) => c.name === SAVE) as {
  name: string
  ticks: number
  settings: Record<string, unknown>
}

function run({ disableTimers = false } = {}) {
  const { window: w, game: g } = bootGame({
    withAutoTrimps: true,
    atBundlePath: TEST_BUNDLE,
    saveString: readFileSync(resolve('tests/fixtures/saves', `${SAVE}.txt`), 'utf8'),
    atSettings: entry.settings,
  })
  installSeededRandom(w, 1)
  installFrozenClock(w)
  if (disableTimers) w.__simTimers = null // reproduce the pre-#126 stub

  const before = { world: g.global.world, portals: g.global.totalPortals }
  expect(before.world, 'the fixture must START mid-run, or a portal proves nothing').toBeGreaterThan(1)
  expect(g.global.portalActive, 'autoPortal() returns immediately without this').toBe(true)

  stepWithAT(w, entry.ticks)
  return { before, after: { world: w.game.global.world, portals: w.game.global.totalPortals } }
}

describe('portal — AT actually portals, and the net can see it (#127)', () => {
  it('AT PORTALS: totalPortals increments and the run resets to zone 1', () => {
    const { before, after } = run()
    expect(after.portals, 'AT never portaled — doPortal() did not execute').toBe(before.portals + 1)
    expect(after.world, 'a portal resets the run to zone 1').toBeLessThan(before.world)
  }, 120_000)

  it('MUTATION CHECK: with the timers stubbed out, the He/Hr portal never fires (the pre-#126 state)', () => {
    // The link back to #126, and the reason He/Hr is the mode under test. In this mode the portal is
    // scheduled 5100ms out, so the old stub swallowed it — AT would sit there forever, never portaling.
    const { before, after } = run({ disableTimers: true })
    expect(after.portals, 'the portal fired without a timer queue — is this still the He/Hr (scheduled) path?').toBe(before.portals)
    expect(after.world).toBeGreaterThan(1)
  }, 120_000)

  it('POSITIVE control: an autoPortal() that never portals makes the net go RED', () => {
    const oracle = JSON.parse(readFileSync(resolve('tests/fixtures/traces', `${SAVE}.1.trace.json`), 'utf8'))
    const clean = readFileSync(TEST_BUNDLE, 'utf8')

    // #133 — main-loop.ts (mainLoop) now calls autoPortal() as a free global inside the same IIFE that
    // bundles portal.ts's `export function autoPortal`, so esbuild renames the definition to avoid
    // shadowing the free reference (autoPortal → autoPortal2). The bridge still publishes it under the
    // real name, so runtime is unchanged; only this text anchor moves. Match the optional suffix.
    const ANCHOR = /function autoPortal\d*\(\) \{/
    const m = clean.match(ANCHOR)
    expect(m, 'anchor not found — the bundle shape changed').not.toBeNull()
    const at = m!.index!
    const anchorLen = m![0].length
    const mutant = clean.slice(0, at + anchorLen) + ' return;' + clean.slice(at + anchorLen)
    expect(mutant).not.toBe(clean) // the splice must LAND, or a zero diff would read as "blind"

    const dir = mkdtempSync(join(tmpdir(), 'at-portal-mutant-'))
    const mutantPath = join(dir, 'mutant.user.js')
    writeFileSync(mutantPath, mutant, 'utf8')

    const divergences = diffTraces(
      oracle,
      runTrace({
        atBundlePath: mutantPath,
        saveString: readFileSync(resolve('tests/fixtures/saves', `${SAVE}.txt`), 'utf8'),
        seed: 1,
        ticks: entry.ticks,
        atSettings: entry.settings,
      }),
    )

    // Measured at 510. A portal resets the run, so suppressing it diverges enormously — which is the
    // whole point: this is the single decision with the largest blast radius AT makes, and until now the
    // net could not see it at all. Floor, not an exact pin.
    expect(
      divergences.length,
      'Suppressing AT\'s portal entirely produced ZERO divergences. The net is blind to the portal path ' +
        'again — check that 11-portal-u1 still has portalActive, a seeded AutoPortal mode, and a ' +
        'bestHeliumHourThisRun the current rate can fall below. Fix the corpus, not the test.',
    ).toBeGreaterThan(50)
  }, 180_000)
})
