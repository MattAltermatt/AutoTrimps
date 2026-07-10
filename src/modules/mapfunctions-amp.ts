// TRUE TS (Phase 1 · #30) / PHASE 3 split (#51): byte-faithful move of the Radon AMP / Prestige-Raid
// engine out of mapfunctions.ts. Function bodies are IDENTICAL to their pre-move form — NO refactor
// here (a later per-module pass). Names stay global via legacy-bridge's wildcard spread; maps.ts calls
// RAMP/dRAMP/RAMPreset and residual RmapRepeat calls RAMPfrag, all by bare name (ambient in at-legacy.d.ts).
// The RAMP*/RdAMP* globals have no placeholder-race with maps.ts, so this module's import position is
// unconstrained (unlike residual mapfunctions.ts, which keeps the load-order-sensitive R-map-state inits).
import { getPageSetting, debug, byId } from './utils'

// --- AMP prestige-raid map/frag state (moved from mapfunctions.ts top-of-file) ---
globalThis.RAMPpMap1 = undefined;
globalThis.RAMPpMap2 = undefined;
globalThis.RAMPpMap3 = undefined;
globalThis.RAMPpMap4 = undefined;
globalThis.RAMPpMap5 = undefined;
globalThis.RAMPfragmappy = undefined;
globalThis.RAMPrepMap1 = undefined;
globalThis.RAMPrepMap2 = undefined;
globalThis.RAMPrepMap3 = undefined;
globalThis.RAMPrepMap4 = undefined;
globalThis.RAMPrepMap5 = undefined;
globalThis.RAMPprefragmappy = undefined;
globalThis.RAMPmapbought1 = false;
globalThis.RAMPmapbought2 = false;
globalThis.RAMPmapbought3 = false;
globalThis.RAMPmapbought4 = false;
globalThis.RAMPmapbought5 = false;
globalThis.RAMPfragmappybought = false;
globalThis.RAMPdone = false;
globalThis.RAMPfragfarming = false;

globalThis.RdAMPpMap1 = undefined;
globalThis.RdAMPpMap2 = undefined;
globalThis.RdAMPpMap3 = undefined;
globalThis.RdAMPpMap4 = undefined;
globalThis.RdAMPpMap5 = undefined;
globalThis.RdAMPfragmappy = undefined;
globalThis.RdAMPrepMap1 = undefined;
globalThis.RdAMPrepMap2 = undefined;
globalThis.RdAMPrepMap3 = undefined;
globalThis.RdAMPrepMap4 = undefined;
globalThis.RdAMPrepMap5 = undefined;
globalThis.RdAMPprefragmappy = undefined;
globalThis.RdAMPmapbought1 = false;
globalThis.RdAMPmapbought2 = false;
globalThis.RdAMPmapbought3 = false;
globalThis.RdAMPmapbought4 = false;
globalThis.RdAMPmapbought5 = false;
globalThis.RdAMPfragmappybought = false;
globalThis.RdAMPdone = false;
globalThis.RdAMPfragfarming = false;

// --- AMP engine functions ---
export function RAMPplusMapToRun(daily: any, number: any) {
    var map;
    var praidzone = daily ? getPageSetting('RdAMPraidzone') : getPageSetting('RAMPraidzone');
    var raidzone = daily ? getPageSetting('RdAMPraidraid') : getPageSetting('RAMPraidraid');

    var praidindex = praidzone.indexOf(game.global.world);
    var raidzones = raidzone[praidindex];

    map = (raidzones - game.global.world - number);

    return map;
}

export function RAMPshouldrunmap(daily: any, number: any) {
    var go = false;
    var praidzone = daily ? getPageSetting('RdAMPraidzone') : getPageSetting('RAMPraidzone');
    var raidzone = daily ? getPageSetting('RdAMPraidraid') : getPageSetting('RAMPraidraid');

    var praidindex = praidzone.indexOf(game.global.world);
    var raidzones = raidzone[praidindex];

    var actualraidzone = (raidzones - number);

    if (Rgetequips(actualraidzone, false) > 0) {
        go = true;
    }
    return go;
}

