# Review Fix Campaign — landing the 102 open issues

> Companion to [`2026-07-28-exhaustive-logic-review.md`](2026-07-28-exhaustive-logic-review.md).
> That plan was the **discovery** campaign (Phases 0–3b). This is the **remediation** campaign:
> how the findings it produced actually get fixed, verified, and merged.
>
> **Status: Sessions 1–6 SHIPPED.** Sessions 7–10 pending.
>
> ```text
> session  state        record
> -------  -----------  --------------------------------------------------------------
> 1        ✅ SHIPPED   9 instrument issues closed/refuted · queue labelled + milestoned
> 2        ✅ SHIPPED   Fix S2 closed: #210 #211 #235 #241 #242 #243 #255 · live 6.0.0.139
> 3        ✅ SHIPPED   Fix S3 closed, all 12: #208 #236 #237 #252 #253 #186 #251
>                       #209 #238 #239 #240 #254 · split out #286
> 4        ✅ SHIPPED   Fix S4 closed, all 9: #163 #164 #165 #171 #172 #173 #174 #189
>                       #190 · legacy/ deleted · filed #287 #288
> 5        ✅ SHIPPED   Fix S5 closed, all 9: #166 #175 #176 #177 #191 #205 #227 #228
>                       #247 · 6 root causes, 2 new AST censuses · filed #289
> 6        ✅ SHIPPED   Fix S6 closed, 15: #167 #168 #178 #179 #180 #181 #182 #183 #184
>                       #187 #188 #192 #193 #194 #195 · live 6.0.0.147 · #169/#170
>                       RE-MILESTONED to S9 (trace-moving) · filed #290
> 7        ✅ SHIPPED   Fix S7 closed, 6: #201 #202 #215 #216 #217 #287 · NO trace moved
>                       (baseline-zero 21/21 both sides) · filed #291 #292
> 8        ✅ SHIPPED   Fix S8 closed, 9: #200 #203 #207 #218 #219 #220 #232 #245
>                       #246 · #214 SPLIT OUT to its own branch (needs a settings
>                       migration) · filed #293 · baseline-zero 20/21, RED on
>                       10-hypo-u2 with 152 divergences, ALL attributed (below)
> 9        ⬜ Track B   25 issues, trace-moving, collect the red
> 10       ⬜ re-pin     one oracle re-pin, ledgered
> ```
>
> **Session 6 broke Track A's defining property, and that is the finding.** Track A was "47 issues,
> sim-BLIND — fixing them cannot move a trace". `#169`/`#170` are labelled `sim-blind` and they move
> THREE oracle fixtures: 719 divergences on `06-deep-u1.2`, 8 on `.3`, and 1,808 on `12-warp-u1`.
> `gammaBurstPct` lives in `heirlooms.ts`/`main-loop.ts`, neither of which terminates in a recorded
> mutator — but it is read by `calc.ts`, which feeds `stance.ts`, which calls `setFormation`. **The
> `sim-blind` label was derived from "does this module terminate in a wrapped mutator", which is the
> wrong question for a module that only computes an ESTIMATE.** Any remaining Track A issue whose
> output reaches `calc.ts` deserves the same re-check before it is assumed oracle-free.
>
> Waiving was not available and that is by design: `scripts/sim/manifest.mjs` names **12-warp-u1** on
> its never-waive list (it is `blind-spot-sensitivity.test.ts`'s #128 deep-game witness), so a
> trace-moving change there is "re-pin-or-park, never waive" — and 1,808 divergences is a behavioural
> cascade, not a substitution set a waiver could honestly pin. Both issues moved to `Fix S9` with the
> work preserved and pushed on `feature/s9-gamma-burst`.
>
> **#194 is the first migration in this repo that had to move an id in order to change a VALUE.** A
> dropdown persists its LABEL, and the corrected rarity list still contains `"Common"` — now meaning
> rarity 1 instead of 0. So a value-keyed migration cannot distinguish an un-migrated store from a user
> who deliberately picked that option, and would silently overwrite their choice on every boot, forever.
> (A value-migration table was written first; its own test caught this.) Riding `migrateLegacyId`'s
> `transform` makes the trigger the retired KEY's presence, which a migrated store no longer has —
> idempotent by construction. `SettingIdMigration.transform` is the reusable half of that lesson.
>
> **The review caught a defect the whole first pass agreed with itself about.** `buyAutoStructures`
> tests each item TWICE, and only the second is the purchase gate: `main.js:18250`'s
> `if (!setting[item]) continue` merely skips never-configured items, while `main.js:18264`'s
> `setting[item].enabled` decides. Reading stopped at :18250, and the fix, the comment explaining it,
> and the regression test guarding it all encoded that one misreading — which would have told a player
> who unchecked every building in the cog that "both automations are buying right now".
>
> **Session 5's two censuses both found more than the findings that prompted them.** `#177` claimed 9
> discarded `buyMap()` returns in `other-praiding.ts` and `#205` claimed 12 in `mapfunctions-amp.ts`,
> each explicitly scoping the other file out. The AST census found **29** — four more in
> `mapfunctions.ts` (the U2 insanity / ship / alch / hypo frag-map buys), carrying the same vestigial
> `if (bought)` on the line after the unconditional `bought = true` that is the author's own fingerprint
> of the lost `bought = (buyMap() == 1)`. The niceCheckbox census settled a similar disagreement
> (`#175` said 2 sites and mentioned 7 more; `#247` said 4 and called itself a duplicate): 20, of which
> only 6 are live. **Third session running that mechanizing the finding's own derivation beat it.**
>
> **Fourteen of those 20 were DELETED rather than repaired, and that distinction is the fix.** Their
> designs pin `lootAdvMapsRange` to 0, so the slider sum can never be 27 and `checkMaxSliders` forces
> Perfect off regardless — repairing them would change nothing locally while leaking a real
> `data-checked` write into every map designed later in the same Map-Chamber session. The same repair
> forced a second, unfiled change: `maps.ts`'s two `create` designers open at 9/9/9, so once
> `RfragMap` could actually leave Perfect ON they would have inherited it and paid the 2.34×
> surcharge (measured live against the game's own `updateMapCost`) on ordinary farming maps. They now
> re-assert the preset.
>
> **`#176` is the first sentinel question this campaign answered by refuting the finding's own
> proposal.** `#176` asked for `-1` to mean "no ceiling", matching AT's multiValue dialog ("Put -1 for
> Infinite"). It cannot: the raid ends on `findLastBionic().level > targetBW`, and clearing a BW is
> what creates the next tier — so once the chain stops at `getObsidianStart() + 100` the top level
> stops climbing and an infinite ceiling never terminates. The suggested fix converts a silent no-op
> into a hang. An unset max now skips the zone with a message (user decision), and the Infinity
> variant is one of the five mutants the net kills.
>
> **Session 4 replaced a dependency rather than patching it, and that was the right call by a
> falsification, not a preference.** `#171`'s "vendored" `legacy/FastPriorityQueue.js` turned out not
> to be a vendor drop at all: `git log --follow` shows the fork hand-adapted upstream in 2016 to strip
> its CommonJS tail and, in the same edit, rewrote `poll()`'s else-branch into
> `else if (this.size == 0) --this.size` — a construct present in ZERO upstream commits. That is the
> **fifth** instance of the near-miss-fix trap, and the first where the near-miss fix *was the
> artifact under review*. Upstream shipped the real repair in Feb 2017; the fork was never on the
> update path. The premise that pushed toward hand-rolling a replacement (upstream's bare
> `module.exports` makes a clean drop impossible) was REFUTED — esbuild resolves the CJS interop at
> build time — so the answer was the maintained package, pinned exact and lockfile-integrity-checked.
> `legacy/` is now gone entirely, taking the concat step, the ASI guard, the emit-order rule, the
> vendor guard hook and one bare-name ambient with it.
>
> **The parity question was settled by measurement, not argument.** Fixing `poll()` changes perk
> allocation only in the scenario where AT currently freezes: 240 structured + 4,000 randomized perk
> configurations showed ZERO differences in final levels or pass-2 spend, with a planted
> `_percolateDown` mutant reddening 144/240 to prove the harness was not vacuous. So no tuning gate
> was needed. Note also that fixing the queue ALONE converts the hang into a `TypeError` — the four
> pass-1 loops needed their own exhaustion exit, which is the half a queue-only fix would have missed.
>
> **Five of this session's nets initially passed against a broken build.** Every one was found by
> mutation-testing the near-miss rather than the revert, and the failure mode was the same each time:
> the assertion was satisfied by something other than the guard under test. The #164 tests let the
> sort's stable tie-break hand the buy to an unrelated item (three separate mutants survived); the
> #190 render test was satisfied by the write-side fix alone; and the #163 end-to-end test never
> entered the U2 arm at all, because `clearPerks()` branches on the `portalUniverse` global rather
> than `game.global.universe` — it would have certified a fix that did nothing.
>
> **Session 2 carried one finding the plan did not anticipate.** The plan's fix shape for #210/#235
> named three sinks; the code review found a **fourth and larger one** — `MAZ.ts` splices 29 stored
> values across the 14 MAZ preset editors. It matters beyond its size: every attribute there is
> **single-quoted**, and `escapeHtml` escapes `& < > "` but not `'`, so the fix the plan described
> ("escape at the seam") would have left it open. Removing the splice — DOM properties, not markup —
> is the only shape that closes this class. The net was mutation-tested against the escaping patch
> specifically, not just against the unfixed code. Apply the same rule to any remaining sink in
> Sessions 3–6: **prefer removing the splice to escaping it**, and check the quote style before
> believing an escaper is sufficient.
>
> **Decision 1 is ANSWERED (2026-07-28): option A — a standing policy that AT's mirrors must match
> the pinned clone exactly.** All eleven prediction-math findings are approved to fix, each with a
> golden-master test against the clone's own function; mirror drift becomes a permanent net. This
> unblocks Fix S9. Decision 2 (sentinel semantics) is still open and is now asked per session, as its
> issues come up, rather than as one round of eight.

> **Session 3 split one issue rather than half-fixing it.** `#209` had a genuinely strong
> counter-argument in its own reproduction pass: the render-layer write is the deliberate counterpart
> of `maps.ts`'s `DisableFarm > 0` arm, and the Nom-exempt version the finding proposed is a *strategy*
> change, not a mechanism fix. What survives that argument is narrower and still real — one `autoMap()`
> call reading `shouldFarm` as false and writing it true, with `siphlvl` and `repeatClicked()` flapping
> at 1 Hz. So the ownership half shipped (the reset moved into the owner, symmetric, one writer before
> any reader) and the strategy half became **#286**, blocked on modelling Nom's `1.25^stacks` healing in
> `calcEnemyHealth` — without which `calcHDratio()` sits under the cutoff in exactly the scenario the
> setting exists for, so widening the trigger would be tuning against a broken instrument.
>
> **Two findings were larger than reported, both caught by mechanizing the class rather than fixing the
> instance.** `#208`'s reproduction pass noted the #81 net was multitoggle-only *by construction*, which
> is why one 2018 preset shipped two instances of one class and only one was ever caught — a dropdown
> inventory now sits beside it. And the `#238` net (`one-armed-hides.test.ts`) found 15 sites the
> finding's own derivation had asserted did not exist: conditional hides sitting on top of unconditional
> ones. Redundant rather than stranding, so pinned as a shrinking count rather than fixed in a behaviour
> commit. **Both are the same lesson: the finding's derivation is a claim, and mechanizing it checks it.**
>
> **Mutation-test against the NEAR-MISS fix, not only the unfixed code** — Session 2's rule, and it paid
> three times here. `#237`'s obvious guard (`Number()` coercion) leaves `null` storable, because
> `Number(null)` is 0; `isNaN`-only accepts `±Infinity`, which JSON also writes as `null`. `#208`'s
> obvious repair maps `"Void 60"` → `"Void"` by similarity, which is a guess about a 2018 author's
> intent. `#238`'s obvious repair restores via `turnOn`, which writes `inline-block` on a container
> authored `block`. All three go red now; none would have without a deliberate near-miss mutant.

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

### Session 4 — Track A4+A5: AutoBattle and perks · **M** · ✅ SHIPPED 2026-07-28

`#164` `#165` `#173` `#174` `#190` · `#163` `#171` `#172` `#189` — all nine closed.

**What actually shipped, and where it differed from this plan.** Three of the AB findings collapsed
into one root cause: `RABfarmstring` is declared `textValue` and ab.ts stored a nested ARRAY into it,
which is simultaneously #165 (indexed character-wise), #190 (no `.substring`, so the control rendered
the "unset" ∞ glyph) and #174 (never flushed). One parser now reads it, and it still accepts the old
array so an existing user's scoreboard survives the upgrade.

Two findings were larger than reported, both caught by mechanizing the census instead of trusting the
finding's list — the S3 lesson, holding again. `#173` named two sites; the AST census of `ABsolver`
found **7 upgrade calls and 13 level reads**, all now routed through `abUpgradeOwned`/`abOwnedLevel`.
`#164`'s fall-through turned out to be exercisable only via an item the finding never mentioned:
both Doppelgangers are `noUpgrade`, so they are filtered out *before* the currency comparison, and the
only candidates that reach it are the 12 upgradable shard items — `Snimp__Fanged_Blade` at 159 is the
shallowest.

`#171` was not the bug it was filed as. See the status block above: the vendored queue was a
hand-edited fork, the fix is a pinned npm dependency, and `legacy/` is gone.

Live-verified in Chrome against the dev clone, all nine, driving real state rather than reading
render output — including the #171 repro itself (an all-maxed Overkill config now terminates in 94
`calculatePrice` calls instead of freezing the tab). One honest gap: #172's index shift is **not**
reproducible on a fresh save, because every perk sorting after Overkill is still locked there, so
that one rests on its unit net.

