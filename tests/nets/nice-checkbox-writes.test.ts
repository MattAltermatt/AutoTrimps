import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import ts from 'typescript'

// #175 / #228 / #247 — the niceCheckbox write net.
//
// THE BUG. `advPerfectCheckbox` used to be a real `<input type="checkbox">`. Trimps 4.9 (clone commit
// b43ef65, 2018-09-04) replaced it with
//
//     <span id="advPerfectCheckbox" class="icomoon icon-checkbox-unchecked niceCheckbox"
//           data-checked="false" onclick="swapNiceCheckbox(this); updateMapNumbers()"></span>
//
// A `<span>` has no `checked` property, so `elem.checked = true` creates a JS expando on the element
// object and NOTHING reads it. The state the game reads is the ATTRIBUTE, via
// `readNiceCheckbox(elem) { return (elem.dataset.checked == "true") }` (updates.js:1958) called from
// `checkPerfectChecked()` (main.js:6303), which is what `updateMapCost()` consults for its `+6`
// baseCost. So all 20 of the fork's writes were silently inert for ~8 years: AT never got the Perfect
// map its own ladders open with, and the "degrade to imperfect if we can't afford it" rungs re-priced
// an unchanged map and could never be true.
//
// WHY A DERIVED NET AND NOT THREE FIXES. This is a game-API-drift class, not three bugs. The findings
// disagreed with each other about how many sites there were (#175 named 2 and mentioned 7 more; #247
// named 4 and called itself a duplicate), which is the S3/S4 lesson exactly: a finding's own scoping
// claim is a claim. Derive the target set from the clone's markup and the write set from the AST, and
// the count stops being anybody's assertion. Both dispositions this repair used — repair the write
// (`swapNiceCheckbox`) and DELETE it where the sliders make it unreachable — satisfy this net, and no
// third disposition can quietly reintroduce the expando.
//
// SCOPE, stated honestly. This resolves the write TARGET through `byId('literal')`,
// `document.getElementById('literal')`, `querySelector('#literal')`, and one level of same-file
// `const x = <one of those>`. Writes through a target this cannot resolve are NOT silently ignored —
// they fail unless they are in UNRESOLVED_BASELINE below, so blindness is visible rather than assumed.

const ROOT = resolve(__dirname, '..', '..')

// The SHA-pinned clone `npm ci` materializes, never the dev workspace at ../trimps-game (absent on
// CI — a test that cannot run on the runner is the hole #67 closed). TRIMPS_GAME_DIR still wins.
const GAME_DIR = process.env.TRIMPS_GAME_DIR || resolve(ROOT, '.trimps-game')

function tsSources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) tsSources(rel, acc)
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) acc.push(rel)
  }
  return acc
}

const CORPUS = tsSources('src')

const sourceOf = (rel: string, text = readFileSync(join(ROOT, rel), 'utf8')) =>
  ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

// ---------------------------------------------------------------------------------------------
// 1. the game's niceCheckbox elements — derived from the clone, never listed
// ---------------------------------------------------------------------------------------------

/**
 * Two ways the game mints one:
 *   a) static markup — `<span id="x" class="… niceCheckbox …" data-checked="false">` (index.html:897)
 *   b) `buildNiceCheckbox(id, …)` (updates.js:1961), which emits the same span from a string
 *
 * (b) is mostly called with a CONCATENATED id (`'structConfig' + item`), which a static scan cannot
 * resolve to concrete ids. Those are counted, not resolved — and the fork does not write `.checked`
 * to a concatenated target anywhere, which the unresolved-writes assertion below independently pins.
 */
