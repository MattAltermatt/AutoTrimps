# Purchase Coordinator — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the opt-in Purchase Coordinator *foundation seam* — a shared context, a resource-reservation guard at the U1 building chokepoint, a toggle, and a scorer that generically reproduces (and subsumes) the existing hand-coded Coordination reservation — so spending becomes priority-aware for the metal-contention core.

**Architecture:** Priority-injection hybrid (see spec `docs/superpowers/specs/2026-07-10-purchase-coordinator-design.md`). A new `coordinator.ts` publishes `MODULES["coordinator"]` (context) and exports a pure `coordinatorAllows()` guard + a `computeTopTarget()` pre-pass. Existing buyers gain a one-line guard at their affordability gate; when the toggle is off (or no target is set) the guard is an inert branch, so spending is byte-identical to today.

**Tech Stack:** TypeScript (strict), Vite/esbuild bundle, Vitest (node env; jsdom per-file when DOM-coupled), the bare-name `globalThis` bridge seam.

## Global Constraints

- **Faithful-by-default:** with setting `PurchaseCoordinator` off, spending order is byte-identical; `tests/buildings.characterization.test.ts` must stay green.
- **No balance-number changes:** every numeric literal/formula copied from existing code is preserved verbatim; new tunable constants are user-gated (none introduced in Phase 1 beyond the boolean toggle).
- **Bridge seam:** converted modules read game/AT globals by bare name (typed ambient in `src/game/*.d.ts`); a converted module's exports reach `globalThis` only after being added to `src/legacy-bridge.ts` (import + spread).
- **Commands:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Verify live via `npm run serve` → `http://localhost:8080/`.
- **Universe:** Phase 1 is **U1 only** (buildings/`safeBuyBuilding`). U2 (`Rbuy*`) is Phase 4.

---

### Task 1: Coordinator context + guard (pure core)

**Files:**
- Create: `src/modules/coordinator.ts`
- Create: `tests/coordinator.test.ts`

**Interfaces:**
- Produces: `coordinatorAllows(name: string, costResource: string, cost: number): boolean` and the `MODULES["coordinator"]` context `{ active: boolean; topTarget: { kind: 'upgrade'|'building'|'equip'|'job'; name: string } | null; reserved: Record<string, number> }`.

- [ ] **Step 1: Write the failing test**

`tests/coordinator.test.ts` (node env; the guard reads `MODULES` + `game.resources`, both injected by the fixture):

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { newGame } from './harness/gameFixture'
import { coordinatorAllows } from '../src/modules/coordinator'

describe('coordinatorAllows', () => {
  beforeEach(() => {
    ;(globalThis as any).game = newGame()
    game.resources.metal.owned = 1000
    // anti-false-green tripwire (per CLAUDE.md true-TS guardrail)
    expect(typeof game.buildings.Shed.cost.wood).toBe('function')
    MODULES['coordinator'] = { active: false, topTarget: null, reserved: {} }
  })

  it('allows everything when inactive', () => {
    MODULES['coordinator'].active = false
    MODULES['coordinator'].topTarget = { kind: 'building', name: 'Warpstation' }
    MODULES['coordinator'].reserved = { metal: 900 }
    expect(coordinatorAllows('Gym', 'metal', 500)).toBe(true)
  })

  it('allows everything when no target', () => {
    MODULES['coordinator'].active = true
    MODULES['coordinator'].topTarget = null
    expect(coordinatorAllows('Gym', 'metal', 500)).toBe(true)
  })

  it('never blocks the target itself', () => {
    MODULES['coordinator'].active = true
    MODULES['coordinator'].topTarget = { kind: 'building', name: 'Warpstation' }
    MODULES['coordinator'].reserved = { metal: 900 }
    expect(coordinatorAllows('Warpstation', 'metal', 950)).toBe(true)
  })

  it('blocks a lesser buy that would dip into the reserve', () => {
    MODULES['coordinator'].active = true
    MODULES['coordinator'].topTarget = { kind: 'building', name: 'Warpstation' }
    MODULES['coordinator'].reserved = { metal: 900 }
    // owned 1000 - cost 500 = 500 < reserved 900 → blocked
    expect(coordinatorAllows('Gym', 'metal', 500)).toBe(false)
  })

  it('allows a lesser buy that stays above the reserve', () => {
    MODULES['coordinator'].active = true
    MODULES['coordinator'].topTarget = { kind: 'building', name: 'Warpstation' }
    MODULES['coordinator'].reserved = { metal: 900 }
    game.resources.metal.owned = 2000 // 2000 - 500 = 1500 >= 900 → allowed
    expect(coordinatorAllows('Gym', 'metal', 500)).toBe(true)
  })

  it('ignores reserves in a different (uncontended) pool', () => {
    MODULES['coordinator'].active = true
    MODULES['coordinator'].topTarget = { kind: 'building', name: 'Warpstation' }
    MODULES['coordinator'].reserved = { metal: 900 }
    expect(coordinatorAllows('Hut', 'food', 500)).toBe(true) // food not reserved
  })
})
```

- [ ] **Step 2: Run it and verify it fails**

Run: `npx vitest run tests/coordinator.test.ts`
Expected: FAIL — `Cannot find module '../src/modules/coordinator'`.

- [ ] **Step 3: Write the minimal implementation**

`src/modules/coordinator.ts`:

```ts
// Purchase Coordinator (#57) — priority-aware, opt-in spending layer.
// Spec: docs/superpowers/specs/2026-07-10-purchase-coordinator-design.md
// The context is published on MODULES["coordinator"] (same registry pattern as
// every other converted module); the guard is consulted by buyers at their
// affordability gate. Faithful-by-default: inactive OR no target → allow all.

