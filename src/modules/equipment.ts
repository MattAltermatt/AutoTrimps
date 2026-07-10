// TRUE-TS (Phase 1 · Wave 2, #29): faithful port of legacy/modules/equipment.js, now
// strict-typed. Auto-equip / prestige / equipment-efficiency logic (U1 + the parallel U2
// radon R* family). Deeply game-coupled (146 game.* touches); native/AT globals typed
// ambient in src/game/*.d.ts and read by bare name. getPageSetting + debug imported from
// converted utils. No cross-module shared vars: module-level bindings (equipmentList, Best,
// resourcesNeeded, preBuy*2, and R* twins) are equipment-internal, so they stay module-scoped
// (now const/let). The one bare implicit-global write (needGymystic, in
// evaluateEquipmentEfficiency) resolves to the var declared in AutoTrimps2.js, which
// loads before this bundle — so no strict-mode ReferenceError at runtime.
//
// IDIOMATIC (Phase 2 · #51): un-minified behind the proof-net (tests/equipment.characterization.test.ts
//   pins every exported fn first; L0 backstop ∅). var→const/let; ==→=== / !=→!== ONLY where operands
//   are provably the same runtime type (challengeActive/Stat/Resource/name strings, locked/level/world
//   numbers, blockNow/Wall booleans, typeof results). Kept LOOSE deliberately: every getPageSetting(...)
//   comparison (polymorphic per utils.ts), getEmpowerment()=='Wind' (string|false), and the
//   `mostEfficientStuff != undefined` guard. Every numeric literal + formula shape preserved exactly
//   (balance is sacrosanct). Faithful-port oddities preserved: RequipCost missing-braces (Artisan/
//   Pandemonium mults run unconditionally), Rgetequips unreachable post-`continue` block, and the
//   dead attainablePrestiges/prestigeZones pair.
import { getPageSetting, debug } from './utils'

//Helium

MODULES["equipment"] = {};
MODULES["equipment"].numHitsSurvived = 10;
MODULES["equipment"].numHitsSurvivedScry = 80;
MODULES["equipment"].capDivisor = 10;
MODULES["equipment"].alwaysLvl2 = getPageSetting('always2');
MODULES["equipment"].waitTill60 = true;
MODULES["equipment"].equipHealthDebugMessage = false;
const equipmentList: Record<string, any> = {
    'Dagger': {
        Upgrade: 'Dagadder',
        Stat: 'attack',
        Resource: 'metal',
        Equip: true
    },
    'Mace': {
        Upgrade: 'Megamace',
        Stat: 'attack',
        Resource: 'metal',
        Equip: true
    },
    'Polearm': {
        Upgrade: 'Polierarm',
        Stat: 'attack',
        Resource: 'metal',
        Equip: true
    },
    'Battleaxe': {
        Upgrade: 'Axeidic',
        Stat: 'attack',
        Resource: 'metal',
        Equip: true
    },
    'Greatsword': {
        Upgrade: 'Greatersword',
        Stat: 'attack',
        Resource: 'metal',
        Equip: true
    },
    'Boots': {
        Upgrade: 'Bootboost',
        Stat: 'health',
        Resource: 'metal',
        Equip: true
    },
    'Helmet': {
        Upgrade: 'Hellishmet',
        Stat: 'health',
        Resource: 'metal',
        Equip: true
    },
    'Pants': {
        Upgrade: 'Pantastic',
        Stat: 'health',
        Resource: 'metal',
        Equip: true
    },
    'Shoulderguards': {
        Upgrade: 'Smoldershoulder',
        Stat: 'health',
        Resource: 'metal',
        Equip: true
    },
    'Breastplate': {
        Upgrade: 'Bestplate',
        Stat: 'health',
        Resource: 'metal',
        Equip: true
    },
    'Arbalest': {
        Upgrade: 'Harmbalest',
        Stat: 'attack',
        Resource: 'metal',
        Equip: true
    },
    'Gambeson': {
        Upgrade: 'GambesOP',
        Stat: 'health',
        Resource: 'metal',
        Equip: true
    },
    'Shield': {
        Upgrade: 'Supershield',
        Stat: 'health',
        Resource: 'wood',
        Equip: true
    },
    'Gym': {
        Upgrade: 'Gymystic',
        Stat: 'block',
        Resource: 'wood',
        Equip: false
    }
};
const mapresourcetojob: Record<string, string> = {"food": "Farmer", "wood": "Lumberjack", "metal": "Miner", "science": "Scientist"};
export function equipEffect(gameResource: any, equip: any) {
    if (equip.Equip) return gameResource[equip.Stat + 'Calculated'];
    const currentEffect = gameResource.increase.by * gameResource.owned;
    const gymysticMod = game.upgrades.Gymystic.done ? game.upgrades.Gymystic.modifier + 0.01 * (game.upgrades.Gymystic.done - 1) : 1;
    const nextEffect = gameResource.increase.by * (gameResource.owned + 1) * gymysticMod;
    return nextEffect - currentEffect;
}
export function equipCost(gameResource: any, equip: any) {
    let cost = parseFloat(getBuildingItemPrice(gameResource, equip.Resource, equip.Equip, 1) as any);
    cost = equip.Equip
        ? Math.ceil(cost * Math.pow(1 - game.portal.Artisanistry.modifier, game.portal.Artisanistry.level))
        : Math.ceil(cost * Math.pow(1 - game.portal.Resourceful.modifier, game.portal.Resourceful.level));
    return cost;
}
export function PrestigeValue(upgradeName: any) {
    const prestigeEquip = game.upgrades[upgradeName].prestiges;
    const equipment = game.equipment[prestigeEquip];
    // typeof always yields a string → strict compare is type-safe.
    const stat = equipment.blockNow ? "block" : (typeof equipment.health === "undefined" ? "attack" : "health");
    return Math.round(equipment[stat] * Math.pow(1.19, equipment.prestige * game.global.prestige[stat] + 1));
}

