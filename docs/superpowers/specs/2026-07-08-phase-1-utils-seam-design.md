# Phase 1 — First Module Conversion & the Transition Seam

**Date:** 2026-07-08
**Status:** Approved (brainstorm) → ready for implementation plan
**Parent spec:** `2026-07-08-autotrimps-modernization-design.md`
**Module:** `legacy/modules/utils.js` → `src/modules/*.ts`

---

## 🎯 Goal

Convert the first real module — `utils.js`, the root of the dependency graph — into
typed ES modules, and in doing so **lock the reusable "transition seam" idiom** that
every one of the ~25 later slices copies. The seam is the mechanism by which a converted
`src/` module (isolated in the esbuild IIFE) stays reachable, by bare name, from the
still-legacy code (raw-concatenated at global scope) — in both directions — while the
migration is only half-done.

Getting this right matters more than the module itself: `utils.js` is depended on by
everything, and the pattern set here is inherited by monsters later (`calc.js` 69 KB,
`maps.js` 76 KB, `other.js` 103 KB).

---

## 🧩 The seam problem

Legacy modules are **not** ES modules. The Phase-0 build raw-concatenates them at the
userscript's top-level (global) scope, so every `function debug(){}` is effectively a
`window` global and any other legacy file can call it by bare name. esbuild bundles the
modern side (`src/main.ts` + its imports) into a **separate IIFE** with its own scope.

The moment `utils.js` becomes `src/modules/utils.ts` with real `export`s, those exports
are trapped inside the IIFE — legacy bare-name callers can no longer see them. The seam
must bridge **both** directions:

```text
  legacy    ──calls──▶  converted   (debug, getPageSetting, saveSettings, …)
  converted ──reads──▶  legacy/game (game, autoTrimpSettings, enableDebug, …)
```

**Load-order fact (CORRECTED after live verify, 2026-07-08):** an initial col-0 grep
suggested no legacy module calls a `utils` function at load time — this was **wrong**
(the grep pattern only matched calls at column 0). `legacy/modules/portal.js:4` runs
`var portalzone = getPageSetting('CustomAutoPortal');` at **module-load time**, and
`magmite.js` / `SettingsGUI.js` etc. also call converted functions during load. So the
seam **must publish converted functions before the still-legacy modules that consume
them evaluate** — see the corrected ordering in Decision A below. (`utils.js` itself only
reaches *back* into legacy/game globals at runtime, and its load-time side-effects touch
only game DOM — so the src bundle can safely run early.)

---

## 🚪 Seam mechanism (Decision A — locked, ordering CORRECTED post-verify)

**Converted modules publish their exports onto the global object; the src bundle is
emitted at the load-order slot the first-converted module occupied — for `utils` that's
immediately after `AutoTrimps2.js`, BEFORE the remaining legacy modules.**

```text
Build output order (Phase 1):
  [ AutoTrimps2.js ]  then  [ src IIFE — publishes converted exports ]  then  [ rest of legacy ]

Originally this doc specified "src IIFE runs LAST" (src-last). Live verify falsified that:
portal.js's top-level getPageSetting() threw ReferenceError before the end-of-bundle
bridge ran, halting the whole concatenated script. The bridge must publish BEFORE any
still-legacy module that calls a converted function at load time. Emitting the src bundle
right after AutoTrimps2.js (utils.js's original slot) fixes it and is the most faithful to
Phase-0 load order. The general idiom: the converted-modules bundle goes as early as the
earliest still-legacy load-time caller requires — in practice, right after AutoTrimps2.js
(which defines the base globals) and before every other legacy module.

Inside the src IIFE, a single bridge module re-publishes every converted export to the
global object, so legacy bare-name calls resolve to it:

  // src/legacy-bridge.ts  — the seam manifest ("what the modern side exposes back")
  import * as utils    from './modules/utils'
  import * as time     from './modules/time'
  import * as buystate from './modules/buystate'
  Object.assign(globalThis, { ...utils, ...time, ...buystate })
```

Why this shape:

