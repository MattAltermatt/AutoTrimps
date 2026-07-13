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
// so it guards the U2 job path only, not U2 gear/maps. Per the design, cold branches beyond the
// corpus are covered by L1 unit depth; #58 does the targeted live U2 gear-path drive. Tracked in #47.
//
// #90/#98 UPDATE: the sentence that used to sit here — "deep-zone states need real long-progression
// jsdom can't cheaply reach" — was a HYPOTHESIS stated as a fact, and it was wrong in a way that cost
// the project its combat net for months. jsdom is not the obstacle. The obstacle is that the base save
// has `totalPortals = 0`: with no portal there are no perks, and AT hits a damage wall at world 6 that
// no amount of waiting clears (measured: world 6 for 25,000 consecutive ticks). Grant perks — the state
// every real player is in after their first portal — and AT advances, maps, and changes formation
// immediately. 05/06 below do exactly that. Cf. [[feedback-verify-the-harness-measures-what-it-claims]].
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

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// #90 / #98 — THE SAVES BELOW EXIST BECAUSE 01–04 CANNOT SEE THE BOT.
//
// Measured, not assumed: 01–04 all decode to world=4 / highestLevelCleared=3, and — the load-bearing
// fact — `game.global.mapsUnlocked === false` on every one of them. Maps unlock at world 6 (the
// FirstMap story, config.js:11323). And `src/modules/maps.ts:253` opens with
//
//     if (!game.global.mapsUnlocked || calcOurDmg("avg", false, true) <= 0) { enoughDamage = true; ... return }
//
// so on the entire old corpus the damage term is SHORT-CIRCUITED AWAY: calcOurDmg's value cannot
// affect a single recorded decision. That is the whole mechanism of #98 — a 1,000,000x damage
// multiplier passing the net green was never mysterious, it was arithmetic on dead code.
//
// WHY HONEST PLAY-FORWARD IS A DEAD END (and why these two saves must be poked). Played forward from
// 01 under the oracle AT, the sim reaches world 6 at ~15k ticks and then SOFT-LOCKS: AT walks into a
// map it cannot clear (measured HD ratio 23.3x, fragments=1) and sits there — world 6 for the next
// 25,000 ticks, 139s of wall clock, no progress. The cause is structural, not a tuning accident: every
// corpus save has `totalPortals = 0`, so the player has never portaled, so there is NO HELIUM and NO
// PERKS — and `game.global.antiStacks` only accrues `if (getPerkLevel('Anticipation'))` (main.js:11682).
// Zero perks ⇒ antiStacks pinned at 0 forever ⇒ calcOurDmg's Anticipation arm is unreachable ⇒ AT
// hits a damage wall in the single-digit zones and never leaves. You cannot reach the deep game from
// a no-perk save by waiting; jsdom is not slow, the run is genuinely stuck.
//
// So 06 grants perks — which is not a cheat, it is the state of every real player past their first
// portal. It follows the 03/04 doctrine exactly: the differential feeds the SAME save to both builds,
// so a field-poked state needs only to ARM the branch and not throw. Everything here is either a game
// state transition run through the game's OWN functions (unlockUpgrade + buyUpgrade) or a plain save
// field a real save carries. NO GAME BALANCE CONSTANT IS TOUCHED — perk levels are player state, and
// they live only in these fixtures, never in src/.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

// 05 · maps-unlocked U1 — HONEST play-forward (no poke at all), 20,000 ticks, to the first state where
// `mapsUnlocked` is true. Cheap and unglamorous but load-bearing: it is the only fixture where AT is
// damage-WALLED with maps available, so maps.ts:253 passes THROUGH the calcOurDmg call instead of
// short-circuiting on it. Recorded at one seed — AT is stuck in a map here, so its trace is a quiet
// buy loop and extra seeds would buy nothing (cf. 04's note).
const mapsBase = playForward(base, { ticks: 20000, seed: 1 })
writeSave('05-maps-u1', mapsBase)

// 06 · deep-U1 — a post-portal player: perks + the three formation upgrades, played forward from 05.
// THIS IS THE SAVE THAT MAKES THE NET SEE THE BOT. Measured reach over a 2000-tick window:
// setFormation ~1800x, selectMap/runMap/buyMap on every zone transition, antiStacks up to 30, mapBonus
// to 10, and the world actually ADVANCES (6 -> 8) instead of soft-locking. Every one of those is a
// calcOurDmg consumer: stance.ts's survive() picks the formation from predicted damage, and maps.ts's
// enoughDamage -> shouldDoMaps picks whether to map at all. A damage regression now moves the trace.
//
// The perk levels are a fixture constant, chosen to clear the z6 damage wall with headroom — they are
// not tuning and nothing reads them outside this file.
writeSave('06-deep-u1', playForward(mapsBase, {
  ticks: 8000, seed: 1,
  mutate: (w, g) => {
    // A modest post-portal perk spread. Anticipation is the important one: it is the ONLY thing that
    // lets antiStacks leave 0 (main.js:11682), which is what arms calcOurDmg's Anticipation arm — the
    // exact arm #98 injected 1e6x into and watched the net shrug.
    const perks = { Anticipation: 10, Power: 25, Toughness: 25, Looting: 15, Motivation: 15, Carpentry: 10, Artisanistry: 10, Coordinated: 5, Range: 5 }
    for (const [perk, level] of Object.entries(perks)) if (g.portal[perk]) g.portal[perk].level = level
    g.global.totalPortals = 1
    // Formations/Dominance/Barrier are normally granted by planetBreaker() at z60 and cost 1e10 science.
    // Take the game's OWN unlock + purchase path rather than poking `.done` — buyUpgrade() runs each
    // upgrade's fire(), which is what actually calls unlockFormation() and makes the formation legal.
    // Without `Formations.done`, autoStance() returns at stance.ts:224 and setFormation is never called.
    g.resources.science.owned = 1e12
    g.resources.food.owned = 1e12
    g.resources.fragments.owned = 1e7 // AT creates maps via buyMap(); fragments are the gate.
    for (const upgrade of ['Formations', 'Dominance', 'Barrier']) {
      w.unlockUpgrade(upgrade)
      w.buyUpgrade(upgrade, true, true)
    }
  },
}))

