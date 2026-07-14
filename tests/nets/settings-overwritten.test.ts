// #107 — IF AUTOTRIMPS WRITES A SETTINGS BOX, ITS TOOLTIP MUST SAY SO.
//
// The worst tooltip defect found in #106 was not a wrong sentence, it was an absent one. The
// Farmer/Lumberjack/Miner ratio boxes are rewritten by workerRatios() EVERY TICK in the default mode.
// They look editable. They accept your keystrokes. The value is gone within ~100ms and nothing tells
// you. A user can lose an evening to that.
//
// The class is "a setting the bot writes to itself" — mechanically, any id passed to setPageSetting().
// A reader can miss one; a set-difference cannot. So this net enumerates every setPageSetting call in
// src/ and demands the corresponding tooltip carry an `overwritten:` facet.
//
// WHAT IT DOES NOT DO, deliberately: it does not check the WORDING. The 12 written ids are not one
// uniform class and a canned badge would be a fresh lie —
//   - the ratio boxes are rewritten every tick, but ONLY while BuyJobsNew == 1;
//   - AutoMaps/RAutoMaps are written by toggleAutoMaps(), i.e. by the USER clicking the AutoMaps
//     button — not a trap at all;
//   - FirstGigastation/DeltaGigastation are written back by the auto-giga solver with what it chose;
//   - TrimpleZ is a one-shot write when the Trimple treasure is taken;
//   - RABfarmstring is AT recording its own best farm string.
// So the CONDITION is authored by a human and this net enforces its PRESENCE. Adding a 13th write site
// without documenting it fails CI, which is the whole point: the drift cannot be silent.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const SRC = join(__dirname, '../../src/modules')

/** Every id passed to setPageSetting() anywhere in src/ — the settings AT writes to itself. */
function writtenIds(): Set<string> {
  const ids = new Set<string>()
  for (const f of readdirSync(SRC).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(SRC, f), 'utf8')
    for (const m of src.matchAll(/setPageSetting\(\s*'([^']+)'/g)) ids.add(m[1])
  }
  return ids
}

/** The rendered description of every setting, keyed by id — captured by mounting the real catalog. */
const descriptions = new Map<string, string>()

/** Same recording-DOM idiom as settings-tooltips/settings-types: real where we look, inert elsewhere. */
function makeEl(tag = 'div'): any {
  const anyEl: any = new Proxy(function () {}, { get: () => anyEl, apply: () => anyEl, set: () => true })
  const real: any = {
    tag, id: '', className: '', textContent: '', value: '', childNodes: [] as any[],
    setAttribute: () => {},
    getAttribute: () => undefined,
    appendChild(c: any) { real.childNodes.push(c); return c },
    querySelector: () => null,
  }
  return new Proxy(real, {
    get: (t, p) => (p in t ? t[p] : anyEl),
    set: (t, p, v) => { t[p as string] = v; return true },
  })
}

beforeAll(async () => {
  ;(globalThis as any).document = {
    createElement: (t: string) => makeEl(t),
    createTextNode: (t: string) => ({ textContent: t }),
    getElementById: () => makeEl(),
  }
  ;(globalThis as any).window = globalThis
  ;(globalThis as any).modifyParentNode = () => {}
  ;(globalThis as any).settingsProfileMakeGUI = () => {}
  ;(globalThis as any).game = { options: { menu: { darkTheme: { enabled: 0 } } } }
  ;(globalThis as any).ATversion = 'net-settings-overwritten'
  ;(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  ;(globalThis as any).autoTrimpSettings = {}

  const engine = await import('../../src/modules/settings-engine')
  const utils = await import('../../src/modules/utils')
  const { initializeAllSettings } = await import('../../src/modules/settings-defs')
  ;(globalThis as any).createSetting = engine.createSetting
  ;(globalThis as any).getPageSetting = utils.getPageSetting

  initializeAllSettings()
  for (const [id, rec] of Object.entries((globalThis as any).autoTrimpSettings as Record<string, any>)) {
    if (rec && typeof rec.description === 'string') descriptions.set(id, rec.description)
  }
})

// The marker tip() emits for the `overwritten` facet. Matching the rendered marker (not a source-level
// property) means the net checks what the USER is actually shown, which is the thing that was missing.
const MARKER = '<b>AT writes this box.</b>'

describe('every AT-written setting declares that AT writes it (#107)', () => {
  it('anti-false-green: the catalog really mounted, and the setPageSetting scan really found sites', () => {
    // Both halves of a set-difference can collapse to ∅ and pass vacuously. Pin both.
    expect(descriptions.size).toBeGreaterThan(500)
    expect(writtenIds().size).toBeGreaterThan(8)
  })

  it('anti-false-green: the marker check can actually tell the two apart', () => {
    expect(MARKER).not.toBe('')
    expect('some prose'.includes(MARKER)).toBe(false)
    expect(('x' + MARKER + 'y').includes(MARKER)).toBe(true)
  })

  it('no setting is silently rewritten by the bot', () => {
    const undocumented = [...writtenIds()]
      // An id AT writes but never createSetting'd is a phantom — a different defect class (#68-74), and
      // NOT ours to mint a setting for (re-minting a deleted id resurrects a stale saved value).
      .filter((id) => descriptions.has(id))
      .filter((id) => !descriptions.get(id)!.includes(MARKER))
      .sort()
    expect(undocumented).toEqual([])
  })
})
