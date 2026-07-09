# Post-Phase-1 Type-Quality Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kill the ~414 single-hop `getElementById(...) as any` DOM casts behind one typed helper and make `at-legacy.d.ts` honest, guarded by a rebuilt emitted-JS behavioral net — with zero gameplay-behavior change.

**Architecture:** Phase 1 left all 33 modules strict-but-`any`. This milestone tightens the leaked-into-our-logic `any` (not the game-object seam). A committed golden snapshot of `esbuild(src/main.ts)` output is the safety net: pure-cast edits must keep it byte-identical; helper-refactor edits regenerate it and require a reviewed pure-transformation diff + Chrome differential. Suppression lines and the game boundary are untouched.

**Tech Stack:** TypeScript (strict), esbuild (bundle/emit), Vitest, oxlint, the `../trimps-game` clone for Chrome differential verify.

---

## File Structure

```text
tests/fixtures/src-bundle.golden.js       CREATE — golden snapshot of bundleSrc() output (the net)
tests/src-bundle-parity.test.ts           CREATE — asserts bundleSrc() === golden
scripts/build-userscript.mjs              MODIFY — export bundleSrc (already defined, currently private)
scripts/regen-src-golden.mjs              CREATE — regenerate the golden snapshot on demand
src/modules/utils.ts                       MODIFY — add byId<T>() helper
tests/utils.byId.test.ts                   CREATE — unit test for byId
src/modules/other.ts                       MODIFY — migrate form-control casts (171)
src/modules/mapfunctions.ts                MODIFY — migrate form-control casts (146)
src/modules/{MAZ,settings-visibility,import-export,dynprestige,settings-engine,perks,maps}.ts
                                           MODIFY — migrate remaining form-control casts
src/game/at-legacy.d.ts                    MODIFY — rewrite header, typeof-import the drift-prone sigs
src/modules/query.ts                       MODIFY (optional) — type pure-math params
src/modules/perks.ts                       MODIFY (optional) — AutoPerks/RAutoPerks interface
```

**Convention notes for the implementer (you have zero context — read these):**
- `byId(id)` returns `document.getElementById(id) as T` — the cast erases at compile, so it is
  **runtime-identical** to the old `getElementById(id) as any`, one extra call frame.
