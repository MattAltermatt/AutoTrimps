import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installSeededRandom } from '../../scripts/sim/seededRandom.mjs'
import { installFrozenClock } from '../../scripts/sim/clock.mjs'
import { stepWithAT } from '../../scripts/sim/driver.mjs'
import { TEST_BUNDLE } from './bundle'

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// #142 — the early-run "spinning wheels" stall, and its opt-in fix (ReserveFoundationUpgrades).
//
// On a fresh post-portal run the Miners upgrade (which unlocks the metal/mining economy) is blocked
// only by wood (300). Shield armor ALSO costs wood, and the Artisanistry perk discounts the Shield
// *level* below 300 while leaving the upgrade at full price — so autoLevelEquipment (which runs before
// buyUpgrades every tick) skims wood onto Shield before it can ever reach 300. On this real save
// (portal 18, Balance challenge, world 2) AT grinds Shield for ~2,400 ticks before Miners squeaks
// through. The reserve holds wood back from the equipment buyer while a foundational upgrade is one
// resource away, so Miners lands almost immediately.
//
// This is a MUTATION-CHECKED behavioural net, not a shape assertion. The OFF arm is the positive
// control: it must show the stall. If someone removes the `reserveAllowsEquip` guards, the two arms
// converge and the `on < off / 3` assertion goes red. Deterministic via installSeededRandom, so the
// tick numbers are stable run-to-run (an unseeded A/B drifts — see the CLAUDE.md sim notes).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const SAVE = readFileSync(resolve('tests/fixtures/saves/p18-z2-balance-stall.txt'), 'utf8').trim()
// The user's real exported settings — the stall only reproduces under a real config, not AT defaults.
const SETTINGS = readFileSync(resolve('tests/fixtures/at-settings/p18-z2-balance-stall.json'), 'utf8')
const SEED = 1
const MAX_TICKS = 4000

function runArm(reserveOn: boolean) {
    const { window, game } = bootGame({
        withAutoTrimps: true,
        atBundlePath: TEST_BUNDLE,
        saveString: SAVE,
        atSettingsBlob: SETTINGS,
        // Pin the boot clock to the save's own lastOnline so the offline gap is 0 (#146). Without this,
        // load() replays offline progress against the REAL wall clock; once elapsed time since the
        // fixture's capture crosses the 24h cap it grants a maxed ~13.5k wood, erasing the wood-starved
        // stall this test depends on (raw wood is 81) and making off.minersTick collapse to 0.
        fixedNow: 'lastOnline',
    })
    installSeededRandom(window, SEED)
    installFrozenClock(window)
    window.setPageSetting('ReserveFoundationUpgrades', reserveOn)

    let minersTick = -1
    for (let t = 0; t < MAX_TICKS; t++) {
        stepWithAT(window, 1)
        if (minersTick < 0 && game.upgrades.Miners.done > 0) minersTick = t
    }
    return {
        minersTick,
        world: game.global.world,
        shield: game.equipment.Shield.level,
    }
}

describe('#142 foundational-upgrade reserve', () => {
    it('lands Miners far sooner with the reserve on, without under-arming AT', () => {
        const off = runArm(false)
        const on = runArm(true)

        // Positive control: without the reserve, Shield wood-leveling starves Miners for thousands of
        // ticks. If this assertion fails, the stall no longer reproduces and the test proves nothing.
        expect(off.minersTick).toBeGreaterThan(1500)

        // Treatment: the reserve holds wood and Miners lands almost immediately (5.8x sooner in
        // practice). `on < off / 3` is the mutation tripwire — delete the guards and the arms converge.
        expect(on.minersTick).toBeGreaterThan(0)
        expect(on.minersTick * 3).toBeLessThan(off.minersTick)

        // Survival: reserving wood from Shield does NOT leave AT under-armored. Both arms advance the
        // same distance in MAX_TICKS and the reserve arm ends with a comparable Shield level (the early
        // economy funds gear back). If the reserve starved survival gear this would collapse.
        expect(on.world).toBeGreaterThanOrEqual(off.world)
        expect(on.shield).toBeGreaterThan(off.shield - 3)
    })
})
