# Proof-net Phase 3 — Giant-Splits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract two large, low-cut clusters (`other.ts`→`other-praiding.ts`, `mapfunctions.ts`→`mapfunctions-amp.ts`) as byte-faithful moves, plus one dead-code dedupe and a seam guard — without changing behavior.

**Architecture:** Pure code-motion (function bodies byte-identical; only file boundary + `legacy-bridge.ts` wiring + `at-legacy.d.ts` ambient decls change). Verified by the src-bundle golden (a move produces a *pure structural relocation* diff), typecheck/lint, the L0 differential (∅), and a live Chrome smoke. Refactor of the moved code is explicitly OUT of scope (a later per-module pass).

**Tech Stack:** TypeScript (strict), Vite/esbuild, Vitest, jsdom sim harness, the game clone at `../trimps-game`.

## Global Constraints

- **Byte-faithful moves only.** Every moved function body is byte-identical to its pre-move form. NO `var`→`let`, NO `==`→`===`, NO un-minify, NO dedupe of `RAMP`/`dRAMP`/`plusPres1-5` in this phase.
- **Never co-mingle move + refactor + delete in one commit** (the #39 laundering vector). Dead-code deletion is its own user-gated commit.
- **Sacrosanct tuning:** no numeric-literal / formula-shape change. The `RcalcOurHealth ↔ calcOurHealth` "dedupe" is REJECTED (distinct U1/U2 models) — do not touch.
- **Gate every split:** src-bundle golden regen reviewed as pure relocation · `npm run typecheck` clean · `npm run lint` clean · `npm run build` clean · L0 `baseline-zero` ∅ · `build-userscript` order test green · live Chrome smoke.
- **Merge cadence:** squash → FF-merge to `main` → delete both branch ends, per branch.
- Spec: `docs/superpowers/specs/2026-07-10-proof-net-phase-3-giant-splits.md`.

---

## File structure

- `src/modules/other.ts` — residual after extracting the Praid cluster (~656 L).
- `src/modules/other-praiding.ts` — NEW: U1 Prestige/BW-Raid state machine (~1722 L, 35 fns).
- `src/modules/mapfunctions.ts` — residual after extracting the AMP cluster (~1736 L).
- `src/modules/mapfunctions-amp.ts` — NEW: Radon AMP/Prestige-Raid engine (~1063 L, 9 fns).
- `src/modules/calc.ts` — remove dead `calcBaseDamageInX` copy.
- `src/legacy-bridge.ts` — add imports+spreads for the two new modules; clarify collision comments.
- `src/game/at-legacy.d.ts` — repoint 3 decls + add 1 for the AMP split.
- `tests/build-userscript.test.ts` — add a static import-order guard assertion.
- `tests/fixtures/src-bundle.golden.js` — regenerated (reviewed) after each emit-changing task.

Branch plan (three, in order): **A** `feature/proof-net-phase-3-seam-and-dedupe` → **B** `feature/split-other-praiding` → **C** `feature/split-mapfunctions-amp`.

---

## Branch A — `feature/proof-net-phase-3-seam-and-dedupe`

Start clean on `main`:
```bash
git checkout main && git pull --ff-only
git checkout -b feature/proof-net-phase-3-seam-and-dedupe
```

### Task 1: Static import-order guard + clarify bridge comments

**Files:**
- Modify: `tests/build-userscript.test.ts`
- Modify: `src/legacy-bridge.ts:24-30` (comments only)

**Interfaces:**
- Consumes: nothing.
- Produces: a regression guard asserting `./modules/maps` is imported before `./modules/mapfunctions` in `src/legacy-bridge.ts` (documents the top-level-side-effect load-order invariant so a future split can't silently reorder it).

- [ ] **Step 1: Write the failing test** — append to `tests/build-userscript.test.ts` (inside the existing top-level `describe`, or a new `describe('legacy-bridge load order', …)`):

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

it('bridge imports maps before mapfunctions (R-map-state top-level inits must eval after maps placeholders)', () => {
  const bridge = readFileSync(resolve(__dirname, '../src/legacy-bridge.ts'), 'utf8')
  const mapsIdx = bridge.indexOf("from './modules/maps'")
  const mapfnIdx = bridge.indexOf("from './modules/mapfunctions'")
  expect(mapsIdx).toBeGreaterThan(-1)
  expect(mapfnIdx).toBeGreaterThan(-1)
  // Top-level `globalThis.RshouldFarm = false` (mapfunctions) must eval AFTER `maps`'s
  // `= undefined` placeholder — that is governed by import (module-eval) order, not spread order.
  expect(mapfnIdx).toBeGreaterThan(mapsIdx)
})
```

- [ ] **Step 2: Run it — should PASS immediately** (the invariant already holds today; this is a guard, not a fix):

Run: `npx vitest run tests/build-userscript.test.ts`
Expected: PASS (all, including the new case).

- [ ] **Step 3: Clarify the two collision comments** in `src/legacy-bridge.ts`. Replace the comment at lines 24–25 (stance/calc) and 28–29 (maps/mapfunctions) so they name the distinct mechanisms. New text:

```ts
// COLLISION NOTE — two different mechanisms decide who wins a duplicated name:
//  (1) FUNCTION-EXPORT collision → decided by SPREAD order below (last spread wins).
//      stance & calc both export calcBaseDamageInX; `...calc` is spread before `...stance`,
//      so stance's copy wins, matching the original load order (calc before stance).
//      [Phase 3: calc's copy is being removed as dead code — see calc.ts — after which this
//       specific collision no longer exists, but the general rule stands for any future dup.]
//  (2) TOP-LEVEL `globalThis.X = …` SIDE-EFFECT collision → decided by IMPORT (module-eval)
//      order, NOT spread order. mapfunctions owns the R-map-state inits (RshouldFarm = false, …)
//      which must eval AFTER maps' `= undefined` placeholders; hence maps is imported before
//      mapfunctions. Guarded by tests/build-userscript.test.ts.
```
(Place (1) above the `import * as stance` line and (2) above the `import * as mapfunctions` line, matching where each applies.)

- [ ] **Step 4: Re-run the build + order tests:**

Run: `npx vitest run tests/build-userscript.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit:**

```bash
git add tests/build-userscript.test.ts src/legacy-bridge.ts
git commit -m "test(#51): guard bridge maps-before-mapfunctions import order; clarify collision mechanisms"
```

### Task 2: `calcBaseDamageInX` dead-code dedupe

**Files:**
- Modify: `src/modules/calc.ts:1016-1022` (remove the dead function)
- Modify: `src/modules/stance.ts:6-14` (comment: note calc's copy removed)
- Modify: `tests/fixtures/src-bundle.golden.js` (regen)

**Interfaces:**
- Consumes: the fact (verified in spec §2) that `calcBaseDamageInX` resolves globally to stance.ts's copy (spread after calc), so calc.ts's copy is unreachable.
- Produces: one fewer emitted function; global `calcBaseDamageInX` behavior unchanged.

- [ ] **Step 1: Verify calc.ts's copy is truly dead** — confirm no caller resolves to the module-local calc copy:

Run: `grep -rn "calcBaseDamageInX" src/ | grep -v "calcBaseDamageinX"`
Expected: only the two definitions (calc.ts:1016, stance.ts:31) + two callers (`scryer.ts:115`, `stance.ts:274`) which resolve to the global (stance's) copy — **no calc.ts-internal caller**. Also confirm no OTHER calc/stance export-name collision exists (so relaxing the note is safe):

Run: `node -e "const c=require('fs').readFileSync('src/modules/calc.ts','utf8').match(/export function (\w+)/g)||[];const s=require('fs').readFileSync('src/modules/stance.ts','utf8').match(/export function (\w+)/g)||[];const cs=new Set(c);console.log('collisions:',s.filter(x=>cs.has(x)))"`
Expected: `collisions: [ 'export function calcBaseDamageInX' ]` (only the one we're removing).

- [ ] **Step 2: Remove the dead function** from `src/modules/calc.ts` (the whole `export function calcBaseDamageInX() { … }` block at 1016–1022) and its `//Radon` orphaned-comment context if it becomes a stray. Update the header comment in calc.ts (lines ~9,19 reference the intentional duplication) to state the duplicate was removed in Phase 3.

- [ ] **Step 3: Update stance.ts header comment** (lines 6–14) — change "stays intentionally duplicated with calc.ts" to "calc.ts's dead copy was removed in Phase 3; this is now the sole definition."

- [ ] **Step 4: Regenerate + review the golden as a pure deletion:**

```bash
node scripts/regen-src-golden.mjs
git diff tests/fixtures/src-bundle.golden.js
```
Expected: the diff removes exactly the calc `calcBaseDamageInX` body (5 assignments with the `false` 3rd-arg) and nothing else structural. **Manually confirm** stance's copy (the `true` 3rd-arg version) is untouched.

- [ ] **Step 5: Run typecheck, lint, unit gates:**

```bash
npm run typecheck && npm run lint && npx vitest run tests/src-bundle-parity.test.ts tests/calc.test.ts tests/calc.characterization.test.ts tests/stance.test.ts tests/stance.characterization.test.ts
```
Expected: all PASS.

- [ ] **Step 6: L0 ∅ gate:**

```bash
npm run build && npx vitest run tests/sim/baseline-zero.test.ts
```
Expected: PASS (∅). (The global `calcBaseDamageInX` still resolves to stance's copy, so no decision-path change.)

- [ ] **Step 7: Commit:**

```bash
git add src/modules/calc.ts src/modules/stance.ts tests/fixtures/src-bundle.golden.js
git commit -m "refactor(#51): remove dead calc.ts calcBaseDamageInX copy (stance's wins at global scope)"
```

- [ ] **Step 8: Chrome smoke + FF-merge** (see "Chrome smoke recipe" below; then squash/FF-merge/delete per "Merge recipe"). Combat still computes damage/health normally.

---

## Branch B — `feature/split-other-praiding`

```bash
git checkout main && git pull --ff-only
git checkout -b feature/split-other-praiding
```

### Task 3: Extract `other-praiding.ts` (byte-faithful move)

**Files:**
- Create: `src/modules/other-praiding.ts`
- Modify: `src/modules/other.ts` (remove moved region)
- Modify: `src/legacy-bridge.ts` (import + spread)
- Modify: `tests/fixtures/src-bundle.golden.js` (regen)

**Interfaces:**
- Consumes: bare-global calls from legacy `AutoTrimps2.js:258-264` (`PraidHarder`/`Praiding`/`dailyPraiding`/`BWraiding`) — resolved via the wildcard spread, unchanged.
- Produces: module `other-praiding` exporting all 35 moved fns; the 35 names remain global via the bridge spread. No `at-legacy.d.ts` change (none of these names have ambient decls — legacy JS callers need none).

- [ ] **Step 1: Confirm the cluster is self-contained** (no outbound edges into residual `other.ts`):

Run: `grep -nE "buyWeps|buyArms|questcheck|smithylogic|autoshrine|Rmanageequality" src/modules/other.ts | sed -n '1,40p'`
Cross-check: the functions being moved (`Praiding`/`PraidHarder`/`BWraiding`/`dailyPraiding`/`plusPres*`/`pcheck*`) must NOT call any of the residual grab-bag names. (Spec §4a records this holds; verify before moving.)

- [ ] **Step 2: Create `src/modules/other-praiding.ts`** with a header docblock and the imports the moved code needs. First determine which `./utils` (etc.) imports the cluster uses:

Run: `grep -nE "getPageSetting|debug\(|byId\(" src/modules/other.ts | sed -n '1,5p'` and check `other.ts`'s current import line (top of file) — replicate the same `import { … } from './utils'` in the new file, pruned to what the moved functions actually reference.

Header:
```ts
// Proof-net Phase 3 (#51): byte-faithful move of the U1 Prestige/BW-Raid state machine out of
// other.ts. Function bodies are IDENTICAL to their pre-move form — NO refactor here (that is a
// later per-module pass). Names stay global via legacy-bridge's wildcard spread; legacy
// AutoTrimps2.js calls them by bare name.
import { getPageSetting, debug, byId } from './utils'  // prune to actual usage
```

- [ ] **Step 3: Move the 35 functions + their globals VERBATIM** from `other.ts` into `other-praiding.ts` (cut, paste, do not edit bodies): `isBelowThreshold`, `plusPres`, `plusMapToRun`, `findLastBionic`, `plusMapToRun1-5`, `plusPres1-5`, `pcheck1-5`, `pcheckmap1-5`, `Praiding`, `PraidHarder`, `relaxMapReqs`, `BWraiding`, `dailyPraiding`, `dailyBWraiding`; plus the globals `pMap1-5`/`repMap1-5`/`mapbought1-5` (other.ts:1084-1098), `dpMap1-5`/`drepMap1-5`/`dmapbought1-5`/`dpraidDone` (other.ts:1586+). Split the joint init line `other.ts:12` — keep `globalThis.daily3 = undefined;` in `other.ts`, move `globalThis.praidSetting = undefined;` to `other-praiding.ts`.

- [ ] **Step 4: Wire the bridge** — in `src/legacy-bridge.ts`, add `import * as otherPraiding from './modules/other-praiding'` adjacent to the `other` import (line 34), and add `...otherPraiding` to the `Object.assign` spread (line 45), adjacent to `...other`.

- [ ] **Step 5: Typecheck (catches any missed move / dangling ref):**

Run: `npm run typecheck`
Expected: clean. If a name is "not defined", it was referenced across the new boundary — since all names are global via the bridge, this should not happen for the cluster (self-contained per Step 1); a failure here means a body was accidentally split.

- [ ] **Step 6: Regenerate + review golden as PURE RELOCATION:**

```bash
node scripts/regen-src-golden.mjs
git diff tests/fixtures/src-bundle.golden.js | sed -n '1,120p'
```
Expected: the diff shows the 35 function bodies removed from their old position and re-appearing IDENTICALLY in the new module's emitted position, plus the bridge import/spread addition. **No body text changes.** (If the diff is too large to eyeball, spot-check `Praiding`, `plusPres3`, `pcheckmap5`, `dailyPraiding` bodies byte-for-byte across old/new.)

- [ ] **Step 7: Full gate:**

```bash
npm run lint && npx vitest run tests/build-userscript.test.ts tests/src-bundle-parity.test.ts && npm run build && npx vitest run tests/sim/baseline-zero.test.ts
```
Expected: all PASS. (L0 ∅ is weak here — the U1 corpus likely doesn't set `Praidingzone` — so Step 6's relocation review + Step 8's Chrome smoke are the load-bearing gates.)

- [ ] **Step 8: Commit:**

```bash
git add src/modules/other.ts src/modules/other-praiding.ts src/legacy-bridge.ts tests/fixtures/src-bundle.golden.js
git commit -m "refactor(#51): extract other-praiding.ts from other.ts (byte-faithful move)"
```

- [ ] **Step 9: Chrome smoke** — Prestige-Raid + BW-Raid still fire (see recipe). Then hold for the dead-code task before merge.

### Task 4: Remove dead `dailyBWraiding` + confirm `Rprestraid`-family block (USER-GATED, separate commit)

**Files:**
- Modify: `src/modules/other-praiding.ts` (remove `dailyBWraiding`)
- Modify: `src/modules/other.ts` (the `Rprestraid`-family block, if confirmed dead)
- Modify: `tests/fixtures/src-bundle.golden.js` (regen)

- [ ] **Step 1: Re-confirm zero callers** for `dailyBWraiding` across the whole repo (excluding golden/oracle fixtures):

Run: `grep -rn "dailyBWraiding" src/ legacy/ | grep -v "golden\|\.trace\."`
Expected: only the definition. **STOP and ask the user to approve the deletion** (deletion is user-gated per spec §5).

- [ ] **Step 2 (after approval): Remove `dailyBWraiding`** from `other-praiding.ts`.

- [ ] **Step 3: Grep the `Rprestraid`-family block** (`other.ts:1971-1990` region: `Rprestraid`/`Rdprestraid`/`Rfailpraid`/`Rbwraided`/…) for readers:

Run: `grep -rnE "\bR(d?prestraid|failpraid|d?bwraided|failbwraid|prestraidon|mapbought|bwraidon|presteps|minMaxMapCost|fMap|pMap|shouldFarmFrags|praidDone)\b" src/ legacy/ | grep -v "golden\|\.trace\."`
If zero readers → propose removal too (same user gate). If uncertain, LEAVE IT (file a backlog note) — do not guess.

- [ ] **Step 4: Regen golden + gates:**

```bash
node scripts/regen-src-golden.mjs && npm run typecheck && npm run lint && npm run build && npx vitest run tests/sim/baseline-zero.test.ts tests/src-bundle-parity.test.ts
```
Expected: PASS; golden diff removes only the dead block(s).

- [ ] **Step 5: Commit:**

```bash
git add -A && git commit -m "refactor(#51): remove dead dailyBWraiding [+ Rprestraid-family block] (user-approved)"
```

- [ ] **Step 6: Squash + FF-merge + delete branch** (merge recipe).

---

## Branch C — `feature/split-mapfunctions-amp`

```bash
git checkout main && git pull --ff-only
git checkout -b feature/split-mapfunctions-amp
```

### Task 5: Extract `mapfunctions-amp.ts` (byte-faithful move)

**Files:**
- Create: `src/modules/mapfunctions-amp.ts`
- Modify: `src/modules/mapfunctions.ts` (remove moved region)
- Modify: `src/legacy-bridge.ts` (import + spread)
- Modify: `src/game/at-legacy.d.ts` (repoint 3 + add 1)
- Modify: `tests/fixtures/src-bundle.golden.js` (regen)

**Interfaces:**
- Consumes: `maps.ts` calls `RAMP`/`dRAMP`/`RAMPreset` by bare global (unchanged); residual `mapfunctions.ts`'s `RmapRepeat` calls `RAMPfrag` by bare global (now cross-module — needs an ambient decl).
- Produces: module `mapfunctions-amp` exporting the 9 AMP fns; all stay global via the spread.

- [ ] **Step 1: Confirm AMP globals have NO placeholder-race with maps.ts** (so the new module needs no import-order constraint):

Run: `grep -nE "RAMPpMap|RAMPrepMap|RAMPmapbought|RAMPfragmappy|RAMPprefragmappy|RdAMP" src/modules/maps.ts`
Expected: no matches (maps.ts doesn't init these). Confirms `mapfunctions-amp.ts` import position is unconstrained.

- [ ] **Step 2: Create `src/modules/mapfunctions-amp.ts`** with header + pruned `./utils` imports (mirror mapfunctions.ts's import line):

```ts
// Proof-net Phase 3 (#51): byte-faithful move of the Radon AMP / Prestige-Raid engine out of
// mapfunctions.ts. Bodies IDENTICAL — NO refactor here. Names stay global via legacy-bridge.
// These AMP-own globals have no placeholder-race with maps.ts, so this module's import position
// is unconstrained (unlike residual mapfunctions.ts, which keeps the R-map-state inits).
import { getPageSetting, debug, byId } from './utils'  // prune to actual usage
```

- [ ] **Step 3: Move VERBATIM** the 9 functions (`RAMPplusMapToRun`, `RAMPshouldrunmap`, `RAMPplusPres`, `RAMPplusPresfragmax`, `RAMPplusPresfragmin`, `RAMPfrag`, `RAMPreset`, `RAMP`, `dRAMP`) + the AMP globals (`RAMPpMap1-5`/`RAMPrepMap1-5`/`RAMPfragmappy`/`RAMPprefragmappy`/`RAMPmapbought1-5` + `RdAMP*` mirrors) from `mapfunctions.ts` into `mapfunctions-amp.ts`. Do NOT move `RfragMap` (stays in residual; `RAMP`/`dRAMP` call it cross-module as a bare global — already ambient-declared).

- [ ] **Step 4: Wire the bridge** — add `import * as mapfunctionsAmp from './modules/mapfunctions-amp'` adjacent to the `mapfunctions` import, and `...mapfunctionsAmp` to the spread. (Position unconstrained per Step 1, but keep it adjacent for readability.)

- [ ] **Step 5: Fix `at-legacy.d.ts`** — repoint the 3 existing decls (`dRAMP`, `RAMP`, `RAMPreset` at lines ~287-289) from `typeof import('../modules/mapfunctions')` to `typeof import('../modules/mapfunctions-amp')`, and ADD one new decl:

```ts
  var RAMPfrag: typeof import('../modules/mapfunctions-amp').RAMPfrag
```
(Needed because residual `RmapRepeat` now calls `RAMPfrag` across the module boundary.)

- [ ] **Step 6: Typecheck:**

Run: `npm run typecheck`
Expected: clean. A `RAMPfrag`/`RAMP`/`dRAMP`/`RAMPreset` "not assignable / not found" error means a decl repoint was missed.

- [ ] **Step 7: Regen + review golden as PURE RELOCATION:**

```bash
node scripts/regen-src-golden.mjs
git diff tests/fixtures/src-bundle.golden.js | sed -n '1,120p'
```
Expected: 9 bodies relocated identically + bridge wiring. Spot-check `RAMP`, `dRAMP`, `RAMPreset` (note the `@ts-expect-error`-preserved `recyle` typo in RAMPreset's daily branch must ride along UNCHANGED), `RAMPfrag` byte-for-byte.

- [ ] **Step 8: Full gate:**

```bash
npm run lint && npx vitest run tests/build-userscript.test.ts tests/src-bundle-parity.test.ts tests/maps.characterization.test.ts && npm run build && npx vitest run tests/sim/baseline-zero.test.ts
```
Expected: all PASS.

- [ ] **Step 9: Commit:**

```bash
git add src/modules/mapfunctions.ts src/modules/mapfunctions-amp.ts src/legacy-bridge.ts src/game/at-legacy.d.ts tests/fixtures/src-bundle.golden.js
git commit -m "refactor(#51): extract mapfunctions-amp.ts from mapfunctions.ts (byte-faithful move)"
```

- [ ] **Step 10: Chrome smoke** — Radon AMP prestige-map buying still fires (recipe). Then squash + FF-merge + delete.

---

## Chrome smoke recipe (lead-inline, per branch before merge)

1. `npm run build && npm run serve` (background) → serves `../trimps-game` on `:8080` with the built bundle injected at `/autotrimps.dev.js`.
2. Open `http://localhost:8080/` in Chrome (chrome-devtools-mcp).
3. Confirm the console shows **"AutoTrimps - Zek Fork Loaded!"** and NO errors/ReferenceErrors (a broken split throws `X is not defined` at load).
4. Branch-specific readback via `evaluate_script`:
   - **A (dedupe):** `typeof calcBaseDamageInX === 'function'` → true; call it, confirm `baseHealth`/`baseMinDamage` populate.
   - **B (other-praiding):** `typeof Praiding === 'function' && typeof BWraiding === 'function' && typeof plusPres3 === 'function'` → true; `globalThis.prestraid` is defined (not thrown).
   - **C (mapfunctions-amp):** `typeof RAMP === 'function' && typeof dRAMP === 'function' && typeof RAMPfrag === 'function'` → true; `globalThis.RshouldFarm === false` (residual inits still ran) and `typeof RAMPpMap1 !== 'undefined' || RAMPpMap1 === undefined` (AMP init present).

## Merge recipe (per branch)

```bash
git checkout main && git pull --ff-only
git merge --squash feature/<name> && git commit   # single squashed commit
git push origin main
git branch -d feature/<name>
git push origin --delete feature/<name>   # only if it was pushed
```
(Autonomous-merge authority applies to this net-verified refactor class — no per-branch ask, given green gates + clean review. See memory feedback-autonomous-merge-proofnet.)

---

## Self-review

- **Spec coverage:** 3a→Task 2; 3b→explicitly rejected (Global Constraints + no task); 3c→Task 3; 3d→Task 5; 3e seam→Task 1; dead code→Task 4. ✓
- **Placeholder scan:** no TBD/TODO; every code step shows the code/command. The `// prune to actual usage` notes are genuine (the exact import subset is discovered by the grep in the prior step), not placeholders. ✓
- **Type consistency:** new module names (`other-praiding`, `mapfunctions-amp`), bridge identifiers (`otherPraiding`, `mapfunctionsAmp`), and the added ambient `RAMPfrag` decl are used consistently across tasks. ✓
- **Ordering:** guard test (Task 1) lands before the splits; `other` split (simpler, zero ambient changes) before `mapfunctions` split (ambient repoints). ✓
