// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// Phase-2 characterization net for gather.ts (proof-net #51) — the gather/resource-allocation
// actuator. Two archetypes per the design spec (§4):
//   L1a pure golden masters — calcTPS (traps/sec) + calcMaxTraps (trap-buffer target).
//   L1b actuator spy-logs — manualLabor2 / autogather3 / RmanualLabor2. Their RETURN is void; the
//     CONTRACT is the ordered native-mutator call log: setGather(what) + safeBuyBuilding('Trap').
//     We spy those and assert the EXACT ordered sequence across branch-arming fixtures.
// These lock current faithful-port behaviour BEFORE the idiomatic un-minify so a transcription
// slip fails loudly. EVERY ==→=== / !=→!== conversion is driven to its live/true state below.

let gather: typeof import('../src/modules/gather')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  gather = await import('../src/modules/gather')
})

// ── shared native-mutator spies ─────────────────────────────────────────────────────────────────
// gatherCalls: ordered setGather(what) log. trapBuyArgs: full arg-tuples for each safeBuyBuilding
// call (so a wrong-argument regression — e.g. buying the wrong building — can't hide behind a bare
// count). callLog: a SINGLE interleaved timeline of both mutators, so cross-spy ordering
// (safeBuyBuilding('Trap') then setGather('buildings')) is asserted, not just per-spy sequences.
let gatherCalls: string[]
let trapBuyArgs: unknown[][]
let callLog: string[]
function installSpies(trapBuyReturns = true) {
  gatherCalls = []
  trapBuyArgs = []
  callLog = []
  ;(globalThis as any).setGather = vi.fn((what: string) => {
    gatherCalls.push(what)
    callLog.push('setGather:' + what)
  })
  ;(globalThis as any).safeBuyBuilding = vi.fn((...args: unknown[]) => {
    trapBuyArgs.push(args)
    callLog.push('safeBuyBuilding:' + String(args[0]))
    return trapBuyReturns
  })
}

// A jsdom DOM with the ids gather.ts reads. Each element's style.display / style.visibility is
// what the researchAvailable / scienceAvailable / per-resource-hidden guards branch on.
function setupDOM(opts: {
  scienceDisplay?: string
  scienceVisibility?: string
  foodVis?: string
  woodVis?: string
  metalVis?: string
} = {}) {
  document.body.innerHTML = ''
  const mk = (id: string, display?: string, visibility?: string) => {
    const el = document.createElement('div')
    el.id = id
    if (display !== undefined) el.style.display = display
    if (visibility !== undefined) el.style.visibility = visibility
    document.body.appendChild(el)
  }
  mk('scienceCollectBtn', opts.scienceDisplay ?? 'block')
  mk('science', undefined, opts.scienceVisibility ?? 'visible')
  mk('food', undefined, opts.foodVis ?? 'visible')
  mk('wood', undefined, opts.woodVis ?? 'visible')
  mk('metal', undefined, opts.metalVis ?? 'visible')
}

