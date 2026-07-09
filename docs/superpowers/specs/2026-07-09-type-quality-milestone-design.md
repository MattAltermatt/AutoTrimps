# Post-Phase-1 Type-Quality Milestone — Design

**Date:** 2026-07-09
**Status:** Approved (brainstorm + 3-agent duel + naysayer synthesis)
**Scope owner:** GitHub milestone (to be opened) — the first arc after Phase 1 true-TS.

## Context

Phase 1 (milestone #5) converted all 33 `src/modules/*.ts` from `@ts-nocheck` to **strict**
TypeScript. Strict, but not *honest*: the code leans on ~851 `any` usages and 35 TS-suppressions.
The conversion contract was deliberate — *our* code strict, the game API a **pragmatic ambient
`any` seam**. This milestone tightens the part of that surface that leaked into our own logic,
**without** re-litigating the game-object boundary and **without** touching gameplay behavior.

### The `any` surface (measured 2026-07-09)

```text
851  total `any` usages in src/modules (excluding .d.ts)
571  `as any` casts
     └─ ~524 are `document.getElementById("…") as any`, splitting into:
        414  single-hop form-control access (.value/.checked/.selectedIndex/.select()/.focus())
              → TRACTABLE: one typed helper
         89  .parentNode/.innerHTML/.setAttribute/.style/.addEventListener/.lastChild
              → null-bypass + multi-hop chains → OUT OF SCOPE (own backlog item)
488  `: any` annotations — mostly faithful-port untyped fn params (a, b, level, i…)
 35  TS-suppressions in 6 files (heirlooms, mapfunctions, jobs, settings-visibility, perks, portal)
     └─ most encode #32's deliberately-preserved latent bugs → OUT OF SCOPE (behavior-gated)
```

## Load-bearing findings from the agent duel

1. **The DOM casts are not uniform.** ~414 are single-hop form-control reads a typed helper fixes
   mechanically; ~89 are `.parentNode`/`.innerHTML` null-bypass casts with multi-hop chains that
   need per-line judgment. Only the 414 are in scope.

2. **A single helper does not fit every DOM site.** `settings-engine.ts:193-221` `settingChanged(id)`
   resolves the *same* id to a `<div>` vs `<select>` by runtime branch (`btn.type`); `import-export.ts`
   mixes a `<textarea>` (`exportArea`) with a `<div>` (`clipBoardBtn`). The helper handles this via a
   **per-call generic** (`byId<HTMLSelectElement>(id)`), and a wrong generic **fails `tsc`** — the
   migration is self-verifying, but it is a property→type mapping pass, not a blind find-replace.

3. **The behavioral safety net is currently GONE.** Phase 1's byte-diff gate is retired (the
   `gh-pages` baseline branch is deleted); CI runs only `typecheck` + `test`. The headline helper is
   a *function call* (`byId(id)` vs `getElementById(id) as any`), so it changes emitted JS and cannot
   be guarded by byte-identity. **We must rebuild a net before the first edit** (Issue 0). This is the
   milestone's #1 risk — bigger than the any-count.

4. **`as any` masks shipped bugs.** The #32-gated suppressions (`recyle` typo → `recycleMap` never
   runs; `loom` undefined; heirloom `!x>=10`; jobs `Math.ceil` arg slip; `hson` read-before-assign)
   each preserve *current shipped behavior*. Un-suppressing "fixes" them → gameplay change →
   sacrosanct / user-gated. **Bright line: this milestone touches zero suppression lines.**

5. **`at-legacy.d.ts` is now stale in two ways.** Its header says it *"shrinks as modules convert"* —
   false, conversion is done. And ~40 of its function declarations are hand-duplicated `any`
   signatures that can silently **drift** from the real implementation in the owning converted module.

## Goals / Non-goals

**Goals**
- Kill the ~414 single-hop `getElementById(...) as any` DOM casts via one typed helper (~65% of all
  `any`s, zero behavior risk).
- Make `at-legacy.d.ts` honest: correct its header, and replace hand-duplicated function signatures
  with `typeof import(...)` references so the seam cannot drift from source.
- (Optional/lower) Type the pure-math param `any`s (`query.ts`) and the `AutoPerks`/`RAutoPerks`
  interface (we own both ends).
- Rebuild an automated behavioral net **before** any edit lands.

**Non-goals (explicitly OUT)**
- The ~89 `.parentNode`/`.innerHTML`/DOM-manipulation casts (own backlog item — different risk).
- **Any** `@ts-expect-error`/`@ts-ignore` line, including the "safe" `perks.ts` for-in TS2403 ones —
  kept out to preserve a clean bright line; suppressions are #32's domain.
- The ~400 informal state-flag `any` globals in `at-legacy.d.ts`/`trimps.d.ts` — leave `any`;
  only the header comment changes.
- The `game: any` native-object boundary — the designed pragmatic seam, untouched.
- Module-splitting the oversized files (mapfunctions 2799 / other 2378 / calc 1821) — own later milestone.
- Any gameplay/tuning/behavior change — if a real type surfaces a genuine mismatch, it is **gated**
  (see Risk).

## Design

### Issue 0 — Rebuild the behavioral net (PRECONDITION, do first)

Snapshot the current `main` HEAD's `esbuild(src/main.ts)` emitted JS as a golden-master oracle
(committed test fixture). Establish the **tiered proof** every subsequent PR must satisfy:

- **Pure cast edits** (`x as any` → `x as HTMLInputElement`, param annotations): must emit
  **byte-identical** to the snapshot (casts erase at compile). A byte-diff test asserts this.
