import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import ts from 'typescript'
import { MANIFEST } from '../../scripts/build-userscript.mjs'

// #68 / #69 / #74 — the REVERSE settings nets.
//
// tests/settings-wired.test.ts owns the FORWARD direction (#65): "every createSetting id is read
// somewhere". This file owns the three directions it does not:
//
//   A (#68)  every id the code READS must have been createSetting'd.
//   B (#69)  no boolean setting may be declared with a STRING default.
//   C (#74)  a test may only seed setting ids that production actually defines.
//
// Why A matters. getPageSetting (src/modules/utils.ts) returns the literal `false` for an id that was
// never createSetting'd — no throw, no warning, no typecheck complaint. So a phantom read degrades
// silently into a comparison against 0:
//     game.equipment.Shield.level < getPageSetting('RCapEquiparm')   →   level < false   →   level < 0
// which is never true, so RbuyArms() buys nothing, forever. That is a live HIGH bug (#68), and 28 more
// like it survived a 45-agent code review because the net only ever ran in the other direction.
//
// Why B matters. `createSetting(id, name, desc, 'boolean', 'false', …)` stores the STRING 'false'. It is
// truthy. And because JS `==` never coerces a string to a boolean, `'false' == true` is ALSO false and
// `'false' == false` is ALSO false. So the setting's effective value depends on how each individual
// reader happens to test it — `if (x)` sees ON, `if (x == true)` sees OFF. Same setting, both answers.
//
// Why C matters. tests/equipment.characterization.test.ts hand-builds an autoTrimpSettings literal
// containing `loomswap` / `dloomswap` — ids with ZERO createSetting calls anywhere — and then asserts the
// branch behind them "works". Production can never reach that branch. A green test over a dead branch is
// the #66 failure mode: a harness that seeds state production cannot produce is not measuring production.
//
// ⚠️ DO NOT "FIX" A PHANTOM BY DEFINING IT. `MaxTox`'s phantom is ACCIDENTALLY PROTECTIVE: portal.ts:74
// reads it and, if truthy, calls settingChanged("MaxTox") on a control that does not exist — which throws
// inside the portal path. Each phantom needs its own disposition. This file is a NET, not a fix.

const ROOT = resolve(__dirname, '..', '..')

// The corpus is the SHIPPED bundle's inputs (scripts/build-userscript.mjs MANIFEST), not the whole tree.
// legacy/GraphsOnly.js and legacy/FastPriorityQueue.js are NOT bundled; counting them would launder a bug.
// Derived from the BUILD's own MANIFEST, never hardcoded. A hardcoded copy is how this net went stale
// when #75 vendored legacy/FastPriorityQueue.js: the file became part of the shipped bundle, but the net
// still believed it wasn't — so it kept treating FastPriorityQueue as externally-provided. Read the
// manifest and a newly-bundled legacy file joins every net's corpus for free, with nothing to remember.
const LEGACY_MANIFEST = MANIFEST.map((f: string) => join('legacy', f))

function tsSources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) tsSources(rel, acc)
    // .d.ts is type-only — no runtime existence, so it can neither define nor read a setting.
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

const SRC_CORPUS = tsSources('src').concat(LEGACY_MANIFEST)

type Site = { id: string; file: string; line: number; via: string }
type Decl = { id: string; file: string; line: number; type: string; defaultKind: ts.SyntaxKind; defaultText: string }

const declared: Decl[] = []
/** Every id the code REFERENCES as a string literal — the union of all four reference idioms below. */
const refs: Site[] = []
/** A getPageSetting call whose id argument is an expression, keyed by its normalized source text. */
const dynamicSites: { expr: string; file: string; line: number; root: string | null }[] = []
/** String literals reachable as the value of a variable used as a dynamic id argument. */
const indirect: Site[] = []

/** Walk `shrineSettings[universe][mode].core` / `praidSetting` down to the identifier it is rooted at. */
function rootIdentifier(node: ts.Expression): string | null {
  let n: ts.Node = node
  while (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) n = n.expression
  return ts.isIdentifier(n) ? n.text : null
}

