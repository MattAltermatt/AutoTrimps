// TRUE TS (Phase 1 · #30): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/MAZ.js.
// MAZ (Map At Zone) settings-window builder + preset editor. saveSettings imported from
// converted utils. Two sloppy-mode implicit globals localized to var (write-only, no external
// reader): world (a local array accumulator) and lastTooltipTitle. No other seam concerns.
// Free identifiers (game/AT DOM+settings helpers) resolve via the bridge at runtime, typed
// ambient. Behaviour-preserving: any body edits are TYPE-ONLY.
import { saveSettings } from './utils'

export function MAZLookalike(titleText: any, _isItIn?: any, _event?: any) {

    var zone: any;
    var cell: any;
    var setting: any;
    var level: any;
    var map: any;
    var special: any;
    var gather: any;

    zone = [0];
    cell = [0];

    //Settings

    if (titleText == 'Time Farm') {
        zone = 'Rtimefarmzone';
        cell = 'Rtimefarmcell';
        setting = 'Rtimefarmtime';
        level = 'Rtimefarmlevel';
        map = 'Rtimefarmmap';
        special = 'Rtimefarmspecial';
        gather = 'Rtimefarmgather';
    } else if (titleText == 'dTime Farm') {
        zone = 'Rdtimefarmzone';
        cell = 'Rdtimefarmcell';
        setting = 'Rdtimefarmtime';
        level = 'Rdtimefarmlevel';
        map = 'Rdtimefarmmap';
        special = 'Rdtimefarmspecial';
        gather = 'Rdtimefarmgather';
    } else if (titleText.includes('Smithy Farm')) {
        zone = 'Rsmithyfarmzone';
        cell = 'Rsmithyfarmcell';
        setting = 'Rsmithyfarmamount';
    } else if (titleText.includes('Tribute Farm')) {
        zone = 'Rtributefarmzone';
        cell = 'Rtributefarmcell';
        setting = 'Rtributefarmamount';
        level = 'Rtributefarmlevel';
        map = 'Rtributemapselection';
        special = 'Rtributespecialselection';
        gather = 'Rtributegatherselection';
    } else if (titleText == 'Shrine - U1') {
        zone = 'Hshrinezone';
        cell = 'Hshrinecell';
        setting = 'Hshrineamount';
    } else if (titleText == 'Shrine - U2') {
        zone = 'Rshrinezone';
        cell = 'Rshrinecell';
        setting = 'Rshrineamount';
    } else if (titleText == 'Shrine - U1 (Daily)') {
        zone = 'Hdshrinezone';
        cell = 'Hdshrinecell';
        setting = 'Hdshrineamount';
    } else if (titleText == 'Shrine - U2 (Daily)') {
        zone = 'Rdshrinezone';
        cell = 'Rdshrinecell';
        setting = 'Rdshrineamount';
    } else if (titleText.includes('Quagmire')) {
        zone = 'Rblackbogzone';
        setting = 'Rblackbogamount';
    } else if (titleText.includes('Insanity')) {
        zone = 'Rinsanityfarmzone';
        cell = 'Rinsanityfarmcell';
        setting = 'Rinsanityfarmstack';
        level = 'Rinsanityfarmlevel';
    } else if (titleText.includes('Alch')) {
        zone = 'Ralchfarmzone';
        cell = 'Ralchfarmcell';
        setting = 'Ralchfarmstack';
        level = 'Ralchfarmlevel';
        map = 'Ralchfarmselection';
    } else if (titleText.includes('Hypo')) {
        zone = 'Rhypofarmzone';
        cell = 'Rhypofarmcell';
        setting = 'Rhypofarmstack';
        level = 'Rhypofarmlevel';
    } else if (titleText == 'Praid') {
        zone = 'RAMPraidzone';
        cell = 'RAMPraidcell';
        setting = 'RAMPraidraid';
    } else if (titleText == 'dPraid') {
        zone = 'RdAMPraidzone';
        cell = 'RdAMPraidcell';
        setting = 'RdAMPraidraid';
    }


    cancelTooltip();
    titleText = !titleText ? 'undefined' : titleText;
    if (titleText == 'undefined') return;

    var elem = byId("tooltipDiv");
    swapClass("tooltipExtra", "tooltipExtraNone", elem);
    document.getElementById('tipText')!.className = "";

    var tooltipText;
    var costText = "";
    var titleText;

    var ondisplay: any = null;
    var maxSettings = 120;
    var windowHelp = "Welcome to AT's version of MaZ! Please read the tooltips of the settings button to get more detailed info on how to use this. However it should be easy enough to figure out!";

    tooltipText = "\
    <div id='windowContainer' style='display: block'><div id='windowError'></div>\
    <div class='row windowRow titles'>\
    <div class='windowCheckbox' style='width: 0%'></div>\
    <div class='windowZone'>Zone</div>"
    if (!titleText.includes('Quagmire')) tooltipText += "<div class='windowCell'>Cell</div>"

    //Windows

    if (titleText == 'Time Farm') {
        tooltipText += "<div class='windowSetting'>Time</div>"
        tooltipText += "<div class='windowMap'>Map</div>"
        tooltipText += "<div class='windowLevel'>Level</div>"
        tooltipText += "<div class='windowSpecial'>Special</div>"
        tooltipText += "<div class='windowGather'>Gather</div>"
    } else if (titleText == 'dTime Farm') {
        tooltipText += "<div class='windowSetting'>Time</div>"
        tooltipText += "<div class='windowMap'>Map</div>"
        tooltipText += "<div class='windowLevel'>Level</div>"
        tooltipText += "<div class='windowSpecial'>Special</div>"
        tooltipText += "<div class='windowGather'>Gather</div>"
    } else if (titleText.includes('Smithy Farm')) {
        tooltipText += "<div class='windowSetting'>Smithys</div>"
    } else if (titleText.includes('Tribute Farm')) {
        tooltipText += "<div class='windowSetting'>Tributes</div>"
        tooltipText += "<div class='windowMap'>Map</div>"
        tooltipText += "<div class='windowLevel'>Level</div>"
        tooltipText += "<div class='windowSpecial'>Special</div>"
        tooltipText += "<div class='windowGather'>Gather</div>"
    } else if (titleText.includes('Shrine')) {
        tooltipText += "<div class='windowSetting'>Amount</div>"
    } else if (titleText.includes('Quagmire')) {
        tooltipText += "<div class='windowSetting'>Black Bogs</div>"
    } else if (titleText.includes('Insanity')) {
        tooltipText += "<div class='windowSetting'>Stacks</div>"
        tooltipText += "<div class='windowLevel'>Level</div>"
    } else if (titleText.includes('Alch')) {
        tooltipText += "<div class='windowSetting'>Potions</div>"
        tooltipText += "<div class='windowMap'>Map</div>"
        tooltipText += "<div class='windowLevel'>Level</div>"
    } else if (titleText.includes('Hypo')) {
        tooltipText += "<div class='windowSetting'>Bonfires</div>"
        tooltipText += "<div class='windowLevel'>Level</div>"
    } else if (titleText == 'Praid') {
        tooltipText += "<div class='windowSetting'>Raid</div>"
    } else if (titleText == 'dPraid') {
        tooltipText += "<div class='windowSetting'>Raid</div>"
    }

    tooltipText += "</div>";

    var current = autoTrimpSettings[zone].value;

    for (var x = 0; x < maxSettings; x++) {
        var vals: any = {
            check: true,
            zone: -1,
            cell: 81,
            setting: 0,
            map: 0,
            level: -1,
            special: 0,
            gather: 0
        };
        var style = "";

        if (current.length - 1 >= x) {
            vals.zone = autoTrimpSettings[zone].value[x];
            if (!titleText.includes('Quagmire')) vals.cell = autoTrimpSettings[cell].value[x] ? autoTrimpSettings[cell].value[x] : 81;

            //Values

            if (titleText == 'Time Farm') {
                vals.setting = autoTrimpSettings[setting].value[x] ? autoTrimpSettings[setting].value[x] : 0;
                vals.map = autoTrimpSettings[map].value[x] ? autoTrimpSettings[map].value[x] : 0;
                vals.level = autoTrimpSettings[level].value[x] ? autoTrimpSettings[level].value[x] : 0;
                vals.special = autoTrimpSettings[special].value[x] ? autoTrimpSettings[special].value[x] : 0;
                vals.gather = autoTrimpSettings[gather].value[x] ? autoTrimpSettings[gather].value[x] : 0;
            } else if (titleText == 'dTime Farm') {
                vals.setting = autoTrimpSettings[setting].value[x] ? autoTrimpSettings[setting].value[x] : 0;
                vals.map = autoTrimpSettings[map].value[x] ? autoTrimpSettings[map].value[x] : 0;
                vals.level = autoTrimpSettings[level].value[x] ? autoTrimpSettings[level].value[x] : 0;
                vals.special = autoTrimpSettings[special].value[x] ? autoTrimpSettings[special].value[x] : 0;
                vals.gather = autoTrimpSettings[gather].value[x] ? autoTrimpSettings[gather].value[x] : 0;
            } else if (titleText.includes('Smithy Farm')) {
                vals.setting = autoTrimpSettings[setting].value[x] ? autoTrimpSettings[setting].value[x] : 0;
            } else if (titleText.includes('Tribute Farm')) {
                vals.setting = autoTrimpSettings[setting].value[x] ? autoTrimpSettings[setting].value[x] : 0;
                vals.map = autoTrimpSettings[map].value[x] ? autoTrimpSettings[map].value[x] : 0;
                vals.level = autoTrimpSettings[level].value[x] ? autoTrimpSettings[level].value[x] : 0;
                vals.special = autoTrimpSettings[special].value[x] ? autoTrimpSettings[special].value[x] : 0;
                vals.gather = autoTrimpSettings[gather].value[x] ? autoTrimpSettings[gather].value[x] : 0;
            } else if (titleText.includes('Shrine')) {
              vals.setting = autoTrimpSettings[setting].value[x] ? autoTrimpSettings[setting].value[x] : 0;
            } else if (titleText.includes('Quagmire')) {
                vals.setting = autoTrimpSettings[setting].value[x] ? autoTrimpSettings[setting].value[x] : 0;
            } else if (titleText.includes('Insanity')) {
                vals.setting = autoTrimpSettings[setting].value[x] ? autoTrimpSettings[setting].value[x] : 0;
                vals.level = autoTrimpSettings[level].value[x] ? autoTrimpSettings[level].value[x] : 0;
            } else if (titleText.includes('Alch')) {
                vals.setting = autoTrimpSettings[setting].value[x] ? autoTrimpSettings[setting].value[x] : 0;
                vals.map = autoTrimpSettings[map].value[x] ? autoTrimpSettings[map].value[x] : 0;
                vals.level = autoTrimpSettings[level].value[x] ? autoTrimpSettings[level].value[x] : 0;
            } else if (titleText.includes('Hypo')) {
                vals.setting = autoTrimpSettings[setting].value[x] ? autoTrimpSettings[setting].value[x] : 0;
                vals.level = autoTrimpSettings[level].value[x] ? autoTrimpSettings[level].value[x] : 0;
            } else if (titleText == 'Praid') {
                vals.setting = autoTrimpSettings[setting].value[x] ? autoTrimpSettings[setting].value[x] : 0;
            } else if (titleText == 'dPraid') {
                vals.setting = autoTrimpSettings[setting].value[x] ? autoTrimpSettings[setting].value[x] : 0;
            }
        } else style = " style='display: none' ";

        var gatherDropdown = "<option value='food'" + ((vals.gather == 'food') ? " selected='selected'" : "") + ">Food</option><option value='metal'" + ((vals.gather == 'metal') ? " selected='selected'" : "") + ">Metal</option><option value='wood'" + ((vals.gather == 'wood') ? " selected='selected'" : "") + ">Wood</option><option value='science'" + ((vals.gather == 'science') ? " selected='selected'" : "") + ">Science</option>"
        var mapDropdown = "<option value='Random'" + ((vals.map == 'Random') ? " selected='selected'" : "") + ">Random</option><option value='Mountain'" + ((vals.map == 'Mountain') ? " selected='selected'" : "") + ">Moutain</option><option value='Forest'" + ((vals.map == 'Forest') ? " selected='selected'" : "") + ">Forest</option><option value='Sea'" + ((vals.map == 'Sea') ? " selected='selected'" : "") + ">Sea</option><option value='Depths'" + ((vals.map == 'Depths') ? " selected='selected'" : "") + ">Depths</option><option value='Plentiful'" + ((vals.map == 'Plentiful') ? " selected='selected'" : "") + ">Gardens</option><option value='Farmlands'" + ((vals.map == 'Farmlands') ? " selected='selected'" : "") + ">Farmlands</option>"
        var specialsDropdown = "<option value='fa'" + ((vals.special == 'fa') ? " selected='selected'" : "") + ">Fast Attack</option><option value='lc'" + ((vals.special == 'lc') ? " selected='selected'" : "") + ">Large Cache</option><option value='ssc'" + ((vals.special == 'ssc') ? " selected='selected'" : "") + ">Small Savory Cache</option><option value='swc'" + ((vals.special == 'swc') ? " selected='selected'" : "") + ">Small Wooden Cache</option><option value='smc'" + ((vals.special == 'smc') ? " selected='selected'" : "") + ">Small Metal Cache</option><option value='src'" + ((vals.special == 'src') ? " selected='selected'" : "") + ">Small Research Cache</option><option value='p'" + ((vals.special == 'p') ? " selected='selected'" : "") + ">Prestigious</option><option value='hc'" + ((vals.special == 'hc') ? " selected='selected'" : "") + ">Huge Cache</option><option value='lsc'" + ((vals.special == 'lsc') ? " selected='selected'" : "") + ">Large Savory Cache</option><option value='lwc'" + ((vals.special == 'lwc') ? " selected='selected'" : "") + ">Large Wooden Cache</option><option value='lmc'" + ((vals.special == 'lmc') ? " selected='selected'" : "") + ">Large Metal Cache</option><option value='lrc'" + ((vals.special == 'lrc') ? " selected='selected'" : "") + ">Large Research Cache</option>"

        var className = (vals.preset == 3) ? "windowBwMainOn" : "windowBwMainOff";
        tooltipText += "<div id='windowRow" + x + "' class='row windowRow " + className + "'" + style + ">";
        tooltipText += "<div class='windowDelete' onclick='removeRow(" + x + ")'><span class='icomoon icon-cross'></span></div>";
        tooltipText += "<div class='windowZone'><input value='" + vals.zone + "' type='number' id='windowZone" + x + "'/></div>";
        if (!titleText.includes('Quagmire')) tooltipText += "<div class='windowCell'><input value='" + vals.cell + "' type='number' id='windowCell" + x + "'/></div>";

        //Tooltips

        if (titleText == 'Time Farm') {
            tooltipText += "<div class='windowSetting'><input value='" + vals.setting + "' type='number' id='windowSetting" + x + "'/></div>";
            tooltipText += "<div class='windowMap' onchange='updateWindowPreset(" + x + ")'><select value='" + vals.map + "' id='windowMap" + x + "'>" + mapDropdown + "</select></div>"
            tooltipText += "<div class='windowLevel'><input value='" + vals.level + "' type='number' id='windowLevel" + x + "'/></div>";
            tooltipText += "<div class='windowSpecial' onchange='updateWindowPreset(" + x + ")'><select value='" + vals.special + "' id='windowSpecial" + x + "'>" + specialsDropdown + "</select></div>"
            tooltipText += "<div class='windowGather' onchange='updateWindowPreset(" + x + ")'><select value='" + vals.gather + "' id='windowGather" + x + "'>" + gatherDropdown + "</select></div>"
        } else if (titleText == 'dTime Farm') {
            tooltipText += "<div class='windowSetting'><input value='" + vals.setting + "' type='number' id='windowSetting" + x + "'/></div>";
            tooltipText += "<div class='windowMap' onchange='updateWindowPreset(" + x + ")'><select value='" + vals.map + "' id='windowMap" + x + "'>" + mapDropdown + "</select></div>"
            tooltipText += "<div class='windowLevel'><input value='" + vals.level + "' type='number' id='windowLevel" + x + "'/></div>";
            tooltipText += "<div class='windowSpecial' onchange='updateWindowPreset(" + x + ")'><select value='" + vals.special + "' id='windowSpecial" + x + "'>" + specialsDropdown + "</select></div>"
            tooltipText += "<div class='windowGather' onchange='updateWindowPreset(" + x + ")'><select value='" + vals.gather + "' id='windowGather" + x + "'>" + gatherDropdown + "</select></div>"
        } else if (titleText.includes('Smithy Farm')) {
            tooltipText += "<div class='windowSetting'><input value='" + vals.setting + "' type='number' id='windowSetting" + x + "'/></div>";    
        } else if (titleText.includes('Tribute Farm')) {
            tooltipText += "<div class='windowSetting'><input value='" + vals.setting + "' type='number' id='windowSetting" + x + "'/></div>";
            tooltipText += "<div class='windowMap' onchange='updateWindowPreset(" + x + ")'><select value='" + vals.map + "' id='windowMap" + x + "'>" + mapDropdown + "</select></div>"
            tooltipText += "<div class='windowLevel'><input value='" + vals.level + "' type='number' id='windowLevel" + x + "'/></div>";
            tooltipText += "<div class='windowSpecial' onchange='updateWindowPreset(" + x + ")'><select value='" + vals.special + "' id='windowSpecial" + x + "'>" + specialsDropdown + "</select></div>"
            tooltipText += "<div class='windowGather' onchange='updateWindowPreset(" + x + ")'><select value='" + vals.gather + "' id='windowGather" + x + "'>" + gatherDropdown + "</select></div>"
        } else if (titleText.includes('Shrine')) {
            tooltipText += "<div class='windowSetting'><input value='" + vals.setting + "' type='number' id='windowSetting" + x + "'/></div>";
        } else if (titleText.includes('Quagmire')) {
            tooltipText += "<div class='windowSetting'><input value='" + vals.setting + "' type='number' id='windowSetting" + x + "'/></div>";
        } else if (titleText.includes('Insanity')) {
            tooltipText += "<div class='windowSetting'><input value='" + vals.setting + "' type='number' id='windowSetting" + x + "'/></div>";
            tooltipText += "<div class='windowLevel'><input value='" + vals.level + "' type='number' id='windowLevel" + x + "'/></div>";
        } else if (titleText.includes('Alch')) {
            tooltipText += "<div class='windowSetting'><input value='" + vals.setting + "' type='text' id='windowSetting" + x + "'/></div>";
            tooltipText += "<div class='windowMap' onchange='updateWindowPreset(" + x + ")'><select value='" + vals.map + "' id='windowMap" + x + "'>" + mapDropdown + "</select></div>"
            tooltipText += "<div class='windowLevel'><input value='" + vals.level + "' type='number' id='windowLevel" + x + "'/></div>";
        } else if (titleText.includes('Hypo')) {
            tooltipText += "<div class='windowSetting'><input value='" + vals.setting + "' type='number' id='windowSetting" + x + "'/></div>";
            tooltipText += "<div class='windowLevel'><input value='" + vals.level + "' type='number' id='windowLevel" + x + "'/></div>";
        } else if (titleText == 'Praid') {
            tooltipText += "<div class='windowSetting'><input value='" + vals.setting + "' type='number' id='windowSetting" + x + "'/></div>";
        } else if (titleText == 'dPraid') {
            tooltipText += "<div class='windowSetting'><input value='" + vals.setting + "' type='number' id='windowSetting" + x + "'/></div>";
        }

        tooltipText += "</div>"
    }

    tooltipText += "<div id='windowAddRowBtn' style='display: " + ((current.length < maxSettings) ? "inline-block" : "none") + "' class='btn btn-success btn-md' onclick='addRow()'>+ Add Row</div>"
    tooltipText += "</div><div style='display: none' id='windowHelpContainer'>" + windowHelp + "</div>";
    costText = "<div class='maxCenter'><span class='btn btn-success btn-md' id='confirmTooltipBtn' onclick='settingsWindowSave(\"" + titleText + "\")'>Save and Close</span><span class='btn btn-danger btn-md' onclick='cancelTooltip(true)'>Cancel</span><span class='btn btn-primary btn-md' id='confirmTooltipBtn' onclick='settingsWindowSave(\"" + titleText + "\", true)'>Save</span></div>"
    game.global.lockTooltip = true;
    elem.style.display = 'block'
    elem.style.top = "10%";
    elem.style.left = "10%";
    elem.style.height = 'auto';
    elem.style.maxHeight = window.innerHeight * .85 + 'px';
    elem.style.overflowY = 'scroll';
    swapClass('tooltipExtra', 'tooltipExtraLg', elem);

    titleText = (titleText) ? titleText : titleText;
    // Seam fix (#22): lastTooltipTitle is a game-engine global read by the keydown handlers
    // (main.js) for lock-tooltip handling. A module-scoped `var` shadowed it, so the engine
    // never saw this window's identity and could force-close it on a hotkey. Publish to global.
    globalThis.lastTooltipTitle = titleText;

    document.getElementById("tipTitle")!.innerHTML = titleText;
    document.getElementById("tipText")!.innerHTML = tooltipText;
    document.getElementById("tipCost")!.innerHTML = costText;
    elem.style.display = "block";
    if (ondisplay !== null) {
        ondisplay();
    }

}

