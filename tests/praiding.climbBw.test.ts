// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #191 — AT permanently destroyed the player's Climb BW setting.
//
// `BWraiding()` wrote `game.options.menu.climbBw.enabled = 0` on every tick inside the raid block and
// nothing ever wrote it back: `grep -rn "climbBw" src/` returned exactly one line. `game.options.menu`
// is part of the save, so the first BW raid turned the option off for good — across zones, portals and
// reloads. The `BWraid` tooltip is explicit that this is temporary: "AT turns your game's Climb BW
// option off itself **while this runs**".
//
// The write also skipped `toggleSetting('climbBw', null, false, true)`, which the game pairs with
// every climbBw write of its own (main.js:10907, 13473-13474) to repaint the toggle. Without it the
// in-game button keeps rendering its old title until something else happens to repaint it — so the
// setting AT had silently changed still LOOKED unchanged.

let praiding: typeof import('../src/modules/other-praiding')

const g = globalThis as any
let refreshes: string[] = []

const RAID_ZONE = 597

const setMV = (id: string, value: unknown) => {
  g.autoTrimpSettings[id] = { type: 'multiValue', value }
}
const climbBw = () => g.game.options.menu.climbBw.enabled

beforeAll(async () => {
  g.MODULES = {}
  g.autoTrimpSettings = {}
  g.getPlayerCritChance = () => 0
  praiding = await import('../src/modules/other-praiding')
})

beforeEach(() => {
  document.body.innerHTML = '<div id="log"></div>'
  g.autoTrimpSettings = {
    AutoMaps: { type: 'multitoggle', value: 1 },
    BWraid: { type: 'boolean', enabled: true },
  }
  setMV('BWraidingz', [RAID_ZONE])
  setMV('BWraidingmax', [640]) // a real ceiling, so the raid can actually complete
  setMV('bwraidcell', [-1])

  g.game = {
    global: {
      world: RAID_ZONE,
      lastClearedCell: 98,
      challengeActive: '',
      preMapsActive: true,
      mapsActive: false,
      repeatMap: true,
      // Bionic Wonderland levels are `tier * 15 + 125` (config.js:9810).
      mapsOwnedArray: [{ id: 'bw1', level: 125, location: 'Bionic', name: 'Bionic Wonderland I' }],
    },
    resources: { fragments: { owned: Infinity } },
    options: {
      menu: {
        climbBw: { enabled: 1 }, // the player has it ON — the thing AT was destroying
        repeatUntil: { enabled: 2 },
        timestamps: { enabled: 0 },
      },
    },
  }
  g.toggleSetting = (name: string) => refreshes.push(name)
  g.selectMap = () => {}
  g.runMap = () => {}
  g.mapsClicked = () => {}
  g.repeatClicked = () => {}
  g.enableDebug = false
  g.ATmessageLogTabVisible = false
  g.lastmessagecount = 0
  g.trimMessages = () => {}
  g.getCurrentTime = () => ''
  g.updatePortalTimer = () => ''
  g.bwraided = false
  g.failbwraid = false
  g.bwraidon = false

  // Drain any suspension the PREVIOUS test left behind. The saved value is module-local state (as it
  // should be — nothing outside other-praiding.ts has business reading it), so it survives between
  // tests in this file; without this, one test's leftover latch silently decides the next test's
  // answer. Running the off-zone backstop is also the honest way to clear it: no test-only API.
  refreshes = []
  g.game.global.world = RAID_ZONE + 5
  praiding.BWraiding()
  g.game.global.world = RAID_ZONE
  g.bwraided = false
  g.failbwraid = false
  g.bwraidon = false
  g.game.options.menu.climbBw.enabled = 1
  refreshes = []
})

