# Phase 0 — Foundation Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a modern Vite/TypeScript/Vitest toolchain that bundles the *existing, unchanged* AutoTrimps modules into a single userscript which boots in the local Trimps clone and drives the game identically to today.

**Architecture:** Incremental strangler. The legacy `.js` files move (untouched) into `legacy/` as a behavioral oracle. A Node build script assembles the shipping userscript = `userscript header` + `concatenated legacy modules (global scope, exact load order)` + `esbuild-bundled src/main.ts (IIFE)`. Concatenation preserves the original shared-global semantics by construction, so behavior is identical; the only transforms are three deterministic edits that neuter `AutoTrimps2.js`'s remote script-injection loader (modules are already bundled). Vite/Vitest are configured for the TS conversion work that begins in Phase 1.

**Tech Stack:** TypeScript ~6 (gradual: `allowJs`, `strict:false`), Vite ^8, Vitest ^4, oxlint, esbuild — matching the other projects in this workspace (in-kind, diversion, freshet).

---

## File Structure

```text
AutoTrimps/
  package.json                       # scripts + devDeps (NEW)
  tsconfig.json                      # single config, allowJs, strict:false (NEW)
  vite.config.ts                     # vitest config block (NEW)
  .oxlintrc.json                     # minimal lint config (NEW)
  .gitignore                         # add node_modules/, dist/ (MODIFY)
  scripts/
    build-userscript.mjs             # exports buildUserscript(); CLI + --watch (NEW)
    serve-game.mjs                   # static server for trimps-game + dist alias (NEW)
  src/
    main.ts                          # Phase 0: boot marker; future real entry (NEW)
    game/trimps.d.ts                 # ambient types stub — the seam (NEW)
  tests/
    build-userscript.test.ts         # asserts build output shape (NEW)
  legacy/                            # all runtime *.js moved here untouched (MOVE)
    AutoTrimps2.js utils.js modules/*.js SettingsGUI.js Graphs.js highcharts.js ...
  dist/autotrimps.user.js            # build output (gitignored)
  ROADMAP.md                         # phase tracker (NEW)
  README.md                          # refreshed for the new build (MODIFY)
  docs/superpowers/...               # spec + this plan (exists)
```

**Concat manifest** (order the build reads from `legacy/`; pinned from `AutoTrimps2.js`):

```text
1.  AutoTrimps2.js        (loader neutered by transforms T1–T3 below)
2.  modules/utils.js      (defines loadPageVariables, needed by init)
3.  modules/import-export.js, query.js, calc.js, portal.js, upgrades.js, heirlooms.js,
    buildings.js, jobs.js, equipment.js, gather.js, stance.js, mapfunctions.js, maps.js,
    breedtimer.js, dynprestige.js, fight.js, scryer.js, magmite.js, nature.js, other.js,
    perks.js, fight-info.js, performance.js, ab.js, MAZ.js   (exact ATmoduleList order)
4.  SettingsGUI.js
5.  highcharts.js
6.  Graphs.js
```

`FastPriorityQueue.js` is **excluded** — `AutoTrimps2.js` never loads it and `Graphs.js` does not reference it (verified). `GraphsOnly.*`, `mods.js`, `modsGRAPH.js`, `.user.js` are the old loader files — moved to `legacy/` but not part of the concat.

**Transforms applied to `AutoTrimps2.js` text at build time** (source on disk stays untouched):

- **T1** — neuter `ATscriptLoad`: replace its body with `/* bundled: no-op */` so the top-level `ATscriptLoad(modulepath,'utils')` and any other calls do nothing.
- **T2** — neuter `ATscriptUnload`: replace its body with `/* bundled: no-op */`.
- **T3** — replace the whole `initializeAutoTrimps` body with:
  ```js
  function initializeAutoTrimps() {
      loadPageVariables();
      debug('AutoTrimps - Zek Fork Loaded!', '*spinner3');
  }
  ```
  This drops the module/SettingsGUI/Graphs remote injections (all now bundled) while keeping the init call and the 4s `delayStart` timing that follows.

---

## Task 0: Remove the dead rewrite project

**Files:**
- Delete: `/Users/matt/dev/MattAltermatt/auto-trimps/` (entire dir)
- Delete: `/Users/matt/dev/MattAltermatt/trimps-game/auto-trimps.user.js`

- [ ] **Step 1: Confirm what's being removed**

Run: `ls /Users/matt/dev/MattAltermatt/auto-trimps && ls -la /Users/matt/dev/MattAltermatt/trimps-game/auto-trimps.user.js`
Expected: the dead TS project + the stray bundled userscript. (User has authorized removal; both are git-tracked/recoverable.)

