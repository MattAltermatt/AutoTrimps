# SettingsGUI Breakup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `legacy/SettingsGUI.js` (2620 lines) into four typed `src/modules/*.ts` modules + a boot module, faithfully (byte-for-byte behavior parity), and relocate `nuloom` to `heirlooms.ts`.

**Architecture:** Continue the Phase-2 strangler idiom — each concern becomes a `// @ts-nocheck` src module whose `export`ed functions are republished onto `globalThis` by `src/legacy-bridge.ts`. Cross-module calls resolve at runtime via the global bridge (no imports needed except `getPageSetting` from utils where it must resolve at module load). Load-time self-invocations are centralized in a `settings-boot.ts` side-effect module imported last in `main.ts`. Extraction is incremental: each task moves one concern out of legacy into src, leaving the shrinking legacy file still functional (its remaining code calls the now-bridged functions), so the build stays green at every commit.

**Tech Stack:** TypeScript, Vite, esbuild (IIFE bundle), Vitest, oxlint. Build: `npm run build`. Verify: `npm run serve` → http://localhost:8080/?mute=1 (Trimps 5.10.1 clone at `../trimps-game`).

## Global Constraints

- **Idiom:** every new module starts with `/* eslint-disable */` + `// @ts-nocheck` + a `// FAITHFUL PORT` header noting source line ranges and any seam quirks.
- **Faithful:** copy function bodies verbatim. No behavior changes, no simplification, no fixing latent bugs (e.g. the dead `valueNegative` branch at `createSetting` :1268 is preserved).
- **Persistence contract (MUST hold):** all 570 `createSetting` calls remain with identical `(id, name, description, type, defaultValue, list, container)` args in the same order (define-pass rehydrates the flat saved blob; a dropped/renamed/reordered def silently kills a setting). `ATversion` stamp preserved. Dropdown `.list` re-attach + `PrestigeBackup` nested object preserved. `serializeSettings`/`getPageSetting`/`setPageSetting` in `utils.ts` are NOT modified.
- **Global reachability:** every function reached via an inline `on*=` attribute string or `action`/`infoclick` code string must be `export`ed so the bridge publishes it. SettingsGUI-owned handlers that MUST end up on `globalThis`: `settingChanged`, `autoSetValue`, `autoSetText`, `autoSetValueToolTip`, `autoSetTextToolTip`, `onKeyPressSetting`, `toggleTab`, `minimizeAllTabs`, `maximizeAllTabs`, `autoToggle`, `autoPlusSettingsMenu`, `toggleAutoMaps`.
- **Load order:** self-invocations run last and in order (`automationMenuInit` → `automationMenuSettingsInit` → `initializeAllTabs` → `initializeAllSettings`); `updateCustomButtons` stays cheap (runs every tick from `AutoTrimps2.js:370`).
- **Cross-module callers to keep working:** `import-export.ts:890` (`resetAutoTrimps` calls `automationMenuSettingsInit`, `initializeAllTabs`, `initializeAllSettings`, `updateCustomButtons`), `portal.ts:74` (`settingChanged("MaxTox")`), `AutoTrimps2.js:370` (`updateCustomButtons`).
- **Branch:** `feature/phase-ui-settings-breakup`. Commit after every task.
- **Reality of tests:** there is no runtime DOM test harness; `npm test` covers only the static build. Parity for each task is confirmed by `npm run build` + `npm run typecheck` + `npm run lint` succeeding AND a Chrome smoke check against the local clone. Chrome verification is load-bearing, not optional.

---

## File structure

