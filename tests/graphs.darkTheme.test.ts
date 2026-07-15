import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { saveSetting, loadGraphData } from '../src/modules/graphs/storage'
import { GRAPHSETTINGS, graphState } from '../src/modules/graphs/state'

// #83 §8 — "Black Graphs" persistence. Two compounding bugs in the legacy code:
//   1. toggleDarkGraphs persisted the INVERSE of the checkbox (`saveSetting("darkTheme", !dark)`).
//   2. The load path clobbered the stored value before reading it back.
// Net: the user's choice never round-tripped. The port keeps the fix — render.ts's toggleDarkGraphs
// persists `dark` straight via saveSetting('darkTheme', dark), and loadGraphData restores it.
//
// This suite tests the PERSISTENCE round-trip at the storage layer (was: eval the whole legacy
// Graphs.js in jsdom and inspect the DOM). The DOM half — the createUI hydrate-#blackCB-before-
// themeChanged ordering — is Chrome-verified in the render shell.

function fakeLocalStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed))
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  }
}

const g = globalThis as unknown as { localStorage?: unknown; LZString?: unknown; MODULES?: unknown }

beforeEach(() => {
  g.localStorage = fakeLocalStorage()
  g.LZString = { decompressFromBase64: () => '', compressToBase64: (s: string) => s }
  g.MODULES = {} // loadGraphData sets MODULES.graphs = {}
  graphState.portalSaveData = {}
})
afterEach(() => {
  delete g.localStorage
  delete g.LZString
  delete g.MODULES
})

describe('#83 §8: Black Graphs persistence round-trips', () => {
  it('darkTheme=false (user turned it OFF) survives a save + reload — not re-inverted', () => {
    saveSetting('darkTheme', false)
    GRAPHSETTINGS.darkTheme = true // simulate a fresh module default before the load
    loadGraphData()
    expect(GRAPHSETTINGS.darkTheme).toBe(false)
  })

  it('darkTheme=true survives a save + reload', () => {
    saveSetting('darkTheme', true)
    GRAPHSETTINGS.darkTheme = false
    loadGraphData()
    expect(GRAPHSETTINGS.darkTheme).toBe(true)
  })

  it('saveSetting persists the value it was given (not its negation)', () => {
    saveSetting('darkTheme', false)
    const stored = JSON.parse((g.localStorage as Storage).getItem('GRAPHSETTINGS')!)
    expect(stored.darkTheme).toBe(false)
  })
})
