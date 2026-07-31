// TRUE TS (Phase 1 · #30): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/breedtimer.js.
// Game-coupled breed-timer logic. Registers into the shared MODULES global (kept
// verbatim — treated like game/autoTrimpSettings, ambient-typed). getPageSetting is
// imported from the converted utils module. The top-level addBreedingBoxTimers() runs
// at load — verified game-DOM + tooltip() only, so safe under the early src slot.
// Free identifiers (DecimalBreed/Decimal/calcHeirloomBonusDecimal/getNextGeneticistCost/
// addGeneticist/removeGeneticist/mapsClicked/runMap/isActiveSpireAT/etc.) resolve via the
// bridge at runtime, typed ambient. Behaviour-preserving: any body edits are TYPE-ONLY.
import { getPageSetting } from './utils'

MODULES["breedtimer"] = {};
MODULES["breedtimer"].voidCheckPercent = 95;

export function trimpsEffectivelyEmployed() {
    //Init
    var employedTrimps = game.resources.trimps.employed;

    //Multitasking
    if (game.permaBoneBonuses.multitasking.owned)
        employedTrimps *= (1 - game.permaBoneBonuses.multitasking.mult());

    return employedTrimps;
}

export function breedingPS() {
    //Init
    var trimps = game.resources.trimps;
    var breeding = new DecimalBreed(trimps.owned).minus(trimpsEffectivelyEmployed());

    //Gets the modifier, then: 1.1x format -> 0.1 format -> 1.0 x breeding
    return potencyMod().minus(1).mul(10).mul(breeding);
}

export function potencyMod() {
    //Init
    var trimps = game.resources.trimps;
    var potencyMod = new DecimalBreed(trimps.potency);

    //Potency, Nurseries, Venimp, Broken Planet
    if (game.upgrades.Potency.done > 0) potencyMod = potencyMod.mul(Math.pow(1.1, game.upgrades.Potency.done));
    if (game.buildings.Nursery.owned > 0) potencyMod = potencyMod.mul(Math.pow(1.01, game.buildings.Nursery.owned));
    if (game.unlocks.impCount.Venimp > 0) potencyMod = potencyMod.mul(Math.pow(1.003, game.unlocks.impCount.Venimp));
    if (game.global.brokenPlanet) potencyMod = potencyMod.div(10);

    //Pheromones
    // #250 — getPerkLevel, not `.level`. The perk carries both `level` and `radLevel` and getPerkLevel
    // switches on universe (.trimps-game/main.js:2405), so `.level` used the U1 allocation in a U2 run.
    // The game itself uses getPerkLevel here (main.js:5595). All THREE AT copies of this formula had it.
    potencyMod = potencyMod.mul(1+ (getPerkLevel("Pheromones") * game.portal.Pheromones.modifier));

    //Quick Trimps
    if (game.singleRunBonuses.quickTrimps.owned) potencyMod = potencyMod.mul(2);

    //Dailies
    if (game.global.challengeActive == "Daily"){
        //Dysfunctional
        if (typeof game.global.dailyChallenge.dysfunctional !== 'undefined')
            potencyMod = potencyMod.mul(dailyModifiers.dysfunctional.getMult(game.global.dailyChallenge.dysfunctional.strength));

        //Toxic
        if (typeof game.global.dailyChallenge.toxic !== 'undefined')
            potencyMod = potencyMod.mul(dailyModifiers.toxic.getMult(game.global.dailyChallenge.toxic.strength, game.global.dailyChallenge.toxic.stacks));
    }

    //Toxicity
    if (challengeActive("Toxicity") && game.challenges.Toxicity.stacks > 0)
        potencyMod = potencyMod.mul(Math.pow(game.challenges.Toxicity.stackMult, game.challenges.Toxicity.stacks));

    //Archaeology / Quagmire (parity fix #22): mirror game breed() challenge mults (main.js 5629-5630)
    if (challengeActive("Archaeology"))
        potencyMod = potencyMod.mul(game.challenges.Archaeology.getStatMult('breed'));
    if (challengeActive("Quagmire"))
        potencyMod = potencyMod.mul(game.challenges.Quagmire.getExhaustMult());

    //Void Maps (Slow Breed)
    if (game.global.voidBuff == "slowBreed")
        potencyMod = potencyMod.mul(0.2);

    //Heirlooms
    potencyMod = calcHeirloomBonusDecimal("Shield", "breedSpeed", potencyMod);

    //Geneticists
    if (game.jobs.Geneticist.owned > 0)
        potencyMod = potencyMod.mul(Math.pow(.98, game.jobs.Geneticist.owned));

    return potencyMod.div(10).add(1);
}

