// TRUE TS (Phase 1 · #31): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/SettingsGUI.js:1041-2045 — the reactive show/hide layer.
// updateCustomButtons runs EVERY TICK (AutoTrimps2.js mainLoop): kept byte-identical.
// turnOn/turnOff/toggleElem remain inner helpers exactly as in the original. Cross-module
// names (autoTrimpSettings, getPageSetting, game, MODULES, prettify, etc.) resolve at runtime
// via the global bridge / pre-existing globals. Exported so the bridge republishes them for
// the every-tick caller and the settings reset path (import-export.ts).

/**
 * #106 — the live "(32%)" suffix on the four Jobs allocation controls.
 *
 * WHY: the three worker-ratio boxes show numbers like `1.10 / 1.15 / 1.20`, which are meaningless in
 * isolation. They are UNNORMALISED WEIGHTS: `ratiobuy` (jobs.ts) computes
 * `floor((jobratio / totalRatio) * workers)`, so only the PROPORTIONS matter — 1.1/1.15/1.2 and
 * 110/115/120 are the same setting. Showing the normalised share is the whole fix for "I don't
 * understand the ratios", and it costs nothing: this is DOM text only, so it is trace-neutral (the L0
 * oracle records actions, not labels) and it mints/migrates nothing.
 *
 * Scientists are shown too, because the four numbers together are what actually determines where a
 * worker goes. Note the scientist share is taken from the SAME pool but is NOT part of `totalRatio`
 * (jobs.ts excludes Scientist from totalDistributableWorkers), so we render its share of the whole
 * allocation — i.e. the four printed percentages sum to 100, which is what a reader expects and what
 * the bot effectively does.
 *
 * Returns '' for every other setting, so the value-face path is otherwise untouched.
 */
export function jobRatioSuffix(id: string): string {
    // ⚠️ Every getPageSetting below is a QUOTED LITERAL, deliberately. tests/nets/settings-reverse.test.ts
    // proves that every id the code READS was actually createSetting'd, and it does so by grepping for
    // quoted literals — a dynamically-composed `getPageSetting('R' + x + 'Ratio')` is INVISIBLE to it and
    // has to be added to an allowlist instead. Given this whole feature exists because a hidden knob had
    // no setting, hiding its reads from the net that polices exactly that would be a poor joke. Two
    // explicit branches; no cleverness.
    let f: number, l: number, m: number, sPct: number;
    if (id === 'FarmerRatio' || id === 'LumberjackRatio' || id === 'MinerRatio' || id === 'ScientistPercent') {
        f = parseFloat(getPageSetting('FarmerRatio'));
        l = parseFloat(getPageSetting('LumberjackRatio'));
        m = parseFloat(getPageSetting('MinerRatio'));
        sPct = getPageSetting('ScientistPercent');
    } else if (id === 'RFarmerRatio' || id === 'RLumberjackRatio' || id === 'RMinerRatio' || id === 'RScientistPercent') {
        f = parseFloat(getPageSetting('RFarmerRatio'));
        l = parseFloat(getPageSetting('RLumberjackRatio'));
        m = parseFloat(getPageSetting('RMinerRatio'));
        sPct = getPageSetting('RScientistPercent');
    } else {
        return '';
    }

    const total = f + l + m;
    if (!Number.isFinite(total) || total <= 0) return '';

    // The scientist slice. -1 (Auto) means the built-in table is in charge, and that table depends on
    // farmer count and zone — so there is no single honest number to print. Say "(auto)" rather than
    // invent one.
    const sci = (Number.isFinite(sPct) && sPct >= 0) ? Math.min(sPct, 90) : NaN;
    if (id === 'ScientistPercent' || id === 'RScientistPercent') return Number.isNaN(sci) ? ' (auto)' : '';

    // Workers split whatever the scientists leave, so with a scientist share set the four printed numbers
    // sum to 100. On Auto we can only honestly show the workers' shares of each other.
    const workerShare = Number.isNaN(sci) ? 100 : (100 - sci);
    const own = (id === 'FarmerRatio' || id === 'RFarmerRatio') ? f
        : (id === 'LumberjackRatio' || id === 'RLumberjackRatio') ? l : m;
    return ' (' + ((own / total) * workerShare).toFixed(1) + '%)';
}

