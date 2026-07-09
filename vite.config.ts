/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    // Default to node (esbuild-based build tests need it). DOM-coupled unit tests opt into
    // jsdom per-file via a `// @vitest-environment jsdom` docblock; setup.ts seeds their DOM.
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
  },
})
