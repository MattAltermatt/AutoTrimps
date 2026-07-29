// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #176 — an UNSET "Max BW to raid" was read as a ceiling of -1, so BW Raiding declared victory
// instantly and raided nothing.
//
// `BWraidingmax` ships as `multiValue [-1]` (settings-defs.ts:1696-1698), and a max list shorter than
// the zone list yields `undefined` for the trailing zones. Both collapsed to `targetBW = -1`. Bionic
// Wonderland levels are `tier * 15 + 125` >= 125 (config.js:9810), so `findLastBionic().level >
// targetBW` was true on the very first tick: AT set AutoMaps to 0, took the game's Climb BW option,
// entered the Map Chamber, printed "Beginning BW Raiding..." and "...Successfully BW raided!" in the
// same breath, and acquired zero prestige gear. `bwraidon` never latched, so `buyWeps()` never ran.
// `settings-visibility.ts:578-579` reveals BWraidingz and BWraidingmax together under BWraid, so the
// default is the trap: turn the feature on, fill in the zone, and it silently does nothing forever.
//
// WHY -1 IS NOT "INFINITE" HERE, however much AT's own multiValue dialog says so
// (settings-engine.ts:386 renders " Put -1 for Infinite." for every such setting). The raid ends on
// `findLastBionic().level > targetBW`, and clearing a BW is what creates the NEXT tier
// (config.js:9815, `roboTrimp.fire` → `createMap(bionicTier)`, +15 levels). An infinite ceiling
// therefore never terminates: once the chain stops producing maps at `getObsidianStart() + 100`, the
// top level stops climbing and AT re-runs the last BW until portal. A hang is a worse bug than the
// no-op it would replace, so an unset max is treated as "this zone is not configured": skip it, say
// so once, and leave AutoMaps and Climb BW alone. (User decision, 2026-07-28.)

let praiding: typeof import('../src/modules/other-praiding')

const g = globalThis as any
const RAID_ZONE = 597

const setMV = (id: string, value: unknown) => {
  g.autoTrimpSettings[id] = { type: 'multiValue', value }
}
const logText = () => (document.getElementById('log') as HTMLElement).innerHTML

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
    SpamMaps: { type: 'boolean', enabled: true },
  }
  setMV('BWraidingz', [RAID_ZONE])
  setMV('bwraidcell', [-1])

  g.game = {
    global: {
      world: RAID_ZONE,
      lastClearedCell: 98,
      challengeActive: '',
      preMapsActive: true,
      mapsActive: false,
      repeatMap: true,
      mapsOwnedArray: [{ id: 'bw1', level: 125, location: 'Bionic', name: 'Bionic Wonderland I' }],
    },
    resources: { fragments: { owned: Infinity } },
    options: {
      menu: { climbBw: { enabled: 1 }, repeatUntil: { enabled: 0 }, timestamps: { enabled: 0 } },
    },
  }
  g.toggleSetting = () => {}
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
  g.game.global.challengeActive = ''
})

