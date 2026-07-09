---
name: verify-live
description: >
  Build the AutoTrimps userscript, serve it against the local Trimps game, and hand
  a ready-to-click verify URL. Use when you want to eyeball a change running in the
  real game (not just tests). Encodes the fixed verify loop: build → serve → clear
  the settings key that triggers the known save-reload crash → open muted URL in Chrome.
disable-model-invocation: true
---

# verify-live

Stand up the local verify environment for AutoTrimps and hand off a clickable URL.
This is the canonical loop — do not improvise a different one.

## Steps

**1. Build the userscript.**
```bash
npm run build
```
Produces `dist/autotrimps.user.js`. If the build fails, stop and surface the error —
there is nothing to verify.

**2. Start the game server in the background.** It serves the local Trimps clone
(`../trimps-game`, v5.10.1) and aliases the fresh bundle at `/autotrimps.dev.js`.
```bash
npm run serve   # run in background; listens on http://localhost:8080/
```
Default port is 8080 (override with `PORT=`). The game dir defaults to
`/Users/matt/dev/MattAltermatt/trimps-game` (override with `TRIMPS_GAME_DIR=`).

**3. ⚠️ Clear the crashing settings key BEFORE loading.** There is a known
save-reload bug (GitHub #22): after a settings save, a reload leaves settings bare
and `mainLoop` throws on `getPageSetting('Praidingzone').length` every tick. To get
a clean load, clear the key first via a Chrome init script / evaluate before the
game boots:
```js
localStorage.removeItem('autoTrimpSettings')
```
Skipping this means you're testing on top of the #22 crash, not your change.

**4. Hand the URL — muted, on its own line.** Audio-off by default:
```
http://localhost:8080/?mute=1
```
Add any feature-relevant query params alongside `mute=1`. Name relevant hotkeys if
the change is behind one.

**5. Verify in Chrome — never the built-in preview.** Use the Chrome DevTools MCP
plugin. Watch the console for errors, confirm the visible change, and for any new
interactive control, actually click it and assert the state change (render-only is
insufficient). Report what you observed, not "it should work."

## Gotchas

- **HMR does not apply structural rewrites** — if a change added exports/streams or
  restructured a module and the browser shows stale behavior, restart the server.
  Diagnostic: read a known new constant via `evaluate_script`; mismatch = restart.
- **Green build ≠ working deploy.** The claim of success requires seeing the change
  run in the browser with a clean console.
