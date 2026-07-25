// @vitest-environment jsdom
//
// #150 — the fear this mechanizes: a native automation gets added (or an anchor id is typo'd) and the
// advisory silently covers nothing. A badge that never mounts looks exactly like "no conflict".
//
// jsdom because native-conflicts imports the real getPageSetting, and utils.ts runs
// `document.createElement` at module top level.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CONFLICTS } from '../../src/modules/native-conflicts'

// The SHA-PINNED clone (repo-root .trimps-game/), which npm ci materializes and which exists on CI —
// NOT ../trimps-game (the dev workspace), which is absent on the runner (#67 hole).
const html = readFileSync(resolve(process.cwd(), '.trimps-game/index.html'), 'utf8')
const settingsDefs = readFileSync(resolve(process.cwd(), 'src/modules/settings-defs.ts'), 'utf8')
const matrixSrc = readFileSync(resolve(process.cwd(), 'src/modules/native-conflicts.ts'), 'utf8')

// EVERY native automation button the clone ships that AT ALSO automates. This list is the net's claim
// about the world, so it must be complete — the first version of this file listed only the five #150
// covered and called that "every native automation button the game ships", which made the net unable to
// fail for the omission that matters most (AutoEquip: two automations bidding for the same metal).
// A gate optimized for greenness is not a gate.
const NATIVE_AUTOMATION_BUTTONS = [
  'autoPrestigeBtn',
  'autoUpgradeBtn',
  'autoStructureBtn',
  'autoJobsBtn',
  'autoStorageBtn',
  'autoEquipBtn',
  'autoGoldenBtn',
  'autoTrapBtn',
]

// Buttons deliberately NOT yet covered by the advisory matrix, each with the reason it is deferred and
// the AT counterpart it would be compared against. Tracked in #152. This list may only SHRINK: adding
// an entry means declining coverage in writing, which is the point — silence would read as "covered".
const KNOWN_UNCOVERED: Record<string, string> = {
  // MEASURED, #152 — this is no longer a deferral. The overlap was audited against the clone and a live
  // z53 save, and the verdict is that there is NO conflict to warn about. Kept here rather than promoted
  // to a row precisely because a badge would be a false claim, and the four rows #150's review had to
  // correct were all false claims. The evidence, so nobody has to re-derive it:
  //  · Native autoTrap() (main.js:16797) has NO cap and NO relevance cutoff, so it does overshoot AT's
  //    calcMaxTraps() without bound — measured 255,571 traps owned against an AT cap of 815 (313x), and
  //    30 traps built per 12s, continuously, via the main.js:4933 rebuild-the-queue-head loop.
  //  · But the cost is 10 food + 10 wood per trap (config.js:11432, a FIXED cost) = ~25/s of each,
  //    against ~2.8e10/s of income at that depth. Nine orders of magnitude. "It wastes resources" would
  //    be true arithmetic and a worthless advisory.
  //  · And the coexistence is DELIBERATE on AT's side, in two places pinned by the test below: gather.ts
  //    excludes 'Trap.1' from its divert-to-building test, and RmanualLabor2 reads trapBuildToggled
  //    directly. AT was written to tolerate the native trapper.
  //  · The one path that could have starved AT — the queue never being empty, which the world<=3 gather
  //    branches require — is unreachable: trapBuildAllowed is absent from the portal preserve list
  //    (updates.js:4340-4600 saves trapBuildToggled and NOT trapBuildAllowed), so it resets to false
  //    (config.js:95) every run and the native trapper is inert until AT re-buys Trapstorm.
  // Re-open this only if the test below goes red, which is the event that invalidates the verdict.
  autoTrapBtn:
    "autoTrap() (main.js:16797) vs AT's TrapTrimps / RTrapTrimps. AUDITED AND DECLINED (#152): native " +
    "trapping is uncapped and does overshoot AT's calcMaxTraps() by ~313x, but at a fixed 10 food + " +
    '10 wood per trap that is ~1 part in a billion of income at that depth, and AT is written to ' +
    'tolerate it (the Trap.1 exclusion and the trapBuildToggled read pinned below). A badge here would ' +
    'be a true arithmetic claim about a cost that does not exist.',
}

// The two accommodations the autoTrapBtn verdict above rests on. This is the point of the whole entry:
// an audit recorded as prose rots, and the next person reads "no conflict" without knowing what made it
// true. If either accommodation is refactored away, AT stops tolerating the native trapper and the
// AutoTraps question genuinely re-opens — so that must cost a red test, not a shrug.
const gatherSrc = readFileSync(resolve(process.cwd(), 'src/modules/gather.ts'), 'utf8')

