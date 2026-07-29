// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

// #175 / #228 / #247 — the Perfect-Sliders ladders, which had never taken a single rung.
//
// `advPerfectCheckbox` was an `<input type="checkbox">` when this code was written and became a
// `<span class="niceCheckbox" data-checked>` in Trimps 4.9 (2018). `.checked` on a span is an expando;
// the game reads the ATTRIBUTE (`readNiceCheckbox`, updates.js:1958) from `checkPerfectChecked`
// (main.js:6303), which is what `updateMapCost` consults for its `+6` baseCost. Two consequences,
// and the ladders here contain BOTH halves:
//
//   * the "start Perfect" write never turned it on   → AT's `fa` frag map rolled loot RANDOMLY
//     instead of max, on a map bought specifically for its loot;
//   * the "Nobody's perfect" rung never turned it off → its inner affordability re-test compared an
//     UNCHANGED price against the same fragment count, i.e. it was the exact logical negation of the
//     `if` it sits inside. Provably dead, and it is the ~2.2× rung — so AT skipped straight to
//     shredding the loot slider it just paid for.
//
// The fixture puts the REAL markup in the DOM and mirrors the game's cost path verbatim. Both matter:
// reproducing the checkbox as an `<input>` here would encode the very model that caused the bug, and
// the test could not fail (#150's lesson, one layer down). A drift test at the bottom pins the two
// mirrored `niceCheckbox` bodies against the pinned clone so this fixture cannot rot away from it.

const GAME_DIR = process.env.TRIMPS_GAME_DIR || resolve(__dirname, '..', '.trimps-game')

let mapfunctions: typeof import('../src/modules/mapfunctions')

// --- the game's niceCheckbox contract, updates.js:1932-1943 / 1958-1960 -------------------------
const readNiceCheckbox = (elem: HTMLElement) => elem.dataset.checked == 'true'
const swapNiceCheckbox = (elem: HTMLElement, forceSetting?: boolean) => {
  const checked = typeof forceSetting === 'undefined' ? !readNiceCheckbox(elem) : forceSetting == true
  elem.setAttribute('data-checked', String(checked))
  elem.setAttribute('aria-checked', String(checked))
  if (checked) elem.setAttribute('checked', 'true')
  else elem.removeAttribute('checked')
}

const $ = (id: string) => document.getElementById(id) as HTMLInputElement
const perfectBox = () => document.getElementById('advPerfectCheckbox') as HTMLElement
const sliders = () => [$('lootAdvMapsRange').value, $('difficultyAdvMapsRange').value, $('sizeAdvMapsRange').value]

/** main.js:6280 */
const getMapSliderValue = (what: string) => {
  const val = parseInt($(what + 'AdvMapsRange').value, 10)
  return val >= 0 && val <= 9 ? val : 0
}

