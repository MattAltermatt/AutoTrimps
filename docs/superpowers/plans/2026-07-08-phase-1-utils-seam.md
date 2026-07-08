# Phase 1 — utils Conversion & Transition Seam — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `legacy/modules/utils.js` into typed `src/` ES modules behind a global-publish "transition seam," establishing the reusable idiom every later slice copies.

**Architecture:** Build order is unchanged (legacy raw-concat at global scope, THEN the esbuild `src` IIFE). Converted modules `export` normally; `src/legacy-bridge.ts` re-publishes every converted export to `globalThis` so still-legacy code keeps calling them by bare name at runtime. Converted code reads/writes legacy & game globals as free identifiers, typed ambient in `src/game/*.d.ts`. Phase 1 does a faithful verbatim port first (proves the seam live), then peels the two dependency-free leaves (`time.ts`, `buystate.ts`) into focused, unit-tested modules.

**Tech Stack:** TypeScript (strict:false, allowJs), esbuild (IIFE bundle), Vitest, oxlint, Node build script. Verified live in the local Trimps clone (`/Users/matt/dev/MattAltermatt/trimps-game`, v5.10.1).

## Global Constraints

- **No logic changes, no bug-fixes, no behavior tweaks.** Faithful port only.
- **No numeric/tuning changes** (sacrosanct — ask first). Zero numeric literals edited.
- **Copy dense code VERBATIM, never retype** — the minified one-liners (`message2`, `timeStamp`, `preBuy`/`postBuy`, `filterMessage2`) and the two ~2 KB `serializeSettings60`/`serializeSettings550` string blobs. Move by cut/paste; add `export`/types around existing bodies only.
- **`;` guards** stay a concern (ASI) though esbuild bundles the `src` side (less exposed than raw concat).
- **Build order stays: legacy concat → src IIFE** (src last; do NOT reorder).
- **Strict-mode invariant** (ES modules are strict): converted code may read/write a legacy global by bare name ONLY because every such global (`autoTrimpSettings`, `enableDebug`, `ATmessageLogTabVisible`, …) is `var`-declared in `AutoTrimps2.js`, which loads first. Do not introduce a bare write to a never-`var`-declared (implicit) global.
- **Verify loop:** `npm run build && npm run serve` → http://localhost:8080/ . Console must show BOTH boot markers: `[AutoTrimps] modern build booted` and `AutoTrimps - Zek Fork Loaded!`, with no `ReferenceError`.

---

## File Structure

```text
src/
  main.ts                 # MODIFY — import './legacy-bridge' so the bridge runs
  legacy-bridge.ts        # CREATE — Object.assign(globalThis, …converted exports)
  modules/
    utils.ts              # CREATE — faithful port: settings + logging remainder
                          #          + load-time side-effects; imports timeStamp from ./time
    time.ts               # CREATE (Task 2) — pure: timeStamp, formatMinutesForDescriptions
    buystate.ts           # CREATE (Task 3) — preBuy/postBuy(/2); 4 privatized module vars
  game/
    trimps.d.ts           # MODIFY — drop debug/loadPageVariables (now ours); keep `game`
    at-legacy.d.ts        # CREATE — ambient decls for not-yet-converted AT globals
tests/
  build-userscript.test.ts # MODIFY — utils sentinel now comes from the src IIFE section
  time.test.ts             # CREATE (Task 2)
  buystate.test.ts         # CREATE (Task 3)
scripts/
  build-userscript.mjs     # MODIFY — remove 'modules/utils.js' from MANIFEST
legacy/
  modules/utils.js         # DELETE after live verify (Task 4) — oracle consumed
```

---

## Task 1: Faithful `utils.ts` port + the transition seam

**Files:**
- Create: `src/modules/utils.ts`
- Create: `src/legacy-bridge.ts`
- Create: `src/game/at-legacy.d.ts`
- Modify: `src/main.ts`
- Modify: `src/game/trimps.d.ts`
- Modify: `scripts/build-userscript.mjs:12-27` (MANIFEST — remove `'modules/utils.js'`)
- Modify: `tests/build-userscript.test.ts`

