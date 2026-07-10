# 🎛️ Settings Control-Semantics Taxonomy — Design Spec

**Issue:** [#39 — Normalize UI control semantics](https://github.com/MattAltermatt/AutoTrimps/issues/39)
**Milestone:** Phase 3 — Divergence (#7)
**Date:** 2026-07-09
**Depends on:** #46 settings-\* characterization net (landed — the "net first" gate)
**Unblocks:** #41 (layout streamlining)

---

## 🎯 Problem

AutoTrimps ships **zero control CSS** — every settings button reuses Trimps' native `settingBtn`
palette (`../trimps-game/css/style.css:1152–1216`):

```text
settingBtn0 / settingBtnfalse  →  RED    #d9534f
settingBtn1 / settingBtntrue   →  GREEN  #5cb85c
settingBtn2                    →  YELLOW #ffff00
settingBtn3                    →  TEAL   #318696   (action + infoclick*)
settingBtn4 / settingBtn5      →  PURPLE / BROWN
```

The kind of a control (does clicking **flip**, **advance through N modes**, or **fire once**?) and
its current state are both encoded in a single channel — background hue — which collides:

1. **A 2-state `multitoggle` is pixel-identical to a `boolean` toggle** (both emit red/green).
2. **A cycle at state 0 paints red** — the "off/bad" color — so a live mode (e.g. "Manual
   Gather/Build") reads as a dead switch.
3. **Hue-only encoding is invisible to ~8% of men** (red-green colorblindness); for them the panel
   carries no kind/state signal at all.

### Right-sizing (adversarial finding — load-bearing)

An adversarial pass parsed all 53 `multitoggle` definitions in `settings-defs.ts`:

```text
states  count   note
------  -----   -----------------------------------------
  2       1     radonsettings only — the sole toggle-collision
  3      41     the "X Off / X On / X Variant" norm
  4      10
  5       1
```

So the literal "2-state cycle ≡ toggle" collision is **1 control out of 569**, and
`action`(teal)/`infoclick`(orange) are **already off the red/green palette**. This evidence
deliberately bounds the design: the fix is **additive per-kind affordances on the native palette**,
**not** a wholesale repaint or a component-rendering layer. The broader win is making *every* cycle
obviously a cycle (position + kind) and giving the taxonomy a consistent, colorblind-safe signal —
not chasing a systemic collision that does not exist.

---

## 🥅 Goal (the #39 MUSTs)

- Every control's **kind** (toggle / cycle / action) is **obvious** from how it looks.
- Every stateful control **clearly shows its current state** (not just its label).
- Actions **read as actions** — no persistent-state affordance.
- Legible in grayscale (colorblind-safe) **without** abandoning native styling.

---

## 🎨 The design — leading-glyph taxonomy, additive over the native palette

Every control gains a **leading glyph that announces its kind**; stateful controls show state
**redundantly** (glyph for toggles, position counter for cycles) so kind + state survive with hue
removed. **The native `settingBtn` background palette is kept everywhere** — the glyphs are accents,
not overrides, so the fork keeps inheriting native color (and any future native restyle) for free.

```text
kind                 leading glyph        background (kept native)   state carried by
-------------------  -------------------  -------------------------  --------------------------
toggle (boolean)     ✓ on  /  ✗ off       red (off) / green (on)     glyph + native color
cycle (multitoggle)  ⟳ + trailing (n/N)   settingBtn{value} ramp     glyph + counter + label
action (action)      ▶                    teal                       none (absence = the signal)
action (infoclick)   ⇄                    orange                     none
```

### Per-kind treatment

**Toggle (`boolean`)** — keep native red/green background and the constant label. Prepend a state
glyph: `✓` when enabled, `✗` when disabled. The glyph gives a grayscale-legible state cue without
repainting; the constant label (vs a cycle's changing label) is itself a toggle tell.
Example — `AutoPortal`: `✗ AutoPortal` (red) ⇄ `✓ AutoPortal` (green).

**Cycle (`multitoggle`)** — keep the native `settingBtn{value}` color ramp. Prepend a `⟳` kind
glyph and append an `(n/N)` position counter (`n = value+1`, `N = name.length`), around the existing
current-option label. The `⟳` + counter make it unmistakably a multi-step control at a known
position — no longer confusable with a toggle, and state 0 no longer reads as "off."
Example — `ManualGather2` (4 states):

```text
⟳ Manual Gather/Build   (1/4)      ⟳ Mining/Building Only  (3/4)
⟳ Auto Gather/Build     (2/4)      ⟳ Science Research OFF  (4/4)
```

**Action (`action` / `infoclick`)** — keep native teal / orange. Prepend a kind glyph: `▶` for
`action` (fires immediately), `⇄` for `infoclick` (opens the import/export dialog). No state cue —
the *absence* of one is the signal that these hold no state. Move `infoclick`'s inline
`background-color:#d88839` (settings-engine.ts:133) into a CSS class so all styling is declarative.

### Glyphs

Prefer the **bundled icomoon font** (already used at `settings-engine.ts:320` — `icon-infinity`);
exact icon class names to be confirmed against `../trimps-game/fonts/icomoon/style.css` during
implementation, with Unicode (`✓ ✗ ⟳ ▶ ⇄`) as the fallback. The glyph is a stable leading `<span>`,
never re-created on the hot path (see Rendering).

### Colorblind rationale

Booleans lean on **glyph (`✓/✗`)** as a hue-independent state cue; cycles on **`⟳` + textual
`(n/N)` counter**; actions on **shape/glyph + absence of state**. No kind or state depends on
resolving red-vs-green. Native color is retained as redundant reinforcement — strictly additive, so
sighted veterans keep the red=off/green=on convention they already read fluently.

---

## 🔭 Scope

**In scope:** the 3 ambiguous kinds — `boolean`, `multitoggle`, `action`/`infoclick`.

**Seam only (no visual change):** `value` / `valueNegative` / `multiValue` / `textValue` / `dropdown`
get a no-op `settingKind-input` / `settingKind-select` marker class so #41 layout work has a kind
hook on every control at near-zero cost.

**Non-goals:**
- Layout / grid / spacing changes — that is #41. Every control stays inside the existing
  `13.142vw` cell (`settings-engine.ts:19`), width unchanged.
- Restyling `value`/`text` (blue `btn-info`, already distinct) or `dropdown` (native `<select>`).
- Changing click semantics — `settingChanged`'s flip / cycle-mod-length / dropdown logic and the
  `AutoMagmiteSpender2` special case are preserved exactly.

---

## 🛠️ Implementation approach

All changes live in `src/modules/settings-engine.ts` + a small block in AT-owned `tabs.css`.

### Single render path (prevents drift)

Today `createSetting` (render) and `settingChanged` (repaint) **duplicate** the class + label logic
(`:33`/`:149` vs `:197`/`:209–210`) — the exact seam where output can drift. Introduce one shared
helper, `renderControlFace(id)`, that composes the glyph + label + counter for a control from its
`autoTrimpSettings[id]` record, and route **both** paths through it.

### Cached-child mutation (CLAUDE.md `replaceChildren` + click gotcha)

The control face is composed of stable child spans built **once at mount** — a leading
`.settingGlyph` span, the label text node, and (cycles) a trailing `.settingCount` span. On state
change, mutate `textContent` of those cached spans; never `innerHTML`-rebuild the clickable node on
the hot path (a rebuild mid mousedown→mouseup swallows the click).

### The class-clobber fix

`settingChanged` at `:197` and `:209` currently rewrite the full `class` string, which would clobber
a stable `settingKind-*` class. Switch those to a `classList` swap of only the `settingBtn{state}`
token (or re-add the kind class), preserving the kind marker across clicks. This is the only
behavioral edit and is a pure improvement.

### Per-branch changes in `createSetting`

- **boolean** (`:23–40`): add `settingKind-toggle` to the class; render `✓/✗` glyph + label via the
  helper.
- **multitoggle** (`:139–156`): add `settingKind-cycle`; render `⟳` glyph + label + `(n/N)` counter.
- **action** (`:157–167`) / **infoclick** (`:128–138`): add `settingKind-action`; render `▶`/`⇄`
  glyph + label; drop the inline orange in favour of a `.settingKind-info` CSS rule.
- **value/text/dropdown**: add the no-op marker class only.

### CSS (`tabs.css`, small, no palette override)

Glyph spacing + the marker classes + the `infoclick` orange rule. **No `settingBtn*` color
overrides** — the native palette is kept. ~20–30 lines, keyed off the kind classes, scaling to all
~230 controls with zero per-control CSS.

---

## 🧪 Testing

The #46 characterization net is the safety harness. This is an **intentional behavior change**, so:

- **`tests/settings-engine.test.ts`** — the assertions on `createSetting` / `settingChanged`
  rendered `class` / `textContent` will change (they now include the glyph + counter). Update them
  to pin the **new** output — the reviewed, intentional diff the net was built to make legible.
  Add cases: toggle glyph flips `✓`↔`✗`; cycle counter renders `(n/N)` and advances/wraps; action
  glyph present with no state cue; the `settingKind-*` class survives a click.
- **`tests/settings-inventory.test.ts`** — unaffected (records `createSetting` *arguments*, not
  rendered DOM). Must stay green (569, zero-dup, catalog) — proof the taxonomy change touched
  rendering only, not the control catalog.
- **`src-bundle-parity` byte-golden** — regenerate via `node scripts/regen-src-golden.mjs`; review
  the diff as a pure render-logic change before committing.
- **Live verify in Chrome** (`npm run serve` → `:8080`): confirm each kind renders its glyph, cycles
  show + advance the counter, toggles flip the glyph, actions fire, and a clean console. Click-test
  each new-rendering kind (per CLAUDE.md "click-test every new interactive control").

---

## 🚫 Rejected alternatives (from the design duel)

- **Purpose-built component system** (sliding-switch / stepper / raised-button, rendered off the
  existing class token). Elegant — `settingChanged` need not change — but AT would **own control
  rendering forever**, diverging from native, adding 13vw pressure and bleeding into #41's layout.
  Over-invest for a 1-in-569 collision.
- **Repainting booleans** (gray-OFF, new palette). Breaks veteran red=off/green=on muscle memory
  across 156 controls. The `✓/✗` glyph delivers the colorblind redundancy without the repaint.
- **Pip rails / segment strips** for cycle position. The `(n/N)` counter carries position more
  cheaply in a cramped cell; pips are backlog polish.

**Reversible sub-choice recorded:** glyph-only toggles were chosen over the sliding-pill switch. If
a richer toggle affordance is wanted later, the pill is a self-contained follow-up (backlog).

---

## ⚠️ Risks

- **13vw crowding** — cycle glyph + label + `(n/N)` in a narrow cell. Mitigation: `text-overflow:
  ellipsis` on the label (the full option list is already in the hover tooltip, `:151`); the counter
  is 3–5 chars. If a control genuinely can't fit, that's evidence for #41, not #39.
- **Glyph rendering** — Unicode arrows (`⟳ ⇄`) can render inconsistently across platforms; prefer
  bundled icomoon, verified at implementation.
- **Byte-golden churn** — expected and desired; the reviewed diff is the point of landing #46 first.