describe('an unset Max BW skips the zone instead of faking a raid (#176)', () => {
  it.each([
    ['the shipped default', [-1]],
    ['a max list shorter than the zone list', []],
  ])('%s: no success message, no state taken', (_label, maxList) => {
    setMV('BWraidingmax', maxList)
    praiding.BWraiding()

    // FAILED BEFORE THE FIX on all five. `-1` (and `undefined`) made `125 > targetBW` true on the
    // first tick, so the completion arm fired immediately.
    expect(g.bwraided).toBe(false)
    expect(logText()).not.toContain('Successfully BW raided')
    // ...and nothing was taken hostage for a raid that is not happening.
    expect(g.autoTrimpSettings.AutoMaps.value).toBe(1)
    expect(g.game.options.menu.climbBw.enabled).toBe(1)
    expect(g.game.options.menu.repeatUntil.enabled).toBe(0)
  })

  it('says WHY, once per zone, naming the setting to fill in', () => {
    // A zone no other test here uses: the warning latch is keyed by zone (so it re-arms at the next
    // raid zone), and sharing one would make this test's result depend on file order.
    const ZONE = 611
    g.game.global.world = ZONE
    setMV('BWraidingz', [ZONE])
    setMV('BWraidingmax', [-1])
    praiding.BWraiding()
    expect(logText()).toContain('Max BW')

    const after = logText()
    praiding.BWraiding()
    praiding.BWraiding()
    expect(logText()).toBe(after) // once per zone — BWraiding runs at 10Hz
  })

  it('a CONFIGURED zone is unaffected — the raid still runs', () => {
    // The failure mode of this fix is turning BW Raiding off for everybody, so pin the working case.
    setMV('BWraidingmax', [1000])
    praiding.BWraiding()

    expect(logText()).toContain('Beginning BW Raiding')
    expect(g.bwraidon).toBe(true) // the map was actually run
    expect(g.autoTrimpSettings.AutoMaps.value).toBe(0)
    expect(g.game.options.menu.climbBw.enabled).toBe(0)
  })

  it('a ceiling of 0 is still a real ceiling, not "unset"', () => {
    // `0` is a legitimate value the user can type and it is below every BW level, so it means "raid
    // nothing here" — which the raid expresses by completing immediately. Folding it in with -1 would
    // be the classic sentinel over-reach (#150's `== 0` lesson, one setting over).
    setMV('BWraidingmax', [0])
    praiding.BWraiding()
    expect(g.bwraided).toBe(true)
    expect(logText()).toContain('Successfully BW raided')
  })

  it('the Daily path skips on its OWN settings, and does not share the normal path\'s warning latch', () => {
    // BWraiding() branches its whole setting triple on `challengeActive == "Daily"`, so a zone number
    // that appears in BOTH BWraidingz and dBWraidingz has two independent raids. The dedup latch has
    // to know that: keyed by zone alone, whichever context reached the zone first would silence the
    // other's only diagnostic for the rest of the session. (Caught by review — the #227 sibling in
    // mapfunctions-amp.ts was already split this way and this one was not, and nothing here exercised
    // the Daily path at all.)
    const ZONE = 623
    g.game.global.world = ZONE
    g.autoTrimpSettings.Dailybwraid = { type: 'boolean', enabled: true }
    setMV('BWraidingz', [ZONE])
    setMV('BWraidingmax', [-1])
    setMV('dBWraidingz', [ZONE])
    setMV('dBWraidingmax', [-1])
    setMV('dbwraidcell', [-1])

    praiding.BWraiding() // non-Daily
    const afterNormal = logText()
    expect(afterNormal).toContain('Max BW')

    g.game.global.challengeActive = 'Daily'
    praiding.BWraiding() // the Daily raid at the same zone number — its own warning is still owed
    expect(logText().length).toBeGreaterThan(afterNormal.length)

    // ...and each context still dedups within itself.
    const afterBoth = logText()
    praiding.BWraiding()
    g.game.global.challengeActive = ''
    praiding.BWraiding()
    expect(logText()).toBe(afterBoth)
  })

  it('the Daily path skips on the Daily settings even when the normal ones are configured', () => {
    // The mirror: a configured non-Daily zone must not make an unconfigured Daily zone look configured.
    const ZONE = 631
    g.game.global.world = ZONE
    g.game.global.challengeActive = 'Daily'
    g.autoTrimpSettings.Dailybwraid = { type: 'boolean', enabled: true }
    setMV('BWraidingz', [ZONE])
    setMV('BWraidingmax', [1000]) // the NON-daily pair is fully configured
    setMV('dBWraidingz', [ZONE])
    setMV('dBWraidingmax', [-1]) // ...and the Daily pair is not
    setMV('dbwraidcell', [-1])

    praiding.BWraiding()

    expect(g.bwraided).toBe(false)
    expect(logText()).toContain('Max BW')
    expect(logText()).not.toContain('Beginning BW Raiding')
  })

  it('a zone NOT in the raid list is untouched by the skip path', () => {
    setMV('BWraidingmax', [-1])
    g.game.global.world = RAID_ZONE + 1
    praiding.BWraiding()
    expect(logText()).toBe('') // no message for a zone that was never going to raid
  })
})

