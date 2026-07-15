# Graphs.js → src/ + ECharts Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `legacy/Graphs.js` to a typed `src/modules/graphs/` module and replace Highcharts with Apache ECharts, at strict feature parity plus #131 (bigger text + data export).

**Architecture:** A directory module split across a pure/impure boundary — pure `types`/`transforms`/`graph-defs`/`option-builder` (no DOM/`game`/`echarts` runtime) and impure `gamedata`/`storage`/`render`. The library swap touches only the option-builder output shape and the render shell; capture and math port byte-faithfully. Pure layers land and are unit-tested first, before ECharts ever loads.

**Tech Stack:** TypeScript (strict), Vite/esbuild bundle, vitest (`node` env), Apache ECharts 5.6.0 (CDN UMD, pinned + SRI), `chrome-devtools-mcp` for render verification.

**Design spec:** `docs/superpowers/specs/2026-07-14-graphs-echarts-port-design.md` (read it first).

## Global Constraints

- **Copy transform math VERBATIM** from `legacy/Graphs.js` — transcription is the project's #1 conversion risk. Refactor only after tests are green.
- **ECharts pinned + SRI:** `https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js`, with `integrity="sha384-…"` + `crossOrigin="anonymous"`. Never `@latest`. Global is `window.echarts`.
- **Never bundle ECharts** (avoids the Highcharts #16 double-define class of problem) — CDN-inject at runtime, single registration.
- **No pure file may import an impure one** or reference `document|window|game.|localStorage|echarts.` — enforced by a net.
- **Byte-parity applies** to `transforms.ts`/`gamedata.ts`/`storage.ts` (unchanged math/IO), **NOT** to `option-builder.ts` (a re-expression; covered by unit tests + Chrome).
- **`bootGraphs()` runs LAST in `main.ts`, after `seedModuleDefaults()`** — never auto-run on module eval.
- **Do not change gameplay/tuning numbers.** Faithful port only.
- **Verify gates by EXIT CODE**, never `| grep`/`| tail`: `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test:ci` (redirect to a file, read `$?`).
- Work on branch `feature/graphs-echarts-port` (already created).

---

## File structure

```text
src/modules/graphs/
  types.ts          PURE   interfaces
  transforms.ts     PURE   number-in/number-out math (verbatim from legacy)
  graph-defs.ts     PURE   GRAPH_LIST + TOGGLE_RULES
  option-builder.ts PURE   buildLineOption / buildColumnOption / baseOption
  gamedata.ts       IMPURE getGameData, Portal, pushData, getportalID
  storage.ts        IMPURE safeLocalStorage, savePortalData, loadGraphData, saveSetting, clearData, deleteSpecific
  render.ts         IMPURE createUI, drawGraph, updateGraph, selectors, load guard, theme, legend policy, wrappers, bootGraphs
  index.ts          barrel — exports bare globals only
src/game/echarts.d.ts  ambient echarts global
tests/graphs/          unit tests (node env)
tests/nets/graphs-purity.test.ts  purity boundary net
```

---

## Task 1: Scaffold module + types + purity net (no behavior yet)

**Files:**
- Create: `src/modules/graphs/types.ts`, `src/modules/graphs/index.ts`, `src/game/echarts.d.ts`
- Create: `tests/nets/graphs-purity.test.ts`

**Interfaces:**
- Produces: all interfaces in the spec (`PortalData`, `PerZoneData`, `GraphDef`, `ColumnDef`, `GraphSettings`, `ToggleId`, `ToggleRule`, `GameDataReader`). Copy the exact shapes from the design spec's Architecture section.

- [ ] **Step 1: Write the purity net (failing — files don't exist yet)**

```ts
// tests/nets/graphs-purity.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const PURE = ['types.ts', 'transforms.ts', 'graph-defs.ts', 'option-builder.ts']
const FORBIDDEN = /\b(document|window|localStorage|echarts)\b|\bgame\./

describe('graphs purity boundary', () => {
  for (const f of PURE) {
    it(`${f} references no impure globals`, () => {
      const src = readFileSync(resolve('src/modules/graphs', f), 'utf8')
        .replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '') // strip comments
      expect(src).not.toMatch(FORBIDDEN)
    })
  }
})
```

- [ ] **Step 2: Run it, expect FAIL** (`ENOENT` — files absent). `npx vitest run tests/nets/graphs-purity.test.ts`
- [ ] **Step 3: Create `types.ts`** with every interface from the spec (verbatim). Create `graph-defs.ts`/`option-builder.ts`/`transforms.ts` as empty stubs (`export {}`) so the net can read them. Create `echarts.d.ts`: `declare const echarts: typeof import('echarts')`. Create `index.ts` empty barrel.
- [ ] **Step 4: Run the net, expect PASS.**
- [ ] **Step 5: Run `npm run typecheck`, expect exit 0.**
- [ ] **Step 6: Commit** — `git commit -m "feat(graphs): scaffold module + purity net"`

---

## Task 2: Port the transform layer (byte-faithful) + unit tests

This is the bug-dense layer (the ~6 documented fenceposts). Copy each expression **verbatim** from `legacy/Graphs.js`, then test hard.

**Files:**
- Modify: `src/modules/graphs/transforms.ts`
- Create: `tests/graphs/transforms.test.ts`

**Interfaces:**
- Produces: `formatDuration(seconds)`, `diff(dataVar, initial?)`, `perZone(portal,item,index)→[x,time]`, `perHr(x,time)`, `lifetime(portal,item,x)`, `s3normalized(x,portalS3,maxS3)`, `accumulate(prevY,x)`, `maxS3Of(portals)`.

- [ ] **Step 1: Write failing tests** covering the fencepost cases:

```ts
import { describe, it, expect } from 'vitest'
import { formatDuration, diff } from '../../src/modules/graphs/transforms'

describe('formatDuration', () => {
  it('d/h/m/s form', () => expect(formatDuration(90061)).toBe('1d 1h 1m 1s '))
  it('sub-second x.ys form when <=1 unit', () => expect(formatDuration(3.4)).toBe('3.4s'))
})
describe('diff (1-indexed hole at [0])', () => {
  const portal = { perZoneData: { helium: [undefined, 10, 30] } } as any
  it('returns null at the first index (guards undefined, not just null)', () =>
    expect(diff('helium')(portal, 1)).toBeNull())
  it('returns delta afterwards', () => expect(diff('helium')(portal, 2)).toBe(20))
})
```

- [ ] **Step 2: Run, expect FAIL** (functions undefined).
- [ ] **Step 3: Port all transforms verbatim** from legacy (`formatDuration` L42, `diff` L139 — with the `== null` guard already fixed in Phase 1, `toggledGraphs.*.transform` bodies L948+ split into `perZone`/`perHr`/`lifetime`/`s3normalized`, the accumulator L501, `maxS3` L469). Type them; keep the arithmetic identical.
- [ ] **Step 4: Run tests, expect PASS.**
- [ ] **Step 5: Mutation-check** — restore `=== null` in `diff`, rerun, confirm the "returns null at first index" test goes RED, then revert.
- [ ] **Step 6: Commit** — `git commit -m "feat(graphs): port transform layer with fencepost tests"`

---

## Task 3: Port graph-defs (GRAPH_LIST + TOGGLE_RULES) + contract snapshot

**Files:**
- Modify: `src/modules/graphs/graph-defs.ts`
- Create: `tests/graphs/graph-defs.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `transforms.ts`.
- Produces: `GRAPH_LIST: GraphDef[]`, `TOGGLE_RULES: Record<ToggleId, ToggleRule>`.

- [ ] **Step 1: Write a failing snapshot test** asserting the ordered id list + which graphs carry toggles/columns/conditionals (the persistence contract — a dropped/reordered def silently breaks stored selections):

```ts
import { GRAPH_LIST } from '../../src/modules/graphs/graph-defs'
it('graph id/order contract', () => {
  expect(GRAPH_LIST.map(g => g.id)).toMatchInlineSnapshot() // fill on first run
})
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Port `graphList` (L844) + `toggledGraphs` (L948)** verbatim into `GRAPH_LIST`/`TOGGLE_RULES`, wiring `customFunction`s to the `transforms.ts` functions. `conditional` takes a `GameDataReader` arg (do NOT reference `game` directly). Map `yType:'Logarithmic'→'log'`, `'Linear'→'value'`, `'datetime'→'value'` (+ duration formatter flag).
- [ ] **Step 4: Run, fill the inline snapshot, expect PASS.**
- [ ] **Step 5: `npm run typecheck`, expect exit 0.**
- [ ] **Step 6: Commit** — `git commit -m "feat(graphs): port graph defs + toggle rules"`

---

## Task 4: The option builders (the seam) + structural-invariant tests

**Files:**
- Modify: `src/modules/graphs/option-builder.ts`
- Create: `tests/graphs/option-builder.line.test.ts`, `tests/graphs/option-builder.column.test.ts`
- Add dev dependency: `echarts` (type-only: `import type { EChartsOption }`; erased at build).

**Interfaces:**
- Consumes: `types`, `transforms`, `graph-defs`.
- Produces: `buildLineOption(graph, portals, settings): EChartsOption`, `buildColumnOption(graph, portals, settings): EChartsOption`.

- [ ] **Step 1: `npm i -D echarts@5.6.0`** (types + the runtime for the optional SSR test; the bundle uses the CDN global, not this import).
- [ ] **Step 2: Write failing line-builder tests** — assert NARROW invariants only (never a whole-object snapshot):

```ts
import { buildLineOption } from '../../src/modules/graphs/option-builder'
// hand-build 2 portals with explicit perZoneData for 'helium'
it('one line series per portal, reversed, capped, named', () => {
  const opt = buildLineOption(heliumDef, [pA, pB], settings)
  expect(opt.series).toHaveLength(2)
  expect((opt.series as any)[0].type).toBe('line')
  expect((opt.series as any)[0].name).toMatch(/^Portal \d+: /)
})
it('#131: dataView + saveAsImage in toolbox, bigger font', () => {
  const opt = buildLineOption(heliumDef, [pA], settings)
  expect((opt.toolbox as any).feature.dataView).toBeDefined()
  expect((opt.textStyle as any).fontSize).toBeGreaterThanOrEqual(14)
})
```

- [ ] **Step 3: Run, expect FAIL.**
- [ ] **Step 4: Implement `baseOption` + `buildLineOption`** porting `createHighChartsObj`/`lineGraph` to the option shape in the spec (series/xAxis/yAxis/legend/tooltip/dataZoom/toolbox/textStyle; apply active toggles via `TOGGLE_RULES[t].graphMods`; universe filter; `portalsDisplayed` cap; reverse; `x<0→null` + `typeCheck` null-ing).
- [ ] **Step 5: Write + run failing column-builder tests** — `yAxis` length = active columns, `series[k].yAxisIndex===k`, `xAxis.type==='category'` (the friction fix), universe filter picks helium(u1)/radon(u2), `perHr` drops `currentTime`.
- [ ] **Step 6: Implement `buildColumnOption`** (multi-`yAxisIndex` bar, category x-axis).
- [ ] **Step 7: Run all builder tests, expect PASS. `npm run typecheck` exit 0.**
- [ ] **Step 8: Commit** — `git commit -m "feat(graphs): ECharts option builders + invariant tests"`

---

## Task 5: Port gamedata (capture) + overkill-no-mutation test

**Files:**
- Modify: `src/modules/graphs/gamedata.ts`
- Create: `tests/graphs/gamedata.test.ts`

**Interfaces:**
- Consumes: `types`, `transforms`.
- Produces: `getGameData` (reader object), `Portal`, `pushData`, `getportalID`.

- [ ] **Step 1: Write failing test** asserting the Phase-1 invariant survives the port — `overkill()` counts `gridArray`/`.overkilled` and does NOT call `toggleSetting`:

```ts
it('overkill() reads grid .overkilled and never mutates overkillColor', () => {
  const g:any = { global:{ mapsActive:false, gridArray:[{overkilled:true},{overkilled:false},{overkilled:true}] },
    options:{menu:{overkillColor:{enabled:0}, liquification:{enabled:false}}}, talents:{liquification:{purchased:false}} }
  ;(globalThis as any).game = g
  expect(getGameData.overkill()).toBe(2)
  expect(g.options.menu.overkillColor.enabled).toBe(0) // unchanged
})
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Port `getGameData` (L769, incl. the Phase-1 overkill fix), `Portal` (L699), `pushData` (L754), `getportalID`** verbatim. Cross-check accessors against `../trimps-game` (all confirmed present in the Phase-1 hunt).
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(graphs): port data capture layer"`

---

## Task 6: Port storage + port the corrupt-key robustness suite

**Files:**
- Modify: `src/modules/graphs/storage.ts`
- Modify: `tests/graphs.robustness.test.ts` → re-target at `storage.loadGraphData` (drop the `eval(GRAPHS_SRC)` boot)

**Interfaces:**
- Consumes: `types`, `gamedata` (`Portal`), `graph-defs`.
- Produces: `safeLocalStorage`, `savePortalData`, `loadGraphData`, `saveSetting`, `clearData`, `deleteSpecific`, `GRAPHSETTINGS`.

- [ ] **Step 1: Rewrite `graphs.robustness.test.ts`** to call `loadGraphData` directly with an injected fake `localStorage` + `LZString` (corrupt history / currentPortal / GRAPHSETTINGS → no throw, starts fresh). Keep the mutation-check discipline.
- [ ] **Step 2: Run, expect FAIL** (module functions absent).
- [ ] **Step 3: Port `safeLocalStorage`/`savePortalData`/`loadGraphData`/`saveSetting`/`clearData`/`deleteSpecific`** verbatim, carrying the Phase-1 quota + corrupt-load fixes.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(graphs): port storage layer + robustness tests"`

---

## Task 7: Render shell — ECharts load guard, draw, selectors, theme, legend policy, wrappers, bootGraphs

**Files:**
- Modify: `src/modules/graphs/render.ts`, `src/modules/graphs/index.ts` (export bare globals)

**Interfaces:**
- Consumes: `option-builder`, `storage`, `gamedata`, `graph-defs`, `types`, ambient `echarts`.
- Produces (bare globals via `index.ts`): `drawGraph`, `updateGraph`, `swapGraphUniverse`, `saveSetting`, `clearData`, `deleteSpecific`, `toggleClearButton`, `toggleDarkGraphs`, `toggleSpecificGraphs`, `toggleAllGraphs`, `escapeATWindows`, `bootGraphs`.

- [ ] **Step 1:** Port `createUI` (L172) but inject the **pinned+SRI ECharts** `<script>` (not Highcharts) with a load guard (`echarts` ready before first `init`; opening Graphs early must not throw).
- [ ] **Step 2:** Port `drawGraph`/`updateGraph` to call the pure builders + `echarts.init`/`setOption({notMerge:true})`; `toggleDarkGraphs` → `dispose()` + `init(dom, dark?'dark':undefined)` + `setOption`.
- [ ] **Step 3:** Legend policy — `chart.on('legendselectchanged', …)` writes `settings.rememberSelected` (name→bool) + `saveSetting()`; `toggleAll/Specific`/invert via `dispatchAction`.
- [ ] **Step 4:** Port `swapGraphUniverse`, `showHideUnusedGraphs`, selectors, `escapeATWindows`, Esc listener, and the four game-function wrappers (`nextWorld`/`activatePortal`/`buildMapGrid`/`mapsSwitch`). Add `bootGraphs()` that runs the load sequence.
- [ ] **Step 5:** `index.ts` exports exactly the bare-global list above.
- [ ] **Step 6:** `npm run typecheck` exit 0; `npm run lint` exit 0.
- [ ] **Step 7: Commit** — `git commit -m "feat(graphs): ECharts render shell + bootGraphs"`

---

## Task 8: Wire the bundle — bridge, main.ts, MANIFEST, supply-chain net

**Files:**
- Modify: `src/legacy-bridge.ts` (add `import * as graphs` + `...graphs` spread)
- Modify: `src/main.ts` (call `bootGraphs()` as the final statement, after `seedModuleDefaults()`)
- Modify: `scripts/build-userscript.mjs` (remove `'Graphs.js'` from `MANIFEST`; update comment)
- Delete: `legacy/Graphs.js`
- Modify: `tests/nets/supply-chain.test.ts` (swap `code.highcharts.com` → pinned ECharts origin; assert SRI present), `tests/nets/reachability.test.ts` + `tests/build-userscript.test.ts` (new reachability roots for `drawGraph` etc.)

- [ ] **Step 1:** Make the bridge + main.ts + MANIFEST edits; delete `legacy/Graphs.js`.
- [ ] **Step 2:** Update `supply-chain`, `reachability`, `build-userscript` nets.
- [ ] **Step 3: `npm run build`** exit 0; grep the built bundle for `echarts@5.6.0` + `integrity=` and confirm no `code.highcharts.com`.
- [ ] **Step 4: `npm run test:ci`** (redirect to file, read `$?`) — expect exit 0, 0 skipped.
- [ ] **Step 5: Commit** — `git commit -m "feat(graphs): swap bundle to src module + ECharts, delete legacy Graphs.js"`

---

## Task 9: Chrome verification (render shell — the part unit tests can't reach)

**Files:** none (verification only). Use `chrome-devtools-mcp`.

- [ ] **Step 1:** `npm run build && npm run serve`; open `http://localhost:8080/`.
- [ ] **Step 2:** Open Graphs BEFORE ECharts resolves (hard reload + immediate click) → no throw, renders on ready (load-guard check). Console clean.
- [ ] **Step 3:** Select each universe's graphs; verify line charts render with one series per portal, legend toggle hides+persists across a redraw, universe swap + Refresh work.
- [ ] **Step 4: The friction chart** — open "Portal Stats"; verify the grouped multi-yAxis **bar** renders without overlap (category x-axis) and each column scales independently. Iterate here if needed.
- [ ] **Step 5:** Dark toggle re-inits + persists; a `currentTime` graph shows duration ticks.
- [ ] **Step 6: #131** — `dataView` opens a data table, `saveAsImage` downloads a PNG, text is visibly larger than the Highcharts baseline.
- [ ] **Step 7:** Advance a few zones with the window open → live capture accrues points (all four wrappers fire). Esc closes; Graphs button toggles.
- [ ] **Step 8:** Screenshot before/after for the PR. Stop the dev server.

---

## Task 10: Code review + docs + parity honesty

- [ ] **Step 1:** Dispatch a fresh `feature-dev:code-reviewer` (no implementation bias) over the diff — focus on semantic-mapping errors in `option-builder.ts` (`'Logarithmic'→'log'`, `column→bar`, `this.y`→`params`, `yAxis`→`yAxisIndex`) and the legend name-uniqueness invariant.
- [ ] **Step 2:** Address findings.
- [ ] **Step 3:** Update `CLAUDE.md` (Graphs is no longer legacy; only `AutoTrimps2.js` remains) + close #131 notes. In the PR/commit, state that the byte-parity gate covers `transforms`/`gamedata`/`storage` but NOT `option-builder` (re-expression; unit-tested + Chrome-verified), and acknowledge the CDN+pin+SRI decision against the `#75` vendoring precedent.
- [ ] **Step 4:** Final gates by exit code (`build`/`typecheck`/`lint`/`test:ci`).
- [ ] **Step 5: User-verify before FF-merge**, then squash + FF-merge to `main` + delete branch.

---

## Self-review (spec coverage)

- Line graphs, multi-axis column, legend persistence, universe swap, live updates, dark theme, zoom, tooltips, delete/clear → Tasks 4/6/7/9. ✓
- #131 export + fonts → Task 4 (builder) + Task 9 (Chrome). ✓
- Async-load-race fix (load guard) → Task 7/9. ✓
- Pin + SRI + supply-chain net → Tasks 7/8. ✓
- Purity boundary → Task 1 net. ✓
- Two frictions (grouped bar category axis; duration ticks) → Tasks 4/9. ✓
- Boot ordering (`bootGraphs` last) → Tasks 7/8. ✓
- Byte-parity honesty → Task 10. ✓
- Testing coverage-gain (SVG-SSR) is optional and noted in the spec; not a required task.
