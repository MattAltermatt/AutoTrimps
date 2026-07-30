import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getPerSecBeforeManual, getPotencyMod } from '../src/modules/query'

// #291 — query.ts's seven `game.global.challengeActive === '<C2 child>'` compares.
//
// During a Challenge² the game puts the PARENT's name in `game.global.challengeActive` and the
// children into `game.global.multiChallenge` (updates.js:4673-4680), then asks every behavioural
// question through `challengeActive(what)` (main.js:1753), which checks multiChallenge FIRST. AT
// string-compared instead, so all seven modifiers were skipped for the whole of the matching C² while
// the game applied them anyway — six gather-rate terms in getPerSecBeforeManual (mirroring the game's
// `simpleSeconds`, main.js:17104) and one breed-potency term in getPotencyMod (mirroring `breed()`,
// main.js:5584/5628).
//
// The corpus cannot see any of this — no fixture runs a Challenge² — so this file is the only guard.

const G = globalThis as any

function setGame(g: Record<string, unknown>) {
  G.game = g
  G.calcHeirloomBonus = (_t: string, _s: string, v: number) => v
}

afterEach(() => {
  delete G.game
  delete G.calcHeirloomBonus
})

/**
 * The parent→children map, DERIVED from the clone's own `multiChallenge` arrays rather than retyped,
 * so a clone bump that adds a Challenge² cannot leave this file quietly testing a stale roster.
 */
