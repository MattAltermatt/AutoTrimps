// TRUE-TS (Phase 1 · Wave 2, #29): faithful port of legacy/modules/magmite.js, now
// strict-typed. Game-coupled magmite/generator logic. Registers MODULES["magmite"] (ambient
// global). Native game fns (buyGeneratorUpgrade, buyPermanentGeneratorUpgrade,
// changeGeneratorState) typed ambient in src/game/trimps.d.ts and read by bare name (no
// imports → esbuild byte-identical to the @ts-nocheck original, the conversion gate).
// debug + getPageSetting imported from converted utils. No shared top-level vars.
//
// IDIOMATIC (Phase 2 · #51): un-minified behind the proof-net (tests/magmite.characterization.test.ts
//   pins every branch first; L0 backstop ∅ — the generator mutators aren't in the L0 recorder set and
//   the corpus is world<230, so magmite is L0-unreached, gated by the L1 spy-logs). var→const/let,
//   ==→=== where operands are provably the same runtime type (miRatio's number finals; generatorMode
//   is always numeric — config.js:212 inits it to 1). Kept LOOSE deliberately: every getPageSetting(...)
//   comparison (getPageSetting is polymorphic — boolean/string/number/int[]/undefined, see utils.ts)
//   and the SupplyWall falsy/`== 1` guards. Every numeric literal + formula shape preserved exactly
//   (balance is sacrosanct).
import { debug, getPageSetting } from './utils'

MODULES["magmite"] = {};
MODULES["magmite"].algorithm = 2;

const priceIncreases: Record<string, number> = {
    Efficiency: 8,
    Capacity: 32,
    Supply: 64,
    Overclocker: 32
};

export function calcMiSpent(upgrade: string) {
    const gen = game.generatorUpgrades[upgrade];
    if (gen.cost() <= gen.baseCost || gen.upgrades <= 0) return 0;
    return gen.upgrades * (gen.baseCost + (priceIncreases[upgrade] / 2) * (gen.upgrades - 1));
}

export function miRatio() {
    //Find Mi Ratio
    const eff = calcMiSpent('Efficiency');
    const cap = calcMiSpent('Capacity');
    const sup = calcMiSpent('Supply');
    const oc = calcMiSpent('Overclocker');

    const total = eff + cap + sup + oc;

    const effr = (eff > 0) ? (eff / total) * 100 : 1;
    const capr = (cap > 0) ? (cap / total) * 100 : 1;
    const supr = (sup > 0) ? (sup / total) * 100 : 1;
    const ocr = (oc > 0) ? (oc / total) * 100 : 1;

    //Find Player ratio
    const effspend = (getPageSetting('effratio') > 0) ? getPageSetting('effratio') : 0;
    const capspend = (getPageSetting('capratio') > 0) ? getPageSetting('capratio') : 0;
    const supspend = (getPageSetting('supratio') > 0) ? getPageSetting('supratio') : 0;
    const ocspend = (getPageSetting('ocratio') > 0) ? getPageSetting('ocratio') : 0;

    const totalspend = effspend + capspend + supspend + ocspend;

    const effspendr = (effspend > 0) ? (totalspend / effspend) * 100 : 0;
    const capspendr = (capspend > 0) ? (totalspend / capspend) * 100 : 0;
    const supspendr = (supspend > 0) ? (totalspend / supspend) * 100 : 0;
    const ocspendr = (ocspend > 0) ? (totalspend / ocspend) * 100 : 0;

    //Find Next Spend
    const efffinal = effspendr - effr;
    const capfinal = capspendr - capr;
    const supfinal = supspendr - supr;
    const ocfinal = ocspendr - ocr;

    const ratios = [];
    if (efffinal !== -1) ratios.push(efffinal);
    if (capfinal !== -1) ratios.push(capfinal);
    if (supfinal !== -1) ratios.push(supfinal);
    if (ocfinal !== -1) ratios.push(ocfinal);

    ratios.sort(function (a, b) { return b - a; });

    //Return Next Spend
    if (ratios[0] === efffinal) return "Efficiency";
    if (ratios[0] === capfinal) return "Capacity";
    if (ratios[0] === supfinal) return "Supply";
    if (ratios[0] === ocfinal) return "Overclocker";
}

