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
npm run build        # → dist/autotrimps.user.js (esbuild(src/main.ts); no concat step since #171)
npm run build:watch  # rebuild on change
npm run serve        # static-serve the local Trimps clone on :8080 with the bundle injected
npm test             # vitest
npm run test:ci      # vitest + the zero-skip census — what CI runs
npm run typecheck    # BOTH configs: tsc --noEmit (src+tests) && tsc -p tsconfig.scripts.json (the .mjs harness)
npm run lint         # oxlint src tests scripts --deny-warnings (a real gate; it can fail)
npm run game:fetch   # re-materialize .trimps-game/ if it goes missing
npm run sim:coverage # what the L0 corpus reaches (read with the blind-spot census, not alone)
npm run sim:record   # ⚠️ RE-PINS THE ORACLE — see the re-record rule below before running it
```

**The current oracle tag is `oracle/v5-post-review-campaign`** (S10, 2026-07-29; it succeeded
`v4-post-fix-sweep`, and `phase1-faithful`/`v2-post-bugfix`/`v3-u2-autobuildings` are historical).
`sim:record` replays the **frozen** bundle at that tag, so it is never a local operation: moving one
trace re-pins across every `src` commit since the tag. Ledger the reason in
`tests/fixtures/traces/manifest.json` → `oracle.repinRationale`, and count the change **by event**
(`scripts/sim/event-diff.mjs`), never by positional index.

**Two game clones, and the distinction matters.** The **proof net** boots `.trimps-game/` — a
SHA-pinned dependency `npm ci` materializes (`scripts/fetch-game-clone.mjs`), gitignored, pristine,
never hand-edited. **`npm run serve`** uses the separate dev workspace at `../trimps-game`, which you
*do* edit (it carries an injected `<script src="/autotrimps.dev.js">` tag). `TRIMPS_GAME_DIR`
overrides the net's clone if you need to A/B an upstream bump.

Local verify: `npm run build && npm run serve` → open `http://localhost:8080/`, confirm
"AutoTrimps - Zek Fork Loaded!" and a clean console.

## Layout

