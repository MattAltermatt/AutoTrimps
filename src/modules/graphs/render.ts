// IMPURE render shell for the graphs feature (ported from legacy/Graphs.js, the "User Interface",
// "Graph handling" and "Trimps Wrappers" sections). Owns the DOM (createUI, selectors, footer),
// the ECharts runtime (load guard + init/dispose/setOption), legend-toggle persistence, dark theme,
// the Esc listener and the four game-function data-capture wrappers. Reads game/DOM/echarts as
// ambient free identifiers (src/game/*.d.ts); `any` casts at the DOM/game boundary per the
// conversion contract. The pure option shape comes from ./option-builder — this file never does math.
import type { EChartsOption } from 'echarts'
import type { GraphDef, ToggleId } from './types'
import { buildLineOption, buildColumnOption } from './option-builder'
import { GRAPH_LIST, TOGGLE_RULES } from './graph-defs'
import { graphState, GRAPHSETTINGS } from './state'
import { pushData, getGameData } from './gamedata'
import { loadGraphData, saveSetting } from './storage'

// --------- ECharts runtime + load guard ---------
// The chart instance (echarts.init return). Disposed and recreated on every redraw (theme is an
// init-time argument in 5.6.0), so this is reassigned constantly — `any` at the library boundary.
let chart: any = null
// Set true by the CDN script's onload. Until then renderChart stashes a pending redraw instead of
// throwing (the legacy async-load race: opening Graphs before Highcharts resolved threw).
let echartsReady = false
let pendingRender = false
// legacy `var lastTheme = -1` — last-seen game dark-theme value, so themeChanged() only fires on change.
let lastTheme = -1

// Render an already-built (pure) EChartsOption. Guards the async load: if the runtime is not yet
// present, remember that a render was wanted and let the loader's onload flush it (updateGraph()).
function renderChart(option: EChartsOption): void {
  if (typeof echarts === 'undefined' || !echartsReady) {
    pendingRender = true
    return
  }
  if (chart) chart.dispose()
  chart = echarts.init(document.getElementById('graph'), GRAPHSETTINGS.darkTheme ? 'dark' : undefined)
  chart.setOption(option, { notMerge: true })
  // Highcharts-style drag-a-box-to-zoom (legacy zoomType:'xy'): activate the toolbox dataZoom "select"
  // cursor by default so the user can drag a rectangle on the plot to zoom, without first clicking the
  // toolbar icon. The toolbox "restore" icon resets the zoom.
  chart.dispatchAction({ type: 'takeGlobalCursor', key: 'dataZoomSelect', dataZoomSelectActive: true })
  // Map ECharts' name-keyed legend selection back to the legacy positional rememberSelected array,
  // aligned to the built series order, and persist it.
  chart.on('legendselectchanged', (p: any) => {
    const series: any[] = (option.series as any[]) || []
    GRAPHSETTINGS.rememberSelected = series.map((s) => p.selected[s.name] !== false)
    saveSetting(null, null)
  })
}

// --------- User Interface ---------

