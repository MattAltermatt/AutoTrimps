// THE REVERSE SETTINGS NET (naysayer's D2'a). The existing net asserts "every createSetting id is READ".
// The reverse — "every getPageSetting id is DEFINED" — does not exist. utils.ts returns `false` for an
// unknown key, so every phantom read is a SILENTLY DEAD guard. This is issue #58's class.
import ts from '/Users/matt/dev/MattAltermatt/AutoTrimps/node_modules/typescript/lib/typescript.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = '/Users/matt/dev/MattAltermatt/AutoTrimps';
const files = [
  ...readdirSync(join(ROOT, 'src/modules')).filter(f => f.endsWith('.ts')).map(f => join(ROOT, 'src/modules', f)),
  join(ROOT, 'legacy/AutoTrimps2.js'),
  join(ROOT, 'legacy/Graphs.js'),
];

const defined = new Map();  // id -> where defined
const read = new Map();     // id -> [sites]

for (const file of files) {
  const rel = file.replace(ROOT + '/', '');
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const ln = (n) => src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1;
  const walk = (n) => {
    if (ts.isCallExpression(n) && n.arguments.length >= 1 && ts.isStringLiteral(n.arguments[0])) {
      const fn = n.expression.getText(src);
      const id = n.arguments[0].text;
      if (fn === 'createSetting') defined.set(id, `${rel}:${ln(n)}`);
      if (fn === 'getPageSetting' || fn === 'setPageSetting') {
        if (!read.has(id)) read.set(id, []);
        read.get(id).push(`${rel}:${ln(n)}  ${n.parent.getText(src).replace(/\s+/g, ' ').slice(0, 95)}`);
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(src);
}

const phantom = [...read.keys()].filter(id => !defined.has(id)).sort();
const unread = [...defined.keys()].filter(id => !read.has(id)).sort();

// nearest defined id, to expose the typo shape (Levenshtein)
const lev = (a, b) => {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i-1][j] + 1, m[i][j-1] + 1, m[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return m[a.length][b.length];
};

console.log(`createSetting ids defined : ${defined.size}`);
console.log(`getPageSetting ids read    : ${read.size}`);
console.log(`\n########## PHANTOM READS — getPageSetting(id) where id was NEVER createSetting'd (${phantom.length})`);
console.log(`########## utils.ts returns FALSE for these. Every guard using one is silently dead.\n`);
for (const id of phantom) {
  const near = [...defined.keys()].map(d => [lev(id.toLowerCase(), d.toLowerCase()), d]).sort((a, b) => a[0] - b[0])[0];
  console.log(`'${id}'   (${read.get(id).length} read sites)   nearest defined: '${near[1]}' (edit distance ${near[0]})`);
  for (const s of read.get(id)) console.log(`     · ${s}`);
  console.log();
}
console.log(`\n########## DEFINED BUT NEVER READ (${unread.length}) — the existing net should already cover these`);
for (const id of unread) console.log(`   '${id}'  defined ${defined.get(id)}`);