- **Helper-refactor edits** (`getElementById(x) as any` → `byId(x)`): byte-identity intentionally
  breaks, so the proof is instead **(a)** the emitted-JS diff reviewed as a pure cast→helper
  transformation (no logic delta), **(b)** the Layer-1/Layer-2 characterization harness green
  (`tests/setup.ts`, `tests/harness/gameFixture.ts`), and **(c)** a Chrome differential pass in
  `../trimps-game` on the touched UI.

**Acceptance:** a committed emitted-JS snapshot fixture + a test that diffs against it; documented
tiered-proof rule (in the milestone issue and/or CONVENTIONS). No `src/modules` edits in this issue.

### Issue 1 — Typed `byId<T>` DOM helper + migrate the 414 form-control casts

Add to `src/modules/utils.ts` (heavily-imported, matches the converted→converted wiring convention):

```ts
export function byId<T extends HTMLElement = HTMLInputElement>(id: string): T {
    return document.getElementById(id) as T;
}
```

Migration rules (deterministic property→type mapping):
- `.value` / `.checked` / `.select()` / `.focus()` → `byId(id)` (default `HTMLInputElement`
  structurally satisfies all four — same "assume element exists & has this shape" contract the
  `as any` already implied).
- `.selectedIndex` / `.length` (~8 sites: perks×4, settings-visibility×2, dynprestige×2) →
  `byId<HTMLSelectElement>(id)`.

Runtime-identical: `byId(id)` compiles to `document.getElementById(id)` wrapped in one call frame;
the cast erases. A wrong generic cannot ship — it fails `npm run typecheck`.

**Files:** other.ts, mapfunctions.ts, MAZ.ts, settings-visibility.ts, import-export.ts (form-control
sites only — the `clipBoardBtn` div stays as-is), dynprestige.ts, settings-engine.ts (only the
non-polymorphic sites), perks.ts, maps.ts.

**Acceptance:** zero `getElementById(...) as any` on the listed form-control properties across those
files; `typecheck`/`build`/`test` green; Chrome smoke-test (toggle a checkbox, change a dropdown,
open export/import, copy-to-clipboard) shows unchanged behavior; net proof per Issue 0 tier.

### Issue 2 — `at-legacy.d.ts` honesty pass

1. **Rewrite the header comment.** Drop *"shrinks as modules convert"*; describe the file as the
   **permanent bare-name globalThis seam** between converted modules, with the split: entries that
   have a real owning module are typed via `typeof import(...)`; informal state flags stay `any` by
   design.
2. **Kill signature drift.** For each of the ~40 `function foo(...rest: any[]): T` entries whose real
   implementation lives in a converted module (`calc.ts`, `query.ts`, `buystate.ts`, `equipment.ts`,
   `mapfunctions.ts`, `breedtimer.ts`, `gather.ts`, `utils.ts`, …), replace the hand-written
   signature with `var foo: typeof import('../modules/X').foo`.

**Acceptance:** every ambient function whose implementation exists in `src/modules` is declared via
`typeof import(...)`; remaining `any` entries covered by one honest top-of-file justification; a
deliberately-wrong call to a now-typed seam function is a `tsc` error; `typecheck`/`build`/`test` green.

### Issue 3 (optional, lower priority) — pure-math params + AutoPerks interface

- Type `query.ts`'s dense pure-math params (`getEnemyMaxAttack(a,b,c,d,e)` etc.) to their real
  primitives (zone/level `number`, job/building-name `string`, flags `boolean`), verified against
  call sites. Genuinely-polymorphic params keep `any` with a one-line comment (not silently skipped).
- Define `interface PerkAllocatorAPI` in `perks.ts` for `AutoPerks`/`RAutoPerks` (methods:
  `getTierIIPerks`, `calculateIncrease`, `clickAllocate`, …); declare the globals with it in
  `at-legacy.d.ts`. Note: this does **not** remove the perks for-in suppressions (those stay #32-gated).

**Acceptance:** no `: any` on params with an unambiguous call-site type; `AutoPerks.calculateIncrease`
typo becomes a compile error; net proof per Issue 0 (these are byte-identical pure-cast edits).

## Risk & guardrails

**Primary risk:** a real type surfaces a *new, previously-invisible* latent bug (wrong arg order, an
`undefined` reaching a `number` sink), and it gets "fixed" inline — a gameplay change smuggled in via
a type-checker error instead of an obvious numeric edit.

**Guardrails:**
1. **Every new type error is a triage decision, not a fix-it ticket.** Classify: (a) type-only → safe
   to annotate; (b) behavior-ambiguous → **STOP**, preserve verbatim behind a suppression citing a new
   tracking issue (the #32 protocol), do **not** silently resolve.
2. **The rebuilt net (Issue 0) is the gate**, not the retired byte-diff-vs-gh-pages.
3. **Scope each PR to the files it retypes** — no "while I'm in here" drift onto an adjacent
   suppression or #32-tagged line.
4. **Highest-scrutiny diffs:** other.ts, mapfunctions.ts, perks.ts (deepest game-state coupling +
   suppression density) get the Chrome differential every time.

## Sequencing

```text
Issue 0 (net)  →  Issue 1 (DOM helper, headline)  →  Issue 2 (at-legacy honesty)
                                                   →  Issue 3 (optional, params/AutoPerks)
```

Issue 0 blocks all others. Issues 1–3 are independent after that; 1 is the headline, 3 is optional.
