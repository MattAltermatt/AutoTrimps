// TRUE-TS (Phase 1 · Wave 2, #29): faithful port of legacy/modules/buildings.js, now
// strict-typed. Housing / storage / building-purchase logic (U1 + U2 radon R* family).
// Deeply game-coupled (127 game.* touches) — native/AT globals typed ambient in
// src/game/*.d.ts and read by bare name (no imports → esbuild byte-identical to the
// @ts-nocheck original, the conversion gate). getPageSetting + debug imported from
// converted utils. Module-level vars (housingList, RhousingList, smithybought) are
// buildings-internal. TWO seam notes:
//   1. bestFoodBuilding: was a sloppy-mode implicit global (missing var) used only inside
//      buyFoodEfficientHousing; localized to a const here (no external reader) to avoid a
//      strict-mode ReferenceError. bestBuilding stays bare — it resolves to the
//      var bestBuilding declared in AutoTrimps2.js (loads first).
//   2. needGymystic is NOT exported (unlike every other fn): it is byte-identical to
//      upgrades.js's copy, is never invoked as a function anywhere, and the original's
//      post-load value is AutoTrimps2.js's boolean var needGymystic = true. Publishing
//      this function via the bridge would overwrite that boolean at load. Left module-scoped.
//
// IDIOMATIC (Phase 2 · #51): un-minified behind the proof-net (tests/buildings.characterization.test.ts
//   pins every branch first, each converted operator driven to a live evaluation by a fixture; L0
//   backstop ∅). 131 var→const/let. 27 ==/!= → strict where operands are provably the same runtime type
//   (building names, challengeActive/formation/universe/map-id which the game itself compares strictly,
//   increase.what strings, numeric world/length/questcheck). 9 comparisons KEPT LOOSE deliberately:
//     - every getPageSetting(...) comparison — getPageSetting is polymorphic (boolean/string/number/
//       int[]/undefined, see utils.ts): `hidebuildings == true`, `MaxGym == -1`, `MaxTribute == -1`,
//       `Rnurtureon == true`;
//     - the three `max == -1` sentinel checks — `max` reads a getPageSetting-derived local;
//     - MODULES["upgrades"].autoGigas == false — cross-module falsy-catch;
//     - `housing != null` (RbuyBuildings do/while) — a loose null-guard on mostEfficientHousing's
//       string|null return (never undefined, but the loose form is the faithful null check).
//   Every numeric literal + formula shape is preserved exactly (balance is sacrosanct).
//   Pre-existing DEAD CODE (unchanged): housingList + RhousingList are declared but read nowhere in
//   src/ or legacy/; needGymystic is never invoked (doc'd above).
import { getPageSetting, debug } from './utils'

MODULES["buildings"] = {};
MODULES["buildings"].storageMainCutoff = 0.85;
MODULES["buildings"].storageLowlvlCutoff1 = 0.7;
MODULES["buildings"].storageLowlvlCutoff2 = 0.5;

//Helium
const housingList = ['Hut', 'House', 'Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector', 'Warpstation'];

function needGymystic() {
    return game.upgrades['Gymystic'].allowed - game.upgrades['Gymystic'].done > 0;
}

