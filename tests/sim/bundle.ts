// The bundle under test: a fresh build of live src/, produced once per run by tests/globalSetup.ts.
// Sim suites MUST take their bundle from here rather than reaching for dist/ (see boot.mjs and #67).
export const TEST_BUNDLE: string = (() => {
  const path = process.env.AT_TEST_BUNDLE
  if (!path) {
    throw new Error(
      'AT_TEST_BUNDLE is unset — tests/globalSetup.ts did not run. The sim suites must boot a freshly ' +
        'built bundle, never a stale dist/ artifact (#67). Check `globalSetup` in vite.config.ts.',
    )
  }
  return path
})()
