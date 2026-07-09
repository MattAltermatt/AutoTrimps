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
  // stance.ts exports (Wave 1 #26) read as free-ids by scryer.ts (Wave 3 #30).
  // oneShotPower stays `any` — its return feeds `||` expressions that assign back into
  // scryer's boolean `transitionRequired`, so a `number` return would union-cascade.
  function survive(stance?: string, cp?: number): boolean
  function oneShotPower(...rest: any[]): any
  function windStance(...rest: any[]): void
  function autoStance(...rest: any[]): void
  function autoStance2(...rest: any[]): void
  function calcBaseDamageInX(...rest: any[]): void
  var dailyModifiers: any
  // U2 void-contract flag — globalThis-assigned in mapfunctions.ts; read by ab.ts + maps.ts.
  var contractVoid: any
  // AT-fork functions read as free-ids by portal.ts (Wave 3 #30), resolved via the bridge.
  function settingChanged(...rest: any[]): any     // settings-engine.ts
  // Settings-engine free-id reads (settings-engine.ts #31), resolved via the bridge.
  var ATversion: any                                 // AutoTrimps2.js var
  var magmiteSpenderChanged: any                     // AutoTrimps2.js var
  function saveSettings(...rest: any[]): any         // utils.ts
  function updateCustomButtons(...rest: any[]): any  // settings-visibility.ts
  function checkPortalSettings(...rest: any[]): any  // settings-visibility.ts
  // Free-id reads by settings-visibility.ts (#31), resolved via the bridge.
  function debug(...rest: any[]): any                // utils.ts
  function findOutCurrentPortalLevel(...rest: any[]): any // portal.ts
  // Settings accessors (utils.ts, converted) + GRAPHSETTINGS store (Graphs.js) read as
  // free-ids by settings-menu.ts (#31), resolved via the bridge / still-legacy Graphs.js.
  function getPageSetting(...rest: any[]): any    // utils.ts
  function setPageSetting(...rest: any[]): any    // utils.ts
  var GRAPHSETTINGS: any                          // Graphs.js
  // Settings-UI boot fns bridged; read bare by settings-boot.ts.
  function automationMenuInit(...rest: any[]): any        // settings-menu.ts
  function automationMenuSettingsInit(...rest: any[]): any // settings-menu.ts
  function initializeAllTabs(...rest: any[]): any          // settings-menu.ts
  function initializeAllSettings(...rest: any[]): any      // settings-defs.ts
  // Settings-def builders read bare by settings-defs.ts (#31), resolved via the bridge.
  function createSetting(...rest: any[]): any              // settings-engine.ts
  function modifyParentNode(...rest: any[]): any           // settings-engine.ts
  function settingsProfileMakeGUI(...rest: any[]): any     // settings-engine.ts
  // AutoTrimps2.js loader path prefix, read bare by settings-boot.ts.
  var basepath: string
  function autoMagmiteSpender(...rest: any[]): any  // magmite.ts
  function autoheirlooms3(...rest: any[]): any      // heirlooms.ts
  function highdmgshield(...rest: any[]): any       // heirlooms.ts
  function RresetVars(...rest: any[]): any           // mapfunctions.ts
  // AutoTrimps2.js / perks.ts globals read+written bare by portal.ts.
  var zonePostpone: any    // globalThis-assigned in portal.ts, read by AutoTrimps2
  var lastHeliumZone: any  // AutoTrimps2.js var
  var lastRadonZone: any   // AutoTrimps2.js var
  var AutoPerks: any        // globalThis-assigned in perks.ts
  var RAutoPerks: any       // globalThis-assigned in perks.ts
  // localStorage-write helper (AutoTrimps2.js var) read bare by perks.ts.
  function safeSetItems(...args: any[]): any
  // Remote-injected priority queue (legacy/FastPriorityQueue.js, loaded via script tag) —
  // `new FastPriorityQueue(cmp)` in perks.ts; `any` covers construct + poll/add/size.
  var FastPriorityQueue: any

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
  // DecimalBreed = Decimal.clone({...}) at breedtimer.ts load — a constructor with static
  // methods (log10) AND callable (gather.ts calls DecimalBreed(0.1)); `any` covers new/call/static.
  var DecimalBreed: any
  // DOM SPAN created by breedtimer.addBreedingBoxTimers(), assigned to globalThis at load.
  var addbreedTimerInsideText: any
  function safeBuyBuilding(...rest: any[]): any
  var RscienceNeeded: number

  // Equipment/prestige helpers read by bare name from equipment.ts. Prediction math
  // (highDamageShield/getTotalHealthMod/Rcalc* in calc.ts, RgetEnemyMaxHealth in query.ts)
  // converted-but-bridged; doMaxMapBonus (maps.ts) / RdoMaxMapBonus (mapfunctions.ts) /
  // Rgetequipcost (other.ts) still @ts-nocheck. needGymystic / shouldFarm — AutoTrimps2.js
  // combat-readiness vars (needGymystic is the boolean seam noted in the module header).
  function highDamageShield(...rest: any[]): any
  function getTotalHealthMod(...rest: any[]): number
  // maps.ts / mapfunctions.ts boolean state flags (globalThis-assigned, read bare).
  var doMaxMapBonus: any
  var RdoMaxMapBonus: any
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

  // ── maps.ts (Wave 3 #30) owned decision-engine state ───────────────────────
  // U1 + U2 map-loop flags: globalThis-assigned at maps.ts load, read bare here and
  // by mapfunctions/equipment/other/AutoTrimps2. Pragmatic `any` boundary.
  var doVoids: any
  var needToVoid: any
  var needPrestige: any
  var skippedPrestige: any
  var scryerStuck: any
  var shouldDoMaps: any
  var mapTimeEstimate: any
  var lastMapWeWereIn: any
  var preSpireFarming: any
  var spireMapBonusFarming: any
  var spireTime: any
  var vanillaMapatZone: any
  var farmingWonder: any
  var additionalCritMulti: any
  var advExtraMapLevels: any
  // U2 radon-universe farming-mode flags (maps.ts globalThis seam, line 14).
  var RenoughDamage: any
  var RenoughHealth: any
  var RshouldFarm: any
  var RneedToVoid: any
  var RdoVoids: any
  var Rshoulddoquest: any
  var Rquestshieldzone: any
  var Rquestequalityscale: any
  var RshouldDoMaps: any
  var Rshouldfragfarm: any
  var Rshoulddobogs: any
  var Rshoulddopraid: any
  var Rdshoulddopraid: any
  var Rshouldinsanityfarm: any
  var Rshouldalchfarm: any
  var Rshouldstormfarm: any
  var Rshoulddesofarm: any
  var Rshouldequipfarm: any
  var Rshouldmayhem: any
  var Rshouldpanda: any
  var RvanillaMAZ: any
  var Rinsanityfarm: any
  var Rstormfarm: any
  var Rdesofarm: any
  var Rshipfarm: any
  var Ralchfarm: any
  var Rshouldcastle: any
  var Rhypofarm: any
  var Requipfarm: any
  var RlastMapWeWereIn: any
  // mapfunctions.ts globalThis vars read bare by maps.ts.
  var RneedPrestige: any
  var RAMPrepMap1: any
  var RAMPrepMap2: any
  var RAMPrepMap3: any
  var RAMPrepMap4: any
  var RAMPrepMap5: any
  var RdAMPrepMap1: any
  var RdAMPrepMap2: any
  var RdAMPrepMap3: any
  var RdAMPrepMap4: any
  var RdAMPrepMap5: any
  // AT fns read bare by maps.ts: prediction math (calc.ts / equipment.ts / query.ts,
  // converted-but-bridged) + the U2 radon map orchestrators (mapfunctions.ts).
  function areWeAttackLevelCapped(...args: any[]): any
  function calcSpire(...args: any[]): number
  function desodynamicHD(...args: any[]): number
  function stormdynamicHD(...args: any[]): number
  function equipfarmdynamicHD(...args: any[]): any
  function estimateEquipsForZone(...args: any[]): any
  function getEnemyMaxHealth(...args: any[]): number
  function dRAMP(...args: any[]): any
  function RAMP(...args: any[]): any
  function RAMPreset(...args: any[]): any
  function Rbogs(...args: any[]): any
  function RfragMap(...args: any[]): any
  function Rhypo(...args: any[]): any
  function RhypoMap(...args: any[]): any
  function Rinsanity(...args: any[]): any
  function RinsanityMap(...args: any[]): any
  function RlevelMap(...args: any[]): any
  function RmapRepeat(...args: any[]): any
  function Rmayhem(...args: any[]): any
  function RPraid(...args: any[]): any
  function RquestMap(...args: any[]): any
  function RselectMap(...args: any[]): any
  function Rship(...args: any[]): any
  function RshipMap(...args: any[]): any
  function Rshould(...args: any[]): any
  function RsmithyFarm(...args: any[]): any
  function RsmithyFarmMap(...args: any[]): any
  function Rstorm(...args: any[]): any
  function RtimeFarm(...args: any[]): any
  function RtimeFarmMap(...args: any[]): any
  function RtributeFarm(...args: any[]): any
  function RtributeFarmMap(...args: any[]): any
  function Ralch(...args: any[]): any
  function RalchMap(...args: any[]): any
  function Rdeso(...args: any[]): any
  // maps.ts status readouts, bridged; read bare by performance.ts (AFK overlay).
  function updateAutoMapsStatus(...args: any[]): any
  function RupdateAutoMapsStatus(...args: any[]): any

  // ── other.ts (Wave 3 #30) bridged helpers + owned globals ────────────────────
  // Buy-state seam (buystate.ts, converted) + void-map helpers (breedtimer.ts,
  // converted) reached here by bare name via the bridge.
  function preBuy(...rest: any[]): any
  function postBuy(...rest: any[]): void
  function forceAbandonTrimps(...rest: any[]): any
  function abandonVoidMap(...rest: any[]): any
  // Prestige-raid map-family + misc globals: globalThis-assigned at other.ts load,
  // read cross-module by maps.ts / mapfunctions.ts / Graphs.js. Pragmatic `any`.
  var daily3: any
  var praidSetting: any
  var prestraid: any
  var failpraid: any
  var prestraidon: any
  var praidDone: any
  var pMap: any
  var fMap: any
  var pMap1: any
  var pMap2: any
  var pMap3: any
  var pMap4: any
  var pMap5: any
  var mapbought1: any
  var mapbought2: any
  var mapbought3: any
  var mapbought4: any
  var mapbought5: any
  var repMap1: any
  var repMap2: any
  var repMap3: any
  var repMap4: any
  var repMap5: any
  var minMaxMapCost: any
  var shouldFarmFrags: any
  var bwraided: any
  var failbwraid: any
  var bwraidon: any
  var dprestraid: any
  var dfailpraid: any
  var dprestraidon: any
  var dpraidDone: any
  var dpMap1: any
  var dpMap2: any
  var dpMap3: any
  var dpMap4: any
  var dpMap5: any
  var dmapbought1: any
  var dmapbought2: any
  var dmapbought3: any
  var dmapbought4: any
  var dmapbought5: any
  var drepMap1: any
  var drepMap2: any
  var drepMap3: any
  var drepMap4: any
  var drepMap5: any
  var dbwraided: any
  var dfailbwraid: any
  var dbwraidon: any
  var spirebreeding: any
  var trapIndexs: any
  var oldPlayerSpireDrawInfo: any
  var fastimps: any
  // nextWorld — read by Graphs.js; old_nextWorld — its prior-tick snapshot.
  var nextWorld: any
  var old_nextWorld: any
  // Bare raid/map loop flags (globalThis-assigned at other.ts load).
  var perked: any
  var mapbought: any
  var dmapbought: any
  var presteps: any
  // Radon-universe (R-prefixed) mirrors of the prestige-raid globals above.
  var Rprestraid: any
  var Rdprestraid: any
  var Rfailpraid: any
  var Rdfailpraid: any
  var Rbwraided: any
  var Rdbwraided: any
  var Rfailbwraid: any
  var Rdfailbwraid: any
  var Rprestraidon: any
  var Rdprestraidon: any
  var Rmapbought: any
  var Rdmapbought: any
  var Rbwraidon: any
  var Rdbwraidon: any
  var Rpresteps: any
  var RminMaxMapCost: any
  var RfMap: any
  var RpMap: any
  var RshouldFarmFrags: any
  var RpraidDone: any
  // R-map-state globals OWNED by mapfunctions.ts (published via globalThis, read
  // cross-module by maps.ts/equipment.ts and still-legacy code) — Wave 3 #30.
  var sepcial: any
  var levelzones: any
  var selectedMap: any
  var RadditionalCritMulti: any
  var Rtimefarm: any
  var Rdtimefarm: any
  var Rsmithyfarm: any
  var RAMPpMap1: any
  var RAMPpMap2: any
  var RAMPpMap3: any
  var RAMPpMap4: any
  var RAMPpMap5: any
  var RAMPfragmappy: any
  var RAMPprefragmappy: any
  var RAMPmapbought1: any
  var RAMPmapbought2: any
  var RAMPmapbought3: any
  var RAMPmapbought4: any
  var RAMPmapbought5: any
  var RAMPfragmappybought: any
  var RAMPdone: any
  var RAMPfragfarming: any
  var RdAMPpMap1: any
  var RdAMPpMap2: any
  var RdAMPpMap3: any
  var RdAMPpMap4: any
  var RdAMPpMap5: any
  var RdAMPfragmappy: any
  var RdAMPprefragmappy: any
  var RdAMPmapbought1: any
  var RdAMPmapbought2: any
  var RdAMPmapbought3: any
  var RdAMPmapbought4: any
  var RdAMPmapbought5: any
  var RdAMPfragmappybought: any
  var RdAMPdone: any
  var RdAMPfragfarming: any
  var Rmayhemextraglobal: any
  var Rpandaextraglobal: any
  var Rinsanityfragfarming: any
  var insanityfragmappy: any
  var insanityprefragmappy: any
  var insanityfragmappybought: any
  var Rdesoextraglobal: any
  var Requipminusglobal: any
  var Rshipfragfarming: any
  var shipfragmappy: any
  var shipprefragmappy: any
  var shipfragmappybought: any
  var Ralchfragfarming: any
  var alchfragmappy: any
  var alchprefragmappy: any
  var alchfragmappybought: any
  var Rhypofragfarming: any
  var hypofragmappy: any
  var hypoprefragmappy: any
  var hypofragmappybought: any
  // AT helpers defined in sibling converted modules, read by bare name here.
  function Rgetequips(...args: any[]): any
  function RcalcEnemyHealth(...args: any[]): any

  // Settings (de)serialization defined in utils.ts, read by bare name from
  // import-export.ts (export string builders + profile save).
  function serializeSettings(...args: any[]): any
  function serializeSettings550(...args: any[]): any
  function serializeSettings60(...args: any[]): any
  // Runtime module loader + paths — `var`/functions in AutoTrimps2.js.
  function ATscriptLoad(...args: any[]): any
  function ATscriptUnload(...args: any[]): any
  var modulepath: any
  // Automation run flag + module config snapshots — `var` in AutoTrimps2.js.
  var ATrunning: any
  var MODULESdefault: any
  var storedMODULES: any
  // `settingsProfiles` <select> exposed as a DOM-id global; `script` is a
  // for-in loop var that was an implicit global in the sloppy-mode legacy.
  var settingsProfiles: any
  var script: any
}
export {}