export function breedTimeRemaining() {
    //Init
    var trimps = game.resources.trimps;
    var trimpsMax = trimps.realMax();

    //Calc
    var maxBreedable = new DecimalBreed(trimpsMax).minus(trimpsEffectivelyEmployed());
    var breeding = new DecimalBreed(trimps.owned).minus(trimpsEffectivelyEmployed());
    return DecimalBreed.log10(maxBreedable.div(breeding)).div(DecimalBreed.log10(potencyMod())).div(10);
}

// SEAM: shared top-level var read by still-legacy gather.js — must be a real global,
// not a module-scoped var (which legacy can't see). Assigned to globalThis at load.
globalThis.DecimalBreed = Decimal.clone({precision: 30, rounding: 4});
var missingTrimps = new DecimalBreed(0);

/** The Anticipation stack cap, transcribed from main.js:11684. DERIVED, not retyped: abandonVoidMap()
 *  below had its own hand-written copy of this ternary, and a second copy of a game-owned fact is how
 *  the `BuyJobsNew` tier table ended up wrong in all seven of its rows. One expression, two callers. */
export function antiStackCap() {
	return game.talents.patience.purchased ? 45 : 30;
}

// #313 — REACHING THE ANTICIPATION CAP DOES NOT REQUIRE STRETCHING BREED TIME.
//
// The design panel's target (the cap) was derived at z190 and is right. The ACTUATOR it assumed is
// not. Geneticists reach the cap only by slowing breeding until it TAKES `cap` seconds, and at the
// depth Geneticists unlock that costs ~389 of them against a food cap of 72 — measured on
// 15-geneticist-u1 (world 71, base breed time 0.0138 s, food 3.06e15). Two orders of magnitude out
// of reach, so a controller aiming there hires to the food cap and sits.
//
// The game carries a second lever, and it writes the Anticipation clock DIRECTLY. At full population
// breed() pads `lastBreedTime` toward `GeneticistassistSetting` whenever `geneSend.enabled === 3`
// (main.js:5759), and main.js:11683 reads exactly that to set `antiStacks`. So the cap is reachable at
// every depth, for no food at all.
//
// ⚠️ WHY IT WORKS WITH ZERO GENETICISTS — the necessary condition is not the sufficient one, and the
// difference was flagged by review. That the pad branch never tests `Geneticist.owned` is only half of
// it: `gensUp` (main.js:11137) is false without Geneticists, so the send block at main.js:11147 never
// engages and the army is NOT held back. What actually accrues the clock is battleCoordinator's own
// gate — `if (!game.global.fighting) { battle(null); return; }` (main.js:11082) — so while the previous
// army is still out, and an army spans many cells (main.js:11123), battle() is not called, population
// sits full, and the pad runs every tick. The stacks come out of time the fight was spending anyway.
// This also says where the lever STOPS paying: stacks are min(fight duration, timer, cap), so an army
// that dies faster than the cap earns proportionally less.
//
// Measured, 8000 ticks, AT driving, both world-71 fixtures (`anti` = mean antiStacks):
//     15-geneticist-u1   control z76 anti 0.0 | ATGA only z76 anti 0.2 | +geneSend z80 anti 28.1
//     16-amalg-u1        control z78 anti 0.9 | ATGA only z78 anti 1.0 | +geneSend z81 anti 28.0
// Today's ATGA is a NO-OP on zone progress at this depth (z76 == z76, z78 == z78) while spending the
// food economy on 125-180 Geneticists. This function supplies the missing actuator; ATGA2() keeps
// hiring, which is now purely the 1.01^N health term rather than a doomed run at the cap.
//
// U1 only: Geneticist is blockU2 (config.js:11920).

