// IMPURE persistence layer for the graphs feature (ported from legacy/Graphs.js, the "Backend and
// helpers" section). Reads/writes localStorage and the remote LZString global; carries the two
// Phase-1 hardening fixes (safeLocalStorage quota-recovery + loadGraphData corrupt-key guard).
import { GRAPH_LIST } from './graph-defs'
import { graphState, GRAPHSETTINGS } from './state'
import { Portal, getportalID } from './gamedata'

// --------- Backend and helpers ---------
export function safeLocalStorage(name: string, data: unknown, retry = false) {
  try {
    // Skip the 450ms throttle on an eviction retry (retry === true): the original code stamped
    // lastSave on entry, so the post-eviction retry was blocked by its own throttle and the
    // recovery write was silently dropped after freeing space.
    if (name === "portalDataCurrent" && !retry) {
      // save at most every 450ms. Stringify is too expensive to run at max speed in timewarp, but still save every zone in liq otherwise
      if ((Date.now() - graphState.lastSave) / 450 < 1) return
      else graphState.lastSave = Date.now();
    }
    if (typeof data != "string") data = JSON.stringify(data);
    localStorage.setItem(name, data as string);
  } catch (e: any) {
    if (e.code == 22 || e.code == 1014) { // storage full
      if (Object.keys(graphState.portalSaveData).length === 0) {
        // Nothing left to evict — the payload won't fit even in empty storage. Deleting
        // portalSaveData[undefined] is a no-op, so retrying here would recurse until the stack
        // overflows. Give up gracefully instead.
        console.warn("AT Graphs Error: LocalStorage is full and the current data won't fit even after clearing all saved graphs.", e.code, e);
        return;
      }
      // Storage full: delete oldest portal from history and try again (bypassing the throttle).
      delete graphState.portalSaveData[Object.keys(graphState.portalSaveData)[0]];
      savePortalData(true);
      console.debug("AT Graphs Error: LocalStorage is full. Automatically deleting a graph to clear up space.", e.code, e);
      safeLocalStorage(name, data, true)
    }
  }
}

// Save Portal Data to history, or current only
export function savePortalData(saveAll = true) {
  var currentPortal = getportalID();
  if (saveAll) {
    safeLocalStorage("portalDataHistory", LZString.compressToBase64(JSON.stringify(graphState.portalSaveData)))
  }
  else {
    let portalObj: Record<string, unknown> = {}
    portalObj[currentPortal] = graphState.portalSaveData[currentPortal];
    safeLocalStorage("portalDataCurrent", portalObj)
  }
}

// Save settings, with or without updating a key
export function saveSetting(key: string | null, value: unknown) {
  if (key !== null && value !== null) (GRAPHSETTINGS as unknown as Record<string, unknown>)[key] = value;
  safeLocalStorage("GRAPHSETTINGS", GRAPHSETTINGS);
}

export function loadGraphData() {
  // Guard every localStorage parse: decompressFromBase64 returns "" for an absent key (first
  // run, safe) but null/garbage for a CORRUPT key, and JSON.parse throws on malformed data.
  // loadGraphData() runs unguarded at module top level, so an unhandled throw here would abort
  // createUI() and the four data-capture wrappers installed below it — and, in the concatenated
  // userscript, break everything emitted after this file. On corruption, start fresh instead.
  try {
    var loadedData: any = LZString.decompressFromBase64(localStorage.getItem("portalDataHistory"));
    var currentPortal = JSON.parse(localStorage.getItem("portalDataCurrent") as string);
    if (loadedData) {
      loadedData = JSON.parse(loadedData);
      if (loadedData && typeof loadedData === "object") {
        if (currentPortal) { loadedData[Object.keys(currentPortal)[0]] = Object.values(currentPortal)[0] }
        console.log("Graphs: Found portalSaveData")
        // remake object structure
        for (const [portalID, portalData] of Object.entries(loadedData)) {
          graphState.portalSaveData[portalID] = new Portal();
          for (const [k, v] of Object.entries(portalData as object)) {
            (graphState.portalSaveData[portalID] as unknown as Record<string, unknown>)[k] = v;
          }
        }
      }
    }
  } catch (e) {
    console.warn("AT Graphs: could not load saved portal history (corrupt data?); starting fresh.", e);
    graphState.portalSaveData = {};
  }
  var loadedSettings = null;
  try {
    loadedSettings = JSON.parse(localStorage.getItem("GRAPHSETTINGS") as string);
  } catch (e) {
    console.warn("AT Graphs: could not load saved settings (corrupt data?); using defaults.", e);
  }
  if (loadedSettings !== null) {
    for (const [k, v] of Object.entries(loadedSettings)) {
      (GRAPHSETTINGS as unknown as Record<string, unknown>)[k] = v;
    }
  }
  // initialize save space for the toggles
  if (GRAPHSETTINGS.toggles == null) GRAPHSETTINGS.toggles = {};
  for (const graph of GRAPH_LIST) {
    if (graph.toggles) {
      if (GRAPHSETTINGS.toggles[graph.id] === undefined) { GRAPHSETTINGS.toggles[graph.id] = {} }
      graph.toggles.forEach((toggle) => {
        if (GRAPHSETTINGS.toggles[graph.id][toggle] === undefined) { GRAPHSETTINGS.toggles[graph.id][toggle] = false }
      })
    }
  }
  GRAPHSETTINGS.open = false;
  MODULES.graphs = {}
  MODULES.graphs.useDarkAlways = false
}

export function clearData(keepN: number, clrall = false) {
  let changed = false;
  let currentPortalNumber = getTotalPortals();
  if (clrall) {
    for (const [portalID, portalData] of Object.entries(graphState.portalSaveData)) {
      if (portalData.totalPortals != currentPortalNumber) {
        delete graphState.portalSaveData[portalID];
        changed = true;
      }
    }
  } else {
    let totalSaved = Object.keys(graphState.portalSaveData).length;
    for (const [portalID, portalData] of Object.entries(graphState.portalSaveData)) {
      if (totalSaved > keepN && portalData.totalPortals <= currentPortalNumber - keepN) {
        delete graphState.portalSaveData[portalID];
        totalSaved--;
        changed = true;
      }
    }
  }
  if (changed) {
    savePortalData(true)
    showHideUnusedGraphs();
  }
}

export function deleteSpecific() {
  let portalNum = Number((document.getElementById("deleteSpecificTextBox") as HTMLInputElement).value);
  if (parseInt(portalNum as unknown as string) < 0) { clearData(Math.abs(portalNum)); }
  else {
    for (const [portalID, portalData] of Object.entries(graphState.portalSaveData)) {
      if (portalData.totalPortals === portalNum) delete graphState.portalSaveData[portalID];
    }
  }
  savePortalData(true)
  showHideUnusedGraphs();
}
