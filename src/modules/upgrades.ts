// TRUE-TS (Phase 1 · Wave 2, #29): faithful port of legacy/modules/upgrades.js, now
// strict-typed. Upgrade purchase, giga-station automation, golden upgrades (U1 + U2 radon
// R* family). Native/AT globals typed ambient in src/game/*.d.ts and read by bare name (no
// imports → esbuild byte-identical to the @ts-nocheck original, the conversion gate).
// getPageSetting/debug/setPageSetting imported from converted utils. TWO seam notes:
//   1. upgradeList + RupgradeList are read by still-legacy query.js by bare name, so they
//      publish to globalThis (shared-var seam) rather than module-scoped var.
//   2. (#63 removed the dead module-scoped needGymystic() function — never invoked, and kept
//      unexported only to avoid the bridge overwriting AutoTrimps2.js's same-named boolean, which
//      is now itself retired.)
//
// IDIOMATIC (Phase 2 · #51): un-minified behind the proof-net (tests/upgrades.characterization.test.ts
//   pins every branch first; L0 backstop ∅). var→const/let, ==→=== where operands are provably the
//   same runtime type. Kept LOOSE deliberately: every getPageSetting(...) comparison (getPageSetting
//   is polymorphic — boolean/string/number/int[]/undefined, see utils.ts) and getEmpowerment()==
//   "Wind" (getEmpowerment returns string|false). Every numeric literal + formula shape is preserved
//   exactly (balance is sacrosanct).
import { getPageSetting, debug, setPageSetting } from './utils'

//Helium

globalThis.upgradeList = ['Miners', 'Scientists', 'Coordination', 'Speedminer', 'Speedlumber', 'Speedfarming', 'Speedscience', 'Speedexplorer', 'Megaminer', 'Megalumber', 'Megafarming', 'Megascience', 'Efficiency', 'TrainTacular', 'Trainers', 'Explorers', 'Blockmaster', 'Battle', 'Bloodlust', 'Bounty', 'Egg', 'Anger', 'Formations', 'Dominance', 'Barrier', 'UberHut', 'UberHouse', 'UberMansion', 'UberHotel', 'UberResort', 'Trapstorm', 'Gigastation', 'Shieldblock', 'Potency', 'Magmamancers'];
MODULES["upgrades"] = {};
MODULES["upgrades"].targetFuelZone = true;
MODULES["upgrades"].customMetalRatio = 0.5; //Change the Custom Delta factor instead

