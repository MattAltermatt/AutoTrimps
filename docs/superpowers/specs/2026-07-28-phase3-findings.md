# Phase 3 Findings — the modules the proof net cannot see

**Date:** 2026-07-28 · Part of the [exhaustive logic review](../plans/2026-07-28-exhaustive-logic-review.md)

## Why these modules

The proof net is a differential over ten native game mutators. None of the modules below terminates
in one of them, so **a green test suite was never evidence about any of this code** — the net
structurally cannot see it. Several had no unit tests at all. This is the residue Phases 0-2 cannot
reach, reviewed by reading, with every finding required to survive a reproduction pass.

## Method, and how much to trust the number

8 finder agents produced 40 raw findings; 37 went to a reproduction agent whose brief was to work
the case numerically and name the strongest reason the finding was *not* a bug. **35 confirmed, 2
refuted.** After collapsing two duplicate reports (the same defect filed once with an absolute path
and once repo-relative), **33 distinct findings** remain.

A 95% confirmation rate should not be taken at face value — the previous review's skeptic layer
passed 95% and was worthless. So the HIGH findings were re-checked by hand against the game clone.
That spot-check confirmed the defects but **corrected one rationale**: the nature finding claimed
the game lacks a `nature2` talent, when it has one (`config.js:608`) that grants +5 level and +5
retain and simply has nothing to do with conversion rate. The defect stands; its stated reason did not.

Counts, stated honestly: **33 distinct findings — 8 HIGH, 18 MEDIUM, 7 LOW.** Not 35, not 40.

---

## HIGH

### ABdustsimple ranks two currencies on one number and only ever tries the winner — shard items always win, so dust upgrades stall (and shards burn on `noUpgrade` items)

`src/modules/ab.ts:118`

**Trigger.** U2, RAB on, RABdustsimple = 1 ("SD: Equipped") or 2 ("SD: Non-hidden"). Sharpest deterministic case: player has completed the Doppelganger_Signet contract (SA item, zone 190) and has it equipped at level 1, and `autoBattle.shards < 5`. A player who just paid the contract is exactly in that state — contractPrice(190) = 100*1.2023^115/1e9 = 159.0 shards.

**Actual.** `equips` collects `[name, autoBattle.upgradeCost(name)]` for every equipped item and sorts ascending on the raw number. `upgradeCost` returns the price in the ITEM's own currency (objects.js:3650-3658), but line 118 gates on `autoBattle.dust` only and attempts `equips[0]` and nothing else. Doppelganger_Signet has neither `startPrice` nor `priceMod`, so its level-1 cost is 5*3^0 = 5 SHARDS — the smallest number in the whole 54-item table (only Menacing_Mask/Sword/Armor/Pants tie at 5 dust, and those are past 5 after two upgrades). So `equips[0]` is the shard item forever, `dust >= 5` is trivially true at that depth, and `autoBattle.upgrade()` returns at its own `if (currency < cost) return;`. No dust item is ever attempted again — the ranking is a pure function of state, so the same loser is re-picked every tick. When the player DOES have shards, the opposite happens: AT spends them levelling Doppelganger_Signet / Doppelganger_Diadem, which the game marks `noUpgrade: true` and renders as a grey "Unupgradable" button (objects.js:4325) — `autoBattle.upgrade()` has no `noUpgrade` guard, and neither item's `doStuff()` reads `this.level`, so the shards buy literally nothing. Ladder: 5, 15, 45, 135, 405, 1215 shards.

**Expected.** Compare each candidate against the currency it is actually priced in (`autoBattle.items[name].dustType == 'shards' ? autoBattle.shards : autoBattle.dust`), skip `noUpgrade` items, and fall through to the next affordable candidate instead of committing to `equips[0]`.

---

### ABfarmswitch indexes RABfarmstring as an ARRAY, but any user edit of that textValue stores a STRING — it then blanks and hides the entire SA loadout and resets combat every tick

`src/modules/ab.ts:175`

**Trigger.** RAB + RABfarmswitch on, and the RABfarmstring value is a string rather than AT's own array. Reached by (a) pasting a shared string — the tooltip advertises "Safe to share with other AT users. If you paste in someone else's string, set the second value (the dust figure) to 0" — or, more easily, (b) opening the String control and pressing Apply at all: `autoSetText` writes `textBox.value`, a raw string, back into `.value` (settings-engine.ts:477-485), and `autoSetTextToolTip` pre-fills that box with AT's own array stringified (settings-engine.ts:409).

**Actual.** Line 173 only rejects the exact sentinel `"-1"`, so any other string proceeds. Line 175/176 read `[0]` — the FIRST CHARACTER — so "12,5000,Rusty_Dagger,..." yields "1" and AT assigns `autoBattle.enemyLevel = "1"` (a string) and calls `resetCombat(true)`. Line 183/189 read `[2]` — the third character, e.g. "," — so `",".indexOf(item)` is -1 for every equipped item, `match` becomes true, and the apply block runs: it sets `equipped = false` on ALL items and (because `autoBattle.settings.loadHide.enabled` defaults to 1) sets `hidden = true` on every OWNED item; then `plength = 1` and `autoBattle.items[","]` is undefined so the `continue` fires and nothing is re-equipped or un-hidden. `autoBattle.resetCombat(true)` runs at line 201. This repeats every tick: the player is left with zero items equipped and their whole owned item list hidden (hidden is persisted via `saveItem.hidden`), and combat restarts from full enemy health forever. ABfarmsave cannot self-heal it either: `getPageSettingAt('RABfarmstring', 1)` returns a character, `"," < bestdust` is a NaN comparison (false), and `resetCombat(true)` → `resetStats()` zeroes `sessionEnemiesKilled` every tick so the `> 8` guard at ab.ts:165 can never pass.

**Expected.** Reject any non-array value (or parse a pasted string with `.split(',')` into [level, dust, ...items]) before indexing. The tooltip promises shared strings work; the code only works on the array AT writes itself.

---

### HeirloomShieldSwapped's rarity<10 early return permanently latches a stale gammaBurstPct after any swap DOWN

`src/modules/heirlooms.ts:448`

**Trigger.** Any shield swap from a rarity>=10 shield to a rarity<10 shield. All of AT's own swap paths do this: stance.ts:277-339 lowHeirloom()/highHeirloom()/dlowHeirloom()/dhighHeirloom() (Windstack 'WS: Low Damage' / 'WS: High Damage'), Rhsequip1/Rhsequip2 (U2 'HS: First'/'HS: Second' at the HS: Zone threshold), and portal.ts:254-255/508-509, which calls highHeirloom() unconditionally after EVERY portal. Nothing constrains either named shield to rarity>=10.

