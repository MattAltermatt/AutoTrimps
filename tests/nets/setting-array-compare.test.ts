import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

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

export interface CompareSite {
  file: string
  line: number
  id: string
  op: '==' | '!='
  literal: number
}

/**
 * THE RULE, as a pure function so it can be tested on synthetic inputs rather than only on whatever
 * the tree happens to contain today (an assertion that can only inspect real data cannot be shown to
 * detect anything it does not already find).
 *
 * A `!=` guard is the "is this configured?" idiom: it must read FALSE at the declared default.
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

  // Reproduce the real coercion rather than modelling it.
  const guardAtDefault = site.op === '!=' ? (parsed as any) != site.literal : (parsed as any) == site.literal

  if (site.op === '!=' && guardAtDefault) {
    return `guard is TRUE at the declared default ${rawDefault}, so it does not detect "unset" and its fallback arm is unreachable`
  }
  return null
}

function collectSites(multiValueIds: Set<string>): CompareSite[] {
  const files: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name))
      else if (e.name.endsWith('.ts')) files.push(join(d, e.name))
    }
  }
  walk(join(ROOT, 'src/modules'))

  const sites: CompareSite[] = []
  for (const f of files) {
    readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, n) => {
        const re = /getPageSetting\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)\s*(==|!=)(?!=)\s*(-?\d+(?:\.\d+)?)/g
        for (const m of line.matchAll(re)) {
          if (!multiValueIds.has(m[1])) continue
          sites.push({ file: f.replace(ROOT + '/', ''), line: n + 1, id: m[1], op: m[2] as '==' | '!=', literal: Number(m[3]) })
        }
      })
  }
  return sites
}

// The fix queue — #162. SHRINK-ONLY: it is a list of known-broken sites awaiting a behavioural fix,
// not an allowlist for new ones. Each entry is `id@file:line`.
const KNOWN_BROKEN: Record<string, string> = {
  'RAMPraidcell@src/modules/mapfunctions.ts:655':
    '#162 — RPraid. Reproduced in tests/mapfunctions.rpraid-cell.test.ts: the 2nd+ configured PR zone never praids.',
  'RdAMPraidcell@src/modules/mapfunctions.ts:655': '#162 — the daily twin of the above, same line.',
  'Rinsanityfarmcell@src/modules/maps.ts:1226': '#162 — same shape: [-1] default guarded with != 0.',
  'Ralchfarmcell@src/modules/maps.ts:1263': '#162 — same shape.',
  'Rhypofarmcell@src/modules/maps.ts:1279': '#162 — same shape.',
}

const settings = parseSettings()
const multiValueIds = new Set([...settings].filter(([, v]) => v.type === 'multiValue').map(([k]) => k))
const sites = collectSites(multiValueIds)

describe('multiValue settings compared against a scalar (#162)', () => {
  it('anti-false-green: the parse really found the settings corpus', () => {
    expect(settings.size).toBeGreaterThan(500)
    expect(multiValueIds.size).toBeGreaterThan(50)
    // Spot-check both families, so a regression in default-parsing cannot pass silently.
    expect(settings.get('RAMPraidcell')).toEqual({ type: 'multiValue', rawDefault: '[-1]' })
    expect(settings.get('Rtimefarmlevel')).toEqual({ type: 'multiValue', rawDefault: '[0]' })
  })

  it('anti-false-green: the scan really found comparison sites', () => {
    expect(sites.length).toBeGreaterThan(10)
    expect(sites.some((s) => s.op === '!=')).toBe(true)
  })

  it('anti-false-green: classify() CAN see the poison it is meant to catch', () => {
    const at = (id: string, op: '==' | '!=', literal: number): CompareSite => ({ file: 'x.ts', line: 1, id, op, literal })
    // The real defect shape.
    expect(classify(at('X', '!=', 0), '[-1]')).toMatch(/does not detect/)
    // The two correct idioms.
    expect(classify(at('X', '!=', 0), '[0]')).toBeNull()
    expect(classify(at('X', '!=', -1), '[-1]')).toBeNull()
  })

  it('no multiValue guard fails to detect its own declared default', () => {
    const broken = sites
      .map((s) => ({ s, why: classify(s, settings.get(s.id)?.rawDefault ?? null) }))
      .filter((x) => x.why)
      .filter((x) => !(`${x.s.id}@${x.s.file}:${x.s.line}` in KNOWN_BROKEN))
      .map((x) => `'${x.s.id}' at ${x.s.file}:${x.s.line} (${x.s.op} ${x.s.literal}) — ${x.why}`)

    expect(broken).toEqual([])
  })

  it('the fix queue only SHRINKS — every entry must still be a real, still-broken site', () => {
    for (const key of Object.keys(KNOWN_BROKEN)) {
      const [id, loc] = key.split('@')
      const site = sites.find((s) => s.id === id && `${s.file}:${s.line}` === loc)
      expect(site, `'${key}' is no longer a live comparison site — delete it from KNOWN_BROKEN`).toBeTruthy()
      expect(
        classify(site!, settings.get(id)?.rawDefault ?? null),
        `'${key}' is FIXED — delete it from KNOWN_BROKEN rather than leaving it to rot`,
      ).toBeTruthy()
    }
  })
})