export function safeBuyBuilding(building: string) {
    if (isBuildingInQueue(building))
        return false;
    if (game.buildings[building].locked)
        return false;
    const oldBuy = preBuy2();

    if (bwRewardUnlocked("DecaBuild")) {
        game.global.buyAmt = 10;
        if (!canAffordBuilding(building)) {
            game.global.buyAmt = 2;
            if (!canAffordBuilding(building))
                game.global.buyAmt = 1;
        }
    }
    else if (bwRewardUnlocked("DoubleBuild")) {
        game.global.buyAmt = 2;
        if (!canAffordBuilding(building))
            game.global.buyAmt = 1;
    }
    else game.global.buyAmt = 1;

    if (!canAffordBuilding(building)) {
        postBuy2(oldBuy);
        return false;
    }
    // #57 coordinator: defer a lesser building that would spend metal reserved for a higher-priority
    // target (e.g. saving up for Coordination). The whole block is gated on `active` so that when the
    // setting is OFF nothing extra runs at all — the OFF path is byte-identical (the proof-net L0
    // traces reproduce). Phase 1 reserves the metal pool only.
    // Only metal-costed buildings can dip into a metal reserve; skip the rest (and never ask
    // getBuildingItemPrice for a resource a building doesn't cost — native throws on a missing key).
    if (MODULES["coordinator"]?.active && game.buildings[building].cost?.metal !== undefined) {
        const coordMetalCost = getBuildingItemPrice(game.buildings[building], "metal", false, game.global.buyAmt === 'Max' ? 1 : game.global.buyAmt);
        if (!coordinatorAllows(building, "metal", coordMetalCost)) {
            postBuy2(oldBuy);
            return false;
        }
    }

    game.global.firing = false;

    if (building === 'Gym' && getPageSetting('GymWall')) {
        game.global.buyAmt = 1;
    }
    if (building === 'Warpstation' && !game.buildings[building].locked && canAffordBuilding(building)) {
        if (game.buildings.Warpstation.owned < 2) {
            game.global.buyAmt = 'Max';
            game.global.maxSplit = 1;
        } else {
            game.global.buyAmt = 1;
        }
        buyBuilding(building, true, true);
        debug('Building ' + game.global.buyAmt + ' ' + building + 's', "buildings", '*rocket');
        postBuy2(oldBuy);
        return;
    }
    if (building !== 'Trap') debug('Building ' + building, "buildings", '*hammer2');
    if (!game.buildings[building].locked && canAffordBuilding(building)) {
        buyBuilding(building, true, true);
    }
    postBuy2(oldBuy);
    return true;
}

export function buyFoodEfficientHousing() {
    //Init
    const ignoresLimit = getPageSetting('FoodEfficiencyIgnoresMax')
    let unlockedHousing = ["Hut", "House", "Mansion", "Hotel", "Resort"].filter(b => !game.buildings[b].locked);

    //Resets Border Color
    unlockedHousing.forEach(b => document.getElementById(b)!.style.border = "1px solid #FFFFFF")

    //Checks for Limits
    if (!ignoresLimit) {
        unlockedHousing = unlockedHousing.filter(b => {
            //Filter out buildings that are past the limits
            if (game.buildings[b].owned < getPageSetting('Max' + b) || getPageSetting('Max' + b) < 1)
                return true;

            //But paints their border before removing them
            document.getElementById(b)!.style.border = "1px solid orange"
            return false
        })
    }

    //Determines Food Efficiency for each housing
    const buildOrder = unlockedHousing.map(b => ({
        'name': b,
        'ratio': getBuildingItemPrice(game.buildings[b], "food", false, 1) / game.buildings[b].increase.by
    }));

    //Grabs the most Food Efficient Housing
    if (buildOrder.length === 0) return;
    const bestFoodBuilding = buildOrder.reduce((best, current) => current.ratio < best.ratio ? current : best)

    //If Food Efficiency Ignores Limit is enabled, then it only buy Huts and Houses here
    if (!ignoresLimit || ["Hut", "House"].includes(bestFoodBuilding.name)) {
        document.getElementById(bestFoodBuilding.name)!.style.border = "1px solid #00CC01";
        safeBuyBuilding(bestFoodBuilding.name);
    }
}

