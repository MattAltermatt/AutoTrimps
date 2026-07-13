// @vitest-environment jsdom
//
// #96 / #69 — THE RUNTIME TYPE CONTRACT for settings.
//
// A `createSetting` declares a TYPE. getPageSetting decodes by that type. Nothing anywhere checks that
// the DEFAULT it was declared with can survive that decode — so a sentinel written as a string quietly
// becomes a different thing entirely:
//
//     createSetting('Rhypofarmstack', …, 'multiValue', 'undefined', …)
//        → getPageSetting does Array.from(value).map(parseInt)
//        → Array.from('undefined') is NINE CHARACTERS
//        → the setting is [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN]                          (#96)
//
//     createSetting('Rhypostorage', …, 'boolean', 'false', …)
//        → 'false' is TRUTHY, and `==` never coerces it, so 'false' == true AND 'false' == false are
//          BOTH false — the setting's value depended on how each reader happened to test it          (#69)
//
// Neither is visible to tsc (the store is `any`), to lint, or to any behavioral test that does not
// happen to walk the poisoned branch. Both classes are closed here MECHANICALLY: every declared id is
// decoded through the real getPageSetting and its runtime type is checked against its declared type.
//
// ═══ WHY IT RUNS TWICE ═══════════════════════════════════════════════════════════════════════════
// The fresh-seed pass alone is HALF A NET, and the missing half is the half that matters. #69's first
// (naive) fix unquoted the declarations and repaired NOBODY: serializeSettings() flattens each setting
// to its bare value, so a five-year-old localStorage holds `{"Rhypostorage":"false"}` — a raw string,
// not a record — and on reload createSetting takes `value: loaded` and never consults `defaultValue`
// at all. The PERSISTED value is the load-bearing half. So the contract is asserted again after a real
// saveSettings() → loadPageVariables() → initializeAllSettings() round-trip, which is exactly the
// production boot order (AutoTrimps2.js:23 → settings-boot.ts:28).
//
// ═══ WHAT THIS NET CANNOT SEE ════════════════════════════════════════════════════════════════════
// It seeds a FRESH store, so it round-trips today's defaults — not a veteran's five-year-old blob. A
// player whose localStorage still carries the STRING 'undefined' for Rhypofarmstack will still decode
// to [NaN × 9] after this fix, and no default change can reach them. That is deliberate and it is safe:
// the CONSUMER was repaired first (mapfunctions.ts Rhypo, #96) so that every "unset" encoding — [NaN×9],
// [], [-1], absent — resolves to the same "no bonfire target". tests/mapfunctions.rhypo.test.ts is what
// actually protects those users; this net stops NEW instances of the class from being declared.

import { describe, it, expect, beforeAll } from 'vitest'

type Rec = { id: string; type: string; value?: unknown; enabled?: unknown; selected?: unknown; list?: unknown }
type Store = Record<string, Rec>
type Violation = string

let freshStore: Store
let roundTripStore: Store
let getPageSetting: (id: string) => unknown
let serialized: string
let provenance: { stack: unknown; pause: unknown }
/** ids whose type-arm in createSetting stores no record at all (infoclick/action early-return). */
const STATELESS = new Set(['infoclick', 'action'])

