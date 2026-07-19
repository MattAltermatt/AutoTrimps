// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildTile, updateTile } from '../../src/modules/custom-ui/tiles/resource-tile'
import { sampleTick, resetSampler } from '../../src/modules/custom-ui/tiles/sampler'

function nativeSpans() {
  document.body.innerHTML = `<span id="woodOwned">3.80e9</span><span id="woodMax">9.23e9</span><span id="woodPs">+1.90e7/sec</span>`
}

describe('resource tile', () => {
  beforeEach(() => {
    resetSampler()
    nativeSpans()
    ;(globalThis as any).game = {
      resources: { food: { owned: 1 }, wood: { owned: 5 }, metal: { owned: 1 }, science: { owned: 1 } },
      global: { playerGathering: 'wood' },
    }
    ;(globalThis as any).getPageSetting = () => 1
  })

  it('builds a tile with name + no buttons', () => {
    const t = buildTile('wood')
    expect(t.querySelector('.at-rt-name')!.textContent).toBe('Wood')
    expect(t.querySelector('button')).toBeNull()
  })

  it("badge uses the game's gather verb per resource (Chopping for wood, etc.)", () => {
    expect(buildTile('wood').querySelector('.at-rt-auto')!.textContent).toBe('Chopping')
    expect(buildTile('food').querySelector('.at-rt-auto')!.textContent).toBe('Gathering')
    expect(buildTile('metal').querySelector('.at-rt-auto')!.textContent).toBe('Mining')
    expect(buildTile('science').querySelector('.at-rt-auto')!.textContent).toBe('Researching')
  })

  it('mirrors owned/max/rate from the game spans', () => {
    const t = buildTile('wood')
    document.body.appendChild(t)
    updateTile('wood')
    expect(t.querySelector('.at-rt-owned')!.textContent).toBe('3.80e9')
    expect(t.querySelector('.at-rt-max')!.textContent).toContain('9.23e9')
    expect(t.querySelector('.at-rt-rate')!.textContent).toBe('+1.90e7/sec')
  })

  it('lights the badge only for the resource AT is currently gathering (playerGathering)', () => {
    const t = buildTile('wood')
    document.body.appendChild(t)
    ;(globalThis as any).game.global.playerGathering = 'wood'
    updateTile('wood')
    expect(t.querySelector('.at-rt-auto')!.getAttribute('data-on')).toBe('1')
    ;(globalThis as any).game.global.playerGathering = 'food' // AT switched to food
    updateTile('wood')
    expect(t.querySelector('.at-rt-auto')!.getAttribute('data-on')).toBe('0')
  })

  it('turkimp: only the ACTIVELY-gathered resource gets the gold treatment, not all three', () => {
    ;(globalThis as any).game.global.playerGathering = 'wood' // gathering wood
    ;(globalThis as any).game.global.turkimpTimer = 9e5 // turkimp active
    const wood = buildTile('wood')
    const food = buildTile('food')
    document.body.append(wood, food)
    updateTile('wood')
    updateTile('food')
    // wood IS being gathered under turkimp → gold + visible
    expect(wood.querySelector('.at-rt-auto')!.getAttribute('data-turk')).toBe('1')
    expect(wood.querySelector('.at-rt-auto')!.getAttribute('data-on')).toBe('1')
    // food is NOT being gathered → no badge at all, even though turkimp boosts it too
    expect(food.querySelector('.at-rt-auto')!.getAttribute('data-turk')).toBe('0')
    expect(food.querySelector('.at-rt-auto')!.getAttribute('data-on')).toBe('0')
  })

  it('turkimp: nothing gathered (e.g. trapping) → no food/wood/metal badge lights', () => {
    ;(globalThis as any).game.global.playerGathering = 'trimps' // trapping, not gathering a resource
    ;(globalThis as any).game.global.turkimpTimer = 0
    ;(globalThis as any).game.talents = { turkimp2: { purchased: true } } // even permanent turkimp
    for (const r of ['food', 'wood', 'metal']) {
      const t = buildTile(r)
      document.body.appendChild(t)
      updateTile(r)
      expect(t.querySelector('.at-rt-auto')!.getAttribute('data-on')).toBe('0')
      expect(t.querySelector('.at-rt-auto')!.getAttribute('data-turk')).toBe('0')
    }
  })

  it('turkimp: gathered SCIENCE shows a plain green badge (never the turkimp treatment)', () => {
    ;(globalThis as any).game.global.playerGathering = 'science'
    ;(globalThis as any).game.global.turkimpTimer = 9e5
    const science = buildTile('science')
    document.body.appendChild(science)
    updateTile('science')
    expect(science.querySelector('.at-rt-auto')!.getAttribute('data-on')).toBe('1') // gathering → visible
    expect(science.querySelector('.at-rt-auto')!.getAttribute('data-turk')).toBe('0') // not a turkimp resource
  })

  it('helium is chart-free: no sparkline, mirrors owned + per-hour, update never throws', () => {
    document.body.innerHTML += `<span id="heliumOwned">3.07e4</span><span id="heliumPh">+412/hr</span>`
    ;(globalThis as any).game.resources.helium = { owned: 1 }
    const t = buildTile('helium')
    document.body.appendChild(t)
    expect(t.querySelector('.at-rt-spark')).toBeNull() // no chart
    expect(() => updateTile('helium')).not.toThrow()
    expect(t.querySelector('.at-rt-owned')!.textContent).toBe('3.07e4')
    expect(t.querySelector('.at-rt-rate')!.textContent).toBe('+412/hr')
  })

  it('draws a sparkline path once sampled', () => {
    ;(globalThis as any).game.resources.wood.owned = 5
    sampleTick()
    ;(globalThis as any).game.resources.wood.owned = 6
    sampleTick()
    const t = buildTile('wood')
    document.body.appendChild(t)
    updateTile('wood')
    expect(t.querySelector('path.at-rt-line')!.getAttribute('d')!.length).toBeGreaterThan(0)
  })
})
