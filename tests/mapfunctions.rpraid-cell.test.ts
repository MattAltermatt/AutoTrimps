// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// ARRAY-vs-SCALAR, generalized. Sibling of mapfunctions.rhypo.test.ts, which pinned this exact
// coercion trap for ONE setting (#96, Rhypofarmstack). The 2026-07-28 instrument audit found the
// class is 16 comparison sites over 63 multiValue settings; this file reproduces the worst one.
//
// getPageSetting on a multiValue returns `Array.from(value).map(parseInt)` — an ARRAY (utils.ts:64).
// Comparing an array to a scalar coerces through ToPrimitive → String → Number:
//
//     [-1] != 0   →  "-1" → -1  ⇒  TRUE     ← the "is it set?" guard PASSES while unset
//     [-1] != -1  →  "-1" → -1  ⇒  FALSE    ← the CORRECT idiom, used at 3 other sites
//     [0]  != 0   →  "0"  →  0  ⇒  FALSE
//
// mapfunctions.ts:655 (RPraid) uses the wrong form:
//
//     cell = (getPageSetting('RAMPraidcell') != 0) ? getPageSetting('RAMPraidcell')[praidindex] : 1
//
// RAMPraidcell is 'multiValue' defaulting to [-1] (settings-defs.ts:1723), so the guard is always
// true and the `: 1` fallback is UNREACHABLE. Indexing past the array's end then yields `undefined`,
// which satisfies NEITHER arm of the cell test at :657 (`cell <= 1` is false for undefined, and so
// is `cell > 1`) — so prestige raiding is skipped entirely.
//
// The setting's own tooltip says "Paired position-by-position with PR: Zone. Leaving an entry at -1
// starts at cell 1." A literal -1 does work (`-1 <= 1`). What does not work is a cell list SHORTER
// than the zone list, which is exactly what every user who configures zones and leaves the cell
// setting alone has — because the default is a one-element [-1].

let mapfunctions: typeof import('../src/modules/mapfunctions')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).getPlayerCritChance = () => 0 // read at module load (mapfunctions.ts:26)
  mapfunctions = await import('../src/modules/mapfunctions')
})

const setMV = (id: string, value: unknown) => {
  ;(globalThis as any).autoTrimpSettings[id] = { type: 'multiValue', value }
}

beforeEach(() => {
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).Rshoulddopraid = false
  ;(globalThis as any).Rdshoulddopraid = false
  // RPraid gates on Rgetequips(raidzones, false) > 0; hold it satisfied so the CELL term is the
  // only thing under test.
  ;(globalThis as any).Rgetequips = () => 5
  ;(globalThis as any).game = {
    global: { world: 50, lastClearedCell: 98, challengeActive: '' },
  }
})

/** Two configured PR zones, and the cell list left at its shipped default. */
const configureTwoZones = (cells: number[]) => {
  setMV('RAMPraidzone', [50, 60])
  setMV('RAMPraidraid', [1, 1])
  setMV('RAMPraidcell', cells)
}

describe('RPraid — multiValue cell list shorter than the zone list (array-vs-scalar)', () => {
  it('anti-false-green: the harness really drives RPraid (index 0 DOES praid)', () => {
    configureTwoZones([-1])
    ;(globalThis as any).game.global.world = 50 // praidindex 0 → cell = -1 → -1 <= 1 → praid
    mapfunctions.RPraid(false)
    expect((globalThis as any).Rshoulddopraid).toBe(true)
  })

  // FIXED in #162 (S9 Wave 4). This assertion was `.toBe(false)` — a deliberate characterization of
  // the defect, with a note that whatever fix landed MUST invert it. `pairedCellGateOpen` (utils.ts)
  // now takes the fallback per INDEX, so an unconfigured entry means "start at cell 1" exactly as the
  // tooltip promises, rather than `undefined` failing both arms of the gate.
  it('the SECOND configured zone praids, on the shipped one-element default', () => {
    configureTwoZones([-1]) // the shipped default — one element, two zones
    ;(globalThis as any).game.global.world = 60 // praidindex 1 → no entry → treated as cell 1
    mapfunctions.RPraid(false)
    expect((globalThis as any).Rshoulddopraid).toBe(true)
  })

  it('a zone that is NOT in the list still does not praid', () => {
    // The regression guard on the fix itself. `praidindex` is an indexOf result, so it is -1 for an
    // unconfigured zone; the naive repair (`cellList?.[i] ?? 1`) turns that into cell 1 and opens the
    // gate. Here RPraid's own `praidzone.includes(world)` also catches it, but the three sibling
    // sites in maps.ts have NO membership test of their own — see utils.pairedCellGate.test.ts.
    configureTwoZones([-1, -1])
    ;(globalThis as any).game.global.world = 55 // not 50, not 60
    mapfunctions.RPraid(false)
    expect((globalThis as any).Rshoulddopraid).toBe(false)
  })

  it('a real cell value is still honoured — the gate is not just always open', () => {
    configureTwoZones([-1, 40])
    ;(globalThis as any).game.global.world = 60
    ;(globalThis as any).game.global.lastClearedCell = 10 // 11 < 40 → not there yet
    mapfunctions.RPraid(false)
    expect((globalThis as any).Rshoulddopraid).toBe(false)
    ;(globalThis as any).game.global.lastClearedCell = 39 // 40 >= 40 → reached
    mapfunctions.RPraid(false)
    expect((globalThis as any).Rshoulddopraid).toBe(true)
  })

  it('...and it praids the moment the cell list is padded — nothing else changes', () => {
    configureTwoZones([-1, -1]) // same INTENT ("start at cell 1"), same zones, same equips
    ;(globalThis as any).game.global.world = 60
    mapfunctions.RPraid(false)
    expect((globalThis as any).Rshoulddopraid).toBe(true)
  })

  it('the coercion that caused it: [-1] != 0 is TRUE', () => {
    // Pins the coercion itself, so a future reader does not have to re-derive it.
    expect(([-1] as unknown as number) != 0).toBe(true)
    expect(([-1] as unknown as number) != -1).toBe(false)
    expect(([0] as unknown as number) != 0).toBe(false)
  })
})
