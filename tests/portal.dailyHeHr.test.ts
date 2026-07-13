import { describe, it, expect } from 'vitest'
import { bootGame } from '../scripts/sim/boot.mjs'
import { TEST_BUNDLE } from './sim/bundle'

// #83 §2 — `DP: He/Hr` / `DP: Rn/Hr` daily auto-portal never portalled, in either universe, at the
// DEFAULT buffer of 0.
//
// dailyAutoPortal() and RdailyAutoPortal() wrapped `if (!aWholeNewWorld)` in a BRACE, swallowing
// the entire portal body. The correct siblings autoPortal() (portal.ts:31) and RautoPortal()
// (:341) use a single-statement `if` covering only the buffer scale-up. With the brace:
//
//   * zone boundary (aWholeNewWorld === true) -> whole block skipped. This is THE path that was
//     supposed to portal.
//   * mid-zone (aWholeNewWorld === false)     -> block runs, but 0 * bufferExceedFactor === 0, so
//     `if (heliumHrBuffer == 0 && !aWholeNewWorld) OKtoPortal = false` fires unconditionally.
//
// Both dead => the setting reads as ON and does nothing, forever.
//
// These tests boot the REAL clone + the REAL built bundle and instrument the free global tooltip(),
// which is called ONLY inside the portal block. Nothing in portal.ts is mocked.

type Rig = { window: any; tooltipCalls: unknown[][] }

/**
 * @param uni  1 -> dailyAutoPortal (AutoPortalDaily), 2 -> RdailyAutoPortal (RAutoPortalDaily)
 * @param atZoneBoundary  the value of the free global `aWholeNewWorld`
 * @param buffer  the D: He/Hr Portal Buffer % setting (default '0')
 */
function rig(uni: 1 | 2, atZoneBoundary: boolean, buffer: string): Rig {
  const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE })

  const S = window.autoTrimpSettings
  // Anti-false-green: these settings must really exist, or every assertion below is vacuous.
  const dailyId = uni === 1 ? 'AutoPortalDaily' : 'RAutoPortalDaily'
  const bufferId = uni === 1 ? 'dHeliumHrBuffer' : 'RdHeliumHrBuffer'
  const minZoneId = uni === 1 ? 'dHeHrDontPortalBefore' : 'RdHeHrDontPortalBefore'
  for (const id of [dailyId, bufferId, minZoneId]) expect(S[id], `setting ${id} must exist`).toBeDefined()

  S[dailyId].value = 1 // "DP: He/Hr" / "DP: Rn/Hr"
  S[bufferId].value = buffer
  S[minZoneId].value = '1'

  game.global.portalActive = true
  game.global.runningChallengeSquared = false
  game.global.world = 50

  // The He/Hr comparison: my rate is far below my best => the buffer is exceeded.
  game.stats.bestHeliumHourThisRun = { evaluate() {}, storedValue: 1000, atZone: 40 }
  game.stats.heliumHour = { value: () => 1 }

  window.aWholeNewWorld = atZoneBoundary
  window.zonePostpone = 0

  const tooltipCalls: unknown[][] = []
  window.tooltip = (...args: unknown[]) => { tooltipCalls.push(args) }
  window.cancelTooltip = () => {}
  window.abandonDaily = () => {}
  window.RresetVars = () => {}

  return { window, tooltipCalls }
}

const call = (r: Rig, uni: 1 | 2) => (uni === 1 ? r.window.dailyAutoPortal() : r.window.RdailyAutoPortal())

describe.each([
  [1, 'dailyAutoPortal (U1)'],
  [2, 'RdailyAutoPortal (U2)'],
] as const)('#83 §2: %s portals at the default buffer', (uni, name) => {
  it(`${name}: POSITIVE CONTROL — the non-daily sibling portals at the zone boundary with buffer 0`, () => {
    // Proves the instrument can see a portal at all: the sibling has always worked.
    const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE })
    const sel = uni === 1 ? 'AutoPortal' : 'RAutoPortal'
    window.autoTrimpSettings[sel].selected = uni === 1 ? 'Helium Per Hour' : 'Radon Per Hour'
    window.autoTrimpSettings[uni === 1 ? 'HeliumHrBuffer' : 'RadonHrBuffer'].value = '0'
    window.autoTrimpSettings[uni === 1 ? 'HeHrDontPortalBefore' : 'RnHrDontPortalBefore'].value = '1'
    game.global.portalActive = true
    game.global.runningChallengeSquared = false
    game.global.world = 50
    game.stats.bestHeliumHourThisRun = { evaluate() {}, storedValue: 1000, atZone: 40 }
    game.stats.heliumHour = { value: () => 1 }
    window.aWholeNewWorld = true
    window.zonePostpone = 0
    const calls: unknown[][] = []
    window.tooltip = (...a: unknown[]) => { calls.push(a) }
    window.cancelTooltip = () => {}
    window.RresetVars = () => {}
    ;(uni === 1 ? window.autoPortal : window.RautoPortal)()
    expect(calls.length).toBeGreaterThan(0)
  })

  it(`${name}: THE BUG — portals at the ZONE BOUNDARY with the default buffer of 0`, () => {
    const r = rig(uni, /* atZoneBoundary */ true, '0')
    call(r, uni)
    // With the brace, the whole body was skipped here: zero tooltip calls, no portal, ever.
    expect(r.tooltipCalls.length).toBeGreaterThan(0)
    expect(String(r.tooltipCalls[0]![3])).toContain('Auto Portaling NOW!')
  })

  it(`${name}: mid-zone with a NON-ZERO buffer still portals (the degraded path survives)`, () => {
    const r = rig(uni, /* atZoneBoundary */ false, '10')
    call(r, uni)
    expect(r.tooltipCalls.length).toBeGreaterThan(0)
  })

  it(`${name}: mid-zone with buffer 0 correctly does NOT portal (faithful: that guard is intended)`, () => {
    const r = rig(uni, /* atZoneBoundary */ false, '0')
    call(r, uni)
    // `if (heliumHrBuffer == 0 && !aWholeNewWorld) OKtoPortal = false` is deliberate in the
    // already-correct siblings too. The fix must NOT turn this into a portal.
    expect(r.tooltipCalls.length).toBe(0)
  })
})
