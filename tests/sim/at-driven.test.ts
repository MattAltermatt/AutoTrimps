import { describe, it, expect } from 'vitest'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { stepWithAT } from '../../scripts/sim/driver.mjs'

// Mechanical fidelity: AutoTrimps boots, initializes its ~570 settings, and its mainLoop
// drives the active-play tick without throwing. NOTE: this does NOT assert full-run
// progression — a bare newGame() is inert (trimps are player-trapped in the opening, and
// AT only takes over once trimps flow). Realistic-run seeding is tracked separately.
describe('sim/at-driven', () => {
  it('AutoTrimps initializes its settings when booted', () => {
    const { window } = bootGame({ withAutoTrimps: true })
    expect(typeof window.mainLoop).toBe('function')
    expect(Object.keys(window.autoTrimpSettings).length).toBeGreaterThan(500)
  })

  it('mainLoop drives the active-play tick without throwing', () => {
    const { window } = bootGame({ withAutoTrimps: true })
    expect(() => stepWithAT(window, 2000)).not.toThrow()
  })
})