export function gigaTargetZone() {
    //Init
    let targetZone = 59;
    const daily = game.global.challengeActive === 'Daily';
    const runningC2 = game.global.runningChallengeSquared;
    const heliumChallengeActive = game.global.challengeActive && game.challenges[game.global.challengeActive].heliumThrough;

    //Try setting target zone to the zone we finish our current challenge or do our void maps
    const voidZone = daily ? getPageSetting('DailyVoidMod') : getPageSetting('VoidMaps');
    const challengeZone = heliumChallengeActive ? game.challenges[game.global.challengeActive].heliumThrough : 0;

    //Also consider the zone we configured our portal to be used
    let portalZone = 0;
    if (autoTrimpSettings.AutoPortal.selected === "Helium Per Hour") portalZone = daily ? getPageSetting('dHeHrDontPortalBefore') : getPageSetting('HeHrDontPortalBefore');
    else if (autoTrimpSettings.AutoPortal.selected === "Custom") portalZone = daily ? getPageSetting('dCustomAutoPortal') : getPageSetting('CustomAutoPortal');

    //Finds a target zone for when doing c2
    let c2zone = 0;
    if (getPageSetting('c2runnerstart') == true && getPageSetting("c2runnerportal") > 0) c2zone = getPageSetting("c2runnerportal");
    else if (getPageSetting("FinishC2") > 0) c2zone = getPageSetting("FinishC2");

    //Set targetZone
    if (!runningC2) targetZone = Math.max(targetZone, voidZone, challengeZone, portalZone - 1);
    else targetZone = Math.max(targetZone, c2zone - 1);

    //Target Fuel Zone
    if (daily && getPageSetting("AutoGenDC") != 0) targetZone = Math.min(targetZone, 230);
    if (runningC2 && getPageSetting("AutoGenC2") != 0) targetZone = Math.min(targetZone, 230);
    if (MODULES.upgrades.targetFuelZone && (getPageSetting("fuellater") >= 1 || getPageSetting("beforegen") != 0)) targetZone = Math.min(targetZone, Math.max(230, getPageSetting("fuellater")));

    //Failsafe
    // #297 — the boundary was `< 60`, and 60 is the ONE value that breaks autoGiga's arithmetic:
    // nGigas is min(floor(targetZone - 60), …), so it is exactly 0 for every targetZone in [60, 61),
    // and autoGiga's fixed-point loop ends `delta /= nGigas`. `60 < 60` is false, so 60 sailed
    // through the failsafe that exists to catch precisely "this is not a usable target zone" — and
    // `VoidMaps = 60` was the reporter's sole trigger, an entirely ordinary setting. The predicate is
    // now `!(targetZone >= 61)` rather than `targetZone < 61` because NaN also has to land here: a
    // poisoned store (#237's class) makes voidZone NaN, Math.max propagates it, and `NaN < 61` is
    // FALSE — so the strictly-less form would wave the one value through that breaks every consumer.
    if (!(targetZone >= 61)) {
        const badZone = targetZone;
        targetZone = Math.max(65, game.global.highestLevelCleared);
        // Latched per (reason, zone) like other-praiding.ts:1437 and mapfunctions-amp.ts:105. This
        // line is reached on every tick that firstGiga runs — which is every tick until the first
        // Gigastation is owned — so an unlatched debug() is one log line per tick forever. That was
        // half of #297's reported symptom, and it is pre-existing for any user whose target zone is
        // below 60; fixing the NaN without latching would just swap one per-tick line for another.
        warnGigaOnce("targetZone=" + badZone, "Unable to find a proper targetZone (" + badZone + "). Using your HZE instead");
    }

    return targetZone;
}

// #297 — warn-once-per-zone latch for the giga-pattern diagnostics. Keyed by the REASON string (which
// carries the offending value), not by a bare boolean: a latch keyed too coarsely lets whichever
// broken input arrives first silence every other one's only diagnostic, and these warnings are the
// sole surface for a state where AT deliberately does nothing (#176/#227 are the same lesson). The
// zone value is the re-arm, so a persisting fault is still visible once per zone rather than 10x/sec.
const gigaWarnedZone: Record<string, number> = {};
function warnGigaOnce(reason: string, message: string) {
    if (gigaWarnedZone[reason] === game.global.world) return;
    gigaWarnedZone[reason] = game.global.world;
    debug("Auto Gigastation: Warning! " + message, "general", "*rocket");
}

// The refusal half: warn, then hand back the NaN that autoGiga's contract defines as "no pattern".
// Returning NaN rather than a made-up number is deliberate — every candidate fallback (the declared
// default, the previously stored delta, 0) is a guess about a pattern the arithmetic could not
// produce, and firstGiga's job is to leave the user's stored pattern alone instead.
function warnNoGigaPattern(reason: string, why: string): number {
    warnGigaOnce(reason, "Leaving the giga pattern unchanged — " + why);
    return NaN;
}

