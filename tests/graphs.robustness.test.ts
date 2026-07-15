import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Phase-1 Graphs hardening. Two independent regressions guarded here:
//
//   Fix D — loadGraphData() must survive a CORRUPT localStorage key. It runs unguarded at module
//   top level, so an unhandled throw there aborts createUI() and the four data-capture wrappers
//   installed below it — and, in the concatenated userscript, breaks everything emitted after this
//   file. LZString.decompressFromBase64 returns "" for an absent key (first run, safe) but
//   null/garbage for a malformed key, and JSON.parse throws on bad data.
//
//   Fix A — the overkill() data accessor must NOT mutate the player's game settings. It used to
//   call toggleSetting("overkillColor") to force-enable cell coloring (which it then counted via
//   DOM classes), persisting that flip into the save so a player could never keep the option off.
//   It now counts game.global.(map)gridArray cells with .overkilled — no mutation.
//
// The suite executes the REAL legacy/Graphs.js at global scope via window.eval, exactly how
// scripts/build-userscript.mjs concatenates it. Graphs.js runs loadGraphData() + createUI() as
// part of its own load, so simply evaluating it exercises the load path under test.

const GRAPHS_SRC = readFileSync(resolve('legacy/Graphs.js'), 'utf8')

/**
 * Boot Graphs.js into a fresh jsdom.
 * @param opts.storage  seed localStorage keys (raw strings, as stored)
 * @param opts.decompress  the LZString.decompressFromBase64 stand-in (default returns "")
 */
function bootGraphs(opts: { storage?: Record<string, string>; decompress?: (s: string) => unknown } = {}) {
  const dom = new JSDOM(
    `<html><body>
       <table id="settingsTable"><tbody><tr>${'<td></td>'.repeat(12)}</tr></tbody></table>
       <div id="settingsRow"></div>
     </body></html>`,
    { runScripts: 'outside-only', url: 'http://localhost/' },
  )
  const { window } = dom

  for (const [k, v] of Object.entries(opts.storage ?? {})) window.localStorage.setItem(k, v)

  Object.assign(window, {
    game: { options: { menu: { darkTheme: { enabled: 1 }, pauseGame: { enabled: false } } }, global: {} },
    MODULES: {},
    debug: () => {},
    basepath: '',
    LZString: { decompressFromBase64: opts.decompress ?? (() => '') },
    // The trailing "Trimps Wrappers" section wraps these natives; they must exist at eval time.
    nextWorld: () => {},
    activatePortal: () => {},
    buildMapGrid: () => {},
    mapsSwitch: () => {},
    getTotalPortals: () => 0,
  })

  window.eval(GRAPHS_SRC)
  return window
}

describe('Fix D: loadGraphData survives corrupt localStorage', () => {
  it('POSITIVE CONTROL: a clean boot builds the menu (createUI ran)', () => {
    const w = bootGraphs()
    expect(w.document.querySelector('#blackCB')).not.toBeNull()
  })

  it('a corrupt portalDataHistory key does not throw and still boots the UI', () => {
    // Malformed decompressed payload: not "" (so the old code entered the parse branch) and not
    // valid JSON. Before the fix this threw JSON.parse/Object.entries and aborted the whole load.
    const w = bootGraphs({
      storage: { portalDataHistory: 'garbage-base64' },
      decompress: () => '{not valid json',
    })
    expect(w.document.querySelector('#blackCB')).not.toBeNull()
  })

  it('a decompress that yields a non-object (e.g. null) does not throw', () => {
    const w = bootGraphs({
      storage: { portalDataHistory: 'x' },
      decompress: () => 'null', // JSON.parse -> null -> Object.entries(null) would throw pre-fix
    })
    expect(w.document.querySelector('#blackCB')).not.toBeNull()
  })

  it('a corrupt portalDataCurrent key does not throw', () => {
    const w = bootGraphs({ storage: { portalDataCurrent: '{bad' } })
    expect(w.document.querySelector('#blackCB')).not.toBeNull()
  })

  it('a corrupt GRAPHSETTINGS key does not throw and falls back to defaults', () => {
    const w = bootGraphs({ storage: { GRAPHSETTINGS: '{bad' } })
    expect(w.document.querySelector('#blackCB')).not.toBeNull()
  })
})

describe('Fix A: the overkill() data reader never mutates game settings', () => {
  it('the source no longer force-enables overkillColor from a data accessor', () => {
    // Mutation check: restore `toggleSetting("overkillColor")` to the overkill accessor and this
    // fails. A data reader must not write the player's save.
    expect(GRAPHS_SRC).not.toMatch(/toggleSetting\(\s*["']overkillColor["']\s*\)/)
  })

  it('the overkill accessor counts from grid .overkilled state instead of DOM classes', () => {
    const overkillBody = GRAPHS_SRC.slice(
      GRAPHS_SRC.indexOf('overkill:'),
      GRAPHS_SRC.indexOf('zoneTime:'), // the next accessor
    )
    expect(overkillBody).toMatch(/\.overkilled/)
    expect(overkillBody).toMatch(/mapGridArray/)
  })
})