**Actual.** HeirloomShieldSwapped() is the ONLY refresh path for the globals `gammaBurstPct` and `shieldEquipped` (the only other writer is the one-shot boot init at main-loop.ts:156 — verified by grep: no other assignment exists in src/). Line 448 returns before BOTH assignments, so after equipping a rarity<10 shield gammaBurstPct keeps the previous (Hazardous+) shield's value forever, and `shieldEquipped` never advances — so main-loop.ts:226/440's guard `shieldEquipped !== game.global.ShieldEquipped.id` stays true and re-calls the no-op every tick, never healing. calc.ts:359-360 (and 364-365, 1283-1284, 1288-1289) then does `if (gammaBurstPct > 0 && ...) number *= (gammaBurstPct + 1) / 5`, inflating the damage estimate by a factor the player no longer has.

**Expected.** Set gammaBurstPct from the CURRENT shield's actual bonus (0 when there is none) and latch shieldEquipped on every swap. The #49 fix correctly stopped crediting gammaMult to low-rarity shields, but by early-returning it also stopped CLEARING the previous credit — the guard needs to zero the value, not skip the update.

---

### miRatio inverts the user's Magmite weights — Ratio Spending buys the LEAST-weighted upgrade

`src/modules/magmite.ts:56`

**Trigger.** `ratiospend` ON (settings-defs.ts:2421) + `spendmagmite == 2` (main-loop.ts:264) or a portal spend (portal.ts:235), with any two ratio weights unequal. Example: effratio=10, capratio=90, supratio=-1, ocratio=-1.

**Actual.** Lines 43-46 compute each upgrade's ACTUAL share as `(spent/total)*100`, but lines 56-59 compute the user's TARGET as `(totalspend / spend) * 100` — the RECIPROCAL of the share. Lines 62-65 subtract one from the other and line 76-79 buys the max, so a larger weight produces a SMALLER `*spendr` and therefore a smaller `*final`. Simulated 400 purchases from zero: weights eff10/cap90 → 100.0% of Mi spent on Efficiency, 0.0% on Capacity; weights eff90/cap10 → 0.0% Efficiency, 100.0% Capacity. The 50/50 case is the only one that looks right (50.1/49.9), which is why it has gone unnoticed.

**Expected.** Target share should be `(spend / totalspend) * 100` so it is comparable to the actual share on lines 43-46. With that, eff10/cap90 converges to ~10%/~90%. The setting tooltip promises exactly this: "Set Efficiency / Capacity / Supply / Overclocker below to the relative weight you want each to get" (settings-defs.ts:2425) and "Relative weight for Efficiency when Ratio Spending is on" (2428).

---

### gammaBurstPct's "no Gamma Burst" sentinel is 1, but calc.ts guards on `> 0` — every player without a gamma shield gets a 0.4x damage estimate

`src/modules/main-loop.ts:156`

**Trigger.** Any page load where the equipped Shield has no Gamma Burst — i.e. rarity < 9, or rarity 9-12 without the gammaBurst mod rolled, or no shield at all — AND calcOurHealth()/calcBadGuyDmg(...) >= 5 (the normal state for a healthy AT run). This is the majority case: config.js:8158 gives gammaBurst `steps: [-1 x9, [1000,2000,100], -1, -1, -1]`, so the mod can only roll on rarity 9, and the innate version only exists at rarity >= 10 (main.js:6920).

**Actual.** `gammaBurstPct = (getHeirloomBonus("Shield","gammaBurst") / 100) > 0 ? (.../100) : 1` — the false arm mints **1** as the "there is no gamma burst" sentinel (heirlooms.ts:449 repeats the same expression verbatim). calc.ts:359 tests `gammaBurstPct > 0`, which the sentinel passes, then does `number *= (gammaBurstPct + 1) / 5` = (1+1)/5 = **0.4**. So AT's own damage model reports 40% of the player's real damage whenever they are tanky enough to survive 5 hits. Same at calc.ts:364 (Burstier: (1+1)/4 = 0.5) and at the U2 twins calc.ts:1283/1288.

**Expected.** Either the sentinel should be 0 (getHeirloomBonus already returns 0 for "no gamma burst", so the ternary is what creates the problem) or the consumer's guard should be `> 1`. Every real reading is far from 1 — a rarity-9 roll gives 1000-2000% -> 10..20, and rarity>=10 gives >= 24000% -> >= 240 — so 1 is unambiguously a sentinel that the `> 0` test cannot distinguish from a live value.

---

### nature.ts:57 still uses the pre-#22 convert rate (6) that the game does not have — #22 fixed only the sibling copy 13 lines above

`src/modules/nature.ts:57`

**Trigger.** `AutoPoison`/`AutoWind`/`AutoIce` set to any single-target "Convert to X" (the shipped 550 preset defaults AutoWind and AutoIce to "Convert to Poison", utils.ts:54), with `game.talents.nature.purchased === true` and `game.talents.nature2.purchased === false` — i.e. every player who owns Natural Diplomacy I but not II.

**Actual.** `var convertRate = (game.talents.nature.purchased) ? ((game.talents.nature2.purchased) ? 8 : 6) : 5;` — AT credits the target nature 6 tokens for the 10 it just deducted at line 56. Because autoNatureTokens mutates `game.empowerments[targetNature].tokens` DIRECTLY rather than calling native `naturePurchase('convert', …)`, the 2 missing tokens are destroyed, every conversion, every tick the branch runs.

**Expected.** 8, matching the game: `.trimps-game/main.js:8551` reads `var convertRate = (game.talents.nature.purchased) ? 8 : 5;` — the same expression already corrected in the 'Convert to Both' branch at nature.ts:44 by commit da366a3d with the comment "Parity fix (#22): game uses 8:5, nature2 has no effect on trade ratio." The setting tooltip also promises the game rate: "trades Poison tokens for the other nature at whatever rate your Nature talents give you" (settings-defs.ts:2804).

---

### PraidHarder abandons the raid when it CAN afford a prestige map, because the target defaults to +10 — in the shipped default configuration it buys nothing at every praid zone and logs "can't afford to"

`src/modules/other-praiding.ts:1283`

**Trigger.** `PraidHarder` (or `dPraidHarder` on a Daily) ON, `Praidingzone` contains the current world, and `MaxPraidZone` / `PraidFarmFragsZ` / `PraidBeforeFarmZ` all left at their shipped default `[-1]` (settings-defs.ts:1668/1673/1678). Example: world 495, Praidingzone [495]. The loop at :1269 finds an affordable +6 prestige map (zone 501) and breaks with curPlusZones=6.

**Actual.** `maxPlusZones` is forced to 10, so `maxPlusZones > curPlusZones` at :1280 sets `shouldFarmFrags = true`. :1283 `if (curPlusZones >= 0 && (praidBeforeFarm || shouldFarmFrags == false))` is then false (praidBeforeFarm is false — `[-1].includes(495)` is false), so the affordable map found at :1275 is never bought. Control falls to `else if (!farmFragments)` at :1298, which latches `failpraid = true` and prints `"Failed to prestige raid. Looks like you can't afford to."` — a statement `relaxMapReqs()` just proved false. Combined with the already-filed idx 19 (this same branch never restores AutoMaps), the run is left with map automation off.