// Create all of the UI elements and load in the ECharts runtime.
export function createUI(): void {
  var head = document.getElementsByTagName('head')[0]

  // ECharts loader (replaces the legacy unpinned Highcharts CDN inject): pinned version + SRI +
  // crossOrigin. On load, mark ready and flush a redraw that was requested while loading.
  var chartscript = document.createElement('script')
  chartscript.type = 'text/javascript'
  chartscript.src = 'https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js'
  chartscript.integrity = 'sha384-pPi0zxBAoDu6+JXW/C68UZLvBUUtU+7zonhif43rqj7pxsGyqyqzcian2Rj37Rss'
  chartscript.crossOrigin = 'anonymous'
  chartscript.onload = function () {
    echartsReady = true
    if (pendingRender) {
      pendingRender = false
      updateGraph()
    }
  }
  head.appendChild(chartscript)

  var graphsButton = document.createElement('TD')
  graphsButton.appendChild(document.createTextNode('Graphs'))
  graphsButton.setAttribute('class', 'btn btn-default')
  graphsButton.setAttribute('onclick', 'escapeATWindows(false); drawGraph(); swapGraphUniverse();')

  var settingbarRow = (document.getElementById('settingsTable') as HTMLElement).firstElementChild!
    .firstElementChild as HTMLElement
  settingbarRow.insertBefore(graphsButton, settingbarRow.childNodes[10])

  ;(document.getElementById('settingsRow') as HTMLElement).innerHTML += `
    <div id="graphParent" style="display: none; height: 600px; overflow: auto; position: relative;">
      <div id="graph" style="margin-bottom: 10px;margin-top: 5px; height: 530px;"></div>
      <div id="graphFooter" style="height: 50px;font-size: 1em;">
        <div id="graphFooterLine1" style="display: -webkit-flex;flex: 0.75;flex-direction: row; height:30px;"></div>
        <div id="graphFooterLine2"></div>
      </div>
    </div>
    `

  function createSelector(id: string, sourceList: (string | number)[], textMod = '', onchangeMod = '') {
    let selector = document.createElement('select')
    selector.id = id
    selector.setAttribute('style', '')
    selector.setAttribute('onchange', 'saveSetting(this.id, this.value); drawGraph();' + onchangeMod)
    for (var item of sourceList) {
      let opt = document.createElement('option')
      opt.value = String(item)
      opt.text = textMod + item
      selector.appendChild(opt)
    }
    selector.value = (GRAPHSETTINGS as any)[selector.id]
    return selector
  }

  // Create Universe and Graph selectors (iterate GRAPH_LIST, the ported graphList).
  var universeFooter = document.getElementById('graphFooterLine1') as HTMLElement
  const selectorSpecs: [string, (string | number)[], string?, string?][] = [
    ['universeSelection', [1, 2], 'Universe ', ' swapGraphUniverse();'],
    ['u1graphSelection', GRAPH_LIST.filter((g) => g.universe == 1 || !g.universe).map((g) => g.selectorText)],
    ['u2graphSelection', GRAPH_LIST.filter((g) => g.universe == 2 || !g.universe).map((g) => g.selectorText)],
  ]
  selectorSpecs.forEach((opts) => universeFooter.appendChild(createSelector(...opts)))

  universeFooter.innerHTML += `
    <div><button onclick="drawGraph()" style="margin-left:0.5em;">Refresh</button></div>
    <div style="flex:0 100 5%;"></div>
    <div><input type="checkbox" id="clrChkbox" onclick="toggleClearButton();"></div>
    <div style="margin-left: 0.5vw;">
      <button id="clrAllDataBtn" onclick="clearData(null,true); drawGraph();" class="btn" disabled="" style="flex:auto; padding: 2px 6px;border: 1px solid white;">
        Clear All Previous Data</button></div>
    <div style="flex:0 100 5%;"></div>
    <div style="flex:0 2 3.5vw;"><input style="width:100%;min-width: 40px;" id="deleteSpecificTextBox"></div>
    <div style="flex:auto; margin-left: 0.5vw;"><button onclick="deleteSpecific(); drawGraph();">Delete Specific Portal</button></div>
    <div style="float:right; margin-right: 0.5vw;"><button onclick="toggleSpecificGraphs()">Invert Selection</button></div>
    <div style="float:right; margin-right: 1vw;"><button onclick="toggleAllGraphs()">All Off/On</button></div>`

  // AAAAAAAAAAAAAAAAAAAAAAAAAAAA (Setting the inner HTML of the parent element resets the value of these? what the fuck)
  ;(document.querySelector('#universeSelection') as HTMLSelectElement).value = GRAPHSETTINGS.universeSelection as any
  ;(document.querySelector('#u1graphSelection') as HTMLSelectElement).value = GRAPHSETTINGS.u1graphSelection as any
  ;(document.querySelector('#u2graphSelection') as HTMLSelectElement).value = GRAPHSETTINGS.u2graphSelection as any

  let tipsText = "You can zoom by dragging a box around an area. You can turn portals off by clicking them on the legend. Quickly view the last portal by clicking it off, then Invert Selection. Or by clicking All Off, then clicking the portal on. To delete a portal, Type its portal number in the box and press Delete Specific. Using negative numbers in the Delete Specific box will KEEP that many portals (starting counting backwards from the current one), ie: if you have Portals 1000-1015, typing -10 will keep 1005-1015."
  ;(document.getElementById('graphFooterLine2') as HTMLElement).innerHTML += `
    <span style="float: left;" onmouseover='tooltip("Tips", "customText", event, "${tipsText}")' onmouseout='tooltip("hide")'>Tips: Hover for usage tips.</span>
    <span style="float: left; margin-left: 2vw"><input type="checkbox" id="liveCheckbox" onclick="saveSetting('live', this.checked);"> Live Updates</span>
    <span style="float: left; margin-left: 2vw">Show <input style="width:40px;" id="portalCountTextBox" onchange="saveSetting('portalsDisplayed', parseInt(this.value) || GRAPHSETTINGS.portalsDisplayed); updateGraph();"> Portals</span>
    <input onclick="toggleDarkGraphs()" style="height: 20px; float: right; margin-right: 0.5vw;" type="checkbox" id="blackCB">
    <span style="float: right; margin-right: 0.5vw;">Black Graphs:</span>
    `

  // Add a header with negative float hanging down on the top of the graph, for toggle buttons
  var toggleDiv = document.createElement('div')
  toggleDiv.id = 'toggleDiv'
  toggleDiv.setAttribute('style', 'position: absolute; top: 1rem; left: 3rem; z-index: 1;')
  toggleDiv.innerText = ''
  ;(document.querySelector('#graphParent') as HTMLElement).appendChild(toggleDiv)

  // Handle Dark Graphs?  Old code
  MODULES.graphs.themeChanged = function () {
    if (game && game.options.menu.darkTheme.enabled != lastTheme) {
      function f(h: any) {
        h.style.color = 2 == game.options.menu.darkTheme.enabled ? '' : 'black'
      }
      function g(h: any) {
        if ('graphSelection' == h.id) return void (2 != game.options.menu.darkTheme.enabled && (h.style.color = 'black'))
      }
      toggleDarkGraphs()
      var c: any = document.getElementsByTagName('input')
      var d: any = document.getElementsByTagName('select')
      var e: any = (document.getElementById('graphFooterLine1') as HTMLElement).children
      for (let h of c) f(h)
      for (let h of d) f(h)
      for (let h of e) f(h)
      for (let h of e) g(h)
    }
    game && (lastTheme = game.options.menu.darkTheme.enabled)
  }

  // #83 §8: hydrate the checkbox from storage BEFORE the first themeChanged() call. themeChanged()
  // calls toggleDarkGraphs(), which READS #blackCB.checked and PERSISTS it — and `lastTheme` starts at
  // -1, so that first call always fires. The checkbox was created by the innerHTML above with no
  // `checked` attribute, so toggleDarkGraphs() saw `false` and stomped the user's stored value on
  // EVERY page load. The old ordering then set the box from the value it had just destroyed.
  ;(document.querySelector('#blackCB') as HTMLInputElement).checked = GRAPHSETTINGS.darkTheme
  MODULES.graphs.themeChanged()
  ;(document.querySelector('#portalCountTextBox') as HTMLInputElement).value = String(GRAPHSETTINGS.portalsDisplayed)
}

