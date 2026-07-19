# 🦃 Turkimp Indicator (#41 / #149) — Implementation Plan

**Goal:** Restore a visible turkimp "active + time-left" cue in the custom UI, per the approved
mockups (`docs/mockups/2026-07-18-turkimp-*.html`). Five coordinated changes behind the existing
`ATCustomUI` toggle.

**Constraints (from repo CLAUDE.md):**
- `ATCustomUI` OFF ⇒ **byte-identical** (`baseline-zero` net stays green — no Phase code runs when off).
- **Mirror, never recompute** — the timer reads `#turkimpTime.textContent` (the game keeps it fresh via
  `gather()→updateTurkimpTime()` each tick, even while `#trimps` is hidden). `turkimp2` purchased ⇒ `∞`.
- **Build-once + mutate** cached child refs — never per-tick `innerHTML` on a tile.
- All gates by exit code: `npm run lint` / `typecheck` / `test:ci` / `build`.

---

## 🎯 Tasks

### Task 1 — 🦃-wrapped verb badges (food/wood/metal) [foundational, inline]
- `resource-tile.ts buildTile`: restructure the badge to build-once children:
  `<span class="at-rt-auto" data-on="0" data-turk="0"><span class="tk">🦃</span><span class="v">VERB</span><span class="tk">🦃</span></span>`.
  Set `.v` text once (static per resource); turkeys hidden by CSS when `data-turk="0"`.
- `updateTile`: `turk = turkimpActive() && r∈{food,wood,metal}`. Set `data-turk`; set `data-on=1` when
  `gathering || turk`. Active-gathered still pulses.
- `shell.ts` CSS: `.at-rt-auto[data-on="1"][data-turk="1"]` → gold; `.at-rt-auto[data-turk="0"] .tk{display:none}`.
- Helper `turkimpActive()`: `game.talents?.turkimp2?.purchased || game.global?.turkimpTimer > 0`.
- Test (jsdom): badge shows turkeys + gold when turkimp active on wood; hidden otherwise.

### Task 2 — Always-show Fragments / Gems / Helium [inline]
- `resource-region.ts`: for `fragments|gems|helium`, mount regardless of `isUnlocked` (always visible).
- Test: region mounts helium tile even when native is `display:none`.

### Task 3 — Helium drops its sparkline [inline]
- `resource-tile.ts`: helium builds header+figs only (no `<svg>`); `updateTile` skips its sparkline.
- `shell.ts` CSS: `#miscColumn .at-rt-helium{flex:0 0 auto}`.

### Task 4 — Turkimp slim gold tile [foundational, inline]
- New `tiles/turkimp-tile.ts`: `buildTurkimpTile / updateTurkimpTile / syncTurkimpTile / deactivateTurkimpTile`.
  Slim single row (name + timer). Mirror `#turkimpTime`; `∞` when `turkimp2`; dim `—` when idle.
  Mount into `#miscColumn` after the helium tile.
- `boot.ts`: call `syncTurkimpTile` in `startTiles` + the 200ms refresh; `deactivateTurkimpTile` in `stopTiles`.
- `shell.ts` CSS: `.at-turk` slim gold row + idle/`∞` variants (from the mockup).
- Test (jsdom): three states render (active `MM:SS`, `∞`, idle).

### Task 5 — Matched-height CSS [inline]
- `shell.ts`: only `#miscColumn .at-rt-fragments,.at-rt-gems{flex:1 1 0}`; helium + turkimp `flex:0 0 auto`
  so the two graph tiles absorb the column height and the stack ends level with its neighbours.

### Task 6 — Completeness net + all gates [inline]
- Extend `tests/nets/custom-ui-completeness.test.ts`: assert `#turkimpTime` is a real id in the clone and
  the turkimp tile mirrors it (guards silent re-drop).
- `npm run lint && npm run typecheck && npm run test:ci && npm run build` all exit 0.

### Task 7 — Chrome verify [inline]
- `npm run serve` → `http://localhost:8080/`, toggle `ATCustomUI` on. Verify: always-on secondaries;
  Helium chart-free; force `game.global.turkimpTimer = 9e5` → 🦃 verbs on food/wood/metal + Turkimp row
  counts down; set `turkimp2.purchased=true` → `∞`; matched column heights; toggle OFF → native returns.

### Task 8 — Code review + ship [inline]
- Dispatch `feature-dev:code-reviewer` over the branch diff (focus: OFF byte-identity, build-once, mirror).
  Address findings → squash → FF-merge to `main` → delete branch → close #149.

## Self-review
Covers all 5 issue parts (verb / always-on / helium-no-chart / turkimp tile / matched heights) + net guard
+ OFF byte-identity in every task. No tuning literals touched (pure UI/mechanism).
