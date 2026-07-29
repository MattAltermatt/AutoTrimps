// @vitest-environment node
//
// Regression net for #163 — a U2 AutoPerks respec permanently zeroed Masterfulness, Smithology and
// Expansion. The highest-consequence non-security finding in the whole review set: the player loses
// perk levels irreversibly, one respec per run, with no signal.
//
// `RAutoPerks.perkHolder` names 22 perks; the pinned clone's `game.portal` carries 26 entries with a
// `radLevel`. Overkill is force-`radLocked` by the 5.4.0 migration so it filters out correctly, but the
// other three are unlockable U2 perks AT has no model for — `getOwnedPerks` resolves them to
// `undefined` and drops them, so they never reach the re-buy loop. `clearPerks()` sets
// `levelTemp = -getPerkLevel(item)` for EVERY unlocked U2 perk, and `commitPortalUpgrades(true)` then
// does `radLevel += levelTemp`, so anything not re-bought is committed to zero.
//
// Second-order harm from the same root: `getRadon()` counted those perks' `radSpent` as spendable, so
// even WITHOUT a respec AT over-planned by exactly that amount and the tail purchases failed silently
// inside `buyPortalUpgrade`'s own `canSpend >= price` check.
//
// The fix is deliberately mechanism-only. Adding the three to `perkHolder` would mean inventing ratio
// values for them, which is a balance decision — not one a bug fix gets to make.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { bootGame } from '../scripts/sim/boot.mjs'
import { TEST_BUNDLE } from './sim/bundle'

const UNMODELLED = ['Masterfulness', 'Smithology', 'Expansion']

function bootU2(): Record<string, any> {
  const { window } = bootGame({}) as unknown as { window: Record<string, any> }
  window.game.global.universe = 2
  Object.assign(window, {
    GM_getValue: () => undefined,
    GM_setValue: () => {},
    GM_xmlhttpRequest: () => {},
    unsafeWindow: window,
  })
  window.eval(readFileSync(TEST_BUNDLE, 'utf8'))
  window.loadPageVariables?.()
  return window
}

/** Unlock the three unmodelled perks and invest in them, as a real U2 save would. */
function unlockUnmodelled(game: any, radLevel = 5, radSpent = 1000): void {
  for (const name of UNMODELLED) {
    game.portal[name].radLocked = false
    game.portal[name].radLevel = radLevel
    game.portal[name].radSpent = radSpent
    game.portal[name].levelTemp = 0
  }
}

describe('#163 — a respec must not zero perks AT does not model', () => {
  let window: Record<string, any>
  let game: any
  let RAutoPerks: any

  beforeEach(() => {
    window = bootU2()
    game = window.game
    RAutoPerks = window.RAutoPerks
  })

  it('POSITIVE CONTROL: the clone really has more radLevel perks than AT models', () => {
    // Anti-false-green, and the finding's own arithmetic re-derived from the fixture rather than
    // trusted. If these ever match, the bug is structurally gone and this suite is measuring nothing.
    const radPerks = Object.keys(game.portal).filter(
      (k) => typeof game.portal[k].radLevel !== 'undefined',
    )
    expect(radPerks.length).toBe(26)
    expect(RAutoPerks.perkHolder.length).toBe(22)

    // Overkill is the one legitimate omission — the 5.4.0 migration force-radLocks it forever.
    expect(game.portal.Overkill.radLocked).toBe(true)
    for (const name of UNMODELLED) {
      expect(game.portal[name]).toBeDefined()
      expect(RAutoPerks.getPerkByName(name)).toBeUndefined() // genuinely unmodelled
    }
  })

  it('getUnmodelledPerks finds exactly the unlocked perks AT cannot plan for', () => {
    expect(RAutoPerks.getUnmodelledPerks()).toEqual([]) // nothing unlocked yet

    unlockUnmodelled(game)
    const found = RAutoPerks.getUnmodelledPerks()

    expect(found.map((p: any) => p.name).sort()).toEqual([...UNMODELLED].sort())
    for (const p of found) expect(p.radLevel).toBe(5)

    // Overkill stays out even though it is also unmodelled — it is radLocked, so there is nothing
    // invested in it to lose. Derived from the same walk, not special-cased.
    expect(found.map((p: any) => p.name)).not.toContain('Overkill')
  })

  it('getUnmodelledPerks ignores an unlocked perk with nothing invested', () => {
    unlockUnmodelled(game, 0, 0)
    expect(RAutoPerks.getUnmodelledPerks()).toEqual([])
  })

  it('getRadon EXCLUDES unmodelled perks from the spendable budget', () => {
    // The no-respec half of the harm. Their radSpent is not AT's to re-plan.
    const before = RAutoPerks.getRadon()

    unlockUnmodelled(game, 5, 1000)
    const after = RAutoPerks.getRadon()

    expect(after).toBe(before) // 3 x 1000 radon must NOT have joined the budget
  })

  it('getRadon still counts perks AT DOES model', () => {
    // Parity half — the exclusion must not become "count nothing", which would pass the test above
    // just as well while breaking every allocation.
    const modelled = Object.keys(game.portal).find(
      (k) => typeof game.portal[k].radLevel !== 'undefined' && RAutoPerks.getPerkByName(k),
    )!
    expect(modelled).toBeDefined()
    game.portal[modelled].radLocked = false
    game.portal[modelled].radSpent = 0

    const before = RAutoPerks.getRadon()
    game.portal[modelled].radSpent = 777
    expect(RAutoPerks.getRadon()).toBe(before + 777)
  })

  it('a respec RESTORES the unmodelled perks instead of committing them to zero', () => {
    // End to end through the game's own clearPerks()/buyPortalUpgrade(), which is where the loss
    // actually happened. Nothing about the mechanism is mocked.
    unlockUnmodelled(game, 5, 1000)
    game.global.canRespecPerks = false // already respecced this run; skip the respecPerks() call
    game.global.respecActive = true
    game.global.viewingUpgrades = true
    // Make the budget non-binding, so this test isolates the RESTORE MECHANISM rather than
    // re-testing the game's pricing curve. That is faithful rather than generous: clearPerks()
    // returns every unlocked perk's own radSpent to `respecMax` (main.js:3374), including these
    // three, so in production the radon needed to put them back is exactly the radon they just
    // released. A fixture with radSpent smaller than the true price (Masterfulness at radLevel 5 is
    // ~6.4e29 radon) is self-inconsistent and fails on affordability for reasons unrelated to #163.
    game.resources.radon.owned = 1e40
    game.global.radonLeftover = 1e40

    // ⚠️ clearPerks() and isPerkUnlocked() branch on `portalUniverse` (main.js:3370, 2394), a global
    // SEPARATE from game.global.universe that the game sets when the portal screen opens. Without it
    // the U2 arm is never entered, levelTemp is never written, and this test passes just as well
    // against a build with the restore loop deleted — which is exactly what the first version of it
    // did, and what mutation-testing caught.
    window.portalUniverse = 2
    expect(window.isPerkUnlocked('Masterfulness', true)).toBe(true)

    RAutoPerks.applyCalculationsRespec(RAutoPerks.getOwnedPerks(), 1e12)

    for (const name of UNMODELLED) {
      // The load-bearing assertion, expressed the way the game commits it: activatePortal() ->
      // commitPortalUpgrades(true) does `radLevel += levelTemp` (main.js:3554). Pre-fix, clearPerks()
      // left levelTemp at -5 and nothing re-bought these, so the commit took radLevel to 0.
      const committed = game.portal[name].radLevel + (game.portal[name].levelTemp ?? 0)
      expect([name, committed]).toEqual([name, 5])
    }
  })
})
