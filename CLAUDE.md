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

## Recent decisions

- **🧊 #122 SHIPPED — THE SIM'S METAL ECONOMY WAS FROZEN, AND THE NET WAS BLIND TO GEAR BECAUSE OF IT**
  (2026-07-14, `7fdae3bb`) — 1050 tests, all gates green by exit code.
  🚨 **`checkTriggers()` NEVER FIRED IN ANY SIM RUN, EVER.** `boot.mjs` stubs `window.setTimeout = () => 0`,
  and the game calls `checkTriggers()` during play from exactly ONE place — `costUpdatesTimeout()`, a
  `setTimeout(costUpdatesTimeout, 250)` loop (main.js:17970). **Forge is a *trigger*, not an upgrade**
  (config.js:13226, fires at ≥350 metal) ⇒ Forge never unlocked ⇒ `metal.max` pinned at **500** on every
  save ⇒ Coordination (507 metal at `done=2`) permanently unaffordable. **AT bought Coordination ZERO times
  in the entire history of the proof net**, and the deep fixtures ran **metal-capped on up to 100% of ticks**.
  Fix: `driver.mjs` `tickOnce()` calls `checkTriggers()` after `gameLoop()`.
  👁️ **THE REAL PRIZE WAS A HOLE NOBODY HAD NAMED: the net could not see the EQUIPMENT subsystem on its own
  deep fixtures.** Re-running the blind-spot census, `equipment-noop` — which rips out `autoLevelEquipment`
  ENTIRELY — went from **0 divergences on all three `06-deep` runs and on `07-map-cap`** to **~1890 each**
  (total 1997 → 10619). With a 500-metal cap the bot had nothing to spend, so deleting its gear automation
  changed *nothing* and the net stayed green. That is **reach ≠ sensitivity (#98) inside the very fixtures
  built to watch the bot.** `damage-1e6` also spread from 2 runs to 4. ⚠️ `housing-hut-divisor` (#93) and
  `rhypo-invert` (#101) remain **BLIND 0/17** — unfreezing does not reach them; still #105's scope.
  📐 **EARN THE RIGHT TO A ONE-LINER.** `costUpdatesTimeout` is FIVE calls. The four `checkButtons(...)` are
  state-pure *here* — they resolve to `updateButtonColor` (DOM class swaps) + `updateSRBuyAmt`, which **no-ops
  while `usingScreenReader` is false** (boot sets it), and the one call that could mutate,
  `Archaeology.checkAutomator()`, only buys when passed `makePurchase`. Cherry-picking `checkTriggers` is
  **shown, not assumed** — otherwise the "fix" is itself unaudited.
  🧾 **HARNESS RE-RECORD, NOT A RE-PIN — and NOT additive, so don't claim it is.** The oracle bundle
  (`v3-u2-autobuildings`) and `src/` are both **untouched**; the *simulated game* changed. **COUNT THE EVENTS**
  (LCS over fn+args, not by index): `04-u2-radon` reproduces **BYTE-IDENTICAL** (1204→1204, 0 in / 0 out — the
  control proving the change is inert where it should be), the shallow saves move explicably (+`buyBuilding(Forge)`),
  and the **deep saves genuinely RESHAPE** (06-deep 1765→2013 events, 303 in / 55 out; setFormation churn, because
  the bot now has metal, buys gear, and crosses its thresholds on different ticks). The manifest records that
  honestly rather than borrowing #90/#98's byte-identity claim.
  🦷 **RE-VERIFY THE NET STILL HAS TEETH AFTER ANY CORPUS CHANGE.** `08-starved-u1` earns its seat by leaving the
  damage threshold **unsaturated**, and a live economy buys it more gear (equipment levels 70 → 79) — which could
  have **saturated** it and quietly blunted the net. Checked: `damage-sensitivity`'s **positive control still goes
  RED** against the fresh traces. ⚠️ My own saturation probe read `MODULES.maps.enoughDamage` and sampled **0
  ticks** (the field is module-local, cf. the #70 note) — **a probe looking in the wrong place reports 0.0% and
  looks like an answer.** The existing mutation self-test was the authoritative check; don't build a proxy when a
  positive control already exists.
  🎭 **THE ADVERSARIAL REVIEW EARNED ITS SEAT — AND WAS ALSO WRONG ONCE.** It caught (a) my comment's false
  absolute — once-per-tick is **exact only for RESOURCE-cost triggers**; `Lumberjack` costs `jobs:{Farmer:1}` and
  `breeding` reads `trimps.employed`, both moved by AT's own `mainLoop` **after** `checkTriggers` ⇒ a 1-tick lag;
  (b) that my net proved "fires at least once", **not** "every tick" — a once-per-run regression passed all three
  behavioural tests (now pinned by a cadence assertion, mutation-checked `expected 1 to be 50`); and (c) **a second
  casualty of the same stub → #126** (stacked void-map completions schedule `createHeirloom` via `setTimeout`, so
  those rewards are silently dropped). But it also **asserted `corpus-coverage` needed no update** — it had no Bash
  and reasoned statically; the suite proved the pin **did** move (05 gains `buyEquipment` + `buyUpgrade` — the first
  Coordination purchase in the net's history; 06/07 gain `buyEquipment`). **A static read is not a test run.**
  🪤 **`npm run test:ci | tail` REPORTS `EXIT=0` — that is `tail`'s status, not the suite's.** I walked straight into
  the trap CLAUDE.md already warns about, with **one test failing**. Redirect to a file, then read `$?`.

- **🐛 THE TOOLTIP AUDIT'S NINE BUGS — #111/#112/#113/#114/#116/#117/#118/#119/#120 SHIPPED** (2026-07-13) —
  1046 tests, deploys green. #115 closed as **not-a-bug**. Every fix is mutation-checked; none rest on a green
  L0 (see below).
  📖 **A TOOLTIP THAT DISAGREES WITH THE CODE IS EVIDENCE *ABOUT THE CODE*.** Asking "is this sentence true?"
  of 574 descriptions found nine real defects. The recurring shape is a **sentinel whose truthiness
  contradicts its documented meaning**: `GymWall` defaults to **-1** and `buildings.ts` tested
  `if (getPageSetting('GymWall'))` — **-1 is TRUTHY**, so the "disabled" default silently clamped Gym buys to
  1-at-a-time and ate the DecaBuild bonus **for every default user**. Its mirror: `MaxMapBonusAfterZone = 0`
  means "always" and **0 is FALSY**, so the one value documented as "use it always" disabled the feature.
  Also: `Rexterminate*` compared `"Extermination"` (the game's id is **`Exterminate`**) ⇒ dead since it
  shipped; `SpireBreedTimer` captured `var prespiretimer` under `spireActive` and restored it under
  `!spireActive` — mutually exclusive branches in a per-tick function ⇒ it wrote **`undefined`** over the
  player's GA timer on every Spire exit; `"DAS: Normal"` never read its own value; `"Auto **No** Spire"` fired
  **only inside** a Spire.
  🕳️ **THE L0 NET'S GREEN MEANT NOTHING FOR HALF OF THESE — CHECK WHAT THE TRACES RECORD.** The traces log
  `buyBuilding("Gym", …)` but **not `game.global.buyAmt`**, which is the only thing #112 changes; and the
  corpus has no DecaBuild reward, so the bug **cannot even fire** there. ATGA is worse: **zero traces touch
  `Geneticist`**. `baseline-zero` is green before and after. Evidence was hand-built and each test
  mutation-checked by restoring the bug (`expected 1 to be 10`; `expected undefined to be 42`).
  👁️ **READ `settings-visibility.ts` BEFORE JUDGING A SETTING — the runtime gate and the render gate are often
  ONE INVARIANT EXPRESSED TWICE.** This reversed me **twice**. **#115**: I claimed `ATGA2timer` was a silent
  trap (configure a Spire override, get nothing) — but `settings-visibility.ts:592` `turnOff()`s **all ten**
  overrides unless the base timer is positive, *every tick*. The trapped user **cannot exist**; verified live,
  overrides are **0/5 visible**. The gate is also semantically load-bearing (`var target` has no other
  initialiser), so "fixing" it would mean **inventing a fallback breed-timer** = sacrosanct tuning. **#117**:
  `turnwson` reads as dead (zero reads — true) but renders **only while Windstacking is OFF**, to explain why
  the tab is empty. It is **signage**, not a dead control. A reference count answers "is it read?", never
  "why does this control exist?"
  🕸️ **TWO NETS HAD HOLES, AND THE AUDIT FOUND THEM (#120).** `settings-wired` asked *"is this id quoted
  ANYWHERE?"* — which a `turnOn("turnwson")` mention satisfies, **and so do the two frozen
  `serializeSettings` preset blobs in `utils.ts`**, JSON strings naming ~200 setting ids sitting **inside the
  net's own corpus**. Every id they name auto-passed the check meant to prove it was wired. It was written
  loosely on purpose (~50 settings are read via *dynamically constructed* ids — `getPageSetting('Max' + b)`,
  `getPageSetting(shrineSettings[u][m].zone)`), so the fix is to **strip the constructs that fake a read** and
  resolve the dynamic families explicitly, not to tighten the regex. `dom-ids` walked only
  `byId`/`getElementById` — but `turnOn`/`turnOff` are a **one-call indirection onto the same sink**
  (`toggleElem` → `getElementById`, returning on null: the exact silent no-op the net exists to catch).
  Making them sinks **immediately found 7 more dead toggles**. ⚠️ A net that reports a false positive gets
  muted, so ids the fork mints at runtime (`el.id = 'hiddenBreedTimer'`) are now a **derived** id source.
  🎭 **THE FALSIFIER EARNED ITS SEAT.** A 3-agent panel on #115 (advocate-for / advocate-against / falsifier)
  landed **2-1 against my own recommendation**, and the lone dissenter was the only one that never opened
  `settings-visibility.ts`. Never hand a panel your premise as fact.

- **📖 #107 — TOOLTIPS ARE COMPOSED RECORDS NOW, AND THE DRIFT IS DEAD AT THE SEAM** (2026-07-13) — all 574
  descriptions rewritten against the code that implements them; 1022 tests green; persistence contract proven
  byte-identical.
  🧨 **THE AUDIT FOUND NINE CODE BUGS (#111–#119), NOT NINE TYPOS.** A tooltip that disagrees with the code is
  evidence *about the code*. `Rexterminateon`/`Rexterminatecalc` compare `challengeActive === "Extermination"`
  but the game's id is **`Exterminate`** (config.js:5451) ⇒ both settings **dead forever**. `GymWall`'s default
  is **`-1`**, and `buildings.ts:81` tests `if (getPageSetting('GymWall'))` — **`-1` is truthy**, so the default
  silently pins Gym buys to 1-at-a-time and eats the DecaBuild bonus (same species: `MaxMapBonusAfterZone = 0`
  is *falsy*, so the documented "always" value disables the feature). `SpireBreedTimer` captures
  `var prespiretimer` inside a `spireActive === true` branch and restores it in a `!spireActive` branch of the
  **same per-tick function** ⇒ always `undefined`. `Hdshrine`'s "DAS: Normal" **never reads its own value**.
  ⚠️ **NONE were fixed in #107** — descriptions-only is what keeps L0 baseline-zero green and makes the change
  provably safe. Fix them alone; each is behavioural and will move the traces.
  🎯 **DON'T RETYPE A TABLE — DELETE THE SECOND COPY.** `BuyJobsNew`'s tooltip hand-copied the seven worker-ratio
  tiers and got **all six documented ones wrong**, omitted the 7th, and implied an ordering the selector does not
  use (`world >= 300` is tested FIRST and beats every Tribute tier). Correcting the numbers would have rebuilt the
  cause. The table now lives in **`src/modules/jobs-ratios.ts`**; `jobs.ts` publishes it onto MODULES and the
  tooltip renders from it. Being wrong is no longer representable.
  🔩 **DERIVE AT THE SEAM, NOT PER-CALLSITE.** The `Default: x` line is composed inside `createSetting`
  (`settings-engine.ts` `defaultFacet`) from its **own `defaultValue` argument** — so it reaches all 574 settings
  with **zero call sites touched**, and a description can no longer disagree with its default. Multitoggles resolve
  the index to its **label** ("Default: Auto Worker Ratios", not "1"). A net now **fails any description that
  hand-types its own default** — that second copy is exactly how `recommend: -1` outlived the code.
  🕳️ **`MODULES` IS AMBIENT RUNTIME STATE — DO NOT READ IT FROM `settings-defs`.** Rendering the tiers from
  `MODULES["jobs"]` made `initializeAllSettings()` **throw `ReferenceError: MODULES is not defined`** in every
  harness that mounts settings without booting the bot. A pure import has no ordering hazard. (Found by running,
  not reading.)
  🚫 **A CANNED "AT OVERWRITES THIS" BADGE WOULD HAVE BEEN A *NEW* LIE.** My first design auto-badged all 12
  `setPageSetting`'d ids. The code falsified it: the ratio boxes are rewritten every tick *but only while
  `BuyJobsNew == 1`*; `AutoMaps` is written by the **user's own** AutoMaps button; `TrimpleZ` is a one-shot. So
  `overwritten` is a **hand-written condition** and the net enforces its **PRESENCE, not its wording** — a 13th
  write site fails CI.
  🛠️ **METHOD (reusable):** 9 agents authored in parallel, each *verifying claims against consuming code*, each
  writing **JSON to scratchpad — never editing `settings-defs.ts`** (subagents share one working tree; parallel
  writes to the persistence-contract file would clobber). A lead-side applier swaps **only argument 3**, so ids,
  order, types and defaults are *structurally* out of reach — then a contract check proved all six non-description
  args byte-identical to `main`. Pre-apply validator caught a hand-typed default an agent slipped in **twice**.

- **🏦 THE BOT WAS SATISFICING — #108/#109/#110 shipped** (2026-07-13, `81d78114`) — 1015 tests, deploy green,
  published userscript verified to carry all three.
  💰 **AT DECLINED AN AFFORDABLE GEAR LEVEL ON 18,503 OF 20,000 TICKS.** `autoLevelEquipment` gates armor on
  `!enoughHealthE` and weapons on `!enoughDamageE || enoughHealthE` — so the moment it judges itself strong
  enough *for the current zone* it converts **nothing** and banks the income. That, not a reserve or a late
  arrival, is the 20M unspent metal #108 reported. Removing the brake is **−19.5% ticks-to-next-zone** (noise
  floor 3.5%), shipped as the opt-in `InvestSpareMetal` (default OFF ⇒ byte-identical; L0 baseline-zero green).
  🎯 **THE WIN IS TIMING, NOT VOLUME** — the unGated bot ends with only **~3 more levels**, bought *early*, where
  the damage compounds into faster clears and more income; it ends with **more** metal banked despite spending
  more, because it got deeper. "Strong enough for this zone" is the wrong bar: gear pays for itself.
  🪤 **THE INTUITIVE FIX MEASURED HARMFUL — and reasoning would have shipped it.** AT keeps ONE candidate per
  (stat,resource) key (`Best`, highest Factor), so an unaffordable Best buys nothing even with six cheaper
  unlocked pieces affordable that tick. Falling back to the cheapest affordable piece is **−2.8% (INSIDE the
  noise floor)** alone, and stacked on the real fix it drags **−19.5% → −8.6%**: metal spent on cheap low-Factor
  gear is metal not spent on the good piece. **Rejected by measurement.** Method: instrument ONE clean run
  (per-tick `metal.owned` + every DECLINED decision with its full gate vector, using the game's OWN oracle
  `canAffordBuilding(name,null,null,true,false,1)`) → A/B vs a measured noise floor → `inf_metal` as the positive
  control. Then **re-verify on the SHIPPED setting**: a splice is evidence about a patch, not about the product.
  💬 **A RAW `"` IN A SETTING DESCRIPTION SILENTLY KILLS ITS TOOLTIP (#110).** `createSetting` splices name +
  description into an `onmouseover` attribute holding a **double-quoted** JS string, so one quote closes the
  literal, the handler **fails to compile**, and the browser leaves `onmouseover === null`. **Nothing throws** —
  the control still renders, clicks and saves. **`RVoidMaps` shipped dead this way.** Escaped at the seam
  (`tipAttr()`, all 8 injection sites). ⚠️ Do **NOT** escape `name`/`description` in place: both are stored on
  the record and rendered as the label, and a multitoggle's `name` is an **ARRAY** of option labels. Net:
  `tests/nets/settings-tooltips.test.ts` mounts all 574 settings and asserts every tooltip **compiles** — node
  env + recording-DOM stub + **esbuild's parser**, because `no-new-func` is a real lint gate, jsdom raises an
  **uncaught** SyntaxError when you read a broken handler, and **esbuild cannot run under jsdom**.
  🧩 **#109** — `RScientistPercent` (minted by #106) was never routed through `settingsVisibility()`, so U1
  rendered **both** "Scientist %" boxes. Net: of the **57 U1/U2 twin pairs**, both halves must appear in the
  turnOn/turnOff table. It was the only violation.

- **🌙 THE ALL-NIGHT SWEEP — 30 of 36 code-review-v2 issues closed** (2026-07-13) — 955 tests, deploy green.
  Everything below is a *live* gotcha, not a changelog. The changelog is the closed issues.
  🔬 **THE PROOF NET CAN FINALLY SEE THE BOT (#90/#98).** It used to record only buy events on 4 saves that all
  decoded to HZE=3/world=4 — so a **1,000,000× damage multiplier passed the entire sim suite GREEN**. Now: 8
  saves, **10/10 mutators**, and `tests/sim/damage-sensitivity.test.ts` is a **mutation SELF-TEST** that patches
  the bundle every CI run and *demands* the differential go red.
  🎯 **REACH ≠ SENSITIVITY — the deepest lesson of the night.** Fixing corpus *reach* was not enough: on a deep
  save with AT mapping and fighting every tick, the 1e6× injection **still diffed to zero**. AT's damage
  decisions are **threshold predicates** (`dmg * cutoff > enemyHealth`), and on a *healthy* save that predicate
  is **already true** — multiplying its input by a million leaves it true. **Calling a function is not the same
  as depending on its answer.** The fix was `08-starved-u1`: damage-*starved* but *perked*, so the threshold sits
  **unsaturated**. Any future coverage claim must prove sensitivity, not just execution.
  🕳️ **The recorder was watching the WRONG functions.** AT creates maps via `buyMap()` (38 sites) and recycles
  via `recycleBelow()` — *neither was wrapped*. The `recycleMap` that *was* wrapped only fires at the game's
  100-map cap. #90 blamed corpus depth; that was the smaller half.
  🚨 **PHANTOM SETTINGS ARE NOT TYPOS — re-minting one is a DATA-LOSS BUG.** Three were REAL settings deleted
  upstream in 2020 (`701faab4`). `createSetting` applies its default **only when nothing is stored**, and
  `serializeSettings` round-trips unknown keys **forever** — so re-minting a deleted id **resurrects the user's
  five-year-old value**. Three dispositions: **repoint** at an existing id (mints nothing) · **delete** the read ·
  **mint only if `git log --all -S"createSetting.*<id>"` is EMPTY**. `MaxTox`'s phantom was *accidentally
  protective* — defining it would throw in the portal path; it was **deleted**, not defined.
  🧩 **FIX THE CONSUMER BEFORE THE DEFAULT.** Proven twice (#96, #100). A default change **cannot reach existing
  users** (their localStorage already holds the old value), so the consumer fix is the *only* step that helps
  anyone who already plays — and adopting the "correct" default first actively regresses them. #96: `[NaN×9]`
  **was** the load-bearing "unset" semantic, and the codebase's own `[-1]` convention would have blocked Smithy
  for the whole Hypothermia challenge. #100: flipping the default first makes `archstring()` write
  `game.global.archString = ''` into the live game.
  🪤 **CHECK EXIT CODES, NOT GREP.** I verified lint with `| grep -cE '^\s*(error|warning)'` — which never matches
  oxlint's format. It printed `0` every time, **a gate incapable of failing ran for hours**, and the Pages deploy
  went **RED on `main`** invisibly. Use `npm run lint >/dev/null 2>&1; echo $?`. See
  [[feedback-check-exit-codes-not-grep]].
  🔒 **The golden-regen laundering hatch is CLOSED (#91).** `regen-src-golden.mjs` now **refuses to run without
  `--reason`**, records it + the sha256 in a committed manifest, and the parity test rejects any golden whose hash
  disagrees. It cannot stop a determined liar; it converts a *silent side effect of a build command* into an
  *attributable claim in the diff*. (Its `bytes` field must be `Buffer.byteLength`, not `String.length` — they
  diverge the moment a non-ASCII char lands in the emit.)
  🧹 **ZERO `oxlint-disable` suppressions remain in `src/` (#92, 69 → 0), and `no-eval`/`no-new-func`/
  `no-implied-eval` are ON with a test forbidding their suppression.** #76 found a live `eval()` RCE that had
  shipped for **nine years** behind an `oxlint-disable-next-line no-eval` — and the feature it guarded had been a
  **no-op since 2016** (the importer truncates at the first `;`; the exporter emits JSON, which has none).
  💀 **31 unreachable exports deleted (#85) via a call-graph WALK, not a reference count** — that is how it found
  dead *cycles* (`RsafeBuyBuilding` and friends have real callers; every caller is itself dead). ⚠️ `RsafeBuyBuilding`
  must **not** be resurrected: it was a copy of `safeBuyBuilding` **with the coordinator hook missing**.
  📌 Oracle re-pinned once (`oracle/v3-u2-autobuildings`, #69 ship C). **COUNT THE EVENTS BEFORE BELIEVING A
  DIVERGENCE COUNT** — "1167 divergences" was 1201 → 1204: three *inserted* events, every pre-existing one
  unchanged. #90/#98's re-record was **additive, not a re-pin** (all 10 prior traces byte-identical).

- **👁️ #90 + #98 SHIPPED — THE NET CAN SEE THE BOT NOW** (2026-07-13) — the L0 proof net was structurally
  blind to combat: a **1,000,000× damage multiplier passed the entire sim suite GREEN**. It now goes **RED
  with 1542 divergences**, and that is enforced forever by `tests/sim/damage-sensitivity.test.ts` — a
  **mutation self-test** that patches the built bundle on every CI run and demands the differential notice.
  Corpus: 4 saves → **8**; recorded mutators: 8 → **10**; coverage **10/10, zero blind mutators**.
  🎯 **THE LESSON THAT GENERALIZES — REACH ≠ SENSITIVITY, and this is the part that nearly shipped wrong.**
  Fixing reach was NOT enough. After adding a deep save where AT maps, fights and sets formations every tick
  — with `calcOurDmg` genuinely called — the 1e6× injection **still diffed to ZERO**. AT's damage decisions
  are **threshold predicates** (`enoughDamage = (dmg * cutoff > enemyHealth)`, maps.ts:403) and on a healthy
  save that predicate is **already true**, so multiplying its input by a million leaves it true. **Calling a
  function is not the same as depending on its answer.** The fix is `08-starved-u1`: damage-STARVED but
  PERKED, so the threshold sits **unsaturated** (`enoughDamage === false` on all 2000 ticks) and the value is
  load-bearing. **When you add a fixture to cover a calculation, ask whether its result can still change an
  outcome there — then prove it by mutation.**
  🕳️ **#90 named the wrong cause.** It blamed corpus depth alone. The bigger half was that **the recorder was
  watching the wrong functions**: AT creates every map via `buyMap()` (**38 callsites**) and mass-recycles via
  `recycleBelow()` (**3**) — *neither was wrapped*. The `recycleMap` that WAS wrapped is only the fallback at
  the game's **100-map cap** (`buyMap() == -2`, main.js:6597), so it was never going to fire on an ordinary
  save; `07-map-cap-u1` sits on the cap deliberately and is the only fixture that reaches it. Wrapping the
  wrong function and then blaming the saves is the #66 mistake in a new costume.
  🔒 **The blindness had ONE mechanical cause, and it is worth knowing:** every save decoded to world=4 with
  **`mapsUnlocked === false`**, and `maps.ts:253` opens `if (!game.global.mapsUnlocked || calcOurDmg(...) <= 0)
  { enoughDamage = true; ... return }` — so the damage term was **short-circuited out of every decision**. Not
  mysterious; arithmetic on dead code. Root cause of the shallowness: **`totalPortals = 0`** on every save ⇒ no
  helium ⇒ no perks ⇒ `antiStacks` pinned at 0 forever (main.js:11682) ⇒ AT hits a damage wall at z6 and
  **soft-locks inside a map it cannot clear** (measured: world 6 for 25,000 consecutive ticks). **jsdom was
  never the obstacle** — the old "deep states need progression jsdom can't reach" note was a hypothesis
  written down as a fact. Grant perks (what every post-portal player has) and AT advances immediately.
  ✅ **ADDITIVE RE-RECORD, NOT A RE-PIN** — the oracle bundle is untouched (`oracle/v3-u2-autobuildings`). All
  **10 pre-existing traces re-recorded BYTE-IDENTICAL** (cmp-clean). *That byte-identity is the check to repeat
  on any future corpus growth* — it is what proves additivity rather than a laundered behavior change.
  ⚠️ **Do not weaken `damage-sensitivity.test.ts`.** If it goes red, the net has lost its ability to see combat
  regressions and every green baseline-zero for damage code is worthless. **Fix the corpus, not the test.**

- **🕸️ THE `needs-net` CLUSTER SHIPPED — #68–#74 + #88, five permanent nets + every fix** (2026-07-12, `10494e92`…`bd0cc71d`)
  — 725 tests green, Pages deploy green. Each bug class is now closed by a **mechanical set-difference**, not by
  reading, and each net carries a **shrinking baseline**: fix a bug and the net goes RED until you delete its
  entry. That cluster added 5; **`tests/nets/` now holds 15** — `ls tests/nets/` is the list, don't
  hand-maintain one here.
  🎯 **The nets caught MY OWN errors, repeatedly — that is the argument for them.** My first MODULES net was blind
  to `const customVars = MODULES["maps"]` (31 reads hidden); my ambient-var mutation-check was inadequate and the
  agent said so; my DOM-id resolution rule was over-broad in exactly the way that lets typos survive. Each would
  have shipped a net that *certified a class as closed while it wasn't*. **Always mutation-check a net, and pin
  anti-false-green counts — a walk that breaks collapses to ∅ and passes vacuously.**
  🚨 **PHANTOM SETTINGS ARE NOT TYPOS — and "just add the missing createSetting" is a DATA-LOSS BUG.**
  `RCapEquiparm`/`Rgearamounttobuy`/`Ronlystackedvoids` were REAL settings, added 2019 (`d33ea06b`), **deleted
  upstream 2020 (`701faab4`)** with their reads left behind. `createSetting` applies its default **only when
  nothing is stored**, while `loadPageVariables()` restores the whole localStorage blob and `serializeSettings()`
  round-trips unknown keys **forever** (`cleanupAutoTrimps()` only runs on a manual click). ⇒ **Re-minting a
  deleted id RESURRECTS the user's 2020 value.** Three dispositions, not two: **repoint** at an existing id (mints
  nothing) · **delete** the read · **mint** only if `git log --all -S"createSetting.*<id>"` is EMPTY. Corollary:
  `getPageSetting` returns **`undefined`, not `false`**, for a veteran user (`hasOwnProperty` succeeds on the stale
  primitive). See [[reference-settings-stale-key-resurrection]].
  ⚠️ **THE L0 NET IS BLIND TO `calcOurDmg` — a 1,000,000× damage multiplier PASSES THE SIM SUITE GREEN** (#98,
  reproduced by two agents independently). The recorder emits only buy events (#90) **and every corpus save decodes
  to HZE=3/world=4** — so combat/mapping/zone-gated paths are *structurally unreachable*, not merely uncovered.
  **"I shipped it and the net stayed green" is a MEANINGLESS sentence for combat math.** Run the **positive
  control** (break your own change, confirm the net can see it); if it can't, build the evidence by hand —
  `tests/calc.damageTrio.test.ts` is the pattern. AT had been **under-rating its own damage 6×**.
  📌 **ORACLE RE-PINNED `oracle/v2-post-bugfix` → `oracle/v3-u2-autobuildings`** (#69 ship C only). **COUNT THE
  EVENTS BEFORE YOU BELIEVE A DIVERGENCE COUNT:** baseline-zero cried "1167 divergences", which looks like the
  wholly-shifted trajectory the re-pin rule exists to refuse — but tallied *by event*, oracle 1201 → working 1204:
  every pre-existing event **unchanged**, exactly **three inserted**. The 1167 is the index shift they cause. Only
  `04-u2-radon` moved; the other nine reproduced byte-identically against a bundle containing the whole cluster —
  an independent proof the rest is trace-neutral.
  🔴 **U2 AutoBuildings had NEVER EXECUTED** (`RBuyBuildingsNew` = the STRING `'true'`; its only gate is `== true`).
  In U2 the mainLoop never calls U1's `buyBuildings()`, so `RbuyBuildings()` is the *only* building automation —
  and its `else` branch is what enables vanilla AutoStorage. U2 players got **neither housing nor storage**: every
  resource pegged at 100% of cap, **permanently**. Enabling it: **+68% max population**. Blocker fixed first — the
  never-run body **seized the player's AutoStorage button** (`toggleAutoStorage` is a **flip**, not a setter, so AT
  forced it back on ~100ms after the player turned it off, forever). Now one-shot.
  🧪 **New issues from this pass:** **#93** (🎚️ `mostEfficientHousing` scores EVERY housing type with
  `Hut.increase.by` — a Collector (+5000 pop) graded as **+3**; AT would never buy one) · **#94** (`RbuyBuildings`
  bypasses the #57 coordinator) · **#95** (`for..in` over an array → 7 phantom `RMax<idx>` reads) · **#96**
  (`Rhypofarmstack` default is the *string* `'undefined'` → `[NaN×9]`) · **#97** (`Rdheirloomswap` gates on DAILY
  ids but calls the NON-DAILY equip fns; five correct daily twins exist with **zero callers**) · **#98** (the net
  blindness above).
  🪤 **`oxlint` no-unused-vars does NOT count uses inside a comma-sequence expression** — a legacy one-liner will
  report a genuinely-used local as unused. De-comma it (#92 sanctions this "behind the live net"); do **not** add a
  suppression to hide a phantom warning.

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
  ✅ **#87 — SHIPPED (`d99702ca`). The mainLoop HAS an error boundary.** 99 `atGuard(...)` sites in
  `legacy/AutoTrimps2.js`; `src/modules/guard.ts` catches, throttles and reports, and
  `tests/sim/guard-silence.test.ts` demands the whole L0 corpus run with **zero** caught errors. A throw
  inside one automation is contained to that automation.
  ⚠️ **This bullet used to read "mainLoop has NO error boundary … fix LAST and ALONE", and on 2026-07-13 I
  quoted that stale text as a live risk in TWO design analyses (#115, #119)** — pricing changes against a
  "permanent cascading outage" that cannot happen. A subagent caught it, not me. **Do not argue from the
  cascade.** When a `Recent decisions` bullet describes an OPEN problem, check whether it has since shipped
  before you reason from it.
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
- **Phase 1 true-TS (milestone #5) — COMPLETE** (2026-07-09) — all 31 modules `@ts-nocheck` → strict TS,
  and the ambient seam (`trimps.d.ts` + `at-legacy.d.ts`) is stable.
  🚨 **THE "ZERO `@ts-nocheck` REMAIN" CLAIM WAS FALSE FOR MONTHS, AND THIS FILE IS WHERE IT LIVED**
  (found 2026-07-13 by a *doc audit*, not by any gate). `buildings.ts:5` — the project's most
  game-coupled module — had a header comment that *wrapped* onto a line beginning
  `// @ts-nocheck original, the conversion gate).` That is **prose**, but **TypeScript honours
  `@ts-nocheck` ANYWHERE in a file's leading comment block**, so the entire module was exempt from
  `tsc`. Proven by probe: appending `const x: number = "s"` produced **ZERO** typecheck errors. It hid
  because every signal agreed it was fine — the file *looks* converted, this doc said the class was
  closed, and **`tsc` exits 0 precisely BECAUSE the file is skipped: a disabled gate reports success.**
  (Re-checked, it typechecks clean — no latent bugs, just an unverified module.) Now netted:
  `tests/nets/no-ts-nocheck.test.ts` forbids the token from *beginning* a comment line in `src/`
  (mid-sentence mentions, which five modules have, stay legal).
  **GOTCHA — the byte-diff gate invocation:** `npx esbuild <file> --tsconfig-raw='{}'` on BOTH
  sides (`--tsconfig-raw='{}'` normalizes the `"use strict";` esbuild otherwise emits only for in-tree
  files); **NEVER pass `--loader=ts` with a file arg — it errors and emits nothing = a false green.**
- **A prior from-scratch rewrite was abandoned** — refactor in place via the strangler, don't
  reinvent the wheel.
