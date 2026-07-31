import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { CORPUS } from '../../scripts/sim/corpus.mjs'

// #313 — THE HOLE THIS FILE EXISTS TO CLOSE. `ATGA2()` (breedtimer.ts:106) opens with
// `game.jobs.Geneticist.locked == false`, and Geneticist unlocks at world 70 (config.js:11178). Every
// save in the corpus before this change carried `Geneticist.locked = 1` — the deepest, 12-warp-u1, is
// world 62 — so that guard was false on 15/15 fixtures and the entire Geneticist/breed-timer subsystem
// was structurally unreachable in L0. `baseline-zero` was not evidence about any of it; it was evidence
// that the net could not see it, which is the #67 shape one level up.
//
// Asserted through `bootGame` rather than by decoding the JSON, deliberately: the guard reads the
// RESTORED game object, and `load()` is what produces it. A raw decode would assert on a shape the game
// never sees — the same class of mistake as the harness that injected `JSON.stringify(game)` and
// silently dropped every method.
const load = (name: string) => readFileSync(resolve('tests/fixtures/saves', name + '.txt'), 'utf8')

describe('the ATGA subsystem is reachable in L0 (#313)', () => {
  it('15-geneticist-u1 has Geneticists unlocked — ATGA2 bails on locked at breedtimer.ts:106', () => {
    const { game } = bootGame({ saveString: load('15-geneticist-u1') })
    expect(game.jobs.Geneticist.locked).toBe(0)
    expect(game.global.world).toBeGreaterThanOrEqual(71)
  })

  // The OTHER arm of main.js:11683. Anticipation stacks come from `lastBreedTime` (the refill clock)
  // without an Amalgamator and from the whole cycle with one — different code, and every save in the
  // corpus took the first branch, so the second had never executed.
  it('16-amalg-u1 owns an Amalgamator — the other arm of main.js:11683', () => {
    const { game } = bootGame({ saveString: load('16-amalg-u1') })
    expect(game.jobs.Geneticist.locked).toBe(0)
    expect(game.jobs.Amalgamator.owned).toBeGreaterThan(0)
  })

  // The two assertions above name their fixtures by hand, which is a list, and a list is exactly what
  // this repo keeps watching rot (#208/#238: a finding's own scoping claim is a claim). This one states
  // the INVARIANT instead and derives its answer from CORPUS, so it cannot quietly become a description
  // of two files that no longer do what they are named for.
  //
  // Boot each save once — bootGame is not cheap.
  const booted = new Map<string, any>()
  const gameOf = (name: string) => {
    if (!booted.has(name)) booted.set(name, bootGame({ saveString: load(name) }).game)
    return booted.get(name)
  }

  /** ATGA2()'s outer guard, transcribed from breedtimer.ts:106 — every conjunct, so a fixture that
   *  satisfies only some of them cannot pass itself off as coverage. */
  const canRunATGA = (name: string, settings: Record<string, any> = {}) => {
    const g = gameOf(name)
    return g.jobs.Geneticist.locked === 0 &&
      settings.ATGA2 === true &&
      Number(settings.ATGA2timer) > 0 &&
      g.global.challengeActive !== 'Trapper'
  }

  it('at least one CORPUS member can actually execute ATGA2 — derived from CORPUS, not listed', () => {
    const armed = (CORPUS as any[]).filter((c) => canRunATGA(c.name, c.settings ?? {})).map((c) => c.name)
    expect(armed.length).toBeGreaterThan(0)

    // BOTH arms of the antiStacks fork (main.js:11683) must be present or the corpus is half-blind: the
    // stack source is the refill clock without an Amalgamator and the whole cycle with one.
    expect(armed.filter((n: string) => gameOf(n).jobs.Amalgamator.owned > 0).length).toBeGreaterThan(0)
    expect(armed.filter((n: string) => gameOf(n).jobs.Amalgamator.owned === 0).length).toBeGreaterThan(0)
  })

  it('the guard is not satisfied by save state alone — dropping the settings disarms it', () => {
    // Anti-false-green for the test above. ATGA2 defaults OFF and main-loop.ts:262 gates the call on it,
    // so a fixture with the right save and no seeded settings reaches nothing. If this passes with the
    // settings removed, `canRunATGA` has stopped testing the settings half of the guard.
    expect(canRunATGA('15-geneticist-u1', {})).toBe(false)
    expect(canRunATGA('15-geneticist-u1', { ATGA2: true, ATGA2timer: -1 })).toBe(false)
    expect(canRunATGA('15-geneticist-u1', { ATGA2: true, ATGA2timer: 30 })).toBe(true)
  })
})
