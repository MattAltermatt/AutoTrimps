// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #166 — Hardcore P Raiding bought NOTHING at the shipped defaults, and said it could not afford to.
//
// `PraidHarder` walks `curPlusZones` down from its target, asking `relaxMapReqs()` whether a map at
// that many extra zones is affordable, and breaks on the first one that is. It then decided whether to
// buy with:
//
//     if (curPlusZones >= 0 && (praidBeforeFarm || shouldFarmFrags == false))
//
// where `shouldFarmFrags` was set two lines earlier by `if (maxPlusZones > curPlusZones)`. That reads
// as "we would like a better map" — not "we are allowed to go and get one", which is what the buy
// decision actually needs. At the shipped defaults the two come apart completely:
//
//   * `MaxPraidZone` defaults to `[-1]`, so :1220 computes `-1 - world` and :1223 rescues the negative
//     to **10** — the target is always the maximum;
//   * a +10 map costs 1.14^100 ≈ 4.9e5 × a +0 one (main.js:6532/6541), so the affordable rung is
//     essentially always below the target and `shouldFarmFrags` is essentially always true;
//   * `PraidFarmFragsZ` also defaults to `[-1]`, so `farmFragments` is false and no farming is
//     permitted for the zone either.
//
// So AT located an affordable map, declined to buy it, and printed "Looks like you can't afford to" —
// a statement `relaxMapReqs()` had just disproved. An advertised feature that had never worked at
// defaults, and it leaves the run with AutoMaps off on top.
//
// The fix skips the buy only when farming is genuinely going to happen for this zone. The tests below
// pin BOTH directions: the default case must now buy, and every case that already farmed must still
// farm — the failure mode of a repair here is turning the fragment-farming feature off.

let praiding: typeof import('../src/modules/other-praiding')

const g = globalThis as any
let selected: string[] = []
let bought: number[] = []

const WORLD = 495 // (495 + 10) % 10 === 5, so maxPlusZones survives the :1226-1229 adjustment at 10

const setMV = (id: string, value: unknown) => {
  g.autoTrimpSettings[id] = { type: 'multiValue', value }
}

/**
 * Cost as a pure function of the extra-zones select, which is the only lever this test cares about.
 * The real curve is `1.14^(baseCost)` with `baseCost += 10 * extraLevels` (main.js:6532/6541) — the
 * point being that each extra zone is a large multiple, so `AFFORDABLE_EXTRA` below is a cliff, not
 * a gentle slope. relaxMapReqs()'s difficulty/size sweeps cannot rescue a rung that is 10× out.
 */
const AFFORDABLE_EXTRA = 6
function installCost() {
  g.updateMapCost = (getValue?: boolean) => {
    if (!getValue) return undefined
    const extra = parseInt((document.getElementById('advExtraLevelSelect') as HTMLInputElement).value, 10)
    return Math.pow(10, isNaN(extra) ? 0 : extra)
  }
  g.game.resources.fragments.owned = Math.pow(10, AFFORDABLE_EXTRA)
}

beforeAll(async () => {
  g.MODULES = {}
  g.autoTrimpSettings = {}
  g.getPlayerCritChance = () => 0
  praiding = await import('../src/modules/other-praiding')
})

beforeEach(() => {
  const opts = Array.from({ length: 11 }, (_, x) => `<option value="${x}">${x}</option>`).join('')
  document.body.innerHTML = `
    <select id="biomeAdvMapsSelect"><option value="Random"></option><option value="Depths"></option></select>
    <select id="advExtraLevelSelect">${opts}</select>
    <select id="advSpecialSelect"><option value="0"></option><option value="p"></option><option value="fa"></option></select>
    <input id="lootAdvMapsRange" value="0"><input id="difficultyAdvMapsRange" value="9">
    <input id="sizeAdvMapsRange" value="9">
    <span id="advPerfectCheckbox" class="niceCheckbox" data-checked="false"></span>
    <input id="mapLevelInput" value="${WORLD}"><div id="log"></div>`

  g.autoTrimpSettings = { AutoMaps: { type: 'multitoggle', value: 1 } }
  g.game = {
    global: {
      world: WORLD,
      lastClearedCell: 98,
      challengeActive: '',
      preMapsActive: true,
      mapsActive: false,
      repeatMap: false,
      mapsOwnedArray: [{ id: 'old1', level: 1, location: 'Plentiful', noRecycle: false }],
    },
    resources: { fragments: { owned: 0 } },
    options: { menu: { repeatUntil: { enabled: 0 }, timestamps: { enabled: 0 } } },
  }
  selected = []
  bought = []
  g.buyMap = () => {
    bought.push(parseInt((document.getElementById('advExtraLevelSelect') as HTMLInputElement).value, 10))
    g.game.global.mapsOwnedArray.push({ id: `new${bought.length}`, level: WORLD, location: 'Depths' })
    return 1
  }
  g.selectMap = (id: string) => selected.push(id)
  g.runMap = () => {}
  g.mapsClicked = () => {}
  g.repeatClicked = () => {}
  g.recycleMap = () => {}
  g.getMapIndex = (id: string) => id
  g.toggleSetting = () => {}
  g.swapNiceCheckbox = () => {}
  g.enableDebug = false
  g.ATmessageLogTabVisible = false
  g.lastmessagecount = 0
  g.trimMessages = () => {}
  g.getCurrentTime = () => ''
  g.updatePortalTimer = () => ''
  installCost()

  g.prestraid = false
  g.failpraid = false
  g.prestraidon = false
  g.praidDone = false
  g.shouldFarmFrags = false
  g.pMap = null
  g.fMap = null
  g.minMaxMapCost = null

  // The SHIPPED defaults, quoted from settings-defs.ts:1668/1673/1678.
  setMV('Praidingzone', [WORLD])
  setMV('MaxPraidZone', [-1])
  setMV('PraidFarmFragsZ', [-1])
  setMV('PraidBeforeFarmZ', [-1])
  setMV('Praidingcell', [-1])
})

