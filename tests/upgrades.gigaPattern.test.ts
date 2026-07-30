// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'
import { isStorableNumber } from '../src/modules/settings-storable'

// #297 — the giga pattern must never be NaN, and the store must never be able to hold it.
//
// Reported live from a real save (P63 Z67): the log filled with "Auto Gigastation: Setting pattern to
// 2+NaN x10", one line per tick forever, AT bought neither Warpstations nor the Gigastation, and the
// settings export showed `DeltaGigastation = null` — the NaN, flattened by JSON.stringify and kept by
// createSetting on every subsequent boot. The reporter's only trigger was `VoidMaps = 60`.
//
// Three layers, and each is driven separately below because each can be broken on its own:
//   1. gigaTargetZone's failsafe rejects a target zone that yields nGigas < 1 (i.e. anything under 61,
//      NaN included) — this is the layer that fixes the reported save.
//   2. autoGiga refuses every remaining non-finite route with a named reason, returning NaN as a
//      documented "no pattern" sentinel, and firstGiga refuses to PERSIST that.
//   3. setPageSetting rejects a non-storable number outright, so no future caller can poison the store
//      the way this one did.
//
// The five routes were confirmed by transcribing autoGiga and driving it with the reported state
// before any code changed: targetZone in [60,61) → nGigas 0 → `delta /= 0`; gemsPS 0 → metalDiff
// Infinity; gemsPS 0 and metalPS 0 → 0/0 → NaN; rawPop 0 → `pop /= 0`; slowDown 0 → Math.log(0).
// All five land on NaN because the last line is a string round-trip: `Infinity + "e+2"` is
// "Infinitye+2", and Math.round of that is NaN.

const g = globalThis as any

let upgrades: typeof import('../src/modules/upgrades')
let utils: typeof import('../src/modules/utils')

beforeAll(async () => {
  g.MODULES = {}
  g.autoTrimpSettings = {}
  upgrades = await import('../src/modules/upgrades')
  utils = await import('../src/modules/utils')
})

/** The reporter's state: zone 67, 2 Warpstations, no Gigastation, healthy gem/metal income. */
function reportedSave(over: Record<string, unknown> = {}) {
  g.game = makeMinimalGame({
    global: {
      world: 67, frugalDone: false, challengeActive: '', runningChallengeSquared: false,
      highestLevelCleared: 67, mapBonus: 0, lastWarp: false,
    },
    buildings: { Warpstation: { owned: 2 } },
    upgrades: { Gigastation: { done: 0, allowed: 5 } },
    resources: { trimps: { max: 3.9e6 } },
    unlocks: { impCount: { TauntimpAdded: 0 } },
    challenges: {},
    options: { menu: { timestamps: { enabled: 0 } } },
    ...over,
  })
  g.getPerSecBeforeManual = (job: string) => (job === 'Miner' ? 1e9 : 1e5)
  g.canAffordCoordinationTrimps = () => false
  g.canAffordTwoLevel = () => true
  g.enoughHealth = true
  g.enoughDamage = true
  g.enableDebug = false
  g.ATmessageLogTabVisible = false
  g.lastmessagecount = 0
  g.trimMessages = () => {}
  g.getCurrentTime = () => ''
  g.updatePortalTimer = () => ''
  document.body.innerHTML = '<div id="log"></div>'
}

/** The reporter's settings export, verbatim in the fields that matter. */
function reportedSettings(over: Record<string, unknown> = {}) {
  g.autoTrimpSettings = {
    AutoPortal: { selected: 'Off' },
    VoidMaps: { type: 'value', value: 60 }, // THE TRIGGER
    DailyVoidMod: { type: 'value', value: -1 },
    c2runnerstart: { type: 'boolean', enabled: false },
    FinishC2: { type: 'value', value: -1 },
    CustomDeltaFactor: { type: 'value', value: '-1' },
    CustomTargetZone: { type: 'value', value: '-1' },
    beforegen: { type: 'multitoggle', value: 1 },
    fuellater: { type: 'value', value: -1 },
    FirstGigastation: { type: 'value', value: 2 },
    DeltaGigastation: { type: 'value', value: 3.5 }, // a healthy stored pattern to protect
    MaxMapBonushealth: { type: 'value', value: 10 },
    MaxMapBonuslimit: { type: 'value', value: 10 },
    ...over,
  }
}

