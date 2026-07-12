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
// Re-pinning is otherwise NOT routine: a naked oracle change is exactly the accidental-drift alarm
// this net exists to raise. Only re-pin behind a root-caused, reviewed, intentional behavior change.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, copyFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'

const TAG = 'oracle/v2-post-bugfix'
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