export function autoMagmiteSpender() {
    if (getPageSetting('ratiospend') == true) {
        const tospend = miRatio();
        // #87/#15: miRatio() returns undefined when the player has configured NO ratio — and that is the
        // FACTORY DEFAULT. All four ratio settings default to -1 ("Use -1 or 0 to not spend on this"), so
        // every `*final` computes to exactly -1, the `!== -1` push guard never fires, `ratios` is empty,
        // and none of the four `ratios[0] === …` comparisons match. The old code then did
        // `game.generatorUpgrades[undefined].cost()` → TypeError.
        //
        // That throw is dispatched near the TOP of mainLoop's U1 block (AutoTrimps2.js:200), and mainLoop
        // has no try/catch (#87) — so ticking "Ratio Spending" on a fresh install killed buildings, jobs,
        // portal, combat, stance, spire and golden upgrades, EVERY TICK, until reload. Gathering survived
        // (it is dispatched earlier), so the player just watched resources pile up against the cap with
        // every toggle still showing ON.
        //
        // The repair is at the CALLER, deliberately: "no ratio configured" means "spend on nothing", which
        // is exactly what -1 and 0 are documented to mean. Inventing a fallback pick inside miRatio() would
        // be choosing which upgrade to buy for a player who chose none — a balance decision, not a fix.
        if (!tospend) return;
        const upgrader = game.generatorUpgrades[tospend];
        if (game.global.magmite >= upgrader.cost()) {
            debug("Auto Spending " + upgrader.cost() + " Magmite on: " + tospend + " #" + (game.generatorUpgrades[tospend].upgrades + 1), "magmite");
            buyGeneratorUpgrade(tospend);
        }
    } else {
        let didSpend = false;
        try {
            const permanames = ["Slowburn", "Shielding", "Storage", "Hybridization", "Supervision", "Simulacrum"];
            for (const item of permanames) {
                const upgrade = game.permanentGeneratorUpgrades[item];
                if (typeof upgrade === 'undefined') return;
                if (upgrade.owned) continue;
                const cost = upgrade.cost;
                if (game.global.magmite >= cost) {
                    buyPermanentGeneratorUpgrade(item);
                    debug("Auto Spending " + cost + " Magmite on: " + item, "magmite");
                    didSpend = true;
                }
            }

            const hasOv = game.permanentGeneratorUpgrades.Hybridization.owned && game.permanentGeneratorUpgrades.Storage.owned;
            const ovclock = game.generatorUpgrades.Overclocker;
            if (
                hasOv &&
                ((getPageSetting('spendmagmitesetting') == 0 || getPageSetting('spendmagmitesetting') == 3) || !ovclock.upgrades) &&
                (game.global.magmite >= ovclock.cost())
            ) {
                debug("Auto Spending " + ovclock.cost() + " Magmite on: Overclocker" + (ovclock.upgrades ? " #" + (ovclock.upgrades + 1) : ""), "magmite");
                buyGeneratorUpgrade('Overclocker');
            }

            let repeat = (getPageSetting('spendmagmitesetting') == 0 || getPageSetting('spendmagmitesetting') == 1);
            while (repeat) {
                if (MODULES["magmite"].algorithm === 2) {
                    const eff = game.generatorUpgrades["Efficiency"];
                    const cap = game.generatorUpgrades["Capacity"];
                    const sup = game.generatorUpgrades["Supply"];
                    if ((typeof eff === 'undefined') || (typeof cap === 'undefined') || (typeof sup === 'undefined')) return;

                    const EffObj: any = {};
                    EffObj.name = "Efficiency";
                    EffObj.lvl = eff.upgrades + 1;
                    EffObj.cost = eff.cost();
                    EffObj.benefit = EffObj.lvl * 0.1;
                    EffObj.effInc = (((1 + EffObj.benefit) / (1 + ((EffObj.lvl - 1) * 0.1)) - 1) * 100);
                    EffObj.miCostPerPct = EffObj.cost / EffObj.effInc;

                    const CapObj: any = {};
                    CapObj.name = "Capacity";
                    CapObj.lvl = cap.upgrades + 1;
                    CapObj.cost = cap.cost();
                    CapObj.totalCap = 3 + (0.4 * CapObj.lvl);
                    CapObj.benefit = Math.sqrt(CapObj.totalCap);
                    CapObj.effInc = ((CapObj.benefit / Math.sqrt(3 + (0.4 * (CapObj.lvl - 1))) - 1) * 100);
                    CapObj.miCostPerPct = CapObj.cost / CapObj.effInc;

                    let item: string;
                    if (EffObj.miCostPerPct <= CapObj.miCostPerPct) {
                        item = EffObj.name;
                    } else {
                        const supCost = sup.cost();
                        const wall = getPageSetting('SupplyWall');
                        if (!wall)
                            item = (CapObj.cost <= supCost) ? CapObj.name : "Supply";
                        else if (wall == 1)
                            item = "Capacity";
                        else if (wall < 0)
                            item = (supCost <= (CapObj.cost * -wall)) ? "Supply" : "Capacity";
                        else
                            item = (CapObj.cost <= (supCost * wall)) ? "Capacity" : "Supply";
                    }

                    const upgrade = game.generatorUpgrades[item];
                    if (game.global.magmite >= upgrade.cost()) {
                        debug("Auto Spending " + upgrade.cost() + " Magmite on: " + item + " #" + (game.generatorUpgrades[item].upgrades + 1), "magmite");
                        buyGeneratorUpgrade(item);
                        didSpend = true;
                    } else {
                        repeat = false;
                    }
                }
            }
        } catch (err: any) {
            debug("AutoSpendMagmite Error encountered: " + err.message, "magmite");
        }
        if (didSpend) debug("Leftover magmite: " + game.global.magmite, "magmite");
    }
}

