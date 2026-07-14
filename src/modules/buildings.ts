// TRUE-TS (Phase 1 · Wave 2, #29): faithful port of legacy/modules/buildings.js, now
// strict-typed. Housing / storage / building-purchase logic (U1 + U2 radon R* family).
// Deeply game-coupled (127 game.* touches) — native/AT globals typed ambient in
// src/game/*.d.ts and read by bare name (no imports → esbuild byte-identical to the
// pre-conversion original, the conversion gate). getPageSetting + debug imported from
// converted utils. Module-level vars (housingList, RhousingList, smithybought) are
// buildings-internal.
//
// ⚠️ DO NOT let the token `@ts`-`nocheck` begin a line of this header. TypeScript honours it
// ANYWHERE in a file's leading comment block, prose or not — and a re-wrap once left line 5
// starting with it, which silently exempted this entire module from type checking. It went
// unnoticed because the file still *looked* converted and CLAUDE.md claimed zero remained;
// a `const x: number = "s"` probe produced ZERO tsc errors. Other modules mention the token
// mid-line, which is inert. Found by the 2026-07-13 doc audit, not by a gate.
//
// TWO seam notes:
//   1. bestFoodBuilding: was a sloppy-mode implicit global (missing var) used only inside
//      buyFoodEfficientHousing; localized to a const here (no external reader) to avoid a
//      strict-mode ReferenceError. bestBuilding stays bare — it resolves to the
//      var bestBuilding declared in AutoTrimps2.js (loads first).
//   2. (#63 removed the dead module-scoped needGymystic() function. It was never invoked, and was
//      kept unexported only so the bridge would not overwrite AutoTrimps2.js's same-named boolean
//      — a boolean that is now itself retired. The live check it encoded is inlined at its one real
//      call site, the Gym buy below.)
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
import { getPageSetting, debug } from './utils'

MODULES["buildings"] = {};
MODULES["buildings"].storageMainCutoff = 0.85;
MODULES["buildings"].storageLowlvlCutoff1 = 0.7;
MODULES["buildings"].storageLowlvlCutoff2 = 0.5;

//Helium


/**
 * #123 — the largest stack worth queueing, and the reason U2 was building at a tenth of U1's rate.
 *
 * The game crafts ONE queue entry per craft cycle (`craftBuildings()` calls `removeQueueItem('first')`
 * at most once, main.js:4939), and that entry yields `Math.min(DecaBuild ? 10 : DoubleBuild ? 2 : 1,
 * <this entry's own stack amount>)` buildings (updates.js:5438-5444). So:
 *
 *   - ten separate `Hut.1` entries  ⇒ min(10, 1) = 1 building per craft cycle. DecaBuild does NOTHING.
 *   - one `Hut.10` entry            ⇒ min(10,10) = 10 buildings in a SINGLE craft cycle.
 *
 * U2's buyers passed `forceAmt = 1` at every site, so every U2 player with the DecaBuild Bone-Portal
 * reward — which is universe-agnostic and permanent, i.e. essentially all of them — got no benefit from
 * it at all. Queue DEPTH is not throughput; queue-entry STACK SIZE is.
 *
 * Note a stack larger than this buys nothing extra (the min caps it), so this is the only amount worth
 * asking for. Without either reward it returns 1, which is what every U2 site passed before — so a
 * player without the rewards is unaffected.
 */
export function bulkBuyAmount(): number {
    return bwRewardUnlocked("DecaBuild") ? 10 : bwRewardUnlocked("DoubleBuild") ? 2 : 1;
}

/**
 * @param amount  Optional explicit stack size. When given, the buy is made with the native `forceAmt`
 *                argument, which SELF-CLAMPS to what is actually affordable (main.js:4844) — so it buys
 *                7 when 7 are affordable, where the ladder below would step 10 → 2. It is also the only
 *                way to express a stack larger than 10, which Tribute needs.
 */
export function safeBuyBuilding(building: string, amount?: number) {
    if (isBuildingInQueue(building))
        return false;
    if (game.buildings[building].locked)
        return false;
    const oldBuy = preBuy2();

    if (amount !== undefined) {
        // Price the affordability gate for ONE unit; `buyBuilding` clamps the rest. Asking
        // canAffordBuilding for the full stack would refuse the whole buy when only part is affordable.
        game.global.buyAmt = 1;
        if (amount < 1 || !canAffordBuilding(building)) {
            postBuy2(oldBuy);
            return false;
        }
        game.global.firing = false;
        debug('Building ' + amount + ' ' + building, "buildings", '*hammer2');
        buyBuilding(building, true, true, amount);
        postBuy2(oldBuy);
        return true;
    }

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

    // #112: was a bare truthiness test on GymWall. Its default is -1 and its own description says
    // "-1 or 0 to disable" — but -1 is TRUTHY, so for every user on the default this clamped Gym
    // purchases to one at a time, silently discarding the DecaBuild/DoubleBuild bulk-buy bonus. The
    // wall math itself (line ~252) correctly gates on `> 1`, so the two consumers of this setting
    // disagreed about what -1 meant: the feature was off while its side effect stayed on.
    // `> 0` matches the documented semantics: -1/0 disable; 1 clamps to single buys only; >1 also
    // applies the wood wall.
    if (building === 'Gym' && getPageSetting('GymWall') > 0) {
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
            // #93: was `game.buildings.Hut.increase.by` — the HUT's population gain, for every housing
            // type in the loop. Being constant across the loop it cancelled out of the comparison
            // entirely, degenerating this "efficiency" metric into plain time-to-afford (always buy the
            // cheapest) and scoring a Collector (+5000 pop) as if it granted 3. The sibling
            // RbuyGemEfficientHousing already divides by the EVALUATED building's `increase.by`, and the
            // `+500` Hub term below only makes sense against the evaluated building's gain.
            let housingBonus = game.buildings[housing].increase.by;
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
            // #123 — the exact twin of U1's buyStorage() (which already routes through safeBuyBuilding,
            // line ~334). The ladder's affordability step-down is what keeps storage's x2 cost scaling in
            // check: it asks for 10, and falls to 2 then 1 when 10 is not affordable.
            safeBuyBuilding(Resources[Res]);
        }
    }

}

