import { describe, it, expect } from 'vitest'
import { buildUserscript } from '../scripts/build-userscript.mjs'

describe('buildUserscript', () => {
  it('assembles a self-contained userscript from legacy + src', async () => {
    const out: string = await buildUserscript()

    // Userscript header present
    expect(out.startsWith('// ==UserScript==')).toBe(true)
    expect(out).toContain('@match')

    // Legacy behavior is bundled (sentinels from utils, AutoTrimps2, a late module)
    // utils is now a converted src module, published via legacy-bridge (Phase 1)
    expect(out).toContain('function loadPageVariables') // from src IIFE, not legacy concat
    expect(out).toContain('Object.assign(globalThis') // the seam bridge is bundled
    expect(out).toContain('function mainLoop') // AutoTrimps2.js
    expect(out).toContain('MAZ') // last module in the manifest

    // src IIFE bundled and appended
    expect(out).toContain('[AutoTrimps] modern build booted')

    // Loader neutered: no remote injection survives
    expect(out).not.toContain('Quiaaaa.github.io') // remote Graphs inject removed (T3)
    expect(out).not.toContain('basepath + pathname + modulename') // ATscriptLoad body gone (T1)

    // Seam ordering (Phase 1): the converted-modules bridge must publish BEFORE any
    // still-legacy module that calls a converted function at load time. portal.js's
    // top-level `getPageSetting('CustomAutoPortal')` is the canonical case — emitting
    // the src bundle last throws ReferenceError and halts the whole script. Guard it.
    const at2Idx = out.indexOf('function mainLoop') // AutoTrimps2.js sentinel
    const bridgeIdx = out.indexOf('Object.assign(globalThis') // the seam publish
    const portalIdx = out.indexOf('MODULES["portal"]') // portal.js (loads after src)
    expect(at2Idx).toBeGreaterThanOrEqual(0)
    expect(bridgeIdx).toBeGreaterThan(at2Idx) // src bundle emitted after AutoTrimps2.js
    expect(portalIdx).toBeGreaterThan(bridgeIdx) // ...but before portal.js and the rest
  })
})