MODULES["coordinator"] = {
  active: false,
  topTarget: null as null | { kind: 'upgrade' | 'building' | 'equip' | 'job'; name: string },
  reserved: {} as Record<string, number>,
};

export function coordinatorAllows(name: string, costResource: string, cost: number): boolean {
  const co = MODULES["coordinator"];
  if (!co.active || co.topTarget == null) return true;      // inert when off → byte-faithful
  if (name === co.topTarget.name) return true;              // never block the target itself
  const keep = co.reserved[costResource] ?? 0;
  return game.resources[costResource].owned - cost >= keep; // lesser buy can't dip into the reserve
}
```

- [ ] **Step 4: Run it and verify it passes**

Run: `npx vitest run tests/coordinator.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/coordinator.ts tests/coordinator.test.ts
git commit -m "feat(#57): coordinator context + reservation guard (pure core)"
```

---

### Task 2: Register the module + the toggle setting

**Files:**
- Modify: `src/legacy-bridge.ts:42-56` (add import + spread)
- Modify: `src/game/at-legacy.d.ts` (declare the bare-name seam for the two exports)
- Modify: `src/modules/settings-defs.ts` (add the `PurchaseCoordinator` setting)

**Interfaces:**
- Consumes: `coordinatorAllows` + `computeTopTarget` from Task 1 / Task 4.
- Produces: `getPageSetting('PurchaseCoordinator'): boolean`; `coordinatorAllows` reachable by bare name in legacy + other modules.

- [ ] **Step 1: Add the bridge import**

In `src/legacy-bridge.ts`, after line 45 (`import * as otherPraiding ...`) add:

```ts
import * as coordinator from './modules/coordinator'
```

- [ ] **Step 2: Add the bridge spread**

In the `Object.assign(globalThis, { ... })` call (line 56), add `...coordinator,` (placement is unconstrained — its globals have no placeholder-race). E.g. insert after `...otherPraiding,`.

- [ ] **Step 3: Declare the ambient seam**

In `src/game/at-legacy.d.ts`, add (mirroring the `typeof import(...)` drift-proof convention from #36):

```ts
  var coordinatorAllows: typeof import('../modules/coordinator').coordinatorAllows
  var computeTopTarget: typeof import('../modules/coordinator').computeTopTarget
```

- [ ] **Step 4: Add the toggle setting**

In `src/modules/settings-defs.ts`, add near the other Core buying toggles (e.g. after the `BuyBuildingsNew` line):

```ts
    createSetting('PurchaseCoordinator', 'Purchase Coordinator', 'EXPERIMENTAL. When on, AutoTrimps spends by computed priority instead of buying whatever it can afford — it will save up for the highest-value purchase (e.g. Coordination) instead of spending that money on lesser buys. Faithful-by-default: off = current behavior. Verify live before trusting it.', 'boolean', false, null, "Core");
