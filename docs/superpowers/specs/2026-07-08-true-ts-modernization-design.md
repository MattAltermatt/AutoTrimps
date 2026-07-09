# AutoTrimps → True TypeScript: Modernization & Hardening Design

**Status:** Approved (brainstorm 2026-07-08) — SME-driven, user delegated technical decisions.
**Extends:** [`2026-07-08-autotrimps-modernization-design.md`](2026-07-08-autotrimps-modernization-design.md) (the strangler migration).
**Planning surface:** GitHub Milestone + Issues (this doc is the *architecture*; the executable plan lives on GitHub per project convention).

---

## 🎯 1. Goal

Take the AutoTrimps automation from *"faithful JS-in-a-`.ts`-wrapper with the type checker off and ~zero tests"* to genuinely-typed, tested, and structurally clean TypeScript — **without changing a single automation decision the userscript makes.**

"Solid to start with" is the operative constraint: every step must be *provably behaviour-preserving*. The nightmare being engineered against is **silent balance drift** — a modernization edit that quietly changes what the bot buys/fights/maps, undetected.

---

## 📏 2. Current state (measured 2026-07-08)

```text
src/modules                          count / size
-----------------------------------  -------------------------------------------
modules                              33 files, ~21,077 lines
  @ts-nocheck faithful ports         31   ← type checker OFF for all of these
  genuinely typed (real TS)           2   (time.ts, buystate.ts)
tests                                 3 files, 234 lines
  automation-logic coverage          ~0%  (2 typed leaves + 1 build-order guard)
biggest modules                      mapfunctions 2794 · other 2378 · calc 1813 · maps 1590 · perks 1460 · equipment 1166
legacy remaining                     AutoTrimps2.js (loader) + Graphs/highcharts/mods (charts+vendor)
```

The seam (from the strangler design, still in force): converted modules read/write the game's global `game` object — and other globals like `getPageSetting`, `autoTrimpSettings`, native mutators — as **free identifiers** (no imports). `src/legacy-bridge.ts` publishes converted exports onto `globalThis`.

---

## 🧵 3. The four threads and their forced ordering

