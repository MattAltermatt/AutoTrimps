# Vision — AutoTrimps (modernization fork)

AutoTrimps is a large automation userscript for the incremental game **Trimps**: it plays the
grind so the player doesn't have to — buying buildings, jobs, equipment and upgrades, running
maps, managing stances and the Spire, allocating perks, and farming heirlooms, across both
universes. This repository is a **modernization fork** of the Zek/GenBTC lineage, owned by
MattAltermatt.

## What this fork is for

The original script is ~18k lines of dense, minified-in-spirit legacy JavaScript that had
drifted out of sync with the live game. The goal here is to **modernize the whole thing in
place** — a full TypeScript/Vite toolchain and a module-by-module rewrite — while keeping the
userscript a drop-in replacement that behaves identically to the version players already trust.
Two things are being fixed at once: the *codebase* (untyped legacy → typed modules with tests)
and the *coverage* (automation that had fallen behind the current Trimps release).

## Who uses it

Trimps players who run the game semi-idle and want the tedium automated — installed via
Tampermonkey (browser) or the Steam mods folder. They configure it heavily; it is deliberately
not a zero-config tool. The distributed artifact is a single built userscript.

## How we get there — the strangler

The migration is an **incremental strangler**, not a big-bang rewrite (a prior from-scratch
rewrite was abandoned — "don't reinvent the wheel"). Legacy `.js` stays untouched in `legacy/` as
a behavioral oracle; the build assembles one userscript from `legacy concat` +
`esbuild(src/main.ts)`; modules are ported one at a time behind a stable seam and verified in a
live local clone of the game before the legacy copy is retired. Faithful port first, refactor
second — and the port is now essentially done: the automation is strict TypeScript in
`src/modules/`, and what is left in `legacy/` is the loader/mainLoop (`AutoTrimps2.js`), the
Graphs stack (`Graphs.js` + highcharts), and the graphs-only distribution artifacts. The full
architecture and rationale are in the
[design spec](docs/superpowers/specs/2026-07-08-autotrimps-modernization-design.md).

## What it deliberately is NOT

- **Not a rewrite from scratch** — behavior parity with the trusted legacy script is the
  invariant; every port is diffed against the oracle.
- **Not a balance mod** — it automates play, it never changes game numbers.
- **Not a maintained-doc pile** — planning and history live in
  [GitHub Issues / Milestones](https://github.com/MattAltermatt/AutoTrimps/issues), not in
  ROADMAP/CHANGELOG files. This VISION and the README are the only narrative docs at root.

## Status

A long-horizon, multi-session side project (started 2026-07-08). The conversion is shipped: the
runtime is TypeScript-first, the automation is synced to the current Trimps release, and only the
loader and the Graphs stack remain as legacy. Work has moved from *porting* to *correctness* —
behavioral proof nets that can prove the bot's decisions haven't drifted, and the defects they
keep surfacing. Live status is always the
[open issues](https://github.com/MattAltermatt/AutoTrimps/issues) and
[milestones](https://github.com/MattAltermatt/AutoTrimps/milestones) — this file stays north-star,
not a changelog.
