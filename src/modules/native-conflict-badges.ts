// #150 — renders the conflict matrix as warning badges beside the native automation buttons.
//
// THREE THINGS THIS FILE MUST KEEP DOING, each learned the hard way:
//  1. The badge is a SIBLING of the anchor. toggleAutoStorage/toggleAutoUpgrades/toggleAutoPrestiges
//     each assign `elem.innerHTML = "<label>"` on every click (main.js:18379/:18416/:18432) — a child
//     badge is destroyed the first time the player clicks the button it is warning about.
//  2. It never touches the anchor's own `onmouseover`. All five native buttons already carry the
//     game's own tooltip (index.html:440-492); overwriting it would trade one explanation for another.
//  3. It syncs, it does not mount-once. The game writes `style.display` on the BUTTONS at load and on
//     Bone Shrine level changes (main.js:1221-1231, updates.js:4279-4286/:4804-4808) and never touches
//     a sibling — so visibility has to be re-read, exactly like custom-ui's syncRegion().
import { CONFLICTS, activeConflicts } from './native-conflicts'
import { tooltipAttr } from './settings-engine'

const STYLE_ID = 'at-nc-style'
const BADGE_CLASS = 'at-nc-badge'
const ID_PREFIX = 'atNC-'

function ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    // A compact strip under the button. Deliberately NOT positioned/absolute: making a game element a
    // containing block to hang this off would be a bigger intrusion than the layout cost.
    // Measured cost, so nobody has to guess: the badge grows its title row from 31.1px to 45.7px
    // (+14.6px), which pushes the panel below it down by that much. Neighbouring buttons in the same
    // row do NOT move (measured shift 0,0), so it cannot make a control slide out from under the
    // cursor. If that vertical shift ever becomes objectionable, `float:right` here is the one-line
    // alternative — at the cost of clipping, since these cells are ~94px wide.
    style.textContent = [
        '.' + BADGE_CLASS + '{display:block;text-align:center;font-size:0.65vw;line-height:1.3;',
        'cursor:help;color:#f0ad4e;font-weight:bold;white-space:nowrap;overflow:hidden}',
    ].join('')
    document.head.appendChild(style)
}

/**
 * Visible = the game has not hidden it.
 *
 * MUST be computed style, not `anchor.style.display`. The five native buttons are hidden by a CSS
 * CLASS — `.autoUpgradeBtn { display: none }` (.trimps-game/css/style.css:5459-5463), which all of them
 * carry — and the game *reveals* them by writing an inline `display:'block'` (main.js:1221-1232,
 * updates.js:4804-4808, config.js:9879). So a never-revealed button has `style.display === ''`, and
 * reading the inline style alone reports it VISIBLE. Same shape as the #41 Phase 2 bug: the inline
 * style and the class say different things, and only one of them is the whole answer.
 */
function anchorVisible(anchor: HTMLElement): boolean {
    return getComputedStyle(anchor).display !== 'none'
}

function buildBadge(key: string): HTMLElement {
    const el = document.createElement('span')
    el.id = ID_PREFIX + key
    el.className = BADGE_CLASS
    // The game ships Bootstrap's glyphicon font (css/bootstrap.css:610), so this needs no new asset
    // and matches the surrounding chrome rather than importing an emoji into the HUD.
    el.innerHTML = '<span class="glyphicon glyphicon-warning-sign"></span> AT conflict'
    el.setAttribute('onmouseout', 'tooltip("hide")')
    return el
}

/**
 * Idempotent sweep: mount a badge for every live conflict whose anchor is visible, refresh the hover
 * copy of those already mounted (the text names the universe-correct setting, and the universe can
 * change under us), and unmount the rest.
 */
export function syncConflictBadges(): void {
    ensureStyle()
    const live = new Set(activeConflicts().map((c) => c.key))
    for (const c of CONFLICTS) {
        const existing = document.getElementById(ID_PREFIX + c.key)
        const anchor = document.getElementById(c.anchorId)
        const wanted = live.has(c.key) && !!anchor && anchorVisible(anchor) && !!anchor.parentElement
        if (!wanted) {
            existing?.remove()
            continue
        }
        const badge = existing ?? buildBadge(c.key)
        // Recomposed every sweep so the copy can never go stale against the live universe.
        badge.setAttribute('onmouseover', tooltipAttr(c.title, c.body()))
        if (!existing) anchor!.parentElement!.insertBefore(badge, anchor!.nextSibling)
    }
}

export function removeConflictBadges(): void {
    for (const c of CONFLICTS) document.getElementById(ID_PREFIX + c.key)?.remove()
    document.getElementById(STYLE_ID)?.remove()
}
