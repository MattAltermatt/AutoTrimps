import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import ts from 'typescript'
import { MANIFEST } from '../../scripts/build-userscript.mjs'

// #71 — the ambient-var read-but-never-written net.
//
// `src/game/at-legacy.d.ts` is the bare-name globalThis seam: converted modules read each other's
// state as free identifiers, so every such name needs an ambient `var X: any` here. That declaration
// is a PROMISE to the type-checker, and the type-checker cannot audit it. `tsc` accepts `X` whether or
// not one single line of shipped code ever assigns it.
//
// And the failure is not a quiet `undefined` (that is #70's class, netted in modules-fields.test.ts).
// Reading an ambient var that nothing ever created is a read of an UNDECLARED identifier, and that
// THROWS a ReferenceError. A `var` with no writer is a LIVE CRASH sitting behind a green build.
//
// Two of them shipped, and BOTH ARE NOW FIXED (#71) — the baseline below is empty, which is the state
// this net exists to reach and then defend. What they were:
//   #71a  storedMODULES      — read inside resetModuleVars(). It threw AFTER `ATrunning = false` and
//                              BEFORE the line that restored it, so the "Reset Module Vars" button did
//                              not merely fail: it stopped AutoTrimps DEAD until the page was reloaded.
//                              Fixed by persisting `compareModuleVars()`, which is what both of its
//                              sibling writers persist. The ambient decl is gone.
//   #71b  Rdshouldtributefarm — read twice in Rdheirloomswap(). `Rshouldtributefarm` (no `d`) has seven
//                              writers; the `Rd` twin had ZERO, and no daily variant of the flag exists.
//                              Reached every tick for a U2 Daily player. Fixed by reading the real flag,
//                              which is exactly what the identical non-daily twin block does. Decl gone.
// From here the baseline is EMPTY: a third one fails on arrival. That is the whole job.
//
// WHY THE CORPUS IS THE BUNDLE, NOT THE TREE. The build MANIFEST (scripts/build-userscript.mjs) is
// ['AutoTrimps2.js', 'Graphs.js'] plus the esbuild'd src/**. `legacy/mods.js`, `legacy/GraphsOnly.js`
// and `legacy/FastPriorityQueue.js` sit in the tree and are NOT bundled. Scanning `legacy/**` wholesale
// would hand `isSteam` a writer (mods.js:7) and `FastPriorityQueue` a writer (its own file) — two
// phantom writers, invented by the net, for names that genuinely do not exist at runtime. A net that
// launders the bug it exists to find is worse than no net. The corpus pin below is load-bearing.

const ROOT = resolve(__dirname, '..', '..')
// Derived from the BUILD's own MANIFEST, never hardcoded. A hardcoded copy is how this net went stale
// when #75 vendored legacy/FastPriorityQueue.js: the file became part of the shipped bundle, but the net
// still believed it wasn't — so it kept treating FastPriorityQueue as externally-provided. Read the
// manifest and a newly-bundled legacy file joins every net's corpus for free, with nothing to remember.
const LEGACY_MANIFEST = MANIFEST.map((f: string) => join('legacy', f))
const DTS = 'src/game/at-legacy.d.ts'

function tsSources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) tsSources(rel, acc)
    // .d.ts files are type-only: zero runtime existence, so they can neither read nor write.
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) acc.push(rel)
  }
  return acc
}

