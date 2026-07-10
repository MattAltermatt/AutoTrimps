# Settings Control-Semantics Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give AutoTrimps settings controls a leading-glyph taxonomy (✓/✗ toggles, ⟳+(n/N) cycles, ▶/⇄ actions) that is additive over the native `settingBtn` palette, so each control's kind and state are obvious and colorblind-legible.

**Architecture:** All render logic in `src/modules/settings-engine.ts` flows through one new shared helper, `renderControlFace(el, rec)`, called from both `createSetting` (mount) and `settingChanged` (state change) — eliminating the current class/label duplication. The face is composed of **cached child spans** (a leading `.settingGlyph`, the label text node, and a cycle `.settingCount`) mutated in place, never `innerHTML`-rebuilt on the click path. Native `settingBtn{state}` background colors are kept; glyphs are icomoon spans. A small `tabs.css` block styles glyph spacing.

**Tech Stack:** TypeScript (strict), esbuild bundle, Vitest + jsdom characterization tests, the bundled icomoon icon font.

## Global Constraints

- **Additive only** — never override or repaint the native `.settingBtn*` background palette (`../trimps-game/css/style.css:1152–1216`). Glyphs/counters are accents.
- **Click semantics unchanged** — `settingChanged`'s boolean flip, multitoggle increment-mod-`name.length`, dropdown read, and the `AutoMagmiteSpender2` special case (settings-engine.ts:200–205) stay behaviorally identical.
- **No hot-path `innerHTML`** — build child spans once at mount, mutate `textContent`/`className` thereafter (CLAUDE.md `replaceChildren`+click gotcha).
- **Cell geometry untouched** — every control stays inside the existing `13.142vw` cell (settings-engine.ts:19). Layout is #41, not this plan.
- **Glyphs are icomoon classes** — `icon-checkmark`, `icon-cross`, `icon-cycle`, `icon-play3`, `icon-switch` (verified present in `../trimps-game/fonts/icomoon/style.css`); the span carries `class="settingGlyph icomoon icon-*"` (matching the existing usage at settings-engine.ts:320).
- **Tests are jsdom** — characterization files carry `// @vitest-environment jsdom` and assert on `className` / `textContent`, not rendered glyph pixels.
- **Byte-golden is expected to move** — regenerate `tests/fixtures/src-bundle.golden.js` via `node scripts/regen-src-golden.mjs` and review the diff as a pure render-logic change.

---

### Task 1: `renderControlFace` helper + boolean toggle glyph + class-clobber fix (FOUNDATIONAL)

Locks the shared-helper contract, the cached-span idiom, and the `classList`-swap that preserves the kind class. Do this one inline — everything after replicates its shape.

**Files:**
- Modify: `src/modules/settings-engine.ts` — add `renderControlFace` (new module-scoped function); boolean branch of `createSetting` (:23–40); boolean path of `settingChanged` (:195–198).
- Test: `tests/settings-engine.test.ts` — update the existing boolean `createSetting` + `settingChanged` cases.

**Interfaces:**
- Produces: `function renderControlFace(el: any, rec: any): void` — composes/updates a control's cached-child face from its `autoTrimpSettings[id]` record (`rec`). Dispatches on `rec.type`. Tasks 2–3 extend its `multitoggle`/`action`/`infoclick` branches.
- Produces: control DOM nodes now carry a stable `settingKind-toggle|cycle|action` class alongside `settingBtn{state}`.

- [ ] **Step 1: Update the boolean characterization tests to expect the new face**

In `tests/settings-engine.test.ts`, the `createSetting` boolean test and the `settingChanged` boolean test currently assert `textContent === 'Toggle Me'` / class `'noselect settingsBtn settingBtntrue'`. Replace those expectations:

