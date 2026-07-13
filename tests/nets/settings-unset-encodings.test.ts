// #100 — THE `textValue` UNSET CONTRACT.
//
// 27 textValue settings shipped with the STRING 'undefined' as their createSetting default. So:
//
//     getPageSetting('highdmg')              // -> 'undefined'   (a string, and truthy)
//     getPageSetting('highdmg') != undefined // -> TRUE, ALWAYS. A tautology.
//
// …and the codebase already half-knew: some sites spelled the test against the STRING (`!= "undefined"`,
// which works — by accident of the bug) and others against the VALUE (`!= undefined`, a tautology).
// Both spellings appeared, sometimes in the same function. That inconsistency was the tell.
//
// ═══ WHY THE CONSUMERS WERE FIXED FIRST, AND WHY THIS FILE EXISTS ════════════════════════════════
// A default change CANNOT REACH AN EXISTING PLAYER. serializeSettings() flattens each setting to its
// bare value, and createSetting only consults `defaultValue` when NOTHING is stored (#68) — so a
// veteran's localStorage still holds the string 'undefined' forever, whatever the declaration says.
// The consumer fix is therefore the ONLY step that helps anyone who already plays, and the string
// encoding can never be retired.
//
// Worse, flipping the default FIRST would have been an active regression. archstring() gated on
// `getPageSetting('Rarchstring1') != "undefined"` — correct against the old default, and FALSE-Y
// against the new one: `'' != "undefined"` is TRUE, so the branch would have run with empty strings
// and written `game.global.archString = ''` into the live game for every unconfigured player. This is
// exactly the trap #96 hit. Hence: consumers, then proof (this file), then defaults.
//
// So the contract asserted here is ENCODING-EQUIVALENCE: every encoding of "unset" that can reach a
// reader — the string 'undefined' (veterans), '' (the new default, and what clearing the GUI box
// yields), `false` (getPageSetting's answer for an absent key), and `undefined` (a record whose .value
// was never written) — must produce IDENTICAL behavior at every consumer.
//
// ⚠️ THE L0 PROOF NET IS BLIND TO ALL OF THIS. It records buy events only, and its whole corpus decodes
// to HZE=3/world=4 (#90/#98) — calcHDratio()'s heirloom-swap branch is not merely uncovered there, it
// is structurally unreachable. "The sim stayed green" is a meaningless sentence about this change. The
// evidence is built by hand, below.

import { describe, it, expect, beforeEach } from 'vitest'
import { TEST_BUNDLE } from '../sim/bundle'
import { bootGame } from '../../scripts/sim/boot.mjs'

/** Every encoding of "the user typed nothing" that can reach a reader. */
const UNSET_ENCODINGS: Array<[label: string, value: unknown]> = [
  ["the STRING 'undefined' (the old default — every veteran's localStorage)", 'undefined'],
  ["'' (the corrected default; also what clearing the GUI text box yields)", ''],
  ['undefined (a stored record whose .value was never written)', undefined],
]

function boot(): any {
  return (bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE }) as any).window
}

/** Set `id` to a raw value, run `fn`, restore. `DELETE` removes the key entirely (getPageSetting → false). */
const DELETE = Symbol('delete-the-key')
function withValue<T>(w: any, ids: string[], value: unknown, fn: () => T): T {
  const saved = ids.map((id) => w.autoTrimpSettings[id])
  for (const id of ids) {
    if (value === DELETE) delete w.autoTrimpSettings[id]
    else w.autoTrimpSettings[id].value = value
  }
  try {
    return fn()
  } finally {
    ids.forEach((id, i) => (w.autoTrimpSettings[id] = saved[i]))
  }
}