const parse = (rel: string) =>
  ts.createSourceFile(
    rel,
    readFileSync(join(ROOT, rel), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    rel.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  )

// ---------------------------------------------------------------------------------------------
// 1. The DECLARED set — every non-function ambient `var` in at-legacy.d.ts.
// ---------------------------------------------------------------------------------------------
// `function foo(): void` entries are skipped: #36 already pins those, and the kind-1 entries
// (`var fn: typeof import('../modules/X').fn`) stay IN — they are `var`s, and the exported function
// declaration that backs them is picked up as a writer below. If an owning module ever drops the
// export, the ambient var is left with no writer and this net fires. That is intentional.
type Decl = { name: string; line: number }
const declared: Decl[] = []
{
  const sf = parse(DTS)
  const visit = (n: ts.Node): void => {
    if (ts.isVariableStatement(n))
      for (const d of n.declarationList.declarations)
        if (ts.isIdentifier(d.name))
          declared.push({ name: d.name.text, line: sf.getLineAndCharacterOfPosition(d.getStart(sf)).line + 1 })
    ts.forEachChild(n, visit)
  }
  visit(sf)
}
const DECLARED = new Set(declared.map((d) => d.name))

// ---------------------------------------------------------------------------------------------
// 2. The WRITER set + the READ set, over the shipped corpus.
// ---------------------------------------------------------------------------------------------
const CORPUS = tsSources('src').concat(LEGACY_MANIFEST)

type Site = { name: string; file: string; line: number }
const writes: Site[] = []
const reads: Site[] = []
/** A read under `typeof x` is the one legal way to touch an undeclared name: it CANNOT throw. */
const typeofReads: Site[] = []

const isAssignOp = (k: ts.SyntaxKind) => k >= ts.SyntaxKind.FirstAssignment && k <= ts.SyntaxKind.LastAssignment
const isGlobalObj = (n: ts.Node): n is ts.Identifier =>
  ts.isIdentifier(n) && (n.text === 'globalThis' || n.text === 'window')

for (const rel of CORPUS) {
  const sf = parse(rel)
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const push = (sink: Site[], name: string, n: ts.Node) => {
    if (DECLARED.has(name)) sink.push({ name, file: rel, line: lineOf(n) })
  }

  /** Destructuring binds names too: `var {a, b} = …` / `var [x] = …` are real writers. */
  const bindings = (name: ts.BindingName, n: ts.Node): void => {
    if (ts.isIdentifier(name)) push(writes, name.text, n)
    else for (const el of name.elements) if (ts.isBindingElement(el)) bindings(el.name, n)
  }

  const visit = (node: ts.Node): void => {
    // --- WRITERS ---
    // `var/let/const X` — in AutoTrimps2.js (a classic script) a top-level one IS the global; in src
    // it is module-scoped, but the bridge republishes it if exported. We count any binding of the name
    // as a writer. This is deliberately GENEROUS: a false writer only costs a missed bug, whereas a
    // false MISSING writer costs a red net on healthy code, and a red net on healthy code is how a
    // gate gets disabled (that is literally how #67 happened). Generous + a mutation check beats
    // clever + unfalsifiable.
    if (ts.isVariableDeclaration(node)) bindings(node.name, node)
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name)
      push(writes, node.name.text, node)
    // Function parameters bind the name in their scope, so a read inside resolves to the param, not
    // the global — no ReferenceError is possible there.
    if (ts.isParameter(node)) bindings(node.name, node)

    if (ts.isBinaryExpression(node) && isAssignOp(node.operatorToken.kind)) {
      const l = node.left
      // Bare `X = …` — an assignment to an unbound name is an implicit global in the sloppy-mode
      // legacy, and in src it targets the ambient seam. Either way it CREATES the name.
      if (ts.isIdentifier(l)) push(writes, l.text, node)
      // The src-side idiom the conventions mandate: `globalThis.X = …` / `window.X = …`.
      else if (ts.isPropertyAccessExpression(l) && isGlobalObj(l.expression)) push(writes, l.name.text, node)
      else if (
        ts.isElementAccessExpression(l) &&
        isGlobalObj(l.expression) &&
        l.argumentExpression &&
        ts.isStringLiteralLike(l.argumentExpression)
      )
        push(writes, l.argumentExpression.text, node)
    }
    if (
      (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) &&
      ts.isIdentifier(node.operand)
    )
      push(writes, node.operand.text, node)

    // --- READS ---
    // A free identifier that is not a declaration name, not a property name (`o.X`), and not an object
    // key (`{ X: 1 }`). Those three are the classic ways a naive scan invents reads that do not exist.
    if (ts.isIdentifier(node) && DECLARED.has(node.text)) {
      const p = node.parent
      const isDeclName =
        (ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p) || ts.isBindingElement(p)) &&
        p.name === node
      const isMemberName = ts.isPropertyAccessExpression(p) && p.name === node
      const isObjKey = (ts.isPropertyAssignment(p) || ts.isPropertySignature(p)) && p.name === node
      const isImportExportName = ts.isImportSpecifier(p) || ts.isExportSpecifier(p)
      if (!isDeclName && !isMemberName && !isObjKey && !isImportExportName) {
        // Unwrap `typeof(X)` — the parens are a ParenthesizedExpression, and jobs.ts:566 writes it
        // exactly that way. Missing the unwrap would misfile the one safe read in the codebase as a
        // crash and hand this net a false bug report.
        let up: ts.Node = node
        while (ts.isParenthesizedExpression(up.parent)) up = up.parent
        ;(ts.isTypeOfExpression(up.parent) ? typeofReads : reads).push({
          name: node.text,
          file: rel,
          line: lineOf(node),
        })
      }
    }

    ts.forEachChild(node, visit)
  }
  visit(sf)
}