```

- [ ] **Step 5: Verify typecheck + build + the frozen settings blobs**

Run: `npm run typecheck`
Expected: no errors.
Run: `npx vitest run tests/build-userscript.test.ts tests/settings*.test.ts`
Expected: PASS. (If an exact-string serializeSettings guard trips, the new `createSetting` id must be added to that frozen blob per the settings-persistence contract — update it and re-run.)

- [ ] **Step 6: Commit**

```bash
git add src/legacy-bridge.ts src/game/at-legacy.d.ts src/modules/settings-defs.ts
git commit -m "feat(#57): register coordinator module + PurchaseCoordinator toggle"
```

---

### Task 3: Wire the guard into the U1 building chokepoint (inert path)

**Files:**
- Modify: `src/modules/buildings.ts:68` (`safeBuyBuilding` affordability gate)
- Modify: `tests/buildings.characterization.test.ts` (assert the guard is inert when inactive)

**Interfaces:**
- Consumes: `coordinatorAllows(name, costResource, cost)` from Task 1.

The chokepoint is `safeBuyBuilding` — every U1 building purchase routes through it. We add the guard right after the existing affordability check (line 68), where `game.global.buyAmt` is already resolved so the cost is computable.

- [ ] **Step 1: Write the failing test**

Add to `tests/buildings.characterization.test.ts` (jsdom env — this file already opts into jsdom for the DOM-touching building fns):

```ts
it('safeBuyBuilding: coordinator guard is inert when inactive (byte-faithful)', () => {
  MODULES['coordinator'] = { active: false, topTarget: null, reserved: {} }
  // ...existing fixture setup that makes a Gym affordable...
  const before = game.buildings.Gym.owned
  safeBuyBuilding('Gym')
  expect(game.buildings.Gym.owned).toBeGreaterThan(before) // still bought — guard did nothing
})

it('safeBuyBuilding: coordinator blocks a reserved-pool lesser buy when active', () => {
  MODULES['coordinator'] = {
    active: true,
    topTarget: { kind: 'building', name: 'Warpstation' },
    reserved: { metal: game.resources.metal.owned }, // reserve ALL metal
  }
  const before = game.buildings.Gym.owned
  safeBuyBuilding('Gym') // Gym costs metal → blocked
  expect(game.buildings.Gym.owned).toBe(before)
})
```

- [ ] **Step 2: Run it and verify the second test fails**

Run: `npx vitest run tests/buildings.characterization.test.ts -t coordinator`
Expected: the "blocks a reserved-pool lesser buy" test FAILS (guard not wired yet); the "inert" test may pass trivially.

- [ ] **Step 3: Insert the guard**

In `src/modules/buildings.ts`, replace the affordability gate at line 68:

```ts
    if (!canAffordBuilding(building)) {
        postBuy2(oldBuy);
        return false;
    }
```

with:

```ts
    if (!canAffordBuilding(building)) {
        postBuy2(oldBuy);
        return false;
    }
    // #57 coordinator: defer a lesser buy that would spend resources reserved for a
    // higher-priority target. Inert (returns true) when the setting is off / no target.
    const coordCost = getBuildingItemPrice(game.buildings[building], "metal", false, game.global.buyAmt === 'Max' ? 1 : game.global.buyAmt);
    if (!coordinatorAllows(building, "metal", coordCost)) {
        postBuy2(oldBuy);
        return false;
    }
```

Note: Phase 1 reserves only the **metal** pool (the sole real cross-buyer contention per the spec); the guard checks metal cost. Non-metal buildings are unaffected because `reserved.metal` never blocks a food/wood/gem spend (the guard reads `costResource = "metal"` only, and a non-metal building's real spend is elsewhere — acceptable for Phase 1 where only Warpstation/metal is a target; broader per-resource cost lookup is Phase 3).

- [ ] **Step 4: Run it and verify both pass**

Run: `npx vitest run tests/buildings.characterization.test.ts`
Expected: PASS (all existing characterization tests still green + the 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/modules/buildings.ts tests/buildings.characterization.test.ts
git commit -m "feat(#57): coordinator guard at safeBuyBuilding chokepoint (U1)"
```