export function evaluateEquipmentEfficiency(equipName: string) {
    const equip = equipmentList[equipName];
    const gameResource = equip.Equip ? game.equipment[equipName] : game.buildings[equipName];
    if (equipName === 'Shield') {
        if (gameResource.blockNow) {
            equip.Stat = 'block';
        } else {
            equip.Stat = 'health';
        }
    }
    const Effect = equipEffect(gameResource, equip);
    const Cost = equipCost(gameResource, equip);
    let Factor = Effect / Cost;
    let StatusBorder = 'white';
    let Wall = false;

    // getPageSetting is polymorphic (boolean/string/number/int[]/undefined) → KEEP == loose.
    const BuyWeaponUpgrades = ((getPageSetting('BuyWeaponsNew') == 1) || (getPageSetting('BuyWeaponsNew') == 2));
    const BuyArmorUpgrades = ((getPageSetting('BuyArmorNew') == 1) || (getPageSetting('BuyArmorNew') == 2));
    let NextEffect: number | undefined;
    let NextCost: number | undefined;
    if (!game.upgrades[equip.Upgrade].locked) {
        const CanAfford = canAffordTwoLevel(game.upgrades[equip.Upgrade]);
        if (equip.Equip) {
            NextEffect = PrestigeValue(equip.Upgrade);
            if ((game.global.challengeActive === "Scientist" && getScientistLevel() > 2) || (!BuyWeaponUpgrades && !BuyArmorUpgrades))
                NextCost = Infinity;
            else
                NextCost = Math.ceil(getNextPrestigeCost(equip.Upgrade) * Math.pow(1 - game.portal.Artisanistry.modifier, game.portal.Artisanistry.level));
            Wall = (NextEffect / NextCost > Factor);
        }


        if (!CanAfford) {
            StatusBorder = 'yellow';
        } else {
            if (!equip.Equip) {

                StatusBorder = 'red';
            } else {
                const CurrEffect = gameResource.level * Effect;
                const NeedLevel = Math.ceil(CurrEffect / NextEffect!);
                const Ratio = gameResource.cost[equip.Resource][1];
                const NeedResource = NextCost! * (Math.pow(Ratio, NeedLevel) - 1) / (Ratio - 1);
                if (game.resources[equip.Resource].owned > NeedResource) {
                    StatusBorder = 'red';
                } else {
                    StatusBorder = 'orange';
                }
            }
        }
    }
    // challengeActive() returns a boolean → strict compare is type-safe.
    if (game.jobs[mapresourcetojob[equip.Resource]].locked && (challengeActive("Metal") === false)) {

        Factor = 0;
        Wall = true;
    }

    const isLiquified = (game.options.menu.liquification.enabled && game.talents.liquification.purchased && !game.global.mapsActive && game.global.gridArray && game.global.gridArray[0] && game.global.gridArray[0].name === "Liquimp");
    let cap = 100;
    if (equipmentList[equipName].Stat === 'health') cap = getPageSetting('CapEquiparm');
    if (equipmentList[equipName].Stat === 'attack') cap = getPageSetting('CapEquip2');
    if ((isLiquified) && cap > 0 && gameResource.level >= (cap / MODULES["equipment"].capDivisor)) {
        Factor = 0;
        Wall = true;
    } else if (cap > 0 && gameResource.level >= cap) {
        Factor = 0;
        Wall = true;
    }
    if (equipName !== 'Gym' && game.global.world < 60 && game.global.world >= 58 && MODULES["equipment"].waitTill60) {
        Wall = true;
    }
    // getPageSetting('always2') is polymorphic → KEEP == loose.
    if (gameResource.level < 2 && getPageSetting('always2') == true) {
        Factor = 999 - gameResource.prestige;
    }
    if (equipName === 'Shield' && gameResource.blockNow &&
        game.upgrades['Gymystic'].allowed - game.upgrades['Gymystic'].done > 0) {
        needGymystic = true;
        Factor = 0;
        Wall = true;
        StatusBorder = 'orange';
    }
    return {
        Stat: equip.Stat,
        Factor: Factor,
        StatusBorder: StatusBorder,
        Wall: Wall,
        Cost: Cost
    };
}

let resourcesNeeded: any;
let Best: any;

// `9 < level` (i.e. level >= 10) weapon guard preserved verbatim; `locked === 0` is number-vs-number.
export function orangewindstack() {
    if (9 < game.equipment.Dagger.level && game.upgrades.Dagadder.locked === 0) buyUpgrade('Dagadder', true, true);
    if (9 < game.equipment.Mace.level && game.upgrades.Megamace.locked === 0) buyUpgrade('Megamace', true, true);
    if (9 < game.equipment.Polearm.level && game.upgrades.Polierarm.locked === 0) buyUpgrade('Polierarm', true, true);
    if (9 < game.equipment.Battleaxe.level && game.upgrades.Axeidic.locked === 0) buyUpgrade('Axeidic', true, true);
    if (9 < game.equipment.Greatsword.level && game.upgrades.Greatersword.locked === 0) buyUpgrade('Greatersword', true, true);
    if (9 < game.equipment.Arbalest.level && game.upgrades.Harmbalest.locked === 0) buyUpgrade('Harmbalest', true, true);
    if (game.upgrades.Bootboost.locked === 0) buyUpgrade('Bootboost', true, true);
    if (game.upgrades.Hellishmet.locked === 0) buyUpgrade('Hellishmet', true, true);
    if (game.upgrades.Pantastic.locked === 0) buyUpgrade('Pantastic', true, true);
    if (game.upgrades.Smoldershoulder.locked === 0) buyUpgrade('Smoldershoulder', true, true);
    if (game.upgrades.Bestplate.locked === 0) buyUpgrade('Bestplate', true, true);
    if (game.upgrades.GambesOP.locked === 0) buyUpgrade('GambesOP', true, true);
    if (game.upgrades.Supershield.locked === 0) buyUpgrade('Supershield', true, true);
}
export function dorangewindstack() {
    if (9 < game.equipment.Dagger.level && game.upgrades.Dagadder.locked === 0) buyUpgrade('Dagadder', true, true);
    if (9 < game.equipment.Mace.level && game.upgrades.Megamace.locked === 0) buyUpgrade('Megamace', true, true);
    if (9 < game.equipment.Polearm.level && game.upgrades.Polierarm.locked === 0) buyUpgrade('Polierarm', true, true);
    if (9 < game.equipment.Battleaxe.level && game.upgrades.Axeidic.locked === 0) buyUpgrade('Axeidic', true, true);
    if (9 < game.equipment.Greatsword.level && game.upgrades.Greatersword.locked === 0) buyUpgrade('Greatersword', true, true);
    if (9 < game.equipment.Arbalest.level && game.upgrades.Harmbalest.locked === 0) buyUpgrade('Harmbalest', true, true);
    if (game.upgrades.Bootboost.locked === 0) buyUpgrade('Bootboost', true, true);
    if (game.upgrades.Hellishmet.locked === 0) buyUpgrade('Hellishmet', true, true);
    if (game.upgrades.Pantastic.locked === 0) buyUpgrade('Pantastic', true, true);
    if (game.upgrades.Smoldershoulder.locked === 0) buyUpgrade('Smoldershoulder', true, true);
    if (game.upgrades.Bestplate.locked === 0) buyUpgrade('Bestplate', true, true);
    if (game.upgrades.GambesOP.locked === 0) buyUpgrade('GambesOP', true, true);
    if (game.upgrades.Supershield.locked === 0) buyUpgrade('Supershield', true, true);
}

export function windstackingprestige() {
    // challengeActive is a string → strict compare; getEmpowerment() can return string|false → KEEP loose.
    if (
        (game.global.challengeActive !== "Daily" && getEmpowerment() == "Wind" && getPageSetting('WindStackingMin') > 0 && game.global.world >= getPageSetting('WindStackingMin') && calcHDratio() < 5) ||
        (game.global.challengeActive === "Daily" && getEmpowerment() == "Wind" && getPageSetting('dWindStackingMin') > 0 && game.global.world >= getPageSetting('dWindStackingMin') && calcHDratio() < 5) ||
        (game.global.challengeActive !== "Daily" && getPageSetting('wsmax') > 0 && getPageSetting('wsmaxhd') > 0 && game.global.world >= getPageSetting('wsmax') && calcHDratio() < getPageSetting('wsmaxhd')) ||
        (game.global.challengeActive === "Daily" && getPageSetting('dwsmax') > 0 && getPageSetting('dwsmaxhd') > 0 && game.global.world >= getPageSetting('dwsmax') && calcHDratio() < getPageSetting('dwsmaxhd'))
    ) {
        if (game.global.challengeActive !== "Daily") orangewindstack();
        if (game.global.challengeActive === "Daily") dorangewindstack();
        return false;
    }
    else return true;
}

