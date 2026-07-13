// TRUE TS (Phase 1 · #30): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/mapfunctions.js.
// Free identifiers resolve via the bridge at runtime, typed ambient. Behaviour-preserving: any body edits are TYPE-ONLY.
// The U2 (radon) map-selection / farming engine — 2779 lines, 371 game.* touches, 52 fns.
// getPageSetting + debug from converted utils. This module OWNS the R-map-state globals
// (RshouldFarm/RdoVoids/RneedToVoid/RshouldDoMaps/RdoMaxMapBonus/contractVoid/... — 103
// top-level vars) that maps.ts, equipment.ts and still-legacy modules read cross-module, so
// every top-level var is published to globalThis (shared-var seam; they were all globals in
// the original concat). Plus 3 sloppy implicit-global writes (sepcial/levelzones/selectedMap)
// initialised on globalThis below; functions with a local var selectedMap/levelzones keep it.
import { getPageSetting, getPageSettingAt, debug, byId } from './utils'

// Formerly-implicit-global state (see header) — published so strict-mode bare writes resolve.
globalThis.sepcial = undefined; globalThis.levelzones = undefined; globalThis.selectedMap = undefined;

//### RAutoMap Global VarsRshouldDoMaps
globalThis.RshouldFarm = false;
globalThis.RdoVoids = false;
globalThis.RneedToVoid = false;
globalThis.RneedPrestige = false;
globalThis.RshouldDoMaps = false;
globalThis.RlastMapWeWereIn = null;
globalThis.RdoMaxMapBonus = false;
globalThis.RvanillaMAZ = false;
globalThis.contractVoid = false;
globalThis.RadditionalCritMulti = 2 < getPlayerCritChance() ? 25 : 5;

//### Quest
globalThis.Rshoulddoquest = false;
globalThis.Rquestequalityscale = false;
globalThis.Rquestshieldzone = 0;

//### Map Module Vars

//Frag Farm
globalThis.Rshouldfragfarm = false;

//Time Farm
globalThis.Rtimefarm = false;
globalThis.Rshouldtimefarm = false;

//dTime Farm
globalThis.Rdtimefarm = false;
globalThis.Rdshouldtimefarm = false;

//Smithy Farm
globalThis.Rsmithyfarm = false;
globalThis.Rshouldsmithyfarm = false;

//Tribute
globalThis.Rshouldtributefarm = false;

//Bog
globalThis.Rshoulddobogs = false;

//Frozen Castle
globalThis.Rshouldcastle = false;

//Praid
globalThis.Rshoulddopraid = false;

//dPraid
globalThis.Rdshoulddopraid = false;

//Mayhem
globalThis.Rshouldmayhem = 0;
globalThis.Rmayhemextraglobal = -1;

//Panda
globalThis.Rshouldpanda = 0;
globalThis.Rpandaextraglobal = 1;

//Insanity
globalThis.Rinsanityfarm = false;
globalThis.Rshouldinsanityfarm = false;
globalThis.Rinsanityfragfarming = false;
globalThis.insanityfragmappy = undefined;
globalThis.insanityprefragmappy = undefined;
globalThis.insanityfragmappybought = false;

//Storm
globalThis.Rstormfarm = false;
globalThis.Rshouldstormfarm = false;

//Desolation
globalThis.Rdesofarm = false;
globalThis.Rshoulddesofarm = false;
globalThis.Rdesoextraglobal = 1;

//Equip Farm
globalThis.Requipfarm = false;
globalThis.Rshouldequipfarm = false;
globalThis.Requipminusglobal = -1;

//Ships
globalThis.Rshipfarm = false;
globalThis.Rshouldshipfarm = false;
globalThis.Rshipfragfarming = false;
globalThis.shipfragmappy = undefined;
globalThis.shipprefragmappy = undefined;
globalThis.shipfragmappybought = false;

//Alch
globalThis.Ralchfarm = false;
globalThis.Rshouldalchfarm = false;
globalThis.Rshouldhypofarm = false;
globalThis.Ralchfragfarming = false;
globalThis.alchfragmappy = undefined;
globalThis.alchprefragmappy = undefined;
globalThis.alchfragmappybought = false;

//Hypo
globalThis.Rhypofarm = false;
globalThis.Rhyposhouldwood = true;
globalThis.Rshouldhypofarm = false;
globalThis.Rhypofragfarming = false;
globalThis.hypofragmappy = undefined;
globalThis.hypoprefragmappy = undefined;
globalThis.hypofragmappybought = false;

export function RresetVars() {
    RshouldFarm = false;
    RdoVoids = false;
    RneedToVoid = false;
    RneedPrestige = false;
    RshouldDoMaps = false;
    RlastMapWeWereIn = null;
    RdoMaxMapBonus = false;
    RvanillaMAZ = false;
    contractVoid = false;
    RadditionalCritMulti = 2 < getPlayerCritChance() ? 25 : 5;

    //### Quest
    Rshoulddoquest = false;
    Rquestequalityscale = false;
    Rquestshieldzone = 0;

    //### Map Modules

    //Frag Farm
    Rshouldfragfarm = false;

    //Time Farm
    Rtimefarm = false;
    Rshouldtimefarm = false;

    //dTime Farm
    Rdtimefarm = false;
    Rdshouldtimefarm = false;

    //Smithy Farm
    Rsmithyfarm = false;
    Rshouldsmithyfarm = false;

    //Tribute
    Rshouldtributefarm = false;

    //Bog
    Rshoulddobogs = false;

    //Frozen Castle
    Rshouldcastle = false;

    //Praid
    Rshoulddopraid = false;
    RAMPpMap1 = undefined;
    RAMPpMap2 = undefined;
    RAMPpMap3 = undefined;
    RAMPpMap4 = undefined;
    RAMPpMap5 = undefined;
    RAMPfragmappy = undefined;
    RAMPrepMap1 = undefined;
    RAMPrepMap2 = undefined;
    RAMPrepMap3 = undefined;
    RAMPrepMap4 = undefined;
    RAMPrepMap5 = undefined;
    RAMPprefragmappy = undefined;
    RAMPmapbought1 = false;
    RAMPmapbought2 = false;
    RAMPmapbought3 = false;
    RAMPmapbought4 = false;
    RAMPmapbought5 = false;
    RAMPfragmappybought = false;
    RAMPdone = false;
    RAMPfragfarming = false;

    //dPraid
    Rdshoulddopraid = false;
    RdAMPpMap1 = undefined;
    RdAMPpMap2 = undefined;
    RdAMPpMap3 = undefined;
    RdAMPpMap4 = undefined;
    RdAMPpMap5 = undefined;
    RdAMPfragmappy = undefined;
    RdAMPrepMap1 = undefined;
    RdAMPrepMap2 = undefined;
    RdAMPrepMap3 = undefined;
    RdAMPrepMap4 = undefined;
    RdAMPrepMap5 = undefined;
    RdAMPprefragmappy = undefined;
    RdAMPmapbought1 = false;
    RdAMPmapbought2 = false;
    RdAMPmapbought3 = false;
    RdAMPmapbought4 = false;
    RdAMPmapbought5 = false;
    RdAMPfragmappybought = false;
    RdAMPdone = false;
    RdAMPfragfarming = false;

    //Mayhem
    Rshouldmayhem = 0;
    Rmayhemextraglobal = -1;

    //Panda
    Rshouldpanda = 0;
    Rpandaextraglobal = 1;

    //Insanity
    Rinsanityfarm = false;
    Rshouldinsanityfarm = false;
    Rinsanityfragfarming = false;
    insanityfragmappy = undefined;
    insanityprefragmappy = undefined;
    insanityfragmappybought = false;

    //Storm
    Rstormfarm = false;
    Rshouldstormfarm = false;
    
    //Desolation
    Rdesofarm = false;
    Rshoulddesofarm = false;
    Rdesoextraglobal = 1;

    //Equip Farm
    Requipfarm = false;
    Rshouldequipfarm = false;
    Requipminusglobal = -1;

    //Ships
    Rshipfarm = false;
    Rshouldshipfarm = false;
    Rshipfragfarming = false;
    shipfragmappy = undefined;
    shipprefragmappy = undefined;
    shipfragmappybought = false;

    //Alch
    Ralchfarm = false;
    Rshouldalchfarm = false;
    Rshouldhypofarm = false;
    Ralchfragfarming = false;
    alchfragmappy = undefined;
    alchprefragmappy = undefined;
    alchfragmappybought = false;

    //Hypo
    Rhypofarm = false;
    Rhyposhouldwood = true;
    Rshouldhypofarm = false;
    Rhypofragfarming = false;
    hypofragmappy = undefined;
    hypoprefragmappy = undefined;
    hypofragmappybought = false;
}

//###Other Functions - were in other.js but moved over

export function RfragMap() {
    byId("biomeAdvMapsSelect").value = "Plentiful";
    byId("advExtraLevelSelect").value = "0";
    byId("advSpecialSelect").value = "fa";
    byId("lootAdvMapsRange").value = "9";
    byId("difficultyAdvMapsRange").value = "9";
    byId("sizeAdvMapsRange").value = "9";
    byId("advPerfectCheckbox").checked = true;
    byId("mapLevelInput").value = String(game.global.world - 1);
    updateMapCost();

    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("biomeAdvMapsSelect").value = "Random";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("advPerfectCheckbox").checked = false;
        updateMapCost();
    }
    var fragsOwned = game.resources.fragments.owned;
    for (var i = 8; i >= 0; i--) {
        if (updateMapCost(true) > fragsOwned) {
          byId("difficultyAdvMapsRange").value = String(i);
        } else break;
        if (updateMapCost(true) > fragsOwned) {
          byId("sizeAdvMapsRange").value = String(i);
        } else break;
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("advSpecialSelect").value = "0";
        updateMapCost();
    }
}

