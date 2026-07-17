# Custom UI — Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an opt-in toggle that swaps the stock Trimps HUD for an AutoTrimps-owned shell that *adopts* the game's own HUD (`#wrapper`) intact — visually identical plus one obvious marker — establishing the permanent adopt-and-skin seam for #41.

**Architecture:** A new `src/modules/custom-ui/` directory module. A body-sibling `#atWrapper` shell adopts the game's `#wrapper` (the entire HUD, one node) by `appendChild` at container granularity — ids preserved, so the game's per-tick `getElementById` updates keep landing. Default OFF is a pure no-op (byte-identical). A completeness audit net makes "a game region is missing from our UI" a failing CI test.

**Tech Stack:** TypeScript + Vite, vitest (node default, jsdom per-file via docblock), the game clone at `../trimps-game` (v5.10.1), esbuild userscript bundle.

## Global Constraints

- **OFF = byte-identical.** `ATCustomUI` defaults to `false`; `bootCustomUI()` must be a pure no-op on game behavior when off. The L0 `baseline-zero` sim net must stay neutral (no trace change).
- **Rule 1 — container granularity only.** Adopt/reparent whole game containers, never nodes *inside* a container the game rebuilds via `innerHTML`.
- **Rule 2 — no containing block over game overlays.** `#atWrapper` stays `position: static`, no `transform`/`filter`/`will-change`. The marker uses `outline` (no layout shift) + a `position: fixed` badge. Never establish a containing block that would offset `#tooltipDiv`/portal/spire/tutorial overlays.
- **Rule 3 — never drop or re-id an adopted node.** Reparent intact; ids preserved, or the game resurrects a duplicate.
- **Gates by exit code, not grep:** `npm run lint`, `npm run typecheck`, `npm run test:ci`, `npm run build` — check `$?`.
- **Never change game balance numbers.** (Not touched here, but standing.)
- Branch: `feature/custom-ui-adopt-shell`. Commit each task.

---

### Task 1: Scaffold `custom-ui` module — state + region registry (pure)

**Files:**
- Create: `src/modules/custom-ui/state.ts`
- Create: `src/modules/custom-ui/regions.ts`
- Test: `tests/custom-ui/regions.test.ts`

**Interfaces:**
- Produces: `customUIState: { active: boolean; adopted: boolean }` (mutable holder).
- Produces: `HUD_ROOT_ID = 'wrapper'`; `SHELL_ID = 'atWrapper'`.
- Produces: `type RegionStatus = 'adopted' | 'at-styled' | 'at-native'`.
- Produces: `interface Region { id: string; containerId: string; status: RegionStatus }`.
- Produces: `REGIONS: Region[]` — the Phase 1 registry (the single whole-HUD region).
- Produces: `regionContainerIds(): string[]`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/custom-ui/regions.test.ts
import { describe, it, expect } from 'vitest'
import { REGIONS, regionContainerIds, HUD_ROOT_ID } from '../../src/modules/custom-ui/regions'

