// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'

// #89 regression — MAZLookalike built its three <select> dropdowns by string concatenation and
// injected a stray character between the options:
//
//   ">Food</option>\"<option value='metal'"   → a literal `"` between every gather/map option (9x)
//   "...Metal Cache</option>\\<option value='src'" → a literal `\` before the Small Research Cache
//
// The result is a text node between <option> elements inside a <select>. The parser hoists it out
// of the <select>, so it does not render — but the markup is not what was written, and the joins
// are one keystroke away from breaking an option outright.
//
// This test reads the PARSED DOM, not the emitted string: it asserts that each <select> contains
// option elements and NOTHING else. A string-only assertion would not have caught what the browser
// actually does with the malformed markup.

let MAZ: typeof import('../src/modules/MAZ')

/** One saved MAZ row for the 'Time Farm' window — enough to render one of every dropdown. */
function seedTimeFarmSettings() {
  const row = (v: unknown) => ({ value: [v] })
  ;(globalThis as any).autoTrimpSettings = {
    Rtimefarmzone: row(50),
    Rtimefarmcell: row(81),
    Rtimefarmtime: row(60),
    Rtimefarmlevel: row(0),
    Rtimefarmmap: row('Forest'),
    Rtimefarmspecial: row('lmc'),
    Rtimefarmgather: row('metal'),
  }
}

/** The tooltip shell MAZLookalike writes into (+ #logBtnGroup, which utils.ts mounts into at import). */
function mountShell() {
  document.body.innerHTML =
    "<div id='logBtnGroup'></div><div id='tooltipDiv'></div>" +
    "<div id='tipTitle'></div><div id='tipText'></div><div id='tipCost'></div>"
}

beforeAll(async () => {
  ;(globalThis as any).byId = (id: string) => document.getElementById(id)
  ;(globalThis as any).swapClass = () => {}
  ;(globalThis as any).cancelTooltip = () => {}
  mountShell() // must precede the import: utils.ts appends its log-filter button at module scope
  MAZ = await import('../src/modules/MAZ')
})

beforeEach(() => {
  mountShell()
  ;(globalThis as any).game = { global: { lockTooltip: false } }
  seedTimeFarmSettings()
  MAZ.MAZLookalike('Time Farm')
})

/** The <select> the window rendered for row 0, as the browser actually parsed it. */
function select(id: string): HTMLSelectElement {
  const el = document.getElementById(id)
  expect(el, `${id} should have rendered`).not.toBeNull()
  return el as HTMLSelectElement
}

describe('#89: MAZ dropdowns emit clean <option> markup', () => {
  it('the harness really rendered the window (anti-false-green)', () => {
    // If MAZLookalike silently bailed, every "no stray nodes" assertion below would pass vacuously.
    expect(document.getElementById('windowContainer')).not.toBeNull()
    expect(document.querySelectorAll('select').length).toBeGreaterThan(0)
  })

  it.each([
    ['windowGather0', 4, ['food', 'metal', 'wood', 'science']],
    ['windowMap0', 7, ['Random', 'Mountain', 'Forest', 'Sea', 'Depths', 'Plentiful', 'Farmlands']],
    [
      'windowSpecial0',
      12,
      ['fa', 'lc', 'ssc', 'swc', 'smc', 'src', 'p', 'hc', 'lsc', 'lwc', 'lmc', 'lrc'],
    ],
  ] as const)('<select id=%s> contains %i <option>s and nothing else', (id, count, values) => {
    const sel = select(id)
    // The load-bearing assertion: every child node is an <option>. Before the fix the emitted
    // markup carried `"` / `\` text between the options.
    const kinds = [...sel.childNodes].map((n) => n.nodeName)
    expect(kinds).toEqual(Array(count).fill('OPTION'))
    expect([...sel.options].map((o) => o.value)).toEqual([...values])
  })

  it('no stray `"` or `\\` text node survives anywhere in or beside a <select>', () => {
    // Where the junk ends up is parser-dependent — jsdom keeps the text node inside the <select>,
    // a real browser hoists it out into the surrounding container. Check BOTH so the assertion is
    // not hostage to the parser: after the fix there is no such text node at all.
    for (const sel of document.querySelectorAll('select')) {
      for (const scope of [sel, sel.parentElement!]) {
        const strayText = [...scope.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent!.trim())
          .filter(Boolean)
        expect(strayText, `stray text in/beside <select id=${sel.id}>`).toEqual([])
      }
    }
  })

  it('the selected option is the one the saved row names', () => {
    // Proves the option strings still carry their `selected='selected'` attribute after the fix —
    // i.e. the join was repaired without disturbing what surrounds it.
    expect(select('windowGather0').value).toBe('metal')
    expect(select('windowMap0').value).toBe('Forest')
    expect(select('windowSpecial0').value).toBe('lmc')
  })
})
