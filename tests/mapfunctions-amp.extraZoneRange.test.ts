// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #227 — an out-of-range extra-zone target does not fail, it COLLAPSES.
//
// `RAMPplusMapToRun` returns `PR: Raid - world - number` unbounded, and `RAMPplusPres` writes it
// straight into `#advExtraLevelSelect`. The game builds that select with EXACTLY the options 0..10
// (setAdvExtraZoneText, main.js:6236-6248). Setting a `<select>`'s `.value` to a string no `<option>`
// carries deselects the element — `.value` reads back `""`, `selectedIndex` is `-1` — so
// `getExtraMapLevels()` hits `if (!value) return 0` (main.js:6312) and `createMap` adds nothing
// (main.js:5994). AT gets a map at the CURRENT world zone.
//
// And it looks like success from every angle: `updateMapCost` reads the same coerced select, so it
// omits the `10 * extraLevels` surcharge and quotes the collapsed map's price (~9e5× too cheap at
// 95/105), the affordability check therefore always passes, the buy always "succeeds", the
// `Failed to Prestige Raid` bail never fires, and with `PR: Recycle` on the wrong maps are recycled
// away. PR: Zone 95 / PR: Raid 115 → five maps intended for 111-115, five level-95 maps created.
//
// The DOM coercion is reproduced here against a select built exactly as the game builds it, rather
// than asserted from the spec — a fixture that models the select as accepting anything would encode
// the wrong model and could not catch this (the #150 lesson).

let amp: typeof import('../src/modules/mapfunctions-amp')

const g = globalThis as any
const WORLD = 95

/** setAdvExtraZoneText, main.js:6236-6248 — `for (var x = 0; x <= 10; x++)`. Exactly 0..10. */
function buildExtraSelect() {
  const options = Array.from(
    { length: 11 },
    (_, x) => `<option id="advExtra${x}" value="${x}">+${x} (Zone ${WORLD + x})</option>`,
  ).join('')
  return `<select id="advExtraLevelSelect">${options}</select>`
}

/** main.js:6310-6317, verbatim. */
const getExtraMapLevels = () => {
  if (parseInt((document.getElementById('mapLevelInput') as HTMLInputElement).value, 10) !== WORLD) return 0
  const value = (document.getElementById('advExtraLevelSelect') as HTMLSelectElement).value
  if (!value) return 0
  return parseInt(value, 10)
}

const setMV = (id: string, value: unknown) => {
  g.autoTrimpSettings[id] = { type: 'multiValue', value }
}

function configure(raidTarget: number) {
  setMV('RAMPraidzone', [WORLD])
  setMV('RAMPraidraid', [raidTarget])
  setMV('RAMPraidcell', [-1])
}

beforeAll(async () => {
  g.MODULES = {}
  g.autoTrimpSettings = {}
  g.getPlayerCritChance = () => 0
  amp = await import('../src/modules/mapfunctions-amp')
})

beforeEach(() => {
  document.body.innerHTML = `
    <select id="biomeAdvMapsSelect"><option value="Random"></option><option value="Plentiful"></option></select>
    ${buildExtraSelect()}
    <select id="advSpecialSelect"><option value="0"></option><option value="p"></option><option value="fa"></option></select>
    <input id="lootAdvMapsRange" value="0"><input id="difficultyAdvMapsRange" value="9">
    <input id="sizeAdvMapsRange" value="9"><input id="mapLevelInput" value="${WORLD}">
    <div id="log"></div>`
  g.autoTrimpSettings = {}
  g.game = { global: { world: WORLD, universe: 2 }, resources: { fragments: { owned: Infinity } } }
  g.updateMapCost = () => 1
  g.Rgetequips = () => 5 // prestiges outstanding, so the ONLY thing gating a slot is reachability
  g.enableDebug = false
  g.ATmessageLogTabVisible = false
  g.lastmessagecount = 0
  g.trimMessages = () => {}
  g.getCurrentTime = () => ''
  g.updatePortalTimer = () => ''
  g.game.options = { menu: { timestamps: { enabled: 0 } } }
})

describe('the DOM really does coerce an out-of-range extra-zone value (premise check)', () => {
  it.each(['11', '15', '-1', '-2', 'NaN'])('select.value = %s deselects and reads back as 0 extras', (v) => {
    const sel = document.getElementById('advExtraLevelSelect') as HTMLSelectElement
    sel.value = v
    expect(sel.value).toBe('')
    expect(sel.selectedIndex).toBe(-1)
    expect(getExtraMapLevels()).toBe(0) // → createMap adds nothing → a map at the current world zone
  })

  it.each(['0', '6', '10'])('select.value = %s round-trips', (v) => {
    const sel = document.getElementById('advExtraLevelSelect') as HTMLSelectElement
    sel.value = v
    expect(sel.value).toBe(v)
    expect(getExtraMapLevels()).toBe(Number(v))
  })
})

