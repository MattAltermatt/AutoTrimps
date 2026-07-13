import { describe, it, expect, beforeAll } from 'vitest'
import { buildUserscript } from '../../scripts/build-userscript.mjs'

// #75 — the supply-chain net. NO EXECUTABLE CODE FROM AN ORIGIN WE DO NOT CONTROL.
//
// The shipped userscript runs with full page privileges in every user's game. Every `<script src>` it
// injects is a standing grant of arbitrary code execution to whoever controls that origin — forever, and
// silently. Two such grants existed:
//
//   Zorn192.github.io/AutoTrimps/FastPriorityQueue.js   (perks.ts, ×2)   — LIVE in the shipped bundle
//   Quiaaaa.github.io/AutoTrimps/Graphs.js              (AutoTrimps2.js) — stripped, but see below
//
// Neither is pinned, neither carries an integrity hash, and both are personal GitHub Pages accounts. If
// either account is ever deleted, renamed, or taken over, the new owner gets code execution in every
// AutoTrimps install. `FastPriorityQueue.js` was fixed the boring way: the file was ALREADY in legacy/,
// it simply was never in the build MANIFEST. It is now bundled from our own bytes.
//
// ⚠️ THE REASON THIS NET EXISTS, rather than just the fix. The Quiaaaa load is removed only by a REGEX
// in scripts/build-userscript.mjs (`deLoaderize`, transform T3, which rewrites initializeAutoTrimps's
// whole body). Nothing asserted that the regex still matches. Reformat AutoTrimps2.js — reindent it, run
// a formatter over it, change one space — and T3 silently stops matching, the original body survives, and
// **the third-party script injection comes back with no alarm whatsoever.** A build-time transform that
// can fail open is not a security control; the check on its OUTPUT is. This net reads the EMITTED
// userscript, so it cannot be fooled by anything upstream of the emit.

const ALLOWED: Record<string, string> = {
  // Injected by legacy/Graphs.js at runtime. Vendoring it is a KNOWN, DOCUMENTED deferral, not an
  // oversight: bundling our local copy alongside caused a double-define (Highcharts error #16), so it is
  // parked for the Graphs modernization phase. Recorded here so the debt is visible in a test rather
  // than buried in a comment — and so that adding a SECOND such origin is a hard failure, not a habit.
  // (It cannot take an SRI hash today: Graphs.js builds the <script> element dynamically.)
  'code.highcharts.com': 'legacy/Graphs.js injects Highcharts at runtime — deferred to the Graphs phase (see CLAUDE.md)',
}

/** Origins we own. Not a trust decision — these are our own deploy targets. */
const OURS = ['mattaltermatt.github.io', 'localhost']

let bundle: string

beforeAll(async () => {
  // Take the bundle STRAIGHT from the builder's return value. Do NOT build-then-read-dist/: dist/ is
  // gitignored, so it is absent on CI and stale locally — and the first draft of this very file did
  // exactly that, which made all three of its mutation-checks pass GREEN against a stale artifact while
  // the "net" congratulated itself. That is the #67 hole, reproduced inside the net written to prevent
  // it. If you are ever tempted to point a test at dist/, don't.
  bundle = await buildUserscript()
}, 60_000)

/** Every origin the emitted bundle references, with the executable ones separated out. */
function origins(src: string) {
  const all = [...src.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)([a-zA-Z0-9._/-]*)/g)].map((m) => ({
    host: m[1]!.toLowerCase(),
    path: m[2] ?? '',
  }))
  // An origin is a CODE-EXECUTION risk only if we fetch and run it. A link in a tooltip is not.
  const executable = all.filter((o) => /\.js(\?|$)/.test(o.path))
  return { all, executable }
}

describe('supply chain: the shipped userscript executes no third-party code (#75)', () => {
  it('builds a real bundle (anti-false-green — an empty string would pass every check below)', () => {
    expect(bundle.length).toBeGreaterThan(500_000)
    expect(bundle).toContain('AutoTrimps')
  })

  it('FastPriorityQueue is BUNDLED, not fetched from a third party', () => {
    // The global must be defined by our own emitted bytes...
    expect(bundle).toContain('function FastPriorityQueue(')
    // ...and the remote FETCH must be gone. Note this bans the executable URL, not the hostname: the
    // upstream author's README/commits links survive in the update-notice tooltip, and a link you never
    // fetch is not a code-execution grant. Conflating the two would force a wrong fix (scrubbing credit
    // links) while leaving the actual hazard — the `<script src>` — untouched.
    expect(bundle).not.toContain('Zorn192.github.io/AutoTrimps/FastPriorityQueue.js')
    // The four `new FastPriorityQueue(...)` call sites are still there and now cannot race a network load.
    expect(bundle.match(/new FastPriorityQueue\(/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it('the de-loaderize transform still strips the remote Graphs.js injection (it can FAIL OPEN)', () => {
    // This is the assertion that catches a silently-broken build transform. If `deLoaderize`'s T3 regex
    // ever stops matching AutoTrimps2.js — a reformat is enough — the original initializeAutoTrimps body
    // survives and re-introduces this injection. Nothing else in the suite would notice.
    expect(bundle).not.toContain('Quiaaaa.github.io')
    // And prove the transform actually ran, rather than the string being absent for some unrelated reason.
    expect(bundle).toContain('function ATscriptLoad(pathname, modulename) { /* bundled: no-op */ }')
  })

  it('no executable remote origin outside the explicit allowlist', () => {
    const { executable } = origins(bundle)
    const offenders = executable
      .filter((o) => !OURS.includes(o.host) && !(o.host in ALLOWED))
      .map((o) => `https://${o.host}${o.path}`)
    // Read a failure literally: the userscript fetches and RUNS code from this origin, in every user's
    // game, with no integrity hash. Vendor it, or add an ALLOWED entry that justifies the trust.
    expect([...new Set(offenders)]).toEqual([])
  })

  it('the allowlist stays honest — an entry whose origin is gone must leave', () => {
    const { executable } = origins(bundle)
    const hosts = new Set(executable.map((o) => o.host))
    for (const host of Object.keys(ALLOWED))
      expect(hosts.has(host), `${host} is no longer loaded — delete it from ALLOWED`).toBe(true)
    // A ceiling, so "just add it to the allowlist" cannot become the standard response to this net.
    expect(Object.keys(ALLOWED).length).toBeLessThanOrEqual(1)
  })
})
