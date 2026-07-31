// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// #313 — `ATGAanticipation()` drives the Anticipation stack cap through the GAME's own geneSend
// option (main.js:5759 pads `lastBreedTime` toward `GeneticistassistSetting` at full population
// whenever `geneSend.enabled === 3`, and main.js:11683 reads exactly that) rather than through
// Geneticists, which cannot reach the cap at the depth they unlock.
//
// WHY HAND-BUILT, NOT baseline-zero: the setting defaults OFF and nothing in the corpus turns it on,
// so the L0 net is vacuous here by construction — citing its green would be the reach-vs-sensitivity
// mistake from #98. And the whole point of this function is that it WRITES TWO GAME-OWNED GLOBALS,
// which makes the restore path (#113's class) the part most worth pinning.
//
// The assertions below aim at the three things a near-miss repair gets wrong — the PREDICATE (which
// states write at all), the WRITTEN VALUE (30 vs 45 vs the cap being hardcoded), and the RESTORE
// TARGET (the captured value vs our own write) — rather than at the presence of the call.

const G = globalThis as any

/** A settings record shaped the way utils.getPageSetting reads it. */
const bool = (v: boolean) => ({ type: 'boolean', enabled: v })

type World = {
  /** The AT setting under test. */
  on?: boolean
  /** `game.jobs.Geneticist.locked` — 0 is unlocked, matching the save format. */
  genLocked?: number
  /** Geneticists are blockU2 (config.js:11920). */
  universe?: number
  /** `game.talents.patience.purchased`, which moves the cap 30 -> 45 (main.js:11684). */
  patience?: boolean
  /** The player's own starting geneSend mode. 0 = "No Gene Sending", the game default. */
  geneSend?: number
  /** The player's own starting Geneticistassist timer. -1 is the unset sentinel. */
  gaTimer?: number
  /** other.ts's flag for "the Spire override currently OWNS GeneticistassistSetting". */
  spirebreeding?: boolean
}

function world({
  on = true,
  genLocked = 0,
  universe = 1,
  patience = false,
  geneSend = 0,
  gaTimer = -1,
  spirebreeding = false,
}: World = {}) {
  const toggleSetting = vi.fn()
  G.toggleSetting = toggleSetting
  G.spirebreeding = spirebreeding
  G.autoTrimpSettings = { ATGAanticipation: bool(on) }
  G.game = {
    jobs: { Geneticist: { locked: genLocked } },
    talents: { patience: { purchased: patience } },
    options: { menu: { geneSend: { enabled: geneSend, titles: ['No Gene Sending', 'Using Gene Send', 'Enforce Gene Send', 'Wait For Gene Send'] } } },
    global: { universe, GeneticistassistSetting: gaTimer },
  }
  return { toggleSetting, game: G.game }
}

/** Fresh module instance per case — `preAntiGeneSend`/`preAntiGaTimer` are module-scoped ON PURPOSE
 *  (#113: a function-scoped var re-initialises to undefined every tick and blanks the restore), so
 *  they leak across tests unless the module itself is re-created. */
