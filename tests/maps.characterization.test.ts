// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// Phase-2 characterization net for maps.ts (proof-net #51) — the auto-map decision engine
// (U1 autoMap + U2 RautoMap, the two ~700-line actuators) plus the two status selectors and the
// map-special-modifier DOM controller.
//
// Archetypes per the design spec (§4):
//   L1a pure-predicate golden masters — updateAutoMapsStatus / RupdateAutoMapsStatus (called with
//     get=true so they RETURN [status, he%/rn%, lifetime%] instead of writing the DOM). The status
//     string is the branch-covered decision output.
//   L1b actuator spy-logs — autoMap / RautoMap / testMapSpecialModController. Their return is
//     meaningless; the CONTRACT is the ordered native-mutator call log (runMap / selectMap /
//     recycleMap / mapsClicked / buyMap / recycleBelow / adjustMap / toggleSetting / repeatClicked /
//     selectAdvMapsPreset / setPageSetting) captured across branch-arming fixtures.
//
// Every ==/!= the idiomatic pass rewrites to ===/!== is driven to a LIVE evaluation by some fixture
// here so a mistranscription fails loudly (the proof-net hard gate). getPageSetting/setPageSetting/
// debug are REAL imports inside maps.ts (they read/write the global autoTrimpSettings — seeding it,
// never mocking, is the jobs/upgrades/buildings precedent); every other collaborator is stubbed on
// globalThis.

let maps: typeof import('../src/modules/maps')

// ── shared native-mutator spies ─────────────────────────────────────────────────────────────────
let calls: { fn: string; args: unknown[] }[]
const MUTATORS = [
  'runMap', 'selectMap', 'recycleMap', 'mapsClicked', 'buyMap', 'recycleBelow', 'adjustMap',
  'toggleSetting', 'repeatClicked', 'selectAdvMapsPreset', 'toggleEqualityScale',
] as const
function installMutatorSpies(buyMapReturn: number = 1) {
  calls = []
  for (const fn of MUTATORS) {
    ;(globalThis as any)[fn] = vi.fn((...args: unknown[]) => {
      calls.push({ fn, args })
      if (fn === 'buyMap') return buyMapReturn
    })
  }
}
function names() {
  return calls.map((c) => c.fn)
}

// Benign default stubs for the (large) collaborator surface autoMap/RautoMap read as free globals.
// Individual tests override the ones that arm the branch under test.
function installCollaboratorStubs() {
  const g = globalThis as any
  g.enableDebug = false
  // debug()->message2() logging infra (utils.ts) reads these free globals when a Spam* path fires.
  g.ATmessageLogTabVisible = false
  g.lastmessagecount = 0
  g.trimMessages = () => {}
  g.getCurrentTime = () => ''
  g.updatePortalTimer = () => ''
  g.byId = (id: string) => document.getElementById(id)
  g.challengeActive = (c: string) => g.game.global.challengeActive === c
  g.getCurrentMapObject = () => ({ level: 0, location: 'Plentiful', noRecycle: false, name: 'x' })
  g.getMapIndex = () => 0
  g.isActiveSpireAT = () => false
  g.disActiveSpireAT = () => false
  g.calcHDratio = () => 1
  g.RcalcHDratio = () => 1
  g.calcOurDmg = () => 100
  g.RcalcOurDmg = () => 100
  g.calcOurHealth = () => 1e9
  g.RcalcOurHealth = () => 1e9
  g.calcOurBlock = () => 0
  g.calcBadGuyDmg = () => 1
  g.RcalcBadGuyDmg = () => 1
  g.calcEnemyHealth = () => 1
  g.calcSpire = () => 1
  g.getEnemyMaxAttack = () => 1
  g.RgetEnemyMaxAttack = () => 1
  g.getEnemyMaxHealth = () => 1
  g.getEmpowerment = () => 'Fire'
  g.getPierceAmt = () => 0
  g.getCorruptScale = () => 2
  g.getExtraMapLevels = () => 0
  g.getPlayerCritChance = () => 0
  g.getTotalPortals = () => 0
  g.getSpecialModifierSetting = () => ''
  g.checkPerfectChecked = () => false
  g.highDamageShield = vi.fn()
  g.areWeAttackLevelCapped = () => false
  g.addSpecials = () => 0
  g.canAffordBuilding = () => true
  g.countStackedVoidMaps = () => 0
  g.questcheck = () => 0
  g.updateMapCost = () => 0
  g.estimateEquipsForZone = () => [0, 0, 0]
  g.equipfarmdynamicHD = () => 0
  g.stormdynamicHD = () => 0
  g.desodynamicHD = () => 0
  g.Fluffy = { isRewardActive: () => false }
  g.mutations = { Magma: { active: () => false } }
  g.mapSpecialModifierConfig = {}
  g.trimpAA = 1
  g.offlineProgress = { countMapItems: () => 0 }
  // R-side mapfunctions delegates — spy so we can see them fire but they mutate nothing here.
  for (const fn of [
    'RtimeFarm', 'RsmithyFarm', 'RtributeFarm', 'Rbogs', 'RPraid', 'RAMPreset', 'Rmayhem',
    'Rinsanity', 'Rstorm', 'Rdeso', 'Rship', 'Ralch', 'Rhypo', 'RselectMap', 'RmapRepeat',
    'RAMP', 'dRAMP', 'RfragMap', 'RinsanityMap', 'RalchMap', 'RhypoMap', 'RshipMap',
    'RtimeFarmMap', 'RsmithyFarmMap', 'RtributeFarmMap', 'RquestMap', 'RlevelMap',
  ]) {
    g[fn] = vi.fn()
  }
  g.Rshould = () => ''
  g.autoBattle = { activeContract: '' }
  // mapfunctions praid-prep globals RautoMap reads bare (`RAMPrepMapN != undefined`) — declare undefined.
  for (const n of [1, 2, 3, 4, 5]) { g['RAMPrepMap' + n] = undefined; g['RdAMPrepMap' + n] = undefined }
  // DOM range/select globals the create-map path pokes.
  for (const id of ['sizeAdvMapsRange', 'difficultyAdvMapsRange', 'lootAdvMapsRange', 'biomeAdvMapsSelect']) {
    g[id] = { value: 9 }
  }
}