**Interfaces:**
- Produces (exported from `src/modules/utils.ts`, published to `globalThis`): `loadPageVariables()`, `safeSetItems(a,b)`, `serializeSettings()`, `serializeSettings60()`, `serializeSettings550()`, `getPageSetting(setting)`, `setPageSetting(setting,value)`, `saveSettings()`, `debug(message,type?,lootIcon?)`, `setTitle()`, `message2(a,b,c,d)`, `filterMessage2(a)`, `formatMinutesForDescriptions(number)`, `throwErrorfromModule()`. (`timeStamp` and the `preBuy*`/`postBuy*` set are still in `utils.ts` at end of Task 1; they move out in Tasks 2–3.)
- Consumes (bare, ambient-typed legacy/game globals): `game`, `autoTrimpSettings`, `enableDebug`, `ATmessageLogTabVisible`, `getCurrentTime`, `updatePortalTimer`, `getTabClass`, `trimMessages`, `aWholeNewWorld`.

- [ ] **Step 1: Create the ambient legacy-globals declaration file**

Create `src/game/at-legacy.d.ts`:

```typescript
// Ambient declarations for AutoTrimps globals that still live in un-converted
// legacy modules (mostly AutoTrimps2.js). Converted code reads/writes these by
// bare name at runtime; this file only satisfies the type-checker. It SHRINKS as
// the owning modules convert — a global moves out of here the moment its module
// becomes a real import.
declare global {
  // Settings store — `var autoTrimpSettings = {}` in AutoTrimps2.js.
  var autoTrimpSettings: any
  // Logging/debug flags — `var` in AutoTrimps2.js.
  var enableDebug: boolean
  var ATmessageLogTabVisible: boolean
  var aWholeNewWorld: any
  // Log helpers defined in still-legacy modules.
  function getCurrentTime(): string
  function updatePortalTimer(flag?: boolean): string
  function getTabClass(displayed: boolean): string
  function trimMessages(b: string): void
}
export {}
```

- [ ] **Step 2: Trim `trimps.d.ts` — remove what is now ours**

`debug` and `loadPageVariables` are defined by `utils.ts` now (real exports), not the game API. Edit `src/game/trimps.d.ts` to delete those two `function` lines, leaving only genuine game globals:

```typescript
// Ambient declarations for the Trimps game global API that AutoTrimps calls into.
// Grown pay-as-you-go as modules are converted. Loose in early phases.
declare global {
  // The Trimps game object. `any` until a converted module needs a real shape.
  const game: any
}
export {}
```

- [ ] **Step 3: Create `src/modules/utils.ts` as a FAITHFUL port**

Copy the ENTIRE current body of `legacy/modules/utils.js` into `src/modules/utils.ts` **verbatim** (cut/paste — do not retype the minified one-liners or the `serializeSettings60`/`serializeSettings550` string blobs). Then apply ONLY these mechanical wrapping edits:

1. Prefix each top-level `function`/`var` that is part of the public API (see the Produces list) with `export`. Example: `function debug(...)` → `export function debug(...)`; leave `timeStamp` and `preBuy*`/`postBuy*` as plain `export function` too for now (they relocate in later tasks — exporting them keeps the bridge publishing them meanwhile).
2. Keep `var lastmessagecount = 1;` and the load-time `ATbutton`/`tab` vars as **non-exported** module-scoped declarations (internal — legacy never references them by name).
3. Keep the three load-time side-effects as top-level statements (they run when the IIFE loads): the `String.prototype.includes` polyfill, the `ATbutton` DOM injection into `#logBtnGroup`, and the `window.onerror` handler.
4. Do NOT add `window.`/`globalThis.` prefixes to any bare global read/write — the strict-mode invariant (Global Constraints) guarantees they resolve.

Exported surface at end of Task 1 (every top-level `function`, plus `var lastmessagecount` stays internal):
`loadPageVariables, safeSetItems, serializeSettings, serializeSettings60, serializeSettings550, getPageSetting, setPageSetting, saveSettings, debug, timeStamp, preBuy, postBuy, preBuy2, postBuy2, setTitle, message2, filterMessage2, formatMinutesForDescriptions, throwErrorfromModule`.

