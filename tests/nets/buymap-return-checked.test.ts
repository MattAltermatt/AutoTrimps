import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import ts from 'typescript'

// #177 / #205 — the buyMap() return-value net.
//
// THE CONTRACT (.trimps-game/main.js:6588-6607). `buyMap()` returns `1` on success and refuses with
// `-1` / `-2` / `-3` (or `undefined` when the game is paused). The refusal that matters is `-2`,
// because it sits INSIDE the affordability branch:
//
//     if (cost > 0 && game.resources.fragments.owned >= cost){
//         if (game.global.mapsOwnedArray.length >= 100) { message("Woah, that's a lot of maps…"); return -2; }
//         game.resources.fragments.owned -= cost;
//         createMap(newLevel);  …  return 1;
//     }
//
// so the fork's own `updateMapCost(true) <= fragments.owned` pre-check passes EXACTLY when `-2` comes
// back. Nothing is created and nothing is spent — but `createMap` is what pushes to `mapsOwnedArray`
// (main.js:6025), so `[length - 1]` is still the map the player already owned.
//
// THE BUG. Twenty-one call sites shared one shape:
//
//     buyMap();
//     mapboughtN = true;
//     if (mapboughtN) { pMapN = game.global.mapsOwnedArray[…length - 1].id; }
//
// The `if` on the line after the unconditional `true` is a tautology, and it is the author's own
// fingerprint of the shape that was lost — the vestige of `mapboughtN = (buyMap() == 1)`. At 100 owned
// maps all five praid slots bind the SAME pre-existing id, the "Failed to Prestige Raid" bail is
// suppressed by the always-true flags, AT runs one leftover map five times, and (with recycling on)
// splices a map the player never meant to lose.
//
// WHY A NET. The two findings that reported this disagreed about its size: #177 named 9 sites in
// other-praiding.ts and #205 named 12 in mapfunctions-amp.ts, each explicitly stating the other file
// was out of its scope. Between them they still missed FOUR — the U2 insanity / ship / alch / hypo
// frag-map buys in mapfunctions.ts, which carry the identical vestigial `if`. A finding's own scoping
// claim is a claim; an AST census is a measurement. (Third time this has held on this campaign.)
//
// maps.ts was never part of the bug: all nine of its call sites already capture the result and run the
// `recycleBelow → retry → recycleMap(lowest) → retry` recovery ladder. They are the proof the codebase
// knew `-2` was reachable, and they are this net's positive control that "checked" is detectable.

const ROOT = resolve(__dirname, '..', '..')

function tsSources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) tsSources(rel, acc)
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) acc.push(rel)
  }
  return acc
}

const CORPUS = tsSources('src')

const sourceOf = (rel: string, text = readFileSync(join(ROOT, rel), 'utf8')) =>
  ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

type Verdict = 'discarded' | 'compared' | 'captured-and-compared' | 'captured-untested'
type Call = { file: string; line: number; verdict: Verdict }

const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
])

/**
 * Four verdicts, because "not thrown away" is NOT the same as "checked".
 *
 * The first version of this net only asked `ts.isExpressionStatement(node.parent)` — literally "does
 * the value go nowhere". Review found the hole, and it is the exact near-miss repair a reasonable
 * person writes for #177/#205:
 *
 *     mapboughtN = buyMap();        // looks like a fix. Is not one.
 *
 * Every refusal code is TRUTHY in JS (`-1`, `-2`, `-3`), so the downstream `if (mapboughtN)` still
 * fires on a refusal and still binds `mapsOwnedArray[length - 1].id` to a map the player already
 * owned. The bug survives intact, and the old classifier called it fixed — the CLAUDE.md lesson
 * ("mutation-test the near-miss, not the revert") landing on this net's own design rather than on a
 * fix. So the rule is now: the value must reach a COMPARISON, either at the call site or through a
 * variable that is compared somewhere in the same file. `result = buyMap()` passes because maps.ts
 * really does test `result == -2`; `mapboughtN = buyMap()` does not, because nothing ever compares
 * `mapboughtN` to anything — it is only ever read for truthiness.
 */
function collectBuyMapCalls(rel: string, text?: string): Call[] {
  const sf = sourceOf(rel, text)

  // Identifiers this file compares against something, anywhere. Deliberately file-wide rather than
  // scope-aware: a false NEGATIVE here (a same-named variable compared elsewhere) is a missed catch,
  // which review can still find, whereas a false positive gets the whole net muted.
  const compared = new Set<string>()
  const scanComparisons = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && COMPARISONS.has(node.operatorToken.kind)) {
      for (const side of [node.left, node.right]) if (ts.isIdentifier(side)) compared.add(side.text)
    }
    ts.forEachChild(node, scanComparisons)
  }
  scanComparisons(sf)

  const out: Call[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'buyMap') {
      const parent = node.parent
      let verdict: Verdict = 'compared'
      if (ts.isExpressionStatement(parent)) {
        verdict = 'discarded'
      } else if (ts.isBinaryExpression(parent) && COMPARISONS.has(parent.operatorToken.kind)) {
        verdict = 'compared'
      } else {
        // Assigned to a name — `let result = buyMap()` or `bought = buyMap()`. Fine only if that name
        // is compared to something rather than merely believed.
        let bound: string | null = null
        if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) bound = parent.name.text
        else if (
          ts.isBinaryExpression(parent) &&
          parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isIdentifier(parent.left)
        )
          bound = parent.left.text
        if (bound) verdict = compared.has(bound) ? 'captured-and-compared' : 'captured-untested'
      }
      out.push({ file: rel, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, verdict })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

