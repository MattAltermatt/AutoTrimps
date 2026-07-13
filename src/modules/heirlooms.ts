// TRUE TS (Phase 1 · #28): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/heirlooms.js.
// Heirloom evaluation / auto-swap / nullifium spend (U1 + U2 radon R* family). 72 game.*
// touches, @ts-nocheck. getPageSetting imported from converted utils. Seam notes:
//   - 14 for(loom of ...) loops had an undeclared loop var (sloppy-mode implicit global);
//     localized to for(var loom of ...) to avoid a strict-mode ReferenceError.
//   - gammaBurstPct + shieldEquipped are bare-written (HeirloomShieldSwapped) but resolve
//     to the globals created at AutoTrimps2.js top level (loads first) — left bare.
//   - top-level DOM code appends heirloom buttons to static index.html elements (safe at
//     the early src slot). animated/worth3/hrlmProtBtn* module vars are heirlooms-internal.
import { getPageSetting, textSettingIsSet } from './utils'

var hrlmProtBtn1 = document.createElement('DIV');
hrlmProtBtn1.setAttribute('class', 'noselect heirloomBtnActive heirBtn');
hrlmProtBtn1.setAttribute('onclick', 'protectHeirloom(this, true)');
hrlmProtBtn1.innerHTML = 'Protect/Unprotect';
hrlmProtBtn1.id = 'protectHeirloomBTN1';
var hrlmProtBtn2 = document.createElement('DIV');
hrlmProtBtn2.setAttribute('class', 'noselect heirloomBtnActive heirBtn');
hrlmProtBtn2.setAttribute('onclick', 'protectHeirloom(this, true)');
hrlmProtBtn2.innerHTML = 'Protect/Unprotect';
hrlmProtBtn2.id = 'protectHeirloomBTN2';
var hrlmProtBtn3 = document.createElement('DIV');
hrlmProtBtn3.setAttribute('class', 'noselect heirloomBtnActive heirBtn');
hrlmProtBtn3.setAttribute('onclick', 'protectHeirloom(this, true)');
hrlmProtBtn3.innerHTML = 'Protect/Unprotect';
hrlmProtBtn3.id = 'protectHeirloomBTN3';
document.getElementById('equippedHeirloomsBtnGroup')!.appendChild(hrlmProtBtn1);
document.getElementById('carriedHeirloomsBtnGroup')!.appendChild(hrlmProtBtn2);
document.getElementById('extraHeirloomsBtnGroup')!.appendChild(hrlmProtBtn3);
export function protectHeirloom(a?: any, b?: any) {
    var c = game.global.selectedHeirloom;
    var d = c[1];
    var e = game.global[d];
    if (-1 != c[0]) var e = e[c[0]];
    if (b) e.protected = !e.protected;
    if (!a) {
        if (d.includes("Equipped")) a = document.getElementById("protectHeirloomBTN1");
        else if ("heirloomsCarried" == d) a = document.getElementById("protectHeirloomBTN2");
        else if ("heirloomsExtra" == d) a = document.getElementById("protectHeirloomBTN3");
    }
    if (a) a.innerHTML = e.protected ? "UnProtect" : "Protect";
}
export function newSelectHeirloom(a?: any, b?: any, c?: any) {
    selectHeirloom(a, b, c);
    protectHeirloom();
}
export function highdmgshield(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('highdmg'))return loom;}
export function lowdmgshield(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('lowdmg'))return loom;}
export function dhighdmgshield(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('dhighdmg'))return loom;}
export function dlowdmgshield(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('dlowdmg'))return loom;}

