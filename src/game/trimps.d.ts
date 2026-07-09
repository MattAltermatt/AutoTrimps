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
  function buyBuilding(...args: any[]): void
  function bwRewardUnlocked(...args: any[]): boolean
  function canAffordCoordinationTrimps(...args: any[]): boolean
  function toggleAutoStorage(...args: any[]): void
  function simpleSeconds(...args: any[]): number
  function scaleToCurrentMap(...args: any[]): number
  function getPsString(...args: any[]): number // updates.js
  function buyUpgrade(...args: any[]): any
  function canAffordTwoLevel(...args: any[]): boolean
  function getAvailableGoldenUpgrades(...args: any[]): number
  function buyGoldenUpgrade(...args: any[]): boolean

  // Native game generator/magmite helpers (main.js).
  function buyGeneratorUpgrade(...args: any[]): void
  function buyPermanentGeneratorUpgrade(...args: any[]): void
  function changeGeneratorState(...args: any[]): void

  // Native game gather/labor helpers (main.js / updates.js).
  function setGather(...args: any[]): void
  function getPlayerModifier(...args: any[]): number
  function getZoneSeconds(...args: any[]): number // updates.js

  // Native game equipment helpers (main.js).
  function buyEquipment(...args: any[]): any
  function getNextPrestigeCost(...args: any[]): number

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
