import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

// NET — every symbol `src/game/trimps.d.ts` declares must actually exist in the pinned clone.
//
// WHY THIS IS THE RIGHT INPUT. AutoTrimps forked from upstream around 2022; the clone is v5.10.1.
// Because own code is `strict`, TypeScript forces EVERY free identifier a module calls to be
// declared somewhere — game symbols in trimps.d.ts, AT's own bare-name seam in at-legacy.d.ts
// (netted separately by ambient-vars.test.ts). So this file IS the complete surface of what AT
// believes the game provides, and every entry in it is a checkable claim about the world.
//
// A renamed or removed native does NOT crash: AT calls it by bare name, so the failure is a
// ReferenceError deep inside a tick that the error boundary swallows, or — worse — a silently
// skipped branch. The proof net cannot see it either, because the corpus boots the same clone.
// A drift check has to compare against the clone's SOURCE, which is what this does.
//
// MEASURED AT CREATION: 152 declarations, 152 present. Zero drift against v5.10.1. The value here
// is forward-looking — this pins the contract so an upstream bump that drops a symbol goes red on
// arrival rather than at some later tick in someone's browser.

const ROOT = resolve(__dirname, '../..')
const GAME_DIR = process.env.TRIMPS_GAME_DIR || join(ROOT, '.trimps-game')

const dts = readFileSync(join(ROOT, 'src/game/trimps.d.ts'), 'utf8')

interface Decl { kind: string; name: string }
const declared: Decl[] = [...dts.matchAll(/^\s*(?:export\s+)?(function|const|var|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm)]
  .map((m) => ({ kind: m[1], name: m[2] }))

const jsFiles = readdirSync(GAME_DIR).filter((f) => f.endsWith('.js'))
const cloneJs = jsFiles
  .filter((f) => !f.endsWith('.min.js'))
  .map((f) => readFileSync(join(GAME_DIR, f), 'utf8'))
  .join('\n')
// Minified libraries are held separately and matched by BARE TOKEN. Pattern-matching a declaration
// inside 31KB of mangled source is hopeless, so this route is deliberately weaker — it can confirm a
// library still ships the name, not that it exports it in any particular shape. Kept narrow (only
// *.min.js) so the weak test cannot leak into the game's own readable sources.
const cloneMin = jsFiles
  .filter((f) => f.endsWith('.min.js'))
  .map((f) => readFileSync(join(GAME_DIR, f), 'utf8'))
  .join('\n')
const cloneHtml = readFileSync(join(GAME_DIR, 'index.html'), 'utf8')

/**
 * Is `name` provided by the clone? Three legitimate provisioning routes, all of which land the name
 * on `window` and are therefore callable by bare name from AT:
 *   1. a normal JS declaration / assignment in one of the game's scripts
 *   2. a MINIFIED library's export (decimal.min.js is 31KB of mangled source — pattern-matching a
 *      declaration in it is hopeless, so bare presence of the token is the honest test)
 *   3. a DOM id in index.html, which browsers expose as a global (mapLevelInput is one)
 */
export function providedByClone(name: string, js = cloneJs, html = cloneHtml, min = cloneMin): boolean {
  const decl = [
    new RegExp(`function\\s+${name}\\s*\\(`),
    new RegExp(`\\b(?:var|let|const)\\s+${name}\\s*=`),
    new RegExp(`^\\s*${name}\\s*[:=]\\s*function`, 'm'),
    new RegExp(`\\b${name}\\s*=\\s*(?:function|\\{|new\\b)`),
    new RegExp(`^\\s*${name}\\s*:`, 'm'),
  ]
  if (decl.some((p) => p.test(js))) return true
  if (new RegExp(`id=["']${name}["']`).test(html)) return true
  if (new RegExp(`\\b${name}\\b`).test(min)) return true
  return false
}

describe('game-API drift — trimps.d.ts vs the pinned clone', () => {
  it('anti-false-green: the parse and the clone read really happened', () => {
    expect(declared.length).toBeGreaterThan(100)
    expect(cloneJs.length).toBeGreaterThan(1_000_000)
    expect(cloneHtml).toMatch(/<html/i)
    // Both families must be represented, or the regex has silently narrowed.
    expect(declared.some((d) => d.kind === 'function')).toBe(true)
    expect(declared.some((d) => d.kind === 'var' || d.kind === 'const')).toBe(true)
  })

  it('anti-false-green: the detector discriminates (positive AND negative controls)', () => {
    // Found — one per provisioning route.
    for (const n of ['buyBuilding', 'setFormation', 'naturePurchase']) expect(providedByClone(n)).toBe(true)
    expect(providedByClone('mapLevelInput')).toBe(true) // DOM-id route
    // NOT found — a detector that matches anything proves nothing.
    for (const n of ['definitelyNotAGameFunctionXyzzy', 'atInventedSymbol42']) {
      expect(providedByClone(n)).toBe(false)
    }
  })

  it('every game symbol AT declares exists in the pinned clone', () => {
    const missing = declared
      .filter((d) => !providedByClone(d.name))
      .map((d) => `${d.kind} ${d.name} — declared in src/game/trimps.d.ts but not provided by the clone`)

    expect(missing).toEqual([])
  })
})
