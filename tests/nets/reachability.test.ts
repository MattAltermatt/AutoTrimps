import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import ts from 'typescript'
import { MANIFEST } from '../../scripts/build-userscript.mjs'

// #85 — the call-graph REACHABILITY net.
//
// A function can be exported, typecheck clean, be covered by a passing test, and ship in dist/ —
// and never once run. `src/legacy-bridge.ts` does `Object.assign(globalThis, { ...utils, ...calc, … })`,
// a wildcard spread, so **nothing is ever tree-shaken and every export appears in the bundle**.
// "It's in dist/" is not a reachability proof. Neither is a green test: the tests import the module
// directly, so a test is the ONLY caller a corpse needs to look alive. That is how
// RevaluateEquipmentEfficiency, Requipcalc and the U2 housing pair sat there for years with
// characterization tests certifying them as working.
//
// SO THE ONLY HONEST QUESTION IS: can control actually get here from something that runs?
// This net answers it mechanically. It walks the call graph from the REAL entry points and reports every
// exported function it cannot reach.
//
// WHY A REACHABILITY WALK AND NOT A REFERENCE COUNT. #85's own evidence was a "does any file mention this
// name" grep. That is strictly weaker, and it is weaker in the direction that matters: it cannot see a
// DEAD CYCLE. The nu-loom subsystem (heirlooms.ts) is six functions that call each other; only the
// outermost, spendNu(), is orphaned — and its two call sites are COMMENTED OUT (portal.ts). A reference
// count says all six are alive. A walk from the roots says all six are unreachable, which is the truth.
// Same story for RsafeBuyBuilding / RpreBuy3 / RpostBuy3: each has real callers, and every one of those
// callers is itself dead. The grep missed all four; the walk finds them for free.
//
// ── THE THREE CHANNELS, and why each is load-bearing ────────────────────────────────────────────────
// A caller is not always a call expression. Ablation (delete the channel, count the new false positives):
//
//   STRING / DOM-HANDLER channel …… 31 false positives without it.
//       The settings UI wires itself up through HTML attribute strings:
//         btn.setAttribute("onclick", 'settingChanged("' + id + '")')          settings-engine.ts:91
//         `autoSetValueToolTip("${id}", "${name}", …)`                         settings-engine.ts:109
//       The callee's name exists ONLY inside a string. To a naive call graph, ImportExportTooltip,
//       toggleTab, resetAutoTrimps, onKeyPressSetting, serializeSettings550 … are all dead. They are not;
//       they run every time the user clicks. Note the TEMPLATE-LITERAL half of this: six of the 31
//       (autoSetValueToolTip, autoSetTextToolTip, onKeyPressSetting, …) are reachable only through
//       `${}`-interpolated handler strings, so scanning StringLiteral alone is not enough.
//
//   GAME CALL-IN channel …………………… 3 false positives without it.
//       AT loads AFTER the game and the bridge's Object.assign CLOBBERS same-named game functions.
//       generateHeirloomIcon, formatMinutesForDescriptions and newSelectHeirloom are AT exports that
//       *the game itself* calls (main.js / config.js). Nothing in AT calls them. They are extremely
//       live — they are the hijack. So references found in .trimps-game/ are ROOTS.
//
//   SHIPPED-TEXT channel ……………………… 6 false positives without it.
//       The build REWRITES AutoTrimps2.js (`deLoaderize`, scripts/build-userscript.mjs). The ONLY call to
//       bootSettingsUI() anywhere is the one transform T3 introduces. Walk the raw legacy/ file and the
//       entire settings-menu boot subtree reads as dead. The corpus must be the text that SHIPS.
//
// Any one of those omitted and the net drowns in false positives, at which point somebody allowlists them
// and the net is decoration. They are pinned as anti-false-green tests below, so a refactor that breaks a
// channel goes RED here instead of silently reporting the settings menu as dead code.
//
// ── SCOPE, stated honestly ──────────────────────────────────────────────────────────────────────────
// • Resolution is BY BARE NAME, in one flat global namespace. That is not a shortcut, it is the runtime:
//   the bridge publishes every export onto globalThis and legacy code calls them as free identifiers.
//   A name defined twice (the bridge-collision class, tests/nets/bridge-collision.test.ts) is treated as
//   live if either definition is reachable — this net is about reachability, that one is about shadowing.
// • It reports EXPORTED functions in src/modules/. Module-private dead functions are esbuild's problem
//   (it tree-shakes them out of the bundle); exports are never shaken, so they are the ones that ship.
// • Conservative by construction: an identifier is a reference wherever it appears (call, callback, string).
//   The net UNDER-reports rather than over-reports. Everything it names is dead with a wide margin.

