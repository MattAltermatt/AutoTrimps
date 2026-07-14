// TRUE TS (Phase 1 · #28): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/jobs.js.
// Job hire/fire, worker ratios, quest jobs (U1 + U2 radon R* family). Deeply game-coupled (174 game.* touches), @ts-nocheck. Module vars tierMagmamancers/reservedJobs are jobs-internal. No shared vars, no implicit globals, no collisions.
import { getPageSetting, getPageSettingAt, debug, setPageSetting } from './utils'
import { ratioFor } from './jobs-ratios'

MODULES["jobs"] = {};

//Helium

MODULES["jobs"].scientistRatio = 25;
MODULES["jobs"].scientistRatio2 = 10;
MODULES["jobs"].scientistRatio3 = 100;
MODULES["jobs"].magmamancerRatio = 0.1;
// Worker Ratios = [Farmer,Lumber,Miner]. #107 — the numbers now live in jobs-ratios.ts, which the
// BuyJobsNew tooltip renders from directly. Same values, published under the same keys the bot already
// reads; the point is that the tooltip and the allocator can no longer disagree about what they are.
MODULES["jobs"].autoRatio7 = ratioFor('autoRatio7');
MODULES["jobs"].autoRatio6 = ratioFor('autoRatio6');
MODULES["jobs"].autoRatio5 = ratioFor('autoRatio5');
MODULES["jobs"].autoRatio4 = ratioFor('autoRatio4');
MODULES["jobs"].autoRatio3 = ratioFor('autoRatio3');
MODULES["jobs"].autoRatio2 = ratioFor('autoRatio2');
MODULES["jobs"].autoRatio1 = ratioFor('autoRatio1');
// #88: was a bare `MODULES["jobs"].customRatio;` — the `= …` had been dropped, so the key never
// existed. `if (customRatio)` (the highest-priority branch of workerRatios) could never fire, AND
// exportModuleVars() builds its list from Object.keys(MODULES[mod]), so the feature was invisible in
// the export box too — unsettable by the only UI that could set it. `null` is falsy exactly as the
// missing key was, so no worker ratio changes; the key merely EXISTS now, which is the whole fix.
MODULES["jobs"].customRatio = null;

/**
 * #106 — resolve the scientist divisor `D` from a user-set PERCENTAGE, falling back to the legacy
 * divisor table when unset.
 *
 * WHY A PERCENTAGE AND NOT A DIVISOR. The scientist target reduces to `floor(TDW / D)` (the
 * `totalRatio` cancels — see buyJobs below), and scientists sit OUTSIDE the distributable pool, so
 * with pool `P = TDW + S` the fixed point is `S = P / (D + 1)`. Hence:
 *
 *      D = (100 - s) / s   yields exactly s% of the ratio-managed workforce.
 *
 * The legacy constants back-map cleanly, which is the check that this parameterisation is the right
 * one: D=25 -> 3.85% · D=10 -> 9.09% · D=100 -> 0.99%.
 *
 * WHY THIS SETTING HAS TO EXIST AT ALL: no fixed divisor can be correct. `game.global.playerModifier`
 * DOUBLES with every Speedbook while per-scientist output is flat within a run, so the divisor needed
 * for scientists to out-produce the player's own hands HALVES every Speedbook — spanning 7772 -> 0.47
 * inside a single run. A constant cannot track an exponential; 25 is right for about one Speedbook's
 * worth of the game. (Measured on a real save. It is also why "just retune the 25" is not merely
 * tuning-gated but impossible.)
 *
 * ⚠️ NOT A SPEEDUP, and nothing here may imply one: 8 seeds x 20k ticks on a real save put even
 * INFINITE free science at -5.1% against a +/-3.5% noise floor. This is a control, not a fix.
 *
 * @param pct   the raw setting value (`-1` = Auto)
 * @param legacy the divisor the pre-#106 table would have chosen
 */
export function scientistDivisor(pct: number, legacy: number): number {
    // GUARD 1 — non-finite means AUTO, never "zero scientists". `parseFloat('')`/`parseFloat('undefined')`
    // is NaN, and `NaN > 0` is false, so a naive `pct > 0` check would silently hire ZERO scientists
    // FOREVER on an empty box. That is #96 verbatim (a string default coercing to NaN and reading as a
    // legitimate "off"), and it is the single most likely way this setting could quietly destroy a run.
    if (!Number.isFinite(pct) || pct < 0) return legacy;
    // GUARD 2 — `s = 0` is a LEGITIMATE value meaning "hire no scientists". Infinity is the correct
    // divisor for it: floor(TDW / Infinity) === 0. It must not be confused with guard 1.
    if (pct === 0) return Infinity;
    // GUARD 3 — clamp. `s = 100` gives D = 0, and `floor(TDW / 0)` is Infinity: safeBuyJob('Scientist',
    // Infinity), and F/L/M go NaN. The bot is destroyed. 90% is the ceiling.
    const s = Math.min(pct, 90);
    return (100 - s) / s;
}