```ts
// in createSetting boolean test:
const btn = document.getElementById('B1')!
expect(btn.getAttribute('class')).toBe('noselect settingsBtn settingKind-toggle settingBtntrue')
expect(btn.querySelector('.settingGlyph')!.className).toBe('settingGlyph icomoon icon-checkmark')
expect(btn.textContent).toBe(' Toggle Me') // leading space after the (text-less) glyph span

// in settingChanged boolean test, after first click (enabled true):
expect(document.getElementById('Foo')!.getAttribute('class')).toBe(
  'noselect settingsBtn settingKind-toggle settingBtntrue',
)
expect(document.getElementById('Foo')!.querySelector('.settingGlyph')!.className).toBe(
  'settingGlyph icomoon icon-checkmark',
)
// after second click (enabled false): icon-cross + settingBtnfalse
```

The `settingChanged` test's `mountButton` currently creates a bare `<div id="Foo">`. Change it to also seed the toggle record's initial face by calling `createSetting` OR pre-building the glyph span; simplest is to have `settingChanged`'s renderControlFace build the span if absent (it does — see Step 3), so a bare `<div>` still works. Keep the boolean record in `autoTrimpSettings` as before.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/settings-engine.test.ts -t "boolean"`
Expected: FAIL — `.settingGlyph` is null / class lacks `settingKind-toggle`.

- [ ] **Step 3: Implement `renderControlFace` + wire the boolean paths**

Add the helper near the top of `settings-engine.ts` (after the `ranstring` declaration, ~:15):

```ts
// Single source of truth for a control's visible face (glyph + label [+ counter]).
// Called at mount and on state change so the two paths can never drift. Cached-child
// mutation only — no innerHTML on the click path (CLAUDE.md replaceChildren+click gotcha).
function renderControlFace(el: any, rec: any) {
    let glyph = el.querySelector(':scope > .settingGlyph');
    if (!glyph) {
        el.textContent = '';
        glyph = document.createElement('span');
        glyph.className = 'settingGlyph icomoon';
        el.appendChild(glyph);
        el.appendChild(document.createTextNode('')); // label text node (childNodes[1])
    }
    var label = el.childNodes[1];
    if (rec.type == 'boolean') {
        glyph.className = 'settingGlyph icomoon ' + (rec.enabled ? 'icon-checkmark' : 'icon-cross');
        label.textContent = ' ' + rec.name;
    }
    // multitoggle / action / infoclick branches added in Tasks 2–3.
}
```

In the boolean branch of `createSetting` (:33 and :37), add the kind class and route the label through the helper:

```ts
btn.setAttribute('class', 'noselect settingsBtn settingKind-toggle settingBtn' + autoTrimpSettings[id].enabled);
// ...existing onclick/onmouseover/onmouseout unchanged...
renderControlFace(btn, autoTrimpSettings[id]);   // replaces `btn.textContent = name;` at :37
```

In `settingChanged`'s boolean path (:196–197), preserve the kind class and re-render the glyph:

```ts
btn.enabled = !btn.enabled;
var elB = document.getElementById(id)!;
elB.setAttribute('class', 'noselect settingsBtn settingKind-toggle settingBtn' + btn.enabled);
renderControlFace(elB, btn);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/settings-engine.test.ts -t "boolean"`
Expected: PASS.

- [ ] **Step 5: Mutation-check the glyph is non-vacuous**

Temporarily flip `icon-checkmark`↔`icon-cross` in the helper, run the boolean test, confirm it FAILS, revert. (Proves the test pins the glyph, not just its presence.)

- [ ] **Step 6: Commit**

```bash
git add src/modules/settings-engine.ts tests/settings-engine.test.ts
git commit -m "feat(#39): renderControlFace helper + boolean toggle glyph (✓/✗)"
```

---

### Task 2: Cycle glyph (⟳) + (n/N) position counter

**Files:**
- Modify: `src/modules/settings-engine.ts` — `renderControlFace` (add `multitoggle` branch); multitoggle branch of `createSetting` (:139–156); multitoggle path of `settingChanged` (:199–211).
- Test: `tests/settings-engine.test.ts` — update the multitoggle `createSetting` + `settingChanged` cases.

**Interfaces:**
- Consumes: `renderControlFace` from Task 1.
- Produces: cycle controls render `<span.settingGlyph.icon-cycle>` + label + `<span.settingCount>(n/N)</span>`; carry `settingKind-cycle`.

- [ ] **Step 1: Update the multitoggle tests**