export function RfragCalc(frag: any) {
    if (frag > game.resources.fragments.owned) Rshouldfragfarm = true;
    else Rshouldfragfarm = false;
}

export function RselectFrag() {
    var selectedMap = "create";
    if (Rshouldfragfarm) {
        for (var map in game.global.mapsOwnedArray) {
            if (!game.global.mapsOwnedArray[map].noRecycle && (game.global.world - 1) == game.global.mapsOwnedArray[map].level) {
                selectedMap = game.global.mapsOwnedArray[map].id;
                break;
            } else {
                selectedMap = "create";
            }
        }
    }
    return selectedMap;
}

export function RminFragMap(selection: any, number: any, special: any) {

    byId("biomeAdvMapsSelect").value = selection;
    byId("advExtraLevelSelect").value = number;
    byId("advSpecialSelect").value = special;
    byId("lootAdvMapsRange").value = "9";
    byId("difficultyAdvMapsRange").value = "9";
    byId("sizeAdvMapsRange").value = "9";
    byId("advPerfectCheckbox").checked = true;
    byId("mapLevelInput").value = game.global.world;
    updateMapCost();

    if (updateMapCost(true) <= game.resources.fragments.owned) {
        return updateMapCost(true);
    }

    //Nobodys perfect
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("advPerfectCheckbox").checked = false;
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }

    //Check minimum loot first
    for (var i = 8; i >= 0; i--) {
        if (updateMapCost(true) > game.resources.fragments.owned) {
            byId("lootAdvMapsRange").value = String(i);
            updateMapCost();
            if (updateMapCost(true) <= game.resources.fragments.owned) {
                return updateMapCost(true);
            }
        }
    }

    //Uh-oh ok lets try a bigger map
    for (var i = 8; i >= 0; i--) {
        if (updateMapCost(true) > game.resources.fragments.owned) {
            byId("sizeAdvMapsRange").value = String(i);
            updateMapCost();
            if (updateMapCost(true) <= game.resources.fragments.owned) {
                return updateMapCost(true);
            }
        }
    }

    //Bugger, looks like we're truly scraping the barrel now
    for (var i = 8; i >= 0; i--) {
        if (updateMapCost(true) > game.resources.fragments.owned) {
            byId("difficultyAdvMapsRange").value = String(i);
            updateMapCost();
            if (updateMapCost(true) <= game.resources.fragments.owned) {
                return updateMapCost(true);
            }
        }
    }

    //The bottom, you cannot afford lower than this so tough
    if (Number(byId("difficultyAdvMapsRange").value) === 0) {
        return updateMapCost(true);
    }
}

export function RfragCheck(what: any) {
    var cost = 0;
    var frag = false;
    var farmzone: any = 0;
    var farmlevel: any = 0;
    var selection = "Farmlands";
    var special = "fa";

    if (what == "insanity") {
        frag = getPageSetting('Rinsanityfarmfrag');
        farmzone = getPageSetting('Rinsanityfarmzone');
        farmlevel = getPageSetting('Rinsanityfarmlevel');
        selection = "Plentiful";
    }
    else if (what == "ship") {
        frag = getPageSetting('Rshipfarmfrag');
        farmzone = getPageSetting('Rshipfarmzone');
        farmlevel = getPageSetting('Rshipfarmlevel');
        special = game.global.highestRadonLevelCleared > 83 ? "lsc" : "ssc";
        selection = game.global.farmlandsUnlocked ? "Farmlands" : "Plentiful";
    }
    else if (what == "alch") {
        frag = getPageSetting('Ralchfarmfrag');
        farmzone = getPageSetting('Ralchfarmzone');
        farmlevel = getPageSetting('Ralchfarmlevel');
    }
    else if (what == "hypo") {
        frag = getPageSetting('Rhypofarmfrag');
        farmzone = getPageSetting('Rhypofarmzone');
        farmlevel = getPageSetting('Rhypofarmlevel');
        special = "lwc";
    }

    var farmlevelindex = farmzone.indexOf(game.global.world);
    var levelzones = farmlevel[farmlevelindex];

    if (what == "alch") {
        selection = getPageSetting('Ralchfarmselection')[farmlevelindex];
    }

    if (frag) cost = RminFragMap(selection, levelzones, special);

    if (game.resources.fragments.owned >= cost) return true;

    else return false;
}

export function RtimeFarm(should: any, level: any, map: any, special: any, daily: any) {
    var timefarmzone = daily ? getPageSetting('Rdtimefarmzone') : getPageSetting('Rtimefarmzone');
    var timefarmindex = timefarmzone.indexOf(game.global.world);

    var timefarmlevel = daily ? getPageSetting('Rdtimefarmlevel')[timefarmindex] : getPageSetting('Rtimefarmlevel')[timefarmindex];
    if (level) return timefarmlevel;

    // #103: these two used to index autoTrimpSettings.<id>.value[i] directly, the only two reads in
    // this function that reached around getPageSetting. Same value for every configured and every
    // unconfigured player (see utils.getPageSettingAt); it just can no longer throw on a bad store.
    var timefarmmap = getPageSettingAt(daily ? 'Rdtimefarmmap' : 'Rtimefarmmap', timefarmindex);
    if (map) return timefarmmap;

    var timefarmspecial = getPageSettingAt(daily ? 'Rdtimefarmspecial' : 'Rtimefarmspecial', timefarmindex);
    if (special) return timefarmspecial;

    var timefarmcell = daily ? getPageSetting('Rdtimefarmcell')[timefarmindex] : getPageSetting('Rtimefarmcell')[timefarmindex];
    var timefarmtime = daily ? getPageSetting('Rdtimefarmtime') : getPageSetting('Rtimefarmtime');
    var time = ((new Date().getTime() - game.global.zoneStarted) / 1000 / 60);
    var timezones = timefarmtime[timefarmindex];

    if (should && timefarmzone.includes(game.global.world)) {
        if (game.global.lastClearedCell + 2 >= timefarmcell && timezones > time && timezones > 0) {
            if (daily) {
                Rdshouldtimefarm = true;
            } else Rshouldtimefarm = true;
        }
        if (!daily && game.global.challengeActive == 'Daily' && getPageSetting('Rdtimefarm') != 2) {
            Rshouldtimefarm = false;
        }
    }
}

export function RtimeFarmMap(daily: any) {
    if (getPageSetting('Rtimefarmlevel') != 0 || (daily && getPageSetting('Rdtimefarmlevel') != 0)) {
        levelzones = daily ? RtimeFarm(false, true, false, false, true) : RtimeFarm(false, true, false, false, false);
        if (levelzones > 0) {
            byId("mapLevelInput").value = game.global.world;
            byId("advExtraLevelSelect").value = levelzones;
        } else if (levelzones < 0) {
            byId("mapLevelInput").value = (game.global.world + levelzones);
        }
    }

    biomeAdvMapsSelect.value = daily ? RtimeFarm(false, false, true, false, true) : RtimeFarm(false, false, true, false, false);
    byId("advSpecialSelect").value = daily ? RtimeFarm(false, false, false, true, true) : RtimeFarm(false, false, false, true, false);
    updateMapCost();
}

//Smithy Farm

export function RsmithyFarm(amount: any) {
    var smithyfarmzone = getPageSetting('Rsmithyfarmzone');
    var smithyfarmindex = smithyfarmzone.indexOf(game.global.world);

    var smithyfarmcell = getPageSetting('Rsmithyfarmcell')[smithyfarmindex];
    var smithyfarmsmithy = getPageSetting('Rsmithyfarmamount');
    var smithys = game.buildings.Smithy.owned;
    var smithyzones = smithyfarmsmithy[smithyfarmindex];

    if (amount) return smithyzones;

    if (smithyfarmzone.includes(game.global.world)) {
        if (game.global.lastClearedCell + 2 >= smithyfarmcell && smithyzones > smithys && smithyzones > 0) {
            Rshouldsmithyfarm = true;
        }
    }
}

export function RmapLevelCalc() {
    var HD = (RcalcHDratio() / 1.5);
    var level = 0;
    
    if (HD >= 10000) level = -3;
    if (HD >= 5000) level = -2;
    if (HD >= 500) level = -1;
    if (HD <= 40) level = 0;
    if (HD <= 1) level = 1;
    if (HD <= 0.5) level = 2;
    if (HD <= 0.1) level = 3;
    if (HD <= 0.05) level = 4;
    if (HD <= 0.01) level = 5;
    if (HD <= 0.005) level = 6;
    if (HD <= 0.0001) level = 7;
    if (HD <= 0.00005) level = 8;
    
    return level;
}