export function autoGenerator() {
    let defaultgenstate = getPageSetting('defaultgen');
    let beforefuelstate = getPageSetting('beforegen');
    const hybrid = game.permanentGeneratorUpgrades.Hybridization.owned;
    if (!hybrid && defaultgenstate == 2) {
        defaultgenstate = 0;
    }
    if (!hybrid && beforefuelstate == 2) {
        beforefuelstate = 0;
    }
    if (game.global.world < 230) return;
    if (game.global.dailyChallenge.seed && getPageSetting('AutoGenDC') == 1 && game.global.generatorMode !== 1)
        changeGeneratorState(1);
    if (game.global.dailyChallenge.seed && getPageSetting('AutoGenDC') == 1 && game.global.generatorMode === 1)
        return;
    if (hybrid && game.global.dailyChallenge.seed && getPageSetting('AutoGenDC') == 2 && game.global.generatorMode !== 2)
        changeGeneratorState(2);
    if (game.global.dailyChallenge.seed && getPageSetting('AutoGenDC') == 2 && game.global.generatorMode === 2)
        return;
    if (game.global.runningChallengeSquared && getPageSetting('AutoGenC2') == 1 && game.global.generatorMode !== 1)
        changeGeneratorState(1);
    if (game.global.runningChallengeSquared && getPageSetting('AutoGenC2') == 1 && game.global.generatorMode === 1)
        return;
    if (hybrid && game.global.runningChallengeSquared && getPageSetting('AutoGenC2') == 2 && game.global.generatorMode !== 2)
        changeGeneratorState(2);
    if (game.global.runningChallengeSquared && getPageSetting('AutoGenC2') == 2 && game.global.generatorMode === 2)
        return;
    if (getPageSetting('fuellater') < 1 && game.global.generatorMode != beforefuelstate)
        changeGeneratorState(beforefuelstate);
    if (getPageSetting('fuellater') < 1 && game.global.generatorMode == beforefuelstate)
        return;
    if (getPageSetting('fuellater') >= 1 && game.global.world < getPageSetting('fuellater') && game.global.generatorMode != beforefuelstate)
        changeGeneratorState(beforefuelstate);
    if (getPageSetting('fuellater') >= 1 && game.global.world < getPageSetting('fuellater') && game.global.generatorMode == beforefuelstate)
        return;
    if (getPageSetting('fuellater') >= 1 && game.global.world >= getPageSetting('fuellater') && game.global.world < getPageSetting('fuelend') && game.global.generatorMode !== 1)
        changeGeneratorState(1);
    if (getPageSetting('fuellater') >= 1 && game.global.world >= getPageSetting('fuellater') && game.global.world < getPageSetting('fuelend') && game.global.generatorMode === 1)
        return;
    if (getPageSetting('fuelend') < 1 && game.global.world >= getPageSetting('fuellater') && game.global.generatorMode !== 1)
        changeGeneratorState(1);
    if (getPageSetting('fuelend') < 1 && game.global.world >= getPageSetting('fuellater') && game.global.generatorMode === 1)
        return;
    if (getPageSetting('fuelend') >= 1 && game.global.world >= getPageSetting('fuelend') && game.global.generatorMode != defaultgenstate)
        changeGeneratorState(defaultgenstate);
    if (getPageSetting('fuelend') >= 1 && game.global.world >= getPageSetting('fuelend') && game.global.generatorMode == defaultgenstate)
        return;
}
