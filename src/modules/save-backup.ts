// #124 — "Backup & Portal": make the safe path the default one for the game's only irreversible action.
//
// THE ISSUE ASKED THE WRONG QUESTION, AND MEASURING IT IS WHAT SHOWED THAT. It asked whether the portal
// should fire only "after the download is confirmed". Measured in real Chrome: an <a download> click
// emits NO load/error/abort/progress/loadend event, `a.click()` returns undefined, and there is no
// download API on window. **There is no completion signal to gate on.** "Portal only after the file is
// safely on disk" is not a thing a page can know. A safety feature built on that premise would be
// false confidence — the single worst outcome here.
//
// So the guarantee is inverted. The localStorage backup is the MECHANISM; the file is a convenience:
//
//   1. `save(true)` returns the save string without touching trimpSave1 (main.js:220). Pure.
//   2. Write it to a 3-deep ring in localStorage and READ IT BACK — synchronous, uncancellable, and
//      verifiable. This is the same self-check the game performs on its own save (main.js:233).
//   3. If that readback fails, the portal DOES NOT FIRE. That is the only hard gate, and it is real.
//   4. Fire the file download, and do NOT gate on it, because we cannot.
//
// This covers the disaster that actually happens — portalled with the wrong challenge, or before
// allocating perks — with 100% reliability. It does not survive cleared browser storage; that is what
// the file is for, best-effort and honestly labelled. The UI never claims a file reached the disk.
//
// The game does NOT save on portal (`activatePortal()` → `resetGame(true)` touches no localStorage;
// autoSave runs on a 60s timer), so there is no existing safety net to lean on here.

const RING_SIZE = 3
const KEY = (i: number) => `atPrePortalBackup.${i}`

export interface PrePortalBackup {
    save: string
    universe: number
    world: number
    ts: number
}

/**
 * Write a verified pre-portal backup to localStorage. Returns false if — and only if — the save could
 * not be stored AND read back intact, in which case the caller MUST NOT portal.
 */
export function writePrePortalBackup(): boolean {
    let payload: string
    try {
        const record: PrePortalBackup = {
            save: save(true),
            universe: game.global.universe,
            world: game.global.world,
            ts: new Date().getTime(),
        }
        payload = JSON.stringify(record)
    } catch (e) {
        debug('Pre-portal backup FAILED to serialize: ' + e, 'portal')
        return false
    }

    // Rotate the ring oldest-first so a quota error costs the oldest backup, never the new one.
    for (let i = RING_SIZE - 1; i > 0; i--) {
        const prev = localStorage.getItem(KEY(i - 1))
        if (prev !== null) {
            try { localStorage.setItem(KEY(i), prev) } catch { /* an old slot is expendable */ }
        }
    }

    try {
        localStorage.setItem(KEY(0), payload)
    } catch (e) {
        // Quota: drop the ring and retry once with only the new backup.
        for (let i = 1; i < RING_SIZE; i++) localStorage.removeItem(KEY(i))
        try {
            localStorage.setItem(KEY(0), payload)
        } catch {
            debug('Pre-portal backup FAILED to store (localStorage full?): ' + e, 'portal')
            return false
        }
    }

    // The readback is the whole guarantee. Without it this function only *believes* it saved.
    return localStorage.getItem(KEY(0)) === payload
}

/** The stored backups, newest first. */
export function listPrePortalBackups(): PrePortalBackup[] {
    const out: PrePortalBackup[] = []
    for (let i = 0; i < RING_SIZE; i++) {
        const raw = localStorage.getItem(KEY(i))
        if (raw === null) continue
        try { out.push(JSON.parse(raw) as PrePortalBackup) } catch { /* a corrupt slot is skipped, not fatal */ }
    }
    return out
}

/** `trimps-u2-z138-2026-07-13T2312.txt` — worth having when twenty of them are in a Downloads folder. */
export function backupFilename(b: Pick<PrePortalBackup, 'universe' | 'world' | 'ts'>): string {
    const stamp = new Date(b.ts).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')
    return `trimps-u${b.universe}-z${b.world}-${stamp}.txt`
}

/**
 * Hand the save to the browser as a file. Best-effort BY CONSTRUCTION: there is no success signal to
 * return, so this returns nothing and no caller may gate on it.
 */
