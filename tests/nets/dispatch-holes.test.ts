import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import ts from 'typescript'
import { MANIFEST } from '../../scripts/build-userscript.mjs'

// #81 — the "multitoggle option index that reaches no branch" net.
//
// A multitoggle renders a labelled option the user can click. If no code branch is reachable for that
// index, picking it silently does NOTHING — no error, no log, no clue. The option is a lie told in the
// UI. Three of these shipped to users before this file existed:
//
//   #64  ManualGather2 == 3 ("Science Research OFF") and RManualGather2 == 2 ("Mining/Building Only")
//        dispatched nothing — picking them silently disabled ALL gather automation and froze
//        playerGathering wherever it happened to be.
//   #65  Rmayhemmap == 1 ("M: Highest Map") was a total no-op.
//   #81  BuyBuildingsNew == 3 ("Buy Storage") — see below.
//
// tests/settings-wired.test.ts pinned the two #64 dispatchers BY HAND, with hardcoded regexes, for
// exactly two ids. That does not scale, and that is precisely why the rest survived. This net does all
// 54 of them, mechanically, and a new multitoggle joins it for free.
//
// ─── WHY A REGEX CANNOT DO THIS ────────────────────────────────────────────────────────────────────
// The flagship instance, legacy/AutoTrimps2.js:210-218:
//
//     if (!usingRealTimeOffline) {
//         if (getPageSetting('BuyBuildingsNew') === 0 && …) buyBuildings();
//         else if (getPageSetting('BuyBuildingsNew') == 1) { buyBuildings(); buyStorage(); }
//         else if (getPageSetting('BuyBuildingsNew') == 2) buyBuildings();
//     }
//     else if (getPageSetting('BuyBuildingsNew') == 3) buyStorage();   // ← the OUTER else
//
// The `}` closes the OUTER `if (!usingRealTimeOffline)`, so that last `else if` runs only while
// usingRealTimeOffline is TRUE — i.e. only during the offline-progress replay right after a page load
// (#66 — the same flag that blinded the sim harness for its whole existence). In live play index 3
// reaches nothing at all. **Index `3` IS textually compared**, on the very line that can never run, so
// a grep-based sweep reports this GREEN. Only the braces give it away. That is why this net (a) uses
// the TypeScript compiler API and (b) computes a GUARD CHAIN per comparison and discards any comparison
// that can only be reached with a live-play-impossible flag set (DEAD_FLAGS, below).
//
// ─── THE ROUTING MODEL, AND ITS ONE HONEST WEAKNESS ────────────────────────────────────────────────
// An index i is ROUTED if some LIVE read of the setting can be TRUE for i:
//   `== N` → {N} · `!= N` → all but N · `> N`/`>= N`/`< N`/`<= N` → the obvious set · `switch`/`case N`
//   → {N} · a bare truthy read (`if (getPageSetting(x))`, `x && …`) → {1..n-1} · a VALUE-consumed read
//   (assigned, passed as an argument, compared to a non-literal) → ALL indices, because the value itself
//   crosses the seam and every index is meaningful to whoever receives it.
//
// An index that NO live read can be true for is reported as a hole. That is deliberately a POSITIVE
// test — "some branch can fire for this index" — and it has one honest weakness: an index can also be
// meaningful *by exclusion*, when falling through every guard IS the option's behavior. Scryer's
// "MAYBE" is the archetype: the dispatch is `== 0` (NEVER) and `== 1` (FORCE), and index 2 means
// "neither — treat the cell normally". That is a real, working option with no branch of its own.
//
// Exclusion-routing is NOT auto-accepted, because it is *indistinguishable at the AST level* from the
// #64 bug (where falling through every guard meant literally nothing ran). The two are separated by
// READING THE FALL-THROUGH, once, per instance — and the answer is recorded in UNROUTED below with a
// written justification. The baseline may only ever SHRINK; a new unrouted index fails on arrival, and
// its author has to say which of the two it is. An allowlist you must argue your way into is a net.
//
// ─── SCOPE, STATED HONESTLY ────────────────────────────────────────────────────────────────────────
// This net proves REACHABILITY: some branch can fire for every index. It does NOT prove the branch does
// what the label promises. Three live #81 defects are outside it by construction, and are NOT closed by
// a green run here:
//   · `Hdshrine == 2` ("DAS: Normal") — index 2 IS compared and IS routed; the bug is that autoshrine()
//     then picks its config block from the challenge alone, so the option's stated meaning is
//     unimplemented. A semantic hole, not a reachability hole.
//   · other.ts:596 reads `getPageSetting(shrineSettings[universe][mode].core)` — a DYNAMIC id. This net
//     only resolves string-literal ids; a dispatch performed through a computed id is invisible to it.
//     (Both dynamic-id settings in the tree — Hdshrine/Rdshrine, and the praid* ids — are also read via
//     literal ids elsewhere, so no id is *only* seen dynamically today. If that changes, this net will
//     under-report, and this comment is the warning.)
//   · `AutoMaps == 2` is routed (`> 0`), yet three separate bugs clobber it back to 1 at runtime.
//     Runtime clobbering is a different class needing a different net.

