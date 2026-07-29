// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { survive, directDamage, challengeDamage, maxOneShotPower } from '../src/modules/stance'

// #229/#230/#231 — three survivability defects that a differential oracle structurally cannot see.
// `baseline-zero` pins the formation AT chose; it can detect a CHANGE, never that the choice was
// wrong, because nothing in the net computes the right answer independently. So each is driven here
// through the input that decides it.

const G = globalThis as any
const CLONE = resolve(process.env.TRIMPS_GAME_DIR ?? '.trimps-game', 'main.js')

beforeEach(() => {
  G.game = {
    global: {
      brokenPlanet: true, mapsActive: false, spireActive: false, formation: 0,
      soldierHealth: 1000, soldierHealthMax: 1000, world: 65, universe: 1,
      challengeActive: '', dailyChallenge: {}, voidBuff: '', lastLowGen: 0, uberNature: '',
    },
    upgrades: { Dominance: { done: true }, Barrier: { done: true }, Formations: { done: true } },
    portal: { Overkill: { level: 30 } },
    talents: { pierce: { purchased: false }, overkill: { purchased: false } },
    challenges: { Lead: { stacks: 0 } },
    jobs: { Geneticist: { owned: 0 } },
    resources: { trimps: { realMax: () => 100, owned: 10 } },
    empowerments: { Ice: { getLevel: () => 0 } },
  }
  G.game.badGuys = { Snimp: { fast: false } }
  G.challengeActive = () => false
  G.getEmpowerment = () => ''
  G.Fluffy = { isRewardActive: () => 0 }
  G.getCurrentEnemy = () => ({ health: 1000, name: 'Snimp', corrupted: '', mutation: '' })
  G.calcSpecificEnemyAttack = () => 100
  G.calcOurHealth = () => 1000
  G.calcOurBlock = () => 0
  G.calcOurDmg = () => 100
  G.addPoison = () => 0
  // The game's own getPierceAmt (.trimps-game/main.js:11218) — halved while IN Barrier.
  G.getPierceAmt = () => (G.game.global.formation === 3 ? 0.1 : 0.2)
})

// ── #229: the Barrier pierce halving ───────────────────────────────────────────────────────────────