Filed out of this session: **#287** (the whole shipped bundle runs sloppy — the version global is
emitted before esbuild's `"use strict"`, so the directive is not in prologue position; it is masking
a real `NaN` defect in `ArithmeticPerk`) and **#288** (`RAutoPerks.updatePerkRatios` is defined
twice; the surviving copy drops the tier-II propagation).

Original plan for this session:

Both subsystems are blind by corpus depth, not by harness bug: no fixture has AutoBattle unlocked,
and `perks.ts` has never been confirmed to execute in a sim run (Task 3.1 of the discovery plan is
still unanswered). **Do not try to spy by reassigning the global** — module-internal calls do not
route through `window`, and that produces a confident *0 calls* while the code demonstrably runs
(#127/#129). Assert on state.

`#163` (U2 AutoPerks respec permanently zeroes Masterfulness / Smithology / Expansion) is the
highest-consequence finding in the whole set that is not a security issue — a user loses perk
levels irreversibly. `#171` hangs the browser forever.

### Session 5 — Track A6: praiding and prestige raids · **M** · ✅ SHIPPED

`#166` `#175`+`#228`+`#247` `#176` `#177`+`#205` `#191` `#227`

Nine issues, **six** root causes (the plan said seven; `#175`/`#228`/`#247` turned out to be one class,
not two). Every one carries its own regression test — the corpus never enters a praid path, so all 12
L0 fixtures reproduce the oracle byte-for-byte and `baseline-zero` is not evidence about any of this.

Two of the six needed the game clone to settle, not argument. `#227`'s premise — that an out-of-range
extra-zone value *deselects* the `<select>` rather than failing — was reproduced against a select built
exactly as `setAdvExtraZoneText` builds it; the fix SKIPS unbuildable slots rather than clamping them,
because a clamped +10 still misses the target and a clamped +0 duplicates the slot above it. And `#176`
went the other way: see the status block above.

Mutation-tested 26 mutants across the six fixes, every one aimed at the near-miss rather than the
revert. Four initially survived and each named a missing assertion: `swapNiceCheckbox(el)` with no force
argument TOGGLES and lands on the right answer from the game's default state; a repair that gates the
bought FLAG but still captures the map id parks the slot forever (visible only in the 96-99 band, since
the all-refused path blanks the slots anyway); `buyMap() !== -2` misses `-1`/`-3`/`undefined`; and a
restore that skips `toggleSetting` leaves the in-game toggle rendering the old state.

Live-verified in Chrome against the dev clone by driving real state: the Perfect surcharge measured
**2.3447×** through the game's own `updateMapCost`, the `#227` reachability table came back exactly as
designed for gaps of 3/10/11/20, and an unset Max BW skipped its zone without claiming success or
taking AutoMaps and Climb BW hostage. Two honest gaps, both save-depth: Perfect unlocks at zone 109 and
extra map zones at 209, so on a z62 save `checkPerfectChecked()` is gated off and the extra-zone select
is empty — the cost delta and the DOM coercion rest on the unit nets, which mirror the game's arithmetic
verbatim and pin it against the clone.

Filed out of this session: **#289** (`PraidHarder`'s two failure arms leave AT's `AutoMaps` switched off
for the rest of the run — and the comment on one of them says it turns it back on).

