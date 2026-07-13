// TRUE TS (Phase 1 · #31): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/dynprestige.js.
// Game-coupled prestige-selection logic with a minified body. The bare `for (i = ...)`
// loops are localized to `var i`. getPageSetting is imported from the converted utils
// module (converted→converted wiring) rather than reached via the global bridge.
// autoTrimpSettings + game/DOM globals resolve via the ambient seam. Byte-identical to gh-pages.
import { getPageSetting } from './utils'

// oxlint-disable-next-line no-unused-vars,no-unused-expressions -- faithful legacy port: dead local — verified not a live bug (#92); faithful legacy port: comma sequence — de-comma behind the live net (#92)
export function prestigeChanging2(){var a=byId<HTMLSelectElement>('Prestige').selectedIndex;if(!(2>=a)){var b=getPageSetting('DynamicPrestige2'),c=10<a?a-10:0,d=0;for(var i=1;i<=a;i++){var e=game.mapUnlocks[autoTrimpSettings.Prestige.list[i]].last;if(e<=b-5){var g=Math.floor((b-e)/5);4<=game.global.sLevel&&(g=Math.ceil(g/2)),d+=g}}challengeActive("Lead")&&(d*=2);var h=0;return 0==d?void(autoTrimpSettings.Prestige.selected=byId<HTMLSelectElement>('Prestige').value):void(h=Math.ceil(d/a),game.global.world>b-h&&(game.global.mapBonus<a?!0==game.global.slowDone?autoTrimpSettings.Prestige.selected='GambesOP':autoTrimpSettings.Prestige.selected='Bestplate':game.global.mapBonus>a&&(autoTrimpSettings.Prestige.selected='Dagadder')),(game.global.world<=b-h||10==game.global.mapBonus)&&(autoTrimpSettings.Prestige.selected='Dagadder'))}}