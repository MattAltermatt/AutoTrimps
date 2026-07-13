// @vitest-environment jsdom
//
// #81 regression tests for the two dispatch holes tests/nets/dispatch-holes.test.ts found.
//
// Both drive REAL shipped code, not a paraphrase of it:
//   · the BuyBuildingsNew dispatch is READ VERBATIM out of legacy/AutoTrimps2.js and executed. A test
//     that retyped those lines would pass forever no matter what the bundle actually says.
//   · the clamp is driven through the real production import path — the real serializeSettings550()
//     blob, the real createSetting(), the real getPageSetting(), with the real settings-defs arguments.
//
// Each has a POSITIVE CONTROL on the same fixture. The control is the load-bearing half: it proves the
// instrument reaches the code and can tell pass from fail. (#66: a green harness that cannot see the
// code under test is worse than no harness.)

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { createSetting, settingChanged } from '../src/modules/settings-engine'
import { getPageSetting, serializeSettings550 } from '../src/modules/utils'
import { atGuard } from '../src/modules/guard'

const ROOT = resolve(__dirname, '..')

// ─── #81 flagship: BuyBuildingsNew == 3 ("Buy Storage") ──────────────────────────────────────────
//
// The `== 3` arm used to bind to the `else` of `if (!usingRealTimeOffline)`, so it ran ONLY during the
// offline-progress replay and never in live play. Index 3 is a real, shipped, user-selectable option;
// picking it meant no buildings and no storage for the entire session.

describe('#81 — the BuyBuildingsNew dispatch, executed verbatim from legacy/AutoTrimps2.js', () => {
  // Extract the real block. If the markers ever move, this throws rather than silently testing nothing.
  const src = readFileSync(resolve(ROOT, 'legacy/AutoTrimps2.js'), 'utf8').split('\n')
  const start = src.findIndex((l) => l.trim() === '//Buildings')
  // #87 wrapped every dispatch in an atGuard(name, function(){…}) closure, so the block no longer ends
  // at a bare `if (getPageSetting('UseAutoGen'))` line — that line is now INSIDE the next guard's
  // closure, and slicing there cut the function in half (SyntaxError: Unexpected end of input). The end
  // marker is the next dispatch's guard, so the slice stays a set of whole statements. It still has to
  // be found, and the tripwire below still has to see the real dispatch inside it.
  const end = src.findIndex((l, i) => i > start && l.includes("atGuard('autoGenerator'"))
  const BLOCK = src.slice(start, end).join('\n')

  it('TRIPWIRE: the harness really extracted the dispatch (not an empty string)', () => {
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    expect(BLOCK).toContain("getPageSetting('BuyBuildingsNew') == 1")
    expect(BLOCK).toContain("getPageSetting('BuyBuildingsNew') == 2")
    expect(BLOCK).toContain("getPageSetting('BuyBuildingsNew') == 3") // the option under test exists
    expect(BLOCK).toContain('usingRealTimeOffline')
    expect(BLOCK).toContain("atGuard('buildings'") // #87 — and it runs through the real error boundary
  })

  /**
   * Run the verbatim block once, as one mainLoop tick, and report which buyers it called.
   *
   * Uses `node:vm` rather than `new Function`. Not cosmetic: #76 turned on oxlint's `no-new-func` after
   * finding a live `eval()` RCE shipping behind an `oxlint-disable-next-line no-eval`, and suppressing
   * the rule here — in the very sweep that is trying to *remove* suppressions (#92) — would be exactly
   * the move that let the RCE live for nine years. `vm.runInContext` is the purpose-built tool for
   * "execute this source text with these names bound", it is not a code-injection sink, and it preserves
   * the property that actually matters: the code under test is READ FROM THE SHIPPED FILE, so a retyped
   * copy of these lines could never pass.
   */
  const tick = (buyBuildingsNew: number, offline: boolean, hidebuildings = false) => {
    const calls: string[] = []
    const sandbox = vm.createContext({
      getPageSetting: (id: string) =>
        id === 'BuyBuildingsNew' ? buyBuildingsNew : id === 'hidebuildings' ? hidebuildings : false,
      usingRealTimeOffline: offline,
      buyBuildings: () => calls.push('buyBuildings'),
      buyStorage: () => calls.push('buyStorage'),
      computeTopTarget: () => {},
      // #87 — the REAL boundary, imported, not a pass-through stub. The block under test is now
      // dispatched through atGuard(), and a stub would quietly hide the one thing that could go wrong
      // with wrapping it: a guard that never invokes its closure would make every assertion below read
      // `[]`, and "no buyer ran" is exactly the #81 bug this file exists to catch. Using the shipped
      // atGuard means the containment layer is on the hook for these results too.
      atGuard,
    })
    vm.runInContext(BLOCK, sandbox)
    return calls
  }

  it('POSITIVE CONTROL: options 1 and 2 dispatch in live play', () => {
    // If these ever fail, the harness is not reaching the dispatch and nothing below means anything.
    expect(tick(1, false)).toEqual(['buyBuildings', 'buyStorage'])
    expect(tick(2, false)).toEqual(['buyBuildings'])
    expect(tick(0, false, true)).toEqual(['buyBuildings']) // 0 + hidebuildings
    expect(tick(0, false, false)).toEqual([]) // 0 = "Buy Neither" = deliberately nothing
  })

  it('option 3 ("Buy Storage") buys storage IN LIVE PLAY — it used to reach no branch at all', () => {
    expect(tick(3, false)).toEqual(['buyStorage'])
  })

  it('no option dispatches during the offline replay (the two halves were exactly inverted)', () => {
    // Before the fix this was the ONLY state in which option 3 fired, and the only state in which
    // options 0/1/2 did not. Both directions are pinned so a re-inversion cannot pass.
    for (const i of [0, 1, 2, 3]) expect(tick(i, true, true)).toEqual([])
  })
})

