// @vitest-environment jsdom
// jsdom: utils.ts touches `document` at module load.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #103 — the MAZ readers must go through the ONE setting-reading path.
//
// `mapfunctions.RtimeFarm`, `jobs.RworkerRatios` and `gather.RmanualLabor2` used to index the store
// directly:  autoTrimpSettings.Rtimefarmspecial.value[i]  — reaching around getPageSetting() and so
// around its hasOwnProperty check, its type dispatch, and the "unset" handling that #96/#100 spent
// two issues standardizing. There must be ONE way to read a setting or a fix to the reading path does
// not reach every reader.
//
// THE BAR IS EQUIVALENCE. The replacement, utils.getPageSettingAt(id, i), must return the byte-same
// value as the direct index for every store a real player can have — configured and unconfigured
// alike — and differ ONLY where the old form threw. That is what this suite pins, oracle-style:
// the OLD expression and the NEW expression are both evaluated against the same store and compared.
//
// Why the throw matters: mainLoop has no try/catch (#87), so a TypeError here does not stay local —
// it kills every automation ordered after it, every tick, until the player reloads.

let utils: typeof import('../src/modules/utils')

beforeAll(async () => {
  utils = await import('../src/modules/utils')
})

/** The exact expression the three call sites used before #103. Throws where it used to throw. */
function legacyDirectIndex(id: string, i: number): unknown {
  return (globalThis as any).autoTrimpSettings[id].value[i]
}

beforeEach(() => {
  ;(globalThis as any).autoTrimpSettings = {}
})

/** Install one textValue setting record, exactly as createSetting would. */
function put(id: string, value: unknown) {
  ;(globalThis as any).autoTrimpSettings[id] = { id, type: 'textValue', value }
}

// The five per-zone (MAZ) textValue ids the three fixed readers touch. All are `textValue`, so
// getPageSetting returns `autoTrimpSettings[id].value` verbatim — the SAME reference, un-coerced.
const MAZ_IDS = [
  'Rtimefarmmap',
  'Rtimefarmspecial',
  'Rtimefarmgather',
  'Rdtimefarmmap',
  'Rdtimefarmspecial',
]

describe('#103 · equivalence: getPageSettingAt(id,i) === autoTrimpSettings[id].value[i]', () => {
  it('CONFIGURED player: identical for every id, at every zone index', () => {
    // A realistic MAZ blob: three configured zones, parallel arrays.
    const stores: Record<string, string[]> = {
      Rtimefarmmap: ['Void Map', '', 'Frozen Castle'],
      Rtimefarmspecial: ['lwc', 'smc', 'rc'],
      Rtimefarmgather: ['metal', 'wood', 'science'],
      Rdtimefarmmap: ['Bionic Wonderland', 'Trimple Of Doom', ''],
      Rdtimefarmspecial: ['sc', 'wc', 'lmc'],
    }
    for (const id of MAZ_IDS) put(id, stores[id])

    let compared = 0
    for (const id of MAZ_IDS) {
      for (let i = -1; i < 4; i++) {
        expect(utils.getPageSettingAt(id, i)).toBe(legacyDirectIndex(id, i))
        compared++
      }
    }
    // Anti-vacuous: a broken loop that compares nothing would otherwise pass.
    expect(compared).toBe(25)
    // …and the comparison is not trivially all-undefined: real values came back.
    expect(utils.getPageSettingAt('Rtimefarmspecial', 0)).toBe('lwc')
    expect(utils.getPageSettingAt('Rtimefarmgather', 2)).toBe('science')
  })

  it("UNCONFIGURED player, '' default (#100): identical — both read undefined", () => {
    for (const id of MAZ_IDS) put(id, '')
    for (const id of MAZ_IDS) {
      // -1 is what `zoneList.indexOf(world)` yields for an unconfigured zone — the real hot path.
      expect(utils.getPageSettingAt(id, -1)).toBe(legacyDirectIndex(id, -1))
      expect(utils.getPageSettingAt(id, -1)).toBeUndefined()
      expect(utils.getPageSettingAt(id, 0)).toBe(legacyDirectIndex(id, 0))
    }
  })

  it("VETERAN player, the STRING 'undefined' still in localStorage: identical — both read undefined", () => {
    // #68/#100: createSetting only applies a default when NOTHING is stored, and serializeSettings
    // round-trips unknown keys forever — so every veteran still carries the old 'undefined' string
    // default. This encoding can never be retired, and both readers must agree on it.
    for (const id of MAZ_IDS) put(id, 'undefined')
    for (const id of MAZ_IDS) {
      expect(utils.getPageSettingAt(id, -1)).toBe(legacyDirectIndex(id, -1))
      expect(utils.getPageSettingAt(id, -1)).toBeUndefined()
    }
    // NB the one asymmetry of the string encoding, unchanged by #103: index 0 of 'undefined' is 'u'.
    // Both readers say 'u'. That is pre-existing behavior, faithfully preserved — a zone can only be
    // at index 0 if the player configured the zone list, which means value is an array, not a string.
    expect(utils.getPageSettingAt('Rtimefarmmap', 0)).toBe(legacyDirectIndex('Rtimefarmmap', 0))
  })
})