// Show/hide the universe-specific graph selectors
export function swapGraphUniverse(): void {
  let universe = GRAPHSETTINGS.universeSelection
  let active = `u${universe}`
  let inactive = `u${universe == 1 ? 2 : 1}`
  ;(document.getElementById(`${active}graphSelection`) as HTMLElement).style.display = ''
  ;(document.getElementById(`${inactive}graphSelection`) as HTMLElement).style.display = 'none'
}

export function toggleClearButton(): void {
  ;(document.getElementById('clrAllDataBtn') as HTMLButtonElement).disabled = !(
    document.getElementById('clrChkbox') as HTMLInputElement
  ).checked
}

export function toggleDarkGraphs(): void {
  function removeDarkGraphs() {
    // legacy: `darkcss && (document.head.removeChild(darkcss), debug(...))` — de-comma'd (oxlint
    // no-unused-expressions rejects the sequence-expression statement); behaviourally identical.
    var darkcss = document.getElementById('dark-graph.css')
    if (darkcss) {
      document.head.removeChild(darkcss)
      debug('Removing dark-graph.css file', 'graphs')
    }
  }
  function addDarkGraphs() {
    // legacy body was a single comma-sequence expression; de-comma'd for the same reason.
    var darkcss = document.getElementById('dark-graph.css')
    if (!darkcss) {
      var b = document.createElement('link')
      b.rel = 'stylesheet'
      b.type = 'text/css'
      b.id = 'dark-graph.css'
      b.href = basepath + 'dark-graph.css'
      document.head.appendChild(b)
      debug('Adding dark-graph.css file', 'graphs')
    }
  }
  if (game) {
    var darkcss = document.getElementById('dark-graph.css')
    var dark = (document.getElementById('blackCB') as HTMLInputElement).checked
    // #83 §8: was saveSetting("darkTheme", !dark) — it persisted the INVERSE of the checkbox, while
    // the read-back at the end of buildGraphMenu is straight (`#blackCB.checked = GRAPHSETTINGS.darkTheme`).
    // So the CSS applied at click time used the correct `dark`, but storage got its negation: the box
    // could never round-trip, and unticking Black Graphs re-ticked it on the next load.
    saveSetting('darkTheme', dark)
    if (
      (!darkcss && (0 == game.options.menu.darkTheme.enabled || 2 == game.options.menu.darkTheme.enabled)) ||
      MODULES.graphs.useDarkAlways ||
      dark
    ) {
      addDarkGraphs()
    } else {
      if (darkcss && (1 == game.options.menu.darkTheme.enabled || 3 == game.options.menu.darkTheme.enabled || !dark)) {
        removeDarkGraphs()
      }
    }
  }
  // ECharts theme is chosen at init (5.6.0 has no live setTheme), so re-run the render to re-init the
  // chart under the new theme.
  updateGraph()
}