// 07 · map-cap U1 — the ONLY state that reaches AT's "too many maps" recovery branch, and therefore
// the only fixture that can ever record `recycleBelow` or `recycleMap`.
//
// This one is deliberately a corner, and the corner is the point. Every `recycleMap` and every
// `recycleBelow` callsite in AT (maps.ts:794/853/1580 and their recycleMap twins) sits behind the SAME
// single gate: `buyMap()` returning -2, which the game returns only at `mapsOwnedArray.length >= 100`
// (main.js:6597). No amount of ordinary progression reaches it — which is why #90 saw `recycleMap`
// sitting at zero and concluded the corpus was too shallow. It is not a depth problem; it is a cap
// problem, and the fix is to sit the bot ON the cap.
//
// The fill level matters and is not arbitrary. Fill with maps at the level AT WANTS and it simply runs
// one of them (measured: selectMap/runMap, and buyMap never even fires). Fill BELOW AT's target and
// `recycleBelow(true)` clears them, buyMap succeeds, and `recycleMap` still never fires. Only a cap of
// maps ABOVE AT's target level makes recycleBelow a no-op (it only recycles `item.level < level`,
// main.js:10685) and forces the final `recycleMap(lowestMap)` fallback. Hence world + 6.
writeSave('07-map-cap-u1', playForward(readFileSync(resolve(SAVES, '06-deep-u1.txt'), 'utf8'), {
  ticks: 0, seed: 1,
  mutate: (w, g) => {
    g.resources.fragments.owned = 1e12
    while (g.global.mapsOwnedArray.length < 100) w.createMap(g.global.world + 6)
  },
}))

// 08 · starved-U1 — THE FIXTURE THAT MAKES THE NET SENSITIVE TO DAMAGE. Read this note before touching
// any of the other saves, because it is the one that carries the #98 acceptance test.
//
// Reaching the code is NOT the same as being sensitive to it, and 06 taught that the hard way. 06 gets
// AT into maps and formations, so `calcOurDmg` is genuinely CALLED — and a 1,000,000x damage multiplier
// on its Anticipation arm STILL diffed to zero there. The reason is that AT's damage decisions are
// THRESHOLD predicates, and on 06 they are already SATURATED:
//
//     enoughDamage = (ourBaseDamage * mapenoughdamagecutoff > enemyHealth)     maps.ts:403
//
// On 06 that is already TRUE (measured: dmg 1528 x cutoff 4 vs enemy health 3831 — a ratio of 1.6). A
// 1e6x BUFF pushes an already-true predicate further true and changes NOTHING. Calling the function is
// not enough; its OUTPUT has to be able to move a decision.
//
// So 08 is deliberately damage-STARVED but PERKED — the one combination the corpus lacked:
//   · Anticipation perk, so antiStacks leaves 0 (measured: > 0 on 1961 of 2000 ticks) and calcOurDmg's
//     Anticipation arm is LIVE. 05 is starved but has no perks, so that arm is dead code there.
//   · NO damage perks (no Power/Toughness), so AT stays under the z6 damage wall: enoughDamage is FALSE
//     on all 2000 ticks (HD ratio 12.2). The threshold is UNSATURATED, so calcOurDmg's value is
//     load-bearing and a damage change FLIPS it.
//
// Measured: injecting `if (antiStacks > 0) number *= 1000000` into calcOurDmg yields 1542 divergences
// on this save. On 01-07 combined it yields ZERO. That single fact is why 08 exists.
//
// THE LESSON, because it will recur: a proof net needs its predicates near a BOUNDARY, not merely
// executed. When you add a fixture to cover a calculation, ask whether the calculation's result can
// still change an outcome there — then prove it by mutation. "The code ran" is not coverage.
writeSave('08-starved-u1', playForward(mapsBase, {
  ticks: 200, seed: 1,
  mutate: (w, g) => {
    g.portal.Anticipation.level = 10 // The ONLY perk. Damage perks would re-saturate the threshold.
    g.global.totalPortals = 1
    g.resources.science.owned = 1e12
    g.resources.food.owned = 1e12
    g.resources.fragments.owned = 1e6
    for (const upgrade of ['Formations', 'Dominance', 'Barrier']) {
      w.unlockUpgrade(upgrade)
      w.buyUpgrade(upgrade, true, true)
    }
  },
}))

console.log('[make-fixtures] corpus written (8 saves: 3×U1 shallow + U2-radon + maps + deep + map-cap + starved).')
console.log('[make-fixtures] reach is ASSERTED, not assumed — tests/sim/corpus-coverage.test.ts pins it. Re-record with `node scripts/sim/record-oracle.mjs`.')