// Half the colony's max is reserved for workers; the rest breed. This "free worker slots" count —
// `ceil(realMax/2) - employed` — is read at nearly every hire/fire decision, so it lives here once.
function freeWorkerSlots(): number {
    return Math.ceil(game.resources.trimps.realMax() / 2) - game.resources.trimps.employed;
}

export function safeBuyJob(jobTitle: string, amount: number): boolean {
    if (!Number.isFinite(amount) || amount === 0 || typeof amount === 'undefined' || Number.isNaN(amount)) {
        return false;
    }
    let old = preBuy2();
    let freeWorkers = freeWorkerSlots();
    let result;
    if (amount < 0) {
        amount = Math.abs(amount);
        game.global.firing = true;
        game.global.buyAmt = amount;
        result = true;
    } else {
        game.global.firing = false;
        game.global.buyAmt = amount;
        result = canAffordJob(jobTitle, false) && freeWorkers > 0;
        if (!result) {
            game.global.buyAmt = 'Max';
            game.global.maxSplit = 1;
            result = canAffordJob(jobTitle, false) && freeWorkers > 0;
        }
    }
    if (result) {
        debug((game.global.firing ? 'Firing ' : 'Hiring ') + prettify(game.global.buyAmt) + ' ' + jobTitle + 's', "jobs", "*users");
        buyJob(jobTitle, true, true);
    }
    postBuy2(old);
    return true;
}

export function safeFireJob(job: string, amount?: number): number {
    let oldjob = game.jobs[job].owned;
    if (oldjob === 0 || amount === 0)
        return 0;
    let test = oldjob;
    let x = 1;
    if (amount != null)
        x = amount;
    if (!Number.isFinite(oldjob)) {
        while (oldjob === test) {
            test -= x;
            x *= 2;
        }
    }
    let old = preBuy2();
    game.global.firing = true;
    let freeWorkers = freeWorkerSlots();
    while (x >= 1 && freeWorkers === freeWorkerSlots()) {
        game.global.buyAmt = x;
        buyJob(job, true, true);
        x *= 2;
    }
    postBuy2(old);
    return x / 2;
}

