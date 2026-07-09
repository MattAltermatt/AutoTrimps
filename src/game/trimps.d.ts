// Ambient declarations for the Trimps global API that AutoTrimps calls into.
// Grown pay-as-you-go as modules are converted (Phase 1+). Kept intentionally
// loose in Phase 0 — nothing is type-checked against it yet.

declare global {
  // The Trimps game object. Typed as `any` until a converted module needs a
  // real shape; this is the single documented seam between us and the game.
  const game: any

  // Native game combat/crit/scaling helpers the game engine defines (config.js /
  // main.js), called by bare name from converted modules. Pragmatic boundary sigs
  // (§5): typed return, loose args — we don't own the 40k-line game object.
  function prettify(...args: any[]): string
  function getPlayerCritChance(...args: any[]): number
  function getPlayerCritDamageMult(...args: any[]): number
  function getMegaCritDamageMult(tier?: number): number
  function getPlayerDoubleCritChance(...args: any[]): number
  function getBadCoordLevel(...args: any[]): number
  function getScientistLevel(...args: any[]): number
  function getCurrentMapObject(...args: any[]): any
  function getCurrentWorldCell(...args: any[]): any
  function getCurrentMapCell(...args: any[]): any
  function getEnergyShieldMult(...args: any[]): number
  function calcHeirloomBonus(...args: any[]): number
  function getRetainModifier(...args: any[]): number
  function checkIfLiquidZone(...args: any[]): boolean

  // Native game state objects.
  const mutations: any
  const Fluffy: any
  const sugarRush: any
  const playerSpireTraps: any
  const autoBattle: any
  const u2Mutations: any
  const alchObj: any
}

export {}
