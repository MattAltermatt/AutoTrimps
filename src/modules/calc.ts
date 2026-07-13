// TRUE TS (Phase 1 · #27): converted from the faithful port under strict.
// IDIOMATIC (Phase 2 · #51): var→const/let throughout (167 declarations); == → === where the
//   operands are provably the same runtime type. Behavior-preserving — a 60-test characterization
//   net (tests/calc.characterization.test.ts) plus the pre-existing tests/calc.test.ts +
//   tests/calc.getTrimpAttack.test.ts pin every family (our/enemy attack·health·block, crit tiers,
//   corruption scaling, HD ratio, stance, the U2 radon R* mirrors) BEFORE the refactor; L0 backstop ∅.
//   `==` kept deliberately LOOSE at every getPageSetting(...) comparison (its return is polymorphic:
//   boolean / string / number / NaN / int[]) and at the two `world == false` falsy-catch guards
//   (RcalcEnemyHealth/Mod). No numeric literal or formula shape changed.
// PHASE 3 (#51) dedupe: calc's dead calcBaseDamageInX copy (3rd arg `false`) was removed — stance.ts's
//   copy (3rd arg `true`) is spread after calc and won at global scope, so calc's was unreachable.
// Was: relocated verbatim from legacy/modules/calc.js.
// Core combat math — our/enemy attack, health, block, crit, HD ratio, stance, and the parallel
// Universe-2 (radon) R* family. Deeply game-coupled (526 game.* touches across ~40 fns). game.*
// stays `any` (the pragmatic ambient boundary, §5). Free identifiers (game combat helpers, R* enemy
// predictors, mutations/Fluffy/autoBattle state) resolve via the bridge at runtime, typed ambient in
// trimps.d.ts (game API) + at-legacy.d.ts (not-yet-converted AT modules). getPageSetting imported
// from converted utils. Shared top-level vars critCC/critDD/trimpAA are read by legacy equipment.js +
// maps.js, so they publish to globalThis (shared-var seam) rather than module-scoped.
import { getPageSetting } from './utils'

globalThis.critCC = 1;
globalThis.critDD = 1;
globalThis.trimpAA = 1;

//Helium

export function addPoison(realDamage?: boolean, zone?: number): number {
    //Init
    if (!zone) zone = game.global.world;

    //Poison is inactive
    if (getEmpowerment(zone) !== "Poison") return 0;

    //Real amount to be added in the next attack
    if (realDamage) return game.empowerments.Poison.getDamage();

    //Dynamically determines how much we are benefiting from poison based on Current Amount * Transfer Rate
    if (getPageSetting("addpoison")) return game.empowerments["Poison"].getDamage() * getRetainModifier("Poison");

    return 0;
}

export function calcCorruptionScale(zone: number, base: number): number {
    const startPoint = (game.global.challengeActive === "Corrupted" || game.global.challengeActive === "Eradicated") ? 1 : 150;
    const scales = Math.floor((zone - startPoint) / 6);
    const realValue = base * Math.pow(1.05, scales);
    return parseFloat(prettify(realValue));
}

export function getTrimpAttack(): number {
    let dmg = 6;
    const equipmentList = ["Dagger", "Mace", "Polearm", "Battleaxe", "Greatsword", "Arbalest"];
    for (let i = 0; i < equipmentList.length; i++) {
        if (game.equipment[equipmentList[i]].locked !== 0) continue;
        const attackBonus = game.equipment[equipmentList[i]].attackCalculated;
        const level = game.equipment[equipmentList[i]].level;
        dmg += attackBonus * level;
    }
    if (mutations.Magma.active()) {
        dmg *= mutations.Magma.getTrimpDecay();
    }
    dmg *= game.resources.trimps.maxSoldiers;
    if (game.portal.Power.level > 0) {
        dmg += (dmg * game.portal.Power.level * game.portal.Power.modifier);
    }
    if (game.portal.Power_II.level > 0) {
        dmg *= (1 + (game.portal.Power_II.modifier * game.portal.Power_II.level));
    }
    if (game.global.formation !== 0) {
        dmg *= (game.global.formation === 2) ? 4 : 0.5;
    }
    return dmg;
}

export function calcOurHealth(stance?: boolean): number {
    let health = 50;

    if (game.resources.trimps.maxSoldiers > 0) {
        const equipmentList = ["Shield", "Boots", "Helmet", "Pants", "Shoulderguards", "Breastplate", "Gambeson"];
        for (let i = 0; i < equipmentList.length; i++) {
            if (game.equipment[equipmentList[i]].locked !== 0) continue;
            const healthBonus = game.equipment[equipmentList[i]].healthCalculated;
            const level = game.equipment[equipmentList[i]].level;
            health += healthBonus * level;
        }
    }
    health *= game.resources.trimps.maxSoldiers;
    if (game.goldenUpgrades.Battle.currentBonus > 0) {
        health *= game.goldenUpgrades.Battle.currentBonus + 1;
    }
    if (game.portal.Toughness.level > 0) {
        health *= ((game.portal.Toughness.level * game.portal.Toughness.modifier) + 1);
    }
    if (game.portal.Toughness_II.level > 0) {
        health *= ((game.portal.Toughness_II.level * game.portal.Toughness_II.modifier) + 1);
    }
    if (game.portal.Resilience.level > 0) {
        health *= (Math.pow(game.portal.Resilience.modifier + 1, game.portal.Resilience.level));
    }
	
    health *= game.challenges.Frigid.getTrimpMult();
	
    health *= game.challenges.Mayhem.getTrimpMult();

    health *= game.challenges.Pandemonium.getTrimpMult();
	
    health *= game.challenges.Desolation.getTrimpMult();

    const geneticist = game.jobs.Geneticist;
    if (geneticist.owned > 0) {
        health *= (Math.pow(1.01, game.global.lastLowGen));
    }
    if (stance && game.global.formation > 0) {
        let formStrength = 0.5;
        if (game.global.formation === 1) formStrength = 4;
        health *= formStrength;
    }
    if (game.global.challengeActive === "Life") {
        health *= game.challenges.Life.getHealthMult();
    } else if (challengeActive("Balance")) {
        health *= game.challenges.Balance.getHealthMult();
    } else if (typeof game.global.dailyChallenge.pressure !== 'undefined') {
        health *= (dailyModifiers.pressure.getMult(game.global.dailyChallenge.pressure.strength, game.global.dailyChallenge.pressure.stacks));
    }
    if (mutations.Magma.active()) {
        const mult = mutations.Magma.getTrimpDecay();
        // oxlint-disable-next-line no-unused-vars -- faithful legacy port: dead local — verified not a live bug (#92)
        const lvls = game.global.world - mutations.Magma.start() + 1;
        health *= mult;
    }
    const heirloomBonus = calcHeirloomBonus("Shield", "trimpHealth", 0, true);
    if (heirloomBonus > 0) {
        health *= ((heirloomBonus / 100) + 1);
    }
    if (game.global.radioStacks > 0) {
        health *= (1 - (game.global.radioStacks * 0.1));
    }
    if (game.global.totalSquaredReward > 0) {
        health *= (1 + (game.global.totalSquaredReward / 100));
    }
    if (game.jobs.Amalgamator.owned > 0) {
        health *= game.jobs.Amalgamator.getHealthMult();
    }
    if (game.talents.voidPower.purchased && game.global.voidBuff) {
        const amt = (game.talents.voidPower2.purchased) ? ((game.talents.voidPower3.purchased) ? 65 : 35) : 15;
        health *= (1 + (amt / 100));
    }
    return health;
}

export function highDamageShield(): void {
    if (game.global.challengeActive !== "Daily" && game.global.ShieldEquipped.name == getPageSetting('highdmg')) {
        globalThis.critCC = getPlayerCritChance();
        globalThis.critDD = getPlayerCritDamageMult();
        globalThis.trimpAA = (calcHeirloomBonus("Shield", "trimpAttack", 1, true) / 100);
    }
    if (game.global.challengeActive === "Daily" && game.global.ShieldEquipped.name == getPageSetting('dhighdmg')) {
        globalThis.critCC = getPlayerCritChance();
        globalThis.critDD = getPlayerCritDamageMult();
        globalThis.trimpAA = (calcHeirloomBonus("Shield", "trimpAttack", 1, true) / 100);
    }
}

export function getCritMulti(high?: boolean): number {

    let critChance = getPlayerCritChance();
    let CritD = getPlayerCritDamageMult();

    if (
        high &&
        (getPageSetting('AutoStance') == 3 && getPageSetting('highdmg') != undefined && game.global.challengeActive !== "Daily") ||
        (getPageSetting('use3daily') == true && getPageSetting('dhighdmg') != undefined && game.global.challengeActive === "Daily")
    ) {
        highDamageShield();
        critChance = critCC;
        CritD = critDD;
    }

    const lowTierMulti = getMegaCritDamageMult(Math.floor(critChance));
    const highTierMulti = getMegaCritDamageMult(Math.ceil(critChance));
    const highTierChance = critChance - Math.floor(critChance)

    // Scruffy's doubleCrit ability + Shield doubleCrit mod (5.10.0): a second independent roll adds one
    // more crit tier with prob doubleCritChance, multiplying the mult by the mega-crit base per tier.
    const doubleCritChance = (typeof getPlayerDoubleCritChance === 'function') ? Math.min(getPlayerDoubleCritChance(), 1) : 0;
    const doubleCritFactor = 1 + doubleCritChance * (getMegaCritDamageMult(2) - 1);

    return ((1 - highTierChance) * lowTierMulti + highTierChance * highTierMulti) * doubleCritFactor * CritD
}

