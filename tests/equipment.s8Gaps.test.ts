// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// S8 gap closure — #219 and #246 shipped WITHOUT a test that fails without them. A fresh reviewer
// found the precise reason each was invisible, and both are the "reach is not sensitivity" shape:
// the fixed code RUNS in the existing suite, but its answer feeds a saturated condition.
//
//   #219 — the one RautoEquip test that reaches the buy loop
//          (equipment.characterization.test.ts:642) sets `RcalcHDratio = () => 1e9`, which makes
//          `underStats` unconditionally true. The gate is `zoneGo || underStats || percentArm`, so
//          that test passes identically whether zoneGo is the old always-true or the new
//          default-false. Isolating zoneGo requires driving underStats and the percent arm FALSE.
//
//   #246 — the one test touching Shield.blockNow (:368) also sets `Gymystic.allowed - done > 0`,
//          which trips an UNCONDITIONAL override a few lines BELOW the cap logic
//          (`Factor = 0; Wall = true; StatusBorder = 'orange'`). So `Wall` reads true whether or not
//          the cap arm exists. Isolating the cap requires SATISFYING Gymystic so the override is
//          silent, which is what this file does.

let equipment: typeof import('../src/modules/equipment')

const WEAPONS = ['Dagger', 'Mace', 'Polearm', 'Battleaxe', 'Greatsword', 'Arbalest']
const ARMOUR = ['Boots', 'Helmet', 'Pants', 'Shoulderguards', 'Breastplate', 'Gambeson', 'Shield']
const UPGRADE_NAMES = [
  'Dagadder', 'Megamace', 'Polierarm', 'Axeidic', 'Greatersword', 'Bootboost', 'Hellishmet',
  'Pantastic', 'Smoldershoulder', 'Bestplate', 'Harmbalest', 'GambesOP', 'Supershield', 'Gymystic',
]

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  ;(globalThis as any).needGymystic = false
  ;(globalThis as any).autoTrimpSettings = {}
  equipment = await import('../src/modules/equipment')
})

let buyEquipmentCalls: unknown[][]

function baseGame(over: Record<string, any> = {}): any {
  const eq: Record<string, any> = {}
  for (const n of [...WEAPONS, ...ARMOUR]) {
    eq[n] = {
      locked: 0, level: 0, prestige: 1, blockNow: false,
      attack: WEAPONS.includes(n) ? 2 : undefined,
      health: ARMOUR.includes(n) ? 6 : undefined,
      attackCalculated: WEAPONS.includes(n) ? 10 : 0,
      healthCalculated: ARMOUR.includes(n) ? 10 : 0,
      cost: { metal: [40, 1.2], wood: [40, 1.2] },
    }
  }
  // `prestiges` must map back to its equip: buyPrestigeMaybe reverse-looks-up the upgrade whose
  // `prestiges === equipName` and then dereferences it unguarded (equipment.ts:799). A blank mapping
  // finds nothing and throws on `game.upgrades[undefined].locked`.
  const prestigeFor: Record<string, string> = {
    Dagadder: 'Dagger', Megamace: 'Mace', Polierarm: 'Polearm', Axeidic: 'Battleaxe',
    Greatersword: 'Greatsword', Bootboost: 'Boots', Hellishmet: 'Helmet', Pantastic: 'Pants',
    Smoldershoulder: 'Shoulderguards', Bestplate: 'Breastplate', Harmbalest: 'Arbalest',
    GambesOP: 'Gambeson', Supershield: 'Shield', Gymystic: 'Gym',
  }
  const upgrades: Record<string, any> = {}
  for (const n of UPGRADE_NAMES) {
    // All locked → every buyPrestigeMaybe returns false → the prestige loop exits immediately and
    // the buy loop under test is the only thing running.
    upgrades[n] = { locked: 1, allowed: 0, done: 0, prestiges: prestigeFor[n], modifier: 1, cost: { resources: { science: [100, 2] } } }
  }
  return makeMinimalGame({
    global: {
      world: 100, challengeActive: '', universe: 2, mapBonus: 0, mapsActive: false,
      brokenPlanet: false, gridArray: [{ name: '' }], prestige: { attack: 1, health: 1, block: 1 },
      buyAmt: 1, firing: true, lockTooltip: false, maxSplit: 1,
    },
    equipment: eq,
    upgrades,
    jobs: { Farmer: { locked: 0 }, Lumberjack: { locked: 0 }, Miner: { locked: 0 }, Scientist: { locked: 0 } },
    resources: { metal: { owned: 1e9 }, wood: { owned: 1e9 }, science: { owned: 1e9 }, gems: { owned: 1e9 } },
    portal: {
      Artisanistry: { modifier: 0, level: 0, radLevel: 0 },
      Resourceful: { modifier: 0, level: 0 },
      Equality: { modifier: 0.9, radLevel: 0 },
    },
    options: { menu: { liquification: { enabled: false } } },
    talents: { liquification: { purchased: false }, bionic2: { purchased: false } },
    challenges: { Pandemonium: { getEnemyMult: () => 1, isEquipBlocked: () => false } },
    ...over,
  })
}

