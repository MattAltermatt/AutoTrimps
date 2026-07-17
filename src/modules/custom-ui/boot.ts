import { ensureShell, showShell, hideShell } from './shell'
import { adoptHud, releaseHud } from './adopt'
import { customUIState } from './state'
import { syncRegion, deactivateRegion, sampleTick } from './tiles/resource-region'

// getPageSetting is the global ambient seam (src/game/at-legacy.d.ts) — no local redeclare (#36).

// Timers for the graduated resource region — live only while the custom UI is active (Phase 2).
// sampleTick feeds the 60s ring buffer (1/s); refreshTiles mirrors the game spans + redraws (5/s).
let sampleTimer: ReturnType<typeof setInterval> | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null

function startTiles(): void {
  syncRegion()
  sampleTick() // seed one sample so the tiles aren't empty
  // The 200ms refresh also re-runs syncRegion, so a resource unlocked mid-session (or re-locked by a
  // portal reset) is picked up without a native-panel flash.
  if (sampleTimer === null) sampleTimer = setInterval(sampleTick, 1000)
  if (refreshTimer === null) refreshTimer = setInterval(syncRegion, 200)
}
function stopTiles(): void {
  if (sampleTimer !== null) { clearInterval(sampleTimer); sampleTimer = null }
  if (refreshTimer !== null) { clearInterval(refreshTimer); refreshTimer = null }
  deactivateRegion()
}

export function applyCustomUI(active: boolean): void {
  if (active) {
    ensureShell()
    adoptHud()
    showShell()
    startTiles()
    customUIState.active = true
  } else {
    stopTiles()
    releaseHud()
    hideShell()
    customUIState.active = false
  }
}

// Called from main.ts after bootGraphs(). OFF (default) = pure no-op: byte-identical.
export function bootCustomUI(): void {
  if (!getPageSetting('ATCustomUI')) return
  applyCustomUI(true)
}