**Expected.** When `relaxMapReqs()` succeeds at a curPlusZones below the target and fragment farming is not permitted for this zone, buy the map that was found — which is what the master setting's own tooltip promises: "Always buys the highest-prestige map it can afford at each P Raiding zone, farming fragments for it if it can't" (settings-defs.ts:1665). At minimum the failure message must not claim unaffordability when an affordable map was located.

---

### U2 AutoPerks respec permanently zeroes Masterfulness, Smithology and Expansion

`src/modules/perks.ts:1299`

**Trigger.** Universe 2, `RAutoAllocatePerks == 1`, `game.global.canRespecPerks` true (the normal state at a portal), the player has >0 radLevel in any of Masterfulness / Smithology / Expansion, and RAutoPerks' fresh-from-zero re-optimisation lands any managed perk BELOW its current radLevel (which sets `needsRespec` at perks.ts:1331).

**Actual.** `RAutoPerks.perkHolder` (perks.ts:1456) lists 22 perks. The pinned clone's `game.portal` has 26 entries carrying `radLevel`. Overkill is force-`radLocked` by the 5.4.0 migration (main.js:975) so it is correctly filtered, but **Masterfulness, Smithology and Expansion** are unlockable U2 perks that AT does not model. `RAutoPerks.getOwnedPerks` (perks.ts:1507-1508) resolves them to `undefined` and `continue`s, so they are absent from the `perks` array handed to `applyCalculationsRespec`. That function calls native `clearPerks()` (perks.ts:1299), which sets `levelTemp = -getPerkLevel(item)` for EVERY unlocked U2 perk (main.js:3367-3377), then re-buys only the 22 in `perks`. The three unmanaged perks keep `levelTemp = -radLevel`, and `activatePortal()` -> `commitPortalUpgrades(true)` (main.js:4015, 3554: `radLevel += levelTemp`) commits them to 0. The respec is one-per-run and irreversible. Second-order effect from the same root: `RAutoPerks.getRadon()` (perks.ts:1065-1070) DOES add those three perks' `radSpent` to the budget, so even without a respec AT over-plans by exactly that amount and the tail purchases fail silently inside `buyPortalUpgrade`'s `canSpend >= price` check.

**Expected.** Either model the three perks in `perkHolder`, or have `applyCalculationsRespec` restore any unlocked perk it did not plan for (and exclude unmodelled perks' `radSpent` from `getRadon()`'s budget). The U1 twin is safe only by coincidence — `AutoPerks.perkHolder` happens to enumerate exactly the 29 `level`-bearing entries in `game.portal`, and `AutoPerks.getOwnedPerks` (perks.ts:779-787) has no `undefined` guard at all, so the same drift in U1 would throw instead of silently wiping.

---

## MEDIUM

### `advPerfectCheckbox.checked = …` is inert — the game reads `dataset.checked`, so PraidHarder's perfect→imperfect fragment-map fallback can never lower the price (2.22× cost)

`src/modules/other-praiding.ts:1334`

**Trigger.** U1, Hardcore P Raiding (`PraidHarder` ON) at a zone listed in both `Praidingzone` and `PraidFarmFragsZ`, with the game's Perfect-Sliders checkbox currently ticked (`data-checked="true"` — set by the player clicking it, or by `resetAdvMaps()` restoring a map preset whose `perf` is true, main.js:6134). AT reaches the fragment-farm block at lines 1315-1346 and cannot afford the perfect-priced map.

**Actual.** Line 1321 writes `byId('advPerfectCheckbox').checked = true` and line 1334 writes `.checked = false`. `advPerfectCheckbox` is a `<span>` (index.html:897), not an `<input>`, so `.checked` is a JS expando the game never reads. The game reads `readNiceCheckbox(elem)` → `elem.dataset.checked == "true"` (updates.js:1958-1960) via `checkPerfectChecked()` (main.js:6303-6308). Both `updateMapCost(true)` calls (lines 1325 and 1335) therefore return the IDENTICAL number, so the documented imperfect fallback is dead: AT logs `"Can't afford fragment farming map yet"` and re-tries forever at the perfect price. In the mirror case (`data-checked="false"`, the default) AT logs `"Buying perfect sliders fragment farming map"` while buying an imperfect one, so the map — whose whole purpose is fragment loot (`advSpecialSelect='fa'`, `lootAdvMapsRange=9`) — gets randomized loot instead of `max` (main.js:6563-6566).

**Expected.** Drive the state the game actually reads, i.e. `swapNiceCheckbox(byId('advPerfectCheckbox'), true|false)` (updates.js:1932-1943, which sets `data-checked`/`aria-checked` and swaps the icon class). Then the two `updateMapCost(true)` calls differ and the fallback works.

---

### `BWraidingmax`'s shipped `[-1]` default makes `targetBW = -1`, so `findLastBionic().level > targetBW` is always true — BW Raiding logs "Successfully BW raided!" without raiding anything

`src/modules/other-praiding.ts:1420`

**Trigger.** `BWraid` ON, `BWraidingz` set to a real zone (e.g. `[597]`), `BWraidingmax` left at its shipped default `[-1]` (settings-defs.ts:1696-1698) — or set shorter than `BWraidingz`, so `getPageSetting(bwraidMax)[bwIndex]` is `undefined`. Identical for the daily twin (`dBWraidingmax`, default `[-1]`, settings-defs.ts:358-361).

**Actual.** Line 1420-1421 sets `targetBW = -1` for the missing-entry case, and reads the literal `-1` straight through for the default case. Bionic Wonderland levels are `tier*15 + 125` ≥ 125 (config.js:9810), so line 1448 (`findLastBionic().level <= targetBW`) is false and `runMap()` never fires, while line 1457 (`findLastBionic().level > targetBW`) is true on the very first tick → `bwraided = true`, `bwraidon = false`, `debug("...Successfully BW raided!")`. Net effect per raid zone: AT sets `AutoMaps` to 0, clobbers `climbBw` to 0, enters the Map Chamber, prints "Beginning BW Raiding..." then immediately "...Successfully BW raided!", restores AutoMaps, and acquires zero prestige gear. `bwraidon` never latches, so `buyWeps()` (main-loop.ts:410) never runs either.

**Expected.** Treat `-1`/missing as "no ceiling", the way the sibling `MaxPraidZone` path 200 lines above already does — line 1219-1223 explicitly rescues the same `[-1]` default (`maxPlusZones < 0 ? 10 : …`). A no-ceiling `targetBW` should be `Infinity` (or the check inverted), not `-1`, and a genuinely unraidable state should not print a success message.

---

### `buyMap()`'s return value is ignored — when the buy is refused, AT captures a PRE-EXISTING map's id as its "newly bought" praid map, then runs and recycles it

`src/modules/other-praiding.ts:1019`

