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
