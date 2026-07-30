// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #249 — forceAbandonTrimps()'s Spire guard was `isActiveSpireAT() && disActiveSpireAT()`, an
// unsatisfiable conjunction: the first requires challengeActive != 'Daily', the second requires
// == 'Daily'. So the function had no Spire exclusion of its own and the Trimpicide tooltip's
// "Never fires in the Spire" rested entirely on its single caller's separate guard.
//
// The REAL predicates are used here (imported from other.ts and published the way the bridge does),
// not stubs — a stubbed isActiveSpireAT would let the test pass against either spelling.

const G = globalThis as any
let breedtimer: typeof import('../src/modules/breedtimer')
let other: typeof import('../src/modules/other')

beforeAll(async () => {
  G.MODULES = {}
  G.Decimal = (await import('decimal.js')).default
  document.body.insertAdjacentHTML('beforeend', `<div id="trimps"><div class="row"></div></div><div id="trimpsFighting"></div>`)
  // other.ts wraps playerSpire.drawInfo at IMPORT time (other.ts:270), so the object has to exist
  // before the import or the whole suite fails to load — and a failed suite reports as SKIPPED,
  // which is the one outcome that looks like nothing is wrong.
  // (grep confirms these are the only two: `^globalThis\.(old|oldPlayer)\w* = ` in other.ts.)
  G.playerSpire = { drawInfo: () => {} }
  G.nextWorld = () => {}
  other = await import('../src/modules/other')
  breedtimer = await import('../src/modules/breedtimer')
  G.isActiveSpireAT = other.isActiveSpireAT
  G.disActiveSpireAT = other.disActiveSpireAT
})

let mapsClickedCalls: number

function arm(over: { challengeActive?: string; spireActive?: boolean; mapsActive?: boolean } = {}) {
  mapsClickedCalls = 0
  G.mapsClicked = () => { mapsClickedCalls++ }
  G.runMap = () => {}
  G.getCurrentMapObject = () => ({ location: 'Plentiful' })
  G.autoTrimpSettings = {
    ForceAbandon: { type: 'boolean', enabled: true },
    AutoMaps: { type: 'multitoggle', value: '1' },
    IgnoreSpiresUntil: { type: 'value', value: '0' },
    dIgnoreSpiresUntil: { type: 'value', value: '0' },
  }
  G.game = {
    global: {
      mapsUnlocked: true,
      mapsActive: over.mapsActive ?? false,
      preMapsActive: false,
      switchToMaps: false,
      switchToWorld: false,
      spireActive: over.spireActive ?? false,
      challengeActive: over.challengeActive ?? '',
      world: 200,
    },
  }
}

beforeEach(() => arm())

describe('#249 — forceAbandonTrimps stands down in EITHER kind of Spire', () => {
  it('anti-false-green: it really does act when no Spire is running', () => {
    // Without this every "did nothing" assertion below is satisfiable by a function that never acts.
    arm({ spireActive: false })
    breedtimer.forceAbandonTrimps()
    expect(mapsClickedCalls).toBeGreaterThan(0)
  })

  it('stands down in a NON-Daily Spire (isActiveSpireAT)', () => {
    arm({ spireActive: true, challengeActive: '' })
    expect(other.isActiveSpireAT()).toBeTruthy()
    expect(other.disActiveSpireAT()).toBeFalsy()
    breedtimer.forceAbandonTrimps()
    expect(mapsClickedCalls).toBe(0)
  })

  it('stands down in a DAILY Spire (disActiveSpireAT)', () => {
    // This is the arm the `&&` could never reach, and the one a half-fix that only keeps
    // isActiveSpireAT() would still miss.
    arm({ spireActive: true, challengeActive: 'Daily' })
    expect(other.isActiveSpireAT()).toBeFalsy()
    expect(other.disActiveSpireAT()).toBeTruthy()
    breedtimer.forceAbandonTrimps()
    expect(mapsClickedCalls).toBe(0)
  })

  it('the two predicates are mutually exclusive — so `&&` can never be satisfied', () => {
    // The property that made the original guard dead, asserted rather than described.
    for (const challengeActive of ['', 'Daily', 'Trapper']) {
      arm({ spireActive: true, challengeActive })
      expect(other.isActiveSpireAT() && other.disActiveSpireAT()).toBeFalsy()
    }
  })

  it('still acts inside a map even while a Spire is running', () => {
    // The guard is `(... ) && !mapsActive` — being in a map is the documented exception.
    arm({ spireActive: true, challengeActive: '', mapsActive: true })
    breedtimer.forceAbandonTrimps()
    expect(mapsClickedCalls).toBeGreaterThan(0)
  })
})
