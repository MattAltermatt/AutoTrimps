import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { watch } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { build as esbuild } from 'esbuild'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Concat manifest — the legacy files still bundled, in load order. It is EMPTY, and `legacy/` no
// longer exists. The build is now exactly: header + version global + the esbuild IIFE of src/main.ts.
//
// ✅ ALL legacy/modules/*.js → src/modules/*.ts (Phase 2); SettingsGUI.js → settings-{engine,menu,
//    visibility,defs,boot}.ts (#20); Graphs.js → src/modules/graphs/* (#131, CDN-injects ECharts from
//    render.ts, not bundled). legacy/highcharts.js is dead (never loaded) — deleted in #134.
//    AutoTrimps2.js → src/modules/main-loop.ts (#133).
// #75/#171 SECURITY: the last entry was the vendored FastPriorityQueue.js. #75 stopped perks.ts
//    injecting it from `https://Zorn192.github.io/AutoTrimps/FastPriorityQueue.js` — executable
//    third-party JS from an unpinned origin, no integrity hash, in every user's game — by bundling
//    the copy already sitting in legacy/. #171 then found that copy was never a clean vendor drop:
//    the fork hand-edited upstream in 2016 and broke poll(), which froze the browser mid-portal.
//    It is now the maintained `fastpriorityqueue` package, pinned exact in package.json and
//    integrity-locked in package-lock.json, imported by perks.ts and bundled by esbuild — so it
//    lands INSIDE the src IIFE and needs no concat entry, no load-order rule, and no ASI guard.
//    tests/nets/supply-chain.test.ts still fails on any new executable remote origin.
export const MANIFEST = []

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
  // #133/#171 — there is no legacy chunk left to order against. The src IIFE used to be emitted
  // first (after the version global) and the remaining legacy concat second; with FastPriorityQueue
  // now imported as an npm package and bundled INTO the IIFE, the emit is just header + version
  // global + IIFE. tests/build-userscript.test.ts pins that no `/* ===== legacy/` chunk returns.
  const srcIife = await bundleSrc()
  const version = resolveVersion(pkg.version, process.env.GITHUB_RUN_NUMBER)
  // Expose the monotonic build version to the bundle so main-loop.ts stamps it into ATversion —
  // it then shows in the on-load message log ("AutoTrimps v<x> Loaded!") and the update-notice title,
  // giving the user a single incrementing on-screen version to confirm they're on the latest.
  const versionGlobal = `var __AT_BUILD_VERSION__ = ${JSON.stringify(version)};\n`
  return `${header(version)}${versionGlobal}\n;\n/* ===== src/main.ts (bundled — converted modules incl. former AutoTrimps2.js) ===== */\n${srcIife}\n`
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
    console.log('[build] watching src/ ...')
    let t
    const rebuild = () => { clearTimeout(t); t = setTimeout(() => writeBuild().catch(console.error), 150) }
    // #171: legacy/ was watched here too. It no longer exists, and `watch()` on a missing directory
    // THROWS — so leaving this line would have broken `npm run build:watch` outright.
    watch(resolve(ROOT, 'src'), { recursive: true }, rebuild)
  }
}
