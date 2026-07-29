// @vitest-environment jsdom
//
// jsdom, despite this module being DOM-free itself: it imports the REAL `getPageSetting`, and
// `utils.ts:255` runs `document.createElement` at module top level. Stubbing getPageSetting instead
// would test the stub, not the semantics that matter here — that a key missing from the store reads
// as `false` (#68), which is exactly what the phantom-conflict test below pins.
import { describe, it, expect, beforeEach } from 'vitest'
import { CONFLICTS, activeConflicts } from '../src/modules/native-conflicts'

// The matrix reads two sources: game.global flags and AT's own settings store. Both are ambient
// globals, so the fixture installs them directly — no DOM, no bundle, no clone boot needed.
function setup(universe: number) {
  ;(globalThis as any).game = {
    global: {
      universe,
      autoPrestiges: 0,
      autoUpgrades: 0,
      // HZE >= 59 (main.js:559). Load-bearing for the autoPrestige row: the native prestige
      // automation is only reachable through autoUpgrades(), which needs this flag.
      autoUpgradesAvailable: true,
      autoStorage: true,
      improvedAutoStorage: false,
      autoStructureSetting: { enabled: false },
      autoStructureSettingU2: { enabled: false },
      autoJobsSetting: { enabled: false },
      autoJobsSettingU2: { enabled: false },
    },
  }
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).getAutoStructureSetting = () =>
    universe === 2
      ? (globalThis as any).game.global.autoStructureSettingU2
      : (globalThis as any).game.global.autoStructureSetting
  ;(globalThis as any).getAutoJobsSetting = () =>
    universe === 2
      ? (globalThis as any).game.global.autoJobsSettingU2
      : (globalThis as any).game.global.autoJobsSetting
  // #187 — the game gates every AutoStructure/AutoJobs purchase on bwRewardUnlocked() as well as on
  // `.enabled` (main.js:18246, :5081). Default true so the existing rows keep testing what they were
  // written to test; the #187 block below drives it false explicitly.
  ;(globalThis as any).bwRewardUnlocked = () => true
}

// #187 — a native automation that is ON but never CONFIGURED buys nothing: config.js:245-248 seeds
// `{enabled: false}` with no per-item keys, and only saveAutoStructureConfig/saveAutoJobsConfig ever
// add them. So "turn it on" in a fixture now means "on AND configured", or the state under test is
// one the game never actually acts on.
function turnStructureOn(universe = 1, configured = true) {
  const key = universe === 2 ? 'autoStructureSettingU2' : 'autoStructureSetting'
  const s: any = { enabled: true }
  if (configured) s.Hut = { enabled: true, value: '100', buyMax: 0 }
  ;(globalThis as any).game.global[key] = s
}
function turnJobsOn(universe = 1, configured = true) {
  const key = universe === 2 ? 'autoJobsSettingU2' : 'autoJobsSetting'
  const s: any = { enabled: true }
  if (configured) s.Farmer = { enabled: true, ratio: 1, buyMax: 0 }
  ;(globalThis as any).game.global[key] = s
}

/** Install an AT setting the way createSetting would have. */
function set(id: string, type: string, value: any) {
  const store = (globalThis as any).autoTrimpSettings
  store[id] = type === 'boolean' ? { id, type, enabled: value } : { id, type, value }
}

const keys = () => activeConflicts().map((c) => c.key)