export function updateCustomButtons() {
	const isGraphModuleDefined = typeof MODULES.graphs !== 'undefined';
	const isLastThemeDefined = isGraphModuleDefined && typeof MODULES.graphs._lastTheme !== 'undefined';
	const hasThemeChanged = isLastThemeDefined && game.options.menu.darkTheme.enabled !== MODULES.graphs._lastTheme;

	if (isGraphModuleDefined && hasThemeChanged) {
		MODULES.graphs.themeChanged();
		MODULES.graphs._lastTheme = game.options.menu.darkTheme.enabled;
		debug("Theme change - AutoTrimps styles updated.");
	}

    function toggleElem(elem: any, showHide: any) {
        var $item = document.getElementById(elem);
        if ($item == null) return;
        var state = showHide ? '' : 'none';
        var stateParent = showHide ? 'inline-block' : 'none';
        $item.style.display = state;
        ($item as any).parentNode.style.display = stateParent;
    }

    function turnOff(elem: any) {
        toggleElem(elem, false);
    }

    function turnOn(elem: any) {
        toggleElem(elem, true);
    }

    //Hide settings

    //Radon
    var radonon = getPageSetting('radonsettings') == 1;
    //Bone Shrine
    var boneShrinePurchased = game.permaBoneBonuses.boosts.owned > 0 ? true : false;

    //Tabs
    if (document.getElementById("tabSpire") != null) {
        document.getElementById("tabSpire")!.style.display = radonon ? "none" : "";
    }
    if (document.getElementById("tabWindstacking") != null) {
        document.getElementById("tabWindstacking")!.style.display = radonon ? "none" : "";
    }
    if (document.getElementById("tabATGA") != null) {
        document.getElementById("tabATGA")!.style.display = radonon ? "none" : "";
    }
    if (document.getElementById("tabScryer") != null) {
        document.getElementById("tabScryer")!.style.display = radonon ? "none" : "";
    }
    if (document.getElementById("tabMagma") != null) {
        document.getElementById("tabMagma")!.style.display = radonon ? "none" : "";
    }
    if (document.getElementById("tabNature") != null) {
        document.getElementById("tabNature")!.style.display = radonon ? "none" : "";
    }
    if (document.getElementById("tabChallenges") != null) {
        document.getElementById("tabChallenges")!.style.display = !radonon ? "none" : "";
    }
    if (document.getElementById("tabSA") != null) {
        document.getElementById("tabSA")!.style.display = !radonon ? "none" : "";
    }



    //Core
    !radonon ? turnOn('ManualGather2') : turnOff("ManualGather2");
    !radonon ? turnOn('TrapTrimps') : turnOff("TrapTrimps");
    !radonon ? turnOn('BuyUpgradesNew') : turnOff("BuyUpgradesNew");
    (!radonon && getPageSetting('ManualGather2') == 2 && bwRewardUnlocked("Foremany")) ? turnOn("gathermetal") : turnOff("gathermetal");
    !radonon ? turnOn("amalcoord") : turnOff("amalcoord");
    !radonon && getPageSetting('amalcoord') == true ? turnOn("amalcoordt") : turnOff("amalcoordt");
    !radonon && getPageSetting('amalcoord') == true ? turnOn("amalcoordhd") : turnOff("amalcoordhd");
    !radonon && getPageSetting('amalcoord') == true ? turnOn("amalcoordz") : turnOff("amalcoordz");
    !radonon ? turnOn("AutoAllocatePerks") : turnOff("AutoAllocatePerks");
    !radonon && getPageSetting('AutoAllocatePerks') == 1 ? turnOn("fastallocate") : turnOff("fastallocate");
    boneShrinePurchased ? turnOn('AutoBoneChargeMax') : turnOff("AutoBoneChargeMax");
    boneShrinePurchased ? turnOn("AutoBoneChargeMaxStartZone") : turnOff("AutoBoneChargeMaxStartZone");

    //Portal
    !radonon ? turnOn("AutoPortal") : turnOff("AutoPortal");
    (!radonon && autoTrimpSettings.AutoPortal.selected == "Custom") ? turnOn("CustomAutoPortal") : turnOff("CustomAutoPortal");
    var heHr = (autoTrimpSettings.AutoPortal.selected == "Helium Per Hour");
    !radonon && (heHr || autoTrimpSettings.AutoPortal.selected == "Custom") ? turnOn("HeliumHourChallenge") : turnOff("HeliumHourChallenge");
    !radonon && (heHr) ? turnOn("HeHrDontPortalBefore") : turnOff("HeHrDontPortalBefore");
    !radonon && (heHr) ? turnOn("HeliumHrBuffer") : turnOff("HeliumHrBuffer");


    //RCore
    radonon ? turnOn('RManualGather2') : turnOff("RManualGather2");
    radonon ? turnOn('RTrapTrimps') : turnOff("RTrapTrimps");
    radonon ? turnOn('RBuyUpgradesNew') : turnOff("RBuyUpgradesNew");
    radonon ? turnOn("RAutoAllocatePerks") : turnOff("RAutoAllocatePerks");
    radonon && getPageSetting('RAutoAllocatePerks') == 2 ? turnOn("Rdumpgreed") : turnOff("Rdumpgreed");

    //RPortal
    radonon ? turnOn("RAutoPortal") : turnOff("RAutoPortal");
    (radonon && autoTrimpSettings.RAutoPortal.selected == "Custom") ? turnOn("RCustomAutoPortal") : turnOff("RCustomAutoPortal");
    var rnHr = (autoTrimpSettings.RAutoPortal.selected == "Radon Per Hour");
    radonon && (rnHr || autoTrimpSettings.RAutoPortal.selected == "Custom") ? turnOn("RadonHourChallenge") : turnOff("RadonHourChallenge");
    radonon && (rnHr) ? turnOn("RnHrDontPortalBefore") : turnOff("RnHrDontPortalBefore");
    radonon && (rnHr) ? turnOn("RadonHrBuffer") : turnOff("RadonHrBuffer");



    //Daily
    !radonon ? turnOn("buyheliumy") : turnOff("buyheliumy");
    !radonon ? turnOn("dscryvoidmaps") : turnOff("dscryvoidmaps");
    !radonon ? turnOn("dIgnoreSpiresUntil") : turnOff("dIgnoreSpiresUntil");
    !radonon ? turnOn("dExitSpireCell") : turnOff("dExitSpireCell");
    !radonon ? turnOn("dPreSpireNurseries") : turnOff("dPreSpireNurseries");
    !radonon ? turnOn("DailyVoidMod") : turnOff("DailyVoidMod");
    !radonon ? turnOn("dvoidscell") : turnOff("dvoidscell");
    !radonon ? turnOn("dRunNewVoidsUntilNew") : turnOff("dRunNewVoidsUntilNew");
    !radonon ? turnOn("drunnewvoidspoison") : turnOff("drunnewvoidspoison");
    !radonon ? turnOn("avoidempower") : turnOff("avoidempower");
    !radonon ? turnOn("dfightforever") : turnOff("dfightforever");
    !radonon ? turnOn("darmormagic") : turnOff("darmormagic");

    //DRaid
    !radonon ? turnOn("dPraidingzone") : turnOff("dPraidingzone");
    !radonon ? turnOn("dPraidingcell") : turnOff("dPraidingcell");
    !radonon ? turnOn("dPraidingHD") : turnOff("dPraidingHD");
    !radonon ? turnOn("dPraidingP") : turnOff("dPraidingP");
    !radonon ? turnOn("dPraidingI") : turnOff("dPraidingI");
    !radonon && getPageSetting('dPraidingzone') != -1 ? turnOn('dPraidHarder') : turnOff('dPraidHarder');
    !radonon && getPageSetting('dPraidHarder') ? turnOn('dPraidFarmFragsZ') : turnOff('dPraidFarmFragsZ');
    !radonon && getPageSetting('dPraidHarder') ? turnOn('dPraidBeforeFarmZ') : turnOff('dPraidBeforeFarmZ');
    !radonon && getPageSetting('dPraidHarder') ? turnOn('dMaxPraidZone') : turnOff('dMaxPraidZone');
    !radonon ? turnOn("Dailybwraid") : turnOff("Dailybwraid");
    !radonon && getPageSetting('Dailybwraid') == true ? turnOn("dbwraidcell") : turnOff("dbwraidcell");
    !radonon && getPageSetting('Dailybwraid') == true ? turnOn("dBWraidingz") : turnOff("dBWraidingz");
    !radonon && getPageSetting('Dailybwraid') == true ? turnOn("dBWraidingmax") : turnOff("dBWraidingmax");

    //DWind
    !radonon ? turnOn("use3daily") : turnOff("use3daily");
    !radonon ? turnOn("liqstack") : turnOff("liqstack");
    !radonon && getPageSetting('use3daily') == true ? turnOn("dwindhealthy") : turnOff("dwindhealthy");
    !radonon && getPageSetting('use3daily') == true ? turnOn("dusebstance") : turnOff("dusebstance");
    !radonon && getPageSetting('use3daily') == true ? turnOn("dWindStackingMin") : turnOff("dWindStackingMin");
    !radonon && getPageSetting('use3daily') == true ? turnOn("dWindStackingMinHD") : turnOff("dWindStackingMinHD");
    !radonon && getPageSetting('use3daily') == true ? turnOn("dWindStackingMax") : turnOff("dWindStackingMax");
    !radonon && getPageSetting('use3daily') == true ? turnOn("dwindcutoff") : turnOff("dwindcutoff");
    !radonon && getPageSetting('use3daily') == true ? turnOn("dwindcutoffmap") : turnOff("dwindcutoffmap");
    !radonon && getPageSetting('use3daily') == true ? turnOn("dwsmax") : turnOff("dwsmax");
    !radonon && getPageSetting('use3daily') == true ? turnOn("dwsmaxhd") : turnOff("dwsmaxhd");

    //DLoom
    // #68: this block gated 'dloomswaphd' / 'dhighdmg' / 'dlowdmg' on getPageSetting('dloomswap') > 0.
    // 'dloomswap' is an upstream-DELETED setting, so that read is false and `false > 0` is false — which
    // means all three ternaries always took the turnOff branch and the daily heirloom-swap settings were
    // PERMANENTLY HIDDEN: a user could not set 'dhighdmg'/'dlowdmg' at all, so every daily loom swap
    // (dhighHeirloom/dlowHeirloom from stance.ts, and now doPortal per #79) matched against an empty
    // string and did nothing. Their non-daily twins 'highdmg'/'lowdmg' have NO visibility line at all —
    // they are simply always shown — so deleting the block gives the daily pair exactly the twins'
    // treatment, and mints nothing. ('dloomswaphd' is not even a real id — no createSetting anywhere —
    // so its turnOn/turnOff was toggling an element that does not exist; it dies with the block.)

    //DPortal
    !radonon ? turnOn("AutoStartDaily") : turnOff("AutoStartDaily");
    !radonon ? turnOn("u2daily") : turnOff("u2daily");
    !radonon ? turnOn("AutoPortalDaily") : turnOff("AutoPortalDaily");
    !radonon && getPageSetting('AutoPortalDaily') == 2 ? turnOn("dCustomAutoPortal") : turnOff("dCustomAutoPortal");
    !radonon && getPageSetting('AutoPortalDaily') == 1 ? turnOn("dHeHrDontPortalBefore") : turnOff("dHeHrDontPortalBefore");
    !radonon && getPageSetting('AutoPortalDaily') == 1 ? turnOn("dHeliumHrBuffer") : turnOff("dHeliumHrBuffer");
    !radonon && getPageSetting('AutoPortalDaily') > 0 ? turnOn("dHeliumHourChallenge") : turnOff("dHeliumHourChallenge");

    //Shrine - U1 (Daily)
    !radonon ? turnOn("Hdshrine") : turnOff("Hdshrine");
    (!radonon && getPageSetting('Hdshrine') == 1) ? turnOn("Hdshrinemaz") : turnOff("Hdshrinemaz");
    turnOff("Hdshrinezone");
    turnOff("Hdshrinecell");
    turnOff("Hdshrineamount");


    //RDaily
    radonon ? turnOn("buyradony") : turnOff("buyradony");
    radonon ? turnOn("Rdscryvoidmaps") : turnOff("Rdscryvoidmaps");
    radonon ? turnOn("RdIgnoreSpiresUntil") : turnOff("RdIgnoreSpiresUntil");
    radonon ? turnOn("RDailyVoidMod") : turnOff("RDailyVoidMod");
    radonon ? turnOn("RdRunNewVoidsUntilNew") : turnOff("RdRunNewVoidsUntilNew");
    radonon ? turnOn("Ravoidempower") : turnOff("Ravoidempower");
    radonon ? turnOn("Rdfightforever") : turnOff("Rdfightforever");
    radonon ? turnOn("Rdarmormagic") : turnOff("Rdarmormagic");

    //RDRaid
    radonon ? turnOn("RdAMPraid") : turnOff("RdAMPraid");
    radonon && getPageSetting('RdAMPraid') == 1 ? turnOn("RdAMPraidmaz") : turnOff("RdAMPraidmaz");
    turnOff("RdAMPraidzone");
    turnOff("RdAMPraidraid");
    turnOff("RdAMPraidcell");
    radonon && getPageSetting('RdAMPraid') == 1 ? turnOn("RdAMPraidfrag") : turnOff("RdAMPraidfrag");
    radonon && getPageSetting('RdAMPraid') == 1 ? turnOn("RdAMPraidrecycle") : turnOff("RdAMPraidrecycle");

    //RDTime Farm
    radonon ? turnOn("Rdtimefarm") : turnOff("Rdtimefarm");
    (radonon && getPageSetting('Rdtimefarm') == 1) ? turnOn("Rdtimefarmmaz") : turnOff("Rdtimefarmmaz");
    turnOff("Rdtimefarmzone");
    turnOff("Rdtimefarmcell");
    turnOff("Rdtimefarmtime");
    turnOff("Rdtimefarmlevel");
    turnOff("Rdtimefarmmap");
    turnOff("Rdtimefarmspecial");
    turnOff("Rdtimefarmgather");

    //RDHeirloom Swapping
    radonon ? turnOn('Rdhs') : turnOff('Rdhs');
    var dhson = (getPageSetting('Rdhs') == 1);

    //RDShields
    radonon && dhson ? turnOn('Rdhsshield') : turnOff('Rdhsshield');
    var dhsshieldon = (getPageSetting('Rdhsshield') == true);
    radonon && dhson && dhsshieldon ? turnOn('Rdhsz') : turnOff('Rdhsz');
    radonon && dhson && dhsshieldon ? turnOn('Rdhs1') : turnOff('Rdhs1');
    radonon && dhson && dhsshieldon ? turnOn('Rdhs2') : turnOff('Rdhs2');

    //RDStaffs
    // #79: was `radonon && hson` — the wrong variable. This is the DAILY U2 block; every other line in
    // it gates on `dhson` (= Rdhs), and the non-daily twin of THIS line gates on `hson` (= Rhs). `hson`
    // is a `var` declared ~620 lines below, in the same 976-line function, so it hoists: at this point
    // it is `undefined`, never a ReferenceError — which is why nothing ever crashed and the bug went
    // unnoticed. `radonon && undefined` is falsy, so this ALWAYS took turnOff: 'Rdhsstaff' was
    // permanently hidden, which forced `dhsstaffon` false, which permanently hid 'Rdhsworldstaff',
    // 'Rdhsmapstaff' and 'Rdhstributestaff' too. Four daily U2 staff-swap settings, unreachable.
    radonon && dhson ? turnOn('Rdhsstaff') : turnOff('Rdhsstaff');
    var dhsstaffon = (getPageSetting('Rdhsstaff') == true);
    radonon && dhson && dhsstaffon ? turnOn('Rdhsworldstaff') : turnOff('Rdhsworldstaff');
    radonon && dhson && dhsstaffon ? turnOn('Rdhsmapstaff') : turnOff('Rdhsmapstaff');
    radonon && dhson && dhsstaffon ? turnOn('Rdhstributestaff') : turnOff('Rdhstributestaff');

    //Shrine - U2 (Daily)
    radonon ? turnOn("Rdshrine") : turnOff("Rdshrine");
    (radonon && getPageSetting('Rdshrine') == 1) ? turnOn("Rdshrinemaz") : turnOff("Rdshrinemaz");
    turnOff("Rdshrinezone");
    turnOff("Rdshrinecell");
    turnOff("Rdshrineamount");


    //RDPortal
    radonon ? turnOn("RAutoStartDaily") : turnOff("RAutoStartDaily");
    radonon ? turnOn("u1daily") : turnOff("u1daily");
    radonon ? turnOn("RAutoPortalDaily") : turnOff("RAutoPortalDaily");
    radonon && getPageSetting('RAutoPortalDaily') == 2 ? turnOn("RdCustomAutoPortal") : turnOff("RdCustomAutoPortal");
    radonon && getPageSetting('RAutoPortalDaily') == 1 ? turnOn("RdHeHrDontPortalBefore") : turnOff("RdHeHrDontPortalBefore");
    radonon && getPageSetting('RAutoPortalDaily') == 1 ? turnOn("RdHeliumHrBuffer") : turnOff("RdHeliumHrBuffer");
    radonon && getPageSetting('RAutoPortalDaily') > 0 ? turnOn("RdHeliumHourChallenge") : turnOff("RdHeliumHourChallenge");



    //C2
    !radonon ? turnOn("FinishC2") : turnOff("FinishC2");
    !radonon ? turnOn("buynojobsc") : turnOff("buynojobsc");
    !radonon ? turnOn("cfightforever") : turnOff("cfightforever");
    !radonon ? turnOn("carmormagic") : turnOff("carmormagic");
    radonon ? turnOn("Rcarmormagic") : turnOff("Rcarmormagic");
    !radonon ? turnOn("mapc2hd") : turnOff("mapc2hd");
    !radonon ? turnOn("novmsc2") : turnOff("novmsc2");
    !radonon ? turnOn("c2runnerstart") : turnOff("c2runnerstart");
    !radonon && getPageSetting('c2runnerstart') == true ? turnOn("c2runnerportal") : turnOff("c2runnerportal");
    !radonon && getPageSetting('c2runnerstart') == true ? turnOn("c2runnerpercent") : turnOff("c2runnerpercent");



    //Buildings
    !radonon ? turnOn("BuyBuildingsNew") : turnOff("BuyBuildingsNew");
    !radonon ? turnOn("MaxGym") : turnOff("MaxGym");
    !radonon ? turnOn("GymWall") : turnOff("GymWall");
    var fuckbuilding = (bwRewardUnlocked("AutoStructure") == true && bwRewardUnlocked("DecaBuild") && getPageSetting('hidebuildings') == true && getPageSetting('BuyBuildingsNew') == 0);
    (!radonon && bwRewardUnlocked("AutoStructure") == true && bwRewardUnlocked("DecaBuild")) ? turnOn("hidebuildings") : turnOff("hidebuildings");
    (!radonon && !fuckbuilding) ? turnOn("MaxHut") : turnOff("MaxHut");
    (!radonon && !fuckbuilding) ? turnOn("MaxHouse") : turnOff("MaxHouse");
    (!radonon && !fuckbuilding) ? turnOn("MaxMansion") : turnOff("MaxMansion");
    (!radonon && !fuckbuilding) ? turnOn("MaxHotel") : turnOff("MaxHotel");
    (!radonon && !fuckbuilding) ? turnOn("MaxResort") : turnOff("MaxResort");
    (!radonon && !fuckbuilding) ? turnOn("MaxGateway") : turnOff("MaxGateway");
    (!radonon && !fuckbuilding) ? turnOn("MaxWormhole") : turnOff("MaxWormhole");
    (!radonon && !fuckbuilding) ? turnOn("MaxCollector") : turnOff("MaxCollector");
    (!radonon && !fuckbuilding) ? turnOn("MaxTribute") : turnOff("MaxTribute");
    (!radonon && !fuckbuilding) ? turnOn("MaxNursery") : turnOff("MaxNursery");
    (!radonon && !fuckbuilding) ? turnOn("NoNurseriesUntil") : turnOff("NoNurseriesUntil");
    (!radonon && !fuckbuilding) ? turnOn("NurseryWall") : turnOff("NurseryWall");
    (!radonon && !fuckbuilding) ? turnOn("WarpstationCap") : turnOff("WarpstationCap");
    (!radonon && !fuckbuilding) ? turnOn("WarpstationCoordBuy") : turnOff("WarpstationCoordBuy");
    (!radonon && !fuckbuilding) ? turnOn("FirstGigastation") : turnOff("FirstGigastation");
    (!radonon && !fuckbuilding) ? turnOn("DeltaGigastation") : turnOff("DeltaGigastation");
    (!radonon && !fuckbuilding) ? turnOn("AutoGigas") : turnOff("AutoGigas");
    (!radonon && !fuckbuilding && getPageSetting("AutoGigas") == true) ? turnOn("CustomTargetZone") : turnOff("CustomTargetZone");
    (!radonon && !fuckbuilding && getPageSetting("AutoGigas") == true) ? turnOn("CustomDeltaFactor") : turnOff("CustomDeltaFactor");
    (!radonon && !fuckbuilding) ? turnOn("WarpstationWall3") : turnOff("WarpstationWall3");


    //RBuildings
    radonon ? turnOn("RBuyBuildingsNew") : turnOff("RBuyBuildingsNew");
    radonon ? turnOn("RMaxHut") : turnOff("RMaxHut");
    radonon ? turnOn("RMaxHouse") : turnOff("RMaxHouse");
    radonon ? turnOn("RMaxMansion") : turnOff("RMaxMansion");
    radonon ? turnOn("RMaxHotel") : turnOff("RMaxHotel");
    radonon ? turnOn("RMaxResort") : turnOff("RMaxResort");
    radonon ? turnOn("RMaxGateway") : turnOff("RMaxGateway");
    radonon ? turnOn("RMaxCollector") : turnOff("RMaxCollector");
    radonon ? turnOn("RMaxTribute") : turnOff("RMaxTribute");
    (radonon && getPageSetting('Rnurtureon') == true) ? turnOn("RMaxLabs") : turnOff("RMaxLabs");
    radonon ? turnOn("Rmeltsmithy") : turnOff("Rmeltsmithy");
    radonon ? turnOn("Rsmithylogic") : turnOff("Rsmithylogic");
    (radonon && getPageSetting('Rsmithylogic') == true) ? turnOn("Rsmithynumber") : turnOff("Rsmithynumber");
    (radonon && getPageSetting('Rsmithylogic') == true) ? turnOn("Rsmithypercent") : turnOff("Rsmithypercent");
    (radonon && getPageSetting('Rsmithylogic') == true) ? turnOn("Rsmithyseconds") : turnOff("Rsmithyseconds");



    //Jobs
    !radonon ? turnOn("BuyJobsNew") : turnOff("BuyJobsNew");
    !radonon ? turnOn("AutoMagmamancers") : turnOff("AutoMagmamancers");
    var fuckjobbies = (bwRewardUnlocked("AutoJobs") && getPageSetting('fuckjobs') == true && getPageSetting('BuyJobsNew') == 0);
    (!radonon && bwRewardUnlocked("AutoJobs")) ? turnOn("fuckjobs") : turnOff("fuckjobs");
    (!radonon && !fuckjobbies) ? turnOn("FarmerRatio") : turnOff("FarmerRatio");
    (!radonon && !fuckjobbies) ? turnOn("LumberjackRatio") : turnOff("LumberjackRatio");
    (!radonon && !fuckjobbies) ? turnOn("MinerRatio") : turnOff("MinerRatio");
    // #106: unlike the three ratio boxes above, ScientistPercent is NOT overwritten by "Auto Worker
    // Ratios" — workerRatios() only rewrites Farmer/Lumberjack/Miner — so it is a live control in every
    // BuyJobsNew mode, and stays visible whenever the Jobs panel is.
    (!radonon && !fuckjobbies) ? turnOn("ScientistPercent") : turnOff("ScientistPercent");
    (!radonon && !fuckjobbies) ? turnOn("MaxScientists") : turnOff("MaxScientists");
    (!radonon && !fuckjobbies) ? turnOn("MaxExplorers") : turnOff("MaxExplorers");
    (!radonon && !fuckjobbies) ? turnOn("MaxTrainers") : turnOff("MaxTrainers");


    //RJobs
    radonon ? turnOn("RBuyJobsNew") : turnOff("RBuyJobsNew");
    radonon ? turnOn("RFarmerRatio") : turnOff("RFarmerRatio");
    radonon ? turnOn("RLumberjackRatio") : turnOff("RLumberjackRatio");
    radonon ? turnOn("RMinerRatio") : turnOff("RMinerRatio");
    // #109: minted by #106 and then left out of this table, so turnOff was never called on it and
    // U1 rendered BOTH "Scientist %" boxes side by side. Its U1 twin is the line in the //Jobs block.
    radonon ? turnOn("RScientistPercent") : turnOff("RScientistPercent");
    radonon ? turnOn("RMaxExplorers") : turnOff("RMaxExplorers");
    radonon ? turnOn("Rshipfarmon") : turnOff("Rshipfarmon");
    (radonon && getPageSetting('Rshipfarmon') == true) ? turnOn("Rshipfarmzone") : turnOff("Rshipfarmzone");
    (radonon && getPageSetting('Rshipfarmon') == true) ? turnOn("Rshipfarmcell") : turnOff("Rshipfarmcell");
    (radonon && getPageSetting('Rshipfarmon') == true) ? turnOn("Rshipfarmamount") : turnOff("Rshipfarmamount");
    (radonon && getPageSetting('Rshipfarmon') == true) ? turnOn("Rshipfarmlevel") : turnOff("Rshipfarmlevel");
    (radonon && getPageSetting('Rshipfarmon') == true) ? turnOn("Rshipfarmfrag") : turnOff("Rshipfarmfrag");



    //Gear
    !radonon ? turnOn("BuyArmorNew") : turnOff("BuyArmorNew");
    !radonon ? turnOn("BuyWeaponsNew") : turnOff("BuyWeaponsNew");
    !radonon ? turnOn("CapEquip2") : turnOff("CapEquip2");
    !radonon ? turnOn("CapEquiparm") : turnOff("CapEquiparm");
    !radonon ? turnOn("dmgcuntoff") : turnOff("dmgcuntoff");
    !radonon ? turnOn("DynamicPrestige2") : turnOff("DynamicPrestige2");
    !radonon ? turnOn("Prestige") : turnOff("Prestige");
    !radonon ? turnOn("ForcePresZ") : turnOff("ForcePresZ");
    !radonon ? turnOn("PrestigeSkip1_2") : turnOff("PrestigeSkip1_2");
    !radonon ? turnOn("DelayArmorWhenNeeded") : turnOff("DelayArmorWhenNeeded");
    !radonon ? turnOn("BuyShieldblock") : turnOff("BuyShieldblock");
    !radonon ? turnOn("trimpsnotdie") : turnOff("trimpsnotdie");
    !radonon ? turnOn("gearamounttobuy") : turnOff("gearamounttobuy");
    !radonon ? turnOn("always2") : turnOff("always2");
    !radonon ? turnOn("InvestSpareMetal") : turnOff("InvestSpareMetal");


    //RGear

    radonon ? turnOn("Requipon") : turnOff("Requipon");
    (radonon && getPageSetting('Requipon') == true) ? turnOn("Requipamount") : turnOff("Requipamount");
    (radonon && getPageSetting('Requipon') == true) ? turnOn("Requipcapattack") : turnOff("Requipcapattack");
    (radonon && getPageSetting('Requipon') == true) ? turnOn("Requipcaphealth") : turnOff("Requipcaphealth");
    (radonon && getPageSetting('Requipon') == true) ? turnOn("Requipzone") : turnOff("Requipzone");
    (radonon && getPageSetting('Requipon') == true) ? turnOn("Requippercent") : turnOff("Requippercent");
    (radonon && getPageSetting('Requipon') == true) ? turnOn("Requip2") : turnOff("Requip2");
    (radonon && getPageSetting('Requipon') == true) ? turnOn("Rdmgcuntoff") : turnOff("Rdmgcuntoff");

    radonon ? turnOn("Requipfarmon") : turnOff("Requipfarmon");
    (radonon && getPageSetting('Requipfarmon') == true) ? turnOn("Requipfarmzone") : turnOff("Requipfarmzone");
    (radonon && getPageSetting('Requipfarmon') == true) ? turnOn("RequipfarmHD") : turnOff("RequipfarmHD");
    (radonon && getPageSetting('Requipfarmon') == true) ? turnOn("Requipfarmmult") : turnOff("Requipfarmmult");
    (radonon && getPageSetting('Requipfarmon') == true) ? turnOn("Requipfarmhits") : turnOff("Requipfarmhits");



    //Maps
    !radonon ? turnOn("AutoMaps") : turnOff("AutoMaps");
    (!radonon && getPageSetting('AutoMaps') == 2) ? turnOn("AMUblock") : turnOff("AMUblock");
    (!radonon && getPageSetting('AutoMaps') == 2) ? turnOn("AMUtrimple") : turnOff("AMUtrimple");
    (!radonon && getPageSetting('AutoMaps') == 2) ? turnOn("AMUprison") : turnOff("AMUprison");
    (!radonon && getPageSetting('AutoMaps') == 2) ? turnOn("AMUbw") : turnOff("AMUbw");
    (!radonon && getPageSetting('AutoMaps') == 2) ? turnOn("AMUstar") : turnOff("AMUstar");
    !radonon ? turnOn("automapsportal") : turnOff("automapsportal");
    !radonon ? turnOn("automapsalways") : turnOff("automapsalways");


    !radonon ? turnOn("mapselection") : turnOff("mapselection");
    !radonon ? turnOn("DynamicSiphonology") : turnOff("DynamicSiphonology");
    !radonon ? turnOn("PreferMetal") : turnOff("PreferMetal");
    !radonon ? turnOn("MaxMapBonusAfterZone") : turnOff("MaxMapBonusAfterZone");
    !radonon ? turnOn("MaxMapBonuslimit") : turnOff("MaxMapBonuslimit");
    !radonon ? turnOn("MaxMapBonushealth") : turnOff("MaxMapBonushealth");
    !radonon ? turnOn("mapcuntoff") : turnOff("mapcuntoff");
    !radonon ? turnOn("DisableFarm") : turnOff("DisableFarm");
    !radonon ? turnOn("LowerFarmingZone") : turnOff("LowerFarmingZone");
    !radonon ? turnOn("FarmWhenNomStacks7") : turnOff("FarmWhenNomStacks7");
    !radonon ? turnOn("VoidMaps") : turnOff("VoidMaps");
    !radonon ? turnOn("voidscell") : turnOff("voidscell");
    !radonon ? turnOn("RunNewVoidsUntilNew") : turnOff("RunNewVoidsUntilNew");
    !radonon ? turnOn("runnewvoidspoison") : turnOff("runnewvoidspoison");
    !radonon ? turnOn("onlystackedvoids") : turnOff("onlystackedvoids");
    !radonon ? turnOn("TrimpleZ") : turnOff("TrimpleZ");
    !radonon ? turnOn("AdvMapSpecialModifier") : turnOff("AdvMapSpecialModifier");
    !radonon ? turnOn("scryvoidmaps") : turnOff("scryvoidmaps");
    !radonon ? turnOn("buywepsvoid") : turnOff("buywepsvoid");
    !radonon ? turnOn("farmWonders") : turnOff("farmWonders");
    (!radonon && getPageSetting("farmWonders")) ? turnOn("wondersAmount") : turnOff("wondersAmount");
    (!radonon && getPageSetting("farmWonders")) ? turnOn("maxExpZone") : turnOff("maxExpZone");
    (!radonon && getPageSetting("farmWonders")) ? turnOn("finishExpOnBw") : turnOff("finishExpOnBw");

    //Shrine - U1
    !radonon ? turnOn("Hshrine") : turnOff("Hshrine");
    (!radonon && getPageSetting('Hshrine') == true) ? turnOn("Hshrinemaz") : turnOff("Hshrinemaz");
    turnOff("Hshrinezone");
    turnOff("Hshrinecell");
    turnOff("Hshrineamount");
    turnOff("Hshrinecharge");

    //RMaps
    radonon ? turnOn("RAutoMaps") : turnOff("RAutoMaps");
    radonon ? turnOn("Rautomapsportal") : turnOff("Rautomapsportal");
    radonon ? turnOn("Rautomapsalways") : turnOff("Rautomapsalways");
    radonon ? turnOn("Rmapselection") : turnOff("Rmapselection");
    radonon ? turnOn("RMaxMapBonusAfterZone") : turnOff("RMaxMapBonusAfterZone");
    radonon ? turnOn("RMaxMapBonuslimit") : turnOff("RMaxMapBonuslimit");
    radonon ? turnOn("RMaxMapBonushealth") : turnOff("RMaxMapBonushealth");
    radonon ? turnOn("Rhitssurvived") : turnOff("Rhitssurvived");
    radonon ? turnOn("Rmapcuntoff") : turnOff("Rmapcuntoff");
    radonon ? turnOn("RDisableFarm") : turnOff("RDisableFarm");

    radonon ? turnOn("Rtimefarm") : turnOff("Rtimefarm");
    (radonon && getPageSetting('Rtimefarm') == true) ? turnOn("Rtimefarmmaz") : turnOff("Rtimefarmmaz");
    turnOff("Rtimefarmzone");
    turnOff("Rtimefarmcell");
    turnOff("Rtimefarmtime");
    turnOff("Rtimefarmlevel");
    turnOff("Rtimefarmmap");
    turnOff("Rtimefarmspecial");
    turnOff("Rtimefarmgather");

    radonon ? turnOn("Rsmithyfarm") : turnOff("Rsmithyfarm");
    (radonon && getPageSetting('Rsmithyfarm') == true) ? turnOn("Rsmithyfarmmaz") : turnOff("Rsmithyfarmmaz");
    turnOff("Rsmithyfarmzone");
    turnOff("Rsmithyfarmcell");
    turnOff("Rsmithyfarmamount");

    radonon ? turnOn("Rtributefarm") : turnOff("Rtributefarm");
    (radonon && getPageSetting('Rtributefarm') == true) ? turnOn("Rtributefarmmaz") : turnOff("Rtributefarmmaz");
    turnOff("Rtributefarmzone");
    turnOff("Rtributefarmcell");
    turnOff("Rtributefarmamount");
    turnOff("Rtributefarmlevel");
    turnOff("Rtributemapselection");
    turnOff("Rtributespecialselection");
    turnOff("Rtributegatherselection");

    // Shrine - U2
    radonon ? turnOn("Rshrine") : turnOff("Rshrine");
    (radonon && getPageSetting('Rshrine') == true) ? turnOn("Rshrinemaz") : turnOff("Rshrinemaz");
    turnOff("Rshrinezone");
    turnOff("Rshrinecell");
    turnOff("Rshrineamount");
    turnOff("Rshrinecharge");

    radonon ? turnOn("RVoidMaps") : turnOff("RVoidMaps");
    radonon ? turnOn("Rvoidscell") : turnOff("Rvoidscell");
    radonon ? turnOn("RRunNewVoidsUntilNew") : turnOff("RRunNewVoidsUntilNew");
    radonon ? turnOn("Rprispalace") : turnOff("Rprispalace");
    radonon ? turnOn("Rmeltpoint") : turnOff("Rmeltpoint");
    radonon ? turnOn("Rfrozencastle") : turnOff("Rfrozencastle");

    //Spire
    !radonon ? turnOn("MaxStacksForSpire") : turnOff("MaxStacksForSpire");
    !radonon ? turnOn("MinutestoFarmBeforeSpire") : turnOff("MinutestoFarmBeforeSpire");
    !radonon ? turnOn("IgnoreSpiresUntil") : turnOff("IgnoreSpiresUntil");
    !radonon ? turnOn("ExitSpireCell") : turnOff("ExitSpireCell");
    !radonon ? turnOn("SpireBreedTimer") : turnOff("SpireBreedTimer");
    !radonon ? turnOn("PreSpireNurseries") : turnOff("PreSpireNurseries");
    !radonon ? turnOn("spireshitbuy") : turnOff("spireshitbuy");
    !radonon ? turnOn("SkipSpires") : turnOff("SkipSpires");



    //Raiding
    !radonon ? turnOn("Praidingzone") : turnOff("Praidingzone");
    !radonon ? turnOn("Praidingcell") : turnOff("Praidingcell");
    !radonon ? turnOn("PraidingHD") : turnOff("PraidingHD");
    !radonon ? turnOn("PraidingP") : turnOff("PraidingP");
    !radonon ? turnOn("PraidingI") : turnOff("PraidingI");
    !radonon && getPageSetting('Praidingzone') != -1 ? turnOn('PraidHarder') : turnOff('PraidHarder');
    !radonon && getPageSetting('PraidHarder') ? turnOn('PraidFarmFragsZ') : turnOff('PraidFarmFragsZ');
    !radonon && getPageSetting('PraidHarder') ? turnOn('PraidBeforeFarmZ') : turnOff('PraidBeforeFarmZ');
    !radonon && getPageSetting('PraidHarder') ? turnOn('MaxPraidZone') : turnOff('MaxPraidZone');
    !radonon ? turnOn("BWraid") : turnOff("BWraid");
    !radonon && getPageSetting('BWraid') == true ? turnOn("bwraidcell") : turnOff("bwraidcell");
    !radonon && getPageSetting('BWraid') == true ? turnOn("BWraidingz") : turnOff("BWraidingz");
    !radonon && getPageSetting('BWraid') == true ? turnOn("BWraidingmax") : turnOff("BWraidingmax");

    //RPraiding
    radonon ? turnOn("RAMPraid") : turnOff("RAMPraid");
    radonon && getPageSetting('RAMPraid') == true ? turnOn("RAMPraidmaz") : turnOff("RAMPraidmaz");
    turnOff("RAMPraidzone");
    turnOff("RAMPraidraid");
    turnOff("RAMPraidcell");
    radonon && getPageSetting('RAMPraid') == true ? turnOn("RAMPraidfrag") : turnOff("RAMPraidfrag");
    radonon && getPageSetting('RAMPraid') == true ? turnOn("RAMPraidrecycle") : turnOff("RAMPraidrecycle");



    //Windstacking
    var wson = (getPageSetting('AutoStance') == 3);
    (!radonon && !wson) ? turnOn("turnwson") : turnOff("turnwson");
    (!radonon && wson) ? turnOn("windhealthy") : turnOff("windhealthy");
    (!radonon && wson) ? turnOn("usebstance") : turnOff("usebstance");
    (!radonon && wson) ? turnOn("WindStackingMin") : turnOff("WindStackingMin");
    (!radonon && wson) ? turnOn("WindStackingMinHD") : turnOff("WindStackingMinHD");
    (!radonon && wson) ? turnOn("WindStackingMax") : turnOff("WindStackingMax");
    (!radonon && wson) ? turnOn("windcutoff") : turnOff("windcutoff");
    (!radonon && wson) ? turnOn("windcutoffmap") : turnOff("windcutoffmap");
    (!radonon && wson) ? turnOn("wsmax") : turnOff("wsmax");
    (!radonon && wson) ? turnOn("wsmaxhd") : turnOff("wsmaxhd");


    //ATGA
    !radonon ? turnOn("ATGA2") : turnOff("ATGA2");
    !radonon && getPageSetting('ATGA2') == true ? turnOn("ATGA2timer") : turnOff("ATGA2timer");
    !radonon && getPageSetting('ATGA2') == true ? turnOn("ATGA2gen") : turnOff("ATGA2gen");
    var ATGAon = (getPageSetting('ATGA2') == true && getPageSetting('ATGA2timer') > 0);
    (!radonon && ATGAon) ? turnOn("zATGA2timer") : turnOff("zATGA2timer");
    (!radonon && ATGAon && getPageSetting('zATGA2timer') > 0) ? turnOn("ztATGA2timer") : turnOff("ztATGA2timer");
    (!radonon && ATGAon) ? turnOn("ATGA2timerz") : turnOff("ATGA2timerz");
    (!radonon && ATGAon && getPageSetting('ATGA2timerz') > 0) ? turnOn("ATGA2timerzt") : turnOff("ATGA2timerzt");
    (!radonon && ATGAon) ? turnOn("sATGA2timer") : turnOff("sATGA2timer");
    (!radonon && ATGAon) ? turnOn("dsATGA2timer") : turnOff("dsATGA2timer");
    (!radonon && ATGAon) ? turnOn("dATGA2timer") : turnOff("dATGA2timer");
    (!radonon && ATGAon) ? turnOn("dhATGA2timer") : turnOff("dhATGA2timer");
    (!radonon && ATGAon) ? turnOn("cATGA2timer") : turnOff("cATGA2timer");
    (!radonon && ATGAon) ? turnOn("chATGA2timer") : turnOff("chATGA2timer");
    (!radonon && ATGAon) ? turnOn("dATGA2Auto") : turnOff("dATGA2Auto");



    //Combat
    !radonon ? turnOn("AutoStance") : turnOff("AutoStance");
    !radonon ? turnOn("AutoStanceNew") : turnOff("AutoStanceNew");
    !radonon ? turnOn("DynamicGyms") : turnOff("DynamicGyms");
    !radonon ? turnOn("AutoRoboTrimp") : turnOff("AutoRoboTrimp");
    !radonon ? turnOn("fightforever") : turnOff("fightforever");
    !radonon ? turnOn("addpoison") : turnOff("addpoison");
    !radonon ? turnOn("fullice") : turnOff("fullice");
    !radonon ? turnOn("45stacks") : turnOff("45stacks");
    !radonon ? turnOn("ForceAbandon") : turnOff("ForceAbandon");
    !radonon && getPageSetting('AutoStance') != 3 ? turnOn("IgnoreCrits") : turnOff("IgnoreCrits");


    //RCombat
    radonon ? turnOn("Rfightforever") : turnOff("Rfightforever");
    radonon ? turnOn("Rcalcmaxequality") : turnOff("Rcalcmaxequality");
    radonon ? turnOn("Rmanageequality") : turnOff("Rmanageequality");
    radonon ? turnOn("Rcalcfrenzy") : turnOff("Rcalcfrenzy");
    radonon ? turnOn("Rmutecalc") : turnOff("Rmutecalc");



    //Challenges

    //Quagmire
    radonon ? turnOn("Rblackbog") : turnOff("Rblackbog");
    (radonon && getPageSetting('Rblackbog') == true) ? turnOn("Rblackbogmaz") : turnOff("Rblackbogmaz");
    turnOff("Rblackbogzone");
    turnOff("Rblackbogamount");

    //Arch
    radonon ? turnOn("Rarchon") : turnOff("Rarchon");
    radonon && getPageSetting('Rarchon') == true ? turnOn("Rarchstring1") : turnOff("Rarchstring1");
    radonon && getPageSetting('Rarchon') == true ? turnOn("Rarchstring2") : turnOff("Rarchstring2");
    radonon && getPageSetting('Rarchon') == true ? turnOn("Rarchstring3") : turnOff("Rarchstring3");

    //Mayhem
    radonon ? turnOn("Rmayhemon") : turnOff("Rmayhemon");
    radonon && getPageSetting('Rmayhemon') == true ? turnOn("Rmayhemattack") : turnOff("Rmayhemattack");
    radonon && getPageSetting('Rmayhemon') == true ? turnOn("Rmayhemhealth") : turnOff("Rmayhemhealth");
    radonon && getPageSetting('Rmayhemon') == true ? turnOn("Rmayhemabcut") : turnOff("Rmayhemabcut");
    radonon && getPageSetting('Rmayhemon') == true ? turnOn("Rmayhemamcut") : turnOff("Rmayhemamcut");
    radonon && getPageSetting('Rmayhemon') == true ? turnOn("Rmayhemhcut") : turnOff("Rmayhemhcut");
    radonon && getPageSetting('Rmayhemon') == true ? turnOn("Rmayhemmap") : turnOff("Rmayhemmap");

    //Storm
    radonon ? turnOn("Rstormon") : turnOff("Rstormon");
    radonon && getPageSetting('Rstormon') == true ? turnOn("Rstormzone") : turnOff("Rstormzone");
    radonon && getPageSetting('Rstormon') == true ? turnOn("RstormHD") : turnOff("RstormHD");
    radonon && getPageSetting('Rstormon') == true ? turnOn("Rstormmult") : turnOff("Rstormmult");

    //Insanity
    radonon ? turnOn("Rinsanityon") : turnOff("Rinsanityon");
    radonon && getPageSetting('Rinsanityon') == true ? turnOn("Rinsanitymaz") : turnOff("Rinsanitymaz");
    turnOff("Rinsanityfarmzone");
    turnOff("Rinsanityfarmcell");
    turnOff("Rinsanityfarmstack");
    turnOff("Rinsanityfarmlevel");
    radonon && getPageSetting('Rinsanityon') == true ? turnOn("Rinsanityfarmfrag") : turnOff("Rinsanityfarmfrag");

    //Exterminate
    radonon ? turnOn("Rexterminateon") : turnOff("Rexterminateon");
    radonon && getPageSetting('Rexterminateon') == true ? turnOn("Rexterminatecalc") : turnOff("Rexterminatecalc");
    radonon && getPageSetting('Rexterminateon') == true ? turnOn("Rexterminateeq") : turnOff("Rexterminateeq");

    //Nurture
    radonon ? turnOn("Rnurtureon") : turnOff("Rnurtureon");

    //Panda
    radonon ? turnOn("Rpandaon") : turnOff("Rpandaon");
    radonon && getPageSetting('Rpandaon') == true ? turnOn("Rpandamaps") : turnOff("Rpandamaps");
    radonon && getPageSetting('Rpandaon') == true ? turnOn("Rpandazone") : turnOff("Rpandazone");
    radonon && getPageSetting('Rpandaon') == true ? turnOn("Rpandahits") : turnOff("Rpandahits");

    //Alch
    radonon ? turnOn("Ralchon") : turnOff("Ralchon");
    radonon && getPageSetting('Ralchon') == true ? turnOn("Ralchfarmmaz") : turnOff("Ralchfarmmaz");
    turnOff("Ralchfarmzone");
    turnOff("Ralchfarmcell");
    turnOff("Ralchfarmstack");
    turnOff("Ralchfarmlevel");
    turnOff("Ralchfarmselection");
    radonon && getPageSetting('Ralchon') == true ? turnOn("Ralchfarmfrag") : turnOff("Ralchfarmfrag");

    //Hypo
    radonon ? turnOn("Rhypoon") : turnOff("Rhypoon");
    radonon && getPageSetting('Rhypoon') == true ? turnOn("Rhypofarmmaz") : turnOff("Rhypofarmmaz");
    turnOff("Rhypofarmzone");
    turnOff("Rhypofarmcell");
    turnOff("Rhypofarmstack");
    turnOff("Rhypofarmlevel");
    radonon && getPageSetting('Rhypoon') == true ? turnOn("Rhypofarmfrag") : turnOff("Rhypofarmfrag");
    radonon && getPageSetting('Rhypoon') == true ? turnOn("Rhypocastle") : turnOff("Rhypocastle");
    radonon && getPageSetting('Rhypoon') == true ? turnOn("Rhypovoids") : turnOff("Rhypovoids");
    radonon && getPageSetting('Rhypoon') == true ? turnOn("Rhypostorage") : turnOff("Rhypostorage");
    
    //Desolation
    radonon ? turnOn("Rdesoon") : turnOff("Rdesoon");
    radonon && getPageSetting('Rdesoon') == true ? turnOn("Rdesozone") : turnOff("Rdesozone");
    radonon && getPageSetting('Rdesoon') == true ? turnOn("RdesoHD") : turnOff("RdesoHD");
    radonon && getPageSetting('Rdesoon') == true ? turnOn("Rdesomult") : turnOff("Rdesomult");

    //Hide Challenges
    radonon ? turnOn("Rchallengehide") : turnOff("Rchallengehide");
    radonon && getPageSetting('Rchallengehide') == true ? turnOn("Rchallengehidequag") : turnOff("Rchallengehidequag");
    radonon && getPageSetting('Rchallengehide') == true ? turnOn("Rchallengehidearch") : turnOff("Rchallengehidearch");
    radonon && getPageSetting('Rchallengehide') == true ? turnOn("Rchallengehidemayhem") : turnOff("Rchallengehidemayhem");
    radonon && getPageSetting('Rchallengehide') == true ? turnOn("Rchallengehidestorm") : turnOff("Rchallengehidestorm");
    radonon && getPageSetting('Rchallengehide') == true ? turnOn("Rchallengehideinsanity") : turnOff("Rchallengehideinsanity");
    radonon && getPageSetting('Rchallengehide') == true ? turnOn("Rchallengehideexterminate") : turnOff("Rchallengehideexterminate");
    radonon && getPageSetting('Rchallengehide') == true ? turnOn("Rchallengehidenurture") : turnOff("Rchallengehidenurture");
    radonon && getPageSetting('Rchallengehide') == true ? turnOn("Rchallengehidepanda") : turnOff("Rchallengehidepanda");
    radonon && getPageSetting('Rchallengehide') == true ? turnOn("Rchallengehidealchemy") : turnOff("Rchallengehidealchemy");
    radonon && getPageSetting('Rchallengehide') == true ? turnOn("Rchallengehidehypothermia") : turnOff("Rchallengehidehypothermia");
    radonon && getPageSetting('Rchallengehide') == true ? turnOn("Rchallengehidedeso") : turnOff("Rchallengehidedeso");

    if (getPageSetting('Rchallengehidequag') == true) {
        turnOff("Rblackbog");
        turnOff("Rblackbogmaz");
        turnOff("Rblackbogzone");
        turnOff("Rblackbogamount");
    }
    if (getPageSetting('Rchallengehidearch') == true) {
        turnOff("Rarchon");
        turnOff("Rarchstring1");
        turnOff("Rarchstring2");
        turnOff("Rarchstring3");
    }
    if (getPageSetting('Rchallengehidemayhem') == true) {
        turnOff("Rmayhemon");
        turnOff("Rmayhemattack");
        turnOff("Rmayhemhealth");
        turnOff("Rmayhemabcut");
        turnOff("Rmayhemamcut");
        turnOff("Rmayhemhcut");
        turnOff("Rmayhemmap");
    }
    if (getPageSetting('Rchallengehidestorm') == true) {
        turnOff("Rstormon");
        turnOff("Rstormzone");
        turnOff("RstormHD");
        turnOff("Rstormmult");
    }
    if (getPageSetting('Rchallengehideinsanity') == true) {
        turnOff("Rinsanityon");
        turnOff("Rinsanitymaz");
        turnOff("Rinsanityfarmzone");
        turnOff("Rinsanityfarmcell");
        turnOff("Rinsanityfarmstack");
        turnOff("Rinsanityfarmlevel");
        turnOff("Rinsanityfarmfrag");
    }
    if (getPageSetting('Rchallengehideexterminate') == true) {
        turnOff("Rexterminateon");
        turnOff("Rexterminatecalc");
        turnOff("Rexterminateeq");
    }
    if (getPageSetting('Rchallengehidenurture') == true) {
        turnOff("Rnurtureon");
    }
    if (getPageSetting('Rchallengehidepanda') == true) {
        turnOff("Rpandaon");
        turnOff("Rpandamaps");
        turnOff("Rpandazone");
        turnOff("Rpandahits");
    }
    if (getPageSetting('Rchallengehidealchemy') == true) {
        turnOff("Ralchon");
        turnOff("Ralchfarmmaz");
        turnOff("Ralchfarmzone");
        turnOff("Ralchfarmcell");
        turnOff("Ralchfarmstack");
        turnOff("Ralchfarmlevel");
        turnOff("Ralchfarmselection");
        turnOff("Ralchfarmfrag");
    }
    if (getPageSetting('Rchallengehidehypothermia') == true) {
        turnOff("Rhypoon");
        turnOff("Rhypofarmmaz");
        turnOff("Rhypofarmzone");
        turnOff("Rhypofarmcell");
        turnOff("Rhypofarmstack");
        turnOff("Rhypofarmlevel");
        turnOff("Rhypofarmfrag");
        turnOff("Rhypocastle");
        turnOff("Rhypovoids");
        turnOff("Rhypostorage");
    }
    
    if (getPageSetting('Rchallengehidedeso') == true) {
        turnOff("Rdesoon");
        turnOff("Rdesozone");
        turnOff("RdesoHD");
        turnOff("Rdesomult");
    }



    //Scryer
    !radonon ? turnOn("UseScryerStance") : turnOff("UseScryerStance");
    !radonon ? turnOn("ScryerUseWhenOverkill") : turnOff("ScryerUseWhenOverkill");
    !radonon ? turnOn("ScryerMinZone") : turnOff("ScryerMinZone");
    !radonon ? turnOn("ScryerMaxZone") : turnOff("ScryerMaxZone");
    !radonon ? turnOn("onlyminmaxworld") : turnOff("onlyminmaxworld");
    !radonon ? turnOn("ScryerUseinMaps2") : turnOff("ScryerUseinMaps2");
    !radonon ? turnOn("ScryerUseinVoidMaps2") : turnOff("ScryerUseinVoidMaps2");
    !radonon ? turnOn("ScryerUseinPMaps") : turnOff("ScryerUseinPMaps");
    !radonon ? turnOn("ScryerUseinBW") : turnOff("ScryerUseinBW");
    !radonon ? turnOn("ScryerUseinSpire2") : turnOff("ScryerUseinSpire2");
    !radonon ? turnOn("ScryerSkipBoss2") : turnOff("ScryerSkipBoss2");
    !radonon ? turnOn("ScryerSkipCorrupteds2") : turnOff("ScryerSkipCorrupteds2");
    !radonon ? turnOn("ScryerSkipHealthy") : turnOff("ScryerSkipHealthy");
    !radonon ? turnOn("ScryUseinPoison") : turnOff("ScryUseinPoison");
    !radonon ? turnOn("ScryUseinWind") : turnOff("ScryUseinWind");
    !radonon ? turnOn("ScryUseinIce") : turnOff("ScryUseinIce");
    !radonon ? turnOn("ScryerDieZ") : turnOff("ScryerDieZ");
    !radonon ? turnOn("screwessence") : turnOff("screwessence");


    //Magma
    !radonon ? turnOn("UseAutoGen") : turnOff("UseAutoGen");
    !radonon ? turnOn("beforegen") : turnOff("beforegen");
    !radonon ? turnOn("fuellater") : turnOff("fuellater");
    !radonon ? turnOn("fuelend") : turnOff("fuelend");
    !radonon ? turnOn("defaultgen") : turnOff("defaultgen");
    !radonon ? turnOn("AutoGenDC") : turnOff("AutoGenDC");
    !radonon ? turnOn("AutoGenC2") : turnOff("AutoGenC2");
    !radonon ? turnOn("spendmagmite") : turnOff("spendmagmite");
    !radonon ? turnOn("ratiospend") : turnOff("ratiospend");
    var ratiospend = getPageSetting('ratiospend');
    (!radonon && !ratiospend) ? turnOn("SupplyWall") : turnOff("SupplyWall");
    (!radonon && !ratiospend) ? turnOn("spendmagmitesetting") : turnOff("spendmagmitesetting");
    (!radonon && !ratiospend) ? turnOn("MagmiteExplain") : turnOff("MagmiteExplain");
    (!radonon && ratiospend) ? turnOn("effratio") : turnOff("effratio");
    (!radonon && ratiospend) ? turnOn("capratio") : turnOff("capratio");
    (!radonon && ratiospend) ? turnOn("supratio") : turnOff("supratio");
    (!radonon && ratiospend) ? turnOn("ocratio") : turnOff("ocratio");


    //Golden
    !radonon ? turnOn("AutoGoldenUpgrades") : turnOff("AutoGoldenUpgrades");
    !radonon ? turnOn("dAutoGoldenUpgrades") : turnOff("dAutoGoldenUpgrades");
    !radonon ? turnOn("cAutoGoldenUpgrades") : turnOff("cAutoGoldenUpgrades");
    !radonon && getPageSetting('AutoGoldenUpgrades') == "Void" ? turnOn('voidheliumbattle') : turnOff('voidheliumbattle');
    !radonon && getPageSetting('dAutoGoldenUpgrades') == "Void" ? turnOn('dvoidheliumbattle') : turnOff('dvoidheliumbattle');
    !radonon && getPageSetting('AutoGoldenUpgrades') == "Helium" ? turnOn('radonbattle') : turnOff('radonbattle');
    !radonon && getPageSetting('dAutoGoldenUpgrades') == "Helium" ? turnOn('dradonbattle') : turnOff('dradonbattle');
    !radonon && getPageSetting('AutoGoldenUpgrades') == "Battle" ? turnOn('battleradon') : turnOff('battleradon');
    !radonon && getPageSetting('dAutoGoldenUpgrades') == "Battle" ? turnOn('dbattleradon') : turnOff('dbattleradon');

    //RGolden
    radonon ? turnOn("RAutoGoldenUpgrades") : turnOff("RAutoGoldenUpgrades");
    radonon ? turnOn("RdAutoGoldenUpgrades") : turnOff("RdAutoGoldenUpgrades");
    radonon ? turnOn("RcAutoGoldenUpgrades") : turnOff("RcAutoGoldenUpgrades");
    radonon && getPageSetting('RAutoGoldenUpgrades') == "Void" ? turnOn('Rvoidheliumbattle') : turnOff('Rvoidheliumbattle');
    radonon && getPageSetting('RdAutoGoldenUpgrades') == "Void" ? turnOn('Rdvoidheliumbattle') : turnOff('Rdvoidheliumbattle');
    radonon && getPageSetting('RAutoGoldenUpgrades') == "Radon" ? turnOn('Rradonbattle') : turnOff('Rradonbattle');
    radonon && getPageSetting('RdAutoGoldenUpgrades') == "Radon" ? turnOn('Rdradonbattle') : turnOff('Rdradonbattle');
    radonon && getPageSetting('RAutoGoldenUpgrades') == "Battle" ? turnOn('Rbattleradon') : turnOff('Rbattleradon');
    radonon && getPageSetting('RdAutoGoldenUpgrades') == "Battle" ? turnOn('Rdbattleradon') : turnOff('Rdbattleradon');


    //AB
    radonon ? turnOn("RAB") : turnOff("RAB");
    radonon && getPageSetting('RAB') == true ? turnOn("RABpreset") : turnOff("RABpreset");
    radonon && getPageSetting('RAB') == true ? turnOn("RABdustsimple") : turnOff("RABdustsimple");
    radonon && getPageSetting('RAB') == true ? turnOn("RABfarm") : turnOff("RABfarm");
    radonon && getPageSetting('RAB') == true ? turnOn("RABfarmswitch") : turnOff("RABfarmswitch");
    radonon && getPageSetting('RAB') == true ? turnOn("RABfarmstring") : turnOff("RABfarmstring");
    radonon && getPageSetting('RAB') == true ? turnOn("RABfarmsolve") : turnOff("RABfarmsolve");


    //Nature
    !radonon ? turnOn("AutoNatureTokens") : turnOff("AutoNatureTokens");
    !radonon && getPageSetting('AutoNatureTokens') == true ? turnOn("tokenthresh") : turnOff("tokenthresh");
    !radonon && getPageSetting('AutoNatureTokens') == true ? turnOn("AutoPoison") : turnOff("AutoPoison");
    !radonon && getPageSetting('AutoNatureTokens') == true ? turnOn("AutoWind") : turnOff("AutoWind");
    !radonon && getPageSetting('AutoNatureTokens') == true ? turnOn("AutoIce") : turnOff("AutoIce");


    //Enlight
    !radonon ? turnOn("autoenlight") : turnOff("autoenlight");
    !radonon && getPageSetting('autoenlight') == true ? turnOn("pfillerenlightthresh") : turnOff("pfillerenlightthresh");
    !radonon && getPageSetting('autoenlight') == true ? turnOn("wfillerenlightthresh") : turnOff("wfillerenlightthresh");
    !radonon && getPageSetting('autoenlight') == true ? turnOn("ifillerenlightthresh") : turnOff("ifillerenlightthresh");
    !radonon && getPageSetting('autoenlight') == true ? turnOn("pdailyenlightthresh") : turnOff("pdailyenlightthresh");
    !radonon && getPageSetting('autoenlight') == true ? turnOn("wdailyenlightthresh") : turnOff("wdailyenlightthresh");
    !radonon && getPageSetting('autoenlight') == true ? turnOn("idailyenlightthresh") : turnOff("idailyenlightthresh");
    !radonon && getPageSetting('autoenlight') == true ? turnOn("pc2enlightthresh") : turnOff("pc2enlightthresh");
    !radonon && getPageSetting('autoenlight') == true ? turnOn("wc2enlightthresh") : turnOff("wc2enlightthresh");
    !radonon && getPageSetting('autoenlight') == true ? turnOn("ic2enlightthresh") : turnOff("ic2enlightthresh");


    //Display
    (game.worldUnlocks.easterEgg.locked == false) ? turnOn('AutoEggs') : turnOff('AutoEggs');
    turnOff("zonetracker");


    //Memory
    if (getPageSetting('showbreedtimer') == false) turnOff("hiddenBreedTimer");
    if (getPageSetting('showautomapstatus') == false) turnOff("autoMapStatus");
    !radonon ? turnOn("showautomapstatus") : turnOff("showautomapstatus");
    radonon ? turnOn("Rshowautomapstatus") : turnOff("Rshowautomapstatus");


    //Heirloom Swapping
    radonon ? turnOn('Rhs') : turnOff('Rhs');
    var hson = (getPageSetting('Rhs') == true);

    //Shields
    radonon && hson ? turnOn('Rhsshield') : turnOff('Rhsshield');
    var hsshieldon = (getPageSetting('Rhsshield') == true);
    radonon && hson && hsshieldon ? turnOn('Rhsz') : turnOff('Rhsz');
    radonon && hson && hsshieldon ? turnOn('Rhs1') : turnOff('Rhs1');
    radonon && hson && hsshieldon ? turnOn('Rhs2') : turnOff('Rhs2');

    //Staffs
    radonon && hson ? turnOn('Rhsstaff') : turnOff('Rhsstaff');
    var hsstaffon = (getPageSetting('Rhsstaff') == true);
    radonon && hson && hsstaffon ? turnOn('Rhsworldstaff') : turnOff('Rhsworldstaff');
    radonon && hson && hsstaffon ? turnOn('Rhsmapstaff') : turnOff('Rhsmapstaff');
    radonon && hson && hsstaffon ? turnOn('Rhstributestaff') : turnOff('Rhstributestaff');

    var autoheirloomenable = (getPageSetting('autoheirlooms') == true);
    var keepshieldenable = (autoheirloomenable && getPageSetting('keepshields') == true);
    var keepstaffenable = (autoheirloomenable && getPageSetting('keepstaffs') == true);
    var keepcoreenable = (autoheirloomenable && getPageSetting('keepcores') == true);

    (autoheirloomenable) ? turnOn('typetokeep') : turnOff('typetokeep');
    (autoheirloomenable) ? turnOn('raretokeep') : turnOff('raretokeep');
    (autoheirloomenable) ? turnOn('keepshields') : turnOff('keepshields');
    (autoheirloomenable) ? turnOn('keepstaffs') : turnOff('keepstaffs');

    (keepshieldenable) ? turnOn('slot1modsh') : turnOff('slot1modsh');
    (keepshieldenable) ? turnOn('slot2modsh') : turnOff('slot2modsh');
    (keepshieldenable) ? turnOn('slot3modsh') : turnOff('slot3modsh');
    (keepshieldenable) ? turnOn('slot4modsh') : turnOff('slot4modsh');
    (keepshieldenable) ? turnOn('slot5modsh') : turnOff('slot5modsh');
    (keepshieldenable) ? turnOn('slot6modsh') : turnOff('slot6modsh');
    (keepshieldenable) ? turnOn('slot7modsh') : turnOff('slot7modsh');

    (keepstaffenable) ? turnOn('slot1modst') : turnOff('slot1modst');
    (keepstaffenable) ? turnOn('slot2modst') : turnOff('slot2modst');
    (keepstaffenable) ? turnOn('slot3modst') : turnOff('slot3modst');
    (keepstaffenable) ? turnOn('slot4modst') : turnOff('slot4modst');
    (keepstaffenable) ? turnOn('slot5modst') : turnOff('slot5modst');
    (keepstaffenable) ? turnOn('slot6modst') : turnOff('slot6modst');
    (keepstaffenable) ? turnOn('slot7modst') : turnOff('slot7modst');

    (keepcoreenable) ? turnOn('slot1modcr') : turnOff('slot1modcr');
    (keepcoreenable) ? turnOn('slot2modcr') : turnOff('slot2modcr');
    (keepcoreenable) ? turnOn('slot3modcr') : turnOff('slot3modcr');
    (keepcoreenable) ? turnOn('slot4modcr') : turnOff('slot4modcr');


    //Dropdowns
    byId('AutoPortal').value = autoTrimpSettings.AutoPortal.selected;
    byId('HeliumHourChallenge').value = autoTrimpSettings.HeliumHourChallenge.selected;
    byId('RAutoPortal').value = autoTrimpSettings.RAutoPortal.selected;
    byId('RadonHourChallenge').value = autoTrimpSettings.RadonHourChallenge.selected;
    byId('dHeliumHourChallenge').value = autoTrimpSettings.dHeliumHourChallenge.selected;
    byId('RdHeliumHourChallenge').value = autoTrimpSettings.RdHeliumHourChallenge.selected;
    byId('mapselection').value = autoTrimpSettings.mapselection.selected;
    byId('Rmapselection').value = autoTrimpSettings.Rmapselection.selected;
    byId<HTMLSelectElement>('Prestige').value = autoTrimpSettings.Prestige.selected;
    byId('AutoGoldenUpgrades').value = autoTrimpSettings.AutoGoldenUpgrades.selected;
    byId('dAutoGoldenUpgrades').value = autoTrimpSettings.dAutoGoldenUpgrades.selected;
    byId('cAutoGoldenUpgrades').value = autoTrimpSettings.cAutoGoldenUpgrades.selected;
    byId('RAutoGoldenUpgrades').value = autoTrimpSettings.RAutoGoldenUpgrades.selected;
    byId('RdAutoGoldenUpgrades').value = autoTrimpSettings.RdAutoGoldenUpgrades.selected;
    byId('RcAutoGoldenUpgrades').value = autoTrimpSettings.RcAutoGoldenUpgrades.selected;
    byId('AutoPoison').value = autoTrimpSettings.AutoPoison.selected;
    byId('AutoWind').value = autoTrimpSettings.AutoWind.selected;
    byId('AutoIce').value = autoTrimpSettings.AutoIce.selected;

    //Heirloom dropdowns
    byId('raretokeep').value = autoTrimpSettings.raretokeep.selected;
    byId('slot1modsh').value = autoTrimpSettings.slot1modsh.selected;
    byId('slot2modsh').value = autoTrimpSettings.slot2modsh.selected;
    byId('slot3modsh').value = autoTrimpSettings.slot3modsh.selected;
    byId('slot4modsh').value = autoTrimpSettings.slot4modsh.selected;
    byId('slot5modsh').value = autoTrimpSettings.slot5modsh.selected;
    byId('slot6modsh').value = autoTrimpSettings.slot6modsh.selected;
    byId('slot7modsh').value = autoTrimpSettings.slot7modsh.selected;
    byId('slot1modst').value = autoTrimpSettings.slot1modst.selected;
    byId('slot2modst').value = autoTrimpSettings.slot2modst.selected;
    byId('slot3modst').value = autoTrimpSettings.slot3modst.selected;
    byId('slot4modst').value = autoTrimpSettings.slot4modst.selected;
    byId('slot5modst').value = autoTrimpSettings.slot5modst.selected;
    byId('slot6modst').value = autoTrimpSettings.slot6modst.selected;
    byId('slot7modst').value = autoTrimpSettings.slot7modst.selected;
    byId('slot1modcr').value = autoTrimpSettings.slot1modcr.selected;
    byId('slot2modcr').value = autoTrimpSettings.slot2modcr.selected;
    byId('slot3modcr').value = autoTrimpSettings.slot3modcr.selected;
    byId('slot4modcr').value = autoTrimpSettings.slot4modcr.selected;

    if (game.global.universe == 1)
        document.getElementById('autoMapBtn')!.setAttribute('class', 'noselect settingsBtn settingBtn' + autoTrimpSettings.AutoMaps.value);
    if (game.global.universe == 2)
        document.getElementById('autoMapBtn')!.setAttribute('class', 'noselect settingsBtn settingBtn' + autoTrimpSettings.RAutoMaps.value);


    if (game.global.universe == 1 && getPageSetting('DisableFarm') <= 0)
        shouldFarm = false;
    if (game.global.universe == 2 && getPageSetting('RDisableFarm') <= 0)
        RshouldFarm = false;

    MODULES["maps"] && (MODULES["maps"].preferGardens = !getPageSetting('PreferMetal'));
    if (byId<HTMLSelectElement>('Prestige').selectedIndex > 11 && game.global.slowDone == false) {
        byId<HTMLSelectElement>('Prestige').selectedIndex = 11;
        autoTrimpSettings.Prestige.selected = "Bestplate";
    }

    for (var setting in autoTrimpSettings) {
        var item = autoTrimpSettings[setting];
        if (item.type == 'value' || item.type == 'valueNegative' || item.type == 'multitoggle' || item.type == 'multiValue' || item.type == 'textValue') {
            var elem = document.getElementById(item.id);
            if ((elem as any).parentNode.style.display === 'none') continue;
            if (elem != null) {
                if (item.type == 'multitoggle')
                    renderControlFace(elem, item); // #39: preserve the glyph/counter (was elem.textContent = ...)
                else if (item.type == 'multiValue') {
                    if (Array.isArray(item.value) && item.value.length == 1 && item.value[0] == -1)
                        elem.innerHTML = item.name + ': ' + "<span class='icomoon icon-infinity'></span>";
                    else if (Array.isArray(item.value))
                        elem.innerHTML = item.name + ': ' + item.value[0] + '+';
                    else
                        elem.textContent = item.name + ': ' + item.value.toString();
                } else if (item.type == 'textValue' && item.value.substring !== undefined) {
                    if (item.value.length > 18)
                        elem.textContent = item.name + ': ' + item.value.substring(0, 21) + '...';
                    else
                        elem.textContent = item.name + ': ' + item.value.substring(0, 21);
                } else if (item.value > -1 || item.type == 'valueNegative')
                    elem.textContent = item.name + ': ' + prettify(item.value) + jobRatioSuffix(item.id);
                else
                    elem.innerHTML = item.name + ': ' + "<span class='icomoon icon-infinity'></span>";
            }
        }
    }
}

