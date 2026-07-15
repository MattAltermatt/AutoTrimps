// Barrel for the graphs module. Re-exports only the names that must be reachable as bare globals
// via the legacy bridge (the inline DOM handlers createUI writes + the "Graphs" button). Internal
// helpers (pushData, getportalID, Portal, getGameData, loadGraphData, safeLocalStorage,
// savePortalData, showHideUnusedGraphs, createUI, the builders) are NOT exported here.
export {
  drawGraph,
  updateGraph,
  swapGraphUniverse,
  toggleClearButton,
  toggleDarkGraphs,
  toggleSpecificGraphs,
  toggleAllGraphs,
  escapeATWindows,
  bootGraphs,
  // published because storage.ts (clearData/deleteSpecific) calls it as a bare global, exactly as
  // the legacy code did — a cross-module seam call, not an internal-only helper.
  showHideUnusedGraphs,
} from './render'
export { saveSetting, clearData, deleteSpecific } from './storage'
// GRAPHSETTINGS is published because a couple of inline DOM handlers createUI writes reference it as a
// bare global (e.g. the "Show N Portals" input's `parseInt(this.value) || GRAPHSETTINGS.portalsDisplayed`),
// exactly as legacy Graphs.js did when it was a global var.
export { GRAPHSETTINGS } from './state'
