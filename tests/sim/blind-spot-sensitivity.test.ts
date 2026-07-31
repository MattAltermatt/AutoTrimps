import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { TEST_BUNDLE } from './bundle'
import { runTrace, diffTraces } from '../../scripts/sim/trace.mjs'
import { CORPUS } from '../../scripts/sim/corpus.mjs'

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// #105 — TWO MORE POSITIVE CONTROLS. Sibling of damage-sensitivity.test.ts, same doctrine: break
// AutoTrimps on purpose and demand the proof net NOTICE.
//
// The blind-spot census (tests/sim/blind-spot-census.md) injects each real shipped bug into the built
// bundle and counts divergences across the corpus. Two rows came back 0/17 — the gate could not see
// them AT ALL, and both had shipped on unit-test evidence alone:
//
//     housing-hut-divisor   #93   score every housing type by the HUT's population gain
//     rhypo-invert          #101  conserve wood AFTER overshooting the bonfire goal, not until it is met
//
// THE SHARPEST LESSON IN THE CENSUS, and the reason these fixtures are shaped the way they are:
//
//     housing-always-hut    (crude: always return "Hut")   SEEN    592 divergences on 04-u2-radon
//     housing-hut-divisor   (#93's REAL bug)               BLIND     0 divergences, same save
//
// Same function, same save. The net REACHED mostEfficientHousing and still could not see the actual
// bug in it — on 04 only Hut and House are unlocked, so changing the divisor never moves the argmin.
// The function runs; its answer is not load-bearing. Reach is not sensitivity (#98).
//
// So 09-housing-u2 unlocks the tiers whose population gains actually differ (Hut 3 ... Collector 5000),
// where the buggy divisor picks Hut and the correct one picks Mansion — the argmin FLIPS. And
// 10-hypo-u2 carries a CONFIGURED bonfire target below its current count, the one state in which
// "conserve until achieved" and "conserve after overshooting" disagree.
//
// ⚠️ If you are reading this because it FAILED: do not weaken it. A failure means the net has gone
// blind to that region again, and every green baseline-zero for it is worthless. The usual cause is a
// fixture that lost the property making the bug observable — 09 losing its unlocked housing tiers, or
// 10 losing its seeded settings (Rhypofarmstack's default is the "unset" sentinel, which makes the
// clause under test INERT, #96). Fix the corpus, not the test.
//
// ─── #160 — THE NEGATIVE CONTROLS DELIBERATELY DO NOT CONSULT THE WAIVER MANIFEST. ───────────────
// baseline-zero compares each trace to its oracle THROUGH tests/fixtures/traces/manifest.json, so a
// reviewed divergence can be waived and bug-fixing stays a first-class operation. The negative
// controls below do NOT: they demand `diffTraces(oracle, clean) === []` outright.
//
// That asymmetry is the point, not an oversight. These fixtures exist for exactly one purpose — to
// make a specific function's ANSWER load-bearing so the census can see a bug in it. A waiver is a
// standing exemption at a (save, index, fn, args) slot; grant one here and the fixture stops guarding
// the thing it was built to guard, on the very traces that are the census's only witness. 09's oracle
// is TWELVE events, of which four are buyBuilding — there is no room for an exemption that is not
// most of the artifact.
//
// The practical consequence, which cost a full design duel on #158 to rediscover: **a trace-moving
// change to 09-housing-u2, 10-hypo-u2 or 12-warp-u1 cannot be shipped behind a waiver.** The only
// route is a corrected oracle — and that is never a local re-record, because record-oracle.mjs
// replays the FROZEN bundle at the tag in build-oracle.mjs, so it means re-pinning across every src
// commit since that tag. Budget for that before you start, or park the change (as #158 did) and land
// an executing witness for the defect instead.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const SAVES = resolve('tests/fixtures/saves')
const TRACES = resolve('tests/fixtures/traces')

/** Replace exactly once, and PROVE the splice landed — a no-op patch would report "blind" and lie. */
function replaceOnce(source: string, find: string, replace: string): string {
  const at = source.indexOf(find)
  expect(at, `anchor "${find}" not found in the bundle — its shape changed`).toBeGreaterThan(-1)
  expect(source.indexOf(find, at + 1), `anchor "${find}" is not unique — the splice would be ambiguous`).toBe(-1)
  const mutant = source.slice(0, at) + replace + source.slice(at + find.length)
  expect(mutant).toContain(replace)
  expect(mutant).not.toBe(source)
  return mutant
}

/** Replace the first `find` that appears AFTER `scope`, and prove the splice landed. For anchors that
 *  should be pinned to a named function rather than matched globally — either because they are not
 *  globally unique, or as future-proofing if a sibling function might grow the same text later. */