afterEach(() => {
  for (const k of [
    'game', 'autoTrimpSettings', 'setGather', 'safeBuyBuilding', 'getZoneSeconds',
    'breedingPS', 'breedTimeRemaining', 'DecimalBreed', 'challengeActive', 'bwRewardUnlocked',
    'getPlayerModifier', 'canAffordBuilding', 'isBuildingInQueue', 'getPerSecBeforeManual',
    'getPsString', 'scienceNeeded', 'breedFire', 'trimpsEffectivelyEmployed',
    'RscienceNeeded', 'Rshouldhypofarm', 'Rshouldshipfarm', 'Rshouldtimefarm',
    'Rshouldsmithyfarm', 'Rshouldtributefarm', 'questcheck', 'RsmithyCalc',
  ]) delete (globalThis as any)[k]
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1a — calcTPS + calcMaxTraps (pure golden masters)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('gather.calcTPS — L1a golden master (traps/sec)', () => {
  it('playerModifier/5 below the cap', () => {
    ;(globalThis as any).game = makeMinimalGame({ global: { playerModifier: 20 } })
    expect(gather.calcTPS()).toBe(4) // min(10, 20/5)
  })
  it('caps at 10', () => {
    ;(globalThis as any).game = makeMinimalGame({ global: { playerModifier: 100 } })
    expect(gather.calcTPS()).toBe(10) // min(10, 100/5=20)
  })
})

describe('gather.calcMaxTraps — L1a golden master (trap-buffer target)', () => {
  it('world===1 seeds maxZoneDuration to the current zone-seconds', () => {
    ;(globalThis as any).getZoneSeconds = () => 40
    ;(globalThis as any).game = makeMinimalGame({ global: { world: 1, playerModifier: 20 } })
    // maxZoneDuration = 40 (world 1 arm); ceil(calcTPS()=4 * 40 / 4) = ceil(40) = 40
    expect(gather.calcMaxTraps()).toBe(40)
  })
  it('grows the remembered max-zone-duration when the current zone lasts longer', () => {
    ;(globalThis as any).getZoneSeconds = () => 80
    ;(globalThis as any).game = makeMinimalGame({ global: { world: 5, playerModifier: 20 } })
    // world!==1; 80 > remembered 40 → maxZoneDuration=80; ceil(4*80/4)=80
    expect(gather.calcMaxTraps()).toBe(80)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — manualLabor2 (U1 gather actuator)  — spy setGather / safeBuyBuilding, assert ordered log
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('gather.manualLabor2 — L1b actuator spy-log (U1 gather)', () => {
  // Leaf stubs shared across manualLabor2 tests. Each test overrides `game` + settings + a few of
  // these to arm one decision path. Defaults keep trapping relevant + not-wasted so the trap arms
  // are reachable when a test wants them.
  beforeEach(() => {
    installSpies()
    ;(globalThis as any).getZoneSeconds = () => 40
    ;(globalThis as any).breedingPS = () => ({ div: () => ({ lt: () => true }) })
    ;(globalThis as any).breedTimeRemaining = () => ({ gte: () => true, lte: () => false })
    ;(globalThis as any).DecimalBreed = (_n: number) => ({})
    ;(globalThis as any).challengeActive = vi.fn((_w: string) => false) // the helper fn (boolean)
    ;(globalThis as any).bwRewardUnlocked = () => false
    ;(globalThis as any).getPlayerModifier = () => 50
    ;(globalThis as any).canAffordBuilding = () => true
    ;(globalThis as any).isBuildingInQueue = () => false
    ;(globalThis as any).getPerSecBeforeManual = () => 1
    ;(globalThis as any).getPsString = () => 1
    ;(globalThis as any).trimpsEffectivelyEmployed = () => 0
    ;(globalThis as any).scienceNeeded = 0
    ;(globalThis as any).breedFire = false
    setupDOM()
  })

  // Fully-populated game so no NaN/undef leaks; each test overrides the fields it arms.
  function baseGame(over: Record<string, unknown> = {}) {
    return makeMinimalGame({
      global: {
        playerModifier: 50, world: 50, challengeActive: '', lastClearedCell: 10,
        totalHeliumEarned: 1e9, buildingsQueue: [], autoCraftModifier: 0,
        playerGathering: 'metal', turkimpTimer: 0, mapsUnlocked: true,
      },
      resources: {
        trimps: { owned: 100, realMax: () => 100 },
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 },
        science: { owned: 1e9 },
      },
      jobs: {
        Geneticist: { owned: 5 },
        Farmer: { owned: 1, modifier: 1 },
        Lumberjack: { owned: 1, modifier: 1 },
        Miner: { owned: 1, modifier: 1 },
      },
      buildings: { Trap: { owned: 100 } },
      upgrades: { Battle: { done: true }, Scientists: { done: true }, Miners: { done: true } },
      triggers: { wood: { done: true } },
      talents: { turkimp2: { purchased: false } },
      portal: { Bait: { level: 0 } },
      ...over,
    })
  }

  it('ManualGather2 == 0 → early return, no gather set', () => {
    ;(globalThis as any).autoTrimpSettings = { ManualGather2: { type: 'multitoggle', value: 0 } }
    ;(globalThis as any).game = baseGame()
    gather.manualLabor2()
    expect(gatherCalls).toEqual([])
  })

  it('early-game food priority (world<=3, low helium, empty queue, food<10) → setGather("food")', () => {
    // drives L79 buildingsQueue.length===0 + playerGathering!=="trimps" + Trap.owned===0
    ;(globalThis as any).autoTrimpSettings = { ManualGather2: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 2, challengeActive: '', lastClearedCell: 10,
        totalHeliumEarned: 0, buildingsQueue: [], autoCraftModifier: 0,
        playerGathering: 'metal', turkimpTimer: 0, mapsUnlocked: true,
      },
      resources: {
        trimps: { owned: 100, realMax: () => 100 },
        food: { owned: 5 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 1e9 },
      },
      buildings: { Trap: { owned: 0 } },
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['food'])
  })

  it('early-game wood priority (food>=10, wood.done, wood<10) → setGather("wood")', () => {
    ;(globalThis as any).autoTrimpSettings = { ManualGather2: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 2, challengeActive: '', lastClearedCell: 10,
        totalHeliumEarned: 0, buildingsQueue: [], autoCraftModifier: 0,
        playerGathering: 'metal', turkimpTimer: 0, mapsUnlocked: true,
      },
      resources: {
        trimps: { owned: 100, realMax: () => 100 },
        food: { owned: 50 }, wood: { owned: 5 }, metal: { owned: 1000 }, science: { owned: 1e9 },
      },
      buildings: { Trap: { owned: 0 } },
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['wood'])
  })

  it('high-priority trapping bait (Trapper challenge, has traps) → setGather("trimps")', () => {
    // drives L41 challengeActive==="Trapper", L42 Geneticist.owned===0, L74 playerGathering==="trimps"
    ;(globalThis as any).autoTrimpSettings = {
      ManualGather2: { type: 'multitoggle', value: 1 },
      TrapTrimps: { type: 'boolean', enabled: true },
    }
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 50, challengeActive: 'Trapper', lastClearedCell: 10,
        totalHeliumEarned: 1e9, buildingsQueue: [], autoCraftModifier: 0,
        playerGathering: 'trimps', turkimpTimer: 0, mapsUnlocked: true,
      },
      resources: {
        trimps: { owned: 10, realMax: () => 100 }, // notFullPop true (owned < realMax)
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 1e9 },
      },
      jobs: { Geneticist: { owned: 0 }, Farmer: { owned: 1, modifier: 1 }, Lumberjack: { owned: 1, modifier: 1 }, Miner: { owned: 1, modifier: 1 } },
      buildings: { Trap: { owned: 100 } }, // not lowOnTraps, trapsReady arms trapBuffering false
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['trimps'])
  })

  it('build priority (no Foremany, 2 queued) → setGather("buildings")', () => {
    // drives L100 autoCraftModifier===0 + buildingsQueue[0]!=="Trap.1"
    ;(globalThis as any).autoTrimpSettings = { ManualGather2: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 50, challengeActive: '', lastClearedCell: 10,
        totalHeliumEarned: 1e9, buildingsQueue: ['Hut.1', 'Hut.1'], autoCraftModifier: 0,
        playerGathering: 'metal', turkimpTimer: 0, mapsUnlocked: true,
      },
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['buildings'])
  })

  it('storage-building priority (Barn.1 on top of queue) → setGather("buildings")', () => {
    // drives L106 buildingsQueue[0]==="Barn.1"
    ;(globalThis as any).autoTrimpSettings = { ManualGather2: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 50, challengeActive: '', lastClearedCell: 10,
        totalHeliumEarned: 1e9, buildingsQueue: ['Barn.1'], autoCraftModifier: 5,
        playerGathering: 'metal', turkimpTimer: 0, mapsUnlocked: true,
      },
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['buildings'])
  })

  it('highest-priority research (needBattle) → setGather("science")', () => {
    // drives L62 challengeActive!=="Scientist" + L66 challengeActive("Metal")===false (needMiner arm)
    ;(globalThis as any).autoTrimpSettings = { ManualGather2: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 50, challengeActive: '', lastClearedCell: 10,
        totalHeliumEarned: 1e9, buildingsQueue: [], autoCraftModifier: 0,
        playerGathering: 'metal', turkimpTimer: 0, mapsUnlocked: true,
      },
      resources: {
        trimps: { owned: 100, realMax: () => 100 },
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 5 },
      },
      upgrades: { Battle: { done: false }, Scientists: { done: true }, Miners: { done: true } },
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['science'])
  })

  it('needMiner resource gather (metal<100) → setGather("metal")', () => {
    ;(globalThis as any).autoTrimpSettings = { ManualGather2: { type: 'multitoggle', value: 2 } } // !=2 research suppressed
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 50, challengeActive: '', lastClearedCell: 10,
        totalHeliumEarned: 1e9, buildingsQueue: [], autoCraftModifier: 0,
        playerGathering: 'metal', turkimpTimer: 0, mapsUnlocked: true,
      },
      resources: {
        trimps: { owned: 100, realMax: () => 100 },
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 50 }, science: { owned: 1e9 },
      },
      upgrades: { Battle: { done: true }, Scientists: { done: true }, Miners: { done: false } },
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['metal'])
  })

  it('Metal challenge before maps unlocked → setGather("metal")', () => {
    // drives L124 challengeActive("Metal") true path
    ;(globalThis as any).challengeActive = vi.fn((w: string) => w === 'Metal')
    ;(globalThis as any).autoTrimpSettings = { ManualGather2: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 50, challengeActive: 'Metal', lastClearedCell: 10,
        totalHeliumEarned: 1e9, buildingsQueue: [], autoCraftModifier: 0,
        playerGathering: 'metal', turkimpTimer: 0, mapsUnlocked: false,
      },
      upgrades: { Battle: { done: true }, Scientists: { done: true }, Miners: { done: true } },
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['metal'])
  })

  it('turkimp active → setGather("metal")', () => {
    ;(globalThis as any).autoTrimpSettings = { ManualGather2: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 50, challengeActive: '', lastClearedCell: 10,
        totalHeliumEarned: 1e9, buildingsQueue: [], autoCraftModifier: 0,
        playerGathering: 'metal', turkimpTimer: 30, mapsUnlocked: true,
      },
      talents: { turkimp2: { purchased: false } },
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['metal'])
  })

  it('untouched-mess fallback: no workers for a visible resource → setGather(lowestResource)', () => {
    // drives L174 visibility!=="hidden", L186 lowestResourceRate===-1, L195 playerGathering!==lowestResource
    ;(globalThis as any).autoTrimpSettings = { ManualGather2: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 50, challengeActive: '', lastClearedCell: 10,
        totalHeliumEarned: 1e9, buildingsQueue: [], autoCraftModifier: 0,
        playerGathering: 'science', turkimpTimer: 0, mapsUnlocked: true,
      },
      jobs: {
        Geneticist: { owned: 5 },
        Farmer: { owned: 0, modifier: 1 }, // rate 0 → no workers → food is lowest
        Lumberjack: { owned: 5, modifier: 1 },
        Miner: { owned: 5, modifier: 1 },
      },
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['food'])
  })

  // ── converted-operator live-evaluation closers (review gap: short-circuit shielded these) ───────

  it('COVER L50 Geneticist.owned===0 live: TrapTrimps on + NON-Trapper challenge → bait', () => {
    // Non-Trapper ⇒ trapperTrapUntilFull false ⇒ the `|| Geneticist.owned === 0` operand is
    // actually evaluated (the Trapper test short-circuits it). Geneticist.owned 0 → trapTrimpsOK true.
    ;(globalThis as any).autoTrimpSettings = {
      ManualGather2: { type: 'multitoggle', value: 1 },
      TrapTrimps: { type: 'boolean', enabled: true },
    }
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 50, challengeActive: '', lastClearedCell: 10, // NON-Trapper
        totalHeliumEarned: 1e9, buildingsQueue: [], autoCraftModifier: 0,
        playerGathering: 'metal', turkimpTimer: 0, mapsUnlocked: true,
      },
      resources: {
        trimps: { owned: 2, realMax: () => 100 }, // notFullPop true; breedingTrimps=2 < 4
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 1e9 },
      },
      jobs: { Geneticist: { owned: 0 }, Farmer: { owned: 1, modifier: 1 }, Lumberjack: { owned: 1, modifier: 1 }, Miner: { owned: 1, modifier: 1 } },
      buildings: { Trap: { owned: 100 } }, // not lowOnTraps; trapsReady → trapBuffering false → bait
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['trimps'])
  })

  it('COVER L81 playerGathering==="trimps" live: breedTimeRemaining().gte false forces the OR', () => {
    // gte()=>false (shared stub is true → short-circuits) ⇒ trapWontBeWasted evaluates
    // `playerGathering === "trimps" && lte(...)`.
    ;(globalThis as any).breedTimeRemaining = () => ({ gte: () => false, lte: () => true })
    ;(globalThis as any).autoTrimpSettings = {
      ManualGather2: { type: 'multitoggle', value: 1 },
      TrapTrimps: { type: 'boolean', enabled: true },
    }
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 50, challengeActive: 'Trapper', lastClearedCell: 10,
        totalHeliumEarned: 1e9, buildingsQueue: [], autoCraftModifier: 0,
        playerGathering: 'trimps', turkimpTimer: 0, mapsUnlocked: true,
      },
      resources: {
        trimps: { owned: 10, realMax: () => 100 }, // notFullPop true → trapperTrapUntilFull true
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 1e9 },
      },
      jobs: { Geneticist: { owned: 0 }, Farmer: { owned: 1, modifier: 1 }, Lumberjack: { owned: 1, modifier: 1 }, Miner: { owned: 1, modifier: 1 } },
      buildings: { Trap: { owned: 100 } },
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['trimps'])
  })

  it('COVER L86 Trap.owned===0 live: early-game with playerGathering==="trimps" → food', () => {
    // playerGathering "trimps" makes `playerGathering !== 'trimps'` false, so the early-game guard
    // actually evaluates `Trap.owned === 0` (all other early-game tests gather 'metal').
    ;(globalThis as any).autoTrimpSettings = { ManualGather2: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 2, challengeActive: '', lastClearedCell: 10,
        totalHeliumEarned: 0, buildingsQueue: [], autoCraftModifier: 0,
        playerGathering: 'trimps', turkimpTimer: 0, mapsUnlocked: true,
      },
      resources: {
        trimps: { owned: 100, realMax: () => 100 },
        food: { owned: 5 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 1e9 },
      },
      buildings: { Trap: { owned: 0 } },
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['food'])
  })

  it('COVER L107 buildingsQueue[0]!=="Trap.1" live: getPlayerModifier()>100 opens the operand → buildings', () => {
    // length<=1 and autoCraftModifier!==0 make the first two OR-clauses false; getPlayerModifier()
    // >100 then forces `buildingsQueue[0] !== 'Trap.1'` to actually evaluate (stub is 50 elsewhere).
    ;(globalThis as any).getPlayerModifier = () => 150
    ;(globalThis as any).autoTrimpSettings = { ManualGather2: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = baseGame({
      global: {
        playerModifier: 50, world: 50, challengeActive: '', lastClearedCell: 10,
        totalHeliumEarned: 1e9, buildingsQueue: ['Hut.1'], autoCraftModifier: 5, // 'Hut.1' !== 'Trap.1' → true
        playerGathering: 'metal', turkimpTimer: 0, mapsUnlocked: true,
      },
    })
    gather.manualLabor2()
    expect(gatherCalls).toEqual(['buildings'])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — autogather3 (build-vs-metal toggle)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('gather.autogather3 — L1b actuator spy-log', () => {
  beforeEach(() => installSpies())

  it('gathermetal off + short queue → setGather("metal")', () => {
    ;(globalThis as any).autoTrimpSettings = { gathermetal: { type: 'boolean', enabled: false } }
    ;(globalThis as any).game = makeMinimalGame({ global: { buildingsQueue: [] } })
    gather.autogather3()
    expect(gatherCalls).toEqual(['metal'])
  })

  it('gathermetal on → setGather("metal") regardless of queue', () => {
    ;(globalThis as any).autoTrimpSettings = { gathermetal: { type: 'boolean', enabled: true } }
    ;(globalThis as any).game = makeMinimalGame({ global: { buildingsQueue: ['A', 'B', 'C'] } })
    gather.autogather3()
    expect(gatherCalls).toEqual(['metal'])
  })

  it('gathermetal off + long queue → setGather("buildings")', () => {
    ;(globalThis as any).autoTrimpSettings = { gathermetal: { type: 'boolean', enabled: false } }
    ;(globalThis as any).game = makeMinimalGame({ global: { buildingsQueue: ['A', 'B'] } })
    gather.autogather3()
    expect(gatherCalls).toEqual(['buildings'])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// L1b — RmanualLabor2 (U2 gather actuator else-if ladder)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('gather.RmanualLabor2 — L1b actuator spy-log (U2 gather)', () => {
  beforeEach(() => {
    installSpies()
    ;(globalThis as any).canAffordBuilding = () => true
    ;(globalThis as any).trimpsEffectivelyEmployed = () => 0
    ;(globalThis as any).getPlayerModifier = () => 50
    ;(globalThis as any).getPerSecBeforeManual = () => 1
    ;(globalThis as any).questcheck = vi.fn(() => 0)
    ;(globalThis as any).RsmithyCalc = () => 'wood'
    ;(globalThis as any).RscienceNeeded = 1000
    ;(globalThis as any).Rshouldhypofarm = false
    ;(globalThis as any).Rshouldshipfarm = false
    ;(globalThis as any).Rshouldtimefarm = false
    ;(globalThis as any).Rshouldsmithyfarm = false
    ;(globalThis as any).Rshouldtributefarm = false
    setupDOM()
  })

  // Post-fresh game (Battle done, Scientists/Miners done) so the ELSE-IF ladder is reachable.
  function baseGame(over: Record<string, unknown> = {}) {
    return makeMinimalGame({
      global: {
        world: 50, challengeActive: '', buildingsQueue: [], playerGathering: 'metal',
        turkimpTimer: 0, totalRadonEarned: 1e9, trapBuildToggled: false,
        dailyChallenge: { seed: 0 }, runningChallengeSquared: false,
      },
      resources: {
        trimps: { owned: 100, max: 100, realMax: () => 100, getCurrentSend: () => 1 },
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 1e9 },
      },
      buildings: { Trap: { owned: 100 } },
      upgrades: {
        Battle: { done: true },
        Scientists: { allowed: 0, done: 0 },
        Miners: { allowed: 0, done: 0 },
      },
      triggers: { wood: { done: true } },
      talents: { turkimp2: { purchased: false } },
      ...over,
    })
  }

  it('ULTRA FRESH (Battle not done, food<10) → setGather("food")', () => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = baseGame({
      global: { world: 1, challengeActive: '', buildingsQueue: [], playerGathering: 'metal', turkimpTimer: 0, totalRadonEarned: 0, dailyChallenge: { seed: 0 }, runningChallengeSquared: false },
      resources: {
        trimps: { owned: 0, max: 100, realMax: () => 100, getCurrentSend: () => 1 },
        food: { owned: 5 }, wood: { owned: 5 }, metal: { owned: 1000 }, science: { owned: 0 },
      },
      buildings: { Trap: { owned: 0 } },
      upgrades: { Battle: { done: false }, Scientists: { allowed: 0, done: 0 }, Miners: { allowed: 0, done: 0 } },
    })
    gather.RmanualLabor2()
    expect(gatherCalls).toEqual(['food'])
  })

  it('Scientists fresh (Battle done, Scientists allowed & not done, science<100) → setGather("science")', () => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = baseGame({
      resources: {
        trimps: { owned: 100, max: 100, realMax: () => 100, getCurrentSend: () => 1 },
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 50 },
      },
      upgrades: { Battle: { done: true }, Scientists: { allowed: 1, done: 0 }, Miners: { allowed: 0, done: 0 } },
    })
    gather.RmanualLabor2()
    expect(gatherCalls).toEqual(['science'])
  })

  it('fresh-no-radon (world<=3, empty queue, not trapping, no trap) → setGather("food")', () => {
    // drives L260 buildingsQueue.length===0 + playerGathering!=="trimps" + Trap.owned===0
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = baseGame({
      global: { world: 2, challengeActive: '', buildingsQueue: [], playerGathering: 'metal', turkimpTimer: 0, totalRadonEarned: 0, dailyChallenge: { seed: 0 }, runningChallengeSquared: false },
      resources: {
        trimps: { owned: 100, max: 100, realMax: () => 100, getCurrentSend: () => 1 },
        food: { owned: 5 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 1e9 },
      },
      buildings: { Trap: { owned: 0 } },
      triggers: { wood: { done: false } }, // !wood.done → food branch
    })
    gather.RmanualLabor2()
    expect(gatherCalls).toEqual(['food'])
  })

  it('Quest challenge, questcheck()===10 → setGather("food")', () => {
    // drives L270 challengeActive==="Quest" + L271 questcheck()===10
    ;(globalThis as any).questcheck = vi.fn(() => 10)
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = baseGame({
      global: { world: 50, challengeActive: 'Quest', buildingsQueue: [], playerGathering: 'metal', turkimpTimer: 0, totalRadonEarned: 1e9, dailyChallenge: { seed: 0 }, runningChallengeSquared: false },
    })
    gather.RmanualLabor2()
    expect(gatherCalls).toEqual(['food'])
  })

  it('Quest challenge, questcheck()===12 → setGather("metal")', () => {
    ;(globalThis as any).questcheck = vi.fn(() => 12)
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = baseGame({
      global: { world: 50, challengeActive: 'Quest', buildingsQueue: [], playerGathering: 'metal', turkimpTimer: 0, totalRadonEarned: 1e9, dailyChallenge: { seed: 0 }, runningChallengeSquared: false },
    })
    gather.RmanualLabor2()
    expect(gatherCalls).toEqual(['metal'])
  })

  it('MISC low science (RManualGather2 != 2, science < RminScienceAmount) → setGather("science")', () => {
    // drives L355 display!=="none" + visibility!=="hidden"
    ;(globalThis as any).autoTrimpSettings = { RManualGather2: { type: 'multitoggle', value: 1 } }
    ;(globalThis as any).game = baseGame({
      resources: {
        trimps: { owned: 100, max: 100, realMax: () => 100, getCurrentSend: () => 1 },
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 50 },
      },
    })
    gather.RmanualLabor2()
    expect(gatherCalls).toEqual(['science'])
  })

  it('trap build (RTrapTrimps, needToTrap, no traps) → safeBuyBuilding + setGather("buildings")', () => {
    // drives L361 Trap.owned===0 ; safeBuyBuilding returns false so buildings is set
    installSpies(false) // safeBuyBuilding returns false → enters buildings arm
    ;(globalThis as any).canAffordBuilding = () => true
    ;(globalThis as any).trimpsEffectivelyEmployed = () => 0
    ;(globalThis as any).getPlayerModifier = () => 50
    ;(globalThis as any).getPerSecBeforeManual = () => 1
    ;(globalThis as any).questcheck = vi.fn(() => 0)
    ;(globalThis as any).RscienceNeeded = 1000
    ;(globalThis as any).Rshouldhypofarm = false
    ;(globalThis as any).Rshouldshipfarm = false
    ;(globalThis as any).Rshouldtimefarm = false
    ;(globalThis as any).Rshouldsmithyfarm = false
    ;(globalThis as any).Rshouldtributefarm = false
    setupDOM()
    ;(globalThis as any).autoTrimpSettings = {
      RManualGather2: { type: 'multitoggle', value: 2 }, // suppress science arms
      RTrapTrimps: { type: 'boolean', enabled: true },
    }
    ;(globalThis as any).game = baseGame({
      global: { world: 50, challengeActive: '', buildingsQueue: [], playerGathering: 'metal', turkimpTimer: 0, totalRadonEarned: 1e9, trapBuildToggled: false, dailyChallenge: { seed: 0 }, runningChallengeSquared: false },
      resources: {
        trimps: { owned: 0, max: 100, realMax: () => 100, getCurrentSend: () => 1 }, // needToTrap true
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 1e9 },
      },
      buildings: { Trap: { owned: 0 } },
    })
    gather.RmanualLabor2()
    expect(trapBuyArgs).toEqual([['Trap']]) // exact building arg, not just a count
    expect(gatherCalls).toEqual(['buildings'])
    // cross-spy order: the (failed) trap purchase precedes the buildings fallback
    expect(callLog).toEqual(['safeBuyBuilding:Trap', 'setGather:buildings'])
  })

  it('trap bait (RTrapTrimps, needToTrap, has traps) → setGather("trimps")', () => {
    // drives the L365 Trap.owned>0 arm
    ;(globalThis as any).autoTrimpSettings = {
      RManualGather2: { type: 'multitoggle', value: 2 },
      RTrapTrimps: { type: 'boolean', enabled: true },
    }
    ;(globalThis as any).game = baseGame({
      global: { world: 50, challengeActive: '', buildingsQueue: [], playerGathering: 'metal', turkimpTimer: 0, totalRadonEarned: 1e9, trapBuildToggled: false, dailyChallenge: { seed: 0 }, runningChallengeSquared: false },
      resources: {
        trimps: { owned: 0, max: 100, realMax: () => 100, getCurrentSend: () => 1 },
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 1e9 },
      },
      buildings: { Trap: { owned: 50 } },
    })
    gather.RmanualLabor2()
    expect(gatherCalls).toEqual(['trimps'])
  })

  it('storage-building arm (Shed.1 top of queue, trapBuildToggled false) → setGather("buildings")', () => {
    // drives L371 buildingsQueue[0]==="Shed.1"
    ;(globalThis as any).autoTrimpSettings = { RManualGather2: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = baseGame({
      global: { world: 50, challengeActive: '', buildingsQueue: ['Shed.1'], playerGathering: 'metal', turkimpTimer: 0, totalRadonEarned: 1e9, trapBuildToggled: false, dailyChallenge: { seed: 0 }, runningChallengeSquared: false },
      resources: {
        trimps: { owned: 100, max: 100, realMax: () => 100, getCurrentSend: () => 1 }, // needToTrap false
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 1e9 },
      },
      buildings: { Trap: { owned: 100 } },
    })
    gather.RmanualLabor2()
    expect(gatherCalls).toEqual(['buildings'])
  })

  it('science-full metal arm (science>=RscienceNeeded, !Transmute, low modifier + turkimp) → setGather("metal")', () => {
    // drives L374 science>=RscienceNeeded + L375 challengeActive!=="Transmute"
    ;(globalThis as any).getPlayerModifier = () => 1
    ;(globalThis as any).getPerSecBeforeManual = () => 1000
    ;(globalThis as any).autoTrimpSettings = { RManualGather2: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = baseGame({
      global: { world: 50, challengeActive: '', buildingsQueue: [], playerGathering: 'metal', turkimpTimer: 30, totalRadonEarned: 1e9, trapBuildToggled: false, dailyChallenge: { seed: 0 }, runningChallengeSquared: false },
      resources: {
        trimps: { owned: 100, max: 100, realMax: () => 100, getCurrentSend: () => 1 },
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 1e9 },
      },
      buildings: { Trap: { owned: 100 } },
      talents: { turkimp2: { purchased: true } }, // hasTurkimp
    })
    gather.RmanualLabor2()
    expect(gatherCalls).toEqual(['metal'])
  })

  it('COVER L373 DOM !== checks live: science < 0.8*RscienceNeeded with RManualGather2==2 → science', () => {
    // First MISC arm (L370) needs RManualGather2 != 2 → with ==2 it is skipped, so control reaches
    // L373 whose leading numeric clause (science < RscienceNeeded*0.8=800) is TRUE here (500), forcing
    // the two `display !== 'none'` / `visibility !== 'hidden'` operands to evaluate live (every other
    // RmanualLabor2 test has that leading clause false, short-circuiting them).
    ;(globalThis as any).autoTrimpSettings = { RManualGather2: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = baseGame({
      resources: {
        trimps: { owned: 100, max: 100, realMax: () => 100, getCurrentSend: () => 1 },
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 500 }, // < 800
      },
    })
    gather.RmanualLabor2()
    expect(gatherCalls).toEqual(['science'])
  })

  it('ALL FAIL fallthrough → setGather("metal")', () => {
    // no trap trimps, science satisfied but RManualGather2==2 path, nothing else arms
    ;(globalThis as any).autoTrimpSettings = { RManualGather2: { type: 'multitoggle', value: 2 } }
    ;(globalThis as any).game = baseGame({
      global: { world: 50, challengeActive: '', buildingsQueue: [], playerGathering: 'metal', turkimpTimer: 0, totalRadonEarned: 1e9, trapBuildToggled: false, dailyChallenge: { seed: 0 }, runningChallengeSquared: false },
      resources: {
        trimps: { owned: 100, max: 100, realMax: () => 100, getCurrentSend: () => 1 },
        food: { owned: 1000 }, wood: { owned: 1000 }, metal: { owned: 1000 }, science: { owned: 900 }, // >= RscienceNeeded*0.8=800 (L358 false) and < RscienceNeeded=1000 (L374 false)
      },
      buildings: { Trap: { owned: 100 } },
    })
    gather.RmanualLabor2()
    expect(gatherCalls).toEqual(['metal'])
  })

  // ── #54 regression: dead SHIP-farm block removed ───────────────────────────────────────────────
  // The removed block was an unreachable botched copy of TRIBUTE. These two pin the *reachable*
  // behaviour that made it dead: SHIP-farm's live arm is a hardcoded 'food' (line 300), and TRIBUTE
  // still resolves via the shared function-hoisted `var tributefarmzone` binding after the sibling
  // dead block that also declared it was deleted.
  it('#54 SHIP farm (Rshouldshipfarm) → setGather("food") [live arm, hardcoded — not the deleted block]', () => {
    ;(globalThis as any).Rshouldshipfarm = true
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = baseGame()
    gather.RmanualLabor2()
    expect(gatherCalls).toEqual(['food'])
  })

  it('#54 TRIBUTE farm (Rshouldtributefarm) still resolves per Rtributegatherselection → setGather("metal")', () => {
    ;(globalThis as any).Rshouldtributefarm = true
    ;(globalThis as any).autoTrimpSettings = {
      Rtributefarmzone: { type: 'multiValue', value: [50] }, // getPageSetting → [50]; indexOf(world 50)=0
      Rtributegatherselection: { value: ['metal'] },         // read directly [.value[0]]
    }
    ;(globalThis as any).game = baseGame()
    gather.RmanualLabor2()
    expect(gatherCalls).toEqual(['metal'])
  })
})
