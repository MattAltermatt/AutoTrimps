# Scientist Percent — Design Spec (#106)

**Status:** approved 2026-07-13 · **Size:** S–M · **Universe:** U1 + U2 · **Perf claim:** NONE (deliberate)

## 🎯 Summary

Give the user a control for how many scientists AutoTrimps hires, and stop the Jobs screen lying about
what its other three boxes are. This is a **control + comprehension** feature. It is **not** a
performance fix, and nothing in it may be described as one.

## 🔍 What we found (measured, not assumed)

A user reported: *"there are only 31 scientists, yet the rest have >200 — the user has to research
science, when it seems to make sense to just have more scientists."*

Four agents and one 8-seed experiment against the user's **real save + real settings** established:

1. **AT never hires scientists on that save.** Target is `floor(TDW / 25) = 25`; the save already owns
   **31** ⇒ `buyScientists` is negative ⇒ the hire branch never fires. Measured: **0 hire events in
   20,000 ticks.** The rule is *inert*, not miscalibrated.

2. **🔴 No constant can ever be right.** `game.global.playerModifier` **doubles** with each Speedbook
   (`config.js:13016`) while per-scientist output is flat within a run. The divisor needed for the
   scientists to out-produce the player's own hands therefore **halves every Speedbook**, spanning
   **7772 → 0.47 inside a single run**. `25` is correct for about one Speedbook's worth of the game.
   **A fixed ratio cannot track an exponential.** Retuning the constant is not tuning-gated, it is
   *impossible* — and this is the reason the setting must exist at all.

