// TRUE TS (Phase 1 · #30) / PHASE 3 split (#51): byte-faithful move of the U1 Prestige/BW-Raid
// state machine out of other.ts. Function bodies are IDENTICAL to their pre-move form — NO refactor
// here (that is a later per-module pass). Names stay global via legacy-bridge's wildcard spread;
// legacy AutoTrimps2.js calls Praiding/PraidHarder/BWraiding/dailyPraiding by bare name. The raid-map
// globals (pMap*/repMap*/mapbought*/dpMap*/…) publish to globalThis (read cross-module).
import { getPageSetting, debug, byId } from './utils'

globalThis.praidSetting = undefined;

export function isBelowThreshold(a: any) {
    return a != game.global.world
}

// #175/#228/#247 — every `advPerfectCheckbox.checked = …` write in this file has been REMOVED, not
// repaired. `advPerfectCheckbox` is a <span class="niceCheckbox" data-checked> (index.html:897), so
// `.checked` was an inert expando the game never read; the state it reads is `dataset.checked`, via
// readNiceCheckbox (updates.js:1958). But repairing these particular writes would be worse than
// leaving them: every plusPres* design pins `lootAdvMapsRange = "0"`, so the slider sum can never be
// 27 and `checkMaxSliders` (main.js:6549) forces Perfect off no matter what the checkbox says — the
// write is DOUBLY dead. Routing it through `swapNiceCheckbox` would therefore change nothing about
// the map being priced here while leaking a data-checked write into every map designed later in the
// same Map-Chamber session. The two writes that are genuinely live (the 9/9/9 fragment-farm map in
// PraidHarder) are repaired; these are deleted. `tests/nets/nice-checkbox-writes.test.ts` pins that
// no `.checked` write to a niceCheckbox element can come back, under either disposition.
export function plusPres() {
    byId("biomeAdvMapsSelect").value = "Random";
    byId("advExtraLevelSelect").value = String(plusMapToRun(game.global.world));
    byId("advSpecialSelect").value = "p";
    byId("lootAdvMapsRange").value = "0";
    byId("difficultyAdvMapsRange").value = "9";
    byId("sizeAdvMapsRange").value = "9";
    byId("mapLevelInput").value = String(game.global.world);
    updateMapCost();
}

export function plusMapToRun(a: any) {
    return 9 == a % 10 ? 6 : 5 > a % 10 ? 5 - a % 10 : 11 - a % 10
}

export function findLastBionic() {
    for (var a = game.global.mapsOwnedArray.length - 1; 0 <= a; a--)
        if ("Bionic" === game.global.mapsOwnedArray[a].location) return game.global.mapsOwnedArray[a]
}

export function plusMapToRun1() {
    var map = 1;
    if (game.global.world % 10 == 5)
        map = 6;
    if (game.global.world % 10 == 6)
        map = 5;
    if (game.global.world % 10 == 7)
        map = 4;
    if (game.global.world % 10 == 8)
        map = 3;
    if (game.global.world % 10 == 9)
        map = 2;
    return map;
}

export function plusMapToRun2() {
    var map = 2;
    if (game.global.world % 10 == 4)
        map = 7;
    if (game.global.world % 10 == 5)
        map = 7;
    if (game.global.world % 10 == 6)
        map = 6;
    if (game.global.world % 10 == 7)
        map = 5;
    if (game.global.world % 10 == 8)
        map = 4;
    if (game.global.world % 10 == 9)
        map = 3;
    return map;
}

export function plusMapToRun3() {
    var map = 3;
    if (game.global.world % 10 == 3)
        map = 8;
    if (game.global.world % 10 == 4)
        map = 8;
    if (game.global.world % 10 == 5)
        map = 8;
    if (game.global.world % 10 == 6)
        map = 7;
    if (game.global.world % 10 == 7)
        map = 6;
    if (game.global.world % 10 == 8)
        map = 5;
    if (game.global.world % 10 == 9)
        map = 4;
    return map;
}

export function plusMapToRun4() {
    var map = 4;
    if (game.global.world % 10 == 2)
        map = 9;
    if (game.global.world % 10 == 3)
        map = 9;
    if (game.global.world % 10 == 4)
        map = 9;
    if (game.global.world % 10 == 5)
        map = 9;
    if (game.global.world % 10 == 6)
        map = 8;
    if (game.global.world % 10 == 7)
        map = 7;
    if (game.global.world % 10 == 8)
        map = 6;
    if (game.global.world % 10 == 9)
        map = 5;
    return map;
}

export function plusMapToRun5() {
    var map = 5;
    if (game.global.world % 10 == 1)
        map = 10;
    if (game.global.world % 10 == 2)
        map = 10;
    if (game.global.world % 10 == 3)
        map = 10;
    if (game.global.world % 10 == 4)
        map = 10;
    if (game.global.world % 10 == 5)
        map = 10;
    if (game.global.world % 10 == 6)
        map = 9;
    if (game.global.world % 10 == 7)
        map = 8;
    if (game.global.world % 10 == 8)
        map = 7;
    if (game.global.world % 10 == 9)
        map = 6;
    return map;
}

