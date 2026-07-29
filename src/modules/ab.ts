// TRUE TS (Phase 1 · #30): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/ab.js.
// AutoBattle (U2) preset/dust/farm automation + solver. contractVoid left bare (resolves to
// the var declared in still-legacy mapfunctions.js, read at runtime) — typed ambient. autoBattle
// is the game's U2 combat global (ambient). Behaviour-preserving: any body edits are TYPE-ONLY.
// #174: `saveSettings` is the ONLY writer to localStorage (utils.ts:159-162); `setPageSetting`
// mutates the in-memory store and nothing else. ab.ts writes a persisted setting, so it has to
// flush — every other write path to a persisted setting already does.
import { getPageSetting, setPageSetting, saveSettings } from './utils'

//AB

export function getCurrentAB(effect: boolean) {

    if (effect == false) {
      return autoBattle.enemyLevel;
    }
    else {
        var poison = autoBattle.enemy.poisonResist;
        var bleed = autoBattle.enemy.bleedResist;
        var shock = autoBattle.enemy.shockResist;

        // L151-160 enemies (5.10.0) are 100% immune to one damage type (enemy.immune), yet its numeric
        // resist stays at 0 and would read as "least resisted". Force the immune type to Infinity resist
        // so the preset switcher never picks a status the enemy fully blocks.
        if (autoBattle.enemy.immune == "poison") poison = Infinity;
        else if (autoBattle.enemy.immune == "bleed") bleed = Infinity;
        else if (autoBattle.enemy.immune == "shock") shock = Infinity;

        var lowestResist = Math.min(poison,bleed,shock);

        var outEffect = "";
        if (poison == lowestResist) {
            outEffect += "p";
        }
        if (bleed == lowestResist) {
            outEffect += "b";
        }
        if (shock == lowestResist) {
            outEffect += "s";
        }

        return outEffect;
    }
};

export function checkPreset(presetSlot: number) {

    for (var item in autoBattle.items) {
        if (autoBattle.items[item].equipped && autoBattle.presets["p" + presetSlot].indexOf(item) == -1) {
            return false;
        }
    }
    return true;
}

export function ABcheck() {

    var winning = autoBattle.sessionEnemiesKilled >= autoBattle.sessionTrimpsKilled;

    if (winning) return 0;

    if (getCurrentAB(true) == "pbs" && (checkPreset(1) || checkPreset(2) || checkPreset(3))) {
        if (checkPreset(1)) return 2;
        else if (checkPreset(2)) return 3;
        else if (checkPreset(3)) return 1;
    }
    else if (getCurrentAB(true) == "pb" && (checkPreset(1) || checkPreset(2))) {
        if (checkPreset(1)) return 2;
        else if (checkPreset(2)) return 1;
    }
    else if (getCurrentAB(true) == "ps" && (checkPreset(1) || checkPreset(3))) {
        if (checkPreset(1)) return 3;
        else if (checkPreset(3)) return 1;
    }
    else if (getCurrentAB(true) == "bs" && (checkPreset(2) || checkPreset(3))) {
        if (checkPreset(2)) return 3;
        else if (checkPreset(3)) return 2;
    }
    else if (getCurrentAB(true) == "p" && (checkPreset(2) || checkPreset(3))) {
        return 1;
    }
    else if (getCurrentAB(true) == "b" && (checkPreset(1) || checkPreset(3))) {
        return 2;
    }
    else if (getCurrentAB(true) == "s" && (checkPreset(1) || checkPreset(2))) {
        return 3;
    }
}

export function ABswitch() {

    if (ABcheck()! > 0) {
        if (ABcheck() == 1) autoBattle.loadPreset('p1');
        else if (ABcheck() == 2) autoBattle.loadPreset('p2');
        else if (ABcheck() == 3) autoBattle.loadPreset('p3');
    }
}

