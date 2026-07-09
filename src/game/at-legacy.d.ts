// Ambient declarations for AutoTrimps globals that still live in un-converted
// legacy modules (mostly AutoTrimps2.js). Converted code reads/writes these by
// bare name at runtime; this file only satisfies the type-checker. It SHRINKS as
// the owning modules convert — a global moves out of here the moment its module
// becomes a real import.
declare global {
  // Settings store — `var autoTrimpSettings = {}` in AutoTrimps2.js.
  var autoTrimpSettings: any
  // Logging/debug flags — `var` in AutoTrimps2.js.
  var enableDebug: boolean
  var ATmessageLogTabVisible: boolean
  var aWholeNewWorld: any
  // Shared module config registry — `var MODULES = {}` in AutoTrimps2.js. Converted
  // modules register `MODULES["x"] = {}` and read each other's config by bare name.
  var MODULES: any
  // Log helpers defined in still-legacy modules.
  function getCurrentTime(): string
  function updatePortalTimer(flag?: boolean): string
  function getTabClass(displayed: boolean): string
  function trimMessages(b: string): void

  // Combat / prediction math read by bare name from still-@ts-nocheck modules
  // (calc.ts, fight-info, nature, heirlooms). Pragmatic boundary signatures — these
  // move to real typed imports as their owning modules convert (Wave 1 #27/#28).
  function calcOurDmg(minMaxAvg?: string, ...rest: any[]): number
  function calcOurBlock(...rest: any[]): number
  function calcOurHealth(...rest: any[]): number
  function calcEnemyHealth(...rest: any[]): number
  function calcSpecificEnemyHealth(...rest: any[]): number
  function calcSpecificEnemyAttack(...rest: any[]): number
  function getPierceAmt(...rest: any[]): number
  function addPoison(...rest: any[]): number
  function getCurrentEnemy(offset?: number): any
  function getEmpowerment(zone?: number): string
  function challengeActive(name?: string): any
  function calcCurrentStance(): number | undefined
  function setFormation(formation?: string | number): void
  function lowHeirloom(): void
  function highHeirloom(): void
  function dlowHeirloom(): void
  function dhighHeirloom(): void
  var dailyModifiers: any

  // Shared combat-base globals (AutoTrimps2 vars). stance.ts writes them; calc.ts reads.
  var baseDamage: number
  var baseBlock: number
  var baseHealth: number
  var baseMinDamage: number
  var baseMaxDamage: number

  // Enemy-attack / corruption predictors still in @ts-nocheck AT modules
  // (query.ts, other.ts) — pragmatic boundary sigs; move to real imports as those
  // modules convert.
  function getEnemyMaxAttack(...rest: any[]): number
  function RgetEnemyMaxAttack(...rest: any[]): number
  function getCorruptedCellsNum(...rest: any[]): number
  function getCorruptScale(...rest: any[]): number
  function isActiveSpireAT(...rest: any[]): boolean
  function disActiveSpireAT(...rest: any[]): boolean
  // gammaBurst % — `var` in AutoTrimps2.js.
  var gammaBurstPct: number

  // Buy-state save/restore (buystate.ts, converted) + affordability/quest helpers still in
  // @ts-nocheck AT modules (equipment.ts, other.ts, mapfunctions.ts) + AutoTrimps2.js / mods.js.
  // Pragmatic boundary sigs; move to real imports as those modules convert.
  function preBuy2(...rest: any[]): any
  function postBuy2(...rest: any[]): void
  function getMaxAffordable(...rest: any[]): number
  function questcheck(...rest: any[]): number
  function RsmithyCalc(...rest: any[]): any

  // Building-purchase helpers read by bare name from buildings.ts: isBuildingInQueue
  // (query.ts), smithylogic (other.ts) still @ts-nocheck; calcBadGuyDmg/RcalcHDratio
  // (calc.ts) + evaluateEquipmentEfficiency (equipment.ts) converted but bridged by bare
  // name. Pragmatic boundary sigs; move to real imports as those modules convert.
  function isBuildingInQueue(...rest: any[]): boolean
  function smithylogic(...rest: any[]): boolean
  function calcBadGuyDmg(...rest: any[]): number
  function RcalcHDratio(...rest: any[]): number
  function evaluateEquipmentEfficiency(...rest: any[]): any
  // bestBuilding — `var` in AutoTrimps2.js (loads first); buildings.ts writes it as the
  // shared "chosen building" seam. Rhyposhouldwood — radon hypo-farm wood flag (AT var).
  var bestBuilding: any
  var Rhyposhouldwood: any

  // Upgrade-purchase helpers read by bare name from upgrades.ts: getPerSecBeforeManual
  // (query.ts) still @ts-nocheck; calcHDratio (calc.ts) converted but bridged. upgradeList /
  // RupgradeList — `globalThis.X = [...]` seam arrays written here, read by still-legacy
  // query.js by bare name. enoughHealth / enoughDamage — combat-readiness flags (AutoTrimps2.js
  // vars) read in the firstGiga gate.
  function getPerSecBeforeManual(...rest: any[]): number
  function calcHDratio(...rest: any[]): number
  var upgradeList: string[]
  var RupgradeList: string[]
  var enoughHealth: any
  var enoughDamage: any

  // Gather/labor helpers read by bare name from gather.ts: breeding math (breedtimer.ts,
  // converted) + safeBuyBuilding (buildings.ts, converted) reach here via the bridge.
  // RscienceNeeded — radon science threshold (AutoTrimps2.js var). Decimal-returning breed
  // fns typed `any` at the boundary (we don't own break_infinity's Decimal).
  function trimpsEffectivelyEmployed(...rest: any[]): number
  function breedingPS(...rest: any[]): any
  function breedTimeRemaining(...rest: any[]): any
  function DecimalBreed(...rest: any[]): any
  function safeBuyBuilding(...rest: any[]): any
  var RscienceNeeded: number

  // Equipment/prestige helpers read by bare name from equipment.ts. Prediction math
  // (highDamageShield/getTotalHealthMod/Rcalc* in calc.ts, RgetEnemyMaxHealth in query.ts)
  // converted-but-bridged; doMaxMapBonus (maps.ts) / RdoMaxMapBonus (mapfunctions.ts) /
  // Rgetequipcost (other.ts) still @ts-nocheck. needGymystic / shouldFarm — AutoTrimps2.js
  // combat-readiness vars (needGymystic is the boolean seam noted in the module header).
  function highDamageShield(...rest: any[]): any
  function getTotalHealthMod(...rest: any[]): number
  function doMaxMapBonus(...rest: any[]): any
  function RdoMaxMapBonus(...rest: any[]): any
  function Rgetequipcost(...rest: any[]): number
  function RgetEnemyMaxHealth(...rest: any[]): number
  function RcalcOurDmg(...rest: any[]): number
  function RcalcBadGuyDmg(...rest: any[]): number
  function RcalcOurHealth(...rest: any[]): number
  var needGymystic: any
  var shouldFarm: any
  var isSteam: any
  var scienceNeeded: number
  var breedFire: any
  // U2 radon farming-mode flags — AutoTrimps2.js vars.
  var Rshouldtimefarm: any
  var Rdshouldtimefarm: any
  var Rshouldsmithyfarm: any
  var Rshouldtributefarm: any
  var Rdshouldtributefarm: any
  var Rshouldshipfarm: any
  var Rshouldhypofarm: any
  // Shield-swap seam var — bare-written by heirlooms.ts HeirloomShieldSwapped, created at
  // AutoTrimps2.js top level (like gammaBurstPct).
  var shieldEquipped: any
  // Shield high-damage crit seam vars — calc.ts writes them (via globalThis),
  // legacy equipment.js + maps.js read them.
  var critCC: number
  var critDD: number
  var trimpAA: number
}
export {}
