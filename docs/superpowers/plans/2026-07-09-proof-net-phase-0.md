# Proof-Net Phase 0 — Oracle & Harness Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the behavioral proof-net harness that replaces byte-parity — a pinned faithful oracle, a frozen clock, a synthetic save corpus, a native-mutator action-trace recorder + differential, a known-diff manifest, and coverage instrumentation — proven by a baseline-zero differential (current `main` vs the oracle must trace-diff to ∅).

**Architecture:** Extends the existing `#45` self-play rig (`scripts/sim/*.mjs`: `boot.mjs`, `driver.mjs`, `seededRandom.mjs`). The oracle is commit `5e51f56d` (Phase-1 complete, last legacy-byte-faithful), built once and committed as a frozen bundle; its action traces (native-mutator `(tick, fn, args)` sequences over a synthetic 5-save corpus × 3 seeds) are committed as goldens. A refactored build is diffed against those committed traces, `actualDiff \ manifest == ∅` is the gate.

**Tech Stack:** Node ESM (`scripts/sim/*.mjs`), jsdom, vitest, esbuild, vitest `--coverage` (v8 provider), the game-native lz-string `save()`/`load()`, the `../trimps-game` v5.10.1 clone.

**Cross-cutting rule — every new test in this phase needs the clone**, so it MUST be wrapped in `describeSim` (`tests/sim/guard.ts`, shipped in `cc3be1e9`) so it runs locally and skips in CI. The Pages-deploy gate (`npm test`) stays green.

---

## File Structure

| Path | Responsibility | New/Mod |
| --- | --- | --- |
| `scripts/sim/build-oracle.mjs` | Check out `oracle/phase1-faithful`, build it, emit the frozen bundle | New |
| `tests/fixtures/oracle/autotrimps.oracle.user.js` | The committed frozen faithful bundle (the oracle) | New (committed) |
| `scripts/sim/clock.mjs` | Freeze `Date.now()`/`new Date()`/`performance.now()`, tie to `game.global.start+time` | New |
| `scripts/sim/make-fixtures.mjs` | Generate the 5 synthetic boundary saves from the engine | New |
| `tests/fixtures/saves/*.txt` | The 5 committed LZString save strings | New (committed) |
| `scripts/sim/recorder.mjs` | Wrap the native mutators, record `(tick, fn, args)` | New |
| `scripts/sim/trace.mjs` | `runTrace()` + `diffTraces()` | New |
| `scripts/sim/manifest.mjs` | Known-diff manifest: `applyManifest()` / `assertTraceMatches()` | New |
| `scripts/sim/record-oracle.mjs` | Produce the committed oracle traces from the frozen bundle | New |
| `tests/fixtures/traces/*.trace.json` + `manifest.json` | Committed oracle traces + (empty) waiver manifest | New (committed) |
| `scripts/sim/driver.mjs` | Install the frozen clock in `tickOnce` | Mod |
| `scripts/sim/boot.mjs` | `assertHydrated` wiring on the overlay path | Mod |
| `package.json` | `test:coverage` script | Mod |
| `tests/sim/{oracle,clock,saves,recorder,trace,manifest,baseline-zero}.test.ts` | Per-task tests | New |

---

## Task 1 · Pin & freeze the oracle bundle

**Files:** Create `scripts/sim/build-oracle.mjs`, `tests/sim/oracle.test.ts`; commit `tests/fixtures/oracle/autotrimps.oracle.user.js`.

- [ ] **Step 1 — Tag the oracle commit.**
```bash
git tag oracle/phase1-faithful 5e51f56d
git tag -n1 oracle/phase1-faithful   # verify: "feat(#31): convert final 12 modules to true TS — Phase 1 complete"
```

- [ ] **Step 2 — Write `scripts/sim/build-oracle.mjs`.** Builds the tagged commit in a throwaway worktree (never mutates the working tree) and copies the bundle into fixtures.
```js
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
  execFileSync('git', ['worktree', 'remove', '--force', wt], { stdio: 'inherit' })
  rmSync(wt, { recursive: true, force: true })
}
```