/** Turn the general-spam log on and hand back the #log element the messages land in. */
function watchLog(): HTMLElement {
  g.autoTrimpSettings.SpamGeneral = { type: 'boolean', enabled: true }
  return document.getElementById('log') as HTMLElement
}

afterEach(() => {
  for (const k of [
    'game', 'autoTrimpSettings', 'getPerSecBeforeManual', 'canAffordCoordinationTrimps',
    'canAffordTwoLevel', 'enoughHealth', 'enoughDamage', 'enableDebug', 'ATmessageLogTabVisible',
    'lastmessagecount', 'trimMessages', 'getCurrentTime', 'updatePortalTimer',
  ]) delete g[k]
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Layer 1 — gigaTargetZone must not hand back a zone with no gigas in it
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('gigaTargetZone rejects every target zone that yields nGigas < 1 (#297 layer 1)', () => {
  beforeEach(() => { reportedSave(); reportedSettings() })

  it("VoidMaps = 60 — the reporter's exact trigger — no longer escapes the failsafe", () => {
    // `60 < 60` is false, so the old boundary waved through the ONE value that makes nGigas 0.
    // max(65, highestLevelCleared = 67) = 67.
    expect(upgrades.gigaTargetZone()).toBe(67)
  })

  it.each([60, 60.01, 60.5, 60.99])('a fractional void target of %s is caught too (only the floor matters)', (v) => {
    g.autoTrimpSettings.VoidMaps.value = v
    expect(upgrades.gigaTargetZone()).toBe(67)
  })

  it('61 is the first zone with a pattern, and it is NOT rerouted', () => {
    // The boundary is exact: nGigas = min(floor(z - 60), …) is 1 at 61 and 0 at 60. A guard that
    // over-corrected to `< 62` would silently retarget a legitimate zone-61 run.
    g.autoTrimpSettings.VoidMaps.value = 61
    expect(upgrades.gigaTargetZone()).toBe(61)
  })

  it('a NaN target zone lands in the failsafe as well', () => {
    // The #237 class: a poisoned store makes getPageSetting return NaN, Math.max propagates it, and
    // `NaN < 61` is FALSE — so the strictly-less spelling would wave through the worst value of all.
    g.autoTrimpSettings.VoidMaps.value = null // parseFloat(null) → NaN, exactly what a null store gives
    expect(upgrades.gigaTargetZone()).toBe(67)
  })

  it('warns once per zone, not once per tick', () => {
    // A zone no other test in this file uses. The latch is module state keyed by (reason, zone), so
    // sharing a zone with the tests above would make this one's result depend on file order — and it
    // would fail CLOSED, reporting "already warned" as "warned once", which is the wrong direction.
    g.game.global.world = 300
    g.game.global.highestLevelCleared = 300
    const log = watchLog()
    upgrades.gigaTargetZone()
    expect(log.innerHTML).toContain('Unable to find a proper targetZone')
    expect(log.innerHTML).toContain('60') // names the value it rejected
    const after = log.innerHTML
    for (let i = 0; i < 10; i++) upgrades.gigaTargetZone()
    // Unlatched, message2 would either add spans or collapse them into " x11" — the reported symptom.
    expect(log.innerHTML).toBe(after)

    // A new zone re-arms it: a fault that outlives the zone is still worth saying again.
    g.game.global.world = 68
    upgrades.gigaTargetZone()
    expect(log.innerHTML).not.toBe(after)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Layer 2 — autoGiga's contract: a finite pattern, or NaN with a reason
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('autoGiga returns NaN instead of a poisoned number (#297 layer 2)', () => {
  beforeEach(() => { reportedSave(); reportedSettings() })

  it('the healthy control is finite — the guards do not swallow a good pattern', () => {
    expect(upgrades.autoGiga(200, 0.5, 10, 2)).toBe(3.95)
  })

  it('an explicitly-passed 60 is re-derived, not used', () => {
    // Layer 1 fixes gigaTargetZone's OUTPUT; this is autoGiga's own arm (`targetZone < 60`), which
    // accepted 60 from a caller. gigaTargetZone() now answers 67 here, so the result must be finite.
    const delta = upgrades.autoGiga(60, 0.5, 10, 2)
    expect(Number.isFinite(delta)).toBe(true)
    expect(delta).toBe(upgrades.autoGiga(67, 0.5, 10, 2))
  })

  it('±Infinity as a target zone is re-derived too', () => {
    // Infinity passes `>= 61`, and megabook ** (Infinity - baseZone) is Infinity — a route no
    // less-than boundary can catch.
    expect(Number.isFinite(upgrades.autoGiga(Infinity, 0.5, 10, 2))).toBe(true)
    expect(Number.isFinite(upgrades.autoGiga(-Infinity, 0.5, 10, 2))).toBe(true)
  })

  // ⚠️ Every one of these cases returns NaN with its guard DELETED, because the string round-trip at
  // the end of autoGiga is itself the NaN funnel — `expect(...).toBeNaN()` alone cannot see any of
  // them, and three of the five guards survived a delete-mutant on exactly that basis. What the guard
  // adds is the DIAGNOSTIC: a state where AT silently does nothing is the thing the live report was
  // about. So each case asserts its own message, and each runs in its own zone because the warn latch
  // is keyed by (reason, zone) — sharing a zone would make a later case pass on an earlier one's line.
  type Route = { world: number; why: string; says: string; arm: () => [number, number, number, number?] }
  const ROUTES: Route[] = [
    { world: 510, why: 'gems income is zero (metalDiff → Infinity)', says: 'metal against gems',
      arm: () => { g.getPerSecBeforeManual = (j: string) => (j === 'Miner' ? 1e9 : 0); return [200, 0.5, 10, 2] } },
    { world: 511, why: 'both incomes are zero (0/0 → NaN)', says: 'metal against gems',
      arm: () => { g.getPerSecBeforeManual = () => 0; return [200, 0.5, 10, 2] } },
    { world: 512, why: 'gems income is NaN', says: 'metal against gems',
      arm: () => { g.getPerSecBeforeManual = (j: string) => (j === 'Miner' ? 1e9 : NaN); return [200, 0.5, 10, 2] } },
    { world: 513, why: 'population is zero', says: 'population is 0',
      arm: () => { g.game.resources.trimps.max = 0; return [200, 0.5, 10, 2] } },
    { world: 514, why: 'the delta factor is zero', says: 'delta factor',
      arm: () => [200, 0.5, 0, 2] },
    { world: 515, why: 'the delta factor is negative', says: 'delta factor',
      arm: () => [200, 0.5, -5, 2] },
    // FirstGigastation is machine-written, so a store carrying `null` for it reads back as NaN and
    // would otherwise re-poison the delta on the next tick: the defect is self-sustaining.
    { world: 516, why: 'the base comes from a store this very bug already poisoned', says: 'first-Gigastation count',
      arm: () => { g.autoTrimpSettings.FirstGigastation.value = null; return [200, 0.5, 10, undefined] } },
    // No input is invalid here — 1e300 is a finite zone above the floor, the incomes are healthy, the
    // base is 2 — and megabook ** (1e300 - 67) is still Infinity. This is why the check on the RESULT
    // exists as well as the checks on the inputs: no list of input tests is a proof about the output.
    { world: 517, why: 'the arithmetic overflows with every input valid', says: 'overflowed',
      arm: () => [1e300, 0.5, 10, 2] },
  ]

  it.each(ROUTES)('refuses when $why, and says so', ({ world, says, arm }) => {
    g.game.global.world = world
    const log = watchLog()
    const [zone, ratio, slow, base] = arm()
    expect(upgrades.autoGiga(zone, ratio, slow, base)).toBeNaN()
    expect(log.innerHTML).toContain(says)
  })

  it('never returns ±Infinity — the contract is finite-or-NaN', () => {
    // Why firstGiga's `Number.isFinite(delta)` and a bare `isNaN(delta)` are indistinguishable there
    // (a delete-mutant swapping them survives): this function cannot produce ±Infinity, because the
    // round-trip funnels it and every refusal path returns NaN outright. Asserting the contract is
    // what makes that equivalence a checked fact instead of an assumption a later change could void.
    g.game.global.world = 520
    g.getPerSecBeforeManual = () => 0
    expect(upgrades.autoGiga(200, 0.5, 10, 2)).toBeNaN()
    expect(upgrades.autoGiga(1e300, 0.5, 10, 2)).toBeNaN()
    expect(upgrades.autoGiga(1e300, 0.5, 10, 2)).not.toBe(Infinity)
  })

  it('each refusal names its own reason, and one reason does not silence another', () => {
    // A latch keyed too coarsely (a bare boolean, or the zone alone) lets whichever broken input
    // arrives first hide every other one — and these warnings are the only surface for a state in
    // which AT deliberately does nothing.
    g.game.global.world = 400 // a zone no other test in this file uses — see the latch test above
    const log = watchLog()
    g.getPerSecBeforeManual = () => 0
    upgrades.autoGiga(200, 0.5, 10, 2)
    expect(log.innerHTML).toContain('metal against gems')

    // Restore the income before arming the second fault: the guards are ordered, so leaving gems at 0
    // would refuse at metalDiff again and this arm would never REACH the delta-factor branch — it
    // would then pass or fail for reasons that have nothing to do with the latch key.
    g.getPerSecBeforeManual = (job: string) => (job === 'Miner' ? 1e9 : 1e5)
    upgrades.autoGiga(200, 0.5, 0, 2) // a DIFFERENT reason, same zone
    expect(log.innerHTML).toContain('delta factor')
    // Both diagnostics are present at once — the point of keying by reason rather than by zone alone.
    expect(log.innerHTML).toContain('metal against gems')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Layer 2 (cont.) — firstGiga must not persist a pattern that does not exist
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('firstGiga leaves the stored pattern alone when there is none (#297 layer 2)', () => {
  beforeEach(() => { reportedSave(); reportedSettings() })

  it('writes NEITHER setting, returns false, and logs no pattern line', () => {
    g.getPerSecBeforeManual = () => 0 // force a refusal
    const log = watchLog()
    expect(upgrades.firstGiga(true)).toBe(false)
    // Both writes are skipped: pinning a new base against a delta that does not exist would just move
    // the corruption one setting over.
    expect(g.autoTrimpSettings.DeltaGigastation.value).toBe(3.5)
    expect(g.autoTrimpSettings.FirstGigastation.value).toBe(2)
    expect(log.innerHTML).not.toContain('Setting pattern to')
  })

  it('never leaves a value that JSON.stringify writes as null', () => {
    // The actual mechanism of the permanent damage: NaN survives in memory, becomes `null` on disk,
    // and createSetting keeps a stored null forever because `null !== undefined`.
    g.getPerSecBeforeManual = () => 0
    upgrades.firstGiga(true)
    const roundTripped = JSON.parse(JSON.stringify({
      DeltaGigastation: g.autoTrimpSettings.DeltaGigastation.value,
      FirstGigastation: g.autoTrimpSettings.FirstGigastation.value,
    }))
    expect(roundTripped.DeltaGigastation).not.toBeNull()
    expect(roundTripped.FirstGigastation).not.toBeNull()
  })

  it('a CustomTargetZone of 60 yields the same pattern as no custom zone at all', () => {
    // The user-visible boundary, asserted on BEHAVIOUR rather than on which line enforces it — the
    // read site still says `>= 60` on purpose (see its comment), so a test naming that line would be
    // a claim no assertion can back. What is checkable: 60 produces AT's own target zone, and 61 does
    // not. The second half has teeth — a boundary set one too high would send 61 down the same path.
    g.autoTrimpSettings.CustomTargetZone.value = 60
    expect(upgrades.firstGiga(true)).toBe(true)
    const at60 = g.autoTrimpSettings.DeltaGigastation.value
    expect(at60).toBe(upgrades.autoGiga(67, 0.5, 10, 2)) // 67 = max(65, HZE), the failsafe's answer

    g.autoTrimpSettings.CustomTargetZone.value = 61
    expect(upgrades.firstGiga(true)).toBe(true)
    expect(g.autoTrimpSettings.DeltaGigastation.value).toBe(upgrades.autoGiga(61, 0.5, 10, 2))
    expect(g.autoTrimpSettings.DeltaGigastation.value).not.toBe(at60)
  })

  it('still writes a healthy pattern — and the reported save is now healthy', () => {
    // The positive half, on the reporter's own state: VoidMaps 60 reroutes to zone 67, which has 7
    // gigas in it, so AT gets a real pattern where it used to get NaN.
    const log = watchLog()
    expect(upgrades.firstGiga(true)).toBe(true)
    expect(g.autoTrimpSettings.FirstGigastation.value).toBe(2)
    expect(Number.isFinite(g.autoTrimpSettings.DeltaGigastation.value)).toBe(true)
    expect(log.innerHTML).toContain('Setting pattern to 2+')
    expect(log.innerHTML).not.toContain('NaN')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// #312 — the SUCCESS line needs a latch too, for the same reason the WARNING line got one
// ════════════════════════════════════════════════════════════════════════════════════════════════
// #297 latched gigaTargetZone's failsafe warning because "this line is reached on every tick that
// firstGiga runs — which is every tick until the first Gigastation is owned". The success line two
// functions down is reached on exactly the same ticks and was left unlatched, so the identical symptom
// came straight back on a healthy save (live on v6.0.0.156, Z67, Warpstation 3, Gigastation 0/7):
//
//   14:37:40 Auto Gigastation: Setting pattern to 3+1.01 x10
//   14:37:41 Auto Gigastation: Setting pattern to 3+1.01 x10
//
// Byte-identical, forever. Every call is called through `buyUpgrades`' giga arm (upgrades.ts:284) while
// `Gigastation.done === 0`, and on that save AT then bails at `!available` because the first Gigastation
// costs 1e14 gems and the reporter has 2.95e13 — an ordinary, expected wait, not a second defect.
// (`canAffordTwoLevel` is named for the two-LEVEL cost map, `cost.resources.gems`; it does not require
// affording two Gigastations. The issue's own hypothesis said it did — checked against main.js:4678 and
// refuted before anything was written.)
//
// These drive the UNFORCED call — the live shape — because the latch sits after the a&&b&&c&&d gate and
// a `forced` fixture would prove the easy half while reading as proof of the hard one.
describe('firstGiga logs the pattern only when it MOVES (#312)', () => {
  beforeEach(() => { reportedSave(); reportedSettings() })

  it('an unchanged pattern is not re-logged on every tick', () => {
    const log = watchLog()
    expect(upgrades.firstGiga()).toBe(true)
    expect(log.innerHTML).toContain('Setting pattern to 2+')
    const after = log.innerHTML

    // Unlatched, message2 either appends ten more spans or collapses them into " x11" — both change
    // innerHTML, which is why the assertion is on the whole log rather than on a line count.
    for (let i = 0; i < 10; i++) expect(upgrades.firstGiga()).toBe(true)
    expect(log.innerHTML).toBe(after)
  })

  it('a moved DELTA is logged even though the base has not moved', () => {
    // The near-miss repair: a latch keyed on `base` alone. It looks right at the call site (the base is
    // the value #107 re-pins) and stays silent through every pattern change a target-zone edit causes.
    const log = watchLog()
    upgrades.firstGiga()
    const after = log.innerHTML
    const firstDelta = g.autoTrimpSettings.DeltaGigastation.value

    g.autoTrimpSettings.CustomTargetZone.value = 61 // moves the delta; base stays Warpstation.owned = 2
    expect(upgrades.firstGiga()).toBe(true)
    expect(g.autoTrimpSettings.FirstGigastation.value).toBe(2)
    expect(g.autoTrimpSettings.DeltaGigastation.value).not.toBe(firstDelta)
    expect(log.innerHTML).not.toBe(after)
    expect(log.innerHTML).toContain('Setting pattern to 2+' + g.autoTrimpSettings.DeltaGigastation.value)
  })

  it('a moved BASE is logged even though the delta has not moved', () => {
    // The mirror near-miss: a latch keyed on `delta` alone. autoGiga reads its own base from the STORE,
    // which still holds 2 after the first call, so this second tick produces a byte-identical delta with
    // a different base — the one state that tells the two wrong keys apart.
    const log = watchLog()
    upgrades.firstGiga()
    const after = log.innerHTML
    const firstDelta = g.autoTrimpSettings.DeltaGigastation.value

    g.game.buildings.Warpstation.owned = 3
    expect(upgrades.firstGiga()).toBe(true)
    expect(g.autoTrimpSettings.DeltaGigastation.value).toBe(firstDelta)
    expect(g.autoTrimpSettings.FirstGigastation.value).toBe(3)
    expect(log.innerHTML).not.toBe(after)
    expect(log.innerHTML).toContain('Setting pattern to 3+' + firstDelta)
  })

  it('still re-pins on every tick, and ANNOUNCES an override of a hand-edited box (#107)', () => {
    // The pin is load-bearing: it is what makes `owned < floor(0 * delta) + first` false, so the first
    // Gigastation can be bought at all. A "fix" that skipped the whole block when nothing had changed
    // would read identically at the call site and would strand any store that drifted underneath it.
    //
    // This is also the ONE state that separates reading the store from remembering the last logged pair
    // — the issue's own fix sketch. DeltaGigastation is not an input to autoGiga (FirstGigastation is),
    // so a hand-edit to THIS box moves neither `base` nor `delta`: a remembered-pair latch computes an
    // unchanged key, stays silent, and AT reverts the user's number with nothing in the log. Editing the
    // other box cannot tell the two apart, because autoGiga reads its base out of it and the delta moves
    // with it — which is why this drives the delta box specifically.
    const log = watchLog()
    upgrades.firstGiga()
    const after = log.innerHTML
    const pinned = g.autoTrimpSettings.DeltaGigastation.value

    g.autoTrimpSettings.DeltaGigastation.value = 5 // the user edits the box
    expect(upgrades.firstGiga()).toBe(true)
    expect(g.autoTrimpSettings.DeltaGigastation.value).toBe(pinned) // AT re-pins over it…
    expect(g.autoTrimpSettings.FirstGigastation.value).toBe(2)
    expect(log.innerHTML).not.toBe(after) // …and says so, rather than overriding in silence.
    expect(log.innerHTML).toContain('Setting pattern to 2+' + pinned)
  })

  it('the refusal path is still silent — a latch is not a licence to log', () => {
    // #297's contract, re-asserted from this side: when autoGiga has no pattern, firstGiga writes
    // nothing and says nothing here (autoGiga has already warned, latched by reason).
    g.game.global.world = 530 // a zone no other test in this file uses — the warn latch is (reason, zone)
    g.getPerSecBeforeManual = () => 0
    const log = watchLog()
    expect(upgrades.firstGiga()).toBe(false)
    expect(log.innerHTML).not.toContain('Setting pattern to')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Layer 3 — setPageSetting is the chokepoint the store can be trusted at
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('setPageSetting refuses a value the store cannot carry (#297 layer 3)', () => {
  // Real setting ids only, one per type. Seeding an invented id would pass just as well here and be a
  // lie about the store's shape — `settings-reverse.test.ts` (#74) fails the run for exactly that, and
  // it caught this fixture's first draft.
  beforeEach(() => {
    reportedSave()
    g.autoTrimpSettings = {
      DeltaGigastation: { type: 'value', value: 3.5 },
      ScientistPercent: { type: 'valueNegative', value: -1 },
      dPraidingzone: { type: 'multiValue', value: [10, 20] },
      Rdtimefarmlevel: { type: 'textValue', value: 'anything' },
      AutoGigas: { type: 'boolean', enabled: false },
    }
  })

  it.each([NaN, Infinity, -Infinity, 'abc', null, undefined])('rejects %s on a value setting', (bad) => {
    expect(utils.setPageSetting('DeltaGigastation', bad)).toBe(false)
    expect(g.autoTrimpSettings.DeltaGigastation.value).toBe(3.5)
  })

  it('rejects it on valueNegative and multiValue as well', () => {
    expect(utils.setPageSetting('ScientistPercent', NaN)).toBe(false)
    expect(g.autoTrimpSettings.ScientistPercent.value).toBe(-1)
    // One bad element is enough — the array is what gets serialized.
    expect(utils.setPageSetting('dPraidingzone', [10, NaN])).toBe(false)
    expect(g.autoTrimpSettings.dPraidingzone.value).toEqual([10, 20])
  })

  it('still writes everything the store CAN carry', () => {
    // The guard has to be surgical in both directions: 18 declared `value` defaults are STRINGS, read
    // back with parseFloat, so '-1' and '1e33' are perfectly good stored values and rejecting them
    // would break far more than it fixed.
    utils.setPageSetting('DeltaGigastation', 4.25)
    expect(g.autoTrimpSettings.DeltaGigastation.value).toBe(4.25)
    utils.setPageSetting('DeltaGigastation', '-1')
    expect(g.autoTrimpSettings.DeltaGigastation.value).toBe('-1')
    utils.setPageSetting('DeltaGigastation', '1e33')
    expect(g.autoTrimpSettings.DeltaGigastation.value).toBe('1e33')
    utils.setPageSetting('dPraidingzone', [1, '2', 3e5])
    expect(g.autoTrimpSettings.dPraidingzone.value).toEqual([1, '2', 3e5])
  })

  it('leaves the non-numeric types exactly as they were', () => {
    // textValue holds free text (MAZ lists, names) — a numeric storability test does not apply, and
    // applying it would silently drop every legitimate write.
    utils.setPageSetting('Rdtimefarmlevel', 'not a number')
    expect(g.autoTrimpSettings.Rdtimefarmlevel.value).toBe('not a number')
  })

  it('the predicate is the SAME one createSetting validates user input with', () => {
    // #237 guarded the typed-input path and this one guarded nothing, so AT protected the user from
    // typing NaN into the box and then wrote NaN into the same store itself. One definition, or the
    // two halves drift — hence the shared leaf module rather than a copy in each consumer.
    expect(isStorableNumber('-1')).toBe(true)
    expect(isStorableNumber('1e33')).toBe(true)
    expect(isStorableNumber(NaN)).toBe(false)
    expect(isStorableNumber(Infinity)).toBe(false)
    expect(isStorableNumber(null)).toBe(false)
  })
})