**Trigger.** `game.global.mapsOwnedArray.length >= 100` (the game's own hard map cap) when AT enters a `Praidingzone` zone in the Map Chamber with enough fragments. Reachable because `Praiding()` buys up to 5 maps per raid zone and only recycles them inside the `getPageSetting('AutoMaps') == 0` branch at line 1138 — a user on AutoMaps option 2 leaks 5 maps per raid zone — and because void maps also live in `mapsOwnedArray`.

**Actual.** Lines 1015-1021 do `if (updateMapCost(true) <= game.resources.fragments.owned) { buyMap(); mapbought5 = true; if (mapbought5) { pMap5 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id; … } }`. `buyMap()` returns `-2` WITHOUT calling `createMap` and WITHOUT deducting fragments when `mapsOwnedArray.length >= 100` (main.js:6597-6600). AT never inspects the return, so `mapboughtN` is set true and `pMapN` is bound to the id of a map the player already owned. Because fragments are not deducted, the next four affordability checks also pass and pMap1..pMap5 all bind the SAME pre-existing id. AT then `selectMap`/`runMap`s that map on five successive Map-Chamber returns, and finally `recycleMap(getMapIndex(repMap1))` at line 1142 splices the player's own map out of `mapsOwnedArray` (main.js:10730) while logging `debug("Prestige raiding successful!")` — with zero prestige acquired. Same shape at line 1286 (`PraidHarder`), 1328/1338 (`fMap`), and 1522/1534/1546/1558/1570 (`dailyPraiding`).

**Expected.** Branch on the return value — `buyMap()` returns `1` on success and `-1`/`-2`/`-3` (or `undefined`) on refusal — and only then set `mapboughtN` / capture `mapsOwnedArray[len-1].id`. On refusal, take the existing "could not afford" failure path instead.

---

### ABsolver levels and gates on items the player does not OWN — the dust is destroyed by the game's own save, and phantom levels open the next progression gate

`src/modules/ab.ts:410`

**Trigger.** RAB + RABsolve on with `autoBattle.maxEnemyLevel == 9` and `autoBattle.items.Comfy_Boots.owned == false` (reachable: SA level 9 needs 80 level-8 kills, while Comfy_Boots needs a 913-dust contract PLUS a completed U2 z87+ void map — case 9 explicitly anticipates this at ab.ts:406-408 by setting `contract = 'Comfy_Boots'`). Same shape via the generic "Level items" loop at ab.ts:526-530 for any tier whose target list names an item not yet contracted (e.g. case 6 names Putrid_Pouch/Chemistry_Set).

**Actual.** Line 410-412 runs `if (autoBattle.items.Comfy_Boots.level < 3) autoBattle.upgrade('Comfy_Boots');` with no `owned` check, two cases after the SAME upgrade is correctly guarded by `if (autoBattle.items.Comfy_Boots.owned)` at ab.ts:394. `autoBattle.upgrade()` has no owned guard either, so AT spends 430 + 1290 = 1720 dust levelling an item the player does not have. `autoBattle.save()` then drops the item entirely (`if (!thisItem.owned) continue;`) and `autoBattle.load()` resets `thisItem.level = 1`, so every one of those levels is destroyed on the next page load and re-bought next session. Worse, line 414 gates on exactly that phantom level: `if (autoBattle.items.Comfy_Boots.level >= 3 && autoBattle.bonuses.Extra_Limbs.level < 2)` → `autoBattle.buyBonus('Extra_Limbs')`, so a readiness check meant to say "Comfy Boots is levelled" is satisfied by levels on an unowned item that cannot be equipped and contributes nothing to combat.

**Expected.** Guard every `autoBattle.upgrade(x)` and every `proceed`/readiness comparison on `autoBattle.items[x].owned`, matching the case-8 branch at ab.ts:394.

---

### ABfarmsave's "best-ever" scoreboard is never flushed to localStorage — it is lost on reload unless the user happens to click some other setting

`src/modules/ab.ts:166`

**Trigger.** RAB + RABfarm on. AT records a new best dust/s string, the player reloads the page (or the browser restores the tab) without having clicked any other AT setting control in between.

**Actual.** `setPageSetting` only mutates the in-memory `autoTrimpSettings[setting].value` (utils.ts:141-142); it never writes localStorage. The single writer is `saveSettings()` (utils.ts:159-162, the only caller of `safeSetItems('autoTrimpSettings', serializeSettings())`), and ab.ts never calls it — nor does main-loop.ts. All seven `saveSettings()` call sites are user-driven UI handlers (settings-engine.ts:375/473/489, settings-menu.ts:295, MAZ.ts:612, import-export.ts:269/935). So the recorded best level+loadout survives only until the tab is reloaded, silently, with no signal to the user. The setting's own tooltip calls it a scoreboard of the "best-ever Auto Battle dust/s".

**Expected.** Call `saveSettings()` after the `setPageSetting('RABfarmstring', string)` writes at ab.ts:160/166 (the same flush every other write path to a persisted setting performs).

---

### The fast-imp branch has its `cell.special.length === 0` guard commented out, so it destroys the game's upgrade/loot icon on any fast-imp cell

`src/modules/fight-info.ts:153`

**Trigger.** `EnhanceGrids` on, and any world or map cell that both carries a special (an upgrade / resource drop, i.e. `cell.special !== ''`) AND rolled one of the 12 fast imps — Snimp, Kittimp, Gorillimp, Squimp, Shrimp, Chickimp, Frimp, Slagimp, Lavimp, Kangarimp, Entimp, Carbimp. Example: zone 5+ world cell index 4, which `worldUnlocks.Shield` (level 4) claims, if its `getRandomBadGuy` roll is Snimp.

**Actual.** Six of the seven glyph-writing sites in this file gate the innerHTML overwrite on `if(cell.special.length === 0)` (lines 123, 133, 143, 164, 173, 182) — precisely so the game's own loot icon is not clobbered. Line 153 is the same guard commented out (`//if(cell.special.length === 0)`) with the body left behind, so line 154 runs unconditionally: `$cell.innerHTML = "<span class=\"glyphicon glyphicon-forward\"></span> ";`. The game stores the loot indicator as markup in `cell.text` (`findHomeForSpecial`, .trimps-game/main.js:10460-10464, writes `array[level].text = '<span class="glyphicon glyphicon-..."></span>'` alongside `array[level].special = item`) and renders it as the cell's innerHTML in `drawGrid` (main.js:10552). Replacing it drops the icon (and, for an empowerment/easter-egg cell, the `<span class="visually-hidden">Token of X</span>` / `Colored Egg` label the game appends at main.js:10527/10534). The user loses the "there is an upgrade here" cue for the rest of the zone, since fight-info never restores it.

**Expected.** Restore the guard so the fast-imp branch matches the other six sites: only write the chevron when `cell.special.length === 0`. AT's overlay should never overwrite information the game itself is drawing.

---

### RmanualLabor2's needToTrap compares population against the raw housing base `.max` instead of `realMax()`

`src/modules/gather.ts:230`

**Trigger.** Universe 2 with RManualGather2 = 1 or 2 (main-loop.ts:464) and ANY population multiplier above 1 in realMax(): Carpentry perk radLevel >= 1 (x1.1 compounding — unlocked in U2 by the Downsize challenge, settings-defs shows it is a normal U2 perk), or u2Mutations.tree.Trimps.purchased (x1.5), or autoBattle.bonuses.Scaffolding.level > 0, or an Elixir of Crafting. Fires as soon as `game.resources.trimps.owned` exceeds `game.resources.trimps.max`.

**Actual.** `(game.resources.trimps.max - game.resources.trimps.owned >= game.resources.trimps.max * 0.05)` uses `.max`, which is only the raw sum of housing (main.js:9959-9961 `addMaxHousing`: `game.resources.trimps.max += amt`). The real population cap is `realMax()` (config.js:8214-8228), which multiplies `.max` by maxMod, Carpentry, Carpentry_II, expandingTauntimp, Elixir of Crafting, Scaffolding and the U2 Trimps mutation. Population fills toward realMax(), so once owned > max the expression goes negative and this whole disjunct is dead for the rest of the run — with Carpentry radLevel 20 that happens at 1/6.727 = 14.9% of the real cap. `needToTrap` then collapses to only its second disjunct (`getCurrentSend() > owned - employed`), so the two trap branches at gather.ts:352 and gather.ts:356 stop firing except when the army literally cannot be filled.

**Expected.** `game.resources.trimps.realMax()`, exactly as the U1 twin does at gather.ts:48 (`const notFullPop = game.resources.trimps.owned < game.resources.trimps.realMax()`). The game itself uses realMax() for "is the town full" (main.js:9959, `var wasFull = (game.resources.trimps.owned == game.resources.trimps.realMax())`).

---

### The 'Start Fuel Z' tooltip tells the user to enter 230 to disable fueling; 230 makes AT fuel immediately instead

`src/modules/magmite.ts:226`

**Trigger.** `UseAutoGen` ON, world >= 230, `fuellater` set to 230 as the tooltip instructs (settings-defs.ts:2391: "Use 230 to just use your Before Fuel setting the whole time").

**Actual.** autoGenerator returns at line 201 for world < 230, and main-loop.ts:299 only dispatches it at world > 229, so `game.global.world >= 230` always holds inside the function. With fuellater = 230, line 218 (`fuellater < 1`) and line 222 (`world < fuellater`) are both false, so the before-fuel branches never run. Control reaches line 226 (or line 230 when fuelend < 1) and calls `changeGeneratorState(1)` = Gain Fuel from z230 onward — the opposite of what the tooltip promises. Even with fuelend = 230 the fall-through at line 234 applies `defaultgen` (the AFTER-fuel setting), never `beforegen`.

**Expected.** Either the tooltip should say that a value below 1 (e.g. the -1 default) is what keeps the Before Fuel mode for the whole run, or the code should treat fuellater == 230 as "never start fueling". Today no fuellater/fuelend combination produces the documented behaviour.

---

### New #162-class site the array-compare net cannot see: `game.global.world == getPageSetting('BWraidingz')` compares a number to a multiValue ARRAY, with the operands reversed

`src/modules/main-loop.ts:416`

**Trigger.** BW Raiding configured the way its own tooltip documents — a multi-entry list, e.g. `BWraidingz = [480, 495]` paired with `BWraidingmax = [500, 515]` — while inside a BW map in U1.

**Actual.** `getPageSetting` returns `Array.from(value).map(parseInt)` for a multiValue (utils.ts:64). `495 == [480,495]` coerces via ToPrimitive → `"480,495"` → `Number(...)` → `NaN` → **false**, and `500 <= [500,515]` is likewise false. So `buyWeps()` at this dispatch site never fires for any BWraidingz list with more than one entry — it only works by accident when the list has exactly one element. `BWraiding()` itself does the pairing correctly (`bwIndex = getPageSetting(bwraidZ).indexOf(game.global.world)` then `getPageSetting(bwraidMax)[bwIndex]`, other-praiding.ts:1419-1421), so this site is the odd one out.

**Expected.** Use the same index pairing BWraiding() uses: `.includes(game.global.world)` for the zone test and `[bwIndex]` for the max, so multi-entry lists behave as the tooltip describes.

---

### Quagmire preset sort is a no-op — its comparator returns `undefined` for every unequal-zone pair, so `Rbogs()` prefix-sums the amounts in row order instead of zone order

`src/modules/MAZ.ts:505`

**Trigger.** U2 Quagmire challenge, `Rblackbog` on. User opens the Quagmire Settings popup and enters two or more rows whose zones are NOT already in ascending row order (e.g. row0 = z70/40 bogs, row1 = z30/20, row2 = z50/10), then Saves.

**Actual.** `settingsWindowSave` branches: non-Quagmire windows get a real ascending sort (line 500-503), Quagmire gets `sort(function(a,b){ if (a.zone == b.zone) return (a.zone > b.zone) ? 1 : -1 })`. When `a.zone != b.zone` the function falls off the end and returns `undefined`; per ES SortCompare, `ToNumber(undefined)` is NaN which is coerced to +0, so every distinct-zone pair compares equal and the array is stored exactly as typed: `Rblackbogzone = [70,30,50]`, `Rblackbogamount = ['40','20','10']`. The consumer `Rbogs()` (src/modules/mapfunctions.ts:628-644) then does `bogindex = bogzone.indexOf(world)` and `for (i=0; i<bogindex+1; i++) stacksum += parseInt(bogamount[i])` — a prefix sum that only means "every LOWER zone" if the array is ascending. With the array unsorted, at z30 (index 1) stacksum = 40+20 = 60 so totalstacks = 40; at z70 (index 0) stacksum = 40 so totalstacks = 60. Both targets are wrong and the z70 tier is stricter than the z30 tier despite being later.

**Expected.** The Quagmire branch should sort ascending by zone exactly as the other 13 MAZ windows do — `return (a.zone > b.zone) ? 1 : -1` — so that the stored array satisfies the ordering invariant the consumer and the setting's own tooltip assume. (Cell is absent for Quagmire, so no tiebreak is needed.)

---

### Only `zone` is NaN-validated on save — an empty Cell box stores NaN, permanently disabling the preset, and the popup then redisplays it as 81

`src/modules/MAZ.ts:470`

**Trigger.** Any non-Quagmire MAZ window (Time Farm, Smithy, Tribute, Shrine, Insanity, Alch, Hypo, Praid). User selects the Cell box of a row and deletes its contents (or types something Chrome rejects into `type=number`, e.g. `5-`, leaving `.value === ""`), then clicks Save.

**Actual.** Line 428 does `cell = parseInt(byId('windowCell'+x).value, 10)` → NaN. The validation block that follows only guards `zone`: `isNaN(zone) || zone < 6` (470), `zone > 1000` (473), `zone + level < 6` (477 — false when level is NaN). The clamps at 484-485 are `if (cell < 1) cell = 1; if (cell > 100) cell = 100;` and NaN fails BOTH comparisons, so NaN survives unclamped into `autoTrimpSettings[cellKey].value[x]` (line 563). No error text is added, so line 509 does not return and the save completes silently. Read back, `getPageSetting` (src/modules/utils.ts:63-65) maps the array through `parseInt`, and NaN → NaN in-session, while a reload gives `JSON.stringify(NaN) === 'null'` → `parseInt(null)` → NaN as well. Every consumer gate is `game.global.lastClearedCell + 2 >= cell` (mapfunctions.ts:456, 497, 603), and `x >= NaN` is always false — so the preset row exists, looks configured, and never fires. Worse, reopening the popup renders `vals.cell = autoTrimpSettings[cell].value[x] ? ... : 81` (line 183) and NaN is falsy, so the UI displays **81** while the stored value is NaN — the user sees a valid-looking config that does nothing. The same hole exists for `level` (432/446/456/459/463): `level > 10` is false for NaN so it is stored unclamped too.

**Expected.** The per-row validation should reject a NaN `cell`/`level` the same way it rejects a NaN `zone` — append to `error` and `continue` — or coerce them to their documented defaults (81 for cell, 0 for level) before the clamps at 482-486. At minimum the clamp must be NaN-safe, e.g. `if (!(cell >= 1)) cell = 1;`, so what is persisted always matches what the popup redisplays.

---

### structureOn()/jobsMasteryOn() read only `.enabled`, so an ON-but-never-configured native automation is reported as 'running' and the badge invents a conflict

`src/modules/native-conflicts.ts:42`

**Trigger.** Player with roboTrimpLevel >= 3 (getHighestBionic() = 155 >= game.bwRewards.AutoStructure.requires) clicks the AutoStructure button ON but has never opened its cog/config popup. autoStructureSetting is then `{enabled: true}` with no per-building keys. AT's BuyBuildingsNew is at its default 1 ('Buy Buildings & Storage'). Identical shape for AutoJobs (roboTrimpLevel >= 2) with BuyJobsNew default 1.

**Actual.** structureOn() returns true, atBuysBuildings() returns true, the autoStructure row mounts a badge on the (now visible) #autoStructureBtn asserting 'Two building automations are running ... Both are buying right now, so your build queue and resources are being scheduled twice, to two different plans.' Native AutoStructure is in fact buying nothing.

**Expected.** The predicate should mirror the two gates the game itself applies before any purchase: `bwRewardUnlocked('AutoStructure')` / `bwRewardUnlocked('AutoJobs')`, and at least one enabled per-item sub-setting. Only then is 'both are buying' a true claim.

---

### The autoGolden row ignores native autoGoldenUpgrades()' Challenge-squared bail-out, so it claims a race with an automation that buys nothing

`src/modules/native-conflicts.ts:205`

**Trigger.** game.global.runningChallengeSquared === true (any Challenge²), native AutoGold left on mode 1 ('AutoGold Helium' / 'AutoGold Radon'), AT's cAutoGoldenUpgrades (or RcAutoGoldenUpgrades) set to Battle / Void / Void + Battle, and game.global.autoUpgradesAvailable true.

**Actual.** nativeGoldenPool() returns 'Helium', atGoldenChoices() returns e.g. ['Battle'], atGoldenDisagrees() is true, and the badge asserts 'both automations spend from the same count through the same purchase ... Whichever fires first on a given tick wins that golden, so you get an unpredictable mix of the two.' Native buys zero goldens for the whole Challenge², so there is no race and no mix. The recommendation 'To hand Golden Upgrades to the game, set AT's AutoGoldenUpgrades ... to Off' would leave nothing buying goldens at all.

**Expected.** nativeGoldenMode()==1 while runningChallengeSquared should be treated as 'native is not picking' (equivalent to Off), exactly as the -1/0 cases already are at line 131-133 — no badge.

---

### autoEnlight refuses to buy when the Enlightenment cost exactly equals the threshold, and the state never changes so it is a permanent no-op

`src/modules/nature.ts:108`

**Trigger.** `autoenlight` ON, world > 229, uberNature unset, and any of the six `*enlightthresh` values set to exactly the currently displayed Enlightenment cost — e.g. pfillerenlightthresh = 300 while Poison.nextUberCost is 300 and Poison.tokens >= 300.

**Actual.** Line 80 correctly computes affordability with `<=` (`nextUberCost <= threshold && nextUberCost <= tokens`), but line 82 stores the margin `threshold - nextUberCost`, which is 0 on an exact match, and line 108 gates on `fillernature[0].cost > 0` — strictly greater. So the exact-equality case falls to `nature = "None"` and nothing is purchased. Because `nextUberCost` only changes on a purchase (main.js:8576 `+= 150`) or at a Daily start (main.js:8589-8597), the state is frozen and AT never buys. Identical shape at lines 149 (daily) and 190 (C2).

**Expected.** Per the tooltip (settings-defs.ts:2824) "once its cost drops to or below this token threshold", an exact match must buy. The margin comparison should be `>= 0`, or the diff should carry a +1 offset, matching the `<=` used to compute affordability three lines earlier.

---

### AutoPerks hangs the browser forever when every queued perk hits its max

`src/modules/perks.ts:402`

**Trigger.** Any ratio configuration in which every UNLOCKED variable perk with a non-zero ratio has a finite `max`, plus enough resource that `calculatePrice(perk, max) <= remaining`. U1 capped variable perks: Overkill (max 30, needs ~2.6e9 He) and Classy (max 75, ~3.5e25 He). U2: Prismal (100), Tenacity (40), Greed (40). Reachable via the CUSTOM ratio row (e.g. an Overkill-only run).

**Actual.** `legacy/FastPriorityQueue.js:9` — `poll = function(){var b=this.array[0];return 1<this.size?(this.array[0]=this.array[--this.size],this._percolateDown(0)):0==this.size&&--this.size,b}` — decrements `size` only when `size > 1` or `size === 0`. At `size === 1` it returns `array[0]` WITHOUT removing it, so the queue never drains: `poll()` returns the same object forever and `isEmpty()` is permanently false. All four pass-1 loops (`for (iterateQueue(); price <= helium; iterateQueue())` at perks.ts:402, 491, 1145, 1234) drop a perk from the queue only by NOT re-adding it when `level >= max`. Once the last remaining element is maxed, `iterateQueue()` re-polls the identical maxed object, `price` never changes, the loop body is a no-op, and the loop cannot terminate — the tab freezes mid-portal with the portal window open.

**Expected.** `poll()` must decrement `size` when `size === 1` (upstream FastPriorityQueue does `this.size -= 1` in the else branch), and/or the pass-1 loop must have its own exit for an exhausted/all-maxed queue.

---

### The dump perk is persisted as a positional index into a list whose membership grows with unlocks

`src/modules/perks.ts:176`

**Trigger.** Pick a dump perk, later unlock a variable perk that sorts EARLIER in `perkHolder` (e.g. Overkill unlocking after the Fluffy/tier-II perks were already chosen), then reload the page. Same defect in the U2 twin at perks.ts:931-935.

**Actual.** `populateDumpPerkList` builds the `#dumpPerk` options from `AutoPerks.getVariablePerks()` (perks.ts:169), which filters `game.portal[Name].locked` — so the option list's LENGTH AND ORDER change as perks unlock. It then restores the selection with `$dumpDropdown.selectedIndex = Number(localStorage.getItem('AutoperkSelectedDumpPresetID'))` (perks.ts:174-176), a bare position. `saveDumpPerk` (perks.ts:181-185) writes BOTH `...DumpPresetID` and `...DumpPresetName`, but the name is never read back. Worked example, U1 `perkHolder` order [looting, toughness, power, motivation, pheromones, artisanistry, carpentry, resilience, coordinated, resourceful, overkill, cunning, curious, classy, toughness_II, power_II, motivation_II, carpentry_II, looting_II]: with Overkill and the Fluffy perks still locked, `looting_II` sits at index 14 and gets saved. Once Overkill unlocks it is inserted at position 10, everything after shifts by one, and index 14 now resolves to `carpentry_II`. `spendHelium` then pours ALL leftover helium into the wrong perk (perks.ts:419-425), silently — `populateDumpPerkList` only ever runs from `displayGUI`, so the list is rebuilt just once per page load.

**Expected.** Restore the selection by the persisted NAME (`AutoperkSelectedDumpPresetName`, already being written) and fall back to the index only when the name no longer matches an option.

---

### The Scryer Overkill gate never models Scryer's halved attack — oneShotPower discards its stance argument

`src/modules/scryer.ts:118`

**Trigger.** `UseScryerStance` ON (default true) and `ScryerUseWhenOverkill` ON (default true, settings-defs.ts:2298-2301), outside a Never-in-Spire situation, at any cell.

**Actual.** `HS = oneShotPower(scryF)` and `HSD = oneShotPower("D", 0, true)` are meant to compare one-shot power in Scryer vs in D. But `oneShotPower(specificStance?, offset, maxOrMin)` (stance.ts:52) never references `specificStance` anywhere in its body — the only difference between the two calls is `maxOrMin`. So HS is the MIN-damage overkill count at the CURRENT formation and HSD is the MAX-damage count at the same formation. oneShotPower is monotone non-decreasing in base damage, so HS <= HSD always and the guard `HS >= HSD` reduces to `HS === HSD`. Formation 4 (S) halves attack (main.js setFormation `case 4: attack /= 2`), and that halving is never applied. Concrete failure: enemy health H, current min damage 1.5H, max damage 1.9H → HS = HSD = 1, gate passes, setFormation(4) drops damage to 0.75H and the enemy is no longer one-shot — the exact outcome the gate exists to prevent.

**Expected.** The gate should compare Scryer-formation one-shot power against D-formation one-shot power. Either oneShotPower must honour `specificStance` (the way `survive()` at stance.ts:169-192 applies per-formation multipliers), or the scryer call sites must scale damage themselves.

---

### WarnNativeAutomationConflicts' description documents the design the code explicitly REJECTED (hidebuildings / HideJobBoxes) and omits two of its own rows

`src/modules/settings-defs.ts:43`

**Trigger.** Any user hovering the 'Warn: Auto Conflicts' control. Concretely mis-directing: U1 player with BuyBuildingsNew = 'Buy Neither', hidebuildings OFF (or never unlocked — settings-visibility.ts:337 only reveals it with the AutoStructure AND DecaBuild bwRewards), native AutoStructure off. The buildingsOrphan badge fires, but the tooltip told the user the warning is about 'Hide Buildings left on' — which is off. Mirror case: hidebuildings ON with BuyBuildingsNew = 'Buy Buildings & Storage' produces NO warning, though the tooltip says it would. Also: a user who sees the autoGolden or autoEquip badge finds neither button in the documented list.

**Actual.** how: '... Hide Buildings / Hide Jobs left on while the mastery they hand off to is off (nothing is buying at all).' and what: 'beside the game's own AutoPrestige / AutoUpgrade / AutoStructure / AutoJobs / AutoStorage buttons'.

**Expected.** The orphan rows key on the DISPATCH setting: native-conflicts.ts:103-104 is `getPageSetting('BuyBuildingsNew') === 0` / `getPageSetting('BuyJobsNew') === 0` — neither predicate reads hidebuildings or HideJobBoxes at all. The description should say 'Buy Buildings set to Buy Neither / Buy Jobs set to Don't Buy Jobs', should not claim 'nothing is buying at all' unconditionally (with hidebuildings ON, Gyms ARE still bought), and the `what:` list should include the AutoGold and AutoEquip buttons plus the two panel-header anchors.

---

## LOW

### `game.options.menu.climbBw.enabled = 0` is written once and never restored anywhere in src/ — the tooltip promises it is only off "while this runs"

`src/modules/other-praiding.ts:1428`

**Trigger.** Player has the game's `Climb BW` option ON (it is `enabled: 0` by default, config.js:1764-1765, and only unlockable at `highestLevelCleared >= 124`). `BWraid` (or `Dailybwraid`) is ON and the world reaches any zone in `BWraidingz`/`dBWraidingz` with the cell gate satisfied.

**Actual.** Line 1428 unconditionally sets `game.options.menu.climbBw.enabled = 0` on every tick inside the raid block. There is no matching restore: `grep -rn "climbBw" src/` returns exactly this one line. The zone-exit reset at lines 1470-1474 clears `bwraided`/`failbwraid`/`bwraidon` but leaves `climbBw` at 0. `game.options.menu` is part of the game save, so the player's Climb BW choice is silently and permanently destroyed by the first BW raid and stays off across zones, portals and reloads. The write also skips `toggleSetting('climbBw', null, false, true)` (the refresh call the game itself pairs with every `climbBw` write — main.js:10907, 13473-13474), so the in-game toggle button keeps rendering its old title until something else repaints it.

**Expected.** Either save the prior value and restore it on the raid's exit paths (lines 1458-1462 success, 1441-1445 failure, 1470-1474 zone exit) — matching the tooltip's "while this runs" — or change the tooltip to say AT turns it off permanently. Pair the write with `toggleSetting('climbBw', null, false, true)` either way.

---

### Once ABfarmsave writes its array, the String control renders as the infinity icon instead of the string

`src/modules/ab.ts:160`

**Trigger.** RAB + RABfarm on; ABfarmsave has written at least once, so `autoTrimpSettings.RABfarmstring.value` is the array `[enemyLevel, bestdust, equips]` rather than a string. The RABfarmstring control is visible (settings-visibility.ts:904).

**Actual.** ab.ts:160/166 store an ARRAY into a setting whose declared type is `textValue`. `updateCustomButtons` refreshes textValue labels via `else if (item.type == 'textValue' && item.value.substring !== undefined)` — an array has no `.substring`, so that branch is skipped; the next test `item.value > -1` coerces the array to "5,1234,Sword,Pants" → NaN → false; execution falls to the final `else`, which writes `elem.innerHTML = item.name + ': ' + "<span class='icomoon icon-infinity'></span>"`. The button reads "String: ∞", which in every other AT control means "no limit / unset" (the multiValue branch three lines above uses the same icon for the -1 sentinel). The user cannot see the value the tooltip tells them to share, and the display actively implies the setting is unset.

**Expected.** Either serialise the array to a string before storing (so the textValue contract holds end-to-end), or make the render branch handle a non-string value with `String(item.value)`.

---

### `lastProcessedWorld` keys the once-per-zone cache on `game.global.world`, which is blind to the two U2-Spire paths that rebuild the world grid at an unchanged world number

`src/modules/fight-info.ts:87`

**Trigger.** U2, `EnhanceGrids` on, inside the Universe-2 Spire: clearing floor 1 calls `nextU2SpireFloor()`, and finishing the Spire calls `finishU2Spire()`.

**Actual.** `Update()` returns early whenever `M['fightinfo'].lastProcessedWorld === game.global.world` (lines 87-90). The game rebuilds the world grid — `game.global.gridArray = []; document.getElementById('grid').innerHTML = ''; buildGrid(); drawGrid();` — inside `nextU2SpireFloor()` (.trimps-game/main.js:13131-13139) and `buildGrid(); drawGrid();` inside `finishU2Spire()` (main.js:13731-13734), and neither touches `game.global.world`. So the freshly drawn DOM has no glyphs, the cache says "already processed this world", and floors 2-10 of the U2 Spire plus the whole remainder of the post-Spire zone render with the feature silently off.

**Expected.** Invalidate on something that actually tracks grid identity rather than the zone number — e.g. also compare `game.global.lastClearedCell`/`gridArray` identity, or drop the world cache the way the map branch already does (the map branch's own cache is commented out at lines 73-76 for exactly this class of reason).

---

### raretokeep's option labels drift from game.heirlooms.rarityNames — "Common" behaves as "Any", and "Uncommon" is a rarity Trimps does not have

`src/modules/heirlooms.ts:90`

**Trigger.** Auto Heirlooms on, Kept Type != None, and Rarity to Keep set to "Common" (expecting Basic heirlooms to be de-prioritised) or to "Uncommon".

**Actual.** heirlooms.ts:90-102 maps the dropdown label to a rarity index: 'Any'->0, 'Common'->0, 'Uncommon'->1, 'Rare'->2, ... 'Mutated'->12. The game's rarity 0 is **Basic** and rarity 1 is **Common**. So picking "Common" yields threshold 0, i.e. identical to "Any" — Basic heirlooms still clear `rarity >= raretokeep` and receive the +1000 / x10000 scoring bonus at heirlooms.ts:122/134. "Uncommon", which does not exist in Trimps at all, is the label that actually means "Common or better". Every label from "Rare" up is correct, so the drift is confined to the bottom two tiers.

**Expected.** The option list should mirror `game.heirlooms.rarityNames` exactly — ['Basic','Common','Rare',...,'Mutated'] prefixed by 'Any' — and the mapping derived from it rather than hand-transcribed (the repo's own 'derive, don't retype' rule).

---

### The `overflowY` cleanup runs after the reopen, stripping the scrollbar off the window `settingsWindowSave` just re-rendered

`src/modules/MAZ.ts:613`

**Trigger.** Any MAZ window with enough rows to exceed 85% of viewport height (roughly 20+ presets), where the user clicks the blue **Save** button (`settingsWindowSave(title, true)`) rather than **Save and Close**.

**Actual.** The tail of `settingsWindowSave` runs in this order: `cancelTooltip(true)` → `if (reopen) MAZLookalike(titleText)` → `saveSettings()` → `document.getElementById('tooltipDiv').style.overflowY = ''`. `MAZLookalike` sets both `elem.style.maxHeight = window.innerHeight * .85 + 'px'` and `elem.style.overflowY = 'scroll'` (lines 291-292), then swaps in `tooltipExtraLg`. Line 613 immediately wipes the inline `overflowY`, and neither `#tooltipDiv` (.trimps-game/css/styleBak.css:196-204) nor `#tooltipDiv.tooltipExtraLg` (tabs.css:244-246) declares an overflow, so it falls back to `visible`. The reopened window keeps its 85vh cap but can no longer be scrolled; rows and the Save/Cancel row below the cap spill outside the box with no scrollbar to reach them. Save-and-Close followed by manually reopening the same window works fine — only the in-place reopen is broken.

**Expected.** Reset `overflowY` before the reopen (or skip the reset entirely when `reopen` is truthy), so the cleanup only applies to the close path it was written for.

---

### atGoldenChoices() reports AT's CONFIGURED golden pool, missing RautoGoldenUpgradesAT's unconditional Battle override in Mayhem / Pandemonium / Desolation

`src/modules/native-conflicts.ts:155`

**Trigger.** Universe 2, game.global.challengeActive is 'Mayhem', 'Pandemonium' or 'Desolation' (not a Challenge², so RAutoGoldenUpgrades is the live setting), RAutoGoldenUpgrades = 'Radon', native AutoGold on mode 2 ('AutoGold Battle'), autoUpgradesAvailable true.

**Actual.** atGoldenChoices() returns ['Helium'] (Radon normalised at line 139), nativeGoldenPool() returns 'Battle', so the row fires and the tooltip reads 'AT is set to buy Helium, while the game's AutoGold is set to buy Battle.' In reality AT is buying Battle too — both sides agree, and the tooltip names a pool AT is demonstrably not buying from. The mirror case is a missed real conflict: RAutoGoldenUpgrades = 'Void' with native on mode 3 ('Void') produces no badge, yet AT buys Battle and native buys Void.

**Expected.** atGoldenChoices() should apply the same challenge override the U2 dispatcher applies (or the row should be suppressed during those three challenges), so the pool it prints is the pool AT actually spends from.

---

### A perk ratio of exactly -1 bypasses the "ratios must be positive" guard and yields NaN efficiency

`src/modules/perks.ts:352`

**Trigger.** Type `-1` into any perk-ratio box on the portal screen (AT's own convention for "unset" everywhere else) and run Auto Allocate. Same code at perks.ts:1095 for U2.

**Actual.** `calculateIncrease` reads `if(perk.updatedValue != -1) value = perk.updatedValue; else value = perk.value;`. `updatedValue` is set from `parseFloat(box.value)` by `updatePerkRatios`, so the literal -1 the user typed collides with the constructor's "never set" sentinel and falls through to `perk.value`, which for a VariablePerk is the 11-element preset ARRAY built by `getRatiosFromPresets` (perks.ts:669-676). `increase / baseIncrease * <array>` coerces to NaN. The validation immediately below (`if(perks[i].efficiency < 0) { debug("Perk ratios must be positive values."); return false; }`, perks.ts:380/467/1123/1210) does not fire because `NaN < 0` is false, and `if(perks[i].efficiency != 0)` IS true for NaN, so the perk is enqueued with a NaN priority. The heap comparator `a.efficiency > b.efficiency` is false in both directions for NaN, so the perk's position — and therefore whether it receives helium at all — is undefined.

**Expected.** A negative ratio should be rejected by the same guard that rejects -2. Distinguish "unset" from "user typed -1" (e.g. `updatedValue === null`/`undefined` as the sentinel, or validate the parsed box value before assigning).

---

