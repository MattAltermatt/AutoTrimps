// TRUE TS (Phase 1 · #30): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/portal.js.
// Auto-portal / helium-per-hour logic. Registers MODULES["portal"]. getPageSetting/debug from
// converted utils (portal.js line 4 reads getPageSetting at load — now imported, resolves).
// zonePostpone -> globalThis (read by AutoTrimps2). challengeSquaredMode is the GAME's var
// (main.js:1663) — #206: this header used to claim it was "portal-internal", and the module declared
// its own `var` of that name on the strength of that claim, which swallowed all 11 of C2 Runner's
// writes so activatePortal() (main.js:4013) never saw them and every C2 Runner portal started a
// PLAIN challenge. It is written through globalThis and declared ambient instead.
// The dead module-level portalzone/Rportalzone/
// module vars (internal). AutoPerks.clickAllocate() etc. resolve via the bridge at runtime,
// typed ambient. Behaviour-preserving: any body edits are TYPE-ONLY.
import { getPageSetting, debug } from './utils'

MODULES["portal"] = {};
MODULES["portal"].timeout = 5000;
MODULES["portal"].bufferExceedFactor = 5;
globalThis.zonePostpone = 0;

export function autoPortal() {
    if (!game.global.portalActive) return;
    switch (autoTrimpSettings.AutoPortal.selected) {
        case "Helium Per Hour":
            var OKtoPortal = false;
            if (!game.global.runningChallengeSquared) {
                var minZone = getPageSetting('HeHrDontPortalBefore');
                game.stats.bestHeliumHourThisRun.evaluate();
                var bestHeHr = game.stats.bestHeliumHourThisRun.storedValue;
                var bestHeHrZone = game.stats.bestHeliumHourThisRun.atZone;
                var myHeliumHr = game.stats.heliumHour.value();
                var heliumHrBuffer = Math.abs(getPageSetting('HeliumHrBuffer'));
                if (!aWholeNewWorld)
                    heliumHrBuffer *= MODULES["portal"].bufferExceedFactor;
                var bufferExceeded = myHeliumHr < bestHeHr * (1 - (heliumHrBuffer / 100));
                if (bufferExceeded && game.global.world >= minZone) {
                    OKtoPortal = true;
                    if (aWholeNewWorld)
                        zonePostpone = 0;
                }
                if (heliumHrBuffer == 0 && !aWholeNewWorld)
                    OKtoPortal = false;
                if (OKtoPortal && zonePostpone == 0) {
                    zonePostpone += 1;
                    debug("My HeliumHr was: " + myHeliumHr + " & the Best HeliumHr was: " + bestHeHr + " at zone: " + bestHeHrZone, "portal");
                    cancelTooltip();
                    tooltip('confirm', null, 'update', '<b>Auto Portaling NOW!</b><p>Hit Delay Portal to WAIT 1 more zone.', 'zonePostpone+=1', '<b>NOTICE: Auto-Portaling in 5 seconds....</b>', 'Delay Portal');
                    setTimeout(cancelTooltip, MODULES["portal"].timeout);
                    setTimeout(function() {
                        if (zonePostpone >= 2)
                            return;
                        if (autoTrimpSettings.HeliumHourChallenge.selected != 'None')
                            doPortal(autoTrimpSettings.HeliumHourChallenge.selected);
                        else
                            doPortal();
                    }, MODULES["portal"].timeout + 100);
                }
            }
            break;
        case "Custom":
            var portalzone = getPageSetting('CustomAutoPortal');
            if (game.global.world > portalzone) {
                if (autoTrimpSettings.HeliumHourChallenge.selected != 'None')
                    doPortal(autoTrimpSettings.HeliumHourChallenge.selected);
                else
                    doPortal();
            }
            break;
        case "Balance":
        case "Decay":
        case "Electricity":
        case "Life":
        case "Crushed":
        case "Nom":
        case "Toxicity":
            // #68: the `if (getPageSetting('MaxTox')) settingChanged("MaxTox");` that stood here is
            // DELETED, not defined. 'MaxTox' was a real setting (it is still carried in the frozen
            // serializeSettings blobs) that upstream deleted, leaving this read behind. getPageSetting
            // returns false for it, so the guard never fires — but it is a LANDMINE, not merely dead:
            // settingChanged("MaxTox") does a getElementById on a control that no longer exists, so
            // minting the setting to "fix" the phantom would turn a dead guard into a THROW inside the
            // portal path (and, with no mainLoop error boundary (#87), take out every automation after
            // it). Deleting the reader is the only disposition that mints nothing and disarms it.
            // The empty case falls through to "Watch" exactly as before.
            // falls through
        case "Watch":
        case "Lead":
        case "Corrupted":
        case "Domination":
        case "Experience":
            if (!game.global.challengeActive) {
                doPortal(autoTrimpSettings.AutoPortal.selected);
            }
            break;
        default:
            break;
    }
}

