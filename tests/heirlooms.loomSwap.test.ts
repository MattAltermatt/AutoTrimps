// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'

// Regression for the loom-swap crash (#22): the reader functions (lowHeirloom/…) read a bare `loom`
// that the port left unbound after localizing the finder loops → ReferenceError that aborted the
// whole automation tick. The fix captures the finder's return value. This drives the guard-entering
// path and asserts it equips instead of throwing.

let lowHeirloom: () => void

beforeAll(async () => {
  // heirlooms.ts reads game.options at import time and appends to the heirloom btn groups (seeded
  // in tests/setup.ts). Set a minimal game first, then dynamic-import so it runs after globals exist.
  ;(globalThis as any).game = { options: { menu: { showHeirloomAnimations: { enabled: false } } } }
  lowHeirloom = (await import('../src/modules/heirlooms')).lowHeirloom
})

describe('heirlooms loom swap (#22 seam crash)', () => {
  beforeEach(() => {
    const myLoom = { name: 'MyLoom' }
    ;(globalThis as any).game = {
      global: { heirloomsCarried: [myLoom], ShieldEquipped: { name: 'OtherShield' } },
    }
    ;(globalThis as any).autoTrimpSettings = { lowdmg: { type: 'textValue', value: 'MyLoom' } }
    ;(globalThis as any).selectHeirloom = vi.fn()
    ;(globalThis as any).equipHeirloom = vi.fn()
  })

  it('equips the matching carried heirloom without throwing (was ReferenceError: loom)', () => {
    expect(() => lowHeirloom()).not.toThrow()
    expect((globalThis as any).selectHeirloom).toHaveBeenCalledWith(0, 'heirloomsCarried', true)
    expect((globalThis as any).equipHeirloom).toHaveBeenCalledOnce()
  })

  it('does nothing (and does not throw) when no carried heirloom matches the setting', () => {
    ;(globalThis as any).autoTrimpSettings.lowdmg.value = 'NotCarried'
    expect(() => lowHeirloom()).not.toThrow()
    expect((globalThis as any).selectHeirloom).not.toHaveBeenCalled()
  })
})