function replaceOnceAfter(source: string, scope: string, find: string, replace: string): string {
  const from = source.indexOf(scope)
  expect(from, `scope "${scope}" not found in the bundle — its shape changed`).toBeGreaterThan(-1)
  const at = source.indexOf(find, from)
  expect(at, `anchor "${find}" not found after "${scope}"`).toBeGreaterThan(-1)
  const mutant = source.slice(0, at) + replace + source.slice(at + find.length)
  expect(mutant).not.toBe(source)
  return mutant
}

function traceWith(mutate: (s: string) => string, save: string, ticks: number, settings?: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), 'at-blindspot-'))
  const mutantPath = join(dir, 'mutant.user.js')
  writeFileSync(mutantPath, mutate(readFileSync(TEST_BUNDLE, 'utf8')), 'utf8')
  return runTrace({
    atBundlePath: mutantPath,
    saveString: readFileSync(resolve(SAVES, `${save}.txt`), 'utf8'),
    seed: 1,
    ticks,
    atSettings: settings,
  })
}

const oracleTrace = (save: string) => JSON.parse(readFileSync(resolve(TRACES, `${save}.1.trace.json`), 'utf8'))
const entry = (name: string) => {
  const e = CORPUS.find((c: { name: string }) => c.name === name)
  expect(e, `${name} is not in the corpus`).toBeTruthy()
  return e as { name: string; ticks: number; settings?: Record<string, unknown> }
}

// #160 — keeps the doctrine above HONEST rather than merely written down.
//
// ⚠️ The first version of this guard hand-wrote the fixture list and its own describe title claimed
// the list was exhaustive. It was not: damage-sensitivity.test.ts has a FOURTH manifest-free negative
// control, on 08-starved-u1, and the guard could not see it because it only ever inspected itself.
// The lesson is the one this repo keeps relearning — a check that restates a hand-maintained fact
// cannot detect that the fact went stale. So the exhaustiveness claim is now DERIVED from the source
// (see the last test), and the list below is only the documented set it is checked against.
const WAIVER_IMMUNE_FIXTURES = [
  '09-housing-u2', // this file — #93's housing-divisor witness
  '10-hypo-u2', //    this file — #101's bonfire-clause witness
  '12-warp-u1', //    this file — #128's deep-game witness
  '08-starved-u1', // damage-sensitivity.test.ts — #90/#98's combat witness (NOT single-seed: [1,2],
  //                  its negative control covers seed 1 only)
  '15-geneticist-u1', // this file — #313's ATGA-servo witness. Its negative control asserts an exact
  //                     trace with no manifest waiver, so a waiver could never rescue it either.
] as const

// Files that gate a REAL recorded trace: they diff against a committed oracle using a freshly built
// bundle. trace.test.ts is excluded on purpose — it unit-tests diffTraces itself against synthetic
// arrays and imports no TEST_BUNDLE, so it asserts nothing about any fixture.
const TRACE_GATE_FILES = [
  'tests/sim/blind-spot-sensitivity.test.ts',
  'tests/sim/damage-sensitivity.test.ts',
  'tests/sim/portal.test.ts',
] as const

