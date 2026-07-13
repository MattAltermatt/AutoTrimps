// TRUE TS (Phase 1 · #30): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/maps.js.
// Free identifiers resolve via the bridge at runtime, typed ambient. Behaviour-preserving: any body edits are TYPE-ONLY.
// Auto-map decision engine (U1 autoMap + U2 RautoMap), 304 game.* touches. getPageSetting/
// debug/setPageSetting from converted utils. ALL maps state vars were globals in the original
// (16 top-level var + ~41 sloppy implicit globals) and MANY are read by other modules
// (equipment/upgrades/mapfunctions/other/AutoTrimps2/SettingsGUI), so every one is published to
// globalThis (shared-var seam). The 16 keep their init values; the 41 implicit ones are
// initialised undefined below so strict-mode bare writes resolve. MODULES["maps"] kept verbatim.
import { getPageSetting, debug, setPageSetting } from './utils'

// Formerly-implicit-global maps state (see header) — published so external readers + strict-mode
// writes both work.
globalThis.enoughDamage = undefined; globalThis.enoughHealth = undefined; globalThis.shouldFarm = undefined; globalThis.RenoughDamage = undefined; globalThis.RenoughHealth = undefined; globalThis.RshouldFarm = undefined; globalThis.RneedToVoid = undefined; globalThis.RdoVoids = undefined; globalThis.Rshoulddoquest = undefined; globalThis.Rquestshieldzone = undefined; globalThis.Rquestequalityscale = undefined; globalThis.RshouldDoMaps = undefined; globalThis.Rshouldfragfarm = undefined; globalThis.Rshouldtimefarm = undefined; globalThis.Rdshouldtimefarm = undefined; globalThis.Rshouldsmithyfarm = undefined; globalThis.Rshouldtributefarm = undefined; globalThis.Rshoulddobogs = undefined; globalThis.Rshoulddopraid = undefined; globalThis.Rdshoulddopraid = undefined; globalThis.Rshouldinsanityfarm = undefined; globalThis.Rshouldalchfarm = undefined; globalThis.Rshouldhypofarm = undefined; globalThis.Rhyposhouldwood = undefined; globalThis.Rshouldstormfarm = undefined; globalThis.Rshoulddesofarm = undefined; globalThis.Rshouldequipfarm = undefined; globalThis.Rshouldshipfarm = undefined; globalThis.Rshouldmayhem = undefined; globalThis.Rshouldpanda = undefined; globalThis.RvanillaMAZ = undefined; globalThis.RdoMaxMapBonus = undefined; globalThis.Rinsanityfarm = undefined; globalThis.Rstormfarm = undefined; globalThis.Rdesofarm = undefined; globalThis.Rshipfarm = undefined; globalThis.Ralchfarm = undefined; globalThis.Rshouldcastle = undefined; globalThis.Rhypofarm = undefined; globalThis.Requipfarm = undefined; globalThis.RlastMapWeWereIn = undefined;

//Helium
MODULES.maps = {};
MODULES.maps.numHitsSurvived = 8;
MODULES.maps.LeadfarmingCutoff = 10;
MODULES.maps.NomfarmingCutoff = 10;
MODULES.maps.NomFarmStacksCutoff = [7, 30, 100];
MODULES.maps.MapTierZone = [72, 47, 16];
MODULES.maps.MapTier0Sliders = [9, 9, 9, "Mountain"];
MODULES.maps.MapTier1Sliders = [9, 9, 9, "Depths"];
MODULES.maps.MapTier2Sliders = [9, 9, 9, "Random"];
MODULES.maps.MapTier3Sliders = [9, 9, 9, "Random"];
MODULES.maps.preferGardens = !getPageSetting("PreferMetal");
MODULES.maps.SpireFarm199Maps = true;
MODULES.maps.shouldFarmCell = 59;
MODULES.maps.SkipNumUnboughtPrestiges = 2;
MODULES.maps.UnearnedPrestigesRequired = 2;

globalThis.doVoids = false;
globalThis.needToVoid = false;
globalThis.needPrestige = false;
globalThis.skippedPrestige = false;
globalThis.scryerStuck = false;
globalThis.shouldDoMaps = false;
globalThis.mapTimeEstimate = 0;
globalThis.lastMapWeWereIn = null;
globalThis.preSpireFarming = false;
globalThis.spireMapBonusFarming = false;
globalThis.spireTime = 0;
globalThis.doMaxMapBonus = false;
globalThis.vanillaMapatZone = false;
globalThis.farmingWonder = false;
globalThis.additionalCritMulti = getPlayerCritChance() > 2 ? 25 : 5;

export function updateAutoMapsStatus(get?: any) {

    let status: any;
    const minSp = getPageSetting('MinutestoFarmBeforeSpire');

    //Fail Safes
    if (getPageSetting('AutoMaps') == 0) status = 'Off';
    else if (challengeActive("Mapology") && game.challenges.Mapology.credits < 1) status = 'Out of Map Credits';

    //Raiding
    else if (game.global.mapsActive && getCurrentMapObject().level > game.global.world && getCurrentMapObject().location !== "Void" && getCurrentMapObject().location !== "Bionic") status = 'Prestige Raiding';
    else if (game.global.mapsActive && getCurrentMapObject().level > game.global.world && getCurrentMapObject().location === "Bionic") status = 'BW Raiding';

    //Spire
    else if (preSpireFarming) {
        const secs: any = Math.floor(60 - (spireTime * 60) % 60).toFixed(0);
        const mins = Math.floor(minSp - spireTime).toFixed(0);
        const hours = ((minSp - spireTime) / 60).toFixed(2);
        const spiretimeStr = (minSp - spireTime >= 60) ?
            (hours + 'h') : (mins + 'm:' + (secs >= 10 ? secs : ('0' + secs)) + 's');
        status = 'Farming for Spire ' + spiretimeStr + ' left';
    } else if (spireMapBonusFarming) status = 'Getting Spire Map Bonus';
    else if (getPageSetting('SkipSpires') == 1 && ((game.global.challengeActive != 'Daily' && isActiveSpireAT()) || (game.global.challengeActive == 'Daily' && disActiveSpireAT()))) status = 'Skipping Spire';
    else if (doMaxMapBonus) status = 'Max Map Bonus After Zone';
    else if (!game.global.mapsUnlocked) status = '&nbsp;';
    else if (needPrestige && !doVoids) status = 'Prestige';
    else if (doVoids) {
        const stackedMaps = Fluffy.isRewardActive('void') ? countStackedVoidMaps() : 0;
        status = 'Void Maps: ' + game.global.totalVoidMaps + ((stackedMaps) ? " (" + stackedMaps + " stacked)" : "") + ' remaining';
    } else if (shouldFarm && !doVoids) status = 'Farming: ' + calcHDratio().toFixed(4) + 'x';
    else if (!enoughHealth && !enoughDamage) status = 'Want Health & Damage';
    else if (!enoughDamage) status = 'Want ' + calcHDratio().toFixed(4) + 'x &nbspmore damage';
    else if (!enoughHealth) status = 'Want more health';
    else if (farmingWonder) status = 'Experiencing Wonder';
    else if (enoughHealth && enoughDamage) status = 'Advancing';

    if (skippedPrestige)
        status += '<br><b style="font-size:.8em;color:pink;margin-top:0.2vw">Prestige Skipped</b>';

    //hider he/hr% status
    const getPercent = (game.stats.heliumHour.value() / (game.global.totalHeliumEarned - (game.global.heliumLeftover + game.resources.helium.owned))) * 100;
    const lifetime = (game.resources.helium.owned / (game.global.totalHeliumEarned - game.resources.helium.owned)) * 100;
    const hiderStatus = 'He/hr: ' + getPercent.toFixed(3) + '%<br>&nbsp;&nbsp;&nbsp;He: ' + lifetime.toFixed(3) + '%';

    if (get) {
        return [status, getPercent, lifetime];
    } else {
        document.getElementById('autoMapStatus')!.innerHTML = status;
        document.getElementById('hiderStatus')!.innerHTML = hiderStatus;
    }
}

MODULES["maps"].advSpecialMapMod_numZones = 3;
globalThis.advExtraMapLevels = 0;

export function testMapSpecialModController() {
    const a: any[] = [];
    Object.keys(mapSpecialModifierConfig).forEach(function(o) {
        const p = mapSpecialModifierConfig[o];
        if (game.global.highestLevelCleared + 1 >= p.unlocksAt) a.push(p.abv.toLowerCase());
    });
    if (a.length >= 1) {
        const c = byId<HTMLSelectElement>("advSpecialSelect");
        if (c) {
            if (game.global.highestLevelCleared >= 59) {
                if (needPrestige && a.includes("p")) {
                    c.value = "p";
                } else if (shouldFarm || !enoughHealth || preSpireFarming) {
                    c.value = a.includes("lmc") ? "lmc" : a.includes("hc") ? "hc" : a.includes("smc") ? "smc" : "lc";
                } else c.value = "fa";
                let d = updateMapCost(true);
                let e = game.resources.fragments.owned;
                while (c.selectedIndex > 0 && d > e) {
                    c.selectedIndex -= 1;
                    // c.value polymorphic select value; kept loose (uncovered — loop only runs when cost > fragments).
                    if (c.value != "0") console.log("Could not afford " + mapSpecialModifierConfig[c.value].name);
                }
                d = updateMapCost(true);
                e = game.resources.fragments.owned;
                if (c.value !== "0") debug("Set the map special modifier to: " + mapSpecialModifierConfig[c.value].name + ". Cost: " + (100 * (d / e)).toFixed(2) + "% of your fragments.");
            }
            // #92: five dead locals (g/h/i/j/k) lived here — dead in the 2016 upstream original too.
            // Every RHS is a PURE game getter, and updateMapCost() (called on the lines above and
            // below) already calls checkPerfectChecked()/getExtraMapLevels() itself, so dropping
            // them cannot remove a side effect or introduce a throw.
            if (game.global.highestLevelCleared >= 209) {
                // #73: the id was `advExtraMapLevelselect` — an element that does not exist. The game's
                // id is `advExtraLevelSelect` (no `Map`, capital `S`), and the ~17 other lookups in the
                // fork all spell it correctly. byId() returns null for a miss and the `if (!m) return`
                // below swallowed it, so the extra-zones half of AdvMapSpecialModifier — a DEFAULT-ON
                // setting — has been a silent no-op. Fixing the string makes the write below land, and
                // the affordability walk-down that follows it run, for the first time.
                const m = byId<HTMLSelectElement>("advExtraLevelSelect");
                if (!m)
                    return;
                const n = byId("mapLevelInput").value;
                // n is the input's string value; game.global.world is a number — kept loose (string-vs-number).
                m.selectedIndex = n == game.global.world ? MODULES.maps.advSpecialMapMod_numZones : 0;
                while (m.selectedIndex > 0 && updateMapCost(true) > game.resources.fragments.owned) {
                    m.selectedIndex -= 1;
                }
            }
        }
    }
}

