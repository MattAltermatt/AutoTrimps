// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// #96 — Rhypofarmstack's default was the STRING 'undefined'.
//
// getPageSetting on a multiValue does `Array.from(value).map(parseInt)`. Array.from('undefined') is the
// NINE CHARACTERS ['u','n','d','e','f','i','n','e','d'], so the setting resolved to [NaN × 9].
//
// ⚠️ THE TRAP THIS FILE EXISTS TO PIN. That NaN poison was not inert — it WAS the de-facto "no bonfire
// target" semantic, and it was load-bearing. mapfunctions.ts:1288 compared a NUMBER to an ARRAY:
//
//     bonfire > getPageSetting('Rhypofarmstack').slice(-1)      // .slice(-1) is an ARRAY
//
// `>` runs the array through ToPrimitive → String → Number:
//     [NaN×9].slice(-1) → [NaN] → "NaN" → NaN   ⇒  0 > NaN  is FALSE   (Rhyposhouldwood stays true)
//     [-1]   .slice(-1) → [-1]  → "-1"  → -1    ⇒  0 > -1   is TRUE    (Rhyposhouldwood → FALSE)
//     []     .slice(-1) → []    → ""    → 0     ⇒  1 > 0    is TRUE    (Rhyposhouldwood → FALSE)
//
// (For a stack that IS configured the coercion was harmless — `.slice(-1)` already reduced it to one
// element, and `a > [b]` on a one-element numeric array is exactly `a > b`. The defect is entirely in
// what the UNSET encodings coerce to. Verified by mutation-check, not assumed.)
//
// So "just fix the default to [-1], like its 40+ siblings" — the obvious move, and the one the issue
// implies — SILENTLY REGRESSES EVERY PLAYER WHO NEVER CONFIGURED HF. maps.ts:1279 calls Rhypo(false,
// false, true) unconditionally on every tick of Hypothermia (there is no Rhypoon gate on the reset
// path), and Rhyposhouldwood === false blocks Smithy (buildings.ts:640), deprioritizes wood-costing
// housing (buildings.ts:501) and skips Shield levelling (equipment.ts:985) — for the whole challenge.
//
// The fix is therefore ordered: make "no target" EXPLICIT in the consumer FIRST (compare against a
// NUMBER, and require a real target), and only then re-default the setting. These tests assert the
// consumer is INSENSITIVE to which of the three plausible "unset" encodings is stored — which is what
// makes the re-default provably behavior-preserving rather than an argument that it is.

let mapfunctions: typeof import('../src/modules/mapfunctions')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).getPlayerCritChance = () => 0 // read at module load (mapfunctions.ts:26)
  mapfunctions = await import('../src/modules/mapfunctions')
})

/** Everything Rhypo() writes as a bare free identifier. Unset ⇒ ReferenceError under strict ESM. */
function resetAmbient() {
  ;(globalThis as any).Rhyposhouldwood = true // resetModuleVars' per-portal value (mapfunctions.ts:259)
  ;(globalThis as any).Rshouldhypofarm = false
  ;(globalThis as any).hypofragmappy = undefined
  ;(globalThis as any).hypoprefragmappy = undefined
  ;(globalThis as any).hypofragmappybought = false
}

/** A Hypothermia game state. `wood` is what the player OWNS; the target price is what Rhypo computes. */
function seedGame({ world = 10, bonfires = 0, wood = 0 } = {}) {
  ;(globalThis as any).game = {
    global: { world, challengeActive: 'Hypothermia' },
    challenges: { Hypothermia: { totalBonfires: bonfires } },
    resources: { wood: { owned: wood, max: 1e6 } },
    portal: { Packrat: { radLevel: 0, modifier: 0 } },
  }
  ;(globalThis as any).calcHeirloomBonus = (_a: unknown, _b: unknown, v: number) => v
}

const setStack = (value: unknown) => {
  ;(globalThis as any).autoTrimpSettings['Rhypofarmstack'] = { type: 'multiValue', value }
}
const setZone = (value: unknown) => {
  ;(globalThis as any).autoTrimpSettings['Rhypofarmzone'] = { type: 'multiValue', value }
}

beforeEach(() => {
  ;(globalThis as any).autoTrimpSettings = {}
  resetAmbient()
  seedGame()
  setZone([-1]) // Rhypofarmzone's real default — an unconfigured HF farm-zone list
})

// ─── The regression pin. This is the arithmetic that makes the naive fix wrong. ──────────────────
describe('#96 · WHY the default could not simply be changed to [-1]', () => {
  it('the old number-vs-array comparison flipped answer with the default (NaN false ⇄ -1 true)', () => {
    // The exact expression that used to live at mapfunctions.ts:1288, for each candidate default.
    const oldExpr = (v: unknown, bonfire: number) =>
      bonfire > (Array.from(v as ArrayLike<string>).map((x) => parseInt(x)).slice(-1) as any)

    // With NO bonfires yet, only [-1] regresses. That alone condemns the naive fix — but the empty
    // array is not safe either; it just needs one bonfire to go wrong, because "" coerces to 0.
    expect(oldExpr('undefined', 0)).toBe(false) // today: [NaN×9] → [NaN] → NaN ⇒ no target ✅
    expect(oldExpr([-1], 0)).toBe(true) // naive fix: [-1] → "-1" → -1 ⇒ TARGET PASSED ❌
    expect(oldExpr([], 0)).toBe(false) //  empty:    []   → ""   → 0  ⇒ 0 > 0 is false

    // …and once a single bonfire exists, BOTH "unset" encodings mean "you passed your target".
    expect(oldExpr('undefined', 1)).toBe(false) // NaN is never < anything ✅
    expect(oldExpr([-1], 1)).toBe(true) // ❌
    expect(oldExpr([], 1)).toBe(true) // 1 > 0 ❌
  })
})

