// THE BLIND-SPOT CENSUS — what can the L0 proof net actually SEE?
//
// The question this repo keeps failing to answer is not "is the net green?" but "does green MEAN
// anything for the code I just touched?" Three times the honest answer was no, and each time we only
// found out by accident:
//
//   #66  the sim ran AT with gear-buying and science DARK for its entire existence, and the suite was green.
//   #98  a 1,000,000x damage multiplier passed the ENTIRE sim suite green.
//   #93/#101 (today) two real behaviour changes shipped on unit tests alone, because the net cannot
//        reach Collectors or Hypothermia — so their green baseline-zero proved nothing, and the commit
//        messages had to say so.
//
// The pattern is always the same: we assume coverage, ship, and discover the blindness later. This
// script inverts that. It takes each region of AT's decision-making, INJECTS A REAL BUG into the built
// bundle, re-runs the L0 differential over the whole corpus, and records whether the net notices.
// Output is a matrix of divergence counts: a MEASURED map of what the gate can and cannot see.
//
// The bugs are not synthetic. Where possible each mutation is a bug this project actually shipped
// (#98's damage multiplier, #93's housing scorer, #101's inverted Rhypo clause), so a RED cell is
// literally "the net would have caught this one" and a GREEN cell is "it would not have."
//
// ⚠️ READ THIS BEFORE TRUSTING A GREEN CELL. Green does NOT mean the code is fine; it means the NET IS
// BLIND there. That is the whole point of the exercise, and it is the opposite of the usual reading.
//
// ⚠️ AND BEFORE TRUSTING A RED ONE: every mutation asserts that its patch actually landed in the bundle
// (an anchor that silently fails to match produces a bundle identical to the clean one, a differential
// of zero, and a confident, totally false "the net is blind here"). That anti-false-green check is not
// optional — it is the same class of error as #98 itself.
//
// Usage:  node scripts/sim/blind-spot-census.mjs [--mutation <name>]

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildUserscript } from '../build-userscript.mjs'
import { runTrace, diffTraces } from './trace.mjs'
import { CORPUS } from './corpus.mjs'

const SAVES = resolve('tests/fixtures/saves')
const TRACES = resolve('tests/fixtures/traces')

/**
 * Splice `injection` into the bundle immediately after `anchor`, and PROVE the splice landed.
 * A no-op patch is the single most dangerous outcome here — see the header.
 */
function spliceAfter(src, anchor, injection, label) {
  const at = src.indexOf(anchor)
  if (at < 0) throw new Error(`[${label}] anchor not found — the bundle shape changed: ${anchor}`)
  const out = src.slice(0, at + anchor.length) + injection + src.slice(at + anchor.length)
  if (out.length <= src.length) throw new Error(`[${label}] splice was a no-op`)
  return out
}