export function getHeirloomEff(name: string, type: string): number | undefined {
  if (type == "staff") {
    if (getPageSetting('slot1modst') == name) return 5;
    else if (getPageSetting('slot2modst') == name) return 5;
    else if (getPageSetting('slot3modst') == name) return 5;
    else if (getPageSetting('slot4modst') == name) return 5;
    else if (getPageSetting('slot5modst') == name) return 5;
    else if (getPageSetting('slot6modst') == name) return 5;
    else if (getPageSetting('slot7modst') == name) return 5;
	else return 0;
  }
  else if (type == "shield") {
    if (getPageSetting('slot1modsh') == name) return 5;
    else if (getPageSetting('slot2modsh') == name) return 5;
    else if (getPageSetting('slot3modsh') == name) return 5;
    else if (getPageSetting('slot4modsh') == name) return 5;
    else if (getPageSetting('slot5modsh') == name) return 5;
    else if (getPageSetting('slot6modsh') == name) return 5;
    else if (getPageSetting('slot7modsh') == name) return 5;
	else return 0;
  }
  else if (type == "core") {
    if (getPageSetting('slot1modcr') == name) return 5;
    else if (getPageSetting('slot2modcr') == name) return 5;
    else if (getPageSetting('slot3modcr') == name) return 5;
    else if (getPageSetting('slot4modcr') == name) return 5;
	else return 0;
  }
}

export function evaluateHeirloomMods2(loom: any, location: string): number {

  var eff = 0;
  var name;
  var type;
  var rarity;
  var raretokeep = getPageSetting('raretokeep');
	if (raretokeep == 'Any' || raretokeep == 'Common') raretokeep = 0;
	else if (raretokeep == 'Uncommon') raretokeep = 1;
	else if (raretokeep == 'Rare') raretokeep = 2;
	else if (raretokeep == 'Epic') raretokeep = 3;
	else if (raretokeep == 'Legendary') raretokeep = 4;
	else if (raretokeep == 'Magnificent') raretokeep = 5;
	else if (raretokeep == 'Ethereal') raretokeep = 6;
	else if (raretokeep == 'Magmatic') raretokeep = 7;
	else if (raretokeep == 'Plagued') raretokeep = 8;
	else if (raretokeep == 'Radiating') raretokeep = 9;
        else if (raretokeep == 'Hazardous') raretokeep = 10;
	else if (raretokeep == 'Enigmatic') raretokeep = 11;
	else if (raretokeep == 'Mutated') raretokeep = 12;

  if (location.includes('Equipped'))
    loom = game.global[location];
  else
    loom = game.global[location][loom];

  for (var m in loom.mods) {
    name = loom.mods[m][0];
    type = loom.type;
    rarity = loom.rarity;
    if (type == "Shield") {
      eff += getHeirloomEff(name, "shield")!;
    }
    if (type == "Staff") {
      eff += getHeirloomEff(name, "staff")!;
    }
    if (type == "Core") {
      eff += getHeirloomEff(name, "core")!;
    }
    if (rarity >= raretokeep) {
	eff += 1000;
    }
    if (name == "empty" && type == "Shield") {
        eff *= 4;
    }
    if (name == "empty" && type == "Staff") {
        eff *= 4;
    }
    if (name == "empty" && type == "Core") {
        eff *= 4;
    }
    if (rarity >= raretokeep) {
       eff *= 10000;
    }
    else if (rarity < raretokeep) {
       eff /= 10000;
    }
  }
  return eff;
}

var worth3: any = {'Shield': [], 'Staff': [], 'Core': []};
export function worthOfHeirlooms3(){
    worth3 = {'Shield': [], 'Staff': [], 'Core': []};
    for (var index in game.global.heirloomsExtra) {
        var theLoom = game.global.heirloomsExtra[index];
        var data = {'location': 'heirloomsExtra', 'index': index, 'rarity': theLoom.rarity, 'eff': evaluateHeirloomMods2(index, 'heirloomsExtra')};
        worth3[theLoom.type].push(data);
    }
    var valuesort = function(a: any, b: any){return b.eff - a.eff;};
    worth3['Shield'].sort(valuesort);
    worth3['Staff'].sort(valuesort);
    worth3['Core'].sort(valuesort);
}