- [ ] **Step 4: Create the seam bridge `src/legacy-bridge.ts`**

```typescript
// The transition seam. Re-publishes every converted module's exports onto the
// global object so still-legacy code (raw-concatenated at global scope) keeps
// resolving them by bare name at runtime. Wildcard-spread from the module
// namespace: anything `export`ed is auto-published — you cannot forget a name.
// This manifest shrinks to nothing as the strangle completes.
import * as utils from './modules/utils'

Object.assign(globalThis, { ...utils })
```

- [ ] **Step 5: Wire the bridge into boot — modify `src/main.ts`**

Prepend the bridge import so it runs (keep the existing boot marker):

```typescript
// Phase 1: the seam is live — converted modules publish to global via the bridge,
// which runs after the legacy concat (this IIFE is emitted last).
import './legacy-bridge'

console.log('[AutoTrimps] modern build booted')
```

- [ ] **Step 6: Remove `utils.js` from the build manifest**

In `scripts/build-userscript.mjs`, edit the `MANIFEST` array (line ~13) to delete the `'modules/utils.js',` entry. The line currently reads:

```javascript
  'AutoTrimps2.js',
  'modules/utils.js',
  'modules/import-export.js', 'modules/query.js', 'modules/calc.js', 'modules/portal.js',
```

Change to:

```javascript
  'AutoTrimps2.js',
  'modules/import-export.js', 'modules/query.js', 'modules/calc.js', 'modules/portal.js',
```