export function plusPres1() {
    byId("biomeAdvMapsSelect").value = "Depths";
    byId("advExtraLevelSelect").value = String(plusMapToRun1());
    byId("advSpecialSelect").value = "p";
    byId("lootAdvMapsRange").value = "0";
    byId("difficultyAdvMapsRange").value = "9";
    byId("sizeAdvMapsRange").value = "9";
    byId("mapLevelInput").value = String(game.global.world);
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

export function plusPres2() {
    byId("biomeAdvMapsSelect").value = "Depths";
    byId("advExtraLevelSelect").value = String(plusMapToRun2());
    byId("advSpecialSelect").value = "p";
    byId("lootAdvMapsRange").value = "0";
    byId("difficultyAdvMapsRange").value = "9";
    byId("sizeAdvMapsRange").value = "9";
    byId("mapLevelInput").value = String(game.global.world);
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

export function plusPres3() {
    byId("biomeAdvMapsSelect").value = "Depths";
    byId("advExtraLevelSelect").value = String(plusMapToRun3());
    byId("advSpecialSelect").value = "p";
    byId("lootAdvMapsRange").value = "0";
    byId("difficultyAdvMapsRange").value = "9";
    byId("sizeAdvMapsRange").value = "9";
    byId("mapLevelInput").value = String(game.global.world);
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

export function plusPres4() {
    byId("biomeAdvMapsSelect").value = "Depths";
    byId("advExtraLevelSelect").value = String(plusMapToRun4());
    byId("advSpecialSelect").value = "p";
    byId("lootAdvMapsRange").value = "0";
    byId("difficultyAdvMapsRange").value = "9";
    byId("sizeAdvMapsRange").value = "9";
    byId("mapLevelInput").value = String(game.global.world);
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

export function plusPres5() {
    byId("biomeAdvMapsSelect").value = "Depths";
    byId("advExtraLevelSelect").value = String(plusMapToRun5());
    byId("advSpecialSelect").value = "p";
    byId("lootAdvMapsRange").value = "0";
    byId("difficultyAdvMapsRange").value = "9";
    byId("sizeAdvMapsRange").value = "9";
    byId("mapLevelInput").value = String(game.global.world);
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

export function pcheck1() {

    var HD;
    var P;
    var I;

    if (game.global.challengeActive != "Daily") {
        HD = getPageSetting('PraidingHD');
        P = (getPageSetting('PraidingP') > 0 ? getPageSetting('PraidingP') : 0);
        I = (getPageSetting('PraidingI') > 0 ? getPageSetting('PraidingI') : 0);
    }
    if (game.global.challengeActive == "Daily") {
        HD = getPageSetting('dPraidingHD');
        P = (getPageSetting('dPraidingP') > 0 ? getPageSetting('dPraidingP') : 0);
        I = (getPageSetting('dPraidingI') > 0 ? getPageSetting('dPraidingI') : 0);
    }

    var go = false;

    if (HD <= 0) {
        go = true;
    } else if (HD > 0) {
        go = (HD >= calcHDratio(game.global.world + plusMapToRun1()));
    }
    if (P > 0 && getEmpowerment() == "Poison") {
        go = (P >= plusMapToRun1());
    }
    if (I > 0 && getEmpowerment() == "Ice") {
        go = (I >= plusMapToRun1());
    }
    return go;
}

export function pcheck2() {

    var HD;
    var P;
    var I;

    if (game.global.challengeActive != "Daily") {
        HD = getPageSetting('PraidingHD');
        P = (getPageSetting('PraidingP') > 0 ? getPageSetting('PraidingP') : 0);
        I = (getPageSetting('PraidingI') > 0 ? getPageSetting('PraidingI') : 0);
    }
    if (game.global.challengeActive == "Daily") {
        HD = getPageSetting('dPraidingHD');
        P = (getPageSetting('dPraidingP') > 0 ? getPageSetting('dPraidingP') : 0);
        I = (getPageSetting('dPraidingI') > 0 ? getPageSetting('dPraidingI') : 0);
    }

    var go = false;

    if (HD <= 0) {
        go = true;
    } else if (HD > 0) {
        go = (HD >= calcHDratio(game.global.world + plusMapToRun2()));
    }
    if (P > 0 && getEmpowerment() == "Poison") {
        go = (P >= plusMapToRun2());
    }
    if (I > 0 && getEmpowerment() == "Ice") {
        go = (I >= plusMapToRun2());
    }
    return go;
}

export function pcheck3() {

    var HD;
    var P;
    var I;

    if (game.global.challengeActive != "Daily") {
        HD = getPageSetting('PraidingHD');
        P = (getPageSetting('PraidingP') > 0 ? getPageSetting('PraidingP') : 0);
        I = (getPageSetting('PraidingI') > 0 ? getPageSetting('PraidingI') : 0);
    }
    if (game.global.challengeActive == "Daily") {
        HD = getPageSetting('dPraidingHD');
        P = (getPageSetting('dPraidingP') > 0 ? getPageSetting('dPraidingP') : 0);
        I = (getPageSetting('dPraidingI') > 0 ? getPageSetting('dPraidingI') : 0);
    }

    var go = false;

    if (HD <= 0) {
        go = true;
    } else if (HD > 0) {
        go = (HD >= calcHDratio(game.global.world + plusMapToRun3()));
    }
    if (P > 0 && getEmpowerment() == "Poison") {
        go = (P >= plusMapToRun3());
    }
    if (I > 0 && getEmpowerment() == "Ice") {
        go = (I >= plusMapToRun3());
    }
    return go;
}

export function pcheck4() {

    var HD;
    var P;
    var I;

    if (game.global.challengeActive != "Daily") {
        HD = getPageSetting('PraidingHD');
        P = (getPageSetting('PraidingP') > 0 ? getPageSetting('PraidingP') : 0);
        I = (getPageSetting('PraidingI') > 0 ? getPageSetting('PraidingI') : 0);
    }
    if (game.global.challengeActive == "Daily") {
        HD = getPageSetting('dPraidingHD');
        P = (getPageSetting('dPraidingP') > 0 ? getPageSetting('dPraidingP') : 0);
        I = (getPageSetting('dPraidingI') > 0 ? getPageSetting('dPraidingI') : 0);
    }

    var go = false;

    if (HD <= 0) {
        go = true;
    } else if (HD > 0) {
        go = (HD >= calcHDratio(game.global.world + plusMapToRun4()));
    }
    if (P > 0 && getEmpowerment() == "Poison") {
        go = (P >= plusMapToRun4());
    }
    if (I > 0 && getEmpowerment() == "Ice") {
        go = (I >= plusMapToRun4());
    }
    return go;
}

export function pcheck5() {

    var HD;
    var P;
    var I;

    if (game.global.challengeActive != "Daily") {
        HD = getPageSetting('PraidingHD');
        P = (getPageSetting('PraidingP') > 0 ? getPageSetting('PraidingP') : 0);
        I = (getPageSetting('PraidingI') > 0 ? getPageSetting('PraidingI') : 0);
    }
    if (game.global.challengeActive == "Daily") {
        HD = getPageSetting('dPraidingHD');
        P = (getPageSetting('dPraidingP') > 0 ? getPageSetting('dPraidingP') : 0);
        I = (getPageSetting('dPraidingI') > 0 ? getPageSetting('dPraidingI') : 0);
    }

    var go = false;

    if (HD <= 0) {
        go = true;
    } else if (HD > 0) {
        go = (HD >= calcHDratio(game.global.world + plusMapToRun5()));
    }
    if (P > 0 && getEmpowerment() == "Poison") {
        go = (P >= plusMapToRun5());
    }
    if (I > 0 && getEmpowerment() == "Ice") {
        go = (I >= plusMapToRun5());
    }
    return go;
}

export function pcheckmap1() {
    var go = false;
    if (game.global.world % 10 == 0 && plusMapToRun1() == 1) {
        go = true;
    }
    if (game.global.world % 10 == 1 && (plusMapToRun1() == 1 || plusMapToRun1() == 10)) {
        go = true;
    }
    if (game.global.world % 10 == 2 && (plusMapToRun1() == 1 || plusMapToRun1() >= 9)) {
        go = true;
    }
    if (game.global.world % 10 == 3 && (plusMapToRun1() == 1 || plusMapToRun1() >= 8)) {
        go = true;
    }
    if (game.global.world % 10 == 4 && (plusMapToRun1() == 1 || plusMapToRun1() >= 7)) {
        go = true;
    }
    if (game.global.world % 10 == 5 && plusMapToRun1() >= 6) {
        go = true;
    }
    if (game.global.world % 10 == 6 && plusMapToRun1() >= 5) {
        go = true;
    }
    if (game.global.world % 10 == 7 && plusMapToRun1() >= 4) {
        go = true;
    }
    if (game.global.world % 10 == 8 && plusMapToRun1() >= 3) {
        go = true;
    }
    if (game.global.world % 10 == 9 && plusMapToRun1() >= 2) {
        go = true;
    }
    return go;
}

export function pcheckmap2() {
    var go = false;
    if (game.global.world % 10 == 0 && plusMapToRun2() == 2) {
        go = true;
    }
    if (game.global.world % 10 == 1 && (plusMapToRun2() == 2 || plusMapToRun2() == 10)) {
        go = true;
    }
    if (game.global.world % 10 == 2 && (plusMapToRun2() == 2 || plusMapToRun2() >= 9)) {
        go = true;
    }
    if (game.global.world % 10 == 3 && (plusMapToRun2() == 2 || plusMapToRun2() >= 8)) {
        go = true;
    }
    if (game.global.world % 10 == 4 && plusMapToRun2() >= 7) {
        go = true;
    }
    if (game.global.world % 10 == 5 && plusMapToRun2() >= 6) {
        go = true;
    }
    if (game.global.world % 10 == 6 && plusMapToRun2() >= 6) {
        go = true;
    }
    if (game.global.world % 10 == 7 && plusMapToRun2() >= 5) {
        go = true;
    }
    if (game.global.world % 10 == 8 && plusMapToRun2() >= 4) {
        go = true;
    }
    if (game.global.world % 10 == 9 && plusMapToRun2() >= 3) {
        go = true;
    }
    return go;
}

export function pcheckmap3() {
    var go = false;
    if (game.global.world % 10 == 0 && plusMapToRun3() == 3) {
        go = true;
    }
    if (game.global.world % 10 == 1 && (plusMapToRun3() == 3 || plusMapToRun3() == 10)) {
        go = true;
    }
    if (game.global.world % 10 == 2 && (plusMapToRun3() == 3 || plusMapToRun3() >= 9)) {
        go = true;
    }
    if (game.global.world % 10 == 3 && plusMapToRun3() >= 8) {
        go = true;
    }
    if (game.global.world % 10 == 4 && plusMapToRun3() >= 8) {
        go = true;
    }
    if (game.global.world % 10 == 5 && plusMapToRun3() >= 8) {
        go = true;
    }
    if (game.global.world % 10 == 6 && plusMapToRun3() >= 7) {
        go = true;
    }
    if (game.global.world % 10 == 7 && plusMapToRun3() >= 6) {
        go = true;
    }
    if (game.global.world % 10 == 8 && plusMapToRun3() >= 5) {
        go = true;
    }
    if (game.global.world % 10 == 9 && plusMapToRun3() >= 4) {
        go = true;
    }
    return go;
}

export function pcheckmap4() {
    var go = false;
    if (game.global.world % 10 == 0 && plusMapToRun4() == 4) {
        go = true;
    }
    if (game.global.world % 10 == 1 && (plusMapToRun4() == 4 || plusMapToRun4() == 10)) {
        go = true;
    }
    if (game.global.world % 10 == 2 && plusMapToRun4() >= 9) {
        go = true;
    }
    if (game.global.world % 10 == 3 && plusMapToRun4() >= 8) {
        go = true;
    }
    if (game.global.world % 10 == 4 && plusMapToRun4() >= 7) {
        go = true;
    }
    if (game.global.world % 10 == 5 && plusMapToRun4() >= 6) {
        go = true;
    }
    if (game.global.world % 10 == 6 && plusMapToRun4() >= 5) {
        go = true;
    }
    if (game.global.world % 10 == 7 && plusMapToRun4() >= 4) {
        go = true;
    }
    if (game.global.world % 10 == 8 && plusMapToRun4() >= 3) {
        go = true;
    }
    if (game.global.world % 10 == 9 && plusMapToRun4() >= 2) {
        go = true;
    }
    return go;
}

export function pcheckmap5() {
    var go = false;
    if (game.global.world % 10 == 0 && plusMapToRun5() == 5) {
        go = true;
    }
    if (game.global.world % 10 == 1 && (plusMapToRun5() == 4 || plusMapToRun5() == 10)) {
        go = true;
    }
    if (game.global.world % 10 == 2 && (plusMapToRun5() == 3 || plusMapToRun5() >= 9)) {
        go = true;
    }
    if (game.global.world % 10 == 3 && (plusMapToRun5() == 2 || plusMapToRun5() >= 8)) {
        go = true;
    }
    if (game.global.world % 10 == 4 && (plusMapToRun5() == 1 || plusMapToRun5() >= 7)) {
        go = true;
    }
    if (game.global.world % 10 == 5 && plusMapToRun5() >= 6) {
        go = true;
    }
    if (game.global.world % 10 == 6 && plusMapToRun5() >= 5) {
        go = true;
    }
    if (game.global.world % 10 == 7 && plusMapToRun5() >= 4) {
        go = true;
    }
    if (game.global.world % 10 == 8 && plusMapToRun5() >= 3) {
        go = true;
    }
    if (game.global.world % 10 == 9 && plusMapToRun5() >= 2) {
        go = true;
    }
    return go;
}

globalThis.pMap1 = undefined;
globalThis.pMap2 = undefined;
globalThis.pMap3 = undefined;
globalThis.pMap4 = undefined;
globalThis.pMap5 = undefined;
globalThis.repMap1 = undefined;
globalThis.repMap2 = undefined;
globalThis.repMap3 = undefined;
globalThis.repMap4 = undefined;
globalThis.repMap5 = undefined;
globalThis.mapbought1 = false;
globalThis.mapbought2 = false;
globalThis.mapbought3 = false;
globalThis.mapbought4 = false;
globalThis.mapbought5 = false;

export function Praiding() {
    var cell;
    cell = ((getPageSetting('Praidingcell') > 0) ? getPageSetting('Praidingcell') : 0);
    if (getPageSetting('Praidingzone').length) {
        if (getPageSetting('Praidingzone').includes(game.global.world) && ((cell <= 1) || (cell > 1 && (game.global.lastClearedCell + 1) >= cell)) && !prestraid && !failpraid) {
            prestraidon = true;
            if (getPageSetting('AutoMaps') == 1 && !prestraid && !failpraid) {
                autoTrimpSettings["AutoMaps"].value = 0;
            }
            if (!game.global.preMapsActive && !game.global.mapsActive && !prestraid) {
                mapsClicked();
                if (!game.global.preMapsActive) {
                    mapsClicked();
                }
                debug("Beginning Prestige Raiding...");
            }
            if (game.options.menu.repeatUntil.enabled != 2 && !prestraid) {
                game.options.menu.repeatUntil.enabled = 2;
            }
            if (game.global.preMapsActive && !game.global.mapsActive && !prestraid) {
                debug("Map Loop");
                if (pcheckmap5() == true && pcheck5() == true && pMap5 == undefined && !mapbought5 && game.global.preMapsActive && !prestraid) {
                    debug("Check complete for 5th map");
                    plusPres5();
                    if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                        mapbought5 = buyMap() === 1;
                        if (mapbought5) {
                            pMap5 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                            debug("5th map bought");
                        }
                    }
                }
                if (pcheckmap4() == true && pcheck4() == true && pMap4 == undefined && !mapbought4 && game.global.preMapsActive && !prestraid) {
                    debug("Check complete for 4th map");
                    plusPres4();
                    if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                        mapbought4 = buyMap() === 1;
                        if (mapbought4) {
                            pMap4 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                            debug("4th map bought");
                        }
                    }
                }
                if (pcheckmap3() == true && pcheck3() == true && pMap3 == undefined && !mapbought3 && game.global.preMapsActive && !prestraid) {
                    debug("Check complete for 3rd map");
                    plusPres3();
                    if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                        mapbought3 = buyMap() === 1;
                        if (mapbought3) {
                            pMap3 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                            debug("3rd map bought");
                        }
                    }
                }
                if (pcheckmap2() == true && pcheck2() == true && pMap2 == undefined && !mapbought2 && game.global.preMapsActive && !prestraid) {
                    debug("Check complete for 2nd map");
                    plusPres2();
                    if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                        mapbought2 = buyMap() === 1;
                        if (mapbought2) {
                            pMap2 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                            debug("2nd map bought");
                        }
                    }
                }
                if (pcheckmap1() == true && pcheck1() == true && pMap1 == undefined && !mapbought1 && game.global.preMapsActive && !prestraid) {
                    debug("Check complete for 1st map");
                    plusPres1();
                    if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                        mapbought1 = buyMap() === 1;
                        if (mapbought1) {
                            pMap1 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                            debug("1st map bought");
                        }
                    }
                }
                if (!mapbought1 && !mapbought2 && !mapbought3 && !mapbought4 && !mapbought5) {
                    if (getPageSetting('AutoMaps') == 0 && !prestraid) {
                        autoTrimpSettings["AutoMaps"].value = 1;
                        game.options.menu.repeatUntil.enabled = 0;
                        prestraidon = false;
                        failpraid = true;
                        praidDone = true;
                        pMap1 = undefined;
                        pMap2 = undefined;
                        pMap3 = undefined;
                        pMap4 = undefined;
                        pMap5 = undefined;
                        debug("Failed to Prestige Raid. Looks like you can't afford to or you are too weak or you have limited yourself in a P/I zone. ");
                    }
                    return;
                }
            }
            if (game.global.preMapsActive && !game.global.mapsActive && mapbought1 && pMap1 != undefined && !prestraid) {
                debug("running map 1");
                selectMap(pMap1);
                runMap();
                repMap1 = pMap1;
                pMap1 = undefined;
            }
            if (game.global.preMapsActive && !game.global.mapsActive && mapbought2 && pMap2 != undefined && !prestraid) {
                debug("running map 2");
                selectMap(pMap2);
                runMap();
                repMap2 = pMap2;
                pMap2 = undefined;
            }
            if (game.global.preMapsActive && !game.global.mapsActive && mapbought3 && pMap3 != undefined && !prestraid) {
                debug("running map 3");
                selectMap(pMap3);
                runMap();
                repMap3 = pMap3;
                pMap3 = undefined;
            }
            if (game.global.preMapsActive && !game.global.mapsActive && mapbought4 && pMap4 != undefined && !prestraid) {
                debug("running map 4");
                selectMap(pMap4);
                runMap();
                repMap4 = pMap4;
                pMap4 = undefined;
            }
            if (game.global.preMapsActive && !game.global.mapsActive && mapbought5 && pMap5 != undefined && !prestraid) {
                debug("running map 5");
                selectMap(pMap5);
                runMap();
                repMap5 = pMap5;
                pMap5 = undefined;
            }
            if (!prestraid && !game.global.repeatMap) {
                repeatClicked();
            }
        }
    }
    if (game.global.preMapsActive && (mapbought1 || mapbought2 || mapbought3 || mapbought4 || mapbought5) && pMap1 == undefined && pMap2 == undefined && pMap3 == undefined && pMap4 == undefined && pMap5 == undefined && !prestraid && !failpraid) {
        prestraid = true;
        failpraid = false;
        mapbought1 = false;
        mapbought2 = false;
        mapbought3 = false;
        mapbought4 = false;
        mapbought5 = false;
    }
    if (getPageSetting('AutoMaps') == 0 && game.global.preMapsActive && prestraid && !failpraid && prestraidon) {
        praidDone = true;
        prestraidon = false;
        if (repMap1 != undefined) {
            recycleMap(getMapIndex(repMap1));
            repMap1 = undefined;
        }
        if (repMap2 != undefined) {
            recycleMap(getMapIndex(repMap2));
            repMap2 = undefined;
        }
        if (repMap3 != undefined) {
            recycleMap(getMapIndex(repMap3));
            repMap3 = undefined;
        }
        if (repMap4 != undefined) {
            recycleMap(getMapIndex(repMap4));
            repMap4 = undefined;
        }
        if (repMap5 != undefined) {
            recycleMap(getMapIndex(repMap5));
            repMap5 = undefined;
        }
        autoTrimpSettings["AutoMaps"].value = 1;
        game.options.menu.repeatUntil.enabled = 0;
        pMap1 = undefined;
        pMap2 = undefined;
        pMap3 = undefined;
        pMap4 = undefined;
        pMap5 = undefined;
        debug("Prestige raiding successful!");
        debug("Turning AutoMaps back on");
    }
    if (getPageSetting('Praidingzone').every(isBelowThreshold)) {
        prestraid = false;
        failpraid = false;
        prestraidon = false;
        mapbought1 = false;
        mapbought2 = false;
        mapbought3 = false;
        mapbought4 = false;
        mapbought5 = false;
        pMap1 = undefined;
        pMap2 = undefined;
        pMap3 = undefined;
        pMap4 = undefined;
        pMap5 = undefined;
        repMap1 = undefined;
        repMap2 = undefined;
        repMap3 = undefined;
        repMap4 = undefined;
        repMap5 = undefined;
        praidDone = false;
    }
}

