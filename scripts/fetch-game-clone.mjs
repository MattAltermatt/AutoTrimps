// The behavioral oracle's INPUT, materialized. Runs from `postinstall`, so `npm ci` alone gives you
// a working proof net — on a laptop, in a worktree, on a runner. That is the whole point (#67).
//
// #67: the proof net had never run in the deploy gate. The clone was a sibling directory you were
// expected to have cloned by hand, so `tests/sim/guard.ts` degraded 11 suites to `describe.skip`
// whenever it was absent — which, on CI, is always. vitest exited 0 and a real regression shipped
// green. The fix is NOT to make the skip loud; it is to make the clone ALWAYS PRESENT, so that no
// conditional-skip mechanism has any reason to exist. `guard.ts` is deleted, not repaired.
//
// This script is the single source of truth for WHICH game we test against. The pin lives in
// package.json `trimpsGame`; everything downstream is forced to agree with it:
//   package.json trimpsGame.sha      -> the bytes fetched here
//   package.json trimpsGame.version  -> cross-checked against the tree's own config.js stringVersion
//   tests/fixtures/traces/manifest.json .runtime.gameClone -> asserted equal, in tests/ci-gates.test.ts
// A clone bump is therefore a one-line edit that CANNOT silently disagree with the oracle traces.
//
// Refuses to fall back to a stale or wrong-SHA tree. A wrong oracle is worse than no oracle: it
// makes the net confidently assert the wrong baseline.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const DEST = resolve(ROOT, '.trimps-game')
const STAMP = join(DEST, '.pin')

const { trimpsGame: PIN } = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
if (!PIN?.repo || !PIN?.sha || !PIN?.version) {
  fail('package.json is missing the `trimpsGame` pin ({ repo, sha, version }).')
}

// An explicit clone always wins and is never touched — this is the escape hatch for A/B-ing a new
// upstream version, and for the dev workspace at ../trimps-game.
if (process.env.TRIMPS_GAME_DIR) {
  console.log(`[game-clone] TRIMPS_GAME_DIR is set (${process.env.TRIMPS_GAME_DIR}) — leaving it alone.`)
  process.exit(0)
}

// Warm path: correct SHA already on disk. No network — `npm ci` on a plane must not break.
if (existsSync(STAMP) && readFileSync(STAMP, 'utf8').trim() === PIN.sha) {
  process.exit(0)
}

console.log(`[game-clone] fetching ${PIN.repo}@${PIN.sha.slice(0, 10)} (v${PIN.version})…`)

const tmp = mkdtempSync(join(tmpdir(), 'trimps-clone-'))
try {
  // Shallow-fetch the exact commit. Cheaper than a full clone (~2 MB) and pinned by construction:
  // a SHA cannot drift the way a branch or tag can.
  execFileSync('git', ['init', '--quiet', tmp], { stdio: 'inherit' })
  execFileSync('git', ['-C', tmp, 'remote', 'add', 'origin', `https://github.com/${PIN.repo}.git`])
  execFileSync('git', ['-C', tmp, 'fetch', '--quiet', '--depth', '1', 'origin', PIN.sha], { stdio: 'inherit' })
  execFileSync('git', ['-C', tmp, 'checkout', '--quiet', 'FETCH_HEAD'], { stdio: 'inherit' })

  // Verify the fetched tree IS the game we think it is, BEFORE it becomes the oracle's input. This
  // is the executable link between the SHA pin and the human-readable version pin — without it the
  // two could drift and the net would diff against a different game than it recorded.
  const config = readFileSync(join(tmp, 'config.js'), 'utf8')
  const found = config.match(/stringVersion\s*[:=]\s*['"]([^'"]+)['"]/)?.[1]
  if (found !== PIN.version) {
    fail(
      `pin mismatch: package.json trimpsGame.version says "${PIN.version}", but ${PIN.sha.slice(0, 10)} ` +
        `ships stringVersion="${found}". Fix the pin — do NOT let the oracle run against a different game.`,
    )
  }

  writeFileSync(join(tmp, '.pin'), PIN.sha)
  rmSync(DEST, { recursive: true, force: true })
  renameSync(tmp, DEST) // atomic-ish: a half-fetched tree never becomes the oracle
  console.log(`[game-clone] ok — .trimps-game @ v${PIN.version}`)
} catch (err) {
  rmSync(tmp, { recursive: true, force: true })
  fail(
    `${err.message}\n\n` +
      `The proof net (tests/sim/**) cannot run without the game clone, and it will FAIL rather than\n` +
      `skip — that is deliberate (#67). To repair:  npm run game:fetch\n` +
      `To point at a clone you already have:        export TRIMPS_GAME_DIR=/path/to/trimps-game`,
  )
}

function fail(msg) {
  console.error(`[game-clone] ${msg}`)
  process.exit(1)
}
