// TRUE TS (Phase 1 · #31): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/dynprestige.js.
// Game-coupled prestige-selection logic with a minified body. The bare `for (i = ...)`
// loops are localized to `var i`. getPageSetting is imported from the converted utils
// module (converted→converted wiring) rather than reached via the global bridge.
// autoTrimpSettings + game/DOM globals resolve via the ambient seam. Byte-identical to gh-pages.
import { getPageSetting } from './utils'

export function prestigeChanging2() {
    var a = byId<HTMLSelectElement>('Prestige').selectedIndex;
    if (!(2 >= a)) {
        var b = getPageSetting('DynamicPrestige2');
        // (a dead `var c = 10 < a ? a - 10 : 0` lived here — never read; dropped with the de-comma, #92)
        var d = 0;
        for (var i = 1; i <= a; i++) {
            var e = game.mapUnlocks[autoTrimpSettings.Prestige.list[i]].last;
            if (e <= b - 5) {
                var g = Math.floor((b - e) / 5);
                if (4 <= game.global.sLevel) g = Math.ceil(g / 2);
                d += g;
            }
        }
        if (challengeActive("Lead")) d *= 2;
        var h = 0;
        if (0 == d) {
            autoTrimpSettings.Prestige.selected = byId<HTMLSelectElement>('Prestige').value;
            return;
        }
        h = Math.ceil(d / a);
        if (game.global.world > b - h) {
            if (game.global.mapBonus < a) {
                if (!0 == game.global.slowDone) autoTrimpSettings.Prestige.selected = 'GambesOP';
                else autoTrimpSettings.Prestige.selected = 'Bestplate';
            } else if (game.global.mapBonus > a) {
                autoTrimpSettings.Prestige.selected = 'Dagadder';
            }
        }
        if (game.global.world <= b - h || 10 == game.global.mapBonus) autoTrimpSettings.Prestige.selected = 'Dagadder';
        return;
    }
}