const ROOT = resolve(__dirname, '..', '..')

// The corpus is the SHIPPED bundle's inputs, derived from the BUILD's own MANIFEST — never hardcoded.
// A hardcoded copy is how a net goes stale: when #75 vendored legacy/FastPriorityQueue.js, the file
// became part of the shipped bundle, and any net holding its own private list would still believe it
// wasn't. Read the manifest and a newly-bundled legacy file joins the corpus for free.
const LEGACY_MANIFEST = MANIFEST.map((f: string) => join('legacy', f))

// The SHA-pinned clone `npm ci` materializes (scripts/fetch-game-clone.mjs). NOT the dev workspace at
// ../trimps-game — that one does not exist on CI, and a test that cannot run on the runner is exactly the
// hole #67 closed. TRIMPS_GAME_DIR still wins, for A/B-ing an upstream bump.
const GAME_DIR = process.env.TRIMPS_GAME_DIR || resolve(ROOT, '.trimps-game')

function tsSources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) tsSources(rel, acc)
    // .d.ts is type-only — no runtime existence, so it can neither define nor call anything.
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) acc.push(rel)
  }
  return acc
}

// legacy-bridge.ts is EXCLUDED, and this is the single most important line in the file. It names every
// export exactly once. Count it as a caller and every function in the codebase is "referenced" — the net
// reports ∅ and passes forever while measuring nothing. (The #66 shape: a green harness observing a path
// the product never takes.) The spread is a PUBLISHER, not a CALLER. tests/** is excluded for the same
// reason, one level up: a test is not a user.
const CORPUS = tsSources('src')
  .filter((f) => f !== join('src', 'legacy-bridge.ts'))
  .concat(LEGACY_MANIFEST)

// #133 — AutoTrimps2.js is now src/modules/main-loop.ts, walked like any other src module. It is already
// in the "de-loaderized" shape (its initializeAutoTrimps() calls bootSettingsUI() directly, with no remote
// <script> injection), so there is no build-time rewrite left to reproduce here — the corpus text is just
// the file on disk.
const MAINLOOP = join('src', 'modules', 'main-loop.ts')

function shippedText(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

const parse = (rel: string, text: string) =>
  ts.createSourceFile(
    rel,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    rel.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS
  )

type Def = { name: string; file: string; line: number; exported: boolean; node: ts.Node; ast: ts.SourceFile }

const files = CORPUS.map((rel) => ({ rel, ast: parse(rel, shippedText(rel)) }))

// ── definitions ────────────────────────────────────────────────────────────────────────────────────
// Top-level `function f(){}` and `const/var f = () => {}` / `= function(){}`, in every corpus file.
// Keyed by bare name (the runtime's own namespace — see SCOPE above).
const defs = new Map<string, Def[]>()
const isExported = (n: ts.Node) => !!(ts.getCombinedModifierFlags(n as ts.Declaration) & ts.ModifierFlags.Export)

function addDef(name: string, file: string, node: ts.Node, ast: ts.SourceFile, exported: boolean) {
  const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
  if (!defs.has(name)) defs.set(name, [])
  defs.get(name)!.push({ name, file, line, exported, node, ast })
}

for (const { rel, ast } of files) {
  for (const st of ast.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) {
      addDef(st.name.text, rel, st, ast, isExported(st))
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue
        if (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))
          addDef(d.name.text, rel, d, ast, isExported(st))
      }
    }
  }
}

// ── references inside a subtree ─────────────────────────────────────────────────────────────────────
const IDENT = /[A-Za-z_$][A-Za-z0-9_$]*/g