// #113's lesson applied to two more game-owned globals. Module scope, because this runs fresh from
// the mainLoop every tick and a function-scoped `var` would re-initialise to undefined each call —
// which is exactly how ATspirebreed() spent its life blanking the player's timer. `null` means
// NOTHING WAS CAPTURED, and the restore below must refuse to write back a value it never took.
let preAntiGeneSend: number | null = null;
let preAntiGaTimer: number | null = null;

export function ATGAanticipation() {
	const menu = game.options && game.options.menu && game.options.menu.geneSend;
	if (!menu) return;

	if (!(getPageSetting('ATGAanticipation') == true) || game.jobs.Geneticist.locked != false || game.global.universe == 2) {
		releaseAnticipation();
		return;
	}

	if (menu.enabled !== 3) {
		if (preAntiGeneSend === null) preAntiGeneSend = menu.enabled;
		menu.enabled = 3;
		// The game has no set-to-value form — toggleSetting only CYCLES (updates.js:6543). Passing
		// updateOnly=true skips the mutation and `onToggle` and just repaints the button from the value
		// written above, so the option's own UI cannot drift out of step with its state. geneSend has no
		// onToggle, so nothing behavioural is skipped. The button lives in the Geneticistassist tooltip
		// (updates.js:744) and is usually absent from the DOM; toggleSetting handles a null elem.
		toggleSetting('geneSend', null, false, true);
	}

	// ATspirebreed() (other.ts:195) OWNS GeneticistassistSetting while the Spire override is armed, and
	// two writers on one global fight every tick. Stand down and let mode 3 wait on the Spire's timer
	// instead — geneSend is orthogonal to the value, so the lever keeps working either way.
	if (spirebreeding) return;

	const cap = antiStackCap();
	if (game.global.GeneticistassistSetting !== cap) {
		if (preAntiGaTimer === null) preAntiGaTimer = game.global.GeneticistassistSetting;
		game.global.GeneticistassistSetting = cap;
	}
}

/** Put both game-owned values back exactly once, and only where OUR value is still the one sitting
 *  there — a player who changed the option themselves outranks us, and restoring over them would be
 *  the #113 bug with a different global. */
function releaseAnticipation() {
	if (preAntiGeneSend !== null) {
		const menu = game.options.menu.geneSend;
		if (menu.enabled === 3) {
			menu.enabled = preAntiGeneSend;
			toggleSetting('geneSend', null, false, true);
		}
		preAntiGeneSend = null;
	}
	// The GA timer needs one more distinction than geneSend does, because it has a SECOND writer. A
	// skipped restore means one of two opposite things, and clearing the latch is right for only one:
	//
	//   the player changed it themselves  → theirs wins, drop our bookkeeping (handled below)
	//   ATspirebreed() currently owns it  → WAIT; dropping it now loses the value permanently
	//
	// The second case is not hypothetical and it is silent. ATspirebreed (other.ts:195) captures
	// whatever is sitting in the global when the Spire arms — which by then is OUR cap — so the only
	// value it can ever hand back is the cap. The player's real setting exists nowhere but this latch.
	// Turn the feature off mid-Spire with an unconditional clear and their timer is stuck at AT's cap
	// for good: #113's exact class, one module boundary over. `spirebreeding` is the ownership signal,
	// and since main-loop.ts dispatches this every tick regardless of the setting, holding costs a tick
	// and resolves as soon as the Spire hands back.
	if (preAntiGaTimer !== null && !spirebreeding) {
		if (game.global.GeneticistassistSetting === antiStackCap()) game.global.GeneticistassistSetting = preAntiGaTimer;
		preAntiGaTimer = null;
	}
}