export function settingsWindowSave(titleText: any, reopen?: any) {

    var thisSetting = [];
    var error = "";
    var maxSettings = 30;

    // #83 §6: the setting-KEY names and the per-ROW values used to share one set of `var` bindings.
    // `var` is function-scoped, so `zone` was assigned the key string 'Rtimefarmzone' by the dispatch
    // below and then CLOBBERED with a NUMBER by `zone = parseInt(byId('windowZone'+x).value, 10)`
    // inside the loop — and `setting`/`level`/`map`/`special`/`gather` were even re-`var`ed a second
    // time in the same scope. It appeared to work only because the dispatch re-ran at the top of every
    // iteration: as long as the LAST iteration hit the `continue` for an unfilled row, `zone` survived
    // as the key. Fill a MAZ window to its maximum 30 rows and the last iteration falls through — the
    // loop ends with `zone` as, say, 41, `autoTrimpSettings[41]` is undefined, and the post-loop write
    // throws `Cannot set properties of undefined`. Save silently did nothing. A cliff, not a gradient.
    //
    // The two roles are now separated: the keys are loop-invariant, so hoist them and assign ONCE; the
    // row values get their own bindings inside the loop.
    var zoneKey: any;
    var cellKey: any;
    var settingKey: any;
    var levelKey: any;
    var mapKey: any;
    var specialKey: any;
    var gatherKey: any;

    //Settings

    if (titleText == 'Time Farm') {
        zoneKey = 'Rtimefarmzone';
        cellKey = 'Rtimefarmcell';
        settingKey = 'Rtimefarmtime';
        levelKey = 'Rtimefarmlevel';
        mapKey = 'Rtimefarmmap';
        specialKey = 'Rtimefarmspecial';
        gatherKey = 'Rtimefarmgather';
    } else if (titleText == 'dTime Farm') {
        zoneKey = 'Rdtimefarmzone';
        cellKey = 'Rdtimefarmcell';
        settingKey = 'Rdtimefarmtime';
        levelKey = 'Rdtimefarmlevel';
        mapKey = 'Rdtimefarmmap';
        specialKey = 'Rdtimefarmspecial';
        gatherKey = 'Rdtimefarmgather';
    } else if (titleText.includes('Smithy Farm')) {
        zoneKey = 'Rsmithyfarmzone';
        cellKey = 'Rsmithyfarmcell';
        settingKey = 'Rsmithyfarmamount';
    } else if (titleText.includes('Tribute Farm')) {
        zoneKey = 'Rtributefarmzone';
        cellKey = 'Rtributefarmcell';
        settingKey = 'Rtributefarmamount';
        levelKey = 'Rtributefarmlevel';
        mapKey = 'Rtributemapselection';
        specialKey = 'Rtributespecialselection';
        gatherKey = 'Rtributegatherselection';
    } else if (titleText == 'Shrine - U1') {
        zoneKey = 'Hshrinezone';
        cellKey = 'Hshrinecell';
        settingKey = 'Hshrineamount';
    } else if (titleText == 'Shrine - U2') {
        zoneKey = 'Rshrinezone';
        cellKey = 'Rshrinecell';
        settingKey = 'Rshrineamount';
    } else if (titleText == 'Shrine - U1 (Daily)') {
        zoneKey = 'Hdshrinezone';
        cellKey = 'Hdshrinecell';
        settingKey = 'Hdshrineamount';
    } else if (titleText == 'Shrine - U2 (Daily)') {
        zoneKey = 'Rdshrinezone';
        cellKey = 'Rdshrinecell';
        settingKey = 'Rdshrineamount';
    } else if (titleText.includes('Quagmire')) {
        zoneKey = 'Rblackbogzone';
        settingKey = 'Rblackbogamount';
    } else if (titleText.includes('Insanity')) {
        zoneKey = 'Rinsanityfarmzone';
        cellKey = 'Rinsanityfarmcell';
        settingKey = 'Rinsanityfarmstack';
        levelKey = 'Rinsanityfarmlevel';
    } else if (titleText.includes('Alch')) {
        zoneKey = 'Ralchfarmzone';
        cellKey = 'Ralchfarmcell';
        settingKey = 'Ralchfarmstack';
        levelKey = 'Ralchfarmlevel';
        mapKey = 'Ralchfarmselection';
    } else if (titleText.includes('Hypo')) {
        zoneKey = 'Rhypofarmzone';
        cellKey = 'Rhypofarmcell';
        settingKey = 'Rhypofarmstack';
        levelKey = 'Rhypofarmlevel';
    } else if (titleText == 'Praid') {
        zoneKey = 'RAMPraidzone';
        cellKey = 'RAMPraidcell';
        settingKey = 'RAMPraidraid';
    } else if (titleText == 'dPraid') {
        zoneKey = 'RdAMPraidzone';
        cellKey = 'RdAMPraidcell';
        settingKey = 'RdAMPraidraid';
    }

    for (var x = 0; x < maxSettings; x++) {

        var zone2 = byId('windowZone' + x);
        if (!zone2 || zone2.value == "-1") {
            continue;
        };

        var zone: any = parseInt(byId('windowZone' + x).value, 10);

        var setting: any = 0;
        var level: any = 0;
        var map: any = 0;
        var special: any = 0;
        var gather: any = 0;
        var cell: any;

        if (!titleText.includes('Quagmire')) cell = parseInt(byId('windowCell' + x).value, 10);

        if (titleText == 'Time Farm') {
            setting = byId('windowSetting' + x).value;
            level = parseInt(byId('windowLevel' + x).value, 10);
            map = byId('windowMap' + x).value;
            special = byId('windowSpecial' + x).value;
            gather = byId('windowGather' + x).value;
        } else if (titleText == 'dTime Farm') {
            setting = byId('windowSetting' + x).value;
            level = parseInt(byId('windowLevel' + x).value, 10);
            map = byId('windowMap' + x).value;
            special = byId('windowSpecial' + x).value;
            gather = byId('windowGather' + x).value;
        } else if (titleText.includes('Smithy Farm')) {
            setting = byId('windowSetting' + x).value;
        } else if (titleText.includes('Tribute Farm')) {
            setting = byId('windowSetting' + x).value;
            level = parseInt(byId('windowLevel' + x).value, 10);
            map = byId('windowMap' + x).value;
            special = byId('windowSpecial' + x).value;
            gather = byId('windowGather' + x).value;
        } else if (titleText.includes('Shrine')) {
            setting = byId('windowSetting' + x).value;
        } else if (titleText.includes('Quagmire')) {
            setting = byId('windowSetting' + x).value;
        } else if (titleText.includes('Insanity')) {
            setting = byId('windowSetting' + x).value;
            level = parseInt(byId('windowLevel' + x).value, 10);
        } else if (titleText.includes('Alch')) {
            setting = byId('windowSetting' + x).value;
            level = parseInt(byId('windowLevel' + x).value, 10);
            map = byId('windowMap' + x).value;
        } else if (titleText.includes('Hypo')) {
            setting = byId('windowSetting' + x).value;
            level = parseInt(byId('windowLevel' + x).value, 10);
        } else if (titleText == 'Praid') {
            setting = byId('windowSetting' + x).value;
        } else if (titleText == 'dPraid') {
            setting = byId('windowSetting' + x).value;
        }

        if (isNaN(zone) || zone < 6) {
            error += " Preset " + (x + 1) + " needs a value for Start Zone that's greater than 5.";
            continue;
        } else if (zone > 1000) {
            error += " Preset " + (x + 1) + " needs a value for Start Zone that's less than 1000.";
            continue;
        }
        if (zone + level < 6) {
            error += " Preset " + (x + 1) + " can't have a zone and map combination below zone 6.";
            continue;
        }

        if (level > 10) level = 10;
        if (!titleText.includes('Quagmire')) {
            if (cell < 1) cell = 1;
            if (cell > 100) cell = 100;
        }

        var thisThisSetting = {
            zone: zone,
            cell: cell,
            level: level,
            map: map,
            setting: setting,
            special: special,
            gather: gather
        };
        thisSetting.push(thisThisSetting);
    }

    if (!titleText.includes('Quagmire')) thisSetting.sort(function(a, b) {
        if (a.zone == b.zone) return (a.cell > b.cell) ? 1 : -1;
        return (a.zone > b.zone) ? 1 : -1
    });

    else (thisSetting as any).sort(function(a: any, b: any) {
        if (a.zone == b.zone) return (a.zone > b.zone) ? 1 : -1
    });

    if (error) {
        var elem = document.getElementById('windowError');
        if (elem) elem.innerHTML = error;
        return;
    }

    //Reset variables that are about to get used.
    autoTrimpSettings[zoneKey].value = [];
    if (!titleText.includes('Quagmire')) autoTrimpSettings[cellKey].value = [];

    //Values

    if (titleText == 'Time Farm') {
        autoTrimpSettings[levelKey].value = [];
        autoTrimpSettings[mapKey].value = [];
        autoTrimpSettings[settingKey].value = [];
        autoTrimpSettings[specialKey].value = [];
        autoTrimpSettings[gatherKey].value = [];
    } else if (titleText == 'dTime Farm') {
        autoTrimpSettings[levelKey].value = [];
        autoTrimpSettings[mapKey].value = [];
        autoTrimpSettings[settingKey].value = [];
        autoTrimpSettings[specialKey].value = [];
        autoTrimpSettings[gatherKey].value = [];
    } else if (titleText.includes('Smithy Farm')) {
        autoTrimpSettings[settingKey].value = [];
    } else if (titleText.includes('Tribute Farm')) {
        autoTrimpSettings[levelKey].value = [];
        autoTrimpSettings[mapKey].value = [];
        autoTrimpSettings[settingKey].value = [];
        autoTrimpSettings[specialKey].value = [];
        autoTrimpSettings[gatherKey].value = [];
    } else if (titleText.includes('Shrine')) {
        autoTrimpSettings[settingKey].value = [];
    } else if (titleText.includes('Quagmire')) {
        autoTrimpSettings[settingKey].value = [];
    } else if (titleText.includes('Insanity')) {
        autoTrimpSettings[levelKey].value = [];
        autoTrimpSettings[settingKey].value = [];
    } else if (titleText.includes('Alch')) {
        autoTrimpSettings[levelKey].value = [];
        autoTrimpSettings[mapKey].value = [];
        autoTrimpSettings[settingKey].value = [];
    } else if (titleText.includes('Hypo')) {
        autoTrimpSettings[levelKey].value = [];
        autoTrimpSettings[settingKey].value = [];
    } else if (titleText == 'Praid') {
        autoTrimpSettings[settingKey].value = [];
    } else if (titleText == 'dPraid') {
        autoTrimpSettings[settingKey].value = [];
    }

    for (var x = 0; x < thisSetting.length; x++) {
        autoTrimpSettings[zoneKey].value[x] = thisSetting[x].zone
        if (!titleText.includes('Quagmire')) autoTrimpSettings[cellKey].value[x] = thisSetting[x].cell

        //Saving

        if (titleText == 'Time Farm') {
            autoTrimpSettings[levelKey].value[x] = thisSetting[x].level
            autoTrimpSettings[mapKey].value[x] = thisSetting[x].map
            autoTrimpSettings[settingKey].value[x] = thisSetting[x].setting
            autoTrimpSettings[specialKey].value[x] = thisSetting[x].special
            autoTrimpSettings[gatherKey].value[x] = thisSetting[x].gather
        } else if (titleText == 'dTime Farm') {
            autoTrimpSettings[levelKey].value[x] = thisSetting[x].level
            autoTrimpSettings[mapKey].value[x] = thisSetting[x].map
            autoTrimpSettings[settingKey].value[x] = thisSetting[x].setting
            autoTrimpSettings[specialKey].value[x] = thisSetting[x].special
            autoTrimpSettings[gatherKey].value[x] = thisSetting[x].gather
        } else if (titleText.includes('Smithy Farm')) {
            autoTrimpSettings[settingKey].value[x] = thisSetting[x].setting
        } else if (titleText.includes('Tribute Farm')) {
            autoTrimpSettings[levelKey].value[x] = thisSetting[x].level
            autoTrimpSettings[mapKey].value[x] = thisSetting[x].map
            autoTrimpSettings[settingKey].value[x] = thisSetting[x].setting
            autoTrimpSettings[specialKey].value[x] = thisSetting[x].special
            autoTrimpSettings[gatherKey].value[x] = thisSetting[x].gather
        } else if (titleText.includes('Shrine')) {
            autoTrimpSettings[settingKey].value[x] = thisSetting[x].setting
        } else if (titleText.includes('Quagmire')) {
            autoTrimpSettings[settingKey].value[x] = thisSetting[x].setting
        } else if (titleText.includes('Insanity')) {
            autoTrimpSettings[levelKey].value[x] = thisSetting[x].level
            autoTrimpSettings[settingKey].value[x] = thisSetting[x].setting
        } else if (titleText.includes('Alch')) {
            autoTrimpSettings[levelKey].value[x] = thisSetting[x].level
            autoTrimpSettings[mapKey].value[x] = thisSetting[x].map
            autoTrimpSettings[settingKey].value[x] = thisSetting[x].setting
        } else if (titleText.includes('Hypo')) {
            autoTrimpSettings[levelKey].value[x] = thisSetting[x].level
            autoTrimpSettings[settingKey].value[x] = thisSetting[x].setting
        } else if (titleText == 'Praid') {
            autoTrimpSettings[settingKey].value[x] = thisSetting[x].setting
        } else if (titleText == 'dPraid') {
            autoTrimpSettings[settingKey].value[x] = thisSetting[x].setting
        }

    }

    cancelTooltip(true);
    if (reopen) MAZLookalike(titleText);

    saveSettings();
    document.getElementById('tooltipDiv')!.style.overflowY = '';
}