export function RsmithyCalc(level: any, selection: any, special: any, gather: any) {
    var smithys = game.buildings.Smithy.owned;
    var goal = RsmithyFarm(true) - smithys;
    var afford = true;
    if (goal > 0) afford = canAffordBuilding("Smithy", false, false, false, false, goal);
    var smithywood: any, smithymetal: any, smithygems: any;

    if (!afford) {
        smithywood = game.resources.wood.owned - getBuildingItemPrice(game.buildings.Smithy, "wood", false, goal);
        smithymetal = game.resources.metal.owned - getBuildingItemPrice(game.buildings.Smithy, "metal", false, goal);
        smithygems = game.resources.gems.owned - getBuildingItemPrice(game.buildings.Smithy, "gems", false, goal);
    }

    if (level) return RmapLevelCalc();

    if (!afford && smithygems < 0) {
        if (selection) return "Depths";
        else if (special) return getHighestLevelCleared(true) > 65 ? "hc" : "lc";
        else if (gather) return "metal";
    }

    if (!afford && smithymetal < 0 && smithywood < 0) {
        if (selection) return game.global.farmlandsUnlocked ? "Farmlands" : "Plentiful";
        else if (special) return getHighestLevelCleared(true) > 65 ? "hc" : "lc";
        else if (gather) return "metal";
    }

    if (!afford && smithywood < 0) {
        if (selection) return game.global.farmlandsUnlocked ? "Farmlands" : "Plentiful";
        else if (special) return getHighestLevelCleared(true) > 85 ? "lwc" : "swc";
        else if (gather) return "wood";
    }

    if (!afford && smithymetal < 0) {
        if (selection) return game.global.farmlandsUnlocked ? "Farmlands" : "Plentiful";
        else if (special) return getHighestLevelCleared(true) > 85 ? "lmc" : "smc";
        else if (gather) return "metal";
    }
}

export function RsmithyFarmMap() {
    var levelzones: any = RsmithyCalc(true, false, false, false);
    if (levelzones > 0) {
        byId("mapLevelInput").value = game.global.world;
        byId("advExtraLevelSelect").value = levelzones;
    } else if (levelzones < 0) {
        byId("mapLevelInput").value = (game.global.world + levelzones);
    }

    biomeAdvMapsSelect.value = RsmithyCalc(false, true, false, false);
    byId("advSpecialSelect").value = String(RsmithyCalc(false, false, true, false));
    updateMapCost();
    if (updateMapCost(true) > game.resources.fragments.owned) {
        RfragCalc(updateMapCost(true));
    }
}

//Tribute Farm

export function RtributeFarm(should: any, level: any, map: any, special: any) {
    var tributefarmzone = getPageSetting('Rtributefarmzone');
    var tributefarmindex = tributefarmzone.indexOf(game.global.world);

    var tributefarmlevel = getPageSetting('Rtributefarmlevel')[tributefarmindex];
    if (level) return tributefarmlevel;

    // #103: the tribute-farm family is the same class as the time-farm one above — the net found it;
    // the issue body did not name it. Same fix, same equivalence.
    var tributefarmmap = getPageSettingAt('Rtributemapselection', tributefarmindex);
    if (map) return tributefarmmap;

    var tributefarmspecial = getPageSettingAt('Rtributespecialselection', tributefarmindex);
    if (special) return tributefarmspecial;

    var tributefarmcell = getPageSetting('Rtributefarmcell')[tributefarmindex];
    var tributefarmtribute = getPageSetting('Rtributefarmamount');
    var tributes = game.buildings.Tribute.owned;
    var tributezones = tributefarmtribute[tributefarmindex];

    if (should && tributefarmzone.includes(game.global.world)) {
        if (game.global.lastClearedCell + 2 >= tributefarmcell && tributezones > tributes && tributezones > 0) {
            Rshouldtributefarm = true;
        }
    }
}

export function RtributeFarmMap() {
    if (getPageSetting('Rtributefarmlevel') != 0) {
        levelzones = RtributeFarm(false, true, false, false);
        if (levelzones > 0) {
            byId("mapLevelInput").value = game.global.world;
            byId("advExtraLevelSelect").value = levelzones;
        } else if (levelzones < 0) {
            byId("mapLevelInput").value = (game.global.world + levelzones);
        }
    }

    biomeAdvMapsSelect.value = RtributeFarm(false, false, true, false);
    byId("advSpecialSelect").value = RtributeFarm(false, false, false, true);
    updateMapCost();
}

//Bogs

export function Rbogs() {
    var bogzone = getPageSetting('Rblackbogzone');
    var bogamount = getPageSetting('Rblackbogamount');
    var bogindex = bogzone.indexOf(game.global.world);
    var stacks = 100;
    var stacksum = 0;

    for (var i = 0; i < (bogindex + 1); i++) {
        stacksum += parseInt(bogamount[i]);
    }

    var totalstacks = stacks - stacksum;

    if (bogzone.includes(game.global.world) && game.challenges.Quagmire.motivatedStacks > totalstacks) {
        Rshoulddobogs = true;
    }
}

//Praiding

export function RPraid(daily: any) {
    var praidzone = daily ? getPageSetting('RdAMPraidzone') : getPageSetting('RAMPraidzone');
    var raidzone = daily ? getPageSetting('RdAMPraidraid') : getPageSetting('RAMPraidraid');

    var praidindex = praidzone.indexOf(game.global.world);
    var raidzones = raidzone[praidindex];

    var cell;
    cell = daily ? ((getPageSetting('RdAMPraidcell') != 0) ? getPageSetting('RdAMPraidcell')[praidindex] : 1) : ((getPageSetting('RAMPraidcell') != 0) ? getPageSetting('RAMPraidcell')[praidindex] : 1);

    if (praidzone.includes(game.global.world) && ((cell <= 1) || (cell > 1 && (game.global.lastClearedCell + 1) >= cell)) && Rgetequips(raidzones, false) > 0) {
        if (daily) {
            Rdshoulddopraid = true;
        } else Rshoulddopraid = true;
    }
}

export function Rmayhem() {
    var hits = (getPageSetting('Rmayhemabcut') > 0) ? getPageSetting('Rmayhemabcut') : 100;
    var hitssurv = (getPageSetting('Rmayhemhcut') > 0) ? getPageSetting('Rmayhemhcut') : 1;
    var enemyDamage = RcalcBadGuyDmg(null, RgetEnemyMaxAttack(game.global.world, 50, 'Snimp', 1.0));
    if (game.challenges.Mayhem.stacks > 0 && getPageSetting('Rmayhemattack') == true && (RcalcHDratio() > hits)) {
        Rshouldmayhem = 1;
    }
    if (game.challenges.Mayhem.stacks > 0 && getPageSetting('Rmayhemhealth') == true && (RcalcOurHealth() < (hitssurv * enemyDamage))) {
        Rshouldmayhem = 2;
    }
}

export function RmayhemExtra() {
    var mayhemextra = 0;
    if (Rshouldmayhem > 0 && getPageSetting('Rmayhemmap') == 2) {
        mayhemextra = 0;
        var health = (RcalcOurHealth() * 2);
        var attack = RcalcOurDmg("avg", false, true);
        var boss = game.challenges.Mayhem.getBossMult();
        var hitsmap = (getPageSetting('Rmayhemamcut') > 0) ? getPageSetting('Rmayhemamcut') : 100;
        var hitssurv = (getPageSetting('Rmayhemhcut') > 0) ? getPageSetting('Rmayhemhcut') : 1;
        var mlevels = 6;
        var go = false;
        if (
            (((RcalcEnemyHealth(game.global.world + mlevels) / boss)) <= (attack * (hitsmap * (mlevels + 1)))) &&
            ((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) / boss * 1.3) * (hitssurv)) <= health)
        ) {
            mayhemextra = mlevels;
            go = true;
        }
        if (!go) {
            mlevels = 5;
            if (
                (((RcalcEnemyHealth(game.global.world + mlevels) / boss)) <= (attack * (hitsmap * (mlevels + 1)))) &&
                ((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) / boss * 1.3) * (hitssurv)) <= health)
            ) {
                mayhemextra = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = 4;
            if (
                (((RcalcEnemyHealth(game.global.world + mlevels) / boss)) <= (attack * (hitsmap * (mlevels + 1)))) &&
                ((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) / boss * 1.3) * (hitssurv)) <= health)
            ) {
                mayhemextra = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = 3;
            if (
                (((RcalcEnemyHealth(game.global.world + mlevels) / boss)) <= (attack * (hitsmap * (mlevels + 1)))) &&
                ((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) / boss * 1.3) * (hitssurv)) <= health)
            ) {
                mayhemextra = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = 2;
            if (
                (((RcalcEnemyHealth(game.global.world + mlevels) / boss)) <= (attack * (hitsmap * (mlevels + 1)))) &&
                ((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) / boss * 1.3) * (hitssurv)) <= health)
            ) {
                mayhemextra = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = 1;
            if (
                (((RcalcEnemyHealth(game.global.world + mlevels) / boss)) <= (attack * (hitsmap * (mlevels + 1)))) &&
                ((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) / boss * 1.3) * (hitssurv)) <= health)
            ) {
                mayhemextra = mlevels;
                go = true;
            }
        }
        if (!go) {
            mayhemextra = 0;
            go = true;
        }
    }
    return mayhemextra;
}

//Panda

export function RpandaExtra() {
    var pandaextra = 1;
    if (Rshouldpanda == true && getPageSetting('Rpandamaps') == true) {
        pandaextra = 1;
        var health = (RcalcOurHealth() * 2);
        var attack = RcalcOurDmg("avg", false, true);
        var mult = (game.challenges.Pandemonium.getEnemyMult() * game.challenges.Pandemonium.getPandMult());
        var boss = game.challenges.Pandemonium.getBossMult();
        var hitsmap = (getPageSetting('Rpandahits') > 0) ? getPageSetting('Rpandahits') : 10;
        var hitssurv = 1;
        var mlevels = 6;
        var go = false;
        if (
            (((RcalcEnemyHealth(game.global.world + mlevels) / boss) * mult) <= (attack * (hitsmap * (mlevels + 1)))) &&
            ((((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) / boss) * mult) * 1.3) * (hitssurv)) <= health)
        ) {
            pandaextra = mlevels;
            go = true;
        }
        if (!go) {
            mlevels = 5;
            if (
                (((RcalcEnemyHealth(game.global.world + mlevels) / boss) * mult) <= (attack * (hitsmap * (mlevels + 1)))) &&
                ((((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) / boss) * mult) * 1.3) * (hitssurv)) <= health)
            ) {
                pandaextra = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = 4;
            if (
                (((RcalcEnemyHealth(game.global.world + mlevels) / boss) * mult) <= (attack * (hitsmap * (mlevels + 1)))) &&
                ((((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) / boss) * mult) * 1.3) * (hitssurv)) <= health)
            ) {
                pandaextra = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = 3;
            if (
                (((RcalcEnemyHealth(game.global.world + mlevels) / boss) * mult) <= (attack * (hitsmap * (mlevels + 1)))) &&
                ((((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) / boss) * mult) * 1.3) * (hitssurv)) <= health)
            ) {
                pandaextra = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = 2;
            if (
                (((RcalcEnemyHealth(game.global.world + mlevels) / boss) * mult) <= (attack * (hitsmap * (mlevels + 1)))) &&
                ((((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) / boss) * mult) * 1.3) * (hitssurv)) <= health)
            ) {
                pandaextra = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = 1;
            pandaextra = mlevels;
            go = true;
        }
    }
    return pandaextra;
}

