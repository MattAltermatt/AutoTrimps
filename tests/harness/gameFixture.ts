// Phase 0 characterization harness — minimal `game` fixture builder + the anti-false-green guard.
//
// The seam: converted modules read the global `game` as a free identifier. To characterize a
// function we inject a `game` fixture, call the function, and assert its output. For pure-read
// predicates (no game methods), a hand-authored fixture like the one below is sufficient.
//
// For functions that call game METHODS (e.g. game.buildings.Shed.cost.wood()), a fixture must be
// hydrated by overlaying data onto the real newGame() skeleton — never a raw JSON.stringify(game),
// which silently drops every method. `assertHydrated` is the tripwire that catches that mistake.

export type GameOverrides = Record<string, unknown>

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/** Deep-merge `over` onto `base`; primitive/array values in `over` win. */
export function deepMerge<T>(base: T, over: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(over)) return (over as T)
  const out: Record<string, unknown> = { ...base }
  for (const k of Object.keys(over)) {
    out[k] = k in base ? deepMerge((base as Record<string, unknown>)[k], over[k]) : over[k]
  }
  return out as T
}

/** A minimal, plain-data `game` skeleton covering the fields the pure predicates read. */
export function makeMinimalGame(overrides: GameOverrides = {}): Record<string, unknown> {
  const base = {
    global: { world: 1, formation: 0, challengeActive: '' },
    equipment: {},
    resources: { trimps: { maxSoldiers: 1 } },
    portal: { Power: { level: 0, modifier: 0 }, Power_II: { level: 0, modifier: 0 } },
  }
  return deepMerge(base as Record<string, unknown>, overrides)
}

/**
 * Anti-false-green tripwire (from the design spec's guardrails). A properly-hydrated `game`
 * still carries its methods; JSON.stringify silently drops them, which makes a snapshot-replay
 * suite pass while characterizing nothing. Call this before trusting any "unchanged" result on
 * the newGame()-overlay path — if it throws, the fixture is lying.
 */
export function assertHydrated(game: unknown): void {
  const wood = (game as any)?.buildings?.Shed?.cost?.wood
  if (typeof wood !== 'function') {
    throw new Error(
      'game fixture is not hydrated: buildings.Shed.cost.wood is not a function — ' +
        'methods were stripped (did you inject a raw JSON.stringify(game) snapshot?).',
    )
  }
}
