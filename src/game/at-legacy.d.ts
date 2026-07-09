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
}
export {}