beforeAll(async () => {
  // Self-returning callable Proxy — every DOM stray in initializeAllSettings no-ops. Same idiom as
  // tests/settings-inventory.test.ts, which is the other test that has to execute all 571 defs.
  const anyEl: any = new Proxy(function () {}, { get: () => anyEl, apply: () => anyEl, set: () => true })
  document.getElementById = (() => anyEl) as typeof document.getElementById
  ;(globalThis as any).modifyParentNode = () => {}
  ;(globalThis as any).settingsProfileMakeGUI = () => {}
  ;(globalThis as any).game = { options: { menu: { darkTheme: { enabled: 0 } } } }
  ;(globalThis as any).ATversion = 'net-settings-types'

  // A real string-keyed/string-valued store. Node's own localStorage is gated behind
  // --localstorage-file and jsdom does not expose one here, so stand one up — the round-trip has to go
  // through an actual JSON *string* or it proves nothing (the flattening is the bug surface).
  const backing = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k: string, v: string) => void backing.set(k, String(v)),
    removeItem: (k: string) => void backing.delete(k),
  }

  const engine = await import('../../src/modules/settings-engine')
  const utils = await import('../../src/modules/utils')
  const { initializeAllSettings } = await import('../../src/modules/settings-defs')

  getPageSetting = utils.getPageSetting as typeof getPageSetting
  ;(globalThis as any).createSetting = engine.createSetting
  ;(globalThis as any).getPageSetting = utils.getPageSetting

  // ── Pass 1: a fresh install. Every setting takes its declared default. ──────────────────────────
  ;(globalThis as any).autoTrimpSettings = {}
  initializeAllSettings()
  freshStore = structuredClone((globalThis as any).autoTrimpSettings)

  // ── Pass 2: the round-trip. This is production's own boot order, and it is where a string default
  //    that survived pass 1 by luck gets a second chance to poison the store.
  serialized = utils.serializeSettings()
  localStorage.setItem('autoTrimpSettings', serialized)
  ;(globalThis as any).autoTrimpSettings = {} // simulate a page reload: the store starts empty
  utils.loadPageVariables() // → autoTrimpSettings is now the FLAT persisted blob
  initializeAllSettings() // → each createSetting rehydrates a record around its persisted value
  roundTripStore = structuredClone((globalThis as any).autoTrimpSettings)

  // ── Pass 3 (provenance): does pass 2 actually READ THE BLOB BACK, or is it just re-defaulting?
  //    Without this, deleting the loadPageVariables() call above would leave pass 2 a silent COPY of
  //    pass 1 — the net would still be green while testing the persisted half of the contract not at
  //    all, which is precisely the hole that made #69's first fix worthless. So: plant values that no
  //    default could produce, persist, wipe, reload. If they do not come back, pass 2 proves nothing.
  ;(globalThis as any).autoTrimpSettings = structuredClone(freshStore)
  ;(globalThis as any).autoTrimpSettings['Rhypofarmstack'].value = [7, 9]
  ;(globalThis as any).autoTrimpSettings['PauseScript'].enabled = true
  localStorage.setItem('autoTrimpSettings', utils.serializeSettings())
  ;(globalThis as any).autoTrimpSettings = {}
  utils.loadPageVariables()
  initializeAllSettings()
  provenance = {
    stack: getPageSetting('Rhypofarmstack'),
    pause: getPageSetting('PauseScript'),
  }
})

/** Assert `getPageSetting(id)`'s runtime type against `type`. Returns a violation string, or null. */
function checkType(id: string, type: string, v: unknown): Violation | null {
  const saw = (d: string) => `${id} (${type}) → ${d}`
  switch (type) {
    case 'boolean':
      return typeof v === 'boolean' ? null : saw(`${typeof v} ${JSON.stringify(v)}`)
    case 'value':
    case 'valueNegative':
    case 'multitoggle':
      if (typeof v !== 'number') return saw(`${typeof v} ${JSON.stringify(v)}`)
      return Number.isNaN(v) ? saw('NaN') : null
    case 'multiValue': {
      if (!Array.isArray(v)) return saw(`${typeof v} ${JSON.stringify(v)}`)
      const bad = v.some((x) => typeof x !== 'number' || Number.isNaN(x))
      // JSON.stringify renders NaN as null — spell the array out so the report is readable.
      return bad ? saw(`[${v.map((x) => (Number.isNaN(x) ? 'NaN' : String(x))).join(', ')}]`) : null
    }
    case 'textValue':
      return typeof v === 'string' ? null : saw(`${typeof v} ${JSON.stringify(v)}`)
    case 'dropdown':
      return typeof v === 'string' ? null : saw(`${typeof v} ${JSON.stringify(v)}`)
    default:
      return saw(`unknown declared type '${type}'`)
  }
}

