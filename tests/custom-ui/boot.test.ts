// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

function fixture() {
  document.body.innerHTML = `<div id="wrapper"><span id="foodOwned">5</span></div><div id="tooltipDiv"></div>`
}

describe('bootCustomUI OFF no-op invariant', () => {
  beforeEach(() => {
    fixture()
    vi.resetModules()
  })

  it('does nothing when ATCustomUI is off', async () => {
    ;(globalThis as any).getPageSetting = () => false
    const { bootCustomUI } = await import('../../src/modules/custom-ui/boot')
    bootCustomUI()
    expect(document.getElementById('atWrapper')).toBeNull() // no shell created
    expect(document.getElementById('wrapper')!.parentElement).toBe(document.body) // untouched
  })

  it('adopts when ATCustomUI is on', async () => {
    ;(globalThis as any).getPageSetting = () => true
    const { bootCustomUI } = await import('../../src/modules/custom-ui/boot')
    bootCustomUI()
    expect(document.querySelector('#atWrapper #wrapper')).not.toBeNull()
  })

  it('applyCustomUI(false) releases and hides', async () => {
    ;(globalThis as any).getPageSetting = () => true
    const { bootCustomUI, applyCustomUI } = await import('../../src/modules/custom-ui/boot')
    bootCustomUI()
    applyCustomUI(false)
    expect(document.getElementById('wrapper')!.parentElement).toBe(document.body)
  })
})
