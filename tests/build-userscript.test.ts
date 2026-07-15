import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildUserscript, resolveVersion, landingHtml } from '../scripts/build-userscript.mjs'

describe('resolveVersion', () => {
  it('appends the CI run number for a monotonic version', () => {
    expect(resolveVersion('6.0.0-dev.0', '42')).toBe('6.0.0-dev.0.42')
  })
  it('falls back to the bare package version locally', () => {
    expect(resolveVersion('6.0.0-dev.0', undefined)).toBe('6.0.0-dev.0')
    expect(resolveVersion('6.0.0-dev.0', '')).toBe('6.0.0-dev.0')
  })
})

describe('landingHtml', () => {
  it('is a self-contained install page referencing the stable Pages URL', () => {
    const html = landingHtml()
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('https://mattaltermatt.github.io/AutoTrimps/autotrimps.user.js')
    expect(html).toContain('javascript:(function()') // bookmarklet
    expect(html).toContain("document.createElement('script')") // console snippet
    expect(html).toContain('mods.js') // Steam note
  })
})

describe('buildUserscript version wiring', () => {
  it('stamps the CI run number into the built @version header', async () => {
    const prev = process.env.GITHUB_RUN_NUMBER
    process.env.GITHUB_RUN_NUMBER = '777'
    try {
      const out = await buildUserscript()
      expect(out).toMatch(/@version {6}\d+\.\d+\.\d+.*\.777\n/)
    } finally {
      if (prev === undefined) delete process.env.GITHUB_RUN_NUMBER
      else process.env.GITHUB_RUN_NUMBER = prev
    }
  })

  it('exposes the same version on-screen via __AT_BUILD_VERSION__ → ATversion → the load message', async () => {
    const prev = process.env.GITHUB_RUN_NUMBER
    process.env.GITHUB_RUN_NUMBER = '777'
    try {
      const out = await buildUserscript()
      // the on-screen version equals the @version header value (single source of truth)
      expect(out).toMatch(/var __AT_BUILD_VERSION__ = "\d+\.\d+\.\d+.*\.777";/)
      // #133: this line now lives in main-loop.ts and goes through esbuild, which normalizes string
      // literals to double quotes (the raw AutoTrimps2.js concat used single quotes).
      expect(out).toContain('"AutoTrimps " + ATversion + " Loaded!"') // top message-log line
    } finally {
      if (prev === undefined) delete process.env.GITHUB_RUN_NUMBER
      else process.env.GITHUB_RUN_NUMBER = prev
    }
  })
})

