import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as ts from 'typescript'

// NET — a multiValue setting compared against a SCALAR must be able to detect its own default.
//
// `getPageSetting` on a multiValue returns `Array.from(value).map(parseInt)` — an ARRAY (utils.ts:64).
// Comparing an array to a number coerces through ToPrimitive → String → Number, so whether an
// "is it configured?" guard works depends entirely on the setting's DECLARED DEFAULT:
//
//     [0]  != 0    →  "0"  →  0   ⇒  false   ✅ guard reads false when unset — correct
//     [-1] != -1   →  "-1" → -1   ⇒  false   ✅ correct
//     [-1] != 0    →  "-1" → -1   ⇒  TRUE    🔴 guard PASSES when unset — fallback unreachable
//
// #162. The class went unnoticed because the mistake is COHERENT: AT's `*farmlevel` settings default
// to [0], where `!= 0` is right, and its `*cell` settings default to [-1], where it is not. The guard
// idiom was copied from one family to the other without re-checking the default.
//
// Downstream, a passing guard is not merely cosmetic — the code then indexes the array positionally
// (`getPageSetting(id)[index]`), and a one-element [-1] yields `undefined` for every index past the
// first. `undefined <= 1` and `undefined > 1` are BOTH false, so the feature silently does nothing.
// Reproduced for RPraid in tests/mapfunctions.rpraid-cell.test.ts.
//
// This net is DERIVED, not restated: it parses each setting's real declared default out of
// settings-defs.ts and evaluates the real comparison, so re-defaulting a currently-safe `*farmlevel`
// setting to [-1] — which would look like harmless consistency with its siblings — turns it red.

const ROOT = resolve(__dirname, '../..')
const DEFS = readFileSync(join(ROOT, 'src/modules/settings-defs.ts'), 'utf8')

const SETTING_TYPES = [
  'boolean', 'multitoggle', 'valueNegative', 'value', 'textValue', 'dropdown', 'multiValue', 'infoclick', 'action',
]

