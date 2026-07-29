// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'

// #181 — the fast-imp branch's `cell.special.length === 0` guard was commented out with its body left
// behind, so it clobbered the game's own loot icon.
// #192 — the once-per-zone cache was keyed on game.global.world, which cannot see the two U2-Spire
// paths that rebuild the world grid at an unchanged world number.
//
// fight-info.ts is a side-effect IIFE that captures #grid / #mapGrid at module load, so the DOM has to
// exist BEFORE the import. It exposes its worker as MODULES.fightinfo.Update.

const g = () => globalThis as any

/** The game's grid markup: 10 rows of 10 cells, rows rendered in inverse order. */
function buildGridDom() {
  const rows: string[] = []
  for (let r = 0; r < 10; r++) {
    const cells: string[] = []
    for (let c = 0; c < 10; c++) cells.push(`<div id="cell${r * 10 + c}"></div>`)
    rows.push(`<div class="cellRow">${cells.join('')}</div>`)
  }
  // Inverse order, as the game emits them (Update() reverses back).
  document.body.innerHTML =
    `<div id="grid">${rows.reverse().join('')}</div><div id="mapGrid"></div>`
}

/** 100 cells; `over` patches individual indices. */
function makeGridArray(over: Record<number, Partial<{ name: string; special: string; text: string }>> = {}) {
  return Array.from({ length: 100 }, (_, i) => ({
    name: 'Chimp',
    special: '',
    text: '',
    ...over[i],
  }))
}

/** The DOM cell element for gridArray index `i`, resolving the row reversal the same way Update does. */
function cellEl(i: number) {
  const rows = Array.prototype.slice.call(document.getElementById('grid')!.children).reverse()
  const flat: Element[] = []
  rows.forEach((r: Element) => flat.push(...Array.prototype.slice.call(r.children)))
  return flat[i] as HTMLElement
}

let Update: () => void

beforeAll(async () => {
  // The IIFE captures #grid / #mapGrid at load, so the DOM must exist first. It is imported ONCE;
  // beforeEach re-points the captured node and clears the cache, which is exactly what a real grid
  // rebuild does to it.
  buildGridDom()
  g().MODULES = {}
  g().game = { global: { mapsActive: false, world: 60, gridArray: [], mapGridArray: [] } }
  await import('../src/modules/fight-info')
  Update = g().MODULES.fightinfo.Update
})

/** Re-point the module at a freshly built grid, as buildGrid()+drawGrid() would. */
function rebuildGrid() {
  buildGridDom()
  g().MODULES.fightinfo.$worldGrid = document.getElementById('grid')
  g().MODULES.fightinfo.$mapGrid = document.getElementById('mapGrid')
}

beforeEach(() => {
  rebuildGrid()
  g().MODULES.fightinfo.lastProcessedGrid = null
  g().game = { global: { mapsActive: false, world: 60, gridArray: [], mapGridArray: [] } }
})

describe('#181: the fast-imp glyph must not overwrite the game\'s loot icon', () => {
  // The game writes the indicator as MARKUP into cell.text (findHomeForSpecial, main.js:10460-10464)
  // and renders it as the cell's innerHTML in drawGrid (main.js:10552). Overwriting it loses the "there
  // is an upgrade here" cue for the rest of the zone — fight-info never puts it back.
  const LOOT = '<span class="glyphicon glyphicon-plus"></span>'

  it('leaves a fast-imp cell that carries a special alone', () => {
    g().game.global.gridArray = makeGridArray({ 4: { name: 'Snimp', special: 'Shield' } })
    cellEl(4).innerHTML = LOOT
    Update()
    expect(cellEl(4).innerHTML).toBe(LOOT)
  })

  it('still writes the chevron on a fast-imp cell with no special', () => {
    g().game.global.gridArray = makeGridArray({ 7: { name: 'Snimp', special: '' } })
    Update()
    expect(cellEl(7).innerHTML).toContain('glyphicon-forward')
  })

  // The guard is what distinguishes the two; assert the title/shadow still land in BOTH cases, so a
  // near-miss "fix" that moved the whole block inside the guard is caught too.
  it('the title and shadow are applied whether or not the cell carries a special', () => {
    g().game.global.gridArray = makeGridArray({
      4: { name: 'Snimp', special: 'Shield' },
      7: { name: 'Snimp', special: '' },
    })
    cellEl(4).innerHTML = LOOT
    Update()
    expect(cellEl(4).title).toBe('Snimp')
    expect(cellEl(4).style.textShadow).not.toBe('')
    expect(cellEl(7).title).toBe('Snimp')
    expect(cellEl(7).style.textShadow).not.toBe('')
  })

  // The other six glyph sites already guard; pin one so a future edit cannot un-guard the whole file.
  it('the sibling branches guard the same way', () => {
    g().game.global.gridArray = makeGridArray({
      3: { name: 'Improbability', special: 'Shield' }, // powerful
      5: { name: 'Feyimp', special: 'Shield' },        // exotic
      9: { name: 'Skeletimp', special: 'Shield' },     // skele
    })
    for (const i of [3, 5, 9]) cellEl(i).innerHTML = LOOT
    Update()
    for (const i of [3, 5, 9]) expect(cellEl(i).innerHTML).toBe(LOOT)
  })
})

describe('#192: the cache invalidates on a grid REBUILD, not just a zone change', () => {
  it('re-glyphs after a U2-Spire floor rebuild at an unchanged world number', () => {
    g().game.global.gridArray = makeGridArray({ 7: { name: 'Snimp' } })
    Update()
    expect(cellEl(7).innerHTML).toContain('glyphicon-forward')

    // nextU2SpireFloor: gridArray = [], grid.innerHTML = '', buildGrid(), drawGrid() — and buildGrid
    // ends with `game.global.gridArray = array`, a NEW array. game.global.world is untouched.
    const worldBefore = g().game.global.world
    buildGridDom()
    g().MODULES.fightinfo.$worldGrid = document.getElementById('grid')
    g().game.global.gridArray = makeGridArray({ 7: { name: 'Snimp' } })
    expect(g().game.global.world).toBe(worldBefore)

    Update()
    expect(cellEl(7).innerHTML).toContain('glyphicon-forward')
  })

  it('still short-circuits when nothing rebuilt the grid', () => {
    const arr = makeGridArray({ 7: { name: 'Snimp' } })
    g().game.global.gridArray = arr
    Update()
    // Wipe the DOM without replacing the array: a second Update must NOT redraw, or the cache is gone
    // and this runs on every guiLoop tick.
    cellEl(7).innerHTML = ''
    Update()
    expect(cellEl(7).innerHTML).toBe('')
  })

  it('a zone advance still invalidates (buildGrid replaces the array there too)', () => {
    g().game.global.gridArray = makeGridArray({ 7: { name: 'Snimp' } })
    Update()
    buildGridDom()
    g().MODULES.fightinfo.$worldGrid = document.getElementById('grid')
    g().game.global.world = 61
    g().game.global.gridArray = makeGridArray({ 7: { name: 'Snimp' } })
    Update()
    expect(cellEl(7).innerHTML).toContain('glyphicon-forward')
  })
})
