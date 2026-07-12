import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
export const DEFAULT_GAME_DIR =
  process.env.TRIMPS_GAME_DIR || resolve(HERE, '../../../trimps-game')

// Order matters: cross-file bare-identifier refs only resolve in one shared scope.
const GAME_FILES = ['lz-string.js', 'decimal.min.js', 'config.js', 'updates.js', 'playerSpire.js', 'objects.js', 'main.js']

/**
 * Boot the Trimps clone (and optionally the AutoTrimps bundle) into jsdom.
 * @param {{ gameDir?: string, withAutoTrimps?: boolean, atBundlePath?: string, saveString?: string }} [opts]
 * @returns {{ window: any, game: any, dom: any }}
 */
export function bootGame({ gameDir = DEFAULT_GAME_DIR, withAutoTrimps = false, atBundlePath, saveString } = {}) {
  const html = readFileSync(resolve(gameDir, 'index.html'), 'utf8')
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' })
  const { window } = dom

  // Stubs: jsdom has no canvas; suppress the game's self-scheduling loop so we drive ticks manually.
  window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) })
  window.setTimeout = () => 0
  window.setInterval = () => 0
  window.requestAnimationFrame = () => 0
  Object.assign(window, { usingScreenReader: false, usingRealTimeOffline: false, playFabId: -1 })

  // Concatenate all files and eval ONCE (per-file eval breaks cross-file refs).
  let combined = ''
  for (const f of GAME_FILES) combined += readFileSync(resolve(gameDir, f), 'utf8') + '\n;\n'
  window.eval(combined)

  // Load a real save (LZString base64) to start from a representative mid-run state instead
  // of an inert newGame(). load(str) decompresses the string arg directly (main.js:269) and
  // reassigns the global `game`. Must run before AT init so AT sees the loaded state.
  if (saveString) {
    window.load(saveString)

    // CRITICAL (#66): loading a save with elapsed time starts the game's offline-progress replay,
    // which sets `usingRealTimeOffline = true` (main.js:2901) and stashes repeatMap/repeatUntil/
    // exitTo. That replay normally self-terminates via a setTimeout loop — which this harness stubs
    // out — so without an explicit teardown the flag stays true FOREVER. AutoTrimps' mainLoop gates
    // on it:
    //     if (!usingRealTimeOffline) { setScienceNeeded(); autoLevelEquipment(); }
    // so a stuck flag silently disables ALL gear buying and science tracking for the whole run — AT
    // banks metal to its storage cap and never equips. Every AT-driven sim result recorded before
    // this fix was measured with those two subsystems dark.
    //
    // finish(true) is the game's own teardown (main.js:2978): it clears the flag AND restores the
    // stashed repeat/exit settings, so we land in the same state as a browser that finished loading.
    if (window.usingRealTimeOffline) window.offlineProgress.finish(true)
  }

  if (withAutoTrimps) {
    const at = atBundlePath || resolve(HERE, '../../dist/autotrimps.user.js')
    Object.assign(window, { GM_getValue: () => undefined, GM_setValue: () => {}, GM_xmlhttpRequest: () => {}, unsafeWindow: window })
    window.eval(readFileSync(at, 'utf8'))
    // AT's startup normally fires via setTimeout (stubbed off here). Run the settings init
    // directly: loadPageVariables() seeds autoTrimpSettings, bootSettingsUI() runs the ~570
    // createSetting defs (each populates a setting object mainLoop reads via .selected/.enabled).
    // Skips the remote Graphs.js inject + changelog tooltip that initializeAutoTrimps() also does.
    window.loadPageVariables?.()
    window.bootSettingsUI?.()
  }

  // Anti-false-green tripwire (mirrors tests/harness/gameFixture.ts:44): a hydrated game keeps its
  // methods. If this fails, the game object was replaced by method-less data and any trace is a lie.
  if (typeof window.game?.buildings?.Shed?.cost?.wood !== 'function') {
    throw new Error('boot: game not hydrated — buildings.Shed.cost.wood is not a function')
  }

  return { window, game: window.game, dom }
}