// Toggle AT windows with UI, or force close with Esc
export function escapeATWindows(escPressed = true): void {
  var a = document.getElementById('tooltipDiv') as HTMLElement
  if (a.style.display != 'none') return void cancelTooltip() // old code, uncertain what it's for or why it's here.
  for (const elemId of ['autoSettings', 'autoTrimpsTabBarMenu', 'graphParent']) {
    var elem = document.getElementById(elemId)
    if (!elem) continue
    if (elemId === 'graphParent') {
      // toggle Graphs window
      var open = elem.style.display === 'block'
      if (escPressed) open = true // override to always close
      elem.style.display = open ? 'none' : 'block'
      GRAPHSETTINGS.open = !open
      trimpStatsDisplayed = !open // HACKS disable hotkeys without touching Trimps settings
    } else {
      elem.style.display = 'none'
    } // close other windows
  }
}

// --------- Graph handling ---------

function lookupGraph(selectorText: string): GraphDef | undefined {
  for (const graph of GRAPH_LIST) {
    if (graph.selectorText === selectorText) return graph
  }
}

// Draws the graph currently selected by the user
export function drawGraph(): void {
  // TOGGLES
  function makeCheckbox(graph: string, toggle: ToggleId) {
    // A <label> makes the whole thing (box + text) clickable. The legacy inline onclick string
    // referenced GRAPHSETTINGS as a bare global — but GRAPHSETTINGS is a module object, not published
    // to globalThis, so the handler threw ReferenceError and the toggles did nothing. A closure over the
    // module-scoped GRAPHSETTINGS/TOGGLE_RULES/drawGraph fixes that (and drops the XSS-prone string).
    const container = document.createElement('label')
    const checkbox = document.createElement('input')
    const label = document.createElement('span')

    container.style.padding = '0rem .5rem'
    container.style.cursor = 'pointer'

    checkbox.type = 'checkbox'
    checkbox.id = toggle
    checkbox.checked = GRAPHSETTINGS.toggles[graph][toggle] ?? false
    checkbox.onclick = () => {
      // apply exclusions (mutually-exclusive toggles), set this one, redraw
      const rule = TOGGLE_RULES[toggle]
      if (rule && rule.exclude) rule.exclude.forEach((exTog) => (GRAPHSETTINGS.toggles[graph][exTog] = false))
      GRAPHSETTINGS.toggles[graph][toggle] = checkbox.checked
      drawGraph()
    }

    label.innerText = toggle
    label.style.color = '#757575'

    container.appendChild(checkbox)
    container.appendChild(label)
    return container
  }
  pushData() // update current zone data on request
  updateGraph()
  let universe = GRAPHSETTINGS.universeSelection
  let selectedGraph = document.getElementById(`u${universe}graphSelection`) as HTMLSelectElement
  if (selectedGraph.value) {
    // draw the graph
    let graph = lookupGraph(selectedGraph.value)
    // create toggle elements
    let toggleDiv = document.querySelector('#toggleDiv') as HTMLElement
    toggleDiv.innerHTML = ''
    if (graph && graph.toggles) {
      for (const toggle of graph.toggles) {
        toggleDiv.appendChild(makeCheckbox(graph.id, toggle))
      }
    }
  }
  showHideUnusedGraphs()
}

