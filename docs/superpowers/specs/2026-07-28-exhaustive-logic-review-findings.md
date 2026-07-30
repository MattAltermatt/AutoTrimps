# 🔬 Exhaustive logic review — findings report

**Discovery:** [`2026-07-28-exhaustive-logic-review.md`](../plans/2026-07-28-exhaustive-logic-review.md)
(Phases 0–3b, 2026-07-28) · **Remediation:** [`2026-07-28-review-fix-campaign.md`](../plans/2026-07-28-review-fix-campaign.md)
(Sessions 1–10, 2026-07-28 → 2026-07-29) · **Raw finding text:**
[`2026-07-28-phase3-findings.md`](2026-07-28-phase3-findings.md) ·
[`2026-07-28-phase3b-findings.md`](2026-07-28-phase3b-findings.md)

This is the report Task 5.2 of the discovery plan asks for, written after the remediation rather than
before it — which turns out to matter, because **remediation refuted five of the findings and found
twenty-four more.** A report written at discovery time would have been wrong in both directions.

---

## 🧮 The honest count

The 2026-07-12 review inflated its count by 17% by reporting one root cause at N call sites as N
findings. This one collapses them, and separates AutoTrimps defects from gaps in the review's own
instrumentation.

```text
                                                  filed  closed  open   note
------------------------------------------------  -----  ------  -----  ------------------------------
findings from the discovery campaign (#162-#263)    102     100      2
  ├─ product defects in AutoTrimps                  93      92      1   #214 (needs a migration)
  └─ defects in the review's own instruments          9       8      1   #196 (needs deeper fixtures)
found BY the remediation (#286-#311)                 26      15     11   all triaged, labelled, milestoned
------------------------------------------------  -----  ------  -----  ------------------------------
total                                               128     115     13
```

The remediation found **one new issue for every four it fixed.** That ratio is the report's most useful
number: a fix campaign over a review is not a drain-down, and a plan that budgets only for the queue it
starts with will run out of sessions. The last one (#311) was found by the re-pin itself, in the final
session, and it is a *cost* of a correct fix rather than a defect — see the sensitivity section below.

**93 product findings are ~87 root causes.** Four documented collapses: #175+#228+#247
(`advPerfectCheckbox` — one dead DOM write, three symptoms), #177+#205 (`buyMap`'s return value
discarded), #162+#178+#263 (multiValue compared as a scalar), #210+#235 (unvalidated import reaching
an unescaped `innerHTML`).

**Five findings were REFUTED during remediation, and each refutation is now a net** — a finding
refuted by reading is a finding that comes back:

| # | The claim | Why it is false |
|---|---|---|
| #262 | `mapLevelInput`'s ambient declaration is dead — every use goes through `byId()` | The scan missed a fourth site: `mapfunctions.ts:2021` uses the bare global. Verified by deletion — `tsc` exits 2 with `TS2304: Cannot find name 'mapLevelInput'` |
| #304 | `c2runner` can portal into a U2 challenge without `allowU2` | No live caller can have `portalUniverse == 2`; every `doPortal` caller is dispatched inside mainLoop's `universe == 1` block. The suggested guard would have been dead code. `u1-portal-dispatch.test.ts` pins it |
| #286 | The Nom gate is blind because Nom's healing is unmodelled | `Math.pow(1.25, nomStacks)` is an *attack* multiplier and is already modelled at `calc.ts:627/696`. The real obstacle is that `calcHDratio()` moves with neither term — so widening `== 30` → `>= 30` is a design question, not an operator swap. **Left open on those honest terms** |
| #299 (part) | Mayhem's `bossMult` is applied on non-boss cells | Not a defect: that producer's contract *is* the world-boss cell, which is what makes the `/ boss` idiom exact. 22 divisors left byte-identical |
| #290 (its own patch) | The suggested one-line formation fix | Is a regression on its own — see #294, which found three more sites the finding's scan missed |

---

## 🎯 The four defects that changed what the bot actually does