export function buyGemEfficientHousing() {
    const gemHousing = ["Mansion", "Hotel", "Resort", "Gateway", "Collector", "Warpstation"];
    const unlockedHousing = [];
    for (const house in gemHousing) {
        if (game.buildings[gemHousing[house]].locked === 0) {
            unlockedHousing.push(gemHousing[house]);
        }
    }
    const obj: Record<string, number> = {};
    for (const house in unlockedHousing) {
        const building = game.buildings[unlockedHousing[house]];
        const cost = getBuildingItemPrice(building, "gems", false, 1);
        const ratio = cost / building.increase.by;
        obj[unlockedHousing[house]] = ratio;
        document.getElementById(unlockedHousing[house])!.style.border = "1px solid #FFFFFF";
    }
    const keysSorted = Object.keys(obj).sort(function (a, b) {
        return obj[a] - obj[b];
    });
    let bestGemBuilding = null;
    for (const best in keysSorted) {
        let max = getPageSetting('Max' + keysSorted[best]);
        if (max === false) max = -1;
        if (game.buildings[keysSorted[best]].owned < max || max == -1 || (getPageSetting('GemEfficiencyIgnoresMax') && keysSorted[best] !== "Gateway")) {
            bestGemBuilding = keysSorted[best];
            document.getElementById(bestGemBuilding)!.style.border = "1px solid #00CC00";

            //Gateway Wall
            if (bestGemBuilding === "Gateway" && getPageSetting('GatewayWall') > 1) {
                if (getBuildingItemPrice(game.buildings.Gateway, "fragments", false, 1) > (game.resources.fragments.owned / getPageSetting('GatewayWall'))) {
                    document.getElementById(bestGemBuilding)!.style.border = "1px solid orange";
                    bestGemBuilding = null;
                    continue;
                }
            }

            let skipWarp = false;
            if (getPageSetting('WarpstationCap') && bestGemBuilding === "Warpstation") {
                const firstGigaOK = MODULES["upgrades"].autoGigas == false || game.upgrades.Gigastation.done > 0;
                const gigaCapped = game.buildings.Warpstation.owned >= (Math.floor(game.upgrades.Gigastation.done * getPageSetting('DeltaGigastation')) + getPageSetting('FirstGigastation'))
                if (firstGigaOK && gigaCapped) skipWarp = true;
            }
            const warpwallpct = getPageSetting('WarpstationWall3');
            if (warpwallpct > 1 && bestGemBuilding === "Warpstation") {
                if (getBuildingItemPrice(game.buildings.Warpstation, "metal", false, 1) * Math.pow(1 - game.portal.Resourceful.modifier, game.portal.Resourceful.level) > (game.resources.metal.owned / warpwallpct))
                    skipWarp = true;
            }
            if (skipWarp)
                bestGemBuilding = null;
            const getcoord = getPageSetting('WarpstationCoordBuy');
            if (getcoord && skipWarp) {
                const toTip = game.buildings.Warpstation;
                if (canAffordBuilding("Warpstation")) {
                    const howMany = calculateMaxAfford(game.buildings["Warpstation"], true);
                    const needCoord = game.upgrades.Coordination.allowed - game.upgrades.Coordination.done > 0;
                    const coordReplace = (game.portal.Coordinated.level) ? (25 * Math.pow(game.portal.Coordinated.modifier, game.portal.Coordinated.level)).toFixed(3) : 25;
                    if (!canAffordCoordinationTrimps()) {
                        const nextCount = (game.portal.Coordinated.level) ? game.portal.Coordinated.currentSend : game.resources.trimps.maxSoldiers;
                        const amtToGo = ((nextCount * 3) - game.resources.trimps.realMax());
                        let increase = toTip.increase.by;
                        if (game.portal.Carpentry.level && toTip.increase.what === "trimps.max") increase *= Math.pow(1.1, game.portal.Carpentry.level);
                        if (game.portal.Carpentry_II.level && toTip.increase.what === "trimps.max") increase *= (1 + (game.portal.Carpentry_II.modifier * game.portal.Carpentry_II.level));
                        if (amtToGo < increase * howMany)
                            bestGemBuilding = "Warpstation";
                    }
                }
            }
            break;
        }
    }
    if (bestGemBuilding) {
        bestBuilding = bestGemBuilding
        safeBuyBuilding(bestGemBuilding);
    }
}

