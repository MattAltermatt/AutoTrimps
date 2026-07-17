// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { syncPopulationRegion, deactivatePopulationRegion } from '../../src/modules/custom-ui/tiles/population-region'

function fixture() {
  document.body.innerHTML = `
    <span id="trimpsOwned">7989</span><span id="trimpsMax">8109</span><span id="trimpsPs">+83.8/sec</span>
    <div id="trimpsColumn">
      <div id="trimps" class="playerGather">
        <div class="progress resProgress"><div class="progress-bar" id="trimpsBar"><span id="trimpsTimeToFill">1.5 / 4.4</span></div></div>
        <div id="unempHide"><span id="trimpsUnemployed">3935</span></div>
        <div id="empHide"><span id="trimpsEmployed">4054</span>/<span id="maxEmployed">4055</span></div>
        <div id="trapArea"><div id="trimpsCollectBtn">Check Traps (48)</div><div class="progress"><div id="trappingBar"></div></div></div>
      </div>
    </div>`
  ;(globalThis as any).game = { resources: { trimps: { owned: 7989 } }, global: {} }
}
const hidden = () => document.getElementById('trimps')!.classList.contains('at-rt-hidden')

describe('population region graduation', () => {
  beforeEach(() => {
    deactivatePopulationRegion() // reset module state (mounted) from any prior test first
    fixture() // then a clean tree
  })

  it('mounts the tile, hides the native #trimps, and adopts the live nodes', () => {
    syncPopulationRegion()
    expect(document.getElementById('atRT-population')).not.toBeNull()
    expect(hidden()).toBe(true)
    expect(document.querySelector('.at-pop-breedslot #trimpsBar')).not.toBeNull()
    expect(document.querySelector('.at-pop-trapslot #trapArea')).not.toBeNull()
  })

  it('is idempotent — repeated syncs do not rebuild or duplicate the tile', () => {
    syncPopulationRegion()
    syncPopulationRegion()
    expect(document.querySelectorAll('#atRT-population').length).toBe(1)
    expect(document.querySelectorAll('#trimpsBar').length).toBe(1)
    expect(document.querySelectorAll('#trapArea').length).toBe(1)
  })

  it('a re-lock (portal reset) unmounts the tile AND restores the adopted nodes into #trimps', () => {
    syncPopulationRegion()
    document.getElementById('trimps')!.style.visibility = 'hidden'
    syncPopulationRegion()
    expect(document.getElementById('atRT-population')).toBeNull()
    const trimps = document.getElementById('trimps')!
    expect(document.getElementById('trimpsBar')!.closest('.progress')!.parentElement).toBe(trimps)
    expect(document.getElementById('trapArea')!.parentElement).toBe(trimps)
    expect(document.querySelectorAll('#trapArea').length).toBe(1) // not orphaned in a removed tile
  })

  it('deactivate un-hides #trimps, removes the tile, and restores the adopted nodes', () => {
    syncPopulationRegion()
    deactivatePopulationRegion()
    expect(hidden()).toBe(false)
    expect(document.getElementById('atRT-population')).toBeNull()
    const trimps = document.getElementById('trimps')!
    expect(document.getElementById('trimpsBar')!.closest('.progress')!.parentElement).toBe(trimps)
    expect(document.getElementById('trapArea')!.parentElement).toBe(trimps)
  })
})
