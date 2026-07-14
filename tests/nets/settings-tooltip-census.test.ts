// #107 — THE RENDERED TOOLTIP CENSUS.
//
// This does NOT exist to catch someone editing a description: the settings-defs diff already shows that.
// It exists to catch the edit that shows up NOWHERE in a diff — a change to `tip()`'s renderer or to the
// derived `Default:` footer, either of which silently rewrites all 574 tooltips at once. That is exactly
// the class of change a reviewer nods through ("it's a one-line helper tweak") and exactly the class that
// last time shipped `RVoidMaps` with no tooltip at all.
//
// So the snapshot is of the FULLY COMPOSED text every setting actually shows the user, not the source
// strings. Changing the composer moves 574 lines of snapshot, which is precisely the review signal.
import { describe, it, expect, beforeAll } from 'vitest'

/** id -> the fully composed description the user is shown (facets + derived footer). */
const rendered = new Map<string, string>()

function makeEl(tag = 'div'): any {
  const attrs: Record<string, string> = {}
  const anyEl: any = new Proxy(function () {}, { get: () => anyEl, apply: () => anyEl, set: () => true })
  const real: any = {
    tag, id: '', className: '', textContent: '', value: '', childNodes: [] as any[],
    setAttribute(k: string, v: string) {
      attrs[k] = v
      if (k === 'onmouseover' && real.id) {
        // Recover the composed body: it is the 4th argument of tooltip(...), a JS string literal. Slicing
        // between the last `, "` and the trailing `")` is exact here because the seam builds the call
        // itself — and any malformed handler is already a hard failure in settings-tooltips.test.ts.
        const m = v.match(/^tooltip\(.*, "customText", event, "(.*)"\)$/s)
        if (m) rendered.set(real.id, m[1])
      }
    },
    getAttribute: (k: string) => attrs[k],
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
  ;(globalThis as any).ATversion = 'net-tooltip-census'
  ;(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  ;(globalThis as any).autoTrimpSettings = {}

  const engine = await import('../../src/modules/settings-engine')
  const utils = await import('../../src/modules/utils')
  const { initializeAllSettings } = await import('../../src/modules/settings-defs')
  ;(globalThis as any).createSetting = engine.createSetting
  ;(globalThis as any).getPageSetting = utils.getPageSetting

  initializeAllSettings()
})

describe('rendered settings tooltips (#107)', () => {
  it('anti-false-green: the catalog mounted and every tooltip body was recovered', () => {
    // If the regex above ever stops matching, `rendered` collapses to ∅ and the snapshot below would
    // happily "pass" as an empty map — certifying the corpus while seeing none of it.
    expect(rendered.size).toBeGreaterThan(500)
  })

  it('every setting shows a non-empty description', () => {
    // Three settings shipped with an EMPTY description until #106. An empty tooltip is a control with no
    // explanation at all — the failure that started this issue.
    const blank = [...rendered.entries()].filter(([, body]) => body.trim() === '').map(([id]) => id).sort()
    expect(blank).toEqual([])
  })

  it('no description hand-writes its own default — the seam derives it', () => {
    // The "Default: x" line is composed from createSetting's own defaultValue arg. A description that ALSO
    // spells out its default has created a second copy, and second copies drift: that is how "recommend
    // -1" outlived the code it described. Catch the reintroduction, not just the current instances.
    const selfDeclared = [...rendered.entries()]
      .filter(([, body]) => /(^|>|\s)Default:\s/i.test(body.replace(/<br><br><i>Default: [^<]*<\/i>$/, '')))
      .map(([id]) => id).sort()
    expect(selfDeclared).toEqual([])
  })

  it('census: the composed text of every setting', () => {
    const census = [...rendered.entries()].sort(([a], [b]) => a.localeCompare(b))
    expect(Object.fromEntries(census)).toMatchSnapshot()
  })
})
