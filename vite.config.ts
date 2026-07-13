/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    // Default to node (esbuild-based build tests need it). DOM-coupled unit tests opt into
    // jsdom per-file via a `// @vitest-environment jsdom` docblock; setup.ts seeds their DOM.
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    // Builds the working bundle once, from live src/, and exports its path as AT_TEST_BUNDLE. The sim
    // suites boot THAT — never the gitignored dist/, which was absent on CI and stale locally (#67).
    globalSetup: ['tests/globalSetup.ts'],
    include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
    // The sim/differential tests boot the game in jsdom and self-play 1000+ ticks. Locally that is
    // ~5–15s each; a CI runner is materially slower (offline-flag's equipment test measured 34s on
    // ubuntu vs comfortably under 30s here). Now that these actually RUN in CI (#67 — they used to
    // skip), the budget has to cover the slowest runner, not the fastest laptop. A timeout here is a
    // flake, and a flaky gate gets disabled, which is how we got #67 in the first place.
    testTimeout: 120_000,
  },
})
