// Phase 1: the seam is live — converted modules publish to global via the bridge.
// The build emits this src bundle right after AutoTrimps2.js (before the remaining
// legacy modules), so still-legacy load-time callers resolve the published functions.
import './legacy-bridge'
import { seedModuleDefaults } from './modules/import-export'
import { bootGraphs } from './modules/graphs'

// perks has no exports — its API is the AutoPerks/RAutoPerks globals it assigns, and its
// top-level AutoPerks.displayGUI() calls converted utils (safeSetItems) by bare name. So it
// must run AFTER legacy-bridge's Object.assign publishes those globals — hence imported here,
// after the bridge, not inside it. (ES imports run depth-first in order, so the bridge body
// executes before this line.) Matches the original load order: perks ran after utils, before
// SettingsGUI. Side-effect import only.
import './modules/perks'
// fight-info is a self-contained IIFE registering MODULES.fightinfo (no exports). Its
// load-time code only touches game DOM + MODULES, so ordering is not critical, but it lives
// here with the other side-effect-only converted modules.
import './modules/fight-info'
// performance is a self-contained IIFE registering MODULES.performance (no exports). Side-effect import.
import './modules/performance'
// NOTE: settings-boot is imported+published by legacy-bridge (its bootSettingsUI export must be a
// global). It no longer self-invokes at bundle-eval time — initializeAutoTrimps() calls it after
// loadPageVariables() so the 570 createSetting calls rehydrate the loaded save, not empty defaults.

// #102 — MUST be the last statement: it deep-clones MODULES into MODULESdefault, so every
// `MODULES["x"] = {…}` above has to have run. Until this existed, MODULESdefault was seeded only by
// delayStartAgain() — 8s (2 × startupDelay) into the page — while the settings GUI was already live at
// 4s, so compareModuleVars()/exportModuleVars()/resetModuleVars() threw a TypeError for anyone who
// clicked Export or "Reset Module Vars" in between. Reset left AT dead until reload (it throws with
// ATrunning already false). See the long comment on compareModuleVars() — the eager seed alone is NOT
// sufficient (MODULES.graphs is registered by bootGraphs() below, AFTER this clone), so the read is total too.
seedModuleDefaults()

// The Graphs dashboard (was the post-IIFE legacy Graphs.js). Runs AFTER seedModuleDefaults so
// MODULES.graphs — which bootGraphs registers via createUI/themeChanged — is deliberately excluded
// from MODULESdefault, exactly as the legacy load order excluded it. createUI reads the static game
// DOM (#settingsTable, index.html:1003), present from page load, so this bundle-eval timing is safe.
bootGraphs()

// NOTE: the custom-UI shell (#41) is booted from initializeAutoTrimps() in main-loop.ts, NOT here.
// It must run AFTER bootSettingsUI() rehydrates the saved settings, or getPageSetting('ATCustomUI')
// reads the empty pre-load autoTrimpSettings ({}) and the shell never activates for a user who saved
// it ON (it would silently no-op every reload while the toggle renders ON).

console.log('[AutoTrimps] modern build booted')
