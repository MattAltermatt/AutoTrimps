// TRUE TS (Phase 1 · #31): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/settings-defs.js.
// initializeAllSettings, the 570 createSetting calls. ORDER AND COMPLETENESS ARE THE PERSISTENCE
// CONTRACT: the flat saved blob is rehydrated inside createSetting; a dropped/renamed/reordered
// call silently kills that setting. Interleaved insertAdjacentHTML('afterend','<br>') layout calls
// and modifyParentNode() calls are preserved verbatim and in order.
// createSetting/modifyParentNode/settingsProfileMakeGUI resolve at runtime via the global bridge.

import { tip, tierTable } from './settings-tip';
import { RATIO_TIERS } from './jobs-ratios';

// #107 — the worker-ratio tiers render FROM the table the allocator reads, never hand-copied. The old
// BuyJobsNew tooltip typed them out by hand: all six documented tiers were wrong, a 7th was missing, and
// the "then… then…" phrasing implied an ordering the selector does not use.
//
// NOTE it reads the imported table, NOT `MODULES["jobs"]`. MODULES is ambient runtime state that only
// exists once jobs.ts has been evaluated, so reading it here made settings-defs silently load-order
// dependent — initializeAllSettings() threw `ReferenceError: MODULES is not defined` in every harness
// that mounts the settings without booting the bot. A pure import has no such ordering hazard.
const ratioTiers = () => tierTable(RATIO_TIERS.map((t) => ({ when: t.condition, ratio: t.ratio })));

