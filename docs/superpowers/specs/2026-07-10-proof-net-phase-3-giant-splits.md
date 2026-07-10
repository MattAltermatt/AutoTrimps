# 🪓 Proof-net Phase 3 — cross-module giant-splits (execution design)

> ✅ **SHIPPED 2026-07-10.** All units landed on `main`: seam guard + `calcBaseDamageInX` dedupe (3a),
> `other-praiding.ts` split + dead-code removal (3c), `mapfunctions-amp.ts` split (3d). 3b (RcalcOurHealth
> "dedupe") rejected as designed. Result: `mapfunctions.ts` 2799→1963 (+amp 849), `other.ts` 2378→621
> (+praiding 1686). 531 tests green, L0 ∅, three fresh-reviewer passes clean, Chrome-verified per branch.

**Date:** 2026-07-10 · **Parent spec:** [`2026-07-09-proof-net-modernization-design.md`](2026-07-09-proof-net-modernization-design.md) §12 row 3 · **Tracker:** proof-net milestone (Phase 3)

This refines the parent spec's one-line Phase 3 row into a concrete, gated execution plan, informed by a three-agent duel (two decomposition architects + one adversary). It **supersedes** the parent §12 Phase 3 wording where they differ, and records the reasoning so a future session doesn't re-litigate it.

---

## 🎯 1. Goal

Reduce the two largest remaining `src/modules/*.ts` files — `mapfunctions.ts` (2799 L) and `other.ts` (2378 L) — to focused, navigable modules, **without changing behavior**, so the later idiomatic-refactor pass runs on ~700–1750-line modules instead of monsters. Plus one safe dead-code dedupe.

---

## 🧭 2. Scope (four units)

| # | Unit | Verdict |
| --- | --- | --- |
| **3a** | `calcBaseDamageInX` dedupe | ✅ **In.** calc.ts's copy passes `false` as the 3rd `calcOurDmg` arg; stance.ts's passes `true` and **wins at global scope** (spread after calc). calc.ts's copy is unreachable dead code — removing it is behavior-preserving. Also lets us drop the `stance`-after-`calc` spread-order dependency for this name. |
| **3b** | `RcalcOurHealth ↔ calcOurHealth` "dedupe" | ❌ **Rejected — out of scope.** Reading both bodies: `calcOurHealth` (calc.ts:77) is the **U1/base-game** health model (Toughness `.level`, Frigid, Geneticist, formation, Magma, radioStacks…); `RcalcOurHealth` (calc.ts:1311) is the **U2/Radon** model (Smithy, Antenna, `.radLevel`, Fluffy scaledHealth, autoBattle, u2Mutations, Revenge/Wither/Berserk…). They share only a ~13-line `health=50` + equipment-loop preamble, then diverge into two entirely different formula universes. Merging = a formula-shape change = **sacrosanct tuning**. Not a dedupe. Do not touch. |
| **3c** | Split `other.ts` → `other-praiding.ts` | ✅ **In. FIRST** (safest dry run). |
| **3d** | Split `mapfunctions.ts` → `mapfunctions-amp.ts` | ✅ **In. SECOND.** |

---

## 🏛️ 3. Decisions resolved (from the agent duel)

**D1 — Ordering: SPLIT FIRST, refactor later (not refactor-in-place-then-split).**
A pure move is verified by **byte-identity of the moved function bodies** (the Phase-1 esbuild byte-diff gate) — it needs **no behavioral net at all**. This defuses the adversary's "these two files have zero L1 coverage" blocker: coverage is only needed for the *refactor* class, which happens later, per small module. Moving first also shrinks every later refactor's blast radius from ~2800 lines to ≤1750. Refactor-in-place-first would force the huge from-scratch net first for zero benefit.

**D2 — Granularity: extract ONE low-cut cluster per file, leave a cohesive residual (not an 8-way split).**
The dispatchers (`RselectMap`/`Rshould`/`RmapRepeat`; `Praiding`/`PraidHarder`) fan out to nearly every farm/predicate family *within-file*; an 8-way split would **multiply** cross-module edges. Only the **AMP** cluster (mapfunctions) and the **Praiding** cluster (other) are genuinely low-cut. The finer cohesion taxonomy (fragment / farm-buildings / farm-combat-push / challenge-zone / dispatch, etc.) is kept as an **optional map** for later refactor-time splits if a residual is still unwieldy — not done now.

