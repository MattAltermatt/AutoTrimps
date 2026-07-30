// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #221 — autoMap's Map-at-Zone mirror walked the raw `.setZone` array.
//
// `game.options.menu.mapAtZone` carries FOUR row arrays (setZone / setZoneB / setZoneU2 /
// setZoneU2B, config.js:1421-1426) and `getSetZone()` (config.js:1435) picks by universe + A/B mode.
// `storeSetting()` writes only the active one, so under `U1Mode == 'b'` the raw `.setZone` read sees
// the untouched factory rows. The loop also read nothing but `.world`, so a row the user had
// unticked ("Active?" → `on: false`) still fired, and `through` / `times` were ignored.
//
// The harm is a hard stall: `shouldDoMaps` feeds map selection, `game.global.world` cannot advance
// while AT is in maps, so the flag is re-derived true every tick at the spurious zone.
//
// The oracle for every assertion here is the game's own driver, `checkMapAtZoneWorld`
// (main.js:13393-13423) — read it, not the finding's summary of it.

const G = globalThis as any
let maps: typeof import('../src/modules/maps')

beforeAll(async () => {
  G.MODULES = { maps: {} }
  G.autoTrimpSettings = {}
  G.getPlayerCritChance = () => 0
  document.body.insertAdjacentHTML('beforeend',
    `<div id="portalBtn" style="display:none"></div><input id="mapLevelInput">` +
    // updateAutoMapsStatus is a MODULE-internal call, so a globalThis stub cannot intercept it.
    `<div id="autoMapStatus"></div><div id="hiderStatus"></div>` +
    `<input id="sizeAdvMapsRange"><input id="lootAdvMapsRange"><input id="difficultyAdvMapsRange">` +
    `<select id="biomeAdvMapsSelect"><option>Random</option></select>` +
    `<select id="advSpecialSelect"><option>0</option></select>` +
    `<select id="advExtraLevelSelect"><option>0</option></select><span id="advPerfectCheckbox"></span>`)
  maps = await import('../src/modules/maps')
})

type Row = Record<string, any>
let mapsClickedCalls: number

/** A MaZ option object with the game's own accessors — config.js:1427/1435, transcribed. */
function maz(over: { U1Mode?: 'a' | 'b'; setZone?: Row[]; setZoneB?: Row[] } = {}) {
  return {
    enabled: 1,
    U1Mode: over.U1Mode ?? 'a',
    U2Mode: 'a',
    setZone: over.setZone ?? [{ world: 200 }],   // factory default: NO on / through / times fields
    setZoneB: over.setZoneB ?? [{ world: 200 }],
    setZoneU2: [{ world: 10 }],
    setZoneU2B: [{ world: 10 }],
    getMaxSettings(this: any) {
      if (G.game.global.universe == 1) return 6
      return 7
    },
    getSetZone(this: any) {
      if (G.game.global.universe == 2) return this.U2Mode == 'a' ? this.setZoneU2 : this.setZoneU2B
      return this.U1Mode == 'a' ? this.setZone : this.setZoneB
    },
  }
}

/**
 * Arms autoMap() at `world` with MaZ the ONLY live reason to enter maps, so `shouldDoMaps` is a
 * clean differential. Every other reason is quenched at its source, not assumed:
 *   - DisableFarm -1        → the else-arm sets shouldFarm = false outright
 *   - MaxMapBonuslimit -1   → `mapBonus (0) >= limit` forces shouldDoMaps = false before the MaZ block
 *   - MaxMapBonusAfterZone -1 → doMaxMapBonus false
 *   - Prestige Off          → needPrestige false (maps.ts:393), so the line-690 OR-list is MaZ-only
 *   - isActiveSpireAT/disActiveSpireAT false → preSpireFarming + spireMapBonusFarming false, and
 *     vanillaMapatZone's own two spire terms hold
 *   - SkipSpires false      → the line-682 arm cannot clear shouldDoMaps afterwards
 * mapsActive + preMapsActive are both false, so the terminus at maps.ts:753-757 is `mapsClicked()`:
 * AT switching the game into map mode. That is the behaviour, not the flag.
 */
