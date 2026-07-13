// @vitest-environment node
//
// Regression net for #77 — two crash/livelock defects in the AB (Spire Assault) block, both
// reached from the same unguarded mainLoop dispatch (legacy/AutoTrimps2.js:313-320). mainLoop has
// NO try/catch (#87), so a throw here silently decapitates every automation ordered after it,
// every tick, forever.
//
// These tests boot the REAL v5.10.1 clone in jsdom and drive the REAL `autoBattle` object — its
// own items table, its own equip()/loadPreset()/upgradeCost()/getMaxItems(). Nothing is mocked, so
// the game's actual semantics (equip() has a MAX guard but no MINIMUM; presets default to []) are
// what is under test, not my model of them.
import { describe, it, expect, beforeEach } from 'vitest'
import { bootGame } from '../scripts/sim/boot.mjs'
import { TEST_BUNDLE } from './sim/bundle'

function boot() {
  const { window } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE }) as unknown as {
    window: Record<string, any>
  }
  return { window, ab: window.autoBattle }
}

const equippedNames = (ab: any): string[] =>
  Object.keys(ab.items).filter((i) => ab.items[i].equipped)

describe('#77 Defect A — ABdustsimple / ABdustsimplenonhid must not crash on an empty filter', () => {
  let window: Record<string, any>
  let ab: any

  beforeEach(() => {
    ;({ window, ab } = boot())
    ab.dust = 1e12 // afford everything, so the guard is the ONLY thing standing between us and the deref
  })

  it('POSITIVE CONTROL: the fixture really is the game, and the happy path really upgrades', () => {
    // Anti-false-green: if the boot were broken these tests would "pass" by never reaching the code.
    expect(typeof ab.upgradeCost).toBe('function')
    expect(typeof ab.equip).toBe('function')
    expect(equippedNames(ab)).toEqual(['Sword', 'Pants']) // the game's real default loadout
    const before = ab.items.Sword.level + ab.items.Pants.level
    window.ABdustsimple()
    expect(ab.items.Sword.level + ab.items.Pants.level).toBeGreaterThan(before)
  })

  it('ABdustsimple survives a zero-item loadout (the player unequipped everything)', () => {
    // objects.js:3573 equip() guards only the MAXIMUM — the game lets you unequip down to zero.
    for (const i of Object.keys(ab.items)) if (ab.items[i].equipped) ab.equip(i)
    expect(equippedNames(ab)).toEqual([])

    expect(() => window.ABdustsimple()).not.toThrow()
  })

  it('ABdustsimple survives AT blanking the loadout itself via an unsaved preset', () => {
    // Presets default to [] (objects.js:656-661) and loadPreset() blanks the loadout BEFORE
    // re-adding from the preset (objects.js:930-938) — so loading a never-saved slot zeroes it.
    // ABswitch (ab.ts) calls loadPreset with no populated-slot check, one mainLoop line ABOVE
    // ABdustsimple: AT can blank the loadout and crash on it within the same tick.
    expect(ab.presets.p1).toEqual([])
    ab.loadPreset('p1')
    expect(equippedNames(ab)).toEqual([])

    expect(() => window.ABdustsimple()).not.toThrow()
  })

  it('ABdustsimplenonhid survives every item being equipped-or-hidden', () => {
    for (const i of Object.keys(ab.items)) ab.items[i].hidden = true
    expect(() => window.ABdustsimplenonhid()).not.toThrow()
  })
})

describe('#77 Defect B — ABsolver must reach a fixpoint when a target item is unowned', () => {
  it('does not re-equip (and so does not resetCombat) forever at maxEnemyLevel 7 without Labcoat', () => {
    const { window, ab } = boot()

    // The level-7 target list (ab.ts) is
    //   ['Fists_of_Goo','Battery_Stick','Putrid_Pouch','Chemistry_Set','Labcoat']
    // and Labcoat/Chemistry_Set/Putrid_Pouch are zone-gated (90/81/78) — a player at SA level 7 is
    // nowhere near them. So the solver's own recipe names items it cannot possibly equip.
    ab.maxEnemyLevel = 7
    ab.enemyLevel = 7
    ab.dust = 0 // isolate: nothing is affordable, so ONLY the equip block can act
    expect(ab.items.Labcoat.owned).toBe(false)

    let equipCalls = 0
    let resetCalls = 0
    const realEquip = ab.equip.bind(ab)
    ab.equip = (i: string) => {
      equipCalls++
      return realEquip(i)
    }
    const realReset = ab.resetCombat.bind(ab)
    ab.resetCombat = (...a: unknown[]) => {
      resetCalls++
      return realReset(...a)
    }

    // Tick 1 is allowed to act — it is the genuine target change that settles the loadout.
    window.ABsolver()
    expect(equipCalls).toBeGreaterThan(0)
    const settled = equippedNames(ab)
    expect(settled).toEqual(['Fists_of_Goo', 'Battery_Stick']) // the owned subset of the recipe

    // Every subsequent tick, with NOTHING changed, must be a no-op. Before the fix each one called
    // equip() twice and resetCombat() twice — and resetCombat rebuilds both combatants and zeroes
    // battleTime (objects.js:3200-3204), so the SA fight restarted from full enemy health forever.
    for (let tick = 2; tick <= 5; tick++) {
      equipCalls = 0
      resetCalls = 0
      window.ABsolver()
      expect(equipCalls, `tick ${tick} re-equipped — ABsolver has not converged`).toBe(0)
      expect(resetCalls, `tick ${tick} called resetCombat — the SA fight restarts every tick`).toBe(0)
      expect(equippedNames(ab)).toEqual(settled)
    }
  })

  it('still APPLIES a genuine target change (the guard must not freeze the solver)', () => {
    // Anti-false-green for the fix itself: a guard that never fires would also pass the test above.
    const { window, ab } = boot()
    ab.maxEnemyLevel = 7
    ab.enemyLevel = 7
    ab.dust = 0

    window.ABsolver()
    expect(equippedNames(ab)).toEqual(['Fists_of_Goo', 'Battery_Stick'])

    // The player now owns Putrid_Pouch — the recipe's third entry. The solver must pick it up.
    ab.items.Putrid_Pouch.owned = true
    window.ABsolver()
    expect(equippedNames(ab)).toContain('Putrid_Pouch')
  })
})
