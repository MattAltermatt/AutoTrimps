# AutoTrimps Automation — Code Review Findings (2026-07-08)

Companion to [`2026-07-08-true-ts-modernization-design.md`](2026-07-08-true-ts-modernization-design.md). This is the
review deliverable that anchors **Phase 0 · De-risk** — the confirmed bug backlog to clear before
converting modules to true TypeScript.

## How this was produced

A multi-agent review workflow (`wsog4ano9`): **20 per-module correctness finders + 3 cross-cutting
conversion-seam audits**, each finding then **adversarially verified** by independent skeptic + bug-hunter
agents that read the actual code and cross-checked the live game (`../trimps-game` v5.10.1) and the legacy
oracle. **67 agents, 0 errors.**

- **38 findings → 27 confirmed · 8 filtered as faithful-to-legacy-intended (not bugs) · 0 left disputed.**
- 27 confirmed findings = **26 distinct bugs** (`mapfunctions.ts:457` surfaced twice).
- Many are faithful ports of latent ~15-year-old upstream (Zek) bugs — still genuine defects with concrete
  failing inputs, exactly like the already-shipped #24 / #25 fixes.

## Fix classification (drives what needs approval)

**A · Pure mechanism — 16 bugs — safe to fix (no balance numbers; the #24/#25 class):**
`calc.ts:776` · `heirlooms.ts:218` · `MAZ.ts:295` · `buildings.ts:492` · `equipment.ts:868` ·
`equipment.ts:946` · `gather.ts:105` · `mapfunctions.ts:457` · `mapfunctions.ts:1491` · `maps.ts:276` ·
`maps.ts:1314` · `stance.ts:63` · `stance.ts:133` · `ab.ts:157` · `heirlooms.ts:470` · `scryer.ts:66`

**B · Numeric formula-mirror — 8 bugs — APPROVAL-GATED (edits a constant/formula to match the current game):**
`query.ts:47` · `query.ts:77` · `calc.ts:748` · `calc.ts:1562` · `breedtimer.ts:62` · `nature.ts:29` ·
`nature.ts:43` · `nature.ts:56`

**C · Preset-array length — 2 bugs — tiny decision (append a trailing ratio; `0` = safe no-op default):**
`perks.ts:31` · `perks.ts:1391`

Every fix ships paired with a regression test in the region it touches (per the design spec), using the
Phase-0 characterization harness. Class-B edits mirror `../trimps-game` verbatim — they correct the fork's
*own* prediction math to match the game; they do **not** change game balance.

---

## Confirmed findings (high → medium → low)

<!-- generated from workflow wsog4ano9; symptom/fix verbatim from the verified agent output -->
### `src/modules/MAZ.ts:295` — **HIGH** · shared-var-seam

- **Breaks:** With the AutoTrimps MAZ settings window open (e.g. 'Time Farm'/'Tribute Farm'), pressing a game hotkey (i/z/e/k) can spuriously close the window and discard unsaved preset edits. Repro: view the native Spire Assault popup (engine global lastTooltipTitle becomes 'Spire Assault'; cancelTooltip->tooltip('hide') returns early at updates.js:54 without resetting it), then open the MAZ window (sets game.global.lockTooltip=true), then press 'i': main.js:20280 runs `if (game.global.lockTooltip && lastTooltipTitle == 'Spire Assault') cancelTooltip();` -> both true -> MAZ window force-closed.
- **Fix:** The port changed the legacy implicit-global write `lastTooltipTitle = titleText;` into `var lastTooltipTitle = titleText;`, based on a file-header comment claiming it is write-only with no external reader. That is false: lastTooltipTitle is a Trimps game-engine global (declared `var lastTooltipTitle = ""` at ../trimps-game/updates.js:24) read across the engine (main.js keydown handlers 20280/20291/20330/20343, config.js:937, objects.js:532/4072). MAZLookalike is a clone of the engine tooltip() and legacy-set this global so the engine's lock-tooltip handling knew the window's identity. The `var` creates a function-local shadow, so the engine global is never updated and retains a stale prior-tooltip title. Fix: `globalThis.lastTooltipTitle = titleText;` per the project's shared-var seam convention, not a local var.

### `src/modules/calc.ts:776` — **HIGH** · wrong-index-or-slot

- **Breaks:** During the world Spire (game.global.spireActive && type=='world'), calcEnemyHealthCore calls calcSpire(99, 'Snimp', 'healh'). Inside calcSpire the U1 path executes `base *= game.badGuys[enemy]['healh']`; there is no 'healh' key (only 'health'/'attack'), so it evaluates to undefined and base becomes NaN. calcEnemyHealthCore/calcSpecificEnemyHealth then return NaN, which stance.ts:104 subtracts for its overkill/damage-left check — corrupting stance and overkill decisions throughout the Spire.
- **Fix:** 'healh' is a typo for 'health'. The game's getSpireStats (main.js:13726) uses correctly-spelled game.badGuys[name][what], and the fork's own sibling calcEnemyHealth (line 760) passes 'health' correctly. Change "healh" to "health".

### `src/modules/heirlooms.ts:218` — **HIGH** · shared-var-seam

- **Breaks:** When a stance-triggered loom swap fires with a matching carried heirloom, lowHeirloom/highHeirloom/dlowHeirloom/dhighHeirloom (and every Radon Rhsequip*/staff-equip fn) throw `ReferenceError: loom is not defined` at `game.global.heirloomsCarried.indexOf(loom)`, crashing the automation tick instead of equipping the loom.
- **Fix:** Classic Praidingzone port regression. In legacy the finder loops were `for(loom of …)` (no var) — a sloppy-mode implicit GLOBAL, so calling e.g. `lowdmgshield()` left `globalThis.loom` pointing at the matched heirloom, which the very next line read via `indexOf(loom)`. The port localized all 14 loops to `for(var loom of …)` (lines 18-21, 458-467, 637) to kill a loop-var ReferenceError, but the downstream reader sites (218,224,230,236 and 471,477,483,489,495,501,508,514,520,527) still read a bare `loom` that is now bound nowhere (confirmed: no `globalThis.loom`, no module `var loom`, no ambient decl). Reading an undeclared identifier throws regardless of strict/sloppy mode. Concrete input: user sets `lowdmg` to a carried heirloom's name, it isn't the equipped shield, stance logic calls `lowHeirloom()` (stance.ts:314) → `lowdmgshield()` returns the loom (!= undefined) and ShieldEquipped.name differs → enters the `if` → `indexOf(loom)` throws. Fix: capture the finder result, e.g. `var loom = lowdmgshield(); if (loom && …) indexOf(loom)`.

### `src/modules/query.ts:47` — **HIGH** · game-parity-drift

- **Breaks:** In universe 2 (Radon) at world/zone > 300, RgetEnemyMaxAttack under-predicts enemy attack by a factor of 1.15^(world-300). The current game's getEnemyAttack (../trimps-game/config.js:490-528) applies a fourth U2 scaling term `var part4 = world-300; if(part4<0)part4=0; amt *= Math.pow(1.15, part4)`, but this port's U2 block (query.ts:39-48) stops at part1/part2/part3 and never applies part4. Every live survivability/advance decision that calls RgetEnemyMaxAttack — equipment.ts:647/1055/1094 (equip-equality + hits-survived), maps.ts:952, mapfunctions.ts farming-zone selection (1493+), calc.ts:1021/1024/1277/1282/1480 — therefore treats late-U2 enemies as vastly weaker than reality (e.g. z350 → 1.15^50 ≈ 1084x too low), so the automation advances into or farms zones it cannot survive, causing death/portal.
- **Fix:** The z300 hard-scaling term (part4, x1.15^(world-300)) that the current game added to getEnemyAttack was never propagated into this hand-written from-scratch prediction port. Fix: after query.ts:47 add `var part4 = (world - 300); if (part4 < 0) part4 = 0; amt *= Math.pow(1.15, part4);` inside the universe==2 block to mirror config.js.

### `src/modules/query.ts:77` — **HIGH** · game-parity-drift

- **Breaks:** In universe 2 (Radon) at world/zone > 300, RgetEnemyMaxHealth under-predicts enemy health by a factor of 1.15^(world-300). The current game's getEnemyHealth (../trimps-game/config.js:530-548) applies `var part3 = world-300; if(part3<0)part3=0; amt *= Math.pow(1.15, part3)`, but this port's U2 block (query.ts:72-78) stops at part1/part2 and never applies part3. Callers such as equipment.ts:1101 (fakeHDRatio = RgetEnemyMaxHealth/ourDmg used for equipment-equality push decisions) and maps.ts:399 (siphonology target) then believe late-U2 enemies die far faster than they do, driving wrong equality-push / farm-depth / advance decisions.
- **Fix:** Same missing z300 hard-scaling term as getEnemyAttack: the game added part3 (x1.15^(world-300)) to getEnemyHealth and the fork's port was not updated. Fix: after query.ts:77 add `var part3 = (world - 300); if (part3 < 0) part3 = 0; amt *= Math.pow(1.15, part3);` inside the universe==2 block to mirror config.js.

### `src/modules/breedtimer.ts:62` — **MEDIUM** · game-parity-drift

- **Breaks:** During an active Archaeology or Quagmire challenge, the fork's predicted breed timer (hiddenBreedTimer) and the geneticist-assist decisions in ATGA2 are computed from a potency value that ignores the challenge's breed multiplier, so the displayed breed time is wrong and addGeneticist()/removeGeneticist() buys/sells the wrong number of geneticists to hit the ATGA2 target.
- **Fix:** potencyMod() is a stale copy of game v5.10.1 breed() (main.js ~5620-5636). The game multiplies potency by chalArchaeology = Archaeology.getStatMult('breed') and chalQuagmire = Quagmire.getExhaustMult() (main.js 5629-5630), applied right after the Toxicity term and before slowBreed. This port has no such terms (the Toxicity block at line 62-63 jumps straight to slowBreed at line 66), and the same omission is duplicated in the inline potency copy inside ATGA2() at lines 126-133. Since neither Archaeology nor Quagmire is delegated to native game code (breeding prediction is from-scratch), the fork diverges from the game whenever those challenges are active.

### `src/modules/buildings.ts:492` — **MEDIUM** · wrong-index-or-slot

- **Breaks:** In RbuyStorage (U2/radon storage buying), the 'am I on Trimple/Atlantrimp?' detection never works. `var isOnTrimple = game.global.currentMapId;` then `for (var Map in game.global.mapsOwnedArray) { if (Map.id == isOnTrimple) { if (Map.name == 'Atlantrimp' || Map.name == 'Trimple Of Doom') isOnTrimple = true; } }`. `mapsOwnedArray` is an ARRAY of map objects (game main.js indexes it as `[x].id`/`[x].name`), so `for..in` binds `Map` to the string index ('0','1',...). `Map.id` and `Map.name` are therefore `undefined`, the inner condition is never true, and `isOnTrimple` is never reassigned to the boolean — it retains `currentMapId`. Downstream `if (isOnTrimple)` (line 517) then only tests 'am I in any map' (truthy string) rather than 'am I on Trimple/Atlantrimp'.
- **Fix:** Concrete failure: run Universe 2 with `game.global.mapsActive` true while inside ANY ordinary (non-Trimple) map — e.g. a regular farming map. `currentMapId` is a non-empty id string, so `isOnTrimple` is truthy and the code takes the `jestImps[Res] = curRes * 2` branch (line 518) instead of the intended `curRes + scaleToCurrentMap(simpleSeconds(Res,45))` branch (line 520). Storage (Barn/Shed/Forge) is then bought based on a doubled-resource projection on every non-Trimple map, buying storage earlier/more aggressively than intended. The Trimple-specific `*2` special-case is effectively always-on and the scaleToCurrentMap path is dead. Root cause is `for..in` over an array (element `.id`/`.name` access on index strings) — wrong regardless of legacy.

### `src/modules/calc.ts:748` — **MEDIUM** · game-parity-drift

- **Breaks:** While the Life challenge is active, calcEnemyHealth (used by calcHDratio at lines 892/895) multiplies predicted world-enemy health by 10, but the game multiplies enemy health by 11 (main.js:11471; description = '1000% extra health' = 11x). The fork's own calcEnemyHealthCore (line 793) correctly uses 11. Result: HD ratio during Life is ~9% too favorable, so automation over-estimates clear speed / under-gears.
- **Fix:** Life enemy-health multiplier should be 11, not 10 — the two sibling functions in this same file disagree (10 here vs 11 at line 793) and the game/description confirm 11. Change health *= 10 to health *= 11.

### `src/modules/calc.ts:1562` — **MEDIUM** · game-parity-drift

- **Breaks:** In Universe 2 at world > 300 (e.g. zone 350) with the Rmutecalc setting off, RcalcEnemyBaseHealth (used by RcalcEnemyHealth/RcalcEnemyHealthMod/RcalcHDratio) omits the game's third U2 scaling term. The game's getEnemyHealth (config.js:557-563) applies part1=1.4^min(world,60), part2=1.32^(world-60), AND part3=1.15^(world-300); this port only applies part1 and part2. Predicted enemy health is therefore too low by a factor of 1.15^(world-300) (~1000x at zone 350), so the U2 HD ratio is wildly optimistic past zone 300.
- **Fix:** The U2 block is missing the third term: after `amt *= Math.pow(1.32, part2)` it needs `var part3 = world - 300; if (part3 < 0) part3 = 0; amt *= Math.pow(1.15, part3);` to match the current game (config.js getEnemyHealth). Matches the analogous part4 in the game's getEnemyAttack.

### `src/modules/equipment.ts:946` — **MEDIUM** · wrong-variable

- **Breaks:** During the Pandemonium challenge, the fork's own equipment cost/efficiency prediction omits the challenge's 5x-and-growing equipment cost multiplier, so it treats gear as far cheaper than it really is (mis-ranking most-efficient gear and wrongly judging prestige/level affordability).
- **Fix:** The code reads `game.global.challenges == "Pandemonium"` at lines 517 (RequipCost), 868 (mostEfficientEquipment) and 946 (buyPrestigeMaybe). `game.global` has NO `challenges` property (the challenge string lives at `game.global.challengeActive`; `game.challenges` is a separate top-level object). So `game.global.challenges` is always `undefined`, the comparison is always false, and `price/artBoost *= game.challenges.Pandemonium.getEnemyMult()` never runs. The game's `getEquipPriceMult()` (main.js:4728) applies this multiplier via `game.global.challengeActive == "Pandemonium"`, and this very file uses the correct `challengeActive` spelling for the analogous checks at lines 872, 936, and 1090 (estimateEquipsForZone). Concrete: on a 2nd+ Pandemonium run (`getEnemyMult()` >= 5), buyPrestigeMaybe's `artBoost` is ~5x too small, so `levelOnePrestige`/`newLevel` under-cost the prestige and it green-lights a purchase (or ranks gear) as if equipment were 1/5 its true cost. Fix: `game.global.challengeActive`.

### `src/modules/equipment.ts:868` — **MEDIUM** · game-parity-drift

- **Breaks:** While the Pandemonium challenge is active (game.global.challengeActive === 'Pandemonium'), the R/U2 equipment-cost prediction never multiplies artBoost by the enemy mult, so mostEfficientEquipment (868), buyPrestigeMaybe (946) and RequipCost price (517) all under-estimate equipment/prestige cost and mis-rank or over-buy gear during Pandemonium.
- **Fix:** These three lines read game.global.challenges (plural) which does not exist on game.global — the current game only defines game.global.challengeActive (config.js:102). `undefined == 'Pandemonium'` is always false, so `artBoost *= game.challenges.Pandemonium.getEnemyMult()` / `price *= ...` never runs. The parallel site at line 1090 (estimateEquipsForZone) performs the identical operation guarded correctly by game.global.challengeActive, proving intent. Fix: use game.global.challengeActive at lines 517, 868, and 946. Faithful-ported upstream Zek typo (present verbatim in the legacy oracle at d283f152:legacy/modules/equipment.js lines 504/855/933), same class as the #24/#25 fixes.

### `src/modules/gather.ts:105` — **MEDIUM** · operator-precedence

- **Breaks:** With the Foremany bandit reward unlocked and buildingsQueue[0] == 'Shed.1' (or 'Forge.1'), this 'Also Build storage buildings' branch fires and forces setGather('buildings'), overriding all later gather priorities (research/metal/trapping) even though the whole block is meant to be gated behind !bwRewardUnlocked('Foremany') and a non-empty queue.
- **Fix:** Missing parentheses cause an operator-precedence bug. `&&` binds tighter than `||`, so the condition parses as `(!Foremany && queue.length && q0=='Barn.1') || (q0=='Shed.1') || (q0=='Forge.1')`. The Shed.1/Forge.1 comparisons stand alone, unguarded by the Foremany and queue-length checks. The intended grouping is `!Foremany && queue.length && (q0=='Barn.1' || q0=='Shed.1' || q0=='Forge.1')` — confirmed by the sibling RmanualLabor2 at line 370, which parenthesizes the identical Barn/Shed/Forge OR-group correctly.

### `src/modules/mapfunctions.ts:1491` — **MEDIUM** · wrong-variable

- **Breaks:** In Rmayhem(), the M: Attack boss farming threshold `hits` is always 100, silently ignoring the user's configured 'M: Attack Boss' cut-off setting.
- **Fix:** The ternary guard reads `getPageSetting('Rmayhemacut')` but no setting named `Rmayhemacut` exists (only `Rmayhemabcut` is defined in settings-defs.ts:610). getPageSetting() returns `false` for unknown keys (utils.ts:59-60), so `false > 0` is always false and the ternary always takes the `: 100` branch. The value branch `getPageSetting('Rmayhemabcut')` is unreachable, so the user's boss cut-off is dead. Every sibling uses the SAME key on both sides (line 1509 `Rmayhemamcut`/`Rmayhemamcut`, line 1492 `Rmayhemhcut`/`Rmayhemhcut`); line 1491 should be `Rmayhemabcut` on the condition side too. Concrete: Mayhem challenge, M:Attack on, user sets Rmayhemabcut=50 → intended trigger `RcalcHDratio()>50`, actual `>100`, so Rshouldmayhem=1 fires much later than configured.

### `src/modules/mapfunctions.ts:457` — **MEDIUM** · wrong-variable

- **Breaks:** In RfragCheck(what), the hypo branch assigns sepcial = "lwc" (a misspelled global initialized at line 14 and never read anywhere), while the correctly-spelled local var special = "fa" (line 433) is what gets passed to RminFragMap(selection, levelzones, special) at line 467. For what == "hypo" the intended special map modifier "lwc" never reaches RminFragMap, which instead receives the default "fa", so hypo frag-farming generates maps with the wrong advSpecialSelect modifier.
- **Fix:** Typo: sepcial should be special. The write to the misspelled global is dead (sepcial is never read), and the local special used downstream retains its "fa" default for the hypo case. Faithful to the upstream typo in legacy modules/mapfunctions.js:442 — same class as the already-fixed selectedMap/slot typos.

### `src/modules/maps.ts:276` — **MEDIUM** · coercion-compare

- **Breaks:** In PrestigeSkip1_2 mode 1 or 3, shouldSkip is computed as `numLeft <= customVars.UnearnedPrestigesRequired`, but `numLeft` is the ARRAY returned by `prestigeList.filter(...)` (line 275), not its `.length`. Comparing an array to the number 2 coerces the array to a comma-joined string then to a Number: for any non-empty result the string is non-numeric so the comparison yields NaN (=> false); it is only true for the empty array (`[]` -> `""` -> 0 <= 2). So shouldSkip is effectively `numLeft.length === 0` instead of the intended `numLeft.length <= 2`. Concrete case: at a zone where exactly 1 or 2 of the six prestiges (Dagadder..Harmbalest) still satisfy `last <= world+extraMapLevels-5`, the intended logic would set shouldSkip=true (skip the prestige) but the buggy comparison returns false, so needPrestige/skippedPrestige do NOT flip and the automation farms a prestige map it was supposed to skip (or fails to un-skip in the mirror case).
- **Fix:** Missing `.length`: `numLeft` should be `prestigeList.filter(...).length` (or `shouldSkip = numLeft.length <= customVars.UnearnedPrestigesRequired`). NOTE: this is byte-identical to the legacy source (git d283f152 legacy/modules/maps.js line 261), so it is a faithfully-ported pre-existing upstream bug, not a port-introduced regression — but it is a genuine correctness defect (array-vs-number coercion) that produces wrong prestige-skip decisions regardless of legacy.

### `src/modules/nature.ts:56` — **MEDIUM** · game-parity-drift

- **Breaks:** When the player has Natural Diplomacy I (game.talents.nature.purchased) but NOT Natural Diplomacy II (nature2), a 'Convert to X' auto-setting credits the target empowerment with 6 tokens per 10 spent instead of the 8 the current game (v5.10.1) gives. autoNatureTokens directly mutates game.empowerments[targetNature].tokens (it does NOT call naturePurchase), so this writes a wrong, permanently-lower token count into game state every tick, silently costing 2 tokens per conversion.
- **Fix:** Stale game-parity: the current game computes convertRate = (game.talents.nature.purchased) ? 8 : 5 in BOTH naturePurchase 'convert' (../trimps-game/main.js:8551) and the tooltip (:8438); nature2 (config.js:2286) only adds 5 Upgrade/Transfer levels and has no effect on the trading ratio. The fork's three-tier formula nature.purchased ? (nature2.purchased ? 8 : 6) : 5 matches an OLD game where nature I gave 6 and nature II gave 8. Fix: convertRate = game.talents.nature.purchased ? 8 : 5.

### `src/modules/nature.ts:43` — **MEDIUM** · game-parity-drift

- **Breaks:** Same stale convert-rate formula in the 'Convert to Both' branch: with Natural Diplomacy I but not II, each of the two target empowerments is credited 6 tokens instead of 8 while 20 tokens are spent, under-crediting game state by 2 per target (4 per tick) versus the game's own convert button.
- **Fix:** Identical drift to line 56. The current game uses (game.talents.nature.purchased) ? 8 : 5 (../trimps-game/main.js:8551); nature2 does not affect the trading ratio. The literal 6 for the nature-I-only case no longer matches the game. Fix: convertRate = game.talents.nature.purchased ? 8 : 5.

### `src/modules/perks.ts:1391` — **MEDIUM** · game-parity-drift

- **Breaks:** In universe 2, when the Championism perk is unlocked and the user selects any built-in Zek preset (Zek z1-59 / Melt / Quag) then clicks Allocate Perks, the Championism ratio input box displays the literal string 'undefined' and Championism is not ratio-allocated (it never competes correctly in the efficiency priority queue).
- **Fix:** Championism is constructed with preset value-index 14 (new RAutoPerks.VariablePerk("championism", 1000000000, true, 14, 0.1)), but every RpresetList array (preset_Rspace/RZek059/RZekmelt/RZekquag, lines 756-759) has only 14 elements (indices 0-13). getRatiosFromPresets pushes RpresetList[i][14] = undefined for all presets, so championism.value is all-undefined. setDefaultRatios sets the box to undefined, updatePerkRatios does parseFloat('undefined') = NaN, calculateIncrease returns NaN, efficiency = NaN, so the perk is added to the queue (NaN != 0) but can never sort correctly (NaN comparisons are false). Championism is a real v5.10.1 perk (config.js:3022, priceBase 1e9, specialGrowth 5) with its own UI box (line 825); the preset arrays and the index comment on line 755 predate it and were never extended. Fix: append a 15th element (a real ratio, or 0) to each RpresetList array.

### `src/modules/stance.ts:133` — **MEDIUM** · game-parity-drift

- **Breaks:** On the Electricity challenge (not Mapocalypse), the survival calc omits the electricity drain (stacks*0.1 of maxHealth per turn), so survive() over-estimates survivability and autoStance/scryer can keep the army in a lethal stance / proceed as 'safe' when it isn't.
- **Fix:** challengeActive("Electricty") is misspelled — the game's challenge is named "Electricity" (../trimps-game/main.js:11361,16093) and challengeActive does exact-string matching (game.global.challengeActive == what || multiChallenge[what]), so this branch is always false. electricityChallenge therefore only fires for Mapocalypse, and during a pure Electricity run the drain damage is never added to harm in challengeDamage(). Faithful to legacy but wrong vs current game.

### `src/modules/stance.ts:63` — **MEDIUM** · game-parity-drift

- **Breaks:** maxOneShotPower mispredicts overkill targets under uber empowerments: with uber Ice active it under-counts by 2, with uber Poison active it over-counts by 2. This propagates through oneShotPower into scryer stance selection (scryer.ts:146-150) and one-shot/map decisions.
- **Fix:** The current game grants the +2 overkill for uber ICE — getOverkillerCount (../trimps-game/main.js ~12037) adds 2 when getUberEmpowerment()=="Ice", and getUberEmpowerment() returns game.global.uberNature. The fork checks game.global.uberNature=="Poison" instead of "Ice" (the block is even commented //Ice, and Poison uber grants no overkill in the current game). Faithful to legacy but diverges from current game math.

### `src/modules/ab.ts:157` — **LOW** · other

- **Breaks:** With RABfarmswitch ('Switch') enabled but no farm string ever saved (RABfarm off / fresh profile), RABfarmstring is still its default string '-1'. ABfarmswitch treats it as an array: line 157-158 read '-1'[0] = '-' and set autoBattle.enemyLevel = '-' (corrupting the level to a non-number), then line 165 reads '-1'[2] = undefined and calls .indexOf(item) on it, throwing a TypeError that aborts the automation tick.
- **Fix:** ABfarmswitch is missing the sentinel guard that ABfarmsave has. ABfarmsave (line 147) checks `getPageSetting('RABfarmstring') == "-1"` before using it, but ABfarmswitch unconditionally indexes the value as [0]/[2]. Since RABfarmswitch and RABfarm are independent boolean settings (settings-defs.ts:840-841) and the tick loop (AutoTrimps2.js:308) calls ABfarmswitch() whenever Switch is on, the '-1' default is reachable. Faithful to legacy, but a genuine concrete crash/corruption path.

### `src/modules/heirlooms.ts:470` — **LOW** · coercion-compare

- **Breaks:** The Radon shield/staff equip guards `if (Rhsshield1() != "undefined" && …)` (also 476,482,488,494,500,507,513,519,526) are always true even when no matching heirloom is carried, so they attempt to equip a nonexistent loom.
- **Fix:** Coercion-compare defect. The finder functions (Rhsshield1 etc.) return either a heirloom OBJECT or the value `undefined` (implicit fall-through) — never the string literal `"undefined"`. So `<object|undefined> != "undefined"` is always true, unlike the non-Radon siblings (lines 217/223/229/235) which correctly test `!= undefined` (the value). This is distinct from the legitimate `getPageSetting('Rhsworldstaff') != "undefined"` checks (545/548) where a text setting's default really is the string "undefined". Concrete input: user configures Rhs1 but carries no matching heirloom → Rhsshield1() returns undefined, but `undefined != "undefined"` is true → the block runs anyway. Overshadowed by the bare-`loom` crash on the same lines, but a genuine independent always-true comparison; the correct sentinel is the value `undefined`.

### `src/modules/mapfunctions.ts:457` — **LOW** · wrong-variable

- **Breaks:** In RfragCheck(), the `what == 'hypo'` branch assigns `sepcial = "lwc"` (misspelled), writing the module-global `sepcial` instead of the local `special`; the local `special` stays "fa", so the hypo frag-map affordability cost is computed with the wrong map special.
- **Fix:** `sepcial` is a published globalThis var (line 14), so the write does not throw but is a no-op for this function; the intended local is `special` (declared line 433, passed to RminFragMap at line 467). Concrete: Rhypofarmfrag enabled → RfragCheck('hypo') computes cost via RminFragMap(selection, levelzones, 'fa') instead of 'lwc', while the real hypo map (RhypoMap, lines 2184/2188/2192) is built with 'lwc'; the two map specials have different fragment costs, so the affordability gate can pass/fail out of sync with the map actually created.

### `src/modules/maps.ts:1314` — **LOW** · game-parity-drift

- **Breaks:** In the radon auto-map loop, the 'Dimension of Rage' unique map's Unlucky-challenge exemption is dead: while running the Unlucky challenge at world < 16 (or RcalcHDratio() < 2), the map is skipped via `continue` even though the guard was meant to keep running it during Unlucky.
- **Fix:** `game.global.challenge` (singular) does not exist on game.global (only game.global.challengeActive, config.js:102), so `game.global.challenge != 'Unlucky'` evaluates undefined != 'Unlucky' = always true, collapsing the guard to `(world < 16 || RcalcHDratio() < 2) => continue` regardless of challenge. Two lines below (1325, 1330) correctly use game.global.challengeActive. Fix: game.global.challengeActive != 'Unlucky'. Faithful-ported upstream typo (present in legacy oracle d283f152:legacy/modules/maps.js:1299).

### `src/modules/nature.ts:29` — **LOW** · game-parity-drift

- **Breaks:** The Transfer branch continues upgrading while empowerment.retainLevel >= 80+thresh, adding the token-reserve setting 'thresh' (units: tokens) to the retain-level cap (units: levels, hard-capped at 80 by the game). With a user-set positive tokenthresh (e.g. 10) and retainLevel already at 80, the automation directly does empowerment.retainLevel++ and pushes retainLevel to 90 — past the game's hard cap. The game's own naturePurchase('stackTransfer') refuses at retainLevel >= 80 (../trimps-game/main.js:8560), so this desyncs and over-spends tokens into levels the game caps.
- **Fix:** Unit-mismatched copy of the token-reserve 'thresh' pattern applied to the 80 level cap; faithful to legacy and harmless at the default thresh=0, but any positive tokenthresh lets the automation exceed the game's retainLevel cap of 80. Cap should be a bare 80 to match the game.

### `src/modules/perks.ts:31` — **LOW** · off-by-one

- **Breaks:** In universe 1, selecting the 'Zeker0 (z230-299)' or 'Zeker0 (z300-399)' ratio preset leaves the Classy ratio box showing 'undefined' (not 0), and Classy gets a NaN efficiency so it is not ratio-allocated when Allocate Perks is clicked with those two presets.
- **Fix:** preset_Zek299 (line 31) and preset_Zek399 (line 32) each contain only 13 elements, whereas every other U1 preset and the index comment on line 25 use 14. Classy is assigned preset value-index 13 (line 681), so classy.value[4] (Zek299) and classy.value[5] (Zek399) are undefined instead of 0. All other presets explicitly set classy to 0 at index 13 (e.g. preset_Zek449 line 33), showing 0 was intended; these two arrays are simply one trailing element short. Fix: add the missing trailing 0 to both arrays.

### `src/modules/scryer.ts:66` — **LOW** · operator-precedence

- **Breaks:** With ScryUseinWind (or ScryUseinIce) set to 0 or a positive zone threshold, scrying is silently disabled inside maps during Wind/Ice empowerment (and never_scry is forced even when UseScryerStance is off), because never_scry is set true regardless of map state; line 82 then early-returns before the map-scry force block at lines 89-94 is evaluated.
- **Fix:** Operator precedence: the parallel 'force' clause at line 94 wraps the three empowerment sub-clauses in an outer paren (!MA && USS && (Poison || Wind || Ice)), but line 66 omits it, so && binds first and it parses as (USS && !MA && Poison) || Wind || Ice — the Wind and Ice clauses are NOT gated by USS && !MA. The empowerment-scry settings are meant to apply on the world map only (as the force clause enforces), so the missing parentheses let them fire in maps and while scryer stance is disabled.