- **Wildcard-from-namespace, not a hand-maintained list.** Everything a module `export`s
  is published automatically, so you cannot *forget* to publish a name (a class of bug
  `tsc` would NOT catch). The published surface is controlled purely by the `export`
  keyword. Over-publishing is harmless (legacy merely gains a name it wasn't using).
- **src emitted after AutoTrimps2.js, before the rest (NOT src-last).** Still-legacy
  modules DO call converted functions at load time (`portal.js:4`), so the bridge must
  publish first. The src bundle takes `utils.js`'s original slot: right after
  `AutoTrimps2.js` (which `var`-declares the base globals `utils` reads at runtime) and
  before every other legacy module. Per future slice, re-check load-time callers with a
  PROPER grep (not just col-0) — the bundle's early slot already covers them, since it
  precedes all legacy modules except `AutoTrimps2.js`.
- **Why not src-first (before AutoTrimps2.js too):** would also work (converted load-time
  code touches only game DOM, not AT globals), but placing src right after `AutoTrimps2.js`
  reproduces `utils.js`'s exact Phase-0 position — most faithful, minimal behavior shift.
- **Rejected — esbuild `globalName`/footer auto-attach through an `AT.*` object:** would
  require rewriting legacy call sites, violating "legacy stays untouched."

### Reaching back the other way (converted → legacy/game)

Converted code references still-legacy and game globals as **free identifiers**, resolved
at runtime against `window`. To satisfy the type-checker, they are declared ambient:

- `src/game/trimps.d.ts` — **game** globals (`game`, DOM helpers the game owns, …).
  Already stubbed in Phase 0; grow pay-as-you-go.
- `src/game/at-legacy.d.ts` — **AutoTrimps** globals that live in still-legacy modules
  and haven't been converted yet (`autoTrimpSettings`, `enableDebug`,
  `ATmessageLogTabVisible`, `getCurrentTime`, `updatePortalTimer`, `getTabClass`,
  `trimMessages`, `aWholeNewWorld`, `preBuyAmt`/`preBuyFiring`/`preBuyTooltip`/
  `preBuymaxSplit`). These are declared `any`-ish and **shrink** as their owning modules
  convert. (All four `preBuy*` vars are declared in `AutoTrimps2.js`, not `utils`, so
  `utils.ts` reads/writes them as externals — correct for the ambient plan.)

This `at-legacy.d.ts` doubles as a live ledger of "what's still legacy that the modern
side leans on."

---

## 🪚 Slice structure (locked): faithful move → peel the clean leaves

Phase 1 is **one slice, two steps**, both behind the seam. This teaches the idiom that
actually scales to the 100 KB monsters: *port faithfully, prove it live, then refactor
the insides freely.*

### Step 1 — Faithful port + seam (the load-bearing step)

Move `utils.js` → `src/modules/utils.ts` **verbatim** (same functions, same names, zero
logic change), turned into a real typed module that publishes through `legacy-bridge.ts`.
This is the step that proves the doorway works. Because *only* "where the code lives"
changes, any regression is trivially isolatable to the seam. Verify live in the clone,
commit.

### Step 2 — Peel the two genuinely-clean pieces

The obvious "4 clean files" carve does **not** split cleanly: settings and logging are
**circularly coupled** —

```text
  debug()        (logging)  ──▶ getPageSetting() (settings)
  safeSetItems() (settings)  ──▶ debug()          (logging)
```

So settings + logging stay together (as the shrinking `utils.ts` remainder) — untangling
that knot is its own future slice, not a rushed Phase-1 cut. But two groups are true,
dependency-free leaves and get extracted into focused, unit-tested modules:

```text
  src/modules/time.ts      timeStamp, formatMinutesForDescriptions        (pure)
  src/modules/buystate.ts  preBuy, postBuy, preBuy2, postBuy2             (game-globals only)
```

Step 2 is a **pure inside-the-modern-side reshuffle** — legacy can't tell it happened
(same names on the global surface), so it carries **none** of the seam/integration cost;
`tsc` + vitest + a quick re-boot cover it. This is why "do it once" wins without the
double-integration tax the split-now case worried about.

**Remainder after peeling** (`utils.ts`): the settings accessors
(`getPageSetting`/`setPageSetting`/`saveSettings`/`serializeSettings`/
`serializeSettings60`/`serializeSettings550`/`loadPageVariables`/`safeSetItems`), the
logging cluster (`debug`/`message2`/`filterMessage2` + `lastmessagecount`), `setTitle`,
`throwErrorfromModule`, and the load-time side-effects below.

### Load-time side-effects — stay in `utils.ts`

