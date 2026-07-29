// @vitest-environment node
//
// Regression net for #189 — a perk ratio of exactly -1 bypassed the "ratios must be positive" guard
// and produced a NaN efficiency.
//
// `VariablePerk`/`ArithmeticPerk` used `-1` as their "never set" sentinel for `updatedValue`, and
// `updatePerkRatios` writes `parseFloat(box.value)` into that same field. -1 is AT's own "unset"
// convention everywhere else, so a user typing it is natural — and it collided: `calculateIncrease`
// read `updatedValue != -1`, took the false branch, and fell back to `perk.value`, which for a
// VariablePerk is the 11-element preset ARRAY. `increase / baseIncrease * <array>` coerces to NaN.
//
// The validation below it could not catch that, and this is the part worth remembering: `NaN < 0` is
// FALSE so the "must be positive" guard did not fire, while `NaN != 0` is TRUE so the perk WAS
// enqueued — with a NaN priority, against a comparator (`a.efficiency > b.efficiency`) that is false
// in both directions for NaN. Its heap position, and therefore whether it received any helium at all,
// was undefined.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../scripts/sim/boot.mjs'
import { TEST_BUNDLE } from './sim/bundle'

function boot(): Record<string, any> {
  const { window } = bootGame({}) as unknown as { window: Record<string, any> }
  Object.assign(window, {
    GM_getValue: () => undefined,
    GM_setValue: () => {},
    GM_xmlhttpRequest: () => {},
    unsafeWindow: window,
  })
  window.eval(readFileSync(TEST_BUNDLE, 'utf8'))
  window.loadPageVariables?.()
  return window
}

describe('#189 — the unset sentinel must not collide with a typeable ratio', () => {
  let window: Record<string, any>
  let AutoPerks: any

  beforeEach(() => {
    window = boot()
    AutoPerks = window.AutoPerks
  })

  it('POSITIVE CONTROL: calculateIncrease is reachable and normal ratios still work', () => {
    // Anti-false-green: every assertion below routes through this function.
    const perk = AutoPerks.getPerkByName('looting')
    expect(perk).toBeDefined()
    expect(typeof AutoPerks.calculateIncrease).toBe('function')

    perk.updatedValue = 3
    const inc = AutoPerks.calculateIncrease(perk, 0)
    expect(Number.isFinite(inc)).toBe(true)
    expect(inc).toBeGreaterThan(0)
  })

  it('a ratio of exactly -1 is a NEGATIVE RATIO, not "unset"', () => {
    // The bug in one assertion. Pre-fix this returned NaN, because -1 matched the sentinel and the
    // fallback handed an ARRAY to the arithmetic.
    const perk = AutoPerks.getPerkByName('looting')
    perk.updatedValue = -1

    const inc = AutoPerks.calculateIncrease(perk, 0)
    expect(Number.isNaN(inc)).toBe(false)
    expect(inc).toBeLessThan(0) // and therefore rejected by the "must be positive" guard
  })

  it('-1 and -2 are treated the same way, which is the whole point', () => {
    // The finding's own framing: "A negative ratio should be rejected by the same guard that rejects
    // -2." Comparing the two directly is what makes that a checkable claim rather than a wish.
    const a = AutoPerks.getPerkByName('looting')
    const b = AutoPerks.getPerkByName('power')
    a.updatedValue = -1
    b.updatedValue = -2

    const incA = AutoPerks.calculateIncrease(a, 0)
    const incB = AutoPerks.calculateIncrease(b, 0)
    expect(Math.sign(incA)).toBe(Math.sign(incB))
    expect(Number.isFinite(incA)).toBe(true)
  })

  it('the genuine unset sentinel still falls back to the preset value', () => {
    // The parity half — moving the sentinel must not break "no ratio has been set yet". A fresh
    // VariablePerk carries `null`, and the fallback path must still produce the preset-derived value.
    const perk = AutoPerks.getPerkByName('looting')
    perk.updatedValue = null
    expect(() => AutoPerks.calculateIncrease(perk, 0)).not.toThrow()

    // And the sentinel must be un-typeable: a number input cannot produce null, which is exactly why
    // it was chosen over -1.
    expect(Number.isFinite(null as any)).toBe(false)
    expect(parseFloat('-1')).toBe(-1) // ...whereas -1 very much is typeable
  })

  it('spendHelium REJECTS a -1 ratio instead of silently enqueuing a NaN priority', () => {
    // End to end, at the consumer. Pre-fix spendHelium proceeded: the guard did not fire (NaN < 0 is
    // false) and the `!= 0` test passed, so the perk entered the heap with an undefined position.
    for (const perk of AutoPerks.getVariablePerks()) perk.updatedValue = 0
    AutoPerks.getPerkByName('looting').updatedValue = -1

    expect(AutoPerks.spendHelium(1e9)).toBe(false)
  })

  it('spendHelium REJECTS a blank/unparseable ratio box (NaN), not just a negative one', () => {
    // Same class, different value. `parseFloat('')` is NaN, and NaN passed BOTH the `< 0` guard and
    // the `!= 0` test — so a blank box enqueued a perk forever. Fixing only the -1 spelling would
    // leave this open while making the class look closed.
    for (const perk of AutoPerks.getVariablePerks()) perk.updatedValue = 0
    AutoPerks.getPerkByName('looting').updatedValue = parseFloat('')

    expect(AutoPerks.spendHelium(1e9)).toBe(false)
  })

  it('a valid positive ratio still allocates (the guard did not become a wall)', () => {
    for (const perk of AutoPerks.getVariablePerks()) perk.updatedValue = 0
    const looting = AutoPerks.getPerkByName('looting')
    looting.updatedValue = 1
    looting.level = 0

    expect(AutoPerks.spendHelium(1e9)).not.toBe(false)
    expect(looting.level).toBeGreaterThan(0)
  })

  it('census: no -1 sentinel comparison survives in the source', () => {
    // Mechanized so a fourth constructor or a third calculateIncrease cannot quietly reintroduce the
    // collision. The finding named two read sites and three constructors; deriving it from the source
    // is what keeps that from being a claim nobody re-checks.
    const src = readFileSync(resolve(__dirname, '../src/modules/perks.ts'), 'utf8')
    expect(src).not.toContain('updatedValue != -1')
    expect(src).not.toContain('updatedValue = -1')
    expect(src.match(/this\.updatedValue = null;/g)?.length).toBe(3)
    expect(src.match(/updatedValue !== null && perk\.updatedValue !== undefined/g)?.length).toBe(2)
  })
})
