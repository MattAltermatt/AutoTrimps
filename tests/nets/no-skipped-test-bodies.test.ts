// NET — a test body may not exit early. Closes the boundary #258 recorded on the zero-skip census.
//
// `scripts/ci/assert-no-skips.mjs` consumes vitest's JSON report, and it catches every skip form
// that vitest REPORTS as skipped: `.skip`, `.todo`, `.skipIf(true)`, `.runIf(false)`, and `.only`
// (which is worse than a skip — it silently drops every other test in its file). All five exit 0
// under bare vitest, which is why the census exists as a separate process at all.
//
// But a test that simply returns reports as **passed**:
//
//     it('the clone is intact', () => {
//       if (!existsSync(CLONE)) return      // <- reads as a PASS, forever
//       expect(...)
//     })
//
// No report consumer can ever see that — the test ran, it did not throw, vitest is telling the truth.
// It is nonetheless a skip in every sense that matters, and it is precisely the shape of #67, where
// 11 suites quietly excused themselves whenever the game clone was absent and a real regression
// shipped green. Closing it needs a STATIC scan of test bodies, which is what this is.
//
// Scope, deliberately narrow so there are no judgement calls: a `return` that is a DIRECT statement
// of a test callback's body, or one guarded by an `if` that is itself a direct statement of that
// body. Both mean "this test stops here". Returns nested deeper — inside a loop, a helper, a
// callback — are ordinary control flow and are not touched.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as ts from 'typescript'

const ROOT = resolve(__dirname, '../..')
const TEST_RUNNERS = new Set(['it', 'test'])

function testFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'fixtures' || e.name === 'node_modules') continue
      testFiles(rel, acc)
    } else if (e.name.endsWith('.test.ts')) acc.push(rel)
  }
  return acc
}

export interface EarlyExit {
  file: string
  line: number
  kind: 'unconditional' | 'conditional'
}

/**
 * Every early exit in a test callback body. Exported so the rule can be exercised on synthetic
 * source rather than only on whatever the tree happens to contain — an assertion that can only
 * inspect real data cannot be shown to detect anything it does not already find.
 */
export function findEarlyExits(fileName: string, source: string): EarlyExit[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const out: EarlyExit[] = []

  /** `it(...)`, `test(...)`, `it.each(...)(...)` — the callee's root identifier is the runner. */
  const runnerName = (expr: ts.Expression): string | null => {
    let e: ts.Expression = expr
    while (ts.isPropertyAccessExpression(e) || ts.isCallExpression(e)) e = e.expression
    return ts.isIdentifier(e) ? e.text : null
  }

  const record = (n: ts.Node, kind: EarlyExit['kind']) =>
    out.push({ file: fileName, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, kind })

  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && TEST_RUNNERS.has(runnerName(n.expression) ?? '')) {
      const body = n.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a)) as
        | ts.ArrowFunction
        | ts.FunctionExpression
        | undefined
      if (body?.body && ts.isBlock(body.body)) {
        const statements = body.body.statements
        statements.forEach((stmt, i) => {
          if (ts.isReturnStatement(stmt)) {
            // `return expect(p).rejects.toThrow()` as the LAST statement is the ordinary vitest
            // idiom for handing a promise back to the runner — the assertion is already built and
            // nothing is skipped. Only two shapes are exits: a return with dead code after it, and
            // a VALUELESS return, which can never be handing anything to the runner.
            const isLast = i === statements.length - 1
            if (!isLast || !stmt.expression) record(stmt, 'unconditional')
          } else if (ts.isIfStatement(stmt)) {
            const arms = [stmt.thenStatement, stmt.elseStatement].filter(Boolean) as ts.Statement[]
            for (const arm of arms) {
              if (ts.isReturnStatement(arm)) record(arm, 'conditional')
              else if (ts.isBlock(arm))
                for (const s of arm.statements) if (ts.isReturnStatement(s)) record(s, 'conditional')
            }
          }
        })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

const files = testFiles('tests')
const hits = files.flatMap((f) => findEarlyExits(f, readFileSync(join(ROOT, f), 'utf8')))

describe('no test body exits early (#258)', () => {
  it('anti-false-green: the scan really walked the suite', () => {
    // If the walk silently found no files, "zero early exits" is vacuous — the same degenerate pass
    // the census itself rejects with its zero-tests floor.
    expect(files.length).toBeGreaterThan(50)
    expect(files.some((f) => f.includes('ci-gates'))).toBe(true)
  })

  it('anti-false-green: the rule CAN see both shapes, and leaves ordinary control flow alone', () => {
    const at = (src: string) => findEarlyExits('synthetic.test.ts', src)
    expect(at(`it('x', () => { return })`).map((h) => h.kind)).toEqual(['unconditional'])
    expect(at(`it('x', () => { if (!ok) return; expect(1).toBe(1) })`).map((h) => h.kind)).toEqual(['conditional'])
    expect(at(`test('x', function () { if (a) { return } })`).map((h) => h.kind)).toEqual(['conditional'])
    expect(at(`it.each([1])('x', () => { return })`).map((h) => h.kind)).toEqual(['unconditional'])
    // A valued return with DEAD CODE after it is still an exit, whatever it returns.
    expect(at(`it('x', () => { return f(); expect(1).toBe(1) })`).map((h) => h.kind)).toEqual(['unconditional'])
    // NOT flagged: the ordinary vitest idiom of handing a promise back to the runner as the last
    // statement. The assertion is already constructed; nothing is skipped. Flagging it would have
    // made this net a false-positive generator for exactly the async tests the fix batch will add.
    expect(at(`it('x', () => { return expect(p).rejects.toThrow() })`)).toEqual([])
    expect(at(`it('x', () => { const p = f(); return expect(p).resolves.toBe(1) })`)).toEqual([])
    // Not flagged: a return inside a nested function or loop is ordinary control flow.
    expect(at(`it('x', () => { arr.forEach((v) => { if (!v) return }); expect(1).toBe(1) })`)).toEqual([])
    expect(at(`it('x', () => { for (const v of arr) { if (!v) return } })`)).toEqual([])
    // Not flagged: a plain helper that happens to be named like nothing in particular.
    expect(at(`function helper() { return 1 }`)).toEqual([])
  })

  it('no test returns early — that is a skip the report-based census cannot see', () => {
    const report = hits.map((h) => `${h.file}:${h.line} — ${h.kind} early exit in a test body`)
    expect(report).toEqual([])
  })
})