---

### Task 4: Scorer v1 — subsume the Coordination reservation

**Files:**
- Modify: `src/modules/coordinator.ts` (add `computeTopTarget`)
- Modify: `src/modules/buildings.ts:185-202` (route the existing `WarpstationCoordBuy` logic through the coordinator)
- Modify: `legacy/AutoTrimps2.js` (call `computeTopTarget()` pre-pass in `mainLoop`)
- Modify: `tests/coordinator.test.ts` (scorer unit tests)

**Interfaces:**
- Produces: `computeTopTarget(): void` — reads live game state + `getPageSetting('PurchaseCoordinator')`, writes `MODULES["coordinator"].{active, topTarget, reserved}`.

The existing `buildings.ts:185-202` block already computes *exactly* the Coordination-needs-Warpstation-metal reservation. Phase 1 lifts that computation into `computeTopTarget` so the generic guard enforces it, proving the architecture on real behavior. Behavior with the toggle **off** stays byte-identical (the old block still runs; the coordinator context stays inactive).

- [ ] **Step 1: Write the failing scorer test**

Add to `tests/coordinator.test.ts`:

```ts
import { computeTopTarget } from '../src/modules/coordinator'

describe('computeTopTarget', () => {
  beforeEach(() => {
    ;(globalThis as any).game = newGame()
    MODULES['coordinator'] = { active: false, topTarget: null, reserved: {} }
    ;(globalThis as any).getPageSettingOverride = {}
  })

  it('stays inactive when the toggle is off', () => {
    setSetting('PurchaseCoordinator', false)
    computeTopTarget()
    expect(MODULES['coordinator'].active).toBe(false)
    expect(MODULES['coordinator'].topTarget).toBeNull()
  })

  it('targets Warpstation + reserves metal when Coordination is needed but unaffordable', () => {
    setSetting('PurchaseCoordinator', true)
    // fixture: Coordination allowed>done, canAffordCoordinationTrimps() false, Warpstation affordable
    setupCoordinationNeeded(game)
    computeTopTarget()
    expect(MODULES['coordinator'].active).toBe(true)
    expect(MODULES['coordinator'].topTarget).toEqual({ kind: 'building', name: 'Warpstation' })
    expect(MODULES['coordinator'].reserved.metal).toBeGreaterThan(0)
  })
})
```

(Add small fixture helpers `setSetting` / `setupCoordinationNeeded` to `tests/harness/gameFixture.ts` if not present — `setSetting` writes into the getPageSetting override map the harness already uses; `setupCoordinationNeeded` sets `game.upgrades.Coordination.allowed = game.upgrades.Coordination.done + 1` and forces `canAffordCoordinationTrimps` false via low `trimps.realMax`.)

- [ ] **Step 2: Run it and verify it fails**

Run: `npx vitest run tests/coordinator.test.ts -t computeTopTarget`
Expected: FAIL — `computeTopTarget is not a function`.

- [ ] **Step 3: Implement `computeTopTarget`**

Add to `src/modules/coordinator.ts` (reusing the exact math from `buildings.ts:185-202` — verbatim, balance-preserving):

```ts
import { getPageSetting } from './utils'

export function computeTopTarget(): void {
  const co = MODULES["coordinator"];
  co.active = getPageSetting('PurchaseCoordinator') === true;
  co.topTarget = null;
  co.reserved = {};
  if (!co.active) return;

  // v1 candidate: the Coordination-needs-Warpstation-metal reservation (subsumes
  // the hand-coded buildings.ts WarpstationCoordBuy block). Math copied verbatim.
  const needCoord = game.upgrades.Coordination.allowed - game.upgrades.Coordination.done > 0;
  if (needCoord && !game.buildings.Warpstation.locked && canAffordBuilding("Warpstation") && !canAffordCoordinationTrimps()) {
    const toTip = game.buildings.Warpstation;
    const howMany = calculateMaxAfford(toTip, true);
    const nextCount = (game.portal.Coordinated.level) ? game.portal.Coordinated.currentSend : game.resources.trimps.maxSoldiers;
    const amtToGo = ((nextCount * 3) - game.resources.trimps.realMax());
    let increase = toTip.increase.by;
    if (game.portal.Carpentry.level && toTip.increase.what === "trimps.max") increase *= Math.pow(1.1, game.portal.Carpentry.level);
    if (game.portal.Carpentry_II.level && toTip.increase.what === "trimps.max") increase *= (1 + (game.portal.Carpentry_II.modifier * game.portal.Carpentry_II.level));
    if (amtToGo < increase * howMany) {
      co.topTarget = { kind: 'building', name: 'Warpstation' };
      co.reserved = { metal: getBuildingItemPrice(toTip, "metal", false, 1) };
    }
  }
}
```