const WRITTEN = new Set(writes.map((w) => w.name))
const BARE_READ = new Set(reads.map((r) => r.name))
const TYPEOF_READ = new Set(typeofReads.map((r) => r.name))

// ---------------------------------------------------------------------------------------------
// 3. The two lists.
// ---------------------------------------------------------------------------------------------

/**
 * EXTERNALLY_PROVIDED — names that legitimately have no writer in our corpus because something
 * OUTSIDE the corpus creates them at runtime. Each entry names the provider. This list is not a
 * silencer: an entry is a claim about the runtime, and if you cannot name the provider, the name
 * belongs in KNOWN_UNWRITTEN as a bug.
 */
const EXTERNALLY_PROVIDED: Record<string, string> = {
  // Provided by the GAME. `.trimps-game/main.js:14396` — `var dailyModifiers = {…}`, a classic-script
  // top-level var, i.e. a real global by the time our userscript runs. calc.ts reads it bare (:124).
  dailyModifiers: 'game global — .trimps-game/main.js:14396 `var dailyModifiers = {`',

  // ✅ FastPriorityQueue LEFT THIS LIST in #75. It used to be provided by a REMOTE <script> — perks.ts
  // injected `https://Zorn192.github.io/AutoTrimps/FastPriorityQueue.js`, i.e. the name's runtime
  // existence depended on a third party's GitHub Pages account staying alive and uncompromised. The file
  // was already sitting in legacy/, just never bundled; it is now in the MANIFEST, so the name has a real
  // writer in our own shipped bytes and an allowlist entry would be a lie. This is what it looks like when
  // an EXTERNALLY_PROVIDED entry gets *fixed* rather than accumulated: the entry is deleted, not annotated.
  // Guarded going forward by tests/nets/supply-chain.test.ts.

  // Provided by the DOM. import-export.ts:15 sets `$settingsProfiles.id = 'settingsProfiles'` and mounts
  // the <select>; the browser then reflects it as `window.settingsProfiles` (named access on window).
  // Read bare at :876 (`settingsProfiles.value`) and from two inline onclick= strings (:866, :870).
  settingsProfiles: 'DOM named access — <select id="settingsProfiles"> mounted by import-export.ts:15',

  // NOT provided at all in the web build — and that is CORRECT. Its only writer anywhere is
  // `legacy/mods.js:7` (`var isSteam = true`), the Steam-loader variant, which is NOT in the MANIFEST.
  // In the userscript this name never exists, and jobs.ts:566 knows it: `typeof(isSteam) !== 'undefined'`.
  // A `typeof` read of an undeclared name is the one form that does NOT throw. The typeof guard is the
  // whole reason this is a feature and not a third crash — so the net PINS the guard (see the severity
  // test below). Delete the guard and this file goes red.
  isSteam: 'never defined in the web bundle (only legacy/mods.js, unbundled) — read solely under `typeof`',
}

