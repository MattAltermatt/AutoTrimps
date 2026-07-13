// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// Phase-2 characterization net for equipment.ts (proof-net #51) — the equipment-buyer actuator
// module (auto-equip / prestige / equipment-efficiency, U1 + the parallel radon R* family).
// Archetypes per the design spec (§4):
//   L1a pure-predicate golden masters — equipEffect / equipCost / PrestigeValue,
//     getMaxAffordable / getTotalMultiCost (closed-form math), mostEfficientEquipment (selector),
//     equipfarmdynamicHD, evaluateEquipmentEfficiency (eval object),
//     buyPrestigeMaybe (bool), Rgetequips (count), areWeAttackLevelCapped (bool),
//     estimateEquipsForZone (cost array), windstackingprestige (bool).
//   L1b actuator spy-logs — orangewindstack / dorangewindstack / autoLevelEquipment /
//     RautoEquip. Their RETURN is (mostly) meaningless; the
//     CONTRACT is the ordered native-mutator call log: buyUpgrade(name,true,true) /
//     buyEquipment(name,null,true[,amt]) captured in order, plus preBuy/postBuy state save/restore.
// Every exported decision fn has >=1 assertion; every ==/!= the idiomatic pass converts to ===/!==
// is driven to a live evaluation by some fixture so a mistranscription fails loudly.
//
// getPageSetting / debug are REAL imports inside equipment.ts; they read the global
// autoTrimpSettings. Seeding it (never mocking the util) is the jobs.ts / upgrades.ts / buildings.ts
// precedent. All other collaborators (native buyUpgrade/buyEquipment + game-global helper fns) are
// stubbed on globalThis.

let equipment: typeof import('../src/modules/equipment')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  ;(globalThis as any).needGymystic = false // bare implicit-global write target (evaluateEquipmentEfficiency)
  ;(globalThis as any).autoTrimpSettings = {} // equipment.ts reads getPageSetting('always2') at load
  equipment = await import('../src/modules/equipment')
})

// ── native-mutator spies ────────────────────────────────────────────────────────────────────────
let buyUpgradeCalls: unknown[][]
let buyEquipmentCalls: unknown[][]
function installSpies(opts: { buyUpgradeReturn?: boolean; buyEquipmentReturn?: boolean } = {}) {
  buyUpgradeCalls = []
  buyEquipmentCalls = []
  ;(globalThis as any).buyUpgrade = vi.fn((...args: unknown[]) => {
    buyUpgradeCalls.push(args)
    return opts.buyUpgradeReturn ?? true
  })
  ;(globalThis as any).buyEquipment = vi.fn((...args: unknown[]) => {
    buyEquipmentCalls.push(args)
    return opts.buyEquipmentReturn ?? true
  })
}

const EQUIP_NAMES = [
  'Dagger', 'Mace', 'Polearm', 'Battleaxe', 'Greatsword', 'Boots', 'Helmet', 'Pants',
  'Shoulderguards', 'Breastplate', 'Arbalest', 'Gambeson', 'Shield', 'Gym',
]
const UPGRADE_NAMES = [
  'Dagadder', 'Megamace', 'Polierarm', 'Axeidic', 'Greatersword', 'Bootboost', 'Hellishmet',
  'Pantastic', 'Smoldershoulder', 'Bestplate', 'Harmbalest', 'GambesOP', 'Supershield', 'Gymystic',
]

// Every equip/building div the DOM-touching fns paint. jsdom getElementById would return null
// otherwise (equipment.ts uses `!` non-null assertions on the equip div), throwing on `.style`.
function mountEquipDivs() {
  document.body.innerHTML = ''
  for (const id of [...EQUIP_NAMES, ...UPGRADE_NAMES]) {
    const d = document.createElement('div')
    d.id = id
    document.body.appendChild(d)
  }
}

// Benign default helper globals; individual tests override.
beforeEach(() => {
  mountEquipDivs()
  installSpies()
  ;(globalThis as any).needGymystic = false
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).canAffordTwoLevel = () => true
  ;(globalThis as any).canAffordBuilding = () => true
  ;(globalThis as any).getBuildingItemPrice = () => 100
  ;(globalThis as any).getNextPrestigeCost = () => 100
  ;(globalThis as any).getScientistLevel = () => 0
  ;(globalThis as any).getEmpowerment = () => ''
  ;(globalThis as any).calcHDratio = () => 10
  ;(globalThis as any).calcOurDmg = () => 100
  ;(globalThis as any).RcalcOurDmg = () => 100
  ;(globalThis as any).calcBadGuyDmg = () => 10
  ;(globalThis as any).RcalcBadGuyDmg = () => 10
  ;(globalThis as any).calcEnemyHealth = () => 50
  ;(globalThis as any).getEnemyMaxAttack = () => 10
  ;(globalThis as any).RgetEnemyMaxAttack = () => 10
  ;(globalThis as any).RgetEnemyMaxHealth = () => 1000
  ;(globalThis as any).calcOurHealth = () => 1000
  ;(globalThis as any).RcalcOurHealth = () => 1000
  ;(globalThis as any).calcOurBlock = () => 0
  ;(globalThis as any).getPierceAmt = () => 0
  ;(globalThis as any).RcalcHDratio = () => 10
  ;(globalThis as any).challengeActive = (what: string) => (globalThis as any).game?.global?.challengeActive === what
  ;(globalThis as any).highDamageShield = vi.fn()
  ;(globalThis as any).trimpAA = 1
  ;(globalThis as any).shouldFarm = false
  ;(globalThis as any).doMaxMapBonus = false
  ;(globalThis as any).RdoMaxMapBonus = false
  ;(globalThis as any).smithylogic = () => true
  ;(globalThis as any).Rhyposhouldwood = true
  ;(globalThis as any).Rgetequipcost = () => 0
  ;(globalThis as any).getTotalHealthMod = () => 1
  ;(globalThis as any).getMaxAffordable = () => 1
  ;(globalThis as any).autoBattle = { oneTimers: { Artisan: { owned: false, getMult: () => 1 } } }
})

