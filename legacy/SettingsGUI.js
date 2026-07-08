automationMenuInit();


automationMenuSettingsInit();
var link1 = document.createElement("link");
link1.rel = "stylesheet", link1.type = "text/css", link1.href = basepath + "tabs.css", document.head.appendChild(link1);


function nuloom(slot) {
    var nuloom = getPageSetting('heirloomnu');
    if (game.global.ShieldEquipped.name == nuloom) {
        selectHeirloom(-1, 'ShieldEquipped', true);
        if (slot == 0) {
            return game.global.ShieldEquipped.mods[0][0];
        }
        if (slot == 1) {
            return game.global.ShieldEquipped.mods[1][0];
        }
        if (slot == 2) {
            return game.global.ShieldEquipped.mods[2][0];
        }
        if (slot == 3) {
            return game.global.ShieldEquipped.mods[3][0];
        }
        if (slot == 4) {
            return game.global.ShieldEquipped.mods[4][0];
        }
        if (slot == 5) {
            return game.global.ShieldEquipped.mods[5][0];
        }
    }

    if (game.global.StaffEquipped.name == nuloom) {
        selectHeirloom(-1, 'StaffEquipped', true);
        if (slot == 0) {
            return game.global.StaffEquipped.mods[0][0];
        }
        if (slot == 1) {
            return game.global.StaffEquipped.mods[1][0];
        }
        if (slot == 2) {
            return game.global.StaffEquipped.mods[2][0];
        }
        if (slot == 3) {
            return game.global.StaffEquipped.mods[3][0];
        }
        if (slot == 4) {
            return game.global.StaffEquipped.mods[4][0];
        }
        if (slot == 5) {
            return game.global.StaffEquipped.mods[5][0];
        }
    }

    if (game.global.StaffEquipped.name != nuloom && game.global.ShieldEquipped.name != nuloom) {
        for (var loom of game.global.heirloomsCarried) {
            if (loom.name == getPageSetting('heirloomnu')) {
                selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
                if (slot == 0) {
                    return loom.mods[0][0];
                }
                if (slot == 1) {
                    return loom.mods[1][0];
                }
                if (slot == 2) {
                    return loom.mods[2][0];
                }
                if (slot == 3) {
                    return loom.mods[3][0];
                }
                if (slot == 4) {
                    return loom.mods[4][0];
                }
                if (slot == 5) {
                    return loom.mods[5][0];
                }
            }
        }
    }
}

initializeAllTabs();


initializeAllSettings();
