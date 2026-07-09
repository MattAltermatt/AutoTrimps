import { describe, it, expect, beforeEach } from 'vitest'
import { RgetEnemyMaxAttack, RgetEnemyMaxHealth } from '../src/modules/query'

// Regression + correctness for the U2 z300 hard-scaling parity fix (#22).
// The current game's getEnemyAttack/getEnemyHealth multiply enemy stats by 1.15^(world-300) past
// zone 300 (config.js); the from-scratch port had dropped that term, under-predicting late-U2
// enemies by ~1000x. We isolate the factor via the ratio between two high-U2 worlds: every other
// term is shared and cancels, and the -10/-110 subtraction is float-negligible at these magnitudes.
// Without the fix these ratios are short by exactly 1.15^50 (~1083x), so the test would fail.
const rel = (a: number, b: number) => Math.abs(a / b - 1)

describe('query U2 z300 hard-scaling (#22)', () => {
  beforeEach(() => {
    ;(globalThis as any).game = {
      global: { universe: 2, mapsActive: false },
      badGuys: { Snimp: { attack: 1 }, Grimp: { health: 1 } },
    }
  })

  it('RgetEnemyMaxAttack applies 1.15^(world-300) above zone 300', () => {
    // ratio(350/300) = sqrt(350/300)·3.27^25 · 1.32^50 · 1.15^100
    // (1.15^50 from the shared world-59 term + 1.15^50 from the restored z300 part4)
    const ratio = RgetEnemyMaxAttack(350, 30, 'Snimp') / RgetEnemyMaxAttack(300, 30, 'Snimp')
    const expected = Math.sqrt(350 / 300) * Math.pow(3.27, 25) * Math.pow(1.32, 50) * Math.pow(1.15, 100)
    expect(rel(ratio, expected)).toBeLessThan(1e-6)
  })

  it('RgetEnemyMaxHealth applies 1.15^(world-300) above zone 300', () => {
    // ratio(350/300) = sqrt(350/300)·3.265^25 · 1.1^50 · 1.32^50 · 1.15^50 (the restored z300 part3)
    const ratio = RgetEnemyMaxHealth(350, 30) / RgetEnemyMaxHealth(300, 30)
    const expected =
      Math.sqrt(350 / 300) * Math.pow(3.265, 25) * Math.pow(1.1, 50) * Math.pow(1.32, 50) * Math.pow(1.15, 50)
    expect(rel(ratio, expected)).toBeLessThan(1e-6)
  })
})
