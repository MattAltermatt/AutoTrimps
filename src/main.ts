// Phase 1: the seam is live — converted modules publish to global via the bridge.
// The build emits this src bundle right after AutoTrimps2.js (before the remaining
// legacy modules), so still-legacy load-time callers resolve the published functions.
import './legacy-bridge'

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

console.log('[AutoTrimps] modern build booted')
