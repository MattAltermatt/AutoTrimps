// TRUE TS (Phase 1 · #31): converted from the faithful port under strict.
// IDIOMATIC (Phase 2 · #51): the 11 minified query helpers were un-minified behind the
//   proof-net (tests/query.characterization.test.ts pins every branch; L0 backstop ∅). Behavior-
//   preserving — quirks kept deliberately: the Meditation `.toFixed(2)` string-coercion, the loose
//   `== undefined` in getScienceCostToUpgrade, the preMapsActive-only undefined return in
//   getCurrentEnemy. See #52 for the U1-vs-R map-bonus asymmetry (parity question, NOT changed here).
// Was: relocated verbatim from legacy/modules/query.js.
// Per-second/cost query helpers + setScienceNeeded. No converted deps; RscienceNeeded/scienceNeeded
// resolve to the AutoTrimps2.js globals (read cross-module by gather/jobs). game/DOM/legacy globals
// resolve via the ambient seam.

export function getPerSecBeforeManual(a: string): number {
    let b = 0;
    const c = game.jobs[a].increase;
    if (c === 'custom') return 0;
    if (game.jobs[a].owned > 0) {
        b = game.jobs[a].owned * game.jobs[a].modifier;
        if (game.portal.Motivation.level > 0)
            b += b * game.portal.Motivation.level * game.portal.Motivation.modifier;
        if (game.portal.Motivation_II.level > 0)
            b *= 1 + game.portal.Motivation_II.level * game.portal.Motivation_II.modifier;
        if (game.portal.Meditation.level > 0)
            b *= (1 + 0.01 * game.portal.Meditation.getBonusPercent()).toFixed(2) as any;
        if (game.jobs.Magmamancer.owned > 0 && c === 'metal')
            b *= game.jobs.Magmamancer.getBonusPercent();
        if (game.global.challengeActive === 'Meditate') b *= 1.25;
        else if (game.global.challengeActive === 'Size') b *= 1.5;
        if (game.global.challengeActive === 'Toxicity') {
            const d = (game.challenges.Toxicity.lootMult * game.challenges.Toxicity.stacks) / 100;
            b *= 1 + d;
        }
        if (game.global.challengeActive === 'Balance') b *= game.challenges.Balance.getGatherMult();
        if (game.global.challengeActive === 'Decay') {
            b *= 10;
            b *= Math.pow(0.995, game.challenges.Decay.stacks);
        }
        if (game.global.challengeActive === 'Daily') {
            if (typeof game.global.dailyChallenge.dedication !== 'undefined')
                b *= dailyModifiers.dedication.getMult(game.global.dailyChallenge.dedication.strength);
            if (
                typeof game.global.dailyChallenge.famine !== 'undefined' &&
                c !== 'fragments' &&
                c !== 'science'
            )
                b *= dailyModifiers.famine.getMult(game.global.dailyChallenge.famine.strength);
        }
        if (game.global.challengeActive === 'Watch') b /= 2;
        if (game.global.challengeActive === 'Lead' && game.global.world % 2 === 1) b *= 2;
        b = calcHeirloomBonus('Staff', a + 'Speed', b);
    }
    return b;
}
export function getScienceCostToUpgrade(a: string) {
    const science = game.upgrades[a].cost.resources.science;
    if (science !== undefined && science[0] !== undefined)
        return Math.floor(science[0] * Math.pow(science[1], game.upgrades[a].done));
    // loose `== undefined` preserved: also matches a null scalar cost
    if (science !== undefined && science[0] == undefined) return science;
    return 0;
}
export function getEnemyMaxAttack(a: number, b: number, c: string, d?: number, e?: boolean) {
    let f = 0;
    f += 50 * Math.sqrt(a) * Math.pow(3.27, a / 2);
    f -= 10;
    if (a === 1) {
        f *= 0.35;
        f = 0.2 * f + 0.75 * f * (b / 100);
    } else if (a === 2) {
        f *= 0.5;
        f = 0.32 * f + 0.68 * f * (b / 100);
    } else if (a < 60) {
        f = 0.375 * f + 0.7 * f * (b / 100);
    } else {
        f = 0.4 * f + 0.9 * f * (b / 100);
        f *= Math.pow(1.15, a - 59);
    }
    if (a < 60) f *= 0.85;
    if (d) f *= d;
    f *= e ? getCorruptScale('attack')! : game.badGuys[c].attack;
    return Math.floor(f);
}
export function getEnemyMaxHealth(a: number, b?: number, c?: boolean) {
    if (!b) b = 30;
    let d = 0;
    d += 130 * Math.sqrt(a) * Math.pow(3.265, a / 2);
    d -= 110;
    if (a === 1 || (a === 2 && b < 10)) {
        d *= 0.6;
        d = 0.25 * d + 0.72 * d * (b / 100);
    } else if (a < 60) {
        d = 0.4 * d + 0.4 * d * (b / 110);
    } else {
        d = 0.5 * d + 0.8 * d * (b / 100);
        d *= Math.pow(1.1, a - 59);
    }
    if (a < 60) d *= 0.75;
    d *= c ? getCorruptScale('health')! : game.badGuys.Grimp.health;
    return Math.floor(d);
}
export function getCurrentEnemy(a?: number) {
    if (!a) a = 1;
    let b;
    if (game.global.mapsActive || game.global.preMapsActive) {
        // faithful: when preMapsActive (and not mapsActive) the inner guard is false, so b stays undefined
        if (game.global.mapsActive && !game.global.preMapsActive) {
            b =
                typeof game.global.mapGridArray[game.global.lastClearedMapCell + a] === 'undefined'
                    ? game.global.mapGridArray[game.global.gridArray.length - 1]
                    : game.global.mapGridArray[game.global.lastClearedMapCell + a];
        }
    } else {
        b =
            typeof game.global.gridArray[game.global.lastClearedCell + a] === 'undefined'
                ? game.global.gridArray[game.global.gridArray.length - 1]
                : game.global.gridArray[game.global.lastClearedCell + a];
    }
    return b;
}
export function getCorruptedCellsNum(): number {
    let b = 0;
    for (let c = 0; c < game.global.gridArray.length - 1; c++) {
        const a = game.global.gridArray[c];
        if (a.mutation === 'Corruption') b++;
    }
    return b;
}
export function getCorruptScale(a: string) {
    if (a === 'attack') return mutations.Corruption.statScale(3);
    if (a === 'health') return mutations.Corruption.statScale(10);
    return undefined;
}
export function isBuildingInQueue(a: string) {
    for (const c in game.global.buildingsQueue)
        if (game.global.buildingsQueue[c].includes(a)) return true;
    return undefined;
}
export function setScienceNeeded() {
    scienceNeeded = 0;
    for (let a in upgradeList) {
        a = upgradeList[a];
        if (game.upgrades[a].allowed > game.upgrades[a].done) {
            if (game.global.world === 1 && game.global.totalHeliumEarned <= 1000 && a.startsWith('Speed'))
                continue;
            scienceNeeded += getScienceCostToUpgrade(a);
        }
    }
    // Gymystic is not in upgradeList, so it needs its own check. #63: this used to read the loader
    // global `needGymystic`, which is hardcoded true and never reset — so Gymystic's flat 5,000,000
    // science cost was added forever, even when it is locked and unbuyable. Live check instead, the
    // same predicate buildings.ts uses to gate the Gym buy.
    if (game.upgrades.Gymystic.allowed > game.upgrades.Gymystic.done)
        scienceNeeded += getScienceCostToUpgrade('Gymystic');
}
export function RsetScienceNeeded() {
    RscienceNeeded = 0;
    for (let a in RupgradeList) {
        a = RupgradeList[a];
        if (game.upgrades[a].allowed > game.upgrades[a].done) {
            if (game.global.world === 1 && game.global.totalRadonEarned <= 1000 && a.startsWith('Speed'))
                continue;
            RscienceNeeded += getScienceCostToUpgrade(a);
        }
    }
}
export function RgetEnemyMaxAttack(world: number, level: number, name: string) {
    const attackBase = game.global.universe === 2 ? 750 : 50;
    let amt = 0;
    amt += attackBase * Math.sqrt(world) * Math.pow(3.27, world / 2);
    amt -= 10;
    if (world === 1) {
        amt *= 0.35;
        amt = amt * 0.2 + amt * 0.75 * (level / 100);
    } else if (world === 2) {
        amt *= 0.5;
        amt = amt * 0.32 + amt * 0.68 * (level / 100);
    } else if (world < 60) {
        amt = amt * 0.375 + amt * 0.7 * (level / 100);
    } else {
        amt = amt * 0.4 + amt * 0.9 * (level / 100);
        amt *= Math.pow(1.15, world - 59);
    }
    if (world < 60) amt *= 0.85;
    if (world > 6 && game.global.mapsActive) amt *= 1.1;
    amt *= game.badGuys[name].attack;
    if (game.global.universe === 2) {
        const part1 = world > 40 ? 40 : world;
        let part2 = world > 60 ? 20 : world - 40;
        let part3 = world - 60;
        if (part2 < 0) part2 = 0;
        if (part3 < 0) part3 = 0;
        amt *= Math.pow(1.5, part1);
        amt *= Math.pow(1.4, part2);
        amt *= Math.pow(1.32, part3);
        // Parity fix (#22): mirror the game's z300 hard-scaling (getEnemyAttack, config.js).
        let part4 = world - 300;
        if (part4 < 0) part4 = 0;
        amt *= Math.pow(1.15, part4);
    }
    return Math.floor(amt);
}

