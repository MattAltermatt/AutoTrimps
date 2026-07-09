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

  // Native game job/building buy helpers (main.js).
  function canAffordJob(...args: any[]): boolean
  function buyJob(...args: any[]): void
  function canAffordBuilding(...args: any[]): boolean
  function calculateMaxAfford(...args: any[]): number
  function getBuildingItemPrice(...args: any[]): number

  // Native game heirloom management (main.js).
  function selectHeirloom(...args: any[]): void
  function carryHeirloom(...args: any[]): void
  function stopCarryHeirloom(...args: any[]): void
  function equipHeirloom(...args: any[]): void
  function getMaxCarriedHeirlooms(...args: any[]): number
  function getSelectedHeirloom(...args: any[]): any
  function setupDummyHeirloom(...args: any[]): any
  function countPriceOfUpgrades(...args: any[]): number
  function isNumberBad(...args: any[]): boolean
  function getModUpgradeCost(...args: any[]): number
  function selectMod(...args: any[]): void
  function upgradeMod(...args: any[]): void
  function getHeirloomIcon(...args: any[]): string
  function getHeirloomBonus(...args: any[]): number
  var heirloomsShown: any

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
