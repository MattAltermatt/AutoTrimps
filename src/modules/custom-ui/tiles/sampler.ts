export const RESOURCES = ['food', 'wood', 'metal', 'science'] as const
const CAP = 60
const buffers: Record<string, number[]> = {}

export function resetSampler(): void {
  for (const r of RESOURCES) buffers[r] = []
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
}

export function history(r: string): number[] {
  return buffers[r] ?? []
}
