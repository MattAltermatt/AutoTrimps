// TRUE TS (Phase 1 · #31): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/SettingsGUI.js tab/menu chrome.
// automationMenuInit (1–62),
// modifyParentNode (65–86), automationMenuSettingsInit (88–92), createTabs/createTabContents/
// toggleTab/minimizeAllTabs/maximizeAllTabs (97–124), initializeAllTabs (202–267),
// autoToggle/autoPlusSettingsMenu (1227–1272), toggleAutoMaps (2279–end). Bodies verbatim.
//
// SEAM NOTES:
//  - The four load-time self-invocations (automationMenuInit/…SettingsInit/initializeAllTabs) and
//    the tabs.css <link> injection are NOT here — they stay in legacy for now and move to
//    settings-boot.ts in Task 6.
//  - addTabsDiv / addtabsUL were file-global vars used only by createTabs/createTabContents/
//    initializeAllTabs (verified: no other legacy/src reference). Scoped to this module — the
//    bridged functions share this closure, so behavior is identical.
//  - modifyParentNode used a bare `i` (implicit global) that throws under module strict mode;
//    changed to `var i` (behavior-identical loop counter).
let addTabsDiv: any;
let addtabsUL: any;

export function automationMenuInit() {
    var settingBtnSrch = document.getElementsByClassName("btn btn-default");
    for (var i = 0; i < settingBtnSrch.length; i++) {
        if (settingBtnSrch[i].getAttribute("onclick") === "toggleSettingsMenu()")
            settingBtnSrch[i].setAttribute("onclick", "autoPlusSettingsMenu()");
    }
    var newItem = document.createElement("TD");
    newItem.appendChild(document.createTextNode("AutoTrimps"));
    newItem.setAttribute("class", "btn btn-default");
    newItem.setAttribute("onclick", "autoToggle()");
    var settingbarRow: any = document.getElementById("settingsTable")!.firstElementChild!.firstElementChild;
    settingbarRow.insertBefore(newItem, settingbarRow.childNodes[10]);

    var newContainer = document.createElement("DIV");
    newContainer.setAttribute("style", "margin-top: 0.2vw; display: block; font-size: 1.1vw; height: 1.5em; text-align: center; border-radius: 4px");
    newContainer.setAttribute("id", "autoMapBtn");
    newContainer.setAttribute("class", "noselect settingsBtn");
    newContainer.setAttribute("onClick", "toggleAutoMaps()");
    newContainer.setAttribute("onmouseover", 'tooltip("Toggle Automapping", "customText", event, "Toggle automapping on and off.")');
    newContainer.setAttribute("onmouseout", 'tooltip("hide")');
    var abutton = document.createElement("SPAN");
    abutton.appendChild(document.createTextNode("Auto Maps"));
    abutton.setAttribute("id", "autoMapLabel");
    var fightButtonCol: any = document.getElementById("battleBtnsColumn");
    newContainer.appendChild(abutton);
    fightButtonCol.appendChild(newContainer);

    newContainer = document.createElement("DIV");
    newContainer.setAttribute("style", "display: block; font-size: 1.1vw; text-align: center; background-color: rgba(0,0,0,0.3);");
    if (game.global.universe == 1) {
        newContainer.setAttribute("onmouseover", 'tooltip("Health to Damage ratio", "customText", event, "This status box displays the current mode Automaps is in. The number usually shown here during Farming or Want more Damage modes is the \'HDratio\' meaning EnemyHealth to YourDamage Ratio (in X stance). Above 16 will trigger farming, above 4 will trigger going for Map bonus up to 10 stacks.<p><b>enoughHealth: </b>" + enoughHealth + "<br><b>enoughDamage: </b>" + enoughDamage +"<br><b>shouldFarm: </b>" + shouldFarm +"<br><b>H:D ratio = </b>" + calcHDratio() + "<br>")');
    }
    if (game.global.universe == 2) {
        newContainer.setAttribute("onmouseover", 'tooltip("Health to Damage ratio", "customText", event, "This status box displays the current mode Automaps is in. The number usually shown here during Farming or Want more Damage modes is the \'HDratio\' meaning EnemyHealth to YourDamage Ratio (in X stance). Above 16 will trigger farming, above 4 will trigger going for Map bonus up to 10 stacks.<p><b>enoughHealth: </b>" + RenoughHealth + "<br><b>enoughDamage: </b>" + RenoughDamage +"<br><b>shouldFarm: </b>" + RshouldFarm +"<br><b>H:D ratio = </b>" + RcalcHDratio() + "<br>")');
    }
    newContainer.setAttribute("onmouseout", 'tooltip("hide")');
    abutton = document.createElement("SPAN");
    abutton.id = 'autoMapStatus';
    newContainer.appendChild(abutton);
    fightButtonCol.appendChild(newContainer);

    newContainer = document.createElement("DIV");
    newContainer.setAttribute("style", "display: block; font-size: 1vw; text-align: center; margin-top: 2px; background-color: rgba(0,0,0,0.3);");
    if (game.global.universe == 1)
        newContainer.setAttribute("onmouseover", 'tooltip("Helium/Hr Info", "customText", event, "1st is Current He/hr % out of Lifetime He(not including current+unspent).<br> 0.5% is an ideal peak target. This can tell you when to portal... <br>2nd is Current run Total He earned / Lifetime He(not including current)<br>" + getDailyHeHrStats())');
    else if (game.global.universe == 2)
        newContainer.setAttribute("onmouseover", 'tooltip("Radon/Hr Info", "customText", event, "1st is Current Rn/hr % out of Lifetime Rn(not including current+unspent).<br> 0.5% is an ideal peak target. This can tell you when to portal... <br>2nd is Current run Total Rn earned / Lifetime Rn(not including current)<br>" + getDailyRnHrStats())');
    newContainer.setAttribute("onmouseout", 'tooltip("hide")');
    abutton = document.createElement("SPAN");
    abutton.id = 'hiderStatus';
    newContainer.appendChild(abutton);
    fightButtonCol.appendChild(newContainer);

    var $portalTimer: any = document.getElementById('portalTimer');
    $portalTimer.setAttribute('onclick', 'toggleSetting(\'pauseGame\')');
    $portalTimer.setAttribute('style', 'cursor: default');

    var btns: any = document.getElementsByClassName("fightBtn");
    for (var x = 0; x < btns.length; x++) {
        btns[x].style.padding = "0.01vw 0.01vw";
    }
}

