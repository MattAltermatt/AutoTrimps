import { ensureShell } from './shell'
import { HUD_ROOT_ID } from './regions'
import { customUIState } from './state'

// Where #wrapper sat in <body> before adoption, so release() restores exact order.
let originalAnchor: { parent: Node; nextSibling: Node | null } | null = null

export function adoptHud(): void {
  if (customUIState.adopted) return
  const wrapper = document.getElementById(HUD_ROOT_ID)
  if (!wrapper || !wrapper.parentNode) return
  originalAnchor = { parent: wrapper.parentNode, nextSibling: wrapper.nextSibling }
  const shell = ensureShell()
  shell.appendChild(wrapper) // Rule 1: whole container, intact. Rule 3: id preserved.
  customUIState.adopted = true
}

export function releaseHud(): void {
  if (!customUIState.adopted) return
  const wrapper = document.getElementById(HUD_ROOT_ID)
  if (wrapper && originalAnchor) {
    originalAnchor.parent.insertBefore(wrapper, originalAnchor.nextSibling)
  }
  customUIState.adopted = false
}