export function dailyAutoPortal() {
    if (!game.global.portalActive) return;
    if (getPageSetting('AutoPortalDaily') == 1) {
        var OKtoPortal = false;
        if (!game.global.runningChallengeSquared) {
            var minZone = getPageSetting('dHeHrDontPortalBefore');
            game.stats.bestHeliumHourThisRun.evaluate();
            var bestHeHr = game.stats.bestHeliumHourThisRun.storedValue;
            var bestHeHrZone = game.stats.bestHeliumHourThisRun.atZone;
            var myHeliumHr = game.stats.heliumHour.value();
            var heliumHrBuffer = Math.abs(getPageSetting('dHeliumHrBuffer'));
            // #83 §2: NO BRACE. The guard covers only the buffer scale-up, exactly as the correct
            // siblings autoPortal() and RautoPortal() do. A brace here swallowed the whole body, so
            // the zone-boundary path (aWholeNewWorld true) — the one that was supposed to portal —
            // was skipped entirely, and the mid-zone path self-cancelled at the default buffer of 0.
            if (!aWholeNewWorld)
                heliumHrBuffer *= MODULES["portal"].bufferExceedFactor;
            var bufferExceeded = myHeliumHr < bestHeHr * (1 - (heliumHrBuffer / 100));
            if (bufferExceeded && game.global.world >= minZone) {
                OKtoPortal = true;
                if (aWholeNewWorld)
                    zonePostpone = 0;
            }
            if (heliumHrBuffer == 0 && !aWholeNewWorld)
                OKtoPortal = false;
            if (OKtoPortal && zonePostpone == 0) {
                zonePostpone += 1;
                debug("My HeliumHr was: " + myHeliumHr + " & the Best HeliumHr was: " + bestHeHr + " at zone: " + bestHeHrZone, "portal");
                cancelTooltip();
                tooltip('confirm', null, 'update', '<b>Auto Portaling NOW!</b><p>Hit Delay Portal to WAIT 1 more zone.', 'zonePostpone+=1', '<b>NOTICE: Auto-Portaling in 5 seconds....</b>', 'Delay Portal');
                setTimeout(cancelTooltip, MODULES["portal"].timeout);
                setTimeout(function() {
                    if (zonePostpone >= 2)
                        return;
                    if (OKtoPortal) {
                        abandonDaily();
                        document.getElementById('finishDailyBtnContainer')!.style.display = 'none';
                    }
                    if (autoTrimpSettings.dHeliumHourChallenge.selected != 'None' && getPageSetting('u1daily') == false)
                        doPortal(autoTrimpSettings.dHeliumHourChallenge.selected);
                    else if (autoTrimpSettings.RdHeliumHourChallenge.selected != 'None' && getPageSetting('u1daily') == true)
                        doPortal(autoTrimpSettings.RdHeliumHourChallenge.selected);
                    else
                        doPortal();
                }, MODULES["portal"].timeout + 100);
            }
        }
    }
    if (getPageSetting('AutoPortalDaily') == 2) {
        var portalzone = getPageSetting('dCustomAutoPortal');
        if (game.global.world > portalzone) {
            abandonDaily();
            document.getElementById('finishDailyBtnContainer')!.style.display = 'none';
            if (autoTrimpSettings.dHeliumHourChallenge.selected != 'None' && getPageSetting('u1daily') == false)
                doPortal(autoTrimpSettings.dHeliumHourChallenge.selected);
	    else if (autoTrimpSettings.RdHeliumHourChallenge.selected != 'None' && getPageSetting('u1daily') == true)
                doPortal(autoTrimpSettings.RdHeliumHourChallenge.selected);
            else
                doPortal();
        }
    }
}

