# Native-Automation Conflict Advisory Badges (#150) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a native Trimps automation (AutoPrestige / AutoUpgrade / AutoStructure / AutoJobs / AutoStorage) is set in a way that fights AutoTrimps' own automation, show a yellow ⚠️ badge next to that button whose hover explains what AT does instead, why, and the one setting to change.

**Architecture:** Two modules, split pure-from-DOM the way `graphs/` and `custom-ui/` are. `src/modules/native-conflicts.ts` owns the **conflict matrix** — a table of rows, each with a `when()` predicate reading `game` + `getPageSetting` and a `body()` returning universe-correct hover copy; it touches no DOM and is unit-tested under the node env. `src/modules/native-conflict-badges.ts` owns the DOM: an idempotent `syncConflictBadges()` that mounts a badge as a **sibling** of the anchor button, refreshes its tooltip attribute, and unmounts when the conflict clears. It is driven once per second from `guiLoop()` behind an `atGuard`, gated on a new `WarnNativeAutomationConflicts` setting (default **ON**).

**Tech Stack:** TypeScript (strict), vitest (node + jsdom per-file), the existing `tip()`/`tipAttr()` tooltip seam, the `atGuard` error boundary, the SHA-pinned `.trimps-game/` clone as the id oracle.

## Global Constraints

