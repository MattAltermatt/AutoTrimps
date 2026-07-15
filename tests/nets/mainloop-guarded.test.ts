import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

// #87 — THE STRUCTURAL NET: every dispatch in mainLoop and guiLoop is inside an error boundary.
//
// The fix for #87 wrapped ~65 dispatch sites in atGuard(). Without this net that fix ROTS on the day
// somebody adds automation #61 and writes it the way all 60 others used to be written — one more
// `if (getPageSetting('X')) newThing();`, and the hole is back, silently, for every automation ordered
// after it. A fix that can be undone by a copy-paste is not a fix; it is a fashion.
//
// ─── WHY THIS CHECKS *CALLS*, NOT *STATEMENTS* ──────────────────────────────────────────────────────
// The naive net asserts "every statement in mainLoop is an atGuard(...) call". That is trivially
// satisfiable and it would have MISSED the thing that actually matters: the conditions. mainLoop's
// dispatches look like
//
//     if (getPageSetting('buywepsvoid') == true && … && getCurrentMapObject().location == "Void") buyWeps();
//
// and `getCurrentMapObject()` returns undefined outside a map. The throw is in the GUARD, not the
// callee — and it kills the tick exactly as dead. `calcHDratio()`, `questcheck()`, `valueTotal()` and
// `document.getElementById('Prestige').value` are all in the same position. So the rule this net
// enforces is the strong one:
//
//     NO CALL EXPRESSION anywhere in mainLoop/guiLoop may sit outside an atGuard() closure.
//
// which forces the condition inside the boundary alongside its callee, and cannot be satisfied by a
// dispatch that merely *looks* wrapped.
//
// ─── THE ONE ALLOWED EXCEPTION, AND WHY IT IS ALLOWED ───────────────────────────────────────────────
// mainLoop's own skeleton — the two early-return statements — is not an automation and cannot be
// guarded without changing what `return` means. It contains exactly one call. It is pinned by NAME and
// by COUNT below, so it cannot become a hiding place.

const ROOT = resolve(__dirname, '..', '..')
const FILE = 'src/modules/main-loop.ts'

const sf = ts.createSourceFile(
  FILE,
  readFileSync(resolve(ROOT, FILE), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
)
const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

function findFn(name: string): ts.FunctionDeclaration {
  let found: ts.FunctionDeclaration | undefined
  const visit = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) found = n
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!found) throw new Error(`${FILE}: function ${name}() not found — the net has lost its target`)
  return found
}

const LOOPS = ['mainLoop', 'guiLoop'] as const

/** The callee's printable name: `foo()` -> foo, `a.b.c()` -> a.b.c, anything else -> <computed>. */
function calleeName(call: ts.CallExpression): string {
  const e = call.expression
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return e.getText(sf)
  return '<computed>'
}

/** Is `n` the 2nd argument (the closure, or a bare function reference) of an `atGuard(...)` call? */
const isGuardBody = (n: ts.Node): boolean =>
  !!n.parent &&
  ts.isCallExpression(n.parent) &&
  ts.isIdentifier(n.parent.expression) &&
  n.parent.expression.text === 'atGuard' &&
  n.parent.arguments[1] === n

/**
 * Walk from `call` up to `root`. GUARDED iff we cross a function passed as atGuard's 2nd argument.
 * Nested guards (the AB block, the buildings/jobs chains) satisfy this at the innermost boundary,
 * which is the correct answer: the inner catch fires first and the outer never sees the throw.
 */
function isGuarded(call: ts.Node, root: ts.Node): boolean {
  let n: ts.Node | undefined = call
  while (n && n !== root) {
    if ((ts.isFunctionExpression(n) || ts.isArrowFunction(n)) && isGuardBody(n)) return true
    n = n.parent
  }
  return false
}

type Call = { fn: string; name: string; line: number; guarded: boolean }
const calls: Call[] = []
const guardSites: { fn: string; name: string; line: number }[] = []