export function PraidHarder() {
    var maxPlusZones;
    var mapModifiers = ["p", "fa", "0"];
    var farmFragments;
    var praidBeforeFarm;
    var pRaidIndex;
    var maxPraidZSetting;
    var cell;

    // Determine whether to use daily or normal run settings
    if (game.global.challengeActive == "Daily") {
        praidSetting = 'dPraidingzone';
        maxPraidZSetting = 'dMaxPraidZone';
        farmFragments = getPageSetting('dPraidFarmFragsZ').includes(game.global.world);
        praidBeforeFarm = getPageSetting('dPraidBeforeFarmZ').includes(game.global.world);
        cell = ((getPageSetting('dPraidingcell') > 0) ? getPageSetting('dPraidingcell') : 0);
    } else {
        praidSetting = 'Praidingzone';
        maxPraidZSetting = 'MaxPraidZone';
        farmFragments = getPageSetting('PraidFarmFragsZ').includes(game.global.world);
        praidBeforeFarm = getPageSetting('PraidBeforeFarmZ').includes(game.global.world);
        cell = ((getPageSetting('Praidingcell') > 0) ? getPageSetting('Praidingcell') : 0);
    }

    pRaidIndex = getPageSetting(praidSetting).indexOf(game.global.world);
    if (pRaidIndex == -1 || typeof(getPageSetting(maxPraidZSetting)[pRaidIndex]) === "undefined") maxPlusZones = plusMapToRun(game.global.world);
    else maxPlusZones = getPageSetting(maxPraidZSetting)[pRaidIndex] - game.global.world;

    // Check we have a valid number for maxPlusZones
    maxPlusZones = maxPlusZones > 10 ? 10 : (maxPlusZones < 0 ? 10 : maxPlusZones);

    // Work out the max number of +map zones it's worth farming for prestige.
    if ((game.global.world + maxPlusZones) % 10 > 5)
        maxPlusZones = Math.max(maxPlusZones + (5 - (game.global.world + maxPlusZones) % 10), 0);
    else if ((game.global.world + maxPlusZones) % 10 == 0)
        maxPlusZones = Math.min(5, maxPlusZones);

    // If we have any Praiding zones defined...
    if (getPageSetting(praidSetting).length) {
        if (getPageSetting(praidSetting).includes(game.global.world) && ((game.global.lastClearedCell + 1) >= cell) && !prestraid && !failpraid && !shouldFarmFrags) {
            debug('Beginning Praiding');
            // Initialise shouldFarmFrags to false
            shouldFarmFrags = false;
            // Mark that we are prestige raiding and turn off automaps to stop it interfering
            prestraidon = true;
            autoTrimpSettings["AutoMaps"].value = 0;
            // Get into the preMaps screen
            if (!game.global.preMapsActive && !game.global.mapsActive) {
                mapsClicked();
                if (!game.global.preMapsActive) {
                    mapsClicked();
                }
            }
            // Set repeat for items
            game.options.menu.repeatUntil.enabled = 2;
            toggleSetting("repeatUntil", null, false, true);
            // if we can farm for fragments, work out the minimum number we need to get all available prestiges
            if (farmFragments) {
                plusPres();
                byId('advExtraLevelSelect').value = String(maxPlusZones);
                byId('sizeAdvMapsRange').value = "0";
                byId('difficultyAdvMapsRange').value = "0";
                byId('advSpecialSelect').value = "0";
                minMaxMapCost = updateMapCost(true);
                // If we are not Praiding before farming, and cannot afford a max plus map, set flags for farming
                if (!praidBeforeFarm && game.resources.fragments.owned < minMaxMapCost) {
                    prestraid = true;
                    failpraid = false;
                    shouldFarmFrags = true;
                }
            }
            // Set map settings to the best map for Praiding (even if we can't afford it)
            plusPres();
            byId('advExtraLevelSelect').value = String(maxPlusZones);
            // Iterate down through plusMaps setting until we find one we can afford
            for (var curPlusZones = maxPlusZones; curPlusZones >= 0; curPlusZones--) {
                // If the current targeted zone has no prestiges, decrement the number of plusZones and continue
                if ((game.global.world + curPlusZones) % 10 == 0 || (game.global.world + curPlusZones) % 10 > 5) continue;
                // Otherwise check to see if we can afford a map at the current plusZones setting
                byId('advExtraLevelSelect').value = String(curPlusZones);
                // If we find a map we can afford, break out of the loop
                if (relaxMapReqs(mapModifiers)) break;
                // conserve fragments if going to farm after by selecting only maps with no special modifier
                else if (farmFragments) mapModifiers = ["0"];
            }
            // If the map is not at the highest level with prestiges possible, set shouldFarmFrags to true
            if (maxPlusZones > curPlusZones) shouldFarmFrags = true;

            // #166 — the old guard here was `praidBeforeFarm || shouldFarmFrags == false`, and it
            // confused "we would like a better map" with "we are allowed to go and get one".
            // `shouldFarmFrags` is set two lines up whenever the map we found is below the TARGET, and
            // at the shipped defaults the target is 10 extra zones: `MaxPraidZone` defaults to `[-1]`,
            // so :1220 computes a negative and :1223 rescues it to 10. A +10 map costs 1.14^100 ≈
            // 4.9e5 times a +0 one (main.js:6532/6541), so `curPlusZones < maxPlusZones` essentially
            // always — and with `PraidFarmFragsZ` also `[-1]`, farming was never permitted either.
            // Net effect at defaults: relaxMapReqs() locates an affordable map, AT declines to buy it,
            // and prints "you can't afford to" — a statement it had just disproved. PraidHarder bought
            // nothing at any praid zone out of the box.
            //
            // What the master setting's own tooltip promises: "Always buys the highest-prestige map it
            // can afford at each P Raiding zone, farming fragments for it if it can't". So only skip
            // the buy when farming is actually going to happen for this zone.
            var willFarmFrags = farmFragments && shouldFarmFrags && !praidBeforeFarm;
            var praidMapFound = curPlusZones >= 0 && !willFarmFrags;
            // #177 — `buyMap()` refuses with -2 at the game's own 100-map cap WITHOUT creating a map or
            // spending fragments (main.js:6597), and the affordability check above passes exactly then;
            // `createMap` is what pushes to `mapsOwnedArray` (main.js:6025), so on a refusal
            // `[length - 1]` is a map the player already owned. Short-circuit `&&` keeps the buy inside
            // the arm that was taken.
            var praidMapBought = praidMapFound && buyMap() === 1;
            if (praidMapBought) {
                pMap = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                selectMap(pMap);
                // Set flags to avoid rerunning this step
                prestraid = true;
                // prestraidon = false;
                failpraid = false;
                // Set repeat on and run the map
                game.global.repeatMap = true;
                runMap();
                repeatClicked(true);
            }
            // We located an affordable map and the game still refused to sell it. Distinct from the
            // arm below, whose message would now be a lie: relaxMapReqs() proved we could afford one.
            else if (praidMapFound) {
                failpraid = true;
                prestraidon = false;
                praidDone = true;
                debug("Failed to prestige raid. The game refused the map purchase - you may be at its 100 map cap.");
            }
            // If we can't afford a map, and can't farm fragments, fail and turn automaps back on
            else if (!farmFragments) {
                failpraid = true;
                prestraidon = false;
                praidDone = true;
                debug("Failed to prestige raid. Looks like you can't afford to.");
            } else {
                debug("Turning AutoMaps back on");
                autoTrimpSettings['AutoMaps'].value = 1;
                game.options.menu.repeatUntil.enabled = 0;
            }
            return;
        }
    }
    if (farmFragments && shouldFarmFrags && game.global.preMapsActive && prestraid && !fMap) {
        if (pMap) recycleMap(getMapIndex(pMap));
        pMap = null;
        // Choose a fragment farming map
        byId("biomeAdvMapsSelect").value = "Depths";
        byId('advExtraLevelSelect').value = "0";
        byId('advSpecialSelect').value = "fa";
        byId("lootAdvMapsRange").value = "9";
        byId("difficultyAdvMapsRange").value = "9";
        byId("sizeAdvMapsRange").value = "9";
        // #175 — LIVE here (unlike plusPres*): the sliders above are 9/9/9, so checkMaxSliders()==27
        // and the game really does consult the checkbox. Drive `data-checked` through the game's own
        // setter; `.checked` on a <span> is an expando nothing reads, which made the imperfect
        // fallback below cost-identical and this map's `fa` loot roll random instead of max.
        swapNiceCheckbox(byId('advPerfectCheckbox'), true);
        byId("mapLevelInput").value = String(game.global.world - 1);
        game.options.menu.repeatUntil.enabled = 0;
        toggleSetting("repeatUntil", null, false, true);
        if (updateMapCost(true) <= game.resources.fragments.owned) {
            debug("Buying perfect sliders fragment farming map");
            // #177 — see the note on the praid buy above: a refused buyMap() would otherwise adopt a
            // pre-existing map's id here, which AT then runs, recycles, and reports as a success.
            if (buyMap() === 1) {
                fMap = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                selectMap(fMap);
                game.global.repeatMap = true;
                runMap();
                repeatClicked(true);
            } else debug("Could not buy the fragment farming map - you may be at the game's 100 map cap.");
        } else {
            swapNiceCheckbox(byId('advPerfectCheckbox'), false);
            if (updateMapCost(true) <= game.resources.fragments.owned) {
                debug("Buying imperfect sliders fragment farming map");
                if (buyMap() === 1) {
                    fMap = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                    selectMap(fMap);
                    game.global.repeatMap = true;
                    runMap();
                    repeatClicked(true);
                } else debug("Could not buy the fragment farming map - you may be at the game's 100 map cap.");
            }
            // if we can't buy a map, wait until the next main loop iteration and try again
            else debug("Can't afford fragment farming map yet");
        }
    }

    if ((game.global.mapsActive || game.global.preMapsActive) && minMaxMapCost <= game.resources.fragments.owned && shouldFarmFrags) {
        game.global.repeatMap = false;
        repeatClicked(true);
        if (game.global.preMapsActive) {
            minMaxMapCost = null;
            shouldFarmFrags = false;
            prestraid = false;
            failpraid = false;
        }
    }
    if (game.global.preMapsActive && prestraid && !failpraid && !shouldFarmFrags && prestraidon) {
        prestraidon = false;
        praidDone = true;
        debug("Prestige raiding successful! - recycling Praid map");
        if (pMap) recycleMap(getMapIndex(pMap));
        if (fMap) recycleMap(getMapIndex(fMap));
        pMap = null;
        fMap = null;
        debug("Turning AutoMaps back on");
        game.options.menu.repeatUntil.enabled = 0;
        autoTrimpSettings['AutoMaps'].value = 1;
    }

    if (!getPageSetting(praidSetting).includes(game.global.world)) {
        prestraid = false;
        failpraid = false;
        prestraidon = false;
        shouldFarmFrags = false;
        praidDone = false;
    }
}