/**
 * #164 — both dust buyers ranked candidates on the raw `upgradeCost` number and then committed to
 * the winner, but that price is denominated in the ITEM's own currency: `upgrade()` spends shards
 * when `dustType == "shards"` and dust otherwise (objects.js:3659-3665, verified against the pinned
 * clone). Doppelganger_Signet and Doppelganger_Diadem declare neither `startPrice` nor `priceMod`,
 * so their level-1 cost is the table minimum of 5 — but 5 SHARDS. The gate tested `autoBattle.dust`,
 * which is trivially past 5 at any depth where these items exist, so `equips[0]` was the shard item
 * forever, `upgrade()` returned at its own `currency < cost`, and NO dust item was ever attempted
 * again. The ranking is a pure function of state, so the same loser was re-picked every tick.
 *
 * When the player DOES have shards it fails the other way: both those items are `noUpgrade: true`
 * (objects.js:2628/2668), which the game renders as a grey "Unupgradable" button (objects.js:4325)
 * and whose `doStuff()` never reads `this.level` — and `upgrade()` has no `noUpgrade` guard, so the
 * shards bought literally nothing.
 *
 * So: price each candidate against the currency it is actually spent in, skip the unupgradable
 * ones, and fall through to the next affordable candidate instead of committing to the cheapest.
 * "Cheapest first" is what the setting's own tooltip advertises; committing to a single candidate
 * was never part of that promise.
 */
function abUpgradeCurrency(item: string): number {
    // Mirrors objects.js:3662 exactly. Do not paraphrase it — this is the game's rule, not ours.
    return autoBattle.items[item].dustType == "shards" ? autoBattle.shards : autoBattle.dust;
}

function abUpgradeCheapestAffordable(names: string[]) {
    var candidates: any[] = [];

    for (var i = 0; i < names.length; i++) {
        if (autoBattle.items[names[i]].noUpgrade) continue;
        candidates.push([names[i], autoBattle.upgradeCost(names[i])]);
    }

    candidates.sort(function(a, b) {
        return a[1] - b[1];
    });

    for (var c = 0; c < candidates.length; c++) {
        if (abUpgradeCurrency(candidates[c][0]) >= candidates[c][1]) {
            autoBattle.upgrade(candidates[c][0]);
            return;
        }
    }
}

export function ABdustsimple() {

    var equips: string[] = [];

    for (var item in autoBattle.items) {
        if (autoBattle.items[item].equipped) {
            equips.push(item);
        }
    }

    // #77: the loop above FILTERS, so it can match nothing — the game permits a zero-item loadout
    // (objects.js:3573 equip() guards only the MAXIMUM), and loadPreset() on a never-saved preset
    // blanks the loadout outright (objects.js:930; presets default to []). Indexing equips[0][1] on
    // an empty array threw a TypeError out of a mainLoop that has NO try/catch (#87), decapitating
    // every automation dispatched after the AB block, every tick, forever.
    if (equips.length === 0) return;

    abUpgradeCheapestAffordable(equips);
}

export function ABdustsimplenonhid() {

    var equips: string[] = [];

    for (var item in autoBattle.items) {
        // #164: `!equipped && !hidden` also admits every item the player does not OWN — `load()`
        // forces `hidden = false` for any item with no save entry (objects.js:857-864), so an
        // uncontracted item reads as a perfectly good candidate and soaks up the buy.
        if (autoBattle.items[item].owned && !autoBattle.items[item].equipped && !autoBattle.items[item].hidden) {
            equips.push(item);
        }
    }

    // #77: same unguarded-first-element shape as ABdustsimple — this filter matches nothing once
    // every item is equipped-or-hidden.
    if (equips.length === 0) return;

    abUpgradeCheapestAffordable(equips);
}

