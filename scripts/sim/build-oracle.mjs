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
// Re-pinning is otherwise NOT routine: a naked oracle change is exactly the accidental-drift alarm
// this net exists to raise. Only re-pin behind a root-caused, reviewed, intentional behavior change.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, copyFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'

const TAG = 'oracle/v3-u2-autobuildings'
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