export function calcOurBlock(stance?: boolean): number {
    let block = 0;
    const gym = game.buildings.Gym;
    if (gym.owned > 0) {
        const gymStrength = gym.owned * gym.increase.by;
        block += gymStrength;
    }
    const shield = game.equipment.Shield;
    if (shield.blockNow && shield.level > 0) {
        const shieldStrength = shield.level * shield.blockCalculated;
        block += shieldStrength;
    }
    const trainer = game.jobs.Trainer;
    if (trainer.owned > 0) {
        let trainerStrength = trainer.owned * (trainer.modifier / 100);
        trainerStrength = calcHeirloomBonus("Shield", "trainerEfficiency", trainerStrength);
        block *= (trainerStrength + 1);
    }
    block *= game.resources.trimps.maxSoldiers;
    if (stance && game.global.formation === 3) {
        block *= 4;
    }
    const heirloomBonus = calcHeirloomBonus("Shield", "trimpBlock", 0, true);
    if (heirloomBonus > 0) {
        block *= ((heirloomBonus / 100) + 1);
    }
    if (game.global.radioStacks > 0) {
        block *= (1 - (game.global.radioStacks * 0.1));
    }
    return block;
}

export function calcOurDmg(minMaxAvg?: string, incStance?: boolean, incFlucts?: boolean): number | undefined {
    let number = getTrimpAttack();
    let fluctuation = .2;
    let maxFluct = -1;
    let minFluct = -1;
    if (game.jobs.Amalgamator.owned > 0) {
        number *= game.jobs.Amalgamator.getDamageMult();
    }
    if (game.challenges.Electricity.stacks > 0) {
        number *= (1 - (game.challenges.Electricity.stacks * 0.1));
    }
    if (getPageSetting('45stacks') == false && game.global.antiStacks > 0) {
        number *= ((game.global.antiStacks * game.portal.Anticipation.level * game.portal.Anticipation.modifier) + 1);
    }
    if (getPageSetting('45stacks') == true && game.global.antiStacks > 0) {
        number *= ((45 * game.portal.Anticipation.level * game.portal.Anticipation.modifier) + 1);
    }
    if (game.global.mapBonus > 0) {
        let mapBonus = game.global.mapBonus;
        if (game.talents.mapBattery.purchased && mapBonus === 10) mapBonus *= 2;
        number *= ((mapBonus * .2) + 1);
    }
    if (game.global.achievementBonus > 0) {
        number *= (1 + (game.global.achievementBonus / 100));
    }
    if (challengeActive("Discipline")) {
        fluctuation = .995;
    } else if (game.portal.Range.level > 0) {
        minFluct = fluctuation - (.02 * game.portal.Range.level);
    }
    if (game.global.challengeActive === "Decay") {
        number *= 5;
        number *= Math.pow(0.995, game.challenges.Decay.stacks);
    }
    if (game.global.roboTrimpLevel > 0) {
        number *= ((0.2 * game.global.roboTrimpLevel) + 1);
    }
    if (challengeActive("Lead") && ((game.global.world % 2) === 1)) {
        number *= 1.5;
    }
    if (game.goldenUpgrades.Battle.currentBonus > 0) {
        number *= game.goldenUpgrades.Battle.currentBonus + 1;
    }
    if (game.talents.voidPower.purchased && game.global.voidBuff) {
        const vpAmt = (game.talents.voidPower2.purchased) ? ((game.talents.voidPower3.purchased) ? 65 : 35) : 15;
        number *= ((vpAmt / 100) + 1);
    }
    if (game.global.totalSquaredReward > 0) {
        number *= ((game.global.totalSquaredReward / 100) + 1);
    }
    if (getPageSetting('fullice') == true && getEmpowerment() === "Ice") {
        number *= (Fluffy.isRewardActive('naturesWrath') ? 3 : 2);
    }
    if (getPageSetting('fullice') == false && getEmpowerment() === "Ice") {
        number *= (game.empowerments.Ice.getDamageModifier() + 1);
    }
    if (getEmpowerment() === "Poison" && getPageSetting('addpoison') == true) {
        number *= (1 + game.empowerments.Poison.getModifier());
        number *= 4;
    }
    if (game.talents.magmamancer.purchased) {
        number *= game.jobs.Magmamancer.getBonusPercent();
    }
    if (game.talents.stillRowing2.purchased) {
        number *= ((game.global.spireRows * 0.06) + 1);
    }
    if (game.global.voidBuff && game.talents.voidMastery.purchased) {
        number *= 5;
    }
    if (game.talents.healthStrength.purchased && mutations.Healthy.active()) {
        number *= ((0.15 * mutations.Healthy.cellCount()) + 1);
    }
    if (game.talents.herbalist.purchased) {
        number *= game.talents.herbalist.getBonus();
    }
	
    number *= game.challenges.Frigid.getTrimpMult();

    number *= game.challenges.Mayhem.getTrimpMult();

    number *= game.challenges.Pandemonium.getTrimpMult();
	
    number *= game.challenges.Desolation.getTrimpMult();

    if (game.global.sugarRush > 0) {
        number *= sugarRush.getAttackStrength();
    }
    if (playerSpireTraps.Strength.owned) {
        const strBonus = playerSpireTraps.Strength.getWorldBonus();
        number *= (1 + (strBonus / 100));
    }
    if (Fluffy.isRewardActive('voidSiphon') && game.stats.totalVoidMaps.value) {
        number *= (1 + (game.stats.totalVoidMaps.value * 0.05));
    }
    if (game.global.challengeActive === "Life") {
        number *= game.challenges.Life.getHealthMult();
    }
    if (game.singleRunBonuses.sharpTrimps.owned) {
        number *= 1.5;
    }
    if (game.global.uberNature === "Poison") {
        number *= 3;
    }
    if (incStance && game.talents.scry.purchased && game.global.formation === 4 && (mutations.Healthy.active() || mutations.Corruption.active())) {
        number *= 2;
    }
    if (game.global.challengeActive === "Daily" && game.talents.daily.purchased) {
        number *= 1.5;
    }
    if (challengeActive("Lead") && game.global.world % 2 === 1 && game.global.world !== 179) {
        number /= 1.5;
    }
    if (game.global.challengeActive === "Daily") {
        if (typeof game.global.dailyChallenge.minDamage !== 'undefined') {
            if (minFluct === -1) minFluct = fluctuation;
            minFluct += dailyModifiers.minDamage.getMult(game.global.dailyChallenge.minDamage.strength);
        }
        if (typeof game.global.dailyChallenge.maxDamage !== 'undefined') {
            if (maxFluct === -1) maxFluct = fluctuation;
            maxFluct += dailyModifiers.maxDamage.getMult(game.global.dailyChallenge.maxDamage.strength);
        }
        if (typeof game.global.dailyChallenge.oddTrimpNerf !== 'undefined' && ((game.global.world % 2) === 1)) {
            number *= dailyModifiers.oddTrimpNerf.getMult(game.global.dailyChallenge.oddTrimpNerf.strength);
        }
        if (typeof game.global.dailyChallenge.evenTrimpBuff !== 'undefined' && ((game.global.world % 2) === 0)) {
            number *= dailyModifiers.evenTrimpBuff.getMult(game.global.dailyChallenge.evenTrimpBuff.strength);
        }
        if (typeof game.global.dailyChallenge.rampage !== 'undefined') {
            number *= dailyModifiers.rampage.getMult(game.global.dailyChallenge.rampage.strength, game.global.dailyChallenge.rampage.stacks);
        }
    }
    number = calcHeirloomBonus("Shield", "trimpAttack", number)
    if (Fluffy.isActive()) {
        number *= Fluffy.getDamageModifier();
    }
    // Gamma Burst
    if (autoBattle.oneTimers.Burstier.owned === false) {
        if (gammaBurstPct > 0 && (calcOurHealth() / (calcBadGuyDmg(null, getEnemyMaxAttack(game.global.world, 50, 'Snimp', 1.0))) >= 5)) {
		number *= (gammaBurstPct + 1) / 5;
	}
    }
    if (autoBattle.oneTimers.Burstier.owned === true) {
        if (gammaBurstPct > 0 && (calcOurHealth() / (calcBadGuyDmg(null, getEnemyMaxAttack(game.global.world, 50, 'Snimp', 1.0))) >= 4)) {
		number *= (gammaBurstPct + 1) / 4;
	}
    }


    if (!incStance && game.global.formation !== 0) {
        number /= (game.global.formation === 2) ? 4 : 0.5;
    }

    let min = number;
    let max = number;
    let avg = number;

    min *= (getCritMulti(false) * 0.8);
    avg *= getCritMulti(false);
    max *= (getCritMulti(false) * 1.2);

    if (incFlucts) {
        if (minFluct > 1) minFluct = 1;
        if (maxFluct === -1) maxFluct = fluctuation;
        if (minFluct === -1) minFluct = fluctuation;

        min *= (1 - minFluct);
        max *= (1 + maxFluct);
        avg *= 1 + (maxFluct - minFluct) / 2;
    }

    if (minMaxAvg === "min") return min;
    else if (minMaxAvg === "max") return max;
    else if (minMaxAvg === "avg") return avg;
}

export function calcDailyAttackMod(number: number): number {
    if (game.global.challengeActive === "Daily") {
        if (typeof game.global.dailyChallenge.badStrength !== 'undefined') {
            number *= dailyModifiers.badStrength.getMult(game.global.dailyChallenge.badStrength.strength);
        }
        if (typeof game.global.dailyChallenge.badMapStrength !== 'undefined' && game.global.mapsActive) {
            number *= dailyModifiers.badMapStrength.getMult(game.global.dailyChallenge.badMapStrength.strength);
        }
        if (typeof game.global.dailyChallenge.bloodthirst !== 'undefined') {
            number *= dailyModifiers.bloodthirst.getMult(game.global.dailyChallenge.bloodthirst.strength, game.global.dailyChallenge.bloodthirst.stacks);
        }
    }
    return number;
}

export function badGuyChallengeMult(): number {
    let number=1;

    //WARNING! Something is afoot!
    //A few challenges
    if      (challengeActive("Meditate"))   number *= 1.5;
    else if (challengeActive("Watch"))      number *= 1.25;
    else if (game.global.challengeActive === "Corrupted")  number *= 3;
    else if (game.global.challengeActive === "Domination") number *= 2.5;
    else if (game.global.challengeActive === "Coordinate") number *= getBadCoordLevel();
    else if (game.global.challengeActive === "Scientist" && getScientistLevel() === 5) number *= 10;

    //Obliterated and Eradicated
    else if (game.global.challengeActive === "Obliterated" || game.global.challengeActive === "Eradicated"){
        let oblitMult = (game.global.challengeActive === "Eradicated") ? game.challenges.Eradicated.scaleModifier : 1e12;
        const zoneModifier = Math.floor(game.global.world / game.challenges[game.global.challengeActive].zoneScaleFreq);
        oblitMult *= Math.pow(game.challenges[game.global.challengeActive].zoneScaling, zoneModifier);
        number *= oblitMult
    }

    return number;
}

