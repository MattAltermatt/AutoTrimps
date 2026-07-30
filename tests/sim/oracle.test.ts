import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildUserscript } from '../../scripts/build-userscript.mjs'

// Guards that the pinned oracle stays CORRECT — that it is not a bundle from before a known, reviewed,
// shipped fix, which would make the L0 differential assert "keep behaving like the bug".
//
// ORACLE v2 (#66): re-pinned from `oracle/phase1-faithful` (5e51f56d) to `oracle/v2-post-bugfix`
// (514b790d). The old pin was asserted by the ABSENCE of #39 symbols; that identity check went stale
// the moment the pin moved. v2 is pinned by the PRESENCE of the fixes it must contain — a stronger
// check, because an oracle accidentally rebuilt from a pre-fix tag then fails loudly instead of
// silently reinstating the bugs as the behavioral baseline. See scripts/sim/build-oracle.mjs for why
// each re-pin was necessary.
//
// ⚠️ ORACLE v5 (2026-07-29) — AND THE PRESENCE CHECK ITSELF WENT STALE, FOR FOURTEEN DAYS, GREEN.
// The #64 anchors were single-quoted verbatim strings:
//     "getPageSetting('ManualGather2') == 1 || getPageSetting('ManualGather2') == 3"
// which matched because the v4 oracle bundle (abd6b1c0, 2026-07-14) still CONCATENATED
// legacy/AutoTrimps2.js verbatim. #133 ported that file into src/ on 2026-07-15, so from then on the
// line is esbuild output and esbuild normalises the quotes to double. The assertion could no longer
// say anything about the code that ships — it was pinning a deleted file's text — and nothing noticed,
// because the artifact it reads is frozen by design.
//
// THE FIX IS STRUCTURAL, NOT A QUOTE ESCAPE: every anchor is asserted against BOTH the frozen oracle
// AND a freshly built working bundle. An anchor that stops describing src/ now fails immediately and
// says so, instead of ageing into a claim about history. (buildUserscript() is pure esbuild — no game
// clone, so this still runs on CI.) Match on regex, so an incidental bundler formatting choice cannot
// masquerade as a missing fix.
describe('oracle bundle', () => {
  const oracle = readFileSync(resolve('tests/fixtures/oracle/autotrimps.oracle.user.js'), 'utf8')
  let working: string

  beforeAll(async () => {
    working = await buildUserscript()
  }, 60_000)

  /** An anchor is only meaningful if it describes the CURRENT code too — assert both sides. */
  const bothContain = (re: RegExp, issue: string) => {
    expect(working, `${issue}: the anchor no longer matches src/ — RE-DERIVE IT, do not delete it`).toMatch(re)
    expect(oracle, `${issue}: the pinned oracle predates the fix — it was rebuilt from a stale tag`).toMatch(re)
  }

  it('is a non-trivial userscript bundle', () => {
    expect(oracle.length).toBeGreaterThan(500_000)
    expect(oracle).toContain('AutoTrimps')
  })

  it('is post-#39 (has the settings-taxonomy seam the old 5e51f56d pin predated)', () => {
    bothContain(/renderControlFace/, '#39')
    bothContain(/settingKind/, '#39')
  })

  it('is post-strangler — the oracle must not be a pre-#133 concat build', () => {
    // The property whose change hid the stale #64 anchor for fourteen days. `legacy/` was deleted in
    // #171; a v4-or-earlier oracle still carries its chunk banner, so this can only pass on v5+.
    expect(oracle).not.toContain('/* ===== legacy/')
    expect(working).not.toContain('/* ===== legacy/')
  })

  it('contains the #63 fix — the oracle must NOT re-enshrine the needGymystic bug', () => {
    // The whole reason for the v2 re-pin. If this fails, the oracle was rebuilt from a pre-fix tag and
    // the L0 net is once again asserting "keep behaving like the bug".
    bothContain(/game\.upgrades\.Gymystic\.allowed > game\.upgrades\.Gymystic\.done/, '#63')
    expect(oracle).not.toContain('if (needGymystic) scienceNeeded')
    expect(oracle).not.toContain('var needGymystic = true')
  })

  it('contains the #64 fix — the previously-dead gather options are routed', () => {
    // Quote-agnostic: the routing is the claim, the quote style is the bundler's business.
    bothContain(/getPageSetting\(['"]ManualGather2['"]\) == 1 \|\| getPageSetting\(['"]ManualGather2['"]\) == 3/, '#64')
    bothContain(/getPageSetting\(['"]RManualGather2['"]\) == 1 \|\| getPageSetting\(['"]RManualGather2['"]\) == 2/, '#64')
  })

  it('contains the four fixes ORACLE v5 exists to absorb', () => {
    // The re-pin ledger (tests/fixtures/traces/manifest.json) attributes all 14 moved fixtures to these.
    // If a future rebuild silently lands on a pre-campaign tag, the traces would go back to recording AT
    // buying LOCKED equipment — so pin the code, not just the tag string.
    bothContain(/gammaBurstPct = 0/, '#169/#170')
    bothContain(/expectedCritMulti/, '#199/#212/#295')
  })
})
