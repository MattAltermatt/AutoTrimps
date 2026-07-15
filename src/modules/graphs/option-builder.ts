// Pure ECharts option builders — the Highcharts->ECharts seam. Ported from legacy/Graphs.js
// createHighChartsObj (L386), lineGraph (L494) and columnGraph (L550). No DOM, no game state, no
// echarts runtime: these return plain EChartsOption data, unit-tested on structural invariants.
// The embedded formatter closures reference the ambient `prettify` (the game's number formatter)
// and `formatDuration`; they run only at render time, so the builders stay deterministic.
import type { EChartsOption } from 'echarts'
import type { GraphDef, PortalData, GraphSettings, ToggleId } from './types'
import { TOGGLE_RULES } from './graph-defs'
import { formatDuration, accumulate, maxS3Of } from './transforms'

// 9-color series palette (legacy Graphs.js:402), reused verbatim.
const PALETTE = ['#e60049', '#0bb4ff', '#50e991', '#e6d800', '#9b19f5', '#ffa300', '#dc0ab4', '#b3d4ff', '#00bfa0']

// #131 — bigger text than the Highcharts defaults.
const TITLE_FONT = 18
const BASE_FONT = 14

function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1]
}

// tooltip point formatter: durations for datetime graphs, prettify otherwise (legacy formatters L148).
// `p` is ECharts' CallbackDataParams (typed `any` at the library boundary, per the conversion contract).
function pointFormatter(useDatetime: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (p: any): string => {
    const y = Array.isArray(p.value) ? p.value[1] : p.value
    const body = useDatetime ? formatDuration(y / 1000) : prettify(y)
    return `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${body}</b>`
  }
}

// y-axis label formatter (legacy formatters.defaultAxis L157).
function axisFormatter(useDatetime: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (value: any): string => (useDatetime ? formatDuration(Number(value) / 1000) : prettify(value))
}

/** The base option shared by line and column graphs (legacy createHighChartsObj). */
function baseOption(graph: GraphDef): EChartsOption {
  const datetime = graph.yType === 'datetime'
  return {
    color: PALETTE,
    textStyle: { fontSize: BASE_FONT },
    title: { text: graph.graphTitle, left: 'center', textStyle: { fontSize: TITLE_FONT } },
    xAxis: { type: 'value', min: graph.xminFloor, name: 'Zone' },
    yAxis: {
      type: graph.yType === 'log' ? 'log' : 'value',
      name: graph.yTitle ?? graph.selectorText,
      scale: true,
      axisLabel: { formatter: axisFormatter(datetime), fontSize: BASE_FONT },
    },
    tooltip: { trigger: 'item', formatter: pointFormatter(graph.formatterKind === 'datetime') },
    legend: { type: 'scroll', orient: 'vertical', right: 0, textStyle: { fontSize: BASE_FONT } },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      { type: 'inside', yAxisIndex: 0, filterMode: 'none' },
      { type: 'slider' },
    ],
    // #131 — data export (dataView table + PNG) and zoom, built in.
    toolbox: { feature: { dataView: { readOnly: true }, saveAsImage: {}, dataZoom: { yAxisIndex: 'all' }, restore: {} } },
    series: [],
  }
}

/** Which toggles are active for this graph, in TOGGLE_RULES declaration order (legacy filter order). */
function activeTogglesFor(graph: GraphDef, settings: GraphSettings): ToggleId[] {
  const on = settings.toggles[graph.id] ?? {}
  return (Object.keys(TOGGLE_RULES) as ToggleId[]).filter((t) => on[t])
}

/** Apply a toggle rule's declarative title/axis effects to the option (legacy graphMods). */
function applyToggleEffects(option: EChartsOption, toggles: ToggleId[], maxS3: number): void {
  const title = option.title as { text?: string }
  const yAxis = option.yAxis as { name?: string; type?: string }
  for (const t of toggles) {
    const rule = TOGGLE_RULES[t]
    if (rule.titleOverride !== undefined) title.text = rule.titleOverride
    if (rule.titleSuffix !== undefined) {
      title.text = (title.text ?? '') + (typeof rule.titleSuffix === 'function' ? rule.titleSuffix({ maxS3 }) : rule.titleSuffix)
    }
    if (rule.yAxisName !== undefined) yAxis.name = rule.yAxisName
    if (rule.yAxisNameSuffix !== undefined) yAxis.name = (yAxis.name ?? '') + rule.yAxisNameSuffix
    if (rule.yAxisType !== undefined) yAxis.type = rule.yAxisType
    if (rule.useDefaultPointFormatter) {
      ;(option.tooltip as { formatter?: unknown }).formatter = pointFormatter(false)
    }
  }
}

/**
 * Build the line-graph option (legacy lineGraph L494). One series per portal (universe-filtered,
 * newest-`portalsDisplayed` kept, restored to chart order), each datum transformed by the graph's
 * customFunction and any active toggles, then optionally accumulated.
 */