describe('native-conflicts matrix (#150)', () => {
  beforeEach(() => setup(1))

  it('a stock, non-conflicting state reports nothing', () => {
    expect(keys()).toEqual([])
  })

  it('AutoPrestige on + AT buying prestiges conflicts (U1)', () => {
    ;(globalThis as any).game.global.autoPrestiges = 1
    set('BuyArmorNew', 'multitoggle', 1) // Armor: Buy Both
    expect(keys()).toContain('autoPrestige')
  })

  it('AutoPrestige on while AT buys LEVELS only does not conflict', () => {
    ;(globalThis as any).game.global.autoPrestiges = 1
    set('BuyArmorNew', 'multitoggle', 3) // Armor: Levels
    set('BuyWeaponsNew', 'multitoggle', 3) // Weapons: Levels
    expect(keys()).not.toContain('autoPrestige')
  })

  it('AutoPrestige uses Requipon as the AT-side gate in U2', () => {
    setup(2)
    ;(globalThis as any).game.global.autoPrestiges = 1
    set('BuyArmorNew', 'multitoggle', 1) // U1 setting: must be ignored in U2
    expect(keys()).not.toContain('autoPrestige')
    set('Requipon', 'boolean', true)
    expect(keys()).toContain('autoPrestige')
  })

  it('AutoUpgrade mode 1 conflicts, mode 2 (Auto No Coords) does not', () => {
    set('BuyUpgradesNew', 'multitoggle', 1)
    ;(globalThis as any).game.global.autoUpgrades = 1
    expect(keys()).toContain('autoUpgrade')
    ;(globalThis as any).game.global.autoUpgrades = 2
    expect(keys()).not.toContain('autoUpgrade')
  })

  it('a MISSING AT setting never fires a phantom conflict (#68: getPageSetting returns false)', () => {
    ;(globalThis as any).game.global.autoUpgrades = 1
    ;(globalThis as any).autoTrimpSettings = {} // veteran localStorage lacking the key
    expect(keys()).not.toContain('autoUpgrade')
  })

  it('AutoPrestige is inert without autoUpgradesAvailable, so no advisory (#150 review F7)', () => {
    // autoPrestiges() is reachable ONLY via autoUpgrades() (main.js:18464), which the game calls only
    // under this flag (main.js:19915) — while the BUTTON appears at Bone Shrine sLevel 4. A shrine-4
    // player below HZE 59 therefore has a visible AutoPrestige toggle that does nothing.
    ;(globalThis as any).game.global.autoPrestiges = 1
    set('BuyArmorNew', 'multitoggle', 1)
    ;(globalThis as any).game.global.autoUpgradesAvailable = false
    expect(keys()).not.toContain('autoPrestige')
    ;(globalThis as any).game.global.autoUpgradesAvailable = true
    expect(keys()).toContain('autoPrestige')
  })

  it('"Buy Storage" is COMPLEMENTARY to AutoStructure, not a conflict (#150 review F3)', () => {
    // buyAutoStructures()' order list (main.js:18247) contains no Barn/Shed/Forge, so native buys the
    // buildings and AT buys the storage — a clean split, not a double-schedule.
    turnStructureOn()
    set('BuyBuildingsNew', 'multitoggle', 3) // Buy Storage
    expect(keys()).not.toContain('autoStructure')
    set('BuyBuildingsNew', 'multitoggle', 2) // Buy Buildings — the genuine overlap
    expect(keys()).toContain('autoStructure')
  })

  it('a missing BuyBuildingsNew must NOT read as "handed off" (false == 0 is TRUE in JS)', () => {
    // The orphan predicates compare against ZERO, the one value where `false` (getPageSetting's answer
    // for an absent key) loosely equals the literal. Strict equality is what keeps this inert.
    ;(globalThis as any).autoTrimpSettings = {}
    expect(keys()).not.toContain('buildingsOrphan')
    expect(keys()).not.toContain('jobsOrphan')
  })

  it('AutoStructure on while AT still buys buildings conflicts', () => {
    turnStructureOn()
    set('BuyBuildingsNew', 'multitoggle', 1) // Buy Buildings & Storage
    expect(keys()).toContain('autoStructure')
    set('BuyBuildingsNew', 'multitoggle', 0) // Buy Neither — the sanctioned handoff
    expect(keys()).not.toContain('autoStructure')
  })

  it('AutoJobs on while AT still buys jobs conflicts', () => {
    turnJobsOn()
    set('BuyJobsNew', 'multitoggle', 1)
    expect(keys()).toContain('autoJobs')
  })

  it('AutoStorage OFF with ImprovedAutoStorage unlocked is an inverse advisory', () => {
    ;(globalThis as any).game.global.improvedAutoStorage = true
    ;(globalThis as any).game.global.autoStorage = false
    expect(keys()).toContain('autoStorageOff')
    ;(globalThis as any).game.global.autoStorage = true
    expect(keys()).not.toContain('autoStorageOff')
  })

  // #150 review F1 — the orphan advisories key on the DISPATCH setting (BuyBuildingsNew / BuyJobsNew),
  // never on the cosmetic hidebuildings / HideJobBoxes. `hidebuildings` does not stop AT buying (its only
  // consumers conjoin it with BuyBuildingsNew===0, and main-loop.ts:290 dispatches buyBuildings BECAUSE
  // both are set), and `HideJobBoxes` has no behavioural consumer at all.
  it('Buy Neither + AutoStructure off is the orphan state, whatever Hide Buildings says', () => {
    set('BuyBuildingsNew', 'multitoggle', 0)
    expect(keys()).toContain('buildingsOrphan')
    // Hide Buildings on ⇒ still an orphan, just the Gyms-only flavour.
    set('hidebuildings', 'boolean', true)
    expect(keys()).toContain('buildingsOrphan')
    // AutoStructure on ⇒ the handoff is complete, no advisory.
    turnStructureOn()
    expect(keys()).not.toContain('buildingsOrphan')
  })

  it('Hide Buildings alone is NOT an orphan — AT is still buying everything', () => {
    // The false positive the first draft shipped: default BuyBuildingsNew=1 plus Hide Buildings ticked
    // on would have claimed "nothing is buying buildings" while buyBuildings+buyStorage ran every tick.
    set('BuyBuildingsNew', 'multitoggle', 1)
    set('hidebuildings', 'boolean', true)
    expect(keys()).not.toContain('buildingsOrphan')
  })

  it('the orphan body names the right flavour (Gyms-only vs nothing at all)', () => {
    set('BuyBuildingsNew', 'multitoggle', 0)
    const row = CONFLICTS.find((c) => c.key === 'buildingsOrphan')!
    set('hidebuildings', 'boolean', false)
    expect(row.body()).toContain('not even Gyms')
    set('hidebuildings', 'boolean', true)
    expect(row.body()).toContain('only Gyms')
  })

  it("Don't Buy Jobs + AutoJobs off is the orphan state; Hide Jobs is irrelevant", () => {
    set('BuyJobsNew', 'multitoggle', 0)
    expect(keys()).toContain('jobsOrphan')
    turnJobsOn()
    expect(keys()).not.toContain('jobsOrphan')
  })

  it('Hide Jobs alone is NOT an orphan — it has no behavioural consumer at all', () => {
    set('BuyJobsNew', 'multitoggle', 1)
    set('HideJobBoxes', 'boolean', true)
    expect(keys()).not.toContain('jobsOrphan')
  })

  // ── #187: "the button is lit" is not "the automation is buying" ────────────────────────────────
  describe('#187: an ON-but-unconfigured native automation invents no conflict', () => {
    it('AutoStructure enabled with no per-building keys is not buying, so no conflict', () => {
      // The exact state a player reaches by clicking the button on and never opening the cog:
      // config.js:245-248 seeds `{enabled: false}` with no sub-keys and the bwReward's fire only calls
      // toggleAutoStructure(true) (config.js:13407-13409). main.js:18250 then `continue`s past all 14
      // buildings, so native buys nothing at all.
      turnStructureOn(1, false)
      set('BuyBuildingsNew', 'multitoggle', 1)
      expect(keys()).not.toContain('autoStructure')
      // Open the cog and tick one building, and it becomes a real conflict.
      turnStructureOn(1, true)
      expect(keys()).toContain('autoStructure')
    })

    it('AutoJobs enabled with no per-job keys is not buying, so no conflict', () => {
      turnJobsOn(1, false)
      set('BuyJobsNew', 'multitoggle', 1)
      expect(keys()).not.toContain('autoJobs')
      turnJobsOn(1, true)
      expect(keys()).toContain('autoJobs')
    })

    // The other omitted gate. It is masked on the autoStructure/autoJobs rows by anchorVisible (their
    // buttons carry .autoUpgradeBtn{display:none}), but NOT on the orphan rows, which anchor to
    // buildingsTitleDiv/jobsTitleDiv — so a stale `enabled:true` there silenced the very advisory
    // those rows exist for. Drive the orphan direction, where the bug was actually reachable.
    it('a locked bwReward means the automation is not buying, so the orphan advisory still fires', () => {
      ;(globalThis as any).bwRewardUnlocked = () => false
      turnStructureOn(1, true)
      set('BuyBuildingsNew', 'multitoggle', 0)
      expect(keys()).toContain('buildingsOrphan')
      turnJobsOn(1, true)
      set('BuyJobsNew', 'multitoggle', 0)
      expect(keys()).toContain('jobsOrphan')
    })

    it('an unconfigured AutoStructure also leaves the buildings orphan advisory standing', () => {
      turnStructureOn(1, false)
      set('BuyBuildingsNew', 'multitoggle', 0)
      expect(keys()).toContain('buildingsOrphan')
    })

    // The near-miss this fix originally shipped, and the reason it is now a test. `buyAutoStructures`
    // tests each item TWICE: main.js:18250 `if (!setting[item]) continue` skips items the cog has
    // never written, and main.js:18264 `if (!locked && setting[item].enabled)` is the actual purchase
    // gate. saveAutoStructureConfig writes `enabled = false` rather than deleting, so an item
    // unchecked in the cog is PRESENT and disabled — and the game buys nothing for it. A presence
    // test calls that "both are buying".
    it('a structure sub-setting toggled back OFF does NOT count — the game skips it', () => {
      ;(globalThis as any).game.global.autoStructureSetting = {
        enabled: true,
        Hut: { enabled: false, value: '100', buyMax: 0 },
      }
      set('BuyBuildingsNew', 'multitoggle', 1)
      expect(keys()).not.toContain('autoStructure')
    })

    // …and the same state must leave the ORPHAN advisory standing, which is the direction where the
    // bug was actually reachable: those rows anchor to buildingsTitleDiv, which has no display rule,
    // so nothing else would have suppressed a wrong answer.
    it('an all-disabled AutoStructure still leaves the buildings orphan advisory standing', () => {
      ;(globalThis as any).game.global.autoStructureSetting = {
        enabled: true,
        Hut: { enabled: false, value: '100', buyMax: 0 },
      }
      set('BuyBuildingsNew', 'multitoggle', 0)
      expect(keys()).toContain('buildingsOrphan')
    })

    // The badge must still fire when ONE item is live among several dead ones — a fix that demanded
    // every item be enabled would be the opposite over-correction.
    it('one enabled item among disabled ones is still a real conflict', () => {
      ;(globalThis as any).game.global.autoStructureSetting = {
        enabled: true,
        Hut: { enabled: false, value: '100', buyMax: 0 },
        Gym: { enabled: true, value: '100', buyMax: 0 },
      }
      set('BuyBuildingsNew', 'multitoggle', 1)
      expect(keys()).toContain('autoStructure')
    })

    it('a job sub-setting toggled back OFF does NOT count — the game skips it', () => {
      ;(globalThis as any).game.global.autoJobsSetting = {
        enabled: true,
        Farmer: { enabled: false, ratio: 1, buyMax: 0 },
      }
      set('BuyJobsNew', 'multitoggle', 1)
      expect(keys()).not.toContain('autoJobs')
    })

    it('Gigastation alone arms AutoStructure, via its own .enabled gate (main.js:18278)', () => {
      ;(globalThis as any).game.global.autoStructureSetting = {
        enabled: true,
        Gigastation: { enabled: true, value: '1', buyMax: 1 },
      }
      set('BuyBuildingsNew', 'multitoggle', 1)
      expect(keys()).toContain('autoStructure')
    })
  })

  // ── AutoGold (#152) ───────────────────────────────────────────────────────────────────────────────
  // This row is the only one that compares two CHOICES rather than testing two booleans, because
  // golden upgrades are a scarce shared count: agreeing automations are harmless, disagreeing ones
  // race. Every test below is about that distinction.
  describe('AutoGold', () => {
    /** Native AutoGold mode, via the game's own universe-aware resolver (main.js:18082). */
    function nativeGold(mode: number) {
      ;(globalThis as any).game.global.autoGolden = mode
      ;(globalThis as any).game.global.autoGoldenU2 = mode
      ;(globalThis as any).getAutoGoldenSetting = () =>
        (globalThis as any).game.global.universe === 2
          ? (globalThis as any).game.global.autoGoldenU2
          : (globalThis as any).game.global.autoGolden
    }
    /** A dropdown stores its choice on `.selected`, not `.value` (utils.ts:72-73). */
    function atGold(id: string, selected: string) {
      ;(globalThis as any).autoTrimpSettings[id] = { id, type: 'dropdown', selected }
    }

    it('the same pool on both sides is NOT a conflict — the loser just finds nothing to buy', () => {
      nativeGold(2) // Battle
      atGold('AutoGoldenUpgrades', 'Battle')
      expect(keys()).not.toContain('autoGolden')
    })

    it('different pools ARE a conflict, and the body names both sides', () => {
      nativeGold(2) // Battle
      atGold('AutoGoldenUpgrades', 'Void')
      expect(keys()).toContain('autoGolden')
      const body = CONFLICTS.find((c) => c.key === 'autoGolden')!.body()
      expect(body).toContain('Void') // AT's side
      expect(body).toContain('Battle') // the game's side
      expect(body).toContain('Recommended')
    })

    it("U2's 'Radon' is the Helium pool, so it AGREES with native mode 1 (#152)", () => {
      // upgrades.ts:231-232 maps Radon onto Helium; comparing labels instead of pools would have
      // reported a permanent phantom conflict for every U2 player.
      setup(2)
      nativeGold(1)
      atGold('RAutoGoldenUpgrades', 'Radon')
      expect(keys()).not.toContain('autoGolden')
    })

    it('native Custom (mode 5) always disagrees — AT cannot express a hand-built order', () => {
      nativeGold(5)
      atGold('AutoGoldenUpgrades', 'Void')
      expect(keys()).toContain('autoGolden')
      expect(CONFLICTS.find((c) => c.key === 'autoGolden')!.body()).toContain('Custom')
    })

    it('Off (0) and hidden (-1) are both "not picking", so neither conflicts', () => {
      atGold('AutoGoldenUpgrades', 'Void')
      for (const mode of [0, -1]) {
        nativeGold(mode)
        expect(keys(), `mode ${mode}`).not.toContain('autoGolden')
      }
    })

    it('is inert without autoUpgradesAvailable — autoGoldenUpgrades() lives inside autoUpgrades()', () => {
      // main.js:18435-18436 + the single guarded caller at :19915. A shrine-4 player below HZE 59 can
      // have a visible "AutoGold Battle" button and zero golden automation actually running, which is
      // the same trap the autoPrestige row documents.
      ;(globalThis as any).game.global.autoUpgradesAvailable = false
      nativeGold(2)
      atGold('AutoGoldenUpgrades', 'Void')
      expect(keys()).not.toContain('autoGolden')
    })

    // ── #188: native bails out before buying, so there is no race ────────────────────────────────
    it('#188: native mode 1 during a Challenge2 buys NOTHING, so no conflict', () => {
      // main.js:18591 `if (selected == "Helium" && game.global.runningChallengeSquared) return;` —
      // native returns BEFORE buyGoldenUpgrade. AT's C2 dropdown has no Helium option at all
      // (settings-defs.ts:2669-2672), so the two sides could never agree and this fired on EVERY C2
      // run with the native button on its first mode, recommending the user hand goldens to an
      // automation that buys none.
      ;(globalThis as any).game.global.runningChallengeSquared = true
      nativeGold(1)
      atGold('cAutoGoldenUpgrades', 'Battle')
      expect(keys()).not.toContain('autoGolden')
    })

    it('#188: native mode 1 OUTSIDE a Challenge2 still conflicts', () => {
      // The other side of the same guard — a mutant that treats mode 1 as "never picking" fails here.
      nativeGold(1)
      atGold('AutoGoldenUpgrades', 'Battle')
      expect(keys()).toContain('autoGolden')
    })

    it('#188: mode 3 reaches the same bail-out once Void is capped', () => {
      // main.js:18584-18588 rewrites a capped Void to Helium for mode 3, which then hits the same
      // `return`. Naming only mode 1 would have left the identical false positive from a second
      // direction — the finding's own scope is a claim.
      ;(globalThis as any).game.global.runningChallengeSquared = true
      ;(globalThis as any).game.goldenUpgrades = { Void: { currentBonus: 0.7, nextAmt: () => 0.05 } }
      nativeGold(3)
      atGold('cAutoGoldenUpgrades', 'Battle')
      expect(keys()).not.toContain('autoGolden') // 0.75 > 0.72 → Helium → native returns

      // Below the cap it is a genuine Void purchase, and Battle vs Void is a real race.
      ;(globalThis as any).game.goldenUpgrades = { Void: { currentBonus: 0.1, nextAmt: () => 0.05 } }
      expect(keys()).toContain('autoGolden')
    })

    // ── #195: AT's own U2 override was missing from the comparison ────────────────────────────────
    describe('#195: the U2 Mayhem/Pandemonium/Desolation Battle override', () => {
      for (const challenge of ['Mayhem', 'Pandemonium', 'Desolation']) {
        it(`${challenge}: AT really buys Battle, so native Battle AGREES`, () => {
          // upgrades.ts:241-243 forces setting2 = "Battle" after every other assignment, immediately
          // before buyGoldenUpgrade. Reporting the configured pool instead printed "AT is set to buy
          // Helium" and fired a row while the two sides actually agreed.
          setup(2)
          ;(globalThis as any).game.global.challengeActive = challenge
          nativeGold(2) // Battle
          atGold('RAutoGoldenUpgrades', 'Radon')
          expect(keys()).not.toContain('autoGolden')
        })
      }

      it('the mirror case: a REAL conflict the old code missed', () => {
        // RAutoGoldenUpgrades='Void' with native on Void produced no badge, yet AT buys Battle.
        setup(2)
        ;(globalThis as any).game.global.challengeActive = 'Mayhem'
        ;(globalThis as any).game.goldenUpgrades = { Void: { currentBonus: 0.1, nextAmt: () => 0.05 } }
        nativeGold(3) // Void
        atGold('RAutoGoldenUpgrades', 'Void')
        expect(keys()).toContain('autoGolden')
      })

      it('does not apply in U1 — other.ts has no such override', () => {
        ;(globalThis as any).game.global.challengeActive = 'Mayhem'
        nativeGold(2) // Battle
        atGold('AutoGoldenUpgrades', 'Helium')
        expect(keys()).toContain('autoGolden')
      })

      it('does not apply to an unrelated U2 challenge', () => {
        setup(2)
        ;(globalThis as any).game.global.challengeActive = 'Daily'
        nativeGold(2)
        atGold('RdAutoGoldenUpgrades', 'Radon')
        expect(keys()).toContain('autoGolden')
      })
    })

    it('a MISSING AT golden setting is no conflict — `false != "Off"` is TRUE (#68)', () => {
      // The trap this pins: getPageSetting returns `false` for a key absent from a veteran's store, and
      // a bare `!= 'Off'` test would therefore fire for every user who never touched the dropdown.
      nativeGold(2)
      expect((globalThis as any).autoTrimpSettings.AutoGoldenUpgrades).toBeUndefined()
      expect(keys()).not.toContain('autoGolden')
    })

    it('picks the CONTEXT-correct setting: the Daily one during a Daily', () => {
      // main-loop.ts:424-425 gates the normal strategy off during a Daily. Reading the normal setting
      // regardless would report a conflict from a dropdown that is not dispatching.
      nativeGold(2) // Battle
      atGold('AutoGoldenUpgrades', 'Void') // would disagree, but is gated off
      atGold('dAutoGoldenUpgrades', 'Battle') // the one that actually dispatches: agrees
      ;(globalThis as any).game.global.challengeActive = 'Daily'
      expect(keys()).not.toContain('autoGolden')

      atGold('dAutoGoldenUpgrades', 'Void') // now the dispatching one disagrees
      expect(keys()).toContain('autoGolden')
    })

    it('uses the C2 setting during a Challenge2', () => {
      nativeGold(2)
      atGold('cAutoGoldenUpgrades', 'Void')
      ;(globalThis as any).game.global.runningChallengeSquared = true
      expect(keys()).toContain('autoGolden')
    })
  })

  // ── AutoEquip (#152) ──────────────────────────────────────────────────────────────────────────────
  // The row this pins was gated on an A/B, not an argument: at 10% native AutoEquip bought 2.9x the
  // equipment levels for IDENTICAL zone progress, and at 50% it was 5.5% slower on both fixtures
  // (noise floor 1.5-2.2%). So the conflict is real, and it is about LEVELS specifically.
  describe('AutoEquip', () => {
    function nativeEquip(enabled: boolean, unlocked = true) {
      ;(globalThis as any).game.global.autoEquipUnlocked = unlocked
      ;(globalThis as any).game.global.autoEquipSetting = { enabled }
      ;(globalThis as any).game.global.autoEquipSettingU2 = { enabled }
      ;(globalThis as any).getAutoEquipSetting = () =>
        (globalThis as any).game.global.universe === 2
          ? (globalThis as any).game.global.autoEquipSettingU2
          : (globalThis as any).game.global.autoEquipSetting
    }

    it('native AutoEquip on while AT buys LEVELS conflicts', () => {
      nativeEquip(true)
      set('BuyWeaponsNew', 'multitoggle', 1) // "Buy Both" — includes levels
      expect(keys()).toContain('autoEquip')
    })

    it('option 3 ("Levels") also conflicts — it is the other level-buying index', () => {
      nativeEquip(true)
      set('BuyArmorNew', 'multitoggle', 3)
      expect(keys()).toContain('autoEquip')
    })

    it('option 2 ("Prestiges") does NOT conflict — AT is not buying levels at all', () => {
      // This is the partition that makes the row honest: the autoPrestige row owns {1,2} of this same
      // multitoggle, this row owns {1,3}. On 2 the two automations are a clean hand-off, not a fight.
      nativeEquip(true)
      set('BuyWeaponsNew', 'multitoggle', 2)
      set('BuyArmorNew', 'multitoggle', 2)
      expect(keys()).not.toContain('autoEquip')
    })

    it('is inert while autoEquipUnlocked is false — buyAutoEquip() returns early (main.js:18331)', () => {
      nativeEquip(true, false)
      set('BuyWeaponsNew', 'multitoggle', 1)
      expect(keys()).not.toContain('autoEquip')
    })

    it('native master toggle off is no conflict, however AT is configured', () => {
      nativeEquip(false)
      set('BuyWeaponsNew', 'multitoggle', 1)
      expect(keys()).not.toContain('autoEquip')
    })

    it('U2 reads Requipon, not the U1 multitoggles', () => {
      setup(2)
      nativeEquip(true)
      set('BuyWeaponsNew', 'multitoggle', 1) // meaningless in U2 — must not be what fires
      expect(keys()).not.toContain('autoEquip')
      set('Requipon', 'boolean', true)
      expect(keys()).toContain('autoEquip')
    })

    it('a MISSING AT setting never fires a phantom conflict (#68)', () => {
      nativeEquip(true)
      expect((globalThis as any).autoTrimpSettings.BuyWeaponsNew).toBeUndefined()
      expect(keys()).not.toContain('autoEquip')
    })
  })

  it('a throwing predicate is inactive, never fatal', () => {
    delete (globalThis as any).game
    expect(() => activeConflicts()).not.toThrow()
    expect(activeConflicts()).toEqual([])
  })

  it('every row has a non-empty title and body, and a distinct key', () => {
    expect(new Set(CONFLICTS.map((c) => c.key)).size).toBe(CONFLICTS.length)
    for (const c of CONFLICTS) {
      expect(c.title.length).toBeGreaterThan(0)
      expect(c.body().length).toBeGreaterThan(80) // a one-liner is not an explanation
      expect(c.anchorId.length).toBeGreaterThan(0)
    }
  })

  it('no row mutates game state (advisory only)', () => {
    const before = JSON.stringify((globalThis as any).game.global)
    for (const c of CONFLICTS) {
      try {
        c.when()
        c.body()
      } catch {
        /* covered above */
      }
    }
    expect(JSON.stringify((globalThis as any).game.global)).toBe(before)
  })
})