```text
src/modules/settings-engine.ts      NEW  createSetting, createInput, settingChanged, parseNum,
                                         autoSetValueToolTip, autoSetTextToolTip, autoSetValue,
                                         autoSetText, onKeyPressSetting   (legacy 1226–1594)
src/modules/settings-menu.ts        NEW  modifyParentNode, createTabs, createTabContents, toggleTab,
                                         minimizeAllTabs, maximizeAllTabs, initializeAllTabs,
                                         automationMenuInit, automationMenuSettingsInit, autoToggle,
                                         autoPlusSettingsMenu, toggleAutoMaps + addTabsDiv/addtabsUL
                                         (legacy 1–125, 199–269, 1550–1594, 2602–end)
src/modules/settings-visibility.ts  NEW  updateCustomButtons, checkPortalSettings, getDailyHeHrStats,
                                         getDailyRnHrStats, settingsProfileMakeGUI stub (legacy 1596–2601)
src/modules/settings-defs.ts        NEW  initializeAllSettings — 570 createSetting calls verbatim
                                         (legacy 270–1225)
src/modules/settings-boot.ts        NEW  tabs.css <link> inject + the 4 ordered self-invocations
src/modules/heirlooms.ts            MOD  gains nuloom (from legacy 126–198)
src/legacy-bridge.ts                MOD  add settings-engine/menu/visibility/defs to the spread
src/main.ts                         MOD  side-effect import of settings-boot LAST
scripts/build-userscript.mjs        MOD  remove 'SettingsGUI.js' from MANIFEST
tests/build-userscript.test.ts      MOD  assert SettingsGUI gone + boot present
legacy/SettingsGUI.js               DEL  (after all concerns extracted)
```

---

### Task 1: Extract `settings-engine.ts` (the createSetting factory)

**Files:**
- Create: `src/modules/settings-engine.ts`
- Modify: `legacy/SettingsGUI.js` (remove lines 1226–1594), `src/legacy-bridge.ts`
- Reference: `src/modules/utils.ts` (getPageSetting/saveSettings — already bridged)

**Interfaces:**
- Produces (all `export function`, republished to `globalThis`): `createSetting(id,name,description,type,defaultValue,list,container)`, `createInput(id,name,description)`, `settingChanged(id)`, `autoSetValueToolTip(id,text,negative,multi)`, `autoSetTextToolTip(id,text)`, `autoSetValue(id,negative,multi)`, `autoSetText(id)`, `onKeyPressSetting(event,id,negative,multi)`, `parseNum(num)`.
- Consumes at runtime via globals: `autoTrimpSettings`, `ATversion`, `saveSettings`, `updateCustomButtons`, `checkPortalSettings`, `tooltip`, `cancelTooltip` (all pre-existing globals or bridged).

- [ ] **Step 1: Create the module with the faithful header and moved bodies**

Create `src/modules/settings-engine.ts` starting with:

```ts
/* eslint-disable */
// @ts-nocheck
// FAITHFUL PORT of legacy/SettingsGUI.js:1226–1594 (the createSetting factory + tooltip/input
// helpers). Bodies copied verbatim. Cross-module names (autoTrimpSettings, saveSettings,
// updateCustomButtons, checkPortalSettings, tooltip, cancelTooltip) resolve at runtime via the
// global bridge — no imports needed. Every function is exported so the bridge republishes it for
// the inline onclick= handlers that reference it by bare name.
```

Then paste the verbatim bodies of `createSetting`, `createInput`, `settingChanged`, `autoSetValueToolTip`, `autoSetTextToolTip`, `onKeyPressSetting`, `parseNum`, `autoSetValue`, `autoSetText` from legacy `1226–1594`, changing each `function foo(` to `export function foo(`.

- [ ] **Step 2: Remove those bodies from `legacy/SettingsGUI.js`**

Delete lines 1226–1594 from `legacy/SettingsGUI.js`. (The remaining legacy code — `initializeAllSettings`, `updateCustomButtons` — calls these by bare name and will resolve to the bridged versions.)

- [ ] **Step 3: Register in the bridge**

In `src/legacy-bridge.ts`, add `import * as settingsEngine from './modules/settings-engine'` and include `...settingsEngine` in the `Object.assign(globalThis, {...})` spread (order irrelevant — no self-invokes).

- [ ] **Step 4: Build + typecheck + lint**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: all succeed; build output contains `settings-engine` and no duplicate `createSetting` definition.

- [ ] **Step 5: Chrome smoke — click path**

Run: `npm run build && npm run serve`, open http://localhost:8080/?mute=1, open the AutoTrimps settings, toggle a boolean setting and set a numeric value (opens the tooltip via `autoSetValueToolTip`, commits via `autoSetValue`). Confirm the button state changes and `getPageSetting('<id>')` reflects it via console. Confirm console is clean after a couple of tick cycles (~8s).

- [ ] **Step 6: Commit**

```bash
git add src/modules/settings-engine.ts src/legacy-bridge.ts legacy/SettingsGUI.js
git commit -m "Phase UI: extract settings-engine.ts (createSetting factory) from SettingsGUI"
```

---

### Task 2: Extract `settings-menu.ts` (tabs + menu chrome)

