import { describe, it, expect } from 'vitest'
import { GRAPH_LIST, TOGGLE_RULES } from '../../src/modules/graphs/graph-defs'

// The ordered id list is the persistence contract (GRAPHSETTINGS keys graphs by id) — a dropped or
// reordered entry silently orphans a user's saved toggle/selection state. Snapshot guards it.
describe('GRAPH_LIST', () => {
  it('has a stable ordered id list', () => {
    expect(GRAPH_LIST.map((g) => g.id)).toMatchInlineSnapshot(`
      [
        "Clear_Time",
        "Helium",
        "Fluffy_Exp",
        "Dark_Essence",
        "Warpstations",
        "Amalgamators",
        "Wonders",
        "Radon",
        "Scruffy_Exp",
        "Mutated_Seeds",
        "Worshippers",
        "Smithies",
        "Bonfires",
        "Embers",
        "Cruffys",
        "C2_Bonus",
        "Void_Map_History",
        "Coordinations",
        "Overkill_Cells",
        "Map_Bonus",
        "Empower",
        "Portal_Stats",
        "Population",
        "Gear_Levels",
        "Damage",
        "Time_in_Maps",
        "Helium_per_Hour",
        "Radon_per_Hour",
      ]
    `)
  })

  it('has 28 graphs (22 legacy + 6 new #135)', () => {
    expect(GRAPH_LIST.length).toBe(28)
  })

  it('Portal Stats is the sole column graph, with 7 columns', () => {
    const portalStats = GRAPH_LIST.find((g) => g.id === 'Portal_Stats')!
    expect(portalStats.graphType).toBe('column')
    expect(portalStats.columns).toHaveLength(7)
    expect(GRAPH_LIST.filter((g) => g.graphType === 'column')).toHaveLength(1)
  })

  it('the He/hr graphs are time-series with a 1hr toggle, and capture nothing per-zone (dataVar false)', () => {
    for (const id of ['Helium_per_Hour', 'Radon_per_Hour']) {
      const g = GRAPH_LIST.find((x) => x.id === id)!
      expect(g.timeSeries).toBe(true)
      expect(g.dataVar).toBe(false)
      expect(g.toggles).toContain('1hr')
    }
  })
})

describe('TOGGLE_RULES', () => {
  it('has the seven legacy toggles plus 1hr (#135)', () => {
    expect(Object.keys(TOGGLE_RULES).sort()).toEqual(
      ['1hr', 'lifetime', 'mapCount', 'mapPct', 'mapTime', 'perHr', 'perZone', 's3normalized'].sort(),
    )
  })
})