function replaceOnce(src, from, to, label) {
  const at = src.indexOf(from)
  if (at < 0) throw new Error(`[${label}] anchor not found — the bundle shape changed: ${from}`)
  if (src.indexOf(from, at + 1) >= 0) throw new Error(`[${label}] anchor is ambiguous (>1 match): ${from}`)
  return src.slice(0, at) + to + src.slice(at + from.length)
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The mutations. Each one breaks a DECISION, not merely a line — a mutation whose result cannot change
// an outcome teaches nothing (reach != sensitivity, #98).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const MUTATIONS = [
  {
    name: 'canary-buildings-noop',
    area: 'buildings',
    why: 'THE CANARY. Makes buyBuildings() a no-op. If this does not go red the census harness itself is broken.',
    apply: (s) => spliceAfter(s, 'function buyBuildings() {', ' return;', 'canary'),
  },
  {
    name: 'damage-1e6',
    area: 'combat (calcOurDmg)',
    why: 'The #98 bug verbatim: a 1,000,000x damage multiplier. Passed the whole suite GREEN before 08-starved-u1 existed.',
    apply: (s) => {
      const fn = s.indexOf('function calcOurDmg2(')
      if (fn < 0) throw new Error('[damage] calcOurDmg2 not found')
      const A = 'if (game.global.mapBonus > 0) {'
      const at = s.indexOf(A, fn)
      if (at < 0) throw new Error('[damage] mapBonus anchor not found inside calcOurDmg2')
      const out = s.slice(0, at) + 'if (game.global.antiStacks > 0) number *= 1000000;\n    ' + s.slice(at)
      if (!out.includes('number *= 1000000')) throw new Error('[damage] splice no-op')
      return out
    },
  },
  {
    name: 'health-1e6',
    area: 'combat (calcOurHealth)',
    why: 'Inflates base health a millionfold. Feeds enoughHealth, which gates armour buying and farm decisions.',
    apply: (s) => replaceOnce(s, 'function calcOurHealth2(stance) {\n    let health = 50;',
      'function calcOurHealth2(stance) {\n    let health = 50000000;', 'health'),
  },
  {
    name: 'housing-always-hut',
    area: 'buildings (mostEfficientHousing)',
    why: "#93's effect: the scorer always picks the cheapest housing, so a Collector is never bought.",
    apply: (s) => spliceAfter(s, 'function mostEfficientHousing() {', ' return "Hut";', 'housing'),
  },
  {
    name: 'housing-hut-divisor',
    area: 'buildings (mostEfficientHousing)',
    why: "#93's ACTUAL bug, restored verbatim: score every housing type by the Hut's increase.by. The " +
      'proxy above (always return Hut) is a cruder break — this is the real one, and the difference ' +
      'between the two rows is the difference between REACH and SENSITIVITY.',
    apply: (s) => replaceOnce(s, 'game.buildings[housing].increase.by', 'game.buildings.Hut.increase.by', 'housing-real'),
  },
  {
    name: 'rhypo-invert',
    area: 'challenge (Hypothermia wood)',
    why: "#101's bug restored: conserve wood only AFTER exceeding the bonfire goal, instead of until it is achieved.",
    apply: (s) => replaceOnce(s, 'bonfire < finalBonfireTarget', 'bonfire > finalBonfireTarget', 'rhypo'),
  },
  {
    name: 'equipment-noop',
    area: 'equipment (autoLevelEquipment)',
    why: "#66's blindness verbatim: AT stops buying/levelling gear entirely. The suite was green through this for months.",
    apply: (s) => spliceAfter(s, 'function autoLevelEquipment() {', ' return;', 'equipment'),
  },
  {
    name: 'jobs-ratio-flip',
    area: 'jobs (workerRatios)',
    why: 'Forces an all-farmer worker ratio, so every hire decision is wrong.',
    apply: (s) => spliceAfter(s, 'function workerRatios() {', ' return [1, 0, 0, 0];', 'jobs'),
  },
  {
    name: 'warpstation-noop',
    area: 'buildings (Warpstation, deep)',
    why: "#128: Warpstation is the dominant metal sink at depth (42.5% of metal spend at z63) and unlocks " +
      'at world 60 — the whole corpus topped out at world 8, so this branch had NEVER executed. Makes ' +
      "safeBuyBuilding's Warpstation branch buy nothing. 12-warp-u1 is the fixture that arms it.",
    apply: (s) =>
      spliceAfter(
        s,
        'if (building === "Warpstation" && !game.buildings[building].locked && canAffordBuilding(building)) {',
        ' return;',
        'warpstation',
      ),
  },
  {
    name: 'gem-housing-rank',
    area: 'buildings (buyGemEfficientHousing ranking, deep)',
    why: "#128: INVERTS buyGemEfficientHousing's gem-efficiency sort so it picks the WORST housing, not the " +
      'best. A #93-shaped ranking break, not a crude no-op — it proves the RANKING is load-bearing, which ' +
      'only shows once the deep tiers (Collector/Warpstation) are unlocked (never below world 8).',
    apply: (s) => {
      // Scope to buyGemEfficientHousing before matching the sort. The anchor is globally UNIQUE today
      // (buyFoodEfficientHousing sorts by a different comparator), so this is future-proofing against a
      // U2 gem twin, not disambiguation of existing copies — do not weaken it into an unscoped match.
      const fn = s.indexOf('function buyGemEfficientHousing() {')
      if (fn < 0) throw new Error('[gem-rank] buyGemEfficientHousing not found')
      const A = 'return obj[a] - obj[b];'
      const at = s.indexOf(A, fn)
      if (at < 0) throw new Error('[gem-rank] U1 sort anchor not found after buyGemEfficientHousing')
      const out = s.slice(0, at) + 'return obj[b] - obj[a];' + s.slice(at + A.length)
      if (!out.includes('return obj[b] - obj[a]')) throw new Error('[gem-rank] splice no-op')
      return out
    },
  },
  {
    name: 'portal-noop',
    area: 'portal (autoPortal)',
    why: "#127: AT's highest-consequence action — a portal RESETS the run — and doPortal() had never once " +
      'executed in a sim run. AutoPortal defaults to Off and no save had portalActive, and in He/Hr mode ' +
      'the portal is SCHEDULED, so the old setTimeout stub swallowed it too. 11-portal-u1 is the fixture ' +
      'that arms it; this mutation makes AT never portal.',
    apply: (s) => spliceAfter(s, 'function autoPortal() {', ' return;', 'portal'),
  },
]

