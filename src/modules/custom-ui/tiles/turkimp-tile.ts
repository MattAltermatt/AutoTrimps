// #149: the Turkimp buff tile — a slim gold row in the misc column (below Helium) that restores the
// "Well Fed" turkimp cue the custom UI dropped. It MIRRORS the game's own live `#turkimpTime` span
// (never recomputes the countdown); shows ∞ when the permanent `turkimp2` talent is owned, and a dim
// `—` placeholder when no turkimp is active. Build-once + mutate cached refs (no per-tick innerHTML).

let tile: HTMLElement | null = null
let valEl: HTMLElement | null = null
let timerEl: HTMLElement | null = null

function turkimpPermanent(): boolean {
  return !!(globalThis as any).game?.talents?.turkimp2?.purchased
}
function turkimpActive(): boolean {
  const g = (globalThis as any).game
  return !!(g?.talents?.turkimp2?.purchased || (g?.global?.turkimpTimer ?? 0) > 0)
}

export function buildTurkimpTile(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'at-rt at-turk'
  el.id = 'atRT-turkimp'
  el.innerHTML =
    '<div class="at-turk-row"><span class="at-rt-name">Turkimp</span>' +
    '<span class="at-turk-timer"><span class="tk">🦃</span><span class="at-turk-val"></span></span></div>'
  tile = el
  timerEl = el.querySelector('.at-turk-timer')
  valEl = el.querySelector('.at-turk-val')
  return el
}

// Mirror the buff state. Permanent (turkimp2) → ∞; active → the game's own MM:SS text; idle → dim `—`.
// The game keeps `#turkimpTime` fresh each tick via gather()→updateTurkimpTime(), even while #trimps is
// hidden, so reading its textContent is drift-free. (Permanent renders an ∞ ICON there — no text — so we
// emit our own ∞ rather than mirror an empty string.)
export function updateTurkimpTile(): void {
  if (!tile || !valEl || !timerEl) return
  const permanent = turkimpPermanent()
  const active = turkimpActive()
  tile.classList.toggle('idle', !active)
  timerEl.classList.toggle('inf', permanent)
  if (permanent) { valEl.textContent = '∞'; return }
  if (!active) { valEl.textContent = '—'; return }
  const t = document.getElementById('turkimpTime')?.textContent?.trim()
  valEl.textContent = t && t.length ? t : ''
}

// Idempotent: mount the tile into #miscColumn (after the Helium tile if present) and refresh it. Called
// from the same 200ms tick as the resource region, AFTER syncRegion() has (re)mounted the helium tile.
export function syncTurkimpTile(): void {
  const col = document.getElementById('miscColumn')
  if (!col) return
  let el = document.getElementById('atRT-turkimp')
  if (!el) {
    el = buildTurkimpTile()
    // Locate the helium tile by CLASS (its id is built from a template, so a literal id lookup can't
    // resolve it — and the DOM-id net rightly rejects that). Place the Turkimp row directly after it.
    const helium = col.querySelector('.at-rt-helium')
    if (helium) helium.after(el)
    else col.appendChild(el)
  }
  updateTurkimpTile()
}

export function deactivateTurkimpTile(): void {
  document.getElementById('atRT-turkimp')?.remove()
  tile = null
  valEl = null
  timerEl = null
}
