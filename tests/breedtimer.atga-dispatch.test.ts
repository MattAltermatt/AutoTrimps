import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { bootGame } from '../scripts/sim/boot.mjs'

// #316 — WHY THIS FILE EXISTS: #315 SHIPPED A TRUE PREMISE AND AN UNVERIFIED REACHABILITY.
//
// #315 added `!challengeActive("Trappapalooza")` to ATGA2's guard because `breed()` early-returns for
// BOTH Trapper and Trappapalooza (main.js:5575). That premise is correct and still is. What nobody
// checked is whether ATGA2 can ever OBSERVE Trappapalooza — and it cannot. The guard is therefore
// defence-in-depth, and the issue, the sibling test's docblock and docs/decisions-log.md all described
// it as a live fix until this was caught in review.
//
// The argument has exactly two halves, one per describe block below, and they meet in the middle:
// ATGA2 runs only where `universe == 1`, and Trappapalooza exists only where `universe != 1`.
//
// The repair for a wrong claim is not a better comment. CLAUDE.md: WRITE THE JUSTIFYING CLAIM AS AN
// EXECUTABLE ASSERTION — a prose note saying "this arm is unreachable" rots the moment someone moves
// the dispatch, and rots silently, because nothing reads it. Pinning both halves means re-parenting
// ATGA2 into the U2 block, or an upstream bump dropping `blockU1`, turns the stale comment RED
// instead of leaving it quietly wrong.
//
// ⚠️ SCOPE. This is deliberately NOT the general "universe-reachability" net that was considered and
// rejected for this class. That net would have flagged 5 sites, 0 of them behavioural, 4 of them
// faithful mirrors of main.js:5629-5630 carrying an in-source `parity fix #22` label — so going green
// required five location-keyed waivers inside ATGA2 itself, which is the documented waiver hazard at
// the coordinates of the most recently edited code in the repo. It also detects the wrong direction:
// it finds names that CANNOT fire, while #316 alleged a name that was MISSING. This file pins one
// specific claim about one specific function, has no waiver bucket and no call graph, and can only
// ever be as stale as the claim it encodes.

const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')
const MAIN_LOOP = join(SRC, 'modules/main-loop.ts')

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) tsFiles(p, out)
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out
}

type Span = { universe: number; start: number; end: number }