function c2Pairs(): Record<string, string[]> {
  const CLONE = process.env.TRIMPS_GAME_DIR ?? resolve(__dirname, '..', '.trimps-game')
  const lines = readFileSync(resolve(CLONE, 'config.js'), 'utf8').split('\n')
  const out: Record<string, string[]> = {}
  lines.forEach((line, i) => {
    const arr = line.match(/multiChallenge:\s*\[([^\]]*)\]/)
    if (!arr) return
    const kids = [...arr[1].matchAll(/["']([A-Za-z]+)["']/g)].map((m) => m[1])
    for (let j = i; j > i - 40 && j >= 0; j--) {
      const parent = lines[j].match(/^\t\t([A-Za-z]+):\s*\{/)
      if (parent) { out[parent[1]] = kids; return }
    }
  })
  return out
}

/** `game.global` for a live Challenge²: the PARENT name plus the multiChallenge children. */
function inC2(parent: string, over: Record<string, unknown> = {}) {
  const kids = c2Pairs()[parent]
  expect(kids, `${parent} must be a real Challenge² in the clone`).toBeTruthy()
  const multi: Record<string, boolean> = {}
  for (const k of kids) multi[k] = true
  return { challengeActive: parent, multiChallenge: multi, world: 2, ...over }
}

/** A plain (non-²) challenge — the case that always worked and must keep working. */
function plain(name: string, over: Record<string, unknown> = {}) {
  return { challengeActive: name, multiChallenge: {}, world: 2, ...over }
}

// ── getPerSecBeforeManual: base = owned·modifier = 10·2 = 20 for a Farmer (increase 'food') ───────
function gatherGame(global: Record<string, unknown>, job = 'Farmer') {
  const jobs: Record<string, unknown> = {
    Farmer: { increase: 'food', owned: 10, modifier: 2 },
    Lumberjack: { increase: 'wood', owned: 10, modifier: 2 },
    Miner: { increase: 'metal', owned: 10, modifier: 2 },
    Scientist: { increase: 'science', owned: 10, modifier: 2 },
    Explorer: { increase: 'fragments', owned: 10, modifier: 2 },
    Dragimp: { increase: 'gems', owned: 10, modifier: 2 },
    Magmamancer: { owned: 0, getBonusPercent: () => 1 },
  }
  setGame({
    global,
    jobs,
    portal: {
      Motivation: { level: 0, modifier: 0.1 },
      Motivation_II: { level: 0, modifier: 0.05 },
      Meditation: { level: 0, getBonusPercent: () => 0 },
    },
    challenges: {
      Toxicity: { lootMult: 2, stacks: 50, stackMult: 1.05 },
      Balance: { getGatherMult: () => 0.7 },
      Decay: { stacks: 10 },
    },
  })
  return job
}
const perSec = (global: Record<string, unknown>, job = 'Farmer') =>
  getPerSecBeforeManual(gatherGame(global, job))

describe('#291 — the gather-rate terms fire during the matching Challenge²', () => {
  it('ANTI-FALSE-GREEN: the shared challengeActive helper really honours multiChallenge', () => {
    // Every assertion below depends on the harness's helper being the faithful one (tests/setup.ts,
    // transcribed from main.js:1753). A helper simplified to `challengeActive === what` would make
    // this whole file pass while testing only the case that already worked.
    G.game = { global: inC2('Waze') }
    expect(G.challengeActive('Watch'), 'a C² CHILD must read as active').toBe(true)
    expect(G.challengeActive('Waze'), 'the parent must too (main.js:1755 fallback)').toBe(true)
    expect(G.challengeActive('Nom'), 'an unrelated challenge must not').toBe(false)
    delete G.game
  })

  it('the clone still pairs the six Challenge²s this file relies on', () => {
    expect(c2Pairs()).toMatchObject({
      Enlightened: ['Discipline', 'Meditate'],
      Paralysis: ['Electricity', 'Slow'],
      Nometal: ['Nom', 'Metal'],
      Topology: ['Balance', 'Mapology'],
      Waze: ['Size', 'Watch'],
      Toxad: ['Toxicity', 'Lead'],
    })
  })

  it('Waze²: Watch still halves, and Size still applies — the starkest case', () => {
    // Was 20 (no term fired at all). The game halves gathering for the whole of Waze²
    // (main.js:17156), so AT predicted 2x the truth. Size 1.5 then /2 → 15.
    expect(perSec(inC2('Waze'))).toBeCloseTo(15, 6)
    // Control: the plain challenges, unchanged.
    expect(perSec(plain('Watch'))).toBeCloseTo(10, 6)
    expect(perSec(plain('Size'))).toBeCloseTo(30, 6)
  })

  it('Toxad²: the Toxicity stack term applies and Lead doubles on odd worlds', () => {
    // 20 · (1 + 2·50/100) = 40, then Lead x2 on an odd world.
    expect(perSec(inC2('Toxad', { world: 3 }))).toBeCloseTo(80, 6)
    expect(perSec(inC2('Toxad', { world: 4 })), 'Lead is even-world inert').toBeCloseTo(40, 6)
  })

  it('Enlightened²: Meditate x1.25', () => {
    expect(perSec(inC2('Enlightened'))).toBeCloseTo(25, 6)
  })

  it('Topology²: Balance getGatherMult()', () => {
    expect(perSec(inC2('Topology'))).toBeCloseTo(14, 6) // 20 · 0.7
  })

  it('a Challenge² that touches none of these terms is inert', () => {
    // Paralysis² (Electricity + Slow) and Nometal² (Nom + Metal) have no gather term here. This is the
    // guard against a repair that made the helper fire indiscriminately.
    expect(perSec(inC2('Paralysis'))).toBeCloseTo(20, 6)
    expect(perSec(inC2('Nometal'))).toBeCloseTo(20, 6)
  })
})

describe("#291 — Size's 1.5 is food/wood/metal only, as the game restricts it", () => {
  // main.js:17150 — `else if (challengeActive("Size") && (what == "food" || what == "wood" ||
  // what == "metal")) amt *= 1.5`. AT had no such guard, so Size also inflated science, fragment and
  // gem predictions. The guard had to land with the helper swap: without it, using the helper would
  // have spread the wrong multiplier into Waze² as well as plain Size.
  it('the three gathered resources DO get it', () => {
    for (const job of ['Farmer', 'Lumberjack', 'Miner'])
      expect(perSec(plain('Size'), job), job).toBeCloseTo(30, 6)
  })

  it('science, fragments and gems do NOT', () => {
    for (const job of ['Scientist', 'Explorer', 'Dragimp'])
      expect(perSec(plain('Size'), job), job).toBeCloseTo(20, 6)
  })

  it('and the same holds inside Waze²', () => {
    expect(perSec(inC2('Waze'), 'Miner'), 'Miner: 1.5 then /2').toBeCloseTo(15, 6)
    expect(perSec(inC2('Waze'), 'Scientist'), 'Scientist: only the Watch halving').toBeCloseTo(10, 6)
  })

  it('Meditate still WINS the else-if over Size, in both forms', () => {
    // The game's arms are `if (Meditate) … else if (Size …)`. A repair that split them into two
    // independent `if`s would multiply both and is invisible unless both are active at once.
    const both = { challengeActive: 'Meditate', multiChallenge: { Size: true }, world: 2 }
    expect(perSec(both)).toBeCloseTo(25, 6) // 1.25 only — NOT 1.25 · 1.5 = 37.5
  })
})

describe('#291 — the breed-potency term fires during Toxad²', () => {
  // The seventh site, missed by #291's own header list: getPotencyMod, not a gather rate.
  function potencyGame(global: Record<string, unknown>, stacks: number) {
    setGame({
      global: { ...global, brokenPlanet: false, universe: 1 },
      resources: { trimps: { potency: 0.0085 } },
      upgrades: { Potency: { done: 0 } },
      buildings: { Nursery: { owned: 0 } },
      unlocks: { impCount: { Venimp: 0 } },
      // #233's replacement for the deleted game.unlocks.quickTrimps read.
      singleRunBonuses: { quickTrimps: { owned: false } },
      portal: { Pheromones: { level: 0, modifier: 0.1 } },
      challenges: {
        Toxicity: { stacks, stackMult: 1.05 },
        Archaeology: { getStatMult: () => 1 },
        Quagmire: { getExtraBreedMult: () => 1 },
      },
      talents: { patience: { purchased: false }, hyperspeed: { purchased: false } },
      jobs: { Geneticist: { owned: 0 } },
      heirlooms: {},
    })
  }
  const ratioToBaseline = (global: Record<string, unknown>, stacks: number) => {
    potencyGame(global, stacks)
    const withStacks = getPotencyMod()
    potencyGame(global, 0)
    return withStacks / getPotencyMod()
  }

  it('Toxad² applies stackMult^stacks — asserted as a RATIO so the rest of the chain cancels', () => {
    // Was 1.0 (the term skipped entirely) for the whole of Toxad².
    expect(ratioToBaseline(inC2('Toxad'), 3)).toBeCloseTo(Math.pow(1.05, 3), 6)
  })

  it('plain Toxicity is unchanged, and an unrelated C² is inert', () => {
    expect(ratioToBaseline(plain('Toxicity'), 3)).toBeCloseTo(Math.pow(1.05, 3), 6)
    expect(ratioToBaseline(inC2('Waze'), 3)).toBeCloseTo(1, 6)
  })
})
