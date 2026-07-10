import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe } from 'vitest'
import { DEFAULT_GAME_DIR } from '../../scripts/sim/boot.mjs'

// The sim/differential suite boots the real Trimps clone (../trimps-game) through jsdom.
// That clone is a LOCAL dev dependency — it is not vendored into the repo and is absent on
// CI runners — so `bootGame()` reads <gameDir>/index.html (scripts/sim/boot.mjs:14) and throws
// ENOENT there. `describeSim` runs these suites locally (clone present) and skips them cleanly
// in CI (clone absent), keeping `npm test` — the Pages-deploy gate — green.
export const describeSim = existsSync(resolve(DEFAULT_GAME_DIR, 'index.html'))
  ? describe
  : describe.skip
