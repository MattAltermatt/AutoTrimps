# AutoTrimps Modernization — Design Spec

**Date:** 2026-07-08
**Status:** Implemented — Phases 0–2, Phase UI (#20), Phase Parity (#21) shipped to `gh-pages`. This spec remains the living architecture reference; remaining legacy = `AutoTrimps2.js` + `Graphs.js`/highcharts/mods. Live phase status: [GitHub Milestones](https://github.com/MattAltermatt/AutoTrimps/milestones).
**Horizon:** Long-term, multi-session side project

---

## 🎯 Goal

Modernize the AutoTrimps userscript — a ~18,000-line legacy TamperMonkey automation
script for the *Trimps* incremental game — from a build-less pile of global-scope
injected `<script>`s into a modern, modular, typed, testable codebase, **without ever
losing a working, verifiable build**. This is driver **C** ("modernize the whole thing")
executed as an incremental strangler over many sessions.

The user's four stated goals map onto the roadmap:

- **Modular** → per-module TS conversion phases
- **User-friendly** → dedicated UI/UX phase (break up `SettingsGUI.js`)
- **Squash bugs** → opportunistic during conversion + a dedicated sweep
- **Add features Trimps added** → a game-parity phase (sync to Trimps v5.10.1)
- **Fix Issues in the original** → fold the fork's known issues into the bug phase

We have **license to invent and restructure** — this is not a conservative
keep-the-shape refactor. "Don't reinvent" only means: do not start over from a blank
slate (a prior `auto-trimps/` TS rewrite was abandoned for exactly that reason).

---

## 📐 Strategy: Incremental strangler (chosen approach A)

1. **Phase 0** stands up a real toolchain that bundles the *existing* modules ~as-is
   into one userscript, loads it in a local Trimps clone, and gets a **green
   "still drives Trimps identically" baseline**. That baseline is the seam.
2. Then each session converts **one module** to a real typed ES module behind that
   stable harness, verifies parity in the live clone, and commits.
3. Bug-fixes, parity features, and UX fold in as we touch each area.

Rejected alternatives:
- **B — big-bang rewrite to clean TS up front.** This is the "reinvent the wheel" the
  user explicitly killed. Longest time-to-first-verify, highest risk.
- **C — toolchain-only, defer all refactor.** Leaves the hard part undone; equivalent to
  stopping after Phase 0.

**Conversion target language: TypeScript, gradual.** `allowJs: true`, `strict` off at
first, tightened per-module as each is converted. Vite bundles mixed JS+TS so Phase 0
produces a working bundle from unchanged `.js`; typing is pay-as-you-go. Chosen over
plain ESM JS because TS catches the exact bug class this global-soup code is riddled
with (mistyped global names, undefined access, wrong arg counts, silent NaN), and it
matches every other project in this workspace (freshet, diversion, in-kind, pyr3 — all
Vite + TS).

---

## 🏗️ Target architecture & repo layout

**Shipping target stays a single Tampermonkey userscript** — the only real distribution
channel for a Trimps automation script — but **built, not hand-assembled**. Vite bundles
everything into one self-contained IIFE with a generated `// ==UserScript==` header,
replacing the 27 injected `<script>` tags pulled from a GitHub URL. `Graphs.js`
(currently loaded remotely from another fork) is **vendored in** so the bundle is
self-contained.

```text
AutoTrimps/
  src/
    main.ts                 # entry: replaces AutoTrimps2.js loader + init
    modules/                # the 26 modules, migrated .js → .ts one slice at a time
      calc.ts  maps.ts  perks.ts  ...
    ui/settings.ts          # the 253 KB SettingsGUI.js, broken up over time
    game/trimps.d.ts        # growing ambient types for the game's global API (the seam)
    vendor/graphs.ts        # vendored Graphs + highcharts
  tests/                    # vitest — pure logic (calc, gains, breed timers…)
  dist/autotrimps.user.js   # the built userscript (what Tampermonkey installs)
  legacy/                   # CURRENT .js files, moved here untouched as the oracle;
                            # a file is deleted only once its src/ port is verified
  vite.config.ts  tsconfig.json  package.json  .eslintrc  # matching other projects
  ROADMAP.md                # the multi-session phase tracker
```

Two deliberate choices:

- **`legacy/` holding pen (behavioral oracle).** Phase 0 keeps the exact current code
  runnable (moved, not rewritten) so we always have something to diff behavior against.
  A module leaves `legacy/` only when its `src/` port is verified in the live game. This
  is what makes "parity" *checkable* instead of hopeful.
- **`trimps.d.ts` is the seam.** Every function/global we call into Trimps
  (`game.global`, `game.resources`, `getPerkLevel()`, `canAffordBuilding()`, …) is
  declared here as we touch it. It doubles as the living map of what AutoTrimps actually
  depends on in the game — which no doc currently captures.

The `mods.js` / `.user.js` / `GraphsOnly.*` loader files are reworked into a proper
userscript header emitted by the build, kept working for both Steam-mods and browser.

---

## 🔁 Dev & verification loop

For this project, *proving* a slice works is the whole ballgame — a refactor that
"compiles" but silently breaks the automation is worse than no refactor.

```text
1. Vite build --watch  →  emits dist/autotrimps.user.js (IIFE)
2. Static server serves trimps-game/ on localhost (lead starts it; hands over the URL)
3. trimps-game/index.html gets ONE added <script> tag pointing at our built bundle
   (a local-only edit to the game clone — never committed to the game's history)
4. Reload the game → our script boots → settings GUI appears → it drives Trimps
5. Verify via Chrome DevTools MCP — watch it kill enemies, buy buildings, run maps,
   spend resources — and read console for errors
```

**Two verification layers, applied per slice:**

```text
Automated (fast, every slice):
  • vitest unit tests on pure logic we extract (damage/health/gains/breed-timer math)
  • tsc typecheck + eslint + "bundle builds clean"

Behavioral (the real gate, in the live clone):
  • Phase 0: bundle-from-unchanged-modules behaves identically → parity by construction
    (same code, new packaging) — just confirm it boots and drives the game
  • Later slices: run BOTH old (legacy/) and new (src/) against the same save and watch
    for divergence in what they buy / fight / map. The legacy/ oracle makes this concrete.
```

The one thing that can't be fully automated is "does the automation make the *same
decisions*" — that's eyeball-in-Chrome against a real save, which is why the local clone
(seedable with a save) matters. The lead surfaces the running URL each verify session;
the user inspects and confirms before any FF-merge.

**The local Trimps clone** lives at `/Users/matt/dev/MattAltermatt/trimps-game`
(Trimps **v5.10.1**). The user has granted full permission to modify it as a test
harness. It is a separate git repo; our injection edits stay local/uncommitted there.

---

## ✅ Phase 0 — Foundation baseline (fully scoped)

Phase 0's job is **one green, verified baseline**: modern toolchain, *identical*
behavior. Concretely:

```text
0. Remove the dead auto-trimps/ project + the stray auto-trimps.user.js from the game
   folder (git-tracked → recoverable; user-authorized).
1. Toolchain: package.json, vite.config.ts, tsconfig.json (allowJs:true, strict:off),
   eslint + prettier, vitest — matching freshet/in-kind/diversion conventions.
2. Move current *.js → legacy/ untouched (the oracle).
3. Build: bundle the legacy modules into ONE IIFE userscript, in the exact documented
   load order, with a generated // ==UserScript== header → dist/autotrimps.user.js.
4. Wire the local dev loop: static-serve trimps-game, inject the built bundle, boot it.
5. ROADMAP.md + README refresh + a trimps.d.ts stub.
```

### The crux technical decision — ordered concatenation, not naive imports

The current modules are **not** ES modules — they are injected scripts that share one
global scope and call each other by bare name (`calc.js` calls a function defined in
`other.js`, etc.). Bundling them with naive `import`s would give each file its own
module scope and break every cross-reference.

So **Phase 0's build is ordered concatenation into a single IIFE** — all modules share
that IIFE's scope, exactly reproducing the shared-global behavior, just without the
`appendChild` dance. Game globals (`game`, `portalWindow`) remain reachable by bare-name
global lookup; AutoTrimps' own cross-references resolve within the shared IIFE scope.
Behavior is identical **by construction**.

This is also the mechanism that lets the strangler strangle: per later slice, a file's
slot in the concatenation is replaced with a real `import`/`export` TS module.
Concatenation shrinks, real modules grow, until the concatenation is empty.

The documented Phase 0 load order (from `AutoTrimps2.js`):

```text
utils, import-export, query, calc, portal, upgrades, heirlooms, buildings, jobs,
equipment, gather, stance, mapfunctions, maps, breedtimer, dynprestige, fight, scryer,
magmite, nature, other, perks, fight-info, performance, ab, MAZ
+ SettingsGUI, + Graphs (vendored)
```

### Explicitly NOT in Phase 0

No logic changes, no TS conversion of any module, no UI rework, no bug-fixes, no parity
features. Phase 0 ends when the built userscript **boots in the local clone and drives
Trimps identically to today**.

---

## 🗺️ Long-horizon roadmap (living; order will flex)

```text
✅ Phase 0 — Foundation baseline
   Toolchain + concatenation-IIFE + local verify loop.

Phase 1 — First real conversion (establish the pattern)
   Convert utils.js → utils.ts as a true ES module (root of the import graph, small,
   depended-on by everything). Lock the idiom: export/import shape, how we type against
   trimps.d.ts, how we run the old/new parity check. Every later slice copies this.

Phase 2..N — Module-by-module strangle  [modular]
   Convert in dependency order, grouped:
     • pure logic:  calc, dynprestige, breedtimer, nature, magmite
     • systems:     buildings, jobs, upgrades, equipment, gather, heirlooms, perks
     • combat/maps: fight, fight-info, stance, scryer, maps, mapfunctions, MAZ, ab
     • infra:       portal, import-export, query, performance, other
   Each slice: convert → type → vitest the pure parts → parity-verify → commit.

Phase UI — Break up SettingsGUI.js (253 KB)  [user-friendly]
   Decompose the monolith UI; modernize settings UX. Done near the end — most entangled.

Phase Parity — Sync with Trimps v5.10.1  [features Trimps added]
   Research task: diff game changes since the 2022 fork (new zones/mechanics), then
   implement the automation gaps. Slots in once the code is typed enough to extend safely.

Phase Bugs — Squash  [fix Issues in the original]
   The fork's known GitHub issues + everything the type-checker and parity checks surface.
   Partly woven into each slice, partly a dedicated sweep.
```

**Cross-cutting principle:** bugs and small parity wins are fixed opportunistically when
we're already in that module (the type-checker will surface many), but anything that
changes game-affecting behavior is called out and verified, never silently folded in.
**Numeric balance stays sacrosanct** — ask before touching any tuning value.

`ROADMAP.md` (written in Phase 0) tracks all this with phase status so any future session
picks up cleanly.

---

## ⚠️ Risks & mitigations

```text
Risk                                        Mitigation
------------------------------------------  ------------------------------------------
Concatenation misses a load-order dep       Use the exact documented AutoTrimps2.js order;
                                            verify boot in the live clone before merge.
"Parity" can't be fully automated           legacy/ oracle + eyeball-in-Chrome per slice.
Game global API is huge & untyped           Grow trimps.d.ts pay-as-you-go; any-typed until
                                            a module needs it.
Silent behavior drift during conversion     Dual old/new run against one save; called-out
                                            behavior changes never folded in silently.
Tuning/balance accidentally changed         Sacrosanct rule: ask before any numeric change.
Losing the thread across many sessions      ROADMAP.md phase tracker + per-slice commits.
```