(Leave `legacy/modules/utils.js` on disk for now — it's the oracle until Task 4.)

- [ ] **Step 7: Update the build test — utils sentinel now comes from the src IIFE**

`loadPageVariables` is no longer in the legacy concat section; esbuild preserves the name in the src bundle. In `tests/build-userscript.test.ts`, move/relabel that assertion so it documents the new source. Replace the line:

```typescript
    expect(out).toContain('function loadPageVariables') // utils.js
```

with:

```typescript
    // utils is now a converted src module, published via legacy-bridge (Phase 1)
    expect(out).toContain('function loadPageVariables') // from src IIFE, not legacy concat
    expect(out).toContain('Object.assign(globalThis') // the seam bridge is bundled
```

- [ ] **Step 8: Typecheck, lint, build**

Run: `npm run typecheck`
Expected: PASS (no errors — ambient decls cover the bare globals).

Run: `npm run lint`
Expected: PASS.

Run: `npm run build`
Expected: `[build] dist/autotrimps.user.js (…bytes)` with no esbuild error.

- [ ] **Step 9: Run the test suite**

Run: `npm test`
Expected: PASS — `build-userscript` test green with the updated assertions.

- [ ] **Step 10: Commit**

```bash
git add src/modules/utils.ts src/legacy-bridge.ts src/main.ts src/game/at-legacy.d.ts src/game/trimps.d.ts scripts/build-userscript.mjs tests/build-userscript.test.ts
git commit -m "Phase 1: convert utils.js to src module behind global-publish seam"
```

---

## Task 2: Peel `time.ts` (pure leaf) with tests

**Files:**
- Create: `src/modules/time.ts`
- Create: `tests/time.test.ts`
- Modify: `src/modules/utils.ts` (remove the two functions; import `timeStamp`)
- Modify: `src/legacy-bridge.ts` (publish `time` too)

**Interfaces:**
- Produces: `timeStamp(): string`, `formatMinutesForDescriptions(number: number): string`.
- Consumes: `utils.ts`'s `debug` calls `timeStamp()` — after this task `utils.ts` imports it from `./time`.

- [ ] **Step 1: Write the failing test**

Create `tests/time.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatMinutesForDescriptions } from '../src/modules/time'

describe('formatMinutesForDescriptions', () => {
  it('formats sub-hour durations as "M minutes S seconds"', () => {
    // 5.5 minutes → 5 minutes 30 seconds (hours == 0 branch)
    expect(formatMinutesForDescriptions(5.5)).toBe('5 minutes 30 seconds')
  })

  it('formats multi-hour durations as H:MM:SS', () => {
    // 125.5 minutes → 2 hours, 05 minutes, 30 seconds (minutes>0 branch, zero-padded)
    expect(formatMinutesForDescriptions(125.5)).toBe('2:05:30')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/time.test.ts`
Expected: FAIL — cannot resolve `../src/modules/time` (module does not exist yet).

- [ ] **Step 3: Create `src/modules/time.ts`**

Cut `timeStamp` (line ~146) and `formatMinutesForDescriptions` (lines ~157-176) VERBATIM from `utils.ts` into a new file, adding `export`:

```typescript
// Pure time formatting — no game/DOM/legacy dependencies. Fully unit-testable.
export function timeStamp(){for(var a=new Date,b=[a.getHours(),a.getMinutes(),a.getSeconds()],c=1;3>c;c++)10>b[c]&&(b[c]="0"+b[c]);return b.join(":")}

export function formatMinutesForDescriptions(number: number){
    var text;
    var seconds = Math.floor((number*60) % 60);
    var minutes = Math.floor(number % 60);
    var hours = Math.floor(number / 60);
    if (hours == 0)
        text = minutes + " minutes " + seconds + " seconds";
    else if (minutes > 0) {
        if (minutes < 10) minutes = "0" + minutes;
        if (seconds < 10) seconds = "0" + seconds;
        text = hours + ":" + minutes + ":" + seconds;
    }
    else {
        var hs = (hours > 1) ? "s" : "";
        var ms = (minutes > 1) ? "s" : "";
        var ss = (seconds > 1) ? "s" : "";
        text = hours + " hour" + hs + " " + minutes + " minute" + ms + " " + seconds + " second" + ss;
    }
    return text;
}
```

- [ ] **Step 4: Remove the two functions from `utils.ts` and import `timeStamp`**

Delete the `timeStamp` and `formatMinutesForDescriptions` definitions from `src/modules/utils.ts`. At the top of `utils.ts`, add:

```typescript
import { timeStamp } from './time'
```

(`debug` in `utils.ts` calls `timeStamp()`; it now resolves via this import. `formatMinutesForDescriptions` has no in-`utils` caller — it was only ever called by other legacy modules, which now reach it via the bridge.)

- [ ] **Step 5: Publish `time` through the bridge — modify `src/legacy-bridge.ts`**

```typescript
import * as utils from './modules/utils'
import * as time from './modules/time'

Object.assign(globalThis, { ...utils, ...time })
```

- [ ] **Step 6: Run tests + typecheck + build**

Run: `npx vitest run tests/time.test.ts`
Expected: PASS (both cases).

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/modules/time.ts tests/time.test.ts src/modules/utils.ts src/legacy-bridge.ts
git commit -m "Phase 1: peel time.ts (timeStamp, formatMinutes) from utils + tests"
```

---

## Task 3: Peel `buystate.ts`, privatizing the pre-buy state

**Files:**
- Create: `src/modules/buystate.ts`
- Create: `tests/buystate.test.ts`
- Modify: `src/modules/utils.ts` (remove `preBuy`/`postBuy`/`preBuy2`/`postBuy2`)
- Modify: `src/legacy-bridge.ts` (publish `buystate` too)

**Interfaces:**
- Produces: `preBuy(): void`, `postBuy(): void`, `preBuy2(): any[]`, `postBuy2(a: any[]): void`.
- Consumes: `game.global` (buyAmt/firing/lockTooltip/maxSplit). The 4 `preBuy*` values are now **module-private** (not legacy globals) — verified no external reader (perks.js uses its own function-local shadows; only other.js calls `preBuy`/`postBuy`).

- [ ] **Step 1: Write the failing test**

Create `tests/buystate.test.ts`. It round-trips the 4 `game.global` fields through the private state, proving save→mutate→restore:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { preBuy, postBuy, preBuy2, postBuy2 } from '../src/modules/buystate'

// Minimal game stub — buystate only touches game.global's 4 buy fields.
beforeEach(() => {
  ;(globalThis as any).game = { global: { buyAmt: 1, firing: true, lockTooltip: false, maxSplit: 7 } }
})

describe('buystate preBuy/postBuy', () => {
  it('restores the 4 buy fields after they are mutated', () => {
    preBuy()
    const g = (globalThis as any).game.global
    g.buyAmt = 999; g.firing = false; g.lockTooltip = true; g.maxSplit = 0
    postBuy()
    expect(g).toEqual({ buyAmt: 1, firing: true, lockTooltip: false, maxSplit: 7 })
  })

  it('preBuy2/postBuy2 round-trip via an explicit array', () => {
    const saved = preBuy2()
    const g = (globalThis as any).game.global
    g.buyAmt = 42; g.firing = false; g.lockTooltip = true; g.maxSplit = 3
    postBuy2(saved)
    expect(g).toEqual({ buyAmt: 1, firing: true, lockTooltip: false, maxSplit: 7 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/buystate.test.ts`
Expected: FAIL — cannot resolve `../src/modules/buystate`.

- [ ] **Step 3: Create `src/modules/buystate.ts` with privatized state**

The original `preBuy`/`postBuy` read/write the AutoTrimps2.js globals `preBuyAmt`/`preBuyFiring`/`preBuyTooltip`/`preBuymaxSplit`. No external code reads those globals (verified), so make them module-private `let`s — behavior-identical, and they leave the global surface:

```typescript
// Buy-state save/restore. The 4 saved values are module-private (previously
// AutoTrimps2.js globals with no external reader). preBuy/postBuy are a matched
// pair; preBuy2/postBuy2 pass the snapshot explicitly via an array.
let preBuyAmt: any, preBuyFiring: any, preBuyTooltip: any, preBuymaxSplit: any

export function preBuy(){preBuyAmt=game.global.buyAmt,preBuyFiring=game.global.firing,preBuyTooltip=game.global.lockTooltip,preBuymaxSplit=game.global.maxSplit}
export function postBuy(){game.global.buyAmt=preBuyAmt,game.global.firing=preBuyFiring,game.global.lockTooltip=preBuyTooltip,game.global.maxSplit=preBuymaxSplit}
export function preBuy2(){return[game.global.buyAmt,game.global.firing,game.global.lockTooltip,game.global.maxSplit]}
export function postBuy2(a: any[]){game.global.buyAmt=a[0],game.global.firing=a[1],game.global.lockTooltip=a[2],game.global.maxSplit=a[3]}
```

- [ ] **Step 4: Remove the 4 functions from `utils.ts`**

Delete the `preBuy`, `postBuy`, `preBuy2`, `postBuy2` definitions (lines ~147-150) from `src/modules/utils.ts`. (Nothing inside `utils.ts` calls them.) The now-dead `var preBuyAmt;` … lines in `legacy/AutoTrimps2.js` are harmless unused globals — leave the oracle untouched.

- [ ] **Step 5: Publish `buystate` through the bridge**

```typescript
import * as utils from './modules/utils'
import * as time from './modules/time'
import * as buystate from './modules/buystate'

Object.assign(globalThis, { ...utils, ...time, ...buystate })
```

- [ ] **Step 6: Run tests + typecheck + build**

Run: `npx vitest run tests/buystate.test.ts`
Expected: PASS (both cases).

Run: `npm test`
Expected: PASS (all suites — build, time, buystate).

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add src/modules/buystate.ts tests/buystate.test.ts src/modules/utils.ts src/legacy-bridge.ts
git commit -m "Phase 1: peel buystate.ts, privatize pre-buy state + tests"
```

---

## Task 4: Live verification in the Trimps clone (the real gate)

**Files:** none (verification only). After this passes, delete `legacy/modules/utils.js`.

- [ ] **Step 1: Build and serve**

Run: `npm run build`
Then start the static server (background): `npm run serve` → serves the clone at http://localhost:8080/ .

- [ ] **Step 2: Boot the game and read the console**

Open http://localhost:8080/ in Chrome (via chrome-devtools MCP). Confirm the console shows BOTH:
```text
[AutoTrimps] modern build booted
AutoTrimps - Zek Fork Loaded!
```
and NO `ReferenceError` / `is not defined`. (A missing global publish would surface here as `debug is not defined` or similar from a legacy module.)

- [ ] **Step 3: Exercise the utils surface end-to-end**

Verify against the spec's behavioral checklist:
- The **"AutoTrimps" log-filter button** is present in the log button group (the moved `ATbutton` — its load-time position shifted from concat-pos-2 to the src IIFE; confirm it still renders).
- AutoTrimps **log lines appear** in the message log (`debug` / `message2` publishing works).
- The **settings GUI opens**; toggling a setting persists across a reload (`getPageSetting` / `setPageSetting` / `saveSettings`).
- Let it **drive a few cycles** (buys/fights/maps) with no divergence from prior behavior and no console errors.

- [ ] **Step 4: Delete the consumed oracle + commit**

Once the live verify is clean:

```bash
git rm legacy/modules/utils.js
git commit -m "Phase 1: remove utils.js oracle (src port verified live)"
```

---

## Task 5: Code review (required phase — fresh reviewer)

- [ ] **Step 1:** Dispatch a fresh `feature-dev:code-reviewer` agent (no implementation bias) over the Phase 1 diff (`git diff gh-pages...feature/phase-1-utils-seam`). Focus: (a) the port is faithful — no accidental logic/behavior/numeric drift vs `legacy/modules/utils.js` at its pre-deletion revision; (b) the seam publishes the full surface legacy needs; (c) no bare write to a non-`var`-declared global; (d) the `serializeSettings60`/`550` blobs are byte-identical to the original.
- [ ] **Step 2:** Triage findings. Apply fixes as follow-up commits; re-run `npm test && npm run typecheck && npm run build`.

---

## Task 6: Docs + FF-merge prep

- [ ] **Step 1:** Update `ROADMAP.md` — mark Phase 1 done (with date) and note the seam idiom is established; prune completed Phase 1 todos.
- [ ] **Step 2:** Final verification gate: `npm test && npm run typecheck && npm run lint && npm run build` all green; live boot re-confirmed.
- [ ] **Step 3:** Hand off for user-verify-before-FF-merge (surface the running URL + what to inspect). On approval: squash the branch to one commit, FF-merge to `gh-pages`, delete the feature branch (local + remote if pushed) as the final merge step.

---

## Self-Review

**Spec coverage** (checked against `2026-07-08-phase-1-utils-seam-design.md`):
- Seam mechanism A (src-last + wildcard `Object.assign` publish) → Task 1 Steps 4-6. ✅
- Ambient types (`trimps.d.ts` game + new `at-legacy.d.ts`) → Task 1 Steps 1-2. ✅
- Faithful verbatim port → Task 1 Step 3 + Global Constraints. ✅
- Peel `time.ts` (pure) + `buystate.ts` (game-only) with tests → Tasks 2-3. ✅
- settings↔logging stay tangled in `utils.ts` remainder → not split (Task 1 keeps them). ✅
- Load-time side-effects stay in `utils.ts` → Task 1 Step 3(3). ✅
- Parity idiom: vitest on leaves + exact-string guard + Chrome eyeball → Tasks 2-4. ✅ (See note below.)
- Transcription mitigation (verbatim copy) → Global Constraints + each create step. ✅
- ATbutton timing shift eyeball → Task 4 Step 3. ✅
- Strict-mode write invariant → Global Constraints + Task 3 privatization. ✅
- Remove `utils.js` from manifest + delete after verify → Task 1 Step 6, Task 4 Step 4. ✅

**Gap fixed inline:** the spec calls for an EXACT-STRING vitest guard on `serializeSettings60`/`550`, but those functions stay in the tangled `utils.ts` remainder (they need `autoTrimpSettings`-adjacent context and aren't peeled). Rather than add a brittle 2 KB string literal to the test suite, the byte-identity of those blobs is covered by (a) the verbatim-copy rule, and (b) Task 5 Step 1(d) — the reviewer diffs them against the pre-deletion original. This is stronger than a hand-transcribed expected-string (which would itself be a transcription hazard). No separate task needed.

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `timeStamp`/`formatMinutesForDescriptions` signatures match between Task 2 `time.ts` and their `utils.ts` import; `preBuy`/`postBuy`/`preBuy2`/`postBuy2` names consistent across Task 3 and the bridge; bridge namespace spread (`...utils`, `...time`, `...buystate`) grows monotonically across Tasks 1→2→3.