### Session 6 — Track A7+A8: sentinels, heirlooms, MAZ, conflicts · **M** · ✅ SHIPPED

`#167` `#168` `#178` `#183` `#184` `#194` · `#179` `#180` `#181` `#182` `#187` `#188` `#192` `#193`
`#195` — fifteen shipped. **`#169`/`#170` re-milestoned to S9**; see the status block above for why
the `sim-blind` label was wrong about them.

Two of the fifteen were value-semantics calls rather than mechanism repairs, and both were put to the
user. `#184`: the code's never-fuel sentinel (`< 1`, which the `-1` default already is) works, and the
tooltip telling users to type `230` was simply false — so the TOOLTIP changed and `230` stays an
ordinary zone number a player can still mean. `#194`: the rarity dropdown and `heirlooms.ts`'s
thirteen-branch mapping were two independent hand-transcriptions of `game.heirlooms.rarityNames`,
agreeing with each other and disagreeing with the game; both now derive from `heirloom-rarities.ts`,
pinned against the clone's `config.js`.

`#188` deliberately went **beyond its own scope**, and the extra work was the point. The issue named
native mode 1's Challenge² bail-out; mirroring `main.js:18576-18592` properly shows mode **3** reaches
the identical `return` once Void is capped, so scoping the fix to what the finding described would have
left the same false positive alive from a second direction. Fourth session running that a finding's own
scoping claim did not survive being mechanized.

