import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// #83 §8 — "Black Graphs" saved the INVERSE of its own state, and was clobbered on every page load.
//
// Two bugs compounding:
//
//   1. The write was literally inverted (Graphs.js, toggleDarkGraphs):
//          var dark = document.getElementById("blackCB").checked;
//          saveSetting("darkTheme", !dark)          // <- persists the NEGATION
//      while the read-back is straight: `#blackCB.checked = GRAPHSETTINGS.darkTheme`. So the CSS
//      applied at click time used the correct `dark`, but storage got its negation.
//
//   2. The load path clobbered the user's value before it was ever read (createUI):
//          MODULES.graphs.themeChanged();                            // -> toggleDarkGraphs()
//          document.querySelector("#blackCB").checked = GRAPHSETTINGS.darkTheme;
//      `lastTheme` is hoisted-undefined on the first call, so themeChanged() always fires. The
//      checkbox had just been created by innerHTML with NO `checked` attribute, so toggleDarkGraphs()
//      read `false` and persisted it — destroying the stored value, which the next line then read back.
//
// Net effect: on EVERY load the persisted value was stomped, and the checkbox lied about the CSS.
//
// This suite executes the REAL legacy/Graphs.js at global scope via indirect eval — exactly how
// scripts/build-userscript.mjs concatenates it into the userscript. Graphs.js RUNS createUI() as part
// of its own load (line ~1071), so simply evaluating it exercises the load path under test.

const GRAPHS_SRC = readFileSync(resolve('legacy/Graphs.js'), 'utf8')

type Boot = {
  window: any
  storedDarkTheme: () => boolean
  boxChecked: () => boolean
  darkCssLoaded: () => boolean
}

/**
 * Boot Graphs.js into a fresh jsdom with `persisted` already in localStorage.
 * @param themeEnabled the game's own darkTheme menu option (1 = the game default light theme)
 */
function bootGraphs(themeEnabled: number, persisted: Record<string, unknown>): Boot {
  const dom = new JSDOM(
    `<html><body>
       <table id="settingsTable"><tbody><tr>${'<td></td>'.repeat(12)}</tr></tbody></table>
       <div id="settingsRow"></div>
     </body></html>`,
    { runScripts: 'outside-only', url: 'http://localhost/' },
  )
  const { window } = dom

  window.localStorage.setItem('GRAPHSETTINGS', JSON.stringify(persisted))

  Object.assign(window, {
    game: { options: { menu: { darkTheme: { enabled: themeEnabled }, pauseGame: { enabled: false } } }, global: {} },
    MODULES: {},
    debug: () => {},
    basepath: '',
    LZString: { decompressFromBase64: () => '' },
    // The trailing "Trimps Wrappers" section wraps these natives; they must exist at eval time.
    nextWorld: () => {},
    activatePortal: () => {},
    buildMapGrid: () => {},
    mapsSwitch: () => {},
    getTotalPortals: () => 0,
  })

  window.eval(GRAPHS_SRC)

  return {
    window,
    storedDarkTheme: () => JSON.parse(window.localStorage.getItem('GRAPHSETTINGS')).darkTheme,
    boxChecked: () => window.document.querySelector('#blackCB').checked,
    darkCssLoaded: () => !!window.document.getElementById('dark-graph.css'),
  }
}

describe('#83 §8: Black Graphs round-trips', () => {
  it('POSITIVE CONTROL: the harness really executes Graphs.js (createUI built the menu)', () => {
    const b = bootGraphs(1, { darkTheme: true })
    expect(b.window.document.querySelector('#blackCB')).not.toBeNull()
    expect(typeof b.window.toggleDarkGraphs).toBe('function')
  })

  it('a persisted darkTheme=false (user turned Black Graphs OFF) SURVIVES a page load', () => {
    const b = bootGraphs(1, { darkTheme: false })

    // Before the fix, load re-persisted this as `true` and the box rendered ticked.
    expect(b.storedDarkTheme()).toBe(false)
    expect(b.boxChecked()).toBe(false)
    expect(b.darkCssLoaded()).toBe(false)
  })

  it('a persisted darkTheme=true survives a page load, and the CSS matches the box', () => {
    const b = bootGraphs(1, { darkTheme: true })

    expect(b.storedDarkTheme()).toBe(true)
    expect(b.boxChecked()).toBe(true)
    // The box and the stylesheet must agree — before the fix the box was ticked with no dark CSS.
    expect(b.darkCssLoaded()).toBe(b.boxChecked())
  })

  it('toggling the checkbox persists what the user chose, not its negation', () => {
    const b = bootGraphs(1, { darkTheme: true })

    // The player unticks Black Graphs and the onchange fires.
    b.window.document.getElementById('blackCB').checked = false
    b.window.toggleDarkGraphs()

    expect(b.storedDarkTheme()).toBe(false) // was persisted as `true` — the inverse
    expect(b.darkCssLoaded()).toBe(false)

    // And re-ticking round-trips back.
    b.window.document.getElementById('blackCB').checked = true
    b.window.toggleDarkGraphs()

    expect(b.storedDarkTheme()).toBe(true)
    expect(b.darkCssLoaded()).toBe(true)
  })

  it('the choice survives a RELOAD (the whole point of persisting it)', () => {
    const first = bootGraphs(1, { darkTheme: true })
    first.window.document.getElementById('blackCB').checked = false
    first.window.toggleDarkGraphs()
    const persisted = JSON.parse(first.window.localStorage.getItem('GRAPHSETTINGS'))

    const second = bootGraphs(1, persisted) // reload

    expect(second.storedDarkTheme()).toBe(false)
    expect(second.boxChecked()).toBe(false)
    expect(second.darkCssLoaded()).toBe(false)
  })
})
