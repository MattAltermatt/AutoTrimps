# AutoTrimps — Track 2 (Quality) Refactor Plan

**Ranking principle:** `(bug-prevention + maintenance payoff) / (risk to the proof net)`. Test-only and type-only work first (invisible to the net by construction), then verified relocations, then behavioral fixes (expensive, gated, last).

**One structural fact governs this whole plan:** the L0 action-trace net observes only `buyJob / buyBuilding / buyUpgrade / buyEquipment` (`scripts/sim/coverage.mjs:14`; `tests/sim/corpus-coverage.test.ts:34` pins `uncovered = ['runMap','selectMap','setFormation','recycleMap']`). It is **blind** to map selection, UI visibility, heirloom carry, and every praid/AMP decision. A green ∅ diff on those paths proves the net cannot see the change — not that the change is safe. That is the #66 trap, and half the items below sit inside it.

---

## Theme 1 — Build the missing net first (do this before anything else)

The single highest-leverage item in the report. Everything in Theme 4 lands *against* it.

### 1.1 — Reverse settings net: every `getPageSetting('<literal>')` must have a `createSetting` — **S** · test-only · byte-identical
- **What:** Add a permanent vitest net beside the existing forward net. `tests/settings-wired.test.ts:56-63` computes `ids.filter(id => !readSomewhere(id))` — **created → read only**. Nothing asserts read → created.
- **Where:** `tests/settings-wired.test.ts` (new `it()` block).
- **Why it matters — concrete:** `src/modules/utils.ts:57-58` returns `false` for any id failing `hasOwnProperty`. A typo'd id therefore *silently disables a feature*. Verified live offenders today: `equipment.ts:667-668` (`RCapEquiparm` / `RCapEquip2`), `other.ts:227` (`RCapEquiparm` — makes `RbuyArms()` buy **nothing**), `other.ts:308` (`Rgearamounttobuy`), `maps.ts:1004/1016/1017` (`Ronlystackedvoids`, `Rnovmsc2`), `equipment.ts:676` (`Ralways2`), `settings-visibility.ts:155-157` (`dloomswap`), `heirlooms.ts:363/372/607` (9 `*nu` ids), `upgrades.ts:105` (`dMaxMapBonushealth`), `portal.ts:73` (`MaxTox`), `buildings.ts:110/174`, `legacy/AutoTrimps2.js:233/272/273`. This is exactly issue #58's class, shipped twice already.
- **How it survives the net:** `tests/` is not in the userscript bundle (`scripts/build-userscript.mjs` concats `legacy/` + `esbuild(src/main.ts)`). Zero emitted-JS change → src-bundle byte-golden and L0 traces untouched by construction.
- **Required shape (a naked net FAILS on `main` today — ~30 offenders):**
  1. Allowlist the ~10 **dynamic-key concat heads** (`nature.ts:17` `'Auto'+nature`; `buildings.ts:118/168` `'Max'+b`; bare `'R'`/`'Max'`/`'RMax'`).
  2. A `KNOWN_PHANTOM` baseline listing the genuine offenders, which Theme 4 deletes one at a time.
  3. Mirror the existing "allowlist stays honest" assertion (`tests/settings-wired.test.ts:65`) so a fixed phantom cannot rot in the baseline.
- **Hazard note to carry in the file:** `MaxTox`'s phantom is *accidentally protective* — defining it un-suppresses a `settingChanged()` call on a control that does not exist. A naive "define all the missing settings" sweep would throw. The net must **report**, not auto-define.

### 1.2 — `SettingId` union type on `getPageSetting` — **M** · type-only · byte-identical
- **What:** Codegen `type SettingId = 'AutoMaps' | …` (571 ids) into a generated `.d.ts`; retype `getPageSetting(setting: SettingId)` at `src/modules/utils.ts:57`.
- **Why it matters:** Makes 1.1's runtime check a **compile-time** check, and additionally covers the ~14 variable-held ids the regex net cannot see (`other.ts:533-538` shrineSettings table; `other-praiding.ts:1210-1212/1224-1225/1364/1410-1415` `praidSetting`/`bwraidZ`/`bwraidMax` — all literal-sourced, so `SettingId`-typed fields satisfy them).
- **How it survives the net:** Type aliases and parameter annotations are **fully erased by esbuild**. Emitted JS unchanged.
- **Two hard constraints:**
  - ❌ **Do NOT add a runtime `getPageSettingDyn` alias.** `const getPageSettingDyn = getPageSetting as …` emits a new statement and renames ~14 call sites → trips the bundle golden. Use `getPageSetting(x as SettingId)` at the concat sites instead.
  - ❌ **Do NOT tighten the RETURN type.** The loose `==` / `!=` comparisons against the polymorphic return are **deliberate** and commented (`calc.ts:7`, `buildings.ts:22`, `upgrades.ts:14`, `magmite.ts:12`, `gather.ts:9`, `equipment.ts:13/318/357`). Narrowing cascades into `!=`→`!==` rewrites that change emitted JS.
