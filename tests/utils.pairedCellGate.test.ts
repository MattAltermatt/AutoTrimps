// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as ts from 'typescript'

// #162 — `pairedCellGateOpen`, and the three maps.ts farms that were the reason it is a function.
//
// Five sites hand-copied `(getPageSetting(ID) != 0) ? getPageSetting(ID)[index] : 1` followed by
// `(cell <= 1) || (cell > 1 && (lastClearedCell + 1) >= cell)`. The guard is broken at all five: the
// setting is a multiValue, so `getPageSetting` returns an ARRAY, and `[-1] != 0` coerces to
// `-1 != 0` — TRUE. Every one of these settings defaults to `[-1]`, so the `: 1` arm never ran and a
// user with more configured zones than cell entries indexed past the end, got `undefined`, and
// `undefined` satisfies NEITHER arm of the gate.
//
// The half worth a dedicated file is the REPAIR hazard. The issue proposed `cellList?.[index] ?? 1`.
// At the three maps.ts sites that is a regression: `index` is an `indexOf()` result, and those three
// conditions have no zone-membership test anywhere else (only `Rinsanityfarmzone[0] > 0`), so
// `undefined` failing both arms was the ONLY thing keeping them from farming at every zone of the
// challenge. A -1 index therefore has to close the gate explicitly.

const G = globalThis as any
let utils: typeof import('../src/modules/utils')

beforeAll(async () => {
  G.MODULES = { maps: {} }
  G.autoTrimpSettings = {}
  G.getPlayerCritChance = () => 0
  document.body.insertAdjacentHTML('beforeend',
    `<div id="portalBtn" style="display:none"></div><input id="mapLevelInput">` +
    `<div id="autoMapStatus"></div><div id="hiderStatus"></div><div id="logBtnGroup"></div><div id="log"></div>`)
  utils = await import('../src/modules/utils')
})

describe('pairedCellGateOpen — the rule, on its own', () => {
  const open = (list: number[] | undefined, i: number, cleared: number) =>
    utils.pairedCellGateOpen(list, i, cleared)

  it('an entry the user never filled in means "start at cell 1"', () => {
    // THE #162 FIX. Two zones configured, the shipped one-element cell default: index 1 has no entry.
    expect(open([-1], 1, 0)).toBe(true)
    expect(open([], 0, 0)).toBe(true)
    expect(open(undefined, 0, 0)).toBe(true)
  })

  it('a NEGATIVE index closes the gate — the zone is not configured at all', () => {
    // The naive `?? 1` repair returns true here, which is the regression the three maps.ts callers
    // would suffer. Asserted for a populated list too, so it cannot pass by accident.
    expect(open([-1], -1, 0)).toBe(false)
    expect(open([5, 10, 20], -1, 99)).toBe(false)
  })

  it('the documented -1 entry starts at cell 1, and 0 behaves the same', () => {
    expect(open([-1], 0, 0)).toBe(true)
    expect(open([0], 0, 0)).toBe(true)
    expect(open([1], 0, 0)).toBe(true)
  })

  it('a real cell is a threshold on lastClearedCell + 1, not a free pass', () => {
    expect(open([40], 0, 10)).toBe(false) // 11 < 40
    expect(open([40], 0, 38)).toBe(false) // 39 < 40
    expect(open([40], 0, 39)).toBe(true) // 40 >= 40
    expect(open([40], 0, 98)).toBe(true)
  })

  it('a NaN entry closes the gate — `??`, not `||`', () => {
    // getPageSetting on a multiValue is `Array.from(value).map(parseInt)`, so a non-numeric entry is
    // NaN, and it IS reachable: nothing validates what the value dialog stores. `|| 1` reads as the
    // same fix and silently promotes garbage to "start at cell 1"; `?? 1` leaves NaN, which fails both
    // arms and refuses to act on an entry nobody can interpret. This is the ONLY input that tells the
    // two operators apart — for 0 and -1 they agree, because `cell <= 1` covers both.
    expect(open([NaN], 0, 99)).toBe(false)
    expect(open([1, NaN], 1, 99)).toBe(false)
  })

  it('it reads the entry at the given INDEX, not the first one', () => {
    // A repair that ignored `index` (or always read [0]) would pass every row above.
    expect(open([1, 90], 1, 10)).toBe(false)
    expect(open([90, 1], 1, 10)).toBe(true)
  })
})

