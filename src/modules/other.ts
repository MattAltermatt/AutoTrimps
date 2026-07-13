// TRUE TS (Phase 1 · #30): converted from the faithful port under strict.
// PHASE 3 split (#51): the U1 Prestige/BW-Raid state machine (30 fns + its pMap*/dpMap* globals)
//   was extracted to other-praiding.ts; this residual keeps the grab-bag (~32 fns).
// Was: relocated verbatim from legacy/modules/other.js.
// Grab-bag automation: robotrimp, spire, traps, equipment-buy, golden-upgrades, misc (~32 fns).
// Registers MODULES["other"]. getPageSetting/debug from converted utils. EVERY top-level var
// (incl. multi-var blocks) was a global originally and the raid-map families (pMap*/repMap*/
// mapbought*/...) are read cross-module, so all are published to globalThis. Top-level implicit
// globals nextWorld (read by Graphs.js) + trapIndexs also -> globalThis.
// (praidSetting moved with the raid cluster to other-praiding.ts.)
// Free identifiers resolve via the bridge at runtime, typed ambient. Behaviour-preserving: any body edits are TYPE-ONLY.
import { getPageSetting, textSettingIsSet, debug, byId } from './utils'

MODULES["other"] = {};
MODULES["other"].enableRoboTrimpSpam = true;
globalThis.prestraid = !1;
globalThis.dprestraid = !1;
globalThis.failpraid = !1;
globalThis.dfailpraid = !1;
globalThis.bwraided = !1;
globalThis.dbwraided = !1;
globalThis.failbwraid = !1;
globalThis.dfailbwraid = !1;
globalThis.perked = !1;
globalThis.prestraidon = !1;
globalThis.dprestraidon = !1;
globalThis.mapbought = !1;
globalThis.dmapbought = !1;
globalThis.bwraidon = !1;
globalThis.dbwraidon = !1;
globalThis.presteps = null;
globalThis.minMaxMapCost = undefined;
globalThis.fMap = undefined;
globalThis.pMap = undefined;
globalThis.shouldFarmFrags = !1;
globalThis.praidDone = !1;

export function armydeath() {
    if (game.global.mapsActive) return !1;
    var e = game.global.lastClearedCell + 1,
        l = game.global.gridArray[e].attack * dailyModifiers.empower.getMult(game.global.dailyChallenge.empower.strength, game.global.dailyChallenge.empower.stacks),
        a = game.global.soldierHealth + game.global.soldierEnergyShield;
    "Ice" == getEmpowerment() && (l *= game.empowerments.Ice.getCombatModifier());
    var g = game.global.soldierCurrentBlock;
    return 3 == game.global.formation ? g /= 4 : "0" != game.global.formation && (g *= 2), g > game.global.gridArray[e].attack ? l *= getPierceAmt() : l -= g * (1 - getPierceAmt()), "Daily" == game.global.challengeActive && void 0 !== game.global.dailyChallenge.crits && (l *= dailyModifiers.crits.getMult(game.global.dailyChallenge.crits.strength)), void 0 !== game.global.dailyChallenge.bogged && (a -= game.global.soldierHealthMax * dailyModifiers.bogged.getMult(game.global.dailyChallenge.bogged.strength)), void 0 !== game.global.dailyChallenge.plague && (a -= game.global.soldierHealthMax * dailyModifiers.plague.getMult(game.global.dailyChallenge.plague.strength, game.global.dailyChallenge.plague.stacks)), challengeActive("Electricity") && (a -= game.global.soldierHealth -= game.global.soldierHealthMax * (.1 * game.challenges.Electricity.stacks)), "corruptCrit" == game.global.gridArray[e].corrupted ? l *= 5 : "healthyCrit" == game.global.gridArray[e].corrupted ? l *= 7 : "corruptBleed" == game.global.gridArray[e].corrupted ? a *= .8 : "healthyBleed" == game.global.gridArray[e].corrupted && (a *= .7), (a -= l) <= 1e3
}

export function autoRoboTrimp() {
    if (!(0 < game.global.roboTrimpCooldown) && game.global.roboTrimpLevel) {
        var a = parseInt(getPageSetting("AutoRoboTrimp"));
        // De-comma'd (#92). The original was `0 == a || REST` — a `||` whose LEFT side being true
        // SKIPS everything. De Morgan: run the body iff `0 != a` and the rest of the chain holds.
        if (0 != a && game.global.world >= a && (game.global.world - a) % 5 == 0 && !checkIfLiquidZone() && !game.global.useShriek) {
            magnetoShriek();
            if (MODULES.other.enableRoboTrimpSpam) debug("Activated Robotrimp MagnetoShriek Ability @ z" + game.global.world, "graphs", "*podcast");
        }
    }
}


