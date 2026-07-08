# SettingsGUI.js Decomposition — Design Spec

**Issue:** #20 (Phase UI — SettingsGUI breakup) · **Date:** 2026-07-08 · **Branch:** `feature/phase-ui-settings-breakup`

## 🎯 Goal

Break up the 253 KB / 2620-line `legacy/SettingsGUI.js` monolith into typed `src/modules/*.ts`
modules, using the same faithful strangler idiom that landed all 26 Phase-2 conversions —
**byte-for-byte behavior parity, zero gameplay change.**

## ✅ Decision: faithful decomposition by responsibility (role-split)

Chosen over three alternatives after a dueling-agent analysis (faithful advocate / declarative
advocate / adversarial falsifier). Rationale:

- **Per-category split — rejected.** `container` ≠ logical category: U1/U2 ("R"-prefixed) twin
  settings share a tab; visibility is decided at runtime by `updateCustomButtons`'s `radonon`
  flag, not by container; layout is pinned by imperative `insertAdjacentHTML('afterend','<br>')`
  calls keyed to specific earlier element ids (`dlowdmg` receives two). A per-category file split
  cannot cleanly separate defs, twins, layout, or the cross-cutting reactive layer.
- **Declarative rewrite (SettingDef[] + generic renderer) — deferred to BACKLOG.** No gameplay
  payoff, first-of-its-kind architecture in this repo, and it rewrites the persistence-critical
  define pass + ordering-sensitive layout + inline-handler wiring simultaneously — against a suite
  with **zero runtime coverage**. "Modernize the settings UX" in #20 is an aspiration, not a
  committed destination; per the no-stopgaps rule, unknown-answer render models are probed as a
  separate research slice, not committed as a blind 570-setting rewrite. Role-split's module seams
  (defs / engine / visibility) are exactly what a future declarative pass would reuse, so choosing
  role-split now is `A→(A+1)` reuse, **not** an `A→B` stopgap.
- **Single-module relocation — rejected.** Moving the file to one 2620-line `settings-gui.ts`
  banks the typing win but does not satisfy #20's "break up the monolith" mandate.

## 🧱 Module layout

Five new/changed files. Line ranges refer to current `legacy/SettingsGUI.js`.

```text
src/modules/
  settings-engine.ts     PURE (bridged)  createSetting + createInput + settingChanged +
                                         autoSetValueToolTip/autoSetTextToolTip + autoSetValue/
                                         autoSetText + onKeyPressSetting + parseNum + tooltip helpers
                                         (1226–1594)
  settings-menu.ts       PURE (bridged)  modifyParentNode, createTabs, createTabContents, toggleTab,
                                         minimizeAllTabs, maximizeAllTabs, initializeAllTabs,
                                         automationMenuInit, automationMenuSettingsInit, autoToggle,
                                         autoPlusSettingsMenu, toggleAutoMaps + tab DOM refs
                                         (addTabsDiv/addtabsUL via globalThis) + tabs.css <link> inject
                                         (1–125, 199–269, 1550–1594, 2602)
  settings-defs.ts       PURE (bridged)  initializeAllSettings — the 570 createSetting calls IN EXACT
                                         ORDER, including interleaved <br> layout calls (270–1225)
  settings-visibility.ts PURE (bridged)  updateCustomButtons, checkPortalSettings, getDailyHeHrStats,
                                         getDailyRnHrStats, settingsProfileMakeGUI stub (1596–2601)
  settings-boot.ts       SIDE-EFFECT     runs the four load-time self-invocations in strict order,
                                         imported LAST in main.ts (see load-order plan)

src/modules/heirlooms.ts   (existing)    GAINS nuloom (moved from SettingsGUI :126 — it is combat
                                         logic already called only from heirlooms.ts)
```

Splitting the 570 defs *within* `settings-defs.ts` per category is **not** done — order is preserved
verbatim in one file to protect the define-pass persistence contract (below).

## 🔌 Load-order & seam plan

Current concat order: `AutoTrimps2.js` → `src/main.ts` IIFE → `SettingsGUI.js` → `Graphs.js`.
SettingsGUI's four self-invocations (`automationMenuInit`, `automationMenuSettingsInit`,
`initializeAllTabs`, `initializeAllSettings`) currently run at that tail slot.

Plan:
1. `settings-engine`, `settings-menu`, `settings-defs`, `settings-visibility` are pure-export modules
   added to `src/legacy-bridge.ts`'s spread (like `portal`/`maps`/etc.). Order within the
   `Object.assign` is irrelevant (no self-invokes).
