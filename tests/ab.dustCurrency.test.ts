// @vitest-environment node
//
// Regression net for #164 — both dust buyers ranked candidates on the raw `upgradeCost` number and
// then committed to `equips[0]`, but that price is denominated in the ITEM's own currency. The game
// picks the currency in `upgrade()` (objects.js:3662) as `dustType == "shards" ? shards : dust`,
// while AT gated on `autoBattle.dust` alone. The two shard items price at the table minimum of 5, so
// they won the ranking permanently, `upgrade()` bailed at its own `currency < cost`, and no dust item
// was ever attempted again — the ranking is a pure function of state, so the same loser was re-picked
// every tick, forever.
//
// Boots the REAL v5.10.1 clone and drives the REAL `autoBattle`: its own items table, its own
// upgradeCost()/upgrade(), its own dustType and noUpgrade flags. The failure modes under test are
// the game's, not a model of them.
import { describe, it, expect, beforeEach } from 'vitest'
import { bootGame } from '../scripts/sim/boot.mjs'
import { TEST_BUNDLE } from './sim/bundle'

function boot() {
  const { window } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE }) as unknown as {
    window: Record<string, any>
  }
  return { window, ab: window.autoBattle }
}

const levels = (ab: any): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const k of Object.keys(ab.items)) out[k] = ab.items[k].level
  return out
}

const changedLevels = (before: Record<string, number>, ab: any): string[] =>
  Object.keys(before).filter((k) => ab.items[k].level !== before[k])

