// Runtime fingerprint for the proof-net differential (#47). The committed oracle traces are
// node/jsdom-RUNTIME-coupled: RNG (seededRandom.mjs) and the clock (clock.mjs) are pinned, but the
// residual surface — jsdom DOM behavior + V8/node numeric internals — can still shift a knife-edge
// timing boundary and make a frozen bundle stop reproducing its own traces (observed 2026-07-10 and
// again 2026-07-11: 01-early-u1 drifted 12→6→24 events across node bumps, with ZERO src change).
//
// This is deliberately NOT an asserting gate. baseline-zero is a LOCAL-only differential (guard.ts
// skips it in CI — no ../trimps-game clone on runners), so an always-on version-assert test would
// either skip in CI too (guards nothing) or false-red there against a differently-recorded runtime.
// Worse, a red "runtime changed" light next to a red diff invites re-recording away a real regression
// (the laundering hole). Instead we CAPTURE the recording runtime into the oracle manifest and SURFACE
// it in baseline-zero's failure message, so a mysterious diff self-explains: restore the pinned
// runtime (.nvmrc + npm ci) and re-run — still red ⇒ a real code regression, do NOT re-record.
import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_GAME_DIR } from './boot.mjs'

const require = createRequire(import.meta.url)

/**
 * Capture the current runtime identity. All fields are cheap declared versions (no jsdom boot).
 * gameClone is only readable when the clone is present (absent on CI runners) — null otherwise.
 * @returns {{ node: string, v8: string, jsdom: string, gameClone: string|null, platform: string, arch: string }}
 */
export function currentFingerprint() {
  let gameClone = null
  const configPath = resolve(DEFAULT_GAME_DIR, 'config.js')
  if (existsSync(configPath)) {
    const m = /stringVersion:\s*'([^']+)'/.exec(readFileSync(configPath, 'utf8'))
    if (m) gameClone = m[1]
  }
  return {
    node: process.version,
    v8: process.versions.v8,
    jsdom: require('jsdom/package.json').version,
    gameClone,
    platform: process.platform,
    arch: process.arch,
  }
}

/**
 * A one-line human summary for failure messages / logs.
 * @param {ReturnType<typeof currentFingerprint>} fp
 */
export function formatFingerprint(fp) {
  return `node ${fp.node} (v8 ${fp.v8}), jsdom ${fp.jsdom}, clone ${fp.gameClone ?? '(absent)'}, ${fp.platform}/${fp.arch}`
}
