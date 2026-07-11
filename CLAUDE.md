# CLAUDE.md — AutoTrimps

AutoTrimps automation userscript for the game **Trimps** — a modernization fork porting a
~18k-line legacy JavaScript userscript to **TypeScript + Vite** via an incremental strangler.
See [VISION.md](VISION.md) for the north-star and
[the design spec](docs/superpowers/specs/2026-07-08-autotrimps-modernization-design.md) for the
architecture.

Default branch: **`main`**. Work on `feature/...` branches, FF-merge to `main`. Deployment is
**CI-only**: GitHub Actions builds on push to `main` and publishes the userscript to GitHub
Pages (`https://mattaltermatt.github.io/AutoTrimps/autotrimps.user.js`) via `actions/deploy-pages`
(Pages Source = "GitHub Actions"). There is **no `gh-pages` branch** — never hand-deploy.

## Build & test commands

```bash
npm install
npm run build        # → dist/autotrimps.user.js (legacy concat + esbuild(src/main.ts))
npm run build:watch  # rebuild on change
npm run serve        # static-serve the local Trimps clone on :8080 with the bundle injected
npm test             # vitest
npm run typecheck    # tsc --noEmit
npm run lint         # oxlint src tests scripts
```

Local verify: `npm run build && npm run serve` → open `http://localhost:8080/`, confirm
"AutoTrimps - Zek Fork Loaded!" and a clean console. The game clone lives at `../trimps-game`
(v5.10.1); the serve script aliases the built bundle at `/autotrimps.dev.js`.

## Layout

- `legacy/` — untouched original `.js`, the behavioral oracle. Only `AutoTrimps2.js` (loader) +
  `Graphs.js`/highcharts/mods wrappers remain here; everything else is ported.
- `src/modules/` — the ~30 converted TypeScript modules.
- `src/game/*.d.ts` — ambient types for the game's global API (the seam).
- `scripts/build-userscript.mjs` — the userscript assembler; `scripts/serve-game.mjs` — dev server.

## Planning