for (const fnName of LOOPS) {
  const root = findFn(fnName)
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const name = calleeName(n)
      if (name === 'atGuard') {
        const arg0 = n.arguments[0]
        guardSites.push({
          fn: fnName,
          name: arg0 && ts.isStringLiteralLike(arg0) ? arg0.text : '<NON-LITERAL>',
          line: lineOf(n),
        })
      } else {
        calls.push({ fn: fnName, name, line: lineOf(n), guarded: isGuarded(n, root) })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(root.body!)
}

const unguarded = calls.filter((c) => !c.guarded)

// The skeleton. Not automations: the loop's own early-return preamble, which cannot be moved inside a
// boundary without changing what `return` means. Pinned by name AND by count, so this is a two-entry
// list rather than a category anyone can grow.
const SKELETON: Record<string, string> = {
  'mainLoop:getPageSetting@167':
    "the PauseScript early-return. A `return` cannot be lifted into a closure, and getPageSetting() is " +
    'the loop\'s own gate rather than an automation. If getPageSetting itself throws, AT is over anyway.',
}
const key = (c: Call) => `${c.fn}:${c.name}@${c.line}`

describe('#87 — every mainLoop/guiLoop dispatch is inside an error boundary', () => {
  it('the AST walk actually found the loops and their dispatches (anti-false-green)', () => {
    // A walk that silently breaks reports ZERO unguarded calls — which is exactly what a correctly
    // guarded tree reports too. That is the #66 failure mode. Pin the shape so a collapse is a RED.
    expect(LOOPS.map(findFn).map((f) => f.name!.text)).toEqual(['mainLoop', 'guiLoop'])
    expect(guardSites.length).toBeGreaterThanOrEqual(60)
    expect(calls.length).toBeGreaterThanOrEqual(80)
    expect(calls.filter((c) => c.guarded).length).toBeGreaterThanOrEqual(80)
    // Both loops must be represented — a walk that only reached mainLoop would report guiLoop clean.
    expect(new Set(guardSites.map((g) => g.fn))).toEqual(new Set(['mainLoop', 'guiLoop']))
    // And the loops must still be the ones the game actually ticks. If someone renames the callback or
    // registers a THIRD timer, the net is pointed at a corpse and would report green forever.
    const src = readFileSync(resolve(ROOT, FILE), 'utf8')
    expect(src).toMatch(/setInterval\(mainLoop, runInterval\)/)
    expect(src).toMatch(/setInterval\(guiLoop, runInterval \* 10\)/)
    expect(src.match(/setInterval\(/g)?.length).toBe(2)
  })

  it('no call in mainLoop or guiLoop escapes atGuard()', () => {
    // THE HEADLINE. Add `if (getPageSetting('X')) newAutomation();` to mainLoop and this names it, with
    // its line number, on the first CI run — which is the entire point of the exercise.
    const report = unguarded
      .filter((c) => !(key(c) in SKELETON))
      .map((c) => `${FILE}:${c.line}  ${c.fn}(): ${c.name}(...) is NOT inside an atGuard() — a throw here kills every dispatch after it`)
    expect(report).toEqual([])
  })

  it('the skeleton allowlist only shrinks, and every entry is argued for', () => {
    const live = new Set(unguarded.map(key))
    for (const k of Object.keys(SKELETON))
      expect(live.has(k), `${k} is now guarded (or has moved) — update/delete it from SKELETON`).toBe(true)
    for (const [k, why] of Object.entries(SKELETON))
      expect(why.length, `${k} needs a written justification`).toBeGreaterThan(40)
    // One entry. It is the PauseScript gate. There is no second reason to be here.
    expect(Object.keys(SKELETON).length).toBe(1)
  })

  it('every guard name is a string literal, and duplicates are only the deliberate ones', () => {
    // A non-literal name breaks the throttle key AND the player-facing log line.
    expect(guardSites.filter((g) => g.name === '<NON-LITERAL>')).toEqual([])

    // The name is the throttle key: two unrelated sites sharing a name means the first one to fail
    // SILENCES the second forever. Duplicates are legal only where the same automation is dispatched
    // from mutually-exclusive arms of one multitoggle chain — those are one logical site.
    const counts = new Map<string, number>()
    for (const g of guardSites) counts.set(g.name, (counts.get(g.name) ?? 0) + 1)
    const dupes = [...counts].filter(([, n]) => n > 1).map(([n]) => n).sort()
    expect(dupes).toEqual(['RbuyJobs', 'buyBuildings', 'buyJobs', 'buyStorage'])
  })

  it('guiLoop is statements, not one all-or-nothing comma expression', () => {
    // It shipped as a single comma-sequence, so a throw in updateCustomButtons() also cost you the
    // storedMODULES persist, the enhanced grids and the AFK overlay. De-comma'ing it is a precondition
    // of guarding it, and re-comma'ing it would re-fuse them behind one boundary.
    const body = findFn('guiLoop').body!
    expect(body.statements.length).toBe(4)
    for (const st of body.statements) {
      expect(ts.isExpressionStatement(st)).toBe(true)
      const ex = (st as ts.ExpressionStatement).expression
      expect(ts.isCallExpression(ex) && ts.isIdentifier(ex.expression) && ex.expression.text === 'atGuard').toBe(true)
    }
  })
})
