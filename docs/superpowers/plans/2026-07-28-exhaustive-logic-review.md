# Exhaustive Logic Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vet every piece of automation logic in the AutoTrimps fork for three classes of defect — does it do what it says (A), does it match the game (B), is the decision good (C) — using instruments that have each been proven capable of failing.

**Architecture:** Six phases. Phase 0 proves every existing net and gate can fail before any of their greens are believed. Phase 1 mechanizes decidable bug classes as exhaustive static nets. Phase 2 wraps seven unwrapped native game mutators so ~3,700 currently-blind lines become visible to the proof-net differential. Phase 3 reads only what 0–2 structurally cannot reach. Phase 4 measures decision quality. Phase 5 reviews and merges.

**Tech Stack:** TypeScript + Vite + esbuild · vitest (node + jsdom per-file) · jsdom sim harness booting a SHA-pinned Trimps clone · oxlint · TS compiler API for scope-aware static analysis.

**Design:** [`2026-07-28-exhaustive-logic-review-design.md`](../specs/2026-07-28-exhaustive-logic-review-design.md)

---

## 📍 STATUS — read this first to resume

Last updated 2026-07-28. **Any session can pick this up from here; nothing below depends on a
particular conversation's context.** All findings live in GitHub Issues, all evidence in committed
docs.

```text
phase                                       state         where the record is
------------------------------------------  ------------  --------------------------------
0  audit the instruments                    ✅ SHIPPED    merged d5b271f9, deployed live
1  class nets                               🟡 2 of 4     setting-array-compare, game-api-drift
2  sim visibility expansion                 🟡 partial    gather.ts unblinded; 4 natives
                                                           blind by corpus depth (#196)
3  adversarial review — sim-BLIND modules    ✅ DONE       33 findings, #163-#195
3b adversarial review — sim-VISIBLE modules 🔄 RUNNING    ~16k lines, see below
4  strategy A/B (class C)                   ⬜ NOT STARTED
5  reviewer + honest report + fix batch      ⬜ NOT STARTED
```

**Issues filed: #162–#197 (36).** None fixed yet — the hybrid landing model batches product changes
into one reviewed set at the end (Phase 5). Instruments and nets have been landing continuously.

### What Phase 3 covered, and what it did NOT

Phase 3 swept only the modules with **no native-mutator terminus** — the ones the proof net is
structurally unable to see. Phase 3b covers the remainder:

```text
SWEPT in Phase 3   perks · ab · other-praiding · MAZ · nature · magmite · scryer
                   heirlooms · gather · fight-info · native-conflicts · custom-ui

SWEPT in Phase 3b  calc 1752 · mapfunctions 2026 · maps 1615 · settings-visibility 1143
                   import-export 1195 · equipment 986 · mapfunctions-amp 844 · jobs 834
                   buildings 789 · other 725 · portal 580 · settings-engine 491
                   stance 347 · utils 293 · query 282 · breedtimer 278 · upgrades 254
```

### Load-bearing facts already established — do NOT re-derive these

- The **phantom-setting / `false == 0` class is already closed** by `tests/nets/settings-reverse.test.ts`;
  the ≤4 survivors are all inert (two `== true`, two bare-truthy). A sentinel net would find nothing.
- **`eqeqeq` must stay off.** 513 loose comparisons involve `getPageSetting`, and `stance.ts:260`
  carries a *deliberate* loose `== 0` that catches a boolean-false setting. The rule would introduce
  bugs, not find them.
- **Game-API drift is zero** — all 152 symbols in `trimps.d.ts` exist in the pinned clone.
- `game.talents.nature2` **does exist** (`config.js:608`); it governs level and retain, not convert
  rate. #168's stated rationale was wrong; the defect is real.
- The `*farmlevel` settings default to `[0]` (safe with `!= 0`); the `*cell` settings default to
  `[-1]` (broken). #162 is **5 sites, not 11** — corrected on the issue.
