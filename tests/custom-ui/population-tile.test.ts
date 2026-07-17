// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildPopulationTile, updatePopulationTile, releaseAdopted } from '../../src/modules/custom-ui/tiles/population-tile'
import { sampleTick, resetSampler } from '../../src/modules/custom-ui/tiles/sampler'

// Mirror the real #trimps subtree (index.html:279-317): the breed bar lives in a `.progress`
// wrapper, then the unemp/emp text blocks, then #trapArea last — the two nodes the tile ADOPTS
// bracket a non-adopted block, so restore-to-original-position is a real assertion.
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

describe('population tile', () => {
  beforeEach(() => {
    resetSampler()
    releaseAdopted() // reset module singletons (refs/anchors) from any prior test first
    fixture() // then a clean tree
  })

  it('adopts the breed bar + trap area into slots, ids preserved, exactly one of each', () => {
    const tile = buildPopulationTile()
    document.body.appendChild(tile)
    expect(tile.querySelector('.at-pop-breedslot #trimpsBar')).not.toBeNull()
    expect(tile.querySelector('.at-pop-trapslot #trapArea')).not.toBeNull()
    expect(document.querySelectorAll('#trimpsBar').length).toBe(1)
    expect(document.querySelectorAll('#trapArea').length).toBe(1)
    // the Trap button is still id-addressable (real control, not re-implemented)
    expect(document.getElementById('trimpsCollectBtn')!.textContent).toContain('Check Traps')
  })

  it('mirrors owned/max/rate/breeding/employed from the game spans', () => {
    const tile = buildPopulationTile()
    document.body.appendChild(tile)
    updatePopulationTile()
    expect(tile.querySelector('.at-pop-owned')!.textContent).toBe('7989')
    expect(tile.querySelector('.at-pop-max')!.textContent).toContain('8109')
    expect(tile.querySelector('.at-rt-rate')!.textContent).toBe('+83.8/sec')
    expect(tile.querySelector('.at-pop-breeding')!.textContent).toBe('3935')
    expect(tile.querySelector('.at-pop-employed')!.textContent).toBe('4054')
    expect(tile.querySelector('.at-pop-maxemp')!.textContent).toBe('4055')
  })

  it('release restores the adopted nodes to their exact original position in #trimps', () => {
    const tile = buildPopulationTile()
    document.body.appendChild(tile)
    releaseAdopted()
    const trimps = document.getElementById('trimps')!
    const breedWrap = document.getElementById('trimpsBar')!.closest('.progress')!
    const trap = document.getElementById('trapArea')!
    expect(breedWrap.parentElement).toBe(trimps)
    expect(trap.parentElement).toBe(trimps)
    // original order: breed .progress is first, then #unempHide; #trapArea is last.
    expect(breedWrap.nextElementSibling!.id).toBe('unempHide')
    expect(trimps.lastElementChild!.id).toBe('trapArea')
    expect(document.querySelectorAll('#trimpsBar').length).toBe(1)
    expect(document.querySelectorAll('#trapArea').length).toBe(1)
  })

  it('draws a population sparkline path once sampled', () => {
    ;(globalThis as any).game.resources.trimps.owned = 7989
    sampleTick()
    ;(globalThis as any).game.resources.trimps.owned = 8000
    sampleTick()
    const tile = buildPopulationTile()
    document.body.appendChild(tile)
    updatePopulationTile()
    expect(tile.querySelector('path.at-rt-line')!.getAttribute('d')!.length).toBeGreaterThan(0)
  })
})