- **Sequencing:** 1.1 first (cheap, immediate, catches all literal reads), 1.2 second (permanent, subsumes it).

---

## Theme 2 — Harness honesty: tests that pass against a no-op

Small, test-only, zero net risk. These are the #66 failure mode still living inside the tests written to prevent it.

### 2.1 — Fix the false explanation pinned in `corpus-coverage.test.ts` — **XS** · comment-only
- **What:** `tests/sim/corpus-coverage.test.ts:45-46` explains away the missing U2 `buyEquipment` with: *"the stuck flag gated a branch inside `if (universe == 1)`, and U2's gear path never read it. That invariance is itself confirmation of the mechanism."* **Both halves are false.**
- **Where:** `tests/sim/corpus-coverage.test.ts:45-47`.
- **Why it matters — concrete:** (a) `legacy/AutoTrimps2.js:285` opens `if (game.global.universe == 2) {` and `:288` inside it reads `if (!usingRealTimeOffline) { RsetScienceNeeded(); }` — U2 science was dark too; the boot fix silently re-enabled it. The pinned comment asserts a blast radius the source contradicts. (b) The *real* reason U2 shows no `buyEquipment` is `createSetting('Requipon', …, 'boolean', false, …)` (`settings-defs.ts:352`) defaulting **false**, gating `AutoTrimps2.js:348`. No fixture enables it, so `RautoEquip` is unreachable — flag or no flag. The next person auditing #66's blast radius will be misled by a *green assertion*.
- **How it survives the net:** Comment-only; nothing emits, no pins move.
- **Scope discipline:** Correct the comment **only**. Do NOT bundle a U2-`Requipon` fixture — that re-records the `04` trace, which is a gated, reviewed oracle change.

### 2.2 — Three `equipment.characterization` tests are green against an empty function — **S** · test-only
- **What:** `tests/equipment.characterization.test.ts:796`, `:815`, `:833` each call `expect(() => equipment.autoLevelEquipment()).not.toThrow()` after `for (const u of UPGRADE_NAMES) game.upgrades[u].locked = 1`. With everything locked, the only other assertion (`:797` `expect(buyUpgradeCalls).toEqual([])`) is true by construction. **`autoLevelEquipment = () => {}` passes all three.** Each test name claims to "drive" a branch nothing observes.
- **Why it matters:** In a repo whose entire safety argument *is* the test suite, an elaborate setup with a vacuous assertion is the exact shape that let #66 hide for its whole existence.
- **How to fix (the correct idiom already exists 3 lines below, at `:836-849`, using the identical lock-all-but-one setup and asserting `buyUpgradeCalls == [['Supershield', true, true]]`):**
  - Lead test: an all-locked run can never discriminate the `world % 2 === 1 && world !== 179` arm from its complement. Unlock **exactly one piece** and assert `buyUpgradeCalls` **differs** between `world=101` and `world=100`.
  - Loomswap tests: assert the swap fires/does-not-fire via the existing `selectHeirloom`/`equipHeirloom` spy idiom (`tests/heirlooms.loomSwap.test.ts:31-32`).
- **How it survives the net:** `tests/` only. No emitted JS.
- *(For contrast, the legitimate `not.toThrow` uses — `maps.characterization.test.ts:399`, `heirlooms.loomSwap.test.ts:30` — pair it with a real output assertion. Leave those alone.)*

---

## Theme 3 — Verified relocation (structural, net-verifiable, golden regen required)