Everything else in the campaign is invisible to the L0 proof net: it fixes a decision AT was making
wrongly in a region the corpus does not reach, or it repairs a diagnostic, a tooltip, a sentinel, or a
dead write. **Exactly four root causes moved an oracle trace**, and between them they explain all 14
moved fixtures (the per-fixture attribution ledger lives in `tests/fixtures/traces/manifest.json`):

1. **#203/#220 — AutoEquip bought equipment the game refuses to sell.** `mostEfficientEquipment`
   ranked LOCKED slots, and the always-level-2 block bought them unguarded. The v4 oracle records
   `buyEquipment("Arbalest")` and `buyEquipment("Gambeson")` on a U2 save that has neither unlocked,
   then stalls at tick 2 and buys nothing more for the rest of the run. The fixed build buys 162 events
   where the oracle bought 15. **That oracle trace was always wrong; re-pinning it is the correction.**
2. **#199/#212 — a non-crit was priced at `1/critD`.** `getMegaCritDamageMult(0)` is not 1. On a
   zero-crit save — which is the entire shallow corpus — AT understated its own damage by **2.5×**, and
   every gear, stance and farm decision downstream of `calcHDratio()` inherited it. The clearest single
   reading: on `08-starved-u1` AT stops cowering in X/Barrier and takes Dominance from tick 71, because
   it has stopped believing it is 2.5× weaker than it is.
3. **#169/#170 — `gammaBurstPct`'s "off" sentinel was 1, not 0**, and it survived a heirloom swap down.
   Labelled `sim-blind` and it moves three fixtures (see the instrumentation section below).
4. **#290/#294 — formation 5 (uber-Wind) treated as a halving formation** at four sites in `calc.ts`.

The remaining ~83 product fixes are real defects with real user-visible consequences — a U2 gear
deadlock, a C2 Runner that never set the game's own Challenge² flag, a Ship-Farming loop that re-bought
a map every tick forever, twenty DOM writes that had done nothing for eight years — but none of them
is observable to the L0 differential, which is why **every fix in this campaign shipped its own
regression test.** The net could not certify any of them.

---

## 🧪 What the review's own instrumentation got wrong

