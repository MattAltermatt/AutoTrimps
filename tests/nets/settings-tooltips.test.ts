// #110 — EVERY SETTING'S TOOLTIP MUST BE A COMPILABLE HANDLER.
//
// createSetting builds its tooltip as an HTML attribute holding a JS call whose last argument is a
// DOUBLE-QUOTED string literal:
//
//     onmouseover="tooltip("<name>", "customText", event, "<description>")"
//
// so a single raw `"` anywhere in a description CLOSES that literal early. The browser then fails to
// COMPILE the handler and silently leaves `el.onmouseover === null`. Nothing throws. The control still
// renders, still clicks, still saves — only its tooltip is dead. That is why `RVoidMaps` shipped with a
// dead tooltip and nobody noticed: there is no error to see, and no test looked.
//
// A defect whose only symptom is the ABSENCE of something survives reading (the description looks fine
// in source) and survives every behavioural test (behaviour is unaffected). It has to be mechanized.
//
// HOW IT CHECKS, and why not the two obvious ways:
//   - `new Function(src)` is what the browser effectively does, but `no-new-func` is an ACTIVE lint gate
//     here and suppressing it is itself forbidden by a test (#92). Correctly so.
//   - jsdom really does compile inline handlers (valid ⇒ `typeof el.onmouseover === 'function'`, broken
//     ⇒ null — verified), but READING a broken one makes jsdom raise an UNCAUGHT SyntaxError that vitest
//     reports as an unhandled error instead of a clean failure, and esbuild cannot run under jsdom at
//     all (its TextEncoder invariant breaks).
// So: node environment, a minimal recording DOM, and esbuild's parser — which answers exactly the
// question that matters (would a browser compile this, or null it?).
import { describe, it, expect, beforeAll } from 'vitest'
import { transformSync } from 'esbuild'

/** True when `src` is a valid handler body — i.e. a browser compiles it instead of nulling it. */
function compiles(src: string): boolean {
  try {
    transformSync(src, { loader: 'js' })
    return true
  } catch {
    return false
  }
}

/** The exact onmouseover string createSetting handed the DOM, per setting id. */
const tooltips = new Map<string, string>()
let settingCount = 0

/**
 * A node that is REAL where this net looks — `id`, `setAttribute` (the capture), and `childNodes`, which
 * renderControlFace walks as childNodes[1] — and a self-returning callable Proxy everywhere else, so the
 * incidental layout pokes scattered through settings-defs (`.parentNode.style.setProperty`,
 * `.lastChild.insertAdjacentHTML`, …) all no-op instead of having to be enumerated one crash at a time.
 * Same Proxy idiom as tests/nets/settings-types.test.ts, the other test that has to execute all ~574 defs.
 */
function makeEl(tag = 'div'): any {
  const attrs: Record<string, string> = {}
  const anyEl: any = new Proxy(function () {}, { get: () => anyEl, apply: () => anyEl, set: () => true })
  const real: any = {
    tag, id: '', className: '', textContent: '', value: '', childNodes: [] as any[],
    setAttribute(k: string, v: string) {
      attrs[k] = v
      // `btn.id = id` runs before the attributes are set, so every control is keyed correctly.
      if (k === 'onmouseover' && real.id) tooltips.set(real.id, v)
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
  const doc: any = {
    createElement: (t: string) => makeEl(t),
    createTextNode: (t: string) => ({ textContent: t }),
    getElementById: () => makeEl(),
  }
  ;(globalThis as any).document = doc
  // utils.ts installs a window.onerror handler at MODULE scope, so `window` must exist before it loads.
  ;(globalThis as any).window = globalThis
  ;(globalThis as any).modifyParentNode = () => {}
  ;(globalThis as any).settingsProfileMakeGUI = () => {}
  ;(globalThis as any).game = { options: { menu: { darkTheme: { enabled: 0 } } } }
  ;(globalThis as any).ATversion = 'net-settings-tooltips'
  ;(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  ;(globalThis as any).autoTrimpSettings = {}

  const engine = await import('../../src/modules/settings-engine')
  const utils = await import('../../src/modules/utils')
  const { initializeAllSettings } = await import('../../src/modules/settings-defs')
  ;(globalThis as any).createSetting = engine.createSetting
  ;(globalThis as any).getPageSetting = utils.getPageSetting

  initializeAllSettings()
  settingCount = Object.keys((globalThis as any).autoTrimpSettings).filter((k) => k !== 'ATversion').length
})

describe('every setting tooltip compiles (#110)', () => {
  it('anti-false-green: the walk really mounted the settings and captured their tooltips', () => {
    // A capture that silently collected nothing would make the assertion below pass vacuously — the
    // failure mode this repo has shipped before (a walk that breaks, collapses to ∅, and certifies a
    // class as closed while it is wide open).
    expect(settingCount).toBeGreaterThan(500)
    expect(tooltips.size).toBeGreaterThan(500)
  })

  it('anti-false-green: the checker can tell a live tooltip from a dead one', () => {
    expect(compiles('tooltip("a", "customText", event, "b")')).toBe(true)
    // …and this is EXACTLY what a raw quote in a description produces. If it ever returns true, the net
    // has gone blind and every green above is worthless.
    expect(compiles('tooltip("a", "customText", event, "b "c" d")')).toBe(false)
  })

  it('no description breaks out of its string literal — every tooltip handler compiles', () => {
    const broken = [...tooltips.entries()].filter(([, src]) => !compiles(src)).map(([id]) => id)
    expect(broken).toEqual([])
  })
})

describe('the escape is real, not incidental (#110)', () => {
  // The net above only proves TODAY's descriptions happen to be safe. This proves the SEAM is safe: hand
  // createSetting a description that WOULD have broken it, and demand the emitted handler still compiles
  // and still carries the original text — quotes escaped for transport, nothing else altered.
  it('a description containing double quotes still compiles and carries the text intact', async () => {
    const engine = await import('../../src/modules/settings-engine')
    ;(globalThis as any).autoTrimpSettings = {}

    const NASTY = 'stops once you are "strong enough" — and a backslash \\ too'
    engine.createSetting('NetQuoteProbe', 'Quote "Probe"', NASTY, 'boolean', false, null, 'Gear')

    const src = tooltips.get('NetQuoteProbe')!
    expect(src).toBeDefined()
    // 1. it compiles — unescaped, this is a SyntaxError and therefore a dead tooltip in the browser
    expect(compiles(src)).toBe(true)
    // 2. and the text is carried verbatim, escaped only for transport. JSON.stringify emits the same
    //    \" / \\ escaping the seam applies, so this pins the payload without re-deriving the escaper.
    expect(src).toBe(`tooltip(${JSON.stringify('Quote "Probe"')}, "customText", event, ${JSON.stringify(NASTY)})`)
  })
})