- [ ] **Step 3 — Run it and commit the frozen bundle.**
```bash
node scripts/sim/build-oracle.mjs
git add tests/fixtures/oracle/autotrimps.oracle.user.js
```

- [ ] **Step 4 — Write `tests/sim/oracle.test.ts`** asserting the pin is correct: the oracle bundle exists, is non-trivial, and **predates #39** (contains no `renderControlFace`) — a positive proof we pinned before the settings-render drift.
```ts
import { describeSim } from './guard'
import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describeSim('oracle bundle', () => {
  const src = readFileSync(resolve('tests/fixtures/oracle/autotrimps.oracle.user.js'), 'utf8')
  it('is a non-trivial userscript bundle', () => {
    expect(src.length).toBeGreaterThan(500_000)
    expect(src).toContain('AutoTrimps')
  })
  it('predates #39 (no renderControlFace / settingKind — confirms the oracle pin)', () => {
    expect(src).not.toContain('renderControlFace')
    expect(src).not.toContain('settingKind')
  })
})
```

- [ ] **Step 5 — Verify + commit.** Run `npx vitest run tests/sim/oracle.test.ts` (expect PASS). Then:
```bash
git add scripts/sim/build-oracle.mjs tests/sim/oracle.test.ts
git commit -m "feat(proof-net): pin + freeze the phase-1-faithful oracle bundle"
```

---

## Task 2 · Fake-clock shim (freeze + lockstep advance)

**Rationale:** Time-gated decisions (`maps.ts:372`, `jobs.ts:209`, `other.ts:1868`) read `new Date()`/`Date.now()`, which `driver.mjs` does NOT freeze — non-deterministic and degenerate in a tight loop. Tie the wall clock to the game's own `start + time` bookkeeping so it advances with ticks and is identical across builds.

**Files:** Create `scripts/sim/clock.mjs`, `tests/sim/clock.test.ts`; modify `scripts/sim/driver.mjs`.

- [ ] **Step 1 — Write `scripts/sim/clock.mjs`.**
```js
// Freeze the wall clock and slave it to the game's own time bookkeeping. After install,
// window.Date.now() === game.global.start + game.global.time, so every new Date()/Date.now()
// read advances deterministically with tick count (driver.mjs bumps game.global.time per tick).
export function installFrozenClock(window) {
  const g = window.game
  const now = () => (g.global.start || 0) + (g.global.time || 0)
  const RealDate = window.Date
  class FrozenDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now()])) }
    static now() { return now() }
  }
  window.Date = FrozenDate
  if (window.performance) window.performance.now = () => now()
}
```

- [ ] **Step 2 — Install it in `boot.mjs`/the trace path.** The recorder/trace runner (Task 5) calls `installFrozenClock(window)` right after `load(saveString)` and before AT init, so AT's first reads see the frozen clock. (No change to `tickOnce` needed — it already advances `game.global.time`, which the clock now mirrors.)

- [ ] **Step 3 — Write `tests/sim/clock.test.ts`.**
```ts
import { describeSim } from './guard'
import { it, expect } from 'vitest'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installFrozenClock } from '../../scripts/sim/clock.mjs'
import { runTicks } from '../../scripts/sim/driver.mjs'

describeSim('frozen clock', () => {
  it('Date.now() == start + time and advances by 1000/speed per tick', () => {
    const { window, game } = bootGame()
    installFrozenClock(window)
    const t0 = window.Date.now()
    expect(t0).toBe(game.global.start + game.global.time)
    runTicks(window, 100)
    expect(window.Date.now()).toBe(game.global.start + game.global.time)
    expect(window.Date.now() - t0).toBeCloseTo(100 * (1000 / game.settings.speed), 5)
  })

  it('is deterministic across two identical runs', () => {
    const read = () => { const { window } = bootGame(); installFrozenClock(window); runTicks(window, 250); return window.Date.now() }
    expect(read()).toBe(read())
  })
})
```

