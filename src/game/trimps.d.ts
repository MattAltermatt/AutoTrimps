// Ambient declarations for the Trimps global API that AutoTrimps calls into.
// Grown pay-as-you-go as modules are converted (Phase 1+). Kept intentionally
// loose in Phase 0 — nothing is type-checked against it yet.

declare global {
  // The Trimps game object. Typed as `any` until a converted module needs a
  // real shape; this is the single documented seam between us and the game.
  const game: any
}

export {}
