/* eslint-disable */
// @ts-nocheck
// Load-time boot for the settings UI. Runs LAST (imported last in main.ts), after the bridge has
// published settings-engine/menu/visibility/defs. Centralizes the ordering contract that
// legacy/SettingsGUI.js used to enforce by source position: menu chrome first (builds the tab
// containers), then the 570 setting definitions (populate them).
//
// Order matches legacy/SettingsGUI.js exactly:
//   automationMenuInit()  →  automationMenuSettingsInit()  →  inject tabs.css  →
//   initializeAllTabs()   →  initializeAllSettings()
// All names resolve at runtime via the global bridge. basepath + the game DOM are provided by
// AutoTrimps2.js, which runs before this src bundle in the concat.
automationMenuInit();
automationMenuSettingsInit();
var link1 = document.createElement("link");
link1.rel = "stylesheet", link1.type = "text/css", link1.href = basepath + "tabs.css", document.head.appendChild(link1);
initializeAllTabs();
initializeAllSettings();