export function buyJobs() {
    // #117 — "No F/L/M in C2". This setting had been createSetting'd, rendered, visibility-toggled and
    // saved to localStorage for years, and NOTHING read it: `getPageSetting('buynojobsc')` appeared
    // nowhere in src/ or legacy/. A control that accepts input and dispatches nothing is a lie told to
    // the user, so it is wired here rather than deleted.
    //
    // Meaning: during a Challenge² run you are pushing on gear you already have — Farmers, Lumberjacks
    // and Miners buy resources you do not need, at the cost of Trimps that could be breeding. With this
    // on, AT stops HIRING the three of them for the duration of the C2.
    //
    // It does NOT fire the ones you already have: firing is destructive and the label says "No ... in C2",
    // not "fire my workforce". Scientists/Trainers/Explorers/Magmamancers are untouched.
    //
    // U1 only, matching its visibility rule (settings-visibility.ts gates it on !radonon). Default OFF ⇒
    // an untouched install is byte-identical, which is what keeps the L0 traces still.
    const noJobsC2 = game.global.runningChallengeSquared && getPageSetting('buynojobsc') == true;

    let freeWorkers = freeWorkerSlots();
    let totalDistributableWorkers = freeWorkers + game.jobs.Farmer.owned + game.jobs.Miner.owned + game.jobs.Lumberjack.owned;
    let farmerRatio = parseFloat(getPageSetting('FarmerRatio'));
    let lumberjackRatio = parseFloat(getPageSetting('LumberjackRatio'));
    let minerRatio = parseFloat(getPageSetting('MinerRatio'));
    let totalRatio = farmerRatio + lumberjackRatio + minerRatio;
    // #106 — the legacy three-arm divisor table, unchanged. It remains the AUTO behaviour, and is what
    // scientistDivisor() falls back to when ScientistPercent is -1 (the default) — so an untouched
    // install is byte-identical.
    let legacyDivisor = MODULES["jobs"].scientistRatio;
    if (game.jobs.Farmer.owned < 100) {
        legacyDivisor = MODULES["jobs"].scientistRatio2;
    }
    if (game.global.world >= 300) {
        legacyDivisor = MODULES["jobs"].scientistRatio3;
    }
    let scientistRatio = totalRatio / scientistDivisor(getPageSetting('ScientistPercent'), legacyDivisor);

    if (game.global.world === 1 && game.global.totalHeliumEarned <= 5000) {
        if (game.resources.trimps.owned < game.resources.trimps.realMax() * 0.9) {
            if (game.resources.food.owned > 5 && freeWorkers > 0) {
                if (game.jobs.Farmer.owned === game.jobs.Lumberjack.owned)
                    safeBuyJob('Farmer', 1);
                else if (game.jobs.Farmer.owned > game.jobs.Lumberjack.owned && !game.jobs.Lumberjack.locked)
                    safeBuyJob('Lumberjack', 1);
            }
            freeWorkers = freeWorkerSlots();
            if (game.resources.food.owned > 20 && freeWorkers > 0) {
                if (game.jobs.Farmer.owned === game.jobs.Lumberjack.owned && !game.jobs.Miner.locked && challengeActive("Metal") === false)
                    safeBuyJob('Miner', 1);
            }
        }
        return;
    } else if (game.jobs.Farmer.owned === 0 && game.jobs.Lumberjack.locked && freeWorkers > 0) {
        safeBuyJob('Farmer', 1);
    // #106 — the bootstrap floor: hire 1 scientist/tick up to 10, ignoring the ratio entirely. It is why
    // the ratio arm is INERT on a small colony (measured: every corpus save lands on exactly 10 scientists
    // whatever the divisor), and it is what `MaxScientists = 0` has always existed to switch off.
    // `ScientistPercent = 0` must switch it off too, or the setting lies: it promises "hire no Scientists"
    // and would still deliver 10. Note `!= 0` is a LOOSE compare on purpose — a blank box parses to NaN,
    // and `NaN != 0` is true, so an unset value correctly leaves the bootstrap running.
    } else if (getPageSetting('MaxScientists') != 0 && getPageSetting('ScientistPercent') != 0 && game.jobs.Scientist.owned < 10 && scienceNeeded > 100 && freeWorkers > 0 && game.jobs.Farmer.owned >= 10) {
        safeBuyJob('Scientist', 1);
    }
    freeWorkers = freeWorkerSlots();
    totalDistributableWorkers = freeWorkers + game.jobs.Farmer.owned + game.jobs.Miner.owned + game.jobs.Lumberjack.owned;
    if (challengeActive("Watch")) {
        // #106 — Watch forces the generous 10-divisor arm. A user-set ScientistPercent overrides it too:
        // the setting means "I want s% scientists", and silently ignoring it during one challenge would
        // be the more surprising behaviour. At the default (-1) this is byte-identical to the old line.
        scientistRatio = totalRatio / scientistDivisor(getPageSetting('ScientistPercent'), MODULES["jobs"].scientistRatio2);
        if (game.resources.trimps.owned < game.resources.trimps.realMax() * 0.9 && !breedFire) {
            let buyScientists = Math.floor((scientistRatio / totalRatio * totalDistributableWorkers) - game.jobs.Scientist.owned);
            if (game.jobs.Scientist.owned < buyScientists && game.resources.trimps.owned > game.resources.trimps.realMax() * 0.1) {
                let toBuy = buyScientists - game.jobs.Scientist.owned;
                let canBuy = Math.floor(game.resources.trimps.owned - game.resources.trimps.employed);
                if ((buyScientists > 0 && freeWorkers > 0) && (getPageSetting('MaxScientists') > game.jobs.Scientist.owned || getPageSetting('MaxScientists') === -1))
                    safeBuyJob('Scientist', toBuy <= canBuy ? toBuy : canBuy);
            } else
                return;
        }
    } else {
        let breeding = (game.resources.trimps.owned - game.resources.trimps.employed);
        if (!(game.global.challengeActive === "Trapper") && game.resources.trimps.owned < game.resources.trimps.realMax() * 0.9 && !breedFire) {
            // #117 — the early-game F/L/M trickle. Also skipped under "No F/L/M in C2": it is the same
            // three jobs by another path, and leaving it live would make the setting silently partial.
            if (breeding > game.resources.trimps.realMax() * 0.33 && !noJobsC2) {
                freeWorkers = freeWorkerSlots();
                if (freeWorkers > 0 && game.resources.trimps.realMax() <= 3e5) {
                    if (challengeActive("Metal") === false) {
                        safeBuyJob('Miner', 1);
                    }
                    safeBuyJob('Farmer', 1);
                    safeBuyJob('Lumberjack', 1);
                }
            }
            return;
        }
    }
    let subtract = 0;

    function checkFireandHire(job: string, amount?: number) {
        freeWorkers = freeWorkerSlots();
        if (amount == null)
            amount = 1;
        if (canAffordJob(job, false, amount) && !game.jobs[job].locked) {
            if (freeWorkers < amount)
                subtract = safeFireJob('Farmer');
            safeBuyJob(job, amount);
        }
    }
    freeWorkers = freeWorkerSlots();
    totalDistributableWorkers = freeWorkers + game.jobs.Farmer.owned + game.jobs.Miner.owned + game.jobs.Lumberjack.owned;
    let ms = getPageSetting('MaxScientists');
    if (ms != 0 && !game.jobs.Scientist.locked && !breedFire) {
        let buyScientists = Math.floor((scientistRatio / totalRatio) * totalDistributableWorkers) - game.jobs.Scientist.owned - subtract;
        let sci = game.jobs.Scientist.owned;
        if ((buyScientists > 0 && freeWorkers > 0) && (ms > sci || ms === -1)) {
            let n = ms - sci;
            if (ms === -1)
                n = buyScientists;
            else if (n < 0)
                n = 0;
            if (buyScientists > n)
                buyScientists = n;
            safeBuyJob('Scientist', buyScientists);
        }
    }
    if (getPageSetting('MaxTrainers') > game.jobs.Trainer.owned || getPageSetting('MaxTrainers') === -1) {
        if (!game.buildings.Tribute.locked) {
            let curtrainercost = game.jobs.Trainer.cost.food[0] * Math.pow(game.jobs.Trainer.cost.food[1], game.jobs.Trainer.owned);
            let curtributecost = getBuildingItemPrice(game.buildings.Tribute, "food", false, 1) * Math.pow(1 - game.portal.Resourceful.modifier, game.portal.Resourceful.level);
            if (curtrainercost < curtributecost)
                checkFireandHire('Trainer');
        } else
            checkFireandHire('Trainer');
    }
    if (getPageSetting('MaxExplorers') > game.jobs.Explorer.owned || getPageSetting('MaxExplorers') === -1) {
        checkFireandHire('Explorer');
    }

    function ratiobuy(job: string, jobratio: number): boolean {
        if (!game.jobs[job].locked && !breedFire) {
            freeWorkers = freeWorkerSlots();
            totalDistributableWorkers = freeWorkers + game.jobs.Farmer.owned + game.jobs.Miner.owned + game.jobs.Lumberjack.owned;
            let toBuy = Math.floor((jobratio / totalRatio) * totalDistributableWorkers) - game.jobs[job].owned - subtract;
            let canBuy = Math.floor(game.resources.trimps.owned - game.resources.trimps.employed);
            let amount = toBuy <= canBuy ? toBuy : canBuy;
            if (amount != 0) {
                safeBuyJob(job, amount);
            }
            return true;
        } else
            return false;
    }
    // #117 — the main F/L/M hire path. Skipped wholesale under "No F/L/M in C2", including the two
    // fire-on-failure arms: those fire Miners/Lumberjacks only as a CONSEQUENCE of ratiobuy declining,
    // and if we never asked, there is nothing to react to. Gating the whole block (rather than each
    // ratiobuy call) is what keeps that side effect from firing workers the user did not ask to lose.
    if (!noJobsC2) {
        ratiobuy('Farmer', farmerRatio);
        if (!ratiobuy('Miner', minerRatio) && breedFire && game.global.turkimpTimer === 0 && challengeActive("Metal") === false)
            safeBuyJob('Miner', game.jobs.Miner.owned * -1);
        if (!ratiobuy('Lumberjack', lumberjackRatio) && breedFire)
            safeBuyJob('Lumberjack', game.jobs.Lumberjack.owned * -1);
    }

    if (game.jobs.Magmamancer.locked) return;
    let timeOnZone = Math.floor((new Date().getTime() - game.global.zoneStarted) / 60000);
    if (game.talents.magmamancer.purchased) {
        timeOnZone += 5;
    }
    if (game.talents.stillMagmamancer.purchased) {
        timeOnZone = Math.floor(timeOnZone + game.global.spireRows);
    }
    let stacks2 = Math.floor(timeOnZone / 10);
    if (getPageSetting('AutoMagmamancers') && stacks2 > tierMagmamancers) {
        let old = preBuy2();
        game.global.firing = false;
        game.global.buyAmt = 'Max';
        game.global.maxSplit = MODULES["jobs"].magmamancerRatio; // (10%)
        let firesomedudes = calculateMaxAfford(game.jobs['Magmamancer'], false, false, true);
        let inverse = (1 / MODULES["jobs"].magmamancerRatio);
        firesomedudes *= inverse;
        if (game.jobs.Farmer.owned > firesomedudes)
            safeFireJob('Farmer', firesomedudes);
        else if (game.jobs.Lumberjack.owned > firesomedudes)
            safeFireJob('Lumberjack', firesomedudes);
        else if (game.jobs.Miner.owned > firesomedudes)
            safeFireJob('Miner', firesomedudes);
        game.global.firing = false;
        game.global.buyAmt = 'Max';
        game.global.maxSplit = MODULES["jobs"].magmamancerRatio;
        buyJob('Magmamancer', true, true);
        postBuy2(old);
        debug("Bought " + (firesomedudes / inverse) + ' Magmamancers. Total Owned: ' + game.jobs['Magmamancer'].owned, "magmite", "*users");
        tierMagmamancers += 1;
    } else if (stacks2 < tierMagmamancers) {
        tierMagmamancers = 0;
    }

    if ((game.resources.trimps.owned - game.resources.trimps.employed) < 2) {
        let a = (game.jobs.Farmer.owned > 2);
        if (a)
            safeFireJob('Farmer', 2);
        let b = (game.jobs.Lumberjack.owned > 2);
        if (b)
            safeFireJob('Lumberjack', 2);
        let c = (game.jobs.Miner.owned > 2);
        if (c)
            safeFireJob('Miner', 2);
        if (a || b || c)
            debug("Job Protection Triggered, Number Rounding Error: [f,l,m]= " + a + " " + b + " " + c, "other");
    }
}
let tierMagmamancers = 0;