export function downloadSaveFile(text: string, filename: string): void {
    try {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        // Revoking too early can abort the browser's own fetch of the blob. It costs a few hundred KB
        // of memory to wait; it costs the user their file not to.
        setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
        debug('Save file download failed (the localStorage backup is unaffected): ' + e, 'portal')
    }
}

/** Re-download one of the stored backups. Index 0 is the newest. */
export function downloadPrePortalBackup(index: number): void {
    const b = listPrePortalBackups()[index]
    if (!b) return
    downloadSaveFile(b.save, backupFilename(b))
}

/**
 * Hand the newest stored backup back to the user as a file.
 *
 * Without a way OUT, the backup ring is write-only and therefore worthless — so this is not a nice-to-
 * have, it is half the feature. It lives in the portal menu because that markup is static (index.html),
 * so unlike the Import/Export tab there is no mount-ordering hazard, and it is where a player who wants
 * their pre-portal save will actually go looking.
 */
export function downloadLatestBackup(): void {
    const backups = listPrePortalBackups()
    if (backups.length === 0) {
        message("No pre-portal backup stored yet. One is written every time you portal from here.", "Story", "*question3", "");
        return
    }
    const b = backups[0]
    downloadPrePortalBackup(0)
    message("Downloading your pre-portal backup from Universe " + b.universe + ", zone " + b.world + ".", "Story", "*download3", "");
}

/**
 * The "Backup & Portal" button. Fires the portal ONLY if the in-browser backup verified.
 *
 * The download is fired first but not awaited — see the header: there is nothing to await.
 */
export function backupAndPortal(): void {
    if (!writePrePortalBackup()) {
        // Deliberately loud and deliberately NOT a portal. The one thing worse than no backup is
        // believing you have one.
        message("Backup FAILED — the portal was NOT fired. Your run is untouched. Export your save manually before portaling.", "Story", "*exclamation-triangle", "corruptionMessage");
        return
    }
    const latest = listPrePortalBackups()[0]
    if (latest) downloadSaveFile(latest.save, backupFilename(latest))
    activateClicked()
}

/**
 * Mount the button next to the game's own portal button. It is the primary action, so it is the larger
 * one and the vanilla button shrinks beside it — the vanilla button is NOT removed: this adds a safer
 * sibling, it does not take the choice away.
 */
export function mountBackupPortalButton(): void {
    const container = document.getElementById('portalBtnContainer')
    const vanilla = document.getElementById('activatePortalBtn')
    if (!container || !vanilla || document.getElementById('atBackupPortalBtn')) return

    const btn = document.createElement('div')
    btn.id = 'atBackupPortalBtn'
    btn.className = 'btn btn-success inPortalBtn'
    btn.style.fontSize = '1.3em'
    btn.style.fontWeight = 'bold'
    btn.innerHTML = 'Backup &amp; Portal'
    btn.setAttribute('onclick', 'backupAndPortal()')
    btn.setAttribute('onmouseover', "tooltip('Backup &amp; Portal', 'customText', event, 'Saves a backup inside your browser, downloads a copy of your save as a file, and THEN portals. If the in-browser backup cannot be written, the portal is cancelled instead.&lt;br/&gt;&lt;br/&gt;The downloaded file is best-effort: a browser gives a page no way to confirm a download finished, so this does not promise a file reached your disk. The in-browser backup is the one that is verified.')");
    btn.setAttribute('onmouseout', "tooltip('hide')");

    vanilla.style.fontSize = '0.8em'
    container.insertBefore(btn, vanilla)

    // The way back out. See downloadLatestBackup().
    const restore = document.createElement('div')
    restore.id = 'atRestoreBackupBtn'
    restore.className = 'btn btn-info inPortalBtn'
    restore.style.fontSize = '0.8em'
    restore.innerHTML = 'Download Last Backup'
    restore.setAttribute('onclick', 'downloadLatestBackup()')
    restore.setAttribute('onmouseover', "tooltip('Download Last Backup', 'customText', event, 'Re-downloads the most recent pre-portal backup stored in your browser. AutoTrimps keeps the last 3, and writes one before every portal — including the ones it fires for you automatically.')");
    restore.setAttribute('onmouseout', "tooltip('hide')");
    container.appendChild(restore)
}