export function RAMPplusPres(daily: any, number: any) {
    byId("biomeAdvMapsSelect").value = "Plentiful";
    byId("advExtraLevelSelect").value = String(daily ? RAMPplusMapToRun(true, number) : RAMPplusMapToRun(false, number));
    byId("advSpecialSelect").value = "p";
    byId("lootAdvMapsRange").value = "0";
    byId("difficultyAdvMapsRange").value = "9";
    byId("sizeAdvMapsRange").value = "9";
    byId("advPerfectCheckbox").checked = false;
    byId("mapLevelInput").value = game.global.world;
    updateMapCost();

    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("biomeAdvMapsSelect").value = "Random";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "8";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "8";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "7";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "7";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "6";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "6";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "5";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "5";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "4";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "4";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "3";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "3";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "2";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "2";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "1";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "1";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "0";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "0";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("advSpecialSelect").value = "fa";
        updateMapCost();
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("advSpecialSelect").value = "0";
        updateMapCost();
    }
}

export function RAMPplusPresfragmax(daily: any, number: any) {
    byId("biomeAdvMapsSelect").value = "Plentiful";
    byId("advExtraLevelSelect").value = String(daily ? RAMPplusMapToRun(true, number) : RAMPplusMapToRun(false, number));
    byId("advSpecialSelect").value = "p";
    byId("lootAdvMapsRange").value = "0";
    byId("difficultyAdvMapsRange").value = "9";
    byId("sizeAdvMapsRange").value = "9";
    byId("advPerfectCheckbox").checked = false;
    byId("mapLevelInput").value = game.global.world;
    updateMapCost();
    return updateMapCost(true);
}

export function RAMPplusPresfragmin(daily: any, number: any) {
    byId("biomeAdvMapsSelect").value = "Plentiful";
    byId("advExtraLevelSelect").value = String(daily ? RAMPplusMapToRun(true, number) : RAMPplusMapToRun(false, number));
    byId("advSpecialSelect").value = "p";
    byId("lootAdvMapsRange").value = "0";
    byId("difficultyAdvMapsRange").value = "9";
    byId("sizeAdvMapsRange").value = "9";
    byId("advPerfectCheckbox").checked = false;
    byId("mapLevelInput").value = game.global.world;
    updateMapCost();
    if (updateMapCost(true) <= game.resources.fragments.owned) {
        return updateMapCost(true);
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("biomeAdvMapsSelect").value = "Random";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "8";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "8";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "7";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "7";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "6";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "6";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "5";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "5";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "4";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "4";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "3";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "3";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "2";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "2";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "1";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "1";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("difficultyAdvMapsRange").value = "0";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("sizeAdvMapsRange").value = "0";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("advSpecialSelect").value = "fa";
        updateMapCost();
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            return updateMapCost(true);
        }
    }
    if (updateMapCost(true) > game.resources.fragments.owned) {
        byId("advSpecialSelect").value = "0";
        updateMapCost();
    }
    if (byId("advSpecialSelect").value == "0") {
        return updateMapCost(true);
    }
}

export function RAMPfrag(daily: any) {
    var cost = 0;
    var praidzone = daily ? getPageSetting('RdAMPraidzone') : getPageSetting('RAMPraidzone');
    var raidzone = daily ? getPageSetting('RdAMPraidraid') : getPageSetting('RAMPraidraid');
    var frag = daily ? getPageSetting('RdAMPraidfrag') : getPageSetting('RAMPraidfrag');

    var praidindex = praidzone.indexOf(game.global.world);
    var raidzones = raidzone[praidindex];

    if (Rgetequips(raidzones, false)) {
        if (frag == 1) cost += (daily ? RAMPplusPresfragmin(true, 0) : RAMPplusPresfragmin(false, 0));
        else if (frag == 2) cost += (daily ? RAMPplusPresfragmax(true, 0) : RAMPplusPresfragmax(false, 0));
    }
    if (Rgetequips((raidzones - 1), false)) {
        if (frag == 1) cost += (daily ? RAMPplusPresfragmin(true, 1) : RAMPplusPresfragmin(false, 1));
        else if (frag == 2) cost += (daily ? RAMPplusPresfragmax(true, 1) : RAMPplusPresfragmax(false, 1));
    }
    if (Rgetequips((raidzones - 2), false)) {
        if (frag == 1) cost += (daily ? RAMPplusPresfragmin(true, 2) : RAMPplusPresfragmin(false, 2));
        else if (frag == 2) cost += (daily ? RAMPplusPresfragmax(true, 2) : RAMPplusPresfragmax(false, 2));
    }
    if (Rgetequips((raidzones - 3), false)) {
        if (frag == 1) cost += (daily ? RAMPplusPresfragmin(true, 3) : RAMPplusPresfragmin(false, 3));
        else if (frag == 2) cost += (daily ? RAMPplusPresfragmax(true, 3) : RAMPplusPresfragmax(false, 3));
    }
    if (Rgetequips((raidzones - 4), false)) {
        if (frag == 1) cost += (daily ? RAMPplusPresfragmin(true, 4) : RAMPplusPresfragmin(false, 4));
        else if (frag == 2) cost += (daily ? RAMPplusPresfragmax(true, 4) : RAMPplusPresfragmax(false, 4));
    }

    if (game.resources.fragments.owned >= cost) return true;
    else return false;
}

