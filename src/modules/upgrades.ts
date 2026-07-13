// TRUE-TS (Phase 1 · Wave 2, #29): faithful port of legacy/modules/upgrades.js, now
// strict-typed. Upgrade purchase, giga-station automation, golden upgrades (U1 + U2 radon
// R* family). Native/AT globals typed ambient in src/game/*.d.ts and read by bare name (no
// imports → esbuild byte-identical to the @ts-nocheck original, the conversion gate).
// getPageSetting/debug/setPageSetting imported from converted utils. TWO seam notes:
//   1. upgradeList + RupgradeList are read by still-legacy query.js by bare name, so they
//      publish to globalThis (shared-var seam) rather than module-scoped var.
//   2. (#63 removed the dead module-scoped needGymystic() function — never invoked, and kept
//      unexported only to avoid the bridge overwriting AutoTrimps2.js's same-named boolean, which
//      is now itself retired.)
//
// IDIOMATIC (Phase 2 · #51): un-minified behind the proof-net (tests/upgrades.characterization.test.ts
//   pins every branch first; L0 backstop ∅). var→const/let, ==→=== where operands are provably the
//   same runtime type. Kept LOOSE deliberately: every getPageSetting(...) comparison (getPageSetting
//   is polymorphic — boolean/string/number/int[]/undefined, see utils.ts) and getEmpowerment()==
//   "Wind" (getEmpowerment returns string|false). Every numeric literal + formula shape is preserved
//   exactly (balance is sacrosanct).
import { getPageSetting, debug, setPageSetting } from './utils'

//Helium

globalThis.upgradeList = ['Miners', 'Scientists', 'Coordination', 'Speedminer', 'Speedlumber', 'Speedfarming', 'Speedscience', 'Speedexplorer', 'Megaminer', 'Megalumber', 'Megafarming', 'Megascience', 'Efficiency', 'TrainTacular', 'Trainers', 'Explorers', 'Blockmaster', 'Battle', 'Bloodlust', 'Bounty', 'Egg', 'Anger', 'Formations', 'Dominance', 'Barrier', 'UberHut', 'UberHouse', 'UberMansion', 'UberHotel', 'UberResort', 'Trapstorm', 'Gigastation', 'Shieldblock', 'Potency', 'Magmamancers'];
MODULES["upgrades"] = {};
MODULES["upgrades"].targetFuelZone = true;
MODULES["upgrades"].customMetalRatio = 0.5; //Change the Custom Delta factor instead

export function gigaTargetZone() {
    //Init
    let targetZone = 59;
    const daily = game.global.challengeActive === 'Daily';
    const runningC2 = game.global.runningChallengeSquared;
    const heliumChallengeActive = game.global.challengeActive && game.challenges[game.global.challengeActive].heliumThrough;

    //Try setting target zone to the zone we finish our current challenge or do our void maps
    const voidZone = daily ? getPageSetting('DailyVoidMod') : getPageSetting('VoidMaps');
    const challengeZone = heliumChallengeActive ? game.challenges[game.global.challengeActive].heliumThrough : 0;

    //Also consider the zone we configured our portal to be used
    let portalZone = 0;
    if (autoTrimpSettings.AutoPortal.selected === "Helium Per Hour") portalZone = daily ? getPageSetting('dHeHrDontPortalBefore') : getPageSetting('HeHrDontPortalBefore');
    else if (autoTrimpSettings.AutoPortal.selected === "Custom") portalZone = daily ? getPageSetting('dCustomAutoPortal') : getPageSetting('CustomAutoPortal');

    //Finds a target zone for when doing c2
    let c2zone = 0;
    if (getPageSetting('c2runnerstart') == true && getPageSetting("c2runnerportal") > 0) c2zone = getPageSetting("c2runnerportal");
    else if (getPageSetting("FinishC2") > 0) c2zone = getPageSetting("FinishC2");

    //Set targetZone
    if (!runningC2) targetZone = Math.max(targetZone, voidZone, challengeZone, portalZone - 1);
    else targetZone = Math.max(targetZone, c2zone - 1);

    //Target Fuel Zone
    if (daily && getPageSetting("AutoGenDC") != 0) targetZone = Math.min(targetZone, 230);
    if (runningC2 && getPageSetting("AutoGenC2") != 0) targetZone = Math.min(targetZone, 230);
    if (MODULES.upgrades.targetFuelZone && (getPageSetting("fuellater") >= 1 || getPageSetting("beforegen") != 0)) targetZone = Math.min(targetZone, Math.max(230, getPageSetting("fuellater")));

    //Failsafe
    if (targetZone < 60) {
        targetZone = Math.max(65, game.global.highestLevelCleared);
        debug("Auto Gigastation: Warning! Unable to find a proper targetZone. Using your HZE instead", "general", "*rocket");
    }

    return targetZone;
}

