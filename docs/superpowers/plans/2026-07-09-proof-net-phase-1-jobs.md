# Proof-Net Phase 1 · `jobs.ts` Beachhead — Implementation Plan

**Status:** Draft 2026-07-09
**Spec:** [`2026-07-09-proof-net-modernization-design.md`](../specs/2026-07-09-proof-net-modernization-design.md) §11–§12, §15 (DoD)
**Branch:** `feature/proof-net-phase-1-jobs`
**Mode:** Lead-inline (spec §12 — needs the differential + locks the per-module recipe before fan-out)
**Module:** `src/modules/jobs.ts` (708 lines)

---

## 🎯 Goal

Take `jobs.ts` from typed-but-legacy-shaped → genuinely idiomatic TS, **end-to-end through
every proof-net layer in one inline pass**, so the recipe is locked before Phase 2 fans out.
This is the *first* module where byte-parity is deliberately abandoned; the behavioral net
(L0 trace differential + L1 golden/spy-logs + L2 semantic invariant + the #32 manifest path)
replaces it.

Definition of done = spec §15's 8 gates, all green, then squash → FF-merge → delete branch.

---

## 🧭 What already exists (don't rebuild)

- **L0 differential** — `scripts/sim/trace.mjs` `runTrace` + `diffTraces`; `buyJob` is already one
  of the 8 recorded native mutators (`recorder.mjs`). Baseline-zero is GREEN
  (`tests/sim/baseline-zero.test.ts`) — HEAD reproduces the 3 committed U1 traces.
- **L1a partial** — `tests/jobs.workerRatios.test.ts` covers 4 of `workerRatios`' branches
  (world≥300, default/autoRatio1, Metal, Watch). Not yet branch-adequate; `RworkerRatios` has
  **zero** coverage.
- **Manifest gate** — `scripts/sim/manifest.mjs` `assertTraceMatches`; `manifest.json` currently
  `{ "waivers": [] }`.
- **Corpus** — 3 U1 saves (`01-early-u1`, `02-mid-u1`, `03-challenge-watch`). **No U2/radon save**
  (deferred to #47). This is the load-bearing constraint on the #32 fix (Task 4).

---

## 🚧 Tasks

### Task 1 — Precondition + baseline snapshot 🪨 (inline)
- `npm run build && npm test && npm run typecheck && npm run lint` — confirm known-good start.
- Confirm `../trimps-game` clone present (sim skips in CI via `describeSim`; runs locally here).
- Record the current L0 traces are reproduced (baseline-zero green) — this is the "before" the
  refactor must preserve.
- **No code change.** Establishes the safety floor.

### Task 2 — L1 characterization to branch-adequacy 🪨 (inline)
The DEPTH gate (spec §8): every exported decision fn ≥1 golden/spy-log AND every
balance-sensitive branch has an edge fixture. Extend the net **before** touching logic.
- **L1a `workerRatios`** — extend `jobs.workerRatios.test.ts` to all 8 ratioSet branches
  (customRatio / world≥300 / Tribute>3000+Magma / Tribute>1500 / Tribute>1000 / realMax>3e6 /
  realMax>3e5 / default) + both overrides (Watch, Metal). Density target = `stance.test.ts:145-175`.
- **L1a `RworkerRatios`** — new golden covering its 8 branches + the `Transmute` override
  (note: R-mirror has `Transmute`→`[4,5,0]` where U1 has `Metal`; **arms a distinct branch**).
- **L1b actuator spy-log `buyJobs`** — new `tests/jobs.buyJobs.test.ts` (jsdom). Spy the 8 native
  mutators (reuse `recorder`-style wrapping) and assert the **ordered `(fn, args)` native-call log**
  for representative states: (a) world==1 early gate, (b) Watch scientist-ratio override
  (`jobs.ts:118`), (c) breeding-gate early-return, (d) full ratiobuy path, (e) magmamancer path,
  (f) job-protection rounding guard. The ordered log **is** the contract (spec §L1b — `buyJob`
  fires for side-effect after the `buyAmt='Max'` smuggle at `jobs.ts:41`).
- **L1b actuator spy-log `RquestbuyJobs` + `RbuyJobs`** — the radon actuators. `RbuyJobs` carries
  the #32 marker (Task 4), so its spy-log is the regression-test host.
- `assertHydrated` wired for any `newGame`-overlay fixture that touches game methods (spec §8;
  `gameFixture.ts:44`).
- **No logic change** — this task only adds tests that PASS against current (pre-refactor) code.

### Task 3 — Idiomatic refactor (behavior-neutral) 🎨 (inline)
With the net green, refactor freely (spec §1 idiom list):
- `var` → `const`/`let`; `==`/`!=` → `===`/`!==` where semantics-preserving (audit `== 0`,
  `!= null` guards — keep `!= null` where nullish-loose is intended, or convert to explicit).
- Extract the repeated `Math.ceil(game.resources.trimps.realMax() / 2) - game.resources.trimps.employed`
  freeWorkers computation (appears ~8×) into a named helper.
- Model the worker-ratio tuple + job-name union as real types (`type JobName`, `type Ratio =
  [farmer:number, lumber:number, miner:number]`).
- Prune dead code if any surfaces (e.g. the shadowed `var breeding` at `jobs.ts:131`).
- **Gate after each logical chunk:** `npm test` (L1 unchanged) + rebuild + baseline-zero (L0 ∅).
  Any L1 or L0 delta here = accidental drift → revert & investigate.
- **Do NOT touch the #32 marker in this task** — behavior-neutral only.

### Task 4 — #32 fix: `RbuyJobs` misplaced-paren freeWorkers cap 🪨 STOP-GATE (inline)
`jobs.ts:488` — `Math.ceil(Math.min(realMax/2), owned)` → the `owned` arg lands on `Math.ceil`
(ignored), so freeWorkers is never capped by `owned`. Intended: `Math.ceil(Math.min(realMax/2, owned))`.

**Classification (spec §7):** a misplaced parenthesis is a **typo-class mechanism defect**
(same bucket as `recyle`/`slot5`), NOT a numeric-literal/tuning change → *ship-on-sight class*.
**BUT** it changes worker counts in RbuyJobs, which sits near the balance bright line, and the
in-code comment flags it "user-gated." **→ Present the exact before/after diff + the differential
result to the user for explicit sign-off before shipping** (guardrail #7). This is the beachhead's
proof of the STOP check.

**Coverage reality (the finding):** `RbuyJobs` is **radon/U2**; the corpus is all **U1**, so the
L0 differential **cannot reach this fix** — it would be a silently-unfired manifest waiver, not the
clean zero-delta trivial case the spec §11 anticipated. Resolution (recommend **A**):
- **A (recommended):** gate the fix with an **L1 unit regression test** on `RbuyJobs`'s freeWorkers
  (spec §8 — L1 depth covers the cold branch L0 breadth can't), asserting the corrected cap fires
  when `owned < realMax/2`. Add a manifest waiver keyed to #32 documented as *expected-unfired on
  the U1 corpus* (a loud comment, not a silent skip). Cheapest correct path; no U2-save synthesis.
- **B:** synthesize a U2-radon save (#4 from spec §9) now so L0 reaches it — larger scope, pulls
  #47 work forward.
- **C:** defer the #32 fix entirely; characterize+refactor jobs.ts only, file the fix as
  blocked-on-U2-save. Weakens the beachhead's "exercises the manifest case" claim.

Ship artifacts (spec §6): (a) in-region regression test, (b) the paired L1 line updated with
`// fix: #32` citation, (c) manifest entry. One commit.

### Task 5 — L2 semantic invariant 🪨 (inline)
Spec §11/§L2: give `jobs.ts` a **job-priority-order** structural assertion — a runtime invariant
decoupled from byte/emit that survives re-baselining (the `createSetting`-catalog analogue). Assert
the ordered consideration set of jobs in `buyJobs` (Scientist → Trainer → Explorer → Farmer/Miner/
Lumberjack ratiobuy → Magmamancer → protection) and in `RbuyJobs` (Explorer → Meteorologist →
Worshipper → ratio workers). Best-effort per spec §13.6; if no clean invariant, fall back to L1
branch coverage + L0 backstop and note why.

### Task 6 — Full DoD gate + fresh-reviewer pass 🪨 (inline + subagent review)
Spec §15's 8 gates:
1. L1 net green (unchanged or `// fix: #32` manifest delta only).
2. `npm run typecheck` clean (strict).
3. `npm run lint` clean.
4. L0 differential == oracle trace modulo manifest, on affected call-sites.
5. Coverage: no refactored line outside covered set — **c8 wiring deferred to #47**; substitute
   branch-fixture discipline (Task 2) + note the gap explicitly.
6. L2 semantic invariant asserted (Task 5).
7. Balance sacrosanct — #32 fix got explicit user sign-off (Task 4).
8. jobs is an orchestrator → **live Chrome smoke** (`npm run serve` → :8080, confirm clean console
   + job hiring works) + verify `legacy-bridge` spread-order intact.
- **Fresh-reviewer agent** (CLAUDE.md required phase, no implementation bias) — dispatch
  `feature-dev:code-reviewer` on the diff.

### Task 7 — Ship 🚀 (inline)
- Squash → FF-merge to `main` → delete branch (both ends) per merge-cadence.
- Update the GitHub milestone/issue for Phase 1.
- Write the handoff for Phase 2 (vertical in-place sweep).

---

## 📋 Execution notes

- **Sim runs local-only** (needs `../trimps-game`); CI skips via `describeSim`. Re-record oracle
  only on a deliberate clone bump: `node scripts/sim/record-oracle.mjs`.
- **Recipe being locked** for Phase 2 fan-out: characterize→net-green→refactor→gate-each-chunk→
  #32-via-manifest→semantic-invariant→DoD. Every idiom decision here becomes the subagent template.
- **The one user gate** in this plan is Task 4 (the #32 behavioral fix). Everything else is
  behavior-neutral and self-gating on the L1/L0 nets.
