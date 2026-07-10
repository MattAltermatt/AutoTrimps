// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// Phase-2 characterization net for magmite.ts (proof-net #51) — an actuator module (the
// magmite/generator spender). Two archetypes per the design spec (§4):
//   L1a pure-predicate golden masters — calcMiSpent (spent-magmite formula) + miRatio (the
//     next-spend ratio selector). Return == frozen value, branch-covered.
//   L1b actuator spy-logs — autoMagmiteSpender / autoGenerator. Their RETURN is meaningless;
//     the CONTRACT is the ordered native-mutator call log: buyGeneratorUpgrade(item) /
//     buyPermanentGeneratorUpgrade(item) / changeGeneratorState(mode). We spy those and assert
//     the EXACT ordered sequence across branch-arming fixtures.
// These lock current faithful-port behaviour BEFORE the idiomatic un-minify so a transcription
// slip fails loudly. Every ==→=== / !=→!== the refactor will touch is driven to its live state
// by some fixture below (miRatio's four `ratios[0] == Xfinal` return branches + the `Xfinal != -1`
// exclusion guard; MODULES.algorithm === 2; autoGenerator's generatorMode ==/!= 1|2 guards).

let magmite: typeof import('../src/modules/magmite')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  magmite = await import('../src/modules/magmite')
})

// ── shared native-mutator spies (one ordered cross-mutator log) ──────────────────────────────────
let mutatorLog: { fn: string; args: unknown[] }[]
function installSpies(onBuyGenerator?: (item: unknown) => void) {
  mutatorLog = []
  ;(globalThis as any).buyGeneratorUpgrade = vi.fn((...a: unknown[]) => {
    mutatorLog.push({ fn: 'buyGeneratorUpgrade', args: a })
    onBuyGenerator?.(a[0])
  })
  ;(globalThis as any).buyPermanentGeneratorUpgrade = vi.fn((...a: unknown[]) =>
    mutatorLog.push({ fn: 'buyPermanentGeneratorUpgrade', args: a }),
  )
  ;(globalThis as any).changeGeneratorState = vi.fn((...a: unknown[]) =>
    mutatorLog.push({ fn: 'changeGeneratorState', args: a }),
  )
}

