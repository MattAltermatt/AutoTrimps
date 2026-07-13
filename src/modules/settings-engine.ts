// TRUE TS (Phase 1 · #31): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/SettingsGUI.js:1226–1548.
// The createSetting factory + tooltip/value/
// text input handlers. Bodies copied verbatim. Cross-module names (autoTrimpSettings, ATversion,
// saveSettings, updateCustomButtons, checkPortalSettings, tooltip, cancelTooltip, unlockTooltip,
// prettify, ImportExportTooltip, game, magmiteSpenderChanged) resolve at runtime via the global
// bridge / pre-existing globals — no imports needed. Every function is exported so the bridge
// republishes it for the inline onclick=/onchange=/onkeypress= handlers that reference it by bare
// name.
//
// SEAM NOTE: `ranstring` was an IMPLICIT global in the sloppy-mode legacy concat (created by bare
// assignment). Under ES-module strict mode that bare write would throw ReferenceError, so it is
// scoped to this module — it is only ever read/written by these four functions, so this is
// behavior-identical (verified: no other legacy/src code references it).
let ranstring = '';

// #39 taxonomy: single source of truth for a control's visible face (leading glyph + label
// [+ cycle counter]). Called at mount (createSetting) AND on state change (settingChanged) so the
// two paths can never drift. Cached-child mutation only — never innerHTML on the click path
// (CLAUDE.md replaceChildren+click gotcha): the glyph/count spans are built once and mutated.
// Exported (republished on the bridge) because updateCustomButtons (settings-visibility) also
// refreshes multitoggle faces every tick — it must go through here or it wipes the glyph/counter.
export function renderControlFace(el: any, rec: any) {
    let glyph = el.querySelector(':scope > .settingGlyph');
    if (!glyph) {
        el.textContent = '';
        glyph = document.createElement('span');
        glyph.className = 'settingGlyph icomoon';
        el.appendChild(glyph);
        el.appendChild(document.createTextNode('')); // label text node = childNodes[1]
    }
    var label = el.childNodes[1];
    if (rec.type == 'boolean') {
        glyph.className = 'settingGlyph icomoon ' + (rec.enabled ? 'icon-checkmark' : 'icon-cross');
        label.textContent = ' ' + rec.name;
    } else if (rec.type == 'multitoggle') {
        glyph.className = 'settingGlyph icomoon icon-cycle';
        label.textContent = ' ' + rec.name[rec.value] + ' ';
        let cnt = el.querySelector(':scope > .settingCount');
        if (!cnt) {
            cnt = document.createElement('span');
            cnt.className = 'settingCount';
            el.appendChild(cnt);
        }
        cnt.textContent = '(' + (rec.value + 1) + '/' + rec.name.length + ')';
    } else if (rec.type == 'action') {
        glyph.className = 'settingGlyph icomoon icon-play3';
        label.textContent = ' ' + rec.name;
    } else if (rec.type == 'infoclick') {
        glyph.className = 'settingGlyph icomoon icon-switch';
        label.textContent = ' ' + rec.name;
    }
}

// #81 / #61 — a multitoggle's stored value is restored VERBATIM: loadPageVariables() drops the whole
// localStorage blob onto autoTrimpSettings, and createSetting's `loaded === undefined ? default : loaded`
// keeps whatever was there. Nothing ever checked the value against the option list. So an index that no
// longer exists survives every load and goes straight to the dispatch table, where NO arm matches it and
// the feature silently does nothing — forever, with no error. The shipped "550+ AT Settings" preset does
// exactly this: it writes BetterAutoFight = 3 into a 3-option (0..2) setting, so a player who loads that
// preset gets no AutoFight management at all.
//
// The class is wider than the one preset — a hand-edited save, or any save written before an option was
// removed upstream, smuggles the same corruption. So the recovery lives here, at the one chokepoint every
// value must pass. `defaultValue` is the only NON-ARBITRARY target: it is the fallback the setting itself
// already declares, so this invents no behavior.
//
// Deliberately SURGICAL: an in-range value is left byte-identical, including the four settings whose
// default is the *string* '0' rather than 0 (dfightforever, Rdfightforever, AutoPortalDaily,
// RAutoPortalDaily — a #69-family string-default defect, latent because getPageSetting parseInt()s and
// `btn.value++` coerces). Normalizing those here would change what serializeSettings() writes for every
// user, which is a separate decision from closing this hole.
function clampMultitoggle(id: any, name: any, defaultValue: any) {
    var stored = parseInt(autoTrimpSettings[id].value);
    if (Number.isInteger(stored) && stored >= 0 && stored < name.length) return;
    var fallback = parseInt(defaultValue);
    autoTrimpSettings[id].value =
        Number.isInteger(fallback) && fallback >= 0 && fallback < name.length ? fallback : 0;
}
// #76 — the id census of the CURRENT build. Every createSetting call registers its id here, so
// "is this key in the user's saved file a setting this version still declares?" is answerable
// without asking the DOM. cleanupAutoTrimps() used to ask the DOM instead (`getElementById(id) ==
// null` ⇒ delete), which conflates "not a setting" with "has no node right now" and, worse, reaps
// the non-record keys (ATversion) that the save file's load gate depends on.
// Population order is the same as the DOM's: initializeAllSettings() runs every createSetting at
// boot, so this set is complete before any UI is clickable. An EMPTY set therefore means
// "settings never booted" — never "no settings exist" — and the purge must no-op (see
// cleanupCandidates).
export const definedSettingIds = new Set<string>();

