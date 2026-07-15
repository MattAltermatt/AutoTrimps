import { describe, it, expect } from 'vitest'
import { buildLineOption, buildColumnOption } from '../../src/modules/graphs/option-builder'
import { GRAPH_LIST } from '../../src/modules/graphs/graph-defs'
import type { GraphDef, GraphSettings, PortalData } from '../../src/modules/graphs/types'

const byId = (id: string): GraphDef => GRAPH_LIST.find((g) => g.id === id)!

function settings(overrides: Partial<GraphSettings> = {}): GraphSettings {
  return {
    universeSelection: 1,
    u1graphSelection: null,
    u2graphSelection: null,
    rememberSelected: [],
    toggles: {},
    darkTheme: true,
    maxGraphs: 60,
    portalsDisplayed: 30,
    ...overrides,
  }
}

// two u1 portals with helium captured over 3 zones
function heliumPortals(): PortalData[] {
  const mk = (n: number, base: number): PortalData =>
    ({
      universe: 1,
      totalPortals: n,
      challenge: 'None',
      perZoneData: {
        heliumOwned: [undefined as unknown as number, base, base * 2, base * 3],
        currentTime: [undefined as unknown as number, 1000, 2000, 3000],
      },
    }) as unknown as PortalData
  return [mk(1, 10), mk(2, 100)]
}

describe('buildLineOption', () => {
  it('one line series per matching portal, named, capped, chart-ordered', () => {
    const opt = buildLineOption(byId('Helium'), heliumPortals(), settings())
    const series = opt.series as { type: string; name: string; data: [number, number][] }[]
    expect(series).toHaveLength(2)
    expect(series[0].type).toBe('line')
    expect(series[0].name).toMatch(/^Portal \d+: /)
    // series restored to chart order (portal 1 first)
    expect(series[0].name).toBe('Portal 1: None')
  })

  it('respects the portalsDisplayed cap (keeps the newest)', () => {
    const opt = buildLineOption(byId('Helium'), heliumPortals(), settings({ portalsDisplayed: 1 }))
    const series = opt.series as unknown[]
    expect(series).toHaveLength(1)
  })

  it('filters out the inactive universe', () => {
    const u2only = heliumPortals().map((p) => ({ ...p, universe: 2 as const }))
    const opt = buildLineOption(byId('Helium'), u2only, settings({ universeSelection: 1 }))
    expect(opt.series as unknown[]).toHaveLength(0)
  })

  it('#131: dataView + saveAsImage in the toolbox, larger fonts', () => {
    const opt = buildLineOption(byId('Helium'), heliumPortals(), settings())
    const toolbox = opt.toolbox as { feature: Record<string, unknown> }
    expect(toolbox.feature.dataView).toBeDefined()
    expect(toolbox.feature.saveAsImage).toBeDefined()
    expect((opt.textStyle as { fontSize: number }).fontSize).toBeGreaterThanOrEqual(14)
    expect((opt.title as { textStyle: { fontSize: number } }).textStyle.fontSize).toBeGreaterThanOrEqual(16)
  })

  it('perZone toggle appends " each Zone" to the title', () => {
    const opt = buildLineOption(byId('Helium'), heliumPortals(), settings({ toggles: { Helium: { perZone: true } } }))
    expect((opt.title as { text: string }).text).toContain('each Zone')
  })

  it('remembered hidden series are encoded in legend.selected by name', () => {
    const opt = buildLineOption(byId('Helium'), heliumPortals(), settings({ rememberSelected: [false, true] }))
    const selected = (opt.legend as { selected: Record<string, boolean> }).selected
    expect(selected['Portal 1: None']).toBe(false)
  })
})

describe('buildColumnOption (Portal Stats)', () => {
  function statPortals(): PortalData[] {
    const mk = (n: number): PortalData =>
      ({
        universe: 1,
        totalPortals: n,
        challenge: 'None',
        totalVoidMaps: 5,
        totalNullifium: 3,
        initialFluffy: 0,
        perZoneData: {
          heliumOwned: [undefined as unknown as number, 100],
          fluffy: [undefined as unknown as number, 50],
          currentTime: [undefined as unknown as number, 3600000],
        },
      }) as unknown as PortalData
    return [mk(1), mk(2)]
  }

  it('one hidden y-axis per active column, category x-axis, yAxisIndex mapping', () => {
    const opt = buildColumnOption(byId('Portal_Stats'), statPortals(), settings())
    // u1: Voids, Nu, Helium, Pet Exp(fluffy), Run Time = 5 columns (Radon/scruffy are u2)
    const yAxis = opt.yAxis as { show: boolean }[]
    expect(yAxis).toHaveLength(5)
    expect(yAxis.every((a) => a.show === false)).toBe(true)
    expect((opt.xAxis as { type: string }).type).toBe('category')
    const series = opt.series as { type: string; yAxisIndex: number }[]
    expect(series.every((s, i) => s.type === 'bar' && s.yAxisIndex === i)).toBe(true)
  })

  it('perHr toggle drops the Run Time (currentTime) column', () => {
    const opt = buildColumnOption(byId('Portal_Stats'), statPortals(), settings({ toggles: { Portal_Stats: { perHr: true } } }))
    expect(opt.yAxis as unknown[]).toHaveLength(4)
    expect((opt.title as { text: string }).text).toContain('/ Hour')
  })

  it('restores remembered hidden columns (review #1 — legacy applyRememberedSelections runs for columns too)', () => {
    // rememberSelected must match the 5-column u1 series count; hide the first column ("Voids").
    const opt = buildColumnOption(byId('Portal_Stats'), statPortals(), settings({ rememberSelected: [false, true, true, true, true] }))
    const selected = (opt.legend as { selected: Record<string, boolean> }).selected
    expect(selected['Voids']).toBe(false)
  })
})