export function workerRatios() {
    let ratioSet;
    if (MODULES["jobs"].customRatio) {
        ratioSet = MODULES["jobs"].customRatio;
    } else if (game.global.world >= 300) {
        ratioSet = MODULES["jobs"].autoRatio7;
    } else if (game.buildings.Tribute.owned > 3000 && mutations.Magma.active()) {
        ratioSet = MODULES["jobs"].autoRatio6;
    } else if (game.buildings.Tribute.owned > 1500) {
        ratioSet = MODULES["jobs"].autoRatio5;
    } else if (game.buildings.Tribute.owned > 1000) {
        ratioSet = MODULES["jobs"].autoRatio4;
    } else if (game.resources.trimps.realMax() > 3000000) {
        ratioSet = MODULES["jobs"].autoRatio3;
    } else if (game.resources.trimps.realMax() > 300000) {
        ratioSet = MODULES["jobs"].autoRatio2;
    } else {
        ratioSet = MODULES["jobs"].autoRatio1;
    }
    if (challengeActive("Watch")) {
        ratioSet = MODULES["jobs"].autoRatio1;
    } else if (challengeActive("Metal")) {
        ratioSet = [4, 5, 0];
    }
    setPageSetting('FarmerRatio', ratioSet[0]);
    setPageSetting('LumberjackRatio', ratioSet[1]);
    setPageSetting('MinerRatio', ratioSet[2]);
}