/**
 * Every string literal anywhere inside an expression (used to resolve object-literal id tables).
 *
 * ⚠️ The braces on the forEachChild callback are load-bearing. ts.forEachChild STOPS at the first child
 * whose callback returns a truthy value — and `[]` is truthy in JS. An arrow body of `stringLiteralsIn(c,
 * acc)` therefore visits exactly ONE child and returns. That bug silently emptied the shrineSettings id
 * table (20 real ids → 0) on the first run of this net, and it is invisible unless something asserts a
 * known id is present. It is why the anti-false-green test below pins 'Hshrinecharge' by name.
 */
function stringLiteralsIn(node: ts.Node, acc: string[] = []): string[] {
  if (ts.isStringLiteralLike(node) && !node.getText().includes('${')) acc.push(node.text)
  ts.forEachChild(node, (c) => {
    stringLiteralsIn(c, acc)
  })
  return acc
}

for (const rel of SRC_CORPUS) {
  const sf = parse(rel)
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  /** name → string literals it is ever bound to in this file (`praidSetting = 'Praidingzone'`, `var t = {…}`). */
  const bindings = new Map<string, string[]>()
  const bind = (name: string, lits: string[]) => {
    if (!lits.length) return
    if (!bindings.has(name)) bindings.set(name, [])
    bindings.get(name)!.push(...lits)
  }

  const walk = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const fn = n.expression.text
      const a = n.arguments
      const a0 = a[0]

      if (fn === 'createSetting' && a0 && ts.isStringLiteralLike(a0)) {
        const dflt = a[4]
        declared.push({
          id: a0.text,
          file: rel,
          line: lineOf(n),
          type: a[3] && ts.isStringLiteralLike(a[3]) ? a[3].text : '<non-literal>',
          defaultKind: dflt ? dflt.kind : ts.SyntaxKind.Unknown,
          defaultText: dflt ? dflt.getText(sf) : '<none>',
        })
      }

      // Idiom 1+2: getPageSetting('x') / setPageSetting('x', …) — the dominant read path.
      if (fn === 'getPageSetting' || fn === 'setPageSetting') {
        if (a0 && ts.isStringLiteralLike(a0) && !a0.getText(sf).includes('${')) {
          refs.push({ id: a0.text, file: rel, line: lineOf(n), via: fn })
        } else if (a0) {
          dynamicSites.push({
            expr: a0.getText(sf).replace(/\s+/g, ' '),
            file: rel,
            line: lineOf(n),
            root: rootIdentifier(a0),
          })
        }
      }

      // Idiom 3: settingChanged('x') — mutates a setting by id and touches its DOM control by id.
      if (fn === 'settingChanged' && a0 && ts.isStringLiteralLike(a0))
        refs.push({ id: a0.text, file: rel, line: lineOf(n), via: 'settingChanged' })
    }

    // Idiom 4: a BARE string comparison against a setting id. settings-engine.ts's settingChanged(id)
    // does `if (id == 'AutoMagmiteSpender2' && btn.value == 1)` — no getPageSetting anywhere, so a
    // call-site-only scan is blind to it. (It is a phantom: the live id is 'spendmagmite'.)
    //
    // The scope rule is what makes this precise, and it matters: nature.ts / other.ts / upgrades.ts all
    // compare a variable literally named `setting` against option LABELS ('Void', 'Battle', 'Off'), which
    // are VALUES, not ids. Only a name that is used to INDEX autoTrimpSettings is an id. So: collect the
    // identifiers this file indexes autoTrimpSettings with, and only then treat `name == '<lit>'` as an
    // id reference. import-export.ts's `id == 'customProfileCurrent'` (a DOM <option> id) correctly
    // stays out on that rule.
    ts.forEachChild(n, walk)
  }
  walk(sf)

  // Second pass: resolve the id-typed identifier names, then the bare comparisons + the dynamic sites.
  const idIndexers = new Set<string>()
  const collect = (n: ts.Node): void => {
    if (
      ts.isElementAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === 'autoTrimpSettings' &&
      ts.isIdentifier(n.argumentExpression)
    )
      idIndexers.add(n.argumentExpression.text)

    // `praidSetting = 'Praidingzone'` — an id held in a variable, then passed to getPageSetting.
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left))
      bind(n.left.text, stringLiteralsIn(n.right))
    // `var shrineSettings = { Helium: { Standard: { core: 'Hshrine', … } } }` — an id TABLE.
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer)
      bind(n.name.text, stringLiteralsIn(n.initializer))

    ts.forEachChild(n, collect)
  }
  collect(sf)

  const compares = (n: ts.Node): void => {
    if (
      ts.isBinaryExpression(n) &&
      [
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ].includes(n.operatorToken.kind)
    ) {
      for (const [a, b] of [
        [n.left, n.right],
        [n.right, n.left],
      ] as const) {
        if (ts.isIdentifier(a) && idIndexers.has(a.text) && ts.isStringLiteralLike(b))
          refs.push({ id: b.text, file: rel, line: lineOf(n), via: `${a.text} == '…'` })
      }
    }
    ts.forEachChild(n, compares)
  }
  compares(sf)

  // Resolve each dynamic getPageSetting arg through its root identifier's string bindings. A site that
  // resolves contributes REAL ids to the checked set (praid/bwraid/shrine — 24 ids that a literal-only
  // scan never sees); a site that does not must be justified in ALLOWED_DYNAMIC below.
  for (const d of dynamicSites) {
    if (d.file !== rel) continue
    const lits = d.root ? (bindings.get(d.root) ?? []) : []
    for (const id of lits) indirect.push({ id, file: rel, line: d.line, via: `${d.root} = '${id}'` })
  }
}