// ─────────────────────────────────────────────────────────────────────────────────────────────────

const only = process.argv.includes('--mutation')
  ? process.argv[process.argv.indexOf('--mutation') + 1]
  : null
const mutations = only ? MUTATIONS.filter((m) => m.name === only) : MUTATIONS
if (!mutations.length) throw new Error(`no mutation named "${only}"`)

// Each mutation runs 17 full jsdom sims. Doing all of them in ONE process exhausts the V8 heap (the
// game object graph per boot is enormous and the sims do not release cleanly), so the parent
// re-executes ITSELF once per mutation and collects JSON. Raising --max-old-space-size would only
// postpone the OOM; a process boundary removes the leak instead of hiding it.
if (!only) {
  const { execFileSync } = await import('node:child_process')
  const collected = []
  for (const m of MUTATIONS) {
    process.stdout.write(`\n${m.name.padEnd(24)} `)
    try {
      const raw = execFileSync(process.execPath, [process.argv[1], '--mutation', m.name, '--json'], {
        encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
      })
      collected.push(JSON.parse(raw.slice(raw.indexOf('{'))))
    } catch (err) {
      collected.push({ name: m.name, area: m.area, why: m.why, error: String(err.message).slice(0, 120) })
    }
  }
  writeFileSync(resolve('tests/sim/blind-spot-census.md'), report(collected), 'utf8')
  console.log('\n' + report(collected))
  console.log('wrote tests/sim/blind-spot-census.md')
  process.exit(0)
}

console.log('building the clean bundle…')
const clean = await buildUserscript()
const dir = mkdtempSync(join(tmpdir(), 'at-census-'))

// Every (save, seed) the real gate runs. The census must use the SAME contract as baseline-zero, or a
// green cell here would not tell us anything about the gate that actually protects production.
//
// ⚠️ `settings` IS PART OF THAT CONTRACT (#105). This line used to destructure only {name, seeds, ticks}
// and call runTrace WITHOUT atSettings — while the committed oracle traces were recorded WITH them. So
// for any settings-gated fixture EVERY mutant diverged, because the mutant ran a differently-CONFIGURED
// bot, not a differently-behaving one. It was caught the moment 10-hypo-u2 landed: it reported exactly
// 13 divergences for `canary-buildings-noop` — a mutation to U1's buyBuildings(), which is provably
// inert in U2 (04-u2-radon scores it 0). A census that reports a detection it did not make is worse
// than no census: it certifies coverage that does not exist.
const RUNS = CORPUS.flatMap(({ name, seeds, ticks, settings }) => seeds.map((seed) => ({ name, seed, ticks, settings })))

