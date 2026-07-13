// @vitest-environment jsdom
//
// #96 siblings — `Rinsanityfarmcell` (default was the STRING '-1') and `Ralchfarmcell` (the STRING
// '[-1]'). Both are `multiValue`, so getPageSetting runs Array.from(value).map(parseInt) over the
// CHARACTERS of the string:
//
//     '-1'    → ['-','1']          → [NaN, 1]
//     '[-1]'  → ['[','-','1',']']  → [NaN, NaN, 1, NaN]
//
// Unlike Rhypofarmstack's NaN (which the Rhypo consumer *depended* on — see mapfunctions.rhypo.test.ts),
// these two are inert, and this file proves it against the ACTUAL consumer expression rather than by
// argument. Both are read at exactly one site each — maps.ts:1221 (Insanity) and maps.ts:1258 (Alchemy) —
// through an identical two-step idiom:
//
//     const farmcell = ((getPageSetting(id) != 0) ? getPageSetting(id)[farmindex] : 1);
//     …&& ((farmcell <= 1) || (farmcell > 1 && (game.global.lastClearedCell + 1) >= farmcell)) && …
//
// where `farmindex` is `getPageSetting(<zone>).indexOf(game.global.world)`. The zone setting's default
// is [-1] and `world` is never -1, so an UNCONFIGURED player always has farmindex === -1 — and an array
// has no index -1. That is the state this file pins: for every unset encoding, the read is `undefined`,
// the gate is identical, and the re-default changes nothing.
//
// (A configured farmindex >= 0 cannot see the default at all: MAZ.ts:508+547 clears the zone AND the
// cell arrays together and repopulates both in the same loop, so a real zone always has a real cell.)

import { describe, it, expect, beforeEach } from 'vitest'
import { getPageSetting } from '../src/modules/utils'

type Case = { id: string; old: unknown; nu: unknown; site: string }

const CASES: Case[] = [
  { id: 'Rinsanityfarmcell', old: '-1', nu: [-1], site: 'maps.ts:1221' },
  { id: 'Ralchfarmcell', old: '[-1]', nu: [-1], site: 'maps.ts:1258' },
  // Rhypofarmcell was ALREADY [-1] — included as the control that proves the idiom, not the bug.
  { id: 'Rhypofarmcell', old: [-1], nu: [-1], site: 'maps.ts:1273' },
]

const seed = (id: string, value: unknown) => {
  ;(globalThis as any).autoTrimpSettings[id] = { id, type: 'multiValue', value }
}

/** The exact maps.ts idiom, parameterised by the stored default. Returns what the gate actually sees. */
function consume(id: string, value: unknown, farmindex: number) {
  seed(id, value)
  const decoded = getPageSetting(id) as any
  const farmcell = decoded != 0 ? decoded[farmindex] : 1
  return {
    decoded,
    gateTakesTernaryLeft: decoded != 0,
    farmcell,
    // the two comparisons the challenge's run-gate is built from
    cellAtOrBelowOne: farmcell <= 1,
    cellAboveOne: farmcell > 1,
  }
}

beforeEach(() => {
  ;(globalThis as any).autoTrimpSettings = {}
})

describe('#96 siblings · the string defaults really do decode to NaN arrays', () => {
  it('anti-false-green: the poison is present before the fix, and gone after', () => {
    expect(consume('Rinsanityfarmcell', '-1', -1).decoded).toEqual([NaN, 1])
    expect(consume('Ralchfarmcell', '[-1]', -1).decoded).toEqual([NaN, NaN, 1, NaN])
    // …and the repaired defaults decode to the clean sentinel every sibling multiValue uses.
    expect(consume('Rinsanityfarmcell', [-1], -1).decoded).toEqual([-1])
    expect(consume('Ralchfarmcell', [-1], -1).decoded).toEqual([-1])
  })
})

describe('#96 siblings · the re-default is behavior-identical for an unconfigured player', () => {
  for (const c of CASES) {
    it(`${c.id}: old vs new default are indistinguishable at ${c.site} (farmindex = -1)`, () => {
      // farmindex is -1 for every unconfigured player: zone defaults to [-1], and world is never -1.
      const before = consume(c.id, c.old, -1)
      const after = consume(c.id, c.nu, -1)

      expect(after.gateTakesTernaryLeft).toBe(before.gateTakesTernaryLeft)
      expect(after.farmcell).toBe(before.farmcell)
      expect(after.cellAtOrBelowOne).toBe(before.cellAtOrBelowOne)
      expect(after.cellAboveOne).toBe(before.cellAboveOne)

      // Pin the absolute values too — an equivalence that holds because BOTH sides broke would be a
      // false green. `!= 0` is true (NaN != 0, and -1 != 0), the read is undefined, and BOTH cell
      // comparisons are false, so the challenge's cell gate contributes `false` either way.
      expect(before.gateTakesTernaryLeft).toBe(true)
      expect(before.farmcell).toBeUndefined()
      expect(before.cellAtOrBelowOne).toBe(false)
      expect(before.cellAboveOne).toBe(false)
    })
  }

  it('a CONFIGURED cell never reads the default at all (MAZ writes zone + cell together)', () => {
    // The one state where old and new WOULD differ (farmindex 0: NaN vs -1) is unreachable, because a
    // farmindex >= 0 requires the zone array to hold the current world — which only MAZ writes, and MAZ
    // repopulates the cell array in the same loop. Pin the reachability claim, not just the arithmetic.
    expect(consume('Rinsanityfarmcell', '-1', 0).farmcell).toBeNaN() // ← would-be divergence…
    expect(consume('Rinsanityfarmcell', [-1], 0).farmcell).toBe(-1) // ← …if it were reachable.
    // What production actually reaches at farmindex 0: a real user-entered cell, on both sides.
    expect(consume('Rinsanityfarmcell', [50, 60], 0).farmcell).toBe(50)
  })
})