//Radon

MODULES["jobs"].RscientistRatio = 8;
MODULES["jobs"].RscientistRatio2 = 4;
MODULES["jobs"].RscientistRatio3 = 16;
MODULES["jobs"].RscientistRatio4 = 64;
// Worker Ratios = [Farmer,Lumber,Miner]. U2 uses the SAME seven tiers as U1 (only the challenge
// override differs: Transmute here, Watch/Metal in U1), so it publishes from the same single source.
MODULES["jobs"].RautoRatio7 = ratioFor('autoRatio7');
MODULES["jobs"].RautoRatio6 = ratioFor('autoRatio6');
MODULES["jobs"].RautoRatio5 = ratioFor('autoRatio5');
MODULES["jobs"].RautoRatio4 = ratioFor('autoRatio4');
MODULES["jobs"].RautoRatio3 = ratioFor('autoRatio3');
MODULES["jobs"].RautoRatio2 = ratioFor('autoRatio2');
MODULES["jobs"].RautoRatio1 = ratioFor('autoRatio1');
// #88: the U2 twin of the same dropped assignment. See the customRatio note above.
MODULES["jobs"].RcustomRatio = null;

export function RsafeBuyJob(jobTitle: string, amount: number): boolean {
    if (!Number.isFinite(amount) || amount === 0 || typeof amount === 'undefined' || Number.isNaN(amount)) {
        return false;
    }
    let old = preBuy2();
    let freeWorkers = freeWorkerSlots();
    let result;
    if (amount < 0) {
        amount = Math.abs(amount);
        game.global.firing = true;
        game.global.buyAmt = amount;
        result = true;
    } else {
        game.global.firing = false;
        game.global.buyAmt = amount;
        result = canAffordJob(jobTitle, false) && freeWorkers > 0;
        if (!result) {
            game.global.buyAmt = 'Max';
            game.global.maxSplit = 1;
            result = canAffordJob(jobTitle, false) && freeWorkers > 0;
        }
    }
    if (result) {
        debug((game.global.firing ? 'Firing ' : 'Hiring ') + prettify(game.global.buyAmt) + ' ' + jobTitle + 's', "jobs", "*users");
        buyJob(jobTitle, true, true);
    }
    postBuy2(old);
    return true;
}

export function RsafeFireJob(job: string, amount?: number): number {
    let oldjob = game.jobs[job].owned;
    if (oldjob === 0 || amount === 0)
        return 0;
    let test = oldjob;
    let x = 1;
    if (amount != null)
        x = amount;
    if (!Number.isFinite(oldjob)) {
        while (oldjob === test) {
            test -= x;
            x *= 2;
        }
    }
    let old = preBuy2();
    game.global.firing = true;
    let freeWorkers = freeWorkerSlots();
    while (x >= 1 && freeWorkers === freeWorkerSlots()) {
        game.global.buyAmt = x;
        buyJob(job, true, true);
        x *= 2;
    }
    postBuy2(old);
    return x / 2;
}

export function RworkerRatios() {
    let ratioSet;
    if (MODULES["jobs"].RcustomRatio) {
        ratioSet = MODULES["jobs"].RcustomRatio;
    } else if (game.global.world >= 300) {
        ratioSet = MODULES["jobs"].RautoRatio7;
    } else if (game.buildings.Tribute.owned > 3000 && mutations.Magma.active()) {
        ratioSet = MODULES["jobs"].RautoRatio6;
    } else if (game.buildings.Tribute.owned > 1500) {
        ratioSet = MODULES["jobs"].RautoRatio5;
    } else if (game.buildings.Tribute.owned > 1000) {
        ratioSet = MODULES["jobs"].RautoRatio4;
    } else if (game.resources.trimps.realMax() > 3000000) {
        ratioSet = MODULES["jobs"].RautoRatio3;
    } else if (game.resources.trimps.realMax() > 300000) {
        ratioSet = MODULES["jobs"].RautoRatio2;
    } else if (game.global.challengeActive === 'Transmute') {
        ratioSet = [4, 5, 0];
    } else {
        ratioSet = MODULES["jobs"].RautoRatio1;
    }
    setPageSetting('RFarmerRatio', ratioSet[0]);
    setPageSetting('RLumberjackRatio', ratioSet[1]);
    setPageSetting('RMinerRatio', ratioSet[2]);
}

