// NET — a tripwire's PREDICATE being guarded is not the same as its INVOCATION being guarded (#261).
//
// The hydration check is the one that matters most here: injecting a raw `JSON.stringify(game)` into
// a fixture silently drops the ~1,091 game methods (`game.buildings.Shed.cost.wood` is a *function*),
// producing a green suite that tests nothing. Both harnesses defend against that —
// `assertGameHydrated` in the sim boot, `assertHydrated` in the true-TS fixture — and the Phase 0
// repair made both predicates directly exercisable: weakening either reddens real tests.
//
// The residual that repair left: **deleting the CALL** would leave every one of those tests green.
// A predicate nobody invokes is a comment. Closing that needs a static call-site scan rather than
// another unit test, because no unit test can observe its own absence.
//
// The scan is anchored on the AST, not on source text, so it cannot be satisfied by the assertion
// strings in this file — a source scan that matches its own error messages is a net that passes
// because it exists.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as ts from 'typescript'

const ROOT = resolve(__dirname, '../..')
const parse = (rel: string, kind: ts.ScriptKind) =>
  ts.createSourceFile(rel, readFileSync(join(ROOT, rel), 'utf8'), ts.ScriptTarget.Latest, true, kind)

/** Names of functions called anywhere inside the named enclosing function. */
function callsInside(sf: ts.SourceFile, enclosing: string): Set<string> {
  const out = new Set<string>()
  const collect = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) out.add(n.expression.text)
    ts.forEachChild(n, collect)
  }
  const find = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === enclosing && n.body) collect(n.body)
    ts.forEachChild(n, find)
  }
  find(sf)
  return out
}

/** Every `name(...)` call in a file, by callee identifier. */
function allCalls(sf: ts.SourceFile): Set<string> {
  const out = new Set<string>()
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) out.add(n.expression.text)
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

function testFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'fixtures' || e.name === 'node_modules') continue
      testFiles(rel, acc)
    } else if (e.name.endsWith('.ts')) acc.push(rel)
  }
  return acc
}

describe('hydration tripwires are INVOKED, not merely defined (#261)', () => {
  const boot = parse('scripts/sim/boot.mjs', ts.ScriptKind.JS)

  it('anti-false-green: the walk really resolved bootGame', () => {
    // Anchored on a NAMED call, deliberately not on a call COUNT: a count floor reddens on any
    // refactor that removes an unrelated call, and a net that cries wolf gets deleted. If the walk
    // ever stops resolving the function this goes red, rather than the invariant below quietly
    // passing on an empty set.
    expect(callsInside(boot, 'bootGame').has('installVirtualTimers')).toBe(true)
  })

  it('bootGame() calls assertGameHydrated — the predicate is useless uninvoked', () => {
    expect(
      callsInside(boot, 'bootGame').has('assertGameHydrated'),
      'scripts/sim/boot.mjs: bootGame no longer calls assertGameHydrated. Every fixture in the ' +
        'corpus can now be a stripped game object — the shape that produces a green suite testing nothing.',
    ).toBe(true)
  })

  it('the true-TS fixture tripwire has real call sites outside its own module', () => {
    // gameFixture.ts exports assertHydrated; a definition with no callers is the same dead-tripwire
    // shape one layer up. This has carried the identical limitation since it was written.
    const callers = testFiles('tests')
      .filter((f) => f !== 'tests/harness/gameFixture.ts')
      .filter((f) => allCalls(parse(f, ts.ScriptKind.TS)).has('assertHydrated'))
    expect(callers.length, 'nothing calls assertHydrated any more — the anti-false-green floor is gone').toBeGreaterThan(0)
  })
})