- [ ] **Step 4: Run it and verify it passes**

Run: `npx vitest run tests/coordinator.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the pre-pass into mainLoop**

In `legacy/AutoTrimps2.js`, inside `mainLoop()` in the U1 branch, immediately before the buyer chain (before the `buyUpgrades()` call ~line 201), add:

```js
        computeTopTarget();
```

(`computeTopTarget` is reachable by bare name via the bridge — same as `buyBuildings()`.)

- [ ] **Step 6: Guard against double-application in buildings.ts**

In `src/modules/buildings.ts`, wrap the existing `WarpstationCoordBuy` block (lines 185-202) so it is skipped when the coordinator owns the reservation, keeping OFF byte-faithful:

```ts
            const getcoord = getPageSetting('WarpstationCoordBuy');
            if (getcoord && skipWarp && MODULES["coordinator"].active !== true) {
                // ...existing block unchanged...
            }
```

- [ ] **Step 7: Full suite + build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all green; `dist/autotrimps.user.js` emitted.

- [ ] **Step 8: Commit**

```bash
git add src/modules/coordinator.ts src/modules/buildings.ts legacy/AutoTrimps2.js tests/coordinator.test.ts tests/harness/gameFixture.ts
git commit -m "feat(#57): scorer v1 — subsume Coordination reservation into coordinator"
```

---

### Task 5: Live A/B verification (user-gated)

**Files:** none (verification only).

Phase 1 is behavior-changing on the ON path, which has no automated oracle (spec §Verification). This task is a manual live check the **user signs off on**.

- [ ] **Step 1:** `npm run build && npm run serve`, open `http://localhost:8080/`, load a progressed save (AT is inert without one — see memory).
- [ ] **Step 2:** With `PurchaseCoordinator` **off**, observe Coordination purchase timing / console — confirm unchanged from today (byte-faithful path).
- [ ] **Step 3:** Toggle `PurchaseCoordinator` **on**. Confirm: (a) clean console, (b) when Coordination is needed-but-unaffordable, lesser metal buildings are deferred (metal accumulates toward the Warpstation/Coordination gate) rather than being bought, (c) no stall (buys resume once Coordination is satisfied).
- [ ] **Step 4:** Hand the user the URL + what to watch; **wait for explicit approval** before FF-merge. This is the "does it actually progress faster / behave as specified" gate.

---

## Follow-on phases (own plans, per spec)

- **Phase 2 — Economy scoring:** bounded-look-ahead valuation so mines/housing score on the ΔHD-equivalent scale (the 🪨 hard part); tune horizon/cap via live A/B (user-gated).
- **Phase 3 — Broaden buyers:** guards at upgrades + equipment chokepoints; per-resource cost lookup (not metal-only); full candidate scoring.
- **Phase 4 — U2/radon:** fork the scorer for `Rbuy*` lists; guards in `RsafeBuyBuilding` + `RupgradeList`.

## Self-Review notes
- **Spec coverage:** G1 (toggle/faithful) → T2/T3; G3 (reservation) → T1/T4; G4 (per-tick recompute) → T4 pre-pass; G2 (priority spend) → T4; G5 (U2) → deferred to Phase 4 (declared U1-only in Global Constraints); G6 (all buyers) → Phases 2-4. Verification layers → T1/T3 (unit + OFF-faithful) + T5 (live A/B).
- **Metal-only reservation** in Phase 1 is a deliberate scope bound (matches the sole real contention); flagged in T3 Step 3 + Phase 3.
- **OFF byte-faithfulness** preserved by the T4 Step 6 guard on the legacy block (coordinator only owns the reservation when active).