beforeEach(() => {
  document.body.innerHTML = ''
  for (const id of [...WEAPONS, ...ARMOUR, 'Gym']) {
    const d = document.createElement('div')
    d.id = id
    document.body.appendChild(d)
  }
  buyEquipmentCalls = []
  ;(globalThis as any).buyEquipment = vi.fn((...a: unknown[]) => { buyEquipmentCalls.push(a); return false })
  ;(globalThis as any).buyUpgrade = vi.fn(() => false)
  ;(globalThis as any).preBuy = vi.fn()
  ;(globalThis as any).postBuy = vi.fn()
  ;(globalThis as any).canAffordBuilding = vi.fn(() => true)
  ;(globalThis as any).getBuildingItemPrice = () => 100
  ;(globalThis as any).challengeActive = () => false
  ;(globalThis as any).getTotalHealthMod = () => 1
  ;(globalThis as any).autoBattle = { oneTimers: { Artisan: { owned: false, getMult: () => 1 } } }
  ;(globalThis as any).Rhyposhouldwood = true
  // The buy gate is `canAffordBuilding && smithylogic && level < cap && (zoneGo || underStats || …)`.
  // smithylogic must return true for the zoneGo disjunct to be reachable at all — which is #232's
  // function, and the reason its `undefined` return blocked every U2 gear purchase.
  ;(globalThis as any).smithylogic = () => true
  ;(globalThis as any).RcalcOurHealth = () => 1
  // The rest of the game-global collaborator surface RautoEquip reaches through. Values are inert —
  // the two that actually decide anything here are RcalcHDratio (set per-test) and Rgetequipcost.
  ;(globalThis as any).RcalcBadGuyDmg = () => 1
  ;(globalThis as any).RcalcOurDmg = () => 1
  ;(globalThis as any).RgetEnemyMaxAttack = () => 1
  ;(globalThis as any).RgetEnemyMaxHealth = () => 1
  ;(globalThis as any).RdoMaxMapBonus = () => false
  ;(globalThis as any).getNextPrestigeCost = () => 1
  ;(globalThis as any).getEmpowerment = () => false
  ;(globalThis as any).calcOurBlock = () => 0
  ;(globalThis as any).getPierceAmt = () => 0
  // The percent arm is `Rgetequipcost(...) <= (Requippercent/100) * owned`. Stubbing the price
  // directly (rather than leaning on getBuildingItemPrice) makes "this arm is false" explicit at the
  // fixture, which is the whole point of isolating zoneGo.
  ;(globalThis as any).Rgetequipcost = () => 1e9
  ;(globalThis as any).MODULES = { equipment: { capDivisor: 10, numHitsSurvived: 10, numHitsSurvivedScry: 80 } }
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// #219 — Requipzone's -1 must not force the override gate open
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('#219 — zoneGo, isolated from underStats and the resource-percent arm', () => {
  /**
   * The gate under test is `zoneGo || underStats || cost <= percent * owned`. To see zoneGo AT ALL,
   * the other two disjuncts must be false:
   *   underStats  = RcalcHDratio() >= REquipDamageCutoff  → HD 0.5 against a cutoff of 1 ⇒ false
   *   percent arm = Rgetequipcost(...) <= (Requippercent/100) * owned
   *                 → price 1e6 against 1% of 100 owned ⇒ false
   * Anything less careful and this test proves nothing, which is exactly what happened to the
   * existing RautoEquip test.
   */
  function seedGateClosed(requipzone: number) {
    ;(globalThis as any).RcalcHDratio = () => 0.5
    ;(globalThis as any).getBuildingItemPrice = () => 1e6
    ;(globalThis as any).autoTrimpSettings = {
      Requipon: { type: 'boolean', enabled: true },
      Requipzone: { type: 'value', value: requipzone },
      REquipDamageCutoff: { type: 'value', value: 1 },
      Requippercent: { type: 'value', value: 1 },
      Requipcapattack: { type: 'value', value: 50 },
      Requipcaphealth: { type: 'value', value: 50 },
      Requip2: { type: 'boolean', enabled: false },
    }
    const g = baseGame()
    g.resources.metal.owned = 100
    g.resources.wood.owned = 100
    ;(globalThis as any).game = g
  }

  it('anti-false-green: underStats TRUE opens the gate on its own, so the loop can reach a buy', () => {
    // Without this the two assertions below could both be passing because nothing ever buys.
    seedGateClosed(-1)
    ;(globalThis as any).RcalcHDratio = () => 1e9 // underStats true — the old test's condition
    equipment.RautoEquip()
    expect(buyEquipmentCalls.length).toBeGreaterThan(0)
  })

  it('Requipzone = -1 no longer forces the gate open — with the other two arms false, nothing buys', () => {
    // RED before the fix: `world >= -1` is always true, so zoneGo short-circuited the OR and AT
    // bought aggressively regardless of H:D ratio or resource percentage, for every user on defaults.
    seedGateClosed(-1)
    equipment.RautoEquip()
    expect(buyEquipmentCalls).toEqual([])
  })

  it('Requipzone = 0 is likewise OFF, not "every zone from 0 upward"', () => {
    seedGateClosed(0)
    equipment.RautoEquip()
    expect(buyEquipmentCalls).toEqual([])
  })

  it('a REAL zone still works: at or past it the override opens and buying resumes', () => {
    // The cap on the fix — a repair that simply hardcoded zoneGo false would pass the two cases above
    // and permanently break the setting for everyone who configured it.
    seedGateClosed(50) // world is 100 ⇒ 100 >= 50
    equipment.RautoEquip()
    expect(buyEquipmentCalls.length).toBeGreaterThan(0)
  })

  it('below a REAL zone the override stays shut', () => {
    seedGateClosed(500) // world is 100 ⇒ 100 >= 500 is false
    equipment.RautoEquip()
    expect(buyEquipmentCalls).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// #246 — a block-stat Shield must honour the Armor Level Cap
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('#246 — the block-stat Shield reads CapEquiparm, not the hardcoded 100', () => {
  /**
   * Gymystic is deliberately SATISFIED (allowed - done <= 0). The existing suite's blockNow test
   * leaves it OWED, which trips an unconditional `Wall = true` a few lines below the cap logic — so
   * that test's `expect(Wall).toBe(true)` is carried entirely by the override and says nothing about
   * the cap. With Gymystic satisfied, Wall can only come from the cap arm.
   */
  function blockShield(capArm: number, level: number) {
    ;(globalThis as any).autoTrimpSettings = {
      CapEquiparm: { type: 'value', value: capArm },
      CapEquip2: { type: 'value', value: 999 },
      BuyArmorNew: { type: 'multitoggle', value: 1 },
      BuyWeaponsNew: { type: 'multitoggle', value: 1 },
      always2: { type: 'boolean', value: false },
    }
    const g = baseGame()
    g.equipment.Shield.blockNow = true
    g.equipment.Shield.level = level
    g.upgrades.Supershield.locked = 1
    g.upgrades.Gymystic.allowed = 0 // satisfied → the unconditional override below the cap stays quiet
    g.upgrades.Gymystic.done = 0
    ;(globalThis as any).game = g
    return equipment.evaluateEquipmentEfficiency('Shield')
  }

  it('anti-false-green: with Gymystic satisfied and the level under the cap, the Shield is NOT walled', () => {
    // This is the assertion the existing suite cannot make — its fixture is always walled by the
    // Gymystic override, so it can never observe the cap doing anything.
    const r = blockShield(50, 10)
    expect(r.Stat).toBe('block')
    expect(r.Wall).toBe(false)
  })

  it('a block Shield AT the Armor Level Cap is walled — the user\'s setting is honoured', () => {
    // RED before the fix: Stat is 'block', neither the 'health' nor the 'attack' arm matched, so cap
    // kept the hardcoded initializer 100 and a level-50 Shield sailed past a cap of 50.
    const r = blockShield(50, 50)
    expect(r.Stat).toBe('block')
    expect(r.Wall).toBe(true)
  })

  it('the cap is CapEquiparm and not 100 — a level-60 Shield under a cap of 100 proves which one is read', () => {
    // The discriminating case. Under the bug, cap === 100 and level 60 is under it ⇒ not walled.
    // Under the fix, cap === CapEquiparm === 20 and level 60 is over it ⇒ walled.
    const r = blockShield(20, 60)
    expect(r.Wall).toBe(true)
  })

  it('a non-block Shield still takes the same armour cap — the health arm is unchanged', () => {
    ;(globalThis as any).autoTrimpSettings = {
      CapEquiparm: { type: 'value', value: 20 },
      CapEquip2: { type: 'value', value: 999 },
      BuyArmorNew: { type: 'multitoggle', value: 1 },
      BuyWeaponsNew: { type: 'multitoggle', value: 1 },
      always2: { type: 'boolean', value: false },
    }
    const g = baseGame()
    g.equipment.Shield.blockNow = false
    g.equipment.Shield.level = 60
    g.upgrades.Supershield.locked = 1
    ;(globalThis as any).game = g
    const r = equipment.evaluateEquipmentEfficiency('Shield')
    expect(r.Stat).toBe('health')
    expect(r.Wall).toBe(true)
  })
})
