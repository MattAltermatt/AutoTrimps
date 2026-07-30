// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #224 — the Experience wonder-farm bought a map without ever writing mapLevelInput.
//
// buyMap() reads that input, so the map created was at whatever the box last held — normally
// `siphlvl` (world - Siphonology) left by autoMap's ordinary create path. The game only rolls a
// Wonder when `mapLevel >= game.global.world`, so a sub-world map is Wonder-ineligible, and the next
// tick's `map.level == game.global.world` filter fails to match it too — so the branch re-enters and
// buys again. The level was already computed and LOGGED one line above; it just never reached the DOM.

const G = globalThis as any
let maps: typeof import('../src/modules/maps')

beforeAll(async () => {
  G.MODULES = { maps: {} }
  G.autoTrimpSettings = {}
  G.getPlayerCritChance = () => 0
  document.body.insertAdjacentHTML('beforeend',
    `<div id="portalBtn" style="display:none"></div><input id="mapLevelInput">` +
    // updateAutoMapsStatus is a MODULE-internal call, so a globalThis stub cannot intercept it —
    // it needs the real nodes (CLAUDE.md: you cannot spy on a converted module by reassigning
    // the global).
    `<div id="autoMapStatus"></div><div id="hiderStatus"></div>` +
    `<input id="sizeAdvMapsRange"><input id="lootAdvMapsRange"><input id="difficultyAdvMapsRange">` +
    `<select id="biomeAdvMapsSelect"><option>Random</option></select>` +
    `<select id="advSpecialSelect"><option>0</option></select>` +
    `<select id="advExtraLevelSelect"><option>0</option></select><span id="advPerfectCheckbox"></span>`)
  maps = await import('../src/modules/maps')
})

let buyMapLevels: string[]