export function RquestbuyJobs() {

    let freeWorkers = freeWorkerSlots();
    let totalDistributableWorkers = freeWorkers + game.jobs.Farmer.owned + game.jobs.Miner.owned + game.jobs.Lumberjack.owned;
    totalDistributableWorkers = totalDistributableWorkers / 5;

    let farmerRatio = 0;
    let lumberjackRatio = 0;
    let minerRatio = 0;
    let scientistNumber = (totalDistributableWorkers * 0.00001);
    if (scientistNumber <= 0) {
        scientistNumber = 1;
    }

    if (game.global.world > 5) {
        if (questcheck() === 7 && !canAffordBuilding('Smithy')) {
            farmerRatio = 10;
            lumberjackRatio = 10;
            minerRatio = 10;
            totalDistributableWorkers *= 5;
        }
        else if (questcheck() === 10 || questcheck() === 20) {
            farmerRatio = 10;
            totalDistributableWorkers *= 5;
        }
        else if (questcheck() === 11 || questcheck() === 21) {
            lumberjackRatio = 10;
            totalDistributableWorkers *= 5;
        }
        else if (questcheck() === 12 || questcheck() === 22) {
            minerRatio = 10;
            totalDistributableWorkers *= 5;
        }
        else if (questcheck() === 14 || questcheck() === 24) {
            totalDistributableWorkers *= 5;
            scientistNumber = (totalDistributableWorkers * 0.5);
        }
        else {
            farmerRatio = 10;
            lumberjackRatio = 10;
            minerRatio = 10;
        }
    }

    if (scientistNumber > (totalDistributableWorkers * 0.00001) && !game.jobs.Scientist.locked) {
        if (freeWorkers > 0 && scientistNumber > game.jobs.Scientist.owned) {
            let n = scientistNumber - game.jobs.Scientist.owned;
            RsafeBuyJob('Scientist', n);
        }
    } else if (game.jobs.Scientist.owned > scientistNumber && !game.jobs.Scientist.locked) {
        let n = game.jobs.Scientist.owned - scientistNumber;
        RsafeFireJob('Scientist', n);
    }

    if (getPageSetting('RMaxExplorers') > game.jobs.Explorer.owned || getPageSetting('RMaxExplorers') === -1) {
        RsafeBuyJob("Explorer", 1);
    }

    let farmerkeep = totalDistributableWorkers * 0.01;
    if (farmerkeep < 1) {
        farmerkeep = 100;
        if (totalDistributableWorkers <= 100) {
            farmerkeep = 1;
        }
    }

    totalDistributableWorkers = totalDistributableWorkers - farmerkeep;

    if (farmerRatio > 0 && lumberjackRatio <= 0 && minerRatio <= 0) {
        RsafeFireJob('Lumberjack', game.jobs.Lumberjack.owned);
        RsafeFireJob('Miner', game.jobs.Miner.owned);
        RsafeBuyJob('Farmer', totalDistributableWorkers);
    } else if (lumberjackRatio > 0 && farmerRatio <= 0 && minerRatio <= 0) {
        RsafeFireJob('Farmer', game.jobs.Farmer.owned - farmerkeep);
        RsafeFireJob('Miner', game.jobs.Miner.owned);
        RsafeBuyJob('Lumberjack', totalDistributableWorkers);
    } else if (minerRatio > 0 && farmerRatio <= 0 && lumberjackRatio <= 0) {
        RsafeFireJob('Farmer', game.jobs.Farmer.owned - farmerkeep);
        RsafeFireJob('Lumberjack', game.jobs.Lumberjack.owned);
        RsafeBuyJob('Miner', totalDistributableWorkers);
    } else if (farmerRatio <= 0 && lumberjackRatio <= 0 && minerRatio <= 0) {
        RsafeFireJob('Farmer', game.jobs.Farmer.owned - farmerkeep);
        RsafeFireJob('Lumberjack', game.jobs.Lumberjack.owned);
        RsafeFireJob('Miner', game.jobs.Miner.owned);
    } else if (farmerRatio > 0 && lumberjackRatio > 0 && minerRatio > 0) {
        RsafeBuyJob('Farmer', totalDistributableWorkers * 0.15);
        RsafeBuyJob('Lumberjack', totalDistributableWorkers * 0.35);
        RsafeBuyJob('Miner', totalDistributableWorkers * 0.45);
    }
}

let reservedJobs = 100;

