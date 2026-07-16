// #142 — Reserve resources for foundational economy upgrades so the early run stops "spinning
// wheels". On a fresh post-portal run the Miners upgrade (which unlocks the metal/mining economy)
// costs 300 wood, but Shield armor ALSO costs wood and the Artisanistry perk discounts the Shield
// *level* below 300 while leaving the upgrade at full price — so the equipment leveler (which runs
// before buyUpgrades every tick, main-loop.ts) skims wood on Shield before it can ever reach 300.
// The result is ~4 real minutes of Shield-leveling at world 2 before Miners finally squeaks through.
//
// The fix is a reservation guard on the equipment buyers ONLY: hold back a resource when an
// available, unbought foundational upgrade is blocked *solely* in that resource. Opt-in
// (ReserveFoundationUpgrades, default off) → the reserve is always 0 → behaviour is byte-identical.
import { getPageSetting } from './utils'

// Foundational, effectively one-shot economy upgrades whose wood/metal blocker stalls the early run.
// COORDINATION IS DELIBERATELY EXCLUDED: it is repeatable (allowed grows with world), so it would keep
// the reserve armed into the deep game and risk starving weapons, and #57 measured that reserving for
// it buys zero extra progress (its purchases are gated by the game's `allowed` counter, not resources).
const RESERVE_UPGRADES = ['Miners', 'Speedminer', 'Speedlumber', 'Speedfarming', 'Speedscience', 'Efficiency']

// The only resources the equipment leveler spends that also gate these upgrades. Each maps to the job
// that produces it — used by the anti-deadlock guard below. Lumberjack exists from the first tick;
// Miner is locked until the Miners upgrade, so metal is never reserved before there is metal income.
const PRODUCER: Record<string, string> = { wood: 'Lumberjack', metal: 'Miner' }

// Mirror the game's resolvePow (main.js:4702): floor(base * ratio^done) for a [base, ratio] cost, or
// the flat number for a fixed cost. Keeps the reserve equal to what buyUpgrade will actually charge —
// deliberately the UNDISCOUNTED upgrade price, since Artisanistry does not apply to these upgrades.
function resolveUpgradeCost(cost: any, done: number): number {
    if (cost === undefined) return 0
    return typeof cost === 'number' ? cost : Math.floor(cost[0] * Math.pow(cost[1], done))
}

// Largest amount of `resource` any AVAILABLE, unbought foundational upgrade needs, counting only
// upgrades already affordable in every OTHER cost resource — i.e. `resource` is that upgrade's SOLE
// remaining blocker. Returns 0 (no hold) when the setting is off, the resource has no active producer,
// or nothing qualifies. `max`, never `sum`: several upgrades sharing wood can't stack into a wall.
export function foundationalUpgradeReserve(resource: string): number {
    if (!getPageSetting('ReserveFoundationUpgrades')) return 0
    const producer = PRODUCER[resource]
    if (!producer) return 0
    // Anti-deadlock: never hold a resource with no active producer (zero income would make the hold
    // permanent — the upgrade could never become affordable).
    const job = game.jobs[producer]
    if (!job || job.locked || job.owned <= 0) return 0

    let reserve = 0
    for (const name of RESERVE_UPGRADES) {
        const up = game.upgrades[name]
        if (!up || up.locked || up.allowed <= up.done) continue
        const res = up.cost?.resources
        if (!res) continue
        const need = resolveUpgradeCost(res[resource], up.done)
        if (need <= 0) continue
        // Sole-blocker gate = the anti-deadlock rule: only reserve when every OTHER cost resource is
        // already satisfied. If two resources are simultaneously short, neither is held, the buyers
        // spend freely, and resources refill until exactly one remains short.
        const soleBlocker = Object.keys(res).every(
            r => r === resource || (game.resources[r]?.owned ?? 0) >= resolveUpgradeCost(res[r], up.done),
        )
        if (soleBlocker) reserve = Math.max(reserve, need)
    }
    return reserve
}

// True if spending `cost` of `resource` on gear still leaves the foundational-upgrade reserve intact.
// Gated ONLY on the equipment buyers — never on housing/buildings (measured: gating housing starves
// population, which is the real early-game lever, and is a net slowdown).
//
// When there is nothing to reserve (setting off, or no qualifying upgrade) this MUST be a pure
// pass-through: `cost` is the caller's separately-recomputed, Math.ceil'd next-level price, which can
// exceed what canAffordBuilding/buyEquipment actually charge on an exact-affordability tick — so
// comparing against it would falsely block a buy the caller already approved. Only enforce the compare
// when the reserve is genuinely positive.
export function reserveAllowsEquip(resource: string, cost: number): boolean {
    const reserve = foundationalUpgradeReserve(resource)
    if (reserve <= 0) return true
    return game.resources[resource].owned - cost >= reserve
}