let preBuyAmt2: any = 1;
let preBuyFiring2: any = 1;
let preBuyTooltip2: any = false;
let preBuymaxSplit2: any = 1;
let preBuyCustomFirst2: any = 1;
let preBuyCustomLast2: any = 1;

export function preBuy3() {
    preBuyAmt2 = game.global.buyAmt;
    preBuyFiring2 = game.global.firing;
    preBuyTooltip2 = game.global.lockTooltip;
    preBuymaxSplit2 = game.global.maxSplit;
    preBuyCustomFirst2 = game.global.firstCustomAmt;
    preBuyCustomLast2 = game.global.lastCustomAmt;
}

export function postBuy3() {
    game.global.buyAmt = preBuyAmt2;
    game.global.firing = preBuyFiring2;
    game.global.lockTooltip = preBuyTooltip2;
    game.global.maxSplit = preBuymaxSplit2;
    game.global.firstCustomAmt = preBuyCustomFirst2;
    game.global.lastCustomAmt = preBuyCustomLast2;
}

export function autoLevelEquipment() {

    const gearamounttobuy = (getPageSetting('gearamounttobuy') > 0) ? getPageSetting('gearamounttobuy') : 1;

    //WS
    // getEmpowerment()=='Wind' + every getPageSetting(...) compare stays LOOSE (polymorphic); the
    // challengeActive string compares go strict.
    let enoughDamageCutoff = getPageSetting("dmgcuntoff");
    if (getEmpowerment() == 'Wind' && game.global.challengeActive !== "Daily" && !game.global.runningChallengeSquared && getPageSetting("AutoStance") == 3 && getPageSetting("WindStackingMin") > 0 && game.global.world >= getPageSetting("WindStackingMin") && getPageSetting("windcutoff") > 0)
        enoughDamageCutoff = getPageSetting("windcutoff");
    if (getEmpowerment() == 'Wind' && game.global.challengeActive === "Daily" && !game.global.runningChallengeSquared && (getPageSetting("AutoStance") == 3 || getPageSetting("use3daily") == true) && getPageSetting("dWindStackingMin") > 0 && game.global.world >= getPageSetting("dWindStackingMin") && getPageSetting("dwindcutoff") > 0)
        enoughDamageCutoff = getPageSetting("dwindcutoff");

    if (calcOurDmg("avg", false, true) <= 0) return;
    resourcesNeeded = {
        "food": 0,
        "wood": 0,
        "metal": 0,
        "science": 0,
        "gems": 0
    };
    Best = {};
    const keys = ['healthwood', 'healthmetal', 'attackmetal', 'blockwood'];
    for (let i = 0; i < keys.length; i++) {
        Best[keys[i]] = {
            Factor: 0,
            Name: '',
            Wall: false,
            StatusBorder: 'white',
            Cost: 0
        };
    }
    let ourDamage = calcOurDmg("avg", false, true);
    const mapbonusmulti = 1 + (0.20 * game.global.mapBonus);
    if (game.global.mapBonus > 0) {
        ourDamage *= mapbonusmulti;
    }
    if (challengeActive("Lead")) {
        if (game.global.world % 2 === 1 && game.global.world !== 179) {
            ourDamage /= 1.5;
        }
    }
    //Shield
    highDamageShield();
    // ShieldEquipped.name != getPageSetting(...) stays LOOSE (getPageSetting polymorphic).
    if (getPageSetting('loomswap') > 0 && game.global.challengeActive !== "Daily" && game.global.ShieldEquipped.name != getPageSetting('highdmg'))
        ourDamage *= trimpAA;
    if (getPageSetting('dloomswap') > 0 && game.global.challengeActive === "Daily" && game.global.ShieldEquipped.name != getPageSetting('dhighdmg'))
        ourDamage *= trimpAA;


    const enemyDamage = calcBadGuyDmg(null, getEnemyMaxAttack(game.global.world + 1, 50, 'Snimp', 1.0), true, true);
    const enemyHealth = calcEnemyHealth();
    const pierceMod = (game.global.brokenPlanet && !game.global.mapsActive) ? getPierceAmt() : 0;
    const numHits = MODULES["equipment"].numHitsSurvived;
    const enoughHealthE = (calcOurHealth(true) > numHits * (enemyDamage - calcOurBlock(true) > 0 ? enemyDamage - calcOurBlock(true) : enemyDamage * pierceMod));
    const enoughDamageE = (ourDamage * enoughDamageCutoff > enemyHealth);

    for (const equipName in equipmentList) {
        const equip = equipmentList[equipName];
        const gameResource = equip.Equip ? game.equipment[equipName] : game.buildings[equipName];
        if (!gameResource.locked) {
            const $equipName = document.getElementById(equipName)!;
            $equipName.style.color = 'white';
            const evaluation = evaluateEquipmentEfficiency(equipName);
            const BKey = equip.Stat + equip.Resource;

            if (Best[BKey].Factor === 0 || Best[BKey].Factor < evaluation.Factor) {
                Best[BKey].Factor = evaluation.Factor;
                Best[BKey].Name = equipName;
                Best[BKey].Wall = evaluation.Wall;
                Best[BKey].StatusBorder = evaluation.StatusBorder;
            }
            Best[BKey].Cost = evaluation.Cost;
            resourcesNeeded[equip.Resource] += Best[BKey].Cost;

            if (evaluation.Wall)
                $equipName.style.color = 'yellow';
            $equipName.style.border = '1px solid ' + evaluation.StatusBorder;

            const $equipUpgrade = document.getElementById(equip.Upgrade);
            if (evaluation.StatusBorder !== 'white' && evaluation.StatusBorder !== 'yellow' && $equipUpgrade)
                $equipUpgrade.style.color = evaluation.StatusBorder;
            if (evaluation.StatusBorder === 'yellow' && $equipUpgrade)
                $equipUpgrade.style.color = 'white';
            if (equipName === 'Gym' && needGymystic) {
                $equipName.style.color = 'white';
                $equipName.style.border = '1px solid white';
                if ($equipUpgrade) {
                    $equipUpgrade.style.color = 'red';
                    $equipUpgrade.style.border = '2px solid red';
                }
            }

            if (evaluation.StatusBorder === 'red' && windstackingprestige() && !(game.global.world < 60 && game.global.world >= 58 && MODULES["equipment"].waitTill60)) {
                const BuyWeaponUpgrades = ((getPageSetting('BuyWeaponsNew') == 1) || (getPageSetting('BuyWeaponsNew') == 2));
                const BuyArmorUpgrades = ((getPageSetting('BuyArmorNew') == 1) || (getPageSetting('BuyArmorNew') == 2));
                const DelayArmorWhenNeeded = getPageSetting('DelayArmorWhenNeeded');

                if (
                    (BuyWeaponUpgrades && equipmentList[equipName].Stat === 'attack') ||
                    (BuyWeaponUpgrades && equipmentList[equipName].Stat === 'block') ||
                    (BuyArmorUpgrades && equipmentList[equipName].Stat === 'health' &&
                        (
                            (DelayArmorWhenNeeded && !shouldFarm) ||
                            (DelayArmorWhenNeeded && enoughDamageE) ||
                            (DelayArmorWhenNeeded && !enoughDamageE && !enoughHealthE) ||
                            (DelayArmorWhenNeeded && equipmentList[equipName].Resource === 'wood') ||
                            (!DelayArmorWhenNeeded)
                        )
                    )
                )

                {
                    const upgrade = equipmentList[equipName].Upgrade;
                    if (upgrade !== "Gymystic")
                        debug('Upgrading ' + upgrade + " - Prestige " + game.equipment[equipName].prestige, "equips", '*upload');
                    else
                        debug('Upgrading ' + upgrade + " # " + game.upgrades[upgrade].allowed, "equips", '*upload');
                    buyUpgrade(upgrade, true, true);
                } else {
                    $equipName.style.color = 'orange';
                    $equipName.style.border = '2px solid orange';
                }
            }
        }
    }

    const BuyWeaponLevels = ((getPageSetting('BuyWeaponsNew') == 1) || (getPageSetting('BuyWeaponsNew') == 3));
    const BuyArmorLevels = ((getPageSetting('BuyArmorNew') == 1) || (getPageSetting('BuyArmorNew') == 3));
    preBuy3();
    for (const stat in Best) {
        const eqName = Best[stat].Name;
        if (eqName !== '') {
            const $eqName = document.getElementById(eqName)!;
            const DaThing = equipmentList[eqName];
            if (eqName === 'Gym' && needGymystic) {
                $eqName.style.color = 'white';
                $eqName.style.border = '1px solid white';
                continue;
            } else {
                $eqName.style.color = Best[stat].Wall ? 'orange' : 'red';
                $eqName.style.border = '2px solid red';
            }
            const maxmap = getPageSetting('MaxMapBonusAfterZone') && doMaxMapBonus;
            if (BuyArmorLevels && (DaThing.Stat === 'health' || DaThing.Stat === 'block') && (!enoughHealthE || maxmap)) {
                game.global.buyAmt = gearamounttobuy;
                if (DaThing.Equip && !Best[stat].Wall && canAffordBuilding(eqName, null, null, true)) {
                    debug('Leveling equipment ' + eqName, "equips", '*upload3');
                    buyEquipment(eqName, null, true);
                }
            }
            const aalvl2 = getPageSetting('always2');
            if (BuyArmorLevels && (DaThing.Stat === 'health') && aalvl2 && game.equipment[eqName].level < 2) {
                game.global.buyAmt = 1;
                if (DaThing.Equip && !Best[stat].Wall && canAffordBuilding(eqName, null, null, true)) {
                    debug('Leveling equipment ' + eqName + " (AlwaysLvl2)", "equips", '*upload3');
                    buyEquipment(eqName, null, true);
                }
            }
            if (windstackingprestige() && BuyWeaponLevels && DaThing.Stat === 'attack' && (!enoughDamageE || enoughHealthE || maxmap)) {
                game.global.buyAmt = gearamounttobuy;
                if (DaThing.Equip && !Best[stat].Wall && canAffordBuilding(eqName, null, null, true)) {
                    debug('Leveling equipment ' + eqName, "equips", '*upload3');
                    buyEquipment(eqName, null, true);
                }
            }
        }
    }
    postBuy3();
}
export function areWeAttackLevelCapped() {
    const attackEvals: any[] = [];
    for (const equipName in equipmentList) {
        const equip = equipmentList[equipName];
        const gameResource = equip.Equip ? game.equipment[equipName] : game.buildings[equipName];
        if (!gameResource.locked) {
            const evaluation = evaluateEquipmentEfficiency(equipName);
            if (evaluation.Stat === "attack") attackEvals.push(evaluation);
        }
    }
    return attackEvals.every((e) => e.Factor === 0 && e.Wall === true);
}

