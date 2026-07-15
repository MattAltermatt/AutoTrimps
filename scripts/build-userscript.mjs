import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { watch } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { build as esbuild } from 'esbuild'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEGACY = resolve(ROOT, 'legacy')

// Concat manifest — exact original load order (from legacy/AutoTrimps2.js).
export const MANIFEST = [
  'AutoTrimps2.js',
  // modules/utils.js — converted to src/modules/utils.ts (Phase 1); published via legacy-bridge.
  // modules/calc.js — converted to src/modules/calc.ts (Phase 2)
  // ✅ ALL legacy/modules/*.js converted to src/modules/*.ts (Phase 2 complete).
  // ✅ SettingsGUI.js decomposed to src/modules/settings-{engine,menu,visibility,defs,boot}.ts
  //    (Phase UI, #20); nuloom relocated to heirlooms.ts. Published via src/legacy-bridge.ts;
  //    load-time self-invocations run from src/modules/settings-boot.ts (imported last in main.ts).
  // Published via src/legacy-bridge.ts (+ side-effect imports in main.ts for perks/fight-info/
  // performance/settings-boot). Only AutoTrimps2.js remains legacy below (see #133).
  // NOTE: Graphs.js is now src/modules/graphs/* — it CDN-injects Apache ECharts (pinned + SRI)
  // from render.ts, so it is NOT bundled either. legacy/highcharts.js is dead (never loaded) and
  // slated for deletion (#134). bootGraphs() is called from main.ts, after seedModuleDefaults().
  // #75 SECURITY: vendored. perks.ts used to inject this from
  // `https://Zorn192.github.io/AutoTrimps/FastPriorityQueue.js` — executable third-party JS from an
  // unpinned origin, no integrity hash, in every user's game. The file was already sitting in legacy/;
  // it just was never bundled. Emitted here (after the src IIFE) rather than first: all four
  // `new FastPriorityQueue(...)` sites are inside functions called from mainLoop, so the global only has
  // to exist by first TICK, not by module-eval. tests/nets/supply-chain.test.ts guards the class.
  'FastPriorityQueue.js',
]

// Monotonic version: base package.json version locally, `<version>.<run>` in CI so
// Tampermonkey detects updates (higher run number = higher version, comparable per segment).
export function resolveVersion(pkgVersion, runNumber) {
  return runNumber ? `${pkgVersion}.${runNumber}` : pkgVersion
}

function header(version) {
  return `// ==UserScript==
// @name         AutoTrimps
// @namespace    mattaltermatt.autotrimps
// @version      ${version}
// @description  Automate all the trimps! (modernized build)
// @downloadURL  https://mattaltermatt.github.io/AutoTrimps/autotrimps.user.js
// @updateURL    https://mattaltermatt.github.io/AutoTrimps/autotrimps.user.js
// @match        http://localhost:*/*
// @match        *://trimps.github.io/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
`
}

