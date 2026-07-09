import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { bundleSrc } from '../scripts/build-userscript.mjs'

// THE NET (type-quality milestone). The golden is the emitted src bundle from the
// commit that opened this milestone. Pure-cast/annotation edits erase at compile ->
// this test MUST stay green (byte-identical proof). Intentional helper refactors
// change the emit -> regenerate via `node scripts/regen-src-golden.mjs`, then review
// the fixture's git diff as a pure cast->helper transformation before committing.
describe('src bundle parity net', () => {
  it('esbuild(src/main.ts) matches the committed golden snapshot', async () => {
    const golden = await readFile(resolve(__dirname, 'fixtures/src-bundle.golden.js'), 'utf8')
    const current = await bundleSrc()
    expect(current).toBe(golden)
  })
})