//Insanity

export function Rinsanity(should: any, level: any, reset: any) {
    var insanityfarmzone = getPageSetting('Rinsanityfarmzone');
    var insanitystacksfarmindex = insanityfarmzone.indexOf(game.global.world);

    var insanityfarmlevel = getPageSetting('Rinsanityfarmlevel');
    if (level) return insanityfarmlevel[insanitystacksfarmindex];

    var insanityfarmstacks;
    var insanitystacks = game.challenges.Insanity.insanity;
    var maxinsanity = game.challenges.Insanity.maxInsanity;

    insanityfarmzone = getPageSetting('Rinsanityfarmzone');
    insanityfarmstacks = getPageSetting('Rinsanityfarmstack');

    var insanitystacksfarmindex = insanityfarmzone.indexOf(game.global.world);
    var insanitystackszones = insanityfarmstacks[insanitystacksfarmindex];
    if (insanitystackszones > maxinsanity) {
        insanitystackszones = maxinsanity;
    }

    if (should && insanityfarmzone.includes(game.global.world) && insanitystackszones != insanitystacks) {
        Rshouldinsanityfarm = true;
    }

    if (reset && !Rshouldinsanityfarm) {
        insanityfragmappy = undefined;
        insanityprefragmappy = undefined;
        insanityfragmappybought = false;
    }
}

export function RinsanityMap() {
    var insanityfragcheck = true;
    if (getPageSetting('Rinsanityfarmfrag') == true) {
        if (RfragCheck("insanity") == true) {
            insanityfragcheck = true;
            Rinsanityfragfarming = false;
        } else if (RfragCheck("insanity") == false && Rshouldinsanityfarm) {
            Rinsanityfragfarming = true;
            insanityfragcheck = false;
            if (!insanityfragcheck && insanityfragmappy == undefined && !insanityfragmappybought && game.global.preMapsActive && Rshouldinsanityfarm) {
                debug("Check complete for insanity frag map");
                RfragMap();
                if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                    buyMap();
                    insanityfragmappybought = true;
                    if (insanityfragmappybought) {
                        insanityfragmappy = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                        debug("insanity frag map bought");
                    }
                }
            }
            if (!insanityfragcheck && game.global.preMapsActive && !game.global.mapsActive && insanityfragmappybought && insanityfragmappy != undefined && Rshouldinsanityfarm) {
                debug("running insanity frag map");
                selectedMap = insanityfragmappy;
                selectMap(insanityfragmappy);
                runMap();
                RlastMapWeWereIn = getCurrentMapObject();
                insanityprefragmappy = insanityfragmappy;
                insanityfragmappy = undefined;
            }
            if (!insanityfragcheck && game.global.mapsActive && insanityfragmappybought && insanityprefragmappy != undefined && Rshouldinsanityfarm) {
                if (RfragCheck("insanity") == false) {
                    if (!game.global.repeatMap) {
                        repeatClicked();
                    }
                } else if (RfragCheck("insanity") == true) {
                    if (game.global.repeatMap) {
                        repeatClicked();
                        mapsClicked();
                    }
                    if (game.global.preMapsActive && insanityfragmappybought && insanityprefragmappy != undefined && Rshouldinsanityfarm) {
                        insanityfragmappybought = false;
                    }
                    if (insanityprefragmappy != undefined) {
                        recycleMap(getMapIndex(insanityprefragmappy));
                        insanityprefragmappy = undefined;
                    }
                    insanityfragcheck = true;
                    Rinsanityfragfarming = false;
                }
            }
        } else {
            insanityfragcheck = true;
            Rinsanityfragfarming = false;
        }
    }
    if (insanityfragcheck && getPageSetting('Rinsanityfarmlevel') != 0) {

        var insanitylevelzones = Rinsanity(false, true, false);
        if (insanitylevelzones > 0) {
            RminFragMap("Plentiful", insanitylevelzones, "fa");
            byId("mapLevelInput").value = game.global.world;
            byId("advExtraLevelSelect").value = insanitylevelzones;
        } else if (insanitylevelzones < 0) {
            RminFragMap("Plentiful", insanitylevelzones, "fa");
            byId("mapLevelInput").value = (game.global.world + insanitylevelzones);
            byId("advExtraLevelSelect").value = "0";
        }
    }
    updateMapCost();
}

//Storm

export function Rstorm(should: any) {
    var stormzone = getPageSetting('Rstormzone');
    var stormHD = getPageSetting('RstormHD');
    var stormmult = getPageSetting('Rstormmult');
    var stormHDzone = (game.global.world - stormzone);
    var stormHDmult = (stormHDzone == 0) ? stormHD : Math.pow(stormmult, stormHDzone) * stormHD;

    if (should && game.global.world >= stormzone && RcalcHDratio() > stormHDmult) {
        Rshouldstormfarm = true;
    }
}

//Desolation

export function Rdeso(should: any) {
    var desozone = getPageSetting('Rdesozone');
    var desoHD = getPageSetting('RdesoHD');
    var desomult = getPageSetting('Rdesomult');
    var desoHDzone = (game.global.world - desozone);
    var desoHDmult = (desoHDzone == 0) ? desoHD : Math.pow(desomult, desoHDzone) * desoHD;

    if (should && game.global.world >= desozone && RcalcHDratio() > desoHDmult) {
        Rshoulddesofarm = true;
    }
}

export function RdesoExtra() {
    var desoextra = 1;
    if (Rshoulddesofarm == true) {
        desoextra = 1;
        var health = (RcalcOurHealth() * 2);
        var attack = RcalcOurDmg("avg", false, true);
        var hitsmap = 10;
        var hitssurv = 1;
        var mlevels = 6;
        var go = false;
        if (
            ((RcalcEnemyHealth(game.global.world + mlevels)) <= (attack * (hitsmap * (mlevels + 1)))) &&
            (((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0)) * 1.3) * (hitssurv)) <= health)
        ) {
            desoextra = mlevels;
            go = true;
        }
        if (!go) {
            mlevels = 5;
            if (
                ((RcalcEnemyHealth(game.global.world + mlevels)) <= (attack * (hitsmap * (mlevels + 1)))) &&
                (((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0)) * 1.3) * (hitssurv)) <= health)
            ) {
                desoextra = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = 4;
            if (
                ((RcalcEnemyHealth(game.global.world + mlevels)) <= (attack * (hitsmap * (mlevels + 1)))) &&
                (((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0)) * 1.3) * (hitssurv)) <= health)
            ) {
                desoextra = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = 3;
            if (
                ((RcalcEnemyHealth(game.global.world + mlevels)) <= (attack * (hitsmap * (mlevels + 1)))) &&
                (((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0)) * 1.3) * (hitssurv)) <= health)
            ) {
                desoextra = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = 2;
            if (
                ((RcalcEnemyHealth(game.global.world + mlevels)) <= (attack * (hitsmap * (mlevels + 1)))) &&
                (((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0)) * 1.3) * (hitssurv)) <= health)
            ) {
                desoextra = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = 1;
            desoextra = mlevels;
            go = true;
        }
    }
    return desoextra;
}

//Ships

export function Rship(should: any, level: any, reset: any) {

    var shipfarmzone = getPageSetting('Rshipfarmzone');
    var shipamountfarmindex = shipfarmzone.indexOf(game.global.world);

    var shipfarmlevel = getPageSetting('Rshipfarmlevel');
    if (level) return shipfarmlevel[shipamountfarmindex];

    var shipfarmamount = getPageSetting('Rshipfarmamount');
    var ships = game.jobs.Worshipper.owned;
    var shipamountzones = shipfarmamount[shipamountfarmindex];

    if (getPageSetting('Rshipfarmamount') == 50) shipamountzones = 50;

    if (should && shipfarmzone.includes(game.global.world) && shipamountzones > ships) {
        Rshouldshipfarm = true;
    }

    if (reset && !Rshouldshipfarm) {
        shipfragmappy = undefined;
        shipprefragmappy = undefined;
        shipfragmappybought = false;
    }
}

