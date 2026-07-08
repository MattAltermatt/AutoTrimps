# 🗺️ AutoTrimps Modernization Roadmap

Incremental strangler modernization of the AutoTrimps userscript. Full design:
[`docs/superpowers/specs/2026-07-08-autotrimps-modernization-design.md`](docs/superpowers/specs/2026-07-08-autotrimps-modernization-design.md).

## ✅ Phase 0 — Foundation baseline — *verified 2026-07-08*
Vite/TS/Vitest/oxlint toolchain; legacy runtime moved to `legacy/` as the oracle;
build assembles a single userscript (legacy concat + esbuild src, loader neutered);
local dev serve + Chrome verify loop. **Behavior identical by construction.**
Verified in the live clone (Trimps 5.10.1): boots, renders Settings/Graphs UI, drives
the game (gather → jobs → upgrades → fight → zone progress), console clean. The verify
loop caught two concatenation regressions (ASI chunk-merge; Highcharts double-load), both
fixed in the build.

> 🗃️ **Deferred to the Graphs/UI phase:** `Graphs.js` still CDN-injects Highcharts
> (`Graphs.js:177`), so the bundle isn't fully self-contained yet. Vendoring Highcharts
> means also neutering that inject — a behavior change, out of scope for the identical
> baseline.

## ✅ Phase 1 — First real conversion & the transition seam — *verified 2026-07-08*
Converted `legacy/modules/utils.js` → `src/modules/` behind a **global-publish seam** and
locked the idiom every later slice copies. Design:
[`docs/superpowers/specs/2026-07-08-phase-1-utils-seam-design.md`](docs/superpowers/specs/2026-07-08-phase-1-utils-seam-design.md).

- **The seam:** converted modules `export` normally; `src/legacy-bridge.ts` does
  `Object.assign(globalThis, {...})` (wildcard from module namespaces) so still-legacy
  code calls them by bare name. The src bundle is emitted **right after `AutoTrimps2.js`,
  before the rest of the legacy modules** — required because still-legacy modules call
  converted functions at load time (`portal.js:4`). Converted code reads legacy/game
  globals as free identifiers, typed ambient in `src/game/at-legacy.d.ts` (shrinks as
  modules convert).
- **Slice shape:** faithful verbatim port (`utils.ts`, `@ts-nocheck` tangle) → peel the
  clean leaves `time.ts` + `buystate.ts` (real types + vitest). settings↔logging stay
  tangled (circular) for a future untangle slice.
- **Verified live** (Trimps 5.10.1): all seam functions published, clean console, both
  boot markers, log-filter button renders, settings + buystate round-trips work. The live
  verify + a fresh code review caught the src-last ordering bug (now fixed + guarded by a
  build-test ordering assertion).

## 🚧 Phase 2 — Module-by-module strangle *(in progress)*
Convert in dependency order, each slice: faithful port → publish via seam → verify live → commit.

- ✅ **Shipped 2026-07-08:** `dynprestige`, `breedtimer` (first `MODULES` module + shared-var
  seam), `nature`, `magmite`. Idioms locked: converted→converted imports, implicit-global
  audit (tsc-driven), `MODULES` ambient registry, shared-var→`globalThis` publish,
  `@ts-nocheck` for game-coupled bodies.
- 🎯 **Next — pure logic:** `calc` (69 KB core — damage/health/gains; big, likely multi-sitting).
- 🗃️ **Remaining groups:** systems (buildings, jobs, upgrades, equipment, gather, heirlooms,
  perks), combat/maps (fight, stance, scryer, maps, mapfunctions, MAZ, ab), infra (portal,
  import-export, query, performance, other).

## 🎨 Phase UI — Break up SettingsGUI.js (253 KB)
Decompose the monolith UI; modernize settings UX. Late — most entangled.

## 🆕 Phase Parity — Sync with Trimps v5.10.1
Diff game changes since the 2022 fork; implement automation gaps.

## 🐛 Phase Bugs — Squash
Fork's known GitHub issues + everything the type-checker and parity checks surface.

---
**Principle:** opportunistic bug/parity fixes when already in a module; game-affecting
behavior changes are always called out and verified. **Numeric balance is sacrosanct** —
ask before touching any tuning value.
