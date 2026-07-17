# #41 Custom UI — Phase 3: secondary resources + the Trimps panel

**Date:** 2026-07-16
**Issue:** [#41](https://github.com/MattAltermatt/AutoTrimps/issues/41) (Phase 4 — UI Streamline milestone)
**Branch:** `feature/custom-ui-secondary-tiles`
**Builds on:** Phase 1 (adopt-and-skin shell), Phase 2 (core resource tiles). See
[`2026-07-16-custom-ui-adopt-shell-design.md`](./2026-07-16-custom-ui-adopt-shell-design.md).

## 🎯 Goal

Graduate the remaining HUD resources to AT-native rendering behind the same `ATCustomUI` toggle
(default **OFF ⇒ byte-identical**), so the whole top row reads as one system:

- **Fragments / Gems / Helium** — the narrow `#miscColumn` secondary resources, restyled to the
  shipped `.at-rt` card (dark gradient, mono figures, sparkline, per-resource accent).
- **The Trimps panel** — the `#trimpsColumn` population block, restyled into an AT-native tile that
  keeps population, the breeding timer bar, breeding/employed sub-stats, and the Trap button.

**Locked design (Chrome-verified mockup, user-approved 2026-07-16):**
- Trimps uses **Variant A** — breeding/employed as two labelled stat *pills* under the breed bar.
- **All three top-row blocks share one height.** The three flat secondary tiles grow to fill their
  column equally (sparklines flex-grow), so shorter resources "expand out" instead of leaving a gap.
- Accent colours are **pinned to the game's own resource colours at build** (the mockup used
  placeholders). Resolve each from the game's CSS / `game.resources[r]` at implementation time.

Out of scope: the message log (`#logColumn`), buildings/jobs/upgrades/equipment, the battle panel.
Those are later Phase-3+ graduations, each its own cycle.

## 🧩 Architecture

Phase 2 established the pattern: a `REGIONS` entry with `status: 'at-native'` + `natives: [...]`, an
idempotent `syncRegion()` (mount on unlock / unmount on portal re-lock, run every 200ms), a 60-slot
ring-buffer **sampler** (raw numeric, 1/s), and **build-once/mutate** tiles that **mirror the game's
own live spans** (drift-free — the hidden native block keeps updating as our source of truth). Phase 3
extends that machinery; it does not invent a new one.

### The two graduations are different shapes

1. **Flat secondary resources (Fragments / Gems / Helium)** — structurally identical to Phase 2's
   food/wood/metal/science. They reuse `buildTile`/`updateTile`/the sampler verbatim, with three new
   entries. No new module.

2. **The Trimps panel** — richer than a flat resource. Gets its own module
   (`tiles/population-tile.ts` + wiring in a `population-region.ts`). It is a **hybrid tile**:
   - **AT-native (rebuilt + mirrored):** population `owned / max`, `+/sec` rate, the population
     sparkline, and the breeding/employed **stat pills** — all mirror the game's spans / sampler,
     exactly like a resource tile.
   - **Adopted (live game nodes, moved in, ids preserved):** the breeding progress bar
     (`#trimpsBar` + `#trimpsTimeToFill`) and the entire trap area (`#trapArea` = the
     `#trimpsCollectBtn` / `#trimpsCollecting` button + `#trappingProgress`/`#trappingBar`).

   **Why adopt those two nodes instead of re-rendering them?** They are game-*driven*, animated, and
   interactive — the game updates their width/label/count every tick and `#trimpsCollectBtn`'s
   `onclick="setGather('trimps')"` is real player control. Re-implementing bar widths means computing
   and re-syncing values the game already computes ⇒ drift risk + duplicated tuning. Adopting the node
   (moving it into a styled slot, id intact) is the Phase-1 finding applied at sub-element granularity:
   the game re-resolves by `getElementById` every tick, so a reparented node keeps updating and the
   Trap button keeps working with **zero re-implementation**. On deactivate we move them back.

## 🗺️ Concrete changes

### `tiles/sampler.ts`
- Extend `RESOURCES` to `['food','wood','metal','science','fragments','gems','helium']` (all use
  `game.resources[r].owned`).
- Add a **population** sample: either a `'trimps'` entry (samples `game.resources.trimps.owned`) or a
  parallel `populationHistory` buffer. Prefer adding `'trimps'` to the same ring-buffer map keyed by
  name so `history('trimps')` works uniformly.

### `tiles/resource-tile.ts`
- Add `LABEL` for Fragments/Gems/Helium. Fragments/gems get a **gather VERB**? No — the game's
  hand-gather verbs only cover food/wood/metal/science (`playerGathering` is never fragments/gems/
  helium), so the gather badge stays hidden for these (badge already hides when `data-on="0"` and
  `playerGathering` never equals them — no code change needed, just don't add a VERB entry, and guard
  the `VERB[r]` lookup for undefined).
- **No-max handling:** `updateTile` already renders `max` only when `{r}Max` has text. Fragments/gems
  have no max span ⇒ renders owned-only. **Helium** has no `{r}Max` and its rate span is `heliumPh`
  (a `/hr` string), *not* `heliumPs`. Generalize the rate-span source: `heliumPh` for helium,
  `{r}Ps` otherwise.

