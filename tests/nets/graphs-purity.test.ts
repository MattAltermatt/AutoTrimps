import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

// The pure/impure boundary is the whole point of the graphs module split: the bug-dense math and
// the option builders must never touch the DOM, live game state, or the ECharts runtime, so they
// stay unit-testable with no browser. This net enforces that boundary (mutation-check: add a
// `document.` reference to any pure file and this goes red).
//
// Note: a TYPE-ONLY `import type { EChartsOption } from 'echarts'` is allowed (erased at build,
// no runtime coupling) — the net forbids runtime member access `echarts.` / `game.`, not the word.

const PURE_FILES = ['types.ts', 'transforms.ts', 'graph-defs.ts', 'option-builder.ts']
const FORBIDDEN = /\b(?:document|window|localStorage)\b|\b(?:game|echarts)\./

function stripComments(src: string): string {
  return src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

describe('graphs purity boundary', () => {
  for (const file of PURE_FILES) {
    it(`${file} references no impure runtime globals`, () => {
      const src = stripComments(readFileSync(resolve('src/modules/graphs', file), 'utf8'))
      const match = src.match(FORBIDDEN)
      expect(match, match ? `found impure reference: "${match[0]}"` : '').toBeNull()
    })
  }
})
