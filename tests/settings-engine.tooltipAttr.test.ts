import { describe, it, expect } from 'vitest'
import { tooltipAttr } from '../src/modules/settings-engine'

describe('tooltipAttr (#150 seam)', () => {
  it('emits a customText tooltip call', () => {
    expect(tooltipAttr('Title', 'Body')).toBe('tooltip("Title", "customText", event, "Body")')
  })

  it('escapes the quote that would otherwise null the handler (#110)', () => {
    // A raw " closes the JS string literal inside the attribute; the handler then fails to
    // compile and the browser leaves onmouseover === null, silently, with nothing thrown.
    expect(tooltipAttr('a"b', 'c"d')).toBe('tooltip("a\\"b", "customText", event, "c\\"d")')
  })

  it('escapes backslashes before quotes so an escape cannot be forged', () => {
    expect(tooltipAttr('x', 'a\\"b')).toBe('tooltip("x", "customText", event, "a\\\\\\"b")')
  })

  it('adds NO default-value facet — that belongs to createSetting only', () => {
    expect(tooltipAttr('T', 'B')).not.toContain('Default:')
  })
})
