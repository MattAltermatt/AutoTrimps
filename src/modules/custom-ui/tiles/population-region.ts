import { buildPopulationTile, updatePopulationTile, releaseAdopted } from './population-tile'

const HIDDEN_CLASS = 'at-rt-hidden'
let mounted = false

// #trimps ships visibility:hidden until unlocked (basically always, from zone 1).
function isUnlocked(el: HTMLElement): boolean {
  return el.style.visibility !== 'hidden' && el.style.display !== 'none'
}

// Idempotent graduation sync (mirrors resource-region.syncRegion): mount on unlock, unmount + restore
// the adopted nodes on portal re-lock. Hide the native #trimps via the !important class every tick so
// the game's reveal animation (inline display:block) can't un-hide it into a duplicate panel.
export function syncPopulationRegion(): void {
  const native = document.getElementById('trimps')
  if (!native || !native.parentElement) return
  native.classList.add(HIDDEN_CLASS)
  const unlocked = isUnlocked(native)
  if (unlocked && !mounted) {
    const tile = buildPopulationTile()
    native.parentElement.insertBefore(tile, native)
    mounted = true
  } else if (!unlocked && mounted) {
    releaseAdopted()
    document.getElementById('atRT-population')?.remove()
    mounted = false
  }
  if (mounted) updatePopulationTile()
}

export function deactivatePopulationRegion(): void {
  if (mounted) {
    releaseAdopted()
    document.getElementById('atRT-population')?.remove()
    mounted = false
  }
  document.getElementById('trimps')?.classList.remove(HIDDEN_CLASS)
}
