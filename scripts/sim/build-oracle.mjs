// Build the frozen faithful oracle bundle from the pinned tag `oracle/phase1-faithful`
// (commit 5e51f56d — Phase 1 complete, last legacy-byte-faithful). Uses a throwaway detached
// git worktree so the working tree is never touched, builds there, and copies the emitted
// bundle into tests/fixtures/oracle/. The committed result is the behavioral oracle the
// proof-net differential diffs against (see the Phase-0 plan + the proof-net design spec).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, copyFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'

const TAG = 'oracle/phase1-faithful'
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