const ROOT = resolve(__dirname, '..', '..')
const DEFS = 'src/modules/settings-defs.ts'

// The corpus is the SHIPPED bundle's inputs, read off the build's own MANIFEST — never hardcoded. A
// hardcoded legacy list is how tests/nets/modules-fields.test.ts went stale when #75 vendored
// FastPriorityQueue.js. Read the manifest and a newly-bundled legacy file joins this net for free.
const LEGACY_MANIFEST = MANIFEST.map((f: string) => join('legacy', f))

function tsSources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) tsSources(rel, acc)
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) acc.push(rel)
  }
  return acc
}

const parse = (rel: string) =>
  ts.createSourceFile(
    rel,
    readFileSync(join(ROOT, rel), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    rel.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  )

// ── 1. The inventory: every `createSetting(id, [labels…], desc, 'multitoggle', default, …)`. ────────
type Multitoggle = { labels: string[]; defaultValue: number | null; defaultIsString: boolean; line: number }
const inventory = new Map<string, Multitoggle>()
{
  const sf = parse(DEFS)
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'createSetting') {
      const [idArg, nameArg, , typeArg, defArg] = n.arguments
      if (
        idArg && ts.isStringLiteralLike(idArg) &&
        typeArg && ts.isStringLiteralLike(typeArg) && typeArg.text === 'multitoggle' &&
        nameArg && ts.isArrayLiteralExpression(nameArg)
      ) {
        // The default is USUALLY a numeric literal, but four settings pass the *string* '0'. That is a
        // real (#69-family) defect and it is pinned below — but it is latent, not broken (getPageSetting
        // parseInt()s and `btn.value++` coerces), so the range check must see through it rather than
        // report it as unparseable and hide any genuinely out-of-range default behind the same message.
        const defIsStr = !!defArg && ts.isStringLiteralLike(defArg)
        const defNum =
          defArg && ts.isNumericLiteral(defArg) ? Number(defArg.text)
          : defIsStr && /^\d+$/.test((defArg as ts.StringLiteralLike).text) ? Number((defArg as ts.StringLiteralLike).text)
          : null
        inventory.set(idArg.text, {
          labels: nameArg.elements.map((e) => (ts.isStringLiteralLike(e) ? e.text : '<non-literal>')),
          defaultValue: defNum,
          defaultIsString: defIsStr,
          line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
}

// ── 2. Every read of a multitoggle, across the shipped corpus. ──────────────────────────────────────
type Op = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'truthy' | 'value'
type Read = { id: string; op: Op; n: number; dead: string[]; file: string; line: number }

// Flags that are FALSE for the entire steady-state life of the game, so a branch that requires one to
// be TRUE is dead in live play. `usingRealTimeOffline` is set only while the game replays offline
// progress immediately after a load (main.js:2901) and cleared moments later.
const DEAD_FLAGS = new Set(['usingRealTimeOffline'])

/** `getPageSetting('id')` | `autoTrimpSettings.id.value` | `autoTrimpSettings['id'].value` → the id. */
function idOfRead(node: ts.Node): string | null {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'getPageSetting') {
    const a = node.arguments[0]
    return a && ts.isStringLiteralLike(a) ? a.text : null
  }
  if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return null
  const field = ts.isPropertyAccessExpression(node)
    ? node.name.text
    : node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)
      ? node.argumentExpression.text
      : null
  if (field !== 'value') return null
  const obj = node.expression
  if (ts.isPropertyAccessExpression(obj) && ts.isIdentifier(obj.expression) && obj.expression.text === 'autoTrimpSettings')
    return obj.name.text
  if (
    ts.isElementAccessExpression(obj) && ts.isIdentifier(obj.expression) && obj.expression.text === 'autoTrimpSettings' &&
    obj.argumentExpression && ts.isStringLiteralLike(obj.argumentExpression)
  )
    return obj.argumentExpression.text
  return null
}

function numOf(node: ts.Node): number | null {
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand))
    return -Number(node.operand.text)
  return null
}

