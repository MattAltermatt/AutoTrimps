// TRUE-TS (Phase 1 · Wave 2, #29): faithful port of legacy/modules/gather.js, now
// strict-typed. Gather/trap automation (calcTPS, trap buffering, manual labor; U1 + U2 R*
// family). 61 game.* touches; native/AT globals typed ambient in src/game/*.d.ts and read by
// bare name (no imports → esbuild byte-identical to the @ts-nocheck original, the conversion
// gate). Module vars trapBuffering/maxTrapBuffering/maxZoneDuration are gather-internal.
//
// IDIOMATIC (Phase 2 · #51): un-minified behind the proof-net (tests/gather.characterization.test.ts
//   pins every branch first; L0 backstop ∅). var→const/let, for-in→for-of, ==→=== where operands
//   are provably the same runtime type. Kept LOOSE deliberately: every getPageSetting(...) comparison
//   (getPageSetting is polymorphic — boolean/string/number/int[]/undefined, see utils.ts) and every
//   autoTrimpSettings.<farm>.value[index] comparison (a per-setting multi-value array read at a
//   possibly-out-of-range index → undefined element; same polymorphism rationale as getPageSetting).
//   Every numeric literal + formula shape is preserved exactly (balance is sacrosanct).
import { getPageSetting } from './utils'

//updated
MODULES["gather"] = {};
//These can be changed (in the console) if you know what you're doing:
MODULES["gather"].minTraps = 5;
MODULES["gather"].minScienceAmount = 100;
MODULES["gather"].minScienceSeconds = 60;

//Global flags
var trapBuffering = false, maxTrapBuffering = false;
var maxZoneDuration = 0;

//Traps per second
export function calcTPS() {
	return Math.min(10, game.global.playerModifier / 5);
}

export function calcMaxTraps() {
	//Tries to keep in mind the longest duration any zone has lasted in this portal
	const time = getZoneSeconds();
	if (game.global.world === 1) maxZoneDuration = time;
	if (time > maxZoneDuration) maxZoneDuration = time;

	//Return enough traps to last 1/4 of the longest duration zone we've seen so far
	return Math.ceil(calcTPS() * maxZoneDuration/4);
}