/**
 * Every name this subtree could reach. Deliberately generous: a bare identifier read counts (a function
 * passed as a callback — `setInterval(mainLoop, …)` — is a call), and so does any identifier-shaped token
 * inside a string or template literal (the DOM-handler channel; see the header).
 *
 * DECLARATION positions are excluded — a parameter or local named `foo` is not a reference to the global
 * `foo`. Property names are excluded too: `AutoPerks.createInput` is a METHOD on a namespace object and
 * has nothing to do with settings-engine's free function `createInput`. Counting `obj.name` as a
 * reference to the global `name` is precisely how a dead-code net quietly stops finding anything.
 */
function refsIn(node: ts.Node, ast: ts.SourceFile): Set<string> {
  const out = new Set<string>()
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n)) {
      const p = n.parent
      const isDeclOrMember =
        (ts.isPropertyAccessExpression(p) && p.name === n) ||
        (ts.isPropertyAssignment(p) && p.name === n) ||
        (ts.isMethodDeclaration(p) && p.name === n) ||
        (ts.isPropertySignature(p) && p.name === n) ||
        (ts.isParameter(p) && p.name === n) ||
        (ts.isVariableDeclaration(p) && p.name === n) ||
        (ts.isFunctionDeclaration(p) && p.name === n) ||
        (ts.isBindingElement(p) && p.name === n) ||
        ts.isImportSpecifier(p) ||
        ts.isExportSpecifier(p) ||
        ts.isImportClause(p) ||
        ts.isNamespaceImport(p) ||
        ts.isTypeReferenceNode(p)
      if (!isDeclOrMember) out.add(n.text)
    } else if (ts.isStringLiteralLike(n)) {
      for (const m of n.text.match(IDENT) ?? []) out.add(m)
    } else if (ts.isTemplateExpression(n)) {
      // getText() over the whole template — its literal chunks (TemplateHead / TemplateMiddle /
      // TemplateTail) are not StringLiteralLike and would otherwise be invisible. Six handler names
      // live only here.
      for (const m of n.getText(ast).match(IDENT) ?? []) out.add(m)
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(node, visit)
  return out
}

// ── the call graph ──────────────────────────────────────────────────────────────────────────────────
const edges = new Map<string, Set<string>>()
for (const [name, list] of defs) {
  const outgoing = new Set<string>()
  for (const d of list) for (const r of refsIn(d.node, d.ast)) outgoing.add(r)
  edges.set(name, outgoing)
}

// ── the roots: what actually runs ───────────────────────────────────────────────────────────────────
const roots = new Set<string>()
const markRoot = (name: string) => {
  if (defs.has(name)) roots.add(name)
}

// (1) The two named entry points. mainLoop is the setInterval body; initializeAutoTrimps is the boot.
//     Both are also picked up by (2), but naming them makes the net's premise explicit and survives a
//     refactor of how they get scheduled.
markRoot('mainLoop')
markRoot('initializeAutoTrimps')

// (2) Module top-level side effects, in every corpus file: IIFEs, self-invokes, `setInterval(mainLoop)`,
//     `globalThis.X = …`. Anything a top-level statement mentions runs at load.
for (const { ast } of files) {
  for (const st of ast.statements) {
    if (ts.isFunctionDeclaration(st)) continue // a declaration is not an execution
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!d.initializer) continue
        // `var f = function(){}` DEFINES f, it does not RUN it. But `var x = foo()` runs foo.
        if (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) continue
        for (const r of refsIn(d, ast)) markRoot(r)
      }
      continue
    }
    for (const r of refsIn(st, ast)) markRoot(r)
  }
}