⚠️ **Correction to the incoming findings:** a cross-module split is **NOT byte-identical**. `tests/src-bundle-parity.test.ts:12-15` does `expect(await bundleSrc()).toBe(golden)` on the whole bundle string. esbuild emits a new `__export({...})` block and moves function bodies → the golden **will** go red and must be regenerated via `scripts/regen-src-golden.mjs` and hand-reviewed as a **pure relocation**. That is exactly the Phase-3 giant-splits gate. Label these `net-verifiable`, never `byte-identical`.

### 3.1 — `maps.ts` → `maps-radon.ts` (711 L, zero cut-set) — **S** · net-verifiable
- **What:** Move `RupdateAutoMapsStatus` (`src/modules/maps.ts:887-941`) and `RautoMap` (`:942-1597`) verbatim into `src/modules/maps-radon.ts`. maps.ts 1597 → 886 L.
- **Why it matters (this is the *only* structural item that earns its keep):** the moved region contains **zero top-level statements** — only the two function declarations — so the new module has no eval side effect and therefore **no import-order constraint** (the same property that made `mapfunctions-amp.ts` safe, `legacy-bridge.ts:36-38`). The load-bearing 41-name `globalThis.RshouldFarm = undefined; …` placeholder at `maps.ts:14` stays in the residual half, so the *"maps imported before mapfunctions"* constraint (`legacy-bridge.ts:31-34`, guarded by `tests/build-userscript.test.ts`) is preserved bit-for-bit. Cut-set is genuinely zero in both directions. It gives the R-twin audits this project keeps running a clean file boundary to scope against.
- **Mechanics:** new module imports `{ getPageSetting, debug }` only (`setPageSetting` is used solely in the residual half); repoint `tests/maps.characterization.test.ts` imports; add the bridge import/spread; optionally repoint `at-legacy.d.ts:324` to the #36 `typeof import()` form.
- **How it survives the net:** regen golden → diff must be a **pure relocation** (new export block + moved bodies, nothing else); L0 traces + `maps.characterization` must stay green.
- **Honest value: medium.** No bug prevented, no `any` removed. Worth doing as a *batch* with 3.2 (below); **not worth doing alone.**

