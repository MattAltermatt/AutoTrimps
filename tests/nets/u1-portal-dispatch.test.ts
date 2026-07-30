import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

// #304 — the structural net for a REFUTATION, not for a fix.
//
// #304 reported that `c2runner()` walks all eleven of its Challenge² arms in Universe 2, finds every one
// unofferable (none of Size/Slow/Watch/Discipline/Balance/Meditate/Metal/Lead/Nom/Electricity/Toxicity
// carries `allowU2` — verified against the pinned clone's config.js, block by block), and logs eleven
// "cannot be started" lines. Its suggested fix was an early `if (portalUniverse == 2) return;`.
//
// That state is unreachable, so the suggested guard would have been dead code — the #248/#225 class this
// campaign exists to remove, added by the campaign itself. The chain, each link checkable:
//
//   1. `c2runner()` has exactly ONE caller: `doPortal()` (portal.ts).
//   2. `doPortal()` calls `portalClicked()` before it reaches the c2runner block, and portalClicked sets
//      `portalUniverse = game.global.universe` unconditionally (main.js:1667).
//   3. Every function that can reach `doPortal()` is dispatched by mainLoop ONLY inside its
//      `if (game.global.universe == 1)` block. The U2 twins go through `RdoPortal`, which never calls
//      `c2runner`.
//
// So `portalUniverse` is 1 for every live call, and the eleven-line diagnostic cannot happen.
//
// Link 3 is the one a future edit can silently break — moving a portal dispatch out of the U1 block, or
// adding a new doPortal caller and wiring it up next to the U2 automations, makes #304 live again. That
// is what this net pins. The subject set is DERIVED from portal.ts (every exported function whose body
// contains a `doPortal(...)` call), not listed here: a hand-written list of three names would be a
// restatement of today's code and would not notice a fourth.
//
// ⚠️ This net says nothing about whether the guard would be CORRECT — only that nothing can reach the
// state it guards. If link 3 ever fails, re-open #304; do not add the guard while this is green.

const ROOT = resolve(__dirname, '..', '..')

function parse(rel: string) {
  return ts.createSourceFile(rel, readFileSync(resolve(ROOT, rel), 'utf8'), ts.ScriptTarget.ES2020, true)
}

/** Names of the exported functions in portal.ts whose bodies call `doPortal(...)` directly. */
function doPortalCallers(): string[] {
  const sf = parse('src/modules/portal.ts')
  const out: string[] = []
  sf.forEachChild((node) => {
    if (!ts.isFunctionDeclaration(node) || !node.name || !node.body) return
    let calls = false
    const walk = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'doPortal') calls = true
      n.forEachChild(walk)
    }
    walk(node.body)
    if (calls) out.push(node.name.text)
  })
  return out.sort()
}

/** Every identifier CALLED anywhere inside `if (game.global.universe == 1) { … }` in main-loop.ts. */
function calledInsideU1Block(): { inside: Set<string>; outside: Set<string> } {
  const sf = parse('src/modules/main-loop.ts')
  const inside = new Set<string>()
  const outside = new Set<string>()

  const isU1Test = (e: ts.Expression) =>
    /^game\.global\.universe\s*===?\s*1$/.test(e.getText().replace(/\s+/g, ' ').trim())

  const collect = (n: ts.Node, bucket: Set<string>) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) bucket.add(n.expression.text)
    n.forEachChild((c) => collect(c, bucket))
  }

  const walk = (n: ts.Node) => {
    if (ts.isIfStatement(n) && isU1Test(n.expression)) {
      collect(n.thenStatement, inside)
      if (n.elseStatement) collect(n.elseStatement, outside)
      return
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) outside.add(n.expression.text)
    n.forEachChild(walk)
  }
  sf.forEachChild(walk)
  return { inside, outside }
}

describe('doPortal is dispatched only from mainLoop\'s Universe-1 block (#304)', () => {
  it('the derivation finds the portal entry points, and finds more than one', () => {
    // Anti-false-green: an empty or single-element subject set would make every assertion below
    // vacuous, and a rename or a refactor of portal.ts is exactly how that happens quietly.
    const callers = doPortalCallers()
    expect(callers.length).toBeGreaterThan(1)
    expect(callers).toContain('c2runnerportal') // the one #304 is about
  })

  it('every doPortal caller is dispatched INSIDE the Universe-1 block and nowhere else', () => {
    const { inside, outside } = calledInsideU1Block()
    const callers = doPortalCallers()
    const dispatched = callers.filter((n) => inside.has(n))
    // Each one is wired up, so "not dispatched outside" cannot pass by never being dispatched at all.
    expect(dispatched).toEqual(callers)
    expect(callers.filter((n) => outside.has(n))).toEqual([])
  })

  it('the U1 block really is a block — the net is reading the guard it thinks it is', () => {
    // If the `if (game.global.universe == 1)` matcher stopped matching, `inside` would be empty and the
    // assertion above would still pass for the trivial reason. Pin a known-U1 automation instead.
    const { inside } = calledInsideU1Block()
    expect(inside.has('autoPortal')).toBe(true)
    expect(inside.size).toBeGreaterThan(10)
  })
})
