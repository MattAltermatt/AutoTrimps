# Instrument Audit — 2026-07-28

Phase 0 of the [exhaustive logic review](../superpowers/plans/2026-07-28-exhaustive-logic-review.md).

**Why this exists.** A disabled gate reports success. Three times in this repo a gate was
structurally incapable of failing while everything downstream looked green: `tests/sim/guard.ts`
skipped 11 suites whenever the clone was absent (#67); a `| grep -cE '(error|warning)'` never
matched oxlint's output format, so lint "passed" for a dozen runs while the deploy was RED; and a
**wrapped comment line** beginning `// @ts-nocheck` exempted `buildings.ts` from `tsc` entirely for
months — `tsc` exited 0 *precisely because* the file was skipped.

So no green anywhere in this campaign is believed until the instrument producing it has been shown
to go red on a defect it claims to catch.

**Method.** Check exit codes, never output. Every probe carries a positive control — a probe that
cannot fire proves nothing about what it fails to find. Mutations must be syntactically valid and
type-clean: a mutation that breaks the build turns *every* suite red, which looks exactly like the
net working.

---

## Shell gates

### `npm run lint` → `oxlint src tests scripts --deny-warnings` — ✅ SOUND

Probed with an out-of-tree file so the repo was never mutated.

```text
probe                                          result
---------------------------------------------  ---------------------------------------
positive control (no-eval, no-unused-vars)     FIRES — probe is valid
config auto-discovery WITHOUT -c               WORKS — matches the CI invocation, which
                                                passes no -c flag
--deny-warnings, warnings-only input           EXIT 0 without the flag, EXIT 1 with it
                                                — the flag is load-bearing, not decorative
unmutated repo                                 EXIT 0
```

The active rule set is **larger than the six rules in `.oxlintrc.json`** — oxlint's default
`correctness` category is also on, confirmed by `no-constant-condition` and `no-dupe-keys` firing
without being configured.

**Coverage gap (not a gate failure): `eqeqeq` is NOT active.** That is this repo's single most
expensive recurring bug class — `getPageSetting` returns `false` for a key a veteran user has never
touched, and `false == 0` is TRUE, so `== 0` fires for every such user while `== 1` is inert by
luck (#68–#74, #150). `no-self-compare` and `no-fallthrough` are likewise inactive. This is an
argument *for* the Phase 1 sentinel-semantics net, which is the instrument that will cover the class.

Not a finding: `no-cond-assign` did not fire on `if ((x = 5))`. Double parentheses are the standard
intentional-assignment escape hatch; that is correct behavior.

### `npm run typecheck` → `tsc --noEmit` — ✅ SOUND, with a scope caveat

```text
src/**/*.ts on disk                70
loaded by tsc --listFiles          70
exempted                            0
```

The `buildings.ts` hole is genuinely closed. `tests/nets/no-ts-nocheck.test.ts` models the directive
correctly — `/^\s*(\/\/|\/\*+|\*)\s*@ts-nocheck\b/` — and carries self-tests asserting that the
exact wrapped-comment trap string is caught while a mid-sentence mention stays legal. Five modules
still mention `@ts-nocheck` in prose; none of those mentions is in a directive position.

**Scope caveat, and it matters for Phase 2.** `tsconfig.json` sets `allowJs: true` with
`checkJs: false`, so every `.mjs` under `scripts/` is *loaded* but **not typechecked**, despite
`include: ["scripts"]`. That is the entire proof-net harness — `recorder.mjs`, `boot.mjs`,
`corpus.mjs`, `manifest.mjs`, `blind-spot-census.mjs`. A green typecheck is not evidence about any
of them, and Phase 2 modifies exactly those files.

### `scripts/ci/assert-no-skips.mjs` — ✅ SOUND, all five forms

Each form planted into a real suite, then the census run against vitest's JSON report:

```text
form               vitest   census   verdict
-----------------  -------  -------  --------
it.skip            exit 0   exit 1   CAUGHT
it.todo            exit 0   exit 1   CAUGHT
it.skipIf(true)    exit 0   exit 1   CAUGHT
it.runIf(false)    exit 0   exit 1   CAUGHT
it.only            exit 0   exit 1   CAUGHT
```

**`it.only` is caught**, which was the open question — it does not merely skip, it silently drops
every other test in its file. Note that **vitest itself exits 0 in all five cases**. That is the
whole reason this census exists as a separate process consuming the report post-hoc.

Known limit, stated rather than discovered later: a bare `return` at the top of a test body reports
as *passed*, not skipped, so no report-consuming census can see it. That form needs a static scan,
not this net.

### `tests/ci-gates.test.ts` — ✅ SOUND, 8 of 8

Every gate removed from every workflow, one at a time:

```text
                lint  typecheck  test:ci  build
ci.yml          RED      RED       RED     RED
deploy.yml      RED      RED       RED     RED
```

---

## Phase 1 rescoping — two planned nets killed, one real class found

Measured before building, per the campaign's own rule that a net must close a class that is
actually open.

**`eqeqeq` stays OFF — decided, not deferred.** 513 loose comparisons involve `getPageSetting`
alone, so the blunt rule means mass edits to faithful legacy ports, and retyping ported code is this
repo's dominant transcription risk. Worse, it would introduce bugs: `stance.ts:260` carries a
*deliberate* loose `== 0` with the comment "catches a boolean-false setting, not just numeric 0".
`eqeqeq` would force `=== 0` there and silently change behavior. The precise instrument wins.

**The phantom/sentinel class is ALREADY CLOSED.** `getPageSetting` returns `false` only when
`autoTrimpSettings.hasOwnProperty(setting) == false` (`utils.ts:58`) — i.e. for a phantom id.
`tests/nets/settings-reverse.test.ts` already asserts *no setting id is read but never defined*,
with anti-false-green guards and a shrink-only fix queue capped at 4. All four survivors are inert:
`Ronlystackedvoids` and `Rnovmsc2` are read via `== true` (`false == true` is false), and
`FoodEfficiencyIgnoresMax` / `GemEfficiencyIgnoresMax` are read bare-truthy (falsy → clause dead,
which is also the safe direction per #140). **The planned sentinel-semantics net would have found
nothing.** Deleted from the plan.

**Dead strict comparisons: also zero.** Of 15 statically resolvable `getPageSetting(...) === lit`
sites, every literal's type matches the setting's declared return type. (The probe's first run
reported 0 sites — a false clean caused by `re.exec()` advancing `lastIndex` before `matchAll`,
eating every single-match line. The anti-false-green counter caught it. Fixed, then 15.)

### 🔴 The class that IS open: array-vs-scalar comparison

`multiValue` settings return `number[]` (`utils.ts:64`). Comparing an array to a scalar coerces via
ToPrimitive, so **`[-1] != 0` is TRUE** — an "is it set?" guard passes at the unset default and its
fallback arm becomes unreachable. Indexing past the array's length then yields `undefined`, which
fails *both* arms of a subsequent `<= n` / `> n` test.

63 `multiValue` settings are declared; 16 comparison sites exist, and they split three ways:

```text
form        sites  verdict
----------  -----  ----------------------------------------------------------------
!= -1           3  CORRECT — [-1] != -1 is FALSE, so the unset default IS detected.
                   Praidingzone, dPraidingzone, Rfrozencastle. The right idiom, in
                   this same codebase — the author knew.
!= 0           11  WRONG for any [-1]-defaulted setting: the guard passes when unset
                   and the fallback never runs. Rtimefarmlevel, Rdtimefarmlevel,
                   Rtributefarmlevel, RAMPraidcell, RdAMPraidcell, Rinsanityfarmlevel,
                   Rshipfarmlevel, Ralchfarmlevel, Rhypofarmlevel, Rinsanityfarmcell,
                   Ralchfarmcell, Rhypofarmcell
== 50           1  FRAGILE — [50] == 50 is TRUE only because it is single-element;
                   [50,50] coerces to '50,50' -> NaN -> FALSE. Rshipfarmamount
```

Worked example, `mapfunctions.ts:655` (`RPraid`). `RAMPraidcell` is `'multiValue'` defaulting to
`[-1]`, and its tooltip states *"Paired position-by-position with PR: Zone. Leaving an entry at -1
starts at cell 1."* The `cell <= 1` test does honor a literal `-1`, so the documented semantics
work. But `(getPageSetting('RAMPraidcell') != 0) ? ...[praidindex] : 1` can never take its `: 1`
arm, and when the user configures several PR zones while leaving the cell list at `[-1]`,
`praidindex > 0` yields `cell === undefined` — which satisfies neither `cell <= 1` nor `cell > 1`,
so **prestige raiding is silently skipped for every configured zone except the first**.

This replaces the deleted sentinel net as Phase 1 Task 1.3. Per-site confirmation still needs each
setting's declared default checked (a `[0]`-defaulted setting is correctly guarded by `!= 0`), which
is the net's job.

---

## Nets — `tests/nets/` (20) and `tests/sim/` (25)

**46 recipes over 45 suites — every suite covered. 46/46 produced the predicted RED.** No
`BROKE-BUILD`, no anchor failures, no failed reverts; the tree was verified clean after every cycle
and again at the end.

**That headline does NOT mean "46 nets work."** A red is only evidence if the mutation violated the
invariant the net claims to guard. Applying the critic's review, the honest tally is:

```text
scoring                 count  meaning
----------------------  -----  --------------------------------------------------------
PROVEN                     37  mutation violated the claimed invariant; net went red;
                                named siblings stayed green
NOT-PROVEN                  5  net went red, but the mutation DISARMED THE INSTRUMENT
                                rather than violating the invariant — see below
PARTIALLY-PROVEN            3  reddened one assertion of a multi-part claim
SELF-REFERENTIAL (ok)       1  oracle.test.ts is an identity pin on a frozen fixture;
                                editing the fixture is the only falsification path, which
                                is inherent to the shape, not a defect
```

### The NOT-PROVEN five — one pattern, repeated

`damage-sensitivity`, `blind-spot-sensitivity` (#93 housing), `blind-spot-sensitivity` (#160
waiver), `custom-ui-completeness`, `boot.test.ts`.

The first two are the instructive ones. Both mutations are **bit-identical in production** and
redden their nets purely by neutering the tests' own string-splice injections — `damage-sensitivity`
captures `preMapNumber` before the splice point and overwrites `number` after it, so the injected
`number *= 1000000` is discarded. Both nets then emit *"the proof net is BLIND to combat math
again"* / *"the net is blind to housing SELECTION again"* — a diagnosis that is **false** for that
mutation — while their anti-false-green splice guards still pass. Scoring them green would prove the
splice-and-diff plumbing is wired, not that `08-starved-u1` still has an unsaturated damage
threshold or that `09-housing-u2` still has housing tiers whose `increase.by` differ.

That is precisely the shape this repo has three times mistaken for "the gate works."

### 🔧 Repairs shipped — each mutation-proven

| # | defect | repair | proof |
|---|--------|--------|-------|
| 1 | `custom-ui-completeness` restated its own input | derive from `sampler.ts` `RESOURCES` | old net **5/5 green** on the same production change; repaired net **2 of 6 red** |
| 2 | the frozen-clock time-origin pin was unguarded | assert against an explicit `fixedStart` | pin deleted → new test red, **other two still pass** |
| 3 | boot hydration tripwire never shown to fire | **extract** it as the exported `assertGameHydrated`, called by `bootGame` | predicate weakened → **2 of 5 red**; restored → 5/5 |
| 4 | `driver.mjs` `checkTriggers()` "invisible" | **REFUTED — no repair needed** | `economy-alive.test.ts:56` already pins the cadence at 50 calls / 50 ticks, plus 3 behavioral tests |

Finding 4 came from the critic and did not survive checking. The observation was literally true —
`driver.test.ts` does not guard `checkTriggers()` — but the implied conclusion was wrong: the
coverage exists, in a different file, and it is stronger than a cadence pin alone.

**Row 3 was wrong on its first attempt, and a code review caught it.** The original "repair" added a
test that re-derived the field-path expression against a JSON clone of the already-returned game —
it never called into `boot.mjs` at all, so deleting the check outright would have left all three
boot tests green. It was listed in this table as "mutation-proven" on the strength of *"passes on
hydrated, fails on method-less"*, which is not a mutation of anything. That is the same overclaim
this audit was written to catch, committed by the audit. The real repair extracts the check as an
exported predicate, matching `tests/harness/gameFixture.ts:44`, whose throw is exercised directly at
`tests/calc.getTrimpAttack.test.ts:56`.

**Residual, stated rather than discovered later:** the extraction makes the *predicate*
mutation-provable. It does not guard the *call site* — deleting `assertGameHydrated(window.game)`
from `bootGame` would still leave the boot tests green. That is the same limitation `gameFixture.ts`
has carried since it was written, and closing it needs a static call-site scan, not another unit
test.

### The PARTIALLY-PROVEN three, named

Left unnamed in the first draft of this table, which the code review correctly flagged as a
transparency gap — a reader could not check which claims were only half-covered.

- **`tests/sim/clock.test.ts`** — the recipe reddened the offset formula only; the time-origin pin
  was unguarded. **Now repaired** (row 2 above), so this one is no longer partial.
- **`tests/sim/driver.test.ts`** — the tick-advance mutation reddens test 2 only. Tests 1
  (resources accumulate) and 3 (`runUntil` halts on its predicate) are unfalsified by any recipe in
  the set.
- **`tests/sim/economy-alive.test.ts`** — its recipe deletes a harness primitive, which moves
  `baseline-zero`, `oracle*`, `saves`, `gem-housing`, `upgrade-reserve` and both trace gates with
  it. A red that broad carries almost no specificity evidence, even though the suite's own
  assertions are strong.

### 🔴 Four net-level defects to repair

1. **`tests/nets/custom-ui-completeness.test.ts` polices a manifest that does not exist at runtime.**
   `grep -c 'at-native' tests/fixtures/src-bundle.golden.js` = 0 — esbuild tree-shakes the whole
   `REGIONS` array out of the shipped userscript, and `grep -rn REGIONS src/` finds only its own
   declaration. The assertion also re-types the source array inside the test, so it can only detect
   that someone edited `regions.ts`. No edit to `sampler.ts`, `shell.ts`, `adopt.ts`, or `tiles/*`
   can redden it. **Repair:** derive the expectation from `sampler.ts`'s `RESOURCES`, which is the
   list production actually iterates.
2. **`clock.mjs:13`'s `g.global.start = fixedStart` is guarded by neither clock test.** Delete it and
   both still pass — yet reproducibility-across-boots is the half of the clock claim the oracle
   depends on.
3. **`boot.mjs:171`'s "game not hydrated" throw is an unproven tripwire.** Nothing asserts it can
   fire.
4. **`driver.mjs`'s `window.checkTriggers()` is invisible to `driver.test.ts`.** `economy-alive` is
   its only net, and that suite's mutation is a harness primitive with near-zero specificity.

### Method note against this audit's own reliability

The critic reported `tests/sim/` coverage as 11 of 25 and listed 14 suites as unrecipe'd. That was
**wrong, and the fault was in this audit's harness, not the recipes**: the critic's prompt truncated
the recipe set at 90,000 characters, so it reasoned from a partial list. Actual coverage is 45 of 45.
Recorded here because an audit that mis-measures its own coverage is the same class of defect it
exists to find.

---

## Session 1 of the remediation campaign — closures against this audit's own findings

Recorded 2026-07-28, on `feature/session-1-triage`. Every row below was mutation-proven in both
directions: the named mutation reddens the named assertion, and named siblings stay green.

```text
finding  what it said                                verdict now
-------  ------------------------------------------  ------------------------------------------
#197     census could not run 5 of 12 probes         ✅ CLOSED — already fixed in 4be220bd +
                                                        b9e00385; 12/12 anchors inject today
#257     the harness is loaded but not typechecked   ✅ CLOSED — tsconfig.scripts.json, wired
                                                        into `npm run typecheck`, pinned by
                                                        ci-gates
#258     census is blind to a bare `return`          ✅ CLOSED — static AST net; found a live
                                                        instance on its first run
#259     two of driver.test.ts's three claims are    ✅ CLOSED — both strengthened, both now
         unfalsified                                    have a specific mutation
#260     economy-alive's probe has near-zero         ✅ CLOSED — narrower one-shot probe:
         specificity                                    1 assertion red, siblings green
#261     the tripwire's CALL SITE is unguarded       ✅ CLOSED — AST call-site net
#262     `mapLevelInput` is a dead ambient           ❌ REFUTED — mapfunctions.ts:2021 uses the
                                                        bare identifier; deleting it fails tsc
```

### #257 — what the old gate could not see

```text
mutation                                        old gate (`tsc --noEmit`)   new gate
----------------------------------------------  --------------------------  ---------
a type error planted in scripts/sim/recorder.mjs   EXIT 0  (blind)           EXIT 2
dropping tsconfig.scripts.json from the script     n/a                       ci-gates RED
```

### #258 — the boundary, measured from both sides

A bare `return` planted at the top of a `ci-gates.test.ts` body:

```text
scripts/ci/assert-no-skips.mjs      "OK — 19 tests ran, 0 skipped."   EXIT 0   ← structurally blind
tests/nets/no-skipped-test-bodies   RED, naming ci-gates.test.ts:58            ← closed
```

The net's first run found a live instance: `tests/buildings.u2Stacking.test.ts` guarded on
`if (game.buildings.Tribute.locked) return`, and `04-u2-radon` is a z4 save where Tribute **is**
locked — so that test had never executed an assertion since it was written. With the fixture
unlocked it passes, and routing Tribute through the 10/2/1 ladder now reddens it, which is the
regression its own comment claims to guard.

### #259 — the two claims, and the mutations that now falsify them

```text
claim                              old form passed under              new assertion
---------------------------------  ---------------------------------  --------------------------
runTicks honours `count`           a loop capped at 50 ticks           300 ticks must out-gather 100
runUntil stops MINIMALLY           a runUntil overshooting by 10       predicate FALSE at ticks-1
```

### #260 — specificity, old probe vs new

```text
probe                                       reddens
------------------------------------------  --------------------------------------------------
delete window.checkTriggers() (old)         economy-alive + baseline-zero, oracle, oracle.jobs,
                                            saves, gem-housing, upgrade-reserve, both trace gates
one-shot flag on the call (new)             economy-alive's cadence assertion ONLY — driver,
                                            timers and census-anchors all stay green (21/21)
```

The three behavioural assertions in `economy-alive` stay green under the narrow probe, exactly as
that suite's own comment predicts: the game calls `checkTriggers` internally from its buy paths, so
Forge still unlocks inside a 1500-tick budget. That is the difference between "triggers fire at
least once" and "triggers fire every tick", and it is why the cadence needed its own pin.
