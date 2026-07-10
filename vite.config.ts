/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    // Default to node (esbuild-based build tests need it). DOM-coupled unit tests opt into
    // jsdom per-file via a `// @vitest-environment jsdom` docblock; setup.ts seeds their DOM.
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
    // The sim/differential tests boot the game in jsdom and self-play 1000+ ticks (~5–8s each);
    // under parallel workers they can exceed vitest's 5s default. Give all tests generous headroom.
    testTimeout: 30_000,
  },
})