Two nets had to be repaired rather than satisfied. `setting-array-compare`'s anti-false-green asserted
`sites.some(s => s.reversed)` against LIVE src — so its health depended on a real defect continuing to
exist, and it went red the moment `#178`'s last reversed site was fixed; it now proves the capability
against a synthetic fixture. And `native-conflicts-completeness`'s advisory-only regex matched a COMMENT
citing the game's `toggleAutoStructure(true)`, reddening a gate over prose — it now strips comments and
strings first, with a test proving the stripper has not disarmed it. **A text net whose corpus includes
prose has a false-positive surface exactly where the code is best documented, and the pressure that
creates is to explain less.**

34 mutants, every one aimed at the near-miss repair. The one that mattered was not mine: review found
`buyAutoStructures`'s real purchase gate fourteen lines below the one I had read, and my fix, my comment
and my regression test all encoded that misreading. Re-mutated after correcting.

**Track A ends here. 52 issues shipped, zero oracle churn, five reviewed merges** — the two that would
have churned it moved to Track B instead.

---

### Session 7 — Track B prep + jobs · **L** · ✅ SHIPPED 2026-07-29

**"First trace-moving session" was wrong, and that is the first thing Session 8 should not inherit.**
`baseline-zero` was 21/21 green before any edit and 21/21 green after all six fixes, so S7 contributes
NOTHING to the Session-10 re-pin. Every one of the five jobs issues had independently claimed its own
region was sim-blind; the plan's Track B framing overrode five correct claims with one wrong one.
Check the claim per issue, not per track.