**Files:**
- Create: `src/modules/settings-menu.ts`
- Modify: `legacy/SettingsGUI.js` (remove the moved bodies; KEEP the self-invoke call lines and the tabs.css `<link>` injection for now), `src/legacy-bridge.ts`

**Interfaces:**
- Produces (`export function`): `modifyParentNode(setting,id)`, `createTabs(a,b)`, `createTabContents(a,b)`, `toggleTab(a,b)`, `minimizeAllTabs()`, `maximizeAllTabs()`, `initializeAllTabs()`, `automationMenuInit()`, `automationMenuSettingsInit()`, `autoToggle(what)`, `autoPlusSettingsMenu()`, `toggleAutoMaps()`. Publishes `globalThis.addTabsDiv` / `globalThis.addtabsUL`.
- Consumes via globals: game DOM (`settingsTable`, `battleBtnsColumn`, `settingsRow`, etc.), `game.global.universe`, `basepath`, `autoTrimpSettings`.

- [ ] **Step 1: Create `src/modules/settings-menu.ts`**

Header:

```ts
/* eslint-disable */
// @ts-nocheck
// FAITHFUL PORT of legacy/SettingsGUI.js tab/menu chrome: 1–62, 65–92, 97–125, 199–267,
// 1550–1594, 2602–end. Bodies verbatim. addTabsDiv/addtabsUL are the shared tab DOM refs —
// published to globalThis (faithful: they were file-global vars). Self-invocations are NOT here;
// they move to settings-boot.ts in Task 6.
globalThis.addTabsDiv = globalThis.addTabsDiv;
globalThis.addtabsUL = globalThis.addtabsUL;
```

Paste verbatim (as `export function`): `automationMenuInit` (1–62, **body only — omit the `automationMenuInit()` self-call at :63**), `modifyParentNode` (65–87), `automationMenuSettingsInit` (88–92, **omit self-call at :93**), `createTabs`, `createTabContents`, `toggleTab`, `minimizeAllTabs`, `maximizeAllTabs` (97–125), `initializeAllTabs` (202–267, **omit self-call at :268**), `autoToggle`, `autoPlusSettingsMenu` (1550–1594), `toggleAutoMaps` (2602–end). Replace uses of the file-global `addTabsDiv`/`addtabsUL` with `globalThis.addTabsDiv`/`globalThis.addtabsUL`.

- [ ] **Step 2: Remove those bodies from `legacy/SettingsGUI.js` but KEEP the self-invoke calls + tabs.css link**

Delete the function *definitions* listed above from legacy. **Leave in legacy**: the four bare self-invoke statements (`automationMenuInit();` etc. at their original positions) and the tabs.css `<link>` injection (94–95) — they still run in the legacy tail slot and now call the bridged functions.

- [ ] **Step 3: Register in the bridge**

Add `import * as settingsMenu from './modules/settings-menu'` and `...settingsMenu` to the spread in `src/legacy-bridge.ts`.

- [ ] **Step 4: Build + typecheck + lint**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: all succeed.

- [ ] **Step 5: Chrome smoke — menu renders + tabs work**

`npm run build && npm run serve` → http://localhost:8080/?mute=1. Confirm the AutoTrimps + Auto Maps buttons appear, the settings panel opens (`autoToggle`), tabs switch (`toggleTab`), and minimize/maximize all tabs work. Console clean.

- [ ] **Step 6: Commit**

```bash
git add src/modules/settings-menu.ts src/legacy-bridge.ts legacy/SettingsGUI.js
git commit -m "Phase UI: extract settings-menu.ts (tabs + menu chrome) from SettingsGUI"
```

---

### Task 3: Extract `settings-visibility.ts` (the every-tick reactive layer)

**Files:**
- Create: `src/modules/settings-visibility.ts`
- Modify: `legacy/SettingsGUI.js` (remove bodies 1596–2601), `src/legacy-bridge.ts`

**Interfaces:**
- Produces (`export function`): `updateCustomButtons()`, `checkPortalSettings()`, `getDailyHeHrStats()`, `getDailyRnHrStats()`, `settingsProfileMakeGUI()` (empty stub — the real one is in `import-export.ts`).
- Consumes via globals: `autoTrimpSettings`, `getPageSetting`, `game`, `radonon` computation, `turnOn`/`turnOff`/`toggleElem` (defined inside `updateCustomButtons` scope — keep them local as in the original).