// ─── The before/after equivalence proof. ────────────────────────────────────────────────────────
describe('#96 · an unconfigured HF player is unaffected by the re-default', () => {
  // 'undefined' is the OLD default (the [NaN×9] poison); [-1] is the NEW one; [] is what MAZ writes
  // just before it pushes rows. All three mean "no bonfire target". The consumer must not care.
  const UNSET: Array<[string, unknown]> = [
    ["'undefined' (the OLD default — [NaN × 9])", 'undefined'],
    ['[-1] (the NEW default — the codebase sentinel)', [-1]],
    ['[] (what MAZ.ts:547 writes before pushing rows)', []],
  ]

  for (const [label, value] of UNSET) {
    it(`Rhypo(reset) leaves Rhyposhouldwood TRUE for ${label}`, () => {
      setStack(value)
      mapfunctions.Rhypo(false, false, true)
      expect((globalThis as any).Rhyposhouldwood).toBe(true)
    })

    it(`…and still TRUE for ${label} once bonfires have accrued (bonfire=3)`, () => {
      // The clause under repair is `bonfire > <final target>`. With no target configured, no bonfire
      // count may ever satisfy it — this is the assertion the -1 sentinel would have broken.
      seedGame({ bonfires: 3 })
      setStack(value)
      mapfunctions.Rhypo(false, false, true)
      expect((globalThis as any).Rhyposhouldwood).toBe(true)
    })
  }

  it('the "should" pass is likewise inert — an unconfigured zone list is never entered', () => {
    setStack('undefined')
    mapfunctions.Rhypo(true, false, false)
    expect((globalThis as any).Rhyposhouldwood).toBe(true)
    expect((globalThis as any).Rshouldhypofarm).toBe(false)
  })
})

// ─── The configured cases the fix is FOR. ───────────────────────────────────────────────────────
describe('#96 · a configured HF player gets the target compared as a NUMBER', () => {
  it('single-zone stack [5]: unchanged (the old array coercion happened to work here)', () => {
    setZone([17])
    setStack([5])
    // Below target: the clause is false, and (outside a farm zone) so is gofarmbonfire.
    seedGame({ world: 10, bonfires: 5, wood: 0 })
    setZone([17])
    setStack([5])
    mapfunctions.Rhypo(false, false, true)
    expect((globalThis as any).Rhyposhouldwood).toBe(true)

    // Past target: 6 > 5 ⇒ stop spending wood. Old code: 6 > [5] → 6 > 5 ⇒ same.
    resetAmbient()
    seedGame({ world: 10, bonfires: 6, wood: 0 })
    setZone([17])
    setStack([5])
    mapfunctions.Rhypo(false, false, true)
    expect((globalThis as any).Rhyposhouldwood).toBe(false)
  })

  it('multi-zone stack [5,10]: the FINAL target (10) is the one that counts — unchanged', () => {
    // ⚠️ Corrected mid-implementation, by the mutation-check. I had assumed the old array comparison
    // was DEAD for a multi-zone stack ("5,10" → NaN). It was not: `.slice(-1)` already reduced the
    // stack to its LAST element, and `a > [b]` on a ONE-element numeric array coerces exactly
    // (["10"] → "10" → 10). So the old expression was semantically correct for every stack whose last
    // element is a real number — its only true defect was that it leaned on NaN/"" coercion for the
    // UNSET encodings. Pinning that here so nobody "re-fixes" a bug that was never there.
    seedGame({ world: 10, bonfires: 11, wood: 0 })
    setZone([17, 25])
    setStack([5, 10])
    mapfunctions.Rhypo(false, false, true)
    expect((globalThis as any).Rhyposhouldwood).toBe(false) // 11 > 10

    // …and still correctly INACTIVE at exactly the final target (10 > 10 is false).
    resetAmbient()
    seedGame({ world: 10, bonfires: 10, wood: 0 })
    setZone([17, 25])
    setStack([5, 10])
    mapfunctions.Rhypo(false, false, true)
    expect((globalThis as any).Rhyposhouldwood).toBe(true)
  })

  it('LIVE BUG FIXED: an EMPTY stack no longer reads as "target 0, already passed"', () => {
    // MAZ.ts:547 clears the stack to [] and then pushes one entry per configured row. Open the HF
    // window with no rows (or delete them all) and hit Save, and the stack PERSISTS as []. Old code:
    //   bonfire > [].slice(-1)  →  bonfire > []  →  "" → 0  →  1 > 0 → TRUE
    // …so the very first bonfire silently killed Smithy/wood-housing/Shield for the rest of the run,
    // on a configuration that says "I have no bonfire target at all". The explicit target guard ends it.
    seedGame({ world: 10, bonfires: 1, wood: 0 })
    setZone([])
    setStack([])
    mapfunctions.Rhypo(false, false, true)
    expect((globalThis as any).Rhyposhouldwood).toBe(true)
  })

  it('inside a configured farm zone with the target unmet, wood is reserved (unchanged path)', () => {
    // world ∈ zone list ⇒ hypoamountzones is a real number ⇒ targetprice is finite ⇒ gofarmbonfire.
    seedGame({ world: 17, bonfires: 0, wood: 0 })
    setZone([17])
    setStack([5])
    mapfunctions.Rhypo(true, false, false)
    expect((globalThis as any).Rshouldhypofarm).toBe(true)
    expect((globalThis as any).Rhyposhouldwood).toBe(false)
  })
})