export function autoGiga(targetZone?: number, metalRatio = 0.5, slowDown = 10, customBase?: number) {
    //Pre Init
    if (!targetZone || targetZone < 60) targetZone = gigaTargetZone();

    //Init
    const base = customBase ? customBase : getPageSetting('FirstGigastation');
    const baseZone = game.global.world;
    const rawPop = game.resources.trimps.max - game.unlocks.impCount.TauntimpAdded;
    const gemsPS = getPerSecBeforeManual("Dragimp");
    const metalPS = getPerSecBeforeManual("Miner");
    const megabook = game.global.frugalDone ? 1.6 : 1.5;

    //Calculus
    const nGigas = Math.min(Math.floor(targetZone - 60), Math.floor(targetZone / 2 - 25), Math.floor(targetZone / 3 - 12), Math.floor(targetZone / 5), Math.floor(targetZone / 10 + 17), 39);
    const metalDiff = Math.max(0.1 * metalRatio * metalPS / gemsPS, 1);

    let delta = 3;
    for (let i = 0; i < 10; i++) {
        //Population guess
        let pop = 6 * Math.pow(1.2, nGigas) * 10000;
        pop *= base * (1 - Math.pow(5 / 6, nGigas + 1)) + delta * (nGigas + 1 - 5 * (1 - Math.pow(5 / 6, nGigas + 1)));
        pop += rawPop - base * 10000;
        pop /= rawPop;

        //Delta
        delta = Math.pow(megabook, targetZone - baseZone);
        delta *= metalDiff * slowDown * pop;
        delta /= Math.pow(1.75, nGigas);
        delta = Math.log(delta);
        delta /= Math.log(1.4);
        delta /= nGigas;
    }

    //Returns a number in the x.yy format, and as a number, not a string
    return +(Math.round((delta + "e+2") as any) + "e-2");
}

export function firstGiga(forced?: boolean) {
    //Build our first giga if: A) Has more than 2 Warps & B) Can't afford more Coords & C)* Lacking Health or Damage & D)* Has run at least 1 map stack or if forced to
    // #68: was `challengeActive === "Daily" ? getPageSetting('dMaxMapBonushealth') : getPageSetting('MaxMapBonushealth')`.
    // 'dMaxMapBonushealth' has NEVER been createSetting'd — not in this repo's whole history — so on a
    // Daily this evaluated to false, and the `game.global.mapBonus >= maxHealthMaps` test below became
    // `mapBonus >= 0`: ALWAYS TRUE. The map-bonus-health gate on firstGiga was therefore entirely absent
    // on dailies. Collapsed onto the setting that does exist rather than minting a daily twin: the very
    // next disjunct reads 'MaxMapBonuslimit' — the sibling map-bonus cap, in this same expression —
    // with no daily variant at all, so unconditional is this code's own convention. Minting
    // 'dMaxMapBonushealth' would be a new user-facing setting with a new default: a product decision,
    // not a phantom fix. ⚠️ This DOES change daily behaviour (that is the bug): firstGiga is no longer
    // force-allowed at mapBonus 0-1 on a Daily. No balance literal changed — 'MaxMapBonushealth' keeps
    // its own default of 10.
    const maxHealthMaps = getPageSetting('MaxMapBonushealth');
    const s = !(getPageSetting('CustomDeltaFactor') > 20);
    const a = game.buildings.Warpstation.owned >= 2;
    const b = !canAffordCoordinationTrimps() || game.global.world >= 230 && !canAffordTwoLevel(game.upgrades.Coordination);
    const c = s || !enoughHealth || !enoughDamage;
    const d = s || game.global.mapBonus >= 2 || game.global.mapBonus >= getPageSetting('MaxMapBonuslimit') || game.global.mapBonus >= maxHealthMaps;
    if (!forced && !(a && b && c && d)) return false;

    //Define Base and Delta for this run
    const base = game.buildings.Warpstation.owned;
    const deltaZ = getPageSetting('CustomTargetZone') >= 60 ? getPageSetting('CustomTargetZone') : undefined;
    const deltaM = MODULES["upgrades"].customMetalRatio > 0 ? MODULES["upgrades"].customMetalRatio : undefined;
    const deltaS = getPageSetting('CustomDeltaFactor') >= 1 ? getPageSetting('CustomDeltaFactor') : undefined;
    const delta = autoGiga(deltaZ, deltaM, deltaS);

    //Save settings
    setPageSetting('FirstGigastation', base);
    setPageSetting('DeltaGigastation', delta);

    //Log
    debug("Auto Gigastation: Setting pattern to " + base + "+" + delta, "general", "*rocket");

    return true;
}

