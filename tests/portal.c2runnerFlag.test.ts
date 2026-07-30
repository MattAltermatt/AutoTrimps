import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { bootGame } from '../scripts/sim/boot.mjs'
import { TEST_BUNDLE } from './sim/bundle'

// #206 — C2 Runner's `challengeSquaredMode` writes landed in a module-private `var`.
//
// portal.ts declared `var challengeSquaredMode` at module top level, and esbuild emits the whole src
// bundle inside a strict IIFE, so all 11 writes in c2runner() hit AT's own binding and never the
// game's (main.js:1663). Two independent consequences, both silent:
//   (a) activatePortal() computes `runningChallengeSquared = selectedChallenge ? challengeSquaredMode
//       : false` (main.js:4013) off the GAME's copy, so every C2 Runner portal started a PLAIN
//       challenge and earned zero Challenge² bonus;
//   (b) portalClicked() resets only the game's copy (main.js:1671), so AT's stuck true for the whole
//       session — and `c2done` (portal.ts:236) is then false on every later portal, which silently
//       disables the AutoStartDaily block and the HeliumHourChallenge fallback.
//
// This boots the REAL pinned clone and the REAL built bundle: the defect is in how the artifact is
// SCOPED, so the witness has to be the artifact. A vitest ESM import of src/modules/portal.ts is a
// different scope and is not evidence about the shipped bundle either way.

/** HZE 199 with the default 85% threshold: Discipline at 10 is 5.00%, every other candidate ≥ 90%. */
const LAGGING_C2 = {
  Size: 190, Slow: 185, Watch: 180, Discipline: 10, Balance: 190,
  Meditate: 190, Metal: 190, Lead: 180, Nom: 185, Electricity: 190, Toxicity: 190,
}
/** Nothing below 85% — c2runner must pick nothing and leave the flag alone. */
const ALL_CAUGHT_UP = {
  Size: 190, Slow: 190, Watch: 190, Discipline: 190, Balance: 190,
  Meditate: 190, Metal: 190, Lead: 190, Nom: 190, Electricity: 190, Toxicity: 190,
}

function rig(c2: Record<string, number>) {
  const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE })

  // Anti-false-green tripwires. Without these, a renamed export or a moved game var would make
  // every assertion below vacuously true.
  expect(typeof window.c2runner, 'c2runner must be published by the bridge').toBe('function')
  expect(window.challengeSquaredMode, "the game's own flag must exist and start false").toBe(false)
  const S = window.autoTrimpSettings
  for (const id of ['c2runnerstart', 'c2runnerportal', 'c2runnerpercent'])
    expect(S[id], `setting ${id} must exist`).toBeDefined()

  S.c2runnerstart.enabled = true // the only opt-in; both value defaults already pass their > 0 gate
  expect(Number(S.c2runnerportal.value), 'c2runnerportal default must pass > 0').toBeGreaterThan(0)
  expect(Number(S.c2runnerpercent.value), 'c2runnerpercent default').toBe(85)

  game.global.portalActive = true
  game.global.highestLevelCleared = 199
  // Load-bearing: Discipline's filter() is `getTotalPerkResource(true) >= 30` (config.js:3290),
  // which reads game.global.totalHeliumEarned (main.js:2436) — NOT helium.owned. Without it the
  // challenge is locked, displayChallenges() omits its button in squared mode (main.js:1778), and
  // selectChallenge() throws on a null element instead of testing anything.
  game.global.totalHeliumEarned = 1e6
  Object.assign(game.c2, c2)

  // doPortal() opens the portal window (portal.ts:265) BEFORE it reaches the c2runner block, so this
  // is the real call order, not test scaffolding — and it is load-bearing twice over: portalClicked()
  // is what sets `portalUniverse` and renders the challenge buttons that selectChallenge() then
  // decorates, and it is also the reset (main.js:1671) that the flag must start from.
  window.portalClicked()
  expect(window.challengeSquaredMode, 'portalClicked must have reset the flag').toBe(false)
  return { window, game }
}

