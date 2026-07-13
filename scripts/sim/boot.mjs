import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
// The clone is a MANAGED, SHA-pinned dependency that `npm ci` materializes (scripts/fetch-game-clone.mjs),
// not a sibling directory you were supposed to have cloned by hand. That is what makes it always
// present — and therefore what lets the conditional-skip mechanism (#67) be deleted rather than
// merely made loud. TRIMPS_GAME_DIR still wins, for A/B-ing an upstream bump against a dev workspace.
export const DEFAULT_GAME_DIR =
  process.env.TRIMPS_GAME_DIR || resolve(HERE, '../../.trimps-game')

// Order matters: cross-file bare-identifier refs only resolve in one shared scope.
const GAME_FILES = ['lz-string.js', 'decimal.min.js', 'config.js', 'updates.js', 'playerSpire.js', 'objects.js', 'main.js']

/**
 * Boot the Trimps clone (and optionally the AutoTrimps bundle) into jsdom.
 * @param {{ gameDir?: string, withAutoTrimps?: boolean, atBundlePath?: string, saveString?: string, atSettings?: Record<string, unknown> }} [opts]
 * @returns {{ window: any, game: any, dom: any }}
 */
export function bootGame({ gameDir = DEFAULT_GAME_DIR, withAutoTrimps = false, atBundlePath, saveString, atSettings, atSettingsBlob } = {}) {
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
    // NO IMPLICIT DEFAULT. This used to fall back to the gitignored dist/autotrimps.user.js, which
    // made the net's INPUT "whatever bundle happens to be lying around" — absent on CI (ENOENT), and
    // locally whatever you last built. Same disease as #67: a gate whose input is ambient. Callers
    // pass a freshly-built bundle (tests/globalSetup.ts builds one per run); there is nothing to be
    // stale. Cf. baseline-zero.test.ts, which already built in-process for exactly this reason.
    if (!atBundlePath) {
      throw new Error(
        'bootGame({ withAutoTrimps: true }) requires an explicit atBundlePath. Use TEST_BUNDLE from ' +
          "tests/sim/bundle.ts (a fresh in-process build) — never a path into the gitignored dist/.",
      )
    }
    const at = atBundlePath
    Object.assign(window, { GM_getValue: () => undefined, GM_setValue: () => {}, GM_xmlhttpRequest: () => {}, unsafeWindow: window })
    window.eval(readFileSync(at, 'utf8'))

    // A REAL user's exported settings blob (#105/#106) — the flat `id -> primitive` object AT persists.
    // This is the AUTHENTIC path, not a shortcut: loadPageVariables() reads localStorage
    // ('autoTrimpSettings', utils.ts:23) and, if the blob carries an ATversion, adopts it wholesale;
    // createSetting then applies its default ONLY where the blob has no key. So writing the blob here
    // reproduces exactly what the browser does on load. Prefer this over the per-id atSettings hook when
    // you have a user's real config — it exercises the same code path their browser does, including any
    // stale/unknown keys they are carrying.
    if (atSettingsBlob) {
      window.localStorage.setItem('autoTrimpSettings', typeof atSettingsBlob === 'string' ? atSettingsBlob : JSON.stringify(atSettingsBlob))
    }

    // AT's startup normally fires via setTimeout (stubbed off here). Run the settings init
    // directly: loadPageVariables() seeds autoTrimpSettings, bootSettingsUI() runs the ~570
    // createSetting defs (each populates a setting object mainLoop reads via .selected/.enabled).
    // Skips the remote Graphs.js inject + changelog tooltip that initializeAutoTrimps() also does.
    window.loadPageVariables?.()
    window.bootSettingsUI?.()

    // #105 — SEED AT SETTINGS. Until now the proof net could only ever run AT on its DEFAULT settings:
    // loadPageVariables() reads localStorage, which is empty under jsdom, so every recorded trace was of
    // a factory-default bot. That is a structural blind spot in its own right — most of AT's behaviour is
    // settings-gated, and any feature behind a non-default setting was untestable by L0 by construction.
    //
    // Concretely, it is what makes a Hypothermia fixture impossible without this hook: Rhypo's bonfire
    // clause is guarded by `hasBonfireTarget` (finalBonfireTarget > 0), and the default Rhypofarmstack is
    // the [-1] "unset" sentinel — so the clause stays INERT no matter how good the save is. The fixture
    // would reach the code and prove nothing. Cf. reach != sensitivity (#98).
    //
    // Seeded through AT's OWN setPageSetting rather than by poking autoTrimpSettings internals, so the
    // per-type field mapping (enabled / value / selected) cannot drift away from getPageSetting's.
    if (atSettings) {
      for (const [id, value] of Object.entries(atSettings)) {
        // ANTI-PHANTOM. setPageSetting returns false for an id production never createSetting's, and a
        // typo would otherwise seed NOTHING, silently — the fixture would then "cover" a feature it never
        // enabled and report a green as proof. That is the #58/#68 phantom-setting class, aimed at the
        // net itself, so make it loud.
        if (!window.autoTrimpSettings?.[id]) {
          throw new Error(
            `boot: atSettings names '${id}', which production never createSetting's. A phantom id seeds ` +
              'nothing and would make this fixture silently prove nothing.',
          )
        }
        window.setPageSetting(id, value)
      }
    }
  }

  // Anti-false-green tripwire (mirrors tests/harness/gameFixture.ts:44): a hydrated game keeps its
  // methods. If this fails, the game object was replaced by method-less data and any trace is a lie.
  if (typeof window.game?.buildings?.Shed?.cost?.wood !== 'function') {
    throw new Error('boot: game not hydrated — buildings.Shed.cost.wood is not a function')
  }

  return { window, game: window.game, dom }
}