/**
 * #165 / #174 / #190 — `RABfarmstring` is declared `textValue` (settings-defs.ts:2776) but ab.ts
 * stored a nested ARRAY into it. Three separately-reported defects all fall out of that one broken
 * contract, so they are fixed as one:
 *
 *   #165  ABfarmswitch indexed the stored value POSITIONALLY. Against a real string — one pasted in
 *         (which the tooltip explicitly invites: "Safe to share with other AT users"), or simply the
 *         result of opening the String box and pressing Apply, since `autoSetText` writes
 *         `textBox.value` back raw (settings-engine.ts:477-485) — `[0]` is the first CHARACTER and
 *         `[2]` the third. `",".indexOf(item)` is -1 for every equipped item, so `match` was always
 *         true and the apply block unequipped EVERY item, hid every owned one (`loadHide` defaults
 *         to 1, objects.js:1018-1021), re-equipped nothing (`autoBattle.items[","]` is undefined),
 *         and called `resetCombat(true)`. Every tick, forever. ABfarmsave could not self-heal it
 *         either: `resetStats()` zeroes `sessionEnemiesKilled` (objects.js:3564-3571), so the `> 8`
 *         guard below can never pass again once the reset loop starts.
 *   #190  An array has no `.substring`, so `updateCustomButtons`' textValue branch was skipped and
 *         the control fell through to the infinity face — which everywhere else in AT means
 *         "unset". The value the tooltip tells you to share was invisible in the UI.
 *   #174  `setPageSetting` only mutates the in-memory store (utils.ts:141-142). `saveSettings()` is
 *         the sole writer to localStorage and ab.ts never called it, so the "best-ever" scoreboard
 *         survived only until the tab reloaded.
 *
 * The fix is to honour the declared type: store a STRING, parse on read. The serialized form is
 * byte-identical to what the old array stringified to (`String([5,1234,['A','B']])` is
 * "5,1234,A,B"), so strings already shared between players keep working unchanged — and the parser
 * still ACCEPTS the old nested array, because a veteran's localStorage holds exactly that and
 * dropping it would wipe their scoreboard on upgrade.
 */
export interface ABfarmTarget {
    level: number
    dust: number
    items: string[]
}

export function parseABfarmstring(raw: any): ABfarmTarget | null {
    var head: any[]
    var tail: any[]

    if (Array.isArray(raw)) {
        // The pre-fix shape: [enemyLevel, bestdust, [item, ...]]. The item list is nested one deep.
        head = [raw[0], raw[1]]
        tail = []
        for (var r = 2; r < raw.length; r++) {
            if (Array.isArray(raw[r])) tail = tail.concat(raw[r])
            else tail.push(raw[r])
        }
    } else if (typeof raw === 'string') {
        var parts = raw.split(',')
        head = [parts[0], parts[1]]
        tail = parts.slice(2)
    } else {
        // `false` (absent key, #68), undefined, null, a number — every "unset" encoding.
        return null
    }

    // `Number` rather than `parseFloat` so a trailing-garbage value like "12abc" is REJECTED instead
    // of silently becoming 12 — this number is assigned straight to `autoBattle.enemyLevel`. The
    // `< 1` test is what rejects the declared '-1' default (settings-defs.ts:2776) and, because
    // `Number('')` and `Number(null)` are both 0, an empty box as well.
    var level = Number(head[0])
    if (!Number.isFinite(level) || level < 1) return null

    var dust = Number(head[1])
    if (!Number.isFinite(dust) || dust < 0) dust = 0

    var items: string[] = []
    for (var i = 0; i < tail.length; i++) {
        var name = String(tail[i]).trim()
        if (name !== '') items.push(name)
    }

    return { level: level, dust: dust, items: items }
}

export function ABfarmsave() {

    var equips = [];

    for (var item in autoBattle.items) {
        if (autoBattle.items[item].equipped) {
            equips.push(item);
        }
    }

    var dustps = parseInt(autoBattle.getDustPs());

    var bestdust = 0;
    if (autoBattle.sessionEnemiesKilled > 2 && autoBattle.sessionEnemiesKilled > autoBattle.sessionTrimpsKilled) bestdust = dustps;

    var string = [autoBattle.enemyLevel, bestdust].concat(equips).join(',');

    // #165: the writer honours the same contract as the reader. If what we are about to store would
    // not parse back (an enemyLevel below 1, say), storing it would leave ABfarmswitch reading an
    // unset value and this function re-writing it every tick — with a localStorage flush each time.
    if (parseABfarmstring(string) === null) return;

    var current = parseABfarmstring(getPageSetting('RABfarmstring'));

    // #165: was `getPageSetting('RABfarmstring') == "-1"`, i.e. the declared default ONLY. Treating
    // every unparseable value as unset is what lets AT recover from a bad paste instead of looping
    // on it forever — and it subsumes the '-1' case that guard was written for.
    if (current === null) {
        setPageSetting('RABfarmstring', string);
        saveSettings();
    }
    // #103: this was the ONE direct `autoTrimpSettings.RABfarmstring.value[1]` in a function family
    // that otherwise read `getPageSetting('RABfarmstring')[0]` / `[2]` (ABfarmswitch, below). Same
    // id, two different reading paths — the inconsistency #103 closed, and #165 finishes by giving
    // the whole family one parser.
    else if (autoBattle.sessionEnemiesKilled > 8 && autoBattle.sessionEnemiesKilled > autoBattle.sessionTrimpsKilled && bestdust > 0 && current.dust < bestdust) {
        setPageSetting('RABfarmstring', string);
        saveSettings();
    }
}