export function badGuyCritMult(enemy?: any, critPower: number = 2, block?: any, health?: any): number {
    //Pre-Init
    if (getPageSetting('IgnoreCrits') == 2) return 1;
    if (!enemy) enemy = getCurrentEnemy();
    if (!enemy || critPower <= 0) return 1;
    if (!block) block = game.global.soldierCurrentBlock;
    if (!health) health = game.global.soldierHealth;

    //Init
    let regular = 1;
    let challenge = 1;

    //Non-challenge crits
    if      (enemy.corrupted === 'corruptCrit') regular = 5;
    else if (enemy.corrupted === 'healthyCrit') regular = 7;
    else if (game.global.voidBuff === 'getCrit' && getPageSetting('IgnoreCrits') != 1) regular = 5;

    //Challenge crits
    const crushed = game.global.challengeActive === "Crushed";
    const critDaily = game.global.challengeActive === "Daily" && typeof game.global.dailyChallenge.crits !== 'undefined';

    //Challenge multiplier
    if (critDaily) challenge = dailyModifiers.crits.getMult(game.global.dailyChallenge.crits.strength);
    else if (crushed && health > block) challenge = 5;

    //Result -- Yep. Crits may crit! Yey!
    if (critPower === 2) return regular * challenge;
    else return Math.max(regular, challenge);
}

export function calcEnemyBaseAttack(type?: any, zone?: any, cell?: any, name?: any): number {
    //Pre-Init
    if (!type) type = (!game.global.mapsActive) ? "world" : (getCurrentMapObject().location === "Void" ? "void" : "map");
    if (!zone) zone = (type === "world" || !game.global.mapsActive) ? game.global.world : getCurrentMapObject().level;
    if (!cell) cell = (type === "world" || !game.global.mapsActive) ? getCurrentWorldCell().level : (getCurrentMapCell() ? getCurrentMapCell().level : 1);
    if (!name) name = getCurrentEnemy() ? getCurrentEnemy().name : "Snimp";

    //Init
    let attack = 50 * Math.sqrt(zone) * Math.pow(3.27, zone/2) - 10;

    //Zone 1
    if (zone === 1) {
        attack *= 0.35;
        attack = (0.2 * attack) + (0.75 * attack * (cell / 100));
    }

    //Zone 2
    else if (zone === 2) {
        attack *= 0.5;
        attack = (0.32 * attack) + (0.68 * attack * (cell / 100));
    }

    //Before Breaking the Planet
    else if (zone < 60) {
        attack = (0.375 * attack) + (0.7 * attack * (cell / 100));
        attack *= 0.85;
    }

    //After Breaking the Planet
    else {
        attack = (0.4 * attack) + (0.9 * attack * (cell / 100));
        attack *= Math.pow(1.15, zone - 59);
    }

    //Maps
    if (zone > 5 && type !== "world") attack *= 1.1;

    //Specific Imp
    if (name) attack *= game.badGuys[name].attack;

    return Math.floor(attack);
}


export function calcEnemyAttackCore(type?: any, zone?: any, cell?: any, name?: any, minOrMax?: boolean, customAttack?: number): number {
    //Pre-Init
    if (!type) type = (!game.global.mapsActive) ? "world" : (getCurrentMapObject().location === "Void" ? "void" : "map");
    if (!zone) zone = (type === "world" || !game.global.mapsActive) ? game.global.world : getCurrentMapObject().level;
    if (!cell) cell = (type === "world" || !game.global.mapsActive) ? getCurrentWorldCell().level : (getCurrentMapCell() ? getCurrentMapCell().level : 1);
    if (!name) name = getCurrentEnemy() ? getCurrentEnemy().name : "Snimp";

    //Init
    let attack = calcEnemyBaseAttack(type, zone, cell, name);

    //Spire - Overrides the base attack number
    if (type === "world" && game.global.spireActive) attack = calcSpire(99, "Snimp", "attack");

    //Map and Void Corruption
    if (type !== "world") {
        //Corruption
        const corruptionScale = calcCorruptionScale(game.global.world, 3);
        if (mutations.Magma.active()) attack *= corruptionScale / (type === "void" ? 1 : 2);
        else if (type === "void" && mutations.Corruption.active()) attack *= corruptionScale / 2;
    }

    //Use custom values instead
    if (customAttack) attack = customAttack;

    //WARNING! Check every challenge!
    //A few challenges
    if      (challengeActive("Meditate"))   attack *= 1.5;
    else if (challengeActive("Watch"))      attack *= 1.25;
    else if (game.global.challengeActive === "Corrupted")  attack *= 3;
    else if (game.global.challengeActive === "Scientist" && getScientistLevel() === 5) attack *= 10;

    //Coordinate
    if (game.global.challengeActive === "Coordinate") {
        let amt = 1;
        for (let i=1; i<zone; i++) amt = Math.ceil(amt * 1.25);
        attack *= amt;
    }
    if (game.global.challengeActive === "Frigid") { 
	attack *= game.challenges.Frigid.getEnemyMult();
    }

    //Dailies
    if (game.global.challengeActive === "Daily") {
        //Bad Strength
        if (typeof game.global.dailyChallenge.badStrength !== "undefined")
            attack *= dailyModifiers.badStrength.getMult(game.global.dailyChallenge.badStrength.strength);

        //Bad Map Strength
        if (typeof game.global.dailyChallenge.badMapStrength !== "undefined" && type !== "world")
            attack *= dailyModifiers.badMapStrength.getMult(game.global.dailyChallenge.badMapStrength.strength);

        //Bloodthirsty
        if (typeof game.global.dailyChallenge.bloodthirst !== 'undefined')
            attack *= dailyModifiers.bloodthirst.getMult(game.global.dailyChallenge.bloodthirst.strength, game.global.dailyChallenge.bloodthirst.stacks);

        //Empower
        if (typeof game.global.dailyChallenge.empower !== "undefined")
            attack *= dailyModifiers.empower.getMult(game.global.dailyChallenge.empower.strength, game.global.dailyChallenge.empower.stacks);
    }

    //Obliterated and Eradicated
    else if (game.global.challengeActive === "Obliterated" || game.global.challengeActive === "Eradicated") {
        let oblitMult = (game.global.challengeActive === "Eradicated") ? game.challenges.Eradicated.scaleModifier : 1e12;
        const zoneModifier = Math.floor(game.global.world / game.challenges[game.global.challengeActive].zoneScaleFreq);
        oblitMult *= Math.pow(game.challenges[game.global.challengeActive].zoneScaling, zoneModifier);
        attack *= oblitMult;
    }

    return minOrMax ? 0.8 * attack : 1.2 * attack;
}

export function calcSpecificEnemyAttack(critPower: number = 2, customBlock?: number, customHealth?: number): number {
    //Init
    const enemy = getCurrentEnemy();
    if (!enemy) return 1;

    //Init
    let attack  = calcEnemyAttackCore(undefined, undefined, undefined, undefined, undefined, enemy.attack);
        attack *= badGuyCritMult(enemy, critPower, customBlock, customHealth);

    //Challenges - considers the actual scenario for this enemy
    if (challengeActive("Nom") && typeof enemy.nomStacks !== 'undefined') attack *= Math.pow(1.25, enemy.nomStacks)
    if (challengeActive("Lead")) attack *= 1 + (0.04 * game.challenges.Lead.stacks);

    //Magneto Shriek
    if (game.global.usingShriek) attack *= game.mapUnlocks.roboTrimp.getShriekValue();

    //Ice
    if (getEmpowerment() === "Ice") attack *= game.empowerments.Ice.getCombatModifier();

    return Math.ceil(attack);
}

export function calcSpire(cell: number, name: string, what: string): number {
    let exitCell = cell;
    if (game.global.challengeActive !== "Daily" && isActiveSpireAT() && getPageSetting('ExitSpireCell') > 0 && getPageSetting('ExitSpireCell') <= 100)
        exitCell = (getPageSetting('ExitSpireCell') - 1);
    if (game.global.challengeActive === "Daily" && disActiveSpireAT() && getPageSetting('dExitSpireCell') > 0 && getPageSetting('dExitSpireCell') <= 100)
        exitCell = (getPageSetting('dExitSpireCell') - 1);
    const enemy = cell === 99 ? (exitCell === 99 ? game.global.gridArray[99].name : "Snimp") : name;
    let base = (what === "attack") ? game.global.getEnemyAttack(exitCell, enemy, false) : (calcEnemyBaseHealth(game.global.world, exitCell, enemy) * 2);
    if (game.global.universe === 2) {
        // U2 Mega-Spire (Z300, 1000 cells / 10 floors): the game's getSpireStats scales enemies by
        // Math.pow(200, spireLevel + 1) per floor, NOT by the U1 per-cell mod^cell. game.global.world
        // stays pinned at 300 for the whole spire, so the world-based branch below never advanced.
        // getEnemyAttack(...,false) already bakes in badGuys.attack once (as origAttack does), so only
        // the health path — whose base skips badGuys at world>=60 — needs the explicit multiply.
        if (what === "health") base *= game.badGuys[enemy][what];
        base *= Math.pow(200, game.global.spireLevel + 1);
        return base;
    }
    let mod = (what === "attack") ? 1.17 : 1.14;
    const spireNum = Math.floor((game.global.world - 100) / 100);
    if (spireNum > 1) {
        let modRaiser = 0;
        modRaiser += ((spireNum - 1) / 100);
        if (what === "attack") modRaiser *= 8;
        if (what === "health") modRaiser *= 2;
        mod += modRaiser;
    }
    base *= Math.pow(mod, exitCell);
    base *= game.badGuys[enemy][what];
    return base;
}

