import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import ts from 'typescript'
import { MANIFEST } from '../../scripts/build-userscript.mjs'

// #70 / #88 — the `MODULES.<ns>.<field>` read-but-never-written net.
//
// MODULES is the cross-module config registry (`var MODULES = {}`, AutoTrimps2.js:102). A field that
// is READ but that nothing ever ASSIGNS is `undefined` at runtime, and `undefined` loses every
// comparison silently: `n >= undefined` is false, `undefined == false` is false, `if (undefined)` is
// false. No throw, no warning, green typecheck (the ambient decl is `any`), green tests. The guard is
// simply dead, forever, and it reads like working code.
//
// Two HIGH bugs of exactly this shape shipped to users:
//   #70  MODULES["maps"].enoughDamageCutoff / .RenoughDamageCutoff — never written, so the "CAM: H:D"
//        option of Armor Magic is a no-op in ALL FOUR settings, both universes.
//   #88  MODULES["jobs"].customRatio / .RcustomRatio — the `= [...]` was dropped, leaving a bare member
//        access. It is the HIGHEST-PRIORITY branch of workerRatios(), and it can never fire.
//
// Forty-five reading agents swept these modules in code review v2 and every one walked past both.
// A set-difference found them in ten minutes. That is the lesson this file exists to institutionalize:
// where a defect class is "these two sets must match", build the net — don't staff the reading.
//
// SCOPE, stated honestly. This net proves "zero writers anywhere". It deliberately does NOT catch a
// field whose only writer is gated on the field already being defined — e.g. MODULES.graphs._lastTheme
// (settings-visibility.ts:16 assigns it, but only inside a branch guarded by it being !== undefined, so
// it never initializes). That is a self-gated-initializer bug, a different class needing a different net.

const ROOT = resolve(__dirname, '..', '..')

// The corpus is the SHIPPED bundle's inputs, not the source tree. legacy/GraphsOnly.js declares its own
// `var MODULES = {}` and legacy/FastPriorityQueue.js defines globals — NEITHER is in the build MANIFEST,
// so counting them as writers would launder a bug (this is the false-pass #71 warns about, verbatim).
// Derived from the BUILD's own MANIFEST, never hardcoded. A hardcoded copy is how this net went stale
// when #75 vendored legacy/FastPriorityQueue.js: the file became part of the shipped bundle, but the net
// still believed it wasn't — so it kept treating FastPriorityQueue as externally-provided. Read the
// manifest and a newly-bundled legacy file joins every net's corpus for free, with nothing to remember.
const LEGACY_MANIFEST = MANIFEST.map((f: string) => join('legacy', f))

function tsSources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) tsSources(rel, acc)
    // .d.ts files are type-only: they have no runtime existence and can neither read nor write.
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) acc.push(rel)
  }
  return acc
}

type Access = { ns: string; field: string; file: string; line: number }

/**
 * Resolve `<root>.ns` / `<root>["ns"]` to its namespace name, where `root` is any identifier currently
 * bound to the MODULES registry. `roots` is scoped, not global: fight-info.ts and performance.ts are
 * IIFEs invoked as `})(MODULES, window)` and write through the parameter (`M["fightinfo"].Update = …`).
 * Those are REAL writers in the shipped bundle. A walk that only follows the literal identifier
 * `MODULES` reports them as phantom namespaces — a false positive that would have forced a bogus
 * allowlist entry, and an allowlist entry is how a net quietly stops being a net.
 */
function nsOf(node: ts.Node, roots: ReadonlySet<string>): string | null {
  if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return null
  const obj = node.expression
  if (!ts.isIdentifier(obj) || !roots.has(obj.text)) return null
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  const arg = node.argumentExpression
  return arg && ts.isStringLiteralLike(arg) ? arg.text : null
}

/** Resolve the field name off a `<MODULES.ns>.field` / `<MODULES.ns>["field"]` access. */
function fieldOf(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): string | null {
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  const arg = node.argumentExpression
  return arg && ts.isStringLiteralLike(arg) ? arg.text : null
}

const isAssignOp = (k: ts.SyntaxKind) => k >= ts.SyntaxKind.FirstAssignment && k <= ts.SyntaxKind.LastAssignment

