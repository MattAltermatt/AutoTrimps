import { describe, it, expect } from 'vitest'
import { formatMinutesForDescriptions } from '../src/modules/time'

describe('formatMinutesForDescriptions', () => {
  it('formats sub-hour durations as "M minutes S seconds"', () => {
    // 5.5 minutes → 5 minutes 30 seconds (hours == 0 branch)
    expect(formatMinutesForDescriptions(5.5)).toBe('5 minutes 30 seconds')
  })

  it('formats multi-hour durations as H:MM:SS with zero-padding', () => {
    // 125.5 minutes → 2 hours, 05 minutes, 30 seconds (minutes>0 branch)
    expect(formatMinutesForDescriptions(125.5)).toBe('2:05:30')
  })
})
