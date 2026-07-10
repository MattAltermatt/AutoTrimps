# Tuning-Analysis Simulation Harness — Design

**Issue:** [#45](https://github.com/MattAltermatt/AutoTrimps/issues/45) · **Milestone:** Phase 3 — Divergence · **Date:** 2026-07-09

## 1. Problem

Phase 3 ("Divergence") makes AutoTrimps *better* than upstream Trimps rather than a faithful mirror.
That surfaces a recurring question class — **"what value is optimal here?"** — that intuition answers
badly for a system this coupled:

| Consumer | Question |
| --- | --- |
| [#40](https://github.com/MattAltermatt/AutoTrimps/issues/40) jobs | scientist share vs account maturity + when the young-account boost fades |
| perks (future) | which perk allocation maximizes progress/hr |
| farming cutoffs (future) | when continuing to farm a map stops paying off |

Hand-picking a threshold (`totalPortals < 5`?) for these is the armchair-tuning trap. We need an
**empirical** engine that measures outcomes.

## 2. Decision (from a 3-agent dueling review)

Three agents investigated the real code; one adversary was tasked solely with **falsifying** the
premise "we can run the real game headless + accelerated *faithfully*."

**Chosen: Approach A — drive the real game headless & accelerated.** The adversary's central
objection — that the only fast path is the `offlineProgress` timewarp, during which AutoTrimps
self-disables the very `setScienceNeeded` logic #40 tunes (`AutoTrimps2.js:179/205/282`, gated on
`if (!usingRealTimeOffline)`) — was **empirically refuted** by a working boot probe:

- The engine's wall-clock scheduler is `gameTimeout` (`main.js:20019-26`), which bounds game-time to
  real elapsed time. **But you don't use it.** You call the raw active-play tick `gameLoop(null)`
  directly in a tight loop, with `usingRealTimeOffline = false`. This runs the *active* path as fast
  as the CPU allows, and AT does **not** gate itself off.
- Measured throughput: `gameLoop(null)` ≈ 42k ticks/s ≈ **1.2 game-hours per wall-second**.

### Roles of the three approaches

- **A — real-game sim = the production tool.** Zero formula-drift (runs the real game math); the
  *only* approach that reaches the combat/loot half of the roadmap (farming).
- **B — analytical model = cross-check oracle, not the tool.** For deterministic rate/cost questions
  (#40, perks), B computes a closed-form optimum (~6 mirrored constants). Run A and B in parallel:
  **agreement → high confidence; divergence → a bug in one.** B is rejected as the *production* path
  because it re-introduces exactly the formula-drift the byte-faithful port exists to eliminate, and
  it is structurally impossible for farming (combat/loot/RNG-integrated).
- **C — instrumented live play = one-time fidelity gate.** Validate the driver against a real-time
  Chrome run (`npm run serve`) before trusting any number.

## 3. Architecture

```
scripts/sim/
  boot.mjs         # boot the game (+ optionally AutoTrimps) into one jsdom window
  driver.mjs       # tick loop: interleave gameLoop(null) + AT mainLoop in lockstep
  sweep.mjs        # run a parameter grid, N seeded runs per cell, collect metrics
  metrics.mjs      # outcome readers (ticks-to-zone-N, science/s, He/hr, resources)
  oracle/          # Approach-B closed-form models used as cross-checks (per consumer)
```

Each unit has one purpose and a narrow interface:

- **boot** — input: game dir, optional AT bundle path; output: a live `{ window, game }`. Owns the
  jsdom + stub setup. Consumers never touch jsdom directly.
- **driver** — input: booted window, a settings object, a stop predicate; output: advances game
  state. Owns tick cadence + AT interleave. Knows nothing about *which* parameter is swept.
- **sweep** — input: parameter grid + seed count + a metric fn; output: `{cell → metric samples}`.
  Owns RNG seeding and averaging.
- **metrics** — pure readers over `game.*`. No mutation.
- **oracle** — pure formula models (per question) that predict the same optimum for cross-check.

### Boot recipe (proven)

1. `new JSDOM(index.html, {runScripts:'outside-only', pretendToBeVisual:true, url:'http://localhost/'})`
   — load the **real `index.html`** so top-level `getElementById` calls (e.g. `craftBuildings`'
   `#animationDiv`, `main.js:4900`) resolve instead of throwing.
2. Concatenate all 7 files (`lz-string, decimal.min, config, updates, playerSpire, objects, main`)
   and `window.eval` them **once** — per-file eval fails (cross-file bare-identifier refs need one
   shared global scope, like the browser's `<script>` tags).
3. Stubs: `HTMLCanvasElement.prototype.getContext` → no-op proxy; `setTimeout/setInterval/
   requestAnimationFrame` → no-op (drive ticks manually); pre-seed `usingScreenReader=false`,
   `usingRealTimeOffline=false`, `playFabId=-1`. For AT: trivial `GM_getValue/GM_setValue/
   GM_xmlhttpRequest` + `unsafeWindow=window`.
4. Drive: loop `gameLoop(null)`; read outcomes off `game.resources.*` / `game.global.world`.

## 4. Constraints the build MUST honor

1. **`gameLoop(null)` only, never `gameLoop(true)`** — under `makeUp=true`, `craftBuildings`
   (`main.js:4918`) completes builds instantly (offline divergence). `null` is the faithful path.
   All 6 `makeUp` sites were audited; only `craftBuildings` mutates state differently.
2. **Lockstep AT interleave** — call AT `mainLoop` at the real-play ratio (~once per game-tick),
   since `setInterval` is stubbed off. Naively running the game fast + AT on its own timer desyncs
   the controller (the adversary's valid residual point).
3. **Seed the RNG** — combat crit/dodge use unseeded `Math.random` (41 sites). Monkeypatch a seeded
   PRNG and **average N runs per cell**. Low impact for early-game #40; mandatory for farming.
4. **Tick count is the clock** — `game.global.time` is advanced by `gameTimeout` (unused here), not
   by `gameLoop`. Drive maturity/duration by tick count.
5. **Numbers are recommendations** — the harness *informs*; actual tuning values stay user-gated
   (gameplay tuning is sacrosanct). The harness never writes a balance constant.

## 5. Fidelity validation gate (Approach C)

Before any consumer trusts a produced number, run **one** differential check: same opening in the
headless driver vs a real-time Chrome session (`npm run serve`). Assert the zone/He trajectory
matches within a stated tolerance (e.g. ±5% He at a fixed zone). This locks down the lockstep
driver's fidelity once; consumers thereafter trust the harness.

## 6. First application — #40

1. Seed an early-account state (curated save, or let AT play the opening).
2. Sweep scientist-share `s` across candidate values; for each, measure **ticks-to-zone-N**.
3. In parallel, the #40 **oracle** (closed form: `T_science(s)` vs binding-resource-time `T_resource(s)`,
   optimum where they cross) predicts `s*` and its drift as account maturity grows.
4. Sim and oracle agree → high confidence in the magnitude + fade schedule. Present numbers to the
   user for approval (tuning-gated). Divergence → investigate before shipping any value.

## 7. Out of scope

- Late-game DOM coverage (holidays, spire, specific challenges) beyond what early-game #40 hits —
  add DOM stubs lazily as deeper sweeps surface new null-derefs.
- Changing any tuning constant — that is each consumer issue's job, user-gated.
- The skill wrapper packaging — happens after the harness + first validated run exist.
