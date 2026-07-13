import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import ts from 'typescript'

// #72 — the bridge-collision net. A bug class nobody had ever looked for.
//
// src/legacy-bridge.ts ends in ONE statement:
//     Object.assign(globalThis, { ...utils, ...time, ..., ...settingsBoot })
// Object spread is LAST-WRITE-WINS. If two modules export the SAME name, the one spread LAST
// silently overwrites the other on globalThis — and from that moment every legacy caller and every
// cross-module free-identifier read resolves to the winner. There is no error, no warning, no lint
// hit, and a perfectly green `tsc --noEmit`: both modules are individually valid, and the ambient
// seam (src/game/at-legacy.d.ts) declares the bare name exactly once, so the types agree with the
// losing definition just as happily as with the winning one.
//
// The confirmed live instance, and the reason this file exists:
//   #72  settingsProfileMakeGUI — settings-visibility.ts exports an EMPTY `function
//        settingsProfileMakeGUI() { }` (spread #30, WINS). import-export.ts exports the REAL 36-line
//        implementation (spread #23, LOSES). The whole Settings-Profile feature — the dropdown, and
//        save/switch/delete of named profiles — never renders. It has looked like working, defined,
//        typechecked code for the entire life of the port.
//
// The EMPTY-WINS shape is the one graded CRITICAL: a definition that looks complete and behaves like
// nothing. But ANY duplicate name across two bridged modules is a failure here, because the winner is
// decided by a comma position in one long line — which is not a place anyone reviews. A duplicate that
// is genuinely intentional must be named in ALLOWLIST, with the reason written down.
//
// SCOPE, stated honestly. This net grades COLLISIONS ON THE SPREAD (named exports re-published onto
// globalThis). It deliberately does NOT cover the bridge's OTHER collision channel: two modules whose
// top-level bodies both assign the same `globalThis.X = …` as an import-time side effect. Those are
// decided by IMPORT (module-eval) order, not spread order, and legacy-bridge.ts's own comments
// (MECHANISM 2, the maps→mapfunctions placeholder race) show the maintainers already know it exists.
// That is a different net.

const ROOT = resolve(__dirname, '..', '..')
const BRIDGE = 'src/legacy-bridge.ts'

const parse = (rel: string) =>
  ts.createSourceFile(rel, readFileSync(join(ROOT, rel), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

// ---------------------------------------------------------------------------------------------
// 1. Read the SPREAD ORDER out of the bridge itself. Never hardcode a module list: adding a module
//    to the bridge must extend this net's coverage for free, on the same commit, with no edit here.
// ---------------------------------------------------------------------------------------------

const bridge = parse(BRIDGE)

/** `import * as settingsVisibility from './modules/settings-visibility'` → alias ⇒ source file. */
const aliasToFile = new Map<string, string>()
for (const st of bridge.statements) {
  if (!ts.isImportDeclaration(st)) continue
  const clause = st.importClause?.namedBindings
  if (!clause || !ts.isNamespaceImport(clause)) continue
  if (!ts.isStringLiteralLike(st.moduleSpecifier)) continue
  const spec = st.moduleSpecifier.text
  const m = /^\.\/modules\/([\w-]+)$/.exec(spec)
  if (m) aliasToFile.set(clause.name.text, `src/modules/${m[1]}.ts`)
}

/** The spread order inside `Object.assign(globalThis, { ...a, ...b })` — index 0 loses to index n. */
function readSpreadOrder(): string[] {
  let order: string[] | null = null
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Object' &&
      node.expression.name.text === 'assign' &&
      ts.isIdentifier(node.arguments[0]) &&
      node.arguments[0].text === 'globalThis' &&
      node.arguments[1] &&
      ts.isObjectLiteralExpression(node.arguments[1])
    ) {
      const names: string[] = []
      for (const p of node.arguments[1].properties)
        if (ts.isSpreadAssignment(p) && ts.isIdentifier(p.expression)) names.push(p.expression.text)
      // If the bridge ever grows a second Object.assign(globalThis, …) the winner rule changes and
      // this net's model is wrong. Fail loudly rather than silently grading the first one.
      if (order) throw new Error(`${BRIDGE}: more than one Object.assign(globalThis, …) — the net's model is stale`)
      order = names
    }
    ts.forEachChild(node, visit)
  }
  visit(bridge)
  if (!order) throw new Error(`${BRIDGE}: no Object.assign(globalThis, {...}) found — the net's model is stale`)
  return order
}

const spreadOrder = readSpreadOrder()

// ---------------------------------------------------------------------------------------------
// 2. Enumerate what each module actually publishes.
// ---------------------------------------------------------------------------------------------