export function RshipMap() {
    var shipfragcheck = true;
    if (getPageSetting('Rshipfarmfrag') == true) {
        if (RfragCheck("ship") == true) {
            shipfragcheck = true;
            Rshipfragfarming = false;
        } else if (RfragCheck("ship") == false && Rshouldshipfarm) {
            Rshipfragfarming = true;
            shipfragcheck = false;
            if (!shipfragcheck && shipfragmappy == undefined && !shipfragmappybought && game.global.preMapsActive && Rshouldshipfarm) {
                debug("Check complete for ship frag map");
                RfragMap();
                if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                    buyMap();
                    shipfragmappybought = true;
                    if (shipfragmappybought) {
                        shipfragmappy = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                        debug("ship frag map bought");
                    }
                }
            }
            if (!shipfragcheck && game.global.preMapsActive && !game.global.mapsActive && shipfragmappybought && shipfragmappy != undefined && Rshouldshipfarm) {
                debug("running ship frag map");
                selectedMap = shipfragmappy;
                selectMap(shipfragmappy);
                runMap();
                RlastMapWeWereIn = getCurrentMapObject();
                shipprefragmappy = shipfragmappy;
                shipfragmappy = undefined;
            }
            if (!shipfragcheck && game.global.mapsActive && shipfragmappybought && shipprefragmappy != undefined && Rshouldshipfarm) {
                if (RfragCheck("ship") == false) {
                    if (!game.global.repeatMap) {
                        repeatClicked();
                    }
                } else if (RfragCheck("ship") == true) {
                    if (game.global.repeatMap) {
                        repeatClicked();
                        mapsClicked();
                    }
                    if (game.global.preMapsActive && shipfragmappybought && shipprefragmappy != undefined && Rshouldshipfarm) {
                        shipfragmappybought = false;
                    }
                    if (shipprefragmappy != undefined) {
                        recycleMap(getMapIndex(shipprefragmappy));
                        shipprefragmappy = undefined;
                    }
                    shipfragcheck = true;
                    Rshipfragfarming = false;
                }
            }
        } else {
            shipfragcheck = true;
            Rshipfragfarming = false;
        }
    }
    if (shipfragcheck && getPageSetting('Rshipfarmlevel') != 0) {

        var shiplevelzones = Rship(false, true, false);

        if (Rshouldshipfarm) {
            var special = game.global.highestRadonLevelCleared > 83 ? "lsc" : "ssc";
            var selection = game.global.farmlandsUnlocked ? "Farmlands" : "Plentiful";
            if (shiplevelzones > 0) {
                RminFragMap(selection, shiplevelzones, special);
                byId("mapLevelInput").value = game.global.world;
                byId("advExtraLevelSelect").value = shiplevelzones;
            } else if (shiplevelzones == 0) {
                RminFragMap(selection, shiplevelzones, special);
                byId("mapLevelInput").value = game.global.world;
                byId("advExtraLevelSelect").value = "0";
            } else if (shiplevelzones < 0) {
                byId("mapLevelInput").value = (game.global.world + shiplevelzones);
                byId("advExtraLevelSelect").value = "0";
            }
        }
    }

    updateMapCost();
}

//Alch

export function Ralch(should: any, level: any, reset: any) {
    var alchfarmzone = getPageSetting('Ralchfarmzone');
    var alchstacksfarmindex = alchfarmzone.indexOf(game.global.world);

    var alchfarmlevel = getPageSetting('Ralchfarmlevel');
    if (level) return alchfarmlevel[alchstacksfarmindex];

    var alchfarmstacks = getPageSetting('Ralchfarmstack');

    var alchstackszones = alchfarmstacks[alchstacksfarmindex];
    if (alchstackszones != undefined) {
        var potion;
        var potionletter = alchstackszones[0];
        if (potionletter == 'h') {
            potion = alchObj.getPotionCount('Herby Brew');
            potionletter = "Herby Brew";
        } else if (potionletter == 'f') {
            potion = alchObj.getPotionCount('Potion of Finding');
            potionletter = "Potion of Finding";
        } else if (potionletter == 'g') {
            potion = alchObj.getPotionCount('Gaseous Brew');
            potionletter = "Gaseous Brew";
        } else if (potionletter == 'v') {
            potion = alchObj.getPotionCount('Potion of the Void');
            potionletter = "Potion of the Void";
        } else if (potionletter == 's') {
            potion = alchObj.getPotionCount('Potion of Strength');
            potionletter = "Potion of Strength";
        }

        if (alchstackszones.substring(1) > potion) {
            alchObj.craftPotion(potionletter);
        }

        if (should && alchfarmzone.includes(game.global.world) && alchstackszones.substring(1) > potion) {
            Rshouldalchfarm = true;
        }
    }

    if (reset && !Rshouldalchfarm) {
        alchfragmappy = undefined;
        alchprefragmappy = undefined;
        alchfragmappybought = false;
    }
}

export function RalchMap() {
    var alchfragcheck = true;
    if (getPageSetting('Ralchfarmfrag') == true) {
        if (RfragCheck("alch") == true) {
            alchfragcheck = true;
            Ralchfragfarming = false;
        } else if (RfragCheck("alch") == false && Rshouldalchfarm) {
            Ralchfragfarming = true;
            alchfragcheck = false;
            if (!alchfragcheck && alchfragmappy == undefined && !alchfragmappybought && game.global.preMapsActive && Rshouldalchfarm) {
                debug("Check complete for alch frag map");
                RfragMap();
                if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                    buyMap();
                    alchfragmappybought = true;
                    if (alchfragmappybought) {
                        alchfragmappy = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                        debug("alch frag map bought");
                    }
                }
            }
            if (!alchfragcheck && game.global.preMapsActive && !game.global.mapsActive && alchfragmappybought && alchfragmappy != undefined && Rshouldalchfarm) {
                debug("running alch frag map");
                selectedMap = alchfragmappy;
                selectMap(alchfragmappy);
                runMap();
                RlastMapWeWereIn = getCurrentMapObject();
                alchprefragmappy = alchfragmappy;
                alchfragmappy = undefined;
            }
            if (!alchfragcheck && game.global.mapsActive && alchfragmappybought && alchprefragmappy != undefined && Rshouldalchfarm) {
                if (RfragCheck("alch") == false) {
                    if (!game.global.repeatMap) {
                        repeatClicked();
                    }
                } else if (RfragCheck("alch") == true) {
                    if (game.global.repeatMap) {
                        repeatClicked();
                        mapsClicked();
                    }
                    if (game.global.preMapsActive && alchfragmappybought && alchprefragmappy != undefined && Rshouldalchfarm) {
                        alchfragmappybought = false;
                    }
                    if (alchprefragmappy != undefined) {
                        recycleMap(getMapIndex(alchprefragmappy));
                        alchprefragmappy = undefined;
                    }
                    alchfragcheck = true;
                    Ralchfragfarming = false;
                }
            }
        } else {
            alchfragcheck = true;
            Ralchfragfarming = false;
        }
    }
    if (alchfragcheck && getPageSetting('Ralchfarmlevel') != 0) {
        if (Rshouldalchfarm) {

            var alchfarmzone = getPageSetting('Ralchfarmzone');
            var alchfarmselection = getPageSetting('Ralchfarmselection')
            var alchlevelzones = Ralch(false, true, false);
            var alchfarmselectionindex = alchfarmzone.indexOf(game.global.world);
            var selection = alchfarmselection[alchfarmselectionindex];
            if (selection == 'Mountain') selection = "Mountain";
            else if (selection == 'Forest') selection = "Forest";
            else if (selection == 'Sea') selection = "Sea";
            else if (selection == 'Depths') selection = "Depths";
            else if (selection == 'Plentiful') selection = "Plentiful";
            else if (selection == 'Farmlands') selection = "Farmlands";

            RminFragMap(selection, alchlevelzones, "fa");
        }
    }
    updateMapCost();
}

//Hypo