export function autoheirlooms3() {

    if(!heirloomsShown && game.global.heirloomsExtra.length > 0){
        var originalLength = game.global.heirloomsCarried.length;
        for(var index=0; index < originalLength; index++) {
            selectHeirloom(0, 'heirloomsCarried');
            stopCarryHeirloom();
        }

	//CARRY
        var originalLength = game.global.heirloomsExtra.length;
        for(var index=0; index < originalLength; index++) {
            var theLoom = game.global.heirloomsExtra[index];
            if ((theLoom.protected) && (game.global.heirloomsCarried.length < getMaxCarriedHeirlooms())){
                selectHeirloom(index, 'heirloomsExtra');
                carryHeirloom();
                index--; originalLength--;
            }
        }

	//SHIELD
	if (getPageSetting('typetokeep') == 1) {
       		 while ((game.global.heirloomsCarried.length < getMaxCarriedHeirlooms()) && game.global.heirloomsExtra.length > 0){
                        worthOfHeirlooms3();
                        if (worth3["Shield"].length > 0){
                            var carryshield = worth3["Shield"].shift();
                            selectHeirloom(carryshield.index, 'heirloomsExtra');
                            carryHeirloom();
                        }
			else break;
                }
	}

	//STAFF
	else if (getPageSetting('typetokeep') == 2) {
       		 while ((game.global.heirloomsCarried.length < getMaxCarriedHeirlooms()) && game.global.heirloomsExtra.length > 0){
                        worthOfHeirlooms3();
                        if (worth3["Staff"].length > 0){
                            var carrystaff = worth3["Staff"].shift();
                            selectHeirloom(carrystaff.index, 'heirloomsExtra');
                            carryHeirloom();
                        }
			else break;
                }
	}

	//CORE
	else if (getPageSetting('typetokeep') == 3) {
       		 while ((game.global.heirloomsCarried.length < getMaxCarriedHeirlooms()) && game.global.heirloomsExtra.length > 0){
                        worthOfHeirlooms3();
                        if (worth3["Core"].length > 0){
                            var carrycore = worth3["Core"].shift();
                            selectHeirloom(carrycore.index, 'heirloomsExtra');
                            carryHeirloom();
                        }
			else break;
                }
	}

	//ALL
	else if (getPageSetting('typetokeep') == 4) {
       		 while ((game.global.heirloomsCarried.length < getMaxCarriedHeirlooms()) && game.global.heirloomsExtra.length > 0){
            		worthOfHeirlooms3();
            		if (worth3["Shield"].length > 0){
                	    var carryshield = worth3["Shield"].shift();
                	    selectHeirloom(carryshield.index, 'heirloomsExtra');
                            carryHeirloom();
              		}
                        worthOfHeirlooms3();
                        if (worth3["Staff"].length > 0){
                            var carrystaff = worth3["Staff"].shift();
                            selectHeirloom(carrystaff.index, 'heirloomsExtra');
                            carryHeirloom();
                        }
                        worthOfHeirlooms3();
                        if (worth3["Core"].length > 0){
                            var carrycore = worth3["Core"].shift();
                            selectHeirloom(carrycore.index, 'heirloomsExtra');
                            carryHeirloom();
                        }
                }
	}
    }
}

//Loom Swapping

export function lowHeirloom() {
	var loom = lowdmgshield();
	if (loom != undefined && game.global.ShieldEquipped.name != getPageSetting('lowdmg')) {
        selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
        equipHeirloom();
	}
}
export function dlowHeirloom() {
	var loom = dlowdmgshield();
	if (loom != undefined && game.global.ShieldEquipped.name != getPageSetting('dlowdmg')) {
        selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
        equipHeirloom();
	}
}
export function highHeirloom() {
	var loom = highdmgshield();
	if (loom != undefined && game.global.ShieldEquipped.name != getPageSetting('highdmg')) {
        selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
        equipHeirloom();
	}
}
export function dhighHeirloom() {
	var loom = dhighdmgshield();
	if (loom != undefined && game.global.ShieldEquipped.name != getPageSetting('dhighdmg')) {
        selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
        equipHeirloom();
	}
}

export function generateHeirloomIcon(heirloom: any, location: string, number?: number): string {
    if (typeof heirloom.name === 'undefined') return "<span class='icomoon icon-sad3'></span>";
    var icon = getHeirloomIcon(heirloom);
    var animated = (game.options.menu.showHeirloomAnimations.enabled) ? "animated " : "";
    var html = '<span class="heirloomThing ' + animated + 'heirloomRare' + heirloom.rarity;
    if (location == "Equipped") html += ' equipped';
    var locText = "";
    if (location == "Equipped") locText += '-1,\'' + heirloom.type + 'Equipped\'';
    else locText += number + ', \'heirlooms' + location + '\'';
    html += '" onmouseover="tooltip(\'Heirloom\', null, event, null, ' + locText + ')" onmouseout="tooltip(\'hide\')" onclick="newSelectHeirloom(';
    html += locText + ', this)"> <span class="' + icon + '"></span></span>';
    return html;
}