The baseline is a **git tag, not a file copy**: the manifest carries zero waivers, so a green
`baseline-zero` proves the current build's traces are byte-identical to the committed oracle, making
`tests/fixtures/traces/` at `baseline/pre-s7` (01836cb7) the archive. It survives the S10 re-pin
because git does.

**Three censuses, three undercounts — the fourth session running that mechanizing a finding's own
derivation beat it.** The cap idiom `a <= b ? a : b` was claimed at 1 site and found at 2 — and the
second is inside the Watch arm, so **#202 and #217 are the same function** and neither issue mentions
the other. Direct native `buyJob(` calls were claimed at 3 and found at 7 (only 2 reachable with a
non-finite amount, which is the number that mattered). The `challengeActive` string-compare was
claimed at 1 and found at **11**, of which two are settings that were dead **100% of the time**:
`Rcarmormagic` and `mapc2hd` are both categorised C2, documented C²-only, and gated on a child name a
C² never stores — strictly worse than #216's case, which at least works during the plain challenge.
Seven `query.ts` prediction sites deferred to **#291** and pinned by a shrinking census net. That
issue ALSO undercounted itself — filed as six, the net returned seven, and the seventh is a breed
potency term in a different function; corrected before the boundary hardened.

**Mutation-testing found a bug in the fix, not just in the net.** `Math.min` propagates NaN but NOT
Infinity, and `Math.min(Infinity, canBuy)` is `canBuy` — the original bug's outcome exactly. Reachable
without any NaN: ratios of 1 / -1 / 0 sum to zero with a positive numerator, and nothing validates the
sign of a `value` setting. The `isNaN`-instead-of-`isFinite` near-miss mutant survived, which is how it
surfaced. 16 mutants across three nets; all now killed.

