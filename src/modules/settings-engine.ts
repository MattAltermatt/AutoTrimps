/* eslint-disable */
// @ts-nocheck
// FAITHFUL PORT of legacy/SettingsGUI.js:1226–1548 — the createSetting factory + tooltip/value/
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

export function createSetting(id, name, description, type, defaultValue, list, container) {
    var btnParent = document.createElement("DIV");
    btnParent.setAttribute('style', 'display: inline-block; vertical-align: top; margin-left: 1vw; margin-bottom: 1vw; width: 13.142vw;');
    var btn = document.createElement("DIV");
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
        btn.setAttribute("style", "font-size: 1.1vw;");
        btn.setAttribute('class', 'noselect settingsBtn settingBtn' + autoTrimpSettings[id].enabled);
        btn.setAttribute("onclick", 'settingChanged("' + id + '")');
        btn.setAttribute("onmouseover", 'tooltip(\"' + name + '\", \"customText\", event, \"' + description + '\")');
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        btn.textContent = name;
        btnParent.appendChild(btn);
        if (container) document.getElementById(container).appendChild(btnParent);
        else document.getElementById("autoSettings").appendChild(btnParent);
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
        btn.setAttribute('class', 'noselect settingsBtn btn-info');
        btn.setAttribute("onclick", `autoSetValueToolTip("${id}", "${name}", ${type == 'valueNegative'}, ${type == 'multiValue'})`);
        btn.setAttribute("onmouseover", 'tooltip(\"' + name + '\", \"customText\", event, \"' + description + '\")');
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        btn.textContent = name;
        btnParent.appendChild(btn);
        if (container) document.getElementById(container).appendChild(btnParent);
        else document.getElementById("autoSettings").appendChild(btnParent);
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
        btn.setAttribute('class', 'noselect settingsBtn btn-info');
        btn.setAttribute("onclick", `autoSetValueToolTip("${id}", "${name}", ${type == 'valueNegative'}, ${type == 'multiValue'})`);
        btn.setAttribute("onmouseover", 'tooltip(\"' + name + '\", \"customText\", event, \"' + description + '\")');
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        btn.textContent = name;
        btnParent.appendChild(btn);
        if (container) document.getElementById(container).appendChild(btnParent);
        else document.getElementById("autoSettings").appendChild(btnParent);
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
        btn.setAttribute('class', 'noselect settingsBtn btn-info');
        btn.setAttribute("onclick", `autoSetTextToolTip("${id}", "${name}", ${type == 'textValue'})`);
        btn.setAttribute("onmouseover", 'tooltip(\"' + name + '\", \"customText\", event, \"' + description + '\")');
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        btn.textContent = name;
        btnParent.appendChild(btn);
        if (container) document.getElementById(container).appendChild(btnParent);
        else document.getElementById("autoSettings").appendChild(btnParent);
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
        var btn = document.createElement("select");
        btn.id = id;
        if (game.options.menu.darkTheme.enabled == 2) btn.setAttribute("style", "color: #C8C8C8; font-size: 1.0vw;");
        else btn.setAttribute("style", "color:black; font-size: 1.0vw;");
        btn.setAttribute("class", "noselect");
        btn.setAttribute("onmouseover", 'tooltip(\"' + name + '\", \"customText\", event, \"' + description + '\")');
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
        if (container) document.getElementById(container).appendChild(btnParent);
        else document.getElementById("autoSettings").appendChild(btnParent);
    } else if (type == 'infoclick') {
        btn.setAttribute('class', 'noselect settingsBtn settingBtn3');
        btn.setAttribute("onclick", 'ImportExportTooltip(\'' + defaultValue + '\', \'update\')');
        btn.setAttribute("onmouseover", 'tooltip(\"' + name + '\", \"customText\", event, \"' + description + '\")');
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        btn.setAttribute("style", "background-color: #d88839; color: black; font-size: 1.1vw;");
        btn.textContent = name;
        btnParent.appendChild(btn);
        if (container) document.getElementById(container).appendChild(btnParent);
        else document.getElementById("autoSettings").appendChild(btnParent);
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
        btn.setAttribute("style", "font-size: 1.1vw;");
        btn.setAttribute('class', 'noselect settingsBtn settingBtn' + autoTrimpSettings[id].value);
        btn.setAttribute("onclick", 'settingChanged("' + id + '")');
        btn.setAttribute("onmouseover", 'tooltip(\"' + name.join(' / ') + '\", \"customText\", event, \"' + description + '\")');
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        btn.textContent = autoTrimpSettings[id]["name"][autoTrimpSettings[id]["value"]];
        btnParent.appendChild(btn);
        if (container) document.getElementById(container).appendChild(btnParent);
        else document.getElementById("autoSettings").appendChild(btnParent);
    } else if (type === 'action') {
        btn.setAttribute("style", "font-size: 1.1vw;");
        btn.setAttribute('class', 'noselect settingsBtn settingBtn3');
        btn.setAttribute('onclick', defaultValue);
        btn.setAttribute("onmouseover", 'tooltip(\"' + name + '\", \"customText\", event, \"' + description + '\")');
        btn.setAttribute("onmouseout", 'tooltip("hide")');
        btn.textContent = name;
        btnParent.appendChild(btn);
        if (container) document.getElementById(container).appendChild(btnParent);
        else document.getElementById("autoSettings").appendChild(btnParent);
        return;
    }
    if (autoTrimpSettings[id].name != name)
        autoTrimpSettings[id].name = name;
    if (autoTrimpSettings[id].description != description)
        autoTrimpSettings[id].description = description;
    autoTrimpSettings["ATversion"] = ATversion;
}

