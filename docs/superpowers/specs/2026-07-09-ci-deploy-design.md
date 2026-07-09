# CI Deploy — source on `main`, GitHub Actions builds & publishes to Pages

**Issue:** [#33](https://github.com/MattAltermatt/AutoTrimps/issues/33)
**Date:** 2026-07-09
**Status:** Design approved — ready for implementation plan

## 🎯 Goal

Replace the manual, hand-built deploy with a reproducible CI pipeline, and publish a
**single artifact that is usable in every delivery mode** — Tampermonkey userscript
(auto-updating), plain console/bookmarklet injection, and Steam `mods.js` — from one
stable URL:

```
https://mattaltermatt.github.io/AutoTrimps/autotrimps.user.js
```

## 🩹 Current pain

- Default branch is `gh-pages`; development happens **directly on the deploy branch** —
  source history and deploy artifacts are tangled.
- `dist/autotrimps.user.js` is **gitignored** and built locally; there is no committed,
  automated deploy path. Shipping depends on a human running `npm run build` and placing
  the output by hand.
- "It built on my machine" ≠ reproducible. A CI build guarantees the deployed bundle
  matches `main`.
- No hosted, ready-to-fetch build exists — so running the fork without Tampermonkey
  (console/bookmarklet referencing the Pages URL) is impossible today.

## 🧭 Chosen approach: Actions-native GitHub Pages

Selected **Approach A** over (B) flip-to-`main` + CI pushes the artifact to a `gh-pages`
output branch, and (C) minimal no-flip in-place commit.

**Why A:**
- Modern GitHub-recommended flow: `actions/upload-pages-artifact` + `actions/deploy-pages`
  with the Pages **Source set to "GitHub Actions"**.
- **No build artifact ever enters git history** — honors the existing `dist/`-is-gitignored
  principle instead of violating it (B commits a ~1 MB file on every push).
- No orphan-branch juggling. The `gh-pages` branch is retired entirely.
- Served URL is identical to B, so the console/bookmarklet snippet is unaffected by the
  plumbing choice.

**Cost:** one-time repo-settings flip of Pages *Source* from "Deploy from a branch" →
"GitHub Actions."

## 🌿 Branch model

- Create `main` from the current `gh-pages` HEAD.
- **Flip the default branch → `main`** (repo setting). Matches the standard layout and the
  global `main`-not-`master` preference; with Approach A the `gh-pages` *branch* has no
  remaining role, so keeping it as the dev default would be a name-vs-role mismatch.
- Development: `feature/...` → FF-merge to `main` (unchanged cadence, new base).
- `gh-pages` branch becomes vestigial once Pages reads from Actions → **retire it** as a
  final, gated cleanup step (destructive; explicit approval).
- Cutover is clean: Phase 1 is shipped and there are **no in-flight `feature/...` branches**
  to strand.

## 🏗️ Architecture

### `.github/workflows/deploy.yml`

Trigger: `push` to `main` (+ `workflow_dispatch` for manual re-runs).

```
build job:
  - checkout
  - setup-node (with npm cache)
  - npm ci
  - npm run typecheck        # GATE — failure aborts the job
  - npm test                 # GATE — failure aborts the job
  - npm run build            # → dist/autotrimps.user.js (+ dist/index.html)
  - actions/upload-pages-artifact  (path: dist/)

deploy job:
  needs: build               # only runs if build (incl. gates) succeeded
  environment: github-pages
  - actions/deploy-pages
```

Gates **block** deploy: a failing `typecheck` or `test` fails the `build` job, and the
`deploy` job (`needs: build`) never runs.

Permissions: `pages: write`, `id-token: write`, `contents: read`. Concurrency group on
`pages` so overlapping pushes don't race the deploy.

### Published artifact = dual-mode by construction

The one file at `/autotrimps.user.js` works everywhere because:

| Delivery mode   | Mechanism                                                              |
|-----------------|-----------------------------------------------------------------------|
| Tampermonkey    | `@downloadURL` + `@updateURL` (= the Pages URL) → auto-update on bump  |
| Console paste   | `@grant none` → runs in page context; inject `<script src=…?cachebust>`|
| Bookmarklet     | same injection wrapped as `javascript:(function(){…})()`               |
| Steam `mods.js` | drop the same file into the Steam Trimps `mods/` folder                |

Header changes in `scripts/build-userscript.mjs`:
- Add `@downloadURL https://mattaltermatt.github.io/AutoTrimps/autotrimps.user.js`
- Add `@updateURL` (same URL).
- `@version` = `6.0.0-dev.<run>` where `<run>` is the GitHub Actions run number (env
  `GITHUB_RUN_NUMBER`), falling back to the `package.json` version locally. **Monotonic** —
  required for Tampermonkey to detect updates. (Exact format finalized in the plan.)

### Landing page (`dist/index.html`)

`npm run build` also emits a one-screen static install page served at the Pages root
(`mattaltermatt.github.io/AutoTrimps/`) containing:
- The copy-paste **console snippet** (with `?…=Date.now()` cache-bust).
- A ready-to-drag **bookmarklet**.
- The **Tampermonkey** install link (points at `autotrimps.user.js`).
- A one-line **Steam `mods.js`** note.

Scope note: if the plan prefers to stay minimal, the landing page may ship as an immediate
follow-up — it does not gate the core deploy round-trip.

## 📄 Docs to update

- **README** — rewrite the install section for the MattAltermatt fork: Tampermonkey /
  console / bookmarklet / Steam. Remove the stale `Zorn192.github.io` URLs.
- **CLAUDE.md** — "Default branch: `main`; `feature/...` → FF-merge to `main`; `gh-pages`
  retired; deploys are CI-only (never hand-edited)." Retire the byte-parity gate's
  `git show gh-pages:<file>` reference (Phase 1 complete; the gate's job is done).

## ⚠️ Manual repo-settings steps (call out; require approval)

1. **Default branch → `main`** (Settings → Branches, or `gh api`).
2. **Pages Source → "GitHub Actions"** (Settings → Pages, or `gh api`).

Both need repo-admin auth. May be executed via `gh api` with approval, or by the user in
the UI. Neither is reversible-by-accident, so they are explicit gated steps.

## ✅ Acceptance criteria

- [ ] Pages Source = "GitHub Actions"; default branch = `main`.
- [ ] `.github/workflows/deploy.yml` present; push to `main` runs `npm ci` →
      `typecheck` + `test` (blocking) → `build` → upload → deploy.
- [ ] `https://mattaltermatt.github.io/AutoTrimps/autotrimps.user.js` returns **200** with a
      JavaScript content-type and the current build's bytes.
- [ ] Header carries `@downloadURL`/`@updateURL` and a monotonic `@version`.
- [ ] Console snippet referencing the Pages URL loads the script into `trimps.github.io`
      with **"AutoTrimps Loaded!"** and a clean console.
- [ ] README + CLAUDE.md updated; Zorn192 URLs gone.
- [ ] One green CI run proves the full round-trip (push → build → deploy → in-game load).
- [ ] `gh-pages` branch retired (final gated step) once the above is verified.

## 🚫 Out of scope

- **No automation-logic or game-balance changes** — this is infra only.
- No Highcharts vendoring / Graphs modernization (separate later phase).
- No change to the bundle's runtime behavior; the emitted JS is identical to a local
  `npm run build`, only the header metadata and delivery pipeline change.
