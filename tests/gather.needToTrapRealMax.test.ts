// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// #185 — RmanualLabor2's `needToTrap` measured headroom against the RAW `.max`.
//
// `.max` is the summed housing (main.js:9959 addMaxHousing); the effective cap is `realMax()`
// (config.js:8214), which multiplies it by maxMod, Carpentry, Carpentry_II, expandingTauntimp,
// Elixir of Crafting, Scaffolding and the U2 Trimps mutation. Population fills toward realMax(), so
// the moment `owned` passes `.max` the expression `max - owned >= max * 0.05` goes NEGATIVE and
// stays there — with Carpentry radLevel 20 (×6.7275) that is at 14.9% of the real cap. needToTrap
// then collapsed to its second disjunct (army-cannot-be-filled) for the whole rest of the run, and
// both trap branches (gather.ts:352/356) stopped firing.
//
// The existing characterization suite is structurally blind here: every one of its fixtures sets
// `max: 100, realMax: () => 100`, so the two spellings are indistinguishable in all of them. The
// multiplier gap is the whole defect, so these fixtures pull them apart.

let gather: typeof import('../src/modules/gather')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  gather = await import('../src/modules/gather')
})

let gatherCalls: string[]
let trapBuys: unknown[][]

/** The DOM ids RmanualLabor2's ladder reads before it reaches the trap arms. */
function setupDOM() {
  document.body.innerHTML = ''
  for (const id of ['scienceCollectBtn', 'science', 'food', 'wood', 'metal', 'gems', 'fragments']) {
    const el = document.createElement('div')
    el.id = id
    document.body.appendChild(el)
  }
}

beforeEach(() => {
  gatherCalls = []
  trapBuys = []
  ;(globalThis as any).setGather = vi.fn((what: string) => { gatherCalls.push(what) })
  ;(globalThis as any).safeBuyBuilding = vi.fn((...args: unknown[]) => { trapBuys.push(args); return true })
  ;(globalThis as any).canAffordBuilding = () => true
  ;(globalThis as any).trimpsEffectivelyEmployed = () => 0
  ;(globalThis as any).getPlayerModifier = () => 50
  ;(globalThis as any).getPerSecBeforeManual = () => 1
  ;(globalThis as any).questcheck = vi.fn(() => 0)
  ;(globalThis as any).RsmithyCalc = () => 'wood'
  ;(globalThis as any).RscienceNeeded = 1000
  for (const f of ['Rshouldhypofarm', 'Rshouldshipfarm', 'Rshouldtimefarm', 'Rshouldsmithyfarm', 'Rshouldtributefarm'])
    (globalThis as any)[f] = false
  setupDOM()
})

/**
 * `owned` is deliberately ABOVE `.max` and comfortably below `realMax()` — the exact regime the raw
 * spelling cannot see. `getCurrentSend()` is 1 against 300 idle trimps so the SECOND disjunct is
 * false: any trapping that happens here is attributable to the headroom test alone.
 */
function arm(over: { owned: number; max: number; realMax: number; trapsOwned?: number }) {
  ;(globalThis as any).autoTrimpSettings = { RTrapTrimps: { type: 'boolean', enabled: true } }
  ;(globalThis as any).game = makeMinimalGame({
    global: {
      world: 50, universe: 2, challengeActive: '', buildingsQueue: [], playerGathering: 'metal',
      turkimpTimer: 0, totalRadonEarned: 1e9, trapBuildToggled: false,
      dailyChallenge: { seed: 0 }, runningChallengeSquared: false,
    },
    resources: {
      trimps: {
        owned: over.owned, max: over.max, realMax: () => over.realMax, getCurrentSend: () => 1,
      },
      food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 1e9 },
    },
    buildings: { Trap: { owned: over.trapsOwned ?? 100 } },
    upgrades: { Battle: { done: true }, Scientists: { allowed: 0, done: 0 }, Miners: { allowed: 0, done: 0 } },
    triggers: { wood: { done: true } },
    talents: { turkimp2: { purchased: false } },
  })
  gather.RmanualLabor2()
}

describe('#185 — needToTrap measures headroom against realMax(), not the raw .max', () => {
  it('ANTI-FALSE-GREEN: a genuinely FULL town does not trap', () => {
    // Without this row, "it traps" could just be this fixture's default behaviour. At owned ===
    // realMax there is zero headroom under EITHER spelling, so nothing may fire.
    arm({ owned: 673, max: 100, realMax: 673 })
    expect(gatherCalls).not.toContain('trimps')
    expect(trapBuys).toEqual([])
  })

  it('THE BUG: population past `.max` but far below realMax() must still trap', () => {
    // Carpentry radLevel 20 → realMax = floor(100 * 1.1^20) = 673. At 100 owned the town is 14.9%
    // full. Raw spelling: 100 - 100 = 0 >= 5 is FALSE → dead. realMax: 673 - 100 = 573 >= 33.6.
    arm({ owned: 100, max: 100, realMax: 673 })
    expect(gatherCalls).toContain('trimps')
  })

  it('and it keeps trapping all the way up to the 95% line, not just past `.max`', () => {
    for (const owned of [101, 300, 600, 638]) { // 638 = 94.8% of 673
      gatherCalls = []
      arm({ owned, max: 100, realMax: 673 })
      expect(gatherCalls, `owned ${owned}`).toContain('trimps')
    }
    // 640 is 95.1% full — inside the 5% dead band, so it must STOP. This is the boundary that
    // proves the fix kept the headroom semantics instead of trapping unconditionally.
    gatherCalls = []
    arm({ owned: 640, max: 100, realMax: 673 })
    expect(gatherCalls).not.toContain('trimps')
  })

  it('with no Trap built, the trap-buy arm fires on the same test', () => {
    // The two consumers (gather.ts:352 buy / :356 gather) are separate arms of the ladder; a fix
    // that only reached one of them would pass the test above and still leave the other dead.
    arm({ owned: 100, max: 100, realMax: 673, trapsOwned: 0 })
    expect(trapBuys.map((a) => a[0])).toContain('Trap')
  })

  it('no multipliers (realMax === max): behaviour is unchanged', () => {
    // The regression control. For every U1-style player with no population multiplier the two
    // spellings agree, and this fix must be inert for them.
    arm({ owned: 100, max: 100, realMax: 100 })
    expect(gatherCalls).not.toContain('trimps')
    gatherCalls = []
    arm({ owned: 50, max: 100, realMax: 100 })
    expect(gatherCalls).toContain('trimps')
  })
})