In `tests/settings-engine.test.ts`, the `createSetting` multitoggle test and the `settingChanged` cycle test assert `textContent === 'On'`/`'Some'` and class `settingBtn1`. Replace:

```ts
// createSetting multitoggle (M1, ['Off','On'], value 1):
const m = document.getElementById('M1')!
expect(m.getAttribute('class')).toBe('noselect settingsBtn settingKind-cycle settingBtn1')
expect(m.querySelector('.settingGlyph')!.className).toBe('settingGlyph icomoon icon-cycle')
expect(m.querySelector('.settingCount')!.textContent).toBe('(2/2)')
expect(m.textContent).toBe(' On (2/2)')

// settingChanged cycle (Bar, ['Off','Some','All']): after 0→1
expect(document.getElementById('Bar')!.querySelector('.settingCount')!.textContent).toBe('(2/3)')
expect(document.getElementById('Bar')!.textContent).toBe(' Some (2/3)')
// after wrap 2→0: '(1/3)', ' Off (1/3)'
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/settings-engine.test.ts -t "multitoggle"`
Expected: FAIL — `.settingCount` null.

- [ ] **Step 3: Implement the cycle branch**

In `renderControlFace`, add after the boolean branch:

```ts
else if (rec.type == 'multitoggle') {
    glyph.className = 'settingGlyph icomoon icon-cycle';
    label.textContent = ' ' + rec.name[rec.value] + ' ';
    var cnt = el.querySelector(':scope > .settingCount');
    if (!cnt) { cnt = document.createElement('span'); cnt.className = 'settingCount'; el.appendChild(cnt); }
    cnt.textContent = '(' + (rec.value + 1) + '/' + rec.name.length + ')';
}
```

In `createSetting`'s multitoggle branch (:149, :153) add the kind class and replace `btn.textContent = ...` with the helper:

```ts
btn.setAttribute('class', 'noselect settingsBtn settingKind-cycle settingBtn' + autoTrimpSettings[id].value);
// ...onclick/onmouseover(name.join(' / '))/onmouseout unchanged...
renderControlFace(btn, autoTrimpSettings[id]);   // replaces `btn.textContent = autoTrimpSettings[id]["name"][...]`
```

In `settingChanged`'s multitoggle path (:206–210), keep the increment/wrap and the `AutoMagmiteSpender2` block (:200–205) exactly, then replace the class + textContent writes (:209–210) with:

```ts
btn.value++;
if (btn.value > btn.name.length - 1) btn.value = 0;
var elC = document.getElementById(id)!;
elC.setAttribute('class', 'noselect settingsBtn settingKind-cycle settingBtn' + btn.value);
renderControlFace(elC, btn);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/settings-engine.test.ts -t "multitoggle"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/settings-engine.ts tests/settings-engine.test.ts
git commit -m "feat(#39): cycle glyph (⟳) + (n/N) position counter"
```

---

### Task 3: Action / infoclick glyphs (▶ / ⇄) + declarative infoclick color

**Files:**
- Modify: `src/modules/settings-engine.ts` — `renderControlFace` (add `action`/`infoclick` branches); action branch (:157–167) and infoclick branch (:128–138) of `createSetting`.
- Test: `tests/settings-engine.test.ts` — update the action + infoclick cases.

**Interfaces:**
- Consumes: `renderControlFace`.
- Produces: action → `<span.settingGlyph.icon-play3>` + label, class `settingKind-action`; infoclick → `icon-switch` + label, class `settingKind-action settingKind-info` (orange comes from CSS in Task 4, not the inline style).

- [ ] **Step 1: Update the action + infoclick tests**

The current tests assert `autoTrimpSettings['A1']`/`['I1']` are `undefined` (early return — keep that) and check `onclick`. Add glyph + class expectations; the early-return / no-stored-setting invariant MUST still hold:

```ts
// action A1 (defaultValue 'doThing()'):
expect((globalThis as any).autoTrimpSettings['A1']).toBeUndefined()
const a = document.getElementById('A1')!
expect(a.getAttribute('onclick')).toBe('doThing()')
expect(a.getAttribute('class')).toBe('noselect settingsBtn settingKind-action')
expect(a.querySelector('.settingGlyph')!.className).toBe('settingGlyph icomoon icon-play3')
expect(a.textContent).toBe(' Do It')

// infoclick I1: onclick unchanged; class settingKind-action settingKind-info; icon-switch;
// AND the inline background-color style is gone:
const i = document.getElementById('I1')!
expect(i.getAttribute('class')).toBe('noselect settingsBtn settingKind-action settingKind-info')
expect(i.querySelector('.settingGlyph')!.className).toBe('settingGlyph icomoon icon-switch')
expect(i.getAttribute('style') || '').not.toContain('d88839')
```

Note: action/infoclick return early and have **no** `autoTrimpSettings` record, so `renderControlFace` here is called with a synthesized `{type, name}` object (they don't persist). Pass a literal.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/settings-engine.test.ts -t "action|infoclick"`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `renderControlFace`, add:

```ts
else if (rec.type == 'action') {
    glyph.className = 'settingGlyph icomoon icon-play3';
    label.textContent = ' ' + rec.name;
} else if (rec.type == 'infoclick') {
    glyph.className = 'settingGlyph icomoon icon-switch';
    label.textContent = ' ' + rec.name;
}
```

In `createSetting`'s **infoclick** branch (:128–138), replace the class + inline color + textContent:

```ts
btn.setAttribute('class', 'noselect settingsBtn settingKind-action settingKind-info');
btn.setAttribute("onclick", 'ImportExportTooltip(\'' + defaultValue + '\', \'update\')');
// onmouseover/onmouseout unchanged; DELETE the `btn.setAttribute("style", "background-color:#d88839...")` line
renderControlFace(btn, { type: 'infoclick', name: name });
btnParent.appendChild(btn);
if (container) document.getElementById(container)!.appendChild(btnParent);
else document.getElementById("autoSettings")!.appendChild(btnParent);
return;
```

In the **action** branch (:157–167):

```ts
btn.setAttribute('class', 'noselect settingsBtn settingKind-action');
btn.setAttribute('onclick', defaultValue);
// onmouseover/onmouseout unchanged; DELETE the `btn.setAttribute("style","font-size:1.1vw")`? keep font-size
renderControlFace(btn, { type: 'action', name: name });
btnParent.appendChild(btn);
if (container) document.getElementById(container)!.appendChild(btnParent);
else document.getElementById("autoSettings")!.appendChild(btnParent);
return;
```

(Keep the `font-size:1.1vw` style attribute on both; only the infoclick `background-color` inline is removed.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/settings-engine.test.ts -t "action|infoclick"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/settings-engine.ts tests/settings-engine.test.ts
git commit -m "feat(#39): action/infoclick glyphs (▶/⇄) + declarative info color"
```

---

### Task 4: `tabs.css` glyph styling + no-op kind markers on value/text/dropdown

**Files:**
- Modify: `tabs.css` — add the `settingKind-*` styling block.
- Modify: `src/modules/settings-engine.ts` — add marker classes to value/valueNegative/multiValue (:51), textValue (:87), dropdown (:109).
- Test: `tests/settings-engine.test.ts` — assert the marker class on a `value` control.

**Interfaces:**
- Produces: `value`/`text` controls carry `settingKind-input`; `dropdown` carries `settingKind-select` (visual appearance unchanged — seam for #41).

- [ ] **Step 1: Add the value marker-class assertion**

```ts
// createSetting value test (V1):
expect(document.getElementById('V1')!.getAttribute('class')).toBe(
  'noselect settingsBtn btn-info settingKind-input',
)
```

- [ ] **Step 2: Run to verify failure**, then add `settingKind-input` to the value/valueNegative/multiValue/textValue class strings and `settingKind-select` to the dropdown `select`'s class (`btn.setAttribute("class", "noselect settingKind-select")`). Re-run to PASS.

Run: `npx vitest run tests/settings-engine.test.ts -t "value"`

- [ ] **Step 3: Add the CSS block to `tabs.css`**

```css
/* #39 control-semantics taxonomy — additive glyph accents, native palette kept */
.settingGlyph { margin-right: 0.4vw; font-size: 0.95em; opacity: 0.95; }
.settingCount { margin-left: 0.3vw; font-size: 0.85em; opacity: 0.8; font-variant-numeric: tabular-nums; }
.settingKind-info { background-color: #d88839 !important; color: black; }  /* was inline at engine :133 */
```

(No `.settingBtn*` overrides — native colors stay. `.settingKind-input`/`.settingKind-select` are hooks only, no rules yet.)

- [ ] **Step 4: Commit**

```bash
git add src/modules/settings-engine.ts tabs.css tests/settings-engine.test.ts
git commit -m "feat(#39): glyph CSS + no-op kind markers on input/select controls"
```

---

### Task 5: Regenerate the byte-golden + full green gate

**Files:**
- Modify: `tests/fixtures/src-bundle.golden.js` (regenerated).

- [ ] **Step 1: Confirm the inventory golden is untouched**

Run: `npx vitest run tests/settings-inventory.test.ts`
Expected: PASS unchanged (569, zero-dup, catalog) — proves the taxonomy changed rendering only, not the control catalog.

- [ ] **Step 2: Regenerate the src-bundle golden**

Run: `node scripts/regen-src-golden.mjs`
Then inspect the diff: `git --no-pager diff tests/fixtures/src-bundle.golden.js | head -120`
Expected: only `settings-engine.ts` render logic (renderControlFace, the kind classes, the dropped inline color) appears — no unrelated churn. This is the intentional, reviewed diff.

- [ ] **Step 3: Full gate**

Run each and confirm green:
```bash
npm test            # all suites incl. src-bundle-parity + settings-engine + inventory
npm run typecheck
npm run build       # esbuild bundle succeeds
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/src-bundle.golden.js
git commit -m "test(#39): regenerate src-bundle byte-golden for taxonomy render change"
```

---

### Task 6: Live-verify in Chrome

**Files:** none (verification only).

- [ ] **Step 1: Build + serve**

```bash
npm run build && npm run serve   # serves the Trimps clone on :8080 with the bundle injected
```

- [ ] **Step 2: Open `http://localhost:8080/` in Chrome** (per CLAUDE.md, real Chrome — never the built-in preview). Confirm "AutoTrimps - Zek Fork Loaded!" and a clean console.

- [ ] **Step 3: Open the AutoTrimps settings panel and verify each kind renders its glyph**
  - A **toggle** (e.g. AutoPortal) shows `✓`/`✗` and flips the glyph on click (native green/red kept).
  - A **cycle** (e.g. ManualGather2) shows `⟳ <option> (n/N)` and the counter advances + wraps on click.
  - An **action**/infoclick shows `▶`/`⇄` and fires (import/export dialog opens for infoclick).

- [ ] **Step 4: Click-test each new-rendering kind** (per CLAUDE.md "click-test every new interactive control") and read back state via `evaluate_script` (`autoTrimpSettings[id].enabled` / `.value`) to confirm the click path still mutates state. Confirm no console errors and no layout overflow in the 13vw cells.

- [ ] **Step 5: Screenshot for the user-verify handoff.** Surface the running URL; wait for explicit user approval before FF-merge (CLAUDE.md user-verify-before-FF-merge).

---

## Self-Review

**Spec coverage:** toggle ✓/✗ (Task 1), cycle ⟳+(n/N) (Task 2), action/infoclick ▶/⇄ + declarative color (Task 3), keep-native-palette + kind markers + CSS (Tasks 1–4), shared `renderControlFace` + cached spans + class-clobber fix (Task 1, extended 2–3), scope seam on value/dropdown (Task 4), characterization-test updates (Tasks 1–4), byte-golden regen (Task 5), inventory-golden-unaffected check (Task 5), Chrome live-verify + click-test (Task 6). All spec sections map to a task.

**Placeholder scan:** no TBD/TODO; every code step shows the code; glyph classes are concrete icomoon names verified present.

**Type consistency:** `renderControlFace(el, rec)` signature and the `rec.type` dispatch are consistent across Tasks 1–3; class strings (`settingKind-toggle|cycle|action|info|input|select`) are used identically in source, tests, and CSS.
