import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { watch } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { build as esbuild } from 'esbuild'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEGACY = resolve(ROOT, 'legacy')

// Concat manifest — the legacy files still bundled, in load order. As of #133 this is a SINGLE
// third-party file: AutoTrimps2.js (the last own-code legacy file) is now src/modules/main-loop.ts,
// published via the bridge like every other converted module. legacy/ holds no AutoTrimps-authored
// JavaScript any more — the strangler is complete.
// ✅ ALL legacy/modules/*.js → src/modules/*.ts (Phase 2); SettingsGUI.js → settings-{engine,menu,
//    visibility,defs,boot}.ts (#20); Graphs.js → src/modules/graphs/* (#131, CDN-injects ECharts from
//    render.ts, not bundled). legacy/highcharts.js is dead (never loaded) — deleted in #134.
// #75 SECURITY: FastPriorityQueue.js is vendored. perks.ts used to inject it from
// `https://Zorn192.github.io/AutoTrimps/FastPriorityQueue.js` — executable third-party JS from an
// unpinned origin, no integrity hash, in every user's game. The file was already sitting in legacy/;
// it just was never bundled. Emitted AFTER the src IIFE: all four `new FastPriorityQueue(...)` sites are
// inside functions called from mainLoop, so the global only has to exist by first TICK, not by
// module-eval. tests/nets/supply-chain.test.ts guards the class.
export const MANIFEST = [
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

async function readModule(rel) {
  const src = await readFile(resolve(LEGACY, rel), 'utf8')
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
  // #133 — the src IIFE is now emitted FIRST (after the version global), then the remaining legacy
  // (FastPriorityQueue.js only). AutoTrimps2.js used to be emitted before the src bundle because it
  // "defined the base globals" that still-legacy modules read at load time. That file is now
  // src/modules/main-loop.ts, imported first in legacy-bridge.ts, so those globals are seeded inside
  // the IIFE before any consumer. Nothing bundled after the IIFE calls a converted fn at load time
  // (FastPriorityQueue is a bare class; its `new` sites are all inside tick-time functions).
  const legacyJs = (await Promise.all(MANIFEST.map(readModule))).join('')
  const srcIife = await bundleSrc()
  const version = resolveVersion(pkg.version, process.env.GITHUB_RUN_NUMBER)
  // Expose the monotonic build version to the bundle so main-loop.ts stamps it into ATversion —
  // it then shows in the on-load message log ("AutoTrimps v<x> Loaded!") and the update-notice title,
  // giving the user a single incrementing on-screen version to confirm they're on the latest.
  const versionGlobal = `var __AT_BUILD_VERSION__ = ${JSON.stringify(version)};\n`
  return `${header(version)}${versionGlobal}\n;\n/* ===== src/main.ts (bundled — converted modules incl. former AutoTrimps2.js) ===== */\n${srcIife}\n;\n${legacyJs}\n`
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
