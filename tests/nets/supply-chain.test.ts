import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
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
  // Injected by src/modules/graphs/render.ts at runtime for the Graphs dashboard. Unlike the old
  // Highcharts inject this one is HARDENED: a version-PINNED jsDelivr URL (echarts@5.6.0) carrying an
  // `integrity` SRI hash + `crossOrigin` on the dynamically-created <script> — so a compromised CDN
  // response is rejected by the browser. Recorded here so the one allowed external origin is visible in
  // a test, and adding a SECOND is a hard failure, not a habit. ECharts is not bundled (a single global
  // registration, same reason Highcharts wasn't).
  'cdn.jsdelivr.net': 'render.ts injects pinned+SRI Apache ECharts (echarts@5.6.0) for the Graphs dashboard',
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
  // Path class includes `@` so version-pinned CDN URLs (jsDelivr's echarts@5.6.0/…/echarts.min.js)
  // are captured whole and classified executable — without it the path truncates at `@` and a real
  // `<script src>` slips past as non-executable.
  const all = [...src.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)([a-zA-Z0-9._/@-]*)/g)].map((m) => ({
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
    // The class must be defined by our own emitted bytes, and come from the npm package (#171).
    expect(bundle).toContain('node_modules/fastpriorityqueue/FastPriorityQueue.js')
    expect(bundle).toMatch(/function FastPriorityQueue\w*\(/)
    // ...and the remote FETCH must be gone. Note this bans the executable URL, not the hostname: the
    // upstream author's README/commits links survive in the update-notice tooltip, and a link you never
    // fetch is not a code-execution grant. Conflating the two would force a wrong fix (scrubbing credit
    // links) while leaving the actual hazard — the `<script src>` — untouched.
    expect(bundle).not.toContain('Zorn192.github.io/AutoTrimps/FastPriorityQueue.js')

    // AT's four construction sites are still there and cannot race a network load. Do NOT count
    // `new FastPriorityQueue*(` here: #171 made this an ESM import of a CJS package, so esbuild emits
    // AT's call sites as `new import_fastpriorityqueue.default(...)` and the only `new FastPriorityQueue2(`
    // occurrences left are INTERNAL to the package (clone/kSmallest). That spelling counts 3 — a number
    // that looks like a lost call site and is really a net measuring the wrong thing. Anchor on AT's own
    // assignment instead, which is stable across bundler renaming.
    expect(bundle.match(/effQueue = new /g)?.length).toBe(4)
  })

  it('the queue is the MAINTAINED upstream, not a hand-edited fork (#171)', () => {
    // #171: `legacy/FastPriorityQueue.js` was never a clean vendor drop. `git log --follow` shows the
    // fork hand-adapted upstream in 2016 to strip its CommonJS tail and, in the same edit, rewrote
    // poll()'s else-branch into `else if (this.size == 0) --this.size` — a construct that appears in
    // ZERO upstream commits. It inverted both edge cases: at size 1 the queue never drained (the
    // browser froze mid-portal), and at size 0 `size` went to -1.
    //
    // Assert on the DRAIN BRANCH rather than on the absence of the old text: a fork could reintroduce
    // the bug with different spelling, and "does not contain the 2016 string" would still pass.
    expect(bundle).toContain('this.size -= 1')
    expect(bundle).not.toContain('0==this.size&&--this.size')
    expect(bundle).not.toContain('else if (this.size == 0) --this.size')

    // And it must come from the lockfile, not from a file someone can hand-edit again.
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.devDependencies.fastpriorityqueue).toBe('0.8.0') // exact pin, no caret
    expect(existsSync(resolve(__dirname, '../../legacy'))).toBe(false)
  })

  it('the remote module loader is gone from source, not stripped by a build transform (#133)', () => {
    // Pre-#133 the loader lived in legacy/AutoTrimps2.js and the build rewrote it away (`deLoaderize`).
    // #133 ported that file to src/modules/main-loop.ts in its ALREADY-neutralized form: ATscriptLoad is
    // a no-op and initializeAutoTrimps() calls bootSettingsUI() directly, with no remote <script>. So the
    // guarantee is now structural (the injection strings are nowhere in the source), not transform-dependent.
    expect(bundle).not.toContain('Quiaaaa.github.io') // the remote Graphs.js inject is gone
    // The old ATscriptLoad body built a remote URL as `basepath + pathname + modulename + '.js'`. Its
    // absence proves the loader body — not just its call sites — is gone.
    expect(bundle).not.toContain("modulename + '.js'")
    expect(bundle).not.toContain('modulename + ".js"')
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
