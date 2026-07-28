// #242 — a tooltip that promises PERSISTENCE is a checkable claim about localStorage.
//
// The ImportModuleVars tooltip said MODULE overrides are saved "for future use between refreshes".
// Nothing in the shipped bundle has ever read `localStorage.storedMODULES` back — the key is written
// by three sites and read by none — so the promise was false, and nine seconds into the next boot
// guiLoop rewrote the key from the live diff, erasing the record of what the user had set.
//
// The lesson from #111–#119 is that tooltips are evidence about the code, and the lesson from #153
// is that a stated rationale is a claim about the world that can simply be wrong for years. So this
// net ties the two ends together rather than freezing today's wording: the copy may promise
// persistence exactly when a read-back exists.
//
// It is deliberately BIDIRECTIONAL. If someone implements the boot-time restore, this goes red and
// tells them the copy is now understating the feature — which is the failure mode a one-directional
// "must say NOT restored" assertion would silently permit.
//
// Not sim-visible in either direction: the write lives in guiLoop, which never runs in the L0 net
// (setInterval is stubbed dead in boot.mjs), and a value nothing reads emits no mutator event.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = resolve(__dirname, '../../src')

function allSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) out.push(...allSourceFiles(full))
    else if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

// Comments are stripped so the long explanatory note above the branch — which necessarily discusses
// reading the key and quotes the old wording — can neither satisfy nor trip the scan.
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n')
}

describe('#242 · the storedMODULES persistence claim matches the code', () => {
  const sources = allSourceFiles(SRC).map(code)
  const joined = sources.join('\n')

  const writesKey = /safeSetItems\(\s*['"]storedMODULES['"]/.test(joined)
  const readsKey = /getItem\(\s*['"]storedMODULES['"]\s*\)/.test(joined)

  const importExport = code(resolve(SRC, 'modules/import-export.ts'))
  const branch = importExport.split('what == "ImportModuleVars"')[1] ?? ''
  const copy = (branch.match(/tooltipText = "([^"]*)"/) ?? [])[1] ?? ''

  // Anti-false-green: the branch and its copy must actually have been found. A rename would
  // otherwise leave `copy` empty and every assertion below vacuously true.
  it('the ImportModuleVars tooltip copy is locatable', () => {
    expect(branch.length).toBeGreaterThan(0)
    expect(copy.length).toBeGreaterThan(40)
    expect(copy).toContain('MODULE variable settings')
  })

  it('the key is still written — this net is about a real key, not a dead one', () => {
    expect(writesKey).toBe(true)
  })

  it('the copy promises persistence exactly when a read-back exists', () => {
    // The phrase the original copy used to make its (false) promise.
    const promisesPersistence = /between refreshes|for future use|restored on|survives a refresh/i.test(copy)
    expect(promisesPersistence).toBe(readsKey)
  })

  it('with no read-back, the copy says so in as many words', () => {
    // Written as a TOTAL predicate rather than `if (readsKey) return …`. An early return in a test
    // body reports as a PASS, which is the invisible-skip class #258's net exists to catch — and it
    // caught this exact line on its first CI run against this file. The biconditional says the same
    // thing without a branch: the explicit session-only wording is present precisely when there is
    // no read-back to justify a persistence promise.
    const saysSessionOnly = /current session only/i.test(copy) && /NOT restored/.test(copy)
    expect(saysSessionOnly).toBe(!readsKey)
  })
})