export function RgetEnemyMaxHealth(world: number, level?: number) {
    if (!level) level = 30;
    const healthBase = game.global.universe === 2 ? 10e7 : 130;
    let amt = 0;
    amt += healthBase * Math.sqrt(world) * Math.pow(3.265, world / 2);
    amt -= 110;
    if (world === 1 || (world === 2 && level < 10)) {
        amt *= 0.6;
        amt = amt * 0.25 + amt * 0.72 * (level / 100);
    } else if (world < 60) {
        amt = amt * 0.4 + amt * 0.4 * (level / 110);
    } else {
        amt = amt * 0.5 + amt * 0.8 * (level / 100);
        amt *= Math.pow(1.1, world - 59);
    }
    if (world < 60) amt *= 0.75;
    if (world > 5 && game.global.mapsActive) amt *= 1.1;
    amt *= game.badGuys['Grimp'].health;
    if (game.global.universe === 2) {
        const part1 = world > 60 ? 60 : world;
        let part2 = world - 60;
        if (part2 < 0) part2 = 0;
        amt *= Math.pow(1.4, part1);
        amt *= Math.pow(1.32, part2);
        // Parity fix (#22): mirror the game's z300 hard-scaling (getEnemyHealth, config.js).
        let part3 = world - 300;
        if (part3 < 0) part3 = 0;
        amt *= Math.pow(1.15, part3);
    }
    return Math.floor(amt);
}
export function getPotencyMod(howManyMoreGenes?: number) {
    let potencyMod = game.resources.trimps.potency;
    //Add potency (book)
    if (game.upgrades.Potency.done > 0) potencyMod *= Math.pow(1.1, game.upgrades.Potency.done);
    //Add Nurseries
    if (game.buildings.Nursery.owned > 0) potencyMod *= Math.pow(1.01, game.buildings.Nursery.owned);
    //Add Venimp
    if (game.unlocks.impCount.Venimp > 0) potencyMod *= Math.pow(1.003, game.unlocks.impCount.Venimp);
    //Broken Planet
    if (game.global.brokenPlanet) potencyMod /= 10;
    //Pheromones
    potencyMod *= 1 + game.portal.Pheromones.level * game.portal.Pheromones.modifier;
    //Geneticist
    if (!howManyMoreGenes) howManyMoreGenes = 0;
    if (game.jobs.Geneticist.owned > 0)
        potencyMod *= Math.pow(0.98, game.jobs.Geneticist.owned + howManyMoreGenes);
    //Quick Trimps
    if (game.unlocks.quickTrimps) potencyMod *= 2;
    //Daily mods
    if (game.global.challengeActive === 'Daily') {
        if (typeof game.global.dailyChallenge.dysfunctional !== 'undefined') {
            potencyMod *= dailyModifiers.dysfunctional.getMult(game.global.dailyChallenge.dysfunctional.strength);
        }
        if (typeof game.global.dailyChallenge.toxic !== 'undefined') {
            potencyMod *= dailyModifiers.toxic.getMult(
                game.global.dailyChallenge.toxic.strength,
                game.global.dailyChallenge.toxic.stacks,
            );
        }
    }
    if (game.global.challengeActive === 'Toxicity' && game.challenges.Toxicity.stacks > 0) {
        potencyMod *= Math.pow(game.challenges.Toxicity.stackMult, game.challenges.Toxicity.stacks);
    }
    if (game.global.voidBuff === 'slowBreed') {
        potencyMod *= 0.2;
    }
    potencyMod = calcHeirloomBonus('Shield', 'breedSpeed', potencyMod);
    return potencyMod;
}

export function getArmyTime() {
    const breeding = game.resources.trimps.owned - trimpsEffectivelyEmployed();
    const adjustedMax = game.portal.Coordinated.level
        ? game.portal.Coordinated.currentSend
        : game.resources.trimps.maxSoldiers;
    const potencyMod = getPotencyMod();
    const tps = breeding * potencyMod;
    const addTime = adjustedMax / tps;
    return addTime;
}
