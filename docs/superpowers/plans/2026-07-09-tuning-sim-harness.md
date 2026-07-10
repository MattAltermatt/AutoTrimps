# Tuning-Analysis Simulation Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable harness that boots the real Trimps game headless, drives it at ~1.2 game-hr/wall-sec, sweeps a parameter, and reports outcomes — so tuning questions (first: #40 scientist share) are answered empirically.

**Architecture:** Node+jsdom boots the game's 7 JS files into one shared scope (proven). A driver advances state by calling the active-play tick `gameLoop(null)` directly (never the offline `gameLoop(true)`, never the wall-clock scheduler `gameTimeout`). A sweep runner seeds `Math.random` and averages N runs per parameter cell. A closed-form oracle predicts the same optimum for cross-check. A one-time Chrome differential validates fidelity.

**Tech Stack:** Node ESM (`.mjs` scripts, matching `scripts/build-userscript.mjs`), `jsdom` ^29 (already a devDep), `vitest` ^4 (tests import `.mjs` scripts, matching `tests/src-bundle-parity.test.ts`).

## Global Constraints

Every task implicitly includes these (from the design spec §4):

- **`gameLoop(null)` only, never `gameLoop(true)`** — `makeUp=true` makes `craftBuildings` (`main.js:4918`) complete builds instantly (offline divergence). `null` is the only faithful active path.
- **Tick count is the clock** — `game.global.time` is advanced by `gameTimeout` (unused here), not by `gameLoop`. Drive duration/maturity by tick count.
- **Seed the RNG for any run that reaches combat** — crit/dodge use unseeded `Math.random` (41 sites); install a seeded PRNG and average N runs per cell.
- **The harness never writes a game balance constant.** It emits *recommendations*; tuning values stay user-gated.
- **Game dir resolution:** `process.env.TRIMPS_GAME_DIR || <sibling ../../../trimps-game>`, matching `scripts/serve-game.mjs:7`.

---

## File Structure

```
scripts/sim/
  boot.mjs          # bootGame() → { window, game, dom } — jsdom + stubs + concat-eval
  driver.mjs        # runTicks / runUntil / ticksToZone / stepWithAT (lockstep AT interleave)
  metrics.mjs       # snapshot(game) — pure outcome readers, no mutation
  seededRandom.mjs  # mulberry32 + installSeededRandom(window, seed)
  sweep.mjs         # sweep({values, seeds, runOne, bootOpts}) → [{value, mean, samples}]
  oracle/jobs.mjs   # optimalScientistShare(...) — Approach-B closed-form cross-check
  run-40-scientist-sweep.mjs  # #45's proof-of-use: sim vs oracle for #40 (emits a table)
tests/sim/
  boot.test.ts  driver.test.ts  metrics.test.ts  sweep.test.ts
  at-driven.test.ts  oracle.jobs.test.ts
docs/superpowers/validation/
  2026-07-09-fidelity-gate.md  # Approach-C Chrome differential procedure + recorded result
```

---

### Task 1: `boot.mjs` — headless game boot

**Files:**
- Create: `scripts/sim/boot.mjs`
- Test: `tests/sim/boot.test.ts`

**Interfaces:**
- Produces: `bootGame({ gameDir?, withAutoTrimps?, atBundlePath? }) => { window, game, dom }`. `DEFAULT_GAME_DIR` export.

- [ ] **Step 1: Write the failing test**