// Extracted from autoMap so the U1 unique-map selection is unit-testable (autoMap itself is a
// ~700-line orchestrator that can't be driven to this loop without a deep progressed save the
// proof-net corpus doesn't reach). Faithful cut of the original loop: `selectedMap = id; break;`
// became `return id;`, `continue` stays `continue`, and Trimple's TrimpleZ reset side effect is
// preserved. Returns the selected unique map's id, or undefined if none applies. #42.
export function selectUniqueMap(): string | undefined {
    // #42: The Wall + Dimension of Anger have NO AMU branch below — their natural branch already runs
    // them (once per portal, until the reward is earned) regardless of the checkbox, so an AMU twin
    // guarded by the same reward flag would be unreachable dead code (oxlint no-dupe-else-if). The bug
    // (re-running a completed Wall/Anger) is fixed by simply not having that branch. AMUwall/AMUanger
    // are intentionally not read here.
    const AMUblock = (getPageSetting('AutoMaps') == 2 && getPageSetting('AMUblock') == true);
    const AMUtrimple = (getPageSetting('AutoMaps') == 2 && getPageSetting('AMUtrimple') == true);
    const AMUprison = (getPageSetting('AutoMaps') == 2 && getPageSetting('AMUprison') == true);
    const AMUbw = (getPageSetting('AutoMaps') == 2 && getPageSetting('AMUbw') == true);
    const AMUstar = (getPageSetting('AutoMaps') == 2 && getPageSetting('AMUstar') == true);

    for (const map in game.global.mapsOwnedArray) {
        const theMap = game.global.mapsOwnedArray[map];
        if (!theMap.noRecycle) continue;
        if (theMap.name == 'The Wall' && game.upgrades.Bounty.allowed == 0 && !game.talents.bounty.purchased) {
            const theMapDifficulty = Math.ceil(theMap.difficulty / 2);
            if (game.global.world < 15 + theMapDifficulty) continue;
            return theMap.id;
        }
        if (theMap.name == 'Dimension of Anger' && document.getElementById("portalBtn")!.style.display == "none" && !game.talents.portal.purchased) {
            const theMapDifficulty = Math.ceil(theMap.difficulty / 2);
            if (game.global.world < 20 + theMapDifficulty) continue;
            return theMap.id;
        }
        const runningC2 = game.global.runningChallengeSquared;
        if (theMap.name == 'The Block' && !game.upgrades.Shieldblock.allowed && ((game.global.challengeActive == "Scientist" || game.global.challengeActive == "Trimp") && !runningC2 || getPageSetting('BuyShieldblock'))) {
            const theMapDifficulty = Math.ceil(theMap.difficulty / 2);
            if (game.global.world < 11 + theMapDifficulty) continue;
            return theMap.id;
        } else if (theMap.name == 'The Block' && AMUblock && !game.upgrades.Shieldblock.allowed) {
            // #42: guard AMU with the natural branch's reward check (Shieldblock not yet allowed) so a
            // completed Block isn't re-selected. AMU stays meaningful when the natural branch's extra
            // challenge/BuyShieldblock conditions aren't met but the reward is unearned.
            const theMapDifficulty = Math.ceil(theMap.difficulty / 2);
            if (game.global.world < 11 + theMapDifficulty) continue;
            return theMap.id;
        }
        const treasure = getPageSetting('TrimpleZ');
        if (theMap.name == 'Trimple Of Doom' && (!runningC2 && game.mapUnlocks.AncientTreasure.canRunOnce && game.global.world >= treasure)) {
            const theMapDifficulty = Math.ceil(theMap.difficulty / 2);
            if ((game.global.world < 33 + theMapDifficulty) || treasure > -33 && treasure < 33) continue;
            if (treasure < 0)
                setPageSetting('TrimpleZ', 0);
            return theMap.id;
        } else if (theMap.name == 'Trimple Of Doom' && AMUtrimple && game.mapUnlocks.AncientTreasure.canRunOnce) {
            // #42: guard AMU with the natural branch's canRunOnce reward flag so a completed Trimple Of
            // Doom (AncientTreasure claimed) isn't re-selected forever.
            const theMapDifficulty = Math.ceil(theMap.difficulty / 2);
            if (game.global.world < 33 + theMapDifficulty) continue;
            return theMap.id;
        }
        if (!runningC2) {
            if (theMap.name == 'The Prison' && (challengeActive("Electricity") || game.global.challengeActive == "Mapocalypse")) {
                const theMapDifficulty = Math.ceil(theMap.difficulty / 2);
                if (game.global.world < 80 + theMapDifficulty) continue;
                return theMap.id;
            } else if (theMap.name == 'The Prison' && AMUprison) {
                const theMapDifficulty = Math.ceil(theMap.difficulty / 2);
                if (game.global.world < 80 + theMapDifficulty) continue;
                return theMap.id;
            }
            if (theMap.name == 'Bionic Wonderland' && game.global.challengeActive == "Crushed") {
                const theMapDifficulty = Math.ceil(theMap.difficulty / 2);
                if (game.global.world < 125 + theMapDifficulty) continue;
                return theMap.id;
            } else if (theMap.name == 'Bionic Wonderland' && AMUbw) {
                const theMapDifficulty = Math.ceil(theMap.difficulty / 2);
                if (game.global.world < 125 + theMapDifficulty) continue;
                return theMap.id;
            }
        }
        if (theMap.name == 'Imploding Star' && AMUstar) {
            const theMapDifficulty = Math.ceil(theMap.difficulty / 2);
            if (game.global.world < 170 + theMapDifficulty) continue;
            return theMap.id;
        }
    }
    return undefined;
}

