import { describe, it, expect } from 'vitest'

// #116 — `MaxMapBonusAfterZone = 0` is documented as "apply it from the very first zone", i.e. ALWAYS.
// But equipment.ts gated on `getPageSetting('MaxMapBonusAfterZone') && doMaxMapBonus`, and `0` is FALSY
// — so the one value documented as "always" was the one value that silently switched the armor-delay
// branch off. Its sentinel is the mirror image: `-1` means "off" and is TRUTHY.
//
// The authority on what this setting means is maps.ts:476:
//
//     doMaxMapBonus = (maxMapBonusZ >= 0 && mapBonus < MaxMapBonuslimit && world >= maxMapBonusZ)
//
// which ALREADY encodes "the setting is enabled" via `>= 0`. So the extra `getPageSetting(...) &&` in
// equipment.ts was pure redundancy whose only effect was the bug. The fix deletes it.
//
// This test pins the SEMANTICS of that flag rather than re-deriving them, because the L0 net cannot see
// this: `maxmap` only widens an armor-buy condition, and the traces record buy events, not the gate.

/** maps.ts:476, transcribed. This is the definition of "is Max Map Bonus active right now". */
const doMaxMapBonus = (maxMapBonusZ: number, mapBonus: number, limit: number, world: number) =>
  maxMapBonusZ >= 0 && mapBonus < limit && world >= maxMapBonusZ

/** equipment.ts:470 BEFORE #116 — the redundant guard, with JS truthiness applied to the sentinel. */
const maxmapBefore = (setting: number, flag: boolean) => Boolean(setting && flag)
/** equipment.ts:470 AFTER #116 — the flag alone, which already means what the guard was trying to ask. */
const maxmapAfter = (_setting: number, flag: boolean) => flag

describe('#116: MaxMapBonusAfterZone = 0 means ALWAYS, and 0 is falsy', () => {
  // A player at zone 5, below their map-bonus cap, with the setting at 0 ("from the very first zone").
  const flagAt0 = doMaxMapBonus(0, 3, 10, 5)
  const flagAtMinus1 = doMaxMapBonus(-1, 3, 10, 5)
  const flagAt3 = doMaxMapBonus(3, 3, 10, 5)

  it('anti-false-green: the transcribed flag itself behaves as maps.ts defines it', () => {
    expect(flagAt0).toBe(true) //  0 => enabled from zone 0 => on
    expect(flagAtMinus1).toBe(false) // -1 => disabled
    expect(flagAt3).toBe(true) //  world 5 >= zone 3 => on
  })

  it('THE BUG: at 0 the feature is on, but the old guard reported OFF', () => {
    expect(flagAt0).toBe(true)
    expect(maxmapBefore(0, flagAt0)).toBe(false) // <- the defect: "always" silently meant "never"
    expect(maxmapAfter(0, flagAt0)).toBe(true) //  <- fixed
  })

  it('the fix changes NOTHING for any other value — it only removes a redundant guard', () => {
    // -1 (off): the flag is already false, so both agree. The old guard's truthiness on -1 never
    // mattered precisely because doMaxMapBonus had already excluded it.
    expect(maxmapBefore(-1, flagAtMinus1)).toBe(maxmapAfter(-1, flagAtMinus1))
    // a positive zone (on): both agree.
    expect(maxmapBefore(3, flagAt3)).toBe(maxmapAfter(3, flagAt3))
    // and when the flag is off for any reason (cap reached), both agree.
    const capped = doMaxMapBonus(3, 10, 10, 5)
    expect(capped).toBe(false)
    expect(maxmapBefore(3, capped)).toBe(maxmapAfter(3, capped))
  })

  it('0 is the ONLY value the fix changes', () => {
    const zones = [-1, 0, 1, 2, 3, 5, 10]
    const changed = zones.filter((z) => {
      const flag = doMaxMapBonus(z, 3, 10, 5)
      return maxmapBefore(z, flag) !== maxmapAfter(z, flag)
    })
    expect(changed).toEqual([0])
  })
})