export function buyBuildings() {
    const customVars = MODULES["buildings"];
    const oldBuy = preBuy2();
    const hidebuild = (getPageSetting('BuyBuildingsNew') === 0 && getPageSetting('hidebuildings') == true);
    game.global.buyAmt = 1;
    if (!hidebuild) {
        buyFoodEfficientHousing();
        buyGemEfficientHousing();
    }
    if (!hidebuild && getPageSetting('MaxWormhole') > 0 && game.buildings.Wormhole.owned < getPageSetting('MaxWormhole') && !game.buildings.Wormhole.locked) {
        safeBuyBuilding('Wormhole');
    }

    //Gyms:
    if (!game.buildings.Gym.locked && (getPageSetting('MaxGym') > game.buildings.Gym.owned || getPageSetting('MaxGym') == -1)) {
        let skipGym = false;

        //Dynamic Gyms
        if (getPageSetting('DynamicGyms')) {
            //Target Zone
            const targetZone = game.global.world;

            //Enemy stats
            const block = calcOurBlock() / (game.global.brokenPlanet ? 2 : 1);
            const pierce = game.global.brokenPlanet ? (getPierceAmt() * (game.global.formation === 3 ? 2 : 1)) : 0;
            const nextGym = game.upgrades.Gymystic.modifier + Math.max(0, game.upgrades.Gymystic.done - 1) / 100;
            const currentEnemyDamageOK = block > nextGym * calcSpecificEnemyAttack();
            const zoneEnemyDamageOK = block > calcBadGuyDmg(null, getEnemyMaxAttack(game.global.world, 90, 'Snimp', 1.0), true, true) * (1 - pierce);

            //Challenge stats
            const moreBlockThanHealth = block >= nextGym * calcOurHealth(false);
            const crushedOK = game.global.challengeActive !== "Crushed";
            const explosiveOK = game.global.challengeActive !== "Daily" || typeof game.global.dailyChallenge.explosive === "undefined";
            const challengeOK = moreBlockThanHealth || crushedOK && explosiveOK;

            //Stop buying Gyms if we already have enough block for our current enemy and also a C99 Snimp
            if (currentEnemyDamageOK && zoneEnemyDamageOK && challengeOK) skipGym = true;
        }

        //Gym Wall
        const gymwallpct = getPageSetting('GymWall');
        if (gymwallpct > 1) {
            if (getBuildingItemPrice(game.buildings.Gym, "wood", false, 1) * Math.pow(1 - game.portal.Resourceful.modifier, game.portal.Resourceful.level)
                > (game.resources.wood.owned / gymwallpct))
                skipGym = true;
        }

        //ShieldBlock cost Effectiveness:
        if (game.equipment['Shield'].blockNow) {
            const gymEff = evaluateEquipmentEfficiency('Gym');
            const shieldEff = evaluateEquipmentEfficiency('Shield');
            if ((gymEff.Wall) || (gymEff.Factor <= shieldEff.Factor && !gymEff.Wall))
                skipGym = true;
        }

        //Buy Gym
        if (!((game.upgrades['Gymystic'].allowed - game.upgrades['Gymystic'].done) > 0) && !skipGym) safeBuyBuilding('Gym');
    }

    //Tributes:
    if (!game.buildings.Tribute.locked && !hidebuild && (getPageSetting('MaxTribute') > game.buildings.Tribute.owned || getPageSetting('MaxTribute') == -1))
        safeBuyBuilding('Tribute');

    //Nurseries Init
    const nurseryZoneOk = game.global.world >= getPageSetting('NoNurseriesUntil');
    const maxNurseryOk = getPageSetting('MaxNursery') < 0 || game.buildings.Nursery.owned < getPageSetting('MaxNursery');

    const spireNurseryActive = game.global.challengeActive !== "Daily" && (game.global.world > 200 && isActiveSpireAT() || game.global.world <= 200 && getPageSetting('IgnoreSpiresUntil') <= 200);
    const nurseryPreSpire = spireNurseryActive && game.buildings.Nursery.owned < getPageSetting('PreSpireNurseries');

    const dailySpireNurseryActive = game.global.challengeActive === "Daily" && (disActiveSpireAT() || game.global.world <= 200 && getPageSetting('dIgnoreSpiresUntil') <= 200);
    const dailyNurseryPreSpire = dailySpireNurseryActive && game.buildings.Nursery.owned < getPageSetting('dPreSpireNurseries');

    let skipNursery = false;
    const nurserywall = getPageSetting('NurseryWall');
    if (nurserywall > 0) {
        const nurserywood = (getBuildingItemPrice(game.buildings.Nursery, "wood", false, 1) * Math.pow(1 - game.portal.Resourceful.modifier, game.portal.Resourceful.level));
        const nurserygem = (getBuildingItemPrice(game.buildings.Nursery, "gems", false, 1) * Math.pow(1 - game.portal.Resourceful.modifier, game.portal.Resourceful.level));
        const nurserymetal = (getBuildingItemPrice(game.buildings.Nursery, "metal", false, 1) * Math.pow(1 - game.portal.Resourceful.modifier, game.portal.Resourceful.level));
        if (nurserywood > (game.resources.wood.owned * (nurserywall / 100))) {
            skipNursery = true;
        }
        else if (nurserygem > (game.resources.gems.owned * (nurserywall / 100))) {
            skipNursery = true;
        }
        else if (nurserymetal > (game.resources.metal.owned * (nurserywall / 100))) {
            skipNursery = true;
        }
    }

    //Nurseries
    if (game.buildings.Nursery.locked === 0 && !hidebuild && !skipNursery && (nurseryZoneOk && maxNurseryOk || nurseryPreSpire || dailyNurseryPreSpire)) {
        safeBuyBuilding('Nursery');
    }

    postBuy2(oldBuy);
}