**D3 — Never co-mingle move + refactor in one commit.** Each split is a pure code-motion diff (bodies byte-identical; only `export`/file-boundary/ambient-decl change). Co-mingling a move with a behavior-preserving-but-non-obvious rewrite is the #39 "laundering" vector the parent spec §6/§16 exists to catch.

**D4 — Two files are independent.** `mapfunctions.ts` and `other.ts` have **zero cross-calls** — parallel U1 (`other`) vs U2/Radon (`mapfunctions`) trees, both driven by bare name from legacy `AutoTrimps2.js`. → two independent branches/PRs.

---

## 🧩 4. Decomposition

### 4a. `other.ts` → `other-praiding.ts` + residual `other.ts`  (do FIRST)

**Extract `src/modules/other-praiding.ts`** (~1722 L, 35 fns — the U1 Prestige/BW-Raid state machine):
`isBelowThreshold`, `plusPres`, `plusMapToRun`, `findLastBionic`, `plusMapToRun1-5`, `plusPres1-5`, `pcheck1-5`, `pcheckmap1-5`, `Praiding`, `PraidHarder`, `relaxMapReqs`, `BWraiding`, `dailyPraiding`, `dailyBWraiding`
+ its own globals: `pMap1-5`/`repMap1-5`/`mapbought1-5`, `dpMap1-5`/`drepMap1-5`/`dmapbought1-5`/`dpraidDone`, and the `praidSetting` half of the joint `globalThis.daily3 = undefined; globalThis.praidSetting = undefined;` init (line 12) — `daily3` **stays** in residual `other.ts` (only `usedaily3` reads it); `praidSetting` **moves** (only `PraidHarder` reads it).

**Cut-set:** 4 inbound edges from **already-legacy** `AutoTrimps2.js:258-264` (bare-global — zero TS-seam risk) + **0 outbound** into the residual + **0 ambient `.d.ts` changes** (none of the moved names have ambient decls — their only caller is legacy JS). Lowest-risk split available.

**Residual `other.ts`** (~656 L): combat guards, spire fns, `buyWeps`/`buyArms` + Radon mirrors, `questcheck`/`smithylogic`/`Rgetequipcost` (high fan-in — leave alone), `autoshrine`, `autoGoldenUpgradesAT`, `nextWorld` + `playerSpire.drawInfo` monkey-patches (**stay put — do not move**), etc.

### 4b. `mapfunctions.ts` → `mapfunctions-amp.ts` + residual `mapfunctions.ts`  (do SECOND)

**Extract `src/modules/mapfunctions-amp.ts`** (~1063 L, 9 fns — the Radon Prestige-Raid/AMP engine):
`RAMPplusMapToRun`, `RAMPshouldrunmap`, `RAMPplusPres`, `RAMPplusPresfragmax`, `RAMPplusPresfragmin`, `RAMPfrag`, `RAMPreset`, `RAMP`, `dRAMP`
+ its own globals: `RAMPpMap1-5`/`RAMPrepMap1-5`/`RAMPfragmappy`/`RAMPprefragmappy`/`RAMPmapbought1-5` + `RdAMP*` mirrors.

**Cut-set:** 4 inbound (`maps.ts` → `RAMP`/`dRAMP`/`RAMPreset`×2) + 2 inbound (residual `RmapRepeat` → `RAMPfrag`) + 1 outbound (`RAMP`/`dRAMP` → `RfragMap`, staying in residual) = 7 mechanical edges.
**Ambient `.d.ts`:** repoint 3 existing decls (`dRAMP`/`RAMP`/`RAMPreset`, `at-legacy.d.ts:287-289`) to `../modules/mapfunctions-amp`; **add** one new decl for `RAMPfrag` (now cross-boundary from residual `RmapRepeat`).