Three statements execute at module-eval (not on call): the `String.prototype.includes`
polyfill, the `ATbutton` log-filter DOM injection (`appendChild` to the game's
`#logBtnGroup`), and the `window.onerror` handler. They stay as top-level code in
`utils.ts`; the src bundle runs right after `AutoTrimps2.js` (utils.js's original slot),
so these fire at essentially their Phase-0 position — negligible timing shift. None touch
AutoTrimps state and the button only appends to a game DOM node. **Verified in the Chrome
eyeball:** the "AutoTrimps" log-filter button renders correctly.

---

## 🗂️ File layout after Phase 1

```text
src/
  main.ts                 # boots; imports legacy-bridge (unchanged boot marker)
  legacy-bridge.ts        # NEW — Object.assign(globalThis, …converted exports)
  modules/
    utils.ts              # NEW — settings + logging remainder + load-time side-effects
    time.ts               # NEW — pure time formatting  (+ tests)
    buystate.ts           # NEW — pre/postBuy save-restore
  game/
    trimps.d.ts           # game globals (grow)
    at-legacy.d.ts        # NEW — ambient decls for not-yet-converted AT globals
tests/
  time.test.ts            # NEW
  buystate.test.ts        # NEW (light — asserts save/restore round-trips the 4 fields)

legacy/
  modules/utils.js        # DELETED once the src port is verified live (oracle consumed)
```

`legacy/modules/utils.js` is removed from the build `MANIFEST` and (once verified)
deleted — that slot is now served by the src side.

---

## ✅ Verification & the parity idiom (reusable)

Two layers, applied to this slice and every later one:

```text
Automated (fast):
  • vitest  — the pure leaves: time.ts (timeStamp, formatMinutesForDescriptions) and
              buystate.ts (round-trip the 4 game.global fields). Plus an EXACT-STRING
              test on serializeSettings60/550 as a transcription guard (see below).
  • tsc --noEmit + oxlint + "bundle builds clean".

Behavioral (the real gate — live clone):
  • Boot the built userscript in the Trimps clone (npm run build && npm run serve →
    http://localhost:8080/). Console must show BOTH boot markers:
      [AutoTrimps] modern build booted   +   AutoTrimps - Zek Fork Loaded!
    and be free of ReferenceErrors (a missing global publish shows up here).
  • Exercise the utils surface end-to-end: settings GUI opens and toggles persist
    (getPageSetting/setPageSetting/saveSettings), AutoTrimps log lines appear (debug/
    message2), and the "AutoTrimps" log-filter button is present (the moved ATbutton).
  • Let it drive: watch it buy/fight/map a few cycles with no divergence from prior
    behavior. User inspects and confirms before FF-merge.
```

### ⚠️ Dominant real risk: transcription, not file count

The referee flagged that the biggest actual hazard in *either* structure is fat-fingering
the port — several functions are dense minified one-liners (`message2`, `timeStamp`,
`preBuy`/`postBuy`, `filterMessage2`) and there are two ~2 KB frozen settings-string
literals (`serializeSettings60`/`550`). Mitigations, baked into the plan:

- **Copy verbatim, never retype.** Move the file, add `export`/types around existing
  bodies; do not reformat or hand-transcribe the minified one-liners or the big literals.
- **`;` guard discipline** stays (ASI hazard — see `feedback-concat-hazards`), though the
  src side is bundled by esbuild so it's less exposed than raw concat.
- **Exact-string vitest** on `serializeSettings60`/`550` catches any drift in those blobs.

---

## 🚫 Explicitly NOT in Phase 1

- No untangling settings↔logging (future slice).
- No logic changes, no bug-fixes, no behavior tweaks, **no numeric/tuning changes**
  (sacrosanct — ask first).
- No converting any other module.
- Build ordering IS changed: the src bundle moves from last → right after `AutoTrimps2.js`
  (required for the seam — see Decision A). This is the one intentional structural change.

---

## ⚠️ Risks & mitigations

```text
Risk                                         Mitigation
-------------------------------------------  -------------------------------------------
A converted export not reaching legacy       Wildcard publish (can't forget a name);
                                             live boot surfaces ReferenceErrors.
Ported function transcribed wrong            Copy verbatim; exact-string tests on the
                                             serialize blobs; live eyeball.
Still-legacy module calls a converted fn    Publish the src bundle BEFORE the rest of the
at load time (portal.js:4)                   legacy modules (after AutoTrimps2.js); build
                                             test guards the order; live boot confirms.
settings↔logging circular import if split    Not split this slice — kept together.
Ambient `any` hides a real type bug          Acceptable at strict:false; tighten as the
                                             owning modules convert.
```