- [ ] **Step 1: Create `src/modules/settings-visibility.ts`**

Header:

```ts
/* eslint-disable */
// @ts-nocheck
// FAITHFUL PORT of legacy/SettingsGUI.js:1596–2601 — the reactive show/hide layer.
// updateCustomButtons runs EVERY TICK (AutoTrimps2.js:370): keep it byte-identical, no added
// allocations. turnOn/turnOff/toggleElem stay as inner helpers exactly as in the original.
```

Paste verbatim as `export function`: `updateCustomButtons` (1596–2562), `checkPortalSettings` (2564), `getDailyHeHrStats` (2582), `getDailyRnHrStats` (2591), `settingsProfileMakeGUI` (2600 — the `{}` stub).

- [ ] **Step 2: Remove bodies 1596–2601 from `legacy/SettingsGUI.js`**

- [ ] **Step 3: Register in the bridge** (`import * as settingsVisibility ...` + `...settingsVisibility`).

- [ ] **Step 4: Build + typecheck + lint**

Run: `npm run build && npm run typecheck && npm run lint` — all succeed.

- [ ] **Step 5: Chrome smoke — reactivity + tick loop**

`npm run build && npm run serve` → http://localhost:8080/?mute=1. Toggle `radonsettings` (U1↔U2) and confirm tabs/settings show/hide correctly. Change AutoPortal dropdown variants and confirm dependent settings appear/disappear. Let the tick loop run ~16s and confirm no console errors (this exercises the every-tick `updateCustomButtons` call from `AutoTrimps2.js:370`).

- [ ] **Step 6: Commit**

```bash
git add src/modules/settings-visibility.ts src/legacy-bridge.ts legacy/SettingsGUI.js
git commit -m "Phase UI: extract settings-visibility.ts (updateCustomButtons) from SettingsGUI"
```

---

### Task 4: Extract `settings-defs.ts` (the 570 setting definitions)

**Files:**
- Create: `src/modules/settings-defs.ts`
- Modify: `legacy/SettingsGUI.js` (remove `initializeAllSettings` body 270–1225; KEEP the `initializeAllSettings();` self-call line), `src/legacy-bridge.ts`

**Interfaces:**
- Produces (`export function`): `initializeAllSettings()` — the 570 `createSetting(...)` calls + interleaved `insertAdjacentHTML('afterend','<br>')` layout calls + float overrides, VERBATIM and IN ORDER.
- Consumes via globals: `createSetting` (bridged from Task 1), DOM element ids referenced by the layout calls.

- [ ] **Step 1: Create `src/modules/settings-defs.ts`**

Header:

```ts
/* eslint-disable */
// @ts-nocheck
// FAITHFUL PORT of legacy/SettingsGUI.js:270–1225 — initializeAllSettings, 570 createSetting calls.
// ORDER AND COMPLETENESS ARE THE PERSISTENCE CONTRACT: the flat saved blob is rehydrated inside
// createSetting; a dropped/renamed/reordered call silently kills that setting. Interleaved <br>
// layout calls (e.g. :290,:311,:343,:421 (x2 for dlowdmg),:461) and float overrides stay adjacent
// to their neighbors, verbatim.
```

Paste the entire body of `initializeAllSettings` (270–1225) verbatim as `export function initializeAllSettings()`.

- [ ] **Step 2: Remove `initializeAllSettings` definition (270–1225) from legacy; KEEP the `initializeAllSettings();` self-call**

- [ ] **Step 3: Register in the bridge** (`import * as settingsDefs ...` + `...settingsDefs`).

- [ ] **Step 4: Build + typecheck + lint**

Run: `npm run build && npm run typecheck && npm run lint` — all succeed.

- [ ] **Step 5: Chrome smoke — settings-count parity**

`npm run build && npm run serve` → http://localhost:8080/?mute=1. In console, run `Object.keys(autoTrimpSettings).length` — record it. Compare against a baseline captured from the current `gh-pages` build (check out the pre-change build or read the count before this phase). Must be identical. Spot-check that every tab still populates with its settings.

- [ ] **Step 6: Commit**

```bash
git add src/modules/settings-defs.ts src/legacy-bridge.ts legacy/SettingsGUI.js
git commit -m "Phase UI: extract settings-defs.ts (570 setting definitions) from SettingsGUI"
```

---

