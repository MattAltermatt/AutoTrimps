// NET 2 — the workflow-gate census (#67).
//
// The class: a gate that is not wired into CI, or is wired but cannot fail, is indistinguishable
// from a gate that ran and passed. #67 was two instances at once — the proof net skipped itself out
// of existence, and `lint` was absent from CI *and* incapable of failing. Reading the workflow did
// not catch either for months. A mechanical cross-check of "gates declared" vs "gates invoked" does,
// in ten lines, forever. (CLAUDE.md: NETS > READERS.)
//
// Pure file reads — no clone, no jsdom — so this ALWAYS runs, everywhere. Deleting a gate step from
// a workflow now costs you a red test, which is exactly right: removing a gate should require
// deleting the test that says the gate exists.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')

const pkg = JSON.parse(read('package.json'))
const manifest = JSON.parse(read('tests/fixtures/traces/manifest.json'))
const WORKFLOWS = [
  ['deploy.yml', read('.github/workflows/deploy.yml')],
  ['ci.yml', read('.github/workflows/ci.yml')],
] as const

// Every npm script that is a correctness gate MUST be invoked by BOTH workflows. Add to this list
// when you add a gate; the test then forces you to wire it in.
const REQUIRED_GATES = ['lint', 'typecheck', 'test:ci', 'build'] as const

/** `- run: npm run x` / `- run: npm test` lines, normalized to the script name. */
function invokedScripts(yml: string): Set<string> {
  const out = new Set<string>()
  for (const m of yml.matchAll(/^\s*-?\s*run:\s*npm (?:run\s+)?([\w:-]+)/gm)) out.add(m[1]!)
  return out
}

describe.each(WORKFLOWS)('%s is a real gate', (_name, yml) => {
  const invoked = invokedScripts(yml)

  it.each(REQUIRED_GATES)('invokes the `%s` gate', (gate) => {
    expect(pkg.scripts[gate], `package.json has no "${gate}" script`).toBeDefined()
    expect(invoked.has(gate), `workflow never runs \`npm run ${gate}\``).toBe(true)
  })

  it('runs the zero-skip census, not a bare `npm test`', () => {
    // `npm test` alone exits 0 when suites skip — the exact hole in #67. test:ci wraps it with the
    // census, so a skip is a failure.
    expect(invoked.has('test'), 'use `npm run test:ci` (vitest + census), not bare `npm test`').toBe(false)
  })

  it('pins node from .nvmrc rather than hardcoding a major', () => {
    expect(yml).toMatch(/node-version-file:\s*\.nvmrc/)
    expect(yml, 'a hardcoded node-version contradicts .nvmrc').not.toMatch(/node-version:\s*\d/)
  })
})

it('the lint gate is capable of failing (--deny-warnings)', () => {
  // oxlint exits 0 on warnings. Without --deny-warnings, `- run: npm run lint` is a step that CANNOT
  // go red — gate theater, the same disease as describe.skip.
  expect(pkg.scripts.lint).toContain('--deny-warnings')
})

it('the node pin matches the runtime the oracle traces were recorded on', () => {
  // A floating major (`26`) resolves to whatever is newest, so fingerprint.mjs would cry "runtime
  // MISMATCH" on every divergence and the real-vs-environmental classifier would stop meaning
  // anything. Pin the exact patch.
  expect(read('.nvmrc').trim()).toBe(manifest.runtime.node.replace(/^v/, ''))
})

it('the game-clone pin matches the clone the oracle traces were recorded against', () => {
  // THE CHECK THAT MUST ACTUALLY FAIL. The previous version of this test asserted only that
  // manifest.runtime.gameClone was truthy and that *some* 40-hex string existed in the YAML — it
  // stayed GREEN when the pin was mutated to an all-zeros SHA. It could not fail on the one drift it
  // named. This compares the two pins directly: bump one without the other and you go red.
  expect(pkg.trimpsGame?.version, 'package.json has no trimpsGame.version pin').toBeDefined()
  expect(pkg.trimpsGame.version).toBe(manifest.runtime.gameClone)
  expect(pkg.trimpsGame.sha, 'the clone must be pinned by SHA, not a branch').toMatch(/^[0-9a-f]{40}$/)
})

it('no workflow fetches the clone itself — it is a managed dependency', () => {
  // If a workflow hand-fetches the clone, the SHA now lives in three places and nothing forces them
  // to agree. `npm ci` (postinstall) is the single source of truth (#67).
  for (const [name, yml] of WORKFLOWS) {
    expect(yml, `${name} hand-fetches the clone; let npm ci do it`).not.toContain('Trimps/Trimps.github.io')
  }
})
