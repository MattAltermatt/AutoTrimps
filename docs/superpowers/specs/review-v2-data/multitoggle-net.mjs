// D2 net: for every multitoggle createSetting, does EVERY option index dispatch something?
// This is the #64 class: the setting IS read, but option index 3 falls through to no branch.
import ts from '/Users/matt/dev/MattAltermatt/AutoTrimps/node_modules/typescript/lib/typescript.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = '/Users/matt/dev/MattAltermatt/AutoTrimps';
const files = [
  ...readdirSync(join(ROOT, 'src/modules')).filter(f => f.endsWith('.ts')).map(f => join(ROOT, 'src/modules', f)),
  join(ROOT, 'legacy/AutoTrimps2.js'),
];

// ---- pass 1: collect multitoggle definitions (id -> option labels) ----
const multis = new Map(); // id -> {labels, file, line}
for (const file of files) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const walk = (n) => {
    if (ts.isCallExpression(n) && n.expression.getText(src) === 'createSetting' && n.arguments.length >= 4) {
      const [idArg, nameArg, , typeArg] = n.arguments;
      const type = ts.isStringLiteral(typeArg) ? typeArg.text : null;
      if (type === 'multitoggle' && ts.isStringLiteral(idArg) && ts.isArrayLiteralExpression(nameArg)) {
        const labels = nameArg.elements.map(e => (ts.isStringLiteral(e) ? e.text : '?'));
        const { line } = src.getLineAndCharacterOfPosition(n.getStart(src));
        multis.set(idArg.text, { labels, file: file.replace(ROOT + '/', ''), line: line + 1 });
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(src);
}

// ---- pass 2: collect every numeric comparison against getPageSetting('id') ----
// covers:  getPageSetting('X') == 2   |   2 == getPageSetting('X')   |   var v = getPageSetting('X'); ... v == 2
const compared = new Map(); // id -> Set of ints
const sites = new Map();    // id -> [raw evidence strings] — the agent judges, not the heuristic
const nonNumericCmp = []; // id compared against a NON-number (the #65 class)
const bump = (id, v) => {
  if (!compared.has(id)) compared.set(id, new Set());
  compared.get(id).add(v);
};
const site = (id, s) => {
  if (!sites.has(id)) sites.set(id, []);
  if (!sites.get(id).includes(s)) sites.get(id).push(s);
};

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

  // local aliases: `const x = getPageSetting('Foo')`
  const alias = new Map(); // varName -> settingId
  const gpsId = (n) => {
    if (ts.isCallExpression(n) && n.expression.getText(src) === 'getPageSetting'
        && n.arguments.length >= 1 && ts.isStringLiteral(n.arguments[0])) return n.arguments[0].text;
    return null;
  };

  const walk1 = (n) => {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name)) {
      const id = gpsId(n.initializer);
      if (id) alias.set(n.name.text, id);
    }
    ts.forEachChild(n, walk1);
  };
  walk1(src);

  const resolve = (n) => {
    const direct = gpsId(n);
    if (direct) return direct;
    if (ts.isIdentifier(n) && alias.has(n.text)) return alias.get(n.text);
    return null;
  };

  const walk2 = (n) => {
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      const isCmp = op === ts.SyntaxKind.EqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsEqualsToken
        || op === ts.SyntaxKind.ExclamationEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken
        || op === ts.SyntaxKind.GreaterThanToken || op === ts.SyntaxKind.GreaterThanEqualsToken
        || op === ts.SyntaxKind.LessThanToken || op === ts.SyntaxKind.LessThanEqualsToken;
      if (isCmp) {
        for (const [a, b, side] of [[n.left, n.right, 'L'], [n.right, n.left, 'R']]) {
          const id = resolve(a);
          if (id && multis.has(id)) {
            const { line: ln } = src.getLineAndCharacterOfPosition(n.getStart(src));
            site(id, `${file.replace(ROOT + '/', '')}:${ln + 1}  ${n.getText(src).replace(/\s+/g, ' ').slice(0, 100)}`);
            if (ts.isNumericLiteral(b)) {
              const v = Number(b.text);
              const nOpts = multis.get(id).labels.length;
              const all = [...Array(nOpts).keys()];
              // relational ops cover a RANGE of indices, not just the literal.
              // `side` says which side the setting was on, so flip the operator when it's on the right.
              const flip = { [ts.SyntaxKind.GreaterThanToken]: ts.SyntaxKind.LessThanToken,
                             [ts.SyntaxKind.LessThanToken]: ts.SyntaxKind.GreaterThanToken,
                             [ts.SyntaxKind.GreaterThanEqualsToken]: ts.SyntaxKind.LessThanEqualsToken,
                             [ts.SyntaxKind.LessThanEqualsToken]: ts.SyntaxKind.GreaterThanEqualsToken };
              const eff = side === 'R' && flip[op] !== undefined ? flip[op] : op;
              switch (eff) {
                case ts.SyntaxKind.GreaterThanToken:      all.filter(i => i > v).forEach(i => bump(id, i)); break;
                case ts.SyntaxKind.GreaterThanEqualsToken:all.filter(i => i >= v).forEach(i => bump(id, i)); break;
                case ts.SyntaxKind.LessThanToken:         all.filter(i => i < v).forEach(i => bump(id, i)); break;
                case ts.SyntaxKind.LessThanEqualsToken:   all.filter(i => i <= v).forEach(i => bump(id, i)); break;
                // `!= N` only proves N is DISCRIMINATED. It does NOT prove the other indices are
                // distinguished from each other — #64 was exactly a stale `!= 2` guard under which
                // index 3 fell through to nothing. Stay conservative: credit N only.
                default: bump(id, v);
              }
            }
            else if (ts.isStringLiteral(b)) {
              const { line } = src.getLineAndCharacterOfPosition(n.getStart(src));
              nonNumericCmp.push({ id, file: file.replace(ROOT + '/', ''), line: line + 1, text: n.getText(src).slice(0, 90) });
            }
          }
        }
      }
    }
    // switch (getPageSetting('X')) { case 0: ... }
    if (ts.isSwitchStatement(n)) {
      const id = resolve(n.expression);
      if (id && multis.has(id)) {
        for (const c of n.caseBlock.clauses) {
          if (ts.isCaseClause(c) && ts.isNumericLiteral(c.expression)) bump(id, Number(c.expression.text));
        }
      }
    }
    // array/object index:  FOO[getPageSetting('X')]
    if (ts.isElementAccessExpression(n)) {
      const id = resolve(n.argumentExpression);
      if (id && multis.has(id)) bump(id, '*INDEXED*');
    }
    // truthiness context: `if (X)`, `!X`, `X && ...` — discriminates 0 from non-zero, nothing more
    const truthy = (e) => {
      const id = resolve(e);
      if (id && multis.has(id)) {
        bump(id, 0);
        const { line: ln } = src.getLineAndCharacterOfPosition(e.getStart(src));
        site(id, `${file.replace(ROOT + '/', '')}:${ln + 1}  [truthiness] ${e.getText(src).slice(0, 60)}`);
      }
    };
    if (ts.isIfStatement(n)) truthy(n.expression);
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.ExclamationToken) truthy(n.operand);
    if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        || n.operatorToken.kind === ts.SyntaxKind.BarBarToken)) { truthy(n.left); truthy(n.right); }
    ts.forEachChild(n, walk2);
  };
  walk2(src);
}