**#217's "already pinned in the oracle" was false, and so was a comment asserting the coverage.**
`03-challenge-watch` decodes to `trimps.owned 93.19` against a realMax that makes the arm's own gate
false; all three recordings carry 18 `buyJob` events and **zero** Scientist. A comment in
`tests/jobs.actuators.test.ts` had asserted that L0 coverage for years — the same "a gate that cannot
fail reports success" pattern, in prose.

**#287 was not a build tweak; it flipped the whole bundle from sloppy to strict.** The full suite went
229 failures / 36 files with the prologue fix alone → **1** with the `ArithmeticPerk` arrow fix as
well (that 1 being the byte golden, legitimately moved). One root cause, exactly the one #287
predicted. Crucially the suite is a WEAK instrument here — vitest imports modules as ESM, which is
already strict — so the evidence is the live A/B: on `main` all five tier-II perk `value` arrays are
`[NaN, NaN, …]`; on the branch they are real numbers. That had been shipping for years.

**Review caught an overclaiming test name, and the replacement test caught me.** The "steady state"
test used a below-target fixture (the old dead band). Rewriting it, I asserted the Watch and non-Watch
arms bail identically — and it FAILED: the general branch trickles F/L/M while breeding and the Watch
arm does not, so under Watch AT hires nothing at all once scientists reach target. Pre-existing,
orthogonal to #217, filed as **#292**. The claim would have shipped as a justifying comment had it not
been written as an executable assertion.

Original plan for this session:

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

**⚠️ THE COLLECTED RED STOPS THE DEPLOY, AND THAT IS NOW AN ACCEPTED TRADE (user decision, 2026-07-29).**
`deploy.yml:40` runs `npm run test:ci` and the deploy job is `needs: build`, so a red `baseline-zero`
fails the whole workflow — the hosted userscript at
`mattaltermatt.github.io/AutoTrimps/autotrimps.user.js` **stops updating from S8 until the S10 re-pin
lands.** Anyone installing from Pages in that window keeps the pre-S8 build, including #203's U2
AutoEquip deadlock (zero gear levels for an entire run). This plan asserted "RED, collected · 8 merges"
without noting that merges 8 and 9 do not publish.