// ── the four call sites: WIRING ───────────────────────────────────────────────────────────────────
//
// The rule itself is exhausted above. What the rule cannot catch is a mis-wired call — the right
// helper handed the wrong setting id, or an index derived from a DIFFERENT zone list, which is
// precisely the copy-paste hazard that produced five identical broken guards in the first place.
//
// STATED LIMITATION: the three maps.ts sites are checked structurally, not by execution. Reaching
// them means driving RautoMap past ~40 settings and several early returns, and the one caller that
// IS driven end-to-end — RPraid, in tests/mapfunctions.rpraid-cell.test.ts, including the
// unconfigured-zone case — shares this exact expression. So the behavioural evidence is one real
// caller plus the rule; this is the check that the other three are wired to the same rule.
describe('#162 — every call site is wired to its OWN paired setting and index', () => {
  const SRC = {
    'src/modules/maps.ts': readFileSync(resolve(__dirname, '..', 'src/modules/maps.ts'), 'utf8'),
    'src/modules/mapfunctions.ts': readFileSync(resolve(__dirname, '..', 'src/modules/mapfunctions.ts'), 'utf8'),
  }

  /** Every `pairedCellGateOpen(...)` call, with its three argument source texts. */
  function calls(file: string, text: string) {
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const out: { file: string; args: string[] }[] = []
    const walk = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'pairedCellGateOpen')
        out.push({ file, args: n.arguments.map((a) => a.getText(sf).replace(/\s+/g, ' ')) })
      ts.forEachChild(n, walk)
    }
    walk(sf)
    return out
  }

  const allCalls = Object.entries(SRC).flatMap(([f, t]) => calls(f, t))

  it('all four call sites use the helper — and nothing still guards the whole array', () => {
    // FOUR calls, not five: RPraid's daily and non-daily settings share one call with a ternary
    // argument, so the five broken COMPARISONS live at four call sites. (I wrote 5 here first — the
    // same restated-count mistake this whole class keeps producing.)
    expect(allCalls.length).toBe(4)
    // The old shape, in either module, would mean a site was missed.
    for (const [file, text] of Object.entries(SRC))
      expect(
        text.match(/getPageSetting\('R\w*(?:Praid)?cell'\) != 0/g),
        `${file} still guards a cell list with != 0`,
      ).toBeNull()
  })

  it('every call passes lastClearedCell as the cleared-cell argument', () => {
    for (const c of allCalls) expect(c.args[2], c.args.join(' | ')).toBe('game.global.lastClearedCell')
  })

  it('each maps.ts farm pairs its own *farmcell list with its own *farmzone index', () => {
    // The mis-wiring that would survive every behavioural test written against one challenge: hand
    // the Alchemy gate the Hypothermia index. Both are `indexOf` results on similar lists.
    const text = SRC['src/modules/maps.ts']
    for (const [setting, indexVar, zoneSetting] of [
      ['Rinsanityfarmcell', 'insanitystacksfarmindex', 'Rinsanityfarmzone'],
      ['Ralchfarmcell', 'alchstacksfarmindex', 'Ralchfarmzone'],
      ['Rhypofarmcell', 'hypoamountfarmindex', 'Rhypofarmzone'],
    ]) {
      const call = allCalls.find((c) => c.args[0] === `getPageSetting('${setting}')`)
      expect(call, `no pairedCellGateOpen call for ${setting}`).toBeTruthy()
      expect(call!.args[1], `${setting} must be indexed by ${indexVar}`).toBe(indexVar)
      // ...and that index must itself come from the MATCHING zone list.
      const zoneVar = new RegExp(`const (\\w+) = getPageSetting\\('${zoneSetting}'\\)`).exec(text)
      expect(zoneVar, `${zoneSetting} is no longer read into a local`).toBeTruthy()
      expect(text).toContain(`const ${indexVar} = ${zoneVar![1]}.indexOf(game.global.world)`)
    }
  })

  it("RPraid pairs the daily and non-daily cell lists on the run's own flag", () => {
    const call = allCalls.find((c) => c.file === 'src/modules/mapfunctions.ts')!
    expect(call.args[0]).toBe(
      "daily ? getPageSetting('RdAMPraidcell') : getPageSetting('RAMPraidcell')",
    )
    expect(call.args[1]).toBe('praidindex')
  })
})