afterEach(() => {
  for (const k of [
    'game', 'autoTrimpSettings', 'buyUpgrade', 'buyEquipment', 'canAffordTwoLevel',
    'canAffordBuilding', 'getBuildingItemPrice', 'getNextPrestigeCost', 'getScientistLevel',
    'getEmpowerment', 'calcHDratio', 'calcOurDmg', 'RcalcOurDmg', 'calcBadGuyDmg', 'RcalcBadGuyDmg',
    'calcEnemyHealth', 'getEnemyMaxAttack', 'RgetEnemyMaxAttack', 'RgetEnemyMaxHealth',
    'calcOurHealth', 'RcalcOurHealth', 'calcOurBlock', 'getPierceAmt', 'RcalcHDratio',
    'challengeActive', 'highDamageShield', 'trimpAA', 'shouldFarm', 'doMaxMapBonus', 'RdoMaxMapBonus',
    'smithylogic', 'Rhyposhouldwood', 'Rgetequipcost', 'getTotalHealthMod', 'needGymystic',
    'getMaxAffordable', 'autoBattle',
  ]) delete (globalThis as any)[k]
})

// ── game fixture helpers ────────────────────────────────────────────────────────────────────────
// A single equipment slot (unlocked, level 0). Attack pieces carry attack/attackCalculated;
// health pieces carry health/healthCalculated; Shield may carry blockNow.
function eq(over: Record<string, any> = {}) {
  return {
    locked: 0, level: 0, prestige: 1,
    attackCalculated: 10, healthCalculated: 10,
    cost: { metal: [40, 1.2], wood: [40, 1.2] },
    ...over,
  }
}
function up(over: Record<string, any> = {}) {
  return { locked: 0, allowed: 0, done: 0, prestiges: '', modifier: 1,
    cost: { resources: { science: [100, 2], gems: [100, 2] } }, ...over }
}