//###RAutoMap Functions

//Time Farm


export function RAMPreset(daily: any) {

    if (!daily) {
        RAMPpMap1 = undefined;
        RAMPpMap2 = undefined;
        RAMPpMap3 = undefined;
        RAMPpMap4 = undefined;
        RAMPpMap5 = undefined;
        RAMPfragmappy = undefined;
        RAMPprefragmappy = undefined;
        RAMPmapbought1 = false;
        RAMPmapbought2 = false;
        RAMPmapbought3 = false;
        RAMPmapbought4 = false;
        RAMPmapbought5 = false;
        RAMPfragmappybought = false;
    } else {
        RdAMPpMap1 = undefined;
        RdAMPpMap2 = undefined;
        RdAMPpMap3 = undefined;
        RdAMPpMap4 = undefined;
        RdAMPpMap5 = undefined;
        RdAMPfragmappy = undefined;
        RdAMPprefragmappy = undefined;
        RdAMPmapbought1 = false;
        RdAMPmapbought2 = false;
        RdAMPmapbought3 = false;
        RdAMPmapbought4 = false;
        RdAMPmapbought5 = false;
        RdAMPfragmappybought = false;
    }

    var recycle = daily ? getPageSetting('RdAMPraidrecycle') : getPageSetting('RAMPraidrecycle');

    if (!daily) {

        if (RAMPrepMap1 != undefined) {
            if (recycle) {
                recycleMap(getMapIndex(RAMPrepMap1));
            }
            RAMPrepMap1 = undefined;
        }
        if (RAMPrepMap2 != undefined) {
            if (recycle) {
                recycleMap(getMapIndex(RAMPrepMap2));
            }
            RAMPrepMap2 = undefined;
        }
        if (RAMPrepMap3 != undefined) {
            if (recycle) {
                recycleMap(getMapIndex(RAMPrepMap3));
            }
            RAMPrepMap3 = undefined;
        }
        if (RAMPrepMap4 != undefined) {
            if (recycle) {
                recycleMap(getMapIndex(RAMPrepMap4));
            }
            RAMPrepMap4 = undefined;
        }
        if (RAMPrepMap5 != undefined) {
            if (recycle) {
                recycleMap(getMapIndex(RAMPrepMap5));
            }
            RAMPrepMap5 = undefined;
        }
    } else {

        if (RdAMPrepMap1 != undefined) {
            // @ts-expect-error #32 latent: typo 'recyle' should be 'recycle' — preserved byte-faithfully
            if (recyle) {
                recycleMap(getMapIndex(RdAMPrepMap1));
            }
            RdAMPrepMap1 = undefined;
        }
        if (RdAMPrepMap2 != undefined) {
            // @ts-expect-error #32 latent: typo 'recyle' should be 'recycle' — preserved byte-faithfully
            if (recyle) {
                recycleMap(getMapIndex(RdAMPrepMap2));
            }
            RdAMPrepMap2 = undefined;
        }
        if (RdAMPrepMap3 != undefined) {
            // @ts-expect-error #32 latent: typo 'recyle' should be 'recycle' — preserved byte-faithfully
            if (recyle) {
                recycleMap(getMapIndex(RdAMPrepMap3));
            }
            RdAMPrepMap3 = undefined;
        }
        if (RdAMPrepMap4 != undefined) {
            // @ts-expect-error #32 latent: typo 'recyle' should be 'recycle' — preserved byte-faithfully
            if (recyle) {
                recycleMap(getMapIndex(RdAMPrepMap4));
            }
            RdAMPrepMap4 = undefined;
        }
        if (RdAMPrepMap5 != undefined) {
            // @ts-expect-error #32 latent: typo 'recyle' should be 'recycle' — preserved byte-faithfully
            if (recyle) {
                recycleMap(getMapIndex(RdAMPrepMap5));
            }
            RdAMPrepMap5 = undefined;
        }
    }
}

