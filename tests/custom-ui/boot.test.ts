// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

function fixture() {
  document.body.innerHTML =
    `<div id="wrapper">` +
    `<div id="resourceColumn"><div id="food" class="playerGather"><span id="foodOwned">5</span><span id="foodMax">10</span><span id="foodPs">+1/sec</span></div></div>` +
    `</div><div id="tooltipDiv"></div>`
  ;(globalThis as any).game = { resources: { food: { owned: 5 }, wood: { owned: 0 }, metal: { owned: 0 }, science: { owned: 0 } } }
}

describe('bootCustomUI + resource-region wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fixture()
    vi.resetModules()
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('OFF no-op: nothing mounts, wrapper untouched', async () => {
    ;(globalThis as any).getPageSetting = () => false
    const { bootCustomUI } = await import('../../src/modules/custom-ui/boot')
    bootCustomUI()
    expect(document.getElementById('atWrapper')).toBeNull()
    expect(document.getElementById('atRT-food')).toBeNull()
    expect(document.getElementById('wrapper')!.parentElement).toBe(document.body)
  })

  it('ON: adopts the HUD and graduates the resource tiles', async () => {
    ;(globalThis as any).getPageSetting = () => 1
    const { bootCustomUI } = await import('../../src/modules/custom-ui/boot')
    bootCustomUI()
    expect(document.querySelector('#atWrapper #wrapper')).not.toBeNull()
    expect(document.getElementById('atRT-food')).not.toBeNull()
    expect(document.getElementById('food')!.classList.contains('at-rt-hidden')).toBe(true) // native hidden, not removed
    expect(document.getElementById('foodOwned')!.textContent).toBe('5') // Rule 3: id preserved
  })

  it('applyCustomUI(false): restores natives, removes tiles, releases HUD', async () => {
    ;(globalThis as any).getPageSetting = () => 1
    const { bootCustomUI, applyCustomUI } = await import('../../src/modules/custom-ui/boot')
    bootCustomUI()
    applyCustomUI(false)
    expect(document.getElementById('wrapper')!.parentElement).toBe(document.body)
    expect(document.getElementById('atRT-food')).toBeNull()
    expect(document.getElementById('food')!.classList.contains('at-rt-hidden')).toBe(false)
  })
})