- [ ] **Step 4 — Verify + commit.** `npx vitest run tests/sim/clock.test.ts` (PASS), then:
```bash
git add scripts/sim/clock.mjs tests/sim/clock.test.ts
git commit -m "feat(proof-net): fake-clock shim slaved to game time bookkeeping"
```

---

## Task 3 · Synthetic save corpus (engine-generated)

**Rationale:** A fresh `newGame()` is inert (world 1 after 3000 AT ticks); the differential traces nothing without loaded states. The user is early-game, so **generate** the 5 boundary saves from the engine and commit them.

**Files:** Create `scripts/sim/make-fixtures.mjs`, `tests/sim/saves.test.ts`; commit `tests/fixtures/saves/{01-early-u1,02-postportal-u1,03-challenge-watch,04-u2-radon,05-deepzone}.txt`.

- [ ] **Step 1 — Investigation (produce a documented finding).** Read the clone's state-setup surface and record the minimal call sequence per state in a comment block at the top of `make-fixtures.mjs`:
  - `save(exportThis=true)` → returns the LZString string (`../trimps-game/main.js:53`).
  - `selectChallenge(what)` (`:1882`) — for the Watch challenge save.
  - `portalClicked` / `activatePortal` (`:1665` / `:3988`) — for the U2 portal transition; set `game.global.universe = 2` for radon.
  - Zone/resource setup: `game.global.world`, `game.resources.*`, unlock flags — set directly where no clean engine API exists (acceptable: the same save feeds both builds, §9 of the spec).

