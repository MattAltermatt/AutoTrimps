import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'

// #314 — A MISSPELLED CHALLENGE NAME IS A PROVABLY DEAD BRANCH, AND NOTHING THROWS.
//
// `challengeActive(what)` (main.js:1753) is two string compares against `game.global.multiChallenge`
// and `game.global.challengeActive`. Hand it a name the game never uses and it returns false forever —
// for every player, on every save. `cfightforever` shipped `challengeActive("Electricty")`, missing its
// second `i`, sitting in a disjunction whose other two members were spelled correctly, so the feature
// looked like it worked. It had never fired on Electricity for anyone.
//
// The class is mechanizable, so fixing the one instance is not the fix (#208/#238: a finding's own
// scoping claim is a claim). This derives BOTH halves instead of restating either:
//
//   the legal names   ← Object.keys(game.challenges) on a booted clone, never a hand-written list
//   the call sites    ← the TypeScript AST, never a regex
//
// The AST matters as much as the name set. A text scan over source has a false-positive surface exactly
// where the code is best explained — `native-conflicts-completeness` reddened on a COMMENT quoting the
// game — and the pressure that creates is to document less. A comment or a doc-string mentioning
// `challengeActive("Electricty")` is not a call site, and the AST simply cannot see it as one.

const SRC = join(__dirname, '../../src')

type Site = { file: string; line: number; name: string; form: 'call' | 'compare' | 'member' }

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) tsFiles(p, out)
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out
}

/** Every place a string literal is tested against the game's active-challenge state, by AST shape:
 *   call     — challengeActive("X")  /  window.challengeActive('X')
 *   compare  — game.global.challengeActive === "X"  (and !==, ==, !=, either operand order)
 *   member   — [...].includes(game.global.challengeActive), incl. through a named const
 *
 * The third form was missing on the first pass and was found by review. It is not hypothetical:
 * `native-conflicts.ts:267` ships it. Note WHY it needs the const resolution below — the live site is
 * `U2_BATTLE_OVERRIDE_CHALLENGES.includes(...)`, an identifier, so a scanner extended only to inline
 * array literals would still not see the one example that motivated extending it. That is the
 * near-miss-fix trap aimed at a net's own classifier rather than at source: the obvious repair looks
 * right and covers nothing real. */