// #110 — the tooltip is injected as an HTML attribute holding a JS call whose last argument is a
// DOUBLE-QUOTED string literal:
//     onmouseover="tooltip("<name>", "customText", event, "<description>")"
// so a raw `"` anywhere in the description CLOSES that literal, the handler fails to COMPILE, and the
// browser silently leaves `el.onmouseover === null`. The control still renders and still clicks — only
// the tooltip is dead, which is why this survives: nothing throws and nothing looks broken. `RVoidMaps`
// has shipped with a dead tooltip this way. Escape at the seam, not per-description, so no future
// tooltip can re-open the hole by quoting a word.
// Escapes ONLY the copy spliced into the attribute. `name` and `description` themselves must stay
// untouched: both are stored on the settings record and rendered as the visible label, and for a
// multitoggle `name` is an ARRAY of option labels (renderControlFace reads rec.name[rec.value]) — so
// coercing or escaping them in place would corrupt the UI text, not just the tooltip.
const tipAttr = (name: any, description: any) => {
    const esc = (s: any) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return 'tooltip("' + esc(name) + '", "customText", event, "' + esc(description) + '")';
};

export function createSetting(id: any, name: any, description: any, type: any, defaultValue: any, list: any, container: any) {
    definedSettingIds.add(id);
    var btnParent = document.createElement("DIV");
    btnParent.setAttribute('style', 'display: inline-block; vertical-align: top; margin-left: 1vw; margin-bottom: 1vw; width: 13.142vw;');
    var btn: any = document.createElement("DIV");
    btn.id = id;
    var loaded = autoTrimpSettings[id];
    if (type == 'boolean') {
        if (!(loaded && id == loaded.id && loaded.type === type))
            autoTrimpSettings[id] = {
                id: id,
                name: name,
                description: description,
                type: type,
                enabled: loaded === undefined ? (defaultValue || false) : loaded
            };
        // #69: ~36 boolean settings were declared with the STRING 'false'/'true'. A string is truthy, and
        // JS `==` never coerces it, so `'false' == true` AND `'false' == false` are BOTH false while
        // `if (x)` sees ON — the setting's effective value depended on how each reader happened to test it.
        //
        // Unquoting the declarations alone repairs NOBODY: serializeSettings() flattens each boolean to a
        // bare `enabled` value, so localStorage holds `{"Rhypostorage":"false"}` — a raw string, not a
        // record. On reload that string comes back through `: loaded` above and `defaultValue` is never
        // even consulted. The persisted value is the load-bearing half, and this is where it is repaired.
        //
        // Click-safe by construction: settingChanged() writes `!enabled`, i.e. a REAL boolean. So a value
        // that is still a *string* proves the user has never clicked this toggle, and coercing it cannot
        // discard a user's choice.
        //
        // Gated on `typeof defaultValue === 'boolean'` deliberately. That makes the coercion INERT until a
        // given setting's declaration is actually unquoted, so the 36 can be repaired one reviewable group
        // at a time instead of all flipping at once — which matters enormously, because exactly one of them
        // (RBuyBuildingsNew) moves 1167 oracle traces and the other 35 move none.
        if (typeof defaultValue === 'boolean' && typeof autoTrimpSettings[id].enabled === 'string')
            autoTrimpSettings[id].enabled = autoTrimpSettings[id].enabled === 'true';
        btn.setAttribute("style", "font-size: 1.1vw;");
        btn.setAttribute('class', 'noselect settingsBtn settingKind-toggle settingBtn' + autoTrimpSettings[id].enabled);
        btn.setAttribute("onclick", 'settingChanged("' + id + '")');
        btn.setAttribute("onmouseover", tipAttr(name, description));
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        renderControlFace(btn, autoTrimpSettings[id]);
        btnParent.appendChild(btn);
        if (container) document.getElementById(container)!.appendChild(btnParent);
        else document.getElementById("autoSettings")!.appendChild(btnParent);
    } else if (type == 'value' || type == 'valueNegative') {
        if (!(loaded && id == loaded.id && loaded.type === type))
            autoTrimpSettings[id] = {
                id: id,
                name: name,
                description: description,
                type: type,
                value: loaded === undefined ? defaultValue : loaded
            };
        btn.setAttribute("style", "font-size: 1.1vw;");
        btn.setAttribute('class', 'noselect settingsBtn btn-info settingKind-input');
        btn.setAttribute("onclick", `autoSetValueToolTip("${id}", "${name}", ${type == 'valueNegative'}, ${type == 'multiValue'})`);
        btn.setAttribute("onmouseover", tipAttr(name, description));
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        btn.textContent = name;
        btnParent.appendChild(btn);
        if (container) document.getElementById(container)!.appendChild(btnParent);
        else document.getElementById("autoSettings")!.appendChild(btnParent);
    } else if (type == 'multiValue' || type == 'valueNegative') {
        if (!(loaded && id == loaded.id && loaded.type === type))
            autoTrimpSettings[id] = {
                id: id,
                name: name,
                description: description,
                type: type,
                value: loaded === undefined ? defaultValue : loaded
            };
        btn.setAttribute("style", "font-size: 1.1vw;");
        btn.setAttribute('class', 'noselect settingsBtn btn-info settingKind-input');
        btn.setAttribute("onclick", `autoSetValueToolTip("${id}", "${name}", ${type == 'valueNegative'}, ${type == 'multiValue'})`);
        btn.setAttribute("onmouseover", tipAttr(name, description));
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        btn.textContent = name;
        btnParent.appendChild(btn);
        if (container) document.getElementById(container)!.appendChild(btnParent);
        else document.getElementById("autoSettings")!.appendChild(btnParent);
    } else if (type == 'textValue') {
        if (!(loaded && id == loaded.id && loaded.type === type))
            autoTrimpSettings[id] = {
                id: id,
                name: name,
                description: description,
                type: type,
                value: loaded === undefined ? defaultValue : loaded
            };
        btn.setAttribute("style", "font-size: 1.1vw;");
        btn.setAttribute('class', 'noselect settingsBtn btn-info settingKind-input');
        btn.setAttribute("onclick", `autoSetTextToolTip("${id}", "${name}", ${type == 'textValue'})`);
        btn.setAttribute("onmouseover", tipAttr(name, description));
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        btn.textContent = name;
        btnParent.appendChild(btn);
        if (container) document.getElementById(container)!.appendChild(btnParent);
        else document.getElementById("autoSettings")!.appendChild(btnParent);
    } else if (type == 'dropdown') {
        if (!(loaded && id == loaded.id && loaded.type === type))
            autoTrimpSettings[id] = {
                id: id,
                name: name,
                description: description,
                type: type,
                selected: loaded === undefined ? defaultValue : loaded,
                list: list
            };
        var btn: any = document.createElement("select");
        btn.id = id;
        if (game.options.menu.darkTheme.enabled == 2) btn.setAttribute("style", "color: #C8C8C8; font-size: 1.0vw;");
        else btn.setAttribute("style", "color:black; font-size: 1.0vw;");
        btn.setAttribute("class", "noselect settingKind-select");
        btn.setAttribute("onmouseover", tipAttr(name, description));
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        btn.setAttribute("onchange", 'settingChanged("' + id + '")');
        for (var item in list) {
            var option = document.createElement("option");
            option.value = list[item];
            option.text = list[item];
            btn.appendChild(option);
        }
        btn.value = autoTrimpSettings[id].selected;
        var dropdownLabel = document.createElement("Label");
        dropdownLabel.id = id + "Label";
        dropdownLabel.innerHTML = name + ":";
        dropdownLabel.setAttribute('style', 'margin-right: 0.3vw; font-size: 0.8vw;');
        btnParent.appendChild(dropdownLabel);
        btnParent.appendChild(btn);
        if (container) document.getElementById(container)!.appendChild(btnParent);
        else document.getElementById("autoSettings")!.appendChild(btnParent);
    } else if (type == 'infoclick') {
        btn.setAttribute('class', 'noselect settingsBtn settingKind-action settingKind-info');
        btn.setAttribute("onclick", 'ImportExportTooltip(\'' + defaultValue + '\', \'update\')');
        btn.setAttribute("onmouseover", tipAttr(name, description));
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        btn.setAttribute("style", "font-size: 1.1vw;");
        renderControlFace(btn, { type: 'infoclick', name: name });
        btnParent.appendChild(btn);
        if (container) document.getElementById(container)!.appendChild(btnParent);
        else document.getElementById("autoSettings")!.appendChild(btnParent);
        return;
    } else if (type == 'multitoggle') {
        if (!(loaded && id == loaded.id && loaded.type === type))
            autoTrimpSettings[id] = {
                id: id,
                name: name,
                description: description,
                type: type,
                value: loaded === undefined ? defaultValue || 0 : loaded
            };
        clampMultitoggle(id, name, defaultValue);
        btn.setAttribute("style", "font-size: 1.1vw;");
        btn.setAttribute('class', 'noselect settingsBtn settingKind-cycle settingBtn' + autoTrimpSettings[id].value);
        btn.setAttribute("onclick", 'settingChanged("' + id + '")');
        btn.setAttribute("onmouseover", tipAttr(name.join(' / '), description));
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        renderControlFace(btn, autoTrimpSettings[id]);
        btnParent.appendChild(btn);
        if (container) document.getElementById(container)!.appendChild(btnParent);
        else document.getElementById("autoSettings")!.appendChild(btnParent);
    } else if (type === 'action') {
        btn.setAttribute("style", "font-size: 1.1vw;");
        btn.setAttribute('class', 'noselect settingsBtn settingKind-action settingBtn3'); // keep native teal (additive)
        btn.setAttribute('onclick', defaultValue);
        btn.setAttribute("onmouseover", tipAttr(name, description));
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        renderControlFace(btn, { type: 'action', name: name });
        btnParent.appendChild(btn);
        if (container) document.getElementById(container)!.appendChild(btnParent);
        else document.getElementById("autoSettings")!.appendChild(btnParent);
        return;
    }
    if (autoTrimpSettings[id].name != name)
        autoTrimpSettings[id].name = name;
    if (autoTrimpSettings[id].description != description)
        autoTrimpSettings[id].description = description;
    autoTrimpSettings["ATversion"] = ATversion;
}