describe('#164 — the dust buyers must price each candidate in its OWN currency', () => {
  let window: Record<string, any>
  let ab: any

  beforeEach(() => {
    ;({ window, ab } = boot())
  })

  it('POSITIVE CONTROL: the clone really carries the shard/noUpgrade item table', () => {
    // Anti-false-green. If these flags were absent from the fixture the whole suite would "pass" by
    // testing a game that cannot exhibit the bug. Verified against .trimps-game/objects.js:2628/2668.
    expect(ab.items.Doppelganger_Signet.dustType).toBe('shards')
    expect(ab.items.Doppelganger_Signet.noUpgrade).toBe(true)
    expect(ab.items.Doppelganger_Diadem.dustType).toBe('shards')
    expect(ab.items.Doppelganger_Diadem.noUpgrade).toBe(true)
    // The game's own upgrade() has NO noUpgrade guard and NO owned guard — that is why AT needs one.
    expect(String(ab.upgrade)).not.toContain('noUpgrade')
    // And the shard item really is the table minimum at level 1, which is what made it win forever.
    expect(ab.upgradeCost('Doppelganger_Signet')).toBe(5)
  })

  it('does not stall on an UPGRADABLE shard item it cannot pay for', () => {
    // Snimp__Fanged_Blade is the load-bearing candidate, not a Doppelganger: it is dustType "shards"
    // AND upgradable, so the noUpgrade skip cannot remove it and the currency comparison is actually
    // reached. Its 159 starts above a level-1 dust item's 5, but dust costs are startPrice * 3^(lvl-1),
    // so once the dust items are levelled past it (Sword at level 5 costs 405) the shard item wins
    // the sort on merit. That is the ONLY shape that exercises the fall-through: a currency fix alone
    // still buys nothing here, because the cheapest candidate is legitimately unpayable.
    //
    // (Using a Doppelganger here instead passes even with the fall-through deleted — noUpgrade
    // removes it before the currency comparison runs. That version of this test survived the mutant.)
    expect(ab.items.Snimp__Fanged_Blade.dustType).toBe('shards')
    expect(ab.items.Snimp__Fanged_Blade.noUpgrade).toBeUndefined()
    expect(ab.upgradeCost('Snimp__Fanged_Blade')).toBe(159)

    for (const name of Object.keys(ab.items)) ab.items[name].equipped = false
    ab.items.Snimp__Fanged_Blade.owned = true
    ab.items.Snimp__Fanged_Blade.equipped = true
    ab.items.Sword.equipped = true
    ab.items.Sword.level = 5
    expect(ab.upgradeCost('Sword')).toBeGreaterThan(ab.upgradeCost('Snimp__Fanged_Blade'))

    ab.shards = 0
    ab.dust = 1e12

    const before = levels(ab)
    window.ABdustsimple()

    expect(changedLevels(before, ab)).toEqual(['Sword'])
  })

  it('DOES buy that shard item once the shards are there', () => {
    // The mirror of the case above — the fall-through must not degrade into "never buy shard items".
    for (const name of Object.keys(ab.items)) ab.items[name].equipped = false
    ab.items.Snimp__Fanged_Blade.owned = true
    ab.items.Snimp__Fanged_Blade.equipped = true
    ab.items.Sword.equipped = true
    ab.items.Sword.level = 5

    ab.shards = 1e6
    ab.dust = 1e12

    const before = levels(ab)
    window.ABdustsimple()

    expect(changedLevels(before, ab)).toEqual(['Snimp__Fanged_Blade'])
  })

  it('never spends shards on an item the game marks Unupgradable', () => {
    // The opposite failure from the same root: with shards in hand, AT levelled a noUpgrade item.
    // Neither Doppelganger's doStuff() reads this.level, and the game renders a grey "Unupgradable"
    // button (objects.js:4325) — so those shards bought literally nothing.
    // The Doppelgangers must be the ONLY candidates. Leaving Sword/Pants equipped lets the sort's
    // stable tie-break (both cost 5) hand the buy to a dust item first, so the assertion passes with
    // the noUpgrade skip deleted — that version of this test survived the mutant. Isolating them is
    // what makes the guard the only thing standing between the shards and a purchase that buys
    // nothing: the game's own upgrade() has no noUpgrade check and will happily take the payment.
    for (const name of Object.keys(ab.items)) ab.items[name].equipped = false
    ab.items.Doppelganger_Signet.owned = true
    ab.items.Doppelganger_Signet.equipped = true
    ab.items.Doppelganger_Diadem.owned = true
    ab.items.Doppelganger_Diadem.equipped = true
    ab.shards = 1e9
    ab.dust = 1e12

    const shardsBefore = ab.shards
    window.ABdustsimple()

    expect(ab.items.Doppelganger_Signet.level).toBe(1)
    expect(ab.items.Doppelganger_Diadem.level).toBe(1)
    expect(ab.shards).toBe(shardsBefore)
  })

  it('still buys the cheapest DUST item when everything is affordable', () => {
    // The advertised behaviour ("cheapest first") must survive the fix — this is the parity half.
    ab.dust = 1e12
    ab.shards = 0

    const before = levels(ab)
    const equipped = Object.keys(ab.items).filter((i) => ab.items[i].equipped)
    const cheapest = equipped
      .slice()
      .sort((a, b) => ab.upgradeCost(a) - ab.upgradeCost(b))[0]

    window.ABdustsimple()

    expect(changedLevels(before, ab)).toEqual([cheapest])
  })

  it('buys NOTHING when it genuinely cannot afford anything, rather than picking a loser', () => {
    ab.dust = 0
    ab.shards = 0

    const before = levels(ab)
    window.ABdustsimple()

    expect(changedLevels(before, ab)).toEqual([])
  })

  it('ABdustsimplenonhid ignores items the player does not OWN', () => {
    // `!equipped && !hidden` admitted unowned items, because load() forces hidden = false for any
    // item with no save entry (objects.js:857-864). An uncontracted item then soaked up the buy —
    // and the game's save() drops unowned items, so those levels evaporate on reload anyway.
    for (const name of Object.keys(ab.items)) {
      ab.items[name].equipped = false
      ab.items[name].hidden = false
      // Push every OWNED item's price well above a level-1 item's, so the unique cheapest candidate
      // in the whole table is an item the player does not own. Without that the owned/unowned prices
      // tie at 5, the sort's stable tie-break picks an owned item anyway, and the assertion passes
      // with the filter deleted — that version of this test survived the mutant.
      if (ab.items[name].owned) ab.items[name].level = 10
    }
    const unowned = Object.keys(ab.items).filter((i) => !ab.items[i].owned)
    expect(unowned.length).toBeGreaterThan(0) // the fixture must actually have unowned items
    const cheapest = Object.keys(ab.items)
      .filter((i) => !ab.items[i].noUpgrade)
      .sort((a, b) => ab.upgradeCost(a) - ab.upgradeCost(b))[0]!
    expect(ab.items[cheapest].owned).toBe(false) // the trap is baited

    ab.dust = 1e12
    ab.shards = 1e12

    const before = levels(ab)
    window.ABdustsimplenonhid()

    const moved = changedLevels(before, ab)
    expect(moved.length).toBe(1)
    for (const name of moved) expect(ab.items[name].owned).toBe(true)
  })

  it('ABdustsimplenonhid survives an empty candidate set (#77 guard intact)', () => {
    for (const name of Object.keys(ab.items)) ab.items[name].hidden = true
    ab.dust = 1e12

    expect(() => window.ABdustsimplenonhid()).not.toThrow()
  })
})