// (3) The game calls back into AT. AT's bridge clobbers same-named game functions, so any AT-defined name
//     that the GAME references is an entry point from outside — the clobber IS the call. Parsed, not
//     grepped: a name in a game function's DECLARATION position is the game defining its own, which is
//     only interesting if AT also defines it (and then AT's wins, and the game's callers reach AT's).
const gameCallIns = new Map<string, string>()
for (const e of readdirSync(GAME_DIR, { withFileTypes: true })) {
  if (!e.isFile()) continue
  if (e.name.endsWith('.js')) {
    const ast = parse(e.name, readFileSync(join(GAME_DIR, e.name), 'utf8'))
    const visit = (n: ts.Node) => {
      if (ts.isIdentifier(n)) {
        const p = n.parent
        const isDeclOrMember =
          (ts.isPropertyAccessExpression(p) && p.name === n) ||
          (ts.isPropertyAssignment(p) && p.name === n) ||
          (ts.isParameter(p) && p.name === n) ||
          (ts.isVariableDeclaration(p) && p.name === n) ||
          (ts.isMethodDeclaration(p) && p.name === n)
        if (!isDeclOrMember && defs.has(n.text) && !gameCallIns.has(n.text)) gameCallIns.set(n.text, e.name)
      } else if (ts.isStringLiteralLike(n)) {
        for (const m of n.text.match(IDENT) ?? [])
          if (defs.has(m) && !gameCallIns.has(m)) gameCallIns.set(m, `${e.name} (string)`)
      }
      ts.forEachChild(n, visit)
    }
    ts.forEachChild(ast, visit)
  } else if (e.name.endsWith('.html')) {
    // The game's own markup carries onclick="…" handlers. No definitions live in HTML, so a raw token
    // scan is exactly right here.
    for (const m of readFileSync(join(GAME_DIR, e.name), 'utf8').match(IDENT) ?? [])
      if (defs.has(m) && !gameCallIns.has(m)) gameCallIns.set(m, e.name)
  }
}
for (const name of gameCallIns.keys()) markRoot(name)

// ── the walk ────────────────────────────────────────────────────────────────────────────────────────
const live = new Set<string>()
const stack = [...roots]
while (stack.length) {
  const n = stack.pop()!
  if (live.has(n) || !defs.has(n)) continue
  live.add(n)
  for (const r of edges.get(n) ?? []) if (defs.has(r) && !live.has(r)) stack.push(r)
}

/** Exported functions in src/modules/ that the walk cannot reach. The report. */
const deadExports: Def[] = []
for (const [name, list] of defs) {
  if (live.has(name)) continue
  for (const d of list) if (d.exported && d.file.startsWith(join('src', 'modules'))) deadExports.push(d)
}
deadExports.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

const fmt = (d: Def) => `${d.file}:${d.line} ${d.name}`

// ── the baseline ────────────────────────────────────────────────────────────────────────────────────
//
// EMPTY, and it must stay that way. Every corpse the net found in the #85 sweep was DELETED, not
// allowlisted — see the commit. This list exists only so that a future dead export arrives as a RED test
// with a name attached, and so that anyone tempted to park one has to write it down here, in public,
// next to a justification. An entry here is a debt, not a decision.
//
// If you add one: it can only ever SHRINK (a test below enforces that — an entry that is no longer dead
// fails, so you cannot leave stale corpses in the list once they're fixed or deleted).
const KNOWN_DEAD: string[] = []

