/* eslint-disable */
// @ts-nocheck
// Boot for the settings UI. Published to global via legacy-bridge; INVOKED by AutoTrimps2.js's
// initializeAutoTrimps() at t≈4000ms — right AFTER loadPageVariables() — exactly where legacy
// async-loaded SettingsGUI.js. This ordering is load-bearing: createSetting rehydrates the flat
// saved blob (autoTrimpSettings[id]) into typed setting objects, so it MUST run after
// loadPageVariables() has replaced autoTrimpSettings with the deserialized save. Running it at
// bundle-eval time (t=0, before load) wrapped the empty defaults, then loadPageVariables()
// clobbered every wrapped object back to a bare value → getPageSetting() returned undefined for
// all 546 settings and `getPageSetting('Praidingzone').length` threw every mainLoop tick (#22).
//
// It also must run exactly ONCE: createSetting appends its button DOM unconditionally, so a second
// pass would duplicate all ~570 controls. Hence a single call from initializeAutoTrimps, not a
// self-invocation here.
//
// Order matches legacy/SettingsGUI.js exactly:
//   automationMenuInit()  →  automationMenuSettingsInit()  →  inject tabs.css  →
//   initializeAllTabs()   →  initializeAllSettings()
// All names resolve at runtime via the global bridge. basepath + the game DOM are provided by
// AutoTrimps2.js, which runs before this src bundle in the concat.
export function bootSettingsUI() {
    automationMenuInit();
    automationMenuSettingsInit();
    var link1 = document.createElement("link");
    link1.rel = "stylesheet", link1.type = "text/css", link1.href = basepath + "tabs.css", document.head.appendChild(link1);
    initializeAllTabs();
    initializeAllSettings();
}
