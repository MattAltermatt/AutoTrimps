// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// Regression net for #65: Rmayhemmap option 1 ("M: Highest Map") was a complete no-op — identical to
// option 0 ("M: Maps Off"). Every read in the tree compared against 2 only (maps.ts:1511 run gate,
// mapfunctions.ts RmayhemExtra + RselectMayhem), so selecting it ran no mayhem map at all.
//
// The setting's own tooltip specifies the intended behavior exactly: "M: Highest map always selects
// the highest map you have whether it be from Praiding, Time Farming or any you have manually
// created." Note this is the ONLY selector in mapfunctions.ts that takes a MAX level — every other
// one (Panda/Deso/Frag/smart-Mayhem) matches an EXACT level, so there was no helper to reuse.

let mapfunctions: typeof import('../src/modules/mapfunctions')

const setSetting = (id: string, value: unknown) => {
  ;(globalThis as any).autoTrimpSettings[id] = { type: 'multitoggle', value }
}

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).Rshouldmayhem = 0
  ;(globalThis as any).getPlayerCritChance = () => 0 // read at module load (mapfunctions.ts:26)
  mapfunctions = await import('../src/modules/mapfunctions')
})

beforeEach(() => {
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).Rshouldmayhem = 0
  ;(globalThis as any).game = { global: { world: 30, mapsOwnedArray: [] } }
})

describe('RselectMayhem — option 1 "M: Highest Map" (#65)', () => {
  it('picks the highest-level owned map, not one matching the current zone', () => {
    setSetting('Rmayhemmap', 1)
    ;(globalThis as any).game.global.mapsOwnedArray = [
      { id: 'low', level: 12, noRecycle: false },
      { id: 'highest', level: 28, noRecycle: false },
      { id: 'mid', level: 20, noRecycle: false },
    ]
    // note: none of these is at world level (30) — the old else-branch would have said "create"
    expect(mapfunctions.RselectMayhem()).toBe('highest')
  })

  it('skips noRecycle (unique/special) maps even when they are the highest', () => {
    setSetting('Rmayhemmap', 1)
    ;(globalThis as any).game.global.mapsOwnedArray = [
      { id: 'unique', level: 99, noRecycle: true }, // must be ignored
      { id: 'best-recyclable', level: 25, noRecycle: false },
    ]
    expect(mapfunctions.RselectMayhem()).toBe('best-recyclable')
  })

  it('falls back to "create" when no recyclable map is owned', () => {
    setSetting('Rmayhemmap', 1)
    ;(globalThis as any).game.global.mapsOwnedArray = [{ id: 'unique', level: 99, noRecycle: true }]
    expect(mapfunctions.RselectMayhem()).toBe('create')
  })

  it('option 2 ("Smart Map") is untouched — still exact-matches world + RmayhemExtra', () => {
    setSetting('Rmayhemmap', 2)
    ;(globalThis as any).Rshouldmayhem = 1
    setSetting('Rmayhemamcut', -1)
    setSetting('Rmayhemhcut', -1)
    // RmayhemExtra's calc needs these; force the "no extra levels survive" path → extra 0
    ;(globalThis as any).RcalcOurHealth = () => 0
    ;(globalThis as any).RcalcOurDmg = () => 0
    ;(globalThis as any).RcalcEnemyHealth = () => Infinity
    ;(globalThis as any).RcalcBadGuyDmg = () => Infinity
    ;(globalThis as any).RgetEnemyMaxAttack = () => 1
    ;(globalThis as any).game.challenges = { Mayhem: { getBossMult: () => 1 } }
    ;(globalThis as any).game.global.mapsOwnedArray = [
      { id: 'higher', level: 40, noRecycle: false }, // highest, but NOT world+extra → not chosen
      { id: 'at-world', level: 30, noRecycle: false },
    ]
    // extra resolves to 0 → wants level == world (30) exactly, NOT the highest (40)
    expect(mapfunctions.RselectMayhem()).toBe('at-world')
  })
})