//Radon

MODULES["equipment"].RnumHitsSurvived = 10;
MODULES["equipment"].RnumHitsSurvivedScry = 80;
MODULES["equipment"].RcapDivisor = 10;
MODULES["equipment"].RequipHealthDebugMessage = false;
const RequipmentList: Record<string, any> = {
    'Dagger': {
        Upgrade: 'Dagadder',
        Stat: 'attack',
        Resource: 'metal',
        Equip: true
    },
    'Mace': {
        Upgrade: 'Megamace',
        Stat: 'attack',
        Resource: 'metal',
        Equip: true
    },
    'Polearm': {
        Upgrade: 'Polierarm',
        Stat: 'attack',
        Resource: 'metal',
        Equip: true
    },
    'Battleaxe': {
        Upgrade: 'Axeidic',
        Stat: 'attack',
        Resource: 'metal',
        Equip: true
    },
    'Greatsword': {
        Upgrade: 'Greatersword',
        Stat: 'attack',
        Resource: 'metal',
        Equip: true
    },
    'Boots': {
        Upgrade: 'Bootboost',
        Stat: 'health',
        Resource: 'metal',
        Equip: true
    },
    'Helmet': {
        Upgrade: 'Hellishmet',
        Stat: 'health',
        Resource: 'metal',
        Equip: true
    },
    'Pants': {
        Upgrade: 'Pantastic',
        Stat: 'health',
        Resource: 'metal',
        Equip: true
    },
    'Shoulderguards': {
        Upgrade: 'Smoldershoulder',
        Stat: 'health',
        Resource: 'metal',
        Equip: true
    },
    'Breastplate': {
        Upgrade: 'Bestplate',
        Stat: 'health',
        Resource: 'metal',
        Equip: true
    },
    'Arbalest': {
        Upgrade: 'Harmbalest',
        Stat: 'attack',
        Resource: 'metal',
        Equip: true
    },
    'Gambeson': {
        Upgrade: 'GambesOP',
        Stat: 'health',
        Resource: 'metal',
        Equip: true
    },
    'Shield': {
        Upgrade: 'Supershield',
        Stat: 'health',
        Resource: 'wood',
        Equip: true
    }
};

const Rmapresourcetojob: Record<string, string> = {"food": "Farmer", "wood": "Lumberjack", "metal": "Miner", "science": "Scientist"};

export function RequipEffect(gameResource: any, equip: any) {
    if (equip.Equip) {
        return gameResource[equip.Stat + 'Calculated'];
    }
}

export function RequipCost(gameResource: any, equip: any) {
    let price = parseFloat(getBuildingItemPrice(gameResource, equip.Resource, equip.Equip, 1) as any);
    // NOTE (faithful port): only the first line is guarded by `if (equip.Equip)`; the Artisan/
    // Pandemonium multipliers below run unconditionally (legacy missing-braces quirk — preserved).
    if (equip.Equip)
        price = Math.ceil(price * (Math.pow(1 - game.portal.Artisanistry.modifier, game.portal.Artisanistry.radLevel)));
        price *= autoBattle.oneTimers.Artisan.owned ? autoBattle.oneTimers.Artisan.getMult() : 1;
        if (game.global.challengeActive === "Pandemonium") price *= game.challenges.Pandemonium.getEnemyMult();
    /*else
        price = Math.ceil(price * (Math.pow(1 - game.portal.Resourceful.modifier, game.portal.Resourceful.radLevel)));*/
    return price;
}

export function RPrestigeValue(what: any) {
    const name = game.upgrades[what].prestiges;
    const equipment = game.equipment[name];
    const stat = (typeof equipment.health !== 'undefined') ? "health" : "attack";
    return Math.round(equipment[stat] * Math.pow(1.19, ((equipment.prestige) * game.global.prestige[stat]) + 1));
}

