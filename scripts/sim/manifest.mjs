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
// #160 — WAIVERS DO NOT WORK ON THE SENSITIVITY FIXTURES, BY DESIGN. This module gates only
// tests/sim/baseline-zero.test.ts. Several NEGATIVE controls elsewhere demand
// `diffTraces(oracle, clean) === []` outright, with no manifest at all:
//
//     09-housing-u2   blind-spot-sensitivity.test.ts   #93's housing-divisor witness
//     10-hypo-u2      blind-spot-sensitivity.test.ts   #101's bonfire-clause witness
//     12-warp-u1      blind-spot-sensitivity.test.ts   #128's deep-game witness
//     08-starved-u1   damage-sensitivity.test.ts       #90/#98's combat witness
//
// Each exists to make one function's answer load-bearing for a census; an exemption there would
// disarm the only witness that census has. So a trace-moving change to any of them is
// re-pin-or-park, never waive — see the #160 header in blind-spot-sensitivity.test.ts for the full
// reasoning, and #158 for the worked example.
//
// Do NOT "fix" a red negative control by reaching for a waiver. It cannot work: baseline-zero would
// go green while the control stayed red, which reads as a broken manifest rather than as a change
// that needs a corrected oracle. That the waiver does not help IS the design working.
//
// ⚠️ That list is DERIVED and pinned by a test, not maintained by hope — the first version of this
// note named only three, and missed 08-starved-u1 entirely, because the guard checking it only ever
// inspected its own file. If you add a manifest-free negative control anywhere, that test reddens
// and points here.
const key = (w) => `${w.save}#${w.index}#${w.fn}#${JSON.stringify(w.argsBefore ?? null)}#${JSON.stringify(w.argsAfter ?? null)}`

// An absent side is a real value: `null` means "no event here", which is how an INSERTION (oracle
// null) and a DELETION (working null) are declared. Normalising both to null keeps those
// expressible rather than forcing a waiver to lie about them.
const sameArgs = (declared, actual) => JSON.stringify(declared ?? null) === JSON.stringify(actual ?? null)

/**
 * @param {{index:number,oracle:any,working:any}[]} diff
 * @param {string} save
 * `argsBefore`/`argsAfter` are OPTIONAL in the type precisely because the check below is what makes
 * them mandatory in practice (#159). Declaring them required narrowed `w` to `never` inside that
 * guard, which is the type system asserting the very hole the guard exists to close.
 * @param {{ waivers?: {issue?:string,save?:string,index?:number,fn?:string,argsBefore?:any,argsAfter?:any}[] }} manifest
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
