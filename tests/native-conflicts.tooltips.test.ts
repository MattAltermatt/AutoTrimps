// #150 / #110 — EVERY CONFLICT BODY MUST BE A COMPILABLE HANDLER.
//
// The badge's hover is an HTML attribute holding `tooltip("<title>", "customText", event, "<body>")`,
// so one raw `"` in the copy closes the string literal early, the browser fails to COMPILE the
// handler, and `onmouseover` is silently left null. Nothing throws; the badge still renders. That is
// how `RVoidMaps` shipped with a dead tooltip.
//
// NODE environment, deliberately: esbuild cannot run under jsdom at all (its TextEncoder invariant
// breaks), which is why the DOM-behaviour suite is a separate jsdom file. Same split, same reason, as
// tests/nets/settings-tooltips.test.ts.
import { describe, it, expect, beforeAll } from 'vitest'
import { transformSync } from 'esbuild'

// `utils.ts:255` runs `document.createElement` at module top level, so a bare `document` must exist
// BEFORE the modules load — hence the dynamic import below rather than a static one.
let CONFLICTS: readonly { key: string; title: string; body: () => string }[]
let tooltipAttr: (label: unknown, body: unknown) => string

beforeAll(async () => {
  const anyEl: any = new Proxy(function () {}, { get: () => anyEl, apply: () => anyEl, set: () => true })
  ;(globalThis as any).document = {
    // Self-returning for BOTH, because utils.ts's top-level block does
    // `document.getElementById('logBtnGroup')!.appendChild(tab)` — a null here is a load-time crash.
    createElement: () => anyEl,
    getElementById: () => anyEl,
    head: anyEl,
    body: anyEl,
  }
  // utils.ts also assigns `window.onerror` at top level (utils.ts:284).
  ;(globalThis as any).window = anyEl
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).game = { global: { universe: 1 } }
  CONFLICTS = (await import('../src/modules/native-conflicts')).CONFLICTS
  tooltipAttr = (await import('../src/modules/settings-engine')).tooltipAttr
})

/** True when `src` is a valid handler body — i.e. a browser compiles it instead of nulling it. */
function compiles(src: string): boolean {
  try {
    transformSync(src, { loader: 'js' })
    return true
  } catch {
    return false
  }
}

describe('conflict tooltips compile (#150)', () => {
  it('every row, in both universes', () => {
    for (const universe of [1, 2]) {
      ;(globalThis as any).game.global.universe = universe
      for (const c of CONFLICTS) {
        expect(compiles(tooltipAttr(c.title, c.body())), `${c.key} @ U${universe}`).toBe(true)
      }
    }
  })

  it('the check has teeth: an UNESCAPED body would not compile', () => {
    // The positive control. Bypass the escaping seam the way a hand-built attribute would, and the
    // same copy that passes above must fail — otherwise the assertion above proves nothing.
    const raw = (label: string, body: string) =>
      'tooltip("' + label + '", "customText", event, "' + body + '")'
    expect(compiles(raw('T', 'a "quoted" word'))).toBe(false)
    expect(compiles(tooltipAttr('T', 'a "quoted" word'))).toBe(true)
  })
})
