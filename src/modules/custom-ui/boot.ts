import { ensureShell, showShell, hideShell } from './shell'
import { adoptHud, releaseHud } from './adopt'
import { customUIState } from './state'

// getPageSetting is the global ambient seam (src/game/at-legacy.d.ts) — no local redeclare (#36).

export function applyCustomUI(active: boolean): void {
  if (active) {
    ensureShell()
    adoptHud()
    showShell()
    customUIState.active = true
  } else {
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