### 3.2 — Delete two provably-dead subgraphs — **S** · net-verifiable (∅ L0 required)
Two zero-caller clusters, both with direct precedent (Phase 3 already removed dead `dailyBWraiding` + the 20-name `Rprestraid` block; #60 removed dead `RautoLevelEquipment`).

- **(a) `RprestigeChanging2` (`src/modules/dynprestige.ts:10-46`), plus `RPrestigeValue` (`src/modules/equipment.ts:605`) if the zero-caller proof holds.** The only `prestigeChanging2` dispatch is `legacy/AutoTrimps2.js:245`, which calls the **U1** function. Beyond having no caller, `RprestigeChanging2` is unreachable *by construction*: `RDynamicPrestige2` (`dynprestige.ts:14`) is a phantom, `autoTrimpSettings.RPrestige` (`:18/:29/:36`) is a phantom, and `byId<HTMLSelectElement>('RPrestige')` (`:11`) targets a DOM node that does not exist — **calling it would null-deref instantly.**
- **(b) The heirloom auto-nullifium cluster (`heirlooms.ts` — `nuloom`/`nuRatio`/`spendNu`/`calcLoomNu`/`calcLoomNuInfinity`/`calcAutoNuRatio`, ~350 L).** `spendNu()`'s only two callers are `portal.ts:243` and `portal.ts:460` — **both inside `/* */` comments.** Nine phantom ids (`autonu`, `rationu`, `heirloomnu`, `slot1nu`..`slot6nu`) mean it has always been inert.
- **Why it matters — concrete:** these are `globalThis`-published landmines. They read as *live features*. The very next person to "helpfully wire a U2 branch" for dynamic prestige ships an instant crash; the next person to fix the nullifium spend ratio touches ~350 lines of code that has never run.
- **How it survives the net:** deleting a never-called export **cannot change runtime behavior** → L0 diff must be exactly **∅** (that ∅ is meaningful here, unlike everywhere else in this plan, because the deleted code is provably unreachable). These are `export`ed and re-exported through the bridge, so esbuild does **not** tree-shake them — the golden **will** change, and that **deletion-only diff is the deadness proof**. Any non-deletion delta aborts.
- **❌ Explicitly out of scope: "or wire it up instead."** Reviving either cluster needs new settings + new numeric defaults = **sacrosanct tuning**, and is a *feature*, not a quality refactor.
- **Before cutting:** grep-verify each shared helper (e.g. `getModUpgradeCost`) still has live callers.

---

## Theme 4 — Behavioral fixes (EXPENSIVE — each is its own branch + issue + gate)

🚨 These change emitted JS. Each one needs: its own GitHub issue, its own `feature/…` branch, a regenerated src-bundle golden, a **green ∅ L0** (with the honest caveat below), and — for the UI/heirloom/map ones — a **live Chrome verify in `../trimps-game`**, because the L0 net structurally cannot see them.

Land these **after Theme 1**, so each fix deletes an entry from the `KNOWN_PHANTOM` baseline and the net proves it.

### 4.1 — Two hard `ReferenceError`s mislabelled as "latent" — **S** each · 🔴 highest bug value in the report
The `// @ts-expect-error #32 latent … preserved byte-faithfully` comments on these are **factually wrong and dangerously reassuring**. Reading an undeclared binding throws `ReferenceError` in sloppy *and* strict mode (strict only changes *writes*). **These do not no-op. They throw, every time they are reached.** Note also that issue **#32 is CLOSED and never contained either bug** — the comments cite a dead ticket, which is exactly how they rotted.

- **(a) `loom` — AutoPortal silently fails to portal at all.** `src/modules/portal.ts:238` (and the U2 twin at `:455`). `grep -rnw loom src legacy` finds no declaration anywhere; `loom` is `heirlooms.ts:17`'s *local* loop variable, copy-pasted into the call site. The throw sits near the top of `doPortal()` (starts `:222`), so everything after is skipped: `buyPortalUpgrade('Looting_II')` (`:246-250`), `portalClicked()` (`:254`), `AutoPerks.clickAllocate()` (`:259`), `c2runner()` (`:262`), and ultimately `activatePortal()`. There is **no try/catch anywhere in `legacy/AutoTrimps2.js`** (grepped: zero matches), so it propagates out of the tick. **Reachability is high, not exotic:** the guard at `:236` is `name != getPageSetting('highdmg') || name != getPageSetting('dhighdmg')` — a `!=`-OR-`!=` against two *different* settings is a **tautology** whenever they differ, so it collapses to `if (highdmgshield() != undefined)`. **Configuring the feature is what breaks portalling.** Fix: `var loom = highdmgshield(); if (loom != undefined) … indexOf(loom)` — this *restores* legacy semantics.
- **(b) `recyle` — the daily AMP raid state machine wedges permanently.** `src/modules/mapfunctions-amp.ts:463, 470, 477, 484, 491`. The correctly-spelled `recycle` **is** computed at `:425`; the non-daily branch (`:430-455`) uses it correctly five times, the daily `else` branch uses the typo five times. `RAMPreset(true)` (`maps.ts:1183`) throws at the first `if (RdAMPrepMap1 != undefined)` — i.e. **exactly when there IS a prepped daily map** — and it throws *after* the `RdAMPpMap*`/`RdAMPmapbought*` half of the reset already ran (`:409-422`). `RdAMPrepMap1..5` are never cleared → **it can never re-prep.** A reset that throws halfway is the worst possible failure shape.
- **Net honesty:** the L0 corpus is early-game / non-daily-AMP, so an ∅ diff here is **not evidence of correctness**. Both fixes must ship with a **direct regression test** (per the proof-net spec's own "pinned by a regression test" clause): call `RAMPreset(true)` with `RdAMPrepMap1` set and assert (i) no throw, (ii) all five `RdAMPrepMap*` cleared, (iii) `recycleMap` called iff `RdAMPraidrecycle`.
- Drop the now-false `@ts-expect-error` at all seven sites — a stale one becomes a compile error, which is a free gate.

### 4.2 — `hson` should be `dhson` — one character hides four settings rows — **XS**
- `src/modules/settings-visibility.ts:219`: `radonon && hson ? turnOn('Rdhsstaff') : turnOff('Rdhsstaff');`. `var hson` is declared at `:843` in the **same function** (`updateCustomButtons`, `:9-976`), so at `:219` it is **hoisted-undefined** → the ternary is always falsy → `turnOff('Rdhsstaff')` runs **unconditionally, forever**.
- **Concrete bad outcome:** `Rdhsstaff` is a real setting (`settings-defs.ts:174`) really read by `heirlooms.ts:582/589` — and its UI row **can never be shown**. Worse than reported: because `:220` `dhsstaffon` is then always false, the three dependent rows `Rdhsworldstaff` / `Rdhsmapstaff` / `Rdhstributestaff` (`:221-223`) are **also permanently hidden**. The entire U2 daily staff-swap branch is dead. Every other line of the RD block (`:211`, `:213-215`, `:220-223`) uses the correct `dhson` (declared `:208`); `:853` is the U1 source of the copy-paste.
- **Net:** `turnOn`/`turnOff` only mutate `parentNode.style.display` (`:26-33`) — **L0 cannot see this; a null diff proves nothing.** Requires a **live Chrome verify** (U2, daily, `Rdhs` on → the row appears, then its 3 children) plus a unit test on `updateCustomButtons` asserting the row's display. Golden regen required. Fix `:219` only; `:221-223` are already correct.

### 4.3 — Phantom-gated dead branches — **M** (grouped, one issue)
Land as **one** grouped transaction after 1.1, not four separate drive-bys.
- **`dloomswap`** (`settings-visibility.ts:155-157`) → `false > 0` is false → `turnOff('dhighdmg')`/`turnOff('dlowdmg')` fire every tick. Both **are** createSetting'd (`settings-defs.ts:157-158`) and **are** live-read (`calc.ts:157/894/937`; `heirlooms.ts:20/224/238`) — permanently unreachable in the UI. ⚠️ **Corrections to the incoming finding:** it is **two** controls, not four (`highdmg`/`lowdmg` have no visibility gate at all and are always visible), and **heirloom shield-swapping is NOT broken** — the actual actuator `highDamageShield()` is called *unconditionally* one line above each cited site (`equipment.ts:356`, `maps.ts:391`, `calc.ts:888`) and is gated internally on `AutoStance==3`/`use3daily`. The residue of the phantom branches (`equipment.ts:358/360`, `maps.ts:392/394`) is a **damage under-estimate**, which is prediction math → **tuning-adjacent, do not silently re-gate.** Re-gate `:156-157` on the master its live consumers already use (`!radonon && getPageSetting('use3daily') == true`, matching `calc.ts:894`); delete `:155` (a no-op).
- **U2 consumers written, U2 setting never defined:** `Ronlystackedvoids` (`maps.ts:1004/1016/1017`), `Rnovmsc2` (`maps.ts:1016`), `Ralways2` (`equipment.ts:676`), `Rgearamounttobuy` (`other.ts:308`), `RCapEquiparm`/`RCapEquip2` (`equipment.ts:667-668`, `other.ts:227`). **This is NOT the "R-twins are structurally necessary" pattern** — that rule is about duplicated *logic*; these are missing *definitions*. It is #58's exact class (`RBuyArmorNew`), already confirmed-and-fixed once. And `settings-visibility.ts:251/346/347/394` explicitly `turnOff` the U1 controls when `radonon`, so a U2 player has **no control at all** — the "U1 twin still works" framing is wrong.
  - 🔴 **The live one:** `other.ts:227` inside `RbuyArms()` — `game.equipment.Shield.level < getPageSetting('RCapEquiparm')` → `level < false` → **always false** → **`RbuyArms` buys nothing.** #58's `81eb5171` "revival of U2 daily armor-magic" is therefore **still inert.**
- **Gates:** each new `createSetting` needs a `defaultValue`; **numeric defaults are sacrosanct tuning → user-gated ask.** A new `createSetting` also updates **BOTH** `tests/__snapshots__/settings-inventory.snap` **and** the inline `toMatchInlineSnapshot` count in `tests/settings-inventory.test.ts` — commit both or CI goes red and blocks deploy. The L0 corpus is U1-only → **U2 changes are unverifiable by the net; live U2 verify required.**

### 4.4 — Two phantom reads in `legacy/AutoTrimps2.js` (BW raiding) — **S** (one issue, both lines)
- **`:273`** literally reads `getPageSetting('game.global.universe == 1 && BWraid')` — a **whole JS expression pasted inside the id string**. No such setting exists → `false == true` → the `buyWeps()` on that line is **dead code that has never run**. Note line 273 already sits inside the `if (game.global.universe == 1) {` block opened at `:175`, so the correct fix is simply `getPageSetting('BWraid') == true` — **not** re-adding the universe check.
- **`:272`** reads `getPageSetting('DailyBWraid')`; the real createSetting is **`Dailybwraid`** (`settings-defs.ts:112`, lowercase — the id every other reader uses: `settings-visibility.ts:136-139`, `other-praiding.ts:1400`). **Concrete bad outcome:** on a Daily with `Dailybwraid` ON and `BWraid` OFF, `:269` **enters the BW raid** (setting `bwraidon`) but `:272`'s guard fails → **weapons are never bought** — the raid runs without the weapon-buying that is its entire purpose.
- **Fix both together** or the next reviewer re-finds the other.
- **Net honesty:** `BWraid`/`Dailybwraid` default **false** in every fixture, and the lines additionally require deep-zone Bionic-Wonderland state the corpus never reaches → **the L0 diff will be empty while proving nothing.** This is a `legacy/` edit, so the *src*-bundle golden is untouched. Ships on code-reading + a green ∅ + a live/sim repro with the setting ON. **Do NOT pre-authorize an oracle re-pin** — a naked oracle change is the drift alarm.

### 4.5 — 🪤 Landmine annotation, NOT a fix — **XS**
- `src/modules/settings-visibility.ts:1014` is `export function settingsProfileMakeGUI() { }` — an **empty body** that **shadows** the real 36-line implementation at `import-export.ts:8` on `globalThis` (`legacy-bridge.ts:57` spreads `...importExport` **before** `...settingsVisibility`; last spread wins, per the file's own comment at `:24-28`). `settings-defs.ts:964` calls it bare → invokes the **no-op**. The Settings-Profile dropdown is **never mounted**. This is **faithful to legacy** (`legacy/SettingsGUI.js:2600` declared the same empty function, concatenated after `import-export.js`).
- **Action:** (i) file a GitHub issue; (ii) fix the ambient decl at `src/game/at-legacy.d.ts:93` — it says `// settings-engine.ts` (the **wrong module**) and uses `(...rest: any[]): any`, violating the #36 `typeof import()` convention its own neighbours follow — this half is declaration-only and byte-identical; (iii) add a **DO-NOT-DELETE** comment at `settings-visibility.ts:1014`.
- **Why the annotation is the deliverable:** an empty exported function shadowing a real 36-line one is *exactly* what a future dead-code sweep of the 1000-line `settings-visibility.ts` deletes on sight — and deleting it makes `settings-defs.ts:964` start inserting three elements into a tab that **does** exist by then. A user-visible UI change, landing **silently behind a green net** (jsdom L0 cannot see it). One nuance for the issue: the port is *not* actually behavior-identical — legacy left `$settingsProfiles` undefined so every handler early-returned, whereas the port assigns a **detached `<select>`** (`import-export.ts:7`), so `initializeSettingsProfiles`/dropdown/delete handlers now pass their `== null` guards and mutate a phantom element.

---

## Theme 5 — Deferred with a stated precondition (do NOT attempt yet)

### 5.1 — `other-praiding.ts` copy-paste families — **ship the characterization tests, NOT the collapse** — **M** (tests only)
- `other-praiding.ts` is 1686 L, of which ~860 are four index-substitution families: `plusMapToRun1-5` (`:27,42,59,78,99`), `plusPres1-5` (`:122,223,324,425,526` — `plusPres1` vs `plusPres2` differ *only* in the function name and the `plusMapToRunN()` call), `pcheck1-5` (`:627,660,693,726,759`), `pcheckmap1-5` (`:792,827,862,897,932`). All 20 have **zero callers outside the module**, so no legacy bare-name consumer constrains a future collapse. The code is **live** (`AutoTrimps2.js:264-267` → `other-praiding.ts:1052-1054`, `:1555-1557`).
- **This repo's own #64 and #65 are precisely this defect class** (stale index-substitution; a per-index branch never implemented). A 5-way copy-paste where every fix must land five times identically is a proven bug factory *here*.
- 🚨 **But the L0 differential is completely BLIND to this file** (`corpus-coverage.test.ts:34`; every decision bottoms out in `selectMap`/`runMap`/`recycleMap`). `baseline-zero` would report **GREEN for an arbitrarily broken rewrite.** Carrying the collapse as an executable task would repeat the #66 "green net over unmeasured code" failure verbatim.
- **✅ Do now:** L1 characterization tests for the 15 pure predicates (`plusMapToRun1-5` are argument-free `game.global.world`-only; `pcheck1-5` and `pcheckmap1-5` are pure-read) — golden-master over `world % 10 ∈ 0..9`. Test-only, byte-identical, and it closes the repo's **worst characterization gap**.
- **⛔ Do not do:** the index-parameterized collapse. It is neither byte-identical nor net-verifiable. Revisit only once the tests exist and it is spec'd as its own transaction.

---

## Considered and rejected (load-bearing — do not re-propose)

**Type-honesty / `any`:**
1. **`RcalcEnemyHealth` `any` ambient** (`at-legacy.d.ts:460`) — the two lines *above* it are the #36 sweep's own explicit rationale comment. Deliberate, committed, and #32 is drained. Typing it leaves `npm run typecheck` **red at 22 sites** — not a shippable unit.
2. **The 3 other loose `(...args: any[])` ambients** (`at-legacy.d.ts:110`, `:324`, `:460`) — same story: each carries a `NOT a typeof-import:` rationale directly above. Typing them turns typecheck red at ~28 sites, forcing either 30+ undocumented `as any` casts (strictly worse) or tuning-gated behavior changes.
3. **`MAZ.ts:495` `as any` on a broken comparator** — the comparator is **byte-verbatim upstream legacy** (`git show d283f152:legacy/modules/MAZ.js:483-485`), preserved exactly as the true-TS contract demanded. #32-class, behavior-gated, and **no Quagmire fixture exists** so the net cannot see a fix. File an issue; not a plan item.
4. **`import-export.ts:889` `as any` on an IIFE'd `setTimeout`** — real observation, but the finder proposes **no behavior change**, and `@ts-expect-error` is *line*-scoped on a ~700-char minified one-liner → **less** type-honest than the surgical `as any` it replaces.
5. **"No-action" cast audit** (`equipment.ts:739` et al.) — content is *"I looked and found nothing."* Not work.
6. **Retagging the 7 `@ts-expect-error #32` comments to a new issue number** — fixes zero bugs; the comments are self-describing; the proposed "cite an open issue" net immediately needs an exemption allowlist for 11 of 18 suppressions. *(The comments do get dropped — but as a side effect of actually fixing the bugs in 4.1.)*

**Splits:**
7. **`calc.ts` → `calc-radon.ts`** — the giant-split rationale is *de-risking a later idiomatic refactor*, and `calc.ts` **already completed** that refactor (header `calc.ts:1-11`, Phase 2 · #51). Shrinks no future blast radius. Claimed byte-identical; isn't.
8. **`import-export.ts` → `-tooltip.ts`** — 9th-largest file; the bulk is **one 727-line function**, so the new file is a 727-line file holding a 727-line function. Unblocks nothing.
9. **`perks.ts` → `perks-radon.ts`** — the halves are *already* fully decoupled (zero cross-refs), so the split buys file-size only, while adding a new side-effect import into `src/main.ts`, whose load order is a **named load-bearing constraint**. Adjacent #38 already deferred as disproportionate.
10. **`mapfunctions.ts` → `-dispatch.ts`** — **explicitly decided against** by the Phase-3 spec (D2: dispatchers fan out to nearly every family; only AMP and Praiding are genuinely low-cut). A naked golden regen on the least-netted, highest-consequence dispatch path is the exact drift vector the net exists to alarm on.
11. **Decomposing `settings-defs.ts:9` / `settings-visibility.ts:9`** — behavioral by construction; the `createSetting` **call order IS the persistence contract**. Non-goal, not a proposal.

**Duplication:**
12. **Derive `RequipmentList` from `equipmentList` minus `Gym`** — this is the **R-twin rejection** wearing a hat. It *encodes a new invariant* ("U2 = U1 minus Gym") that does not exist today, so a future U1-only entry silently **leaks into U2's** `for (const i in RequipmentList)` loops. Negative value.
13. **Collapse `RAMP`/`dRAMP` and `Praiding`/`dailyPraiding` to a `daily` param** — the twins are **state machines** separated by ~40 cross-module-exported globals. Collapsing removes zero duplication (every line becomes `daily ? RdAMPx : RAMPx`) and it is corpus-unreachable, so unverifiable.
14. **`RcalcOurHealth` ↔ `calcOurHealth` dedupe** — standing prior rejection (distinct U1/U2 models = tuning).

**Nets / tests:**
15. **Generalized "every multitoggle index must appear in a comparison" net** — measured: **48 of 54 multitoggles fail**; the allowlist would be ~90 hand-justified entries. Needs dataflow, not regex.
16. **Cardinality floor on L0 mutator diversity** — `corpus-coverage.test.ts:47` already pins **exact set equality** per save, which strictly subsumes it; and the proposed floor is *green on the very fixture it was written to indict*.
17. **`saves.test.ts:42` per-mutator tally** — the stronger assertion already exists at `corpus-coverage.test.ts:39-48` (`toEqual`, fails on coverage loss **and** gain). Adds a fourth, weaker, duplicated copy of the pins.
18. **"16 modules have no test file"** — the anchor is mislocated (`autoheirlooms3` is in `heirlooms.ts:128`, which **has** three tests, not in `portal.ts`). Residual is coverage-% aesthetics.
19. **`buildings.characterization` 26-stub audit** — the load-bearing claim is false; `smithylogic` **is** restrictive-covered at `:663`, and `calcHeirloomBonus`/`getMaxAffordable` are multipliers/quantities, not gates.
20. **`settings-inventory.test.ts` is "snapshot-only"** — false; 3 of its 5 `it()` blocks are plain assertions.
21. **`getPageSetting` hot-path optimization** — measured non-problem; a cache would create a staleness surface across `setPageSetting`/`settingChanged`/import/the every-tick render path. **Recommendation: do nothing.**
22. **"Benign phantoms" sweep** (`GatewayWall`, `MaxTox`, …) — its own recommendation is *don't touch*. The one useful sentence (the `MaxTox` protective-phantom hazard) is folded into item 1.1.
23. **`upgrades.ts:105` `dMaxMapBonushealth` phantom** — real, but **inert on default config**: `:106`'s `CustomDeltaFactor` defaults to `-1`, so `d` is already unconditionally true. Reachable effect is "first Gigastation at mapBonus 0–1 instead of 2." File as a #32-class issue; do not fold into a sweep.

**Dimension that yielded nothing:** *Q1 type-honesty*, as a **type** exercise, produced **zero** worthwhile items — every remaining loose `any` is a documented, deliberate, issue-linked decision, and every proposal to tighten one turns `typecheck` red or launders one honest `any` into thirty dishonest casts. Its *only* real yield was three misfiled **ReferenceErrors** (items 4.1/4.2), which are bugs wearing a type-annotation costume.

---

## What we could not measure

1. **Everything behind `runMap` / `selectMap` / `setFormation` / `recycleMap`.** The L0 net does not observe them (`scripts/sim/coverage.mjs:14`). That is the *entire* praid/AMP/map-selection engine — `other-praiding.ts` (1686 L), `mapfunctions*.ts` (~2400 L), and half of `maps.ts`. **A green L0 on any change to those files means nothing.** Items 4.1(b), 4.4, and all of Theme 5 sit in this blind spot.
2. **All UI visibility.** `turnOn`/`turnOff` only mutate `style.display` (`settings-visibility.ts:26-33`). No net sees it. Item 4.2 is verifiable **only** by live Chrome.
3. **The whole U2 corpus depth.** `04-u2-radon` is ~1200 identical `buyJob` + 1 `buyUpgrade`. `Requipon` defaults **false** and no fixture enables it, so `RautoEquip` never executes in the sim regardless of tick budget. Every U2 fix in 4.3 is therefore **unverified by the harness** and needs a live U2 run.
4. **Deep-zone U1 (BW raiding, Bionic Wonderland).** No corpus save reaches it; `Bubble` is absent from the v5.10.1 clone. Item 4.4 ships on code-reading, not observation — and we should say so out loud rather than hide behind an ∅.
5. **Whether any *user* is actually hitting 4.1(a).** The reachability argument is a code-reading proof (the `!=`-OR-`!=` tautology at `portal.ts:236`), not a reproduced crash. Reproducing it live — configure a carried heirloom matching `highdmg`, enable AutoPortal, watch the console — is the **first thing to do** on that branch, and it is cheap.