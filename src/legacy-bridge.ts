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

Object.assign(globalThis, { ...utils, ...time, ...buystate, ...dynprestige, ...breedtimer, ...nature, ...magmite, ...calc, ...equipment, ...buildings })