export function RevaluateEquipmentEfficiency(equipName: string) {
    const equip = RequipmentList[equipName];
    const gameResource = equip.Equip ? game.equipment[equipName] : game.buildings[equipName];
    // #56.1: the U2 evaluator must use the U2 cost/effect mirrors. RequipCost applies the game's
    // U2 getEquipPriceMult (Artisanistry .radLevel + Artisan one-timer + Pandemonium), matching the
    // NextCost calc below; the U1 equipCost used the wrong universe's Artisanistry level and omitted
    // the Artisan/Pandemonium multipliers. RequipEffect ≡ equipEffect for all-Equip:true entries.
    const Effect = RequipEffect(gameResource, equip);
    const Cost = RequipCost(gameResource, equip);
    let Factor = Effect / Cost;
    let StatusBorder = 'white';
    let Wall = false;

    // getPageSetting is polymorphic → KEEP == loose.
    const BuyWeaponUpgrades = ((getPageSetting('RBuyWeaponsNew') == 1) || (getPageSetting('RBuyWeaponsNew') == 2));
    const BuyArmorUpgrades = ((getPageSetting('RBuyArmorNew') == 1) || (getPageSetting('RBuyArmorNew') == 2));
    let NextEffect: number | undefined;
    let NextCost: number | undefined;
    if (!game.upgrades[equip.Upgrade].locked) {
        const CanAfford = canAffordTwoLevel(game.upgrades[equip.Upgrade]);
        if (equip.Equip) {
            NextEffect = PrestigeValue(equip.Upgrade);
            NextCost = Math.ceil(getNextPrestigeCost(equip.Upgrade) * Math.pow(1 - game.portal.Artisanistry.modifier, game.portal.Artisanistry.radLevel));
            Wall = (NextEffect / NextCost > Factor);
        }

        if (!CanAfford) {
            StatusBorder = 'yellow';
        } else {
            if (!equip.Equip) {

                StatusBorder = 'red';
            } else {
                const CurrEffect = gameResource.level * Effect;
                const NeedLevel = Math.ceil(CurrEffect / NextEffect!);
                const Ratio = gameResource.cost[equip.Resource][1];
                const NeedResource = NextCost! * (Math.pow(Ratio, NeedLevel) - 1) / (Ratio - 1);
                if (game.resources[equip.Resource].owned > NeedResource) {
                    StatusBorder = 'red';
                } else {
                    StatusBorder = 'orange';
                }
            }
        }
    }
    // challengeActive string + gridArray name are string-typed → strict compare; BuyWeaponUpgrades
    // unused here (faithful-port dead read, mirrors the U1 twin).
    if (game.jobs[Rmapresourcetojob[equip.Resource]].locked && (game.global.challengeActive !== 'Transmute')) {
        Factor = 0;
        Wall = true;
    }

    const isLiquified = (game.options.menu.liquification.enabled && game.talents.liquification.purchased && !game.global.mapsActive && game.global.gridArray && game.global.gridArray[0] && game.global.gridArray[0].name === "Liquimp");
    let cap = 100;
    if (RequipmentList[equipName].Stat === 'health') cap = getPageSetting('RCapEquiparm');
    if (RequipmentList[equipName].Stat === 'attack') cap = getPageSetting('RCapEquip2');
    if ((isLiquified) && cap > 0 && gameResource.level >= (cap / MODULES["equipment"].RcapDivisor)) {
        Factor = 0;
        Wall = true;
    } else if (cap > 0 && gameResource.level >= cap) {
        Factor = 0;
        Wall = true;
    }
    if (gameResource.level < 2 && getPageSetting('Ralways2')) {
        Factor = 999 - gameResource.prestige;
    }
    return {
        Stat: equip.Stat,
        Factor: Factor,
        StatusBorder: StatusBorder,
        Wall: Wall,
        Cost: Cost
    };
}

let RresourcesNeeded: any;
let RBest: any;
let RpreBuyAmt2: any = 1;
let RpreBuyFiring2: any = 1;
let RpreBuyTooltip2: any = false;
let RpreBuymaxSplit2: any = 1;
let RpreBuyCustomFirst2: any = 1;
let RpreBuyCustomLast2: any = 1;

export function RpreBuy3() {
    RpreBuyAmt2 = game.global.buyAmt;
    RpreBuyFiring2 = game.global.firing;
    RpreBuyTooltip2 = game.global.lockTooltip;
    RpreBuymaxSplit2 = game.global.maxSplit;
    RpreBuyCustomFirst2 = game.global.firstCustomAmt;
    RpreBuyCustomLast2 = game.global.lastCustomAmt;
}

export function RpostBuy3() {
    game.global.buyAmt = RpreBuyAmt2;
    game.global.firing = RpreBuyFiring2;
    game.global.lockTooltip = RpreBuyTooltip2;
    game.global.maxSplit = RpreBuymaxSplit2;
    game.global.firstCustomAmt = RpreBuyCustomFirst2;
    game.global.lastCustomAmt = RpreBuyCustomLast2;
}