### `tiles/resource-region.ts`
- `RESOURCES` drives the sync loop; adding the three names is enough for mount/unmount, **except the
  unlock check.** `isUnlocked` reads `style.visibility !== 'hidden'` — correct for
  fragments/gems (`visibility:hidden` when locked) but **wrong for helium**, which ships
  `display:none`. Generalize: `unlocked = visibility !== 'hidden' && display !== 'none'`.
  (Verify against the live DOM — helium flips to `display:...` on unlock.)

### `tiles/population-tile.ts` (new)
- `buildPopulationTile()` — build-once DOM: head (name + clock chip), figs (`trimpsOwned/Max` +
  `trimpsPs`), population sparkline, a slot that **adopts** `#trimpsBar` (breed bar), the two stat
  pills (Breeding = `trimpsUnemployed`, Employed = `trimpsEmployed`/`maxEmployed`), and a slot that
  **adopts** `#trapArea`.
- `updatePopulationTile()` — mirror `trimpsOwned/Max`, `trimpsPs`, `trimpsUnemployed`,
  `trimpsEmployed`, `maxEmployed` from their spans; redraw the population sparkline from
  `history('trimps')`. The adopted bar/trap nodes need no update (game drives them).
- **Clock chip** (`⏱ Ns` in the mockup): mirror whatever the live panel shows there — resolve at
  build by reading the DOM (candidates: `#turkimpTime` "Well Fed", or the AT breed-timer element). If
  nothing reliably renders there, drop the chip. Flagged, not load-bearing.

### `tiles/population-region.ts` (new, or a section of resource-region)
- `syncPopulationRegion()` — idempotent, same shape as `syncRegion`: on activate, hide `#trimps`
  natives via the `at-rt-hidden` `!important` class, adopt the live nodes into the tile, mount it in
  `#trimpsColumn`; on portal re-lock (`#trimps` visibility:hidden) unmount + **restore adopted nodes**.
- `deactivatePopulationRegion()` — restore `#trimpsBar`/`#trapArea` to `#trimps`, remove the tile,
  clear the hide class. **Restoring adopted nodes is mandatory** — leaving them in a removed tile
  deletes real game controls.

### `regions.ts`
- Extend the `resources` region's `natives` to include `fragments`, `gems`, `helium`.
- Add a `population` region: `{ id: 'population', containerId: 'trimpsColumn', status: 'at-native',
  natives: ['trimps'] }`.

### `shell.ts` (CSS)
- Add accent colours `.at-rt-fragments/.at-rt-gems/.at-rt-helium` + the population `--c`
  (**pin to game colours**).
- Add the population-panel styles (stat pills, breed/trap bar slots, Trap button styling) and the
  **matched-height** rules: the flat card becomes a flex-column with `.at-rt-spark{flex:1;min-height}`
  so it grows; the top-row container locks the three blocks to one height.
- Fix the mockup's one nit: the breed-bar label must not collide with the fill (right-align / gap it).

### `boot.ts`
- `startTiles()`/`stopTiles()` also start/stop the population region (its sampler tick + sync). Timers
  live only while active (Phase 2 invariant).

### `shell.ts` — remove the active-UI marker (user-directed 2026-07-16)
The Phase 1 marker existed to signal "the custom UI is on" while the shell still looked like the
native HUD. With graduated tiles the restyle is self-evident, so the marker is redundant noise. Remove
**both** the green accent `outline` on the shell (`.${MARKER_CLASS}` rule) and the `position:fixed`
"AutoTrimps UI" corner badge (`ensureShell` no longer appends it; drop the `.at-ui-badge` styles).
Keep `MARKER_CLASS` as the shell's identity class if any selector still needs it, but it carries no
visual weight. Verify the shell still adopts/releases correctly with the outline gone (it was
`outline`, no layout impact either way).

## 🕸️ Nets & gates

- **`tests/nets/custom-ui-completeness.test.ts`** — goes red if a HUD region leaves the registry.
  Update its expectations for the new `population` region + the three secondary natives. This net is
  the mechanized "did we forget a region" fear; keep it honest.
- **`baseline-zero` L0 net** — must stay green: `ATCustomUI` default OFF ⇒ no code path runs ⇒
  byte-identical. Verify.
- **Full gate suite** by exit code (`lint`/`typecheck`/`test:ci`/`build`) — not grep.
- **Chrome verification is mandatory and must cover the FRESH-SAVE unlock path**, not just a deep
  save ([[feedback-verify-fresh-save-unlock-path]]): Fragments/Gems/Helium and the population panel
  all have unlock/reveal sequences. Reset localStorage to zone 1 and watch each unlock live — the
  Phase 2 duplicate-native bug (game's reveal animation sets inline `display:block`) is exactly the
  class of bug a deep save hides. Also verify the **portal re-lock** round-trip (adopted trap/breed
  nodes restored, no orphaned/duplicated game controls), and that the **Trap button still works**
  (click it in the AT tile, assert `setGather('trimps')` fired / state changed).

## ✅ Acceptance

1. `ATCustomUI` ON: Fragments/Gems/Helium render as `.at-rt` tiles; the three share their column
   height evenly; the Trimps panel renders Variant A with a live population sparkline, a working breed
   bar, breeding/employed pills, and a functional Trap button + trap bar.
2. `ATCustomUI` OFF: byte-identical (L0 baseline-zero green).
3. Fresh-save unlock sequence verified for every new resource + the population panel; no duplicate
   native panels, no orphaned controls after a portal round-trip.
4. All gates green by exit code; completeness net updated and mutation-honest.