/**
 * Run `fn` with `store` installed as the live `autoTrimpSettings`.
 *
 * ⚠️ Load-bearing. getPageSetting reads the GLOBAL store, not whatever object you hand it — so a
 * `violations(freshStore)` that forgets to install `freshStore` silently decodes the OTHER store and
 * reports on it. The two stores agree today, so that bug would have been invisible: a net asserting
 * the same thing twice while claiming to assert two things. Caught by asking "what does getPageSetting
 * actually read?", not by any test.
 */
function withStore<T>(store: Store, fn: () => T): T {
  const saved = (globalThis as any).autoTrimpSettings
  ;(globalThis as any).autoTrimpSettings = store
  try {
    return fn()
  } finally {
    ;(globalThis as any).autoTrimpSettings = saved
  }
}

function violations(store: Store): Violation[] {
  return withStore(store, () => {
    const out: Violation[] = []
    for (const id of Object.keys(store)) {
      const rec = store[id]
      // ATversion is a bare string stamped into the store by createSetting — not a setting.
      if (id === 'ATversion' || !rec || typeof rec !== 'object' || typeof rec.type !== 'string') continue
      const bad = checkType(id, rec.type, getPageSetting(id))
      if (bad) out.push(bad)
    }
    return out
  })
}

// ═══ THE SHRINKING BASELINE ═══════════════════════════════════════════════════════════════════════
// A fix queue, not an allowlist. It may only get SMALLER (guarded below). Every entry is a CONFIRMED
// live type violation with a disposition. It is EMPTY for the two type-arms this net was written for —
// #69 emptied the boolean arm, #96 emptied the multiValue arm — and it must stay that way.
const KNOWN_TYPE_VIOLATION: Record<string, string> = {
  // ✅ EMPTY. The three #96 offenders (Rhypofarmstack 'undefined' → [NaN×9], Rinsanityfarmcell '-1' →
  // [NaN,1], Ralchfarmcell '[-1]' → [NaN,NaN,1,NaN]) are FIXED, and the 36 #69 booleans before them.
  // If you are about to park something here: the entry is a promise to come back. Prefer fixing it.
}

// ═══ THE STRING-SENTINEL BASELINE — ✅ EMPTIED BY #100 ═══════════════════════════════════════════
// `textValue` settings decode to a string, so a default of 'undefined' was TYPE-legal — and still a bug:
// every guard of the form `getPageSetting('highdmg') != undefined` was a TAUTOLOGY, because the string
// 'undefined' is not the value undefined. Same root cause as #96, different arm, invisible to the type
// contract above. This net enumerated 27 of them (the review had reported 3 — which is the argument for
// mechanizing a class instead of reading for it).
//
// All 27 are FIXED. The order was load-bearing and is worth keeping written down:
//   1. The CONSUMERS first — `utils.textSettingIsSet()` is now the one spelling, and it accepts EVERY
//      encoding of unset ('undefined' | '' | false | undefined). Flipping the defaults first would have
//      been an active regression: archstring() gated on `!= "undefined"`, which is TRUE for '', so it
//      would have written `game.global.archString = ''` into the live game for every unconfigured player.
//   2. THEN the defaults ('undefined' → '').
//   3. Then this baseline, to zero.
// The string encoding can NEVER be retired — a veteran's localStorage still carries it and createSetting
// only applies a default when nothing is stored (#68). tests/nets/settings-unset-encodings.test.ts is
// what protects those users; the assertion below is what stops a NEW one being declared.
const KNOWN_STRING_SENTINEL: Record<string, string> = {
  // ✅ EMPTY (#100). Was 27: 10 MAZ selections, 14 heirloom names, 3 archaeology strings.
  // If you are about to park something here: the entry is a promise to come back. Prefer fixing it.
}