export function c2runnerportal() {
            if (game.global.world > getPageSetting('c2runnerportal')) {
                if (game.global.runningChallengeSquared)
                    abandonChallenge();
                if (autoTrimpSettings.HeliumHourChallenge.selected != 'None')
                    doPortal(autoTrimpSettings.HeliumHourChallenge.selected);
                else
                    doPortal();
            }
}

/**
 * Can the game actually OFFER `what` as a Challenge² on this portal?
 *
 * This DELEGATES rather than mirroring. In squared mode `displayChallenges()` skips a challenge
 * outright under five conditions (main.js:1774-1778 — blockU1, missing `allowU2`, the U2
 * highestRadonLevelCleared<49 gate, `!allowSquared`, and a FAILING `filter()`), and `selectChallenge`
 * then derefs `getElementById("challenge" + what)` **unconditionally** (main.js:1885). So handing it a
 * skipped challenge throws a TypeError, which aborts `doPortal` before `writePrePortalBackup()` and
 * `activatePortal()` — no portal, no pre-portal backup — and in the autoPortal path the throw is
 * raised inside a setTimeout callback, outside `atGuard`.
 *
 * #206 is what made that reachable. While the flag was module-private the renderer never entered
 * squared mode, so a filter-failing candidate could still be emitted as the `firstFail` challenge and
 * selectChallenge merely bailed with `selectedChallenge = ""` (the plain-challenge bug #206 fixed).
 * Note "could": `main.js:1778` renders only the FIRST filter-failing challenge, so even pre-#206 a
 * candidate later in `game.challenges` order than some other locked one already threw. Two arms below
 * have no unlock gate of their own — Discipline (needs 30 total helium, config.js:3290) and Electricity
 * (needs `prisonClear > 0`, i.e. z80, config.js:3604) — and those are the reachable cases.
 *
 * ⚠️ Two things this used to claim that are NOT derivable, both caught by review. (1) "a U1 player at
 * HZE 69-79 hits it" — the Electricity arm carries no HZE gate at all and Discipline's helium filter
 * passes far earlier, so no such window is implied by the code. (2) The U2 skips at main.js:1773-1774
 * are unreachable from here: `c2runner` has exactly ONE caller (`doPortal`, below), and main-loop.ts
 * dispatches doPortal only inside its `game.global.universe == 1` block, while the U2 twins go through
 * RdoPortal, which never calls this. `portalClicked()` sets `portalUniverse` from
 * `game.global.universe` first, so `portalUniverse` is always 1 here. Those two skip conditions are a
 * config fact, not a live motivation — delegation is still the better implementation because it cannot
 * drift when a clone bump adds a sixth skip condition, and THAT is the reason, not U2.
 *
 * The flag must be true BEFORE asking, because that is what puts the renderer into squared mode. A
 * negative answer restores it to `false`, which is provably the prior value rather than a guess:
 * `portalClicked()` sets it false unconditionally (main.js:1671) and `doPortal` calls that before
 * reaching this cascade, so there is no path into `c2runner` with the flag already true.
 */
function c2Selectable(what: string): boolean {
    globalThis.challengeSquaredMode = true;
    displayChallenges();
    if (document.getElementById('challenge' + what)) return true;
    globalThis.challengeSquaredMode = false;
    debug('C2 Runner: ' + what + ' cannot be started as a Challenge² right now (locked, or unavailable in this universe) - trying the next one.');
    return false;
}