export function ABfarmswitch() {
    // Fix (#22): guard the '-1' sentinel default like ABfarmsave does; indexing the string '-1'
    // as an array ([0]/[2]) corrupted enemyLevel and threw on .indexOf, aborting the tick.
    // #165: that guard only ever covered the exact literal '-1'. Parsing covers every non-array
    // value, and an unparseable one is now a NO-OP — which is the only safe reading, given that the
    // old code's response to one was to unequip and hide the player's entire owned item list.
    var target = parseABfarmstring(getPageSetting('RABfarmstring'));
    if (target === null) return;

    if (autoBattle.enemyLevel != target.level) {
        autoBattle.enemyLevel = target.level;
        autoBattle.resetCombat(true)
    }

    var match = false;

    for (var item in autoBattle.items) {
        if (autoBattle.items[item].equipped && target.items.indexOf(item) == -1) {
            match = true;
        }
    }

    if (match) {
        var preset = target.items;
        var plength = preset.length;
        if (plength > autoBattle.getMaxItems()) plength = autoBattle.getMaxItems();
        for (var item in autoBattle.items){
             autoBattle.items[item].equipped = false;
             if (autoBattle.settings.loadHide.enabled) autoBattle.items[item].hidden = (autoBattle.items[item].owned) ? true : false;
        }
        for (var x = 0; x < plength; x++){
            if (!autoBattle.items[preset[x]] || !autoBattle.items[preset[x]].owned) continue;
                autoBattle.items[preset[x]].equipped = true;
                autoBattle.items[preset[x]].hidden = false;
        }
        autoBattle.resetCombat(true);
    }
}

export function ABlevelswitch(level: number) {
    if (autoBattle.enemyLevel != level) {
        autoBattle.enemyLevel = level;
        autoBattle.resetCombat(true);
    }
}

/**
 * #173 — ABsolver levelled and gated on items the player does not OWN.
 *
 * The dust is destroyed by the game's own save: `save()` skips any item with `owned === false`
 * (objects.js:791-793) and `load()` resets an item with no save entry to `level = 1`
 * (objects.js:857-864). So every level bought on an unowned item evaporates on the next page load
 * and is re-bought next session, forever. `autoBattle.upgrade()` itself has no `owned` check
 * (objects.js:3659-3665) — verified against the pinned clone — so nothing downstream stops it.
 *
 * Worse than the waste is the READINESS half: the solver gates tier progression on those same
 * phantom levels (`Comfy_Boots.level >= 3` → buy Extra_Limbs). A check meant to say "this item is
 * levelled" was satisfied by levels on an item that cannot be equipped and contributes nothing to
 * combat, so the solver advanced a tier it was not actually ready for.
 *
 * Rather than bolt an `owned` test onto the two sites the finding named, both operations now route
 * through helpers and EVERY site in ABsolver uses them — the finding's own list was a one-pass
 * reading, and the real census is 7 upgrade calls and 13 level reads. `tests/ab.solverOwned.test.ts`
 * derives that census from the source so a new bare read cannot quietly rejoin the class.
 */
function abOwnedLevel(item: string): number {
    // An unowned item reads as level 0 — which is what it will BE after the next reload. This makes
    // every readiness gate below mean "levelled AND actually held", which is what they each claim.
    return autoBattle.items[item].owned ? autoBattle.items[item].level : 0;
}

