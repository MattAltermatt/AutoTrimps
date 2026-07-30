// #216 — A CHALLENGE² STORES THE PARENT'S NAME, SO COMPARING AGAINST A CHILD'S IS ALWAYS FALSE.
//
// `game.global.challengeActive` holds ONE string. During a Challenge² that string is the PARENT
// challenge ("Nometal", "Toxad", "Topology", …) and the children go into `game.global.multiChallenge`
// as keys (updates.js:4673-4680). The game therefore never asks the question directly — it calls
// `challengeActive(what)` (main.js:1753), which checks `multiChallenge[what]` FIRST and only then
// falls back to the direct compare. Every behavioural site in the game uses that helper; the direct
// compares that survive there live in achievement code (config.js:9307-9326), where parent-name
// semantics are actually what is wanted.
//
// AT did the opposite in eleven places. Three of them were settings whose own tooltips advertise
// Challenge²-only behaviour:
//
//   upgrades.ts  MetalEfficiencyPriority  dead during Nometal², alive during plain Metal   (#216)
//   main-loop.ts Rcarmormagic             "C2 Armor Magic" — dead 100% of the time
//   maps.ts      mapc2hd                  "Mapology Challenge²" override — dead 100% of the time
//
// The last two are the sharp end of the class: a control that is categorised C2, documented C²-only,
// and gated on a predicate that a C² makes false. It could never have fired once.
//
// THE CENSUS IS NOW ZERO (#291 closed, S9 Wave 4). It used to pin the seven surviving query.ts
// prediction sites — six gather-rate terms in getPerSecBeforeManual plus one breed-potency term —
// deliberately unfixed because prediction-math parity was an explicit Session 9 decision. S9 took
// that decision and they all now call the helper, so the expectation was edited DOWN, which is the
// only direction it may ever move. A pinned shrinking census beat both "fix them all now" (scope
// creep in a behaviour commit) and an allowlist (which rots into a waiver nobody re-derives) — the
// #208/#238 lesson. Note the seventh site was NOT in #291's own header list: the list said "all six
// live in getPerSecBeforeManual and all feed gather rate", and the AST found a Toxicity compare in
// the breed-potency helper too. The net's output is the census; a finding's prose about it is not.
//
// The child set is DERIVED from the clone's multiChallenge arrays, never retyped, so a future game
// version that adds a Challenge² extends this net without anyone remembering to.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(__dirname, '..', '..')
const CLONE = process.env.TRIMPS_GAME_DIR ?? resolve(ROOT, '.trimps-game')

