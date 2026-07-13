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

- `legacy/` — untouched original `.js`, the behavioral oracle. Only `AutoTrimps2.js` (loader) +
  `Graphs.js`/highcharts/mods wrappers remain here; everything else is ported.
- `src/modules/` — the ~30 converted TypeScript modules.
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

**Game-parity work** (`.claude/agents/parity-gap-analyzer.md`) — parity work reads the *dev workspace*
clone at `../trimps-game` (a real git checkout, so `git log`/`git grep` work). Note this is NOT the clone
the proof net boots — that is the pinned `.trimps-game/` (see Build & test commands). A deliberate upstream
bump means moving `package.json` `trimpsGame` **and** the trace manifest's `gameClone` together;
`tests/ci-gates.test.ts` fails if they disagree.
The fork is structurally immune to changes it *delegates* to native game code (it reads native
`locked`/unlock flags, calls native `buyJob`/`buyUpgrade`); drift lives only in its own
from-scratch prediction math. Mirror game constants exactly — **never change game balance numbers.**

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

## Recent decisions

- **🚦 #67 SHIPPED — THE DEPLOY GATE IS REAL NOW** (2026-07-12, `79f96935`) — the proof net had never once
  run in the Pages gate. Fixed, and **verified end-to-end on the runner in both directions**: a clean tree
  gives **637 passed / 0 skipped** (was 587 passed / **34 silently skipped** / exit 0), and the injected
  `jobs.ts` regression that previously shipped to `dist/` **green** is now **red with 28 unexplained
  divergences**.
  🏗️ **The fix is NOT the one the issue proposed.** #67 recommended a CI checkout step + a hard-fail guard.
  That is a stop-gap: it fixes the runner and leaves **every laptop with the identical silent-skip hole**,
  and puts the game SHA in a third uncross-checked place. Instead the clone became a **SHA-pinned dependency
  `npm ci` materializes** (`scripts/fetch-game-clone.mjs` → `.trimps-game/`). It is present everywhere **by
  construction**, which is what let **`tests/sim/guard.ts` be DELETED** — no conditional-skip mechanism
  survives anywhere in the tree. The pin lives **once**, in `package.json` `trimpsGame`, and the fetch
  verifies the tree's own `config.js stringVersion` against it *before* it may become the oracle.
  **Neither workflow contains a clone step** — if you find yourself adding one, the pin has drifted.
  🕳️ **Two holes the issue never named, both found by RUNNING, not reading:** (a) **`deploy.yml` is the gate
  that protects production** — my own first spike only fixed a new `ci.yml`, which guards nothing; (b)
  **`boot.mjs` implicitly defaulted the bundle to the gitignored `dist/`**, so the net's input was *ambient*
  — absent on CI, stale locally. That default is deleted; tests boot a bundle built in-process
  (`tests/globalSetup.ts` → `AT_TEST_BUNDLE`). **Never point a test at `dist/`.**
  📌 **Trace portability is CLOSED BY MEASUREMENT** — traces recorded on darwin/arm64 reproduce exactly on
  linux/x64 (node 26.5), and the positive control fails there with *identical* divergence counts. **No oracle
  re-record was needed, and none should be done.** ⚠️ A champion agent reported the opposite; it had branched
  off the positive-control branch and was **measuring the injected bug, blaming the platform**. Acting on it
  would have laundered a regression into the new oracle. **Always check the provenance of a red.**
  🧪 **Three nets, each mutation-tested to prove it CAN go red** (the one it replaced could not — `ci-gates`'
  pin check stayed green against an all-zeros SHA): `scripts/ci/assert-no-skips.mjs` (in CI, **zero tests may
  skip** — any future `.skip`/`.todo`/env-guard fails on arrival), `tests/ci-gates.test.ts` (every declared
  gate invoked by **both** workflows; clone + node pins must equal the oracle manifest), and `--deny-warnings`
  (a linter that always exits 0 is not a gate). Also: `.nvmrc` now pins the **exact patch** (a floating `26`
  resolved to 26.5.0 and would make `fingerprint.mjs` cry "runtime MISMATCH" on every divergence); sim tests
  need a **120s** timeout (~34s on ubuntu vs <30s locally) — a flaky gate gets disabled, which is how #67
  happened.
  🐛 **`no-unused-expressions` stays ON — it found a real bug.** Triaging all 543 `src/` hits (not disabling
  them) gave **541 benign / 2 REAL**: `MODULES["jobs"].customRatio` and `RcustomRatio` are bare member
  accesses with the assignment dropped, read as the *highest-priority* branch of `workerRatios()` and never
  written → **#88**. Calibrate rules (`allowShortCircuit`/`allowTernary`), never blind them. New issues from
  this pass: **#88** (customRatio) · **#89** (MAZ dropdown HTML) · **#90** (**the net records ZERO
  `runMap`/`selectMap`/`setFormation`/`recycleMap` events corpus-wide — it proves the buy path, not the
  bot**) · **#91** (`src-bundle-parity` regen laundering hatch) · **#92** (lint debt).
