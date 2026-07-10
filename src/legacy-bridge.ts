// The transition seam. Re-publishes every converted module's exports onto the
// global object so still-legacy code (raw-concatenated at global scope) keeps
// resolving them by bare name at runtime. Wildcard-spread from the module
// namespace: anything `export`ed is auto-published — you cannot forget a name.
// This manifest shrinks to nothing as the strangle completes.
import * as utils from './modules/utils'
import * as time from './modules/time'
import * as buystate from './modules/buystate'
import * as dynprestige from './modules/dynprestige'
import * as breedtimer from './modules/breedtimer'
import * as nature from './modules/nature'
import * as magmite from './modules/magmite'
import * as calc from './modules/calc'
import * as equipment from './modules/equipment'
import * as buildings from './modules/buildings'
import * as jobs from './modules/jobs'
import * as upgrades from './modules/upgrades'
import * as gather from './modules/gather'
import * as heirlooms from './modules/heirlooms'
import * as fight from './modules/fight'
import * as scryer from './modules/scryer'
import * as ab from './modules/ab'
import * as MAZ from './modules/MAZ'
// COLLISION MECHANISM (1) — FUNCTION-EXPORT collision → decided by SPREAD order (below): the last
// module spread onto globalThis wins. stance & calc both export calcBaseDamageInX; `...calc` is
// spread before `...stance`, so stance's copy wins, matching the original load order (calc before
// stance). NOTE: Phase 3 removed calc's copy as dead code (see calc.ts), so this specific collision
// no longer exists — but the rule stands for any future duplicated export name.
import * as stance from './modules/stance'
import * as maps from './modules/maps'
// COLLISION MECHANISM (2) — TOP-LEVEL `globalThis.X = …` SIDE-EFFECT collision → decided by IMPORT
// (module-eval) order, NOT spread order (the spread below only re-publishes named exports). mapfunctions
// owns the R-map-state inits (`globalThis.RshouldFarm = false`, …) which must eval AFTER maps' `= undefined`
// placeholders, so maps is imported before mapfunctions. Guarded by tests/build-userscript.test.ts.
import * as mapfunctions from './modules/mapfunctions'
import * as portal from './modules/portal'
import * as importExport from './modules/import-export'
import * as query from './modules/query'
import * as other from './modules/other'
// other-praiding: Phase 3 (#51) byte-faithful extraction of the U1 Prestige/BW-Raid state machine
// from other.ts. No import-order constraint (its globals have no placeholder-race); kept adjacent.
import * as otherPraiding from './modules/other-praiding'
import * as settingsEngine from './modules/settings-engine'
import * as settingsMenu from './modules/settings-menu'
import * as settingsVisibility from './modules/settings-visibility'
import * as settingsDefs from './modules/settings-defs'
// settings-boot defines bootSettingsUI() (the automationMenuInit → …Tabs → …Settings sequence).
// It no longer self-invokes: AutoTrimps2.js's initializeAutoTrimps() calls it after
// loadPageVariables(), matching legacy's SettingsGUI load point. Spread here so that bare global
// call resolves. Its module body only DEFINES the function, so bridge-eval order is irrelevant.
import * as settingsBoot from './modules/settings-boot'

Object.assign(globalThis, { ...utils, ...time, ...buystate, ...dynprestige, ...breedtimer, ...nature, ...magmite, ...calc, ...equipment, ...buildings, ...jobs, ...upgrades, ...gather, ...heirlooms, ...fight, ...scryer, ...ab, ...MAZ, ...stance, ...maps, ...mapfunctions, ...portal, ...importExport, ...query, ...other, ...otherPraiding, ...settingsEngine, ...settingsMenu, ...settingsVisibility, ...settingsDefs, ...settingsBoot })