export function Rhypo(should: any, level: any, reset: any) {
    var hypofarmzone = getPageSetting('Rhypofarmzone');
    var hypoamountfarmindex = hypofarmzone.indexOf(game.global.world);

    var hypofarmlevel = getPageSetting('Rhypofarmlevel');
    if (level) return hypofarmlevel[hypoamountfarmindex];

    var bonfire = game.challenges.Hypothermia.totalBonfires;
    var wood = game.resources.wood.max;
    var woodmax = wood * (1 + game.portal.Packrat.radLevel * game.portal.Packrat.modifier);
    woodmax = calcHeirloomBonus("Shield", "storageSize", woodmax, false);

    var hypofarmamount = getPageSetting('Rhypofarmstack');
    var hypoamountzones = hypofarmamount[hypoamountfarmindex];

    var currentprice = (1e10 * Math.pow(100, bonfire));
    var targetprice = (currentprice * Math.pow(100, ((hypoamountzones - bonfire) - 1))) * 1.05;
    targetprice += (targetprice / 1000)
    var gofarmbonfire = false;
    if (game.resources.wood.owned < targetprice) {
        gofarmbonfire = true;
    }

    if (should && hypofarmzone.includes(game.global.world) && gofarmbonfire) {
        Rshouldhypofarm = true;
        Rhyposhouldwood = false;
    }
    if (should && hypofarmzone.includes(game.global.world)) {
        Rhyposhouldwood = false;
    }

    if (reset && !Rshouldhypofarm) {
        hypofragmappy = undefined;
        hypoprefragmappy = undefined;
        hypofragmappybought = false;
    }

    // #96 — this line used to compare a NUMBER to an ARRAY: `bonfire > getPageSetting(...).slice(-1)`.
    // `.slice(-1)` yields a one-element ARRAY, so `>` ran it through ToPrimitive → String → Number. For a
    // CONFIGURED stack that coercion is exact (["10"] → "10" → 10), so this was never wrong for real
    // targets. The bug is what the UNSET encodings coerce to:
    //   [NaN×9] → "NaN" → NaN ⇒ every comparison FALSE  — the STRING 'undefined' default (see defs)
    //   []      → ""    → 0   ⇒ `bonfire > 0` TRUE       — LIVE BUG: an HF window saved with no rows
    //   [-1]    → "-1"  → -1  ⇒ `bonfire > -1` TRUE      — which is why the default could NOT simply be
    //                                                       re-pointed at the codebase's -1 sentinel
    // The [NaN] row was doing real work: it WAS the de-facto "no bonfire target" semantic, and clearing
    // Rhyposhouldwood blocks Smithy (buildings.ts:640), deprioritizes wood-costing housing (:501) and
    // skips Shield levelling (equipment.ts:985) for the whole challenge.
    //
    // So state "no target" EXPLICITLY rather than leaning on NaN poison, and compare against the NUMBER.
    // Unconfigured behavior is unchanged by construction, and all three unset encodings now agree.
    // Proven, and mutation-checked, in tests/mapfunctions.rhypo.test.ts.
    // #101 — the comparison was INVERTED, not off-by-one. `Rhyposhouldwood === false` means CONSERVE
    // wood (it blocks Smithy at buildings.ts:532, deprioritizes wood-costing housing at :382, and skips
    // Shield levelling at equipment.ts:826). The setting's own tooltip (settings-defs.ts:659) enumerates
    // exactly three conserve conditions, and this function has exactly three clauses:
    //
    //   "will not spend wood on zones you are farming bonfires"  → `should && hypofarmzone.includes(world)`  ✅
    //   "…until you can afford N total bonfires" (its example)   → gofarmbonfire (wood.owned < targetprice) ✅
    //   "or until you have ACHIEVED your bonfire goal"           → THIS clause                              ❌ was `>`
    //
    // "until you have achieved" means conserve WHILE NOT ACHIEVED — `bonfire < target`. The old `>` meant
    // the opposite: spend wood freely all the way up to the goal, then hoard it forever after overshooting.
    //
    // It mattered far more than it looks, because this is the ONLY clause that can fire outside a farm
    // zone — i.e. during most of the run. The other two are both inert there:
    //   - `hypofarmzone.includes(world)` is false by definition outside the zone list; and
    //   - hypoamountfarmindex = indexOf(world) = -1 ⇒ hypofarmamount[-1] is undefined ⇒ targetprice is
    //     NaN ⇒ `wood.owned < NaN` is FALSE ⇒ gofarmbonfire never fires.
    // (Note targetprice is independent of the current bonfire count: the 100^bonfire in `currentprice`
    // cancels against 100^(target - bonfire - 1), leaving 1e10 * 100^(target-1) * 1.05 — the price of the
    // target-th bonfire. So gofarmbonfire is "can I afford the goal", never "am I done".)
    //
    // Unconfigured players are unaffected by construction: hasBonfireTarget requires a target > 0, and all
    // three "unset" encodings ([-1] / [] / [NaN×9]) still leave Rhyposhouldwood true (#96, pinned below).
    const finalBonfireTarget = hypofarmamount[hypofarmamount.length - 1];
    const hasBonfireTarget = finalBonfireTarget > 0;
    if (reset && (gofarmbonfire || (hasBonfireTarget && bonfire < finalBonfireTarget))) Rhyposhouldwood = false;

}

export function RhypoMap() {
    var hypofragcheck = true;
    if (getPageSetting('Rhypofarmfrag') == true) {
        if (RfragCheck("hypo") == true) {
            hypofragcheck = true;
            Rhypofragfarming = false;
        } else if (RfragCheck("hypo") == false && Rshouldhypofarm) {
            Rhypofragfarming = true;
            hypofragcheck = false;
            if (!hypofragcheck && hypofragmappy == undefined && !hypofragmappybought && game.global.preMapsActive && Rshouldhypofarm) {
                debug("Check complete for hypo frag map");
                RfragMap();
                if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                    buyMap();
                    hypofragmappybought = true;
                    if (hypofragmappybought) {
                        hypofragmappy = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                        debug("hypo frag map bought");
                    }
                }
            }
            if (!hypofragcheck && game.global.preMapsActive && !game.global.mapsActive && hypofragmappybought && hypofragmappy != undefined && Rshouldhypofarm) {
                debug("running hypo frag map");
                selectedMap = hypofragmappy;
                selectMap(hypofragmappy);
                runMap();
                RlastMapWeWereIn = getCurrentMapObject();
                hypoprefragmappy = hypofragmappy;
                hypofragmappy = undefined;
            }
            if (!hypofragcheck && game.global.mapsActive && hypofragmappybought && hypoprefragmappy != undefined && Rshouldhypofarm) {
                if (RfragCheck("hypo") == false) {
                    if (!game.global.repeatMap) {
                        repeatClicked();
                    }
                } else if (RfragCheck("hypo") == true) {
                    if (game.global.repeatMap) {
                        repeatClicked();
                        mapsClicked();
                    }
                    if (game.global.preMapsActive && hypofragmappybought && hypoprefragmappy != undefined && Rshouldhypofarm) {
                        hypofragmappybought = false;
                    }
                    if (hypoprefragmappy != undefined) {
                        recycleMap(getMapIndex(hypoprefragmappy));
                        hypoprefragmappy = undefined;
                    }
                    hypofragcheck = true;
                    Rhypofragfarming = false;
                }
            }
        } else {
            hypofragcheck = true;
            Rhypofragfarming = false;
        }
    }
    if (hypofragcheck && getPageSetting('Rhypofarmlevel') != 0) {

        var hypolevelzones = Rhypo(false, true, false);

        if (hypolevelzones > 0) {
            RminFragMap("Farmlands", hypolevelzones, "lwc");
            byId("mapLevelInput").value = game.global.world;
            byId("advExtraLevelSelect").value = hypolevelzones;
        } else if (hypolevelzones == 0) {
            RminFragMap("Farmlands", hypolevelzones, "lwc");
            byId("mapLevelInput").value = game.global.world;
            byId("advExtraLevelSelect").value = "0";
        } else if (hypolevelzones < 0) {
            RminFragMap("Farmlands", hypolevelzones, "lwc");
            byId("mapLevelInput").value = (game.global.world + hypolevelzones);
            byId("advExtraLevelSelect").value = "0";
        }
    }
    updateMapCost();
}

//Equip Farm

export function RequipExtra() {
    var equipminus = 0;
    if (Rshouldequipfarm) {
        equipminus = 0;
        var health = (RcalcOurHealth() * 2);
        var attack = RcalcOurDmg("avg", false, true);
        var hits = (getPageSetting('Requipfarmhits') > 0) ? getPageSetting('Requipfarmhits') : 10;
        var hitssurv = (getPageSetting('Rhitssurvived') > 0) ? getPageSetting('Rhitssurvived') : 1;
        var mlevels = 0;
        var go = false;
        if (
            ((RcalcEnemyHealth(game.global.world + mlevels)) <= (attack * hits)) &&
            ((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) * 0.8) * (hitssurv)) <= (health))
        ) {
            equipminus = mlevels;
            go = true;
        }
        if (!go) {
            mlevels = -1;
            if (
                ((RcalcEnemyHealth(game.global.world + mlevels)) <= (attack * hits)) &&
                ((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) * 0.8) * (hitssurv)) <= (health))
            ) {
                equipminus = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = -2;
            if (
                ((RcalcEnemyHealth(game.global.world + mlevels)) <= (attack * hits)) &&
                ((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) * 0.8) * (hitssurv)) <= (health))
            ) {
                equipminus = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = -3;
            if (
                ((RcalcEnemyHealth(game.global.world + mlevels)) <= (attack * hits)) &&
                ((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) * 0.8) * (hitssurv)) <= (health))
            ) {
                equipminus = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = -4;
            if (
                ((RcalcEnemyHealth(game.global.world + mlevels)) <= (attack * hits)) &&
                ((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) * 0.8) * (hitssurv)) <= (health))
            ) {
                equipminus = mlevels;
                go = true;
            }
        }
        if (!go) {
            mlevels = -5;
            if (
                ((RcalcEnemyHealth(game.global.world + mlevels)) <= (attack * hits)) &&
                ((((RcalcBadGuyDmg(null, RgetEnemyMaxAttack((game.global.world + mlevels), 20, 'Snimp', 1.0))) * 0.8) * (hitssurv)) <= (health))
            ) {
                equipminus = mlevels;
                go = true;
            }
        }
        if (!go) {
            equipminus = -6;
            go = true;
        }
    }
    return equipminus;
}

export function Rshould(any: any, one: any) {
    if (any) {
        if (!Rshoulddopraid && !Rdshoulddopraid &&
            (RshouldDoMaps ||
                RdoVoids ||
                Rshouldfragfarm ||
                Rshouldtimefarm ||
                Rdshouldtimefarm ||
                Rshouldsmithyfarm ||
                Rshouldtributefarm ||
                Rshoulddoquest > 0 ||
                Rshouldmayhem > 0 ||
                Rshouldpanda ||
                Rshouldinsanityfarm ||
                Rshouldstormfarm ||
                Rshoulddesofarm ||
                Rshouldequipfarm ||
                Rshouldshipfarm ||
                Rshouldalchfarm ||
                Rshouldhypofarm)
        ) return true;
        else return false;
    }

    var should = "no";
    if (one && !Rshoulddopraid && !Rdshoulddopraid) {
        if (Rshouldfragfarm) should = "frag";
        else if (Rshouldmayhem) should = "mayhem";
        else if (Rshouldpanda) should = "panda";
        else if (Rshoulddesofarm) should = "deso";
        else if (Rshouldinsanityfarm) should = "insanity";
        else if (Rshouldalchfarm) should = "alch";
        else if (Rshouldhypofarm) should = "hypo";
        else if (Rshouldshipfarm) should = "ship";
        else if (Rshouldtimefarm) should = "time";
        else if (Rdshouldtimefarm) should = "dtime";
        else if (Rshouldsmithyfarm) should = "smithy";
        else if (Rshouldtributefarm) should = "tribute";
        else if (Rshouldequipfarm) should = "equip";
        else if (Rshoulddoquest) should = "quest";
    }
    if (should != "no") return should;
}

