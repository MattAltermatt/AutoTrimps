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
    ;(globalThis as any).game = { resources: { food: { owned: 1 }, wood: { owned: 5 }, metal: { owned: 1 }, science: { owned: 1 } } }
    ;(globalThis as any).getPageSetting = () => 1
  })

  it('builds a tile with name + no buttons', () => {
    const t = buildTile('wood')
    expect(t.querySelector('.at-rt-name')!.textContent).toBe('Wood')
    expect(t.querySelector('button')).toBeNull()
  })

  it('mirrors owned/max/rate from the game spans', () => {
    const t = buildTile('wood')
    document.body.appendChild(t)
    updateTile('wood')
    expect(t.querySelector('.at-rt-owned')!.textContent).toBe('3.80e9')
    expect(t.querySelector('.at-rt-max')!.textContent).toContain('9.23e9')
    expect(t.querySelector('.at-rt-rate')!.textContent).toBe('+1.90e7/sec')
  })

  it('shows AUTO when ManualGather2 >= 1', () => {
    const t = buildTile('wood')
    document.body.appendChild(t)
    updateTile('wood')
    expect(t.querySelector('.at-rt-auto')!.getAttribute('data-on')).toBe('1')
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