function arm(over: { world?: number; staleInput?: string; wonders?: number } = {}) {
  const world = over.world ?? 700
  buyMapLevels = []
  // autoMap() reads 38 settings before it reaches the wonder-farm block (enumerated mechanically
  // from the source rather than discovered one crash at a time). Everything irrelevant is seeded to
  // its inert value; the four that matter are set explicitly below.
  const INERT_VALUE = ['maxExpZone', 'wondersAmount', 'finishExpOnBw', 'DisableFarm', 'ForcePresZ',
    'MapDamageCutoff', 'MaxMapBonusAfterZone', 'MaxMapBonushealth', 'MaxMapBonuslimit',
    'MinutestoFarmBeforeSpire', 'VoidMaps', 'DailyVoidMod', 'WindStackingMin', 'dWindStackingMin',
    'windcutoffmap', 'dwindcutoffmap', 'mapc2hd', 'voidscell', 'dvoidscell', 'RunNewVoidsUntilNew',
    'dRunNewVoidsUntilNew', 'PrestigeSkip1_2', 'PowerSaving', 'AutoStance', 'AutoMaps']
  const INERT_BOOL = ['AdvMapSpecialModifier', 'DynamicSiphonology', 'FarmWhenNomStacks7',
    'LowerFarmingZone', 'MaxStacksForSpire', 'SkipSpires', 'use3daily', 'novmsc2',
    'onlystackedvoids', 'runnewvoidspoison', 'drunnewvoidspoison']
  G.autoTrimpSettings = {}
  for (const id of INERT_VALUE) G.autoTrimpSettings[id] = { type: 'value', value: '-1' }
  for (const id of INERT_BOOL) G.autoTrimpSettings[id] = { type: 'boolean', enabled: false }
  G.autoTrimpSettings.Prestige = { type: 'dropdown', selected: 'Off' }
  G.autoTrimpSettings.mapselection = { type: 'dropdown', selected: 'Random' }
  // The four this test is actually about.
  G.autoTrimpSettings.farmWonders = { type: 'boolean', enabled: true }
  G.autoTrimpSettings.maxExpZone = { type: 'value', value: '700' }
  G.autoTrimpSettings.wondersAmount = { type: 'value', value: '5' }
  G.autoTrimpSettings.finishExpOnBw = { type: 'valueNegative', value: '-1' }
  G.game = {
    global: {
      // Enumerated mechanically from autoMap's own reads, not discovered one crash at a time.
      world, mapsActive: false, preMapsActive: true, mapsOwnedArray: [],
      challengeActive: 'Experience', mapsUnlocked: true, totalPortals: 1, time: 1e7,
      repeatMap: false, lastClearedCell: 50, mapBonus: 0, gridArray: [{}],
      brokenPlanet: true, canMapAtZone: false, currentMapId: '', decayDone: false,
      lastClearedMapCell: 0, mapGridArray: [{}], runningChallengeSquared: false,
      selectedMapPreset: 1, spireActive: false, switchToMaps: false, totalVoidMaps: 0,
      universe: 1, zoneStarted: 0,
    },
    challenges: { Experience: { nextWonder: 600, wonders: over.wonders ?? 0 }, Mapology: { credits: 99 } },
    stats: { heliumHour: { value: () => 0 } },
    // Siphonology is REAL here, not the Proxy default. autoMap's ordinary create path writes
    // `siphlvl = world - Siphonology.level` into mapLevelInput just before the wonder-farm block,
    // and that is precisely the stale value #224 was buying at. With Siphonology 0 the ordinary
    // path leaves 700 in the box, the wonder-farm's write is redundant, and the revert mutant
    // SURVIVES — which is exactly what happened on the first pass.
    portal: new Proxy({ Siphonology: { level: 8 } } as any, {
      get: (t, k: string) => t[k] ?? { level: 0, radLevel: 0, modifier: 0 },
    }),
    jobs: new Proxy({} as any, { get: () => ({ owned: 0, locked: true, modifier: 0 }) }),
    buildings: new Proxy({} as any, { get: () => ({ owned: 0, purchased: 0, locked: true }) }),
    unlocks: { impCount: new Proxy({} as any, { get: () => 0 }) },
    resources: { helium: { owned: 0 }, fragments: { owned: 1e30 } },
    options: { menu: { mapLoot: { enabled: 1 }, repeatUntil: { enabled: 0 }, mapAtZone: { enabled: 0 }, exitTo: { enabled: 0 }, repeatVoids: { enabled: 0 } } },
    // upgrades / talents are read by NAME all over autoMap's upstream. A "nothing owned" Proxy is a
    // well-defined fixture (every upgrade not done, every talent not purchased) rather than a
    // catch-all that could hide a miss: this test asserts ONE DOM write in the wonder-farm branch,
    // and the anti-false-green rows below prove the branch is genuinely reached and genuinely gated.
    upgrades: new Proxy({ Bounty: { allowed: 1 }, Shieldblock: { allowed: 1 } } as any, {
      get: (t, k: string) => t[k] ?? { done: 0, allowed: 0, locked: true },
    }),
    talents: new Proxy({ mapLoot: { purchased: false }, portal: { purchased: true }, bounty: { purchased: true } } as any, {
      get: (t, k: string) => t[k] ?? { purchased: false },
    }),
    mapUnlocks: new Proxy({ AncientTreasure: { canRunOnce: false } } as any, {
      get: (t, k: string) => t[k] ?? { canRunOnce: false, level: 0 },
    }),
  }
  // The stale value the box carries in from autoMap's ordinary create path.
  ;(document.getElementById('mapLevelInput') as HTMLInputElement).value = over.staleInput ?? String(world - 8)
  G.byId = (id: string) => document.getElementById(id)
  // Three map-designer inputs autoMap reaches as BARE identifiers (the game publishes DOM ids as
  // globals). jsdom's named-element access does not reach the module's globalThis, so publish them.
  for (const id of ['sizeAdvMapsRange', 'lootAdvMapsRange', 'difficultyAdvMapsRange', 'biomeAdvMapsSelect', 'advSpecialSelect', 'advExtraLevelSelect'])
    G[id] = document.getElementById(id)
  G.mapsClicked = () => {}
  G.debug = () => {}
  G.calcOurDmg = () => 1e9
  G.challengeActive = (c: string) => G.game.global.challengeActive === c
  G.getEmpowerment = () => ''
  G.toggleSetting = () => {}
  G.repeatClicked = () => {}
  G.getExtraMapLevels = () => 0
  G.updateAutoMapsStatus = () => {}
  // The rest of autoMap's free-identifier calls, enumerated from its source. All neutral: this test
  // is about ONE DOM write in the wonder-farm branch, and everything upstream just has to not throw.
  G.calcBadGuyDmg = () => 1
  G.calcEnemyHealth = () => 1
  G.calcHDratio = () => 1
  G.calcOurBlock = () => 1e9
  G.calcOurHealth = () => 1e9
  G.calcSpire = () => 0
  G.getEnemyMaxAttack = () => 1
  G.getEnemyMaxHealth = () => 1
  G.getCorruptScale = () => 1
  G.getCurrentMapObject = () => ({ level: 700, location: 'Plentiful' })
  G.getMapIndex = () => 0
  G.getPierceAmt = () => 0
  G.getTime = () => 0
  G.highDamageShield = () => {}
  G.countMapItems = () => 0
  G.adjustMap = () => {}
  G.addSpecials = () => {}
  G.areWeAttackLevelCapped = () => false
  G.mapsSwitch = () => {}
  G.selectAdvMapsPreset = () => {}
  G.updateMapCost = () => 0
  G.isActiveSpireAT = () => false
  G.disActiveSpireAT = () => false
  G.swapNiceCheckbox = () => {}
  G.getMapPreset = () => ({ perfect: false, loot: 9, difficulty: 9, size: 9 })
  G.recycleBelow = () => {}
  G.recycleMap = () => {}
  G.selectMap = () => {}
  G.runMap = () => {}
  // buyMap reads the input the way the game does — record what it would have created.
  G.buyMap = () => {
    buyMapLevels.push((document.getElementById('mapLevelInput') as HTMLInputElement).value)
    return 1
  }
}

