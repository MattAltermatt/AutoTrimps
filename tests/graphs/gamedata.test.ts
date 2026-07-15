import { describe, it, expect, afterEach } from 'vitest'
import { getGameData } from '../../src/modules/graphs/gamedata'

// Phase-1 Fix A, ported off eval(GRAPHS_SRC): the overkill() data accessor must count the game's own
// per-cell `.overkilled` state and must NEVER mutate the player's save. The old code force-enabled
// (and persisted) game.options.menu.overkillColor just to count DOM classes — a data reader writing
// the save. This asserts the count AND the no-mutation invariant.

const g = globalThis as unknown as { game?: unknown }

afterEach(() => {
  delete g.game
})

describe('getGameData.overkill()', () => {
  it('counts .overkilled grid cells without mutating overkillColor.enabled', () => {
    g.game = {
      global: {
        mapsActive: false,
        gridArray: [{ overkilled: true }, { overkilled: false }, { overkilled: true }],
      },
      options: { menu: { overkillColor: { enabled: 0 }, liquification: { enabled: false } } },
      talents: { liquification: { purchased: false } },
    }

    expect(getGameData.overkill()).toBe(2)

    // Mutation check (Fix A): a data reader must not touch the player's settings.
    const after = g.game as { options: { menu: { overkillColor: { enabled: number } } } }
    expect(after.options.menu.overkillColor.enabled).toBe(0)
  })

  it('reads mapGridArray when a map is active', () => {
    g.game = {
      global: {
        mapsActive: true,
        gridArray: [{ overkilled: true }],
        mapGridArray: [{ overkilled: true }, { overkilled: true }, { overkilled: false }],
      },
      options: { menu: { overkillColor: { enabled: 0 }, liquification: { enabled: false } } },
      talents: { liquification: { purchased: false } },
    }
    expect(getGameData.overkill()).toBe(2)
  })
})
