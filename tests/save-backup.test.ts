// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  writePrePortalBackup,
  listPrePortalBackups,
  backupFilename,
  backupAndPortal,
  mountBackupPortalButton,
} from '../src/modules/save-backup'

// #124 — "Backup & Portal".
//
// The issue asked whether the portal should fire only after the file download is CONFIRMED. Measured in
// real Chrome: an <a download> click emits no load/error/abort/loadend event, a.click() returns
// undefined, and there is no download API on window. There is NO completion signal. So "the file is
// safely on disk" is not a thing this code can ever know, and building the safety gate on it would ship
// false confidence — the worst possible outcome for a feature guarding an irreversible action.
//
// The guarantee is therefore inverted, and these tests pin the inversion:
//   - the localStorage backup is synchronous, uncancellable, and VERIFIED BY READBACK;
//   - a failed backup CANCELS THE PORTAL (the one hard gate, and the test that matters most);
//   - the file download is best-effort and NOTHING gates on it.

// This project's jsdom environment supplies `document` but NOT `localStorage`, so the store is provided
// here explicitly. That is a feature for these tests, not a workaround: the two failure modes the gate
// exists to catch — a throwing setItem (quota) and a SILENTLY no-op setItem (which real browsers have
// shipped) — are both driven directly through this stub.
type Mode = 'ok' | 'throw' | 'silent-noop'
let mode: Mode = 'ok'

function installLocalStorage() {
  const map = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (mode === 'throw') throw new Error('QuotaExceededError')
      if (mode === 'silent-noop') return
      map.set(k, v)
    },
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  }
}

function stubGame(world = 138, universe = 2) {
  ;(globalThis as any).game = { global: { world, universe } }
  ;(globalThis as any).save = vi.fn(() => 'SAVESTRING')
  ;(globalThis as any).debug = vi.fn()
  ;(globalThis as any).message = vi.fn()
  ;(globalThis as any).activateClicked = vi.fn()
}

beforeEach(() => {
  mode = 'ok'
  installLocalStorage()
  stubGame()
  vi.restoreAllMocks()
})

describe('#124: the pre-portal backup is verified before the portal is allowed to fire', () => {
  it('writes a backup and reads it back', () => {
    expect(writePrePortalBackup()).toBe(true)
    const [b] = listPrePortalBackups()
    expect(b.save).toBe('SAVESTRING')
    expect(b.world).toBe(138)
    expect(b.universe).toBe(2)
  })

  it('calls save(true) — the export form, which must NOT overwrite the live trimpSave1', () => {
    writePrePortalBackup()
    expect((globalThis as any).save).toHaveBeenCalledWith(true)
    expect(localStorage.getItem('trimpSave1')).toBeNull()
  })

  it('THE GATE: a failed backup cancels the portal — the one thing worse than no backup is believing you have one', () => {
    mode = 'throw' // localStorage full / blocked
    backupAndPortal()
    expect((globalThis as any).activateClicked).not.toHaveBeenCalled()
    expect((globalThis as any).message).toHaveBeenCalled()
  })

  it('THE GATE, second failure mode: a SILENT no-op write (setItem succeeds but stores nothing) also cancels the portal', () => {
    // This is precisely why the readback exists. Without it the function merely *believes* it saved —
    // and browsers have really shipped this (Safari private mode accepted setItem and stored nothing).
    // A backup routine that cannot detect a silent no-op is the false-confidence failure in miniature.
    mode = 'silent-noop'
    expect(writePrePortalBackup()).toBe(false)
    backupAndPortal()
    expect((globalThis as any).activateClicked).not.toHaveBeenCalled()
  })

  it('a successful backup DOES portal', () => {
    backupAndPortal()
    expect((globalThis as any).activateClicked).toHaveBeenCalledTimes(1)
    expect(listPrePortalBackups()).toHaveLength(1)
  })

  it('keeps a ring of the last 3, newest first, and rolls the oldest off', () => {
    for (const w of [10, 20, 30, 40]) {
      ;(globalThis as any).game.global.world = w
      ;(globalThis as any).save = vi.fn(() => `SAVE-${w}`)
      expect(writePrePortalBackup()).toBe(true)
    }
    const ring = listPrePortalBackups()
    expect(ring).toHaveLength(3)
    expect(ring.map((b) => b.world)).toEqual([40, 30, 20]) // z10 rolled off
  })

  it('names the file so it is worth having later', () => {
    expect(backupFilename({ universe: 2, world: 138, ts: Date.UTC(2026, 6, 13, 23, 12) }))
      .toBe('trimps-u2-z138-20260713-2312.txt')
  })

  it('mounts the button beside the game\'s portal button without removing it', () => {
    document.body.innerHTML =
      '<div id="portalBtnContainer"><div id="activatePortalBtn">Activate Portal</div></div>'
    mountBackupPortalButton()

    const btn = document.getElementById('atBackupPortalBtn')!
    expect(btn).not.toBeNull()
    expect(btn.getAttribute('onclick')).toBe('backupAndPortal()')
    // It is the primary action, so it comes first and the vanilla button survives, shrunk.
    const container = document.getElementById('portalBtnContainer')!
    expect(container.firstElementChild!.id).toBe('atBackupPortalBtn')
    expect(document.getElementById('activatePortalBtn')).not.toBeNull()

    // Idempotent: initializeAutoTrimps can run more than once and must not stack buttons.
    mountBackupPortalButton()
    expect(container.querySelectorAll('#atBackupPortalBtn')).toHaveLength(1)
  })
})
