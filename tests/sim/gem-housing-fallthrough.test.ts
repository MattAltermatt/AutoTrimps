import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TEST_BUNDLE } from './bundle'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installSeededRandom } from '../../scripts/sim/seededRandom.mjs'
import { stepWithAT } from '../../scripts/sim/driver.mjs'

// GEM-HOUSING AFFORDABILITY FALL-THROUGH — AT MUST NOT LOCK ONTO A CANDIDATE IT CANNOT PAY FOR.
//
// buyGemEfficientHousing ranks candidates on `gemsCost / increase.by` — ONE of the up to four cost
// items a housing type carries. Gateway is the only U1 gem-housing whose binding resource is NOT gems
// (fragments, `[3000, 1.14]`), and it stays the best gems-per-pop deal until ~100 owned. So past a
// certain Gateway count the ranking hands back a winner whose fragment price has run away, the loop
// `break`s on it, and AT buys NOTHING — this tick and every tick after, because the ranking is a pure
// function of state and the failed purchase did not change that state.
//
// ⚠️ THE L0 ORACLE CANNOT SEE THIS. Eight of the nine U1 corpus fixtures sit at z2-z6 with every gem
// housing still LOCKED, so `keysSorted` is empty and the loop never runs. The two deep fixtures
// (12-warp-u1 z62, 13-z58-gearwall-u1 z58) run at the stock `MaxGateway` of 25, which filters Gateway
// out of the loop before the branch is reached. `baseline-zero` is therefore green through BOTH the
// broken and the fixed build — it is evidence the net cannot look, not evidence the code is right.
// Same species as #153. This fixture is the eye that was missing.
//
// 14-gem-housing-frag-lock-u1 is a real user save: U1, portal 51, zone 60, 96 Gateways owned, gems
// 3.95e11 banked against a Gateway gem price of 5.81e9 (68x affordable) — but its FRAGMENT price is
// 8.71e8 against 5.21e8 owned. Measured with the pre-fix build and MaxGateway uncapped, 3000 ticks:
// AT bought NOTHING while gems ran away to 3.2e12. With the fall-through: 5 Collectors, +42.7% max
// population. Mutation-proven — restore the unconditional `break` and this goes red.
const SAVE = () => readFileSync(resolve('tests/fixtures/saves/14-gem-housing-frag-lock-u1.txt'), 'utf8').trim()

const GEM_HOUSING = ['Mansion', 'Hotel', 'Resort', 'Gateway', 'Collector', 'Warpstation']
const housingBought = (game: any) =>
  GEM_HOUSING.reduce((a, n) => a + (game.buildings[n]?.purchased ?? 0), 0)

describe('sim/gem-housing affordability fall-through', () => {
  it('the fixture actually carries the trap: Gateway wins the ranking, is gem-rich, fragment-poor', () => {
    const { window: w, game } = bootGame({ saveString: SAVE(), fixedNow: 'lastOnline' })
    expect(game.global.universe ?? 1).toBe(1)

    // Gateway ranks FIRST on the metric the code actually sorts by.
    const ratio = (n: string) =>
      w.getBuildingItemPrice(game.buildings[n], 'gems', false, 1) / game.buildings[n].increase.by
    const unlocked = GEM_HOUSING.filter((n) => game.buildings[n].locked === 0)
    expect(unlocked).toContain('Gateway')
    expect(unlocked).toContain('Collector')
    const best = unlocked.reduce((a, b) => (ratio(a) <= ratio(b) ? a : b))
    expect(best).toBe('Gateway')

    // ...and it cannot be bought. The blocker is FRAGMENTS, not gems — that split is the whole
    // point of the fixture. If gems were the blocker the correct behaviour would be to keep waiting,
    // and this fixture would be testing the wrong thing.
    expect(w.canAffordBuilding('Gateway', false, false, false, false, 1)).toBe(false)
    expect(w.getBuildingItemPrice(game.buildings.Gateway, 'gems', false, 1)).toBeLessThan(
      game.resources.gems.owned,
    )
    expect(w.getBuildingItemPrice(game.buildings.Gateway, 'fragments', false, 1)).toBeGreaterThan(
      game.resources.fragments.owned,
    )
  })

  it('AT falls through to the next-best housing instead of sitting on an unpayable Gateway', () => {
    const { window: w, game } = bootGame({
      withAutoTrimps: true,
      atBundlePath: TEST_BUNDLE,
      saveString: SAVE(),
      fixedNow: 'lastOnline',
      // The stock MaxGateway of 25 would filter Gateway out of the loop entirely (96 owned), so the
      // trap is unreachable and this test would PASS ON THE BROKEN BUILD. Uncapping is what puts the
      // fixture inside the window — cf. the reporting user, who hit this by uncapping.
      atSettings: { MaxGateway: -1, MaxCollector: -1 },
    })
    installSeededRandom(w, 1)

    const before = { housing: housingBought(game), pop: game.resources.trimps.realMax() }
    stepWithAT(w, 3000)
    const after = { housing: housingBought(w.game), pop: w.game.resources.trimps.realMax() }

    // Assert on STATE, never on a spy: a converted module's internal calls do not route through the
    // global, so intercepting window.safeBuyBuilding reports a confident 0 while the code
    // demonstrably runs (#127/#129).
    expect(after.housing).toBeGreaterThan(before.housing)
    expect(after.pop).toBeGreaterThan(before.pop)
    // Gateway itself must still be untouched — the fall-through skips it, it does not somehow afford
    // it. This is what distinguishes the fix from "AT found more fragments".
    expect(w.game.buildings.Gateway.purchased).toBe(game.buildings.Gateway.purchased)
  })

  it('a GEM-blocked winner still holds the line — AT saves up instead of dumping into worse housing', () => {
    const { window: w, game } = bootGame({
      withAutoTrimps: true,
      atBundlePath: TEST_BUNDLE,
      saveString: SAVE(),
      fixedNow: 'lastOnline',
      atSettings: { MaxGateway: -1, MaxCollector: -1 },
    })
    installSeededRandom(w, 1)

    // Strip the bank so the fall-through target (Collector, 5e11 gems) is GEM-blocked, and park
    // fragments far out of reach so Gateway stays blocked too. The correct behaviour is to wait for
    // gems, NOT to spend them on a Mansion at 4.14e8 gems/pop — 7x worse than the Collector it would
    // be giving up. This is the assertion that fails if someone later "simplifies" the rule to
    // always fall through.
    w.game.resources.gems.owned = 1e10
    w.game.resources.fragments.owned = 1
    const mansionsBefore = w.game.buildings.Mansion.purchased
    stepWithAT(w, 200)

    expect(w.game.buildings.Mansion.purchased).toBe(mansionsBefore)
    expect(w.game.buildings.Gateway.purchased).toBe(game.buildings.Gateway.purchased)
  })
})