const DEFINED = new Set(declared.map((d) => d.id))

// Dynamic id arguments a static scan genuinely cannot resolve: the id is CONSTRUCTED from a runtime
// value (a building name, a nature name, a worker name). Re-derived by listing every non-literal
// getPageSetting argument in the corpus and reading each one; these are all and only the concat forms.
// Anything NEW that lands here fails the net until a human has looked at it — which is the point.
const ALLOWED_DYNAMIC: Record<string, string> = {
  "'Max' + b": 'buildings.ts — MaxHut/MaxHouse/… , keyed by the building being considered',
  "'Max' + keysSorted[best]": 'buildings.ts — same family, keyed by the winning building',
  // ✅ #85 — `'RMax' + bb.name` and `'RMax' + keysSorted[best]` are both GONE. Their only sites were
  // inside RbuyFoodEfficientHousing / RbuyGemEfficientHousing, U2 housing buyers with ZERO reachable
  // callers (the live U2 path is RbuyBuildings → mostEfficientHousing). Both functions deleted, so the
  // expressions no longer exist and the net demanded these entries be removed. Note how this list read
  // before: FOUR RMax* dynamic forms, described as "the U2 twin of the same family" — as if all four
  // were doing work. Two of them were in dead code the whole time.
  // ⚠️ #95: this entry USED TO BE A LIE. Two sites shared the expression text `'RMax' + house`; in one of
  // them `house` came from `for (const house IN HousingTypes)` — an INDEX string, so it read the phantoms
  // RMax0..RMax6, and this allowlist waved it through on the strength of a comment. The buggy site is
  // deleted; the survivor (mostEfficientHousing, `for..of`) really is keyed by name. A dynamic id is only
  // as safe as the claim written beside it — re-read the site, do not trust the text.
  // tests/buildings.housingCaps.test.ts now pins the consequence behaviorally.
  "'RMax' + house": 'buildings.ts — U2 twin, keyed by housing name (mostEfficientHousing, for..of)',
  "'RMax' + housing": 'buildings.ts — U2 twin, keyed by housing name',
  "'R' + worker + 'Ratio'": 'jobs.ts:650 — RFarmerRatio / RLumberjackRatio / RMinerRatio',
  "'Auto' + nature": 'nature.ts:17 — AutoPoison / AutoWind / AutoIce',
}

