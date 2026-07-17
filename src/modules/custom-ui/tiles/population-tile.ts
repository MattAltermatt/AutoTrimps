import { history, POP } from './sampler'
import { sparkPath } from './resource-tile'

const W = 240
const H = 40

interface PopRefs {
  owned: HTMLElement
  max: HTMLElement
  rate: HTMLElement
  breeding: HTMLElement
  employed: HTMLElement
  maxEmployed: HTMLElement
  line: SVGPathElement
  area: SVGPathElement
  dot: SVGCircleElement
}
let refs: PopRefs | null = null

// Adopted live game nodes remember exactly where they came from, so release() restores their
// original DOM position (not appended to the end — that would reorder the native panel on toggle-off).
interface Anchor {
  node: HTMLElement
  parent: HTMLElement
  next: Node | null
}
let anchors: Anchor[] = []

function span(id: string): string {
  return document.getElementById(id)?.textContent ?? ''
}

function adopt(node: HTMLElement | null, slot: Element): void {
  if (!node || !node.parentElement) return
  anchors.push({ node, parent: node.parentElement, next: node.nextSibling })
  slot.appendChild(node)
}

// Build ONCE. Text/figs are AT-native + mirrored from the game's own live spans; the breed bar
// (#trimpsBar's .progress wrapper) and the trap area (#trapArea) are game-driven, animated,
// interactive nodes ADOPTED into slots (ids intact) — the game keeps updating them and the Trap
// button keeps working, with zero re-implementation. release() moves them home.
export function buildPopulationTile(): HTMLElement {
  const tile = document.createElement('div')
  tile.className = 'at-rt at-pop'
  tile.id = 'atRT-population'
  tile.innerHTML =
    `<div class="at-rt-head"><span class="at-rt-name">Trimps</span></div>` +
    `<div class="at-rt-figs"><span class="at-rt-amt"><span class="at-pop-owned"></span><span class="at-pop-max at-rt-max"></span></span><span class="at-rt-rate"></span></div>` +
    `<svg class="at-rt-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
    `<path class="at-rt-area"/><path class="at-rt-line"/><circle class="at-rt-now" r="3"/></svg>` +
    `<div class="at-substats">` +
    `<div class="at-substat"><div class="k">Breeding</div><div class="v at-pop-breeding"></div></div>` +
    `<div class="at-substat"><div class="k">Employed</div><div class="v"><span class="at-pop-employed"></span>/<span class="at-pop-maxemp"></span></div></div>` +
    `</div>` +
    `<div class="at-pop-breedslot"></div>` +
    `<div class="at-pop-trapslot"></div>`

  anchors = []
  const breed = document.getElementById('trimpsBar')?.closest('.progress') as HTMLElement | null
  const trap = document.getElementById('trapArea')
  adopt(breed, tile.querySelector('.at-pop-breedslot')!)
  adopt(trap, tile.querySelector('.at-pop-trapslot')!)

  refs = {
    owned: tile.querySelector('.at-pop-owned')!,
    max: tile.querySelector('.at-pop-max')!,
    rate: tile.querySelector('.at-rt-rate')!,
    breeding: tile.querySelector('.at-pop-breeding')!,
    employed: tile.querySelector('.at-pop-employed')!,
    maxEmployed: tile.querySelector('.at-pop-maxemp')!,
    line: tile.querySelector('.at-rt-line')!,
    area: tile.querySelector('.at-rt-area')!,
    dot: tile.querySelector('.at-rt-now')!,
  }
  return tile
}

// Mirror the game's own live spans (drift-free) + redraw the population sparkline from the sampler.
// The adopted breed bar / trap area need no update here — the game drives them.
export function updatePopulationTile(): void {
  const x = refs
  if (!x) return
  x.owned.textContent = span('trimpsOwned')
  const m = span('trimpsMax')
  x.max.textContent = m ? ` / ${m}` : ''
  x.rate.textContent = span('trimpsPs')
  x.breeding.textContent = span('trimpsUnemployed')
  x.employed.textContent = span('trimpsEmployed')
  x.maxEmployed.textContent = span('maxEmployed')
  const p = sparkPath(history(POP))
  x.line.setAttribute('d', p.line)
  x.area.setAttribute('d', p.area)
  x.dot.setAttribute('cx', String(W))
  x.dot.setAttribute('cy', p.y.toFixed(1))
}

// Restore the adopted nodes to their exact original position (mandatory — they are real game
// controls; leaving them in a removed tile deletes the breed bar + Trap button from the game).
export function releaseAdopted(): void {
  for (const a of anchors) a.parent.insertBefore(a.node, a.next)
  anchors = []
  refs = null
}
