import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

// #65 — the "setting exists in the UI but is wired to nothing" net.
//
// Three real bugs of this shape shipped to users before this test existed:
//   #63  needGymystic — a flag read by setScienceNeeded that nothing ever set false.
//   #64  ManualGather2 = 3 / RManualGather2 = 2 — selectable options the dispatcher never routed,
//        so picking them silently disabled ALL gather automation.
//   #65  SpamNature — createSetting'd, rendered as a live checkbox, but read by no code at all, so
//        debug(..., 'nature') fell through utils.ts's switch and always printed.
//
// A setting that createSetting() renders as a control the user can click, but that no code ever
// reads, is a lie told to the user. This test asserts every createSetting id is read somewhere.
// It cannot catch an option INDEX that no branch handles (that's #64's shape) — see the sibling
// assertion below for the gather dispatchers specifically.

const ROOT = resolve(__dirname, '..')
const DEFS = 'src/modules/settings-defs.ts'

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) sourceFiles(rel, acc)
    else if (/\.(ts|js)$/.test(e.name)) acc.push(rel)
  }
  return acc
}

// Settings that legitimately have no getPageSetting/autoTrimpSettings read.
const ALLOWED_UNREAD: Record<string, string> = {
  // Not a toggle: a Windstacking-tab section header/signage pseudo-button. Its description literally
  // reads "These settings are for fillers ONLY."
  windstackingfiller: 'signage pseudo-button, not a functional toggle',
  // #117 — "Turn WS On!" reads as dead (no code reads its value) but is SIGNAGE, and deleting it would
  // remove a real affordance. settings-visibility.ts renders it ONLY when `!wson`, i.e. exactly when
  // AutoStance is not Windstacking — which is exactly when every other control on that tab is hidden.
  // It exists to explain WHY the tab is empty and where the real switch is (Combat -> AutoStance).
  // Same class as windstackingfiller above; same idea as the #115 warning border on ATGA2timer.
  turnwson: 'signage pseudo-button — shown only while Windstacking is OFF, to explain the empty tab',
  // infoclick settings act through their defaultValue, which settings-engine.ts wires straight into
  // an onclick="ImportExportTooltip('<defaultValue>', 'update')" — there is no getPageSetting read.
  DefaultAutoTrimps: 'infoclick — behavior comes from defaultValue, not a settings read',
}

// -------------------------------------------------------------------------------------------------
// #120 — A MENTION IS NOT A READ.
//
// This net used to ask `/['"`]<id>['"`]/.test(corpus)` — "is this id quoted ANYWHERE?" That is not the
// question. The net's job is to prove a setting is READ, and two things satisfied a bare mention with
// no read at all:
//
//   1. `turnOn("turnwson")` in settings-visibility.ts — a VISIBILITY mention. The control is shown and
//      hidden correctly; nothing ever looks at its value.
//   2. The two frozen serializeSettings preset blobs (utils.ts:51, :54) — giant JSON strings naming
//      ~200 setting ids ("buynojobsc":true). They sit inside this net's own corpus, so every id they
//      name auto-passed the check that was supposed to prove it was wired.
//
// That is how `turnwson` and `buynojobsc` (#117) stayed dead inside the net built to find exactly them.
//
// So: ask for a real read. The catch — and the reason the loose form was written in the first place —
// is that ~50 settings are read through DYNAMICALLY CONSTRUCTED ids, and a naive literal-read check
// goes red on all of them. Those constructions are enumerated below, each resolved to the exact ids it
// reaches, so they are ACCOUNTED FOR rather than excused.
// -------------------------------------------------------------------------------------------------

/** Ids reached by a dynamic getPageSetting(...) — each entry names the callsite that builds them. */
function dynamicallyReadIds(ids: string[], corpus: string): Map<string, string> {
  const reached = new Map<string, string>()
  const claim = (id: string, why: string) => { if (ids.includes(id)) reached.set(id, why) }

  // buildings.ts:123,170 — `getPageSetting('Max' + b)` over the housing list.
  for (const b of ['Hut', 'House', 'Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector', 'Warpstation'])
    for (const p of ['', 'R']) claim(`${p}Max${b}`, `buildings.ts — getPageSetting('Max' + '${b}')`)

  // other.ts:627-631 — the shrine table: getPageSetting(shrineSettings[universe][mode].<field>).
  for (const fam of ['Hshrine', 'Hdshrine', 'Rshrine', 'Rdshrine'])
    for (const f of ['', 'zone', 'cell', 'amount', 'charge'])
      claim(fam + f, 'other.ts — getPageSetting(shrineSettings[universe][mode].<field>)')

  // MAZ.ts popup editors address their rows through a table; the '*maz' ids are the popup handles.
  for (const id of ids)
    if (/maz$/i.test(id) && new RegExp(`['"\`]${id}['"\`]`).test(corpus))
      claim(id, 'MAZ.ts — popup editor row, addressed through its table')

  return reached
}