// getPageSetting/debug are REAL imports inside magmite.ts; they read the global `autoTrimpSettings`.
// Seeding it (never mocking the util) is the jobs.ts/upgrades.ts precedent. Spam* settings left
// unset → getPageSetting returns false → debug() short-circuits to a no-op.
afterEach(() => {
  for (const k of [
    'game', 'autoTrimpSettings',
    'buyGeneratorUpgrade', 'buyPermanentGeneratorUpgrade', 'changeGeneratorState',
  ]) delete (globalThis as any)[k]
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — calcMiSpent (magmite-spent formula)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('magmite.calcMiSpent — L1a golden master (spent-magmite formula)', () => {
  it('returns 0 when cost() <= baseCost (nothing bought yet)', () => {
    ;(globalThis as any).game = makeMinimalGame({
      generatorUpgrades: { Efficiency: { baseCost: 100, upgrades: 3, cost: () => 50 } },
    })
    expect(magmite.calcMiSpent('Efficiency')).toBe(0)
  })

  it('returns 0 when upgrades <= 0', () => {
    ;(globalThis as any).game = makeMinimalGame({
      generatorUpgrades: { Efficiency: { baseCost: 5, upgrades: 0, cost: () => 100 } },
    })
    expect(magmite.calcMiSpent('Efficiency')).toBe(0)
  })

  it('computes upgrades * (baseCost + (priceIncrease/2)*(upgrades-1))', () => {
    ;(globalThis as any).game = makeMinimalGame({
      generatorUpgrades: { Efficiency: { baseCost: 5, upgrades: 3, cost: () => 100 } },
    })
    // 3 * (5 + (8/2)*(3-1)) = 3 * (5 + 8) = 39   (priceIncreases.Efficiency = 8)
    expect(magmite.calcMiSpent('Efficiency')).toBe(39)
  })

  it('uses the per-upgrade priceIncrease (Capacity = 32)', () => {
    ;(globalThis as any).game = makeMinimalGame({
      generatorUpgrades: { Capacity: { baseCost: 5, upgrades: 3, cost: () => 100 } },
    })
    // 3 * (5 + (32/2)*(3-1)) = 3 * (5 + 32) = 111
    expect(magmite.calcMiSpent('Capacity')).toBe(111)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — miRatio (next-spend ratio selector) — drives all four `ratios[0] == Xfinal` return
// branches to true + the `Xfinal != -1` exclusion guard (all ==/!= refactor targets).
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('magmite.miRatio — L1a golden master (next-spend selector)', () => {
  // Each of the four generator upgrades: baseCost 100, upgrades 1, cost() > baseCost →
  // calcMiSpent = 100 apiece (the (upgrades-1)=0 term zeros the priceIncrease). So the current
  // spend ratio is even (25% each); the winner is decided purely by the player-ratio settings.
  function evenGenerators(over: Record<string, unknown> = {}) {
    return makeMinimalGame({
      generatorUpgrades: {
        Efficiency: { baseCost: 100, upgrades: 1, cost: () => 200 },
        Capacity: { baseCost: 100, upgrades: 1, cost: () => 200 },
        Supply: { baseCost: 100, upgrades: 1, cost: () => 200 },
        Overclocker: { baseCost: 100, upgrades: 1, cost: () => 200 },
      },
      ...over,
    })
  }
  // The resource whose target ratio is LOWEST (=1) gets the highest spend-need → wins.
  function ratios(eff: number, cap: number, sup: number, oc: number) {
    return {
      effratio: { type: 'value', value: eff },
      capratio: { type: 'value', value: cap },
      supratio: { type: 'value', value: sup },
      ocratio: { type: 'value', value: oc },
    }
  }

  it('Efficiency wins → the `ratios[0] == efffinal` branch', () => {
    ;(globalThis as any).autoTrimpSettings = ratios(1, 100, 100, 100)
    ;(globalThis as any).game = evenGenerators()
    expect(magmite.miRatio()).toBe('Efficiency')
  })

  it('Capacity wins → the `ratios[0] == capfinal` branch', () => {
    ;(globalThis as any).autoTrimpSettings = ratios(100, 1, 100, 100)
    ;(globalThis as any).game = evenGenerators()
    expect(magmite.miRatio()).toBe('Capacity')
  })

  it('Supply wins → the `ratios[0] == supfinal` branch', () => {
    ;(globalThis as any).autoTrimpSettings = ratios(100, 100, 1, 100)
    ;(globalThis as any).game = evenGenerators()
    expect(magmite.miRatio()).toBe('Supply')
  })

  it('Overclocker wins → the `ratios[0] == ocfinal` branch', () => {
    ;(globalThis as any).autoTrimpSettings = ratios(100, 100, 100, 1)
    ;(globalThis as any).game = evenGenerators()
    expect(magmite.miRatio()).toBe('Overclocker')
  })

  it('a resource with 0 spent + 0 target is excluded via `efffinal != -1` (== -1 → not pushed)', () => {
    // Efficiency spends 0 (cost()<=baseCost → calcMiSpent 0) so effr=1; effratio unset → effspend 0
    // → effspendr 0 → efffinal = 0 - 1 = -1 → EXCLUDED from the ratios array. Capacity still wins.
    ;(globalThis as any).autoTrimpSettings = {
      capratio: { type: 'value', value: 1 },
      supratio: { type: 'value', value: 100 },
      ocratio: { type: 'value', value: 100 },
      // effratio deliberately unset → getPageSetting false → effspend 0
    }
    ;(globalThis as any).game = makeMinimalGame({
      generatorUpgrades: {
        Efficiency: { baseCost: 100, upgrades: 1, cost: () => 50 }, // cost<=baseCost → 0 spent
        Capacity: { baseCost: 100, upgrades: 1, cost: () => 200 },
        Supply: { baseCost: 100, upgrades: 1, cost: () => 200 },
        Overclocker: { baseCost: 100, upgrades: 1, cost: () => 200 },
      },
    })
    expect(magmite.miRatio()).toBe('Capacity')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — autoMagmiteSpender (actuator: buyGeneratorUpgrade / buyPermanentGeneratorUpgrade log)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('magmite.autoMagmiteSpender — L1b actuator spy-log', () => {
  const PERMANAMES = ['Slowburn', 'Shielding', 'Storage', 'Hybridization', 'Supervision', 'Simulacrum']
  function permaUpgrades(over: Record<string, { owned?: boolean; cost?: number }> = {}) {
    const out: Record<string, unknown> = {}
    for (const name of PERMANAMES) out[name] = { owned: false, cost: 10, ...over[name] }
    return out
  }

  // ── ratiospend path ──────────────────────────────────────────────────────────────────────────
  it('ratiospend on: buys the miRatio winner when affordable', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      ratiospend: { type: 'boolean', enabled: true },
      effratio: { type: 'value', value: 1 },
      capratio: { type: 'value', value: 100 },
      supratio: { type: 'value', value: 100 },
      ocratio: { type: 'value', value: 100 },
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { magmite: 1000 },
      generatorUpgrades: {
        Efficiency: { baseCost: 100, upgrades: 1, cost: () => 200 },
        Capacity: { baseCost: 100, upgrades: 1, cost: () => 200 },
        Supply: { baseCost: 100, upgrades: 1, cost: () => 200 },
        Overclocker: { baseCost: 100, upgrades: 1, cost: () => 200 },
      },
    })
    magmite.autoMagmiteSpender()
    expect(mutatorLog).toEqual([{ fn: 'buyGeneratorUpgrade', args: ['Efficiency'] }])
  })

  it('ratiospend on: buys nothing when magmite < the winner cost', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      ratiospend: { type: 'boolean', enabled: true },
      effratio: { type: 'value', value: 1 },
      capratio: { type: 'value', value: 100 },
      supratio: { type: 'value', value: 100 },
      ocratio: { type: 'value', value: 100 },
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { magmite: 10 }, // < cost() 200
      generatorUpgrades: {
        Efficiency: { baseCost: 100, upgrades: 1, cost: () => 200 },
        Capacity: { baseCost: 100, upgrades: 1, cost: () => 200 },
        Supply: { baseCost: 100, upgrades: 1, cost: () => 200 },
        Overclocker: { baseCost: 100, upgrades: 1, cost: () => 200 },
      },
    })
    magmite.autoMagmiteSpender()
    expect(mutatorLog).toEqual([])
  })

  // ── permanent-upgrade path (ratiospend off) ────────────────────────────────────────────────────
  it('permanent-upgrade undefined → early return, buys nothing', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {} // ratiospend unset → false != true → else branch
    ;(globalThis as any).game = makeMinimalGame({
      global: { magmite: 1000 },
      permanentGeneratorUpgrades: {}, // Slowburn undefined → return
      generatorUpgrades: { Overclocker: {} },
    })
    magmite.autoMagmiteSpender()
    expect(mutatorLog).toEqual([])
  })

  it('buys every unowned affordable permanent upgrade in order; skips owned ones', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      spendmagmitesetting: { type: 'multitoggle', value: 2 }, // repeat=false + no overclocker
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { magmite: 1000 },
      permanentGeneratorUpgrades: {
        ...permaUpgrades({ Storage: { owned: true } }), // Storage owned → skipped
        // Hybridization/Storage not both owned → hasOv false → overclocker skipped
      },
      generatorUpgrades: { Overclocker: { upgrades: 5, cost: () => 10 } },
    })
    magmite.autoMagmiteSpender()
    expect(mutatorLog).toEqual([
      { fn: 'buyPermanentGeneratorUpgrade', args: ['Slowburn'] },
      { fn: 'buyPermanentGeneratorUpgrade', args: ['Shielding'] },
      { fn: 'buyPermanentGeneratorUpgrade', args: ['Hybridization'] },
      { fn: 'buyPermanentGeneratorUpgrade', args: ['Supervision'] },
      { fn: 'buyPermanentGeneratorUpgrade', args: ['Simulacrum'] },
    ])
  })

  it('permanent upgrade skipped when magmite < its cost', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      spendmagmitesetting: { type: 'multitoggle', value: 2 },
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { magmite: 5 }, // < cost 10 for every perma → none bought
      permanentGeneratorUpgrades: permaUpgrades(),
      generatorUpgrades: { Overclocker: { upgrades: 5, cost: () => 10 } },
    })
    magmite.autoMagmiteSpender()
    expect(mutatorLog).toEqual([])
  })

  // ── overclocker branch ───────────────────────────────────────────────────────────────────────
  it('overclocker bought when hasOv and spendmagmitesetting == 3 (repeat stays false)', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      spendmagmitesetting: { type: 'multitoggle', value: 3 }, // (3==0||3==3)→true ; repeat=(3==0||3==1)→false
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { magmite: 1000 },
      permanentGeneratorUpgrades: permaUpgrades({
        Storage: { owned: true },
        Hybridization: { owned: true }, // hasOv = true
      }),
      generatorUpgrades: { Overclocker: { upgrades: 5, cost: () => 10 } },
    })
    magmite.autoMagmiteSpender()
    // all perma owned except 4 → they buy first, then Overclocker
    expect(mutatorLog).toContainEqual({ fn: 'buyGeneratorUpgrade', args: ['Overclocker'] })
    expect(mutatorLog.filter((m) => m.fn === 'buyGeneratorUpgrade')).toEqual([
      { fn: 'buyGeneratorUpgrade', args: ['Overclocker'] },
    ])
  })

  // ── algorithm==2 loop (MODULES.algorithm === 2 target) ─────────────────────────────────────────
  it('algorithm loop buys Efficiency when its miCostPerPct <= Capacity (spendmagmitesetting == 1)', () => {
    // spy zeroes magmite after the buy so the while-loop exits (native would raise cost / drop magmite)
    installSpies(() => { (globalThis as any).game.global.magmite = 0 })
    ;(globalThis as any).autoTrimpSettings = {
      spendmagmitesetting: { type: 'multitoggle', value: 1 }, // repeat=(1==0||1==1)→true
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { magmite: 1000 },
      permanentGeneratorUpgrades: permaUpgrades({
        Slowburn: { owned: true }, Shielding: { owned: true }, Storage: { owned: true },
        Hybridization: { owned: true }, Supervision: { owned: true }, Simulacrum: { owned: true },
      }), // all owned → no perma buys; hasOv true but ss==1 → (1==0||1==3)=false && !upgrades...
      generatorUpgrades: {
        Overclocker: { upgrades: 5, cost: () => 999999 }, // hasOv path: !upgrades false, magmite<cost → skip
        Efficiency: { upgrades: 0, cost: () => 10 },   // miCostPerPct = 10/10 = 1  (cheap → wins)
        Capacity: { upgrades: 0, cost: () => 1000 },   // miCostPerPct ≈ 154.7
        Supply: { upgrades: 0, cost: () => 500 },
      },
    })
    magmite.autoMagmiteSpender()
    expect(mutatorLog).toEqual([{ fn: 'buyGeneratorUpgrade', args: ['Efficiency'] }])
  })

  it('algorithm loop: SupplyWall == 1 forces Capacity over Supply when Efficiency is dearer', () => {
    installSpies(() => { (globalThis as any).game.global.magmite = 0 })
    ;(globalThis as any).autoTrimpSettings = {
      spendmagmitesetting: { type: 'multitoggle', value: 1 },
      SupplyWall: { type: 'value', value: 1 }, // wall == 1 → "Capacity"
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { magmite: 1e9 },
      permanentGeneratorUpgrades: permaUpgrades({
        Slowburn: { owned: true }, Shielding: { owned: true }, Storage: { owned: true },
        Hybridization: { owned: true }, Supervision: { owned: true }, Simulacrum: { owned: true },
      }),
      generatorUpgrades: {
        Overclocker: { upgrades: 5, cost: () => 1e18 },
        Efficiency: { upgrades: 0, cost: () => 100000 }, // miCostPerPct huge → EffObj > CapObj → else branch
        Capacity: { upgrades: 0, cost: () => 1000 },
        Supply: { upgrades: 0, cost: () => 500 },
      },
    })
    magmite.autoMagmiteSpender()
    expect(mutatorLog).toEqual([{ fn: 'buyGeneratorUpgrade', args: ['Capacity'] }])
  })

  it('algorithm loop: no SupplyWall → picks Supply when Capacity.cost > Supply.cost', () => {
    installSpies(() => { (globalThis as any).game.global.magmite = 0 })
    ;(globalThis as any).autoTrimpSettings = {
      spendmagmitesetting: { type: 'multitoggle', value: 1 },
      // SupplyWall unset → getPageSetting false → !wall true → (CapObj.cost <= supCost) ? Capacity : Supply
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { magmite: 1e9 },
      permanentGeneratorUpgrades: permaUpgrades({
        Slowburn: { owned: true }, Shielding: { owned: true }, Storage: { owned: true },
        Hybridization: { owned: true }, Supervision: { owned: true }, Simulacrum: { owned: true },
      }),
      generatorUpgrades: {
        Overclocker: { upgrades: 5, cost: () => 1e18 },
        Efficiency: { upgrades: 0, cost: () => 100000 }, // EffObj > CapObj → else branch
        Capacity: { upgrades: 0, cost: () => 1000 },     // 1000 <= supCost(500)? no → Supply
        Supply: { upgrades: 0, cost: () => 500 },
      },
    })
    magmite.autoMagmiteSpender()
    expect(mutatorLog).toEqual([{ fn: 'buyGeneratorUpgrade', args: ['Supply'] }])
  })

  it('algorithm loop: eff/cap/sup undefined → early return, buys nothing', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      spendmagmitesetting: { type: 'multitoggle', value: 1 },
    }
    ;(globalThis as any).game = makeMinimalGame({
      global: { magmite: 1000 },
      permanentGeneratorUpgrades: permaUpgrades({
        Slowburn: { owned: true }, Shielding: { owned: true }, Storage: { owned: true },
        Hybridization: { owned: true }, Supervision: { owned: true }, Simulacrum: { owned: true },
      }),
      generatorUpgrades: { Overclocker: { upgrades: 5, cost: () => 1e18 } }, // no Efficiency/Capacity/Supply
    })
    magmite.autoMagmiteSpender()
    expect(mutatorLog).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — autoGenerator (actuator: changeGeneratorState log) — drives every generatorMode ==/!= 1|2
