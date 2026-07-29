// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import ts from 'typescript'

// #169 / #170 — the gammaBurstPct contract.
//
// HISTORY. #49 fixed a precedence bug (`if (!rarity >= 10) return` parses as `(!rarity) >= 10`, always
// false) by adding a real `if (rarity < 10) return` gate. That repair looked right and was wrong twice
// over, and the version of this file it shipped with PINNED both wrongs as expected behaviour:
//
//   #169 — returning before BOTH assignments means a swap DOWN never CLEARS the previous shield's
//   credit. gammaBurstPct keeps a Hazardous shield's value (>= 240) forever, and shieldEquipped never
//   advances, so main-loop's `shieldEquipped !== ShieldEquipped.id` guard stays true and re-calls the
//   no-op every tick without ever healing.
//
//   #170 — the false arm minted **1** as the "no Gamma Burst" sentinel. calc.ts:359/364/1283/1288 guard
//   on `gammaBurstPct > 0` — which 1 passes — and then scale by `(gammaBurstPct + 1) / 5` = 0.4. Every
//   player without a gamma shield got 40% of their real damage in AT's own model.
//
// THE GATE WAS REDUNDANT. getHeirloomBonus substitutes game.global.gammaMult only for rarity >= 10
// (.trimps-game/main.js:6836) and otherwise returns the shield's rolled currentBonus, which
// unequipHeirloom zeroes for every mod on each swap (main.js:7246). It therefore already returns 0 in
// exactly the cases where the game's own burst mechanic is off (main.js:16022 gates on
// `getHeirloomBonus('Shield','gammaBurst') > 0`). The outer gate added nothing except the two bugs —
// and it wrongly denied a rarity-9 shield that actually ROLLED the mod, which the game does credit.
//
// MUTANTS THIS KILLS. Aimed at the near-miss repairs, not at reverting #49:
//   1. restore the early return                      -> 'clears on a swap down' fails
//   2. early-return but latch the id first           -> 'clears on a swap down' fails on the pct
//   3. keep `: 1` as the false arm                   -> 'no burst is 0, not 1' fails
//   4. zero the pct for rarity < 10 instead of trusting the accessor
//                                                    -> 'credits a rarity-9 rolled mod' fails
//   5. re-add the duplicate computation in main-loop  -> the single-writer net below fails
//   6. seed the boot value back to 1                 -> 'boot seeds a non-live value' fails

let HeirloomShieldSwapped: () => void

beforeAll(async () => {
  // heirlooms.ts reads game.options at import time (mirrors heirlooms.loomSwap.test.ts).
  ;(globalThis as any).game = { options: { menu: { showHeirloomAnimations: { enabled: false } } } }
  HeirloomShieldSwapped = (await import('../src/modules/heirlooms')).HeirloomShieldSwapped
})

describe('HeirloomShieldSwapped (#49 / #169 / #170)', () => {
  beforeEach(() => {
    // Sentinels distinct from any value the body writes, so a non-write is provable.
    ;(globalThis as any).gammaBurstPct = -1
    ;(globalThis as any).shieldEquipped = 'SENTINEL'
  })

  it('rarity >= 10: sets gammaBurstPct from the bonus and latches shieldEquipped', () => {
    ;(globalThis as any).getHeirloomBonus = vi.fn(() => 300)
    ;(globalThis as any).game.global = { ShieldEquipped: { rarity: 10, id: 'shield-A' } }
    HeirloomShieldSwapped()
    expect((globalThis as any).gammaBurstPct).toBe(3) // 300 / 100
    expect((globalThis as any).shieldEquipped).toBe('shield-A')
  })

  // #170. The whole point of the fix: the "no burst" value must be one the consumer's `> 0` guard
  // rejects. A sentinel of 1 passes that guard and scales the damage estimate by (1+1)/5 = 0.4.
  it('no burst: gammaBurstPct is 0, not 1 — calc.ts guards on `> 0`', () => {
    ;(globalThis as any).getHeirloomBonus = vi.fn(() => 0)
    ;(globalThis as any).game.global = { ShieldEquipped: { rarity: 12, id: 'shield-C' } }
    HeirloomShieldSwapped()
    expect((globalThis as any).gammaBurstPct).toBe(0)
    expect((globalThis as any).gammaBurstPct > 0).toBe(false) // the consumer's actual predicate
    expect((globalThis as any).shieldEquipped).toBe('shield-C')
  })

  // #169. The failure the early return caused, driven as a real two-step sequence rather than from a
  // fresh state — the stale value has to be one a previous shield actually wrote.
  it('clears on a swap DOWN: a Hazardous credit does not survive equipping a rarity-9 shield', () => {
    ;(globalThis as any).getHeirloomBonus = vi.fn(() => 24000)
    ;(globalThis as any).game.global = { ShieldEquipped: { rarity: 10, id: 'hazardous' } }
    HeirloomShieldSwapped()
    expect((globalThis as any).gammaBurstPct).toBe(240)

    // Swap to a rarity-9 shield with no rolled gammaBurst. unequipHeirloom has zeroed currentBonus,
    // so the game's accessor now returns 0 (.trimps-game/main.js:7246).
    ;(globalThis as any).getHeirloomBonus = vi.fn(() => 0)
    ;(globalThis as any).game.global = { ShieldEquipped: { rarity: 9, id: 'plain' } }
    HeirloomShieldSwapped()
    expect((globalThis as any).gammaBurstPct).toBe(0)
    // And the latch must advance, or main-loop re-calls this every tick forever.
    expect((globalThis as any).shieldEquipped).toBe('plain')
  })

  // Kills the "zero it for rarity < 10" near-miss. The mod CAN roll on rarity 9 (config.js:8158 gives
  // gammaBurst `steps: [-1 x9, [1000,2000,100], -1, -1, -1]`) and the game's burst fires for it, so
  // rarity is not the right thing to branch on — the accessor's answer is.
  it('credits a rarity-9 shield that actually rolled the mod', () => {
    ;(globalThis as any).getHeirloomBonus = vi.fn(() => 1500)
    ;(globalThis as any).game.global = { ShieldEquipped: { rarity: 9, id: 'rolled-9' } }
    HeirloomShieldSwapped()
    expect((globalThis as any).gammaBurstPct).toBe(15)
    expect((globalThis as any).shieldEquipped).toBe('rolled-9')
  })

  // An empty slot is `{}`, not undefined (.trimps-game/config.js:176), so `.rarity` and `.id` are both
  // undefined and `undefined < 10` is false — the old gate did not even fire for a shieldless player,
  // which is how the sentinel reached the majority case.
  it('no shield equipped: 0, and the latch settles on undefined', () => {
    ;(globalThis as any).getHeirloomBonus = vi.fn(() => 0)
    ;(globalThis as any).game.global = { ShieldEquipped: {} }
    HeirloomShieldSwapped()
    expect((globalThis as any).gammaBurstPct).toBe(0)
    expect((globalThis as any).shieldEquipped).toBeUndefined()
  })
})

