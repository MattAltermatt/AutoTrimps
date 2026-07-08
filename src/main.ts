// Phase 0: the modern build has no logic yet — the legacy concat carries all
// behavior. This IIFE runs AFTER the legacy code and only proves the src → esbuild
// → bundle → boot pipeline works end to end. Real entry logic arrives in Phase 1.
console.log('[AutoTrimps] modern build booted')