- **AT mutates NOTHING.** No game state, no persisted setting, no native toggle. Advisory only. Auto-swapping AT's settings was explicitly rejected in #150 (it is the #69 "seized the AutoStorage button" mistake). A `when()` predicate that writes anything is a plan violation.
- **Badges are SIBLINGS of the anchor, never children.** `toggleAutoStorage` / `toggleAutoUpgrades` / `toggleAutoPrestiges` each do `elem.innerHTML = "<label>"` on every click (`.trimps-game/main.js:18379`, `:18416`, `:18432`) — a child badge is destroyed on click.
- **Never touch the anchor's own `onmouseover`.** All five native buttons already call the game's `tooltip(...)` with their native explanation (`.trimps-game/index.html:440-492`). The badge carries its own handlers.
- **All hover text goes through the escaping seam.** A raw `"` in an inline handler silently leaves `onmouseover === null` with nothing thrown (#110). Task 1 exports `tooltipAttr()` for exactly this; do not hand-build the attribute string.
- **Sync every tick, never mount-once.** The game writes `style.display` on the *buttons* at load and on Bone Shrine level changes (`main.js:1221-1231`, `updates.js:4279-4286`, `:4804-4808`) and never touches a sibling node.
- **No `color*` class on any game element.** The game's `swapClass("color", …)` owns that namespace.
- **Universe-aware.** U1 and U2 read different AT settings (`BuyUpgradesNew` vs `RBuyUpgradesNew`, `BuyArmorNew`/`BuyWeaponsNew` vs `Requipon`, `BuyBuildingsNew` vs `RBuyBuildingsNew`, `BuyJobsNew` vs `RBuyJobsNew`) and the game itself resolves `getAutoStructureSetting()` / `getAutoJobsSetting()` per universe.
- **`getPageSetting` returns `false` for a key that is not in the store** (#68) — so every numeric gate compares `Number(...) > 0`, never `!== 0`. `!== 0` is true for `false` and would fire a phantom conflict for a veteran whose localStorage lacks the key.
- **Branch:** `feature/150-native-automation-conflict-badges` in the **main checkout, not a worktree** — the dev workspace clone is reached as `../trimps-game` and the pinned clone as `./.trimps-game/`, both of which resolve wrong from `.claude/worktrees/`.
- **Every task ends green by exit code**, not by reading output: `npm run lint >/dev/null 2>&1; echo $?` etc. (`| tail` reports *tail's* status — the trap CLAUDE.md warns about.)
- Any change under `src/` moves the byte golden. Regenerating it is an attributable act: `node scripts/regen-src-golden.mjs --reason "<why>"` (refuses a reason under 15 chars). Do it **once, in the last implementation task**, not per-task.

---

### Task 1: Export a reusable tooltip-attribute seam

`tipAttr()` in `settings-engine.ts` is module-private and hard-wires the `Default: …` facet — calling it with `type === undefined` would emit the literal text `Default: undefined`. Extract the escaping + attribute construction into an exported `tooltipAttr(label, body)` and have `tipAttr` compose on top of it, so the badge module reuses the *same* escaping rather than retyping it (derive, don't retype).

**Files:**
- Modify: `src/modules/settings-engine.ts:126-131`
- Test: `tests/settings-engine.tooltipAttr.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `export function tooltipAttr(label: unknown, body: unknown): string` — returns `tooltip("<label>", "customText", event, "<body>")` with `\` and `"` escaped in both. No default-value facet.

- [ ] **Step 1: Write the failing test**

Create `tests/settings-engine.tooltipAttr.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { tooltipAttr } from '../src/modules/settings-engine'

describe('tooltipAttr (#150 seam)', () => {
  it('emits a customText tooltip call', () => {
    expect(tooltipAttr('Title', 'Body')).toBe('tooltip("Title", "customText", event, "Body")')
  })

  it('escapes the quote that would otherwise null the handler (#110)', () => {
    // A raw " closes the JS string literal inside the attribute; the handler then fails to
    // compile and the browser leaves onmouseover === null, silently, with nothing thrown.
    expect(tooltipAttr('a"b', 'c"d')).toBe('tooltip("a\\"b", "customText", event, "c\\"d")')
  })

  it('escapes backslashes before quotes so an escape cannot be forged', () => {
    expect(tooltipAttr('x', 'a\\"b')).toBe('tooltip("x", "customText", event, "a\\\\\\"b")')
  })

  it('adds NO default-value facet — that belongs to createSetting only', () => {
    expect(tooltipAttr('T', 'B')).not.toContain('Default:')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/settings-engine.tooltipAttr.test.ts`
Expected: FAIL — `tooltipAttr` is not exported from `settings-engine`.

- [ ] **Step 3: Extract the seam**

In `src/modules/settings-engine.ts`, replace the existing `tipAttr` const (currently lines 126-131) with:

```ts
// #150 — the escaping + attribute construction is a SEAM, not a local detail. The badge module
// (native-conflict-badges.ts) needs the identical escaping, and a second hand-written copy of the
// rule is how #110 happens twice. `tooltipAttr` deliberately carries NO default-value facet: it is
// for tooltips that have no setting behind them.
const escTipAttr = (s: any) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export function tooltipAttr(label: any, body: any): string {
    return 'tooltip("' + escTipAttr(label) + '", "customText", event, "' + escTipAttr(body) + '")';
}

const tipAttr = (label: any, description: any, type?: any, defaultValue?: any, name?: any) =>
    tooltipAttr(label, String(description) + defaultFacet(type, defaultValue, name));
```

The emitted string for all 574 existing settings is byte-identical: same concatenation order, same escaping, applied to the same `description + defaultFacet(...)` body.

- [ ] **Step 4: Prove the 574 existing tooltips still compile**

Run: `npx vitest run tests/settings-engine.tooltipAttr.test.ts tests/nets/settings-tooltips.test.ts tests/nets/settings-tooltip-census.test.ts`
Expected: PASS. `settings-tooltips.test.ts` mounts every setting and parses each handler with esbuild — it is the arbiter that the refactor changed no tooltip.

- [ ] **Step 5: Confirm the bridge is still collision-free**

Run: `npx vitest run tests/nets/bridge-collision.test.ts`
Expected: PASS. The bridge publishes every export onto `globalThis` by name; `tooltipAttr` must be unique across all 400+ exports. If this goes red, a name already exists — rename to `atTooltipAttr` and update Task 3's import.

- [ ] **Step 6: Commit**

```bash
git add src/modules/settings-engine.ts tests/settings-engine.tooltipAttr.test.ts
git commit -m "refactor(#150): export tooltipAttr as the tooltip-escaping seam"
```

---

### Task 2: The conflict matrix (pure, no DOM)

**Files:**
- Create: `src/modules/native-conflicts.ts`
- Test: `tests/native-conflicts.test.ts` (create)

**Interfaces:**
- Consumes: `getPageSetting` from `./utils`; ambient `game`, `getAutoStructureSetting`, `getAutoJobsSetting` (Task 4 declares the latter two).
- Produces:
  - `export interface NativeConflict { key: string; anchorId: string; title: string; when: () => boolean; body: () => string }`
  - `export const CONFLICTS: readonly NativeConflict[]` — 7 rows, keys: `autoPrestige`, `autoUpgrade`, `autoStructure`, `autoJobs`, `autoStorageOff`, `hideBuildingsOrphan`, `hideJobsOrphan`.
  - `export function activeConflicts(): NativeConflict[]` — the rows whose `when()` returned true. A row whose `when()` throws is treated as inactive.

- [ ] **Step 1: Write the failing test**

Create `tests/native-conflicts.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { CONFLICTS, activeConflicts } from '../src/modules/native-conflicts'

// The matrix reads two sources: game.global flags and AT's own settings store. Both are ambient
// globals, so the fixture installs them directly — no DOM, no bundle, no clone boot needed.
function setup(universe: number) {
  ;(globalThis as any).game = {
    global: {
      universe,
      autoPrestiges: 0,
      autoUpgrades: 0,
      autoStorage: true,
      improvedAutoStorage: false,
      autoStructureSetting: { enabled: false },
      autoStructureSettingU2: { enabled: false },
      autoJobsSetting: { enabled: false },
      autoJobsSettingU2: { enabled: false },
    },
  }
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).getAutoStructureSetting = () =>
    universe === 2 ? (globalThis as any).game.global.autoStructureSettingU2 : (globalThis as any).game.global.autoStructureSetting
  ;(globalThis as any).getAutoJobsSetting = () =>
    universe === 2 ? (globalThis as any).game.global.autoJobsSettingU2 : (globalThis as any).game.global.autoJobsSetting
}

/** Install an AT setting the way createSetting would have. */
function set(id: string, type: string, value: any) {
  const store = (globalThis as any).autoTrimpSettings
  store[id] = type === 'boolean' ? { id, type, enabled: value } : { id, type, value }
}

const keys = () => activeConflicts().map((c) => c.key)

describe('native-conflicts matrix (#150)', () => {
  beforeEach(() => setup(1))

  it('a stock, non-conflicting state reports nothing', () => {
    expect(keys()).toEqual([])
  })

  it('AutoPrestige on + AT buying prestiges conflicts (U1)', () => {
    ;(globalThis as any).game.global.autoPrestiges = 1
    set('BuyArmorNew', 'multitoggle', 1) // Armor: Buy Both
    expect(keys()).toContain('autoPrestige')
  })

  it('AutoPrestige on while AT buys LEVELS only does not conflict', () => {
    ;(globalThis as any).game.global.autoPrestiges = 1
    set('BuyArmorNew', 'multitoggle', 3) // Armor: Levels
    set('BuyWeaponsNew', 'multitoggle', 3) // Weapons: Levels
    expect(keys()).not.toContain('autoPrestige')
  })

  it('AutoPrestige uses Requipon as the AT-side gate in U2', () => {
    setup(2)
    ;(globalThis as any).game.global.autoPrestiges = 1
    set('BuyArmorNew', 'multitoggle', 1) // U1 setting: must be ignored in U2
    expect(keys()).not.toContain('autoPrestige')
    set('Requipon', 'boolean', true)
    expect(keys()).toContain('autoPrestige')
  })

  it('AutoUpgrade mode 1 conflicts, mode 2 (Auto No Coords) does not', () => {
    set('BuyUpgradesNew', 'multitoggle', 1)
    ;(globalThis as any).game.global.autoUpgrades = 1
    expect(keys()).toContain('autoUpgrade')
    ;(globalThis as any).game.global.autoUpgrades = 2
    expect(keys()).not.toContain('autoUpgrade')
  })

  it('a MISSING AT setting never fires a phantom conflict (#68: getPageSetting returns false)', () => {
    ;(globalThis as any).game.global.autoUpgrades = 1
    ;(globalThis as any).autoTrimpSettings = {} // veteran localStorage lacking the key
    expect(keys()).not.toContain('autoUpgrade')
  })

  it('AutoStructure on while AT still buys buildings conflicts', () => {
    ;(globalThis as any).game.global.autoStructureSetting.enabled = true
    set('BuyBuildingsNew', 'multitoggle', 1) // Buy Buildings & Storage
    expect(keys()).toContain('autoStructure')
    set('BuyBuildingsNew', 'multitoggle', 0) // Buy Neither — the sanctioned handoff
    expect(keys()).not.toContain('autoStructure')
  })

  it('AutoJobs on while AT still buys jobs conflicts', () => {
    ;(globalThis as any).game.global.autoJobsSetting.enabled = true
    set('BuyJobsNew', 'multitoggle', 1)
    expect(keys()).toContain('autoJobs')
  })

  it('AutoStorage OFF with ImprovedAutoStorage unlocked is an inverse advisory', () => {
    ;(globalThis as any).game.global.improvedAutoStorage = true
    ;(globalThis as any).game.global.autoStorage = false
    expect(keys()).toContain('autoStorageOff')
    ;(globalThis as any).game.global.autoStorage = true
    expect(keys()).not.toContain('autoStorageOff')
  })

  it('Hide Buildings on with AutoStructure OFF means nothing buys buildings', () => {
    set('hidebuildings', 'boolean', true)
    set('BuyBuildingsNew', 'multitoggle', 0)
    expect(keys()).toContain('hideBuildingsOrphan')
    ;(globalThis as any).game.global.autoStructureSetting.enabled = true
    expect(keys()).not.toContain('hideBuildingsOrphan')
  })

  it('Hide Jobs on with AutoJobs OFF means nothing buys jobs', () => {
    set('fuckjobs', 'boolean', true)
    set('BuyJobsNew', 'multitoggle', 0)
    expect(keys()).toContain('hideJobsOrphan')
    ;(globalThis as any).game.global.autoJobsSetting.enabled = true
    expect(keys()).not.toContain('hideJobsOrphan')
  })

  it('a throwing predicate is inactive, never fatal', () => {
    delete (globalThis as any).game
    expect(() => activeConflicts()).not.toThrow()
    expect(activeConflicts()).toEqual([])
  })

  it('every row has a non-empty title and body, and a distinct key', () => {
    expect(new Set(CONFLICTS.map((c) => c.key)).size).toBe(CONFLICTS.length)
    for (const c of CONFLICTS) {
      expect(c.title.length).toBeGreaterThan(0)
      expect(c.body().length).toBeGreaterThan(80) // a one-liner is not an explanation
      expect(c.anchorId.length).toBeGreaterThan(0)
    }
  })

  it('no row mutates game state (advisory only)', () => {
    const before = JSON.stringify((globalThis as any).game.global)
    for (const c of CONFLICTS) {
      try { c.when(); c.body() } catch { /* covered above */ }
    }
    expect(JSON.stringify((globalThis as any).game.global)).toBe(before)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/native-conflicts.test.ts`
Expected: FAIL — cannot resolve `../src/modules/native-conflicts`.

- [ ] **Step 3: Write the module**

Create `src/modules/native-conflicts.ts`:

```ts
// #150 — the native-automation conflict matrix.
//
// The game ships its own automation for jobs AT also automates, and nothing told the player when the
// two were fighting. This module is the ADVISORY table: which native setting conflicts with which AT
// setting, and what to say about it. It is deliberately DOM-free and mutation-free — the badge
// renderer (native-conflict-badges.ts) owns every element, and nothing here may change game state or
// a persisted setting. Auto-"fixing" the player's settings was rejected in #150: silently rewriting a
// persisted choice is the #69 seized-AutoStorage-button mistake in a new costume.
import { getPageSetting } from './utils'

export interface NativeConflict {
    /** Stable key. Also the badge element's id suffix. */
    key: string
    /** Element the badge anchors to — a native game button, or one of AT's own controls. */
    anchorId: string
    /** Tooltip heading. */
    title: string
    /** True while this conflict is live. Reads game state + AT settings; MUST NOT mutate either. */
    when: () => boolean
    /** Tooltip body (HTML). A function because the copy names the universe-correct setting. */
    body: () => string
}

const u2 = (): boolean => game.global.universe === 2

/** Numeric AT settings: `Number(false) === 0`, so a key missing from the store reads as OFF (#68). */
const num = (id: string): number => Number(getPageSetting(id)) || 0
const bool = (id: string): boolean => getPageSetting(id) === true

// The game's own universe-aware resolvers (main.js:18026, :18046). Guarded because the unit
// environment mounts this module without the game's script.
const structureOn = (): boolean =>
    typeof getAutoStructureSetting === 'function' && !!getAutoStructureSetting()?.enabled
const jobsMasteryOn = (): boolean =>
    typeof getAutoJobsSetting === 'function' && !!getAutoJobsSetting()?.enabled

// AT-side gates. U1 and U2 are separate settings trees, and reading the wrong one is a phantom
// conflict — `BuyArmorNew` is meaningless in U2, where AutoEquip is one boolean.
const atBuysPrestiges = (): boolean =>
    u2() ? bool('Requipon') : [1, 2].includes(num('BuyArmorNew')) || [1, 2].includes(num('BuyWeaponsNew'))
const atBuysUpgrades = (): boolean => num(u2() ? 'RBuyUpgradesNew' : 'BuyUpgradesNew') > 0
const atBuysBuildings = (): boolean => (u2() ? bool('RBuyBuildingsNew') : num('BuyBuildingsNew') > 0)
const atBuysJobs = (): boolean => num(u2() ? 'RBuyJobsNew' : 'BuyJobsNew') > 0

const REC = '<br><br><b>Recommended:</b> '

export const CONFLICTS: readonly NativeConflict[] = [
    {
        key: 'autoPrestige',
        anchorId: 'autoPrestigeBtn',
        title: 'AutoPrestige fights AutoTrimps',
        when: () => game.global.autoPrestiges > 0 && atBuysPrestiges(),
        body: () =>
            "AT buys equipment prestiges on a strategy: it skips cheap ones (Prestige Skip), can delay them by zone (Force Prestige Zone), and spends the metal on equipment LEVELS instead when levels are worth more. The game's AutoPrestige buys every affordable prestige the moment it can — which spends the metal AT was saving for levels and defeats prestige-skipping entirely." +
            REC +
            'set AutoPrestige to <b>Off</b> and leave prestiges to AT&rsquo;s ' +
            (u2() ? '<b>AutoEquip</b> setting' : '<b>Armor</b> / <b>Weapons</b> settings') +
            '.',
    },
    {
        key: 'autoUpgrade',
        anchorId: 'autoUpgradeBtn',
        // Mode 2 ("Auto No Coords", unlocked at 250 void maps) excludes Coordination and is compatible.
        when: () => game.global.autoUpgrades === 1 && atBuysUpgrades(),
        title: 'AutoUpgrade ignores AT&rsquo;s upgrade holds',
        body: () =>
            "AT buys upgrades in a deliberate priority order, with holds the game's AutoUpgrade does not have: Coordination is held back when your population cannot fill the bigger squad, while Wind empowerment is stacking, and by the Amalgamator hold; wood and metal can also be reserved for foundational upgrades like Miners. The game's AutoUpgrade buys any affordable upgrade every tick, in arbitrary order, ignoring all of it." +
            REC +
            'switch AutoUpgrade to <b>Auto No Coords</b> (unlocks after 250 Void Maps cleared), which leaves Coordination to AT &mdash; or turn it Off.',
    },
    {
        key: 'autoStructure',
        anchorId: 'autoStructureBtn',
        title: 'Two building automations are running',
        when: () => structureOn() && atBuysBuildings(),
        body: () =>
            'AutoStructure and AT&rsquo;s building automation are meant to be a <b>swap</b>, not a stack. Both are buying right now, so your build queue and resources are being scheduled twice, to two different plans.' +
            REC +
            'pick one. To hand buildings to AutoStructure, set AT&rsquo;s <b>' +
            (u2() ? 'AutoBuildings</b> off' : 'Buy Buildings</b> to <b>Buy Neither</b>') +
            ' (AT still buys Gyms &mdash; AutoStructure has no Gym automation). To keep AT in charge, turn AutoStructure Off.',
    },
    {
        key: 'autoJobs',
        anchorId: 'autoJobsBtn',
        title: 'Two job automations are running',
        when: () => jobsMasteryOn() && atBuysJobs(),
        body: () =>
            'AutoJobs and AT&rsquo;s job automation are meant to be a <b>swap</b>, not a stack. Both are hiring right now, and AT rewrites the worker-ratio boxes every tick, so the two will keep undoing each other.' +
            REC +
            'pick one. To hand jobs to AutoJobs, set AT&rsquo;s <b>Buy Jobs</b> to <b>Don&rsquo;t Buy Jobs</b>. To keep AT in charge, turn AutoJobs Off.',
    },
    {
        key: 'autoStorageOff',
        anchorId: 'autoStorageBtn',
        title: 'AutoStorage off is costing you resources',
        when: () => !!game.global.improvedAutoStorage && !game.global.autoStorage,
        body: () =>
            'You have <b>Auspicious Presence Part II</b>, which builds storage instantly and converts overflow into new storage with <b>zero waste</b> &mdash; but only while AutoStorage is on. With it off, everything you collect above your cap is simply lost.' +
            REC +
            'turn AutoStorage <b>On</b>. It costs nothing: AT buys storage ahead of time anyway, so AutoStorage only ever acts as a backstop.',
    },
    {
        key: 'hideBuildingsOrphan',
        anchorId: 'hidebuildings',
        title: 'Nothing is buying buildings',
        when: () => bool('hidebuildings') && !structureOn(),
        body: () =>
            '<b>Hide Buildings</b> hands ordinary building purchases to the game&rsquo;s AutoStructure, but AutoStructure is currently <b>Off</b> &mdash; so nothing is buying housing, storage, Tributes or Nurseries at all. (AT still buys Gyms.)' +
            REC +
            'turn AutoStructure On, or turn <b>Hide Buildings</b> off and set <b>Buy Buildings</b> back to <b>Buy Buildings &amp; Storage</b>.',
    },
    {
        key: 'hideJobsOrphan',
        anchorId: 'fuckjobs',
        title: 'Nothing is buying jobs',
        when: () => bool('fuckjobs') && !jobsMasteryOn(),
        body: () =>
            '<b>Hide Jobs</b> hands hiring to the game&rsquo;s AutoJobs, but AutoJobs is currently <b>Off</b> &mdash; so no workers are being hired at all.' +
            REC +
            'turn AutoJobs On, or turn <b>Hide Jobs</b> off and set <b>Buy Jobs</b> back to <b>Auto Worker Ratios</b>.',
    },
]

/**
 * The rows that are live right now. A row whose predicate throws is treated as inactive: a badge is
 * an advisory, and an advisory must never be the thing that breaks the GUI loop. (guiLoop's atGuard
 * would contain it, but that would take the whole sweep down with it, not one row.)
 */
export function activeConflicts(): NativeConflict[] {
    const out: NativeConflict[] = []
    for (const c of CONFLICTS) {
        try {
            if (c.when()) out.push(c)
        } catch {
            /* inactive */
        }
    }
    return out
}
```

- [ ] **Step 4: Run the tests green**

Run: `npx vitest run tests/native-conflicts.test.ts`
Expected: PASS (14 tests). If the `no row mutates game state` test fails, a predicate is calling something with a side effect — fix the predicate, never the test.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck >/dev/null 2>&1; echo TSC=$?` then `npm run lint >/dev/null 2>&1; echo LINT=$?`
Expected: `TSC=0` and `LINT=0`. `getAutoStructureSetting` / `getAutoJobsSetting` will fail `tsc` here — that is expected and fixed in Task 4 Step 1; if you want Task 2 to stand alone green, do Task 4 Step 1 first (it is a 2-line ambient declaration).

- [ ] **Step 6: Commit**

```bash
git add src/modules/native-conflicts.ts tests/native-conflicts.test.ts
git commit -m "feat(#150): native-automation conflict matrix"
```

---

### Task 3: The badge renderer (DOM)

**Files:**
- Create: `src/modules/native-conflict-badges.ts`
- Test: `tests/native-conflict-badges.test.ts` (create, jsdom)

**Interfaces:**
- Consumes: `CONFLICTS`, `activeConflicts` (Task 2); `tooltipAttr` (Task 1).
- Produces:
  - `export function syncConflictBadges(): void` — idempotent mount/refresh/unmount sweep.
  - `export function removeConflictBadges(): void` — removes every badge and the injected style.
  - Badge element ids are `atNC-<key>`; badge class is `at-nc-badge`; the style element id is `at-nc-style`.

- [ ] **Step 1: Write the failing test**

Create `tests/native-conflict-badges.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { syncConflictBadges, removeConflictBadges } from '../src/modules/native-conflict-badges'

// The anchors are real game ids (index.html:440-492) inside their real bootstrap cells, so the
// sibling insert is exercised against the shape it will meet in the browser.
function fixture() {
  document.body.innerHTML = `
    <div class="col-xs-3"><div id="autoStructureBtn"><div id="autoStructureText">AutoStructure</div></div></div>
    <div class="col-xs-3"><div id="autoStorageBtn">AutoStorage</div></div>
    <div class="col-xs-3"><div id="autoUpgradeBtn">AutoUpgrade</div></div>
    <div class="col-xs-3"><div id="autoPrestigeBtn">AutoPrestige</div></div>
    <div class="col-xs-3"><div id="autoJobsBtn"><div id="autoJobsText">AutoJobs</div></div></div>
    <div><div id="hidebuildings">Hide Buildings</div></div>
    <div><div id="fuckjobs">Hide Jobs</div></div>`
  ;(globalThis as any).game = {
    global: {
      universe: 1,
      autoPrestiges: 0,
      autoUpgrades: 0,
      autoStorage: true,
      improvedAutoStorage: false,
      autoStructureSetting: { enabled: false },
      autoJobsSetting: { enabled: false },
    },
  }
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).getAutoStructureSetting = () => (globalThis as any).game.global.autoStructureSetting
  ;(globalThis as any).getAutoJobsSetting = () => (globalThis as any).game.global.autoJobsSetting
}

/** Put the state into the AutoUpgrade conflict. */
function armAutoUpgrade() {
  ;(globalThis as any).game.global.autoUpgrades = 1
  ;(globalThis as any).autoTrimpSettings.BuyUpgradesNew = { id: 'BuyUpgradesNew', type: 'multitoggle', value: 1 }
}

describe('native conflict badges (#150)', () => {
  beforeEach(() => { fixture(); removeConflictBadges() })

  it('mounts nothing when there is no conflict', () => {
    syncConflictBadges()
    expect(document.querySelectorAll('.at-nc-badge').length).toBe(0)
  })

  it('mounts a badge as a SIBLING of the anchor, not a child', () => {
    armAutoUpgrade()
    syncConflictBadges()
    const badge = document.getElementById('atNC-autoUpgrade')!
    const anchor = document.getElementById('autoUpgradeBtn')!
    expect(badge).toBeTruthy()
    expect(anchor.contains(badge)).toBe(false)
    expect(anchor.nextElementSibling).toBe(badge)
  })

  it('survives the anchor rewriting its own innerHTML (the click path)', () => {
    armAutoUpgrade()
    syncConflictBadges()
    // main.js:18416 — toggleAutoUpgrades() does exactly this on every click.
    document.getElementById('autoUpgradeBtn')!.innerHTML = 'AutoUpgrade On'
    expect(document.getElementById('atNC-autoUpgrade')).toBeTruthy()
  })

  it('is idempotent — repeated syncs never duplicate a badge', () => {
    armAutoUpgrade()
    syncConflictBadges(); syncConflictBadges(); syncConflictBadges()
    expect(document.querySelectorAll('#atNC-autoUpgrade').length).toBe(1)
  })

  it('unmounts as soon as the conflict clears', () => {
    armAutoUpgrade()
    syncConflictBadges()
    expect(document.getElementById('atNC-autoUpgrade')).toBeTruthy()
    ;(globalThis as any).game.global.autoUpgrades = 2 // Auto No Coords — compatible
    syncConflictBadges()
    expect(document.getElementById('atNC-autoUpgrade')).toBeNull()
  })

  it('does not mount while the anchor is hidden (display:none pre-unlock)', () => {
    armAutoUpgrade()
    document.getElementById('autoUpgradeBtn')!.style.display = 'none'
    syncConflictBadges()
    expect(document.getElementById('atNC-autoUpgrade')).toBeNull()
    // ...and mounts the moment the game reveals it (main.js:1222).
    document.getElementById('autoUpgradeBtn')!.style.display = 'block'
    syncConflictBadges()
    expect(document.getElementById('atNC-autoUpgrade')).toBeTruthy()
  })

  it('never touches the anchor&rsquo;s own onmouseover', () => {
    document.getElementById('autoUpgradeBtn')!.setAttribute('onmouseover', 'tooltip("AutoUpgrade", null, event)')
    armAutoUpgrade()
    syncConflictBadges()
    expect(document.getElementById('autoUpgradeBtn')!.getAttribute('onmouseover')).toBe('tooltip("AutoUpgrade", null, event)')
  })

  it('gives the badge its own escaped tooltip handler', () => {
    armAutoUpgrade()
    syncConflictBadges()
    const attr = document.getElementById('atNC-autoUpgrade')!.getAttribute('onmouseover')!
    expect(attr.startsWith('tooltip("')).toBe(true)
    expect(attr).toContain('customText')
    // #110: an unescaped quote would leave the handler uncompilable. No BARE quote may survive
    // inside the argument text — every " in the body must be preceded by a backslash.
    const inner = attr.slice('tooltip('.length, -1)
    expect(inner.replace(/\\"/g, '')).not.toMatch(/"[^,)]*"[^,)]*"/)
  })

  it('adds no color* class to the game element (swapClass owns that namespace)', () => {
    armAutoUpgrade()
    syncConflictBadges()
    const cls = document.getElementById('autoUpgradeBtn')!.className
    expect(cls).not.toMatch(/\bcolor/)
  })

  it('removeConflictBadges clears every badge and the style block', () => {
    armAutoUpgrade()
    syncConflictBadges()
    removeConflictBadges()
    expect(document.querySelectorAll('.at-nc-badge').length).toBe(0)
    expect(document.getElementById('at-nc-style')).toBeNull()
  })

  it('a missing anchor is survivable, not fatal', () => {
    armAutoUpgrade()
    document.getElementById('autoUpgradeBtn')!.remove()
    expect(() => syncConflictBadges()).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/native-conflict-badges.test.ts`
Expected: FAIL — cannot resolve `../src/modules/native-conflict-badges`.

- [ ] **Step 3: Write the renderer**

Create `src/modules/native-conflict-badges.ts`:

```ts
// #150 — renders the conflict matrix as ⚠ badges beside the native buttons.
//
// THREE THINGS THIS FILE MUST KEEP DOING, each learned the hard way:
//  1. The badge is a SIBLING of the anchor. toggleAutoStorage/toggleAutoUpgrades/toggleAutoPrestiges
//     each assign `elem.innerHTML = "<label>"` on every click (main.js:18379/:18416/:18432) — a child
//     badge is destroyed the first time the player clicks the button it is warning about.
//  2. It never touches the anchor's own `onmouseover`. All five native buttons already carry the
//     game's own tooltip (index.html:440-492); overwriting it would trade one explanation for another.
//  3. It syncs, it does not mount-once. The game writes `style.display` on the BUTTONS at load and on
//     Bone Shrine level changes (main.js:1221-1231, updates.js:4279-4286/:4804-4808) and never touches
//     a sibling — so visibility has to be re-read, exactly like custom-ui's syncRegion().
import { CONFLICTS, activeConflicts } from './native-conflicts'
import { tooltipAttr } from './settings-engine'

const STYLE_ID = 'at-nc-style'
const BADGE_CLASS = 'at-nc-badge'
const ID_PREFIX = 'atNC-'

function ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    // A compact strip under the button. Deliberately NOT positioned/absolute: the game's own
    // containing blocks are its business, and a 0.65vw line inside the existing bootstrap cell
    // cannot reflow anything outside it.
    style.textContent = [
        '.' + BADGE_CLASS + '{display:block;text-align:center;font-size:0.65vw;line-height:1.3;',
        'cursor:help;color:#f0ad4e;font-weight:bold;white-space:nowrap;overflow:hidden}',
    ].join('')
    document.head.appendChild(style)
}

/** Visible = the game has not hidden it. The game hides these buttons via inline `display:none`. */
function anchorVisible(anchor: HTMLElement): boolean {
    return anchor.style.display !== 'none'
}

function buildBadge(key: string): HTMLElement {
    const el = document.createElement('span')
    el.id = ID_PREFIX + key
    el.className = BADGE_CLASS
    // The game ships Bootstrap's glyphicon font (css/bootstrap.css:610), so this needs no new asset
    // and matches the surrounding chrome rather than importing an emoji into the HUD.
    el.innerHTML = '<span class="glyphicon glyphicon-warning-sign"></span> AT conflict'
    el.setAttribute('onmouseout', 'tooltip("hide")')
    return el
}

/**
 * Idempotent sweep: mount a badge for every live conflict whose anchor is visible, refresh the hover
 * copy of those already mounted (the text names the universe-correct setting, and the universe can
 * change under us), and unmount the rest.
 */
export function syncConflictBadges(): void {
    ensureStyle()
    const live = new Set(activeConflicts().map((c) => c.key))
    for (const c of CONFLICTS) {
        const existing = document.getElementById(ID_PREFIX + c.key)
        const anchor = document.getElementById(c.anchorId)
        const wanted = live.has(c.key) && !!anchor && anchorVisible(anchor) && !!anchor.parentElement
        if (!wanted) {
            existing?.remove()
            continue
        }
        const badge = existing ?? buildBadge(c.key)
        // Recomposed every sweep so the copy can never go stale against the live universe.
        badge.setAttribute('onmouseover', tooltipAttr(c.title, c.body()))
        if (!existing) anchor!.parentElement!.insertBefore(badge, anchor!.nextSibling)
    }
}

export function removeConflictBadges(): void {
    for (const c of CONFLICTS) document.getElementById(ID_PREFIX + c.key)?.remove()
    document.getElementById(STYLE_ID)?.remove()
}
```

- [ ] **Step 4: Run the tests green**

Run: `npx vitest run tests/native-conflict-badges.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Prove the badge tooltip actually COMPILES, the way the settings net does**

Append to `tests/native-conflict-badges.test.ts`:

```ts
import { transformSync } from 'esbuild'

// The #110 lesson mechanized: an unescaped quote leaves onmouseover uncompilable, the browser sets
// it to null, and NOTHING throws. jsdom raises an uncaught SyntaxError when you read a broken
// handler, so parse the source text with esbuild instead — the same route settings-tooltips uses.
describe('every conflict body yields a COMPILABLE handler (#110)', () => {
  it('parses as JS for all 7 rows, in both universes', () => {
    for (const universe of [1, 2]) {
      fixture()
      ;(globalThis as any).game.global.universe = universe
      for (const c of CONFLICTS) {
        const attr = tooltipAttr(c.title, c.body())
        expect(() => transformSync(attr, { loader: 'js' })).not.toThrow()
      }
    }
  })
})
```

Add the two imports at the top of the file: `import { CONFLICTS } from '../src/modules/native-conflicts'` and `import { tooltipAttr } from '../src/modules/settings-engine'`.

Run: `npx vitest run tests/native-conflict-badges.test.ts`
Expected: PASS. **Mutation-check it:** temporarily add a raw `"` to one `body()` string in `native-conflicts.ts` — no, that would still escape correctly, which is the point. Instead prove the net can fail by temporarily replacing `tooltipAttr(...)` in the test with `'tooltip("' + c.title + '", "customText", event, "' + c.body() + '")'` and inserting a raw `"` into one body: the test must go RED. Revert both.

- [ ] **Step 6: Commit**

```bash
git add src/modules/native-conflict-badges.ts tests/native-conflict-badges.test.ts
git commit -m "feat(#150): render conflict advisories as sibling badges"
```

---

### Task 4: Wire it up — ambient decls, the setting, the guiLoop hook

**Files:**
- Modify: `src/game/trimps.d.ts` (after line 87, beside `toggleAutoStorage`)
- Modify: `src/modules/settings-defs.ts` (in the `"Core"` container, immediately after the `ATCustomUI` createSetting at line ~26)
- Modify: `src/modules/main-loop.ts:593-604` (`guiLoop`)
- Modify: `tests/__snapshots__/*settings*` + the inline settings-inventory count (see Step 5)

**Interfaces:**
- Consumes: `syncConflictBadges`, `removeConflictBadges` (Task 3).
- Produces: the setting id `WarnNativeAutomationConflicts` (boolean, default `true`), read only by the guiLoop hook.

- [ ] **Step 1: Declare the two game functions the matrix calls**

In `src/game/trimps.d.ts`, immediately after the `toggleAutoStorage` line:

```ts
  // #150 — the game's universe-aware resolvers for the AutoStructure / AutoJobs masteries
  // (main.js:18026, :18046). Read-only from AT: the conflict matrix asks whether they are enabled.
  function getAutoStructureSetting(): { enabled: boolean }
  function getAutoJobsSetting(): { enabled: boolean }
```

Run: `npm run typecheck >/dev/null 2>&1; echo TSC=$?` → expect `TSC=0`.

- [ ] **Step 2: Confirm the id is safe to mint (this is not optional)**

Re-minting a previously-deleted setting id resurrects the user's old localStorage value (#68). Prove the id has never existed:

```bash
git log --all -S"createSetting.*WarnNativeAutomationConflicts" --oneline
```
Expected: **empty output.** Any hit means the id was used before — stop and pick a different name.

- [ ] **Step 3: Mint the setting**

In `src/modules/settings-defs.ts`, directly after the `ATCustomUI` block:

```ts
    // #150 — advisory only: AT never changes a native toggle or one of your settings. Default ON,
    // deliberately: a warning nobody sees is worth nothing, and this setting cannot move a single
    // game action (it only renders a badge), so ON is still trace-neutral.
    createSetting('WarnNativeAutomationConflicts', 'Warn: Auto Conflicts', tip({
        what: "Shows a yellow warning beside the game's own AutoPrestige / AutoUpgrade / AutoStructure / AutoJobs / AutoStorage buttons when their setting fights AutoTrimps' automation.",
        how: 'Hover the warning to read what AT does instead, why, and the one setting to change. It also warns in the other direction: AutoStorage off once you own Auspicious Presence Part II (overflow is being wasted), and Hide Buildings / Hide Jobs left on while the mastery they hand off to is off (nothing is buying at all).',
        cannot: 'Cannot change anything on its own — it never touches a game toggle or one of your AT settings. Every fix is yours to make.'
    }), 'boolean', true, null, "Core");
```

- [ ] **Step 4: Hook the sweep into guiLoop**

In `src/modules/main-loop.ts`, add the import beside the existing `bootCustomUI` import:

```ts
import { syncConflictBadges, removeConflictBadges } from './native-conflict-badges'
```

and add a fifth guarded statement inside `guiLoop()`:

```ts
    // #150 — 1/s is plenty for an advisory, and guiLoop already owns the atGuard boundary so a
    // throw here cannot cost the other GUI work (#87). OFF removes the badges once and stays quiet.
    atGuard('nativeConflictBadges', function () {
        if (getPageSetting('WarnNativeAutomationConflicts')) syncConflictBadges();
        else removeConflictBadges();
    });
```

- [ ] **Step 5: Update the settings-inventory dual snapshot**

A new `createSetting` moves BOTH a `.snap` file and an inline `toMatchInlineSnapshot` count; committing only one gives local-green / CI-red and blocks the deploy.

Run: `npx vitest run tests/settings-inventory.test.ts -u` (adjust the filename if it differs — find it with `grep -rln "settings-inventory\|settings inventory" tests/`)
Then run without `-u`: `npx vitest run tests/settings-inventory.test.ts`
Expected: PASS, and `git status` shows **both** the `.snap` and the `.ts` modified.

- [ ] **Step 6: Run the settings nets**

Run: `npx vitest run tests/nets/ >/dev/null 2>&1; echo NETS=$?`
Expected: `NETS=0`. The ones that have an opinion here: `settings-wired` (the new id must be READ somewhere — the guiLoop hook satisfies it), `settings-types`, `settings-tooltips`, `settings-tooltip-census`, `settings-overwritten`, `settings-reverse`, `mainloop-guarded` (the new statement must be inside an `atGuard`), `dom-ids`. If `dom-ids` flags the badge ids: the lookups use a template literal, which its `runtimeAssignedIds` / lookup collectors only handle for plain string literals — the same shape as `custom-ui`'s existing `atRT-${r}` ids, so it should be silent. If it *does* flag them, register them the way the net's derived sources expect; do not add an allowlist entry.

- [ ] **Step 7: Full gates + regenerate the byte golden**

```bash
npm run typecheck >/dev/null 2>&1; echo TSC=$?
npm run lint >/dev/null 2>&1; echo LINT=$?
npx vitest run > /tmp/at-150-tests.log 2>&1; echo TESTS=$?
```
Expected: `TSC=0 LINT=0`. `TESTS` will be **non-zero** with exactly one failure — `src-bundle-parity`, because `src/` legitimately changed. Confirm from the log that it is the only failure, then:

```bash
node scripts/regen-src-golden.mjs --reason "#150: native-automation conflict advisory badges (new native-conflicts + native-conflict-badges modules, tooltipAttr seam, WarnNativeAutomationConflicts setting, guiLoop hook)"
npx vitest run > /tmp/at-150-tests2.log 2>&1; echo TESTS=$?
```
Expected: `TESTS=0`.

- [ ] **Step 8: Prove the L0 proof net is untouched**

Run: `npx vitest run tests/sim/baseline-zero.test.ts >/dev/null 2>&1; echo L0=$?`
Expected: `L0=0`. This is the load-bearing check that the feature is advisory: the badge renders DOM and reads state, so **zero** trace events may move even with the setting ON. A red here means something mutated game state — find it, do not re-record the oracle.

- [ ] **Step 9: Commit**

```bash
git add src/game/trimps.d.ts src/modules/settings-defs.ts src/modules/main-loop.ts tests/
git commit -m "feat(#150): WarnNativeAutomationConflicts setting + guiLoop badge sweep"
```

---

### Task 5: The completeness net

The fear to mechanize: a future native automation gets added (or an anchor id is typo'd) and the advisory silently covers nothing.

**Files:**
- Create: `tests/nets/native-conflicts-completeness.test.ts`

**Interfaces:**
- Consumes: `CONFLICTS` (Task 2).
- Produces: nothing.

- [ ] **Step 1: Write the net**

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CONFLICTS } from '../../src/modules/native-conflicts'

// The SHA-PINNED clone (repo-root .trimps-game/), which npm ci materializes and which exists on CI —
// NOT ../trimps-game (the dev workspace), which is absent on the runner (#67 hole).
const html = readFileSync(resolve(process.cwd(), '.trimps-game/index.html'), 'utf8')
const settingsDefs = readFileSync(resolve(process.cwd(), 'src/modules/settings-defs.ts'), 'utf8')

// Every native automation button the game ships. A row is required for each: if the game gains a
// sixth, this list gains an entry and the net demands the matrix explain it.
const NATIVE_BUTTONS = [
  'autoPrestigeBtn',
  'autoUpgradeBtn',
  'autoStructureBtn',
  'autoJobsBtn',
  'autoStorageBtn',
]

describe('native-conflict advisory completeness (#150)', () => {
  it('every native automation button has at least one conflict row', () => {
    const anchored = new Set(CONFLICTS.map((c) => c.anchorId))
    for (const id of NATIVE_BUTTONS) expect(anchored.has(id)).toBe(true)
  })

  it('every anchor resolves — a game id in the clone, or an AT setting id', () => {
    for (const c of CONFLICTS) {
      const inGame = new RegExp(`id=["']${c.anchorId}["']`).test(html)
      const isSetting = settingsDefs.includes(`createSetting('${c.anchorId}'`)
      expect(inGame || isSetting, `${c.anchorId} anchors nothing`).toBe(true)
    }
  })

  it('each row explains itself — heading, a real body, and a recommendation', () => {
    for (const c of CONFLICTS) {
      expect(c.title.trim().length, c.key).toBeGreaterThan(10)
      const body = c.body()
      expect(body.length, c.key).toBeGreaterThan(80)
      // A conflict the player cannot act on is a scold, not an advisory.
      expect(body, c.key).toContain('Recommended')
    }
  })

  it('the matrix is advisory-only: no assignment to game state in the source', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/modules/native-conflicts.ts'), 'utf8')
    expect(src).not.toMatch(/game\.global\.[A-Za-z]+\s*=[^=]/)
    expect(src).not.toMatch(/\bsetPageSetting\b/)
    expect(src).not.toMatch(/\btoggleAuto[A-Za-z]*\s*\(/)
  })
})
```

- [ ] **Step 2: Run it green**

Run: `npx vitest run tests/nets/native-conflicts-completeness.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 3: Mutation-check that the net can actually go RED**

A net that cannot fail is not a net (CLAUDE.md, three times over). Break each assertion on purpose, one at a time, confirm red, revert:

1. Add `'autoTrapBtn'` to `NATIVE_BUTTONS` → expect RED on "every native automation button has at least one conflict row". Revert.
2. In `native-conflicts.ts`, change one `anchorId` to `'autoUpgradeBtnn'` → expect RED on "every anchor resolves". Revert.
3. Add `game.global.autoStorage = true` inside any `when()` → expect RED on "advisory-only". Revert.

Run after each: `npx vitest run tests/nets/native-conflicts-completeness.test.ts`. Record the three observed failures in the commit body.

- [ ] **Step 4: Commit**

```bash
git add tests/nets/native-conflicts-completeness.test.ts
git commit -m "test(#150): completeness net for the conflict advisory matrix"
```

---

### Task 6: Live verification in Chrome (fresh save AND deep save)

Automated green is necessary and not sufficient — and this feature's whole surface is *visual*, gated on *unlocks*.

**Files:** none (verification only; fixes land as follow-up commits on the same branch).

- [ ] **Step 1: Build and serve**

```bash
npm run build >/dev/null 2>&1; echo BUILD=$?
npm run serve
```
Expected: `BUILD=0`, server on `http://localhost:8080/`. Start it **before** handing the URL over.

- [ ] **Step 2: Deep save — every anchor exists, badges appear and clear**

Open `http://localhost:8080/` on a save deep enough to have the rewards (z60+ for AutoUpgrade, Bone Shrine level 4 for AutoPrestige). Confirm, via Chrome DevTools MCP (never the Claude app preview panel):

1. Console is clean.
2. With everything compatible: `document.querySelectorAll('.at-nc-badge').length === 0`.
3. Turn native **AutoPrestige** to `All` → within ~1s a yellow badge appears under the button; hover shows the heading and the Armor/Weapons recommendation; the game's own AutoPrestige tooltip still works on the button itself.
4. Set AT `Armor: Levels` + `Weapons: Levels` → badge disappears within ~1s.
5. Click the native button repeatedly → the badge survives every `innerHTML` rewrite (the Task 3 regression, confirmed live).
6. `document.querySelectorAll('[id^="atNC-"]').length` equals the number of visible badges — **no duplicate ids**.
7. Turn the AT setting `Warn: Auto Conflicts` off → all badges vanish; on → they return.

- [ ] **Step 3: Fresh save — the unlock path (this is where the last two UI bugs hid)**

Back up `trimpSave1`, clear localStorage to zone 1, and watch the buttons unlock. Two things to confirm:

1. **No badge is mounted beside a hidden button.** Pre-unlock, `autoUpgradeBtn`/`autoPrestigeBtn`/`autoStorageBtn` carry `display:none`; assert `document.getElementById('atNC-autoUpgrade') === null` while `getComputedStyle(document.getElementById('autoUpgradeBtn')).display === 'none'`.
2. **A badge appears when the game reveals the button**, without a page reload — the sweep is what makes this work, and mount-once would fail exactly here.

Restore the backed-up save afterwards.

- [ ] **Step 4: Confirm the badge does not make the HUD jump under the cursor**

The badge adds a ~0.65vw line inside an existing bootstrap cell. Screenshot the Buildings/Jobs title rows with and without a badge and compare: if the row height visibly jumps and moves the buttons beside it, switch the badge to `float:right;margin-left:4px` inside the same cell (one edit, in `ensureStyle`) and re-verify. Report the measured before/after heights rather than eyeballing it.

- [ ] **Step 5: Send the user the screenshots**

MCP screenshots are returned to the model only. Use `SendUserFile` with the actual PNG paths, and name the file paths on their own lines — never write "shown above".

- [ ] **Step 6: Fresh-eyes code review**

Dispatch a reviewer agent with **no implementation context** (`feature-dev:code-reviewer`) over the branch diff. Brief it specifically on: the sibling-vs-child invariant, the `Number(...) > 0` phantom-conflict rule (#68), whether any `when()` can mutate, whether any anchor id is wrong, and whether the U2 gates read the right settings. Fix what it finds; re-run the full gates.

- [ ] **Step 7: Final gate sweep, by exit code**

```bash
npm run typecheck >/dev/null 2>&1; echo TSC=$?
npm run lint >/dev/null 2>&1; echo LINT=$?
npm run test:ci > /tmp/at-150-final.log 2>&1; echo TESTS=$?
npm run build >/dev/null 2>&1; echo BUILD=$?
```
Expected: all `=0`. Read the log file for the count; never pipe to `tail` and read its status.

- [ ] **Step 8: Hand off for user verification**

Surface the full clickable URL on its own line, name what to look at (the Buildings and Jobs title rows, the AutoUpgrade/AutoPrestige buttons in the settings panel), and **wait for explicit approval before the FF-merge**. Squash the branch into one commit at merge time, then delete both ends of the branch as the final step of the merge.

---

## Self-Review

**Spec coverage** — all seven rows of #150's matrix are implemented in Task 2 (five native anchors + the two orphan advisories); all six implementation constraints from the issue map to code: sibling insert (Task 3 Step 3 + its regression test), untouched `onmouseover` (Task 3 test), escaping seam (Task 1), per-tick sync (Task 4 Step 4), no `color*` class (Task 3 test), universe-awareness (Task 2's four `at*` gates + the U2 test). The issue's open question (default ON/OFF) is resolved to **ON** in Task 4 Step 3 with the reason stated in the code comment.

**Placeholders** — none; every code step carries the literal code, every run step the literal command and expected result.

**Type consistency** — `NativeConflict` fields (`key`, `anchorId`, `title`, `when`, `body`) are used identically in Tasks 2, 3 and 5; `tooltipAttr(label, body)` has one signature across Tasks 1, 3 and 5; badge id `atNC-<key>` and class `at-nc-badge` are spelled the same in the module and both tests.

**Known deviations from the plan's own defaults** — Task 2 Step 5 will fail `tsc` unless Task 4 Step 1 (the two ambient declarations) runs first. That ordering is called out inline rather than reshuffled, because the declarations belong with the wiring task.