export function calcBadGuyDmg(enemy?: any, attack?: number, daily?: boolean, maxormin?: boolean, disableFlucts?: boolean): number {
    let number;
    if (enemy)
        number = enemy.attack;
    else
        number = attack;
    const fluctuation = .2;
    let maxFluct = -1;
    let minFluct = -1;

    if (!enemy && game.global.challengeActive) {
        if (game.global.challengeActive === "Coordinate") {
            number *= getBadCoordLevel();
        } else if (challengeActive("Meditate")) {
            number *= 1.5;
        } else if (enemy && challengeActive("Nom") && typeof enemy.nomStacks !== 'undefined') {
            number *= Math.pow(1.25, enemy.nomStacks);
        } else if (challengeActive("Watch")) {
            number *= 1.25;
        } else if (challengeActive("Lead")) {
            number *= (1 + (game.challenges.Lead.stacks * 0.04));
        } else if (game.global.challengeActive === "Scientist" && getScientistLevel() === 5) {
            number *= 10;
        } else if (game.global.challengeActive === "Corrupted") {
            number *= 3;
        } else if (game.global.challengeActive === "Domination") {
            if (game.global.lastClearedCell === 98) {
                number *= 2.5;
            } else number *= 0.1;
        } else if (game.global.challengeActive === "Obliterated" || game.global.challengeActive === "Eradicated") {
            let oblitMult = (game.global.challengeActive === "Eradicated") ? game.challenges.Eradicated.scaleModifier : 1e12;
            const zoneModifier = Math.floor(game.global.world / game.challenges[game.global.challengeActive].zoneScaleFreq);
            oblitMult *= Math.pow(game.challenges[game.global.challengeActive].zoneScaling, zoneModifier);
            number *= oblitMult;
        } else if (game.global.challengeActive === "Frigid") { 
	    number *= game.challenges.Frigid.getEnemyMult();
        }
        if (daily)
            number = calcDailyAttackMod(number);
    }
    if (!enemy && game.global.usingShriek) {
        number *= game.mapUnlocks.roboTrimp.getShriekValue();
    }

    if (!disableFlucts) {
        if (minFluct > 1) minFluct = 1;
        if (maxFluct === -1) maxFluct = fluctuation;
        if (minFluct === -1) minFluct = fluctuation;
        const min = Math.floor(number * (1 - minFluct));
        const max = Math.ceil(number + (number * maxFluct));
        return maxormin ? max : min;
    } else
        return number;
}

export function calcEnemyBaseHealth(zone: number, level: number, name: string): number {
    let health = 0;
    health += 130 * Math.sqrt(zone) * Math.pow(3.265, zone / 2);
    health -= 110;
    if (zone === 1 || zone === 2 && level < 10) {
        health *= 0.6;
        health = (health * 0.25) + ((health * 0.72) * (level / 100));
    } else if (zone < 60)
        health = (health * 0.4) + ((health * 0.4) * (level / 110));
    else {
        health = (health * 0.5) + ((health * 0.8) * (level / 100));
        health *= Math.pow(1.1, zone - 59);
    }
    if (zone < 60) {
        health *= 0.75;
        health *= game.badGuys[name].health;
    }
    return health;
}

export function calcEnemyHealth(world?: any, map?: boolean): number {
    world = !world ? game.global.world : world;
    let health = calcEnemyBaseHealth(world, 50, "Snimp");
    let corrupt = mutations.Corruption.active();
    let healthy = mutations.Healthy.active();
    if (map) {
        corrupt = false;
        healthy = false;
        if (game.global.universe === 1) {
            health *= 0.5;
        }
    }
    if (corrupt && !healthy) {
        const cptnum = getCorruptedCellsNum();
        const cpthlth = getCorruptScale("health");
        const cptpct = cptnum / 100;
        const hlthprop = cptpct * cpthlth;
        if (hlthprop >= 1)
            health *= hlthprop;
    }
    if (healthy) {
        const scales = Math.floor((game.global.world - 150) / 6);
        health *= 14 * Math.pow(1.05, scales);
        health *= 1.15;
    }
    if (game.global.challengeActive === "Obliterated" || game.global.challengeActive === "Eradicated") {
        let oblitMult = (game.global.challengeActive === "Eradicated") ? game.challenges.Eradicated.scaleModifier : 1e12;
        const zoneModifier = Math.floor(game.global.world / game.challenges[game.global.challengeActive].zoneScaleFreq);
        oblitMult *= Math.pow(game.challenges[game.global.challengeActive].zoneScaling, zoneModifier);
        health *= oblitMult;
    }
    if (game.global.challengeActive === "Coordinate") {
        health *= getBadCoordLevel();
    }
    if (challengeActive("Toxicity")) {
        health *= 2;
    }
    if (challengeActive("Lead")) {
        health *= (1 + (game.challenges.Lead.stacks * 0.04));
    }
    if (challengeActive("Balance")) {
        health *= 2;
    }
    if (challengeActive("Meditate")) {
        health *= 2;
    }
    if (game.global.challengeActive === 'Life') {
        health *= 11; // Parity fix (#22): game gives 1000% extra (11x); sibling at calcEnemyHealthCore agrees.
    }
    if (game.global.challengeActive === "Domination") {
        if (game.global.lastClearedCell === 98) {
            health *= 7.5;
        } else health *= 0.1;
    }
    if (game.global.challengeActive === "Frigid") { 
	health *= game.challenges.Frigid.getEnemyMult();
    }
    if (game.global.spireActive) {
        health = calcSpire(99, game.global.gridArray[99].name, 'health');
    }
    return health;
}

export function calcEnemyHealthCore(type?: any, zone?: any, cell?: any, name?: any, customHealth?: number): number {
    //Pre-Init
    if (!type) type = (!game.global.mapsActive) ? "world" : (getCurrentMapObject().location === "Void" ? "void" : "map");
    if (!zone) zone = (type === "world" || !game.global.mapsActive) ? game.global.world : getCurrentMapObject().level;
    if (!cell) cell = (type === "world" || !game.global.mapsActive) ? getCurrentWorldCell().level : (getCurrentMapCell() ? getCurrentMapCell().level : 1);
    if (!name) name = getCurrentEnemy() ? getCurrentEnemy().name : "Turtlimp";

    //Init
    let health = calcEnemyBaseHealth(zone, cell, name);

    //Spire - Overrides the base health number
    if (type === "world" && game.global.spireActive) health = calcSpire(99, "Snimp", "health");

    //Map and Void Corruption
    if (type !== "world") {
        //Corruption
        const corruptionScale = calcCorruptionScale(game.global.world, 10);
        if (mutations.Magma.active()) health *= corruptionScale / (type === "void" ? 1 : 2);
        else if (type === "void" && mutations.Corruption.active()) health *= corruptionScale / 2;
    }

    //Use a custom value instead
    if (customHealth) health = customHealth;

    //Challenges
    if (challengeActive("Balance"))    health *= 2;
    if (challengeActive("Meditate"))   health *= 2;
    if (challengeActive("Toxicity"))   health *= 2;
    if (game.global.challengeActive === "Life")       health *= 11;

    //Coordinate
    if (game.global.challengeActive === "Coordinate") {
        let amt = 1;
        for (let i=1; i<zone; i++) amt = Math.ceil(amt * 1.25);
        health *= amt;
    }

    //Dailies
    if (game.global.challengeActive === "Daily") {
        //Empower
        if (typeof game.global.dailyChallenge.empower !== "undefined")
            health *= dailyModifiers.empower.getMult(game.global.dailyChallenge.empower.strength, game.global.dailyChallenge.empower.stacks)

        //Bad Health
        if (typeof game.global.dailyChallenge.badHealth !== "undefined")
            health *= dailyModifiers.badHealth.getMult(game.global.dailyChallenge.badHealth.strength);

        //Bad Map Health
        if (typeof game.global.dailyChallenge.badMapHealth !== "undefined" && type !== "world")
            health *= dailyModifiers.badMapHealth.getMult(game.global.dailyChallenge.badMapHealth.strength);
    }

    //Obliterated + Eradicated
    if (game.global.challengeActive === "Obliterated" || game.global.challengeActive === "Eradicated") {
        let oblitMult = (game.global.challengeActive === "Eradicated") ? game.challenges.Eradicated.scaleModifier : 1e12;
        const zoneModifier = Math.floor(game.global.world / game.challenges[game.global.challengeActive].zoneScaleFreq);
        oblitMult *= Math.pow(game.challenges[game.global.challengeActive].zoneScaling, zoneModifier);
        health *= oblitMult;
    }
	
    if (game.global.challengeActive === "Frigid") { 
	health *= game.challenges.Frigid.getEnemyMult();
    }

    return health;
}

export function calcSpecificEnemyHealth(type?: any, zone?: any, cell?: any, forcedName?: string): number {
    //Pre-Init
    if (!type) type = (!game.global.mapsActive) ? "world" : (getCurrentMapObject().location === "Void" ? "void" : "map");
    if (!zone) zone = (type === "world" || !game.global.mapsActive) ? game.global.world : getCurrentMapObject().level;
    if (!cell) cell = (type === "world" || !game.global.mapsActive) ? getCurrentWorldCell().level : (getCurrentMapCell() ? getCurrentMapCell().level : 1);

    //Select our enemy
    const enemy = (type === "world") ? game.global.gridArray[cell-1] : game.global.mapGridArray[cell-1];
    if (!enemy) return -1;

    //Init
    const corrupt = enemy.corrupted && enemy.corrupted !== "none";
    const healthy = corrupt && enemy.corrupted.startsWith("healthy");
    const name = corrupt ? "Chimp" : (forcedName) ? forcedName : enemy.name;
    let health = calcEnemyHealthCore(type, zone, cell, name);

    //Challenges - considers the actual scenario for this enemy
    if (challengeActive("Lead")) health *= 1 + (0.04 * game.challenges.Lead.stacks);
    if (game.global.challengeActive === "Domination") {
        const lastCell = (type === "world") ? 100 : game.global.mapGridArray.length;
        if (cell < lastCell) health /= 10;
        else health *= 7.5;
    }

    //Map and Void Difficulty
    if (type !== "world") health *= getCurrentMapObject().difficulty;

    //Corruption
    else if (type === "world" && !healthy && (corrupt || mutations.Corruption.active() && cell === 100) && !game.global.spireActive) {
        health *= calcCorruptionScale(zone, 10);
        if (enemy.corrupted === "corruptTough") health *= 5;
    }

    //Healthy
    else if (type === "world" && healthy) {
        health *= calcCorruptionScale(zone, 14);
        if (enemy.corrupted === "healthyTough") health *= 7.5;
    }

    return health;
}