export function modifyParentNode(setting: any, id: any) {
    var elem = (document.getElementById(id) as any).parentNode.parentNode.children;
    for (var i = 0; i < elem.length; i++) {
        if ((document.getElementById(id) as any).parentNode.parentNode.children[i].children[0] === undefined) {
            continue
        } else {
            if ((document.getElementById(id) as any).parentNode.parentNode.children[i].children[0].id === id) {
                if (autoTrimpSettings[setting].enabled) {
                    if (elem.length > (i + 1)) {
                        if ((document.getElementById(id) as any).parentNode.parentNode.children[(i + 1)].style.length == 0) {
                            (document.getElementById(id) as any).parentNode.parentNode.children[(i + 1)].remove()
                            break;
                        }
                    }
                } else {
                    (document.getElementById(id) as any).parentNode.parentNode.children[i].insertAdjacentHTML('afterend', '<br>');
                }
            }

        }
    }
}

export function automationMenuSettingsInit() {
    var a: any = document.getElementById("settingsRow"),
        b = document.createElement("DIV");
    // oxlint-disable-next-line no-unused-expressions -- faithful legacy port: comma sequence — de-comma behind the live net (#92)
    b.id = "autoSettings", b.setAttribute("style", "display: none; max-height: 92.5vh;overflow: auto;"), b.setAttribute("class", "niceScroll"), a.appendChild(b)
}

export function createTabs(a: any, b: any) {
    var c = document.createElement("li"),
        d = document.createElement("a");
    // oxlint-disable-next-line no-unused-expressions -- faithful legacy port: comma sequence — de-comma behind the live net (#92)
    d.className = "tablinks", d.setAttribute("onclick", "toggleTab(event, '" + a + "')"), d.href = "#", d.appendChild(document.createTextNode(a)), c.id = "tab" + a, c.appendChild(d), addtabsUL.appendChild(c), createTabContents(a, b)
}

