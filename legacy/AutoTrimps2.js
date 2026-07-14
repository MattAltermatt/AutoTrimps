var ATversion = (typeof __AT_BUILD_VERSION__ !== 'undefined' ? 'v' + __AT_BUILD_VERSION__ : 'Zek v5.1.0'),
    atscript = document.getElementById('AutoTrimps-script'),
    basepath = 'https://Zorn192.github.io/AutoTrimps/', //Link to your own Github here if you forked!
    modulepath = 'modules/';
null !== atscript && (basepath = atscript.src.replace(/AutoTrimps2\.js$/, ''));

function ATscriptLoad(pathname, modulename) {
    if (modulename == null) debug("Wrong Syntax. Script could not be loaded. Try ATscriptLoad(modulepath, 'example.js'); ");
    var script = document.createElement('script');
    if (pathname == null) pathname = '';
    script.src = basepath + pathname + modulename + '.js';
    script.id = modulename + '_MODULE';
    document.head.appendChild(script);
}

function ATscriptUnload(a) {
    var b = document.getElementById(a + "_MODULE");
    b && (document.head.removeChild(b), debug("Removing " + a + "_MODULE", "other"))
}
ATscriptLoad(modulepath, 'utils');

function initializeAutoTrimps() {
    loadPageVariables();
    ATscriptLoad('', 'SettingsGUI');
    var script = document.createElement('script');
    script.src = 'https://Quiaaaa.github.io/AutoTrimps/Graphs.js';
    document.head.appendChild(script);
    ATmoduleList = ['import-export', 'query', 'calc', 'portal', 'upgrades', 'heirlooms', 'buildings', 'jobs', 'equipment', 'gather', 'stance', 'mapfunctions', 'maps', 'breedtimer', 'dynprestige', 'fight', 'scryer', 'magmite', 'nature', 'other', 'perks', 'fight-info', 'performance', 'ab', 'MAZ'];
    for (var m in ATmoduleList) {
        ATscriptLoad(modulepath, ATmoduleList[m]);
    }
    debug('AutoTrimps - Zek Fork Loaded!', '*spinner3');
}

var changelogList = [];
changelogList.push({
    date: "11/02/2023",
    version: "v5.2.0",
    description: "<b>Trimps v5.9.0</b> Added Frigid to calc. Added Desolation AutoDeso. Added mutations to calc. ",
    isNew: true
});
changelogList.push({
    date: "13/11/2022",
    version: "v5.2.1",
    description: "<b>Trimps v5.8.0</b> Added Smithy farming. Changed Scryer stuff. U1 Calc slightly more accurate. Changed some colours and setting descriptions like AutoHeirlooms. Let me know if something is broken. ",
    isNew: false
});
changelogList.push({
    date: "28/10/2022",
    version: "v5.2.0",
    description: "<b>Trimps v5.8.0</b> Changed U2 Automaps so there might be problems, let me know if there is. Autogiga, Better stance swap, U1 Calc fixed. ",
    isNew: false
});

function assembleChangelog(a, b, c, d) {
    return d ? `<b class="AutoEggs">${a} ${b} </b><b style="background-color:#32CD32"> New:</b> ${c}<br>` : `<b>${a} ${b} </b> ${c}<br>`
}

function printChangelog() {
    var body = "";
    for (var i in changelogList) {
        var $item = changelogList[i];
        var result = assembleChangelog($item.date, $item.version, $item.description, $item.isNew);
        body += result;
    }
    var footer =
        '<b>ZӘK Fork</b> - <u>Report any bugs/problems please</u>!\
        <br>Talk with the dev: <b>Zek#0647</b> @ <a target="#" href="https://discord.gg/Ztcnfjr">Zeks Discord Channel</a>\
        <br>Talk with the other Trimpers: <a target="Trimps" href="https://discord.gg/trimps">Trimps Discord Channel</a>\
        <br>See <a target="#" href="https://github.com/Zorn192/AutoTrimps/blob/gh-pages/README.md">ReadMe</a> Or check <a target="#" href="https://github.com/Zorn192/AutoTrimps/commits/gh-pages" target="#">the commit history</a> (if you want).',
        action = 'cancelTooltip()',
        title = 'Script Update Notice<br>' + ATversion,
        acceptBtnText = "Thank you for playing AutoTrimps. Accept and Continue.",
        hideCancel = true;
    tooltip('confirm', null, 'update', body + footer, action, title, acceptBtnText, null, hideCancel);
}

