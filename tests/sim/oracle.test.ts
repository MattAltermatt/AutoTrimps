import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Reads only the COMMITTED oracle fixture — no game clone needed — so this runs in CI too,
// guarding that the pinned oracle stays correct.
//
// ORACLE v2 (#66): re-pinned from `oracle/phase1-faithful` (5e51f56d) to `oracle/v2-post-bugfix`
// (514b790d). The old pin was asserted by the ABSENCE of #39 symbols; that identity check went stale
// the moment the pin moved. v2 is pinned by the PRESENCE of the fixes it must contain — a stronger
// check, because an oracle accidentally rebuilt from a pre-fix tag then fails loudly instead of
// silently reinstating the bugs as the behavioral baseline. See scripts/sim/build-oracle.mjs for why
// the re-pin was necessary.
describe('oracle bundle', () => {
  const src = readFileSync(resolve('tests/fixtures/oracle/autotrimps.oracle.user.js'), 'utf8')

  it('is a non-trivial userscript bundle', () => {
    expect(src.length).toBeGreaterThan(500_000)
    expect(src).toContain('AutoTrimps')
  })

  it('is post-#39 (has the settings-taxonomy seam the old 5e51f56d pin predated)', () => {
    expect(src).toContain('renderControlFace')
    expect(src).toContain('settingKind')
  })

  it('contains the #63 fix — the oracle must NOT re-enshrine the needGymystic bug', () => {
    // The whole reason for the v2 re-pin. If this fails, the oracle was rebuilt from a pre-fix tag and
    // the L0 net is once again asserting "keep behaving like the bug".
    expect(src).toContain('game.upgrades.Gymystic.allowed > game.upgrades.Gymystic.done')
    expect(src).not.toContain('if (needGymystic) scienceNeeded')
    expect(src).not.toContain('var needGymystic = true')
  })

  it('contains the #64 fix — the previously-dead gather options are routed', () => {
    expect(src).toContain("getPageSetting('ManualGather2') == 1 || getPageSetting('ManualGather2') == 3")
    expect(src).toContain("getPageSetting('RManualGather2') == 1 || getPageSetting('RManualGather2') == 2")
  })
})