describe('#160 — waiver-immune fixtures, and the claim that we know all of them', () => {
  it('every documented waiver-immune fixture is a real corpus entry', () => {
    for (const name of WAIVER_IMMUNE_FIXTURES) {
      const e = CORPUS.find((c: { name: string }) => c.name === name)
      expect(e, `${name} is documented as waiver-immune but is not in CORPUS`).toBeTruthy()
    }
  })

  it('none of them carries a waiver, because one could not help there anyway', () => {
    const manifest = JSON.parse(readFileSync(resolve(TRACES, 'manifest.json'), 'utf8'))
    const stray = (manifest.waivers ?? []).filter((w: { save: string }) =>
      (WAIVER_IMMUNE_FIXTURES as readonly string[]).includes(w.save),
    )
    // A waiver on one of these is worse than useless: baseline-zero would go green while the negative
    // control stayed red, which reads as "the manifest is broken" rather than "this change needs a
    // corrected oracle". Fail loudly with the actual instruction instead.
    expect(
      stray,
      'a waiver was added for a waiver-immune fixture — it cannot satisfy the manifest-free negative ' +
        'control, so the change needs a corrected oracle or parking (#158/#160), not a waiver',
    ).toEqual([])
  })

  it('no trace gate has a manifest-free negative control this list does not know about', () => {
    // DERIVED, not restated. Two independent scans, because each catches a different way the
    // documented set can go stale.
    //
    // (1) A new FILE that diffs a real trace. If someone adds tests/sim/foo.test.ts importing both
    //     diffTraces and TEST_BUNDLE, it is a new trace gate and its negative controls (if any) are
    //     invisible to this doctrine until it is listed.
    const gateFiles = readdirSync(resolve('tests/sim'))
      .filter((f) => f.endsWith('.test.ts'))
      .map((f) => `tests/sim/${f}`)
      .filter((p) => {
        const src = readFileSync(resolve(p), 'utf8')
        return src.includes('diffTraces') && src.includes('TEST_BUNDLE')
      })
    expect(
      gateFiles.sort(),
      'a new trace-gate file appeared. Does it assert diffTraces(...).toEqual([]) on a fixture? If so ' +
        'that fixture is waiver-immune too — add it to WAIVER_IMMUNE_FIXTURES and to the #160 notes ' +
        'in this file and scripts/sim/manifest.mjs.',
    ).toEqual([...TRACE_GATE_FILES].sort())

    // (2) A new manifest-free EXACT assertion inside a known gate file.
    //
    // Counted PER FILE, not pinned by line number. Line-keyed baselines are brittle for a reason
    // this repo has now been bitten by twice in one day: an unrelated edit above a pinned line
    // silently re-keys it, so the guard reds for a reason that is not the thing it guards. A count
    // moves only when a site is genuinely added or removed.
    //
    // The pattern requires `expect(` immediately before `diffTraces(` — WITHOUT that anchor the scan
    // matches its own failure-message strings below, which mention the shape it is looking for. That
    // self-match is not hypothetical; it is what the first version of this test did.
    const countSites = (p: string) =>
      readFileSync(resolve(p), 'utf8')
        .split('\n')
        .filter((line) => /expect\(\s*diffTraces\(/.test(line) && /toEqual\(\[\]\)/.test(line)).length

    // 3 here — the 09/10 loop, 12-warp, and #313's 15-geneticist — plus 1 in damage-sensitivity for
    // 08-starved.
    // portal.test.ts diffs a trace but asserts a NON-empty divergence, so it has no control of this
    // shape and is correctly 0.
    expect(
      Object.fromEntries(TRACE_GATE_FILES.map((p) => [p, countSites(p)])),
      'the set of manifest-free exact-trace assertions changed. Each one makes its fixture ' +
        'waiver-immune (#160) — update WAIVER_IMMUNE_FIXTURES and both #160 notes, then re-pin this.',
    ).toEqual({
      'tests/sim/blind-spot-sensitivity.test.ts': 3,
      'tests/sim/damage-sensitivity.test.ts': 1,
      'tests/sim/portal.test.ts': 0,
    })
  })
})

describe('blind-spot sensitivity — the net can SEE #93 and #101 (#105 positive controls)', () => {
  const housing = entry('09-housing-u2')
  const hypo = entry('10-hypo-u2')

  // The negative controls. Without them, a harness broken enough to diverge on EVERYTHING would make the
  // positive controls pass for entirely the wrong reason.
  it('NEGATIVE control: the clean build reproduces both new traces exactly (diff = ∅)', () => {
    for (const save of [housing, hypo]) {
      const clean = runTrace({
        atBundlePath: TEST_BUNDLE,
        saveString: readFileSync(resolve(SAVES, `${save.name}.txt`), 'utf8'),
        seed: 1,
        ticks: save.ticks,
        atSettings: save.settings,
      })
      expect(diffTraces(oracleTrace(save.name), clean), `${save.name} diverges on a CLEAN build`).toEqual([])
    }
  }, 180_000)

  it('POSITIVE control: #93 (housing scored by the HUT divisor) makes the net go RED — it was 0/17 BLIND', () => {
    const mutant = traceWith(
      // The real bug, verbatim: every housing type scored by the Hut's population gain rather than its
      // own, which degenerates the "efficiency" metric into plain buy-the-cheapest.
      (s) => replaceOnce(s, 'game.buildings[housing].increase.by', 'game.buildings.Hut.increase.by'),
      housing.name,
      housing.ticks,
      housing.settings,
    )
    const divergences = diffTraces(oracleTrace(housing.name), mutant)
    expect(
      divergences.length,
      "#93's real bug produced ZERO divergences. The net is blind to housing SELECTION again. The usual " +
        'cause: 09-housing-u2 no longer has housing tiers unlocked whose increase.by differ, so the ' +
        'divisor cannot move the argmin (reaching mostEfficientHousing is NOT enough — 04-u2-radon ' +
        'reaches it and is blind). Fix the corpus, not the test.',
    ).toBeGreaterThan(5)
  }, 180_000)

  it('POSITIVE control: #101 (Rhypo conserve clause inverted) makes the net go RED — it was 0/17 BLIND', () => {
    const mutant = traceWith(
      (s) => replaceOnce(s, 'bonfire < finalBonfireTarget', 'bonfire > finalBonfireTarget'),
      hypo.name,
      hypo.ticks,
      hypo.settings,
    )
    const divergences = diffTraces(oracleTrace(hypo.name), mutant)
    expect(
      divergences.length,
      "#101's real bug produced ZERO divergences. The net is blind to Hypothermia wood conservation " +
        'again. The usual cause: 10-hypo-u2 lost its seeded settings — Rhypofarmstack must carry a ' +
        'CONFIGURED target above totalBonfires, or hasBonfireTarget is false and the clause under test ' +
        'is inert (#96). Fix the corpus, not the test.',
    ).toBeGreaterThan(5)
  }, 180_000)
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// #128 — THE DEEP FIXTURE'S POSITIVE CONTROLS. Same doctrine, one milestone deeper. The corpus topped
// out at world 8, so the entire late game was structurally invisible: Warpstation (the dominant metal
// sink at depth) unlocks at world 60, and buyGemEfficientHousing's gem-efficiency ranking only reaches
// the deep tiers (Collector/Warpstation) that were never unlocked. Both branches had NEVER executed.
//
// 12-warp-u1 is a world-62 post-portal state. Measured on it (blind-spot-census.md): warpstation-noop
// 0 -> 1722 and gem-housing-rank 0 -> 1774, and — the part that matters — ZERO on every other save in
// the corpus. Reaching the deep tiers is not enough by itself; these two mutations are the proof the
// SELECTION and the PURCHASE are load-bearing here, the way #93/#101 are above.
//
// ⚠️ If this FAILED: the net has gone blind to the deep game again. The usual cause is 12-warp-u1 no
// longer reaching world 60+ with Warpstation unlocked (make-fixtures plays it forward untilWorld: 62;
// a perk-spread or economy regression could wall it short). Fix the corpus, not the test.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('blind-spot sensitivity — the net can SEE the deep game (#128 positive controls)', () => {
  const warp = entry('12-warp-u1')

  it('NEGATIVE control: the clean build reproduces the deep trace exactly (diff = ∅)', () => {
    const clean = runTrace({
      atBundlePath: TEST_BUNDLE,
      saveString: readFileSync(resolve(SAVES, `${warp.name}.txt`), 'utf8'),
      seed: 1,
      ticks: warp.ticks,
      atSettings: warp.settings,
    })
    expect(diffTraces(oracleTrace(warp.name), clean), `${warp.name} diverges on a CLEAN build`).toEqual([])
  }, 180_000)

  it('POSITIVE control: Warpstation buying suppressed makes the net go RED — it was BLIND corpus-wide', () => {
    const mutant = traceWith(
      // safeBuyBuilding's Warpstation branch buys nothing. AT still reaches it (picks Warpstation as best
      // gem housing) but the purchase never lands, so metal accumulates and downstream buys shift.
      (s) =>
        replaceOnce(
          s,
          'if (building === "Warpstation" && !game.buildings[building].locked && canAffordBuilding(building)) {',
          'if (building === "Warpstation" && !game.buildings[building].locked && canAffordBuilding(building)) { return;',
        ),
      warp.name,
      warp.ticks,
      warp.settings,
    )
    const divergences = diffTraces(oracleTrace(warp.name), mutant)
    expect(
      divergences.length,
      'Suppressing Warpstation purchases produced ZERO divergences. The net is blind to the deep-game ' +
        'metal sink again — the usual cause is 12-warp-u1 no longer reaching world 60+ with Warpstation ' +
        'unlocked. Fix the corpus, not the test.',
    ).toBeGreaterThan(5)
  }, 180_000)

  it('POSITIVE control: gem-efficiency ranking inverted makes the net go RED — it was BLIND corpus-wide', () => {
    const mutant = traceWith(
      // Invert buyGemEfficientHousing's sort so it picks the WORST gem-efficiency housing. Scoped to the
      // function even though the anchor is globally unique today — future-proofing against a U2 gem twin,
      // not disambiguation of existing copies.
      (s) => replaceOnceAfter(s, 'function buyGemEfficientHousing() {', 'return obj[a] - obj[b];', 'return obj[b] - obj[a];'),
      warp.name,
      warp.ticks,
      warp.settings,
    )
    const divergences = diffTraces(oracleTrace(warp.name), mutant)
    expect(
      divergences.length,
      'Inverting the gem-efficiency ranking produced ZERO divergences. The net is blind to housing ' +
        'SELECTION at depth again — the usual cause is 12-warp-u1 no longer unlocking the deep housing ' +
        'tiers (Collector/Warpstation) whose gem efficiency differs. Fix the corpus, not the test.',
    ).toBeGreaterThan(5)
  }, 180_000)
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// #313 — the ATGA (Geneticist / breed-timer) servo
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Before these two fixtures, `ATGA2()` had NEVER executed in a sim run: its outer guard
// (breedtimer.ts:106) needs Geneticists unlocked, which happens at world 70, and the deepest fixture was
// world 62. Worse, its ONLY outputs — addGeneticist / removeGeneticist — were not in MUTATORS and do not
// route through buyJob, so even a deep save would have recorded nothing. Both halves are fixed; these are
// the controls that keep them fixed.
//
// ⚠️ THE TARGET PIN IS HERE BECAUSE ITS CENSUS ROW RETURNED BLIND THREE TIMES, EACH TIME FOR A REASON
// THAT WAS ABOUT THE PROBE AND NOT THE NET. The first anchor replaced `var target;`, which the next line
// of the cascade clobbered — a patch that landed without changing behaviour. Then the value was picked
// from a base breed time measured somewhere else entirely. Both mistakes produced a confident, false "the
// net is blind here", and neither was visible from the census output alone. A prose record of that in a
// plan document cannot fail; this can.
describe('blind-spot sensitivity — the net can SEE the ATGA servo (#313 positive controls)', () => {
  const gen = entry('15-geneticist-u1')

  it('NEGATIVE control: the clean build reproduces the ATGA trace exactly (diff = ∅)', () => {
    const clean = runTrace({
      atBundlePath: TEST_BUNDLE,
      saveString: readFileSync(resolve(SAVES, `${gen.name}.txt`), 'utf8'),
      seed: 1,
      ticks: gen.ticks,
      atSettings: gen.settings,
    })
    expect(diffTraces(oracleTrace(gen.name), clean), `${gen.name} diverges on a CLEAN build`).toEqual([])
  }, 180_000)

  it('POSITIVE control: suppressing the servo entirely makes the net go RED — it was BLIND corpus-wide', () => {
    const mutant = traceWith(
      // ATGA2 does nothing at all. The crude control: it proves the fixture reaches the function AND that
      // the recorder is watching its outputs. Cannot be clobbered by anything downstream.
      (s) => replaceOnceAfter(s, 'function ATGA22(', ') {', ') { return;'),
      gen.name,
      gen.ticks,
      gen.settings,
    )
    const divergences = diffTraces(oracleTrace(gen.name), mutant)
    expect(
      divergences.length,
      'Suppressing ATGA2 produced ZERO divergences. Either 15-geneticist-u1 no longer reaches world 70 ' +
        'with Geneticists unlocked, or addGeneticist/removeGeneticist fell out of MUTATORS. Fix the ' +
        'corpus or the recorder, not the test.',
    ).toBeGreaterThan(5)
  }, 180_000)

  it('POSITIVE control: pinning the TARGET makes the net go RED — the number the cascade exists to choose', () => {
    const mutant = traceWith(
      // Injected AFTER the eleven-way cascade, immediately before `var thresh`, so nothing can overwrite
      // it — the first version anchored on `var target;` and was clobbered by the very next line.
      // 0.03 s is BELOW the reachable ceiling on this fixture (measured: 0.0138 s at zero Geneticists,
      // 0.0574 s at the 72 ATGA food-caps at), so the servo converges somewhere new (72 -> 37) instead of
      // saturating against the +/-10-per-tick clamp the way a 30 s or 1 s pin does.
      (s) =>
        replaceOnce(
          s,
          'var thresh = new DecimalBreed(totalTime.mul(0.02));',
          'target = new Decimal(0.03);\n      var thresh = new DecimalBreed(totalTime.mul(0.02));',
        ),
      gen.name,
      gen.ticks,
      gen.settings,
    )
    const divergences = diffTraces(oracleTrace(gen.name), mutant)
    expect(
      divergences.length,
      'Pinning the ATGA target produced ZERO divergences, which is what a CLOBBERED or SATURATED probe ' +
        'looks like — not evidence about the net. Check (a) that the injection still lands after the ' +
        'target cascade rather than before it, and (b) that 0.03 s is still below the breed time the ' +
        'fixture can actually reach. Verify the mutant CHANGES BEHAVIOUR before touching this test.',
    ).toBeGreaterThan(5)
  }, 180_000)
})
