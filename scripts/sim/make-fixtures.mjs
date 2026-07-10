// Generate the synthetic save corpus that drives the proof-net differential. A fresh newGame()
// is INERT (AutoTrimps only acts once trimps flow), so the corpus is built from a genuinely
// progressed base state — the #45 self-play save (dist/gen-save-z4.json), on which AT actively
// buys/fights/gears — then played forward under a seeded, clock-frozen AT to reach further states.
// The committed .txt files are raw LZString save strings (what the game's native load() consumes).
//
// Determinism: playForward uses installSeededRandom + installFrozenClock, so regenerating the
// corpus from the same base reproduces byte-identical saves.
//
// NOTE (honest coverage gap): U2-radon + deep-zone/Spire states are NOT yet generated — they need
// portal/long-progression research. Per the design, the seeded early-window L0 differential can't
// reach those cold branches anyway; they are covered by L1 unit depth. Tracked as a follow-up.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from './boot.mjs'
import { installFrozenClock } from './clock.mjs'
import { installSeededRandom } from './seededRandom.mjs'
import { stepWithAT } from './driver.mjs'

const SAVES = resolve('tests/fixtures/saves')
mkdirSync(SAVES, { recursive: true })
const writeSave = (name, str) => {
  writeFileSync(resolve(SAVES, name + '.txt'), str, 'utf8')
  console.log('[make-fixtures]', name, '·', str.length, 'chars')
}

// Base = the #45 progressed z4 save (a state where AT is non-inert). Prefer the dist artifact;
// fall back to the committed baseline so the corpus regenerates without the gitignored dist file.
function loadBase() {
  const dist = resolve('dist/gen-save-z4.json')
  const committed = resolve(SAVES, '01-early-u1.txt')
  if (existsSync(dist)) return JSON.parse(readFileSync(dist, 'utf8'))
  if (existsSync(committed)) return readFileSync(committed, 'utf8')
  throw new Error('no base save: need dist/gen-save-z4.json (#45 artifact) or a committed 01-early-u1.txt')
}

// Load, seed + freeze, optionally mutate, play AT forward, return the resulting save string.
function playForward(saveString, { ticks, seed = 1, mutate } = {}) {
  const { window: w, game: g } = bootGame({ withAutoTrimps: true, saveString })
  installSeededRandom(w, seed)
  installFrozenClock(w)
  if (mutate) mutate(w, g)
  stepWithAT(w, ticks)
  return w.save(true)
}

const base = loadBase()

// 01 · early-U1 baseline — the progressed z4 base verbatim.
writeSave('01-early-u1', base)

// 02 · mid-U1 — the baseline played forward under AT (hot-path buy/fight/gear loop).
writeSave('02-mid-u1', playForward(base, { ticks: 4000, seed: 1 }))

// 03 · challenge-Watch — arms AT's challengeActive('Watch') override (jobs.ts:118). The flag is
// field-set: the differential feeds the SAME save to both builds, so exact challenge-state
// consistency is unnecessary — only that the branch arms and the run does not throw.
writeSave('03-challenge-watch', playForward(base, { ticks: 300, seed: 1, mutate: (_w, g) => { g.global.challengeActive = 'Watch' } }))

console.log('[make-fixtures] corpus written (3 saves). U2-radon + deep-zone deferred (see header).')