/**
 * KNOWN_UNWRITTEN — the shrinking baseline. Confirmed ReferenceError bugs, filed, awaiting fix in a
 * later phase. This net does NOT fix them; it stops a third one arriving unnoticed. It may only ever
 * get smaller — the guard test below goes red the moment an entry is fixed, demanding its deletion.
 */
const KNOWN_UNWRITTEN: Record<string, string> = {
  // ✅ EMPTY — both #71 crashes are fixed and both ambient decls are deleted from at-legacy.d.ts.
  // Do not add to this. An ambient `var` with no writer is a live ReferenceError; if one appears, the
  // fix is to give it a writer or delete the decl, never to park it here.
}

// ---------------------------------------------------------------------------------------------
// 4. The tests.
// ---------------------------------------------------------------------------------------------

describe('at-legacy.d.ts — every ambient var must have a writer in the shipped bundle (#71)', () => {
  it('parses a real corpus (anti-false-green: the walk must not silently match nothing)', () => {
    // If a refactor breaks the AST walk, every set collapses to empty and each assertion below passes
    // VACUOUSLY. That is the #66 failure mode — a green suite measuring nothing — and it is the single
    // thing this repo most fears. Pin the shape hard enough that a collapse cannot hide.
    expect(CORPUS.length).toBeGreaterThan(30)
    expect(declared.length).toBeGreaterThan(300)
    expect(writes.length).toBeGreaterThan(400)
    expect(reads.length).toBeGreaterThan(1000)

    // The CORPUS IS THE BUNDLE. These files are NOT in the MANIFEST; if either ever slips into the corpus
    // it silently donates a writer for `isSteam`, and this net starts certifying a name that does not exist
    // at runtime. This is the #71 false-pass, pinned. (#134 deleted both files from the tree — they were
    // upstream-fork distribution shims injecting the wrong origin — so this now also guards against a
    // resurrected path, not just a MANIFEST slip.)
    expect(CORPUS).not.toContain(join('legacy', 'mods.js'))
    expect(CORPUS).not.toContain(join('legacy', 'GraphsOnly.js'))
    // #133 — AutoTrimps2.js is now src/modules/main-loop.ts (a normal src module in the corpus). It still
    // donates the base-state writers (globalThis.MODULES = {}, MODULESdefault, autoTrimpSettings, …).
    expect(CORPUS).toContain(join('src', 'modules', 'main-loop.ts'))
    // FastPriorityQueue.js IS bundled as of #75 (it was a third-party <script> fetch before), so it now
    // legitimately donates a writer. The corpus is derived from the build MANIFEST rather than hardcoded
    // precisely so this kind of change lands in ONE place — the previous hardcoded list asserted the
    // opposite and went stale the moment the file was vendored.
    expect(CORPUS).toContain(join('legacy', 'FastPriorityQueue.js'))

    // Pin one writer of each mechanism, so a regression in any single writer-detection arm shows up
    // HERE (as a precise failure) instead of downstream (as a flood of phantom "bugs").
    expect(WRITTEN.has('MODULES')).toBe(true) // `globalThis.MODULES = {}`  — main-loop.ts (former AutoTrimps2.js)
    expect(WRITTEN.has('Rshouldtributefarm')).toBe(true) // `globalThis.X = …`      — mapfunctions.ts:51
    expect(WRITTEN.has('safeBuyBuilding')).toBe(true) // `export function …`    — buildings.ts:49, kind-1 var
    expect(WRITTEN.has('MODULESdefault')).toBe(true) // written by main-loop.ts   — the exemplar's stated case

    // Pin the read arm too, including the typeof/bare split that the severity test depends on.
    // (This used to pin `storedMODULES` — the #71a bug. It is fixed and its decl is deleted, so the
    // anchor moved to a healthy bare-read name: Rshouldtributefarm, read at heirlooms.ts in both the
    // daily and non-daily swap blocks. The pin must be a name that is DECLARED, or it reads as false.)
    expect(BARE_READ.has('Rshouldtributefarm')).toBe(true)
    expect(TYPEOF_READ.has('isSteam')).toBe(true)
  })

  it('no ambient var is declared but never written', () => {
    const orphans = declared
      .filter((d) => !WRITTEN.has(d.name))
      .filter((d) => !(d.name in EXTERNALLY_PROVIDED))
      .filter((d) => !(d.name in KNOWN_UNWRITTEN))
      .map(
        (d) =>
          `${d.name} (${DTS}:${d.line}) — nothing in the shipped bundle assigns it. ` +
          `Read at ${[...reads, ...typeofReads]
            .filter((r) => r.name === d.name)
            .slice(0, 3)
            .map((r) => `${r.file}:${r.line}`)
            .join(', ') || '<nowhere — dead decl>'}`,
      )
    expect(orphans).toEqual([])
  })

  it('the known-unwritten baseline only shrinks — it is a fix queue, not an allowlist', () => {
    for (const name of Object.keys(KNOWN_UNWRITTEN)) {
      expect(WRITTEN.has(name), `${name} now HAS a writer — the bug is fixed; delete it from KNOWN_UNWRITTEN`).toBe(false)
      expect(DECLARED.has(name), `${name} is no longer declared in ${DTS} — delete it from KNOWN_UNWRITTEN`).toBe(true)
    }
    // Ratcheted 2 → 0 by the #71 fixes. The baseline is closed; it may never grow again.
    expect(Object.keys(KNOWN_UNWRITTEN).length).toBe(0)
  })

  it('every known-unwritten entry is a LIVE CRASH, not a benign undefined (severity pin)', () => {
    // The class only matters because these names are read BARE. A bare read of a never-created name is
    // a ReferenceError; `typeof x` of the same name is the string "undefined" and throws nothing. If a
    // future edit wraps one of these in a typeof guard, it stops being a crash — and this goes red so
    // the entry gets re-triaged rather than silently sitting in a "bugs" list as a non-bug.
    for (const name of Object.keys(KNOWN_UNWRITTEN))
      expect(BARE_READ.has(name), `${name} is no longer read bare — re-triage it, it may no longer throw`).toBe(true)
  })

  it('isSteam is safe ONLY because of its typeof guard — pin the guard (#71)', () => {
    // isSteam has no writer in the bundle and never will (its only writer was legacy/mods.js, the Steam
    // distribution shim, never in the MANIFEST and deleted outright in #134). It is not a bug purely because jobs.ts:566 reads it as
    // `typeof(isSteam) !== 'undefined'`. Strip that guard and it becomes bug number three, so assert the
    // guard rather than trusting a comment to preserve it.
    expect(WRITTEN.has('isSteam')).toBe(false)
    expect(TYPEOF_READ.has('isSteam')).toBe(true)
    expect(BARE_READ.has('isSteam'), 'isSteam is now read BARE — that is a ReferenceError in the web build').toBe(false)
  })

  it('every externally-provided entry is still unwritten and still read (no stale entries)', () => {
    // An allowlist that outlives its reason is how a net rots. If a name gains a real in-corpus writer,
    // or stops being read at all, the entry is stale and must go.
    for (const name of Object.keys(EXTERNALLY_PROVIDED)) {
      expect(WRITTEN.has(name), `${name} now has an in-corpus writer — delete it from EXTERNALLY_PROVIDED`).toBe(false)
      expect(
        BARE_READ.has(name) || TYPEOF_READ.has(name),
        `${name} is no longer read anywhere — delete it from EXTERNALLY_PROVIDED (and from ${DTS})`,
      ).toBe(true)
    }
    expect(Object.keys(EXTERNALLY_PROVIDED).length).toBeLessThanOrEqual(4)
  })
})