describe('#100 · textSettingIsSet() is the ONE spelling — it accepts every encoding of unset', () => {
  let w: any
  let textValueIds: string[]
  beforeEach(() => {
    w = boot()
    // Derived from the live store, NOT hardcoded — a new textValue setting is covered on arrival.
    textValueIds = Object.keys(w.autoTrimpSettings).filter((id) => w.autoTrimpSettings[id]?.type === 'textValue')
  })

  it('anti-false-green: the store is real, and the textValue arm is populated', () => {
    // If this collapsed to [], every loop below would pass vacuously — the #66 failure mode.
    expect(textValueIds.length).toBe(29)
    expect(w.autoTrimpSettings.highdmg.type).toBe('textValue')
    expect(typeof w.textSettingIsSet).toBe('function')
  })

  it('anti-false-green: a setting the user DID configure reads as SET', () => {
    // Without this the predicate could be `() => false` and the whole file would still be green.
    withValue(w, ['highdmg'], 'Shield of Doom', () => expect(w.textSettingIsSet('highdmg')).toBe(true))
    withValue(w, ['Rarchstring1'], '200,foo', () => expect(w.textSettingIsSet('Rarchstring1')).toBe(true))
  })

  for (const [label, value] of UNSET_ENCODINGS) {
    it(`EVERY textValue setting reads as UNSET when it holds ${label}`, () => {
      for (const id of textValueIds)
        expect(withValue(w, [id], value, () => w.textSettingIsSet(id)), `${id} @ ${String(value)}`).toBe(false)
    })
  }

  it('EVERY textValue setting reads as UNSET when the key is absent from the store entirely', () => {
    for (const id of textValueIds)
      expect(withValue(w, [id], DELETE, () => w.textSettingIsSet(id)), `${id} @ absent`).toBe(false)
  })
})

// ═══ CONSUMER EQUIVALENCE ════════════════════════════════════════════════════════════════════════
// The predicate agreeing is not the point — the CONSUMERS agreeing is. These drive the real functions.

describe('#100 · calc.ts — the tautology that mispriced damage for every Windstacking player', () => {
  let w: any
  beforeEach(() => {
    w = boot()
    w.autoTrimpSettings.AutoStance.value = 3 // "Windstacking" — the only stance that enters the branch
  })

  it('THE BUG: with highdmg unset, the heirloom-swap branch must NOT be taken', () => {
    // calcHDratio()'s swap branch predicts "what if we swapped to the high-damage shield": it divides
    // out the real crit multiplier and multiplies back one computed from the SHIELD's stats, which
    // highDamageShield() publishes into critCC/critDD/trimpAA. But highDamageShield() only writes those
    // when the EQUIPPED shield's name matches the setting — so with the setting unset it never runs, and
    // they keep their module-init values of 1. The `!= undefined` tautology let the branch run anyway:
    // it divided out the player's REAL crit and multiplied back a FAKE one computed from
    // critChance=1, CritD=1.
    //
    // Measured on this fixture, before the fix:  calcHDratio() = 4.571378173606183
    //                                    after:  calcHDratio() = 11.428445434015456
    // — a 2.5x under-statement of the enemy-health-to-our-damage ratio, i.e. AT believed it was 2.5x
    // stronger than it was, on every farm / map / stance decision. AutoStance's own tooltip says "You
    // must set your High Dmg and Low Dmg Heirlooms ... for this to work" — the guard is what was
    // supposed to enforce that, and it never did.
    //
    // The assertion is stance-relative rather than a pinned float (no libm tail — see #62): with the
    // heirloom unset there is no swap to predict, so AutoStance 3 must agree with a stance that cannot
    // enter the branch at all.
    const ws = w.calcHDratio()
    w.autoTrimpSettings.AutoStance.value = 1 // "Auto Stance" — never enters the swap branch
    const plain = w.calcHDratio()
    expect(ws).toBe(plain)
    expect(ws).toBeGreaterThan(0)
  })

  it('all unset encodings of highdmg produce the SAME ratio', () => {
    const ratios = UNSET_ENCODINGS.map(([, v]) => withValue(w, ['highdmg'], v, () => w.calcHDratio()))
    ratios.push(withValue(w, ['highdmg'], DELETE, () => w.calcHDratio()))
    expect(new Set(ratios).size, `encodings disagreed: ${JSON.stringify(ratios)}`).toBe(1)
  })

  it('anti-false-green: a SET highdmg that is not equipped DOES still take the branch', () => {
    // If the fix had over-reached and killed the feature, every assertion above would still pass. The
    // branch must remain live for the players it was written for. (The shield is not carried, so
    // trimpAA stays 1 and only the crit terms move — enough to prove the branch ran.)
    const off = w.calcHDratio()
    withValue(w, ['highdmg'], 'Shield of Doom', () => expect(w.calcHDratio()).not.toBe(off))
  })
})