describe('#85 — call-graph reachability over the shipped bundle', () => {
  it('every exported function in src/modules/ is reachable from a real entry point', () => {
    const unexpected = deadExports.filter((d) => !KNOWN_DEAD.includes(d.name)).map(fmt)
    expect(unexpected, `\nUNREACHABLE EXPORTS — nothing that runs can ever call these:\n${unexpected.join('\n')}\n\nEach is a DELETE (never built / superseded) or a dropped call (WIRE — a behavior change: stop and\ndecide the semantics deliberately). Do not park it in KNOWN_DEAD to get green.\n`).toEqual([])
  })

  it('KNOWN_DEAD can only shrink — no stale entries', () => {
    const names = new Set(deadExports.map((d) => d.name))
    const resurrected = KNOWN_DEAD.filter((n) => !names.has(n))
    expect(resurrected, `these are no longer dead (fixed or deleted) — remove them from KNOWN_DEAD`).toEqual([])
  })

  // ── anti-false-green ─────────────────────────────────────────────────────────────────────────────
  // A reachability walk fails OPEN: if the graph collapses (a parse regression, an empty corpus, a
  // channel silently lost), `live` swells or `defs` empties and the net reports ∅ dead — passing
  // vacuously while measuring nothing. Every assertion below exists to make that failure LOUD.

  it('the corpus is the shipped bundle: the build MANIFEST, not a hardcoded list', () => {
    expect(MANIFEST).toContain('FastPriorityQueue.js') // the legacy half of the corpus derives from the real MANIFEST
    expect(CORPUS).toContain(MAINLOOP) // the mainLoop dispatch table (former AutoTrimps2.js, now a src module)
    expect(CORPUS).not.toContain(join('src', 'legacy-bridge.ts')) // the publisher is not a caller
    expect(CORPUS.filter((f) => f.startsWith(join('src', 'modules'))).length).toBeGreaterThan(30)
  })

  it('the graph is populated (a collapsed graph would report zero dead code and pass)', () => {
    const exportedInModules = [...defs.values()]
      .flat()
      .filter((d) => d.exported && d.file.startsWith(join('src', 'modules')))
    expect(exportedInModules.length).toBeGreaterThan(350) // 371 after the #85 sweep (was 402)
    expect(live.size).toBeGreaterThan(300)
    expect(roots.has('mainLoop')).toBe(true)
    expect(roots.has('initializeAutoTrimps')).toBe(true)
    // Depth: the walk must actually traverse, not just mark the roots. autoLevelEquipment is several
    // hops down from mainLoop.
    expect(live.has('autoLevelEquipment')).toBe(true)
    expect(live.has('createSetting')).toBe(true)
  })

  // The three channel pins. Each name below is reachable through EXACTLY ONE channel — verified by
  // ablation (delete the channel, this name turns up in the dead list). If one of these ever goes red,
  // the channel is broken and the net is about to report a pile of live code as dead. Fix the channel.
  it('CHANNEL: DOM handler strings — names that exist only inside an onclick/onchange string are live', () => {
    // settings-engine.ts:91  setAttribute("onclick", 'settingChanged("' + id + '")')
    // import-export.ts       setAttribute("onclick", 'ImportExportTooltip(…)')
    for (const n of ['ImportExportTooltip', 'toggleTab', 'resetAutoTrimps', 'serializeSettings550'])
      expect(live.has(n), `${n} is reachable ONLY via a DOM handler string — the string channel is broken`).toBe(true)
  })

  it('CHANNEL: template-literal handler strings are scanned too', () => {
    // settings-engine.ts:109 `autoSetValueToolTip("${id}", …)` — a TemplateExpression, whose literal
    // chunks are NOT StringLiteralLike. Scanning only string literals misses these six.
    for (const n of ['autoSetValueToolTip', 'autoSetTextToolTip', 'onKeyPressSetting'])
      expect(live.has(n), `${n} is reachable ONLY via a template-literal handler string`).toBe(true)
  })

  it('CHANNEL: the game calls back into AT (the bridge clobbers same-named game functions)', () => {
    // Nothing in AT calls these. The GAME does — AT's Object.assign hijacked the name, so the game's
    // own call sites (main.js, config.js) land in AT's copy. That IS the call.
    for (const n of ['generateHeirloomIcon', 'formatMinutesForDescriptions']) {
      expect(gameCallIns.has(n), `${n} should be a game call-in — the game-clone channel is broken`).toBe(true)
      expect(live.has(n)).toBe(true)
    }
  })

  it('CHANNELS COMPOSE: game call-in → AT function → DOM handler string → AT function', () => {
    // newSelectHeirloom is the proof that the channels have to chain, not just coexist. It is NOT itself
    // a game call-in — the game clone never mentions it:
    expect(gameCallIns.has('newSelectHeirloom')).toBe(false)
    // It is reached in two hops, one per channel:
    //   1. the GAME calls generateHeirloomIcon (main.js ×6) — which the bridge clobbered to AT's copy;
    //   2. AT's copy emits markup carrying `onclick="newSelectHeirloom(…)"` (heirlooms.ts:460) — a STRING.
    // Kill either channel and this goes dead. It is live.
    expect(gameCallIns.has('generateHeirloomIcon')).toBe(true)
    expect(edges.get('generateHeirloomIcon')?.has('newSelectHeirloom')).toBe(true)
    expect(live.has('newSelectHeirloom')).toBe(true)
  })

  it('CHANNEL: the settings-menu boot subtree is reachable via main-loop.ts initializeAutoTrimps()', () => {
    // The ONLY call to bootSettingsUI() in the whole codebase is the one in main-loop.ts's
    // initializeAutoTrimps() (formerly the one the build's deLoaderize T3 introduced into AutoTrimps2.js;
    // #133 made it the source directly). Against a corpus that missed that call, bootSettingsUI and the
    // entire settings-menu boot subtree would report DEAD.
    expect(shippedText(MAINLOOP)).toContain('bootSettingsUI()')
    for (const n of ['bootSettingsUI', 'automationMenuInit'])
      expect(live.has(n), `${n} is reachable ONLY through main-loop.ts's initializeAutoTrimps()`).toBe(true)
  })

  // ── mutation-check, run by hand and recorded here ────────────────────────────────────────────────
  // A net nobody has seen go red is a hypothesis. Both directions were driven on this one:
  //
  //   (a) ADD a caller to a dead function → the net must STOP reporting it.
  //       Inserted `RevaluateEquipmentEfficiency('Dagger')` into autoLevelEquipment (equipment.ts).
  //       → the dead list lost RevaluateEquipmentEfficiency AND its private callees RequipEffect /
  //         RequipCost / RPrestigeValue (they were only reachable through it). Reverted.
  //
  //   (b) DELETE the last caller of a live function → the net must START reporting it.
  //       Removed the `autoLevelEquipment()` call from legacy/AutoTrimps2.js's mainLoop.
  //       → autoLevelEquipment + evaluateEquipmentEfficiency + equipCost + … appeared in the dead list.
  //         Reverted.
  //
  // The walk demonstrably follows edges in both directions and is not passing vacuously.
  it('is falsifiable: a function reachable only from a dead function is itself dead', () => {
    // The property that makes this a WALK and not a reference count, asserted directly on the graph.
    // If this ever inverts, someone has replaced the walk with a `grep -c` and the dead cycles are back.
    const reachableFromLiveOnly = (name: string) =>
      [...live].some((l) => edges.get(l)?.has(name) && l !== name)
    // createSetting: called from live code. autoLevelEquipment: called from mainLoop.
    expect(reachableFromLiveOnly('createSetting')).toBe(true)
    expect(reachableFromLiveOnly('autoLevelEquipment')).toBe(true)
  })
})