**Load-order note (verified safe):** the fragile `RshouldFarm`/`RdoVoids`/… top-level inits that must eval *after* `maps.ts`'s placeholders **stay in residual `mapfunctions.ts`** (still imported after `maps`). The AMP globals have **no** placeholder-race with `maps.ts`, so `mapfunctions-amp.ts` has no import-order constraint. The split does not disturb load order.

---

## 🩹 5. Dead code (flag, don't launder)

- **`dailyBWraiding`** (other.ts:1806–1863, ~58 L) — grep-confirmed **zero callers** anywhere (`BWraiding` already self-branches on `challengeActive == "Daily"`). Move it **verbatim** into `other-praiding.ts`, then delete in a **separate, user-gated commit** with a regression assertion.
- **`Rprestraid`-family block** (other.ts:1971–1990) — apparent copy-paste of the U1 Praid-state block, `R`-prefixed, no readers (`RAMP`/`dRAMP` use the differently-named `RAMPmapbought*`). Move verbatim into residual `other.ts`; file backlog to confirm-and-delete later. **Never drop mid-move.**

---

## ✅ 6. Gates (per split)

1. **Byte-identity** — every moved function body is byte-identical to its pre-move form (esbuild byte-diff or textual diff of the moved region).
2. `npm run typecheck` clean (strict).
3. `npm run lint` clean.
4. **Load-order assertion test** (new, permanent) — after importing `legacy-bridge`, assert the R-state inits hold their intended values (`RshouldFarm === false`, `RAMPpMap1 === undefined`, etc.), guarding the adversary's import-order-fragility BLOCKER even where the L0 corpus doesn't reach the branch.
5. **L0 differential == ∅** (empty manifest — a pure move has zero behavior delta by construction; any non-empty diff is unambiguously a seam bug: wrong spread/import order or missed ambient repoint).
6. **Live Chrome smoke** — `other`: Prestige-Raid + BW-Raid still fire; `mapfunctions`: Radon AMP prestige-map buying still fires. Verify `legacy-bridge` spread + build-order seams intact.

Then: squash → FF-merge → delete branch (both ends). Two branches: `feature/split-other-praiding` first, `feature/split-mapfunctions-amp` second.

---

## 🛠️ 7. Seam hardening

- Clarify the `legacy-bridge.ts` collision comments to distinguish the two mechanisms explicitly: **function-export** collision (`calcBaseDamageInX`) → resolved by **spread order**; **top-level `globalThis.X` side-effect** collision (R-map-state vs maps' placeholders) → resolved by **import/eval order**. (The existing comments are each individually correct but terse; the adversary conflated them.)
- The load-order assertion test (gate #4) is the durable guard.

---

## ⚠️ 8. Risks accepted

- **L0-invisible monkey-patches** (`nextWorld` double-wrap with `Graphs.js`; `playerSpire.drawInfo`) live in residual `other.ts` and **do not move** in this phase → zero move-risk to them now. They remain outside the differential net permanently; when residual `other.ts` is later *refactored*, add an L1b spy-log / smoke assertion for the wrapper chain. Flagged, not fixed here.
- **Cold R-mirror/daily functions** (`Rhypo`/`Ralch`/`Rship`/…; `dailyPraiding`/`dailyBWraiding`) are unreachable by the seeded corpus, so L0 won't exercise them — irrelevant for a **pure move** (byte-identity covers them), but their later refactor needs branch-covering fixtures. Noted for the refactor phase.
- **#32 latent bug** in `RAMPreset`'s daily branch (`recyle` typo, byte-faithfully `@ts-expect-error`-preserved) rides along in the move verbatim; its fix is tuning-gated and goes through the manifest path in a later commit — **not** the split.

---

## 🚦 9. What this phase does NOT do

Idiomatic refactor of the moved code (un-minify, `var`→`let/const`, `==`→`===`, dedupe `RAMP`/`dRAMP`, collapse `plusPres1-5`). That is the **follow-on** per-module Phase-2-style pass — each resulting module (`other-praiding.ts`, `other.ts`, `mapfunctions-amp.ts`, `mapfunctions.ts`) gets its own characterization net, review, and FF-merge, never bundled into the split.