export function RautoLevelEquipment() {
    const Rgearamounttobuy = (getPageSetting('Rgearamounttobuy') > 0) ? getPageSetting('Rgearamounttobuy') : 1;

    if (RcalcOurDmg("avg", false, true) <= 0) return;
    RresourcesNeeded = {
        "food": 0,
        "wood": 0,
        "metal": 0,
        "science": 0,
        "gems": 0
    };
    RBest = {};
    const keys = ['healthwood', 'healthmetal', 'attackmetal'];
    for (let i = 0; i < keys.length; i++) {
        RBest[keys[i]] = {
            Factor: 0,
            Name: '',
            Wall: false,
            StatusBorder: 'white',
            Cost: 0
        };
    }
    const enemyDamage = RcalcBadGuyDmg(null, RgetEnemyMaxAttack(game.global.world, 50, 'Snimp', 1.0));
    const enoughDamageCutoff = getPageSetting("Rdmgcuntoff");
    const numHits = getPageSetting('Rhitssurvived');
    const enoughHealthE = (RcalcOurHealth(true) > numHits * enemyDamage);
    const enoughDamageE = (RcalcHDratio() <= enoughDamageCutoff);

    for (const equipName in RequipmentList) {
        const equip = RequipmentList[equipName];
        const gameResource = game.equipment[equipName];
        if (!gameResource.locked) {
            const $equipName = document.getElementById(equipName)!;
            $equipName.style.color = 'white';
            const evaluation = RevaluateEquipmentEfficiency(equipName);
            const BKey = equip.Stat + equip.Resource;

            if (RBest[BKey].Factor === 0 || RBest[BKey].Factor < evaluation.Factor) {
                RBest[BKey].Factor = evaluation.Factor;
                RBest[BKey].Name = equipName;
                RBest[BKey].Wall = evaluation.Wall;
                RBest[BKey].StatusBorder = evaluation.StatusBorder;
            }
            RBest[BKey].Cost = evaluation.Cost;
            RresourcesNeeded[equip.Resource] += RBest[BKey].Cost;

            if (evaluation.Wall)
                $equipName.style.color = 'yellow';
            $equipName.style.border = '1px solid ' + evaluation.StatusBorder;

            const $equipUpgrade = document.getElementById(equip.Upgrade);
            if (evaluation.StatusBorder !== 'white' && evaluation.StatusBorder !== 'yellow' && $equipUpgrade)
                $equipUpgrade.style.color = evaluation.StatusBorder;
            if (evaluation.StatusBorder === 'yellow' && $equipUpgrade)
                $equipUpgrade.style.color = 'white';
            if (evaluation.StatusBorder === 'red') {
                const BuyWeaponUpgrades = ((getPageSetting('RBuyWeaponsNew') == 1) || (getPageSetting('RBuyWeaponsNew') == 2));
                const BuyArmorUpgrades = ((getPageSetting('RBuyArmorNew') == 1) || (getPageSetting('RBuyArmorNew') == 2));
                const DelayArmorWhenNeeded = getPageSetting('RDelayArmorWhenNeeded');

                if (
                    (BuyWeaponUpgrades && RequipmentList[equipName].Stat === 'attack') ||
                    (BuyArmorUpgrades && RequipmentList[equipName].Stat === 'health' &&
                        (
                            (DelayArmorWhenNeeded && !shouldFarm) ||
                            (DelayArmorWhenNeeded && enoughDamageE) ||
                            (DelayArmorWhenNeeded && !enoughDamageE && !enoughHealthE) ||
                            (DelayArmorWhenNeeded && RequipmentList[equipName].Resource === 'wood') ||
                            (!DelayArmorWhenNeeded)
                        )
                    )
                )

                {
                    const upgrade = RequipmentList[equipName].Upgrade;
                    debug('Upgrading ' + upgrade + " - Prestige " + game.equipment[equipName].prestige, "equips", '*upload');
                    buyUpgrade(upgrade, true, true);
                } else {
                    $equipName.style.color = 'orange';
                    $equipName.style.border = '2px solid orange';
                }
            }
        }
    }

    const BuyWeaponLevels = ((getPageSetting('RBuyWeaponsNew') == 1) || (getPageSetting('RBuyWeaponsNew') == 3));
    const BuyArmorLevels = ((getPageSetting('RBuyArmorNew') == 1) || (getPageSetting('RBuyArmorNew') == 3));
    RpreBuy3();
    for (const stat in RBest) {
        const eqName = RBest[stat].Name;
        if (eqName !== '') {
            const $eqName = document.getElementById(eqName)!;
            const DaThing = RequipmentList[eqName];
            $eqName.style.color = RBest[stat].Wall ? 'orange' : 'red';
            $eqName.style.border = '2px solid red';
            const maxmap = getPageSetting('RMaxMapBonusAfterZone') && RdoMaxMapBonus;
            if (BuyArmorLevels && DaThing.Stat === 'health' && (!enoughHealthE || maxmap)) {
                game.global.buyAmt = Rgearamounttobuy
                if (smithylogic(eqName, 'metal', true) && DaThing.Equip && !RBest[stat].Wall && canAffordBuilding(eqName, null, null, true)) {
                    debug('Leveling equipment ' + eqName, "equips", '*upload3');
                    buyEquipment(eqName, null, true);
                }
            }
            const aalvl2 = getPageSetting('Ralways2');
            if (BuyArmorLevels && (DaThing.Stat === 'health') && aalvl2 && game.equipment[eqName].level < 2) {
                game.global.buyAmt = 1;
                if (smithylogic(eqName, 'metal', true) && DaThing.Equip && !RBest[stat].Wall && canAffordBuilding(eqName, null, null, true)) {
                    debug('Leveling equipment ' + eqName + " (AlwaysLvl2)", "equips", '*upload3');
                    buyEquipment(eqName, null, true);
                }
            }
            if (BuyWeaponLevels && DaThing.Stat === 'attack' && (!enoughDamageE || enoughHealthE || maxmap)) {
                game.global.buyAmt = Rgearamounttobuy
                if (smithylogic(eqName, 'metal', true) && DaThing.Equip && !RBest[stat].Wall && canAffordBuilding(eqName, null, null, true)) {
                    debug('Leveling equipment ' + eqName, "equips", '*upload3');
                    buyEquipment(eqName, null, true);
                }
            }
        }
    }
    RpostBuy3();
}

export function RareWeAttackLevelCapped() {
    const attackEvals: any[] = [];
    for (const equipName in RequipmentList) {
        const equip = RequipmentList[equipName];
        const gameResource = equip.Equip ? game.equipment[equipName] : game.buildings[equipName];
        if (!gameResource.locked) {
            const evaluation = RevaluateEquipmentEfficiency(equipName);
            if (evaluation.Stat === "attack") attackEvals.push(evaluation);
        }
    }
    return attackEvals.every((e) => e.Factor === 0 && e.Wall === true);
}

export function Rgetequips(map: any, special: any) { //(level, p b or false)
    let specialCount = 0;
    const prestigeArray = [];
    const unlocksObj = game.mapUnlocks;
    // The `special` param is polymorphic ('p' | 'b' | false) → KEEP these compares LOOSE.
    let Rlocation;
    if (special == 'p' || special == false) {
        Rlocation = "Plentiful";
    }
    if (special == 'b') {
        Rlocation = "Bionic";
    }
    const world = map;
    let canLast = 1;
    const prestigeItemsAvailable = [];
    for (const item in unlocksObj) {
        // inner `special` shadows the param — here it is the unlock object (typed fields → strict).
        const special = unlocksObj[item];
	if (!special.prestige) continue;
        if (special.locked) continue;
        if (game.global.universe === 2 && special.blockU2) continue;
        if (game.global.universe === 1 && special.blockU1) continue;
        if (special.brokenPlanet && ((special.brokenPlanet === 1 && !game.global.brokenPlanet) || special.brokenPlanet === -1 && game.global.brokenPlanet)) continue;
        if (special.startAt < 0) continue;
        if (special.lastAt < game.global.world) continue;
        if ((special.filterUpgrade)) {
            const mapConfigLoc = game.mapConfig.locations[Rlocation as any];
            if (typeof mapConfigLoc.upgrade === 'object') {
                let usable = false;
                for (let x = 0; x < mapConfigLoc.upgrade.length; x++) {
                    if (mapConfigLoc.upgrade[x] !== item) continue;
                    usable = true;
                    break;
                }
                if (!usable) continue;
            } else if (mapConfigLoc.upgrade !== item) continue;
        }
        if ((special.level === "last" && canLast > 0 && special.world <= world && (special.canRunOnce || special.canRunWhenever))) {
            if (canLast === 2 && !special.prestige) continue;
            if (typeof special.specialFilter !== 'undefined') {
                if (!special.specialFilter(world)) continue;
            }
            if (special.startAt > world) continue;
            specialCount++;
            continue;
        }

        if (special.world !== world && special.world > 0) continue;
        if ((special.world === -2) && ((world % 2) !== 0)) continue;
        if ((special.world === -3) && ((world % 2) !== 1)) continue;
        if ((special.world === -5) && ((world % 5) !== 0)) continue;
        if ((special.world === -33) && ((world % 3) !== 0)) continue;
        if ((special.world === -10) && ((world % 10) !== 0)) continue;
        if ((special.world === -20) && ((world % 20) !== 0)) continue;
        if ((special.world === -25) && ((world % 25) !== 0)) continue;
        if (typeof special.specialFilter !== 'undefined') {
            if (!special.specialFilter(world)) continue;
        }
        if ((typeof special.startAt !== 'undefined') && (special.startAt > world)) continue;
        if (typeof special.canRunOnce === 'undefined' && (special.level === "last") && canLast > 0 && (special.last <= (world - 5))) {
            specialCount += Math.floor((world - special.last) / 5);
            continue;
        }
        if (special.level === "last") continue;
        if (special.canRunOnce === true) {
            specialCount++;
            continue;
        } else if (special.addToCount) specialCount++;
    }
    return specialCount;
}

//Shol Territory

