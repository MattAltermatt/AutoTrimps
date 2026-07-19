import { history } from './sampler'

const LABEL: Record<string, string> = { food: 'Food', wood: 'Wood', metal: 'Metal', science: 'Science', fragments: 'Fragments', gems: 'Gems', helium: 'Helium' }
// The game's own gather verbs (main.js:4498-4504): Gather→Gathering, Chop→Chopping, Mine→Mining,
// Research→Researching. The lit badge uses the active (gerund) form for the resource being worked.
const VERB: Record<string, string> = { food: 'Gathering', wood: 'Chopping', metal: 'Mining', science: 'Researching' }
// Turkimp boosts food/wood/metal gathering, so those three carry the 🦃 verb treatment while it's active.
const TURK_RESOURCES = new Set(['food', 'wood', 'metal'])
const W = 240
const H = 40

// A turkimp is active if the timed buff is running OR the permanent turkimp2 talent is owned.
// Read game state only (never recompute) — mirrors the game's own `#turkimpBuff` gate (main.js:1100).
function turkimpActive(): boolean {
  const g = (globalThis as any).game
  return !!(g?.talents?.turkimp2?.purchased || (g?.global?.turkimpTimer ?? 0) > 0)
}

interface TileRefs {
  owned: HTMLElement
  max: HTMLElement
  rate: HTMLElement
  auto: HTMLElement
  // Sparkline refs are absent on Helium — its tile is chart-free (the Turkimp timer took that slot).
  line?: SVGPathElement
  area?: SVGPathElement
  dot?: SVGCircleElement
}
const refs: Record<string, TileRefs> = {}

// Build the layout-B tile ONCE; update() mutates cached child refs (never per-tick innerHTML —
// the replaceChildren+click gotcha). No Chop/Mine/Research button: AutoTrimps clicks it, not the player.
// Helium is built CHART-FREE (no sparkline): it shows total + per-hour only, and the Turkimp timer
// tile sits below it in the misc column instead of a helium graph.
export function buildTile(r: string): HTMLElement {
  const tile = document.createElement('div')
  tile.className = `at-rt at-rt-${r}`
  tile.id = `atRT-${r}`
  const spark = r === 'helium' ? '' :
    `<svg class="at-rt-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
    `<path class="at-rt-area"/><path class="at-rt-line"/><circle class="at-rt-now" r="3"/></svg>`
  tile.innerHTML =
    `<div class="at-rt-head"><span class="at-rt-name">${LABEL[r]}</span><span class="at-rt-auto" data-on="0">${VERB[r] ?? ''}</span></div>` +
    `<div class="at-rt-figs"><span class="at-rt-amt"><span class="at-rt-owned"></span><span class="at-rt-max"></span></span><span class="at-rt-rate"></span></div>` +
    spark
  refs[r] = {
    owned: tile.querySelector('.at-rt-owned')!,
    max: tile.querySelector('.at-rt-max')!,
    rate: tile.querySelector('.at-rt-rate')!,
    auto: tile.querySelector('.at-rt-auto')!,
    line: tile.querySelector<SVGPathElement>('.at-rt-line') ?? undefined,
    area: tile.querySelector<SVGPathElement>('.at-rt-area') ?? undefined,
    dot: tile.querySelector<SVGCircleElement>('.at-rt-now') ?? undefined,
  }
  return tile
}

function txt(id: string): string {
  return document.getElementById(id)?.textContent ?? ''
}

export function sparkPath(arr: number[]): { line: string; area: string; y: number } {
  if (arr.length < 2) return { line: '', area: '', y: H - 4 }
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const span = max - min || 1
  const step = W / (arr.length - 1)
  const ys = arr.map((v) => H - 4 - ((v - min) / span) * (H - 8))
  const line = arr.map((_, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${ys[i].toFixed(1)}`).join(' ')
  const area = `M0 ${H} ` + arr.map((_, i) => `L${(i * step).toFixed(1)} ${ys[i].toFixed(1)}`).join(' ') + ` L${W} ${H} Z`
  return { line, area, y: ys[ys.length - 1] }
}

// Mirror the game's own live spans (drift-free) + redraw the sparkline from the sampler.
export function updateTile(r: string): void {
  const x = refs[r]
  if (!x) return
  x.owned.textContent = txt(`${r}Owned`)
  const maxTxt = txt(`${r}Max`)
  x.max.textContent = maxTxt ? ` / ${maxTxt}` : ''
  x.rate.textContent = txt(r === 'helium' ? 'heliumPh' : `${r}Ps`)
  // Badge visibility + treatment:
  //  - data-gather: this resource is the one AT is CURRENTLY hand-gathering (green, pulsing).
  //  - data-turk: turkimp is active AND this is food/wood/metal (gold, 🦃-wrapped verb via CSS).
  //  - data-on: visible when either applies. During turkimp all three of food/wood/metal light gold
  //    (a loud "turkimp is ON"); the actively-gathered one additionally pulses (data-gather).
  const gathering = (globalThis as any).game?.global?.playerGathering === r
  const turk = turkimpActive() && TURK_RESOURCES.has(r)
  x.auto.setAttribute('data-gather', gathering ? '1' : '0')
  x.auto.setAttribute('data-turk', turk ? '1' : '0')
  x.auto.setAttribute('data-on', gathering || turk ? '1' : '0')
  // Helium is chart-free (no sparkline refs) — skip the redraw for it.
  if (!x.line || !x.area || !x.dot) return
  const p = sparkPath(history(r))
  x.line.setAttribute('d', p.line)
  x.area.setAttribute('d', p.area)
  x.dot.setAttribute('cx', String(W))
  x.dot.setAttribute('cy', p.y.toFixed(1))
}
