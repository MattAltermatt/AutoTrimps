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
// stance MUST be spread after calc: both define calcBaseDamageInX, and stance's copy won at
// global scope in the original load order (calc loaded before stance). Spread order preserves it.
import * as stance from './modules/stance'
import * as maps from './modules/maps'
// mapfunctions imported after maps: it owns the R-map-state var inits, which must run after
// maps' undefined placeholders so mapfunctions' real values win (matches original load order).
import * as mapfunctions from './modules/mapfunctions'
import * as portal from './modules/portal'
import * as importExport from './modules/import-export'
import * as query from './modules/query'
import * as other from './modules/other'

Object.assign(globalThis, { ...utils, ...time, ...buystate, ...dynprestige, ...breedtimer, ...nature, ...magmite, ...calc, ...equipment, ...buildings, ...jobs, ...upgrades, ...gather, ...heirlooms, ...fight, ...scryer, ...ab, ...MAZ, ...stance, ...maps, ...mapfunctions, ...portal, ...importExport, ...query, ...other })
