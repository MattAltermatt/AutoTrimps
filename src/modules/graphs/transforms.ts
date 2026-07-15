// Pure per-datum numeric transforms, ported byte-faithfully from legacy/Graphs.js.
// No DOM, no game, no echarts. Every arithmetic expression is copied verbatim from the legacy
// source; only the shapes (explicit params/returns instead of leaked function-scope vars) changed.
import type { PortalData } from './types'

// legacy Graphs.js:42 formatDuration — returns "_d _h _m _s" or "_._s"
export function formatDuration(timeSince: number): string {
  const timeObj = {
    d: Math.floor(timeSince / 86400),
    h: Math.floor(timeSince / 3600) % 24,
    m: Math.floor(timeSince / 60) % 60,
    s: Math.floor(timeSince % 60),
  }
  const milliseconds = Math.floor((timeSince % 1) * 10)
  let timeString = ''
  let unitsUsed = 0
  for (const [unit, value] of Object.entries(timeObj)) {
    if (value === 0 && timeString === '') continue
    unitsUsed++
    if (value) timeString += value.toString() + unit + ' '
  }
  if (unitsUsed <= 1) {
    timeString = [timeObj.s.toString().padStart(1, '0'), milliseconds.toString(), 's'].join('.')
  }
  return timeString
}

// legacy Graphs.js:139 diff — cumulative-delta customFunction factory.
// `== null` guards undefined as well as null (perZoneData is 1-indexed with a hole at [0]; the
// first iterated index gives e2 = data[0] = undefined). Phase-1 fix, preserved.
export function diff(dataVar: string, initial?: number) {
  return function (portal: PortalData, i: number): number | null {
    const e1 = portal.perZoneData[dataVar][i]
    const e2 = initial ? initial : portal.perZoneData[dataVar][i - 1]
    if (e1 == null || e2 == null) return null
    return e1 - e2
  }
}

// legacy Graphs.js:1027 perZone.customFunction — per-zone delta of the value and of the clock.
// Returns [x, time]. At the start of data (missing previous point) both are 0.
export function perZone(portal: PortalData, item: string, index: number): [number, number] {
  let x: number
  let time: number
  const cur = portal.perZoneData[item][index]
  const prev = portal.perZoneData[item][index - 1]
  if (prev && cur) {
    x = cur - prev
    time = (portal.perZoneData.currentTime[index] as number) - (portal.perZoneData.currentTime[index - 1] as number)
  } else {
    x = 0
    time = 0
  }
  return [x, time]
}

// legacy Graphs.js:1043 perHr.customFunction — value per hour (time is in ms).
export function perHr(x: number, time: number): number {
  if (x) x = x / (time / 3600000)
  return x
}

// legacy Graphs.js:1053 lifetime.customFunction — value as a fraction of the run's lifetime total.
// (The legacy debug() call on an unknown item is a dev log only; dropped to keep this pure.)
export function lifetime(portal: PortalData, item: string, x: number): number {
  let initial: number | [number, number] | undefined
  if (item === 'heliumOwned') initial = portal.totalHelium
  if (item === 'radonOwned') initial = portal.totalRadon
  if (item === 'c23increase') initial = portal.cinf
  if (!initial) {
    return 0
  }
  if (item === 'c23increase') {
    const cinf = initial as [number, number]
    const totalBonus = (1 + cinf[1] / 100) * cinf[0] // calc initial cinf
    let c2 = cinf[0]
    let c3 = cinf[1]
    portal.universe === 1 ? (c2 += x) : (c3 += x)
    const newBonus = (1 + c3 / 100) * c2 // calc final cinf
    x = (newBonus - totalBonus) / (totalBonus ? totalBonus : 1)
  } else {
    const init = initial as number
    x = x / (init ? init : 1)
  }
  return x
}

// legacy Graphs.js:1079 s3normalized.customFunction
export function s3normalized(x: number, portalS3: number, maxS3: number): number {
  return (x / 1.03 ** portalS3) * 1.03 ** maxS3
}

// legacy Graphs.js:531 accumulator — x += previous point's y (or 0 at the start).
export function accumulate(x: number, prevY: number | undefined): number {
  return x + (prevY !== undefined ? prevY : 0)
}

// legacy Graphs.js:499/1076 — the deepest z-of-any-portal S3, used to normalize s3 graphs.
export function maxS3Of(portals: PortalData[]): number {
  return Math.max(...portals.map((portal) => portal.s3).filter((s3): s3 is number => !!s3))
}