export function ATGA2() {
	// #315 — the guard used to name Trapper only, and breed() stops for BOTH (main.js:5575). Under
	// Trappapalooza that early return is upstream of everything this servo models: potencyMod is never
	// applied, `lastBreedTime` never accumulates (so zero Anticipation stacks, main.js:11683), and
	// `updateStoredGenInfo()` never runs — leaving `lowestGen` at its -1 reset, which is precisely what
	// startFight gates the health bonus on (`if (game.global.lowestGen >= 0)`, main.js:11745). So every
	// Geneticist hired there is pure cost: no health, no stacks, no breed effect. Spelled with the game's
	// own challengeActive() rather than a direct compare — a superset of it (main.js:1753 checks
	// multiChallenge first), so it cannot be less correct, and it survives a future challenge being
	// re-parented under a Challenge².
	if (game.jobs.Geneticist.locked == false && getPageSetting('ATGA2') == true && getPageSetting('ATGA2timer') > 0 && !challengeActive("Trapper") && !challengeActive("Trappapalooza")){
		var trimps = game.resources.trimps;
		var trimpsMax = trimps.realMax();
		var maxBreedable = new DecimalBreed(trimpsMax).minus(trimpsEffectivelyEmployed());
		var potencyMod = new DecimalBreed(trimps.potency);
		if (game.upgrades.Potency.done > 0) potencyMod = potencyMod.mul(Math.pow(1.1, game.upgrades.Potency.done));
		if (game.buildings.Nursery.owned > 0) potencyMod = potencyMod.mul(Math.pow(1.01, game.buildings.Nursery.owned));
		if (game.unlocks.impCount.Venimp > 0) potencyMod = potencyMod.mul(Math.pow(1.003, game.unlocks.impCount.Venimp));
		if (game.global.brokenPlanet) potencyMod = potencyMod.div(10);
		// #250 — getPerkLevel, not `.level` (see potencyMod() above).
		potencyMod = potencyMod.mul(1+ (getPerkLevel("Pheromones") * game.portal.Pheromones.modifier));
		if (game.singleRunBonuses.quickTrimps.owned) potencyMod = potencyMod.mul(2);
		if (game.global.challengeActive == "Daily"){
			if (typeof game.global.dailyChallenge.dysfunctional !== 'undefined'){
			potencyMod = potencyMod.mul(dailyModifiers.dysfunctional.getMult(game.global.dailyChallenge.dysfunctional.strength));
			}
			if (typeof game.global.dailyChallenge.toxic !== 'undefined'){
			potencyMod = potencyMod.mul(dailyModifiers.toxic.getMult(game.global.dailyChallenge.toxic.strength, game.global.dailyChallenge.toxic.stacks));
			}
		}
		if (challengeActive("Toxicity") && game.challenges.Toxicity.stacks > 0){
		potencyMod = potencyMod.mul(Math.pow(game.challenges.Toxicity.stackMult, game.challenges.Toxicity.stacks));
		}
		//Archaeology / Quagmire (parity fix #22): mirror game breed() challenge mults (main.js 5629-5630)
			if (challengeActive("Archaeology")) potencyMod = potencyMod.mul(game.challenges.Archaeology.getStatMult('breed'));
			if (challengeActive("Quagmire")) potencyMod = potencyMod.mul(game.challenges.Quagmire.getExhaustMult());
			if (game.global.voidBuff == "slowBreed"){
		potencyMod = potencyMod.mul(0.2);
		}
		potencyMod = calcHeirloomBonusDecimal("Shield", "breedSpeed", potencyMod);
		if (game.jobs.Geneticist.owned > 0) potencyMod = potencyMod.mul(Math.pow(.98, game.jobs.Geneticist.owned));
		potencyMod = potencyMod.div(10).add(1);
		var decimalOwned = missingTrimps.add(trimps.owned);
		var timeRemaining = DecimalBreed.log10(maxBreedable.div(decimalOwned.minus(trimpsEffectivelyEmployed()))).div(DecimalBreed.log10(potencyMod)).div(10);
		var currentSend = game.resources.trimps.getCurrentSend();
		var totalTime = DecimalBreed.log10(maxBreedable.div(maxBreedable.minus(currentSend))).div(DecimalBreed.log10(potencyMod)).div(10);

		var target;
		if (getPageSetting('ATGA2timer') > 0)
		target = new Decimal(getPageSetting('ATGA2timer'));

		if (getPageSetting('zATGA2timer') > 0 && getPageSetting('ztATGA2timer') > 0 && game.global.world < getPageSetting('zATGA2timer'))
		target = new Decimal(getPageSetting('ztATGA2timer'));
		if (getPageSetting('ATGA2timerz') > 0 && getPageSetting('ATGA2timerzt') > 0 && game.global.world >= getPageSetting('ATGA2timerz'))
		target = new Decimal(getPageSetting('ATGA2timerzt'));

		if (game.global.runningChallengeSquared && getPageSetting('cATGA2timer') > 0 && challengeActive("Electricity") == false && challengeActive("Toxicity") == false && challengeActive("Nom") == false)
		target = new Decimal(getPageSetting('cATGA2timer'));
		if (game.global.runningChallengeSquared && getPageSetting('chATGA2timer') > 0 && (challengeActive("Electricity") || challengeActive("Toxicity") || challengeActive("Nom")))
		target = new Decimal(getPageSetting('chATGA2timer'));
		// The unsquared counterpart of the row above. Mapocalypse is in the set and absent from the C2 row
		// because it exists ONLY unsquared (config.js:3685) and is Electricity's stack mechanic plus 300%
		// map difficulty. Deliberately gated on the challenge being ACTIVE rather than on the zone: every
		// one of these ends mid-run (Electricity/Mapocalypse on clearing The Prison, config.js:3616 sets
		// challengeActive = ""), and from that tick on the run is an ordinary one, so the target must fall
		// back through to the base timer / Before-Z / After-Z on its own.
		if (!game.global.runningChallengeSquared && getPageSetting('nchATGA2timer') > 0 && (challengeActive("Electricity") || challengeActive("Mapocalypse") || challengeActive("Toxicity") || challengeActive("Nom")))
		target = new Decimal(getPageSetting('nchATGA2timer'));

		if (getPageSetting('dATGA2timer') > 0 && game.global.challengeActive == "Daily")
		target = new Decimal(getPageSetting('dATGA2timer'));
		if (getPageSetting('dhATGA2timer') > 0 && game.global.challengeActive == "Daily" && (typeof game.global.dailyChallenge.bogged !== 'undefined' || typeof game.global.dailyChallenge.plague !== 'undefined' || typeof game.global.dailyChallenge.pressure !== 'undefined'))
		target = new Decimal(getPageSetting('dhATGA2timer'));

		if (game.global.challengeActive != "Daily" && getPageSetting('sATGA2timer') > 0 && isActiveSpireAT() == true)
		target = new Decimal(getPageSetting('sATGA2timer'));
		if (game.global.challengeActive == "Daily" && getPageSetting('dsATGA2timer') > 0 && disActiveSpireAT() == true)
		target = new Decimal(getPageSetting('dsATGA2timer'));

		// #119 — mode 1 is labelled "ATGA: Auto No Spire" and required disActiveSpireAT() to be TRUE.
		// disActiveSpireAT() (other.ts:92) returns true exactly when a Daily Spire IS active, so the
		// option fired ONLY inside a Spire — the precise inverse of its own name. Negated.
		// Mode 2 ("Auto Dailies", the default) is unconditional on a Daily and is unchanged.
		if ((getPageSetting('dATGA2Auto')==2||(getPageSetting('dATGA2Auto')==1 && !disActiveSpireAT() && game.global.challengeActive == "Daily")) && game.global.challengeActive == "Daily" && (typeof game.global.dailyChallenge.bogged !== 'undefined' || typeof game.global.dailyChallenge.plague !== 'undefined')){
			var plagueDamagePerStack = (game.global.dailyChallenge.plague !== undefined) ? dailyModifiers.plague.getMult(game.global.dailyChallenge.plague.strength, 1) : 0;
			var boggedDamage =  (game.global.dailyChallenge.bogged !== undefined) ? dailyModifiers.bogged.getMult(game.global.dailyChallenge.bogged.strength) : 0;
			var atl = Math.ceil((Math.sqrt((plagueDamagePerStack/2+boggedDamage)**2 - 2 * plagueDamagePerStack * (boggedDamage-1)) - (plagueDamagePerStack/2+boggedDamage)) / plagueDamagePerStack);
			target = new Decimal(Math.ceil(isNaN(atl) ? target : atl/1000*(((game.portal.Agility.level) ? 1000 * Math.pow(1 - game.portal.Agility.modifier, game.portal.Agility.level) : 1000) + ((game.talents.hyperspeed2.purchased && (game.global.world <= Math.floor((game.global.highestLevelCleared + 1) * 0.5))) || (game.global.mapExtraBonus == "fa")) * -100 + (game.talents.hyperspeed.purchased) * -100)));
		}

		var now = new Date().getTime();
		var thresh = new DecimalBreed(totalTime.mul(0.02));
		var compareTime;
		if (timeRemaining.cmp(1) > 0 && timeRemaining.cmp(target.add(1)) > 0) {
			compareTime = new DecimalBreed(timeRemaining.add(-1));}
		else {
			compareTime = new DecimalBreed(totalTime);}
		if (!thresh.isFinite()) thresh = new Decimal(0);
		if (!compareTime.isFinite()) compareTime = new Decimal(999);
		var genDif = new DecimalBreed(Decimal.log10(target.div(compareTime)).div(Decimal.log10(1.02))).ceil();

			if (compareTime.cmp(target) < 0) {
				if (game.resources.food.owned * (getPageSetting('ATGA2gen')/100) < getNextGeneticistCost()) {return;}
				else if (timeRemaining.cmp(1) < 0 || target.minus((now - game.global.lastSoldierSentAt) / 1000).cmp(timeRemaining) > 0){
					if (genDif.cmp(0) > 0){
						if (genDif.cmp(10) > 0) genDif = new Decimal(10);
						addGeneticist(genDif.toNumber());
					}
				}
			}
			else if (compareTime.add(thresh.mul(-1)).cmp(target) > 0  || (potencyMod.cmp(1) == 0)){
				if (!genDif.isFinite()) genDif = new Decimal(-1);
				if (genDif.cmp(0) < 0 && game.options.menu.gaFire.enabled != 2){
					if (genDif.cmp(-10) < 0) genDif = new Decimal(-10);
					removeGeneticist(genDif.abs().toNumber());
				}
			}
	}
}

