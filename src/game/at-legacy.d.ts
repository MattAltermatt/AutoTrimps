// at-legacy.d.ts — the PERMANENT bare-name globalThis seam between converted modules.
// (Phase 1 is complete; this file no longer "shrinks as modules convert".) Converted
// modules read each other's state by bare name via legacy-bridge's globalThis spread,
// so those names need ambient declarations here. Three kinds of entry:
//   1. Functions with a single converted owning module -> declared
//      `var fn: typeof import('../modules/X').fn` so the ambient signature is generated
//      from the source of truth and cannot drift.
//   2. Functions with NO single typed source (native game fns bridged here, functions
//      exported from two modules, or still-legacy AutoTrimps2.js fns) -> kept as a
//      hand-written signature; there is nothing to import from.
//   3. Informal cross-module state flags (booleans/numbers/undefined tri-states) -> kept
//      `any` by design; precisely typing all of them is low-value and risks wrong narrowing.
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

  // Combat / prediction math read by bare name (calc.ts). Mostly typeof-imports below;
  // calcOurDmg stays hand-written — see its note.
  // NOT a typeof-import: real calc.calcOurDmg returns `number | undefined`, but callers
  // assign it into `number`-typed globals/locals unguarded (stance baseDamage/baseMin/baseMax,
  // equipment ourDamage, maps ourBaseDamage/mapdmg). Latent bug -> #32.
  function calcOurDmg(minMaxAvg?: string, ...rest: any[]): number
  var calcOurBlock: typeof import('../modules/calc').calcOurBlock
  var calcOurHealth: typeof import('../modules/calc').calcOurHealth
  var calcEnemyHealth: typeof import('../modules/calc').calcEnemyHealth
  var calcSpecificEnemyHealth: typeof import('../modules/calc').calcSpecificEnemyHealth
  var calcSpecificEnemyAttack: typeof import('../modules/calc').calcSpecificEnemyAttack
  function getPierceAmt(...rest: any[]): number
  var addPoison: typeof import('../modules/calc').addPoison
  var getCurrentEnemy: typeof import('../modules/query').getCurrentEnemy
  function getEmpowerment(zone?: number): string
  function challengeActive(name?: string): any
  var calcCurrentStance: typeof import('../modules/calc').calcCurrentStance
  function setFormation(formation?: string | number): void
  var lowHeirloom: typeof import('../modules/heirlooms').lowHeirloom
  var highHeirloom: typeof import('../modules/heirlooms').highHeirloom
  var dlowHeirloom: typeof import('../modules/heirlooms').dlowHeirloom
  var dhighHeirloom: typeof import('../modules/heirlooms').dhighHeirloom
  // stance.ts exports (Wave 1 #26) read as free-ids by scryer.ts (Wave 3 #30).
  // oneShotPower stays `any` — its return feeds `||` expressions that assign back into
  // scryer's boolean `transitionRequired`, so a `number` return would union-cascade.
  var survive: typeof import('../modules/stance').survive
  function oneShotPower(...rest: any[]): any
  var windStance: typeof import('../modules/stance').windStance
  var autoStance: typeof import('../modules/stance').autoStance
  var autoStance2: typeof import('../modules/stance').autoStance2
  function calcBaseDamageInX(...rest: any[]): void
  var dailyModifiers: any
  // U2 void-contract flag — globalThis-assigned in mapfunctions.ts; read by ab.ts + maps.ts.
  var contractVoid: any
  // AT-fork functions read as free-ids by portal.ts (Wave 3 #30), resolved via the bridge.
  var settingChanged: typeof import('../modules/settings-engine').settingChanged
  var renderControlFace: typeof import('../modules/settings-engine').renderControlFace // #39, read by settings-visibility every tick
  // Settings-engine free-id reads (settings-engine.ts #31), resolved via the bridge.
  var ATversion: any                                 // AutoTrimps2.js var
  var magmiteSpenderChanged: any                     // AutoTrimps2.js var
  var saveSettings: typeof import('../modules/utils').saveSettings
  var updateCustomButtons: typeof import('../modules/settings-visibility').updateCustomButtons
  var checkPortalSettings: typeof import('../modules/settings-visibility').checkPortalSettings
  // Free-id reads by settings-visibility.ts (#31), resolved via the bridge.
  var debug: typeof import('../modules/utils').debug
  var findOutCurrentPortalLevel: typeof import('../modules/portal').findOutCurrentPortalLevel
  // Settings accessors (utils.ts, converted) + GRAPHSETTINGS store (Graphs.js) read as
  // free-ids by settings-menu.ts (#31), resolved via the bridge / still-legacy Graphs.js.
  var getPageSetting: typeof import('../modules/utils').getPageSetting
  var setPageSetting: typeof import('../modules/utils').setPageSetting
  // #100 — the one spelling of "did the user type a name into this textValue setting?". Accepts every
  // encoding of unset ('undefined' | '' | false | undefined); see the doc comment on the export.
  var textSettingIsSet: typeof import('../modules/utils').textSettingIsSet
  var getPageSettingAt: typeof import('../modules/utils').getPageSettingAt
  function byId<T extends HTMLElement = HTMLInputElement>(id: string): T  // utils.ts (typed DOM helper)
  var GRAPHSETTINGS: any                          // Graphs.js
  // Settings-UI boot fns bridged; read bare by settings-boot.ts.
  var automationMenuInit: typeof import('../modules/settings-menu').automationMenuInit
  var automationMenuSettingsInit: typeof import('../modules/settings-menu').automationMenuSettingsInit
  var initializeAllTabs: typeof import('../modules/settings-menu').initializeAllTabs
  var initializeAllSettings: typeof import('../modules/settings-defs').initializeAllSettings
  // Settings-def builders read bare by settings-defs.ts (#31), resolved via the bridge.
  var createSetting: typeof import('../modules/settings-engine').createSetting
  // #76: the id census every createSetting call registers into — read by import-export's
  // cleanupCandidates() to answer "does THIS BUILD still declare this key?" without asking the DOM.
  // Bridged rather than ESM-imported on purpose: a real import edge from import-export → settings-engine
  // reorders the whole bundle's module-evaluation order (import-export has top-level side effects), and
  // this seam is exactly what at-legacy.d.ts exists for.
  var definedSettingIds: typeof import('../modules/settings-engine').definedSettingIds
  var modifyParentNode: typeof import('../modules/settings-menu').modifyParentNode
  function settingsProfileMakeGUI(...rest: any[]): any     // settings-engine.ts
  // AutoTrimps2.js loader path prefix, read bare by settings-boot.ts.
  var basepath: string
  var autoMagmiteSpender: typeof import('../modules/magmite').autoMagmiteSpender
  var autoheirlooms3: typeof import('../modules/heirlooms').autoheirlooms3
  var highdmgshield: typeof import('../modules/heirlooms').highdmgshield
  var RresetVars: typeof import('../modules/mapfunctions').RresetVars
  // AutoTrimps2.js / perks.ts globals read+written bare by portal.ts.
  var zonePostpone: any    // globalThis-assigned in portal.ts, read by AutoTrimps2
  var lastHeliumZone: any  // AutoTrimps2.js var
  var lastRadonZone: any   // AutoTrimps2.js var
  var AutoPerks: any        // globalThis-assigned in perks.ts
  var RAutoPerks: any       // globalThis-assigned in perks.ts
  // localStorage-write helper (AutoTrimps2.js var) read bare by perks.ts.
  // NOT a typeof-import: utils.safeSetItems types value `string`, but perks.ts passes
  // numbers (.selectedIndex/ratioSet) at 4 sites — runtime-benign localStorage coercion,
  // type-dishonest. Latent bug tracked in #32; kept loose here so callers still compile.
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

  // Enemy-attack / corruption predictors (query.ts) + spire helpers (other.ts).
  var getEnemyMaxAttack: typeof import('../modules/query').getEnemyMaxAttack
  // NOT a typeof-import: real RgetEnemyMaxAttack takes 3 args (world, level, name), but
  // callers pass a 4th (a multiplier/difficulty) that the fn silently drops — unlike its
  // U1 sibling getEnemyMaxAttack, which applies that arg as `d`. Balance asymmetry -> #32.
  function RgetEnemyMaxAttack(...rest: any[]): number
  var getCorruptedCellsNum: typeof import('../modules/query').getCorruptedCellsNum
  var getCorruptScale: typeof import('../modules/query').getCorruptScale
  var isActiveSpireAT: typeof import('../modules/other').isActiveSpireAT
  var disActiveSpireAT: typeof import('../modules/other').disActiveSpireAT
  // gammaBurst % — `var` in AutoTrimps2.js.
  var gammaBurstPct: number

  // Buy-state save/restore (buystate.ts) + affordability/quest helpers
  // (equipment.ts, other.ts, mapfunctions.ts).
  var preBuy2: typeof import('../modules/buystate').preBuy2
  var postBuy2: typeof import('../modules/buystate').postBuy2
  var getMaxAffordable: typeof import('../modules/equipment').getMaxAffordable
  var questcheck: typeof import('../modules/other').questcheck
  var RsmithyCalc: typeof import('../modules/mapfunctions').RsmithyCalc

  // Building-purchase helpers read by bare name from buildings.ts: isBuildingInQueue
  // (query.ts), smithylogic (other.ts), calcBadGuyDmg/RcalcHDratio (calc.ts),
  // evaluateEquipmentEfficiency (equipment.ts).
  var isBuildingInQueue: typeof import('../modules/query').isBuildingInQueue
  var smithylogic: typeof import('../modules/other').smithylogic
  var calcBadGuyDmg: typeof import('../modules/calc').calcBadGuyDmg
  var RcalcHDratio: typeof import('../modules/calc').RcalcHDratio
  var evaluateEquipmentEfficiency: typeof import('../modules/equipment').evaluateEquipmentEfficiency
  // bestBuilding — `var` in AutoTrimps2.js (loads first); buildings.ts writes it as the
  // shared "chosen building" seam. Rhyposhouldwood — radon hypo-farm wood flag (AT var).
  var bestBuilding: any
  var Rhyposhouldwood: any

  // Upgrade-purchase helpers read by bare name from upgrades.ts: getPerSecBeforeManual
  // (query.ts), calcHDratio (calc.ts). upgradeList / RupgradeList — `globalThis.X = [...]`
  // seam arrays. enoughHealth / enoughDamage — combat-readiness flags (AutoTrimps2.js vars)
  // read in the firstGiga gate.
  var getPerSecBeforeManual: typeof import('../modules/query').getPerSecBeforeManual
  var calcHDratio: typeof import('../modules/calc').calcHDratio
  var upgradeList: string[]
  var RupgradeList: string[]
  var enoughHealth: any
  var enoughDamage: any

  // Gather/labor helpers read by bare name from gather.ts: breeding math (breedtimer.ts,
  // converted) + safeBuyBuilding (buildings.ts, converted) reach here via the bridge.
  // RscienceNeeded — radon science threshold (AutoTrimps2.js var). Decimal-returning breed
  // fns typed `any` at the boundary (we don't own break_infinity's Decimal).
  var trimpsEffectivelyEmployed: typeof import('../modules/breedtimer').trimpsEffectivelyEmployed
  var breedingPS: typeof import('../modules/breedtimer').breedingPS
  var breedTimeRemaining: typeof import('../modules/breedtimer').breedTimeRemaining
  // DecimalBreed = Decimal.clone({...}) at breedtimer.ts load — a constructor with static
  // methods (log10) AND callable (gather.ts calls DecimalBreed(0.1)); `any` covers new/call/static.
  var DecimalBreed: any
  // DOM SPAN created by breedtimer.addBreedingBoxTimers(), assigned to globalThis at load.
  var addbreedTimerInsideText: any
  var safeBuyBuilding: typeof import('../modules/buildings').safeBuyBuilding
  var RscienceNeeded: number

  // Equipment/prestige helpers read by bare name from equipment.ts. Prediction math
  // (highDamageShield/getTotalHealthMod/Rcalc* in calc.ts, RgetEnemyMaxHealth in query.ts,
  // Rgetequipcost in other.ts); doMaxMapBonus (maps.ts) / RdoMaxMapBonus (mapfunctions.ts)
  // are boolean state flags kept `any`. shouldFarm — an AutoTrimps2.js combat-readiness var.
  // (needGymystic was retired in #63: it was a loader var hardcoded true and never reset, so every
  // reader saw a permanent "we need Gymystic". Its readers now check allowed>done live.)
  var highDamageShield: typeof import('../modules/calc').highDamageShield
  var getTotalHealthMod: typeof import('../modules/calc').getTotalHealthMod
  // maps.ts / mapfunctions.ts boolean state flags (globalThis-assigned, read bare).
  var doMaxMapBonus: any
  var RdoMaxMapBonus: any
  var Rgetequipcost: typeof import('../modules/other').Rgetequipcost
  var RgetEnemyMaxHealth: typeof import('../modules/query').RgetEnemyMaxHealth
  var RcalcOurDmg: typeof import('../modules/calc').RcalcOurDmg
  var RcalcBadGuyDmg: typeof import('../modules/calc').RcalcBadGuyDmg
  // NOT a typeof-import: real RcalcOurHealth() takes 0 args, but equipment.ts calls
  // RcalcOurHealth(true) (ignored arg) at 649/1054. Latent bug tracked in #32.
  function RcalcOurHealth(...rest: any[]): number
  var shouldFarm: any
  var isSteam: any
  var scienceNeeded: number
  var breedFire: any
  // U2 radon farming-mode flags — AutoTrimps2.js vars.
  var Rshouldtimefarm: any
  var Rdshouldtimefarm: any
  var Rshouldsmithyfarm: any
  var Rshouldtributefarm: any
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
  // AT fns read bare by maps.ts: prediction math (calc.ts / equipment.ts / query.ts)
  // + the U2 radon map orchestrators (mapfunctions.ts).
  var areWeAttackLevelCapped: typeof import('../modules/equipment').areWeAttackLevelCapped
  var calcSpire: typeof import('../modules/calc').calcSpire
  var desodynamicHD: typeof import('../modules/calc').desodynamicHD
  var stormdynamicHD: typeof import('../modules/calc').stormdynamicHD
  var equipfarmdynamicHD: typeof import('../modules/equipment').equipfarmdynamicHD
  var estimateEquipsForZone: typeof import('../modules/equipment').estimateEquipsForZone
  var getEnemyMaxHealth: typeof import('../modules/query').getEnemyMaxHealth
  var dRAMP: typeof import('../modules/mapfunctions-amp').dRAMP
  var RAMP: typeof import('../modules/mapfunctions-amp').RAMP
  var RAMPreset: typeof import('../modules/mapfunctions-amp').RAMPreset
  var RAMPfrag: typeof import('../modules/mapfunctions-amp').RAMPfrag
  var Rbogs: typeof import('../modules/mapfunctions').Rbogs
  var RfragMap: typeof import('../modules/mapfunctions').RfragMap
  var Rhypo: typeof import('../modules/mapfunctions').Rhypo
  var RhypoMap: typeof import('../modules/mapfunctions').RhypoMap
  var Rinsanity: typeof import('../modules/mapfunctions').Rinsanity
  var RinsanityMap: typeof import('../modules/mapfunctions').RinsanityMap
  var RlevelMap: typeof import('../modules/mapfunctions').RlevelMap
  var RmapRepeat: typeof import('../modules/mapfunctions').RmapRepeat
  var Rmayhem: typeof import('../modules/mapfunctions').Rmayhem
  var RPraid: typeof import('../modules/mapfunctions').RPraid
  var RquestMap: typeof import('../modules/mapfunctions').RquestMap
  var RselectMap: typeof import('../modules/mapfunctions').RselectMap
  var Rship: typeof import('../modules/mapfunctions').Rship
  var RshipMap: typeof import('../modules/mapfunctions').RshipMap
  var Rshould: typeof import('../modules/mapfunctions').Rshould
  var RsmithyFarm: typeof import('../modules/mapfunctions').RsmithyFarm
  var RsmithyFarmMap: typeof import('../modules/mapfunctions').RsmithyFarmMap
  var Rstorm: typeof import('../modules/mapfunctions').Rstorm
  var RtimeFarm: typeof import('../modules/mapfunctions').RtimeFarm
  var RtimeFarmMap: typeof import('../modules/mapfunctions').RtimeFarmMap
  var RtributeFarm: typeof import('../modules/mapfunctions').RtributeFarm
  var RtributeFarmMap: typeof import('../modules/mapfunctions').RtributeFarmMap
  var Ralch: typeof import('../modules/mapfunctions').Ralch
  var RalchMap: typeof import('../modules/mapfunctions').RalchMap
  var Rdeso: typeof import('../modules/mapfunctions').Rdeso
  // maps.ts status readouts, bridged; read bare by performance.ts (AFK overlay).
  // NOT typeof-imports: real (R)updateAutoMapsStatus return can be `undefined`, but
  // performance.ts indexes the result [0] unguarded (AFK overlay, 151/155). Latent -> #32.
  function updateAutoMapsStatus(...args: any[]): any
  function RupdateAutoMapsStatus(...args: any[]): any

  // ── other.ts (Wave 3 #30) bridged helpers + owned globals ────────────────────
  // Buy-state seam (buystate.ts, converted) + void-map helpers (breedtimer.ts,
  // converted) reached here by bare name via the bridge.
  var preBuy: typeof import('../modules/buystate').preBuy
  var postBuy: typeof import('../modules/buystate').postBuy
  var forceAbandonTrimps: typeof import('../modules/breedtimer').forceAbandonTrimps
  var abandonVoidMap: typeof import('../modules/breedtimer').abandonVoidMap
  // Prestige-raid map-family + misc globals: globalThis-assigned at other.ts load,
  // read cross-module by maps.ts / mapfunctions.ts / Graphs.js. Pragmatic `any`.
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
  var Rgetequips: typeof import('../modules/equipment').Rgetequips
  // NOT a typeof-import: real RcalcEnemyHealth returns `number | undefined`, but
  // mapfunctions.ts divides/compares the result unguarded (~22 sites). Latent bug -> #32.
  function RcalcEnemyHealth(...args: any[]): any

  // Settings (de)serialization defined in utils.ts, read by bare name from
  // import-export.ts (export string builders + profile save).
  var serializeSettings: typeof import('../modules/utils').serializeSettings
  var serializeSettings550: typeof import('../modules/utils').serializeSettings550
  var serializeSettings60: typeof import('../modules/utils').serializeSettings60
  // Runtime module loader + paths — `var`/functions in AutoTrimps2.js.
  function ATscriptLoad(...args: any[]): any
  function ATscriptUnload(...args: any[]): any
  var modulepath: any
  // Automation run flag + module config snapshots — `var` in AutoTrimps2.js.
  var ATrunning: any
  var MODULESdefault: any
  // `settingsProfiles` <select> exposed as a DOM-id global; `script` is a
  // for-in loop var that was an implicit global in the sloppy-mode legacy.
  var settingsProfiles: any
  var script: any
}
export {}
