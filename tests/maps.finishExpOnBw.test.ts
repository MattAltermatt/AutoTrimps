// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'

// #223 — `finishExpOnBw = -1` could not switch the Experience BW finish off.
//
// The 125 clamp ran BEFORE the -1 test, so -1 became 125 and then snapped to 125. `finishOnBw` was
// therefore never -1 for any input (a 101,012-value sweep produced none), which made the `: -1` arm
// dead code AND the `finishOnBw != -1` conjunct in the branch gate a constant true. A user who typed
// -1 got AT committing to BW 125, and the game only accepts `mapLevel >= 605 && world > 600` as an
// Experience completion (config.js:9163) — so the challenge could not end via the BW route and AT
// re-entered a sub-605 BW every time it exited.
//
// The author's own encoding is settled, not inferred: the sibling `wondersFromZ != -1` in the very
// same conjunction was added a day later (c8b0ca08) for exactly this hazard on maxExpZone.

const G = globalThis as any
let maps: typeof import('../src/modules/maps')

beforeAll(async () => {
  G.MODULES = { maps: {} }
  G.autoTrimpSettings = {}
  G.getPlayerCritChance = () => 0
  document.body.insertAdjacentHTML('beforeend',
    `<div id="portalBtn" style="display:none"></div><input id="mapLevelInput">` +
    `<div id="autoMapStatus"></div><div id="hiderStatus"></div>` +
    `<input id="sizeAdvMapsRange"><input id="lootAdvMapsRange"><input id="difficultyAdvMapsRange">` +
    `<select id="biomeAdvMapsSelect"><option>Random</option></select>` +
    `<select id="advSpecialSelect"><option>0</option></select>` +
    `<select id="advExtraLevelSelect"><option>0</option></select><span id="advPerfectCheckbox"></span>`)
  maps = await import('../src/modules/maps')
})

let selected: string[]
let ranMap: number

/** purgeBionics() (main.js:13570) keeps at most 3 Bionic maps — a realistic deep inventory. */
const OWNED_BW = [575, 590, 605]