describe('every setting id the code READS must have been createSetting\'d (#68)', () => {
  it('parses a real corpus (anti-false-green: a broken walk empties the sets and passes vacuously)', () => {
    // This is the #66 failure mode, pinned. If any of these collapse, the assertions below mean nothing.
    expect(SRC_CORPUS.length).toBeGreaterThan(30)
    expect(DEFINED.size).toBeGreaterThan(500)
    expect(new Set(refs.map((r) => r.id)).size).toBeGreaterThan(450)
    // Each of the four reference idioms must actually be finding sites — a regression in any one of them
    // is a silent false-negative channel, and idiom 4 is the one that found the AutoMagmiteSpender2 bug.
    for (const via of ['getPageSetting', 'setPageSetting', 'settingChanged'])
      expect(refs.some((r) => r.via === via), `no ${via} reference sites found`).toBe(true)
    expect(refs.some((r) => r.via.endsWith("== '…'")), 'no bare id-comparison sites found').toBe(true)
    // The indirect resolver is the widest coverage channel in this net (praid/bwraid/shrine ids are
    // NEVER written as a literal argument). Pin one id from each of its three families.
    const indirectIds = new Set(indirect.map((i) => i.id))
    expect(indirectIds.has('Praidingzone')).toBe(true) // other-praiding.ts, via praidSetting
    expect(indirectIds.has('Dailybwraid')).toBe(true) // other-praiding.ts, via bwraidSetting
    expect(indirectIds.has('Hshrinecharge')).toBe(true) // other.ts, via the shrineSettings table
  })

  // The shrinking baseline. Every entry is a CONFIRMED PHANTOM with a disposition — a fix queue, not an
  // allowlist. It may only ever get smaller (guard test below). Dispositions marked TRIAGE are the ones
  // whose correct repair is not yet decided; do NOT default them to "createSetting it" (see MaxTox).
  const KNOWN_PHANTOM: Record<string, string> = {
    // ── TYPOs: the intended id exists, spelled differently. ────────────────────────────────────────────
    DailyBWraid: "TYPO → 'Dailybwraid' (case) — AutoTrimps2.js:272, the daily BW-raid toggle never fires",
    // AutoMagmiteSpender2 — FIXED (#83 §7). settings-engine.ts now compares against the live id
    // 'spendmagmite', so magmiteSpenderChanged is really set and AutoTrimps2.js:200's 5-second
    // suppression engages. Repointed, NOT re-minted. Entry deleted per the shrinking-baseline rule.
    'game.global.universe == 1 && BWraid':
      "BUG — an entire EXPRESSION was pasted inside the string argument (AutoTrimps2.js:273). Intended: " +
      "game.global.universe == 1 && getPageSetting('BWraid')",

    // ── MISSING U2 / DAILY TWIN: the non-prefixed sibling is defined; the prefixed one never was. The
    //    repair is a choice (define the twin, or read the sibling) — hence TRIAGE, not a default define.
    // ✅ #85 — RCapEquip2 / RCapEquiparm / Ralways2 / RDynamicPrestige2 ARE GONE FROM THIS LIST, and not
    // because anything was defined: the only code that still read them was UNREACHABLE, and #85's
    // reachability net proved it, so the dead functions (RevaluateEquipmentEfficiency, RprestigeChanging2)
    // were DELETED and the reads went with them. That is the third disposition this list's header asks
    // for — not "define the twin", not "read the sibling", but "delete the reader". It is the only one of
    // the three that mints nothing, and re-minting a 2020-deleted id would have resurrected users' stored
    // values (see the header). Deleting the dead reader was always the right answer here.
    // ✅ Rgearamounttobuy — FIXED (#68). smithylogic now reads 'Requipamount', the live U2 gear-amount
    // setting, which until now was a rendered ORPHAN no code read. Default 1 == the old `: 1` fallback,
    // so behavior is unchanged. The net went red the moment the last read vanished; that is the design.
    Rnovmsc2: "MISSING U2 TWIN of 'novmsc2' — maps.ts:1023 (TRIAGE)",
    Ronlystackedvoids: "MISSING U2 TWIN of 'onlystackedvoids' — maps.ts:1011,1024 (TRIAGE)",
    dMaxMapBonushealth: "MISSING DAILY TWIN of 'MaxMapBonushealth' — upgrades.ts:105 (TRIAGE)",
    dVoidMaps: "MISSING DAILY TWIN of 'VoidMaps' — settings-visibility.ts:990 (TRIAGE)",

    // ── DEAD/UNSHIPPED FEATURE.
    // ✅ #85 — the nine nuloom ids (heirloomnu / autonu / rationu / slot1nu…slot6nu) ARE GONE FROM THIS
    // LIST. "Either ship the settings or delete the code" — we deleted the code. The whole nu-loom
    // subsystem was a six-function dead CYCLE whose sole entry point, spendNu(), had both of its call
    // sites commented out in portal.ts. Nothing reads these ids any more because nothing exists to read
    // them.
    // loomswap/dloomswap SURVIVE: unlike the nu ids, their readers (equipment.ts, maps.ts) are LIVE code
    // on a reachable path — a genuinely phantom-gated feature, which is #68's problem, not #85's.
    loomswap: 'DEAD — loom-swap settings never createSetting\'d (equipment.ts:358, maps.ts:398)',
    dloomswap: 'DEAD — daily loom-swap, same (equipment.ts:360, maps.ts:400, settings-visibility.ts:155-157)',

    // ── TRIAGE: no obvious target id; needs a decision. ────────────────────────────────────────────────
    Dailyportal: 'TRIAGE — portal.ts:310 `getPageSetting("Dailyportal")+1` → always 1',
    FoodEfficiencyIgnoresMax: 'TRIAGE — buildings.ts:111, ignoresLimit is always false',
    GemEfficiencyIgnoresMax: 'TRIAGE — buildings.ts:170, the Gateway carve-out never applies',
    GatewayWall:
      'TRIAGE — buildings.ts:175-176. Siblings GymWall/NurseryWall/WarpstationWall3 exist; note the ' +
      'divide-by-false at :176 (x / false = Infinity)',
    fuckanti: "TRIAGE — AutoTrimps2.js:233 `> 0` never true; only 'fuckjobs' is defined",

    // ── ⚠️ DO NOT DEFINE. ─────────────────────────────────────────────────────────────────────────────
    MaxTox:
      'DO NOT DEFINE — ACCIDENTALLY PROTECTIVE. portal.ts:74 reads it and, if truthy, calls ' +
      'settingChanged("MaxTox"); the control does not exist, so defining the setting turns a dead guard ' +
      'into a THROW inside the portal path. Delete the read instead.',
  }

  it('no setting id is read but never defined', () => {
    const phantom = new Map<string, Site[]>()
    for (const r of refs.concat(indirect)) {
      if (DEFINED.has(r.id) || r.id in KNOWN_PHANTOM) continue
      if (!phantom.has(r.id)) phantom.set(r.id, [])
      phantom.get(r.id)!.push(r)
    }
    const report = [...phantom.entries()].map(
      ([id, sites]) =>
        `'${id}' is never createSetting'd — getPageSetting returns FALSE at ${sites
          .map((s) => `${s.file}:${s.line} (${s.via})`)
          .join(', ')}`,
    )
    expect(report).toEqual([])
  })

  it('every dynamically-keyed read either resolves to real ids, or is explicitly allowed', () => {
    const unresolved = dynamicSites
      .filter((d) => !indirect.some((i) => i.file === d.file && i.line === d.line))
      .filter((d) => !(d.expr in ALLOWED_DYNAMIC))
      .map((d) => `${d.file}:${d.line} getPageSetting(${d.expr}) — unresolvable; triage it into ALLOWED_DYNAMIC`)
    expect(unresolved).toEqual([])
  })

  it('the known-phantom baseline only shrinks — it is a fix queue, not an allowlist', () => {
    for (const id of Object.keys(KNOWN_PHANTOM)) {
      expect(DEFINED.has(id), `'${id}' is now DEFINED — delete it from KNOWN_PHANTOM`).toBe(false)
      expect(
        refs.some((r) => r.id === id),
        `'${id}' is no longer read anywhere — delete it from KNOWN_PHANTOM`,
      ).toBe(true)
    }
    expect(Object.keys(KNOWN_PHANTOM).length).toBeLessThanOrEqual(28) // 29 → 28: Rgearamounttobuy fixed (#68)
  })

  it('the ALLOWED_DYNAMIC allowlist stays honest — every entry must still be a live call site', () => {
    for (const expr of Object.keys(ALLOWED_DYNAMIC))
      expect(
        dynamicSites.some((d) => d.expr === expr),
        `getPageSetting(${expr}) no longer exists — delete it from ALLOWED_DYNAMIC`,
      ).toBe(true)
  })
})

