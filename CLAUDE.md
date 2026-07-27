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
npm install          # ALSO fetches the SHA-pinned game clone → .trimps-game/ (postinstall)
npm run build        # → dist/autotrimps.user.js (legacy concat + esbuild(src/main.ts))
npm run build:watch  # rebuild on change
npm run serve        # static-serve the local Trimps clone on :8080 with the bundle injected
npm test             # vitest
npm run test:ci      # vitest + the zero-skip census — what CI runs
npm run typecheck    # tsc --noEmit
npm run lint         # oxlint src tests scripts --deny-warnings (a real gate; it can fail)
npm run game:fetch   # re-materialize .trimps-game/ if it goes missing
```

**Two game clones, and the distinction matters.** The **proof net** boots `.trimps-game/` — a
SHA-pinned dependency `npm ci` materializes (`scripts/fetch-game-clone.mjs`), gitignored, pristine,
never hand-edited. **`npm run serve`** uses the separate dev workspace at `../trimps-game`, which you
*do* edit (it carries an injected `<script src="/autotrimps.dev.js">` tag). `TRIMPS_GAME_DIR`
overrides the net's clone if you need to A/B an upstream bump.

Local verify: `npm run build && npm run serve` → open `http://localhost:8080/`, confirm
"AutoTrimps - Zek Fork Loaded!" and a clean console.

## Layout

