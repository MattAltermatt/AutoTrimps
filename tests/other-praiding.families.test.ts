// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #86 item 5.1 — characterization net for other-praiding.ts's four index-substitution families:
//   plusMapToRun1..5 · pcheck1..5 · pcheckmap1..5   (plusPres1..5 is an actuator, out of scope here)
//
// WHY THIS FILE EXISTS, and why it is tests and NOT the refactor the plan originally floated:
// ~860 of this module's 1704 lines are five near-identical copies of the same logic with an index
// substituted. That is the exact defect class that produced this repo's #64 and #65 — a proven bug
// factory *here*, not in the abstract. But the L0 action-trace differential is COMPLETELY BLIND to
// this file (it records no runMap/selectMap events for the praid path), so `baseline-zero` would
// report GREEN for an arbitrarily broken rewrite of it. Collapsing the families is therefore neither
// byte-identical nor net-verifiable, and stays parked. What we CAN do is pin the behaviour, so that a
// future collapse has an oracle to be checked against. That is all this file is.
//
// 🔍 WHAT PINNING IT IMMEDIATELY FOUND — pcheckmap1..5 ARE TAUTOLOGIES.
// All five are pure functions of `game.global.world % 10` (they branch on the residue and compare
// against plusMapToRunN()). Enumerated over all 10 residues × all 5 members, every one of the 50
// cells returns TRUE. The guard can never fail, so `pcheckmapN() == true` is an inert conjunct at all
// ten of its callsites (Praiding :1012-1060, dailyPraiding :1515-1563).
//
// That is NOT a bug today — the code behaves as if the conjunct were absent — but it is a LOADED GUN,
// and it is the reason the totality test below is the most valuable thing here. pcheckmapN is total
// only because its per-residue thresholds mirror plusMapToRunN's value EXACTLY. The two are a coupled
// invariant maintained by hand across ~175 lines. Perturb plusMapToRunN — precisely what a "collapse
// the copy-paste families" refactor would do — and pcheckmapN starts returning FALSE, at which point
// raid map N is silently never bought and no net in this repo would say a word. The totality test is
// that net. (Mutation-checked: changing a single plusMapToRun1 arm turns it red.)

let p: typeof import('../src/modules/other-praiding')
const g = () => globalThis as any
const N = [1, 2, 3, 4, 5] as const
const RESIDUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

const plusMapToRunN = (n: number): number => (p as any)['plusMapToRun' + n]()
const pcheckN = (n: number): boolean => (p as any)['pcheck' + n]()
const pcheckmapN = (n: number): boolean => (p as any)['pcheckmap' + n]()

beforeAll(async () => {
  g().MODULES = {}
  g().autoTrimpSettings = {}
  g().game = { global: {} }
  p = await import('../src/modules/other-praiding')
})

beforeEach(() => {
  g().autoTrimpSettings = {}
  g().game = { global: { world: 100, mapsOwnedArray: [] } }
  g().calcHDratio = () => 1
  g().getEmpowerment = () => ''
  g().debug = () => {}
})

