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
      ]
    `)
  })

  it('has 22 graphs', () => {
    expect(GRAPH_LIST.length).toBe(22)
  })

  it('ends with the Portal Stats column graph', () => {
    const last = GRAPH_LIST[GRAPH_LIST.length - 1]
    expect(last.id).toBe('Portal_Stats')
    expect(last.graphType).toBe('column')
    expect(last.columns).toHaveLength(7)
  })
})

describe('TOGGLE_RULES', () => {
  it('has the seven legacy toggles', () => {
    expect(Object.keys(TOGGLE_RULES).sort()).toEqual(
      ['lifetime', 'mapCount', 'mapPct', 'mapTime', 'perHr', 'perZone', 's3normalized'].sort(),
    )
  })
})
