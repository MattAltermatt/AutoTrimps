import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runTrace, diffTraces } from '../../scripts/sim/trace.mjs'

const SAVE = readFileSync(resolve('tests/fixtures/saves/01-early-u1.txt'), 'utf8')
// Use the committed frozen oracle bundle — always present, no build step, fully deterministic.
const ORACLE = resolve('tests/fixtures/oracle/autotrimps.oracle.user.js')

describe('trace runner + diff', () => {
  it('identical inputs → empty diff (determinism through the full pipeline)', () => {
    const a = runTrace({ atBundlePath: ORACLE, saveString: SAVE, seed: 1, ticks: 800 })
    const b = runTrace({ atBundlePath: ORACLE, saveString: SAVE, seed: 1, ticks: 800 })
    expect(a.length).toBeGreaterThan(0)
    expect(diffTraces(a, b)).toEqual([])
  }, 30_000)

  it('a synthetic divergence is caught at its index', () => {
    const a = runTrace({ atBundlePath: ORACLE, saveString: SAVE, seed: 1, ticks: 800 })
    const b = a.map((e, i) => (i === 0 ? { ...e, args: ['MUTATED'] } : e))
    const d = diffTraces(a, b)
    expect(d.length).toBeGreaterThan(0)
    expect(d[0].index).toBe(0)
  }, 30_000)
})
