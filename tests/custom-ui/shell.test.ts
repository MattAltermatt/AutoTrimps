// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { ensureShell, showShell, hideShell, MARKER_CLASS } from '../../src/modules/custom-ui/shell'

describe('custom-ui shell', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('creates #atWrapper once, idempotently, with the identity class and no marker badge', () => {
    const a = ensureShell()
    const b = ensureShell()
    expect(a).toBe(b)
    expect(document.querySelectorAll('#atWrapper').length).toBe(1)
    expect(a.classList.contains(MARKER_CLASS)).toBe(true)
    // #41 Phase 3 dropped the green outline + "AutoTrimps UI" badge — the restyle is self-evident.
    expect(a.querySelector('.at-ui-badge')).toBeNull()
  })

  it('is position:static (Rule 2 — no containing block over game overlays)', () => {
    const a = ensureShell()
    expect(a.style.position).toBe('')
    expect(a.style.transform).toBe('')
  })

  it('show/hide toggles display', () => {
    ensureShell()
    hideShell()
    expect(document.getElementById('atWrapper')!.style.display).toBe('none')
    showShell()
    expect(document.getElementById('atWrapper')!.style.display).toBe('')
  })
})
