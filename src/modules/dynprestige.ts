// TRUE TS (Phase 1 · #31): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/dynprestige.js.
// Game-coupled prestige-selection logic with a minified body. The bare `for (i = ...)`
// loops are localized to `var i`. getPageSetting is imported from the converted utils
// module (converted→converted wiring) rather than reached via the global bridge.
// autoTrimpSettings + game/DOM globals resolve via the ambient seam. Byte-identical to gh-pages.
import { getPageSetting } from './utils'

export function prestigeChanging2(){var a=(document.getElementById('Prestige') as any).selectedIndex;if(!(2>=a)){var b=getPageSetting('DynamicPrestige2'),c=10<a?a-10:0,d=0;for(var i=1;i<=a;i++){var e=game.mapUnlocks[autoTrimpSettings.Prestige.list[i]].last;if(e<=b-5){var g=Math.floor((b-e)/5);4<=game.global.sLevel&&(g=Math.ceil(g/2)),d+=g}}challengeActive("Lead")&&(d*=2);var h=0;return 0==d?void(autoTrimpSettings.Prestige.selected=(document.getElementById('Prestige') as any).value):void(h=Math.ceil(d/a),game.global.world>b-h&&(game.global.mapBonus<a?!0==game.global.slowDone?autoTrimpSettings.Prestige.selected='GambesOP':autoTrimpSettings.Prestige.selected='Bestplate':game.global.mapBonus>a&&(autoTrimpSettings.Prestige.selected='Dagadder')),(game.global.world<=b-h||10==game.global.mapBonus)&&(autoTrimpSettings.Prestige.selected='Dagadder'))}}
export function RprestigeChanging2(){
    var maxPrestigeIndex = (document.getElementById('RPrestige') as any).selectedIndex;
    if (maxPrestigeIndex <= 2)
        return;
    var lastzone = getPageSetting("RDynamicPrestige2");
    var extra = maxPrestigeIndex > 10 ? maxPrestigeIndex - 10 : 0;
    var neededPrestige = 0;
    for (var i = 1; i <= maxPrestigeIndex ; i++){
        var lastp = game.mapUnlocks[autoTrimpSettings.RPrestige.list[i]].last;
        if (lastp <= lastzone - 5){
            var rem = lastzone - lastp;
            var addto = Math.floor(rem/5);
            if (game.global.sLevel >= 4)
                addto = Math.ceil(addto/2);
            neededPrestige += addto;
        }
    }
    var zonesToFarm = 0;
    if (neededPrestige == 0){
        autoTrimpSettings.RPrestige.selected = (document.getElementById('RPrestige') as any).value;
        return;
    }
    zonesToFarm = Math.ceil(neededPrestige/maxPrestigeIndex);
    if(game.global.world > (lastzone-zonesToFarm)){
        if (game.global.mapBonus < maxPrestigeIndex) {
            if(game.global.slowDone == true)
                autoTrimpSettings.RPrestige.selected = "GambesOP";
            else
                autoTrimpSettings.RPrestige.selected = "Bestplate";
        }
        else if (game.global.mapBonus > maxPrestigeIndex)
             autoTrimpSettings.RPrestige.selected = "Dagadder";
    }
    if (game.global.world <= lastzone-zonesToFarm || game.global.mapBonus == 10)
        autoTrimpSettings.RPrestige.selected = "Dagadder";
}