export function createTabContents(a: any, b: any) {
    var c = document.createElement('div');
    // oxlint-disable-next-line no-unused-expressions -- faithful legacy port: comma sequence — de-comma behind the live net (#92)
    c.className = 'tabcontent', c.id = a;
    var d = document.createElement('div');
    d.setAttribute('style', 'margin-left: 1vw; margin-right: 1vw;');
    var e = document.createElement('h4');
    // oxlint-disable-next-line no-unused-expressions -- faithful legacy port: comma sequence — de-comma behind the live net (#92)
    e.setAttribute('style', 'font-size: 1.2vw;'), e.appendChild(document.createTextNode(b)), d.appendChild(e), c.appendChild(d), addTabsDiv.appendChild(c)
}

export function toggleTab(a: any, b: any) {
    // oxlint-disable-next-line no-unused-expressions -- faithful legacy port: comma sequence — de-comma behind the live net (#92)
    -1 < a.currentTarget.className.indexOf(" active") ? (document.getElementById(b)!.style.display = "none", a.currentTarget.className = a.currentTarget.className.replace(" active", "")) : (document.getElementById(b)!.style.display = "block", a.currentTarget.className += " active")
}

export function minimizeAllTabs() {
    for (var a = document.getElementsByClassName("tabcontent"), b = 0, c = a.length; b < c; b++) (a[b] as any).style.display = "none";
    for (var d = document.getElementsByClassName("tablinks"), b = 0, c = d.length; b < c; b++) d[b].className = d[b].className.replace(" active", "")
}

export function maximizeAllTabs() {
    for (var a = document.getElementsByClassName("tabcontent"), b = 0, c = a.length; b < c; b++) (a[b] as any).style.display = "block";
    // oxlint-disable-next-line no-unused-expressions -- faithful legacy port: comma sequence — de-comma behind the live net (#92)
    for (var d = document.getElementsByClassName("tablinks"), b = 0, c = d.length; b < c; b++) (d[b] as any).style.display = "block", d[b].className.includes(" active") || (d[b].className += " active")
}

export function initializeAllTabs() {
    addTabsDiv = document.createElement('div');
    addtabsUL = document.createElement('ul');
    addtabsUL.className = "tab";
    addtabsUL.id = 'autoTrimpsTabBarMenu';
    addtabsUL.style.display = "none";
    var sh: any = document.getElementById("settingsRow")
    sh.insertBefore(addtabsUL, sh.childNodes[2]);
    createTabs("Core", "Core - Main Controls for the script");
    createTabs("Buildings", "Building Settings");
    createTabs("Jobs", "Jobs - Worker Settings");
    createTabs("Gear", "Gear - Equipment Settings");
    createTabs("Maps", "Maps - AutoMaps & VoidMaps Settings");
    createTabs("Spire", "Spire - Settings for Spires");
    createTabs("Raiding", "Raiding - Settings for Raiding");
    createTabs("Daily", "Dailies - Settings for Dailies");
    createTabs("C2", "C2 - Settings for C2s");
    createTabs("Challenges", "Challenges - Settings for Specific Challenges");
    createTabs("Combat", "Combat & Stance Settings");
    createTabs("Windstacking", "Windstacking Settings");
    createTabs("ATGA", "Geneticassist Settings");
    createTabs("Scryer", "Scryer Settings");
    createTabs("Magma", "Dimensional Generator & Magmite Settings");
    createTabs("Heirlooms", "Heirloom Settings");
    createTabs("Golden", "Golden Upgrade Settings");
    createTabs("SA", "SA Settings");
    createTabs("Nature", "Nature Settings");
    createTabs("Display", "Display & Spam Settings");
    createTabs("Import Export", "Import & Export Settings");
    var li_0 = document.createElement('li');
    var a_0 = document.createElement('a');
    a_0.className = "tablinks minimize";
    a_0.setAttribute('onclick', 'minimizeAllTabs();');
    a_0.href = "#";
    a_0.appendChild(document.createTextNode("-"));
    li_0.appendChild(a_0);
    li_0.setAttribute("style", "float:right!important;");
    li_0.setAttribute("onmouseover", 'tooltip("Minimize all tabs", "customText", event, "Minimize all AT settings tabs.")');
    li_0.setAttribute("onmouseout", 'tooltip("hide")');
    var li_1 = document.createElement('li');
    var a_1 = document.createElement('a');
    a_1.className = "tablinks maximize";
    a_1.setAttribute('onclick', 'maximizeAllTabs();');
    a_1.href = "#";
    a_1.appendChild(document.createTextNode("+"));
    li_1.appendChild(a_1);
    li_1.setAttribute("style", "float:right!important;");
    li_1.setAttribute("onmouseover", 'tooltip("Maximize all tabs", "customText", event, "Maximize all AT settings tabs.")');
    li_1.setAttribute("onmouseout", 'tooltip("hide")');
    var li_2 = document.createElement('li');
    var a_2 = document.createElement('a');
    a_2.className = "tablinks tabclose";
    a_2.setAttribute('onclick', 'autoToggle();');
    a_2.href = "#";
    a_2.appendChild(document.createTextNode("x"));
    li_2.appendChild(a_2);
    li_2.setAttribute("style", "float:right!important;");
    li_2.setAttribute("onmouseover", 'tooltip("Exit (duplicate)", "customText", event, "Closes/toggles/hides AutoTrimps (just a UI shortcut)")');
    li_2.setAttribute("onmouseout", 'tooltip("hide")');
    addtabsUL.appendChild(li_2);
    addtabsUL.appendChild(li_1);
    addtabsUL.appendChild(li_0);
    document.getElementById("autoSettings")!.appendChild(addTabsDiv);
    document.getElementById("Core")!.style.display = "block";
    document.getElementsByClassName("tablinks")[0].className += " active";
}