// #297 — RETURNS NaN when no pattern is computable, and that is a contract, not an accident: the
// caller must not persist it. The final line's `+(Math.round(delta + "e+2") + "e-2")` string
// round-trip is a funnel that converts EVERY non-finite intermediate into NaN — `Infinity + "e+2"` is
// the string "Infinitye+2", Math.round of that is NaN, and `+"NaNe-2"` is NaN — so five arithmetically
// distinct faults used to arrive as one indistinguishable value, which firstGiga then wrote into
// DeltaGigastation. `JSON.stringify({d: NaN})` is `{"d":null}`, so the corruption outlived the tab, and
// all three read sites compare with `<` (`x < NaN` is false for every x), inverting each guard — the
// #202 shape. Each route is therefore refused at its own source, with the offending value named: a
// single isFinite check on the result would stop the corruption but could not tell the user WHICH
// input is broken, and one of them (the delta factor) is a setting they can fix.
export function autoGiga(targetZone?: number, metalRatio = 0.5, slowDown = 10, customBase?: number) {
    //Pre Init
    // The guard was `!targetZone || targetZone < 60`. Two values got past it: an explicitly-passed 60
    // (the caller's own arm, so layer one alone would not have closed this route), and ±Infinity,
    // which is `>= 61` yet makes megabook^(zone - baseZone) infinite. `Number.isFinite` rejects
    // undefined and NaN; the `< 61` arm still carries 0 and every too-shallow zone.
    const zone = Number.isFinite(targetZone as number) && (targetZone as number) >= 61 ? targetZone as number : gigaTargetZone();

    //Init
    const base = customBase ? customBase : getPageSetting('FirstGigastation');
    const baseZone = game.global.world;
    const rawPop = game.resources.trimps.max - game.unlocks.impCount.TauntimpAdded;
    const gemsPS = getPerSecBeforeManual("Dragimp");
    const metalPS = getPerSecBeforeManual("Miner");
    const megabook = game.global.frugalDone ? 1.6 : 1.5;

    //Calculus
    const nGigas = Math.min(Math.floor(zone - 60), Math.floor(zone / 2 - 25), Math.floor(zone / 3 - 12), Math.floor(zone / 5), Math.floor(zone / 10 + 17), 39);
    const metalDiff = Math.max(0.1 * metalRatio * metalPS / gemsPS, 1);

    // The remaining routes to a non-finite delta, each refused with its own reason so the latch above
    // cannot let one silence another. Every one of them is reachable through this exported signature
    // and driven by a test; none is a defensive comment.
    //   metalDiff    → gemsPS 0 with metalPS > 0 gives Infinity, 0/0 gives NaN, and Math.max(NaN, 1)
    //                  is NaN, so one guard on the quotient covers every income route including a
    //                  non-finite metalPS
    //   rawPop <= 0  → `pop /= rawPop`
    //   slowDown <= 0 → delta 0 or negative → Math.log gives -Infinity or NaN
    //   base         → a poisoned FirstGigastation (#237's class) or customBase poisons pop directly
    // Deliberately NOT guarded here: `nGigas < 1`, the route the live report actually hit. It is
    // unreachable once `zone` is >= 61 (nGigas is min(floor(zone - 60), …), whose binding term is 1 at
    // 61 and rises from there), and a guard no caller can reach is a comment pretending to be code —
    // the #248/#225 class this campaign keeps filing. The zone guard above is where that route dies;
    // the finite check after the loop is what catches anything this list has missed.
    if (!Number.isFinite(metalDiff)) return warnNoGigaPattern("metalDiff=" + metalDiff, "cannot weigh metal against gems (metal/sec " + metalPS + ", gems/sec " + gemsPS + ")");
    if (!(rawPop > 0)) return warnNoGigaPattern("rawPop=" + rawPop, "population is " + rawPop);
    if (!(slowDown > 0)) return warnNoGigaPattern("slowDown=" + slowDown, "the delta factor is " + slowDown + " — set Custom Delta Factor to 1 or more, or below 1 to use the default");
    if (!Number.isFinite(base)) return warnNoGigaPattern("base=" + base, "the first-Gigastation count is " + base);

    let delta = 3;
    for (let i = 0; i < 10; i++) {
        //Population guess
        let pop = 6 * Math.pow(1.2, nGigas) * 10000;
        pop *= base * (1 - Math.pow(5 / 6, nGigas + 1)) + delta * (nGigas + 1 - 5 * (1 - Math.pow(5 / 6, nGigas + 1)));
        pop += rawPop - base * 10000;
        pop /= rawPop;

        //Delta
        delta = Math.pow(megabook, zone - baseZone);
        delta *= metalDiff * slowDown * pop;
        delta /= Math.pow(1.75, nGigas);
        delta = Math.log(delta);
        delta /= Math.log(1.4);
        delta /= nGigas;
    }

    //Returns a number in the x.yy format, and as a number, not a string
    const pattern = +(Math.round((delta + "e+2") as any) + "e-2");

    // The funnel itself, closed. Every guard above is an INPUT check, and no list of input checks is a
    // proof about the output: a finite-but-enormous target zone (megabook ** 1e300 is Infinity)
    // overflows inside the loop with nothing invalid anywhere in the inputs. Refusing on the result is
    // the only check that cannot be reasoned around, so it stays even though the named routes are
    // covered — a NaN reaching setPageSetting is permanent damage (#237), and one comparison is cheap.
    if (!Number.isFinite(pattern)) return warnNoGigaPattern("pattern=" + pattern, "the pattern arithmetic overflowed for target zone " + zone);
    return pattern;
}