export function mostEfficientEquipment(fakeLevels: Record<string, any> = {}) {

    for (const i in RequipmentList) {
        if (typeof fakeLevels[i] === 'undefined') {
            fakeLevels[i] = 0;
        }
    }

    const mostEfficient = [
    {
        name: "",
        statPerResource: -Infinity,
    },
    {
        name: "",
        statPerResource: -Infinity,
    }
    ];

    let artBoost = Math.pow(1 - game.portal.Artisanistry.modifier, game.portal.Artisanistry.radLevel);
    artBoost *= autoBattle.oneTimers.Artisan.owned ? autoBattle.oneTimers.Artisan.getMult() : 1;
    if (game.global.challengeActive === "Pandemonium") artBoost *= game.challenges.Pandemonium.getEnemyMult();

    for (const i in RequipmentList) {
        const nextLevelCost = game.equipment[i].cost[RequipmentList[i].Resource][0] * Math.pow(game.equipment[i].cost[RequipmentList[i].Resource][1], game.equipment[i].level + fakeLevels[i]) * artBoost;
        if (game.global.challengeActive === "Pandemonium" && game.challenges.Pandemonium.isEquipBlocked(i)) {
            continue;
        }

        const nextLevelValue = game.equipment[i][RequipmentList[i].Stat + "Calculated"];

        const isAttack = (RequipmentList[i].Stat === 'attack' ? 0 : 1);

        const safeRatio = Math.log(nextLevelValue + 1) / Math.log(nextLevelCost + 1);
        if (safeRatio > mostEfficient[isAttack].statPerResource) {
            mostEfficient[isAttack].name = i;
            mostEfficient[isAttack].statPerResource = safeRatio;
        }

    }

    return [mostEfficient[0].name, mostEfficient[1].name];

}

export function Requipcalc(capattack: any, caphealth: any, level2: any, zonego: any, attack: any, health: any, name: any, resource: any, stat: any, source: any, amount: any, percent: any) {

    // stat is an 'a'|'h' param + level is a number → strict; the `mostEfficientStuff != undefined`
    // guard stays LOOSE (also catches null; mostEfficientEquipment always returns an array anyway).
    if (canAffordBuilding(name, null, null, true, false, amount) && smithylogic(name, resource, true) &&
        (
	 (stat === 'a' && game.equipment[name].level < capattack) ||
         (stat === 'h' && game.equipment[name].level < caphealth)
	) &&
        (
         (level2 && game.equipment[name].level === 1) ||
         (zonego) ||
         (Rgetequipcost(name, resource, amount) <= (percent * source)) ||
         ((stat === 'a' && !attack) || (stat === 'h' && !health))
	)
    ) {
        RpreBuy3();

        if (level2 && game.equipment[name].level === 1) {
            buyEquipment(name, null, true, 1);
        }

	const mostEfficientStuff = mostEfficientEquipment();

	if (mostEfficientStuff != undefined) {
            buyEquipment(mostEfficientStuff[0], null, true, amount);
            buyEquipment(mostEfficientStuff[1], null, true, amount);
	}

        RpostBuy3();
    }
}

export function getMaxAffordable(baseCost: any, totalResource: any, costScaling: any, isCompounding: any) {

    if (!isCompounding) {
        return Math.floor(
            (costScaling - (2 * baseCost) + Math.sqrt(Math.pow(2 * baseCost - costScaling, 2) + (8 * costScaling * totalResource))) / 2
        );
    } else {
        return Math.floor(Math.log(1 - (1 - costScaling) * totalResource / baseCost) / Math.log(costScaling));
    }
}

export function buyPrestigeMaybe(equipName: string) {

    if (game.global.challengeActive === "Pandemonium" && game.challenges.Pandemonium.isEquipBlocked(equipName)) {
            return false;
    }

    const equipment = game.equipment[equipName];
    const resource = (equipName === "Shield") ? 'wood' : 'metal'
    const equipStat = (typeof equipment.attack !== 'undefined') ? 'attack' : 'health';

    let artBoost = Math.pow(1 - game.portal.Artisanistry.modifier, game.portal.Artisanistry.radLevel);
    artBoost *= autoBattle.oneTimers.Artisan.owned ? autoBattle.oneTimers.Artisan.getMult() : 1;
    if (game.global.challengeActive === "Pandemonium") artBoost *= game.challenges.Pandemonium.getEnemyMult();

    let prestigeUpgradeName = "";
    const allUpgradeNames = Object.getOwnPropertyNames(game.upgrades);
    for (const upgrade of allUpgradeNames) {
        if (game.upgrades[upgrade].prestiges === equipName) {
            prestigeUpgradeName = upgrade;
            break;
        }
    }

    if (game.upgrades[prestigeUpgradeName].locked) return false;;

    if (game.upgrades[prestigeUpgradeName].cost.resources.science[0] *
        Math.pow(game.upgrades[prestigeUpgradeName].cost.resources.science[1], game.equipment[equipName].prestige - 1)
        > game.resources.science.owned) {
            return false;
    }

    if (game.upgrades[prestigeUpgradeName].cost.resources.gems[0] *
        Math.pow(game.upgrades[prestigeUpgradeName].cost.resources.gems[1], game.equipment[equipName].prestige - 1)
        > game.resources.gems.owned) {
            return false;
    }

    const levelOnePrestige = getNextPrestigeCost(prestigeUpgradeName) * artBoost;

    if (levelOnePrestige > game.resources[resource].owned) return false;

    const newLevel = Math.floor(getMaxAffordable(levelOnePrestige * 1.2,game.resources[resource].owned,1.2,true)) + 1;

    const newStatValue = (newLevel) * Math.round(equipment[equipStat] * Math.pow(1.19, ((equipment.prestige + 1) * game.global.prestige[equipStat]) + 1));
    const currentStatValue = equipment.level * equipment[equipStat + 'Calculated'];

    return newStatValue > currentStatValue 
    
}

export function RautoEquip() {

    if (!getPageSetting('Requipon')) return;

    let prestigeLeft = false;
    do {
        prestigeLeft = false;
        for (const equipName in game.equipment) {
            if (buyPrestigeMaybe(equipName)) {
              if(!game.equipment[equipName].locked) {
                if (buyUpgrade(RequipmentList[equipName].Upgrade, true, true)) {
                    prestigeLeft = true;
                }
              }
            }
        }
    } while (prestigeLeft)

    // Gather settings
    const alwaysLvl2 = getPageSetting('Requip2');
    const attackEquipCap = ((getPageSetting('Requipcapattack') <= 0) ? Infinity : getPageSetting('Requipcapattack'));
    const healthEquipCap = ((getPageSetting('Requipcaphealth') <= 0) ? Infinity : getPageSetting('Requipcaphealth'));
    const zoneGo = game.global.world >= getPageSetting('Requipzone');
    const resourceMaxPercent = getPageSetting('Requippercent') / 100;

    // Always 2 — challengeActive is a string → strict; equipName from bestBuys is a string → strict.
    if (alwaysLvl2 && game.global.challengeActive !== 'Pandemonium') {
        for (const equip in game.equipment) {
            if (game.equipment[equip].level < 2) {
                buyEquipment(equip, null, true, 1);
            }
        }
    }

    // Loop through actually getting equips
    let keepBuying = false;
    do {
        keepBuying = false;
        const bestBuys = mostEfficientEquipment();

        // Set up for attack (the original's redundant `resourceUsed = resourceUsed = …` self-assign
        // dropped — behaviour-identical, and a `let` self-init would hit the TDZ).
        let equipName = bestBuys[0];
        let resourceUsed: any = (equipName === 'Shield') ? 'wood' : 'metal';
        let equipCap = attackEquipCap;
        let underStats = RcalcHDratio() >= getPageSetting('Rdmgcuntoff');

        for (let i = 0; i < 2; i++){
            if (canAffordBuilding(equipName, null, null, true, false, 1)) {
                if (smithylogic(equipName,resourceUsed,true)) {
                    if (game.equipment[equipName].level < equipCap) {
                        // Check any of the overrides
                        if (
                            zoneGo ||
                            underStats ||
                            Rgetequipcost(equipName, resourceUsed, 1) <= resourceMaxPercent * game.resources[resourceUsed].owned
                        ) {
			    if (game.global.challengeActive === "Hypothermia" && equipName === 'Shield' && !Rhyposhouldwood) return;
                            else if (!game.equipment[equipName].locked) {
                                if (buyEquipment(equipName, null, true, 1)){
                                keepBuying = true;
                            }
}
                        }
                    }
                }
            }

            // Set up for Health
            equipName = bestBuys[1];
            resourceUsed = (equipName === 'Shield') ? 'wood' : 'metal';
            equipCap = healthEquipCap;
            underStats = RcalcOurHealth(true) < getPageSetting('Rhitssurvived') * RcalcBadGuyDmg(null, RgetEnemyMaxAttack(game.global.world, 50, 'Snimp', 1.0));

        }

    } while (keepBuying)

}

