import { describe, it, expect } from 'vitest'
import { buildUserscript } from '../scripts/build-userscript.mjs'

describe('buildUserscript', () => {
  it('assembles a self-contained userscript from legacy + src', async () => {
    const out: string = await buildUserscript()

    // Userscript header present
    expect(out.startsWith('// ==UserScript==')).toBe(true)
    expect(out).toContain('@match')

    // Legacy behavior is bundled (sentinels from utils, AutoTrimps2, a late module)
    expect(out).toContain('function loadPageVariables') // utils.js
    expect(out).toContain('function mainLoop') // AutoTrimps2.js
    expect(out).toContain('MAZ') // last module in the manifest

    // src IIFE bundled and appended
    expect(out).toContain('[AutoTrimps] modern build booted')

    // Loader neutered: no remote injection survives
    expect(out).not.toContain('Quiaaaa.github.io') // remote Graphs inject removed (T3)
    expect(out).not.toContain('basepath + pathname + modulename') // ATscriptLoad body gone (T1)
  })
})