export function checkPortalSettings() {
    var result = findOutCurrentPortalLevel();
    var portalLevel = result.level;
    if (portalLevel == -1)
        return portalLevel;
    var voidmaps = 0;
    if (game.global.challengeActive != "Daily") {
        voidmaps = getPageSetting('VoidMaps');
    }
    if (game.global.challengeActive == "Daily") {
        // #68: was getPageSetting('dVoidMaps') — an id that has NEVER been createSetting'd anywhere in
        // this repo's history, so it read false and `false >= portalLevel` was false: this "your voids
        // are set to run after your autoPortal" warning could never fire on a Daily. 'DailyVoidMod'
        // ("Daily Void Zone") is the live daily twin, and upgrades.ts:35 already performs this exact
        // dispatch correctly — `daily ? getPageSetting('DailyVoidMod') : getPageSetting('VoidMaps')` —
        // which is the same pairing, spelled right. Repointed at it; mints nothing.
        voidmaps = getPageSetting('DailyVoidMod');
    }
    if (voidmaps >= portalLevel)
        tooltip('confirm', null, 'update', 'WARNING: Your void maps are set to complete after your autoPortal, and therefore will not be done at all! Please Change Your Settings Now. This Box Will Not Go away Until You do. Remember you can choose \'Custom\' autoPortal along with challenges for complete control over when you portal. <br><br> Estimated autoPortal level: ' + portalLevel, 'cancelTooltip()', 'Void Maps Conflict');
    return portalLevel;
}