// SEAM: shared global read by still-legacy AutoTrimps2.js (guiLoop) — written to
// globalThis below (was a module var, invisible to legacy → ReferenceError ×74).
export function addBreedingBoxTimers() {
    var breedbarContainer = document.querySelector('#trimps > div.row')!;
    var addbreedTimerContainer = document.createElement("DIV");
    addbreedTimerContainer.setAttribute('class', "col-xs-11");
    addbreedTimerContainer.setAttribute('style', 'padding-right: 0;');
    addbreedTimerContainer.setAttribute("onmouseover", 'tooltip("Hidden Next Group Breed Timer", "customText", event, "How long your next army has been breeding for, or how many anticipation stacks you will have if you send a new army now.")');
    addbreedTimerContainer.setAttribute("onmouseout", 'tooltip("hide")');
    var addbreedTimerInside = document.createElement("DIV");
    addbreedTimerInside.setAttribute('style', 'display: block;');
    var addbreedTimerInsideIcon = document.createElement("SPAN");
    addbreedTimerInsideIcon.setAttribute('class', "icomoon icon-clock");
    globalThis.addbreedTimerInsideText = document.createElement("SPAN");
    addbreedTimerInsideText.id = 'hiddenBreedTimer';
    addbreedTimerInside.appendChild(addbreedTimerInsideIcon);
    addbreedTimerInside.appendChild(addbreedTimerInsideText);
    addbreedTimerContainer.appendChild(addbreedTimerInside);
    breedbarContainer.appendChild(addbreedTimerContainer);
}
addBreedingBoxTimers();

