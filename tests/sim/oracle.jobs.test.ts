import { describe, it, expect } from 'vitest'
import { optimalScientistShare } from '../../scripts/sim/oracle/jobs.mjs'

describe('sim/oracle/jobs', () => {
  const base = { workspaces: 100, targetScience: 1000, targetResource: 1000 }

  it('returns a share strictly in (0,1)', () => {
    const s = optimalScientistShare(base)
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(1)
  })

  it('more science needed → more scientists', () => {
    expect(optimalScientistShare({ ...base, targetScience: 4000 }))
      .toBeGreaterThan(optimalScientistShare(base))
  })

  it('more Speedscience (cheaper science) → fewer scientists', () => {
    expect(optimalScientistShare({ ...base, speedscienceCount: 4 }))
      .toBeLessThan(optimalScientistShare({ ...base, speedscienceCount: 0 }))
  })
})
