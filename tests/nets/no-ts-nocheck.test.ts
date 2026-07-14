import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

// NO MODULE MAY SILENTLY OPT OUT OF TYPE CHECKING.
//
// Phase 1 converted all of src/ from `@ts-nocheck` to strict TS, and CLAUDE.md has claimed "ZERO
// @ts-nocheck remain in src/" ever since. That claim was FALSE for months, and nothing could tell:
//
//   src/modules/buildings.ts:5
//     // src/game/*.d.ts and read by bare name (no imports → esbuild byte-identical to the
//     // @ts-nocheck original, the conversion gate). getPageSetting + debug imported from
//
// That is PROSE — the sentence "byte-identical to the @ts-nocheck original" simply happened to WRAP
// so that a line began with the token. But TypeScript honours `@ts-nocheck` anywhere in a file's
// LEADING COMMENT BLOCK, prose or not. So the largest, most game-coupled module in the project (127
// `game.*` touches) was exempt from `tsc` entirely. Proven by probe: `const x: number = "s"` appended
// to that file produced ZERO errors from `npm run typecheck`.
//
// It hid because every signal said otherwise — the file looks converted, the docs said the class was
// closed, and `tsc` exits 0 precisely BECAUSE the file is skipped. A gate that is disabled reports
// success. Found by a documentation audit, not by any test.
//
// This net asserts the property directly, and it is deliberately *syntactic* rather than probe-based:
// it forbids the token from ever beginning a comment line in src/, which is the only form TypeScript
// acts on. Mentioning `@ts-nocheck` mid-sentence (as five other modules do) stays legal.

const SRC = join(__dirname, '../../src')

function tsFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) tsFiles(p, acc)
    else if (e.name.endsWith('.ts')) acc.push(p)
  }
  return acc
}

/**
 * The forms TypeScript actually honours: the token at the start of a line comment (`// @ts-nocheck`)
 * or a block-comment continuation (`* @ts-nocheck`). Leading whitespace is allowed; trailing prose is
 * allowed — which is exactly the trap, since `// @ts-nocheck original, the conversion gate).` IS a
 * live directive.
 */
const DIRECTIVE = /^\s*(\/\/|\/\*+|\*)\s*@ts-nocheck\b/

function offenders(): string[] {
  const out: string[] = []
  for (const file of tsFiles(SRC)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (DIRECTIVE.test(line)) out.push(`${relative(SRC, file)}:${i + 1}`)
    })
  }
  return out.sort()
}

describe('no src/ module opts out of type checking', () => {
  it('anti-false-green: the walk really found the source tree', () => {
    // An empty scan would pass everything vacuously — the failure mode this repo has shipped before.
    expect(tsFiles(SRC).length).toBeGreaterThan(30)
  })

  it('anti-false-green: the matcher recognises the form that actually bit us, and only that form', () => {
    // The real line from buildings.ts:5 — prose, but a live directive.
    expect(DIRECTIVE.test('// @ts-nocheck original, the conversion gate). getPageSetting + debug')).toBe(true)
    expect(DIRECTIVE.test('   * @ts-nocheck')).toBe(true)
    // …and a mid-sentence mention is inert, so it must NOT be flagged (five modules do this legally).
    expect(DIRECTIVE.test('// byte-identical to the @ts-nocheck original, the conversion gate).')).toBe(false)
  })

  it('no file carries an effective @ts-nocheck directive', () => {
    expect(offenders()).toEqual([])
  })
})