- `legacy/` — **deleted** (#171). The strangler is **complete** (#133/#134, v6.0.0, 2026-07-15):
  `AutoTrimps2.js` → `src/modules/main-loop.ts`, `Graphs.js` → `src/modules/graphs/` (ECharts), and
  the dead `highcharts.js` + upstream distribution shims were deleted. The last occupant was a
  vendored `FastPriorityQueue.js` that turned out to be a hand-edited fork with a browser-freezing
  bug; it is now the `fastpriorityqueue` npm package, pinned exact and bundled by esbuild. The
  oracle is the recorded L0 traces + the last pre-conversion commits on `main`.
- `src/modules/` — 46 converted TypeScript modules plus **two directory modules**, `graphs/`
  (ECharts dashboard, #131/#135/#136) and `custom-ui/` (the opt-in adopt-and-skin UI shell, #41 —
  `adopt/boot/index/regions/shell/state` + `tiles/`). Includes `main-loop.ts` (the ported
  mainLoop/loader, #133). ⚠️ `custom-ui/` **adopts** the game's own DOM and never reimplements it;
  it is default-OFF behind `ATCustomUI`, and it carries the largest cluster of open issues.
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

**Per-module conversion recipe** (see `.claude/skills/convert-legacy-module/`) — ⚠️ **HISTORICAL:
there is no `legacy/*.js` left to convert** (the directory was deleted in #171). Kept because the
*discipline* still governs any faithful port, including a re-vendored dependency: relocate verbatim
→ `src/modules/<name>.ts`, faithful port behind the seam, verify live in the clone, *then* refactor
internals freely. **Copy dense/minified lines verbatim — never retype**
(transcription is the dominant risk); exact-string vitest guards the two frozen serializeSettings
blobs.

**The transition seam** — converted modules `export` normally; `src/legacy-bridge.ts` does
`Object.assign(globalThis, { ...module })` (wildcard spread — can't forget a name). Since #133 the
strangler is complete and since #171 there is no concat step at all, so the build is just: header +
version global + the `src` IIFE. (The emit-order rule that used to live here — src IIFE first, then
the trailing vendored `FastPriorityQueue.js` — is retired with the file; there is nothing left to
order against, and `build-userscript.test.ts` now pins that NO `/* ===== legacy/` chunk returns.) ⚠️ Inside
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
`globalThis.X = ...` at the write site and drop the module `var`. (The scout step that used to read
`grep '^var ' legacy/modules/<m>.js` is retired with `legacy/` — check `src/modules/<m>.ts` for
top-level `var`s and grep each name for readers outside the module.)

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
A fourth instance closed 2026-07-28 (#257): `allowJs` + `checkJs: false` meant the **entire proof-net
harness** — `recorder`/`boot`/`driver`/`corpus`/`manifest`/`trace`/`blind-spot-census` — was loaded by
`tsc` and never checked, so a type error planted in `recorder.mjs` exited **0**. It now has its own
`tsconfig.scripts.json` (a separate config because `noImplicitAny: false` globally changes inference in
`src/`), both configs run in `npm run typecheck`, and `ci-gates.test.ts` pins that they keep doing so.
Two nets were added the same day for the same reason: `no-skipped-test-bodies` (a bare `return` in a
test body reports as a PASS, so the report-consuming skip census structurally cannot see it — it found
a live dead test on its first run) and `tripwire-call-sites` (a guarded predicate whose CALL SITE
nobody asserts is a comment).

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
- **🧨 REMOVE the HTML splice; do not escape it.** An escaper encodes an assumption about its sink's
  quote style, and that assumption is invisible at the call site and wrong one file over.
  `utils.escapeHtml` handles `& < > "` but **not `'`** — and `MAZ.ts` builds every attribute with
  SINGLE quotes, so the obvious "escape at the seam" patch would have left all 29 of its splices
  exploitable while looking like a fix (#235, found by review after three sibling sinks were already
  closed). Prefer `el.value = x` after the markup parses, or `textContent` + `createElement`: the
  value never becomes markup, so no quote of any kind can break out, and it also fixes the
  entity-decoding data loss escaping leaves behind. Reserve `escapeHtml` for markup that genuinely
  must be a string, and **check the quote style first**. Corollary for the net: mutation-test against
  the *near-miss* fix — a net that only reddens on the unfixed code cannot tell you the escaping
  patch was wrong. Anything persisted is attacker-influenceable: importing another player's settings
  string is the documented feature, `@grant none` runs in page context, and the game page has no CSP.
- **♾️ A NaN-SAFE CAP IS NOT A NON-FINITE-SAFE CAP — `Math.min` DOES NOT PROPAGATE INFINITY.**
  `ratiobuy`'s `toBuy <= canBuy ? toBuy : canBuy` inverts under NaN (the comparison is false, so the
  CAP becomes the ORDER), and `Math.min` is the obvious repair because it propagates NaN into
  `safeBuyJob`'s existing `Number.isFinite` refusal. But `Math.min(Infinity, canBuy)` is **`canBuy`** —
  the original bug's outcome, exactly. And Infinity is reachable here with no NaN anywhere: this is the
  one expression dividing by `totalRatio` rather than by a constant, so ratios of **1 / -1 / 0** sum to
  zero with a positive numerator and give `1/0`. Nothing validates the sign of a `value` setting, so
  that is user input, not a corrupted save. Found only because the `isNaN`-instead-of-`Number.isFinite`
  near-miss mutant SURVIVED — the fix was wrong, not just the net (#202). Sibling arms that divide
  `totalRatio / D` **by** `totalRatio` give `0/0` = NaN instead, so the hazard is per-expression: ask
  which operand can be zero, not whether the function "handles NaN".
- **📛 A TEST NAME IS A CLAIM, AND A FIXTURE THAT DOES NOT REACH THE NAMED STATE IS A FALSE ONE.** A
  test called "the else-return no longer strands the rest of buyJobs **in the steady state**" used a
  fixture BELOW target — the old dead band, not the steady state — so it proved the easy half and read
  as proving the hard one. The steady-state case sat right next to it asserting only that scientists
  were not over-hired, which is silent about the thing the name promised. Caught by review, not by any
  gate, because both tests passed. Corollary, and the sharper half: **write the justifying claim as an
  executable assertion, not as a comment.** Replacing it, the comment "both arms bail identically while
  breeding" was written as an `expect` and **FAILED** — the general branch trickles F/L/M and the Watch
  arm does not (#292). Had it been prose it would have shipped as the reasoning that closed #217.
- **🧪 vitest CANNOT SEE SLOPPY-vs-STRICT — ESM IS ALWAYS STRICT.** `tests/` imports `src/*.ts` as
  modules, so every unit test runs strict no matter what the shipped bundle does. Only the
  bundle-booting sim tests exercise the real mode. So a green suite is NOT evidence about #287's class,
  and the evidence has to be a live A/B on the built artifact: `main` gave `[NaN, NaN, …]` for all five
  tier-II perk `value` arrays and the branch gave real numbers, which is what actually proved it. The
  general rule: when a defect lives in how the ARTIFACT is assembled, no test that bypasses the
  assembler can witness it.
- **🏷️ A TRACK-LEVEL SIM-VISIBILITY CLAIM CAN OVERRIDE CORRECT ISSUE-LEVEL ONES.** The campaign plan
  labelled S7 "⚠️ first trace-moving session" and told the session to expect red; all five jobs issues
  had independently, and correctly, said `baseline-zero` could not reach their region. `baseline-zero`
  was 21/21 before and after — one wrong grouping outvoted five right analyses. Re-derive the claim per
  ISSUE; a label inherited from a batch is not evidence about any member of it.
- **🎯 MUTATION-TEST THE NEAR-MISS FIX, NOT THE REVERT.** Reverting your own change is the weakest
  possible mutant: it proves the net sees the bug you already knew about, and says nothing about the
  repair a reasonable person would have written instead — which is the one that ships, because it looks
  right at the call site. Four instances now, none caught by a revert-mutant: `escapeHtml` misses `'`
  while `MAZ.ts` uses single quotes (#235); `Number(v)` instead of `parseFloat(v)` leaves a stored `null`
  storable, because `Number(null)` is **0** (#237); `!isNaN` instead of `Number.isFinite` accepts
  `±Infinity`, which `JSON.stringify` also writes as `null` (#237); similarity-mapping the dead preset
  value `"Void 60"` → `"Void"` instead of the declared default (#208); restoring a hidden element with
  `turnOn`, which writes `inline-block` over a container authored `block` (#238). Aim mutants at the
  **predicate**, the **fallback target**, and the **written value** — not at the presence of the call.
  **And mutate the NET'S OWN CLASSIFIER, not only the source.** A net that sorts code into good/bad
  shapes has a boundary, and the near-miss repair sits just inside it: `buymap-return-checked.test.ts`
  asked only "does the value go nowhere", which passes `bought = buyMap()` — and every refusal code is
  **truthy**, so `if (bought)` still fires and the bug is fully intact (#177/#205, caught by review, not
  by me). *Not thrown away is not checked.* Three more S5 survivors, each naming a missing assertion
  rather than a wrong fix: `swapNiceCheckbox(el)` with the force argument omitted **TOGGLES**
  (updates.js:1934), so it lands on the right answer from the default state and every single-run
  assertion passes — drive BOTH starting states; gating the bought FLAG while still capturing the map id
  parks the slot forever, and is invisible in the all-refused case because the failure bail blanks every
  slot anyway (only the partial band sees it); and a restore that skips its paired `toggleSetting`
  repaint passes `toContain`, because the SUSPEND's repaint already satisfied it.
- **🔌 AT IS ONLY IMMUNE TO GAME CHANGES IT DELEGATES — DOM POKES ARE NOT DELEGATION.** The fork's
  structural immunity (reads native `locked` flags, calls native `buyJob`/`buyUpgrade`) does **not**
  extend to anywhere it reaches around the game's own setter and writes the DOM directly. `advPerfectCheckbox`
  was an `<input type="checkbox">` when AT was written and became a `<span class="niceCheckbox"
  data-checked>` in Trimps 4.9 (clone commit b43ef65, 2018-09-04). `.checked` on a span is an inert
  expando; the game's only reader is `readNiceCheckbox` → `dataset.checked` (updates.js:1958). All **20**
  of AT's writes did nothing for ~8 years, and both halves of a ladder died at once: the "start Perfect"
  write never turned it on, and the "degrade to imperfect" rung re-priced an unchanged map, making its
  inner affordability test the exact negation of the `if` it sits inside — a provably dead branch worth
  2.34× (#175/#228/#247). Drive `swapNiceCheckbox(el, bool)`, the setter the game itself uses at
  main.js:6134. Two corollaries: **repairing a dead write can be worse than deleting it** — 14 of those
  20 sit in designs that pin `lootAdvMapsRange` to 0, so `checkMaxSliders` forces Perfect off regardless,
  and "fixing" them changes nothing locally while leaking a real `data-checked` write into every map
  designed later in the same Map-Chamber session; and **a repair that un-deadens a write makes its
  READERS live too** — `maps.ts`'s two `create` designers open at 9/9/9 and had to start re-asserting the
  preset, or they would have inherited a Perfect state nobody asked for. Net: `nice-checkbox-writes.test.ts`
  derives the niceCheckbox id set from the clone's markup and bans the write class under either disposition.
- **♾️ `-1` MEANS INFINITE ONLY WHERE SOMETHING ELSE ENDS THE LOOP.** `settings-engine.ts` renders
  " Put -1 for Infinite." into the input dialog of *every* value/multiValue setting — a blanket claim by
  one renderer that no consumer is obliged to honour. `BWraidingmax`'s loop exits on
  `findLastBionic().level > targetBW`, and clearing a BW is what creates the next tier (config.js
  `roboTrimp.fire`), so the top level climbs until the chain stops at `getObsidianStart() + 100` and then
  never climbs again: `targetBW = Infinity` **never terminates**. #176's own suggested fix converts a
  silent no-op into a hang. Before implementing any such sentinel, find the consumer and ask *what ends
  this loop if the bound never fires?* — if the answer is "the bound", `-1` has to mean **unconfigured**
  instead. Note the sibling `MaxPraidZone` rescues its own `[-1]` to a literal 10 for exactly this reason.
- **🔑 KEY A DEDUP LATCH BY EVERY DIMENSION ITS FUNCTION BRANCHES ON.** `BWraiding()` swaps its entire
  setting triple on `challengeActive == "Daily"`, so one zone number is TWO independent raids. A
  warn-once latch keyed by zone alone let whichever context arrived first silence the other's *only*
  diagnostic — and the failure is silent by construction, because the whole point of the latch is that
  nothing prints. The #227 sibling ten minutes earlier was already keyed `{ daily, normal }`; this one
  was not, and nothing in the #176 tests touched the Daily path at all (found by review). **Test the
  dimension you keyed by** — a latch test that only exercises one context proves the dedup works, not
  that the key is right.
- **🔎 A FINDING'S OWN SCOPING CLAIM IS A CLAIM.** "A mechanical scan returns EXACTLY these two lines"
  reads like a boundary and is really a one-pass reading that nobody re-derives — so a fix scoped to it
  inherits its blind spot *silently*, and the remaining instances get harder to find because the class
  now looks handled. Checked twice in one session, wrong both times. #208's own pass noticed
  `dispatch-holes.test.ts` filters `type === 'multitoggle'`, which is why one 2018 preset shipped **two**
  instances of one class and only one was caught for seven years — by the very net whose existence made
  everyone believe the class was closed. And #238 asserted every turnOff-only id was hidden
  unconditionally; `one-armed-hides.test.ts` found **15** conditional ones. Derive the census from the
  AST, never from the finding's list, then read what it returns — S3's extra 15 were benign, and a pinned
  shrinking count beat both fixing them (scope creep into a behaviour commit) and allowlisting them.
- **👁️ AN UNTOUCHED ELEMENT READS AS VISIBLE.** A fresh DOM node has `style.display === ''`, so
  `display !== 'none'` returns TRUE for something nothing has touched — and every
  `expect(visible(x)).toBe(true)` then passes just as well against a build with the show call **deleted
  outright**. Require a value only production writes (`toggleElem` → `inline-block`, `toggleStatusElem` →
  `block`); neither is reachable without a real call. Corollary: a shared jsdom harness must NOT pre-seed
  the parent's display to the showing value "to model the authored state" — that re-opens it from the
  other side. Found by review on #238/#240 as a *latent* hazard; it was live, and tightening the helper
  immediately exposed an assertion of mine that ran before the tick meant to touch the row. This is the
  mirror of the #150 trap below, where a CSS *class* hides what an inline style says nothing about.
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
- **🚪 A LOOP BODY CAN TEST THE SAME ITEM TWICE — FIND THE GATE, NOT THE FIRST GUARD.**
  `buyAutoStructures` opens with `if (!setting[item]) continue` (main.js:18250), which merely skips
  items the cog has never written; the line that decides a purchase is fourteen lines lower —
  `if (!game.buildings[item].locked && setting[item].enabled)` (main.js:18264). Reading stopped at the
  first guard and concluded the game tests PRESENCE, which produced a mirror asserting an asymmetry
  against jobs that does not exist. The failure was not the wrong line, it was that **the fix, the
  comment justifying it, and the regression test guarding it were all written from one reading**, so
  nothing in the change could contradict it — a self-consistent misreading looks exactly like a
  well-evidenced fix. Caught by review, not by any gate. Read to the END of the loop body, and when
  mirroring a game predicate, check whether the sibling you are contrasting it with really differs
  (#187).
- **📝 A TEXT NET WHOSE CORPUS INCLUDES PROSE HAS A FALSE-POSITIVE SURFACE WHERE THE CODE IS BEST
  DOCUMENTED.** `native-conflicts-completeness` scans source text for mutation shapes and reddened on
  a COMMENT citing the game's own `toggleAutoStructure(true)` — the module stayed provably
  mutation-free. The pressure that creates is to explain LESS, which is backwards. Strip comments and
  string literals before matching, and pin the stripper with a test proving it still SEES the shapes
  it must catch — otherwise "comments are stripped" quietly becomes "everything is stripped" and the
  gate can no longer fail. Same family as the `@vitest-environment` pragma firing from an explanatory
  note (#187 wave).
- **🪤 AN ANTI-FALSE-GREEN THAT ASSERTS ON LIVE SOURCE DIES WHEN THE CLASS IS FIXED.**
  `setting-array-compare` proved it could see reversed-operand sites with `sites.some(s => s.reversed)`
  over `src/` — so its own health depended on a real defect continuing to exist, and it went red the
  moment #178's last reversed site was repaired. "The class is now clean" and "the scanner broke" were
  the same observation. Prove a scanner's CAPABILITY against a synthetic fixture; reserve live-source
  assertions for the census itself (#178).
- **🔁 A VALUE MIGRATION KEYED ON THE VALUE CANNOT BE IDEMPOTENT IF THE OLD VALUE IS STILL LEGAL.**
  A dropdown persists its LABEL. Correcting `raretokeep`'s option list left `"Common"` in the new list
  meaning rarity 1 where it used to mean 0 — so a from→to rule keyed on the value cannot tell an
  un-migrated store from a user who deliberately picked it, and rewrites their choice on EVERY boot,
  permanently (the setting becomes uneditable — the exact hazard `settings-migrations.ts`'s header
  warns about for copy-without-delete). Ride the id migration instead: `SettingIdMigration.transform`
  runs while `migrateLegacyId` moves the value, and that mechanism DELETES the old key, so the trigger
  is a key a migrated store no longer has. Idempotent by construction (#194).
- **🕳️ WHEN SEVERAL CAUSES FUNNEL TO ONE VALUE, THE VALUE CANNOT TEST ANY OF THEM.** `autoGiga` ends
  with `+(Math.round(delta + "e+2") + "e-2")`, a string round-trip that turns **every** non-finite
  intermediate into NaN — so five arithmetically distinct faults arrive as one indistinguishable value.
  All five refusal guards therefore survived a delete-mutant: `expect(...).toBeNaN()` passes just as well
  with the guard gone, because the funnel produces NaN either way. The guards' actual product is the
  **diagnostic**, so each route now asserts its own message, and only then do the mutants die (#297).
  Generalise past NaN: any time N inputs collapse onto one output (a sentinel, a `false`, a `0`, an empty
  array), the output is a test of the funnel and not of the branch — assert the thing that still differs.
  Corollary: **an edit no test can observe is not a fix.** A `CustomTargetZone >= 60` → `>= 61`
  tightening looked like the matching half of the same repair and survived the whole suite, because
  `autoGiga` re-derives 60 to the same zone. It was reverted with the reasoning kept as a comment;
  shipping it would have been a second unfalsifiable claim wearing a fix's clothes.
- **🩻 A STUB THAT IGNORES ITS ARGUMENTS CANNOT SEE WHICH ARGUMENT PRODUCTION PASSED — and removing a
  behaviour orphans whatever COMPENSATED for it.** Two halves of one audit, both live on `calcSpire`
  (#298). (1) Its test stubbed `getEnemyAttack: () => 100`, so the fixture was blind to the third
  parameter, and a double-applied imp multiplier sat under a green test **from 2022**: the game passes
  `ignoreImpStat: true` precisely so `getSpireStats` can apply `badGuys[name][what]` once itself
  (main.js:13715/13726), AT passed `false` and then applied it again. When mirroring a game function that
  takes a flag, the stub must HONOUR the flag or the mirror is untested. (2) The health path had been
  correct only because `calcEnemyBaseHealth` skipped `badGuys` above z60 — a premise stated **only in a
  comment** — so #198's correct removal of that skip silently made the compensation a second application,
  in the same session, invisible to every gate. **After deleting a special case, grep for code that
  compensated for it**; a comment beginning "…so only X needs the explicit Y" is that code announcing
  itself. And prefer a **required** parameter over an optional one when threading new context: `tsc`
  enumerates every call site for a required param, while a default silently keeps the old behaviour at
  any site you forget (the #298 seam names every caller for exactly this reason).
- **🧭 `highestLevelCleared` IS BEHIND `game.global.world` FOR THE ZONE YOU ARE PUSHING.** So a fallback
  spelled `Math.max(65, game.global.highestLevelCleared)` can hand back a target zone *behind* the
  current one — and `autoGiga`'s `Math.pow(megabook, targetZone - baseZone)` then goes below 1, `Math.log`
  goes negative, and `DeltaGigastation` becomes negative. It is finite, so no storability guard catches
  it, and the consumers compute `Math.floor(done * delta) + first`, a target that SHRINKS as Gigastations
  accumulate (measured live: 1 → 0 → −12), stalling Warpstation buying with no error and no log line
  (#310). Whenever an HZE-derived value feeds an exponent or a difference against `world`, check the sign.
- **🧊 A PRESENCE CHECK AGAINST A FROZEN ARTIFACT AGES INTO A CLAIM ABOUT HISTORY.** `oracle.test.ts`
  asserted the pinned oracle contains the #64 fix by matching single-quoted verbatim text — and it passed
  for fourteen days after that text stopped existing, because the v4 bundle still *concatenated*
  `legacy/AutoTrimps2.js` while #133 had moved the line into `src/`, where esbuild normalises the quotes.
  The assertion was pinning a deleted file: green, and unable to say anything about the code that ships.
  Nothing can notice this on its own — the artifact is frozen *by design*, so the anchor rots silently and
  only a re-pin exposes it. Fix structurally, not by escaping the quote: assert every anchor against a
  **freshly built working bundle as well as** the frozen one, so an anchor that stops describing `src/`
  fails loudly and says "re-derive me". Same family as the DISABLED-GATE entry above, one level up: not a
  gate that cannot fail, a gate testing a *different program* than the one you ship.
- **🧮 COUNT A TRACE CHANGE BY EVENT, NOT BY INDEX — the honest number decides whether a re-pin is
  honest.** `diffTraces` aligns positionally, so ONE inserted event at tick 9 reports as every later index:
  `12-warp-u1` reads 1991 divergences and is 697 event edits; `08-starved-u1.1` reads 1742 and is 704.
  Re-pin rationales are argued over these numbers, and "1991" reads like the wholly-shifted trajectory the
  re-pin rule exists to refuse. `scripts/sim/event-diff.mjs` is the committed LCS (keyed on `fn`+`args`,
  never `tick` — reaching the same decision a tick earlier changed WHEN, not WHAT). And the control that
  makes a re-pin trustworthy is the set of fixtures that did **not** move: it must be exactly the set the
  old oracle already agreed with, byte-for-byte, or something else moved too.
- **🎯 A CORRECT FIX CAN COST THE NET ITS SENSITIVITY — the threshold moves under you.** `enoughDamage` is
  `ourBaseDamage * cutoff > enemyHealth`, and a saturated threshold absorbs any buff (#90/#98). #199 made
  AT's damage estimate 2.5× more honest, which pushed three fixtures over their own thresholds: the
  `damage-1e6` census row fell from **6297 across 5 runs to 3563 across 2**, leaving `08-starved-u1` the
  only fixture where `calcOurDmg`'s answer can still change a decision (#311). This is the #98 hazard
  arriving from the direction nobody watches — not a weaker net, a stronger bot — so **after any fix to
  the bot's own self-estimate, re-run the census and read the row that fix feeds.** A 1e6× probe measures
  nothing once the predicate is saturated; prefer a threshold-relative injection.
- **🎚️ Game balance numbers are sacrosanct.** Mirror game constants exactly; mechanism fixes ship
  freely, numeric tuning is always a user decision.