export function c2runner() {

if (!game.global.portalActive) return;
    if (getPageSetting('c2runnerstart') == true && getPageSetting('c2runnerportal') > 0 && getPageSetting('c2runnerpercent') > 0) {
            if (game.global.highestLevelCleared > 34 && (100*(game.c2.Size/(game.global.highestLevelCleared+1))) < getPageSetting('c2runnerpercent') && c2Selectable('Size')) {
                globalThis.challengeSquaredMode = true;
                selectChallenge("Size");
                debug("C2 Runner: Running C2 Challenge Size");
            }
            else if (game.global.highestLevelCleared > 129 && (100*(game.c2.Slow/(game.global.highestLevelCleared+1))) < getPageSetting('c2runnerpercent') && c2Selectable('Slow')) {
                globalThis.challengeSquaredMode = true;
                selectChallenge("Slow");
                debug("C2 Runner: Running C2 Challenge Slow");
            }
            else if (game.global.highestLevelCleared > 179 && (100*(game.c2.Watch/(game.global.highestLevelCleared+1))) < getPageSetting('c2runnerpercent') && c2Selectable('Watch')) {
                globalThis.challengeSquaredMode = true;
                selectChallenge("Watch");
                debug("C2 Runner: Running C2 Challenge Watch");
            }
            else if ((100*(game.c2.Discipline/(game.global.highestLevelCleared+1))) < getPageSetting('c2runnerpercent') && c2Selectable('Discipline')) {
                globalThis.challengeSquaredMode = true;
                selectChallenge("Discipline");
                debug("C2 Runner: Running C2 Challenge Discipline");
            }
            else if (game.global.highestLevelCleared > 39 && (100*(game.c2.Balance/(game.global.highestLevelCleared+1))) < getPageSetting('c2runnerpercent') && c2Selectable('Balance')) {
                globalThis.challengeSquaredMode = true;
                selectChallenge("Balance");
                debug("C2 Runner: Running C2 Challenge Balance");
            }
            else if (game.global.highestLevelCleared > 44 && (100*(game.c2.Meditate/(game.global.highestLevelCleared+1))) < getPageSetting('c2runnerpercent') && c2Selectable('Meditate')) {
                globalThis.challengeSquaredMode = true;
                selectChallenge("Meditate");
                debug("C2 Runner: Running C2 Challenge Meditate");
            }
            else if (game.global.highestLevelCleared > 24 && (100*(game.c2.Metal/(game.global.highestLevelCleared+1))) < getPageSetting('c2runnerpercent') && c2Selectable('Metal')) {
                globalThis.challengeSquaredMode = true;
                selectChallenge("Metal");
                debug("C2 Runner: Running C2 Challenge Metal");
            }
            else if (game.global.highestLevelCleared > 179 && (100*(game.c2.Lead/(game.global.highestLevelCleared+1))) < getPageSetting('c2runnerpercent') && c2Selectable('Lead')) {
                globalThis.challengeSquaredMode = true;
                selectChallenge("Lead");
                debug("C2 Runner: Running C2 Challenge Lead");
            }
            else if (game.global.highestLevelCleared > 144 && (100*(game.c2.Nom/(game.global.highestLevelCleared+1))) < getPageSetting('c2runnerpercent') && c2Selectable('Nom')) {
                globalThis.challengeSquaredMode = true;
                selectChallenge("Nom");
                debug("C2 Runner: Running C2 Challenge Nom");
            }
            else if ((100*(game.c2.Electricity/(game.global.highestLevelCleared+1))) < getPageSetting('c2runnerpercent') && c2Selectable('Electricity')) {
                globalThis.challengeSquaredMode = true;
                selectChallenge("Electricity");
                debug("C2 Runner: Running C2 Challenge Electricity");
            }
            else if (game.global.highestLevelCleared > 164 && (100*(game.c2.Toxicity/(game.global.highestLevelCleared+1))) < getPageSetting('c2runnerpercent') && c2Selectable('Toxicity')) {
                globalThis.challengeSquaredMode = true;
                selectChallenge("Toxicity");
                debug("C2 Runner: Running C2 Challenge Toxicity");
            }
    }
}

