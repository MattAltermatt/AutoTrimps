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
// #97 — filed and FIXED. This block was committed as `FINDING (unfiled)` (a live reproduction of the
// defect) precisely so it could not be closed silently; it is now the regression test.
//
// Rdheirloomswap GATED on the daily ids but CALLED the non-daily equip functions, which resolve the
// heirloom by the non-daily ids. So a Daily player's daily staff/shield names acted only as on/off
// gates and the heirloom actually equipped was whatever their NON-daily config named. The five daily
// twins (Rdhsequip1/2, Rdhs{world,map,tribute}staffequip) already existed and had zero callers; the
// fix re-points the five call sites at them.
//
// Every assertion below is written so it FAILS against the cross-wired version: the two setting
// families are pointed at DIFFERENT heirlooms, so "which loom got equipped" is the discriminator.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('#97: Rdheirloomswap equips by its OWN (daily) ids, not the non-daily ones', () => {
  it('tribute staff: the DAILY id decides, even when the non-daily id names another loom', () => {
    ;(globalThis as any).Rshouldtributefarm = true
    ;(globalThis as any).autoTrimpSettings.Rdhstributestaff.value = 'TributeStaff' // daily config
    ;(globalThis as any).autoTrimpSettings.Rhstributestaff.value = 'WorldStaff' // non-daily decoy
    heirlooms.Rdheirloomswap()
    expect(equippedIndex()).toBe(CARRIED.indexOf(TRIBUTE)) // was WORLD before the fix
  })

  it('map staff: the DAILY id decides, even when the non-daily id names another loom', () => {
    ;(globalThis as any).Rshouldtributefarm = false // → the map-staff arm
    ;(globalThis as any).autoTrimpSettings.Rdhsmapstaff.value = 'MapStaff' // daily config
    ;(globalThis as any).autoTrimpSettings.Rhsmapstaff.value = 'WorldStaff' // non-daily decoy
    heirlooms.Rdheirloomswap()
    expect(equippedIndex()).toBe(CARRIED.indexOf(MAP)) // was WORLD before the fix
  })

  it('world staff: the DAILY id decides, even when the non-daily id names another loom', () => {
    ;(globalThis as any).game.global.mapsActive = false // → the world-staff arm
    ;(globalThis as any).autoTrimpSettings.Rdhsworldstaff.value = 'WorldStaff' // daily config
    ;(globalThis as any).autoTrimpSettings.Rhsworldstaff.value = 'MapStaff' // non-daily decoy
    heirlooms.Rdheirloomswap()
    expect(equippedIndex()).toBe(CARRIED.indexOf(WORLD)) // was MAP before the fix
  })

  it('shields: the DAILY zone-split ids decide which shield is equipped, not Rhs1/Rhs2', () => {
    // The shield arm was cross-wired the same way: gated on Rdhsz, but called Rhsequip1/Rhsequip2,
    // which look the shield up by Rhs1/Rhs2. Below z50 the daily config names WORLD; the non-daily
    // decoy names MAP. Above z50 they swap. Both directions are asserted so a half-fix fails.
    const SHIELDS = {
      Rdhsshield: { type: 'boolean', enabled: true },
      Rdhsstaff: { type: 'boolean', enabled: false }, // staffs off — isolate the shield block
      Rdhsz: { type: 'value', value: '50' },
      Rdhs1: { type: 'textValue', value: 'WorldStaff' }, // daily: below z50
      Rdhs2: { type: 'textValue', value: 'TributeStaff' }, // daily: from z50
      Rhs1: { type: 'textValue', value: 'MapStaff' }, // non-daily decoys
      Rhs2: { type: 'textValue', value: 'MapStaff' },
    }
    for (const [world, want] of [[10, WORLD], [80, TRIBUTE]] as const) {
      ;(globalThis as any).selectHeirloom = vi.fn()
      ;(globalThis as any).equipHeirloom = vi.fn()
      ;(globalThis as any).autoTrimpSettings = { ...SHIELDS }
      ;(globalThis as any).game.global.world = world
      ;(globalThis as any).game.global.ShieldEquipped = { name: 'SomethingElse' }
      heirlooms.Rdheirloomswap()
      expect((globalThis as any).equipHeirloom, `z${world}`).toHaveBeenCalledOnce()
      expect(equippedIndex(), `z${world}`).toBe(CARRIED.indexOf(want)) // was MAP before the fix
    }
  })

  it('the five daily equip twins are the ones Rdheirloomswap calls — none is dead code any more', () => {
    // The mechanical half of the pin: no `Rhs*equip` call may survive inside Rdheirloomswap. Reading
    // the source keeps this honest even if someone re-points one call site back by hand.
    const body = heirlooms.Rdheirloomswap.toString()
    for (const fn of [
      'Rdhsequip1', 'Rdhsequip2', 'Rdhsworldstaffequip', 'Rdhsmapstaffequip', 'Rdhstributestaffequip',
    ] as const) {
      expect(typeof heirlooms[fn], `${fn} should exist`).toBe('function')
      expect(body, `Rdheirloomswap should call ${fn}`).toContain(fn)
    }
    // …and no non-daily equip call remains. (`\b` guards against Rdhsequip1 matching /Rhsequip1/.)
    for (const fn of [
      'Rhsequip1', 'Rhsequip2', 'Rhsworldstaffequip', 'Rhsmapstaffequip', 'Rhstributestaffequip',
    ] as const) {
      expect(new RegExp(`\\b${fn}\\b`).test(body), `Rdheirloomswap must NOT call ${fn}`).toBe(false)
    }
  })
})
