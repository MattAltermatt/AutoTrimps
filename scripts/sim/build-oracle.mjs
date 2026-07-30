// Build the frozen oracle bundle from a pinned tag. Uses a throwaway detached git worktree so the
// working tree is never touched, builds there, and copies the emitted bundle into
// tests/fixtures/oracle/. The committed result is the behavioral oracle the proof-net differential
// diffs against (see the Phase-0 plan + the proof-net design spec).
//
// ORACLE v2 (#66, 2026-07-12) — re-pinned from `oracle/phase1-faithful` (5e51f56d) to
// `oracle/v2-post-bugfix` (514b790d). Two reasons, both load-bearing:
//
//   1. phase1-faithful contains the #63 needGymystic bug (scienceNeeded permanently +5,000,000),
//      which we deliberately fixed and shipped. Diffing against it asserted "keep behaving like the
//      bug": on 02-mid-u1 the oracle computes scienceNeeded=5,001,452 and gathers science where the
//      fixed build computes 1,452 and gathers buildings — and every downstream buy timing cascades
//      from that. The (save,index,fn) waiver mechanism is built for a few LOCALIZED fix divergences,
//      not a whole shifted trajectory (~130 brittle entries), so re-pinning is the correct move.
//
//   2. Every trace ever recorded against phase1-faithful was recorded through a BLIND harness. Until
//      #66, boot.mjs left `usingRealTimeOffline` stuck true, so AT's mainLoop skipped
//      autoLevelEquipment() and setScienceNeeded() for the whole run — the old traces contain ZERO
//      buyEquipment events. The v2 traces contain them, so the L0 net is strictly MORE sensitive now
//      than it was before the re-pin, not less.
//
// ORACLE v3 (#69 ship C, 2026-07-12) — re-pinned from `oracle/v2-post-bugfix` (514b790d) to
// `oracle/v3-u2-autobuildings`. One cause, fully isolated:
//
//   `RBuyBuildingsNew` was declared 'boolean' with the STRING 'true', and its only gate is
//   `getPageSetting('RBuyBuildingsNew') == true` — which is false for a string. So `RbuyBuildings()`
//   had NEVER EXECUTED in production, for anyone, while the settings panel always rendered it ON.
//   In U2 the mainLoop never calls U1's buyBuildings(), so RbuyBuildings() is the ONLY building
//   automation — and its else-branch is also what enables vanilla AutoStorage. A dead setting left
//   U2 players with NEITHER housing NOR storage: measured on 04-u2-radon, every resource sits pegged
//   at 100% of cap, permanently, with all gathering income overflowing into the void.
//
// WHY THIS RE-PIN IS SAFE, AND HOW IT WAS CHECKED. baseline-zero reports "1167 divergences", which
// looks like the wholly-shifted trajectory the re-pin rule exists to refuse. It is not. Tallied BY
// EVENT rather than by index, oracle=1201 vs working=1204: every pre-existing event is UNCHANGED
// (300x each buyJob(Farmer|Lumberjack|Miner|Scientist) + 1 buyUpgrade(Speedminer)), and exactly THREE
// are INSERTED — buyBuilding(Barn) + buyBuilding(Shed) from the native AutoStorage this enables, and
// buyBuilding(House) from AT itself. Three insertions at tick 9 shift every later index; 1204-37=1167.
// Count the events before you believe a divergence count.
//
// ⚠️ The L0 net could NOT have vouched for this change on its own, and did not. The corpus saves all
// decode to HZE=3/world=4 and the recorder emits only buy events (#90/#98) — a 1,000,000x damage
// multiplier passes the whole sim suite GREEN. The evidence here is a 40,000-tick A/B on four U2
// states (+68% max population, +75% population, +22% science, no stall, no over-buy, no throw) plus a
// crash audit of the never-executed body, NOT a green net. See #98.
//
// ORACLE v4 (#105, 2026-07-14) — re-pinned from `oracle/v3-u2-autobuildings` to
// `oracle/v4-post-fix-sweep` (abd6b1c0). Forced, and the reason is the whole point of #105:
//
//   THE FROZEN ORACLE CARRIED THE VERY BUGS THE NEW FIXTURES EXIST TO CATCH.
//
//   v3 is pinned at 2026-07-12. #93 (mostEfficientHousing's divisor), #96 and #101 (Rhypo's bonfire
//   clause) all shipped AFTER it. So the v3 bundle contains, verbatim:
//
//       let housingBonus = game.buildings.Hut.increase.by                        <- #93's bug
//       if (reset && (gofarmbonfire || bonfire > getPageSetting2("Rhypofarmstack").slice(-1)))  <- #101's
//
//   Nobody noticed because THE CORPUS NEVER REACHED EITHER REGION — which is exactly what the
//   blind-spot census measured (both rows BLIND, 0/17). The stale oracle and the blind spots are the
//   SAME phenomenon, and adding the coverage is what exposes it.
//
//   It also INVERTS the census. That tool counts divergences of a mutated build against the committed
//   oracle traces. Restore #93's bug on a housing fixture and the mutated build AGREES with a v3
//   oracle — zero divergences, reported as BLIND — while the clean build is the one that diverges. A
//   census number only means anything when baseline-zero is zero.
//
// WHY THIS RE-PIN IS SAFE, AND HOW IT WAS CHECKED. baseline-zero was GREEN against v3 immediately
// before the re-pin: current src and the v3 bundle produce identical traces on the whole existing
// corpus. So re-recording 01-08 against v4 must reproduce them BYTE-IDENTICALLY — and it does (17/17,
// cmp-clean). That byte-identity is the proof this re-pin launders nothing: it changes behavior ONLY
// in the regions the old corpus could not see, where v3 is provably carrying known, reviewed, shipped
// fixes' predecessors. Repeat that check on any future re-pin.
//
// ORACLE v5 (Session 10 of the 2026-07-28 review-fix campaign, 2026-07-29) — re-pinned from
// `oracle/v4-post-fix-sweep` (abd6b1c0) to `oracle/v5-post-review-campaign` (f7b9ac86). The campaign
// closed 115 issues across nine sessions (128 filed — remediation found 26 of its own); 41 of them live
// in modules the L0 differential watches (39 at plan time plus #169/#170, re-milestoned out of Track A
// when they turned out to move three fixtures), so v4 was left deliberately stale for three sessions
// while the reds were COLLECTED rather than absorbed one at a time. This is that single absorption.
//
//   THE FROZEN v4 BUNDLE BUYS EQUIPMENT THE GAME REFUSES TO SELL, AND PRICES A NON-CRIT AT 1/2.5.
//
//   Four root causes explain all 14 moved fixtures, each measured on its own commit (see the
//   per-fixture attribution in tests/fixtures/traces/manifest.json):
//
//     #203/#220  mostEfficientEquipment ranked LOCKED slots and the always-level-2 block bought them
//                outright, so on the one Requipon fixture the oracle records buyEquipment("Arbalest")
//                and buyEquipment("Gambeson") — both locked — and then stalls at tick 2 buying nothing.
//     #169/#170  gammaBurstPct's sentinel was 1, not 0, and survived a heirloom swap down.
//     #290/#294  calc.ts treated formation 5 (uber-Wind) as a halving formation at four sites.
//     #199/#212  a non-crit was priced at getMegaCritDamageMult(0) = 1/critD, understating AT's own
//                damage by 2.5x on every zero-crit save — which is the whole shallow corpus.
//
// WHY THIS RE-PIN IS SAFE, AND HOW IT WAS CHECKED. Three independent controls, all of them numbers
// rather than arguments:
//
//   1. THE BUNDLE IS THE SAME BUNDLE. `cmp dist/autotrimps.user.js
//      tests/fixtures/oracle/autotrimps.oracle.user.js` exits 0 — the frozen v5 oracle is byte-identical
//      to the working build, so every move below is oracle-vs-oracle behaviour, with zero harness or
//      runtime drift mixed in. The runtime fingerprint is unchanged too (node v26.0.0 / jsdom 29.1.1 /
//      clone 5.10.1).
//   2. SEVEN FIXTURES REPRODUCE BYTE-IDENTICALLY. baseline-zero was green on exactly 7 of 21 against
//      v4 immediately before the re-record (02-mid-u1 x3, 04-u2-radon, 05-maps-u1, 09-housing-u2,
//      11-portal-u1) — and all 7 re-record byte-for-byte. Where the campaign should be inert it IS
//      inert, which is what separates a re-pin from a laundered regression.
//   3. EVERY MOVED FIXTURE IS ATTRIBUTED TO A NAMED COMMIT. A move nobody can name is a regression,
//      not a fix. `scripts/sim/event-diff.mjs` (committed for this, so the ledger's numbers are
//      re-derivable rather than retyped) counts the change BY EVENT — LCS over fn+args — because the
//      positional `diffTraces` count inflates a 697-edit change into "1991 divergences".
//
// Re-pinning is otherwise NOT routine: a naked oracle change is exactly the accidental-drift alarm
// this net exists to raise. Only re-pin behind a root-caused, reviewed, intentional behavior change.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, copyFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'

const TAG = 'oracle/v5-post-review-campaign'
const OUT = resolve('tests/fixtures/oracle/autotrimps.oracle.user.js')
const wt = mkdtempSync(join(tmpdir(), 'at-oracle-'))

try {
  execFileSync('git', ['worktree', 'add', '--detach', wt, TAG], { stdio: 'inherit' })
  execFileSync('npm', ['ci'], { cwd: wt, stdio: 'inherit' })
  execFileSync('npm', ['run', 'build'], { cwd: wt, stdio: 'inherit' })
  mkdirSync(resolve('tests/fixtures/oracle'), { recursive: true })
  copyFileSync(join(wt, 'dist/autotrimps.user.js'), OUT)
  console.log('[build-oracle] wrote', OUT)
} finally {
  try { execFileSync('git', ['worktree', 'remove', '--force', wt], { stdio: 'inherit' }) } catch {}
  rmSync(wt, { recursive: true, force: true })
}
