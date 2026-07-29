// @vitest-environment jsdom
// (nature.ts imports utils.ts, which builds the AutoTrimps log-filter button at module load.)
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as nature from '../src/modules/nature'

// #168 — the convert-rate parity gap, and #183 — the exact-match Enlightenment no-op.
//
// #168 is the canonical "a fix landed on ONE of two copies" failure. da366a3d (#22) corrected
// `(nature.purchased) ? ((nature2.purchased) ? 8 : 6) : 5` to the game's `(nature.purchased) ? 8 : 5`
// in the 'Convert to Both' branch, and the byte-identical expression 13 lines below it — the
// single-target "Convert to X" branch, which is what the shipped 550 preset actually configures
// (utils.ts:54 defaults AutoWind and AutoIce to "Convert to Poison") — was left alone for seven years.
// The authoritative rate is .trimps-game/main.js:8551; nature2 adds levels only (config.js:2286).
//
// The consequence is destructive rather than merely inaccurate: autoNatureTokens mutates
// game.empowerments[target].tokens DIRECTLY instead of calling native naturePurchase('convert', …),
// so the shortfall between the 10 deducted and the 6 credited is destroyed on every conversion, every
// tick the branch runs.

// getPageSetting reads `.selected` for a dropdown and parseFloat(`.value`) for a value (utils.ts:78).
function setSettings(over: Record<string, unknown>) {
  ;(globalThis as any).autoTrimpSettings = Object.fromEntries(
    Object.entries(over).map(([k, v]) =>
      typeof v === 'number'
        ? [k, { type: 'value', value: v }]
        : [k, { type: 'dropdown', selected: v }],
    ),
  )
}

function makeEmpowerments(tokens: Record<string, number>) {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(tokens)) out[k] = { tokens: v, level: 1, retainLevel: 1, nextUberCost: 0 }
  return out
}

beforeEach(() => {
  ;(globalThis as any).updateNatureInfoSpans = vi.fn()
  ;(globalThis as any).getNextNatureCost = vi.fn(() => 1e9)
  ;(globalThis as any).naturePurchase = vi.fn()
})

describe('autoNatureTokens convert rate (#168)', () => {
  // The tokens are conserved at the game's 10-for-8 trade. At the buggy 10-for-6 the target lands on
  // 6 and two tokens vanish from the economy entirely.
  it('single-target "Convert to X" credits 8 with Natural Diplomacy I, matching the game', () => {
    setSettings({ AutoPoison: 'Off', AutoWind: 'Convert to Poison', AutoIce: 'Off', tokenthresh: 0 })
    ;(globalThis as any).game = {
      talents: { nature: { purchased: true }, nature2: { purchased: false } },
      empowerments: makeEmpowerments({ Poison: 0, Wind: 100, Ice: 0 }),
    }
    nature.autoNatureTokens()
    expect((globalThis as any).game.empowerments.Wind.tokens).toBe(90)
    expect((globalThis as any).game.empowerments.Poison.tokens).toBe(8)
  })

  // nature2 must not change the trade — that is the specific thing #22 established and this copy
  // still contradicted. A mutant restoring the `nature2 ? 8 : 6` ternary passes the test above only
  // if nature2 is set, so drive BOTH talent states.
  it('Natural Diplomacy II does not change the rate', () => {
    setSettings({ AutoPoison: 'Off', AutoWind: 'Convert to Poison', AutoIce: 'Off', tokenthresh: 0 })
    ;(globalThis as any).game = {
      talents: { nature: { purchased: true }, nature2: { purchased: true } },
      empowerments: makeEmpowerments({ Poison: 0, Wind: 100, Ice: 0 }),
    }
    nature.autoNatureTokens()
    expect((globalThis as any).game.empowerments.Poison.tokens).toBe(8)
  })

  it('without Natural Diplomacy the rate is 5', () => {
    setSettings({ AutoPoison: 'Off', AutoWind: 'Convert to Poison', AutoIce: 'Off', tokenthresh: 0 })
    ;(globalThis as any).game = {
      talents: { nature: { purchased: false }, nature2: { purchased: false } },
      empowerments: makeEmpowerments({ Poison: 0, Wind: 100, Ice: 0 }),
    }
    nature.autoNatureTokens()
    expect((globalThis as any).game.empowerments.Poison.tokens).toBe(5)
  })

  // The sibling branch #22 already fixed, pinned here so the two copies can never drift apart again
  // without a test noticing. 'Convert to Both' deducts 10 per target.
  it('"Convert to Both" uses the same rate as the single-target branch', () => {
    setSettings({ AutoPoison: 'Off', AutoWind: 'Convert to Both', AutoIce: 'Off', tokenthresh: 0 })
    ;(globalThis as any).game = {
      talents: { nature: { purchased: true }, nature2: { purchased: false } },
      empowerments: makeEmpowerments({ Poison: 0, Wind: 100, Ice: 0 }),
    }
    nature.autoNatureTokens()
    expect((globalThis as any).game.empowerments.Poison.tokens).toBe(8)
    expect((globalThis as any).game.empowerments.Ice.tokens).toBe(8)
  })
})

describe('autoEnlight exact-threshold match (#183)', () => {
  // The margin `threshold - nextUberCost` is 0 on an exact match, and the old `> 0` gate rejected it.
  // nextUberCost only moves on a purchase, so the state was frozen and AT never bought — a permanent
  // no-op for anyone who typed the figure the game itself displays.
  function runFiller(thresh: number, cost: number, tokens: number) {
    setSettings({
      pfillerenlightthresh: thresh,
      wfillerenlightthresh: -1,
      ifillerenlightthresh: -1,
    })
    ;(globalThis as any).game = {
      global: { challengeActive: '', runningChallengeSquared: false, uberNature: false },
      empowerments: {
        Poison: { tokens, nextUberCost: cost },
        Wind: { tokens: 0, nextUberCost: 1e9 },
        Ice: { tokens: 0, nextUberCost: 1e9 },
      },
    }
    nature.autoEnlight()
    return (globalThis as any).naturePurchase as ReturnType<typeof vi.fn>
  }

  it('buys when the cost EXACTLY equals the threshold', () => {
    const spy = runFiller(300, 300, 500)
    expect(spy).toHaveBeenCalledWith('uberEmpower', 'Poison')
  })

  it('still buys when the cost is below the threshold', () => {
    const spy = runFiller(300, 150, 500)
    expect(spy).toHaveBeenCalledWith('uberEmpower', 'Poison')
  })

  // The -999999 ineligible sentinel must still be excluded — `>= 0` is the fix, `>= -999999` is the
  // near-miss that would buy for a nature the player never enabled.
  it('does not buy when the cost is above the threshold', () => {
    const spy = runFiller(300, 450, 500)
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not buy when the tokens are short, even at an exact cost match', () => {
    const spy = runFiller(300, 300, 100)
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not buy when no threshold is configured', () => {
    setSettings({ pfillerenlightthresh: -1, wfillerenlightthresh: -1, ifillerenlightthresh: -1 })
    ;(globalThis as any).game = {
      global: { challengeActive: '', runningChallengeSquared: false, uberNature: false },
      empowerments: {
        Poison: { tokens: 1e9, nextUberCost: 0 },
        Wind: { tokens: 0, nextUberCost: 1e9 },
        Ice: { tokens: 0, nextUberCost: 1e9 },
      },
    }
    nature.autoEnlight()
    expect((globalThis as any).naturePurchase).not.toHaveBeenCalled()
  })
})