async function freshModule() {
  vi.resetModules()
  G.MODULES = {}
  G.Decimal = (await import('decimal.js')).default
  // APPEND, never clobber: tests/setup.ts already seeded #logBtnGroup etc. that the transitive utils
  // import reaches for at load (utils.ts:306). Idempotent because resetModules re-runs the module's
  // load-time addBreedingBoxTimers() against a DOM that jsdom does NOT reset between tests.
  if (!document.getElementById('trimps')) {
    document.body.insertAdjacentHTML('beforeend', `<div id="trimps"><div class="row"></div></div><div id="trimpsFighting"></div>`)
  }
  return await import('../src/modules/breedtimer')
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ATGAanticipation — the Anticipation actuator (#313)', () => {
  it('ON: sets the game to Wait For Gene Send and pins the GA timer to the cap', async () => {
    const { game, toggleSetting } = world()
    const m = await freshModule()

    // Anti-false-green: the fixture must START somewhere the assertions can distinguish. 0 is the
    // game's own default and -1 is the unset sentinel, so neither 3 nor 30 can arrive by accident.
    expect(game.options.menu.geneSend.enabled).toBe(0)
    expect(game.global.GeneticistassistSetting).toBe(-1)

    m.ATGAanticipation()

    expect(game.options.menu.geneSend.enabled).toBe(3)
    expect(game.global.GeneticistassistSetting).toBe(30)
    // updateOnly=true is load-bearing: toggleSetting has no set-to-value form and CYCLES otherwise
    // (updates.js:6543), so a repaint call missing this argument would advance 3 -> 0 every tick.
    expect(toggleSetting).toHaveBeenCalledWith('geneSend', null, false, true)
  })

  it('the written cap tracks the patience talent — 45, not a hardcoded 30', async () => {
    const { game } = world({ patience: true })
    const m = await freshModule()
    m.ATGAanticipation()
    expect(game.global.GeneticistassistSetting).toBe(45)
  })

  it('antiStackCap is the one owner of main.js:11684 for both callers', async () => {
    const m = await freshModule()
    G.game.talents.patience.purchased = false
    expect(m.antiStackCap()).toBe(30)
    G.game.talents.patience.purchased = true
    expect(m.antiStackCap()).toBe(45)
  })

  it('OFF: writes nothing at all', async () => {
    const { game, toggleSetting } = world({ on: false })
    const m = await freshModule()
    m.ATGAanticipation()
    expect(game.options.menu.geneSend.enabled).toBe(0)
    expect(game.global.GeneticistassistSetting).toBe(-1)
    expect(toggleSetting).not.toHaveBeenCalled()
  })

  it('Geneticist still locked: writes nothing', async () => {
    const { game } = world({ genLocked: 1 })
    const m = await freshModule()
    m.ATGAanticipation()
    expect(game.options.menu.geneSend.enabled).toBe(0)
    expect(game.global.GeneticistassistSetting).toBe(-1)
  })

  it('Universe 2: writes nothing — Geneticist is blockU2', async () => {
    const { game } = world({ universe: 2 })
    const m = await freshModule()
    m.ATGAanticipation()
    expect(game.options.menu.geneSend.enabled).toBe(0)
    expect(game.global.GeneticistassistSetting).toBe(-1)
  })

  it('re-running does NOT re-capture — the restore still targets the PLAYER value', async () => {
    // THE FIXTURE HAS TO REACH THE NAMED STATE. Ticking three times in a row cannot exercise the
    // `=== null` latch at all: after tick 1 both `menu.enabled !== 3` and `GeneticistassistSetting
    // !== cap` are false, so the capture lines are unreachable and deleting the latch survives. The
    // state that reaches them is something ELSE moving the values back between ticks — the player
    // flipping the option, or ATspirebreed() writing its own timer — which is the real scenario and
    // the one where an unlatched capture swallows our own write.
    const { game } = world({ geneSend: 1, gaTimer: 7 })
    const m = await freshModule()
    m.ATGAanticipation()
    expect(game.options.menu.geneSend.enabled).toBe(3)
    expect(game.global.GeneticistassistSetting).toBe(30)

    game.options.menu.geneSend.enabled = 0
    game.global.GeneticistassistSetting = 99
    m.ATGAanticipation()
    expect(game.options.menu.geneSend.enabled).toBe(3)
    expect(game.global.GeneticistassistSetting).toBe(30)

    G.autoTrimpSettings.ATGAanticipation = bool(false)
    m.ATGAanticipation()

    // Unlatched, these read 0 and 99 — the transient values, not what the player started with.
    expect(game.options.menu.geneSend.enabled).toBe(1)
    expect(game.global.GeneticistassistSetting).toBe(7)
  })

  it('turning it off restores both game values, then stops touching them', async () => {
    const { game, toggleSetting } = world({ geneSend: 2, gaTimer: 5 })
    const m = await freshModule()
    m.ATGAanticipation()
    expect(game.options.menu.geneSend.enabled).toBe(3)

    G.autoTrimpSettings.ATGAanticipation = bool(false)
    m.ATGAanticipation()
    expect(game.options.menu.geneSend.enabled).toBe(2)
    expect(game.global.GeneticistassistSetting).toBe(5)

    // A second OFF tick must be inert — the #113 bug is a restore that fires again from a capture it
    // never cleared. Note the values: they must be OUR values (3 / the cap), because the restore is
    // guarded on exactly those. Parking them anywhere else lets that guard absorb the missing clear
    // and the mutant survives while the test still reads like it covered this. Concretely: the player
    // chooses Wait For Gene Send themselves after AT let go, and AT must not take it back.
    toggleSetting.mockClear()
    game.options.menu.geneSend.enabled = 3
    game.global.GeneticistassistSetting = 30
    m.ATGAanticipation()
    expect(game.options.menu.geneSend.enabled).toBe(3)
    expect(game.global.GeneticistassistSetting).toBe(30)
    expect(toggleSetting).not.toHaveBeenCalled()
  })

  it('a player who changed the option themselves outranks the restore', async () => {
    const { game } = world({ geneSend: 0, gaTimer: -1 })
    const m = await freshModule()
    m.ATGAanticipation()

    // The player moves it off 3 while AT still holds a capture.
    game.options.menu.geneSend.enabled = 1
    G.autoTrimpSettings.ATGAanticipation = bool(false)
    m.ATGAanticipation()

    expect(game.options.menu.geneSend.enabled).toBe(1)
  })

  it('while the Spire override owns the GA timer, this sets geneSend and leaves the timer alone', async () => {
    const { game } = world({ spirebreeding: true, gaTimer: 12 })
    const m = await freshModule()
    m.ATGAanticipation()

    // geneSend is orthogonal to the timer VALUE, so the lever still works — it just waits on the
    // Spire's number. Two writers on one global is what fights every tick.
    expect(game.options.menu.geneSend.enabled).toBe(3)
    expect(game.global.GeneticistassistSetting).toBe(12)
  })

  it('turning OFF while the Spire override holds the timer must not strand the player value', async () => {
    // Found by review. The two writers hand the value back and forth, and the capture that matters is
    // the one NOT written down anywhere: ATspirebreed() captures whatever is sitting there when the
    // Spire arms, which by then is OUR cap — so it can only ever hand back the cap. The player's real
    // value survives solely in `preAntiGaTimer`, and dropping that latch while the Spire owns the
    // global loses it for good. That is #113's class arriving across a module boundary.
    const { game } = world({ gaTimer: 12 })
    const m = await freshModule()
    m.ATGAanticipation()
    expect(game.global.GeneticistassistSetting).toBe(30)

    // ATspirebreed() takes over (other.ts:195): it stashes our 30 as `prespiretimer` and writes the
    // Spire's own timer.
    G.spirebreeding = true
    game.global.GeneticistassistSetting = 55

    G.autoTrimpSettings.ATGAanticipation = bool(false)
    m.ATGAanticipation()
    // We must not fight the Spire for the global while it is in charge.
    expect(game.global.GeneticistassistSetting).toBe(55)

    // Spire ends. ATspirebreed() restores what IT captured — our cap, not the player's 12 — and clears
    // its own flag in the same tick. The next tick is ours, and it is the last chance to put 12 back.
    G.spirebreeding = false
    game.global.GeneticistassistSetting = 30
    m.ATGAanticipation()
    expect(game.global.GeneticistassistSetting).toBe(12)
  })

  it('a player who later parks the GA timer ON the cap value is not clobbered by a stale capture', async () => {
    // THE OTHER HALF OF THE FIX ABOVE, and the reason the discrimination is `spirebreeding` rather than
    // "did the write fire". The obvious repair for the strand bug — clear the latch only when the
    // restore actually happens — SURVIVED this file before this test existed, and it is wrong: a
    // restore skipped because the PLAYER moved the value has to drop the latch, or the capture lies in
    // wait and steals their next deliberate choice. 30 is an ordinary Geneticistassist timer, so
    // "they set it to exactly our cap" is a normal Tuesday, not a contrived state.
    const { game } = world({ gaTimer: 12 })
    const m = await freshModule()
    m.ATGAanticipation()
    expect(game.global.GeneticistassistSetting).toBe(30)

    // Player takes the wheel, then turns the feature off. No Spire anywhere — nobody else owns this.
    game.global.GeneticistassistSetting = 8
    G.autoTrimpSettings.ATGAanticipation = bool(false)
    m.ATGAanticipation()
    expect(game.global.GeneticistassistSetting).toBe(8)

    // Much later they choose 30 for their own reasons. AT is off and must stay out of it.
    game.global.GeneticistassistSetting = 30
    m.ATGAanticipation()
    m.ATGAanticipation()
    expect(game.global.GeneticistassistSetting).toBe(30)
  })

  it('when the Spire override releases, this takes the timer over', async () => {
    const { game } = world({ spirebreeding: true, gaTimer: 12 })
    const m = await freshModule()
    m.ATGAanticipation()
    expect(game.global.GeneticistassistSetting).toBe(12)

    G.spirebreeding = false
    m.ATGAanticipation()
    expect(game.global.GeneticistassistSetting).toBe(30)
  })
})