describe('#229 — survive() translates the pierce halving in BOTH directions', () => {
  it('the clone really does halve pierce only while formation == 3', () => {
    const src = readFileSync(CLONE, 'utf8')
    expect(src).toMatch(/function getPierceAmt\(\)\{[\s\S]{0,300}?if \(game\.global\.formation == 3\) base \*= 0\.5;/)
  })

  // ⚠️ The first version of this block computed survive()'s pierce adjustment IN THE HELPER and
  // asserted on that. It passed against a build with the fix reverted — the test was a copy of the
  // production logic, so mutating production could not move it. Both mutants survived 13/13. What
  // follows drives `survive()` itself; the only thing the test knows is the game's rule.
  //
  // The invariant, stated without reference to the fix's arithmetic: how survivable a TARGET
  // formation is cannot depend on which formation you are standing in right now. Pre-fix,
  // survive("B") used pierce 0.2 from D and 0.1 from B, so it violated exactly that.

  /** Seed the module-level base stats survive() reads, so the pierce term is the only variable. */
  function armPierceDecided(baseHealth: number) {
    G.baseHealth = baseHealth
    G.baseBlock = 1e9 / 4 // *4 in B → 2.5e8, far above enemyDamage, so max() picks the pierce arm
    G.baseMinDamage = 1
    G.baseMaxDamage = 1
    G.game.global.soldierHealth = 1000
    G.game.global.soldierHealthMax = 1000 // missingHealth = 0
  }

  it.each([
    ['B', 30], ['B', 16], ['B', 8],
    ['D', 30], ['D', 16],
    ['H', 30], ['H', 16],
  ])('survive(%s) agrees whether you come from Barrier or not (health %i)', (target, h) => {
    armPierceDecided(h as number)
    G.game.global.formation = 3
    const fromBarrier = survive(target as string, 2, true)
    G.game.global.formation = 0
    const fromElsewhere = survive(target as string, 2, true)
    expect(fromBarrier).toBe(fromElsewhere)
  })

  it('anti-false-green: the fixture straddles the threshold — these are not all true or all false', () => {
    // If every row above returned the same boolean the agreement would be trivially satisfiable.
    G.game.global.formation = 0
    armPierceDecided(30)
    const roomy = survive('B', 2, true)
    armPierceDecided(8)
    const tight = survive('B', 2, true)
    expect(roomy).toBe(true)
    expect(tight).toBe(false)
  })

  it('B is modelled at HALF D\'s pierce — not merely consistently', () => {
    // Consistency alone would also be satisfied by halving both formations, or neither.
    G.game.global.formation = 0
    // Both B and D halve health, so baseHealth 30 → 15 in either: between 0.1*100 = 10 of harm
    // (Barrier's real pierce) and 0.2*100 = 20 (Dominance's).
    armPierceDecided(30)
    expect(survive('B', 2, true)).toBe(true)  // pierce 0.1 → harm 10 → 15 > 10
    expect(survive('D', 2, true)).toBe(false) // pierce 0.2 → harm 20 → 15 < 20
  })

  it('directDamage really is pierce-decided at these block levels', () => {
    expect(directDamage(1e9, 0.2, 1e9, 1, 2)).toBeGreaterThan(directDamage(1e9, 0.1, 1e9, 1, 2))
  })
})

// ── #230: the zero-missingHealth sentinel ──────────────────────────────────────────────────────────

describe('#230 — challengeDamage honours an explicit 0 missingHealth', () => {
  beforeEach(() => {
    G.game.global.voidBuff = 'bleed'
    G.game.global.soldierHealth = 500 // half dead: missingHealth = 500
    G.getCurrentEnemy = () => ({ health: 1000, name: 'Snimp', corrupted: '' })
    G.calcSpecificEnemyAttack = () => 100
    G.calcOurHealth = () => 1000
    G.calcOurBlock = () => 0
    G.calcOurDmg = () => 100
    G.addPoison = () => 0
  })

  it('an explicit 0 is NOT replaced by the current squad\'s missing health', () => {
    const fresh = challengeDamage(1000, 100, 100, 0, 0, 0, 2)
    const damaged = challengeDamage(1000, 100, 100, 500, 0, 0, 2)
    // The bleed term is `(maxHealth - missingHealth) * challengeDamage`, so a bigger missingHealth
    // means LESS projected bleed. Pre-fix these two were identical, because the 0 was discarded.
    expect(fresh).not.toBeCloseTo(damaged, 9)
    expect(fresh).toBeGreaterThan(damaged)
  })

  it('omitting the argument entirely still falls back to the live squad', () => {
    // The `=== undefined` guard must keep the DEFAULTING behaviour for callers that want it.
    expect(challengeDamage(1000, 100, 100, undefined, 0, 0, 2)).toBeCloseTo(
      challengeDamage(1000, 100, 100, 500, 0, 0, 2), 9,
    )
  })

  it('anti-false-green: the bleed path is actually armed in this fixture', () => {
    // Without a bleed source the two calls agree trivially and both tests above pass vacuously.
    G.game.global.voidBuff = ''
    expect(challengeDamage(1000, 100, 100, 0, 0, 0, 2)).toBeCloseTo(
      challengeDamage(1000, 100, 100, 500, 0, 0, 2), 9,
    )
  })
})

// ── #231: delegation to the game's overkiller count ────────────────────────────────────────────────

describe('#231 — maxOneShotPower delegates to getOverkillerCount', () => {
  it('is exactly getOverkillerCount() + 2 across the whole input matrix', () => {
    const matrix = [
      { overkill: false, ice: 0, uber: '', fluffy: 0 },
      { overkill: true, ice: 0, uber: '', fluffy: 0 },
      { overkill: false, ice: 50, uber: '', fluffy: 0 },
      { overkill: false, ice: 100, uber: '', fluffy: 0 },
      { overkill: false, ice: 0, uber: 'Ice', fluffy: 0 },
      { overkill: false, ice: 0, uber: '', fluffy: 1 }, // <- the term AT omitted entirely
      { overkill: true, ice: 100, uber: 'Ice', fluffy: 2 },
    ]
    const seen = new Set<number>()
    for (const m of matrix) {
      G.game.talents.overkill.purchased = m.overkill
      G.game.empowerments.Ice = { getLevel: () => m.ice }
      G.getEmpowerment = () => (m.ice > 0 ? 'Ice' : '')
      G.game.global.uberNature = m.uber
      G.Fluffy = { isRewardActive: () => m.fluffy }
      const got = maxOneShotPower()
      expect(got).toBe(G.getOverkillerCount() + 2)
      seen.add(got)
    }
    // anti-false-green: if every row gave the same number the equality above proves nothing.
    expect(seen.size).toBeGreaterThanOrEqual(4)
  })

  it('the Fluffy overkiller reward moves the answer — it was omitted entirely before #231', () => {
    G.Fluffy = { isRewardActive: () => 0 }
    const without = maxOneShotPower()
    G.Fluffy = { isRewardActive: () => 2 }
    expect(maxOneShotPower()).toBe(without + 2)
  })

  it('uber Ice is read through getUberEmpowerment, not the raw field', () => {
    // Below the nature start zone the game grants nothing; the raw field says "Ice" either way.
    G.game.global.uberNature = 'Ice'
    G.getNatureStartZone = () => 236
    G.game.global.world = 100 // below
    const below = maxOneShotPower()
    G.game.global.world = 300 // above
    const above = maxOneShotPower()
    delete G.getNatureStartZone
    expect(above).toBe(below + 2)
  })

  it('still short-circuits to 1 with no Overkill perk', () => {
    G.game.portal.Overkill.level = 0
    expect(maxOneShotPower()).toBe(1)
  })
})
