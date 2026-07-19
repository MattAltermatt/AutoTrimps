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

  it('turkimp: food/wood/metal badges light gold (data-turk) even when not gathering', () => {
    ;(globalThis as any).game.global.playerGathering = 'food' // gathering food, not wood
    ;(globalThis as any).game.global.turkimpTimer = 9e5 // turkimp active
    const wood = buildTile('wood')
    document.body.appendChild(wood)
    updateTile('wood')
    // wood isn't being gathered, but turkimp lights it gold + visible
    expect(wood.querySelector('.at-rt-auto')!.getAttribute('data-turk')).toBe('1')
    expect(wood.querySelector('.at-rt-auto')!.getAttribute('data-on')).toBe('1')
    expect(wood.querySelector('.at-rt-auto')!.getAttribute('data-gather')).toBe('0')
  })

  it('turkimp: the permanent turkimp2 talent also lights the treatment; science never turkimp-lit', () => {
    ;(globalThis as any).game.global.turkimpTimer = 0
    ;(globalThis as any).game.talents = { turkimp2: { purchased: true } }
    const metal = buildTile('metal')
    const science = buildTile('science')
    document.body.append(metal, science)
    updateTile('metal')
    updateTile('science')
    expect(metal.querySelector('.at-rt-auto')!.getAttribute('data-turk')).toBe('1')
    expect(science.querySelector('.at-rt-auto')!.getAttribute('data-turk')).toBe('0') // not a turkimp resource
  })

  it('no turkimp: badge only reflects gathering (data-turk stays 0)', () => {
    const wood = buildTile('wood')
    document.body.appendChild(wood)
    updateTile('wood')
    expect(wood.querySelector('.at-rt-auto')!.getAttribute('data-turk')).toBe('0')
    expect(wood.querySelector('.at-rt-auto')!.getAttribute('data-on')).toBe('1') // gathering wood
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