// ─── #81/#61: an out-of-range index smuggled in by a shipped preset ──────────────────────────────

describe('#81/#61 — createSetting clamps an out-of-range multitoggle index', () => {
  // The real settings-defs.ts arguments for BetterAutoFight. Its dispatch table (AutoTrimps2.js:242-243,
  // and the U2 twin at :349-350) is exactly `== 1` and `== 2`; index 3 matches neither, so a player who
  // loaded the "550+ AT Settings" preset got NO AutoFight management at all, silently.
  const BAF_LABELS = ['Better AutoFight OFF', 'Better Auto Fight', 'Vanilla']
  const BAF_DEFAULT = 1

  beforeEach(() => {
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).ATversion = 'test-version'
    ;(globalThis as any).game = { options: { menu: { darkTheme: { enabled: 0 } } } }
    ;(globalThis as any).saveSettings = vi.fn()
    ;(globalThis as any).updateCustomButtons = vi.fn()
    ;(globalThis as any).checkPortalSettings = vi.fn()
    document.body.innerHTML = '<div id="autoSettings"></div>'
  })

  it('TRIPWIRE: the shipped 550+ preset really does carry BetterAutoFight = 3', () => {
    // The fixture is the real production blob, not a hand-written stand-in. If this ever stops being
    // true, the test below is testing a scenario that no longer exists and must be re-derived.
    const preset = JSON.parse(serializeSettings550())
    expect(preset.BetterAutoFight).toBe(3)
    expect(BAF_LABELS.length).toBe(3) // legal indices are 0..2 — 3 is out of range
  })

  it('POSITIVE CONTROL: an IN-RANGE stored value survives untouched', () => {
    // Without this, a clamp that simply reset every setting to its default would pass the test below.
    for (const stored of [0, 1, 2]) {
      ;(globalThis as any).autoTrimpSettings = { BetterAutoFight: stored }
      document.body.innerHTML = '<div id="autoSettings"></div>'
      createSetting('BetterAutoFight', BAF_LABELS, 'desc', 'multitoggle', BAF_DEFAULT, null, undefined)
      expect(getPageSetting('BetterAutoFight')).toBe(stored)
    }
  })

  it('the real 550+ preset import path yields an index the dispatch table actually handles', () => {
    // Drive the production path end-to-end: the real blob → JSON.parse → the raw value dropped onto
    // autoTrimpSettings (what loadPageVariables does) → the real createSetting → the real getPageSetting.
    const preset = JSON.parse(serializeSettings550())
    ;(globalThis as any).autoTrimpSettings = { BetterAutoFight: preset.BetterAutoFight }
    createSetting('BetterAutoFight', BAF_LABELS, 'desc', 'multitoggle', BAF_DEFAULT, null, undefined)

    const value = getPageSetting('BetterAutoFight')
    expect(value).toBe(BAF_DEFAULT) // recovered to the setting's own declared default — nothing invented
    // The assertion that actually matters: SOME dispatch arm fires. `== 1` → betterAutoFight(),
    // `== 2` → betterAutoFight3(). Index 3 matched neither, which is the bug.
    expect([1, 2]).toContain(value)
  })

  it('clamps any out-of-range or junk stored value, not just this one preset', () => {
    // The class, not the instance: a hand-edited save or a save written before an option was removed
    // upstream smuggles the same corruption through the same door.
    for (const junk of [3, 99, -1, '7', 'banana', null]) {
      ;(globalThis as any).autoTrimpSettings = { BetterAutoFight: junk }
      document.body.innerHTML = '<div id="autoSettings"></div>'
      createSetting('BetterAutoFight', BAF_LABELS, 'desc', 'multitoggle', BAF_DEFAULT, null, undefined)
      const v = getPageSetting('BetterAutoFight')
      expect(v, `stored ${JSON.stringify(junk)} → ${v}`).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(BAF_LABELS.length)
    }
  })

  it('a clamped setting still cycles correctly on click (the button is not left in a bad state)', () => {
    ;(globalThis as any).autoTrimpSettings = { BetterAutoFight: 3 }
    createSetting('BetterAutoFight', BAF_LABELS, 'desc', 'multitoggle', BAF_DEFAULT, null, undefined)
    settingChanged('BetterAutoFight') // 1 → 2
    expect(getPageSetting('BetterAutoFight')).toBe(2)
    settingChanged('BetterAutoFight') // 2 → wraps to 0
    expect(getPageSetting('BetterAutoFight')).toBe(0)
  })
})