export function buyWeps() {
    if (!((getPageSetting('BuyWeaponsNew') == 1) || (getPageSetting('BuyWeaponsNew') == 3))) return;
    preBuy();
    game.global.buyAmt = getPageSetting('gearamounttobuy');
    if (game.equipment.Dagger.level < getPageSetting('CapEquip2') && canAffordBuilding('Dagger', null, null, !0)) buyEquipment('Dagger', !0, !0);
    if (game.equipment.Mace.level < getPageSetting('CapEquip2') && canAffordBuilding('Mace', null, null, !0)) buyEquipment('Mace', !0, !0);
    if (game.equipment.Polearm.level < getPageSetting('CapEquip2') && canAffordBuilding('Polearm', null, null, !0)) buyEquipment('Polearm', !0, !0);
    if (game.equipment.Battleaxe.level < getPageSetting('CapEquip2') && canAffordBuilding('Battleaxe', null, null, !0)) buyEquipment('Battleaxe', !0, !0);
    if (game.equipment.Greatsword.level < getPageSetting('CapEquip2') && canAffordBuilding('Greatsword', null, null, !0)) buyEquipment('Greatsword', !0, !0);
    if (!game.equipment.Arbalest.locked && game.equipment.Arbalest.level < getPageSetting('CapEquip2') && canAffordBuilding('Arbalest', null, null, !0)) buyEquipment('Arbalest', !0, !0);
    postBuy();
}

export function buyArms() {
    if (!((getPageSetting('BuyArmorNew') == 1) || (getPageSetting('BuyArmorNew') == 3))) return;
    preBuy();
    game.global.buyAmt = 10;
    if (game.equipment.Shield.level < getPageSetting('CapEquiparm') && canAffordBuilding('Shield', null, null, !0)) buyEquipment('Shield', !0, !0);
    if (game.equipment.Boots.level < getPageSetting('CapEquiparm') && canAffordBuilding('Boots', null, null, !0)) buyEquipment('Boots', !0, !0);
    if (game.equipment.Helmet.level < getPageSetting('CapEquiparm') && canAffordBuilding('Helmet', null, null, !0)) buyEquipment('Helmet', !0, !0);
    if (game.equipment.Pants.level < getPageSetting('CapEquiparm') && canAffordBuilding('Pants', null, null, !0)) buyEquipment('Pants', !0, !0);
    if (game.equipment.Shoulderguards.level < getPageSetting('CapEquiparm') && canAffordBuilding('Shoulderguards', null, null, !0)) buyEquipment('Shoulderguards', !0, !0);
    if (game.equipment.Breastplate.level < getPageSetting('CapEquiparm') && canAffordBuilding('Breastplate', null, null, !0)) buyEquipment('Breastplate', !0, !0);
    if (!game.equipment.Gambeson.locked && game.equipment.Gambeson.level < getPageSetting('CapEquiparm') && canAffordBuilding('Gambeson', null, null, !0)) buyEquipment('Gambeson', !0, !0);
    postBuy();
}

export function isActiveSpireAT() {
    return game.global.challengeActive != 'Daily' && game.global.spireActive && game.global.world >= getPageSetting('IgnoreSpiresUntil')
}

export function disActiveSpireAT() {
    return game.global.challengeActive == 'Daily' && game.global.spireActive && game.global.world >= getPageSetting('dIgnoreSpiresUntil')
}

export function exitSpireCell() {
    // U1 only: the 1-100 ExitSpireCell setting was designed for the single-zone U1 spire. In the U2
    // Mega-Spire (Z300, 10 floors) lastClearedCell resets to -1 each floor, so this fired on floor 1
    // and endSpire()->finishU2Spire() aborted the whole 1000-cell run. Floor-aware U2 exit is a
    // separate feature (see issue #21 backlog).
    game.global.universe == 1 && isActiveSpireAT() && game.global.lastClearedCell >= getPageSetting('ExitSpireCell') - 1 && endSpire()
}

export function dailyexitSpireCell() {
    game.global.universe == 1 && disActiveSpireAT() && game.global.lastClearedCell >= getPageSetting('dExitSpireCell') - 1 && endSpire()
}


export function helptrimpsnotdie() {
    if (!game.global.preMapsActive && !game.global.fighting) buyArms();
}

export function buyshitspire() {
    if (!0 == getPageSetting('spireshitbuy') && game.global.spireActive && game.global.world >= getPageSetting('IgnoreSpiresUntil')) {
        buyWeps();
        buyArms();
    }
}

//Helium

