// Build the working bundle ONCE per test run, from live src/, and hand its path to the sim suites.
//
// #67: the sim suites used to boot `dist/autotrimps.user.js` via an implicit default in boot.mjs.
// dist/ is gitignored, so on CI it did not exist (ENOENT) and locally it was whatever you last
// built. Either way the proof net's input was ambient rather than derived from the tree under test.
// Building here means a suite CANNOT test a stale artifact — there is no artifact to be stale.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildUserscript } from '../scripts/build-userscript.mjs'

export async function setup(): Promise<void> {
  const path = join(mkdtempSync(join(tmpdir(), 'at-test-bundle-')), 'working.user.js')
  writeFileSync(path, await buildUserscript(), 'utf8')
  process.env.AT_TEST_BUNDLE = path
}
