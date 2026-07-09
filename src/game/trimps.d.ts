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
  function countRemainingEssenceDrops(...args: any[]): number // main.js (Scryer essence)
  function getNextNatureCost(...args: any[]): number // main.js (nature tokens)
  function updateNatureInfoSpans(...args: any[]): void // main.js
  function naturePurchase(...args: any[]): void // main.js
  // break_infinity Decimal library (game-loaded); pragmatic `any` — new/call/static (clone/log10).
  var Decimal: any
  function calcHeirloomBonusDecimal(...args: any[]): any // main.js (Decimal-returning)
  function getNextGeneticistCost(...args: any[]): number // main.js
  function addGeneticist(...args: any[]): void // main.js
  function removeGeneticist(...args: any[]): void // main.js
  function mapsClicked(...args: any[]): void // main.js
  function runMap(...args: any[]): void // main.js
  // Portal / daily / challenge window helpers (main.js) — read by portal.ts.
  function cancelTooltip(...args: any[]): void
  function tooltip(...args: any[]): void
  // DOM class-swap helper (main.js) + tooltip-identity global read by the keydown handlers.
  function swapClass(...args: any[]): void
  var lastTooltipTitle: any
  function abandonDaily(...args: any[]): void
  function abandonChallenge(...args: any[]): void
  function selectChallenge(...args: any[]): void
  function viewPortalUpgrades(...args: any[]): void
  function numTab(...args: any[]): void
  function buyPortalUpgrade(...args: any[]): void
  function activateClicked(...args: any[]): void
  function cancelPortal(...args: any[]): void
  function portalClicked(...args: any[]): void
  function activatePortal(...args: any[]): void
  function swapPortalUniverse(...args: any[]): void
  function checkCompleteDailies(...args: any[]): void
  function getDailyTimeString(...args: any[]): any
  function getDailyChallenge(...args: any[]): any
  var portalWindowOpen: any // main.js var (boolean)
  var portalUniverse: any   // main.js var (number)

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

  // Native map-UI / map-purchase helpers (main.js, updates.js) read by bare name from
  // maps.ts (Wave 3 #30). Pragmatic boundary sigs. offlineProgress / mapSpecialModifierConfig
  // are game `var` objects; the *AdvMaps* names are DOM elements the browser exposes as
  // id-named window globals (maps.ts reads/writes their `.value`).
  function selectMap(...args: any[]): any
  function buyMap(...args: any[]): any
  function recycleMap(...args: any[]): any
  function recycleBelow(...args: any[]): any
  function getMapIndex(...args: any[]): number
  function adjustMap(...args: any[]): void
  function addSpecials(...args: any[]): void
  function updateMapCost(...args: any[]): any
  function repeatClicked(...args: any[]): void
  function selectAdvMapsPreset(...args: any[]): void
  function checkPerfectChecked(...args: any[]): boolean
  function getSpecialModifierSetting(...args: any[]): any
  function getExtraMapLevels(...args: any[]): number
  function getTotalPortals(...args: any[]): number
  function toggleEqualityScale(...args: any[]): void
  function toggleSetting(...args: any[]): void
  function countStackedVoidMaps(...args: any[]): number
  var offlineProgress: any
  var mapSpecialModifierConfig: any
  var sizeAdvMapsRange: any
  var difficultyAdvMapsRange: any
  var lootAdvMapsRange: any
  var biomeAdvMapsSelect: any
  var mapLevelInput: any
  function getHighestLevelCleared(...args: any[]): any

  // Native spire / equality / misc helpers (main.js) + playerSpire.js state object read
  // by bare name from other.ts (Wave 3 #30). Pragmatic boundary sigs.
  var playerSpire: any
  function magnetoShriek(...args: any[]): any
  function endSpire(...args: any[]): any
  function fightManual(...args: any[]): any
  function manageEqualityStacks(...args: any[]): any
  function updateEqualityScaling(...args: any[]): any
  function toggleGeneticistassist(...args: any[]): any
}

export {}