function installGameApi(world: number) {
  const g = globalThis as any
  g.readNiceCheckbox = readNiceCheckbox
  g.swapNiceCheckbox = swapNiceCheckbox
  g.mapSpecialModifierConfig = { fa: { costIncrease: 7 }, p: { costIncrease: 10 } }
  g.prettify = (n: number) => String(n)
  g.needAnS = () => 's'
  g.getUnlockZone = (what: string) => ({ special: 14, perfect: 29, extra: 49 })[what] // U2
  g.getHighestLevelCleared = () => world
  g.checkMaxSliders = () =>
    getMapSliderValue('size') + getMapSliderValue('loot') + getMapSliderValue('difficulty') === 27 // main.js:6549
  g.checkSlidersForPerfect = () => g.checkMaxSliders() // main.js:6319, minus the style write
  g.checkPerfectChecked = () => {
    // main.js:6303
    if (g.getHighestLevelCleared() < g.getUnlockZone('perfect')) return false
    if (!g.checkSlidersForPerfect()) return false
    return readNiceCheckbox(perfectBox())
  }
  g.getSpecialModifierSetting = () => $('advSpecialSelect').value || '0' // main.js:6295
  g.getExtraMapLevels = () => {
    // main.js:6310
    if (parseInt($('mapLevelInput').value, 10) !== world) return 0
    const value = $('advExtraLevelSelect').value
    return value ? parseInt(value, 10) : 0
  }
  g.updateExtraLevelColors = () => {}
  // main.js:6512-6547, verbatim
  g.updateMapCost = (getValue?: boolean, forceBaseCost?: number) => {
    const mapLevel = parseInt($('mapLevelInput').value, 10)
    let baseCost = 0
    if (mapLevel > g.game.global.world || mapLevel < 6 || isNaN(mapLevel)) return
    if (getValue && forceBaseCost != null) baseCost = forceBaseCost
    else {
      baseCost += getMapSliderValue('size')
      baseCost += getMapSliderValue('loot')
      baseCost += getMapSliderValue('difficulty')
      baseCost *= g.game.global.world >= 60 ? 0.74 : 1
      if (g.checkPerfectChecked()) baseCost += 6
      const extraLevels = g.getExtraMapLevels()
      if (extraLevels > 0) baseCost += 10 * extraLevels
    }
    const specialModifier = g.getSpecialModifierSetting()
    if (specialModifier != '0') baseCost += g.mapSpecialModifierConfig[specialModifier].costIncrease
    baseCost += mapLevel
    baseCost = Math.floor(
      ((baseCost / 150) * Math.pow(1.14, baseCost - 1) * mapLevel * 2) *
        Math.pow(1.03 + mapLevel / 50000, mapLevel),
    )
    if ($('biomeAdvMapsSelect').value != 'Random') baseCost *= 2
    if (getValue) return baseCost
    return undefined
  }
}

/** Price the CURRENT design with the checkbox forced to `perfect`, without disturbing the design. */
function priceWithPerfect(perfect: boolean): number {
  const before = readNiceCheckbox(perfectBox())
  swapNiceCheckbox(perfectBox(), perfect)
  const cost = (globalThis as any).updateMapCost(true)
  swapNiceCheckbox(perfectBox(), before)
  return cost
}

const WORLD = 62

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).getPlayerCritChance = () => 0 // read at module load (mapfunctions.ts:26)
  mapfunctions = await import('../src/modules/mapfunctions')
})

beforeEach(() => {
  // advPerfectCheckbox copied VERBATIM from .trimps-game/index.html:897 — a <span>, never an <input>.
  document.body.innerHTML = `
    <select id="biomeAdvMapsSelect"><option value="Random">Random</option><option value="Plentiful">Plentiful</option><option value="Depths">Depths</option></select>
    <select id="advExtraLevelSelect"><option value="0">0</option></select>
    <select id="advSpecialSelect"><option value="0">0</option><option value="fa">fa</option><option value="p">p</option></select>
    <input id="lootAdvMapsRange" type="range" min="0" max="9" value="0">
    <input id="difficultyAdvMapsRange" type="range" min="0" max="9" value="0">
    <input id="sizeAdvMapsRange" type="range" min="0" max="9" value="0">
    <span id="advPerfectCheckbox" class="icomoon icon-checkbox-unchecked niceCheckbox" data-checked="false"></span>
    <input id="mapLevelInput" value="${WORLD}">`
  installGameApi(WORLD)
  ;(globalThis as any).game = {
    global: { world: WORLD, universe: 2, highestRadonLevelCleared: WORLD },
    resources: { fragments: { owned: Infinity } },
  }
})