- **🔬 CODE REVIEW v2 — ~91 distinct defects; milestone #9, issues #67–#87. REVIEW ONLY, no code changed**
  (2026-07-12) — an adversarial review of the whole codebase. Report:
  `docs/superpowers/specs/2026-07-12-code-review-v2-findings.md`. **Fix order is load-bearing and is encoded in
  the issue numbers.**
  ✅ **#67 (the blocker) is FIXED — see the entry above.** It was: the proof net had never run in the deploy
  gate, because `tests/sim/guard.ts` skipped 11 suites whenever the clone was absent (i.e. always, on CI).
  `guard.ts` no longer exists and the gate is verified in both directions. **#68–#87 are unblocked and will
  now land behind a net that actually runs.**
  🏛️ **#87 — `mainLoop` has NO error boundary** (`grep "try {\|catch" legacy/AutoTrimps2.js` → nothing; bare
  `setInterval` over ~30 automations in fixed tick order). Any throw silently skips **everything ordered after
  it, every tick, forever**. This *amplifies* every crash-class bug (#77 `ab.ts` `equips[0][1]`, #78
  `resetModuleVars` ReferenceError, #79 `portal.ts` bare `loom`) from a local crash into a permanent cascading
  outage. Fix LAST and ALONE — it changes emitted JS and moves the L0 traces (behavioral, not mechanism).
  🕸️ **Systemic classes (#68–#74), each `needs-net`:** 28 phantom `getPageSetting` ids (dead guards; ⚠️ do NOT
  fix by defining them — `MaxTox`'s phantom is *accidentally protective*); ~34 booleans `createSetting`'d with
  a **string** default (`'false'` is truthy → behavior differs per reader); ambient state read-but-never-written
  (`storedMODULES` → ReferenceError, and `tsc` is green because the `.d.ts` lies); **#70 `MODULES["maps"]
  .enoughDamageCutoff` is never written** → `>= undefined` → "CAM: H:D" is dead in all four Armor Magic
  settings, both universes; an **empty** `settingsProfileMakeGUI(){}` in `settings-visibility.ts` **shadows the
  real one** in `import-export.ts` via the bridge's `Object.assign` spread order (last spread wins — exactly one
  such collision exists in 401 exports); `byId("advExtraMapLevelselect")` — that element **does not exist**
  (the game's id is `advExtraLevelSelect`).
  **#32 and #58 WERE BOTH CLOSED PREMATURELY** — #32 recorded "FULLY COMPLETE" while `portal.ts:238` /
  `mapfunctions-amp.ts:463` still carry live `ReferenceError`s *marked `@ts-expect-error #32 latent`*; #58 fixed
  2 phantoms while 26 remained, including `RCapEquiparm` — phantom **inside the very function #58's own comment
  declares repaired** (`other.ts:221`), so `RbuyArms()` still buys nothing (`level < false` → `level < 0`).
  **Both drains closed on the MARKERS, not the BUGS.**
  📐 **Two method lessons, and they generalize:**
  (1) **NETS > READERS.** The review named `never-written` as a class, instantiated it 32 times, and closed it
  with 45 *reading agents* instead of one exhaustive *mechanical net* — so it missed instances of the class it
  had itself named. A ten-minute `MODULES.<field>` read-vs-write net found #70, which all 45 finders walked
  past. **Where a class can be mechanized, mechanize it.**
  (2) **THE SKEPTIC LAYER WAS DECORATIVE.** 297 adversarial votes changed almost nothing (95% pass rate), and
  **4 of the 12 kills came from findings the skeptics passed *unanimously*** — killed later by the reproduction
  stage. Adversarial *argument* is far weaker than adversarial *execution*. Next time skip the debate layer and
  go straight to "make it fail." (Both audits of the confirmed set — lead's and post-mortem's — broke **0** of
  the sampled findings, so the 91% survival rate is real: the codebase genuinely is this bad.)
- **Bug-hunt session: #63/#64/#65/#66 shipped; ORACLE RE-PINNED to v2** (2026-07-12) — started from a user
  bug report ("AT only researches, ignores the Turkimp") and cascaded. **#63** (`d749a7d4`): `needGymystic`
  was `var needGymystic = true` in AutoTrimps2.js and **never reset** (a 2016 upstream commit flipped its
  initial value), so `setScienceNeeded()` added Gymystic's flat **5,000,000** science cost forever — even
  with Gymystic locked/unbuyable. `scienceNeeded` never reached 0 → `needScience` stayed true → gather's
  research branch (gather.ts:140) fired *above* the Turkimp branch (:154) and returned first. Readers now
  check `allowed > done` live; the global is retired. **#64** (`57a837ba`): `ManualGather2 == 3` ("Science
  Research OFF") and `RManualGather2 == 2` dispatched **nothing** — picking them silently disabled ALL
  gather automation and froze `playerGathering`. The four `!= 2` science guards in `manualLabor2` were
  left over from when "Science Research OFF" WAS index 2, before "Mining/Building Only" was inserted ahead
  of it. **#65** (`572c3f8c`, `514b790d`): audited all **571** settings — `SpamNature` was rendered but read
  by nobody; `Rmayhemmap == 1` ("M: Highest Map") was a total no-op (implemented to its own tooltip; it's
  the only selector needing a MAX-level match, every other matches an EXACT level); and portal.ts's
  `typetokeep != 'None'` guard was **always true** (numeric index vs label string) — which mattered because
  `autoheirlooms3()` **un-carries every heirloom** before re-carrying per `typetokeep`, and index 0 has no
  carry branch, so Auto-Heirlooms-on + default type **stripped every carried heirloom**. Two permanent nets
  in `tests/settings-wired.test.ts` (every createSetting id must be read; no `getPageSetting(<multitoggle>)`
  vs string literal), both mutation-checked.
  🚨 **#66 (`6b056258`) — THE SIM WAS BLIND, AND SO WAS THE L0 NET.** `boot.mjs` left `usingRealTimeOffline`
  stuck true after `load()` (the game's offline replay sets it at main.js:2901 and clears it via a
  `setTimeout` loop the sim stubs out). AT's mainLoop gates `setScienceNeeded()` + `autoLevelEquipment()`
  on `!usingRealTimeOffline` — so **every AT-driven sim run ever executed with all gear-buying and science
  tracking dark** (AT banked metal to its cap, never equipped). It hid because the sim still fought/mapped/
  hired, and the tests only asserted "AT calls native mutators" (`buyJob` satisfied that). Consequences:
  (a) L0 traces contained **zero** `buyEquipment` events — `baseline-zero` compared a crippled AT against a
  crippled AT while reporting green; (b) `corpus-coverage.test.ts` had **enshrined the blindness as a
  "documented gap"**, misattributing it to corpus depth (see [[feedback-verify-the-harness-measures-what-it-claims]]);
  (c) **#40's conclusion was circular** and had to be re-measured. Fix = call the game's own
  `offlineProgress.finish(true)`. **ORACLE RE-PINNED `oracle/phase1-faithful` (5e51f56d) → `oracle/v2-post-bugfix`
  (514b790d)**: the old pin contains the #63 bug, so diffing against it asserted "keep behaving like the bug"
  (on 02-mid-u1 the old oracle computes `scienceNeeded=5,001,452` and gathers science; the fixed build
  computes 1,452 and gathers buildings — every downstream buy timing cascades). The `(save,index,fn)` waiver
  mechanism is for a few *localized* divergences, not a wholly shifted trajectory (~130 brittle entries).
  **Re-pinning is NOT routine — a naked oracle change is exactly the accidental-drift alarm the net exists to
  raise; only re-pin behind a root-caused, reviewed, intentional behavior change.** Rationale in
  `build-oracle.mjs` + the trace manifest. v2 traces are strictly *richer*, so the net is now more sensitive
  than it has ever been. **#48 + #40 then CLOSED by measurement** on the honest harness: the early game is
  **not worker-allocation-limited** (F/L/M spans ~2.5%; miner-heavy is *worse*; 5× scientists = +0.9%), and
  `scientistRatio2` is **inert for divisors ≥5** (hardcoded `<10` floor at jobs.ts:118) — see
  [[reference-early-game-not-worker-limited]]. 621 tests green.
- **Phase 3 — Divergence milestone (#7) CLOSED** (2026-07-11) — #43 (opt-in Efficiency Metal-priority,
  OFF = byte-identical) + #44 (U2 void discoverability) shipped; #41 moved to Phase 4 UI (#8). #44's
  force-abandon actuator was a **sim+duel NO-GO** (net loss: forfeits map bonus/fragments; collides with
  breedtimer's abandon path; Bubble absent from the clone so it's unverifiable) — resolved as
  discoverability instead. 🚨 **GOTCHA — the Pages deploy was silently RED for a whole session**
  (`f73aa718`→`a3cee184`): a breed golden asserted 21 digits of a native `Math.pow` value → libm drift
  local↔CI. **Always verify `gh run list --branch main` is green after pushing main.**
- **Purchase Coordinator (#57) — Phase 1 shipped, Phase 2 PAUSED, no compelling next slice** (2026-07-10/11)
  — `src/modules/coordinator.ts`: a `coordinatorAllows(name,res,cost)` reservation guard at the
  `safeBuyBuilding` chokepoint + a per-tick `computeTopTarget()`. Setting `PurchaseCoordinator` (default
  off); **OFF is byte-identical**. The load-bearing finding: buyer resource pools are largely **disjoint**
  (only metal is contended), which is why a lightweight guard beats a full allocator. Three dueling-agent
  rounds then falsified *every* Phase-2 direction — economy look-ahead is misconceived (a building's "extra
  income" is unreadable), and **U1 literally cannot build Smithy** (`blockU1`, config.js:11703) so all
  Smithy automation is U2-only by necessity — see [[reference-u1-smithy-blocku1]]. **#57 stays open but has
  no next slice.** GOTCHAS: never gate a buy on a bare `canAffordBuilding()` — it reads the *ambient UI
  buyAmt* and re-stalls; a live "verification" that force-sets a game flag you don't understand
  (`Smithy.locked = 0`) masks the real rule *and* auto-saves the mutation into later checks
  ([[feedback-verify-without-mutating-game-state]]); a new `createSetting` updates BOTH the settings-inventory
  `.snap` AND an inline `toMatchInlineSnapshot` count — commit both or CI goes red and blocks the deploy.
- **Proof-net Phase 3 giant-splits shipped** (2026-07-10) — `mapfunctions.ts` 2799→1963 and `other.ts`
  2378→621 via pure byte-faithful extractions (`mapfunctions-amp.ts`, `other-praiding.ts`). Method:
  **split-first** — a pure move is verified by the golden + src-bundle-parity net alone (no behavioral net
  needed); refactor the moved code in a later pass. Rejected the `RcalcOurHealth`↔`calcOurHealth` "dedupe"
  (distinct U1/U2 models = tuning, not duplication).
- **Planning is 100% GitHub-native** (2026-07-08) — ROADMAP/CHANGELOG/HISTORY deleted; Issues +
  Milestones + issue #23 (frozen Phases 0–2) are canonical. In-repo docs point at GitHub, never
  duplicate it.
- **Phase 2 + Phase UI (#20) + Phase Parity (#21) shipped** — 26 modules converted, `SettingsGUI.js`
  decomposed into 5 modules, automation synced v5.9.0→v5.10.1 (11 gaps). Only `AutoTrimps2.js` +
  `Graphs.js`/highcharts/mods remain legacy.
- **Phase Bugs (#22) shipped** (2026-07-08) — an adversarial multi-agent review found 26 confirmed bugs,
  all fixed HIGH→LOW + pushed to `gh-pages`. Also landed the **true-TS modernization** design spec + a
  proven Phase-0 characterization harness (see Conventions), and the `other.ts` missing-setting fix.
- **Phase 1 true-TS (milestone #5) — COMPLETE** (2026-07-09) — all 31 modules `@ts-nocheck` → strict TS;
  **ZERO `@ts-nocheck` remain in `src/`**, and the ambient seam (`trimps.d.ts` + `at-legacy.d.ts`) is
  stable. **GOTCHA — the byte-diff gate invocation:** `npx esbuild <file> --tsconfig-raw='{}'` on BOTH
  sides (`--tsconfig-raw='{}'` normalizes the `"use strict";` esbuild otherwise emits only for in-tree
  files); **NEVER pass `--loader=ts` with a file arg — it errors and emits nothing = a false green.**
- **A prior from-scratch rewrite was abandoned** — refactor in place via the strangler, don't
  reinvent the wheel.