// ── the single-writer net ────────────────────────────────────────────────────────────────────────
//
// #170's real shape is a DUPLICATED one-line formula: main-loop.ts:156 carried a verbatim copy of the
// heirlooms.ts body, so the sentinel existed twice and a fix to either one would have left the other.
// That is #168's failure mode exactly (commit da366a3d fixed convertRate on one of two copies 13 lines
// apart and the second survived seven years). Assert the shape rather than the current text.

const ROOT = resolve(__dirname, '..')

function tsSources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) tsSources(rel, acc)
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) acc.push(rel)
  }
  return acc
}

/** Every file:line in src/ that assigns to `gammaBurstPct`, however the target is qualified. */
function gammaBurstWriters(): { file: string; line: number; text: string }[] {
  const out: { file: string; line: number; text: string }[] = []
  for (const rel of tsSources('src')) {
    const src = readFileSync(join(ROOT, rel), 'utf8')
    const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.ES2020, true)
    const visit = (n: ts.Node) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const lhs = n.left
        const name = ts.isIdentifier(lhs)
          ? lhs.text
          : ts.isPropertyAccessExpression(lhs)
            ? lhs.name.text
            : null
        if (name === 'gammaBurstPct') {
          out.push({
            file: rel,
            line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
            text: n.getText(sf).replace(/\s+/g, ' '),
          })
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return out
}

describe('gammaBurstPct has exactly one computing writer (#168-class duplication)', () => {
  const OWNER = join('src', 'modules', 'heirlooms.ts')
  // A write whose RHS is a bare numeric literal is a SEED (it carries no formula, so it cannot drift
  // out of step with the owner). Anything else is a COMPUTATION and belongs only to the owner.
  const writers = gammaBurstWriters().map((w) => {
    const rhs = w.text.slice(w.text.indexOf('=') + 1).trim()
    return { ...w, rhs, isSeed: /^-?\d+(\.\d+)?$/.test(rhs) }
  })

  it('is computed only in heirlooms.ts', () => {
    const computed = writers.filter((w) => !w.isSeed)
    expect(
      computed.map((w) => `${w.file}:${w.line} -> ${w.rhs}`),
      'gammaBurstPct must be derived in exactly ONE place — a second copy is how #168 survived seven years',
    ).toEqual([`${OWNER}:${computed[0]?.line} -> ${computed[0]?.rhs}`])
    expect(computed[0]!.file).toBe(OWNER)
  })

  // #170 lived in the seed, not the formula. Any seed must be a value the consumer's `> 0` guard
  // REJECTS, or the sentinel is live again for the window between page load and the first tick that
  // notices a shield.
  it('every seed is a value calc.ts\'s `> 0` guard rejects', () => {
    const seeds = writers.filter((w) => w.isSeed)
    expect(seeds.length, 'expected at least one boot seed').toBeGreaterThan(0)
    for (const s of seeds) {
      expect(
        Number(s.rhs) > 0,
        `${s.file}:${s.line} seeds gammaBurstPct = ${s.rhs}, which passes calc.ts's \`> 0\` guard and scales damage by (${s.rhs} + 1) / 5`,
      ).toBe(false)
    }
  })
})