export function firstGiga(forced?: boolean) {
    //Build our first giga if: A) Has more than 2 Warps & B) Can't afford more Coords & C)* Lacking Health or Damage & D)* Has run at least 1 map stack or if forced to
    // #68: was `challengeActive === "Daily" ? getPageSetting('dMaxMapBonushealth') : getPageSetting('MaxMapBonushealth')`.
    // 'dMaxMapBonushealth' has NEVER been createSetting'd — not in this repo's whole history — so on a
    // Daily this evaluated to false, and the `game.global.mapBonus >= maxHealthMaps` test below became
    // `mapBonus >= 0`: ALWAYS TRUE. The map-bonus-health gate on firstGiga was therefore entirely absent
    // on dailies. Collapsed onto the setting that does exist rather than minting a daily twin: the very
    // next disjunct reads 'MaxMapBonuslimit' — the sibling map-bonus cap, in this same expression —
    // with no daily variant at all, so unconditional is this code's own convention. Minting
    // 'dMaxMapBonushealth' would be a new user-facing setting with a new default: a product decision,
    // not a phantom fix. ⚠️ This DOES change daily behaviour (that is the bug): firstGiga is no longer
    // force-allowed at mapBonus 0-1 on a Daily. No balance literal changed — 'MaxMapBonushealth' keeps
    // its own default of 10.
    const maxHealthMaps = getPageSetting('MaxMapBonushealth');
    const s = !(getPageSetting('CustomDeltaFactor') > 20);
    const a = game.buildings.Warpstation.owned >= 2;
    const b = !canAffordCoordinationTrimps() || game.global.world >= 230 && !canAffordTwoLevel(game.upgrades.Coordination);
    const c = s || !enoughHealth || !enoughDamage;
    const d = s || game.global.mapBonus >= 2 || game.global.mapBonus >= getPageSetting('MaxMapBonuslimit') || game.global.mapBonus >= maxHealthMaps;
    if (!forced && !(a && b && c && d)) return false;

    //Define Base and Delta for this run
    const base = game.buildings.Warpstation.owned;
    // #297 — LEFT AT 60 DELIBERATELY. `CustomTargetZone = 60` is the one route a user can drive the
    // explicit-zone arm down, and tightening this to `>= 61` looked like the obvious matching fix — but
    // it is inert: 60 then reaches autoGiga, whose own guard re-derives it to the same zone this line
    // would have. A mutant reverting `>= 61` to `>= 60` survived the whole suite, because there is no
    // observable difference to assert. An unprovable edit is not a fix, so the boundary is enforced in
    // exactly one place (autoGiga) and this line is left alone. The tooltip DID have to move: whichever
    // line does the discarding, "values below 60 are discarded" is now false for 60 itself.
    const deltaZ = getPageSetting('CustomTargetZone') >= 60 ? getPageSetting('CustomTargetZone') : undefined;
    const deltaM = MODULES["upgrades"].customMetalRatio > 0 ? MODULES["upgrades"].customMetalRatio : undefined;
    const deltaS = getPageSetting('CustomDeltaFactor') >= 1 ? getPageSetting('CustomDeltaFactor') : undefined;
    const delta = autoGiga(deltaZ, deltaM, deltaS);

    // #297 — autoGiga returns NaN for "no pattern is computable", and this is the line that used to
    // persist it: `setPageSetting` wrote it verbatim, serializeSettings flattened it to
    // `{"DeltaGigastation":null}`, and createSetting keeps a stored null forever because
    // `null !== undefined` — so one bad tick poisoned the setting permanently, across reloads, and
    // every consumer's `<` comparison against NaN then reported the opposite of what it meant.
    // Bailing before BOTH writes is deliberate: FirstGigastation is re-pinned to the live Warpstation
    // count on purpose (it is what makes `owned < floor(0 * delta) + first` false so the first
    // Gigastation can be bought at all — #107), but pinning a new base against a delta that does not
    // exist would just move the corruption one setting over. autoGiga has already warned, latched by
    // reason, so this bail is diagnosed rather than silent.
    if (!Number.isFinite(delta)) return false;

    //Save settings
    setPageSetting('FirstGigastation', base);
    setPageSetting('DeltaGigastation', delta);

    //Log
    debug("Auto Gigastation: Setting pattern to " + base + "+" + delta, "general", "*rocket");

    return true;
}