export function doPortal(challenge?: any) {
    var c2done = true;
    if(!game.global.portalActive) return;
    if (getPageSetting('spendmagmite')==1) {
	autoMagmiteSpender();
    }
    // #65: was `typetokeep != 'None' && raretokeep != 'None'` — both always true. getPageSetting
    // returns typetokeep's numeric INDEX (0 = the 'None' option), never the label, and raretokeep's
    // dropdown has no 'None' entry at all ('Any' is its permissive value). So the guard collapsed to
    // just `autoheirlooms == true`, and autoheirlooms3() un-carries every heirloom before re-carrying
    // per typetokeep — with typetokeep = 0 no carry branch runs, so it stripped every carried heirloom.
    if (getPageSetting('autoheirlooms') == true && getPageSetting('typetokeep') != 0) {
	autoheirlooms3();
    }
    // #79: the guard here WAS `name != getPageSetting('highdmg') || name != getPageSetting('dhighdmg')`
    // — a TAUTOLOGY (a name cannot equal two distinct settings at once, so at least one `!=` always
    // holds), which then always ran a body hard-wired to the NON-daily 'highdmg' finder. The `||` is a
    // mangled Daily DISPATCH, and the codebase says so in three independent places:
    //   • heirlooms.ts highHeirloom()/dhighHeirloom() are this exact body, one per run type;
    //   • stance.ts:274/307 picks between them with `challengeActive !== "Daily"` / `=== "Daily"`;
    //   • equipment.ts + maps.ts dispatch this very setting PAIR ('highdmg' vs 'dhighdmg') the same way.
    // dhighdmgshield() existed all along for the daily half that was never wired up here. Calling the
    // two twins IS the intended code — their bodies are byte-identical to the block this replaces.
    if (game.global.challengeActive === "Daily") dhighHeirloom();
    else highHeirloom();
    if (getPageSetting('AutoAllocatePerks')==2) {
        viewPortalUpgrades();
	numTab(6, true)
	buyPortalUpgrade('Looting_II');
	activateClicked();
	cancelPortal();
	debug('First Stage: Bought Max Looting II');
    }
    portalClicked();
    if (!portalWindowOpen) {
	portalClicked();
    }
    // #82: this guard used to test `typeof MODULES["perks"] !== 'undefined' || typeof AutoPerks !==
    // 'undefined'` — both ALWAYS true (perks.ts assigns both unconditionally), so it never fired and
    // the call proceeded straight into an empty object. Test the thing we are about to call.
    if (portalWindowOpen && getPageSetting('AutoAllocatePerks')==1 && typeof AutoPerks?.clickAllocate === 'function') {
        AutoPerks.clickAllocate();
    }
    if (portalWindowOpen && getPageSetting('c2runnerstart')==true && getPageSetting('c2runnerportal') > 0 && getPageSetting('c2runnerpercent') > 0) {
        c2runner();
        if (globalThis.challengeSquaredMode == true) {
            c2done = false;
        }
        else debug("C2 Runner: All C2s above Threshold!");
    }
    if (portalWindowOpen && getPageSetting('AutoStartDaily') == true && c2done) {
	if (getPageSetting('u2daily') == true && portalUniverse == 1) {
	    swapPortalUniverse();
	}
        selectChallenge('Daily');
        checkCompleteDailies();
        var lastUndone = -7;
        while (++lastUndone <= 0) {
            var done = (game.global.recentDailies.indexOf(getDailyTimeString(lastUndone)) != -1);
            if (!done)
                break;
        }
        if (lastUndone == 1) {
            debug("All available Dailies already completed.", "portal");
	    if ((getPageSetting('u1daily') == true && portalUniverse == 1 && challenge == autoTrimpSettings.RdHeliumHourChallenge.selected) || (getPageSetting('u2daily') == true && portalUniverse == 2)) {
	        swapPortalUniverse();
	    }
            selectChallenge(challenge || 0);
        } else {
            getDailyChallenge(lastUndone);
            debug("Portaling into Daily for: " + getDailyTimeString(lastUndone, true) + " now!", "portal");
        }
    }
    else if(portalWindowOpen && challenge && c2done) {
	if (getPageSetting('u1daily') == true && portalUniverse == 1 && challenge == autoTrimpSettings.RdHeliumHourChallenge.selected) {
	    swapPortalUniverse();
	}
        selectChallenge(challenge);
    }
    if (portalWindowOpen && getPageSetting('AutoAllocatePerks')==2 && !game.portal.Looting_II.locked) {
	numTab(6, true)
	buyPortalUpgrade('Looting_II');
	debug('Second Stage: Bought Max Looting II');
    }
    // #124 — an auto-portal is the portal most likely to hurt: it fires unattended, possibly at 3am, and
    // it is irreversible. It gets the verified in-browser backup unconditionally (it is synchronous, it
    // cannot be cancelled and it costs nothing) but NEVER the file download — a download with no user
    // gesture trips Chrome's automatic-downloads permission, and once denied it fails SILENTLY forever,
    // which is exactly the false confidence this feature exists to avoid. Deliberately not gated: unlike
    // the manual button, refusing to portal here would strand an unattended run.
    writePrePortalBackup();
    activatePortal();
    lastHeliumZone = 0; zonePostpone = 0;
}

