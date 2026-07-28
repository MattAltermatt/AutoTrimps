import { describe, it, expect } from 'vitest'
import { bootGame, assertGameHydrated } from '../../scripts/sim/boot.mjs'

describe('sim/boot', () => {
  it('boots the game into jsdom with a live game object at world 1', () => {
    const { game } = bootGame()
    expect(typeof game).toBe('object')
    expect(game.global.world).toBe(1)
  })

  it('passes the anti-false-green tripwire (game methods are real functions)', () => {
    const { game } = bootGame()
    expect(typeof game.buildings.Shed.cost.wood).toBe('function')
  })

  // The test above proves the tripwire is SATISFIED. It does not prove the tripwire can ever FAIL —
  // and a condition that is vacuously true is not a tripwire, it is decoration.
  //
  // ⚠️ THIS GUARD'S FIRST VERSION WAS ITSELF THE BUG IT HUNTS. The 2026-07-28 audit flagged that
  // nothing asserted boot's hydration throw could fire; the "repair" then re-derived the field-path
  // expression against a JSON clone of the already-returned game and never called into boot.mjs at
  // all — so deleting the check outright would have left all three tests green. A code review caught
  // it. The check is now an EXPORTED predicate (boot.mjs), so the throw is exercised for real.
  //
  // The hazard it guards is specific and documented: injecting a game via raw JSON.stringify silently
  // drops the ~1091 game METHODS (game.buildings.Shed.cost.wood is a function, not a number), which
  // yields a fully-populated-looking object and a green suite that tests nothing.
  it('assertGameHydrated ACCEPTS a really-booted game', () => {
    const { game } = bootGame()
    expect(() => assertGameHydrated(game)).not.toThrow()
  })

  it('assertGameHydrated THROWS on a JSON-round-tripped game — the trap it exists for', () => {
    const { game } = bootGame()
    const methodless = JSON.parse(JSON.stringify(game))
    expect(() => assertGameHydrated(methodless)).toThrow(/not hydrated/)
    // ...and it still LOOKS like a real game, which is precisely why the tripwire has to exist.
    expect(methodless.global.world).toBe(game.global.world)
    expect(Object.keys(methodless.buildings)).toEqual(Object.keys(game.buildings))
  })

  it('assertGameHydrated throws on the degenerate inputs too (no vacuous pass)', () => {
    expect(() => assertGameHydrated(undefined)).toThrow(/not hydrated/)
    expect(() => assertGameHydrated({})).toThrow(/not hydrated/)
    expect(() => assertGameHydrated({ buildings: { Shed: { cost: { wood: 500 } } } })).toThrow(/not hydrated/)
  })
})
