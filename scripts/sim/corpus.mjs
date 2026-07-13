// Single source of truth for the proof-net save corpus: for each committed save fixture, how many
// seeds and how many ticks the oracle trace was recorded with. record-oracle.mjs (writes the goldens),
// the differential gate test (checks the working build against them), and make-fixtures.mjs (generates
// the saves) all read this table so the three never drift apart.
//
// Per-save overrides exist because the states are not uniform:
//   - The U1 saves (01/02/03) run combat, so distinct seeds pin distinct RNG-timing paths — 3 seeds
//     each broadens branch coverage over the ~41 unseeded combat Math.random sites (#47).
//   - 04-u2-radon is a field-poked U2 state on a shallow (z4) base. Its behavior is dominated by
//     RbuyJobs calling buyJob for the four base jobs every tick (a buy-Max no-op top-up, seed-
//     insensitive), so it is recorded at ONE seed and a SHORT window: enough to arm + guard the U2
//     RbuyJobs call-sequence (the only fixture that reaches RbuyJobs at all — the U1 corpus never
//     does), without committing ~1 MB of repetitive no-op JSON. Deeper U2 gear/map coverage needs
//     real long-progression (jsdom can't cheaply reach it) and is where #58's live U2 drive comes in.
//   - 05-maps-u1 is the honest play-forward to the first `mapsUnlocked` state. AT is damage-walled
//     inside a map there, so its live behavior is a quiet, seed-insensitive buy loop — one seed, like
//     04. Its job is not a rich trace; its job is to be the one fixture where maps.ts:253 evaluates
//     calcOurDmg instead of short-circuiting past it.
//   - 06-deep-u1 is the fixture that actually watches the bot (#90/#98): a post-portal state where AT
//     sets formations every tick, buys/selects/runs maps at each zone transition, and ADVANCES. Three
//     seeds, because every one of those decisions is combat-RNG-timed, and a 2000-tick window because
//     the map events are the rare, valuable ones (~4 per 2000 ticks vs ~1800 setFormation).
//   - 07-map-cap-u1 sits AT the game's 100-map cap, the sole gate behind every recycleBelow/recycleMap
//     callsite in AT (buyMap() == -2, main.js:6597). One seed: the branch is a deterministic recovery
//     sequence (buyMap -> recycleBelow -> buyMap -> recycleMap -> buyMap), not an RNG-timed decision.
//   - 08-starved-u1 is the DAMAGE-SENSITIVITY fixture, and it is the one that makes a combat regression
//     visible at all. AT's damage decisions are threshold predicates; on every other save they are
//     SATURATED (enoughDamage is already true), so even a 1,000,000x damage buff moves nothing. 08 is
//     starved-but-perked, so the threshold sits UNSATURATED and calcOurDmg's output is load-bearing.
//     Two seeds — its trace is combat-RNG-timed, and this is the fixture where that timing matters most.
//
// `settings` (optional, #105): AT settings to seed for a fixture, via bootGame's atSettings hook.
// Until that hook existed the net could only ever run AT on FACTORY DEFAULTS — loadPageVariables()
// reads localStorage, and jsdom's is empty — so every recorded trace was of a default-configured bot,
// and any behaviour behind a non-default setting was untestable by construction. No fixture uses it
// yet; the two that need it (Hypothermia, deep-housing) are both U2-only and are deferred with #105.
const DEFAULT = { seeds: [1, 2, 3], ticks: 1500 }

/**
 * @type {{ name: string, seeds: number[], ticks: number, settings?: Record<string, unknown> }[]}
 */
export const CORPUS = [
  { name: '01-early-u1', ...DEFAULT },
  { name: '02-mid-u1', ...DEFAULT },
  { name: '03-challenge-watch', ...DEFAULT },
  { name: '04-u2-radon', seeds: [1], ticks: 300 },
  { name: '05-maps-u1', seeds: [1], ticks: 1500 },
  { name: '06-deep-u1', seeds: [1, 2, 3], ticks: 2000 },
  { name: '07-map-cap-u1', seeds: [1], ticks: 2000 },
  { name: '08-starved-u1', seeds: [1, 2], ticks: 2000 },
]
