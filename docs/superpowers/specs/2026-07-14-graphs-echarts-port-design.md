# Graphs.js → `src/` + Highcharts → ECharts — Design Spec

**Date:** 2026-07-14 · **Tracks:** #131 (bigger text + data export) · **Status:** design, pre-plan
**Effort:** L–XL · **Sequencing decision:** combined port + swap (no faithful-Highcharts intermediate)

## Context

`legacy/Graphs.js` (~1114 lines, plain JS) is the last non-trivial legacy subsystem besides
`AutoTrimps2.js`. It is a Highcharts-backed per-portal analytics dashboard, and it carries a cluster
of problems the Phase-1 bugfix pass (shipped `d5e2eed4`) deliberately left alone because they live in
the **charting layer**, not the data layer:

- **Version drift / deprecated APIs / async load race** — CDN-injects *unpinned latest* Highcharts
  (`:177`) while the code was written for v9.1.0; uses deprecated `zoomType`/`resetZoomButton`
  (`:388–400`); opening Graphs before the CDN resolves throws (no load guard).
- **#131** — labels/axes/legend render tiny (no `fontSize` set); there is no data-export path.
- **License / supply-chain** — Highcharts is proprietary (free non-commercial only); the CDN is
  unpinned and un-SRI'd.

A popularity-weighted library head-to-head (see session notes) chose **Apache ECharts** as the
replacement: 66.8k★ / ~14.7M dl/mo (5.3× Highcharts' reach), Apache-2.0, a declarative options model
that maps near-1:1 to the current Highcharts config, and a **built-in `toolbox`** (`saveAsImage` +
`dataView`) that satisfies *both* #131 asks with zero extra CDN scripts. A three-agent design panel
(advocate / feasibility / adversarial falsifier) validated the approach against the ECharts 5.6.0 docs
and the real source; their corrections are folded in below.

## Goals (the scope fence)

**In scope — same behavior, better engine, plus the two #131 asks:**
- Port `Graphs.js` → `src/modules/graphs/` as strict TypeScript.
- Swap Highcharts → **ECharts 5.6.0** (pinned + SRI, CDN-injected — not bundled), in one combined move.
- Strict feature parity: all line graphs, the multi-axis "Portal Stats" column chart, universe swap,
  legend-toggle persistence, live updates, dark theme, zoom, tooltips, delete/clear portals, the
  four game-function data-capture wrappers.
- #131: bigger text (`textStyle.fontSize`) + data export (`toolbox` `dataView`/`saveAsImage`).
- Fix the async-load race with a proper ECharts load guard.
- Pin ECharts version + SRI; update the supply-chain allowlist net.

**Out of scope (separate follow-up issues):** the dropdown-hiding UX ("show all charts even when
empty"), new chart types/metrics, restyling beyond #131, reworking the portal/storage model, any
gameplay-data change.

## Non-goals / accepted trade-offs

- **No zero-flicker live theme switch.** ECharts 5.6.0 `setTheme()` is private (it is a v6 feature).
  Theme is chosen at `echarts.init(dom, theme)`. This is fine: the legacy already **disposes and
  recreates** the chart on every redraw, so `toggleDarkGraphs` → `dispose()` + `init(dom, dark ?
  'dark' : undefined)` + `setOption` is a ~10-line faithful match, not a regression.
- **Byte-parity gate does not bless the option builder.** Highcharts config → `EChartsOption` is a
  re-expression, not a transcription; it is covered by behavioral unit tests + Chrome parity, not the
  per-function byte diff (which still applies to the unchanged `transforms`/`gamedata`/`storage`).
- **CDN + pin + SRI, not vendoring.** ECharts min is ~1 MB; the agreed supply-chain mitigation is a
  pinned jsDelivr URL + SRI hash + `crossOrigin`, acknowledged against the `#75` vendoring precedent.

## Architecture

A **directory module** `src/modules/graphs/` with a strict pure/impure boundary. Pure files import
nothing from DOM / `game` / the ECharts runtime; the split is what makes the bug-dense math testable
and lets the library swap touch only the option shape + render shell.

```text
src/modules/graphs/
  types.ts          PURE   PortalData, PerZoneData, GraphDef, ColumnDef, GraphSettings,
                           ToggleId, ToggleRule. Interfaces only.
  transforms.ts     PURE   diff, perZone, perHr, lifetime, s3normalized, accumulate,
                           formatDuration, maxS3Of. Number-in / number-out. BYTE-FAITHFUL to legacy.
  graph-defs.ts     PURE   GRAPH_LIST: GraphDef[] + TOGGLE_RULES. (conditional() takes an injected
                           gamedata reader — used for capture/visibility ONLY; builders never call it.)
  option-builder.ts PURE   THE SEAM: buildLineOption / buildColumnOption / baseOption → EChartsOption.
                           `import type` echarts only (erased at build).
  ── purity boundary ────────────────────────────────────────────────────────
  gamedata.ts       IMPURE getGameData accessors, Portal, pushData, getportalID. Reads game.*.
  storage.ts        IMPURE safeLocalStorage, savePortalData, loadGraphData, saveSetting,
                           clearData, deleteSpecific. localStorage + LZString.
  render.ts         IMPURE createUI, drawGraph, updateGraph, swapGraphUniverse, showHideUnusedGraphs,
                           toggleDarkGraphs/themeChanged, selectors, legend persistence,
                           escapeATWindows, toggleAll/Specific, the ECharts load guard,
                           the 4 game-function wrappers, Esc listener, bootGraphs().
  index.ts          barrel: re-exports the names that must be bare globals (below).

src/game/echarts.d.ts  ambient `declare const echarts: typeof import('echarts')` (CDN global,
                       used only by render.ts). Reverse seam, mirrors trimps.d.ts.
```

Dependency arrows point strictly downward (render → option-builder → graph-defs → transforms → types;
gamedata/storage sit beside the builder, consumed by render). **No pure file imports an impure one**,
enforced by a net (below).

### The pure-builder seam (crown jewel)

```ts
// option-builder.ts
export function buildLineOption(graph: GraphDef, portals: PortalData[], settings: GraphSettings): EChartsOption
export function buildColumnOption(graph: GraphDef, portals: PortalData[], settings: GraphSettings): EChartsOption
```

`buildLineOption` maps `createHighChartsObj`/`lineGraph` → an ECharts option: `series[].type:'line'`,
`showSymbol:false`, `data:[[zone,y]…]` (reversed, `portalsDisplayed`-capped, universe-filtered, named
`Portal N: challenge`); `xAxis.type:'value'` (min = `xminFloor`); `yAxis.type:'value'|'log'` with an
`axisLabel.formatter` reusing `prettify`/`formatDuration`; `markLine` at y=0 (≙ the `plotLines`);
`legend:{type:'scroll', selected: <name→bool>}`; `tooltip.formatter`; `dataZoom:[{inside},{slider}]`;
`toolbox.feature:{ dataView, saveAsImage, dataZoom }`; `textStyle.fontSize` bumped (#131).

`buildColumnOption` maps the multi-axis "Portal Stats": `yAxis: ColumnDef[]` (one `{show:false,
scale:true}` axis per active column, universe-filtered), each `series[].type:'bar'` + `yAxisIndex:k`.

## The two known frictions (budget Chrome time)

1. **🟠 "Portal Stats" grouped multi-yAxis BAR.** ECharts groups bars off a shared *category* base
   axis; on a `value`/`time` x-axis, adjacent groups **overlap** (apache/echarts#11145). Resolution:
   the column chart's x-axis becomes **`type:'category'`** with the (non-contiguous) portal numbers as
   categories. This is a defensible semantic change and is called out here explicitly. The specific
   pattern — several bar series each on its own hidden `yAxisIndex`, grouped — is thinly documented, so
   **budget real Chrome iteration on this one chart** (bar width, `barGap`, per-series axis scaling).
2. **🟡 Duration-tick axis (`currentTime` graphs).** ECharts `type:'time'` reads values as epoch
   dates (wrong — these are elapsed ms, can exceed 24h); `type:'value'` gives arbitrary ticks. The
   **label** is trivial (`axisLabel.formatter: v => formatDuration(v/1000)`), but nice tick
   *placement* on sensible duration boundaries needs a manual `interval`/`splitNumber`. Minor.

## Data flow / cross-cutting behaviors

- **Live updates** — `pushData()` (impure) mutates in-memory `PortalData`; when `live && open`,
  `render.ts` re-runs the *pure* `buildLineOption(...)` and calls `chart.setOption(opt,{notMerge:true})`.
  The builder has no notion of "live" — it is a pure snapshot called more often. The 450ms throttle
  stays in `storage.savePortalData`.
- **Legend-toggle persistence** — encoding is *pure* (`buildLineOption` emits `legend.selected` as a
  `{seriesName:boolean}` map from `settings.rememberSelected`); policy is *impure* (`render.ts`
  subscribes `chart.on('legendselectchanged', …)` → writes back → `saveSetting()`). ECharts keys
  selection by **series name**, which is *more* robust than the legacy positional array (which
  self-resets on length change). Portal names are unique per portal — the port must preserve that
  (review checkpoint). "Invert Selection" / "All Off/On" → `chart.dispatchAction({type:
  'legendToggleSelect'|'legendSelect'|'legendUnSelect', name})`.
- **Dark theme** — chosen at `init` (see non-goals); pure builder owns only theme-agnostic visuals
  (the 9-color palette, font sizes). The legacy `dark-graph.css`/`themeChanged()` survives in slimmed
  form only for the *surrounding* footer inputs; the chart's own dark styling is ECharts' built-in
  `'dark'` theme, so most of that CSS can go.

## Transition seam & boot ordering

- Add `import * as graphs from './modules/graphs'` to `src/legacy-bridge.ts` and spread `...graphs`
  onto `globalThis`. `index.ts` must `export` every name reached as a **bare global** from the inline
  DOM handlers `createUI` writes and the "Graphs" button: `drawGraph`, `updateGraph`,
  `swapGraphUniverse`, `saveSetting`, `clearData`, `deleteSpecific`, `toggleClearButton`,
  `toggleDarkGraphs`, `toggleSpecificGraphs`, `toggleAllGraphs`, `escapeATWindows`. Internal helpers
  (`pushData`, `getportalID`, `Portal`, `getGameData`, `loadGraphData`, `safeLocalStorage`,
  `savePortalData`, `showHideUnusedGraphs`, `createUI`, the builders) are **not** exported.
- **Boot ordering (load-bearing):** `MODULES.graphs` is registered *after* `seedModuleDefaults()`
  today (Graphs.js is emitted last, post-IIFE). Preserve this: expose `bootGraphs()` and call it as the
  **final statement of `main.ts`, after `seedModuleDefaults()`** — do NOT auto-run on module eval
  (auto-run would fold `graphs` into `MODULESdefault` and hit game DOM before it exists).
- Remove `'Graphs.js'` from `scripts/build-userscript.mjs` `MANIFEST` and update its "highcharts
  intentionally not bundled" comment. `tests/build-userscript.test.ts` + `tests/nets/reachability.test.ts`
  need the new reachability roots (`drawGraph` etc. are reached only via the DOM-attribute strings, the
  same class the net already handles for `bootSettingsUI`).

## Loading (supply-chain)

`render.ts` injects `<script>` for ECharts UMD (global `window.echarts`, single registration) from a
**pinned** jsDelivr URL + **SRI** + `crossOrigin="anonymous"`:
`https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js`. A **load guard** ensures `echarts` is
ready before the first `init` (opening Graphs before the script resolves must not throw — fixes the
current race). Update `tests/nets/supply-chain.test.ts` to swap the `code.highcharts.com` allowlist
entry for the pinned ECharts origin (+ SRI presence assertion).

## Testing plan

**Unit (vitest, `node` env — no jsdom, no ECharts runtime):**
- `transforms.test.ts` — **the bug-dense layer, tested hard.** Golden cases for `formatDuration`
  (d/h/m/s + the sub-second `x.ys` branch); `diff` returns `null` at the 1-indexed hole
  (mutation-check: restore `=== null` → expect a stray point); `perZone` start-of-data → `[0,0]`;
  `perHr` divide-by-hours; `lifetime` all three branches; `s3normalized`; `accumulate`.
- `option-builder.*.test.ts` — feed hand-built `PortalData[]`, assert **narrow structural invariants
  only** (never a whole-object snapshot — that is a hollow change-detector): `series.length` respects
  the cap/universe/reverse/naming; `series[k].data` equals expected `[zone,y]` pairs after
  `customFunction`/`diff`/clamp; toggle → title suffix + transformed data; column: `yAxis.length` =
  active columns, `series[k].yAxisIndex===k`, universe filter, `perHr` drops `currentTime`;
  `toolbox.feature.dataView` present (#131); `textStyle.fontSize` ≥ target (#131).
- `graph-defs.test.ts` — snapshot `GRAPH_LIST` id/order + toggle wiring (a dropped/reordered def is a
  persistence-contract break, analogous to the `createSetting` id gate).

**Purity net** (`tests/nets/graphs-purity.test.ts`): static-assert `transforms.ts`,
`option-builder.ts`, `types.ts` reference none of `document|window|game\.|localStorage|echarts\.` —
mutation-checkable, the boundary is the point.

**Optional headless render** (coverage *gain* — there is none today): ECharts SVG-SSR
(`echarts.init(null,null,{renderer:'svg',ssr:true,width,height})` + `renderToSVGString()`, 5.3+) lets
a node test assert on real rendered SVG. Gotcha to encode if used in jsdom instead: the **canvas
renderer fails in jsdom** (`getContext` unimplemented) — must use `renderer:'svg'` **with explicit
width/height** (jsdom `getBoundingClientRect` returns 0 → "Can't get DOM width/height") + a
`requestAnimationFrame` stub.

**Port the two existing suites off `eval(GRAPHS_SRC)`:** `graphs.robustness.test.ts` corrupt-storage
survival → call `storage.loadGraphData` directly with injected `localStorage`/`LZString`; the
overkill-no-mutation assertion → `gamedata.test.ts`. `graphs.darkTheme.test.ts` splits: the
`saveSetting('darkTheme',…)` persistence half → pure `storage.ts` test; the CSS/theme-applied half →
Chrome.

**Chrome (`chrome-devtools-mcp`) — the render shell:** ECharts loads under SRI with no race (open
Graphs before the script resolves → no crash, renders on ready); `init`+`setOption` draws the selected
graph; selectors + universe swap + Refresh; dark toggle re-inits and persists; legend click
hides+persists across redraw; capture accrues points across a few zones (all four wrappers fire);
**#131** — `dataView` opens a data table, `saveAsImage` downloads a PNG, text is visibly bigger; Esc
closes; the "Portal Stats" grouped bar renders correctly (the friction chart).

## Risks

- **Two seams in one move** (library swap + monolith→split) widens blast radius; a regression is
  ambiguous. Mitigation: land `types` + `transforms` + `option-builder` + their unit tests **first**
  (they need no browser/ECharts runtime — the math is provable before ECharts loads), then wire the
  shell.
- **Semantic-mapping risk replaces transcription risk** in the option builder (`'Logarithmic'`→`'log'`,
  `column`→`bar`, `this.y`→`params`, per-series `yAxis`→`yAxisIndex`); the unit tests are the
  mitigation, and the reviewer must read the builder for mapping errors.
- **Boot-timing fragility** — `bootGraphs()` must fire after `seedModuleDefaults()` with
  `#settingsRow`/`#settingsTable` present; shell-level, Chrome-verified.
- **The two frictions** (Portal Stats grouped bar; duration ticks) — budgeted Chrome iteration.

## Key files for the implementer
- `legacy/Graphs.js` — source of truth for the math; **copy transform expressions verbatim**.
- `src/legacy-bridge.ts` — add `graphs` spread · `scripts/build-userscript.mjs` — drop `Graphs.js`
  from `MANIFEST` · `src/main.ts` — call `bootGraphs()` last · `src/modules/jobs-ratios.ts` —
  pure-module precedent · `tests/graphs.darkTheme.test.ts` / `tests/graphs.robustness.test.ts` — port
  off `eval(GRAPHS_SRC)` · `tests/nets/supply-chain.test.ts` — ECharts origin + SRI.