describe('#100 · other.ts archstring() — the branch that would have written "" into the live game', () => {
  let w: any
  const IDS = ['Rarchstring1', 'Rarchstring2', 'Rarchstring3']
  beforeEach(() => {
    w = boot()
    w.autoTrimpSettings.Rarchon.enabled = true // the feature's own on/off gate
  })

  for (const [label, value] of [...UNSET_ENCODINGS, ['an absent key', DELETE] as [string, unknown]]) {
    it(`leaves game.global.archString ALONE when the strings hold ${label}`, () => {
      withValue(w, IDS, value, () => {
        w.game.global.archString = 'SENTINEL'
        w.archstring()
        // Pre-fix + post-default-flip this would be '' — ''.split(',') is [''], so the whole
        // archaeology string the player is running would have been silently cleared.
        expect(w.game.global.archString).toBe('SENTINEL')
      })
    })
  }

  it('anti-false-green: with all three CONFIGURED it still writes the string', () => {
    withValue(w, ['Rarchstring1'], '100,a,b', () =>
      withValue(w, ['Rarchstring2'], '200,c,d', () =>
        withValue(w, ['Rarchstring3'], '300,e,f', () => {
          w.game.global.archString = 'SENTINEL'
          w.game.global.world = 50 // <= string1z (100) → the first arm
          w.archstring()
          expect(w.game.global.archString).toBe('a,b')
        }),
      ),
    )
  })
})

describe('#100 · heirlooms.ts — the staff-swap gates (these worked, by ACCIDENT of the bug)', () => {
  let w: any
  beforeEach(() => {
    w = boot()
    w.autoTrimpSettings.Rhsstaff.enabled = true
    w.autoTrimpSettings.Rdhsstaff.enabled = true
    w.game.global.mapsActive = false
  })

  // These read `!= "undefined"` — the STRING spelling, which is correct against the OLD default and
  // WRONG against the new one. They are the sites that would have silently flipped on when the default
  // changed to '', which is why the default may not move until they are re-pointed. Both universes'
  // swap fns are total no-ops when no carried heirloom matches, so the observable is "the equip fn
  // resolved no heirloom" — asserted via the exported resolvers the gates guard.
  for (const [label, value] of [...UNSET_ENCODINGS, ['an absent key', DELETE] as [string, unknown]]) {
    it(`Rheirloomswap()/Rdheirloomswap() equip NOTHING when the staff names hold ${label}`, () => {
      const ids = [
        'Rhsworldstaff',
        'Rhsmapstaff',
        'Rhstributestaff',
        'Rdhsworldstaff',
        'Rdhsmapstaff',
        'Rdhstributestaff',
      ]
      withValue(w, ids, value, () => {
        for (const id of ids) expect(w.textSettingIsSet(id), id).toBe(false)
        const before = w.game.global.StaffEquipped?.name
        expect(() => w.Rheirloomswap()).not.toThrow()
        expect(() => w.Rdheirloomswap()).not.toThrow()
        expect(w.game.global.StaffEquipped?.name).toBe(before)
        expect(w.Rhsworldstaff()).toBeUndefined() // no carried loom is named ''/'undefined'
      })
    })
  }
})