export function calcHDratio(map?: any): number {
    let ratio = 0;
    let ourBaseDamage = calcOurDmg("avg", false, true)!;

    //Shield
    highDamageShield();
    if (getPageSetting('AutoStance') == 3 && getPageSetting('highdmg') != undefined && game.global.challengeActive !== "Daily" && game.global.ShieldEquipped.name != getPageSetting('highdmg')) {
        ourBaseDamage /= getCritMulti(false);
        ourBaseDamage *= trimpAA;
        ourBaseDamage *= getCritMulti(true);
    }
    if (getPageSetting('use3daily') == true && getPageSetting('dhighdmg') != undefined && game.global.challengeActive === "Daily" && game.global.ShieldEquipped.name != getPageSetting('dhighdmg')) {
        ourBaseDamage /= getCritMulti(false);
        ourBaseDamage *= trimpAA;
        ourBaseDamage *= getCritMulti(true);
    }
    if (!map || map < 1) {
        ratio = calcEnemyHealth() / ourBaseDamage;
    }
    if (map || map >= 1)
        ratio = calcEnemyHealth(map, true) / ourBaseDamage;
    return ratio;
}

export function calcCurrentStance(): number | undefined {
    if (game.global.uberNature === "Wind" && getEmpowerment() === "Wind" && !game.global.mapsActive &&
        (
            (
                (game.global.challengeActive !== "Daily" && calcHDratio() < getPageSetting('WindStackingMinHD')) ||
                (game.global.challengeActive === "Daily" && calcHDratio() < getPageSetting('dWindStackingMinHD'))
            ) &&
            (
                (game.global.challengeActive !== "Daily" && game.global.world >= getPageSetting('WindStackingMin')) ||
                (game.global.challengeActive === "Daily" && game.global.world >= getPageSetting('dWindStackingMin')))
        ) ||
        (game.global.uberNature === "Wind" && getEmpowerment() === "Wind" && !game.global.mapsActive && checkIfLiquidZone() && getPageSetting('liqstack') == true)
    ) {
        return 15;
    } else {

        //Base Calc
        let ehealth = 1;
        if (game.global.fighting) {
            ehealth = (getCurrentEnemy().maxHealth - getCurrentEnemy().health);
        }
        const attacklow = calcOurDmg("max", false, true)!;
        let attackhigh = calcOurDmg("max", false, true)!;

        //Heirloom Calc
        highDamageShield();
        if (getPageSetting('AutoStance') == 3 && getPageSetting('highdmg') != undefined && game.global.challengeActive !== "Daily" && game.global.ShieldEquipped.name != getPageSetting('highdmg')) {
            attackhigh *= trimpAA;
            attackhigh *= getCritMulti(true);
        }
        if (getPageSetting('use3daily') == true && getPageSetting('dhighdmg') != undefined && game.global.challengeActive === "Daily" && game.global.ShieldEquipped.name != getPageSetting('dhighdmg')) {
            attackhigh *= trimpAA;
            attackhigh *= getCritMulti(true);
        }

        //Heirloom Switch
        if (ehealth > 0) {
            const hitslow = (ehealth / attacklow);
            const hitshigh = (ehealth / attackhigh);
            let stacks = 190;
            let usehigh = false;
            let stacksleft = 1;

            if (game.global.challengeActive !== "Daily" && getPageSetting('WindStackingMax') > 0) {
                stacks = getPageSetting('WindStackingMax');
            }
            if (game.global.challengeActive === "Daily" && getPageSetting('dWindStackingMax') > 0) {
                stacks = getPageSetting('dWindStackingMax');
            }
            if (game.global.uberNature === "Wind") {
                stacks += 100;
            }
            if (getEmpowerment() === "Wind") {
                stacksleft = (stacks - game.empowerments.Wind.currentDebuffPower);
            }

            //Use High
            if (
                (getEmpowerment() !== "Wind") ||
                (game.empowerments.Wind.currentDebuffPower >= stacks) ||
                (hitshigh >= stacksleft) ||
                (game.global.mapsActive) ||
                (game.global.challengeActive !== "Daily" && game.global.world < getPageSetting('WindStackingMin')) ||
                (game.global.challengeActive === "Daily" && game.global.world < getPageSetting('dWindStackingMin'))
            ) {
                usehigh = true;
            }
            if (
                (getPageSetting('wsmax') > 0 && game.global.world >= getPageSetting('wsmax') && !game.global.mapsActive && getEmpowerment() === "Wind" && game.global.challengeActive !== "Daily" && getPageSetting('wsmaxhd') > 0 && calcHDratio() < getPageSetting('wsmaxhd')) ||
                (getPageSetting('dwsmax') > 0 && game.global.world >= getPageSetting('dwsmax') && !game.global.mapsActive && getEmpowerment() === "Wind" && game.global.challengeActive === "Daily" && getPageSetting('dwsmaxhd') > 0 && calcHDratio() < getPageSetting('dwsmaxhd'))
            ) {
                usehigh = false;
            }

            //Low
            if (!usehigh) {
                if (
                    (game.empowerments.Wind.currentDebuffPower >= stacks) ||
                    ((hitslow * 4) > stacksleft)
                ) {
                    return 2;
                } else if ((hitslow) > stacksleft) {
                    return 0;
                } else {
                    return 1;
                }

                //High
            } else if (usehigh) {
                if (
                    (getEmpowerment() !== "Wind") ||
                    (game.empowerments.Wind.currentDebuffPower >= stacks) ||
                    ((hitshigh * 4) > stacksleft) ||
                    (game.global.mapsActive) ||
                    (game.global.challengeActive !== "Daily" && game.global.world < getPageSetting('WindStackingMin')) ||
                    (game.global.challengeActive === "Daily" && game.global.world < getPageSetting('dWindStackingMin'))
                ) {
                    return 12;
                } else if ((hitshigh) > stacksleft) {
                    return 10;
                } else {
                    return 11;
                }
            }
        }
    }
}

// calcBaseDamageInX: the dead copy that lived here was removed in Phase 3 (#51). It passed `false`
// as calcOurDmg's 3rd arg, but stance.ts's copy (3rd arg `true`) is spread after calc and won at
// global scope, so this copy was unreachable. stance.ts:31 is now the sole definition.

//Radon

export function rMutationAttack(cell: any): number {
    let baseAttack;
    let addAttack = 0;
    if (cell.cs) {
        baseAttack = RgetEnemyMaxAttack(game.global.world, cell.level, cell.name);
    }
    else
        baseAttack = RgetEnemyMaxAttack(game.global.world, cell.level, cell.name);
    if (cell.cc) addAttack = u2Mutations.types.Compression.attack(cell, baseAttack);
    if (cell.u2Mutation.indexOf('NVA') !== -1) baseAttack *= 0.01;
    else if (cell.u2Mutation.indexOf('NVX') !== -1) baseAttack *= 10;
    baseAttack += addAttack;
    baseAttack *= Math.pow(1.01, (game.global.world - 201));
    return baseAttack;
}

export function rCalcMutationAttack(): number | undefined {
    let number;
    let highest = 1;

    for (let i = 0; i < game.global.gridArray.length; i++) {
        let hasRage = game.global.gridArray[i].u2Mutation.includes('RGE');
        if (game.global.gridArray[i].u2Mutation.includes('CMP') && !game.global.gridArray[i].u2Mutation.includes('RGE')) {
            for (let y = i + 1; y < i + u2Mutations.types.Compression.cellCount(); y++) {
                if (game.global.gridArray[y].u2Mutation.includes('RGE')) {
                    hasRage = true;
                    break;
                }
            }
        }
        const cell = game.global.gridArray[i];
        if (cell.u2Mutation && cell.u2Mutation.length) {
            highest = Math.max(rMutationAttack(cell) * (hasRage ? (u2Mutations.tree.Unrage.purchased ? 4 : 5) : 1), highest);
            number = highest;
        }
    }

    return number;
}

export function rMutationHealth(cell: any): number {
    let baseHealth;
    let addHealth = 0;
    baseHealth = RcalcEnemyBaseHealth(game.global.world, cell.level, cell.name);
    if (cell.cc) addHealth = u2Mutations.types.Compression.health(cell, baseHealth);
    if (cell.u2Mutation.indexOf('NVA') !== -1) baseHealth *= 0.01;
    else if (cell.u2Mutation.indexOf('NVX') !== -1) baseHealth *= 0.1;
    baseHealth += addHealth;
    baseHealth *= 2;
    baseHealth *= Math.pow(1.02, (game.global.world - 201));
    return baseHealth;
}

export function rCalcMutationHealth(): number | undefined {
    let health: any;
    let highest = 1;
    for (let i = 0; i < game.global.gridArray.length; i++) {
        const cell = game.global.gridArray[i];
        if (cell.u2Mutation && cell.u2Mutation.length) {
            highest = Math.max(rMutationHealth(cell), highest);
            health = highest;
        }
    }
    return health;
}

//Radon

export function RgetCritMulti(): number {

    const critChance = getPlayerCritChance();
    const CritD = getPlayerCritDamageMult();

    const lowTierMulti = getMegaCritDamageMult(Math.floor(critChance));
    const highTierMulti = getMegaCritDamageMult(Math.ceil(critChance));
    const highTierChance = critChance - Math.floor(critChance)

    // Scruffy's doubleCrit ability + Shield doubleCrit mod (5.10.0): a second independent roll adds one
    // more crit tier with prob doubleCritChance, multiplying the mult by the mega-crit base per tier.
    const doubleCritChance = (typeof getPlayerDoubleCritChance === 'function') ? Math.min(getPlayerDoubleCritChance(), 1) : 0;
    const doubleCritFactor = 1 + doubleCritChance * (getMegaCritDamageMult(2) - 1);

    return ((1 - highTierChance) * lowTierMulti + highTierChance * highTierMulti) * doubleCritFactor * CritD
}