/** id -> { type, rawDefault } parsed from each createSetting call's own argument list. */
function parseSettings(): Map<string, { type: string; rawDefault: string | null }> {
  const out = new Map<string, { type: string; rawDefault: string | null }>()
  for (const m of DEFS.matchAll(/createSetting\(\s*'([A-Za-z0-9_]+)'/g)) {
    const id = m[1]
    // Walk to the matching close paren so a tip({...}) block with its own parens cannot truncate us.
    let i = m.index! + m[0].length
    let depth = 1
    while (i < DEFS.length && depth > 0) {
      const c = DEFS[i]
      if (c === '(') depth++
      else if (c === ')') depth--
      i++
    }
    const body = DEFS.slice(m.index!, i)
    for (const t of SETTING_TYPES) {
      const hit = new RegExp(`,\\s*'${t}'\\s*,\\s*(\\[[^\\]]*\\]|'[^']*'|"[^"]*"|-?\\d+(?:\\.\\d+)?|true|false|null)`).exec(body)
      if (hit) {
        out.set(id, { type: t, rawDefault: hit[1] })
        break
      }
      if (new RegExp(`,\\s*'${t}'\\s*,`).test(body)) {
        out.set(id, { type: t, rawDefault: null })
        break
      }
    }
  }
  return out
}

export type CompareOp = '==' | '!=' | '===' | '!==' | '<' | '<=' | '>' | '>='

export interface CompareSite {
  file: string
  /** For the human reading the failure message ONLY. Never key anything by this — see KNOWN_BROKEN. */
  line: number
  /** Enclosing function name, or `<module>` at top level. Part of the stable key. */
  fn: string
  id: string
  op: CompareOp
  /** The numeric literal on the other side, or null when the other side is any other expression. */
  literal: number | null
  /** Source text of the other operand, for the failure message. */
  other: string
  /** True when the setting is on the RIGHT of the operator (`world == getPageSetting('X')`) — #178. */
  reversed: boolean
}

/**
 * THE RULE, as a pure function so it can be tested on synthetic inputs rather than only on whatever
 * the tree happens to contain today (an assertion that can only inspect real data cannot be shown to
 * detect anything it does not already find).
 *
 * There is exactly ONE correct way to compare a multiValue against a scalar: as an "is this
 * configured?" test against the setting's own UNSET SENTINEL — the value its declared default
 * coerces to. Everything else is a value test against a whole LIST, which coerces through
 * String() and therefore stops behaving the moment the user configures a second entry:
 *
 *     [0]  != 0                 →  "0"       →  0    ⇒  false  ✅ sentinel test, detects unset
 *     [-1] != -1                →  "-1"      → -1    ⇒  false  ✅ sentinel test
 *     [-1] != 0                 →  "-1"      → -1    ⇒  TRUE   🔴 #162 — fallback arm unreachable
 *     [-1] == 50                →  "-1"      → -1    ⇒  false  🔴 #263 — a VALUE test on a list
 *     495 == [480,495]          →  "480,495" → NaN   ⇒  false  🔴 #178 — same, reversed operands
 *
 * Returns null when the site is fine, or a reason string when it is not.
 */
export function classify(site: CompareSite, rawDefault: string | null): string | null {
  if (rawDefault === null) return null // no parsable default — nothing to decide against
  let parsed: unknown
  try {
    parsed = JSON.parse(rawDefault)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null

  if (site.literal === null) {
    return (
      `compares the whole multiValue LIST against a non-literal scalar (\`${site.other}\`). It coerces ` +
      `through String(), so it is correct only while the list holds exactly one entry — a second ` +
      `configured entry makes it Number("a,b") = NaN and the comparison is false forever`
    )
  }
  if (site.op !== '==' && site.op !== '!=' && site.op !== '===' && site.op !== '!==') {
    return `uses the relational operator \`${site.op}\` against a whole multiValue LIST — that is a value test, not an "is it configured?" test, and it breaks on any list with more than one entry`
  }
  // A strict operator against an array is decided by identity, never by coercion: it is ALWAYS
  // false for `===` and ALWAYS true for `!==`, whatever the user configured.
  if (site.op === '===' || site.op === '!==') {
    return `uses \`${site.op}\` against an ARRAY, which compares identity — it is a constant, never a test of the configured value`
  }

  // Reproduce the real coercion rather than modelling it: is this literal the setting's sentinel?
  const isSentinel = (parsed as unknown[]) == (site.literal as unknown)
  if (isSentinel) return null

  if (site.op === '!=') {
    return `guard is TRUE at the declared default ${rawDefault}, so it does not detect "unset" and its fallback arm is unreachable`
  }
  return `${site.literal} is not this setting's unset sentinel (declared default ${rawDefault}), so this is a VALUE test against a whole list — it stops matching as soon as a second entry is configured`
}

const OPS = new Map<ts.SyntaxKind, CompareOp>([
  [ts.SyntaxKind.EqualsEqualsToken, '=='],
  [ts.SyntaxKind.ExclamationEqualsToken, '!='],
  [ts.SyntaxKind.EqualsEqualsEqualsToken, '==='],
  [ts.SyntaxKind.ExclamationEqualsEqualsToken, '!=='],
  [ts.SyntaxKind.LessThanToken, '<'],
  [ts.SyntaxKind.LessThanEqualsToken, '<='],
  [ts.SyntaxKind.GreaterThanToken, '>'],
  [ts.SyntaxKind.GreaterThanEqualsToken, '>='],
])

/** The numeric value of `n` if it is a numeric literal (or a negated one), else null. */
function numericValue(n: ts.Expression): number | null {
  if (ts.isNumericLiteral(n)) return Number(n.text)
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand))
    return -Number(n.operand.text)
  return null
}

/**
 * The nearest enclosing NAMED scope, walking up parents — the stable half of this net's key.
 *
 * An anonymous callback gets the name of the call that owns it, so `atGuard('buyWeps:bwraidMap',
 * function () { … })` anchors on `atGuard:buyWeps:bwraidMap`. main-loop.ts dispatches almost
 * entirely through that shape, and a bare `<anonymous>` there would be no more stable than the line
 * number this key exists to replace.
 */
function enclosingFn(n: ts.Node): string {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) {
      if (p.name) return p.name.getText()
      continue
    }
    if (ts.isFunctionExpression(p) || ts.isArrowFunction(p)) {
      if (p.name) return p.name.getText()
      if (ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name)) return p.parent.name.text
      if (ts.isPropertyAssignment(p.parent)) return p.parent.name.getText()
      if (ts.isCallExpression(p.parent) && ts.isIdentifier(p.parent.expression)) {
        const label = p.parent.arguments.find((a) => ts.isStringLiteral(a))
        if (label) return `${p.parent.expression.text}:${(label as ts.StringLiteral).text}`
      }
      continue // keep climbing rather than settling for '<anonymous>'
    }
  }
  return '<module>'
}

/**
 * A TS-compiler-API walk, NOT a line regex. The old regex required `getPageSetting(...)` on the LEFT
 * of the operator followed by a numeric literal, which made it structurally blind to the reversed
 * form — and #178 is exactly that: `game.global.world == getPageSetting('BWraidingz')`. A net that
 * cannot see half of its own class is worse than none, because its green is quoted as coverage.
 */
