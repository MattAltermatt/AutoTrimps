import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Reads only the COMMITTED oracle fixture — no game clone needed — so this runs in CI too,
// guarding that the pinned oracle stays correct.
describe('oracle bundle', () => {
  const src = readFileSync(resolve('tests/fixtures/oracle/autotrimps.oracle.user.js'), 'utf8')

  it('is a non-trivial userscript bundle', () => {
    expect(src.length).toBeGreaterThan(500_000)
    expect(src).toContain('AutoTrimps')
  })

  it('predates #39 (no renderControlFace / settingKind — confirms the oracle pin at 5e51f56d)', () => {
    expect(src).not.toContain('renderControlFace')
    expect(src).not.toContain('settingKind')
  })
})