/** If `node` is an IIFE receiving a MODULES root as an argument, return the param names it binds it to. */
function aliasesBoundBy(node: ts.CallExpression, roots: ReadonlySet<string>): string[] {
  let callee: ts.Node = node.expression
  while (ts.isParenthesizedExpression(callee)) callee = callee.expression
  if (!ts.isFunctionExpression(callee) && !ts.isArrowFunction(callee)) return []
  const bound: string[] = []
  node.arguments.forEach((arg, i) => {
    if (!ts.isIdentifier(arg) || !roots.has(arg.text)) return
    const p = callee.parameters[i]
    if (p && ts.isIdentifier(p.name)) bound.push(p.name.text)
  })
  return bound
}

function scan(files: string[]) {
  const reads: Access[] = []
  const writes: Access[] = []

  for (const rel of files) {
    const text = readFileSync(join(ROOT, rel), 'utf8')
    const kind = rel.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, kind)
    const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

    /**
     * Two distinct kinds of alias, and conflating them is how this net nearly shipped blind:
     *  - `roots`   — identifiers bound to the MODULES REGISTRY (`MODULES`; `M` inside `})(MODULES)`).
     *  - `nsAlias` — identifiers bound to a single NAMESPACE: `const customVars = MODULES["maps"]`.
     * The second is the codebase's dominant read idiom — 31 reads across buildings/fight/maps/breedtimer
     * go through `customVars.<field>`, and the very first draft of this net saw NONE of them. A net with
     * a false-negative channel that wide is worse than no net: it certifies the class as closed.
     */
    const visit = (node: ts.Node, roots: ReadonlySet<string>, nsAlias: Map<string, string>): void => {
      // Follow `;(function(M){ … })(MODULES)` — bind M as a registry root inside that function body only.
      if (ts.isCallExpression(node)) {
        const bound = aliasesBoundBy(node, roots)
        if (bound.length) {
          const inner = new Set([...roots, ...bound])
          ts.forEachChild(node, (c) => visit(c, inner, new Map(nsAlias)))
          return
        }
      }

      // A function body opens a new scope — copy the alias map so a sibling function's `customVars`
      // (bound to a different namespace) cannot leak across.
      if (ts.isFunctionLike(node)) {
        const inner = new Map(nsAlias)
        ts.forEachChild(node, (c) => visit(c, roots, inner))
        return
      }

      // Bind `const customVars = MODULES["maps"]` → customVars means the `maps` namespace from here on.
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const ns = nsOf(node.initializer, roots)
        if (ns) nsAlias.set(node.name.text, ns)
      }

      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        // Resolve the object: either a direct `MODULES.<ns>` access, or a bound namespace alias.
        const obj = node.expression
        const ns =
          ts.isIdentifier(obj) && nsAlias.has(obj.text) ? nsAlias.get(obj.text)! : nsOf(obj, roots)
        const field = fieldOf(node)
        if (ns && field) {
          const p = node.parent
          // A WRITE is the LHS of any assignment (=, +=, ??=, ...) or the operand of ++/--.
          const isAssignTarget =
            (ts.isBinaryExpression(p) && p.left === node && isAssignOp(p.operatorToken.kind)) ||
            ((ts.isPostfixUnaryExpression(p) || ts.isPrefixUnaryExpression(p)) &&
              (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken))
          ;(isAssignTarget ? writes : reads).push({ ns, field, file: rel, line: lineOf(node) })
        }
      }

      // Namespace seeding: `MODULES.maps = { foo: 1 }` / `M["fightinfo"] = { Update: … }` writes ns.foo.
      // coordinator.ts:12 and fight-info.ts:9 both use this style; missing it would false-positive them.
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const ns = nsOf(node.left, roots)
        if (ns && ts.isObjectLiteralExpression(node.right)) {
          for (const prop of node.right.properties) {
            const name = prop.name
            if (name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name)))
              writes.push({ ns, field: name.text, file: rel, line: lineOf(prop) })
          }
        }
      }

      ts.forEachChild(node, (c) => visit(c, roots, nsAlias))
    }
    visit(sf, new Set(['MODULES']), new Map())
  }
  return { reads, writes }
}

const CORPUS = tsSources('src').concat(LEGACY_MANIFEST)
const { reads, writes } = scan(CORPUS)
const key = (a: { ns: string; field: string }) => `${a.ns}.${a.field}`
const WRITTEN = new Set(writes.map(key))