export function addToolTipToArmyCount() {
    var a = document.getElementById("trimpsFighting")!;
    if ("tooltipadded" != a.className) {
        a.setAttribute("onmouseover", "tooltip(\"Army Count\", \"customText\", event, \"To Fight now would add: \" + prettify(getArmyTime()) + \" seconds to the breed timer.\")");
        a.setAttribute("onmouseout", "tooltip(\"hide\")");
        a.setAttribute("class", "tooltipadded");
    }
}

export function abandonVoidMap() {
    if (!getPageSetting('ForceAbandon')) return;
    if (game.global.mapsActive && getCurrentMapObject().location == "Void") {
            if (game.portal.Anticipation.level) {
                // #313 — was a second hand-written copy of main.js:11684's ternary. Same value, one owner.
                var antistacklimitv = antiStackCap();
	        if (((game.jobs.Amalgamator.owned > 0) ? Math.floor((new Date().getTime() - game.global.lastSoldierSentAt) / 1000) : Math.floor(game.global.lastBreedTime / 1000)) >= antistacklimitv && game.global.antiStacks < antistacklimitv) {
                    mapsClicked(true);
              	}
                else if (game.global.antiStacks == antistacklimitv)
                    mapsClicked(true);
            }
            else
                mapsClicked(true);
        }
        return;
}

