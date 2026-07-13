// Purchase Coordinator (#57) — priority-aware, opt-in spending layer.
// Spec:  docs/superpowers/specs/2026-07-10-purchase-coordinator-design.md
// Plan:  docs/superpowers/plans/2026-07-10-purchase-coordinator-phase1.md
//
// Today AutoTrimps' resource buyers run first-come-first-serve: whoever runs first spends what it
// can afford. This layer lets the automation instead SAVE UP for the highest-value purchase. The
// context is published on MODULES["coordinator"] (the same registry pattern every converted module
// uses); buyers consult `coordinatorAllows` at their affordability gate. Faithful-by-default:
// inactive OR no target → the guard allows everything, so spending is byte-identical to today.
import { getPageSetting } from './utils'

MODULES["coordinator"] = {
  active: false,
  topTarget: null as null | { kind: 'upgrade' | 'building' | 'equip' | 'job'; name: string },
  reserved: {} as Record<string, number>,
};

/**
 * The reservation guard. Returns true (allow the buy) unless the coordinator is active with a
 * top-priority target and this buy is a *lesser* one that would spend resources reserved for the
 * target — in which case it returns false so the caller defers, letting the reserve accumulate.
 */
export function coordinatorAllows(name: string, costResource: string, cost: number): boolean {
  const co = MODULES["coordinator"];
  if (!co.active || co.topTarget == null) return true;      // inert when off → byte-faithful
  if (name === co.topTarget.name) return true;              // never block the target itself
  const keep = co.reserved[costResource] ?? 0;
  return game.resources[costResource].owned - cost >= keep; // lesser buy can't dip into the reserve
}

/**
 * #94 — the ONE building-buy chokepoint. Every AT building purchase, in either universe, asks this
 * before it calls the native `buyBuilding()`.
 *
 * It exists because `coordinatorAllows` needs a *price*, and pricing a building is three lines of
 * game-API knowledge (does it even cost metal? what does N of them cost?) that were previously
 * inlined in `safeBuyBuilding` only — which is the U1 path. `RbuyBuildings` (U2) called
 * `buyBuilding()` directly seven times and `RbuyStorage` once, so the coordinator never saw a single
 * U2 purchase. Anything that needs to spend now goes through here, so a new buy site cannot silently
 * re-open the hole.
 *
 * `amt` is the number of units about to be bought — pass what you pass to `buyBuilding`'s forceAmt,
 * NOT the ambient `game.global.buyAmt` (see #83 §1: that flag is a player UI preference).
 *
 * Faithful-by-default: inactive → `true` before any game call, so the OFF path adds one boolean read.
 * Non-metal buildings are allowed unconditionally — Phase 1 reserves the metal pool only, and asking
 * `getBuildingItemPrice` for a resource a building does not cost makes the native throw.
 */
export function coordinatorAllowsBuilding(building: string, amt: number): boolean {
  const co = MODULES["coordinator"];
  if (!co?.active) return true;
  if (game.buildings[building]?.cost?.metal === undefined) return true;
  const metalCost = getBuildingItemPrice(game.buildings[building], "metal", false, amt);
  return coordinatorAllows(building, "metal", metalCost);
}

/**
 * Per-tick pre-pass (called from mainLoop before the buyers run). Reads live game state and the
 * `PurchaseCoordinator` toggle, and writes the current top-priority target + resource reserve into
 * the context. Recomputing from scratch each tick is what lets a manual player purchase be absorbed
 * — the next tick simply re-plans against the new state.
 *
 * Phase 1 scorer (U1) — the save-up loop for Coordination:
 *   1. When Coordination has a pending level but the trimps for it aren't yet affordable, and there
 *      is still a population gap that Warpstations (which raise max population) can close, mark
 *      Warpstation as the top target and reserve one Warpstation's metal. The guard then makes lesser
 *      metal buildings (Gym/Tribute/…) DEFER, so metal accumulates across ticks toward a Warpstation.
 *   2. The instant a Warpstation is actually affordable, buy it directly (it is the target, so the
 *      reservation guard never blocks it) — this is the GUARANTEED RELEASE: the reserved metal always
 *      converts into population rather than being held indefinitely. The loop self-terminates once
 *      canAffordCoordinationTrimps() flips true.
 * When the toggle is OFF this returns immediately (active=false) → the guard stays inert → behavior is
 * byte-identical (the OFF-path proof-net traces reproduce). No balance numbers are introduced.
 */
export function computeTopTarget(): void {
  const co = MODULES["coordinator"];
  co.active = getPageSetting('PurchaseCoordinator') === true;
  co.topTarget = null;
  co.reserved = {};
  if (!co.active) return;

  const needCoord = game.upgrades.Coordination.allowed - game.upgrades.Coordination.done > 0;
  if (!needCoord || game.buildings.Warpstation.locked || canAffordCoordinationTrimps()) return;

  const toTip = game.buildings.Warpstation;
  if (toTip.increase.what !== "trimps.max") return; // must actually add population to help Coordination

  // Population still owed for the next Coordination send (gap math mirrors the legacy block).
  const nextCount = (game.portal.Coordinated.level) ? game.portal.Coordinated.currentSend : game.resources.trimps.maxSoldiers;
  const amtToGo = (nextCount * 3) - game.resources.trimps.realMax();
  if (amtToGo <= 0) return; // population already covers the next send — nothing to save up for

  // (1) reserve so metal accumulates toward the Warpstation instead of leaking to lesser buys.
  co.topTarget = { kind: 'building', name: 'Warpstation' };
  co.reserved = { metal: getBuildingItemPrice(toTip, "metal", false, 1) };

  // (2) guaranteed release: delegate the buy to safeBuyBuilding. It forces its OWN buyAmt (1, or the
  // DecaBuild/DoubleBuild bonus) and re-checks affordability internally, buying iff affordable and
  // no-op'ing otherwise — so the release is NOT coupled to the player's ambient UI buy-amount
  // (a bare canAffordBuilding() here would use game.global.buyAmt and re-stall for anyone on 10/25/Max).
  // Warpstation is the target, so the reservation guard never blocks this call.
  safeBuyBuilding("Warpstation");
}