/** world whose residue is r (the only input any of these three families reads). */
function atResidue(r: number) {
  g().game = { global: { world: 100 + r, mapsOwnedArray: [] } }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// plusMapToRun1..5 — the golden table. Every other family is defined against these numbers.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('other-praiding.plusMapToRun1..5 — golden table over world % 10', () => {
  // rows = world % 10, columns = the family index 1..5. Frozen from the live functions.
  const GOLDEN: Record<number, [number, number, number, number, number]> = {
    0: [1, 2, 3, 4, 5],
    1: [1, 2, 3, 4, 10],
    2: [1, 2, 3, 9, 10],
    3: [1, 2, 8, 9, 10],
    4: [1, 7, 8, 9, 10],
    5: [6, 7, 8, 9, 10],
    6: [5, 6, 7, 8, 9],
    7: [4, 5, 6, 7, 8],
    8: [3, 4, 5, 6, 7],
    9: [2, 3, 4, 5, 6],
  }

  for (const r of RESIDUES) {
    it(`world % 10 === ${r} → [${GOLDEN[r].join(', ')}]`, () => {
      atResidue(r)
      expect(N.map((n) => plusMapToRunN(n))).toEqual(GOLDEN[r])
    })
  }

  it('anti-vacuous: the table is not constant — every member varies with the residue', () => {
    // A `plusMapToRunN` that ignored the world (or that this harness failed to drive) would produce
    // an identical column for every residue, and every assertion above would still pass. Pin that the
    // functions genuinely read game.global.world.
    for (const n of N) {
      const column = new Set(RESIDUES.map((r) => { atResidue(r); return plusMapToRunN(n) }))
      expect(column.size).toBeGreaterThan(1)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// pcheckmap1..5 — TOTALITY. The loaded gun described in the header.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('other-praiding.pcheckmap1..5 — total (always true), and that is a coupled invariant', () => {
  it('all 50 cells (5 members × 10 residues) are TRUE — the guard can never fail', () => {
    const falsey: string[] = []
    for (const r of RESIDUES) {
      atResidue(r)
      for (const n of N) if (pcheckmapN(n) !== true) falsey.push(`pcheckmap${n} @ world%10=${r}`)
    }
    expect(falsey).toEqual([])
  })

  it('…and it is total ONLY because its thresholds track plusMapToRunN — perturb one and it fails', () => {
    // This is the assertion that gives the test above teeth, and the reason it is not merely pinning a
    // constant. pcheckmapN's residue arms compare against plusMapToRunN(); the two agree by hand-kept
    // coincidence across ~175 lines. Demonstrate the coupling directly: at residue 5, pcheckmap1's arm
    // is `world%10 == 5 && plusMapToRun1() >= 6`, and plusMapToRun1(5) is exactly 6 — the boundary. It
    // is satisfied with ZERO margin. Any refactor that shifts that number by one breaks the guard, and
    // raid map 1 is then silently never bought.
    atResidue(5)
    expect(plusMapToRunN(1)).toBe(6) // the exact threshold pcheckmap1 demands at this residue
    expect(pcheckmapN(1)).toBe(true)

    // Same zero-margin coupling at every residue where the arm uses `>=`: the value IS the threshold.
    const ZERO_MARGIN: Record<number, number> = { 5: 6, 6: 5, 7: 4, 8: 3, 9: 2 }
    for (const [r, threshold] of Object.entries(ZERO_MARGIN)) {
      atResidue(Number(r))
      expect(plusMapToRunN(1)).toBe(threshold)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// pcheck1..5 — the settings-driven raid gate (HD / Poison / Ice), with daily twins.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('other-praiding.pcheck1..5 — HD / Poison / Ice arms', () => {
  it('HD unset (getPageSetting → false, so `HD <= 0`) → go, for every member', () => {
    atResidue(0)
    for (const n of N) expect(pcheckN(n)).toBe(true)
  })

  it('HD > 0 gates on `HD >= calcHDratio(world + plusMapToRunN())`', () => {
    atResidue(0)
    g().autoTrimpSettings = { PraidingHD: { type: 'value', value: 10 } }
    g().calcHDratio = () => 5 // 10 >= 5 → go
    for (const n of N) expect(pcheckN(n)).toBe(true)
    g().calcHDratio = () => 50 // 10 >= 50 → false
    for (const n of N) expect(pcheckN(n)).toBe(false)
  })

  it('calcHDratio is called with world + THIS member’s plusMapToRun — not another member’s', () => {
    // The copy-paste net. A slip like `pcheck4` calling `plusMapToRun3` is invisible to a uniform
    // assertion, so drive the one input that differs per member and read back what each asked for.
    atResidue(0) // plusMapToRun1..5 = 1,2,3,4,5 here → all five distinct
    const asked: number[] = []
    g().autoTrimpSettings = { PraidingHD: { type: 'value', value: 10 } }
    g().calcHDratio = (z: number) => { asked.push(z); return 1 }
    for (const n of N) pcheckN(n)
    expect(asked).toEqual([101, 102, 103, 104, 105]) // world 100 + plusMapToRunN = n
  })

  it('Poison overrides HD and compares the setting against plusMapToRunN() — a discriminating fingerprint', () => {
    // At residue 0 the five plusMapToRun values are 1..5, so `P >= plusMapToRunN()` with P=3 yields
    // [true, true, true, false, false] — a signature that a mis-indexed member cannot reproduce.
    atResidue(0)
    g().autoTrimpSettings = {
      PraidingHD: { type: 'value', value: 10 },
      PraidingP: { type: 'value', value: 3 },
    }
    g().calcHDratio = () => 50 // HD arm would say FALSE for all five…
    g().getEmpowerment = () => 'Poison' // …but Poison overrides it.
    expect(N.map((n) => pcheckN(n))).toEqual([true, true, true, false, false])
  })

  it('Ice does the same as Poison, on its own setting', () => {
    atResidue(0)
    g().autoTrimpSettings = {
      PraidingHD: { type: 'value', value: 10 },
      PraidingI: { type: 'value', value: 2 },
    }
    g().calcHDratio = () => 50
    g().getEmpowerment = () => 'Ice'
    expect(N.map((n) => pcheckN(n))).toEqual([true, true, false, false, false])
  })

  it('the P/I arms are inert under the WRONG empowerment (they gate on getEmpowerment)', () => {
    atResidue(0)
    g().autoTrimpSettings = {
      PraidingHD: { type: 'value', value: 10 },
      PraidingP: { type: 'value', value: 3 },
    }
    g().calcHDratio = () => 50
    g().getEmpowerment = () => 'Wind' // not Poison → the P arm must not fire → HD's false stands
    expect(N.map((n) => pcheckN(n))).toEqual([false, false, false, false, false])
  })

  it('on a Daily every member reads the d-prefixed settings, and ignores the U1 ones', () => {
    atResidue(0)
    g().game = { global: { world: 100, challengeActive: 'Daily', mapsOwnedArray: [] } }
    // U1 ids say "go" (HD comfortably above the ratio); the daily ids say "stop". The daily wins.
    g().autoTrimpSettings = {
      PraidingHD: { type: 'value', value: 999 },
      dPraidingHD: { type: 'value', value: 10 },
    }
    g().calcHDratio = () => 50 // dPraidingHD 10 >= 50 → false
    expect(N.map((n) => pcheckN(n))).toEqual([false, false, false, false, false])

    // …and the daily Poison twin is wired to dPraidingP, with the same 1..5 fingerprint.
    g().autoTrimpSettings = {
      dPraidingHD: { type: 'value', value: 10 },
      dPraidingP: { type: 'value', value: 3 },
    }
    g().getEmpowerment = () => 'Poison'
    expect(N.map((n) => pcheckN(n))).toEqual([true, true, true, false, false])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// The two small pure helpers.
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('other-praiding — plusMapToRun / isBelowThreshold / findLastBionic', () => {
  it('plusMapToRun(a) golden over a % 10', () => {
    // 9 == a%10 ? 6 : (5 > a%10 ? 5 - a%10 : 11 - a%10)
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((a) => p.plusMapToRun(a))).toEqual([5, 4, 3, 2, 1, 6, 5, 4, 3, 6])
  })

  it('isBelowThreshold is a bare `!=` against the current world (its name is a lie)', () => {
    g().game = { global: { world: 100 } }
    expect(p.isBelowThreshold(99)).toBe(true) // "below"…
    expect(p.isBelowThreshold(101)).toBe(true) // …and also above. It is an inequality, not a threshold.
    expect(p.isBelowThreshold(100)).toBe(false)
  })

  it('findLastBionic returns the LAST Bionic in mapsOwnedArray, and undefined when there is none', () => {
    g().game = { global: { mapsOwnedArray: [
      { location: 'Bionic', id: 'first' }, { location: 'Plentiful', id: 'x' }, { location: 'Bionic', id: 'last' },
    ] } }
    expect(p.findLastBionic()).toEqual({ location: 'Bionic', id: 'last' })
    g().game = { global: { mapsOwnedArray: [{ location: 'Plentiful', id: 'x' }] } }
    expect(p.findLastBionic()).toBeUndefined()
  })
})
