// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #204 — Ship Farming never requested the savory-cache map it exists to farm.
//
// RshipMap's `< 0` level branch skipped RminFragMap, the ONLY thing that writes biomeAdvMapsSelect
// and advSpecialSelect. createMap then assigns no `bonus` at all (the game sets it only when
// getSpecialModifierSetting() != "0"), while RselectShip requires `mapsOwnedArray[map].bonus ==
// special` in all three of its match loops — and `undefined == "ssc"` is false. So no owned map ever
// matched, RselectShip returned "create" every tick, and AT bought a fresh map without running it
// until fragments ran out.
//
// RhypoMap is the correct template: all three of its branches call RminFragMap.

const G = globalThis as any
let mf: typeof import('../src/modules/mapfunctions')

const SELECT_IDS = ['biomeAdvMapsSelect', 'advSpecialSelect', 'advExtraLevelSelect'] as const

beforeAll(async () => {
  G.MODULES = {}
  G.autoTrimpSettings = {}
  G.Decimal = (await import('decimal.js')).default
  G.getPlayerCritChance = () => 0
  document.body.insertAdjacentHTML('beforeend',
    `<div id="trimps"><div class="row"></div></div><div id="trimpsFighting"></div>` +
    `<select id="biomeAdvMapsSelect"><option>Random</option><option>Farmlands</option><option>Plentiful</option></select>` +
    `<select id="advSpecialSelect"><option>0</option><option>ssc</option><option>lsc</option></select>` +
    `<select id="advExtraLevelSelect"><option>0</option><option>1</option><option>2</option></select>` +
    `<input id="mapLevelInput"><input id="lootAdvMapsRange"><input id="difficultyAdvMapsRange">` +
    `<input id="sizeAdvMapsRange"><span id="advPerfectCheckbox"></span>`)
  mf = await import('../src/modules/mapfunctions')
})

function arm(level: number, over: { radon?: number } = {}) {
  const world = 200
  G.autoTrimpSettings = {
    Rshipfarmzone: { type: 'multiValue', value: [String(world)] },
    Rshipfarmlevel: { type: 'multiValue', value: [String(level)] },
    Rshipfarmamount: { type: 'multiValue', value: ['50'] },
    Rshipfarmfrag: { type: 'boolean', enabled: false }, // the OFF default — the regime #204 describes
  }
  G.game = {
    global: {
      world,
      farmlandsUnlocked: true,
      highestRadonLevelCleared: over.radon ?? 50, // <= 83 → "ssc"
      mapsOwnedArray: [],
      preMapsActive: false,
      mapsActive: false,
    },
    resources: { fragments: { owned: 1e30 } }, // affordable, so RminFragMap keeps the 9/9/9 preset
    jobs: { Worshipper: { owned: 0 } },
  }
  G.Rshouldshipfarm = true
  G.byId = (id: string) => document.getElementById(id)
  G.swapNiceCheckbox = () => {}
  G.updateMapCost = () => 0
  G.RfragCheck = () => true
  // A sentinel in every select, so "the branch wrote nothing" is distinguishable from "wrote a value".
  for (const id of SELECT_IDS) (document.getElementById(id) as HTMLSelectElement).value = '0'
  ;(document.getElementById('biomeAdvMapsSelect') as HTMLSelectElement).value = 'Random'
}

const biome = () => (document.getElementById('biomeAdvMapsSelect') as HTMLSelectElement).value
const special = () => (document.getElementById('advSpecialSelect') as HTMLSelectElement).value
const mapLevel = () => (document.getElementById('mapLevelInput') as HTMLInputElement).value

describe('#204 — every SF: Map Level branch sets the savory-cache special', () => {
  beforeEach(() => arm(-1))

  it('THE BUG: a NEGATIVE level still sets biome and special', () => {
    arm(-1)
    mf.RshipMap()
    expect(special()).toBe('ssc')
    expect(biome()).toBe('Farmlands')
  })

  it('...and still points the map one level below world', () => {
    // RminFragMap sets mapLevelInput to world; the branch must overwrite it afterwards, which is the
    // ordering RhypoMap uses. Getting that backwards would silently farm at world level.
    arm(-1)
    mf.RshipMap()
    expect(mapLevel()).toBe('199')
  })

  it('a POSITIVE level sets them too (the case that already worked)', () => {
    arm(2)
    mf.RshipMap()
    expect(special()).toBe('ssc')
    expect(biome()).toBe('Farmlands')
    expect(mapLevel()).toBe('200')
  })

  it('picks the LARGE savory cache past highestRadonLevelCleared 83', () => {
    arm(-1, { radon: 90 })
    mf.RshipMap()
    expect(special()).toBe('lsc')
  })

  it('anti-false-green: nothing is written when Ship Farming is not engaged', () => {
    // Without this, a build that unconditionally wrote the selects would satisfy every row above.
    arm(-1)
    G.Rshouldshipfarm = false
    mf.RshipMap()
    expect(special()).toBe('0')
    expect(biome()).toBe('Random')
  })

  it('anti-false-green: the sentinel really is distinguishable from a real write', () => {
    arm(-1)
    expect(special()).toBe('0')
    expect(biome()).toBe('Random')
  })
})
