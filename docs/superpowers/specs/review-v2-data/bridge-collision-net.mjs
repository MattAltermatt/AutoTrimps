// BRIDGE COLLISION NET — a bug class nobody has looked for.
// src/legacy-bridge.ts does Object.assign(globalThis, {...a, ...b, ...c}). If two modules export the SAME
// name, the one spread LAST silently wins on globalThis — and every legacy caller and every cross-module
// free-identifier read resolves to that winner. An empty stub in a late module beats a real implementation
// in an early one, with no error, no warning, and a green typecheck.
// Confirmed live instance: settings-visibility.ts:1014 `export function settingsProfileMakeGUI() { }`
// (empty) beats import-export.ts:8 (the real 36-line implementation).
import ts from '/Users/matt/dev/MattAltermatt/AutoTrimps/node_modules/typescript/lib/typescript.js';
import { readFileSync } from 'fs';

const ROOT = '/Users/matt/dev/MattAltermatt/AutoTrimps';

// Spread order is what decides the winner. Read it from the bridge itself rather than guessing.
const bridgeText = readFileSync(`${ROOT}/src/legacy-bridge.ts`, 'utf8');
const assignLine = bridgeText.split('\n').find(l => l.includes('Object.assign(globalThis'));
const spreadOrder = [...assignLine.matchAll(/\.\.\.(\w+)/g)].map(m => m[1]);

// map the bridge's local alias (e.g. `settingsVisibility`) back to its module file
const aliasToFile = new Map();
for (const m of bridgeText.matchAll(/import \* as (\w+) from '\.\/modules\/([\w-]+)'/g)) {
  aliasToFile.set(m[1], `src/modules/${m[2]}.ts`);
}

const exportsOf = (file) => {
  const src = ts.createSourceFile(file, readFileSync(`${ROOT}/${file}`, 'utf8'), ts.ScriptTarget.Latest, true);
  const out = [];
  const line = (n) => src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1;
  const isExported = (n) => n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const st of src.statements) {
    if (ts.isFunctionDeclaration(st) && isExported(st) && st.name) {
      // an empty body is the dangerous shape — it looks like a definition and behaves like nothing
      const empty = !st.body || st.body.statements.length === 0;
      out.push({ name: st.name.text, line: line(st), kind: 'function', empty });
    }
    if (ts.isVariableStatement(st) && isExported(st)) {
      for (const d of st.declarationList.declarations)
        if (ts.isIdentifier(d.name)) out.push({ name: d.name.text, line: line(d), kind: 'var', empty: false });
    }
  }
  return out;
};

// name -> [{alias, file, line, kind, empty, spreadIdx}]
const byName = new Map();
spreadOrder.forEach((alias, spreadIdx) => {
  const file = aliasToFile.get(alias);
  if (!file) return;
  for (const e of exportsOf(file)) {
    if (!byName.has(e.name)) byName.set(e.name, []);
    byName.get(e.name).push({ ...e, alias, file, spreadIdx });
  }
});

const collisions = [...byName.entries()]
  .filter(([, defs]) => defs.length > 1)
  .map(([name, defs]) => {
    const sorted = [...defs].sort((a, b) => a.spreadIdx - b.spreadIdx);
    const winner = sorted[sorted.length - 1];        // LAST spread wins
    const losers = sorted.slice(0, -1);
    return { name, winner, losers, winnerIsEmpty: winner.empty, aLoserIsReal: losers.some(l => !l.empty) };
  });

console.log(`bridge spread order (${spreadOrder.length} modules): ${spreadOrder.join(' → ')}\n`);
console.log(`DUPLICATE EXPORT NAMES ACROSS MODULES: ${collisions.length}\n`);

// worst first: an EMPTY winner shadowing a REAL implementation is a silently-dead feature
const worst = collisions.filter(c => c.winnerIsEmpty && c.aLoserIsReal);
const rest = collisions.filter(c => !(c.winnerIsEmpty && c.aLoserIsReal));

console.log(`########## CRITICAL — an EMPTY export wins over a REAL implementation (${worst.length})`);
console.log(`########## The feature is silently dead. Typecheck is green. No warning is emitted.\n`);
for (const c of worst) {
  console.log(`  ${c.name}`);
  console.log(`     WINS  (spread #${c.winner.spreadIdx}) ${c.winner.file}:${c.winner.line}  <-- EMPTY BODY`);
  for (const l of c.losers) console.log(`     loses (spread #${l.spreadIdx}) ${l.file}:${l.line}  ${l.empty ? '(also empty)' : '<-- THE REAL IMPLEMENTATION'}`);
  console.log();
}

console.log(`\n########## OTHER COLLISIONS — same name exported by 2+ modules (${rest.length})`);
console.log(`########## Not automatically a bug, but the LAST spread silently wins. Verify each is intentional.\n`);
for (const c of rest) {
  console.log(`  ${c.name}   winner: ${c.winner.file}:${c.winner.line} (spread #${c.winner.spreadIdx})`);
  for (const l of c.losers) console.log(`       shadowed: ${l.file}:${l.line}${l.empty ? ' (empty)' : ''}`);
}
