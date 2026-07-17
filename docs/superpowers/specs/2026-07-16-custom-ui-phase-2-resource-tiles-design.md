# Custom UI — Phase 2: Resource Tiles (first region graduation) — Design

**Issue:** #41. Builds on Phase 1 (`dddb653b`, the adopt-and-skin shell).
**Date:** 2026-07-16
**Status:** Approved (mockup round — user picked layout **B**). Ready for plan.

## 1. Goal

Graduate the four primary resource tiles — **Food, Wood, Metal, Science** — from adopted native
DOM to **AutoTrimps-native rendering** in **layout B** (mockup artifact
`5927304c-ba4c-4e96-877e-f46352ea4a9d`), behind the existing `ATCustomUI` toggle. This is the
**first region graduation** in the strangler: every other HUD region stays adopted/untouched.

Per-tile requirements (user-specified, Wood as the worked example):
1. **Obvious "AT is driving this"** signal — an AUTO badge when AT's gather automation is active.
2. **Streamlined** presentation.
3. **No buttons** — the Chop/Mine/Research button is gone (AT clicks it, the player never does).
4. **Rolling 60-second chart**, updated live, whose **right edge is the current level**.
5. **Keep** amount / max (e.g. `3.80e9 / 9.23e9`) and the earned rate (`+1.90e7/sec`).
6. The chart **replaces** the time-to-fill bar.

## 2. Value sources — mirror the game, don't recompute (drift-free)

The game keeps every resource's numbers current in id-addressed spans, **even while their parent is
hidden** (updates are by `getElementById`, visibility-independent — Phase 1's finding). So:

- **Display values** are mirrored from the game's own live spans (game-formatted, zero drift, reuse
  of the game's math — the same principle as reusing `prettify`/`tooltip`):
  `#{res}Owned`, `#{res}Max`, `#{res}Ps` (the `+X/sec` rate). (`#science` has no max — omit it.)
- **Chart data** samples the raw number `game.resources[res].owned` (a real state field,
  `config.js`) into a ring buffer — raw values are needed for the sparkline's y-normalisation.

We never re-derive owned/max/rate formulas, so an AT tile cannot disagree with the game.

## 3. Architecture — a new `src/modules/custom-ui/tiles/` submodule

- **`sampler.ts`** — a per-resource 60-slot **ring buffer** (`RESOURCES = ['food','wood','metal','science']`).
  `sampleTick()` pushes `game.resources[r].owned` for each resource once per ~1s; `history(r)`
  returns the buffer. Pure-ish: reads game state, writes module-local state. Runs **only while the
  region is active**.
- **`resource-tile.ts`** — builds one layout-B tile DOM (created once, mutated in place — never
  per-tick `innerHTML`, per the repo's replaceChildren+click gotcha) and an `updateTile(r)` that
  mirrors the three spans + redraws the sparkline SVG from `sampler.history(r)`. Renders the AUTO
  badge. No buttons.
- **`resource-region.ts`** — the graduation. `activateRegion()`: for each unlocked resource, hide
  the native `#{res}` block (`display:none` — **not** removed/re-id'd, so the game keeps updating it
  and there is no duplicate-id resurrection, Rule 3) and mount its AT tile into `#resourceColumn`'s
  `.resourceRow` cell. `deactivateRegion()`: remove AT tiles + restore the natives. Idempotent.
  Respects per-resource unlock by mirroring the native block's own visibility (wood/metal/science
  ship `visibility:hidden` until unlocked, `index.html:192/216/237`).
- **Wiring:** `applyCustomUI(true)` (Phase 1) also calls `activateRegion()` + starts the sampler and
  the per-tick tile refresh; `applyCustomUI(false)` calls `deactivateRegion()` + stops them. The
  refresh runs off the existing guiLoop cadence (or a lightweight interval); the sampler ticks at 1s.
- **`regions.ts`:** the resource region is registered `status: 'at-native'` with
  `containers: ['food','wood','metal','science']`.

## 4. The AUTO (active) signal — requirement #1

Show the AUTO badge when AT's gather automation is actually driving the resource:
`getPageSetting('ManualGather2')` in an auto mode (index ≥ 1 = not "Manual Gather/Build"); Science
additionally not in "Science Research OFF" (index 3). Otherwise show a muted "Manual" chip. This is
the honest per-resource "the player has it active" cue (v1 — can refine to true per-resource
automation state later). It reads a setting, never mutates.

## 5. The rolling chart — requirement #4/#6

An inline SVG sparkline in the base strip where the time-to-fill bar was: area fill + 2px line +
an **emphasized endpoint dot at the right edge = current level** + a faint current-level guide.
60 points, one per second, rolling (shift-left on each sample). Colour = resource identity
(food/wood/metal/science). `prefers-reduced-motion` → static (last frame). Marks per the dataviz
skill (thin line, area fill, emphasized endpoint).

## 6. Rules & invariants (Phase 1 carried forward)

- **OFF = byte-identical.** The region, sampler, and refresh are inert unless `ATCustomUI` is on;
  default off ⇒ nothing mounts, natives untouched. `baseline-zero` must stay neutral.
- **Rule 1** (container granularity): we hide/mount at the whole `#{res}` block level, never mid-block.
- **Rule 2** (no containing block over overlays): tiles live inside the static `#atWrapper`/`#resourceColumn`;
  no positioned/transformed ancestor introduced.
- **Rule 3** (never drop/re-id): natives are **hidden, not removed**, ids preserved — the game keeps
  updating them (they're our data source) and cannot resurrect duplicates.

## 7. Testing

- **Unit** (node): `sampler.ts` ring buffer (push/shift, fixed length, per-resource isolation);
  tile number-mirroring helper.
- **jsdom:** `resource-region.ts` activate hides natives + mounts 4 tiles into `#resourceColumn`;
  deactivate restores exactly; idempotent; a locked resource (visibility:hidden native) mounts no tile.
- **Completeness net:** extend to assert the resource region registers all four native containers.
- **Chrome live-verify:** ON → 4 layout-B tiles render in the resource column, values match the
  native numbers, charts roll, AUTO badge reflects ManualGather2, no buttons, no time bar; toggle
  OFF restores native tiles exactly; unlock respected (start with only Food, confirm Wood appears on
  unlock); no console errors; no duplicate ids.
- Gates by **exit code**; the completeness net reads the **pinned `.trimps-game/`** (not `../trimps-game`).

## 8. Out of scope (future graduations)

Fragments/Gems/Helium/Trimps tiles, the jobs/buildings/upgrades regions — all stay adopted. Each is
its own graduation behind the same toggle.