export function settingChanged(id: any) {
    var btn = autoTrimpSettings[id];
    if (btn.type == 'boolean') {
        btn.enabled = !btn.enabled;
        var elB = document.getElementById(id)!;
        elB.setAttribute('class', 'noselect settingsBtn settingKind-toggle settingBtn' + btn.enabled);
        renderControlFace(elB, btn);
    }
    if (btn.type == 'multitoggle') {
        // #83 §7: the guard named 'AutoMagmiteSpender2' — an id that has no createSetting anywhere in
        // src/ or legacy/. It survives ONLY inside the two frozen legacy default-settings JSON blobs
        // (utils.ts:51/54). The live control is 'spendmagmite'. settingChanged is only ever invoked as
        // `settingChanged("<id>")` from a createSetting'd button, so the old comparison could never be
        // true — magmiteSpenderChanged was written nowhere and stayed false forever, leaving
        // AutoTrimps2.js:200 (`spendmagmite == 2 && !magmiteSpenderChanged`) unguarded. A player merely
        // CYCLING PAST "Spend Magmite Always" had their whole magmite bank dumped on the very next tick.
        // This is a REPOINT at an existing id, not a re-mint of the dead one (which would resurrect a
        // stale stored value — see the phantom-settings rule).
        // `btn.value == 1` is tested PRE-increment, so it means "the user is cycling INTO value 2 =
        // Spend Magmite Always" — exactly the value AutoTrimps2.js:200 acts on.
        if (id == 'spendmagmite' && btn.value == 1) {
            magmiteSpenderChanged = true;
            setTimeout(function () {
                magmiteSpenderChanged = false;
            }, 5000);
        }
        btn.value++;
        if (btn.value > btn.name.length - 1)
            btn.value = 0;
        var elC = document.getElementById(id)!;
        elC.setAttribute('class', 'noselect settingsBtn settingKind-cycle settingBtn' + btn.value);
        renderControlFace(elC, btn);
    }
    if (btn.type == 'dropdown') {
        btn.selected = byId(id).value;
        if (id == "Prestige") {
            autoTrimpSettings["PrestigeBackup"] = {
                selected: byId(id).value,
                name: "PrestigeBackup",
                id: "PrestigeBackup"
            };
        }
    }
    updateCustomButtons();
    saveSettings();
    checkPortalSettings();
}

