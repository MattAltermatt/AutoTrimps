# ATGA Proof-Net Rig Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status: SHIPPED 2026-07-30** (`c078a229`, v6.0.0.158) — purely additive, so no oracle re-pin. The
> rig paid for itself immediately: it measured that #313's designed actuator could not reach its target
> at world 71, which is what surfaced the `geneSend` lever that shipped instead (`8f0a36f0`).

**Goal:** Make the ATGA (Geneticist / breed-timer) subsystem visible to the L0 proof net, so that any
claim about a breed-timer policy can be measured instead of argued.

**Architecture:** Two new corpus fixtures played forward from the existing `06-deep-u1` post-portal
state — one at world 71 where Geneticists are unlocked, one field-poked to own an Amalgamator (the fork
`main.js:11683` branches on). Both enter `CORPUS` with the settings that arm `ATGA2()`, get oracle
traces recorded, and are accepted **only** when new blind-spot-census rows flip BLIND → SEEN.

**Tech Stack:** Node ESM harness (`scripts/sim/*.mjs`), jsdom, vitest, lz-string save encoding.

## 📐 Scope split — why this plan is only the rig

The [design spec](../specs/2026-07-30-atga-auto-breed-timer-design.md) covers two independent
subsystems, and the writing-plans scope check says to split them:

- **This plan — the rig.** Standalone, buildable today, and valuable on its own: it unblocks every
  future breed / Anticipation / Geneticist change, not just #313.
- **A later plan — the controller** (spec Parts 1–4). Deferred deliberately. Its acceptance criteria
  *are* the spec's falsifiers ("converges to 5 turns under Electricity", "loses ~30–40% without the
  floor"), and **none of them can be evaluated until this plan lands**. Writing bite-sized TDD steps for
  it now would be specifying tests whose verdicts nothing can produce — the unfalsifiable-claim shape
  this repo keeps catching.

## Global Constraints

- **No game balance number may change.** Perk levels and AT settings inside `scripts/sim/make-fixtures.mjs`
  are *fixture constants* (player state), never `src/` defaults — the 06/08/12 precedent.
- **No test may be skipped in CI.** `scripts/ci/assert-no-skips.mjs` fails on any `.skip`/`.todo`/env-guard.
- **No test may read `dist/`.** Boot the freshly-built `TEST_BUNDLE` (`tests/sim/bundle.ts`).
- **Never re-record the oracle to make a red go away.** This plan **adds** fixtures; it must not move any
  existing trace. If an existing fixture's trace moves, stop — that is a regression, not a chore.
- **Reach is a hypothesis until proved by mutation.** Per `tests/sim/corpus-coverage.test.ts`'s own
  header: "an uncovered mutator is a HYPOTHESIS, never a fact." Acceptance here is a census flip, never
  "the code executes."
- Check **exit codes**, not output. `npm run lint && npm run typecheck && npm run test:ci` must each
  exit 0.

## 🗂️ File structure

| File | Responsibility | Change |
| --- | --- | --- |
| `scripts/sim/make-fixtures.mjs` | generates every committed save | **Modify** — add two `writeSave` blocks |
| `tests/fixtures/saves/15-geneticist-u1.txt` | z71 save, Geneticists unlocked | **Create** (generated) |
| `tests/fixtures/saves/16-amalg-u1.txt` | z71 save + Amalgamator | **Create** (generated) |
| `scripts/sim/corpus.mjs` | the single source of truth for seeds/ticks/settings | **Modify** — two `CORPUS` entries |
| `tests/fixtures/traces/*` | recorded oracle traces | **Create** (generated) |
| `tests/sim/atga-reach.test.ts` | derives — never restates — the ATGA reachability claim | **Create** |
| `scripts/sim/blind-spot-census.mjs` | injected-bug census | **Modify** — two ATGA rows |

---

### Task 1: The z71 Geneticist fixture

**Files:**
- Modify: `scripts/sim/make-fixtures.mjs` (append after the `12-warp-u1` block, ~line 430)
- Create: `tests/fixtures/saves/15-geneticist-u1.txt` (generated, committed)

**Interfaces:**
- Consumes: `playForward(saveString, opts)`, `readSave(name)`, `writeSave(name, fn)` — all already in
  the file.
