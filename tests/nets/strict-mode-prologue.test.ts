// #287 — A DIRECTIVE PROLOGUE ENDS AT THE FIRST STATEMENT, AND NOTHING WARNS YOU.
//
// `"use strict"` is only a directive when it is one of the leading string-expression statements of a
// script or function body. Put ANY statement above it and it silently degrades to a dead string
// expression — no error, no warning, no observable difference until something depends on strict
// semantics. The shipped userscript did exactly that for its whole life: the build emitted
// `header + var __AT_BUILD_VERSION__ = "…"; + <esbuild IIFE>`, and esbuild's own directive lives at
// the top of that IIFE chunk, i.e. after the var. Every converted module ran sloppy.
//
// WHY A NET AND NOT JUST A FIX. The failure is invisible by construction: the STRING is present in
// the artifact either way. A net that greps for `"use strict"` — the obvious one to write — passes
// against the broken build and always would have. So this asserts POSITION, and it is
// mutation-tested by re-introducing a statement above the directive, which is the only mutant that
// distinguishes the two states.
//
// The consequence is not academic here. CLAUDE.md requires a scope-aware implicit-global audit
// precisely because a sloppy `x = …` creates a global instead of throwing — an audit that was
// checking source for a hazard the runtime declined to enforce. And it was masking a live defect:
// perks.ts's ArithmeticPerk called `Array#map` with no thisArg, so `this.relativeIncrease` was
// `undefined` and every tier-II perk value was NaN. Strict turns that into a loud TypeError.

import { describe, it, expect } from 'vitest'
import { buildUserscript } from '../../scripts/build-userscript.mjs'

/**
 * The index of the first EXECUTABLE character — everything the prologue rules care about. Comments
 * and blank lines do not end a prologue, so the userscript's `// ==UserScript==` banner is fine
 * where it is and must not be mistaken for a statement.
 */
function firstStatement(src: string): { text: string; line: number } {
  const lines = src.split('\n')
  let inBlockComment = false
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    if (inBlockComment) {
      const end = line.indexOf('*/')
      if (end === -1) continue
      line = line.slice(end + 2).trim()
      inBlockComment = false
    }
    while (line.startsWith('/*')) {
      const end = line.indexOf('*/')
      if (end === -1) {
        inBlockComment = true
        line = ''
        break
      }
      line = line.slice(end + 2).trim()
    }
    if (inBlockComment || line === '' || line.startsWith('//')) continue
    return { text: line, line: i + 1 }
  }
  return { text: '', line: -1 }
}

describe('#287 — the shipped bundle runs in STRICT mode', () => {
  it('anti-false-green: the helper skips comments but DOES stop at a statement', () => {
    // Without this, `firstStatement` returning '' for everything would make the real assertion below
    // pass vacuously — the helper is the thing under test as much as the build is.
    expect(firstStatement('// a\n\n/* b */\n"use strict";\nvar x = 1;').text).toBe('"use strict";')
    expect(firstStatement('var x = 1;\n"use strict";').text).toBe('var x = 1;')
    expect(firstStatement('/* multi\n   line */\nfoo();').text).toBe('foo();')
    expect(firstStatement('// only comments\n').text).toBe('')
  })

  it('the FIRST executable statement in the artifact is the strict directive', async () => {
    const out = await buildUserscript()
    const first = firstStatement(out)
    expect(
      first.text,
      `the first executable statement is at line ${first.line} and is not the directive, so ` +
        `"use strict" is out of prologue position and the whole bundle runs SLOPPY (#287). ` +
        `Note the string is still PRESENT in the file — grepping for it cannot see this.`,
    ).toBe('"use strict";')
  })

  it('the directive precedes the version global, which is the statement that displaced it', async () => {
    const out = await buildUserscript()
    const directive = out.indexOf('"use strict"')
    const versionGlobal = out.indexOf('var __AT_BUILD_VERSION__')
    expect(directive).toBeGreaterThan(-1)
    expect(versionGlobal).toBeGreaterThan(-1)
    // This is the issue's own verification snippet, inverted: it printed `true` on the broken build.
    expect(directive < versionGlobal).toBe(true)
  })

  it('esbuild still emits its own directive inside the chunk — we did not replace it, only pre-empt it', async () => {
    const out = await buildUserscript()
    // Two directives, not one: ours opens the script, esbuild's opens its chunk. If a future esbuild
    // stops emitting its own, ours still covers the file — but the count changing is worth knowing.
    expect(out.split('"use strict";').length - 1).toBeGreaterThanOrEqual(2)
  })
})