export function RcalcOurDmg(minMaxAvg?: string, equality?: boolean, _unusedIncFlucts?: unknown): number {

    // Base + equipment
    let number = 6;
    const equipmentList = ["Dagger", "Mace", "Polearm", "Battleaxe", "Greatsword", "Arbalest"];
    for (let i = 0; i < equipmentList.length; i++) {
        if (game.equipment[equipmentList[i]].locked !== 0) continue;
        const attackBonus = game.equipment[equipmentList[i]].attackCalculated;
        const level = game.equipment[equipmentList[i]].level;
        number += attackBonus * level;
    }

    // Soldiers
    number *= game.resources.trimps.maxSoldiers;

    // Smithies
    number *= game.buildings.Smithy.getMult();

    // Achievement bonus
    number *= 1 + (game.global.achievementBonus / 100);

    // Power
    number += (number * game.portal.Power.radLevel * game.portal.Power.modifier);

    // Map Bonus
    let mapBonus = game.global.mapBonus;
    if (game.talents.mapBattery.purchased && mapBonus === 10) mapBonus *= 2;
    number *= 1 + (mapBonus * .2);

    // Tenacity
    number *= game.portal.Tenacity.getMult();

    // Hunger
    number *= game.portal.Hunger.getMult();

    // Ob
    number *= game.portal.Observation.getMult();

    // Champ
    number *= game.portal.Championism.getMult();

    // Robotrimp
    number *= 1 + (0.2 * game.global.roboTrimpLevel);

    // Mayhem Completions
    number *= game.challenges.Mayhem.getTrimpMult();

    // Panda Completions
    number *= game.challenges.Pandemonium.getTrimpMult();
	
    // Deso Completions
    number *= game.challenges.Desolation.getTrimpMult();

    // Heirloom
    number *= 1 + calcHeirloomBonus('Shield', 'trimpAttack', 1, true) / 100;

    // Frenzy perk
    if (getPageSetting('Rcalcfrenzy') == true) {
        number *= 1 + (0.5 * game.portal.Frenzy.radLevel);
    }

    // Golden Upgrade
    number *= 1 + game.goldenUpgrades.Battle.currentBonus;

    // Herbalist Mastery
    if (game.talents.herbalist.purchased) {
        number *= game.talents.herbalist.getBonus();
    }

    // Challenge 2 or 3 reward
    number *= 1 + (game.global.totalSquaredReward / 100);

    // Fluffy Modifier
    number *= Fluffy.getDamageModifier();

    // Pspire Strength Towers
    number *= 1 + (playerSpireTraps.Strength.getWorldBonus() / 100);

    // Sharp Trimps
    if (game.singleRunBonuses.sharpTrimps.owned) {
        number *= 1.5;
    }

    // Sugar rush event bonus
    if (game.global.sugarRush) {
        number *= sugarRush.getAttackStrength();
    }
    
    //Mutations
    if (u2Mutations.tree.Attack.purchased) {
	number *= 1.5;
    }
    if (u2Mutations.tree.Brains.purchased) {
        number *= u2Mutations.tree.Brains.getBonus();
    }
    if (u2Mutations.tree.GeneAttack.purchased) {
	number *= 10;
    }

    if (game.global.world > 200) {
       number *= game.global.novaMutStacks > 0 ? (u2Mutations.types.Nova.trimpAttackMult() * 0.98) : 1;
    }

    // Challenges
    if (game.global.challengeActive === "Melt") {
        number *= 5 * Math.pow(0.99, game.challenges.Melt.stacks);
    }
    if (game.global.challengeActive === "Unbalance") {
        number *= game.challenges.Unbalance.getAttackMult();
    }
    if (game.global.challengeActive === "Quagmire") {
        number *= game.challenges.Quagmire.getExhaustMult();
    }
    if (game.global.challengeActive === "Revenge") {
        number *= game.challenges.Revenge.getMult();
    }
    if (game.global.challengeActive === "Quest") {
        number *= game.challenges.Quest.getAttackMult();
    }
    if (game.global.challengeActive === "Archaeology") {
        number *= game.challenges.Archaeology.getStatMult("attack");
    }
    if (game.global.challengeActive === "Berserk") {
        number *= game.challenges.Berserk.getAttackMult();
    }
    if (game.challenges.Nurture.boostsActive() === true) {
        number *= game.challenges.Nurture.getStatBoost();
    }
    if (game.global.challengeActive === "Alchemy") {
        number *= alchObj.getPotionEffect("Potion of Strength");
    }
    if (game.global.challengeActive === 'Smithless') {
	if (game.challenges.Smithless.fakeSmithies > 0) number *= Math.pow(1.25, game.challenges.Smithless.fakeSmithies);
    }
    if (game.global.challengeActive === "Desolation") {
	number *= game.challenges.Desolation.trimpAttackMult();
    }

    // Dailies
    let minDailyMod = 1;
    let maxDailyMod = 1;
    if (game.global.challengeActive === "Daily") {
        // Legs for Days mastery
        number *= game.talents.daily.purchased ? 1.5 : 1;
        // Min damage reduced (additive)
        minDailyMod -= typeof game.global.dailyChallenge.minDamage !== 'undefined' ? dailyModifiers.minDamage.getMult(game.global.dailyChallenge.minDamage.strength) : 0;
        // Max damage increased (additive)
        maxDailyMod += typeof game.global.dailyChallenge.maxDamage !== 'undefined' ? dailyModifiers.maxDamage.getMult(game.global.dailyChallenge.maxDamage.strength) : 0;
        // Minus attack on odd zones
        number += typeof game.global.dailyChallenge.oddTrimpNerf !== 'undefined' && ((game.global.world % 2) === 1) ? dailyModifiers.oddTrimpNerf.getMult(game.global.dailyChallenge.oddTrimpNerf.strength) : 0;
        // Bonus attack on even zones
        number -= typeof game.global.dailyChallenge.evenTrimpBuff !== 'undefined' && ((game.global.world % 2) === 0) ? dailyModifiers.evenTrimpBuff.getMult(game.global.dailyChallenge.evenTrimpBuff.strength) : 0;
        // Rampage Daily mod
        number -= typeof game.global.dailyChallenge.rampage !== 'undefined' ? dailyModifiers.rampage.getMult(game.global.dailyChallenge.rampage.strength, game.global.dailyChallenge.rampage.stacks) : 0;
    }

    //Scruffy Level 20 - Dailies
    // Game applies this unconditionally (main.js spireDaily); the old `stringVersion >= '5.7.0'`
    // guard was a lexicographic string compare that turned false once the game passed 5.10.0.
    number *= Fluffy.isRewardActive('SADailies') && game.global.challengeActive === "Daily" ? Fluffy.rewardConfig.SADailies.attackMod() : 1;

    // AB
    number *= autoBattle.bonuses.Stats.getMult();

    // Equality
    if (getPageSetting('Rcalcmaxequality') == 1 && !equality) {
        number *= Math.pow(game.portal.Equality.getModifier(1), game.portal.Equality.scalingCount);
    } else if (getPageSetting('Rcalcmaxequality') == 0 && !equality) {
        number *= game.portal.Equality.getMult(1);
    } else {
        number *= 1;
    }

    // Gamma Burst
    if (autoBattle.oneTimers.Burstier.owned === false) {
        if (gammaBurstPct > 0 && (RcalcOurHealth() / (RcalcBadGuyDmg(null, RgetEnemyMaxAttack(game.global.world, 50, 'Snimp', 1.0))) >= 5)) {
		number *= (gammaBurstPct + 1) / 5;
	}
    }
    if (autoBattle.oneTimers.Burstier.owned === true) {
        if (gammaBurstPct > 0 && (RcalcOurHealth() / (RcalcBadGuyDmg(null, RgetEnemyMaxAttack(game.global.world, 50, 'Snimp', 1.0))) >= 4)) {
		number *= (gammaBurstPct + 1) / 4;
	}
    }

    // Average out crit damage
    number *= RgetCritMulti();

    switch (minMaxAvg) {
        case 'min':
            return number * (game.portal.Range.radLevel * 0.02 + 0.8) * minDailyMod;
        case 'max':
            return number * 1.2 * maxDailyMod;
        case 'avg':
            return number;
    }

    return number;
}

