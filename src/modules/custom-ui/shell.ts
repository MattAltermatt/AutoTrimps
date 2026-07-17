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
    // #41 Phase 2 — layout-B resource tiles (graduated). Per-resource identity colour via --c.
    // The graduated native block is hidden with !important so the game's own reveal animation
    // (which sets an inline display:block on unlock) cannot un-hide it into a duplicate tile.
    '.at-rt-hidden{display:none !important}',
    '.at-rt{background:linear-gradient(180deg,#353c47,#2f353e);border:1px solid #3f4753;border-radius:8px;overflow:hidden;margin-bottom:8px;--c:#d79246}',
    '.at-rt-food{--c:#63c583}.at-rt-wood{--c:#d79246}.at-rt-metal{--c:#93a6c2}.at-rt-science{--c:#4fb6e6}',
    '.at-rt-head{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 0}',
    '.at-rt-name{font-weight:800;font-size:14px;color:#eef2f7}',
    '.at-rt-auto{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border-radius:4px;padding:2px 5px}',
    '.at-rt-auto[data-on="1"]{color:#08260f;background:#35c26b}',
    '.at-rt-auto[data-on="0"]{color:#7b8697;border:1px solid #4a5462;background:transparent}',
    '.at-rt-figs{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:2px 10px 6px}',
    '.at-rt-amt{font-family:ui-monospace,Menlo,monospace;font-weight:600;font-size:15px;color:#eef2f7}',
    '.at-rt-max{color:#7b8697;font-weight:500}',
    '.at-rt-rate{font-family:ui-monospace,Menlo,monospace;font-size:12px;font-weight:600;color:var(--c);white-space:nowrap}',
    '.at-rt-spark{display:block;width:100%;height:40px}',
    '.at-rt-area{fill:var(--c);opacity:.16}',
    '.at-rt-line{fill:none;stroke:var(--c);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
    '.at-rt-now{fill:var(--c);stroke:#2f353e;stroke-width:1.5}',
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
