// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #83 §5 — dailyPraiding() wrote the U1 Praiding globals instead of its own daily twins.
//
// It is a copy of Praiding() with the `d` prefix restored only SOME of the time. Three slips:
//   :1628  the completion latch tested `pMap1 == undefined`   (should be dpMap1)
//   :1662  the success block cleared `pMap1`                  (should be dpMap1)
//   :1676+ the reset block cleared pMap1 + repMap1..repMap5   (should be dpMap1 + drepMap1..drepMap5)
//
// Three consequences, all real:
//   (a) the daily raid can declare itself COMPLETE before its first map has even launched — pMap1 is
//       undefined whenever the non-daily machine is idle, so the latch passes while dpMap1 is pending;
//   (b) the CONCURRENT non-daily Praiding state machine gets its pMap1/repMap1..5 yanked out from
//       under it; and
//   (c) drepMap1..drepMap5 are NEVER reset, so stale map ids from a previous daily survive into the
//       next one and reach recycleMap(getMapIndex(staleId)). getMapIndex returns undefined for an id
//       that no longer exists (main.js:8187) and recycleMap reads undefined as "recycle the map I am
//       currently looking at" (main.js:10694) — so it recycles the WRONG map.

let praiding: typeof import('../src/modules/other-praiding')

const g = () => globalThis as any

beforeAll(async () => {
  g().MODULES = {}
  g().autoTrimpSettings = {}
  g().game = { global: {} }
  praiding = await import('../src/modules/other-praiding')
})

/** The U1 (non-daily) machine is mid-raid. Nothing the DAILY function does may touch any of this. */
function seedU1State() {
  g().pMap1 = 'u1-pending-map'
  g().repMap1 = 'u1-rep-1'
  g().repMap2 = 'u1-rep-2'
  g().repMap3 = 'u1-rep-3'
  g().repMap4 = 'u1-rep-4'
  g().repMap5 = 'u1-rep-5'
}

function seedDailyFlags() {
  g().dprestraid = false
  g().dfailpraid = false
  g().dprestraidon = false
  g().dpraidDone = false
  for (let i = 1; i <= 5; i++) g()['dmapbought' + i] = false
  for (let i = 1; i <= 5; i++) g()['dpMap' + i] = undefined
  for (let i = 1; i <= 5; i++) g()['drepMap' + i] = undefined
}

beforeEach(() => {
  g().autoTrimpSettings = {
    dPraidingzone: { type: 'multiValue', value: [] },
    dPraidingcell: { type: 'value', value: '0' },
    AutoMaps: { type: 'multitoggle', value: 1 },
  }
  g().game = {
    global: { world: 50, lastClearedCell: 0, preMapsActive: true, mapsActive: false, repeatMap: true, mapsOwnedArray: [] },
    options: { menu: { repeatUntil: { enabled: 0 } } },
  }
  g().debug = () => {}
  g().mapsClicked = () => {}
  g().repeatClicked = () => {}
  g().selectMap = () => {}
  g().recycleMap = () => {}
  g().getMapIndex = () => 0
  seedU1State()
  seedDailyFlags()
})

describe('#83 §5: dailyPraiding resets its OWN globals', () => {
  it('the reset block clears drepMap1..drepMap5 (they used to survive forever)', () => {
    // world 50 is NOT in the praiding zone list -> every(isBelowThreshold) is true -> reset block runs.
    g().autoTrimpSettings.dPraidingzone.value = [100]
    for (let i = 1; i <= 5; i++) g()['drepMap' + i] = 'stale-daily-rep-' + i

    praiding.dailyPraiding()

    for (let i = 1; i <= 5; i++) {
      // A surviving id is handed to recycleMap(getMapIndex(stale)) on the NEXT daily -> wrong map recycled.
      expect(g()['drepMap' + i], `drepMap${i} must be reset`).toBeUndefined()
    }
  })

  it('the reset block does NOT clobber the concurrent U1 machine (pMap1 / repMap1..5)', () => {
    g().autoTrimpSettings.dPraidingzone.value = [100]

    praiding.dailyPraiding()

    expect(g().pMap1).toBe('u1-pending-map')
    for (let i = 1; i <= 5; i++) {
      expect(g()['repMap' + i], `repMap${i} belongs to the U1 machine`).toBe('u1-rep-' + i)
    }
  })

  it('the completion latch reads dpMap1, so a daily with a PENDING map is not declared complete', () => {
    // Stay in the praiding zone (so the reset block does NOT run), but skip the main block via the
    // cell gate: cell 90 > 1 and lastClearedCell+1 (1) < 90.
    g().autoTrimpSettings.dPraidingzone.value = [50]
    g().autoTrimpSettings.dPraidingcell.value = '90'

    g().dmapbought1 = true
    g().dpMap1 = 'daily-map-still-pending' // the daily's first map has NOT launched yet
    // pMap1 (the U1 global the latch used to read) is 'u1-pending-map' here, but the point is that it
    // is routinely undefined — and then the latch fired on an untouched daily. Prove the fix reads dpMap1:
    g().pMap1 = undefined

    praiding.dailyPraiding()

    // Buggy: pMap1 == undefined -> latch passes -> dprestraid = true, raid "complete" before it began.
    expect(g().dprestraid).toBe(false)
  })

  it('anti-vacuous: the latch DOES fire once dpMap1 is genuinely clear', () => {
    g().autoTrimpSettings.dPraidingzone.value = [50]
    g().autoTrimpSettings.dPraidingcell.value = '90'
    g().dmapbought1 = true
    g().dpMap1 = undefined // the daily's maps really are all launched

    praiding.dailyPraiding()

    expect(g().dprestraid).toBe(true)
  })
})