- [ ] **Step 2: Remove them**

```bash
rm -rf /Users/matt/dev/MattAltermatt/auto-trimps
rm -f /Users/matt/dev/MattAltermatt/trimps-game/auto-trimps.user.js
```

- [ ] **Step 3: Verify gone**

Run: `ls /Users/matt/dev/MattAltermatt/ | grep -c auto-trimps; ls /Users/matt/dev/MattAltermatt/trimps-game/auto-trimps.user.js 2>&1`
Expected: `0` and a "No such file" message.

- [ ] **Step 4: If `trimps-game` is a git repo, commit the removal there**

```bash
cd /Users/matt/dev/MattAltermatt/trimps-game && git rm --cached auto-trimps.user.js 2>/dev/null; git commit -am "Remove stray auto-trimps dev bundle" 2>/dev/null || echo "nothing to commit in game repo"
```
Expected: either a commit in the game repo, or "nothing to commit". (No commit happens in the AutoTrimps repo for this task — the deleted dirs live outside it.)

---

## Task 1: Toolchain scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.oxlintrc.json`
- Create: `src/main.ts`, `src/game/trimps.d.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "autotrimps",
  "private": true,
  "version": "6.0.0-dev.0",
  "license": "MIT",
  "type": "module",
  "scripts": {
    "build": "node scripts/build-userscript.mjs",
    "build:watch": "node scripts/build-userscript.mjs --watch",
    "serve": "node scripts/serve-game.mjs",
    "lint": "oxlint src tests scripts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^24.13.2",
    "esbuild": "^0.25.0",
    "oxlint": "^1.69.0",
    "typescript": "~6.0.2",
    "vite": "^8.1.0",
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "checkJs": false,
    "strict": false,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "types": ["node"],
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "tests", "scripts"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
  },
})
```

- [ ] **Step 4: Create `.oxlintrc.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json",
  "ignorePatterns": ["legacy/**", "dist/**", "node_modules/**"],
  "rules": {}
}
```

- [ ] **Step 5: Create `src/game/trimps.d.ts` (the seam stub)**

```ts
// Ambient declarations for the Trimps global API that AutoTrimps calls into.
// Grown pay-as-you-go as modules are converted (Phase 1+). Kept intentionally
// loose in Phase 0 — nothing is type-checked against it yet.

declare global {
  // The Trimps game object. Typed as `any` until a converted module needs a
  // real shape; this is the single documented seam between us and the game.
  const game: any
  function debug(message: string, category?: string): void
  function loadPageVariables(): void
}

export {}
```

- [ ] **Step 6: Create `src/main.ts` (Phase 0 boot marker)**

```ts
// Phase 0: the modern build has no logic yet — the legacy concat carries all
// behavior. This IIFE runs AFTER the legacy code and only proves the src → esbuild
// → bundle → boot pipeline works end to end. Real entry logic arrives in Phase 1.
console.log('[AutoTrimps] modern build booted')
```

- [ ] **Step 7: Update `.gitignore`**

Replace its contents with:
```text
node_modules/
dist/
```
(Removes the stale `AutoTrimps2.js` ignore — that file is about to move into `legacy/` and should be tracked as the oracle.)

- [ ] **Step 8: Install and verify the toolchain**

Run: `npm install`
Expected: dependencies install, no errors.

Run: `npm run typecheck`
Expected: PASS (exit 0), no type errors.

Run: `npm run lint`
Expected: PASS (exit 0) — `src`, `tests` (empty ok), `scripts` (empty ok) lint clean.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts .oxlintrc.json .gitignore src/
git commit -m "Add Vite/TS/Vitest/oxlint toolchain scaffolding"
```

---

## Task 2: Move legacy runtime into `legacy/` (the oracle)

**Files:**
- Move: all runtime `*.js` → `legacy/` (see manifest); `modules/` → `legacy/modules/`

- [ ] **Step 1: Move the runtime files, preserving `modules/` structure**

```bash
mkdir -p legacy
git mv modules legacy/modules
git mv utils.js legacy/utils.js 2>/dev/null || true   # only if a stray root utils exists
for f in FastPriorityQueue.js Graphs.js GraphsOnly.js GraphsOnly.user.js highcharts.js SettingsGUI.js mods.js modsGRAPH.js .user.js; do git mv "$f" "legacy/$f"; done
```

- [ ] **Step 2: Move `AutoTrimps2.js` (force-add — it was gitignored)**

`AutoTrimps2.js` was listed in the old `.gitignore`. `git mv` may fail if it's untracked. Handle both cases:
```bash
git mv AutoTrimps2.js legacy/AutoTrimps2.js 2>/dev/null || (mv AutoTrimps2.js legacy/AutoTrimps2.js && git add -f legacy/AutoTrimps2.js)
```

- [ ] **Step 3: Verify the manifest files are all present under `legacy/`**

Run: `for f in AutoTrimps2.js modules/utils.js modules/calc.js modules/MAZ.js SettingsGUI.js highcharts.js Graphs.js; do test -f "legacy/$f" && echo "OK $f" || echo "MISSING $f"; done`
Expected: all `OK`.

- [ ] **Step 4: Verify nothing else in the repo referenced the moved paths**

Run: `grep -rn "modules/" index.html *.css 2>/dev/null | grep -v node_modules; echo "---"; grep -rn "src=\"AutoTrimps2\|src=\"SettingsGUI" index.html 2>/dev/null`
Expected: no matches (index.html is the Pages landing page and does not load the runtime scripts).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Move legacy runtime into legacy/ as behavioral oracle"
```