- **NEVER touch a `@ts-expect-error` or `@ts-ignore` line.** They encode deliberately-preserved
  shipped bugs (tracked in issue #32). If your edit would make one of them a compile error, STOP and
  leave the suppression in place — do not "fix" the underlying code.
- The golden net is the gate. Run `npm test` after every task. For the DOM-migration tasks the golden
  will change on purpose; regenerate it, then eyeball `git diff tests/fixtures/src-bundle.golden.js`
  to confirm every change is a `getElementById(x) as any` → `byId(x)` swap and nothing else.

---

## Task 1: Rebuild the behavioral net (Issue 0 — PRECONDITION)

**Files:**
- Modify: `scripts/build-userscript.mjs:132` (export the existing `bundleSrc`)
- Create: `scripts/regen-src-golden.mjs`
- Create: `tests/fixtures/src-bundle.golden.js`
- Create: `tests/src-bundle-parity.test.ts`

- [ ] **Step 1: Export `bundleSrc` from the build script**

In `scripts/build-userscript.mjs`, change the function declaration on line 132 from:

```js
async function bundleSrc() {
```

to:

```js
export async function bundleSrc() {
```

- [ ] **Step 2: Write the golden-generator script**

Create `scripts/regen-src-golden.mjs`:

```js
// Regenerates the src-bundle golden snapshot (the type-quality-milestone net).
// Run after an INTENTIONAL helper-refactor edit, then review the git diff of the
// fixture to confirm it is only cast->helper transforms. Pure-cast edits must NOT
// change it (the parity test asserts that).
import { writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundleSrc } from './build-userscript.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = await bundleSrc()
await writeFile(resolve(ROOT, 'tests/fixtures/src-bundle.golden.js'), out)
console.log(`wrote tests/fixtures/src-bundle.golden.js (${out.length} bytes)`)
```

- [ ] **Step 3: Write the failing parity test**

Create `tests/src-bundle-parity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { bundleSrc } from '../scripts/build-userscript.mjs'

// THE NET (type-quality milestone). The golden is the emitted src bundle from the
// commit that opened this milestone. Pure-cast/annotation edits erase at compile ->
// this test MUST stay green (byte-identical proof). Intentional helper refactors
// change the emit -> regenerate via `node scripts/regen-src-golden.mjs`, then review
// the fixture's git diff as a pure cast->helper transformation before committing.
describe('src bundle parity net', () => {
  it('esbuild(src/main.ts) matches the committed golden snapshot', async () => {
    const golden = await readFile(resolve(__dirname, 'fixtures/src-bundle.golden.js'), 'utf8')
    const current = await bundleSrc()
    expect(current).toBe(golden)
  })
})
```

- [ ] **Step 4: Run the test to verify it fails (no fixture yet)**

Run: `npx vitest run tests/src-bundle-parity.test.ts`
Expected: FAIL — `ENOENT` / cannot read `fixtures/src-bundle.golden.js`.

- [ ] **Step 5: Generate the golden and verify the test passes**

Run: `node scripts/regen-src-golden.mjs`
Then: `npx vitest run tests/src-bundle-parity.test.ts`
Expected: PASS — current emit equals the freshly-written golden.

- [ ] **Step 6: Verify the whole suite + typecheck still green**

Run: `npm test`
Expected: all suites pass (new parity test included).
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-userscript.mjs scripts/regen-src-golden.mjs tests/fixtures/src-bundle.golden.js tests/src-bundle-parity.test.ts
git commit -m "test: rebuild emitted-JS parity net for type-quality milestone"
```

---

## Task 2: Add the typed `byId<T>` DOM helper (Issue 1a)

**Files:**
- Modify: `src/modules/utils.ts` (add export)
- Test: `tests/utils.byId.test.ts` (jsdom)

- [ ] **Step 1: Write the failing test**

Create `tests/utils.byId.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { byId } from '../src/modules/utils'

describe('byId', () => {
  it('returns the element typed as HTMLInputElement by default', () => {
    document.body.innerHTML = `<input id="foo" value="bar">`
    const el = byId('foo')
    expect(el.value).toBe('bar') // .value typechecks on the default HTMLInputElement
  })

  it('returns the requested element subtype when given a generic', () => {
    document.body.innerHTML = `<select id="sel"><option>a</option><option selected>b</option></select>`
    const el = byId<HTMLSelectElement>('sel')
    expect(el.selectedIndex).toBe(1) // .selectedIndex only exists on HTMLSelectElement
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/utils.byId.test.ts`
Expected: FAIL — `byId` is not exported from `../src/modules/utils`.

- [ ] **Step 3: Add the helper**

In `src/modules/utils.ts`, add (place near the other exported DOM/util helpers):

```ts
/**
 * Typed `document.getElementById`. Returns the element asserted to the requested
 * subtype (default HTMLInputElement, which structurally covers .value/.checked/
 * .select()/.focus()). Same "assume element exists & has this shape" contract the
 * old `getElementById(id) as any` implied — runtime-identical, the cast erases.
 */
export function byId<T extends HTMLElement = HTMLInputElement>(id: string): T {
    return document.getElementById(id) as T
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/utils.byId.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Verify net + typecheck unaffected**

Run: `npm test`
Expected: all pass, including `src-bundle-parity` — adding an *unused* export does not change the
emit for existing modules, but esbuild tree-shakes only unreferenced code; if the parity test fails
here, the export changed the bundle. In that case regenerate the golden (`node scripts/regen-src-golden.mjs`),
confirm via `git diff tests/fixtures/src-bundle.golden.js` that the ONLY change is the added `byId`
function body, then re-run `npm test`.
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/utils.ts tests/utils.byId.test.ts
# include the golden only if Step 5 required a regen:
git add tests/fixtures/src-bundle.golden.js 2>/dev/null || true
git commit -m "feat: add typed byId() DOM helper"
```

---

## Task 3: Migrate `other.ts` form-control casts (Issue 1b · heaviest file)

**Files:**
- Modify: `src/modules/other.ts` (~171 `getElementById(...) as any` sites)

**Transformation rule (apply to every matching site):**

```text
(document.getElementById("X") as any).value       →  byId("X").value
(document.getElementById("X") as any).checked      →  byId("X").checked
(document.getElementById("X") as any).select()     →  byId("X").select()
(document.getElementById("X") as any).focus()      →  byId("X").focus()
(document.getElementById("X") as any).selectedIndex →  byId<HTMLSelectElement>("X").selectedIndex
(document.getElementById("X") as any).length       →  byId<HTMLSelectElement>("X").length   // <select>.length
```

**DO NOT transform** sites accessing `.parentNode` / `.innerHTML` / `.setAttribute` / `.style` /
`.addEventListener` / `.lastChild` / `.textContent` — those stay `as any` (out of scope; the 89-cast
cluster). If a single `getElementById` result is used for BOTH a form-control property and one of the
excluded properties in the same expression chain, leave it `as any`.

- [ ] **Step 1: Add the import**

At the top of `src/modules/other.ts`, add `byId` to the existing `utils` import (or add a new import
if none exists):

```ts
import { byId } from './utils'
```

(If `other.ts` already imports from `./utils`, add `byId` to that import's braces instead of a new line.)

- [ ] **Step 2: Apply the transformation rule to every in-scope site**

Work top-to-bottom. Example before/after (representative — apply the same shape everywhere):

```ts
// before
(document.getElementById("resourceThreshold") as any).value = threshold;
// after
byId("resourceThreshold").value = threshold;
```

- [ ] **Step 3: Typecheck — the compiler catches every wrong element type**

Run: `npm run typecheck`
Expected: no errors. If a site errors with "Property 'selectedIndex' does not exist on type
'HTMLInputElement'", change that site to `byId<HTMLSelectElement>(...)`. If it errors that a property
like `.parentNode` is fine but `.value` is not, you transformed an out-of-scope site — revert it to
`as any`.

- [ ] **Step 4: Regenerate the golden and review the diff**

Run: `node scripts/regen-src-golden.mjs`
Run: `git diff tests/fixtures/src-bundle.golden.js`
Expected: every hunk is a `document.getElementById("X") as any` → `byId("X")` (or `byId(...)` with a
type arg) swap and nothing else. **If any hunk shows a logic change** (a moved statement, a changed
literal, an altered condition), you introduced an unintended edit — fix `other.ts` and regenerate.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass (the parity test now matches the regenerated golden).

- [ ] **Step 6: Commit**

```bash
git add src/modules/other.ts tests/fixtures/src-bundle.golden.js
git commit -m "refactor: migrate other.ts form-control casts to byId()"
```

---

## Task 4: Migrate `mapfunctions.ts` form-control casts (Issue 1b)

**Files:**
- Modify: `src/modules/mapfunctions.ts` (~146 sites)

⚠️ `mapfunctions.ts` is the highest-suppression file and contains the #32 `recyle` typo behind
`@ts-expect-error`. **Do not touch any `@ts-expect-error`/`@ts-ignore` line or the code it guards.**

- [ ] **Step 1: Add the `byId` import**

Add `byId` to the existing `./utils` import in `src/modules/mapfunctions.ts`.

- [ ] **Step 2: Apply the same transformation rule as Task 3**

Same rule and exclusions as Task 3, Step 2. Skip any site inside or adjacent to a suppression line.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors (same wrong-type-fixes guidance as Task 3, Step 3).

- [ ] **Step 4: Regenerate + review the golden diff**

Run: `node scripts/regen-src-golden.mjs`
Run: `git diff tests/fixtures/src-bundle.golden.js`
Expected: only cast→`byId` swaps. Confirm NO change near the `recyle`/`recycleMap` region.

- [ ] **Step 5: Full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/modules/mapfunctions.ts tests/fixtures/src-bundle.golden.js
git commit -m "refactor: migrate mapfunctions.ts form-control casts to byId()"
```

---

## Task 5: Migrate remaining form-control casts (Issue 1b)

**Files:**
- Modify: `src/modules/MAZ.ts`, `settings-visibility.ts`, `import-export.ts`, `dynprestige.ts`,
  `settings-engine.ts`, `perks.ts`, `maps.ts`

⚠️ Per-file cautions:
- `import-export.ts`: `exportArea` is a `<textarea>` (has `.value`/`.select()` — default helper is
  fine); `clipBoardBtn` is a `<div>` accessed via `.innerHTML`/`.addEventListener` — **leave it
  `as any`** (out of scope).
- `settings-engine.ts` `settingChanged(id)` (lines ~193-221): the element is a `<div>` for
  boolean/multitoggle branches (`.setAttribute`/`.textContent` — leave `as any`) and a `<select>` for
  the dropdown branch (`.value` — migrate to `byId<HTMLSelectElement>(id)` or default `byId` since
  `.value` exists on both). Only migrate the `.value` site; leave the `.setAttribute`/`.textContent`
  sites untouched.
- `perks.ts`: has `@ts-ignore` for-in lines — do not touch them; only migrate `getElementById` casts.

- [ ] **Step 1: For each file, add the `byId` import and apply the transformation rule**

Same rule and exclusions as Task 3, Step 2, honoring the per-file cautions above. Do the files
one at a time.

- [ ] **Step 2: Typecheck after each file**

Run: `npm run typecheck`
Expected: no errors. Fix wrong element subtypes as in Task 3, Step 3.

- [ ] **Step 3: Confirm the in-scope cast class is gone**

Run: `grep -rn 'getElementById(.*) as any' src/modules/MAZ.ts src/modules/settings-visibility.ts src/modules/import-export.ts src/modules/dynprestige.ts src/modules/settings-engine.ts src/modules/perks.ts src/modules/maps.ts`
Expected: only the deliberately-excluded sites remain (the `clipBoardBtn` div, the settings-engine
`.setAttribute`/`.textContent` div branches, and any `.parentNode`/`.innerHTML` sites). No
form-control (`.value`/`.checked`/`.selectedIndex`/`.select`/`.focus`) site should remain.

- [ ] **Step 4: Regenerate + review the golden diff**

Run: `node scripts/regen-src-golden.mjs`
Run: `git diff tests/fixtures/src-bundle.golden.js`
Expected: only cast→`byId` swaps across the seven files.

- [ ] **Step 5: Full suite + lint**

Run: `npm test`
Expected: all pass.
Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/modules/MAZ.ts src/modules/settings-visibility.ts src/modules/import-export.ts src/modules/dynprestige.ts src/modules/settings-engine.ts src/modules/perks.ts src/modules/maps.ts tests/fixtures/src-bundle.golden.js
git commit -m "refactor: migrate remaining form-control casts to byId()"
```

---

## Task 6: Chrome differential verify of the DOM migration (Issue 1 acceptance)

**Files:** none (verification only). Uses the `../trimps-game` clone.

- [ ] **Step 1: Build and serve**

Run: `npm run build`
Expected: `dist/autotrimps.user.js` written, no errors.
Run (background): `npm run serve`
Expected: serving on `http://localhost:8080/`.

- [ ] **Step 2: Load in Chrome and confirm boot**

Open `http://localhost:8080/?mute=1` in Chrome (via chrome-devtools-mcp). Confirm the console shows
`AutoTrimps - Zek Fork Loaded!` and no errors.

- [ ] **Step 3: Exercise the migrated UI surfaces**

Drive these and assert unchanged behavior (these are the properties the migrated casts touch):
- Toggle a settings checkbox → its `.checked` state flips and persists.
- Change a dropdown (`<select>`) setting → the new `.value`/`.selectedIndex` takes effect.
- Open the export tooltip → the `<textarea>` populates and `.select()` selects its text.
- Open import → paste + apply reads `.value` correctly.

Expected: identical behavior to pre-migration. Note any discrepancy — a discrepancy means a wrong
element subtype slipped past typecheck (rare) or an out-of-scope site was wrongly migrated.

- [ ] **Step 4: Stop the dev server**

Stop the background `npm run serve` process.

---

## Task 7: `at-legacy.d.ts` honesty pass (Issue 2)

**Files:**
- Modify: `src/game/at-legacy.d.ts`

- [ ] **Step 1: Rewrite the stale header comment**

Replace the top-of-file comment that says the file *"shrinks as modules convert"* with an accurate
description:

```ts
// at-legacy.d.ts — the PERMANENT bare-name globalThis seam between converted modules.
// (Phase 1 is complete; this file no longer "shrinks as modules convert".) Converted
// modules read each other's state by bare name via legacy-bridge's globalThis spread,
// so those names need ambient declarations here. Two kinds of entry:
//   1. Functions with a real owning module -> declared `typeof import('../modules/X').fn`
//      so the ambient signature is generated from the source of truth and cannot drift.
//   2. Informal cross-module state flags (booleans/numbers/undefined tri-states) -> kept
//      `any` by design; precisely typing all of them is low-value and risks wrong narrowing.
```

- [ ] **Step 2: Convert drift-prone function declarations to `typeof import(...)`**

For each ambient function declaration of the form `declare function foo(...): T;` (or
`var foo: (...) => T`) whose real implementation lives in a converted module, replace it with a
`typeof import(...)` reference. Example:

```ts
// before
declare function calcOurDmg(minMaxAll: string, fluctuation: number, ...): number;
// after
declare var calcOurDmg: typeof import('../modules/calc').calcOurDmg;
```

Work through the ~40 such entries (owning modules include `calc.ts`, `query.ts`, `buystate.ts`,
`equipment.ts`, `mapfunctions.ts`, `breedtimer.ts`, `gather.ts`, `utils.ts`). For each, confirm the
function is actually `export`ed from that module (grep `export function <name>` /
`export const <name>`); if it is NOT exported, leave its declaration as-is (it is not a drift risk
because there is no typed source of truth) and move on.

- [ ] **Step 3: Typecheck — this is where drift would surface**

Run: `npm run typecheck`
Expected: no errors. **If a `typeof import(...)` reference now produces a call-site type error**, a
caller was passing the wrong argument shape — this is a *newly surfaced latent bug*, NOT something to
fix inline. STOP: revert that one declaration to its hand-written `any` signature, and note the
call-site mismatch as a candidate for issue #32 (behavior-gated). Continue with the rest.

- [ ] **Step 4: Confirm the net stayed byte-identical**

Run: `npm test`
Expected: all pass INCLUDING `src-bundle-parity` **without** regenerating the golden — `.d.ts` files
carry zero runtime emit, so the bundle must be unchanged. If the parity test fails, you edited
something outside `at-legacy.d.ts`; revert the stray change.

- [ ] **Step 5: Commit**

```bash
git add src/game/at-legacy.d.ts
git commit -m "refactor: make at-legacy.d.ts honest — fix header, typeof-import drift-prone sigs"
```

---

## Task 8 (OPTIONAL, lower priority): pure-math params + AutoPerks interface (Issue 3)

Only do this task if the milestone has budget after Tasks 1-7. It is pure-cast/annotation work, so the
net stays byte-identical (no golden regen).

**Files:**
- Modify: `src/modules/query.ts` (param annotations)
- Modify: `src/modules/perks.ts` + `src/game/at-legacy.d.ts` (AutoPerks interface)

- [ ] **Step 1: Type `query.ts` pure-math params against their call sites**

For each dense pure-math function with `: any` params (e.g. `getEnemyMaxAttack(a, b, c, d, e)`), read
its call sites (`grep -rn 'getEnemyMaxAttack(' src/modules`) and annotate each param to its real
primitive (zone/level `number`, job/building-name `string`, corrupt/flag `boolean`, optional
multiplier `number | undefined`). Leave genuinely-polymorphic params as `any` with a one-line comment
`// polymorphic: <why>` — do not silently skip them.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. Same STOP rule as Task 7, Step 3 — a surfaced call-site mismatch is a #32
candidate, not an inline fix.

- [ ] **Step 3: Define the `AutoPerks`/`RAutoPerks` interface**

In `src/modules/perks.ts`, add and export an interface for the shape both objects share:

```ts
export interface PerkAllocatorAPI {
    calculateIncrease(/* real params from the implementation */): number
    // ...one entry per method attached to AutoPerks/RAutoPerks
}
```

Read the actual `AutoPerks.<method> = function(...)` / `RAutoPerks.<method> = ...` assignments in
`perks.ts` to enumerate the methods and their signatures. Then in `src/game/at-legacy.d.ts` replace
the `any` declarations with:

```ts
declare var AutoPerks: import('../modules/perks').PerkAllocatorAPI;
declare var RAutoPerks: import('../modules/perks').PerkAllocatorAPI;
```

Note: this does **not** remove the `perks.ts` for-in `@ts-ignore` lines — those stay #32-gated.

- [ ] **Step 4: Typecheck + net + lint**

Run: `npm run typecheck`
Expected: no errors (a typo like `AutoPerks.calculateIncrease` misspelled is now a compile error).
Run: `npm test`
Expected: all pass, `src-bundle-parity` byte-identical (no golden regen — annotations + `.d.ts` only).
Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/query.ts src/modules/perks.ts src/game/at-legacy.d.ts
git commit -m "refactor: type query.ts pure-math params + AutoPerks interface"
```

---

## Self-review checklist (for the plan author — already run)

- **Spec coverage:** Issue 0 → Task 1. Issue 1a → Task 2. Issue 1b → Tasks 3-5 + verify Task 6.
  Issue 2 → Task 7. Issue 3 (optional) → Task 8. Non-goals (89-cast cluster, suppressions, state-flag
  globals, game boundary, module splitting) are called out as explicit exclusions in the transformation
  rules and per-file cautions. ✅
- **Placeholder scan:** no TBD/TODO; every code step shows real code; the one legitimately-deferred
  detail (exact AutoPerks method signatures) is directed to be read from the implementation, in the
  optional task. ✅
- **Type consistency:** `byId<T extends HTMLElement = HTMLInputElement>(id: string): T` used
  identically in Task 2 (definition) and Tasks 3-5 (call sites); `bundleSrc` export used consistently
  in Task 1 script + test; `PerkAllocatorAPI` defined and referenced consistently in Task 8. ✅
