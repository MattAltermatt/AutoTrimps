# Exhaustive Logic Review — Design

**Date:** 2026-07-28 · **Branch:** `feature/exhaustive-logic-review` · **Baseline:** `8907cc2d`, 1287 tests green

## The ask

Vet every piece of automation logic in the fork and establish that it works as it should. The sim
rig is the named instrument; the campaign is scoped and sequenced around what that rig can and
cannot see.

## What "works as it should" means here

Three distinct questions, three instruments, three authority levels. **All three are in scope.**

| class | question | instrument | authority |
|---|---|---|---|
| **A** | Does it do what it says? | static class nets | fixes ship freely |
| **B** | Does it match the game? | diff vs the pinned `.trimps-game/` clone | mechanism ships, numbers are filed |
| **C** | Is the decision *good*? | sim A/B, measured | filed with numbers, never silently changed |

Class C is not hypothetical: `waitTill60` froze all gear purchases for 40k ticks on a premise that
had been false for seven years (#153), and `buyGemEfficientHousing` ranked Gateway first on
gems-per-population while Gateway is priced in *fragments*, so AT bought nothing while gems ran to
3.2e12 (#154, +42.7% population when fixed). Both were faithful, executing, green code. Only
measurement finds that class.

## The premise that had to be corrected first

The proof net is excellent and it is **not a general oracle.** `scripts/sim/recorder.mjs` wraps
exactly ten native mutators:

```
buyJob · buyBuilding · buyUpgrade · buyEquipment · buyMap
selectMap · runMap · recycleMap · recycleBelow · setFormation
```

A decision is visible to `baseline-zero` only if it terminates in one of those. Measured against
every module in `src/`:

```text
region                                       LOC     proof-net visibility
-------------------------------------------  ------  ----------------------------------
buildings · jobs · upgrades · equipment ·     ~9,000  SEEN — census-proven by injection
  maps · stance · calc · portal · mapfunctions
settings machinery (defs/engine/visibility)   ~4,000  covered by dedicated static nets
graphs/ + custom-ui/                          ~2,600  invisible — guiLoop never runs
automation logic with NO mutator terminus     ~6,500  STRUCTURALLY BLIND
  └ of which ALSO has zero unit tests         ~3,400  perks 1516 · main-loop 636 · ab 543 · …
```

Additionally, `scripts/sim/boot.mjs:31` stubs `setInterval` dead, so everything dispatched from
`guiLoop` — `updateCustomButtons`, the storedMODULES persist, the #150 conflict-badge sweep — is
structurally invisible to both `baseline-zero` and the blind-spot census. A green net there is not
evidence about the code; it is evidence the net cannot see it.

**Most of that blindness is fixable, not structural.** Every blind module already calls real native
game mutators; nothing is listening to them:

```text
module              blind LOC   unwrapped native actuator                  callsites
------------------  ---------  -----------------------------------------  ---------
gather.ts                 384   setGather                                        54
heirlooms.ts              452   selectHeirloom · equipHeirloom                   37
ab.ts                     543   upgrade · equip · buyBonus · loadPreset          19
magmite.ts                238   changeGeneratorState                              9
nature.ts                 199   purchaseEnlight                                   4
scryer.ts                 155   setFormation (already wrapped; no fixture)       11
other-praiding.ts       1,704   updateMapCost · plusMapToRun1/5                 279
```

`perks.ts` is the exception and needs a different instrument. It is 1,516 lines with **zero
exports**, actuated only by `AutoPerks.clickAllocate()` from `portal.ts:271` behind
`AutoAllocatePerks == 1`. Its core is a pure optimizer (`calculatePrice`, `calculateIncrease`,
`iterateQueue` over a priority queue) wrapped in a DOM layer — directly unit-testable against the
game's own perk-price functions, no sim required. Working hypothesis to verify in Phase 3:
`11-portal-u1` does not set that setting, so **AutoPerks has probably never executed in a sim run**
— the same shape as `doPortal()` in #127.

## Why this is not a third reading-fanout

Two exhaustive reviews already landed: 2026-07-08 (45 finder agents → 189 raw findings → 91
distinct defects) and 2026-07-12 (#67–#87). Their recorded lessons govern this design:

- **Nets beat readers.** 45 finder agents missed the bug a ten-minute mechanized net caught.
- **Adversarial execution beats adversarial argument.** The skeptic-voting layer passed 95% of
  findings and produced 4 of 12 kills. Budget belongs in reproduction and positive controls, not in
  more votes. Naysayer *roles* are kept; adversarial *voting* is dropped.
- **A disabled gate reports success.** Three times a gate here was silently incapable of failing —
  `tests/sim/guard.ts` skipping 11 suites (#67), a `grep -cE` that never matched oxlint's output
  format, and a wrapped `// @ts-nocheck` comment that exempted `buildings.ts` from `tsc` entirely
  for months. `tsc` exited 0 *because* the file was skipped.

169 commits have landed since the last review, so there is a real delta — it simply should not be
reviewed by re-reading everything.

## Phases

Phases 0 → 1 → 2 are strictly ordered; each makes the next trustworthy. Phases 3 and 4 may overlap.

### Phase 0 — Audit the instruments

Mutation-test every net and gate before trusting any green anywhere. Surface: 20 nets in
`tests/nets/`, 25 suites in `tests/sim/`, `scripts/ci/assert-no-skips.mjs`,
`tests/ci-gates.test.ts`, and the three shell gates (`lint`, `typecheck`, `test:ci`) checked by
**exit code**, not output.

Protocol per net: inject the specific defect the net claims to catch, run that suite alone, assert
RED, revert. Any net that stays green is finding #1 and its "covered" region is unreviewed.

Two extra probes with direct precedent here:
- Does `tsc --noEmit` actually typecheck every file in `src/`, or is some file exempted the way
  `buildings.ts` was? Enumerate what the compiler *actually* included.
- Does `oxlint --deny-warnings` fail on a planted warning?

**Execution shape:** parallel read-only agents each produce a precise mutation recipe (file, exact
old→new string, the single command that must go red); the lead applies and runs them **serially**
in the main tree. Subagents and concurrent sessions share one working tree, so parallel mutation
would corrupt the audit. Worktree isolation is rejected here because `.trimps-game/` is gitignored
and each worktree would need its own `npm install` plus game clone.

### Phase 1 — Class nets

One exhaustive scanner per decidable bug class, over all ~29k lines. Existing nets already cover
roughly ten classes. New classes with precedent in this repo's bug history but no net yet:

- **Game-API drift** — every game symbol AT calls, asserted present in the pinned clone. The fork
  dates to ~2022 and the clone is v5.10.1; this is the core drift risk and has never been
  mechanized.
- **Mirrored-constant diff** — numeric literals in AT that also exist as game constants. Feeds #84.
- **Sentinel semantics per declared setting type** — the `false == 0` class. `getPageSetting`
  returns `false` for a key a veteran user has never touched, so `== 0` fires for all of them while
  `== 1` / `== true` is inert by luck.
- **Statically-constant branches** given each setting's declared domain.

Every new net must be shown RED on an injected bug before it counts as coverage.

### Phase 2 — Sim visibility expansion

Wrap the seven natives listed above; add fixtures that reach each; add a blind-spot census row per
region with a real injected bug. A region counts as covered only when its census row reads SEEN.
The existing `corpus-coverage` tripwire already forbids adding a mutator that nothing reaches, so
the corpus must grow with the recorder.

Constraint: the three self-driving loops blocklisted by identity in `boot.mjs` (`gameTimeout`,
`autoSave`, `costUpdatesTimeout`) stay blocklisted — re-enabling one double-drives every tick and
makes every trace a lie. Any `guiLoop` work must clear that bar explicitly.

### Phase 3 — Targeted adversarial review

Only where Phases 0–2 structurally cannot reach: the `perks.ts` optimizer, the AutoBattle solver,
spire/daily strategy in `other-praiding.ts`, and `guiLoop`-driven code. Every finding requires a
reproduction — a failing test, a sim divergence, or a written derivation. No reproduction, no
finding.

### Phase 4 — Strategy A/B (class C)

Measure the **noise floor** across seeds on the unchanged build before believing any effect, and
invert coarse metrics into durations (hold the outcome fixed, measure ticks-to-reach) so a
small-integer metric cannot report "no effect" when it means "no resolution". Findings are filed
with numbers. Game balance numbers are sacrosanct; nothing here changes without an explicit
decision.

### Phase 5 — Review and merge

A fresh reviewer agent with no implementation bias over everything the campaign changed, then
FF-merge.

## Landing model

**Hybrid.** Instruments, nets, and fixtures are pure additions with no behavior risk and are
worthless sitting on a branch, so they land continuously — commit per unit, green gates, FF-merge
as they complete. **Product behavior changes batch into one reviewed set at the end**, so any
regression is attributable to a small reviewed diff rather than to twenty merges.

Class A fixes ship. Class B and C findings are filed as GitHub issues with their measurements
attached and are not merged as part of this campaign.

## Invariants this campaign must not break

1. **No test may ever be skipped in CI.** No conditional-skip mechanism may be reintroduced,
   whatever its justification. If a suite needs a dependency the runner lacks, fetch the dependency.
2. **No test may read `dist/`.** It is gitignored — absent on CI, stale locally.
3. **Never re-record the oracle to make a red go away.** A red is the alarm, not the problem. An
   oracle re-record is never local: it replays the frozen bundle, so moving one trace re-pins across
   every `src` commit since the tag.
4. **Waivers do not work on the sensitivity fixtures**, by design. `09-housing-u2`, `10-hypo-u2`,
   `12-warp-u1`, and `08-starved-u1` demand an empty diff outright; an exemption there disarms the
   only witness those census rows have.
5. **Game balance numbers are sacrosanct.** Mechanism fixes ship freely; numeric tuning is always a
   decision, never an inference.
