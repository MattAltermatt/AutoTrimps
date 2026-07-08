# 📜 AutoTrimps Modernization — History

Frozen record of shipped modernization work. **Forward planning lives in
[GitHub Issues](https://github.com/MattAltermatt/AutoTrimps/issues)** (grouped by
milestone/phase) — this file is the narrative of what already landed. Full architecture:
[`docs/superpowers/specs/2026-07-08-autotrimps-modernization-design.md`](docs/superpowers/specs/2026-07-08-autotrimps-modernization-design.md).

## ✅ Phase 0 — Foundation baseline — *2026-07-08*
Vite/TS/Vitest/oxlint toolchain; legacy runtime moved to `legacy/` as the behavioral
oracle; build assembles a single userscript (legacy concat + esbuild src bundle, remote
loader neutered); local dev-serve + Chrome verify loop. **Behavior identical by
construction.** Verified in the live clone (Trimps 5.10.1): boots, renders Settings/Graphs
UI, drives the game end-to-end, console clean. The verify loop caught two concatenation
regressions (ASI chunk-merge; Highcharts double-load), both fixed.

> 🗃️ Deferred to the UI/Graphs phase: `Graphs.js` still CDN-injects Highcharts
> (`Graphs.js:177`), so the bundle isn't fully self-contained yet.

## ✅ Phase 1 — First conversion & the transition seam — *2026-07-08*
Converted `utils.js` → `src/modules/` behind a **global-publish seam** and locked the idiom
every later slice copies. Design:
[`docs/superpowers/specs/2026-07-08-phase-1-utils-seam-design.md`](docs/superpowers/specs/2026-07-08-phase-1-utils-seam-design.md).

- **The seam:** converted modules `export` normally; `src/legacy-bridge.ts` does
  `Object.assign(globalThis, {...})` (wildcard from module namespaces) so still-legacy code
  calls them by bare name. The src bundle is emitted **right after `AutoTrimps2.js`, before
  the remaining legacy modules** — required because still-legacy modules call converted
  functions at load time (`portal.js:4`). A build-test asserts this ordering.
- **Slice shape:** faithful verbatim port (`@ts-nocheck` tangle) → peel clean leaves
  (`time.ts` + `buystate.ts`, real types + vitest).

## 🚧 Phase 2 — Module-by-module strangle — *in progress*
Each slice: faithful port → publish via seam → verify live → fresh review → FF-merge.
**Remaining work tracked in [Issues under the Phase 2 milestone](https://github.com/MattAltermatt/AutoTrimps/milestone/1).**

Shipped (all *2026-07-08*):

| Module | Notes |
|--------|-------|
| `dynprestige` | first `js→ts` convert of the phase |
| `breedtimer` | first `MODULES` registry module + shared-var seam |
| `nature` | |
| `magmite` | tsc-driven implicit-global audit |
| `calc` | 1,773 lines core combat math (U1 + U2 radon `R*`); shared vars `critCC`/`critDD`/`trimpAA` → `globalThis`; `@ts-nocheck` blob (526 `game.*` touches) |
| `equipment` | 1,153 lines auto-equip/prestige (U1 + U2 `R*`); no shared vars; `needGymystic` implicit-global resolves to AutoTrimps2's decl; consumes calc's `trimpAA` cross-module |

**Locked idioms:** converted→converted imports; implicit-global audit (a bare write to an
undeclared name throws in the strict ES module — pre-declared globals in `AutoTrimps2.js`
are safe); `MODULES` ambient registry; shared-var→`globalThis` publish for cross-module
reads; `@ts-nocheck` for game-coupled bodies; keep genuinely-pure leaves as typed+tested
submodules.

---
**Principle:** opportunistic bug/parity fixes when already in a module; game-affecting
behavior changes are always called out and verified. **Numeric balance is sacrosanct** —
ask before touching any tuning value.