describe('settings runtime type contract · fresh install (#96)', () => {
  it('anti-false-green: the store really is fully populated and every arm has members', () => {
    // If any of these collapse, every assertion below passes vacuously. This is the #66 failure mode.
    const recs = Object.values(freshStore).filter((r) => r && typeof r === 'object' && r.type)
    expect(recs.length).toBeGreaterThan(500)
    const byType = new Map<string, number>()
    for (const r of recs) byType.set(r.type, (byType.get(r.type) ?? 0) + 1)
    // Pinned counts: a type-arm that silently empties would make its contract untested.
    expect([...byType.entries()].sort()).toMatchInlineSnapshot(`
      [
        [
          "boolean",
          157,
        ],
        [
          "dropdown",
          37,
        ],
        [
          "multiValue",
          63,
        ],
        [
          "multitoggle",
          54,
        ],
        [
          "textValue",
          29,
        ],
        [
          "value",
          206,
        ],
        [
          "valueNegative",
          4,
        ],
      ]
    `)
    // …and the decoder under test is the real one, reached through the real store. (Note the withStore
    // wrapper: getPageSetting reads the GLOBAL store, and beforeAll leaves the PROVENANCE store
    // installed. Reading `freshStore` without installing it is the exact false-green withStore exists
    // to prevent — and it is how this very assertion was first written.)
    expect(withStore(freshStore, () => getPageSetting('Rhypofarmzone'))).toEqual([-1])
    expect(withStore(freshStore, () => getPageSetting('PauseScript'))).toBe(false)
  })

  it('anti-false-green: the checker CAN see each poison it is meant to catch', () => {
    // A contract that cannot go red is not a contract. Exercise every arm's failure mode directly.
    expect(checkType('X', 'multiValue', [NaN, 1])).toBe('X (multiValue) → [NaN, 1]')
    expect(checkType('X', 'multiValue', 'undefined')).toBe('X (multiValue) → string "undefined"')
    expect(checkType('X', 'boolean', 'false')).toBe('X (boolean) → string "false"')
    expect(checkType('X', 'value', NaN)).toBe('X (value) → NaN')
    expect(checkType('X', 'multitoggle', '2')).toBe('X (multitoggle) → string "2"')
    expect(checkType('X', 'textValue', 3)).toBe('X (textValue) → number 3')
    // …and that it PASSES the well-formed shapes (an always-red checker is just as useless).
    expect(checkType('X', 'multiValue', [-1])).toBeNull()
    expect(checkType('X', 'boolean', false)).toBeNull()
    expect(checkType('X', 'value', -1)).toBeNull()
  })

  it("every setting's decoded value matches its declared type", () => {
    const live = violations(freshStore).filter((v) => !(v.split(' ')[0] in KNOWN_TYPE_VIOLATION))
    expect(live).toEqual([])
  })

  it('stateless control kinds (infoclick / action) store no record at all', () => {
    // createSetting early-returns for these, so getPageSetting returns the literal `false`. Any code
    // reading one is reading a phantom — pin the shape so a future "let's store them too" is reviewed.
    for (const id of Object.keys(freshStore)) {
      const t = freshStore[id]?.type
      if (typeof t === 'string') expect(STATELESS.has(t)).toBe(false)
    }
    expect(withStore(freshStore, () => getPageSetting('Rhypofarmmaz'))).toBe(false) // infoclick — never stored
  })
})