// Full game with all equipment + upgrades present. increase.by only matters for Gym (block piece).
function fullGame(over: Record<string, unknown> = {}) {
  const equipment: Record<string, any> = {}
  for (const name of EQUIP_NAMES) {
    if (name === 'Gym') continue
    equipment[name] = eq(name === 'Shield' ? { health: 6, healthCalculated: 10 }
      : (['Dagger', 'Mace', 'Polearm', 'Battleaxe', 'Greatsword', 'Arbalest'].includes(name)
        ? { attack: 2, attackCalculated: 10 } : { health: 6, healthCalculated: 10 }))
  }
  const upgrades: Record<string, any> = {}
  const prestigeFor: Record<string, string> = {
    Dagadder: 'Dagger', Megamace: 'Mace', Polierarm: 'Polearm', Axeidic: 'Battleaxe',
    Greatersword: 'Greatsword', Bootboost: 'Boots', Hellishmet: 'Helmet', Pantastic: 'Pants',
    Smoldershoulder: 'Shoulderguards', Bestplate: 'Breastplate', Harmbalest: 'Arbalest',
    GambesOP: 'Gambeson', Supershield: 'Shield', Gymystic: 'Gym',
  }
  for (const name of UPGRADE_NAMES) upgrades[name] = up({ prestiges: prestigeFor[name] })
  return makeMinimalGame({
    global: {
      world: 100, challengeActive: '', runningChallengeSquared: false, mapBonus: 0,
      mapsActive: false, brokenPlanet: false, universe: 1, prestige: { attack: 1, health: 1, block: 1 },
      buyAmt: 1, firing: true, lockTooltip: false, maxSplit: 1, firstCustomAmt: 1, lastCustomAmt: 1,
      gridArray: [{ name: '' }], ShieldEquipped: { name: 'Shield' },
    },
    equipment,
    buildings: { Gym: { locked: 0, level: 0, prestige: 1, owned: 0, increase: { by: 5 } } },
    upgrades,
    jobs: { Farmer: { locked: 0 }, Lumberjack: { locked: 0 }, Miner: { locked: 0 }, Scientist: { locked: 0 } },
    resources: { metal: { owned: 1e9 }, wood: { owned: 1e9 }, science: { owned: 1e9 }, gems: { owned: 1e9 }, trimps: { maxSoldiers: 1 } },
    portal: {
      Artisanistry: { modifier: 0, level: 0, radLevel: 0 },
      Resourceful: { modifier: 0, level: 0 },
      Equality: { modifier: 0.9, radLevel: 5 },
    },
    options: { menu: { liquification: { enabled: false } } },
    talents: { liquification: { purchased: false }, bionic2: { purchased: false } },
    challenges: {
      Pandemonium: { getEnemyMult: () => 1, isEquipBlocked: () => false },
    },
    ...over,
  })
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — pure math helpers (equipEffect / equipCost / PrestigeValue + R twins, getMax*, getTotalMulti)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('equipment — L1a pure math golden masters', () => {
  it('equipEffect: Equip piece returns the pre-computed Stat+"Calculated" value', () => {
    const equip = { Equip: true, Stat: 'attack' }
    expect(equipment.equipEffect({ attackCalculated: 42 }, equip)).toBe(42)
  })

  it('equipEffect: non-Equip (Gym/block) computes the marginal increase delta', () => {
    ;(globalThis as any).game = makeMinimalGame({ upgrades: { Gymystic: { done: 0, modifier: 1 } } })
    const equip = { Equip: false, Stat: 'block' }
    // owned 2, increase.by 5 → curr=10, next=(3*5*d) with d=1 (done 0) = 15, delta = 5
    expect(equipment.equipEffect({ increase: { by: 5 }, owned: 2 }, equip)).toBe(5)
  })

  it('equipCost: Equip piece applies the Artisanistry discount then ceils', () => {
    ;(globalThis as any).game = makeMinimalGame({ portal: { Artisanistry: { modifier: 0, level: 0 }, Resourceful: { modifier: 0, level: 0 } } })
    ;(globalThis as any).getBuildingItemPrice = () => 123.4
    expect(equipment.equipCost({}, { Resource: 'metal', Equip: true })).toBe(124)
  })

  it('equipCost: non-Equip piece applies the Resourceful discount', () => {
    ;(globalThis as any).game = makeMinimalGame({ portal: { Artisanistry: { modifier: 0, level: 0 }, Resourceful: { modifier: 0.5, level: 1 } } })
    ;(globalThis as any).getBuildingItemPrice = () => 100
    expect(equipment.equipCost({}, { Resource: 'wood', Equip: false })).toBe(50)
  })

  it('PrestigeValue: health branch scales by 1.19^(prestige*globalPrestige+1)', () => {
    ;(globalThis as any).game = makeMinimalGame({
      upgrades: { Bootboost: { prestiges: 'Boots' } },
      equipment: { Boots: { health: 6, healthCalculated: 6, prestige: 1 } },
      global: { prestige: { health: 1, attack: 1, block: 1 } },
    })
    // stat = health, round(6 * 1.19^(1*1+1)) = round(6*1.4161) = round(8.4966) = 8
    expect(equipment.PrestigeValue('Bootboost')).toBe(8)
  })

  it('PrestigeValue: attack branch (no health field) uses the attack stat', () => {
    ;(globalThis as any).game = makeMinimalGame({
      upgrades: { Dagadder: { prestiges: 'Dagger' } },
      equipment: { Dagger: { attack: 2, attackCalculated: 2, prestige: 1 } },
      global: { prestige: { health: 1, attack: 1, block: 1 } },
    })
    // stat = attack (health undefined), round(2 * 1.19^2) = round(2.8322) = 3
    expect(equipment.PrestigeValue('Dagadder')).toBe(3)
  })

  it('PrestigeValue: block branch when equipment.blockNow', () => {
    ;(globalThis as any).game = makeMinimalGame({
      upgrades: { Supershield: { prestiges: 'Shield' } },
      equipment: { Shield: { blockNow: true, block: 4, prestige: 1 } },
      global: { prestige: { health: 1, attack: 1, block: 1 } },
    })
    expect(equipment.PrestigeValue('Supershield')).toBe(Math.round(4 * Math.pow(1.19, 2)))
  })

  it('getMaxAffordable: non-compounding closed form', () => {
    // baseCost 40, totalResource 1000, costScaling 10, non-compounding
    const expected = Math.floor((10 - 80 + Math.sqrt(Math.pow(80 - 10, 2) + 8 * 10 * 1000)) / 2)
    expect(equipment.getMaxAffordable(40, 1000, 10, false)).toBe(expected)
  })

  it('getMaxAffordable: compounding (log) form', () => {
    const expected = Math.floor(Math.log(1 - (1 - 1.2) * 1000 / 40) / Math.log(1.2))
    expect(equipment.getMaxAffordable(40, 1000, 1.2, true)).toBe(expected)
  })

  it('getTotalMultiCost: both branches', () => {
    expect(equipment.getTotalMultiCost(40, 3, 10, false)).toBe(3 * (3 * 10 - 10 + 2 * 40) / 2)
    expect(equipment.getTotalMultiCost(40, 3, 1.2, true)).toBe(40 * ((1 - Math.pow(1.2, 3)) / (1 - 1.2)))
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — mostEfficientEquipment (best-weapon / best-armor selector) + equipfarmdynamicHD
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('equipment.mostEfficientEquipment — L1a selector', () => {
  it('picks a weapon (index 0) and armor (index 1); Pandemonium-blocked pieces skipped', () => {
    ;(globalThis as any).game = fullGame()
    // give Dagger a strong attackCalculated and Boots a strong healthCalculated
    ;(globalThis as any).game.equipment.Dagger.attackCalculated = 1000
    ;(globalThis as any).game.equipment.Boots.healthCalculated = 1000
    const [weapon, armor] = equipment.mostEfficientEquipment()
    expect(typeof weapon).toBe('string')
    expect(typeof armor).toBe('string')
    // attack (isAttack index 0) piece must be a weapon; armor (index 1) a health piece
    expect(['Dagger', 'Mace', 'Polearm', 'Battleaxe', 'Greatsword', 'Arbalest']).toContain(weapon)
  })

  it('Pandemonium isEquipBlocked drops a piece from consideration', () => {
    ;(globalThis as any).game = fullGame({
      global: { challengeActive: 'Pandemonium', world: 100, prestige: { attack: 1, health: 1, block: 1 } },
      challenges: { Pandemonium: { getEnemyMult: () => 1, isEquipBlocked: (n: string) => n === 'Dagger' } },
    })
    ;(globalThis as any).game.equipment.Dagger.attackCalculated = 1e9
    const [weapon] = equipment.mostEfficientEquipment()
    expect(weapon).not.toBe('Dagger')
  })
})

describe('equipment.equipfarmdynamicHD — L1a', () => {
  it('returns RcalcHDratio()-1 when the farm setting is off', () => {
    ;(globalThis as any).RcalcHDratio = () => 8
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = makeMinimalGame({ global: { world: 100 } })
    expect(equipment.equipfarmdynamicHD()).toBe(7)
  })

  // #56.2 — the fixed `world >= zone` gate. Fixtures: on, zone 50, HD 3, mult 2, RcalcHDratio 8.
  const farmSettings = {
    Requipfarmon: { type: 'boolean', enabled: true },
    Requipfarmzone: { type: 'value', value: '50' },
    RequipfarmHD: { type: 'value', value: '3' },
    Requipfarmmult: { type: 'value', value: '2' },
  }

  it('#56.2 world >= zone: computes the farm multiplier (unchanged — the observable case)', () => {
    ;(globalThis as any).RcalcHDratio = () => 8
    ;(globalThis as any).autoTrimpSettings = farmSettings
    ;(globalThis as any).game = makeMinimalGame({ global: { world: 60 } })
    // HDzone = 60-50 = 10 → mult^10 * HD = 2^10 * 3 = 3072
    expect(equipment.equipfarmdynamicHD()).toBe(3072)
  })

  it('#56.2 world < zone: now returns the default, not a negative-exponent value (the fix)', () => {
    ;(globalThis as any).RcalcHDratio = () => 8
    ;(globalThis as any).autoTrimpSettings = farmSettings
    ;(globalThis as any).game = makeMinimalGame({ global: { world: 30 } })
    // world 30 < zone 50 → fixed guard false → default RcalcHDratio()-1 = 7
    // (BEFORE the fix the always-true guard gave 2^(30-50)*3 ≈ 2.9e-6)
    expect(equipment.equipfarmdynamicHD()).toBe(7)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — evaluateEquipmentEfficiency (efficiency eval object)  golden master
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('equipment.evaluateEquipmentEfficiency — L1a eval object', () => {
  it('locked-upgrade path: white border, factor = Effect/Cost, no Wall', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).game = fullGame()
    ;(globalThis as any).game.upgrades.Dagadder.locked = 1 // skip the affordability block
    ;(globalThis as any).game.equipment.Dagger.attackCalculated = 200
    const r = equipment.evaluateEquipmentEfficiency('Dagger')
    expect(r.Stat).toBe('attack')
    expect(r.StatusBorder).toBe('white')
    expect(r.Factor).toBe(2) // 200 / 100
    expect(r.Wall).toBe(false)
  })

  it('resource-job locked (non-Metal challenge) zeroes the Factor and walls', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).game = fullGame()
    ;(globalThis as any).game.upgrades.Dagadder.locked = 1
    ;(globalThis as any).game.jobs.Miner.locked = 1
    const r = equipment.evaluateEquipmentEfficiency('Dagger')
    expect(r.Factor).toBe(0)
    expect(r.Wall).toBe(true)
  })

  it('cap reached (level >= CapEquip2) walls attack pieces', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).autoTrimpSettings = { CapEquip2: { type: 'value', value: 5 } }
    ;(globalThis as any).game = fullGame()
    ;(globalThis as any).game.upgrades.Dagadder.locked = 1
    ;(globalThis as any).game.equipment.Dagger.level = 5
    const r = equipment.evaluateEquipmentEfficiency('Dagger')
    expect(r.Factor).toBe(0)
    expect(r.Wall).toBe(true)
  })

  it('always2 override forces Factor 999-prestige when level < 2', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).autoTrimpSettings = { always2: { type: 'boolean', enabled: true } }
    ;(globalThis as any).game = fullGame()
    ;(globalThis as any).game.upgrades.Dagadder.locked = 1
    ;(globalThis as any).game.equipment.Dagger.level = 1
    ;(globalThis as any).game.equipment.Dagger.prestige = 3
    const r = equipment.evaluateEquipmentEfficiency('Dagger')
    expect(r.Factor).toBe(996)
  })

  // #63 retired the `needGymystic` global this branch used to set (it was hardcoded true at load and
  // never reset, so the flag carried no information). The branch's real output — wall the Shield so we
  // save the wood for Gymystic — is unchanged.
  it('Shield with blockNow + needed Gymystic → orange border, walled', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).game = fullGame()
    ;(globalThis as any).game.upgrades.Supershield.locked = 1
    ;(globalThis as any).game.equipment.Shield.blockNow = true
    ;(globalThis as any).game.upgrades.Gymystic.allowed = 1
    ;(globalThis as any).game.upgrades.Gymystic.done = 0
    const r = equipment.evaluateEquipmentEfficiency('Shield')
    expect(r.Stat).toBe('block')
    expect(r.StatusBorder).toBe('orange')
    expect(r.Wall).toBe(true)
  })

  it('affordable prestige path (red border) computes NextEffect/NextCost Wall', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).getNextPrestigeCost = () => 1000
    ;(globalThis as any).canAffordTwoLevel = () => true
    ;(globalThis as any).autoTrimpSettings = { BuyWeaponsNew: { type: 'multitoggle', value: 1 }, BuyArmorNew: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = fullGame()
    ;(globalThis as any).game.equipment.Dagger.level = 5
    const r = equipment.evaluateEquipmentEfficiency('Dagger')
    // resource owned (1e9) huge → NeedResource small → red
    expect(r.StatusBorder).toBe('red')
  })

  it('Scientist challenge (level>2) forces NextCost=Infinity, so no Wall', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).getScientistLevel = () => 3
    ;(globalThis as any).canAffordTwoLevel = () => false // yellow border, but Wall path still runs
    ;(globalThis as any).autoTrimpSettings = { BuyWeaponsNew: { type: 'multitoggle', value: 1 }, BuyArmorNew: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = fullGame({ global: { challengeActive: 'Scientist', world: 100, prestige: { attack: 1, health: 1, block: 1 } } })
    const r = equipment.evaluateEquipmentEfficiency('Dagger')
    expect(r.StatusBorder).toBe('yellow')
    expect(r.Wall).toBe(false) // NextEffect/Infinity = 0 > Factor is false
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — windstackingprestige (bool + side-effecting windstack) & areWeAttackLevelCapped
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('equipment.windstackingprestige — L1a decision + windstack side-effect', () => {
  it('returns true (no windstack) when no arm matches', () => {
    ;(globalThis as any).getEmpowerment = () => ''
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = fullGame()
    expect(equipment.windstackingprestige()).toBe(true)
    expect(buyUpgradeCalls).toEqual([])
  })

  it('Wind non-daily arm: returns false and runs orangewindstack (buyUpgrade log)', () => {
    ;(globalThis as any).getEmpowerment = () => 'Wind'
    ;(globalThis as any).calcHDratio = () => 0 // < 5
    ;(globalThis as any).autoTrimpSettings = { WindStackingMin: { type: 'value', value: 50 } }
    ;(globalThis as any).game = fullGame({ global: { world: 100, challengeActive: '', prestige: { attack: 1, health: 1, block: 1 } } })
    // arm weapons at level > 9 so orangewindstack's `9 < level` guard fires for them
    for (const w of ['Dagger', 'Mace', 'Polearm', 'Battleaxe', 'Greatsword', 'Arbalest']) (globalThis as any).game.equipment[w].level = 10
    expect(equipment.windstackingprestige()).toBe(false)
    // full ordered sequence: 6 weapons (level>9) then 7 armor (unconditional locked==0)
    expect(buyUpgradeCalls).toEqual([
      ['Dagadder', true, true], ['Megamace', true, true], ['Polierarm', true, true],
      ['Axeidic', true, true], ['Greatersword', true, true], ['Harmbalest', true, true],
      ['Bootboost', true, true], ['Hellishmet', true, true], ['Pantastic', true, true],
      ['Smoldershoulder', true, true], ['Bestplate', true, true], ['GambesOP', true, true],
      ['Supershield', true, true],
    ])
  })

  it('Daily wsmax arm: returns false and runs dorangewindstack', () => {
    ;(globalThis as any).getEmpowerment = () => ''
    ;(globalThis as any).calcHDratio = () => 1
    ;(globalThis as any).autoTrimpSettings = { dwsmax: { type: 'value', value: 50 }, dwsmaxhd: { type: 'value', value: 5 } }
    ;(globalThis as any).game = fullGame({ global: { world: 100, challengeActive: 'Daily', prestige: { attack: 1, health: 1, block: 1 } } })
    // weapons at level <= 9 → only the 7 armor unconditional buys fire
    expect(equipment.windstackingprestige()).toBe(false)
    expect(buyUpgradeCalls).toEqual([
      ['Bootboost', true, true], ['Hellishmet', true, true], ['Pantastic', true, true],
      ['Smoldershoulder', true, true], ['Bestplate', true, true], ['GambesOP', true, true],
      ['Supershield', true, true],
    ])
  })
})

describe('equipment.orangewindstack / dorangewindstack — L1b spy-log', () => {
  it('orangewindstack buys unlocked armor + level>9 weapons in order', () => {
    ;(globalThis as any).game = fullGame()
    ;(globalThis as any).game.equipment.Dagger.level = 10
    equipment.orangewindstack()
    expect(buyUpgradeCalls).toEqual([
      ['Dagadder', true, true],
      ['Bootboost', true, true], ['Hellishmet', true, true], ['Pantastic', true, true],
      ['Smoldershoulder', true, true], ['Bestplate', true, true], ['GambesOP', true, true],
      ['Supershield', true, true],
    ])
  })

  it('dorangewindstack skips a locked upgrade', () => {
    ;(globalThis as any).game = fullGame()
    ;(globalThis as any).game.upgrades.Supershield.locked = 1
    equipment.dorangewindstack()
    // no weapons (level 0), all armor except the locked Supershield
    expect(buyUpgradeCalls).toEqual([
      ['Bootboost', true, true], ['Hellishmet', true, true], ['Pantastic', true, true],
      ['Smoldershoulder', true, true], ['Bestplate', true, true], ['GambesOP', true, true],
    ])
  })
})

describe('equipment.areWeAttackLevelCapped / R — L1a bool', () => {
  it('true when every attack piece is capped (Factor 0 + Wall)', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).autoTrimpSettings = { CapEquip2: { type: 'value', value: 5 } }
    ;(globalThis as any).game = fullGame()
    for (const w of ['Dagger', 'Mace', 'Polearm', 'Battleaxe', 'Greatsword', 'Arbalest']) {
      ;(globalThis as any).game.upgrades[({ Dagger: 'Dagadder', Mace: 'Megamace', Polearm: 'Polierarm', Battleaxe: 'Axeidic', Greatsword: 'Greatersword', Arbalest: 'Harmbalest' } as any)[w]].locked = 1
      ;(globalThis as any).game.equipment[w].level = 5
    }
    expect(equipment.areWeAttackLevelCapped()).toBe(true)
  })

  it('false when an attack piece is not capped', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = fullGame()
    for (const u of ['Dagadder', 'Megamace', 'Polierarm', 'Axeidic', 'Greatersword', 'Harmbalest']) (globalThis as any).game.upgrades[u].locked = 1
    expect(equipment.areWeAttackLevelCapped()).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — preBuy3 / postBuy3 (state save/restore)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('equipment.preBuy3 / postBuy3 — L1b state save/restore', () => {
  it('preBuy3 snapshots game.global buy-state; postBuy3 restores it', () => {
    ;(globalThis as any).game = makeMinimalGame({ global: { buyAmt: 7, firing: false, lockTooltip: true, maxSplit: 3, firstCustomAmt: 4, lastCustomAmt: 5 } })
    equipment.preBuy3()
    const g = (globalThis as any).game
    g.global.buyAmt = 999; g.global.firing = true; g.global.lockTooltip = false
    g.global.maxSplit = 111; g.global.firstCustomAmt = 222; g.global.lastCustomAmt = 333
    equipment.postBuy3()
    expect(g.global.buyAmt).toBe(7)
    expect(g.global.firing).toBe(false)
    expect(g.global.lockTooltip).toBe(true)
    expect(g.global.maxSplit).toBe(3)
    expect(g.global.firstCustomAmt).toBe(4)
    expect(g.global.lastCustomAmt).toBe(5)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — autoLevelEquipment (U1 auto-level actuator: buyUpgrade prestige + buyEquipment levels)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('equipment.autoLevelEquipment — L1b spy-log', () => {
  it('early-out when calcOurDmg <= 0 (no buys)', () => {
    ;(globalThis as any).calcOurDmg = () => 0
    ;(globalThis as any).game = fullGame()
    equipment.autoLevelEquipment()
    expect(buyUpgradeCalls).toEqual([])
    expect(buyEquipmentCalls).toEqual([])
  })

  it('single unlocked weapon: prestige buyUpgrade (first loop) + level buyEquipment (second loop)', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).getNextPrestigeCost = () => 1e9 // huge → Wall false for the best weapon
    ;(globalThis as any).autoTrimpSettings = { BuyWeaponsNew: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = fullGame()
    // lock every upgrade except Dagadder so only Dagger produces a red border in the first loop
    for (const u of UPGRADE_NAMES) if (u !== 'Dagadder') (globalThis as any).game.upgrades[u].locked = 1
    ;(globalThis as any).game.equipment.Dagger.attackCalculated = 1000 // Best.attackmetal = Dagger
    equipment.autoLevelEquipment()
    expect(buyUpgradeCalls).toEqual([['Dagadder', true, true]])
    expect(buyEquipmentCalls).toEqual([['Dagger', null, true]])
  })

  it('always2 (level<2) forces a second lvl-2 armor buyEquipment at buyAmt 1', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).calcOurHealth = () => 1 // enoughHealthE false → armor level path opens
    ;(globalThis as any).autoTrimpSettings = {
      BuyArmorNew: { type: 'multitoggle', value: 1 },
      always2: { type: 'boolean', enabled: true },
    }
    ;(globalThis as any).game = fullGame()
    // lock ALL upgrades → white borders, no first-loop prestige buy; second loop still levels Best.
    for (const u of UPGRADE_NAMES) (globalThis as any).game.upgrades[u].locked = 1
    ;(globalThis as any).game.equipment.Boots.healthCalculated = 1000 // Best.healthmetal = Boots
    ;(globalThis as any).game.equipment.Boots.level = 1
    equipment.autoLevelEquipment()
    // Best iteration order = ['healthwood','healthmetal','attackmetal','blockwood']. healthwood=Shield
    // (level 0) and healthmetal=Boots (level 1) each fire the armor-level buy AND the always2 (level<2)
    // buy; attackmetal weapon path is gated off (BuyWeaponsNew unset); blockwood=Gym is non-Equip.
    expect(buyUpgradeCalls).toEqual([])
    expect(buyEquipmentCalls).toEqual([
      ['Shield', null, true], ['Shield', null, true],
      ['Boots', null, true], ['Boots', null, true],
    ])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — buyPrestigeMaybe (bool)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('equipment.buyPrestigeMaybe — L1a bool', () => {
  it('false when Pandemonium blocks the equip', () => {
    ;(globalThis as any).game = fullGame({
      global: { challengeActive: 'Pandemonium', world: 100, prestige: { attack: 1, health: 1, block: 1 } },
      challenges: { Pandemonium: { getEnemyMult: () => 1, isEquipBlocked: (n: string) => n === 'Boots' } },
    })
    expect(equipment.buyPrestigeMaybe('Boots')).toBe(false)
  })

  it('false when the prestige upgrade is locked', () => {
    ;(globalThis as any).game = fullGame()
    ;(globalThis as any).game.upgrades.Bootboost.locked = 1
    expect(equipment.buyPrestigeMaybe('Boots')).toBe(false)
  })

  it('true when affordable and the prestige raises total stat value', () => {
    ;(globalThis as any).getNextPrestigeCost = () => 100
    ;(globalThis as any).game = fullGame()
    ;(globalThis as any).game.equipment.Boots = { locked: 0, level: 1, prestige: 1, health: 6, healthCalculated: 10, cost: { metal: [40, 1.2] } }
    expect(equipment.buyPrestigeMaybe('Boots')).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — RautoEquip (radon full auto-equip)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('equipment.RautoEquip — L1b spy-log', () => {
  it('early-out when Requipon is off', () => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = fullGame()
    equipment.RautoEquip()
    expect(buyUpgradeCalls).toEqual([])
    expect(buyEquipmentCalls).toEqual([])
  })

  it('Requipon on, no prestige/always2: buys the best weapon+armor levels once (keepBuying stops)', () => {
    installSpies({ buyEquipmentReturn: false, buyUpgradeReturn: false }) // stop both loops after one pass
    ;(globalThis as any).RcalcHDratio = () => 1e9 // underStats override true
    ;(globalThis as any).autoTrimpSettings = { Requipon: { type: 'boolean', enabled: true } }
    ;(globalThis as any).game = fullGame()
    // every buyPrestigeMaybe returns false (lock all prestige upgrades) → prestige loop exits at once
    for (const u of UPGRADE_NAMES) (globalThis as any).game.upgrades[u].locked = 1
    ;(globalThis as any).game.equipment.Dagger.attackCalculated = 1e6
    ;(globalThis as any).game.equipment.Boots.healthCalculated = 1e6
    equipment.RautoEquip()
    expect(buyUpgradeCalls).toEqual([])
    // both slots (weapon index0, armor index1) buyEquipment(name, null, true, 1); returns false → loop ends
    expect(buyEquipmentCalls.length).toBeGreaterThan(0)
    expect(buyEquipmentCalls.every((c) => c[1] === null && c[2] === true && c[3] === 1)).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — Rgetequips (special-map unlock counter) + estimateEquipsForZone
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('equipment.Rgetequips — L1a count selector', () => {
  function unlock(over: Record<string, any> = {}) {
    return { prestige: true, locked: false, startAt: 0, lastAt: 9999, world: 0, ...over }
  }
  it('counts a canRunOnce prestige unlock matching the world', () => {
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 100, universe: 1, brokenPlanet: false },
      talents: { bionic2: { purchased: false } },
      mapUnlocks: {
        A: unlock({ world: 100, canRunOnce: true }),
        B: unlock({ world: 50, canRunOnce: true }), // world mismatch, world>0 → skip
      },
      mapConfig: { locations: { Plentiful: { upgrade: [] } } },
    })
    expect(equipment.Rgetequips(100, false)).toBe(1)
  })

  it('even-world (world == -2) modulo unlock counts only on even zones', () => {
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 100, universe: 1, brokenPlanet: false },
      talents: { bionic2: { purchased: false } },
      mapUnlocks: { E: unlock({ world: -2, canRunOnce: true }) },
      mapConfig: { locations: { Plentiful: { upgrade: [] } } },
    })
    expect(equipment.Rgetequips(100, false)).toBe(1) // 100 % 2 === 0 → counts
    expect(equipment.Rgetequips(101, false)).toBe(0) // odd → skipped
  })
})

describe('equipment.estimateEquipsForZone — L1a', () => {
  it('returns [0, {}] when neither health nor attack is needed', () => {
    ;(globalThis as any).RcalcBadGuyDmg = () => 0.001 // tiny enemy dmg → healthNeededMulti < 1
    ;(globalThis as any).RcalcOurHealth = () => 1e9
    ;(globalThis as any).RgetEnemyMaxHealth = () => 0.001 // tiny → attackNeededMulti < 1
    ;(globalThis as any).RcalcOurDmg = () => 1e9
    ;(globalThis as any).RcalcHDratio = () => 1.0001
    ;(globalThis as any).autoTrimpSettings = { Rhitssurvived: { type: 'value', value: 1 } }
    ;(globalThis as any).game = fullGame({ portal: {
      Artisanistry: { modifier: 0, level: 0, radLevel: 0 }, Resourceful: { modifier: 0, level: 0 },
      Equality: { modifier: 0.9, radLevel: 0 },
    } })
    const r = equipment.estimateEquipsForZone()
    expect(r[0]).toBe(0)
    expect(r[1]).toEqual({})
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// HARD-GATE coverage: fixtures that drive each introduced ===/!== to a LIVE evaluation that the
// earlier tests short-circuited past (Liquimp cap, Lead zone parity, Wind/loomswap arms, armor-
// upgrade Resource==='wood', Rgetequips brokenPlanet/filterUpgrade/level-last/modulo arms,
// RautoEquip !=='Pandemonium', equipfarmdynamicHD ===0).
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('equipment — hard-gate branch coverage', () => {
  it('Liquimp isLiquified cap drives evaluate `.name === "Liquimp"`', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).autoTrimpSettings = { CapEquip2: { type: 'value', value: 5 } }
    const liq = () => fullGame({
      global: {
        world: 100, challengeActive: '', mapsActive: false, gridArray: [{ name: 'Liquimp' }],
        prestige: { attack: 1, health: 1, block: 1 },
      },
      options: { menu: { liquification: { enabled: true } } },
      talents: { liquification: { purchased: true }, bionic2: { purchased: false } },
    })
    ;(globalThis as any).game = liq()
    ;(globalThis as any).game.upgrades.Dagadder.locked = 1
    ;(globalThis as any).game.equipment.Dagger.level = 5 // >= cap/capDivisor (5/10)
    expect(equipment.evaluateEquipmentEfficiency('Dagger').Factor).toBe(0)
  })

  it('Lead challenge drives autoLevelEquipment `world % 2 === 1 && world !== 179`', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = fullGame({ global: { world: 101, challengeActive: 'Lead', mapBonus: 0, prestige: { attack: 1, health: 1, block: 1 } } })
    for (const u of UPGRADE_NAMES) (globalThis as any).game.upgrades[u].locked = 1 // no buys; just reach the arm
    expect(() => equipment.autoLevelEquipment()).not.toThrow()
    expect(buyUpgradeCalls).toEqual([])
  })

  it('Wind non-daily arm drives autoLevelEquipment line-305 `challengeActive !== "Daily"` + loomswap', () => {
    ;(globalThis as any).getEmpowerment = () => 'Wind'
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).autoTrimpSettings = {
      AutoStance: { type: 'multitoggle', value: 3 },
      WindStackingMin: { type: 'value', value: 50 },
      windcutoff: { type: 'value', value: 2 },
      loomswap: { type: 'value', value: 1 },
      highdmg: { type: 'dropdown', selected: 'Boots' }, // != ShieldEquipped.name 'Shield'
    }
    ;(globalThis as any).game = fullGame({ global: {
      world: 100, challengeActive: '', runningChallengeSquared: false, mapBonus: 0,
      ShieldEquipped: { name: 'Shield' }, prestige: { attack: 1, health: 1, block: 1 },
    } })
    for (const u of UPGRADE_NAMES) (globalThis as any).game.upgrades[u].locked = 1
    expect(() => equipment.autoLevelEquipment()).not.toThrow()
  })

  it('Wind daily arm drives autoLevelEquipment line-307 `=== "Daily"` + dloomswap', () => {
    ;(globalThis as any).getEmpowerment = () => 'Wind'
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).autoTrimpSettings = {
      use3daily: { type: 'boolean', enabled: true },
      dWindStackingMin: { type: 'value', value: 50 },
      dwindcutoff: { type: 'value', value: 2 },
      dloomswap: { type: 'value', value: 1 },
      dhighdmg: { type: 'dropdown', selected: 'Boots' },
    }
    ;(globalThis as any).game = fullGame({ global: {
      world: 100, challengeActive: 'Daily', runningChallengeSquared: false, mapBonus: 0,
      ShieldEquipped: { name: 'Shield' }, prestige: { attack: 1, health: 1, block: 1 },
    } })
    for (const u of UPGRADE_NAMES) (globalThis as any).game.upgrades[u].locked = 1
    expect(() => equipment.autoLevelEquipment()).not.toThrow()
  })

  it('armor-upgrade DelayArmor wood arm drives autoLevel `Stat===\'health\'` + `Resource===\'wood\'`', () => {
    ;(globalThis as any).getBuildingItemPrice = () => 100
    ;(globalThis as any).getNextPrestigeCost = () => 1e9
    ;(globalThis as any).shouldFarm = true // arm1 false
    ;(globalThis as any).calcOurHealth = () => 1e12 // enoughHealthE true → arm3 false → reach wood arm
    ;(globalThis as any).autoTrimpSettings = {
      BuyArmorNew: { type: 'multitoggle', value: 1 },
      DelayArmorWhenNeeded: { type: 'boolean', enabled: true },
    }
    ;(globalThis as any).game = fullGame()
    // only Supershield unlocked → Shield (health, wood) is the sole red piece
    for (const u of UPGRADE_NAMES) if (u !== 'Supershield') (globalThis as any).game.upgrades[u].locked = 1
    equipment.autoLevelEquipment()
    expect(buyUpgradeCalls).toEqual([['Supershield', true, true]])
  })


  it('RautoEquip Requip2 (always-2) drives line-1103 `challengeActive !== \'Pandemonium\'`', () => {
    installSpies({ buyEquipmentReturn: false, buyUpgradeReturn: false })
    ;(globalThis as any).autoTrimpSettings = {
      Requipon: { type: 'boolean', enabled: true },
      Requip2: { type: 'boolean', enabled: true },
    }
    ;(globalThis as any).game = fullGame()
    for (const u of UPGRADE_NAMES) (globalThis as any).game.upgrades[u].locked = 1 // no prestige
    // every equip level 0 (<2) → always-2 loop buys each once at amount 1
    equipment.RautoEquip()
    // 13 RequipmentList slots would each get a lvl<2 buy; assert the always-2 buys happened
    expect(buyEquipmentCalls.some((c) => c[3] === 1)).toBe(true)
  })

  it('equipfarmdynamicHD farm-on path drives `equipfarmHDzone === 0`', () => {
    ;(globalThis as any).RcalcHDratio = () => 8
    ;(globalThis as any).autoTrimpSettings = {
      Requipfarmon: { type: 'boolean', enabled: true },
      Requipfarmzone: { type: 'value', value: 100 }, // world - zone = 0 → the ===0 arm
      RequipfarmHD: { type: 'value', value: 3 },
      Requipfarmmult: { type: 'value', value: 2 },
    }
    ;(globalThis as any).game = makeMinimalGame({ global: { world: 100 } })
    // Note: the `world >= (getPageSetting && ...)` guard is a faithful-port oddity (boolean RHS);
    // world 100 >= true(1) holds → the body runs and equipfarmHDzone (100-100) === 0 → returns HD 3.
    expect(equipment.equipfarmdynamicHD()).toBe(3)
  })

  it('Rgetequips brokenPlanet ===1 / ===-1 arms', () => {
    const base = (bp: boolean, world: number) => makeMinimalGame({
      global: { world: 100, universe: 1, brokenPlanet: bp },
      talents: { bionic2: { purchased: false } },
      mapUnlocks: { X: { prestige: true, locked: false, startAt: 0, lastAt: 9999, world, canRunOnce: true, brokenPlanet: world === 100 ? 1 : -1 } },
      mapConfig: { locations: { Plentiful: { upgrade: [] } } },
    })
    ;(globalThis as any).game = base(false, 100) // brokenPlanet===1 && !bp → skip
    expect(equipment.Rgetequips(100, false)).toBe(0)
    ;(globalThis as any).game = base(true, 50) // brokenPlanet===-1 && bp → skip
    expect(equipment.Rgetequips(100, false)).toBe(0)
  })

  it('Rgetequips filterUpgrade array + string arms (`upgrade[x] !== item` / `upgrade !== item`)', () => {
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 100, universe: 1, brokenPlanet: false },
      talents: { bionic2: { purchased: false } },
      mapUnlocks: { A: { prestige: true, locked: false, startAt: 0, lastAt: 9999, world: 100, canRunOnce: true, filterUpgrade: true } },
      mapConfig: { locations: { Plentiful: { upgrade: ['A'] } } }, // array contains 'A' → usable
    })
    expect(equipment.Rgetequips(100, false)).toBe(1)
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 100, universe: 1, brokenPlanet: false },
      talents: { bionic2: { purchased: false } },
      mapUnlocks: { A: { prestige: true, locked: false, startAt: 0, lastAt: 9999, world: 100, canRunOnce: true, filterUpgrade: true } },
      mapConfig: { locations: { Plentiful: { upgrade: 'B' } } }, // string 'B' !== 'A' → skip
    })
    expect(equipment.Rgetequips(100, false)).toBe(0)
  })

  // Also the #56/#3 regression guard: the level==="last" block does specialCount++ then an
  // unconditional continue; result 1 confirms the removed dead post-continue (canLast=3/0) block
  // never affected the count.
  it('Rgetequips level==="last" block drives `canLast === 2` + `level === "last"` (871)', () => {
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 100, universe: 1, brokenPlanet: false },
      talents: { bionic2: { purchased: false } },
      mapUnlocks: { L: { prestige: true, locked: false, startAt: 0, lastAt: 9999, world: 50, canRunOnce: true, level: 'last' } },
      mapConfig: { locations: { Plentiful: { upgrade: [] } } },
    })
    expect(equipment.Rgetequips(100, false)).toBe(1)
  })

  it('Rgetequips negative-world modulo arms (-3/-5/-33/-10/-20/-25)', () => {
    const mk = (w: number) => ({ prestige: true, locked: false, startAt: 0, lastAt: 9999, world: w, canRunOnce: true })
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 100, universe: 1, brokenPlanet: false },
      talents: { bionic2: { purchased: false } },
      mapUnlocks: { A: mk(-3), B: mk(-5), C: mk(-33), D: mk(-10), E: mk(-20), F: mk(-25) },
      mapConfig: { locations: { Plentiful: { upgrade: [] } } },
    })
    // map=100: -3 (100%2=0!=1)→skip, -33 (100%3=1!=0)→skip; -5/-10/-20/-25 (100%N==0)→count = 4
    expect(equipment.Rgetequips(100, false)).toBe(4)
  })
})
