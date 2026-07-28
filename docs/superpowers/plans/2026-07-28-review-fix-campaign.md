# Review Fix Campaign — landing the 102 open issues

> Companion to [`2026-07-28-exhaustive-logic-review.md`](2026-07-28-exhaustive-logic-review.md).
> That plan was the **discovery** campaign (Phases 0–3b). This is the **remediation** campaign:
> how the findings it produced actually get fixed, verified, and merged.
>
> **Status: Session 1 SHIPPED 2026-07-28.** Sessions 2–10 pending.
>
> ```text
> session  state        record
> -------  -----------  --------------------------------------------------------------
> 1        ✅ SHIPPED   9 instrument issues closed/refuted · queue labelled + milestoned
> 2–6      ⬜ Track A   54 issues, oracle-free, independent of every open decision
> 7–9      ⬜ Track B   39 issues, trace-moving, collect the red
> 10       ⬜ re-pin     one oracle re-pin, ledgered
> ```
>
> **Decision 1 is ANSWERED (2026-07-28): option A — a standing policy that AT's mirrors must match
> the pinned clone exactly.** All eleven prediction-math findings are approved to fix, each with a
> golden-master test against the clone's own function; mirror drift becomes a permanent net. This
> unblocks Fix S9. Decision 2 (sentinel semantics) is still open and is now asked per session, as its
> issues come up, rather than as one round of eight.

---

## 📊 What is actually on the queue

```text
open issues                                                          114
  ├── pre-existing (not from this campaign)                           12   #41 #84 #132 #137 #139 #143
  │                                                                        #145 #147 #148 #151 #158 #161
  └── 2026-07-28 exhaustive logic review (#162–#263)                 102
        ├── product defects                                           93   22 🔴 · 50 🟠 · 20 🟡  (+#162)
        └── instrument / harness findings                              9   #196 #197 #256–#262
```

**Every one of the 93 product findings answers "Would `baseline-zero` catch this today?" with NO.**
That is the whole reason they exist as a list: the proof net pins *what AT did*, never *whether it
was right*. It follows that the net cannot certify any of these fixes either — **each fix carries
its own new regression test, or it is not done.**

### The one number that reorders everything

The blind-spot census (`tests/sim/blind-spot-census.md`) says the L0 differential CAN see
**buildings · calc(damage/health) · equipment · jobs · gather · portal · gem-housing · warpstation**.
So the 93 findings split into two populations with completely different landing costs:

```text
track  population                                    issues  oracle impact
-----  --------------------------------------------  ------  ----------------------------------
A      modules with no wrapped-mutator terminus          54  none — traces cannot move
B      modules the L0 differential DOES watch            39  baseline-zero WILL go RED
```