export function autoGoldenUpgradesAT(setting: any) {
    var num = getAvailableGoldenUpgrades();
    var setting2;
    if (num == 0) return;
    if (setting == "Helium")
        setting2 = "Helium";
    if ((!game.global.dailyChallenge.seed && !game.global.runningChallengeSquared && autoTrimpSettings.AutoGoldenUpgrades.selected == "Helium" && getPageSetting('radonbattle') > 0 && game.goldenUpgrades.Helium.purchasedAt.length >= getPageSetting('radonbattle')) || (game.global.dailyChallenge.seed && autoTrimpSettings.dAutoGoldenUpgrades.selected == "Helium" && getPageSetting('dradonbattle') > 0 && game.goldenUpgrades.Helium.purchasedAt.length >= getPageSetting('dradonbattle')))
        setting2 = "Battle";
    if (setting == "Battle")
        setting2 = "Battle";
    if ((!game.global.dailyChallenge.seed && !game.global.runningChallengeSquared && autoTrimpSettings.AutoGoldenUpgrades.selected == "Battle" && getPageSetting('battleradon') > 0 && game.goldenUpgrades.Battle.purchasedAt.length >= getPageSetting('battleradon')) || (game.global.dailyChallenge.seed && autoTrimpSettings.dAutoGoldenUpgrades.selected == "Battle" && getPageSetting('dbattleradon') > 0 && game.goldenUpgrades.Battle.purchasedAt.length >= getPageSetting('dbattleradon')))
        setting2 = "Helium";
    if (setting == "Void" || setting == "Void + Battle")
        setting2 = "Void";
    var success = buyGoldenUpgrade(setting2);
    if (!success && setting2 == "Void") {
        num = getAvailableGoldenUpgrades();
        if (num == 0) return;
        if ((autoTrimpSettings.AutoGoldenUpgrades.selected == "Void" && !game.global.dailyChallenge.seed && !game.global.runningChallengeSquared) || (autoTrimpSettings.dAutoGoldenUpgrades.selected == "Void" && game.global.dailyChallenge.seed))
            setting2 = "Helium";
        if (((autoTrimpSettings.AutoGoldenUpgrades.selected == "Void" && getPageSetting('voidheliumbattle') > 0 && game.global.world >= getPageSetting('voidheliumbattle')) || (autoTrimpSettings.dAutoGoldenUpgrades.selected == "Void" && getPageSetting('dvoidheliumbattle') > 0 && game.global.world >= getPageSetting('dvoidheliumbattle'))) || ((autoTrimpSettings.AutoGoldenUpgrades.selected == "Void + Battle" && !game.global.dailyChallenge.seed && !game.global.runningChallengeSquared) || (autoTrimpSettings.dAutoGoldenUpgrades.selected == "Void + Battle" && game.global.dailyChallenge.seed) || (autoTrimpSettings.cAutoGoldenUpgrades.selected == "Void + Battle" && game.global.runningChallengeSquared)))
            setting2 = "Battle";
        buyGoldenUpgrade(setting2);
    }
}

export function trimpcide() {
    if (game.portal.Anticipation.level > 0) {
        var antistacklimit = (game.talents.patience.purchased) ? 45 : 30;
        if (game.global.fighting && ((game.jobs.Amalgamator.owned > 0) ? Math.floor((new Date().getTime() - game.global.lastSoldierSentAt) / 1000) : Math.floor(game.global.lastBreedTime / 1000)) >= antistacklimit && (game.global.antiStacks < antistacklimit || antistacklimit == 0 && game.global.antiStacks >= 1) && !game.global.spireActive)
            forceAbandonTrimps();
        if (game.global.fighting && ((game.jobs.Amalgamator.owned > 0) ? Math.floor((new Date().getTime() - game.global.lastSoldierSentAt) / 1000) : Math.floor(game.global.lastBreedTime / 1000)) >= antistacklimit && game.global.antiStacks < antistacklimit && game.global.mapsActive) {
            if (getCurrentMapObject().location == "Void") {
                abandonVoidMap();
            }
        }
    }
}

export function avoidempower() {
    if (armydeath()) {
        if (typeof game.global.dailyChallenge.bogged === 'undefined' && typeof game.global.dailyChallenge.plague === 'undefined') {
            mapsClicked(true);
            return;
        }
    }
}

globalThis.spirebreeding = false;

export function ATspirebreed() {
    if (!spirebreeding && getPageSetting('SpireBreedTimer') > 0 && getPageSetting('IgnoreSpiresUntil') <= game.global.world && game.global.spireActive)
        var prespiretimer = game.global.GeneticistassistSetting;
    if (getPageSetting('SpireBreedTimer') > 0 && getPageSetting('IgnoreSpiresUntil') <= game.global.world && game.global.spireActive && game.global.GeneticistassistSetting != getPageSetting('SpireBreedTimer')) {
        spirebreeding = true;
        if (game.global.GeneticistassistSetting != getPageSetting('SpireBreedTimer'))
            game.global.GeneticistassistSetting = getPageSetting('SpireBreedTimer');
    }
    if (getPageSetting('SpireBreedTimer') > 0 && getPageSetting('IgnoreSpiresUntil') <= game.global.world && !game.global.spireActive && game.global.GeneticistassistSetting == getPageSetting('SpireBreedTimer')) {
        spirebreeding = false;
        if (game.global.GeneticistassistSetting == getPageSetting('SpireBreedTimer')) {
            game.global.GeneticistassistSetting = prespiretimer;
            toggleGeneticistassist();
            toggleGeneticistassist();
            toggleGeneticistassist();
            toggleGeneticistassist();
        }
    }
}

export function fightalways() {
    if (game.global.gridArray.length === 0 || game.global.preMapsActive || !game.upgrades.Battle.done || game.global.fighting || (game.global.spireActive && game.global.world >= getPageSetting('IgnoreSpiresUntil')))
        return;
    if (!game.global.fighting)
        fightManual();
}

