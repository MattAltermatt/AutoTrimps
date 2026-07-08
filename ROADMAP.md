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

## 🚧 Phase 1 — First real conversion
Convert `legacy/modules/utils.js` → `src/modules/utils.ts` as a true ES module (root of
the import graph). Lock the conversion idiom: export/import shape, typing against
`src/game/trimps.d.ts`, the old/new parity check. Every later slice copies this.

## 🔮 Phase 2..N — Module-by-module strangle
Convert in dependency order — pure logic (calc, breedtimer, nature, magmite), systems
(buildings, jobs, upgrades, equipment, gather, heirlooms, perks), combat/maps (fight,
stance, scryer, maps, mapfunctions, MAZ, ab), infra (portal, import-export, query,
performance, other). Each slice: convert → type → vitest → parity-verify → commit.

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
