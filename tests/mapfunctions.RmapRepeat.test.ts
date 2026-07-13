// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #83 §4 — `&&` binds tighter than `||`.
//
//     if (game.global.repeatMap &&
//         (Rshoulddoquest == 3 && game.global.mapBonus >= 4) ||     <- the ONLY guarded disjunct
//         (Rshoulddopraid && RAMPfragfarming && RAMPfrag(false)) || <- unguarded
//         ... five more unguarded ...
//     ) { repeatClicked(); }
//
// parses as `(repeatMap && A) || B || C || D || E || F || G`. The author meant `repeatMap && (A||…||G)`:
// repeatClicked() is a TOGGLE, not a setter (.trimps-game/main.js:10983 —
// `if (!updateOnly) game.global.repeatMap = !game.global.repeatMap`), so `game.global.repeatMap &&`
// is a PRECONDITION ("only turn Repeat off if it is currently on").
//
// Consequence: a U2 player fragment-farming reaches the condition that should END the farm, AT has
// just turned Repeat OFF one line earlier — and then one of the six unguarded disjuncts fires and
// toggles it straight back ON. The fragment map re-runs indefinitely.
//
// The repro below drives the REAL exported RmapRepeat() and uses the REAL toggle semantics.

let mapfunctions: typeof import('../src/modules/mapfunctions')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).getPlayerCritChance = () => 0 // read at module load (mapfunctions.ts:26)
  mapfunctions = await import('../src/modules/mapfunctions')
})

let repeatClickedCalls: number

/**
 * Seed the ambient world so that RmapRepeat() takes its Praid-fragment-farming path.
 *
 * The path that matters, in order:
 *   :1777  !repeatMap                     -> repeatClicked() turns Repeat ON
 *   :1829  shouldDoHealthMaps && mapBonus -> repeatClicked() turns Repeat back OFF  (the "stop" decision)
 *   :1837  the buggy condition            -> toggles Repeat ON AGAIN                (the bug)
 */
function seed(opts: { repeatMap: boolean }) {
  repeatClickedCalls = 0
  const g: any = globalThis

  g.autoTrimpSettings = {
    RMaxMapBonuslimit: { type: 'value', value: '10' },
    RMaxMapBonushealth: { type: 'value', value: '1' },
  }

  g.game = {
    global: {
      repeatMap: opts.repeatMap,
      mapBonus: 5, // >= RMaxMapBonushealth (1), so the health-map arm fires and turns Repeat OFF
      currentMapId: 'someMap',
    },
    options: { menu: { repeatUntil: { enabled: 0 } } },
  }

  // The real game's repeatClicked is a TOGGLE. Model it exactly.
  g.repeatClicked = () => {
    repeatClickedCalls++
    g.game.global.repeatMap = !g.game.global.repeatMap
  }
  g.mapsClicked = () => {}

  // Praid fragment-farming is active and its fragment check says "done" -> the 2nd disjunct is TRUE.
  g.Rshoulddopraid = true
  g.RAMPfragfarming = true
  g.RAMPfrag = () => true // cross-module (mapfunctions-amp.ts) -> a real free global here

  // Everything else off. Note Rshoulddoquest/Rshouldmayhem are NUMERIC (compared with > 0 / == 3).
  g.Rshoulddoquest = 0
  g.Rshouldmayhem = 0
  for (const name of [
    'RvanillaMAZ', 'Rdshoulddopraid', 'RdAMPfragfarming', 'Rshouldinsanityfarm', 'Rinsanityfragfarming',
    'Rshouldalchfarm', 'Ralchfragfarming', 'Rshouldhypofarm', 'Rhypofragfarming', 'Rshouldshipfarm',
    'Rshipfragfarming', 'RdoMaxMapBonus', 'RshouldFarm', 'Rshouldfragfarm', 'Rshouldtimefarm',
    'Rdshouldtimefarm', 'Rshouldsmithyfarm', 'Rshouldtributefarm', 'Rshoulddobogs', 'Rshouldpanda',
    'Rshouldstormfarm', 'Rshoulddesofarm', 'Rshouldequipfarm', 'RshouldDoMaps',
  ]) g[name] = false

  // RfragCheck is module-local to mapfunctions.ts, but the `||` chain short-circuits on the Praid
  // disjunct before reaching any RfragCheck disjunct — so it is never called. (If that ever changes,
  // this test would throw rather than silently pass.)
}

beforeEach(() => seed({ repeatMap: false }))

describe('#83 §4: RmapRepeat does not re-arm Repeat after deciding to stop', () => {
  it('THE BUG: Repeat stays OFF once the health-map arm turns it off', () => {
    // shouldDoHealthMaps = true -> the :1829 arm turns Repeat OFF, which is AT deciding to LEAVE.
    mapfunctions.RmapRepeat('someMap', /* shouldDoHealthMaps */ true, /* restartVoidMap */ false)

    // Before the fix, the unguarded Praid disjunct at :1837 toggled it straight back ON.
    expect((globalThis as any).game.global.repeatMap).toBe(false)
  })

  it('anti-vacuous: the path really ran (Repeat was toggled on, then off — and no more)', () => {
    mapfunctions.RmapRepeat('someMap', true, false)
    // :1777 (on) + :1829 (off) = 2. The buggy build made a 3rd call at :1837.
    expect(repeatClickedCalls).toBe(2)
  })

  it('the guarded behaviour survives: with Repeat ON, the Praid disjunct still turns it OFF', () => {
    // Repeat already on, and no health-map stop -> :1777 skipped, :1829 skipped. The :1837 condition
    // is exactly what SHOULD fire here, and the precondition `game.global.repeatMap` is satisfied.
    seed({ repeatMap: true })
    mapfunctions.RmapRepeat('someMap', /* shouldDoHealthMaps */ false, false)
    expect((globalThis as any).game.global.repeatMap).toBe(false) // farm ended, Repeat cleared
    expect(repeatClickedCalls).toBe(1)
  })
})
