// Phase 1: the seam is live — converted modules publish to global via the bridge.
// The build emits this src bundle right after AutoTrimps2.js (before the remaining
// legacy modules), so still-legacy load-time callers resolve the published functions.
import './legacy-bridge'

console.log('[AutoTrimps] modern build booted')