- [ ] **Step 2 — Write `scripts/sim/make-fixtures.mjs`.** One builder per state; each boots a fresh clone, drives it to the target, serializes, writes the string. Skeleton:
```js
import { bootGame } from './boot.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const DIR = resolve('tests/fixtures/saves'); mkdirSync(DIR, { recursive: true })
const dump = (name, window) => writeFileSync(resolve(DIR, name + '.txt'), window.save(true), 'utf8')

function earlyU1() {
  const { window, game } = bootGame()
  game.global.world = 5; game.resources.food.owned = 1e4; game.resources.wood.owned = 1e4
  dump('01-early-u1', window)
}
function postPortalU1() { /* boot, run to a portal-able zone or set portal.* + world ~60, dump '02-postportal-u1' */ }
function challengeWatch() { const { window } = bootGame(); window.selectChallenge('Watch'); /* set world ~20 */ dump('03-challenge-watch', window) }
function u2Radon() { const { window, game } = bootGame(); /* portalClicked -> universe=2, world>=300 setup */ dump('04-u2-radon', window) }
function deepZone() { const { window, game } = bootGame(); game.global.world = 230; /* spire-adjacent unlock */ dump('05-deepzone', window) }

for (const f of [earlyU1, postPortalU1, challengeWatch, u2Radon, deepZone]) f()
console.log('[make-fixtures] wrote 5 saves')
```
  *(Exact field-setup for states 2/4/5 is filled in during Step 1's investigation — each builder must leave a state that loads without throwing.)*

- [ ] **Step 3 — Generate + commit the saves.** `node scripts/sim/make-fixtures.mjs`, then `git add tests/fixtures/saves`.

- [ ] **Step 4 — Write `tests/sim/saves.test.ts`** — each save loads to the expected shape and passes the hydration tripwire.
```ts
import { describeSim } from './guard'
import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { assertHydrated } from '../harness/gameFixture'

const cases = [
  ['01-early-u1',        (g:any) => { expect(g.global.world).toBeGreaterThanOrEqual(5); expect(g.global.universe ?? 1).toBe(1) }],
  ['03-challenge-watch', (g:any) => expect(g.global.challengeActive).toBe('Watch')],
  ['04-u2-radon',        (g:any) => { expect(g.global.universe).toBe(2); expect(g.global.world).toBeGreaterThanOrEqual(300) }],
  ['05-deepzone',        (g:any) => expect(g.global.world).toBeGreaterThanOrEqual(200)],
] as const

describeSim('synthetic save corpus', () => {
  for (const [name, check] of cases) {
    it(`${name} loads to the expected boundary state + hydrated`, () => {
      const save = readFileSync(resolve('tests/fixtures/saves', name + '.txt'), 'utf8')
      const { game } = bootGame({ saveString: save })
      assertHydrated(game)
      check(game)
    })
  }
})
```

- [ ] **Step 5 — Verify + commit.** `npx vitest run tests/sim/saves.test.ts` (PASS), then:
```bash
git add scripts/sim/make-fixtures.mjs tests/sim/saves.test.ts tests/fixtures/saves
git commit -m "feat(proof-net): engine-generated 5-save boundary corpus"
```

---

## Task 4 · Native-mutator recorder

**Files:** Create `scripts/sim/recorder.mjs`, `tests/sim/recorder.test.ts`.

- [ ] **Step 1 — Write `scripts/sim/recorder.mjs`.** Wrap each native mutator on `window`; record `(tick, fn, args)`; call through. `tick` is read from a caller-supplied getter (the driver's tick counter).
```js
// The bot's entire externally-observable decision surface bottoms out in these native mutators.
const MUTATORS = ['buyJob', 'buyBuilding', 'buyUpgrade', 'runMap', 'selectMap', 'buyEquipment', 'setFormation', 'recycleMap']

const norm = (a) => a.map(x => (x && typeof x === 'object') ? JSON.stringify(x) : x)

export function installRecorder(window, getTick) {
  const trace = []
  for (const fn of MUTATORS) {
    const orig = window[fn]
    if (typeof orig !== 'function') continue
    window[fn] = function (...args) { trace.push({ tick: getTick(), fn, args: norm(args) }); return orig.apply(this, args) }
  }
  return trace
}
```

- [ ] **Step 2 — Write `tests/sim/recorder.test.ts`.** On a loaded save, an AT run emits a recognizable trace, and it is byte-identical across two runs (determinism = seed + clock + save fixed).
```ts
import { describeSim } from './guard'
import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installFrozenClock } from '../../scripts/sim/clock.mjs'
import { installSeededRandom } from '../../scripts/sim/seededRandom.mjs'
import { installRecorder } from '../../scripts/sim/recorder.mjs'
import { stepWithAT } from '../../scripts/sim/driver.mjs'

const SAVE = () => readFileSync(resolve('tests/fixtures/saves/01-early-u1.txt'), 'utf8')

function run(seed = 1, ticks = 400) {
  const { window } = bootGame({ withAutoTrimps: true, saveString: SAVE() })
  installSeededRandom(window, seed); installFrozenClock(window)
  let tick = 0
  const trace = installRecorder(window, () => tick)
  for (let i = 0; i < ticks; i++) { tick = i; stepWithAT(window, 1) }
  return trace
}

describeSim('native-mutator recorder', () => {
  it('records native-mutator calls with fn+args+tick', () => {
    const trace = run()
    expect(Array.isArray(trace)).toBe(true)
    for (const e of trace) expect(['buyJob','buyBuilding','buyUpgrade','runMap','selectMap','buyEquipment','setFormation','recycleMap']).toContain(e.fn)
  })
  it('is deterministic across two identical runs', () => {
    expect(run(7)).toEqual(run(7))
  })
})
```

- [ ] **Step 3 — Verify + commit.** `npx vitest run tests/sim/recorder.test.ts` (PASS), then:
```bash
git add scripts/sim/recorder.mjs tests/sim/recorder.test.ts
git commit -m "feat(proof-net): native-mutator action-trace recorder"
```

---

## Task 5 · Trace runner + differential diff

**Files:** Create `scripts/sim/trace.mjs`, `tests/sim/trace.test.ts`.

- [ ] **Step 1 — Write `scripts/sim/trace.mjs`.**
```js
import { bootGame } from './boot.mjs'
import { installFrozenClock } from './clock.mjs'
import { installSeededRandom } from './seededRandom.mjs'
import { installRecorder } from './recorder.mjs'
import { stepWithAT } from './driver.mjs'

export function runTrace({ atBundlePath, saveString, seed, ticks }) {
  const { window } = bootGame({ withAutoTrimps: true, atBundlePath, saveString })
  installSeededRandom(window, seed); installFrozenClock(window)
  let tick = 0
  const trace = installRecorder(window, () => tick)
  for (let i = 0; i < ticks; i++) { tick = i; stepWithAT(window, 1) }
  return trace
}

// First-divergence-oriented diff: ordered list of {index, oracle, working}.
export function diffTraces(oracle, working) {
  const out = []; const n = Math.max(oracle.length, working.length)
  for (let i = 0; i < n; i++) {
    const a = oracle[i], b = working[i]
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ index: i, oracle: a ?? null, working: b ?? null })
  }
  return out
}
```

- [ ] **Step 2 — Write `tests/sim/trace.test.ts`** — same bundle twice → empty diff; a mutated trace → caught at the right index.
```ts
import { describeSim } from './guard'
import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runTrace, diffTraces } from '../../scripts/sim/trace.mjs'

const SAVE = readFileSync(resolve('tests/fixtures/saves/01-early-u1.txt'), 'utf8')
const HEAD = resolve('dist/autotrimps.user.js') // must exist: run `npm run build` first

describeSim('trace runner + diff', () => {
  it('identical inputs → empty diff (determinism)', () => {
    const a = runTrace({ atBundlePath: HEAD, saveString: SAVE, seed: 1, ticks: 400 })
    const b = runTrace({ atBundlePath: HEAD, saveString: SAVE, seed: 1, ticks: 400 })
    expect(diffTraces(a, b)).toEqual([])
  })
  it('a synthetic divergence is caught at its index', () => {
    const a = runTrace({ atBundlePath: HEAD, saveString: SAVE, seed: 1, ticks: 400 })
    const b = a.map((e, i) => i === 0 ? { ...e, args: ['MUTATED'] } : e)
    const d = diffTraces(a, b)
    expect(d.length).toBeGreaterThan(0); expect(d[0].index).toBe(0)
  })
})
```

- [ ] **Step 3 — Verify + commit.** `npm run build` then `npx vitest run tests/sim/trace.test.ts` (PASS), then:
```bash
git add scripts/sim/trace.mjs tests/sim/trace.test.ts
git commit -m "feat(proof-net): trace runner + action-trace differential"
```

---

## Task 6 · Known-diff manifest

**Files:** Create `scripts/sim/manifest.mjs`, `tests/sim/manifest.test.ts`; commit `tests/fixtures/traces/manifest.json` = `{ "waivers": [] }`.

- [ ] **Step 1 — Write `scripts/sim/manifest.mjs`.** A waiver = `{ issue, save, index, fn, argsBefore, argsAfter }`. `applyManifest` splits a diff into unexplained (must be empty) vs unfired (warn).
```js
const key = (w) => `${w.save}#${w.index}#${w.fn}`

export function applyManifest(diff, save, manifest) {
  const waivers = (manifest.waivers || []).filter(w => w.save === save)
  const seen = new Set()
  const unexplained = diff.filter(d => {
    const w = waivers.find(w => w.index === d.index && w.fn === (d.working?.fn ?? d.oracle?.fn))
    if (w) { seen.add(key(w)); return false }
    return true
  })
  const unfired = waivers.filter(w => !seen.has(key(w)))
  return { unexplained, unfired }
}

export function assertTraceMatches(diff, save, manifest) {
  const { unexplained, unfired } = applyManifest(diff, save, manifest)
  if (unfired.length) console.warn(`[manifest] ${unfired.length} unfired waiver(s) for ${save} — corpus may not reach the fix`)
  if (unexplained.length) throw new Error(`[manifest] ${unexplained.length} UNEXPLAINED divergence(s) for ${save}: ${JSON.stringify(unexplained.slice(0,3))}`)
}
```

- [ ] **Step 2 — Commit the empty manifest.** Write `tests/fixtures/traces/manifest.json` = `{ "waivers": [] }`.

- [ ] **Step 3 — Write `tests/sim/manifest.test.ts`** covering the four cases: empty+empty → pass; matching waiver → pass; extra divergence → throw; unfired → warn (no throw).
```ts
import { it, expect, vi } from 'vitest'  // pure-logic: no clone → plain it()
import { applyManifest, assertTraceMatches } from '../../scripts/sim/manifest.mjs'

const diff = [{ index: 3, oracle: { fn: 'buyJob', args: [5] }, working: { fn: 'buyJob', args: [6] } }]
const waiver = { issue: '#32', save: 's1', index: 3, fn: 'buyJob', argsBefore: [5], argsAfter: [6] }

it('empty diff + empty manifest → no unexplained', () => {
  expect(applyManifest([], 's1', { waivers: [] }).unexplained).toEqual([])
})
it('a matching waiver explains the divergence', () => {
  expect(applyManifest(diff, 's1', { waivers: [waiver] }).unexplained).toEqual([])
})
it('an unwaived divergence throws', () => {
  expect(() => assertTraceMatches(diff, 's1', { waivers: [] })).toThrow(/UNEXPLAINED/)
})
it('an unfired waiver warns but does not throw', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  expect(() => assertTraceMatches([], 's1', { waivers: [waiver] })).not.toThrow()
  expect(warn).toHaveBeenCalled(); warn.mockRestore()
})
```

- [ ] **Step 4 — Verify + commit.** `npx vitest run tests/sim/manifest.test.ts` (PASS), then:
```bash
git add scripts/sim/manifest.mjs tests/fixtures/traces/manifest.json tests/sim/manifest.test.ts
git commit -m "feat(proof-net): known-diff manifest (waiver reconciliation)"
```

---

## Task 7 · Record & commit oracle traces + coverage wiring

**Files:** Create `scripts/sim/record-oracle.mjs`; commit `tests/fixtures/traces/*.trace.json`; modify `package.json`.

- [ ] **Step 1 — Write `scripts/sim/record-oracle.mjs`.** For each committed save × seed ∈ {1,2,3}, `runTrace` against the **frozen oracle bundle** and write the trace.
```js
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { runTrace } from './trace.mjs'

const ORACLE = resolve('tests/fixtures/oracle/autotrimps.oracle.user.js')
const SAVES = readdirSync(resolve('tests/fixtures/saves')).filter(f => f.endsWith('.txt'))
for (const s of SAVES) {
  const saveString = readFileSync(resolve('tests/fixtures/saves', s), 'utf8')
  for (const seed of [1, 2, 3]) {
    const trace = runTrace({ atBundlePath: ORACLE, saveString, seed, ticks: 1500 })
    const name = `${s.replace(/\.txt$/, '')}.${seed}.trace.json`
    writeFileSync(resolve('tests/fixtures/traces', name), JSON.stringify(trace), 'utf8')
    console.log('[record-oracle]', name, trace.length, 'events')
  }
}
```

- [ ] **Step 2 — Generate + commit traces.** `node scripts/sim/record-oracle.mjs`, then `git add tests/fixtures/traces/*.trace.json`.

- [ ] **Step 3 — Wire coverage.** Add to `package.json` scripts: `"test:coverage": "vitest run --coverage"`; ensure `@vitest/coverage-v8` is a devDependency and `coverage.include = ['src/**']` in the vitest config. Document that `npm run test:coverage` publishes the covered line/branch set that gates which lines a refactor may touch.

- [ ] **Step 4 — Verify + commit.** `npm run test:coverage` runs clean; a spot check that a committed trace is non-empty. Then:
```bash
git add scripts/sim/record-oracle.mjs tests/fixtures/traces package.json
git commit -m "feat(proof-net): record oracle traces + coverage wiring"
```

---

## Task 8 · Baseline-zero validation + `assertHydrated` wiring

**Rationale:** The keystone. The **current `main` build vs the oracle traces, with zero modernization, must diff to ∅** — this validates the whole harness AND confirms #33–#39 were behavior-preserving on the decision path. A non-empty result is a real finding (drift, or a harness bug), documented before proceeding.

**Files:** Create `tests/sim/baseline-zero.test.ts`; modify `scripts/sim/boot.mjs`.

- [ ] **Step 1 — Wire `assertHydrated` (guardrail 5).** `boot.mjs` is `.mjs` and can't import the `.ts` fixture at runtime, so inline the identical check (from `gameFixture.ts:44`) directly in `bootGame`, right after `if (saveString) window.load(saveString)`, so every trace run is tripwire-guarded:
```js
// Anti-false-green tripwire (mirrors tests/harness/gameFixture.ts:44): a hydrated game keeps its methods.
if (typeof window.game?.buildings?.Shed?.cost?.wood !== 'function') {
  throw new Error('boot: game not hydrated — buildings.Shed.cost.wood is not a function')
}
```

- [ ] **Step 2 — Write `tests/sim/baseline-zero.test.ts`.**
```ts
import { describeSim } from './guard'
import { it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { runTrace, diffTraces } from '../../scripts/sim/trace.mjs'
import { assertTraceMatches } from '../../scripts/sim/manifest.mjs'

const HEAD = resolve('dist/autotrimps.user.js')  // build HEAD first: npm run build
const manifest = JSON.parse(readFileSync(resolve('tests/fixtures/traces/manifest.json'), 'utf8'))

describeSim('baseline-zero (HEAD vs oracle traces == empty)', () => {
  const traces = readdirSync(resolve('tests/fixtures/traces')).filter(f => f.endsWith('.trace.json'))
  for (const tf of traces) {
    it(`${tf}: current build reproduces the oracle trace`, () => {
      const [save, seed] = tf.replace(/\.trace\.json$/, '').split(/\.(?=\d+$)/)
      const oracle = JSON.parse(readFileSync(resolve('tests/fixtures/traces', tf), 'utf8'))
      const saveString = readFileSync(resolve('tests/fixtures/saves', save + '.txt'), 'utf8')
      const working = runTrace({ atBundlePath: HEAD, saveString, seed: Number(seed), ticks: 1500 })
      expect(() => assertTraceMatches(diffTraces(oracle, working), save, manifest)).not.toThrow()
    })
  }
})
```

- [ ] **Step 3 — Run + interpret.** `npm run build` then `npx vitest run tests/sim/baseline-zero.test.ts`. **Expected: PASS.** If any save diverges, STOP and document: is it a `byId`/#39 behavior change (a real post-Phase-1 drift → file an issue) or a harness nondeterminism bug (fix the harness)? Do not proceed to Phase 1 until baseline-zero is green or every divergence is explained + waived.

- [ ] **Step 4 — Verify + commit.**
```bash
git add scripts/sim/boot.mjs tests/sim/baseline-zero.test.ts
git commit -m "feat(proof-net): baseline-zero validation + assertHydrated wiring"
```

---

## Definition of Done (Phase 0)

- [ ] `oracle/phase1-faithful` tag exists; frozen oracle bundle committed.
- [ ] Frozen clock deterministic; sim tests green locally, skipped in CI (`describeSim`).
- [ ] 5 synthetic saves committed; each loads to its boundary state + passes `assertHydrated`.
- [ ] Recorder + trace + diff + manifest implemented and unit-tested (determinism proven).
- [ ] Oracle traces (5 saves × 3 seeds) committed; coverage wired (`npm run test:coverage`).
- [ ] **Baseline-zero green** (or every divergence explained + waived + documented).
- [ ] `npm run typecheck` + `npm run lint` + `npm test` (CI path) all green.

Then squash → FF-merge `feature/proof-net-modernization` → `main` → delete branch. Phase 1 (beachhead `jobs.ts`) plans next, against the now-working harness.
