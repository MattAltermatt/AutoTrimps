// Known-diff manifest: reconciles intended bug-fix divergences with the trace differential so
// bug-fixing is a first-class, auditable operation rather than a gate-breaker. Each waiver
// declares an EXPECTED divergence (issue, save, index, fn); the gate passes iff every actual
// divergence is waived (actualDiff \ manifest == ∅). A naked golden change with no waiver IS the
// accidental-drift alarm. An unfired waiver (declared but never seen) warns — the corpus doesn't
// reach the fix.
const key = (w) => `${w.save}#${w.index}#${w.fn}`

/**
 * @param {{index:number,oracle:any,working:any}[]} diff
 * @param {string} save
 * @param {{ waivers?: {issue:string,save:string,index:number,fn:string}[] }} manifest
 * @returns {{ unexplained: any[], unfired: any[] }}
 */
export function applyManifest(diff, save, manifest) {
  const waivers = (manifest.waivers || []).filter((w) => w.save === save)
  const seen = new Set()
  const unexplained = diff.filter((d) => {
    const match = waivers.find((w) => w.index === d.index && w.fn === (d.working?.fn ?? d.oracle?.fn))
    if (match) {
      seen.add(key(match))
      return false
    }
    return true
  })
  const unfired = waivers.filter((w) => !seen.has(key(w)))
  return { unexplained, unfired }
}

/**
 * Gate helper: throws on any unwaived divergence; warns (does not throw) on unfired waivers.
 * @param {{index:number,oracle:any,working:any}[]} diff
 * @param {string} save
 * @param {{ waivers?: any[] }} manifest
 */
export function assertTraceMatches(diff, save, manifest) {
  const { unexplained, unfired } = applyManifest(diff, save, manifest)
  if (unfired.length) console.warn(`[manifest] ${unfired.length} unfired waiver(s) for ${save} — corpus may not reach the fix`)
  if (unexplained.length) {
    throw new Error(`[manifest] ${unexplained.length} UNEXPLAINED divergence(s) for ${save}: ${JSON.stringify(unexplained.slice(0, 3))}`)
  }
}
