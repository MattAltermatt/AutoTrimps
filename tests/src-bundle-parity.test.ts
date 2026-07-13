import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { bundleSrc } from '../scripts/build-userscript.mjs'

// THE NET: the golden is the emitted `src` bundle. Pure-cast/annotation edits erase at compile, so this
// test must stay byte-green through them; an intentional change to the emit moves it.
//
// #91 — CLOSING THE LAUNDERING HATCH. This net used to carry its own escape hatch in its header comment:
// "regenerate via `node scripts/regen-src-golden.mjs`, then review the fixture's git diff". So the
// documented response to a red was *overwrite the baseline*, and its only guard against laundering a real
// regression was a comment politely asking you to look. During #67's end-to-end experiment, an injected
// `jobs.ts` regression shipped to `dist/` GREEN — and that regen command is precisely what silenced the
// one red signal that had caught it.
//
// Now the regen must state a REASON, which it records with the golden's hash in a committed manifest, and
// this test refuses any golden whose hash does not match. The effect is not that laundering becomes
// impossible — nothing can achieve that — it is that laundering must be **written down, in the diff, in
// the author's own words**. A silent side effect of a build command becomes an attributable claim.
describe('src bundle parity net (#91)', () => {
  it('esbuild(src/main.ts) matches the committed golden snapshot', async () => {
    const golden = await readFile(resolve(__dirname, 'fixtures/src-bundle.golden.js'), 'utf8')
    const current = await bundleSrc()
    // If this is red: DO NOT reflexively regenerate. Read the diff first. An emit change you cannot
    // explain in one sentence is a finding, not a chore.
    expect(current).toBe(golden)
  })

  it('the golden carries a manifest whose hash matches it — a silent regen cannot pass', async () => {
    const goldenRaw = await readFile(resolve(__dirname, 'fixtures/src-bundle.golden.js'))
    const manifest = JSON.parse(
      await readFile(resolve(__dirname, 'fixtures/src-bundle.manifest.json'), 'utf8'),
    )
    const sha256 = createHash('sha256').update(goldenRaw).digest('hex')

    // Hand-edit the golden, or regenerate it by any route that skips the reason prompt, and these part
    // ways. The manifest is only writable by `regen-src-golden.mjs`, which refuses to run without a reason.
    expect({ sha256, bytes: goldenRaw.length }).toEqual({
      sha256: manifest.sha256,
      bytes: manifest.bytes,
    })
  })

  it('the manifest states WHY the emit last changed — the reason is the reviewable artifact', async () => {
    const manifest = JSON.parse(
      await readFile(resolve(__dirname, 'fixtures/src-bundle.manifest.json'), 'utf8'),
    )
    // A reason is what a reviewer reads instead of 1,000,000 bytes of emitted JS. An empty or throwaway
    // one ("update", "fix") defeats the point, so demand enough characters to name what actually moved.
    expect(typeof manifest.reason).toBe('string')
    expect(manifest.reason.trim().length).toBeGreaterThanOrEqual(15)
  })
})
