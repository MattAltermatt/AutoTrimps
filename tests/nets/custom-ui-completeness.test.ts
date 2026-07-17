import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
    // The SHA-PINNED clone (repo-root .trimps-game/), which npm ci materializes and which exists on
    // CI — NOT ../trimps-game (the dev workspace), which is absent on the runner (#67 hole).
    const html = readFileSync(resolve(process.cwd(), '.trimps-game/index.html'), 'utf8')
    expect(html).toMatch(/id=["']wrapper["']/)
  })
})