export function relaxMapReqs(mapModifiers: any) {
    for (var j = 0; j < mapModifiers.length; j++) {
        byId('sizeAdvMapsRange').value = "9";
        byId('advSpecialSelect').value = mapModifiers[j];
        for (var i = 9; i >= 0; i--) {
            byId('difficultyAdvMapsRange').value = String(i);
            if (updateMapCost(true) <= game.resources.fragments.owned) return true;
        }
        for (i = 9; i >= 0; i--) {
            byId('sizeAdvMapsRange').value = String(i);
            if (updateMapCost(true) <= game.resources.fragments.owned) return true;
        }
    }
    return false;
}

/**
 * #191 — AT suspends the game's **Climb BW** option for the duration of a BW raid, and the `BWraid`
 * tooltip is explicit about the scope: "AT turns your game's Climb BW option off itself **while this
 * runs**, so BW leveling doesn't compete with the raid."
 *
 * It never turned it back on. `grep -rn "climbBw" src/` returned exactly one line — the write — so the
 * first BW raid silently and permanently destroyed the player's choice. `game.options.menu` is part of
 * the save, so it survived zones, portals and reloads. The write also skipped
 * `toggleSetting('climbBw', null, false, true)`, the refresh the game itself pairs with every climbBw
 * write (main.js:10907, 13473-13474), leaving the in-game toggle rendering its old title.
 *
 * Held module-local rather than on the globalThis seam: nothing outside this file has any business
 * reading it. Known limit, stated rather than hidden — the saved value lives in memory, so a page
 * reload in the middle of a raid loses it and Climb BW stays off. That is strictly better than today
 * (where it is lost unconditionally), and persisting it would mean minting a setting id, which is a
 * data-loss hazard of its own (#68-#74).
 */