describe('custom-ui region registry', () => {
  it('registers the whole-HUD region adopting #wrapper', () => {
    expect(HUD_ROOT_ID).toBe('wrapper')
    expect(regionContainerIds()).toContain('wrapper')
  })
  it('every region has a valid status', () => {
    const valid = new Set(['adopted', 'at-styled', 'at-native'])
    for (const r of REGIONS) expect(valid.has(r.status)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/custom-ui/regions.test.ts`
Expected: FAIL — cannot resolve `../../src/modules/custom-ui/regions`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/modules/custom-ui/state.ts
// Mutable cross-module holder for the custom-UI shell (mirrors graphs/state.ts).
// A bare `export let` can't be reassigned across modules, so state lives on one object.
export const customUIState = {
  active: false,   // is the AT shell currently shown?
  adopted: false,  // has #wrapper been reparented into #atWrapper?
}
```

```ts
// src/modules/custom-ui/regions.ts
export const HUD_ROOT_ID = 'wrapper'
export const SHELL_ID = 'atWrapper'

export type RegionStatus = 'adopted' | 'at-styled' | 'at-native'
export interface Region {
  id: string
  containerId: string
  status: RegionStatus
}

// Phase 1: the entire HUD is one adopted region (#wrapper moved intact).
// Later phases split this into per-section regions and graduate them.
export const REGIONS: Region[] = [
  { id: 'hud', containerId: HUD_ROOT_ID, status: 'adopted' },
]

export function regionContainerIds(): string[] {
  return REGIONS.map((r) => r.containerId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/custom-ui/regions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/custom-ui/state.ts src/modules/custom-ui/regions.ts tests/custom-ui/regions.test.ts
git commit -m "feat(#41): custom-ui module scaffold — state + region registry"
```

---

### Task 2: Shell — create `#atWrapper`, marker, show/hide

**Files:**
- Create: `src/modules/custom-ui/shell.ts`
- Test: `tests/custom-ui/shell.test.ts` (jsdom)

**Interfaces:**
- Consumes: `SHELL_ID`, `customUIState` (Task 1).
- Produces: `ensureShell(): HTMLElement` — creates `#atWrapper` (idempotent), appends the marker, returns it.
- Produces: `showShell(): void` / `hideShell(): void` — display swap of `#atWrapper`.
- Produces: `MARKER_CLASS = 'at-ui-shell'` applied to `#atWrapper` for the outline; badge `.at-ui-badge`.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { ensureShell, showShell, hideShell, MARKER_CLASS } from '../../src/modules/custom-ui/shell'

describe('custom-ui shell', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('creates #atWrapper once, idempotently, with the marker', () => {
    const a = ensureShell()
    const b = ensureShell()
    expect(a).toBe(b)
    expect(document.querySelectorAll('#atWrapper').length).toBe(1)
    expect(a.classList.contains(MARKER_CLASS)).toBe(true)
    expect(a.querySelector('.at-ui-badge')).not.toBeNull()
  })

  it('is position:static (Rule 2 — no containing block over game overlays)', () => {
    const a = ensureShell()
    // never set inline position/transform
    expect(a.style.position).toBe('')
    expect(a.style.transform).toBe('')
  })

  it('show/hide toggles display', () => {
    ensureShell()
    hideShell()
    expect(document.getElementById('atWrapper')!.style.display).toBe('none')
    showShell()
    expect(document.getElementById('atWrapper')!.style.display).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/custom-ui/shell.test.ts`
Expected: FAIL — cannot resolve `shell`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/modules/custom-ui/shell.ts
import { SHELL_ID } from './regions'

export const MARKER_CLASS = 'at-ui-shell'

// Create the AT-owned root shell as a plain, STATIC body sibling. Rule 2: never
// set position/transform/filter here — game overlays (#tooltipDiv, portal, spire)
// are body siblings and must keep <body> as their containing block. The marker
// outline (outline: no layout shift) + a position:fixed badge signal the AT UI.
export function ensureShell(): HTMLElement {
  let shell = document.getElementById(SHELL_ID)
  if (shell) return shell
  shell = document.createElement('div')
  shell.id = SHELL_ID
  shell.className = MARKER_CLASS
  const badge = document.createElement('div')
  badge.className = 'at-ui-badge'
  badge.textContent = 'AutoTrimps UI'
  shell.appendChild(badge)
  document.body.appendChild(shell)
  return shell
}

export function showShell(): void {
  const shell = document.getElementById(SHELL_ID)
  if (shell) shell.style.display = ''
}

export function hideShell(): void {
  const shell = document.getElementById(SHELL_ID)
  if (shell) shell.style.display = 'none'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/custom-ui/shell.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/custom-ui/shell.ts tests/custom-ui/shell.test.ts
git commit -m "feat(#41): custom-ui shell — #atWrapper + marker + show/hide"
```

---

### Task 3: Adopt / release `#wrapper` at container granularity

**Files:**
- Create: `src/modules/custom-ui/adopt.ts`
- Test: `tests/custom-ui/adopt.test.ts` (jsdom)

**Interfaces:**
- Consumes: `ensureShell` (Task 2), `HUD_ROOT_ID`, `customUIState` (Task 1).
- Produces: `adoptHud(): void` — records `#wrapper`'s original next-sibling anchor, moves `#wrapper` into `#atWrapper`, sets `customUIState.adopted = true`. Idempotent.
- Produces: `releaseHud(): void` — moves `#wrapper` back to its original body position (before the recorded anchor), sets `customUIState.adopted = false`. Idempotent.
- Produces: preserves `#wrapper`'s id and every descendant id (Rule 3).

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { adoptHud, releaseHud } from '../../src/modules/custom-ui/adopt'
import { customUIState } from '../../src/modules/custom-ui/state'

function fixture() {
  document.body.innerHTML = `
    <div id="wrapper"><div id="innerWrapper"><span id="foodOwned">5</span></div></div>
    <div id="tooltipDiv"></div>
    <script id="tail"></script>`
}

describe('custom-ui adopt/release', () => {
  beforeEach(() => { fixture(); customUIState.adopted = false })

  it('moves #wrapper into #atWrapper, preserving ids (Rule 3)', () => {
    adoptHud()
    const shell = document.getElementById('atWrapper')!
    expect(shell.querySelector('#wrapper')).not.toBeNull()
    expect(document.getElementById('foodOwned')!.textContent).toBe('5') // still id-addressable
    expect(customUIState.adopted).toBe(true)
  })

  it('release returns #wrapper to its original body position (before #tooltipDiv)', () => {
    adoptHud()
    releaseHud()
    const wrapper = document.getElementById('wrapper')!
    expect(wrapper.parentElement).toBe(document.body)
    expect(wrapper.nextElementSibling!.id).toBe('tooltipDiv') // original order restored
    expect(customUIState.adopted).toBe(false)
  })

  it('adopt is idempotent', () => {
    adoptHud(); adoptHud()
    expect(document.querySelectorAll('#wrapper').length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/custom-ui/adopt.test.ts`
Expected: FAIL — cannot resolve `adopt`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/modules/custom-ui/adopt.ts
import { ensureShell } from './shell'
import { HUD_ROOT_ID } from './regions'
import { customUIState } from './state'

// Where #wrapper sat in <body> before adoption, so release() restores exact order.
let originalAnchor: { parent: Node; nextSibling: Node | null } | null = null

export function adoptHud(): void {
  if (customUIState.adopted) return
  const wrapper = document.getElementById(HUD_ROOT_ID)
  if (!wrapper || !wrapper.parentNode) return
  originalAnchor = { parent: wrapper.parentNode, nextSibling: wrapper.nextSibling }
  const shell = ensureShell()
  shell.appendChild(wrapper) // Rule 1: whole container, intact. Rule 3: id preserved.
  customUIState.adopted = true
}

export function releaseHud(): void {
  if (!customUIState.adopted) return
  const wrapper = document.getElementById(HUD_ROOT_ID)
  if (wrapper && originalAnchor) {
    originalAnchor.parent.insertBefore(wrapper, originalAnchor.nextSibling)
  }
  customUIState.adopted = false
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/custom-ui/adopt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/custom-ui/adopt.ts tests/custom-ui/adopt.test.ts
git commit -m "feat(#41): custom-ui adopt/release #wrapper at container granularity"
```

---

### Task 4: `ATCustomUI` toggle setting + persistence snapshots

**Files:**
- Modify: `src/modules/settings-defs.ts` (add one `createSetting('ATCustomUI', …)` in a general/always-visible group)
- Modify: settings-visibility if a U1/U2 twin gate is needed (likely not — it's universe-agnostic)
- Update: the settings-inventory `.snap` **and** the inline `toMatchInlineSnapshot` count (per [[reference-settings-inventory-dual-snapshot]])

**Interfaces:**
- Produces: setting id `ATCustomUI`, boolean, default `false`, read via `getPageSetting('ATCustomUI')`.

- [ ] **Step 1: Find the createSetting boolean pattern + the general settings group**

Run: `grep -n "createSetting('.*', 'On/Off'\|createSetting('.*', \['" src/modules/settings-defs.ts | head`
Read the nearest boolean toggle (e.g. a simple On/Off setting) to copy its exact `type`, `list`, and `container` arguments verbatim. Pick an always-visible general container (not universe-gated).

- [ ] **Step 2: Add the setting**

Add (adapting arg shape to the copied pattern):

```ts
createSetting('ATCustomUI', 'Custom UI (beta)', tip({
  name: 'Custom UI (beta)',
  description: "Replace the game's UI with the AutoTrimps custom UI. When off, the stock game UI is unchanged. A marked shell adopts the game's own panels — nothing is missing.",
}), /* type */, /* default */ false, /* list */, /* container */)
```

- [ ] **Step 3: Run the settings nets — expect the snapshot reds, then update them**

Run: `npx vitest run tests/settings-wired.test.ts tests/nets/ 2>&1 | tail -30`
Expected: RED on the settings-inventory snapshot (new id) — this is expected.
Update snapshots: `npx vitest run -u tests/` for the inventory `.snap`; find and bump the inline `toMatchInlineSnapshot` count (grep for the count the failure names). Re-run until green.

- [ ] **Step 4: Verify the setting reads false by default**

Run: `npx vitest run tests/settings-wired.test.ts`
Expected: PASS. Confirm `ATCustomUI` appears in the wired-settings census (every createSetting id must be read — it will be, once Task 5 reads it).

- [ ] **Step 5: Commit**

```bash
git add src/modules/settings-defs.ts tests/
git commit -m "feat(#41): ATCustomUI toggle setting (default off)"
```

---

### Task 5: `bootCustomUI()` + live toggle wiring + OFF no-op

**Files:**
- Create: `src/modules/custom-ui/boot.ts`
- Create: `src/modules/custom-ui/index.ts` (re-export `bootCustomUI`, `applyCustomUI`)
- Modify: `src/main.ts` (call `bootCustomUI()` after `bootGraphs()`)
- Modify: wherever settings changes dispatch (the settings `onchange`/`settingChanged` path) to call `applyCustomUI()` when `ATCustomUI` flips — OR poll in boot for simplicity in Phase 1
- Test: `tests/custom-ui/boot.test.ts` (jsdom)

**Interfaces:**
- Consumes: `adoptHud`/`releaseHud` (Task 3), `showShell`/`hideShell`/`ensureShell` (Task 2), `getPageSetting` (game/AT global), `hideShell`.
- Produces: `applyCustomUI(active: boolean): void` — active → ensureShell + adoptHud + showShell + hide `#wrapper` is *inside* shell so it shows with it; inactive → releaseHud + hideShell. Sets `customUIState.active`.
- Produces: `bootCustomUI(): void` — reads `getPageSetting('ATCustomUI')`; **if falsy, returns immediately doing nothing** (OFF no-op invariant); else `applyCustomUI(true)`.

- [ ] **Step 1: Write the failing test (jsdom, with a getPageSetting stub)**

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

function fixture() {
  document.body.innerHTML = `<div id="wrapper"><span id="foodOwned">5</span></div><div id="tooltipDiv"></div>`
}

describe('bootCustomUI OFF no-op invariant', () => {
  beforeEach(() => { fixture(); vi.resetModules() })

  it('does nothing when ATCustomUI is off', async () => {
    ;(globalThis as any).getPageSetting = () => false
    const { bootCustomUI } = await import('../../src/modules/custom-ui/boot')
    bootCustomUI()
    expect(document.getElementById('atWrapper')).toBeNull() // no shell created
    expect(document.getElementById('wrapper')!.parentElement).toBe(document.body) // untouched
  })

  it('adopts when ATCustomUI is on', async () => {
    ;(globalThis as any).getPageSetting = () => true
    const { bootCustomUI } = await import('../../src/modules/custom-ui/boot')
    bootCustomUI()
    expect(document.querySelector('#atWrapper #wrapper')).not.toBeNull()
  })

  it('applyCustomUI(false) releases and hides', async () => {
    ;(globalThis as any).getPageSetting = () => true
    const { bootCustomUI, applyCustomUI } = await import('../../src/modules/custom-ui/boot')
    bootCustomUI()
    applyCustomUI(false)
    expect(document.getElementById('wrapper')!.parentElement).toBe(document.body)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/custom-ui/boot.test.ts`
Expected: FAIL — cannot resolve `boot`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/modules/custom-ui/boot.ts
import { ensureShell, showShell, hideShell } from './shell'
import { adoptHud, releaseHud } from './adopt'
import { customUIState } from './state'

declare function getPageSetting(id: string): any

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
```

```ts
// src/modules/custom-ui/index.ts
export { bootCustomUI, applyCustomUI } from './boot'
export { customUIState } from './state'
```

- [ ] **Step 4: Wire into main.ts**

Add after `bootGraphs()` (main.ts:38):

```ts
import { bootCustomUI } from './modules/custom-ui'
// … after bootGraphs():
bootCustomUI()
```

- [ ] **Step 5: Wire the live toggle**

Find the settings-change dispatch (grep `settingChanged` / the onchange handler in `settings-engine.ts`/`settings-menu.ts`). When id `=== 'ATCustomUI'`, call `applyCustomUI(getPageSetting('ATCustomUI'))`. If no clean hook exists in Phase 1, document that the toggle applies on next reload and file a follow-up — but prefer the live hook.

- [ ] **Step 6: Run tests + typecheck + build**

Run: `npx vitest run tests/custom-ui/ && npm run typecheck && npm run build`
Expected: PASS; `dist/autotrimps.user.js` emits.

- [ ] **Step 7: Commit**

```bash
git add src/modules/custom-ui/boot.ts src/modules/custom-ui/index.ts src/main.ts src/modules/settings-*.ts tests/custom-ui/boot.test.ts
git commit -m "feat(#41): bootCustomUI wiring + live toggle (off = no-op)"
```

---

### Task 6: Completeness audit net

**Files:**
- Create: `tests/nets/custom-ui-completeness.test.ts`
- Test: itself (mutation-checked)

**Interfaces:**
- Consumes: `regionContainerIds()` (Task 1), the game `index.html` HUD containers.

- [ ] **Step 1: Identify the game's top-level HUD containers under #wrapper**

Run: `grep -oE 'id="[a-zA-Z]+"' ../trimps-game/index.html | sort -u | head -80`
Enumerate the direct top-level HUD region containers (resources column, buildings/jobs/upgrades/equipment Here, grid, log, maps, settings row, portal row). Capture them as the expected set.

- [ ] **Step 2: Write the net**

```ts
// tests/nets/custom-ui-completeness.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { REGIONS } from '../../src/modules/custom-ui/regions'

// Phase 1: the whole HUD is adopted as #wrapper, so every game HUD region is
// covered transitively. This net asserts #wrapper (the adopted root) is registered
// and will grow to per-region granularity as regions graduate. It fails if the
// registry loses coverage of the HUD root — the mechanized form of "our UI is
// missing something".
describe('custom-ui completeness', () => {
  it('the adopted HUD root #wrapper is registered', () => {
    const covered = new Set(REGIONS.map((r) => r.containerId))
    expect(covered.has('wrapper')).toBe(true)
  })

  it('#wrapper exists in the game index.html (the seam is real)', () => {
    const html = readFileSync(new URL('../../../trimps-game/index.html', import.meta.url), 'utf8')
    expect(html).toMatch(/id=["']wrapper["']/)
  })
})
```

- [ ] **Step 3: Run + mutation-check**

Run: `npx vitest run tests/nets/custom-ui-completeness.test.ts`
Expected: PASS. Then mutation-check: temporarily change `containerId: 'wrapper'` → `'wrapperX'` in `regions.ts`, re-run, confirm RED, revert.

- [ ] **Step 4: Commit**

```bash
git add tests/nets/custom-ui-completeness.test.ts
git commit -m "test(#41): custom-ui completeness net (mutation-checked)"
```

---

### Task 7: Full gates + Chrome live-verify + baseline-zero neutrality

**Files:** none (verification task).

- [ ] **Step 1: Run every gate by exit code**

```bash
npm run lint >/dev/null 2>&1; echo "lint=$?"
npm run typecheck >/dev/null 2>&1; echo "typecheck=$?"
npm run test:ci >/tmp/at-testci.log 2>&1; echo "test:ci=$?"; tail -5 /tmp/at-testci.log
npm run build >/dev/null 2>&1; echo "build=$?"
```
Expected: all `=0`. **Critically: `baseline-zero` must be green** (OFF = byte-identical; the new module is a no-op when the setting is false, and the sim never sets it).

- [ ] **Step 2: Serve + Chrome verify**

```bash
npm run build && npm run serve   # background; note the port (8080)
```
Open `http://localhost:8080/`. With Chrome DevTools MCP:
- Confirm "AutoTrimps - Zek Fork Loaded!" and clean console.
- **OFF:** UI indistinguishable from stock; screenshot.
- Toggle `ATCustomUI` ON in the AT settings panel (click-test the control itself).
- **ON:** layout identical to stock **plus** the visible marker (outline + "AutoTrimps UI" badge); resources still tick, a fight runs, a map can be entered; `evaluate_script` asserts `document.querySelector('#atWrapper #wrapper')` is non-null and `#foodOwned` still updates; screenshot.
- Toggle OFF again → `#wrapper` back under `<body>` before `#tooltipDiv`; hover a building to confirm `#tooltipDiv` still positions correctly (Rule 2); no console errors; no duplicate `#wrapper`.

- [ ] **Step 3: Record evidence**

Save both screenshots' paths; note console state. Update the task list.

---

## Self-Review

**Spec coverage:**
- §2 decision (adopt not reimplement) → Tasks 2/3 (adopt mechanism). ✓
- §3 Rule 1 (container granularity) → Task 3 moves whole `#wrapper`. ✓
- §3 Rule 2 (no containing block) → Task 2 static shell + test; Task 7 tooltip check. ✓
- §3 Rule 3 (no re-id) → Task 3 preserves ids + test. ✓
- §4 shell/adopt/regions/boot/state components → Tasks 1/2/3/5. ✓
- §4 toggle setting → Task 4. ✓
- §5 marker → Task 2. ✓
- §6 completeness net → Task 6. ✓
- §7 OFF=byte-identical → Task 5 no-op + Task 7 baseline-zero. ✓
- §7 Chrome verify → Task 7. ✓

**Placeholder scan:** Task 4 leaves `createSetting` arg shape to be copied from the real boolean pattern (the exact `type`/`list`/`container` values differ per the engine and must be read from source, not guessed) — this is a *deliberate read-from-source step*, not a lazy placeholder; Step 1 makes it concrete. All other steps carry real code.

**Type consistency:** `customUIState` fields (`active`/`adopted`), `HUD_ROOT_ID`/`SHELL_ID`, `adoptHud`/`releaseHud`/`ensureShell`/`showShell`/`hideShell`/`applyCustomUI`/`bootCustomUI` names are consistent across Tasks 1-6. ✓

**Known empirical risk (settle in Task 7):** wholesale `appendChild(#wrapper)` into a static `#atWrapper` should preserve layout since the internal Bootstrap grid moves intact and a static div is not a containing block. If Chrome shows any layout shift or overlay offset, fall back to restyle-in-place (add a class to `#wrapper`/`body`, don't reparent) for Phase 1 and reparent per-region later — the shell/marker/toggle/net all stay valid.