A waiver is not an escape hatch here, and the asymmetry matters: `baseline-zero` DOES consult the sim
manifest (its failure reads `[manifest] N UNEXPLAINED divergence(s)`), so a waiver could silence it —
but `blind-spot-sensitivity` asserts `diffTraces(oracle, clean) === []` with **no manifest consulted**,
and `10-hypo-u2` is one of its three sensitivity fixtures. There is no waiver path to a green deploy.
Re-pin or stay red, exactly as §"re-pin-or-park, never waive" says.

Chosen: **stay red.** The campaign deliberately traded shipping cadence for one honest re-pin, and
clearing the red any other way is the "never re-record to make a red go away" rule. S9 will keep it red;
S10 restores the deploy. **Flag this before the first Track B merge of any future campaign** — it should
be a stated decision up front, not something discovered when the live script looks stale.

**S8's red is ONE substitution, and the oracle is the evidence.** `10-hypo-u2` — the only fixture with
`Requipon: true` — diverges at 152 events, and the first three name the cause outright:

```text
idx  oracle (pinned as "correct")           working (fixed)
---  -------------------------------------  ------------------------------
  8  buyEquipment("Arbalest", …)   ← LOCKED  buyEquipment("Dagger", …)
  9  buyEquipment("Gambeson", …)   ← LOCKED  buyEquipment("Boots", …)
 12  buyUpgrade("Coordination")    ← stalled buyEquipment("Dagger", …)
```

Attribution for the S10 ledger: **#220** removed the always-level-2 block's unguarded buys of LOCKED
gear (indices 8–9), and **#203** stopped `mostEfficientEquipment` ranking locked slots, so the
efficiency loop now returns real winners and keeps buying instead of stalling at tick 2 (index 12 and
everything after). The remaining 149 are the downstream cascade of buying gear where the oracle bought
none. `[runtime] MATCH` — the harness confirms the runtime equals the oracle's, so this is a src change,
which is what we wanted. **The oracle recorded AT buying equipment the game refuses to sell; that trace
was always wrong, and re-pinning it at S10 is the correction, not a laundering.**

**#214 was SPLIT OUT of S8** after an adversarial panel. Decision recorded in full on the issue: `-1`
becomes the single uncap sentinel and `0` means "build none" (16 of 17 consumer sites and 14–18 tooltips
already agree; `< 1` can never generalize because `MaxWormhole` and `RMaxLabs` both ship `'0'` defaults
that depend on 0 meaning "never build"). It needs a value migration riding an id move — and both
consumers resolve their id by *string concatenation* (`'Max' + name`), so the rename silently breaks the
lookup, and a missed lookup returns `false`, which the gem buyer's rescue converts to **uncapped**: the
exact failure being fixed, reintroduced by its own fix. That is `settings-migrations.ts` territory, whose
header opens with "the failure mode is silent data loss for real users" — it gets its own review cycle.
Note the plan's own S8 entry says "do not touch the cap semantics", which this honours.

**The panel also overturned the lead's reasoning, which is worth recording.** The lead was about to fix
#214 justified by "#140 proved uncapping housing is ~4× worse". #140's uncapped arm was `Max = -1` — the
one value both consumers already agree on — and its mechanism needs a *fallback candidate* (capped
housing drops out, AT is forced into Collectors), but the food-efficiency list has **no Collector** in
it. The conclusion was imported onto a question #140 never measured. Second session running that a
batch-level label outvoted the per-case analysis.

### Session 9 — Track B: combat math, maps, portal, gather · **XL**

⚠️ Now also carries `#169`/`#170` (the gammaBurstPct sentinel, re-milestoned out of S6 for moving three
oracle fixtures — the fix is built and mutation-proven on `feature/s9-gamma-burst`) and `#290` (calc.ts
 treats W/formation 5 as a halving formation). Both are combat-math, both are trace-moving, and both
belong to the single Session-10 re-pin.