// Build the pure option for the currently-selected graph and render it (replaces the legacy
// Graph-instance updateGraph — the chart is now an ECharts option, not a Highcharts object).
export function updateGraph(): void {
  const universe = GRAPHSETTINGS.universeSelection
  const sel = document.getElementById(`u${universe}graphSelection`) as HTMLSelectElement
  if (!sel || !sel.value) return
  const graph = lookupGraph(sel.value)
  if (!graph) return
  const portals = Object.values(graphState.portalSaveData)
  const option =
    graph.graphType === 'column'
      ? buildColumnOption(graph, portals, GRAPHSETTINGS)
      : buildLineOption(graph, portals, GRAPHSETTINGS)
  // Legacy applyRememberedSelections: rememberSelected is a shared positional array reused across every
  // graph, so clear it (in-memory, persisted lazily on the next legend toggle) when the selected graph's
  // series count differs — otherwise a stale index carries over. The builder already left the option's
  // legend "all visible" for this render (its own length guard); this keeps the store honest too.
  const seriesLen = Array.isArray(option.series) ? option.series.length : 0
  if (GRAPHSETTINGS.rememberSelected.length !== seriesLen) GRAPHSETTINGS.rememberSelected = []
  renderChart(option)
}

// Hide graphs that have no collected data
export function showHideUnusedGraphs(): void {
  let activeUniverses: number[] = []
  for (const graph of GRAPH_LIST) {
    if (graph.graphType != 'line') continue // ignore column graphs (pure laziness, the only two always exist anyways)
    const universes = graph.universe ? [graph.universe] : [1, 2]
    for (const universe of universes) {
      let style = 'none'
      for (const portal of Object.values(graphState.portalSaveData)) {
        if (portal.universe !== universe) continue // right universe only
        // time-series graphs (He/hr) store samples separately; per-zone graphs need >1 distinct nonzero value.
        const hasData = graph.timeSeries
          ? (portal.hehrSamples?.length ?? 0) > 1
          : !!portal.perZoneData[graph.dataVar as string] &&
            new Set(portal.perZoneData[graph.dataVar as string].filter((x) => x)).size > 1
        if (hasData) {
          style = ''
          if (!activeUniverses.includes(universe)) activeUniverses.push(universe)
          break
        }
      }
      // hide unused graphs
      ;(
        document.querySelector(`#u${universe}graphSelection [value="${graph.selectorText}"]`) as HTMLElement
      ).style.display = style
    }
  }
  // hide universe selector if graphs are only in one universe
  let universeSel = document.querySelector(`#universeSelection`) as HTMLElement
  if (activeUniverses.length === 1) {
    universeSel.style.display = 'none'
    GRAPHSETTINGS.universeSelection = activeUniverses[0] as 1 | 2
    swapGraphUniverse()
  } else {
    universeSel.style.display = ''
  }
}