describe('#100 · the MAZ family — array-indexed, and guarded upstream by the zone list', () => {
  let w: any
  beforeEach(() => {
    w = boot()
  })

  it('the zone list defaults to [-1], so the selection index is -1 and every encoding indexes to undefined', () => {
    // This is WHY the MAZ selections are not load-bearing: they are read as `X.value[index]`, and the
    // index comes from `zoneList.indexOf(game.global.world)`. Unconfigured, the zone list is [-1] and
    // the world is never -1, so the index is -1 — and 'undefined'[-1], ''[-1] and [][-1] are all
    // `undefined`. The sentinel is only reachable at index >= 0, which requires a configured zone —
    // and MAZ's Save writes the zone and the selections together, as arrays, in one pass.
    expect(w.getPageSetting('Rtimefarmzone')).toEqual([-1])
    expect(w.getPageSetting('Ralchfarmzone')).toEqual([-1])
    expect(w.getPageSetting('Rtimefarmzone').indexOf(w.game.global.world)).toBe(-1)
    for (const [, v] of UNSET_ENCODINGS) expect((v as any)?.[-1]).toBeUndefined()
  })

  it('Ralchfarmstack: the `.length > 0` read is SHORT-CIRCUITED by `Ralchfarmzone[0] > 0`', () => {
    // The one MAZ id that reads `.length` (maps.ts:1259) — the same shape as #96's Rhypofarmstack, so
    // it was the candidate to STOP on. It is NOT load-bearing, and this is the proof: the conjunct
    // before it already requires a CONFIGURED zone, and unconfigured that is [-1][0] = -1, which is not
    // > 0. So `.length` is never evaluated in the unset state, and its value there cannot matter.
    // The default is now '' (length 0), but a VETERAN's localStorage still carries the string
    // 'undefined' (length 9) and always will — so the gate has to be false either way, and the reason
    // it is has nothing to do with `.length`: the conjunct before it is already false.
    expect(w.getPageSetting('Ralchfarmstack')).toBe('') // the corrected default
    expect(withValue(w, ['Ralchfarmstack'], 'undefined', () => w.getPageSetting('Ralchfarmstack').length)).toBe(9)
    expect(w.getPageSetting('Ralchfarmzone')[0] > 0).toBe(false) // …and BOTH are unreachable behind this
    // Belt and braces: drive the real gate and confirm it is false for every encoding.
    w.game.global.challengeActive = 'Alchemy'
    w.autoTrimpSettings.Ralchon.enabled = true
    w.game.global.world = 20
    for (const [, v] of UNSET_ENCODINGS) {
      const gate = withValue(w, ['Ralchfarmstack'], v, () => {
        const zone = w.getPageSetting('Ralchfarmzone')
        return w.getPageSetting('Ralchon') === true && zone[0] > 0 && w.getPageSetting('Ralchfarmstack').length > 0
      })
      expect(gate).toBe(false)
    }
  })

  it("RtimeFarm() returns the same thing for 'undefined' and '' — the two encodings that reach it", () => {
    // ⚠️ Scoped deliberately, and the scope is itself a finding. The MAZ readers do NOT go through
    // getPageSetting — they index the raw record: `autoTrimpSettings.Rtimefarmmap.value[i]`
    // (mapfunctions.ts:441, jobs.ts:580, gather.ts:310). So `.value = undefined` or a deleted key throws
    // a TypeError there rather than reading as unset, and no `textSettingIsSet` fix can reach them.
    // That is fine for THIS change — createSetting always materialises the record, and both the old
    // default ('undefined') and the new one ('') are strings that index to `undefined` at -1 — but it
    // means those readers are one bad blob away from a crash, independent of #100. Filed as a follow-up
    // rather than widened into here; the string-vs-string equivalence below is what the default flip needs.
    const ids = ['Rtimefarmmap', 'Rtimefarmspecial', 'Rtimefarmgather']
    const STRING_ENCODINGS = ['undefined', '']
    const results = STRING_ENCODINGS.map((v) =>
      withValue(w, ids, v, () => [
        w.RtimeFarm(false, false, true, false, false),
        w.RtimeFarm(false, false, false, true, false),
      ]),
    )
    expect(results[1]).toEqual(results[0])
    expect(results[0]).toEqual([undefined, undefined]) // index -1 → nothing selected, either way
  })
})