export function addRow() {
    for (var x = 0; x < 30; x++) {
        var elem = byId('windowZone' + x);
        if (!elem) continue;
        if (Number(elem.value) === -1) {
            var parent = document.getElementById('windowRow' + x);
            if (parent) {
                parent.style.display = 'block';
                elem.value = game.global.world + 1 < 6 ? 6 : game.global.world + 1;
                updateWindowPreset(x);
                break;
            }
        }
    }
    var btnElem = byId('windowAddRowBtn');
    for (var y = 0; y < 30; y++) {
        var elem = byId('windowZone' + y);
        if (elem && elem.value == "-1") {
            btnElem.style.display = 'inline-block';
            return;
        }
    }
    btnElem.style.display = 'none';
}

export function removeRow(index: any) {
    var elem = document.getElementById('windowRow' + index);
    if (!elem) return;
    byId('windowZone' + index).value = "-1";
    elem.style.display = 'none';
    var btnElem = byId('windowAddRowBtn');
    btnElem.style.display = 'inline-block';
}

// #92: an upstream vestige — the body was a single dead `getElementById` even in the 2016 original.
// It must KEEP EXISTING: ~12 MAZ `<select onchange='updateWindowPreset(N)'>` attributes and addRow()
// call it by name, and an inline handler resolves through the globalThis bridge — deleting the export
// would turn every MAZ dropdown change into a ReferenceError. The dropdowns are read at confirm time
// (MAZLookalike), not on change, so a no-op handler is correct.
export function updateWindowPreset(_index: any) {
}