// --------- Graph Selection (legend persistence via ECharts) ---------

// Read the current chart's legend state and persist it into the legacy positional rememberSelected
// array (aligned to the built series order), then save.
function persistSelection(): void {
  if (!chart) return
  const opt: any = chart.getOption()
  const series: any[] = opt.series || []
  const legend: any = (opt.legend || [])[0] || {}
  const selected: Record<string, boolean> = legend.selected || {}
  GRAPHSETTINGS.rememberSelected = series.map((s: any) => selected[s.name] !== false)
  saveSetting(null, null)
}

// Invert the current legend selection (legacy toggleSpecificGraphs).
export function toggleSpecificGraphs(): void {
  if (!chart) return
  const series: any[] = chart.getOption().series || []
  for (const s of series) {
    chart.dispatchAction({ type: 'legendToggleSelect', name: s.name })
  }
  persistSelection()
}

// Toggle all series to the opposite of the majority visible/hidden state (legacy toggleAllGraphs).
export function toggleAllGraphs(): void {
  if (!chart) return
  const opt: any = chart.getOption()
  const series: any[] = opt.series || []
  const legend: any = (opt.legend || [])[0] || {}
  const selected: Record<string, boolean> = legend.selected || {}
  let visCount = 0
  for (const s of series) if (selected[s.name] !== false) visCount++
  const majorityVisible = visCount > series.length / 2
  for (const s of series) {
    chart.dispatchAction({ type: majorityVisible ? 'legendUnSelect' : 'legendSelect', name: s.name })
  }
  persistSelection()
}

// --------- Boot + Trimps wrappers ---------

// Load data, build the UI, and install the Esc listener + the four game-function data-capture
// wrappers. Called by main.ts as its final statement (after seedModuleDefaults) — NOT on import.
export function bootGraphs(): void {
  loadGraphData()
  createUI()
  showHideUnusedGraphs()
  graphState.requestRedraw = () => {
    if (GRAPHSETTINGS.live && GRAPHSETTINGS.open) updateGraph()
  }

  // Listen for Esc key presses, somehow.  This is ancient eldritch mess, but it works?
  document.addEventListener(
    'keydown',
    function (a) {
      1 != game.options.menu.hotkeys.enabled ||
        game.global.preMapsActive ||
        game.global.lockTooltip ||
        ctrlPressed ||
        heirloomsShown ||
        27 != a.keyCode ||
        escapeATWindows()
    },
    true,
  )

  // Wrap the four game functions to capture per-portal data. Reassigned on globalThis (an `any` seam)
  // so the game's own bare calls route through the wrappers — the same override the legacy did with
  // bare-global reassignment in the concatenated userscript.
  const w = globalThis as any

  // On Zone transition
  var originalnextWorld = w.nextWorld
  w.nextWorld = function () {
    try {
      if (game.options.menu.pauseGame.enabled) return
      if (null === graphState.portalSaveData) graphState.portalSaveData = {}
      if (getGameData.world()) {
        pushData()
      }
    } catch (e) {
      debug('Gather info failed: ' + e)
    }
    originalnextWorld(...arguments)
  }

  // On Portal
  var originalactivatePortal = w.activatePortal
  w.activatePortal = function () {
    try {
      pushData()
    } catch (e) {
      debug('Gather info failed: ' + e)
    }
    originalactivatePortal(...arguments)
  }

  // On Map start
  // This unfortunately loses the last map, since we grab map time at the creation of the map
  var originalbuildMapGrid = w.buildMapGrid
  w.buildMapGrid = function () {
    try {
      pushData(true)
    } catch (e) {
      debug('Gather info failed: ' + e)
    }
    originalbuildMapGrid(...arguments)
  }

  // On leaving maps for world
  // this captures the last map when you switch away from maps
  var originalmapsSwitch = w.mapsSwitch
  w.mapsSwitch = function () {
    originalmapsSwitch(...arguments)
    try {
      if (!game.global.mapsActive) pushData(true)
    } catch (e) {
      debug('Gather info failed: ' + e)
    }
  }
}