var runInterval = 100;
var startupDelay = 4000;

setTimeout(delayStart, startupDelay);

function delayStart() {
    initializeAutoTrimps();
    printChangelog();
    setTimeout(delayStartAgain, startupDelay);
}

function delayStartAgain() {
    game.global.addonUser = true;
    game.global.autotrimps = true;
    MODULESdefault = JSON.parse(JSON.stringify(MODULES));
    setInterval(mainLoop, runInterval);
    setInterval(guiLoop, runInterval * 10);
}

var ATrunning = true;
var ATmessageLogTabVisible = true;
var enableDebug = true;

var autoTrimpSettings = {};
var MODULES = {};
var MODULESdefault = {};
var ATMODULES = {};
var ATmoduleList = [];

var bestBuilding;
var scienceNeeded;
var RscienceNeeded;
var breedFire = false;

var shouldFarm = false;
var RshouldFarm = false;
var enoughDamage = true;
var RenoughDamage = true;
var enoughHealth = true;
var RenoughHealth = true;

var baseDamage = 0;
var baseBlock = 0;
var baseHealth = 0;

var preBuyAmt;
var preBuyFiring;
var preBuyTooltip;
var preBuymaxSplit;

var currentworld = 0;
var lastrunworld = 0;
var aWholeNewWorld = false;
var heirloomFlag = false;
var heirloomCache = game.global.heirloomsExtra.length;
var magmiteSpenderChanged = false;
var lastHeliumZone = 0;
var lastRadonZone = 0;

//Get Gamma burst % value
gammaBurstPct = (getHeirloomBonus("Shield", "gammaBurst") / 100) > 0 ? (getHeirloomBonus("Shield", "gammaBurst") / 100) : 1;
shieldEquipped = game.global.ShieldEquipped.id;