// #70 — the `== 2` arm ("CAM: H:D") compared against `MODULES["maps"].enoughDamageCutoff`, a field
// NOTHING anywhere ever assigns. `n >= undefined` is always false, so the middle option of both Armor
// Magic multitoggles has been a silent no-op since it was written — dead, but reading like working code
// (no throw, no warning, green tsc: the ambient decl is `any`).
//
// The fix is to read the H:D threshold the tooltip already promises ("the H:D you have defined in
// maps") — NOT to invent a number for the MODULES field, which would be a new game-balance literal.
//
// Same units, and this is not a guess. maps.ts:408 computes
//     enoughDamage = (ourBaseDamage * mapcuntoff > enemyHealth)
// which rearranges to `enemyHealth / ourBaseDamage < mapcuntoff`, i.e. `HD < mapcuntoff`. And
// calcHDratio() IS `calcEnemyHealth() / ourBaseDamage` (calc.ts:901). So mapcuntoff already IS an H:D
// threshold, and `calcHDratio() >= mapcuntoff` is exactly its complement: "not enough damage ⇒ buy
// armor", which is the branch's stated intent. The U2 twin below needs no algebra at all — maps.ts:974
// literally does `RenoughDamage = (RcalcHDratio() <= getPageSetting("Rmapcuntoff"))` in production.
export function armormagic() {
    var armormagicworld = Math.floor((game.global.highestLevelCleared + 1) * 0.8);
    if (((getPageSetting('carmormagic') == 1 || getPageSetting('darmormagic') == 1) && game.global.world >= armormagicworld && (game.global.soldierHealth <= game.global.soldierHealthMax * 0.4)) || ((getPageSetting('carmormagic') == 2 || getPageSetting('darmormagic') == 2) && calcHDratio() >= getPageSetting('mapcuntoff') && (game.global.soldierHealth <= game.global.soldierHealthMax * 0.4)) || ((getPageSetting('carmormagic') == 3 || getPageSetting('darmormagic') == 3) && (game.global.soldierHealth <= game.global.soldierHealthMax * 0.4)))
        buyArms();
}

globalThis.trapIndexs = ["", "Fire", "Frost", "Poison", "Lightning", "Strength", "Condenser", "Knowledge"];

export function tdStringCode2() {
    var thestring = byId('importBox').value.replace(/\s/g, '');
    var s = new String(thestring);
    var index = s.indexOf("+", 0);
    s = s.slice(0, index);
    var length = s.length;

    var saveLayout = [];
    for (var i = 0; i < length; i++) {
        saveLayout.push(trapIndexs[s.charAt(i)]);
    }
    playerSpire['savedLayout' + -1] = saveLayout;

    if ((playerSpire.runestones + playerSpire.getCurrentLayoutPrice()) < playerSpire.getSavedLayoutPrice(-1)) return false;
    playerSpire.resetTraps();
    for (var x = 0; x < saveLayout.length; x++) {
        if (!saveLayout[x]) continue;
        playerSpire.buildTrap(x, saveLayout[x]);
    }
}

globalThis.oldPlayerSpireDrawInfo = playerSpire.drawInfo;
playerSpire.drawInfo = function(drawArgs: any) {
    // param renamed from `arguments` (illegal in strict ES module) to drawArgs; behavior identical.
    oldPlayerSpireDrawInfo.apply(this, drawArgs);
    var elem = document.getElementById('spireTrapsWindow');
    if (!elem) return drawArgs;
    var importBtn = "<div onclick='ImportExportTooltip(\"spireImport\")' class='spireControlBox'>Import</div>";
    elem.innerHTML = importBtn + elem.innerHTML;
    return drawArgs;
}

