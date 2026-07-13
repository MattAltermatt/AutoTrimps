import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import ts from 'typescript'
import { MANIFEST } from '../../scripts/build-userscript.mjs'

// #73 — the DOM-id resolution net.
//
// The fork reaches into the game's DOM by id string. A TYPO resolves to nothing, and it does so
// SILENTLY: `src/modules/utils.ts:181` declares `byId<T>(id: string): T` — the return type is `T`,
// never `T | null`, so the `null` is cast away and `tsc` is blind by construction. Where the call
// site then guards defensively (`const m = byId(...); if (!m) return;`) the typo becomes a permanent
// no-op that reads like working, defensive code.
//
// The bug this net exists for (maps.ts:144):
//   byId<HTMLSelectElement>("advExtraMapLevelselect")   ← THAT ELEMENT DOES NOT EXIST.
// The game's id is `advExtraLevelSelect` (no `Map`, capital `S`), and every OTHER site in the fork
// spells it correctly (~17 of them, mapfunctions.ts / other-praiding.ts). maps.ts is the lone
// outlier, so the extra-zones half of AdvMapSpecialModifier — a DEFAULT-ON setting — has never run
// for anybody. One character, eight years, zero symptoms.
//
// SCOPE, stated honestly. This net resolves STRING-LITERAL ids only. ~90 call sites build the id by
// concatenation (`byId('windowZone' + x)`, MAZ.ts) and are structurally out of reach of a static
// check; a prefix-oracle for those is a different net. What is in reach is netted exhaustively.

const ROOT = resolve(__dirname, '..', '..')

// The corpus is the SHIPPED bundle's inputs. scripts/build-userscript.mjs's MANIFEST bundles exactly
// two legacy files; legacy/GraphsOnly.js and legacy/FastPriorityQueue.js are NOT bundled, and a
// lookup that only "resolves" in an unshipped file resolves to nothing at runtime. A test below pins
// this list against the real MANIFEST so a future bundle change cannot silently widen the corpus.
// Derived from the BUILD's own MANIFEST, never hardcoded. A hardcoded copy is how this net went stale
// when #75 vendored legacy/FastPriorityQueue.js: the file became part of the shipped bundle, but the net
// still believed it wasn't — so it kept treating FastPriorityQueue as externally-provided. Read the
// manifest and a newly-bundled legacy file joins every net's corpus for free, with nothing to remember.
const LEGACY_MANIFEST = MANIFEST.map((f: string) => join('legacy', f))

// The SHA-pinned clone `npm ci` materializes (scripts/fetch-game-clone.mjs). NOT the dev workspace at
// ../trimps-game — that one does not exist on CI, and a test that cannot run on the runner is exactly
// the hole #67 closed. TRIMPS_GAME_DIR still wins, for A/B-ing an upstream bump.
const GAME_DIR = process.env.TRIMPS_GAME_DIR || resolve(ROOT, '.trimps-game')

function tsSources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) tsSources(rel, acc)
    // .d.ts is type-only — no runtime existence, so it can neither look an element up nor create one.
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) acc.push(rel)
  }
  return acc
}