/** The Challenge² CHILD names, read out of the game's own config rather than restated here. */
function c2Children(): Set<string> {
  const cfg = readFileSync(resolve(CLONE, 'config.js'), 'utf8')
  const children = new Set<string>()
  for (const list of cfg.matchAll(/multiChallenge:\s*\[([^\]]*)\]/g))
    for (const name of list[1].matchAll(/["']([A-Za-z]+)["']/g)) children.add(name[1])
  return children
}

/**
 * The Challenge² PARENT names — the challenge object that OWNS a multiChallenge array. Derived by
 * walking back from each array to its enclosing key, so a clone bump carries new parents in for free.
 */
function c2Parents(): Set<string> {
  const lines = readFileSync(resolve(CLONE, 'config.js'), 'utf8').split('\n')
  const parents = new Set<string>()
  lines.forEach((line, i) => {
    if (!/multiChallenge:\s*\[/.test(line)) return
    for (let j = i; j > i - 40 && j >= 0; j--) {
      const m = lines[j].match(/^\t\t([A-Za-z]+):\s*\{/)
      if (m) {
        parents.add(m[1])
        return
      }
    }
  })
  return parents
}

type Site = { file: string; challenge: string; line: number }

/** Is `n` the property-access chain `game.global.challengeActive`? */
function isChallengeActiveRead(n: ts.Node): boolean {
  if (!ts.isPropertyAccessExpression(n) || n.name.text !== 'challengeActive') return false
  const outer = n.expression
  if (!ts.isPropertyAccessExpression(outer) || outer.name.text !== 'global') return false
  return ts.isIdentifier(outer.expression) && outer.expression.text === 'game'
}

/**
 * Every `game.global.challengeActive <eq-op> '<C2 child>'` in `source`, either operand order.
 * AST-based on purpose: a text scan matches the shape inside comments and string literals, which is
 * how `native-conflicts-completeness` once reddened on a comment and created pressure to document
 * less. Comments cannot reach a BinaryExpression node.
 */
function scan(file: string, source: string, children: Set<string>): Site[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const found: Site[] = []
  const EQ = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ])
  const walk = (n: ts.Node): void => {
    if (ts.isBinaryExpression(n) && EQ.has(n.operatorToken.kind)) {
      for (const [a, b] of [
        [n.left, n.right],
        [n.right, n.left],
      ] as const) {
        if (isChallengeActiveRead(a) && ts.isStringLiteral(b) && children.has(b.text)) {
          found.push({
            file,
            challenge: b.text,
            line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          })
        }
      }
    }
    ts.forEachChild(n, walk)
  }
  walk(sf)
  return found
}

function srcFiles(): string[] {
  const dir = resolve(ROOT, 'src', 'modules')
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => `src/modules/${f}`)
}

describe('challenge-squared compares (a C² stores the PARENT name)', () => {
  // CAPABILITY, proven against a SYNTHETIC fixture — never against live src/. `setting-array-compare`
  // asserted its own capability over real source and went red the moment the last real defect was
  // repaired: "the class is clean" and "the scanner broke" became the same observation (#178). A
  // fixture keeps the two questions apart forever.
  it('anti-false-green: the scanner sees every shape it must, in a synthetic fixture', () => {
    const children = new Set(['Metal', 'Watch', 'Nom', 'Mapology'])
    const fixture = `
      if (game.global.challengeActive === 'Metal') a()
      if (game.global.challengeActive == "Watch") b()
      if (game.global.challengeActive !== 'Nom') c()
      if ('Mapology' == game.global.challengeActive) d()
      // game.global.challengeActive === 'Metal'  <- a comment must NOT count
      const s = "game.global.challengeActive === 'Metal'" // nor a string literal
      if (challengeActive('Metal')) e()                   // the CORRECT form must not count
      if (game.global.challengeActive === 'Daily') f()    // not a C² child
      if (game.global.world === 'Metal') g()              // different property
    `
    const hits = scan('fixture.ts', fixture, children)
    expect(hits.map((h) => h.challenge).sort()).toEqual(['Mapology', 'Metal', 'Nom', 'Watch'])
  })

  it('derives the C² child set from the clone, and it is the expected six pairs', () => {
    const children = c2Children()
    // Twelve children across six parents. Pinned so a clone bump that changes the roster is visible
    // here rather than silently widening or narrowing every assertion below.
    expect([...children].sort()).toEqual([
      'Balance', 'Discipline', 'Electricity', 'Lead', 'Mapology', 'Meditate',
      'Metal', 'Nom', 'Size', 'Slow', 'Toxicity', 'Watch',
    ])
  })

  it('the three C²-advertised settings no longer string-compare (#216)', () => {
    const children = c2Children()
    for (const rel of ['src/modules/upgrades.ts', 'src/modules/maps.ts', 'src/modules/main-loop.ts']) {
      const hits = scan(rel, readFileSync(resolve(ROOT, rel), 'utf8'), children)
      expect(hits, `${rel} still compares challengeActive against a C² child: ${JSON.stringify(hits)}`).toEqual([])
    }
  })

  it('the class is CLOSED: no module compares challengeActive against a C² child (#216, #291)', () => {
    const children = c2Children()
    const all = srcFiles().flatMap((rel) => scan(rel, readFileSync(resolve(ROOT, rel), 'utf8'), children))

    // Keyed by file + challenge, NOT by line: line numbers churn on every edit above them, and a net
    // that reddens on unrelated edits gets weakened rather than heeded.
    const census = all.map((s) => `${s.file}:${s.line} ${s.challenge}`).sort()
    expect(
      census,
      'a Challenge² CHILD compare reappeared. It is false for the whole of the matching C² while the ' +
        'game applies the modifier anyway — call challengeActive(what) (main.js:1753) instead.',
    ).toEqual([])
  })

  // THE HOLE THIS NET HAD, AND WHY IT IS A CENSUS RATHER THAN A BAN.
  //
  // Mutation-testing the tests above turned up a near-miss repair they could not see: "fixing" a site
  // by comparing against the PARENT name — `game.global.challengeActive === 'Nometal'` — passes every
  // assertion above, because Nometal is not a child. It is the repair someone reaches for once they
  // learn what a C² actually stores, and it is right or wrong depending entirely on the caller:
  //
  //   mapc2hd / Rcarmormagic  are documented C²-ONLY, so a parent compare would in fact behave
  //                           correctly — banning it outright would be wrong.
  //   MetalEfficiencyPriority must fire during plain Metal AND Nometal², so a parent compare would
  //                           silently break the ordinary case it works in today.
  //
  // So the honest shape is not a ban but a pinned census at zero: any parent-name compare that appears
  // is a decision someone has to defend in review, rather than a hole the net quietly waves through.
  // (Same reasoning as the shrinking pin above — see #208 on why an allowlist is the wrong instrument.)
  it('no module compares challengeActive against a C² PARENT name either — pinned at zero', () => {
    const parents = c2Parents()
    expect([...parents].sort()).toEqual([
      'Enlightened', 'Nometal', 'Paralysis', 'Topology', 'Toxad', 'Waze',
    ])

    const all = srcFiles().flatMap((rel) => scan(rel, readFileSync(resolve(ROOT, rel), 'utf8'), parents))
    expect(
      all.map((s) => `${s.file}:${s.line} ${s.challenge}`),
      'a Challenge² PARENT compare appeared. That is correct ONLY for a control that is C²-only; for ' +
        'anything that must also work during the plain challenge it is a silent regression. Justify it ' +
        'in review, then pin it here.',
    ).toEqual([])
  })
})