type Def = { name: string; file: string; alias: string; line: number; kind: string; empty: boolean; spreadIdx: number }

const isExported = (n: ts.Node) =>
  ts.canHaveModifiers(n) && ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true

/** Every name a module contributes to the spread — i.e. every own key of its namespace object. */
function exportsOf(file: string): Omit<Def, 'alias' | 'spreadIdx' | 'file'>[] {
  const sf = parse(file)
  const line = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const out: Omit<Def, 'alias' | 'spreadIdx' | 'file'>[] = []

  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && isExported(st) && st.name) {
      // An EMPTY body is the dangerous shape: it looks like a definition and behaves like nothing.
      // (A declaration with no body at all is an overload signature / ambient decl — also empty.)
      out.push({ name: st.name.text, line: line(st), kind: 'function', empty: !st.body || st.body.statements.length === 0 })
      continue
    }
    if (ts.isVariableStatement(st) && isExported(st)) {
      for (const d of st.declarationList.declarations)
        if (ts.isIdentifier(d.name)) out.push({ name: d.name.text, line: line(d), kind: 'var', empty: false })
      continue
    }
    // Not used by src/modules today, but a namespace object publishes these too. Covering them now
    // means a future `export class` / `export { x }` cannot open a hole in this net by arriving.
    if ((ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) && isExported(st) && st.name) {
      out.push({ name: st.name.text, line: line(st), kind: ts.isClassDeclaration(st) ? 'class' : 'enum', empty: false })
      continue
    }
    if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
      // `export { a, b as c }` / re-exports. Type-only specifiers publish nothing at runtime.
      if (st.isTypeOnly) continue
      for (const el of st.exportClause.elements)
        if (!el.isTypeOnly) out.push({ name: el.name.text, line: line(el), kind: 'export-specifier', empty: false })
    }
  }
  return out
}

// name ⇒ every module that publishes it, in spread order.
const byName = new Map<string, Def[]>()
spreadOrder.forEach((alias, spreadIdx) => {
  const file = aliasToFile.get(alias)
  if (!file) throw new Error(`${BRIDGE}: spread of \`...${alias}\` has no matching \`import * as ${alias}\``)
  for (const e of exportsOf(file)) {
    const def: Def = { ...e, alias, file, spreadIdx }
    if (!byName.has(e.name)) byName.set(e.name, [])
    byName.get(e.name)!.push(def)
  }
})

type Collision = { name: string; winner: Def; losers: Def[]; critical: boolean }

const collisions: Collision[] = [...byName.entries()]
  .filter(([, defs]) => defs.length > 1)
  .map(([name, defs]) => {
    const sorted = [...defs].sort((a, b) => a.spreadIdx - b.spreadIdx)
    const winner = sorted[sorted.length - 1]! // LAST spread wins — this is the whole bug.
    const losers = sorted.slice(0, -1)
    // CRITICAL := an empty definition shadowing a real one. The feature is silently dead.
    return { name, winner, losers, critical: winner.empty && losers.some((l) => !l.empty) }
  })