describe('buildUserscript', () => {
  it('assembles a self-contained userscript from legacy + src', async () => {
    const out: string = await buildUserscript()

    // Userscript header present
    expect(out.startsWith('// ==UserScript==')).toBe(true)
    expect(out).toContain('@match')
    expect(out).toContain('@downloadURL  https://mattaltermatt.github.io/AutoTrimps/autotrimps.user.js')
    expect(out).toContain('@updateURL    https://mattaltermatt.github.io/AutoTrimps/autotrimps.user.js')

    // Legacy behavior is bundled (sentinels from utils, main-loop, a late module)
    // utils is now a converted src module, published via legacy-bridge (Phase 1)
    expect(out).toContain('function loadPageVariables') // from src IIFE, not legacy concat
    expect(out).toContain('Object.assign(globalThis') // the seam bridge is bundled
    expect(out).toContain('function mainLoop') // main-loop.ts (former AutoTrimps2.js, #133)
    expect(out).toContain('MODULES["portal"]') // portal now a converted src module (Phase 2)

    // src IIFE bundled and appended
    expect(out).toContain('[AutoTrimps] modern build booted')

    // Loader neutered: no remote injection survives (#133 — the loader is gone from source, not a transform)
    expect(out).not.toContain('Quiaaaa.github.io') // remote Graphs inject removed
    expect(out).not.toContain("modulename + '.js'") // ATscriptLoad remote-URL body gone
    expect(out).not.toContain('modulename + ".js"') // (esbuild-normalized double-quote form too)

    // Seam ordering (#133): AutoTrimps2.js — the last first-party legacy file — is now
    // src/modules/main-loop.ts, imported FIRST in legacy-bridge.ts, so the base globals it seeds
    // (MODULES = {}, autoTrimpSettings, …) exist before any converted module's load-time MODULES[…] write.
    // The whole src IIFE is now emitted FIRST (after the version global), then the only remaining legacy
    // concat chunk, the vendored FastPriorityQueue.js. So: src bundle BEFORE the trailing legacy chunk.
    expect(out).not.toContain('/* ===== legacy/AutoTrimps2.js') // that file no longer exists
    const bridgeIdx = out.indexOf('Object.assign(globalThis') // the seam publish (src bundle)
    const trailingIdx = out.indexOf('/* ===== legacy/FastPriorityQueue.js') // last legacy chunk, after src
    expect(bridgeIdx).toBeGreaterThanOrEqual(0)
    expect(trailingIdx).toBeGreaterThan(bridgeIdx) // the src bundle is emitted before the remaining legacy files
  })

  it('SettingsGUI.js is decomposed out of the legacy concat and boot is bundled (#20)', async () => {
    const out: string = await buildUserscript()
    // The monolith no longer ships as a legacy concat chunk...
    expect(out).not.toContain('/* ===== legacy/SettingsGUI.js')
    // ...its boot code now lives in the src bundle (esbuild strips comments, so use a code
    // sentinel: the tabs.css <link> injection, which is unique to settings-boot.ts).
    expect(out).toContain('basepath + "tabs.css"')
    // The boot code must be bundled in the src IIFE region — before the trailing FastPriorityQueue.js
    // legacy chunk — and NOT as a trailing legacy concat file. (It's now a lazy bootSettingsUI() function
    // definition invoked from initializeAutoTrimps() rather than a bundle-eval self-invocation, so its
    // position relative to the Object.assign publish is no longer fixed; esbuild may hoist the definition
    // ahead of it. The load-order guarantee is covered by the '#22 save-reload' test below.)
    const srcIdx = out.indexOf('/* ===== src/main.ts')
    const bootIdx = out.indexOf('basepath + "tabs.css"')
    const trailingIdx = out.indexOf('/* ===== legacy/FastPriorityQueue.js')
    expect(bootIdx).toBeGreaterThan(srcIdx)
    expect(bootIdx).toBeLessThan(trailingIdx)
  })

  it('bridge imports maps before mapfunctions (R-map-state top-level inits must eval after maps placeholders)', () => {
    const bridge = readFileSync(resolve(__dirname, '../src/legacy-bridge.ts'), 'utf8')
    const mapsIdx = bridge.indexOf("from './modules/maps'")
    const mapfnIdx = bridge.indexOf("from './modules/mapfunctions'")
    expect(mapsIdx).toBeGreaterThan(-1)
    expect(mapfnIdx).toBeGreaterThan(-1)
    // Top-level `globalThis.RshouldFarm = false` (mapfunctions) must eval AFTER `maps`'s
    // `= undefined` placeholder — governed by import (module-eval) order, NOT spread order.
    // A Phase-3 split must keep whichever module owns those inits imported after maps.
    expect(mapfnIdx).toBeGreaterThan(mapsIdx)
  })

  it('initializeAutoTrimps() boots the settings UI AFTER loadPageVariables() (#22 save-reload)', async () => {
    const out: string = await buildUserscript()
    // The T3-rewritten initializeAutoTrimps must call bootSettingsUI() so the 570 createSetting
    // calls rehydrate the loaded save into typed setting objects. Ordering is load-bearing:
    // bootSettingsUI() must come AFTER loadPageVariables() (which replaces autoTrimpSettings with
    // the flat deserialized blob), else every getPageSetting() returns undefined and Praiding
    // throws every tick. Assert both the call exists and its position relative to the load.
    const initBody = out.slice(
      out.indexOf('function initializeAutoTrimps()'),
      out.indexOf('function initializeAutoTrimps()') + 400,
    )
    expect(initBody).toContain('loadPageVariables();')
    expect(initBody).toContain('bootSettingsUI();')
    expect(initBody.indexOf('bootSettingsUI();')).toBeGreaterThan(initBody.indexOf('loadPageVariables();'))
    // bootSettingsUI must be published as a global (spread through the bridge) so the bare call in
    // the legacy-scope initializeAutoTrimps resolves at runtime. esbuild rewrites the `...settingsBoot`
    // spread into an explicit `bootSettingsUI: <fn>` entry in the Object.assign(globalThis, ...) call.
    expect(out).toContain('bootSettingsUI:')
  })
})