//OLD: "Auto Gather/Build"
export function manualLabor2() {
	//If not using auto-gather, return
	if (getPageSetting('ManualGather2') == 0) return;

	//Init - Traps config
	const notFullPop = game.resources.trimps.owned < game.resources.trimps.realMax();
	const trapperTrapUntilFull = game.global.challengeActive === "Trapper" && notFullPop;
	const trapTrimpsOK = getPageSetting('TrapTrimps') && (trapperTrapUntilFull || game.jobs.Geneticist.owned === 0);
	const minTraps = Math.ceil(calcTPS());
	const trapsBufferSize = Math.ceil(5 * calcTPS());
	const maxTraps = calcMaxTraps();

	//Init - Traps control
	const lowOnTraps = game.buildings.Trap.owned < minTraps;
	const trapsReady = game.buildings.Trap.owned >= minTraps + trapsBufferSize;
	const fullOfTraps = game.buildings.Trap.owned >= maxTraps;
	const maxTrapsReady = game.buildings.Trap.owned >= maxTraps + trapsBufferSize;
	if (lowOnTraps) trapBuffering = true;
	if (trapsReady) trapBuffering = false;
	if (maxTrapsReady) maxTrapBuffering = false;

	// Init - Science
	const firstFightOK = game.global.world > 1 || game.global.lastClearedCell >= 0;
	const researchAvailable = document.getElementById('scienceCollectBtn')!.style.display !== 'none' && document.getElementById('science')!.style.visibility !== 'hidden';
	const scienceAvailable = document.getElementById('science')!.style.visibility !== 'hidden';
	const needBattle = !game.upgrades.Battle.done && game.resources.science.owned < 10;
	const needScience = game.resources.science.owned < scienceNeeded;
	const needScientists = firstFightOK && game.global.challengeActive !== 'Scientist' && !game.upgrades.Scientists.done && game.resources.science.owned < 100 && scienceAvailable;

	//Init - Others
	const needMiner = firstFightOK && challengeActive("Metal") === false && !game.upgrades.Miners.done;
	const breedingTrimps = game.resources.trimps.owned - trimpsEffectivelyEmployed();
	const hasTurkimp = game.talents.turkimp2.purchased || game.global.turkimpTimer > 0;

	//Verifies if trapping is still relevant
	//Relevant means we gain at least 10% more trimps per sec while trapping (which basically stops trapping during later zones)
	//And there is enough breed time remaining to open an entire trap (prevents wasting time and traps during early zones)
	const trappingIsRelevant = trapperTrapUntilFull || breedingPS().div(10).lt(calcTPS() * (game.portal.Bait.level + 1));
	const trapWontBeWasted = breedTimeRemaining().gte(1 / calcTPS()) || game.global.playerGathering === "trimps" && breedTimeRemaining().lte(DecimalBreed(0.1));

	//Highest Priority Food/Wood for traps (Early Game, when trapping is mandatory)
	if (game.global.world <= 3 && game.global.totalHeliumEarned <= 500000) {
		//If not building and not trapping
		if (!trapsReady && game.global.buildingsQueue.length === 0 && (game.global.playerGathering !== 'trimps' || game.buildings.Trap.owned === 0)) {
			//Gather food or wood
			if (game.resources.food.owned < 10) { setGather('food'); return; }
			if (game.triggers.wood.done && game.resources.wood.owned < 10) { setGather('wood'); return; }
		}
	}

	//High Priority Trapping (doing Trapper or without breeding trimps)
	if (trapTrimpsOK && trappingIsRelevant && trapWontBeWasted && ((notFullPop && breedingTrimps < 4) || trapperTrapUntilFull)) {
		//Bait trimps if we have traps
		if (!lowOnTraps && !trapBuffering) { setGather('trimps'); return; }

		//Or build them, if they are on the queue
		else if (isBuildingInQueue('Trap') || safeBuyBuilding('Trap')) {
			trapBuffering = true;
			setGather('buildings');
			return;
		}
	}

	//Build if we don't have foremany, there are 2+ buildings in the queue, or if we can speed up something other than a trap
	if (!bwRewardUnlocked("Foremany") && game.global.buildingsQueue.length && (game.global.buildingsQueue.length > 1 || game.global.autoCraftModifier === 0 || (getPlayerModifier() > 100 && game.global.buildingsQueue[0] !== 'Trap.1'))) {
		setGather('buildings');
		return;
	}

	//Also Build if we have storage buildings on top of the queue
	if (!bwRewardUnlocked("Foremany") && game.global.buildingsQueue.length && (game.global.buildingsQueue[0] === 'Barn.1' || game.global.buildingsQueue[0] === 'Shed.1' || game.global.buildingsQueue[0] === 'Forge.1')) {
		setGather('buildings');
		return;
	}

	//Highest Priority Research if we have less science than needed to buy Battle, Miner and Scientists
	if (getPageSetting('ManualGather2') != 3 && researchAvailable && (needBattle || needScientists || needMiner && game.resources.science.owned < 60)) {
		setGather('science');
		return;
	}

	//Gather resources for Miner
	if (needMiner && (game.resources.metal.owned < 100 || game.resources.wood.owned < 300)) {
		setGather(game.resources.metal.owned < 100 ? "metal" : "wood");
		return;
	}

	//High Priority Metal gathering for Metal Challenge
	if (challengeActive("Metal") && !game.global.mapsUnlocked) {
		setGather('metal');
		return;
	}

	//Mid Priority Trapping
	if (trapTrimpsOK && trappingIsRelevant && trapWontBeWasted && notFullPop && !lowOnTraps && !trapBuffering) { setGather('trimps'); return; }

	//High Priority Research - When manual research still has more impact than scientists
	if (getPageSetting('ManualGather2') != 3 && researchAvailable && needScience && getPlayerModifier() > getPerSecBeforeManual('Scientist')) {
		setGather('science');
		return;
	}

	//High Priority Trap Building
	if (trapTrimpsOK && trappingIsRelevant && canAffordBuilding('Trap') && (lowOnTraps || trapBuffering)) {
		trapBuffering = true;
		safeBuyBuilding('Trap');
		setGather('buildings');
		return;
	}

	//Metal if Turkimp is active
	if (hasTurkimp) { setGather('metal'); return; }

	//Mid Priority Research
	if (getPageSetting('ManualGather2') != 3 && researchAvailable && needScience) { setGather('science'); return; }

	//Low Priority Trap Building
	if (trapTrimpsOK && trappingIsRelevant && canAffordBuilding('Trap') && (!fullOfTraps || maxTrapBuffering)) {
		trapBuffering = !fullOfTraps;
		maxTrapBuffering = true;
		safeBuyBuilding('Trap');
		setGather('buildings');
		return;
	}

	//Untouched mess
	const manualResourceList: Record<string, string> = {
		'food': 'Farmer',
		'wood': 'Lumberjack',
		'metal': 'Miner',
	};
	let lowestResource = 'food';
	let lowestResourceRate = -1;
	let haveWorkers = true;
	for (const resource of Object.keys(manualResourceList)) {
		const job = manualResourceList[resource];
		let currentRate = game.jobs[job].owned * game.jobs[job].modifier;
		// debug('Current rate for ' + resource + ' is ' + currentRate + ' is hidden? ' + (document.getElementById(resource)!.style.visibility == 'hidden'));
		if (document.getElementById(resource)!.style.visibility !== 'hidden') {
			//find the lowest resource rate
			if (currentRate === 0) {
				currentRate = game.resources[resource].owned;
				// debug('Current rate for ' + resource + ' is ' + currentRate + ' lowest ' + lowestResource + lowestResourceRate);
				if ((haveWorkers) || (currentRate < lowestResourceRate)) {
					// debug('New Lowest1 ' + resource + ' is ' + currentRate + ' lowest ' + lowestResource + lowestResourceRate+ ' haveworkers ' +haveWorkers);
					haveWorkers = false;
					lowestResource = resource;
					lowestResourceRate = currentRate;
				}
			}
			if ((currentRate < lowestResourceRate || lowestResourceRate === -1) && haveWorkers) {
				// debug('New Lowest2 ' + resource + ' is ' + currentRate + ' lowest ' + lowestResource + lowestResourceRate);
				lowestResource = resource;
				lowestResourceRate = currentRate;
			}
		}
	}

	//High Priority Gathering - No workers for this resource
	if (game.global.playerGathering !== lowestResource && !haveWorkers && !breedFire) {setGather(lowestResource); return;}

	//Low Priority Research
	if (getPageSetting('ManualGather2') != 3 && researchAvailable && haveWorkers) {
		if (game.resources.science.owned < getPsString('science', true) * MODULES["gather"].minScienceSeconds) {
			setGather('science');
			return;
		}
	}

	//Just gather whatever has lowest rate
	setGather(lowestResource);
}