export function buyUpgrades() {

    //#43: Metal challenge — Efficiency doubles player mining, the only metal source during Metal.
    //Rush it above every other upgrade below the configured zone. Opt-in; OFF = unchanged.
    //#216: `challengeActive('Metal')`, NOT `game.global.challengeActive === 'Metal'`. During a
    //Challenge² the game stores the PARENT name and puts the children in game.global.multiChallenge
    //(updates.js:4673-4680), so the direct compare is false throughout Nometal² (parent "Nometal",
    //children ["Nom","Metal"]) while every rule this feature exists for is fully active — metal loot
    //is voided (main.js:17770) and the Megaminer book is confiscated (config.js:11167). The game's own
    //predicate (main.js:1753) checks multiChallenge first, and jobs.ts already uses it for this very
    //challenge in four places, so AT was contradicting itself within a single tick: refusing to buy
    //Miners because Metal is active, while declining to rush Efficiency because it is not.
    if (getPageSetting('MetalEfficiencyPriority') && challengeActive('Metal') &&
        game.global.world < getPageSetting('MetalEfficiencyZone')) {
        const efficiency = game.upgrades['Efficiency'];
        if (efficiency && efficiency.allowed > efficiency.done && canAffordTwoLevel(efficiency)) {
            buyUpgrade('Efficiency', true, true);
        }
    }

    for (const upgrade of upgradeList) {
        const gameUpgrade = game.upgrades[upgrade];
        const available = gameUpgrade.allowed > gameUpgrade.done && canAffordTwoLevel(gameUpgrade);
        const structureHandoffGiga = (bwRewardUnlocked("AutoStructure") === true && bwRewardUnlocked("DecaBuild") && getPageSetting('hidebuildings') == true && getPageSetting('BuyBuildingsNew') == 0);

        //Coord & Amals
        if (upgrade === 'Coordination' && (getPageSetting('BuyUpgradesNew') == 2 || !canAffordCoordinationTrimps())) continue;
        if (upgrade === 'Coordination' && getPageSetting('amalcoord') == true && getPageSetting('amalcoordhd') > 0 && calcHDratio() < getPageSetting('amalcoordhd') && ((getPageSetting('amalcoordt') < 0 && (game.global.world < getPageSetting('amalcoordz') || getPageSetting('amalcoordz') < 0)) || (getPageSetting('amalcoordt') > 0 && getPageSetting('amalcoordt') > game.jobs.Amalgamator.owned && (game.resources.trimps.realMax() / game.resources.trimps.getCurrentSend()) > 2000))) continue;

        //WS
        if (
            upgrade === 'Coordination' && getEmpowerment() == "Wind" &&
            (
                (getPageSetting('AutoStance') == 3 && game.global.challengeActive !== "Daily" && getPageSetting('WindStackingMin') > 0 && game.global.world >= getPageSetting('WindStackingMin') && calcHDratio() < 5) ||
                (getPageSetting('use3daily') == true && game.global.challengeActive === "Daily" && getPageSetting('dWindStackingMin') > 0 && game.global.world >= getPageSetting('dWindStackingMin') && calcHDratio() < 5)
            )
        ) continue;

        if (
            upgrade === 'Coordination' &&
            (
                (getPageSetting('AutoStance') == 3 && game.global.challengeActive !== "Daily" && getPageSetting('wsmax') > 0 && getPageSetting('wsmaxhd') > 0 && game.global.world >= getPageSetting('wsmax') && calcHDratio() < getPageSetting('wsmaxhd')) ||
                (getPageSetting('use3daily') == true && game.global.challengeActive === "Daily" && getPageSetting('dwsmax') > 0 && getPageSetting('dwsmaxhd') > 0 && game.global.world >= getPageSetting('dwsmax') && calcHDratio() < getPageSetting('dwsmaxhd'))
            )
        ) continue;

        //Gigastations
        if (upgrade === 'Gigastation' && !structureHandoffGiga) {
            if (getPageSetting("AutoGigas") && game.upgrades.Gigastation.done === 0 && !firstGiga()) continue;
            else if (game.buildings.Warpstation.owned < (Math.floor(game.upgrades.Gigastation.done * getPageSetting('DeltaGigastation')) + getPageSetting('FirstGigastation'))) continue;
        }

        //Other
        if (upgrade === 'Shieldblock' && !getPageSetting('BuyShieldblock')) continue;
        if (upgrade === 'Gigastation' && !structureHandoffGiga && (game.global.lastWarp ? game.buildings.Warpstation.owned < (Math.floor(game.upgrades.Gigastation.done * getPageSetting('DeltaGigastation')) + getPageSetting('FirstGigastation')) : game.buildings.Warpstation.owned < getPageSetting('FirstGigastation'))) continue;
        if (upgrade === 'Bloodlust' && game.global.challengeActive === 'Scientist' && getPageSetting('BetterAutoFight')) continue;

        if (!available) continue;
        // #144 — Scientists-first, but ONLY while Scientists is actually affordable. The gate used to be
        // unconditional (`done < allowed`), which deadlocked the early run: Scientists costs 350 food, and
        // when AT's own Hut buys hold food below that, Scientists is never affordable — so this gate blocked
        // every OTHER upgrade forever, including an affordable Miners (300 wood). Worse, it blocked
        // Speedfarming, the food-boosting upgrade that makes Scientists affordable sooner, so the gate was
        // self-defeating. Adding canAffordTwoLevel measured strictly better: Miners bought immediately,
        // Scientists bought ~15% SOONER, world 4 reached ~13% faster and more reliably (5-seed A/B on the
        // reporter's save). Intent preserved: when Scientists IS affordable it is still bought first.
        if (game.upgrades.Scientists.done < game.upgrades.Scientists.allowed && upgrade !== 'Scientists' && canAffordTwoLevel(game.upgrades.Scientists)) continue;
        buyUpgrade(upgrade, true, true);
        debug('Upgraded ' + upgrade, "upgrades", "*upload2");
    }
}