export function autoMap() {

    //Failsafes
    if (!game.global.mapsUnlocked || calcOurDmg("avg", false, true) <= 0) {
        enoughDamage = true;
        enoughHealth = true;
        shouldFarm = false;
        updateAutoMapsStatus();
        return;
    }
    if (challengeActive("Mapology") && game.challenges.Mapology.credits < 1) {
        updateAutoMapsStatus();
        return;
    }

    //WS
    let mapenoughdamagecutoff = getPageSetting("mapcuntoff");
    if (getEmpowerment() == 'Wind' && game.global.challengeActive != "Daily" && !game.global.runningChallengeSquared && getPageSetting("AutoStance") == 3 && getPageSetting("WindStackingMin") > 0 && game.global.world >= getPageSetting("WindStackingMin") && getPageSetting("windcutoffmap") > 0)
        mapenoughdamagecutoff = getPageSetting("windcutoffmap");
    if (getEmpowerment() == 'Wind' && game.global.challengeActive == "Daily" && !game.global.runningChallengeSquared && (getPageSetting("AutoStance") == 3 || getPageSetting("use3daily") == true) && getPageSetting("dWindStackingMin") > 0 && game.global.world >= getPageSetting("dWindStackingMin") && getPageSetting("dwindcutoffmap") > 0)
        mapenoughdamagecutoff = getPageSetting("dwindcutoffmap");
    if (getPageSetting("mapc2hd") > 0 && game.global.challengeActive == "Mapology")
        mapenoughdamagecutoff = getPageSetting("mapc2hd");

    //Vars
    const customVars = MODULES["maps"];
    const prestige = autoTrimpSettings.Prestige.selected;
    if (prestige != "Off" && game.options.menu.mapLoot.enabled != 1) toggleSetting('mapLoot');
    if (game.global.repeatMap == true && !game.global.mapsActive && !game.global.preMapsActive) repeatClicked();
    if ((game.options.menu.repeatUntil.enabled == 1 || game.options.menu.repeatUntil.enabled == 2 || game.options.menu.repeatUntil.enabled == 3) && !game.global.mapsActive && !game.global.preMapsActive) toggleSetting('repeatUntil');
    if (game.options.menu.exitTo.enabled != 0) toggleSetting('exitTo');
    if (game.options.menu.repeatVoids.enabled != 0) toggleSetting('repeatVoids');
    const challSQ = game.global.runningChallengeSquared;
    const extraMapLevels = getPageSetting('AdvMapSpecialModifier') ? getExtraMapLevels() : 0;

    //Void Vars
    let voidMapLevelSetting = 0;
    let voidMapLevelSettingCell;
    let voidMapLevelPlus = 0;
    if (game.global.challengeActive != "Daily") {
        voidMapLevelSettingCell = ((getPageSetting('voidscell') > 0) ? getPageSetting('voidscell') : 70);
    }
    if (game.global.challengeActive == "Daily") {
        voidMapLevelSettingCell = ((getPageSetting('dvoidscell') > 0) ? getPageSetting('dvoidscell') : 70);
    }
    if (game.global.challengeActive != "Daily" && getPageSetting('VoidMaps') > 0) {
        voidMapLevelSetting = getPageSetting('VoidMaps');
    }
    if (game.global.challengeActive == "Daily" && getPageSetting('DailyVoidMod') >= 1) {
        voidMapLevelSetting = getPageSetting('DailyVoidMod');
    }
    if (getPageSetting('RunNewVoidsUntilNew') != 0 && game.global.challengeActive != "Daily") {
        voidMapLevelPlus = getPageSetting('RunNewVoidsUntilNew');
    }
    if (getPageSetting('dRunNewVoidsUntilNew') != 0 && game.global.challengeActive == "Daily") {
        voidMapLevelPlus = getPageSetting('dRunNewVoidsUntilNew');
    }

    needToVoid = (voidMapLevelSetting > 0 && game.global.totalVoidMaps > 0 && game.global.lastClearedCell + 1 >= voidMapLevelSettingCell &&
        (
            (game.global.world == voidMapLevelSetting) ||
            (voidMapLevelPlus < 0 && game.global.world >= voidMapLevelSetting &&
                (game.global.universe == 1 &&
                    (
                        (getPageSetting('runnewvoidspoison') == false && game.global.challengeActive != "Daily") ||
                        (getPageSetting('drunnewvoidspoison') == false && game.global.challengeActive == "Daily")
                    ) ||
                    (
                        (getPageSetting('runnewvoidspoison') == true && getEmpowerment() == 'Poison' && game.global.challengeActive != "Daily") ||
                        (getPageSetting('drunnewvoidspoison') == true && getEmpowerment() == 'Poison' && game.global.challengeActive == "Daily")
                    )
                ) ||
                (voidMapLevelPlus > 0 && game.global.world >= voidMapLevelSetting && game.global.world <= (voidMapLevelSetting + voidMapLevelPlus) &&
                    (game.global.universe == 1 &&
                        (
                            (getPageSetting('runnewvoidspoison') == false && game.global.challengeActive != "Daily") ||
                            (getPageSetting('drunnewvoidspoison') == false && game.global.challengeActive == "Daily")
                        ) ||
                        (
                            (getPageSetting('runnewvoidspoison') == true && getEmpowerment() == 'Poison' && game.global.challengeActive != "Daily") ||
                            (getPageSetting('drunnewvoidspoison') == true && getEmpowerment() == 'Poison' && game.global.challengeActive == "Daily")
                        )
                    )
                )
            )
        )
    );

    const voidArrayDoneS = [];
    if (game.global.challengeActive != "Daily" && getPageSetting('onlystackedvoids') == true) {
        for (const mapz in game.global.mapsOwnedArray) {
            const theMapz = game.global.mapsOwnedArray[mapz];
            if (theMapz.location == 'Void' && theMapz.stacked > 0) {
                voidArrayDoneS.push(theMapz);
            }
        }
    }

    if (
        (game.global.totalVoidMaps <= 0) ||
        (!needToVoid) ||
        (getPageSetting('novmsc2') == true && game.global.runningChallengeSquared) ||
        (game.global.challengeActive != "Daily" && game.global.totalVoidMaps > 0 && getPageSetting('onlystackedvoids') == true && voidArrayDoneS.length < 1)
    ) {
        doVoids = false;
    }

    //Prestige
    if ((getPageSetting('ForcePresZ') >= 0) && ((game.global.world + extraMapLevels) >= getPageSetting('ForcePresZ'))) {
        needPrestige = (offlineProgress.countMapItems(game.global.world) !== 0);
    } else
        needPrestige = prestige != "Off" && game.mapUnlocks[prestige] && game.mapUnlocks[prestige].last <= (game.global.world + extraMapLevels) - 5 && game.global.challengeActive != "Frugal";

    skippedPrestige = false;
    if (needPrestige && (getPageSetting('PrestigeSkip1_2') == 1 || getPageSetting('PrestigeSkip1_2') == 2)) {
        const prestigeList = ['Dagadder', 'Megamace', 'Polierarm', 'Axeidic', 'Greatersword', 'Harmbalest', 'Bootboost', 'Hellishmet', 'Pantastic', 'Smoldershoulder', 'Bestplate', 'GambesOP'];
        let numUnbought = 0;
        for (const i in prestigeList) {
            const p = prestigeList[i];
            if (game.upgrades[p].allowed - game.upgrades[p].done > 0)
                numUnbought++;
        }
        if (numUnbought >= customVars.SkipNumUnboughtPrestiges) {
            needPrestige = false;
            skippedPrestige = true;
        }
    }

    if ((needPrestige || skippedPrestige) && (getPageSetting('PrestigeSkip1_2') == 1 || getPageSetting('PrestigeSkip1_2') == 3)) {
        const prestigeList = ['Dagadder', 'Megamace', 'Polierarm', 'Axeidic', 'Greatersword', 'Harmbalest'];
        const numLeft = prestigeList.filter(prestige => game.mapUnlocks[prestige].last <= (game.global.world + extraMapLevels) - 5);
        const shouldSkip = numLeft.length <= customVars.UnearnedPrestigesRequired;
        if (shouldSkip != skippedPrestige) {
            needPrestige = !needPrestige;
            skippedPrestige = !skippedPrestige;
        }
    }

    //Calc
    let ourBaseDamage = calcOurDmg("avg", false, true);
    let enemyDamage = calcBadGuyDmg(null, getEnemyMaxAttack(game.global.world + 1, 50, 'Snimp', 1.0), true, true);
    const enemyHealth = calcEnemyHealth();

    if (getPageSetting('DisableFarm') > 0) {
        shouldFarm = (calcHDratio() >= getPageSetting('DisableFarm'));
        if (game.options.menu.repeatUntil.enabled == 1 && shouldFarm)
            toggleSetting('repeatUntil');
    }
    if (game.global.spireActive) {
        enemyDamage = calcSpire(99, game.global.gridArray[99].name, 'attack');
    }
    highDamageShield();
    if (getPageSetting('loomswap') > 0 && game.global.challengeActive != "Daily" && game.global.ShieldEquipped.name != getPageSetting('highdmg'))
        ourBaseDamage *= trimpAA;
    if (getPageSetting('dloomswap') > 0 && game.global.challengeActive == "Daily" && game.global.ShieldEquipped.name != getPageSetting('dhighdmg'))
        ourBaseDamage *= trimpAA;
    const mapbonusmulti = 1 + (0.20 * game.global.mapBonus);
    let ourBaseDamage2 = ourBaseDamage;
    ourBaseDamage2 /= mapbonusmulti;
    const pierceMod = (game.global.brokenPlanet) ? getPierceAmt() : 0;
    const FORMATION_MOD_1 = game.upgrades.Dominance.done ? 2 : 1;
    enoughHealth = (calcOurHealth() / FORMATION_MOD_1 > customVars.numHitsSurvived * (enemyDamage - calcOurBlock() / FORMATION_MOD_1 > 0 ? enemyDamage - calcOurBlock() / FORMATION_MOD_1 : enemyDamage * pierceMod));
    enoughDamage = (ourBaseDamage * mapenoughdamagecutoff > enemyHealth);
    updateAutoMapsStatus();

    //Farming
    let selectedMap = "world";
    let shouldFarmLowerZone = false;
    shouldDoMaps = false;
    if (ourBaseDamage > 0) {
        shouldDoMaps = (!enoughDamage || shouldFarm || scryerStuck);
    }
    let shouldDoHealthMaps = false;
    if (game.global.mapBonus >= getPageSetting('MaxMapBonuslimit') && !shouldFarm)
        shouldDoMaps = false;
    else if (game.global.mapBonus >= getPageSetting('MaxMapBonuslimit') && shouldFarm)
        shouldFarmLowerZone = getPageSetting('LowerFarmingZone');
    else if (game.global.mapBonus < getPageSetting('MaxMapBonushealth') && !enoughHealth && !shouldDoMaps && !needPrestige) {
        shouldDoMaps = true;
        shouldDoHealthMaps = true;
    }
    let restartVoidMap = false;
    if (challengeActive("Nom") && getPageSetting('FarmWhenNomStacks7')) {
        if (game.global.gridArray[99].nomStacks > customVars.NomFarmStacksCutoff[0]) {
            if (game.global.mapBonus != getPageSetting('MaxMapBonuslimit'))
                shouldDoMaps = true;
        }
        if (game.global.gridArray[99].nomStacks == customVars.NomFarmStacksCutoff[1]) {
            shouldFarm = (calcHDratio() > customVars.NomfarmingCutoff);
            shouldDoMaps = true;
        }
        if (!game.global.mapsActive && game.global.gridArray[game.global.lastClearedCell + 1].nomStacks >= customVars.NomFarmStacksCutoff[2]) {
            shouldFarm = (calcHDratio() > customVars.NomfarmingCutoff);
            shouldDoMaps = true;
        }
        if (game.global.mapsActive && game.global.mapGridArray[game.global.lastClearedMapCell + 1].nomStacks >= customVars.NomFarmStacksCutoff[2]) {
            shouldFarm = (calcHDratio() > customVars.NomfarmingCutoff);
            shouldDoMaps = true;
            restartVoidMap = true;
        }
    }

    //Prestige
    if (shouldFarm && !needPrestige) {
        const capped = areWeAttackLevelCapped();
        let prestigeitemsleft: any;
        if (game.global.mapsActive) {
            prestigeitemsleft = addSpecials(true, true, getCurrentMapObject());
        } else if (lastMapWeWereIn) {
            prestigeitemsleft = addSpecials(true, true, lastMapWeWereIn);
        }
        const prestigeList = ['Dagadder', 'Megamace', 'Polierarm', 'Axeidic', 'Greatersword', 'Harmbalest'];
        let numUnbought = 0;
        for (let i = 0, len = prestigeList.length; i < len; i++) {
            const p = prestigeList[i];
            if (game.upgrades[p].allowed - game.upgrades[p].done > 0)
                numUnbought++;
        }
        if (capped && prestigeitemsleft == 0 && numUnbought == 0) {
            shouldFarm = false;
            if (game.global.mapBonus >= getPageSetting('MaxMapBonuslimit') && !shouldFarm)
                shouldDoMaps = false;
        }
    }

    //Spire
    let shouldDoSpireMaps = false;
    preSpireFarming = (isActiveSpireAT() || disActiveSpireAT()) && (spireTime = (new Date().getTime() - game.global.zoneStarted) / 1000 / 60) < getPageSetting('MinutestoFarmBeforeSpire');
    spireMapBonusFarming = getPageSetting('MaxStacksForSpire') && (isActiveSpireAT() || disActiveSpireAT()) && game.global.mapBonus < 10;
    if (preSpireFarming || spireMapBonusFarming) {
        shouldDoMaps = true;
        shouldDoSpireMaps = true;
    }

    //Map Bonus
    const maxMapBonusZ = getPageSetting('MaxMapBonusAfterZone');
    doMaxMapBonus = (maxMapBonusZ >= 0 && game.global.mapBonus < getPageSetting("MaxMapBonuslimit") && game.global.world >= maxMapBonusZ);
    if (doMaxMapBonus)
        shouldDoMaps = true;

    //Maps
    vanillaMapatZone = (game.options.menu.mapAtZone.enabled && game.global.canMapAtZone && !isActiveSpireAT() && !disActiveSpireAT());
    if (vanillaMapatZone) {
        for (let x = 0; x < game.options.menu.mapAtZone.setZone.length; x++) {
            if (game.global.world == game.options.menu.mapAtZone.setZone[x].world)
                shouldDoMaps = true;
        }
    }

    let siphlvl = shouldFarmLowerZone ? game.global.world - 10 : game.global.world - game.portal.Siphonology.level;
    let maxlvl = game.talents.mapLoot.purchased ? game.global.world - 1 : game.global.world;
    maxlvl += extraMapLevels;
    if (getPageSetting('DynamicSiphonology') || shouldFarmLowerZone) {
        for (siphlvl; siphlvl < maxlvl; siphlvl++) {
            let maphp = getEnemyMaxHealth(siphlvl) * 1.1;
            const cpthlth = getCorruptScale("health") / 2;
            if (mutations.Magma.active())
                maphp *= cpthlth;
            let mapdmg = ourBaseDamage2;
            if (game.upgrades.Dominance.done)
                mapdmg *= 4;
            if (mapdmg < maphp) {
                break;
            }
        }
    }
    const obj: any = {};
    let siphonMap: any = -1;
    for (const map in game.global.mapsOwnedArray) {
        if (!game.global.mapsOwnedArray[map].noRecycle) {
            obj[map] = game.global.mapsOwnedArray[map].level;
            if (game.global.mapsOwnedArray[map].level == siphlvl)
                siphonMap = map;
        }
    }
    const keysSorted = Object.keys(obj).sort(function(a, b) {
        return obj[b] - obj[a];
    });
    let highestMap: any;
    let lowestMap;
    if (keysSorted[0]) {
        highestMap = keysSorted[0];
        lowestMap = keysSorted[keysSorted.length - 1];
    } else
        selectedMap = "create";

    //Uniques
    if (getPageSetting('AutoMaps') > 0) {
        const uniqueId = selectUniqueMap();
        if (uniqueId !== undefined) selectedMap = uniqueId;
    }

    //Voids
    if (getPageSetting('novmsc2') == true && game.global.runningChallengeSquared) {
        needToVoid = false;
    }

    if (needToVoid) {
        const voidArray = [];
        const prefixlist: any = {
            'Deadly': 10,
            'Heinous': 11,
            'Poisonous': 20,
            'Destructive': 30
        };
        const prefixkeys = Object.keys(prefixlist);
        const suffixlist: any = {
            'Descent': 7.077,
            'Void': 8.822,
            'Nightmare': 9.436,
            'Pit': 10.6
        };
        const suffixkeys = Object.keys(suffixlist);

        if (game.global.challengeActive != "Daily" && getPageSetting('onlystackedvoids') == true) {
            for (const map in game.global.mapsOwnedArray) {
                const theMap = game.global.mapsOwnedArray[map];
                if (theMap.location == 'Void' && theMap.stacked > 0) {
                    for (const pre in prefixkeys) {
                        if (theMap.name.includes(prefixkeys[pre]))
                            theMap.sortByDiff = 1 * prefixlist[prefixkeys[pre]];
                    }
                    for (const suf in suffixkeys) {
                        if (theMap.name.includes(suffixkeys[suf]))
                            theMap.sortByDiff += 1 * suffixlist[suffixkeys[suf]];
                    }
                    voidArray.push(theMap);
                }
            }
        } else {
            for (const map in game.global.mapsOwnedArray) {
                const theMap = game.global.mapsOwnedArray[map];
                if (theMap.location == 'Void') {
                    for (const pre in prefixkeys) {
                        if (theMap.name.includes(prefixkeys[pre]))
                            theMap.sortByDiff = 1 * prefixlist[prefixkeys[pre]];
                    }
                    for (const suf in suffixkeys) {
                        if (theMap.name.includes(suffixkeys[suf]))
                            theMap.sortByDiff += 1 * suffixlist[suffixkeys[suf]];
                    }
                    voidArray.push(theMap);
                }
            }
        }

        const voidArraySorted = voidArray.sort(function(a, b) {
            return a.sortByDiff - b.sortByDiff;
        });
        for (const map in voidArraySorted) {
            const theMap = voidArraySorted[map];
            doVoids = true;
            if (getPageSetting('novmsc2') == true && game.global.runningChallengeSquared) {
                doVoids = false;
            }
            let eAttack = getEnemyMaxAttack(game.global.world, theMap.size, 'Voidsnimp', theMap.difficulty);
            if (game.global.world >= 181 || (game.global.challengeActive == "Corrupted" && game.global.world >= 60))
                eAttack *= (getCorruptScale("attack") / 2).toFixed(1) as any;
            if (challengeActive("Balance")) {
                eAttack *= 2;
            }
            if (challengeActive("Toxicity")) {
                eAttack *= 5;
            }
            if (getPageSetting('DisableFarm') <= 0)
                shouldFarm = shouldFarm || false;
            if (!restartVoidMap)
                selectedMap = theMap.id;
            if (game.global.mapsActive && getCurrentMapObject().location == "Void" && challengeActive("Nom") && getPageSetting('FarmWhenNomStacks7')) {
                if (game.global.mapGridArray[theMap.size - 1].nomStacks >= customVars.NomFarmStacksCutoff[2]) {
                    mapsClicked(true);
                }
            }
            break;
        }
    }

    //Skip Spires
    if (!preSpireFarming && getPageSetting('SkipSpires') == 1 && ((game.global.challengeActive != 'Daily' && isActiveSpireAT()) || (game.global.challengeActive == 'Daily' && disActiveSpireAT()))) {
        enoughDamage = true;
        enoughHealth = true;
        shouldFarm = false;
        shouldDoMaps = false;
    }

    //Automaps
    if (shouldDoMaps || doVoids || needPrestige) {
        if (selectedMap == "world") {
            if (preSpireFarming) {
                const spiremaplvl = (game.talents.mapLoot.purchased && MODULES["maps"].SpireFarm199Maps) ? game.global.world - 1 : game.global.world;
                selectedMap = "create";
                for (let i = 0; i < keysSorted.length; i++) {
                    if (game.global.mapsOwnedArray[keysSorted[i]].level >= spiremaplvl &&
                        game.global.mapsOwnedArray[keysSorted[i]].location == ((customVars.preferGardens && game.global.decayDone) ? 'Plentiful' : 'Mountain')) {
                        selectedMap = game.global.mapsOwnedArray[keysSorted[i]].id;
                        break;
                    }
                }
            } else if (needPrestige || (extraMapLevels > 0)) {
                if ((game.global.world + extraMapLevels) <= game.global.mapsOwnedArray[highestMap].level)
                    selectedMap = game.global.mapsOwnedArray[highestMap].id;
                else
                    selectedMap = "create";
            } else if (siphonMap != -1)
                selectedMap = game.global.mapsOwnedArray[siphonMap].id;
            else
                selectedMap = "create";
        }
    }
    if ((challengeActive("Lead") && !challSQ) && !doVoids && (game.global.world % 2 == 0 || game.global.lastClearedCell < customVars.shouldFarmCell)) {
        if (game.global.preMapsActive)
            mapsClicked();
        return;
    }

    if (!game.global.preMapsActive && game.global.mapsActive) {
        const doDefaultMapBonus = game.global.mapBonus < getPageSetting('MaxMapBonuslimit') - 1;
        if (selectedMap == game.global.currentMapId && (!getCurrentMapObject().noRecycle && (doDefaultMapBonus || vanillaMapatZone || doMaxMapBonus || shouldFarm || needPrestige || shouldDoSpireMaps))) {
            const targetPrestige = autoTrimpSettings.Prestige.selected;
            if (!game.global.repeatMap) {
                repeatClicked();
            }
            if (!shouldDoMaps && (game.global.mapGridArray[game.global.mapGridArray.length - 1].special == targetPrestige && game.mapUnlocks[targetPrestige].last >= (game.global.world + extraMapLevels - 9))) {
                repeatClicked();
            }
            if (shouldDoHealthMaps && game.global.mapBonus >= getPageSetting('MaxMapBonushealth') - 1) {
                repeatClicked();
                shouldDoHealthMaps = false;
            }
            if (doMaxMapBonus && game.global.mapBonus >= getPageSetting('MaxMapBonuslimit') - 1) {
                repeatClicked();
                doMaxMapBonus = false;
            }
        } else {
            if (game.global.repeatMap) {
                repeatClicked();
            }
            if (restartVoidMap) {
                mapsClicked(true);
            }
        }
    } else if (!game.global.preMapsActive && !game.global.mapsActive) {
        if (selectedMap != "world") {
            if (!game.global.switchToMaps) {
                mapsClicked();
            }
            if ((!getPageSetting('PowerSaving') || (getPageSetting('PowerSaving') == 2) && doVoids) && game.global.switchToMaps &&
                (needPrestige || doVoids ||
                    ((challengeActive("Lead") && !challSQ) && game.global.world % 2 == 1) ||
                    (!enoughDamage && enoughHealth && game.global.lastClearedCell < 9) ||
                    (shouldFarm && game.global.lastClearedCell >= customVars.shouldFarmCell) ||
                    (scryerStuck)) &&
                (
                    (game.resources.trimps.realMax() <= game.resources.trimps.owned + 1) ||
                    ((challengeActive("Lead") && !challSQ) && game.global.lastClearedCell > 93) ||
                    (doVoids && game.global.lastClearedCell > 70)
                )
            ) {
                if (scryerStuck) {
                    debug("Got perma-stuck on cell " + (game.global.lastClearedCell + 2) + " during scryer stance. Are your scryer settings correct? Entering map to farm to fix it.");
                }
                mapsClicked();
            }
        }
    } else if (game.global.preMapsActive) {
        if (selectedMap == "world") {
            mapsClicked();
        } else if (selectedMap == "create") {
            if (game.global.selectedMapPreset > 1) selectAdvMapsPreset(1);
            const $mapLevelInput = byId("mapLevelInput");
            $mapLevelInput.value = needPrestige ? game.global.world : siphlvl;
            if (preSpireFarming && MODULES["maps"].SpireFarm199Maps)
                $mapLevelInput.value = game.talents.mapLoot.purchased ? game.global.world - 1 : game.global.world;
            let decrement: any;
            let tier;
            if (game.global.world >= customVars.MapTierZone[0]) {
                tier = customVars.MapTier0Sliders;
                decrement = [];
            } else if (game.global.world >= customVars.MapTierZone[1]) {
                tier = customVars.MapTier1Sliders;
                decrement = ['loot'];
            } else if (game.global.world >= customVars.MapTierZone[2]) {
                tier = customVars.MapTier2Sliders;
                decrement = ['loot'];
            } else {
                tier = customVars.MapTier3Sliders;
                decrement = ['diff', 'loot'];
            }
            sizeAdvMapsRange.value = tier[0];
            adjustMap('size', tier[0]);
            difficultyAdvMapsRange.value = tier[1];
            adjustMap('difficulty', tier[1]);
            lootAdvMapsRange.value = tier[2];
            adjustMap('loot', tier[2]);
            biomeAdvMapsSelect.value = autoTrimpSettings.mapselection.selected == "Gardens" ? "Plentiful" : autoTrimpSettings.mapselection.selected;
            updateMapCost();
            if (shouldFarm || challengeActive("Metal")) {
                biomeAdvMapsSelect.value = game.global.decayDone ? "Plentiful" : "Mountain";
                updateMapCost();
            }
            if (updateMapCost(true) > game.resources.fragments.owned) {
                if (needPrestige && !enoughDamage) decrement.push('diff');
                if (shouldFarm) decrement.push('size');
            }
            while (decrement.indexOf('loot') > -1 && lootAdvMapsRange.value > 0 && updateMapCost(true) > game.resources.fragments.owned) {
                lootAdvMapsRange.value -= 1;
            }
            while (decrement.indexOf('diff') > -1 && difficultyAdvMapsRange.value > 0 && updateMapCost(true) > game.resources.fragments.owned) {
                difficultyAdvMapsRange.value -= 1;
            }
            while (decrement.indexOf('size') > -1 && sizeAdvMapsRange.value > 0 && updateMapCost(true) > game.resources.fragments.owned) {
                sizeAdvMapsRange.value -= 1;
            }
            while (lootAdvMapsRange.value > 0 && updateMapCost(true) > game.resources.fragments.owned) {
                lootAdvMapsRange.value -= 1;
            }
            while (difficultyAdvMapsRange.value > 0 && updateMapCost(true) > game.resources.fragments.owned) {
                difficultyAdvMapsRange.value -= 1;
            }
            while (sizeAdvMapsRange.value > 0 && updateMapCost(true) > game.resources.fragments.owned) {
                sizeAdvMapsRange.value -= 1;
            }
            if (getPageSetting('AdvMapSpecialModifier'))
                testMapSpecialModController();
            const maplvlpicked = parseInt($mapLevelInput.value) + (getPageSetting('AdvMapSpecialModifier') ? getExtraMapLevels() : 0);
            if (updateMapCost(true) > game.resources.fragments.owned) {
                if (game.jobs.Explorer.owned > 0 || game.unlocks.imps.Flutimp == true) {
                    selectMap(game.global.mapsOwnedArray[highestMap].id);
                    debug("Can't afford the map we designed, #" + maplvlpicked, "maps", '*crying2');
                    debug("...selected our highest map instead # " + game.global.mapsOwnedArray[highestMap].id + " Level: " + game.global.mapsOwnedArray[highestMap].level, "maps", '*happy2');
                    runMap();
                    lastMapWeWereIn = getCurrentMapObject();
                } else {
                    selectedMap = "world";
                }
            } else {
                debug("Buying a Map, level: #" + maplvlpicked, "maps", 'th-large');
                let result = buyMap();
                if (result == -2) {
                    debug("Too many maps, recycling now: ", "maps", 'th-large');
                    recycleBelow(true);
                    debug("Retrying, Buying a Map, level: #" + maplvlpicked, "maps", 'th-large');
                    result = buyMap();
                    if (result == -2) {
                        recycleMap(lowestMap);
                        result = buyMap();
                        if (result == -2)
                            debug("AutoMaps unable to recycle to buy map!");
                        else
                            debug("Retrying map buy after recycling lowest level map");
                    }
                }
            }
        } else {
            selectMap(selectedMap);
            const themapobj = game.global.mapsOwnedArray[getMapIndex(selectedMap)];
            const levelText = " Level: " + themapobj.level;
            const voidorLevelText = themapobj.location == "Void" ? " Void: " : levelText;
            debug("Running selected " + selectedMap + voidorLevelText + " Name: " + themapobj.name, "maps", 'th-large');
            runMap();
            lastMapWeWereIn = getCurrentMapObject();
        }
    }

    // Experience Challenge
    if (game.global.challengeActive == "Experience" && getPageSetting('farmWonders')) {
        const wondersFromZ = getPageSetting('maxExpZone');
        const wondersAmount = getPageSetting('wondersAmount');
        const wondersFloorZ = wondersFromZ - ((getPageSetting('wondersAmount') - 1) * 5);
        const finishOnBw = (() => {
            let pageSetting = getPageSetting('finishExpOnBw');
            pageSetting = pageSetting < 125 ? 125 : pageSetting;
            pageSetting = pageSetting != -1 ? (Math.floor((pageSetting - 125) / 15) * 15) + 125 : -1;
            return pageSetting;
        })();
        const bionics = game.global.mapsOwnedArray
            .filter((map: any) => map.location == "Bionic")
            .sort((a: any, b: any) => b.level - a.level)
        if (game.global.world >= game.challenges.Experience.nextWonder &&
            wondersAmount > game.challenges.Experience.wonders &&
            game.global.world >= wondersFloorZ) {
            farmingWonder = true;
            if (!game.global.mapsActive && game.global.mapsOwnedArray.filter(function(map: any) {
                    return map.level == game.global.world && map.location != 'Bionic';
                }).length >= 1) {
                const mapID = game.global.mapsOwnedArray.find(function(map: any) {
                    return map.level == game.global.world && map.location != 'Bionic';
                }).id;
                selectedMap = mapID;
                selectMap(mapID);
                runMap();
            } else if (!game.global.mapsActive) {
                selectedMap = "create"
                const maplvlpicked = game.global.world
                debug("Buying a Map, level: #" + maplvlpicked, "maps", 'th-large');
                mapsClicked(true)
                let result = buyMap();
                if (result == -2) {
                    debug("Too many maps, recycling now: ", "maps", 'th-large');
                    recycleBelow(true);
                    debug("Retrying, Buying a Map, level: #" + maplvlpicked, "maps", 'th-large');
                    result = buyMap();
                    if (result == -2) {
                        recycleMap(lowestMap);
                        result = buyMap();
                        if (result == -2)
                            debug("AutoMaps unable to recycle to buy map!");
                        else
                            debug("Retrying map buy after recycling lowest level map");
                    }
                }
            }
        } else if (game.global.world > 600 && !game.global.mapsActive && game.global.world != 700 &&
            wondersFromZ != -1 && game.global.world >= wondersFromZ && finishOnBw != -1) {
            // Finish challenge with target BW. If for some reason we've raided past it, pick the lowest BW available.
            // If we somehow did not raid for it, pick the highest available which will climb if necessary to 605.
            // If at 700, clear the zone to complete instead.
            farmingWonder = true;
            const finishBw = bionics.find((map: any) => map.level == finishOnBw);
            if (finishBw) {
                selectMap(finishBw.id);
            } else {
                if (bionics.every((map: any) => map.level > finishOnBw)) {
                    selectMap(bionics[bionics.length - 1].id);
                } else {
                    selectMap(bionics[0].id);
                }
            }
            runMap();
        } else {
            farmingWonder = false;
            selectedMap = "world";
        }
    }
}