export function autoToggle(what: any) {
    if (what) {
        var $what: any = document.getElementById(what);
        if ($what.style.display === 'block') {
            $what.style.display = 'none';
            document.getElementById(what + 'BTN')!.style.border = '';
        } else {
            $what.style.display = 'block';
            document.getElementById(what + 'BTN')!.style.border = '4px solid green';
        }
    } else {
        if (game.options.displayed)
            toggleSettingsMenu();
        var $item: any = document.getElementById('graphParent');
        if ($item.style.display === 'block') {
            $item.style.display = 'none';
            trimpStatsDisplayed = false;
            GRAPHSETTINGS.open = false;
        }
        var $item: any = document.getElementById('autoTrimpsTabBarMenu');
        if ($item.style.display === 'block')
            $item.style.display = 'none';
        else $item.style.display = 'block';
        var $item: any = document.getElementById('autoSettings');
        if ($item.style.display === 'block')
            $item.style.display = 'none';
        else $item.style.display = 'block';
    }
}

export function autoPlusSettingsMenu() {
    var $item: any = document.getElementById('autoSettings');
    if ($item.style.display === 'block')
        $item.style.display = 'none';
    var $item: any = document.getElementById('graphParent');
    if ($item.style.display === 'block') {
        $item.style.display = 'none';
        trimpStatsDisplayed = false;
        GRAPHSETTINGS.open = false;
    }
    var $item: any = document.getElementById('autoTrimpsTabBarMenu');
    if ($item.style.display === 'block')
        $item.style.display = 'none';
    toggleSettingsMenu();
}

export function toggleAutoMaps() {
    if (game.global.universe == 1) {
        if (getPageSetting('AutoMaps')) {
            setPageSetting('AutoMaps', 0);
        } else {
            setPageSetting('AutoMaps', 1);
        }
        document.getElementById('autoMapBtn')!.setAttribute('class', 'noselect settingsBtn settingBtn' + autoTrimpSettings.AutoMaps.value);
    }
    if (game.global.universe == 2) {
        if (getPageSetting('RAutoMaps')) {
            setPageSetting('RAutoMaps', 0);
        } else {
            setPageSetting('RAutoMaps', 1);
        }
        document.getElementById('autoMapBtn')!.setAttribute('class', 'noselect settingsBtn settingBtn' + autoTrimpSettings.RAutoMaps.value);
    }
    saveSettings();
}
