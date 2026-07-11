// Generate the synthetic save corpus that drives the proof-net differential. A fresh newGame()
// is INERT (AutoTrimps only acts once trimps flow), so the corpus is built from a genuinely
// progressed base state — the #45 self-play save (dist/gen-save-z4.json), on which AT actively
// buys/fights/gears — then played forward under a seeded, clock-frozen AT to reach further states.
// The committed .txt files are raw LZString save strings (what the game's native load() consumes).
//
// Determinism: playForward pins the AT bundle to the committed frozen ORACLE (not the current,
// gitignored dist/ build), plus installSeededRandom + installFrozenClock — so the DECISIONS taken are
// reproducible and independent of whatever is in dist/. The resulting save string is NOT byte-identical
// run-to-run, though: bootGame's load() stamps three wall-clock fields (global.portalTime, zoneStarted,
// lastOfflineProgress) BEFORE playForward can freeze the clock, so they leak real Date.now() (~ms of
// jitter). That is harmless — those fields don't drive the recorded mutator decisions (the trace IS
// byte-reproducible, guarded by trace.test.ts), and the committed saves are FIXED artifacts. The gate's
// integrity rests on runTrace determinism over a fixed save, not on regeneration being byte-identical.
// Regeneration is for deliberate re-baselining and yields behaviorally-equivalent saves; re-record the
// oracle traces (npm run sim:record) in the same pass so the committed (save, trace) pair stays coherent.
//
// NOTE (honest coverage gap): a U2-radon state IS generated below (04) via a field-poked universe
// switch, which arms RbuyJobs — but on a shallow (z4) base its live behavior is a job-buy no-op loop,
// so it guards the U2 job path only, not U2 gear/maps. Deep-zone/Spire states are still NOT generated
// (they need real long-progression jsdom can't cheaply reach). Per the design, those cold branches are
// covered by L1 unit depth; #58 does the targeted live U2 gear-path drive. Tracked in #47.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from './boot.mjs'
import { installFrozenClock } from './clock.mjs'
import { installSeededRandom } from './seededRandom.mjs'
import { stepWithAT } from './driver.mjs'

// The frozen faithful bundle — pin play-forward to it so save generation never depends on dist/.
const ORACLE = resolve('tests/fixtures/oracle/autotrimps.oracle.user.js')

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
  const { window: w, game: g } = bootGame({ withAutoTrimps: true, atBundlePath: ORACLE, saveString })
  installSeededRandom(w, seed)
  installFrozenClock(w)
  if (mutate) mutate(w, g)
  stepWithAT(w, ticks)
  return w.save(true)
}

const base = loadBase()

// 01 · early-U1 baseline — the progressed z4 base verbatim.
writeSave('01-early-u1', base)

// 02 · mid-U1 — the baseline played forward under AT (hot-path buy/fight/gear loop). Played deep
// enough (8000 ticks) that a 1500-tick oracle recording lands in an ACTIVE window (~85 mutator
// events: buyJob + a building-buy wave) rather than the plateau a shallower forward-play left it in
// (the pre-#47 4000-tick save recorded a single quiet buyUpgrade — a degenerate trace). #47.
writeSave('02-mid-u1', playForward(base, { ticks: 8000, seed: 1 }))

// 03 · challenge-Watch — arms AT's challengeActive('Watch') override (jobs.ts:118). The flag is
// field-set: the differential feeds the SAME save to both builds, so exact challenge-state
// consistency is unnecessary — only that the branch arms and the run does not throw.
writeSave('03-challenge-watch', playForward(base, { ticks: 300, seed: 1, mutate: (_w, g) => { g.global.challengeActive = 'Watch' } }))

// 04 · U2-radon — arms the Universe-2 (radon) decision paths, above all RbuyJobs (the radon-universe
// job buyer the U1 corpus can NEVER reach — see the #32 manifest note). newGame() deep-instantiates
// every U2 field, so a loaded U1 save already carries a valid radon resource + U2 perk slots; the
// minimal self-consistent switch is just the universe flags (game research, 2026-07-10). portalUniverse
// is a top-level global read directly by perk/preset code, so it must be set alongside game.global.universe.
// This is a field-poked switch on a shallow (z4) base — a Frankenstein state whose live behavior is
// RbuyJobs-dominated; it is recorded bounded (corpus.mjs) and is not a deep-U2 run. #47/#58.
writeSave('04-u2-radon', playForward(base, {
  ticks: 300, seed: 1,
  mutate: (w, g) => { g.global.universe = 2; w.portalUniverse = 2; g.global.newUniverse = 2 },
}))

console.log('[make-fixtures] corpus written (4 saves: 3×U1 + 1×U2-radon). Deep-zone/Spire deferred (see header).')
