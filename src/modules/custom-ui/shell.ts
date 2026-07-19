import { SHELL_ID } from './regions'

export const MARKER_CLASS = 'at-ui-shell'
const STYLE_ID = 'at-ui-style'

// Inject the custom-UI stylesheet once (the graduated resource + population tiles). The old
// active-UI marker (green outline + "AutoTrimps UI" badge) was dropped in #41 Phase 3 — the
// restyled tiles make the custom UI self-evident.
function injectMarkerStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = [
    // #41 Phase 2 — layout-B resource tiles (graduated). Per-resource identity colour via --c.
    // The graduated native block is hidden with !important so the game's own reveal animation
    // (which sets an inline display:block on unlock) cannot un-hide it into a duplicate tile.
    '.at-rt-hidden{display:none !important}',
    '.at-rt{display:flex;flex-direction:column;background:linear-gradient(180deg,#353c47,#2f353e);border:1px solid #3f4753;border-radius:8px;overflow:hidden;margin-bottom:8px;--c:#d79246}',
    '.at-rt-food{--c:#63c583}.at-rt-wood{--c:#d79246}.at-rt-metal{--c:#93a6c2}.at-rt-science{--c:#4fb6e6}',
    '.at-rt-fragments{--c:#57c9c1}.at-rt-gems{--c:#b57ae0}.at-rt-helium{--c:#e8697f}',
    '.at-rt-head{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 0}',
    '.at-rt-name{font-weight:800;font-size:14px;color:#eef2f7}',
    '.at-rt-auto{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border-radius:4px;padding:2px 5px}',
    // Badge shows when actively gathering (green) OR turkimp'd (gold); hidden otherwise.
    '.at-rt-auto[data-on="0"]{display:none}',
    '.at-rt-auto[data-on="1"]{color:#08260f;background:#35c26b}',
    // The pulse follows the resource AT is actively hand-gathering (green or gold).
    '.at-rt-auto[data-gather="1"]{animation:atRtPulse 1.6s ease-in-out infinite}',
    // Turkimp treatment: gold badge with the verb wrapped in turkeys. Pseudo-elements keep the span's
    // textContent equal to the bare verb (tests + a11y), and the wrap toggles purely via data-turk.
    '.at-rt-auto[data-turk="1"]{color:#2a1c00;background:#e0b24a}',
    '.at-rt-auto[data-turk="1"]::before{content:"🦃 "}',
    '.at-rt-auto[data-turk="1"]::after{content:" 🦃"}',
    '@keyframes atRtPulse{0%,100%{box-shadow:0 0 0 0 rgba(53,194,107,.55)}50%{box-shadow:0 0 0 5px rgba(53,194,107,0)}}',
    '@media (prefers-reduced-motion:reduce){.at-rt-auto[data-gather="1"]{animation:none}}',
    '.at-rt-figs{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:2px 10px 6px}',
    '.at-rt-amt{font-family:ui-monospace,Menlo,monospace;font-weight:600;font-size:15px;color:#eef2f7}',
    '.at-rt-max{color:#7b8697;font-weight:500}',
    '.at-rt-rate{font-family:ui-monospace,Menlo,monospace;font-size:12px;font-weight:600;color:var(--c);white-space:nowrap}',
    // flex-grow so shorter tiles expand to fill a matched-height column instead of leaving a gap.
    '.at-rt-spark{display:block;width:100%;flex:1 1 auto;min-height:40px}',
    '.at-rt-area{fill:var(--c);opacity:.16}',
    '.at-rt-line{fill:none;stroke:var(--c);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
    '.at-rt-now{fill:var(--c);stroke:#2f353e;stroke-width:1.5}',
    // #149 Turkimp tile — a slim gold row in the misc column (name left, timer right). Mirrors
    // #turkimpTime; goes ∞ when turkimp2 is owned; dims to a `—` placeholder when no turkimp is active.
    '.at-turk{--c:#e0b24a;border-color:#5a4a24}',
    '.at-turk-row{display:flex;align-items:center;justify-content:space-between;padding:5px 9px}',
    '#atWrapper .at-turk .at-rt-name{color:#f0d089}',
    '.at-turk-timer{display:inline-flex;align-items:center;gap:4px;font-family:ui-monospace,Menlo,monospace;font-weight:700;font-size:13px;color:#fbe7b0}',
    '.at-turk-timer .tk{font-size:12px;line-height:1;vertical-align:-1px}',
    '.at-turk-timer.inf .at-turk-val{font-size:15px}',
    '.at-turk.idle{--c:#6b7482;border-color:#333b46}',
    '#atWrapper .at-turk.idle .at-rt-name{color:#7b8697}',
    '.at-turk.idle .at-turk-timer{color:#5c6675;font-weight:600}',
    '.at-turk.idle .tk{filter:grayscale(1);opacity:.5}',
    // #41 Phase 3 — the Trimps population panel (Variant A: stat pills). Adopts the game's live
    // breed bar + trap area into slots; mirrors owned/rate/breeding/employed as text.
    '.at-pop{--c:#e0b24a}',
    '.at-pop .at-rt-name{font-size:16px}',
    '.at-pop .at-rt-spark{min-height:52px}',
    // The Trimps tile stretches to fill its column (as the resource tiles do), so its bottom lands on
    // the same line as the other three columns — removes the 8px short-fall the base tile margin left.
    '#atWrapper #trimpsColumn .at-pop{height:100%;margin-bottom:0}',
    // Adopted breed timer (#trimpsBar inside its .progress) restyled to a slim, rounded, soft bar to
    // match the AT tiles — was a harsh flat-red game bar with a thick pale border. The fill WIDTH stays
    // game-driven; the countdown is centred over the whole track (readable at any fill %).
    '.at-pop-breedslot{position:relative;padding:8px 12px 0}',
    '#atWrapper .at-pop-breedslot .progress{position:relative;height:18px;margin:0;background:#2a2f38;border:1px solid #363d48;border-radius:9px;overflow:hidden;box-shadow:none}',
    '#atWrapper .at-pop-breedslot #trimpsBar{border:none;box-shadow:none;border-radius:9px;background:linear-gradient(90deg,#e0b24a,#e8697f) !important;transition:width .2s linear}',
    // Hide the game text inside the fill; the AT overlay (positioned over the bar in the slot we own)
    // carries the countdown, so it stays centred over the whole track at any fill %. Bar geom: the
    // slot pads 8px/12px and the bar is 18px tall, so the overlay matches (top:8px, sides:12px, h:18px).
    '#atWrapper .at-pop-breedslot #trimpsTimeToFill{display:none}',
    '#atWrapper .at-pop-breedtime{position:absolute;z-index:2;left:12px;right:12px;top:8px;height:18px;display:flex;align-items:center;justify-content:center;line-height:1;font-family:ui-monospace,Menlo,monospace;font-size:11px;font-weight:700;color:#eef2f7;text-shadow:0 1px 2px rgba(0,0,0,.55);white-space:nowrap;pointer-events:none}',
    // Adopted trap area: the Check Traps button restyled as an AT button (gold outline + gold text,
    // gold fill while actively trapping); the trapping progress as a slim rounded gold bar. Still the
    // live #trimpsCollectBtn (onclick setGather) / #trappingBar the game drives.
    '.at-pop-trapslot{padding:8px 12px 12px}',
    // The game ships #trapArea as inline-block width:85% with a 1px white border + 2% padding, so the
    // button/bar render narrow and left-shifted. Force a full-width block so they match the column.
    '#atWrapper .at-pop-trapslot #trapArea{display:block;width:100%;padding:0;margin:0;border:none}',
    '#atWrapper .at-pop-trapslot #trimpsCollectBtn{background:#2a2f38 !important;border:1px solid var(--c) !important;border-radius:7px;color:var(--c) !important;text-align:center;padding:9px;font-size:13px;font-weight:700;transition:background .12s}',
    '#atWrapper .at-pop-trapslot #trimpsCollectBtn:hover{background:#333b46 !important}',
    '#atWrapper .at-pop-trapslot #trimpsCollectBtn.workColorGather{background:var(--c) !important;border-color:var(--c) !important;color:#1a1206 !important}',
    '#atWrapper .at-pop-trapslot #trimpsCollecting{color:var(--c);text-align:center;padding:4px 0;font-size:12px;font-weight:700}',
    '#atWrapper .at-pop-trapslot #trappingProgress{height:8px;margin:6px 0 0;background:#2a2f38;border:1px solid #363d48;border-radius:4px;overflow:hidden;box-shadow:none}',
    '#atWrapper .at-pop-trapslot #trappingBar{background:var(--c) !important;border:none;border-radius:4px}',
    '.at-substats{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px 12px 2px}',
    '.at-substat{background:#2a2f38;border:1px solid #363d48;border-radius:6px;padding:6px 8px}',
    '.at-substat .k{font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:#7b8697}',
    '.at-substat .v{font-family:ui-monospace,Menlo,monospace;font-size:13px;font-weight:600;color:#eef2f7;margin-top:1px}',
    // Matched-height row: stretch the three HUD columns equal, and let the narrow misc column's
    // three tiles share that height evenly. Scoped to #topRow inside our shell only.
    // The game pins #topRow to a fixed height; let it grow so the tallest block (the Trimps panel)
    // drives the row and the shorter blocks stretch up to match it. A uniform flex gap + zeroed
    // bootstrap column gutters make every inter-column gap match the 8px intra-column tile gaps.
    '#atWrapper #topRow{display:flex;align-items:stretch;height:auto;gap:8px;margin-left:0;margin-right:0}',
    // height:auto on EVERY column overrides the game height rule that blocks align-items:stretch, so
    // all four columns (incl. #trimpsColumn) stretch to the tallest-block-driven row height.
    '#atWrapper #topRow>div{padding-left:0;padding-right:0;margin-left:0;margin-right:0;height:auto}',
    // The message log must NOT drive the row height — on a deep save it holds hundreds of messages
    // and would grow the row off the bottom of the viewport. Make the #log scroller a flex child with
    // a collapsed intrinsic height (min-height:0) so its content scrolls internally and the tile
    // columns (the Trimps panel) set the row height instead.
    // height:auto overrides a game height rule that otherwise blocks align-items:stretch on the
    // bootstrap columns, so all four columns stretch to the Trimps-panel-driven row height.
    '#atWrapper #logColumn{min-height:0;height:auto}',
    '#atWrapper #logContainer{display:flex;flex-direction:column;height:100%;min-height:0}',
    '#atWrapper #logContainer #log{flex:1 1 0;min-height:0;overflow-y:auto}',
    // Widen the misc column from its cramped col-xs-1 (~94px) to 150px (matching the approved mockup)
    // so side-by-side figs fit without clipping and the sparkline keeps real height; the log column
    // flexes to absorb the difference.
    '#atWrapper #miscColumn{display:flex;flex-direction:column;gap:8px;height:auto;flex:0 0 150px}',
    // min-height:0 on the tiles AND their sparklines lets three tiles distribute the matched column
    // height evenly — without it their min-content (header+figs+40px spark floor) sums past the
    // column height and the last tile (Helium) overflows/clips.
    '#atWrapper #miscColumn .at-rt{margin-bottom:0;min-height:0}',
    // #149 matched heights: only the two GRAPH tiles (Fragments/Gems) flex-grow to absorb the column
    // height; the chart-free Helium tile + the slim Turkimp row stay compact, so the 4-entry misc column
    // still ends level with its 3-tile / 2×2-grid neighbours.
    '#atWrapper #miscColumn .at-rt-fragments,#atWrapper #miscColumn .at-rt-gems{flex:1 1 0}',
    '#atWrapper #miscColumn .at-rt-helium,#atWrapper #miscColumn .at-turk{flex:0 0 auto}',
    '#atWrapper #miscColumn .at-rt-spark{min-height:0}',
    // Compact, stacked figs for the short/narrow misc tiles: name / value / rate each on their own
    // line with tighter fonts + padding, so real long rates (+1.86e5/sec) never clip and the
    // sparkline still gets real height (~38px in an 88px tile).
    // NOTE: the game forces `#miscColumn span { font-size: 1.2vw !important }` (style.css) — every span
    // in this column, incl. our tile spans. We must override with !important or the text renders ~21px
    // and swamps the tile. line-height clamped too so three lines + a sparkline fit in ~88px.
    '#atWrapper #miscColumn .at-rt-head{padding:4px 8px 0}',
    '#atWrapper #miscColumn .at-rt-name{font-size:12px !important;line-height:1.2}',
    '#atWrapper #miscColumn .at-rt-figs{flex-direction:column;align-items:flex-start;gap:0;padding:0 8px 2px}',
    '#atWrapper #miscColumn .at-rt-amt{font-size:15px !important;line-height:1.25}',
    '#atWrapper #miscColumn .at-rt-rate{font-size:11px !important;line-height:1.2}',
    // The Turkimp tile's timer spans live in #miscColumn too, so they lose the same 1.2vw !important
    // font fight — pin them with !important (matching the resource-tile overrides above), or the
    // countdown swamps the slim row and the ∞ size-bump is defeated.
    // Every span here needs its OWN !important size: the game's `#miscColumn span{1.2vw !important}` hits
    // the nested .at-turk-val / .tk spans directly, so pinning only the .at-turk-timer parent leaves the
    // countdown digits at 1.2vw (a child-span rule beats inherited size). Pin all three; ∞ bumps the val.
    '#atWrapper #miscColumn .at-turk-timer{font-size:13px !important}',
    '#atWrapper #miscColumn .at-turk-timer .tk{font-size:12px !important}',
    '#atWrapper #miscColumn .at-turk-timer .at-turk-val{font-size:13px !important}',
    '#atWrapper #miscColumn .at-turk-timer.inf .at-turk-val{font-size:15px !important}',
    '#atWrapper #logColumn{flex:1 1 0}',
    // The resource 2x2 grid: neutralise bootstrap floats to flex so its two rows + four tiles stretch
    // to the matched row height too (sparklines flex-grow to fill).
    '#atWrapper #resourceColumn{display:flex;flex-direction:column;gap:8px;height:auto}',
    '#atWrapper #resourceColumn .resourceRow{flex:1 1 0;display:flex;gap:8px;margin:0}',
    '#atWrapper #resourceColumn .resourceRow>.col-xs-6{flex:1 1 0;width:auto;padding:0;float:none}',
    '#atWrapper #resourceColumn .resourceRow>.col-xs-6 .at-rt{height:100%;margin-bottom:0}',
  ].join('\n')
  document.head.appendChild(style)
}

// Create the AT-owned root shell as a plain, STATIC body sibling. Rule 2: never
// set position/transform/filter here — game overlays (#tooltipDiv, portal, spire)
// are body siblings and must keep <body> as their containing block.
export function ensureShell(): HTMLElement {
  const existing = document.getElementById(SHELL_ID)
  if (existing) return existing
  injectMarkerStyles()
  const shell = document.createElement('div')
  shell.id = SHELL_ID
  // MARKER_CLASS stays as the shell's identity hook (no visual weight now — #41 Phase 3 dropped the
  // green outline + "AutoTrimps UI" badge; the graduated tiles make the custom UI self-evident).
  shell.className = MARKER_CLASS
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