export function RAMP() {
    RAMPdone = false;
    var RAMPfragcheck = true;
    if (getPageSetting('RAMPraidfrag') > 0) {
        if (RAMPfrag(false) == true) {
            RAMPfragcheck = true;
            RAMPfragfarming = false;
        } else if (RAMPfrag(false) == false && !RAMPmapbought1 && !RAMPmapbought2 && !RAMPmapbought3 && !RAMPmapbought4 && !RAMPmapbought5 && Rshoulddopraid) {
            RAMPfragfarming = true;
            RAMPfragcheck = false;
            if (!RAMPfragcheck && RAMPfragmappy == undefined && !RAMPfragmappybought && game.global.preMapsActive && Rshoulddopraid) {
                debug("Check complete for frag map");
                RfragMap();
                if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                    buyMap();
                    RAMPfragmappybought = true;
                    if (RAMPfragmappybought) {
                        RAMPfragmappy = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                        debug("frag map bought");
                    }
                }
            }
            if (!RAMPfragcheck && game.global.preMapsActive && !game.global.mapsActive && RAMPfragmappybought && RAMPfragmappy != undefined && Rshoulddopraid) {
                debug("running frag map");
                selectedMap = RAMPfragmappy;
                selectMap(RAMPfragmappy);
                runMap();
                RlastMapWeWereIn = getCurrentMapObject();
                RAMPprefragmappy = RAMPfragmappy;
                RAMPfragmappy = undefined;
            }
            if (!RAMPfragcheck && game.global.mapsActive && RAMPfragmappybought && RAMPprefragmappy != undefined && Rshoulddopraid) {
                if (RAMPfrag(false) == false) {
                    if (!game.global.repeatMap) {
                        repeatClicked();
                    }
                } else if (RAMPfrag(false) == true) {
                    if (game.global.repeatMap) {
                        repeatClicked();
                        mapsClicked();
                    }
                    if (game.global.preMapsActive && RAMPfragmappybought && RAMPprefragmappy != undefined && Rshoulddopraid) {
                        RAMPfragmappybought = false;
                    }
                    if (RAMPprefragmappy != undefined) {
                        recycleMap(getMapIndex(RAMPprefragmappy));
                        RAMPprefragmappy = undefined;
                    }
                    RAMPfragcheck = true;
                    RAMPfragfarming = false;
                }
            }
        } else {
            RAMPfragcheck = true;
            RAMPfragfarming = false;
        }
    }
    if (RAMPfragcheck && RAMPpMap5 == undefined && !RAMPmapbought5 && game.global.preMapsActive && Rshoulddopraid && RAMPshouldrunmap(false, 0)) {
        debug("Check complete for 5th map");
        RAMPplusPres(false, 0);
        if ((updateMapCost(true) <= game.resources.fragments.owned)) {
            buyMap();
            RAMPmapbought5 = true;
            if (RAMPmapbought5) {
                RAMPpMap5 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                debug("5th map bought");
            }
        }
    }
    if (RAMPfragcheck && RAMPpMap4 == undefined && !RAMPmapbought4 && game.global.preMapsActive && Rshoulddopraid && RAMPshouldrunmap(false, 1)) {
        debug("Check complete for 4th map");
        RAMPplusPres(false, 1);
        if ((updateMapCost(true) <= game.resources.fragments.owned)) {
            buyMap();
            RAMPmapbought4 = true;
            if (RAMPmapbought4) {
                RAMPpMap4 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                debug("4th map bought");
            }
        }
    }
    if (RAMPfragcheck && RAMPpMap3 == undefined && !RAMPmapbought3 && game.global.preMapsActive && Rshoulddopraid && RAMPshouldrunmap(false, 2)) {
        debug("Check complete for 3rd map");
        RAMPplusPres(false, 2);
        if ((updateMapCost(true) <= game.resources.fragments.owned)) {
            buyMap();
            RAMPmapbought3 = true;
            if (RAMPmapbought3) {
                RAMPpMap3 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                debug("3rd map bought");
            }
        }
    }
    if (RAMPfragcheck && RAMPpMap2 == undefined && !RAMPmapbought2 && game.global.preMapsActive && Rshoulddopraid && RAMPshouldrunmap(false, 3)) {
        debug("Check complete for 2nd map");
        RAMPplusPres(false, 3);
        if ((updateMapCost(true) <= game.resources.fragments.owned)) {
            buyMap();
            RAMPmapbought2 = true;
            if (RAMPmapbought2) {
                RAMPpMap2 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                debug("2nd map bought");
            }
        }
    }
    if (RAMPfragcheck && RAMPpMap1 == undefined && !RAMPmapbought1 && game.global.preMapsActive && Rshoulddopraid && RAMPshouldrunmap(false, 4)) {
        debug("Check complete for 1st map");
        RAMPplusPres(false, 4);
        if ((updateMapCost(true) <= game.resources.fragments.owned)) {
            buyMap();
            RAMPmapbought1 = true;
            if (RAMPmapbought1) {
                RAMPpMap1 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                debug("1st map bought");
            }
        }
    }
    if (RAMPfragcheck && !RAMPmapbought1 && !RAMPmapbought2 && !RAMPmapbought3 && !RAMPmapbought4 && !RAMPmapbought5) {
        RAMPpMap1 = undefined;
        RAMPpMap2 = undefined;
        RAMPpMap3 = undefined;
        RAMPpMap4 = undefined;
        RAMPpMap5 = undefined;
        debug("Failed to Prestige Raid. Looks like you can't afford to or have no equips to get!");
        Rshoulddopraid = false;
        autoTrimpSettings["RAutoMaps"].value = 0;
    }
    if (RAMPfragcheck && game.global.preMapsActive && !game.global.mapsActive && RAMPmapbought1 && RAMPpMap1 != undefined && Rshoulddopraid) {
        debug("running map 1");
        selectedMap = RAMPpMap1;
        selectMap(RAMPpMap1);
        runMap();
        RlastMapWeWereIn = getCurrentMapObject();
        RAMPrepMap1 = RAMPpMap1;
        RAMPpMap1 = undefined;
    }
    if (RAMPfragcheck && game.global.preMapsActive && !game.global.mapsActive && RAMPmapbought2 && RAMPpMap2 != undefined && Rshoulddopraid) {
        debug("running map 2");
        selectedMap = RAMPpMap2;
        selectMap(RAMPpMap2);
        runMap();
        RlastMapWeWereIn = getCurrentMapObject();
        RAMPrepMap2 = RAMPpMap2;
        RAMPpMap2 = undefined;
    }
    if (RAMPfragcheck && game.global.preMapsActive && !game.global.mapsActive && RAMPmapbought3 && RAMPpMap3 != undefined && Rshoulddopraid) {
        debug("running map 3");
        selectedMap = RAMPpMap3;
        selectMap(RAMPpMap3);
        runMap();
        RlastMapWeWereIn = getCurrentMapObject();
        RAMPrepMap3 = RAMPpMap3;
        RAMPpMap3 = undefined;
    }
    if (RAMPfragcheck && game.global.preMapsActive && !game.global.mapsActive && RAMPmapbought4 && RAMPpMap4 != undefined && Rshoulddopraid) {
        debug("running map 4");
        selectedMap = RAMPpMap4;
        selectMap(RAMPpMap4);
        runMap();
        RlastMapWeWereIn = getCurrentMapObject();
        RAMPrepMap4 = RAMPpMap4;
        RAMPpMap4 = undefined;
    }
    if (RAMPfragcheck && game.global.preMapsActive && !game.global.mapsActive && RAMPmapbought5 && RAMPpMap5 != undefined && Rshoulddopraid) {
        debug("running map 5");
        selectedMap = RAMPpMap5;
        selectMap(RAMPpMap5);
        runMap();
        RlastMapWeWereIn = getCurrentMapObject();
        RAMPrepMap5 = RAMPpMap5;
        RAMPpMap5 = undefined;
    }
}

