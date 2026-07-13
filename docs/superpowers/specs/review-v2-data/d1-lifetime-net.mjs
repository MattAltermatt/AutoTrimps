// D1 net: cross-file lifetime state. The #63 signature is "written once, never reset".
// For every globalThis.X write and every module-level mutable var in src/ + legacy/AutoTrimps2.js,
// report: where it is WRITTEN, where it is READ, and — critically — whether ANY write happens inside
// a reset-shaped function (portal / reset / init / clear / new run).
import ts from '/Users/matt/dev/MattAltermatt/AutoTrimps/node_modules/typescript/lib/typescript.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = '/Users/matt/dev/MattAltermatt/AutoTrimps';
const files = [
  ...readdirSync(join(ROOT, 'src/modules')).filter(f => f.endsWith('.ts')).map(f => join(ROOT, 'src/modules', f)),
  join(ROOT, 'legacy/AutoTrimps2.js'),
];
const RESET_FN = /portal|reset|init|clear|newrun|startnew|onportal|challenge/i;

const state = new Map(); // name -> {writes:[], reads:[], declKind, declaredAt}
const rec = (name) => {
  if (!state.has(name)) state.set(name, { writes: [], reads: [], declKind: null, declaredAt: null });
  return state.get(name);
};

for (const file of files) {
  const rel = file.replace(ROOT + '/', '');
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const lineOf = (n) => src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1;

  // which enclosing function are we in?
  const fnStack = [];
  const enclosing = () => fnStack[fnStack.length - 1] ?? '<top-level>';

  // Collect the set of names that are module-level mutable state, so we can track their reads/writes.
  const moduleVars = new Set();
  for (const st of src.statements) {
    if (ts.isVariableStatement(st)) {
      const kind = st.declarationList.flags & ts.NodeFlags.Const ? 'const' : (st.declarationList.flags & ts.NodeFlags.Let ? 'let' : 'var');
      if (kind === 'const') continue; // immutable binding — not lifetime state (contents may still mutate; noted below)
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) {
          moduleVars.add(d.name.text);
          const r = rec(d.name.text);
          r.declKind = `module-${kind}`;
          r.declaredAt = `${rel}:${lineOf(d)}`;
          if (d.initializer) r.writes.push({ at: `${rel}:${lineOf(d)}`, fn: '<module init>', text: d.getText(src).replace(/\s+/g, ' ').slice(0, 80) });
        }
      }
    }
  }

  const walk = (n) => {
    let pushed = false;
    if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n)) {
      fnStack.push(n.name?.getText(src) ?? '<anon>'); pushed = true;
    }

    // globalThis.X = ...
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left) && n.left.expression.getText(src) === 'globalThis') {
      const name = n.left.name.text;
      const r = rec(name);
      r.declKind ??= 'globalThis';
      r.writes.push({ at: `${rel}:${lineOf(n)}`, fn: enclosing(), text: n.getText(src).replace(/\s+/g, ' ').slice(0, 80) });
    }

    // assignment to a module-level var
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(n.left) && moduleVars.has(n.left.text)) {
      rec(n.left.text).writes.push({ at: `${rel}:${lineOf(n)}`, fn: enclosing(), text: n.getText(src).replace(/\s+/g, ' ').slice(0, 80) });
    }

    // reads: any bare identifier occurrence that isn't the LHS of an assignment or a decl name
    if (ts.isIdentifier(n) && state.has(n.text)) {
      const p = n.parent;
      const isWriteLhs = p && ts.isBinaryExpression(p) && p.left === n && p.operatorToken.kind === ts.SyntaxKind.EqualsToken;
      const isDeclName = p && ts.isVariableDeclaration(p) && p.name === n;
      const isPropName = p && ts.isPropertyAccessExpression(p) && p.name === n && p.expression.getText(src) !== 'globalThis';
      if (!isWriteLhs && !isDeclName && !isPropName) {
        rec(n.text).reads.push(`${rel}:${lineOf(n)} [${enclosing()}]`);
      }
    }

    ts.forEachChild(n, walk);
    if (pushed) fnStack.pop();
  };
  walk(src);
}

// ---- report, worst-first ----
const rows = [...state].map(([name, r]) => {
  const writeFns = [...new Set(r.writes.map(w => w.fn))];
  const hasReset = writeFns.some(f => RESET_FN.test(f));
  return { name, ...r, writeFns, hasReset };
}).filter(r => r.reads.length > 0 || r.writes.length > 0);

const suspects = rows.filter(r => !r.hasReset && r.reads.length > 0);
suspects.sort((a, b) => a.writes.length - b.writes.length || b.reads.length - a.reads.length);

console.log(`tracked state names: ${rows.length}`);
console.log(`\n### SUSPECTS — state that is READ but has NO write inside any reset-shaped function`);
console.log(`### (reset-shaped = fn name matching /portal|reset|init|clear|newrun|startnew|onportal|challenge/i)`);
console.log(`### The #63 signature is a SINGLE write, at init, and no reset. Sorted fewest-writes first.`);
console.log(`### EVIDENCE, NOT A VERDICT — many of these are legitimately write-once. Judge the reads.\n`);
for (const s of suspects) {
  const flag = s.writes.length <= 1 ? '!! ' : '   ';
  console.log(`${flag}${s.name}   [${s.declKind}]  writes=${s.writes.length}  reads=${s.reads.length}`);
  if (s.declaredAt) console.log(`      declared: ${s.declaredAt}`);
  for (const w of s.writes.slice(0, 6)) console.log(`      W ${w.at}  [${w.fn}]  ${w.text}`);
  if (s.writes.length > 6) console.log(`      W ... +${s.writes.length - 6} more`);
  for (const rd of s.reads.slice(0, 4)) console.log(`      R ${rd}`);
  if (s.reads.length > 4) console.log(`      R ... +${s.reads.length - 4} more`);
  console.log();
}
console.log(`\n### state WITH a reset-shaped writer (lower priority — a reset path exists; verify it's complete)`);
for (const r of rows.filter(x => x.hasReset)) {
  console.log(`   ${r.name}  writes=${r.writes.length} reads=${r.reads.length}  reset-fns=${r.writeFns.filter(f => RESET_FN.test(f)).join(',')}`);
}