`#198` `#199` `#212` `#213` `#244` `#229` `#230` `#231` `#248` `#233` `#249` `#250` ·
`#204` `#221`–`#226` `#234` · `#206` · `#185` · `#162`+`#263`

The largest session and the one most dependent on Decision 1. Split it if the decision lands as B.
`#206` is small but severe: C2 Runner's Challenge² flag is module-scoped so the game never sees it —
**every C2 Runner portal starts a plain challenge.** `#204` makes Ship Farming re-buy a map every
tick forever.

#### S9 combat-math wave — attribution for the S10 ledger

Measured, not asserted: each commit was checked out on its own and `baseline-zero` re-run, so every
red below is attributed to the change that causes it rather than to the wave as a whole.

```text
build                              red   new fixtures (divergence count)
---------------------------------  ----  ----------------------------------------------------------
baseline/pre-s9 (= main @ S8)       1/21  10-hypo-u2 (152)            <- S8 carry-in, already ledgered
+ #169/#170  gammaBurstPct          4/21  06-deep-u1.2 (719), .3 (8), 12-warp-u1 (1808)
+ #290/#294  formation-5 mirror     6/21  06-deep-u1.1 (747), 07-map-cap-u1 (747)
                                          [.2 719->864, .3 8->722; 12-warp UNCHANGED at 1808]
+ #199/#212/#295  crit pricing     14/21  01-early-u1 x3 (8/10/12), 03-challenge-watch x3 (16/15/16),
                                          08-starved-u1 x2 (1742/1603)
                                          [06-deep .3 722->724; 12-warp 1808->1991]
```

**The gamma-burst row reproduces S6's own measurement byte-for-byte** — 719 / 8 / 1808, the three
numbers the status block above recorded when `#169`/`#170` were re-milestoned out of `Fix S6`. The
commit was cherry-picked onto post-S7/S8 `main`, so an unchanged count is independent evidence that
the rebase preserved its effect and that nothing in S7 or S8 interacts with it.

**The crit fix moves the SHALLOW fixtures, and that is the tell.** `01-early-u1`, `03-challenge-watch`
and `08-starved-u1` were untouched by everything else in this wave and go red only here, because their
whole corpus decodes to a player with `getPlayerCritChance() === 0` — precisely the regime where the
old code priced a non-crit at `getMegaCritDamageMult(0)` = 1/base. Measured on the booted save:
`critD` is 2, so AT's damage estimate was **2.5x low** and every gear/stance/farm decision downstream
of `calcHDratio()` inherited it. `08-starved-u1` is the clearest single reading — `setFormation("0")`
and `setFormation(3)` become `setFormation(2)` from tick 71 onward: AT stops cowering in X/Barrier and
takes Dominance, because it has stopped believing it is 2.5x weaker than it is.

**`12-warp-u1` is the control for the formation change.** It stays at exactly 1808 across the
formation commit and only moves (1808 -> 1991) once crit pricing lands. Formation 5 is uber-Wind, which
that fixture never reaches, so a formation-5 mirror correction *should* be invisible there — and is.

Two findings were filed from inside this wave, both by running the mechanical scan a finding asked for
instead of trusting its scoping claim: **#294** (three more formation sites, and #290's own suggested
one-line patch is a regression on its own — see the issue) and **#295** (no negative-crit-chance arm).
`#290`'s "check the U2 twins around :1283" pointed at code that correctly has no formation logic at all.

⚠️ **One net was passing because of a bug under test.** `settings-unset-encodings`' #100
anti-false-green asserted "a SET highdmg that is not equipped DOES still take the branch" and measured
a 2.5x ratio change to prove it. That 2.5x **was #199** — divide out 0.4, multiply back 1. With the
pricing corrected, both crit terms are exactly 1 on a zero-crit save, the branch runs and correctly
predicts nothing, and the old assertion could no longer see it. It now drives a player who actually
crits. This is the `#178` shape again (a net whose health depended on a defect persisting), found this
time not by the net breaking on its own but by a fix in a *different* file making it unprovable.

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