export function RcalcOurHealth(): number {

    //Health

    let health = 50;

    if (game.resources.trimps.maxSoldiers > 0) {
        const equipmentList = ["Shield", "Boots", "Helmet", "Pants", "Shoulderguards", "Breastplate", "Gambeson"];
        for (let i = 0; i < equipmentList.length; i++) {
            if (game.equipment[equipmentList[i]].locked !== 0) continue;
            const healthBonus = game.equipment[equipmentList[i]].healthCalculated;
            const level = game.equipment[equipmentList[i]].level;
            health += healthBonus * level;
        }
    }

    health *= game.resources.trimps.maxSoldiers;
    if (game.buildings.Smithy.owned > 0) {
        health *= game.buildings.Smithy.getMult()
    }

    //Antenna Array
    health *= game.buildings.Antenna.owned >= 10 ? game.jobs.Meteorologist.getExtraMult() : 1;
    
    if (game.portal.Toughness.radLevel > 0) {
        health *= ((game.portal.Toughness.radLevel * game.portal.Toughness.modifier) + 1);
    }

    if (game.portal.Resilience.radLevel > 0) {
        health *= (Math.pow(game.portal.Resilience.modifier + 1, game.portal.Resilience.radLevel));
    }

    if (Fluffy.isRewardActive("healthy")) {
        health *= 1.5;
    }

    // Scruffy's scaledHealth ability (5.10.0): +50% max HP per Scruffy level, up to ~16.5x at L31.
    // Mirrors main.js soldierHealthMax; the fork previously checked only the older flat `healthy`.
    if (Fluffy.isRewardActive("scaledHealth")) {
        health *= Fluffy.rewardConfig.scaledHealth.mult();
    }

    if (game.portal.Observation.radLevel > 0) {
        health *= game.portal.Observation.getMult();
    }

    if (game.global.mayhemCompletions > 0) {
        health *= game.challenges.Mayhem.getTrimpMult();
    }

    if (game.global.pandCompletions > 0) {
        health *= game.challenges.Pandemonium.getTrimpMult();
    }
	
    if (game.global.desoCompletions > 0) {
        health *= game.challenges.Desolation.getTrimpMult();
    }

    //AutoBattle
    health *= autoBattle.bonuses.Stats.getMult();

    //Shield
    health = calcHeirloomBonus("Shield", "trimpHealth", health);

    if (game.portal.Championism.radLevel > 0) {
        health *= game.portal.Championism.getMult();
    }

    if (game.goldenUpgrades.Battle.currentBonus > 0) {
        health *= game.goldenUpgrades.Battle.currentBonus + 1;
    }

    if (game.global.totalSquaredReward > 0) {
        health *= (1 + (game.global.totalSquaredReward / 100));
    }
	
    //Mutations
    if (u2Mutations.tree.Health.purchased)	{
	health *= 1.5;
    }
    if (u2Mutations.tree.GeneHealth.purchased) {
	health *= 10;
    }

    //Challenges
    if (game.global.challengeActive === "Revenge" && game.challenges.Revenge.stacks > 0) {
        health *= game.challenges.Revenge.getMult();
    }

    if (game.global.challengeActive === "Wither" && game.challenges.Wither.trimpStacks > 0) {
        health *= game.challenges.Wither.getTrimpHealthMult();
    }

    if (game.global.challengeActive === "Insanity") {
        health *= game.challenges.Insanity.getHealthMult();
    }

    if (game.global.challengeActive === "Berserk") {
        if (game.challenges.Berserk.frenzyStacks > 0) {
            health *= 0.5;
        }
        if (game.challenges.Berserk.frenzyStacks <= 0) {
            health *= game.challenges.Berserk.getHealthMult(true);
        }
    }
    
    if (game.global.challengeActive === "Desolation") {
	health *= game.challenges.Desolation.trimpHealthMult();
    }

    if (game.challenges.Nurture.boostsActive() === true) {
        health *= game.challenges.Nurture.getStatBoost();
    }

    health *= alchObj.getPotionEffect('Potion of Strength');
	
    if (game.global.challengeActive === 'Smithless') {
	if (game.challenges.Smithless.fakeSmithies > 0) health *= Math.pow(1.25, game.challenges.Smithless.fakeSmithies);
    }

    if (typeof game.global.dailyChallenge.pressure !== 'undefined') {
        health *= (dailyModifiers.pressure.getMult(game.global.dailyChallenge.pressure.strength, game.global.dailyChallenge.pressure.stacks));
    }

    //Prismatic Shield and Shield Layer, scales with multiple Scruffy shield layers
    health *= Fluffy.isRewardActive('shieldlayer') ? 1 + (getEnergyShieldMult() * (1 + Fluffy.isRewardActive('shieldlayer'))) : 1 + getEnergyShieldMult();

    return health;
}

export function RcalcDailyAttackMod(number: number): number {
    if (game.global.challengeActive === "Daily") {
        if (typeof game.global.dailyChallenge.badStrength !== 'undefined') {
            number *= dailyModifiers.badStrength.getMult(game.global.dailyChallenge.badStrength.strength);
        }
	if (typeof game.global.dailyChallenge.badHealth !== 'undefined') {
            number *= dailyModifiers.badHealth.getMult(game.global.dailyChallenge.badHealth.strength);
        }
        if (typeof game.global.dailyChallenge.badMapStrength !== 'undefined' && game.global.mapsActive) {
            number *= dailyModifiers.badMapStrength.getMult(game.global.dailyChallenge.badMapStrength.strength);
        }
	if (typeof game.global.dailyChallenge.empower !== 'undefined') {
            number *= dailyModifiers.empower.getMult(game.global.dailyChallenge.empower.strength, game.global.dailyChallenge.empower.stacks);
        }
        if (typeof game.global.dailyChallenge.bloodthirst !== 'undefined') {
            number *= dailyModifiers.bloodthirst.getMult(game.global.dailyChallenge.bloodthirst.strength, game.global.dailyChallenge.bloodthirst.stacks);
        }
    }
    return number;
}

export function RcalcDailyHealthMod(number: number): number {
    if (game.global.challengeActive === "Daily") {
	if (typeof game.global.dailyChallenge.badHealth !== 'undefined') {
            number *= dailyModifiers.badHealth.getMult(game.global.dailyChallenge.badHealth.strength);
        }
	if (typeof game.global.dailyChallenge.empower !== 'undefined') {
            number *= dailyModifiers.empower.getMult(game.global.dailyChallenge.empower.strength, game.global.dailyChallenge.empower.stacks);
        }
    }
    return number;
}

export function RcalcBadGuyDmg(enemy?: any, attack?: number, equality?: boolean): number {
    let number;
    // oxlint-disable-next-line no-unused-vars -- faithful legacy port: dead local — verified not a live bug (#92)
    const highest = 1;
    // oxlint-disable-next-line no-unused-vars -- faithful legacy port: dead local — verified not a live bug (#92)
    let mute = false;

    if (enemy)
        number = enemy.attack;
    else
        number = attack;
	
    if (game.global.world > 200 && getPageSetting('Rmutecalc') > 0 && game.global.world >= getPageSetting('Rmutecalc')) {
        mute = true;
        number = rCalcMutationAttack();
    }
    if (game.global.challengeActive === "Extermination" && getPageSetting('Rexterminateon') == true && getPageSetting('Rexterminatecalc') == true) {
        number = RgetEnemyMaxAttack(game.global.world, 90, 'Mantimp', 1.0)
    }
    if (game.portal.Equality.radLevel > 0 && getPageSetting('Rcalcmaxequality') == 0 && !equality) {
        number *= game.portal.Equality.getMult();
    } else if (game.portal.Equality.radLevel > 0 && getPageSetting('Rcalcmaxequality') >= 1 && game.portal.Equality.scalingCount > 0 && !equality) {
        number *= Math.pow(game.portal.Equality.modifier, game.portal.Equality.scalingCount);
    }
    if (game.global.challengeActive === "Daily") {
        number = RcalcDailyAttackMod(number);
    }
    if (game.global.challengeActive === "Unbalance") {
        number *= 1.5;
    }
    if (game.global.challengeActive === "Wither" && game.challenges.Wither.enemyStacks > 0) {
        number *= game.challenges.Wither.getEnemyAttackMult();
    }
    if (game.global.challengeActive === "Archaeology") {
        number *= game.challenges.Archaeology.getStatMult("enemyAttack");
    }
    if (game.global.challengeActive === "Mayhem") {
        number *= game.challenges.Mayhem.getEnemyMult();
        number *= game.challenges.Mayhem.getBossMult();
    }
    if (game.global.challengeActive === "Pandemonium") {
        number *= game.challenges.Pandemonium.getEnemyMult();
        number *= game.challenges.Pandemonium.getBossMult();
    }
    if (game.global.challengeActive === "Desolation") {
	number *= game.challenges.Desolation.getEnemyMult();
    }
    if (game.global.challengeActive === "Storm") {
        number *= game.challenges.Storm.getAttackMult();
    }
    if (game.global.challengeActive === "Berserk") {
        number *= 1.5;
    }
    if (game.global.challengeActive === "Exterminate") {
        number *= game.challenges.Exterminate.getSwarmMult();
    }
    if (game.global.challengeActive === "Nurture") {
        number *= 2;
        if (game.buildings.Laboratory.owned > 0) {
            number *= game.buildings.Laboratory.getEnemyMult();
        }
    }
    if (game.global.challengeActive === "Alchemy") {
        number *= ((alchObj.getEnemyStats(false, false)) + 1);
    }
    if (game.global.challengeActive === "Hypothermia") {
        number *= game.challenges.Hypothermia.getEnemyMult();
    }
    if (game.global.challengeActive === "Glass") {
        number *= game.challenges.Glass.attackMult();
    }
    if (!enemy && game.global.usingShriek) {
        number *= game.mapUnlocks.roboTrimp.getShriekValue();
    }
    return number;
}

export function RcalcEnemyBaseHealth(world: number, level: number, name: string): number {
    let amt = 0;
    const healthBase = (game.global.universe === 2) ? 10e7 : 130;
    amt += healthBase * Math.sqrt(world) * Math.pow(3.265, world / 2);
    amt -= 110;
    if (world === 1 || world === 2 && level < 10) {
        amt *= 0.6;
        amt = (amt * 0.25) + ((amt * 0.72) * (level / 100));
    } else if (world < 60)
        amt = (amt * 0.4) + ((amt * 0.4) * (level / 110));
    else {
        amt = (amt * 0.5) + ((amt * 0.8) * (level / 100));
        amt *= Math.pow(1.1, world - 59);
    }
    if (world < 60) amt *= 0.75;
    if (world > 5 && game.global.mapsActive) amt *= 1.1;
    amt *= game.badGuys[name].health;
    if (game.global.universe === 2) {
        const part1 = (world > 60) ? 60 : world;
        let part2 = (world - 60);
        if (part2 < 0) part2 = 0;
        amt *= Math.pow(1.4, part1);
        amt *= Math.pow(1.32, part2);
        // Parity fix (#22): mirror the game's z300 hard-scaling (getEnemyHealth, config.js).
        let part3 = (world - 300);
        if (part3 < 0) part3 = 0;
        amt *= Math.pow(1.15, part3);
    }
    return Math.floor(amt);
}