// ── #178 — the zone→max pairing, now shared with main-loop.ts's buyWeps dispatch ────────────────
//
// main-loop.ts:416 used to read `game.global.world == getPageSetting('BWraidingz')`: a NUMBER against
// a multiValue ARRAY, with the operands reversed so the #162 net (which requires the getPageSetting
// call on the LEFT) could not see it at all. `495 == [480,495]` coerces via ToPrimitive to the string
// "480,495", then to NaN, so it is FALSE — the dispatch fired only for a single-entry list, and never
// for the multi-entry form the setting's own tooltip documents as the example.
describe('bwRaidTargetFor pairs a zone with the max on its own row (#178)', () => {
  // The helper takes the RESOLVED lists, not the ids — see its docblock: taking ids would hide two
  // getPageSetting callsites from the #68 settings-reverse net.
  const getPageSetting = (id: string) => {
    const s = g.autoTrimpSettings[id]
    return s?.type === 'multiValue' ? Array.from(s.value).map((x) => parseInt(x as string)) : s?.value
  }

  beforeEach(() => {
    setMV('BWraidingz', [480, 495])
    setMV('BWraidingmax', [500, 515])
  })

  it('each zone gets the ceiling at its OWN index', () => {
    expect(praiding.bwRaidTargetFor(480, getPageSetting('BWraidingz'), getPageSetting('BWraidingmax'))).toBe(500)
    expect(praiding.bwRaidTargetFor(495, getPageSetting('BWraidingz'), getPageSetting('BWraidingmax'))).toBe(515)
  })

  it('a zone not in the list has no ceiling', () => {
    expect(praiding.bwRaidTargetFor(490, getPageSetting('BWraidingz'), getPageSetting('BWraidingmax'))).toBeUndefined()
  })

  // The multi-entry case is the whole bug: pre-fix, the SECOND entry was unreachable.
  it('the second entry is reachable — it was not, before', () => {
    expect(praiding.bwRaidTargetFor(495, getPageSetting('BWraidingz'), getPageSetting('BWraidingmax'))).toBeDefined()
  })

  it('a max list shorter than the zone list leaves the trailing zones unconfigured', () => {
    setMV('BWraidingmax', [500])
    expect(praiding.bwRaidTargetFor(480, getPageSetting('BWraidingz'), getPageSetting('BWraidingmax'))).toBe(500)
    expect(praiding.bwRaidTargetFor(495, getPageSetting('BWraidingz'), getPageSetting('BWraidingmax'))).toBeUndefined()
  })

  // #176's rule, enforced in the shared helper so BOTH callers get it: an unset max is NOT infinite.
  it('the -1 sentinel is unconfigured, not an infinite ceiling', () => {
    setMV('BWraidingmax', [-1, 515])
    expect(praiding.bwRaidTargetFor(480, getPageSetting('BWraidingz'), getPageSetting('BWraidingmax'))).toBeUndefined()
    expect(praiding.bwRaidTargetFor(495, getPageSetting('BWraidingz'), getPageSetting('BWraidingmax'))).toBe(515)
  })

  it('a NaN max is unconfigured too', () => {
    setMV('BWraidingmax', ['', 515])
    expect(praiding.bwRaidTargetFor(480, getPageSetting('BWraidingz'), getPageSetting('BWraidingmax'))).toBeUndefined()
  })

  it('the Daily settings pair the same way', () => {
    setMV('dBWraidingz', [495, 510])
    setMV('dBWraidingmax', [515, 530])
    expect(praiding.bwRaidTargetFor(510, getPageSetting('dBWraidingz'), getPageSetting('dBWraidingmax'))).toBe(530)
  })

  // The coercion that made the old expression false. Kept as an executable note: it is the reason
  // this is a pairing helper and not a comparison.
  it('documents the coercion the old `world == list` compare hit', () => {
    expect((495 as unknown as number) == ([480, 495] as unknown as number)).toBe(false)
    expect(Number([480, 495])).toBeNaN()
    // …and why a SINGLE-entry list made it look like it worked.
    expect((495 as unknown as number) == ([495] as unknown as number)).toBe(true)
  })
})