const CORPUS = tsSources('src').concat(LEGACY_MANIFEST)
const sourceOf = (rel: string) =>
  ts.createSourceFile(
    rel,
    readFileSync(join(ROOT, rel), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    rel.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  )

// ---------------------------------------------------------------------------------------------
// 1. every DOM-id LOOKUP in the shipped fork
// ---------------------------------------------------------------------------------------------

type Lookup = { id: string; file: string; line: number }

/** AST, not regex: `byId("x")`, `byId<HTMLSelectElement>("x")`, `document.getElementById("x")`. */
function collectLookups(): { literal: Lookup[]; dynamic: number } {
  const literal: Lookup[] = []
  let dynamic = 0
  for (const rel of CORPUS) {
    const sf = sourceOf(rel)
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression
        const isLookup =
          (ts.isIdentifier(callee) && callee.text === 'byId') ||
          (ts.isPropertyAccessExpression(callee) && callee.name.text === 'getElementById')
        if (isLookup) {
          const arg = node.arguments[0]
          // A NoSubstitutionTemplateLiteral is a literal; a template WITH substitutions is not.
          if (arg && ts.isStringLiteralLike(arg))
            literal.push({
              id: arg.text,
              file: rel,
              line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            })
          else dynamic++
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  return { literal, dynamic }
}

const { literal: LOOKUPS, dynamic: DYNAMIC_LOOKUPS } = collectLookups()

// ---------------------------------------------------------------------------------------------
// 2. the ids that actually EXIST — three sources, each derived, none guessed
// ---------------------------------------------------------------------------------------------

/** Every `createSetting('<id>', …)` in the define-pass; settings-engine.ts renders each as an element id. */
function callArgs(rel: string, fn: string): string[] {
  const sf = sourceOf(rel)
  const out: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === fn) {
      const arg = node.arguments[0]
      if (arg && ts.isStringLiteralLike(arg)) out.push(arg.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

const SETTING_IDS = callArgs('src/modules/settings-defs.ts', 'createSetting')
// settings-engine.ts:159 — `dropdownLabel.id = id + "Label"`.
const SETTING_LABEL_IDS = SETTING_IDS.map((id) => id + 'Label')
// settings-menu.ts:117/122 — createTabs(name) mints the `tab<name>` <li> AND the `<name>` tabcontent div.
const TAB_NAMES = callArgs('src/modules/settings-menu.ts', 'createTabs')
const TAB_IDS = TAB_NAMES.flatMap((n) => ['tab' + n, n])

/**
 * The GAME's ids, read from the pinned clone.
 *
 * DELIBERATELY NOT "every identifier token in the corpus" — that is what issue #73 proposes, and it is
 * over-broad in exactly the direction that kills a net: the game's ~17k source tokens include every
 * variable, function and property name, so any typo that happens to collide with one of them gets
 * excused. Measured, that loose scan wrongly resolves 3 of the fork's ids (`Core`, `Display`,
 * `Prestige` — all AT-owned, none game elements). Extracting only real id-BEARING sites yields 1078
 * ids and — measured — leaves the unresolved set byte-identical. Strictly tighter, zero cost.
 */
function gameIds(): Set<string> {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git') continue
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.html') || e.name.endsWith('.js')) files.push(p)
    }
  }
  walk(GAME_DIR)
  const text = files.map((f) => readFileSync(f, 'utf8')).join('\n')
  const ids = new Set<string>()
  // `id="x"` in markup, and the same inside the HTML the game's JS builds as strings (incl. \" escapes).
  for (const m of text.matchAll(/\bid\s*=\s*\\?["']([^"'\\]+)/g)) ids.add(m[1])
  for (const m of text.matchAll(/\.id\s*=\s*["'`]([^"'`]+)/g)) ids.add(m[1])
  for (const m of text.matchAll(/getElementById\(\s*["'`]([^"'`]+)/g)) ids.add(m[1])
  for (const m of text.matchAll(/querySelector\w*\(\s*["'`]#([\w-]+)/g)) ids.add(m[1])
  return ids
}

const GAME_IDS = gameIds()

/**
 * AT's OWN dynamically-created elements. EXPLICIT and hand-audited — never regex-inferred over the AT
 * source, because "this id appears in an id= somewhere in our code" is a rule the bug itself could
 * satisfy the day someone adds a typo'd id to a template. Every entry below was audited by locating
 * its creation site; the creation sites are asserted mechanically in the test at the bottom, so an
 * entry cannot be added here to silence a red unless the element is genuinely created.
 */
const AT_CREATED: Record<string, string> = {
  // settings-menu.ts — the AT settings panel chrome.
  autoSettings: 'settings-menu.ts:110 — b.id = "autoSettings"',
  autoTrimpsTabBarMenu: 'settings-menu.ts:151 — addtabsUL.id',
  autoMapBtn: 'settings-menu.ts:35 — newContainer.setAttribute("id", "autoMapBtn")',
  autoMapStatus: 'settings-menu.ts:57 — abutton.id',
  hiderStatus: 'settings-menu.ts:69 — abutton.id',
  // settings-engine.ts / import-export.ts — tooltip-injected form controls.
  customTextBox: 'settings-engine.ts:298 — <input id="customTextBox"> in the tooltip HTML',
  setSettingsNameTooltip: "import-export.ts:869 — <textarea id='setSettingsNameTooltip'>",
  // perks.ts — the AutoPerks ratio/dump-perk chrome (U1 + U2 radon twins).
  ratioPreset: 'perks.ts:124 — apGUI.$ratioPreset.id',
  RratioPreset: 'perks.ts:854 — apGUI.$RratioPreset.id',
  dumpPerk: 'perks.ts:111 — apGUI.$dumpperk.id',
  RdumpPerk: 'perks.ts:841 — apGUI.$dumpperk.id (radon GUI)',
  // heirlooms.ts:16 — three Protect/Unprotect buttons appended to the game's heirloom btn groups.
  protectHeirloomBTN1: 'heirlooms.ts:16 — hrlmProtBtn1.id',
  protectHeirloomBTN2: 'heirlooms.ts:16 — hrlmProtBtn2.id',
  protectHeirloomBTN3: 'heirlooms.ts:16 — hrlmProtBtn3.id',
  // MAZ.ts — the Map-At-Zone editor, rendered into a tooltip.
  windowError: "MAZ.ts:117 — <div id='windowError'>",
  windowAddRowBtn: "MAZ.ts:284 — <div id='windowAddRowBtn'>",
  // legacy/Graphs.js — the graphs panel (shipped: it is in the build MANIFEST).
  graphParent: 'Graphs.js:189 — <div id="graphParent">',
  graphFooterLine1: 'Graphs.js:192',
  graphFooterLine2: 'Graphs.js:193',
  clrChkbox: 'Graphs.js:224 — <input id="clrChkbox">',
  clrAllDataBtn: 'Graphs.js:226 — <button id="clrAllDataBtn">',
  deleteSpecificTextBox: 'Graphs.js:229',
  blackCB: 'Graphs.js:244 — <input id="blackCB"> (dark-theme toggle)',
  'dark-graph.css': 'Graphs.js:304 — b.id = "dark-graph.css" (a <link> AT appends to <head>)',
}

const RESOLVED = new Set<string>([
  ...GAME_IDS,
  ...SETTING_IDS,
  ...SETTING_LABEL_IDS,
  ...TAB_IDS,
  ...Object.keys(AT_CREATED),
])

// ---------------------------------------------------------------------------------------------
// 3. the shrinking baseline — ids that resolve to NOTHING today
// ---------------------------------------------------------------------------------------------

/**
 * Every entry is a confirmed dead lookup, not an excuse. It exists so the net is GREEN on main today
 * while the fixes land one at a time behind it, and it may only ever get SMALLER (guard test below).
 * A NEW dead id fails on arrival — which is the entire point.
 */
const KNOWN_DEAD: Record<string, string> = {
  // ✅ advExtraMapLevelselect — FIXED (#73). maps.ts now looks up the real game id `advExtraLevelSelect`.
  // The net went red the moment the typo resolved and would not go green again until this entry was
  // deleted. That is the design: the baseline is a fix queue, never an allowlist.
  // ✅ RPrestige — FIXED (#85), by DELETION. This entry used to read "dead-but-harmless … inside
  // RprestigeChanging2(), which has ZERO callers". A dead lookup inside a dead function is not a thing to
  // allowlist, it is a thing to remove: #85's reachability net proved RprestigeChanging2 unreachable and
  // the function is gone, so the lookup is gone with it. Note what the old entry conceded and then filed
  // anyway — "ZERO callers" was written down here, in this repo, and nothing acted on it for a year. The
  // net now fails on that fact instead of recording it.
  ATModuleListDropdown:
    '#73 dead-but-harmless — import-export.ts:281,:293. Reachable only from tooltip branches that ' +
    'nothing calls.',
  'AutoTrimps-script':
    '#73 dead-but-harmless — AutoTrimps2.js:2. A <script id="AutoTrimps-script"> tag that no ' +
    'loader emits; the result feeds an optional `basepath` sniff.',
}

// ---------------------------------------------------------------------------------------------

describe('DOM-id lookups must resolve to an element that exists (#73)', () => {
  it('parses a real corpus (anti-false-green: an empty scan passes everything vacuously)', () => {
    // This is the #66 failure mode, pinned shut. If the AST walk or any id source silently stops
    // matching, the sets collapse and every assertion below passes while proving nothing.
    expect(CORPUS.length).toBeGreaterThan(30)
    expect(LOOKUPS.length).toBeGreaterThan(500)
    expect(new Set(LOOKUPS.map((l) => l.id)).size).toBeGreaterThan(150)
    expect(DYNAMIC_LOOKUPS).toBeGreaterThan(50) // the concatenated ids this net cannot resolve
    expect(SETTING_IDS.length).toBeGreaterThan(500) // ~571 today
    expect(TAB_NAMES.length).toBeGreaterThan(15) // 21 today
    expect(GAME_IDS.size).toBeGreaterThan(800) // ~1078 in the pinned clone
    // Pin one id per source, so a regression in ANY of the four resolvers fails HERE — loudly — rather
    // than by quietly re-classifying two dozen live ids as dead (or, worse, dead ids as live).
    expect(GAME_IDS.has('advExtraLevelSelect')).toBe(true) // game — and the id maps.ts:144 SHOULD use
    expect(SETTING_IDS).toContain('AdvMapSpecialModifier') // AT setting
    expect(SETTING_LABEL_IDS).toContain('AdvMapSpecialModifierLabel') // derived label sibling
    expect(TAB_IDS).toContain('tabScryer') // AT tab <li>
    expect(TAB_IDS).toContain('Import Export') // AT tabcontent <div> — note the space
    // And the lookups themselves. This pins a CORRECTLY-spelled sibling of the bug, on purpose: it
    // survives the #73 fix, so fixing #73 edits exactly one place (KNOWN_DEAD). That the scan sees the
    // buggy maps.ts:144 lookup is already proven — the KNOWN_DEAD guard below asserts every baselined
    // id is still looked up somewhere, and goes red the moment it is not.
    expect(LOOKUPS).toContainEqual({ id: 'advExtraLevelSelect', file: 'src/modules/mapfunctions.ts', line: 271 })
    expect(LOOKUPS.some((l) => l.file === 'legacy/Graphs.js')).toBe(true) // the legacy half is scanned
  })

  it('the legacy corpus matches the build MANIFEST (an unshipped file must not resolve anything)', () => {
    // Resolving an id in a file the bundle never ships is a false pass. Pin the corpus to the bundler.
    const sf = sourceOf('scripts/build-userscript.mjs')
    let manifest: string[] = []
    const visit = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === 'MANIFEST' &&
        node.initializer &&
        ts.isArrayLiteralExpression(node.initializer)
      )
        manifest = node.initializer.elements.filter(ts.isStringLiteralLike).map((e) => e.text)
      ts.forEachChild(node, visit)
    }
    visit(sf)
    expect(manifest.map((f) => 'legacy/' + f)).toEqual(LEGACY_MANIFEST)
  })

  it('no id lookup resolves to a nonexistent element', () => {
    const dead = new Map<string, string[]>()
    for (const l of LOOKUPS) {
      if (RESOLVED.has(l.id) || l.id in KNOWN_DEAD) continue
      if (!dead.has(l.id)) dead.set(l.id, [])
      dead.get(l.id)!.push(`${l.file}:${l.line}`)
    }
    const report = [...dead.entries()].map(([id, sites]) => `${id} | ${sites.join(', ')}`)
    expect(report).toEqual([])
  })

  it('the known-dead baseline only shrinks — it is a fix queue, not an allowlist', () => {
    for (const id of Object.keys(KNOWN_DEAD)) {
      expect(
        RESOLVED.has(id),
        `${id} now RESOLVES — delete it from KNOWN_DEAD (and never park it in AT_CREATED)`,
      ).toBe(false)
      expect(
        LOOKUPS.some((l) => l.id === id),
        `${id} is no longer looked up anywhere — delete it from KNOWN_DEAD`,
      ).toBe(true)
    }
    // Ratcheted 4 → 3 by the #73 fix. Only ever tighten.
    expect(Object.keys(KNOWN_DEAD).length).toBeLessThanOrEqual(3)
  })

  it('every AT_CREATED entry has a real creation site in the shipped fork', () => {
    // The allowlist is the one place a typo could hide: park the bad id here and the red goes away.
    // So the allowlist must PROVE itself. An id qualifies only if the fork actually mints an element
    // with it — `x.id = "…"`, `setAttribute("id","…")`, or `id="…"` inside HTML the fork builds.
    // All four KNOWN_DEAD ids fail this check (verified), which is exactly why they are dead.
    const at = CORPUS.map((rel) => readFileSync(join(ROOT, rel), 'utf8')).join('\n')
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const creates = (id: string) =>
      new RegExp(
        `\\.id\\s*=\\s*['"\`]${esc(id)}['"\`]` +
          `|setAttribute\\(\\s*['"\`]id['"\`]\\s*,\\s*['"\`]${esc(id)}['"\`]` +
          `|\\bid\\s*=\\s*\\\\?['"]${esc(id)}['"\\\\]`,
      ).test(at)

    expect(Object.keys(AT_CREATED).filter((id) => !creates(id))).toEqual([])
    // Anti-false-green for the regex itself: if `creates` degenerated to always-true, the four dead
    // ids would pass it too — and the allowlist would stop being a proof of anything.
    expect(Object.keys(KNOWN_DEAD).filter(creates)).toEqual([])
    // And every allowlisted id must still be LOOKED UP; a stale entry is silent scope creep.
    const looked = new Set(LOOKUPS.map((l) => l.id))
    expect(Object.keys(AT_CREATED).filter((id) => !looked.has(id))).toEqual([])
  })
})