//Radon

globalThis.RupgradeList = ['Miners', 'Scientists', 'Coordination', 'Speedminer', 'Speedlumber', 'Speedfarming', 'Speedscience', 'Speedexplorer', 'Megaminer', 'Megalumber', 'Megafarming', 'Megascience', 'Efficiency', 'Explorers', 'Battle', 'Bloodlust', 'Bounty', 'Egg', 'Rage', 'Prismatic', 'Prismalicious', 'Formations', 'Dominance', 'UberHut', 'UberHouse', 'UberMansion', 'UberHotel', 'UberResort', 'Trapstorm', 'Potency'];

export function RbuyUpgrades() {

    for (const upgrade of RupgradeList) {
        const gameUpgrade = game.upgrades[upgrade];
        const available = gameUpgrade.allowed > gameUpgrade.done && canAffordTwoLevel(gameUpgrade);

        //Coord
        if (upgrade === 'Coordination' && (getPageSetting('RBuyUpgradesNew') == 2 || !canAffordCoordinationTrimps())) continue;

        //Other
        if (!available) continue;
        // #144 — see buyUpgrades: same self-defeating deadlock, same fix for the U2/radon path.
        if (game.upgrades.Scientists.done < game.upgrades.Scientists.allowed && upgrade !== 'Scientists' && canAffordTwoLevel(game.upgrades.Scientists)) continue;
        buyUpgrade(upgrade, true, true);
        debug('Upgraded ' + upgrade, "upgrades", "*upload2");
    }
}

