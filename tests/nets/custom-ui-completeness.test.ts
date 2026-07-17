import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { REGIONS } from '../../src/modules/custom-ui/regions'

// Phase 1: the whole HUD is adopted as #wrapper, so every game HUD region is covered
// transitively (the game keeps rendering into its own containers inside our shell). This net
// asserts #wrapper (the adopted root) is registered and that it is a real element in the game's
// index.html — the mechanized form of "our UI is missing something". It grows to per-region
// granularity as regions graduate to AT-native rendering.
describe('custom-ui completeness', () => {
  it('the adopted HUD root #wrapper is registered', () => {
    const covered = new Set(REGIONS.map((r) => r.containerId))
    expect(covered.has('wrapper')).toBe(true)
  })

  it('#wrapper exists in the game index.html (the seam is real)', () => {
    const html = readFileSync(new URL('../../../trimps-game/index.html', import.meta.url), 'utf8')
    expect(html).toMatch(/id=["']wrapper["']/)
  })
})