export function buyUpgrades() {

    //#43: Metal challenge — Efficiency doubles player mining, the only metal source during Metal.
    //Rush it above every other upgrade below the configured zone. Opt-in; OFF = unchanged.
    if (getPageSetting('MetalEfficiencyPriority') && game.global.challengeActive === 'Metal' &&
        game.global.world < getPageSetting('MetalEfficiencyZone')) {
        const efficiency = game.upgrades['Efficiency'];
        if (efficiency && efficiency.allowed > efficiency.done && canAffordTwoLevel(efficiency)) {
            buyUpgrade('Efficiency', true, true);
        }
    }

    for (const upgrade of upgradeList) {
        const gameUpgrade = game.upgrades[upgrade];
        const available = gameUpgrade.allowed > gameUpgrade.done && canAffordTwoLevel(gameUpgrade);
        const fuckbuildinggiga = (bwRewardUnlocked("AutoStructure") === true && bwRewardUnlocked("DecaBuild") && getPageSetting('hidebuildings') == true && getPageSetting('BuyBuildingsNew') == 0);

        //Coord & Amals
        if (upgrade === 'Coordination' && (getPageSetting('BuyUpgradesNew') == 2 || !canAffordCoordinationTrimps())) continue;
        if (upgrade === 'Coordination' && getPageSetting('amalcoord') == true && getPageSetting('amalcoordhd') > 0 && calcHDratio() < getPageSetting('amalcoordhd') && ((getPageSetting('amalcoordt') < 0 && (game.global.world < getPageSetting('amalcoordz') || getPageSetting('amalcoordz') < 0)) || (getPageSetting('amalcoordt') > 0 && getPageSetting('amalcoordt') > game.jobs.Amalgamator.owned && (game.resources.trimps.realMax() / game.resources.trimps.getCurrentSend()) > 2000))) continue;

        //WS
        if (
            upgrade === 'Coordination' && getEmpowerment() == "Wind" &&
            (
                (getPageSetting('AutoStance') == 3 && game.global.challengeActive !== "Daily" && getPageSetting('WindStackingMin') > 0 && game.global.world >= getPageSetting('WindStackingMin') && calcHDratio() < 5) ||
                (getPageSetting('use3daily') == true && game.global.challengeActive === "Daily" && getPageSetting('dWindStackingMin') > 0 && game.global.world >= getPageSetting('dWindStackingMin') && calcHDratio() < 5)
            )
        ) continue;

        if (
            upgrade === 'Coordination' &&
            (
                (getPageSetting('AutoStance') == 3 && game.global.challengeActive !== "Daily" && getPageSetting('wsmax') > 0 && getPageSetting('wsmaxhd') > 0 && game.global.world >= getPageSetting('wsmax') && calcHDratio() < getPageSetting('wsmaxhd')) ||
                (getPageSetting('use3daily') == true && game.global.challengeActive === "Daily" && getPageSetting('dwsmax') > 0 && getPageSetting('dwsmaxhd') > 0 && game.global.world >= getPageSetting('dwsmax') && calcHDratio() < getPageSetting('dwsmaxhd'))
            )
        ) continue;

        //Gigastations
        if (upgrade === 'Gigastation' && !fuckbuildinggiga) {
            if (getPageSetting("AutoGigas") && game.upgrades.Gigastation.done === 0 && !firstGiga()) continue;
            else if (game.buildings.Warpstation.owned < (Math.floor(game.upgrades.Gigastation.done * getPageSetting('DeltaGigastation')) + getPageSetting('FirstGigastation'))) continue;
        }

        //Other
        if (upgrade === 'Shieldblock' && !getPageSetting('BuyShieldblock')) continue;
        if (upgrade === 'Gigastation' && !fuckbuildinggiga && (game.global.lastWarp ? game.buildings.Warpstation.owned < (Math.floor(game.upgrades.Gigastation.done * getPageSetting('DeltaGigastation')) + getPageSetting('FirstGigastation')) : game.buildings.Warpstation.owned < getPageSetting('FirstGigastation'))) continue;
        if (upgrade === 'Bloodlust' && game.global.challengeActive === 'Scientist' && getPageSetting('BetterAutoFight')) continue;

        if (!available) continue;
        if (game.upgrades.Scientists.done < game.upgrades.Scientists.allowed && upgrade !== 'Scientists') continue;
        buyUpgrade(upgrade, true, true);
        debug('Upgraded ' + upgrade, "upgrades", "*upload2");
    }
}

//Radon

