import { SHELL_ID } from './regions'

export const MARKER_CLASS = 'at-ui-shell'
const STYLE_ID = 'at-ui-style'

// The obvious marker: an accent frame on the shell + a fixed corner badge. Injected once.
// Rule 2: the frame is `outline` (no layout shift, no containing block); the badge is
// position:fixed (viewport-relative — independent of #atWrapper, which stays static).
function injectMarkerStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = [
    `#${SHELL_ID}.${MARKER_CLASS} { outline: 3px solid #35c26b; outline-offset: -3px; }`,
    `#${SHELL_ID} .at-ui-badge {`,
    '  position: fixed; top: 0; right: 0; z-index: 2147483000;',
    '  background: #35c26b; color: #06240f; font: bold 12px/1 sans-serif;',
    '  padding: 4px 8px; border-bottom-left-radius: 6px; pointer-events: none;',
    '  letter-spacing: 0.04em; box-shadow: 0 1px 4px rgba(0,0,0,.4);',
    '}',
  ].join('\n')
  document.head.appendChild(style)
}

// Create the AT-owned root shell as a plain, STATIC body sibling. Rule 2: never
// set position/transform/filter here — game overlays (#tooltipDiv, portal, spire)
// are body siblings and must keep <body> as their containing block. The marker
// outline (outline: no layout shift) + a position:fixed badge signal the AT UI.
export function ensureShell(): HTMLElement {
  const existing = document.getElementById(SHELL_ID)
  if (existing) return existing
  injectMarkerStyles()
  const shell = document.createElement('div')
  shell.id = SHELL_ID
  shell.className = MARKER_CLASS
  const badge = document.createElement('div')
  badge.className = 'at-ui-badge'
  badge.textContent = 'AutoTrimps UI'
  shell.appendChild(badge)
  document.body.appendChild(shell)
  return shell
}

export function showShell(): void {
  const shell = document.getElementById(SHELL_ID)
  if (shell) shell.style.display = ''
}

export function hideShell(): void {
  const shell = document.getElementById(SHELL_ID)
  if (shell) shell.style.display = 'none'
}
