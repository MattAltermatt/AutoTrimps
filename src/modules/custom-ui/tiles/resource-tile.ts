import { history } from './sampler'

const LABEL: Record<string, string> = { food: 'Food', wood: 'Wood', metal: 'Metal', science: 'Science', fragments: 'Fragments', gems: 'Gems', helium: 'Helium' }
// The game's own gather verbs (main.js:4498-4504): Gather→Gathering, Chop→Chopping, Mine→Mining,
// Research→Researching. The lit badge uses the active (gerund) form for the resource being worked.
const VERB: Record<string, string> = { food: 'Gathering', wood: 'Chopping', metal: 'Mining', science: 'Researching' }
const W = 240
const H = 40

interface TileRefs {
  owned: HTMLElement
  max: HTMLElement
  rate: HTMLElement
  auto: HTMLElement
  line: SVGPathElement
  area: SVGPathElement
  dot: SVGCircleElement
}
const refs: Record<string, TileRefs> = {}

// Build the layout-B tile ONCE; update() mutates cached child refs (never per-tick innerHTML —
// the replaceChildren+click gotcha). No Chop/Mine/Research button: AutoTrimps clicks it, not the player.
export function buildTile(r: string): HTMLElement {
  const tile = document.createElement('div')
  tile.className = `at-rt at-rt-${r}`
  tile.id = `atRT-${r}`
  tile.innerHTML =
    `<div class="at-rt-head"><span class="at-rt-name">${LABEL[r]}</span><span class="at-rt-auto" data-on="0">${VERB[r] ?? ''}</span></div>` +
    `<div class="at-rt-figs"><span class="at-rt-amt"><span class="at-rt-owned"></span><span class="at-rt-max"></span></span><span class="at-rt-rate"></span></div>` +
    `<svg class="at-rt-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
    `<path class="at-rt-area"/><path class="at-rt-line"/><circle class="at-rt-now" r="3"/></svg>`
  refs[r] = {
    owned: tile.querySelector('.at-rt-owned')!,
    max: tile.querySelector('.at-rt-max')!,
    rate: tile.querySelector('.at-rt-rate')!,
    auto: tile.querySelector('.at-rt-auto')!,
    line: tile.querySelector('.at-rt-line')!,
    area: tile.querySelector('.at-rt-area')!,
    dot: tile.querySelector('.at-rt-now')!,
  }
  return tile
}

function txt(id: string): string {
  return document.getElementById(id)?.textContent ?? ''
}

function sparkPath(arr: number[]): { line: string; area: string; y: number } {
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
  // Live gather focus: light the badge only on the resource AT is CURRENTLY hand-gathering
  // (game.global.playerGathering), so exactly one tile is lit and it moves as AT switches. The
  // rate (+X/sec) already conveys job-driven production, so the two don't overlap.
  const gathering = (globalThis as any).game?.global?.playerGathering === r
  x.auto.setAttribute('data-on', gathering ? '1' : '0')
  const p = sparkPath(history(r))
  x.line.setAttribute('d', p.line)
  x.area.setAttribute('d', p.area)
  x.dot.setAttribute('cx', String(W))
  x.dot.setAttribute('cy', p.y.toFixed(1))
}