function mountMapDom() {
  document.body.innerHTML = ''
  const inputs = new Set(['mapLevelInput'])
  const selects = new Set(['advSpecialSelect', 'advExtraMapLevelselect'])
  for (const id of ['autoMapStatus', 'hiderStatus', 'mapLevelInput', 'advSpecialSelect',
    'advExtraMapLevelselect', 'advPerfectCheckbox', 'portalBtn', 'log']) {
    let el: HTMLElement
    if (inputs.has(id)) el = document.createElement('input')
    else if (selects.has(id)) {
      const sel = document.createElement('select')
      for (const v of ['0', 'lmc', 'hc', 'smc', 'lc', 'p', 'fa']) {
        const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o)
      }
      el = sel
    } else el = document.createElement('div')
    el.id = id
    document.body.appendChild(el)
  }
}

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  ;(globalThis as any).autoTrimpSettings = { Prestige: { type: 'dropdown', selected: 'Off' } }
  ;(globalThis as any).getPlayerCritChance = () => 0
  ;(globalThis as any).getPageSetting = undefined // ensure real import wins
  maps = await import('../src/modules/maps')
})

// Reset all module-published decision flags between tests (they live on globalThis, so they leak).
const FLAGS = [
  'doVoids', 'needToVoid', 'needPrestige', 'skippedPrestige', 'scryerStuck', 'shouldDoMaps',
  'preSpireFarming', 'spireMapBonusFarming', 'doMaxMapBonus', 'vanillaMapatZone', 'farmingWonder',
  'shouldFarm', 'enoughHealth', 'enoughDamage', 'lastMapWeWereIn', 'mapTimeEstimate', 'spireTime',
  'contractVoid', 'RneedPrestige', 'RdoVoids', 'RneedToVoid', 'RshouldFarm', 'RenoughHealth',
  'RenoughDamage', 'RshouldDoMaps', 'Rshouldcastle', 'Rshouldshipfarm', 'Rshouldequipfarm',
  'Rshouldstormfarm', 'Rshouldinsanityfarm', 'Rshouldalchfarm', 'Rshouldhypofarm', 'Rshouldmayhem',
  'Rshouldpanda', 'Rshoulddesofarm', 'Rshoulddopraid', 'Rdshoulddopraid', 'Rshoulddoquest',
  'Rshouldtimefarm', 'Rdshouldtimefarm', 'Rshouldsmithyfarm', 'Rshouldtributefarm', 'Rshoulddobogs',
  'RdoMaxMapBonus', 'RvanillaMAZ',
]
beforeEach(() => {
  mountMapDom()
  installCollaboratorStubs()
  installMutatorSpies()
  for (const f of FLAGS) (globalThis as any)[f] = false
})
afterEach(() => {
  vi.restoreAllMocks()
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — updateAutoMapsStatus (U1 status selector)
// ════════════════════════════════════════════════════════════════════════════════════════════════
function statusGame(over: Record<string, any> = {}) {
  return makeMinimalGame({
    global: {
      world: 100, challengeActive: '', mapsActive: false, mapsUnlocked: true,
      totalVoidMaps: 0, totalHeliumEarned: 200, heliumLeftover: 0,
    },
    challenges: { Mapology: { credits: 5 } },
    stats: { heliumHour: { value: () => 50 } },
    resources: { helium: { owned: 100 } },
    ...over,
  })
}

describe('maps.updateAutoMapsStatus — L1a golden master (U1 status selector)', () => {
  it('Off when AutoMaps setting is 0', () => {
    ;(globalThis as any).autoTrimpSettings = { AutoMaps: { type: 'value', value: 0 } }
    ;(globalThis as any).game = statusGame()
    expect(maps.updateAutoMapsStatus(true)![0]).toBe('Off')
  })

  it('Advancing when health+damage are both satisfied', () => {
    ;(globalThis as any).autoTrimpSettings = { AutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = statusGame()
    ;(globalThis as any).enoughHealth = true
    ;(globalThis as any).enoughDamage = true
    const out = maps.updateAutoMapsStatus(true)!
    expect(out[0]).toBe('Advancing')
    expect(Number.isFinite(out[1])).toBe(true)
    expect(Number.isFinite(out[2])).toBe(true)
  })

  it('Prestige Raiding: mapsActive + higher-level non-Void non-Bionic map', () => {
    ;(globalThis as any).autoTrimpSettings = { AutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = statusGame({ global: { world: 100, mapsActive: true, mapsUnlocked: true, challengeActive: '' } })
    ;(globalThis as any).getCurrentMapObject = () => ({ level: 105, location: 'Plentiful' })
    expect(maps.updateAutoMapsStatus(true)![0]).toBe('Prestige Raiding')
  })

  it('BW Raiding: mapsActive + higher-level Bionic map', () => {
    ;(globalThis as any).autoTrimpSettings = { AutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = statusGame({ global: { world: 100, mapsActive: true, mapsUnlocked: true, challengeActive: '' } })
    ;(globalThis as any).getCurrentMapObject = () => ({ level: 105, location: 'Bionic' })
    expect(maps.updateAutoMapsStatus(true)![0]).toBe('BW Raiding')
  })

  it('Prestige when needPrestige and not voiding', () => {
    ;(globalThis as any).autoTrimpSettings = { AutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = statusGame()
    ;(globalThis as any).needPrestige = true
    expect(maps.updateAutoMapsStatus(true)![0]).toBe('Prestige')
  })

  it('Void Maps line when doVoids', () => {
    ;(globalThis as any).autoTrimpSettings = { AutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = statusGame({ global: { world: 100, mapsUnlocked: true, totalVoidMaps: 3, challengeActive: '', totalHeliumEarned: 200, heliumLeftover: 0 } })
    ;(globalThis as any).doVoids = true
    expect(maps.updateAutoMapsStatus(true)![0]).toBe('Void Maps: 3 remaining')
  })

  it('Farming line when shouldFarm', () => {
    ;(globalThis as any).autoTrimpSettings = { AutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = statusGame()
    ;(globalThis as any).shouldFarm = true
    ;(globalThis as any).calcHDratio = () => 2.5
    expect(maps.updateAutoMapsStatus(true)![0]).toBe('Farming: 2.5000x')
  })

  it('appends Prestige Skipped banner when skippedPrestige', () => {
    ;(globalThis as any).autoTrimpSettings = { AutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = statusGame()
    ;(globalThis as any).enoughHealth = true
    ;(globalThis as any).enoughDamage = true
    ;(globalThis as any).skippedPrestige = true
    expect(maps.updateAutoMapsStatus(true)![0]).toContain('Prestige Skipped')
  })

  it('writes the DOM (status + hider) when get is falsy', () => {
    ;(globalThis as any).autoTrimpSettings = { AutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = statusGame()
    ;(globalThis as any).enoughHealth = true
    ;(globalThis as any).enoughDamage = true
    maps.updateAutoMapsStatus()
    expect(document.getElementById('autoMapStatus')!.innerHTML).toBe('Advancing')
    expect(document.getElementById('hiderStatus')!.innerHTML).toContain('He/hr:')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — RupdateAutoMapsStatus (U2 status selector)
// ════════════════════════════════════════════════════════════════════════════════════════════════
function rStatusGame(over: Record<string, any> = {}) {
  return makeMinimalGame({
    global: {
      world: 100, challengeActive: '', mapsUnlocked: true, totalVoidMaps: 0,
      totalRadonEarned: 200, radonLeftover: 0,
    },
    stats: { heliumHour: { value: () => 50 } },
    resources: { radon: { owned: 100 } },
    ...over,
  })
}

describe('maps.RupdateAutoMapsStatus — L1a golden master (U2 status selector)', () => {
  it('Off when RAutoMaps setting is 0', () => {
    ;(globalThis as any).autoTrimpSettings = { RAutoMaps: { type: 'value', value: 0 } }
    ;(globalThis as any).game = rStatusGame()
    expect(maps.RupdateAutoMapsStatus(true)![0]).toBe('Off')
  })

  it('Maps Locked when maps not unlocked', () => {
    ;(globalThis as any).autoTrimpSettings = { RAutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = rStatusGame({ global: { world: 100, mapsUnlocked: false, challengeActive: '', totalVoidMaps: 0, totalRadonEarned: 200, radonLeftover: 0 } })
    expect(maps.RupdateAutoMapsStatus(true)![0]).toBe('Maps Locked')
  })

  it('Advancing when radon health+damage satisfied', () => {
    ;(globalThis as any).autoTrimpSettings = { RAutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = rStatusGame()
    ;(globalThis as any).RenoughHealth = true
    ;(globalThis as any).RenoughDamage = true
    expect(maps.RupdateAutoMapsStatus(true)![0]).toBe('Advancing')
  })

  it('Frozen Castle when Rshouldcastle and no void maps', () => {
    ;(globalThis as any).autoTrimpSettings = { RAutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = rStatusGame()
    ;(globalThis as any).Rshouldcastle = true
    expect(maps.RupdateAutoMapsStatus(true)![0]).toBe('Frozen Castle')
  })

  it('Mayhem Attack vs Mayhem Health keyed on Rshouldmayhem 1/2', () => {
    ;(globalThis as any).autoTrimpSettings = { RAutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = rStatusGame()
    ;(globalThis as any).Rshouldmayhem = 1
    expect(maps.RupdateAutoMapsStatus(true)![0]).toBe('Mayhem Attack')
    ;(globalThis as any).Rshouldmayhem = 2
    expect(maps.RupdateAutoMapsStatus(true)![0]).toBe('Mayhem Health')
  })

  it('Void Maps line when RdoVoids', () => {
    ;(globalThis as any).autoTrimpSettings = { RAutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = rStatusGame({ global: { world: 100, mapsUnlocked: true, totalVoidMaps: 4, challengeActive: '', totalRadonEarned: 200, radonLeftover: 0 } })
    ;(globalThis as any).RdoVoids = true
    expect(maps.RupdateAutoMapsStatus(true)![0]).toBe('Void Maps: 4 remaining')
  })

  it('Prestige when RneedPrestige and not voiding', () => {
    ;(globalThis as any).autoTrimpSettings = { RAutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = rStatusGame()
    ;(globalThis as any).RneedPrestige = true
    expect(maps.RupdateAutoMapsStatus(true)![0]).toBe('Prestige')
  })

  it('Vanilla MAZing when RvanillaMAZ', () => {
    ;(globalThis as any).autoTrimpSettings = { RAutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = rStatusGame()
    ;(globalThis as any).RvanillaMAZ = true
    expect(maps.RupdateAutoMapsStatus(true)![0]).toBe('Vanilla MAZing')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — autoMap (U1 actuator spy-log)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('maps.autoMap — L1b actuator spy-log', () => {
  it('failsafe (maps locked): sets flags, updates status, no mutators', () => {
    ;(globalThis as any).autoTrimpSettings = { AutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 100, mapsUnlocked: false, challengeActive: '', totalHeliumEarned: 200, heliumLeftover: 0, mapsActive: false },
      challenges: { Mapology: { credits: 5 } },
      stats: { heliumHour: { value: () => 0 } },
      resources: { helium: { owned: 100 } },
    })
    maps.autoMap()
    expect((globalThis as any).enoughDamage).toBe(true)
    expect((globalThis as any).enoughHealth).toBe(true)
    expect((globalThis as any).shouldFarm).toBe(false)
    expect(names()).toEqual([]) // no map mutators fired
  })

  it('failsafe (zero damage): early return with flags set', () => {
    ;(globalThis as any).autoTrimpSettings = { AutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).calcOurDmg = () => 0
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 100, mapsUnlocked: true, challengeActive: '', totalHeliumEarned: 200, heliumLeftover: 0, mapsActive: false },
      challenges: { Mapology: { credits: 5 } },
      stats: { heliumHour: { value: () => 0 } },
      resources: { helium: { owned: 100 } },
    })
    maps.autoMap()
    expect((globalThis as any).enoughDamage).toBe(true)
    expect(names()).toEqual([])
  })

  it('failsafe (Mapology out of credits): early return, no mutators', () => {
    ;(globalThis as any).autoTrimpSettings = { AutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 100, mapsUnlocked: true, challengeActive: 'Mapology', totalHeliumEarned: 200, heliumLeftover: 0, mapsActive: false },
      challenges: { Mapology: { credits: 0 } },
      stats: { heliumHour: { value: () => 0 } },
      resources: { helium: { owned: 100 } },
    })
    maps.autoMap()
    expect(names()).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — testMapSpecialModController (DOM select actuator; the most-minified fn)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('maps.testMapSpecialModController — L1b DOM select actuator', () => {
  it('picks a low-map-cost modifier abv into advSpecialSelect and consults updateMapCost', () => {
    ;(globalThis as any).autoTrimpSettings = { AdvMapSpecialModifier: { type: 'boolean', enabled: true } }
    ;(globalThis as any).mapSpecialModifierConfig = {
      lmc: { unlocksAt: 1, abv: 'lmc', name: 'Loot Map Cache' },
    }
    const updateSpy = vi.fn(() => 0)
    ;(globalThis as any).updateMapCost = updateSpy
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 100, highestLevelCleared: 100 },
      resources: { fragments: { owned: 1e9 } },
      options: { menu: { timestamps: { enabled: 0 } } },
    })
    ;(globalThis as any).enoughHealth = false // arms the lmc/hc/smc/lc arm
    expect(() => maps.testMapSpecialModController()).not.toThrow()
    expect(updateSpy).toHaveBeenCalled()
    expect((document.getElementById('advSpecialSelect') as HTMLSelectElement).value).toBe('lmc')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — RautoMap (U2 actuator spy-log)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('maps.RautoMap — L1b actuator spy-log', () => {
  it('vanilla MAZ arm: sets goal, toggles repeatVoids, returns via status', () => {
    ;(globalThis as any).autoTrimpSettings = { RAutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).game = makeMinimalGame({
      global: {
        world: 100, mapsUnlocked: true, challengeActive: '', mapsActive: false, preMapsActive: false,
        totalVoidMaps: 0, totalRadonEarned: 200, radonLeftover: 0, mapBonus: 0, lastClearedCell: 0,
        canMapAtZone: true, universe: 2, spireActive: false, mapCounterGoal: 0, runningChallengeSquared: false,
        repeatMap: false,
      },
      options: { menu: {
        repeatUntil: { enabled: 0 }, exitTo: { enabled: 0 }, repeatVoids: { enabled: 0 },
        mapAtZone: { enabled: 1, getSetZone: () => [{ on: true, world: 100, through: 110, times: 0, cell: 2, until: 6, done: '', rx: 0 }] },
      } },
      stats: { heliumHour: { value: () => 0 } },
      resources: { radon: { owned: 100 }, metal: { owned: 0 } },
      jobs: { Worshipper: { locked: 1 } },
    })
    maps.RautoMap()
    expect((globalThis as any).RvanillaMAZ).toBe(true)
    expect((globalThis as any).game.global.mapCounterGoal).toBe(25)
    expect(names()).toContain('toggleSetting')
  })

  it('failsafe (zero radon damage): sets flags, updates status, no mutators', () => {
    ;(globalThis as any).autoTrimpSettings = { RAutoMaps: { type: 'value', value: 1 } }
    ;(globalThis as any).RcalcOurDmg = () => 0
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 100, mapsUnlocked: false, challengeActive: '', totalRadonEarned: 200, radonLeftover: 0 },
      stats: { heliumHour: { value: () => 0 } },
      resources: { radon: { owned: 100 } },
    })
    maps.RautoMap()
    expect((globalThis as any).RenoughDamage).toBe(true)
    expect((globalThis as any).RenoughHealth).toBe(true)
    expect((globalThis as any).RshouldFarm).toBe(false)
    expect(names()).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — autoMap ACTUATOR CORE: the "Creating Map Section" buy/recycle cascade + tier-slider loop.
// Drives control all the way past the early branches into the preMapsActive `selectedMap=="create"`
// arm so the real ordered mutator log (selectAdvMapsPreset / adjustMap×3 / buyMap / recycleBelow /
// recycleMap) is asserted — and the var-hoist maplvlpicked@769 site executes.
// ════════════════════════════════════════════════════════════════════════════════════════════════
function automapSettings(over: Record<string, any> = {}) {
  return {
    AutoMaps: { type: 'value', value: 1 },
    mapcuntoff: { type: 'value', value: 1 },
    MaxMapBonuslimit: { type: 'value', value: 10 },
    MaxMapBonusAfterZone: { type: 'valueNegative', value: -1 }, // deterministic doMaxMapBonus=false
    Prestige: { type: 'dropdown', selected: 'Off' },
    mapselection: { type: 'dropdown', selected: 'Random' },
    ...over,
  }
}
function automapGame(over: Record<string, any> = {}) {
  const base: Record<string, any> = {
    global: {
      world: 100, mapsUnlocked: true, mapsActive: false, preMapsActive: true,
      challengeActive: '', runningChallengeSquared: false, totalVoidMaps: 0, mapBonus: 0,
      brokenPlanet: false, spireActive: false, selectedMapPreset: 2, decayDone: false,
      repeatMap: false, switchToMaps: false, canMapAtZone: false, lastClearedCell: 50,
      totalHeliumEarned: 200, heliumLeftover: 0, universe: 1, zoneStarted: Date.now(),
      mapsOwnedArray: [
        { level: 50, noRecycle: false, id: 'map1', location: 'Plentiful', name: 'A' },
        { level: 60, noRecycle: false, id: 'map2', location: 'Plentiful', name: 'B' },
      ],
    },
    upgrades: { Dominance: { done: 0 }, Bounty: { allowed: 0, done: 0 }, Shieldblock: { allowed: 0 }, Rage: { done: 0 } },
    talents: { mapLoot: { purchased: false }, bounty: { purchased: false }, portal: { purchased: false } },
    portal: { Siphonology: { level: 0 }, Equality: { scalingActive: false } },
    options: { menu: {
      mapLoot: { enabled: 0 }, repeatUntil: { enabled: 0 }, repeatVoids: { enabled: 0 },
      exitTo: { enabled: 0 }, mapAtZone: { enabled: 0 }, timestamps: { enabled: 0 },
    } },
    resources: {
      fragments: { owned: 1000 }, helium: { owned: 100 },
      trimps: { realMax: () => 1, owned: 0, getCurrentSend: () => 1 },
    },
    stats: { heliumHour: { value: () => 0 } },
    challenges: { Mapology: { credits: 5 }, Experience: { nextWonder: 50, wonders: 0 } },
    mapUnlocks: {}, jobs: { Explorer: { owned: 0 } }, unlocks: { imps: { Flutimp: false } },
  }
  return makeMinimalGame(deepMergeTest(base, over))
}
// small local deep-merge so per-test overrides nest instead of clobbering whole sub-objects
function deepMergeTest(a: any, b: any): any {
  if (typeof a !== 'object' || a === null || Array.isArray(a) || typeof b !== 'object' || b === null || Array.isArray(b)) return b
  const out: any = { ...a }
  for (const k of Object.keys(b)) out[k] = k in a ? deepMergeTest(a[k], b[k]) : b[k]
  return out
}

describe('maps.autoMap — L1b actuator core (create-map buy + recycle cascade)', () => {
  it('preMapsActive + selectedMap=="create": drives selectAdvMapsPreset, adjustMap×3, buyMap/recycle retry', () => {
    ;(globalThis as any).autoTrimpSettings = automapSettings()
    ;(globalThis as any).calcEnemyHealth = () => 1e9 // ourDmg*cutoff (100) < health → enoughDamage FALSE → shouldDoMaps
    installMutatorSpies(-2) // buyMap returns -2 → full recycle-retry cascade
    ;(globalThis as any).game = automapGame()
    maps.autoMap()
    expect(calls.map((c) => [c.fn, ...c.args])).toEqual([
      ['selectAdvMapsPreset', 1],
      ['adjustMap', 'size', 9],
      ['adjustMap', 'difficulty', 9],
      ['adjustMap', 'loot', 9],
      ['buyMap'],
      ['recycleBelow', true],
      ['buyMap'],
      ['recycleMap', '0'], // lowestMap = keysSorted last (level-50 map at index '0')
      ['buyMap'],
    ])
  })

  it('buyMap success (returns 1): buys once, no recycle', () => {
    ;(globalThis as any).autoTrimpSettings = automapSettings()
    ;(globalThis as any).calcEnemyHealth = () => 1e9
    installMutatorSpies(1)
    ;(globalThis as any).game = automapGame()
    maps.autoMap()
    expect(names()).toEqual(['selectAdvMapsPreset', 'adjustMap', 'adjustMap', 'adjustMap', 'buyMap'])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — autoMap VAR-HOIST SITE #1: the preSpireFarming `for (let i=0; i<keysSorted.length; i++)`
// map-scan loop (~635) — a scope regression on the reused `i` would break this. Fixture executes the
// loop (finds a Mountain map at spiremaplvl) → selectMap + runMap on the chosen id.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('maps.autoMap — L1b var-hoist site: preSpireFarming map-scan loop', () => {
  it('executes the spire-farm loop and runs the matched Mountain map', () => {
    ;(globalThis as any).autoTrimpSettings = automapSettings({
      MinutestoFarmBeforeSpire: { type: 'value', value: 60 },
    })
    ;(globalThis as any).isActiveSpireAT = () => true // arms preSpireFarming
    ;(globalThis as any).game = automapGame({
      global: {
        preMapsActive: true, mapsActive: false, zoneStarted: Date.now(),
        mapsOwnedArray: [{ level: 100, noRecycle: false, id: 'spireMap', location: 'Mountain', name: 'S' }],
      },
    })
    maps.autoMap()
    expect((globalThis as any).preSpireFarming).toBe(true)
    expect(names()).toEqual(['selectMap', 'runMap'])
    expect(calls.find((c) => c.fn === 'selectMap')!.args).toEqual(['spireMap'])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — autoMap VAR-HOIST SITE #2: `maplvlpicked` reused across the Experience-Challenge boundary
// (declared @769 in the create branch, RE-declared @838 in the Experience block — the codemod left
// @769 the hoisted var; making it local would break @838). This fixture executes the Experience arm.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('maps.autoMap — L1b var-hoist site: Experience-challenge maplvlpicked reuse', () => {
  it('Experience farm-wonder buy path executes the maplvlpicked@838 site', () => {
    ;(globalThis as any).autoTrimpSettings = automapSettings({
      farmWonders: { type: 'boolean', enabled: true },
      maxExpZone: { type: 'value', value: 100 },
      wondersAmount: { type: 'value', value: 5 },
      finishExpOnBw: { type: 'valueNegative', value: -1 },
    })
    ;(globalThis as any).calcEnemyHealth = () => 1 // enoughDamage TRUE → earlier flow leaves selectedMap "world"
    installMutatorSpies(-2)
    ;(globalThis as any).game = automapGame({
      global: {
        challengeActive: 'Experience', preMapsActive: false, mapsActive: false,
        mapsOwnedArray: [
          { level: 50, noRecycle: false, id: 'm1', location: 'Plentiful', name: 'A' },
          { level: 40, noRecycle: false, id: 'm2', location: 'Plentiful', name: 'B' },
        ],
      },
      challenges: { Experience: { nextWonder: 50, wonders: 0 } },
    })
    maps.autoMap()
    expect((globalThis as any).farmingWonder).toBe(true)
    // Experience !mapsActive buy path: mapsClicked(true) then buyMap/recycle cascade
    expect(calls.map((c) => [c.fn, ...c.args])).toEqual([
      ['mapsClicked', true],
      ['buyMap'],
      ['recycleBelow', true],
      ['buyMap'],
      ['recycleMap', '1'], // lowestMap = level-40 map at index '1'
      ['buyMap'],
    ])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — RautoMap ACTUATOR CORE: the create/buy section (~1447-1598). RselectMap (a mapfunctions
// delegate, stubbed) returns "create" to route control into the R create arm; asserts the ordered
// mutator log there (selectAdvMapsPreset / adjustMap×3 / buyMap / recycleBelow / recycleMap).
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('maps.RautoMap — L1b actuator core (create-map buy + recycle cascade)', () => {
  it('RselectMap→"create" drives the R create/buy/recycle cascade', () => {
    ;(globalThis as any).autoTrimpSettings = {
      RAutoMaps: { type: 'value', value: 1 },
      Rmapcuntoff: { type: 'value', value: 1 },
      Rmapselection: { type: 'dropdown', selected: 'Random' },
    }
    ;(globalThis as any).RselectMap = () => 'create'
    installMutatorSpies(-2)
    ;(globalThis as any).game = makeMinimalGame({
      global: {
        world: 100, mapsUnlocked: true, mapsActive: false, preMapsActive: true, challengeActive: '',
        runningChallengeSquared: false, totalVoidMaps: 0, mapBonus: 0, selectedMapPreset: 2,
        lastClearedCell: 50, totalRadonEarned: 200, radonLeftover: 0, canMapAtZone: false,
        repeatMap: false, switchToMaps: false, universe: 2,
        mapsOwnedArray: [
          { level: 50, noRecycle: false, id: 'rm1', location: 'Plentiful', name: 'A' },
          { level: 60, noRecycle: false, id: 'rm2', location: 'Plentiful', name: 'B' },
        ],
      },
      options: { menu: {
        repeatUntil: { enabled: 0 }, exitTo: { enabled: 0 }, repeatVoids: { enabled: 0 },
        mapAtZone: { enabled: 0 }, timestamps: { enabled: 0 },
      } },
      resources: { fragments: { owned: 1000 }, radon: { owned: 100 }, metal: { owned: 0 } },
      stats: { heliumHour: { value: () => 0 } },
      jobs: { Worshipper: { locked: 1 } },
      portal: { Equality: { scalingActive: false } },
    })
    maps.RautoMap()
    expect(calls.map((c) => [c.fn, ...c.args])).toEqual([
      ['selectAdvMapsPreset', 1],
      ['adjustMap', 'size', 9],
      ['adjustMap', 'difficulty', 9],
      ['adjustMap', 'loot', 9],
      ['buyMap'],
      ['recycleBelow', true],
      ['buyMap'],
      ['recycleMap', '0'],
      ['buyMap'],
    ])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — testMapSpecialModController: the highestLevelCleared>=209 branch (~138-148). The other
// mod-controller test uses hLC:100, so the for→while rewrite + the loose `n == game.global.world`
// compare there are otherwise never executed.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('maps.testMapSpecialModController — L1b >=209 extra-map-level branch', () => {
  it('sets advExtraMapLevelselect.selectedIndex via the n==world compare + for→while loop', () => {
    ;(globalThis as any).autoTrimpSettings = { AdvMapSpecialModifier: { type: 'boolean', enabled: false } }
    ;(globalThis as any).mapSpecialModifierConfig = { lmc: { unlocksAt: 1, abv: 'lmc', name: 'Loot Map Cache' } }
    ;(globalThis as any).updateMapCost = () => 0 // decrement while-loop stays put
    ;(globalThis as any).game = makeMinimalGame({
      global: { world: 100, highestLevelCleared: 209 },
      resources: { fragments: { owned: 1e9 } },
      options: { menu: { timestamps: { enabled: 0 } } },
    })
    ;(document.getElementById('mapLevelInput') as HTMLInputElement).value = '100'
    ;(globalThis as any).enoughHealth = false
    expect(() => maps.testMapSpecialModController()).not.toThrow()
    // advSpecialMapMod_numZones = 3; n("100") == world(100) loose-true → selectedIndex 3, kept (cost 0)
    expect((document.getElementById('advExtraMapLevelselect') as HTMLSelectElement).selectedIndex).toBe(3)
  })
})