export function finishChallengeSquared() {
    var a = getPageSetting("FinishC2");
    if (game.global.world >= a) {
        abandonChallenge();
        debug("Finished challenge2 because we are on zone " + game.global.world, "other", "oil");
    }
}
export function findOutCurrentPortalLevel() {
    var a = -1;
    var b = !1;
    var d = getPageSetting("AutoPortal");
    switch (d) {
        case "Off":
            break;
        case "Custom":
            if ("Daily" != game.global.challengeActive) a = getPageSetting("CustomAutoPortal") + 1;
            // #68: was getPageSetting("Dailyportal") — a setting upstream DELETED (it is still carried
            // in the frozen serializeSettings blobs, so it must be REPOINTED, never re-minted: minting
            // would resurrect the value a veteran user stored years ago). getPageSetting returns false
            // for it, so this computed `false + 1` === 1 — i.e. on a Daily, AutoPortal="Custom" thought
            // the target zone was 1 and reported "portal at zone 1". 'dCustomAutoPortal' ("Daily Custom
            // Portal", default 999) is the live daily twin of the CustomAutoPortal read directly above.
            if ("Daily" == game.global.challengeActive) a = getPageSetting("dCustomAutoPortal") + 1;
            b = !("Lead" != getPageSetting("HeliumHourChallenge"));
            break;
        default:
            var e = ({ Balance: 41, Decay: 56, Electricity: 82, Crushed: 126, Nom: 146, Toxicity: 166, Lead: 181, Watch: 181, Corrupted: 191 } as any)[d];
            if (e) a = e;
    }
    return { level: a, lead: b };
}

//Radon

MODULES["portal"].Rtimeout = 5000;
MODULES["portal"].RbufferExceedFactor = 5;

export function RautoPortal() {
    if (!game.global.portalActive) return;
    switch (autoTrimpSettings.RAutoPortal.selected) {
        case "Radon Per Hour":
            var OKtoPortal = false;
            if (!game.global.runningChallengeSquared) {
                var minZone = getPageSetting('RnHrDontPortalBefore');
                game.stats.bestHeliumHourThisRun.evaluate();
                var bestHeHr = game.stats.bestHeliumHourThisRun.storedValue;
                var bestHeHrZone = game.stats.bestHeliumHourThisRun.atZone;
                var myHeliumHr = game.stats.heliumHour.value();
                var heliumHrBuffer = Math.abs(getPageSetting('RadonHrBuffer'));
                if (!aWholeNewWorld)
                    heliumHrBuffer *= MODULES["portal"].RbufferExceedFactor;
                var bufferExceeded = myHeliumHr < bestHeHr * (1 - (heliumHrBuffer / 100));
                if (bufferExceeded && game.global.world >= minZone) {
                    OKtoPortal = true;
                    if (aWholeNewWorld)
                        zonePostpone = 0;
                }
                if (heliumHrBuffer == 0 && !aWholeNewWorld)
                    OKtoPortal = false;
                if (OKtoPortal && zonePostpone == 0) {
                    RresetVars();
                    zonePostpone += 1;
                    debug("My RadonHr was: " + myHeliumHr + " & the Best RadonHr was: " + bestHeHr + " at zone: " + bestHeHrZone, "portal");
                    cancelTooltip();
                    tooltip('confirm', null, 'update', '<b>Auto Portaling NOW!</b><p>Hit Delay Portal to WAIT 1 more zone.', 'zonePostpone+=1', '<b>NOTICE: Auto-Portaling in 5 seconds....</b>', 'Delay Portal');
                    setTimeout(cancelTooltip, MODULES["portal"].Rtimeout);
                    setTimeout(function() {
                        if (zonePostpone >= 2)
                            return;
                        if (autoTrimpSettings.RadonHourChallenge.selected != 'None')
                            RdoPortal(autoTrimpSettings.RadonHourChallenge.selected);
                        else
                            RdoPortal();
                    }, MODULES["portal"].Rtimeout + 100);
                }
            }
            break;
        case "Custom":
            var portalzone = getPageSetting('RCustomAutoPortal');
            if (game.global.world > portalzone) {
                if (autoTrimpSettings.RadonHourChallenge.selected != 'None')
                    RdoPortal(autoTrimpSettings.RadonHourChallenge.selected);
                else
                    RdoPortal();
            }
            break;
        case "Melt":
	case "Bublé":
	case "Quagmire":
	case "Archaeology":
	case "Insanity":
	case "Nurture":
	case "Alchemy":
	case "Hypothermia":
            if (!game.global.challengeActive) {
                RdoPortal(autoTrimpSettings.RAutoPortal.selected);
            }
            break;
        default:
            break;
    }
}

