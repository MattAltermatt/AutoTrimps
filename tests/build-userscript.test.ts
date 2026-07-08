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
    expect(out).toContain('MODULES["portal"]') // portal now a converted src module (Phase 2)

    // src IIFE bundled and appended
    expect(out).toContain('[AutoTrimps] modern build booted')

    // Loader neutered: no remote injection survives
    expect(out).not.toContain('Quiaaaa.github.io') // remote Graphs inject removed (T3)
    expect(out).not.toContain('basepath + pathname + modulename') // ATscriptLoad body gone (T1)

    // Seam ordering: the converted-modules bridge must publish BEFORE any still-legacy file
    // that calls a converted function at load time. ALL legacy/modules/*.js are converted
    // (Phase 2), and SettingsGUI.js is decomposed to src (Phase UI, #20). The only remaining
    // legacy files are AutoTrimps2.js (first) + Graphs.js (last). The src bundle must sit after
    // AutoTrimps2.js but before Graphs.js.
    const at2Idx = out.indexOf('/* ===== legacy/AutoTrimps2.js') // first legacy file
    const bridgeIdx = out.indexOf('Object.assign(globalThis') // the seam publish (src bundle)
    const graphsIdx = out.indexOf('/* ===== legacy/Graphs.js') // still-legacy, after src
    expect(at2Idx).toBeGreaterThanOrEqual(0)
    expect(bridgeIdx).toBeGreaterThan(at2Idx) // src bundle emitted after AutoTrimps2.js
    expect(graphsIdx).toBeGreaterThan(bridgeIdx) // ...but before the remaining legacy files
  })

  it('SettingsGUI.js is decomposed out of the legacy concat and boot is bundled (#20)', async () => {
    const out: string = await buildUserscript()
    // The monolith no longer ships as a legacy concat chunk...
    expect(out).not.toContain('/* ===== legacy/SettingsGUI.js')
    // ...its boot code now lives in the src bundle (esbuild strips comments, so use a code
    // sentinel: the tabs.css <link> injection, which is unique to settings-boot.ts).
    expect(out).toContain('basepath + "tabs.css"')
    // boot must run inside the src IIFE (after the bridge publish), not as a trailing legacy file
    const bridgeIdx = out.indexOf('Object.assign(globalThis')
    const bootIdx = out.indexOf('basepath + "tabs.css"')
    const graphsIdx = out.indexOf('/* ===== legacy/Graphs.js')
    expect(bootIdx).toBeGreaterThan(bridgeIdx)
    expect(bootIdx).toBeLessThan(graphsIdx)
  })
})