/**
 * Strip the two constructs that FAKE a read, then any surviving quoted use is a genuine one.
 *
 * Matching the read syntactically does not work: AT reaches settings through real indirections —
 *   mapfunctions.ts:444  getPageSettingAt(daily ? 'Rdtimefarmmap' : 'Rtimefarmmap', i)   (ternary)
 *   other-praiding.ts:1206  maxPraidZSetting = 'MaxPraidZone'; … getPageSetting(maxPraidZSetting)  (variable)
 *   MAZ.ts:40  gather = 'Rdtimefarmgather'                                                (table key)
 * — so a `getPageSetting\(\s*'id'` regex reports ~7 live settings as dead, and chasing it properly
 * means dataflow analysis. Subtracting the liars is both simpler and stricter than what was there.
 */
function readableCorpus(files: string[], contents: string[]): string {
  return contents
    .map((src, i) => {
      const rel = files[i]
      // utils.ts:51,54 — the two FROZEN serializeSettings preset blobs: JSON strings naming ~200 ids.
      // They are persistence fixtures, not code that reads anything. Any id they name used to auto-pass.
      if (rel.endsWith('utils.ts')) src = src.replace(/return '\{".*?\}';/gs, "return '{}';")
      // settings-visibility.ts — turnOn/turnOff mention an id to SHOW or HIDE its control. That proves
      // the control renders, not that anything reads its value. `turnwson` (#117) hid in exactly this.
      src = src.replace(/turn(On|Off)\(\s*["'`][^"'`]+["'`]\s*\)/g, 'turnX()')
      return src
    })
    .join('\n')
}

/** A genuine use of the setting — not a visibility toggle, not a mention in a frozen preset blob. */
function isRead(id: string, corpus: string): boolean {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    // quoted anywhere in real code: getPageSetting('id'), a ternary, a table value, a variable assignment…
    `['"\`]${esc}['"\`]` +
      // …or an UNQUOTED record property access: `autoTrimpSettings.zonetracker` (AutoTrimps2.js:188).
      `|autoTrimpSettings\\.${esc}\\b`,
  ).test(corpus)
}

describe('every setting the UI renders is actually wired to code (#65)', () => {
  const defsSrc = readFileSync(join(ROOT, DEFS), 'utf8')
  const ids = [...defsSrc.matchAll(/createSetting\(\s*'([^']+)'/g)].map((m) => m[1])

  const files = sourceFiles('src').concat(sourceFiles('legacy')).filter((f) => f !== DEFS)
  const rawCorpus = files.map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n')
  // #120 — the corpus the read-check runs against, with the two liars removed.
  const corpus = readableCorpus(files, files.map((f) => readFileSync(join(ROOT, f), 'utf8')))

  /**
   * 'action' and 'infoclick' settings are BUTTONS. settings-engine.ts wires their behaviour from the
   * `defaultValue` argument straight into an onclick — there is no getPageSetting read, by design, and
   * there never will be. Excluded BY TYPE rather than by name, so a new button cannot land on a
   * hand-maintained allowlist and a renamed one cannot fall off it.
   */
  // NB: parsed per-call, NOT with a lazy `[\s\S]*?` between the id and the type. A lazy span runs PAST a
  // non-button setting into the next button's type token and consumes it, so the button silently drops
  // out of the set. (It did: every `*maz` infoclick went missing.) A regex that can skip a setting is
  // how a net starts lying — bound the scan to the one call.
  const BUTTON_IDS = new Set(
    [...defsSrc.matchAll(/createSetting\(\s*'([^']+)'((?:(?!createSetting\()[\s\S])*?),\s*'(action|infoclick)'\s*,/g)]
      .map((m) => m[1]),
  )

  it('parses the full settings inventory (guards against the regex silently matching nothing)', () => {
    expect(ids.length).toBeGreaterThan(500)
    expect(new Set(ids).size).toBe(ids.length) // no duplicate ids
  })

  const DYNAMIC = dynamicallyReadIds(ids, corpus)

  it('anti-false-green: the read-detector can tell a real read from a mere mention (#120)', () => {
    // Both liars EXIST in the raw corpus — assert that first, or the checks below could pass simply
    // because the text was never there.
    expect(/turnOn\("turnwson"\)/.test(rawCorpus)).toBe(true) // the visibility toggle is real…
    expect(rawCorpus).toContain('"buynojobsc":true') //          …and so is the frozen-blob mention.
    // …and NEITHER survives into the corpus the read-check runs against.
    //
    // Note buynojobsc is now genuinely READ (#117 wired it), so it can no longer serve as the example of
    // a blob-only mention. Assert the STRIPPING itself instead — that is the property, and it does not
    // rot when a setting's wiring changes underneath it.
    expect(corpus).not.toContain('"buynojobsc":true') // the frozen preset blob is gone from the corpus
    expect(corpus).not.toContain('turnOn("turnwson")') // …and so is every visibility toggle
    expect(isRead('turnwson', corpus)).toBe(false) // still signage: rendered, never read (ALLOWED_UNREAD)
    // A REAL read still resolves — otherwise the stripping is over-broad and the net is now blind.
    expect(isRead('AutoStance', corpus)).toBe(true)
    expect(isRead('MaxPraidZone', corpus)).toBe(true) // via `maxPraidZSetting = 'MaxPraidZone'`
    expect(isRead('Rtimefarmmap', corpus)).toBe(true) // via a ternary inside getPageSettingAt(...)
    // The dynamic families resolve, or this net would be red for ~50 legitimate settings.
    expect(DYNAMIC.size).toBeGreaterThan(30)
    expect(DYNAMIC.has('MaxHut')).toBe(true) // getPageSetting('Max' + b)
    expect(DYNAMIC.has('Hdshrinezone')).toBe(true) // getPageSetting(shrineSettings[u][m].zone)
    // Buttons are excluded by TYPE, not by name.
    expect(BUTTON_IDS.has('CleanupAutoTrimps')).toBe(true)
    expect(BUTTON_IDS.has('AutoStance')).toBe(false)
  })

  /**
   * The shrinking baseline: settings that are CONFIRMED dead and are awaiting a product decision (#117).
   * This is a fix queue, not an allowlist — a NEW dead setting fails on arrival, and fixing one of these
   * turns the net RED until its entry is deleted (guard below).
   *
   * Both are features that were never wired, not code to delete casually: removing a createSetting
   * changes the ordered id list, which is the persistence contract.
   */
  // ✅ EMPTY — #117 is CLOSED, and both entries left for opposite reasons:
  //   buynojobsc  WIRED (jobs.ts). It was a real feature nobody built: rendered, saved, dispatching
  //               nothing. It now stops F/L/M hiring during a Challenge². Opt-in, default off.
  //   turnwson    NOT dead — it is SIGNAGE, and moved to ALLOWED_UNREAD above. "No reads" was true and
  //               misleading: it renders only while Windstacking is OFF, to explain the empty tab.
  //               Reference-counting told me it was dead; reading the visibility rule told me why it
  //               exists. Deleting it would have destroyed a real affordance to satisfy a metric.
  const KNOWN_DEAD: Record<string, string> = {}

  it('no setting is defined-but-never-read', () => {
    const unread = ids.filter(
      (id) =>
        !(id in ALLOWED_UNREAD) &&
        !(id in KNOWN_DEAD) &&
        !DYNAMIC.has(id) &&
        !BUTTON_IDS.has(id) &&
        !isRead(id, corpus),
    )
    expect(unread).toEqual([])
  })

  it('the baseline only ever SHRINKS — wire or remove one of these and delete its entry', () => {
    for (const [id, why] of Object.entries(KNOWN_DEAD)) {
      expect(isRead(id, corpus), `${id} is now read (${why}) — delete it from KNOWN_DEAD`).toBe(false)
      expect(ids, `${id} no longer exists — delete it from KNOWN_DEAD`).toContain(id)
    }
  })

  it('the allowlist stays honest — an allowlisted id that IS read should leave the allowlist', () => {
    for (const id of Object.keys(ALLOWED_UNREAD)) {
      expect(isRead(id, corpus), `${id} is now read; drop it from ALLOWED_UNREAD`).toBe(false)
    }
  })
})

describe('no numeric setting is compared against a label string (#65)', () => {
  // getPageSetting() on a multitoggle returns the option's numeric INDEX, never its label. Comparing
  // one to a label string is therefore always true / never true. portal.ts:233+450 did exactly this —
  // `getPageSetting('typetokeep') != 'None'` — where 'None' is typetokeep's option 0. The guard was
  // meant to stop autoheirlooms3() from running with no type selected; it never fired, so enabling
  // Auto Heirlooms with the default typetokeep un-carried every heirloom (autoheirlooms3 strips all
  // carried heirlooms first, then re-carries per typetokeep — and index 0 has no carry branch).
  const defsSrc = readFileSync(join(ROOT, DEFS), 'utf8')
  // A createSetting whose 2nd arg is an array literal is a multitoggle → numeric-valued.
  const numericIds = new Set(
    [...defsSrc.matchAll(/createSetting\(\s*'([^']+)'\s*,\s*\[/g)].map((m) => m[1]),
  )

  it('finds the multitoggle inventory (guards against the regex matching nothing)', () => {
    expect(numericIds.size).toBeGreaterThan(40)
    expect(numericIds.has('typetokeep')).toBe(true)
  })

  it('no getPageSetting(<multitoggle>) is compared to a string literal', () => {
    const offenders: string[] = []
    for (const rel of sourceFiles('src').concat(sourceFiles('legacy'))) {
      if (rel === DEFS) continue
      readFileSync(join(ROOT, rel), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(
            /getPageSetting\(\s*'([^']+)'\s*\)\s*(===|!==|==|!=)\s*'([^']*)'/g,
          )) {
            if (numericIds.has(m[1]))
              offenders.push(`${rel}:${i + 1} getPageSetting('${m[1]}') ${m[2]} '${m[3]}'`)
          }
        })
    }
    expect(offenders).toEqual([])
  })
})

describe('gather dispatchers route every selectable option (#64)', () => {
  // The #64 shape: an option index the dispatcher never mentions runs NO handler, so setGather() is
  // never called and playerGathering freezes wherever it was. Pin the routing explicitly.
  const at2 = readFileSync(join(ROOT, 'legacy/AutoTrimps2.js'), 'utf8')
  const defsSrc = readFileSync(join(ROOT, DEFS), 'utf8')

  const optionCount = (id: string) => {
    const m = defsSrc.match(new RegExp(`createSetting\\(\\s*'${id}'\\s*,\\s*\\[([^\\]]*)\\]`))
    if (!m) throw new Error(`no multitoggle option array found for ${id}`)
    return m[1].split(',').length
  }

  it('ManualGather2: all 4 options (0=off, 1, 2, 3) are accounted for', () => {
    expect(optionCount('ManualGather2')).toBe(4)
    // 0 = "Manual Gather/Build" = deliberately do nothing.
    expect(at2).toMatch(/getPageSetting\('ManualGather2'\) == 1 \|\| getPageSetting\('ManualGather2'\) == 3\) manualLabor2\(\)/)
    expect(at2).toMatch(/getPageSetting\('ManualGather2'\) == 2\) autogather3\(\)/)
  })

  it('RManualGather2: all 3 options (0=off, 1, 2) are accounted for', () => {
    expect(optionCount('RManualGather2')).toBe(3)
    expect(at2).toMatch(/getPageSetting\('RManualGather2'\) == 1 \|\| getPageSetting\('RManualGather2'\) == 2\) RmanualLabor2\(\)/)
  })
})

describe('every U1/U2 twin setting appears in the visibility table (#109)', () => {
  // #109's shape: #106 minted ScientistPercent + RScientistPercent — a U1/U2 twin PAIR sharing one
  // label ("Scientist %") — but added only the U1 id to settingsVisibility()'s turnOn/turnOff table.
  // turnOff was therefore never called on the U2 box, so a U1 player saw "Scientist %" TWICE, one of
  // which does nothing in their universe. The bug is invisible to every other net: both ids are
  // createSetting'd, both are read, both have live consumers. Only the RENDER is wrong.
  //
  // The invariant this pins: if a setting has a twin (X and RX both exist), the two are
  // universe-exclusive by construction, so BOTH must be routed through the visibility table —
  // otherwise one of them is unconditionally visible in a universe where it is inert.
  const defsSrc = readFileSync(join(ROOT, DEFS), 'utf8')
  const visSrc = readFileSync(join(ROOT, 'src/modules/settings-visibility.ts'), 'utf8')

  const ids = [...defsSrc.matchAll(/createSetting\(\s*'([^']+)'/g)].map((m) => m[1])
  const shown = new Set([...visSrc.matchAll(/turn(?:On|Off)\(\s*["']([A-Za-z0-9_]+)["']\s*\)/g)].map((m) => m[1]))

  const idSet = new Set(ids)
  const twins = ids.filter((id) => idSet.has('R' + id))

  it('finds the twin pairs at all (anti-false-green: an empty walk passes vacuously)', () => {
    expect(twins.length).toBeGreaterThan(50)
    expect(shown.size).toBeGreaterThan(400)
  })

  it('both halves of every twin pair are routed through turnOn/turnOff', () => {
    const offenders: string[] = []
    for (const u1 of twins) {
      for (const id of [u1, 'R' + u1]) if (!shown.has(id)) offenders.push(id)
    }
    expect([...new Set(offenders)]).toEqual([])
  })
})