export function forceAbandonTrimps() {
    if (!getPageSetting('ForceAbandon')) return;
    if (!game.global.mapsUnlocked) return;
    if (game.global.mapsActive && getCurrentMapObject().location == "Void") return;
    if (game.global.preMapsActive) return;
    // #249 — this was `&&`, and the two predicates are mutually exclusive by construction:
    // isActiveSpireAT() requires challengeActive != 'Daily' and disActiveSpireAT() requires == 'Daily'
    // (other.ts:88/92). So the conjunction was unsatisfiable and this function had no Spire exclusion
    // of its own — the Trimpicide tooltip's "Never fires in the Spire" was carried entirely by
    // trimpcide()'s separate `&& !game.global.spireActive` (other.ts:154), which happens to be the
    // only caller. Masked, not live, but one call site away from being live. Every sibling that means
    // "in either kind of Spire" spells it with OR; this was the repo's only `&&` of the pair.
    if ((isActiveSpireAT() || disActiveSpireAT()) && !game.global.mapsActive) return;
    if (getPageSetting('AutoMaps')) {
        mapsClicked();
        if (game.global.switchToMaps || game.global.switchToWorld)
            mapsClicked();
    	}
	else if (game.global.mapsActive) {
        mapsClicked();
        if (game.global.switchToMaps)
            mapsClicked();
        runMap();
    	}
	else {
        mapsClicked();
        if (game.global.switchToMaps)
            mapsClicked();
        mapsClicked();
    }

}
