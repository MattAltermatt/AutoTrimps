// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { syncRegion, deactivateRegion } from '../../src/modules/custom-ui/tiles/resource-region'

function fixture() {
  // #wood is locked (visibility:hidden), the rest unlocked. Native value spans included.
  document.body.innerHTML = `
    <div id="resourceColumn">
      <div class="cell"><div id="food" class="playerGather"><span id="foodOwned">10</span><span id="foodMax">100</span><span id="foodPs">+1/sec</span></div></div>
      <div class="cell"><div id="wood" class="playerGather" style="visibility:hidden;"><span id="woodOwned">0</span><span id="woodMax">50</span><span id="woodPs">+0/sec</span></div></div>
      <div class="cell"><div id="metal" class="playerGather"><span id="metalOwned">5</span><span id="metalMax">20</span><span id="metalPs">+1/sec</span></div></div>
      <div class="cell"><div id="science" class="playerGather"><span id="scienceOwned">7</span><span id="sciencePs">+2/sec</span></div></div>
    </div>`
  ;(globalThis as any).game = { resources: { food: { owned: 10 }, wood: { owned: 0 }, metal: { owned: 5 }, science: { owned: 7 } } }
  ;(globalThis as any).getPageSetting = () => 1
}
const hidden = (id: string) => document.getElementById(id)!.classList.contains('at-rt-hidden')

describe('resource region graduation', () => {
  beforeEach(() => {
    fixture()
    deactivateRegion() // reset module state between tests
  })

  it('marks ALL natives hidden (no unlock flash) and mounts tiles only for unlocked', () => {
    syncRegion()
    expect(hidden('food')).toBe(true)
    expect(hidden('wood')).toBe(true) // hidden even though locked → no flash when it later unlocks
    expect(document.getElementById('atRT-food')).not.toBeNull()
    expect(document.getElementById('atRT-metal')).not.toBeNull()
    expect(document.getElementById('atRT-science')).not.toBeNull()
    expect(document.getElementById('atRT-wood')).toBeNull() // locked → no tile yet
  })

  it('native ids are preserved (Rule 3 — hidden via class, not removed)', () => {
    syncRegion()
    expect(document.getElementById('foodOwned')!.textContent).toBe('10')
    expect(document.querySelectorAll('#food').length).toBe(1)
  })

  it('the game reveal (inline display:block) does NOT un-hide the native — no duplicate (the bug)', () => {
    syncRegion()
    // the game unlocks Wood: sets visibility visible AND display:block via its fade-in animation
    const wood = document.getElementById('wood')!
    wood.style.visibility = 'visible'
    wood.style.display = 'block'
    syncRegion() // periodic tick
    expect(document.getElementById('atRT-wood')).not.toBeNull() // AT tile mounts
    expect(hidden('wood')).toBe(true) // native STILL carries the !important-hiding class → stays hidden
  })

  it('a resource re-locked (portal reset) unmounts its tile', () => {
    syncRegion()
    expect(document.getElementById('atRT-metal')).not.toBeNull()
    document.getElementById('metal')!.style.visibility = 'hidden'
    syncRegion()
    expect(document.getElementById('atRT-metal')).toBeNull()
  })

  it('deactivate un-hides all natives and removes tiles', () => {
    syncRegion()
    deactivateRegion()
    expect(hidden('food')).toBe(false)
    expect(hidden('wood')).toBe(false)
    expect(document.getElementById('atRT-food')).toBeNull()
  })

  it('sync is idempotent', () => {
    syncRegion()
    syncRegion()
    expect(document.querySelectorAll('#atRT-food').length).toBe(1)
  })

  it('#149: Fragments/Gems/Helium mount even while the game hides them (always-on)', () => {
    // Add the secondaries as the game ships them pre-unlock: fragments/gems visibility:hidden, helium display:none.
    document.getElementById('resourceColumn')!.innerHTML += `
      <div class="cell"><div id="fragments" style="visibility:hidden;"><span id="fragmentsOwned">0</span><span id="fragmentsPs">+0/sec</span></div></div>
      <div class="cell"><div id="gems" style="visibility:hidden;"><span id="gemsOwned">0</span><span id="gemsPs">+0/sec</span></div></div>
      <div class="cell"><div id="helium" style="display:none;"><span id="heliumOwned">0</span><span id="heliumPh">+0/hr</span></div></div>`
    Object.assign((globalThis as any).game.resources, { fragments: { owned: 0 }, gems: { owned: 0 }, helium: { owned: 0 } })
    syncRegion()
    expect(document.getElementById('atRT-fragments')).not.toBeNull()
    expect(document.getElementById('atRT-gems')).not.toBeNull()
    expect(document.getElementById('atRT-helium')).not.toBeNull()
  })

  it('#149: an always-on secondary is NOT unmounted by a portal re-lock', () => {
    document.getElementById('resourceColumn')!.innerHTML += `
      <div class="cell"><div id="helium" style="display:none;"><span id="heliumOwned">0</span><span id="heliumPh">+0/hr</span></div></div>`
    ;(globalThis as any).game.resources.helium = { owned: 0 }
    syncRegion()
    expect(document.getElementById('atRT-helium')).not.toBeNull()
    // portal re-lock would re-hide the native; always-on keeps the tile mounted
    document.getElementById('helium')!.style.display = 'none'
    syncRegion()
    expect(document.getElementById('atRT-helium')).not.toBeNull()
  })
})