export function autogather3() {
    if ((game.global.buildingsQueue.length <= 1 && getPageSetting('gathermetal') == false) || (getPageSetting('gathermetal') == true)) setGather('metal');
    else setGather('buildings')
}

//RGather

MODULES["gather"].RminScienceAmount = 200;

export function RmanualLabor2() {

    //Vars
    const trapTrimpsOK = getPageSetting('RTrapTrimps');
    const hasTurkimp = game.talents.turkimp2.purchased || game.global.turkimpTimer > 0;
    const needToTrap = (game.resources.trimps.max - game.resources.trimps.owned >= game.resources.trimps.max * 0.05) || (game.resources.trimps.getCurrentSend() > game.resources.trimps.owned - trimpsEffectivelyEmployed());
    let fresh = false;

    //ULTRA FRESH
    if (!game.upgrades.Battle.done) {
        fresh = true;
        if (game.resources.food.owned < 10) {
            setGather('food');
        }
        if (game.resources.wood.owned < 10 && game.resources.food.owned >= 10) {
            setGather('wood');
        }
        if (game.resources.food.owned >= 10 && game.resources.wood.owned >= 10) {
            safeBuyBuilding('Trap');
        }
        if (game.buildings.Trap.owned > 0 && game.resources.trimps.owned < 1) {
            setGather('trimps');
        }
        if (game.resources.trimps.owned >= 1) {
            setGather('science');
        }
        return;
    }
    if (game.upgrades.Battle.done && game.upgrades.Scientists.allowed && !game.upgrades.Scientists.done && game.resources.science.owned < 100) {
        fresh = true;
        setGather('science');
        return;
    }
    if (game.upgrades.Battle.done && game.upgrades.Miners.allowed && !game.upgrades.Miners.done && game.resources.science.owned < 60) {
        fresh = true;
        setGather('science');
        return;
    }

    //FRESH GAME NO RADON CODE
    if (!fresh && game.global.world <= 3 && game.global.totalRadonEarned <= 5000) {
        if (game.global.buildingsQueue.length === 0 && (game.global.playerGathering !== 'trimps' || game.buildings.Trap.owned === 0)) {
            if (!game.triggers.wood.done || game.resources.food.owned < 10 || Math.floor(game.resources.food.owned) < Math.floor(game.resources.wood.owned))
                setGather('food');
            else
                setGather('wood');
        }
        return;
    }

    //QUEST
    if (game.global.challengeActive === "Quest") {
        if (questcheck() === 10 || questcheck() === 20) {
            setGather('food');
        }
        if (questcheck() === 11 || questcheck() === 21) {
            setGather('wood');
        }
        if (questcheck() === 12 || questcheck() === 22) {
            setGather('metal');
        }
        if (questcheck() === 14 || questcheck() === 24) {
            setGather('science');
        }
    }
	
    //HYPO
    else if (Rshouldhypofarm) {
        setGather('wood');
    }
	
    //SHIP
    else if (Rshouldshipfarm) {
        setGather('food');
    }
	
    //TIMEFARM
    else if (Rshouldtimefarm) {
        const timefarmzone = getPageSetting('Rtimefarmzone');
        const timefarmlevelindex = timefarmzone.indexOf(game.global.world);
        if (autoTrimpSettings.Rtimefarmgather.value[timefarmlevelindex] == "food") {
            setGather('food');
        }
        if (autoTrimpSettings.Rtimefarmgather.value[timefarmlevelindex] == "wood") {
            setGather('wood');
        }
        if (autoTrimpSettings.Rtimefarmgather.value[timefarmlevelindex] == "metal") {
            setGather('metal');
        }
        if (autoTrimpSettings.Rtimefarmgather.value[timefarmlevelindex] == "science") {
            setGather('science');
        }
    } 
	
    //SMITHY
    else if (Rshouldsmithyfarm) {
        setGather(RsmithyCalc(false, false, false, true));
    }

    //TRIBUTE
    else if (Rshouldtributefarm) {
        var tributefarmzone = getPageSetting('Rtributefarmzone');
        var tributefarmlevelindex = tributefarmzone.indexOf(game.global.world);
        if (autoTrimpSettings.Rtributegatherselection.value[tributefarmlevelindex] == "food") {
            setGather('food');
        }
        if (autoTrimpSettings.Rtributegatherselection.value[tributefarmlevelindex] == "wood") {
            setGather('wood');
        }
        if (autoTrimpSettings.Rtributegatherselection.value[tributefarmlevelindex] == "metal") {
            setGather('metal');
        }
        if (autoTrimpSettings.Rtributegatherselection.value[tributefarmlevelindex] == "science") {
            setGather('science');
        }
    }
	
    //MISC.
    else if (getPageSetting('RManualGather2') != 2 && game.resources.science.owned < MODULES["gather"].RminScienceAmount && document.getElementById('scienceCollectBtn')!.style.display !== 'none' && document.getElementById('science')!.style.visibility !== 'hidden') {
        setGather('science');
    }
    else if (game.resources.science.owned < (RscienceNeeded * 0.8) && document.getElementById('scienceCollectBtn')!.style.display !== 'none' && document.getElementById('science')!.style.visibility !== 'hidden') {
        setGather('science');
    }
    else if (trapTrimpsOK && needToTrap && game.buildings.Trap.owned === 0 && canAffordBuilding('Trap')) {
        if (!safeBuyBuilding('Trap'))
            setGather('buildings');
    }
    else if (trapTrimpsOK && needToTrap && game.buildings.Trap.owned > 0) {
        setGather('trimps');
    }
    else if (game.global.buildingsQueue.length > 2) {
        setGather('buildings');
    }
    else if (!game.global.trapBuildToggled && (game.global.buildingsQueue[0] === 'Barn.1' || game.global.buildingsQueue[0] === 'Shed.1' || game.global.buildingsQueue[0] === 'Forge.1')) {
        setGather('buildings');
    }
    else if (game.resources.science.owned >= RscienceNeeded && document.getElementById('scienceCollectBtn')!.style.display !== 'none' && document.getElementById('science')!.style.visibility !== 'hidden') {
        if (game.global.challengeActive !== "Transmute" && (getPlayerModifier() < getPerSecBeforeManual('Scientist') && hasTurkimp) || getPageSetting('RManualGather2') == 2) {
            setGather('metal');
        } else if (getPageSetting('RManualGather2') != 2) {
            setGather('science');
        }
    }
    else if (trapTrimpsOK) {
        if (game.buildings.Trap.owned < 5 && canAffordBuilding('Trap')) {
            safeBuyBuilding('Trap');
            setGather('buildings');
        } else if (game.buildings.Trap.owned > 0)
            setGather('trimps');
    }
	
    //ALL FAIL
    else {
	setGather('metal');
    }	
}