The nine instrument findings (#197, #256–#262) were fixed in Session 1, before 93 regression tests were
written against them. That was the right order and it is not the interesting part. These are the
instrument failures the *remediation* discovered, each of which had been silently degrading evidence:

- **The `sim-blind` / `sim-visible` partition asked the wrong question.** It was derived from "does this
  module terminate in a wrapped native mutator", which is the wrong question for a module that only
  computes an *estimate*. `heirlooms.ts` terminates in nothing — but `calc.ts` reads it, `stance.ts`
  reads `calc.ts`, and `stance.ts` calls `setFormation`. #169/#170 were labelled sim-blind and moved
  three fixtures. **Any finding whose output reaches `calc.ts` needs the re-check.**
- **A batch label outvoted correct per-issue analysis, twice.** The plan labelled Session 7 "⚠️ first
  trace-moving session" and told it to expect red; all five jobs issues had independently and correctly
  said the corpus could not reach their region. `baseline-zero` was 21/21 before and after. Separately,
  a panel overturned "#140 proved uncapping housing is 4× worse" as an argument about #214 — #140 never
  measured that question.
- **A funnelled output cannot test the branch that feeds it.** `autoGiga`'s
  `+(Math.round(delta + "e+2") + "e-2")` round-trip converts every non-finite intermediate to NaN, so
  five arithmetically distinct faults arrive as one indistinguishable value and all five refusal guards
  survived a delete-mutant. `toBeNaN()` was never a test of the guards; the diagnostic log line is.
- **An argument-blind stub cannot see which argument production passed.** `calcSpire`'s test stubbed
  `getEnemyAttack: () => 100`, so a double-applied imp multiplier sat under a green test from **2022**.
- **A fix can orphan the code that compensated for it, inside the same campaign.** #198 correctly
  removed `calcEnemyBaseHealth`'s skip of `badGuys` above z60; that skip was the only reason
  `calcSpire`'s compensating multiply was correct. From that commit until #298 every U1 spire health
  estimate applied the imp stat twice — invisible to every gate, because the premise lived in a comment.
- **A finding's own scoping claim is a claim.** "A mechanical scan returns exactly these two lines" is a
  one-pass reading nobody re-derives, and a fix scoped to it inherits its blind spot silently. Checked
  three times, wrong three times (#208's dispatch net filtered out multitoggles; #238's census found 15
  more conditional hides; #299's census was 10 sites and 22 divisors, not 5 and 12).
- **A net's health can depend on the defect persisting.** `settings-unset-encodings`' #100
  anti-false-green measured a 2.5× ratio change to prove a branch was live — and that 2.5× *was* #199.
  With the pricing corrected the assertion could no longer see anything. Same shape as #178, where a
  scanner proving its own capability against live source went red the moment the class was clean.
- **Mutation-test the near-miss fix, not the revert.** Ten instances across the campaign. Reverting your
  own change is the weakest possible mutant: it proves the net sees the bug you already knew about, and
  says nothing about the repair a reasonable person would have written instead — which is the one that
  ships, because it looks right at the call site.

---

## 🚦 The accepted deploy gap

`deploy.yml` runs `npm run test:ci` and the deploy job is `needs: build`, so the collected red stopped
the GitHub Pages publish from Session 8 until this session's re-pin. Anyone installing from Pages in
that window kept the pre-S8 build, **including #203's U2 AutoEquip deadlock.** A waiver was not
available and that is by design: `blind-spot-sensitivity` asserts `diffTraces(oracle, clean) === []`
with no manifest consulted, and `10-hypo-u2` is one of its three sensitivity fixtures — so it was
re-pin or stay red, and clearing it any other way is the "never re-record to make a red go away" rule.

Chosen: stay red, recorded on `main` in `13274fe3`. **Flag this before the first trace-moving merge of
any future campaign** — it should be a stated up-front trade, not something discovered when the hosted
script looks stale.

---

## 🔒 The single oracle re-pin

One re-pin for the whole campaign: `oracle/v4-post-fix-sweep` → `oracle/v5-post-review-campaign`
(f7b9ac86). Three controls, all numbers rather than arguments:

1. **The frozen oracle bundle is byte-identical to the working build** (`cmp` exits 0), so every move
   is oracle-vs-oracle behaviour with zero harness or runtime drift mixed in.
2. **Seven fixtures reproduce byte-for-byte** — exactly the seven `baseline-zero` was green on against
   v4. Where the campaign should be inert, it is inert.
3. **Every moved fixture is attributed to a named commit**, measured per boundary commit at event
   granularity (`scripts/sim/event-diff.mjs`, committed so the ledger is re-derivable). A move nobody
   can name is a regression, not a fix.

Full ledger: `tests/fixtures/traces/manifest.json` → `oracle.repinRationale`.

**Three gates moved with the re-pin, and each was a finding rather than a bump:**

1. **`oracle.test.ts` had been pinning a deleted file for fourteen days, green.** Its #64 anchors were
   single-quoted verbatim strings that matched because the v4 oracle bundle still *concatenated*
   `legacy/AutoTrimps2.js`; #133 ported that file into `src/` on 2026-07-15, after which the line is
   esbuild output and esbuild normalises the quotes. The assertion could no longer say anything about the
   shipping code, and nothing noticed, **because the artifact it reads is frozen by design.** Every anchor
   now asserts against a freshly built working bundle *as well as* the oracle, so an anchor that stops
   describing `src/` fails loudly instead of ageing into a claim about history. Mutation-proven both ways
   against the v4 bundle.
2. **`corpus-coverage` gained exactly one reach cell** — `03-challenge-watch` now buys Efficiency, because
   the crit correction shifts its trajectory. One cell, out of twelve saves, for the whole campaign.
3. **The `08-starved-u1` saturation tripwire went red, and it was right to** — see below.

### 🎯 The campaign cost the net some of its combat sensitivity, and that is the honest headline

`enoughDamage` is a *threshold* predicate, and a saturated threshold absorbs any buff you throw at it
(#90/#98). By making AT's damage estimate 2.5× more honest, #199 pushed three fixtures over their own
thresholds:

```text
                        old (v4 oracle)          new (v5 oracle)
damage-1e6   total      6297 on 5/21 runs        3563 on 2/21 runs
  06-deep-u1.2           719                        0
  06-deep-u1.3             8                        0
  12-warp-u1            1991                        0
  08-starved-u1.1       1851                     1822
  08-starved-u1.2       1728                     1741
```

**`08-starved-u1` is now the only fixture where `calcOurDmg`'s answer can change a decision**, and on
that save `enoughDamage` — which had never been true — is true on 124 of 500 ticks. Filed as **#311**
with three fix options; the recommended one makes the probe threshold-relative rather than 1e6×, which
fixes the measurement for the whole class of "the bot's self-estimate got more honest". The rest of the
census is unchanged and **zero rows are blind** — and `baseline-zero` reads 21/21, without which a
census number means nothing at all.

### 🔍 The final reviewer pass found no new cross-session defect

A fresh reviewer with no implementation bias was pointed at the one thing per-session reviews
structurally could not do: defects arising from *interactions between* sessions — the class #298
exemplified, where #198's correct removal of a special case orphaned the code compensating for it. It
re-audited every compensating-multiplier and sibling-twin chain the campaign touched (`calcSpire` /
`calcEnemyBaseHealth`, the formation-5 chain, the gamma-burst sentinel, the crit formula, Pandemonium's
`getEnemyMult`, the jobs scientist double-subtract, `pairedCellGateOpen`, the equipment cap/lock set) and
returned **clean negatives on all of them**, plus independent confirmation that #307, #308 and #309 —
all three already filed from inside S9 — are still live and are exactly this shape: a fix landed on one
member of a twin set and not the other.

---

## 📋 What remains open, and why

**Discovery findings still open (2):**

- **#196** — four native mutators are invisible to the proof net **by corpus depth, not by harness bug**:
  `selectHeirloom`/`equipHeirloom` (every fixture holds zero heirlooms), `changeGeneratorState` and
  `naturePurchase` (z230+; the deepest fixture is z62), and the `autoBattle.*` methods (unlocked on no
  fixture). All resolve as functions on `window` after `bootGame`, so the recorder can wrap them the
  moment a deep enough save exists. Open because the fix is a *save*, not a code change.
- **#214** — `Max{Mansion,Hotel,Resort}` mean opposite things to AT's two U1 housing buyers. Needs a
  value migration riding an id move, and both consumers resolve their id by *string concatenation*
  (`'Max' + name`), so the rename silently breaks the lookup — and a missed lookup returns `false`,
  which the gem buyer's rescue converts to **uncapped**: the exact failure being fixed, reintroduced by
  its own fix. Gets its own reviewed branch.
**Found by the remediation, triaged, not yet fixed (10):** **#286** (the Nom gate — its blocking premise
is false, per the refutation table above, and widening the range is a gameplay decision the user owns),
#288 (duplicate `updatePerkRatios`), #289
(`PraidHarder` leaves AutoMaps off), #292 (Watch arm has no F/L/M trickle), #293 (`Requipfarmzone`'s
`-1` flows into arithmetic), #301 (any `finishExpOnBw` below 605 is unacceptable to the game), #307
(U2 MaZ `done` is per-cell), #308 (`RequipExtra` has no boss→map normalizer), #309 (U2 enemy-stat twins
read `mapsActive`), **#310** (🔴 a negative `DeltaGigastation` silently stalls the Warpstation economy —
`max(65, HZE)` can point *behind* the current world, inverting an exponent), #311 (the combat sensitivity
regression above).

#310 is the one to take next: it is high severity, it was found by the live Chrome verify rather than by
any gate, and it was *created* by #297's failsafe — the campaign's own last-session change.