describe('no boolean setting is declared with a STRING default (#69)', () => {
  const booleans = declared.filter((d) => d.type === 'boolean')

  // Shrinking baseline: today's 36. `'false'` is TRUTHY, and `'false' == true` / `'false' == false` are
  // BOTH false, so the value each reader sees depends on how it happens to test the setting.
  // ⚠️ These are NOT free to fix in bulk: flipping `'false'` → `false` CHANGES behavior for every
  // truthiness reader of that setting (ON → OFF). Each one needs its readers checked. Hence a queue.
  const KNOWN_STRING_DEFAULT: Record<string, string> = {
    // ✅ EMPTY — all 36 are FIXED (#69). Every boolean setting now carries a real boolean default, and
    // settings-engine.ts coerces the persisted strings that five years of saves are carrying. This
    // baseline must stay empty: a re-quoted default is a new bug, and the ceiling below refuses to let
    // one be parked here. The bug this closes: 'false' is TRUTHY, and JS `==` never coerces it, so
    // `'false' == true` AND `'false' == false` were BOTH false while `if (x)` saw ON — every setting's
    // effective value depended on how its reader happened to test it.
  }



  it('finds the boolean-setting inventory (anti-false-green)', () => {
    expect(declared.length).toBeGreaterThan(500)
    expect(booleans.length).toBeGreaterThan(100)
    // A createSetting whose type argument stopped parsing as a literal would silently empty `booleans`.
    expect(declared.every((d) => d.type !== '<non-literal>')).toBe(true)
  })

  it("no boolean setting's default is a string literal", () => {
    const offenders = booleans
      .filter((d) => d.defaultKind === ts.SyntaxKind.StringLiteral)
      .filter((d) => !(d.id in KNOWN_STRING_DEFAULT))
      .map((d) => `${d.file}:${d.line} createSetting('${d.id}', … 'boolean', ${d.defaultText}) — string default`)
    expect(offenders).toEqual([])
  })

  it('the known-string-default baseline only shrinks', () => {
    const live = new Set(booleans.filter((d) => d.defaultKind === ts.SyntaxKind.StringLiteral).map((d) => d.id))
    for (const id of Object.keys(KNOWN_STRING_DEFAULT))
      expect(live.has(id), `'${id}' no longer has a string default — delete it from KNOWN_STRING_DEFAULT`).toBe(
        true,
      )
    expect(Object.keys(KNOWN_STRING_DEFAULT).length).toBeLessThanOrEqual(1) // 36 → 4 → 1: ship B unquoted 32, ship D the damage trio (#69)
  })
})

