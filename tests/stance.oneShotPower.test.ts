// @vitest-environment jsdom
// (stance.ts reaches utils.ts, which builds the AutoTrimps log-filter button at module load.)
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// #182 — oneShotPower(specificStance, offset, maxOrMin) declared `specificStance` and never read it.
//
// scryer.ts:113-116 calls it four times meaning "one-shot power in Scryer" vs "one-shot power in D":
//
//     var HS       = oneShotPower(scryF)            // Scryer, MIN damage
//     var HSD      = oneShotPower("D", 0, true)     // D,      MAX damage
//
// With the argument ignored, both ran at the CURRENT formation and differed only in maxOrMin. Since
// oneShotPower is monotone non-decreasing in base damage, HS <= HSD always, so the gate `HS >= HSD`
// silently collapsed to `HS === HSD` — and the halving that entering Scryer actually costs was never
// modelled at all. The gate exists to stop AT switching to Scryer when doing so would LOSE the
// overkill, which is precisely the case it could not see.
//
// The multipliers come from setFormation's "apply the new formation" switch
// (.trimps-game/main.js:16877-16897): H /2, D *4, B /2, S /2, and W has no case — neutral.

let stance: typeof import('../src/modules/stance')

const g = () => globalThis as any

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  stance = await import('../src/modules/stance')
})

/**
 * Enemies of uniform `health`, unlimited in number. Base damage is whatever calcOurDmg returns.
 *
 * Overkill level 200 makes the carry-over factor `0.005 * level` exactly 1, so leftover damage rolls
 * into the next enemy undiminished and the answer is simply floor(damage / health). Any lower level
 * decays the remainder geometrically and the count stops telling us about the FORMATION, which is
 * the only variable under test here.
 */
function scenario(baseDamage: number, enemyHealth: number) {
  g().game = {
    global: { formation: 0, soldierHealth: 1e9, soldierHealthMax: 1e9, uberNature: 'Ice' },
    portal: { Overkill: { level: 200 } },
    // maxOneShotPower is module-internal, so a global stub cannot intercept it (the #127/#129
    // lesson) — arm the real one instead. 2 base + 1 overkill mastery + 2 uber Ice + 1 each at Ice
    // level 50 and 100 = a ceiling of 7, comfortably above every count asserted below so the CAP is
    // never what the assertions are actually measuring.
    talents: { overkill: { purchased: true } },
    empowerments: { Ice: { getLevel: () => 100 } },
  }
  g().autoTrimpSettings = {}
  g().getEmpowerment = vi.fn(() => 'Ice')
  g().calcOurDmg = vi.fn(() => baseDamage)
  g().addPoison = vi.fn(() => 0)
  g().getCurrentEnemy = vi.fn(() => ({ health: enemyHealth, level: 1 }))
  g().calcSpecificEnemyHealth = vi.fn(() => enemyHealth)
}

const MAX_POWER = 7

describe('oneShotPower honours specificStance (#182)', () => {
  // 100 damage against 60-health enemies: neutral one-shots 1, D (×4) one-shots 6, S (÷2) none.
  beforeEach(() => scenario(100, 60))

  it('the fixture ceiling is not what these assertions measure', () => {
    expect(stance.maxOneShotPower()).toBe(MAX_POWER)
  })

  it('D scales damage by 4', () => {
    expect(stance.oneShotPower(undefined)).toBe(1) // 100 / 60
    expect(stance.oneShotPower('D')).toBe(6) // 400 / 60, still under the ceiling
  })

  // S/H/B halve it. This is the direction the Scryer gate needed and never had.
  it('S, H and B each halve damage', () => {
    for (const f of ['S', 'H', 'B']) {
      expect(stance.oneShotPower(f), f).toBe(0) // 50 < 60 → cannot one-shot at all
    }
  })

  it('W and XB are neutral — setFormation has no case for either', () => {
    for (const f of ['W', 'XB', undefined]) {
      expect(stance.oneShotPower(f), String(f)).toBe(1)
    }
  })

  // THE GATE. Pre-fix, HS and HSD were the same formation and the comparison was vacuous.
  it('the Scryer gate can now see that switching to S loses the overkill', () => {
    const HS = stance.oneShotPower('S') // 50 vs 60 → cannot one-shot
    const HSD = stance.oneShotPower('D', 0, true) // 400 vs 60 → six
    expect(HS).toBe(0)
    expect(HSD).toBe(6)
    // scryer.ts:117 requires `HS > 0 && HS >= HSD` before setFormation(scry).
    expect(HS > 0 && HS >= HSD).toBe(false)
  })

  it('and still allows the switch when Scryer really does keep the one-shot', () => {
    // Enemy so weak that even halved damage reaches the ceiling, so Scryer costs nothing.
    scenario(1e6, 1)
    const HS = stance.oneShotPower('S')
    const HSD = stance.oneShotPower('D', 0, true)
    expect(HS).toBe(MAX_POWER)
    expect(HS > 0 && HS >= HSD).toBe(true)
  })

  // The mutant that matters most: dropping the argument entirely (the pre-fix state) makes the two
  // calls differ only in maxOrMin, so the gate reduces to an equality test.
  it('the two Scryer calls are no longer the same formation', () => {
    expect(stance.oneShotPower('S')).not.toBe(stance.oneShotPower('D'))
  })

  // stance.ts keeps TWO copies of this table — this one (damage only) and survive()'s (damage,
  // health and block together). Pin them against each other so they cannot drift apart, which is the
  // #168 failure mode.
  it("survive()'s formation table still agrees on the damage factor", () => {
    const src = readFileSync(resolve(__dirname, '../src/modules/stance.ts'), 'utf8')
    // survive(): `else if (formation === "D") {minDamage *= 4; ...}` etc.
    expect(src).toMatch(/formation === "D"\)\s*\{minDamage \*= 4/)
    for (const f of ['B', 'H', 'S']) {
      expect(src, f).toMatch(new RegExp(`formation === "${f}"\\)\\s*\\{minDamage /= 2`))
    }
  })
})