//Radon
MODULES.maps.RMapTierZone = [72, 47, 16];
MODULES.maps.RMapTier0Sliders = [9, 9, 9, "Mountain"];
MODULES.maps.RMapTier1Sliders = [9, 9, 9, "Depths"];
MODULES.maps.RMapTier2Sliders = [9, 9, 9, "Random"];
MODULES.maps.RMapTier3Sliders = [9, 9, 9, "Random"];
MODULES.maps.RshouldFarmCell = 59;
MODULES.maps.RSkipNumUnboughtPrestiges = 2;
MODULES.maps.RUnearnedPrestigesRequired = 2;

export function RupdateAutoMapsStatus(get?: any) {

    let status: any;

    //Fail Safes
    if (getPageSetting('RAutoMaps') == 0) status = 'Off';
    else if (!game.global.mapsUnlocked) status = 'Maps Locked';

    //Status
    else if (Rshouldcastle && game.global.totalVoidMaps <= 0) status = 'Frozen Castle';
    else if (contractVoid) status = 'Contract';
    else if (Rshouldshipfarm) status = 'Ship Farming';
    else if (Rshouldequipfarm) status = 'Equip Farming to ' + equipfarmdynamicHD().toFixed(2) + " and " + estimateEquipsForZone()[2] + " Equality";
    else if (Rshouldstormfarm) status = 'Storm Farming to ' + stormdynamicHD().toFixed(2);
    else if (Rshouldinsanityfarm) status = 'Insanity Farming';
    else if (Rshouldalchfarm) status = 'Alchemy Farming';
    else if (Rshouldhypofarm) status = 'Hypo Farming';
    else if (Rshouldmayhem === 1) status = 'Mayhem Attack';
    else if (Rshouldmayhem === 2) status = 'Mayhem Health';
    else if (Rshouldpanda) status = 'Pandemonium';
    else if (Rshoulddesofarm) status = 'Deso Farming to ' + desodynamicHD().toFixed(2);
    else if (Rshoulddopraid) status = 'Praiding';
    else if (Rdshoulddopraid) status = 'Daily Praiding';
    else if (Rshoulddoquest) status = 'Questing';
    else if (Rshouldtimefarm) status = 'Time Farming';
    else if (Rdshouldtimefarm) status = 'Daily Time Farming';
    else if (Rshouldsmithyfarm) status = 'Smithy Farming';
    else if (Rshouldtributefarm) status = 'Tribute Farming';
    else if (Rshoulddobogs) status = 'Black Bogs';
    else if (RdoMaxMapBonus) status = 'Max Map Bonus After Zone';
    else if (RvanillaMAZ) status = 'Vanilla MAZing';
    else if (RneedPrestige && !RdoVoids) status = 'Prestige';
    else if (RdoVoids) {
        const stackedMaps = Fluffy.isRewardActive('void') ? countStackedVoidMaps() : 0;
        status = 'Void Maps: ' + game.global.totalVoidMaps + ((stackedMaps) ? " (" + stackedMaps + " stacked)" : "") + ' remaining';
    } else if (RshouldFarm && !RdoVoids) status = 'Farming: ' + RcalcHDratio().toFixed(4) + 'x';
    else if (!RenoughHealth && !RenoughDamage) status = 'Want Health & Damage';
    else if (!RenoughDamage) status = 'Want ' + RcalcHDratio().toFixed(4) + 'x &nbspmore damage';
    else if (!RenoughHealth) status = 'Want more health';
    else if (RenoughHealth && RenoughDamage) status = 'Advancing';

    const getPercent = (game.stats.heliumHour.value() / (game.global.totalRadonEarned - (game.global.radonLeftover + game.resources.radon.owned))) * 100;
    const lifetime = (game.resources.radon.owned / (game.global.totalRadonEarned - game.resources.radon.owned)) * 100;
    const hiderStatus = 'Rn/hr: ' + getPercent.toFixed(3) + '%<br>&nbsp;&nbsp;&nbsp;Rn: ' + lifetime.toFixed(3) + '%';

    if (get) {
        return [status, getPercent, lifetime];
    } else {
        document.getElementById('autoMapStatus')!.innerHTML = status;
        document.getElementById('hiderStatus')!.innerHTML = hiderStatus;
    }
}