//Radon
export function RbuyArms() {
    // #58 removed the phantom RBuyArmorNew gate here and shipped a comment declaring U2 armor-magic
    // repaired. IT WAS NOT. A SECOND phantom on the very next line still killed it: every one of the
    // seven slots was gated on `level < getPageSetting('RCapEquiparm')`, and RCapEquiparm resolves to
    // false/undefined → `level < 0` → false at every level. The function bought nothing, ever. (#68)
    //
    // RCapEquiparm is not a typo: it was createSetting'd in 2019 (d33ea06b) and DELETED upstream in
    // 2020 (701faab4), leaving these reads orphaned. It must NOT be re-minted — createSetting applies
    // its default only when NOTHING is stored (`loaded === undefined ? defaultValue : loaded`), while
    // loadPageVariables() restores the whole localStorage blob and serializeSettings() round-trips
    // unknown keys forever. Re-minting a deleted id therefore RESURRECTS whatever value the user last
    // set in 2020 rather than applying a safe default.
    //
    // Repointing at an id that already exists mints no key, so there is nothing to resurrect.
    // 'Requipcaphealth' ("AE: Armour Cap — What level to stop buying Armour at") is the live U2 armour
    // cap the player already configured for RautoEquip (equipment.ts:949) — same universe, same
    // semantic, and visible in the U2 panel (the U1 twin CapEquiparm is turnOff()'d when radonon, so
    // pointing at it would bind U2 to a control the U2 player cannot see, and its default of 10 sits
    // BELOW typical U2 armour levels — the feature would have stayed dead while looking fixed).
    //
    // Normalize as RautoEquip does: a cap of <= 0 means "no cap", not "cap of zero" — without this a
    // player who disables the cap (-1) gets `level < -1` and lands right back on a dead feature.
    // De-comma'd from the legacy one-line comma sequence (#92 sanctions this "behind the live net", and
    // the net is live as of #67). A comma sequence is exactly equivalent to sequential statements — every
    // operand was already evaluated left-to-right with no early exit — so this is byte-equivalent behavior.
    // It is also load-bearing for the lint gate: oxlint's no-unused-vars does NOT count identifier uses
    // inside a sequence-expression statement, so `armourCap` read as "declared but never used" until the
    // commas went. Keeping the sequence would have forced a lint suppression to hide a phantom warning.
    const armourCap = (getPageSetting('Requipcaphealth') <= 0) ? Infinity : getPageSetting('Requipcaphealth');
    preBuy();
    game.global.buyAmt = 10;
    for (const slot of ['Shield', 'Boots', 'Helmet', 'Pants', 'Shoulderguards', 'Breastplate'] as const) {
        if (game.equipment[slot].level < armourCap && canAffordBuilding(slot, null, null, !0))
            buyEquipment(slot, !0, !0);
    }
    // Gambeson keeps its extra `locked` guard — it is the one armour slot that can still be locked.
    if (!game.equipment.Gambeson.locked && game.equipment.Gambeson.level < armourCap && canAffordBuilding('Gambeson', null, null, !0))
        buyEquipment('Gambeson', !0, !0);
    postBuy();
}

export function Rfightalways() {
    if (game.global.gridArray.length === 0 || game.global.preMapsActive || !game.upgrades.Battle.done || game.global.fighting)
        return;
    if (!game.global.fighting)
        fightManual();
}

// #70 (U2 twin) — `MODULES["maps"].RenoughDamageCutoff` is likewise never assigned, so the "DAM: H:D"
// arm was dead in both U2 multitoggles too. Repointed at `Rmapcuntoff`, the U2 H:D threshold the player
// already configures. maps.ts:974 compares that exact setting to RcalcHDratio() in production, so the
// units are confirmed by an existing call site — no new number is introduced.
export function Rarmormagic() {
    var armormagicworld = Math.floor((game.global.highestLevelCleared + 1) * 0.8);
    if (((getPageSetting('Rcarmormagic') == 1 || getPageSetting('Rdarmormagic') == 1) && game.global.world >= armormagicworld && (game.global.soldierHealth <= game.global.soldierHealthMax * 0.4)) || ((getPageSetting('Rcarmormagic') == 2 || getPageSetting('Rdarmormagic') == 2) && RcalcHDratio() >= getPageSetting('Rmapcuntoff') && (game.global.soldierHealth <= game.global.soldierHealthMax * 0.4)) || ((getPageSetting('Rcarmormagic') == 3 || getPageSetting('Rdarmormagic') == 3) && (game.global.soldierHealth <= game.global.soldierHealthMax * 0.4)))
        RbuyArms();
}