let savedClimbBw: number | null = null;

// #176 — one "no Max BW set" message per zone, not one per tick. Keyed by zone so the next raid zone
// re-arms it, AND by Daily-vs-normal: `BWraiding()` branches its whole setting triple on
// `challengeActive == "Daily"`, so a zone number configured in BOTH `BWraidingz` and `dBWraidingz`
// would otherwise let whichever context arrived first suppress the other's only diagnostic. (Caught
// by review; the #227 sibling in mapfunctions-amp.ts was already split this way and this was not.)
// Module-local for the same reason as savedClimbBw: nothing outside this file reads it.
const bwUnsetWarnedZone: Record<string, number> = { daily: -1, normal: -1 };

function suspendClimbBw() {
    if (savedClimbBw === null) savedClimbBw = game.options.menu.climbBw.enabled;
    if (game.options.menu.climbBw.enabled !== 0) {
        game.options.menu.climbBw.enabled = 0;
        toggleSetting('climbBw', null, false, true);
    }
}

function restoreClimbBw() {
    if (savedClimbBw === null) return;
    if (game.options.menu.climbBw.enabled !== savedClimbBw) {
        game.options.menu.climbBw.enabled = savedClimbBw;
        toggleSetting('climbBw', null, false, true);
    }
    savedClimbBw = null;
}

