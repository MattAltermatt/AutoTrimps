// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { getTrimpAttack } from '../src/modules/calc'
import { makeMinimalGame, assertHydrated } from './harness/gameFixture'

// Phase 0 harness spike. Proves the unit golden-master recipe end-to-end on a real game-coupled
// module: import calc.ts (which pulls in utils.ts's import-time DOM) under jsdom, inject a `game`
// fixture, and pin getTrimpAttack's output. If this is green, the Layer-1 approach is validated.

describe('calc.getTrimpAttack — Layer-1 golden master', () => {
  beforeEach(() => {
    // getTrimpAttack reads the `mutations` global (mutations.Magma) besides `game`.
    ;(globalThis as any).mutations = { Magma: { active: () => false, getTrimpDecay: () => 1 } }
  })

  it('computes attack from a hand-verified fixture', () => {
    ;(globalThis as any).game = makeMinimalGame({
      equipment: {
        Dagger: { locked: 0, attackCalculated: 10, level: 5 }, // +50
        Mace: { locked: 0, attackCalculated: 4, level: 10 }, // +40
        Polearm: { locked: 1 },
        Battleaxe: { locked: 1 },
        Greatsword: { locked: 1 },
        Arbalest: { locked: 1 },
      },
      resources: { trimps: { maxSoldiers: 100 } },
      portal: { Power: { level: 2, modifier: 0.1 }, Power_II: { level: 0, modifier: 0 } },
      global: { formation: 0 },
    })
    // 6 + 10*5 + 4*10 = 96 ; *100 maxSoldiers = 9600 ; + 9600*2*0.1 (Power) = 11520
    expect(getTrimpAttack()).toBe(11520)
  })

  it('applies the Power_II multiplier and formation penalty', () => {
    ;(globalThis as any).game = makeMinimalGame({
      equipment: {
        Dagger: { locked: 0, attackCalculated: 1, level: 4 }, // +4 → dmg 10
        Mace: { locked: 1 },
        Polearm: { locked: 1 },
        Battleaxe: { locked: 1 },
        Greatsword: { locked: 1 },
        Arbalest: { locked: 1 },
      },
      resources: { trimps: { maxSoldiers: 10 } }, // *10 = 100
      portal: { Power: { level: 0, modifier: 0 }, Power_II: { level: 3, modifier: 0.2 } }, // *(1+0.6)=160
      global: { formation: 1 }, // formation !== 0 and !== 2 → *0.5 = 80
    })
    expect(getTrimpAttack()).toBe(80)
  })
})

describe('anti-false-green tripwire (JSON.stringify strips game methods)', () => {
  it('passes for a hydrated game (methods present)', () => {
    const g = { buildings: { Shed: { cost: { wood: () => 123 } } } }
    expect(() => assertHydrated(g)).not.toThrow()
  })

  it('throws for a JSON-round-tripped game — the exact snapshot trap the design forbids', () => {
    const live = { buildings: { Shed: { cost: { wood: () => 123 } } } }
    const snapshot = JSON.parse(JSON.stringify(live)) // function silently dropped
    expect(() => assertHydrated(snapshot)).toThrow(/not hydrated/)
  })
})