// The shrinking baseline. Every entry is a CONFIRMED BUG with a filed issue — not an excuse. It exists
// so the net is green on `main` today while the fixes land one at a time behind it. It may only ever
// get SMALLER: a new phantom field fails on arrival (see the guard test below).
const KNOWN_PHANTOM: Record<string, string> = {
  // ✅ maps.enoughDamageCutoff / maps.RenoughDamageCutoff — FIXED (#70). armormagic()/Rarmormagic() now
  // read getPageSetting('mapcuntoff') / ('Rmapcuntoff'), the H:D thresholds their tooltips already
  // promise. The fields were NOT given writers — inventing a threshold number would have been a new
  // game-balance literal. They are simply no longer read, so the net drops them for free.
  'upgrades.autoGigas': '#70 (inst. 3) — buildings.ts:184 `== false` disjunct can never fire; real id is getPageSetting("AutoGigas")',
  // ✅ jobs.customRatio / jobs.RcustomRatio — FIXED (#88). They were bare member accesses with the
  // assignment dropped; now initialized to `null` at jobs.ts:22/:313. The net went red the moment they
  // gained a writer and would not go green again until these lines were deleted. That is the design.
}

describe('MODULES.<ns>.<field> — every field read must have a writer (#70, #88)', () => {
  it('parses a real corpus (guards against the AST walk silently matching nothing)', () => {
    // Anti-false-green: if a refactor breaks the walk these collapse to 0 and every assertion below
    // passes vacuously. That is the #66 failure mode. Pin the shape.
    expect(CORPUS.length).toBeGreaterThan(25)
    expect(writes.length).toBeGreaterThan(50)
    expect(reads.length).toBeGreaterThan(50)
    // Discover the namespaces rather than hardcoding them — a new MODULES.<x> must be netted for free.
    expect(new Set(writes.map((w) => w.ns)).size).toBeGreaterThanOrEqual(8)
    // The IIFE-alias resolution is load-bearing; if it regresses, these two namespaces vanish from the
    // write set and reappear as phantoms. Pin them so the alias walk can't silently rot.
    expect(WRITTEN.has('fightinfo.Update')).toBe(true)
    expect(WRITTEN.has('performance.isAFK')).toBe(true)
    // The `const customVars = MODULES["maps"]` namespace-alias resolution is the net's widest
    // false-negative channel — 31 reads hide behind it. Pin one read from each aliasing module so a
    // regression in the alias walk fails HERE rather than silently emptying the read set.
    const readKeys = new Set(reads.map(key))
    expect(readKeys.has('maps.numHitsSurvived')).toBe(true) // maps.ts:407 via customVars
    expect(readKeys.has('buildings.storageMainCutoff')).toBe(true) // buildings.ts:344 via customVars
  })

  it('no MODULES field is read but never written', () => {
    const phantom = new Map<string, Access[]>()
    for (const r of reads) {
      const k = key(r)
      if (WRITTEN.has(k) || k in KNOWN_PHANTOM) continue
      if (!phantom.has(k)) phantom.set(k, [])
      phantom.get(k)!.push(r)
    }
    const report = [...phantom.entries()].map(
      ([k, sites]) => `${k}  read at ${sites.map((s) => `${s.file}:${s.line}`).join(', ')}`,
    )
    expect(report).toEqual([])
  })

  it('the known-phantom baseline only shrinks — it is a fix queue, not an allowlist', () => {
    // Fix an entry and this goes red until you delete its line. That is deliberate: the baseline must
    // never become the place a new bug quietly lands.
    for (const k of Object.keys(KNOWN_PHANTOM)) {
      expect(WRITTEN.has(k), `${k} now HAS a writer — delete it from KNOWN_PHANTOM`).toBe(false)
      expect(
        reads.some((r) => key(r) === k),
        `${k} is no longer read — delete it from KNOWN_PHANTOM`,
      ).toBe(true)
    }
    // Ratcheted 5 → 1 by the #70 fixes. Only ever tighten.
    expect(Object.keys(KNOWN_PHANTOM).length).toBeLessThanOrEqual(1)
  })
})