// #69 ship C: this path had NEVER executed in production (RbuyBuildings' gate compared a STRING to
// `true`), so there is no legacy behavior to preserve — this is a first-ever choice.
//
// The trap: the game's toggleAutoStorage(false) is a FLIP, not a setter (.trimps-game/main.js:18378 —
// `if (!noChange) game.global.autoStorage = !game.global.autoStorage`). Guarded only on the flag being
// off, it re-fires the instant the player turns AutoStorage off, so AT would force it back on ~100ms
// later, every tick, forever, with no opt-out anywhere in the settings. The setting's own tooltip only
// promises to "enable Vanilla AutoStorage if its off" — holding it on against the player is a different
// thing, and a player who cannot turn off a button is a bug report waiting to happen.
//
// So: one-shot. Enable it once per page load if it is off, then respect the player.
let autoStorageEnabledOnce = false;

/** Enable the game's AutoStorage at most once per page load, then leave the player's choice alone. */
export function __syncAutoStorageOnce() {
    if (!game.global.autoStorage && !autoStorageEnabledOnce) {
        autoStorageEnabledOnce = true;
        toggleAutoStorage(false);
    }
}

export function RbuyBuildings() {
    // #83 §1: pin the buy-amount for the whole U2 tree, exactly as U1's buyBuildings() does.
    // `canAffordBuilding(x)` with no forceAmt prices the player's AMBIENT UI buy-amount
    // (game.global.buyAmt — the 1/10/25/100/Max buttons, main.js:4752), while every buy below
    // takes exactly 1. At buyAmt=10/25/100/Max the gate priced N units, answered "no", and all
    // U2 housing + Microchip automation silently stopped. Pinning here (rather than patching the
    // two bare gates) also makes any FUTURE bare gate in this tree safe.
    const oldBuy = preBuy2();
    game.global.buyAmt = 1;

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

            // #123 — DELIBERATELY the one U2 site left on a raw single buy. This converges on the bonfire
            // target ONE doubling at a time: its own predicate is `woodmax * 2^(purchased - owned) <
            // targetprice`, a single-Shed ladder. A 10-stack would overshoot it by 2^9, and routing it
            // through safeBuyBuilding's isBuildingInQueue guard would stall the convergence outright.
            // Hypothermia is also a measured blind spot of the L0 net (blind-spot census), so this is the
            // last place to move behaviour on faith. `tests/nets/no-raw-buybuilding.test.ts` allowlists it.
            if (targetprice >= 1e10 && ((woodmax * Math.pow(2, game.buildings.Shed.purchased - game.buildings.Shed.owned)) < targetprice)) {
                buyBuilding('Shed', true, true, 1); /* raw-buyBuilding-allowlist: Hypothermia bonfire Shed ladder (#123) */
            }

            RbuyStorage(true, false, true);
        }
    }
    else {
        __syncAutoStorageOnce();
    }


    //Smithy
    // #123 — these all used to call the native buyBuilding() directly with forceAmt=1, so every U2 buy
    // was a `X.1` queue entry and the DecaBuild/DoubleBuild reward bought nothing (see bulkBuyAmount()).
    // They are routed through safeBuyBuilding now. The GymWall and Warpstation branches inside it never
    // fire here: both buildings are `blockU2: true` in the game's own config, so they are structurally
    // unreachable from U2 and no universe guard is needed.
    if (!game.buildings.Smithy.locked && canAffordBuilding("Smithy", false, false, false, false, 1) && Rhyposhouldwood) {
        // On quest challenge
        if (game.global.challengeActive === 'Quest') {
            if (smithybought > game.global.world) { smithybought = 0; }

            if (smithybought < game.global.world && (questcheck() === 7 || (RcalcHDratio() * 10 >= getPageSetting('Rmapcuntoff')))) {
                // Pinned to 1: the Quest is "buy a Smithy", one completes it, and `smithybought` is a
                // once-per-zone flag. A stack would pay 10 escalating costs for no extra progress. The
                // flag is now set only if the buy actually happened — a Smithy already in the queue means
                // retry next tick rather than burning the zone's flag on a no-op.
                if (safeBuyBuilding("Smithy", 1)) smithybought = game.global.world;
            }
        } else {
            safeBuyBuilding("Smithy");
        }
    }

    //Microchip
    if (!game.buildings.Microchip.locked) {
        safeBuyBuilding('Microchip');
    }

    // Housing
    //
    // #95: a `housingTargets` pre-filter used to sit here. It was dead THREE times over:
    //   1. It iterated `for (const house IN HousingTypes)` — `for..in` over an ARRAY yields the index
    //      STRINGS '0'..'6', so its cap lookup was getPageSetting('RMax0')…getPageSetting('RMax6').
    //      Those seven ids were never createSetting'd, so every one returned `false` (#68), making
    //      `maxHousing` false and `owned < false` → `owned < 0` → the filter admitted nothing.
    //   2. Nothing ever read `housingTargets`. The buy loop below calls mostEfficientHousing().
    //   3. mostEfficientHousing() already runs the SAME filter correctly (`for..of`, real `RMax<name>`
    //      ids), and the do/while below re-applies the cap on the winner. So even a repaired copy here
    //      would be redundant compute — 7 extra getPageSetting calls per tick for a value nobody reads.
    // Deleted rather than repaired: reviving it would need `RMax0`…`RMax6` settings that must NOT be
    // minted (#68 — a re-minted id resurrects the user's stored value forever).
    let boughtHousing = false;

    do {

        boughtHousing = false;
        const housing = mostEfficientHousing();

        // #94: House/Mansion/Hotel/Resort all cost metal. A blocked buy leaves boughtHousing false,
        // which ends the do/while — the loop defers rather than spinning.
        // The affordability check that used to sit here is now safeBuyBuilding's own (it returns false
        // when it cannot afford, which ends the loop exactly as before) — checking twice would be
        // redundant, and the cap check below is the only condition it does not already make.
        if (housing != null && game.buildings[housing].purchased < (getPageSetting('RMax' + housing) === -1 ? Infinity : getPageSetting('RMax' + housing))) {
            // #123 — THE site that cost U2 its build throughput. This loop used to queue dozens of `X.1`
            // entries per tick, but the game crafts one entry per craft cycle and takes min(10, amount)
            // from it — so a deep queue of singles builds at 1 per cycle no matter how deep it is. Buying
            // one stack of `bulkBuyAmount()` instead builds TEN per cycle. Queue depth was never
            // throughput; stack size is. safeBuyBuilding's isBuildingInQueue guard then ends the loop
            // after one stack per building type, which is also what stops housing head-of-line-blocking
            // Smithy/Tribute/Laboratory behind forty craft cycles.
            //
            // Clamped to the room left under RMax<housing> so a stack cannot overshoot the user's cap;
            // `purchased` (not `owned`) is the right term because in-queue units already count against it.
            const cap = getPageSetting('RMax' + housing) === -1 ? Infinity : getPageSetting('RMax' + housing);
            const room = cap - game.buildings[housing].purchased;
            boughtHousing = safeBuyBuilding(housing, Math.min(bulkBuyAmount(), room)) === true;
        }
    } while (boughtHousing)

    //Tributes
    if (!game.buildings.Tribute.locked) {
        let buyTributeCount = getMaxAffordable(Math.pow(1.05, game.buildings.Tribute.owned) * 10000, game.resources.food.owned, 1.05, true);

        if (getPageSetting('RMaxTribute') > game.buildings.Tribute.owned) {
            buyTributeCount = Math.min(buyTributeCount, getPageSetting('RMaxTribute') - game.buildings.Tribute.owned);
        }
        // #123 — Tribute is the one U2 site that ALREADY stacked correctly (buyTributeCount is a computed
        // bulk count, often far above 10, and one `Tribute.N` entry already gets the full min(10, N) per
        // craft cycle). It is routed for the chokepoint invariant, NOT for the stack — hence the explicit
        // amount: putting it through the 10 → 2 → 1 ladder would have capped it at 10 and regressed the
        // only site that worked.
        if ((getPageSetting('RMaxTribute') < 0 || (getPageSetting('RMaxTribute') > game.buildings.Tribute.owned))) {
            safeBuyBuilding('Tribute', buyTributeCount);
        }
    }

    //Labs
    if (!game.buildings.Laboratory.locked && getPageSetting('Rnurtureon') == true) {
        // #123 — the local isBuildingInQueue guard is now safeBuyBuilding's own first line, so it is
        // dropped rather than duplicated. Clamped to the room under RMaxLabs, same as housing.
        if (getPageSetting('RMaxLabs') < 0 || (getPageSetting('RMaxLabs') > game.buildings.Laboratory.owned)) {
            const labCap = getPageSetting('RMaxLabs') < 0 ? Infinity : getPageSetting('RMaxLabs');
            const labRoom = labCap - game.buildings.Laboratory.purchased;
            safeBuyBuilding('Laboratory', Math.min(bulkBuyAmount(), labRoom));
        }
    }

    // #83 §1: restore the player's own buy-amount selector (and firing/lockTooltip/maxSplit).
    postBuy2(oldBuy);
}