//Radon
export function Rhsshield1(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('Rhs1'))return loom;}
export function Rhsshield2(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('Rhs2'))return loom;}
export function Rdhsshield1(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('Rdhs1'))return loom;}
export function Rdhsshield2(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('Rdhs2'))return loom;}
export function Rhsworldstaff(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('Rhsworldstaff'))return loom;}
export function Rhsmapstaff(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('Rhsmapstaff'))return loom;}
export function Rhstributestaff(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('Rhstributestaff'))return loom;}
export function Rdhsworldstaff(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('Rdhsworldstaff'))return loom;}
export function Rdhsmapstaff(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('Rdhsmapstaff'))return loom;}
export function Rdhstributestaff(){for(var loom of game.global.heirloomsCarried)if(loom.name==getPageSetting('Rdhstributestaff'))return loom;}

export function Rhsequip1() {
	var loom = Rhsshield1();
	if (loom != undefined && game.global.ShieldEquipped.name != getPageSetting('Rhs1')) {
		selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
		equipHeirloom();
	}
}
export function Rhsequip2() {
	var loom = Rhsshield2();
	if (loom != undefined && game.global.ShieldEquipped.name != getPageSetting('Rhs2')) {
		selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
		equipHeirloom();
	}
}
export function Rdhsequip1() {
	var loom = Rdhsshield1();
	if (loom != undefined && game.global.ShieldEquipped.name != getPageSetting('Rdhs1')) {
		selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
		equipHeirloom();
	}
}
export function Rdhsequip2() {
	var loom = Rdhsshield2();
	if (loom != undefined && game.global.ShieldEquipped.name != getPageSetting('Rdhs2')) {
		selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
		equipHeirloom();
	}
}
export function Rhsworldstaffequip() {
	var loom = Rhsworldstaff();
	if (loom != undefined && game.global.StaffEquipped.name != getPageSetting('Rhsworldstaff')) {
		selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
		equipHeirloom();
	}
}
export function Rhsmapstaffequip() {
	var loom = Rhsmapstaff();
	if (loom != undefined && game.global.StaffEquipped.name != getPageSetting('Rhsmapstaff')) {
		selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
		equipHeirloom();
	}
}

export function Rhstributestaffequip() {
	var loom = Rhstributestaff();
	if (loom != undefined && game.global.StaffEquipped.name != getPageSetting('Rhstributestaff')) {
		selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
		equipHeirloom();
	}
}
export function Rdhsworldstaffequip() {
	var loom = Rdhsworldstaff();
	if (loom != undefined && game.global.StaffEquipped.name != getPageSetting('Rdhsworldstaff')) {
		selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
		equipHeirloom();
	}
}
export function Rdhsmapstaffequip() {
	var loom = Rdhsmapstaff();
	if (loom != undefined && game.global.StaffEquipped.name != getPageSetting('Rdhsmapstaff')) {
		selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
		equipHeirloom();
	}
}

export function Rdhstributestaffequip() {
	var loom = Rdhstributestaff();
	if (loom != undefined && game.global.StaffEquipped.name != getPageSetting('Rdhstributestaff')) {
		selectHeirloom(game.global.heirloomsCarried.indexOf(loom), "heirloomsCarried", true);
		equipHeirloom();
	}
}

