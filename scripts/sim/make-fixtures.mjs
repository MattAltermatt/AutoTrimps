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
//
// #57/#128 UPDATE (2026-07-14): that world-6 damage wall was ALSO half a harness bug, and the DEEP GAME
// IS NOW REACHABLE. #122 unfroze the metal economy (checkTriggers never fired, so Forge never unlocked and
// metal.max was pinned at 500); with it fixed, 06-deep plays forward UNAIDED from world 6 to **world 47**
// (380k ticks, no soft-lock), and a real post-portal perk spread carries it to **world 63 with Warpstation
// UNLOCKED**. The z47 wall is a DAMAGE wall — 06's perk spread is deliberately modest — not a structural
// one. So the corpus's z4–8 ceiling is a CHOICE, not a limit, and Warpstation (42.5% of deep metal spend),
// Gigastation and Nursery are currently invisible to the net. Tracked in #128.
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

// `--only 09-housing-u2,10-hypo-u2` regenerates just those saves. This exists because regeneration is
// deliberately NOT byte-reproducible (see the header: load() stamps wall-clock fields before the clock
// can be frozen), so a full run rewrites all eight committed saves and forces a full re-record for no
// behavioural reason. Adding a fixture should cost only that fixture's trace.
const onlyArg = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null
const only = onlyArg ? new Set(onlyArg.split(',')) : null
const want = (name) => !only || only.has(name)

// `str` may be a thunk, so a skipped save costs no play-forward (05's is 20,000 ticks).
const writeSave = (name, str) => {
  if (!want(name)) return
  const s = typeof str === 'function' ? str() : str
  writeFileSync(resolve(SAVES, name + '.txt'), s, 'utf8')
  console.log('[make-fixtures]', name, '·', s.length, 'chars')
}
const readSave = (name) => readFileSync(resolve(SAVES, name + '.txt'), 'utf8')

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
// atSettings matters for the settings-gated fixtures (09/10): a state generated with the feature OFF
// is not the state the recorder will replay with it ON.
//
// `untilWorld` (optional, #128) plays until `game.global.world >= untilWorld` instead of a fixed tick
// count, capped at `ticks` as a runaway guard. A deep fixture is defined by the STATE it must reach
// (Warpstation unlocks at world 60), not by a tick number — and the exact world at a fixed tick drifts
// run-to-run with RNG, so a fixed count would land at an unpredictable zone. It throws rather than
// silently committing a too-shallow save if the cap is hit first.
function playForward(saveString, { ticks, seed = 1, mutate, atSettings, untilWorld } = {}) {
  const { window: w, game: g } = bootGame({ withAutoTrimps: true, atBundlePath: ORACLE, saveString, atSettings })
  installSeededRandom(w, seed)
  installFrozenClock(w)
  if (mutate) mutate(w, g)
  if (untilWorld) {
    let i = 0
    for (; i < ticks && g.global.world < untilWorld; i++) stepWithAT(w, 1)
    if (g.global.world < untilWorld) {
      throw new Error(`playForward: hit ${ticks}-tick cap at world ${g.global.world}, wanted world ${untilWorld}`)
    }
  } else {
    stepWithAT(w, ticks)
  }
  return w.save(true)
}

const base = loadBase()

// 01 · early-U1 baseline — the progressed z4 base verbatim.
writeSave('01-early-u1', base)

// 02 · mid-U1 — the baseline played forward under AT (hot-path buy/fight/gear loop). Played deep
// enough (8000 ticks) that a 1500-tick oracle recording lands in an ACTIVE window (~85 mutator
// events: buyJob + a building-buy wave) rather than the plateau a shallower forward-play left it in
// (the pre-#47 4000-tick save recorded a single quiet buyUpgrade — a degenerate trace). #47.
writeSave('02-mid-u1', () => playForward(base, { ticks: 8000, seed: 1 }))

// 03 · challenge-Watch — arms AT's challengeActive('Watch') override (jobs.ts:118). The flag is
// field-set: the differential feeds the SAME save to both builds, so exact challenge-state
// consistency is unnecessary — only that the branch arms and the run does not throw.
writeSave('03-challenge-watch', () => playForward(base, { ticks: 300, seed: 1, mutate: (_w, g) => { g.global.challengeActive = 'Watch' } }))