function niceCheckboxIds(): { ids: Set<string>; dynamicBuilds: number } {
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
  // (a) any tag carrying class="… niceCheckbox …" — id before or after the class attribute.
  for (const m of text.matchAll(/<[^>]*\bclass\s*=\s*["'][^"']*\bniceCheckbox\b[^"']*["'][^>]*>/g)) {
    const id = /\bid\s*=\s*["']([^"']+)["']/.exec(m[0])
    if (id) ids.add(id[1])
  }
  // (b) buildNiceCheckbox('literal', …)
  let literalBuilds = 0
  for (const m of text.matchAll(/buildNiceCheckbox\(\s*(["'])((?:(?!\1)[^\\])*)\1\s*(,|\))/g)) {
    ids.add(m[2])
    literalBuilds++
  }
  // The rest build the id by concatenation (`buildNiceCheckbox('structConfig' + item, …)`) and are
  // out of static reach. Counted so a regression in the literal branch cannot masquerade as "the game
  // simply has fewer of these now".
  const dynamicBuilds = [...text.matchAll(/buildNiceCheckbox\(/g)].length - literalBuilds

  return { ids, dynamicBuilds }
}

const { ids: NICE_CHECKBOX_IDS, dynamicBuilds: DYNAMIC_BUILDS } = niceCheckboxIds()

// ---------------------------------------------------------------------------------------------
// 2. every `.checked = …` write in the fork, with its target resolved where possible
// ---------------------------------------------------------------------------------------------

type Write = { target: string | null; file: string; line: number; text: string }

const LOOKUP_FNS = new Set(['byId', 'getElementById'])

/** `byId('x')` / `document.getElementById('x')` / `querySelector('#x')` → 'x'; anything else → null. */
function idOfLookup(node: ts.Expression): string | null {
  let e: ts.Expression = node
  // Unwrap `byId('x') as HTMLInputElement`, `(…)`, `byId('x')!`.
  for (;;) {
    if (ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isParenthesizedExpression(e)) e = e.expression
    else if (ts.isTypeAssertionExpression?.(e)) e = e.expression
    else break
  }
  if (!ts.isCallExpression(e)) return null
  const callee = e.expression
  const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : ''
  const arg = e.arguments[0]
  if (!arg || !ts.isStringLiteralLike(arg)) return null
  if (LOOKUP_FNS.has(name)) return arg.text
  if (name === 'querySelector' || name === 'querySelectorAll') {
    const m = /^#([\w-]+)$/.exec(arg.text)
    return m ? m[1] : null
  }
  return null
}

function collectWrites(rel: string, text?: string): Write[] {
  const sf = sourceOf(rel, text)

  // One level of indirection: `const box = byId('x')` / `let box = document.getElementById('x')`.
  const bound = new Map<string, string>()
  const bind = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const id = idOfLookup(node.initializer)
      if (id) bound.set(node.name.text, id)
    }
    ts.forEachChild(node, bind)
  }
  bind(sf)

  const out: Write[] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text === 'checked'
    ) {
      const obj = node.left.expression
      const target =
        idOfLookup(obj) ?? (ts.isIdentifier(obj) ? (bound.get(obj.text) ?? null) : null)
      out.push({
        target,
        file: rel,
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        text: node.getText(sf).replace(/\s+/g, ' ').slice(0, 90),
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

const WRITES = CORPUS.flatMap((rel) => collectWrites(rel))

/**
 * `.checked` writes whose target this net cannot resolve statically. Each entry is audited, and the
 * assertion below is `toEqual([...])` — a NEW unresolved write fails on arrival rather than being
 * quietly excused, which is the difference between a baseline and an allowlist.
 */
const UNRESOLVED_BASELINE = [
  // graphs/render.ts — `checkbox` is the loop variable over AT's OWN `<input type="checkbox">`
  // elements built by buildGraphMenu. Not a game element, and not a niceCheckbox.
  'src/modules/graphs/render.ts:287',
]

// ---------------------------------------------------------------------------------------------

describe('the fork must never write `.checked` to a niceCheckbox element (#175/#228/#247)', () => {
  it('parses a real corpus (anti-false-green: an empty scan passes everything vacuously)', () => {
    // #66's failure mode, pinned shut. If either derivation silently stops matching, every assertion
    // below passes while proving nothing at all.
    expect(CORPUS.length).toBeGreaterThan(30)
    expect(NICE_CHECKBOX_IDS.size).toBeGreaterThan(10)
    expect(DYNAMIC_BUILDS).toBeGreaterThan(5) // the concatenated `buildNiceCheckbox` ids, unresolvable
    // The element this whole class is about, and one from each derivation branch.
    expect(NICE_CHECKBOX_IDS.has('advPerfectCheckbox')).toBe(true) // (a) static markup, index.html:897
    expect(NICE_CHECKBOX_IDS.has('spirefctStatic')).toBe(true) // (b) buildNiceCheckbox literal
    expect(NICE_CHECKBOX_IDS.has('equalityReversing')).toBe(true) // (b) updates.js:1892
    // And the fork really is scanned for writes — otherwise "zero bad writes" is trivially true.
    expect(WRITES.length).toBeGreaterThan(0)
    expect(WRITES.some((w) => w.file.endsWith('graphs/render.ts'))).toBe(true)
  })

  it('the detector actually detects (positive control against a synthetic reintroduction)', () => {
    // The assertion below is `[] === []`, which is exactly the shape that passes when the walker is
    // broken. So run the walker over each of the four ways the bug could come back and require a hit.
    // A revert-mutant would only prove it sees the ORIGINAL spelling — these are the near misses.
    const reintroductions: Record<string, string> = {
      'the original': `byId("advPerfectCheckbox").checked = true;`,
      'single quotes': `byId('advPerfectCheckbox').checked = false;`,
      'via getElementById': `document.getElementById('advPerfectCheckbox').checked = true;`,
      'via a bound const': `const box = byId('advPerfectCheckbox') as HTMLInputElement; box.checked = true;`,
      'via querySelector': `(document.querySelector('#advPerfectCheckbox') as any).checked = true;`,
    }
    for (const [how, src] of Object.entries(reintroductions)) {
      const found = collectWrites('synthetic.ts', src)
      expect(found.length, `${how}: not seen as a .checked write at all`).toBe(1)
      expect(found[0].target, `${how}: target did not resolve`).toBe('advPerfectCheckbox')
      expect(NICE_CHECKBOX_IDS.has(found[0].target!)).toBe(true)
    }
    // Negative control — an AT-owned real <input> must NOT be flagged, or the net is a blanket ban on
    // `.checked` and would be muted the first time somebody touches the graphs menu.
    const ok = collectWrites('synthetic.ts', `(document.querySelector('#blackCB') as any).checked = true;`)
    expect(ok[0].target).toBe('blackCB')
    expect(NICE_CHECKBOX_IDS.has('blackCB')).toBe(false)
  })

  it('no `.checked` write targets a niceCheckbox element', () => {
    const bad = WRITES.filter((w) => w.target && NICE_CHECKBOX_IDS.has(w.target)).map(
      (w) => `${w.file}:${w.line} — ${w.text}`,
    )
    // These elements are <span>s. `.checked` is an expando the game never reads; drive `data-checked`
    // through swapNiceCheckbox(elem, bool) — or, where the design pins the sliders so the game can
    // never consult it (loot=0 ⇒ sum ≠ 27), delete the write instead of dressing it up as working code.
    expect(bad).toEqual([])
  })

  it('every `.checked` write resolves to a known element, or is a pinned blind spot', () => {
    const unresolved = WRITES.filter((w) => w.target === null).map((w) => `${w.file}:${w.line}`)
    expect(unresolved).toEqual(UNRESOLVED_BASELINE)
  })
})