const results = []
for (const m of mutations) {
  const mutantPath = join(dir, `${m.name}.user.js`)
  let built = true
  try {
    writeFileSync(mutantPath, m.apply(clean), 'utf8')
  } catch (err) {
    built = false
    console.error(`\n!! ${m.name}: ${err.message}`)
    results.push({ m, total: null, perSave: {}, error: err.message })
    continue
  }
  if (!built) continue

  const perSave = {}
  let total = 0
  process.stdout.write(`\n${m.name.padEnd(24)} `)
  for (const { name, seed, ticks, settings } of RUNS) {
    const oracle = JSON.parse(readFileSync(resolve(TRACES, `${name}.${seed}.trace.json`), 'utf8'))
    const saveString = readFileSync(resolve(SAVES, `${name}.txt`), 'utf8')
    let n
    try {
      n = diffTraces(oracle, runTrace({ atBundlePath: mutantPath, saveString, seed, ticks, atSettings: settings })).length
    } catch {
      n = -1 // the mutant crashed the sim — that IS a detection, and a loud one
    }
    perSave[`${name}.${seed}`] = n
    if (n > 0 || n === -1) total += n === -1 ? 1 : n
    process.stdout.write(n === 0 ? '.' : n === -1 ? 'X' : '#')
  }
  results.push({ m, total, perSave })
}

// The child's whole job is to hand one row back to the parent.
const row = results[0]
console.log('\n' + JSON.stringify({
  name: row.m.name, area: row.m.area, why: row.m.why,
  total: row.total, perSave: row.perSave, error: row.error,
}))

/** Render the collected rows. Shared by the parent; a child never calls it. */
function report(rows) {
  const saveNames = Object.keys(rows.find((r) => r.perSave && Object.keys(r.perSave).length)?.perSave ?? {})
  let out = '# L0 proof-net BLIND-SPOT CENSUS\n\n'
  out += 'Each row injects a REAL bug into the built bundle and re-runs the L0 differential over the whole\n'
  out += 'corpus. A cell is that run\'s divergence count. **0 = the net saw NOTHING.**\n\n'
  out += '> ⚠️ **A zero does NOT mean the code is safe — it means the NET IS BLIND there**, and a green\n'
  out += '> `baseline-zero` for that region is worth nothing. This is the opposite of the usual reading of a\n'
  out += '> green test, which is exactly why the blindness kept going unnoticed (#66, #98).\n\n'

  const w = Math.max(...rows.map((r) => r.name.length)) + 2
  out += '```text\n'
  out += 'mutation'.padEnd(w) + 'VERDICT  total   ' + saveNames.map((s) => s.padStart(13)).join('') + '\n'
  out += '-'.repeat(w + 17 + saveNames.length * 13) + '\n'
  for (const r of rows) {
    if (r.error) { out += r.name.padEnd(w) + 'ERROR    ' + String(r.error).slice(0, 60) + '\n'; continue }
    out += r.name.padEnd(w) +
      (r.total > 0 ? 'SEEN     ' : 'BLIND ⚠  ') +
      String(r.total).padStart(5) + '   ' +
      saveNames.map((s) => String(r.perSave[s]).padStart(13)).join('') + '\n'
  }
  out += '```\n'

  out += '\n## 🔴 Areas the gate CANNOT see\n\n'
  const blind = rows.filter((r) => !r.error && r.total === 0)
  if (!blind.length) out += 'None — every injected bug produced a divergence.\n'
  for (const r of blind) out += `- **${r.area}** \`${r.name}\` — ${r.why}\n`

  out += '\n## ✅ Areas the gate CAN see\n\n'
  for (const r of rows.filter((x) => !x.error && x.total > 0)) {
    const live = Object.entries(r.perSave).filter(([, n]) => n !== 0).map(([s]) => s)
    out += `- **${r.area}** \`${r.name}\` — ${r.total} divergences, on ${live.length}/${Object.keys(r.perSave).length} runs`
    out += live.length <= 2 ? ` (**only** ${live.join(', ')} — a single point of failure)\n` : '\n'
  }
  return out
}