// 04 · U2-radon — arms the Universe-2 (radon) decision paths, above all RbuyJobs (the radon-universe
// job buyer the U1 corpus can NEVER reach — see the #32 manifest note). newGame() deep-instantiates
// every U2 field, so a loaded U1 save already carries a valid radon resource + U2 perk slots; the
// minimal self-consistent switch is just the universe flags (game research, 2026-07-10). portalUniverse
// is a top-level global read directly by perk/preset code, so it must be set alongside game.global.universe.
// This is a field-poked switch on a shallow (z4) base — a Frankenstein state whose live behavior is
// RbuyJobs-dominated; it is recorded bounded (corpus.mjs) and is not a deep-U2 run. #47/#58.
writeSave('04-u2-radon', () => playForward(base, {
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
// Memoised: 05/06/08 all derive from it, and it is a 20,000-tick play-forward. Lazy so that
// regenerating only a late fixture (--only) does not pay for it.
let _mapsBase = null
const mapsBase = () => (_mapsBase ??= playForward(base, { ticks: 20000, seed: 1 }))
writeSave('05-maps-u1', () => mapsBase())

// 06 · deep-U1 — a post-portal player: perks + the three formation upgrades, played forward from 05.
// THIS IS THE SAVE THAT MAKES THE NET SEE THE BOT. Measured reach over a 2000-tick window:
// setFormation ~1800x, selectMap/runMap/buyMap on every zone transition, antiStacks up to 30, mapBonus
// to 10, and the world actually ADVANCES (6 -> 8) instead of soft-locking. Every one of those is a
// calcOurDmg consumer: stance.ts's survive() picks the formation from predicted damage, and maps.ts's
// enoughDamage -> shouldDoMaps picks whether to map at all. A damage regression now moves the trace.
//
// The perk levels are a fixture constant, chosen to clear the z6 damage wall with headroom — they are
// not tuning and nothing reads them outside this file.
writeSave('06-deep-u1', () => playForward(mapsBase(), {
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
writeSave('07-map-cap-u1', () => playForward(readSave('06-deep-u1'), {
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
writeSave('08-starved-u1', () => playForward(mapsBase(), {
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

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// #105 — THE TWO SAVES THE BLIND-SPOT CENSUS *MEASURED* AS MISSING.
//
// The census (tests/sim/blind-spot-census.md) injects each real shipped bug into the built bundle and
// counts divergences. Two rows came back 0/17 — the gate could not see them AT ALL:
//
//     housing-hut-divisor   #93's actual bug    BLIND
//     rhypo-invert          #101's actual bug   BLIND
//
// The acceptance criterion for these two fixtures is therefore NOT "the code executes". It is that the
// census row flips to SEEN. Adding saves until a function merely RUNS is precisely the #98 mistake.
//
// ⚠️ AND THEY ARE WHAT FORCED THE ORACLE RE-PIN (v3 -> v4, see build-oracle.mjs). v3 predates #93/#96/
// #101, so the FROZEN ORACLE LITERALLY CONTAINED BOTH BUGS — nobody noticed because the corpus never
// reached either region. The stale oracle and the blind spots were the same phenomenon. Against a v3
// oracle the census even INVERTS: restoring #93's bug makes the build AGREE with the oracle (0
// divergences, reported BLIND) while the clean build is the one that diverges.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const toU2 = (w, g) => { g.global.universe = 2; w.portalUniverse = 2; g.global.newUniverse = 2 }

// 09 · housing-U2 — the fixture that makes mostEfficientHousing's DIVISOR load-bearing.
//
// Reaching the function is not enough, and 04-u2-radon is the proof: the census's crude break (always
// return "Hut") lights 04 up with 592 divergences, while #93's REAL bug diverges by ZERO there. On 04
// only Hut and House are unlocked, and dividing by the Hut's population gain instead of each building's
// own does not change which of those two wins — the function runs, its answer is not load-bearing.
//
// So unlock the tiers whose population gains actually differ (Hut 3, House 5, Mansion 10, Hotel 20,
// Resort 40, Gateway 100, Collector 5000) via the game's OWN unlockBuilding(). Measured on this state:
//
//     BUGGY (Hut divisor)  picks Hut       <- degenerates to "buy the cheapest"
//     FIXED (own divisor)  picks Mansion
//
// The argmin FLIPS, so the bug is now observable. U2 because mostEfficientHousing is only reached from
// RbuyBuildings(), the U2 building automation (AutoTrimps2.js:486).
writeSave('09-housing-u2', () => playForward(readSave('06-deep-u1'), {
  ticks: 300, seed: 1,
  mutate: (w, g) => {
    toU2(w, g)
    for (const h of ['Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector']) w.unlockBuilding(h)
    // Enough of every housing currency that the CHOICE is what is under test, not affordability.
    g.resources.gems.owned = 1e9
    g.resources.food.owned = 1e9
    g.resources.wood.owned = 1e9
    g.resources.metal.owned = 1e9
  },
}))

// 10 · hypothermia-U2 — the fixture that makes Rhypo's conserve clause load-bearing.
//
// `Rhyposhouldwood === false` means CONSERVE wood: it blocks Smithy (buildings.ts), deprioritizes
// wood-costing housing, and skips Shield levelling (equipment.ts). #101 had the comparison INVERTED —
// spend freely until the goal, then hoard forever after overshooting.
//
// Three things must all hold or the fixture proves nothing:
//   1. A CONFIGURED bonfire target. The default Rhypofarmstack is the [-1] "unset" sentinel, which
//      leaves hasBonfireTarget false and the clause INERT (#96). Seeded to [5] via corpus.mjs.
//   2. totalBonfires (0) < that target (5). Then the FIXED build conserves and the INVERTED one does
//      not — which is the whole divergence. Equal or above and both agree.
//   3. Requipon seeded TRUE. It defaults FALSE, and the Shield-conserve gate lives inside RautoEquip()
//      (AutoTrimps2.js:523) — without it that consumer never runs and the clause loses a sink.
// RAutoMaps must be > 0 too: the Rhypo(reset) call site is inside RautoMap() (maps.ts:1265).
//
// The world is deliberately NOT in Rhypofarmzone (left at its [-1] default), which makes this the
// clause under test and nothing else: outside a farm zone the other two conserve conditions are inert
// by construction (hypofarmzone.includes(world) is false, and hypoamountzones is undefined so
// targetprice is NaN and gofarmbonfire can never fire).
writeSave('10-hypo-u2', () => playForward(readSave('06-deep-u1'), {
  ticks: 300, seed: 1,
  atSettings: { RAutoMaps: 1, Requipon: true, Rhypoon: true, Rhypofarmstack: [5] },
  mutate: (w, g) => {
    toU2(w, g)
    g.global.challengeActive = 'Hypothermia'
    g.challenges.Hypothermia.totalBonfires = 0 // < the target of 5 (see 2 above)
    w.unlockBuilding('Smithy') // U2-only building (blockU1) — the wood sink the clause gates
    g.resources.wood.owned = 1e9
    g.resources.food.owned = 1e9
    g.resources.metal.owned = 1e9
  },
}))

// 11 · portal-U1 — the fixture for AT's HIGHEST-CONSEQUENCE action, which the net had never once seen.
//
// doPortal() had NEVER EXECUTED in a sim run (#127), for two independent reasons, and it is worth
// separating them because only one of them was the setTimeout stub:
//
//   1. `autoPortal()` returns immediately unless `game.global.portalActive` — no corpus save has it — and
//      the AutoPortal setting defaults to "Off". So the path was dark before timers even came into it.
//   2. In "Helium Per Hour" mode the portal itself is SCHEDULED (portal.ts:45, MODULES.portal.timeout +
//      100 = 5100ms), so the old `setTimeout = () => 0` stub swallowed it. Measured: with #126's timer
//      queue this save portals; with the stub reinstated it does not. ("Custom" mode calls doPortal()
//      synchronously, so it never depended on the timers — which is exactly why the two causes must not
//      be conflated.)
//
// He/Hr is the mode under test precisely BECAUSE it is the one the stub killed.
//
// It needs a He/hr HISTORY, and that is the non-obvious part: it portals when the current rate has fallen
// below the run's best by more than the buffer, and a synthetic save has NEITHER stat — `0 < 0` is false,
// so it never arms and the fixture would prove nothing (reach != sensitivity, again). Giving it a real
// best-this-run is what a genuine mid-run player carries. bestHeliumHourThisRun.evaluate() only ever
// RAISES storedValue (config.js:6378), so the value survives the load rather than being recomputed away.
//
// Generated at ticks: 0 ON PURPOSE. Play it forward at all and AT portals DURING GENERATION, and the
// committed save would be the post-portal state — a fresh z1 run, i.e. the exact thing the fixture exists
// to capture the approach to.
writeSave('11-portal-u1', () => playForward(readSave('06-deep-u1'), {
  ticks: 0, seed: 1,
  mutate: (_w, g) => {
    g.global.portalActive = true // the "Time portal" story unlock (config.js:10061)
    g.stats.bestHeliumHourThisRun.storedValue = 1e9
    g.stats.bestHeliumHourThisRun.atZone = 5
  },
}))

// 12 · warp-U1 — THE DEEP FIXTURE. The corpus topped out at world 8 (except 11's portal), so the entire
// late game — where players actually live — was structurally invisible to the net (#128). Above all:
//   · Warpstation — the dominant metal sink at depth (42.5% of metal spend at z63), unlocks at world 60
//   · Nursery     — heavily stacked at depth (measured 65 buys in this window alone)
//   · buyGemEfficientHousing's gem-efficiency ranking (buildings.ts) — only reaches Warpstation/Collector
//     tiers deep enough that they are unlocked, which never happened below z8
//
// This is CONSTRUCTIBLE only because #122 unfroze the metal economy. Pre-#122 AT soft-locked at world 6
// (metal.max pinned at 500, Forge never unlocked), which is why the note above USED to say deep states
// were unreachable. With the economy alive, a real post-portal perk spread carries 06-deep straight up:
// Warpstation unlocks at world 60 when planetBreaker() fires on the z60 Improbability kill (config.js:9295)
// — the game's OWN honest path, no poke. Measured: ~39k ticks to the unlock, world 62 shortly after.
//
// The perk spread is a fixture constant — PLAYER STATE, not game balance, exactly as 06/08 use it — and
// nothing outside this file reads it. It is a realistic mid-game portal spread chosen to clear the z6→z60
// damage walls with headroom; the levels are not tuning and were picked by measuring reach, not balance.
//
// untilWorld: 62 (not a fixed tick count) so the save lands JUST PAST the Warpstation unlock, where AT is
// still actively buying Warpstations — the recording window (corpus.mjs, 1500 ticks) then captures ~7
// Warpstation buys + ~65 Nursery buys + the full gem-housing ranking, live combat included. Sized for
// SENSITIVITY not volume (#105): a full run to z73 would bank 388 Nurseries and drown the trace.
//
// ACCEPTANCE IS A CENSUS RED, per #105: the `warpstation-noop` and `gem-housing-rank` mutations
// (blind-spot-census.mjs) must flip BLIND -> SEEN on this save. Reaching Warpstation is not the goal;
// making a Warpstation bug VISIBLE is. NB Gigastation stays blind even here — firstGiga() only arms when
// AT cannot afford Coordination (upgrades.ts:119), but Coordination tracks world 1:1 the whole way, so AT
// is never pop-blocked below z230. That is a separate reach≠sensitivity fixture (#128 follow-up).
writeSave('12-warp-u1', () => playForward(readSave('06-deep-u1'), {
  ticks: 200000, seed: 1, untilWorld: 62,
  mutate: (_w, g) => {
    // A realistic post-portal perk spread. Anticipation arms antiStacks (main.js:11682); the damage +
    // economy perks clear the z6→z60 walls. Player state only — no balance constant is touched.
    const perks = {
      Looting: 60, Toughness: 60, Power: 60, Motivation: 60, Pheromones: 30, Artisanistry: 40,
      Carpentry: 40, Resilience: 40, Coordinated: 20, Anticipation: 10, Siphonology: 3, Range: 10,
      Agility: 20, Bait: 10, Trumps: 20, Packrat: 20, Resourceful: 30, Overkill: 15,
    }
    for (const [perk, level] of Object.entries(perks)) if (g.portal[perk]) g.portal[perk].level = level
    g.global.totalPortals = 5
  },
}))

console.log('[make-fixtures] corpus written (12 saves: 3×U1 shallow + U2-radon + maps + deep + map-cap + starved + housing + hypo + portal + warp).')
console.log('[make-fixtures] reach is ASSERTED, not assumed — tests/sim/corpus-coverage.test.ts pins it. Re-record with `node scripts/sim/record-oracle.mjs`.')