function arm(finishExpOnBw: string, over: { world?: number; bwLevels?: number[] } = {}) {
  const world = over.world ?? 601
  selected = []
  ranMap = 0
  const INERT_VALUE = ['DisableFarm', 'ForcePresZ', 'MapDamageCutoff', 'MaxMapBonusAfterZone',
    'MaxMapBonushealth', 'MaxMapBonuslimit', 'MinutestoFarmBeforeSpire', 'VoidMaps', 'DailyVoidMod',
    'WindStackingMin', 'dWindStackingMin', 'windcutoffmap', 'dwindcutoffmap', 'mapc2hd', 'voidscell',
    'dvoidscell', 'RunNewVoidsUntilNew', 'dRunNewVoidsUntilNew', 'PrestigeSkip1_2', 'PowerSaving',
    'AutoStance', 'AutoMaps']
  const INERT_BOOL = ['AdvMapSpecialModifier', 'DynamicSiphonology', 'FarmWhenNomStacks7',
    'LowerFarmingZone', 'MaxStacksForSpire', 'SkipSpires', 'use3daily', 'novmsc2',
    'onlystackedvoids', 'runnewvoidspoison', 'drunnewvoidspoison']
  G.autoTrimpSettings = {}
  for (const id of INERT_VALUE) G.autoTrimpSettings[id] = { type: 'value', value: '-1' }
  for (const id of INERT_BOOL) G.autoTrimpSettings[id] = { type: 'boolean', enabled: false }
  G.autoTrimpSettings.Prestige = { type: 'dropdown', selected: 'Off' }
  G.autoTrimpSettings.mapselection = { type: 'dropdown', selected: 'Random' }
  // The four the finish-BW gate reads.
  G.autoTrimpSettings.farmWonders = { type: 'boolean', enabled: true }
  G.autoTrimpSettings.maxExpZone = { type: 'value', value: '600' } // != -1, and world >= it
  G.autoTrimpSettings.wondersAmount = { type: 'value', value: '5' }
  G.autoTrimpSettings.finishExpOnBw = { type: 'value', value: finishExpOnBw }
  G.game = {
    global: {
      world, mapsActive: false, preMapsActive: true, challengeActive: 'Experience',
      mapsUnlocked: true, totalPortals: 1, time: 1e7, repeatMap: false, lastClearedCell: 50,
      mapBonus: 0, gridArray: [{}], brokenPlanet: true, canMapAtZone: false, currentMapId: '',
      decayDone: false, lastClearedMapCell: 0, mapGridArray: [{}], runningChallengeSquared: false,
      selectedMapPreset: 1, spireActive: false, switchToMaps: false, totalVoidMaps: 0,
      universe: 1, zoneStarted: 0,
      mapsOwnedArray: (over.bwLevels ?? OWNED_BW).map((level) => ({
        level, id: 'bw' + level, location: 'Bionic', noRecycle: false, name: 'Bionic Wonderland',
      })),
    },
    // nextWonder far above `world` so the FIRST arm (wonder-farming) stands down and the else-if
    // finish-BW arm is the one under test. Without this the wonder-farm buy masks everything.
    challenges: { Experience: { nextWonder: 1e9, wonders: 0 }, Mapology: { credits: 99 } },
    stats: { heliumHour: { value: () => 0 } },
    portal: new Proxy({} as any, { get: () => ({ level: 0, radLevel: 0, modifier: 0 }) }),
    jobs: new Proxy({} as any, { get: () => ({ owned: 0, locked: true, modifier: 0 }) }),
    buildings: new Proxy({} as any, { get: () => ({ owned: 0, purchased: 0, locked: true }) }),
    unlocks: { impCount: new Proxy({} as any, { get: () => 0 }) },
    resources: { helium: { owned: 0 }, fragments: { owned: 1e30 } },
    options: { menu: { mapLoot: { enabled: 1 }, repeatUntil: { enabled: 0 }, mapAtZone: { enabled: 0 }, exitTo: { enabled: 0 }, repeatVoids: { enabled: 0 } } },
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
  G.byId = (id: string) => document.getElementById(id)
  for (const id of ['sizeAdvMapsRange', 'lootAdvMapsRange', 'difficultyAdvMapsRange', 'biomeAdvMapsSelect', 'advSpecialSelect', 'advExtraLevelSelect'])
    G[id] = document.getElementById(id)
  G.selectMap = (id: string) => { selected.push(id) }
  G.runMap = () => { ranMap++ }
  G.buyMap = () => 1
  G.mapsClicked = () => {}
  G.debug = () => {}
  G.calcOurDmg = () => 1e9
  G.challengeActive = (c: string) => G.game.global.challengeActive === c
  G.getEmpowerment = () => ''
  G.toggleSetting = () => {}
  G.repeatClicked = () => {}
  G.getExtraMapLevels = () => 0
  G.updateAutoMapsStatus = () => {}
  G.calcBadGuyDmg = () => 1
  G.calcEnemyHealth = () => 1
  G.calcHDratio = () => 1
  G.calcOurBlock = () => 1e9
  G.calcOurHealth = () => 1e9
  G.calcSpire = () => 0
  G.getEnemyMaxAttack = () => 1
  G.getEnemyMaxHealth = () => 1
  G.getCorruptScale = () => 1
  G.getCurrentMapObject = () => ({ level: world, location: 'Plentiful' })
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
  G.farmingWonder = undefined
  maps.autoMap()
}

describe('#223 — finishExpOnBw = -1 disables the Experience BW finish', () => {
  it('ANTI-FALSE-GREEN: the branch really is armed and really does run a BW', () => {
    // Without this row, "-1 selects nothing" could just mean the fixture never reaches the branch.
    arm('605')
    expect(G.farmingWonder).toBe(true)
    expect(selected).toEqual(['bw605'])
    expect(ranMap).toBe(1)
  })

  it('THE BUG: -1 must run no BW at all', () => {
    // Was: the 125 clamp turned -1 into 125, the gate passed, and AT ran the LOWEST owned BW (575)
    // — never-completable, and re-selected every time the map ended.
    arm('-1')
    expect(G.farmingWonder).toBeFalsy()
    expect(selected).toEqual([])
    expect(ranMap).toBe(0)
  })

  it('the documented snap is unchanged: 606 -> 605, and a below-125 value still clamps to 125', () => {
    // The clamp and snap are the tooltip's promise (settings-defs.ts:1348) and are NOT part of this
    // fix. Pinning them here is what makes "-1 is special" a claim about the sentinel alone.
    arm('606')
    expect(selected).toEqual(['bw605'])

    // 0 clamps to 125; no BW 125 is owned and every owned BW is above it, so the fallback picks the
    // LOWEST (bionics is sorted descending, so that is the last element). This is the never-
    // completable outcome the -1 path used to share — kept, because changing it is a behaviour
    // decision about every value < 605, not about the sentinel.
    arm('0')
    expect(selected).toEqual(['bw575'])
  })

  it('-1 disables ONLY the BW finish — wonder-farming carries on', () => {
    // Found by review as a surviving near-miss: `if (finishOnBw == -1) { farmingWonder = false; return }`
    // placed before the wonder arm passes every other assertion in this file, because they only check
    // that no BW was selected. It also silently kills the feature the tooltip promises to keep. The
    // justifying claim ("keep wonder-farming") was prose in a tooltip and nowhere an expect — the
    // exact shape CLAUDE.md's "write the justifying claim as an assertion" rule exists for.
    //
    // nextWonder <= world arms the wonder-farm branch, which lives BEFORE the finish-BW else-if.
    arm('-1', { world: 601 })
    G.game.challenges.Experience.nextWonder = 600 // 601 >= 600 → the wonder arm is live
    selected = []
    G.farmingWonder = undefined
    maps.autoMap()
    expect(G.farmingWonder, 'the wonder-farm arm must still run with the BW finish disabled').toBe(true)
    expect(selected, 'and it must not be selecting a Bionic Wonderland').toEqual([])
  })

  it('-1 ONLY: other negatives still clamp to 125, as the tooltip promises', () => {
    // `pageSetting < 0` reads as the same fix and is a different feature: it would make every
    // negative a disable, contradicting `cannot: anything lower is treated as 125`. -1 is the
    // sentinel the code already tested for and the one the value dialog advertises; -5 is just an
    // out-of-range number.
    arm('-5')
    expect(G.farmingWonder).toBe(true)
    expect(selected).toEqual(['bw575'])
  })

  it('the sibling maxExpZone = -1 sentinel still gates the same branch', () => {
    // Both conjuncts must independently be able to stop it; a fix that made finishOnBw live by
    // weakening the gate would show up here.
    arm('605')
    expect(selected).toEqual(['bw605'])
    G.autoTrimpSettings.maxExpZone = { type: 'value', value: '-1' }
    selected = []
    G.farmingWonder = undefined
    maps.autoMap()
    expect(selected).toEqual([])
    expect(G.farmingWonder).toBeFalsy()
  })
})