describe('#103 · the divergence, and it is the point: the new reader cannot throw', () => {
  it('ABSENT key: the old form threw a TypeError, the new one reads as unset', () => {
    // loadPageVariables() drops the whole localStorage blob on without validation (#68), so a key
    // really can be missing at runtime.
    expect(() => legacyDirectIndex('Rtimefarmspecial', 0)).toThrow(TypeError)
    expect(utils.getPageSettingAt('Rtimefarmspecial', 0)).toBeUndefined()
    // getPageSetting's hasOwnProperty miss returns `false`, and false[0] is undefined — no throw.
    expect(utils.getPageSetting('Rtimefarmspecial')).toBe(false)
  })

  it('record present but `.value` never written: the old form threw, the new one reads as unset', () => {
    put('Rtimefarmgather', undefined)
    expect(() => legacyDirectIndex('Rtimefarmgather', 0)).toThrow(TypeError)
    expect(utils.getPageSettingAt('Rtimefarmgather', 0)).toBeUndefined()
  })

  it('`.value` is null: same — no throw', () => {
    put('Rdtimefarmmap', null)
    expect(() => legacyDirectIndex('Rdtimefarmmap', 0)).toThrow(TypeError)
    expect(utils.getPageSettingAt('Rdtimefarmmap', 0)).toBeUndefined()
  })
})

// `autoTrimpSettings.X.value[` or `autoTrimpSettings["X"].value[` — a direct indexed READ of the store.
const DIRECT_INDEX = /autoTrimpSettings(\.\w+|\[[^\]]+\])\.value\s*\[/

/** Strip `//` line comments so a comment ABOUT the banned shape is not itself an offender. */
function code(line: string): string {
  return line.replace(/^\s*(\/\/|\*|\/\*).*$/, '').replace(/\/\/.*$/, '')
}

describe('#103 · the net: no reader may index the settings store directly again', () => {
  // WHY A NET AND NOT THREE EDITS. #103's body named three sites (mapfunctions:441, jobs:580,
  // gather:310). This net — ten lines — found TEN more the issue never mentioned: the entire
  // tribute-farm family (RtributeFarm / RworkerRatios / RmanualLabor2, mirroring the time-farm one)
  // and ab.ts's `RABfarmstring.value[1]`, which sits in a function whose SIBLING already reads the
  // same id via getPageSetting()[0]. Where a bug class can be mechanized, mechanize it — a reading
  // pass instantiates the class it has itself named and still misses members of it.
  it('no src/ module indexes the settings store directly (MAZ.ts, the settings-window editor, excepted)', () => {
    // MAZ.ts is the exemption and the ONLY one: it is the settings-window EDITOR — it renders and
    // WRITES the per-zone rows, so it legitimately owns the raw record (and it writes as well as
    // reads, which getPageSetting cannot express). Every CONSUMER goes through getPageSettingAt.
    const { readdirSync, readFileSync } = require('node:fs') as typeof import('node:fs')
    const { join } = require('node:path') as typeof import('node:path')

    const dir = 'src/modules'
    const offenders: string[] = []
    let filesScanned = 0
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      if (f === 'MAZ.ts') continue // the editor — see above
      filesScanned++
      readFileSync(join(dir, f), 'utf8')
        .split('\n')
        .forEach((line, n) => {
          if (DIRECT_INDEX.test(code(line))) offenders.push(`${f}:${n + 1}: ${line.trim()}`)
        })
    }
    expect(offenders).toEqual([])
    // Anti-false-green: a walk that breaks collapses to ∅ and passes vacuously.
    expect(filesScanned).toBeGreaterThan(25)
  })

  it('anti-false-green: the pattern CAN still see an offender (positive control = MAZ.ts)', () => {
    // If DIRECT_INDEX silently stopped matching, the net above would pass for the wrong reason.
    // MAZ.ts is full of exactly the shape being banned, so it is a free positive control.
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    const hits = readFileSync('src/modules/MAZ.ts', 'utf8')
      .split('\n')
      .filter((l) => DIRECT_INDEX.test(code(l)))
    expect(hits.length).toBeGreaterThan(10)
  })
})