globalThis.RupgradeList = ['Miners', 'Scientists', 'Coordination', 'Speedminer', 'Speedlumber', 'Speedfarming', 'Speedscience', 'Speedexplorer', 'Megaminer', 'Megalumber', 'Megafarming', 'Megascience', 'Efficiency', 'Explorers', 'Battle', 'Bloodlust', 'Bounty', 'Egg', 'Rage', 'Prismatic', 'Prismalicious', 'Formations', 'Dominance', 'UberHut', 'UberHouse', 'UberMansion', 'UberHotel', 'UberResort', 'Trapstorm', 'Potency'];

export function RbuyUpgrades() {

    for (const upgrade of RupgradeList) {
        const gameUpgrade = game.upgrades[upgrade];
        const available = gameUpgrade.allowed > gameUpgrade.done && canAffordTwoLevel(gameUpgrade);

        //Coord
        if (upgrade === 'Coordination' && (getPageSetting('RBuyUpgradesNew') == 2 || !canAffordCoordinationTrimps())) continue;

        //Other
        if (!available) continue;
        if (game.upgrades.Scientists.done < game.upgrades.Scientists.allowed && upgrade !== 'Scientists') continue;
        buyUpgrade(upgrade, true, true);
        debug('Upgraded ' + upgrade, "upgrades", "*upload2");
    }
}

export function RautoGoldenUpgradesAT(setting: string) {
    let num = getAvailableGoldenUpgrades();
    let setting2;
    if (num === 0) return;
    if (setting === "Radon")
        setting2 = "Helium";
    if ((!game.global.dailyChallenge.seed && !game.global.runningChallengeSquared && autoTrimpSettings.RAutoGoldenUpgrades.selected === "Radon" && getPageSetting('Rradonbattle') > 0 && game.goldenUpgrades.Helium.purchasedAt.length >= getPageSetting('Rradonbattle')) || (game.global.dailyChallenge.seed && autoTrimpSettings.RdAutoGoldenUpgrades.selected === "Radon" && getPageSetting('Rdradonbattle') > 0 && game.goldenUpgrades.Helium.purchasedAt.length >= getPageSetting('Rdradonbattle')))
        setting2 = "Battle";
    if (setting === "Battle")
        setting2 = "Battle";
    if ((!game.global.dailyChallenge.seed && !game.global.runningChallengeSquared && autoTrimpSettings.RAutoGoldenUpgrades.selected === "Battle" && getPageSetting('Rbattleradon') > 0 && game.goldenUpgrades.Battle.purchasedAt.length >= getPageSetting('Rbattleradon')) || (game.global.dailyChallenge.seed && autoTrimpSettings.RdAutoGoldenUpgrades.selected === "Battle" && getPageSetting('Rdbattleradon') > 0 && game.goldenUpgrades.Battle.purchasedAt.length >= getPageSetting('Rdbattleradon')))
        setting2 = "Helium";
    if (setting === "Void" || setting === "Void + Battle")
        setting2 = "Void";
    if (game.global.challengeActive === "Mayhem" || game.global.challengeActive === "Pandemonium" || game.global.challengeActive === "Desolation") {
        setting2 = "Battle";
    }
    const success = buyGoldenUpgrade(setting2);
    if (!success && setting2 === "Void") {
        num = getAvailableGoldenUpgrades();
        if (num === 0) return;
        if ((autoTrimpSettings.RAutoGoldenUpgrades.selected === "Void" && !game.global.dailyChallenge.seed && !game.global.runningChallengeSquared) || (autoTrimpSettings.RdAutoGoldenUpgrades.selected === "Void" && game.global.dailyChallenge.seed))
            setting2 = "Helium";
        if (((autoTrimpSettings.RAutoGoldenUpgrades.selected === "Void" && getPageSetting('Rvoidheliumbattle') > 0 && game.global.world >= getPageSetting('Rvoidheliumbattle')) || (autoTrimpSettings.RdAutoGoldenUpgrades.selected === "Void" && getPageSetting('Rdvoidheliumbattle') > 0 && game.global.world >= getPageSetting('Rdvoidheliumbattle'))) || ((autoTrimpSettings.RAutoGoldenUpgrades.selected === "Void + Battle" && !game.global.dailyChallenge.seed && !game.global.runningChallengeSquared) || (autoTrimpSettings.RdAutoGoldenUpgrades.selected === "Void + Battle" && game.global.dailyChallenge.seed) || (autoTrimpSettings.RcAutoGoldenUpgrades.selected === "Void + Battle" && game.global.runningChallengeSquared)))
            setting2 = "Battle";
        buyGoldenUpgrade(setting2);
    }
}