export function RselectMayhem() {
    var selectedMap = "create";
    if (getPageSetting('Rmayhemmap') == 2) {
        for (var map in game.global.mapsOwnedArray) {
            if (!game.global.mapsOwnedArray[map].noRecycle && RmayhemExtra() >= 0 && ((game.global.world + RmayhemExtra()) == game.global.mapsOwnedArray[map].level)) {
                selectedMap = game.global.mapsOwnedArray[map].id;
                break;
            } else {
                selectedMap = "create";
            }
        }
    } else if (getPageSetting('Rmayhemmap') == 1) {
        // #65: "M: Highest Map". Per the setting's own tooltip: "always selects the highest map you
        // have whether it be from Praiding, Time Farming or any you have manually created." Unlike
        // every other selector in this file (which match an EXACT level), this takes the max level
        // owned. Falls through to "create" only when no recyclable map is owned at all.
        var highestLevel = -1;
        for (var map in game.global.mapsOwnedArray) {
            var owned = game.global.mapsOwnedArray[map];
            if (!owned.noRecycle && owned.level > highestLevel) {
                highestLevel = owned.level;
                selectedMap = owned.id;
            }
        }
    } else {
        for (var map in game.global.mapsOwnedArray) {
            if (!game.global.mapsOwnedArray[map].noRecycle && game.global.world == game.global.mapsOwnedArray[map].level) {
                selectedMap = game.global.mapsOwnedArray[map].id;
                break;
            } else {
                selectedMap = "create";
            }
        }
    }
    return selectedMap;
}

export function RselectPanda() {
    var selectedMap = "create";
    if (getPageSetting('Rpandamaps') == true) {
        for (var map in game.global.mapsOwnedArray) {
            if (!game.global.mapsOwnedArray[map].noRecycle && RpandaExtra() >= 0 && ((game.global.world + RpandaExtra()) == game.global.mapsOwnedArray[map].level)) {
                selectedMap = game.global.mapsOwnedArray[map].id;
                break;
            } else {
                selectedMap = "create";
            }
        }
    }
    return selectedMap;
}

export function RselectDeso() {
    var selectedMap = "create";
        for (var map in game.global.mapsOwnedArray) {
            if (!game.global.mapsOwnedArray[map].noRecycle && RdesoExtra() >= 0 && ((game.global.world + RdesoExtra()) == game.global.mapsOwnedArray[map].level)) {
                selectedMap = game.global.mapsOwnedArray[map].id;
                break;
            } else {
                selectedMap = "create";
            }
        }
    return selectedMap;
}

export function RselectQuest() {
    var selectedMap = "create";
    if (Rshoulddoquest) {
        for (var map in game.global.mapsOwnedArray) {
            if (!game.global.mapsOwnedArray[map].noRecycle && game.global.world == game.global.mapsOwnedArray[map].level) {
                selectedMap = game.global.mapsOwnedArray[map].id;
                break;
            } else {
                selectedMap = "create";
            }
        }
    }
    return selectedMap;
}

export function RselectShip() {
    var selectedMap = "create";
    var level = getPageSetting('Rshipfarmlevel');
    var levelzones = Rship(false, true, false);
    var special = game.global.highestRadonLevelCleared > 83 ? "lsc" : "ssc";

    if (level == 0) {
        for (var map in game.global.mapsOwnedArray) {
            if (!game.global.mapsOwnedArray[map].noRecycle && game.global.world == game.global.mapsOwnedArray[map].level && game.global.mapsOwnedArray[map].bonus == special) {
                selectedMap = game.global.mapsOwnedArray[map].id;
                break;
            } else {
                selectedMap = "create";
            }
        }
    } else if (level != 0) {
        if (levelzones != 0) {
            for (var map in game.global.mapsOwnedArray) {
                if (!game.global.mapsOwnedArray[map].noRecycle && ((game.global.world + levelzones) == game.global.mapsOwnedArray[map].level) && game.global.mapsOwnedArray[map].bonus == special) {
                    selectedMap = game.global.mapsOwnedArray[map].id;
                    break;
                } else {
                    selectedMap = "create";
                }
            }
        } else if (levelzones == 0) {
            for (var map in game.global.mapsOwnedArray) {
                if (!game.global.mapsOwnedArray[map].noRecycle && game.global.world == game.global.mapsOwnedArray[map].level && game.global.mapsOwnedArray[map].bonus == special) {
                    selectedMap = game.global.mapsOwnedArray[map].id;
                    break;
                } else {
                    selectedMap = "create";
                }
            }
        }
    }
    return selectedMap;
}

export function RselectSmithy() {
    var selectedMap = "create";
    var levelzones: any = RsmithyCalc(true, false, false, false);
    var special = RsmithyCalc(false, false, true, false);

    if (levelzones != 0) {
        for (var map in game.global.mapsOwnedArray) {
            if (!game.global.mapsOwnedArray[map].noRecycle && ((game.global.world + levelzones) == game.global.mapsOwnedArray[map].level) && game.global.mapsOwnedArray[map].bonus == special) {
                selectedMap = game.global.mapsOwnedArray[map].id;
                break;
            } else {
                selectedMap = "create";
            }
        }
    } else if (levelzones == 0) {
        for (var map in game.global.mapsOwnedArray) {
            if (!game.global.mapsOwnedArray[map].noRecycle && game.global.world == game.global.mapsOwnedArray[map].level && game.global.mapsOwnedArray[map].bonus == special) {
                selectedMap = game.global.mapsOwnedArray[map].id;
                break;
            } else {
                selectedMap = "create";
            }
        }
    }
    return selectedMap;
}

export function RselectOther(other: any) {
    var selectedMap = "create";
    var level = 0;
    var levelzones = 0;
    if (other == "insanity") {
        level = getPageSetting('Rinsanityfarmlevel');
        levelzones = Rinsanity(false, true, false);
    } else if (other == "alch") {
        level = getPageSetting('Ralchfarmlevel');
        levelzones = Ralch(false, true, false);
    } else if (other == "hypo") {
        level = getPageSetting('Rhypofarmlevel');
        levelzones = Rhypo(false, true, false);
    } else if (other == "time") {
        level = getPageSetting('Rtimefarmlevel');
        levelzones = RtimeFarm(false, true, false, false, false);
    } else if (other == "dtime") {
        level = getPageSetting('Rdtimefarmlevel');
        levelzones = RtimeFarm(false, true, false, false, true);
    } else if (other == "tribute") {
        level = getPageSetting('Rtributefarmlevel');
        levelzones = RtributeFarm(false, true, false, false);
    }

    if (level == 0) {
        for (var map in game.global.mapsOwnedArray) {
            if (!game.global.mapsOwnedArray[map].noRecycle && game.global.world == game.global.mapsOwnedArray[map].level) {
                selectedMap = game.global.mapsOwnedArray[map].id;
                break;
            } else {
                selectedMap = "create";
            }
        }
    } else if (level != 0) {
        if (levelzones != 0) {
            for (var map in game.global.mapsOwnedArray) {
                if (!game.global.mapsOwnedArray[map].noRecycle && ((game.global.world + levelzones) == game.global.mapsOwnedArray[map].level)) {
                    selectedMap = game.global.mapsOwnedArray[map].id;
                    break;
                } else {
                    selectedMap = "create";
                }
            }
        } else if (levelzones == 0) {
            for (var map in game.global.mapsOwnedArray) {
                if (!game.global.mapsOwnedArray[map].noRecycle && game.global.world == game.global.mapsOwnedArray[map].level) {
                    selectedMap = game.global.mapsOwnedArray[map].id;
                    break;
                } else {
                    selectedMap = "create";
                }
            }
        }
    }
    return selectedMap;
}

export function RselectMap(selectedMap: any) {
    if (Rshould(true, false) && selectedMap == "world") {

            if (Rshould(false, true) == "frag") {
                selectedMap = RselectFrag();
            } else if (Rshould(false, true) == "mayhem") {
                selectedMap = RselectMayhem();
            } else if (Rshould(false, true) == "panda") {
                selectedMap = RselectPanda();
            } else if (Rshould(false, true) == "deso") {
                selectedMap = RselectDeso();
            } else if (Rshould(false, true) == "insanity") {
                selectedMap = RselectOther("insanity");
            } else if (Rshould(false, true) == "alch") {
                selectedMap = RselectOther("alch");
            } else if (Rshould(false, true) == "hypo") {
                selectedMap = RselectOther("hypo");
            } else if (Rshould(false, true) == "ship") {
                selectedMap = RselectShip();
            } else if (Rshould(false, true) == "time") {
                selectedMap = RselectOther("time");
            } else if (Rshould(false, true) == "dtime") {
                selectedMap = RselectOther("dtime");
            } else if (Rshould(false, true) == "smithy") {
                selectedMap = RselectSmithy();
            } else if (Rshould(false, true) == "tribute") {
                selectedMap = RselectOther("tribute");
            } else if (Rshould(false, true) == "quest") {
                selectedMap = RselectQuest();
            } else if (Rshould(false, true) == "equip") {
                for (var map in game.global.mapsOwnedArray) {
                    if (!game.global.mapsOwnedArray[map].noRecycle && RequipExtra() <= 0 && ((game.global.world + RequipExtra()) == game.global.mapsOwnedArray[map].level)) {
                        selectedMap = game.global.mapsOwnedArray[map].id;
                        break;
                    } else {
                        selectedMap = "create";
                    }
                }
            } else {
                for (var map in game.global.mapsOwnedArray) {
                    if (!game.global.mapsOwnedArray[map].noRecycle && game.global.world == game.global.mapsOwnedArray[map].level) {
                        selectedMap = game.global.mapsOwnedArray[map].id;
                        break;
                    } else {
                        selectedMap = "create";
                    }
                }
            }
    }
    return selectedMap;
}