/**
 * #178 — the zone→max pairing for BW Raiding, in ONE place.
 *
 * `BWraidingz` and `BWraidingmax` are parallel multiValue lists: the ceiling for a zone is the entry
 * at that zone's OWN index, which is why the setting's tooltip documents them as pairs ("Example:
 * 480, 495 paired with Max BW to raid 500, 515", settings-defs.ts:1693). BWraiding() has always done
 * this correctly; main-loop.ts's buyWeps dispatch instead compared the world number to the whole
 * ARRAY (`495 == [480,495]` → ToPrimitive → "480,495" → NaN → false), so it fired only for a
 * single-entry list and never for the documented multi-entry form.
 *
 * Exported and shared rather than copied, because a second copy of a code-owned rule is what rots
 * ([[reference-derive-dont-retype]]) — and #168 in this same session is a fix that landed on one of
 * two identical expressions and left the other alive for seven years.
 *
 * Returns the configured ceiling for `world`, or `undefined` when this zone is not configured — an
 * unset max is NOT an infinite one (#176): the raid's exit test IS the ceiling, so Infinity hangs.
 *
 * Takes the resolved LISTS, not the setting ids. Taking ids would move two `getPageSetting(...)` calls
 * behind a parameter, and tests/nets/settings-reverse.test.ts (#68) resolves ids at the callsite — so
 * the ids would stop being provably createSetting'd and would need an ALLOWED_DYNAMIC waiver. That is
 * the same trap native-conflicts.ts documents at its own top. Callers keep their reads where the net
 * can see them.
 */
export function bwRaidTargetFor(world: number, zones: unknown, maxes: unknown): number | undefined {
    if (!Array.isArray(zones)) return undefined;
    const bwIndex = zones.indexOf(world);
    if (bwIndex === -1) return undefined;
    const target = Array.isArray(maxes) ? maxes[bwIndex] : undefined;
    return typeof target === 'number' && !Number.isNaN(target) && target >= 0 ? target : undefined;
}