export function RdailyAutoPortal() {
    if (!game.global.portalActive) return;
    if (getPageSetting('RAutoPortalDaily') == 1) {
        var OKtoPortal = false;
        if (!game.global.runningChallengeSquared) {
            var minZone = getPageSetting('RdHeHrDontPortalBefore');
            game.stats.bestHeliumHourThisRun.evaluate();
            var bestHeHr = game.stats.bestHeliumHourThisRun.storedValue;
            var bestHeHrZone = game.stats.bestHeliumHourThisRun.atZone;
            var myHeliumHr = game.stats.heliumHour.value();
            var heliumHrBuffer = Math.abs(getPageSetting('RdHeliumHrBuffer'));
            // #83 §2: NO BRACE — same defect as the U1 twin dailyAutoPortal() above; see the note there.
            if (!aWholeNewWorld)
                heliumHrBuffer *= MODULES["portal"].bufferExceedFactor;
            var bufferExceeded = myHeliumHr < bestHeHr * (1 - (heliumHrBuffer / 100));
            if (bufferExceeded && game.global.world >= minZone) {
                OKtoPortal = true;
                if (aWholeNewWorld)
                    zonePostpone = 0;
            }
            if (heliumHrBuffer == 0 && !aWholeNewWorld)
                OKtoPortal = false;
            if (OKtoPortal && zonePostpone == 0) {
                RresetVars();
                zonePostpone += 1;
                debug("My RadonHr was: " + myHeliumHr + " & the Best RadonHr was: " + bestHeHr + " at zone: " + bestHeHrZone, "portal");
                cancelTooltip();
                tooltip('confirm', null, 'update', '<b>Auto Portaling NOW!</b><p>Hit Delay Portal to WAIT 1 more zone.', 'zonePostpone+=1', '<b>NOTICE: Auto-Portaling in 5 seconds....</b>', 'Delay Portal');
                setTimeout(cancelTooltip, MODULES["portal"].Rtimeout);
                setTimeout(function() {
                    if (zonePostpone >= 2)
                        return;
                    if (OKtoPortal) {
                        abandonDaily();
                        document.getElementById('finishDailyBtnContainer')!.style.display = 'none';
                    }
                    if (autoTrimpSettings.RdHeliumHourChallenge.selected != 'None' && getPageSetting('u2daily') == false)
                        RdoPortal(autoTrimpSettings.RdHeliumHourChallenge.selected);
                    else if (autoTrimpSettings.dHeliumHourChallenge.selected != 'None' && getPageSetting('u2daily') == true)
                        RdoPortal(autoTrimpSettings.dHeliumHourChallenge.selected);
                    else
                        RdoPortal();
                }, MODULES["portal"].timeout + 100);
            }
        }
    }
    if (getPageSetting('RAutoPortalDaily') == 2) {
        var portalzone = getPageSetting('RdCustomAutoPortal');
        if (game.global.world > portalzone) {
            abandonDaily();
            document.getElementById('finishDailyBtnContainer')!.style.display = 'none';
            if (autoTrimpSettings.RdHeliumHourChallenge.selected != 'None' && getPageSetting('u2daily') == false)
                RdoPortal(autoTrimpSettings.RdHeliumHourChallenge.selected);
	    else if (autoTrimpSettings.dHeliumHourChallenge.selected != 'None' && getPageSetting('u2daily') == true)
                RdoPortal(autoTrimpSettings.dHeliumHourChallenge.selected);
            else
                RdoPortal();
        }
    }
}