// #87 — EVERY DISPATCH BELOW IS WRAPPED IN atGuard(name, fn). See src/modules/guard.ts for the
// contract. In short: this loop used to contain not one try/catch, so a throw in any one automation
// skipped every automation ordered after it — again on the next tick, and every tick after, forever.
// The guard CONTAINS; it does not recover. A caught error is reported once (message log + console),
// then counted silently. The wrapped statement is otherwise the same statement it always was: when
// nothing throws, atGuard(n, fn) is exactly fn(), which is why this change moves ZERO L0 traces.
//
// The guard closure deliberately encloses the CONDITION as well as the call — `calcHDratio()`,
// `getCurrentMapObject().location` and `document.getElementById('Prestige').value` are all inside
// `if (...)` guards and are all entirely capable of throwing. A boundary that only wrapped the callee
// would leave the tick just as fragile.
//
// A guard NAME is the throttle key and the label the player sees, so it identifies the SITE, not the
// function: buyWeps() fires from three different U1 sites and knowing which one is failing is the point.
// tests/nets/mainloop-guarded.test.ts asserts mechanically that no unguarded call survives here — add
// automation #61 without a guard and it fails on arrival.
function mainLoop() {
    if (ATrunning == false) return;
    if (getPageSetting('PauseScript') || game.options.menu.pauseGame.enabled || game.global.viewingUpgrades) return;
    ATrunning = true;
    atGuard('breedTimer', function () {
        if (getPageSetting('showbreedtimer') == true) {
            if (game.options.menu.showFullBreed.enabled != 1) toggleSetting("showFullBreed");
            addbreedTimerInsideText.innerHTML = ((game.jobs.Amalgamator.owned > 0) ? Math.floor((new Date().getTime() - game.global.lastSoldierSentAt) / 1000) : Math.floor(game.global.lastBreedTime / 1000)) + 's'; //add breed time for next army;
            addToolTipToArmyCount();
        }
    });
    atGuard('mainCleanup', function () {
        if (mainCleanup() || portalWindowOpen || (!heirloomsShown && heirloomFlag) || (heirloomCache != game.global.heirloomsExtra.length)) {
            heirloomCache = game.global.heirloomsExtra.length;
        }
        heirloomFlag = heirloomsShown;
    });
    atGuard('newZone', function () {
        if (aWholeNewWorld) {
            switch (document.getElementById('tipTitle').innerHTML) {
                case 'The Improbability':
                case 'Corruption':
                case 'Spire':
                case 'The Magma':
                    cancelTooltip();
            }
            if (getPageSetting('AutoEggs'))
                easterEggClicked();
            setTitle();
        }
    });
    if (game.global.world != autoTrimpSettings.zonetracker) {
        autoTrimpSettings.zonetracker = game.global.world;
    }

    //Universal Logic
    atGuard('autoBoneChargeWhenMax', function () {
        if (getPageSetting('AutoBoneChargeMax') != 0) autoBoneChargeWhenMax();
    });

    //Logic for Universe 1
    if (game.global.universe == 1) {

        //Offline Progress
        if (!usingRealTimeOffline) {
            atGuard('setScienceNeeded', setScienceNeeded);
            atGuard('autoLevelEquipment', autoLevelEquipment);
        }

        //Heirloom Shield Swap Check
        atGuard('HeirloomShieldSwapped', function () {
            if (shieldEquipped !== game.global.ShieldEquipped.id) HeirloomShieldSwapped();
        });

        //Core
        atGuard('autoMap', function () {
            if (getPageSetting('AutoMaps') > 0 && game.global.mapsUnlocked) autoMap();
        });
        atGuard('automapsalways', function () {
            if (getPageSetting('automapsalways') == true && autoTrimpSettings.AutoMaps.value != 1) autoTrimpSettings.AutoMaps.value = 1;
        });
        atGuard('updateAutoMapsStatus', function () {
            if (getPageSetting('showautomapstatus') == true) updateAutoMapsStatus();
        });
        // #64: 3 = "Science Research OFF" runs the same gather brain as 1 = "Auto Gather/Build";
        // manualLabor2's own `!= 3` guards suppress the science branches. It used to dispatch
        // nothing, so the option silently froze playerGathering wherever it was.
        atGuard('manualLabor2', function () {
            if (getPageSetting('ManualGather2') == 1 || getPageSetting('ManualGather2') == 3) manualLabor2();
        });
        atGuard('toggleAutoTrap', function () {
            if (getPageSetting('TrapTrimps') && game.global.trapBuildAllowed && game.global.trapBuildToggled == false) toggleAutoTrap();
        });
        atGuard('autogather3', function () {
            if (getPageSetting('ManualGather2') == 2) autogather3();
        });
        atGuard('ATGA2', function () {
            if (getPageSetting('ATGA2') == true) ATGA2();
        });
        atGuard('autoRoboTrimp', function () {
            if (aWholeNewWorld && getPageSetting('AutoRoboTrimp')) autoRoboTrimp();
        });
        atGuard('buyheliumy', function () {
            if (game.global.challengeActive == "Daily" && getPageSetting('buyheliumy') >= 1 && getDailyHeliumValue(countDailyWeight()) >= getPageSetting('buyheliumy') && game.global.b >= 100 && !game.singleRunBonuses.heliumy.owned) purchaseSingleRunBonus('heliumy');
        });
        atGuard('finishChallengeSquared', function () {
            if (aWholeNewWorld && getPageSetting('FinishC2') > 0 && game.global.runningChallengeSquared) finishChallengeSquared();
        });
        atGuard('autoMagmiteSpender', function () {
            if (getPageSetting('spendmagmite') == 2 && !magmiteSpenderChanged) autoMagmiteSpender();
        });
        atGuard('autoNatureTokens', function () {
            if (getPageSetting('AutoNatureTokens') && game.global.world > 229) autoNatureTokens();
        });
        atGuard('autoEnlight', function () {
            if (getPageSetting('autoenlight') && game.global.world > 229 && game.global.uberNature == false) autoEnlight();
        });
        atGuard('buyUpgrades', function () {
            if (getPageSetting('BuyUpgradesNew') != 0) buyUpgrades();
        });
        atGuard('autoshrine', function () {
            if ((getPageSetting('Hshrine') == true) || (getPageSetting('Hdshrine') == 1) || (getPageSetting('Hdshrine') == 2)) autoshrine();
        });

        //Buildings
        // #81: the `== 3` ("Buy Storage") arm used to sit OUTSIDE this block — the `}` closed the
        // `if (!usingRealTimeOffline)`, making `else if (... == 3)` the OUTER else, so its guard was
        // usingRealTimeOffline === TRUE. That flag is set only while the game replays offline progress
        // right after a load, so option 3 ran during the replay and NEVER in live play: a player who
        // picked "Buy Storage" got no buildings and no storage for the whole session. The two halves
        // were exactly inverted. Every option now dispatches inside the live-play block.
        if (!usingRealTimeOffline) {
            // #87: the arms are nested guards, not one. buyBuildings() throwing must not cost you
            // buyStorage() — they are independent automations that happen to share a multitoggle.
            atGuard('buildings', function () {
                if (getPageSetting('BuyBuildingsNew') === 0 && getPageSetting('hidebuildings') == true) atGuard('buyBuildings', buyBuildings);
                else if (getPageSetting('BuyBuildingsNew') == 1) {
                    atGuard('buyBuildings', buyBuildings);
                    atGuard('buyStorage', buyStorage);
                } else if (getPageSetting('BuyBuildingsNew') == 2) atGuard('buyBuildings', buyBuildings);
                else if (getPageSetting('BuyBuildingsNew') == 3) atGuard('buyStorage', buyStorage);
            });
        }
        atGuard('autoGenerator', function () {
            if (getPageSetting('UseAutoGen') == true && game.global.world > 229) autoGenerator();
        });

        //Jobs
        atGuard('jobs', function () {
            if (getPageSetting('BuyJobsNew') == 1) {
                atGuard('workerRatios', workerRatios);
                atGuard('buyJobs', buyJobs);
            } else if (getPageSetting('BuyJobsNew') == 2) atGuard('buyJobs', buyJobs);
        });

        //Portal
        atGuard('autoPortal', function () {
            if (autoTrimpSettings.AutoPortal.selected != "Off" && game.global.challengeActive != "Daily" && !game.global.runningChallengeSquared) autoPortal();
        });
        atGuard('dailyAutoPortal', function () {
            if (getPageSetting('AutoPortalDaily') > 0 && game.global.challengeActive == "Daily") dailyAutoPortal();
        });
        atGuard('c2runnerportal', function () {
            if (getPageSetting('c2runnerstart') == true && getPageSetting('c2runnerportal') > 0 && game.global.runningChallengeSquared && game.global.world > getPageSetting('c2runnerportal')) c2runnerportal();
        });

        //Combat
        // #68: the `|| getPageSetting('fuckanti') > 0` disjunct is DELETED, not repaired. 'fuckanti' is
        // an upstream-deleted setting (still carried in the frozen serializeSettings blobs, hence
        // NOT re-mintable — minting resurrects a stored value); getPageSetting returns false for it, so
        // `false > 0` was always false and the disjunct could never contribute. Removing it is exactly
        // behaviour-preserving, and it takes the resurrection hazard with it.
        atGuard('trimpcide', function () {
            if (getPageSetting('ForceAbandon') == true) trimpcide();
        });
        atGuard('helptrimpsnotdie', function () {
            if (getPageSetting('trimpsnotdie') == true && game.global.world > 1) helptrimpsnotdie();
        });
        atGuard('fightalways', function () {
            if (!game.global.fighting) {
                if (getPageSetting('fightforever') == 0) fightalways();
                else if (getPageSetting('fightforever') > 0 && calcHDratio() <= getPageSetting('fightforever')) fightalways();
                else if (getPageSetting('cfightforever') == true && (challengeActive("Electricty") || challengeActive("Toxicity") || challengeActive("Nom"))) fightalways();
                else if (getPageSetting('dfightforever') == 1 && game.global.challengeActive == "Daily" && typeof game.global.dailyChallenge.empower == 'undefined' && typeof game.global.dailyChallenge.bloodthirst == 'undefined' && (typeof game.global.dailyChallenge.bogged !== 'undefined' || typeof game.global.dailyChallenge.plague !== 'undefined' || typeof game.global.dailyChallenge.pressure !== 'undefined')) fightalways();
                else if (getPageSetting('dfightforever') == 2 && game.global.challengeActive == "Daily" && (typeof game.global.dailyChallenge.bogged !== 'undefined' || typeof game.global.dailyChallenge.plague !== 'undefined' || typeof game.global.dailyChallenge.pressure !== 'undefined')) fightalways();
            }
        });
        atGuard('betterAutoFight', function () {
            if (getPageSetting('BetterAutoFight') == 1) betterAutoFight();
        });
        atGuard('betterAutoFight3', function () {
            if (getPageSetting('BetterAutoFight') == 2) betterAutoFight3();
        });
        // forcePrecZ is consumed only by the prestige dispatch on the next line, so it lives inside the
        // guard with it. Note the `else` arm reads document.getElementById('Prestige').value — a DOM read
        // that throws outright if the select is not mounted, which is precisely a mainLoop-killer.
        atGuard('prestigeChanging2', function () {
            var forcePrecZ = (getPageSetting('ForcePresZ') < 0) || (game.global.world < getPageSetting('ForcePresZ'));
            if (getPageSetting('DynamicPrestige2') > 0 && forcePrecZ) prestigeChanging2();
            else autoTrimpSettings.Prestige.selected = document.getElementById('Prestige').value;
        });
        atGuard('avoidempower', function () {
            if (game.global.world > 5 && game.global.challengeActive == "Daily" && getPageSetting('avoidempower') == true && typeof game.global.dailyChallenge.empower !== 'undefined' && !game.global.preMapsActive && !game.global.mapsActive && game.global.soldierHealth > 0) avoidempower();
        });
        atGuard('buyWeps:void', function () {
            if (getPageSetting('buywepsvoid') == true && ((getPageSetting('VoidMaps') == game.global.world && game.global.challengeActive != "Daily") || (getPageSetting('DailyVoidMod') == game.global.world && game.global.challengeActive == "Daily")) && game.global.mapsActive && getCurrentMapObject().location == "Void") buyWeps();
        });
        atGuard('armormagic', function () {
            if ((getPageSetting('darmormagic') > 0 && typeof game.global.dailyChallenge.empower == 'undefined' && typeof game.global.dailyChallenge.bloodthirst == 'undefined' && (typeof game.global.dailyChallenge.bogged !== 'undefined' || typeof game.global.dailyChallenge.plague !== 'undefined' || typeof game.global.dailyChallenge.pressure !== 'undefined')) || (getPageSetting('carmormagic') > 0 && (challengeActive("Toxicity") || challengeActive("Nom")))) armormagic();
        });

        //Stance
        atGuard('stance', function () {
            if ((getPageSetting('UseScryerStance') == true) || (getPageSetting('scryvoidmaps') == true && game.global.challengeActive != "Daily") || (getPageSetting('dscryvoidmaps') == true && game.global.challengeActive == "Daily")) useScryerStance();
            else if ((getPageSetting('AutoStance') == 3) || (getPageSetting('use3daily') == true && game.global.challengeActive == "Daily")) windStance();
            else if (getPageSetting('AutoStance') == 1) autoStance();
            else if (getPageSetting('AutoStance') == 2) autoStance2();
        });

        //Spire
        atGuard('exitSpireCell', function () {
            if (getPageSetting('ExitSpireCell') > 0 && game.global.challengeActive != "Daily" && getPageSetting('IgnoreSpiresUntil') <= game.global.world && game.global.spireActive) exitSpireCell();
        });
        atGuard('dailyexitSpireCell', function () {
            if (getPageSetting('dExitSpireCell') >= 1 && game.global.challengeActive == "Daily" && getPageSetting('dIgnoreSpiresUntil') <= game.global.world && game.global.spireActive) dailyexitSpireCell();
        });
        atGuard('ATspirebreed', function () {
            if (getPageSetting('SpireBreedTimer') > 0 && getPageSetting('IgnoreSpiresUntil') <= game.global.world) ATspirebreed();
        });
        atGuard('buyshitspire', function () {
            if (getPageSetting('spireshitbuy') == true && (isActiveSpireAT() || disActiveSpireAT())) buyshitspire();
        });

        //Raiding
        atGuard('praiding', function () {
            if ((getPageSetting('PraidHarder') == true && getPageSetting('Praidingzone').length > 0 && game.global.challengeActive != "Daily") || (getPageSetting('dPraidHarder') == true && getPageSetting('dPraidingzone').length > 0 && game.global.challengeActive == "Daily")) PraidHarder();
            else {
                atGuard('Praiding', function () {
                    if (getPageSetting('Praidingzone').length && game.global.challengeActive != "Daily") Praiding();
                });
                atGuard('dailyPraiding', function () {
                    if (getPageSetting('dPraidingzone').length && game.global.challengeActive == "Daily") dailyPraiding();
                });
            }
        });
        atGuard('BWraiding', function () {
            if (((getPageSetting('BWraid') && game.global.challengeActive != "Daily") || (getPageSetting('Dailybwraid') && game.global.challengeActive == "Daily"))) {
                BWraiding();
            }
        });
        // #68: 'DailyBWraid' -> 'Dailybwraid'. A CASE typo, not a deleted setting: the live id is
        // lowercase-b, and the line directly above spells it correctly. getPageSetting('DailyBWraid')
        // returned false, so a Daily BW raid never bought weapons — buyWeps() only fired if the U1
        // 'BWraid' toggle happened to be on too.
        atGuard('buyWeps:bwraid', function () {
            if ((getPageSetting('BWraid') == true || getPageSetting('Dailybwraid') == true) && bwraidon) buyWeps();
        });
        // #68: the id argument here WAS the string "game.global.universe == 1 && BWraid" — an entire
        // expression pasted inside the quotes. No such setting exists, so getPageSetting returned false,
        // `false == true` was false, and this line NEVER ran. Restored to what the string plainly says.
        atGuard('buyWeps:bwraidMap', function () {
            if (game.global.mapsActive && game.global.universe == 1 && getPageSetting('BWraid') == true && game.global.world == getPageSetting('BWraidingz') && getCurrentMapObject().level <= getPageSetting('BWraidingmax')) buyWeps();
        });

        //Golden
        atGuard('autoGoldenUpgradesAT', function () {
            var agu = getPageSetting('AutoGoldenUpgrades');
            var dagu = getPageSetting('dAutoGoldenUpgrades');
            var cagu = getPageSetting('cAutoGoldenUpgrades');
            if (agu && agu != 'Off' && (!game.global.runningChallengeSquared && game.global.challengeActive != "Daily")) autoGoldenUpgradesAT(agu);
            if (dagu && dagu != 'Off' && game.global.challengeActive == "Daily") autoGoldenUpgradesAT(dagu);
            if (cagu && cagu != 'Off' && game.global.runningChallengeSquared) autoGoldenUpgradesAT(cagu);
        });
    }

    //Logic for Universe 2
    if (game.global.universe == 2) {

        //Offline Progress
        if (!usingRealTimeOffline) {
            atGuard('RsetScienceNeeded', RsetScienceNeeded);
        }

        //Heirloom Shield Swap Check
        atGuard('RHeirloomShieldSwapped', function () {
            if (shieldEquipped !== game.global.ShieldEquipped.id) HeirloomShieldSwapped();
        });

        atGuard('RbuyUpgrades', function () {
            if (!(game.global.challengeActive == "Quest" && game.global.world > 5 && game.global.lastClearedCell < 90 && ([14, 24].indexOf(questcheck()) >= 0))) {
                if (getPageSetting('RBuyUpgradesNew') != 0) RbuyUpgrades();
            }
        });

        //RCore
        atGuard('RautoMap', function () {
            if (getPageSetting('RAutoMaps') > 0 && game.global.mapsUnlocked) RautoMap();
        });
        atGuard('RupdateAutoMapsStatus', function () {
            if (getPageSetting('Rshowautomapstatus') == true) RupdateAutoMapsStatus();
        });
        atGuard('Rautomapsalways', function () {
            if (getPageSetting('Rautomapsalways') == true && autoTrimpSettings.RAutoMaps.value != 1) autoTrimpSettings.RAutoMaps.value = 1;
        });
        // #64: 2 = "Mining/Building Only" dispatched nothing, so the option froze playerGathering.
        // It routes to RmanualLabor2, NOT to U1's autogather3: RmanualLabor2 already carries the
        // `== 2` / `!= 2` guards implementing mining-mode (gather.ts:346/366/368), and autogather3
        // reads `gathermetal`, a setting settings-visibility.ts only exposes outside U2.
        atGuard('RmanualLabor2', function () {
            if (getPageSetting('RManualGather2') == 1 || getPageSetting('RManualGather2') == 2) RmanualLabor2();
        });
        atGuard('RtoggleAutoTrap', function () {
            if (getPageSetting('RTrapTrimps') && game.global.trapBuildAllowed && game.global.trapBuildToggled == false) toggleAutoTrap();
        });
        atGuard('buyradony', function () {
            if (game.global.challengeActive == "Daily" && getPageSetting('buyradony') >= 1 && getDailyHeliumValue(countDailyWeight()) >= getPageSetting('buyradony') && game.global.b >= 100 && !game.singleRunBonuses.heliumy.owned) purchaseSingleRunBonus('heliumy');
        });
        atGuard('Rautoshrine', function () {
            if ((getPageSetting('Rshrine') == true) || (getPageSetting('Rdshrine') == 1) || (getPageSetting('Rdshrine') == 2)) autoshrine();
        });

        //AB
        // #87 / #77: the AB block is the canonical instance of this issue. ABdustsimple() derefs
        // equips[0][1] with no minimum guard, so a U2 player with no SA item equipped (or an unsaved AB
        // preset) threw HERE — and everything from RbuyBuildings to RautoGoldenUpgradesAT below simply
        // stopped existing, every tick, forever. Each AB automation now gets its own boundary, and the
        // OUTER guard covers the condition itself (`highestRadLevel.valueTotal()` is a call too).
        atGuard('RAB', function () {
            if (game.stats.highestRadLevel.valueTotal() >= 75 && !autoBattle.sealed && getPageSetting('RAB') == true) {
                atGuard('ABswitch', function () {
                    if (getPageSetting('RABpreset') == true) ABswitch();
                });
                atGuard('ABdustsimple', function () {
                    if (getPageSetting('RABdustsimple') == 1) ABdustsimple();
                    else if (getPageSetting('RABdustsimple') == 2) ABdustsimplenonhid();
                });
                atGuard('ABfarmsave', function () {
                    if (getPageSetting('RABfarm') == true) ABfarmsave();
                });
                atGuard('ABfarmswitch', function () {
                    if (getPageSetting('RABfarmswitch') == true) ABfarmswitch();
                });
                atGuard('ABsolver', function () {
                    if (getPageSetting('RABsolve') == true) ABsolver();
                });
            }
        });

        //RBuildings
        atGuard('RbuyBuildings', function () {
            if (getPageSetting('RBuyBuildingsNew') == true) {
                RbuyBuildings();
            }
        });

        //RJobs
        atGuard('Rjobs', function () {
            if (!(game.global.challengeActive == "Quest" && game.global.world > 5) && getPageSetting('RBuyJobsNew') == 1) {
                atGuard('RworkerRatios', RworkerRatios);
                atGuard('RbuyJobs', RbuyJobs);
            } else if (!(game.global.challengeActive == "Quest" && game.global.world > 5) && getPageSetting('RBuyJobsNew') == 2) {
                atGuard('RbuyJobs', RbuyJobs);
            }
        });
        atGuard('RquestbuyJobs', function () {
            if (game.global.challengeActive == "Quest" && game.global.world > 5 && getPageSetting('RBuyJobsNew') > 0) {
                RquestbuyJobs();
            }
        });

        //RPortal
        atGuard('RautoPortal', function () {
            if (autoTrimpSettings.RAutoPortal.selected != "Off" && game.global.challengeActive != "Daily" && !game.global.runningChallengeSquared) RautoPortal();
        });
        atGuard('RdailyAutoPortal', function () {
            if (getPageSetting('RAutoPortalDaily') > 0 && game.global.challengeActive == "Daily") RdailyAutoPortal();
        });

        //RChallenges
        atGuard('archstring', function () {
            if (getPageSetting('Rarchon') == true && game.global.challengeActive == "Archaeology") {
                archstring();
            }
        });

        //RCombat
        atGuard('RautoEquip', function () {
            if (getPageSetting('Requipon') == true && (!(game.global.challengeActive == "Quest" && game.global.world > 5 && game.global.lastClearedCell < 90 && ([11, 12, 21, 22].indexOf(questcheck()) >= 0)))) RautoEquip();
        });
        atGuard('RbetterAutoFight', function () {
            if (getPageSetting('BetterAutoFight') == 1) betterAutoFight();
        });
        atGuard('RbetterAutoFight3', function () {
            if (getPageSetting('BetterAutoFight') == 2) betterAutoFight3();
        });
        atGuard('Ravoidempower', function () {
            if (game.global.world > 5 && game.global.challengeActive == "Daily" && getPageSetting('Ravoidempower') == true && typeof game.global.dailyChallenge.empower !== 'undefined' && !game.global.preMapsActive && !game.global.mapsActive && game.global.soldierHealth > 0) Ravoidempower();
        });
        atGuard('Rfightalways', function () {
            if (!game.global.fighting) {
                if (getPageSetting('Rfightforever') == 0) Rfightalways();
                else if (getPageSetting('Rfightforever') > 0 && RcalcHDratio() <= getPageSetting('Rfightforever')) Rfightalways();
                else if (getPageSetting('Rdfightforever') == 1 && game.global.challengeActive == "Daily" && typeof game.global.dailyChallenge.empower == 'undefined' && typeof game.global.dailyChallenge.bloodthirst == 'undefined' && (typeof game.global.dailyChallenge.bogged !== 'undefined' || typeof game.global.dailyChallenge.plague !== 'undefined' || typeof game.global.dailyChallenge.pressure !== 'undefined')) Rfightalways();
                else if (getPageSetting('Rdfightforever') == 2 && game.global.challengeActive == "Daily" && (typeof game.global.dailyChallenge.bogged !== 'undefined' || typeof game.global.dailyChallenge.plague !== 'undefined' || typeof game.global.dailyChallenge.pressure !== 'undefined')) Rfightalways();
            }
        });
        atGuard('Rarmormagic', function () {
            if ((getPageSetting('Rdarmormagic') > 0 && typeof game.global.dailyChallenge.empower == 'undefined' && typeof game.global.dailyChallenge.bloodthirst == 'undefined' && (typeof game.global.dailyChallenge.bogged !== 'undefined' || typeof game.global.dailyChallenge.plague !== 'undefined' || typeof game.global.dailyChallenge.pressure !== 'undefined')) || (getPageSetting('Rcarmormagic') > 0 && (game.global.challengeActive == 'Toxicity' || game.global.challengeActive == 'Nom'))) Rarmormagic();
        });
        atGuard('Rmanageequality', function () {
            if (getPageSetting('Rmanageequality') == true && game.global.fighting) Rmanageequality();
        });

        //RHeirlooms
        atGuard('Rheirloomswap', function () {
            if ((getPageSetting('Rhs') == true && game.global.challengeActive != 'Daily') || (getPageSetting('Rdhs') == 2 && game.global.challengeActive == 'Daily')) {
                Rheirloomswap();
            }
        });
        atGuard('Rdheirloomswap', function () {
            if (getPageSetting('Rdhs') == 1 && game.global.challengeActive == 'Daily') {
                Rdheirloomswap();
            }
        });

        //RGolden
        atGuard('RautoGoldenUpgradesAT', function () {
            var Ragu = getPageSetting('RAutoGoldenUpgrades');
            var Rdagu = getPageSetting('RdAutoGoldenUpgrades');
            var Rcagu = getPageSetting('RcAutoGoldenUpgrades');
            if (Ragu && Ragu != 'Off' && (!game.global.runningChallengeSquared && game.global.challengeActive != "Daily")) RautoGoldenUpgradesAT(Ragu);
            if (Rdagu && Rdagu != 'Off' && game.global.challengeActive == "Daily") RautoGoldenUpgradesAT(Rdagu);
            if (Rcagu && Rcagu != 'Off' && game.global.runningChallengeSquared) RautoGoldenUpgradesAT(Rcagu);
        });
    }
}