//RAutoMaps

export function RautoMap() {

    //Failsafes
    if (!game.global.mapsUnlocked || RcalcOurDmg("avg", false, true) <= 0) {
        RenoughDamage = true;
        RenoughHealth = true;
        RshouldFarm = false;
        RupdateAutoMapsStatus();
        return;
    }

    //Calc
    const ourBaseDamage = RcalcOurDmg("avg", false, true);
    const ourBaseHealth = RcalcOurHealth();
    const enemyDamage = RcalcBadGuyDmg(null, RgetEnemyMaxAttack(game.global.world, 50, 'Snimp', 1.0));
    const mapenoughdamagecutoff = getPageSetting("Rmapcuntoff");

    if (getPageSetting('RDisableFarm') > 0) {
        RshouldFarm = (RcalcHDratio() >= getPageSetting('RDisableFarm'));
        if (game.options.menu.repeatUntil.enabled == 1 && RshouldFarm)
            toggleSetting('repeatUntil');
    }
    let hitsSurvived = 10;
    if (getPageSetting("Rhitssurvived") > 0) hitsSurvived = getPageSetting("Rhitssurvived");
    RenoughHealth = (ourBaseHealth > (hitsSurvived * enemyDamage));
    RenoughDamage = (RcalcHDratio() <= mapenoughdamagecutoff);

    RupdateAutoMapsStatus();

    //Map Options
    const customVars = MODULES["maps"];
    if (game.global.repeatMap === true && !game.global.mapsActive && !game.global.preMapsActive) repeatClicked();
    if ((game.options.menu.repeatUntil.enabled === 1 || game.options.menu.repeatUntil.enabled === 2 || game.options.menu.repeatUntil.enabled === 3) && !game.global.mapsActive && !game.global.preMapsActive) toggleSetting('repeatUntil');
    if (game.options.menu.exitTo.enabled !== 0) toggleSetting('exitTo');
    if (game.options.menu.repeatVoids.enabled !== 0) toggleSetting('repeatVoids');

    //Void Vars
    let voidMapLevelSetting = 0;
    const voidMapLevelSettingCell = ((getPageSetting('Rvoidscell') > 0) ? getPageSetting('Rvoidscell') : 70);
    let voidMapLevelPlus = 0;
    if (game.global.challengeActive !== "Daily" && getPageSetting('RVoidMaps') > 0) {
        voidMapLevelSetting = getPageSetting('RVoidMaps');
    }
    if (game.global.challengeActive === "Daily" && getPageSetting('RDailyVoidMod') >= 1) {
        voidMapLevelSetting = getPageSetting('RDailyVoidMod');
    }
    if (getPageSetting('RRunNewVoidsUntilNew') != 0 && game.global.challengeActive != "Daily") {
        voidMapLevelPlus = getPageSetting('RRunNewVoidsUntilNew');
    }
    if (getPageSetting('RdRunNewVoidsUntilNew') != 0 && game.global.challengeActive == "Daily") {
        voidMapLevelPlus = getPageSetting('RdRunNewVoidsUntilNew');
    }

    RneedToVoid = (voidMapLevelSetting > 0 && game.global.totalVoidMaps > 0 && game.global.lastClearedCell + 1 >= voidMapLevelSettingCell &&
        (
            (game.global.world == voidMapLevelSetting) ||
            (voidMapLevelPlus < 0 && game.global.world >= voidMapLevelSetting) ||
            (voidMapLevelPlus > 0 && game.global.world >= voidMapLevelSetting && game.global.world <= (voidMapLevelSetting + voidMapLevelPlus))
        )
    );

    const voidArrayDoneS = [];
    if (game.global.challengeActive !== "Daily" && getPageSetting('Ronlystackedvoids') == true) {
        for (const mapz in game.global.mapsOwnedArray) {
            const theMapz = game.global.mapsOwnedArray[mapz];
            if (theMapz.location == 'Void' && theMapz.stacked > 0) {
                voidArrayDoneS.push(theMapz);
            }
        }
    }

    if (
        (game.global.totalVoidMaps <= 0) ||
        (!RneedToVoid) ||
        (getPageSetting('Rnovmsc2') == true && game.global.runningChallengeSquared) ||
        (game.global.challengeActive != "Daily" && game.global.totalVoidMaps > 0 && getPageSetting('Ronlystackedvoids') == true && voidArrayDoneS.length < 1)
    ) {
        RdoVoids = false;
    }

    //Contract
    if (autoBattle.activeContract !== '') {
        if (getPageSetting('RABsolve') == true && contractVoid) {
            RneedToVoid = true;
            RdoVoids = true;
        }
    }

    //Quest
    let Rquestfarming = false;
    Rshoulddoquest = false;
    Rquestfarming = (game.global.world > 5 && game.global.challengeActive === "Quest" && questcheck() > 0);

    if (Rquestfarming) {
        if (questcheck() == 3) Rshoulddoquest = 3;
        else if (questcheck() == 4 && RcalcHDratio() > 0.95 && (((new Date().getTime() - game.global.zoneStarted) / 1000 / 60) < 121)) Rshoulddoquest = 4;
        else if (questcheck() == 6) Rshoulddoquest = 6;
        else if (questcheck() == 7 && !canAffordBuilding('Smithy')) Rshoulddoquest = 7;
        else if (questcheck() == 10 || questcheck() == 20) Rshoulddoquest = 10;
        else if (questcheck() == 11 || questcheck() == 21) Rshoulddoquest = 11;
        else if (questcheck() == 12 || questcheck() == 22) Rshoulddoquest = 12;
        else if (questcheck() == 13 || questcheck() == 23) Rshoulddoquest = 13;
        else if (questcheck() == 14 || questcheck() == 24) Rshoulddoquest = 14;
    }

    //Quest Shield
    if (game.global.world < 6 && (Rquestshieldzone != 0 || Rquestequalityscale != false)) {
        Rquestshieldzone = 0;
        Rquestequalityscale = false;
    }
    if (Rquestfarming && questcheck() == 5 && ((game.global.soldierEnergyShieldMax / enemyDamage) < RcalcHDratio()) && game.portal.Equality.scalingActive && !game.global.mapsActive) {
        toggleEqualityScale();
        Rquestshieldzone = game.global.world;
        Rquestequalityscale = true;
    }
    if (game.global.world > 5 && game.global.challengeActive === "Quest" && Rquestshieldzone > 0 && !game.portal.Equality.scalingActive && game.global.world > Rquestshieldzone && Rquestequalityscale) {
        toggleEqualityScale();
        Rquestequalityscale = false;
    }

    //### Map Modules found in mapfunctions.js

    //Farming
    let selectedMap = "world";

    RshouldDoMaps = false;
    Rshouldfragfarm = false;
    Rshouldtimefarm = false;
    Rdshouldtimefarm = false;
    Rshouldsmithyfarm = false;
    Rshouldtributefarm = false;
    Rshoulddobogs = false;
    Rshoulddopraid = false;
    Rdshoulddopraid = false;
    Rshouldinsanityfarm = false;
    Rshouldalchfarm = false;
    Rshouldhypofarm = false;
    Rhyposhouldwood = true;
    Rshouldstormfarm = false;
    Rshoulddesofarm = false;
    Rshouldequipfarm = false;
    Rshouldshipfarm = false;
    contractVoid = false;
    Rshouldmayhem = 0;
    Rshouldpanda = false;
    RvanillaMAZ = false;

    if (ourBaseDamage > 0) {
        RshouldDoMaps = (!RenoughDamage || RshouldFarm);
    }
    let shouldDoHealthMaps = false;
    if (game.global.mapBonus >= getPageSetting('RMaxMapBonuslimit') && !RshouldFarm)
        RshouldDoMaps = false;
    else if (game.global.mapBonus < getPageSetting('RMaxMapBonushealth') && !RenoughHealth && !RshouldDoMaps) {
        RshouldDoMaps = true;
        shouldDoHealthMaps = true;
    }
    const restartVoidMap = false;

    //Map Bonus
    const maxMapBonusZ = getPageSetting('RMaxMapBonusAfterZone');
    RdoMaxMapBonus = (maxMapBonusZ >= 0 && game.global.mapBonus < getPageSetting("RMaxMapBonuslimit") && game.global.world >= maxMapBonusZ);
    if (RdoMaxMapBonus) {
        RshouldDoMaps = true;
    }

    //MAZ
    if (game.options.menu.mapAtZone.enabled && game.global.canMapAtZone) {
        let nextCell = game.global.lastClearedCell;
        if (nextCell === -1) nextCell = 1;
        else nextCell += 2;
        const totalPortals = getTotalPortals();
        let setZone = game.options.menu.mapAtZone.getSetZone();
        for (let x = 0; x < setZone.length; x++) {
            if (!setZone[x].on) continue;
            if (game.global.world < setZone[x].world || game.global.world > setZone[x].through) continue;
            if (game.global.preMapsActive && setZone[x].done == totalPortals + "_" + game.global.world + "_" + nextCell + (game.global.universe == 2 && game.global.spireActive ? "_" + game.global.spireLevel : "")) continue;
            if (setZone[x].times === -1 && game.global.world !== setZone[x].world) continue;
            if (setZone[x].times > 0 && (game.global.world - setZone[x].world) % setZone[x].times !== 0) continue;
            if (setZone[x].cell === game.global.lastClearedCell + 2) {
                RvanillaMAZ = true;
                if (setZone[x].until === 6) game.global.mapCounterGoal = 25;
                if (setZone[x].until === 7) game.global.mapCounterGoal = 50;
                if (setZone[x].until === 8) game.global.mapCounterGoal = 100;
                if (setZone[x].until === 9) game.global.mapCounterGoal = setZone[x].rx;
                break;
            }
        }

        //Toggle void repeat on if it's disabled.
        if (RvanillaMAZ) {
            if (game.options.menu.repeatVoids.enabled != 1) toggleSetting('repeatVoids');
            return RupdateAutoMapsStatus();
        }
    }

    //Time Farm
    if (getPageSetting('Rtimefarm') || (game.global.challengeActive == 'Daily' && getPageSetting('Rdtimefarm') == 2)) {
        RtimeFarm(true, false, false, false, false);
    }

    //dTime Farm
    if (game.global.challengeActive == 'Daily' && getPageSetting('Rdtimefarm') == 1) {
        RtimeFarm(true, false, false, false, true);
    }

    //Smithy Farm
    if (getPageSetting('Rsmithyfarm')) {
        RsmithyFarm(false);
    }

    //Tribute Farm
    if (getPageSetting('Rtributefarm')) {
        RtributeFarm(true, false, false, false);
    }

    //Bogs
    if (game.global.world > 5 && (game.global.challengeActive == "Quagmire" && getPageSetting('Rblackbog') == true && getPageSetting('Rblackbogzone')[0] > 0 && getPageSetting('Rblackbogamount')[0] > 0)) {
        Rbogs();
    }

    //Praid
    let Rdopraid = false;
    Rdopraid = (game.global.world > 5 && (((getPageSetting('RAMPraid') == true) || (game.global.challengeActive == "Daily" && getPageSetting('RdAMPraid') == 2)) && getPageSetting('RAMPraidzone')[0] > 0 && getPageSetting('RAMPraidraid')[0] > 0));
    if (game.global.challengeActive == 'Daily' && getPageSetting('RdAMPraid') != 2) {
        Rdopraid = false;
    }
    if (Rdopraid) {
        RPraid(false);
    }
    if (!Rshoulddopraid && (RAMPrepMap1 != undefined || RAMPrepMap2 != undefined || RAMPrepMap3 != undefined || RAMPrepMap4 != undefined || RAMPrepMap5 != undefined)) {
        RAMPreset(false);
    }

    //dPraid
    let Rddopraid = false;
    Rddopraid = (game.global.challengeActive == "Daily" && game.global.world > 5 && (getPageSetting('RdAMPraid') == 1 && getPageSetting('RdAMPraidzone')[0] > 0 && getPageSetting('RdAMPraidraid')[0] > 0));
    if (Rddopraid) {
        RPraid(true);
    }
    if (!Rdshoulddopraid && (RdAMPrepMap1 != undefined || RdAMPrepMap2 != undefined || RdAMPrepMap3 != undefined || RdAMPrepMap4 != undefined || RdAMPrepMap5 != undefined)) {
        RAMPreset(true);
    }

    //Mayhem
    if (game.global.challengeActive == "Mayhem") {
        let Rdomayhem = false;
        Rdomayhem = (game.global.world > 5 && game.global.challengeActive == "Mayhem" && getPageSetting('Rmayhemon') == true && (getPageSetting('Rmayhemhealth') == true || getPageSetting('Rmayhemattack') == true));
        if (Rdomayhem) {
            Rmayhem();
        }
    }

    //Panda
    if (game.global.challengeActive == "Pandemonium") {
        let Rdopanda = false;
        Rdopanda = (game.global.world >= getPageSetting('Rpandazone') && game.global.challengeActive == "Pandemonium" && getPageSetting('Rpandaon') == true);
        if (Rdopanda && game.challenges.Pandemonium.pandemonium > 0 && getPageSetting('Rpandamaps') == true) {
            Rshouldpanda = true;
        }
    }

    //Insanity
    if (game.global.challengeActive == "Insanity") {
        const insanityfarmzone = getPageSetting('Rinsanityfarmzone');
        const insanitystacksfarmindex = insanityfarmzone.indexOf(game.global.world);
        const insanityfarmcell = ((getPageSetting('Rinsanityfarmcell') != 0) ? getPageSetting('Rinsanityfarmcell')[insanitystacksfarmindex] : 1);
        Rinsanityfarm = (getPageSetting('Rinsanityon') == true && ((insanityfarmcell <= 1) || (insanityfarmcell > 1 && (game.global.lastClearedCell + 1) >= insanityfarmcell)) && game.global.world > 5 && (game.global.challengeActive == "Insanity" && getPageSetting('Rinsanityfarmzone')[0] > 0 && getPageSetting('Rinsanityfarmstack')[0] > 0));
        if (Rinsanityfarm) {
            Rinsanity(true, false, false);
        }
        Rinsanity(false, false, true);
    }

    //Storm
    if (game.global.challengeActive == "Storm") {
        Rstormfarm = (getPageSetting('Rstormon') == true && game.global.world > 5 && (game.global.challengeActive == "Storm" && getPageSetting('Rstormzone') > 0 && getPageSetting('RstormHD') > 0 && getPageSetting('Rstormmult') > 0));
        if (Rstormfarm) {
            Rstorm(true);
        }
    }
    
    //Desolation
    if (game.global.challengeActive == "Desolation") {
        Rdesofarm = (getPageSetting('Rdesoon') == true && game.global.world > 5 && (game.global.challengeActive == "Desolation" && getPageSetting('Rdesozone') > 0 && getPageSetting('RdesoHD') > 0 && getPageSetting('Rdesomult') > 0));
        if (Rdesofarm) {
            Rdeso(true);
        }
    }

    //Ship
    if (game.jobs.Worshipper.locked == 0) {
        const shipfarmcell = ((getPageSetting('Rshipfarmcell') > 0) ? getPageSetting('Rshipfarmcell') : 1);
        Rshipfarm = (game.jobs.Worshipper.locked == 0 && getPageSetting('Rshipfarmon') == true && ((shipfarmcell <= 1) || (shipfarmcell > 1 && (game.global.lastClearedCell + 1) >= shipfarmcell)) && game.global.world > 5 && (getPageSetting('Rshipfarmzone')[0] > 0 && getPageSetting('Rshipfarmamount')[0] > 0));
        if (Rshipfarm) {
            Rship(true, false, false);
        }
        Rship(false, false, true);
    }
    //Alch
    if (game.global.challengeActive == "Alchemy") {
        const alchfarmzone = getPageSetting('Ralchfarmzone');
        const alchstacksfarmindex = alchfarmzone.indexOf(game.global.world);
        const alchfarmcell = ((getPageSetting('Ralchfarmcell') != 0) ? getPageSetting('Ralchfarmcell')[alchstacksfarmindex] : 1);
        Ralchfarm = (getPageSetting('Ralchon') == true && ((alchfarmcell <= 1) || (alchfarmcell > 1 && (game.global.lastClearedCell + 1) >= alchfarmcell)) && game.global.world > 5 && (game.global.challengeActive == "Alchemy" && getPageSetting('Ralchfarmzone')[0] > 0 && getPageSetting('Ralchfarmstack').length > 0));
        if (Ralchfarm) {
            Ralch(true, false, false);
        }
        Ralch(false, false, true);
    }

    //Hypo
    Rshouldcastle = false;
    if (game.global.challengeActive == "Hypothermia") {
        if (game.global.world >= getPageSetting('Rhypocastle')) {
            Rshouldcastle = true;
        }
        const hypofarmzone = getPageSetting('Rhypofarmzone');
        const hypoamountfarmindex = hypofarmzone.indexOf(game.global.world);
        const hypofarmcell = ((getPageSetting('Rhypofarmcell') != 0) ? getPageSetting('Rhypofarmcell')[hypoamountfarmindex] : 1);
        Rhypofarm = (getPageSetting('Rhypoon') == true && ((hypofarmcell <= 1) || (hypofarmcell > 1 && (game.global.lastClearedCell + 1) >= hypofarmcell)) && game.global.world > 5 && (game.global.challengeActive == "Hypothermia" && getPageSetting('Rhypofarmzone')[0] > 0 && getPageSetting('Rhypofarmstack').length > 0));
        if (Rhypofarm) {
            Rhypo(true, false, false);
        }
        Rhypo(false, false, true);
    }

    //Equip Farming
    Requipfarm = (getPageSetting('Requipfarmon') == true && game.global.world > 5 && (getPageSetting('Requipfarmzone') > 0 && getPageSetting('RequipfarmHD') > 0 && getPageSetting('Requipfarmmult') > 0));
    if (Requipfarm) {
        const equipfarmzone = getPageSetting('Requipfarmzone');
        const metal = game.resources.metal.owned
        const metalneeded = estimateEquipsForZone()[0];

        if (game.global.world >= equipfarmzone && metal < metalneeded) {
            Rshouldequipfarm = true;
        }
    }

    //### Map selection section

    //Map Selection
    const obj: any = {};
    for (const map in game.global.mapsOwnedArray) {
        if (!game.global.mapsOwnedArray[map].noRecycle) {
            obj[map] = game.global.mapsOwnedArray[map].level;
        }
    }
    const keysSorted = Object.keys(obj).sort(function(a, b) {
        return obj[b] - obj[a];
    });
    let highestMap: any;
    let lowestMap;
    if (keysSorted[0]) {
        highestMap = keysSorted[0];
        lowestMap = keysSorted[keysSorted.length - 1];
    } else
        selectedMap = "create";

    //### Specific maps that take priority over everything else that can be found in mapfunctions.js

    //Uniques
    const runUniques = (getPageSetting('RAutoMaps') == 1);
    if (runUniques || Rshoulddobogs || Rshouldcastle) {
        for (const map in game.global.mapsOwnedArray) {
            const theMap = game.global.mapsOwnedArray[map];
            if (Rshoulddobogs && theMap.name == 'The Black Bog') {
                selectedMap = theMap.id;
                break;
            } else if (runUniques && theMap.noRecycle) {
                if (theMap.name == 'Big Wall' && !game.upgrades.Bounty.allowed && !game.upgrades.Bounty.done && game.global.highestRadonLevelCleared < 40) {
                    if (game.global.world < 8 && RcalcHDratio() > 4) continue;
                    selectedMap = theMap.id;
                    break;
                }
                if (theMap.name == 'Dimension of Rage' && document.getElementById("portalBtn")!.style.display == "none" && game.upgrades.Rage.done == 1) {
                    if (game.global.challengeActive != "Unlucky" && (game.global.world < 16 || RcalcHDratio() < 2)) continue;
                    selectedMap = theMap.id;
                    break;
                }
                if (getPageSetting('Rprispalace') == true && theMap.name == 'Prismatic Palace' && game.mapUnlocks.Prismalicious.canRunOnce) {
                    if (game.global.world < 21 || RcalcHDratio() > 25) continue;
                    selectedMap = theMap.id;
                    break;
                }
                let meltingpoint = [10000, 10000];
                if (getPageSetting('Rmeltpoint')[0] > 0 && getPageSetting('Rmeltpoint')[1] >= 0) meltingpoint = getPageSetting('Rmeltpoint');
                if (theMap.name == 'Melting Point' && ((game.global.challengeActive == "Trappapalooza" && game.global.world >= meltingpoint[0] && ((game.global.lastClearedCell + 1) >= meltingpoint[1])) || (game.global.challengeActive == "Melt" && game.global.world >= meltingpoint[0] && ((game.global.lastClearedCell + 1) >= meltingpoint[1])) || (getPageSetting('Rmeltsmithy') > 0 && getPageSetting('Rmeltsmithy') <= game.buildings.Smithy.owned && game.mapUnlocks.SmithFree.canRunOnce))) {
                    if (game.global.world < 50 || (game.global.world == 50 && game.global.lastClearedCell < 55)) continue;
                    selectedMap = theMap.id;
                    break;
                }
                if (game.global.challengeActive == "Hypothermia" && getPageSetting('Rhypocastle') > 0 && theMap.name == 'Frozen Castle' && game.global.world >= getPageSetting('Rhypocastle')) {
                    if (getPageSetting('Rhypovoids') == true && game.global.totalVoidMaps <= 0) {
                        selectedMap = theMap.id;
                        break;
                    }
                    if (getPageSetting('Rhypovoids') == false) {
                        selectedMap = theMap.id;
                        break;
                    }
                }
                if (game.global.challengeActive != "Hypothermia" && getPageSetting('Rfrozencastle') != -1 && theMap.name == 'Frozen Castle' && game.global.world >= getPageSetting('Rfrozencastle')[0] && ((game.global.lastClearedCell + 1) >= getPageSetting('Rfrozencastle')[1])) {
                    selectedMap = theMap.id;
                    break;
                }
            }
        }
    }

    //Voids
    if (RneedToVoid) {
        const voidArray = [];
        const prefixlist: any = {
            'Deadly': 10,
            'Heinous': 11,
            'Poisonous': 20,
            'Destructive': 30
        };
        const prefixkeys = Object.keys(prefixlist);
        const suffixlist: any = {
            'Descent': 7.077,
            'Void': 8.822,
            'Nightmare': 9.436,
            'Pit': 10.6
        };
        const suffixkeys = Object.keys(suffixlist);

        for (const map in game.global.mapsOwnedArray) {
            const theMap = game.global.mapsOwnedArray[map];
            if (theMap.location == 'Void') {
                for (const pre in prefixkeys) {
                    if (theMap.name.includes(prefixkeys[pre]))
                        theMap.sortByDiff = 1 * prefixlist[prefixkeys[pre]];
                }
                for (const suf in suffixkeys) {
                    if (theMap.name.includes(suffixkeys[suf]))
                        theMap.sortByDiff += 1 * suffixlist[suffixkeys[suf]];
                }
                voidArray.push(theMap);
            }
        }

        const voidArraySorted = voidArray.sort(function(a, b) {
            return a.sortByDiff - b.sortByDiff;
        });
        for (const map in voidArraySorted) {
            const theMap = voidArraySorted[map];
            RdoVoids = true;
            if (getPageSetting('RDisableFarm') <= 0)
                RshouldFarm = RshouldFarm || false;
            if (!restartVoidMap)
                selectedMap = theMap.id;
            break;
        }
    }

    //### Automaps automatic part

    //Raiding - split off from the rest to make it easier
    if (Rshoulddopraid) {
        if (selectedMap == "world") {
            selectedMap = "createp";
        }
    }

    if (Rdshoulddopraid) {
        if (selectedMap == "world") {
            selectedMap = "dcreatep";
        }
    }

    //Everything else - mostly stuff from mapfunctions.js but also some important bits like voids or general farming
    if (!Rshoulddopraid && !Rdshoulddopraid) selectedMap = RselectMap(selectedMap);

    //### Getting to Map Creation and Repeat.

    //Repeat
    if (!game.global.preMapsActive && game.global.mapsActive) {
        RmapRepeat(selectedMap, shouldDoHealthMaps, restartVoidMap);
    }
    
    //Quest - no maps
    if (Rshoulddoquest == 6) selectedMap = "world";

    //Maps please
    else if (!game.global.preMapsActive && !game.global.mapsActive) {
        if (selectedMap != "world" && !game.global.switchToMaps) {
            mapsClicked();
        }
    }

    //### Creating Map Section

    else if (game.global.preMapsActive) {

        //Back to world
        if (selectedMap == "world") {
            mapsClicked();
        }

        //Praiding
        else if (selectedMap == "createp") {
            RAMP();
        } else if (selectedMap == "dcreatep") {
            dRAMP();
        }

        //Everything else
        else if (selectedMap == "create") {
            if (game.global.selectedMapPreset > 1) selectAdvMapsPreset(1);
            byId("mapLevelInput").value = game.global.world;
            let decrement: any;
            let tier;
            if (game.global.world >= customVars.RMapTierZone[0]) {
                tier = customVars.RMapTier0Sliders;
                decrement = [];
            } else if (game.global.world >= customVars.RMapTierZone[1]) {
                tier = customVars.RMapTier1Sliders;
                decrement = ['loot'];
            } else if (game.global.world >= customVars.RMapTierZone[2]) {
                tier = customVars.RMapTier2Sliders;
                decrement = ['loot'];
            } else {
                tier = customVars.RMapTier3Sliders;
                decrement = ['diff', 'loot'];
            }
            sizeAdvMapsRange.value = tier[0];
            adjustMap('size', tier[0]);
            difficultyAdvMapsRange.value = tier[1];
            adjustMap('difficulty', tier[1]);
            lootAdvMapsRange.value = tier[2];
            adjustMap('loot', tier[2]);
            biomeAdvMapsSelect.value = autoTrimpSettings.Rmapselection.selected == "Gardens" ? "Plentiful" : autoTrimpSettings.Rmapselection.selected;
            updateMapCost();
            if (RshouldFarm || game.global.challengeActive == 'Transmute') {
                biomeAdvMapsSelect.value = "Plentiful";
                updateMapCost();
            }
            if (Rshould(false, true) == "frag") {
                RfragMap();
            }
            if (Rshould(false, true) == "insanity") {
                RinsanityMap();
            }
            if (Rshould(false, true) == "alch") {
                RalchMap();
            }
            if (Rshould(false, true) == "hypo") {
                RhypoMap();
            }
            if (Rshould(false, true) == "ship") {
                RshipMap();
            }
            if (Rshould(false, true) == "time") {
                RtimeFarmMap(false);
            }
            if (Rshould(false, true) == "dtime") {
                RtimeFarmMap(true);
            }
            if (Rshould(false, true) == "smithy") {
                RsmithyFarmMap();
            }
            if (Rshould(false, true) == "tribute") {
                RtributeFarmMap();
            }
            if (Rshoulddoquest) {
                RquestMap(Rshoulddoquest);
            }
            // #65: was `== 2`, so option 1 ("M: Highest Map") never ran a mayhem map — it was
            // identical to option 0 ("M: Maps Off"). `> 0` runs both map modes; RselectMayhem picks
            // highest-owned vs smart-create, and RmayhemExtra stays 0 for option 1 (no extra levels).
            if (Rshouldmayhem > 0 && getPageSetting('Rmayhemmap') > 0 && !Rshouldtimefarm && !Rdshouldtimefarm) {
                RlevelMap("mayhem");
            }
            if (Rshouldpanda && getPageSetting('Rpandamaps') == true && !Rshouldtimefarm && !Rdshouldtimefarm) {
                RlevelMap("panda");
            }
            if (Rshoulddesofarm && !Rshouldtimefarm && !Rdshouldtimefarm) {
                RlevelMap("deso");
            }
            if (Rshouldequipfarm) {
                RlevelMap("equip");
            }

            //Are things too expensive
            if (updateMapCost(true) > game.resources.fragments.owned) {
                if (!RenoughDamage) decrement.push('diff');
                if (RshouldFarm) decrement.push('size');
            }
            while (decrement.indexOf('loot') > -1 && lootAdvMapsRange.value > 0 && updateMapCost(true) > game.resources.fragments.owned) {
                lootAdvMapsRange.value -= 1;
            }
            while (decrement.indexOf('diff') > -1 && difficultyAdvMapsRange.value > 0 && updateMapCost(true) > game.resources.fragments.owned) {
                difficultyAdvMapsRange.value -= 1;
            }
            while (decrement.indexOf('size') > -1 && sizeAdvMapsRange.value > 0 && updateMapCost(true) > game.resources.fragments.owned) {
                sizeAdvMapsRange.value -= 1;
            }
            while (lootAdvMapsRange.value > 0 && updateMapCost(true) > game.resources.fragments.owned) {
                lootAdvMapsRange.value -= 1;
            }
            while (difficultyAdvMapsRange.value > 0 && updateMapCost(true) > game.resources.fragments.owned) {
                difficultyAdvMapsRange.value -= 1;
            }
            while (sizeAdvMapsRange.value > 0 && updateMapCost(true) > game.resources.fragments.owned) {
                sizeAdvMapsRange.value -= 1;
            }

            //Looks like things are too expensive
            const maplvlpicked = parseInt(byId("mapLevelInput").value);
            if (updateMapCost(true) > game.resources.fragments.owned) {
                selectMap(game.global.mapsOwnedArray[highestMap].id);
                debug("Can't afford the map we designed, #" + maplvlpicked, "maps", '*crying2');
                debug("...selected our highest map instead # " + game.global.mapsOwnedArray[highestMap].id + " Level: " + game.global.mapsOwnedArray[highestMap].level, "maps", '*happy2');
                runMap();
                RlastMapWeWereIn = getCurrentMapObject();
            }

            //You can afford things
            else {
                debug("Buying a Map, level: #" + maplvlpicked, "maps", 'th-large');
                let result = buyMap();
                if (result == -2) {
                    debug("Too many maps, recycling now: ", "maps", 'th-large');
                    recycleBelow(true);
                    debug("Retrying, Buying a Map, level: #" + maplvlpicked, "maps", 'th-large');
                    result = buyMap();
                    if (result == -2) {
                        recycleMap(lowestMap);
                        result = buyMap();
                        if (result == -2)
                            debug("AutoMaps unable to recycle to buy map!");
                        else
                            debug("Retrying map buy after recycling lowest level map");
                    }
                }
            }

        //We created the map, selectedMap is the map we want
        } else {
            selectMap(selectedMap);
            const themapobj = game.global.mapsOwnedArray[getMapIndex(selectedMap)];
            let levelText;
            if (themapobj.level > 0) {
                levelText = " Level: " + themapobj.level;
            } else {
                levelText = " Level: " + game.global.world;
            }
            const voidorLevelText = themapobj.location == "Void" ? " Void: " : levelText;
            debug("Running selected " + selectedMap + voidorLevelText + " Name: " + themapobj.name, "maps", 'th-large');
            runMap();
            RlastMapWeWereIn = getCurrentMapObject();
        }
    }
}
