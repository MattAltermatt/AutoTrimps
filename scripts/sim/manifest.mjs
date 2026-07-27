// Known-diff manifest: reconciles intended bug-fix divergences with the trace differential so
// bug-fixing is a first-class, auditable operation rather than a gate-breaker. Each waiver
// declares an EXPECTED divergence (issue, save, index, fn, argsBefore, argsAfter); the gate passes
// iff every actual divergence is waived (actualDiff \ manifest == ∅). A naked golden change with no
// waiver IS the accidental-drift alarm. An unfired waiver (declared but never seen) warns — the
// corpus doesn't reach the fix.
//
// #159 — A WAIVER PINS A SUBSTITUTION, NOT A SLOT. This used to match on (save, index, fn) alone,
// ignoring the argsBefore/argsAfter that manifest.test.ts was already writing. That made every
// waiver a blanket exemption: "AT buys a House at index 10 instead of at tick 1460" also silently
// accepted a different building, a different quantity, at any tick, forever. On a short trace that
// is enormous — 09-housing-u2's oracle is 12 events, of which 4 are buyBuilding, so a three-waiver
// set would have exempted the entire tail of the fixture the blind-spot census names as the single
// point of failure for mostEfficientHousing. Same species as the ratchet ceilings in #157: a gate
// quietly losing the ability to fail.
//
// Args are REQUIRED, not optional-when-convenient. The waiver array was empty when this landed, so
// there was no back-compat cost and therefore no reason to leave the loose form reachable by habit —
// a missing declaration is a loud throw, not a permissive match.
//
// #160 — WAIVERS DO NOT WORK ON THE THREE CENSUS FIXTURES, BY DESIGN. This module is consulted by
// tests/sim/baseline-zero.test.ts and by nothing else. In particular the NEGATIVE controls in
// tests/sim/blind-spot-sensitivity.test.ts demand `diffTraces(oracle, clean) === []` outright, with
// no manifest, for 09-housing-u2, 10-hypo-u2 and 12-warp-u1. Those fixtures exist to make one
// function's answer load-bearing for the blind-spot census; an exemption there would disarm the only
// witness the census has. So a trace-moving change to any of the three is re-pin-or-park, never
// waive — see the header of that file for the full reasoning, and #158 for the worked example.
// Do not "fix" a red negative control by reaching for a waiver; it will not help, and the reason it
// will not help is the design working.
const key = (w) => `${w.save}#${w.index}#${w.fn}#${JSON.stringify(w.argsBefore ?? null)}#${JSON.stringify(w.argsAfter ?? null)}`

// An absent side is a real value: `null` means "no event here", which is how an INSERTION (oracle
// null) and a DELETION (working null) are declared. Normalising both to null keeps those
// expressible rather than forcing a waiver to lie about them.
const sameArgs = (declared, actual) => JSON.stringify(declared ?? null) === JSON.stringify(actual ?? null)

/**
 * @param {{index:number,oracle:any,working:any}[]} diff
 * @param {string} save
 * @param {{ waivers?: {issue:string,save:string,index:number,fn:string,argsBefore:any,argsAfter:any}[] }} manifest
 * @returns {{ unexplained: any[], unfired: any[] }}
 */
export function applyManifest(diff, save, manifest) {
  const all = manifest.waivers || []
  for (const w of all) {
    if (!('argsBefore' in w) || !('argsAfter' in w)) {
      throw new Error(
        `[manifest] waiver ${w.issue ?? '(no issue)'} for ${w.save}#${w.index}#${w.fn} declares no ` +
          'argsBefore/argsAfter. A waiver must pin the exact substitution it is explaining — without ' +
          'args it exempts the whole slot and any future divergence there passes silently (#159). ' +
          'Use null for an absent side (insertion/deletion).',
      )
    }
  }
  const waivers = all.filter((w) => w.save === save)
  const seen = new Set()
  const unexplained = diff.filter((d) => {
    const match = waivers.find(
      (w) =>
        w.index === d.index &&
        w.fn === (d.working?.fn ?? d.oracle?.fn) &&
        sameArgs(w.argsBefore, d.oracle?.args) &&
        sameArgs(w.argsAfter, d.working?.args),
    )
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