describe('settings runtime type contract · after a saveSettings → loadPageVariables round-trip (#69/#96)', () => {
  it('anti-false-green: loadPageVariables is LOAD-BEARING — the blob is really read back', () => {
    // Planted in beforeAll, persisted, wiped, reloaded. A default can never produce these, so if
    // loadPageVariables() were removed (or silently no-opped) these would come back as [-1] / false and
    // this test — alone — would catch it. Everything else in pass 2 would stay green.
    expect(provenance.stack).toEqual([7, 9])
    expect(provenance.pause).toBe(true)
    // …and they are genuinely different from the defaults, or the assertion above proves nothing.
    expect(withStore(freshStore, () => getPageSetting('Rhypofarmstack'))).toEqual([-1])
    expect(withStore(freshStore, () => getPageSetting('PauseScript'))).toBe(false)
  })

  it('anti-false-green: the round-trip REALLY round-tripped', () => {
    // Without this, pass 2 could be a silent copy of pass 1 and the whole point of the net evaporates.
    // 1. The store was genuinely rebuilt from a flat JSON blob, not carried over by reference.
    expect(roundTripStore).not.toBe(freshStore)
    expect(serialized.length).toBeGreaterThan(5000)
    // 2. serializeSettings FLATTENS: the persisted blob holds bare values, not records. This is the
    //    exact property that made #69's naive fix useless, so it is pinned by name.
    const blob = JSON.parse(serialized)
    expect(blob['PauseScript']).toBe(false) // a bare boolean, NOT { type: 'boolean', enabled: false }
    expect(blob['Rhypofarmstack']).toEqual([-1]) // a bare array
    expect(typeof blob['ATversion']).toBe('string')
    // 3. …and createSetting rehydrated a full record around each of those bare values.
    expect(roundTripStore['PauseScript']).toMatchObject({ id: 'PauseScript', type: 'boolean' })
    expect(roundTripStore['Rhypofarmstack']).toMatchObject({ id: 'Rhypofarmstack', type: 'multiValue' })
  })

  it("every setting's decoded value STILL matches its declared type after persistence", () => {
    const live = violations(roundTripStore).filter((v) => !(v.split(' ')[0] in KNOWN_TYPE_VIOLATION))
    expect(live).toEqual([])
  })

  it('persistence is lossless — the round-tripped store decodes identically to the fresh one', () => {
    const decode = (store: Store) =>
      withStore(store, () => {
        const out: Record<string, unknown> = {}
        for (const id of Object.keys(store)) if (store[id]?.type) out[id] = getPageSetting(id)
        return out
      })
    expect(decode(roundTripStore)).toEqual(decode(freshStore))
  })
})

describe('the baselines only shrink — they are fix queues, not allowlists', () => {
  it('KNOWN_TYPE_VIOLATION is empty, and every entry (if any) is still a real violation', () => {
    const live = new Set(violations(freshStore).concat(violations(roundTripStore)).map((v) => v.split(' ')[0]))
    for (const id of Object.keys(KNOWN_TYPE_VIOLATION))
      expect(live.has(id), `'${id}' no longer violates its type — delete it from KNOWN_TYPE_VIOLATION`).toBe(true)
    // The ceiling. #69 emptied the boolean arm; #96 emptied the multiValue arm. Parking a NEW one here
    // costs a source edit that a reviewer will see — which is the point.
    expect(Object.keys(KNOWN_TYPE_VIOLATION).length).toBe(0)
  })

  it("KNOWN_STRING_SENTINEL entries are all real textValue settings still defaulting to 'undefined'", () => {
    withStore(freshStore, () => {
      for (const id of Object.keys(KNOWN_STRING_SENTINEL)) {
        expect(freshStore[id]?.type, `'${id}' is not a textValue any more — re-triage it`).toBe('textValue')
        expect(
          getPageSetting(id),
          `'${id}' no longer defaults to the string 'undefined' — delete it from KNOWN_STRING_SENTINEL`,
        ).toBe('undefined')
      }
    })
    expect(Object.keys(KNOWN_STRING_SENTINEL).length).toBe(0) // #100 emptied it. The ceiling is now zero.
  })

  it("no NEW textValue setting defaults to the string 'undefined'", () => {
    const offenders = withStore(freshStore, () =>
      Object.keys(freshStore)
        .filter((id) => freshStore[id]?.type === 'textValue')
        .filter((id) => getPageSetting(id) === 'undefined')
        .filter((id) => !(id in KNOWN_STRING_SENTINEL)),
    )
    expect(offenders).toEqual([])
  })
})
