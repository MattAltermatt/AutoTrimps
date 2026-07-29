// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #222 — "AMU: Trimple" worked ONLY during a Challenge², the inverse of its tooltip.
//
// The natural Trimple branch tested `treasure > -33 && treasure < 33` inside its BODY and answered
// with `continue`, which skips the whole loop iteration — so the AMUtrimple `else if` right below it
// was unreachable in any non-C2 run. TrimpleZ's own default is 0, squarely inside that range, so the
// checkbox was dead at its shipped configuration.

const G = globalThis as any
let maps: typeof import('../src/modules/maps')

beforeAll(async () => {
  G.MODULES = { maps: {} }
  G.getPlayerCritChance = () => 0
  // maps.ts reads settings at IMPORT time; a suite that cannot load reports as SKIPPED, not red.
  G.autoTrimpSettings = {}
  document.body.insertAdjacentHTML('beforeend', `<div id="portalBtn" style="display:none"></div>`)
  maps = await import('../src/modules/maps')
})

const TRIMPLE = { name: 'Trimple Of Doom', noRecycle: true, difficulty: 1.8, id: 'trimple1' }

function arm(over: { trimpleZ?: number; amuTrimple?: boolean; runningC2?: boolean; world?: number; canRunOnce?: boolean } = {}) {
  G.autoTrimpSettings = {
    AutoMaps: { type: 'multitoggle', value: 2 }, // "Unique" — the mode AMU lives in
    AMUtrimple: { type: 'boolean', enabled: over.amuTrimple ?? true },
    AMUblock: { type: 'boolean', enabled: false },
    AMUprison: { type: 'boolean', enabled: false },
    AMUbw: { type: 'boolean', enabled: false },
    AMUstar: { type: 'boolean', enabled: false },
    BuyShieldblock: { type: 'boolean', enabled: false },
    TrimpleZ: { type: 'valueNegative', value: String(over.trimpleZ ?? 0) },
  }
  G.game = {
    global: {
      world: over.world ?? 200,
      runningChallengeSquared: over.runningC2 ?? false,
      challengeActive: '',
      mapsOwnedArray: [TRIMPLE],
    },
    mapUnlocks: { AncientTreasure: { canRunOnce: over.canRunOnce ?? true } },
    upgrades: { Bounty: { allowed: 0 }, Shieldblock: { allowed: 1 } },
    talents: { bounty: { purchased: true }, portal: { purchased: true } },
  }
  G.challengeActive = () => false
  G.setPageSetting = () => {}
}

beforeEach(() => arm())

describe('#222 — AMU: Trimple is independent of TrimpleZ', () => {
  it('fires at TrimpleZ = 0, its shipped default (THE BUG)', () => {
    arm({ trimpleZ: 0, amuTrimple: true, runningC2: false })
    expect(maps.selectUniqueMap()).toBe('trimple1')
  })

  it.each([0, 10, -10, 32, -32])('fires anywhere inside the old dead range (TrimpleZ %i)', (z) => {
    arm({ trimpleZ: z as number, amuTrimple: true, runningC2: false })
    expect(maps.selectUniqueMap()).toBe('trimple1')
  })

  it('still fires during a Challenge² — the one case that already worked', () => {
    arm({ trimpleZ: 0, amuTrimple: true, runningC2: true })
    expect(maps.selectUniqueMap()).toBe('trimple1')
  })

  it('anti-false-green: with the checkbox OFF and TrimpleZ in range, nothing is selected', () => {
    // Without this, a function that always returned the map would satisfy every row above.
    arm({ trimpleZ: 0, amuTrimple: false, runningC2: false })
    expect(maps.selectUniqueMap()).toBeUndefined()
  })

  it('anti-false-green: the AncientTreasure reward gate still applies', () => {
    // #42 added canRunOnce to the AMU branch so a claimed treasure is not re-selected forever.
    arm({ trimpleZ: 0, amuTrimple: true, canRunOnce: false })
    expect(maps.selectUniqueMap()).toBeUndefined()
  })

  it('anti-false-green: the zone gate still applies (world < 33 + ceil(1.8/2))', () => {
    arm({ trimpleZ: 0, amuTrimple: true, world: 33 })
    expect(maps.selectUniqueMap()).toBeUndefined()
    arm({ trimpleZ: 0, amuTrimple: true, world: 34 })
    expect(maps.selectUniqueMap()).toBe('trimple1')
  })
})

describe('#222 — the natural TrimpleZ branch is unchanged', () => {
  it('OUTSIDE the range it still selects the map, with AMU off', () => {
    arm({ trimpleZ: 50, amuTrimple: false, runningC2: false, world: 200 })
    expect(maps.selectUniqueMap()).toBe('trimple1')
  })

  it('a TrimpleZ above the current world still declines', () => {
    // `world >= treasure` is the natural branch's own gate; 200 < 500 so it must not fire, and with
    // AMU off nothing else can select the map.
    arm({ trimpleZ: 500, amuTrimple: false, runningC2: false, world: 200 })
    expect(maps.selectUniqueMap()).toBeUndefined()
  })

  it('a NEGATIVE TrimpleZ outside the range still selects, and still resets the setting to 0', () => {
    // setPageSetting is a MODULE import inside maps.ts, so a globalThis stub cannot intercept it
    // (CLAUDE.md: you cannot spy on a converted module by reassigning the global). Assert the store
    // it writes instead — that is the observable the real function produces.
    arm({ trimpleZ: -50, amuTrimple: false, runningC2: false })
    expect(maps.selectUniqueMap()).toBe('trimple1')
    expect(G.autoTrimpSettings.TrimpleZ.value).toBe(0)
  })
})