export function Rheirloomswap() {
	
	//Swapping Shields
	if (getPageSetting('Rhsshield') != false) {
		if (getPageSetting('Rhsz') > 0 && game.global.world < getPageSetting('Rhsz')) {
			Rhsequip1();
		}
		if (getPageSetting('Rhsz') > 0 && game.global.world >= getPageSetting('Rhsz')) {
			Rhsequip2();
		}
	}
	//Swapping Staffs
	if (getPageSetting('Rhsstaff') != false) {
		if (textSettingIsSet('Rhsworldstaff') && game.global.mapsActive == false) {
			Rhsworldstaffequip();
		}
		if (textSettingIsSet('Rhsmapstaff') && (Rshouldtributefarm == false || !textSettingIsSet('Rhstributestaff')) && game.global.mapsActive == true) {
			Rhsmapstaffequip();
		}
		if (textSettingIsSet('Rhstributestaff') && getPageSetting('Rhsstaff') && Rshouldtributefarm == true && game.global.mapsActive == true) {
			Rhstributestaffequip();
		}
	}
}

// #97 — every call this function made used to be the NON-daily equip twin. Each of those resolves
// the heirloom to equip by the NON-daily setting ids (Rhs1/Rhs2/Rhsworldstaff/…), while every GATE
// here reads the DAILY ids (Rdhsz/Rdhsmapstaff/Rdhstributestaff/…). So for a Daily player on
// `Rdhs == 1` the daily heirloom names acted only as on/off switches, and the heirloom actually
// equipped was whatever their NON-daily config named — silently, while appearing to work. That also
// collapsed `Rdhs: 1` ("use the daily settings") onto `Rdhs: 2` ("DHS: Normal — use the non-daily
// settings"), which is the option that exists precisely to opt OUT of this block.
//
// The five daily twins were already fully written and read the daily ids correctly; they simply had
// zero callers. This is that re-point — no other behavior changes. Pinned by tests/heirlooms.dailyTributeFarm.
export function Rdheirloomswap() {

	//Swapping Shields
	if (getPageSetting('Rdhsshield') != false) {
		if (getPageSetting('Rdhsz') > 0 && game.global.world < getPageSetting('Rdhsz')) {
			Rdhsequip1();
		}
		if (getPageSetting('Rdhsz') > 0 && game.global.world >= getPageSetting('Rdhsz')) {
			Rdhsequip2();
		}
	}
        //Swapping Staffs
	// #71b — these two lines read `Rdshouldtributefarm`, a name NOTHING in the shipped bundle ever
	// assigns. A bare read of a never-created identifier is a ReferenceError, not a benign undefined,
	// so this threw on EVERY tick for a U2 Daily player with a daily map-staff configured, killing the
	// whole tail of mainLoop after it. `tsc` was green only because at-legacy.d.ts declared it.
	//
	// There is NO daily variant of the tribute-farm flag and there should not be: mapfunctions.ts sets
	// `Rshouldtributefarm` regardless of Daily, and the non-daily twin of this exact block (:566/:569
	// above) is line-for-line identical modulo the `Rd` prefix and reads that REAL flag. So read it too.
	//
	// NOT fixed by seeding `globalThis.Rdshouldtributefarm = false` — that would convert a crash into a
	// permanently-dead feature (the tribute-staff arm could never fire), which is the wrong fix.
	if (getPageSetting('Rdhsstaff') != false) {
		if (textSettingIsSet('Rdhsworldstaff') && game.global.mapsActive == false) {
			Rdhsworldstaffequip();
		}
		if (textSettingIsSet('Rdhsmapstaff') && (Rshouldtributefarm == false || !textSettingIsSet('Rdhstributestaff')) && game.global.mapsActive == true) {
			Rdhsmapstaffequip();
		}
		if (textSettingIsSet('Rdhstributestaff') && getPageSetting('Rdhsstaff') && Rshouldtributefarm == true && game.global.mapsActive == true) {
			Rdhstributestaffequip();
		}
	}
}

export function HeirloomShieldSwapped() {
	// #49: only credit gammaBurst for rarity >= 10 shields, matching the game's gate
	// (trimps-game main.js:6612 / main.js:6836). The original `if (!…rarity >= 10) return`
	// precedence-parsed as `(!rarity) >= 10` (always false), so the guard never fired.
	if (game.global.ShieldEquipped.rarity < 10) return;
	gammaBurstPct = (getHeirloomBonus("Shield", "gammaBurst") / 100) > 0 ? (getHeirloomBonus("Shield", "gammaBurst") / 100) : 1;
	shieldEquipped = game.global.ShieldEquipped.id;
}

