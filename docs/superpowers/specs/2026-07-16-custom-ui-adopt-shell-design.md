# Custom UI — Adopt-and-Skin Shell (a UI Strangler) — Design

**Issue:** #41 (UI Streamline), scope-expanded to a full, opt-in UI replacement.
**Date:** 2026-07-16
**Status:** Approved (brainstorm + 4-agent dueling panel). Ready for plan.

## 1. Goal

Give AutoTrimps its own UI that can **completely replace** the stock Trimps game UI, behind
a **toggle**, so we are free to relocate sections, change styling, and increase information
density (the #41 streamline goal) — **without ever dropping a feature the game has.**

The user's paramount constraint: *"I am afraid of missing something because our UI doesn't
have it."* Completeness is the top requirement, ahead of layout ambition.

The immediate deliverable is a first ship that **looks identical to the current UI** with one
**deliberate, obvious marker** proving the new render path is active — so we can iterate
region-by-region afterward with confidence nothing is missing.

## 2. The decision (why adopt-and-skin, not reimplement-from-state)

A 4-agent panel (adopt-advocate, full-reimplement-advocate, falsifier, feasibility-mapper)
read the real game clone `../trimps-game` (v5.10.1). The falsifier's code-level findings
were decisive:

- **You cannot delete the game's DOM.** `updateLabels()` runs every 100ms tick and
  **self-heals**: `checkAndDisplay{Resources,Buildings,Jobs,Upgrades,Equipment}`
  (`updates.js:5560-5623`) do `if (!getElementById(item)) rebuild` every tick. Remove a node
  → the game recreates it within one tick. Remove `#foodOwned` → the loop **throws** (no null
  guard, `updates.js:5539`). A "render everything ourselves from game state" architecture
  therefore collapses into "shadow all ~674 element ids forever + intercept every resurrection
  and null-write path" — strictly worse, and it still can't render two subsystems that have
  **no state source at all**: the **message log** (lines live only in `#log` innerHTML) and the
  **Spire** (imperative HTML-as-logic in `playerSpire.js`).
- **Adopting the game's own nodes is structurally safe.** The game renders exclusively through
  **document-global, id-addressed, per-tick string injection**: 767 `getElementById` sites in
  `main.js`, re-resolved every call (zero cached node handles); UI built by `innerHTML` into
  id-addressed containers; near-zero `appendChild`, none into a load-cached parent. **Moving a
  node to a new parent preserves its id, so the very next `getElementById` finds it and the
  update lands.** Content and color updates survive a reparent by construction.

**Conclusion:** adopt the game's live elements into an AT-owned shell. Any region we have not
yet redesigned **is** the game's own self-healing element — so it can never be missing. This is
the same strangler pattern that already succeeded on this project's code migration.

### Not a stop-gap

The shell + adoption bridge is **permanent infrastructure**, never ripped out. "How much of the
UI is AT-native vs. adopted-native" is a **dial we turn over time**, and the system is complete
and functional at *every* dial position — including day one, when nothing is AT-native yet.
Regions "graduate" from adopted → AT-styled → AT-native-from-state only when we deliberately
choose to redesign them. Un-graduated regions stay adopted **forever** with zero penalty (the
log and Spire will likely stay adopted permanently — correct, not debt). This reaches the full
end-state (any region *can* be 100% AT-owned) without the pure-reimplement tar pit.

## 3. The three non-negotiable design rules (falsifier-derived)

1. **Adopt/reparent only at the game's fixed-container granularity — never mid-container.**
   `draw{AllBuildings,Jobs,Equipment,Upgrades}` and `drawGrid` rewrite a container's *entire*
   innerHTML on unlock/zone events (`updates.js:5796,5840,6046,6253`; `main.js:10601`). Moving
   individual buttons/cells out of a container gets them wiped on the next rebuild. We may move
   and restyle whole containers (`#buildingsHere`, `#log`, `#resourceColumn`, …); to re-compose
   a container's *internals*, that region must graduate to AT-native-from-state.
2. **Never make `#atWrapper` a positioned / `transform`ed / `filter`ed / `will-change` ancestor
   of the game's absolute-positioned overlays.** `#tooltipDiv`, the portal window,
   `#playerSpirePopout`, `#tutorialDiv` set `left/top` in px derived from mouse `pageX/pageY`
   (`updates.js:1998,2068`; `main.js:3460`; `playerSpire.js:926`) — correct only when their
   containing block is `<body>`. These overlays are already **body-level siblings, not inside
   `#wrapper`**, so we leave them unadopted and keep the shell from establishing a containing
   block over them.
3. **Never drop or re-id an adopted node.** `checkAndDisplay*` rebuilds a *second* copy if an
   id goes missing (`updates.js:5560-5623`), and `getElementById` first-match then writes to the
   wrong one. Reparent nodes intact, ids preserved.

## 4. Architecture

```text
<body>
 ├─ #atWrapper        ← NEW. AT-owned root shell (a body sibling of #wrapper).
 │    ├─ .at-ui-badge      ← the obvious marker ("AutoTrimps UI" corner badge)
 │    └─ [region slots]    ← each slot hosts either an adopted game container
 │                            or (after graduation) an AT-native component
 ├─ #wrapper          ← the game's entire HUD. Toggle hides/shows this ONE node.
 ├─ #tooltipDiv, #portalWrapper, #playerSpirePopout, #heirloomWrapper,
 │  #statsWrapper, #mutTreeWrapper, #boneWrapper, #tutorialDiv, …  ← popups:
 │                       body siblings, left UNADOPTED (fall through to game render)
 └─ <script> …
```

- **`#wrapper` is the single clean toggle seam** (feasibility map): it is the sole root of the
  persistent HUD (resources, trimps, log, build queue, buy tabs, buildings/jobs/upgrades/
  equipment, battle + map area, settings row, portal/perks row). The ~10 popups are separate
  body siblings — decided per-popup later; default is leave them native.
- **Toggle OFF (default):** `#atWrapper` hidden/empty, `#wrapper` shown, **byte-identical stock
  game.** This is a hard invariant — see §7.
- **Toggle ON:** `#wrapper` hidden (the game keeps painting it off-screen harmlessly — #129
  measured `gameLoop` at 0.4–0.6% of frame; a hidden tree costs nothing extra), `#atWrapper`
  shown with the HUD adopted into it.

### Components (new `src/modules/custom-ui/` directory module)

- **`state.ts`** — a `customUIState` holder (mutable cross-module state; mirrors the graphs
  `state.ts` precedent). Tracks whether the shell is active and which regions are graduated.
- **`shell.ts`** — creates `#atWrapper`, mounts the marker, owns show/hide of `#wrapper` ↔
  `#atWrapper`. Pure DOM plumbing.
- **`adopt.ts`** — the adoption bridge: reparents game containers into shell slots at container
  granularity, ids preserved; the reverse (release back to `#wrapper`) for toggle-off.
- **`regions.ts`** — the region registry: the list of game containers, their target slot, and
  each region's status (`adopted` | `at-styled` | `at-native`). Drives the completeness net.
- **`boot.ts`** — `bootCustomUI()`, called from `main.ts` after `bootGraphs()` (both read the
  static, load-present game DOM; ordering is safe). Reads the `ATCustomUI` setting and, if on,
  activates the shell.
- **`styles.ts`** (or an injected stylesheet) — the AT skin + marker CSS. Day one: near-empty,
  only the marker. Later: per-region restyle.

### The toggle setting

- `ATCustomUI` — a boolean AT setting via the standard `createSetting` path in
  `settings-defs.ts`, **default `false`**. Rendered in the AT settings panel. Flipping it calls
  into `shell.ts` to activate/deactivate live (no reload).
- Adding a `createSetting` touches the persistence contract: the two frozen `serializeSettings`
  blobs, the byte-parity `createSetting`-id gate, and the **settings-inventory dual snapshot**
  (a `.snap` **and** an inline snapshot count — commit both or CI reddens). Handled as an
  explicit plan step.

## 5. The obvious marker

Day-one requirement: the replacement must be **unmistakably identifiable as the new thing**.
- An **accent frame** around `#atWrapper` (a distinct-colored outline) + a small **"AutoTrimps
  UI" corner badge**. Purely cosmetic (🎨) — final color/placement tuned during Chrome verify.
- The marker persists across all future phases as the "you are in the AT UI" signal; it is not
  removed when regions graduate.

## 6. Completeness net (the fear, mechanized)

A CI test that makes "our UI is missing something" a **failing test, not a user bug report**:
- Enumerate the game's top-level HUD containers (from `index.html`) **and** the dynamic key
  families `game.buildings`, `game.jobs`, `game.upgrades`, `game.equipment`, and the Spire
  towers.
- Assert every one is **either** bound to an AT-native component **or** explicitly registered as
  adopted-native-hosted in `regions.ts`.
- **Red** on any unclaimed container/key — including new ones a future game-version bump adds.
- Mutation-checked: removing a region from the registry must turn it red.

Enumeration (not hand-listing) is what makes future game content covered by default: a new
building key is a new row that is either claimed or fails CI.

## 7. Testing & invariants

- **OFF = byte-identical.** The L0 proof-net `baseline-zero` must stay neutral: with `ATCustomUI`
  default `false`, `bootCustomUI()` must be a pure no-op on game behavior (mount nothing that the
  game loop or the trace recorder can observe). Verify by running the sim suite — no trace change.
- **Standard gates** by **exit code** (not grep): `lint`, `typecheck`, `test:ci`, `build`.
- **Chrome live-verify** (the primary evidence for this visual work):
  - OFF → indistinguishable from stock Trimps.
  - ON → layout identical to stock **plus** the visible marker; resources tick, combat runs,
    maps/build/upgrade all function (the adopted nodes are still the game's live elements).
  - Toggle round-trips ON↔OFF cleanly, no console errors, no duplicate ids, popups
    (tooltip/portal) still position correctly.
  - Click-test the toggle control itself (per the click-test-every-new-button rule).

## 8. Phasing

- **Phase 1 (this ship) — Foundation MVP.** `custom-ui/` module, `#atWrapper` shell, `ATCustomUI`
  toggle, adopt the whole HUD (`#wrapper`) into the shell as one intact unit (exact mechanism —
  reparent `#wrapper` wholesale vs. `display:contents` passthrough vs. restyle-in-place — chosen
  by Chrome verification to guarantee identical layout), the marker, and the completeness net.
  Outcome: a toggle that swaps between stock and an identical-but-marked AT-hosted HUD.
- **Phase 2+ — Region graduations (one issue each).** Per #41: relocate/restyle whole regions
  (shrink the action panel, regroup resources, densify), and graduate individual regions to
  AT-native-from-state where internal re-composition is wanted. Each is its own spec/plan/verify
  cycle behind the same toggle and marker.

## 9. Risks & mitigations

- **Layout fidelity on adopt.** Reparenting a container can drop the game's Bootstrap-3 grid
  ancestry (14k lines of CSS, mixed id/class, Bootstrap-3-dependent). *Mitigation:* Phase 1 moves
  `#wrapper` **as one intact subtree** (internal grid preserved) or restyles in place; per-region
  grid handling is owned when that region graduates.
- **Per-tick mutation races.** The game rewrites adopted nodes ~10Hz. *Mitigation (rule):*
  decorate via outer wrappers / stylesheets only — never mutate inside a game-owned container
  (mirrors the repo's per-frame-`replaceChildren` click-bug lesson).
- **Popups.** Left unadopted as body siblings; shell must not establish a containing block over
  them (rule 2).
- **Persistence-net churn from the new setting.** Expected; explicit plan step to update both
  snapshots + the serializeSettings blobs.