---

## Task 3: The userscript build (TDD)

**Files:**
- Create: `scripts/build-userscript.mjs`
- Test: `tests/build-userscript.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/build-userscript.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildUserscript } from '../scripts/build-userscript.mjs'

describe('buildUserscript', () => {
  it('assembles a self-contained userscript from legacy + src', async () => {
    const out = await buildUserscript()

    // Userscript header present
    expect(out.startsWith('// ==UserScript==')).toBe(true)
    expect(out).toContain('@match')

    // Legacy behavior is bundled (sentinels from utils, AutoTrimps2, a late module)
    expect(out).toContain('function loadPageVariables')  // utils.js
    expect(out).toContain('function mainLoop')            // AutoTrimps2.js
    expect(out).toContain('MAZ')                          // last module in the manifest

    // src IIFE bundled and appended
    expect(out).toContain('[AutoTrimps] modern build booted')

    // Loader neutered: no remote injection survives
    expect(out).not.toContain('Quiaaaa.github.io')        // remote Graphs inject removed (T3)
    expect(out).not.toContain("basepath + pathname + modulename") // ATscriptLoad body gone (T1)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- build-userscript`
Expected: FAIL — cannot resolve `../scripts/build-userscript.mjs` / `buildUserscript` is not a function.

- [ ] **Step 3: Write `scripts/build-userscript.mjs`**

```js
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { watch } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { build as esbuild } from 'esbuild'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEGACY = resolve(ROOT, 'legacy')

// Concat manifest — exact original load order.
const MANIFEST = [
  'AutoTrimps2.js',
  'modules/utils.js',
  'modules/import-export.js', 'modules/query.js', 'modules/calc.js', 'modules/portal.js',
  'modules/upgrades.js', 'modules/heirlooms.js', 'modules/buildings.js', 'modules/jobs.js',
  'modules/equipment.js', 'modules/gather.js', 'modules/stance.js', 'modules/mapfunctions.js',
  'modules/maps.js', 'modules/breedtimer.js', 'modules/dynprestige.js', 'modules/fight.js',
  'modules/scryer.js', 'modules/magmite.js', 'modules/nature.js', 'modules/other.js',
  'modules/perks.js', 'modules/fight-info.js', 'modules/performance.js', 'modules/ab.js',
  'modules/MAZ.js',
  'SettingsGUI.js', 'highcharts.js', 'Graphs.js',
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
  // T1: ATscriptLoad body → no-op
  src = src.replace(
    /function ATscriptLoad\(pathname, modulename\) \{[\s\S]*?\n\}/,
    'function ATscriptLoad(pathname, modulename) { /* bundled: no-op */ }'
  )
  // T2: ATscriptUnload body → no-op
  src = src.replace(
    /function ATscriptUnload\(a\) \{[\s\S]*?\n\}/,
    'function ATscriptUnload(a) { /* bundled: no-op */ }'
  )
  // T3: initializeAutoTrimps body → just init, no injection
  src = src.replace(
    /function initializeAutoTrimps\(\) \{[\s\S]*?debug\('AutoTrimps - Zek Fork Loaded!', '\*spinner3'\);\s*\}/,
    "function initializeAutoTrimps() {\n    loadPageVariables();\n    debug('AutoTrimps - Zek Fork Loaded!', '*spinner3');\n}"
  )
  return src
}

async function readModule(rel) {
  let src = await readFile(resolve(LEGACY, rel), 'utf8')
  if (rel === 'AutoTrimps2.js') src = deLoaderize(src)
  return `\n/* ===== legacy/${rel} ===== */\n${src}\n`
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
  const legacy = (await Promise.all(MANIFEST.map(readModule))).join('')
  const srcIife = await bundleSrc()
  return `${header(pkg.version)}${legacy}\n/* ===== src/main.ts (bundled) ===== */\n${srcIife}\n`
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
    console.log('[build] watching legacy/ and src/ …')
    let t
    const rebuild = () => { clearTimeout(t); t = setTimeout(() => writeBuild().catch(console.error), 150) }
    watch(LEGACY, { recursive: true }, rebuild)
    watch(resolve(ROOT, 'src'), { recursive: true }, rebuild)
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- build-userscript`
Expected: PASS.

