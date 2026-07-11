# Purchase Coordinator — Design Spec

**Issue:** [#57](https://github.com/MattAltermatt/AutoTrimps/issues/57)
**Date:** 2026-07-10 (Phase 2 feasibility postmortem added 2026-07-11)
**Status:** Phase 1 shipped. **Phase 2 PAUSED** — both candidate directions falsified by a
dueling-agent + live-Chrome investigation (see §"Phase 2 Feasibility Postmortem"). #57's real
value landed in Phase 1; there is no compelling next slice today.

---

## 🎯 Overview

Today AutoTrimps' resource *buyers* (upgrades, buildings, jobs, equipment, maps) run
**first-come-first-serve** inside `mainLoop()` (`legacy/AutoTrimps2.js:143`). Each buyer spends
whatever it can afford, the moment it can afford it. There is no cross-buyer notion of *what
matters most right now*, and no ability to **save up** — hold resources for a high-value purchase
instead of dribbling them away on lesser buys.

The **Purchase Coordinator** is an opt-in system that makes spending *priority-aware*: each tick it
scores the candidate purchases by **how much each speeds progress through zones**, buys the
highest-value one first, and **reserves resources** for a top-value item that isn't affordable yet
— blocking lesser buys from spending that money until the important thing is bought.

Because it recomputes from scratch every tick, a **manual purchase by the player** simply changes
the game state and the coordinator re-plans on the next tick — it never fights the player with a
stale plan.

### User intent (verbatim, from brainstorm)
> "I can see that there are some upgrades that I believe would be best to buy, but it seems like the
> game just buys what it can when it can. Instead I would like to have it so that it is able to
> coordinate and force a priority to make it so that we travel through the zones faster."

Decisions locked in the brainstorm:
- **Who decides priority:** the *system* computes it (not a hand-authored user list). — *option 2*
- **Adaptation:** must react to the player buying things out of the system's intended order. —
  satisfied for free by per-tick recompute.
- **Scope:** governs *all* buyers (the full vision). — *option C*, delivered incrementally.
- **Objective:** "whatever makes progress faster" = advance through zones faster.

---

## 🧱 Goals & Non-Goals

### Goals
- G1. A single opt-in toggle that, when **off**, preserves today's exact spending behavior
  (byte-faithful; the existing characterization/proof-net stays green).
- G2. When **on**, spend by computed *progress-speed value* rather than first-come-first-serve.
- G3. **Save-up / reservation:** hold resources for the current top-value target when it isn't yet
  affordable, blocking lesser buys from consuming the reserved resources.
- G4. **Manual-purchase absorption:** the plan re-derives every tick from live game state.
- G5. Works in **both universes** (U1 and radon/U2), sharing one coordinator with per-universe
  candidate scoring.
- G6. Governs all buyer families (upgrades, buildings, jobs, equipment), onboarded incrementally
  behind the same toggle.

### Non-Goals
- N1. **Multi-item tranche planning** ("save for A *and* B in ordered tranches simultaneously").
  The reservation targets a *single* top item per tick. (Justified below: buyer resource pools are
  almost entirely disjoint, so cross-buyer multi-item contention is rare.)
- N2. **Changing any game balance number.** All numeric weights/thresholds introduced here are
  *tuning* and are **user-gated** per the project's sacrosanct-tuning rule.
- N3. Porting `legacy/AutoTrimps2.js` to TypeScript. The coordinator hooks into it via the existing
  bare-name bridge seam; a full port is out of scope.
- N4. A provably-optimal allocator. This is a *greedy* priority + reservation pass, not a planner.

---

## 🔬 Key finding that shapes the architecture

A dueling-agent investigation of the real buyers established that **the buyers' resource pools are
almost entirely disjoint**:

| Buyer            | Primary resource(s)         |
|------------------|-----------------------------|
| Upgrades         | science                     |
| Jobs             | food / trimp population      |
| Buildings        | food, wood, metal, gems      |
| Weapons (equip)  | metal                        |
| Armor (equip)    | wood                         |

The **only** significant cross-buyer contention is the **metal pool** (buildings vs. weapons) and,
secondarily, **wood** (buildings vs. armor). Upgrades (science) and jobs (population) are
structurally isolated and cannot starve, or be starved by, the others.

**Consequence:** a full multi-item cross-buyer allocator would optimize contention that mostly does
not exist. The value of the feature lives in **(a)** the *scoring* (which purchase advances me
fastest) and **(b)** *single-target save-up* — not in multi-item optimization. This is why the
architecture below is a lightweight priority-injection layer rather than a purchase-path rewrite.

---

## 🏗️ Architecture — Priority-Injection Hybrid

Three integration approaches were evaluated by dueling agents (full propose/execute allocator;
fake-scarcity resource reservation; priority-injection hybrid). The **hybrid** was chosen: it
delivers the described feature at ~20% of the blast radius of the full allocator, it avoids the
fake-scarcity approach's contamination of `owned`-reading heuristics, and it *generalizes a
reservation the codebase already ships* (`buildings.ts:185` `WarpstationCoordBuy`).

### Components

**1. Coordinator context** — a shared object published on `MODULES["coordinator"]` (same pattern
other modules already use, e.g. `MODULES["upgrades"].autoGigas`):

```ts
MODULES["coordinator"] = {
  active: false,                              // the toggle (getPageSetting-backed)
  topTarget: null as null | {                 // the current highest-value target
    kind: 'upgrade' | 'building' | 'equip' | 'job',
    name: string,
  },
  reserved: {} as Record<string, number>,     // resource -> amount to keep untouched
};
```

**2. Scorer / pre-pass** — `computeTopTarget(universe)` runs once at the top of each universe's
branch in `mainLoop`, *before* the buyer chain. It enumerates candidate purchases, computes each
one's **progress-speed value** (see Scoring Model), selects the max-value candidate, and writes
`topTarget` + `reserved` into the context. Enumeration reads cost via the game's existing dry-run
price path (`getBuildingItemPrice`, `canAffordBuilding(take=false)`, equipment `Factor`) — no
purchase, no state mutation.

**3. Guard** — a small, shared predicate each buyer consults at its existing affordability gate:

```ts
function coordinatorAllows(name: string, costResource: string, cost: number): boolean {
  const co = MODULES["coordinator"];
  if (!co.active || co.topTarget == null) return true;      // inert when off → byte-faithful
  if (name === co.topTarget.name) return true;              // never block the target itself
  const keep = co.reserved[costResource] ?? 0;
  return game.resources[costResource].owned - cost >= keep; // lesser buy can't dip into the reserve
}
```

### Guard insertion points (chokepoints — verified)
Buildings funnel through **two** chokepoints, so buildings need only two edits, not one-per-item:
- `safeBuyBuilding` (`buildings.ts:46`) — U1
- `RsafeBuyBuilding` (`buildings.ts:341`) — U2

Other families get one guard each at their affordability gate:
- Upgrades: at the `upgradeList`/`RupgradeList` loop head (`upgrades.ts`)
- Equipment: inside the affordability check in `mostEfficientEquipment` (`equipment.ts`)
- Jobs: at the hire affordability gate (`jobs.ts`) — *low priority; jobs cost population, not a
  contended pool, so a jobs guard is optional in v1.*

Total: **~5-6 guard sites.**

### Generalizing the existing reservation
`buildings.ts:185-202` (`WarpstationCoordBuy`) already hand-codes a reservation: when Coordination
isn't affordable, it decides whether a Warpstation batch closes the gap and forces
`bestGemBuilding = "Warpstation"`, starving lesser gem buildings. This is `topTarget = Warpstation`
+ "block others" for exactly one hard-coded pair. The coordinator **subsumes** it: the scorer sets
`topTarget`/`reserved` generically, and the shared guard enforces the "block lesser buys" half —
now for *any* top target, not just Coordination/Warpstation.

---

## 🧮 Scoring Model — "how much does this speed progress?"

The objective is **reduce time to advance to the next zone**. Scoring is *orthogonal to
architecture* — it plugs into the hybrid identically to any other approach — and is where the
system's "intelligence" lives.

### Direct-power candidates (easy, near-exact)
Combat purchases (Coordination, gear, damage/health/block upgrades) map cleanly onto the fork's
existing combat model, which is **linear in army size** (`getTrimpAttack` multiplies by
`game.resources.trimps.maxSoldiers`, `calc.ts:63`). So a what-if is a scalar perturbation of an
already-cached calculation, **not** a re-simulation:

```
oldHD = calcHDratio()                     // hits-to-kill now (calc.ts:883)
newDmg = calcOurDmg("avg") * armyGrowth   // e.g. Coordination ≈ ×1.25
newHD  = calcEnemyHealth() / newDmg
value  = (oldHD - newHD) / costInResource // ΔHD per resource spent (lower HD = faster clears)
```

Equipment already exposes `evaluateEquipmentEfficiency → {Effect, Cost, Factor}` (`equipment.ts:140`)
— `Factor` is a ready-made value/cost ratio. Reuse it; do not recompute.

### Economy / enabling candidates (the hard part — 🪨 primary risk)
> ⚠️ **2026-07-11 correction — this approach is MISCONCEIVED. Do not build it.** See §"Phase 2
> Feasibility Postmortem". The "mines" mental model does not map onto Trimps: there is no Mine
> building; metal income is the **Miner job** (costs food, an *uncontended* pool). Crucially,
> `getPsString(res, true)` — the game's per-second income primitive — **excludes buildings
> entirely**, so "the extra income a building provides" is unreadable and the look-ahead has
> nothing to read. Smithy (the intended star economy target) is actually **direct power** (a
> compounding `getMult()` attack+health multiplier), and storage buildings produce *capacity*, not
> income. The bounded-income-look-ahead below is retained only as a record of the rejected design.

Mines (metal), housing (population), science buildings, etc. have **no immediate combat value** but
unlock power later. A naive "faster kills right now" score undervalues them and would **starve the
economy** — the failure mode all advocate agents independently flagged.

**Approach (REJECTED):** credit an economy buy by the **best power-buy it makes affordable soon** — a bounded
look-ahead, not a full planner. Concretely: value(mine) ≈ the ΔHD/resource of the best power
candidate that becomes affordable within *N* ticks of the extra income the mine provides. This
keeps economy and power on one comparable scale (ΔHD-equivalent) without simulating the whole run.

This is the part that **cannot be validated by an automated oracle** (see Verification) and will be
tuned via live A/B. The look-ahead horizon *N* and any weighting constants are **tuning →
user-gated.**

---

## 💰 Reservation, Save-Up & Anti-Stall

- **Save-up:** if `topTarget` is not yet affordable, its cost is written into `reserved`. The guard
  then blocks any *lesser* buy that would drop the relevant pool below the reserve. Cheap buys in
  *other* (uncontended) pools proceed normally.
- **Anti-stall cap:** the coordinator will not reserve indefinitely for something wildly out of
  reach. A cap (e.g. "only reserve when `topTarget` is within X% of affordable, or reachable within
  Y ticks at current income") bounds how long resources are held. **X and Y are tuning →
  user-gated.** Beyond the cap, the reserve is released and buyers proceed FCFS for that tick.
- **Single-target:** exactly one `topTarget` is reserved per tick (Non-Goal N1). The `reserved` map
  is keyed by resource so it *could* later hold multiple targets, but v1 reserves for one.

---

## 🔄 Manual-Purchase Absorption

No reconciliation state is kept. `computeTopTarget` reads live `game.resources[*].owned`,
`game.buildings[*].owned`, `game.upgrades[*].done`, etc. every tick. A manual purchase changes
those reads; the next tick's plan reflects it automatically. This is why per-tick recompute (vs. a
persisted multi-tick plan) is a hard requirement.

---

## 🎚️ Toggle & Settings (faithful-by-default)

- One setting, `PurchaseCoordinator` (default **off**), backing `MODULES.coordinator.active`.
- When off: `coordinatorAllows` returns `true` on its first line → every guard is an inert branch →
  spending order is byte-identical to today. The proof-net / characterization suite pins this.
- Follow-on tuning settings (look-ahead horizon, reserve cap %, per-category weights) are added as
  **user-gated** knobs, not chosen unilaterally.
- Settings render through the project's three render paths per the settings-render convention.

---

## 🌌 U1 / U2 Handling

- **One** shared `MODULES.coordinator` context and **one** shared guard predicate.
- Only the **scorer forks** per universe (different candidate lists / cost formulas), exactly as
  every existing buyer already forks `buy*` / `Rbuy*`.
- Guards drop into both `safeBuyBuilding`/`RsafeBuyBuilding` and both `upgradeList`/`RupgradeList`
  loops. Not "built twice" — one mechanism, two candidate sources.

---

## ✅ Verification Strategy

This is a **behavior-changing** feature, so the project's usual "output unchanged" golden-master net
is **inapplicable to the ON path by construction.** Verification is layered:

1. **OFF path — byte-faithful.** The full existing characterization / proof-net (L0 traces, golden
   masters) must stay green with the toggle off. This proves the feature is safe to ship dark.
2. **Scorer & guard — unit tests (true-TS).** `computeTopTarget` and `coordinatorAllows` are pure
   enough to unit-test directly: given a fixture game state, assert the chosen `topTarget`, the
   `reserved` map, and that the guard blocks exactly the reserved-pool lesser buys and nothing else.
3. **ON path — live Chrome A/B.** The only true validation that it "makes progress faster" is
   running the game clone (`../trimps-game`, v5.10.1) with the coordinator **off vs. on** and
   comparing zone-clear timing. **The user signs off on this comparison** — automated tests cannot
   certify the progression is faster, only that the mechanism behaves as specified.

---

## 🚚 Phased Delivery

The full vision (C — all buyers) ships incrementally behind the single toggle. Each phase is
independently verifiable (OFF byte-faithful + its own unit tests) and live-checkable.

- **Phase 1 — Foundation.** `MODULES.coordinator` context, the `coordinatorAllows` guard, the
  `PurchaseCoordinator` toggle, and the `computeTopTarget` pre-pass skeleton wired into `mainLoop`
  for **U1 buildings only** (the metal-contention core). Subsume `WarpstationCoordBuy` into the
  generic reservation. Scorer v1 covers direct-power candidates (Coordination + gear via existing
  `Factor`). Prove OFF byte-faithful; live A/B the Coordination save-up case.
- **Phase 2 — Economy scoring. ⛔ PAUSED (2026-07-11).** Add the bounded-look-ahead economy
  valuation so mines/housing are scored on the ΔHD-equivalent scale. Tune horizon/cap via live A/B
  (user-gated). — *Both this approach and a pivot to "U1 Smithy automation" were falsified on
  inspection; see §"Phase 2 Feasibility Postmortem". No compelling Phase 2 slice remains.*
- **Phase 3 — Broaden buyers.** Add guards to upgrades and equipment chokepoints; extend scoring to
  the full candidate set. Jobs optional (uncontended pool).
- **Phase 4 — U2 / radon.** Fork the scorer for `Rbuy*` candidate lists; add guards to
  `RsafeBuyBuilding` and `RupgradeList`. Reuse the shared context/guard.

---

## 🔬 Phase 2 Feasibility Postmortem (2026-07-11)

A brainstorm to build Phase 2 ran three rounds of dueling agents (advocates + a dedicated
premise-falsifying adversary each round) plus live-Chrome verification against `../trimps-game`.
**Every candidate direction dissolved on inspection.** Recording the dead ends so they are not
rediscovered:

**1. Economy-income look-ahead (the spec's original Phase 2) — MISCONCEIVED.**
The "credit a building by the income it unlocks" mechanism cannot be built: Trimps has no Mine;
metal income is the Miner *job* (food-costed, uncontended); and `getPsString(res, true)` — the
only per-second income primitive — **excludes buildings**, so a new building's "extra income" is
unreadable. Smithy (the intended economy star) is actually **direct power** (compounding
`getMult()` on attack+health), and storage buildings raise *capacity*, not income. There is no
income signal for the look-ahead to consume.

**2. Pivot to "U1 Smithy automation" (auto-buy + save-up) — IMPOSSIBLE.**
Smithy looked like the one crisp, high-value save-up target, and U2 has three Smithy systems
(`RbuyBuildings` town-buy, `smithylogic` save-up, `RsmithyFarm` maps) while U1 has none — seemingly
a parity gap. But **U1 physically cannot build Smithy**: the building is `blockU1: true` /
`locked: 1` (`config.js:11703`), both `unlockBuilding("Smithy")` paths are U2-only, and
`main.js:10275` skips the unlock when `universe == 1`. U1's only Smithy source is the free
`SmithFree` map reward (z50 Melting Point, `canRunOnce`, +1–2). So there is nothing to town-buy,
nothing to save up *for*, and no count to farm toward. All three U2 Smithy systems are R-prefixed
by necessity, not omission. *(A first live "verification" that force-set `Smithy.locked = 0` masked
this rule and auto-saved the mutation — the round-3 adversary caught it by reading the game def.
Lesson recorded in memory: don't poke game flags you haven't understood.)*

**3. Was a general power scorer worth building anyway? — Marginal.**
The round-1 value-adversary (78% conf) argued the buyers' resource pools are largely disjoint
(only metal is contended, and loop-order already gives buildings first claim), equipment already
buys best-`Factor`-first, and Phase 1 already subsumed the one dominant save-up case
(Coordination/Warpstation). The incremental value of a broader scorer over what already ships is
thin.

**Conclusion:** #57's real value landed in **Phase 1**. Phase 2 is paused. The only physically-real
U1 Smithy automation that could exist is scheduling the z50 Melting Point map for the free
Smithies (marginal, `canRunOnce` — backlog-sized at most). Phases 3–4 (broaden buyers / U2 fork)
remain *possible* but have no demonstrated payoff. #57 stays open; revisit only if live play
surfaces a concrete, verified priority/contention symptom.

---

## ⚠️ Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Economy undervaluation** starves the run (🪨 primary) | Bounded look-ahead credits enabling buys; tune via live A/B; ship power-only scoring first (Phase 1) so the risky part is isolated to Phase 2. |
| **ON-path has no automated oracle** | Unit-test scorer/guard deterministically; gate ON-behavior on live A/B with user sign-off; keep OFF byte-faithful as the always-available fallback. |
| **Guard subtly diverges OFF behavior** | Guard's first line returns `true` when inactive; characterization fixtures assert "OFF == legacy" per guard site. |
| **Thrashing** (target flips each tick) | Per-tick recompute is required for manual-absorb, but add hysteresis/dwell if live testing shows flip-flop. Hysteresis constant is tuning → user-gated. |
| **Tuning creep** | All weights/horizons/caps are explicitly user-gated; the spec introduces *mechanism*, numbers are the user's call. |

---

## 🔓 Open Questions (resolve during implementation / live A/B)

- Exact form of the economy look-ahead credit (horizon *N*, whether to discount).
- Reserve cap shape (percent-affordable vs. ticks-to-afford vs. both).
- Whether jobs need a guard at all (likely not — uncontended).
- Whether hysteresis is needed (decide from live thrashing observation, not preemptively).