export function getTotalMultiCost(baseCost: any, multiBuyCount: any, costScaling: any, isCompounding: any) {
    if (!isCompounding) {
        return multiBuyCount * (multiBuyCount * costScaling - costScaling + 2 * baseCost) / 2;
    } else {
        return baseCost * ((1 - Math.pow(costScaling, multiBuyCount)) / (1 - costScaling));
    }
}

export function equipfarmdynamicHD() {
    let equipfarmzone = 0;
    let equipfarmHD = 0;
    let equipfarmmult = 0;
    let equipfarmHDzone = 0;
    let equipfarmHDmult = RcalcHDratio() - 1;
    // getPageSetting('Requipfarmon') == true stays LOOSE (polymorphic); the `>= (…&&…)` boolean-vs-number
    // guard is a preserved faithful-port oddity. equipfarmHDzone is a number → strict compare.
    if (getPageSetting('Requipfarmon') == true && game.global.world > 5 && game.global.world >= (getPageSetting('Requipfarmzone') && getPageSetting('RequipfarmHD') > 0 && getPageSetting('Requipfarmmult') > 0)) {
        equipfarmzone = getPageSetting('Requipfarmzone');
        equipfarmHD = getPageSetting('RequipfarmHD');
        equipfarmmult = getPageSetting('Requipfarmmult');
	equipfarmHDzone = (game.global.world - equipfarmzone);
	equipfarmHDmult = (equipfarmHDzone === 0) ? equipfarmHD : Math.pow(equipfarmmult, equipfarmHDzone) * equipfarmHD;
    }
    return equipfarmHDmult;
}
	
export function estimateEquipsForZone() {
    let artBoost = Math.pow(1 - game.portal.Artisanistry.modifier, game.portal.Artisanistry.radLevel);
	artBoost *= autoBattle.oneTimers.Artisan.owned ? autoBattle.oneTimers.Artisan.getMult() : 1;
	if (game.global.challengeActive === "Pandemonium") artBoost *= game.challenges.Pandemonium.getEnemyMult();
    const MAX_EQUIP_DELTA = 700;

    // calculate stats needed pass zone
    const enemyDamageBeforeEquality = RcalcBadGuyDmg(null, RgetEnemyMaxAttack(game.global.world, 100, 'Improbability'), true); //game.global.getEnemyAttack(100, 'Snimp', true);
    const ourHealth = RcalcOurHealth();
    const hits = (getPageSetting("Rhitssurvived") > 0) ? getPageSetting("Rhitssurvived") : 1;

    let healthNeededMulti = (enemyDamageBeforeEquality * hits) / ourHealth; // The multiplier we need to apply to our health to survive

    // Get a fake ratio pretending that we don't have any equality in.
    const fakeHDRatio = RgetEnemyMaxHealth(game.global.world, 100) / (RcalcOurDmg('avg', true)); // game.global.getEnemyHealth(100, 'Snimp', true)
    let attackNeededMulti = fakeHDRatio / (game.global.mapBonus < 10 ? (equipfarmdynamicHD() * 5) : equipfarmdynamicHD());

    //console.log("Health needed no equality: " + healthNeededMulti);
    //console.log("Attack Needed no equality: " + attackNeededMulti);

    // Something something figure out equality vs health farming
    let tempEqualityUse = 0;
    while (
        (healthNeededMulti > 1 || attackNeededMulti > 1)  // If it's below 1 we don't actually need more
            &&
        (healthNeededMulti * game.portal.Equality.modifier > attackNeededMulti / game.portal.Equality.modifier) // Need more health proportionally
            &&
        tempEqualityUse < game.portal.Equality.radLevel
    ) {
        tempEqualityUse++;
        healthNeededMulti *= game.portal.Equality.modifier;
        attackNeededMulti /= game.portal.Equality.modifier;
    }

    if (healthNeededMulti < 1 && attackNeededMulti < 1) {return [0, {}]};

    let ourAttack = 6;
    for(const i in RequipmentList){
        if(game.equipment[i].locked !== 0) continue;
        const attackBonus = game.equipment[i].attackCalculated;
        const level       = game.equipment[i].level;
        ourAttack += (attackBonus !== undefined ? attackBonus : 0)*level;
    }

    // Amount of stats needed directly from equipment
    let attackNeeded = ourAttack * attackNeededMulti;
    let healthNeeded = ourHealth * healthNeededMulti / (getTotalHealthMod() * game.resources.trimps.maxSoldiers);

    const bonusLevels: Record<string, any> = {}; // How many levels you'll be getting in each shield-gambeson armor slots

    while (healthNeeded > 0) {
        const bestArmor = mostEfficientEquipment(bonusLevels)[1];
        healthNeeded -= game.equipment[bestArmor][RequipmentList[bestArmor].Stat + "Calculated"];
        if (typeof bonusLevels[bestArmor] === 'undefined') {
            bonusLevels[bestArmor] = 0;
        }
        if (bonusLevels[bestArmor]++ > MAX_EQUIP_DELTA) {
            return [Infinity, bonusLevels];
        }
    }
    while (attackNeeded > 0) {
        const bestWeapon = mostEfficientEquipment(bonusLevels)[0];
        attackNeeded -= game.equipment[bestWeapon][RequipmentList[bestWeapon].Stat + "Calculated"];
        if (typeof bonusLevels[bestWeapon] === 'undefined') {
            bonusLevels[bestWeapon] = 0;
        }
        if (bonusLevels[bestWeapon]++ >= MAX_EQUIP_DELTA) {
            return [Infinity, bonusLevels];
        }
    }

    let totalCost = 0;
    for (const equip in bonusLevels) {
        const equipCost = game.equipment[equip].cost[RequipmentList[equip].Resource];
        totalCost += getTotalMultiCost(equipCost[0],bonusLevels[equip],equipCost[1],true) * artBoost;
    }

    return [totalCost, bonusLevels, tempEqualityUse];
    
}