// guard (the strict-conversion targets) to its live state.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('magmite.autoGenerator — L1b actuator spy-log (changeGeneratorState)', () => {
  function gen(over: Record<string, unknown> = {}) {
    return makeMinimalGame({
      global: {
        world: 300,
        generatorMode: 1,
        runningChallengeSquared: false,
        dailyChallenge: { seed: 0 },
      },
      permanentGeneratorUpgrades: { Hybridization: { owned: false } },
      ...over,
    })
  }

  it('world < 230 → early return, no state change', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = gen({ global: { world: 100, generatorMode: 1, runningChallengeSquared: false, dailyChallenge: { seed: 0 } } })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([])
  })

  it('daily + AutoGenDC 1 + generatorMode != 1 → changeGeneratorState(1)', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = { AutoGenDC: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 0, runningChallengeSquared: false, dailyChallenge: { seed: 12345 } },
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([{ fn: 'changeGeneratorState', args: [1] }])
  })

  it('daily + AutoGenDC 1 + generatorMode == 1 → return, no state change', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = { AutoGenDC: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 1, runningChallengeSquared: false, dailyChallenge: { seed: 12345 } },
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([])
  })

  it('daily + hybrid + AutoGenDC 2 + generatorMode != 2 → changeGeneratorState(2)', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = { AutoGenDC: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 0, runningChallengeSquared: false, dailyChallenge: { seed: 12345 } },
      permanentGeneratorUpgrades: { Hybridization: { owned: true } },
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([{ fn: 'changeGeneratorState', args: [2] }])
  })

  it('daily + AutoGenDC 2 + generatorMode == 2 → return, no state change', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = { AutoGenDC: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 2, runningChallengeSquared: false, dailyChallenge: { seed: 12345 } },
      permanentGeneratorUpgrades: { Hybridization: { owned: true } },
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([])
  })

  it('C2 + AutoGenC2 1 + generatorMode != 1 → changeGeneratorState(1)', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = { AutoGenC2: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 0, runningChallengeSquared: true, dailyChallenge: { seed: 0 } },
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([{ fn: 'changeGeneratorState', args: [1] }])
  })

  it('C2 + AutoGenC2 1 + generatorMode == 1 → return', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = { AutoGenC2: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 1, runningChallengeSquared: true, dailyChallenge: { seed: 0 } },
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([])
  })

  it('C2 + hybrid + AutoGenC2 2 + generatorMode != 2 → changeGeneratorState(2)', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = { AutoGenC2: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 0, runningChallengeSquared: true, dailyChallenge: { seed: 0 } },
      permanentGeneratorUpgrades: { Hybridization: { owned: true } },
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([{ fn: 'changeGeneratorState', args: [2] }])
  })

  it('C2 + AutoGenC2 2 + generatorMode == 2 → return', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = { AutoGenC2: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 2, runningChallengeSquared: true, dailyChallenge: { seed: 0 } },
      permanentGeneratorUpgrades: { Hybridization: { owned: true } },
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([])
  })

  // ── fuel path (generatorMode vs beforefuelstate/defaultgenstate — KEEP LOOSE) ───────────────────
  it('no DC/C2 + fuellater < 1 + generatorMode != beforefuelstate → changeGeneratorState(beforegen)', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      fuellater: { type: 'value', value: 0 },
      beforegen: { type: 'multitoggle', value: 0 },
    }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 1, runningChallengeSquared: false, dailyChallenge: { seed: 0 } },
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([{ fn: 'changeGeneratorState', args: [0] }])
  })

  it('no DC/C2 + fuellater < 1 + generatorMode == beforefuelstate → return', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      fuellater: { type: 'value', value: 0 },
      beforegen: { type: 'multitoggle', value: 1 },
    }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 1, runningChallengeSquared: false, dailyChallenge: { seed: 0 } },
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([])
  })

  it('fuellater >= 1 + world in [fuellater, fuelend) + generatorMode != 1 → changeGeneratorState(1)', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      fuellater: { type: 'value', value: 250 },
      fuelend: { type: 'value', value: 400 },
      beforegen: { type: 'multitoggle', value: 0 },
    }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 0, runningChallengeSquared: false, dailyChallenge: { seed: 0 } },
    })
    magmite.autoGenerator()
    // world 300 >= fuellater 250 but not < beforefuelstate... the fuellater>=1 && world<fuelend && mode!=1 branch → state 1
    expect(mutatorLog).toEqual([{ fn: 'changeGeneratorState', args: [1] }])
  })

  it('fuellater >= 1 + world in [fuellater, fuelend) + generatorMode == 1 → return (world-band === 1 arm)', () => {
    // Drives the `... && world < fuelend && generatorMode === 1` early-return arm live (mode 1).
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      fuellater: { type: 'value', value: 250 },
      fuelend: { type: 'value', value: 400 },
      beforegen: { type: 'multitoggle', value: 0 },
    }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 1, runningChallengeSquared: false, dailyChallenge: { seed: 0 } },
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([])
  })

  it('fuelend < 1 + world >= fuellater + generatorMode != 1 → changeGeneratorState(1) (fuelend-band !== 1 arm)', () => {
    // fuelend < 1 disables the end-band; world 300 >= fuellater 250 sits past the [fuellater,fuelend)
    // window (fuelend -1) so the `fuelend < 1 && world >= fuellater && generatorMode !== 1` arm fires.
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      fuellater: { type: 'value', value: 250 },
      fuelend: { type: 'valueNegative', value: -1 }, // < 1
      beforegen: { type: 'multitoggle', value: 0 },
    }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 0, runningChallengeSquared: false, dailyChallenge: { seed: 0 } },
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([{ fn: 'changeGeneratorState', args: [1] }])
  })

  it('fuelend < 1 + world >= fuellater + generatorMode == 1 → return (fuelend-band === 1 arm)', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      fuellater: { type: 'value', value: 250 },
      fuelend: { type: 'valueNegative', value: -1 }, // < 1
      beforegen: { type: 'multitoggle', value: 0 },
    }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 1, runningChallengeSquared: false, dailyChallenge: { seed: 0 } },
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([])
  })

  it('fuelend >= 1 + world >= fuelend + generatorMode != defaultgenstate → changeGeneratorState(defaultgen)', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      fuellater: { type: 'value', value: 250 },
      fuelend: { type: 'value', value: 280 },
      defaultgen: { type: 'multitoggle', value: 0 },
      beforegen: { type: 'multitoggle', value: 1 },
    }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 1, runningChallengeSquared: false, dailyChallenge: { seed: 0 } },
      permanentGeneratorUpgrades: { Hybridization: { owned: true } }, // avoid !hybrid remap of defaultgen
    })
    magmite.autoGenerator()
    expect(mutatorLog).toEqual([{ fn: 'changeGeneratorState', args: [0] }])
  })

  it('!hybrid remaps defaultgenstate 2 → 0 (KEEP-LOOSE `defaultgenstate == 2`)', () => {
    installSpies()
    ;(globalThis as any).autoTrimpSettings = {
      fuellater: { type: 'value', value: 250 },
      fuelend: { type: 'value', value: 280 },
      defaultgen: { type: 'multitoggle', value: 2 }, // hybrid-only; !hybrid → remapped to 0
      beforegen: { type: 'multitoggle', value: 1 },
    }
    ;(globalThis as any).game = gen({
      global: { world: 300, generatorMode: 1, runningChallengeSquared: false, dailyChallenge: { seed: 0 } },
      permanentGeneratorUpgrades: { Hybridization: { owned: false } },
    })
    magmite.autoGenerator()
    // defaultgenstate 2 → 0; world 300 >= fuelend 280, mode 1 != 0 → changeGeneratorState(0)
    expect(mutatorLog).toEqual([{ fn: 'changeGeneratorState', args: [0] }])
  })
})