// Static install landing page served at the Pages root (mattaltermatt.github.io/AutoTrimps/).
// Every method loads the same CI-built userscript from the stable URL.
export function landingHtml() {
  const URL = 'https://mattaltermatt.github.io/AutoTrimps/autotrimps.user.js'
  const inject =
    "var s=document.createElement('script');s.id='AutoTrimps-Zek';" +
    "s.src='" + URL + "?'+Date.now();s.setAttribute('crossorigin','anonymous');" +
    'document.head.appendChild(s);'
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AutoTrimps — install</title>
<style>
  body { font: 15px/1.6 system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
  code, pre { background: #f4f4f4; border-radius: 6px; }
  pre { padding: 1rem; overflow-x: auto; }
  a.bm { display: inline-block; padding: .4rem .8rem; background: #2d6; border-radius: 6px; color: #000; text-decoration: none; font-weight: 600; }
  @media (prefers-color-scheme: dark) { body { background:#111; color:#eee } code,pre { background:#222 } }
</style>
</head>
<body>
<h1>AutoTrimps — Zek Fork (modernized)</h1>
<p>Automation for <a href="https://trimps.github.io/">Trimps</a>. Four ways to run it — all load the same auto-built script:</p>

<h2>1 · Tampermonkey (auto-updates)</h2>
<p>Install <a href="https://www.tampermonkey.net/">Tampermonkey</a>, then open <a href="${URL}">${URL}</a> — it prompts to install and auto-updates on each release.</p>

<h2>2 · Bookmarklet (one click, no extension)</h2>
<p>Drag this to your bookmarks bar, then click it on the game page:</p>
<p><a class="bm" href="javascript:(function(){${inject}})();">▶ Load AutoTrimps</a></p>

<h2>3 · Console paste</h2>
<p>Open the game, press F12, paste into the Console, Enter (re-paste after each refresh):</p>
<pre><code>${inject}</code></pre>

<h2>4 · Steam</h2>
<p>Save <a href="${URL}">autotrimps.user.js</a> into <code>Steam\\steamapps\\common\\Trimps\\mods\\mods.js</code> and restart the game.</p>
</body>
</html>
`
}

// De-loaderize AutoTrimps2.js: modules are already bundled, so its remote
// script-injection must not run. Three anchored, deterministic transforms.
//
// EXPORTED because it is part of the definition of "the shipped bundle", and a net that reasons about
// what actually runs has to read the text that actually ships. tests/nets/reachability.test.ts walks the
// call graph from the real entry points; against the RAW legacy/AutoTrimps2.js it would report
// bootSettingsUI() and the whole settings-menu boot subtree (automationMenuInit, autoPlusSettingsMenu,
// toggleAutoMaps, getDailyHeHrStats, getDailyRnHrStats) as DEAD — because the only call to bootSettingsUI
// in the entire codebase is the one T3 *introduces*. Six false positives, and the fix would have been to
// allowlist them, i.e. to teach the net to ignore the settings menu. Read the shipped text instead.
export function deLoaderize(src) {
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
  // T3: initializeAutoTrimps body -> init + settings boot, no remote injection. bootSettingsUI()
  // MUST run after loadPageVariables(): it wraps the flat saved blob (autoTrimpSettings[id]) into
  // typed setting objects via createSetting, so running it before the load (as a bundle-eval-time
  // self-invocation) wrapped empty defaults that loadPageVariables then clobbered back to bare
  // values — getPageSetting returned undefined for all settings and Praiding threw every tick (#22).
  // This mirrors legacy's order: loadPageVariables() → ATscriptLoad('', 'SettingsGUI') (which ran
  // the same boot). bootSettingsUI is published globally by src/legacy-bridge.ts.
  // #124: mountBackupPortalButton() belongs HERE, not in legacy/AutoTrimps2.js. This transform replaces
  // that function's ENTIRE body, so a call added to the legacy source is silently deleted from the
  // shipped bundle — the button would simply never mount. (The reachability net caught exactly that.)
  src = src.replace(
    /function initializeAutoTrimps\(\) \{[\s\S]*?debug\('AutoTrimps - Zek Fork Loaded!', '\*spinner3'\);\s*\}/,
    "function initializeAutoTrimps() {\n    loadPageVariables();\n    bootSettingsUI();\n    mountBackupPortalButton();\n    debug('AutoTrimps ' + ATversion + ' Loaded!', '*spinner3');\n}"
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

export async function bundleSrc() {
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
  const version = resolveVersion(pkg.version, process.env.GITHUB_RUN_NUMBER)
  // Expose the monotonic build version to the bundle so AutoTrimps2.js stamps it into ATversion —
  // it then shows in the on-load message log ("AutoTrimps v<x> Loaded!") and the update-notice title,
  // giving the user a single incrementing on-screen version to confirm they're on the latest.
  const versionGlobal = `var __AT_BUILD_VERSION__ = ${JSON.stringify(version)};\n`
  return `${header(version)}${versionGlobal}${firstJs}\n;\n/* ===== src/main.ts (bundled — seam: converted modules published before remaining legacy) ===== */\n${srcIife}\n;\n${restJs}\n`
}

async function writeBuild() {
  const out = await buildUserscript()
  await mkdir(resolve(ROOT, 'dist'), { recursive: true })
  await writeFile(resolve(ROOT, 'dist/autotrimps.user.js'), out, 'utf8')
  console.log(`[build] dist/autotrimps.user.js (${out.length} bytes)`)
  await writeFile(resolve(ROOT, 'dist/index.html'), landingHtml(), 'utf8')
  console.log('[build] dist/index.html')
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
