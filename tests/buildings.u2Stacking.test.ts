import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TEST_BUNDLE } from './sim/bundle'
import { bootGame } from '../scripts/sim/boot.mjs'
import { assertHydrated } from './harness/gameFixture'

// #123 — U2's buyers passed forceAmt=1 to the native buyBuilding() at every site, so every U2 purchase
// became a `X.1` queue entry.
//
// That is not a cosmetic difference. The game crafts ONE queue entry per craft cycle
// (`craftBuildings()` → `removeQueueItem('first')`, main.js:4939) and takes
// `Math.min(DecaBuild ? 10 : DoubleBuild ? 2 : 1, <that entry's own stack amount>)` buildings from it
// (updates.js:5438-5444). So a queue of ten `Hut.1` entries yields min(10,1) = ONE building per craft
// cycle, while a single `Hut.10` yields TEN. Queue depth is not throughput; stack size is. Every U2
// player with the DecaBuild Bone-Portal reward — universe-agnostic and permanent, so nearly all of
// them — was building at a tenth of U1's rate and getting nothing for a reward they had paid for.
//
// THE ASSERTION THAT MATTERS IS THE CRAFT, NOT THE CALL. A test that counted buyBuilding() calls, or
// even one that only checked the queue's shape, could be satisfied by ten `Hut.1` entries. So these
// tests drive the game's OWN `removeQueueItem('first')` and assert how many buildings actually appeared.
//
// The L0 proof net is blind to all of this: the corpus has one weak U2 fixture (04-u2-radon, a z4 state
// recorded at 300 ticks, RbuyJobs-dominated) and NO save carries a Bone-Portal reward. So a green
// baseline-zero is not evidence this works — it is only evidence that a player WITHOUT the rewards is
// unaffected, which is a different (and also necessary) claim. The evidence is hand-built here.

const U2_SAVE = readFileSync(resolve('tests/fixtures/saves/04-u2-radon.txt'), 'utf8')

/** getHighestBionic() = 125 + (roboTrimpLevel-1)*15. DecaBuild requires 305, DoubleBuild 185. */
const ROBO = { none: 0, doubleBuild: 5, decaBuild: 13 }

function bootU2(roboTrimpLevel: number) {
  const { window, game } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE, saveString: U2_SAVE })
  assertHydrated(game)

  game.global.universe = 2
  game.global.roboTrimpLevel = roboTrimpLevel
  game.global.buildingsQueue = []
  game.global.crafting = ''

  // Enough of everything that affordability is never the binding constraint.
  for (const r of ['food', 'wood', 'metal', 'gems', 'science']) {
    if (game.resources[r]) game.resources[r].owned = 1e30
  }
  return { window, game }
}

/** Run the game's own craft completion once and report how many of `what` actually got built. */
function craftOnce(window: any, game: any, what: string): number {
  const before = game.buildings[what].owned
  game.global.timeLeftOnCraft = 0
  window.removeQueueItem('first')
  return game.buildings[what].owned - before
}

/** The head of the queue, as [name, stackAmount]. */
function queueHead(game: any): [string, number] {
  const [name, amt] = String(game.global.buildingsQueue[0]).split('.')
  return [name, Number(amt)]
}

describe('#123: U2 queues stacked build entries, so DecaBuild/DoubleBuild actually pay', () => {
  it('anti-false-green: RbuyBuildings() really does queue housing here — otherwise every case below is vacuous', () => {
    const { window, game } = bootU2(ROBO.decaBuild)
    window.RbuyBuildings()
    expect(game.global.buildingsQueue.length).toBeGreaterThan(0)
    expect(window.bwRewardUnlocked('DecaBuild')).toBe(true)
  })

  it('with DecaBuild, one craft cycle builds TEN — this is the whole bug', () => {
    const { window, game } = bootU2(ROBO.decaBuild)
    window.RbuyBuildings()

    const [name, amt] = queueHead(game)
    expect(amt).toBe(10)

    // Mutation check (restore `buyBuilding(housing, true, true, 1)`): the head becomes `X.1`,
    // this craft yields 1, and the assertion fails with `expected 1 to be 10`.
    expect(craftOnce(window, game, name)).toBe(10)
  })

  it('with DoubleBuild only, one craft cycle builds TWO — the middle rung is not skipped', () => {
    const { window, game } = bootU2(ROBO.doubleBuild)
    window.RbuyBuildings()

    const [name, amt] = queueHead(game)
    expect(amt).toBe(2)
    expect(craftOnce(window, game, name)).toBe(2)
  })

  it('with NEITHER reward, entries stay at 1 — a player without the Bone Portal is unaffected', () => {
    const { window, game } = bootU2(ROBO.none)
    window.RbuyBuildings()

    const [name, amt] = queueHead(game)
    expect(amt).toBe(1)
    expect(craftOnce(window, game, name)).toBe(1)
  })

  it('a stack never overshoots the user RMax<housing> cap', () => {
    const { window, game } = bootU2(ROBO.decaBuild)
    // Leave room for exactly 3 more Huts, then demand a 10-stack.
    window.setPageSetting('RMaxHut', game.buildings.Hut.purchased + 3)
    window.RbuyBuildings()

    const hut = game.global.buildingsQueue.map(String).find((e: string) => e.startsWith('Hut.'))
    if (hut) {
      expect(Number(hut.split('.')[1])).toBeLessThanOrEqual(3)
      expect(game.buildings.Hut.purchased).toBeLessThanOrEqual(window.getPageSetting('RMaxHut'))
    }
  })

  it('Tribute keeps its computed bulk count — the ladder would have capped the one site that already worked', () => {
    const { window, game } = bootU2(ROBO.decaBuild)
    if (game.buildings.Tribute.locked) return // nothing to prove on a fixture without Tribute
    window.setPageSetting('RMaxTribute', -1)
    window.RbuyBuildings()

    const trib = game.global.buildingsQueue.map(String).find((e: string) => e.startsWith('Tribute.'))
    expect(trib).toBeDefined()
    // With 1e30 food the affordable count is far above the ladder's 10-unit ceiling. If someone
    // "finishes the job" by routing Tribute through the ladder, this drops to 10 and goes red.
    expect(Number(trib!.split('.')[1])).toBeGreaterThan(10)
  })
})