describe('#206 — C2 Runner arms the GAME\'s challengeSquaredMode, not a module-private copy', () => {
  it('c2runner() flips the game\'s flag and the GAME\'s own selectChallenge consumes it', () => {
    const { window, game } = rig(LAGGING_C2)

    // selectChallenge is the real game function — not stubbed. It is the first game code downstream
    // of the flag, and it renders a DIFFERENT description depending on it (main.js:1905).
    window.c2runner()

    expect(game.global.selectedChallenge, 'positive control: the lagging C2 must be picked').toBe('Discipline')
    expect(window.challengeSquaredMode, 'the write must reach the binding main.js:4013 reads').toBe(true)
    // Game-computed witness: with the flag set, selectChallenge emits the SQUARED description (which
    // names the C2 tier and the bonus) instead of the plain one. Asserting the game's own output
    // rather than re-deriving main.js:4013's formula here.
    const desc = window.document.getElementById('specificChallengeDescription').innerHTML
    expect(desc, 'the squared description must mention the C2 tier').toContain('Discipline<sup>2</sup>')
    expect(desc).toContain('highest Zone reached')
  })

  it('the flag is SHARED, so portalClicked() clears what c2runner() set', () => {
    // This is consequence (b). With a module-private copy, AT's flag survived every portal, so
    // `c2done` (portal.ts:236) was false forever and two unrelated portal paths went dead.
    const { window } = rig(LAGGING_C2)
    window.c2runner()
    expect(window.challengeSquaredMode).toBe(true)

    window.portalClicked() // main.js:1671 sets challengeSquaredMode = false
    expect(window.challengeSquaredMode, 'AT and the game must share ONE binding').toBe(false)
  })

  it('with every C2 above the threshold the flag is left alone (so c2done survives)', () => {
    // The negation matters as much as the write: if c2runner set the flag unconditionally, the
    // AutoStartDaily block would be dead for the opposite reason.
    const { window, game } = rig(ALL_CAUGHT_UP)
    window.c2runner()
    expect(game.global.selectedChallenge, 'nothing should be selected').toBeFalsy()
    expect(window.challengeSquaredMode).toBe(false)
  })

  it('a LOCKED lagging C2 does not throw — it falls through to the next candidate', () => {
    // Found by review, and it is a hazard this fix CREATED. With the flag reaching the game,
    // displayChallenges() skips any challenge whose filter fails while in squared mode
    // (main.js:1778), and selectChallenge then derefs `getElementById("challenge" + what)`
    // unconditionally (main.js:1885) — a TypeError inside doPortal, upstream of
    // writePrePortalBackup() and activatePortal(). Before the fix the renderer never entered squared
    // mode, so the same candidate was still emitted as `firstFail` and selectChallenge merely bailed.
    //
    // Electricity's filter is `prisonClear > 0` (config.js:3604), i.e. z80, and c2runner's Electricity
    // arm has NO unlock gate of its own — so a U1 player who has not cleared z80 reaches it.
    const { window, game } = rig({ ...ALL_CAUGHT_UP, Electricity: 0 })
    game.global.prisonClear = 0 // Electricity locked
    expect(game.challenges.Electricity.filter(true), 'the fixture must really lock it').toBe(false)

    expect(() => window.c2runner()).not.toThrow()
    // Nothing was started, and the flag is back to what portalClicked left it — so doPortal's
    // `c2done` stays true and the AutoStartDaily path is not collaterally disabled.
    expect(game.global.selectedChallenge).toBeFalsy()
    expect(window.challengeSquaredMode).toBe(false)
  })

  it('a locked candidate does not block a later UNLOCKED one', () => {
    // The cascade must keep going. Toxicity sits after Electricity, so with Electricity locked and
    // lagging, and Toxicity lagging too, Toxicity is what should start.
    const { window, game } = rig({ ...ALL_CAUGHT_UP, Electricity: 0, Toxicity: 10 })
    game.global.prisonClear = 0
    window.c2runner()
    expect(game.global.selectedChallenge).toBe('Toxicity')
    expect(window.challengeSquaredMode).toBe(true)
  })

  it('DELEGATION, not a mirror: a candidate refused for a NON-filter reason is also skipped', () => {
    // Found by review as a surviving near-miss. The obvious repair —
    //   `if (!game.challenges[what].filter() || !game.challenges[what].allowSquared) continue`
    // — passes every other assertion in this file, because Electricity's refusal IS a filter failure.
    // What separates the two implementations is any OTHER reason displayChallenges skips a challenge
    // (main.js:1773-1777: blockU1, missing allowU2, the U2 radon gate, !allowSquared). Asking the
    // renderer covers all of them and cannot drift when a clone bump adds a fifth; a mirror has to be
    // re-derived every time. `allowSquared` is the one such reason drivable on a booted U1 window.
    const { window, game } = rig({ ...ALL_CAUGHT_UP, Toxicity: 10 })
    expect(game.challenges.Toxicity.filter(true), 'Toxicity must be UNLOCKED here').toBe(true)
    game.challenges.Toxicity.allowSquared = false // offerable as a plain challenge, not as a C²

    expect(() => window.c2runner()).not.toThrow()
    expect(game.global.selectedChallenge, 'a non-C²-able challenge must not be started').toBeFalsy()
    expect(window.challengeSquaredMode).toBe(false)
  })

  it('the shipped bundle declares no shadowing binding of its own', () => {
    // Mechanical guard on the actual shipped text, since that is where the defect lived: the src
    // IIFE must not declare this name. A future `var`/`let` reintroduction is exactly the
    // regression, and it stays invisible from behaviour until someone turns the feature on.
    const bundle = readFileSync(TEST_BUNDLE, 'utf8')
    expect(bundle).toMatch(/challengeSquaredMode/) // the writes are really in there to be shadowed
    expect(bundle).not.toMatch(/\b(?:var|let|const)\s+challengeSquaredMode\b/)
  })
})