100% GitHub-native — no ROADMAP/CHANGELOG/HISTORY files. Open work =
[GitHub Issues](https://github.com/MattAltermatt/AutoTrimps/issues) grouped by
**Milestones (= phases)**; shipped record = closed issues; the frozen Phases 0–2 narrative is
[issue #23](https://github.com/MattAltermatt/AutoTrimps/issues/23).

## Conventions

**Per-module conversion recipe** (see `.claude/skills/convert-legacy-module/`): relocate the
legacy `.js` verbatim → `src/modules/<name>.ts`, faithful port behind the seam, verify live in
the clone, *then* refactor internals freely. **Copy dense/minified lines verbatim — never retype**
(transcription is the dominant risk); exact-string vitest guards the two frozen serializeSettings
blobs.

**The transition seam** — converted modules `export` normally; `src/legacy-bridge.ts` does
`Object.assign(globalThis, { ...module })` (wildcard spread — can't forget a name). ⚠️ The `src`
IIFE is emitted **right after `AutoTrimps2.js`, BEFORE the remaining legacy modules**, NOT last:
still-legacy modules call converted fns at *load* time (e.g. `portal.js` top-level
`getPageSetting(...)`), so a src-last bundle throws ReferenceError before the bridge runs.
`scripts/build-userscript.mjs` splits `MANIFEST` around this; a build test guards the order.

**Reverse direction** — converted code reads game/legacy globals as free identifiers, typed
ambient in `src/game/trimps.d.ts` (game API) + `src/game/at-legacy.d.ts` (the **permanent**
bare-name globalThis seam between converted modules — Phase 1 done, so it no longer "shrinks";
functions with a single owning module are declared `typeof import('../modules/X').fn` so the
ambient signature can't drift, per #36).

**Shared top-level vars → `globalThis`** — a converted module's top-level `var X` that
still-legacy code reads becomes module-scoped and invisible (ReferenceError). Assign
`globalThis.X = ...` at the write site and drop the module `var`. Scout per module:
`grep '^var ' legacy/modules/<m>.js` then check each name for readers outside the module.

**Implicit-global audit is REQUIRED and must be SCOPE-AWARE per module** — bare `x = ...` writes
(no var/let) were sloppy-mode implicit globals; strict ESM throws. A file-wide regex gives FALSE
NEGATIVES (a `var perk` in a sibling function masks a bare `perk =` in another — shipped a bug
this way). Use a TS-compiler-API scope-walk, keep an ambient allowlist of engine + cross-module
globals. Localize with `var` (`for (i=…)` → `for (var i=…)`).

**Per-module typing** — game-coupled + minified body → `/* eslint-disable */` + `@ts-nocheck`
faithful port; genuinely pure/peelable bits → real typed module + vitest (`time.ts`/`buystate.ts`
precedent).

**Characterization test harness → true-TS** (`tests/setup.ts` + `tests/harness/gameFixture.ts`; spec
`docs/superpowers/specs/2026-07-08-true-ts-modernization-design.md`) — the safety net for converting
`@ts-nocheck` → TRUE TS. vitest env default `node`; DOM-coupled modules opt into jsdom per-file via a
`// @vitest-environment jsdom` docblock (keeps the esbuild build-test on node). Inject a `game` fixture on
`globalThis`; golden-master pure-read predicates, spy-log actuator native-calls. **Guardrails:** NEVER
inject raw `JSON.stringify(game)` — it silently drops the ~1091 game methods (`game.buildings.Shed.cost.wood`
is a *function*) → a green suite that tests nothing; overlay data onto a fresh `newGame()` and assert the
anti-false-green tripwire `typeof game.buildings.Shed.cost.wood === 'function'` before trusting any
"unchanged" result. Split by archetype: pure predicates → Layer-1 unit; actuators/orchestrators (DOM +
native mutators + `Date.now` branches) → Layer-2 Chrome differential. **Conversion contract:** own code
`strict`, the game API a *pragmatic* ambient seam (`any` only at the boundary; don't type the whole
40k-line game object).

**Bug-hunting = adversarial multi-agent review** (supersedes the earlier "type-checker sweep is low-yield"
note) — per-module correctness finders + conversion-seam audits, each finding verified by a *skeptic* + a
*bug-hunter* agent against `../trimps-game`. One pass found 26 confirmed bugs (report
`docs/superpowers/specs/2026-07-08-code-review-findings.md`). Filter faithful-to-legacy-intended from
genuine defects; numeric game-parity mirrors are user-gated (sacrosanct tuning).

**Byte-parity gate before FF-merge** (`.claude/agents/legacy-parity-verifier.md`): diff the
ordered `createSetting` id list + per-function bodies against the pre-conversion source. The
`createSetting` define-pass is the persistence contract — a dropped/reordered call leaves a
setting bare and `getPageSetting` returns undefined. (Note: Phase 1 is complete, so the original
`git show gh-pages:<file>` baseline is retired — that branch no longer exists; use the last
pre-conversion commit on `main` if this gate is ever re-run.)

**Game-parity work** (`.claude/agents/parity-gap-analyzer.md`) — the game clone is `../trimps-game`.
The fork is structurally immune to changes it *delegates* to native game code (it reads native
`locked`/unlock flags, calls native `buyJob`/`buyUpgrade`); drift lives only in its own
from-scratch prediction math. Mirror game constants exactly — **never change game balance numbers.**

**Merge cadence** — per-module/phase `feature/...` branch → port → live-verify → squash +
FF-merge to `main` + delete branch. `dist/` is gitignored (regenerated by `npm run build`, and
by CI on every push — never committed).

## Recent decisions

- **Purchase Coordinator #57 Phase 2 PAUSED** (2026-07-11) — a three-round dueling-agent + live-Chrome
  brainstorm falsified every Phase-2 direction. (1) The spec's **economy-income look-ahead is
  misconceived**: Trimps has no Mine, metal income is the food-costed Miner *job*, and `getPsString`
  excludes buildings, so a building's "extra income" is unreadable; Smithy is actually direct power
  (`getMult()`), storage is capacity. (2) A pivot to **U1 Smithy automation is IMPOSSIBLE** — U1 cannot
  build Smithy (`blockU1: true`/`locked: 1`, config.js:11703; unlock skipped when `universe==1`,
  main.js:10275; only source is the free z50 `SmithFree` map reward). All three U2 Smithy systems are
  R-prefixed by necessity, not omission — see [[reference-u1-smithy-blocku1]]. (3) A broader power scorer
  is marginal (disjoint pools; equipment already best-`Factor`-first; Phase 1 subsumed the one real
  save-up case). **#57's real value landed in Phase 1; #57 stays open but has no compelling next slice.**
  Postmortem in the spec §"Phase 2 Feasibility Postmortem". GOTCHA recorded: a live "verification" that
  force-sets a game flag you haven't understood (`Smithy.locked = 0`) masks the real rule AND auto-saves
  the mutation to contaminate later checks — [[feedback-verify-without-mutating-game-state]].
- **Purchase Coordinator #57 Phase 1 shipped** (2026-07-10) — opt-in priority-aware spending. New module
  `src/modules/coordinator.ts`: a `MODULES["coordinator"]` context + a `coordinatorAllows(name,res,cost)`
  reservation guard dropped at the `safeBuyBuilding` chokepoint (buildings.ts, gated on
  `cost?.metal !== undefined`) + a `computeTopTarget()` per-tick pre-pass wired into `mainLoop`
  (AutoTrimps2.js). Setting `PurchaseCoordinator` (default off) — **OFF is byte-identical** (proof-net L0
  traces reproduce); ON saves up for Coordination (reserve metal so lesser buys defer, then delegate the
  Warpstation buy to `safeBuyBuilding` so it self-forces its own buyAmt — never gate on a bare
  `canAffordBuilding()`, which reads the ambient UI buyAmt and re-stalls). Architecture (**priority-injection
  hybrid**) + objective (progression-speed) chosen via dueling agents; the load-bearing finding is that
  buyer resource pools are largely **disjoint** (only metal is contended), which is why a lightweight guard
  beats a full propose/execute allocator. 3 review passes caught real bugs (non-metal crash, non-accumulating
  scorer, ambient-buyAmt coupling). Spec `docs/superpowers/specs/2026-07-10-purchase-coordinator-design.md`.
  Phases 2–4 (economy scoring, broader buyers, U2) remain; **#57 stays open**. GOTCHA: a new `createSetting`
  updates BOTH the settings-inventory `.snap` AND an inline `toMatchInlineSnapshot` count in
  `tests/settings-inventory.test.ts` — commit the `.ts` too or CI goes red + blocks deploy.
- **Proof-net Phase 3 giant-splits shipped** (2026-07-10) — the two biggest modules split behind the
  proof net as pure byte-faithful moves: `mapfunctions.ts` 2799→1963 (extracted `mapfunctions-amp.ts`,
  the 9-fn Radon AMP engine) and `other.ts` 2378→621 (extracted `other-praiding.ts`, the 30-fn U1
  Prestige/BW-Raid state machine). Also: removed the dead `calcBaseDamageInX` calc.ts copy (stance's
  wins at global scope), the dead `dailyBWraiding` + 20-name `Rprestraid` block, and added a
  bridge import-order guard test. Rejected the `RcalcOurHealth↔calcOurHealth` "dedupe" (distinct
  U1/U2 models = tuning). Method (see spec `docs/superpowers/specs/2026-07-10-proof-net-phase-3-giant-splits.md`):
  **split-first** (a move is verified by golden pure-relocation + the src-bundle-parity net — no
  behavioral net needed), refactor of the moved code deferred to a later per-module pass. Filed #57
  (purchase-coordinator idea).
- **Planning is 100% GitHub-native** (2026-07-08) — ROADMAP/CHANGELOG/HISTORY deleted; Issues +
  Milestones + issue #23 (frozen Phases 0–2) are canonical. In-repo docs point at GitHub, never
  duplicate it.
- **Phase 2 + Phase UI (#20) + Phase Parity (#21) shipped** — 26 modules converted, `SettingsGUI.js`
  decomposed into 5 modules, automation synced v5.9.0→v5.10.1 (11 gaps). Only `AutoTrimps2.js` +
  `Graphs.js`/highcharts/mods remain legacy.
- **Phase Bugs (#22) shipped** (2026-07-08) — an adversarial multi-agent review found 26 confirmed bugs,
  all fixed HIGH→LOW + pushed to `gh-pages`. Also landed the **true-TS modernization** design spec + a
  proven Phase-0 characterization harness (see Conventions), and the `other.ts` missing-setting fix.
- **Phase 1 true-TS (milestone #5) — COMPLETE** (2026-07-09) — all 31 modules `@ts-nocheck` → strict
  TS via the esbuild byte-diff gate (emitted JS byte-identical to `gh-pages`; every fix is type-only).
  Wave 1 (#26 stance / #27 calc / #28 jobs+heirlooms+fight-info), Wave 2 (#29
  buildings/upgrades/magmite/gather/equipment), Wave 3 (#30 the nine orchestrators:
  scryer/nature/breedtimer/ab/portal/MAZ/maps/other/mapfunctions), **#31 fill (the last 12:
  utils/query/perks/fight/dynprestige/performance/import-export/settings-boot/defs/engine/menu/
  visibility)**. **ZERO `// @ts-nocheck` directives remain in `src/`.** The ambient seam
  (`trimps.d.ts` game API + `at-legacy.d.ts` AT globals) is now stable. Byte-diff gate invocation:
  `npx esbuild <file> --tsconfig-raw='{}'` on BOTH sides (the `--tsconfig-raw='{}'` normalizes the
  strict-mode `"use strict";` esbuild otherwise emits only for in-tree files; NEVER pass `--loader=ts`
  with a file arg — it errors and emits nothing = false green). **#32** tracks latent faithful-port
  bugs surfaced by strict mode + preserved byte-faithfully via `@ts-expect-error`/`@ts-ignore` (e.g.
  portal `loom` undefined ref, mapfunctions `recyle` typo, settings-visibility `hson` read-before-
  assign); fixes are tuning-gated + post-Phase-1.
- **A prior from-scratch rewrite was abandoned** — refactor in place via the strangler, don't
  reinvent the wheel.