export function BWraiding() {
    var bwraidZ;
    var bwraidSetting;
    var bwraidMax;
    var isBWRaidZ;
    var targetBW: number | undefined;
    var cell;

    if (game.global.challengeActive == "Daily") {
        bwraidZ = 'dBWraidingz';
        bwraidSetting = 'Dailybwraid';
        bwraidMax = 'dBWraidingmax';
        cell = ((getPageSetting('dbwraidcell') > 0) ? getPageSetting('dbwraidcell') : 1);
    } else {
        bwraidZ = 'BWraidingz';
        bwraidSetting = 'BWraid';
        bwraidMax = 'BWraidingmax';
        cell = ((getPageSetting('bwraidcell') > 0) ? getPageSetting('bwraidcell') : 1);
    }

    isBWRaidZ = getPageSetting(bwraidZ).includes(game.global.world) && ((game.global.lastClearedCell + 1) >= cell);
    // #178 — the pairing now lives in bwRaidTargetFor(), shared with main-loop.ts's buyWeps dispatch.
    // It folds in the `>= 0` / non-NaN check that used to be `bwTargetSet` below, so an unconfigured
    // zone reads as `undefined` from both callers rather than each re-deriving "is this set". (The
    // separate `bwIndex` local it replaced had no other reader.)
    targetBW = bwRaidTargetFor(game.global.world, getPageSetting(bwraidZ), getPageSetting(bwraidMax));

    // #176 — an UNSET ceiling is not a ceiling of -1.
    //
    // `BWraidingmax` ships as `multiValue [-1]` (settings-defs.ts:1696-1698), and a max list shorter
    // than the zone list yields `undefined` for the trailing zones. Both used to collapse to
    // `targetBW = -1`. Bionic Wonderland levels are `tier * 15 + 125` >= 125 (config.js:9810), so
    // `findLastBionic().level > targetBW` was true on the very first tick: AT set AutoMaps to 0, took
    // the game's Climb BW option, entered the Map Chamber, printed "Beginning BW Raiding...", printed
    // "...Successfully BW raided!" in the same breath, and acquired nothing. `bwraidon` never latched,
    // so `buyWeps()` (main-loop.ts:410) never ran either.
    //
    // -1 cannot mean "no ceiling" here, however much AT's own input dialog says so (settings-engine.ts
    // renders " Put -1 for Infinite." for every multiValue). The loop ends on
    // `findLastBionic().level > targetBW`, and clearing a BW is what creates the next tier
    // (config.js:9815 `roboTrimp.fire` → `createMap`), so an infinite ceiling never terminates: once
    // the chain stops producing maps at `getObsidianStart() + 100`, the top level stops climbing and
    // AT re-runs the last BW until portal. A hang is worse than the no-op it replaces.
    //
    // So an unset max means the zone is not configured. Skip it, and say so — rather than claim a
    // success, and rather than take AutoMaps and Climb BW hostage for a raid that will not happen.
    // (User decision, 2026-07-28.)
    var bwTargetSet = targetBW !== undefined;
    if (isBWRaidZ && !bwTargetSet && getPageSetting(bwraidSetting)) {
        var bwWarnKey = (game.global.challengeActive == "Daily") ? 'daily' : 'normal';
        if (bwUnsetWarnedZone[bwWarnKey] !== game.global.world) {
            bwUnsetWarnedZone[bwWarnKey] = game.global.world;
            debug("BW Raiding is on for zone " + game.global.world + " but no Max BW to raid is set for it - skipping. " +
                "Set a Max BW (the highest Bionic Wonderland level to raid up to) to enable it.", "maps");
        }
        return;
    }

    if (isBWRaidZ && !bwraided && !failbwraid && getPageSetting(bwraidSetting)) {
        // The early return above fires for exactly `isBWRaidZ && setting && !bwTargetSet`, and this
        // block re-tests both of those, so reaching here means the ceiling IS configured. Bound once
        // so the two comparisons below read a plain number rather than each carrying an assertion —
        // and so that if the guard above is ever loosened, this line is where it breaks.
        const bwCeiling = targetBW as number;
        if (getPageSetting('AutoMaps') == 1 && !bwraided && !failbwraid) {
            autoTrimpSettings["AutoMaps"].value = 0;
        }
        
        suspendClimbBw();

        while (!game.global.preMapsActive && !bwraidon) mapsClicked();

        if (game.options.menu.repeatUntil.enabled != 2 && !bwraided && !failbwraid) {
            game.options.menu.repeatUntil.enabled = 2;
        }

        if (game.global.preMapsActive && !bwraided && !failbwraid && findLastBionic()) {
            selectMap(findLastBionic().id);
            failbwraid = false;
            debug("Beginning BW Raiding...");
        } else if (game.global.preMapsActive && !bwraided && !failbwraid) {
            if (getPageSetting('AutoMaps') == 0 && isBWRaidZ && !bwraided) {
                autoTrimpSettings["AutoMaps"].value = 1;
                failbwraid = true;
                restoreClimbBw(); // #191 — the raid is over; give the player their option back
                debug("Failed to BW raid. Looks like you don't have a BW to raid...");
            }
        }

        if (findLastBionic().level <= bwCeiling && !bwraided && !failbwraid && game.global.preMapsActive) {
            runMap();
            bwraidon = true;
        }

        if (!game.global.repeatMap && !bwraided && !failbwraid && game.global.mapsActive) {
            repeatClicked();
        }

        if (findLastBionic().level > bwCeiling && !bwraided && !failbwraid) {
            bwraided = true;
            failbwraid = false;
            bwraidon = false;
            restoreClimbBw(); // #191
            debug("...Successfully BW raided!");
        }
    }

    if (getPageSetting('AutoMaps') == 0 && game.global.preMapsActive && bwraided && !failbwraid) {
        autoTrimpSettings["AutoMaps"].value = 1;
        debug("Turning AutoMaps back on");
    }

    if (!isBWRaidZ) {
        // #191 — the backstop. Every path that leaves a BW raid zone lands here, including the ones
        // the two calls above cannot cover: the user switching `BWraid` off mid-raid, a Daily starting
        // or ending (which swaps the whole setting triple), and the raid simply never completing.
        restoreClimbBw();
        bwraided = false;
        failbwraid = false;
        bwraidon = false;
    }
}

globalThis.dpMap1 = undefined;
globalThis.dpMap2 = undefined;
globalThis.dpMap3 = undefined;
globalThis.dpMap4 = undefined;
globalThis.dpMap5 = undefined;
globalThis.drepMap1 = undefined;
globalThis.drepMap2 = undefined;
globalThis.drepMap3 = undefined;
globalThis.drepMap4 = undefined;
globalThis.drepMap5 = undefined;
globalThis.dmapbought1 = false;
globalThis.dmapbought2 = false;
globalThis.dmapbought3 = false;
globalThis.dmapbought4 = false;
globalThis.dmapbought5 = false;
globalThis.dpraidDone = false;

