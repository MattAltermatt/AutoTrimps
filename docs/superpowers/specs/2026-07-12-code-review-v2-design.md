# Code Review v2 — Design

**Date:** 2026-07-12
**Status:** approved, executing
**Supersedes (as method):** [`2026-07-08-code-review-findings.md`](2026-07-08-code-review-findings.md) — v1's
per-module sweep. v1's *findings* stand; its *method* is demoted to a background layer here.

## Why v2 exists, and why it is not v1 again

v1 (2026-07-08) was a 67-agent adversarial per-module correctness sweep. It found 26 confirmed bugs and
resolved every finding — a genuinely good pass. 114 commits later, a bug hunt found four more (#63–#66),
and **not one of them was reachable by v1's method**:

| bug | what it was | why a per-module sweep could not see it |
|-----|-------------|-----------------------------------------|
| **#63** | `needGymystic` initialized `true` in 2016 and never reset → `setScienceNeeded()` added a phantom **5,000,000** science cost forever → AT researched endlessly and ignored the Turkimp | the state lives in `legacy/AutoTrimps2.js` (outside the sweep's scope) and is *read* in `query.ts`. The bug is the **absence of a reset**, which is not visible in any single file. |
| **#64** | `ManualGather2 == 3` and `RManualGather2 == 2` dispatched **nothing** — picking them silently froze all gathering | the setting *was* read and *was* rendered. The defect is an option index that falls through to no branch. A "is this function correct?" reader sees nothing wrong. |
| **#65** | `SpamNature` read by nobody; `Rmayhemmap == 1` a total no-op; `typetokeep != 'None'` always true (numeric index vs label string) → Auto-Heirlooms stripped every carried heirloom | found by a **net** (every `createSetting` id must be read), not by a reader. Whole-inventory invariants are not module-local. |
| **#66** | the sim ran AT with **gear-buying and science tracking disabled** for its entire existence (`usingRealTimeOffline` stuck true); the L0 proof net's traces therefore contained **zero** `buyEquipment` events, and `corpus-coverage.test.ts` had **enshrined the blindness as a "documented gap"** | the harness was not a review target. The review trusted the safety net. Every "unchanged" result it reported was measured through a crippled AT. |

The through-line drawn from this at design time was: *"v1 reviewed code; the bugs that escaped it live in
lifetime, wiring, and measurement — so v2 should be organized around failure classes, not files."*

**A pre-mortem naysayer destroyed that conclusion, and it was right to.** See §"Pre-mortem verdict" below.

The second through-line, from #66, survived and is the spec's spine: **argument was accepted in place of
evidence.** A plausible explanation ("that path just isn't covered by the corpus") was written down as a known
limitation and thereby made permanent. v2's confidence levels are therefore *earned by reproduction*, not by
consensus.

## Pre-mortem verdict — the plan was wrong, and the naysayer proved it by finding bugs

Before any finder ran, an adversarial agent was given the dimension list and this charter: *falsify the
framing; if the per-module sweep deserves to be the spine, say so.* It did, and it backed the claim by
spending one hour running the "low-yield" method on files the plan had deprioritized. Its findings were then
independently verified against the source before being accepted.

**Two of the four rows in the table above are false.** #64's dispatcher lives in `legacy/AutoTrimps2.js`,
which v1 never reviewed — that is a **scope** defect, fixed by one line of scope, not by a seven-dimension
replan. #65's `Rmayhemmap` lives in `mapfunctions.ts`, squarely inside v1's scope; v1 read that file and found
two other bugs in it. That is a **recall** failure, and the cure for low recall is *more readers on the same
files* — precisely what the plan was demoting. Only #63 (cross-file lifetime) and #66 (harness blindness)
genuinely required a new axis. **The plan built seven dimensions on two real data points.**

What the naysayer found while making the argument — all independently verified in the source:

| finding | severity |
|---------|----------|
| `AutoTrimps2.js:211-218` — brace-scope inversion: the `else if` binds to the **outer** `if (!usingRealTimeOffline)`, so `BuyBuildingsNew == 3` ("Buy Storage") runs **only during the offline replay, never in live play** | HIGH |
| `import-export.ts:915` — `setTimeout((function(){…})(a), 101)` invokes the IIFE **immediately**; the body then throws `ReferenceError` on `storedMODULES` (declared ambient at `at-legacy.d.ts:474`, **assigned nowhere**) *after* `ATrunning = false` and *before* `ATrunning = true`. **Clicking "Reset Module Vars" silently kills all automation until reload.** `tsc` is green because the `.d.ts` lies. | HIGH |
| **28 phantom settings** — `getPageSetting(id)` where `id` was never `createSetting`'d. `utils.ts` returns `false` for unknown keys, so each is a permanently-dead guard. Includes `'DailyBWraid'` (case typo, 4 lines from a correct `'Dailybwraid'`), `'RCapEquiparm'` (8 read sites — the U2 equipment cap never applies), the entire 9-id `nu-loom` subsystem, and `'game.global.universe == 1 && BWraid'` — a guard expression pasted **inside the id string**. | HIGH |
| **The proof net has never run in CI.** `tests/sim/guard.ts` skips 12 sim suites when `../trimps-game` is absent — and it *is* absent on CI runners. `baseline-zero.test.ts`, whose own header calls it "THE KEYSTONE", has never executed in the deploy gate. `npm run lint` is not in CI at all. | HIGH |
| `perks.ts:21` + `Graphs.js` — the shipped userscript remote-loads third-party JS from two origins, unpinned, no SRI. `build-userscript.test.ts` guards against the **wrong domain**. | HIGH |
| `heirlooms.ts:586/589` — `Rdshouldtributefarm` read, assigned nowhere → `undefined == true` → the daily tribute-staff swap is dead code | MEDIUM |

The lesson generalizes past this review: **a "failure class" taxonomy fitted to a handful of recent bugs is a
just-so story.** It optimizes for the last war. Reading the code is not a low-yield method; *reading only some
of the code* is.

## Scope

Everything that ships, **and everything that verifies what ships**:

```text
src/**                              36 TS modules, ~21.4k lines
legacy/AutoTrimps2.js, Graphs.js    the two remaining legacy files   ← #63 lived here
tests/**                            48 test files, harness/, fixtures/, sim/  ← #66 lived here
scripts/sim/**                      boot.mjs + the headless sim      ← #66 lived here
scripts/build-userscript.mjs        the bundle-order seam
.github/workflows/**                the deploy
```

The harness is reviewed **as a first-class target, not as trusted infrastructure.** A review that assumes
its own net is sound is the review that #66 already beat.

## Dimensions — AS RE-WEIGHTED AFTER THE PRE-MORTEM

The original D1–D7 are preserved below for the record, struck through where they changed. **What actually
runs** is this:

| dim | share | what it is | why |
|-----|-------|-----------|-----|
| **D6′ · per-module sweep — THE SPINE** | 35% | 38 targets: all 36 `src/modules`, **plus `legacy/AutoTrimps2.js`, `legacy/Graphs.js`**, plus the build script. Briefed for **dispatch holes, brace scoping, callback-vs-invocation, lifetime** — *not* typos. Each finder is handed v1's findings so it cannot re-report. | v1's method was fine; v1's **scope** was not. This is the method that found everything in the pre-mortem. |
| **D2′ · settings, BOTH directions** | 15% | (a) the **reverse net** — every `getPageSetting` id must be `createSetting`'d (28 phantoms already in hand; closes #58); (b) every multitoggle option index reaches a live branch, verified by **reading braces, not grepping** — a grep reports `BuyBuildingsNew == 3` as green; (c) U1/R-twin symmetry both ways. | every settings bug found this week points read→define. The existing net only points define→read. |
| **D1′ · cross-module state, from the READS** | 12% | every one of the 336 ambient `var` in `at-legacy.d.ts` must have ≥1 runtime writer **and** a reset owner. | the write-first enumeration the original plan specified is **structurally blind** to `Rdshouldtributefarm` and `storedMODULES` — state that is never written *at all* never enters a write-first enumeration. |
| **D3 · harness / oracle integrity** | 12% | earned by #66. Must **enumerate all `setTimeout`/`setInterval`/rAF callsites** with a per-site verdict — a stub is a hypothesis, the callsite list is the fact. | #66 was patched point-wise; the no-op stub that caused it is still there. |
| **D8 · the shipped artifact** ⭐NEW | 10% | review `dist/autotrimps.user.js` as a security reviewer would review a stranger's userscript. Remote script injection, `eval`, the config-destroying reset path, the `@match` header. | nothing in the project reviews the thing the user actually executes. Highest harm-per-agent on the list. |
| **D4 · conversion seam** | 8% | ambient-declaration **honesty** (not completeness), the 18 `@ts-expect-error`s, bridge emit order, a TS-compiler-API implicit-global scope-walk. | a wrong `.d.ts` line launders a runtime crash past `tsc` *and* past every test. |
| **D9 · the gate itself** ⭐NEW | 4% | prove `npm test` in CI runs what it claims. | every other dimension trusts a green CI. That trust is currently misplaced. |
| **D5 · parity drift** | 4% | **folded into D6′** as a per-module brief on the 5 prediction-math modules. | 5 files, numeric-only, and per this spec's own rule numeric findings are *filed, never fixed* — it cannot ship a merge wave, so it does not need its own fan-out. |
| ~~**D7 · dead & unreachable**~~ | **0%** | **DELETED.** | every dead-code finding falls out of D1′/D2′ *for free, with a user-facing symptom already attached*. A dimension that hunts deadness for its own sake produces a list of unreachable functions nobody cares about. |

**Track 2 (quality) is demoted to a single filed issue**, not a parallel track competing for merge-wave
attention. It ran once, adversarially cross-checked, and its output is a schedulable plan — nothing more.

### Original dimension list (superseded — kept for the record)

Track 1 is correctness (the spine). Track 2 is quality (advisory — it yields a plan, never in-session code).

#### ~~Track 1 · Correctness~~ (as originally drafted)

- **D1 · Cross-file lifetime state** *(#63's class)* — enumerate every `globalThis.X =` write and every
  module-level `let`/`var` in `src/` and `AutoTrimps2.js`. For each, answer: **who resets it?** Is it reset on
  portal, on universe switch, on challenge start/end, on map entry/exit? Who reads it, and does that reader
  assume freshness? A value that is only ever *set* is the signature.
- **D2 · Settings: define → render → read → dispatch** *(#64/#65's class)* — 572 `createSetting` definitions,
  1,475 `getPageSetting` reads. Existing nets (`tests/settings-wired.test.ts`) already assert *"every id is
  read"* and *"no `getPageSetting(<multitoggle>)` compared to a string literal"*. They do **not** catch:
  - every **option index** of a multitoggle dispatches something (#64 exactly — the setting was read; index 3
    fell through);
  - the tooltip's **promise** is actually implemented (`Rmayhemmap == 1` was implemented *to its own tooltip* —
    i.e. not at all);
  - U1 setting and its `R`-prefixed U2 twin are **both** wired;
  - defaults are sane and reachable.
- **D3 · Harness / oracle integrity** *(#66's class)* — does the sim exercise what it claims?
  - other `usingRealTimeOffline`-shaped stubs in `boot.mjs` silently darkening AT subsystems;
  - do the committed L0 traces actually contain the event classes they purport to guard?
  - tests that pass on `∅ == ∅`; tests green because the module under test was tree-shaken away;
  - **any other "documented gap" / "deliberately omitted" comment** — per the standing rule, these are
    load-bearing tech debt and primary hypotheses, not settled facts;
  - goldens whose values are native-`Math.pow` float tails (libm drift, cf. #62).
- **D4 · Conversion seam** — `legacy-bridge` emit order, `at-legacy.d.ts` drift vs real exports, implicit-global
  escapes (scope-aware, not regex), missed shared-var → `globalThis` promotions, and a **re-audit of all 18
  `@ts-expect-error` / `@ts-ignore`** — each is a *documented latent bug* preserved for byte-faithfulness.
- **D5 · Game-parity drift** — the fork's *own* from-scratch prediction math (`calc`, `query`, `breedtimer`,
  `nature`, `perks`) vs `../trimps-game` v5.10.1. The fork is structurally immune to anything it *delegates*;
  drift lives only where it predicts. **Numeric findings are filed, never fixed** (tuning is sacrosanct).
- **D6 · Per-module sweep** — v1's method, demoted to a background layer. Each finder is handed the v1 findings
  doc so it cannot re-report, and is briefed for control-flow / ordering / state defects rather than typos.
- **D7 · Dead & unreachable** — functions never called, branches never taken, U1/U2 twins where one side is
  dead. Note the known gotcha: esbuild tree-shakes module-private dead code, so *golden-unchanged* is itself a
  proof of deadness.

### Track 2 · Quality (advisory)

Produces issues + a refactor plan. **No in-session refactors** — every refactor here is proof-net-constrained
(it must survive the L0 trace diff), which makes it its own transaction.

- **Q1 · Type honesty** — 871 `: any`, 103 `as any`. The question is not "how many" but **"where does `any`
  hide a real bug?"** (#37's lesson: imprecise non-optional `: any` params read as arg-count mismatches.)
- **Q2 · Boundaries & duplication** — `mapfunctions.ts` (1,976), `calc.ts` (1,821), `other-praiding.ts` (1,686);
  U1/R twins. Note the standing precedent: `RcalcOurHealth` ↔ `calcOurHealth` are **distinct U1/U2 models** and
  a "dedupe" was already rejected as tuning.
- **Q3 · The `getPageSetting` seam** — 1,475 string-keyed uncached calls. Type-safety and per-tick cost.
- **Q4 · Test-suite shape** — what is characterization vs. real assertion; where the coverage holes are.

## Topology

```text
Phase 0  PRE-MORTEM NAYSAYER  (blocking, 1 agent)
         Input: D1–D7 + the #63–#66 postmortems.
         Charter: (a) what bug class survives ALL of these dimensions?
                  (b) FALSIFY the framing above — if the per-module sweep is
                      actually the highest-yield thing, say so and we re-weight.
         Output edits the dimension list before any finder runs.
              |
Phase 1  FINDERS   dimensional (D1–D5, D7) fanned by sub-target
                 + 36 per-module finders (D6, background layer)
         Every brief states a SYMPTOM. No agent is handed a root cause as a
         locked premise — that is how a blind spot propagates to a whole panel.
              |
Phase 2  SKEPTICS  3 per finding, DIVERSE lenses (redundancy catches less than diversity):
           - correctness: is the reasoning sound?
           - intent: is this faithful-to-legacy-intended rather than a defect?
           - reachability: does any caller actually reach this state?
         Majority-refute kills the finding.
              |
Phase 3  FALSIFIER  per survivor. Must produce EVIDENCE: a failing vitest, a sim run,
         a live-clone observation, a trace diff. Argument is not evidence.
              |
Phase 4  POST-MORTEM NAYSAYER (veto). Attacks the report. May force another finder
         round. Loop until 2 consecutive dry rounds.
              |
Phase 5  SYNTHESIS → findings doc + GitHub issues
```

## Confidence ladder — earned, not asserted

| level | means |
|-------|-------|
| **CONFIRMED** | survived 3 skeptics **and** the falsifier produced running evidence **and** passed the positive control below |
| **PLAUSIBLE** | survived the skeptics; could **not** be demonstrated — *or* was demonstrated on a harness that failed its positive control |
| **REFUTED** | killed by majority skeptic vote |

All three are reported. The refuted list is **kept**, not discarded — it is how a wrongly-refuted bug gets
caught later, and it is the honest record of what the review considered.

### The positive-control rule (the pre-mortem's most important contribution)

A falsifier reporting **"could not reproduce"** is worthless unless we know its harness could have seen the
bug at all. The proof net observes exactly four mutators (`buyBuilding` / `buyEquipment` / `buyJob` /
`buyUpgrade`); `runMap` / `selectMap` / `setFormation` / `recycleMap` are **pinned as uncovered**. So every
finding in `maps` / `mapfunctions` / `stance` / `scryer` — where v1 found the *most* bugs — would come back
"could not reproduce" and get quietly downgraded. That is exactly the reasoning error that produced #66.

Therefore: **a "could not reproduce" verdict is INADMISSIBLE unless the falsifier first demonstrates a
positive control** — it injects a deliberate mutation into the same function and shows its harness *does*
catch that. No positive control, no negative verdict. Absence of evidence from an instrument that cannot see
the region is not evidence of absence.

Every falsifier verdict must additionally state:
1. **which harness** it used and **which mutator/decision class** that harness observes;
2. that the observation is **mutator-level or state-level, not DOM-geometry-level** (jsdom has no layout
   engine — `offsetWidth` and `getBoundingClientRect` are 0, so any geometry-dependent repro is an artifact);
3. for a sim-based repro, that the code path is not behind the **`setTimeout` no-op stub** (`boot.mjs`
   replaces `setTimeout`/`setInterval`/`rAF` with no-ops — `portal.ts` alone has 8 deferred callsites, so the
   entire autoPortal confirmation flow may be unreachable in the sim and therefore *unfalsifiable there*).

### The oracle is self-referential — and that is a trap

The oracle was re-pinned to `oracle/v2-post-bugfix` (`514b790d`), a commit that already contains this month's
fixes. Any bug **still present** at that commit is baked into the recorded traces. So a *correct* fix for such
a bug will produce a non-empty L0 diff — it will look like a **regression**, and the `(save,index,fn)` waiver
mechanism is exactly where a correct fix goes to die.

**Rule:** a confirmed-bug fix that produces a non-empty L0 diff triggers the question *"is the oracle wrong
here?"* — it is neither auto-waived nor auto-rejected. If the oracle is wrong, the fix lands and the oracle is
re-pinned **behind a root-caused, reviewed, intentional decision**, per the standing rule that a naked oracle
change is precisely the accidental-drift alarm the net exists to raise.

## What ships

**⚠️ REVISED 2026-07-12 (user directive): NO FIX WAVES THIS SESSION.** This is a review, and it ends at a
verified report. Zero production code changes. Every fix — including the pure-mechanism ones — is scheduled as
its own transaction with its own branch, regression tests, and verify gate.

The reason to say this out loud rather than treat it as a scheduling detail: a review that starts fixing while
it is still finding will stop finding. The fix tail here is large (a 15-year-old port with, so far, an
architectural finding and a double-digit HIGH count), and interleaving would quietly convert a review session
into a patch session that never finishes either job.

- Deliverables: this spec, `2026-07-12-code-review-v2-findings.md`, the Track-2 quality plan, and **one GitHub
  issue per confirmed finding**, grouped under a new milestone.
- **Numeric / balance findings are filed, never applied.** Tuning is sacrosanct.
- Fix sequencing, recorded for whoever picks this up:
  1. **The gate first (H6).** Until the proof net actually executes in CI and `lint` is in the deploy gate,
     every subsequent fix ships behind a net that is not running. Nothing else should land before this.
  2. **The four permanent nets** (reverse-settings, bridge-collision, ambient-writer, CI honesty). Test-only,
     byte-identical, and they close whole *classes* rather than instances.
  3. **HIGH mechanism fixes**, each with a regression test inside the region it touches.
  4. **A0's error boundary** last and on its own — it changes emitted JS and moves the L0 traces, so it is a
     reviewed behavioral change, not a mechanism fix.

## Known risks, stated up front

1. **The fix tail is unknown until the finders return.** If v2 surfaces 30 mechanism bugs, that is several
   merge waves, not one branch. Waves are the plan, not a fallback.
2. **The falsifier depends on the sim** — the same sim that was blind until yesterday. D3 therefore runs
   *before* the falsifier is trusted, and any falsifier that reports "could not reproduce" is suspect until
   D3 clears the path it used. **Every falsification attempt states which harness it used and why that
   harness can see the effect.**
3. **Bubble / deep-U2 scenarios are not reproducible** in the v5.10.1 clone. Findings there cap at PLAUSIBLE
   by construction; the report says so rather than quietly confirming them.
