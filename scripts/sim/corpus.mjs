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
const DEFAULT = { seeds: [1, 2, 3], ticks: 1500 }

export const CORPUS = [
  { name: '01-early-u1', ...DEFAULT },
  { name: '02-mid-u1', ...DEFAULT },
  { name: '03-challenge-watch', ...DEFAULT },
  { name: '04-u2-radon', seeds: [1], ticks: 300 },
]
