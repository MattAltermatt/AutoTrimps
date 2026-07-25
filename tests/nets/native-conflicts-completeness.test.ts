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
  autoEquipBtn:
    "buyAutoEquip() (main.js:18326) buys equipment LEVELS by percent-of-resources, against AT's " +
    'autoLevelEquipment / RautoEquip — AT\'s largest metal consumer (#108). The overlap is real but the ' +
    'conflict condition needs its own measurement (both can be partially correct at once), so #150 does ' +
    'not guess at it.',
  autoGoldenBtn:
    'autoGoldenUpgrades() (main.js:18554) vs AT\'s AutoGoldenUpgrades / dAutoGoldenUpgrades / ' +
    'cAutoGoldenUpgrades, which are string-valued strategies rather than on/off — the conflict is a ' +
    'strategy comparison, not a boolean, and belongs in its own pass.',
  autoTrapBtn:
    "autoTrap() (main.js:16797) vs AT's TrapTrimps / RTrapTrimps. AT's trapping is entangled with the " +
    'breed timer and Geneticist management, so "both are trapping" is not automatically a conflict.',
}

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
})