export function createInput(id, name, description) {
    var $btnParent = document.createElement("DIV");
    $btnParent.setAttribute('style', 'display: inline-block; vertical-align: top; margin-left: 0.5vw; margin-bottom: 0.5vw; width: 6.5vw;');
    $btnParent.setAttribute("onmouseover", 'tooltip(\"' + name + '\", \"customText\", event, \"' + description + '\")');
    $btnParent.setAttribute("onmouseout", 'tooltip("hide")');
    var $input = document.createElement("input");
    $input.type = 'checkbox';
    $input.setAttribute('id', id);
    $input.setAttribute('style', 'text-align: left; width: 0.8vw; ');
    $btnParent.appendChild($input);
    var $label = document.createElement("label");
    $label.setAttribute('style', 'text-align: left; margin-left: 0.2vw; font-size: 0.6vw');
    $label.innerHTML = name;
    $btnParent.appendChild($label);
    document.getElementById("autoSettings").appendChild($btnParent);
}

export function settingChanged(id) {
    var btn = autoTrimpSettings[id];
    if (btn.type == 'boolean') {
        btn.enabled = !btn.enabled;
        document.getElementById(id).setAttribute('class', 'noselect settingsBtn settingBtn' + btn.enabled);
    }
    if (btn.type == 'multitoggle') {
        if (id == 'AutoMagmiteSpender2' && btn.value == 1) {
            magmiteSpenderChanged = true;
            setTimeout(function () {
                magmiteSpenderChanged = false;
            }, 5000);
        }
        btn.value++;
        if (btn.value > btn.name.length - 1)
            btn.value = 0;
        document.getElementById(id).setAttribute('class', 'noselect settingsBtn settingBtn' + btn.value);
        document.getElementById(id).textContent = btn.name[btn.value];
    }
    if (btn.type == 'dropdown') {
        btn.selected = document.getElementById(id).value;
        if (id == "Prestige") {
            autoTrimpSettings["PrestigeBackup"] = {
                selected: document.getElementById(id).value,
                name: "PrestigeBackup",
                id: "PrestigeBackup"
            };
        }
    }
    updateCustomButtons();
    saveSettings();
    checkPortalSettings();
}

export function autoSetValueToolTip(id, text, negative, multi) {
    ranstring = text;
    var elem = document.getElementById("tooltipDiv");
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
    document.getElementById('tipTitle').textContent = ranstring + ':  Value Input';
    document.getElementById('tipText').innerHTML = tooltipText;
    document.getElementById('tipCost').innerHTML = costText;
    elem.style.display = 'block';
    var box = document.getElementById('customNumberBox');
    try {
        box.setSelectionRange(0, box.value.length);
    } catch (e) {
        box.select();
    }
    box.focus();
}

export function autoSetTextToolTip(id, text) {
    ranstring = text;
    var elem = document.getElementById("tooltipDiv");
    var tooltipText = 'Type your input below';
    tooltipText += `<br/><br/><input id="customTextBox" style="width: 50%" onkeypress="onKeyPressSetting(event, '${id}')" value="${autoTrimpSettings[id].value}"></input>`;
    var costText = '<div class="maxCenter"><div class="btn btn-info" onclick="autoSetText(\'' + id + '\')">Apply</div><div class="btn btn-info" onclick="cancelTooltip()">Cancel</div></div>';
    game.global.lockTooltip = true;
    elem.style.left = '32.5%';
    elem.style.top = '25%';
    document.getElementById('tipTitle').textContent = ranstring + ':  Value Input';
    document.getElementById('tipText').innerHTML = tooltipText;
    document.getElementById('tipCost').innerHTML = costText;
    elem.style.display = 'block';
    var box = document.getElementById('customTextBox');
    box.focus();
}

export function onKeyPressSetting(event, id, negative, multi) {
    if (event.which == 13 || event.keyCode == 13) {
        if (negative !== undefined && multi !== undefined)
            autoSetValue(id, negative, multi);
        else
            autoSetText(id);
    }
}

export function parseNum(num) {
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

export function autoSetValue(id, negative, multi) {
    var num = 0;
    unlockTooltip();
    tooltip('hide');
    var numBox = document.getElementById('customNumberBox');
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
        document.getElementById(id).textContent = ranstring + ': ' + num[0] + '+';
    } else if (num > -1 || negative)
        document.getElementById(id).textContent = ranstring + ': ' + prettify(num);
    else
        document.getElementById(id).innerHTML = ranstring + ': ' + "<span class='icomoon icon-infinity'></span>";
    saveSettings();
    checkPortalSettings();
}

export function autoSetText(id) {
    var textVal = 'empty';
    unlockTooltip();
    tooltip('hide');
    var textBox = document.getElementById('customTextBox');
    if (textBox) {
        textVal = textBox.value
    } else return;
    autoTrimpSettings[id].value = textVal;
    if (textVal != undefined) {
        document.getElementById(id).textContent = ranstring + ': ' + textVal;
    }
    saveSettings();
    checkPortalSettings();
}