export function getDailyHeHrStats() {
    var a = "";
    if ("Daily" == game.global.challengeActive) {
        var b = game.stats.heliumHour.value() / (game.global.totalHeliumEarned - (game.global.heliumLeftover + game.resources.helium.owned));
        b *= 100 + getDailyHeliumValue(countDailyWeight());
        a = "<b>After Daily He/Hr: " + b.toFixed(3) + "%";
    }
    return a
}

export function getDailyRnHrStats() {
    var a = "";
    if ("Daily" == game.global.challengeActive) {
        var b = game.stats.heliumHour.value() / (game.global.totalRadonEarned - (game.global.radonLeftover + game.resources.radon.owned));
        b *= 100 + getDailyHeliumValue(countDailyWeight());
        a = "<b>After Daily Rn/Hr: " + b.toFixed(3) + "%";
    }
    return a
}

// #72: an empty `export function settingsProfileMakeGUI() { }` used to live here, and it SILENTLY BEAT
// the real 36-line implementation in import-export.ts. legacy-bridge.ts publishes every module with one
// wildcard `Object.assign(globalThis, {...importExport, …, ...settingsVisibility, …})`, and object spread
// is last-write-wins — settingsVisibility is spread at #30, importExport at #23, so the STUB landed on
// globalThis. settings-defs.ts:964 calls it as a bare identifier (resolving through that seam), and that
// is the one call that happens after createTabs() builds the Import/Export tab. Result: the entire
// Settings-Profile feature — the dropdown, the saved-profile list, the Delete button — never rendered.
// No error, no warning, green typecheck. The stub is deleted; tests/nets/bridge-collision.test.ts now
// fails on any duplicate export name so this cannot recur.
