# Code Review v2 — Findings

**Date:** 2026-07-12 · **Status:** COMPLETE (review only — no code was changed this session)
**Design:** [`2026-07-12-code-review-v2-design.md`](2026-07-12-code-review-v2-design.md)
**Quality plan:** [`2026-07-12-code-review-v2-quality-plan.md`](2026-07-12-code-review-v2-quality-plan.md)
**Tracker:** [Milestone #9 — Phase 5 — Code Review v2](https://github.com/MattAltermatt/AutoTrimps/milestone/9) · issues **#67–#87**

## Fix order — read this first

The issues are numbered in the order they should be worked. That order is load-bearing, not cosmetic.

| # | issue | why here |
|---|-------|----------|
| **#67** | 🚧 **CI: the proof net has never run in the deploy gate** | **BLOCKER.** Everything below ships behind a net that is not executing. An agent injected a real regression into `jobs.ts`, ran the exact CI sequence clone-less, and watched it land in `dist/` **green**. Also: adding `npm run lint` alone is a **no-op gate** — oxlint currently exits 0 with 1,999 warnings and 0 errors. Both halves must be fixed or neither means anything. |
| #68–#74 | 🕸️ **The systemic classes**, each with a permanent net | A net closes a *class* forever; a fix closes one *instance*. #70 is the bug all 45 finder agents missed and a ten-minute net caught. |
| #75–#76 | 🔐 Security — remote third-party JS; `eval()` on pasted text | Ship-blocking for a userscript that runs in page context with the user's save. |
| #77–#79 | 💥 Crashes | Each is amplified by #87 into a permanent cascading outage. |
| #80–#83 | 🐛 Logic defects | |
| **#84** | 🎚️ **Parity drift — FILE ONLY** | Numeric. **Do not fix without the maintainer's explicit approval.** |
| #85–#86 | 🧹 Dead code · 📐 quality plan | |
| **#87** | 🏛️ **mainLoop error boundary — LAST, on its own** | It changes emitted JS and moves the L0 traces. A *behavioral* change, reviewed as one — never bundled with mechanism fixes. |

**#32 and #58 were both closed prematurely** and are re-opened in substance by #79 and #68 respectively: #32
closed as "FULLY COMPLETE" while `portal.ts:238` and `mapfunctions-amp.ts:463` still carry live
`ReferenceError`s marked `@ts-expect-error #32 latent`; #58 fixed two phantom settings while 26 more remained —
including `RCapEquiparm`, phantom *inside the very function #58's comment declares repaired*.

## The number, stated honestly

**~91 distinct product defects.** Not 116.

The verification gauntlet returned 116 "confirmed" findings. A post-mortem naysayer collapsed them: 14 groups
are one root cause reported at multiple call sites, and 8 are gaps in the review's *own* instrumentation and CI
rather than bugs in AutoTrimps. **116 findings = 96 distinct root causes = ~91 distinct product defects.** The
inflation is ~17%.

That correction matters more than it looks. An inflated count is the fastest way to get a real finding
dismissed, and there are findings in here that must not be dismissed.

## How much of this is trustworthy

| stage | result |
|-------|--------|
| finders (45 agents, 38 targets + 6 nets) | 189 raw findings |
| skeptics (297 votes, 3 lenses per HIGH) | 282 REAL / 15 REFUTED — **95% pass rate** |
| reproduction (mandatory positive control) | 116 REPRODUCED / 4 refuted-by-repro |
| **lead's own audit** | sampled + independently re-derived: **held** |
| **post-mortem naysayer's audit** | sampled 13 product findings at random: **broke 0** |

**Two independent audits could not break a single sampled finding.** The 91% survival rate is not
rubber-stamping — the codebase really is this bad. That is the conclusion the evidence forces, and it was
tested rather than assumed.

### The methodological finding: the skeptic layer was decorative

**Four of the twelve kills came from findings the skeptics had passed *unanimously*** — including a 3/3 REAL
that the reproduction stage then killed with a decisive argument no skeptic had produced (`buildings.ts:340`:
Barn/Shed/Forge are `percent: true` with *cost functions*, and `getBuildingItemPrice` takes the
`typeof thisCost === 'function'` branch, which ignores `purchaseAmt` entirely — so the bare-`canAffordBuilding`
hazard does not apply to them).

297 skeptic votes changed almost nothing. **The reproductions did all the work.** For a review of this shape,
the lesson is: skip the debate layer and go straight to *make it fail*. Argument, even adversarial argument, is
weaker than execution.

### The structural finding: readers where nets belonged

The review named `never-written`, `dispatch-hole`, and `phantom-setting` as bug classes and instantiated them
**32 times** — then closed them with **45 reading agents instead of a handful of exhaustive mechanical nets.**
So it missed instances of the very classes it had named. The post-mortem wrote three nets in about ten minutes
and immediately found two defects the whole 45-agent sweep had missed (below).

**Nets are exhaustive; readers are not.** Where a class can be mechanized, mechanize it.

---

## A0 · ARCHITECTURAL — the mainLoop has no error boundary

```
$ grep -n "try {\|catch" legacy/AutoTrimps2.js
(no matches)
```
`mainLoop` is a bare `setInterval(mainLoop, runInterval)` (`AutoTrimps2.js:93`) invoking ~30 automation
functions in a fixed tick order, with **no `try`/`catch` anywhere**. A throw in any one of them silently skips
**every function ordered after it** — and `setInterval` re-invokes a throwing callback, so it repeats every
tick, forever, with nothing surfaced to the user.

This **reframes the severity of every throw-class bug below.** Each is not a local crash; it is a silent,
permanent, cascading outage of everything downstream of it in tick order.

Fix is two independent pieces: guard the throw sites, **and** give the loop an error boundary. ⚠️ The boundary
changes emitted JS and moves the L0 traces — it is a *behavioral* change and must be reviewed as one.

---

## The systemic classes — fix the class, not the instance

These are the highest-leverage items. Each is one root cause with many victims, and each is closable by a
**permanent mechanical net** (test-only, byte-identical, cheap).

### S1 · 28 phantom settings — `getPageSetting(id)` for an id never `createSetting`'d
`utils.ts:57` returns `false` for unknown keys, so every one is a permanently-dead guard. 571 defined, 519
read, **28 phantom**. The existing net only checks define→read; **the reverse direction has no net.** (This is
issue **#58**'s class, still open.)

Worst instances: `'RCapEquiparm'` (8 sites — `other.ts:227`'s `RbuyArms()` gates every armor purchase on
`level < false` → `level < 0` → **never buys armor**); `'DailyBWraid'` (a *case* typo, four lines below a
correct `'Dailybwraid'`); `'game.global.universe == 1 && BWraid'` (an entire guard **expression** pasted inside
the id string); `'Dailyportal'` (`portal.ts:307` → `false + 1` = **1**); `'fuckanti'` (half the trimpcide
trigger); the 9-id `nu-loom` subsystem (wholly inert); `'dloomswap'`/`'loomswap'` (heirloom shield-swap dead
**and** four rendered controls permanently hidden).

> ⚠️ **Do NOT fix these by defining the missing settings.** `MaxTox`'s phantom is *accidentally protective* —
> defining it un-suppresses a `settingChanged()` on a control that does not exist, and throws. Each of the 28
> needs its own disposition: **typo → correct the id; never-built feature → delete the dead code.**

### S2 · ~34 boolean settings declared with a STRING default
```ts
createSetting('fullice', 'Ice Calc', '…', 'boolean', 'false', null, 'Combat');   // <-- the STRING 'false'
```
`settings-engine.ts:68` does `enabled: (defaultValue || false)` and stores the string. `'false'` is **truthy**.
So the behavior depends on *how each reader tests it*:
- `if (getPageSetting(x))` → **true** (a setting documented as default-OFF is effectively ON)
- `getPageSetting(x) == true` → **false** (`'false' == true`)
- `getPageSetting(x) == false` → **false** (`'false' == false` is `false` in JS — the guard *never fires*)

`grep "'boolean', 'false'" src/modules/settings-defs.ts` → **~34 settings**, against 91 that correctly use the
boolean. Confirmed instances include `addpoison`, `fullice`, `AutoGigas` (`'true'`), `RBuyBuildingsNew`
(`'true'`). Each needs its readers checked — the outcome differs per reader.

### S3 · Cross-module state that is READ but never WRITTEN
The `.d.ts` declares it, so `tsc` is green; the code throws or silently reads `undefined` at runtime.
- `storedMODULES` (`at-legacy.d.ts:474`) — read at `import-export.ts:915`, **assigned nowhere** → `ReferenceError`
- `Rdshouldtributefarm` (`at-legacy.d.ts:209`) — read at `heirlooms.ts:586/589`, **assigned nowhere**
- **`MODULES["maps"].enoughDamageCutoff` / `.RenoughDamageCutoff`** — see the headline miss below

### S4 · The test suite hand-injects state that production never sets
**Three confirmed instances of the #66 pattern, in tests written *after* #66:**
- `tests/other.rarmormagic.test.ts:19` — `MODULES = { maps: { RenoughDamageCutoff: 1 } }`
- `tests/equipment.characterization.test.ts:800-826` — hand-builds `autoTrimpSettings` containing **phantom ids**
- `tests/equipment.characterization.test.ts:796/815/833` — three tests pass verbatim if `autoLevelEquipment()`
  is replaced by an **empty function**

A test that manufactures the field production never sets does not merely fail to catch the bug — **it certifies
the dead branch as working.**

---

## THE HEADLINE MISS — found by the post-mortem, missed by all 45 finders

### `MODULES["maps"].enoughDamageCutoff` is never written → Armor Magic option 2 is dead, in four settings, in both universes
```ts
// other.ts:182  (armormagic, U1)
… (getPageSetting('carmormagic') == 2 || getPageSetting('darmormagic') == 2)
    && calcHDratio() >= MODULES["maps"].enoughDamageCutoff && …     // <-- undefined
// other.ts:239  (Rarmormagic, U2)
… && RcalcHDratio() >= MODULES["maps"].RenoughDamageCutoff && …     // <-- undefined
```
`grep -rn enoughDamageCutoff src/ legacy/` → these two reads and nothing else. The 24 fields ever assigned on
`MODULES.maps` (`maps.ts:17-101`) contain **neither name**. `n >= undefined` is **always false**.

The settings are real, user-facing multitoggles — `['C2 Armor Magic Off', 'CAM: Above 80%', 'CAM: H:D',
'CAM: Always']` — dispatched every tick from `AutoTrimps2.js:249` and `:358`. **Selecting "CAM: H:D" makes the
entire death-prevention feature a no-op.**

And `tests/other.rarmormagic.test.ts:19` hand-injects the field, so the suite is green while certifying it works.

### `advExtraMapLevelselect` is not an element that exists
`maps.ts:139` — `byId<HTMLSelectElement>("advExtraMapLevelselect"); if (!m) return;`
`grep -rn advExtraMapLevelselect ../trimps-game` → **zero hits.** The game's element is **`advExtraLevelSelect`**
(`main.js:6135`). Every player past z209 with `AdvMapSpecialModifier` on gets a silent `return` and no extra map
levels, forever.

---

## Selected HIGH defects (full list in the issue tracker)

| where | what |
|-------|------|
| `ab.ts:111`, `:128` | `equips[0][1]` with no length guard → `TypeError` → **all U2 automation below the AB block dies every tick** (A0). Reachable from the game's own post-`resetAll()` state on first SA unlock. |
| `import-export.ts:915` | `setTimeout((function(){…})(a), 101)` — IIFE invoked immediately, then `ReferenceError` on `storedMODULES`, **between `ATrunning=false` and `ATrunning=true`**. Clicking "Reset Module Vars" kills all automation until reload. |
| `calc.ts:1254-1258` | `RcalcOurDmg` uses `+=`/`-=` on three Daily **multipliers**. The game (`main.js:12357`) and the U1 twin (`calc.ts:344`) both use `*=`. U2 daily damage prediction is silently wrong. Operator-only fix — **not** a tuning change. |
| `settings-visibility.ts:1014` | an **empty** `settingsProfileMakeGUI() { }` shadows the real 36-line implementation (`import-export.ts:8`) via the bridge's spread order → the Settings-Profile feature never renders. Verified in `dist/`. Exactly **one** duplicate export name exists across 401 exports — this one. |
| `AutoTrimps2.js:211-218` | brace-scope inversion — the `else if` binds to the **outer** `if (!usingRealTimeOffline)`, so `BuyBuildingsNew == 3` ("Buy Storage") runs **only during the offline replay, never in live play**. A grep-based net reports this GREEN. |
| `portal.ts:238`, `mapfunctions-amp.ts:463` | bare `loom` / `recyle` — **hard `ReferenceError`s**, mislabeled as "#32 latent". **#32 was closed as "FULLY COMPLETE" with these live.** The drain closed on the *markers*, not the *bugs*. |
| `perks.ts:23` | `if (game.global.universe == 1)` spans lines 23–749, wrapping **all** AutoPerks methods. `universe` is reassigned live and the game never reloads → load in U2, portal to U1, and `AutoPerks` is `{}`. |
| `Graphs.js:310` | `saveSetting("darkTheme", !dark)` — literally inverted. |
| `perks.ts:21` + `Graphs.js:177` | the shipped userscript remote-loads third-party JS from two unpinned origins, no SRI. `build-userscript.test.ts` guards the **wrong domain**. |
| CI | **the proof net has never run in the deploy gate** — `describe.skip` when the clone is absent, and it is always absent on runners. `baseline-zero.test.ts` ("THE KEYSTONE") has never gated a deploy. `lint` is not in CI at all. |

## Reporting defects in this review, disclosed

- **`Rdshouldtributefarm` (findings 66/116) is titled wrong.** The title says "read but never written — the
  branch is dead." Its own evidence says otherwise and is correct: the bundle is strict, so it is a
  **`ReferenceError`** — `Rdheirloomswap()` *throws*, and per A0 that is a per-tick outage for any U2 Daily
  player with `Rdhs`=1. **A reader who fixes to the title ships the wrong fix.**
- The 4 harness-blind findings (instrument gaps, not product bugs) were counted inside the "116 reproduced"
  tally, overstating what was reproduced.

## The nets this review should leave behind

Findings are one-time. Nets are forever. All are test-only and therefore byte-identical.

1. **Reverse settings net** — every `getPageSetting('<literal>')` must have a `createSetting`. Closes S1. Needs
   an allowlist for ~10 dynamic-key concat heads and a shrinking `KNOWN_PHANTOM` baseline.
2. **Boolean-default net** — no `createSetting(…, 'boolean', '<string>')`. Closes S2. One line.
3. **Ambient-writer net** — every `var X` in `at-legacy.d.ts` must have ≥1 runtime assignment. Closes S3.
4. **`MODULES.<ns>.<field>` read-vs-write net** — every field read must be written somewhere. **This is the net
   that found the headline miss.** Ten minutes to write; exhaustive where 45 readers were not.
5. **Bridge-collision net** — no two bridged modules may export the same name. Closes the `settingsProfileMakeGUI`
   class. ~20 lines.
6. **DOM-id net** — every `byId("…")` literal must exist in the game clone. Closes the `advExtraMapLevelselect`
   class.
7. **CI honesty** — the clone's absence must be a **hard failure**, not a silent `describe.skip`; and `lint` must
   be in the deploy gate. **Do this first.** Until it lands, every other net is decorative.