function arm(world: number, mazOption: ReturnType<typeof maz>) {
  mapsClickedCalls = 0
  const INERT_VALUE = ['maxExpZone', 'wondersAmount', 'finishExpOnBw', 'DisableFarm', 'ForcePresZ',
    'MapDamageCutoff', 'MaxMapBonusAfterZone', 'MaxMapBonushealth', 'MaxMapBonuslimit',
    'MinutestoFarmBeforeSpire', 'VoidMaps', 'DailyVoidMod', 'WindStackingMin', 'dWindStackingMin',
    'windcutoffmap', 'dwindcutoffmap', 'mapc2hd', 'voidscell', 'dvoidscell', 'RunNewVoidsUntilNew',
    'dRunNewVoidsUntilNew', 'PrestigeSkip1_2', 'PowerSaving', 'AutoStance', 'AutoMaps']
  const INERT_BOOL = ['AdvMapSpecialModifier', 'DynamicSiphonology', 'FarmWhenNomStacks7',
    'LowerFarmingZone', 'MaxStacksForSpire', 'SkipSpires', 'use3daily', 'novmsc2',
    'onlystackedvoids', 'runnewvoidspoison', 'drunnewvoidspoison', 'farmWonders']
  G.autoTrimpSettings = {}
  for (const id of INERT_VALUE) G.autoTrimpSettings[id] = { type: 'value', value: '-1' }
  for (const id of INERT_BOOL) G.autoTrimpSettings[id] = { type: 'boolean', enabled: false }
  G.autoTrimpSettings.AutoMaps = { type: 'value', value: '1' }
  G.autoTrimpSettings.Prestige = { type: 'dropdown', selected: 'Off' }
  G.autoTrimpSettings.mapselection = { type: 'dropdown', selected: 'Random' }
  G.game = {
    global: {
      world, universe: 1, mapsUnlocked: true, canMapAtZone: true, challengeActive: '',
      mapsActive: false, preMapsActive: false, totalPortals: 1, time: 1e7,
      // One owned map at siphon level (world - Siphonology 0). Load-bearing: with an EMPTY array
      // maps.ts:611 sets `selectedMap = "create"` unconditionally, which makes maps.ts:756 fire
      // mapsClicked() for every tick regardless of shouldDoMaps — the terminus would then be
      // constant-true and prove nothing.
      mapsOwnedArray: [{ level: world, noRecycle: false, id: 'map1', location: 'Plentiful', name: 'A' }],
      repeatMap: false, switchToMaps: false, lastClearedCell: 50, lastClearedMapCell: 0,
      mapBonus: 0, gridArray: [{}], mapGridArray: [{}], brokenPlanet: true, currentMapId: '',
      decayDone: false, runningChallengeSquared: false, selectedMapPreset: 1, spireActive: false,
      totalVoidMaps: 0, zoneStarted: 0,
    },
    challenges: { Experience: { nextWonder: 1e9, wonders: 0 }, Mapology: { credits: 99 } },
    stats: { heliumHour: { value: () => 0 } },
    portal: new Proxy({} as any, { get: () => ({ level: 0, radLevel: 0, modifier: 0 }) }),
    jobs: new Proxy({} as any, { get: () => ({ owned: 0, locked: true, modifier: 0 }) }),
    buildings: new Proxy({} as any, { get: () => ({ owned: 0, purchased: 0, locked: true }) }),
    unlocks: { impCount: new Proxy({} as any, { get: () => 0 }) },
    resources: { helium: { owned: 0 }, fragments: { owned: 1e30 } },
    options: { menu: {
      mapLoot: { enabled: 1 }, repeatUntil: { enabled: 0 }, exitTo: { enabled: 0 },
      repeatVoids: { enabled: 0 }, mapAtZone: mazOption,
    } },
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
  // autoMap's remaining free-identifier calls. Damage/health are set so `enoughDamage` and
  // `enoughHealth` are both TRUE — neither can be a second source of shouldDoMaps.
  G.calcOurDmg = () => 1e9
  G.calcEnemyHealth = () => 1
  G.calcBadGuyDmg = () => 1
  G.calcOurHealth = () => 1e9
  G.calcOurBlock = () => 1e9
  G.calcHDratio = () => 1
  G.calcSpire = () => 0
  G.challengeActive = (c: string) => G.game.global.challengeActive === c
  G.getEmpowerment = () => ''
  G.getEnemyMaxAttack = () => 1
  G.getEnemyMaxHealth = () => 1
  G.getCorruptScale = () => 1
  G.getCurrentMapObject = () => ({ level: world, location: 'Plentiful' })
  G.getExtraMapLevels = () => 0
  G.getMapIndex = () => 0
  G.getMapPreset = () => ({ perfect: false, loot: 9, difficulty: 9, size: 9 })
  G.getPierceAmt = () => 0
  G.getTime = () => 0
  G.isActiveSpireAT = () => false
  G.disActiveSpireAT = () => false
  G.highDamageShield = () => {}
  G.countMapItems = () => 0
  G.addSpecials = () => {}
  G.adjustMap = () => {}
  G.areWeAttackLevelCapped = () => false
  G.debug = () => {}
  G.buyMap = () => 1
  G.mapsSwitch = () => {}
  G.recycleBelow = () => {}
  G.recycleMap = () => {}
  G.repeatClicked = () => {}
  G.selectAdvMapsPreset = () => {}
  G.selectMap = () => {}
  G.runMap = () => {}
  G.swapNiceCheckbox = () => {}
  G.toggleSetting = () => {}
  G.updateAutoMapsStatus = () => {}
  G.updateMapCost = () => 0
  G.mapsClicked = () => { mapsClickedCalls++ }
}

/** true iff MaZ made AT decide to run maps at `world` — flag AND the mapsClicked() terminus. */
function mapsAt(world: number, mazOption: ReturnType<typeof maz>) {
  arm(world, mazOption)
  maps.autoMap()
  // The two must never disagree: shouldDoMaps is the only thing that can make selectedMap != "world"
  // in this fixture (maps.ts:690), and that is what maps.ts:753-757 acts on.
  expect(mapsClickedCalls > 0, `mapsClicked disagreed with shouldDoMaps at z${world}`).toBe(!!G.shouldDoMaps)
  return !!G.shouldDoMaps
}

beforeEach(() => { G.shouldDoMaps = undefined })

describe('#221 — autoMap MaZ honours the ACTIVE preset (config.js:1435 getSetZone)', () => {
  it('ANTI-FALSE-GREEN: with MaZ off, nothing else in this fixture enters maps', () => {
    // Without this row every assertion below could be measuring some other shouldDoMaps reason.
    const off = maz({ setZone: [{ world: 250 }] })
    off.enabled = 0
    expect(mapsAt(250, off)).toBe(false)
    expect(G.vanillaMapatZone).toBeFalsy()
  })

  it('preset A: fires at the configured zone and nowhere else (control — passed before the fix too)', () => {
    expect(mapsAt(250, maz({ setZone: [{ world: 250 }] }))).toBe(true)
    expect(mapsAt(249, maz({ setZone: [{ world: 250 }] }))).toBe(false)
    expect(mapsAt(251, maz({ setZone: [{ world: 250 }] }))).toBe(false)
  })

  it('preset B: follows setZoneB, not the stale setZone', () => {
    // Was: parked forever at the factory 200 while the game drove off setZoneB and wanted 250.
    const b = () => maz({ U1Mode: 'b', setZone: [{ world: 200 }], setZoneB: [{ world: 250 }] })
    expect(mapsAt(200, b())).toBe(false)
    expect(mapsAt(250, b())).toBe(true)
  })

  it('a row with on:false is skipped, exactly as main.js:13413 skips it', () => {
    const rows = () => maz({ setZone: [{ world: 180, on: false }, { world: 230, on: true }] })
    expect(mapsAt(180, rows())).toBe(false)
    expect(mapsAt(230, rows())).toBe(true)
  })

  it('NEAR-MISS GUARD: a row with NO `on` field is honoured — the game tests `on !== false`', () => {
    // `if (!row.on) continue` looks like the same fix and is wrong: the factory default row is
    // literally `{world: 200}` with no `on` at all, and getSetZone hands it back untouched until the
    // user opens the MaZ dialog once (save() at config.js:1605 is what first stamps the field).
    // Under that spelling MaZ would silently do nothing for every player who never edited a row.
    expect(mapsAt(200, maz())).toBe(true)                                   // factory default, both presets
    expect(mapsAt(230, maz({ setZone: [{ world: 230, through: 1000 }] }))).toBe(true)
  })

  it('`through` bounds the row: a row already passed does not fire (main.js:13405)', () => {
    expect(mapsAt(300, maz({ setZone: [{ world: 300, through: 200 }] }))).toBe(false)
    expect(mapsAt(300, maz({ setZone: [{ world: 300, through: 400 }] }))).toBe(true)
    // BOUNDARY: the game's operator is `through < world`, so through == world still fires. `<=`
    // reads just as plausibly and would silently kill every single-zone row the dialog writes.
    expect(mapsAt(300, maz({ setZone: [{ world: 300, through: 300 }] }))).toBe(true)
  })

  it('`times` repeats the row every N zones (main.js:13407-13409)', () => {
    const every10 = () => maz({ setZone: [{ world: 250, times: 10, through: 1000 }] })
    for (const z of [250, 260, 400]) expect(mapsAt(z, every10()), `z${z}`).toBe(true)
    for (const z of [255, 259, 261]) expect(mapsAt(z, every10()), `z${z}`).toBe(false)
    // BOUNDARY: the repeat arm is gated on `world > row.world`. Without that guard `%` is happy to
    // match BACKWARDS ((240-250) % 10 === -0), so a repeat row would fire ten zones before the user
    // asked for anything at all.
    expect(mapsAt(240, every10())).toBe(false)
    // times === -1 (the dialog's "no repeat") is the exact-zone-only case.
    const once = () => maz({ setZone: [{ world: 250, times: -1, through: 1000 }] })
    expect(mapsAt(250, once())).toBe(true)
    expect(mapsAt(260, once())).toBe(false)
  })

  it('`times === -2` repeats on the row\'s own `tx` interval (main.js:13410-13412)', () => {
    const tx7 = () => maz({ setZone: [{ world: 250, times: -2, tx: 7, through: 1000 }] })
    expect(mapsAt(257, tx7())).toBe(true)
    expect(mapsAt(258, tx7())).toBe(false)
  })

  it('the row list is bounded by getMaxSettings(), as the game bounds it (main.js:13403)', () => {
    const rows: Row[] = []
    for (let i = 0; i < 8; i++) rows.push({ world: 300 + i })
    // U1 cap is 6, so rows 6 and 7 (z306 / z307) are past the end for the game too.
    expect(mapsAt(305, maz({ setZone: rows }))).toBe(true)
    expect(mapsAt(306, maz({ setZone: rows }))).toBe(false)
  })
})