describe('a test fixture may only seed MODULES fields production can produce (#74)', () => {
  // #74's class — and it is the reason the bug above stayed INVISIBLE. tests/other.rarmormagic.test.ts:19
  // hand-injects `MODULES = { maps: { RenoughDamageCutoff: 1 } }` — a field with zero production writers —
  // then asserts the feature works. Green suite, dead branch: the exact #66 failure mode. A harness that
  // seeds state production cannot produce is not measuring production.
  const testFiles = tsSources('tests').filter((f) => !f.includes(join('nets', 'modules-fields')))

  const injected: Access[] = []
  for (const rel of testFiles) {
    const text = readFileSync(join(ROOT, rel), 'utf8')
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
    const roots = new Set(['MODULES'])

    const visit = (node: ts.Node): void => {
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        // Whole-registry replacement: `(globalThis as any).MODULES = { ns: { field: … } }`.
        const l = node.left
        const isRegistryTarget =
          (ts.isPropertyAccessExpression(l) && l.name.text === 'MODULES') ||
          (ts.isIdentifier(l) && l.text === 'MODULES')
        if (isRegistryTarget && ts.isObjectLiteralExpression(node.right)) {
          for (const nsProp of node.right.properties) {
            if (!ts.isPropertyAssignment(nsProp) || !ts.isObjectLiteralExpression(nsProp.initializer)) continue
            const nsName = nsProp.name
            if (!ts.isIdentifier(nsName) && !ts.isStringLiteralLike(nsName)) continue
            for (const f of nsProp.initializer.properties) {
              const fn = f.name
              if (fn && (ts.isIdentifier(fn) || ts.isStringLiteralLike(fn)))
                injected.push({ file: rel, line: lineOf(f), ns: nsName.text, field: fn.text })
            }
          }
        }

        // Namespace replacement: `MODULES['coordinator'] = { active: …, topTarget: … }`. Each key is a
        // field claim about production, so check them individually — NOT as a field named 'coordinator'.
        const nsSeed = nsOf(l, roots)
        if (nsSeed && ts.isObjectLiteralExpression(node.right)) {
          for (const f of node.right.properties) {
            const fn = f.name
            if (fn && (ts.isIdentifier(fn) || ts.isStringLiteralLike(fn)))
              injected.push({ file: rel, line: lineOf(f), ns: nsSeed, field: fn.text })
          }
        }

        // Direct field poke: `MODULES.jobs.customRatio = [9, 8, 7]`. The object must ITSELF be a MODULES
        // access, or `MODULES['coordinator'] = …` mis-reads as ns=coordinator/field=coordinator.
        if (ts.isPropertyAccessExpression(l) || ts.isElementAccessExpression(l)) {
          const ns = nsOf(l.expression, roots)
          const field = fieldOf(l)
          if (ns && field) injected.push({ file: rel, line: lineOf(node), ns, field })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }

  // The same shrinking-baseline discipline as KNOWN_PHANTOM. Each of these is a test asserting a branch
  // that production cannot reach; each dies together with the production bug it is covering for.
  const KNOWN_TEST_LIE: Record<string, string> = {
    // ✅ tests/other.rarmormagic.test.ts — FIXED (#70/#74). It injected maps.RenoughDamageCutoff, a field
    // production never writes, and that injection is exactly what kept the dead branch looking alive. The
    // production bug is fixed and the injection is deleted; the test now reads production's real MODULES
    // shape and drives the H:D arm through the setting it actually reads.
    'tests/buildings.characterization.test.ts:103': '#70 (inst. 3) — injects upgrades.autoGigas',
    'tests/buildings.characterization.test.ts:382': '#70 (inst. 3) — injects upgrades.autoGigas',
  }

  it('finds the test-side MODULES injections (anti-false-green)', () => {
    expect(injected.length).toBeGreaterThan(5)
  })

  it('no test injects a MODULES field that production never writes', () => {
    const lies = injected
      .filter((i) => !WRITTEN.has(key(i)))
      .filter((i) => !(`${i.file}:${i.line}` in KNOWN_TEST_LIE))
      .map((i) => `${i.file}:${i.line} injects MODULES.${i.ns}.${i.field} — production never writes it`)
    expect(lies).toEqual([])
  })

  it('the known-test-lie baseline only shrinks', () => {
    const live = new Set(injected.filter((i) => !WRITTEN.has(key(i))).map((i) => `${i.file}:${i.line}`))
    for (const k of Object.keys(KNOWN_TEST_LIE))
      expect(live.has(k), `${k} no longer injects a phantom field — delete it from KNOWN_TEST_LIE`).toBe(true)
    // Ratcheted 3 → 2 by the #70 fix. Only ever tighten.
    expect(Object.keys(KNOWN_TEST_LIE).length).toBeLessThanOrEqual(2)
  })
})