- `legacy/` — now holds ONLY the third-party vendored `FastPriorityQueue.js`. The strangler is
  **complete** (#133/#134, v6.0.0, 2026-07-15): `AutoTrimps2.js` → `src/modules/main-loop.ts`,
  `Graphs.js` → `src/modules/graphs/` (ECharts), and the dead `highcharts.js` + upstream
  distribution shims were deleted. No first-party legacy `.js` remains — the oracle is now the
  recorded L0 traces + the last pre-conversion commits on `main`.
- `src/modules/` — the ~40 converted TypeScript modules (+ the `graphs/` directory module),
  including `main-loop.ts` (the ported mainLoop/loader, #133).
- `src/game/*.d.ts` — ambient types for the game's global API (the seam).
- `scripts/build-userscript.mjs` — the userscript assembler; `scripts/serve-game.mjs` — dev server.
- `scripts/fetch-game-clone.mjs` — materializes the SHA-pinned `.trimps-game/` (runs on `npm install`).
- `scripts/ci/assert-no-skips.mjs` — the zero-skip census; `tests/ci-gates.test.ts` — the workflow-gate census.
- `tests/globalSetup.ts` — builds the bundle once per run so no test can boot a stale `dist/`.

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
`Object.assign(globalThis, { ...module })` (wildcard spread — can't forget a name). Since #133 the
strangler is complete, so the build collapsed to: the `src` IIFE is emitted **first** (after the
version global), then the only remaining legacy file, vendored `FastPriorityQueue.js` (its `new
FastPriorityQueue()` sites are all tick-time, so it only needs to exist by first tick). ⚠️ Inside
the bridge, `main-loop.ts` (the former `AutoTrimps2.js`) is imported **FIRST** so its base-state
globals (`MODULES = {}`, `autoTrimpSettings`, …) seed before any converted module's load-time
`MODULES["x"] = {}` write (breedtimer/buildings/…) — reorder it and those throw. A build test guards
the emit order. (The old `firstJs`/`restJs` split + `deLoaderize` transform were deleted with #133.)

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

**Every branch gets a reviewer agent before FF-merge — standing-authorized, never asked.** Dispatch a
fresh agent with no implementation bias (`feature-dev:code-reviewer`, or the adversarial multi-agent
shape above for anything wider than a single module). This holds even when the change is "obviously
safe" and every gate is green: on this repo a green gate has three times been a gate that *could not
fail*, so gates and reviewers are independent evidence, not substitutes. If a session instruction says
not to use the Agent tool without an ask, the standing directive in the global CLAUDE.md is that ask —
dispatch, don't offer.

**Byte-parity gate before FF-merge** (`.claude/agents/legacy-parity-verifier.md`): diff the
ordered `createSetting` id list + per-function bodies against the pre-conversion source. The
`createSetting` define-pass is the persistence contract — a dropped/reordered call leaves a
setting bare and `getPageSetting` returns undefined. (Note: Phase 1 is complete, so the original
`git show gh-pages:<file>` baseline is retired — that branch no longer exists; use the last
pre-conversion commit on `main` if this gate is ever re-run.)

**Game-parity work** (`.claude/agents/parity-gap-analyzer.md`) — parity work reads the *dev workspace*
clone at `../trimps-game` (a real git checkout, so `git log`/`git grep` work). Note this is NOT the clone
the proof net boots — that is the pinned `.trimps-game/` (see Build & test commands). A deliberate upstream
bump means moving `package.json` `trimpsGame` **and** the trace manifest's `gameClone` together;
`tests/ci-gates.test.ts` fails if they disagree.
The fork is structurally immune to changes it *delegates* to native game code (it reads native
`locked`/unlock flags, calls native `buyJob`/`buyUpgrade`); drift lives only in its own
from-scratch prediction math. Mirror game constants exactly — **never change game balance numbers.**

**A DISABLED GATE REPORTS SUCCESS — audit the gates themselves, not just their output.** Three times now
a gate was silently incapable of failing, and each time everything downstream looked green:
`tests/sim/guard.ts` skipped 11 suites whenever the clone was absent (#67); `| grep -cE '(error|warning)'`
never matched oxlint's format, so lint "passed" for a dozen runs while the deploy was RED
([[feedback-check-exit-codes-not-grep]]); and a **wrapped comment line** beginning `// @ts-nocheck` exempted
`buildings.ts` from `tsc` entirely — for months, while this file claimed zero remained (found by a *doc
audit*, 2026-07-13). **`tsc` exits 0 precisely BECAUSE the file is skipped.** So: check **exit codes**, not
output; **mutation-check every net** (break it on purpose, watch it go red); and when a doc claims a class is
closed, **probe it** — `npm run typecheck` passing is not evidence that a given file is typechecked.

**The gate is real — do not re-open the hole (#67).** Three invariants, each enforced by a net that has
been mutation-tested to prove it can go red. Breaking any of them is how the gate silently dies again:
1. **No test may ever be skipped in CI.** There is no `describeSim`, no conditional-skip mechanism, and
   none may be re-added — `scripts/ci/assert-no-skips.mjs` fails on *any* `.skip`/`.todo`/env-guard,
   whatever its justification. If a suite needs a dependency the runner lacks, **fetch the dependency**.
   A gate optimized for greenness is not a gate.
2. **No test may read `dist/`.** It is gitignored — absent on CI, stale locally. Boot the freshly-built
   `TEST_BUNDLE` (`tests/sim/bundle.ts`); `boot.mjs` throws rather than defaulting.
3. **Never re-record the oracle to make a red go away.** A red is the alarm, not the problem. Traces are
   proven portable across platform/arch, so a divergence on CI is a **real regression** until proven
   otherwise — and check the *provenance* of the tree that produced it before believing any claim about it.
Both workflows must invoke every gate (`lint`/`typecheck`/`test:ci`/`build`); `tests/ci-gates.test.ts`
enforces that, so deleting a gate step costs you a red test — which is the point.

**Merge cadence** — per-module/phase `feature/...` branch → port → live-verify → squash +
FF-merge to `main` + delete branch. `dist/` is gitignored (regenerated by `npm run build`, and
by CI on every push — never committed).

## Gotchas that still bite

The dated log of *what* shipped now lives in [docs/decisions-log.md](docs/decisions-log.md)
(and canonically in the closed [GitHub Issues](https://github.com/MattAltermatt/AutoTrimps/issues)).
What follows is only the part that is still load-bearing for the next change — each entry is a trap
that has already cost a session at least once.

- **⏱️ Stubbed timers silently delete behaviour.** `boot.mjs` once ran `setTimeout = () => 0`, and it
  ate four subsystems before anyone noticed: gear + science (#66), the whole metal economy — Forge is
  a *trigger*, not an upgrade (#122), stacked-void heirlooms (#126), and `doPortal()`, which had
  **never executed in a sim run** (#127). The sim has a real virtual timer queue now, but three
  self-driving loops stay blocklisted by identity (`gameTimeout`, `autoSave`, `costUpdatesTimeout`) —
  re-enabling one double-drives every tick and makes every trace a lie.
- **🎯 Reach ≠ sensitivity.** A corpus that *reaches* code proves nothing if the answer feeds an
  already-saturated threshold: a 1,000,000× damage multiplier once passed the entire sim suite green
  (#90/#98). Calling a function is not the same as depending on its answer. Prove coverage by
  mutation, never by execution.
- **🕰️ A stale oracle is a blind spot — and it INVERTS the census.** Against an oracle recorded before
  a fix, restoring the bug makes the mutant *agree* and report BLIND, while the clean build is the one
  that diverges (#105). A census number means nothing unless `baseline-zero` is zero. Whenever you add
  coverage for a region the corpus never reached, ask first whether the oracle is stale there.
- **🚨 Re-minting a deleted setting id is a DATA-LOSS bug.** `createSetting` applies its default only
  when nothing is stored, and `serializeSettings` round-trips unknown keys forever — so defining a
  phantom id resurrects the user's years-old localStorage value. Three dispositions: repoint at an
  existing id · delete the read · mint only if `git log --all -S"createSetting.*<id>"` is empty.
  `getPageSetting` returns **`undefined`, not `false`**, for a veteran user (#68–#74).
- **🔧 Fix the CONSUMER before the DEFAULT.** A default change cannot reach existing users (their
  localStorage already holds the old value), and the "broken" value is usually the load-bearing
  *unset* sentinel — so flipping it first actively regresses them (#96, #100).
- **💬 A raw `"` in a setting description kills its tooltip.** `createSetting` splices name +
  description into a double-quoted JS string inside an `onmouseover` attribute; one quote makes the
  handler fail to compile and nothing throws. Escape at the seam (`tipAttr()`), never in place —
  a multitoggle's `name` is an *array* (#110).
- **👁️ Read `settings-visibility.ts` before judging any setting.** The runtime gate and the render
  gate are frequently one invariant expressed twice; reasoning from the consumer alone was wrong twice
  in one session (#115, #117). A reference count answers "is it read?", never "why does this control
  exist?"
- **🕵️ You cannot spy on a converted module by reassigning the global.** Module-internal calls don't
  route through `window`, and `setInterval(mainLoop, …)` captures the reference at registration —
  both produce a confident **0 calls** while the code demonstrably runs (#127, #129). Assert on state,
  or intercept the primitive.
- **🪤 esbuild renames the DEFINITION, not the free reference.** A module that calls a bare global
  which a sibling module also exports keeps the free ref and renames the definition to `X2`. Runtime
  is correct (the bridge publishes by export name); only bundle-text-anchored tests move (#133).
- **🕳️ `guiLoop` NEVER RUNS IN THE L0 PROOF NET.** `scripts/sim/boot.mjs:31` stubs `setInterval` dead, so
  anything dispatched from `guiLoop` (`updateCustomButtons`, the storedMODULES persist, the #150 badge
  sweep) is structurally invisible to `baseline-zero` *and* to `guard-silence`. A green net there is not
  evidence about that code — it is evidence the net cannot see it. Never cite `baseline-zero` for a
  guiLoop-driven change; build the evidence by hand (#150).
- **👻 `false == 0` is TRUE — the one place the phantom-setting reasoning inverts.** `getPageSetting`
  returns **`false`** for a key absent from an existing user's store (#68), and every comparison against
  `1`/`2`/`true` is therefore inert by luck. Against **zero** it is not: `getPageSetting('X') == 0`
  fires for every user who has never touched the setting. Use `=== 0` (a present multitoggle returns a
  real `parseInt` number). Shipped and caught by its own test in #150.
- **🎭 A CSS CLASS can hide what an inline style says nothing about.** The game hides the five native
  automation buttons with `.autoUpgradeBtn{display:none}` and *reveals* them with an inline
  `display:block`, so `el.style.display !== 'none'` reports a never-revealed element **visible**. Read
  `getComputedStyle`. Worse, a jsdom fixture built without the class + rule encodes the same wrong model
  and cannot catch it — put the real class and a `<style>` in the fixture (#150; #41 Phase 2 is the
  mirror image, where an inline style beat a plain assignment).
- **🏚️ A RANKING SCORED ON ONE RESOURCE IS BLIND TO THE ONE THAT ACTUALLY BINDS.** AT's housing
  buyers rank candidates on a single cost item (`gemsCost / increase.by`, `foodPrice / increase.by`)
  and then commit to the winner. A building whose *other* costs are the real constraint therefore wins
  the ranking exactly when it is least payable — and because the ranking is a pure function of state, a
  failed purchase changes nothing and the same winner is re-picked every tick, forever. Gateway did
  this at z60 (best gems-per-pop until ~100 owned, but priced in fragments) and AT bought **nothing**
  while gems ran to 3.2e12. When touching a buyer, ask which resources the score omits — and note the
  sibling `buyFoodEfficientHousing` still has the same shape, unfixed and unmeasured. Fixing it needs a
  carve-out for candidates whose trade the user already owns via settings (Warpstation's is worth 2,118
  trace events).
- **🌱 Verify the FRESH-SAVE unlock path.** A deep everything-unlocked save is structurally blind to
  unlock and reveal bugs — two shipped that way, including a duplicate tile caused by the game's
  reveal animation setting an inline `display:block` that beat a plain style assignment (#41 Phase 2).
  Reset localStorage to zone 1 and watch resources unlock live.
- **🏠 The housing `Max*` caps are load-bearing** — uncapping the "inert" ones steers AT into
  Collectors and is ~4× worse population by z62 (#140, WONTFIX). Inert early, binding deep.
- **🔬 Never measure under CPU contention.** A 6× "hot spot" that recovers on its own is usually a
  competing background job exiting, not a real cost curve — reproduce a perf anomaly before
  explaining it (#129).
- **🎚️ Game balance numbers are sacrosanct.** Mirror game constants exactly; mechanism fixes ship
  freely, numeric tuning is always a user decision.