- Four natives stay blind by corpus depth: **every fixture holds zero heirlooms**, none has
  AutoBattle unlocked, deepest is z62 while nature/generator unlock at z230+ (#196).
- **Commit before mutation-testing.** `git checkout -- <file>` reverts to HEAD and silently eats
  uncommitted edits in that file. This cost rework twice.

## Global Constraints

- **No test may ever be skipped in CI.** No `.skip` / `.todo` / `.only` / env-guard / conditional-skip mechanism may be introduced, whatever its justification. `scripts/ci/assert-no-skips.mjs` enforces this.
- **No test may read `dist/`.** It is gitignored — absent on CI, stale locally. Boot the freshly-built `TEST_BUNDLE` via `tests/sim/bundle.ts`.
- **Never re-record the oracle to make a red go away.** A red is the alarm, not the problem. An oracle re-record replays the frozen bundle and re-pins across every `src` commit since the tag.
- **Waivers do not work on the sensitivity fixtures**, by design: `09-housing-u2`, `10-hypo-u2`, `12-warp-u1`, `08-starved-u1` demand `diffTraces(oracle, clean) === []` outright.
- **`gameTimeout`, `autoSave`, `costUpdatesTimeout` stay blocklisted** in `scripts/sim/boot.mjs`. Re-enabling one double-drives every tick and makes every trace a lie.
- **Game balance numbers are sacrosanct.** Mechanism fixes ship freely; every numeric change is an explicit decision, never an inference.
- **Class A findings ship. Class B and C findings are FILED as GitHub issues with measurements attached** and are not merged in this campaign.
- **Landing model is hybrid:** instruments/nets/fixtures FF-merge continuously; product behavior changes batch into one reviewed set at the end.
- Every task ends green on `npm run lint && npm run typecheck && npm test`.

---

## File Structure

**Created:**
- `docs/audits/2026-07-28-instrument-audit.md` — Phase 0 result table: net → mutation → verdict.
- `tests/nets/game-api-drift.test.ts` — every game symbol AT calls exists in the pinned clone.
- `tests/nets/mirrored-constants.test.ts` — numeric literals AT mirrors from the game, diffed.
- `tests/nets/sentinel-semantics.test.ts` — `==` comparisons against unset sentinels, per setting type.
- `tests/nets/constant-branches.test.ts` — branches statically constant given a setting's declared domain.
- `tests/perks.optimizer.test.ts` — characterization of the AutoPerks allocation math.
- `docs/superpowers/specs/2026-07-28-exhaustive-logic-review-findings.md` — the ranked report.

**Modified:**
- `scripts/sim/recorder.mjs` — `MUTATORS` grows by the seven unwrapped natives.
- `scripts/sim/coverage.mjs` — mirrors `MUTATORS` (a test pins that the two cannot drift).
- `scripts/sim/corpus.mjs` — new fixtures that reach the new mutators.
- `scripts/sim/make-fixtures.mjs` — generation of those saves.
- `scripts/sim/blind-spot-census.mjs` — one injected-bug row per newly-visible region.
- `tests/sim/corpus-coverage.test.ts` — per-save reach pins updated (a coverage GAIN also fails here by design; the pin update is the celebration).
- `tests/sim/blind-spot-census.md` — regenerated census table.

---

## Phase 0 — Audit the instruments

**The trap this phase must not fall into:** a mutation that breaks compilation or typecheck turns
*every* suite red, which looks exactly like the net working. A recipe is only valid if the mutation
is syntactically valid and type-clean, the target net goes RED, **and** named sibling suites stay
GREEN. Red-everywhere is a failed probe, not a passed audit.

### Task 0.1: Apply and score the mutation recipes

**Files:**
- Create: `docs/audits/2026-07-28-instrument-audit.md`
- Temporarily modify (then revert): production files named by each recipe

**Interfaces:**
- Consumes: the recipe set from the `phase0-instrument-audit-recipes` workflow — each recipe is `{test, claim, file, oldString, newString, command, staysGreen, compiles, risk, notes}`.
- Produces: `docs/audits/2026-07-28-instrument-audit.md` with one row per net: `net · claim · verdict(RED|GREEN|BROKE-BUILD|SELF-REFERENTIAL) · notes`. Any GREEN row is finding #1 of the campaign.

- [ ] **Step 1: Confirm a clean tree before any mutation**

```bash
git status --porcelain   # must be empty
git branch --show-current  # must be feature/exhaustive-logic-review
```

- [ ] **Step 2: For each recipe, apply exactly one mutation**

Apply `oldString` → `newString` with Edit. One at a time. Never two concurrently — subagents and
concurrent sessions share one working tree.

- [ ] **Step 3: Prove the mutation is not a build break**

```bash
npm run typecheck
```
Expected: PASS. If this fails, the recipe is invalid — revert, mark the net `BROKE-BUILD`, and
design a type-clean mutation instead. Do not score the net from a build-break run.

- [ ] **Step 4: Run the target net alone and require RED**

Run the recipe's `command` (e.g. `npx vitest run tests/nets/dom-ids.test.ts`).
Expected: FAIL, with a message that names the invariant in `claim`.

- [ ] **Step 5: Run the `staysGreen` suites and require GREEN**

Expected: PASS. A net that only reddens alongside everything else has not been shown to be specific.

- [ ] **Step 6: Revert and verify the revert**

```bash
git checkout -- <file>
git status --porcelain   # must be empty again
```

- [ ] **Step 7: Record the row, then repeat from Step 2 for the next recipe**

- [ ] **Step 8: Commit the audit table**

```bash
git add docs/audits/2026-07-28-instrument-audit.md
git commit -m "docs: instrument audit — mutation verdict per net and gate"
```

### Task 0.2: Prove the three shell gates can fail

**Files:**
- Modify: `docs/audits/2026-07-28-instrument-audit.md`

- [ ] **Step 1: Plant a lint warning and check the EXIT CODE, not the output**

```bash
npm run lint; echo "EXIT=$?"
```
Expected with a planted violation: `EXIT=1`. This gate was broken before by a `grep -cE` that never
matched oxlint's output format, so it "passed" for a dozen runs while the deploy was red.

- [ ] **Step 2: Enumerate what `tsc` ACTUALLY typechecks**

```bash
npx tsc --noEmit --listFiles | grep -c '/src/'
ls src/**/*.ts | wc -l
```
Expected: every `src` file appears. `buildings.ts` was silently exempted for months by a **wrapped**
comment line beginning `// @ts-nocheck` — `tsc` exited 0 precisely *because* the file was skipped.
Grep for `@ts-nocheck` in any position, not only line-start.

- [ ] **Step 3: Plant each skip form and confirm `assert-no-skips` catches it**

Test `.skip`, `.todo`, `.skipIf`, `.runIf`, and **`it.only`** — `.only` silently drops every other
test in its file, which is worse than a skip and is the form most likely to be unhandled.

```bash
node scripts/ci/assert-no-skips.mjs; echo "EXIT=$?"
```
Expected: `EXIT=1` for every form.

- [ ] **Step 4: Delete a gate step from each workflow and confirm `ci-gates.test.ts` reddens**

```bash
npx vitest run tests/ci-gates.test.ts
```
Expected: FAIL naming the removed step. Revert both workflow files afterward.

- [ ] **Step 5: Revert everything, verify clean, commit the audit rows**

```bash
git status --porcelain   # must be empty
git add docs/audits/2026-07-28-instrument-audit.md
git commit -m "docs: shell-gate falsification results"
```

### Task 0.3: File every dead gate as a blocking issue

- [ ] **Step 1: For each GREEN row, open a GitHub issue**

Title: `🚦 <net> cannot fail — <region> is unreviewed`. Body states the claim, the mutation that
should have reddened it, and what code the dead net was believed to cover.

- [ ] **Step 2: Repair dead nets before Phase 1 begins**

A dead net's region is unreviewed, so Phase 1's class nets would be layered on a false baseline.
Each repair ends with the same mutation going RED.

- [ ] **Step 3: Commit repairs individually, then FF-merge Phase 0 to main**

Instruments land continuously under the hybrid landing model.

---

## Phase 1 — Class nets

Each task: write the net, run it, triage its hits, then **prove it can fail** by injecting the
defect it hunts. A net that has never been shown red does not count as coverage.

### Task 1.1: Game-API drift net

**Files:**
- Create: `tests/nets/game-api-drift.test.ts`

**Interfaces:**
- Consumes: `.trimps-game/` (the SHA-pinned clone `npm install` materializes) and `src/game/trimps.d.ts`.
- Produces: `collectGameSymbols(): Set<string>` and `collectATCalls(): {symbol, file, line}[]`, exported for reuse by Task 1.2.

- [ ] **Step 1: Write the failing test**

```ts
// Every game symbol AT calls as a free identifier must exist in the pinned clone.
// The fork dates to ~2022; the clone is v5.10.1. A renamed or removed native is a
// silent no-op at runtime, not a crash the sim would surface.
it('every game symbol AT calls exists in the pinned clone', () => {
  const declared = collectGameSymbols()   // parsed from .trimps-game/js/*.js
  const called = collectATCalls()         // TS-compiler-API scope walk over src/
  const missing = called.filter((c) => !declared.has(c.symbol))
  expect(missing).toEqual([])
})
```

- [ ] **Step 2: Run it and read the hits**

Run: `npx vitest run tests/nets/game-api-drift.test.ts`
Expected on first run: FAIL with a real list. Triage each hit — a genuine drift is a Class A or B
finding; a false positive means the scope walk or the clone parse needs narrowing. **Use a
TS-compiler-API scope walk, never a file-wide regex** — a `var perk` in a sibling function masks a
bare `perk` reference elsewhere in the same file, and this repo shipped a bug that exact way.

- [ ] **Step 3: Pin the survivors with an explicit allowlist**

Every allowlist entry carries a one-line reason. An unexplained entry is how a net dies.

- [ ] **Step 4: Prove the net can fail**

Rename one symbol in a temporary copy of the clone parse input, confirm RED, revert.

- [ ] **Step 5: Commit**

```bash
git add tests/nets/game-api-drift.test.ts
git commit -m "test(net): assert every game symbol AT calls exists in the pinned clone"
```

### Task 1.2: Mirrored-constant diff net

**Files:**
- Create: `tests/nets/mirrored-constants.test.ts`

**Interfaces:**
- Consumes: `collectGameSymbols` from Task 1.1.
- Produces: a report of `{constant, atValue, gameValue, file, line}` triples.

- [ ] **Step 1: Write the test that reports, not asserts-zero**

```ts
// AT re-derives game math from a ~2022 fork. Where it mirrors a game constant, the
// two must agree. This net REPORTS: numeric drift is tuning-gated (#84), so it
// pins a known set and fails only when the set CHANGES.
it('mirrored game constants match the clone (pinned; changes must be explained)', () => {
  expect(mirroredConstantDrift()).toMatchSnapshot()
})
```

- [ ] **Step 2: Run, snapshot, and triage every entry into #84 or a new issue**

Run: `npx vitest run tests/nets/mirrored-constants.test.ts`
**Do not change any number.** Numeric parity is user-gated.

- [ ] **Step 3: Prove the net can fail** — perturb one mirrored constant, confirm the snapshot diff, revert.

- [ ] **Step 4: Commit**

```bash
git add tests/nets/mirrored-constants.test.ts tests/nets/__snapshots__
git commit -m "test(net): pin mirrored game-constant drift"
```

### Task 1.3: Sentinel-semantics net

**Files:**
- Create: `tests/nets/sentinel-semantics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// getPageSetting returns `false` for a key a veteran user has never touched (#68).
// `false == 0` is TRUE, so `getPageSetting('X') == 0` fires for EVERY such user,
// while `== 1` / `== true` is inert by luck. A present multitoggle returns a real
// parseInt number, so `=== 0` is the correct form.
it('no setting is compared against zero with loose equality', () => {
  expect(looseZeroComparisons()).toEqual([])
})

// The -1 "unset" sentinel is TRUTHY; a bare truthiness test on it is always true.
it('no -1 sentinel setting is used in a bare truthiness test', () => {
  expect(bareTruthyOnSentinelSettings()).toEqual([])
})
```

- [ ] **Step 2: Run and triage**

Run: `npx vitest run tests/nets/sentinel-semantics.test.ts`
Cross-reference `src/modules/settings-defs.ts` for each setting's declared type and default.
**Read `src/modules/settings-visibility.ts` before judging any hit** — the runtime gate and the
render gate are frequently one invariant expressed twice, and reasoning from the consumer alone was
wrong twice in one session (#115, #117).

- [ ] **Step 3: Fix each confirmed hit (Class A — ships) with a regression test per fix**

- [ ] **Step 4: Prove the net can fail** — reintroduce one `== 0`, confirm RED, revert.

- [ ] **Step 5: Commit**

```bash
git add tests/nets/sentinel-semantics.test.ts src/modules
git commit -m "fix: correct unset-sentinel comparisons; net closes the class"
```

### Task 1.4: Statically-constant branch net

**Files:**
- Create: `tests/nets/constant-branches.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// A condition that cannot vary over its setting's declared domain is dead code or
// a frozen subsystem. waitTill60 froze ALL gear and prestige purchases for 40k
// ticks on a premise that had been false for seven years (#153), and no fixture
// sat in the affected window, so baseline-zero stayed green throughout.
it('no branch is constant over its settings declared domain', () => {
  expect(constantBranches()).toEqual([])
})
```

- [ ] **Step 2: Run and triage each hit against `settings-defs.ts` domains**

- [ ] **Step 3: Prove the net can fail** — plant `if (getPageSetting('X') === 'impossible')`, confirm RED, revert.

- [ ] **Step 4: Commit, then FF-merge Phase 1 nets to main**

---

## Phase 2 — Sim visibility expansion

Acceptance for every task in this phase is a **census row that reads SEEN**, produced by injecting a
real bug into that region. Execution is not evidence: a corpus that *reaches* code proves nothing if
the answer feeds an already-saturated threshold — a 1,000,000× damage multiplier once passed the
entire sim suite green (#90/#98).

### Task 2.1: Wrap the unwrapped natives

**Files:**
- Modify: `scripts/sim/recorder.mjs`, `scripts/sim/coverage.mjs`

**Interfaces:**
- Produces: `MUTATORS` extended with the five confirmed window-level natives below, and a new
  method-mutator path for the `autoBattle` object.

**Step 1 is already DONE — the candidate list was verified against the clone and three entries were
wrong.** Recorded here so no one re-derives it:

```text
TIER 1 — window-level game natives; recorder works as-is by adding the name
  native                 defined at                    unblinds            LOC
  setGather              .trimps-game/main.js          gather.ts           384
  selectHeirloom         .trimps-game/main.js          heirlooms.ts        452
  equipHeirloom          .trimps-game/main.js          (same module)         —
  changeGeneratorState   .trimps-game/main.js:9902     magmite.ts          238
  naturePurchase         .trimps-game/main.js:8535     nature.ts           199

TIER 2 — object METHODS on `var autoBattle = {` (.trimps-game/objects.js:628).
  installRecorder wraps window[fn] only, so these need a method-mutator path.
  autoBattle.upgrade · .equip · .buyBonus · .loadPreset · .resetCombat · .toggleAutoLevel
  unblinds ab.ts (543 LOC)

REJECTED — do NOT wrap these
  purchaseEnlight   AT's OWN export (src/modules/nature.ts:67), not a native. It calls
                    naturePurchase, which is the real actuator and is in Tier 1 instead.
  updateMapCost     a game COST CALCULATOR (getValue, forceBaseCost), not an actuator.
                    241 callsites of pure read would flood the trace with zero decision
                    signal. other-praiding.ts already reaches the wrapped map mutators at
                    55 callsites — it needs FIXTURES (spire/daily states), not a mutator.
  plusMapToRun1/5   AT's own functions, not game natives.
```

- [x] **Step 1: Re-confirm the five Tier-1 names resolve on `window` in the BOOTED clone — DONE**

Defined-in-source is necessary but not sufficient — the name must be on `window` at boot.
`installRecorder` **throws** rather than skipping when a name is not a function; that is correct and
must not be softened.

Verified against a real `bootGame()`, with the 10 already-wrapped mutators as a positive control
(all present, so the probe is valid):

```text
CONTROL   buyJob buyBuilding buyUpgrade buyEquipment buyMap
          selectMap runMap recycleMap recycleBelow setFormation    all function ✅

TIER 1    setGather · selectHeirloom · equipHeirloom
          changeGeneratorState · naturePurchase                    all function ✅

TIER 2    typeof window.autoBattle === 'object'
          .upgrade .equip .buyBonus .loadPreset
          .resetCombat .toggleAutoLevel                            all function ✅

COLLISION none of the Tier-2 names exists bare on window, so the object path
          is required and cannot be shortcut by adding names to MUTATORS.
```

- [ ] **Step 2: Add the five Tier-1 names to `MUTATORS`; add the Tier-2 method path separately**

Tier 2 changes `installRecorder`'s shape, so it is its own commit with its own mutation proof —
bundling it with Tier 1 makes a red ambiguous.

- [ ] **Step 3: Run corpus-coverage and expect RED**

Run: `npx vitest run tests/sim/corpus-coverage.test.ts`
Expected: FAIL — `uncovered` is non-empty, because no fixture reaches the new mutators yet. **This
red is the design working**: the tripwire forbids adding a mutator nothing reaches. Task 2.2 clears
it by adding saves, never by removing the mutator or relaxing the assertion.

- [ ] **Step 4: Commit the red-producing change together with Task 2.2's fixtures**

### Task 2.2: Add fixtures that reach each new mutator

**Files:**
- Modify: `scripts/sim/make-fixtures.mjs`, `scripts/sim/corpus.mjs`, `tests/sim/corpus-coverage.test.ts`

- [ ] **Step 1: For each new mutator, design the minimal state that reaches it**

Record the settings each fixture needs. Settings are **load-bearing, not configuration noise**: a
settings-gated feature is untestable by construction without `bootGame`'s `atSettings` hook, which
is why `10-hypo-u2` carries four explicit settings and goes quietly blind if any one is dropped.

- [ ] **Step 2: Generate the saves and record their oracles**

```bash
node scripts/sim/make-fixtures.mjs
node scripts/sim/record-oracle.mjs
```

- [ ] **Step 3: Update the per-save reach pins and re-run**

```bash
npx vitest run tests/sim/corpus-coverage.test.ts
```
Expected: PASS with `uncovered` empty and the new mutators in `union`.

- [ ] **Step 4: Commit**

```bash
git add scripts/sim tests/sim
git commit -m "test(sim): wrap seven unwrapped natives and add fixtures that reach them"
```

### Task 2.3: Census row per newly-visible region

**Files:**
- Modify: `scripts/sim/blind-spot-census.mjs`, `tests/sim/blind-spot-census.md`

- [ ] **Step 1: Add one injected-bug mutation per new region**

`gather-noop`, `heirloom-swap-noop`, `nature-noop`, `magmite-noop`, `ab-noop`, `scryer-formation-flip`.

- [ ] **Step 2: Run the census**

```bash
node scripts/sim/blind-spot-census.mjs
```
Expected: every new row reads SEEN with a non-zero divergence count.

- [ ] **Step 3: Check the cells that should be ZERO**

A census number means nothing unless `baseline-zero` is zero. Against a **stale oracle** the census
*inverts*: restoring a bug makes the mutant agree and report BLIND, while the clean build is the one
that diverges (#105). Whenever coverage is added for a region the corpus never reached, ask first
whether the oracle is stale there.

- [ ] **Step 4: Any row that reads BLIND is a fixture design failure — fix the fixture, not the row**

- [ ] **Step 5: Commit the regenerated census and FF-merge Phase 2 to main**

---

## Phase 3 — Targeted adversarial review

Only for what Phases 0–2 structurally cannot reach. **Every finding requires a reproduction** — a
failing test, a sim divergence, or a written derivation. No reproduction, no finding. Naysayer roles
are kept; adversarial voting is dropped (95% pass rate, 4 of 12 kills — it was decorative).

### Task 3.1: Verify whether AutoPerks has ever executed in a sim run

**Files:**
- Read: `src/modules/perks.ts`, `src/modules/portal.ts:271`, `scripts/sim/corpus.mjs`

- [ ] **Step 1: Check whether any fixture sets `AutoAllocatePerks`**

The hypothesis is that none does, making `perks.ts` the same shape as `doPortal()` in #127 — AT's
highest-consequence action, which the net had never once seen.

- [ ] **Step 2: Do not spy by reassigning the global**

Module-internal calls do not route through `window`, and a captured reference cannot be intercepted
after registration — both produce a confident **0 calls** while the code demonstrably runs (#127,
#129). Assert on resulting state, or intercept the primitive.

- [ ] **Step 3: Record the answer in the findings doc either way**

### Task 3.2: Characterize the AutoPerks optimizer as pure math

**Files:**
- Create: `tests/perks.optimizer.test.ts`

- [ ] **Step 1: Golden-master `calculatePrice` / `calculateIncrease` against the game's own perk functions**

Overlay data onto a fresh `newGame()` — **never inject raw `JSON.stringify(game)`**, which silently
drops the ~1,091 game methods and yields a green suite that tests nothing. Assert the tripwire
`typeof game.buildings.Shed.cost.wood === 'function'` before trusting any result.

- [ ] **Step 2: Assert the tripwire, then the goldens**

- [ ] **Step 3: Prove the test can fail** — perturb one price term, confirm RED, revert.

- [ ] **Step 4: Commit**

### Task 3.3: Adversarial pass over the remaining unreachable regions

Targets: the AutoBattle solver (`ab.ts`), spire/daily strategy (`other-praiding.ts`), and
`guiLoop`-driven code (`native-conflicts.ts`, `custom-ui/`, the storedMODULES persist).

- [ ] **Step 1: Never cite `baseline-zero` as evidence for guiLoop-driven code**

`scripts/sim/boot.mjs:31` stubs `setInterval` dead. A green net there is evidence the net cannot
see the code. Build that evidence by hand.

- [ ] **Step 2: For DOM-visibility questions, read `getComputedStyle`, not `el.style.display`**

The game hides the five native automation buttons with `.autoUpgradeBtn{display:none}` and reveals
them with an inline `display:block`, so an inline-style check reports a never-revealed element
**visible**. A jsdom fixture built without the class and rule encodes the same wrong model and
cannot catch it — put the real class and a `<style>` in the fixture (#150).

- [ ] **Step 3: File each reproduced finding; fix Class A only**

---

## Phase 4 — Strategy A/B (Class C)

### Task 4.1: Measure the noise floor before believing any effect

- [ ] **Step 1: Run the UNCHANGED build across N seeds and record the spread**

A "−5.4%" result once sat inside a ±3.5% noise floor. No A/B result is interpretable before this
number exists.

- [ ] **Step 2: Invert coarse metrics into durations**

An A/B whose metric is a small integer reports "no effect" when it means "no resolution". Hold the
outcome fixed and measure ticks-to-reach it.

- [ ] **Step 3: Run the upper-bound control first**

Give the subsystem infinite free resources. If that changes nothing, the optimization is dead before
it is written — this killed #57 and #106 in one run each.

### Task 4.2: File each Class C finding with its numbers

- [ ] **Step 1: One GitHub issue per finding, `tuning-gated` label**

Body carries the measurement, the seed count, the noise floor, and the upper-bound control result.

- [ ] **Step 2: Change nothing.** Class C is a decision, not an inference.

---

## Phase 5 — Review and merge

### Task 5.1: Fresh reviewer over the whole campaign diff

- [ ] **Step 1: Dispatch a reviewer agent with no implementation bias**

Standing-authorized; not offered as a choice, not skipped for "obviously safe" changes. On this repo
a green gate has three times been a gate that could not fail, so gates and reviewers are independent
evidence, not substitutes.

- [ ] **Step 2: Address findings, re-run all gates by EXIT CODE**

```bash
npm run lint; echo "EXIT=$?"
npm run typecheck; echo "EXIT=$?"
npm run test:ci; echo "EXIT=$?"
npm run build; echo "EXIT=$?"
```

### Task 5.2: Write the findings report and merge

- [ ] **Step 1: Write `docs/superpowers/specs/2026-07-28-exhaustive-logic-review-findings.md`**

State the defect count **honestly** — collapse one root cause reported at N call sites into one
finding, and separate defects in AutoTrimps from gaps in the review's own instrumentation. The
2026-07-12 report's 116 "confirmed" findings were 96 root causes and ~91 product defects, a 17%
inflation. An inflated count is the fastest way to get a real finding dismissed.

- [ ] **Step 2: Live-verify in Chrome before merging any product change**

```bash
npm run build && npm run serve
```
Open `http://localhost:8080/`, confirm "AutoTrimps - Zek Fork Loaded!" and a clean console. Chrome
only — never the built-in preview panel.

- [ ] **Step 3: Squash, FF-merge, delete both branch ends**

---

## Self-Review

**Spec coverage:** Class A → Phases 1, 3. Class B → Task 1.1, 1.2. Class C → Phase 4. Sim-blindness
correction → Phase 2. Instrument audit → Phase 0. Hybrid landing → FF-merge points at the end of
Phases 0, 1, 2; product changes batch into Phase 5. All five spec invariants appear in Global
Constraints. ✅

**Placeholder scan:** no TBD/TODO; every code step carries real code or a real command. Phases 3–4
specify protocol and acceptance rather than fabricated code, because their outputs are discovered,
not predetermined — the acceptance criteria are concrete in each case. ✅

**Type consistency:** `collectGameSymbols` / `collectATCalls` defined in Task 1.1 and consumed by
Task 1.2 under the same names. `MUTATORS` is the same array named in `recorder.mjs`, `coverage.mjs`,
and `corpus-coverage.test.ts`. ✅
