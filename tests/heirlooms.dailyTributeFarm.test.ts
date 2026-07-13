// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'

// #71b regression — Rdheirloomswap() read `Rdshouldtributefarm`, a name NOTHING in the shipped bundle
// ever assigns. A bare read of a never-created identifier is a ReferenceError, not a benign undefined,
// so the U2-Daily staff-swap block THREW every tick for any Daily player with a daily map-staff set,
// taking the whole tail of the mainLoop tick with it (there is no error boundary — #87).
//
// There is no daily variant of the tribute-farm flag and there should not be: mapfunctions.ts writes
// `Rshouldtributefarm` regardless of Daily, and Rheirloomswap()'s staff block — line-for-line identical
// to this one modulo the `Rd` prefix — reads that real flag. The fix reads it here too.
//
// NOT fixed by seeding `globalThis.Rdshouldtributefarm = false`: that swaps a crash for a permanently
// dead tribute-staff arm, which is a worse bug because it looks like it works.

let heirlooms: typeof import('../src/modules/heirlooms')

// The carried heirlooms the equip functions select from, by index.
const WORLD = { name: 'WorldStaff' }
const MAP = { name: 'MapStaff' }
const TRIBUTE = { name: 'TributeStaff' }
const CARRIED = [WORLD, MAP, TRIBUTE]

beforeAll(async () => {
  ;(globalThis as any).game = { options: { menu: { showHeirloomAnimations: { enabled: false } } } }
  heirlooms = await import('../src/modules/heirlooms')
})

/**
 * Arm the daily staff-swap block, in a map, with a tribute staff configured.
 *
 * ⚠️ Two DISTINCT setting families are seeded here, and that is not redundancy — it is a FINDING.
 * Rdheirloomswap GATES on the daily ids (Rdhsstaff / Rdhsmapstaff / Rdhstributestaff) but then calls the
 * NON-daily equip functions (Rhsmapstaffequip / Rhstributestaffequip), which look the heirloom up by the
 * NON-daily ids (Rhsmapstaff / Rhstributestaff). See the "cross-wired" test at the bottom.
 */
function armDailyStaffSwap() {
  ;(globalThis as any).autoTrimpSettings = {
    Rdhsshield: { type: 'boolean', enabled: false }, // shields off — isolate the staff block
    Rdhsz: { type: 'value', value: '-1' },
    // the DAILY ids — these are the gates Rdheirloomswap actually reads
    Rdhsstaff: { type: 'boolean', enabled: true },
    Rdhsworldstaff: { type: 'textValue', value: 'undefined' }, // no world staff — isolate map/tribute
    Rdhsmapstaff: { type: 'textValue', value: 'MapStaff' },
    Rdhstributestaff: { type: 'textValue', value: 'TributeStaff' },
    // the NON-DAILY ids — these are what the equip functions it calls actually resolve against
    Rhsworldstaff: { type: 'textValue', value: 'WorldStaff' },
    Rhsmapstaff: { type: 'textValue', value: 'MapStaff' },
    Rhstributestaff: { type: 'textValue', value: 'TributeStaff' },
  }
  ;(globalThis as any).game = {
    global: {
      world: 100,
      mapsActive: true,
      heirloomsCarried: CARRIED,
      StaffEquipped: { name: 'SomethingElse' }, // != either target, so a swap is warranted
    },
  }
}

/** The real observable: which carried heirloom index got selected + equipped. */
function equippedIndex(): number | undefined {
  const sel = (globalThis as any).selectHeirloom as ReturnType<typeof vi.fn>
  if (sel.mock.calls.length === 0) return undefined
  return sel.mock.calls[0][0] as number
}

beforeEach(() => {
  ;(globalThis as any).selectHeirloom = vi.fn()
  ;(globalThis as any).equipHeirloom = vi.fn()
  armDailyStaffSwap()
})