describe('a test may only seed setting ids that production defines (#74)', () => {
  // The #74 class. A characterization test that hand-builds `autoTrimpSettings = { loomswap: … }` is
  // asserting a branch production can never enter — and it is precisely what let the phantoms above hide
  // in plain sight for a whole review cycle: the suite was green, so the branch "worked".
  //
  // Scope: object-literal SEEDS only (`autoTrimpSettings = { id: … }`, `autoTrimpSettings.id = { … }`).
  // Deliberately NOT bare `autoTrimpSettings[id]` READS: a read asserts nothing about production.
  const testFiles = tsSources('tests').filter((f) => !f.includes(join('nets', 'settings-reverse')))

  const seeds: Site[] = []
  for (const rel of testFiles) {
    const sf = parse(rel)
    const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
    const isRegistry = (n: ts.Node) =>
      (ts.isIdentifier(n) && n.text === 'autoTrimpSettings') ||
      (ts.isPropertyAccessExpression(n) && n.name.text === 'autoTrimpSettings') ||
      (ts.isElementAccessExpression(n) &&
        ts.isStringLiteralLike(n.argumentExpression) &&
        n.argumentExpression.text === 'autoTrimpSettings')

    const walk = (n: ts.Node): void => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        // Whole-registry replacement: `(globalThis as any).autoTrimpSettings = { RCapEquiparm: {…} }`.
        if (isRegistry(n.left) && ts.isObjectLiteralExpression(n.right)) {
          for (const p of n.right.properties) {
            const nm = p.name
            if (nm && (ts.isIdentifier(nm) || ts.isStringLiteralLike(nm)))
              seeds.push({ id: nm.text, file: rel, line: lineOf(p), via: 'registry literal' })
          }
        }
        // Single-id seed: `autoTrimpSettings.loomswap = { type: 'value', value: 1 }`.
        const l = n.left
        if (
          (ts.isPropertyAccessExpression(l) || ts.isElementAccessExpression(l)) &&
          isRegistry(l.expression) &&
          ts.isObjectLiteralExpression(n.right)
        ) {
          const key = ts.isPropertyAccessExpression(l)
            ? l.name.text
            : ts.isStringLiteralLike(l.argumentExpression)
              ? l.argumentExpression.text
              : null
          if (key) seeds.push({ id: key, file: rel, line: lineOf(n), via: 'single-id seed' })
        }
      }
      ts.forEachChild(n, walk)
    }
    walk(sf)
  }

  // A PERMANENT, narrow allowlist — not a baseline. tests/settings-engine.test.ts unit-tests the ENGINE
  // (createSetting / settingChanged mechanics), which treats the id as an opaque key. Its Foo/Bar/Drop
  // fixtures are synthetic BY DESIGN and assert nothing about any real setting's behavior — the #74 class
  // does not apply. Scoped to that one file, and the guard test below refuses any other file.
  const ENGINE_FIXTURE_FILE = join('tests', 'settings-engine.test.ts')
  // #76 — the second exempt file, for the same reason with the sign flipped. cleanupAutoTrimps() is the
  // PURGE of ids production no longer defines, so its regression test must seed an id production no
  // longer defines: that is the input the function exists to consume. An undefined id there is the
  // fixture, not a lie. (Both ids are real history: 'Ronlystackedvoids' was createSetting'd in 2019 and
  // deleted upstream in 2020 — see #68 — and 'hardcorewindmax' is junk frozen into serializeSettings60().)
  const PURGE_FIXTURE_FILE = join('tests', 'import-export.security.test.ts')
  const SYNTHETIC_FILES = [ENGINE_FIXTURE_FILE, PURGE_FIXTURE_FILE]
  const ALLOWED_SYNTHETIC: Record<string, string> = {
    [`${ENGINE_FIXTURE_FILE}:71`]: "engine unit test — synthetic 'Foo' (boolean branch)",
    [`${ENGINE_FIXTURE_FILE}:94`]: "engine unit test — synthetic 'Bar' (multitoggle branch)",
    [`${ENGINE_FIXTURE_FILE}:122`]: "engine unit test — synthetic 'Drop' (dropdown branch)",
    [`${ENGINE_FIXTURE_FILE}:146`]: "engine unit test — synthetic 'Foo' (downstream-trio branch)",
    [`${PURGE_FIXTURE_FILE}:184`]: "#76 purge test — seeds stale 'Ronlystackedvoids' so cleanup can reap it",
    [`${PURGE_FIXTURE_FILE}:196`]: "#76 purge test — seeds stale 'Ronlystackedvoids' for the tooltip preview",
  }

  // Shrinking baseline, keyed by SITE — a test lie is a property of the line, not of the id (the same id
  // may be legitimately seeded elsewhere once its production bug is fixed). Each entry dies together with
  // the KNOWN_PHANTOM entry it is covering for.
  const KNOWN_TEST_LIE: Record<string, string> = {
    'tests/buildings.characterization.test.ts:321': "#68/#74 — seeds phantom 'GatewayWall'",
    'tests/buildings.characterization.test.ts:426': "#68/#74 — seeds phantom 'GemEfficiencyIgnoresMax'",
    // ✅ #85 — the two "seeds phantom 'RCapEquip2'" entries are GONE. Nothing repointed them: the tests
    // that seeded the id were tests OF DEAD CODE (RevaluateEquipmentEfficiency), and they were deleted
    // along with the function. This is the exact loop #85 exists to break — a test seeds a phantom id so
    // that a dead function can be exercised, the seed makes the test pass, and the passing test is then
    // cited as evidence the function works. Three nets were each carrying an entry for one symptom of it.
    'tests/equipment.characterization.test.ts:710': "#68/#74 — seeds phantom 'loomswap' (dead nuloom feature)",
    'tests/equipment.characterization.test.ts:728': "#68/#74 — seeds phantom 'dloomswap' (dead nuloom feature)",
  }

  it('finds the test-side settings seeds (anti-false-green)', () => {
    expect(testFiles.length).toBeGreaterThan(15)
    expect(seeds.length).toBeGreaterThan(150)
    expect(new Set(seeds.map((s) => s.id)).size).toBeGreaterThan(80)
  })

  it('no test seeds a setting id production never defines', () => {
    const lies = seeds
      .filter((s) => !DEFINED.has(s.id))
      .filter((s) => !(`${s.file}:${s.line}` in KNOWN_TEST_LIE))
      .filter((s) => !(`${s.file}:${s.line}` in ALLOWED_SYNTHETIC))
      .map((s) => `${s.file}:${s.line} seeds autoTrimpSettings['${s.id}'] — production never createSetting's it`)
    expect(lies).toEqual([])
  })

  it('the known-test-lie baseline only shrinks', () => {
    const live = new Set(seeds.filter((s) => !DEFINED.has(s.id)).map((s) => `${s.file}:${s.line}`))
    for (const k of Object.keys(KNOWN_TEST_LIE))
      expect(live.has(k), `${k} no longer seeds a phantom id — delete it from KNOWN_TEST_LIE`).toBe(true)
    expect(Object.keys(KNOWN_TEST_LIE).length).toBeLessThanOrEqual(6) // 8 → 6: the two RCapEquiparm fixtures now seed Requipcaphealth (#68)
  })

  it('the synthetic-fixture allowlist stays inside the two files that own synthetic ids', () => {
    // The one way this exemption could rot into a hole: a characterization test hiding behind it.
    for (const site of Object.keys(ALLOWED_SYNTHETIC)) {
      expect(
        SYNTHETIC_FILES.some((f) => site.startsWith(`${f}:`)),
        `${site} is neither the engine unit test nor the #76 purge test`,
      ).toBe(true)
      expect(
        seeds.some((s) => `${s.file}:${s.line}` === site),
        `${site} no longer seeds anything — delete it from ALLOWED_SYNTHETIC`,
      ).toBe(true)
    }
  })
})