export function buyStorage() {
    const customVars = MODULES["buildings"];
    const packMod = 1 + game.portal.Packrat.level * game.portal.Packrat.modifier;
    const Bs: Record<string, string> = {
        'Barn': 'food',
        'Shed': 'wood',
        'Forge': 'metal'
    };
    for (const B in Bs) {
        let jest = 0;
        const owned = game.resources[Bs[B]].owned;
        let max = game.resources[Bs[B]].max * packMod;
        max = calcHeirloomBonus("Shield", "storageSize", max);
        if (game.global.mapsActive && game.unlocks.imps.Jestimp) {
            jest = simpleSeconds(Bs[B], 45);
            jest = scaleToCurrentMap(jest);
        }
        if ((game.global.world === 1 && owned > max * customVars.storageLowlvlCutoff1) ||
            (game.global.world >= 2 && game.global.world < 10 && owned > max * customVars.storageLowlvlCutoff2) ||
            (owned + jest > max * customVars.storageMainCutoff)) {
            if (canAffordBuilding(B) && game.triggers[B].done) {
                safeBuyBuilding(B);
            }
        }
    }
}

//Radon

const RhousingList = ['Hut', 'House', 'Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector'];

export function RsafeBuyBuilding(building: string) {
    if (isBuildingInQueue(building))
        return false;
    if (game.buildings[building].locked)
        return false;
    const oldBuy = preBuy2();

    if (bwRewardUnlocked("DecaBuild")) {
        game.global.buyAmt = 10;
        if (!canAffordBuilding(building)) {
            game.global.buyAmt = 2;
            if (!canAffordBuilding(building))
                game.global.buyAmt = 1;
        }
    }
    else if (bwRewardUnlocked("DoubleBuild")) {
        game.global.buyAmt = 2;
        if (!canAffordBuilding(building))
            game.global.buyAmt = 1;
    }
    else game.global.buyAmt = 1;

    if (!canAffordBuilding(building)) {
        postBuy2(oldBuy);
        return false;
    }

    game.global.firing = false;

    debug('Building ' + building, "buildings", '*hammer2');
    if (!game.buildings[building].locked && canAffordBuilding(building)) {
        buyBuilding(building, true, true);
    }
    postBuy2(oldBuy);
    return true;
}