function scan(file: string, text: string): Site[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const sites: Site[] = []
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const EQ = [
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ]

  // Name -> string members, for `const X = ['a', 'b']` anywhere in the file. Collected in a first pass
  // so a const declared below its use still resolves.
  const arrayConsts = new Map<string, string[]>()
  const collect = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isArrayLiteralExpression(n.initializer)) {
      const members = n.initializer.elements.filter(ts.isStringLiteralLike).map((e) => e.text)
      if (members.length === n.initializer.elements.length && members.length > 0) arrayConsts.set(n.name.text, members)
    }
    ts.forEachChild(n, collect)
  }
  collect(sf)

  /** The string members of an array-ish expression, whether written inline or behind a const. */
  const membersOf = (e: ts.Expression): string[] | undefined => {
    if (ts.isArrayLiteralExpression(e)) {
      const m = e.elements.filter(ts.isStringLiteralLike).map((x) => x.text)
      return m.length === e.elements.length ? m : undefined
    }
    if (ts.isIdentifier(e)) return arrayConsts.get(e.text)
    return undefined
  }

  const visit = (n: ts.Node): void => {
    // [...].includes(game.global.challengeActive) / .indexOf(...)
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const method = n.expression.name.text
      const arg = n.arguments[0]
      if (
        (method === 'includes' || method === 'indexOf') &&
        arg &&
        arg.getText(sf).endsWith('challengeActive')
      ) {
        for (const name of membersOf(n.expression.expression) ?? []) {
          sites.push({ file, line: lineOf(n), name, form: 'member' })
        }
      }
    }
    if (ts.isCallExpression(n) && /(^|\.)challengeActive$/.test(n.expression.getText(sf))) {
      const a = n.arguments[0]
      if (a && ts.isStringLiteralLike(a)) sites.push({ file, line: lineOf(n), name: a.text, form: 'call' })
    }
    if (ts.isBinaryExpression(n) && EQ.includes(n.operatorToken.kind)) {
      for (const [lhs, rhs] of [
        [n.left, n.right],
        [n.right, n.left],
      ] as const) {
        if (lhs.getText(sf).endsWith('challengeActive') && ts.isStringLiteralLike(rhs)) {
          sites.push({ file, line: lineOf(n), name: rhs.text, form: 'compare' })
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return sites
}

// `""` is the game's OWN "no challenge running" sentinel — config.js:3616 assigns
// `game.global.challengeActive = ""` when a challenge completes mid-run, so comparing against it is
// correct code, not a typo. It is the only non-challenge string the census returns across all of src/,
// which is itself the evidence that `game.challenges` is the right authority for the rest.
const SENTINELS = new Set([''])

describe('challenge-name literals name real challenges (#314)', () => {
  const legalNames: Set<string> = new Set(Object.keys(bootGame({}).game.challenges))
  const sites = tsFiles(SRC).flatMap((f) => scan(f, readFileSync(f, 'utf8')))
  const offenders = sites.filter((s) => !legalNames.has(s.name) && !SENTINELS.has(s.name))

  it('the clone yields a real challenge roster', () => {
    // If the boot ever stops populating game.challenges, `legalNames` empties and EVERY site becomes an
    // offender — loud, not silent. The opposite failure is the dangerous one, so pin a floor and two
    // names this repo's automation genuinely branches on.
    expect(legalNames.size).toBeGreaterThan(40)
    expect(legalNames.has('Electricity')).toBe(true)
    expect(legalNames.has('Trappapalooza')).toBe(true)
    expect(legalNames.has('Electricty')).toBe(false)
  })

  it('the scanner reaches src/ at all', () => {
    // Anti-false-green for the census below: a walker that returns nothing reports a clean census, and
    // "no offenders" and "no sites" are the same green. Floors, not exact counts — the numbers move with
    // ordinary edits and a brittle pin would just get bumped without being read.
    expect(sites.filter((s) => s.form === 'call').length).toBeGreaterThan(50)
    expect(sites.filter((s) => s.form === 'compare').length).toBeGreaterThan(200)
    // The `member` form has exactly one live site today (native-conflicts.ts:267, three names). A floor
    // of zero would let a broken resolver report the form as covered while seeing nothing — which is
    // precisely how it went unnoticed on the first pass.
    expect(sites.filter((s) => s.form === 'member').length).toBeGreaterThan(0)
  })

  it('every literal names a challenge the game actually has', () => {
    expect(offenders.map((s) => `${relative(SRC, s.file)}:${s.line} ${s.form} "${s.name}"`)).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// CAPABILITY, PROVEN ON A SYNTHETIC FIXTURE — NEVER ON LIVE SOURCE.
//
// `setting-array-compare` proved it could see its defect with `sites.some(s => s.reversed)` over src/,
// so its own health depended on that defect continuing to exist — and it went red the moment the last
// instance was repaired. "The class is clean" and "the scanner broke" were the same observation (#178).
// The census above must therefore be allowed to be empty, and the scanner's teeth get their own test.
describe('the scanner can actually see a bad name (#314 capability)', () => {
  const fixture = `
    // A comment mentioning challengeActive("Electricty") must NOT be a finding.
    const doc = 'challengeActive("Bogusname")'
    const NAMED_LIST = ['Mayhem', 'Namedconstfake']
    export function f() {
      if (challengeActive("Electricty")) return 1
      if (window.challengeActive('Nonesuch')) return 2
      if (game.global.challengeActive === "Notachallenge") return 3
      if ("AlsoFake" !== game.global.challengeActive) return 4
      if (challengeActive("Electricity")) return 5
      if (['Inlinefake', 'Nom'].includes(game.global.challengeActive)) return 6
      if (NAMED_LIST.includes(game.global.challengeActive)) return 7
      return 0
    }
  `

  const found = scan('synthetic.ts', fixture)

  it('finds every real call site and compare, in both operand orders', () => {
    expect(found.map((s) => `${s.form}:${s.name}`).sort()).toEqual([
      'call:Electricity',
      'call:Electricty',
      'call:Nonesuch',
      'compare:AlsoFake',
      'compare:Notachallenge',
      'member:Inlinefake',
      'member:Mayhem',
      'member:Namedconstfake',
      'member:Nom',
    ])
  })

  it('resolves array membership through a NAMED CONST, not only an inline literal', () => {
    // The live site is `U2_BATTLE_OVERRIDE_CHALLENGES.includes(...)` (native-conflicts.ts:267). A
    // scanner extended to inline literals alone would pass its own capability test and still be blind
    // to the only instance in the repo, so pin the const path separately from the literal path.
    expect(found.filter((s) => s.name === 'Namedconstfake')).toHaveLength(1)
    expect(found.filter((s) => s.name === 'Inlinefake')).toHaveLength(1)
  })

  it('does NOT report the comment or the string literal', () => {
    // The `native-conflicts-completeness` lesson, structural rather than by stripping: prose and quoted
    // documentation are not call expressions, so explaining the bug in a comment can never re-raise it.
    expect(found.filter((s) => s.name === 'Bogusname')).toEqual([])
    expect(found.filter((s) => s.form === 'call' && s.name === 'Electricty')).toHaveLength(1)
  })
})
