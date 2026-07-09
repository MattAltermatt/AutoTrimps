// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { byId } from '../src/modules/utils'

describe('byId', () => {
  it('returns the element typed as HTMLInputElement by default', () => {
    document.body.innerHTML = `<input id="foo" value="bar">`
    const el = byId('foo')
    expect(el.value).toBe('bar') // .value typechecks on the default HTMLInputElement
  })

  it('returns the requested element subtype when given a generic', () => {
    document.body.innerHTML = `<select id="sel"><option>a</option><option selected>b</option></select>`
    const el = byId<HTMLSelectElement>('sel')
    expect(el.selectedIndex).toBe(1) // .selectedIndex only exists on HTMLSelectElement
  })
})