export function initializeAllSettings() {

    //Core

    //Line 1
    createSetting('ManualGather2', ['Manual Gather/Build', 'Auto Gather/Build', 'Mining/Building Only', 'Science Research OFF'],tip({
        what: 'Controls how AT gathers resources and builds in U1 (Helium).',
        how: '<b>Manual Gather/Build</b> does nothing — you gather and build entirely by hand.<br><br><b>Auto Gather/Build</b> runs the full gather/build/trap/research loop.<br><br><b>Mining/Building Only</b> switches to a much simpler loop that just gathers metal or works your build queue, skipping trapping and research entirely — meant for once you have the Foremany mastery and no longer need food or wood.<br><br><b>Science Research OFF</b> behaves like Auto Gather/Build but never gathers science by hand (useful for the "reach Z120 without manual research" achievement).'
    }), 'multitoggle', 1, null, "Core");
    createSetting('gathermetal', 'Metal Only',tip({
        what: 'While <b>Mining/Building Only</b> is selected, forces AT to always gather metal instead of letting your build queue take priority.',
        how: 'Off, AT still finishes off its build queue first and only gathers metal once one item or fewer remains queued.',
        ignoredWhen: 'ManualGather2 is not set to Mining/Building Only, or you have not unlocked the Foremany mastery — this control is hidden in both cases.'
    }), 'boolean', false, null, "Core");
    createSetting('BuyUpgradesNew', ['Manual Upgrades', 'Buy All Upgrades', 'Upgrades no Coords'],tip({
        what: 'Autobuys non-equipment upgrades in U1 (equipment upgrades are controlled from the Gear tab).',
        how: '<b>Manual Upgrades</b> buys nothing. <b>Buy All Upgrades</b> buys everything it can, including Coordination. <b>Upgrades no Coords</b> buys everything except Coordination — use this only if you specifically want to hold your population cap down.'
    }), 'multitoggle', 1, null, "Core");
    createSetting('MetalEfficiencyPriority', 'Metal: Efficiency First',tip({
        what: 'During the Metal challenge, buys the Efficiency upgrade before any other upgrade while below your Metal Efficiency Zone.',
        how: 'During Metal all metal comes from manual mining, and each Efficiency level doubles it, so rushing Efficiency early can save time per zone. Opt-in — off is the unchanged, pre-existing behavior.',
        ignoredWhen: 'You are not in the Metal challenge, or your world zone is at or above Metal Efficiency Zone.'
    }), 'boolean', false, null, "Core");
    createSetting('MetalEfficiencyZone', 'Metal Efficiency Zone',tip({
        what: 'The zone cutoff for <b>Metal: Efficiency First</b> — Efficiency is only rushed while your world zone is below this value.',
        how: 'Past that zone, map farming dominates metal income and rushing Efficiency stops mattering, so the priority turns itself off.',
        ignoredWhen: 'Metal: Efficiency First is off.'
    }), 'value', 6, null, "Core");
    createSetting('amalcoord', 'Amal Boost',tip({
        what: 'Skips buying the Coordination upgrade under the conditions below, to let your Amalgamator count grow instead.',
        how: 'Only takes effect while your H:D ratio is below <b>Amal Boost H:D</b>. It then keeps skipping Coordination either indefinitely (if <b>Amal Target</b> is disabled, until <b>Amal Boost End Z</b> if that is set) or until your owned Amalgamators reach <b>Amal Target</b> — whichever you have configured.'
    }), 'boolean', false, null, "Core");
    createSetting('amalcoordt', 'Amal Target',tip({
        what: 'The number of Amalgamators to aim for while <b>Amal Boost</b> is skipping Coordination purchases.',
        how: 'Once your owned Amalgamators reach this number, AT stops skipping Coordination for the target reason (it may still skip it for the zone-based reason below). Set to -1 to ignore the target and rely on <b>Amal Boost End Z</b> instead.',
        ignoredWhen: 'Amal Boost is off.'
    }), 'value', -1, null, "Core");
    createSetting('amalcoordhd', 'Amal Boost H:D',tip({
        what: 'The H:D ratio threshold for <b>Amal Boost</b> — Coordination is only skipped while your H:D ratio is below this value.',
        how: 'A higher number here means AT skips Coordination less often (a looser bar to clear).',
        ignoredWhen: 'Amal Boost is off, or set to 0.'
    }), 'value', 0.0000025, null, "Core");
    createSetting('amalcoordz', 'Amal Boost End Z',tip({
        what: 'The zone at which <b>Amal Boost</b> stops skipping Coordination purchases, when <b>Amal Target</b> is disabled.',
        how: 'Set to -1 to let the boost run indefinitely with no zone cutoff.',
        ignoredWhen: 'Amal Boost is off, or Amal Target is set to a positive value (the target takes over as the stopping condition instead).'
    }), 'value', -1, null, "Core");
    createSetting('AutoAllocatePerks', ['Auto Allocate Off', 'Auto Allocate On', 'Dump into Looting II'],tip({
        what: 'Controls what happens to your unspent helium when you portal in U1.',
        how: '<b>Auto Allocate On</b> runs the ratio-based AutoPerks preset to spend your helium (it never touches the Fixed Perks: siphonology, anticipation, meditation, relentlessness, range, agility, bait, trumps, packrat, capable). <b>Dump into Looting II</b> instead spends your available helium to max out the Looting II perk on every portal, ahead of any ratio-based allocation.'
    }), 'multitoggle', 0, null, 'Core');

    //Line 2
    createSetting('fastallocate', 'Fast Allocate',tip({
        what: 'Switches Auto Allocate to a faster, less precise helium-spending algorithm.',
        how: 'Recommended once your helium is above roughly 500Qa, where the precise algorithm gets slow. Not recommended for smaller amounts of helium.',
        cannot: 'This box only appears in the U1 (Helium) view, but the same stored value also controls whether U2\'s Radon Auto Allocate uses the fast algorithm — there is no separate control for U2.'
    }), 'boolean', false, null, 'Core');
    createSetting('TrapTrimps', 'Trap Trimps',tip({
        what: 'Automatically traps trimps when needed in U1, including building traps.',
        how: 'If you turn this off, you may as well turn off the game\'s own Auto-Traps button too — leaving it on with AT\'s trapping off just lets the game trap for you instead.'
    }), 'boolean', true, null, "Core");
    createSetting('AutoEggs', 'AutoEggs',tip({
        what: 'Clicks the Easter Egg automatically whenever it appears on entering a new zone.',
        how: 'Warning: this is quite overpowered. Please solemnly swear that you are up to no good.',
        ignoredWhen: 'You have not unlocked the Easter Egg — the control is hidden until then.'
    }), 'boolean', false, null, 'Core');
    createSetting('AutoBoneChargeMax', ['Manual Bone Charge', 'Bone Charge When Max', 'Bone Charge (Daily Only)'], tip({
        what: 'Spends a Bone Charge from the Bone Shrine once you are at max charges, so they never sit wasted at the cap.',
        how: '<b>Bone Charge (Daily Only)</b> does the same but only while you are on a daily challenge.<br><br>Set the zone it starts from under <b>Bone Charge Start Z</b>.',
    }), 'multitoggle', 0, null, "Core");
    createSetting('AutoBoneChargeMaxStartZone', 'Bone Charge Start Z', tip({
        what: 'The zone from which Bone Charges start being used.',
        how: '<b>-1</b> tracks your progress automatically: it uses charges from 10% below your highest zone cleared. (Cleared zone 400 &rarr; charges from zone 360 on.)<br><br>Any other number starts from exactly that zone.',
        ignoredWhen: '<b>Auto Bone Charge</b> is set to <b>Manual Bone Charge</b>.',
    }), 'value', -1, null, "Core");
    (document.getElementById('AutoEggs') as any).parentNode.insertAdjacentHTML('afterend', '<br>');

    //RCore

    //Line 1
    createSetting('RManualGather2', ['Manual Gather/Build', 'Auto Gather/Build', 'Mining/Building Only'],tip({
        what: 'Controls how AT gathers resources and builds in U2 (Radon).',
        how: '<b>Manual Gather/Build</b> does nothing. <b>Auto Gather/Build</b> and <b>Mining/Building Only</b> both run the same U2 gather logic; Mining/Building Only additionally suppresses the science-gathering branches inside it and defaults to gathering metal instead, rather than switching to a wholly separate loop the way its U1 counterpart does.'
    }), 'multitoggle', 1, null, "Core");
    createSetting('RTrapTrimps', 'Trap Trimps',tip({
        what: 'Automatically traps trimps when needed in U2, including building traps.',
        how: 'If you turn this off, you may as well turn off the game\'s own Auto-Traps button too — leaving it on with AT\'s trapping off just lets the game trap for you instead.'
    }), 'boolean', true, null, "Core");
    createSetting('RBuyUpgradesNew', ['Manual Upgrades', 'Buy All Upgrades', 'Upgrades no Coords'],tip({
        what: 'Autobuys non-equipment upgrades in U2 (equipment upgrades are controlled from the Gear tab).',
        how: '<b>Manual Upgrades</b> buys nothing. <b>Buy All Upgrades</b> buys everything it can, including Coordination. <b>Upgrades no Coords</b> buys everything except Coordination.'
    }), 'multitoggle', 1, null, "Core");
    createSetting('RAutoAllocatePerks', ['Auto Allocate Off', 'Auto Allocate On', 'Dump into Looting'],tip({
        what: 'Controls what happens to your unspent radon when you portal in U2.',
        how: '<b>Auto Allocate On</b> runs the ratio-based AutoPerks preset to spend your radon (it never touches the Fixed Perks). <b>Dump into Looting</b> instead spends your available radon to max out the Looting perk (or the Greed perk, if <b>Greed Dump</b> is on) on every portal, ahead of any ratio-based allocation.'
    }), 'multitoggle', 0, null, 'Core');
    createSetting('Rdumpgreed', 'Greed Dump',tip({
        what: 'Redirects <b>Dump into Looting</b> to max out the Greed perk instead of Looting.',
        ignoredWhen: 'RAutoAllocatePerks is not set to Dump into Looting.'
    }), 'boolean', false, null, "Core");


    //Portal
    createSetting('AutoPortal', 'AutoPortal',tip({
        what: 'Automatically portals in U1 once the condition for the selected mode is met.',
        how: '<b>Helium Per Hour</b> portals at cell 1 of the first level where your He/hr dips below your best for the run by more than the <b>He/Hr Portal Buffer %</b> (subject to <b>Don\'t Portal Before</b>). <b>Custom</b> portals right after clearing the zone set in <b>Custom Portal</b>. Any named challenge (Balance, Nom, Watch, Lead, and so on) portals as soon as the portal becomes available, provided no challenge is currently active.<br><br>Never fires while you have a challenge active — every mode portals immediately once that challenge ends, regardless of setting.',
        cannot: 'Selecting Helium Per Hour can portal you immediately if your He/hr is already below your run best — use Pause AutoTrimps first if you want to check before it fires.'
    }), 'dropdown', 'Off', ['Off', 'Helium Per Hour', 'Balance', 'Decay', 'Electricity', 'Life', 'Crushed', 'Nom', 'Toxicity', 'Watch', 'Lead', 'Corrupted', 'Domination', 'Experience', 'Custom'], "Core");
    createSetting('HeliumHourChallenge', 'Portal Challenge',tip({
        what: 'The challenge AT auto-selects for your next run.',
        ignoredWhen: 'AutoPortal is not set to Helium Per Hour or Custom — with any other AutoPortal mode, the mode\'s own challenge choice is used instead and this setting is not read.'
    }), 'dropdown', 'None', ['None', 'Balance', 'Decay', 'Electricity', 'Life', 'Crushed', 'Nom', 'Toxicity', 'Watch', 'Lead', 'Corrupted', 'Domination', 'Experience'], "Core");
    (document.getElementById("HeliumHourChallengeLabel") as any).innerHTML = "Portal Challenge:";
    createSetting('CustomAutoPortal', 'Custom Portal',tip({
        what: 'The zone AT portals after clearing, when AutoPortal is set to Custom.',
        how: 'E.g. setting this to 200 portals the moment you first reach level 201.',
        ignoredWhen: 'AutoPortal is not set to Custom.'
    }), 'value', '999', null, "Core");
    createSetting('HeHrDontPortalBefore', 'Don\'t Portal Before',tip({
        what: 'Blocks the Helium Per Hour AutoPortal from firing before this zone is reached, even if your He/hr has already dropped.',
        how: 'Set to 0 or -1 to remove the check entirely.',
        ignoredWhen: 'AutoPortal is not set to Helium Per Hour.'
    }), 'value', '999', null, "Core");
    createSetting('HeliumHrBuffer', 'He/Hr Portal Buffer %',tip({
        what: 'How far your He/hr has to drop below your run-best before Helium Per Hour AutoPortal triggers.',
        how: 'E.g. 5 portals once your He/hr falls to 95% of your best this run. Includes stuck protection: if you overshoot the buffer by 5x while stuck mid-zone, it portals anyway instead of waiting for cell 1.',
        ignoredWhen: 'AutoPortal is not set to Helium Per Hour.'
    }), 'value', '0', null, 'Core');

    //RPortal
    (document.getElementById('Rdumpgreed') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('RAutoPortal', 'AutoPortal',tip({
        what: 'Automatically portals in U2 once the condition for the selected mode is met.',
        how: '<b>Radon Per Hour</b> portals at cell 1 of the first level where your Rn/hr dips below your best for the run by more than the <b>Rn/Hr Portal Buffer %</b> (subject to <b>Don\'t Portal Before</b>). <b>Custom</b> portals right after clearing the zone set in <b>Custom Portal</b>. Any named challenge (Bublé, Melt, Insanity, Hypothermia, and so on) portals as soon as the portal becomes available, provided no challenge is currently active.',
        cannot: 'Selecting Radon Per Hour can portal you immediately if your Rn/hr is already below your run best — use Pause AutoTrimps first if you want to check before it fires.'
    }), 'dropdown', 'Off', ['Off', 'Radon Per Hour', 'Bublé', 'Melt', 'Quagmire', 'Archaeology', 'Insanity', 'Nurture', 'Alchemy', 'Hypothermia', 'Custom'], "Core");
    createSetting('RadonHourChallenge', 'Portal Challenge',tip({
        what: 'The challenge AT auto-selects for your next U2 run.',
        ignoredWhen: 'RAutoPortal is not set to Radon Per Hour or Custom.'
    }), 'dropdown', 'None', ['None', 'Bublé', 'Melt', 'Quagmire', 'Archaeology', 'Insanity', 'Nurture', 'Alchemy', 'Hypothermia'], "Core");
    createSetting('RCustomAutoPortal', 'Custom Portal',tip({
        what: 'The zone AT portals after clearing, when RAutoPortal is set to Custom.',
        how: 'E.g. setting this to 200 portals the moment you first reach level 201.',
        ignoredWhen: 'RAutoPortal is not set to Custom.'
    }), 'value', '999', null, "Core");
    createSetting('RnHrDontPortalBefore', 'Don\'t Portal Before',tip({
        what: 'Blocks the Radon Per Hour AutoPortal from firing before this zone is reached, even if your Rn/hr has already dropped.',
        how: 'Set to 0 or -1 to remove the check entirely.',
        ignoredWhen: 'RAutoPortal is not set to Radon Per Hour.'
    }), 'value', '999', null, "Core");
    createSetting('RadonHrBuffer', 'Rn/Hr Portal Buffer %',tip({
        what: 'How far your Rn/hr has to drop below your run-best before Radon Per Hour AutoPortal triggers.',
        how: 'E.g. 5 portals once your Rn/hr falls to 95% of your best this run. Includes stuck protection: if you overshoot the buffer by 5x while stuck mid-zone, it portals anyway instead of waiting for cell 1.',
        ignoredWhen: 'RAutoPortal is not set to Radon Per Hour.'
    }), 'value', '0', null, 'Core');


    //Pause + Switch
    createSetting('PauseScript', 'Pause AutoTrimps',tip({
        what: 'Pauses all of AutoTrimps.',
        how: 'The Graphs module keeps running while paused — only the automation loop stops.'
    }), 'boolean', null, null, 'Core');
    var $pauseScript: any = document.getElementById('PauseScript');
    $pauseScript.parentNode.style.setProperty('float', 'right');
    $pauseScript.parentNode.style.setProperty('margin-right', '1vw');
    $pauseScript.parentNode.style.setProperty('margin-left', '0');
    createSetting('radonsettings', ['Helium', 'Radon'],tip({
        what: 'Switches which settings tabs you are viewing: U1 (Helium) or U2 (Radon).',
        how: 'Display only — it does not change which universe your run is actually in, only which set of controls this settings page shows you.'
    }), 'multitoggle', 0, null, 'Core');
    var $radonsettings: any = document.getElementById('radonsettings');
    $radonsettings.parentNode.style.setProperty('float', 'right');
    $radonsettings.parentNode.style.setProperty('margin-right', '1vw');
    $radonsettings.parentNode.style.setProperty('margin-left', '0');



    //Daily

    //Line 1
    createSetting('buyheliumy', 'Buy Heliumy %',tip({
        what: 'Spends the Daily\'s one-time Heliumy bonus (100 bones, one purchase per Daily) once the Daily\'s difficulty score is at or above this value.',
        how: 'The difficulty score comes from the game\'s own Daily-weight calculation. Only checked while a Daily is active and only if you can afford the 100 bones. -1 disables the purchase entirely.',
    }), 'value', -1, null, 'Daily');
    createSetting('dfightforever', ['DFA: Off', 'DFA: Non-Empowered', 'DFA: All Dailies'],tip({
        what: 'Sends your army to fight instead of sitting idle on certain Daily debuffs, even when Better Auto Fight would otherwise hold back.',
        how: '<b>DFA: Non-Empowered</b> only forces fighting on Bogged/Plague/Pressure Dailies that are not also Empowered. <b>DFA: All Dailies</b> forces fighting on any Bogged/Plague/Pressure Daily regardless of Empower. Neither option touches Bloodthirst or Plagued-formation-locked Dailies.',
    }), 'multitoggle', '0', null, 'Daily');
    createSetting('avoidempower', 'Avoid Empower',tip({
        what: 'Predicts whether the next enemy attack, boosted by your current Empower stacks, would wipe your army — and if so, retreats to the map screen just before that happens.',
        ignoredWhen: 'Bogged or Plague Dailies, which have their own health handling, or while already mapping.',
    }), 'boolean', true, null, 'Daily');
    createSetting('darmormagic', ['Daily Armor Magic Off', 'DAM: Above 80%', 'DAM: H:D', 'DAM: Always'],tip({
        what: 'Buys armor to try to survive Bleed/Plague/Bogged Dailies once your health drops to 40% or less.',
        cannot: 'The third option, <b>DAM: Always</b>, still only buys armor once health is at or below 40% — none of the three modes buy armor pre-emptively.',
        how: '<b>Above 80%:</b> only active once your world zone is at or above 80% of your highest zone ever cleared. <b>H:D:</b> only active once your H:D ratio is at or above the H:D cutoff set in the Maps tab (i.e. you don\'t have enough damage). <b>Always:</b> active any time your health is low enough, no zone or H:D gate.',
    }), 'multitoggle', 0, null, "Daily");
    createSetting('dscryvoidmaps', 'Daily VM Scryer',tip({
        what: 'Uses the Scryer stance while running Void Maps during a Daily.',
        ignoredWhen: 'You don\'t have Scryhard II. It works independently of the other Scryer-stance settings.',
    }), 'boolean', false, null, 'Daily');

    //Spire
    (document.getElementById('dscryvoidmaps') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('dIgnoreSpiresUntil', 'Daily Ignore Spires Until',tip({
        what: 'Zone-gates Spire automation during Dailies: Spire-specific behavior (like Daily Exit Spire Cell) only kicks in once your world zone reaches this value.',
        how: 'Set to 0 to disable the gate, so Daily Spire automation is active from zone 1.',
    }), 'value', '200', null, 'Daily');
    createSetting('dExitSpireCell', 'Daily Exit Spire Cell',tip({
        what: 'The cell at which AT exits an active Spire during a Daily.',
        ignoredWhen: 'Universe 2, or before the zone set in Daily Ignore Spires Until is reached.',
    }), 'value', -1, null, 'Daily');
    createSetting('dPreSpireNurseries', 'Daily Nurseries pre-Spire',tip({
        what: 'Caps how many Nurseries AT will build in preparation for a Daily Spire.',
        how: 'While the Daily Spire gate (Daily Ignore Spires Until) is satisfied, this cap replaces — not adds to — your normal No Nurseries Until Z and Max Nurseries limits, so you can keep Spire nursery prep separate from your normal nursery settings. -1 disables it.',
    }), 'value', -1, null, 'Daily');

    //Windstacking
    (document.getElementById('dPreSpireNurseries') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('use3daily', 'Daily Windstacking',tip({
        what: 'Forces the Windstacking (W) stance during Dailies, the same way Auto Combat Stance\'s own W option does outside Dailies.',
        how: 'This is the master switch for the Daily windstacking settings below it — they only take effect while this is on.',
    }), 'boolean', false, null, 'Daily');
    createSetting('dWindStackingMin', 'Daily Windstack Min Zone',tip({
        what: 'The zone above which Daily windstacking is allowed to activate.',
        ignoredWhen: 'Daily Windstacking is off, or your world zone is below this value.',
        how: '0 or a negative value disables Daily windstacking entirely regardless of the other windstack settings.',
    }), 'value', '-1', null, 'Daily');
    createSetting('dWindStackingMinHD', 'Daily Windstack H:D',tip({
        what: 'The H:D ratio below which AT switches straight into maximum windstacking during a Daily Wind Enlightenment.',
        ignoredWhen: 'Your world zone is below Daily Windstack Min Zone, or you\'re not in Wind Enlightenment with Empowerment active.',
    }), 'value', '1e33', null, 'Daily');
    createSetting('dWindStackingMax', 'Daily Windstack Stacks',tip({
        what: 'The number of Wind debuff stacks AT tries to reach before switching back to your normal high-damage heirloom during a Daily.',
        how: 'During Wind Enlightenment, 100 stacks are added on top of this value automatically.',
    }), 'value', '200', null, 'Daily');
    createSetting('dwindcutoff', 'Daily Wind Damage Cutoff',tip({
        what: 'The damage cutoff AT uses to decide whether it has "enough" damage while windstacking a Daily, in place of the normal gear-buying cutoff.',
        ignoredWhen: 'Daily Windstack Min Zone is 0/off or your zone hasn\'t reached it, or Daily Windstacking (or Auto Stance\'s W option) is off.',
        how: 'A higher cutoff makes AT settle for less damage — i.e. it keeps buying less gear — which lets your Wind stacks climb higher before AT decides you\'re strong enough. -1 falls back to the normal (non-windstacking) cutoff.',
    }), 'value', '-1', null, 'Daily');
    createSetting('dwindcutoffmap', 'Daily Wind Map Cutoff',tip({
        what: 'The same damage cutoff as Daily Wind Damage Cutoff, but for deciding when to take the Maps bonus while windstacking a Daily.',
        ignoredWhen: 'Daily Windstack Min Zone is 0/off or your zone hasn\'t reached it, or Daily Windstacking (or Auto Stance\'s W option) is off.',
    }), 'value', '-1', null, 'Daily');
    createSetting('liqstack', 'Stack Liquification',tip({
        what: 'Forces the windstacking stance whenever you\'re in a liquid zone during Wind Enlightenment.',
        how: 'This check does not require a Daily to be active — despite living in this tab, it applies any time you\'re in Wind Enlightenment and standing in a liquid zone.',
    }), 'boolean', false, null, 'Daily');
    createSetting('dwsmax', 'Daily WS MAX',tip({
        what: 'The zone above which Daily WS MAX starts withholding damage to chase your maximum possible windstack count.',
        how: 'Works together with Daily WSM H:D: both must be a positive value for WS MAX to activate. -1 disables it.',
    }), 'value', '-1', null, 'Daily');
    createSetting('dwsmaxhd', 'Daily WSM H:D',tip({
        what: 'The H:D ratio below which Daily WS MAX is allowed to withhold damage and keep stacking, once your zone has passed Daily WS MAX.',
        ignoredWhen: 'Daily WS MAX is -1/disabled, or this value is not positive.',
    }), 'value', '-1', null, 'Daily');

    //Raiding
    (document.getElementById('dwsmaxhd') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('dPraidingzone', 'Daily P Raiding Z',tip({
        what: 'The list of zones at which AT raids Maps for prestige gear during a Daily.',
        how: 'Example: 495 raids Maps at 501 (up to +6, see Daily Max P Raid Z). Once every gear piece is obtained from the raid, AT reverts to normal farming. Accepts a comma-separated list, e.g. 495,506,525.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('dPraidingcell', 'Daily P Raiding Cell',tip({
        what: 'The cell at which Daily P Raiding is allowed to begin, once the raid zone is reached.',
        how: '-1 starts raiding at cell 1. If you also use Daily BW Raiding, setting this lower than Daily BW Raiding Cell keeps the two from overlapping.',
    }), 'value', -1, null, 'Daily');
    createSetting('dPraidingHD', 'Daily P Raiding HD',tip({
        what: 'The H:D ratio ceiling for Daily P Raiding: AT will not raid a +level Map whose predicted H:D exceeds this value.',
        how: 'Higher values let AT reach further +levels. 0 or -1 removes the check entirely (any +level is allowed).',
    }), 'value', -1, null, 'Daily');
    createSetting('dPraidingP', 'Daily P Raiding Poison',tip({
        what: 'Caps how many +levels Daily P Raiding will reach while in a Poison Empowerment, independent of the H:D check.',
        ignoredWhen: 'You are not currently in a Poison Empowerment.',
        how: 'E.g. 10 allows raiding up to +10 in Poison. Use this instead of Daily P Raiding HD if the H:D estimate is off for your build — the two can also be combined. 0 or -1 means no Poison-specific cap.',
    }), 'value', -1, null, 'Daily');
    createSetting('dPraidingI', 'Daily P Raiding Ice',tip({
        what: 'Caps how many +levels Daily P Raiding will reach while in an Ice Empowerment, independent of the H:D check.',
        ignoredWhen: 'You are not currently in an Ice Empowerment.',
        how: 'E.g. 10 allows raiding up to +10 in Ice. Use this instead of Daily P Raiding HD if the H:D estimate is off for your build — the two can also be combined. 0 or -1 means no Ice-specific cap.',
    }), 'value', -1, null, 'Daily');
    createSetting('dPraidHarder', 'Daily Hardcore P Raiding',tip({
        what: '(EXPERIMENTAL) Always buys the highest prestige Map you can afford while Daily P Raiding, instead of the exact zone you set, and can farm fragments toward it.',
        ignoredWhen: 'Daily P Raiding Z has no zones set.',
        how: 'Turning this on reveals the Daily Farm Frags Z, Dy Raid bef farm Z, and Daily Max P Raid Z settings below.',
    }), 'boolean', false, null, 'Daily');
    createSetting('dMaxPraidZone', 'Daily Max P Raid Z',tip({
        what: 'Per-entry ceiling on how far Daily P Raiding will go, matched by position to the list in Daily P Raiding Z.',
        ignoredWhen: 'Daily Hardcore P Raiding is off.',
        how: 'Example: if Daily P Raiding Z is 491,495 and this is 495,505, AT raids up to 495 from 491 and up to 505 from 495. Set an entry to -1 to always buy the highest prestige Map available (up to about +8, depending where your zone falls in its decade) instead of a fixed ceiling.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('dPraidFarmFragsZ', 'Daily Farm Frags Z',tip({
        what: 'Zones at which AT farms fragments until it can afford the highest (or targeted) prestige Map for Daily P Raiding.',
        ignoredWhen: 'Daily Hardcore P Raiding is off.',
        how: 'Set an entry to -1 to never farm fragments at that zone.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('dPraidBeforeFarmZ', 'Dy Raid bef farm Z',tip({
        what: 'Zones at which AT raids as far up as it can currently afford before switching to farming fragments toward the highest or targeted prestige Map.',
        ignoredWhen: 'Daily Hardcore P Raiding is off.',
        how: 'Mainly useful if a lucky Speedexplorer pickup makes raiding cheap, or fragment farming is unusually slow. -1 (the entry, not the whole setting) means never raid-before-farm at that zone.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('Dailybwraid', 'Daily BW Raid',tip({
        what: 'Master switch for Daily BW (Bionic Werewolf) Raiding.',
        how: 'Turns off the game\'s native "Climb BW" option while active, since AT is now driving BW selection itself.',
    }), 'boolean', false, null, 'Daily');
    createSetting('dbwraidcell', 'Daily BW Raiding Cell',tip({
        what: 'The cell at which Daily BW Raiding is allowed to begin, once the raid zone is reached.',
        how: '-1 starts raiding at cell 1. If you also use Daily P Raiding, setting this higher than Daily P Raiding Cell keeps the two from overlapping.',
    }), 'value', -1, null, 'Daily');
    createSetting('dBWraidingz', 'Daily Z to BW Raid',tip({
        what: 'The list of zones at which AT raids Bionic Werewolves for gear during a Daily.',
        how: 'Example: 495 raids every BW from 495 up for whatever gear you\'re missing, skipping BWs you already have enough damage to ignore. Once all gear is obtained, AT returns to normal farming. Accepts a comma-separated list, matched by position to Daily Max BW to raid — keep the two lists the same length or BW raiding may fail.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('dBWraidingmax', 'Daily Max BW to raid',tip({
        what: 'Per-entry ceiling on how far Daily BW Raiding climbs, matched by position to the list in Daily Z to BW Raid.',
        how: 'Example: if Daily Z to BW Raid is 480,495 and this is 500,515, AT raids up to 500 from 480 and up to 515 from 495.',
    }), 'multiValue', [-1], null, 'Daily');

    //Shrine - U1 (Daily)
    (document.getElementById('dBWraidingmax') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Hdshrine', ['Daily AutoShrine Off', 'Daily AutoShrine On', 'DAS: Normal'],tip({
        what: 'Turns on automatic Bone Shrine charge use during Dailies, using the zone/cell/amount list configured in Daily AutoShrine Settings.',
        how: 'Click <b>Daily AutoShrine Settings</b> to edit the list.',
    }), 'multitoggle', 0, null, 'Daily');
    createSetting('Hdshrinemaz', 'Daily AutoShrine Settings',tip({
        what: 'Opens the Daily AutoShrine settings popup, where you configure the zone/cell/amount list Daily AutoShrine uses.',
        how: '<b>Zone:</b> world zone to spend a charge at. <b>Cell:</b> cell within that zone to spend it at — past cell 80 you get the benefit of all Bone Shrine books. <b>Amount:</b> how many charges to spend there. Example: Zone 40, Cell 10, Amount 3 spends 3 charges at zone 40, cell 10, during a Daily.',
    }), 'infoclick', false, null, 'Daily');
    createSetting('Hdshrinezone', 'AutoShrine: Zone',tip({
        what: 'The zone list for Daily AutoShrine, matched by position to Daily AutoShrine\'s cell and amount lists.',
        how: 'Edited through the <b>Daily AutoShrine Settings</b> popup — this row is not shown directly in the settings list.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('Hdshrinecell', 'AutoShrine: Cell',tip({
        what: 'The cell list for Daily AutoShrine, matched by position to Daily AutoShrine\'s zone and amount lists.',
        how: 'Edited through the <b>Daily AutoShrine Settings</b> popup — this row is not shown directly in the settings list.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('Hdshrineamount', 'AutoShrine: Amount',tip({
        what: 'The charge-amount list for Daily AutoShrine, matched by position to Daily AutoShrine\'s zone and cell lists.',
        how: 'Edited through the <b>Daily AutoShrine Settings</b> popup — this row is not shown directly in the settings list.',
    }), 'multiValue', [-1], null, 'Daily');

    //RDaily

    //Line 1
    createSetting('buyradony', 'Buy Radonculous %',tip({
        what: 'Spends the Daily\'s one-time Radonculous bonus (100 bones, one purchase per Daily) once the Daily\'s difficulty score is at or above this value.',
        how: 'The difficulty score comes from the game\'s own Daily-weight calculation. Only checked while a Daily is active and only if you can afford the 100 bones. -1 disables the purchase entirely.',
    }), 'value', -1, null, 'Daily');
    createSetting('Rdfightforever', ['DFA: Off', 'DFA: Non-Empowered', 'DFA: All Dailies'],tip({
        what: 'Universe 2 twin of DFA: sends your army to fight instead of sitting idle on certain Daily debuffs.',
        how: '<b>DFA: Non-Empowered</b> only forces fighting on Bogged/Plague/Pressure Dailies that are not also Empowered. <b>DFA: All Dailies</b> forces fighting on any Bogged/Plague/Pressure Daily regardless of Empower. Neither option touches Bloodthirst or Plagued-formation-locked Dailies.',
    }), 'multitoggle', '0', null, 'Daily');
    createSetting('Ravoidempower', 'Avoid Empower',tip({
        what: 'Universe 2 twin of Avoid Empower: predicts whether the next enemy attack, boosted by your current Empower stacks, would wipe your army — and if so, retreats to the map screen just before that happens.',
        ignoredWhen: 'Bogged or Plague Dailies, which have their own health handling, or while already mapping.',
    }), 'boolean', true, null, 'Daily');
    createSetting('Rdarmormagic', ['Daily Armor Magic Off', 'DAM: Above 80%', 'DAM: H:D', 'DAM: Always'],tip({
        what: 'Universe 2 twin of Daily Armor Magic: buys armor to try to survive Bleed/Plague/Bogged Dailies once your health drops to 40% or less.',
        cannot: 'The third option, <b>DAM: Always</b>, still only buys armor once health is at or below 40% — none of the three modes buy armor pre-emptively.',
        how: '<b>Above 80%:</b> only active once your world zone is at or above 80% of your highest zone ever cleared. <b>H:D:</b> only active once your H:D ratio is at or above the H:D cutoff set in the Maps tab (i.e. you don\'t have enough damage). <b>Always:</b> active any time your health is low enough, no zone or H:D gate.',
    }), 'multitoggle', 0, null, "Daily");

    //dRaiding
    (document.getElementById('Rdarmormagic') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('RdAMPraid', ['Daily Praiding Off', 'Daily Praiding On', 'DPR: Normal'],tip({
        what: 'Master switch for Daily Prestige Raiding in Universe 2: creates Maps with the Prestige option at the zones you configure, to farm prestige gear.',
        how: '<b>DPR: On</b> uses the Daily-specific zone/raid/cell lists below (edit them via DPR Settings). <b>DPR: Normal</b> reuses your regular (non-Daily) Prestige Raiding settings from the Raiding tab instead. Example: world 95, DPR Zone [95,105], DPR Raid [105,115], DPR Cell 1 — creates Maps 101–105 with Prestige at cell 1; if a Prestige Map can\'t be afforded it tries without, then falls back to the highest affordable Map. Runs the lowest created Map first, then works up; if DPR: Recycle is on it recycles finished raid Maps afterward.',
    }), 'multitoggle', 0, null, 'Daily');
    createSetting('RdAMPraidmaz', 'Daily Praiding Settings',tip({
        what: 'Opens the Daily Prestige Raiding settings popup, where you configure the zone/raid/cell lists DPR: On uses.',
        ignoredWhen: 'Daily Prestige Raiding is off, or set to DPR: Normal.',
    }), 'infoclick', false, null, 'Daily');
    createSetting('RdAMPraidzone', 'DPR: Zone',tip({
        what: 'The zone list for Universe 2 Daily Prestige Raiding — world zones at which raiding is triggered.',
        how: 'Edited through the <b>Daily Praiding Settings</b> popup — this row is not shown directly in the settings list. Matched by position to DPR: Raid and DPR: Cell.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('RdAMPraidraid', 'DPR: Raid',tip({
        what: 'The target-Map list for Universe 2 Daily Prestige Raiding, matched by position to DPR: Zone.',
        how: 'Edited through the <b>Daily Praiding Settings</b> popup — this row is not shown directly in the settings list. Example: DPR Zone 95,105 with this set to 105,115 raids up to Map 105 from zone 95, and up to 115 from zone 105.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('RdAMPraidcell', 'DPR: Cell',tip({
        what: 'The cell list for Universe 2 Daily Prestige Raiding, matched by position to DPR: Zone — the cell within each zone at which raiding may begin.',
        how: 'Edited through the <b>Daily Praiding Settings</b> popup — this row is not shown directly in the settings list. -1 starts at cell 1.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('RdAMPraidfrag', ['DPR: Frag', 'DPR: Frag Min', 'DPR: Frag Max'],tip({
        what: 'Controls whether Daily Prestige Raiding is willing to farm fragments to afford the Prestige Map options it wants.',
        how: '<b>DPR: Frag Min</b> farms only the minimum — no Prestige special, perfect sliders, random map, and cheapest difficulty/size — while still trying to afford better options first, prioritizing raiding the most Maps in sequence. <b>DPR: Frag Max</b> farms for the best possible raid, which usually costs more time up front but can save time during the raid itself. Use Min if your heirloom lacks frag-drop/explorer-efficiency bonuses; use Max if you\'re confident in your fragment income.',
    }), 'multitoggle', 0, null, 'Daily');
    createSetting('RdAMPraidrecycle', 'DPR: Recycle',tip({
        what: 'Recycles the Maps created during Universe 2 Daily Prestige Raiding once the raid finishes.',
        ignoredWhen: 'Daily Prestige Raiding (DPR: On) is off or set to DPR: Normal.',
    }), 'boolean', false, null, 'Daily');

    //dTimefarm
    (document.getElementById('RdAMPraidrecycle') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rdtimefarm', ['Daily Time Farm Off', 'Daily Time Farm On', 'DTF: Normal'],tip({
        what: 'Master switch for Time Farming during Universe 2 Dailies: sends all your workers to gather a chosen resource in a chosen Map for a fixed number of minutes.',
        how: '<b>DTF: On</b> uses the Daily-specific settings below (edit them via DTM Settings). <b>DTF: Normal</b> reuses your regular (non-Daily) Time Farm settings from the Maps tab instead.',
    }), 'multitoggle', 0, null, 'Daily');
    createSetting('Rdtimefarmmaz', 'DTM Settings',tip({
        what: 'Opens the Daily Time Farm settings popup, where you configure the zone/cell/time/level/map/special/gather values DTF: On uses.',
        ignoredWhen: 'Daily Time Farm is off, or set to DTF: Normal.',
        how: '<b>Zone:</b> zone to start time farming. <b>Cell:</b> cell within that zone to start at. <b>Time:</b> minutes to farm. <b>Level:</b> how many +levels above your zone to use. <b>Map:</b> which Map type to farm. <b>Special:</b> which Map special to look for. <b>Gather:</b> which resource to gather. Example: Zone 60, Cell 10, Time 3, Level 5, Map Gardens, Special Large Metal Cache, Gather Metal farms metal for 3 minutes at zone 60/cell 10 in a +5 Gardens map with a Large Metal Cache, during a Daily.',
    }), 'infoclick', false, null, 'Daily');
    createSetting('Rdtimefarmzone', 'DTF: Zone',tip({
        what: 'The zone list for Universe 2 Daily Time Farm, matched by position to the other DTF: lists.',
        how: 'Edited through the <b>DTM Settings</b> popup — this row is not shown directly in the settings list.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('Rdtimefarmcell', 'DTF: Cell',tip({
        what: 'The starting-cell list for Universe 2 Daily Time Farm, matched by position to DTF: Zone.',
        how: 'Edited through the <b>DTM Settings</b> popup — this row is not shown directly in the settings list.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('Rdtimefarmtime', 'DTF: Time',tip({
        what: 'The farm-duration list (in minutes) for Universe 2 Daily Time Farm, matched by position to DTF: Zone.',
        how: 'Edited through the <b>DTM Settings</b> popup — this row is not shown directly in the settings list.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('Rdtimefarmlevel', 'DTF: Map Level',tip({
        what: 'The +level list for Universe 2 Daily Time Farm — how many levels above the farm zone the Map should be — matched by position to DTF: Zone.',
        how: 'Edited through the <b>DTM Settings</b> popup — this row is not shown directly in the settings list.',
    }), 'multiValue', [0], null, 'Daily');
    createSetting('Rdtimefarmmap', 'DTF: Map Selection',tip({
        what: 'The Map-type list for Universe 2 Daily Time Farm (e.g. Gardens), matched by position to DTF: Zone.',
        how: 'Edited through the <b>DTM Settings</b> popup — this row is not shown directly in the settings list.',
    }), 'textValue', '', null, 'Daily');
    createSetting('Rdtimefarmspecial', 'DTF: Special Selection',tip({
        what: 'The Map-special list for Universe 2 Daily Time Farm (e.g. Large Metal Cache), matched by position to DTF: Zone.',
        how: 'Edited through the <b>DTM Settings</b> popup — this row is not shown directly in the settings list.',
    }), 'textValue', '', null, 'Daily');
    createSetting('Rdtimefarmgather', 'DTF: Gather Selection',tip({
        what: 'The gathered-resource list for Universe 2 Daily Time Farm, matched by position to DTF: Zone.',
        how: 'Edited through the <b>DTM Settings</b> popup — this row is not shown directly in the settings list.',
    }), 'textValue', '', null, 'Daily');


    //Heirloom
    createSetting('dhighdmg', 'DHS: High Damage',tip({
        what: 'The name of the high-damage heirloom AT equips normally during Dailies.',
        how: 'AT swaps to this heirloom whenever Daily windstacking (Daily Windstacking must be on) decides you should be doing full damage rather than stacking Wind debuffs; see Daily Windstack Low Damage for its counterpart.',
    }), 'textValue', '', null, 'Daily');
    createSetting('dlowdmg', 'DHS: Low Damage',tip({
        what: 'The name of the low-damage heirloom AT swaps to for windstacking during Dailies.',
        how: 'AT swaps to this heirloom whenever Daily windstacking (Daily Windstacking must be on) decides you should be withholding damage to build up Wind debuff stacks; see Daily Windstack High Damage for its counterpart.',
    }), 'textValue', '', null, 'Daily');


    //RHeirloom
    (document.getElementById('dlowdmg') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rdhs', ['DHS: Off', 'DHS: On', 'DHS: Normal'],tip({
        what: 'Master switch for heirloom swapping during Universe 2 Dailies.',
        how: '<b>DHS: On</b> uses the Daily-specific shield/staff settings below. <b>DHS: Normal</b> reuses your regular (non-Daily) heirloom-swap settings instead.',
    }), 'multitoggle', 0, null, 'Daily');

    //DShield Swapping
    (document.getElementById('Rdhs') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rdhsshield', 'Daily Shields',tip({
        what: 'Turns on Shield swapping (by zone) during Universe 2 Dailies.',
        ignoredWhen: 'Daily Heirloom Swapping (Rdhs) is off or set to DHS: Normal.',
    }), 'boolean', false, null, 'Daily');
    createSetting('Rdhsz', 'DHSh: Zone',tip({
        what: 'The zone at which Universe 2 Daily shield swapping switches from your first defined heirloom to your second.',
        ignoredWhen: 'Daily Shields is off, or this is 0 or negative (in which case swapping never triggers).',
        how: 'Example: 75 equips DHSh: First below zone 75 and switches to DHSh: Second at zone 75 and above.',
    }), 'value', '-1', null, 'Daily');
    createSetting('Rdhs1', 'DHSh: First',tip({
        what: 'The name of the first Shield heirloom to equip during Universe 2 Dailies, used below the zone set in DHSh: Zone.',
    }), 'textValue', '', null, 'Daily');
    createSetting('Rdhs2', 'DHSh: Second',tip({
        what: 'The name of the second Shield heirloom to equip during Universe 2 Dailies, used at and above the zone set in DHSh: Zone.',
    }), 'textValue', '', null, 'Daily');

    //DStaff Swapping
    (document.getElementById('Rdhs2') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rdhsstaff', 'Daily Staffs',tip({
        what: 'Turns on Staff swapping (world/map/tribute) during Universe 2 Dailies.',
        ignoredWhen: 'Daily Heirloom Swapping (Rdhs) is off or set to DHS: Normal.',
    }), 'boolean', false, null, 'Daily');
    createSetting('Rdhsworldstaff', 'DHSt: World',tip({
        what: 'The name of the Staff AT equips outside of Maps during Universe 2 Dailies.',
        ignoredWhen: 'Daily Staffs is off, or you\'re currently in a Map.',
    }), 'textValue', '', null, 'Daily');
    createSetting('Rdhsmapstaff', 'DHSt: Map',tip({
        what: 'The name of the Staff AT equips while mapping during Universe 2 Dailies.',
        ignoredWhen: 'Daily Staffs is off, you\'re outside a Map, or you\'re tribute farming with DHSt: Tribute set.',
    }), 'textValue', '', null, 'Daily');
    createSetting('Rdhstributestaff', 'DHSt: Tribute',tip({
        what: 'The name of the Staff AT equips while tribute farming during Universe 2 Dailies.',
        ignoredWhen: 'Daily Staffs is off, or you\'re not currently tribute farming in a Map.',
    }), 'textValue', '', null, 'Daily');

    //Shrine - U2 (Daily)
    (document.getElementById('Rdhstributestaff') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rdshrine', ['Daily AutoShrine Off', 'Daily AutoShrine On', 'DAS: Normal'],tip({
        what: 'Turns on automatic Bone Shrine charge use during Universe 2 Dailies, using the zone/cell/amount list configured in Daily AutoShrine Settings.',
        how: 'Click <b>Daily AutoShrine Settings</b> to edit the list.',
    }), 'multitoggle', 0, null, 'Daily');
    createSetting('Rdshrinemaz', 'Daily AutoShrine Settings',tip({
        what: 'Opens the Daily AutoShrine settings popup, where you configure the zone/cell/amount list Daily AutoShrine uses.',
        how: '<b>Zone:</b> world zone to spend a charge at. <b>Cell:</b> cell within that zone to spend it at — past cell 80 you get the benefit of all Bone Shrine books. <b>Amount:</b> how many charges to spend there. Example: Zone 40, Cell 10, Amount 3 spends 3 charges at zone 40, cell 10, during a Daily.',
    }), 'infoclick', false, null, 'Daily');
    createSetting('Rdshrinezone', 'AutoShrine: Zone',tip({
        what: 'The zone list for Universe 2 Daily AutoShrine, matched by position to Daily AutoShrine\'s cell and amount lists.',
        how: 'Edited through the <b>Daily AutoShrine Settings</b> popup — this row is not shown directly in the settings list.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('Rdshrinecell', 'AutoShrine: Cell',tip({
        what: 'The cell list for Universe 2 Daily AutoShrine, matched by position to Daily AutoShrine\'s zone and amount lists.',
        how: 'Edited through the <b>Daily AutoShrine Settings</b> popup — this row is not shown directly in the settings list.',
    }), 'multiValue', [-1], null, 'Daily');
    createSetting('Rdshrineamount', 'AutoShrine: Amount',tip({
        what: 'The charge-amount list for Universe 2 Daily AutoShrine, matched by position to Daily AutoShrine\'s zone and cell lists.',
        how: 'Edited through the <b>Daily AutoShrine Settings</b> popup — this row is not shown directly in the settings list.',
    }), 'multiValue', [-1], null, 'Daily');

    //Portal Line
    (document.getElementById('Rdshrineamount') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('AutoStartDaily', 'Auto Start Daily',tip({
        what: 'Automatically starts a Daily challenge for you when you portal.',
        how: 'Selects and starts the oldest available Daily. The other settings in this tab decide what AT then does during it.',
    }), 'boolean', false, null, 'Daily');
    createSetting('u2daily', 'Daily in U2',tip({
        what: 'Tells AT that your Daily challenge should be run in Universe 2, even while your main run is in Universe 1.',
        how: 'Used together with Auto Start Daily / Universe 2\'s Auto Start Daily so AT knows which universe\'s Daily settings to follow when it portals you between universes.',
    }), 'boolean', false, null, 'Daily');
    createSetting('AutoPortalDaily', ['Daily Portal Off', 'DP: He/Hr', 'DP: Custom'],tip({
        what: 'Automatically portals you out of a Daily challenge once a condition is met.',
        how: '<b>DP: He/Hr:</b> portals once your world zone is above the minimum you\'ve set (if any) and your Helium/Hour has dropped below the buffer you\'ve defined. <b>DP: Custom:</b> portals immediately after clearing the zone set in Daily Custom Portal.',
    }), 'multitoggle', '0', null, "Daily");
    createSetting('dHeliumHourChallenge', 'DP: Challenge',tip({
        what: 'Which challenge to auto-select for your next Daily\'s He/Hr or Custom AutoPortal, once you\'ve cleared every Daily challenge currently available.',
        how: 'Portals after cell 100 of the zone you specify. Don\'t pick a challenge you haven\'t unlocked yet.',
    }), 'dropdown', 'None', ['None', 'Balance', 'Decay', 'Electricity', 'Life', 'Crushed', 'Nom', 'Toxicity', 'Watch', 'Lead', 'Corrupted', 'Domination', 'Experience'], "Daily");
    createSetting('dCustomAutoPortal', 'Daily Custom Portal',tip({
        what: 'The zone after which Daily Portal (DP: Custom) portals you out of the Daily.',
        ignoredWhen: 'Daily Portal is not set to DP: Custom.',
        how: 'Example: setting this to 200 portals the moment you first clear level 200 and reach level 201.',
    }), 'value', '999', null, "Daily");
    createSetting('dHeHrDontPortalBefore', 'D: Don\'t Portal Before',tip({
        what: 'Blocks the He/Hr Daily AutoPortal from portaling before this level is reached.',
        ignoredWhen: 'Daily Portal is not set to DP: He/Hr.',
        how: 'An extra safety check on top of the He/Hr buffer, so a normal early-game dip in Helium/Hour doesn\'t trigger a premature portal. 0 or -1 disables the check.',
    }), 'value', '999', null, "Daily");
    createSetting('dHeliumHrBuffer', 'D: He/Hr Portal Buffer %',tip({
        what: 'How far your Helium/Hour is allowed to drop below this Daily run\'s best, before Daily He/Hr AutoPortal triggers.',
        ignoredWhen: 'Daily Portal is not set to DP: He/Hr.',
        how: 'Example: 5 portals once He/Hr falls to 95% of this run\'s best. Includes stuck protection: if He/Hr falls to 5x the buffer below best (e.g. 10% under a 2% buffer), AT will portal mid-zone instead of waiting for cell 1.',
    }), 'value', '0', null, 'Daily');
    createSetting('DailyVoidMod', 'Daily Void Zone',tip({
        what: 'The zone at which AT runs Void Maps during a Daily.',
        how: '-1 disables Daily Void Maps entirely.',
    }), 'value', -1, null, 'Daily');
    createSetting('dvoidscell', 'Daily Voids Cell',tip({
        what: 'The cell at which AT starts running Void Maps during a Daily, once the Daily Void Zone is reached.',
        how: '-1 uses the built-in default of cell 70.',
    }), 'value', '-1', null, 'Daily');
    createSetting('dRunNewVoidsUntilNew', 'Daily New Voids Mod',tip({
        what: 'Lets AT run newly-obtained Void Maps above your Daily Void Zone, during a Daily, by extending how far above that zone it\'s willing to go.',
        ignoredWhen: 'Universe 2 (this setting only takes effect in Universe 1).',
        how: '0 disables it. A positive number adds that many zones on top of Daily Void Zone — example: Daily Void Zone 187 and this set to 10 runs new Voids up through zone 197. -1 removes the cap entirely. A high cap can slow you down badly by chasing Void Maps well above your normal farming zone.',
    }), 'value', '0', null, 'Daily');
    createSetting('drunnewvoidspoison', 'New Voids Poison',tip({
        what: 'Restricts Daily New Voids Mod to only run new Void Maps while you\'re in a Poison Empowerment.',
        ignoredWhen: 'Daily New Voids Mod is 0/disabled.',
    }), 'boolean', false, null, 'Daily');

    //RPortal Line
    (document.getElementById('dlowdmg') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('RAutoStartDaily', 'Auto Start Daily',tip({
        what: 'Universe 2 twin of Auto Start Daily: automatically starts a Daily challenge for you when you portal.',
        how: 'Selects and starts the oldest available Daily. The other settings in this tab decide what AT then does during it.',
    }), 'boolean', false, null, 'Daily');
    createSetting('u1daily', 'Daily in U1',tip({
        what: 'Tells AT that your Daily challenge should be run in Universe 1, even while your main run is in Universe 2.',
        how: 'Used together with Auto Start Daily so AT knows which universe\'s Daily settings to follow when it portals you between universes.',
    }), 'boolean', false, null, 'Daily');
    createSetting('RAutoPortalDaily', ['Daily Portal Off', 'DP: Rn/Hr', 'DP: Custom'],tip({
        what: 'Universe 2 twin of Daily Portal: automatically portals you out of a Daily challenge once a condition is met.',
        how: '<b>DP: Rn/Hr:</b> portals once your world zone is above the minimum you\'ve set (if any) and your Radon/Hour has dropped below the buffer you\'ve defined. <b>DP: Custom:</b> portals immediately after clearing the zone set in Daily Custom Portal.',
    }), 'multitoggle', '0', null, "Daily");
    createSetting('RdHeliumHourChallenge', 'DP: Challenge',tip({
        what: 'Which challenge to auto-select for your next Universe 2 Daily\'s Rn/Hr or Custom AutoPortal, once you\'ve cleared every Daily challenge currently available.',
        how: 'Portals after cell 100 of the zone you specify. Don\'t pick a challenge you haven\'t unlocked yet.',
    }), 'dropdown', 'None', ['None', 'Bublé', 'Melt', 'Quagmire', 'Archaeology', 'Insanity', 'Nurture', 'Alchemy', 'Hypothermia'], "Daily");
    createSetting('RdCustomAutoPortal', 'Daily Custom Portal',tip({
        what: 'The zone after which Universe 2\'s Daily Portal (DP: Custom) portals you out of the Daily.',
        ignoredWhen: 'Universe 2\'s Daily Portal is not set to DP: Custom.',
        how: 'Example: setting this to 200 portals the moment you first clear level 200 and reach level 201.',
    }), 'value', '999', null, "Daily");
    createSetting('RdHeHrDontPortalBefore', 'D: Don\'t Portal Before',tip({
        what: 'Blocks Universe 2\'s Rn/Hr Daily AutoPortal from portaling before this level is reached.',
        ignoredWhen: 'Universe 2\'s Daily Portal is not set to DP: Rn/Hr.',
        how: 'An extra safety check on top of the Rn/Hr buffer, so a normal early-game dip in Radon/Hour doesn\'t trigger a premature portal. 0 or -1 disables the check.',
    }), 'value', '999', null, "Daily");
    createSetting('RdHeliumHrBuffer', 'D: Rn/Hr Portal Buffer %',tip({
        what: 'How far your Radon/Hour is allowed to drop below this Daily run\'s best, before Universe 2\'s Daily Rn/Hr AutoPortal triggers.',
        ignoredWhen: 'Universe 2\'s Daily Portal is not set to DP: Rn/Hr.',
        how: 'Example: 5 portals once Rn/Hr falls to 95% of this run\'s best. Includes stuck protection: if Rn/Hr falls to 5x the buffer below best (e.g. 10% under a 2% buffer), AT will portal mid-zone instead of waiting for cell 1.',
    }), 'value', '0', null, 'Daily');
    createSetting('RDailyVoidMod', 'Daily Void Zone',tip({
        what: 'The zone at which AT runs Void Maps during a Universe 2 Daily.',
        how: '-1 disables Daily Void Maps entirely.',
    }), 'value', -1, null, 'Daily');
    createSetting('RdRunNewVoidsUntilNew', 'Daily New Voids Mod',tip({
        what: 'Lets AT run newly-obtained Void Maps above your Universe 2 Daily Void Zone, during a Daily, by extending how far above that zone it\'s willing to go.',
        cannot: 'Unlike the Universe 1 twin, there is no Poison-only restriction for this setting — it runs new Voids regardless of Empowerment.',
        how: '0 disables it. A positive number adds that many zones on top of Daily Void Zone. -1 removes the cap entirely. A high cap can slow you down badly by chasing Void Maps well above your normal farming zone.',
    }), 'value', '0', null, 'Daily');



    //C2

    //Line 1
    createSetting('FinishC2', 'Finish Challenge2',tip({
        what: 'Ends whatever Challenge² run is active once you reach this zone, then abandons it (portals out).',
        how: '<b>Do not combine with C2 Runner.</b> C2 Runner\'s own <b>C2 Runner Portal</b> zone can abandon the same run at a different target, and the two will race each other. Set to -1 to disable.',
        ignoredWhen: 'No Challenge² is currently running — it has no effect on a normal run.',
    }), 'value', -1, null, 'C2');
    createSetting('buynojobsc', 'No F/L/M in C2',tip({
        what: 'Named "No F/L/M in C2" — but nothing in AutoTrimps reads this setting. Toggling it does nothing.',
    }), 'boolean', false, null, "C2");
    createSetting('cfightforever', 'Tox/Nom Fight Always',tip({
        what: 'Forces trimps to fight during the Electricity, Toxicity and Nom Challenge² runs, even when they would otherwise sit idle — ignoring your Better Auto Fight setting.',
        how: 'Works the same way as <b>Fight Forever</b> (H:D) in the Combat tab, just scoped to only these three Challenge²s.',
        ignoredWhen: 'You are not running the Electricity, Toxicity or Nom Challenge² — it has no effect anywhere else, including Dailies (use <b>Daily Fight Always</b> for those).',
    }), 'boolean', false, null, 'C2');
    createSetting('carmormagic', ['C2 Armor Magic Off', 'CAM: Above 80%', 'CAM: H:D', 'CAM: Always'],tip({
        what: 'Buys emergency Armor to avoid dying while running the Toxicity or Nom Challenge², once your health drops to 40% of max.',
        how: '<b>Above 80%:</b> only once your world zone has reached 80% of your highest zone cleared.<br><b>H:D:</b> only once your H:D ratio (enemy health ÷ your damage) is at or above the cutoff you set in <b>Mapology H:D</b> — i.e. once you genuinely don\'t have enough damage.<br><b>Always:</b> active for the whole run.<br>All three still wait for the 40% health trigger before buying.',
        ignoredWhen: 'You are not running the Toxicity or Nom Challenge² — it has no effect anywhere else, including Dailies (use <b>Daily Armor Magic</b> for those).',
    }), 'multitoggle', 0, null, "C2");
    createSetting('Rcarmormagic', ['C2 Armor Magic Off', 'CAM: Above 80%', 'CAM: H:D', 'CAM: Always'],tip({
        what: 'Buys emergency Armor to avoid dying while running the Toxicity or Nom Challenge² in Universe 2, once your health drops to 40% of max.',
        how: '<b>Above 80%:</b> only once your world zone has reached 80% of your highest zone cleared.<br><b>H:D:</b> only once your H:D ratio (enemy health ÷ your damage) is at or above the cutoff you set in <b>Mapology H:D</b> — i.e. once you genuinely don\'t have enough damage.<br><b>Always:</b> active for the whole run.<br>All three still wait for the 40% health trigger before buying.',
        ignoredWhen: 'You are not running the Toxicity or Nom Challenge² in Universe 2 — it has no effect anywhere else, including Dailies (use <b>Daily Armor Magic</b> for those).',
    }), 'multitoggle', 0, null, "C2");
    createSetting('mapc2hd', 'Mapology H:D',tip({
        what: 'Overrides your map damage cutoff during the Mapology Challenge².',
        how: 'AT compares your H:D ratio (enemy health ÷ your damage) against this value; it only enters maps once that ratio drops below it. A higher number is more lenient — AT is willing to map with worse H:D. Set to -1 to use the normal, non-Mapology map cutoff instead.',
        ignoredWhen: 'You are not running the Mapology Challenge².',
    }), 'value', '-1', null, 'C2');
    createSetting('novmsc2', 'No VMs',tip({
        what: 'Stops AT from running Void Maps while any Challenge² is active.',
        how: 'Handy with C2 Runner, so Void Maps don\'t interrupt a sequence of Challenge² runs.',
        ignoredWhen: 'No Challenge² is currently running.',
    }), 'boolean', false, null, "C2");

    //C2 Runner Line
    (document.getElementById('novmsc2') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('c2runnerstart', 'C2 Runner',tip({
        what: 'Runs your Challenge²s automatically, one after another, working through whichever ones need updating most.',
        how: 'Each portal, it compares every unlocked Challenge²\'s own highest zone against your overall highest zone cleared, as a percentage, and starts whichever one is furthest behind — skipping Challenge²s that are already close to your HZE. Needs <b>C2 Runner Portal</b> and <b>C2 Runner %</b> both set to take effect. Avoid manually abandoning or switching Challenge²s while this is running.',
    }), 'boolean', false, null, 'C2');
    createSetting('c2runnerportal', 'C2 Runner Portal',tip({
        what: 'The zone C2 Runner abandons the current Challenge² and portals at.',
        how: 'AT abandons once your world zone passes this number (e.g. 200 portals after first reaching zone 201).',
        ignoredWhen: '<b>C2 Runner</b> is off.',
    }), 'value', '999', null, "C2");
    createSetting('c2runnerpercent', 'C2 Runner %',tip({
        what: 'The completeness threshold C2 Runner uses to decide which Challenge² needs running next.',
        how: 'For each Challenge², AT computes (that Challenge²\'s highest zone ÷ your overall highest zone cleared) × 100. Any Challenge² below this percentage is considered behind and becomes a candidate to run. E.g. 85 only picks Challenge²s under 85% of your HZE.',
        ignoredWhen: '<b>C2 Runner</b> is off, or <b>C2 Runner Portal</b> is not set.',
    }), 'value', '85', null, "C2");
    createSetting('c2table', 'C2 Table',tip({
        what: 'Opens a table of all your Challenge² and Challenge³ runs, color-coded by how worth updating each one is.',
        how: '<b>Green</b> = not worth updating. <b>Yellow</b> = consider updating. <b>Red</b> = worth updating now. <b>Blue</b> = not yet unlocked or completed.',
    }), 'infoclick', 'c2table', null, 'C2');



    //Buildings

    //Line 1
    createSetting('hidebuildings', 'Hide Buildings',tip({
        what: 'Hands ordinary building purchases (housing, storage, Wormholes, Tributes, Nurseries) over to the game\'s own AutoStructure mastery instead of AT buying them.',
        how: 'Only takes effect when <b>Buy Buildings</b> is set to <b>Buy Neither</b> \u2014 with any other Buy Buildings option, AT keeps buying those buildings regardless of this setting.',
        cannot: 'Cannot hide or affect Gym purchases. AutoStructure has no Gym automation of its own, so AT keeps buying Gyms (per <b>Max Gyms</b> / <b>Gym Wall</b>) even with this on \u2014 that\'s also why the Gym settings stay visible either way.',
    }), 'boolean', false, null, "Buildings");
    createSetting('BuyBuildingsNew', ['Buy Neither', 'Buy Buildings & Storage', 'Buy Buildings', 'Buy Storage'],tip({
        what: 'Controls whether AT buys non-storage Buildings (Huts, Warpstations, Gateways, Nurseries, etc.), Storage (Barn/Shed/Forge), both, or neither.',
        how: '<b>Buy Buildings & Storage</b> runs both automations. <b>Buy Buildings</b> buys non-storage buildings only \u2014 hand Storage to the game\'s own AutoStorage instead. <b>Buy Storage</b> buys Storage only. <b>Buy Neither</b> stops both (Gyms are the one exception \u2014 see <b>Hide Buildings</b>).<br><br>Storage purchases anticipate Jestimp and buy shortly before a resource would overflow, rather than waiting for it to actually cap out.',
    }), 'multitoggle', 1, null, "Buildings");
    createSetting('PurchaseCoordinator', 'Purchase Coordinator',tip({
        what: 'EXPERIMENTAL (#57). Makes AT save metal toward a high-value purchase instead of always spending it on whatever is affordable right now.',
        how: 'Today it only reserves metal toward your next Warpstation when Coordination is pending and you still need the population it grants \u2014 every other building purchase still runs first-come-first-served. Turning it on with no Coordination pending is a no-op. Turning it OFF gives exactly the behavior AT has always had.',
        cannot: 'Cannot reserve for anything else yet \u2014 there is no general priority list, just this one Warpstation-for-Coordination case.',
    }), 'boolean', false, null, "Buildings");
    createSetting('WarpstationCap', 'Warpstation Cap',tip({
        what: 'Stops AT from leveling Warpstations past what your current Gigastation cycle needs.',
        how: 'The cap is <b>First Gigastation</b> + (Gigastations owned &times; <b>Delta Gigastation</b>). It only starts enforcing once you\'ve bought your first Gigastation (or <b>Auto Gigas</b> is off) \u2014 before that, Warpstations build up uncapped.',
        ignoredWhen: '<b>Buy Warp to Hit Coord</b> can still buy a capped-out Warpstation anyway, if doing so would close the population gap for your next Coordination.',
    }), 'boolean', true, null, 'Buildings');
    createSetting('WarpstationCoordBuy', 'Buy Warp to Hit Coord',tip({
        what: 'Lets AT buy a Warpstation that <b>Warpstation Cap</b> or <b>Warpstation Wall</b> would otherwise block, if that purchase gets you the population you need for your next Coordination.',
        ignoredWhen: 'Neither <b>Warpstation Cap</b> nor <b>Warpstation Wall</b> is currently blocking a Warpstation purchase \u2014 there is nothing for this to override.',
    }), 'boolean', true, null, 'Buildings');
    createSetting('MaxHut', 'Max Huts',tip({
        what: 'Caps how many Huts AT will build.',
        how: '0 or lower removes the cap entirely.',
    }), 'value', '100', null, "Buildings");
    createSetting('MaxHouse', 'Max Houses',tip({
        what: 'Caps how many Houses AT will build.',
        how: '0 or lower removes the cap entirely.',
    }), 'value', '100', null, "Buildings");
    createSetting('MaxMansion', 'Max Mansions',tip({
        what: 'Caps how many Mansions AT will build.',
        how: '0 or lower removes the cap entirely.',
    }), 'value', '100', null, "Buildings");
    createSetting('MaxHotel', 'Max Hotels',tip({
        what: 'Caps how many Hotels AT will build.',
        how: '0 or lower removes the cap entirely.',
    }), 'value', '100', null, "Buildings");

    //Line 2
    createSetting('MaxResort', 'Max Resorts',tip({
        what: 'Caps how many Resorts AT will build.',
        how: '0 or lower removes the cap entirely.',
    }), 'value', '100', null, "Buildings");
    createSetting('MaxGateway', 'Max Gateways',tip({
        what: 'Caps how many Gateways AT will build.',
        how: '-1 = no cap.',
    }), 'value', '25', null, "Buildings");
    createSetting('MaxWormhole', 'Max Wormholes',tip({
        what: 'Caps how many Wormholes AT will build.',
        cannot: 'Cannot be set to "unlimited" the way the other Max settings can \u2014 there is no -1 sentinel here. 0 or lower means AT never buys a Wormhole at all; you must set a specific positive number to allow any.',
        how: 'Wormholes cost <b>helium</b>, not gold \u2014 a Wormhole bought is helium you can\'t spend on perks that portal.',
    }), 'value', '0', null, "Buildings");
    createSetting('MaxCollector', 'Max Collectors',tip({
        what: 'Caps how many Collectors AT will build.',
        how: '-1 = no cap.',
    }), 'value', '-1', null, "Buildings");
    createSetting('MaxGym', 'Max Gyms',tip({
        what: 'Caps how many Gyms AT will build.',
        how: '-1 = no cap.',
        ignoredWhen: 'You are playing Universe 2 (Radon) \u2014 AT has no Gym automation there at all; this setting (and <b>Gym Wall</b>) only affects Universe 1.',
    }), 'value', '-1', null, "Buildings");
    createSetting('MaxTribute', 'Max Tributes',tip({
        what: 'Caps how many Tributes AT will build.',
        how: '-1 = no cap.',
    }), 'value', '-1', null, "Buildings");
    createSetting('GymWall', 'Gym Wall',tip({
        what: 'Slows Gym buying to conserve wood \u2014 only buys 1 Gym at a time once you can afford <b>X</b> Gyms\' worth of wood (at the first one\'s price), instead of AT\'s normal bulk-buy amount.',
        how: 'Takes decimals. In other words, only allows a Gym purchase once it costs less than 1/X of your current wood \u2014 handy for saving wood for Nurseries once you\'re on the z230+ Magma nursery strategy.',
        cannot: 'Cannot be fully disabled with -1 the way its own convention elsewhere suggests: JS treats -1 as "on", so the default value of -1 still forces Gym purchases down to 1 at a time, even though the wood-wall math itself is skipped. Only <b>0</b> restores AT\'s normal bulk-buy amount for Gyms.',
        ignoredWhen: 'You are playing Universe 2 (Radon) \u2014 Gyms are not automated there at all.',
    }), 'value', -1, null, 'Buildings'); //remove?

    //Line 3
    // #107 — both of these are written back by firstGiga() (upgrades.ts:132) whenever Auto Gigas is on,
    // which it is BY DEFAULT. The solver computes a base and delta and stores its answer here, so for most
    // users these boxes report what AT decided rather than accepting what they typed. Neither said so.
    const GIGA_OVERWRITE = 'While <b>Auto Gigas</b> is on (the default), AT computes this itself when it buys your first Gigastation of a run and writes its answer back here — overwriting what you typed. Turn <b>Auto Gigas</b> off to drive it by hand.';
    createSetting('FirstGigastation', 'First Gigastation', tip({
        what: 'How many Warpstations to buy before your first Gigastation.',
        overwritten: GIGA_OVERWRITE,
    }), 'value', '20', null, "Buildings");
    createSetting('DeltaGigastation', 'Delta Gigastation', tip({
        what: 'How many extra Warpstations to buy for each Gigastation after the first.',
        overwritten: GIGA_OVERWRITE,
        ignoredWhen: 'Buying upgrades is off — Gigastations are an upgrade, so nothing is bought at all.',
        how: 'Decimals are supported: <b>2.5</b> buys +2 / +3 / +2 / +3…',
    }), 'value', '2', null, "Buildings");
    createSetting('AutoGigas', 'Auto Gigas',tip({
        what: 'Automates buying your first Gigastation of a run and calculates the Warpstation pattern (<b>First</b> / <b>Delta Gigastation</b>) to use for the rest of it.',
        how: 'Buys the first Gigastation once: A) you have more than 2 Warpstations, B) you can\'t afford more Coordination, C) (only if <b>Custom Delta Factor</b> is above 20) you\'re lacking health or damage, and D) (only if <b>Custom Delta Factor</b> is above 20) you\'ve run at least one map stack \u2014 or the console is used to force it.<br><br>It then computes the delta from <b>Custom Delta Factor</b> against your Auto Portal / Void Maps zone (whichever is higher), or the Daily / C2 equivalent, or <b>Custom Target Zone</b> if set.',
        ignoredWhen: '<b>Buy Upgrades</b> is set to Manual \u2014 no upgrade purchases happen at all, Gigastation included. Also ignored while <b>Buy Buildings</b> is Buy Neither with <b>Hide Buildings</b> on: Gigastation purchases are skipped in that combination too.',
    }), 'boolean', true, null, 'Buildings');
    createSetting('CustomTargetZone', 'Custom Target Zone',tip({
        what: 'The target zone Auto Gigas uses when calculating its Warpstation delta, instead of letting AT guess one from your portal/void settings.',
        cannot: 'Values below 60 are silently discarded \u2014 AT falls back to computing its own target zone.',
        ignoredWhen: 'Only matters for your FIRST Gigastation of a run \u2014 Auto Gigas computes a pattern once, when <b>Gigastation</b> is still at 0.',
    }), 'value', '-1', null, "Buildings");
    createSetting('CustomDeltaFactor', 'Custom Delta Factor',tip({
        what: 'Tunes how aggressively Auto Gigas\' delta grows \u2014 think of it as how long your target zone takes to clear, divided by the zone you bought your first Gigastation in.',
        how: 'A higher number means a higher delta. <b>Recommended range from the community:</b> 1-2 for very quick runs, 5-10 for regular runs that slow down at the end, 20-100+ for very pushy runs. Above 20 it also unlocks the health/damage and map-stack conditions on <b>Auto Gigas</b> itself (see its tooltip).',
        cannot: 'Values below 1 are silently discarded \u2014 AT uses 10 instead.',
        ignoredWhen: 'Only matters for your FIRST Gigastation of a run \u2014 Auto Gigas computes a pattern once, when <b>Gigastation</b> is still at 0.',
    }), 'value', '-1', null, "Buildings");
    createSetting('WarpstationWall3', 'Warpstation Wall',tip({
        what: 'Slows Warpstation buying to conserve metal \u2014 only buys a Warpstation once you can afford <b>X</b> Warpstations\' worth of metal (at the current price), so metal piles up for prestiges instead.',
        how: 'In other words, only allows a purchase once it costs less than 1/X of your current metal.',
        cannot: '-1, 0, or 1 all disable it \u2014 it only starts conserving above 1.',
        ignoredWhen: '<b>Buy Warp to Hit Coord</b> is on and buying the Warpstation would close your Coordination population gap \u2014 that overrides the wall for that one purchase.',
    }), 'value', -1, null, 'Buildings');
    createSetting('MaxNursery', 'Max Nurseries',tip({
        what: 'Caps how many Nurseries AT will build.',
        how: '-1 = no cap. Nurseries only become worth stacking once you\'ve reached Magma (zone 230+) \u2014 pair with <b>No Nurseries Until z</b> to gate when AT starts building them at all.',
    }), 'value', '-1', null, "Buildings");

    //Line 4
    createSetting('NurseryWall', 'Nursery Wall',tip({
        what: 'Withholds a percentage of your wood, gems, and metal from Nursery purchases, so one big Nursery buy can\'t eat resources you need elsewhere that tick.',
        how: 'Set N and AT only spends up to N% of your <i>current</i> wood/gems/metal on a single Nursery purchase \u2014 if the Nursery would cost more than that share of any one of those resources, AT skips buying it that tick.',
        cannot: '0 or lower disables the wall entirely (no percentage cap).',
    }), 'value', -1, null, 'Buildings');
    createSetting('NoNurseriesUntil', 'No Nurseries Until z',tip({
        what: 'Builds Nurseries starting from this zone, not before.',
        how: '-1 builds them as soon as they unlock.',
        ignoredWhen: 'Overridden by <b>Nurseries pre-Spire</b> while you are farming for or already in a Spire \u2014 that setting can build Nurseries earlier to prepare, regardless of this zone.',
    }), 'value', '-1', null, 'Buildings');

    //RBuildings

    //Line 1
    createSetting('RBuyBuildingsNew', 'AutoBuildings',tip({
        what: 'Buys buildings for Universe 2 (Radon): Housing, Tributes, Smithy, Microchip, Labs, and Storage during Hypothermia.',
        how: 'Also force-enables the game\'s own AutoStorage once, the first time it finds it off, so your resources don\'t overflow while you\'re setting up \u2014 after that one nudge it leaves your AutoStorage button alone, even if you turn AutoStorage back off yourself.',
        cannot: 'Unlike Universe 1\'s <b>Buy Buildings</b>, this is a single on/off switch \u2014 there is no "buildings but not storage" split in Universe 2.',
    }), 'boolean', true, null, "Buildings");
    createSetting('RMaxHut', 'Max Huts',tip({
        what: 'Caps how many Huts AT will build.',
        how: '-1 = no cap.',
    }), 'value', '100', null, "Buildings");
    createSetting('RMaxHouse', 'Max Houses',tip({
        what: 'Caps how many Houses AT will build.',
        how: '-1 = no cap.',
    }), 'value', '100', null, "Buildings");
    createSetting('RMaxMansion', 'Max Mansions',tip({
        what: 'Caps how many Mansions AT will build.',
        how: '-1 = no cap.',
    }), 'value', '100', null, "Buildings");
    createSetting('RMaxHotel', 'Max Hotels',tip({
        what: 'Caps how many Hotels AT will build.',
        how: '-1 = no cap.',
    }), 'value', '100', null, "Buildings");
    createSetting('RMaxResort', 'Max Resorts',tip({
        what: 'Caps how many Resorts AT will build.',
        how: '-1 = no cap.',
    }), 'value', '100', null, "Buildings");
    createSetting('RMaxGateway', 'Max Gateways',tip({
        what: 'Caps how many Gateways AT will build.',
        how: '-1 = no cap.',
    }), 'value', '25', null, "Buildings");

    //Line 2
    createSetting('RMaxCollector', 'Max Collectors',tip({
        what: 'Caps how many Collectors AT will build.',
        how: '-1 = no cap.',
    }), 'value', '-1', null, "Buildings");
    createSetting('RMaxTribute', 'Max Tributes',tip({
        what: 'Caps how many Tributes AT will build.',
        how: '-1 = no cap. Tributes cost food only.',
    }), 'value', '-1', null, "Buildings");
    createSetting('RMaxLabs', 'Max Labs',tip({
        what: 'Caps how many Laboratories AT will build.',
        how: '-1 = no cap.',
        ignoredWhen: 'The <b>Nurture</b> setting (Challenges tab) is off \u2014 AT does not build Laboratories at all without it.',
    }), 'value', '0', null, "Buildings");
    createSetting('Rmeltsmithy', 'Melt Smithy',tip({
        what: 'Lets AT re-run the Melting Point map once you own at least this many Smithies, to farm one extra free Smithy.',
        how: '-1 disables it. Only applies once the Melting Point map\'s free-Smithy reward is available to run again.',
    }), 'value', '-1', null, "Buildings");
    createSetting('Rsmithylogic', 'Smithy Savings',tip({
        what: 'Smithy Savings \u2014 withholds a purchase when it\'s both small relative to your next Smithy\'s price and that Smithy is close to affordable, so resources pile up toward the Smithy instead.',
        how: 'Requires <b>SS: Number</b>, <b>SS: Percent</b>, and <b>SS: Seconds</b> to all be set above 0 to activate at all.',
        cannot: 'Only affects <b>weapon and armor purchases</b> in practice. The underlying logic has branches for buildings too (Huts, Houses, Gateways...), but nothing in AT currently calls it for a building purchase, so those branches never run.',
    }), 'boolean', false, null, "Buildings");
    createSetting('Rsmithynumber', 'SS: Number',tip({
        what: 'Smithy Savings only starts withholding purchases once you own at least this many Smithies \u2014 below it, every purchase goes through as normal.',
        how: 'Example: set to 9 and AT buys freely until your 9th Smithy, then starts saving for the 10th.',
    }), 'value', '-1', null, "Buildings");
    createSetting('Rsmithypercent', 'SS: Percent',tip({
        what: 'Smithy Savings only withholds a purchase if it costs more than this percent of your next Smithy\'s price, in whichever resource the purchase shares with the Smithy.',
        how: 'Example: 1 means only purchases costing 1% or less of the Smithy\'s price are still allowed through once Smithy Savings is active.',
    }), 'value', '-1', null, "Buildings");
    createSetting('Rsmithyseconds', 'SS: Seconds',tip({
        what: 'How close (in seconds, at your current income) you need to be to affording your next Smithy before Smithy Savings starts withholding other purchases.',
        how: 'Example: 120 means Smithy Savings only kicks in once your Smithy is 120 seconds away from being affordable in wood, metal, or gems.',
    }), 'value', '-1', null, "Buildings");



    //Jobs

    //Line 1
    createSetting('fuckjobs', 'Hide Jobs',tip({
        what: 'Hides the Farmer / Lumberjack / Miner / Scientist / Max Explorers / Max Trainers boxes once they stop mattering.',
        how: 'Needs two things at once: the <b>AutoJobs</b> Bone Shrine mastery bought, and <b>Buy Jobs</b> set to <b>Don\'t Buy Jobs</b> (AutoJobs replaces this automation entirely once both are true).',
    }), 'boolean', false, null, "Jobs");
    createSetting('BuyJobsNew', ['Don\'t Buy Jobs', 'Auto Worker Ratios', 'Manual Worker Ratios'], tip({
        what: 'Hires Farmers, Lumberjacks and Miners for you.',
        how: '<b>Auto Worker Ratios</b> picks the split for you from this table, and rewrites the three ratio boxes below every tick:<br>' +
            ratioTiers() +
            '<br><br>The Watch challenge forces the bottom row; the Metal challenge forces 4 / 5 / 0.<br><br>' +
            '<b>Manual Worker Ratios</b> uses the three boxes below as you set them. Give them three <i>different</i> values — two equal ratios can put the bot in a hire/fire loop.',
        cannot: 'While this is on you cannot assign workers by hand — the bot will undo you. Choose <b>Don\'t Buy Jobs</b> to take over.',
    }), 'multitoggle', 1, null, "Jobs");
    createSetting('AutoMagmamancers', 'Auto Magmamancers',tip({
        what: 'Auto-hires Magmamancers once you\'ve spent a while sitting on the current zone.',
        how: 'Fires after the current zone has been active for 10 minutes (5 minutes with the Magmamancer talent), spending up to 10% of your gems on hires. That 10%-of-gems spend then repeats every further 10 minutes on the same zone.',
        cannot: 'Can eat into gems you were saving for something else &mdash; it does not check what else you might want them for.',
    }), 'boolean', true, null, 'Jobs');
    // #106/#107: these three had an EMPTY description. Two facts had to be said out loud and neither was:
    // only the PROPORTIONS matter (the bot divides each by the sum of all three, so 1.1/1.15/1.2 and
    // 110/115/120 are the same setting), and in the DEFAULT mode workerRatios() overwrites all three
    // every tick, so anything typed here dies within ~100ms.
    const ratioTip = (job: string, mode: string) => tip({
        what: job + '\'s share of your Farmer / Lumberjack / Miner workforce.',
        overwritten: 'In <b>' + mode + '</b> mode (the default) AutoTrimps rewrites this box every tick from its own table, so a value you type here is discarded. Switch <b>Buy Jobs</b> to <b>Manual Worker Ratios</b> to set it yourself.',
        how: '<b>Only the proportions matter.</b> Each is divided by the sum of all three, so <b>1 / 1 / 1</b>, <b>10 / 10 / 10</b> and <b>33 / 33 / 33</b> are the same setting. The live percentage is shown on the button.',
    });
    createSetting('FarmerRatio', 'Farmer Ratio', ratioTip('Farmer', 'Auto Worker Ratios'), 'value', '1', null, "Jobs");
    createSetting('LumberjackRatio', 'Lumberjack Ratio', ratioTip('Lumberjack', 'Auto Worker Ratios'), 'value', '1', null, "Jobs");
    createSetting('MinerRatio', 'Miner Ratio', ratioTip('Miner', 'Auto Worker Ratios'), 'value', '1', null, "Jobs");
    // #106 — the scientist share was a HIDDEN constant (MODULES.jobs.scientistRatio = 25, i.e. ~4%) with
    // no setting at all; MaxScientists is a CAP and can only ever LOWER the count. Worse, no fixed value
    // can be right: your manual-gather rate DOUBLES with every Speedbook while a scientist's output is
    // flat, so the "correct" share climbs exponentially through a run. Hence a percentage, not a constant.
    // ⚠️ U1 AND U2 DO NOT BEHAVE THE SAME HERE, and a single shared tip got this WRONG (caught in review).
    // U1's buyJobs() only ever calls safeFireJob() on Farmer/Lumberjack/Miner — never Scientist — so the
    // setting is add-only and a value below your current count is inert. U2's RbuyJobs() instead treats
    // Scientist as an ordinary member of `ratioWorkers = [Farmer, Lumberjack, Miner, Scientist]`
    // (jobs.ts:615) and its rebalance loop FIRES any worker whose desired count goes negative
    // (jobs.ts:774) — so in U2 lowering this, or setting 0, actively fires Scientists.
    const SCI_TIP_U1 = tip({
        what: 'What share of your Farmer / Lumberjack / Miner workforce should be Scientists.',
        cannot: '<b>Only ADD scientists, never remove them.</b> In Universe 1 AutoTrimps never fires a Scientist, so a value BELOW the count you already have does nothing at all. (Auto gives ~9% until you have 100 Farmers — so setting 5% early looks like it did nothing. It did: you already had more.)',
        how: '<b>-1</b> = Auto: the built-in table (~4% normally, ~9% before 100 Farmers, ~1% past zone 300).<br><b>0</b> = hire no more Scientists; the ones you have stay.<br><b>1-90</b> = that percent. The rest is split between Farmer / Lumberjack / Miner by their ratios above.',
        noSpeedup: true,
    });
    const SCI_TIP_U2 = tip({
        what: 'What share of your Farmer / Lumberjack / Miner workforce should be Scientists.',
        cannot: '<b>Unlike Universe 1, this DOES fire Scientists.</b> U2 rebalances all four worker types together, so lowering this below the share you currently have will fire Scientists down to it — and <b>0</b> fires <i>every</i> Scientist you own.',
        how: '<b>-1</b> = Auto: the built-in share (~4%).<br><b>0</b> = no Scientists at all (existing ones are fired).<br><b>1-90</b> = that percent. The rest is split between Farmer / Lumberjack / Miner by their ratios above.',
        noSpeedup: true,
    });
    createSetting('ScientistPercent', 'Scientist %', SCI_TIP_U1, 'valueNegative', '-1', null, "Jobs");
    // #107 — the old text ("Cap your scientists… recommend -1 (infinite still controls itself)") is
    // technically true and reliably misread: users take it for a TARGET and try to raise their scientist
    // count with it. It is a ceiling and only ever lowers. That misconception is what produced #106.
    const capTip = (job: string, extra?: string) => tip({
        what: 'Hard ceiling on how many ' + job + ' AutoTrimps will keep.',
        cannot: '<b>This is a cap, not a target.</b> It can only ever LOWER the count — raising it never hires anyone.' + (extra ?? ''),
        how: '<b>-1</b> = no cap. An exact number caps at that many.',
    });
    createSetting('MaxScientists', 'Max Scientists', capTip('Scientists', ' To hire <i>more</i> Scientists, use <b>Scientist %</b>.'), 'value', '-1', null, "Jobs");
    createSetting('MaxExplorers', 'Max Explorers', capTip('Explorers'), 'value', '-1', null, "Jobs");

    //Line 2
    createSetting('MaxTrainers', 'Max Trainers', capTip('Trainers'), 'value', '-1', null, "Jobs");


    //RJobs

    //Line 1
    // #107 — the U2 twin is NOT identical to U1, though its tooltip used to be byte-for-byte the same
    // string. RworkerRatios()/RbuyJobs() are additionally gated on the Quest challenge (AutoTrimps2.js:497:
    // `!(challengeActive == "Quest" && world > 5)`), so in Quest past zone 5 U2 job automation stops
    // entirely — and the challenge override is Transmute here, not Watch/Metal. Say the U2 truth in U2.
    createSetting('RBuyJobsNew', ['Don\'t Buy Jobs', 'Auto Worker Ratios', 'Manual Worker Ratios'], tip({
        what: 'Hires Farmers, Lumberjacks and Miners for you.',
        ignoredWhen: 'During the <b>Quest</b> challenge past zone 5, AutoTrimps stops buying jobs entirely, whatever this is set to.',
        how: '<b>Auto Worker Ratios</b> picks the split for you from this table, and rewrites the three ratio boxes below every tick:<br>' +
            ratioTiers() +
            '<br><br>The Transmute challenge forces 4 / 5 / 0.<br><br>' +
            '<b>Manual Worker Ratios</b> uses the three boxes below as you set them. Give them three <i>different</i> values — two equal ratios can put the bot in a hire/fire loop.',
        cannot: 'While this is on you cannot assign workers by hand — the bot will undo you. Choose <b>Don\'t Buy Jobs</b> to take over.',
    }), 'multitoggle', 1, null, "Jobs");
    createSetting('RFarmerRatio', 'Farmer Ratio', ratioTip('Farmer', 'Auto Worker Ratios'), 'value', '1', null, "Jobs");
    createSetting('RLumberjackRatio', 'Lumberjack Ratio', ratioTip('Lumberjack', 'Auto Worker Ratios'), 'value', '1', null, "Jobs");
    createSetting('RMinerRatio', 'Miner Ratio', ratioTip('Miner', 'Auto Worker Ratios'), 'value', '1', null, "Jobs");
    // #106 — the U2 twin. RbuyJobs uses a DIFFERENT allocator (a weight vector, not a divisor), so its
    // built-in share is ~4% via `1 / (1 + mod*(Rf+Rl+Rm))` rather than TDW/25. Same setting semantics.
    createSetting('RScientistPercent', 'Scientist %', SCI_TIP_U2, 'valueNegative', '-1', null, "Jobs");
    createSetting('RMaxExplorers', 'Max Explorers', capTip('Explorers'), 'value', '-1', null, "Jobs");

    //Ships
    (document.getElementById('RMaxExplorers') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rshipfarmon', 'Ship Farming',tip({
        what: 'Turns Ship Farming on: parks AT on Worshipper-farming maps at the zones you set below instead of normal map farming.',
        cannot: 'Requires <b>Large Savory Cache</b> unlocked. Use Time Farm instead if you don\'t have it yet.',
    }), 'boolean', false, null, "Jobs");
    createSetting('Rshipfarmzone', 'SF: Zone',tip({
        what: 'Which zones to Ship Farm at, paired position-by-position with <b>SF: Amount</b> below.',
        how: 'Example: <b>59, 61, 62</b> Ship Farms at those three zones in turn, each stopping once its own SF: Amount target is reached.',
    }), 'multiValue', [-1], null, 'Jobs');
    createSetting('Rshipfarmcell', 'SF: Cell',tip({
        what: 'Cell to start Ship Farming at, once you reach an SF zone.',
        how: '<b>-1</b> starts at cell 1.',
    }), 'value', '-1', null, 'Jobs');
    createSetting('Rshipfarmamount', 'SF: Amount',tip({
        what: 'How many Worshippers to farm up to at each SF zone, paired position-by-position with <b>SF: Zone</b>.',
        how: 'Example: zones <b>59, 61</b> with amounts <b>50, 45</b> farms z59 up to 50 Worshippers, then z61 up to 45.',
    }), 'multiValue', [-1], null, 'Jobs');
    createSetting('Rshipfarmlevel', 'SF: Map Level',tip({
        what: 'Map level to Ship Farm at, paired position-by-position with <b>SF: Zone</b>.',
        how: '<b>-1</b> = one level below world (matches the Map Reducer mastery\'s loot-equivalent zone). <b>0</b> = world level. Any other number = world plus that many levels.<br><br>Setting the whole list to a single <b>0</b> uses world level for every SF zone.',
    }), 'multiValue', [0], null, 'Jobs');
    createSetting('Rshipfarmfrag', 'SF: Frags',tip({
        what: 'Farms fragments first if you can\'t afford the map Ship Farming wants.',
        cannot: 'Without this, Ship Farming can get stuck trying to create a map it can never afford, forever.',
    }), 'boolean', false, null, 'Jobs');


    //Gear

    //Line 1
    createSetting('BuyArmorNew', ['Armor: Buy Neither', 'Armor: Buy Both', 'Armor: Prestiges', 'Armor: Levels'],tip({
        what: 'Controls U1 armor automation: buying Prestiges, leveling up the most cost-efficient armor piece, or both.',
        how: 'Buying the Gymystic prestige upgrade specifically is controlled by this setting\'s Prestiges option (Buy Both or Prestiges).'
    }), 'multitoggle', 1, null, "Gear"); //This should replace the two below
    createSetting('BuyWeaponsNew', ['Weapons: Buy Neither', 'Weapons: Buy Both', 'Weapons: Prestiges', 'Weapons: Levels'],tip({
        what: 'Controls U1 weapon automation: buying Prestiges, leveling up the most cost-efficient weapon, or both.'
    }), 'multitoggle', 1, null, "Gear"); //This should replace the two below
    createSetting('CapEquip2', 'Weapon Level Cap',tip({
        what: 'Do not level weapons past this level.',
        how: 'Helps avoid wasting metal leveling a weapon high only to prestige it right after. Disable with -1 or 0. During liquified or heavily-overkilled zones the effective cap drops to a tenth of this value.<br><br>Levels only get bought while AT judges it does not have enough damage yet (or, with <b>Invest Spare Metal</b> on, whenever it can afford a level) — reaching this cap does not by itself force any leveling. During Spire, weapons are leveled to this cap unconditionally.'
    }), 'value', 10, null, 'Gear');
    createSetting('CapEquiparm', 'Armor Level Cap',tip({
        what: 'Do not level armor past this level.',
        how: 'Helps avoid wasting metal leveling armor high only to prestige it right after. Disable with -1 or 0. During liquified or heavily-overkilled zones the effective cap drops to a tenth of this value.<br><br>Levels only get bought while AT judges it does not have enough survivability yet (or, with <b>Invest Spare Metal</b> on, whenever it can afford a level) — reaching this cap does not by itself force any leveling. During Spire, armor is leveled to this cap unconditionally.'
    }), 'value', 10, null, 'Gear');
    createSetting('dmgcuntoff', 'Equipment Cut Off',tip({
        what: 'Controls how much damage margin AT wants before it stops leveling weapons.',
        how: 'AT judges itself to have "enough damage" once your damage times this value exceeds the enemy\'s health. A higher number reaches "enough" sooner, so AT stops leveling weapons earlier; a lower number keeps it leveling weapons more aggressively. 4 is the historical default.'
    }), 'value', '4', null, 'Gear');
    createSetting('DynamicPrestige2', 'Dynamic Prestige z',tip({
        what: 'Set a target zone to gradually work up to your chosen Prestige setting, instead of running it from the start.',
        how: 'Runs with a cheap early weapon (Dagadder) to save time until better gear is actually needed, then raises the effective prestige target as you approach the zone you set here. Disable with 0 or -1.',
        overwritten: 'While active (and while <b>Force Prestige Z</b> has not yet been reached), AT recalculates and overwrites the <b>Prestige</b> dropdown itself every tick — what you pick there stops being read directly.',
        ignoredWhen: 'Your Prestige dropdown is set to Dagadder or an earlier option (index 2 or below) — Dynamic Prestige only kicks in for later targets.'
    }), 'value', -1, null, 'Gear');
    createSetting('Prestige', 'Prestige',tip({
        what: 'Acquire prestiges through the selected item (inclusive) as soon as they become available in maps.',
        how: 'This is an important setting for speed-climbing — it should almost always be set to something. If AT gets stuck somewhere it should easily be able to clear, picking an option lower in the list makes you more powerful at all times, at the cost of spending more time acquiring prestiges in maps.',
        overwritten: 'If <b>Dynamic Prestige z</b> is on, AT recalculates and overwrites this box itself every tick until <b>Force Prestige Z</b> is reached.',
        cannot: 'The last two options (Harmbalest, GambesOP) are only selectable once the game\'s Slow mastery is unlocked — otherwise the game resets your selection back down to Bestplate.',
        ignoredWhen: 'Automap is not enabled — this forces equip-first mode but has no effect if AT is not running maps.'
    }), 'dropdown', 'Polierarm', ['Off', 'Supershield', 'Dagadder', 'Bootboost', 'Megamace', 'Hellishmet', 'Polierarm', 'Pantastic', 'Axeidic', 'Smoldershoulder', 'Greatersword', 'Bestplate', 'Harmbalest', 'GambesOP'], "Gear");

    //Line 2
    createSetting('ForcePresZ', 'Force Prestige Z',tip({
        what: 'On and after this zone is reached, always try to prestige for everything immediately, ignoring Dynamic Prestige and Prestige Skip.',
        how: 'Disable with -1.'
    }), 'value', -1, null, 'Gear');
    createSetting('PrestigeSkip1_2', ['Prestige Skip Off', 'Prestige Skip 1 & 2', 'Prestige Skip 1', 'Prestige Skip 2'],tip({
        what: 'Skips entering (or exits) Prestige Mode in maps under either or both of two conditions, so AT does not stall chasing prestiges you are unlikely to need.',
        how: '<b>Prestige Skip 1</b> skips Prestige Mode while more than 2 unbought Prestiges (besides Shield) are sitting in your upgrades window unaffordable — that count is configurable via the console: <code>MODULES["maps"].SkipNumUnboughtPrestiges</code>.<br><br><b>Prestige Skip 2</b> skips Prestige Mode while 2 or fewer weapon Prestiges remain unobtained in maps — for players who tend not to need the last few due to resource gain not keeping up; configurable via <code>MODULES.maps.UnearnedPrestigesRequired</code>.<br><br>With both selected, both conditions must hold before AT exits Prestige Mode.'
    }), 'multitoggle', 0, null, "Gear");
    createSetting('DelayArmorWhenNeeded', 'Delay Armor Prestige',tip({
        what: 'Delays buying armor prestige upgrades while in Want More Damage or Farming automap modes.',
        how: 'If you need both health and damage at the same time, armor prestiges still get bought regardless of this setting.',
        cannot: 'Only applies to Prestiges — armor level purchases are unaffected.'
    }), 'boolean', false, null, 'Gear');
    createSetting('BuyShieldblock', 'Buy Shield Block',tip({
        what: 'Buys the Shield Block upgrade, and prioritizes running The Block map to unlock it.',
        how: 'Caution: if you are progressing past zone 60, you probably do not want this.'
    }), 'boolean', false, null, "Gear");
    createSetting('trimpsnotdie', 'Buy Armor on Death',tip({
        what: 'Continuously tops up armor to your Armor Level Cap while you are not actively fighting, buying 10 levels at a time.',
        how: 'Despite the name and label, this is not tied to any trimps actually dying — it simply runs on every tick where you are not in active combat or the map pre-battle screen, using a fixed batch of 10 levels regardless of Gear Levels to Buy.'
    }), 'boolean', false, null, "Gear");
    createSetting('gearamounttobuy', 'Gear Levels to Buy',tip({
        what: 'How many gear levels AT buys per purchase in U1.',
        how: 'Recommended value: 1. Must always be greater than 0.',
        cannot: 'Does not affect <b>Buy Armor on Death</b>, which always buys a fixed 10 levels regardless of this setting.'
    }), 'value', 1, null, "Gear");
    createSetting('always2', 'Always Level 2',tip({
        what: 'Treats any U1 weapon or armor piece below level 2 as the top priority to buy, regardless of its normal cost-efficiency ranking.',
        how: 'Level 2 is disproportionately effective, so this lets AT grab it immediately on new gear rather than waiting its turn.'
    }), 'boolean', false, null, "Gear");
    createSetting('InvestSpareMetal', 'Invest Spare Metal',tip({
        what: 'Keep leveling the most efficient gear whenever you can afford it, instead of stopping once you are "strong enough" for the current zone.',
        how: 'Normally AT buys armor only while it cannot survive enough hits, and weapons only while it cannot kill fast enough (see <b>Equipment Cut Off</b>). Once both are satisfied it buys nothing and banks the metal. Measured on a real z21 save: it declined an affordable gear level on <b>18,503 of 20,000 ticks</b>. Turning this on reaches the next zone <b>~19.5% sooner</b> — not by buying much more gear (only ~3 extra levels), but by buying it <b>early</b>, where the damage compounds into faster clears and more income.<br><br>The level caps (<b>Weapon/Armor Level Cap</b>) and the efficiency choice are still respected — this only removes the "I am strong enough, stop buying" brake.'
    }), 'boolean', false, null, "Gear");


    //RGear

    //Line 1
    createSetting('Requipon', 'AutoEquip',tip({
        what: 'The U2 master switch for AutoEquip: buys Prestiges and levels up equipment automatically.',
        how: 'Only buys prestiges when it judges them worth it, and levels whichever piece is currently most cost-efficient.'
    }), 'boolean', false, null, "Gear");
    createSetting('Rdmgcuntoff', 'AE: Cut-off',tip({
        what: 'Controls how aggressively AutoEquip levels weapons in U2.',
        how: 'While your Health:Damage ratio is at or above this value, AT keeps buying weapon levels regardless of the zone and percent overrides below. 1 is the historical default.',
        ignoredWhen: 'AutoEquip (Requipon) is off.'
    }), 'value', '1', null, 'Gear');
    createSetting('Requipamount', 'AE: Amount',tip({
        what: 'The batch size AT assumes it is about to buy when checking whether leveling gear right now would still leave enough resources for your Smithy reservation.',
        how: 'It does not multiply how many levels AutoEquip buys per pass — that is always bought one level at a time in a loop. This only feeds the affordability check used by Smithy reservation logic.',
        ignoredWhen: 'Smithy reservation logic (Rsmithylogic and its number/percent/seconds settings) is not configured — with it off, this setting is never read.'
    }), 'value', 1, null, "Gear");
    createSetting('Requipcapattack', 'AE: Weapon Cap',tip({
        what: 'What level to stop buying weapons at, in U2 AutoEquip.',
        how: 'Set to 0 or below for no cap.'
    }), 'value', 50, null, "Gear");
    createSetting('Requipcaphealth', 'AE: Armour Cap',tip({
        what: 'What level to stop buying armor at, in U2 AutoEquip.',
        how: 'Set to 0 or below for no cap.'
    }), 'value', 50, null, "Gear");
    createSetting('Requipzone', 'AE: Zone',tip({
        what: 'The zone at which U2 AutoEquip stops caring about your H:D ratio or resource percentage, and buys prestiges and equipment as aggressively as it can afford.'
    }), 'value', -1, null, "Gear");
    createSetting('Requippercent', 'AE: Percent',tip({
        what: 'What percent of your owned wood/metal U2 AutoEquip is allowed to spend on a gear purchase before you reach <b>AE: Zone</b>.',
        how: 'A purchase is allowed through if its cost is within this percentage of what you currently own, even when your H:D ratio and zone would otherwise hold it back.'
    }), 'value', 1, null, "Gear");
    createSetting('Requip2', 'AE: 2',tip({
        what: 'Always buys level 2 of every U2 weapon and armor piece regardless of efficiency.',
        how: 'Level 2 is disproportionately effective, so this lets AT grab it immediately rather than waiting its turn.',
        ignoredWhen: 'You are in the Pandemonium challenge.'
    }), 'boolean', true, null, "Gear");
    (document.getElementById('Requip2') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Requipfarmon', 'AE: Farm',tip({
        what: 'AutoEquip Farm — estimates the metal needed to reach your gear target and prioritizes farming for it rather than climbing.',
        how: 'Tries to buy the best map you can afford, but never a plus map — this is intended for use on deep push runs, not regular progression.'
    }), 'boolean', false, null, "Gear");
    createSetting('Requipfarmzone', 'AEF: Zone',tip({
        what: 'The zone AutoEquip Farm starts checking whether you have enough metal for your gear target.',
        ignoredWhen: 'AE: Farm is off, or AE: H:D / AE: Multiplier is not set above 0.'
    }), 'value', '-1', null, 'Gear');
    createSetting('RequipfarmHD', 'AEF: H:D',tip({
        what: 'The starting H:D target AutoEquip Farm estimates your gear needs against, at <b>AEF: Zone</b>.',
        ignoredWhen: 'AE: Farm is off, or AE: Zone / AE: Multiplier is not set above 0.'
    }), 'value', '-1', null, 'Gear');
    createSetting('Requipfarmmult', 'AEF: Multiplier',tip({
        what: 'How much the AutoEquip Farm H:D target grows per zone past <b>AEF: Zone</b>.',
        how: 'E.g. AEF: Zone 100, AEF: H:D 10, AEF: Multiplier 1.2 gives a target of 12 at z101, 14.4 at z102, and so on — scaling the target up so you are not farming for a target that is too low for how strong the zones have gotten.',
        ignoredWhen: 'AE: Farm is off, or AE: Zone / AE: H:D is not set above 0.'
    }), 'value', '-1', null, 'Gear');
    createSetting('Requipfarmhits', 'AEF: Hits',tip({
        what: 'How many hits you want it to take to kill an enemy while AutoEquip Farm has selected a farming map.',
        ignoredWhen: 'AutoEquip Farm has not triggered farming mode.'
    }), 'value', '-1', null, 'Gear');



    //Maps

    //Line 1
    // #107 — AutoMaps is mirrored by toggleAutoMaps() (settings-menu.ts:281), i.e. by the USER clicking
    // the AutoMaps button in the game's own UI. It is a genuine two-way control, not a box the bot
    // steals — but it IS written from outside this panel, so say where the other switch is.
    createSetting('AutoMaps', ["Auto Maps Off", "Auto Maps On", "Auto Maps: Unique"], tip({
        what: 'Lets AutoTrimps send you into maps on its own — to farm, to gain map bonus, and to clear what it needs. Recommended ON.',
        overwritten: 'This is the same switch as the <b>AutoMaps</b> button on the game screen. Clicking that button changes this setting, and vice versa — they are one control in two places, so this box can change without you touching this panel.',
        how: '<b>Auto Maps: Unique</b> works the same, and additionally unlocks a per-map setting for each unique map so you can pick which ones to run.',
        cannot: 'Work alongside <b>MaZ</b>. Do not run both.',
    }), 'multitoggle', 1, null, "Maps");
    createSetting('AMUblock', 'AMU: The Block',tip({
        what: 'Makes AutoTrimps run the unique map <b>The Block</b> every time it becomes available, to unlock the Shieldblock upgrade.',
        how: 'Only takes effect once you have reached roughly zone 11 (scaled by the map\'s own difficulty).',
        ignoredWhen: 'Ignored once Shieldblock is already unlocked, and ignored unless <b>Auto Maps: Unique</b> is selected above.',
    }), 'boolean', false, null, 'Maps');
    // #42 removed the AMU: The Wall / Dimension of Anger branches (their natural selector branch already
    // runs them each portal until the reward is earned; the checkbox re-ran a completed one = the bug).
    // #61 dropped the now-inert AMUwall/AMUanger createSetting + visibility toggles.
    createSetting('AMUtrimple', 'AMU: Trimple',tip({
        what: 'Makes AutoTrimps run <b>Trimple Of Doom</b> every time it becomes available, to claim its one-time Ancient Treasure reward.',
        how: 'Only takes effect once you have reached roughly zone 33 (scaled by the map\'s own difficulty). This is independent of the <b>Trimple Z</b> setting elsewhere on this panel, which triggers Trimple Of Doom by a specific zone regardless of Unique Maps mode.',
        ignoredWhen: 'Ignored once you have already claimed the Ancient Treasure, and ignored unless <b>Auto Maps: Unique</b> is selected above.',
    }), 'boolean', false, null, 'Maps');
    createSetting('AMUprison', 'AMU: Prison',tip({
        what: 'Makes AutoTrimps run the unique map <b>The Prison</b> every time it becomes available.',
        how: 'Only takes effect once you have reached roughly zone 80 (scaled by the map\'s own difficulty).',
        ignoredWhen: 'Ignored during Challenge\u00b2 runs, and adds nothing during the Electricity or Mapocalypse challenges &mdash; AutoTrimps already runs The Prison there regardless of this setting. Also requires <b>Auto Maps: Unique</b> to be selected above.',
    }), 'boolean', false, null, 'Maps');
    createSetting('AMUbw', 'AMU: BW',tip({
        what: 'Makes AutoTrimps run the unique map <b>Bionic Wonderland</b> every time it becomes available.',
        how: 'Only takes effect once you have reached roughly zone 125 (scaled by the map\'s own difficulty).',
        ignoredWhen: 'Ignored during Challenge\u00b2 runs, and adds nothing during the Crushed challenge &mdash; AutoTrimps already runs Bionic Wonderland there regardless of this setting. Also requires <b>Auto Maps: Unique</b> to be selected above.',
    }), 'boolean', false, null, 'Maps');
    createSetting('AMUstar', 'AMU: Imploding Star',tip({
        what: 'Makes AutoTrimps run the unique map <b>Imploding Star</b> every time it becomes available.',
        how: 'Only takes effect once you have reached roughly zone 170 (scaled by the map\'s own difficulty). Unlike the other AMU options above, this one still applies during Challenge\u00b2 runs.',
        ignoredWhen: 'Ignored unless <b>Auto Maps: Unique</b> is selected above.',
    }), 'boolean', false, null, 'Maps');
    createSetting('automapsportal', 'AM Portal',tip({
        what: 'Forces <b>Auto Maps</b> to turn <b>On</b> automatically the moment you portal into a fresh Universe 1 run, if it is not already on.',
        cannot: 'Only ever sets Auto Maps to plain <b>On</b> &mdash; it never selects <b>Unique</b> mode.',
        ignoredWhen: 'Only fires once, at the very start of a new Universe 1 run. Does nothing for the rest of that run, and nothing at all in Universe 2.',
    }), 'boolean', false, null, 'Maps');
    createSetting('automapsalways', 'AM Always',tip({
        what: 'Continuously forces <b>Auto Maps</b> to plain <b>On</b>, every tick it is not already on.',
        cannot: 'Cannot coexist with <b>Auto Maps: Unique</b> mode &mdash; if you pick Unique, this setting flips it straight back to plain On.',
        how: 'Effectively makes it impossible to run Unique mode, or to leave Auto Maps off, while this is checked.',
    }), 'boolean', false, null, 'Maps');
    (document.getElementById('automapsportal') as any).parentNode.insertAdjacentHTML('afterend', '<br>');

    //Line 2
    createSetting('DynamicSiphonology', 'Dynamic Siphonology',tip({
        what: 'Lets AutoTrimps pick the lowest map level within your Siphonology range that you can still one-shot, instead of always diving to the deepest level Siphonology allows.',
        how: 'Siphonology is a portal perk that grants map-bonus stacks for running maps below your current zone, one zone of leeway per perk level. With this <b>ON</b>, AutoTrimps searches upward from the deepest allowed level until it finds one your current damage can clear in one hit. With this <b>OFF</b>, it always dives to the deepest level Siphonology allows, whether or not you can one-shot it.',
    }), 'boolean', true, null, 'Maps');
    createSetting('PreferMetal', 'Prefer Metal Maps',tip({
        what: 'Prefers metal-biome (Mountain) maps over Gardens/Plentiful maps when AutoTrimps reuses an already-owned map.',
        ignoredWhen: 'Only affects map selection during pre-Spire farming, when AutoTrimps is searching your owned maps for one to reuse. It has no effect on newly created maps or on ordinary map runs.',
        how: 'Intended for manual use, such as farming metal ahead of a Spire push. Remember to turn it back off afterward.',
    }), 'boolean', false, null, 'Maps');
    createSetting('mapselection', 'Map Selection',tip({
        what: 'Picks which biome AutoTrimps requests when it creates a new map.',
        how: '<b>Gardens</b> is sent to the game under its internal biome name, <b>Plentiful</b>.',
        ignoredWhen: 'Ignored while AutoTrimps is farming for map bonus, or during the Metal challenge &mdash; biome is forced to Plentiful (once decay is done) or Mountain instead, regardless of this setting.',
    }), 'dropdown', 'Mountain', ["Random", "Mountain", "Forest", "Sea", "Depths", "Gardens"], 'Maps');
    createSetting('MaxMapBonusAfterZone', 'Max MapBonus After',tip({
        what: 'Forces AutoTrimps to farm up to your full Map Bonus cap starting at this zone (inclusive), every time you reach it.',
        how: '<b>0</b> applies it from the very first zone. <b>-1</b> disables it entirely. While active, this also delays weapon/armor purchases until the map-bonus cap is hit for that zone.',
        cannot: 'Cannot lower the actual stack target below what the sibling setting <b>Max MapBonus Limit</b> allows &mdash; that is what sets the cap, not a console command. (An earlier version of this tooltip pointed at a hidden console command, <code>MODULES["maps"].maxMapBonusAfterZ</code>, that nothing in the code reads &mdash; ignore it.)',
        ignoredWhen: 'Setting this to exactly <b>0</b> ("always") still forces the map-farming behavior, but does <b>not</b> get the extra armor-buying delay that a positive zone gets &mdash; that check only treats a nonzero value as "on".',
    }), 'value', '-1', null, 'Maps');
    createSetting('MaxMapBonuslimit', 'Max MapBonus Limit',tip({
        what: 'Caps how many Map Bonus stacks AutoTrimps will farm for before moving on.',
        how: 'Once you reach this many stacks, AutoTrimps stops farming for more and continues the run &mdash; or, if it was already farming, drops to <b>Lower Farming Zone</b> instead.',
    }), 'value', '10', null, 'Maps');
    createSetting('MaxMapBonushealth', 'Max MapBonus Health',tip({
        what: 'Caps how many extra Map Bonus stacks AutoTrimps will farm purely to raise your health, when health is short.',
        how: 'Only kicks in below this many stacks, while AutoTrimps isn\'t already mapping for another reason and doesn\'t need to prestige. Above this many stacks, health-farming stops even if health is still short.',
    }), 'value', '10', null, 'Maps');
    createSetting('mapcuntoff', 'Map Cut Off',tip({
        what: 'Sets the Health:Damage ratio AutoTrimps uses to decide whether it has "enough damage" to stop mapping and push forward.',
        how: 'AutoTrimps expects to one-shot an enemy once your damage times this number exceeds the enemy\'s health. Raise it to demand a bigger damage margin (more mapping); lower it to accept a thinner margin (less mapping). This same threshold is also what the <b>CAM: H:D</b> Armor Magic option compares against.',
        ignoredWhen: 'Temporarily replaced by the Wind Stacking cutoff or the Mapology challenge cutoff whenever either of those is active &mdash; this box\'s value doesn\'t change, but it briefly stops being read.',
    }), 'value', '4', null, 'Maps');

    //Line 3
    createSetting('DisableFarm', 'Farming H:D',tip({
        what: 'Sets the Health:Damage ratio above which AutoTrimps switches into Farming mode &mdash; repeating maps for prestige items and map bonus instead of pushing forward.',
        how: '<b>-1</b> disables Farming mode entirely, however strong you get.',
    }), 'value', -1, null, 'Maps');
    createSetting('LowerFarmingZone', 'Lower Farming Zone',tip({
        what: 'While farming, lets AutoTrimps drop to a lower zone it can one-shot instead of staying at your current zone.',
        how: 'Uses the same one-shot search as <b>Dynamic Siphonology</b> to find the lowest map level your damage can clear, but only kicks in after your first 10 map-bonus stacks &mdash; before that it still farms within Siphonology\'s normal range. It can go as far as 10 zones below your current zone if your damage is that far behind, which usually means it is time to portal instead.',
    }), 'boolean', true, null, 'Maps');
    createSetting('FarmWhenNomStacks7', 'Farm on >7 NOMstacks',tip({
        what: 'During the Nom challenge, forces AutoTrimps into Farming mode once Improbability builds up enough Nom stacks &mdash; even if <b>Farming H:D</b> is set to -1 (disabled).',
        how: 'At 5+ stacks it stacks 30 Anticipation. Past 7 stacks it gets +200% damage from Map Bonus. If it still can\'t win the fight, it forces Farming at 30 stacks (exiting once the ratio drops back under 10x), and again at 100 stacks anywhere in the world &mdash; including inside a void map, which it also exits and blocks from restarting until the stack pressure clears.',
        ignoredWhen: 'Only relevant during the Nom challenge.',
    }), 'boolean', false, null, 'Maps');
    createSetting('VoidMaps', 'Void Maps',tip({
        what: 'The zone at which AutoTrimps clears out all of your void maps.',
        how: 'Runs them at cell 70 unless you set <b>Voids Cell</b> otherwise &mdash; see <b>Voids Cell</b> to change that. <b>0</b> disables void-clearing entirely. On Lead, use an odd zone.',
        ignoredWhen: 'Ignored during the Daily challenge &mdash; <b>Daily Void Mod</b> controls Daily void zones instead.',
    }), 'value', '0', null, "Maps");
    createSetting('voidscell', 'Voids Cell',tip({
        what: 'The cell within the <b>Void Maps</b> zone at which AutoTrimps starts clearing void maps.',
        how: '<b>-1</b> falls back to cell 70.',
    }), 'value', '-1', null, 'Maps');
    createSetting('RunNewVoidsUntilNew', 'New Voids Mod',tip({
        what: 'Extends void-map clearing to zones past your configured <b>Void Maps</b> zone, so newly obtained void maps don\'t sit unrun until your next visit there.',
        how: 'A positive number adds that many zones on top of Void Maps &mdash; e.g. Void Maps=187 and this=10 runs new voids through z197. A negative number removes the cap entirely, running new voids at every zone from Void Maps onward. See <b>New Voids Poison</b> below to restrict this extension to Poison-empowered zones only.',
        cannot: 'Cannot run new voids below your Void Maps zone, only at or above it.',
        ignoredWhen: '<b>0</b> disables the extension &mdash; only the exact Void Maps zone is cleared. Ignored during the Daily challenge, which has its own equivalent setting.',
    }), 'value', '0', null, 'Maps');
    createSetting('runnewvoidspoison', 'New Voids Poison',tip({
        what: 'Restricts the <b>New Voids Mod</b> zone extension to Poison-empowered zones only.',
        ignoredWhen: 'Does nothing unless <b>New Voids Mod</b> is actually extending void clearing past your Void Maps zone (i.e. is nonzero). Ignored during the Daily challenge, which has its own equivalent setting.',
    }), 'boolean', false, null, 'Maps');
    createSetting('onlystackedvoids', 'Stacked Voids Only',tip({
        what: 'Restricts void-map clearing to void maps that already have accumulated stacks (Stacked &gt; 0), skipping fresh unstacked voids.',
        ignoredWhen: 'Ignored during the Daily challenge.',
    }), 'boolean', false, null, 'Maps');

    //Line 4
    createSetting('TrimpleZ', 'Trimple Z', tip({
        what: 'Runs <b>Trimple Of Doom</b> for the Ancient Treasure at this zone, after farming and building up map stacks.',
        // maps.ts:203 — a NEGATIVE value is reset to 0 once the run succeeds. The old text described this
        // ("this will be disabled after a successful run") but buried it after a paragraph of the original
        // author thinking out loud about whether the feature should exist at all.
        overwritten: 'If you set a <b>negative</b> zone, AT resets this box to <b>0</b> once it has successfully run Trimple — so it fires once and then switches itself off, leaving you free to set a new zone next run.',
        how: 'A positive zone runs it every time you reach that zone. <b>0</b> is off.',
    }), 'valueNegative', 0, null, 'Maps');
    createSetting('AdvMapSpecialModifier', 'Map Special Modifier',tip({
        what: 'Lets AutoTrimps automatically pick the best affordable map special modifier, instead of leaving whatever was last selected by hand.',
        how: 'Picks <i>Prestigious</i> when creating a map for Prestige, a metal-cache/loot modifier while farming or short on health, and <i>Fast Attacks</i> otherwise &mdash; always the best one it can afford, downgrading choice by choice until it fits your fragments. Also adds extra map levels on top of your zone once unlocked.',
        ignoredWhen: 'The special-modifier pick only takes effect once you have cleared zone 59; the extra-map-levels bump on top of it only takes effect from zone 209 on.',
    }), 'boolean', true, null, 'Maps');
    createSetting('scryvoidmaps', 'VM Scryer',tip({
        what: 'Forces AutoTrimps to use Scryer stance while inside a Void map.',
        how: 'Applies on top of &mdash; and independently of &mdash; the <b>Use Scryer Stance</b> and <b>Scryer: Void Maps</b> settings elsewhere; it works even if those are off.',
        cannot: 'Does nothing without the Scryhard II perk.',
        ignoredWhen: 'Ignored during the Daily challenge &mdash; the separate Daily VM Scryer setting controls Daily void maps instead.',
    }), 'boolean', false, null, 'Maps');
    createSetting('buywepsvoid', 'VM Buy Weps',tip({
        what: 'Buys weapons and armor while inside a void map, ignoring your usual Health:Damage buy gate.',
        how: 'Useful if you want to overkill as much as possible while parked on your void-clearing zone.',
        ignoredWhen: 'Only applies at the exact zone set in <b>Void Maps</b> (or <b>Daily Void Mod</b> on a Daily) &mdash; void maps run at any other zone are not affected.',
    }), 'boolean', false, null, 'Maps');
    createSetting('farmWonders', 'Farm Wonders',tip({
        what: 'During the Experience challenge, farms Wonders down to a target zone and finishes the challenge with a Bionic Wonderland run.',
        ignoredWhen: 'Only relevant during the Experience challenge, and requires <b>Wonders Amount</b> and <b>Max XP Zone</b> to be configured below.',
    }), 'boolean', false, null, 'Maps')
    createSetting('wondersAmount', 'Wonders Amount',tip({
        what: 'How many Wonders to collect during the Experience challenge.',
        how: 'Wonders are collected every 5 zones below <b>Max XP Zone</b> &mdash; with a Max XP Zone of 600 and this set to 3, Wonders are obtained at 600, 595, and 590.',
        ignoredWhen: '<b>0</b> disables Wonder farming. Only relevant during the Experience challenge, and only while <b>Farm Wonders</b> is on.',
    }), 'value', '0', null, "Maps");
    createSetting('maxExpZone', "Max XP Zone",tip({
        what: 'The zone to start collecting Wonders from during the Experience challenge, counting down every 5 zones for however many Wonders you\'ve requested.',
        cannot: 'Must have a value, or the other Experience-challenge settings will not work.',
        how: 'If set above zone 600, AutoTrimps additionally finishes the Experience challenge by running BW at this zone.',
        ignoredWhen: 'Only relevant during the Experience challenge.',
    }), 'value', '600', null, 'Maps');
    createSetting('finishExpOnBw', 'Finish XP on BW',tip({
        what: 'The Bionic Wonderland zone AutoTrimps runs to finish the Experience challenge.',
        how: 'This level of BW should already be in your inventory &mdash; use the BW Raiding module first if you want to raid to a specific level before 601. Snapped to a valid BW zone (125, then every 15 zones after) if you enter one that doesn\'t exist &mdash; e.g. 606 runs 605.',
        cannot: 'Cannot go below zone 125 &mdash; anything lower is treated as 125.',
    }), 'value', '605', null, 'Maps');

    //Shrine - U1
    (document.getElementById('finishExpOnBw') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Hshrine', 'AutoShrine',tip({
        what: 'Turns on automatic Bone Shrine charge use at the zone(s), cell(s), and amount(s) you configure in <b>AutoShrine Settings</b> below.',
        cannot: 'Requires Bone Shrine charges to actually be available, and is a separate mechanism from <b>Auto Bone Charge Max</b> elsewhere &mdash; the two do not interact.',
    }), 'boolean', false, null, 'Maps');
    createSetting('Hshrinemaz', 'AutoShrine Settings',tip({
        what: 'Opens the AutoShrine editor: pick the zone, cell, and how many Bone Shrine charges to spend there.',
        how: 'Example: Zone 40, Cell 10, Amount 3 uses 3 Bone Shrine charges the first time you reach cell 10 of zone 40. Using it after cell 80 gets the benefit of all the books.',
        cannot: 'The charge count resets every time you enter a new zone, so <b>Amount</b> means "how many to use at this zone", not a lifetime total.',
    }), 'infoclick', false, null, 'Maps');
    createSetting('Hshrinezone', 'AutoShrine: Zone',tip({
        what: 'The list of zones AutoShrine triggers at &mdash; the raw storage behind the <b>AutoShrine Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length, in the same order, as its <b>Cell</b> and <b>Amount</b> siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Hshrinecell', 'AutoShrine: Cell',tip({
        what: 'The list of cells (one per zone) AutoShrine waits for before spending charges &mdash; the raw storage behind the <b>AutoShrine Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length, in the same order, as its <b>Zone</b> and <b>Amount</b> siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Hshrineamount', 'AutoShrine: Amount',tip({
        what: 'The list of charge counts (one per zone) AutoShrine spends &mdash; the raw storage behind the <b>AutoShrine Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length, in the same order, as its <b>Zone</b> and <b>Cell</b> siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Hshrinecharge', 'AutoShrine: Charge',tip({
        what: 'Internal bookkeeping AutoTrimps uses to track how many Bone Shrine charges it has already spent at the current zone.',
        cannot: 'Not meant to be edited by hand &mdash; it resets to 0 automatically every time you enter a new zone.',
    }), 'value', 0, null, 'Maps');

    //RMaps

    //Line 1
    createSetting('RAutoMaps', ["Auto Maps Off", "Auto Maps On", "Auto Maps No Unique"], tip({
        what: 'Lets AutoTrimps send you into maps on its own — to farm, to gain map bonus, and to clear what it needs. Recommended ON.',
        overwritten: 'This is the same switch as the <b>AutoMaps</b> button on the game screen. Clicking that button changes this setting, and vice versa — they are one control in two places, so this box can change without you touching this panel.',
        how: '<b>Auto Maps No Unique</b> works the same but never runs unique maps such as Dimension of Rage.',
    }), 'multitoggle', 1, null, "Maps");
    createSetting('Rautomapsportal', 'AM Portal',tip({
        what: 'Forces <b>Auto Maps</b> to turn <b>On</b> automatically the moment you portal into a fresh Universe 2 (Radon) run, if it is not already on.',
        cannot: 'Only ever sets Auto Maps to plain <b>On</b> &mdash; it never selects <b>No Unique</b> mode.',
        ignoredWhen: 'Only fires once, at the very start of a new Universe 2 run. Does nothing for the rest of that run, and nothing at all in Universe 1.',
    }), 'boolean', false, null, 'Maps');
    createSetting('Rautomapsalways', 'AM Always',tip({
        what: 'Continuously forces <b>Auto Maps</b> to plain <b>On</b>, every tick it is not already on.',
        cannot: 'Cannot coexist with <b>Auto Maps No Unique</b> mode &mdash; if you pick No Unique, this setting flips it straight back to plain On.',
    }), 'boolean', false, null, 'Maps');
    createSetting('Rmapselection', 'Map Selection',tip({
        what: 'Picks which biome AutoTrimps requests when it creates a new map &mdash; the Universe 2 twin of <b>Map Selection</b>.',
        ignoredWhen: 'Ignored while AutoTrimps is farming, or during the Transmute challenge &mdash; biome is forced to Plentiful instead, regardless of this setting.',
    }), 'dropdown', 'Mountain', ["Random", "Mountain", "Forest", "Sea", "Depths", "Plentiful", "Farmlands"], 'Maps');
    createSetting('RMaxMapBonusAfterZone', 'Max MapBonus After',tip({
        what: 'Forces AutoTrimps to farm up to your full Map Bonus cap starting at this zone (inclusive), every time you reach it &mdash; the Universe 2 twin of <b>Max MapBonus After</b>.',
        how: '<b>0</b> applies it from the very first zone.',
        cannot: 'Cannot lower the actual stack target below what the sibling setting <b>Max MapBonus Limit</b> allows &mdash; that is what sets the cap.',
        ignoredWhen: '<b>-1</b> disables it entirely.',
    }), 'value', '-1', null, 'Maps');
    createSetting('RMaxMapBonuslimit', 'Max MapBonus Limit',tip({
        what: 'Caps how many Map Bonus stacks AutoTrimps will farm for before moving on &mdash; the Universe 2 twin of <b>Max MapBonus Limit</b>.',
        how: 'Once you reach this many stacks, AutoTrimps stops farming for more and continues the run.',
    }), 'value', '10', null, 'Maps');
    createSetting('RMaxMapBonushealth', 'Max MapBonus Health',tip({
        what: 'Caps how many extra Map Bonus stacks AutoTrimps will farm purely to raise your health, when health is short &mdash; the Universe 2 twin of <b>Max MapBonus Health</b>.',
        how: 'Only kicks in below this many stacks, while AutoTrimps isn\'t already mapping for another reason. Above this many stacks, health-farming stops even if health is still short.',
    }), 'value', '10', null, 'Maps');
    createSetting('Rhitssurvived', 'Hits Survived',tip({
        what: 'Sets how many enemy attacks AutoTrimps wants to be able to survive before it considers its health "enough" &mdash; used for both map-farming decisions and gear-buying decisions in Universe 2.',
        how: 'The lower this is, the less health AutoTrimps will farm or buy toward. Set it too high and AutoTrimps will over-farm for health, so be careful.',
    }), 'value', '10', null, 'Maps');
    createSetting('Rmapcuntoff', 'Map Cut Off',tip({
        what: 'Sets the Health:Damage ratio AutoTrimps uses to decide whether it has "enough damage" to stop mapping and push forward &mdash; the Universe 2 twin of <b>Map Cut Off</b>.',
        how: 'AutoTrimps expects to one-shot an enemy while your Health:Damage ratio stays at or below this number. Raise it to demand a bigger damage margin (more mapping); lower it to accept a thinner margin (less mapping).',
    }), 'value', '1', null, 'Maps');
    createSetting('RDisableFarm', 'Farming H:D',tip({
        what: 'Sets the Health:Damage ratio above which AutoTrimps switches into Farming mode &mdash; the Universe 2 twin of <b>Farming H:D</b>.',
        how: '<b>-1</b> disables Farming mode entirely, however strong you get.',
    }), 'value', -1, null, 'Maps');

    //Line 2
    createSetting('RVoidMaps', 'Void Maps',tip({
        what: 'The zone at which AutoTrimps clears out all of your void maps &mdash; the Universe 2 twin of <b>Void Maps</b>.',
        how: 'Runs them at cell 70 unless you set <b>Voids Cell</b> below otherwise &mdash; see <b>Voids Cell</b> below to change that. On Lead, use an odd zone.<br><br><b>U2 void rush (#44):</b> to start voids as early as possible, set this to your current zone, set <b>Voids Cell</b> to 1, and set <b>New Voids Mod</b> to -1 (no cap) &mdash; voids then run at cell 1 of every zone from here on.',
        cannot: 'The Universe 1 Combat setting "Only Rush Voids" does <b>not</b> affect Universe 2.',
        ignoredWhen: '<b>0</b> disables void-clearing entirely. Ignored during the Daily challenge &mdash; <b>Daily Void Mod</b> controls Daily void zones instead.',
    }), 'value', '0', null, "Maps");
    createSetting('Rvoidscell', 'Voids Cell',tip({
        what: 'The cell within the <b>Void Maps</b> zone at which AutoTrimps starts clearing void maps &mdash; the Universe 2 twin of <b>Voids Cell</b>.',
        how: '<b>-1</b> falls back to cell 70.',
    }), 'value', '-1', null, 'Maps');
    createSetting('RRunNewVoidsUntilNew', 'New Voids Mod',tip({
        what: 'Extends void-map clearing to zones past your configured <b>Void Maps</b> zone, so newly obtained void maps don\'t sit unrun until your next visit there &mdash; the Universe 2 twin of <b>New Voids Mod</b>.',
        how: 'A positive number adds that many zones on top of Void Maps. A negative number removes the cap entirely, running new voids at every zone from Void Maps onward. Unlike the Universe 1 twin, there is no Poison-zone restriction here.',
        cannot: 'Cannot run new voids below your Void Maps zone, only at or above it.',
        ignoredWhen: '<b>0</b> disables the extension &mdash; only the exact Void Maps zone is cleared. Ignored during the Daily challenge.',
    }), 'value', '0', null, 'Maps');
    createSetting('Rprispalace', 'Prismatic Palace',tip({
        what: 'Runs the unique map <b>Prismatic Palace</b> once it unlocks, to claim its Prismalicious reward.',
        how: 'Only runs once you have reached zone 21, and only while your Health:Damage ratio is 25 or better (not too far behind).',
        ignoredWhen: 'Requires <b>Auto Maps</b> set to plain "On" above &mdash; "Auto Maps No Unique" skips it.',
    }), 'boolean', true, null, 'Maps');
    createSetting('Rmeltpoint', 'Melting Point',tip({
        what: 'Runs the unique map <b>Melting Point</b> at a specific zone and cell.',
        how: 'Enter it as two numbers: zone, then cell &mdash; e.g. <code>50,91</code> runs Melting Point at zone 50, cell 91. Both values are required. Works during the Melt and Trappapalooza challenges, and separately once you own enough Smithies via the Smithy Farm settings.',
        ignoredWhen: '<b>-1</b> disables it. Requires <b>Auto Maps</b> set to plain "On" above &mdash; "Auto Maps No Unique" skips it.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Rfrozencastle', 'Frozen Castle',tip({
        what: 'Runs the unique map <b>Frozen Castle</b> at a specific zone and cell.',
        how: 'Enter it as two numbers: zone, then cell &mdash; e.g. <code>200,91</code> runs Frozen Castle at zone 200, cell 91. Both values are required. Works in any challenge, so be careful.',
        ignoredWhen: '<b>-1</b> disables it. Ignored during the Hypothermia challenge, which uses its own dedicated Frozen Castle settings instead. Requires <b>Auto Maps</b> set to plain "On" above &mdash; "Auto Maps No Unique" skips it.',
    }), 'multiValue', [-1], null, 'Maps');

    //Timefarm
    (document.getElementById('Rfrozencastle') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rtimefarm', 'Time Farm',tip({
        what: 'Turns on Time Farming: parks AutoTrimps at a configured zone and cell for a set number of minutes, gathering a chosen resource, before it continues.',
        how: 'Configure the zone, cell, duration, and what to gather in <b>Time Farm Settings</b> below.',
    }), 'boolean', false, null, 'Maps');
    createSetting('Rtimefarmmaz', 'Time Farm Settings',tip({
        what: 'Opens the Time Farm editor: pick the zone, cell, duration, map, special, and resource to gather.',
        how: 'It also puts all your workers into gathering the chosen resource. Example: Zone 60, Cell 10, Time 3, Level 5, Map Gardens, Special Large Metal Cache, Gather Metal farms at zone 60, cell 10, for 3 minutes in a +5 Gardens map with a Large Metal Cache, gathering metal.',
    }), 'infoclick', false, null, 'Maps');
    createSetting('Rtimefarmzone', 'TF: Zone',tip({
        what: 'The list of zones Time Farming triggers at &mdash; the raw storage behind the <b>Time Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length, in the same order, as its Cell/Time/Level/Map/Special/Gather siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Rtimefarmcell', 'TF: Cell',tip({
        what: 'The list of cells (one per zone) Time Farming waits for before it starts &mdash; the raw storage behind the <b>Time Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Time/Level/Map/Special/Gather siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Rtimefarmtime', 'TF: Time',tip({
        what: 'The list of durations, in minutes, one per zone, Time Farming runs for &mdash; the raw storage behind the <b>Time Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Cell/Level/Map/Special/Gather siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Rtimefarmlevel', 'TF: Map Level',tip({
        what: 'The list of map-level offsets, one per zone, Time Farming uses above your current zone &mdash; the raw storage behind the <b>Time Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Cell/Time/Map/Special/Gather siblings, or the pairing breaks.',
    }), 'multiValue', [0], null, 'Maps');
    createSetting('Rtimefarmmap', 'TF: Map Selection',tip({
        what: 'The list of map biomes, one per zone, Time Farming creates &mdash; the raw storage behind the <b>Time Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Cell/Time/Level/Special/Gather siblings, or the pairing breaks.',
    }), 'textValue', '', null, 'Maps');
    createSetting('Rtimefarmspecial', 'TF: Special Selection',tip({
        what: 'The list of map special modifiers, one per zone, Time Farming requests &mdash; the raw storage behind the <b>Time Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Cell/Time/Level/Map/Gather siblings, or the pairing breaks.',
    }), 'textValue', '', null, 'Maps');
    createSetting('Rtimefarmgather', 'TF: Gather Selection',tip({
        what: 'The list of resources, one per zone, Time Farming puts all your workers on &mdash; the raw storage behind the <b>Time Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Cell/Time/Level/Map/Special siblings, or the pairing breaks.',
    }), 'textValue', '', null, 'Maps');

    //Smithyfarm
    (document.getElementById('Rtimefarmgather') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rsmithyfarm', 'Smithy Farm',tip({
        what: 'Turns on Smithy Farming: parks AutoTrimps at a configured zone and cell until it has built a target number of Smithies.',
        how: 'Configure the zone, cell, and Smithy count in <b>Smithy Farm Settings</b> below.',
    }), 'boolean', false, null, 'Maps');
    createSetting('Rsmithyfarmmaz', 'Smithy Farm Settings',tip({
        what: 'Opens the Smithy Farm editor: pick the zone, cell, and how many Smithies to build there.',
        how: 'AutoTrimps generates a map that fills your resource needs and assigns gathering/jobs appropriately. Example: Zone 60, Cell 10, Smithys 2 farms at zone 60, cell 10, for a total of 2 Smithies.',
    }), 'infoclick', false, null, 'Maps');
    createSetting('Rsmithyfarmzone', 'SF: Zone',tip({
        what: 'The list of zones Smithy Farming triggers at &mdash; the raw storage behind the <b>Smithy Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Cell/Smithys siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Rsmithyfarmcell', 'SF: Cell',tip({
        what: 'The list of cells, one per zone, Smithy Farming waits for before it starts &mdash; the raw storage behind the <b>Smithy Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Smithys siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Rsmithyfarmamount', 'SF: Smithys',tip({
        what: 'The list of Smithy-count targets, one per zone, Smithy Farming builds to &mdash; the raw storage behind the <b>Smithy Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Cell siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');

    //Tributefarm
    (document.getElementById('Rsmithyfarmamount') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rtributefarm', 'Tribute Farm',tip({
        what: 'Turns on Tribute Farming: parks AutoTrimps at a configured zone and cell until it has gathered a target number of tributes.',
        how: 'Configure the zone, cell, tribute count, and what to gather in <b>Tribute Farm Settings</b> below.',
    }), 'boolean', false, null, 'Maps');
    createSetting('Rtributefarmmaz', 'Tribute Farm Settings',tip({
        what: 'Opens the Tribute Farm editor: pick the zone, cell, tribute target, map, special, and resource to gather.',
        how: 'It also puts all your workers into gathering the chosen resource. Example: Zone 40, Cell 10, Tributes 1000, Level 5, Map Gardens, Special Large Savory Cache, Gather Food farms at zone 40, cell 10, for 1000 tributes in a +5 Gardens map with a Large Savory Cache, gathering food.',
    }), 'infoclick', false, null, 'Maps');
    createSetting('Rtributefarmzone', 'TrF: Zone',tip({
        what: 'The list of zones Tribute Farming triggers at &mdash; the raw storage behind the <b>Tribute Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Cell/Tributes/Level/Map/Special/Gather siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Rtributefarmcell', 'TrF: Cell',tip({
        what: 'The list of cells, one per zone, Tribute Farming waits for before it starts &mdash; the raw storage behind the <b>Tribute Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Tributes/Level/Map/Special/Gather siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Rtributefarmamount', 'TrF: Tributes',tip({
        what: 'The list of tribute-count targets, one per zone, Tribute Farming gathers to &mdash; the raw storage behind the <b>Tribute Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Cell/Level/Map/Special/Gather siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Rtributefarmlevel', 'TrF: Map Level',tip({
        what: 'The list of map-level offsets, one per zone, Tribute Farming uses above your current zone &mdash; the raw storage behind the <b>Tribute Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Cell/Tributes/Map/Special/Gather siblings, or the pairing breaks.',
    }), 'multiValue', [0], null, 'Maps');
    createSetting('Rtributemapselection', 'TrF: Map Selection',tip({
        what: 'The list of map biomes, one per zone, Tribute Farming creates &mdash; the raw storage behind the <b>Tribute Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Cell/Tributes/Level/Special/Gather siblings, or the pairing breaks.',
    }), 'textValue', '', null, 'Maps');
    createSetting('Rtributespecialselection', 'TrF: Special Selection',tip({
        what: 'The list of map special modifiers, one per zone, Tribute Farming requests &mdash; the raw storage behind the <b>Tribute Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Cell/Tributes/Level/Map/Gather siblings, or the pairing breaks.',
    }), 'textValue', '', null, 'Maps');
    createSetting('Rtributegatherselection', 'TrF: Gather Selection',tip({
        what: 'The list of resources, one per zone, Tribute Farming puts all your workers on &mdash; the raw storage behind the <b>Tribute Farm Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length and order as its Zone/Cell/Tributes/Level/Map/Special siblings, or the pairing breaks.',
    }), 'textValue', '', null, 'Maps');

    //Shrine - U2
    (document.getElementById('Rtributegatherselection') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rshrine', 'AutoShrine',tip({
        what: 'Turns on automatic Bone Shrine charge use at the zone(s), cell(s), and amount(s) you configure in <b>AutoShrine Settings</b> below &mdash; the Universe 2 twin of <b>AutoShrine</b>.',
        cannot: 'Requires Bone Shrine charges to actually be available, and is a separate mechanism from <b>Auto Bone Charge Max</b> elsewhere &mdash; the two do not interact.',
    }), 'boolean', false, null, 'Maps');
    createSetting('Rshrinemaz', 'AutoShrine Settings',tip({
        what: 'Opens the AutoShrine editor: pick the zone, cell, and how many Bone Shrine charges to spend there.',
        how: 'Example: Zone 40, Cell 10, Amount 3 uses 3 Bone Shrine charges the first time you reach cell 10 of zone 40. Using it after cell 80 gets the benefit of all the books.',
        cannot: 'The charge count resets every time you enter a new zone, so <b>Amount</b> means "how many to use at this zone", not a lifetime total.',
    }), 'infoclick', false, null, 'Maps');
    createSetting('Rshrinezone', 'AutoShrine: Zone',tip({
        what: 'The list of zones AutoShrine triggers at &mdash; the raw storage behind the <b>AutoShrine Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length, in the same order, as its <b>Cell</b> and <b>Amount</b> siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Rshrinecell', 'AutoShrine: Cell',tip({
        what: 'The list of cells (one per zone) AutoShrine waits for before spending charges &mdash; the raw storage behind the <b>AutoShrine Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length, in the same order, as its <b>Zone</b> and <b>Amount</b> siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Rshrineamount', 'AutoShrine: Amount',tip({
        what: 'The list of charge counts (one per zone) AutoShrine spends &mdash; the raw storage behind the <b>AutoShrine Settings</b> popup above.',
        cannot: 'Edit through the popup rather than typing here directly. This array must stay the same length, in the same order, as its <b>Zone</b> and <b>Cell</b> siblings, or the pairing breaks.',
    }), 'multiValue', [-1], null, 'Maps');
    createSetting('Rshrinecharge', 'AutoShrine: Charge',tip({
        what: 'Internal bookkeeping AutoTrimps uses to track how many Bone Shrine charges it has already spent at the current zone.',
        cannot: 'Not meant to be edited by hand &mdash; it resets to 0 automatically every time you enter a new zone.',
    }), 'value', 0, null, 'Maps');


    //Spire

    //Line 1
    createSetting('MaxStacksForSpire', 'Max Map Bonus for Spire',tip({
        what: 'Farms Map Bonus stacks up to 10 (the practical max) before continuing a Spire run, instead of entering or continuing at whatever stack you happened to have.',
        ignoredWhen: 'Below your <b>Ignore Spires Until</b> zone, or you are not currently in an active Spire.',
    }), 'boolean', false, null, 'Spire');
    createSetting('MinutestoFarmBeforeSpire', 'Farm Before Spire',tip({
        what: 'Farms zone-200 (or Boss World) maps for this many minutes after entering a Spire, before actually continuing into it.',
        how: '0 disables it.',
        cannot: 'Cannot be set to run forever \u2014 a negative number does not mean "infinite". It behaves exactly like 0, because the elapsed-time comparison it drives can never be true for a negative target. Use a very large number of minutes instead.',
        ignoredWhen: 'Below your <b>Ignore Spires Until</b> zone, or you are not currently in an active Spire.',
    }), 'value', '0', null, 'Spire');
    createSetting('IgnoreSpiresUntil', 'Ignore Spires Until',tip({
        what: 'The zone gate for every Spire-specific setting on this tab, plus the Scryer\'s in-Spire stance option: none of them take effect while your current world zone is below this value \u2014 even while you are standing inside an active Spire.',
        how: '0 makes every Spire setting active from Spire 1 onward.',
    }), 'value', '200', null, 'Spire');
    createSetting('ExitSpireCell', 'Exit Spire After Cell',tip({
        what: 'Exits the Spire once you have cleared this cell (1-100; e.g. 40 = Row 4).',
        how: 'Also feeds AT\'s enemy-difficulty planning for the Spire, so it gears up for the difficulty at your exit cell rather than for the full run.',
        cannot: '0 or a negative number disables it. Values above 100 never trigger \u2014 a Spire floor only has 100 cells.',
        ignoredWhen: 'Universe 2 (Radon) \u2014 the Mega-Spire has no per-cell exit implemented yet.',
    }), 'value', '-1', null, 'Spire');
    createSetting('SpireBreedTimer', 'Spire Breed Timer',tip({
        what: 'Overrides the game\'s own GA (breed) timer while you are in an active, non-Daily Spire above <b>Ignore Spires Until</b>, so you can breed more or less aggressively than your normal target.',
        cannot: 'Cannot reliably restore the GA timer you had before entering the Spire. AT is meant to remember it and put it back when you leave, but a bug in that restore logic means it usually resets your GA timer to blank on exit instead, rather than your original value.',
    }), 'value', -1, null, 'Spire');
    createSetting('PreSpireNurseries', 'Nurseries pre-Spire',tip({
        what: 'Sets a separate Nursery cap that applies specifically while preparing for or running a Spire, above zone 200 (or any zone once <b>Ignore Spires Until</b> allows Spire settings that early).',
        how: 'Overrides both <b>No Nurseries Until z</b> and <b>Max Nurseries</b> while active, so you can keep your general Nursery settings tight and still stock up before a Spire push.',
        cannot: '-1 disables it.',
    }), 'value', -1, null, 'Spire');
    createSetting('spireshitbuy', 'Buy Gear in Spire',tip({
        what: 'Buys Weapons and Armor while in the Spire regardless of your H:D ratio, so you keep gearing up even when AT would normally consider you strong enough already.',
        how: 'Still respects your max gear level cap.',
        ignoredWhen: 'Below your <b>Ignore Spires Until</b> zone, or you are not currently in an active Spire.',
    }), 'boolean', false, null, 'Spire');
    createSetting('SkipSpires', 'Skip Spires',tip({
        what: 'Pushes through the Spire even undergeared, once <b>Farm Before Spire</b> (if set) is done \u2014 AT stops waiting for its usual health/damage bar and just keeps going.',
        how: 'Useful to accept dying in the Spire rather than stalling there indefinitely once your gear can\'t keep up.',
        ignoredWhen: 'Below your <b>Ignore Spires Until</b> zone, or you are not currently in an active Spire.',
    }), 'boolean', false, null, 'Spire');


    //Raiding

    //Line 1
    createSetting('Praidingzone', 'P Raiding Z',tip({
        what: 'Zones to Prestige-Raid at &mdash; hunts down every gear prestige in the maps above the zone(s) you list here.',
        how: 'Example: <b>495</b> raids maps 501-505 in sequence. Once every prestige from those maps is obtained, AT reverts to regular farming. <b>Multiple values work, like this: 495,506,525.</b> Use <b>P Raiding HD</b> to control how many of the five +maps it actually attempts &mdash; helpful for Spire, and best used in Poison zones.',
    }), 'multiValue', [-1], null, 'Raiding');
    createSetting('Praidingcell', 'P Raiding Cell',tip({
        what: 'Cell to start P Raiding at, once you reach a P Raiding zone.',
        how: '<b>-1</b> starts at cell 1. If you also run BW Raiding, set this below your BW Raiding cell.',
    }), 'value', -1, null, 'Raiding');
    createSetting('PraidingHD', 'P Raiding HD',tip({
        what: 'How far into the five +N prestige maps to push, based on your H:D ratio.',
        how: 'AT compares this against the H:D each +N map would take to clear; the higher you set it, the higher +N maps it will attempt (up to +5, or further with Hardcore P Raiding). <b>-1 or 0</b> removes the check entirely, so it always attempts every +N map.',
        ignoredWhen: '<b>Hardcore P Raiding</b> is on &mdash; that mode replaces this check with its own fragment-farming logic.',
    }), 'value', -1, null, 'Raiding');
    createSetting('PraidingP', 'P Raiding Poison',tip({
        what: 'Caps how far into the +N prestige maps AT will push while empowered by <b>Poison</b>.',
        how: 'Example: <b>10</b> allows up to +10 maps in Poison. Use this instead of P Raiding HD if its math looks off for Poison zones &mdash; both can be set at once. <b>-1 or 0</b> = no max.',
        ignoredWhen: '<b>Hardcore P Raiding</b> is on.',
    }), 'value', -1, null, 'Raiding');
    createSetting('PraidingI', 'P Raiding Ice',tip({
        what: 'Caps how far into the +N prestige maps AT will push while empowered by <b>Ice</b>.',
        how: 'Example: <b>10</b> allows up to +10 maps in Ice. Use this instead of P Raiding HD if its math looks off for Ice zones &mdash; both can be set at once. <b>-1 or 0</b> = no max.',
        ignoredWhen: '<b>Hardcore P Raiding</b> is on.',
    }), 'value', -1, null, 'Raiding');
    createSetting('PraidHarder', 'Hardcore P Raiding',tip({
        what: '<b>EXPERIMENTAL.</b> Replaces the normal P Raiding engine with a more aggressive one, for the same zones you list in <b>P Raiding Z</b>.',
        how: 'Always buys the highest-prestige map it can afford at each P Raiding zone, farming fragments for it if it can\'t. This does not add a separate raid list &mdash; it takes over <b>P Raiding Z</b> and ignores P Raiding HD, Poison, and Ice entirely.',
        cannot: 'Does nothing if <b>P Raiding Z</b> is empty, even with this on.',
    }), 'boolean', false, null, 'Raiding');
    createSetting('MaxPraidZone', 'Max P Raid Zones',tip({
        what: 'How far past each P Raiding zone Hardcore P Raiding is allowed to push, paired position-by-position with <b>P Raiding Z</b>.',
        how: 'Example: P Raiding Z is <b>491, 495</b> and this is <b>495, 505</b> &mdash; AT raids up to 495 starting from 491, then up to 505 starting from 495. <b>-1</b>, a missing pair, or an invalid value all default to the highest available prestige (up to +10).',
        ignoredWhen: '<b>Hardcore P Raiding</b> is off.',
    }), 'multiValue', [-1], null, 'Raiding');
    createSetting('PraidFarmFragsZ', 'Farm Fragments Z',tip({
        what: 'Zones where Hardcore P Raiding is allowed to farm fragments if it can\'t afford the map it wants for that raid.',
        how: '<b>-1</b> = never farm fragments for P Raiding.',
        ignoredWhen: '<b>Hardcore P Raiding</b> is off.',
    }), 'multiValue', [-1], null, 'Raiding');
    createSetting('PraidBeforeFarmZ', 'Raid before farm Z',tip({
        what: 'Zones where Hardcore P Raiding buys the best map it can afford right away, instead of farming fragments for a better one first.',
        how: 'Mostly useful for a lucky Speedexplorer pickup, or when fragment farming is unusually slow. <b>-1</b> = always try farming fragments first.',
        ignoredWhen: '<b>Hardcore P Raiding</b> is off.',
    }), 'multiValue', [-1], null, 'Raiding');
    createSetting('BWraid', 'BW Raiding',tip({
        what: 'Turns on BW (Bionic World) Raiding: hunts every gear prestige out of your furthest Bionic World, at the zone(s) you set below.',
        overwritten: 'AT turns your game\'s <b>Climb BW</b> option off itself while this runs, so BW leveling doesn\'t compete with the raid.',
    }), 'boolean', false, null, 'Raiding');
    createSetting('bwraidcell', 'BW Raiding Cell',tip({
        what: 'Cell to start BW Raiding at, once you reach a BW Raiding zone.',
        how: '<b>-1</b> starts at cell 1. If you also run P Raiding, set this above your P Raiding cell.',
    }), 'value', -1, null, 'Raiding');
    createSetting('BWraidingz', 'Z to BW Raid',tip({
        what: 'Zones to BW Raid at, paired position-by-position with <b>Max BW to raid</b>.',
        how: 'Example: <b>480, 495</b> paired with Max BW to raid <b>500, 515</b> raids up to BW level 500 starting at zone 480, then up to 515 starting at zone 495. Lower BWs are skipped once you already have enough damage for them. Once every prestige is obtained, AT returns to regular farming.',
        cannot: 'The two lists must be the same length, or BW Raiding can fail.',
    }), 'multiValue', [-1], null, 'Raiding');
    createSetting('BWraidingmax', 'Max BW to raid',tip({
        what: 'How far into each Bionic World to raid, paired position-by-position with <b>Z to BW Raid</b>.',
        how: 'See <b>Z to BW Raid</b> for how the pairing works.',
    }), 'multiValue', [-1], null, 'Raiding');


    //RRaiding

    //Line 1
    createSetting('RAMPraid', 'Praiding',tip({
        what: '<b>MASTER BUTTON.</b> Turns on Prestige Raiding for U2: hunts down every gear prestige in the maps you configure under PR: Zone / PR: Raid / PR: Cell.',
        how: 'Example: world is 95, PR: Zone is <b>[95,105]</b>, PR: Raid is <b>[105,115]</b>, PR: Cell is <b>1</b>. AT enters map creation at cell 1 and creates prestige maps 101-105 in sequence, falling back to a non-prestige map (then the highest map it can afford) if it can\'t afford a prestige one. Once all five are created it runs them lowest-first, then recycles them if <b>PR: Recycle</b> is on.',
        cannot: 'Does nothing until PR: Zone and PR: Raid both have a first entry above 0.',
    }), 'boolean', false, null, 'Raiding');
    createSetting('RAMPraidmaz', 'Praiding Settings',tip({
        what: 'Opens the Praiding settings popup: PR: Zone / Raid / Cell / Frag / Recycle.',
    }), 'infoclick', false, null, 'Raiding');
    createSetting('RAMPraidzone', 'PR: Zone',tip({
        what: 'Zones that trigger Prestige Raiding, paired position-by-position with <b>PR: Raid</b>.',
    }), 'multiValue', [-1], null, 'Raiding');
    createSetting('RAMPraidraid', 'PR: Raid',tip({
        what: 'How far to raid to, paired position-by-position with <b>PR: Zone</b>.',
        how: 'Example: PR: Zone <b>95</b> paired with PR: Raid <b>105</b> raids every prestige between zone 95 and 105.',
    }), 'multiValue', [-1], null, 'Raiding');
    createSetting('RAMPraidcell', 'PR: Cell',tip({
        what: 'Cell to start Prestige Raiding at, once you reach a PR: Zone entry.',
        how: 'Paired position-by-position with PR: Zone. Leaving an entry at <b>-1</b> starts at cell 1.',
    }), 'multiValue', [-1], null, 'Raiding');
    createSetting('RAMPraidfrag', ['PR: Frag', 'PR: Frag Min', 'PR: Frag Max'],tip({
        what: 'Whether to farm fragments to afford the maps Prestige Raiding wants.',
        how: '<b>PR: Frag Min</b> targets the cheapest maps that still get all five prestiges (no special modifier, perfect sliders, or size/difficulty beyond what\'s needed) and prioritizes buying the most maps for a smooth sequential raid. <b>PR: Frag Max</b> goes for the strongest possible raid and may take longer to farm for. Prefer Min if your heirloom lacks frag drop or explorer efficiency; Max if you\'re confident in your fragment income.',
    }), 'multitoggle', 0, null, 'Raiding');
    createSetting('RAMPraidrecycle', 'PR: Recycle',tip({
        what: 'Recycles the maps Prestige Raiding created, once the raid is done with them.',
    }), 'boolean', false, null, 'Raiding');



    //Windstacking

    //Line 1
    createSetting('windstackingfiller', 'Use Daily Tab for Dailies!',tip({
        what: 'A label, not a control &mdash; toggling it changes nothing.',
        how: 'It exists only to point out that <b>Daily</b> Windstacking has its own settings on the <b>Daily</b> tab; the boxes below only apply to normal runs.',
    }), 'boolean', false, null, 'Windstacking');
    createSetting('turnwson', 'Turn WS On!',tip({
        what: 'A reminder checkbox, not a control &mdash; toggling it changes nothing.',
        cannot: 'Cannot turn Windstacking on for you. Go to <b>Combat &rarr; AutoStance</b> and pick <b>Windstacking</b> there; once you do, this reminder disappears and the settings below become live.',
    }), 'boolean', false, null, 'Windstacking');
    createSetting('WindStackingMin', 'Windstack Min Zone',tip({
        what: 'Zone from which Windstacking Stance is allowed to actually withhold damage to build wind stacks.',
        how: 'Below this zone AT stays in D stance and ignores every other Windstacking setting. At or above it, AT holds back in S stance until it hits its target stacks, switches to D, then repeats. Overrides your Scryer settings while active.',
        ignoredWhen: '<b>AutoStance</b> is not set to <b>Windstacking</b>.',
    }), 'value', '-1', null, 'Windstacking');
    createSetting('WindStackingMinHD', 'Windstack H:D',tip({
        what: 'H:D threshold that decides HOW AT windstacks once you\'re in a wind zone above <b>Windstack Min Zone</b>.',
        how: 'Below this H:D, AT uses W stance inside Windlight and S stance outside it. Above it, AT switches to manual windstacking via heirloom swapping and stance changes. Set this absurdly high (e.g. <b>1e30</b>) to just stay on W stance always.',
    }), 'value', '-1', null, 'Windstacking');
    createSetting('WindStackingMax', 'Windstack Stacks',tip({
        what: 'How many wind stacks to build before switching out of withholding into D stance.',
        how: 'During Wind Enlightenment, AT automatically adds 100 to whatever you set here &mdash; so <b>200</b> becomes a real target of 300 during Enlightenment.',
    }), 'value', '200', null, 'Windstacking');
    createSetting('windcutoff', 'Wind Damage Cutoff',tip({
        what: 'Replaces AT\'s usual gear-buying damage cutoff while Windstacking, so it can hold your damage down instead of maximizing it.',
        how: 'Normally, a higher cutoff makes AT decide it has "enough" damage sooner and buy less. Set this high (e.g. <b>160</b>) and AT resists buying more weapon damage until your damage is wildly overkill for the zone &mdash; keeping it low so you accumulate wind stacks instead of one-shotting through them. <b>-1</b> disables this override and falls back to the normal Equipment Cut Off.',
        ignoredWhen: 'Your world zone is below <b>Windstack Min Zone</b>.',
    }), 'value', '-1', null, 'Windstacking');
    createSetting('windcutoffmap', 'Wind Map Cutoff',tip({
        what: 'Same idea as <b>Wind Damage Cutoff</b>, but for the map-bonus decision instead of gear-buying.',
        how: 'Set high, it holds off getting the max map bonus the same way Wind Damage Cutoff holds off buying gear. <b>-1</b> disables this override and falls back to the normal Map Cut Off.',
        ignoredWhen: 'Your world zone is below <b>Windstack Min Zone</b>.',
    }), 'value', '-1', null, 'Windstacking');
    createSetting('wsmax', 'WS MAX',tip({
        what: 'Zone from which AT withholds Coordination purchases entirely, to squeeze the maximum possible wind stacks out of every wind zone.',
        how: 'Not recommended for normal play &mdash; this deliberately keeps your damage down for a whole run. Useful for pushing a personal best. <b>-1</b> disables it.',
        ignoredWhen: '<b>WSM H:D</b> is not a positive number, or your current H:D is already above it.',
    }), 'value', '-1', null, 'Windstacking');
    createSetting('wsmaxhd', 'WSM H:D',tip({
        what: 'H:D threshold used by <b>WS MAX</b> to decide when to withhold Coordination.',
        how: 'Works the same way as the normal H:D setting used elsewhere. Only matters once <b>WS MAX</b>\'s zone has been reached.',
    }), 'value', '-1', null, 'Windstacking');



    //ATGA

    //Line 1
    createSetting('ATGA2', 'ATGA',tip({
        what: 'Master switch for ATGA (AT Geneticist Assist): hires and fires Geneticists to hit a target breed timer, instead of the game\'s own Auto Geneticist.',
        cannot: 'Turning this on by itself does nothing &mdash; <b>ATGA: Timer</b> must also be a positive number, or ATGA never runs no matter how the other ATGA settings are configured. Conflicts with the game\'s own Auto Geneticist (vanilla GA) if both are left on &mdash; use one or the other.',
        ignoredWhen: 'The <b>Trapper</b> challenge is active, or Geneticist is still locked.',
    }), 'boolean', false, null, 'ATGA');
    createSetting('ATGA2gen', 'ATGA: Gen %',tip({
        what: 'Caps how much of your current food ATGA is willing to spend on the next single Geneticist hire.',
        how: 'Example: set to <b>1</b> and ATGA only hires the next Geneticist if it costs under 1% of your current food. This is checked fresh each time, not cumulatively.',
    }), 'value', '1', null, 'ATGA');
    createSetting('ATGA2timer', 'ATGA: Timer',tip({
        what: 'The base breed timer, in seconds, ATGA tries to hit by hiring or firing Geneticists.',
        cannot: '<b>This value gates the entire ATGA tab.</b> Every override below (Before/After Z, Spire, C2, Daily) only takes effect while this is a positive number &mdash; leave it at 0 or -1 and nothing in ATGA runs, however the overrides are configured.',
    }), 'value', '-1', null, 'ATGA');

    //Zone Timers
    (document.getElementById('ATGA2timer') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('zATGA2timer', 'ATGA: T: Before Z',tip({
        what: 'Zone below which ATGA switches from the base timer to <b>ATGA: T: BZT</b>.',
        how: 'Useful for pushing content like Liquimp faster.',
        ignoredWhen: '<b>ATGA: T: BZT</b> is not a positive number, or <b>ATGA: Timer</b> is not a positive number.',
    }), 'value', '-1', null, 'ATGA');
    createSetting('ztATGA2timer', 'ATGA: T: BZT',tip({
        what: 'Breed timer ATGA uses below the zone set in <b>ATGA: T: Before Z</b>, overriding the base timer.',
        cannot: 'Does not apply during challenges.',
        ignoredWhen: '<b>ATGA: T: Before Z</b> is not a positive number, or <b>ATGA: Timer</b> is not a positive number.',
    }), 'value', '-1', null, 'ATGA');
    createSetting('ATGA2timerz', 'ATGA: T: After Z',tip({
        what: 'Zone at or above which ATGA switches from the base timer to <b>ATGA: T: AZT</b>.',
        how: 'Useful for super-push runs.',
        ignoredWhen: '<b>ATGA: T: AZT</b> is not a positive number, or <b>ATGA: Timer</b> is not a positive number.',
    }), 'value', '-1', null, 'ATGA');
    createSetting('ATGA2timerzt', 'ATGA: T: AZT',tip({
        what: 'Breed timer ATGA uses at or above the zone set in <b>ATGA: T: After Z</b>, overriding the base timer.',
        cannot: 'Does not apply during challenges.',
        ignoredWhen: '<b>ATGA: T: After Z</b> is not a positive number, or <b>ATGA: Timer</b> is not a positive number.',
    }), 'value', '-1', null, 'ATGA');

    //Spire Timers
    (document.getElementById('ATGA2timerzt') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('sATGA2timer', 'ATGA: T: Spire',tip({
        what: 'Breed timer ATGA uses while an ordinary (non-Daily) Spire is active, overriding every timer above it.',
        how: 'Nothing else in ATGA can override this once it applies &mdash; every timer with higher priority than it only takes effect during a Daily, which this excludes.',
        cannot: 'Do not also set the ATGA timer on the Spire tab &mdash; that one drives the game\'s own vanilla GA instead, and the two will fight.',
        ignoredWhen: 'A Daily is active, Ignore Spires is covering this zone, or <b>ATGA: Timer</b> is not a positive number.',
    }), 'value', '-1', null, 'ATGA');
    createSetting('dsATGA2timer', 'ATGA: T: Daily Spire',tip({
        what: 'Breed timer ATGA uses while a Daily Spire is active, overriding the normal and Hard Daily timers.',
        cannot: 'Do not also set the ATGA timer on the Spire tab &mdash; that one drives the game\'s own vanilla GA instead, and the two will fight.',
        ignoredWhen: 'Not a Daily, Ignore Spires is covering this zone, or <b>ATGA: Timer</b> is not a positive number. Can itself be overridden by <b>ATGA: Auto Dailies</b> below.',
    }), 'value', '-1', null, 'ATGA');

    //Daily Timers
    (document.getElementById('dsATGA2timer') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('dATGA2Auto', ['ATGA: Manual', 'ATGA: Auto No Spire', 'ATGA: Auto Dailies'],tip({
        what: '<b>EXPERIMENTAL.</b> Computes a Bogged/Plague-tuned breed timer automatically instead of using a fixed number, overriding every other ATGA Daily timer when it applies.',
        how: '<b>Auto Dailies</b> applies whenever the active Daily is Bogged or Plague. <b>Auto No Spire</b> applies under that same Bogged/Plague condition, but only while a Daily Spire is also active &mdash; the opposite of what the name suggests, so double-check this matches what you expect before relying on it.',
        ignoredWhen: 'Not a Daily, the Daily is not Bogged or Plague, or <b>ATGA: Timer</b> is not a positive number.',
    }), 'multitoggle', 2, null, 'ATGA');
    createSetting('dATGA2timer', 'ATGA: T: Dailies',tip({
        what: 'Breed timer ATGA uses on ordinary Dailies (no Bogged/Plague/etc.), overriding the base timer and the Before/After Z overrides.',
        how: 'Useful for pushing the last bit out of a Daily.',
        ignoredWhen: 'Not a Daily, or <b>ATGA: Timer</b> is not a positive number. Can itself be overridden by Hard Daily, Daily Spire, or Auto Dailies below.',
    }), 'value', '-1', null, 'ATGA');
    createSetting('dhATGA2timer', 'ATGA: T: D: Hard',tip({
        what: 'Breed timer ATGA uses on Hard Dailies &mdash; Bogged, Plague, Bloodthirst, or Dailies with heavy negative mods &mdash; overriding the base timer, Before/After Z, and the normal Daily timer.',
        ignoredWhen: 'Not a Daily, the Daily isn\'t Bogged/Plague/Pressure, or <b>ATGA: Timer</b> is not a positive number. Can itself be overridden by Daily Spire or Auto Dailies below.',
    }), 'value', '-1', null, 'ATGA');

    //C2 Timers
    (document.getElementById('dhATGA2timer') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('cATGA2timer', 'ATGA: T: C2',tip({
        what: 'Breed timer ATGA uses in C2 (squared) challenges, overriding the base timer and Before/After Z.',
        ignoredWhen: 'Not running a squared challenge, the challenge is Electricity/Nom/Toxicity (those use the Hard C2 timer instead), or <b>ATGA: Timer</b> is not a positive number.',
    }), 'value', '-1', null, 'ATGA');
    createSetting('chATGA2timer', 'ATGA: T: C: Hard',tip({
        what: 'Breed timer ATGA uses in the harder C2 (squared) challenges &mdash; Electricity, Nom, Toxicity &mdash; overriding the base timer, Before/After Z, and the normal C2 timer.',
        ignoredWhen: 'Not running one of those three squared challenges, or <b>ATGA: Timer</b> is not a positive number.',
    }), 'value', '-1', null, 'ATGA');



    //Challenges

    //Hide
    createSetting('Rchallengehide', 'Hide Stuff',tip({
        what: 'Reveals the eleven per-challenge "hide" toggles below (Quag, Arch, Mayhem, Storm, Insanity, Exterminate, Nurture, Pandemonium, Alchemy, Hypothermia, Desolation), so a challenge\'s settings can be tucked out of view once configured.',
        how: 'Purely cosmetic \u2014 it does not change what any automation does, only what you can see. Turn it off again once you\'ve set the individual hide toggles you want.',
        ignoredWhen: 'Universe 1 (Helium mode) \u2014 the whole Challenges tab is Universe 2 (Radon) only.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rchallengehidequag', 'Quag',tip({
        what: 'Hides the Quagmire (Black Bog) settings from the Challenges tab.',
        ignoredWhen: 'Universe 1, or while Hide Stuff above is off (this toggle is itself hidden then).',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rchallengehidearch', 'Arch',tip({
        what: 'Hides the Archaeology settings from the Challenges tab.',
        ignoredWhen: 'Universe 1, or while Hide Stuff above is off (this toggle is itself hidden then).',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rchallengehidemayhem', 'Mayhem',tip({
        what: 'Hides the Mayhem settings from the Challenges tab.',
        ignoredWhen: 'Universe 1, or while Hide Stuff above is off (this toggle is itself hidden then).',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rchallengehidestorm', 'Storm',tip({
        what: 'Hides the Storm settings from the Challenges tab.',
        ignoredWhen: 'Universe 1, or while Hide Stuff above is off (this toggle is itself hidden then).',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rchallengehideinsanity', 'Insanity',tip({
        what: 'Hides the Insanity settings from the Challenges tab.',
        ignoredWhen: 'Universe 1, or while Hide Stuff above is off (this toggle is itself hidden then).',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rchallengehideexterminate', 'Exterminate',tip({
        what: 'Hides the Exterminate settings from the Challenges tab.',
        ignoredWhen: 'Universe 1, or while Hide Stuff above is off (this toggle is itself hidden then).',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rchallengehidenurture', 'Nurture',tip({
        what: 'Hides the Nurture setting from the Challenges tab.',
        ignoredWhen: 'Universe 1, or while Hide Stuff above is off (this toggle is itself hidden then).',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rchallengehidepanda', 'Pandemonium',tip({
        what: 'Hides the Pandemonium settings from the Challenges tab.',
        ignoredWhen: 'Universe 1, or while Hide Stuff above is off (this toggle is itself hidden then).',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rchallengehidealchemy', 'Alchemy',tip({
        what: 'Hides the Alchemy settings from the Challenges tab.',
        ignoredWhen: 'Universe 1, or while Hide Stuff above is off (this toggle is itself hidden then).',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rchallengehidehypothermia', 'Hypothermia',tip({
        what: 'Hides the Hypothermia settings from the Challenges tab.',
        ignoredWhen: 'Universe 1, or while Hide Stuff above is off (this toggle is itself hidden then).',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rchallengehidedeso', 'Desolation',tip({
        what: 'Hides the Desolation settings from the Challenges tab.',
        ignoredWhen: 'Universe 1, or while Hide Stuff above is off (this toggle is itself hidden then).',
    }), 'boolean', false, null, 'Challenges');

    //Quagmire
    (document.getElementById('Rchallengehidedeso') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rblackbog', 'Quagmire',tip({
        what: 'Turns on Black Bog running for the Quagmire challenge: once a zone\'s remaining Motivated-stack target is below what you still hold, AT queues and runs \'The Black Bog\' unique map to burn stacks down.',
        how: 'Configure per-zone targets with Quagmire Settings below \u2014 for each zone you add, set how many Black Bogs you want run there. Motivated stacks start at 100 and count down as Black Bogs complete.',
        ignoredWhen: 'Universe 1, outside the Quagmire challenge, before world 6, or unless Zone and Black Bogs are both set via Quagmire Settings.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rblackbogmaz', 'Quagmire Settings',tip({
        what: 'Opens the Quagmire settings popup, where Zone and Black Bogs below are edited as paired rows.',
        how: 'Zone and Amount are not their own clickable rows in the main list \u2014 they only exist inside this popup.',
        ignoredWhen: 'Universe 1, or while Black Bog Running above is off.',
    }), 'infoclick', false, null, 'Challenges');
    createSetting('Rblackbogzone', 'Zone',tip({
        what: 'The zone(s) at which AT should run Black Bog maps for Quagmire \u2014 one entry per row.',
        how: 'Edited via the Quagmire Settings popup, not as its own row in the main list.',
        ignoredWhen: 'Universe 1, outside Quagmire, or while Black Bog Running is off.',
    }), 'multiValue', [-1], null, 'Challenges');
    createSetting('Rblackbogamount', 'Amount',tip({
        what: 'How many Black Bogs to run at the matching zone from Zone above, before AT considers that tier done.',
        how: 'AT sums every zone\'s target up to and including the current one, and keeps running Black Bogs while your remaining Motivated stacks (100 at Quagmire\'s start) exceed what\'s left to reach that running total. Edited via the Quagmire Settings popup.',
        ignoredWhen: 'Universe 1, outside Quagmire, or while Black Bog Running is off.',
    }), 'multiValue', [-1], null, 'Challenges');

    //Nurture
    createSetting('Rnurtureon', 'Nurture',tip({
        what: 'Lets AT auto-build Laboratories during the Nurture challenge (Laboratory only exists as a buildable building while Nurture is active).',
        how: 'Each Laboratory raises Cruffys\' (Scruffy\'s brother) experience gain, at the cost of tougher enemies. Still respects Max Labs if one is set.',
        ignoredWhen: 'Universe 1, or outside the Nurture challenge \u2014 Laboratory is locked away again the moment the challenge ends.',
    }), 'boolean', false, null, 'Challenges');

    //Arch
    createSetting('Rarchon', 'Archaeology',tip({
        what: 'Turns on AT\'s automatic Archaeology relic-buying string, switching which relic string it hands the game\'s own Archaeology Automator as you cross the zone breakpoints set in First/Second/Third String.',
        how: 'Each string is the game\'s native automator format (e.g. <code>10a,10e</code> = buy relic \'a\' to 10 points, then relic \'e\' to 10), prefixed with the zone at which AT should move on to the next string; Third String has no leading zone \u2014 it just runs for every zone past Second String\'s breakpoint.',
        ignoredWhen: 'Universe 1, or unless First String, Second String AND Third String are all filled in \u2014 leaving any one of the three blank means none of them take effect, at any zone.',
        cannot: 'Cannot run on just one or two of the three strings.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rarchstring1', 'First String',tip({
        what: 'The Archaeology relic string AT hands the game\'s automator up to the zone number at its own front, e.g. <code>70,10a,10e</code> switches away once you pass zone 70.',
        ignoredWhen: 'Universe 1, Archaeology is off, or Second String / Third String is left blank \u2014 all three are required together.',
    }), 'textValue', '', null, 'Challenges');
    createSetting('Rarchstring2', 'Second String',tip({
        what: 'The Archaeology relic string AT switches to after First String\'s zone, up to the zone number at its own front, e.g. <code>94,10a,10e</code> switches away once you pass zone 94.',
        ignoredWhen: 'Universe 1, Archaeology is off, or First String / Third String is left blank \u2014 all three are required together.',
    }), 'textValue', '', null, 'Challenges');
    createSetting('Rarchstring3', 'Third String',tip({
        what: 'The Archaeology relic string AT uses for every zone past Second String\'s breakpoint \u2014 just the relic string itself, with no leading zone number.',
        ignoredWhen: 'Universe 1, Archaeology is off, or First String / Second String is left blank \u2014 all three are required together.',
    }), 'textValue', '', null, 'Challenges');

    //Mayhem
    createSetting('Rmayhemon', 'Mayhem',tip({
        what: 'Turns on Mayhem automation: lets M: Attack and/or M: Health override your normal farm settings and force mapping when the challenge gets dangerous.',
        ignoredWhen: 'Universe 1, outside the Mayhem challenge, or when both M: Attack and M: Health are off below \u2014 Mayhem On alone does nothing.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rmayhemattack', 'M: Attack',tip({
        what: 'Forces mapping when your Health:Damage ratio climbs above M: Attack Boss\'s cut-off \u2014 i.e. when it would take too many average hits to kill the current world boss.',
        ignoredWhen: 'Universe 1, outside Mayhem, while Mayhem On is off, or once the zone\'s Mayhem stacks have already been cleared to 0.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rmayhemhealth', 'M: Health',tip({
        what: 'Forces mapping when your effective health drops below M: Health Cut-off\'s multiple of the worst hit you\'d take \u2014 i.e. when survival is getting tight.',
        ignoredWhen: 'Universe 1, outside Mayhem, while Mayhem On is off, or once the zone\'s Mayhem stacks have already been cleared to 0.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rmayhemabcut', 'M: Attack Boss',tip({
        what: 'The hits-to-kill threshold M: Attack watches: mapping is forced once killing the world boss would take more than this many average hits.',
        how: 'A value of 0 or below falls back to a threshold of 100 hits.',
    }), 'value', '-1', null, 'Challenges');
    createSetting('Rmayhemamcut', 'M: Attack Map',tip({
        what: 'The hits-to-kill threshold M: Smart Map uses when sizing a plus-map: it looks for the highest +1..+6 map you can clear within this many hits per cell.',
        how: 'A value of 0 or below falls back to a threshold of 100 hits.',
        ignoredWhen: 'Only read when M: Maps is set to M: Smart Map.',
    }), 'value', '-1', null, 'Challenges');
    createSetting('Rmayhemhcut', 'M: Health Cut-off',tip({
        what: 'The survival multiplier M: Health and M: Smart Map both use: your effective health must cover this many worst-case enemy hits.',
        how: 'A value of 0 or below falls back to a multiplier of 1 hit.',
    }), 'value', '-1', null, 'Challenges');
    createSetting('Rmayhemmap', ['M: Maps Off', 'M: Highest Map', 'M: Smart Map'],tip({
        what: 'Chooses how AT picks a map once Mayhem forces mapping.',
        how: '<b>M: Highest Map</b> always grabs the highest-level map you own, from any source (Praiding, Time Farming, manually created). <b>M: Smart Map</b> calculates the strongest +1..+6 map you can both survive and clear within M: Attack Map / M: Health Cut-off, buying attributes like Fast Attack as needed.',
        ignoredWhen: 'Universe 1, outside Mayhem, or while Mayhem On is off.',
    }), 'multitoggle', 0, null, 'Challenges');

    //Storm
    createSetting('Rstormon', 'Storm',tip({
        what: 'Turns on Storm farming: forces mapping once your Health:Damage ratio climbs above a target that grows the deeper you go past S: Zone.',
        ignoredWhen: 'Universe 1, outside the Storm challenge, or unless S: Zone, S: H:D and S: Multiplier are ALL set above their unset value \u2014 leaving any one of them unconfigured means Storm farming never activates.',
        cannot: 'Cannot run with only Zone or only H:D configured \u2014 all three must be set together.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rstormzone', 'S: Zone',tip({
        what: 'The zone at which AT starts applying the S: H:D target and S: Multiplier growth for Storm farming.',
        ignoredWhen: 'Universe 1, outside Storm, while Storm On is off, or unless S: H:D and S: Multiplier are also set.',
    }), 'value', '-1', null, 'Challenges');
    createSetting('RstormHD', 'S: H:D',tip({
        what: 'The Health:Damage ratio target AT farms toward at S: Zone; past that zone the target grows by S: Multiplier per zone.',
        how: 'Example: S: Zone 100, S: H:D 10, S: Multiplier 1.2 &rarr; the target is 10 at z100, 12 at z101, 14.4 at z102, and so on \u2014 so the target keeps pace as enemies get stronger instead of stalling forever at one low ratio.',
        ignoredWhen: 'Universe 1, outside Storm, while Storm On is off, or unless S: Zone and S: Multiplier are also set.',
    }), 'value', '-1', null, 'Challenges');
    createSetting('Rstormmult', 'S: Multiplier',tip({
        what: 'The per-zone growth rate applied to S: H:D past S: Zone (see S: H:D\'s example).',
        ignoredWhen: 'Universe 1, outside Storm, while Storm On is off, or unless S: Zone and S: H:D are also set.',
    }), 'value', '-1', null, 'Challenges');

    //Insanity
    createSetting('Rinsanityon', 'Insanity',tip({
        what: 'Turns on Insanity Farming: keeps mapping at a configured zone/cell until you\'ve reached the Insanity stack target set for it.',
        ignoredWhen: 'Universe 1, outside the Insanity challenge, or unless at least one zone/stack pair is configured via Insanity Settings.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rinsanitymaz', 'Insanity Settings',tip({
        what: 'Opens the Insanity Farming settings popup: paired rows of zone, cell, stack target and map level.',
        how: 'Example: Zone 60, Cell 50, Stacks 500, Level 5 &rarr; farms at zone 60 from cell 50 onward, in a +5 map, until you hold 500 Insanity stacks.',
        ignoredWhen: 'Universe 1, or while Insanity is off.',
    }), 'infoclick', false, null, 'Challenges');
    createSetting('Rinsanityfarmzone', 'Insanity Farming',tip({
        what: 'The zone(s) at which AT farms for Insanity stacks \u2014 one row per target.',
        how: 'Edited via the Insanity Settings popup, not as its own row in the main list.',
        ignoredWhen: 'Universe 1, outside Insanity, or while Insanity is off.',
    }), 'multiValue', [-1], null, 'Challenges');
    // #96 sibling: was the STRING '-1' → Array.from('-1') is ['-','1'] → [NaN, 1].
    createSetting('Rinsanityfarmcell', 'IF: Cell',tip({
        what: 'The cell to wait for before starting Insanity Farming at the matching zone.',
        how: 'Edited via the Insanity Settings popup, not as its own row in the main list. Leaving a row\'s cell unset starts it from cell 1.',
        ignoredWhen: 'Universe 1, outside Insanity, or while Insanity is off.',
    }), 'multiValue', [-1], null, 'Challenges');
    createSetting('Rinsanityfarmstack', 'IF: Stacks',tip({
        what: 'The Insanity stack target for the matching zone: AT keeps mapping there until you hold this many stacks (capped at the challenge\'s own maximum).',
        how: 'Edited via the Insanity Settings popup, not as its own row in the main list.',
        ignoredWhen: 'Universe 1, outside Insanity, or while Insanity is off.',
    }), 'multiValue', [-1], null, 'Challenges');
    createSetting('Rinsanityfarmlevel', 'IF: Map Level',tip({
        what: 'How many map levels above the target zone to farm at for Insanity, e.g. Level 5 at Zone 60 farms +5 maps.',
        how: 'Edited via the Insanity Settings popup, not as its own row in the main list.',
        ignoredWhen: 'Universe 1, outside Insanity, or while Insanity is off.',
    }), 'multiValue', [0], null, 'Challenges');
    createSetting('Rinsanityfarmfrag', 'IF: Frags',tip({
        what: 'Farms map fragments instead when AT can\'t yet afford the map it needs for Insanity Farming.',
        ignoredWhen: 'Universe 1, outside Insanity, or while Insanity is off.',
    }), 'boolean', false, null, 'Challenges');

    //Exterminate
    createSetting('Rexterminateon', 'Exterminate',tip({
        what: 'Turns on Exterminate-specific automation: enables E: Equality\'s equality management, and (in principle) E: Calc\'s enemy-stat override.',
        ignoredWhen: 'Universe 1, outside the Exterminate challenge, or \u2014 by itself, with both E: Calc and E: Equality off \u2014 always, since it has no effect on its own. Note E: Calc is currently broken; see its own tooltip.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rexterminatecalc', 'E: Calc',tip({
        what: 'Intended to size your damage/health math against Exterminate\'s toughest fixed mobs (Mantimp for attack, Beetlimp for health) instead of the normal zone-scaled enemy.',
        ignoredWhen: 'Always, currently \u2014 the code that reads this checks for a challenge id of <code>"Extermination"</code>, but the game\'s actual id for this challenge is <code>"Exterminate"</code>. The check can never match, so this setting has no effect no matter how it\'s set.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rexterminateeq', 'E: Equality',tip({
        what: 'Manages Equality stacking against Exterminate\'s bug-type mobs (Arachnimp, Beetlimp, Mantimp, Butterflimp): builds Equality up while you lack the challenge\'s Experienced buff against them, and lets it decay once you have it.',
        ignoredWhen: 'Universe 1, outside Exterminate, or while you\'re inside a map \u2014 this only manages Equality on the world map.',
    }), 'boolean', false, null, 'Challenges');

    //Panda
    createSetting('Rpandaon', 'Pandemonium',tip({
        what: 'Turns on Pandemonium automation, gated by P: Zone below.',
        ignoredWhen: 'Universe 1, outside the Pandemonium challenge, or before reaching P: Zone.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rpandamaps', 'P: Mapping',tip({
        what: 'Automates mapping for Pandemonium: sizes a +1..+6 plus-map you can clear within P: Hits average hits per cell, and runs it.',
        ignoredWhen: 'Universe 1, outside Pandemonium, while Pandemonium On is off, before P: Zone, or while the challenge\'s own Pandemonium stacks are at 0.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rpandazone', 'P: Zone',tip({
        what: 'The zone Pandemonium mapping starts at \u2014 stacks accrued below this zone are ignored entirely.',
        ignoredWhen: 'Universe 1, outside Pandemonium, or while Pandemonium On is off.',
    }), 'value', '-1', null, 'Challenges');
    createSetting('Rpandahits', 'P: Hits',tip({
        what: 'The average-hits-to-kill ceiling P: Mapping sizes its plus-map against; it tries +6 down to +1, picking the highest level that still clears within this many hits, and runs a +1 map anyway if nothing fits.',
        how: 'A value of 0 or below falls back to a threshold of 10 hits.',
    }), 'value', '-1', null, 'Challenges');

    //Alch
    createSetting('Ralchon', 'Alchemy',tip({
        what: 'Turns on Alchemy Farming: keeps mapping at a configured zone/cell, crafting the potion set in AF: Potion, until the target amount is reached.',
        ignoredWhen: 'Universe 1, outside the Alchemy challenge, or unless at least one zone/potion row is configured via Alchemy Settings.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Ralchfarmmaz', 'Alchemy Settings',tip({
        what: 'Opens the Alchemy Farming settings popup: paired rows of zone, cell, potion target, map level and map type.',
        how: 'Example: Zone 81, Cell 50, Potion h15, Level 5, Map Farmlands &rarr; farms at zone 81 from cell 50 onward, in a +5 Farmlands map, crafting toward 15 Herby Brews.',
        ignoredWhen: 'Universe 1, or while Alchemy is off.',
    }), 'infoclick', false, null, 'Challenges');
    createSetting('Ralchfarmzone', 'Alchemy Farming',tip({
        what: 'The zone(s) at which AT farms for Alchemy potions.',
        how: 'Edited via the Alchemy Settings popup, not as its own row in the main list.',
        ignoredWhen: 'Universe 1, outside Alchemy, or while Alchemy is off.',
    }), 'multiValue', [-1], null, 'Challenges');
    // #96 sibling: was the STRING '[-1]' → Array.from('[-1]') is ['[','-','1',']'] → [NaN, NaN, 1, NaN].
    createSetting('Ralchfarmcell', 'AF: Cell',tip({
        what: 'The cell to wait for before starting Alchemy Farming at the matching zone.',
        how: 'Edited via the Alchemy Settings popup, not as its own row in the main list.',
        ignoredWhen: 'Universe 1, outside Alchemy, or while Alchemy is off.',
    }), 'multiValue', [-1], null, 'Challenges');
    createSetting('Ralchfarmstack', 'AF: Potion',tip({
        what: 'The potion and target amount for the matching zone, written as one letter plus a number, e.g. <code>h15</code> for 15 Herby Brews.',
        how: 'Letters: h = Herby Brew, f = Potion of Finding, g = Gaseous Brew, v = Potion of the Void, s = Potion of Strength. AT crafts that potion automatically whenever your held amount is short of the target. Edited via the Alchemy Settings popup, not as its own row in the main list.',
        ignoredWhen: 'Universe 1, outside Alchemy, or while Alchemy is off.',
    }), 'textValue', '', null, 'Challenges');
    createSetting('Ralchfarmlevel', 'AF: Map Level',tip({
        what: 'How many map levels above the target zone to farm at for Alchemy, e.g. Level 5 at Zone 81 farms +5 maps.',
        how: 'Edited via the Alchemy Settings popup, not as its own row in the main list.',
        ignoredWhen: 'Universe 1, outside Alchemy, or while Alchemy is off.',
    }), 'multiValue', [0], null, 'Challenges');
    createSetting('Ralchfarmselection', 'AF: Map Selection',tip({
        what: 'Which map type to use for Alchemy Farming at the matching zone (e.g. Farmlands for herb yield).',
        how: 'Edited via the Alchemy Settings popup, not as its own row in the main list.',
        ignoredWhen: 'Universe 1, outside Alchemy, or while Alchemy is off.',
    }), 'textValue', 'l', null, 'Challenges');
    createSetting('Ralchfarmfrag', 'AF: Frags',tip({
        what: 'Farms map fragments instead when AT can\'t yet afford the map it needs for Alchemy Farming.',
        ignoredWhen: 'Universe 1, outside Alchemy, or while Alchemy is off.',
    }), 'boolean', false, null, 'Challenges');

    //Hypo
    createSetting('Rhypoon', 'Hypothermia',tip({
        what: 'Turns on Hypothermia Farming: keeps mapping at a configured zone/cell, crafting Bonfires until the total set in HF: Bonfire is reached.',
        ignoredWhen: 'Universe 1, outside the Hypothermia challenge, or unless at least one zone/bonfire row is configured via Hypothermia Settings.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rhypofarmmaz', 'Hypothermia Settings',tip({
        what: 'Opens the Hypothermia Farming settings popup: paired rows of zone, cell, bonfire target and map level.',
        how: 'Example: Zone 17, Cell 50, Bonfire 5, Level 5 &rarr; farms at zone 17 from cell 50 onward, in a +5 map, until you hold 5 total Bonfires.',
        ignoredWhen: 'Universe 1, or while Hypothermia is off.',
    }), 'infoclick', false, null, 'Challenges');
    createSetting('Rhypofarmzone', 'Hypothermia Farming',tip({
        what: 'The zone(s) at which AT farms Bonfires for Hypothermia.',
        how: 'Also used by HF: Storage above, which reads its final entry as the last zone Storage should hold wood back on. Edited via the Hypothermia Settings popup, not as its own row in the main list.',
        ignoredWhen: 'Universe 1, outside Hypothermia, or while Hypothermia is off.',
    }), 'multiValue', [-1], null, 'Challenges');
    createSetting('Rhypofarmcell', 'HF: Cell',tip({
        what: 'The cell to wait for before starting Hypothermia Farming at the matching zone.',
        how: 'Edited via the Hypothermia Settings popup, not as its own row in the main list.',
        ignoredWhen: 'Universe 1, outside Hypothermia, or while Hypothermia is off.',
    }), 'multiValue', [-1], null, 'Challenges');
    // #96: was the STRING 'undefined'. getPageSetting does Array.from(value).map(parseInt), and
    // Array.from('undefined') is NINE CHARACTERS → [NaN × 9]. See mapfunctions.ts Rhypo() — the NaN was
    // load-bearing, so the consumer had to state "no target" explicitly BEFORE this could be re-pointed
    // at the [-1] sentinel its siblings (Rhypofarmzone/Rhypofarmcell, Rinsanityfarmstack, …) all use.
    createSetting('Rhypofarmstack', 'HF: Bonfire',tip({
        what: 'The total-Bonfire target for the matching zone: AT keeps holding back wood and crafting Bonfires until you\'ve banked this many overall.',
        how: 'Edited via the Hypothermia Settings popup, not as its own row in the main list.',
        ignoredWhen: 'Universe 1, outside Hypothermia, or while Hypothermia is off.',
    }), 'multiValue', [-1], null, 'Challenges');
    createSetting('Rhypofarmlevel', 'HF: Map Level',tip({
        what: 'How many map levels above the target zone to farm at for Hypothermia, e.g. Level 5 at Zone 17 farms +5 maps.',
        how: 'Edited via the Hypothermia Settings popup, not as its own row in the main list.',
        ignoredWhen: 'Universe 1, outside Hypothermia, or while Hypothermia is off.',
    }), 'multiValue', [0], null, 'Challenges');
    createSetting('Rhypofarmfrag', 'HF: Frags',tip({
        what: 'Farms map fragments instead when AT can\'t yet afford the map it needs for Hypothermia Farming.',
        ignoredWhen: 'Universe 1, outside Hypothermia, or while Hypothermia is off.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rhypocastle', 'Frozen Castle',tip({
        what: 'The zone at which AT starts running the \'Frozen Castle\' unique map to help complete Hypothermia.',
        how: 'Interacts with After Voids below \u2014 whether Frozen Castle waits for voids to finish first depends on that setting.',
        ignoredWhen: 'Universe 1, outside Hypothermia, or set to 0 or below \u2014 Frozen Castle is only ever selected once this is above 0.',
    }), 'value', '-1', null, 'Challenges');
    createSetting('Rhypovoids', 'After Voids',tip({
        what: 'When on, holds off running Frozen Castle (from Frozen Castle Zone above) until every void map for the portal has been cleared; when off, runs it as soon as the zone is reached, voids or not.',
    }), 'boolean', true, null, 'Challenges');
    createSetting('Rhypostorage', 'Storage',tip({
        what: 'Holds back on building Sheds during Hypothermia unless the extra wood capacity is needed to hit HF: Bonfire\'s price target, and disables AutoStorage until you reach the last configured Hypothermia Farming zone.',
        how: 'Trades away some Smithy/Shield-prestige wood spending in exchange for not accidentally overshooting your Bonfire count.',
        ignoredWhen: 'Universe 1, outside Hypothermia, or unless AT\'s own U2 AutoBuildings (the RBuyBuildingsNew setting) is on \u2014 this logic only runs inside that routine, so relying on the game\'s vanilla auto-building makes it a no-op.',
    }), 'boolean', false, null, 'Challenges');
    
    //Desolation
    createSetting('Rdesoon', 'Desolation',tip({
        what: 'Turns on Desolation farming: forces mapping once your Health:Damage ratio climbs above a target that grows the deeper you go past D: Zone.',
        ignoredWhen: 'Universe 1, outside the Desolation challenge, or unless D: Zone, D: H:D and D: Multiplier are ALL set above their unset value \u2014 leaving any one of them unconfigured means Desolation farming never activates.',
        cannot: 'Cannot run with only Zone or only H:D configured \u2014 all three must be set together.',
    }), 'boolean', false, null, 'Challenges');
    createSetting('Rdesozone', 'D: Zone',tip({
        what: 'The zone at which AT starts applying the D: H:D target and D: Multiplier growth for Desolation farming.',
        ignoredWhen: 'Universe 1, outside Desolation, while Desolation On is off, or unless D: H:D and D: Multiplier are also set.',
    }), 'value', '-1', null, 'Challenges');
    createSetting('RdesoHD', 'D: H:D',tip({
        what: 'The Health:Damage ratio target AT farms toward at D: Zone; past that zone the target grows by D: Multiplier per zone.',
        how: 'Example: D: Zone 100, D: H:D 10, D: Multiplier 1.2 &rarr; the target is 10 at z100, 12 at z101, 14.4 at z102, and so on \u2014 so the target keeps pace as enemies get stronger instead of stalling forever at one low ratio.',
        ignoredWhen: 'Universe 1, outside Desolation, while Desolation On is off, or unless D: Zone and D: Multiplier are also set.',
    }), 'value', '-1', null, 'Challenges');
    createSetting('Rdesomult', 'D: Multiplier',tip({
        what: 'The per-zone growth rate applied to D: H:D past D: Zone (see D: H:D\'s example).',
        ignoredWhen: 'Universe 1, outside Desolation, while Desolation On is off, or unless D: Zone and D: H:D are also set.',
    }), 'value', '-1', null, 'Challenges');



    //Combat

    //Line 1
    createSetting('BetterAutoFight', ['Better AutoFight OFF', 'Better Auto Fight', 'Vanilla'],tip({
        what: 'Decides how AT gets your squad into a fight.',
        cannot: 'If you run AutoPortal with this set to Off, the game can sit idle after a portal until you click Fight yourself &mdash; not great for AFK play.',
        how: 'Off leaves fighting to you or the vanilla AutoFight button. <b>Better Auto Fight</b> sends your squad whenever it\'s dead, a new squad is ready, the breed-timer target is exceeded, or breeding will finish in under 0.5s. <b>Vanilla</b> layers the game\'s own AutoFight logic on top and makes sure you fight before portaling. Works the same way in both universes.',
    }), 'multitoggle', 1, null, "Combat");
    createSetting('AutoStance', ['Auto Stance OFF', 'Auto Stance', 'D Stance', 'Windstacking'],tip({
        what: 'Chooses how AT switches your battle formation to keep your squad alive.',
        ignoredWhen: 'Universe 2 (Radon) does not read this setting at all &mdash; U2 formation control comes from Better AutoFight, Manage Equality and Armor Magic instead, with no manual stance dial.',
        how: '<b>Auto Stance</b> picks the safest formation each tick from a survival calc. <b>D Stance</b> locks you into D regardless of health. <b>Windstacking</b> (for after z230) stays in D except while you\'re actively windstacking, and swaps your High/Low Damage heirlooms (set on the Heirlooms tab) to do it &mdash; only useful once Transfer is maxed and Wind Empowerment is high.',
    }), 'multitoggle', 1, null, "Combat");
    createSetting('IgnoreCrits', ['Safety First', 'Ignore Void Strength', 'Ignore All Crits'],tip({
        what: 'Controls which crit multipliers AT\'s survival math accounts for when picking a stance.',
        ignoredWhen: 'Ignored in Universe 2, and hidden whenever AutoStance is set to Windstacking (option 3) &mdash; windstacking does not run this calc.',
        cannot: 'This only changes what AT plans for, not what the game actually rolls &mdash; a more aggressive option does not stop real crits from landing.',
        how: '<b>Safety First</b> counts every crit source: corrupted-enemy crits, Corrupted Precision / void-strength crits, and challenge crits. <b>Ignore Void Strength</b> drops only the void-strength crit multiplier from the calc; mutation and challenge crits are still counted. <b>Ignore All Crits</b> drops every crit multiplier, treating every hit as non-crit.',
    }), 'multitoggle', 0, null, 'Combat');
    createSetting('PowerSaving', ['AutoAbandon', 'Don\'t Abandon', 'Only Rush Voids'],tip({
        what: 'Controls whether AT will jump into Maps/void/prestige early, before your squad is ideally ready, when it judges you need to.',
        ignoredWhen: 'U1 only (#44): not read in Universe 2 (Radon). To rush void maps in U2, use <b>Void Maps</b> / <b>Voids Cell</b> / <b>New Voids Mod</b> on the Maps tab instead.',
        cannot: 'With Don\'t Abandon selected, AT can no longer auto-recover from a stuck Scryer stance through this path.',
        how: '<b>AutoAbandon</b> lets AT commit early whenever it detects you need a prestige, need to void, are in a Lead-parity or farming window, or your Scryer stance is stuck. <b>Don\'t Abandon</b> turns this early-entry check off entirely &mdash; AT keeps waiting on World even if that risks getting stuck. <b>Only Rush Voids</b> keeps the early-entry check for voiding only, not for prestige or farming triggers.',
    }), 'multitoggle', 0, null, 'Combat');
    createSetting('ForceAbandon', 'Trimpicide',tip({
        what: 'Sacrifices your current squad to fetch a fresh one once your Anticipation stacks fall behind.',
        ignoredWhen: 'Never fires in the Spire. Ignored in Universe 2.',
        how: 'Fires once your breed timer has run past 30 seconds (45 with the Patience talent) and Anticipation stacks have not caught up. Kills the squad (Trimpicide) for a new one on the World map, or abandons the current map if you are in a void.',
    }), 'boolean', true, null, 'Combat');
    createSetting('DynamicGyms', 'Dynamic Gyms',tip({
        what: 'Stops AT from buying more Gyms once your block comfortably beats the enemy\'s attack.',
        ignoredWhen: 'Ignored in Universe 2.',
        how: 'Checks your block against both the current enemy\'s attack and a projected cell-99 enemy at your zone, plus a health / Crushed / Explosive-daily safety check. Works alongside Max Gyms and Gym Wall (whichever stops buying first wins) rather than replacing them.',
    }), 'boolean', false, null, 'Combat');
    createSetting('AutoRoboTrimp', 'AutoRoboTrimp',tip({
        what: 'Fires the RoboTrimp MagnetoShriek ability once you reach this zone, and every 5 zones after.',
        ignoredWhen: 'Ignored in Universe 2.',
        how: 'Checked only when you enter a new zone (not every tick), and skipped in liquid zones or while Shriek is already active. Use 0 to turn it off.',
    }), 'value', '60', null, 'Combat');

    //Line 2
    createSetting('fightforever', 'Fight Always',tip({
        what: 'Sends your squad out to fight even when Better AutoFight decided not to.',
        ignoredWhen: 'Ignored in Universe 2 (use the Rfightforever twin instead).',
        how: 'Set to 0 to always send trimps out when they are not fighting. Set above 0 to only send them when your H:D (Health:Damage) ratio is at or below this number &mdash; i.e. send them out even though the fight looks risky. -1 turns this off.',
    }), 'value', '-1', null, 'Combat');
    createSetting('addpoison', 'Poison Calc',tip({
        what: 'Factors Poison Empowerment into AT\'s damage calc.',
        ignoredWhen: 'Ignored in Universe 2.',
        how: 'Experimental. May speed up poison-zone clears by letting AT credit the extra poison damage when deciding stances and buys.',
    }), 'boolean', false, null, 'Combat');
    createSetting('fullice', 'Ice Calc',tip({
        what: 'Changes how AT estimates your damage bonus from Ice Empowerment.',
        ignoredWhen: 'Ignored in Universe 2.',
        how: 'On always assumes the full Ice damage bonus (x2, or x3 with Fluffy\'s Nature\'s Wrath reward) regardless of the current Ice debuff. Off scales the bonus with the enemy\'s actual Ice debuff level. Meant to stop AT\'s H:D readout from jumping around as the debuff fluctuates.',
    }), 'boolean', false, null, 'Combat');
    createSetting('45stacks', 'Antistack Calc',tip({
        what: 'Changes how AT estimates your damage bonus from Anticipation stacks.',
        ignoredWhen: 'Ignored in Universe 2.',
        how: 'On always calculates as if you had a full 45 Anticipation stacks, useful while windstacking. Off uses your actual current stack count.',
    }), 'boolean', false, null, 'Combat');


    //RCombat
    createSetting('Rfightforever', 'Fight Always',tip({
        what: 'Universe 2 twin of Fight Always &mdash; sends your squad out even when Better AutoFight decided not to.',
        how: 'Set to 0 to always send trimps out when they are not fighting. Set above 0 to only send them when your H:D ratio is at or below this number. -1 turns this off.',
    }), 'value', '-1', null, 'Combat');
    createSetting('Rcalcmaxequality', ['Equality Calc Off', 'EC: On', 'EC: Health'],tip({
        what: 'Controls whether AT\'s battle-survival math assumes Equality Scaling is maxed out, instead of using its real configured level.',
        how: '<b>Equality Calc Off</b> uses your actual Equality Scaling for both your damage and the enemy\'s incoming damage. <b>EC: On</b> assumes fully-scaled Equality for both sides. <b>EC: Health</b> assumes fully-scaled Equality only for the enemy\'s incoming damage (may speed up decisions by reading you as safer than you are), leaving your own damage estimate untouched.',
    }), 'multitoggle', 0, null, 'Combat');
    createSetting('Rmanageequality', 'Manage Equality',tip({
        what: 'Turns Equality Scaling on or off for you automatically based on the current enemy.',
        how: 'Turns scaling ON (letting your Equality stacks build) against fast enemies, the Glass challenge, void double-attack, Desolation maps, or a mutated cell. Otherwise turns scaling OFF and resets your Equality stacks to 0.',
    }), 'boolean', false, null, 'Combat');
    createSetting('Rcalcfrenzy', 'Frenzy Calc',tip({
        what: 'Factors the Frenzy portal perk into AT\'s Universe 2 damage calc.',
        cannot: 'Will not farm as fast as the calc predicts if your actual Frenzy uptime is below 100%.',
        how: 'Boosts the calculated damage by 50% per Frenzy level, assuming 100% Frenzy uptime.',
    }), 'boolean', false, null, 'Combat');
    createSetting('Rmutecalc', 'Mute Calc',tip({
        what: 'The zone at which AT switches to a mutation-aware combat calc in Universe 2.',
        how: 'Only takes effect past z200, and only once your zone reaches this value. Use 0 to disable.',
    }), 'value', '-1', null, 'Combat');


    //Scryer

    //Line 1
    createSetting('UseScryerStance', 'Enable Scryer Stance',tip({
        what: 'Master switch for Scryer stance automation &mdash; overrides AutoStance when your Scryer conditions are met.',
        cannot: 'Not quite "nothing else does anything": <b>VM Scryer</b> (Maps tab) / <b>Daily VM Scryer</b> (Daily tab) can still force Scryer inside void maps even with this off &mdash; their own tooltips already say they work without the Scryer options.',
        how: 'Leave regular Autostance on alongside this. Scryer gives double non-Helium/Nullifium resources and a chance at Dark Essence. Decision priority: Never &gt; Force &gt; Overkill &gt; Min/Max Zone.',
    }), 'boolean', true, null, 'Scryer');
    createSetting('ScryerUseWhenOverkill', 'Use When Overkill',tip({
        what: 'Switches to Scryer whenever doing so secures a free overkill, for double loot with no speed penalty.',
        how: 'Overrides every other Scryer rule except Never-in-Spire. If you only want Scryer during overkills, turn this on, set Min Zone to 9999, and turn everything else off.',
    }), 'boolean', true, null, 'Scryer');
    createSetting('ScryerMinZone', 'Min Zone',tip({
        what: 'The zone Scryer starts being allowed to run in, once none of the Never/Force rules above have already decided.',
        how: 'Inclusive; ignored by Overkill and by any Force rule. Needs to be set (and reachable) for the Maybe option on the other Scryer settings to matter. Set to 9999 to effectively disable this fallback.',
    }), 'value', '181', null, 'Scryer');
    createSetting('ScryerMaxZone', 'Max Zone',tip({
        what: 'The zone Scryer stops being allowed to run in via the Min/Max fallback.',
        how: 'Not inclusive; ignored by Overkill. 0 or -1 disables the cap.',
    }), 'value', '230', null, 'Scryer');
    createSetting('onlyminmaxworld', 'World Min & Max Only',tip({
        what: 'Restricts the Min/Max-Zone Scryer fallback to the World screen only.',
        cannot: 'Does not override the explicit per-context Never/Force rules (Maps / Void / BW / Spire / P Maps) &mdash; those still apply inside Maps regardless of this setting. A related internal three-way check in the code can never trigger its third branch, because this control only ever stores on/off.',
        how: 'When on, the plain Min Zone / Max Zone check (the one that runs once none of the per-context Never/Force rules above applied) only fires outside Maps; inside Maps that fallback is skipped, leaving Maps scrying to the Maps-specific rules.',
    }), 'boolean', false, null, 'Scryer');
    createSetting('ScryerUseinMaps2', ['Maps: NEVER', 'Maps: FORCE', 'Maps: MAYBE'],tip({
        what: 'Scryer behavior while you are in a regular map (not Void, not Bionic, not above your zone).',
        how: '<b>NEVER</b> blocks Scryer in these maps outright. <b>FORCE</b> always switches to Scryer in them. <b>MAYBE</b> lets Overkill and the Min/Max Zone fallback decide.',
    }), 'multitoggle', 2, null, 'Scryer');
    createSetting('ScryerUseinVoidMaps2', ['VoidMaps: NEVER', 'VoidMaps: FORCE', 'VoidMaps: MAYBE'],tip({
        what: 'Scryer behavior while you are in a Void map.',
        cannot: 'FORCE here can switch you to Scryer inside a void map even with the master <b>Enable Scryer Stance</b> switch off, if <b>VM Scryer</b> (Maps tab) or <b>Daily VM Scryer</b> (Daily tab) is on.',
        how: '<b>NEVER</b> blocks Scryer in Void maps. <b>FORCE</b> always switches to Scryer in them. <b>MAYBE</b> lets Overkill and the Min/Max Zone fallback decide.',
    }), 'multitoggle', 0, null, 'Scryer');

    //Line 2
    createSetting('ScryerUseinPMaps', ['P Maps: NEVER', 'P Maps: FORCE', 'P Maps: MAYBE'],tip({
        what: 'Scryer behavior in maps above your current zone (prestige / extra-level maps).',
        how: '<b>NEVER</b> blocks Scryer in them. <b>FORCE</b> always switches to Scryer in them. <b>MAYBE</b> lets Overkill and the Min/Max Zone fallback decide.',
    }), 'multitoggle', 0, null, 'Scryer');
    createSetting('ScryerUseinBW', ['BW: NEVER', 'BW: FORCE', 'BW: MAYBE'],tip({
        what: 'Scryer behavior in Bionic War maps.',
        how: '<b>NEVER</b> blocks Scryer in BW maps. <b>FORCE</b> always switches to Scryer in them. <b>MAYBE</b> lets Overkill and the Min/Max Zone fallback decide.',
    }), 'multitoggle', 0, null, 'Scryer');
    createSetting('ScryerUseinSpire2', ['Spire: NEVER', 'Spire: FORCE', 'Spire: MAYBE'],tip({
        what: 'Scryer behavior in the Spire.',
        how: '<b>NEVER</b> blocks Scryer in the Spire. <b>FORCE</b> always switches to Scryer there. <b>MAYBE</b> lets Overkill and the Min/Max Zone fallback decide.',
    }), 'multitoggle', 0, null, 'Scryer');
    createSetting('ScryerSkipBoss2', ['Boss: NEVER (All Levels)', 'Boss: NEVER (Above VoidLevel)', 'Boss: MAYBE'],tip({
        what: 'Scryer behavior on the world-boss cell (cell 98).',
        how: '<b>Boss: NEVER (All Levels)</b> blocks Scryer on cell 98 at every zone. <b>Boss: NEVER (Above VoidLevel)</b> only blocks it while your zone is below the zone set in <b>Void Maps</b> (Maps tab); once you reach that zone, the block turns off despite the option\'s name. <b>MAYBE</b> treats cell 98 like any other cell.',
    }), 'multitoggle', 0, null, 'Scryer');
    createSetting('ScryerSkipCorrupteds2', ['Corrupted: NEVER', 'Corrupted: FORCE', 'Corrupted: MAYBE'],tip({
        what: 'Scryer behavior against Corrupted-mutation enemies.',
        cannot: 'Only checked outside Maps. Inside a map, whether Scryer fires against a Corrupted enemy is decided by the Maps/Void/BW/Spire Force settings above, not by this one.',
        how: '<b>NEVER</b> blocks Scryer against Corrupted enemies. <b>FORCE</b> always switches to Scryer against them. <b>MAYBE</b> lets the rest of the rules decide. Magma-map enemies and some Void maps carry the Corrupted mutation, so this can matter there too.',
    }), 'multitoggle', 2, null, 'Scryer');
    createSetting('ScryerSkipHealthy', ['Healthy: NEVER', 'Healthy: FORCE', 'Healthy: MAYBE'],tip({
        what: 'Scryer behavior against Healthy-mutation enemies.',
        how: '<b>NEVER</b> blocks Scryer against Healthy enemies. <b>FORCE</b> always switches to Scryer against them. <b>MAYBE</b> lets the rest of the rules decide. Corrupted Void maps are classified as Healthy for this check.',
    }), 'multitoggle', 2, null, 'Scryer');
    createSetting('ScryUseinPoison', 'Scry in Poison',tip({
        what: 'Scryer behavior while under Poison Empowerment.',
        how: '<b>-1</b>: no special rule; falls through to the rest of the Scryer logic. <b>0</b>: never Scry under Poison. <b>Above 0</b>: forces Scry under Poison until you reach this zone, then treats it as Never past that point.',
    }), 'value', -1, null, 'Scryer');

    //Line 3
    createSetting('ScryUseinWind', 'Scry in Wind',tip({
        what: 'Scryer behavior while under Wind Empowerment.',
        how: '<b>-1</b>: no special rule; falls through to the rest of the Scryer logic. <b>0</b>: never Scry under Wind. <b>Above 0</b>: forces Scry under Wind until you reach this zone, then treats it as Never past that point.',
    }), 'value', -1, null, 'Scryer');
    createSetting('ScryUseinIce', 'Scry in Ice',tip({
        what: 'Scryer behavior while under Ice Empowerment.',
        how: '<b>-1</b>: no special rule; falls through to the rest of the Scryer logic. <b>0</b>: never Scry under Ice. <b>Above 0</b>: forces Scry under Ice until you reach this zone, then treats it as Never past that point.',
    }), 'value', -1, null, 'Scryer');
    createSetting('ScryerDieZ', 'Die To Use S',tip({
        what: 'Lets AT switch to Scryer even when doing so would kill you.',
        cannot: 'This can genuinely get your squad killed on purpose &mdash; use at your own risk.',
        how: 'Meant for when Skip Corrupteds pushed you into a regular X/H stance, the corrupted enemy died, and you would rather die and rebreed than miss Scryer on the next (non-corrupted) enemy for Dark Essence. -1 disables this. The value is the minimum zone this applies from &mdash; use a decimal to target a specific cell (e.g. 230.60 = zone 230, cell 60).',
    }), 'value', 230.60, null, 'Scryer');
    createSetting('screwessence', 'Remaining Essence Only',tip({
        what: 'Turns off Scryer once there is no Dark Essence left worth farming.',
        how: 'Outside Maps, stops using Scryer entirely once the remaining enemies with essence drops to 0. Also gates the Die To Use S suicide logic on essence being available &mdash; with this off, AT will die-to-scry regardless of remaining essence.',
    }), 'boolean', false, null, 'Scryer');


    //Magma

    createSetting('UseAutoGen', 'Auto Generator',tip({
        what: 'Master switch for the Auto Generator settings below.',
        ignoredWhen: 'Ignored in Universe 2.',
        how: 'Takes effect from z230 onward.',
    }), 'boolean', false, null, 'Magma');
    createSetting('beforegen', ['Gain Mi', 'Gain Fuel', 'Hybrid'],tip({
        what: 'Which Generator mode to use before you start fueling.',
        ignoredWhen: 'Ignored in Universe 2.',
        how: 'Applies if you fuel later than z230 (see Start Fuel Z). Hybrid requires the Hybridization permanent generator upgrade; until you own it, AT silently substitutes Gain Mi instead.',
    }), 'multitoggle', 1, null, 'Magma');
    createSetting('fuellater', 'Start Fuel Z',tip({
        what: 'The zone AT starts fueling the generator, instead of the default z230.',
        ignoredWhen: 'Ignored in Universe 2.',
        how: 'Set lower than your usual max zone. Use 230 to just use your Before Fuel setting the whole time.',
    }), 'value', -1, null, 'Magma');
    createSetting('fuelend', 'End Fuel Z',tip({
        what: 'The zone AT stops fueling and switches to your After Fuel setting.',
        ignoredWhen: 'Ignored in Universe 2.',
        how: '-1 fuels indefinitely.',
    }), 'value', -1, null, 'Magma');
    createSetting('defaultgen', ['Gain Mi', 'Gain Fuel', 'Hybrid'],tip({
        what: 'Which Generator mode to use after fueling ends.',
        ignoredWhen: 'Ignored in Universe 2.',
        how: 'Hybrid requires the Hybridization permanent generator upgrade; until you own it, AT silently substitutes Gain Mi instead.',
    }), 'multitoggle', 1, null, 'Magma');
    createSetting('AutoGenDC', ['Daily: Normal', 'Daily: Fuel', 'Daily: Hybrid'],tip({
        what: 'Overrides the Generator mode for the whole Daily Challenge.',
        ignoredWhen: 'Ignored in Universe 2.',
        how: '<b>Normal</b> just uses your regular Before/After Fuel and Start/End Fuel Z settings. <b>Fuel</b> and <b>Hybrid</b> lock the generator to that mode for the entire Daily. Hybrid requires the Hybridization upgrade.',
    }), 'multitoggle', 1, null, 'Magma');
    createSetting('AutoGenC2', ['C2: Normal', 'C2: Fuel', 'C2: Hybrid'],tip({
        what: 'Overrides the Generator mode for the whole Challenge Squared (C2) run.',
        ignoredWhen: 'Ignored in Universe 2.',
        how: '<b>Normal</b> just uses your regular Before/After Fuel and Start/End Fuel Z settings. <b>Fuel</b> and <b>Hybrid</b> lock the generator to that mode for the entire C2 run. Hybrid requires the Hybridization upgrade.',
    }), 'multitoggle', 1, null, 'Magma');

    //Spend Mi
    (document.getElementById('AutoGenC2') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('spendmagmite', ['Spend Magmite OFF', 'Spend Magmite (Portal)', 'Spend Magmite Always'],tip({
        what: 'When AT auto-spends any Magmite you have not manually allocated.',
        ignoredWhen: 'Ignored in Universe 2.',
        how: '<b>Spend Magmite OFF</b> never auto-spends. <b>Spend Magmite (Portal)</b> spends right before you portal. <b>Spend Magmite Always</b> spends every tick.',
    }), 'multitoggle', 1, null, 'Magma');
    createSetting('ratiospend', 'Ratio Spending',tip({
        what: 'Switches Magmite spending to a ratio you define below, instead of AT\'s built-in priority order.',
        ignoredWhen: 'Ignored in Universe 2.',
        cannot: 'If you turn this on without setting any ratio above (all four left at their disabling value), AT spends nothing &mdash; there is no fallback to the default order.',
        how: 'Set Efficiency / Capacity / Supply / Overclocker below to the relative weight you want each to get.',
    }), 'boolean', false, null, 'Magma');
    createSetting('effratio', 'Efficiency',tip({
        what: 'Relative weight for Efficiency when Ratio Spending is on.',
        ignoredWhen: 'Ignored unless Ratio Spending is on. Ignored in Universe 2.',
        how: '0 or below excludes Efficiency from ratio spending entirely.',
    }), 'value', -1, null, 'Magma');
    createSetting('capratio', 'Capacity',tip({
        what: 'Relative weight for Capacity when Ratio Spending is on.',
        ignoredWhen: 'Ignored unless Ratio Spending is on. Ignored in Universe 2.',
        how: '0 or below excludes Capacity from ratio spending entirely.',
    }), 'value', -1, null, 'Magma');
    createSetting('supratio', 'Supply',tip({
        what: 'Relative weight for Supply when Ratio Spending is on.',
        ignoredWhen: 'Ignored unless Ratio Spending is on. Ignored in Universe 2.',
        how: '0 or below excludes Supply from ratio spending entirely.',
    }), 'value', -1, null, 'Magma');
    createSetting('ocratio', 'Overclocker',tip({
        what: 'Relative weight for Overclocker when Ratio Spending is on.',
        ignoredWhen: 'Ignored unless Ratio Spending is on. Ignored in Universe 2.',
        how: '0 or below excludes Overclocker from ratio spending entirely.',
    }), 'value', -1, null, 'Magma');
    createSetting('SupplyWall', 'Throttle Supply (or Capacity)',tip({
        what: 'Throttles how eagerly AT buys Supply versus Capacity, when Ratio Spending is off.',
        ignoredWhen: 'Ignored when Ratio Spending is on. Ignored in Universe 2.',
        how: 'Only matters when Efficiency is not the better buy. <b>Positive, not 1</b> (e.g. 2.5): buys Capacity even when it costs up to 2.5&times; more than Supply &mdash; throttles Supply. <b>Negative</b> (e.g. -2.5): buys Supply even when it costs up to 2.5&times; more than Capacity &mdash; throttles Capacity instead. <b>1</b>: disables Supply entirely, spends only on Efficiency/Capacity/Overclocker, and tries to keep Supply near your HZE. <b>0</b>: ignores this setting and just buys whichever of the two is cheaper.',
    }), 'valueNegative', 0.4, null, 'Magma');
    createSetting('spendmagmitesetting', ['Normal', 'Normal & No OC', 'OneTime Only', 'OneTime & OC'],tip({
        what: 'Which parts of the default (non-ratio) Magmite spending order AT actually runs.',
        ignoredWhen: 'Ignored when Ratio Spending is on. Ignored in Universe 2.',
        how: '<b>Normal</b> buys the one-and-done upgrades, then Overclocker repeatedly, then loops Efficiency/Capacity/Supply. <b>Normal & No OC</b> is the same but stops buying Overclocker after its first level. <b>OneTime Only</b> buys only the one-and-done upgrades plus one Overclocker level &mdash; no Efficiency/Capacity/Supply loop. <b>OneTime & OC</b> buys the one-and-done upgrades and keeps buying Overclocker repeatedly, but skips the Efficiency/Capacity/Supply loop entirely.',
    }), 'multitoggle', 0, null, 'Magma');
    createSetting('MagmiteExplain', 'Magmite spending behaviour',tip({
        what: 'Reference: the order AT spends Magmite in Normal mode.',
        how: 'Buys the one-and-done permanent upgrades in a fixed order &mdash; Slowburn, Shielding, Storage, Hybridization, Supervision, Simulacrum &mdash; not sorted by price (Supervision and Simulacrum are the two most expensive of the six, and are bought last). Then Overclocker if affordable (skipped past its first level under some Magmite Spending Behaviour options). Then Efficiency, if it beats Capacity\'s cost-per-percent. Otherwise Capacity or Supply, whichever the Throttle Supply setting favors.',
    }), 'infoclick', 'MagmiteExplain', null, 'Magma');

    //Heirloom
    createSetting('highdmg', 'WS: High Damage',tip({
        what: 'Names the heirloom (an exact, case-sensitive match) that Windstack combat equips as your \'high damage\' shield.',
        how: 'Also equipped once automatically right after every portal &mdash; including a Radon (U2) portal, by a long-standing quirk, since U2 has its own separate swap system below. Leave blank to skip.',
        ignoredWhen: 'During combat this only matters while your stance is on Windstack (<b>Auto Stance</b> = Windstack, or Daily Windstacking is on) &mdash; U2 has no windstacking automation of its own.',
    }), 'textValue', '', null, 'Heirlooms');
    createSetting('lowdmg', 'WS: Low Damage',tip({
        what: 'Names the heirloom (an exact, case-sensitive match) that Windstack combat equips as your \'low damage\' shield.',
        how: 'Also equipped once automatically right after every portal, the same way <b>WS: High Damage</b> is. Leave blank to skip.',
        ignoredWhen: 'During combat this only matters while your stance is on Windstack (<b>Auto Stance</b> = Windstack, or Daily Windstacking is on).',
    }), 'textValue', '', null, 'Heirlooms');

    //Heirloom Swapping
    (document.getElementById('lowdmg') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rhs', 'Heirloom Swapping',tip({
        what: 'Turns on U2 (Radon) heirloom swapping: a shield that changes at a zone threshold, plus a staff that changes between world fighting, mapping, and tribute farming.',
        how: 'Configure the shield swap under <b>Shields</b> and the staff swap under <b>Staffs</b>, both below.',
        ignoredWhen: 'During a Daily, this box is only read when <b>Daily Heirloom Swap</b> (Daily tab) is set to <b>DHS: Normal</b> &mdash; any other Daily Heirloom Swap choice uses the separate Daily settings instead and ignores this entirely.',
    }), 'boolean', false, null, 'Heirlooms');

    //Shield Swapping
    (document.getElementById('Rhs') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rhsshield', 'Shields',tip({
        what: 'Turns on the shield half of U2 Heirloom Swapping: one shield below a zone threshold, a different one at or above it.',
        ignoredWhen: 'Does nothing unless <b>Heirloom Swapping</b> is on, and does nothing even then unless <b>HS: Zone</b> is set above 0 &mdash; neither shield equips at zone 0 or below.',
    }), 'boolean', false, null, 'Heirlooms');
    createSetting('Rhsz', 'HS: Zone',tip({
        what: 'The world zone where U2 Heirloom Swapping switches your shield from <b>HS: First</b> to <b>HS: Second</b>.',
        how: 'Below this zone, HS: First stays equipped; at or above it, HS: Second is equipped instead.',
        cannot: 'A value of 0 or below does not fall back to always-equipping something &mdash; it disables the shield swap outright, even with Shields turned on.',
    }), 'value', '-1', null, 'Heirlooms');
    createSetting('Rhs1', 'HS: First',tip({
        what: 'The exact, case-sensitive name of the shield U2 Heirloom Swapping equips before <b>HS: Zone</b> is reached.',
        ignoredWhen: 'Only used while Shields is on under Heirloom Swapping and HS: Zone is set above 0.',
    }), 'textValue', '', null, 'Heirlooms');
    createSetting('Rhs2', 'HS: Second',tip({
        what: 'The exact, case-sensitive name of the shield U2 Heirloom Swapping equips at or after <b>HS: Zone</b>.',
        ignoredWhen: 'Only used while Shields is on under Heirloom Swapping and HS: Zone is set above 0.',
    }), 'textValue', '', null, 'Heirlooms');

    //Staff Swapping
    (document.getElementById('Rhs2') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rhsstaff', 'Staffs',tip({
        what: 'Turns on the staff half of U2 Heirloom Swapping: a staff for open-world fighting, a different one for mapping, and a third while tribute farming.',
        how: 'Set the three staff names under <b>World</b>, <b>Map</b>, and <b>Tribute</b> below.',
        ignoredWhen: 'Does nothing unless <b>Heirloom Swapping</b> is on.',
    }), 'boolean', false, null, 'Heirlooms');
    createSetting('Rhsworldstaff', 'World',tip({
        what: 'The exact, case-sensitive name of the staff to equip while out of maps (open-world fighting).',
        ignoredWhen: 'Only used while Staffs is on under Heirloom Swapping, and only while you are not currently mapping. Leave blank to skip.',
    }), 'textValue', '', null, 'Heirlooms');
    createSetting('Rhsmapstaff', 'Map',tip({
        what: 'The exact, case-sensitive name of the staff to equip while mapping.',
        ignoredWhen: 'Only used while Staffs is on and you are mapping &mdash; and only when you are not tribute farming with a <b>Tribute</b> staff set, which takes over instead. Leave blank to skip.',
    }), 'textValue', '', null, 'Heirlooms');
    createSetting('Rhstributestaff', 'Tribute',tip({
        what: 'The exact, case-sensitive name of the staff to equip while actively tribute farming inside a map.',
        ignoredWhen: 'Only used while Staffs is on, you are mapping, and tribute farming is active; otherwise <b>Map</b> (or <b>World</b>) takes over instead. Leave blank to skip.',
    }), 'textValue', '', null, 'Heirlooms');

    //Heirloom Line
    (document.getElementById('Rhstributestaff') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('autoheirlooms', 'Auto Heirlooms',tip({
        what: 'Turns on Auto Heirlooms: after every portal, AT scores your spare heirlooms and carries the best ones &mdash; by the type and rarity you choose below &mdash; into your carried slots.',
        how: 'Scoring: a spare heirloom earns +5 for each modifier slot that matches one of your picks below, a large bonus for meeting <b>Rarity to Keep</b>, and any unfilled modifier slot on the heirloom itself multiplies its score &times;4, regardless of your picks. A heirloom you have protected in the Extra list is carried first, ahead of scoring, and always keeps a slot.',
        cannot: 'AT only decides what to carry &mdash; it does not itself delete or recycle any heirloom.',
        ignoredWhen: 'Setting <b>Kept Type</b> to <b>None</b> disables this completely, even with this box checked.',
    }), 'boolean', false, null, 'Heirlooms');
    createSetting('typetokeep', ['None', 'Shields', 'Staffs', 'Cores', 'All'],tip({
        what: 'Which category of spare heirlooms Auto Heirlooms carries into your carried slots after each portal.',
        how: '<b>Shields</b> / <b>Staffs</b> / <b>Cores</b> carry only that type. <b>All</b> cycles Shield, then Staff, then Core, repeatedly, until your carried slots are full or you run out of spares &mdash; it does not guarantee an even split between the three.',
        cannot: 'Choosing <b>None</b> disables Auto Heirlooms entirely for every portal, even while the <b>Auto Heirlooms</b> master box is checked.',
    }), 'multitoggle', 0, null, 'Heirlooms');
    createSetting('raretokeep', 'Rarity to Keep',tip({
        what: 'The rarity threshold Auto Heirlooms favors when scoring your spare heirlooms for carrying.',
        how: 'A heirloom at or above this rarity gets a very large scoring bonus over one below it, so those tend to get carried first. It is a scoring weight, not a hard filter &mdash; a lower-rarity heirloom can still be carried if slots remain.',
        ignoredWhen: 'Has no effect unless Auto Heirlooms is on and Kept Type is not None.',
    }), 'dropdown', 'Any', ["Any", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Magnificent", "Ethereal", "Magmatic", "Plagued", "Radiating", "Hazardous", "Enigmatic", "Mutated"], 'Heirlooms');

    //Shield Line
    (document.getElementById('raretokeep') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('keepshields', 'Shields',tip({
        what: 'Shows the per-slot Shield modifier pickers below in the settings panel.',
        cannot: 'This is a display toggle only. Whatever those pickers are set to is scored when ranking Shields for carrying whether this row is shown or hidden &mdash; hiding it does not turn the modifiers off.',
        ignoredWhen: 'The row itself stays hidden unless Auto Heirlooms is on.',
    }), 'boolean', false, null, 'Heirlooms');
    createSetting('slot1modsh', 'Shield: Modifier 1',tip({
        what: 'Gives a Shield a +5 carrying-score bonus when its Modifier 1 matches this pick.',
        how: '<b>empty</b> matches a Shield whose Modifier 1 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Shield multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Shields unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "playerEfficiency", "trainerEfficiency", "storageSize", "breedSpeed", "trimpHealth", "trimpAttack", "trimpBlock", "critDamage", "critChance", "voidMaps", "plaguebringer", "prismatic", "gammaBurst", "inequality", "doubleCrit"], 'Heirlooms');
    createSetting('slot2modsh', 'Shield: Modifier 2',tip({
        what: 'Gives a Shield a +5 carrying-score bonus when its Modifier 2 matches this pick.',
        how: '<b>empty</b> matches a Shield whose Modifier 2 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Shield multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Shields unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "playerEfficiency", "trainerEfficiency", "storageSize", "breedSpeed", "trimpHealth", "trimpAttack", "trimpBlock", "critDamage", "critChance", "voidMaps", "plaguebringer", "prismatic", "gammaBurst", "inequality", "doubleCrit"], 'Heirlooms');
    createSetting('slot3modsh', 'Shield: Modifier 3',tip({
        what: 'Gives a Shield a +5 carrying-score bonus when its Modifier 3 matches this pick.',
        how: '<b>empty</b> matches a Shield whose Modifier 3 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Shield multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Shields unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "playerEfficiency", "trainerEfficiency", "storageSize", "breedSpeed", "trimpHealth", "trimpAttack", "trimpBlock", "critDamage", "critChance", "voidMaps", "plaguebringer", "prismatic", "gammaBurst", "inequality", "doubleCrit"], 'Heirlooms');
    createSetting('slot4modsh', 'Shield: Modifier 4',tip({
        what: 'Gives a Shield a +5 carrying-score bonus when its Modifier 4 matches this pick.',
        how: '<b>empty</b> matches a Shield whose Modifier 4 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Shield multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Shields unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "playerEfficiency", "trainerEfficiency", "storageSize", "breedSpeed", "trimpHealth", "trimpAttack", "trimpBlock", "critDamage", "critChance", "voidMaps", "plaguebringer", "prismatic", "gammaBurst", "inequality", "doubleCrit"], 'Heirlooms');
    createSetting('slot5modsh', 'Shield: Modifier 5',tip({
        what: 'Gives a Shield a +5 carrying-score bonus when its Modifier 5 matches this pick.',
        how: '<b>empty</b> matches a Shield whose Modifier 5 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Shield multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Shields unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "playerEfficiency", "trainerEfficiency", "storageSize", "breedSpeed", "trimpHealth", "trimpAttack", "trimpBlock", "critDamage", "critChance", "voidMaps", "plaguebringer", "prismatic", "gammaBurst", "inequality", "doubleCrit"], 'Heirlooms');
    createSetting('slot6modsh', 'Shield: Modifier 6',tip({
        what: 'Gives a Shield a +5 carrying-score bonus when its Modifier 6 matches this pick.',
        how: '<b>empty</b> matches a Shield whose Modifier 6 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Shield multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Shields unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "playerEfficiency", "trainerEfficiency", "storageSize", "breedSpeed", "trimpHealth", "trimpAttack", "trimpBlock", "critDamage", "critChance", "voidMaps", "plaguebringer", "prismatic", "gammaBurst", "inequality", "doubleCrit"], 'Heirlooms');
    createSetting('slot7modsh', 'Shield: Modifier 7',tip({
        what: 'Gives a Shield a +5 carrying-score bonus when its Modifier 7 matches this pick.',
        how: '<b>empty</b> matches a Shield whose Modifier 7 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Shield multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Shields unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "playerEfficiency", "trainerEfficiency", "storageSize", "breedSpeed", "trimpHealth", "trimpAttack", "trimpBlock", "critDamage", "critChance", "voidMaps", "plaguebringer", "prismatic", "gammaBurst", "inequality", "doubleCrit"], 'Heirlooms');

    //Staff Line
    (document.getElementById('slot7modsh') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('keepstaffs', 'Staffs',tip({
        what: 'Shows the per-slot Staff modifier pickers below in the settings panel.',
        cannot: 'This is a display toggle only. Whatever those pickers are set to is scored when ranking Staffs for carrying whether this row is shown or hidden &mdash; hiding it does not turn the modifiers off.',
        ignoredWhen: 'The row itself stays hidden unless Auto Heirlooms is on.',
    }), 'boolean', false, null, 'Heirlooms');
    createSetting('slot1modst', 'Staff: Modifier 1',tip({
        what: 'Gives a Staff a +5 carrying-score bonus when its Modifier 1 matches this pick.',
        how: '<b>empty</b> matches a Staff whose Modifier 1 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Staff multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Staffs unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "metalDrop", "foodDrop", "woodDrop", "gemsDrop", "fragmentsDrop", "MinerSpeed", "FarmerSpeed", "LumberjackSpeed", "DragimpSpeed", "ExplorerSpeed", "ScientistSpeed", "FluffyExp", "ParityPower", "SeedDrop"], 'Heirlooms');
    createSetting('slot2modst', 'Staff: Modifier 2',tip({
        what: 'Gives a Staff a +5 carrying-score bonus when its Modifier 2 matches this pick.',
        how: '<b>empty</b> matches a Staff whose Modifier 2 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Staff multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Staffs unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "metalDrop", "foodDrop", "woodDrop", "gemsDrop", "fragmentsDrop", "MinerSpeed", "FarmerSpeed", "LumberjackSpeed", "DragimpSpeed", "ExplorerSpeed", "ScientistSpeed", "FluffyExp", "ParityPower", "SeedDrop"], 'Heirlooms');
    createSetting('slot3modst', 'Staff: Modifier 3',tip({
        what: 'Gives a Staff a +5 carrying-score bonus when its Modifier 3 matches this pick.',
        how: '<b>empty</b> matches a Staff whose Modifier 3 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Staff multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Staffs unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "metalDrop", "foodDrop", "woodDrop", "gemsDrop", "fragmentsDrop", "MinerSpeed", "FarmerSpeed", "LumberjackSpeed", "DragimpSpeed", "ExplorerSpeed", "ScientistSpeed", "FluffyExp", "ParityPower", "SeedDrop"], 'Heirlooms');
    createSetting('slot4modst', 'Staff: Modifier 4',tip({
        what: 'Gives a Staff a +5 carrying-score bonus when its Modifier 4 matches this pick.',
        how: '<b>empty</b> matches a Staff whose Modifier 4 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Staff multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Staffs unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "metalDrop", "foodDrop", "woodDrop", "gemsDrop", "fragmentsDrop", "MinerSpeed", "FarmerSpeed", "LumberjackSpeed", "DragimpSpeed", "ExplorerSpeed", "ScientistSpeed", "FluffyExp", "ParityPower", "SeedDrop"], 'Heirlooms');
    createSetting('slot5modst', 'Staff: Modifier 5',tip({
        what: 'Gives a Staff a +5 carrying-score bonus when its Modifier 5 matches this pick.',
        how: '<b>empty</b> matches a Staff whose Modifier 5 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Staff multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Staffs unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "metalDrop", "foodDrop", "woodDrop", "gemsDrop", "fragmentsDrop", "MinerSpeed", "FarmerSpeed", "LumberjackSpeed", "DragimpSpeed", "ExplorerSpeed", "ScientistSpeed", "FluffyExp", "ParityPower", "SeedDrop"], 'Heirlooms');
    createSetting('slot6modst', 'Staff: Modifier 6',tip({
        what: 'Gives a Staff a +5 carrying-score bonus when its Modifier 6 matches this pick.',
        how: '<b>empty</b> matches a Staff whose Modifier 6 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Staff multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Staffs unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "metalDrop", "foodDrop", "woodDrop", "gemsDrop", "fragmentsDrop", "MinerSpeed", "FarmerSpeed", "LumberjackSpeed", "DragimpSpeed", "ExplorerSpeed", "ScientistSpeed", "FluffyExp", "ParityPower", "SeedDrop"], 'Heirlooms');
    createSetting('slot7modst', 'Staff: Modifier 7',tip({
        what: 'Gives a Staff a +5 carrying-score bonus when its Modifier 7 matches this pick.',
        how: '<b>empty</b> matches a Staff whose Modifier 7 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Staff multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Staffs unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "metalDrop", "foodDrop", "woodDrop", "gemsDrop", "fragmentsDrop", "MinerSpeed", "FarmerSpeed", "LumberjackSpeed", "DragimpSpeed", "ExplorerSpeed", "ScientistSpeed", "FluffyExp", "ParityPower", "SeedDrop"], 'Heirlooms');

    //Core Line
    (document.getElementById('slot7modst') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('keepcores', 'Cores',tip({
        what: 'Shows the per-slot Core modifier pickers below in the settings panel.',
        cannot: 'This is a display toggle only, same as Shields/Staffs above: the picks are scored regardless of whether this row is shown. Unlike Shields and Staffs, this checkbox does not hide itself when Auto Heirlooms is off &mdash; it stays visible either way, though it still has no effect until Auto Heirlooms is on.',
    }), 'boolean', false, null, 'Heirlooms');
    createSetting('slot1modcr', 'Cores: Modifier 1',tip({
        what: 'Gives a Core a +5 carrying-score bonus when its Modifier 1 matches this pick.',
        how: '<b>empty</b> matches a Core whose Modifier 1 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Core multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Cores unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "fireTrap", "poisonTrap", "lightningTrap", "runestones", "strengthEffect", "condenserEffect"], 'Heirlooms');
    createSetting('slot2modcr', 'Cores: Modifier 2',tip({
        what: 'Gives a Core a +5 carrying-score bonus when its Modifier 2 matches this pick.',
        how: '<b>empty</b> matches a Core whose Modifier 2 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Core multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Cores unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "fireTrap", "poisonTrap", "lightningTrap", "runestones", "strengthEffect", "condenserEffect"], 'Heirlooms');
    createSetting('slot3modcr', 'Cores: Modifier 3',tip({
        what: 'Gives a Core a +5 carrying-score bonus when its Modifier 3 matches this pick.',
        how: '<b>empty</b> matches a Core whose Modifier 3 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Core multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Cores unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "fireTrap", "poisonTrap", "lightningTrap", "runestones", "strengthEffect", "condenserEffect"], 'Heirlooms');
    createSetting('slot4modcr', 'Cores: Modifier 4',tip({
        what: 'Gives a Core a +5 carrying-score bonus when its Modifier 4 matches this pick.',
        how: '<b>empty</b> matches a Core whose Modifier 4 slot is itself unfilled. Separately, ANY unfilled modifier slot on a Core multiplies its whole score &times;4 automatically, no matter what this dropdown is set to.',
        cannot: 'Still scored even while its picker row is hidden (Cores unticked above) &mdash; hiding the row does not turn this pick off.',
    }), 'dropdown', 'empty', ["empty", "fireTrap", "poisonTrap", "lightningTrap", "runestones", "strengthEffect", "condenserEffect"], 'Heirlooms');



    //Golden

    createSetting('AutoGoldenUpgrades', 'AutoGoldenUpgrades',tip({
        what: 'Automatically buys Golden Upgrades outside Dailies and Challenge2. <b>Helium</b> buys from the Helium pool, <b>Battle</b> buys from the Battle pool, <b>Void</b> spends on the Void pool (the game caps this at 8 purchases) and falls back to Helium once it runs out, <b>Void + Battle</b> does the same but falls back to Battle instead.',
        how: '<b>Helium Battle</b> / <b>Battle Helium</b> can switch the Helium/Battle choice over after a purchase count; <b>Void Battle</b> can switch the Void fallback to Battle from a zone onward. See those settings.',
        ignoredWhen: 'Only active outside Dailies and Challenge2 &mdash; see <b>Daily AutoGoldenUpgrades</b> / <b>C2 AutoGoldenUpgrades</b> for those.',
    }), 'dropdown', 'Off', ["Off", "Helium", "Battle", "Void", "Void + Battle"], 'Golden');
    createSetting('dAutoGoldenUpgrades', 'Daily AutoGoldenUpgrades',tip({
        what: 'The Daily version of AutoGoldenUpgrades: automatically buys Golden Upgrades while a Daily challenge is active, with the same Helium / Battle / Void / Void + Battle behavior.',
        how: 'Its own Helium/Battle switch-over and Void fallback zone are <b>Daily Helium Battle</b>, <b>Daily Battle Helium</b>, and <b>Daily Void Battle</b>.',
        ignoredWhen: 'Only active during a Daily.',
    }), 'dropdown', 'Off', ["Off", "Helium", "Battle", "Void", "Void + Battle"], 'Golden');
    createSetting('cAutoGoldenUpgrades', 'C2 AutoGoldenUpgrades',tip({
        what: 'The Challenge2 version of AutoGoldenUpgrades: automatically buys Golden Upgrades while a Challenge2 is running.',
        how: 'Has no Helium option here &mdash; only Battle, Void, and Void + Battle.',
        ignoredWhen: 'Only active during a Challenge2.',
    }), 'dropdown', 'Off', ["Off", "Battle", "Void", "Void + Battle"], 'Golden');
    (document.getElementById('cAutoGoldenUpgrades') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('voidheliumbattle', 'Void Battle',tip({
        what: 'The world zone from which the Void fallback switches from Helium to Battle, when AutoGoldenUpgrades is set to Void.',
        how: 'Below this zone, running out of Void upgrades falls back to Helium; at or above it, it falls back to Battle instead.',
        ignoredWhen: 'Only used when AutoGoldenUpgrades is set to Void, and only once the Void pool has run out. -1 disables it (always falls back to Helium).',
    }), 'value', -1, null, 'Golden');
    createSetting('dvoidheliumbattle', 'Daily Void Battle',tip({
        what: 'The Daily version of <b>Void Battle</b>: the world zone from which the Void fallback switches from Helium to Battle in Dailies, when Daily AutoGoldenUpgrades is set to Void.',
        ignoredWhen: 'Only used during a Daily when Daily AutoGoldenUpgrades is set to Void, and only once the Void pool has run out. -1 disables it.',
    }), 'value', -1, null, 'Golden');
    createSetting('radonbattle', 'Helium Battle',tip({
        what: 'Switches AutoGoldenUpgrades from Helium to Battle once this many Helium-pool goldens have been bought this run.',
        ignoredWhen: 'Only used when AutoGoldenUpgrades is set to Helium. -1 disables it.',
    }), 'value', -1, null, 'Golden');
    createSetting('dradonbattle', 'Daily Helium Battle',tip({
        what: 'The Daily version of <b>Helium Battle</b>: switches Daily AutoGoldenUpgrades from Helium to Battle once this many Helium-pool goldens have been bought in the Daily.',
        ignoredWhen: 'Only used during a Daily when Daily AutoGoldenUpgrades is set to Helium. -1 disables it.',
    }), 'value', -1, null, 'Golden');
    createSetting('battleradon', 'Battle Helium',tip({
        what: 'Switches AutoGoldenUpgrades from Battle back to Helium once this many Battle-pool goldens have been bought this run.',
        ignoredWhen: 'Only used when AutoGoldenUpgrades is set to Battle. -1 disables it.',
    }), 'value', -1, null, 'Golden');
    createSetting('dbattleradon', 'Daily Battle Helium',tip({
        what: 'The Daily version of <b>Battle Helium</b>: switches Daily AutoGoldenUpgrades from Battle back to Helium once this many Battle-pool goldens have been bought in the Daily.',
        ignoredWhen: 'Only used during a Daily when Daily AutoGoldenUpgrades is set to Battle. -1 disables it.',
    }), 'value', -1, null, 'Golden');


    //RGolden

    createSetting('RAutoGoldenUpgrades', 'AutoGoldenUpgrades',tip({
        what: 'The U2 (Radon) version of AutoGoldenUpgrades: automatically buys Golden Upgrades outside Dailies and Challenge2. <b>Radon</b> buys from the same underlying golden pool Helium uses (U2 has no separate golden pool of its own), <b>Battle</b> buys from the Battle pool, <b>Void</b> spends on the Void pool (the game caps this at 8 purchases) and falls back to Radon once it runs out, <b>Void + Battle</b> falls back to Battle instead.',
        how: '<b>Radon Battle</b> / <b>Battle Radon</b> can switch the Radon/Battle choice over after a purchase count; <b>Void Battle</b> can switch the Void fallback to Battle from a zone onward. See those settings.',
        ignoredWhen: 'Only active outside Dailies and Challenge2 &mdash; see <b>Daily AutoGoldenUpgrades</b> / <b>C2 AutoGoldenUpgrades</b> below.',
    }), 'dropdown', 'Off', ["Off", "Radon", "Battle", "Void", "Void + Battle"], 'Golden');
    createSetting('RdAutoGoldenUpgrades', 'Daily AutoGoldenUpgrades',tip({
        what: 'The Daily version of the U2 AutoGoldenUpgrades: automatically buys Golden Upgrades while a Daily challenge is active, with the same Radon / Battle / Void / Void + Battle behavior.',
        how: 'Its own Radon/Battle switch-over and Void fallback zone are <b>Daily Radon Battle</b>, <b>Daily Battle Radon</b>, and <b>Daily Void Battle</b>.',
        ignoredWhen: 'Only active during a Daily.',
    }), 'dropdown', 'Off', ["Off", "Radon", "Battle", "Void", "Void + Battle"], 'Golden');
    createSetting('RcAutoGoldenUpgrades', 'C2 AutoGoldenUpgrades',tip({
        what: 'The Challenge2 version of the U2 AutoGoldenUpgrades: automatically buys Golden Upgrades while a Challenge2 is running.',
        how: 'Has no Radon option here &mdash; only Battle, Void, and Void + Battle.',
        cannot: 'During the Mayhem, Pandemonium, or Desolation Challenge2s, this always buys Battle goldens no matter what you pick here.',
        ignoredWhen: 'Only active during a Challenge2.',
    }), 'dropdown', 'Off', ["Off", "Battle", "Void", "Void + Battle"], 'Golden');
    (document.getElementById('RcAutoGoldenUpgrades') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('Rvoidheliumbattle', 'Void Battle',tip({
        what: 'The world zone from which the Void fallback switches from Radon to Battle, when RAutoGoldenUpgrades is set to Void.',
        how: 'Below this zone, running out of Void upgrades falls back to Radon; at or above it, it falls back to Battle instead.',
        ignoredWhen: 'Only used when RAutoGoldenUpgrades is set to Void, and only once the Void pool has run out. -1 disables it.',
    }), 'value', -1, null, 'Golden');
    createSetting('Rdvoidheliumbattle', 'Daily Void Battle',tip({
        what: 'The Daily version of <b>Void Battle</b>: the world zone from which the Void fallback switches from Radon to Battle in Dailies, when Daily AutoGoldenUpgrades is set to Void.',
        ignoredWhen: 'Only used during a Daily when Daily AutoGoldenUpgrades is set to Void, and only once the Void pool has run out. -1 disables it.',
    }), 'value', -1, null, 'Golden');
    createSetting('Rradonbattle', 'Radon Battle',tip({
        what: 'Switches RAutoGoldenUpgrades from Radon to Battle once this many goldens have been bought from that pool this run.',
        ignoredWhen: 'Only used when RAutoGoldenUpgrades is set to Radon. -1 disables it.',
    }), 'value', -1, null, 'Golden');
    createSetting('Rdradonbattle', 'Daily Radon Battle',tip({
        what: 'The Daily version of <b>Radon Battle</b>: switches Daily AutoGoldenUpgrades from Radon to Battle once this many goldens have been bought from that pool in the Daily.',
        ignoredWhen: 'Only used during a Daily when Daily AutoGoldenUpgrades is set to Radon. -1 disables it.',
    }), 'value', -1, null, 'Golden');
    createSetting('Rbattleradon', 'Battle Radon',tip({
        what: 'Switches RAutoGoldenUpgrades from Battle back to Radon once this many Battle-pool goldens have been bought this run.',
        ignoredWhen: 'Only used when RAutoGoldenUpgrades is set to Battle. -1 disables it.',
    }), 'value', -1, null, 'Golden');
    createSetting('Rdbattleradon', 'Daily Battle Radon',tip({
        what: 'The Daily version of <b>Battle Radon</b>: switches Daily AutoGoldenUpgrades from Battle back to Radon once this many Battle-pool goldens have been bought in the Daily.',
        ignoredWhen: 'Only used during a Daily when Daily AutoGoldenUpgrades is set to Battle. -1 disables it.',
    }), 'value', -1, null, 'Golden');



    //AB

    createSetting('RAB', 'SA',tip({
        what: 'Master switch for SA (the game\'s Auto Battle minigame) automation below.',
        cannot: 'Do not open Auto Battle\'s own manual input settings while this is on &mdash; doing so can crash the page.',
        ignoredWhen: 'You have not reached SA level 75 yet.',
    }), 'boolean', false, null, "SA");
    createSetting('RABpreset', 'Presets',tip({
        what: 'Auto-switches your equipped Auto Battle preset to match the enemy\'s weakest resistance.',
        how: 'Preset 1 must be built for Poison, Preset 2 for Bleed, Preset 3 for Shock. If the enemy resists fewer than two of the three, AT alternates between the non-resisted presets until it dies. It never buys or swaps individual items for you &mdash; if none of your presets fit, it can get stuck until you update them.',
        ignoredWhen: '<b>SA</b> (the master switch) is off, or you have not reached SA level 75.',
    }), 'boolean', false, null, "SA");
    createSetting('RABdustsimple', ['Simple Dust Off', 'SD: Equipped', 'SD: Non-hidden'],tip({
        what: 'Auto-upgrades Auto Battle items with your dust, cheapest first.',
        how: '<b>SD: Equipped</b> only upgrades items you already have equipped. <b>SD: Non-hidden</b> upgrades items that are neither hidden nor equipped instead.',
        ignoredWhen: '<b>SA</b> (the master switch) is off, or you have not reached SA level 75.',
    }), 'multitoggle', 0, null, 'SA');
    createSetting('RABfarm', 'Save String',tip({
        what: 'Keeps a scoreboard of your best-ever Auto Battle dust/s and saves the level + loadout that earned it into <b>String</b> below.',
        overwritten: 'Continuously checks your current dust/s and, whenever it beats the recorded best, overwrites the saved string with the new one.',
        ignoredWhen: '<b>SA</b> (the master switch) is off, or you have not reached SA level 75.',
    }), 'boolean', false, null, "SA");
    createSetting('RABfarmswitch', 'Switch',tip({
        what: 'Jumps Auto Battle straight to the level and loadout saved in <b>String</b> below.',
        ignoredWhen: '<b>SA</b> (the master switch) is off, or you have not reached SA level 75.',
    }), 'boolean', false, null, "SA");
    createSetting('RABfarmstring', 'String', tip({
        what: 'Your best-performing Auto Battle farming string.',
        // ab.ts:160/166 — AT rewrites this whenever it beats the recorded dust rate. It is a scoreboard
        // the bot keeps, which is why a pasted string can vanish; nothing said so.
        overwritten: 'AT writes its own best string here whenever it finds one that farms more dust, so a string you paste in can be replaced by AT\'s own.',
        how: 'Safe to share with other AT users. If you paste in someone else\'s string, set the <b>second</b> value (the dust figure) to <b>0</b> so AT measures the dust <i>you</i> actually get rather than trusting theirs.',
    }), 'textValue', '-1', null, "SA");
    createSetting('RABsolve', 'Solver',tip({
        what: 'Auto-plays Auto Battle for you: levels the right items, accepts and buys the right contracts, and picks the right enemy level, tier by tier up to level 10.',
        how: 'While an accepted Auto Battle contract needs a deeper zone than you\'ve reached, this also pushes AT to void into that zone for you.',
        ignoredWhen: '<b>SA</b> (the master switch) is off, or you have not reached SA level 75.',
    }), 'boolean', false, null, "SA");



    //Nature

    //Tokens
    createSetting('AutoNatureTokens', 'Spend Nature Tokens',tip({
        what: 'Master switch for automatically spending or converting Nature tokens.',
        ignoredWhen: 'Ignored in Universe 2 (no U2 equivalent exists).',
        how: 'Applies from z230 onward.',
    }), 'boolean', false, null, 'Nature');
    createSetting('tokenthresh', 'Token Threshold',tip({
        what: 'A token reserve AT will not dip below when spending or converting Nature tokens.',
        how: '0 or below means no reserve &mdash; AT will spend down to whatever a purchase or conversion costs.',
    }), 'value', -1, null, 'Nature');
    createSetting('AutoPoison', 'Poison',tip({
        what: 'What AT does with your Poison tokens.',
        how: '<b>Empowerment</b> levels up Poison Empowerment. <b>Transfer</b> raises its retain level (capped at 80 by the game). <b>Convert to Wind/Ice</b> trades Poison tokens for the other nature at whatever rate your Nature talents give you. <b>Convert to Both</b> splits the trade evenly between Wind and Ice, and costs twice as many tokens per trade as converting to just one.',
    }), 'dropdown', 'Off', ['Off', 'Empowerment', 'Transfer', 'Convert to Wind', 'Convert to Ice', 'Convert to Both'], 'Nature');
    createSetting('AutoWind', 'Wind',tip({
        what: 'What AT does with your Wind tokens.',
        how: '<b>Empowerment</b> levels up Wind Empowerment. <b>Transfer</b> raises its retain level (capped at 80 by the game). <b>Convert to Poison/Ice</b> trades Wind tokens for the other nature at whatever rate your Nature talents give you. <b>Convert to Both</b> splits the trade evenly between Poison and Ice, and costs twice as many tokens per trade as converting to just one.',
    }), 'dropdown', 'Off', ['Off', 'Empowerment', 'Transfer', 'Convert to Poison', 'Convert to Ice', 'Convert to Both'], 'Nature');
    createSetting('AutoIce', 'Ice',tip({
        what: 'What AT does with your Ice tokens.',
        how: '<b>Empowerment</b> levels up Ice Empowerment. <b>Transfer</b> raises its retain level (capped at 80 by the game). <b>Convert to Poison/Wind</b> trades Ice tokens for the other nature at whatever rate your Nature talents give you. <b>Convert to Both</b> splits the trade evenly between Poison and Wind, and costs twice as many tokens per trade as converting to just one.',
    }), 'dropdown', 'Off', ['Off', 'Empowerment', 'Transfer', 'Convert to Poison', 'Convert to Wind', 'Convert to Both'], 'Nature');

    //Enlights
    (document.getElementById('AutoIce') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('autoenlight', 'Enlight: Auto',tip({
        what: 'Master switch for automatically buying Enlightenment (uber empowerment) once it is cheap enough.',
        ignoredWhen: 'Stops firing once you have reached Uber Nature &mdash; there is nothing left to enlighten. Ignored in Universe 2 (no U2 equivalent exists).',
        how: 'Applies from z230 onward, using the per-nature, per-context thresholds below.',
    }), 'boolean', false, null, 'Nature');
    (document.getElementById('autoenlight') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('pfillerenlightthresh', 'E: F: Poison',tip({
        what: 'Buys the Poison Enlightenment (in normal play, not Dailies or Challenge Squared) once its cost drops to or below this token threshold.',
        how: 'Also requires having enough Poison tokens banked to afford it. -1 disables Poison Enlightenment in this context. When more than one nature is affordable at once, AT buys whichever has the biggest cost-under-threshold margin first.',
    }), 'value', -1, null, 'Nature');
    createSetting('wfillerenlightthresh', 'E: F: Wind',tip({
        what: 'Buys the Wind Enlightenment (in normal play, not Dailies or Challenge Squared) once its cost drops to or below this token threshold.',
        how: 'Also requires having enough Wind tokens banked to afford it. -1 disables Wind Enlightenment in this context. When more than one nature is affordable at once, AT buys whichever has the biggest cost-under-threshold margin first.',
    }), 'value', -1, null, 'Nature');
    createSetting('ifillerenlightthresh', 'E: F: Ice',tip({
        what: 'Buys the Ice Enlightenment (in normal play, not Dailies or Challenge Squared) once its cost drops to or below this token threshold.',
        how: 'Also requires having enough Ice tokens banked to afford it. -1 disables Ice Enlightenment in this context. When more than one nature is affordable at once, AT buys whichever has the biggest cost-under-threshold margin first.',
    }), 'value', -1, null, 'Nature');
    (document.getElementById('ifillerenlightthresh') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('pdailyenlightthresh', 'E: D: Poison',tip({
        what: 'Buys the Poison Enlightenment during a Daily Challenge once its cost drops to or below this token threshold.',
        how: 'Also requires having enough Poison tokens banked to afford it. -1 disables Poison Enlightenment in Dailies.',
    }), 'value', -1, null, 'Nature');
    createSetting('wdailyenlightthresh', 'E: D: Wind',tip({
        what: 'Buys the Wind Enlightenment during a Daily Challenge once its cost drops to or below this token threshold.',
        how: 'Also requires having enough Wind tokens banked to afford it. -1 disables Wind Enlightenment in Dailies.',
    }), 'value', -1, null, 'Nature');
    createSetting('idailyenlightthresh', 'E: D: Ice',tip({
        what: 'Buys the Ice Enlightenment during a Daily Challenge once its cost drops to or below this token threshold.',
        how: 'Also requires having enough Ice tokens banked to afford it. -1 disables Ice Enlightenment in Dailies.',
    }), 'value', -1, null, 'Nature');
    (document.getElementById('idailyenlightthresh') as any).parentNode.insertAdjacentHTML('afterend', '<br>');
    createSetting('pc2enlightthresh', 'E: C: Poison',tip({
        what: 'Buys the Poison Enlightenment during a Challenge Squared (C2) run once its cost drops to or below this token threshold.',
        how: 'Also requires having enough Poison tokens banked to afford it. -1 disables Poison Enlightenment in C2.',
    }), 'value', -1, null, 'Nature');
    createSetting('wc2enlightthresh', 'E: C: Wind',tip({
        what: 'Buys the Wind Enlightenment during a Challenge Squared (C2) run once its cost drops to or below this token threshold.',
        how: 'Also requires having enough Wind tokens banked to afford it. -1 disables Wind Enlightenment in C2.',
    }), 'value', -1, null, 'Nature');
    createSetting('ic2enlightthresh', 'E: C: Ice',tip({
        what: 'Buys the Ice Enlightenment during a Challenge Squared (C2) run once its cost drops to or below this token threshold.',
        how: 'Also requires having enough Ice tokens banked to afford it. -1 disables Ice Enlightenment in C2.',
    }), 'value', -1, null, 'Nature');


    //MAZ window Stuff
    (document.getElementById('Rtimefarmmaz') as any).setAttribute('onclick', 'MAZLookalike("Time Farm", "Rtimefarm")');
    (document.getElementById('Rdtimefarmmaz') as any).setAttribute('onclick', 'MAZLookalike("dTime Farm", "Rdtimefarm")');
    (document.getElementById('Rsmithyfarmmaz') as any).setAttribute('onclick', 'MAZLookalike("Smithy Farm", "Rsmithyfarm")');
    (document.getElementById('Rtributefarmmaz') as any).setAttribute('onclick', 'MAZLookalike("Tribute Farm", "Rtributefarm")');
    (document.getElementById('Hshrinemaz') as any).setAttribute('onclick', 'MAZLookalike("Shrine - U1", "Hshrine")');
    (document.getElementById('Hdshrinemaz') as any).setAttribute('onclick', 'MAZLookalike("Shrine - U1 (Daily)", "Hdshrine")');
    (document.getElementById('Rshrinemaz') as any).setAttribute('onclick', 'MAZLookalike("Shrine - U2", "Rshrine")');
    (document.getElementById('Rdshrinemaz') as any).setAttribute('onclick', 'MAZLookalike("Shrine - U2 (Daily)", "Rdshrine")');
    (document.getElementById('Rblackbogmaz') as any).setAttribute('onclick', 'MAZLookalike("Quagmire", "Rblackbog")');
    (document.getElementById('Rinsanitymaz') as any).setAttribute('onclick', 'MAZLookalike("Insanity", "Rinsanityon")');
    (document.getElementById('Ralchfarmmaz') as any).setAttribute('onclick', 'MAZLookalike("Alch", "Ralchon")');
    (document.getElementById('Rhypofarmmaz') as any).setAttribute('onclick', 'MAZLookalike("Hypo", "Rhypoon")');
    (document.getElementById('RAMPraidmaz') as any).setAttribute('onclick', 'MAZLookalike("Praid", "RAMPraid")');
    (document.getElementById('RdAMPraidmaz') as any).setAttribute('onclick', 'MAZLookalike("dPraid", "RdAMPraid")');

    //Display

    //Line 1
    createSetting('zonetracker', 'Zone',tip({
        what: 'Internal bookkeeping, not a visible setting — AT stores the last zone number it saw here, refreshed on every zone change. This box never appears in the settings UI, and nothing else in AutoTrimps reads the value.',
    }), 'value', 1, null, 'Display');
    createSetting('EnhanceGrids', 'Enhance Grids',tip({
        what: 'Adds a drop-shadow highlight to exotic, powerful and skeleton-type Trimps on the world and map grids, so they stand out at a glance.',
        how: 'Purely visual — it changes nothing about how AT plays.',
    }), 'boolean', false, null, 'Display');
    createSetting('showbreedtimer', 'Enable Breed Timer',tip({
        what: 'Shows a live countdown to when your next batch of Trimps finishes breeding, updated every tick.',
        how: 'Turning it off skips that per-tick update and hides the countdown.',
    }), 'boolean', true, null, 'Display');
    createSetting('showautomapstatus', 'Enable AutoMap Status',tip({
        what: 'Shows a live status line describing what AutoMap is currently doing in Universe 1, updated every tick.',
        how: 'Turning it off skips that per-tick update and hides the status line.',
    }), 'boolean', true, null, 'Display');
    createSetting('Rshowautomapstatus', 'Enable AutoMap Status',tip({
        what: 'Shows a live status line describing what AutoMap is currently doing in Universe 2 (Radon), updated every tick.',
        how: 'Turning it off skips that per-tick update and hides the status line.',
    }), 'boolean', true, null, 'Display');
    createSetting('EnableAFK', 'Go AFK Mode',tip({
        what: 'A button, not a toggle — clicking it puts AutoTrimps into AFK Mode: a black overlay covers the game and the browser stops repainting the Trimps UI, to save CPU while you\'re away.',
        how: 'Also silences console debug output. Click <b>I\'m Back</b> on the overlay to resume normal updates. You can also click the zone/world-info area at the top of the game at any time to trigger AFK Mode without using this button.',
    }), 'action', 'MODULES["performance"].EnableAFKMode()', null, 'Display');
    (document.getElementById('battleSideTitle') as any).setAttribute('onclick', 'MODULES["performance"].EnableAFKMode()');
    (document.getElementById('battleSideTitle') as any).setAttribute('onmouseover', "getZoneStats(event);this.style.cursor='pointer'");
    createSetting('ChangeLog', 'Show Changelog',tip({
        what: 'A button, not a toggle — reopens the changelog popup AT shows on startup, in case you missed it.',
    }), 'action', 'printChangelog()', null, 'Display');
    (document.getElementById('Display') as any).lastChild.insertAdjacentHTML('afterend', '<br>');



    //SPAM

    //Line 1

    createSetting('SpamGeneral', 'General Spam',tip({
        what: 'Hides general notifications from the AutoTrimps message log — misc alerts like using a Bone Charge or falling back to your highest map when Auto Gigastation can\'t find a target zone.',
    }), 'boolean', true, null, 'Display');
    createSetting('SpamUpgrades', 'Upgrades Spam',tip({
        what: 'Hides "Upgraded X" notifications from the AutoTrimps message log whenever AT buys a non-equipment upgrade.',
    }), 'boolean', true, null, 'Display');
    createSetting('SpamEquipment', 'Equipment Spam',tip({
        what: 'Hides equipment notifications from the AutoTrimps message log — buying, leveling and upgrading Armor and Weapons.',
    }), 'boolean', true, null, 'Display');
    createSetting('SpamMaps', 'Maps Spam',tip({
        what: 'Hides map notifications from the AutoTrimps message log — buying, picking and running maps, recycling, and "can\'t afford" messages.',
    }), 'boolean', true, null, 'Display');
    createSetting('SpamOther', 'Other Spam',tip({
        what: 'Hides a catch-all group of notifications from the AutoTrimps message log — mostly Better Auto Fight, Trimpicide, AutoBreed/Genetics timer changes, and anything that doesn\'t fit the other Spam categories.',
    }), 'boolean', true, null, 'Display');
    createSetting('SpamBuilding', 'Building Spam',tip({
        what: 'Hides building notifications from the AutoTrimps message log — every building AT buys, including Storage.',
    }), 'boolean', false, null, 'Display');
    createSetting('SpamJobs', 'Job Spam',tip({
        what: 'Hides job notifications from the AutoTrimps message log — hiring or firing Farmers, Lumberjacks, Miners and other workers.',
    }), 'boolean', false, null, 'Display');

    //Line 2
    createSetting('SpamGraphs', 'Starting Zone Spam',tip({
        what: 'Hides a small group of notifications from the AutoTrimps message log — RoboTrimp\'s MagnetoShriek activating, and the dark-theme graph stylesheet loading or unloading.',
    }), 'boolean', true, null, 'Display');
    createSetting('SpamMagmite', 'Magmite/Magma Spam',tip({
        what: 'Hides Magmite and Magma notifications from the AutoTrimps message log — Magmite auto-spending and buying Magmamancers.',
    }), 'boolean', true, null, 'Display');
    createSetting('SpamPerks', 'AutoPerks Spam',tip({
        what: 'Hides AutoPerks notifications from the AutoTrimps message log — helium allocation results and AutoPerks errors.',
    }), 'boolean', true, null, 'Display');
    createSetting('SpamNature', 'Nature Spam',tip({
        what: 'Hides Nature notifications from the AutoTrimps message log — upgrading Empowerment or transfer rate, and converting Poison, Wind or Ice tokens.',
    }), 'boolean', true, null, 'Display');



    //Export/Import/Default
    createSetting('ImportAutoTrimps', 'Import AutoTrimps',tip({
        what: 'Opens a box to paste in a previously exported AutoTrimps settings string and load it.',
        how: 'After importing, AT asks for a name to save it as a new settings profile.',
        cannot: 'This replaces your entire current settings file — there is no merge, and no undo once you confirm.',
    }), 'infoclick', 'ImportAutoTrimps', null, 'Import Export');
    createSetting('ExportAutoTrimps', 'Export AutoTrimps',tip({
        what: 'Opens your current AutoTrimps settings as a JSON string you can copy and save.',
        how: 'Paste it back in later via <b>Import AutoTrimps</b> to restore this exact configuration.',
    }), 'infoclick', 'ExportAutoTrimps', null, 'Import Export');
    createSetting('DefaultAutoTrimps', 'Reset to Default',tip({
        what: 'Wipes your saved AutoTrimps settings and reloads the script\'s factory defaults.',
        cannot: 'This is permanent — export your current settings first if you might want them back.',
    }), 'infoclick', 'ResetDefaultSettingsProfiles', null, 'Import Export');
    createSetting('Export60', '-60 AT Settings',tip({
        what: 'Shows a canned example AutoTrimps settings string tuned for an early game (roughly zone 60).',
        how: 'This is a fixed example, not a snapshot of your own settings — use it as a starting point to import and adjust, not as a perfect fit.',
    }), 'infoclick', 'Export60', null, 'Import Export');
    createSetting('Export550', '550+ AT Settings',tip({
        what: 'Shows a canned example AutoTrimps settings string tuned for a late game (roughly zone 550+).',
        how: 'This is a fixed example, not a snapshot of your own settings — use it as a starting point to import and adjust, not as a perfect fit.',
    }), 'infoclick', 'Export550', null, 'Import Export');
    createSetting('CleanupAutoTrimps', 'Cleanup Saved Settings ',tip({
        what: 'Removes leftover keys in your saved settings file from settings that older versions of AutoTrimps used to define, but this version no longer does.',
        how: 'Previews the exact key list first and only deletes after you explicitly confirm — your live settings are never touched.',
    }), 'infoclick', 'CleanupAutoTrimps', null, 'Import Export');

    (document.getElementById('Rchallengehidearch') as any).setAttribute('onclick', 'settingChanged("Rchallengehidearch"), modifyParentNode("Rchallengehidearch", "Rarchstring3")');
    modifyParentNode("Rchallengehidearch", "Rarchstring3");

    (document.getElementById('Rchallengehidemayhem') as any).setAttribute('onclick', 'settingChanged("Rchallengehidemayhem"), modifyParentNode("Rchallengehidemayhem", "Rmayhemmap")');
    modifyParentNode("Rchallengehidemayhem", "Rmayhemmap");

    (document.getElementById('Rchallengehidestorm') as any).setAttribute('onclick', 'settingChanged("Rchallengehidestorm"), modifyParentNode("Rchallengehidestorm", "Rstormmult")');
    modifyParentNode("Rchallengehidestorm", "Rstormmult");

    (document.getElementById('Rchallengehideinsanity') as any).setAttribute('onclick', 'settingChanged("Rchallengehideinsanity"), modifyParentNode("Rchallengehideinsanity", "Rinsanityfarmfrag")');
    modifyParentNode("Rchallengehideinsanity", "Rinsanityfarmfrag");

    (document.getElementById('Rchallengehideexterminate') as any).setAttribute('onclick', 'settingChanged("Rchallengehideexterminate"), modifyParentNode("Rchallengehideexterminate", "Rexterminateeq")');
    modifyParentNode("Rchallengehideexterminate", "Rexterminateeq");

    (document.getElementById('Rchallengehidepanda') as any).setAttribute('onclick', 'settingChanged("Rchallengehidepanda"), modifyParentNode("Rchallengehidepanda", "Rpandahits")');
    modifyParentNode("Rchallengehidepanda", "Rpandahits");

    (document.getElementById('Rchallengehidealchemy') as any).setAttribute('onclick', 'settingChanged("Rchallengehidealchemy"), modifyParentNode("Rchallengehidealchemy", "Ralchfarmfrag")');
    modifyParentNode("Rchallengehidealchemy", "Ralchfarmfrag");

    (document.getElementById('Rchallengehidehypothermia') as any).setAttribute('onclick', 'settingChanged("Rchallengehidehypothermia"), modifyParentNode("Rchallengehidehypothermia", "Rhypostorage")');
    modifyParentNode("Rchallengehidehypothermia", "Rhypostorage");
    
    (document.getElementById('Rchallengehidedeso') as any).setAttribute('onclick', 'settingChanged("Rchallengehidedeso"), modifyParentNode("Rchallengehidedeso", "Rdesomult")');
    modifyParentNode("Rchallengehidedeso", "Rdesomult");

    settingsProfileMakeGUI();

}