describe('BW raiding suspends Climb BW rather than destroying it (#191)', () => {
  it('turns it off during the raid and back on when the raid completes', () => {
    // Completion is `findLastBionic().level > targetBW` — i.e. the highest BW owned is already past
    // the ceiling, so there is nothing left to raid. Level 185 is Bionic Wonderland V
    // (tier * 15 + 125, config.js:9810).
    g.game.global.mapsOwnedArray = [{ id: 'bw5', level: 185, location: 'Bionic', name: 'Bionic Wonderland V' }]
    setMV('BWraidingmax', [150])
    praiding.BWraiding()

    expect(g.bwraided).toBe(true) // the raid really did reach its completion arm
    // FAILED BEFORE THE FIX: climbBw stayed 0 forever, and no repaint was ever requested.
    expect(climbBw()).toBe(1)
    // TWO repaints, not one: the game pairs `toggleSetting('climbBw', …)` with every climbBw write of
    // its own (main.js:10907, 13473-13474), so the restore needs one just as much as the suspend does.
    // Asserting only `toContain` would be satisfied by the suspend's repaint alone, and a restore that
    // silently skipped it would leave the in-game toggle rendering the state AT had just left behind.
    expect(refreshes).toEqual(['climbBw', 'climbBw'])
  })

  it('is OFF while the raid is actually in progress', () => {
    // Not a formality: a repair that simply never touched climbBw would pass the test above.
    setMV('BWraidingmax', [1000]) // ceiling above the owned BW → the raid does not complete this tick
    praiding.BWraiding()

    expect(climbBw()).toBe(0)
    expect(g.bwraided).toBe(false) // still raiding, so the suspension is correct here
    expect(refreshes).toEqual(['climbBw'])
  })

  it('restores it when the run leaves the raid zone with the raid unfinished', () => {
    setMV('BWraidingmax', [1000])
    praiding.BWraiding()
    expect(climbBw()).toBe(0)

    // The backstop: the user switched BWraid off, a Daily started, or the zone simply advanced.
    g.game.global.world = RAID_ZONE + 1
    praiding.BWraiding()

    expect(climbBw()).toBe(1)
  })

  it('restores it when the raid fails for lack of a BW to raid', () => {
    g.game.global.mapsOwnedArray = [] // findLastBionic() finds nothing
    setMV('BWraidingmax', [1000])
    expect(() => praiding.BWraiding()).toThrow() // :1463 dereferences findLastBionic() unguarded

    // The failure arm ran before that throw, and it is the one that must hand the option back.
    expect(climbBw()).toBe(1)
    expect(g.failbwraid).toBe(true)
  })

  it('leaves a player who already had Climb BW OFF exactly where they were', () => {
    // Restore means restore, not "turn on". A repair that hardcodes `= 1` gives the option to someone
    // who never wanted it, and no other test here would notice.
    g.game.options.menu.climbBw.enabled = 0
    setMV('BWraidingmax', [1000])
    praiding.BWraiding()
    expect(climbBw()).toBe(0)
    g.game.global.world = RAID_ZONE + 1
    praiding.BWraiding()
    expect(climbBw()).toBe(0)
    // Nothing ever changed, so nothing ever needed repainting either.
    expect(refreshes).toEqual([])
  })

  it('restores the value it SAVED, even when the player flips the option mid-raid', () => {
    // Pins that the restore writes `savedClimbBw` rather than a hardcoded 1. Without a mid-raid flip
    // the two are indistinguishable — an OFF player never gets written to at all, so a `= 1` repair
    // is invisible. Here the player turns Climb BW on while AT is raiding: AT re-suspends it on the
    // next tick regardless, so the honest end state is the one AT found, which is off.
    g.game.options.menu.climbBw.enabled = 0
    setMV('BWraidingmax', [1000])
    praiding.BWraiding() // suspend: saves 0, writes nothing

    g.game.options.menu.climbBw.enabled = 1 // the player clicks it in the game UI
    g.game.global.world = RAID_ZONE + 1
    praiding.BWraiding()

    expect(climbBw()).toBe(0)
  })

  it('does not re-capture the saved value on the second tick of one raid', () => {
    // The save must happen once. Capturing every tick would record the 0 AT itself just wrote, and the
    // restore would then be a no-op — the original bug wearing a fix's clothes.
    setMV('BWraidingmax', [1000])
    praiding.BWraiding()
    praiding.BWraiding()
    praiding.BWraiding()
    expect(climbBw()).toBe(0)

    g.game.global.world = RAID_ZONE + 1
    praiding.BWraiding()
    expect(climbBw()).toBe(1)
  })
})
