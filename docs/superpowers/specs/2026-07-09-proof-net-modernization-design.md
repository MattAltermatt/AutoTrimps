# AutoTrimps → Idiomatic TypeScript: Proof-Net Architecture & Modernization Design

**Status:** Approved 2026-07-09 (SME dueling-agents brainstorm — 3 advocates + adversarial falsifier + synthesis, run `wb2fjpvdn`; user approved the decision).
**Extends:** [`2026-07-08-true-ts-modernization-design.md`](2026-07-08-true-ts-modernization-design.md) — this activates its deferred **Thread C (tests)** + **Thread D (refactor/optimize)** and supersedes their sketch with a battle-tested proof-net design.
**Builds on:** the [`2026-07-09-tuning-sim-harness-design.md`](2026-07-09-tuning-sim-harness-design.md) headless self-play rig (#45), which becomes this net's differential runner.
**Planning surface:** GitHub Milestone + Issues (project convention). This doc is the *architecture*; the executable plan lives on GitHub.

---

## 🎯 1. Goal

Take AutoTrimps from **typed-but-legacy-shaped** ("Phase 1 added type annotations byte-faithfully — not one line of logic or structure changed") to **genuinely idiomatic, well-structured TypeScript** — split the 2–3k-line giants, kill `var`/`==`/global-mutation/magic-number/string-in-numeric-field idioms, model real domain types, extract pure functions, prune dead code, and optimize the 10 Hz `mainLoop` where profiling justifies it — **and fix the latent bugs** (drain #32 + whatever the process surfaces).

Driver = **code-quality-led modernization + measured perf, with bug-fixing** (not faithfulness-for-its-own-sake). "We don't need to keep bugs for the sake of keeping them."

The nightmare being engineered against is unchanged: **silent balance drift** — a modernization edit that quietly changes what the bot buys/fights/maps, undetected.

---

## 🧨 2. The core problem: byte-parity is gone, and two failure surfaces need two gates

Phase 1's safety net was **esbuild byte-parity** — emitted JS byte-identical to legacy ⇒ provably behavior-identical. **The instant we "truly change the logic," that gate evaporates by definition** (refactored code emits different JS). A *behavioral* net must replace it, and it must distinguish an **intended** behavior change (a reviewed, tested bug fix) from **accidental** drift — a naive "diff-vs-oracle == 0" gate flags every bug fix as a failure.

The dueling agents' decisive finding: **there is no single right gate**, because the work has two structurally different failure surfaces.

| Failure surface | Why a single gate fails |
| --- | --- |
| **Intra-module refactor** (var→const, ==→===, extract fns, model types) — ~90% of the work by module count | A whole-bot differential *can* catch drift but can't **localize** it across a 2799-line blast radius, and can't separate an intended fix from drift without per-function ground truth. |
| **Cross-module code MOVE** (split `mapfunctions.ts` 2799 / `other.ts` 2378; dedupe `calcBaseDamageInX`, defined in **both** `calc.ts:1011` and `stance.ts:17` where load/spread order alone picks the winner — `legacy-bridge.ts:24-26`) | A per-module unit net is **structurally blind** — the test on the *old* module is meaningless the moment its code is relocated across a boundary. |

**Decision: match the gate to the failure mode — a tiered hybrid with an archetype-conditional primary.** This rejects all three single-mechanism approaches the duel considered:
- **Differential-primary (D): FATAL at full scope** — the harness doesn't freeze `new Date()`, so time-gated decisions (`maps.ts:372` preSpireFarming, `jobs.ts:209` timeOnZone, `other.ts:1868` antistack) are non-deterministic; a fresh game is **inert** (world 1 after 3000 AT ticks); jsdom is ~10× too slow for full sweeps (#45 finding). It survives only as a *seeded, save-loaded, clock-frozen, early-window* slice.
- **Net-first-everything (H): over-engineering** — front-loads a net that provably can't complete for actuators, and risks freezing #32 bugs in as "correct." (Its headline dedupe volume was also empirically wrong — ~10 R-mirror fns, not the claimed 122.)
- **Pure Vertical (V):** blind to the giant-splits that are the whole point.

---

## 🏛️ 3. The decision — tiered hybrid, gate matched to failure-mode

| What you're doing | PRIMARY gate | Also runs |
| --- | --- | --- |
| **In-place refactor** of a decision module | Per-module unit net: golden-masters (pure predicates) + spy-logs (actuators) | Trace differential (backstop) |
| **Cross-module MOVE** (split a giant; dedupe) | Seeded native-mutator **action-trace differential** | Both modules' unit nets (localize + cover cold branches) |
| **Plumbing** (settings-* / import-export / UI) | **Light path**: existing tests + the 569-id `createSetting` catalog + Chrome smoke — **no differential** | — |

The light path is not a shortcut — **#39 proved it sufficient**: an additive settings-render change shipped through exactly this path (net-first #46 → refactor → Chrome-verify, no whole-bot differential) and held. A differential over UI plumbing buys nothing.

---

## 🧱 4. The layered proof net

| Layer | Role | Applies to |
| --- | --- | --- |
| **L0 — Seeded native-mutator action-trace differential** (working build vs committed oracle traces) | **PRIMARY for cross-module MOVES**; SUPPORTING always-on backstop elsewhere. Records `(tick, fn, argsHash)` over the ~220 native-mutator call-sites (`buyJob`/`buyBuilding`/`buyUpgrade`/`runMap`/`selectMap`/`buyEquipment`/`setFormation`/`recycleMap`). **Invariant under internal reorganization** — the only layer that survives code crossing module boundaries. | Orchestrators + the giant-split operation + whole-bot integration |
| **L1a — Pure-predicate golden masters** (return == frozen value), **branch-covered** | **PRIMARY for pure predicates.** MUST use edge fixtures per balance-sensitive branch (challenge arms, zone thresholds, crit tiers) — **not** one neutral-stubbed golden per fn (the razor-path thinness the adversary flagged: `calc.test.ts:56-85` stubs every multiplier to assert `500`). Density target = `stance.test.ts:145-175` / `query.z300.test.ts:20`. | calc HD/attack/health math, stance helpers, query, heirloom-eff, workerRatios, fight-info prediction |
| **L1b — Actuator spy-logs** (native-call fn+args+order == frozen) | **PRIMARY for actuators.** For functions whose return is meaningless (`jobs.ts:41` smuggles `buyAmt='Max'`, then `jobs.ts:48` calls native `buyJob` for pure side-effect), the ordered native-call log **is** the contract. Precedent: `stance.test.ts:48-67` spy-logs `setFormation`. | jobs-buy, buildings, upgrades, magmite, equipment-buy, gather, maps preset-selection |
| **L2 — Per-module semantic invariant** (the `createSetting`-id-catalog analogue) | SUPPORTING drift-launder guard. A runtime STRUCTURAL assertion **decoupled from byte/emit** that survives re-baselining (settings has it: `settings-inventory.test.ts:67`, 569 ordered controls). E.g. jobs: job-priority order; maps: ordered map-tier consideration set; calc: multiplier-composition order. **Best-effort** — where a clean structural invariant exists; fall back to L1 branch coverage + L0 backstop where it doesn't. | All decision modules (settings is the only one with one today) |
| **L3 — Light path** (existing tests + `createSetting`-id catalog + Chrome smoke) | PRIMARY for plumbing; no differential. | settings-engine/menu/visibility/defs/boot, import-export |

---

## 🔒 5. Oracle strategy — pin a tag, then RECORD (don't diff a live rebuild)

**The adversary's sharpest catch: `main` is *already not* the faithful oracle** — #39 (`09d36d8f`) changed `renderControlFace` (leading glyph + `(n/N)` counter where legacy rendered a bare name) and **regenerated the golden**; the parity test is now self-referential, and the true legacy baseline (gh-pages) is deleted.

1. **Git-tag `5e51f56d` (`feat(#31): Phase 1 complete`) as `oracle/phase1-faithful`** — the last commit whose emitted bundle is byte-identical to legacy. Everything after (#35 `byId`, #37, #39) diverges the emit, even where behavior-preserving.
2. **Confidence re-verify (Phase 0):** esbuild-emit of the tagged `src/modules/*.ts` vs the pre-conversion legacy `.js` (from git history before #26), via `npx esbuild <file> --tsconfig-raw='{}'` on both sides. Phase 1's wave gates already proved this by construction; this is belt-and-suspenders since gh-pages is gone.
3. **Derive two committed artifacts from the tag** (so the oracle neither evaporates on merge nor forces a faithful-bundle rebuild every CI run):
   - **L1 golden-masters / spy-logs** — captured by running the tagged build against the save corpus, checked in as standing vitest assertions.
   - **L0 action traces** — build the tagged bundle **once**, run each committed save × seed through the clock-frozen differential, commit results as `tests/fixtures/traces/<save>.<seed>.trace.json`. The working build diffs against these **committed** files, not a live two-build race.
4. **Trace = native-mutator calls (fn + args + order), NEVER DOM state** — so #39-class cosmetic render changes physically cannot false-positive the gate.
5. **Baseline-zero validation (Phase 0):** the differential of **current `main` (cc3be1e9) vs `oracle/phase1-faithful`, with zero modernization**, must be **empty**. This simultaneously (a) validates the harness against a known-should-be-zero case and (b) confirms #33–#39 were all behavior-preserving on the decision path. A non-empty result is itself a finding.
6. **Pin `../trimps-game` at v5.10.1.** Committed traces are tied to the clone version; re-record only on a deliberate clone bump.

---

## 🩹 6. Bug-fix reconciliation — an enumerated delta, never a wholesale re-baseline

Each fix ships **one commit** with three coupled artifacts:
- **(a)** a targeted **regression test** asserting the corrected behavior **in the exact touched region** (the CLAUDE.md exempted-region rule);
- **(b)** the paired L1 golden/spy-log line updated with an inline `// fix: #NN` citation — a loud single-line reviewable diff (`- expect(x).toBe(wrongOld)` / `+ expect(x).toBe(rightNew)`);
- **(c)** a known-diff **manifest** entry keyed to the issue id, enumerating the exact expected L0 divergence (`save, tick, fn, argsBefore→argsAfter`).

**Gate:** `actualDiff = T_working ⊖ T_oracle`; PASS iff `(actualDiff \ manifest) == ∅`. Every *other* divergence fails. This is a strict-superset test, not the naive `diff==0`.

- A **behavior-neutral** fix (e.g. `jobs.ts:486-487` — the 2-arg `Math.ceil` whose 2nd arg is a no-op) passes with an **empty manifest** (zero trace delta) — the trivial case.
- A **behavior-changing** fix (`mapfunctions` `recyle` typo, portal `loom`, maps `=`-vs-`==`) carries a manifest entry.
- An **unfired** manifest entry (declared delta absent from the actual trace) raises a **coverage warning** — the corpus doesn't reach the fix; add a targeting save.
- **A naked golden/trace regeneration with no manifest entry + regression test + issue ref IS the accidental-drift alarm** — this closes the exact laundering vector #39 exhibited (a wholesale 1 MB golden regen that co-mingled an incidental `settings-visibility.ts` edit).

---

## 📏 7. The bright line (already decided — sacrosanct tuning)

| Bucket | Treatment |
| --- | --- |
| **Genuine defects** — typos (`recyle`, `slot5`/`slot6`, `hson` read-before-assign), wrong operators (`=` vs `==`), dead/undef refs (portal `loom`), coercion bugs (number vs `"Infinity"` string) | **Fixed on sight**, each pinned by a regression test |
| **Balance / tuning numbers** — ratios, damage, cost, rate, growth, multiplier formulas | **STOP for explicit user approval**, always — never changed silently, never via the auto-manifest path |

A third bucket — behavior that *looks* like a bug but downstream code depends on — is caught for free: "fixing" it lights up a golden/trace somewhere unexpected → stop and look.

---

## 📐 8. Coverage adequacy — measured on the UNION of breadth and depth

Neither layer alone is enough; adequacy is the **union** (this resolves D's killer coverage risk).

- **BREADTH (L0):** a **committed corpus of 5 saves** × 3 seeds (averaged over the 41 unseeded combat `Math.random` sites). Run **c8/v8** over `src/` during the differential and **publish** the covered line+branch set. A refactor may only touch lines **inside** the covered set — reaching an uncovered line is **BLOCKED** until a save is added or an L1 unit test covers it (the risk is made **loud**, not silent).
- **DEPTH (L1):** a decision module is "characterized enough to refactor" iff **every** exported decision fn has ≥1 golden/spy-log assertion **AND** every branch keyed on a balance-sensitive input has an edge fixture (density = `stance.test.ts:145-175` / `jobs.workerRatios.test.ts:38-78`) **AND** `assertHydrated` passes for any `newGame`-overlay fixture that touches game methods (**today unused — must be wired in**, `gameFixture.ts:44`) **AND** each in-region #32 bug has a failing-then-fixed regression test.

L0 proves hot-path call-sequencing; L1 proves the **cold combinatorial branches** (challenge × universe × zone × ~570 settings) a seeded early-window run can never reach. Complementary, not redundant. A giant-split is clear iff **both** hold on the affected call-sites.

---

## 💾 9. The save corpus — SYNTHETIC, engine-generated, committed

**User directive (2026-07-09):** the user is early-game and cannot export advanced saves — **generate the corpus programmatically.** This is an *upgrade*, not a compromise: a differential needs only **relative** determinism (the same synthetic save feeds both builds, so any unrealistic quirk cancels in the diff), and generated saves are reproducible + version-controlled with no user-export dependency.

**Mechanism (Phase 0, `scripts/sim/make-fixtures.mjs`):** boot the clone headless, drive the game's **own** engine into each target state as far as possible (native challenge-entry, portal-to-U2, resource/zone setup), then serialize via the game's native `save()` → LZString string, committed under `tests/fixtures/saves/`. Using engine mechanisms (not raw field-poking) keeps states internally consistent so **both** builds run without throwing. Phase-0 research task: map the clone's zone-jump / challenge-start / portal APIs (`../trimps-game/main.js`).

**The 5 boundary states** (each arms a distinct branch class):

| # | State | Arms |
| --- | --- | --- |
| 1 | early-U1, pre-portal | baseline early-game buy/gather/fight loop |
| 2 | post-portal U1, mid, challenge-free | perk/portal-modified prediction math |
| 3 | **active-challenge run** (challenge chosen by SME — see §14) | the `jobs.ts:118` Watch/Metal override branch + challenge-gated logic |
| 4 | U2-radon run | `RcalcOurHealth` (`calc.ts:1306`) + z300 hard-scaling (`query.z300.test.ts:20`) + R\* mirrors |
| 5 | deep-zone / Spire-adjacent | time-gated `preSpireFarming` (`maps.ts:372`) / antistack (`other.ts:1868`) — non-degenerate **only** once the clock-freeze lands |

We already have a world-4 save from #45 as a starting point.

---

## ⏱️ 10. Clock-freeze (SME-resolved — mechanism, not balance)

Today's **FATAL** gap: the harness advances `game.global.time` but does **not** freeze `new Date()`/`Date.now()`, so wall-clock-reading decisions are non-deterministic and degenerate in a tight loop. Phase 0 adds a fake-clock shim that **freezes `Date.now()`/`new Date()` and advances it by tick-count mirroring the game's own bookkeeping (1 tick = `1000/game.settings.speed` ms)** — the same rate `gameTimeout` uses — so time-gated branches (`preSpireFarming`, antistack, `timeOnZone`, quest cadence) land at a **representative** point on their curve rather than pinned to ~0, and are identical across both builds.

---

## 🎯 11. First beachhead — `jobs.ts` (708 lines)

The smallest true decision module that exercises **every layer** end-to-end in one inline pass:
- **L1b** actuator spy-log — `buyJob` after the `buyAmt='Max'` smuggle (`jobs.ts:41,48`);
- **L1a** pure-predicate golden — `workerRatios` (partial net already exists, `jobs.workerRatios.test.ts`);
- **L0** — `buyJob` is one of the ~220 recorded call-sites, proving the differential end-to-end;
- **branch-fixture discipline + the coverage-gap argument** — its Watch/Metal challenge overrides (`jobs.ts:118`) are cold on a seeded early-window run, forcing L1 depth to cover what L0 breadth cannot;
- **bug-fix reconciliation** — carries a live #32 marker (`jobs.ts:486-487`, 2-arg `Math.ceil`) that exercises the **zero-delta** manifest case, and its worker-count logic sits near the balance bright line, proving the STOP check.

Small enough to finish the full recipe (tag + trace + spy-log + semantic-invariant + manifest + coverage-gate) inline and **lock the idioms** before fanning out. The giants are too big for a first proof; the pure leaves (`query` 132, `stance`) skip the actuator archetype and carry no live #32 bug.

---

## 🗺️ 12. Phase sequence

| Phase | Work | Mode |
| --- | --- | --- |
| **0 · Oracle + harness foundation** (folds in all 7 guardrails) | tag + verify `oracle/phase1-faithful`; **add the fake-clock freeze**; author + commit the 5-save synthetic corpus (`make-fixtures.mjs`); build the ~220-call native-mutator recorder + trace-diff runner + known-diff manifest; record + commit oracle traces; wire c8/v8 coverage + `assertHydrated`; **baseline-zero validation** | Lead-inline |
| **1 · Beachhead `jobs.ts`** | end-to-end: prove every layer + fix-reconciliation (zero-delta case) + coverage gate + branch-fixture discipline + per-module semantic invariant. Lock the recipe. | Lead-inline |
| **2 · Vertical in-place sweep** | pure predicates (calc math family, stance, query, fight-info) → actuators (buildings/upgrades/magmite/equipment/gather/maps-preset). Per module: characterize→adversarial review→fix-on-sight (mechanism + test; **balance STOPS**)→refactor→L0 backstop clean→semantic invariant→squash+FF-merge+delete branch. Drain behavior-changing #32 via the manifest path; **TAG each #32 region provisional-pending-fix** so it's never blessed as correct golden. | Fan to subagents (pure vitest loops) |
| **3 · Cross-module giant-splits** (differential-PRIMARY, net-first-NARROW) | `mapfunctions.ts`/`other.ts` + the `calcBaseDamageInX`/`RcalcOurHealth` dedupe. Build the FULL pre-split net (both modules' spy-logs + L0 adequate on affected call-sites) BEFORE moving code; verify the `legacy-bridge` spread-order (`legacy-bridge.ts:24-30`) + src-IIFE-before-legacy build seams survive; split; gate on L0 == manifest; live Chrome smoke. | Lead-inline (needs dev server + clock-frozen differential) |
| **4 · Plumbing light-path** | settings-* / import-export under existing tests + the 569-control `createSetting`-id catalog + Chrome smoke; no differential. | Fan / lead |
| **5 · Measured hot-path optimization** | ONLY where c8/profiling shows real cost (`mainLoop` 10 Hz; `challengeActive` called ×179 in `calc.ts` alone) + complete the #32 drain. | Lead-inline |
| **6 · Fresh-reviewer code review** (required CLAUDE.md phase, no implementation bias) → live Chrome verify → **user-verify-before-FF-merge** | — | — |

---

## 🛡️ 13. The 7 mandatory guardrails (from the adversary — non-negotiable)

1. **Pin the oracle to `5e51f56d`, not `main`** — HEAD (#39) already diverged the settings-render DOM path. Re-verify its esbuild emit vs git-historical legacy.
2. **Freeze AND lockstep-advance a fake clock** over `new Date()`/`Date.now()` (today unfrozen) or every time-gated decision stays degenerate/non-deterministic. Capture the trace as native-mutator calls, **NOT** DOM state.
3. **Seed and COMMIT representative save fixtures** — a fresh `newGame()` is inert (world 1 after 3000 AT ticks). Without saved states the differential traces nothing. (Generated synthetically per §9.)
4. **Every #32 fix ships a regression test in-region + an enumerated expected trace-delta** — never regenerate a golden wholesale to "absorb" a fix (the #39 co-mingled-diff laundering vector).
5. **Do NOT rely on `assertHydrated` as the false-green defense** — it is currently unused by real tests (only self-tested in `calc.getTrimpAttack.test.ts`); shipped tests use method-less `makeMinimalGame` skeletons. Before refactoring a module, expand its goldens with **branch-covering** fixtures, not one neutral-stubbed golden per fn.
6. **Give every refactored decision module a SEMANTIC invariant** (best-effort, the `createSetting`-id-catalog analogue) — byte/trace goldens alone degrade to an unreviewable wholesale diff on a giant-split.
7. **Balance sacrosanct** — any diff touching a numeric literal (damage/cost/rate/growth/formula) or a #32 formula's shape HALTS for explicit user approval; only mechanism/typo/dead-ref/coercion fixes ship on sight, each with a regression test.

---

## ⚠️ 14. Risks accepted & decisions resolved

**Risks accepted:**
- The seeded early-window differential covers only hot-path call-sequencing; cold combinatorial branches are covered ONLY by L1 unit depth. A refactor changing a branch cold-on-corpus AND lacking a unit test can still ship silent — **made loud** by the c8 gate blocking refactors into uncovered lines, and bounded by the 5-save corpus arming every major mechanic branch.
- jsdom ~10× slower than Chrome; a full live multi-run sweep stays infeasible — accepted by recording traces **once** from the tag and diffing against committed files (per-CI cost is a cheap file diff).
- Committed traces tied to `../trimps-game` v5.10.1; re-record on a deliberate clone bump only.
- The per-module semantic invariant is hand-designed; some modules may lack a clean one — fall back to L1 branch coverage + L0 backstop.
- Recording goldens from the tag can enshrine a #32 region as "correct" if netted before review — mitigated by TAGGING every #32 region provisional-pending-fix and draining via the manifest path before declaring it clear (process discipline, reviewer diligence).

**Decisions resolved (no further user input needed):**
- **Clock regime** — advance by tick-count mirroring `game.global.time` (§10). SME-decided (mechanism).
- **Active-challenge save (#3)** — user is not yet deep enough to have Watch/Metal; **SME to generate one synthetically.** Lean **Watch** (arms the `jobs.ts:118` scientist-ratio override the beachhead exercises; falls back to Metal if Watch is harder to synthesize).
- **#32 bright-line per item** — triaged at the moment each bug is touched in Phase 2 (recyle / loom / `=`-vs-`==` → ship-on-sight; any numeric-literal or formula-shape change → STOP).

---

## ✅ 15. Definition of done (per module)

1. L1 net green — golden-master / spy-log **unchanged** (or changed only via a reviewed `// fix: #NN` manifest delta).
2. `npm run typecheck` clean under `strict`.
3. `npm run lint` clean.
4. L0 differential == committed oracle trace (modulo declared manifest deltas), on the affected call-sites.
5. c8 coverage: no refactored line outside the published covered set (or a paired L1 test added).
6. Per-module semantic invariant asserted (where one exists).
7. **Balance sacrosanct** — any numeric-literal change halted for explicit user approval.
8. (Orchestrators / giant-splits) live Chrome smoke clean; the `legacy-bridge` spread-order + build-order seams verified intact.

Then: squash → FF-merge to `main` → delete branch (both ends).

---

## 📎 16. Adversary premise findings (recorded — the *why* behind the guardrails)

| Premise | Verdict | Consequence |
| --- | --- | --- |
| **P1** `main` is a faithful byte-identical oracle | **PARTIAL** | #39 drifted the settings DOM render + regenerated the golden → pin to `5e51f56d`; trace native mutators, not DOM |
| **P2** a whole-bot differential is deterministic | **FALSE** | `new Date()` unfrozen; fresh game inert; jsdom 10× → only a seeded, save-loaded, clock-frozen early-window slice works |
| **P3** unit golden-masters characterize behavior | **PARTIAL** | `assertHydrated` unused; goldens are razor-thin (deps stubbed neutral) → require branch-covering fixtures before refactor |
| **P4** "fix bugs" is compatible with `diff==0` | **PARTIAL** | naive `==0` flags every fix → the enumerated manifest-delta contract (§6); each module needs a semantic invariant so drift can't launder through a re-baseline |