export function RmapRepeat(selectedMap: any, shouldDoHealthMaps: any, restartVoidMap: any) {
    var doDefaultMapBonus = game.global.mapBonus < getPageSetting('RMaxMapBonuslimit') - 1;
    if (
        (RvanillaMAZ) ||
        (Rshoulddopraid || (Rshoulddopraid && RAMPfragfarming)) ||
        (Rdshoulddopraid || (Rdshoulddopraid && RdAMPfragfarming)) ||
        (Rshouldinsanityfarm || (Rshouldinsanityfarm && Rinsanityfragfarming)) ||
        (Rshouldalchfarm || (Rshouldalchfarm && Ralchfragfarming)) ||
        (Rshouldhypofarm || (Rshouldhypofarm && Rhypofragfarming)) ||
        (Rshouldshipfarm || (Rshouldshipfarm && Rshipfragfarming)) ||
        (selectedMap == game.global.currentMapId &&
            (!getCurrentMapObject().noRecycle &&
                (doDefaultMapBonus ||
                    RvanillaMAZ ||
                    RdoMaxMapBonus ||
                    RshouldFarm ||
                    Rshouldfragfarm ||
                    Rshouldtimefarm ||
                    Rdshouldtimefarm ||
                    Rshouldsmithyfarm ||
                    Rshouldtributefarm ||
                    Rshoulddobogs ||
                    (Rshoulddoquest > 0) ||
                    (Rshouldmayhem > 0) ||
                    Rshouldpanda ||
                    Rshouldstormfarm ||
                    Rshoulddesofarm ||
                    Rshouldequipfarm
                )
            )
        )
    ) {
        if (!game.global.repeatMap) {
            repeatClicked();
        }
        if (
            (Rshoulddopraid && !RAMPfragfarming) ||
            (Rdshoulddopraid && !RdAMPfragfarming)
        ) {
            if (game.options.menu.repeatUntil.enabled != 2) {
                game.options.menu.repeatUntil.enabled = 2;
            }

        } else if (
            ((Rshoulddopraid && RAMPfragfarming) || (Rdshoulddopraid && RdAMPfragfarming)) ||
            (Rshouldinsanityfarm && Rinsanityfragfarming) ||
            (Rshouldalchfarm && Ralchfragfarming) ||
            (Rshouldhypofarm && Rhypofragfarming) ||
            (Rshouldshipfarm && Rshipfragfarming)
        ) {
            if (game.options.menu.repeatUntil.enabled != 0) {
                game.options.menu.repeatUntil.enabled = 0;
            }
        }

        if (
            !Rshoulddopraid &&
            !RAMPfragfarming &&
            !Rshouldfragfarm &&
            !Rdshoulddopraid &&
            !RdAMPfragfarming &&
            !Rshouldinsanityfarm &&
            !Rinsanityfragfarming &&
            !Rshouldalchfarm &&
            !Rshouldhypofarm &&
            !Rhypofragfarming &&
            !Ralchfragfarming &&
            !Rshoulddobogs &&
            !RshouldDoMaps &&
            !Rshouldtimefarm &&
            !Rdshouldtimefarm &&
            !Rshouldsmithyfarm &&
            !Rshouldtributefarm &&
            Rshoulddoquest <= 0 &&
            Rshouldmayhem <= 0 &&
            !Rshouldpanda &&
            !Rshouldstormfarm &&
            !Rshoulddesofarm &&
            !Rshouldequipfarm &&
            !Rshouldshipfarm &&
            !Rshipfragfarming
        ) {
            repeatClicked();
        }
        if (shouldDoHealthMaps && game.global.mapBonus >= getPageSetting('RMaxMapBonushealth')) {
            repeatClicked();
            shouldDoHealthMaps = false;
        }
        if (RdoMaxMapBonus && game.global.mapBonus < getPageSetting('RMaxMapBonuslimit')) {
            repeatClicked();
            RdoMaxMapBonus = false;
        }
        // #83 §4: `&&` binds tighter than `||`, so `game.global.repeatMap &&` used to guard ONLY the
        // first disjunct. repeatClicked() is a TOGGLE, not a setter (main.js:10983) — so any of the
        // six fragment-farm disjuncts firing while Repeat was already OFF turned Repeat back ON, and
        // AT re-ran the fragment map forever instead of leaving it. The precondition must wrap the
        // whole disjunction.
        if (game.global.repeatMap && (
            (Rshoulddoquest == 3 && game.global.mapBonus >= 4) ||
            (Rshoulddopraid && RAMPfragfarming && RAMPfrag(false) == true) ||
            (Rdshoulddopraid && RdAMPfragfarming && RAMPfrag(true) == true) ||
            (Rshouldinsanityfarm && Rinsanityfragfarming && RfragCheck("insanity") == true) ||
            (Rshouldalchfarm && Ralchfragfarming && RfragCheck("alch") == true) ||
            (Rshouldhypofarm && Rhypofragfarming && RfragCheck("hypo") == true) ||
            (Rshouldshipfarm && Rshipfragfarming && RfragCheck("ship") == true)
        )) {
            repeatClicked();
        }

    } else {
        if (game.global.repeatMap) {
            repeatClicked();
        }
        if (restartVoidMap) {
            mapsClicked(true);
        }
    }
}

export function RquestMap(quest: any) {
    biomeAdvMapsSelect.value = "Plentiful";
    if (quest == 4) {
        byId("advSpecialSelect").value = "hc";
        updateMapCost();
        if (updateMapCost(true) > game.resources.fragments.owned) {
            byId("advSpecialSelect").value = "fa";
            updateMapCost();
            if (updateMapCost(true) > game.resources.fragments.owned) {
                byId("advSpecialSelect").value = "0";
                updateMapCost();
            }
        }
    }
    if (quest == 7) {
        byId("advSpecialSelect").value = "hc";
        updateMapCost();
        if (updateMapCost(true) > game.resources.fragments.owned) {
            byId("advSpecialSelect").value = "lc";
            updateMapCost();
            if (updateMapCost(true) > game.resources.fragments.owned) {
                byId("advSpecialSelect").value = "fa";
                updateMapCost();
                if (updateMapCost(true) > game.resources.fragments.owned) {
                    byId("advSpecialSelect").value = "0";
                    updateMapCost();
                }
            }
        }
    }
    if (quest == 10) {
        byId("advSpecialSelect").value = "lsc";
        updateMapCost();
        if (updateMapCost(true) > game.resources.fragments.owned) {
            byId("advSpecialSelect").value = "ssc";
            updateMapCost();
            if (updateMapCost(true) > game.resources.fragments.owned) {
                byId("advSpecialSelect").value = "fa";
                updateMapCost();
                if (updateMapCost(true) > game.resources.fragments.owned) {
                    byId("advSpecialSelect").value = "0";
                    updateMapCost();
                }
            }
        }
    }
    if (quest == 11) {
        byId("advSpecialSelect").value = "lwc";
        updateMapCost();
        if (updateMapCost(true) > game.resources.fragments.owned) {
            byId("advSpecialSelect").value = "swc";
            updateMapCost();
            if (updateMapCost(true) > game.resources.fragments.owned) {
                byId("advSpecialSelect").value = "fa";
                updateMapCost();
                if (updateMapCost(true) > game.resources.fragments.owned) {
                    byId("advSpecialSelect").value = "0";
                    updateMapCost();
                }
            }
        }
    }
    if (quest == 12) {
        byId("advSpecialSelect").value = "lmc";
        updateMapCost();
        if (updateMapCost(true) > game.resources.fragments.owned) {
            byId("advSpecialSelect").value = "smc";
            updateMapCost();
            if (updateMapCost(true) > game.resources.fragments.owned) {
                byId("advSpecialSelect").value = "fa";
                updateMapCost();
                if (updateMapCost(true) > game.resources.fragments.owned) {
                    byId("advSpecialSelect").value = "0";
                    updateMapCost();
                }
            }
        }
    }
    if (quest == 13) {
        byId("advSpecialSelect").value = "fa";
        updateMapCost();
        if (updateMapCost(true) > game.resources.fragments.owned) {
            byId("advSpecialSelect").value = "0";
            updateMapCost();
        }
    }
    if (quest == 14) {
        byId("advSpecialSelect").value = "fa";
        updateMapCost();
        if (updateMapCost(true) > game.resources.fragments.owned) {
            byId("advSpecialSelect").value = "0";
            updateMapCost();
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        biomeAdvMapsSelect.value = "Random";
        updateMapCost();
    }
}

export function RlevelMap(what: any) {
    var extra = 0;
    var globalextra = 0;
    if (what == "mayhem") {
        extra = RmayhemExtra();
    } else if (what == "panda") {
        extra = RpandaExtra();
    } else if (what == "equip") {
        globalextra = RequipExtra();
    } else if (what == "deso") {
        extra = RdesoExtra();
    }
    mapLevelInput.value = (game.global.world + globalextra);
    biomeAdvMapsSelect.value = "Random";
    byId("advSpecialSelect").value = (what == "equip") ? "lmc" : "fa";
    byId("advExtraLevelSelect").value = String(extra);
    updateMapCost();
}