| Thread | What it is |
| --- | --- |
| **A · Review** | Find latent correctness bugs (the #24/#25 class) in the automation logic. |
| **B · True TS** | Remove `@ts-nocheck`, add real types across 31 modules (`strict`). |
| **C · Tests** | Build the characterization safety net (currently ~none). |
| **D · Refactor/Optimize** | Split the 2–3k-line giants, prune dead code, speed up hot paths. |

**The ordering is not a preference — it is a safety constraint.** B and D are *unsafe without C*:

- Turning the type checker on surfaces latent coercion bugs whose *fixes change behaviour* — that is exactly how #24 (`maps.ts` `selectedMap =` vs `==`) and #25 (`heirlooms.ts` number-vs-`"Infinity"` string compare + `slot5`/`slot6` typos) were found.
- Restructuring 21k lines of subtle game math with no net ships silent balance drift.

So: **C (net) + A (review) first → B (typed, gated by C) → D (refactor, gated by C).**

---

## 🛡️ 4. Safety-net architecture — a layered hybrid, split by function archetype

A 4-agent duel (3 advocates + 1 adversarial falsifier, all grounded in `src/modules` + `../trimps-game`) established that **no single test mechanism works**, and that the naïve version fails *silently*. Key findings, with evidence:

- **`JSON.stringify(game)` silently drops the game's ~1,091 methods.** `game` is full of functions (`game.buildings.Shed.cost.wood` is a function at `../trimps-game/config.js:11475`; `game.generatorUpgrades[x].cost()` is *called* as one in `magmite.ts:22,92,116`). The game's own `save()` (`../trimps-game/main.js:57–218`) stringifies **and then `delete`s ~80 keys** — proof the persisted shape ≠ the live shape. A raw-snapshot fixture yields a `game` whose methods are `undefined` → either `TypeError` on replay or (worse) a silent short-circuit to default branches that **passes while characterizing nothing**.
- **Most high-value modules are *actuators*, not pure reads.** `buildings/equipment/jobs/magmite/maps/portal/upgrades` call native mutators (`buyBuilding` `buildings.ts:69`, `buyJob` `jobs.ts:49`, `buyEquipment` `equipment.ts:393`) whose effect is a `game` mutation needing the *whole engine*. Return-value assertions are meaningless for these.
- **Two input stores live *outside* `game`:** `autoTrimpSettings` (what `getPageSetting` actually reads — `utils.ts:58`, **not** `game`) and the **DOM** (map automation reads state from `<input>` values — `mapfunctions.ts:310–325`). A `game`-only snapshot misses both.
- **Time is a branch input.** `new Date().getTime()` deltas decide branches (`breedtimer.ts:171` antistack, `jobs.ts:210` timeOnZone, `maps.ts:372` preSpireFarming) — non-reproducible unless the clock is frozen.
- **Modules run DOM at *import* time** (`utils.ts:159` top-level `document.createElement`) → Node can't even load them without jsdom.

### The design: test each archetype the way that fits it

```text
archetype                    examples                                  harness             assertion
---------------------------  ----------------------------------------  ------------------  ---------------------------
pure predicates              calc HD/attack/health helpers, stance     Layer 1 · unit      return == golden master
  (game+settings → num/bool)   helpers, workerRatios, heirloom-eff     vitest + jsdom      + synthetic #24/#25 edges
actuator decisions           buyJobs / buyBuildings / buyUpgrades /    Layer 1 · unit      spy-log: native calls
  (compute → call native)      magmite / map presets (the "what")      spies on mutators   (fn+args+order) == frozen
integration / wiring         full mainLoop, autoMap end-to-end,        Layer 2 · Chrome    action-trace diff:
  (engine + DOM + timers)      DOM-input-coupled map running           seeded differential faithful vs true-TS build
```

- **Layer 1 (fast, CI, the bulk).** vitest + jsdom + a `makeGame()` helper that **overlays captured fixtures onto a fresh `newGame()`** (from the clone's `config.js`, which re-supplies the ~1,091 methods). Pure predicates assert return-value golden masters (`toMatchSnapshot`); actuator *decisions* assert a **spy-log of native calls** (fn + args + order) — which *is* the faithful-port behaviour contract, no engine required. Existing precedent: `tests/buystate.test.ts` already injects `globalThis.game` and asserts.
- **Layer 2 (slow, pre-merge, few).** A deterministic differential run in the game clone: `seedrandom` over `Math.random` + a frozen fake-clock + a recorder wrapping the ~12 native mutators (`buyBuilding` `main.js:4835`, `buyJob` `5190`, `runMap` `11026`, `setFormation` `16837`, …) + a canned save. Run the **faithful build vs the true-TS build**, diff the action trace; the first divergence pins the offending module. This **upgrades the existing live-verify gate from "eyeball the console" to "diff the action trace."**

### Non-negotiable guardrails (all from the falsifier)

1. **Never inject raw `JSON.stringify(game)`.** Overlay data onto `newGame()`; capture via the game's own export where possible.
2. **Anti-false-green tripwire.** Before trusting any "unchanged" result, assert `typeof game.buildings.Shed.cost.wood === 'function'`. If it's `undefined`, the fixture is lying → fail loud. (This single guard prevents the entire "green suite that tests nothing" failure mode.)
3. **jsdom mandatory.** Provide a DOM so import-time side effects don't throw.
4. **Capture `autoTrimpSettings` as a separate fixture** (distinct global, not in `game`).
5. **Freeze `Date.now()`** to the capture timestamp.
6. **Capture/stub DOM-input values** (`mapLevelInput.value`, `.checked`) for map modules.

### De-risking spike (first task, ~half-day)

Before committing to 31 modules: stand up `makeGame()` + jsdom, golden-master **one** pure predicate (`getTrimpAttack`, `calc.ts:44` — ~24 clean reads, DOM-free), **and** prove the tripwire fires when a method is stripped. This validates the whole recipe against reality first — the literal embodiment of "make sure it's solid before building on it."

---

## 📐 5. Strictness contract (Q3 — SME-decided)

**Own-code strict, boundary pragmatic.**

- AT's own modules compile under `strict: true`. This is what catches the #24/#25 class.
- The game's global API (`game`, native mutators, `autoTrimpSettings`) is typed as a **pragmatic ambient boundary** — `src/game/trimps.d.ts` (game API) + `src/game/at-legacy.d.ts` (not-yet-converted AT globals), improved incrementally as modules convert.
- `any` is allowed **only at the seam**, never in internal AT logic.
- Fully modeling the 40k-line game object we don't own is explicitly **out of scope** (backlog) — low marginal value; the game API is stable and read-only from AT's side.

---

## 🗺️ 6. Phases

### Phase 0 · De-risk foundation
1. **Harness spike** — `makeGame()` skeleton (overlay onto `../trimps-game` `newGame()`), jsdom setup, golden-master `getTrimpAttack`, prove the tripwire. *(recipe validation)*
2. **Fixture capture kit** — a console/export snippet capturing `{ game, autoTrimpSettings, DOM-inputs, timestamp }` at play points; capture 3–6 fixtures spanning early / mid / late / a challenge run.
3. **Layer-2 differential harness** — `seedrandom` + frozen clock + native-mutator recorder + canned save + trace-diff, wired into `npm run serve` + Chrome.
4. **Fold in the review bug backlog** (from the in-flight review, workflow `wsog4ano9`); fix confirmed bugs — **mechanism/typo only; any balance-number change STOPS for an explicit ask** — each paired with a synthetic regression test in the region it touches.

### Phase 1 · True TS conversion (archetype-ordered, leaf-first)
Each module: capture/confirm its Layer-1 tests green → remove `@ts-nocheck` → add real types under `strict` → triage every surfaced error into `{ mechanism fix | tuning-ask | type annotation }` → tests still green → typecheck + lint clean → (actuators/orchestrators) Layer-2 trace diff clean + live smoke → squash + FF-merge + delete branch.

### Phase 2 · Refactor & optimize
Only on now-typed, now-tested modules. Structure-first (see §8).

---

## 🔢 7. Module sequencing

- **Wave 1 — pure predicates** (highest value, cheapest harness, where bugs hide): the `calc.ts` math family, `stance.ts` helpers, `heirlooms.ts` efficiency math, `jobs.ts workerRatios`, `fight-info.ts` prediction. Crown-jewel prediction logic.
- **Wave 2 — actuator decisions** (spy-log unit tests): `buildings`, `jobs` (buy), `upgrades`, `magmite`, `equipment` (buy), `gather`.
- **Wave 3 — orchestrators / integration** (Layer-2 gated): `maps`, `mapfunctions`, `other`, `portal`, `ab`, `MAZ`, `nature`, `breedtimer`, `scryer`.
- **Fill (low bug-yield, parallelizable) — `settings-*` + `import-export`:** mostly UI plumbing / serialization already guarded by the byte-parity gate; type these last or as low-risk background fill.

---

## ⚡ 8. Optimization scope (Phase 2)

*Measure, don't assume. No balance-number changes.*

- **Split the giants** — `mapfunctions.ts` (2794), `other.ts` (2378) into focused, single-purpose modules once typed + tested make it safe.
- **Dead-code elimination** — strict types reveal unreachable / never-read branches.
- **Dedupe** — collapse repeated patterns surfaced during conversion.
- **Hot-path pass** — `mainLoop` runs at 10 Hz (`AutoTrimps2.js:93`); profile for genuinely expensive recomputes (e.g. `challengeActive` is called ×179 within `calc.ts` alone) and memoize **only where profiling shows a real cost.** Runtime perf is a *measured* opportunity, not an assumed one.

---

## ⚠️ 9. Top risks & mitigations (from the duel)

| Risk | Mitigation |
| --- | --- |
| Snapshot silently drops game methods → false-green suite | `makeGame()` overlay onto `newGame()` + the `typeof …cost.wood === 'function'` tripwire |
| Actuators can't be characterized by return value | Spy-log native-call assertions (Layer 1) + action-trace differential (Layer 2) |
| Fixtures are samples, not exhaustive; can freeze current bugs | Deliberate multi-state capture + synthetic edge fixtures; confirmed review bugs get their *own* targeted tests |
| Layer-2 non-determinism (RNG + wall-clock ticks) → false positives | `seedrandom` + frozen fake-clock over `Date.now`/`performance.now`; run sequentially, not two tabs |
| Hidden state outside `game` (settings, DOM, time) | Capture all four inputs (`game`, `autoTrimpSettings`, DOM-inputs, timestamp) per fixture |
| Modules do DOM at import → can't load in Node | jsdom in the vitest environment |

---

## ✅ 10. Verification gates (definition of done, per module)

1. Layer-1 tests green — golden master / spy-log **unchanged**.
2. `npm run typecheck` clean under `strict` for the converted module.
3. `npm run lint` clean.
4. Byte-parity gate where applicable (the `createSetting` id list for settings modules — the persistence contract).
5. Layer-2 action-trace diff clean in the clone (actuators/orchestrators) + live smoke (`npm run build && npm run serve` → `http://localhost:8080/?mute=1`, clean console).
6. **Balance sacrosanct:** any change to a numeric literal (damage / cost / rate / growth / formula) halts for explicit user approval.

Then: squash → FF-merge to `gh-pages` → delete branch (both ends).

---

## 📋 11. Open items

- **Review bug backlog** — pending workflow `wsog4ano9` (correctness + conversion-seam, adversarially verified). Populates Phase 0 task 4 on completion.
- **Native-reader helper** — decide per-wave whether to *port* the tiny pure native readers (`challengeActive` is 4 lines, `main.js:1753`) into a shared `test-natives` helper (higher fidelity) vs *stub* them (cheaper, lower fidelity). Lean port-where-cheap.
- **Fixture play-points** — finalize the exact save states to capture (aim: one per major mechanic boundary — pre-Spire, post-portal, an active challenge, deep-zone).
- **Cleanup** — remove the untracked `implicit-global-audit.mjs` scratch file left by a review agent once the review workflow completes.
