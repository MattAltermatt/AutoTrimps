import { describe, it, expect } from 'vitest'
import { bootGame } from '../scripts/sim/boot.mjs'
import { TEST_BUNDLE } from './sim/bundle'

// #83 §3 — setFormation(0) is a SILENT NO-OP.
//
// The game guards its own entry point on truthiness (.trimps-game/main.js:16838):
//
//     function setFormation(what) {
//         if (what) {                    // <- numeric 0 is FALSY. Returns, does nothing.
//             what = parseInt(what, 10); // <- which is why the game's own UI passes STRINGS
//
// X formation IS 0, so the game's own buttons pass the string: `onclick='setFormation("0")'`
// (main.js:2779). AutoTrimps knows this — stance.ts:44/296/298/305 all pass '0'. Two sites had
// regressed to the number:
//
//   * scryer.ts  — `var x = 0` (HIGH). The arm fires, does nothing, and its `return` then EATS the
//     setFormation(scry) fallback at the bottom of the function. The whole tick is a no-op: AT
//     neither enters X nor falls back to Scryer stance, silently, tick after tick.
//   * stance.ts:397 — windStance() could never enter X at all.
//
// CRITICAL HARNESS NOTE: tests/stance.characterization.test.ts stubs setFormation with a vi.fn().
// A spy records the call and reports success — it does NOT enforce the callee's contract, which is
// exactly WHY the existing suite is blind to this bug. These tests call the REAL game function and
// assert the REAL game.global.formation actually moved.

/** Boot the real clone + real bundle, ready to fight, with the real setFormation in place. */
function bootFighting() {
  const rig = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE })
  const { game } = rig
  game.global.gridArray = [{ level: 1 }]
  game.global.soldierHealth = 1000
  game.global.soldierHealthMax = 1000
  game.global.world = 100
  game.global.formation = 2 // start in D, so a move to X (0) is observable
  game.global.mapsActive = false
  game.global.preMapsActive = false
  game.global.challengeActive = ''
  game.global.highestLevelCleared = 200
  game.global.lastClearedCell = 50
  game.upgrades.Formations.done = 1
  game.options.menu.pauseGame.enabled = 0
  return rig
}

describe('#83 §3: the game contract', () => {
  it('TRIPWIRE: the fixture is really hydrated (game methods present)', () => {
    const { game } = bootFighting()
    expect(typeof game.buildings.Shed.cost.wood).toBe('function')
  })

  it("POSITIVE CONTROL: the real setFormation('0') DOES enter X", () => {
    const { window, game } = bootFighting()
    window.setFormation('0')
    expect(game.global.formation).toBe(0)
  })

  it('and the real setFormation(0) — the NUMBER — is a silent no-op (this is the game, not AT)', () => {
    const { window, game } = bootFighting()
    window.setFormation(0)
    expect(game.global.formation).toBe(2) // unchanged. This is the trap both AT sites fell into.
  })
})

describe('#83 §3: windStance() can enter X formation', () => {
  it('enters X (0) when its model says X', () => {
    const { window, game } = bootFighting()
    // calcCurrentStance/lowHeirloom are free identifiers in stance.ts (cross-module, via the bridge),
    // so overriding them on the window is what windStance actually calls. setFormation is NOT stubbed.
    window.calcCurrentStance = () => 0 // "go to X"
    window.lowHeirloom = () => {}

    window.windStance()

    expect(game.global.formation).toBe(0)
  })

  it('still reaches the truthy formations (no regression from stringifying)', () => {
    for (const stance of [1, 2, 5]) {
      const { window, game } = bootFighting()
      window.calcCurrentStance = () => stance
      window.lowHeirloom = () => {}
      window.windStance()
      expect(game.global.formation).toBe(stance)
    }
  })
})

describe('#83 §3: useScryerStance() smooth-transition arm can enter X formation', () => {
  it('the XB arm enters X (0) instead of silently no-op-ing and eating the fallback', () => {
    const { window, game } = bootFighting()
    const S = window.autoTrimpSettings

    // Reach the "Default" block's transitionRequired loop (scryer.ts:153-161). Settings first:
    S.UseScryerStance.enabled = true
    S.ScryerSkipCorrupteds2.value = 0 // SC -> true, so the corrupted "never" branch arms transitionRequired
    S.ScryerMinZone.value = '1'
    S.ScryerMaxZone.value = '0' // no max
    S.onlyminmaxworld.value = 0
    S.AutoStance.value = 0 // skip calcBaseDamageInX
    S.ScryerUseWhenOverkill.enabled = false // skip the overkill arm
    S.screwessence.enabled = false // skip the essence arm
    S.ScryerSkipHealthy.value = 0

    // Free identifiers scryer.ts calls. NOTE (bundle-scope gotcha, worth knowing): esbuild puts every
    // src module in ONE shared scope, so a name DEFINED in src (readyToSwitch, in scryer.ts itself)
    // binds LEXICALLY and cannot be overridden from the window — while a name only ever REFERENCED
    // freely (survive/oneShotPower, which esbuild renamed to survive2/oneShotPower2 at their
    // definitions) really does resolve to the global. So readyToSwitch below is the REAL one, and we
    // satisfy it honestly: it returns `die || survive(stance="S", 2)`.
    window.getEmpowerment = () => '' // no nature -> the empowerment "never" disjuncts stay false
    window.isActiveSpireAT = () => false
    window.disActiveSpireAT = () => false
    // current enemy is Corrupted, next one is not -> transitionRequired becomes true
    window.getCurrentEnemy = (n?: number) => (n === 2 ? { mutation: 'None' } : { mutation: 'Corruption' })
    // oneShotPower: truthy for the scryNext probe and for "D"; ZERO for "X" so the XB arm's
    // `!oneShotPower("X", 0, true)` passes.
    window.oneShotPower = (stance?: string) => (stance === 'X' ? 0 : 1)
    // survive: "S" so the real readyToSwitch() says yes; "XB" so the second arm — setFormation(x),
    // the buggy one — is what fires. "D"/"B"/"H" must NOT survive or a different arm would win.
    window.survive = (formation: string) => formation === 'XB' || formation === 'S'

    // Record what AT passes, but keep the REAL game function underneath (a bare spy is exactly the
    // blindness this suite exists to correct).
    const args: unknown[] = []
    const realSetFormation = window.setFormation
    window.setFormation = (what: unknown) => { args.push(what); return realSetFormation.call(window, what) }

    window.useScryerStance()

    // Anti-false-green: prove the XB transition arm is what fired — not the scry fallback (4/5) and
    // not some other branch. Before the fix this recorded exactly [0]: the arm DID run, the game
    // ignored it, and the `return` then ate the setFormation(scry) fallback.
    expect(args).toEqual(['0'])
    expect(game.global.formation).toBe(0)
  })
})
