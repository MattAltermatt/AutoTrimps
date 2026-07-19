// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildTurkimpTile,
  updateTurkimpTile,
  syncTurkimpTile,
  deactivateTurkimpTile,
} from '../../src/modules/custom-ui/tiles/turkimp-tile'

function setGame(opts: { timer?: number; permanent?: boolean } = {}) {
  ;(globalThis as any).game = {
    global: { turkimpTimer: opts.timer ?? 0 },
    talents: { turkimp2: { purchased: !!opts.permanent } },
  }
}

describe('turkimp tile', () => {
  beforeEach(() => {
    // Real class on the helium tile, and helium is NOT the last child (gems follows it), so the
    // "after helium" placement is observable: correct code inserts BETWEEN helium and gems, whereas a
    // broken `.at-rt-helium` selector falls back to appendChild and lands AFTER gems (wrong).
    document.body.innerHTML = `<div id="miscColumn"><div id="atRT-helium" class="at-rt at-rt-helium"></div><div id="atRT-gems" class="at-rt at-rt-gems"></div></div>
      <span id="turkimpTime">04:32</span>`
    deactivateTurkimpTile()
    setGame()
  })

  it('active turkimp mirrors the game #turkimpTime countdown', () => {
    setGame({ timer: 9e5 })
    const t = buildTurkimpTile()
    document.body.appendChild(t)
    updateTurkimpTile()
    expect(t.querySelector('.at-turk-val')!.textContent).toBe('04:32')
    expect(t.classList.contains('idle')).toBe(false)
  })

  it('permanent turkimp2 shows ∞ (not the icon-empty mirror)', () => {
    setGame({ permanent: true })
    document.getElementById('turkimpTime')!.textContent = '' // game renders an ∞ ICON = empty textContent
    const t = buildTurkimpTile()
    document.body.appendChild(t)
    updateTurkimpTile()
    expect(t.querySelector('.at-turk-val')!.textContent).toBe('∞')
    expect(t.querySelector('.at-turk-timer')!.classList.contains('inf')).toBe(true)
  })

  it('idle (no turkimp) shows a dim — placeholder, ignoring stale #turkimpTime text', () => {
    setGame({ timer: 0 })
    document.getElementById('turkimpTime')!.textContent = '00:00' // stale
    const t = buildTurkimpTile()
    document.body.appendChild(t)
    updateTurkimpTile()
    expect(t.querySelector('.at-turk-val')!.textContent).toBe('—')
    expect(t.classList.contains('idle')).toBe(true)
  })

  it('sync mounts the tile into #miscColumn directly after the helium tile', () => {
    syncTurkimpTile()
    const col = document.getElementById('miscColumn')!
    const turk = document.getElementById('atRT-turkimp')!
    expect(turk).not.toBeNull()
    expect(turk.previousElementSibling!.id).toBe('atRT-helium')
    // idempotent
    syncTurkimpTile()
    expect(col.querySelectorAll('#atRT-turkimp').length).toBe(1)
  })

  it('deactivate removes the tile', () => {
    syncTurkimpTile()
    deactivateTurkimpTile()
    expect(document.getElementById('atRT-turkimp')).toBeNull()
  })
})