export function RbuyFoodEfficientHousing() {
    const foodHousing = ["Hut", "House", "Mansion", "Hotel", "Resort"];
    const unlockedHousing = [];
    for (const house in foodHousing) {
        if (game.buildings[foodHousing[house]].locked === 0) {
            unlockedHousing.push(foodHousing[house]);
        }
    }
    const buildorder = [];
    if (unlockedHousing.length > 0) {
        for (const house in unlockedHousing) {
            const building = game.buildings[unlockedHousing[house]];
            const cost = getBuildingItemPrice(building, "food", false, 1);
            const ratio = cost / building.increase.by;
            buildorder.push({
                'name': unlockedHousing[house],
                'ratio': ratio
            });
            document.getElementById(unlockedHousing[house])!.style.border = "1px solid #FFFFFF";
        }
        buildorder.sort(function (a, b) {
            return a.ratio - b.ratio;
        });
        let bestfoodBuilding = null;
        const bb = buildorder[0];
        const max = getPageSetting('RMax' + bb.name);
        if (game.buildings[bb.name].owned < max || max == -1) {
            bestfoodBuilding = bb.name;
        }
        if (smithylogic(bestfoodBuilding, 'wood', false) && bestfoodBuilding) {
            document.getElementById(bestfoodBuilding)!.style.border = "1px solid #00CC01";
            RsafeBuyBuilding(bestfoodBuilding);
        }
    }
}

export function RbuyGemEfficientHousing() {
    const gemHousing = ["Mansion", "Hotel", "Resort", "Gateway", "Collector"];
    const unlockedHousing = [];
    for (const house in gemHousing) {
        if (game.buildings[gemHousing[house]].locked === 0) {
            unlockedHousing.push(gemHousing[house]);
        }
    }
    const obj: Record<string, number> = {};
    for (const house in unlockedHousing) {
        const building = game.buildings[unlockedHousing[house]];
        const cost = getBuildingItemPrice(building, "gems", false, 1);
        const ratio = cost / building.increase.by;
        obj[unlockedHousing[house]] = ratio;
        document.getElementById(unlockedHousing[house])!.style.border = "1px solid #FFFFFF";
    }
    const keysSorted = Object.keys(obj).sort(function (a, b) {
        return obj[a] - obj[b];
    });
    bestBuilding = null;
    for (const best in keysSorted) {
        let max = getPageSetting('RMax' + keysSorted[best]);
        if (max === false) max = -1;
        if (game.buildings[keysSorted[best]].owned < max || max == -1) {
            bestBuilding = keysSorted[best];
            document.getElementById(bestBuilding)!.style.border = "1px solid #00CC00";
            break;
        }
    }
    if (smithylogic(bestBuilding, 'gems', false) && bestBuilding) {
        RsafeBuyBuilding(bestBuilding);
    }
}

let smithybought = 0;