beforeEach(() => arm())

describe('#224 — the wonder-farm buys at WORLD level, not whatever the box held', () => {
  // NOTE: autoMap's ORDINARY create path can also call buyMap in the same tick, so the count is not
  // the observable — the LAST buy is the wonder-farm one (its block runs after), and the invariant
  // that matters is that no buy the wonder-farm makes is below world level.
  const lastBuy = () => Number(buyMapLevels[buyMapLevels.length - 1])

  it('THE BUG: the wonder-farm buy sees the current world, not the stale siphonology level', () => {
    arm({ world: 700, staleInput: '692' })
    maps.autoMap()
    expect(G.farmingWonder).toBe(true) // the block really ran
    expect(lastBuy()).toBe(700)
  })

  it('every buy is Wonder-eligible for any stale value', () => {
    // config.js:4053 — `if (mapLevel < game.global.world) return;` is the game's Wonder gate.
    for (const stale of ['1', '699', '650', '']) {
      arm({ world: 700, staleInput: stale })
      maps.autoMap()
      expect(lastBuy(), `stale ${stale}`).toBeGreaterThanOrEqual(700)
    }
  })

  it('anti-false-green: the stale value really is what the box held going in', () => {
    // Otherwise the rows above pass against a build that never writes the input, simply because the
    // box happened to already hold the right number.
    arm({ world: 700, staleInput: '692' })
    expect((document.getElementById('mapLevelInput') as HTMLInputElement).value).toBe('692')
  })

  it('anti-false-green: the wonder-farm block stands down once the quota is met', () => {
    // Asserted on the block's own marker rather than on buy COUNT, because the ordinary create path
    // is free to buy in the same tick and would mask this.
    arm({ world: 700, wonders: 5 }) // wondersAmount 5, so 5 > 5 is false
    maps.autoMap()
    expect(G.farmingWonder).toBeFalsy()
  })
})