- [ ] **Step 5: Produce a real build and sanity-check it**

Run: `npm run build`
Expected: `[build] dist/autotrimps.user.js (<big number> bytes)`.

Run: `head -12 dist/autotrimps.user.js`
Expected: the `// ==UserScript==` header with `@match http://localhost:*/*`.

Run: `grep -c "Quiaaaa.github.io" dist/autotrimps.user.js`
Expected: `0` (remote Graphs inject removed).

- [ ] **Step 6: Typecheck + lint still clean**

Run: `npm run typecheck && npm run lint`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-userscript.mjs tests/build-userscript.test.ts
git commit -m "Add userscript build (legacy concat + esbuild src, loader neutered)"
```

---

## Task 4: Local dev serve + game injection wiring

**Files:**
- Create: `scripts/serve-game.mjs`
- Modify (local only, in the game repo): `/Users/matt/dev/MattAltermatt/trimps-game/index.html`

- [ ] **Step 1: Write `scripts/serve-game.mjs` (static server + dist alias)**

```js
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, extname, normalize } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GAME = process.env.TRIMPS_GAME_DIR || '/Users/matt/dev/MattAltermatt/trimps-game'
const PORT = Number(process.env.PORT || 8080)

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
}

createServer(async (req, res) => {
  try {
    let url = decodeURIComponent((req.url || '/').split('?')[0])
    // Alias: our build artifact, served alongside the game.
    let filePath = url === '/autotrimps.dev.js'
      ? resolve(ROOT, 'dist/autotrimps.user.js')
      : resolve(GAME, '.' + normalize(url === '/' ? '/index.html' : url))
    const body = await readFile(filePath)
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404); res.end('not found')
  }
}).listen(PORT, () => console.log(`[serve] http://localhost:${PORT}/  (game: ${GAME})`))
```

- [ ] **Step 2: Inject the build into the local game (local-only edit)**

Add this line immediately before `</body>` in `/Users/matt/dev/MattAltermatt/trimps-game/index.html`:
```html
<script src="/autotrimps.dev.js"></script>
```
This edit lives only in the local game clone and is NOT committed to the AutoTrimps repo. If the game repo is clean, either leave it uncommitted or record it in a local dev note — do not push it.

- [ ] **Step 3: Smoke-test the server serves both game and bundle**

Run: `npm run build && (node scripts/serve-game.mjs &) && sleep 1 && curl -s -o /dev/null -w "game=%{http_code}\n" http://localhost:8080/ && curl -s -o /dev/null -w "bundle=%{http_code}\n" http://localhost:8080/autotrimps.dev.js && curl -s http://localhost:8080/autotrimps.dev.js | head -1`
Expected: `game=200`, `bundle=200`, and the first line is `// ==UserScript==`. (Stop the backgrounded server afterward: `kill %1` or find it with `lsof -ti:8080 | xargs kill`.)

- [ ] **Step 4: Commit (AutoTrimps side only)**

```bash
git add scripts/serve-game.mjs
git commit -m "Add local dev static server with dist alias for the game clone"
```

---

## Task 5: Boot verification in the live clone (the Phase 0 gate)

This is the behavioral gate — run **inline by the lead** (Chrome DevTools MCP; not a subagent). No code changes; the goal is to observe identical behavior.

- [ ] **Step 1: Start the build watcher and server (background)**

Run (lead, background): `npm run build:watch` and `npm run serve`.

- [ ] **Step 2: Load the game with the bundle injected**

Open `http://localhost:8080/` in Chrome (DevTools MCP). Wait past the ~4s `startupDelay`.

- [ ] **Step 3: Assert the script booted**

- Console shows `[AutoTrimps] modern build booted` and `AutoTrimps - Zek Fork Loaded!` (the changelog/update tooltip appears).
- The AutoTrimps settings panel/tabs render in the game UI.
- No uncaught exceptions in the console referencing `ATscriptLoad`, a failed remote `Graphs.js`, or `undefined` module functions.

- [ ] **Step 4: Assert it drives the game**