export function mostEfficientHousing() {

    //Housing
    const HousingTypes = ['Hut', 'House', 'Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector'];

    // Which houses we actually want to check
    const housingTargets = [];
    for (const house of HousingTypes) {
        const maxHousing = (getPageSetting('RMax' + house) === -1 ? Infinity : getPageSetting('RMax' + house));
        if (!game.buildings[house].locked && game.buildings[house].owned < maxHousing) {
            housingTargets.push(house);
        }
    }

    const mostEfficient: { name: string | null; time: number } = {
        name: "",
        time: Infinity
    }

    for (const housing of housingTargets) {

        let worstTime = -Infinity;
        const currentOwned = game.buildings[housing].owned;
        for (const resource in game.buildings[housing].cost) {

            // Get production time for that resource
            const baseCost = game.buildings[housing].cost[resource][0];
            const costScaling = game.buildings[housing].cost[resource][1];
            let avgProduction = getPsString(resource, true);
            if (avgProduction <= 0) avgProduction = 1;
            let housingBonus = game.buildings.Hut.increase.by;
            if (!game.buildings.Hub.locked) { housingBonus += 500; }

            // Only keep the slowest producer, aka the one that would take the longest to generate resources for
            worstTime = Math.max(baseCost * Math.pow(costScaling, currentOwned - 1) / (avgProduction * housingBonus), worstTime);
            if (resource === 'wood' && !Rhyposhouldwood) worstTime = Infinity;
        }

        if (mostEfficient.time > worstTime) {
            mostEfficient.name = housing;
            mostEfficient.time = worstTime;
        }
    }
    if (mostEfficient.name === "") mostEfficient.name = null;

    return mostEfficient.name;
}

export function RbuyStorage(buyFood: boolean, buyWood: boolean, buyMetal: boolean) {

    // Simple map for resources to the names of their storage buildings.
    const Resources: Record<string, string> = {};
    if (buyFood) { Resources.food = "Barn"; }
    if (buyWood) { Resources.wood = "Shed"; }
    if (buyMetal) { Resources.metal = "Forge"; }

    // Check if we're currently running trimple/atlantrimp
    // Fix (#22): mapsOwnedArray is an ARRAY of map objects; `for..in` bound Map to the string
    // index, so Map.id/Map.name were undefined and isOnTrimple never became a boolean (it kept
    // currentMapId, truthy inside any map). Iterate elements and default to false.
    const currentMap = game.global.currentMapId;
    let isOnTrimple = false;
    for (let i = 0; i < game.global.mapsOwnedArray.length; i++) {
        const Map = game.global.mapsOwnedArray[i];
        if (Map.id === currentMap) {
            if (Map.name === "Atlantrimp" || Map.name === "Trimple Of Doom") {
                isOnTrimple = true;
            }
        }
    }

    // Calculate whatever would send us over the current max
    const jestImps: Record<string, number> = {};
    for (const Res in Resources) {

        // Calculate maximum resources for given resource
        let resMax = game.resources[Res].max;
        if (game.global.universe === 1) {
            resMax *= 1 + game.portal.Packrat.level * game.portal.Packrat.modifier;
        } else {
            resMax *= 1 + game.portal.Packrat.radLevel * game.portal.Packrat.modifier;
        }
        resMax = calcHeirloomBonus("Shield", "storageSize", resMax, false);

        // Check if we're in a map
        const curRes = game.resources[Res].owned;
        if (game.global.mapsActive)
        {
            if (isOnTrimple) {
                jestImps[Res] = curRes * 2;
            } else {
                jestImps[Res] = curRes + scaleToCurrentMap(simpleSeconds(Res, 45));
            }
        } else {
            jestImps[Res] = curRes * 1.1;
        }


        if (resMax < jestImps[Res]) {
            if (canAffordBuilding(Resources[Res]) && !(game.buildings[Resources[Res]].locked)) {
                buyBuilding(Resources[Res], true, true, 1);
            }
        }
    }

}