export function autoSetValueToolTip(id: any, text: any, negative: any, multi: any) {
    ranstring = text;
    var elem = document.getElementById("tooltipDiv")!;
    var tooltipText = 'Type a number below. You can also use shorthand such as 2e5 or 200k.';
    if (negative)
        tooltipText += ' Accepts negative numbers as validated inputs.';
    else
        tooltipText += ' Put -1 for Infinite.';
    tooltipText += `<br/><br/><input id="customNumberBox" style="width: 50%" onkeypress="onKeyPressSetting(event, '${id}', ${negative}, ${multi})" value="${autoTrimpSettings[id].value}"></input>`;
    var costText = '<div class="maxCenter"><div class="btn btn-info" onclick="autoSetValue(\'' + id + '\',' + negative + ',' + multi + ')">Apply</div><div class="btn btn-info" onclick="cancelTooltip()">Cancel</div></div>';
    game.global.lockTooltip = true;
    elem.style.left = '32.5%';
    elem.style.top = '25%';
    document.getElementById('tipTitle')!.textContent = ranstring + ':  Value Input';
    document.getElementById('tipText')!.innerHTML = tooltipText;
    document.getElementById('tipCost')!.innerHTML = costText;
    elem.style.display = 'block';
    var box: any = document.getElementById('customNumberBox');
    try {
        box.setSelectionRange(0, box.value.length);
    } catch (e) {
        box.select();
    }
    box.focus();
}