3. **🔴 The three ratio boxes are MACHINE OUTPUTS, not user inputs.** With `BuyJobsNew == 1` ("Auto
   Worker Ratios", the default and what the reporter runs), `workerRatios()` runs **every tick** and
   ends with `setPageSetting('FarmerRatio', …)` (`jobs.ts:293-295`), writing
   `MODULES["jobs"].autoRatio1 = [1.1, 1.15, 1.2]` into the boxes. **The user's `1.10 / 1.15 / 1.20`
   is AT's own preset table, echoed back ~10×/sec.** Anything typed there is destroyed within ~100 ms.
   This is the single largest cause of "I don't understand the ratios": the fields look editable and
   are not.

4. **The ratios are already percentages.** `ratiobuy` (`jobs.ts:198`) computes
   `floor((jobratio / totalRatio) * TDW)` — scale-invariant. `1.10/1.15/1.20` ≡ `110/115/120` ≡
   `32/33/35`. Typing `50/30/20` today already yields 50/30/20 %.

5. **There is no performance upside, and we will not pretend there is.** 8 seeds × 20,000 ticks on the
   real save: the noise floor (clean seed-to-seed) is **±3.5%**. Freeing the gather from science is
   **−3.1% (inside the noise)**. Even **infinite, free, instantaneous science** is **−5.1%** with
   *identical* equipment and upgrades — that is the **upper bound** on any scientist-side change. The
   positive control passes emphatically (infinite metal: **−86.6%**, equipment 48 → 1,247), so the
   metric is not blind. **Metal, not science, gates this game.**

## 🧱 Goals / Non-Goals

### Goals
- G1. A user-settable **scientist percentage**, in both universes.
- G2. **Byte-identical by default** — the L0 oracle traces must not move.
- G3. Make the Jobs screen **honest**: show what the ratio numbers mean, and show that they are
      machine-managed in Auto mode.
- G4. Tooltips that **do not claim a speedup**.

### Non-Goals
- N1. **No localStorage migration.** ❌ Rejected — see below.
- N2. **No hard-percent arithmetic** for Farmer/Lumberjack/Miner.
- N3. **No change to `autoRatio1-7` / `RautoRatio1-7` / the `[4,5,0]` override.** Those are balance
      constants (sacrosanct) and moving them re-pins the oracle.
- N4. **No scientist *firing*.** `buyJobs` only ever hires. Adding a fire path is a behavior change
      with its own trace movement; out of scope.
- N5. No claim, anywhere, that this makes the game faster.

### ❌ Why the full percentage conversion was REJECTED
The user's first instinct was to convert all four settings to percentages summing to 100. It dies on
four counts, each independently fatal:

- **It migrates a scratch register.** The F/L/M fields are overwritten every tick in the default mode
  (finding 3). An agent applied the migration to the real settings blob, ran **one** AT tick, and
  watched `32/33/35` revert to `1.1/1.15/1.2`. **The migration survives zero ticks.**
- **It buys zero behavior.** The fields are already scale-invariant percentages (finding 4).
- **Only 3 of the 8 presets can be integer percentages.** `[1.1, 1.15, 1.2]` normalizes to
  31.884/33.333/34.783. Rounding to 32/33/35 **changes the worker split** — a gameplay-balance change
  that forces an oracle re-pin, to buy a relabel.
- **"Sums to 100" is false.** F/L/M already normalize to 100% of the pool and scientists take *another*
  ~4% on top: today's allocation is **104%**. Making it true requires changing the allocation math.
- **And the failure mode is catastrophic.** Under hard-percent, an unmigrated user's stored `1.10`
  reads as *1.1 %* ⇒ **96% of the population idles forever, with no error.** A cosmetic gain is not
  worth that risk on a fork that auto-deploys to a public userbase.

## 🏗️ Design

### 1. `ScientistPercent` / `RScientistPercent`

| id | universe | type | default | meaning |
|---|---|---|---|---|
| `ScientistPercent` | U1 | `valueNegative` | `-1` | `-1` = **Auto** (today's divisor table). `0`–`90` = scientists get N% of the ratio-managed workforce. |
| `RScientistPercent` | U2 | `valueNegative` | `-1` | same, for `RbuyJobs` |

✅ **Both ids are virgin** — `git log --all -S"createSetting('ScientistPercent'"` returns **0 commits**,
and neither appears in the frozen `serializeSettings60/550` blobs. No stale value can be resurrected.
(We deliberately avoid `ScientistRatio`, which *does* appear in 7 commits — commented out in every one,
so arguably safe, but there is no reason to litigate it when a clean name exists.)

`valueNegative` is required: plain `value` inputs reject negatives, and `-1` is this codebase's
established "auto/unset" sentinel (`MaxScientists`, `DynamicPrestige2`, …).

### 2. The mechanism — one expression

Today (`jobs.ts:97-104, 172`), `totalRatio` **cancels** out of the scientist target:

```
scientistRatio  = totalRatio / D
scientistTarget = floor((scientistRatio / totalRatio) * TDW)  ==  floor(TDW / D)
TDW             = free + Farmer + Lumberjack + Miner     (scientists NOT in the pool)
```

Scientists occupy slots outside TDW, so the whole pool is `P = TDW + S` and the fixed point is
`S = P / (D + 1)`. Therefore:

> ### `D = (100 − s) / s` yields exactly **s %** of the workforce.

Today's constants back-map cleanly, which is the check that the parameterization is right:

```text
D =  25  ->  s = 3.85%    (default)
D =  10  ->  s = 9.09%    (Farmer < 100, and Watch)
D = 100  ->  s = 0.99%    (world >= 300)
```

The edit is confined to how `D` is derived. **`ratiobuy`, `TDW`, the firing path, the Watch branch, the
world-1 bootstrap, and the `MaxScientists` cap are all untouched.**

❌ **Explicitly rejected: putting Scientist into TDW as a true 4-way pool.** It converges to the same
fractions but changes *every* intermediate tick's arithmetic ⇒ the traces move **even at default** ⇒ an
oracle re-pin. It also turns the `MaxScientists` cap into a worker *leak* (capped scientists' share is
no longer re-absorbed by F/L/M). Reparameterizing `D` is behaviorally equivalent at the fixed point and
touches one expression. **Do not touch TDW.**

### 3. 🚨 Three mandatory guards — each is a bug this repo has already shipped

- **`s = 100` ⇒ `D = 0` ⇒ `Infinity` scientists and `NaN` for F/L/M.** The bot is destroyed. **Clamp
  `s` to `[0, 90]`.**
- **`s` blank / the string `'undefined'` ⇒ `parseFloat` ⇒ `NaN` ⇒ `NaN > 0` is false ⇒ zero scientists,
  silently, forever.** This is the **#96** failure verbatim. **Any non-finite `s` ⇒ treat as Auto**,
  never as zero.
- **`s = 0`** is a legitimate value meaning "hire no scientists". It must **not** be confused with the
  non-finite case, and it must **not** fire existing scientists (N4).

### 4. Honest UI (the comprehension half)

- **Derived percentage readout** on the existing boxes: `Farmer Ratio: 1.10 (31.9%)`, computed live from
  the current values. **Zero stored bytes change.** Route through `renderControlFace()`
  (`settings-engine.ts`), the single seam all three render paths pass through
  (see `reference-settings-render-paths`), refreshed by `updateCustomButtons()` each tick.
- **Annotate the F/L/M boxes as machine-managed while `BuyJobsNew == 1`** — they are read-only outputs
  in that mode. Both advocates independently called this the largest comprehension win in the issue.
- **Tooltips.** `FarmerRatio`/`LumberjackRatio`/`MinerRatio` currently have an **empty** description
  (`settings-defs.ts:299-301`). Fill them in: explain that only the *proportions* matter, and that Auto
  mode overrides them.
- The `ScientistPercent` tooltip must state plainly: **"Control only — changing this has no measurable
  effect on progression speed."**

## ✅ Verification

**Green-at-default proves nothing on its own.** Both measurements are required:

1. **Default (`-1`) ⇒ `baseline-zero` stays ∅** across all 10 traces. Proves nothing broke.
2. **🚨 POSITIVE CONTROL: force `ScientistPercent = 5` ⇒ the differential MUST go RED.** If it does not,
   the setting is not reaching the allocator and the feature is **inert** — which is exactly the #98
   class of failure. The proof net *can* see this path: the blind-spot census records `jobs-ratio-flip`
   producing **10,715 divergences on 16/17 runs**, so the jobs path is *sensitive*, not merely reached.
3. Unit suite (`tests/jobs.scientistPercent.test.ts`): `-1` ⇒ the legacy divisor table (all three tiers
   + Watch); `s=5` ⇒ `D=19`; **`s=100` clamped** (assert no `Infinity`/`NaN` reaches `safeBuyJob`);
   **`s=NaN`/`''`/`'undefined'` ⇒ Auto, not zero**; `s=0` ⇒ no hires and no fires.
4. Gates by **exit code**, never by grepping output (`feedback-check-exit-codes-not-grep`).
5. Live Chrome verify: the readout renders, the boxes grey out in Auto mode, and setting 5% visibly
   changes the scientist count.

## 📋 Surface that must change

- `src/modules/settings-defs.ts` — 2 new `createSetting` calls (**append**; the call order IS the
  persistence contract). Fill the 3 empty ratio tooltips.
- `src/modules/jobs.ts` — derive `D` from the setting (U1 `buyJobs`, U2 `RbuyJobs`).
- `src/modules/settings-visibility.ts` — show `RScientistPercent` only in U2; annotate F/L/M in Auto mode.
- `src/modules/settings-engine.ts` — the derived-percent face.
- `tests/settings-inventory.test.ts` — the inline `toMatchInlineSnapshot` count **and**
  `tests/__snapshots__/settings-inventory.test.ts.snap`. **Both in the same commit** or CI goes red and
  blocks the deploy (`reference-settings-inventory-dual-snapshot`).
- `tests/settings-wired.test.ts` (every created id must be read — wire **both**, U1 and U2) and
  `tests/nets/settings-reverse.test.ts` (read `RScientistPercent` explicitly, not via the dynamic-key
  loop the net allowlists).
- `tests/fixtures/src-bundle.golden.js` — regen via `regen-src-golden.mjs --reason "…"` (#91).

## 🔮 Follow-ups (NOT in this change)

- **🔴 The metal-hoarding lead.** Infinite metal is **−86.6% ticks and 26× equipment**, yet the clean run
  ends with **20.3M metal banked and unspent** while gear-starved. *Why is AT hoarding the resource that
  gates everything?* This is worth more than #106 ever was.
- **`storedMODULES` is write-only.** Every `MODULES` constant is already overridable via the module-vars
  import and persisted every tick — and **read back by nothing, anywhere**. The override dies on reload.
  A half-implemented feature; ~3 lines to finish.
- The Turkimp opportunity-cost gather fix (`!hasTurkimp` on `gather.ts:140`) — measured **inside the
  noise floor**. Only ever ship it as a *preference*, never as a speedup.