```ts
// tests/sim/boot.test.ts
import { describe, it, expect } from 'vitest'
import { bootGame } from '../../scripts/sim/boot.mjs'

describe('sim/boot', () => {
  it('boots the game into jsdom with a live game object at world 1', () => {
    const { game } = bootGame()
    expect(typeof game).toBe('object')
    expect(game.global.world).toBe(1)
  })

  it('passes the anti-false-green tripwire (game methods are real functions)', () => {
    const { game } = bootGame()
    expect(typeof game.buildings.Shed.cost.wood).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sim/boot.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/sim/boot.mjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/sim/boot.mjs
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
export const DEFAULT_GAME_DIR =
  process.env.TRIMPS_GAME_DIR || resolve(HERE, '../../../trimps-game')

// Order matters: cross-file bare-identifier refs only resolve in one shared scope.
const GAME_FILES = ['lz-string.js', 'decimal.min.js', 'config.js', 'updates.js', 'playerSpire.js', 'objects.js', 'main.js']

export function bootGame({ gameDir = DEFAULT_GAME_DIR, withAutoTrimps = false, atBundlePath } = {}) {
  const html = readFileSync(resolve(gameDir, 'index.html'), 'utf8')
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' })
  const { window } = dom

  // Stubs: jsdom has no canvas; suppress the game's self-scheduling loop so we drive ticks manually.
  window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) })
  window.setTimeout = () => 0
  window.setInterval = () => 0
  window.requestAnimationFrame = () => 0
  Object.assign(window, { usingScreenReader: false, usingRealTimeOffline: false, playFabId: -1 })

  // Concatenate all files and eval ONCE (per-file eval breaks cross-file refs).
  let combined = ''
  for (const f of GAME_FILES) combined += readFileSync(resolve(gameDir, f), 'utf8') + '\n;\n'
  window.eval(combined)

  if (withAutoTrimps) {
    const at = atBundlePath || resolve(HERE, '../../dist/autotrimps.user.js')
    Object.assign(window, { GM_getValue: () => undefined, GM_setValue: () => {}, GM_xmlhttpRequest: () => {}, unsafeWindow: window })
    window.eval(readFileSync(at, 'utf8'))
  }

  return { window, game: window.game, dom }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sim/boot.test.ts`
Expected: PASS (2 tests). Boot takes ~1s (evals ~40k lines) — normal.

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/boot.mjs tests/sim/boot.test.ts
git commit -m "feat(sim): headless game boot via jsdom (#45)"
```

---

### Task 2: `driver.mjs` — active-path tick loop

**Files:**
- Create: `scripts/sim/driver.mjs`
- Test: `tests/sim/driver.test.ts`

**Interfaces:**
- Consumes: `bootGame` from Task 1.
- Produces: `runTicks(window, count) => void`; `runUntil(window, predicate, maxTicks?) => { ticks, reached }`; `ticksToZone(window, targetZone, maxTicks?) => { ticks, reached }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/sim/driver.test.ts
import { describe, it, expect } from 'vitest'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { runTicks, runUntil } from '../../scripts/sim/driver.mjs'