### Task 5: Relocate `nuloom` to `heirlooms.ts`

**Files:**
- Modify: `src/modules/heirlooms.ts` (add `nuloom`), `legacy/SettingsGUI.js` (remove `nuloom` 126–198)

**Interfaces:**
- Produces: `nuloom(slot)` now exported from `heirlooms.ts` (already called from `heirlooms.ts:243,255,265,434`).

- [ ] **Step 1: Move the `nuloom` body**

Cut `nuloom` (legacy 126–198) and paste it into `src/modules/heirlooms.ts` as `export function nuloom(slot) { ... }` (verbatim body). Add a one-line note in the FAITHFUL PORT header that `nuloom` came from SettingsGUI (combat logic, not UI).

- [ ] **Step 2: Remove `nuloom` from `legacy/SettingsGUI.js`**

- [ ] **Step 3: Build + typecheck + lint**

Run: `npm run build && npm run typecheck && npm run lint` — all succeed. (heirlooms is already bridged, so no bridge edit needed.)

- [ ] **Step 4: Chrome smoke — heirloom path**

`npm run build && npm run serve` → http://localhost:8080/?mute=1. With AutoHeirlooms active, let the loop run and confirm no console error from the `nuloom` call sites in heirlooms; heirloom auto-management proceeds.

- [ ] **Step 5: Commit**

```bash
git add src/modules/heirlooms.ts legacy/SettingsGUI.js
git commit -m "Phase UI: relocate nuloom from SettingsGUI to heirlooms.ts (combat logic)"
```

---

### Task 6: Add `settings-boot.ts`, remove `SettingsGUI.js` from the build

**Files:**
- Create: `src/modules/settings-boot.ts`
- Modify: `src/main.ts`, `scripts/build-userscript.mjs`
- Delete: `legacy/SettingsGUI.js` (now containing only the self-invoke calls + tabs.css link)

**Interfaces:**
- Consumes via globals (all bridged by now): `automationMenuInit`, `automationMenuSettingsInit`, `initializeAllTabs`, `initializeAllSettings`, `basepath`.

- [ ] **Step 1: Create `src/modules/settings-boot.ts`**

```ts
/* eslint-disable */
// @ts-nocheck
// Load-time boot for the settings UI. Runs LAST (imported last in main.ts), after the bridge has
// published settings-engine/menu/visibility/defs. Centralizes the "menu before defs" ordering
// contract that legacy/SettingsGUI.js used to enforce by source position.
// Injects tabs.css (was legacy/SettingsGUI.js:94–95).
(function bootSettingsUI() {
  var link1 = document.createElement('link');
  link1.rel = 'stylesheet';
  link1.type = 'text/css';
  link1.href = basepath + 'css/tabs.css';   // MATCH the exact href legacy used at :94–95
  document.head.appendChild(link1);

  automationMenuInit();
  automationMenuSettingsInit();
  initializeAllTabs();
  initializeAllSettings();
})();
```

(Copy the exact `<link>` construction from the current legacy :94–95 — match rel/type/href/id attributes precisely.)

- [ ] **Step 2: Import it last in `main.ts`**

In `src/main.ts`, after the existing side-effect imports (`perks`, `fight-info`, `performance`), add:

```ts
import './modules/settings-boot';
```

- [ ] **Step 3: Remove `SettingsGUI.js` from the manifest**

In `scripts/build-userscript.mjs`, edit `MANIFEST` so it no longer lists `'SettingsGUI.js'` (becomes `['AutoTrimps2.js', 'Graphs.js']`). Update the nearby comment.

- [ ] **Step 4: Delete the emptied legacy file**

```bash
git rm legacy/SettingsGUI.js
```

(Confirm first that nothing remains in it except the moved self-invokes + link, which are now in boot.)

- [ ] **Step 5: Build + typecheck + lint**

Run: `npm run build && npm run typecheck && npm run lint` — all succeed; build output no longer contains a `legacy/SettingsGUI.js` chunk and DOES contain `settings-boot`.

- [ ] **Step 6: Chrome full smoke — cold load**

`npm run build && npm run serve` → http://localhost:8080/?mute=1 on a HARD reload. Confirm the settings menu builds correctly on cold load (this validates the boot ordering + tabs.css injection timing). Console clean through 2–3 tick cycles.

- [ ] **Step 7: Commit**

