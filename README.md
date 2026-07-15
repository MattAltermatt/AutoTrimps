# AutoTrimps - Zek Fork

AutoTrimps is a large automation userscript for the incremental game
**[Trimps](https://trimps.github.io/)**: it plays the grind so you don't have to. It buys
buildings, jobs, equipment and upgrades, runs maps, manages stances and the Spire, allocates
perks, farms heirlooms and nature tokens, and handles dailies and Challenge² runs — across both
universes. It is configured heavily and deliberately: it is not a zero-config tool.

This repository is a **modernization fork** of the Zek/GenBTC lineage. Why it exists and what it
deliberately is *not* are in [VISION.md](VISION.md).

## 🛠️ Development

The runtime is TypeScript, built with esbuild into a single userscript. All planning and shipped
history lives in **[GitHub Issues](https://github.com/MattAltermatt/AutoTrimps/issues)** (grouped
by milestone; completed work is closed issues — see the
[Phases 0–2 record](https://github.com/MattAltermatt/AutoTrimps/issues/23)). There is no
ROADMAP/CHANGELOG in the repo, by design. The architecture is in the
[design spec](docs/superpowers/specs/2026-07-08-autotrimps-modernization-design.md).

```bash
npm install           # also fetches the pinned Trimps clone → .trimps-game/ (postinstall)
npm run build         # → dist/autotrimps.user.js
npm run build:watch   # rebuild on change
npm run serve         # static-serve a local Trimps clone (:8080) with the bundle injected
npm test              # vitest
npm run test:ci       # what CI runs: vitest + the zero-skip census
npm run typecheck     # tsc --noEmit
npm run lint          # oxlint --deny-warnings
```

No manual setup is needed to run the tests: `npm install` fetches the SHA-pinned copy of the
game that the behavioral test suite boots. That suite is the **deploy gate** — it replays the
bot's decisions against recorded traces, and a missing clone fails loudly rather than skipping.
`test:ci` additionally asserts that **no test may be skipped**: a gate optimized for greenness is
not a gate.

The port is **complete** as of **v6.0.0** (2026-07-15): every AutoTrimps-authored file is strict
TypeScript in `src/modules/`, including the mainLoop/loader (`src/modules/main-loop.ts`) and the
Graphs dashboard (`src/modules/graphs/`, now Apache ECharts). The only file left in `legacy/` is
the third-party vendored `FastPriorityQueue.js`, which the build concatenates after the TypeScript
bundle. Every change is still diffed against the recorded behavioral oracle.



## Discussion / Discord Channel
<a href="https://discord.gg/Ztcnfjr"><img src="https://discord.com/assets/3437c10597c1526c3dbd98c737c2bcae.svg" width=48></a>
Discord is a chat program. Come to talk about AutoTrimps, for help, or suggestions for new features : https://discord.gg/Ztcnfjr



## Current version — ongoing development

- Zek Fork (changes by Zek, GenBTC as base). This modernization fork (MattAltermatt) ported the
  runtime to TypeScript and re-synced the automation to current Trimps. The TypeScript migration
  finished at [**v6.0.0**](https://github.com/MattAltermatt/AutoTrimps/releases/tag/v6.0.0)
  (2026-07-15); the userscript still auto-updates from the same URL regardless of version.
- Automation parity is current as of **Trimps v5.10.1**. The game clone is SHA-pinned in
  `package.json` (`trimpsGame`), and a test fails if that pin and the recorded oracle disagree.
- Live status is always the [open issues](https://github.com/MattAltermatt/AutoTrimps/issues) and
  [milestones](https://github.com/MattAltermatt/AutoTrimps/milestones).



## Installation

The build is published by CI to **https://mattaltermatt.github.io/AutoTrimps/** — pick any
method (all load the same auto-built script). Visit that page for one-click install options.

- **Tampermonkey (auto-updates):** install [Tampermonkey](https://www.tampermonkey.net/), then
  open <https://mattaltermatt.github.io/AutoTrimps/autotrimps.user.js> — it prompts to install
  and auto-updates on each release.
- **Bookmarklet / console (no extension):** open
  <https://mattaltermatt.github.io/AutoTrimps/> for a one-click bookmarklet and a copy-paste
  console snippet. The console snippet must be re-pasted after each game refresh:
  ```
  var s=document.createElement('script');s.id='AutoTrimps-Zek';
  s.src='https://mattaltermatt.github.io/AutoTrimps/autotrimps.user.js?'+Date.now();
  s.setAttribute('crossorigin','anonymous');document.head.appendChild(s);
  ```
- **Steam:** save `autotrimps.user.js` into `Steam\steamapps\common\Trimps\mods\mods.js` and
  restart the game.

After loading, **configure your settings** — AutoTrimps will *not* behave as intended with
defaults.

Graphs are built into the script (open the **Graphs** button in-game) — there is no separate
"graphs-only" download in this fork.

## Equipment && Upgrade's colour explaination:

White - Upgrade is not available

Yellow - Upgrade is not affordable

Orange - Upgrade is affordable, but will lower stats

Red - Will buy next

## Troubleshooting

**Combat won't start** — set **Better Auto Fight** (or **Vanilla**) on the **Combat** tab. With
it Off, the game can sit idle after a portal until you click Fight yourself. If you're not on the
dark theme you may see only a thin black bar in combat — click it to reveal the setting.

**A setting seems to do nothing** — hover it. Every tooltip states when a setting is *ignored*,
what it *cannot* do, and whether AutoTrimps overwrites the box itself (several are outputs, not
inputs — the worker-ratio boxes are rewritten every tick in Auto mode).