2. `settings-boot.ts` is a side-effect module imported **last** in `src/main.ts` (after the bridge
   and after `perks`/`fight-info`/`performance`). It calls, in strict order:
   `automationMenuInit(); automationMenuSettingsInit(); initializeAllTabs(); initializeAllSettings();`
   — centralizing the "menu before defs" ordering contract in one obvious place. This runs at
   essentially the same point as the old tail slot (main.ts is the last thing before the removed
   SettingsGUI slot), so DOM-readiness timing is preserved.
3. `SettingsGUI.js` is removed from `MANIFEST` in `scripts/build-userscript.mjs` (manifest becomes
   `['AutoTrimps2.js', 'Graphs.js']`).
4. Cross-module callers that reach in by bare name — `import-export.ts:890` (resetAutoTrimps),
   `portal.ts:74` (`settingChanged`), `AutoTrimps2.js:370` (every-tick `updateCustomButtons`) —
   keep working because every function is exported and republished onto `globalThis` by the bridge.

## 🔒 Parity contract (MUST preserve — verified against the persistence layer)

1. **Define-pass completeness + order.** All 570 `createSetting` calls must remain, with identical
   `(id, name, description, type, defaultValue, list, container)` args, in the same order. The
   bare→typed rehydration of a loaded flat blob happens *inside* `createSetting`; a dropped/renamed/
   reordered def leaves the key as a bare primitive → `getPageSetting` returns `undefined` → the
   setting silently dies (CI cannot detect this).
2. **Every inline-handler function is exported.** Enumerate all functions referenced from inline
   `onclick=`/`onchange=`/`onmouseover=`/`onmouseout=`/`onkeypress=` attribute strings AND `action`/
   `infoclick`-type code strings (e.g. `MODULES["performance"].EnableAFKMode()`, `printChangelog()`),
   and confirm each is on `globalThis` post-build. A miss = dead button, invisible to CI.
3. **Dropdown `.list` re-attach + `PrestigeBackup` special-case.** `.list` is not persisted; it is
   re-attached only from the `createSetting` `list` arg. `PrestigeBackup` is a typeless nested object
   written by `settingChanged`. Both must be preserved verbatim.
4. **`ATversion` stamp** on every `createSetting` call (gates `loadPageVariables`).
5. **Layout `<br>` calls + float overrides** (`insertAdjacentHTML('afterend','<br>')` keyed to element
   ids; `PauseScript`/`radonsettings` float tweaks) stay adjacent to their neighbors.
6. **Self-invocations stay at the tail** and in order (menu → defs); `updateCustomButtons` stays cheap
   (runs every tick).
7. **`serializeSettings`/`getPageSetting`/`setPageSetting` in `utils.ts` are NOT changed.**

## 🧪 Verification plan

- **Static:** extend `tests/build-userscript.test.ts` to assert `SettingsGUI.js` is gone from the
  build output and `settings-boot` appears after the bridge; `npm run typecheck` + `npm run lint`.
- **Settings-count parity:** `Object.keys(autoTrimpSettings).length` identical pre/post.
- **DOM snapshot:** `document.getElementById('autoSettings').outerHTML` byte-identical on fresh load.
- **Handler reachability:** assert every enumerated inline-handler name is `typeof globalThis[x] === 'function'`.
- **Reactive diff:** run `updateCustomButtons()` for fixed fixtures (radon on/off, each AutoPortal
  variant) and diff the toggled-visible element set pre/post.
- **Chrome live-verify (load-bearing — CI is blind):** against the local Trimps 5.10.1 clone
  (`npm run build && npm run serve` → localhost:8080), click-test the inline-onclick-only paths
  (`settingChanged`, `autoSetValueToolTip`→`autoSetValue`, `toggleTab`, min/maximizeAllTabs,
  `toggleAutoMaps`), exercise a settings reset (`resetAutoTrimps`), and soak through a portal cycle.

## 🚫 Out of scope (→ BACKLOG)

- **Declarative SettingDef[] + generic renderer** (settings UX modernization). Future dedicated phase;
  builds on the module seams established here.
- **`updateCustomButtons` internal simplification** (605 flat ternaries → data-driven `visibleWhen`).
- **Graphs theme-change side effect** stapled to the top of `updateCustomButtons` (orthogonal extract).
- Fixing the dead `valueNegative` branch at `createSetting` :1268 (faithful port preserves it; note for
  a later cleanup).

## 📏 Effort

**M** — mechanically identical to the 26 shipped conversions applied to ~4× a typical module, with two
new risk surfaces: (a) two ordered self-invoking side-effect paths (centralized in `settings-boot.ts`),
and (b) the 966-line every-tick `updateCustomButtons` where a single mis-relocated `turnOn/turnOff` is
invisible without Chrome soak. Precedent (maps/mapfunctions, calc/stance ordering) shows this shape is
solved.
