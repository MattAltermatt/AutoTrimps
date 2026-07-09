// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// Phase 1 · Wave 1 characterization for heirlooms.ts (issue #28), the #25 efficiency-math region.
// getHeirloomEff is the pure predicate feeding evaluateHeirloomMods2's keep/scrap scoring: for a
// mod name + type it returns 5 if any configured slot matches, else 0. Pins the match table so the
// strict-TS conversion is provably behaviour-preserving. (The loom-swap seam crash has its own
// regression in heirlooms.loomSwap.test.ts.)

let getHeirloomEff: (name: string, type: string) => number | undefined

beforeAll(async () => {
  // heirlooms.ts reads game.options + appends heirloom buttons at import time (elements seeded in
  // tests/setup.ts); set a minimal game first, then dynamic-import.
  ;(globalThis as any).game = { options: { menu: { showHeirloomAnimations: { enabled: false } } } }
  getHeirloomEff = (await import('../src/modules/heirlooms')).getHeirloomEff
})

describe('heirlooms.getHeirloomEff — Layer-1 golden master (mod-match scoring)', () => {
  beforeEach(() => {
    // getHeirloomEff reads getPageSetting('slotNmod{sh,st,cr}'); empty store → every lookup false.
    ;(globalThis as any).autoTrimpSettings = {}
  })

  function setSetting(key: string, value: string) {
    ;(globalThis as any).autoTrimpSettings[key] = { type: 'dropdown', selected: value }
  }

  it('returns 5 when a shield slot matches the mod name', () => {
    setSetting('slot3modsh', 'critChance')
    expect(getHeirloomEff('critChance', 'shield')).toBe(5)
  })

  it('returns 5 when a staff slot matches', () => {
    setSetting('slot7modst', 'FluffyExp')
    expect(getHeirloomEff('FluffyExp', 'staff')).toBe(5)
  })

  it('returns 5 when a core slot matches (only 4 core slots)', () => {
    setSetting('slot4modcr', 'lightningTrap')
    expect(getHeirloomEff('lightningTrap', 'core')).toBe(5)
  })

  it('returns 0 when no configured slot matches', () => {
    setSetting('slot1modsh', 'critDamage')
    expect(getHeirloomEff('critChance', 'shield')).toBe(0)
  })
})