function abUpgradeOwned(item: string) {
    if (!autoBattle.items[item].owned) return;
    autoBattle.upgrade(item);
}

export function ABsolver() {

    if (autoBattle.autoLevel) autoBattle.toggleAutoLevel();

    var max = autoBattle.maxEnemyLevel;
    var items: string[] = [];
    var level: number[] = [];
    var contract = '';

    //Solver

    switch(max) {

        case 1:

        ABlevelswitch(1);

        items = ['Sword','Armor','Fists_of_Goo','Battery_Stick'];
        level = [2,1,1,1];
        
	break;

        case 2:

        ABlevelswitch(2);

        items = ['Sword','Armor','Fists_of_Goo','Battery_Stick'];
        level = [3,2,1,2];
        
	break;

        case 3:

        if (autoBattle.bonuses.Extra_Limbs.level < 1) {
            items = ['Sword','Armor','Fists_of_Goo','Battery_Stick'];
            level = [4,2,2,2];
            for (var equip in autoBattle.items) {
                if (abOwnedLevel(equip) < level[items.indexOf(equip)]) {
                    ABlevelswitch(2);
                }
                if (abOwnedLevel(equip) >= level[items.indexOf(equip)]) {
                    if (autoBattle.bonuses.Extra_Limbs.level < 1) {
                        autoBattle.buyBonus('Extra_Limbs');
                    }
                }
            }
        }
        
        if (autoBattle.bonuses.Extra_Limbs.level >= 1) {
            items = ['Sword','Armor','Fists_of_Goo','Battery_Stick','Pants'];
            level = [4,3,2,2,4];
            var proceed = true;
            for (var equip in autoBattle.items) {
                if (abOwnedLevel(equip) < level[items.indexOf(equip)]) {
		    proceed = false;
		}
            }

            if (!proceed && autoBattle.enemyLevel != 2) {
                autoBattle.enemyLevel = 2;
                autoBattle.resetCombat(true);
            }

            if (proceed && autoBattle.enemyLevel != 3) {
                autoBattle.enemyLevel = 3;
                autoBattle.resetCombat(true);
            }
        }

	break;

        case 4:

        if (!autoBattle.items.Raincoat.owned) {
	    contract = 'Raincoat';
            items = ['Sword','Armor','Fists_of_Goo','Battery_Stick','Pants'];
            level = [4,3,2,2,4];
            ABlevelswitch(3);
	}

	if (autoBattle.items.Raincoat.owned) {
            items = ['Rusty_Dagger','Fists_of_Goo','Battery_Stick','Pants','Raincoat'];
            level = [3,2,3,4,3];
            ABlevelswitch(4);
	}

	break;

	case 5:

        ABlevelswitch(5);

        if (!autoBattle.items.Putrid_Pouch.owned) {
            items = ['Rusty_Dagger','Fists_of_Goo','Battery_Stick','Pants','Raincoat'];
            level = [3,3,3,4,3];
            var proceed = true;
            for (var equip in autoBattle.items) {
                if (abOwnedLevel(equip) < level[items.indexOf(equip)]) {
		    proceed = false;
		}
            }
	    if (proceed) {
		if (!autoBattle.items.Putrid_Pouch.owned) {
	            contract = 'Putrid_Pouch';
	        }
	    }
        }
	if (autoBattle.items.Putrid_Pouch.owned) {
            items = ['Rusty_Dagger','Fists_of_Goo','Battery_Stick','Raincoat','Putrid_Pouch'];
            level = [3,3,3,3,3];
            var proceed2 = true;
            for (var equip in autoBattle.items) {
                if (abOwnedLevel(equip) < level[items.indexOf(equip)]) {
		    proceed2 = false;
		}
            }
	    if (proceed2) {
		if (!autoBattle.items.Chemistry_Set.owned) {
	            contract = 'Chemistry_Set';
	        }
	    }
	}
	if (autoBattle.items.Chemistry_Set.owned) {
            items = ['Menacing_Mask','Fists_of_Goo','Battery_Stick','Putrid_Pouch','Chemistry_Set'];
            level = [4,3,3,3,2];
	}

	break;

        case 6:

        ABlevelswitch(6);

        if (!autoBattle.items.Labcoat.owned) {
            items = ['Menacing_Mask','Fists_of_Goo','Battery_Stick','Putrid_Pouch','Chemistry_Set'];
            level = [4,3,3,3,2];
            var proceed = true;
            for (var equip in autoBattle.items) {
                if (abOwnedLevel(equip) < level[items.indexOf(equip)]) {
		    proceed = false;
		}
            }
	    if (proceed) {
		if (!autoBattle.items.Labcoat.owned) {
	            contract = 'Labcoat';
	        }
	    }
        }
        if (autoBattle.items.Labcoat.owned) {
            items = ['Fists_of_Goo','Battery_Stick','Putrid_Pouch','Chemistry_Set','Labcoat'];
            level = [3,4,3,2,1];
	}

        break;
        
	case 7:

        items = ['Fists_of_Goo','Battery_Stick','Putrid_Pouch','Chemistry_Set','Labcoat'];
        level = [3,4,3,4,2];
        ABlevelswitch(7);

	break;

        case 8:

        ABlevelswitch(8);

        if (!autoBattle.items.Comfy_Boots.owned) {
            items = ['Fists_of_Goo','Battery_Stick','Putrid_Pouch','Chemistry_Set','Labcoat'];
            level = [4,5,3,4,2];
            var proceed = true;
            for (var equip in autoBattle.items) {
                if (abOwnedLevel(equip) < level[items.indexOf(equip)]) {
		    proceed = false;
		}
            }
	    if (proceed) {
		if (!autoBattle.items.Comfy_Boots.owned) {
	            contract = 'Comfy_Boots';
	        }
	    }
        }
        if (autoBattle.items.Comfy_Boots.owned) {
            items = ['Fists_of_Goo','Battery_Stick','Putrid_Pouch','Chemistry_Set','Labcoat'];
            level = [4,5,3,4,2];
	    if (abOwnedLevel("Comfy_Boots") < 3) {
                abUpgradeOwned('Comfy_Boots');
	    }
	}

        break;

        case 9:
       
        if (!autoBattle.items.Comfy_Boots.owned) {
	    contract = 'Comfy_Boots';
	}

        if (abOwnedLevel("Comfy_Boots") < 3) {
            abUpgradeOwned('Comfy_Boots');
        }

        if (abOwnedLevel("Comfy_Boots") >= 3 && autoBattle.bonuses.Extra_Limbs.level < 2) {
            ABlevelswitch(8);
            items = ['Fists_of_Goo','Battery_Stick','Putrid_Pouch','Chemistry_Set','Labcoat'];
            level = [4,5,3,4,2];
            autoBattle.buyBonus('Extra_Limbs');
        }
        
        if (autoBattle.bonuses.Extra_Limbs.level >= 2 && abOwnedLevel("Rusty_Dagger") < 5) {
            ABlevelswitch(8);
            items = ['Rusty_Dagger','Fists_of_Goo','Battery_Stick','Putrid_Pouch','Chemistry_Set','Labcoat'];
            level = [5,4,4,3,4,2];
        }

	if (abOwnedLevel("Rusty_Dagger") >= 5) {
	    ABlevelswitch(9);
            items = ['Rusty_Dagger','Fists_of_Goo','Raincoat','Putrid_Pouch','Chemistry_Set','Labcoat'];
            level = [5,4,4,3,4,2];
	}

	break;

        case 10:

        if (!autoBattle.items.Mood_Bracelet.owned) {
	    contract = 'Mood_Bracelet';
            items = ['Rusty_Dagger','Fists_of_Goo','Raincoat','Putrid_Pouch','Chemistry_Set','Labcoat'];
            level = [5,4,4,4,4,2];
            ABlevelswitch(9);
	}
	if (autoBattle.items.Mood_Bracelet.owned && !autoBattle.items.Lifegiving_Gem.owned) {
            contract = 'Lifegiving_Gem';
            items = ['Rusty_Dagger','Fists_of_Goo','Raincoat','Putrid_Pouch','Chemistry_Set','Labcoat'];
            level = [5,4,4,4,4,2];
            ABlevelswitch(9);
	}
        if (autoBattle.items.Lifegiving_Gem.owned && !autoBattle.items.Hungering_Mold.owned) {
	    contract = 'Hungering_Mold';
            items = ['Rusty_Dagger','Fists_of_Goo','Raincoat','Putrid_Pouch','Chemistry_Set','Labcoat'];
            level = [5,4,4,4,4,2];
            ABlevelswitch(10);
	}
        if (autoBattle.items.Hungering_Mold.owned && abOwnedLevel("Hungering_Mold") < 2) {
            items = ['Rusty_Dagger','Fists_of_Goo','Raincoat','Putrid_Pouch','Chemistry_Set','Labcoat'];
            level = [5,4,4,4,4,2];
            ABlevelswitch(10);
	    if (abOwnedLevel("Putrid_Pouch") < 4) {
                abUpgradeOwned('Putrid_Pouch');
	    }
            else if (abOwnedLevel("Mood_Bracelet") < 3) {
                abUpgradeOwned('Mood_Bracelet');
	    }
            else if (abOwnedLevel("Hungering_Mold") < 2) {
                abUpgradeOwned('Hungering_Mold');
	    }
	}
	if (abOwnedLevel("Hungering_Mold") >= 2 && abOwnedLevel("Mood_Bracelet") >= 3 && abOwnedLevel("Putrid_Pouch") >= 4) {
	    contract = 'Bad_Medkit';
            items = ['Fists_of_Goo','Putrid_Pouch','Chemistry_Set','Labcoat','Mood_Bracelet','Hungering_Mold'];
            level = [4,4,4,2,3,2];
            ABlevelswitch(10);
            if (abOwnedLevel("Bad_Medkit") < 3) {
                abUpgradeOwned('Bad_Medkit');
	    }
	}

	break;
    }

    //Equip items
    
    // #77: the dirty-check used to ask "is every TARGET item equipped?" while the apply loop below
    // only equips items the player OWNS — so an unowned target (the level-7 list names Labcoat,
    // zone 90) could never become equipped, needsEquipChange stayed true on every subsequent tick,
    // and the block re-ran forever. Every autoBattle.equip() ends in resetCombat(true)
    // (objects.js:3585), which rebuilds both combatants and zeroes battleTime (objects.js:3200-3204)
    // — so the SA fight restarted from full enemy health every tick and never killed anything.
    //
    // Fix: ask instead "would applying the block below change the loadout?". The apply loop is
    // deterministic — it blanks the loadout, then equips, in `items` order, the entries the player
    // owns, and the game's equip() silently refuses past getMaxItems() (objects.js:3576). So the
    // loadout it converges on is exactly `desired` below. Comparing against that is a fixpoint test:
    // once applied, the next call is a no-op. The second half of the comparison (an equipped item
    // that is NOT desired) is what still lets the block REMOVE a now-unwanted item.
    var needsEquipChange = false;

    if (items.length > 0) {
        var desired: string[] = [];
        for (var item of items) {
            if (autoBattle.items[item].owned && desired.length < autoBattle.getMaxItems()) {
                desired.push(item);
            }
        }

        for (var owned in autoBattle.items) {
            if (autoBattle.items[owned].equipped !== (desired.indexOf(owned) !== -1)) {
                needsEquipChange = true;
            }
        }
    }

    if (needsEquipChange) {
        for (var item in autoBattle.items) {
            autoBattle.items[item].equipped = false;
        };

        for (var item of items) {
	    if (autoBattle.items[item].owned) autoBattle.equip(item);
        }
    }

    //Level items
    
    for (var equip in autoBattle.items) {
        if (abOwnedLevel(equip) < level[items.indexOf(equip)]) {
            abUpgradeOwned(equip);
        }
    }

    //Contract

    if (contract != '' && !autoBattle.items[contract].owned) {
	autoBattle.acceptContract(contract);
	if (autoBattle.activeContract == contract) {
	    if (game.global.world >= autoBattle.items[contract].zone) {
		contractVoid = true;
	    }
        }
    }
    
}