describe('#71b: Rdheirloomswap reads the real tribute-farm flag (was ReferenceError every tick)', () => {
  it('the phantom `Rdshouldtributefarm` is created by nothing, anywhere — reading it WOULD throw', () => {
    // The severity pin. Nothing in the bundle writes it, so it is absent from the global object —
    // which is precisely why the old bare read was a ReferenceError and not a benign `undefined`.
    // If this name ever gains a definition, the class changes shape and this must be re-triaged.
    expect('Rdshouldtributefarm' in globalThis).toBe(false)
  })

  it('does not throw while tribute-farming (the exact tick that used to crash)', () => {
    ;(globalThis as any).Rshouldtributefarm = true
    expect(() => heirlooms.Rdheirloomswap()).not.toThrow()
    expect((globalThis as any).equipHeirloom).toHaveBeenCalledOnce()
  })

  it('tribute-farming in a map → equips the TRIBUTE staff', () => {
    ;(globalThis as any).Rshouldtributefarm = true
    heirlooms.Rdheirloomswap()
    expect(equippedIndex()).toBe(CARRIED.indexOf(TRIBUTE))
  })

  it('NOT tribute-farming in a map → equips the MAP staff', () => {
    ;(globalThis as any).Rshouldtributefarm = false
    heirlooms.Rdheirloomswap()
    expect(equippedIndex()).toBe(CARRIED.indexOf(MAP))
  })

  it('the two arms are mutually exclusive and driven solely by the flag', () => {
    // The whole claim of the fix is "make the daily block branch like its working twin". Assert the
    // flag — and nothing else — selects the arm, so a future edit that re-breaks the read fails here.
    const byFlag: Record<string, number | undefined> = {}
    for (const farming of [true, false]) {
      ;(globalThis as any).selectHeirloom = vi.fn()
      ;(globalThis as any).equipHeirloom = vi.fn()
      ;(globalThis as any).Rshouldtributefarm = farming
      heirlooms.Rdheirloomswap()
      expect((globalThis as any).equipHeirloom).toHaveBeenCalledOnce()
      byFlag[String(farming)] = equippedIndex()
    }
    expect(byFlag).toEqual({ true: CARRIED.indexOf(TRIBUTE), false: CARRIED.indexOf(MAP) })
  })

  it('with no tribute staff configured, the map staff is equipped even while tribute-farming', () => {
    // The `|| getPageSetting('Rdhstributestaff') == "undefined"` disjunct — unreachable before the fix,
    // because the ReferenceError on the same line preceded it.
    ;(globalThis as any).Rshouldtributefarm = true
    ;(globalThis as any).autoTrimpSettings.Rdhstributestaff.value = 'undefined'
    heirlooms.Rdheirloomswap()
    expect(equippedIndex()).toBe(CARRIED.indexOf(MAP))
  })

  it('outside a map, neither staff arm fires (mapsActive gate)', () => {
    ;(globalThis as any).Rshouldtributefarm = true
    ;(globalThis as any).game.global.mapsActive = false
    heirlooms.Rdheirloomswap()
    expect((globalThis as any).equipHeirloom).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// A SEPARATE, UNFILED DEFECT found while writing the above. NOT fixed here — pinned so it cannot be
// fixed silently, and so the next person finds it already reproduced.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('FINDING (unfiled): Rdheirloomswap is cross-wired to the NON-daily equip functions', () => {
  it('gates on the DAILY ids but equips by the NON-DAILY ids', () => {
    // Rdheirloomswap gates on Rdhsmapstaff/Rdhstributestaff, then calls Rhsmapstaffequip /
    // Rhstributestaffequip — which resolve the heirloom by Rhsmapstaff / Rhstributestaff. So a Daily
    // player's configured DAILY staff names are read only as on/off gates; the heirloom actually
    // equipped is whichever their NON-DAILY config names. Proof: point the two families at different
    // heirlooms and watch the non-daily one win.
    ;(globalThis as any).Rshouldtributefarm = true
    ;(globalThis as any).autoTrimpSettings.Rdhstributestaff.value = 'TributeStaff' // daily gate: on
    ;(globalThis as any).autoTrimpSettings.Rhstributestaff.value = 'WorldStaff' // non-daily: elsewhere
    heirlooms.Rdheirloomswap()
    // If the daily block honored its own config this would be TRIBUTE. It equips WORLD.
    expect(equippedIndex()).toBe(CARRIED.indexOf(WORLD))
    expect(equippedIndex()).not.toBe(CARRIED.indexOf(TRIBUTE))
  })

  it('the five real daily equip twins exist and have ZERO callers (dead code)', () => {
    // Rdhsequip1/2, Rdhsworldstaffequip, Rdhsmapstaffequip, Rdhstributestaffequip are fully written and
    // read the daily ids correctly — nothing calls any of them. They are what Rdheirloomswap SHOULD be
    // calling. Exported (so they are reachable), so pin their existence: the fix is a five-line
    // re-point, and this test is the reason it will not get lost.
    for (const fn of [
      'Rdhsequip1', 'Rdhsequip2', 'Rdhsworldstaffequip', 'Rdhsmapstaffequip', 'Rdhstributestaffequip',
    ] as const) {
      expect(typeof heirlooms[fn], `${fn} should exist`).toBe('function')
    }
  })
})
