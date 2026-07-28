import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { TEST_BUNDLE } from '../sim/bundle'
import { MUTATIONS } from '../../scripts/sim/blind-spot-census.mjs'

// NET — every blind-spot-census probe must still INJECT into a freshly-built bundle.
//
// #197: five of the census's twelve probes had been silently unhooked for ~two weeks. esbuild
// renames the definition, not the free reference, so the bundle emits `buyBuildings2` while the
// probe anchored on `function buyBuildings() {`. The probes that broke included the CANARY, whose
// own description reads "if this does not go red the census harness itself is broken" — and the
// report still printed "None — every injected bug produced a divergence", because a probe that
// ERRORED was filtered out of the blind list rather than counted as the loudest possible blindness.
//
// Nothing ran the census: `grep -rn blind-spot-census .github/workflows/ package.json tests/`
// returned nothing. The rot was therefore invisible until someone ran it by hand.
//
// The full census is ~20 minutes of jsdom sims, far too slow for CI. But the failure mode that
// actually bit is ANCHOR RESOLUTION, and that is nearly free to check: apply each mutation to the
// built bundle and assert it lands. This does not prove a probe is SENSITIVE (only the census can
// do that, and it is the difference between reach and sensitivity) — it proves no probe has been
// quietly disconnected, which is the part that rotted.
describe('blind-spot census anchors resolve against the built bundle (#197)', () => {
  const clean = readFileSync(TEST_BUNDLE, 'utf8')

  it('anti-false-green: the bundle and the mutation table are both really loaded', () => {
    expect(clean.length).toBeGreaterThan(100_000)
    expect(MUTATIONS.length).toBeGreaterThan(10)
    // The canary must exist by name — it is the probe that certifies the harness.
    expect(MUTATIONS.map((m: { name: string }) => m.name)).toContain('canary-buildings-noop')
  })

  it.each(MUTATIONS.map((m: { name: string }) => m.name))('%s injects into the bundle', (name) => {
    const m = MUTATIONS.find((x: { name: string }) => x.name === name)!
    let mutated: string
    try {
      mutated = m.apply(clean)
    } catch (err) {
      throw new Error(
        `census probe '${name}' can no longer inject — it is DISCONNECTED and the census will ` +
          `silently under-report:\n  ${(err as Error).message}`,
      )
    }
    // A no-op patch is the dangerous outcome: identical bundle -> zero divergences -> a confident,
    // totally false "the net is blind here".
    //
    // Content inequality is the ONLY valid check here. An earlier version also asserted the length
    // changed, which failed `rhypo-invert` and `gem-housing-rank` — both are same-length `replaceOnce`
    // substitutions (a comparison flipped, an operand swapped), so they legitimately preserve length
    // while changing behaviour. That assertion was testing the mutation's SHAPE, not whether it landed.
    expect(mutated).not.toBe(clean)
  })
})