const CALLS = CORPUS.flatMap((rel) => collectBuyMapCalls(rel))

describe('every buyMap() call must act on its return value (#177/#205)', () => {
  it('parses a real corpus (anti-false-green: an empty scan passes everything vacuously)', () => {
    expect(CORPUS.length).toBeGreaterThan(30)
    // 30 today (9 maps.ts + 13 other-praiding + 4 mapfunctions + 12 mapfunctions-amp, minus the two
    // frag buys that share a line). Pinning the exact count would make this a chore on every future
    // edit, so pin the SHAPE: a call is found in every file that is supposed to have one.
    expect(CALLS.length).toBeGreaterThan(25)
    // Both verdicts a healthy tree should show: the praid sites compare inline, maps.ts captures then
    // branches. If either collapses to zero the classifier has silently stopped distinguishing them.
    expect(CALLS.filter((c) => c.verdict === 'compared').length).toBeGreaterThan(20)
    expect(CALLS.filter((c) => c.verdict === 'captured-and-compared').length).toBeGreaterThanOrEqual(9)
    for (const f of [
      'src/modules/maps.ts',
      'src/modules/other-praiding.ts',
      'src/modules/mapfunctions.ts',
      'src/modules/mapfunctions-amp.ts',
    ]) {
      expect(CALLS.some((c) => c.file === f), `no buyMap() call found in ${f}`).toBe(true)
    }
  })

  it('the detector separates CHECKED from merely not-thrown-away (positive AND negative control)', () => {
    // `[] === []` is the shape that passes when the walker is broken, so prove every verdict on
    // synthetic source before trusting the real verdict below.
    for (const [how, src, want] of [
      // The bug as it shipped.
      ['the original', 'buyMap();\nbought = true;', 'discarded'],
      // THE NEAR-MISS REPAIR, and the reason this classifier has four verdicts instead of two.
      // Every refusal code (-1, -2, -3) is truthy, so `if (bought)` still fires on a refusal and the
      // bug is entirely intact — but the value is no longer "thrown away", so the first version of
      // this net called it fixed.
      ['assign without comparing', 'bought = buyMap();\nif (bought) { capture(); }', 'captured-untested'],
      ['declare without comparing', 'let r = buyMap();\nif (r) { capture(); }', 'captured-untested'],
      // Real repairs. All must pass, or the net fails after a correct fix and gets muted.
      ['gate the flag', 'bought = buyMap() === 1;', 'compared'],
      ['compare loosely', 'bought = (buyMap() == 1);', 'compared'],
      ['inline condition', 'if (buyMap() === 1) { capture(); }', 'compared'],
      ['capture then branch', 'let result = buyMap(); if (result === -2) recycleBelow(true);', 'captured-and-compared'],
      ['capture then branch, reversed', 'let result = buyMap(); if (1 !== result) bail();', 'captured-and-compared'],
    ] as const) {
      const found = collectBuyMapCalls('synthetic.ts', src)
      expect(found.length, `${how}: call not seen at all`).toBe(1)
      expect(found[0].verdict, `${how}: wrong verdict`).toBe(want)
    }
  })

  it('every buyMap() call acts on its return', () => {
    const bad = CALLS.filter((c) => c.verdict === 'discarded' || c.verdict === 'captured-untested').map(
      (c) => `${c.file}:${c.line} (${c.verdict})`,
    )
    // buyMap() returns -2 WITHOUT creating a map or spending fragments once mapsOwnedArray hits the
    // game's 100-map cap — and the fork's own affordability pre-check passes exactly then. Gate the
    // bought flag on `=== 1`; do not capture `mapsOwnedArray[length - 1].id` after a refusal. Note
    // `bought = buyMap()` is NOT a fix: every refusal code is truthy.
    expect(bad).toEqual([])
  })

  it('maps.ts still runs the -2 recovery ladder (the shape the rest of the fork was missing)', () => {
    // Not decoration: this is the in-repo precedent that made "faithful to legacy" fail as a defence
    // for the other 21 sites, and `scripts/sim/make-fixtures.mjs` builds fixture `07-map-cap-u1`
    // specifically to sit AT on the cap. If this ladder is ever deleted, the argument goes with it.
    const maps = readFileSync(join(ROOT, 'src/modules/maps.ts'), 'utf8')
    expect([...maps.matchAll(/result\s*=\s*buyMap\(\)/g)].length).toBeGreaterThanOrEqual(9)
    expect([...maps.matchAll(/result\s*==?=?\s*-2/g)].length).toBeGreaterThanOrEqual(3)
    expect(maps).toContain('recycleBelow(true)')
  })
})
