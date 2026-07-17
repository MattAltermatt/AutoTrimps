// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { adoptHud, releaseHud } from '../../src/modules/custom-ui/adopt'
import { customUIState } from '../../src/modules/custom-ui/state'

function fixture() {
  document.body.innerHTML = `
    <div id="wrapper"><div id="innerWrapper"><span id="foodOwned">5</span></div></div>
    <div id="tooltipDiv"></div>
    <script id="tail"></script>`
}

describe('custom-ui adopt/release', () => {
  beforeEach(() => {
    fixture()
    customUIState.adopted = false
  })

  it('moves #wrapper into #atWrapper, preserving ids (Rule 3)', () => {
    adoptHud()
    const shell = document.getElementById('atWrapper')!
    expect(shell.querySelector('#wrapper')).not.toBeNull()
    expect(document.getElementById('foodOwned')!.textContent).toBe('5') // still id-addressable
    expect(customUIState.adopted).toBe(true)
  })

  it('release returns #wrapper to its original body position (before #tooltipDiv)', () => {
    adoptHud()
    releaseHud()
    const wrapper = document.getElementById('wrapper')!
    expect(wrapper.parentElement).toBe(document.body)
    expect(wrapper.nextElementSibling!.id).toBe('tooltipDiv') // original order restored
    expect(customUIState.adopted).toBe(false)
  })

  it('adopt is idempotent', () => {
    adoptHud()
    adoptHud()
    expect(document.querySelectorAll('#wrapper').length).toBe(1)
  })
})