export function questcheck() {
    if (game.global.world < game.challenges.Quest.getQuestStartZone()) {
        return 0;
    }
    //x5 resource
    if (game.challenges.Quest.getQuestDescription() == "Quintuple (x5) your food" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 10;
    else if (game.challenges.Quest.getQuestDescription() == "Quintuple (x5) your wood" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 11;
    else if (game.challenges.Quest.getQuestDescription() == "Quintuple (x5) your metal" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 12;
    else if (game.challenges.Quest.getQuestDescription() == "Quintuple (x5) your gems" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 13;
    else if (game.challenges.Quest.getQuestDescription() == "Quintuple (x5) your science" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 14;
    //x2 resource
    else if (game.challenges.Quest.getQuestDescription() == "Double your food" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 20;
    else if (game.challenges.Quest.getQuestDescription() == "Double your wood" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 21;
    else if (game.challenges.Quest.getQuestDescription() == "Double your metal" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 22;
    else if (game.challenges.Quest.getQuestDescription() == "Double your gems" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 23;
    else if (game.challenges.Quest.getQuestDescription() == "Double your science" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 24;
    //Everything else
    else if (game.challenges.Quest.getQuestDescription() == "Complete 5 Maps at Zone level" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 3;
    else if (game.challenges.Quest.getQuestDescription() == "One-shot 5 world enemies" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 4;
    else if (game.challenges.Quest.getQuestDescription() == "Don't let your shield break before Cell 100" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 5;
    else if (game.challenges.Quest.getQuestDescription() == "Don't run a map before Cell 100" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 6;
    else if (game.challenges.Quest.getQuestDescription() == "Buy a Smithy" && game.challenges.Quest.getQuestProgress() != "Quest Complete!" && game.challenges.Quest.getQuestProgress() != "Failed!")
        return 7;
    else
        return 0;
}

export function Rgetequipcost(equip: any, resource: any, amt: any) {
    var cost = Math.ceil(getBuildingItemPrice(game.equipment[equip], resource, true, amt) * (Math.pow(amt - game.portal.Artisanistry.modifier, game.portal.Artisanistry.radLevel)));
    return cost;
}

//smithylogic('Shield', 'wood', true)
export function smithylogic(name: any, resource: any, equip: any) {

    var go = true;

    //Checks

    if (getPageSetting('Rsmithylogic') == false || getPageSetting('Rsmithynumber') <= 0 || getPageSetting('Rsmithypercent') <= 0 || getPageSetting('Rsmithyseconds') <= 0) {
        return go;
    }
    if (getPageSetting('Rsmithynumber') > 0 && getPageSetting('Rsmithynumber') >= game.buildings.Smithy.owned) {
        return go;
    }
    if (name == undefined) {
        return go;
    }

    //Vars

    // #68: was getPageSetting('Rgearamounttobuy') — an id createSetting'd in 2019 (d33ea06b) and DELETED
    // upstream in 2020 (701faab4) with this read left behind, so it resolved to false/undefined and `amt`
    // always fell to the `: 1` branch. The live U2 gear knob is 'Requipamount' ("AE: Amount"), which until
    // now was a rendered orphan NO code read. Same semantic, same universe, visible to the U2 player, and
    // its default is 1 — identical to the fallback this replaces, so default behavior is unchanged.
    // Repointing (rather than re-minting the deleted id) is deliberate: see the note in RbuyArms below.
    var amt = (getPageSetting('Requipamount') > 0) ? getPageSetting('Requipamount') : 1;
    var percent = (getPageSetting('Rsmithypercent') / 100);
    var seconds = getPageSetting('Rsmithyseconds');
    var resourcesecwood = getPsString("wood", true);
    var resourcesecmetal = getPsString("metal", true);
    var resourcesecgems = getPsString("gems", true);
    var smithywood = getBuildingItemPrice(game.buildings.Smithy, "wood", false, 1);
    var smithymetal = getBuildingItemPrice(game.buildings.Smithy, "metal", false, 1);
    var smithygems = getBuildingItemPrice(game.buildings.Smithy, "gems", false, 1);
    var smithypercentwood = smithywood * percent;
    var smithypercentmetal = smithymetal * percent;
    var smithypercentgems = smithygems * percent;
    var smithyclosewood = ((smithywood / resourcesecwood) <= seconds);
    var smithyclosemetal = ((smithymetal / resourcesecmetal) <= seconds);
    var smithyclosegems = ((smithygems / resourcesecgems) <= seconds);

    var itemwood: any = null;
    var itemmetal: any = null;
    var itemgems: any = null;

    if (!equip) {
        if (name == "Hut") {
            itemwood = getBuildingItemPrice(game.buildings[name], "wood", false, amt);
        } else if (name == "House") {
            itemwood = getBuildingItemPrice(game.buildings[name], "wood", false, amt);
            itemmetal = getBuildingItemPrice(game.buildings[name], "metal", false, amt);
        } else if (name == "Mansion") {
            itemwood = getBuildingItemPrice(game.buildings[name], "wood", false, amt);
            itemmetal = getBuildingItemPrice(game.buildings[name], "metal", false, amt);
            itemgems = getBuildingItemPrice(game.buildings[name], "gems", false, amt);
        } else if (name == "Hotel") {
            itemwood = getBuildingItemPrice(game.buildings[name], "wood", false, amt);
            itemmetal = getBuildingItemPrice(game.buildings[name], "metal", false, amt);
            itemgems = getBuildingItemPrice(game.buildings[name], "gems", false, amt);
        } else if (name == "Resort") {
            itemwood = getBuildingItemPrice(game.buildings[name], "wood", false, amt);
            itemmetal = getBuildingItemPrice(game.buildings[name], "metal", false, amt);
            itemgems = getBuildingItemPrice(game.buildings[name], "gems", false, amt);
        } else if (name == "Gateway") {
            itemmetal = getBuildingItemPrice(game.buildings[name], "metal", false, amt);
            itemgems = getBuildingItemPrice(game.buildings[name], "gems", false, amt);
        } else if (name == "Collector") {
            itemgems = getBuildingItemPrice(game.buildings[name], "gems", false, amt);
        }
    } else if (equip && name == "Shield") {
        itemwood = Rgetequipcost("Shield", "wood", amt);
    } else if (equip && name != "Shield") {
        itemmetal = Rgetequipcost(name, resource, amt);
    }

    if (itemwood == null && itemmetal == null && itemgems == null) {
        return go;
    }
    if (!smithyclosewood && !smithyclosemetal && !smithyclosegems) {
        return go;
    } else if (smithyclosewood && itemwood > smithypercentwood && (name == "Shield" || name == "Hut" || name == "House" || name == "Mansion" || name == "Hotel" || name == "Resort")) {
        go = false;
        return go;
    } else if (smithyclosemetal && itemmetal > smithypercentmetal && ((equip && name != "Shield") || name == "House" || name == "Mansion" || name == "Hotel" || name == "Resort" || name == "Gateway")) {
        go = false;
        return go;
    } else if (smithyclosegems && itemgems > smithypercentgems && (name == "Mansion" || name == "Hotel" || name == "Resort" || name == "Gateway" || name == "Collector")) {
        go = false;
        return go;
    } else if (smithyclosewood && itemwood <= smithypercentwood && (name == "Shield" || name == "Hut" || name == "House" || name == "Mansion" || name == "Hotel" || name == "Resort")) {
        go = true;
        return go;
    } else if (smithyclosemetal && itemmetal <= smithypercentmetal && ((equip && name != "Shield") || name == "House" || name == "Mansion" || name == "Hotel" || name == "Resort" || name == "Gateway")) {
        go = true;
        return go;
    } else if (smithyclosegems && itemgems <= smithypercentgems && (name == "Mansion" || name == "Hotel" || name == "Resort" || name == "Gateway" || name == "Collector")) {
        go = true;
        return go;
    }
}

export function archstring() {
    if (getPageSetting('Rarchon') == false) return;
    if (textSettingIsSet('Rarchstring1') && textSettingIsSet('Rarchstring2') && textSettingIsSet('Rarchstring3')) {
        var string1 = getPageSetting('Rarchstring1'),
            string2 = getPageSetting('Rarchstring2'),
            string3 = getPageSetting('Rarchstring3');
        var string1z = string1.split(',')[0],
            string2z = string2.split(',')[0];
        var string1split = string1.split(',').slice(1).toString(),
            string2split = string2.split(',').slice(1).toString();
        if (game.global.world <= string1z && game.global.archString != string1split) {
            game.global.archString = string1split;
        }
        if (game.global.world > string1z && game.global.world <= string2z && game.global.archString != string2split) {
            game.global.archString = string2split;
        }
        if (game.global.world > string2z && game.global.archString != string3) {
            game.global.archString = string3;
        }
    }
}

globalThis.fastimps = [
    "Snimp",
    "Kittimp",
    "Gorillimp",
    "Squimp",
    "Shrimp",
    "Chickimp",
    "Frimp",
    "Slagimp",
    "Lavimp",
    "Kangarimp",
    "Entimp",
    "Fusimp",
    "Carbimp",
    "Shadimp",
    "Voidsnimp",
    "Prismimp",
    "Sweltimp",
    "Indianimp",
    "Improbability",
    "Neutrimp",
    "Cthulimp",
    "Omnipotrimp",
    "Mutimp",
    "Hulking_Mutimp",
    "Liquimp",
    "Poseidimp",
    "Darknimp",
    "Horrimp",
    "Arachnimp",
    "Beetlimp",
    "Mantimp",
    "Butterflimp",
    "Frosnimp",
    "Turkimp",
    "Ubersmith"
];

export function Rmanageequality() {

    if (!(game.global.challengeActive == "Exterminate" && getPageSetting('Rexterminateon') == true && getPageSetting('Rexterminateeq') == true && !game.global.mapsActive)) {
        if (
            (game.global.challengeActive == "Glass") || 
            (fastimps.includes(getCurrentEnemy().name)) || 
            (game.global.mapsActive && getCurrentMapObject().location == "Void" && game.global.voidBuff == 'doubleAttack') || 
            (!game.global.mapsActive && game.global.gridArray[game.global.lastClearedCell+1].u2Mutation.length > 0) ||
            (game.global.mapsActive && game.global.challengeActive == "Desolation")
        ) {
            if (!game.portal.Equality.scalingActive) {
                game.portal.Equality.scalingActive = true;
                manageEqualityStacks();
                updateEqualityScaling();
            }
        } else {
            if (game.portal.Equality.scalingActive) {
                game.portal.Equality.scalingActive = false;
                game.portal.Equality.disabledStackCount = "0";
                manageEqualityStacks();
                updateEqualityScaling();
            }
        }
    } else if (game.global.challengeActive == "Exterminate" && getPageSetting('Rexterminateon') == true && getPageSetting('Rexterminateeq') == true && !game.global.mapsActive) {
        if ((getCurrentEnemy().name == "Arachnimp" || getCurrentEnemy().name == "Beetlimp" || getCurrentEnemy().name == "Mantimp" || getCurrentEnemy().name == "Butterflimp") && !game.challenges.Exterminate.experienced) {
            if (!game.portal.Equality.scalingActive) {
                game.portal.Equality.scalingActive = true;
                manageEqualityStacks();
                updateEqualityScaling();
            }
        } else if ((getCurrentEnemy().name == "Arachnimp" || getCurrentEnemy().name == "Beetlimp" || getCurrentEnemy().name == "Mantimp" || getCurrentEnemy().name == "Butterflimp") && game.challenges.Exterminate.experienced) {
            if (game.portal.Equality.scalingActive) {
                game.portal.Equality.scalingActive = false;
                game.portal.Equality.disabledStackCount = "0";
                manageEqualityStacks();
                updateEqualityScaling();
            }
        }
    }
}

export function autoshrine() {
    var universe: any;
    var mode = game.global.challengeActive == "Daily" ? "Daily" : "Standard";
  
    switch (game.global.universe) {
      case 1:
        universe = "Helium";
        break;
      case 2:
        universe = "Radon";
        break;
    }

    var shrineSettings: any = {
      Helium: {
        Standard: {
          core: "Hshrine",
          zone: "Hshrinezone",
          amount: "Hshrineamount",
          cell: "Hshrinecell",
          charge: "Hshrinecharge",
        },
        Daily: {
          core: "Hdshrine",
          zone: "Hdshrinezone",
          amount: "Hdshrineamount",
          cell: "Hdshrinecell",
          charge: "Hshrinecharge",
        },
      },
      Radon: {
        Standard: {
          core: "Rshrine",
          zone: "Rshrinezone",
          amount: "Rshrineamount",
          cell: "Rshrinecell",
          charge: "Rshrinecharge",
        },
        Daily: {
          core: "Rdshrine",
          zone: "Rdshrinezone",
          amount: "Rdshrineamount",
          cell: "Rdshrinecell",
          charge: "Rshrinecharge",
        },
      },
    };

    if (getPageSetting(shrineSettings[universe][mode].core) && game.permaBoneBonuses.boosts.charges > 0) {
      var shrinezone = getPageSetting(shrineSettings[universe][mode].zone);
        if (shrinezone.includes(game.global.world)) {
            var shrineamount = getPageSetting(shrineSettings[universe][mode].amount);
            var shrineindex = shrinezone.indexOf(game.global.world);
            var shrinecell = getPageSetting(shrineSettings[universe][mode].cell)[shrineindex];
            var shrinezones = shrineamount[shrineindex];

            shrinezones = shrinezones - autoTrimpSettings[shrineSettings[universe][mode].charge].value;

            if (game.global.lastClearedCell + 2 >= shrinecell && shrinezones > 0) {
                game.permaBoneBonuses.boosts.consume();
                autoTrimpSettings[shrineSettings[universe][mode].charge].value += 1;
            }
        }
    }
}

globalThis.old_nextWorld = nextWorld;
globalThis.nextWorld = function() {
    var retVal = old_nextWorld(...arguments);
    if (autoTrimpSettings.Hshrinecharge) autoTrimpSettings.Hshrinecharge.value = 0;
    if (autoTrimpSettings.Rshrinecharge) autoTrimpSettings.Rshrinecharge.value = 0;
    return retVal;
}

export function autoBoneChargeWhenMax() {
  // Uses bone charges when they are at max charges automatically.

  // If "Daily Only" was chosen and we're not on a daily challenge, exit.
  if (
    getPageSetting("AutoBoneChargeMax") === 2 &&
    !(game.global.challengeActive == "Daily")
  ) {
    return;
  }

  // If the option is enabled but no zone is specified, set a default value to
  // the highest zone cleared - 10% or 60 (broken planet equipment discount)
  // if the HZC value would be less than 60. Otherwise use the user value.
  const autoBoneChargeZoneSet =
    getPageSetting("AutoBoneChargeMaxStartZone") > 0 ? true : false;
  const highestZoneCleared = game.global.highestLevelCleared;
  const percentOfHZC = Math.round((10 / 100) * highestZoneCleared);
  const optimalChargeZone =
    highestZoneCleared - percentOfHZC > 60
      ? highestZoneCleared - percentOfHZC
      : 60;
  const chargeZone = !autoBoneChargeZoneSet
    ? optimalChargeZone
    : autoTrimpSettings.AutoBoneChargeMaxStartZone.value;
  const boneChargesAvailable = game.permaBoneBonuses.boosts.charges;
  const currentZone = game.global.world;

  // If we have more than 10 bone charges and our current world zone is
  // greater than or equal to the charge zone set; use a bone charge.
  if (boneChargesAvailable === 10 && currentZone >= chargeZone) {
    game.permaBoneBonuses.boosts.consume();
    debug("Max bone charges reached! Used a bone charge.", "general", "*bolt");
  }
}

export function Rarmydeath() {
    if (game.global.mapsActive) return false;
    var cell = game.global.lastClearedCell + 1;
    var attack = game.global.gridArray[cell].attack * dailyModifiers.empower.getMult(game.global.dailyChallenge.empower.strength, game.global.dailyChallenge.empower.stacks) * Math.pow(game.portal.Equality.modifier, game.portal.Equality.scalingCount);
    var health = game.global.soldierHealth + game.global.soldierEnergyShield;
    var healthmax = game.global.soldierHealthMax * (Fluffy.isRewardActive('shieldlayer') ? 1 + (getEnergyShieldMult() * (1 + Fluffy.isRewardActive('shieldlayer'))) : 1 + getEnergyShieldMult());

    if (attack >= healthmax && game.portal.Equality.getActiveLevels() < game.portal.Equality.radLevel) return false;
    else if (attack >= health) return true;
    else return false;
}

export function Ravoidempower() {
    if (Rarmydeath()) {
        if (typeof game.global.dailyChallenge.bogged === 'undefined' && typeof game.global.dailyChallenge.plague === 'undefined') {
            mapsClicked(true);
            return;
        }
    }
}
