import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
export const DEFAULT_GAME_DIR =
  process.env.TRIMPS_GAME_DIR || resolve(HERE, '../../../trimps-game')

// Order matters: cross-file bare-identifier refs only resolve in one shared scope.
const GAME_FILES = ['lz-string.js', 'decimal.min.js', 'config.js', 'updates.js', 'playerSpire.js', 'objects.js', 'main.js']

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
  if (saveString) window.load(saveString)

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

  return { window, game: window.game, dom }
}