- Produces: the committed save `15-geneticist-u1`, read by Tasks 3–5 via `readSave('15-geneticist-u1')`.

**Why world 71, not 70.** The Geneticist unlock is a *trigger* at `world: 70, level: 49`
(`config.js:11178-11189`), fired by `checkTriggers`. Stopping at `world >= 70` can land before cell 49,
leaving it locked. 71 guarantees the trigger fired. The repo's own note on `12-warp-u1` says a full run
reaches z73, so z71 is known-reachable from `06-deep-u1`.

- [ ] **Step 1: Write the failing reach assertion**

Create `tests/sim/atga-reach.test.ts`:

⚠️ **Do not `import 'lz-string'`** — it is not a dependency (the clone ships it as a browser script and
`boot.mjs` loads it into jsdom). Use `bootGame`, which is also the *better* assertion: the guard reads the
**restored** game object, and `load()` is what produces it. Asserting on a raw JSON decode would test a
shape the game never sees.

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'

const load = (name: string) => readFileSync(resolve('tests/fixtures/saves', name + '.txt'), 'utf8')

describe('the ATGA subsystem is reachable in L0 (#313)', () => {
  it('15-geneticist-u1 has Geneticists unlocked — ATGA2 bails on locked at breedtimer.ts:106', () => {
    const { game } = bootGame({ saveString: load('15-geneticist-u1') })
    expect(game.jobs.Geneticist.locked).toBe(0)
    expect(game.global.world).toBeGreaterThanOrEqual(71)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/sim/atga-reach.test.ts`
Expected: FAIL — `ENOENT ... 15-geneticist-u1.txt`.

- [ ] **Step 3: Add the fixture generator**

Append to `scripts/sim/make-fixtures.mjs`, after the `12-warp-u1` block:

```js
// 15 · geneticist-U1 — the first save in the corpus where ATGA can run AT ALL. #313 measured the hole:
// all 15 prior saves have `Geneticist.locked = 1` (deepest is 12-warp at world 62) against a world-70
// unlock (config.js:11178), so `ATGA2()`'s outer guard (breedtimer.ts:106) is false 15/15 and the entire
// Geneticist/breed-timer subsystem is structurally invisible to baseline-zero.
//
// untilWorld is 71, NOT 70: the unlock is a trigger at `world: 70, level: 49`, so stopping at the first
// tick of world 70 can land before cell 49 and leave it locked. 71 guarantees checkTriggers fired.
// Played from 12-warp's own base (06-deep + the post-portal perk spread), which the repo already
// measures as carrying to z73 — so z71 is reachable, not aspirational.
writeSave('15-geneticist-u1', () => playForward(readSave('06-deep-u1'), {
  ticks: 400000, seed: 1, untilWorld: 71,
  mutate: (_w, g) => {
    // The SAME realistic post-portal spread 12-warp-u1 uses, verbatim — player state, no balance
    // constant. Duplicated rather than shared because each fixture must be readable on its own; if a
    // third consumer appears, hoist it then.
    const perks = {
      Looting: 60, Toughness: 60, Power: 60, Motivation: 60, Pheromones: 30, Artisanistry: 40,
      Carpentry: 40, Resilience: 40, Coordinated: 20, Anticipation: 10, Siphonology: 3, Range: 10,
      Agility: 20, Bait: 10, Trumps: 20, Packrat: 20, Resourceful: 30, Overkill: 15,
    }
    for (const [perk, level] of Object.entries(perks)) if (g.portal[perk]) g.portal[perk].level = level
    g.global.totalPortals = 5
  },
}))
```

- [ ] **Step 4: Generate the save and run the test**

Run: `node scripts/sim/make-fixtures.mjs --only 15-geneticist-u1`
Then: `npx vitest run tests/sim/atga-reach.test.ts`
Expected: PASS. If `playForward` throws `hit 400000-tick cap at world <n>`, AT stalled — record the
world it reached and treat that as the finding; do **not** raise the cap past 400000 without saying why.

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/make-fixtures.mjs tests/fixtures/saves/15-geneticist-u1.txt tests/sim/atga-reach.test.ts
git commit -m "sim: z71 fixture where Geneticists are unlocked (#313)"
```

---

### Task 2: The Amalgamator variant

**Files:**
- Modify: `scripts/sim/make-fixtures.mjs`
- Modify: `tests/sim/atga-reach.test.ts`
- Create: `tests/fixtures/saves/16-amalg-u1.txt` (generated, committed)

**Interfaces:**
- Consumes: `readSave('15-geneticist-u1')` from Task 1.
- Produces: `16-amalg-u1`, read by Tasks 3–5.

**Why a separate fixture.** `main.js:11683` branches the Anticipation stack source on
`game.jobs.Amalgamator.owned > 0`: without one, stacks are the breed timer; with one, the whole cycle.
Those are different code paths and a corpus with only the first is blind to the second. Every existing
save has `Amalgamator.owned = 0`.

- [ ] **Step 1: Add the failing assertion**

Add to `tests/sim/atga-reach.test.ts`, inside the existing `describe`:

```ts
  it('16-amalg-u1 owns an Amalgamator — the other arm of main.js:11683', () => {
    const { game } = bootGame({ saveString: load('16-amalg-u1') })
    expect(game.jobs.Geneticist.locked).toBe(0)
    expect(game.jobs.Amalgamator.owned).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/sim/atga-reach.test.ts`
Expected: FAIL — `ENOENT ... 16-amalg-u1.txt`.

- [ ] **Step 3: Add the generator**

Append to `scripts/sim/make-fixtures.mjs`:

```js
// 16 · amalg-U1 — the OTHER arm of the Anticipation stack source. main.js:11683 reads
// `Amalgamator.owned > 0 ? floor((gameTime - lastSoldierSentAt)/1000) : floor(lastBreedTime/1000)`;
// every save in the corpus takes the second branch, so the first has never executed.
//
// The Amalgamator count is FIELD-POKED, following the 03/04 doctrine exactly: the differential feeds the
// SAME save to both builds, so a poked state need only ARM the branch and not throw. Earning one honestly
// requires realMax()/getCurrentSend() to cross getFireThresh() (main.js:11158-11206), which is a
// population-ratio race that would make the fixture's depth depend on RNG rather than on the branch it
// exists to arm. Amalgamator count is player state; no balance constant is touched.
writeSave('16-amalg-u1', () => playForward(readSave('15-geneticist-u1'), {
  ticks: 2000, seed: 1,
  mutate: (_w, g) => { g.jobs.Amalgamator.owned = 1 },
}))
```

- [ ] **Step 4: Generate and verify**

Run: `node scripts/sim/make-fixtures.mjs --only 16-amalg-u1`
Then: `npx vitest run tests/sim/atga-reach.test.ts`
Expected: PASS, both tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/make-fixtures.mjs tests/fixtures/saves/16-amalg-u1.txt tests/sim/atga-reach.test.ts
git commit -m "sim: Amalgamator variant fixture for the antiStacks fork (#313)"
```

---

### Task 3: Wrap the Geneticist mutators — nothing is listening today

**Files:**
- Modify: `scripts/sim/recorder.mjs` (the `MUTATORS` array)
- Modify: `scripts/sim/coverage.mjs` (`ALL_MUTATORS` — a test pins that the two cannot drift)

**Interfaces:**
- Consumes: nothing from earlier tasks (but must land **after** Tasks 1–2, see below).
- Produces: two new recorded event kinds, `addGeneticist` and `removeGeneticist`, consumed by
  `coverageFromTraces()`, `baseline-zero.test.ts` and the census.

🚨 **This task was missing from the first draft of this plan, and without it Task 6's census rows come
back BLIND no matter how deep the fixtures are.** `ATGA2()`'s only outputs are `addGeneticist(n)`
(`breedtimer.ts:202`) and `removeGeneticist(n)` (`breedtimer.ts:210`), and **neither is in `MUTATORS`**.
Both mutate `game.jobs.Geneticist.owned` directly (`main.js:5282`, `main.js:5287`) — they do **not** route
through `buyJob`. So every hire and fire ATGA makes is currently invisible to the recorder.

This is the #90 failure verbatim, and `corpus-coverage.test.ts`'s own header names it: *"The recorder was
watching the WRONG FUNCTIONS… Of course they recorded zero events — nothing was listening."* A coverage
gap is a hypothesis until you check that the code path is even being watched.

**Ordering is load-bearing.** `corpus-coverage.test.ts` asserts every recorded mutator fires *somewhere*
in the corpus — "to add a mutator you must also add a save that reaches it." So Tasks 1–2 must land
first, or this task reddens that test by construction.

- [ ] **Step 1: Add both names**

In `scripts/sim/recorder.mjs`, extend `MUTATORS`:

```js
  'setGather',
  // #313 — ATGA2()'s ONLY outputs. Both mutate game.jobs.Geneticist.owned directly (main.js:5282/5287)
  // rather than routing through buyJob, so without these two the entire Geneticist servo is invisible to
  // the recorder and every census row aimed at it returns BLIND — the #90 shape exactly. AT calls them as
  // free identifiers (breedtimer.ts:202/210), which resolve through globalThis, so wrapping window does
  // intercept them (unlike a converted module's internal calls — #127).
  'addGeneticist', 'removeGeneticist',
```

Mirror the same two names into `ALL_MUTATORS` in `scripts/sim/coverage.mjs`.

- [ ] **Step 2: Verify the two lists still agree**

Run: `npx vitest run tests/sim/corpus-coverage.test.ts`
Expected: the drift test (`coverage.mjs mirrors the recorder`) PASSES; the zero-blind-mutators test may
still fail until Task 4 records traces that reach them. That ordering is expected — do not "fix" it by
removing the mutators.

- [ ] **Step 3: Prove no EXISTING trace moves**

Existing fixtures have `Geneticist.locked = 1`, so `ATGA2()` never runs and neither function is ever
called — adding them should therefore be purely additive.

Run: `node scripts/sim/record-oracle.mjs` then `git status --porcelain tests/fixtures/traces/`
Expected: **no `M` on any pre-existing trace.** If one moved, an existing fixture *does* call these
functions and the "purely additive" premise is wrong — investigate before continuing.

- [ ] **Step 4: Commit**

```bash
git add scripts/sim/recorder.mjs scripts/sim/coverage.mjs
git commit -m "sim: record addGeneticist/removeGeneticist — ATGA had no wrapped terminus (#313)"
```

---

### Task 4: Enter both into CORPUS with the settings that arm ATGA

**Files:**
- Modify: `scripts/sim/corpus.mjs:47-89` (the `CORPUS` array)
- Modify: `tests/fixtures/traces/manifest.json` (rationale)
- Create: `tests/fixtures/traces/15-geneticist-u1.*`, `16-amalg-u1.*` (generated)

**Interfaces:**
- Consumes: the two saves from Tasks 1–2.
- Produces: `CORPUS` entries named `'15-geneticist-u1'` and `'16-amalg-u1'`, consumed by
  `record-oracle.mjs`, `baseline-zero.test.ts`, and `blind-spot-census.mjs`.

⚠️ **The settings are load-bearing, exactly as they are for `10-hypo-u2`.** `ATGA2` defaults to `false`
and `ATGA2timer` to `-1`, and `main-loop.ts:262` calls `ATGA2()` only when `getPageSetting('ATGA2') == true`
— so without seeded settings both fixtures reach the code and prove nothing. `ATGA2timer: 30` is a
*fixture* constant chosen to arm today's eleven-setting cascade; it is not a `src/` default and not a
balance number.

- [ ] **Step 1: Add the CORPUS entries**

In `scripts/sim/corpus.mjs`, before the closing `]` of `CORPUS`:

```js
  // #313 — the first two saves where ATGA2() can execute. The SETTINGS ARE LOAD-BEARING: ATGA2 defaults
  // to false and ATGA2timer to -1, and main-loop.ts:262 gates the call on the former, so an unseeded
  // fixture reaches the subsystem and proves nothing (the 10-hypo-u2 lesson). ATGA2timer: 30 arms today's
  // cascade and is a fixture constant, not a src default.
  //
  // Single seed each: the subject is a hire/fire servo over a deterministic breed-time computation, not
  // an RNG-timed combat decision — matching 04/05/09/10/12.
  { name: '15-geneticist-u1', seeds: [1], ticks: 2000, settings: { ATGA2: true, ATGA2timer: 30 } },
  { name: '16-amalg-u1', seeds: [1], ticks: 2000, settings: { ATGA2: true, ATGA2timer: 30 } },
```

- [ ] **Step 2: Record the new traces**

Run: `node scripts/sim/record-oracle.mjs --only 15-geneticist-u1,16-amalg-u1`
Expected: two new trace files written, and **no existing trace modified**.

- [ ] **Step 3: Prove no existing trace moved**

Run: `git status --porcelain tests/fixtures/traces/`
Expected: only **added** (`??`/`A`) paths for the two new fixtures plus the manifest. **Any `M` on an
existing trace means an existing fixture moved — STOP and investigate; that is a regression, not a
chore.**

- [ ] **Step 4: Ledger the rationale**

Append to the `notes` array in `tests/fixtures/traces/manifest.json` (an array of
`{issue, location, status, coverage}` objects — match the existing entries' shape). Use Edit/Write, **not**
`jq … > tmp && mv`, which defeats the allowlist:

```json
{
  "issue": "#313",
  "location": "breedtimer.ts:106 (ATGA2 outer guard)",
  "status": "ADDITIVE 2026-07-30 — two fixtures added, NO existing trace re-pinned",
  "coverage": "ATGA2() had never executed in a sim run: all 15 prior saves carry Geneticist.locked = 1 (deepest 12-warp-u1 at world 62) against a world-70 unlock (config.js:11178), so the outer guard was false 15/15 and the whole Geneticist/breed-timer subsystem was invisible to baseline-zero. 15-geneticist-u1 (world 71) arms it; 16-amalg-u1 additionally owns an Amalgamator, the fork main.js:11683 branches the Anticipation stack source on. Both seed ATGA2/ATGA2timer because main-loop.ts:262 gates the call on the former. Acceptance was the atga-noop and atga-target-pin census rows flipping BLIND -> SEEN, not mere execution."
}
```

⚠️ `oracle.repinRationale` is for **re-pins** and must NOT be touched — nothing here re-records an
existing trace, and writing there would misreport an addition as a re-pin.

- [ ] **Step 5: Run the full gate**

Run: `npm run test:ci`
Expected: exit 0, zero skips, every pre-existing fixture still reproducing its oracle trace.

- [ ] **Step 6: Commit**

```bash
git add scripts/sim/corpus.mjs tests/fixtures/traces/
git commit -m "sim: add the two ATGA fixtures to CORPUS and record their traces (#313)"
```

---

### Task 5: Derive the reachability claim instead of restating it

**Files:**
- Modify: `tests/sim/atga-reach.test.ts`

**Interfaces:**
- Consumes: `CORPUS` from `scripts/sim/corpus.mjs`; the committed saves.
- Produces: nothing consumed downstream — this is a net.

**Why.** Tasks 1–2 assert two saves by name. That is a hand-written list, and this repo's rule is that a
finding's own scoping claim is a claim (#208/#238): derive the census from the source, then read what it
returns. This test states the *invariant* — at least one CORPUS member can execute `ATGA2()` — so
deleting or shallowing the fixtures reddens it, and it cannot rot into a list.

- [ ] **Step 1: Write the failing derived assertion**

Add `import { CORPUS } from '../../scripts/sim/corpus.mjs'` to the **top** of
`tests/sim/atga-reach.test.ts` alongside the existing imports, then add the following **inside** the
existing `describe('the ATGA subsystem is reachable in L0 (#313)', …)` block:

```ts
// ATGA2()'s outer guard, transcribed from breedtimer.ts:106. All four conjuncts, so a fixture that
// satisfies only some of them cannot pass as coverage.
// Boot each save once — bootGame is not cheap, so cache rather than decoding per predicate.
const booted = new Map<string, any>()
const gameOf = (name: string) => {
  if (!booted.has(name)) booted.set(name, bootGame({ saveString: load(name) }).game)
  return booted.get(name)
}

function canRunATGA(saveName: string, settings: Record<string, any> = {}): boolean {
  const g = gameOf(saveName)
  return g.jobs.Geneticist.locked === 0 &&
    settings.ATGA2 === true &&
    Number(settings.ATGA2timer) > 0 &&
    g.global.challengeActive !== 'Trapper'
}

it('at least one CORPUS member can actually execute ATGA2 — derived, not listed', () => {
  const armed = CORPUS.filter((c: any) => canRunATGA(c.name, c.settings ?? {})).map((c: any) => c.name)
  expect(armed.length).toBeGreaterThan(0)
  // Both arms of the antiStacks fork (main.js:11683) must be present, or the corpus is half-blind.
  const withAmalg = armed.filter((n: string) => gameOf(n).jobs.Amalgamator.owned > 0)
  const withoutAmalg = armed.filter((n: string) => gameOf(n).jobs.Amalgamator.owned === 0)
  expect(withAmalg.length).toBeGreaterThan(0)
  expect(withoutAmalg.length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/sim/atga-reach.test.ts`
Expected: PASS (Tasks 1–4 satisfied it).

- [ ] **Step 3: Mutation-check the net itself**

Temporarily change the `15-geneticist-u1` CORPUS entry's `settings` to `{}` and re-run.
Expected: **FAIL** on `withoutAmalg.length` — the net notices an unarmed fixture rather than counting it
as coverage. Restore the entry afterwards and re-run to confirm green.

- [ ] **Step 4: Commit**

```bash
git add tests/sim/atga-reach.test.ts
git commit -m "sim: derive the ATGA reachability invariant from CORPUS (#313)"
```

---

### Task 6: Census rows — acceptance is a BLIND → SEEN flip

**Files:**
- Modify: `scripts/sim/blind-spot-census.mjs` (the mutation table, after `gem-housing-rank` ~line 195)

**Interfaces:**
- Consumes: `spliceIntoFn(source, fnName, code, label)` — the existing helper used by
  `jobs-ratio-flip`.
- Produces: two census rows, `atga-noop` and `atga-target-pin`.

**This task is the whole point of the plan.** Tasks 1–5 establish that the code *runs*; only a census
flip establishes that a bug in it is *visible*. Reaching ATGA is not the goal — making an ATGA bug
detectable is (the `12-warp-u1` / #105 precedent).

- [ ] **Step 1: Add the two mutations**

```js
  {
    name: 'atga-noop',
    area: 'breedtimer (ATGA2 Geneticist servo)',
    why: '#313: ATGA2() had NEVER executed in a sim run — Geneticist.locked was 1 on all 15 prior saves ' +
      'against a world-70 unlock, so the outer guard (breedtimer.ts:106) was false 15/15. Makes the ' +
      'servo do nothing at all. 15-geneticist-u1 is the fixture that arms it.',
    apply: (s) => spliceIntoFn(s, 'ATGA2', ' return;', 'atga'),
  },
  {
    name: 'atga-target-pin',
    area: 'breedtimer (ATGA2 target selection)',
    why: '#313: the CRUDE no-op above only proves the servo runs. This pins the TARGET to a constant, ' +
      'which is the quantity the eleven-setting cascade exists to choose and the quantity any auto mode ' +
      'would replace. A #93-shaped break, not a switch-off: if this stays BLIND, the corpus cannot ' +
      'measure a breed-timer policy and no claim about one is believable.',
    apply: (s) => replaceOnce(s, 'var target;', 'var target = new Decimal(1);', 'atga-pin'),
  },
```

**Anchors verified against the committed golden bundle 2026-07-30, and one of them bites:**
- esbuild emits **`function ATGA22()`**, not `ATGA2` (the #133 rename gotcha). `spliceIntoFn` is safe —
  `fnBodyStart` matches `function\s+<name>\d*\s*\(` precisely for this — but any hand-rolled
  `indexOf('function ATGA2(')` would throw. Do not write one.
- `var target;` occurs **exactly once in the entire bundle**, so `replaceOnce` is correct and its built-in
  ambiguity check will fail loudly if a second ever appears. `Decimal` is a free global inside the
  function, so `new Decimal(1)` resolves.

If either anchor stops matching, **fix it against the emitted bundle — do not weaken it to an unscoped
match.** The `gem-housing-rank` entry above is the precedent for scoping a splice to its function.

- [ ] **Step 2: Run the census**

Run: `node scripts/sim/blind-spot-census.mjs`
Expected: both new rows report **SEEN** on `15-geneticist-u1` / `16-amalg-u1`.

- [ ] **Step 3: If either row is BLIND, that is the finding — not a failure to route around**

A BLIND row means the fixture reaches ATGA but no ATGA decision reaches a recorded mutator, so the
differential cannot see it. Do **not** delete the row or relax the mutation. Options, in order:
lengthen the recording window in `corpus.mjs`; re-check that the seeded settings actually applied;
consider whether `ATGA2()`'s effects terminate in any wrapped mutator at all (`buyJob` is the likely
terminus, via `addGeneticist`/`removeGeneticist` — verify, do not assume). Record the outcome in the
census notes either way.

- [ ] **Step 4: Confirm `baseline-zero` is still zero**

Run: `npx vitest run tests/sim/baseline-zero.test.ts`
Expected: PASS. A census number means nothing unless `baseline-zero` is zero — against a stale oracle the
census **inverts** (#105).

- [ ] **Step 5: Full gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:ci
git add scripts/sim/blind-spot-census.mjs
git commit -m "sim: census rows proving an ATGA bug is now visible (#313)"
```

---

## ✅ Definition of done

1. `npm run lint`, `npm run typecheck`, `npm run test:ci` each exit **0**, zero skips.
2. No pre-existing trace file modified — only additions.
3. `atga-noop` and `atga-target-pin` both report **SEEN**.
4. `baseline-zero` still 0.
5. A fresh reviewer agent has reviewed the branch (standing-authorized; not optional).

Only then is the controller plan (spec Parts 1–4) worth writing — its acceptance criteria become
evaluable at exactly that moment.

## ✅ What the rig proves, and the one thing it does not

**Both census rows are SEEN**, on the two new fixtures and on nothing else:

```text
row                divergences   15-geneticist-u1   16-amalg-u1   the other 21
----------------   -----------   ----------------   -----------   ------------
atga-noop              6084            2862            3222             0
atga-target-pin        4020            2952            1068             0
```

So the corpus can see both that the servo runs **and** that its target is load-bearing — a target change
of 30 s → 0.03 s moves the equilibrium from 72 Geneticists to 37, and the differential registers it.

⚠️ **`atga-target-pin` returned BLIND three times before this, and every one was the probe's fault, not
the net's.** The mutation replaced `var target;` — and the very next line, `if (ATGA2timer > 0) target =
new Decimal(...)`, unconditionally clobbered the injected initializer. The patch landed, the bundle
changed, the behaviour did not: exactly the false-BLIND this file's own header warns about, with one
extra step. Two elaborate quantitative explanations were written for those zeros before anyone checked
whether the mutant behaved differently at all. **Verify a mutant CHANGES BEHAVIOUR before interpreting
its census row** — one boot and one state read, against the twenty minutes a census costs.

### The limitation that survived the recheck

`antiStacks` is **0** on both fixtures, and that was measured from game state directly rather than
through the broken probe. Base breed time here is **0.0138 s**; ATGA food-caps at **72** Geneticists
(gen #73 costs 8.40e15 against 3.06e15 held), giving 0.0574 s. Reaching the Anticipation cap needs
**N = 389** for 30 s — where one Geneticist costs ~1e20 food.

So this rig is **sufficient** for what it claims: the servo is visible, both arms fire, and a target
change is detectable. It is **not** sufficient to falsify the spec's Part 1 ("target the Anticipation
cap"), because at this depth the cap is unreachable by two orders of magnitude and no stack is ever worth
anything. That needs a deeper fixture, or the controller plan must carry the depth gate as designed
behaviour. Recorded in the spec's Known model limits.

## 🔮 Deferred to the controller plan

Recorded here so it is not lost: the spec's unverified Spire attack-ramp figures (`1.17^cell` /
`1.30×` per zone) must be confirmed or dropped during that plan; the design does not rest on them, but
Part 3's second argument does.
