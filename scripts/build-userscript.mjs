import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { watch } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { build as esbuild } from 'esbuild'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEGACY = resolve(ROOT, 'legacy')

// Concat manifest — exact original load order (from legacy/AutoTrimps2.js).
const MANIFEST = [
  'AutoTrimps2.js',
  // modules/utils.js — converted to src/modules/utils.ts (Phase 1); published via legacy-bridge.
  // modules/calc.js — converted to src/modules/calc.ts (Phase 2)
  'modules/import-export.js', 'modules/query.js', 'modules/portal.js',
  // modules/buildings.js, modules/jobs.js, modules/upgrades.js — converted to src/modules/ (Phase 2)
  'modules/heirlooms.js',
  // modules/equipment.js — converted to src/modules/equipment.ts (Phase 2)
  'modules/gather.js', 'modules/stance.js', 'modules/mapfunctions.js',
  // modules/dynprestige.js, modules/breedtimer.js — converted to src/modules/ (Phase 2)
  'modules/maps.js', 'modules/fight.js',
  // modules/nature.js, modules/magmite.js — converted to src/modules/ (Phase 2)
  'modules/scryer.js', 'modules/other.js',
  'modules/perks.js', 'modules/fight-info.js', 'modules/performance.js', 'modules/ab.js',
  'modules/MAZ.js',
  // NOTE: highcharts.js is intentionally NOT bundled — Graphs.js injects Highcharts
  // itself from the CDN at runtime (Graphs.js:177), exactly as the original did.
  // Bundling our local copy too caused a double-define (Highcharts error #16).
  // Vendoring Highcharts self-contained (and neutering that CDN inject) is deferred
  // to the later Graphs modernization phase.
  'SettingsGUI.js', 'Graphs.js',
]

function header(version) {
  return `// ==UserScript==
// @name         AutoTrimps
// @namespace    mattaltermatt.autotrimps
// @version      ${version}
// @description  Automate all the trimps! (modernized build)
// @match        http://localhost:*/*
// @match        *://trimps.github.io/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
`
}

// De-loaderize AutoTrimps2.js: modules are already bundled, so its remote
// script-injection must not run. Three anchored, deterministic transforms.
function deLoaderize(src) {
  // T1: ATscriptLoad body -> no-op
  src = src.replace(
    /function ATscriptLoad\(pathname, modulename\) \{[\s\S]*?\n\}/,
    'function ATscriptLoad(pathname, modulename) { /* bundled: no-op */ }'
  )
  // T2: ATscriptUnload body -> no-op
  src = src.replace(
    /function ATscriptUnload\(a\) \{[\s\S]*?\n\}/,
    'function ATscriptUnload(a) { /* bundled: no-op */ }'
  )
  // T3: initializeAutoTrimps body -> just init, no injection
  src = src.replace(
    /function initializeAutoTrimps\(\) \{[\s\S]*?debug\('AutoTrimps - Zek Fork Loaded!', '\*spinner3'\);\s*\}/,
    "function initializeAutoTrimps() {\n    loadPageVariables();\n    debug('AutoTrimps - Zek Fork Loaded!', '*spinner3');\n}"
  )
  return src
}

async function readModule(rel) {
  let src = await readFile(resolve(LEGACY, rel), 'utf8')
  if (rel === 'AutoTrimps2.js') src = deLoaderize(src)
  // Leading `;` terminates any dangling expression from the previous chunk so a
  // file that doesn't end in a semicolon can't ASI-merge with the next one's
  // leading `(`/`[` (the original loaded each as a separate <script>, which
  // isolated this; concatenation into one file does not).
  return `\n;\n/* ===== legacy/${rel} ===== */\n${src}\n`
}

async function bundleSrc() {
  const res = await esbuild({
    entryPoints: [resolve(ROOT, 'src/main.ts')],
    bundle: true,
    format: 'iife',
    write: false,
    logLevel: 'silent',
  })
  return res.outputFiles[0].text
}

export async function buildUserscript() {
  const pkg = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8'))
  // SEAM ORDERING (Phase 1): the converted-modules bundle is emitted at the slot
  // utils.js originally occupied — immediately after AutoTrimps2.js, BEFORE the rest
  // of the legacy modules. Still-legacy modules call converted functions by bare name
  // at load time (e.g. portal.js's top-level `getPageSetting('CustomAutoPortal')`), so
  // the bridge must publish them before those modules evaluate. Emitting src last (its
  // former position) throws ReferenceError and halts the whole concatenated script.
  const [first, ...rest] = MANIFEST // first === 'AutoTrimps2.js' (defines base globals)
  const firstJs = await readModule(first)
  const restJs = (await Promise.all(rest.map(readModule))).join('')
  const srcIife = await bundleSrc()
  return `${header(pkg.version)}${firstJs}\n;\n/* ===== src/main.ts (bundled — seam: converted modules published before remaining legacy) ===== */\n${srcIife}\n;\n${restJs}\n`
}

async function writeBuild() {
  const out = await buildUserscript()
  await mkdir(resolve(ROOT, 'dist'), { recursive: true })
  await writeFile(resolve(ROOT, 'dist/autotrimps.user.js'), out, 'utf8')
  console.log(`[build] dist/autotrimps.user.js (${out.length} bytes)`)
}

// CLI (not run when imported by the test)
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeBuild()
  if (process.argv.includes('--watch')) {
    console.log('[build] watching legacy/ and src/ ...')
    let t
    const rebuild = () => { clearTimeout(t); t = setTimeout(() => writeBuild().catch(console.error), 150) }
    watch(LEGACY, { recursive: true }, rebuild)
    watch(resolve(ROOT, 'src'), { recursive: true }, rebuild)
  }
}
