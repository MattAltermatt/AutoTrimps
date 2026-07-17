# Custom UI Phase 3 — Secondary Resources + Trimps Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Graduate Fragments/Gems/Helium and the Trimps population panel to AT-native tiles behind the existing `ATCustomUI` toggle, matching the shipped Phase-2 resource-tile look, and remove the now-redundant active-UI marker.

**Architecture:** Reuse Phase 2's machinery — the `REGIONS` registry, the idempotent per-region `syncRegion` sync loop, the 60-slot ring-buffer sampler, and build-once/mutate tiles that mirror the game's own live spans (drift-free). Flat secondary resources extend the resource-tile path directly; the richer Trimps panel gets its own hybrid module that mirrors text stats but *adopts* the game's live breed-bar and trap-area nodes (ids preserved, game keeps driving them).

**Tech Stack:** TypeScript, Vite/esbuild bundle, vitest (node + jsdom-per-file), Chrome DevTools MCP for live verification, the local Trimps clone served via `npm run serve`.

## Global Constraints

- `ATCustomUI` default **OFF ⇒ byte-identical** — no Phase 3 code path may run when off. The L0 `baseline-zero` net must stay green.
- **Mirror, never recompute** — display values come from the game's own live spans (`{r}Owned`, `trimpsPs`, …); never recompute a value the game already renders.
- **Never re-id or drop an adopted node** — the game resurrects a duplicate (Phase 1 Rule 3). Adopted nodes are *moved* with ids intact and *restored* on deactivate.
- **Accent colours pinned to the game's own resource colours** at build (mockup used placeholders).
- All gates checked by **exit code**, not grep (`npm run lint`/`typecheck`/`test:ci`/`build`).
- **Fresh-save unlock path is mandatory verification** — reset localStorage to zone 1, watch each resource + the population panel unlock live; a deep save hides unlock/reveal bugs.

---

### Task 1: Fragments / Gems / Helium as flat AT-native tiles

**Files:**
- Modify: `src/modules/custom-ui/tiles/sampler.ts`
- Modify: `src/modules/custom-ui/tiles/resource-tile.ts`
- Modify: `src/modules/custom-ui/tiles/resource-region.ts`
- Modify: `src/modules/custom-ui/regions.ts`
- Modify: `src/modules/custom-ui/shell.ts` (accent colours only)
- Test: `tests/nets/custom-ui-completeness.test.ts`

**Interfaces:**
- Consumes: `buildTile(r)`, `updateTile(r)`, `history(r)`, `RESOURCES`, `syncRegion()`, `REGIONS`.
- Produces: three new resources flow through the existing `resources` region — no new exported symbols.

- [ ] **Step 1: Extend the completeness net (failing test first)**

In `tests/nets/custom-ui-completeness.test.ts`, change the resource-region assertion to expect the full set:

```ts
  it('the resource region (at-native) claims all 7 flat resources, all real containers', () => {
    const region = REGIONS.find((r) => r.id === 'resources')!
    expect(region.status).toBe('at-native')
    expect(region.natives).toEqual(['food', 'wood', 'metal', 'science', 'fragments', 'gems', 'helium'])
    const html = readFileSync(resolve(process.cwd(), '.trimps-game/index.html'), 'utf8')
    for (const id of region.natives!) expect(html).toMatch(new RegExp(`id=["']${id}["']`))
  })
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run tests/nets/custom-ui-completeness.test.ts`
Expected: FAIL — `natives` is still `['food','wood','metal','science']`.

- [ ] **Step 3: Register the new natives**

In `src/modules/custom-ui/regions.ts`, extend the resources region:

```ts
  { id: 'resources', containerId: 'resourceColumn', status: 'at-native', natives: ['food', 'wood', 'metal', 'science', 'fragments', 'gems', 'helium'] },