const describeCollision = (c: Collision) =>
  `${c.name}${c.critical ? ' [CRITICAL: EMPTY body wins over a REAL implementation]' : ''} — ` +
  `WINS ${c.winner.file}:${c.winner.line} (spread #${c.winner.spreadIdx}${c.winner.empty ? ', EMPTY' : ''}); ` +
  `shadowed: ${c.losers.map((l) => `${l.file}:${l.line} (spread #${l.spreadIdx}${l.empty ? ', empty' : ''})`).join(', ')}`

// ---------------------------------------------------------------------------------------------
// 3. The baselines.
// ---------------------------------------------------------------------------------------------

// The shrinking baseline. Every entry is a CONFIRMED BUG with a filed issue — not an excuse. It exists
// so the net is green on `main` today while the fix lands behind it. It may only ever get SMALLER: the
// guard test below goes red the moment an entry stops being a live collision, forcing its deletion.
const KNOWN_COLLISION: Record<string, string> = {
  settingsProfileMakeGUI:
    '#72 — settings-visibility.ts (spread #30) exports an EMPTY stub that beats the real 36-line ' +
    'implementation in import-export.ts (spread #23). The entire Settings-Profile feature is dead. ' +
    'Fix = delete the empty stub; do NOT "fix" it by reordering the spread.',
}

// Genuinely INTENTIONAL duplicate exports. Empty today, and that is the correct state: nothing in this
// codebase deliberately relies on spread order to pick between two definitions. An entry here must say
// WHY the shadowing is wanted and why the loser cannot simply be deleted — because a name in here is a
// name this net has stopped watching.
const ALLOWLIST = new Set<string>([])

// ---------------------------------------------------------------------------------------------

describe('legacy-bridge spread — no module may silently shadow another module (#72)', () => {
  it('parses a real corpus (guards against the AST walk silently matching nothing)', () => {
    // Anti-false-green. If a refactor breaks any of these walks, the sets collapse to empty and every
    // assertion below passes vacuously — the repo's #66 failure mode, and the thing we most fear. Pin
    // the shape of the corpus so a broken walk fails HERE, loudly, instead of certifying the class closed.
    expect(spreadOrder.length).toBeGreaterThanOrEqual(30)
    // Every spread alias must have resolved to a real module file (readSpreadOrder throws otherwise).
    expect(spreadOrder.filter((a) => aliasToFile.has(a)).length).toBe(spreadOrder.length)
    // The bridge's own doc-comment calls this "the wildcard spread — you cannot forget a name". If the
    // export walk regresses, the published surface collapses and no collision can be found.
    expect(byName.size).toBeGreaterThan(300)

    // Pin known-published names so a regression in the export walk cannot quietly drop a declaration
    // form. (Every export in src/modules today is an `export function` — the walk also handles var /
    // const / let / class / enum / `export {}` so that a future form arrives INSIDE the net, not around
    // it. Those paths are unexercised by the current corpus, which is why the counts are pinned too.)
    const at = (n: string) => (byName.get(n) ?? []).map((d) => `${d.file}:${d.line}`)
    expect(at('byId')).toContain('src/modules/utils.ts:181')
    expect(at('createSetting')).toContain('src/modules/settings-engine.ts:55')
    // Every bridged module must have contributed at least one export; a module whose walk returned
    // nothing is a module this net is not watching at all.
    const contributing = new Set([...byName.values()].flat().map((d) => d.alias))
    expect(contributing.size).toBe(spreadOrder.length)

    // And pin BOTH halves of the #72 collision. If either side stops being seen, the baseline entry
    // below would start "passing" for the wrong reason.
    expect(at('settingsProfileMakeGUI')).toEqual([
      'src/modules/import-export.ts:8',
      'src/modules/settings-visibility.ts:1017',
    ])
  })

  it('the last-write-wins model is grounded in the real bridge (empty stub beats real impl)', () => {
    const c = collisions.find((x) => x.name === 'settingsProfileMakeGUI')
    expect(c, 'the #72 collision must still be detected').toBeDefined()
    // The winner is decided by spread position, NOT by file order, NOT by import order. Assert that
    // this net actually implements that rule — a net that picked the first definition would grade #72
    // as harmless and report GREEN on a dead feature.
    expect(c!.winner.file).toBe('src/modules/settings-visibility.ts')
    expect(c!.winner.empty).toBe(true)
    expect(c!.losers.map((l) => l.file)).toEqual(['src/modules/import-export.ts'])
    expect(c!.losers[0]!.empty).toBe(false)
    expect(c!.critical).toBe(true)
  })

  it('no module export is shadowed by another module on the bridge', () => {
    const unexplained = collisions
      .filter((c) => !ALLOWLIST.has(c.name))
      .filter((c) => !(c.name in KNOWN_COLLISION))
      .map(describeCollision)
    // Read the failure literally: two modules export this name, and a comma position in one long line
    // decides which one every caller in the codebase gets. Delete one, or justify it in ALLOWLIST.
    expect(unexplained).toEqual([])
  })

  it('no CRITICAL collision may EVER be allowlisted — an empty winner is never intentional', () => {
    // ALLOWLIST is for deliberate shadowing. "The dead stub is deliberate" is not a thing. This closes
    // the obvious escape hatch: making #72 green by moving it from the fix-queue into the allowlist.
    const smuggled = collisions.filter((c) => c.critical && ALLOWLIST.has(c.name)).map(describeCollision)
    expect(smuggled).toEqual([])
  })

  it('the known-collision baseline only shrinks — it is a fix queue, not an allowlist', () => {
    const live = new Map(collisions.map((c) => [c.name, c]))
    for (const [name, why] of Object.entries(KNOWN_COLLISION)) {
      expect(
        live.has(name),
        `${name} is no longer a bridge collision — the bug is FIXED. Delete it from KNOWN_COLLISION. (${why})`,
      ).toBe(true)
    }
    // A ceiling, so a new bug cannot be parked here by appending a line.
    expect(Object.keys(KNOWN_COLLISION).length).toBeLessThanOrEqual(1)
    expect(ALLOWLIST.size).toBe(0)
  })
})
