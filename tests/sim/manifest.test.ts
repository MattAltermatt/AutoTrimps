import { it, expect, vi } from 'vitest'
import { applyManifest, assertTraceMatches } from '../../scripts/sim/manifest.mjs'

// Pure logic — no game clone — so this runs in CI too (plain `it`, not describeSim).
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