export function dailyPraiding() {
    var cell;
    cell = ((getPageSetting('dPraidingcell') > 0) ? getPageSetting('dPraidingcell') : 0);
    if (getPageSetting('dPraidingzone').length) {
        if (getPageSetting('dPraidingzone').includes(game.global.world) && ((cell <= 1) || (cell > 1 && (game.global.lastClearedCell + 1) >= cell)) && !dprestraid && !dfailpraid) {
            dprestraidon = true;
            if (getPageSetting('AutoMaps') == 1 && !dprestraid && !dfailpraid) {
                autoTrimpSettings["AutoMaps"].value = 0;
            }
            if (!game.global.preMapsActive && !game.global.mapsActive && !dprestraid) {
                mapsClicked();
                if (!game.global.preMapsActive) {
                    mapsClicked();
                }
                debug("Beginning Prestige Raiding...");
            }
            if (game.options.menu.repeatUntil.enabled != 2 && !dprestraid) {
                game.options.menu.repeatUntil.enabled = 2;
            }
            if (game.global.preMapsActive && !game.global.mapsActive && !dprestraid) {
                debug("Map Loop");
                if (pcheckmap5() == true && pcheck5() == true && dpMap5 == undefined && !dmapbought5 && game.global.preMapsActive && !dprestraid) {
                    debug("Check complete for 5th map");
                    plusPres5();
                    if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                        dmapbought5 = buyMap() === 1;
                        if (dmapbought5) {
                            dpMap5 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                            debug("5th map bought");
                        }
                    }
                }
                if (pcheckmap4() == true && pcheck4() == true && dpMap4 == undefined && !dmapbought4 && game.global.preMapsActive && !dprestraid) {
                    debug("Check complete for 4th map");
                    plusPres4();
                    if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                        dmapbought4 = buyMap() === 1;
                        if (dmapbought4) {
                            dpMap4 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                            debug("4th map bought");
                        }
                    }
                }
                if (pcheckmap3() == true && pcheck3() == true && dpMap3 == undefined && !dmapbought3 && game.global.preMapsActive && !dprestraid) {
                    debug("Check complete for 3rd map");
                    plusPres3();
                    if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                        dmapbought3 = buyMap() === 1;
                        if (dmapbought3) {
                            dpMap3 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                            debug("3rd map bought");
                        }
                    }
                }
                if (pcheckmap2() == true && pcheck2() == true && dpMap2 == undefined && !dmapbought2 && game.global.preMapsActive && !dprestraid) {
                    debug("Check complete for 2nd map");
                    plusPres2();
                    if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                        dmapbought2 = buyMap() === 1;
                        if (dmapbought2) {
                            dpMap2 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                            debug("2nd map bought");
                        }
                    }
                }
                if (pcheckmap1() == true && pcheck1() == true && dpMap1 == undefined && !dmapbought1 && game.global.preMapsActive && !dprestraid) {
                    debug("Check complete for 1st map");
                    plusPres1();
                    if ((updateMapCost(true) <= game.resources.fragments.owned)) {
                        dmapbought1 = buyMap() === 1;
                        if (dmapbought1) {
                            dpMap1 = game.global.mapsOwnedArray[game.global.mapsOwnedArray.length - 1].id;
                            debug("1st map bought");
                        }
                    }
                }
                if (!dmapbought1 && !dmapbought2 && !dmapbought3 && !dmapbought4 && !dmapbought5) {
                    if (getPageSetting('AutoMaps') == 0 && !dprestraid) {
                        autoTrimpSettings["AutoMaps"].value = 1;
                        game.options.menu.repeatUntil.enabled = 0;
                        dprestraidon = false;
                        dfailpraid = true;
                        dpraidDone = true;
                        dpMap1 = undefined;
                        dpMap2 = undefined;
                        dpMap3 = undefined;
                        dpMap4 = undefined;
                        dpMap5 = undefined;
                        debug("Failed to Prestige Raid. Looks like you can't afford to or you are too weak or you have limited yourself in a P/I zone. ");
                    }
                    return;
                }
            }
            if (game.global.preMapsActive && !game.global.mapsActive && dmapbought1 && dpMap1 != undefined && !dprestraid) {
                debug("running map 1");
                selectMap(dpMap1);
                runMap();
                drepMap1 = dpMap1;
                dpMap1 = undefined;
            }
            if (game.global.preMapsActive && !game.global.mapsActive && dmapbought2 && dpMap2 != undefined && !dprestraid) {
                debug("running map 2");
                selectMap(dpMap2);
                runMap();
                drepMap2 = dpMap2;
                dpMap2 = undefined;
            }
            if (game.global.preMapsActive && !game.global.mapsActive && dmapbought3 && dpMap3 != undefined && !dprestraid) {
                debug("running map 3");
                selectMap(dpMap3);
                runMap();
                drepMap3 = dpMap3;
                dpMap3 = undefined;
            }
            if (game.global.preMapsActive && !game.global.mapsActive && dmapbought4 && dpMap4 != undefined && !dprestraid) {
                debug("running map 4");
                selectMap(dpMap4);
                runMap();
                drepMap4 = dpMap4;
                dpMap4 = undefined;
            }
            if (game.global.preMapsActive && !game.global.mapsActive && dmapbought5 && dpMap5 != undefined && !dprestraid) {
                debug("running map 5");
                selectMap(dpMap5);
                runMap();
                drepMap5 = dpMap5;
                dpMap5 = undefined;
            }
            if (!dprestraid && !game.global.repeatMap) {
                repeatClicked();
            }
        }
    }
    // #83 §5: the first conjunct tested pMap1 — the U1 global — instead of dpMap1. A daily raid could
    // therefore declare itself complete before its first map had even launched (pMap1 is undefined
    // whenever the non-daily machine is idle), while dpMap1 was still pending.
    if (game.global.preMapsActive && (dmapbought1 || dmapbought2 || dmapbought3 || dmapbought4 || dmapbought5) && dpMap1 == undefined && dpMap2 == undefined && dpMap3 == undefined && dpMap4 == undefined && dpMap5 == undefined && !dprestraid && !dfailpraid) {
        dprestraid = true;
        dfailpraid = false;
        dmapbought1 = false;
        dmapbought2 = false;
        dmapbought3 = false;
        dmapbought4 = false;
        dmapbought5 = false;
    }
    if (getPageSetting('AutoMaps') == 0 && game.global.preMapsActive && dprestraid && !dfailpraid && dprestraidon) {
        dpraidDone = true;
        dprestraidon = false;
        if (drepMap1 != undefined) {
            recycleMap(getMapIndex(drepMap1));
            drepMap1 = undefined;
        }
        if (drepMap2 != undefined) {
            recycleMap(getMapIndex(drepMap2));
            drepMap2 = undefined;
        }
        if (drepMap3 != undefined) {
            recycleMap(getMapIndex(drepMap3));
            drepMap3 = undefined;
        }
        if (drepMap4 != undefined) {
            recycleMap(getMapIndex(drepMap4));
            drepMap4 = undefined;
        }
        if (drepMap5 != undefined) {
            recycleMap(getMapIndex(drepMap5));
            drepMap5 = undefined;
        }
        autoTrimpSettings["AutoMaps"].value = 1;
        game.options.menu.repeatUntil.enabled = 0;
        dpMap1 = undefined; // #83 §5: was pMap1 — the U1 global (copy-paste from Praiding)
        dpMap2 = undefined;
        dpMap3 = undefined;
        dpMap4 = undefined;
        dpMap5 = undefined;
        debug("Prestige raiding successful!");
        debug("Turning AutoMaps back on");
    }
    if (getPageSetting('dPraidingzone').every(isBelowThreshold)) {
        dprestraid = false;
        dfailpraid = false;
        dprestraidon = false;
        dmapbought1 = false;
        dmapbought2 = false;
        dmapbought3 = false;
        dmapbought4 = false;
        dmapbought5 = false;
        // #83 §5: this whole reset block wrote the U1 Praiding globals instead of its own daily
        // twins. Consequences: it yanked pMap1/repMap1..5 out from under the CONCURRENT non-daily
        // state machine, and — worse — drepMap1..drepMap5 were NEVER reset, so stale map ids from a
        // previous daily survived into the next one and were handed to recycleMap(getMapIndex(stale)).
        // getMapIndex returns undefined for an id that no longer exists (main.js:8187), and recycleMap
        // treats undefined as "recycle the map I'm currently looking at" (main.js:10694) — so it
        // recycled the WRONG map.
        dpMap1 = undefined;
        dpMap2 = undefined;
        dpMap3 = undefined;
        dpMap4 = undefined;
        dpMap5 = undefined;
        drepMap1 = undefined;
        drepMap2 = undefined;
        drepMap3 = undefined;
        drepMap4 = undefined;
        drepMap5 = undefined;
        dpraidDone = false;
    }
}