describe('RAMP skips the raid slots the game cannot build (#227)', () => {
  it('runs all five when the gap is the documented 10', () => {
    configure(WORLD + 10) // the RAMPraid tooltip's own worked example
    const extras = [0, 1, 2, 3, 4].map((n) => amp.RAMPplusMapToRun(false, n))
    expect(extras).toEqual([10, 9, 8, 7, 6])
    expect([0, 1, 2, 3, 4].map((n) => amp.RAMPshouldrunmap(false, n))).toEqual([true, true, true, true, true])
  })

  it('skips only the unbuildable top slot when the gap is 11', () => {
    // The hardest variant to notice by eye: four maps are correct and one silently collapses.
    configure(WORLD + 11)
    expect([0, 1, 2, 3, 4].map((n) => amp.RAMPextraReachable(false, n))).toEqual([false, true, true, true, true])
    expect([0, 1, 2, 3, 4].map((n) => amp.RAMPshouldrunmap(false, n))).toEqual([false, true, true, true, true])
  })

  it('skips every slot when the gap is 20 — instead of buying five current-zone maps', () => {
    configure(WORLD + 20)
    expect([0, 1, 2, 3, 4].map((n) => amp.RAMPplusMapToRun(false, n))).toEqual([20, 19, 18, 17, 16])
    expect([0, 1, 2, 3, 4].map((n) => amp.RAMPshouldrunmap(false, n))).toEqual([false, false, false, false, false])
  })

  it('skips the NEGATIVE bottom slots when the gap is under 4', () => {
    // Gap 3 gives extras [3,2,1,0,-1]; before the fix the last one collapsed to +0 and duplicated the
    // slot above it, so AT bought the same map twice and called it two raid levels.
    configure(WORLD + 3)
    expect([0, 1, 2, 3, 4].map((n) => amp.RAMPplusMapToRun(false, n))).toEqual([3, 2, 1, 0, -1])
    expect([0, 1, 2, 3, 4].map((n) => amp.RAMPshouldrunmap(false, n))).toEqual([true, true, true, true, false])
  })

  it('skips a slot whose target is not a usable number at all', () => {
    // `RAMPraidraid` shorter than `RAMPraidzone` makes `raidzone[praidindex]` undefined, so the
    // subtraction is NaN — which the select coerces to "" exactly like an out-of-range integer.
    setMV('RAMPraidzone', [WORLD])
    setMV('RAMPraidraid', [])
    expect(Number.isNaN(amp.RAMPplusMapToRun(false, 0))).toBe(true)
    expect(amp.RAMPshouldrunmap(false, 0)).toBe(false)
  })

  it('tells the user WHY, once, naming the range that would work', () => {
    // A zone no other test in this file uses: the warning latch is keyed by zone (so it re-arms when
    // the run reaches the NEXT praid zone), and sharing a zone here would make this test's result
    // depend on file order.
    const ZONE = 200
    g.game.global.world = ZONE
    setMV('RAMPraidzone', [ZONE])
    setMV('RAMPraidraid', [ZONE + 20])
    setMV('RAMPraidcell', [-1])
    const log = document.getElementById('log') as HTMLElement
    ;(g.autoTrimpSettings as any).SpamMaps = { type: 'boolean', enabled: true }
    amp.RAMPshouldrunmap(false, 0)
    const text = log.innerHTML
    expect(text).toContain('+0 to +10')
    expect(text).toContain(String(ZONE + 10)) // the top of the range that would actually work

    // Once per zone, not once per slot per tick — RAMPshouldrunmap runs at 10Hz across five slots.
    const after = log.innerHTML
    for (const n of [0, 1, 2, 3, 4]) amp.RAMPshouldrunmap(false, n)
    expect(log.innerHTML).toBe(after)
  })

  it('drops unbuildable slots from the fragment-farming cost estimate too', () => {
    // RAMPfrag sums what the five slots would cost to decide whether to farm first. Counting a slot
    // AT will never buy makes it farm for fragments it does not need.
    g.autoTrimpSettings['RAMPraidfrag'] = { type: 'multitoggle', value: 2 }
    configure(WORLD + 20)
    g.game.resources.fragments.owned = 0
    // Every slot is unbuildable, so the estimated cost is 0 and 0 >= 0 — nothing to farm for.
    expect(amp.RAMPfrag(false)).toBe(true)
  })
})