```

- [ ] **Step 4: Add the three names to the sampler**

In `src/modules/custom-ui/tiles/sampler.ts`, extend `RESOURCES`:

```ts
export const RESOURCES = ['food', 'wood', 'metal', 'science', 'fragments', 'gems', 'helium'] as const
```

(The sampler already reads `game.resources[r].owned`; all three exist there.)

- [ ] **Step 5: Teach resource-tile the new labels, the helium rate span, and the no-VERB case**

In `src/modules/custom-ui/tiles/resource-tile.ts`:

```ts
const LABEL: Record<string, string> = { food: 'Food', wood: 'Wood', metal: 'Metal', science: 'Science', fragments: 'Fragments', gems: 'Gems', helium: 'Helium' }
// VERB only exists for the four hand-gathered resources; fragments/gems/helium have no gather verb.
const VERB: Record<string, string> = { food: 'Gathering', wood: 'Chopping', metal: 'Mining', science: 'Researching' }
```

Guard the badge build so a missing VERB renders empty (the badge stays hidden via `data-on="0"` anyway, since `playerGathering` is never one of these):

```ts
    `<div class="at-rt-head"><span class="at-rt-name">${LABEL[r]}</span><span class="at-rt-auto" data-on="0">${VERB[r] ?? ''}</span></div>` +
```

In `updateTile`, source the rate span per-resource (helium uses `heliumPh`, a `/hr` string):

```ts
  x.rate.textContent = txt(r === 'helium' ? 'heliumPh' : `${r}Ps`)