export function RbuyBuildings() {

    // Storage
    if (game.global.challengeActive === "Hypothermia" && getPageSetting('Rhypostorage')) {

        let hypofarmzone;
        let hypofarmamount;
        const bonfire = game.challenges.Hypothermia.totalBonfires;
        const wood = game.resources.wood.max;
        let woodmax = wood * (1 + game.portal.Packrat.radLevel * game.portal.Packrat.modifier);
        woodmax = calcHeirloomBonus("Shield", "storageSize", woodmax, false);

        hypofarmzone = getPageSetting('Rhypofarmzone');
        hypofarmamount = getPageSetting('Rhypofarmstack');

        const hypoamountfarmindex = hypofarmzone.indexOf(game.global.world);
        const hypoamountzones = hypofarmamount[hypoamountfarmindex];

        const currentprice = (1e10 * Math.pow(100, game.challenges.Hypothermia.totalBonfires));
        let targetprice = (currentprice * Math.pow(100, ((hypoamountzones - bonfire) - 1))) * 1.05;
        targetprice += (targetprice / 1000);

        if (game.global.world > (getPageSetting('Rhypofarmzone')[getPageSetting('Rhypofarmzone').length - 1])) {
            if (!game.global.autoStorage) {
                toggleAutoStorage(false);
            }
        }

        else {
            if (game.global.autoStorage) {
                toggleAutoStorage(false);
            }

            if (targetprice >= 1e10 && ((woodmax * Math.pow(2, game.buildings.Shed.purchased - game.buildings.Shed.owned)) < targetprice)) {
                buyBuilding('Shed', true, true, 1);
            }

            RbuyStorage(true, false, true);
        }
    }
    else {
        if (!game.global.autoStorage) {
            toggleAutoStorage(false);
        }
    }


    //Smithy
    if (!game.buildings.Smithy.locked && canAffordBuilding("Smithy", false, false, false, false, 1) && Rhyposhouldwood) {
        // On quest challenge
        if (game.global.challengeActive === 'Quest') {
            if (smithybought > game.global.world) { smithybought = 0; }

            if (smithybought < game.global.world && (questcheck() === 7 || (RcalcHDratio() * 10 >= getPageSetting('Rmapcuntoff')))) {
                buyBuilding("Smithy", true, true, 1);
                smithybought = game.global.world;
            }
        } else {
            buyBuilding("Smithy", true, true, 1);
        }
    }

    //Microchip
    if (!game.buildings.Microchip.locked && canAffordBuilding('Microchip')) {
        buyBuilding('Microchip', true, true, 1);
    }

    //Housing
    const HousingTypes = ['Hut', 'House', 'Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector'];

    // Which houses we actually want to check
    const housingTargets = [];
    for (const house in HousingTypes) {
        const maxHousing = (getPageSetting('RMax' + house) === -1 ? Infinity : getPageSetting('RMax' + house));
        if (!game.buildings[HousingTypes[house]].locked && game.buildings[HousingTypes[house]].owned < maxHousing) {
            housingTargets.push(house);
        }
    }

    let boughtHousing = false;

    do {

        boughtHousing = false;
        const housing = mostEfficientHousing();

        if (housing != null && canAffordBuilding(housing) && game.buildings[housing].purchased < (getPageSetting('RMax' + housing) === -1 ? Infinity : getPageSetting('RMax' + housing))) {
            buyBuilding(housing, true, true, 1);
            boughtHousing = true;
        }
    } while (boughtHousing)

    //Tributes
    if (!game.buildings.Tribute.locked) {
        let buyTributeCount = getMaxAffordable(Math.pow(1.05, game.buildings.Tribute.owned) * 10000, game.resources.food.owned, 1.05, true);

        if (getPageSetting('RMaxTribute') > game.buildings.Tribute.owned) {
            buyTributeCount = Math.min(buyTributeCount, getPageSetting('RMaxTribute') - game.buildings.Tribute.owned);
        }
        if (getPageSetting('RMaxTribute') < 0 || (getPageSetting('RMaxTribute') > game.buildings.Tribute.owned)) {
            buyBuilding('Tribute', true, true, buyTributeCount);
        }
    }

    //Labs
    if (!game.buildings.Laboratory.locked && getPageSetting('Rnurtureon') == true) {
        if (!isBuildingInQueue('Laboratory') && (getPageSetting('RMaxLabs') < 0 || (getPageSetting('RMaxLabs') > game.buildings.Laboratory.owned))) {
            buyBuilding('Laboratory', true, true, 1);
        }
    }

}