describe('native-conflict advisory completeness (#150)', () => {
  // `body()` resolves the universe to name the right setting, so it needs a game to read.
  beforeEach(() => {
    ;(globalThis as any).game = { global: { universe: 1 } }
    ;(globalThis as any).autoTrimpSettings = {}
  })

  it('every native automation button is either covered by a row or declined in writing', () => {
    const anchored = new Set(CONFLICTS.map((c) => c.anchorId))
    for (const id of NATIVE_AUTOMATION_BUTTONS) {
      const covered = anchored.has(id)
      const declined = id in KNOWN_UNCOVERED
      expect(covered || declined, `${id} is neither covered nor listed in KNOWN_UNCOVERED`).toBe(true)
      // Covering one later must mean DELETING its excuse, not accumulating both.
      expect(covered && declined, `${id} is both covered and excused — drop the KNOWN_UNCOVERED entry`).toBe(false)
    }
  })

  it('every button named in the lists is real, and every excuse is argued', () => {
    for (const id of NATIVE_AUTOMATION_BUTTONS)
      expect(new RegExp(`id=["']${id}["']`).test(html), `${id} is not in the clone`).toBe(true)
    for (const [id, why] of Object.entries(KNOWN_UNCOVERED)) {
      expect(NATIVE_AUTOMATION_BUTTONS, `${id} excused but not listed`).toContain(id)
      // A one-word excuse is how an allowlist stops meaning anything.
      expect(why.length, `${id} needs a written justification`).toBeGreaterThan(80)
    }
  })

  it('every anchor resolves — a game id in the clone, or an AT setting id', () => {
    for (const c of CONFLICTS) {
      const inGame = new RegExp(`id=["']${c.anchorId}["']`).test(html)
      const isSetting = settingsDefs.includes(`createSetting('${c.anchorId}'`)
      expect(inGame || isSetting, `${c.anchorId} anchors nothing`).toBe(true)
    }
  })

  it('each row explains itself — heading, a real body, and a recommendation', () => {
    // Both universes: several bodies branch on the universe to name the right setting, and a branch
    // that returns nothing useful in U2 is the same defect as having no copy at all.
    for (const universe of [1, 2]) {
      ;(globalThis as any).game.global.universe = universe
      for (const c of CONFLICTS) {
        expect(c.title.trim().length, c.key).toBeGreaterThan(10)
        const body = c.body()
        expect(body.length, `${c.key} @ U${universe}`).toBeGreaterThan(80)
        // A conflict the player cannot act on is a scold, not an advisory.
        expect(body, `${c.key} @ U${universe}`).toContain('Recommended')
      }
    }
  })

  it('the matrix is advisory-only: no mutation of game state or settings in the source', () => {
    expect(matrixSrc).not.toMatch(/game\.global\.[A-Za-z]+\s*=[^=]/)
    expect(matrixSrc).not.toMatch(/\bsetPageSetting\b/)
    expect(matrixSrc).not.toMatch(/\btoggleAuto[A-Za-z]*\s*\(/)
  })

  it('keys are unique — two rows sharing a key would share one badge element id', () => {
    expect(new Set(CONFLICTS.map((c) => c.key)).size).toBe(CONFLICTS.length)
  })

  // See the long comment on KNOWN_UNCOVERED.autoTrapBtn. These two reads are the whole reason that entry
  // says "no conflict" instead of "needs a badge"; without them the native trapper's permanently-occupied
  // build queue would start steering AT's gather ladder.
  describe('the autoTrapBtn "no conflict" verdict still holds (#152)', () => {
    it("gather.ts still exempts a lone queued Trap from the divert-to-building test", () => {
      // If this exclusion goes, a single native-queued Trap.1 starts forcing setGather('buildings') for
      // every player without Foremany — which IS a conflict, and the advisory would then be owed.
      expect(gatherSrc).toMatch(/buildingsQueue\[0\]\s*!==?\s*'Trap\.1'/)
    })

    it('gather.ts still defers to the native trapper by reading trapBuildToggled', () => {
      // RmanualLabor2's storage-build branch is gated on the native trapper being OFF. That gate is AT
      // accommodating the game, and it is the second leg of the verdict.
      expect(gatherSrc).toMatch(/!\s*game\.global\.trapBuildToggled/)
    })

    it('autoTrapBtn is still declined, not quietly promoted to a row', () => {
      // A guard against the opposite failure: someone adds the row from the issue text without redoing
      // the measurement, and the excuse silently disappears. Covering it must be a deliberate act that
      // deletes this entry AND this describe block.
      expect(KNOWN_UNCOVERED.autoTrapBtn).toMatch(/AUDITED AND DECLINED/)
    })
  })
})