describe('sim/driver', () => {
  it('gameLoop(null) accumulates gathered resources over ticks', () => {
    const { window, game } = bootGame()
    game.global.playerGathering = 'wood'
    const before = game.resources.wood.owned
    runTicks(window, 300)
    expect(game.resources.wood.owned).toBeGreaterThan(before)
  })

  it('runUntil stops as soon as the predicate holds and reports tick count', () => {
    const { window, game } = bootGame()
    game.global.playerGathering = 'wood'
    const { ticks, reached } = runUntil(window, g => g.resources.wood.owned >= 50, 100000)
    expect(reached).toBe(true)
    expect(ticks).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sim/driver.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/sim/driver.mjs
// Advance the ACTIVE-play path. Never gameLoop(true) (offline craft divergence),
// never gameTimeout (wall-clock scheduler). Tick count is the clock.
export function runTicks(window, count) {
  for (let i = 0; i < count; i++) window.gameLoop(null)
}

export function runUntil(window, predicate, maxTicks = 5_000_000) {
  let ticks = 0
  while (!predicate(window.game) && ticks < maxTicks) {
    window.gameLoop(null)
    ticks++
  }
  return { ticks, reached: predicate(window.game) }
}

export function ticksToZone(window, targetZone, maxTicks = 5_000_000) {
  return runUntil(window, g => g.global.world >= targetZone, maxTicks)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sim/driver.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/driver.mjs tests/sim/driver.test.ts
git commit -m "feat(sim): active-path tick driver (runTicks/runUntil/ticksToZone) (#45)"
```

---

### Task 3: `metrics.mjs` — pure outcome readers

**Files:**
- Create: `scripts/sim/metrics.mjs`
- Test: `tests/sim/metrics.test.ts`

**Interfaces:**
- Produces: `snapshot(game) => { world, food, wood, metal, science, trimps, maxTrimps, scientists, farmers }` (all numbers; pure read, no mutation).

- [ ] **Step 1: Write the failing test**

```ts
// tests/sim/metrics.test.ts
import { describe, it, expect } from 'vitest'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { snapshot } from '../../scripts/sim/metrics.mjs'

describe('sim/metrics', () => {
  it('reads a stable numeric shape from a booted game', () => {
    const { game } = bootGame()
    const s = snapshot(game)
    expect(s.world).toBe(1)
    for (const k of ['food', 'wood', 'metal', 'science', 'trimps', 'scientists']) {
      expect(typeof s[k]).toBe('number')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sim/metrics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/sim/metrics.mjs
export function snapshot(game) {
  const r = game.resources
  return {
    world: game.global.world,
    food: Math.floor(r.food.owned),
    wood: Math.floor(r.wood.owned),
    metal: Math.floor(r.metal.owned),
    science: Math.floor(r.science?.owned ?? 0),
    trimps: Math.floor(r.trimps.owned),
    maxTrimps: Math.floor(r.trimps.realMax?.() ?? 0),
    scientists: game.jobs.Scientist?.owned ?? 0,
    farmers: game.jobs.Farmer?.owned ?? 0,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sim/metrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/metrics.mjs tests/sim/metrics.test.ts
git commit -m "feat(sim): pure outcome-snapshot reader (#45)"
```

---

### Task 4: `seededRandom.mjs` + `sweep.mjs` — deterministic parameter sweep

**Files:**
- Create: `scripts/sim/seededRandom.mjs`, `scripts/sim/sweep.mjs`
- Test: `tests/sim/sweep.test.ts`

**Interfaces:**
- Produces: `mulberry32(seed) => () => number`; `installSeededRandom(window, seed) => void`; `sweep({ values, seeds, runOne, bootOpts? }) => [{ value, mean, samples }]` where `runOne(window, game, value) => number`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/sim/sweep.test.ts
import { describe, it, expect } from 'vitest'
import { sweep } from '../../scripts/sim/sweep.mjs'
import { runTicks } from '../../scripts/sim/driver.mjs'

describe('sim/sweep', () => {
  const runOne = (window, game) => {
    game.global.playerGathering = 'wood'
    runTicks(window, 200)
    return Math.floor(game.resources.wood.owned)
  }

  it('same seeds → identical samples (determinism)', () => {
    const a = sweep({ values: [0], seeds: [1], runOne })
    const b = sweep({ values: [0], seeds: [1], runOne })
    expect(a[0].samples).toEqual(b[0].samples)
  })

  it('averages N seeds into a mean per value', () => {
    const r = sweep({ values: [0], seeds: [1, 2, 3], runOne })
    expect(r[0].samples).toHaveLength(3)
    expect(r[0].mean).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sim/sweep.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/sim/seededRandom.mjs
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function installSeededRandom(window, seed) {
  window.Math.random = mulberry32(seed)
}
```

```js
// scripts/sim/sweep.mjs
import { bootGame } from './boot.mjs'
import { installSeededRandom } from './seededRandom.mjs'

// runOne(window, game, value) => metric number. One fresh boot per (value, seed).
export function sweep({ values, seeds, runOne, bootOpts } = {}) {
  const results = []
  for (const value of values) {
    const samples = []
    for (const seed of seeds) {
      const { window, game } = bootGame(bootOpts)
      installSeededRandom(window, seed)
      samples.push(runOne(window, game, value))
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    results.push({ value, mean, samples })
  }
  return results
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sim/sweep.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/seededRandom.mjs scripts/sim/sweep.mjs tests/sim/sweep.test.ts
git commit -m "feat(sim): seeded-RNG deterministic parameter sweep (#45)"
```

---

### Task 5: AutoTrimps-driven lockstep run (fidelity-critical)

**Files:**
- Modify: `scripts/sim/driver.mjs` (add `stepWithAT`)
- Test: `tests/sim/at-driven.test.ts`

**Interfaces:**
- Consumes: `bootGame({ withAutoTrimps: true })`.
- Produces: `stepWithAT(window, ticks, atEvery?) => void` — advances the game AND runs AutoTrimps' `mainLoop` in lockstep (default every tick, matching real play's ~1 AT decision per game-tick).

> **Note (spec risk #1):** AutoTrimps' `mainLoop` (`AutoTrimps2.js:143`) may hit a DOM element absent from the headless page. Step 2 captures the FIRST such error so it can be triaged (add a targeted DOM stub in `boot.mjs`, or fall back to a scripted-settings driver). Do not paper over it with a blanket try/catch — a swallowed AT error means the sim silently measures the wrong controller.

- [ ] **Step 1: Write the failing test**

```ts
// tests/sim/at-driven.test.ts
import { describe, it, expect } from 'vitest'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { stepWithAT } from '../../scripts/sim/driver.mjs'

describe('sim/at-driven', () => {
  it('AutoTrimps mainLoop drives the game (jobs hired or zone advances)', () => {
    const { window, game } = bootGame({ withAutoTrimps: true })
    expect(typeof window.mainLoop).toBe('function')
    const beforeWorld = game.global.world
    const beforeWorkers = (game.jobs.Farmer?.owned ?? 0) + (game.jobs.Scientist?.owned ?? 0)
    stepWithAT(window, 3000)
    const afterWorkers = (game.jobs.Farmer?.owned ?? 0) + (game.jobs.Scientist?.owned ?? 0)
    expect(game.global.world > beforeWorld || afterWorkers > beforeWorkers).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails — and triage any AT error**

Run: `npx vitest run tests/sim/at-driven.test.ts`
Expected: FAIL — `stepWithAT` not defined. If, after Step 3, it fails instead with an AT `mainLoop` error (e.g. `Cannot read properties of null (reading 'style')`), record the exact message + the `getElementById` it wants, then add that element to the jsdom page or stub the property in `boot.mjs`. Re-run until AT drives cleanly.

- [ ] **Step 3: Write minimal implementation**

```js
// append to scripts/sim/driver.mjs
export function stepWithAT(window, ticks, atEvery = 1) {
  const mainLoop = window.mainLoop
  if (typeof mainLoop !== 'function') {
    throw new Error('AutoTrimps mainLoop not found — boot with { withAutoTrimps: true }')
  }
  for (let i = 0; i < ticks; i++) {
    window.gameLoop(null)
    if (i % atEvery === 0) mainLoop()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sim/at-driven.test.ts`
Expected: PASS. (If AT cannot run headless after reasonable DOM stubbing, STOP and report — the fallback scripted-settings driver is a scope change worth a checkpoint, not a silent pivot.)

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/driver.mjs tests/sim/at-driven.test.ts boot.mjs 2>/dev/null; git add scripts/sim/boot.mjs
git commit -m "feat(sim): AutoTrimps-driven lockstep run (#45)"
```

---

### Task 6: `oracle/jobs.mjs` — closed-form scientist-share cross-check

**Files:**
- Create: `scripts/sim/oracle/jobs.mjs`
- Test: `tests/sim/oracle.jobs.test.ts`

**Interfaces:**
- Produces: `optimalScientistShare({ workspaces, speedscienceCount?, targetScience, targetResource, resourceSplit? }) => number` in (0,1). Approach-B independent prediction for cross-checking the sim.

**Model (spec §2, from the analytical-model agent):** science rate `= 0.5·1.25^k·s·W`; binding-resource rate `= 0.5·(1−s)·W/split`. The optimum `s*` is where time-to-target-science equals time-to-target-resource: `s* = A / (A + B)`, with `A = targetScience·resCoef`, `B = targetResource·sciCoef`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/sim/oracle.jobs.test.ts
import { describe, it, expect } from 'vitest'
import { optimalScientistShare } from '../../scripts/sim/oracle/jobs.mjs'

describe('sim/oracle/jobs', () => {
  const base = { workspaces: 100, targetScience: 1000, targetResource: 1000 }

  it('returns a share strictly in (0,1)', () => {
    const s = optimalScientistShare(base)
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(1)
  })

  it('more science needed → more scientists', () => {
    expect(optimalScientistShare({ ...base, targetScience: 4000 }))
      .toBeGreaterThan(optimalScientistShare(base))
  })

  it('more Speedscience (cheaper science) → fewer scientists', () => {
    expect(optimalScientistShare({ ...base, speedscienceCount: 4 }))
      .toBeLessThan(optimalScientistShare({ ...base, speedscienceCount: 0 }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sim/oracle.jobs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/sim/oracle/jobs.mjs
// Approach-B closed form. Constants mirrored from ../trimps-game (config.js:11876 job
// modifier 0.5; config.js:13075 Speedscience 1.25). A constant-parity guard (Task-6
// follow-up, tracked in #46) should assert these still match the clone.
export function optimalScientistShare({
  workspaces,
  speedscienceCount = 0,
  targetScience,
  targetResource,
  resourceSplit = 3,
}) {
  const sciCoef = 0.5 * Math.pow(1.25, speedscienceCount) * workspaces
  const resCoef = (0.5 * workspaces) / resourceSplit
  const A = targetScience * resCoef
  const B = targetResource * sciCoef
  return A / (A + B)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sim/oracle.jobs.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/oracle/jobs.mjs tests/sim/oracle.jobs.test.ts
git commit -m "feat(sim): closed-form scientist-share oracle (#45)"
```

---

### Task 7: `run-40-scientist-sweep.mjs` — harness proof-of-use for #40

**Files:**
- Create: `scripts/sim/run-40-scientist-sweep.mjs`

**Interfaces:**
- Consumes: `bootGame`, `stepWithAT`, `ticksToZone`, `snapshot`, `sweep`, `optimalScientistShare`.
- Produces: a runnable analysis script (not a unit test) that prints a table of `scientist-share → ticks-to-zone-N (mean over seeds)` beside the oracle's predicted optimum.

> This proves the harness answers #40 end-to-end. It does **not** edit `jobs.ts` or change any tuning constant — applying a chosen value is issue #40's job, user-gated.

- [ ] **Step 1: Write the script**

```js
// scripts/sim/run-40-scientist-sweep.mjs
import { bootGame } from './boot.mjs'
import { stepWithAT, ticksToZone } from './driver.mjs'
import { snapshot } from './metrics.mjs'
import { installSeededRandom } from './seededRandom.mjs'
import { optimalScientistShare } from './oracle/jobs.mjs'

const TARGET_ZONE = Number(process.env.SIM_ZONE ?? 10)
const SEEDS = [1, 2, 3]
// Scientist ratio is a DIVISOR (scientists ≈ workers ÷ divisor). Smaller = more scientists.
const DIVISORS = [25, 15, 10, 6, 4]

function runOne(divisor, seed) {
  const { window, game } = bootGame({ withAutoTrimps: true })
  installSeededRandom(window, seed)
  window.MODULES.jobs.scientistRatio = divisor // sweep the setting, not a game constant
  // warm the opening so AT has workers, then time the climb to TARGET_ZONE
  stepWithAT(window, 2000)
  const { ticks, reached } = (function () {
    let t = 0
    while (game.global.world < TARGET_ZONE && t < 4_000_000) { window.gameLoop(null); if (t % 1 === 0) window.mainLoop(); t++ }
    return { ticks: t, reached: game.global.world >= TARGET_ZONE }
  })()
  return { ticks, reached, snap: snapshot(game) }
}

console.log(`# #40 scientist-share sweep → ticks to zone ${TARGET_ZONE} (mean of ${SEEDS.length} seeds)`)
for (const divisor of DIVISORS) {
  const samples = SEEDS.map(s => runOne(divisor, s)).filter(r => r.reached).map(r => r.ticks)
  const mean = samples.length ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : NaN
  console.log(`divisor=${String(divisor).padStart(3)}  ~${(1 / divisor * 100).toFixed(1)}% scientists  →  ${mean} ticks  (${samples.length}/${SEEDS.length} reached)`)
}
const sStar = optimalScientistShare({ workspaces: 100, targetScience: 5000, targetResource: 5000, speedscienceCount: 2 })
console.log(`\n# oracle predicted optimal scientist share ≈ ${(sStar * 100).toFixed(1)}%  (≈ divisor ${(1 / sStar).toFixed(1)})`)
```

- [ ] **Step 2: Run the script and capture output**

Run: `node scripts/sim/run-40-scientist-sweep.mjs`
Expected: a printed table (divisor → ticks) plus the oracle's predicted optimum. The fastest divisor and the oracle's `1/s*` should be in the same ballpark; a wild mismatch is a signal to investigate (sim bug, oracle bug, or the `stepWithAT` cadence).

- [ ] **Step 3: Commit (script + a captured sample in the commit body)**

```bash
git add scripts/sim/run-40-scientist-sweep.mjs
git commit -m "feat(sim): #40 scientist-share sweep vs oracle (harness proof-of-use) (#45)"
```

---

### Task 8: Fidelity validation gate (Approach C — Chrome differential) — LEAD-INLINE

**Files:**
- Create: `docs/superpowers/validation/2026-07-09-fidelity-gate.md`
- Create: `scripts/sim/record-trajectory.mjs`

**Interfaces:**
- Produces: `record-trajectory.mjs` prints `{tick, world, food, wood, metal, science}` at fixed tick checkpoints from the headless AT-driven run; the doc records the parallel Chrome-measured trajectory and the pass/fail comparison.

> **Inline, not subagent** — needs `npm run serve` + chrome-devtools-mcp (shell + browser orchestration outside subagent perms).

- [ ] **Step 1: Write the headless recorder**

```js
// scripts/sim/record-trajectory.mjs
import { bootGame } from './boot.mjs'
import { snapshot } from './metrics.mjs'
import { installSeededRandom } from './seededRandom.mjs'

const CHECKPOINTS = [1000, 5000, 20000, 60000] // ticks (100ms game-time each)
const { window, game } = bootGame({ withAutoTrimps: true })
installSeededRandom(window, 1)
let t = 0
const rows = []
for (const cp of CHECKPOINTS) {
  while (t < cp) { window.gameLoop(null); window.mainLoop(); t++ }
  rows.push({ tick: t, gameMinutes: (t * 0.1 / 60).toFixed(1), ...snapshot(game) })
}
console.log(JSON.stringify(rows, null, 2))
```

- [ ] **Step 2: Record the headless trajectory**

Run: `node scripts/sim/record-trajectory.mjs > /tmp/headless-trajectory.json`
Expected: JSON array with a row per checkpoint.

- [ ] **Step 3: Record the real-time Chrome trajectory**

`npm run build && npm run serve`, open `http://localhost:8080/?mute=1`, let AutoTrimps run with the SAME settings (defaults + seed-equivalent), and read `game.global.world` / `game.resources.*.owned` at the same **game-minute** marks (not wall-clock) via chrome-devtools-mcp `evaluate_script`. Record the values.

- [ ] **Step 4: Compare and write the gate doc**

Write `docs/superpowers/validation/2026-07-09-fidelity-gate.md` with both trajectories side by side and the verdict: **PASS** if zone matches exactly and each resource is within ±10% at every checkpoint; otherwise document the divergence and its suspected cause (craft cadence, AT interleave ratio, RNG). A FAIL blocks trusting #40 numbers until resolved.

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/record-trajectory.mjs docs/superpowers/validation/2026-07-09-fidelity-gate.md
git commit -m "test(sim): Chrome fidelity-validation gate (Approach C) (#45)"
```

---

## Self-Review

**Spec coverage:**
- §3 boot recipe → Task 1 ✓ · driver `gameLoop(null)` → Task 2 ✓ · lockstep AT interleave → Task 5 ✓ · seeded RNG + N-run averaging → Task 4 ✓ · metrics → Task 3 ✓ · oracle (Approach B cross-check) → Task 6 ✓ · #40 first application → Task 7 ✓ · Approach-C fidelity gate → Task 8 ✓. All §4 constraints hoisted into Global Constraints. No gaps.
- Skill wrapper packaging is explicitly out-of-scope in the spec (§7) → correctly deferred.

**Placeholder scan:** No TBD/TODO; every code step shows real code; every run step shows the command + expected result. Task 5 Step 2 and Task 8 Steps 3–4 are genuinely investigative/manual (AT-error triage, Chrome recording) and say exactly what to do — not placeholders.

**Type consistency:** `bootGame({ withAutoTrimps })` shape identical across Tasks 1/5/7/8. `runTicks/runUntil/ticksToZone/stepWithAT` signatures consistent between `driver.mjs` and callers. `snapshot(game)` field set (`world/food/wood/metal/science/trimps/maxTrimps/scientists/farmers`) consistent between Tasks 3, 7, 8. `sweep({values,seeds,runOne})` matches its test. `optimalScientistShare` param names match between Task 6 impl, test, and the Task 7 call.

**Known risk carried forward:** Task 5 (AT headless) is the one real unknown; the plan makes its failure loud (no blanket catch) and flags the scripted-settings fallback as a checkpoint, not a silent pivot.