function collectSites(multiValueIds: Set<string>): CompareSite[] {
  const files: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name))
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) files.push(join(d, e.name))
    }
  }
  walk(join(ROOT, 'src/modules'))

  /** `getPageSetting('X')` used BARE — not `...[i]`, not `.length`, not `.includes(...)`. */
  const bareSettingId = (n: ts.Expression): string | null => {
    if (!ts.isCallExpression(n)) return null
    if (!ts.isIdentifier(n.expression) || n.expression.text !== 'getPageSetting') return null
    const arg = n.arguments[0]
    if (!arg || !ts.isStringLiteral(arg)) return null
    return multiValueIds.has(arg.text) ? arg.text : null
  }

  const sites: CompareSite[] = []
  for (const f of files) {
    const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const visit = (n: ts.Node): void => {
      if (ts.isBinaryExpression(n) && OPS.has(n.operatorToken.kind)) {
        const left = bareSettingId(n.left)
        const id = left ?? bareSettingId(n.right)
        if (id) {
          const other = left ? n.right : n.left
          sites.push({
            file: f.replace(ROOT + '/', ''),
            line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
            fn: enclosingFn(n),
            id,
            op: OPS.get(n.operatorToken.kind)!,
            literal: numericValue(other),
            other: other.getText(sf).replace(/\s+/g, ' ').slice(0, 60),
            reversed: !left,
          })
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return sites
}

/** The stable key: setting id + file + ENCLOSING FUNCTION. Never a line number. */
const keyOf = (s: CompareSite) => `${s.id}@${s.file}#${s.fn}`

/**
 * The waiver covering this exact site, or undefined.
 *
 * ONE definition, used by both directions of the queue check. An earlier version tested membership
 * by KEY here and the reviewed `(op, literal)` only in the shrink-check — which recreated the #159
 * hole one level down: a second, distinct broken comparison sharing a site's `id@file#fn` was
 * silently exempted, and a planted `getPageSetting('RAMPraidcell') == 50` inside RPraid passed 5/5.
 * The key locates the waiver; the operator and literal are what it actually covers.
 */
const waiverFor = (s: CompareSite) => {
  const w = KNOWN_BROKEN[keyOf(s)]
  return w && w.op === s.op && w.literal === s.literal ? w : undefined
}

// The fix queue. SHRINK-ONLY: a list of known-broken sites awaiting a behavioural fix, not an
// allowlist for new ones. Each entry names its issue, and records the exact `op`/`literal` it was
// reviewed against — a waiver that matches only a SLOT blanket-exempts whatever later occupies it,
// which is the hole #159 found in the sim's own waiver mechanism.
//
// ⚠️ Keys are `id@file#function`, deliberately NOT `id@file:line`. The line form re-keys on ANY edit
// above the site, and the two files carrying this queue (maps.ts, mapfunctions.ts) are due a batch of
// unrelated fixes — every one of which would have reddened this net while finding nothing. Line-keyed
// baselines have already produced two false reds on this repo.
const KNOWN_BROKEN: Record<string, { op: CompareOp; literal: number | null; why: string }> = {
  'RAMPraidcell@src/modules/mapfunctions.ts#RPraid': {
    op: '!=', literal: 0,
    why: '#162 — reproduced in tests/mapfunctions.rpraid-cell.test.ts: the 2nd+ configured PR zone never praids.',
  },
  'RdAMPraidcell@src/modules/mapfunctions.ts#RPraid': {
    op: '!=', literal: 0, why: '#162 — the daily twin of the above, same expression.',
  },
  'Rinsanityfarmcell@src/modules/maps.ts#RautoMap': {
    op: '!=', literal: 0, why: '#162 — same shape: [-1] default guarded with != 0.',
  },
  'Ralchfarmcell@src/modules/maps.ts#RautoMap': { op: '!=', literal: 0, why: '#162 — same shape.' },
  'Rhypofarmcell@src/modules/maps.ts#RautoMap': { op: '!=', literal: 0, why: '#162 — same shape.' },
  'Rshipfarmamount@src/modules/mapfunctions.ts#Rship': {
    op: '==', literal: 50,
    why: '#263 — a VALUE test against a whole list; silently stops matching past one configured entry.',
  },
  'BWraidingz@src/modules/main-loop.ts#atGuard:buyWeps:bwraidMap': {
    op: '==', literal: null,
    why: '#178 — reversed operands, so the old line-regex could not see it at all. BWraiding() itself pairs by index correctly; this dispatch site is the odd one out.',
  },
  'BWraidingmax@src/modules/main-loop.ts#atGuard:buyWeps:bwraidMap': {
    op: '<=', literal: null, why: '#178 — the paired max on the same expression.',
  },
}

const settings = parseSettings()
const multiValueIds = new Set([...settings].filter(([, v]) => v.type === 'multiValue').map(([k]) => k))
const sites = collectSites(multiValueIds)

describe('multiValue settings compared against a scalar (#162 / #178 / #263)', () => {
  it('anti-false-green: the parse really found the settings corpus', () => {
    expect(settings.size).toBeGreaterThan(500)
    expect(multiValueIds.size).toBeGreaterThan(50)
    // Spot-check both families, so a regression in default-parsing cannot pass silently.
    expect(settings.get('RAMPraidcell')).toEqual({ type: 'multiValue', rawDefault: '[-1]' })
    expect(settings.get('Rtimefarmlevel')).toEqual({ type: 'multiValue', rawDefault: '[0]' })
  })

  it('anti-false-green: the scan really found comparison sites, in BOTH operand positions', () => {
    expect(sites.length).toBeGreaterThan(10)
    expect(sites.some((s) => s.op === '!=')).toBe(true)
    // The reversed form is the half the old line-regex was blind to (#178). If this ever reads
    // false, the walk has silently narrowed back to the shape that missed a real defect.
    expect(sites.some((s) => s.reversed)).toBe(true)
    // And the enclosing-scope resolution has to actually resolve, or the key is no more stable than
    // the line number it replaced. A site that lands here needs a better anchor, not a waiver.
    expect(sites.filter((s) => s.fn === '<module>' || s.fn === '<anonymous>').map(keyOf)).toEqual([])
  })

  it('anti-false-green: classify() CAN see every poison shape it is meant to catch', () => {
    const at = (op: CompareOp, literal: number | null, other = 'x'): CompareSite => ({
      file: 'x.ts', line: 1, fn: 'f', id: 'X', op, literal, other, reversed: false,
    })
    // #162 — an unset guard against the wrong sentinel.
    expect(classify(at('!=', 0), '[-1]')).toMatch(/does not detect/)
    // #263 — a value test against a whole list.
    expect(classify(at('==', 50), '[-1]')).toMatch(/not this setting's unset sentinel/)
    // #178 — compared against a non-literal scalar, in either operand position.
    expect(classify(at('==', null, 'game.global.world'), '[-1]')).toMatch(/non-literal scalar/)
    // Relational and strict operators are never a valid configured-value test on a list.
    expect(classify(at('<=', 500), '[-1]')).toMatch(/relational operator/)
    expect(classify(at('===', -1), '[-1]')).toMatch(/compares identity/)
    // The two correct idioms — a loose test against the setting's OWN sentinel.
    expect(classify(at('!=', 0), '[0]')).toBeNull()
    expect(classify(at('!=', -1), '[-1]')).toBeNull()
  })

  it('no multiValue is compared as a scalar outside the fix queue', () => {
    const broken = sites
      .map((s) => ({ s, why: classify(s, settings.get(s.id)?.rawDefault ?? null) }))
      .filter((x) => x.why)
      // Matched on the reviewed (op, literal), not on the key alone — a key-only check exempts any
      // NEW defect that happens to share a waived site's id, file and function.
      .filter((x) => !waiverFor(x.s))
      .map((x) => `'${keyOf(x.s)}' (${x.s.op} ${x.s.literal ?? x.s.other}) at line ${x.s.line} — ${x.why}`)

    expect(broken).toEqual([])
  })

  it('a SECOND defect at an already-waived key is NOT exempted', () => {
    // The regression this net had itself: `keyOf` is a location, not a description. Synthesize a
    // fresh #263-shaped site inside RPraid — same id, same file, same function as a live waiver,
    // different comparison — and it must still be reported.
    const waived = sites.find((s) => waiverFor(s))!
    expect(waived, 'the fix queue is empty — this guard has nothing to stand on').toBeTruthy()
    const impostor: CompareSite = { ...waived, op: '==', literal: 50 }
    expect(keyOf(impostor)).toBe(keyOf(waived)) // same slot...
    expect(waiverFor(impostor)).toBeUndefined() // ...but not the same reviewed comparison
    expect(classify(impostor, settings.get(impostor.id)?.rawDefault ?? null)).toBeTruthy()
  })

  it('the fix queue only SHRINKS — every entry is one real, still-broken, still-identical site', () => {
    for (const [key, entry] of Object.entries(KNOWN_BROKEN)) {
      const matches = sites.filter((s) => keyOf(s) === key)
      expect(matches.length, `'${key}' is no longer a live comparison site — delete it from KNOWN_BROKEN`)
        .toBeGreaterThan(0)
      // Matching on the slot alone is the #159 hole: it blanket-exempts whatever later occupies it.
      // The entry must still describe the exact comparison it was reviewed against.
      const site = matches.find((s) => s.op === entry.op && s.literal === entry.literal)
      expect(
        site,
        `'${key}' no longer carries the reviewed comparison (${entry.op} ${entry.literal ?? 'non-literal'}) — ` +
          `re-review it rather than letting the waiver cover a different expression`,
      ).toBeTruthy()
      expect(
        classify(site!, settings.get(site!.id)?.rawDefault ?? null),
        `'${key}' is FIXED — delete it from KNOWN_BROKEN rather than leaving it to rot`,
      ).toBeTruthy()
    }
  })
})
