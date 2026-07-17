import { describe, it, expect } from 'vitest'
import { REGIONS, HUD_ROOT_ID } from '../../src/modules/custom-ui/regions'

describe('custom-ui region registry', () => {
  it('registers the whole-HUD region adopting #wrapper', () => {
    expect(HUD_ROOT_ID).toBe('wrapper')
    expect(REGIONS.map((r) => r.containerId)).toContain('wrapper')
  })
  it('every region has a valid status', () => {
    const valid = new Set(['adopted', 'at-styled', 'at-native'])
    for (const r of REGIONS) expect(valid.has(r.status)).toBe(true)
  })
})