describe('RfragMap drives Perfect Sliders through the state the game actually reads (#228)', () => {
  it('turns Perfect ON when the map is affordable — the ladder opens at its top rung', () => {
    mapfunctions.RfragMap()

    // Sanity: the sliders really are 9/9/9, so checkMaxSliders()==27 and Perfect IS eligible here.
    // Without this, "Perfect is on" could be vacuously unreachable rather than achieved.
    expect(sliders()).toEqual(['9', '9', '9'])
    expect((globalThis as any).checkMaxSliders()).toBe(true)

    // The assertion the bug failed: `.checked = true` (mapfunctions.ts:276) was an expando, so
    // data-checked stayed "false" and getRandomMapValue (main.js:6563) rolled the loot randomly on
    // a map bought FOR its loot.
    expect(readNiceCheckbox(perfectBox())).toBe(true)
    expect((globalThis as any).checkPerfectChecked()).toBe(true)
  })

  // `swapNiceCheckbox(elem)` with no second argument TOGGLES (updates.js:1934) — so a repair that
  // forgets the force argument still lands on the right answer from the game's default `false` state,
  // and every single-run assertion above passes against it. (Measured: that mutant survived the whole
  // file until this test existed.) The state AT designs must be a function of the design, not of what
  // the element happened to hold, so drive both starting states and require the same answer.
  it.each([false, true])('reaches Perfect-ON from a starting data-checked of %s', (start) => {
    swapNiceCheckbox(perfectBox(), start)
    mapfunctions.RfragMap()
    expect(readNiceCheckbox(perfectBox())).toBe(true)
  })

  it('is idempotent — designing the same map twice does not flip the checkbox', () => {
    mapfunctions.RfragMap()
    const once = readNiceCheckbox(perfectBox())
    mapfunctions.RfragMap()
    expect(readNiceCheckbox(perfectBox())).toBe(once)
  })

  it('falls back to imperfect — at a genuinely lower price — when Perfect is unaffordable', () => {
    // RfragMap's ladder is: [Plentiful+perfect] → [Random+perfect] → [Random+imperfect] → shred
    // sliders. Learn the price of the last two rungs (the biome swap at :281 comes FIRST and halves
    // the cost on its own), then set fragments strictly between them, so the Perfect rung is the only
    // thing that can make this map affordable.
    mapfunctions.RfragMap()
    $('biomeAdvMapsSelect').value = 'Random'
    const perfect = priceWithPerfect(true)
    const imperfect = priceWithPerfect(false)
    expect(imperfect).toBeLessThan(perfect) // the +6 baseCost is worth ~2.2× at 1.14^6

    ;(globalThis as any).game.resources.fragments.owned = (perfect + imperfect) / 2
    mapfunctions.RfragMap()
    expect($('biomeAdvMapsSelect').value).toBe('Random') // rung 1 taken, as designed

    expect(readNiceCheckbox(perfectBox())).toBe(false)
    // And it stopped THERE. Before the fix the dead rung dropped through to the slider loop, which
    // is the whole harm: AT shredded difficulty/size on a map it could already afford imperfect.
    expect(sliders()).toEqual(['9', '9', '9'])
    expect((globalThis as any).updateMapCost(true)).toBeLessThanOrEqual(
      (globalThis as any).game.resources.fragments.owned,
    )
  })
})

describe("RminFragMap's \"Nobodys perfect\" rung is reachable at all (#247)", () => {
  it('returns the imperfect max-slider price instead of shredding the loot slider', () => {
    // Price both rungs first.
    mapfunctions.RminFragMap('Plentiful', '0', 'fa')
    const perfect = priceWithPerfect(true)
    const imperfect = priceWithPerfect(false)

    ;(globalThis as any).game.resources.fragments.owned = (perfect + imperfect) / 2
    const cost = mapfunctions.RminFragMap('Plentiful', '0', 'fa')

    // FAILED BEFORE THE FIX on all three: line 341's write was inert, so line 343's
    // `updateMapCost(true) <= owned` was the exact negation of line 340's `> owned` over identical
    // inputs — unreachable — and control fell into the loot loop below it.
    expect(readNiceCheckbox(perfectBox())).toBe(false)
    expect(cost).toBe(imperfect)
    expect($('lootAdvMapsRange').value).toBe('9')
  })

  it.each([false, true])('still opens Perfect-ON from a starting data-checked of %s', (start) => {
    swapNiceCheckbox(perfectBox(), start)
    const cost = mapfunctions.RminFragMap('Plentiful', '0', 'fa')
    expect(readNiceCheckbox(perfectBox())).toBe(true)
    expect(cost).toBe(priceWithPerfect(true))
  })
})