export function RautoGoldenUpgradesAT(setting: string) {
    let num = getAvailableGoldenUpgrades();
    let setting2;
    if (num === 0) return;
    if (setting === "Radon")
        setting2 = "Helium";
    if ((!game.global.dailyChallenge.seed && !game.global.runningChallengeSquared && autoTrimpSettings.RAutoGoldenUpgrades.selected === "Radon" && getPageSetting('Rradonbattle') > 0 && game.goldenUpgrades.Helium.purchasedAt.length >= getPageSetting('Rradonbattle')) || (game.global.dailyChallenge.seed && autoTrimpSettings.RdAutoGoldenUpgrades.selected === "Radon" && getPageSetting('Rdradonbattle') > 0 && game.goldenUpgrades.Helium.purchasedAt.length >= getPageSetting('Rdradonbattle')))
        setting2 = "Battle";
    if (setting === "Battle")
        setting2 = "Battle";
    if ((!game.global.dailyChallenge.seed && !game.global.runningChallengeSquared && autoTrimpSettings.RAutoGoldenUpgrades.selected === "Battle" && getPageSetting('Rbattleradon') > 0 && game.goldenUpgrades.Battle.purchasedAt.length >= getPageSetting('Rbattleradon')) || (game.global.dailyChallenge.seed && autoTrimpSettings.RdAutoGoldenUpgrades.selected === "Battle" && getPageSetting('Rdbattleradon') > 0 && game.goldenUpgrades.Battle.purchasedAt.length >= getPageSetting('Rdbattleradon')))
        setting2 = "Helium";
    if (setting === "Void" || setting === "Void + Battle")
        setting2 = "Void";
    if (game.global.challengeActive === "Mayhem" || game.global.challengeActive === "Pandemonium" || game.global.challengeActive === "Desolation") {
        setting2 = "Battle";
    }
    const success = buyGoldenUpgrade(setting2);
    if (!success && setting2 === "Void") {
        num = getAvailableGoldenUpgrades();
        if (num === 0) return;
        if ((autoTrimpSettings.RAutoGoldenUpgrades.selected === "Void" && !game.global.dailyChallenge.seed && !game.global.runningChallengeSquared) || (autoTrimpSettings.RdAutoGoldenUpgrades.selected === "Void" && game.global.dailyChallenge.seed))
            setting2 = "Helium";
        if (((autoTrimpSettings.RAutoGoldenUpgrades.selected === "Void" && getPageSetting('Rvoidheliumbattle') > 0 && game.global.world >= getPageSetting('Rvoidheliumbattle')) || (autoTrimpSettings.RdAutoGoldenUpgrades.selected === "Void" && getPageSetting('Rdvoidheliumbattle') > 0 && game.global.world >= getPageSetting('Rdvoidheliumbattle'))) || ((autoTrimpSettings.RAutoGoldenUpgrades.selected === "Void + Battle" && !game.global.dailyChallenge.seed && !game.global.runningChallengeSquared) || (autoTrimpSettings.RdAutoGoldenUpgrades.selected === "Void + Battle" && game.global.dailyChallenge.seed) || (autoTrimpSettings.RcAutoGoldenUpgrades.selected === "Void + Battle" && game.global.runningChallengeSquared)))
            setting2 = "Battle";
        buyGoldenUpgrade(setting2);
    }
}