A Track-B red **is the fix working.** But absorbing it is not a local operation: `record-oracle.mjs`
replays the *frozen* bundle at tag `oracle/v4-post-fix-sweep`, so moving one trace re-pins the oracle
across every `src` commit since that tag (37 as of #158, more now). And the three sensitivity
fixtures (`09-housing-u2`, `10-hypo-u2`, `12-warp-u1`) assert `diffTraces(oracle, clean) === []`
with **no manifest consulted**, so a waiver is structurally unavailable there — it is re-pin or
nothing (#159/#160).

**Therefore: exactly ONE oracle re-pin for this entire campaign, at the end of Track B**, with the
`proofItLaundersNothing` ledger the manifest already demands. Track A is sequenced first precisely
because none of it touches that decision.

---

## 🚧 Two blockers to clear before any fix lands

### 1. The `#162` fix queue is keyed by LINE NUMBER

`tests/nets/setting-array-compare.test.ts:127` keys `KNOWN_BROKEN` as `id@file:line` —
`mapfunctions.ts:655` ×2 and `maps.ts:1226/1263/1279`. Those are the *exact two files* Track B5
edits (#204, #221–#226). **Any fix landing above those lines shifts them and reddens a net that has
found nothing.** This repo has already eaten two false reds from line-keyed baselines.

→ Re-key to a content anchor (setting id + enclosing function name) **before** B5. XS, mechanical.

### 2. The instrument findings gate the evidence, not the code

`#257` (the whole sim harness is loaded by `tsc` but never typechecked — `checkJs: false`) and
`#258` (the zero-skip census cannot see a bare `return` at the top of a test body) both mean a
regression test written during this campaign could be inert and report green. Close them before
writing 93 regression tests against them, not after.

---

## 🎛️ Two decisions that belong to the user, batched

Neither blocks Track A. Both should be answered before Track B starts.

### Decision 1 🪨 — Policy on prediction-math parity (unlocks ~11 issues)

AT re-derives the game's damage/health/cost math from a ~2022 fork. Eleven findings are cases where
AT's mirror **disagrees with the pinned clone**:

```text
#198  imp health multiplier dropped at z>=60      #229  Barrier pierce modelled unhalved (2x)
#199  non-crit priced at 1/base, not 1 (up to 5x) #230  missingHealth substituted, not passed
#200  Hub bonus mirrored as +500, game gives 25000 #231  overkiller count drifts both directions
#213  Pandemonium enemy mult double-counted       #244  map x1.1 at zone>5, game uses world>6
#218  equip cost total uses level-0 base price    #250  breed mults Archaeology/Quagmire missing
#168  nature convert rate 6, game has no such rate
```

These are **not balance tuning** — nothing in the game changes; AT's *estimate of the game* is
wrong, and the estimates feed real buy/stance/farm decisions. But they are large: #199 understates
damage up to 5×, #200 is a 50× error.

- **A. (recommended) Standing policy — "a mirror must match the pinned clone exactly."** One
  approval covers all eleven; each fix ships with a golden-master test against the clone's own
  function. Divergence from the clone becomes a permanent net (`mirrored-constants.test.ts`, the
  unbuilt Phase-1 Task 1.2).
- **B. Per-issue approval.** Eleven separate asks; slows Track B by roughly a session.
- **C. File-only under `#84`** (the existing `tuning-gated` bucket) and fix nothing.

### Decision 2 🎚️ — "Disable" sentinel semantics (unlocks 8 issues)

Eight findings are the same shape: a setting whose documented "off" value does the opposite, or a
UI control that silently destroys a user's mode. Each needs one line of intent, not analysis:

```text
#207  gear caps: documented "disable" makes buyWeps/buyArms total no-ops
#219  Requipzone default -1 makes zoneGo unconditionally true
#184  'Start Fuel Z' tooltip says 230 disables; 230 fuels immediately
#223  finishExpOnBw = -1 cannot disable — the 125 clamp runs first
#176  BWraidingmax [-1] makes the raid succeed without raiding
#172  dump perk persisted as a positional index into a growing list
#194  raretokeep labels drift from game.heirlooms.rarityNames
#253  AutoMaps 3-state toggle downgraded to boolean by the battle-screen button
```

Recommendation: one round, eight y/n-shaped questions, all at once — not one per session.

---

## 🗺️ The sessions

Sizing is complexity (XS/S/M/L/XL), not wall-clock. Every session ends the same way:
**green by exit code** (`lint`, `typecheck`, `test:ci`, `build`) → **fresh reviewer agent** →
**Chrome live-verify** → squash → FF-merge → delete both branch ends.

### Session 1 — Triage, instruments, blockers · **M** · ✅ SHIPPED 2026-07-28

What actually landed, against what was planned:

```text
#197  census could not run 5 of 12 probes     ✅ CLOSED  already fixed; verified 12/12 anchors inject
#257  harness loaded but not typechecked      ✅ CLOSED  tsconfig.scripts.json, wired + pinned
#258  census blind to a bare `return`         ✅ CLOSED  static AST net — found a live dead test
#259  two driver.test.ts claims unfalsified   ✅ CLOSED  both strengthened, both now have a mutation
#260  economy-alive probe unspecific          ✅ CLOSED  one-shot probe: 1 red, siblings green
#261  tripwire CALL SITE unguarded            ✅ CLOSED  AST call-site net
#262  `mapLevelInput` is a dead ambient       ❌ REFUTED mapfunctions.ts:2021 uses the bare name
#256  lint gate thin                          ✅ CLOSED  no-self-compare + no-fallthrough on
blocker 1  line-keyed fix queue               ✅ re-keyed to `id@file#function`
```

Two things the plan did not anticipate:

- **The #258 net found a live instance on its first run.** `tests/buildings.u2Stacking.test.ts`
  guarded on `if (game.buildings.Tribute.locked) return`, and `04-u2-radon` is a z4 save where
  Tribute **is** locked — so that test had never once executed an assertion. It now runs, passes, and
  reddens when Tribute is routed through the 10/2/1 ladder, which is the regression its own comment
  claims to guard.
- **The `#162` net was rewritten, not just re-keyed.** Its line regex required `getPageSetting` on
  the LEFT followed by a numeric literal, so it was structurally blind to #178 and #263 — half its
  own class. It is a TS-compiler-API walk now, and all eight sites are in the queue.

The reviewer found two real holes, both in this session's own nets, neither visible to any gate:
a waiver that matched on key alone (the #159 shape, one level down) and a false positive on the
`return expect(p).rejects…` idiom. Both closed and verified in both directions.

Original plan for this session:

- Verify and close **#197** (the census fix landed in `4be220bd` + `b9e00385`; the issue is stale).
- Label and milestone all 102: severity · module · track · `security` / `tuning-gated` / `needs-net`.
  Right now they carry **no labels and no milestone** — 102 unsorted issues is not a work queue.
- **Collapse the duplicates** so the fix count is honest before anyone starts:
  ```text
  #175 + #228 + #247   one root cause: advPerfectCheckbox writes .checked, game reads data-checked
  #177 + #205          one root cause: buyMap()'s return value discarded
  #162 + #178 + #263   one class:      multiValue setting compared to a scalar
  #210 + #235          one chain:      unvalidated import -> unescaped innerHTML
  ```
  93 findings are ~87 root causes. The 2026-07-12 report inflated 96 causes into 116 "findings" and
  it is the fastest way to get a real finding dismissed.
- Clear blocker 1 (re-key `KNOWN_BROKEN`) and blocker 2 (**#257**, **#258**).
- Land the cheap instrument findings: **#259 #260 #261 #262**, and **#256** (turn on
  `no-self-compare` + `no-fallthrough`; **`eqeqeq` stays off** — 513 loose comparisons involve
  `getPageSetting` and `stance.ts:260`'s loose `== 0` is deliberate).
- Put Decisions 1 and 2 in front of the user.

### Session 2 — Track A1: import/export, profiles, security · **L** · 🔒 highest consequence

`#210` `#211` `#241` `#242` `#243` `#255` — plus `#235` pulled forward from A2 because it is the
second half of #210's chain.

Why first: #210 is arbitrary script execution in page context from a pasted "settings string" —
the one finding in the set that can hurt a user who did nothing wrong. #211 destroys an unrelated
saved profile. Neither is sim-visible, so this whole session is oracle-free.

Fix shape: a validating parser at the `loadAutoTrimps` seam + escape at the `tipAttr()` seam
(never in place — a multitoggle's `name` is an *array*, #110), with a net over all 302 value /
multiValue / textValue controls proving no persisted value reaches `innerHTML` raw.

### Session 3 — Track A2+A3: settings engine, controls, visibility · **L**

`#208` `#236` `#237` `#252` `#253` `#186` `#251` · `#209` `#238` `#239` `#240` `#254`

Read `settings-visibility.ts` **before** judging any of these — the runtime gate and the render gate
are frequently one invariant expressed twice, and reasoning from the consumer alone was wrong twice
in one session (#115/#117). `#209` (`updateCustomButtons()` zeroes `shouldFarm` from the GUI loop)
is guiLoop-driven: `setInterval` is stubbed dead in `boot.mjs`, so **`baseline-zero` is not evidence
here** — build it by hand.

NaN handling (`#236` `#237`) is one mechanism: `parseNum` floors e-notation and an unparseable box
stores NaN that persists as JSON `null` and can never fall back to the default. Fix once at the
seam; `#180` (Session 6) and `#201`/`#202` (Session 7) are downstream victims of the same hole.

Carries the **prose-only** sub-batch (`#186` `#251` `#254`) — but as its **own commit**. Tooltips
are evidence about the code; fixing the bugs in the same commit as the prose is how the #111–#119
sweep nearly lost its audit trail.

### Session 4 — Track A4+A5: AutoBattle and perks · **M**

`#164` `#165` `#173` `#174` `#190` · `#163` `#171` `#172` `#189`

Both subsystems are blind by corpus depth, not by harness bug: no fixture has AutoBattle unlocked,
and `perks.ts` has never been confirmed to execute in a sim run (Task 3.1 of the discovery plan is
still unanswered). **Do not try to spy by reassigning the global** — module-internal calls do not
route through `window`, and that produces a confident *0 calls* while the code demonstrably runs
(#127/#129). Assert on state.

`#163` (U2 AutoPerks respec permanently zeroes Masterfulness / Smithology / Expansion) is the
highest-consequence finding in the whole set that is not a security issue — a user loses perk
levels irreversibly. `#171` hangs the browser forever.

### Session 5 — Track A6: praiding and prestige raids · **M**

`#166` `#175`+`#228`+`#247` `#176` `#177`+`#205` `#191` `#227`

Nine issues, seven root causes — one session because four of them collapse into two. `#166` means PraidHarder buys **nothing**
at every praid zone in the shipped default configuration and logs "can't afford to" — a whole
advertised feature that has never worked at defaults.

### Session 6 — Track A7+A8: sentinels, heirlooms, MAZ, conflicts · **M**

`#167` `#168` `#169` `#170` `#178` `#183` `#184` `#194` · `#179` `#180` `#181` `#182` `#187` `#188`
`#192` `#193` `#195`

`#170` is the sentinel inversion worth reading first: `gammaBurstPct`'s "no Gamma Burst" sentinel is
**1**, `calc.ts` guards on `> 0`, so every player without a gamma shield gets a 0.4× damage
estimate — the majority case. `#169` latches it stale after any swap down. Fix them together.

`#187`/`#188`/`#195` are the #150 conflict-badge rows inventing conflicts. For any DOM-visibility
question here read `getComputedStyle`, not `el.style.display`, and put the real class + a `<style>`
in the jsdom fixture — a fixture without them encodes the same wrong model and cannot catch it.

**Track A ends here. 54 issues, zero oracle churn, five reviewed merges.**

---

### Session 7 — Track B prep + jobs · **L** · ⚠️ first trace-moving session

- **Record the pre-fix baseline first.** Run the full corpus and archive the traces before touching
  `src/`. Every later "did this fix move the trace, and how?" question is answered by LCS-diffing
  against that archive, not by re-deriving it.
- `#201` `#202` `#215` `#217` `#216`

`#201` hands NaN straight to native `buyJob()` and **permanently corrupts** `game.resources.food.owned`
and `game.jobs.*.owned`. `#215` hires locked jobs (Miners at world 1, before the upgrade is
researched) — expect a large, correct trace move on the early fixtures. The `jobs-ratio-flip` census
row shows 14,616 divergences on 18/21 runs, so this region is the most-watched in the corpus.

Do **not** re-record at the end of this session. Collect the red.

### Session 8 — Track B: buildings, equipment, smithy · **L**

`#200` `#214` `#245` · `#203` `#218` `#219` `#220` `#246` `#232` `#207`

`#203` (U2 AutoEquip never filters `locked`, commits to Arbalest/Gambeson, buys **zero** gear
levels) and `#232` (`smithylogic` falls off the end returning `undefined`, blocking every U2 gear
purchase) are the same user-visible symptom from two directions.

Note `#245` overshoots caps by up to 9 — and remember **the housing `Max*` caps are load-bearing**
(#140 WONTFIX): uncapping the "inert" ones steers AT into Collectors and is ~4× worse population by
z62. Fix the overshoot; do not touch the cap semantics.

### Session 9 — Track B: combat math, maps, portal, gather · **XL**

`#198` `#199` `#212` `#213` `#244` `#229` `#230` `#231` `#248` `#233` `#249` `#250` ·
`#204` `#221`–`#226` `#234` · `#206` · `#185` · `#162`+`#263`

The largest session and the one most dependent on Decision 1. Split it if the decision lands as B.
`#206` is small but severe: C2 Runner's Challenge² flag is module-scoped so the game never sees it —
**every C2 Runner portal starts a plain challenge.** `#204` makes Ship Farming re-buy a map every
tick forever.

### Session 10 — Oracle re-pin, campaign review, merge · **XL** · 🪨 the load-bearing session

1. **Re-pin the oracle once**, to a new tag cut at the post-fix commit. Write the manifest entry the
   existing `repinRationale` / `proofItLaundersNothing` precedent demands:
   - LCS event-diff per fixture against the Session-7 archive, **with the honest count** — inserted /
     deleted per save, and which saves reproduce byte-identically (those are the controls proving
     the change is inert where it should be).
   - A per-fixture attribution: which issue number explains which trace move. **A move nobody can
     name is a regression, not a fix.**
   - Never re-record to make a red go away. Every red must be explained before it is absorbed.
2. Re-run `blind-spot-census.mjs` and check the cells that should be **ZERO**. Against a stale
   oracle the census *inverts* (#105) — `baseline-zero` must read zero or the number means nothing.
3. Fresh reviewer over the whole campaign diff — standing-authorized, not offered as a choice.
4. Chrome live-verify on a **fresh save** (zone 1, cleared localStorage) *and* a deep save. A deep
   everything-unlocked save is structurally blind to unlock and reveal bugs, and two have shipped
   that way.
5. Write the honest findings report: root causes, not call sites; AutoTrimps defects separated from
   gaps in the review's own instrumentation.
6. Update `docs/decisions-log.md`, close every issue with its fixing commit.

---

## 🧭 Rules that hold for every session

- **One branch per session**, `feature/<track><n>-<slug>`. The discovery plan's "batch all product
  changes into one reviewed set" does **not** scale to 93 fixes — an unreviewable batch is worse
  than seven reviewable ones. This is a deliberate deviation from that plan's landing model.
- **Every fix ships a test that fails without it.** No exceptions: nothing here is visible to
  `baseline-zero`, so the regression test *is* the coverage.
- **Commit before mutation-testing.** `git checkout -- <file>` reverts to HEAD and has twice
  silently eaten uncommitted edits in the file being tested.
- **Prove each new net can fail** — break it on purpose, watch it go red, revert. A disabled gate
  reports success; that has happened three times on this repo.
- **Check exit codes, not output.** `npm run lint; echo "EXIT=$?"`.
- **Never re-mint a deleted setting id** — `createSetting` resurrects a veteran user's years-old
  localStorage value. `git log --all -S"createSetting.*<id>"` before minting anything.
- **`getPageSetting` returns `false`, and `false == 0` is TRUE.** Use `=== 0`.
- **Game balance numbers stay sacrosanct.** Decision 1 covers mirror corrections and nothing else.

## 📈 What "done" looks like

```text
session  track        issues  cumulative  merges  oracle
-------  -----------  ------  ----------  ------  ---------------------------
1        triage + D        9           9       1  untouched
2        A1                7          16       2  untouched
3        A2 + A3          12          28       3  untouched
4        A4 + A5           9          37       4  untouched
5        A6                9          46       5  untouched
6        A7 + A8          17          63       6  untouched
7        B1                5          68       7  RED, collected
8        B2 + B3          10          78       8  RED, collected
9        B4-B7            24         102       9  RED, collected
10       re-pin + report   —         102      10  RE-PINNED ONCE, ledgered
```

Ten sessions, ten reviewed merges, one oracle re-pin, 102 issues closed. Sessions 2–6 are
independent of each other and of every decision above — if the user wants motion before answering
Decisions 1 and 2, that is where it starts.
