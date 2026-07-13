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
  // infoclick settings act through their defaultValue, which settings-engine.ts wires straight into
  // an onclick="ImportExportTooltip('<defaultValue>', 'update')" — there is no getPageSetting read.
  DefaultAutoTrimps: 'infoclick — behavior comes from defaultValue, not a settings read',
}

describe('every setting the UI renders is actually wired to code (#65)', () => {
  const defsSrc = readFileSync(join(ROOT, DEFS), 'utf8')
  const ids = [...defsSrc.matchAll(/createSetting\(\s*'([^']+)'/g)].map((m) => m[1])

  const corpus = sourceFiles('src')
    .concat(sourceFiles('legacy'))
    .filter((f) => f !== DEFS)
    .map((f) => readFileSync(join(ROOT, f), 'utf8'))
    .join('\n')

  it('parses the full settings inventory (guards against the regex silently matching nothing)', () => {
    expect(ids.length).toBeGreaterThan(500)
    expect(new Set(ids).size).toBe(ids.length) // no duplicate ids
  })

  it('no setting is defined-but-never-read', () => {
    const unread = ids.filter((id) => {
      if (id in ALLOWED_UNREAD) return false
      const quoted = new RegExp(`['"\`]${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`)
      return !quoted.test(corpus)
    })
    expect(unread).toEqual([])
  })

  it('the allowlist stays honest — an allowlisted id that IS read should leave the allowlist', () => {
    for (const id of Object.keys(ALLOWED_UNREAD)) {
      const quoted = new RegExp(`['"\`]${id}['"\`]`)
      expect(quoted.test(corpus), `${id} is now read; drop it from ALLOWED_UNREAD`).toBe(false)
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
