// Regenerates the src-bundle golden snapshot (the type-quality-milestone net).
// Run after an INTENTIONAL helper-refactor edit, then review the git diff of the
// fixture to confirm it is only cast->helper transforms. Pure-cast edits must NOT
// change it (the parity test asserts that).
import { writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundleSrc } from './build-userscript.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = await bundleSrc()
await writeFile(resolve(ROOT, 'tests/fixtures/src-bundle.golden.js'), out)
console.log(`wrote tests/fixtures/src-bundle.golden.js (${out.length} bytes)`)