// #87: de-comma'd first, then guarded. As a single comma-expression this was all-or-nothing — a throw
// in updateCustomButtons() also cost you the storedMODULES persist, the enhanced grids and the AFK
// overlay, every 1000ms, forever. Four statements, four boundaries.
function guiLoop() {
    atGuard('updateCustomButtons', updateCustomButtons);
    atGuard('storedMODULES', function () {
        safeSetItems('storedMODULES', JSON.stringify(compareModuleVars()));
    });
    atGuard('fightinfo.Update', function () {
        if (getPageSetting('EnhanceGrids')) MODULES.fightinfo.Update();
    });
    atGuard('performance.UpdateAFKOverlay', function () {
        if ('undefined' != typeof MODULES && 'undefined' != typeof MODULES.performance && MODULES.performance.isAFK) MODULES.performance.UpdateAFKOverlay();
    });
}

function mainCleanup() {
    lastrunworld = currentworld;
    currentworld = game.global.world;
    aWholeNewWorld = lastrunworld != currentworld;
    if (game.global.universe == 1 && currentworld == 1 && aWholeNewWorld) {
        lastHeliumZone = 0;
        zonePostpone = 0;
        if (getPageSetting('automapsportal') == true && getPageSetting('AutoMaps') == 0 && !game.upgrades.Battle.done)
            autoTrimpSettings["AutoMaps"].value = 1;
        return true;
    }
    if (game.global.universe == 2 && currentworld == 1 && aWholeNewWorld) {
        lastRadonZone = 0;
        zonePostpone = 0;
        if (getPageSetting('Rautomapsportal') == true && getPageSetting('RAutoMaps') == 0 && !game.upgrades.Battle.done)
            autoTrimpSettings["RAutoMaps"].value = 1;
        return true;
    }
    autoTrimpSettings.zonetracker = 1;
}

if (document.getElementById('tooltipDiv').classList.contains('tooltipExtraLg') === false)
    document.getElementById('tooltipDiv').style.overflowY = '';