/**
 * The guard chain. Walk the ancestors of a comparison and collect every DEAD_FLAG the branch requires
 * to be TRUE. Two shapes matter, and the second is the whole reason this net exists:
 *   `if (flag) { … HERE … }`               → requires flag true
 *   `if (!flag) { … } else { … HERE … }`   → requires flag true  ← the #81 flagship
 * A comparison with a non-empty chain is DEAD: nothing it guards can ever run in live play.
 */
function deadGuards(node: ts.Node): string[] {
  const out: string[] = []
  let cur: ts.Node = node
  let p = node.parent
  while (p) {
    if (ts.isIfStatement(p)) {
      const inThen = cur === p.thenStatement
      const inElse = !!p.elseStatement && cur === p.elseStatement
      let c: ts.Node = p.expression
      let negated = false
      while (ts.isParenthesizedExpression(c)) c = c.expression
      if (ts.isPrefixUnaryExpression(c) && c.operator === ts.SyntaxKind.ExclamationToken) {
        negated = true
        c = c.operand
      }
      while (ts.isParenthesizedExpression(c)) c = c.expression
      if (ts.isIdentifier(c) && DEAD_FLAGS.has(c.text) && ((inThen && !negated) || (inElse && negated)))
        out.push(c.text)
    }
    cur = p
    p = p.parent
  }
  return out
}

const BINOPS: Partial<Record<ts.SyntaxKind, Op>> = {
  [ts.SyntaxKind.EqualsEqualsToken]: '==',
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: '==',
  [ts.SyntaxKind.ExclamationEqualsToken]: '!=',
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: '!=',
  [ts.SyntaxKind.GreaterThanToken]: '>',
  [ts.SyntaxKind.GreaterThanEqualsToken]: '>=',
  [ts.SyntaxKind.LessThanToken]: '<',
  [ts.SyntaxKind.LessThanEqualsToken]: '<=',
}
// `1 < getPageSetting(x)` means `x > 1` — flip when the read is on the right.
const FLIP: Record<Op, Op> = { '>': '<', '>=': '<=', '<': '>', '<=': '>=', '==': '==', '!=': '!=', truthy: 'truthy', value: 'value' }

/** Is this read consumed as a BOOLEAN (an `if`/`while`/ternary condition, or an operand of `&&`/`||`/`!`)? */
function inBooleanContext(node: ts.Node): boolean {
  let c: ts.Node = node
  let p = node.parent
  while (p && ts.isParenthesizedExpression(p)) {
    c = p
    p = p.parent
  }
  if (!p) return false
  if (ts.isIfStatement(p) || ts.isWhileStatement(p) || ts.isDoStatement(p)) return p.expression === c
  if (ts.isConditionalExpression(p)) return p.condition === c
  if (ts.isPrefixUnaryExpression(p)) return p.operator === ts.SyntaxKind.ExclamationToken
  if (ts.isBinaryExpression(p))
    return (
      p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      p.operatorToken.kind === ts.SyntaxKind.BarBarToken
    )
  return false
}

const CORPUS = tsSources('src').concat(LEGACY_MANIFEST)
const reads: Read[] = []

