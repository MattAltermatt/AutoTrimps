// Shared MUTABLE runtime state for the graphs data-capture + storage layers. Both gamedata.ts and
// storage.ts read and reassign these, so they live in one holder object: a bare `export let` cannot
// be reassigned from an importing module, but `graphState.portalSaveData = {}` can (live binding on a
// const object). Legacy Graphs.js kept these as module-top `var`s (portalSaveData, lastSave,
// GRAPHSETTINGS); this is the typed equivalent.
import type { PortalData, GraphSettings } from './types'

export const graphState = {
  // Legacy `var portalSaveData = {}` — every captured portal run, keyed by getportalID().
  portalSaveData: {} as Record<string, PortalData>,
  // Legacy `var lastSave = new Date()` — the 450ms savePortalData throttle stamp. A ms number
  // (Date.now()) replaces the Date; subtraction against Date.now() keeps the throttle identical.
  lastSave: 0,
  // render.ts (a later task) sets this; pushData calls it when a live+open chart needs a redraw.
  // Undefined until the UI mounts, so every call site uses `?.()`.
  requestRedraw: undefined as (() => void) | undefined,
}

// Legacy `var GRAPHSETTINGS = {...}` (Graphs.js:1091). Mutated in place (GRAPHSETTINGS[k] = v) and
// never reassigned, so a const object is correct. Comment on maxGraphs preserved from legacy.
export const GRAPHSETTINGS: GraphSettings = {
  universeSelection: 1,
  u1graphSelection: null,
  u2graphSelection: null,
  rememberSelected: [],
  toggles: {},
  darkTheme: true,
  maxGraphs: 60, // Highcharts gets a bit angry rendering more graphs, 30 is the maximum you can fit on the legend before it splits into pages.
  portalsDisplayed: 30,
}
