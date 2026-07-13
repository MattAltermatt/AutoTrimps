// NET 1 — the zero-skip census (#67). Closes the whole bug class, permanently.
//
// The class: `describe.skip` is mechanically indistinguishable from a pass in the ONLY signal CI
// consults — the exit code. #67 was one instance (a missing clone -> 11 suites skipped -> exit 0 ->
// a real regression shipped green). Rather than fix that one instance, assert the invariant:
//
//     IN CI, ZERO TESTS MAY SKIP.
//
// Any future describe.skip / it.skip / .todo / env-conditional guard — added by anyone, for any
// reason, in any suite — goes red on arrival. It does not care WHY something skipped.
//
// Deliberately a SEPARATE PROCESS, not a test. A test that asserts its own run's skip count is
// self-referential (it cannot observe suites that vitest scheduled after it, and it is itself
// skippable). Consuming vitest's JSON report post-hoc has neither problem.
//
// Wiring (package.json):  "test:ci": "vitest run --reporter=default --reporter=json
//                                      --outputFile=.vitest-report.json && node scripts/ci/assert-no-skips.mjs"
import { readFileSync } from 'node:fs'

const REPORT = process.argv[2] ?? '.vitest-report.json'

let report
try {
  report = JSON.parse(readFileSync(REPORT, 'utf8'))
} catch (err) {
  console.error(`[no-skip-census] cannot read ${REPORT}: ${err.message}`)
  console.error('[no-skip-census] the census could not run — treating as FAILURE (a census that did not run is exactly the bug this net exists to catch).')
  process.exit(1)
}

const all = (report.testResults ?? []).flatMap((f) =>
  (f.assertionResults ?? []).map((t) => ({ ...t, file: f.name })),
)
const skipped = all.filter((t) => t.status === 'skipped' || t.status === 'pending' || t.status === 'todo')

// Anti-false-green floor: an empty report would trivially satisfy "zero skips". Mirrors the
// degenerate-oracle guard in baseline-zero.test.ts.
if (all.length === 0) {
  console.error('[no-skip-census] report contains ZERO tests — vacuous pass rejected.')
  process.exit(1)
}

if (skipped.length > 0) {
  console.error(`\n[no-skip-census] ${skipped.length} test(s) SKIPPED in CI. A skip is not a pass.\n`)
  const byFile = new Map()
  for (const t of skipped) byFile.set(t.file, (byFile.get(t.file) ?? 0) + 1)
  for (const [file, n] of [...byFile].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${String(n).padStart(3)}  ${file}`)
  }
  console.error(
    '\nIf a suite needs a dependency the runner lacks, FETCH THE DEPENDENCY. Do not skip the suite\n' +
      'to keep the build green — a gate optimized for greenness is not a gate.\n',
  )
  process.exit(1)
}

console.log(`[no-skip-census] OK — ${all.length} tests ran, 0 skipped.`)