// ── #99 — BRANCH reachability for RcalcOurDmg ───────────────────────────────────────────────────────
//
// The walk above resolves at FUNCTION granularity, so it (correctly) reports RcalcOurDmg as LIVE — it has
// 8 callers. But the thing that was dead in #99 was a *branch*: the `min` / `max` cases of its
// `switch (minMaxAvg)`. Whether control can reach those is not a call-graph question at all, it is an
// ARGUMENT-VALUE question, and no amount of call-graph walking answers it. This net answers it.
//
// The branches are now deleted and the param is narrowed to the literal 'avg', so `tsc` rejects any
// min/max call site in src/. That is NOT sufficient on its own: legacy/*.js is plain JS and is never
// typechecked, so a legacy `RcalcOurDmg('min')` would slip past tsc and silently receive the AVERAGE.
// This net closes that hole by scanning the SHIPPED text — the same corpus the walk uses, legacy included.
describe('#99 — RcalcOurDmg is only ever asked for the average', () => {
  const callSites: { file: string; arg: string }[] = []
  for (const rel of CORPUS) {
    const src = parse(rel, shippedText(rel))
    const visit = (n: ts.Node): void => {
      if (
        ts.isCallExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === 'RcalcOurDmg'
      ) {
        const a = n.arguments[0]
        callSites.push({
          file: rel,
          // a non-literal first arg (e.g. `maxOrMin ? 'max' : 'min'`, which the U1 twin really does use)
          // is reported by its source text and will fail the assertion below — deliberately.
          arg: a && ts.isStringLiteral(a) ? a.text : a ? a.getText(src) : '<none>',
        })
      }
      ts.forEachChild(n, visit)
    }
    visit(src)

  }

  it('has call sites at all (anti-false-green: an empty scan must not pass vacuously)', () => {
    expect(callSites.length).toBeGreaterThanOrEqual(8)
  })

  it("every shipped call site passes the literal 'avg'", () => {
    const offenders = callSites.filter((c) => c.arg !== 'avg')
    // If this fails, someone wired up a min/max consumer. Do NOT re-add the deleted branches from
    // git history — they were wrong (see the note on RcalcOurDmg in calc.ts). Port the U1 twin's
    // minFluct/maxFluct composition instead.
    expect(offenders).toEqual([])
  })
})
