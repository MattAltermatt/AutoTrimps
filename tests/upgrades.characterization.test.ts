// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// Phase-2 characterization net for upgrades.ts (proof-net #51) — the FIRST actuator module.
// Two archetypes per the design spec (§4):
//   L1a pure-predicate golden masters — gigaTargetZone (target-zone selector) + autoGiga
//     (the giga-delta math). Return == frozen value, branch-covered.
//   L1b actuator spy-logs — firstGiga / buyUpgrades / RbuyUpgrades / RautoGoldenUpgradesAT.
//     Their RETURN is (mostly) meaningless; the CONTRACT is the ordered native-mutator call log:
//     buyUpgrade(name,true,true) / buyGoldenUpgrade(setting) / setPageSetting(id,value). We spy
//     those and assert the EXACT ordered sequence across branch-arming fixtures.
// These lock current faithful-port behaviour BEFORE the idiomatic un-minify so a transcription
// slip fails loudly.

let upgrades: typeof import('../src/modules/upgrades')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  upgrades = await import('../src/modules/upgrades')
})

// ── shared native-mutator spies ─────────────────────────────────────────────────────────────────
let buyUpgradeCalls: unknown[][]
let goldenCalls: unknown[][]
function installSpies(goldenSuccess: (setting: unknown) => boolean = () => true) {
  buyUpgradeCalls = []
  goldenCalls = []
  ;(globalThis as any).buyUpgrade = vi.fn((...args: unknown[]) => buyUpgradeCalls.push(args))
  ;(globalThis as any).buyGoldenUpgrade = vi.fn((setting: unknown) => {
    goldenCalls.push([setting])
    return goldenSuccess(setting)
  })
}