With a save loaded (seed one if needed — user assists), confirm over ~1 minute that AutoTrimps performs its normal automation: buys buildings/jobs, fights, and (if enabled in settings) runs maps — matching what the current script does. Watch console for errors during the loop.

- [ ] **Step 5: Record the result**

If green: note it in `ROADMAP.md` Phase 0 as verified (done in Task 6). If any divergence: capture the console error + which module, and treat as a Phase 0 bug to fix before merge (likely a missed load-order or a transform anchor that didn't match — re-check T1–T3 against `legacy/AutoTrimps2.js`). No commit in this task unless a fix is needed.

---

## Task 6: Docs — ROADMAP + README

**Files:**
- Create: `ROADMAP.md`
- Modify: `README.md`

- [ ] **Step 1: Create `ROADMAP.md`**

```markdown
# 🗺️ AutoTrimps Modernization Roadmap

Incremental strangler modernization of the AutoTrimps userscript. Full design:
[`docs/superpowers/specs/2026-07-08-autotrimps-modernization-design.md`](docs/superpowers/specs/2026-07-08-autotrimps-modernization-design.md).

## ✅ Phase 0 — Foundation baseline
Vite/TS/Vitest/oxlint toolchain; legacy runtime moved to `legacy/` as the oracle;
build assembles a single userscript (legacy concat + esbuild src, loader neutered);
local dev serve + Chrome verify loop. **Behavior identical by construction.**

## 🚧 Phase 1 — First real conversion
Convert `legacy/modules/utils.js` → `src/modules/utils.ts` as a true ES module (root of
the import graph). Lock the conversion idiom: export/import shape, typing against
`src/game/trimps.d.ts`, the old/new parity check. Every later slice copies this.

## 🔮 Phase 2..N — Module-by-module strangle
Convert in dependency order — pure logic (calc, breedtimer, nature, magmite), systems
(buildings, jobs, upgrades, equipment, gather, heirlooms, perks), combat/maps (fight,
stance, scryer, maps, mapfunctions, MAZ, ab), infra (portal, import-export, query,
performance, other). Each slice: convert → type → vitest → parity-verify → commit.

## 🎨 Phase UI — Break up SettingsGUI.js (253 KB)
Decompose the monolith UI; modernize settings UX. Late — most entangled.

## 🆕 Phase Parity — Sync with Trimps v5.10.1
Diff game changes since the 2022 fork; implement automation gaps.

## 🐛 Phase Bugs — Squash
Fork's known GitHub issues + everything the type-checker and parity checks surface.

---
**Principle:** opportunistic bug/parity fixes when already in a module; game-affecting
behavior changes are always called out and verified. **Numeric balance is sacrosanct** —
ask before touching any tuning value.
```

- [ ] **Step 2: Refresh `README.md`**

Add a "Development (modernized build)" section near the top documenting:
```markdown
## 🛠️ Development (modernized build)

This fork is being modernized into a Vite + TypeScript build. See
[`ROADMAP.md`](ROADMAP.md) and the [design spec](docs/superpowers/specs/2026-07-08-autotrimps-modernization-design.md).

```bash
npm install
npm run build         # → dist/autotrimps.user.js
npm run build:watch   # rebuild on change
npm run serve         # static-serve the local Trimps clone with the bundle injected
npm test              # vitest
npm run typecheck     # tsc --noEmit
npm run lint          # oxlint
```

The legacy runtime lives untouched in `legacy/` as a behavioral oracle during migration;
files leave it only once their `src/` port is verified in the live game.
```
Leave the existing user-facing install instructions in place for now (they still describe the shipped script); a deployment refresh comes in a later phase.

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md README.md
git commit -m "Add modernization ROADMAP and dev README section"
```

---

## Self-Review notes

- **Spec coverage:** toolchain (Task 1), `legacy/` oracle (Task 2), concatenation-IIFE build with neutered loader (Task 3), dev/verify loop (Tasks 4–5), `trimps.d.ts` stub + ROADMAP + README (Tasks 1/6), dead-project removal (Task 0). All Phase 0 spec bullets mapped.
- **No logic change:** confirmed — the only edits to legacy behavior are transforms T1–T3, which remove *remote loading* (already redundant once bundled), not game logic.
- **Type consistency:** `buildUserscript()` is the exact export named in both the build script and the test; `deLoaderize`, `MANIFEST`, `header()` are internal and self-consistent. Serve alias path `/autotrimps.dev.js` matches between `serve-game.mjs` and the game injection tag.
- **Deferred (correctly not in Phase 0):** publishing `dist/` to gh-pages for Tampermonkey install, GM_* grants, vendoring highcharts as a real module, any TS conversion — all later phases.
```
