# Custom UI — Phase 2: Resource Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Graduate the Food/Wood/Metal/Science tiles to AutoTrimps-native layout B (rolling 60s chart, AUTO signal, no buttons) behind the existing `ATCustomUI` toggle — the first region graduation.

**Architecture:** `src/modules/custom-ui/tiles/` — `sampler.ts` (60-slot ring buffer from `game.resources[r].owned`), `resource-tile.ts` (build-once/mutate layout-B DOM, mirrors the game's `#{res}Owned/Max/Ps` spans + draws the sparkline), `resource-region.ts` (hide natives / mount tiles / restore). Wired into `applyCustomUI`.

**Tech Stack:** TS + Vite, vitest (node + jsdom), pinned `.trimps-game/` clone, Chrome verify.

## Global Constraints

- **OFF = byte-identical.** Region/sampler/refresh inert unless `ATCustomUI` on. `baseline-zero` neutral.
- **Rule 1** container granularity; **Rule 2** no positioned/transformed ancestor (tiles inside static `#atWrapper`); **Rule 3** natives are **hidden (display:none), never removed/re-id'd**.
- **Mirror the game's spans; never recompute** owned/max/rate. Sample raw `game.resources[r].owned` for the chart only.
- **Never per-tick `innerHTML`** on the tile (replaceChildren+click gotcha) — build once, mutate `textContent`/attributes.
- Completeness net reads **pinned `.trimps-game/`** via `resolve(process.cwd(), ...)`, never `../trimps-game`.
- Gates by **exit code**. Branch `feature/custom-ui-resource-tiles`. Commit each task.
- `RESOURCES = ['food','wood','metal','science'] as const`. Native block id = the resource key (`#food`…). Spans: `#{res}Owned`, `#{res}Max`, `#{res}Ps`. Science has no max.

---

### Task 1: `sampler.ts` — ring buffer

**Files:** Create `src/modules/custom-ui/tiles/sampler.ts`; Test `tests/custom-ui/sampler.test.ts`

**Interfaces:** Produces `RESOURCES`; `sampleTick(): void` (push each resource's owned, cap 60); `history(r: string): number[]`; `resetSampler(): void`. Reads `game.resources[r].owned`.

- [ ] **Step 1 — failing test**
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { sampleTick, history, resetSampler, RESOURCES } from '../../src/modules/custom-ui/tiles/sampler'
describe('sampler ring buffer', () => {
  beforeEach(() => { resetSampler(); (globalThis as any).game = { resources: { food:{owned:1}, wood:{owned:2}, metal:{owned:3}, science:{owned:4} } } })
  it('samples all four resources', () => { sampleTick(); expect(RESOURCES.every(r => history(r).length === 1)).toBe(true); expect(history('wood')[0]).toBe(2) })
  it('caps at 60 (drops oldest)', () => { for (let i=0;i<70;i++){ (globalThis as any).game.resources.food.owned=i; sampleTick() } const h=history('food'); expect(h.length).toBe(60); expect(h[h.length-1]).toBe(69); expect(h[0]).toBe(10) })
})
```
- [ ] **Step 2 — run, expect fail** `npx vitest run tests/custom-ui/sampler.test.ts`
- [ ] **Step 3 — implement**
```ts
// src/modules/custom-ui/tiles/sampler.ts
export const RESOURCES = ['food', 'wood', 'metal', 'science'] as const
const CAP = 60
const buffers: Record<string, number[]> = {}
export function resetSampler(): void { for (const r of RESOURCES) buffers[r] = [] }
resetSampler()
export function sampleTick(): void {
  const res = (globalThis as any).game?.resources
  if (!res) return
  for (const r of RESOURCES) {
    const owned = Number(res[r]?.owned ?? 0)
    const b = buffers[r]; b.push(owned); if (b.length > CAP) b.shift()
  }
}
export function history(r: string): number[] { return buffers[r] ?? [] }
```
- [ ] **Step 4 — pass** `npx vitest run tests/custom-ui/sampler.test.ts`
- [ ] **Step 5 — commit** `feat(#41): resource sampler ring buffer (Phase 2)`

---

### Task 2: `resource-tile.ts` — build + update one layout-B tile

**Files:** Create `src/modules/custom-ui/tiles/resource-tile.ts`; Test `tests/custom-ui/resource-tile.test.ts` (jsdom)

**Interfaces:** Consumes `history` (Task 1). Produces `buildTile(r: string): HTMLElement` (creates the tile, cached child refs); `updateTile(r: string): void` (mirrors spans + AUTO + sparkline); internal `sparkPath(arr,w,h)`. Reads `getPageSetting('ManualGather2')` + game spans.

- [ ] **Step 1 — failing test (jsdom)**
```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildTile, updateTile } from '../../src/modules/custom-ui/tiles/resource-tile'
import { sampleTick, resetSampler } from '../../src/modules/custom-ui/tiles/sampler'
function nativeSpans() { document.body.innerHTML = `<span id="woodOwned">3.80e9</span><span id="woodMax">9.23e9</span><span id="woodPs">+1.90e7/sec</span>` }
describe('resource tile', () => {
  beforeEach(() => { resetSampler(); nativeSpans(); (globalThis as any).game = { resources: { food:{owned:1},wood:{owned:5},metal:{owned:1},science:{owned:1} } }; (globalThis as any).getPageSetting = () => 1 })
  it('builds a tile with name + no buttons', () => { const t = buildTile('wood'); expect(t.querySelector('.at-rt-name')!.textContent).toBe('Wood'); expect(t.querySelector('button')).toBeNull() })
  it('mirrors owned/max/rate from the game spans', () => { const t = buildTile('wood'); document.body.appendChild(t); updateTile('wood'); expect(t.querySelector('.at-rt-owned')!.textContent).toBe('3.80e9'); expect(t.querySelector('.at-rt-max')!.textContent).toContain('9.23e9'); expect(t.querySelector('.at-rt-rate')!.textContent).toBe('+1.90e7/sec') })
  it('shows AUTO when ManualGather2 >= 1', () => { const t = buildTile('wood'); document.body.appendChild(t); updateTile('wood'); expect(t.querySelector('.at-rt-auto')!.getAttribute('data-on')).toBe('1') })
  it('draws a sparkline path once sampled', () => { sampleTick(); sampleTick(); const t = buildTile('wood'); document.body.appendChild(t); updateTile('wood'); expect(t.querySelector('path.at-rt-line')!.getAttribute('d')!.length).toBeGreaterThan(0) })
})
```
- [ ] **Step 2 — run, expect fail**
- [ ] **Step 3 — implement** (build-once, cache child refs, mutate in update; mirror spans by id; sparkline from `history`). Key body:
```ts
// src/modules/custom-ui/tiles/resource-tile.ts
import { history } from './sampler'
const LABEL: Record<string,string> = { food:'Food', wood:'Wood', metal:'Metal', science:'Science' }
const refs: Record<string, { owned:HTMLElement; max:HTMLElement; rate:HTMLElement; auto:HTMLElement; line:SVGPathElement; area:SVGPathElement; dot:SVGCircleElement } > = {}
const W = 240, H = 40
export function buildTile(r: string): HTMLElement {
  const tile = document.createElement('div'); tile.className = `at-rt at-rt-${r}`; tile.id = `atRT-${r}`
  tile.innerHTML =
    `<div class="at-rt-head"><span class="at-rt-name">${LABEL[r]}</span><span class="at-rt-auto" data-on="0">Auto</span></div>` +
    `<div class="at-rt-figs"><span class="at-rt-amt"><span class="at-rt-owned"></span><span class="at-rt-max"></span></span><span class="at-rt-rate"></span></div>` +
    `<svg class="at-rt-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path class="at-rt-area"/><path class="at-rt-line"/><circle class="at-rt-now" r="3"/></svg>`
  refs[r] = { owned: tile.querySelector('.at-rt-owned')!, max: tile.querySelector('.at-rt-max')!, rate: tile.querySelector('.at-rt-rate')!, auto: tile.querySelector('.at-rt-auto')!, line: tile.querySelector('.at-rt-line')!, area: tile.querySelector('.at-rt-area')!, dot: tile.querySelector('.at-rt-now')! }
  return tile
}
function txt(id: string): string { return document.getElementById(id)?.textContent ?? '' }
function sparkPath(arr: number[]): { line:string; area:string; y:number } {
  if (arr.length < 2) return { line:'', area:'', y:H-4 }
  const min = Math.min(...arr), max = Math.max(...arr), span = max-min || 1, step = W/(arr.length-1)
  const ys = arr.map(v => H-4 - ((v-min)/span)*(H-8))
  const line = arr.map((_,i)=>`${i?'L':'M'}${(i*step).toFixed(1)} ${ys[i].toFixed(1)}`).join(' ')
  const area = `M0 ${H} ` + arr.map((_,i)=>`L${(i*step).toFixed(1)} ${ys[i].toFixed(1)}`).join(' ') + ` L${W} ${H} Z`
  return { line, area, y: ys[ys.length-1] }
}
export function updateTile(r: string): void {
  const x = refs[r]; if (!x) return
  x.owned.textContent = txt(`${r}Owned`)
  const maxTxt = txt(`${r}Max`); x.max.textContent = maxTxt ? ` / ${maxTxt}` : ''
  x.rate.textContent = txt(`${r}Ps`)
  const g = (globalThis as any).getPageSetting
  const mode = typeof g === 'function' ? Number(g('ManualGather2')) : 0
  const on = mode >= 1 && !(r === 'science' && mode === 3)
  x.auto.setAttribute('data-on', on ? '1' : '0'); x.auto.textContent = on ? 'Auto' : 'Manual'
  const p = sparkPath(history(r))
  x.line.setAttribute('d', p.line); x.area.setAttribute('d', p.area)
  x.dot.setAttribute('cx', String(W)); x.dot.setAttribute('cy', p.y.toFixed(1))
}
```
- [ ] **Step 4 — pass**
- [ ] **Step 5 — commit** `feat(#41): layout-B resource tile renderer (Phase 2)`

---

### Task 3: `resource-region.ts` — graduate (hide natives, mount tiles, restore)

**Files:** Create `src/modules/custom-ui/tiles/resource-region.ts`; Test `tests/custom-ui/resource-region.test.ts` (jsdom)

**Interfaces:** Consumes `buildTile/updateTile` (T2), `sampleTick` (T1), `RESOURCES`. Produces `activateRegion(): void` (hide unlocked natives, mount tiles into `#resourceColumn`), `deactivateRegion(): void` (remove tiles, unhide), `refreshTiles(): void` (updateTile all mounted). Rule 3: hide via `display:none`, ids preserved.

- [ ] **Step 1 — failing test (jsdom)** — fixture with `#resourceColumn` containing native `#food` (visible) + `#wood` (`visibility:hidden`). Assert activate: `#food` hidden + `#atRT-food` mounted; `#wood` locked ⇒ no `#atRT-wood`. Deactivate: `#food` restored (`display` back), tiles gone. Idempotent.
- [ ] **Step 2 — run, expect fail**
- [ ] **Step 3 — implement**
```ts
// src/modules/custom-ui/tiles/resource-region.ts
import { RESOURCES, sampleTick } from './sampler'
import { buildTile, updateTile } from './resource-tile'
const mounted: string[] = []
const priorDisplay: Record<string,string> = {}
function isUnlocked(native: HTMLElement): boolean { return native.style.visibility !== 'hidden' }
export function activateRegion(): void {
  if (mounted.length) return
  const col = document.getElementById('resourceColumn'); if (!col) return
  for (const r of RESOURCES) {
    const native = document.getElementById(r); if (!native) continue
    if (!isUnlocked(native)) continue
    priorDisplay[r] = native.style.display
    native.style.display = 'none'          // Rule 3: hidden, id preserved
    const tile = buildTile(r); tile.classList.add('at-rt-mounted')
    native.parentElement!.insertBefore(tile, native)
    mounted.push(r)
  }
  refreshTiles()
}
export function deactivateRegion(): void {
  for (const r of mounted) {
    document.getElementById(`atRT-${r}`)?.remove()
    const native = document.getElementById(r); if (native) native.style.display = priorDisplay[r] ?? ''
  }
  mounted.length = 0
}
export function refreshTiles(): void { for (const r of mounted) updateTile(r) }
export { sampleTick }
```
- [ ] **Step 4 — pass**
- [ ] **Step 5 — commit** `feat(#41): resource-region graduation — hide natives, mount tiles (Phase 2)`

---

### Task 4: wire into `applyCustomUI` + regions registry + completeness net

**Files:** Modify `src/modules/custom-ui/boot.ts`, `src/modules/custom-ui/regions.ts`, `tests/nets/custom-ui-completeness.test.ts`; Test `tests/custom-ui/boot.test.ts` (extend)

- [ ] **Step 1 — regions.ts:** add `{ id:'resources', containerId:'resourceColumn', status:'at-native', natives:['food','wood','metal','science'] }` (extend `Region` with optional `natives?: string[]`).
- [ ] **Step 2 — boot.ts:** in `applyCustomUI(true)` after `showShell()` call `activateRegion()` + start two timers: `setInterval(sampleTick,1000)` and `setInterval(refreshTiles, 200)` (store ids on `customUIState`); in `applyCustomUI(false)` clear both timers + `deactivateRegion()`. Guard: timers only when active. (Import from `./tiles/resource-region`.)
- [ ] **Step 3 — completeness net:** assert the resources region registers all four natives:
```ts
it('the resource region claims food/wood/metal/science', () => {
  const region = REGIONS.find(r => r.id === 'resources')!
  expect(region.status).toBe('at-native')
  expect(region.natives).toEqual(['food','wood','metal','science'])
})
```
- [ ] **Step 4 — boot.test.ts:** extend the "on" test — after `bootCustomUI()` with a `#resourceColumn`+native `#food` fixture and `getPageSetting`→true, assert `#atRT-food` mounted; OFF path still mounts nothing. Mutation-check the net (drop a native, expect red).
- [ ] **Step 5 — run** `npx vitest run tests/custom-ui/ tests/nets/custom-ui-completeness.test.ts` + `npm run typecheck` + regen golden (`--reason "#41 Phase 2: resource-tile graduation changes the bundle"`).
- [ ] **Step 6 — commit** `feat(#41): wire resource-region into applyCustomUI + registry + net (Phase 2)`

---

### Task 5: gates + Chrome verify + review + FF-merge

- [ ] **Step 1 — CSS:** add layout-B tile styles to `shell.ts`'s injected stylesheet (`.at-rt` card, `.at-rt-auto[data-on="1"]` green badge / `="0"` muted, `.at-rt-spark` area+line coloured per `.at-rt-food/wood/metal/science`, no button styles). Match the mockup B.
- [ ] **Step 2 — gates by exit code:** `lint`, `typecheck`, `test:ci` (**baseline-zero must be green**), `build`.
- [ ] **Step 3 — Chrome verify** (`npm run build && npm run serve`, localhost:8080): toggle `ATCustomUI` on → 4 layout-B tiles in the resource column; `evaluate_script` asserts `#atRT-wood .at-rt-owned` text === `#woodOwned` text (mirror correct); charts roll (sample twice, path changes); AUTO badge reflects ManualGather2; no `<button>` in tiles; time bar gone; toggle off → `#food` visible again, `#atRT-*` gone, no dup ids; unlock: confirm a locked resource shows no tile then appears on unlock. Screenshot.
- [ ] **Step 4 — review:** fresh `feature-dev:code-reviewer` on `git diff main...HEAD` (focus: OFF no-op, timer leaks on repeat toggle, Rule 3 hidden-not-removed, mirror correctness, unlock handling).
- [ ] **Step 5 — user-verify**, then squash + FF-merge + delete branch + push; confirm deploy green.

---

## Self-Review

- Spec §2 mirror-not-recompute → T2 `updateTile` reads spans. ✓
- §3 sampler/tile/region/wiring → T1/T2/T3/T4. ✓
- §4 AUTO signal (ManualGather2) → T2. ✓ · §5 rolling chart right-edge=now → T2 `sparkPath`+dot at x=W. ✓
- §6 OFF byte-identical → T4 timers+region only when active; §7 baseline-zero → T5. ✓
- Rules 1/2/3 → T3 hide-not-remove, tiles in static shell, whole-block. ✓
- Completeness net extended + mutation-checked → T4. ✓
- **Placeholder scan:** T5 Chrome steps reference the running dev server (a real action, not a placeholder); all code steps carry code. ✓
- **Type consistency:** `activateRegion/deactivateRegion/refreshTiles`, `buildTile/updateTile`, `sampleTick/history/RESOURCES`, `#atRT-${r}` ids consistent across tasks. ✓
- **Empirical risk (settle in T5 Chrome):** exact mount point inside `#resourceColumn` (native `#food` sits in a `.col-xs-6.maxH` cell) — insert the tile before the native in its own parent; if the Bootstrap grid cell fights the layout, mount into the cell and hide only the native, adjusting in Chrome.