describe('the repair must not leak Perfect into the NEXT map AT designs (maps.ts)', () => {
  it('resetPerfectSlidersToPreset restores the preset, so a 9/9/9 farm map is not silently perfect', async () => {
    // The hazard the repair creates and this closes. Before it, NOTHING in the fork could change
    // data-checked, so maps.ts's `create` designers safely inherited the preset. Now RfragMap leaves
    // Perfect ON whenever its map was affordable, and those designers open at 9/9/9
    // (MODULES.maps.MapTier*Sliders) — slider sum 27, so `updateMapCost` would quietly add the +6.
    // The game only resets this on Map-Chamber ENTRY (main.js:10872), so a frag design followed by a
    // `create` design inside one chamber session inherits it.
    ;(globalThis as any).MODULES = { maps: {} }
    ;(globalThis as any).getPageSetting = () => false
    ;(globalThis as any).byId = (id: string) => document.getElementById(id) // bridge global (utils.ts)
    const maps = await import('../src/modules/maps')

    mapfunctions.RfragMap()
    expect(readNiceCheckbox(perfectBox())).toBe(true) // the leak is armed

    ;(globalThis as any).game.global.selectedMapPreset = 1
    ;(globalThis as any).game.global.mapPresets2 = { p1: { perf: false } }
    ;(globalThis as any).getMapPreset = () => (globalThis as any).game.global.mapPresets2.p1

    maps.resetPerfectSlidersToPreset()
    expect(readNiceCheckbox(perfectBox())).toBe(false)

    // And it RESTORES rather than clears: a player whose preset has Perfect ticked keeps it.
    ;(globalThis as any).game.global.mapPresets2.p1.perf = true
    maps.resetPerfectSlidersToPreset()
    expect(readNiceCheckbox(perfectBox())).toBe(true)

    // `!!` at the call site is load-bearing: swapNiceCheckbox TOGGLES on `undefined`
    // (updates.js:1934), so an old save whose preset has no `perf` key would flip every call.
    delete (globalThis as any).game.global.mapPresets2.p1.perf
    maps.resetPerfectSlidersToPreset()
    maps.resetPerfectSlidersToPreset()
    expect(readNiceCheckbox(perfectBox())).toBe(false)
  })

  it('is actually CALLED by both `create` designers (a guard nobody invokes is a comment)', () => {
    // The test above drives resetPerfectSlidersToPreset() directly, so deleting its call sites would
    // leave it fully green while the leak is wide open — the #260 tripwire-call-sites trap exactly.
    // Anchor on the line that must precede it: the U1 designer (autoMap) and the U2 twin (RautoMap)
    // both open their `create` arm with the preset-forcing call.
    const src = readFileSync(resolve(__dirname, '..', 'src', 'modules', 'maps.ts'), 'utf8')
    const armed = [
      ...src.matchAll(
        /if \(game\.global\.selectedMapPreset > 1\) selectAdvMapsPreset\(1\);\s*\n\s*resetPerfectSlidersToPreset\(\);/g,
      ),
    ]
    expect(armed.length).toBe(2)
  })
})

describe('the mirrored niceCheckbox contract still matches the pinned clone', () => {
  it('reads data-checked, and swapNiceCheckbox writes it (drift guard for this fixture)', () => {
    // A hand-mirrored fixture is only evidence while it matches. If the game changes the checkbox
    // contract again — which is exactly what caused this bug in 2018 — every assertion above would
    // keep passing against a model of a game that no longer exists.
    const updates = readFileSync(join(GAME_DIR, 'updates.js'), 'utf8')
    expect(updates).toContain('function readNiceCheckbox(elem){')
    expect(updates).toContain('return (elem.dataset.checked == "true");')
    expect(updates).toContain("elem.setAttribute('data-checked', checked);")
    expect(updates).toContain("if (typeof forceSetting === 'undefined') checked = !readNiceCheckbox(elem);")
    // And the element really is a <span> with the class, not an <input>.
    const index = readFileSync(join(GAME_DIR, 'index.html'), 'utf8')
    expect(index).toMatch(/<span id="advPerfectCheckbox" class="[^"]*niceCheckbox[^"]*" data-checked="false"/)
    expect(index).not.toMatch(/<input[^>]*id="advPerfectCheckbox"/)
  })
})
