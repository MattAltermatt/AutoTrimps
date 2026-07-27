import { it, expect, vi } from 'vitest'
import { applyManifest, assertTraceMatches } from '../../scripts/sim/manifest.mjs'

// Pure logic — no game clone — so this runs in CI too.
const diff = [{ index: 3, oracle: { fn: 'buyJob', args: [5] }, working: { fn: 'buyJob', args: [6] } }]
const waiver = { issue: '#32', save: 's1', index: 3, fn: 'buyJob', argsBefore: [5], argsAfter: [6] }

it('empty diff + empty manifest → nothing unexplained', () => {
  expect(applyManifest([], 's1', { waivers: [] }).unexplained).toEqual([])
})

it('a matching waiver explains the divergence (strict-superset, not diff==0)', () => {
  const { unexplained, unfired } = applyManifest(diff, 's1', { waivers: [waiver] })
  expect(unexplained).toEqual([])
  expect(unfired).toEqual([])
})

it('an unwaived divergence throws (the accidental-drift alarm)', () => {
  expect(() => assertTraceMatches(diff, 's1', { waivers: [] })).toThrow(/UNEXPLAINED/)
})

it('an unfired waiver warns but does not throw (corpus-coverage signal)', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  expect(() => assertTraceMatches([], 's1', { waivers: [waiver] })).not.toThrow()
  expect(warn).toHaveBeenCalled()
  warn.mockRestore()
})

it('a waiver for a different save does not apply', () => {
  expect(applyManifest(diff, 's2', { waivers: [waiver] }).unexplained).toHaveLength(1)
})

// ── #159 — a waiver pins a SUBSTITUTION, not a slot. ──────────────────────────────────────────────
// Before this, matching ignored args entirely, so a waiver blanket-exempted its (save, index, fn)
// slot: any building, any quantity, any tick, forever. On a 12-event trace that is a permanent hole
// through the fixture. Each test below is mutation-proven — deleting the corresponding clause in
// applyManifest's `find` predicate turns it red.

it('#159 — a waiver does NOT explain a different argsAfter at the same slot', () => {
  // Same save/index/fn as the declared waiver, but AT bought something else. Under the old
  // slot-matching this returned unexplained: [] and the regression sailed through baseline-zero.
  const other = [{ index: 3, oracle: { fn: 'buyJob', args: [5] }, working: { fn: 'buyJob', args: [99] } }]
  const { unexplained } = applyManifest(other, 's1', { waivers: [waiver] })
  expect(unexplained).toHaveLength(1)
})

it('#159 — nor a different argsBefore', () => {
  const other = [{ index: 3, oracle: { fn: 'buyJob', args: [42] }, working: { fn: 'buyJob', args: [6] } }]
  expect(applyManifest(other, 's1', { waivers: [waiver] }).unexplained).toHaveLength(1)
})

it('#159 — an INSERTION is expressible: declare argsBefore null', () => {
  // oracle side absent (the working build gained an event the oracle never had).
  const insertion = [{ index: 4, oracle: null, working: { fn: 'buyBuilding', args: ['House', true, true, 1] } }]
  const w = { issue: '#x', save: 's1', index: 4, fn: 'buyBuilding', argsBefore: null, argsAfter: ['House', true, true, 1] }
  expect(applyManifest(insertion, 's1', { waivers: [w] }).unexplained).toEqual([])
  // ...and it still discriminates: a DIFFERENT inserted building is not covered.
  const otherInsertion = [{ index: 4, oracle: null, working: { fn: 'buyBuilding', args: ['Collector', true, true, 1] } }]
  expect(applyManifest(otherInsertion, 's1', { waivers: [w] }).unexplained).toHaveLength(1)
})

it('#159 — a waiver that declares no args is a loud THROW, not a permissive match', () => {
  // The waiver array was empty when #159 landed, so there is no legacy loose form to support and no
  // reason to leave one reachable. Silently accepting an under-specified waiver is precisely how the
  // hole would come back.
  // Cast is deliberate and is itself part of the result: the JSDoc type now makes argsBefore/
  // argsAfter REQUIRED, so a TS caller writing this gets a compile error — you have to opt out of the
  // type to even construct it. The runtime throw is the second layer, and it is the one that matters,
  // because the real waivers live in tests/fixtures/traces/manifest.json where no type checks them.
  const loose = { issue: '#y', save: 's1', index: 3, fn: 'buyJob' } as any
  expect(() => applyManifest(diff, 's1', { waivers: [loose] })).toThrow(/argsBefore/)
  // The check is global, not per-save — an under-specified waiver for ANOTHER save is still caught,
  // so it cannot hide until the day that fixture happens to diverge.
  expect(() => applyManifest(diff, 's2', { waivers: [loose] })).toThrow(/argsBefore/)
})

it('#159 — the live manifest is waiver-free, and adding one must be a conscious act', () => {
  const manifest = JSON.parse(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('node:fs').readFileSync(require('node:path').resolve('tests/fixtures/traces/manifest.json'), 'utf8'),
  )

  // Every waiver in the real file must be well-formed. NOTE this half is INERT while the array is
  // empty — a zero-iteration validation loop cannot fail, so on its own it would be a guard that
  // proves nothing, which is the exact species this repo keeps getting bitten by.
  expect(() => applyManifest([], 'any-save', manifest)).not.toThrow()

  // ...so pair it with a tripwire that CAN fail today. The corpus currently needs no waivers at all,
  // and that is worth defending: a waiver is a permanent, standing exemption from baseline-zero, and
  // #158 is the case study in how attractive one looks under deadline. Adding the first one should
  // cost a deliberate edit here, not slip in as a diff nobody reads.
  //
  // IF THIS IS RED because you legitimately added a waiver: bump the expected count, and while you
  // are here confirm your waiver pins argsBefore/argsAfter to the EXACT substitution (#159) and that
  // the fixture is not one of the three census fixtures, where a waiver cannot help you anyway
  // because their negative controls consult no manifest (#160).
  expect(
    manifest.waivers,
    'tests/fixtures/traces/manifest.json gained a waiver — see the note above before bumping this',
  ).toHaveLength(0)
})
