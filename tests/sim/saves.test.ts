import { describeSim } from './guard'
import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installFrozenClock } from '../../scripts/sim/clock.mjs'
import { installSeededRandom } from '../../scripts/sim/seededRandom.mjs'
import { stepWithAT } from '../../scripts/sim/driver.mjs'
import { assertHydrated } from '../harness/gameFixture'

const load = (name: string) => readFileSync(resolve('tests/fixtures/saves', name + '.txt'), 'utf8')

describeSim('synthetic save corpus', () => {
  it('01-early-u1 loads, hydrated, at a progressed U1 zone', () => {
    const { game } = bootGame({ saveString: load('01-early-u1') })
    assertHydrated(game)
    expect(game.global.world).toBeGreaterThanOrEqual(1)
    expect(game.global.universe ?? 1).toBe(1)
  })

  it('02-mid-u1 loads + hydrated', () => {
    const { game } = bootGame({ saveString: load('02-mid-u1') })
    assertHydrated(game)
  })

  it('03-challenge-watch loads with the Watch challenge armed', () => {
    const { game } = bootGame({ saveString: load('03-challenge-watch') })
    assertHydrated(game)
    expect(game.global.challengeActive).toBe('Watch')
  })

  it('the corpus is NON-VACUOUS: AT calls native mutators (a fresh newGame would not)', () => {
    const { window: w } = bootGame({ withAutoTrimps: true, saveString: load('01-early-u1') })
    installSeededRandom(w, 1)
    installFrozenClock(w)
    let calls = 0
    for (const fn of ['buyJob', 'buyBuilding', 'buyUpgrade', 'buyEquipment', 'setFormation', 'runMap']) {
      const orig = w[fn]
      if (typeof orig === 'function') w[fn] = function (...a: unknown[]) { calls++; return orig.apply(this, a) }
    }
    stepWithAT(w, 1500)
    expect(calls).toBeGreaterThan(0)
  })
})