// ---- report ----
console.log(`multitoggle settings defined: ${multis.size}\n`);
const dead = [];
for (const [id, { labels, file, line }] of [...multis].sort()) {
  const seen = compared.get(id) ?? new Set();
  if (seen.has('*INDEXED*')) continue; // used as an array index — every value is live
  const missing = labels.map((_, i) => i).filter(i => !seen.has(i));
  if (missing.length) dead.push({ id, labels, file, line, missing, seen: [...seen].sort() });
}
console.log(`### CANDIDATES — option indices never discriminated anywhere (${dead.length})`);
console.log(`### This is EVIDENCE, not a verdict. Index 0 is usually the falsy "off" path and is`);
console.log(`### legitimately handled by an else-branch. A missing NON-ZERO index is the #64 signal.`);
console.log(`### Every raw comparison site is listed so the reader can judge the actual dispatch.\n`);
// worst first: a missing non-zero index is far more suspicious than a missing 0
dead.sort((a, b) => (b.missing.filter(i => i > 0).length) - (a.missing.filter(i => i > 0).length));
for (const d of dead) {
  const nz = d.missing.filter(i => i > 0);
  console.log(`${nz.length ? '!! ' : '   '}${d.id}  (${d.file}:${d.line})`);
  console.log(`   options : ${d.labels.map((l, i) => `${i}="${l}"`).join('  ')}`);
  console.log(`   NEVER DISCRIMINATED: [${d.missing.join(', ')}]${nz.length ? `   <-- includes NON-ZERO ${JSON.stringify(nz)}` : ''}`);
  for (const s of (sites.get(d.id) ?? ['(NO COMPARISON SITES AT ALL)'])) console.log(`     · ${s}`);
  console.log();
}
console.log(`\n### multitoggle compared against a STRING literal (the #65 typetokeep class) — ${nonNumericCmp.length}\n`);
for (const c of nonNumericCmp) console.log(`${c.id}  ${c.file}:${c.line}  ${c.text}`);