/** The `if (game.global.universe == N) { ... }` blocks in a file, by source position. */
function universeBlocks(sf: ts.SourceFile): Span[] {
  const spans: Span[] = []
  const visit = (n: ts.Node): void => {
    if (ts.isIfStatement(n)) {
      // `game.global.universe == 1` / `=== 1`, either operand order.
      const c = n.expression
      if (ts.isBinaryExpression(c) && (c.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken || c.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken)) {
        for (const [lhs, rhs] of [[c.left, c.right], [c.right, c.left]] as const) {
          if (lhs.getText(sf).endsWith('global.universe') && ts.isNumericLiteral(rhs)) {
            spans.push({ universe: Number(rhs.text), start: n.thenStatement.getStart(sf), end: n.thenStatement.getEnd() })
          }
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return spans
}

/** Every call of `name` in the file, tagged with the universe block enclosing it (0 = none). */
function callsWithUniverse(sf: ts.SourceFile, name: string): { line: number; universe: number }[] {
  const spans = universeBlocks(sf)
  const found: { line: number; universe: number }[] = []
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && n.expression.getText(sf) === name) {
      const pos = n.getStart(sf)
      const enclosing = spans.find((s) => pos >= s.start && pos < s.end)
      found.push({ line: sf.getLineAndCharacterOfPosition(pos).line + 1, universe: enclosing?.universe ?? 0 })
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return found
}

const parse = (file: string) => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)

describe("ATGA2's Trappapalooza arm is unreachable — half 1, the dispatch is U1-only (#316)", () => {
  const sf = parse(MAIN_LOOP)

  it('main-loop.ts really does have both universe blocks', () => {
    // Anti-false-green. If the matcher stops recognising the block shape, `universe` degrades to 0 for
    // every call and the assertion below would pass by seeing nothing at all.
    const spans = universeBlocks(sf)
    expect(spans.filter((s) => s.universe === 1)).toHaveLength(1)
    expect(spans.filter((s) => s.universe === 2)).toHaveLength(1)
  })

  it('every ATGA2() dispatch sits inside the universe==1 block', () => {
    const calls = callsWithUniverse(sf, 'ATGA2')
    // A floor first: zero calls is the vacuous green this whole file exists to prevent.
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.map((c) => `${c.line}:u${c.universe}`)).toEqual(calls.map((c) => `${c.line}:u1`))
  })

  it('main-loop.ts is the ONLY dispatcher of ATGA2 in src/', () => {
    // The U1-block fact is worthless if a second call site exists somewhere ungated. `src/game/*.d.ts`
    // is the ambient seam, not a caller, so declarations there are excluded by looking at calls only.
    const sites = tsFiles(SRC).flatMap((f) => callsWithUniverse(parse(f), 'ATGA2').map((c) => `${relative(SRC, f)}:${c.line}`))
    // Deliberately NOT pinned to the exact line. The load-bearing facts are "exactly one" and "in
    // main-loop.ts"; the line number is not, and pinning it taxes every unrelated edit above it with a
    // failure that teaches nothing. A second dispatch anywhere in src/ still reddens this.
    expect(sites).toHaveLength(1)
    expect(sites[0]).toMatch(/^modules\/main-loop\.ts:\d+$/)
  })
})

describe("ATGA2's Trappapalooza arm is unreachable — half 2, the game's own flags (#316)", () => {
  const challenges = bootGame({}).game.challenges

  it('Trappapalooza is U2-only and Trapper is not', () => {
    // Derived from the booted clone, never from a hand-written list. If an upstream bump ever lets
    // Trappapalooza into U1, THIS is what goes red — and the guard stops being defence-in-depth.
    expect(challenges.Trappapalooza.blockU1).toBe(true)
    expect(challenges.Trappapalooza.allowU2).toBe(true)
    // Trapper carries neither flag, which is what makes it the live arm of the same guard.
    expect(challenges.Trapper.blockU1).toBeUndefined()
    expect(challenges.Trapper.allowU2).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// CAPABILITY, ON A SYNTHETIC FIXTURE — NEVER ON LIVE SOURCE.
//
// `setting-array-compare` asserted its own capability against src/ and went red the moment its class
// was fixed, because "the class is clean" and "the scanner broke" were the same observation (#178).
// The census above must be free to describe a healthy tree, so the matcher's teeth are proven here.
describe('the dispatch matcher can actually see a mis-placed call (#316 capability)', () => {
  const fixture = `
    export function mainLoop() {
      atGuard('early', function () { earlyCall() })
      if (game.global.universe == 1) {
        insideU1()
        atGuard('wrapped', function () { nestedInsideU1() })
      }
      strayBetweenBlocks()
      if (game.global.universe === 2) {
        insideU2()
      }
      if (1 == game.global.universe) {
        reversedOperands()
      }
    }
  `
  const sf = ts.createSourceFile('synthetic.ts', fixture, ts.ScriptTarget.Latest, true)
  const uni = (name: string) => callsWithUniverse(sf, name).map((c) => c.universe)

  it('attributes calls to the block that encloses them', () => {
    expect(uni('insideU1')).toEqual([1])
    expect(uni('insideU2')).toEqual([2])
  })

  it('matches the REVERSED operand order the matcher advertises', () => {
    // universeBlocks() loops over both operand orders, and until this fixture line existed nothing
    // proved the second arm worked: every gate in the real source and in this fixture put `universe`
    // on the left, so deleting the `[c.right, c.left]` arm passed the entire file. An advertised
    // capability nothing exercises is a comment (found by review).
    expect(uni('reversedOperands')).toEqual([1])
  })

  it('sees through a wrapper callback — atGuard passes a closure, not a deferred handle', () => {
    // The live dispatch shape at main-loop.ts:261 is exactly this: a call nested inside a function
    // expression passed to atGuard. A matcher that only walked top-level statements would report u0
    // here and then pass the real assertion vacuously.
    expect(uni('nestedInsideU1')).toEqual([1])
  })

  it('reports 0 for calls outside every universe block, in both positions', () => {
    // This is the mutant that matters: move ATGA2's dispatch out of the U1 block and the real
    // assertion must FAIL. If this returned 1, it never could.
    expect(uni('earlyCall')).toEqual([0])
    expect(uni('strayBetweenBlocks')).toEqual([0])
  })
})