describe('PraidHarder buys the map it just proved it could afford (#166)', () => {
  it('at the SHIPPED defaults, buys the best affordable map instead of reporting failure', () => {
    praiding.PraidHarder()

    // FAILED BEFORE THE FIX on every line: `maxPlusZones` is 10, `shouldFarmFrags` is therefore true,
    // and the buy arm was skipped — AT printed "Looks like you can't afford to" and bought nothing.
    expect(bought).toEqual([AFFORDABLE_EXTRA])
    expect(selected).toEqual(['new1'])
    expect(g.failpraid).toBe(false)
    expect(g.prestraid).toBe(true) // the raid is under way, not abandoned
  })

  it('still fails honestly when NOTHING is affordable', () => {
    g.game.resources.fragments.owned = 0 // not even a +0 map (cost 1)
    praiding.PraidHarder()

    expect(bought).toEqual([])
    expect(g.failpraid).toBe(true)
    expect(g.prestraid).toBe(false)
  })

  it('buys the exact target when the target IS affordable (no regression at the top rung)', () => {
    setMV('MaxPraidZone', [WORLD + 6]) // target = +6, which is exactly affordable
    praiding.PraidHarder()
    expect(bought).toEqual([6])
    expect(g.shouldFarmFrags).toBe(false)
  })
})

describe('...but must not buy when fragment farming for this zone is permitted', () => {
  it('defers the buy and hands AutoMaps back when the zone is in PraidFarmFragsZ', () => {
    // The behaviour the fix must NOT break: farming is the whole point of Hardcore P Raiding, and a
    // repair that simply always bought would delete it.
    setMV('PraidFarmFragsZ', [WORLD])
    praiding.PraidHarder()

    expect(bought).toEqual([])
    expect(g.shouldFarmFrags).toBe(true)
    expect(g.autoTrimpSettings.AutoMaps.value).toBe(1) // handed back so farming can run
    expect(g.failpraid).toBe(false) // NOT a failure — a deferral
  })

  it('buys immediately when farming is permitted but the TARGET is already affordable', () => {
    // There is nothing to farm FOR once the target rung is affordable, so a repair that keys only on
    // "farming is permitted here" defers a raid it should simply complete. That mutant survives every
    // other test in this file, because they all leave `PraidFarmFragsZ` at its default.
    setMV('PraidFarmFragsZ', [WORLD])
    setMV('MaxPraidZone', [WORLD + AFFORDABLE_EXTRA])
    praiding.PraidHarder()

    expect(g.shouldFarmFrags).toBe(false) // target met — no shortfall to farm for
    expect(bought).toEqual([AFFORDABLE_EXTRA])
    expect(selected).toEqual(['new1'])
  })

  it('buys first when the zone is ALSO in PraidBeforeFarmZ', () => {
    setMV('PraidFarmFragsZ', [WORLD])
    setMV('PraidBeforeFarmZ', [WORLD])
    praiding.PraidHarder()
    expect(bought).toEqual([AFFORDABLE_EXTRA])
    expect(selected).toEqual(['new1'])
  })

  it('farms rather than failing when farming is permitted and nothing is affordable', () => {
    setMV('PraidFarmFragsZ', [WORLD])
    g.game.resources.fragments.owned = 0
    praiding.PraidHarder()
    expect(bought).toEqual([])
    expect(g.failpraid).toBe(false)
  })
})

describe('a refused purchase is not reported as unaffordability (#166 + #177)', () => {
  it('says the game refused, not that the player is broke', () => {
    const messages: string[] = []
    g.trimMessages = () => {}
    const log = document.getElementById('log') as HTMLElement
    g.buyMap = () => -2 // the 100-map cap: affordable, and still refused
    praiding.PraidHarder()
    messages.push(log.innerHTML)

    expect(bought).toEqual([])
    expect(g.failpraid).toBe(true)
    // The old single failure arm claimed "you can't afford to" for BOTH causes. relaxMapReqs() had
    // just proved affordability, so that message sent every reader looking in the wrong place.
    expect(messages.join(' ')).toContain('refused the map purchase')
    expect(messages.join(' ')).not.toContain("can't afford to")
  })
})
