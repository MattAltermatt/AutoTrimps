// #238 — A CONDITIONAL HIDE WITH NO PARTNER IS A ONE-WAY DOOR.
//
// updateCustomButtons() decides ~543 element visibilities per tick, and almost every one is a ternary:
// `cond ? turnOn(id) : turnOff(id)`. Two were not. They were bare one-armed ifs —
// `if (getPageSetting('showbreedtimer') == false) turnOff("hiddenBreedTimer");` — and because nothing
// in src/ ever turned those ids back on, toggling the setting off and on again without a page reload
// left the element hidden for the rest of the session, while main-loop.ts went on writing text into
// an invisible node. Both settings' own descriptions promise a reversible hide.
//
// The distinction that makes this mechanizable: an UNCONDITIONAL `turnOff(id);` is a deliberate
// permanent hide (the MAZ raw backing rows, which MAZ.ts re-shows through its own popup code, and
// `zonetracker`, whose tooltip says it never appears in the settings UI). A CONDITIONAL one is a
// decision, and a decision needs both outcomes. So: every id that is hidden under a condition must
// have some path that shows it again.
//
// Derived from the source, never from a list — a hand-maintained inventory of "the ids that are fine"
// is exactly the artifact that rots into a waiver.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(__dirname, '..', '..')
const REL = 'src/modules/settings-visibility.ts'

const sf = ts.createSourceFile(
  REL,
  readFileSync(resolve(ROOT, REL), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
)

type Site = { fn: string; id: string; conditional: boolean; line: number }
const sites: Site[] = []
/** ids a `toggleStatusElem(id, <expr>)` drives — that call carries BOTH outcomes in one statement. */
const twoArmed = new Set<string>()

{
  /** Is this call inside a ternary or an `if`, i.e. is the hide a decision rather than a fiat? */
  const isConditional = (n: ts.Node): boolean => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
      if (ts.isConditionalExpression(p) || ts.isIfStatement(p)) return true
      // Stop at the enclosing function: a hide inside `foo()` is not conditional just because some
      // caller is in an if.
      if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p)) return false
    }
    return false
  }

  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const fn = n.expression.text
      const a = n.arguments[0]
      if ((fn === 'turnOn' || fn === 'turnOff') && a && ts.isStringLiteralLike(a)) {
        sites.push({
          fn,
          id: a.text,
          conditional: isConditional(n),
          line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        })
      }
      if (fn === 'toggleStatusElem' && a && ts.isStringLiteralLike(a) && n.arguments.length > 1)
        twoArmed.add(a.text)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
}

const shown = new Set(sites.filter((s) => s.fn === 'turnOn').map((s) => s.id))
for (const id of twoArmed) shown.add(id)
/** Ids with at least one bare `turnOff(id);` — a fiat, so the element is hidden no matter what. */
const permanentlyHidden = new Set(
  sites.filter((s) => s.fn === 'turnOff' && !s.conditional && !shown.has(s.id)).map((s) => s.id),
)

describe('a conditional hide must have a way back (#238)', () => {
  it('anti-false-green: the parse really found the visibility layer', () => {
    // If the walk regresses, "no one-armed hides" is true of an empty set — the #66 shape.
    expect(sites.length).toBeGreaterThan(900)
    expect(shown.size).toBeGreaterThan(400)
    expect(sites.filter((s) => s.fn === 'turnOff').length).toBeGreaterThan(400)
    // Both kinds must be present or the `conditional` predicate is not discriminating anything.
    expect(sites.some((s) => s.fn === 'turnOff' && s.conditional)).toBe(true)
    expect(sites.some((s) => s.fn === 'turnOff' && !s.conditional)).toBe(true)
    expect(permanentlyHidden.size).toBeGreaterThan(0)
    // …and the #238 pair really is driven by the two-armed helper now.
    expect([...twoArmed].sort()).toEqual(['autoMapStatus', 'hiddenBreedTimer'])
  })

  it('no id is hidden under a condition without any path that shows it again', () => {
    // `permanentlyHidden` is excluded on purpose, and it is not a waiver — those elements are already
    // hidden by fiat elsewhere in the same function, so a conditional hide on top cannot strand
    // anything. It is dead, which the next test is about; it is not a one-way door.
    const oneWay = sites
      .filter((s) => s.fn === 'turnOff' && s.conditional && !shown.has(s.id) && !permanentlyHidden.has(s.id))
      .map((s) => `${REL}:${s.line} turnOff("${s.id}") is conditional, but nothing ever turns it on`)
    expect([...new Set(oneWay)]).toEqual([])
  })

  // Found by this net on its first run, and NOT by the review that prompted it — the finding's own
  // derivation asserted every turnOff-only id was hidden unconditionally, and 15 of them are hidden
  // BOTH ways. Reported rather than fixed: deleting them is a cosmetic change to a 1143-line function
  // and belongs in its own commit, not smuggled into a behaviour fix. The count may only shrink.
  const REDUNDANT_CONDITIONAL_HIDES = 15

  it('the already-permanently-hidden ids are only redundantly re-hidden, and no more than before', () => {
    const redundant = sites.filter(
      (s) => s.fn === 'turnOff' && s.conditional && permanentlyHidden.has(s.id),
    )
    expect(redundant.length).toBeLessThanOrEqual(REDUNDANT_CONDITIONAL_HIDES)
    // Every one must still be genuinely redundant — i.e. the unconditional hide is really there.
    for (const s of redundant)
      expect(
        sites.some((x) => x.id === s.id && x.fn === 'turnOff' && !x.conditional),
        `${REL}:${s.line} turnOff("${s.id}") has no unconditional partner — it IS a one-way door`,
      ).toBe(true)
  })
})
