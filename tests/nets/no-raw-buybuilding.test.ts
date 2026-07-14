import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// #123 — every AT building purchase must go through safeBuyBuilding(), which is where the
// DecaBuild/DoubleBuild stack ladder, the GymWall clamp, the Warpstation maxSplit case and the
// preBuy2/postBuy2 save-restore of the player's own buy-amount selector all live.
//
// U2's buyers spent years calling the native buyBuilding() directly with forceAmt=1. That is why
// DecaBuild bought U2 players NOTHING: the game crafts one queue entry per craft cycle and takes
// min(10, that entry's stack amount) from it, so a queue of `Hut.1` entries builds one per cycle
// however deep it gets. Closing this as a CLASS — a mechanical set-difference — is the only way it
// stays closed; a reading pass would not have caught it in the first place and will not catch the
// next one.
//
// The allowlist is deliberately tiny and each entry carries its reason inline at the call site.

const SRC = resolve('src/modules')

/** Every `buyBuilding(` callsite in src/, minus safeBuyBuilding's own body (which must call it). */
function rawCallSites(): { file: string; line: number; text: string }[] {
  const hits: { file: string; line: number; text: string }[] = []
  for (const file of readdirSync(SRC).filter((f) => f.endsWith('.ts'))) {
    const lines = readFileSync(resolve(SRC, file), 'utf8').split('\n')
    let inSafeBuy = false
    let depth = 0
    lines.forEach((text, i) => {
      if (/^export function safeBuyBuilding\b/.test(text)) {
        inSafeBuy = true
        depth = 0
      }
      if (inSafeBuy) {
        depth += (text.match(/\{/g) ?? []).length - (text.match(/\}/g) ?? []).length
        // The first line already opened the function body, so depth returning to 0 closes it.
        if (depth <= 0 && !/^export function safeBuyBuilding\b/.test(text)) inSafeBuy = false
        return
      }
      // Strip comments before matching: this file's own prose says "buyBuilding()" a lot, and a net
      // that trips on a comment is a net that gets muted.
      const code = text.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '')
      // A call to the NATIVE buyBuilding — not safeBuyBuilding, not RsafeBuyBuilding, etc.
      if (/(^|[^a-zA-Z])buyBuilding\s*\(/.test(code) && !/safeBuyBuilding\s*\(/.test(code)) {
        hits.push({ file, line: i + 1, text: text.trim() })
      }
    })
  }
  return hits
}

const ALLOWED = /raw-buyBuilding-allowlist:/

describe('#123 net: no AT building purchase bypasses safeBuyBuilding()', () => {
  const sites = rawCallSites()

  it('anti-false-green: the walk actually finds buyBuilding callsites (a broken walk collapses to ∅ and passes vacuously)', () => {
    // safeBuyBuilding's own body is excluded, so what remains is exactly the allowlisted raw call.
    // If this ever hits 0, the scanner is broken, not the codebase clean.
    expect(sites.length).toBeGreaterThan(0)
  })

  it('every raw buyBuilding() callsite carries an inline allowlist justification', () => {
    const unjustified = sites.filter((s) => !ALLOWED.test(s.text))
    expect(unjustified.map((s) => `${s.file}:${s.line}  ${s.text}`)).toEqual([])
  })

  it('the allowlist is exactly the one deliberate exception (Hypothermia bonfire Shed)', () => {
    // A shrinking baseline: if you legitimately add an exception, this count moves in the same commit
    // that adds its reason. If it moves without one, the class has silently re-opened.
    expect(sites.length).toBe(1)
    expect(sites[0].file).toBe('buildings.ts')
    expect(sites[0].text).toMatch(/Hypothermia bonfire Shed/)
  })
})