for (const rel of CORPUS) {
  const sf = parse(rel)
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const visit = (n: ts.Node): void => {
    const id = idOfRead(n)
    if (id && inventory.has(id)) {
      const p = n.parent
      let matched = false
      if (p && ts.isBinaryExpression(p) && (p.left === n || p.right === n)) {
        const v = numOf(p.left === n ? p.right : p.left)
        const op = BINOPS[p.operatorToken.kind]
        if (op && v !== null) {
          reads.push({ id, op: p.right === n ? FLIP[op] : op, n: v, dead: deadGuards(n), file: rel, line: lineOf(n) })
          matched = true
        }
      }
      if (p && ts.isSwitchStatement(p) && p.expression === n) {
        for (const cl of p.caseBlock.clauses) {
          if (!ts.isCaseClause(cl)) continue
          const v = numOf(cl.expression)
          if (v !== null) {
            reads.push({ id, op: '==', n: v, dead: deadGuards(cl), file: rel, line: lineOf(cl) })
            matched = true
          }
        }
      }
      if (!matched)
        reads.push({
          id,
          op: inBooleanContext(n) ? 'truthy' : 'value',
          n: 0,
          dead: deadGuards(n),
          file: rel,
          line: lineOf(n),
        })
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
}

/** Can this read be TRUE (i.e. can the branch it guards fire) when the setting sits at index `i`? */
const routes = (r: Read, i: number): boolean => {
  switch (r.op) {
    case '==': return i === r.n
    case '!=': return i !== r.n
    case '>': return i > r.n
    case '>=': return i >= r.n
    case '<': return i < r.n
    case '<=': return i <= r.n
    case 'truthy': return i !== 0
    case 'value': return true // the index itself crosses the seam; every index is meaningful downstream
  }
}

const LIVE = reads.filter((r) => r.dead.length === 0)
const DEAD = reads.filter((r) => r.dead.length > 0)
const readsOf = (id: string) => LIVE.filter((r) => r.id === id)

/** The report, per setting: which option LABELS no live branch can route to. */
type Hole = { id: string; index: number; label: string }
const holes: Hole[] = []
for (const [id, mt] of inventory) {
  const rs = readsOf(id)
  for (let i = 0; i < mt.labels.length; i++)
    if (!rs.some((r) => routes(r, i))) holes.push({ id, index: i, label: mt.labels[i] })
}
const holeKey = (h: Hole) => `${h.id}[${h.index}]`

// ── 3. The shrinking baseline. ──────────────────────────────────────────────────────────────────────
//
// Every entry here is an index that NO live branch can route to, and every entry has been READ and
// dispositioned. Two legitimate dispositions exist, and nothing else:
//
//   OFF     — index 0 is the setting's off/default state and "no branch fires" IS its behavior. This is
//             the honest form of the "== 0 means do nothing" assumption: written down per setting, not
//             assumed globally. Note it is NOT always the literal word "Off" — `PowerSaving` 0 is
//             "AutoAbandon" (the default the guard suppresses) and `radonsettings` 0 is "Helium" (the
//             default UI). Those are exactly the cases a blanket "index 0 is fine" rule would have
//             rubber-stamped without anyone looking.
//   EXCL    — a NON-ZERO index whose behavior IS the fall-through: every guard is false for it, and
//             falling through them all is what the label promises. This is the disposition that must be
//             argued for, because it is textually identical to bug #64.
//
// It may only SHRINK. A new unrouted index fails on arrival; the guard test below fails if an entry
// stops being a hole. If you are about to ADD a line here, you are almost certainly looking at a bug.
const UNROUTED: Record<string, string> = {
  // ── OFF: index 0, and falling through every guard is the off/default behavior. ──
  'AutoAllocatePerks[0]': 'OFF — perks.ts allocation only runs for 1/2; 0 = do not allocate',
  'AutoBoneChargeMax[0]': 'OFF — 0 = "Manual Bone Charge"; AT2:172 gates the whole feature on != 0',
  'AutoGenC2[0]': 'OFF — 0 = "C2: Normal" = do not override the generator mode; upgrades.ts:54 gates on != 0',
  'AutoGenDC[0]': 'OFF — 0 = "Daily: Normal" = do not override the generator mode; upgrades.ts:53 gates on != 0',
  'AutoPortalDaily[0]': 'OFF — 0 = "Daily Portal Off"; AT2:229 gates the daily portal on > 0',
  'BetterAutoFight[0]': 'OFF — 0 = "Better AutoFight OFF"; AT2:242/243 dispatch only 1 and 2',
  'BuyArmorNew[0]': 'OFF — 0 = "Armor: Buy Neither"',
  'BuyUpgradesNew[0]': 'OFF — 0 = "Manual Upgrades"; AT2:203 gates autoUpgrades on != 0',
  'BuyWeaponsNew[0]': 'OFF — 0 = "Weapons: Buy Neither"',
  'Hdshrine[0]': 'OFF — 0 = "Daily AutoShrine Off"',
  'PowerSaving[0]': 'OFF — 0 = "AutoAbandon" = the DEFAULT abandon; maps.ts:698 suppresses it only for 1/2',
  'PrestigeSkip1_2[0]': 'OFF — 0 = "Prestige Skip Off"',
  'RABdustsimple[0]': 'OFF — 0 = "Simple Dust Off"',
  'RAutoAllocatePerks[0]': 'OFF — 0 = "Auto Allocate Off"',
  'RAutoPortalDaily[0]': 'OFF — 0 = "Daily Portal Off"; AT2:340 gates on > 0',
  'RBuyJobsNew[0]': 'OFF — 0 = "Don\'t Buy Jobs"; AT2:334 gates hireWorkers on > 0',
  'RBuyUpgradesNew[0]': 'OFF — 0 = "Manual Upgrades"; AT2:296 gates on != 0',
  'Rcarmormagic[0]': 'OFF — 0 = "C2 Armor Magic Off"; AT2:358 gates on > 0',
  'Rdarmormagic[0]': 'OFF — 0 = "Daily Armor Magic Off"; AT2:358 gates on > 0',
  'Rdfightforever[0]': 'OFF — 0 = "DFA: Off"',
  'Rdhs[0]': 'OFF — 0 = "DHS: Off"',
  'Rdshrine[0]': 'OFF — 0 = "Daily AutoShrine Off"',
  'Rmayhemmap[0]': 'OFF — 0 = "M: Maps Off"; maps.ts:1527 gates on > 0',
  'carmormagic[0]': 'OFF — 0 = "C2 Armor Magic Off"; AT2:249 gates on > 0',
  'dATGA2Auto[0]': 'OFF — 0 = "ATGA: Manual"',
  'darmormagic[0]': 'OFF — 0 = "Daily Armor Magic Off"; AT2:249 gates on > 0',
  'dfightforever[0]': 'OFF — 0 = "DFA: Off"',
  'radonsettings[0]': 'OFF — 0 = "Helium" = the default (U1) settings UI; visibility.ts:40 shows the radon UI only for 1',
  'spendmagmite[0]': 'OFF — 0 = "Spend Magmite OFF"',
  'typetokeep[0]': 'OFF — 0 = "None"; portal.ts:234/463 gate autoheirlooms3 on != 0 (this is the #65 fix)',

  // ── EXCL: a non-zero index whose behavior IS falling through every guard. Each one READ. ──
  'IgnoreCrits[1]':
    'EXCL — calc.ts:452 `IgnoreCrits != 1` suppresses the voidBuff getCrit x5 for index 1. Falling ' +
    'through IS "Ignore Void Strength". (calc.ts:439 `== 2` is the stronger "Ignore All Crits".)',
  'ScryerSkipBoss2[2]': 'EXCL — 2 = "MAYBE"; scryer.ts:70/71 dispatch NEVER(0)/NEVER-above-void(1). Falling through = treat the cell normally.',
  'ScryerSkipHealthy[2]': 'EXCL — 2 = "MAYBE"; scryer.ts:88/109 dispatch NEVER(0)/FORCE(1). Falling through = neither forbidden nor forced.',
  'ScryerUseinBW[2]': 'EXCL — 2 = "MAYBE"; scryer.ts:68/97 dispatch NEVER(0)/FORCE(1).',
  'ScryerUseinMaps2[2]': 'EXCL — 2 = "MAYBE"; scryer.ts:65/95 dispatch NEVER(0)/FORCE(1).',
  'ScryerUseinPMaps[2]': 'EXCL — 2 = "MAYBE"; scryer.ts:66/98 dispatch NEVER(0)/FORCE(1).',
  'ScryerUseinSpire2[2]': 'EXCL — 2 = "MAYBE"; scryer.ts:69/99/120 dispatch NEVER(0)/FORCE(1).',
  'ScryerUseinVoidMaps2[2]': 'EXCL — 2 = "MAYBE"; scryer.ts:67/96 dispatch NEVER(0)/FORCE(1).',
  'spendmagmitesetting[2]':
    'EXCL — 2 = "OneTime Only". magmite.ts:110 (`== 0 || == 3`) picks the OC-allowed set and :117 ' +
    '(`== 0 || == 1`) picks the normal set; index 2 is fully determined by exclusion — OneTime, no OC.',

  // ── FIXED, and the proof it is fixed is that these keys are GONE: ──
  // ✅ BuyBuildingsNew[3] ("Buy Storage") — the #81 flagship. legacy/AutoTrimps2.js:218's `== 3` arm was
  //    bound to the `else` of `if (!usingRealTimeOffline)`, so it could only run during the offline
  //    replay. Moved inside the block where it always belonged. The net saw it because deadGuards()
  //    discarded that comparison — the routing pass then had nothing that could be true for index 3.
}

describe('every multitoggle option index is reachable by some branch (#81)', () => {
  it('parses a real inventory and a real corpus (anti-false-green)', () => {
    // If the AST walk breaks, these collapse to 0 and every assertion below passes vacuously. That is
    // the #66 failure mode — a green net over a blind harness is worse than no net. Pin the shape.
    expect(inventory.size).toBeGreaterThan(40)
    expect(CORPUS.length).toBeGreaterThan(25)
    expect(LIVE.length).toBeGreaterThan(100)
    // The legacy half of the corpus is load-bearing: the mainLoop dispatch table lives in AutoTrimps2.js,
    // and a net that only read src/ would report most of these settings as 100% unrouted.
    expect(LIVE.some((r) => r.file === join('legacy', 'AutoTrimps2.js'))).toBe(true)

    // Known-good settings whose every index MUST route. If a refactor silently empties the read set,
    // these fail HERE with a clear message instead of quietly widening the hole report.
    for (const id of ['ManualGather2', 'RManualGather2', 'AutoMaps', 'RAutoMaps']) {
      const mt = inventory.get(id)
      expect(mt, `${id} vanished from the multitoggle inventory`).toBeDefined()
      const rs = readsOf(id)
      const unrouted = mt!.labels
        .map((l, i) => ({ l, i }))
        .filter(({ i }) => !rs.some((r) => routes(r, i)))
      // #64's two dispatchers and the AutoMaps pair are the reference: fully routed, every index.
      expect(unrouted.map((u) => `${id}[${u.i}]="${u.l}"`)).toEqual([])
    }
  })

  it('no option index reaches zero branches', () => {
    // The headline. The LABEL is what makes a hole legible to a human: "'M: Highest Map' routes nowhere".
    const report = holes
      .filter((h) => !(holeKey(h) in UNROUTED))
      .map((h) => {
        const rs = readsOf(h.id)
        const live = rs.map((r) => `${r.op}${r.op === 'truthy' || r.op === 'value' ? '' : r.n}@${r.file}:${r.line}`)
        const dead = DEAD.filter((r) => r.id === h.id).map(
          (r) => `${r.op}${r.n}@${r.file}:${r.line} [DEAD: needs ${r.dead.join('+')}]`,
        )
        return `${h.id}[${h.index}] = "${h.label}" routes NOWHERE\n      live reads: ${live.join(', ') || '(none)'}${
          dead.length ? `\n      dead reads: ${dead.join(', ')}` : ''
        }`
      })
    expect(report).toEqual([])
  })

  it('the unrouted baseline only shrinks — it is a disposition log, not an allowlist', () => {
    // Fix a hole and this goes RED until you delete its line. Same discipline as KNOWN_PHANTOM in
    // tests/nets/modules-fields.test.ts: the baseline must never become where a new bug quietly lands.
    const live = new Set(holes.map(holeKey))
    for (const k of Object.keys(UNROUTED))
      expect(live.has(k), `${k} now routes to a branch — delete it from UNROUTED`).toBe(true)
    // Every entry must declare its disposition, so "I added a line to make it green" is not silently
    // available: the two legal dispositions are the two the header argues for, and nothing else.
    for (const [k, why] of Object.entries(UNROUTED))
      expect(/^(OFF|EXCL) — /.test(why), `${k}: justification must start with "OFF — " or "EXCL — "`).toBe(true)
    // Ratcheted 40 → 39 by the #81 BuyBuildingsNew[3] fix. Only ever tighten.
    expect(Object.keys(UNROUTED).length).toBeLessThanOrEqual(39)
  })
})

describe('no settings dispatch is buried behind a live-play-impossible flag (#81 flagship)', () => {
  // The generalization of the flagship. `usingRealTimeOffline` is true only during the offline-progress
  // replay right after a load. Any settings dispatch whose guard chain REQUIRES it is dead in live play,
  // no matter how correct the comparison looks — and #34 proves nobody spots that by reading.
  it('no multitoggle comparison requires a DEAD_FLAG to be true', () => {
    const report = DEAD.map(
      (r) => `${r.file}:${r.line}  getPageSetting('${r.id}') ${r.op} ${r.n}  — unreachable unless ${r.dead.join(' && ')}`,
    )
    expect(report).toEqual([])
  })

  it('the DEAD_FLAG walk actually works (anti-false-green)', () => {
    // A guard-chain walk that silently stops working reports ZERO dead comparisons — which is exactly
    // what a fixed tree reports too. Prove the walk can still SEE the shape it was built for, on a
    // synthetic source with the #81 brace inversion in it.
    const probe = ts.createSourceFile(
      'probe.js',
      `if (!usingRealTimeOffline) { if (getPageSetting('BuyBuildingsNew') == 1) a(); }
       else if (getPageSetting('BuyBuildingsNew') == 3) b();
       if (usingRealTimeOffline) { if (getPageSetting('BuyBuildingsNew') == 2) c(); }`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    )
    const found: string[] = []
    const visit = (n: ts.Node): void => {
      if (idOfRead(n) === 'BuyBuildingsNew' && n.parent && ts.isBinaryExpression(n.parent)) {
        const v = numOf(n.parent.right)
        found.push(`${v}:${deadGuards(n).length ? 'DEAD' : 'live'}`)
      }
      ts.forEachChild(n, visit)
    }
    visit(probe)
    // 1 is inside the `!flag` then-branch (live); 3 is the outer `else` (dead); 2 is inside the `flag`
    // then-branch (dead). If the walk regresses, this pins exactly which of the three shapes it lost.
    expect(found).toEqual(['1:live', '3:DEAD', '2:DEAD'])
  })
})

describe('no multitoggle can hold an index that does not exist (#81 / #61)', () => {
  // The other way an index reaches no branch: the VALUE is out of range in the first place. The shipped
  // "550+ AT Settings" preset wrote BetterAutoFight = 3 into a 3-option (0..2) setting, and nothing on
  // the import path clamped it — so getPageSetting returned 3 and NEITHER dispatch arm fired. A player
  // loading that preset got no AutoFight management at all, silently, forever.
  const utils = parse('src/modules/utils.ts')

  /** Every `serializeSettings*()` whose body is a single frozen JSON string literal — the shipped presets. */
  const presets: { name: string; obj: Record<string, unknown> }[] = []
  {
    const visit = (n: ts.Node): void => {
      if (ts.isFunctionDeclaration(n) && n.name && /^serializeSettings\d+$/.test(n.name.text) && n.body) {
        const ret = n.body.statements.find(ts.isReturnStatement)
        if (ret?.expression && ts.isStringLiteralLike(ret.expression))
          presets.push({ name: n.name.text, obj: JSON.parse(ret.expression.text) })
      }
      ts.forEachChild(n, visit)
    }
    visit(utils)
  }

  it('finds the shipped presets (anti-false-green)', () => {
    expect(presets.map((p) => p.name).sort()).toEqual(['serializeSettings550', 'serializeSettings60'])
    for (const p of presets) {
      expect(Object.keys(p.obj).length).toBeGreaterThan(200)
      // If the id-matching breaks, every preset trivially "has no out-of-range multitoggle".
      expect(Object.keys(p.obj).filter((k) => inventory.has(k)).length).toBeGreaterThan(20)
    }
  })

  // The one known out-of-range preset value. It is NOT edited away: these two blobs are the frozen,
  // exact-string-guarded historical presets (CLAUDE.md), and rewriting a 2018 preset's stored value is a
  // data decision, not a mechanism one. The RUNTIME hole it opened is closed at the chokepoint instead —
  // createSetting now clamps it back to the setting's own declared default, which is proven end-to-end
  // against the real blob in tests/dispatch-holes.regression.test.ts. This baseline exists so that a NEW
  // out-of-range preset value still fails on arrival, and so this one cannot be quietly joined.
  const KNOWN_OUT_OF_RANGE: Record<string, string> = {
    'serializeSettings550().BetterAutoFight':
      '#81/#61 — the 2018 "550+ AT Settings" preset writes 3 into a 0..2 setting. Neutralized at load by ' +
      'clampMultitoggle() in settings-engine.ts; the blob itself is frozen and deliberately unedited.',
  }

  const outOfRange = presets.flatMap(({ name, obj }) =>
    Object.entries(obj)
      .filter(([k, v]) => {
        const mt = inventory.get(k)
        return mt && (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= mt.labels.length)
      })
      .map(([k, v]) => ({
        key: `${name}().${k}`,
        detail: `${name}(): ${k} = ${JSON.stringify(v)} — legal indices are 0..${inventory.get(k)!.labels.length - 1} [${inventory.get(k)!.labels.join(' | ')}]`,
      })),
  )

  it('every multitoggle value in a shipped preset is a legal option index', () => {
    expect(outOfRange.filter((o) => !(o.key in KNOWN_OUT_OF_RANGE)).map((o) => o.detail)).toEqual([])
  })

  it('the out-of-range baseline only shrinks', () => {
    const live = new Set(outOfRange.map((o) => o.key))
    for (const k of Object.keys(KNOWN_OUT_OF_RANGE))
      expect(live.has(k), `${k} is now in range — delete it from KNOWN_OUT_OF_RANGE`).toBe(true)
    expect(Object.keys(KNOWN_OUT_OF_RANGE).length).toBeLessThanOrEqual(1)
  })

  it("every multitoggle's declared default is a legal option index", () => {
    const bad: string[] = []
    for (const [id, mt] of inventory) {
      if (mt.defaultValue === null) {
        bad.push(`${DEFS}:${mt.line}: ${id} has a defaultValue that is not an integer literal — cannot be range-checked`)
      } else if (mt.defaultValue < 0 || mt.defaultValue >= mt.labels.length) {
        bad.push(`${DEFS}:${mt.line}: ${id} default = ${mt.defaultValue}, legal 0..${mt.labels.length - 1}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('exactly the four known multitoggles declare their default as a STRING (#69 family)', () => {
    // Found by this net, reported not fixed: `createSetting(..., 'multitoggle', '0', ...)` stores the
    // string '0' as the value. It survives because getPageSetting() parseInt()s and settingChanged()'s
    // `btn.value++` coerces — but any code reading `autoTrimpSettings[id].value` with `===` sees a string,
    // which is exactly how #69's boolean-as-'false' family bites. Pinned so a FIFTH one fails on arrival
    // rather than joining the crowd. Normalizing these four changes what serializeSettings() writes for
    // every existing user — a separate decision, deliberately not taken here.
    const stringDefaults = [...inventory].filter(([, mt]) => mt.defaultIsString).map(([id]) => id).sort()
    expect(stringDefaults).toEqual(['AutoPortalDaily', 'RAutoPortalDaily', 'Rdfightforever', 'dfightforever'])
  })

})