export function dRAMP() {
    RdAMPdone = false;
    debug("dcreatep selected");
    var RdAMPfragcheck = true;
    if (getPageSetting('RdAMPraidfrag') > 0) {
        if (RAMPfrag(true) == true) {
            RdAMPfragcheck = true;
            RdAMPfragfarming = false;
        } else if (RAMPfrag(true) == false && !RdAMPmapbought1 && !RdAMPmapbought2 && !RdAMPmapbought3 && !RdAMPmapbought4 && !RdAMPmapbought5 && Rdshoulddopraid) {
            RdAMPfragfarming = true;
            RdAMPfragcheck = false;
            if (!RdAMPfragcheck && RdAMPfragmappy == undefined && !RdAMPfragmappybought && game.global.preMapsActive && Rdshoulddopraid) {
                debug("Check complete for frag map");
                RfragMap();
                if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                    buyMap();
                    RdAMPfragmappybought = true;
                    if (RdAMPfragmappybought) {
                        RdAMPfragmappy = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                        debug("frag map bought");
                    }
                }
            }
            if (!RdAMPfragcheck && game.global.preMapsActive && !game.global.mapsActive && RdAMPfragmappybought && RdAMPfragmappy != undefined && Rdshoulddopraid) {
                debug("running frag map");
                selectedMap = RdAMPfragmappy;
                selectMap(RdAMPfragmappy);
                runMap();
                RlastMapWeWereIn = getCurrentMapObject();
                RdAMPprefragmappy = RdAMPfragmappy;
                RdAMPfragmappy = undefined;
            }
            if (!RdAMPfragcheck && game.global.mapsActive && RdAMPfragmappybought && RdAMPprefragmappy != undefined && Rdshoulddopraid) {
                if (RAMPfrag(true) == false) {
                    if (!game.global.repeatMap) {
                        repeatClicked();
                    }
                } else if (RAMPfrag(true) == true) {
                    if (game.global.repeatMap) {
                        repeatClicked();
                        mapsClicked();
                    }
                    if (game.global.preMapsActive && RdAMPfragmappybought && RdAMPprefragmappy != undefined && Rdshoulddopraid) {
                        RdAMPfragmappybought = false;
                    }
                    if (RdAMPprefragmappy != undefined) {
                        recycleMap(getMapIndex(RdAMPprefragmappy));
                        RdAMPprefragmappy = undefined;
                    }
                    RdAMPfragcheck = true;
                    RdAMPfragfarming = false;
                }
            }
        } else {
            RdAMPfragcheck = true;
            RdAMPfragfarming = false;
        }
    }
    if (RdAMPfragcheck && RdAMPpMap5 == undefined && !RdAMPmapbought5 && game.global.preMapsActive && Rdshoulddopraid && RAMPshouldrunmap(true, 0)) {
        debug("Check complete for 5th map");
        RAMPplusPres(true, 0);
        if ((updateMapCost(true) <= game.resources.fragments.owned)) {
            buyMap();
            RdAMPmapbought5 = true;
            if (RdAMPmapbought5) {
                RdAMPpMap5 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                debug("5th map bought");
            }
        }
    }
    if (RdAMPfragcheck && RdAMPpMap4 == undefined && !RdAMPmapbought4 && game.global.preMapsActive && Rdshoulddopraid && RAMPshouldrunmap(true, 1)) {
        debug("Check complete for 4th map");
        RAMPplusPres(true, 1);
        if ((updateMapCost(true) <= game.resources.fragments.owned)) {
            buyMap();
            RdAMPmapbought4 = true;
            if (RdAMPmapbought4) {
                RdAMPpMap4 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                debug("4th map bought");
            }
        }
    }
    if (RdAMPfragcheck && RdAMPpMap3 == undefined && !RdAMPmapbought3 && game.global.preMapsActive && Rdshoulddopraid && RAMPshouldrunmap(true, 2)) {
        debug("Check complete for 3rd map");
        RAMPplusPres(true, 2);
        if ((updateMapCost(true) <= game.resources.fragments.owned)) {
            buyMap();
            RdAMPmapbought3 = true;
            if (RdAMPmapbought3) {
                RdAMPpMap3 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                debug("3rd map bought");
            }
        }
    }
    if (RdAMPfragcheck && RdAMPpMap2 == undefined && !RdAMPmapbought2 && game.global.preMapsActive && Rdshoulddopraid && RAMPshouldrunmap(true, 3)) {
        debug("Check complete for 2nd map");
        RAMPplusPres(true, 3);
        if ((updateMapCost(true) <= game.resources.fragments.owned)) {
            buyMap();
            RdAMPmapbought2 = true;
            if (RdAMPmapbought2) {
                RdAMPpMap2 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                debug("2nd map bought");
            }
        }
    }
    if (RdAMPfragcheck && RdAMPpMap1 == undefined && !RdAMPmapbought1 && game.global.preMapsActive && Rdshoulddopraid && RAMPshouldrunmap(true, 4)) {
        debug("Check complete for 1st map");
        RAMPplusPres(true, 4);
        if ((updateMapCost(true) <= game.resources.fragments.owned)) {
            buyMap();
            RdAMPmapbought1 = true;
            if (RdAMPmapbought1) {
                RdAMPpMap1 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                debug("1st map bought");
            }
        }
    }
    if (RdAMPfragcheck && !RdAMPmapbought1 && !RdAMPmapbought2 && !RdAMPmapbought3 && !RdAMPmapbought4 && !RdAMPmapbought5) {
        RdAMPpMap1 = undefined;
        RdAMPpMap2 = undefined;
        RdAMPpMap3 = undefined;
        RdAMPpMap4 = undefined;
        RdAMPpMap5 = undefined;
        debug("Failed to Prestige Raid. Looks like you can't afford to or have no equips to get!");
        Rdshoulddopraid = false;
        autoTrimpSettings["RAutoMaps"].value = 0;
    }
    if (RdAMPfragcheck && game.global.preMapsActive && !game.global.mapsActive && RdAMPmapbought1 && RdAMPpMap1 != undefined && Rdshoulddopraid) {
        debug("running map 1");
        selectedMap = RdAMPpMap1;
        selectMap(RdAMPpMap1);
        runMap();
        RlastMapWeWereIn = getCurrentMapObject();
        RdAMPrepMap1 = RdAMPpMap1;
        RdAMPpMap1 = undefined;
    }
    if (RdAMPfragcheck && game.global.preMapsActive && !game.global.mapsActive && RdAMPmapbought2 && RdAMPpMap2 != undefined && Rdshoulddopraid) {
        debug("running map 2");
        selectedMap = RdAMPpMap2;
        selectMap(RdAMPpMap2);
        runMap();
        RlastMapWeWereIn = getCurrentMapObject();
        RdAMPrepMap2 = RdAMPpMap2;
        RdAMPpMap2 = undefined;
    }
    if (RdAMPfragcheck && game.global.preMapsActive && !game.global.mapsActive && RdAMPmapbought3 && RdAMPpMap3 != undefined && Rdshoulddopraid) {
        debug("running map 3");
        selectedMap = RdAMPpMap3;
        selectMap(RdAMPpMap3);
        runMap();
        RlastMapWeWereIn = getCurrentMapObject();
        RdAMPrepMap3 = RdAMPpMap3;
        RdAMPpMap3 = undefined;
    }
    if (RdAMPfragcheck && game.global.preMapsActive && !game.global.mapsActive && RdAMPmapbought4 && RdAMPpMap4 != undefined && Rdshoulddopraid) {
        debug("running map 4");
        selectedMap = RdAMPpMap4;
        selectMap(RdAMPpMap4);
        runMap();
        RlastMapWeWereIn = getCurrentMapObject();
        RdAMPrepMap4 = RdAMPpMap4;
        RdAMPpMap4 = undefined;
    }
    if (RdAMPfragcheck && game.global.preMapsActive && !game.global.mapsActive && RdAMPmapbought5 && RdAMPpMap5 != undefined && Rdshoulddopraid) {
        debug("running map 5");
        selectedMap = RdAMPpMap5;
        selectMap(RdAMPpMap5);
        runMap();
        RlastMapWeWereIn = getCurrentMapObject();
        RdAMPrepMap5 = RdAMPpMap5;
        RdAMPpMap5 = undefined;
    }
}

//Mayhem

