export const RESOURCES = ['food', 'wood', 'metal', 'science', 'fragments', 'gems', 'helium'] as const
// The population sparkline samples the same way but lives outside the flat-resource region.
export const POP = 'trimps'
const CAP = 60
const buffers: Record<string, number[]> = {}

export function resetSampler(): void {
  for (const r of RESOURCES) buffers[r] = []
  buffers[POP] = []
}
resetSampler()

// Push each resource's raw owned value into its 60-slot ring buffer. Reads game state only;
// runs only while the resource region is active (started/stopped by applyCustomUI).
export function sampleTick(): void {
  const res = (globalThis as any).game?.resources
  if (!res) return
  for (const r of RESOURCES) {
    const owned = Number(res[r]?.owned ?? 0)
    const b = buffers[r]
    b.push(owned)
    if (b.length > CAP) b.shift()
  }
  const pop = Number(res[POP]?.owned ?? 0)
  const pb = (buffers[POP] ??= [])
  pb.push(pop)
  if (pb.length > CAP) pb.shift()
}

export function history(r: string): number[] {
  return buffers[r] ?? []
}