```

(The `{r}Max` mirror already renders nothing when the span is absent — fragments/gems/helium have no max, so they show owned-only. No change needed there.)

- [ ] **Step 6: Generalize the unlock check for helium (`display:none`, not `visibility:hidden`)**

In `src/modules/custom-ui/tiles/resource-region.ts`, replace `isUnlocked`:

```ts
// Native resource blocks hide until unlocked — fragments/gems via visibility:hidden, helium via
// display:none. Unlocked = neither hidden mechanism is active.
function isUnlocked(native: HTMLElement): boolean {
  return native.style.visibility !== 'hidden' && native.style.display !== 'none'
}
```

- [ ] **Step 7: Add the three accent colours (pinned to game colours)**

In `src/modules/custom-ui/shell.ts`, add to the `.at-rt-food{…}` colour line. Read the game's real resource colours from the clone (`grep -i 'fragments\|gems\|helium' .trimps-game/css/*.css` — look for the `.thing`/`ownedText` colour on each). Use those hexes; if a resource has no distinct game colour, keep the mockup placeholder:

```ts
    '.at-rt-fragments{--c:#57c9c1}.at-rt-gems{--c:#b57ae0}.at-rt-helium{--c:#e8697f}',
```

- [ ] **Step 8: Build + run the net + baseline-zero**

Run: `npm run build && npx vitest run tests/nets/custom-ui-completeness.test.ts tests/sim/baseline-zero`
Expected: PASS — net green (natives match + real ids), baseline-zero green (OFF unchanged).

- [ ] **Step 9: Commit**

```bash
git add src/modules/custom-ui tests/nets/custom-ui-completeness.test.ts
git commit -m "feat(#41): graduate Fragments/Gems/Helium to AT-native tiles"
```

---

### Task 2: Trimps population tile — build, mirror, adopt

**Files:**
- Create: `src/modules/custom-ui/tiles/population-tile.ts`
- Create: `src/modules/custom-ui/tiles/population-region.ts`
- Modify: `src/modules/custom-ui/tiles/sampler.ts` (add `'trimps'` sample)
- Modify: `src/modules/custom-ui/regions.ts`
- Modify: `src/modules/custom-ui/boot.ts`
- Test: `tests/nets/custom-ui-completeness.test.ts`

**Interfaces:**
- Consumes: `history('trimps')`, `sampleTick()`, the `at-rt-hidden` class, Phase-1 adopt semantics.
- Produces:
  - `buildPopulationTile(): HTMLElement`
  - `updatePopulationTile(): void`
  - `syncPopulationRegion(): void`
  - `deactivatePopulationRegion(): void`

- [ ] **Step 1: Extend the completeness net for the population region (failing test first)**

Add to `tests/nets/custom-ui-completeness.test.ts`:

```ts
  it('the population region (at-native) claims #trimps, a real container', () => {
    const region = REGIONS.find((r) => r.id === 'population')!
    expect(region.status).toBe('at-native')
    expect(region.natives).toEqual(['trimps'])
    const html = readFileSync(resolve(process.cwd(), '.trimps-game/index.html'), 'utf8')
    expect(html).toMatch(/id=["']trimps["']/)
  })
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run tests/nets/custom-ui-completeness.test.ts`
Expected: FAIL — no `population` region yet (`region` is undefined).

- [ ] **Step 3: Register the population region**

In `src/modules/custom-ui/regions.ts`, append:

```ts
  { id: 'population', containerId: 'trimpsColumn', status: 'at-native', natives: ['trimps'] },
```

- [ ] **Step 4: Sample population**

In `src/modules/custom-ui/tiles/sampler.ts`, add `'trimps'` to the sampled set. Keep `RESOURCES` (the flat-resource list) as-is for the resource region; add a separate constant the population sampler uses, and sample it in `sampleTick`:

```ts
export const POP = 'trimps'
```
and inside `sampleTick`, after the `RESOURCES` loop:
```ts
  const pop = Number(res[POP]?.owned ?? 0)
  const pb = (buffers[POP] ??= [])
  pb.push(pop)
  if (pb.length > CAP) pb.shift()
```
Also seed it in `resetSampler`: `buffers[POP] = []`.

- [ ] **Step 5: Write the population tile (build-once + mirror + adopt)**

Create `src/modules/custom-ui/tiles/population-tile.ts`:

```ts
import { history } from './sampler'
import { sparkPathPublic } from './resource-tile' // export sparkPath from resource-tile in this step

const W = 240
const H = 40

interface PopRefs {
  owned: HTMLElement; max: HTMLElement; rate: HTMLElement
  breeding: HTMLElement; employed: HTMLElement; maxEmployed: HTMLElement
  line: SVGPathElement; area: SVGPathElement; dot: SVGCircleElement
}
let refs: PopRefs | null = null

function span(id: string): string { return document.getElementById(id)?.textContent ?? '' }

// Build ONCE. Text/figs are AT-native + mirrored; the breed bar (#trimpsBar) and trap area
// (#trapArea) are game-driven live nodes ADOPTED into slots (ids intact) — the game keeps updating
// them, and the Trap button keeps working, with zero re-implementation.
export function buildPopulationTile(): HTMLElement {
  const tile = document.createElement('div')
  tile.className = 'at-rt at-pop'
  tile.id = 'atRT-population'
  tile.innerHTML =
    `<div class="at-rt-head"><span class="at-rt-name">Trimps</span></div>` +
    `<div class="at-rt-figs"><span class="at-rt-amt"><span class="at-pop-owned"></span><span class="at-pop-max at-rt-max"></span></span><span class="at-rt-rate"></span></div>` +
    `<svg class="at-rt-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path class="at-rt-area"/><path class="at-rt-line"/><circle class="at-rt-now" r="3"/></svg>` +
    `<div class="at-pop-breedslot"></div>` +
    `<div class="at-substats"><div class="at-substat"><div class="k">Breeding</div><div class="v at-pop-breeding"></div></div>` +
    `<div class="at-substat"><div class="k">Employed</div><div class="v"><span class="at-pop-employed"></span>/<span class="at-pop-maxemp"></span></div></div></div>` +
    `<div class="at-pop-trapslot"></div>`
  // Adopt the live game nodes into their slots (ids preserved).
  const breed = document.getElementById('trimpsBar')?.closest('.progress') as HTMLElement | null
  const trap = document.getElementById('trapArea')
  if (breed) tile.querySelector('.at-pop-breedslot')!.appendChild(breed)
  if (trap) tile.querySelector('.at-pop-trapslot')!.appendChild(trap)
  refs = {
    owned: tile.querySelector('.at-pop-owned')!, max: tile.querySelector('.at-pop-max')!,
    rate: tile.querySelector('.at-rt-rate')!, breeding: tile.querySelector('.at-pop-breeding')!,
    employed: tile.querySelector('.at-pop-employed')!, maxEmployed: tile.querySelector('.at-pop-maxemp')!,
    line: tile.querySelector('.at-rt-line')!, area: tile.querySelector('.at-rt-area')!, dot: tile.querySelector('.at-rt-now')!,
  }
  return tile
}

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
  const p = sparkPathPublic(history('trimps'))
  x.line.setAttribute('d', p.line); x.area.setAttribute('d', p.area)
  x.dot.setAttribute('cx', String(W)); x.dot.setAttribute('cy', p.y.toFixed(1))
}

// Restore the adopted nodes back into #trimps (mandatory — they are real game controls).
export function releaseAdopted(): void {
  const trimps = document.getElementById('trimps')
  if (!trimps) return
  const breed = document.getElementById('trimpsBar')?.closest('.progress')
  const trap = document.getElementById('trapArea')
  // Re-append in native order: breed bar, then unemp/emp blocks stay in #trimps, then trap area.
  if (breed) trimps.appendChild(breed)
  if (trap) trimps.appendChild(trap)
  refs = null
}
```

In `resource-tile.ts`, export the existing `sparkPath` as `sparkPathPublic` (or export `sparkPath` directly) so the population tile reuses the identical curve math — do not duplicate it (DRY).

- [ ] **Step 6: Write the population region sync (idempotent, restores on re-lock)**

Create `src/modules/custom-ui/tiles/population-region.ts`:

```ts
import { buildPopulationTile, updatePopulationTile, releaseAdopted } from './population-tile'

const HIDDEN_CLASS = 'at-rt-hidden'
let mounted = false

function isUnlocked(el: HTMLElement): boolean {
  return el.style.visibility !== 'hidden' && el.style.display !== 'none'
}

// Idempotent: mount on unlock, unmount + restore adopted nodes on portal re-lock. Hide the native
// #trimps via the !important class every tick so the game's reveal animation can't un-hide it.
export function syncPopulationRegion(): void {
  const col = document.getElementById('trimpsColumn')
  const native = document.getElementById('trimps')
  if (!col || !native || !native.parentElement) return
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
  if (mounted) { releaseAdopted(); document.getElementById('atRT-population')?.remove(); mounted = false }
  document.getElementById('trimps')?.classList.remove(HIDDEN_CLASS)
}
```

Note: `#trimps` ships `visibility:hidden`; adopting `#trimpsBar`/`#trapArea` out of a hidden parent is fine (they render inside our visible tile).

- [ ] **Step 7: Wire it into boot alongside the resource region**

In `src/modules/custom-ui/boot.ts`, import the new sync/deactivate and call them from `startTiles`/`stopTiles`. The existing 200ms `refreshTimer` calls `syncRegion`; make it also call `syncPopulationRegion`:

```ts
import { syncPopulationRegion, deactivatePopulationRegion } from './tiles/population-region'
```
In `startTiles`, after `syncRegion()`:
```ts
  syncPopulationRegion()
```
Change the refresh interval to run both:
```ts
  if (refreshTimer === null) refreshTimer = setInterval(() => { syncRegion(); syncPopulationRegion() }, 200)
```
In `stopTiles`, after `deactivateRegion()`:
```ts
  deactivatePopulationRegion()
```

- [ ] **Step 8: Build + nets**

Run: `npm run build && npx vitest run tests/nets/custom-ui-completeness.test.ts tests/sim/baseline-zero`
Expected: PASS — population region registered + real id; baseline-zero unchanged (OFF).

- [ ] **Step 9: Commit**

```bash
git add src/modules/custom-ui tests/nets/custom-ui-completeness.test.ts
git commit -m "feat(#41): AT-native Trimps population tile (mirror + adopt live nodes)"
```

---

### Task 3: Panel CSS, matched-height row, breed-label fix

**Files:**
- Modify: `src/modules/custom-ui/shell.ts` (CSS block in `injectMarkerStyles`)

**Interfaces:**
- Consumes: the `.at-rt`/`.at-pop`/`.at-substats` class names emitted by Tasks 1–2.
- Produces: no new symbols — pure styling.

- [ ] **Step 1: Make the flat card grow, add population + pill + slot styles**

In `shell.ts`, add to the injected CSS array (adapt from the approved mockup `phase3-mockup.html` — the exact rules there):

```ts
    // Phase 3: cards flex-grow their sparkline so shorter tiles fill matched-height columns.
    '.at-rt{display:flex;flex-direction:column}',
    '.at-rt-spark{flex:1 1 auto;min-height:40px}',
    // population panel
    '.at-pop .at-rt-name{font-size:16px}',
    '.at-pop .at-rt-spark{min-height:52px}',
    '.at-substats{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:2px 12px 4px}',
    '.at-substat{background:#2a2f38;border:1px solid #363d48;border-radius:6px;padding:6px 8px}',
    '.at-substat .k{font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:#7b8697}',
    '.at-substat .v{font-family:ui-monospace,Menlo,monospace;font-size:13px;font-weight:600;color:#eef2f7;margin-top:1px}',
    '.at-pop-breedslot,.at-pop-trapslot{padding:0 12px}',
    '.at-pop{--c:#e0b24a}',
```

- [ ] **Step 2: Match the three top-row blocks to one height**

The three blocks live in sibling bootstrap columns (`#resourceColumn`, `#miscColumn`, `#trimpsColumn`). Make each column a flex-column so its tiles fill it, and (scoped to our shell) make the containing row stretch its columns to equal height:

```ts
    '#atWrapper #miscColumn{display:flex;flex-direction:column;gap:8px}',
    '#atWrapper #miscColumn .at-rt{flex:1 1 0}',
```

Whether `#resourceColumn`/`#trimpsColumn` already stretch depends on the game row being flex — **this is a Chrome-verify-and-adjust step** (Step 4). Success = the resource grid, the Fragments/Gems/Helium column, and the Trimps panel visually share one height, with the shorter tiles expanded (not gapped).

- [ ] **Step 3: Fix the breed-bar label collision + build**

Ensure the adopted `#trimpsTimeToFill` text does not sit under the fill — the game already centers it in `#trimpsBar`; if it collides visually, add `#atWrapper #trimpsTimeToFill{position:relative;z-index:1;text-shadow:0 1px 2px rgba(0,0,0,.6)}`.

Run: `npm run build`
Expected: build succeeds, bundle emitted.

- [ ] **Step 4: Chrome verify + tune the matched height (deep save)**

Start the dev server and open the clone; toggle `ATCustomUI` on:

```bash
npm run serve   # background; serves http://localhost:8080 with the dev bundle injected
```

Drive Chrome to `http://localhost:8080/`, enable `ATCustomUI`, and eyeball: the three top-row blocks match height; secondary tiles expanded; population panel reads like the mockup. Adjust the Step-2 CSS (add `#atWrapper .row{align-items:stretch}` or a column `min-height` shim) until it matches, rebuilding between tweaks. When correct:

- [ ] **Step 5: Commit**

```bash
git add src/modules/custom-ui/shell.ts
git commit -m "feat(#41): matched-height row + population panel styling"
```

---

### Task 4: Remove the active-UI marker

**Files:**
- Modify: `src/modules/custom-ui/shell.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ensureShell` no longer appends the badge; the outline rule is gone.

- [ ] **Step 1: Drop the badge from `ensureShell`**

In `shell.ts` `ensureShell()`, delete the badge creation/append:

```ts
  // (removed) const badge = ... shell.appendChild(badge)
```

- [ ] **Step 2: Drop the marker CSS**

Remove the `#${SHELL_ID}.${MARKER_CLASS} { outline… }` rule and the `.at-ui-badge{…}` block from `injectMarkerStyles`. Keep `MARKER_CLASS` on the shell as a plain identity hook (no visual rule).

- [ ] **Step 3: Build + baseline-zero**

Run: `npm run build && npx vitest run tests/sim/baseline-zero`
Expected: PASS (OFF path untouched — the shell only exists when ON).

- [ ] **Step 4: Commit**

```bash
git add src/modules/custom-ui/shell.ts
git commit -m "feat(#41): drop the AutoTrimps UI marker (restyle is self-evident)"
```

---

### Task 5: Full verification — gates + fresh-save + portal round-trip

**Files:** none (verification only).

- [ ] **Step 1: All gates by exit code**

```bash
npm run lint  >/tmp/l 2>&1; echo "lint=$?"
npm run typecheck >/tmp/t 2>&1; echo "tsc=$?"
npm run test:ci  >/tmp/c 2>&1; echo "test=$?"
npm run build  >/tmp/b 2>&1; echo "build=$?"
```
Expected: every `=0`. If any non-zero, read the log file and fix before proceeding.

- [ ] **Step 2: Chrome — fresh-save unlock sequence (mandatory)**

Back up `trimpSave1`, clear localStorage to zone 1, reload with `ATCustomUI` on. Watch Fragments, Gems, Helium, and the Trimps panel unlock live. Assert for each: exactly one tile appears (no duplicate native panel), and the native block's inline `display`/`visibility` on reveal does not un-hide it (the Phase-2 `!important` class holds). Restore the backup after.

- [ ] **Step 3: Chrome — deep save, Trap button, portal round-trip**

On a deep save: confirm the population sparkline ticks, breed bar animates, breeding/employed pills update, and the **Trap button works** — click it in the AT tile and assert `game.global.playerGathering` / the trap state changed (adopted node, real handler). Then trigger/observe a portal reset (or force `#trimps` re-lock) and confirm the adopted breed-bar + trap-area are restored to `#trimps`, with no orphaned or duplicated game controls, and the tile cleanly re-mounts after.

- [ ] **Step 4: Confirm marker gone + OFF byte-identical**

Toggle `ATCustomUI` off → the HUD returns to native with no leftover tiles/adopted-node displacement; toggle on → tiles return. Confirm no green outline / "AutoTrimps UI" badge in the on state.

- [ ] **Step 5: Request code review**

Dispatch a fresh reviewer (`feature-dev:code-reviewer`) over the branch diff — focus on the adopt/restore lifecycle (no lost game controls), the OFF byte-identity, and net honesty. Address findings, then FF-merge per the standard cadence.

---

## Self-Review

**Spec coverage:** Secondary resources (Task 1) ✓; population tile mirror+adopt (Task 2) ✓; matched-height + Variant A styling (Task 3) ✓; marker removal (Task 4) ✓; completeness net updates (Tasks 1–2) ✓; fresh-save + portal + Trap-button verification (Task 5) ✓; helium `display:none` unlock + `heliumPh` rate + no-max (Task 1) ✓; accent colours pinned to game (Task 1 Step 7) ✓; OFF byte-identical (baseline-zero in every task) ✓; clock chip — deferred as non-load-bearing per spec, resolve during Task 2/3 Chrome pass if it renders (noted, not a blocker).

**Placeholder scan:** No TBD/TODO. Layout tuning (Task 3 Step 4) is an explicit Chrome-iterate step with a concrete success criterion, not a vague "make it look good."

**Type consistency:** `sparkPathPublic` exported from `resource-tile.ts` (Task 2 Step 5) and consumed there; `buildPopulationTile`/`updatePopulationTile`/`releaseAdopted` defined in `population-tile.ts` and consumed by `population-region.ts`; `syncPopulationRegion`/`deactivatePopulationRegion` defined in `population-region.ts` and consumed by `boot.ts`. Names align across tasks.