export function RdoPortal(challenge?: any) {
    if(!game.global.portalActive) return;
    // #65: was `typetokeep != 'None' && raretokeep != 'None'` — both always true. getPageSetting
    // returns typetokeep's numeric INDEX (0 = the 'None' option), never the label, and raretokeep's
    // dropdown has no 'None' entry at all ('Any' is its permissive value). So the guard collapsed to
    // just `autoheirlooms == true`, and autoheirlooms3() un-carries every heirloom before re-carrying
    // per typetokeep — with typetokeep = 0 no carry branch runs, so it stripped every carried heirloom.
    if (getPageSetting('autoheirlooms') == true && getPageSetting('typetokeep') != 0) {
	autoheirlooms3();
    }
    // #79: the same mangled Daily dispatch as doPortal (see the note there); same fix, same twins.
    // ⚠️ SEPARATE, UNRESOLVED: this is the U2 (radon) portal, yet the block it replaces read the U1
    // heirloom ids ('highdmg'/'dhighdmg'). U2 has its own heirloom-swap subsystem — Rheirloomswap() /
    // Rdheirloomswap(), driven by the Rhs*/Rdhs* settings and called from AutoTrimps2.js:368/371 — so
    // this looks like a copy-paste from doPortal that was never adapted. Whether RdoPortal should equip
    // via the U2 settings instead is a BEHAVIOR question no in-tree evidence settles, and inventing an
    // answer is exactly the failure mode #68/#58 keep repeating. Filed rather than guessed; this fix
    // repairs ONLY the tautology and changes not one id this function reads.
    if (game.global.challengeActive === "Daily") dhighHeirloom();
    else highHeirloom();
    if (getPageSetting('RAutoAllocatePerks')==2) {
        viewPortalUpgrades();
	numTab(6, true)
	if (getPageSetting('Rdumpgreed') == true) {
	    buyPortalUpgrade('Greed');
	    debug('First Stage: Bought Max Greed');
	}
	else {
	    buyPortalUpgrade('Looting');
	    debug('First Stage: Bought Max Looting');
	}
	activateClicked();
	cancelPortal();
    }
    portalClicked();
    if (!portalWindowOpen) {
	portalClicked();
    }
    // #82: as above — and this one guarded on `AutoPerks` while calling `RAutoPerks`, a copy-paste
    // that made it doubly meaningless.
    if (portalWindowOpen && getPageSetting('RAutoAllocatePerks')==1 && typeof RAutoPerks?.clickAllocate === 'function') {
        RAutoPerks.clickAllocate();
    }
    if (portalWindowOpen && getPageSetting('RAutoStartDaily') == true) {
        if (getPageSetting('u1daily') == true && portalUniverse == 2) {
	    swapPortalUniverse();
	}
	selectChallenge('Daily');
        checkCompleteDailies();
        var lastUndone = -7;
        while (++lastUndone <= 0) {
            var done = (game.global.recentDailies.indexOf(getDailyTimeString(lastUndone)) != -1);
            if (!done)
                break;
        }
        if (lastUndone == 1) {
            debug("All available Dailies already completed.", "portal");
	    if ((getPageSetting('u2daily') == true && portalUniverse == 2 && challenge == autoTrimpSettings.dHeliumHourChallenge.selected) || (getPageSetting('u1daily') == true && portalUniverse == 1)) {
	        swapPortalUniverse();
	    }
            selectChallenge(challenge || 0);
        } else {
            getDailyChallenge(lastUndone);
            debug("Portaling into Daily for: " + getDailyTimeString(lastUndone, true) + " now!", "portal");
        }
    }
    else if(portalWindowOpen && challenge) {
	    if (getPageSetting('u2daily') == true && portalUniverse == 2 && challenge == autoTrimpSettings.dHeliumHourChallenge.selected) {
	        swapPortalUniverse();
	    }
            selectChallenge(challenge);
    }
    if (portalWindowOpen && getPageSetting('RAutoAllocatePerks')==2) {
	numTab(6, true)
	if (getPageSetting('Rdumpgreed') == true) {
	    buyPortalUpgrade('Greed');
	    debug('Second Stage: Bought Max Greed');
	}
	else {
	    buyPortalUpgrade('Looting');
	    debug('Second Stage: Bought Max Looting');
	}
	
    }
    RresetVars();
    // #124 — same as the U1 auto-portal above: verified in-browser backup, never a silent download.
    writePrePortalBackup();
    activatePortal();
    lastRadonZone = 0;
    RresetVars();
}