export function RbuyJobs() {

    if (game.jobs.Farmer.locked || game.resources.trimps.owned === 0) return;

    // fix: #32 — the misplaced paren put `owned` on Math.ceil (which ignores extra args) instead of
    // Math.min, so freeWorkers was never capped by `owned`. Corrected: when the colony holds fewer
    // trimps than half its max, distribute only what actually exists. Radon-only (RbuyJobs) → the U1
    // trace corpus can't reach it; gated by the jobs.RbuyJobs L1 regression (user-approved 2026-07-09).
    let freeWorkers = Math.ceil(Math.min(game.resources.trimps.realMax() / 2, game.resources.trimps.owned)) - game.resources.trimps.employed;
    if (freeWorkers <= 0) return;

    // Do non-ratio/limited jobs first
    // Explorers
    let maxExplorers = (getPageSetting('RMaxExplorers') === -1) ? Infinity : getPageSetting('RMaxExplorers');
    if (maxExplorers > game.jobs.Explorer.owned && !game.jobs.Explorer.locked) {
        let affordableExplorers = Math.min(maxExplorers - game.jobs.Explorer.owned,
            getMaxAffordable(
                game.jobs.Explorer.cost.food[0] * Math.pow(game.jobs.Explorer.cost.food[1], game.jobs.Explorer.owned),
                game.resources.food.owned,
                game.jobs.Explorer.cost.food[1],
                true
            )
        );

        if (affordableExplorers > 0) {
            let buyAmountStore = game.global.buyAmt;
            game.global.buyAmt = affordableExplorers;

            buyJob('Explorer', true, true);

            freeWorkers -= affordableExplorers;
            game.global.buyAmt = buyAmountStore;
        }
    }

    // Meteorologists
    let affordableMets = getMaxAffordable(
        game.jobs.Meteorologist.cost.food[0] * Math.pow(game.jobs.Meteorologist.cost.food[1], game.jobs.Meteorologist.owned),
        game.resources.food.owned,
        game.jobs.Meteorologist.cost.food[1],
        true
    );

    if (affordableMets > 0 && !game.jobs.Meteorologist.locked) {
        let buyAmountStore = game.global.buyAmt;
        game.global.buyAmt = affordableMets;

        buyJob('Meteorologist', true, true);

        freeWorkers -= affordableMets;
        game.global.buyAmt = buyAmountStore;
    }

    // Ships
    let affordableShips = Math.floor(game.resources.food.owned / game.jobs.Worshipper.getCost());
    if (affordableShips > 0 && !game.jobs.Worshipper.locked) {
        let buyAmountStore = game.global.buyAmt;
        game.global.buyAmt = affordableShips;

        buyJob('Worshipper', true, true);

        freeWorkers -= affordableShips;
        game.global.buyAmt = buyAmountStore;
    }

    // Gather up the total number of workers available to be distributed across ratio workers
    // In the process store how much of each for later.
    let ratioWorkers = ['Farmer', 'Lumberjack', 'Miner', 'Scientist'];
    let currentworkers = [];
    for (let worker of ratioWorkers) {
        currentworkers.push(game.jobs[worker].owned);
    }

    freeWorkers += currentworkers.reduce((a, b) => {
        return a + b;
    });

    // Explicit firefox handling because Ff specifically reduces free workers to 0.
    let isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

    let reserveMod = isFirefox || typeof(isSteam) !== 'undefined' ? 1 + (game.resources.trimps.owned / 1e10) : 1;

    freeWorkers -= (game.resources.trimps.owned > 1e6) ? reservedJobs * reserveMod : 0;

    // Calculate how much of each worker we should have
    // If focused farming go all in for caches
    let allIn = "";
    // #103: `autoTrimpSettings.Rtimefarmspecial.value[i]` → the one setting reader. Identical value
    // for a configured player (getPageSetting returns that very array for a textValue), and the
    // read can no longer throw its way out of mainLoop, which has no try/catch (#87).
    if (Rshouldtimefarm) {
        let timefarmzone = getPageSetting('Rtimefarmzone');
        let timefarmlevelindex = timefarmzone.indexOf(game.global.world);
        let timefarmspecial = getPageSettingAt('Rtimefarmspecial', timefarmlevelindex);
        if (timefarmspecial.includes('wc')) {
            allIn = "Lumberjack";
        } else if (timefarmspecial.includes('sc')) {
            allIn = "Farmer";
        } else if (timefarmspecial.includes('mc')) {
            allIn = "Miner";
        } else if (timefarmspecial.includes('rc')) {
            allIn = "Scientist";
        }
    }
    if (Rdshouldtimefarm) {
        let dtimefarmzone = getPageSetting('Rdtimefarmzone');
        let dtimefarmlevelindex = dtimefarmzone.indexOf(game.global.world);
        let dtimefarmspecial = getPageSettingAt('Rdtimefarmspecial', dtimefarmlevelindex);
        if (dtimefarmspecial.includes('wc')) {
            allIn = "Lumberjack";
        } else if (dtimefarmspecial.includes('sc')) {
            allIn = "Farmer";
        } else if (dtimefarmspecial.includes('mc')) {
            allIn = "Miner";
        } else if (dtimefarmspecial.includes('rc')) {
            allIn = "Scientist";
        }
    }
    if (Rshouldsmithyfarm) {
        let special = RsmithyCalc(false, false, true, false);
        if (special === "swc" || special === "lwc") {
            allIn = "Lumberjack";
        } else if (special === "smc" || special === "lmc") {
            allIn = "Miner";
        }
    }
    if (Rshouldtributefarm) {
        let tributefarmzone = getPageSetting('Rtributefarmzone');
        let tributefarmlevelindex = tributefarmzone.indexOf(game.global.world);
        let tributefarmspecial = getPageSettingAt('Rtributespecialselection', tributefarmlevelindex);
        if (tributefarmspecial.includes('wc')) {
            allIn = "Lumberjack";
        } else if (tributefarmspecial.includes('sc')) {
            allIn = "Farmer";
        } else if (tributefarmspecial.includes('mc')) {
            allIn = "Miner";
        } else if (tributefarmspecial.includes('rc')) {
            allIn = "Scientist";
        }
    }
    if (Rshouldshipfarm) {
        allIn = "Farmer";
    } else if (Rshouldhypofarm) {
        allIn = "Lumberjack";
    }
    let desiredRatios = [0, 0, 0, 0];
    if (allIn !== "") {
        desiredRatios[ratioWorkers.indexOf(allIn)] = 1;
    } else {
        // Weird scientist ratio hack. Based on previous AJ, I don't know why it's like this.
        let scientistMod = MODULES["jobs"].RscientistRatio;
        if (game.jobs.Farmer.owned < 100) {
            scientistMod = MODULES["jobs"].RscientistRatio2;
        }
        if (game.global.world >= 50) {
            scientistMod = MODULES["jobs"].RscientistRatio3;
        }
        if (game.global.world >= 65) {
            scientistMod = MODULES["jobs"].RscientistRatio4;
        }

        // #106 — U2's allocator is a DIFFERENT algorithm from U1's: a weight vector
        // [Farmer, Lumberjack, Miner, Scientist] normalised over freeWorkers, where Scientist is a
        // bare 1 and the workers are scaled by `scientistMod`. Its scientist share is therefore
        // `1 / (1 + mod*(Rf+Rl+Rm))` — about 4% at the defaults (mod 8, ratios 1/1/1). That is the
        // "weird hack" the comment above shrugs at, and it is why the U1 divisor cannot just be reused.
        //
        // To hit an exact s%, drop the mod and give Scientist the weight W*s/(100-s), where W is the
        // sum of the (unlocked) worker weights:
        //     share = X / (X + W)  with  X = W*s/(100-s)   =>   share = s/100   exactly.
        const rPct = getPageSetting('RScientistPercent');
        const rPctSet = Number.isFinite(rPct) && rPct >= 0;

        for (let worker of ratioWorkers) {
            if (!game.jobs[worker].locked) {

                if (worker === "Scientist") {
                    desiredRatios[ratioWorkers.indexOf(worker)] = 1;
                    continue;
                }

                // get ratio from AT
                desiredRatios[ratioWorkers.indexOf(worker)] = (rPctSet ? 1 : scientistMod) * parseFloat(getPageSetting('R' + worker + 'Ratio'));
            }
        }

        if (rPctSet && !game.jobs.Scientist.locked) {
            const s = Math.min(rPct, 90); // clamp: s=100 would divide by zero below
            const W = desiredRatios[0] + desiredRatios[1] + desiredRatios[2];
            desiredRatios[3] = (s === 0) ? 0 : W * s / (100 - s);
        }
    }

    let totalFraction = desiredRatios.reduce((a, b) => {
        return a + b;
    });

    let desiredWorkers = [0, 0, 0, 0];
    let totalWorkerCost = 0;
    for (let i = 0; i < ratioWorkers.length; i++) {
        desiredWorkers[i] = Math.floor(freeWorkers * desiredRatios[i] / totalFraction - currentworkers[i]);
        if (desiredWorkers[i] > 0) totalWorkerCost += game.jobs[ratioWorkers[i]].cost.food * desiredWorkers[i];
    }
    // Check for negative values, in case we need to fire.

    // Safe check total worker costs, almost never going to be an issue
    // Or another reason that we're unable to buy everything we want
    if (totalWorkerCost > game.resources.food.owned /* or breeding/available stuff */ ) {
        // Buy max on food and then let the next frame take care of the rest.
        let buyAmountStore = game.global.buyAmt;
        game.global.buyAmt = "Max";

        buyJob('Farmer', true, true);

        game.global.buyAmt = buyAmountStore;
    } else {
        //buy everything

        // Fire anything that we need to fire to free up workers
        for (let i = 0; i < desiredWorkers.length; i++) {

            if (desiredWorkers[i] > 0) continue;

            let buyAmountStore = game.global.buyAmt;
            let fireState = game.global.firing;

            game.global.firing = (desiredWorkers[i] < 0);
            game.global.buyAmt = Math.abs(desiredWorkers[i]);

            buyJob(ratioWorkers[i], true, true);

            game.global.firing = fireState;
            game.global.buyAmt = buyAmountStore;
        }

        // Buy up workers that we need to
        for (let i = 0; i < desiredWorkers.length; i++) {

            if (desiredWorkers[i] <= 0) continue;

            let buyAmountStore = game.global.buyAmt;
            let fireState = game.global.firing;

            game.global.firing = (desiredWorkers[i] < 0);
            game.global.buyAmt = Math.abs(desiredWorkers[i]);

            buyJob(ratioWorkers[i], true, true);

            game.global.firing = fireState;
            game.global.buyAmt = buyAmountStore;
        }
    }
}
