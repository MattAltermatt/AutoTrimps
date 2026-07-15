import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadGraphData } from '../src/modules/graphs/storage'
import { graphState } from '../src/modules/graphs/state'

// Phase-1 Graphs hardening — Fix D. loadGraphData() must survive a CORRUPT localStorage key. It runs
// unguarded at boot, so an unhandled throw there aborts createUI() and the data-capture wrappers, and
// (in the concatenated userscript) breaks everything emitted after Graphs. LZString.decompressFromBase64
// returns "" for an absent key (first run, safe) but null/garbage for a malformed key, and JSON.parse
// throws on bad data. This suite drives storage.loadGraphData() directly with an injected localStorage +
// LZString (formerly it eval()'d the whole legacy/Graphs.js at global scope).

// A minimal in-memory localStorage seeded per-test.
function fakeLocalStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed))
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  }
}

type Ambient = {
  localStorage?: unknown
  LZString?: unknown
  MODULES?: unknown
  game?: unknown
  getTotalPortals?: unknown
  recycleAllExtraHeirlooms?: unknown
  countChallengeSquaredReward?: unknown
  Fluffy?: unknown
}
const g = globalThis as unknown as Ambient

function install(opts: { storage?: Record<string, string>; decompress?: (s: string) => unknown } = {}) {
  g.localStorage = fakeLocalStorage(opts.storage)
  g.LZString = {
    decompressFromBase64: opts.decompress ?? (() => ''),
    compressToBase64: (s: string) => s,
  }
  g.MODULES = {}
}

beforeEach(() => {
  graphState.portalSaveData = {}
})

afterEach(() => {
  delete g.localStorage
  delete g.LZString
  delete g.MODULES
  delete g.game
  delete g.getTotalPortals
  delete g.recycleAllExtraHeirlooms
  delete g.countChallengeSquaredReward
  delete g.Fluffy
})

describe('Fix D: loadGraphData survives corrupt localStorage', () => {
  it('POSITIVE CONTROL: a clean, empty store loads without throwing and leaves an object', () => {
    install()
    expect(() => loadGraphData()).not.toThrow()
    expect(typeof graphState.portalSaveData).toBe('object')
    expect(graphState.portalSaveData).not.toBeNull()
  })

  it('POSITIVE CONTROL: a valid history actually rebuilds Portal entries (not vacuously green)', () => {
    // Prove loadGraphData isn't just swallowing everything: feed a real history + a minimal game so
    // the `new Portal()` rebuild path runs, and assert the entry lands. Portal reads live game.* .
    g.getTotalPortals = () => 1
    g.recycleAllExtraHeirlooms = () => 0
    g.countChallengeSquaredReward = () => [0, 0]
    g.Fluffy = { getCurrentPrestige: () => 0 }
    g.game = {
      global: {
        universe: 1,
        challengeActive: '',
        nullifium: 0,
        totalHeliumEarned: 0,
        fluffyExp: 0,
        spentEssence: 0,
        essence: 0,
        world: 1,
        dailyChallenge: {},
        runningChallengeSquared: false,
      },
      stats: { totalVoidMaps: { value: 0 }, bestFluffyExp: { value: 0 } },
    }
    const history = JSON.stringify({ 'u1 p1': { totalPortals: 1, universe: 1, perZoneData: {} } })
    install({ storage: { portalDataHistory: 'x' }, decompress: () => history })

    expect(() => loadGraphData()).not.toThrow()
    expect(Object.keys(graphState.portalSaveData)).toContain('u1 p1')
    expect(graphState.portalSaveData['u1 p1'].totalPortals).toBe(1)
  })

  it('a corrupt portalDataHistory key does not throw and starts fresh', () => {
    // Malformed decompressed payload: not "" (so the parse branch is entered) and not valid JSON.
    // Before the fix this threw JSON.parse/Object.entries and aborted the whole load.
    install({ storage: { portalDataHistory: 'garbage-base64' }, decompress: () => '{not valid json' })
    expect(() => loadGraphData()).not.toThrow()
    expect(typeof graphState.portalSaveData).toBe('object')
    expect(graphState.portalSaveData).toEqual({})
  })

  it('a decompress that yields a non-object (e.g. null) does not throw', () => {
    // JSON.parse('null') -> null -> Object.entries(null) would throw pre-fix.
    install({ storage: { portalDataHistory: 'x' }, decompress: () => 'null' })
    expect(() => loadGraphData()).not.toThrow()
    expect(typeof graphState.portalSaveData).toBe('object')
  })

  it('a corrupt portalDataCurrent key does not throw', () => {
    install({ storage: { portalDataCurrent: '{bad' } })
    expect(() => loadGraphData()).not.toThrow()
    expect(typeof graphState.portalSaveData).toBe('object')
  })

  it('a corrupt GRAPHSETTINGS key does not throw and falls back to defaults', () => {
    install({ storage: { GRAPHSETTINGS: '{bad' } })
    expect(() => loadGraphData()).not.toThrow()
    expect(typeof graphState.portalSaveData).toBe('object')
  })
})