export function autoSetTextToolTip(id: any, text: any) {
    ranstring = text;
    var elem = document.getElementById("tooltipDiv")!;
    var tooltipText = 'Type your input below';
    tooltipText += `<br/><br/><input id="customTextBox" style="width: 50%" onkeypress="onKeyPressSetting(event, '${id}')" value="${autoTrimpSettings[id].value}"></input>`;
    var costText = '<div class="maxCenter"><div class="btn btn-info" onclick="autoSetText(\'' + id + '\')">Apply</div><div class="btn btn-info" onclick="cancelTooltip()">Cancel</div></div>';
    game.global.lockTooltip = true;
    elem.style.left = '32.5%';
    elem.style.top = '25%';
    document.getElementById('tipTitle')!.textContent = ranstring + ':  Value Input';
    document.getElementById('tipText')!.innerHTML = tooltipText;
    document.getElementById('tipCost')!.innerHTML = costText;
    elem.style.display = 'block';
    var box: any = document.getElementById('customTextBox');
    box.focus();
}

export function onKeyPressSetting(event: any, id: any, negative: any, multi: any) {
    if (event.which == 13 || event.keyCode == 13) {
        if (negative !== undefined && multi !== undefined)
            autoSetValue(id, negative, multi);
        else
            autoSetText(id);
    }
}

export function parseNum(num: any) {
    if (num.split('e')[1]) {
        num = num.split('e');
        num = Math.floor(parseFloat(num[0]) * (Math.pow(10, parseInt(num[1]))));
    } else {
        var letters = num.replace(/[^a-z]/gi, '');
        var base = 0;
        if (letters.length) {
            var suffices = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Od', 'Nd', 'V', 'Uv', 'Dv', 'Tv', 'Qav', 'Qiv', 'Sxv', 'Spv', 'Ov', 'Nv', 'Tt'];
            for (var x = 0; x < suffices.length; x++) {
                if (suffices[x].toLowerCase() == letters) {
                    base = x + 1;
                    break;
                }
            }
            if (base) num = Math.round(parseFloat(num.split(letters)[0]) * Math.pow(1000, base));
        }
        if (!base) num = parseFloat(num);
    }
    return num;
}

export function autoSetValue(id: any, negative: any, multi: any) {
    var num: any = 0;
    unlockTooltip();
    tooltip('hide');
    var numBox: any = document.getElementById('customNumberBox');
    if (numBox) {
        num = numBox.value.toLowerCase();
        if (multi) {
            num = num.split(',').map(parseNum);
        } else {
            num = parseNum(num);
        }
    } else return;
    autoTrimpSettings[id].value = num;
    if (Array.isArray(num)) {
        document.getElementById(id)!.textContent = ranstring + ': ' + num[0] + '+';
    } else if (num > -1 || negative)
        document.getElementById(id)!.textContent = ranstring + ': ' + prettify(num);
    else
        document.getElementById(id)!.innerHTML = ranstring + ': ' + "<span class='icomoon icon-infinity'></span>";
    saveSettings();
    checkPortalSettings();
}

export function autoSetText(id: any) {
    var textVal = 'empty';
    unlockTooltip();
    tooltip('hide');
    var textBox: any = document.getElementById('customTextBox');
    if (textBox) {
        textVal = textBox.value
    } else return;
    autoTrimpSettings[id].value = textVal;
    if (textVal != undefined) {
        document.getElementById(id)!.textContent = ranstring + ': ' + textVal;
    }
    saveSettings();
    checkPortalSettings();
}