export function RcalcEnemyHealth(world?: any): number | undefined {
    // oxlint-disable-next-line no-unused-vars -- faithful legacy port: dead local — verified not a live bug (#92)
    const highest = 1;
    let mute = false;
    let health: any;
    if (game.global.world > 200 && getPageSetting('Rmutecalc') > 0 && game.global.world >= getPageSetting('Rmutecalc')) {
	mute = true;
        health = rCalcMutationHealth();
    }

    if (world == false) world = game.global.world;

    if (!mute) health = RcalcEnemyBaseHealth(world, 50, "Snimp");

    if (game.global.challengeActive === "Extermination" && getPageSetting('Rexterminateon') == true && getPageSetting('Rexterminatecalc') == true) {
        health = RcalcEnemyBaseHealth(world, 90, "Beetlimp");
    }
    if (game.global.challengeActive === "Daily") {
        health = RcalcDailyHealthMod(health);
    }
    if (game.global.challengeActive === "Unbalance") {
        health *= 2;
    }
    if (game.global.challengeActive === "Quest") {
        health *= game.challenges.Quest.getHealthMult();
    }
    if (game.global.challengeActive === "Revenge" && game.global.world % 2 === 0) {
        health *= 10;
    }
    if (game.global.challengeActive === "Archaeology") {

    }
    if (game.global.challengeActive === "Mayhem") {
        health *= game.challenges.Mayhem.getEnemyMult();
        health *= game.challenges.Mayhem.getBossMult();
    }
    if (game.global.challengeActive === "Pandemonium") {
        health *= game.challenges.Pandemonium.getBossMult();
    }
    if (game.global.challengeActive === "Desolation") {
	health *= game.challenges.Desolation.getEnemyMult();
    }
    if (game.global.challengeActive === "Storm") {
        health *= game.challenges.Storm.getHealthMult();
    }
    if (game.global.challengeActive === "Berserk") {
        health *= 1.5;
    }
    if (game.global.challengeActive === "Exterminate") {
        health *= game.challenges.Exterminate.getSwarmMult();
    }
    if (game.global.challengeActive === "Nurture") {
        health *= 2;
        if (game.buildings.Laboratory.owned > 0) {
            health *= game.buildings.Laboratory.getEnemyMult();
        }
    }
    if (game.global.challengeActive === "Alchemy") {
        health *= ((alchObj.getEnemyStats(false, false)) + 1);
    }
    if (game.global.challengeActive === "Hypothermia") {
        health *= game.challenges.Hypothermia.getEnemyMult();
    }
    if (game.global.challengeActive === "Glass") {
        health *= 0.01;
        health *= game.challenges.Glass.healthMult();
    }
    if (game.global.challengeActive === 'Smithless') {
	if (game.challenges.Smithless.fakeSmithies > 0) health *= Math.pow(1.25, game.challenges.Smithless.fakeSmithies);
    }

    return health;
}

export function RcalcEnemyHealthMod(world?: any, cell?: any, name?: any): number | undefined {
	
    // oxlint-disable-next-line no-unused-vars -- faithful legacy port: dead local — verified not a live bug (#92)
    const highest = 1;
    let mute = false;
    let health: any;
    if (game.global.world > 200 && getPageSetting('Rmutecalc') > 0 && game.global.world >= getPageSetting('Rmutecalc')) {
        mute = true;
        health = rCalcMutationHealth();
    }

    if (world == false) world = game.global.world;

    if (!mute) health = RcalcEnemyBaseHealth(world, cell, name);
    
    if (game.global.challengeActive === "Daily") {
        health = RcalcDailyHealthMod(health);
    }
    if (game.global.challengeActive === "Unbalance") {
        health *= 2;
    }
    if (game.global.challengeActive === "Quest") {
        health *= game.challenges.Quest.getHealthMult();
    }
    if (game.global.challengeActive === "Revenge" && game.global.world % 2 === 0) {
        health *= 10;
    }
    if (game.global.challengeActive === "Archaeology") {

    }
    if (game.global.challengeActive === "Mayhem") {
        health *= game.challenges.Mayhem.getEnemyMult();
        health *= game.challenges.Mayhem.getBossMult();
    }
    if (game.global.challengeActive === "Pandemonium") {
        health *= game.challenges.Pandemonium.getBossMult();
    }
    if (game.global.challengeActive === "Desolation") {
	health *= game.challenges.Desolation.getEnemyMult();
    }
    if (game.global.challengeActive === "Storm") {
        health *= game.challenges.Storm.getHealthMult();
    }
    if (game.global.challengeActive === "Berserk") {
        health *= 1.5;
    }
    if (game.global.challengeActive === "Exterminate") {
        health *= game.challenges.Exterminate.getSwarmMult();
    }
    if (game.global.challengeActive === "Nurture") {
        health *= 2;
        if (game.buildings.Laboratory.owned > 0) {
            health *= game.buildings.Laboratory.getEnemyMult();
        }
    }
    if (game.global.challengeActive === "Alchemy") {
        health *= ((alchObj.getEnemyStats(false, false)) + 1);
    }
    if (game.global.challengeActive === "Hypothermia") {
        health *= game.challenges.Hypothermia.getEnemyMult();
    }
    if (game.global.challengeActive === "Glass") {
        health *= 0.01;
        health *= game.challenges.Glass.healthMult();
    }
    if (game.global.challengeActive === 'Smithless') {
	if (game.challenges.Smithless.fakeSmithies > 0) health *= Math.pow(1.25, game.challenges.Smithless.fakeSmithies);
    }
    return health;
}

export function RcalcHDratio(): number {
    let ratio = 0;
    const ourBaseDamage = RcalcOurDmg("avg", false, true);

    ratio = (RcalcEnemyHealth(game.global.world)! / ourBaseDamage);
    return ratio;
}

export function getTotalHealthMod(): number {
    let healthMulti = 1;

    // Smithies
    healthMulti *= game.buildings.Smithy.getMult();

    // Perks
    healthMulti *= 1 + (game.portal.Toughness.radLevel * game.portal.Toughness.modifier);
    healthMulti *= Math.pow(1 + game.portal.Resilience.modifier, game.portal.Resilience.radLevel);
    healthMulti *= game.portal.Observation.getMult();
    healthMulti *= game.portal.Championism.getMult();

    // Scruffy's +50% health bonus
    healthMulti *= (Fluffy.isRewardActive("healthy") ? 1.5 : 1);

    // Heirloom Health bonus
    healthMulti *= 1 + calcHeirloomBonus('Shield', 'trimpHealth', 1, true) / 100;

    // Golden Upgrades
    healthMulti *= 1 + game.goldenUpgrades.Battle.currentBonus;

    // C2/3
    healthMulti *= 1 + game.global.totalSquaredReward / 100;

    // Challenge Multis
    healthMulti *= (game.global.challengeActive === 'Revenge') ? game.challenges.Revenge.getMult() : 1;
    healthMulti *= (game.global.challengeActive === 'Wither') ? game.challenges.Wither.getTrimpHealthMult() : 1;
    healthMulti *= (game.global.challengeActive === 'Insanity') ? game.challenges.Insanity.getHealthMult() : 1;
    healthMulti *= (game.global.challengeActive === 'Berserk') ?
        (game.challenges.Berserk.frenzyStacks > 0) ? 0.5 : game.challenges.Berserk.getHealthMult(true) :
        1;
    healthMulti *= (game.challenges.Nurture.boostsActive() === true) ? game.challenges.Nurture.getStatBoost() : 1;
    healthMulti *= (game.global.challengeActive === 'Alchemy') ? alchObj.getPotionEffect("Potion of Strength") : 1;
    healthMulti *= (game.global.challengeActive === 'Desolation') ? game.challenges.Desolation.trimpHealthMult() : 1;

    // Daily mod
    healthMulti *= (typeof game.global.dailyChallenge.pressure !== 'undefined') ? dailyModifiers.pressure.getMult(game.global.dailyChallenge.pressure.strength, game.global.dailyChallenge.pressure.stacks) : 1;

    // Mayhem
    healthMulti *= game.challenges.Mayhem.getTrimpMult();

    // Panda
    healthMulti *= game.challenges.Pandemonium.getTrimpMult();
	
    // Deso
    healthMulti *= game.challenges.Desolation.getTrimpMult();
    

    //Mutations
    if (u2Mutations.tree.Health.purchased) {
	healthMulti *= 1.5;
    }
    if (u2Mutations.tree.GeneHealth.purchased) {
	healthMulti *= 10;
    }
    
    // AB
    healthMulti *= autoBattle.bonuses.Stats.getMult();

    // Prismatic
    healthMulti *= 1 + getEnergyShieldMult();

    return healthMulti;
}

export function stormdynamicHD(): number {
    let stormzone = 0;
    let stormHD = 0;
    let stormmult = 0;
    let stormHDzone = 0;
    let stormHDmult = 1;
    if (getPageSetting('Rstormon') == true && game.global.world > 5 && (game.global.challengeActive === "Storm" && getPageSetting('Rstormzone') > 0 && getPageSetting('RstormHD') > 0 && getPageSetting('Rstormmult') > 0)) {
        stormzone = getPageSetting('Rstormzone');
        stormHD = getPageSetting('RstormHD');
        stormmult = getPageSetting('Rstormmult');
        stormHDzone = (game.global.world - stormzone);
        stormHDmult = (stormHDzone === 0) ? stormHD : Math.pow(stormmult, stormHDzone) * stormHD;
    }
    return stormHDmult;
}

export function desodynamicHD(): number {
    let desozone = 0;
    let desoHD = 0;
    let desomult = 0;
    let desoHDzone = 0;
    let desoHDmult = 1;
    if (getPageSetting('Rdesoon') == true && game.global.world > 5 && (game.global.challengeActive === "Desolation" && getPageSetting('Rdesozone') > 0 && getPageSetting('RdesoHD') > 0 && getPageSetting('Rdesomult') > 0)) {
        desozone = getPageSetting('Rdesozone');
        desoHD = getPageSetting('RdesoHD');
        desomult = getPageSetting('Rdesomult');
        desoHDzone = (game.global.world - desozone);
        desoHDmult = (desoHDzone === 0) ? desoHD : Math.pow(desomult, desoHDzone) * desoHD;
    }
    return desoHDmult;
}