describe('reviewer-found divergences (option-builder)', () => {
  // review #3: perZone + mapCount is reachable on "Clear Time" (mapCount only excludes mapTime/mapPct).
  // Legacy runs perZone's graphMods LAST, setting useAccumulator=false, so the result is NOT accumulated.
  // perZoneData is 1-indexed with a real hole at [0] (Portal.update pushes at data[world], world>=1);
  // build it sparse so for..in skips index 0, matching runtime.
  function clearTimePortal(): PortalData {
    const currentTime: number[] = []
    const mapCount: number[] = []
    currentTime[1] = 1000
    currentTime[2] = 2000
    currentTime[3] = 3000
    mapCount[1] = 5
    mapCount[2] = 3
    mapCount[3] = 7
    return { universe: 1, totalPortals: 1, challenge: 'None', perZoneData: { currentTime, mapCount } } as unknown as PortalData
  }

  it('perZone + mapCount does not accumulate (perZone overrides mapCount)', () => {
    const opt = buildLineOption(byId('Clear_Time'), [clearTimePortal()], settings({ toggles: { Clear_Time: { perZone: true, mapCount: true } } }))
    const ys = (opt.series as { data: [number, number][] }[])[0].data.map((d) => d[1])
    expect(ys).toEqual([5, 3, 7]) // raw per-zone mapCount; the OR-bug would give the running sum [5, 8, 15]
  })

  it('mapCount alone DOES accumulate (control for the above)', () => {
    const opt = buildLineOption(byId('Clear_Time'), [clearTimePortal()], settings({ toggles: { Clear_Time: { mapCount: true } } }))
    const ys = (opt.series as { data: [number, number][] }[])[0].data.map((d) => d[1])
    expect(ys).toEqual([5, 8, 15]) // running sum
  })

  // review #2: rememberSelected is a shared positional array; applying it to a graph with a different
  // series count would hide an unrelated series. Only apply when the lengths match.
  it('a rememberSelected of the wrong length hides nothing (no cross-graph bleed)', () => {
    const opt = buildLineOption(byId('Helium'), heliumPortals(), settings({ rememberSelected: [false] })) // 1 vs 2 series
    const selected = (opt.legend as { selected: Record<string, boolean> }).selected
    expect(selected).toEqual({})
  })
})

describe('He/hr time-series graph (#135, #136)', () => {
  const H = 3_600_000 // one hour in ms
  function hehrPortal(): PortalData {
    return {
      universe: 1,
      totalPortals: 1,
      challenge: 'None',
      perZoneData: {},
      // hehrSamples store the game's *lifetime* total (never reset per portal): 1000 lifetime He at 1h,
      // 3000 at 2h, 3600 at 3h. No totalHelium baseline here, so the first sample has no window.
      hehrSamples: [
        [H, 1000],
        [2 * H, 3000],
        [3 * H, 3600],
      ],
    } as unknown as PortalData
  }

  // #136: y is the CURRENT rate — Δ(lifetime total) over each window / window hours — NOT lifetime/t.
  // The delta cancels the lifetime baseline, so the value is this run's earning rate in that window.
  it('plots the windowed earning rate (Δearned / Δhours), not lifetime / t', () => {
    const opt = buildLineOption(byId('Helium_per_Hour'), [hehrPortal()], settings())
    const data = (opt.series as { data: [number, number][] }[])[0].data
    // window [1h,2h]: (3000-1000)/1h = 2000/hr ; window [2h,3h]: (3600-3000)/1h = 600/hr
    // no baseline => first sample (1h) has no predecessor, so no point for it.
    expect(data).toEqual([
      [2 * H, 2000],
      [3 * H, 600],
    ])
    expect((opt.xAxis as { name: string }).name).toBe('Time')
  })

  // #136: with a run-start baseline (totalHelium), a [0, baseline] origin is seeded so the FIRST sample
  // also gets a rate — and the lifetime baseline is subtracted out.
  it('seeds a run-origin point from totalHelium so the first sample gets a rate', () => {
    const p = {
      universe: 1, totalPortals: 1, challenge: 'None', perZoneData: {},
      totalHelium: 500, // lifetime He at run start
      hehrSamples: [[H, 1000], [2 * H, 3000]] as [number, number][],
    } as unknown as PortalData
    const opt = buildLineOption(byId('Helium_per_Hour'), [p], settings())
    const data = (opt.series as { data: [number, number][] }[])[0].data
    // window [0,1h]: (1000-500)/1h = 500/hr ; window [1h,2h]: (3000-1000)/1h = 2000/hr
    expect(data).toEqual([
      [H, 500],
      [2 * H, 2000],
    ])
  })

  it('the 1hr toggle uses 1-hour windows (coarsen 15-min samples first, then rate)', () => {
    const q = H / 4 // 15 min
    // nine 15-min samples spanning 2.25h (q .. 9q), lifetime total n*100 at sample n
    const samples: [number, number][] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n * q, n * 100])
    const p = { universe: 1, totalPortals: 1, challenge: 'None', perZoneData: {}, hehrSamples: samples } as unknown as PortalData
    const opt = buildLineOption(byId('Helium_per_Hour'), [p], settings({ toggles: { Helium_per_Hour: { '1hr': true } } }))
    const data = (opt.series as { data: [number, number][] }[])[0].data
    // coarsen keeps q, 5q, 9q (each >= 1h apart); rate over [q,5q] and [5q,9q] (both 4q = 1h windows):
    // (500-100)/1h = 400/hr ; (900-500)/1h = 400/hr
    expect(data).toEqual([
      [5 * q, 400],
      [9 * q, 400],
    ])
  })
})