export function buildLineOption(graph: GraphDef, portals: PortalData[], settings: GraphSettings): EChartsOption {
  const option = baseOption(graph)
  const item = graph.dataVar as string
  const maxS3 = maxS3Of(portals)
  const toggles = activeTogglesFor(graph, settings)
  applyToggleEffects(option, toggles, maxS3)

  // Legacy applies each toggle's graphMods in TOGGLE_RULES declaration order: mapCount/mapTime/mapPct
  // set useAccumulator=true, perZone sets it back to false — and perZone is declared AFTER the map
  // toggles, so it runs last and wins. On "Clear Time" a user can check perZone AND mapCount together
  // (mapCount only excludes mapTime/mapPct), and legacy's answer is NOT accumulated. A plain `.some()`
  // would diverge (mapCount's true would win); reduce in order so the last rule that sets it wins.
  let useAccumulator = false
  for (const t of toggles) {
    const ua = TOGGLE_RULES[t].useAccumulator
    if (ua !== undefined) useAccumulator = ua
  }
  const perZoneActive = toggles.includes('perZone')
  const otherToggles = toggles.filter((t) => t !== 'perZone')

  const series: { name: string; type: 'line'; showSymbol: false; data: [number, number | null][] }[] = []
  let portalCount = 0
  for (const portal of [...portals].reverse()) {
    if (!(item in portal.perZoneData)) continue // ignore blank
    if (portal.universe !== settings.universeSelection) continue // ignore inactive universe
    const cleanData: [number, number | null][] = []
    for (const index in portal.perZoneData[item]) {
      const i = Number(index)
      let x: number | null = portal.perZoneData[item][i]
      let time = portal.perZoneData.currentTime[i] as number
      if (typeof graph.customFunction === 'function') {
        x = graph.customFunction(portal, i)
        if (x !== null && x < 0) x = null
      }
      if (perZoneActive) {
        ;[x, time] = TOGGLE_RULES.perZone.transform(portal, item, i, x as number, time, maxS3) as [number, number]
      }
      for (const toggle of otherToggles) {
        try {
          x = TOGGLE_RULES[toggle].transform(portal, item, i, x as number, time, maxS3) as number
        } catch {
          x = 0
        }
      }
      if (useAccumulator) x = accumulate(x as number, last(cleanData)?.[1] as number | undefined)
      if (typeof x !== 'number') x = null // legacy typeCheck === "number"
      cleanData.push([i, x])
    }
    // current zone is too erratic to include for fluffy/scruffy per-zone (legacy L535)
    if (perZoneActive && (item === 'fluffy' || item === 'scruffy')) cleanData.splice(cleanData.length - 1)
    series.push({ name: `Portal ${portal.totalPortals}: ${portal.challenge}`, type: 'line', showSymbol: false, data: cleanData })
    portalCount++
    if (portalCount >= settings.portalsDisplayed) break
  }
  series.reverse()
  option.series = series as unknown as EChartsOption['series']

  applyLegendSelection(option, series, settings)
  return option
}

// Restore per-series legend visibility (legacy applyRememberedSelections). rememberSelected is a
// positional array SHARED across every graph, so legacy resets it to "all visible" whenever the series
// count differs (`chart1.series.length !== rememberSelected.length`) — only apply when lengths match,
// else a stale index from another graph hides an unrelated series. Applies to BOTH line and column
// charts (legacy ran applyRememberedSelections unconditionally for both graphTypes).
function applyLegendSelection(
  option: EChartsOption,
  series: { name: string }[],
  settings: GraphSettings,
): void {
  const selected: Record<string, boolean> = {}
  if (settings.rememberSelected.length === series.length) {
    series.forEach((s, i) => {
      if (settings.rememberSelected[i] === false) selected[s.name] = false
    })
  }
  ;(option.legend as { selected?: Record<string, boolean> }).selected = selected
}

/**
 * Build the "Portal Stats" multi-axis column option (legacy columnGraph L550). Each active column
 * gets its own hidden y-axis; the x-axis is CATEGORY (portal numbers) — ECharts groups bars off a
 * category base axis, so a value/time x would overlap adjacent groups (the design-doc friction).
 */
export function buildColumnOption(graph: GraphDef, portals: PortalData[], settings: GraphSettings): EChartsOption {
  const option = baseOption(graph)
  const perHr = !!(settings.toggles[graph.id] ?? {}).perHr

  let activeColumns = (graph.columns ?? []).filter(
    (column) => !(column.universe && column.universe !== settings.universeSelection),
  )
  if (perHr) {
    ;(option.title as { text?: string }).text = graph.graphTitle + ' / Hour'
    activeColumns = activeColumns.filter((column) => column.dataVar !== 'currentTime')
  }

  const universePortals = portals.filter((p) => p.universe === settings.universeSelection)
  const categories = universePortals.map((p) => String(p.totalPortals))

  const series = activeColumns.map((column, axisIndex) => {
    const data = universePortals.map((portal) => {
      let value: number | undefined
      const own = (portal as unknown as Record<string, number>)[column.dataVar]
      if (own) value = own
      const perZone = portal.perZoneData[column.dataVar]
      if (perZone) value = last(perZone) as number
      if (column.customFunction) value = column.customFunction(portal, value as number)
      if (perHr) value = (value as number) / ((last(portal.perZoneData.currentTime) as number) / 3600000)
      return value as number
    })
    const useDatetime = column.type === 'datetime'
    return {
      name: column.title,
      type: 'bar' as const,
      yAxisIndex: axisIndex,
      itemStyle: { color: column.color },
      data,
      ...(useDatetime ? { tooltip: { formatter: pointFormatter(true) } } : {}),
    }
  })

  option.xAxis = { type: 'category', name: 'Portal', data: categories }
  option.yAxis = activeColumns.map(() => ({ show: false, scale: true }))
  option.series = series as unknown as EChartsOption['series']
  applyLegendSelection(option, series, settings)
  return option
}