```bash
git add src/modules/settings-boot.ts src/main.ts scripts/build-userscript.mjs
git commit -m "Phase UI: add settings-boot.ts, drop SettingsGUI.js from build manifest"
```

---

### Task 7: Verification hardening — static test + handler reachability + full soak

**Files:**
- Modify: `tests/build-userscript.test.ts`
- Reference: all new modules

- [ ] **Step 1: Write the failing build-manifest test**

In `tests/build-userscript.test.ts`, add a test asserting the built output (a) does NOT contain the `/* ===== legacy/SettingsGUI.js ===== */` chunk marker, and (b) DOES contain a `settings-boot` marker positioned after the bridge/src bundle. Example:

```ts
test('SettingsGUI.js is removed and settings-boot is bundled', async () => {
  const out = await buildUserscript(); // existing exported builder
  expect(out).not.toContain('legacy/SettingsGUI.js');
  expect(out).toContain('settings-boot');
});
```

- [ ] **Step 2: Run it to confirm it passes (post-Task-6 state)**

Run: `npx vitest run tests/build-userscript.test.ts -v`
Expected: PASS. (If it fails, a chunk was missed in Task 6 — fix before proceeding.)

- [ ] **Step 3: Handler-reachability check in Chrome**

`npm run build && npm run serve` → http://localhost:8080/?mute=1. In console, run:

```js
['settingChanged','autoSetValue','autoSetText','autoSetValueToolTip','autoSetTextToolTip',
 'onKeyPressSetting','toggleTab','minimizeAllTabs','maximizeAllTabs','autoToggle',
 'autoPlusSettingsMenu','toggleAutoMaps','initializeAllSettings','initializeAllTabs',
 'automationMenuInit','automationMenuSettingsInit','updateCustomButtons','checkPortalSettings',
 'createSetting','nuloom'].filter(n => typeof globalThis[n] !== 'function');
```

Expected: `[]` (empty). Any name listed = a missing export = a dead button; fix its module's `export`.

- [ ] **Step 4: Full soak + reset path**

Still in Chrome: exercise a settings reset (triggers `resetAutoTrimps` → `automationMenuSettingsInit`/`initializeAllTabs`/`initializeAllSettings`/`updateCustomButtons` rebuild) and confirm the panel fully rebuilds. Then let AutoTrimps run through a portal cycle against the clone; confirm no console errors and settings persist across a reload (`getPageSetting` returns saved values).

- [ ] **Step 5: Update docs + commit**

Update the spec's status note (mark implemented) and add a line to issue #20 progress (via a commit message `Closes #20` when merging). Commit:

```bash
git add tests/build-userscript.test.ts docs/superpowers/specs/2026-07-08-settingsgui-decomposition-design.md
git commit -m "Phase UI: build-manifest + handler-reachability verification for SettingsGUI breakup"
```

- [ ] **Step 6: Code review**

Dispatch a fresh code-reviewer agent (no implementation bias) over the diff `main..feature/phase-ui-settings-breakup`, focused on: (a) any `createSetting` call dropped/reordered vs original, (b) any inline-handler function not exported, (c) `updateCustomButtons` byte-parity, (d) boot ordering. Address findings before FF-merge.

---

## Self-review

**Spec coverage:** engine/menu/defs/visibility/boot modules ✓ (Tasks 1–4,6); nuloom relocation ✓ (Task 5); bridge + main.ts wiring ✓ (Tasks 1–4,6); manifest removal ✓ (Task 6); persistence contract preserved by verbatim-order copy ✓ (Task 4 header + constraint); handler reachability ✓ (Task 7 Step 3); self-invoke ordering ✓ (Task 6 boot); Chrome verify each task ✓; declarative/updateCustomButtons-simplification explicitly OUT of scope ✓ (spec §Out of scope — not in any task). No gaps.

**Placeholder scan:** no TBD/TODO; each move has exact line ranges + verbatim-copy instruction; verification commands are concrete. The 570 defs are intentionally not inlined (a verbatim move) — the instruction is "paste verbatim from 270–1225," which is unambiguous.

**Type consistency:** function names match across tasks and the Global Constraints handler list (`settingChanged`, `autoSetValue`, etc. identical everywhere); `initializeAllSettings`/`initializeAllTabs`/`automationMenuInit`/`automationMenuSettingsInit` consistent in Tasks 2,4,6,7; `updateCustomButtons` consistent in Tasks 3,6,7.
