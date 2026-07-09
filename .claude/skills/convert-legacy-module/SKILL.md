---
name: convert-legacy-module
description: >
  The proven recipe for porting a legacy/*.js file into a typed src/modules/*.ts
  module in the AutoTrimps strangler migration. Use when converting any remaining
  legacy file (Graphs.js, AutoTrimps2.js, or smaller ones) so each port follows the
  same faithful-seam pattern and passes the same byte-parity gate instead of
  rediscovering the approach each time.
user-invocable: false
---

# convert-legacy-module

Background knowledge for legacy→TypeScript conversions. The migration is a
**faithful strangler port**: behavior must not change — only module wiring does.
Every port follows this locked shape.

## Principles

1. **Faithful first, refactor never (in the same pass).** Port the logic
   byte-for-byte. Do NOT "clean up," rename, restructure loops, or touch any
   numeric literal during a conversion — that defeats the byte-parity gate and
   risks a silent gameplay-balance change. Cleanups are a separate, later slice.
2. **Seam over rewrite.** Bridge to the legacy runtime rather than untangling it:
   - `// @ts-nocheck` at the top of a freshly ported large file is expected.
   - Reference still-global game/AT identifiers via the established `globalThis`
     seam rather than importing everything at once.
   - Publish the module's surface the way the existing modules do (match a
     sibling in `src/modules/` — do not invent a new wiring convention).
3. **esbuild strips comments.** Any sentinel the build test relies on must be
   **code**, never a comment — comments vanish in the bundle.
4. **Concat/ASI hazards are real.** The userscript is concatenated; legacy files
   need `;` guards so automatic-semicolon-insertion doesn't fuse statements. Do
   NOT bundle `highcharts.js` (Graphs.js CDN-injects it) — that file is guarded
   against edits for this reason.

## The recipe

1. **Read the legacy file whole** and the build manifest in
   `scripts/build-userscript.mjs` to see load order and how the file is included.
2. **Scout for a peel vs. straight-port decision.** Grep how many call sites
   reference the file's internals. Heavy shared-global coupling → straight port
   behind a seam (the usual answer for big files); a genuinely isolated pure-math
   cluster → a peel is possible. When the decision affects 2+ later phases or is
   hard to reverse, dispatch dueling agents (advocate / advocate / adversarial
   falsifier) rather than one-shotting it.
3. **Port faithfully** into `src/modules/<name>.ts` with the seam wiring above.
4. **Update the build manifest** to include the new module and drop the legacy
   file — in the correct load-order slot (a load-time call in the wrong slot has
   bitten this project before; the seam must publish before its first consumer).
5. **Green the gates, in order:**
   - `npm run lint` (oxlint) and `npm run typecheck` (tsc — baseline is clean)
   - `npm test` (Vitest — includes the build-userscript concat test)
   - **byte-parity** via the `legacy-parity-verifier` subagent (it needs git;
     a sandboxed reviewer cannot do this) — proves ordered `createSetting` ids
     match and function bodies are byte-identical vs `git show gh-pages:<file>`.
   - live verify in Chrome via the `verify-live` skill.
6. **Commit per task** (per-file, terse subject) and only FF-merge after the
   user manually verifies.

## Done means

Byte-parity proven against the pre-conversion `gh-pages` source, lint+typecheck+
tests green, and the change seen running clean in Chrome — not "it compiles."
