// Pure type declarations for the graphs module. No runtime, no DOM, no game/echarts references.

/** Per-zone captured series, keyed by dataVar. 1-indexed with a hole at [0] (world >= 1). */
export interface PerZoneData {
  [dataVar: string]: (number | null)[]
}

/** A snapshot of one portal run, plus its accumulating per-zone data. */
export interface PortalData {
  universe: 1 | 2
  totalPortals: number
  challenge: string
  perZoneData: PerZoneData
  initialNullifium?: number
  totalNullifium?: number
  totalVoidMaps?: number
  cinf?: [number, number] // [c2, c3], consumed by lifetime()
  // universe 1
  totalHelium?: number
  initialFluffy?: number
  initialDE?: number
  // universe 2
  totalRadon?: number
  initialScruffy?: number
  initialMutes?: number
  s3?: number
}

export type ToggleId =
  | 'perZone'
  | 'perHr'
  | 'lifetime'
  | 's3normalized'
  | 'mapCount'
  | 'mapTime'
  | 'mapPct'

/** Persisted graph UI settings (localStorage key GRAPHSETTINGS). */
export interface GraphSettings {
  universeSelection: 1 | 2
  u1graphSelection: string | null
  u2graphSelection: string | null
  rememberSelected: boolean[]
  toggles: Record<string, Partial<Record<ToggleId, boolean>>> // [graphId][toggleId]
  darkTheme: boolean
  maxGraphs: number
  portalsDisplayed: number
  live?: boolean
  open?: boolean
}

/** A column within the multi-axis "Portal Stats" chart. */
export interface ColumnDef {
  dataVar: string
  title: string
  color: string
  universe?: 1 | 2
  type?: 'datetime'
  customFunction?: (portal: PortalData, x: number) => number
}

/**
 * A toggle rule: pure DATA describing how a toggle changes the chart (title/axis effects,
 * accumulation, formatter), plus the per-datum numeric transform. option-builder reads these
 * fields and applies them + owns the formatters — so this stays pure (no EChartsOption, no DOM).
 */
export interface ToggleRule {
  exclude?: ToggleId[]
  /** legacy `graph.useAccumulator = true` — running sum of the series. */
  useAccumulator?: boolean
  /** appended to the chart title (perZone " each Zone", perHr " / Hour"); may depend on maxS3. */
  titleSuffix?: string | ((ctx: { maxS3: number }) => string)
  /** fully replaces the chart title (mapCount "Maps Run", mapTime "Time in Maps"). */
  titleOverride?: string
  /** replaces the y-axis name (mapCount "Maps Run"). */
  yAxisName?: string
  /** appended to the y-axis name (lifetime " % of lifetime"). */
  yAxisNameSuffix?: string
  /** forces the y-axis type (mapCount/mapPct force 'value' off a datetime graph). */
  yAxisType?: 'value' | 'log'
  /** use the plain point formatter instead of the datetime one (mapCount/mapPct). */
  useDefaultPointFormatter?: boolean
  /** per-datum transform. perZone returns [x, time]; the rest return a number. */
  transform: (
    portal: PortalData,
    item: string,
    index: number,
    x: number,
    time: number,
    maxS3: number,
  ) => number | [number, number]
}

/**
 * A reader over live game state, injected into GraphDef.conditional so graph-defs stays pure.
 * Implemented by the impure gamedata module. Covers every game field the conditionals read.
 */
export interface GameDataReader {
  u1hze: () => number
  u2hze: () => number
  fluffy: () => number
  essence: () => number
  challengeActive: () => string
  universe: () => number
  totalHeliumEarned: () => number
  heliumLeftover: () => number
  runningChallengeSquared: () => boolean
  empowerDefined: () => boolean
}

/** A declarative graph definition. */
export interface GraphDef {
  dataVar: string | false
  universe: false | 1 | 2
  selectorText: string
  id: string
  graphTitle: string
  /** y-axis title override; legacy defaults it to selectorText (only "Void Map History" overrides). */
  yTitle?: string
  graphType: 'line' | 'column'
  yType: 'value' | 'log' | 'datetime' // 'datetime' => value axis + duration formatter
  xminFloor: number
  yminFloor?: number
  toggles?: ToggleId[]
  columns?: ColumnDef[]
  customFunction?: (portal: PortalData, i: number) => number | null
  conditional: (g: GameDataReader) => boolean // capture/visibility ONLY; builders never call it
  formatterKind: 'defaultPoint' | 'datetime'
}