// getPageSetting/setPageSetting/debug are REAL imports inside upgrades.ts; they read/write the
// global `autoTrimpSettings`. Seeding it (never mocking the util) is the jobs.ts precedent. Spam*
// settings left unset → getPageSetting returns false → debug() short-circuits to a no-op.
afterEach(() => {
  for (const k of [
    'game', 'autoTrimpSettings', 'buyUpgrade', 'buyGoldenUpgrade', 'canAffordTwoLevel',
    'canAffordCoordinationTrimps', 'calcHDratio', 'getEmpowerment', 'bwRewardUnlocked',
    'getPerSecBeforeManual', 'getAvailableGoldenUpgrades', 'enoughHealth', 'enoughDamage',
    'Rhyposhouldwood',
  ]) delete (globalThis as any)[k]
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — gigaTargetZone (pure target-zone selector)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('upgrades.gigaTargetZone — L1a golden master (target-zone selector)', () => {
  it('failsafe: no void/portal/challenge target < 60 → max(65, highestLevelCleared)', () => {
    ;(globalThis as any).autoTrimpSettings = { AutoPortal: { selected: 'Off' } }
    ;(globalThis as any).game = makeMinimalGame({
      global: { challengeActive: '', runningChallengeSquared: false, highestLevelCleared: 50, world: 100 },
      challenges: {},
    })
    // targetZone starts 59 (< 60) → failsafe max(65, 50) = 65
    expect(upgrades.gigaTargetZone()).toBe(65)
  })

  it('VoidMaps target raises the floor above 59', () => {
    ;(globalThis as any).autoTrimpSettings = {
      AutoPortal: { selected: 'Off' },
      VoidMaps: { type: 'value', value: 100 },
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { challengeActive: '', runningChallengeSquared: false, highestLevelCleared: 50, world: 100 },
      challenges: {},
    })
    expect(upgrades.gigaTargetZone()).toBe(100)
  })

  it('AutoPortal=Custom uses CustomAutoPortal-1 as the portal target', () => {
    ;(globalThis as any).autoTrimpSettings = {
      AutoPortal: { selected: 'Custom' },
      CustomAutoPortal: { type: 'value', value: 250 },
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { challengeActive: '', runningChallengeSquared: false, highestLevelCleared: 50, world: 100 },
      challenges: {},
    })
    // max(59, void=false, challenge=0, portal-1=249) = 249
    expect(upgrades.gigaTargetZone()).toBe(249)
  })

  it('C2 run: uses c2runnerportal-1 when c2runnerstart is on', () => {
    ;(globalThis as any).autoTrimpSettings = {
      AutoPortal: { selected: 'Off' },
      c2runnerstart: { type: 'boolean', enabled: true },
      c2runnerportal: { type: 'value', value: 300 },
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { challengeActive: '', runningChallengeSquared: true, highestLevelCleared: 50, world: 100 },
      challenges: {},
    })
    // runningC2 → max(59, c2zone-1 = 299) = 299
    expect(upgrades.gigaTargetZone()).toBe(299)
  })

  it('target-fuel-zone caps the result to max(230, fuellater)', () => {
    ;(globalThis as any).autoTrimpSettings = {
      AutoPortal: { selected: 'Off' },
      VoidMaps: { type: 'value', value: 500 },
      fuellater: { type: 'value', value: 350 },
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { challengeActive: '', runningChallengeSquared: false, highestLevelCleared: 50, world: 100 },
      challenges: {},
    })
    // targetZone 500, fuel cap → min(500, max(230, 350)) = 350
    expect(upgrades.gigaTargetZone()).toBe(350)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — autoGiga (the giga-delta math)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('upgrades.autoGiga — L1a golden master (giga-delta math)', () => {
  function setup(frugalDone: boolean) {
    ;(globalThis as any).getPerSecBeforeManual = vi.fn((job: string) => (job === 'Miner' ? 200 : 100))
    ;(globalThis as any).autoTrimpSettings = { FirstGigastation: { type: 'value', value: 10 } }
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 90, frugalDone },
      resources: { trimps: { max: 1e6 } },
      unlocks: { impCount: { TauntimpAdded: 0 } },
    })
  }

  it('finite delta for a near-target build (megabook 1.5, non-frugal)', () => {
    setup(false)
    // explicit args: targetZone 100, metalRatio 0.5, slowDown 10, customBase 10
    expect(upgrades.autoGiga(100, 0.5, 10, 10)).toBe(-0.4)
  })

  it('frugalDone bumps megabook 1.5 → 1.6, changing the delta', () => {
    setup(true)
    expect(upgrades.autoGiga(100, 0.5, 10, 10)).toBe(-0.22)
  })

  it('queries gems (Dragimp) and metal (Miner) per-sec exactly once each', () => {
    setup(false)
    upgrades.autoGiga(100, 0.5, 10, 10)
    const calls = ((globalThis as any).getPerSecBeforeManual as any).mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toEqual(['Dragimp', 'Miner'])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — firstGiga (actuator: setPageSetting FirstGigastation + DeltaGigastation)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('upgrades.firstGiga — L1b actuator (giga-pattern setPageSetting log)', () => {
  it('forced: computes delta from autoGiga and writes both giga settings, returns true', () => {
    // b/c/d are evaluated unconditionally even under `forced`; stub their leaf deps.
    ;(globalThis as any).canAffordCoordinationTrimps = () => true
    ;(globalThis as any).canAffordTwoLevel = () => true
    ;(globalThis as any).enoughHealth = true
    ;(globalThis as any).enoughDamage = true
    ;(globalThis as any).getPerSecBeforeManual = (job: string) => (job === 'Miner' ? 200 : 100)
    ;(globalThis as any).autoTrimpSettings = {
      AutoPortal: { selected: 'Off' },
      VoidMaps: { type: 'value', value: 100 }, // gigaTargetZone → 100 (near world 90)
      FirstGigastation: { type: 'value', value: 10 },
      DeltaGigastation: { type: 'value', value: 0 },
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 90, frugalDone: false, challengeActive: '', runningChallengeSquared: false, highestLevelCleared: 50 },
      buildings: { Warpstation: { owned: 10 } },
      resources: { trimps: { max: 1e6 } },
      unlocks: { impCount: { TauntimpAdded: 0 } },
      challenges: {},
    })
    expect(upgrades.firstGiga(true)).toBe(true)
    // base = Warpstation.owned = 10; delta = autoGiga(gigaTargetZone()=100, 0.5, 10) = -0.4
    expect((globalThis as any).autoTrimpSettings.FirstGigastation.value).toBe(10)
    expect((globalThis as any).autoTrimpSettings.DeltaGigastation.value).toBe(-0.4)
  })

  it('non-forced with unmet gates (< 2 warps) returns false and writes nothing', () => {
    ;(globalThis as any).canAffordCoordinationTrimps = () => true
    ;(globalThis as any).canAffordTwoLevel = () => true
    ;(globalThis as any).enoughHealth = true
    ;(globalThis as any).enoughDamage = true
    ;(globalThis as any).autoTrimpSettings = {
      DeltaGigastation: { type: 'value', value: 0 },
      FirstGigastation: { type: 'value', value: 10 },
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 90, mapBonus: 0, challengeActive: '' },
      buildings: { Warpstation: { owned: 0 } }, // a = owned >= 2 → false → gate fails
      upgrades: { Coordination: { allowed: 0, done: 0 } },
    })
    expect(upgrades.firstGiga()).toBe(false)
    expect((globalThis as any).autoTrimpSettings.DeltaGigastation.value).toBe(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — buyUpgrades (helium upgrade purchase loop)
// ════════════════════════════════════════════════════════════════════════════════════════════════
function upgradesMap(armed: Record<string, { allowed: number; done: number }>) {
  const ups: Record<string, { allowed: number; done: number }> = {}
  for (const name of (globalThis as any).upgradeList as string[]) ups[name] = { allowed: 0, done: 0 }
  for (const name of (globalThis as any).RupgradeList as string[]) if (!ups[name]) ups[name] = { allowed: 0, done: 0 }
  for (const [k, v] of Object.entries(armed)) ups[k] = v
  return ups
}

describe('upgrades.buyUpgrades — L1b actuator spy-log (helium upgrade loop)', () => {
  beforeEach(() => {
    installSpies()
    ;(globalThis as any).canAffordTwoLevel = () => true
    ;(globalThis as any).canAffordCoordinationTrimps = () => true
    ;(globalThis as any).calcHDratio = () => 10
    ;(globalThis as any).getEmpowerment = () => ''
    ;(globalThis as any).bwRewardUnlocked = () => false
  })

  function baseGame(armed: Record<string, { allowed: number; done: number }>, over: Record<string, unknown> = {}) {
    return makeMinimalGame({
      upgrades: upgradesMap(armed),
      buildings: { Warpstation: { owned: 0 } },
      jobs: { Amalgamator: { owned: 0 } },
      global: { world: 90, challengeActive: '', lastWarp: false, runningChallengeSquared: false },
      resources: { trimps: { realMax: () => 1000, getCurrentSend: () => 1 } },
      ...over,
    })
  }

  it('buys a single armed, affordable upgrade', () => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = baseGame({ Battle: { allowed: 1, done: 0 } })
    upgrades.buyUpgrades()
    expect(buyUpgradeCalls).toEqual([['Battle', true, true]])
  })

  it('Scientists-first invariant: an unmaxed Scientists blocks every other upgrade', () => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = baseGame({
      Scientists: { allowed: 1, done: 0 },
      Battle: { allowed: 1, done: 0 },
    })
    upgrades.buyUpgrades()
    // Scientists buys (index 1); Battle (index 17) is blocked because Scientists.done<allowed still
    expect(buyUpgradeCalls).toEqual([['Scientists', true, true]])
  })

  it('Coordination skipped when BuyUpgradesNew == 2', () => {
    ;(globalThis as any).autoTrimpSettings = { BuyUpgradesNew: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = baseGame({ Coordination: { allowed: 1, done: 0 } })
    upgrades.buyUpgrades()
    expect(buyUpgradeCalls).toEqual([])
  })

  it('Coordination bought on the normal path (BuyUpgradesNew == 1, no WS/amal guards)', () => {
    ;(globalThis as any).autoTrimpSettings = { BuyUpgradesNew: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = baseGame({ Coordination: { allowed: 1, done: 0 } })
    upgrades.buyUpgrades()
    expect(buyUpgradeCalls).toEqual([['Coordination', true, true]])
  })

  it('Gigastation delta gate: blocked when owned < floor(done*delta)+first', () => {
    ;(globalThis as any).autoTrimpSettings = {
      DeltaGigastation: { type: 'value', value: 2 },
      FirstGigastation: { type: 'value', value: 10 },
    }
    ;(globalThis as any).game = baseGame(
      { Gigastation: { allowed: 10, done: 5 } },
      { buildings: { Warpstation: { owned: 15 } } }, // 15 < floor(5*2)+10 = 20 → skip
    )
    upgrades.buyUpgrades()
    expect(buyUpgradeCalls).toEqual([])
  })

  it('Gigastation delta gate: bought when owned >= floor(done*delta)+first', () => {
    ;(globalThis as any).autoTrimpSettings = {
      DeltaGigastation: { type: 'value', value: 2 },
      FirstGigastation: { type: 'value', value: 10 },
    }
    ;(globalThis as any).game = baseGame(
      { Gigastation: { allowed: 10, done: 5 } },
      { buildings: { Warpstation: { owned: 25 } } }, // 25 >= 20 → buys
    )
    upgrades.buyUpgrades()
    expect(buyUpgradeCalls).toEqual([['Gigastation', true, true]])
  })

  // ── branch-arming fixtures driving each ==→=== converted guard to its LIVE/true state ──────────
  // (proof-net template discipline: a mistranscription in these guards must fail loudly).

  it('amalcoord guard skips Coordination when the full AND chain evaluates true', () => {
    ;(globalThis as any).autoTrimpSettings = {
      amalcoord: { type: 'boolean', enabled: true },
      amalcoordhd: { type: 'value', value: 20 }, // > 0 and > calcHDratio()==10
      amalcoordt: { type: 'valueNegative', value: -1 }, // < 0 arm
      amalcoordz: { type: 'valueNegative', value: -1 }, // amalcoordz < 0 → inner OR true
    }
    ;(globalThis as any).game = baseGame({ Coordination: { allowed: 1, done: 0 } })
    upgrades.buyUpgrades()
    expect(buyUpgradeCalls).toEqual([])
  })

  it('Wind-stacking guard skips Coordination (non-daily, challengeActive !== "Daily" live)', () => {
    ;(globalThis as any).getEmpowerment = () => 'Wind'
    ;(globalThis as any).calcHDratio = () => 0 // < 5
    ;(globalThis as any).autoTrimpSettings = {
      AutoStance: { type: 'multitoggle', value: 3 },
      WindStackingMin: { type: 'value', value: 50 },
    }
    ;(globalThis as any).game = baseGame({ Coordination: { allowed: 1, done: 0 } }) // world 90, challengeActive ''
    upgrades.buyUpgrades()
    expect(buyUpgradeCalls).toEqual([])
  })

  it('wsmax guard skips Coordination (non-daily, challengeActive !== "Daily" live)', () => {
    ;(globalThis as any).autoTrimpSettings = {
      AutoStance: { type: 'multitoggle', value: 3 },
      wsmax: { type: 'value', value: 50 },
      wsmaxhd: { type: 'value', value: 20 }, // calcHDratio()==10 < 20
    }
    ;(globalThis as any).game = baseGame({ Coordination: { allowed: 1, done: 0 } })
    upgrades.buyUpgrades()
    expect(buyUpgradeCalls).toEqual([])
  })

  it('fuckbuildinggiga===true bypasses BOTH Gigastation delta gates and buys anyway', () => {
    ;(globalThis as any).bwRewardUnlocked = () => true // AutoStructure===true && DecaBuild
    ;(globalThis as any).autoTrimpSettings = {
      hidebuildings: { type: 'boolean', enabled: true },
      BuyBuildingsNew: { type: 'multitoggle', value: 0 },
    }
    ;(globalThis as any).game = baseGame(
      { Gigastation: { allowed: 10, done: 5 } },
      { buildings: { Warpstation: { owned: 0 } } }, // would fail the delta gate on the normal path
    )
    upgrades.buyUpgrades()
    expect(buyUpgradeCalls).toEqual([['Gigastation', true, true]])
  })

  it('AutoGigas invokes firstGiga() from the loop; its setPageSetting log flows through', () => {
    ;(globalThis as any).canAffordCoordinationTrimps = () => false // firstGiga gate b → true
    ;(globalThis as any).enoughHealth = true
    ;(globalThis as any).enoughDamage = true
    ;(globalThis as any).getPerSecBeforeManual = (job: string) => (job === 'Miner' ? 200 : 100)
    ;(globalThis as any).autoTrimpSettings = {
      AutoPortal: { selected: 'Off' },
      VoidMaps: { type: 'value', value: 100 }, // gigaTargetZone → 100 (near world 90)
      AutoGigas: { type: 'boolean', enabled: true },
      FirstGigastation: { type: 'value', value: 10 },
      DeltaGigastation: { type: 'value', value: 0 },
    }
    ;(globalThis as any).game = baseGame(
      { Gigastation: { allowed: 10, done: 0 } },
      {
        global: { world: 90, challengeActive: '', lastWarp: false, runningChallengeSquared: false, highestLevelCleared: 50, frugalDone: false },
        buildings: { Warpstation: { owned: 10 } },
        resources: { trimps: { realMax: () => 1000, getCurrentSend: () => 1, max: 1e6 } },
        unlocks: { impCount: { TauntimpAdded: 0 } },
        challenges: {},
      },
    )
    upgrades.buyUpgrades()
    // firstGiga ran (done===0 branch) → wrote pattern: FirstGigastation=owned 10, DeltaGigastation=-0.4
    expect((globalThis as any).autoTrimpSettings.DeltaGigastation.value).toBe(-0.4)
    expect((globalThis as any).autoTrimpSettings.FirstGigastation.value).toBe(10)
    // …and Gigastation was then bought
    expect(buyUpgradeCalls).toEqual([['Gigastation', true, true]])
  })

  it('Shieldblock skipped when BuyShieldblock is off', () => {
    ;(globalThis as any).autoTrimpSettings = {} // BuyShieldblock unset → false
    ;(globalThis as any).game = baseGame({ Shieldblock: { allowed: 1, done: 0 } })
    upgrades.buyUpgrades()
    expect(buyUpgradeCalls).toEqual([])
  })

  it('Bloodlust skipped under the Scientist challenge with BetterAutoFight on', () => {
    ;(globalThis as any).autoTrimpSettings = { BetterAutoFight: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = baseGame(
      { Bloodlust: { allowed: 1, done: 0 } },
      { global: { world: 90, challengeActive: 'Scientist', lastWarp: false, runningChallengeSquared: false } },
    )
    upgrades.buyUpgrades()
    expect(buyUpgradeCalls).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — RbuyUpgrades (radon upgrade purchase loop)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('upgrades.RbuyUpgrades — L1b actuator spy-log (radon upgrade loop)', () => {
  beforeEach(() => {
    installSpies()
    ;(globalThis as any).canAffordTwoLevel = () => true
    ;(globalThis as any).canAffordCoordinationTrimps = () => true
    ;(globalThis as any).Rhyposhouldwood = true
  })

  function baseGame(armed: Record<string, { allowed: number; done: number }>) {
    return makeMinimalGame({
      upgrades: upgradesMap(armed),
      global: { world: 90, challengeActive: '' },
    })
  }

  it('buys a single armed, affordable radon upgrade', () => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = baseGame({ Battle: { allowed: 1, done: 0 } })
    upgrades.RbuyUpgrades()
    expect(buyUpgradeCalls).toEqual([['Battle', true, true]])
  })

  it('Coordination skipped when RBuyUpgradesNew == 2', () => {
    ;(globalThis as any).autoTrimpSettings = { RBuyUpgradesNew: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = baseGame({ Coordination: { allowed: 1, done: 0 } })
    upgrades.RbuyUpgrades()
    expect(buyUpgradeCalls).toEqual([])
  })

  it('Scientists-first invariant holds for the radon loop too', () => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = baseGame({
      Scientists: { allowed: 1, done: 0 },
      Battle: { allowed: 1, done: 0 },
    })
    upgrades.RbuyUpgrades()
    expect(buyUpgradeCalls).toEqual([['Scientists', true, true]])
  })

  // #53 regression: 'Supershield' (a Shield equipment prestige) is not a member of RupgradeList, so
  // the loop never visits it — the deleted `upgrade === 'Supershield' && !Rhyposhouldwood` guard was
  // unreachable. Even armed & affordable, with Rhyposhouldwood false (the guard's trigger), it is
  // never bought here; the real Hypothermia/wood gating lives in equipment.ts.
  it('#53 never buys Supershield (∉ RupgradeList) even with Rhyposhouldwood false — deleted guard was dead', () => {
    ;(globalThis as any).Rhyposhouldwood = false
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = baseGame({
      Supershield: { allowed: 1, done: 0 }, // armed & affordable, yet never iterated
      Battle: { allowed: 1, done: 0 },
    })
    upgrades.RbuyUpgrades()
    expect(buyUpgradeCalls).toEqual([['Battle', true, true]])
    expect(buyUpgradeCalls.some(c => c[0] === 'Supershield')).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — RautoGoldenUpgradesAT (radon golden-upgrade selector)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('upgrades.RautoGoldenUpgradesAT — L1b actuator spy-log (golden-upgrade selector)', () => {
  function goldenGame(over: Record<string, unknown> = {}) {
    return makeMinimalGame({
      global: { challengeActive: '', runningChallengeSquared: false, dailyChallenge: { seed: 0 }, world: 200 },
      goldenUpgrades: {
        Helium: { purchasedAt: { length: 0 } },
        Battle: { purchasedAt: { length: 0 } },
      },
      ...over,
    })
  }
  function settings(over: Record<string, unknown> = {}) {
    return {
      RAutoGoldenUpgrades: { selected: 'Helium' },
      RdAutoGoldenUpgrades: { selected: 'Helium' },
      RcAutoGoldenUpgrades: { selected: 'Helium' },
      ...over,
    }
  }

  it('no available golden upgrades → returns immediately, buys nothing', () => {
    installSpies()
    ;(globalThis as any).getAvailableGoldenUpgrades = () => 0
    ;(globalThis as any).autoTrimpSettings = settings()
    ;(globalThis as any).game = goldenGame()
    upgrades.RautoGoldenUpgradesAT('Void')
    expect(goldenCalls).toEqual([])
  })

  it('setting "Battle" buys the Battle golden upgrade', () => {
    installSpies()
    ;(globalThis as any).getAvailableGoldenUpgrades = () => 1
    ;(globalThis as any).autoTrimpSettings = settings()
    ;(globalThis as any).game = goldenGame()
    upgrades.RautoGoldenUpgradesAT('Battle')
    expect(goldenCalls).toEqual([['Battle']])
  })

  it('Mayhem forces the Battle golden upgrade regardless of setting', () => {
    installSpies()
    ;(globalThis as any).getAvailableGoldenUpgrades = () => 1
    ;(globalThis as any).autoTrimpSettings = settings()
    ;(globalThis as any).game = goldenGame({
      global: { challengeActive: 'Mayhem', runningChallengeSquared: false, dailyChallenge: { seed: 0 }, world: 200 },
    })
    upgrades.RautoGoldenUpgradesAT('Void')
    expect(goldenCalls).toEqual([['Battle']])
  })

  it('setting "Radon" + Rradonbattle threshold met → buys Battle', () => {
    installSpies()
    ;(globalThis as any).getAvailableGoldenUpgrades = () => 1
    ;(globalThis as any).autoTrimpSettings = settings({
      RAutoGoldenUpgrades: { selected: 'Radon' },
      Rradonbattle: { type: 'value', value: 1 },
    })
    ;(globalThis as any).game = goldenGame({
      goldenUpgrades: { Helium: { purchasedAt: { length: 1 } }, Battle: { purchasedAt: { length: 0 } } },
    })
    upgrades.RautoGoldenUpgradesAT('Radon')
    expect(goldenCalls).toEqual([['Battle']])
  })

  it('Void that fails first falls back to a Helium retry', () => {
    installSpies((setting) => setting !== 'Void') // Void purchase fails, others succeed
    ;(globalThis as any).getAvailableGoldenUpgrades = () => 1
    ;(globalThis as any).autoTrimpSettings = settings({ RAutoGoldenUpgrades: { selected: 'Void' } })
    ;(globalThis as any).game = goldenGame()
    upgrades.RautoGoldenUpgradesAT('Void')
    // 1st buyGoldenUpgrade("Void") fails → retry path picks "Helium"
    expect(goldenCalls).toEqual([['Void'], ['Helium']])
  })

  it('setting "Battle" + Rbattleradon threshold met → flips Battle back to Helium', () => {
    installSpies()
    ;(globalThis as any).getAvailableGoldenUpgrades = () => 1
    ;(globalThis as any).autoTrimpSettings = settings({
      RAutoGoldenUpgrades: { selected: 'Battle' },
      Rbattleradon: { type: 'value', value: 1 },
    })
    ;(globalThis as any).game = goldenGame({
      goldenUpgrades: { Helium: { purchasedAt: { length: 0 } }, Battle: { purchasedAt: { length: 1 } } },
    })
    upgrades.RautoGoldenUpgradesAT('Battle')
    expect(goldenCalls).toEqual([['Helium']])
  })

  it('setting "Void + Battle" selects the Void golden upgrade', () => {
    installSpies() // all succeed → no retry
    ;(globalThis as any).getAvailableGoldenUpgrades = () => 1
    ;(globalThis as any).autoTrimpSettings = settings()
    ;(globalThis as any).game = goldenGame()
    upgrades.RautoGoldenUpgradesAT('Void + Battle')
    expect(goldenCalls).toEqual([['Void']])
  })

  it('Void retry with "Void + Battle" selected picks Battle on the second round', () => {
    installSpies((setting) => setting !== 'Void') // Void fails → enters retry block
    ;(globalThis as any).getAvailableGoldenUpgrades = () => 1
    ;(globalThis as any).autoTrimpSettings = settings({ RAutoGoldenUpgrades: { selected: 'Void + Battle' } })
    ;(globalThis as any).game = goldenGame()
    upgrades.RautoGoldenUpgradesAT('Void + Battle')
    // retry: selected "Void + Battle" (non-daily, non-C2) → setting2 = "Battle"
    expect(goldenCalls).toEqual([['Void'], ['Battle']])
  })
})
