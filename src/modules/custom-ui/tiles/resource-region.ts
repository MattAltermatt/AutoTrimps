import { RESOURCES, sampleTick } from './sampler'
import { buildTile, updateTile } from './resource-tile'

const HIDDEN_CLASS = 'at-rt-hidden'
const mounted: string[] = []

// Per #149: Fragments/Gems/Helium are ALWAYS shown — mounted even while the game still hides them
// (pre-unlock), so the secondary column is never empty. The four hand-gathered resources still gate
// on unlock (they'd be noise at zone 1). A resource here is never unmounted by a portal re-lock.
const ALWAYS_ON = new Set(['fragments', 'gems', 'helium'])

// Native resource blocks hide until unlocked — food/wood/metal/science/fragments/gems via
// visibility:hidden, helium via display:none. Unlocked = neither hidden mechanism is active.
function isUnlocked(native: HTMLElement): boolean {
  return native.style.visibility !== 'hidden' && native.style.display !== 'none'
}

// Idempotent graduation sync — safe to call repeatedly (initial mount + periodic from the refresh
// tick). It (1) hides every native block via the HIDDEN_CLASS (`display:none !important`, applied on
// every tick so it survives the game's own reveal animation, which sets an INLINE `display:block` on
// unlock — an inline style a plain `display:none` would lose to, producing a duplicate native tile;
// `!important` beats it). Ids are preserved (Rule 3), so the game keeps updating the block as our
// mirror source and a resource never flashes its native panel + button. Then it (2) mounts an AT tile
// for each newly-unlocked resource and (3) unmounts tiles for resources re-locked by a portal reset.
export function syncRegion(): void {
  const col = document.getElementById('resourceColumn')
  if (!col) return
  for (const r of RESOURCES) {
    const native = document.getElementById(r)
    if (!native || !native.parentElement) continue
    native.classList.add(HIDDEN_CLASS)
    const unlocked = ALWAYS_ON.has(r) || isUnlocked(native)
    const isMounted = mounted.includes(r)
    if (unlocked && !isMounted) {
      const tile = buildTile(r)
      tile.classList.add('at-rt-mounted')
      native.parentElement.insertBefore(tile, native)
      mounted.push(r)
    } else if (!unlocked && isMounted) {
      document.getElementById(`atRT-${r}`)?.remove()
      mounted.splice(mounted.indexOf(r), 1)
    }
  }
  refreshTiles()
}

export function deactivateRegion(): void {
  for (const r of mounted) document.getElementById(`atRT-${r}`)?.remove()
  for (const r of RESOURCES) document.getElementById(r)?.classList.remove(HIDDEN_CLASS)
  mounted.length = 0
}

export function refreshTiles(): void {
  for (const r of mounted) updateTile(r)
}

export { sampleTick }
