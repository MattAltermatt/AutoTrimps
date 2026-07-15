import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  diff,
  perZone,
  perHr,
  lifetime,
  s3normalized,
  accumulate,
  maxS3Of,
} from '../../src/modules/graphs/transforms'
import type { PortalData } from '../../src/modules/graphs/types'

describe('formatDuration', () => {
  it('d/h/m/s form when >1 unit', () => {
    expect(formatDuration(90061)).toBe('1d 1h 1m 1s ')
  })
  it('sub-second form when <=1 unit (legacy joins [s, ms, "s"] with ".")', () => {
    // Faithful to legacy: [s,ms,"s"].join(".") plus 3.4%1*10 floors to 3 (float) => "3.3.s".
    expect(formatDuration(3.4)).toBe('3.3.s')
  })
  it('whole seconds only', () => {
    expect(formatDuration(45)).toBe('45.0.s')
  })
})

describe('diff (1-indexed, hole at [0])', () => {
  const portal = { perZoneData: { helium: [undefined, 10, 30] } } as unknown as PortalData
  it('returns null at the first index (guards undefined, not just null)', () => {
    expect(diff('helium')(portal, 1)).toBeNull()
  })
  it('returns the delta afterwards', () => {
    expect(diff('helium')(portal, 2)).toBe(20)
  })
  it('uses `initial` when provided', () => {
    expect(diff('helium', 5)(portal, 1)).toBe(5) // 10 - 5
  })
})

describe('perZone', () => {
  const portal = {
    perZoneData: { helium: [undefined, 10, 30], currentTime: [undefined, 1000, 3000] },
  } as unknown as PortalData
  it('delta of value and clock', () => {
    expect(perZone(portal, 'helium', 2)).toEqual([20, 2000])
  })
  it('start of data (missing previous) => [0, 0]', () => {
    expect(perZone(portal, 'helium', 1)).toEqual([0, 0])
  })
})

describe('perHr', () => {
  it('scales value by elapsed hours (time in ms)', () => {
    expect(perHr(100, 3600000)).toBe(100) // 1 hour elapsed
    expect(perHr(100, 1800000)).toBe(200) // half hour elapsed => double per hour
  })
  it('passes through falsy x unchanged', () => {
    expect(perHr(0, 3600000)).toBe(0)
  })
})

describe('lifetime', () => {
  it('helium fraction of lifetime total', () => {
    const p = { totalHelium: 200, universe: 1 } as unknown as PortalData
    expect(lifetime(p, 'heliumOwned', 50)).toBe(0.25)
  })
  it('unknown item => 0', () => {
    const p = { totalHelium: 200, universe: 1 } as unknown as PortalData
    expect(lifetime(p, 'nope', 5)).toBe(0)
  })
  it('c23increase compound-bonus branch (u1)', () => {
    const p = { cinf: [10, 20], universe: 1 } as unknown as PortalData
    // totalBonus=(1+.2)*10=12; c2=15 => newBonus=1.2*15=18; (18-12)/12=0.5
    expect(lifetime(p, 'c23increase', 5)).toBe(0.5)
  })
})

describe('s3normalized', () => {
  it('renormalizes to the deepest S3', () => {
    expect(s3normalized(100, 10, 20)).toBeCloseTo(100 * 1.03 ** 10, 6)
  })
})

describe('accumulate', () => {
  it('adds the previous y', () => expect(accumulate(5, 10)).toBe(15))
  it('adds 0 at the start', () => expect(accumulate(5, undefined)).toBe(5))
})

describe('maxS3Of', () => {
  it('max s3 ignoring undefined', () => {
    const portals = [{ s3: 10 }, { s3: 30 }, {}] as unknown as PortalData[]
    expect(maxS3Of(portals)).toBe(30)
  })
})
