# L0 proof-net BLIND-SPOT CENSUS

Each row injects a REAL bug into the built bundle and re-runs the L0 differential over the whole
corpus. A cell is that run's divergence count. **0 = the net saw NOTHING.**

> ⚠️ **A zero does NOT mean the code is safe — it means the NET IS BLIND there**, and a green
> `baseline-zero` for that region is worth nothing. This is the opposite of the usual reading of a
> green test, which is exactly why the blindness kept going unnoticed (#66, #98).

> ⚠️ **STALE AS OF 2026-07-30 (#313): the table below predates two fixtures and two rows.** Regenerating
> it costs a full census (14 mutations x 23 fixtures), so it has not been re-run. What is missing, measured
> individually with `--mutation`:
>
> ```text
> mutation           VERDICT  total   15-geneticist-u1.1  16-amalg-u1.1  all 21 others
> ----------------   -------  -----   ------------------  -------------  -------------
> atga-noop          SEEN      6084          2862              3222            0
> atga-target-pin    SEEN      4020          2952              1068            0
> ```
>
> Both rows are also pinned as executable positive controls in `tests/sim/blind-spot-sensitivity.test.ts`,
> which runs in CI — so this document is the human-readable record, not the gate. If the two disagree,
> trust the test.

```text
mutation               VERDICT  total   01-early-u1.101-early-u1.201-early-u1.3  02-mid-u1.1  02-mid-u1.2  02-mid-u1.303-challenge-watch.103-challenge-watch.203-challenge-watch.304-u2-radon.1 05-maps-u1.1 06-deep-u1.1 06-deep-u1.2 06-deep-u1.307-map-cap-u1.108-starved-u1.108-starved-u1.209-housing-u2.1 10-hypo-u2.111-portal-u1.1 12-warp-u1.1
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
canary-buildings-noop  SEEN     14564              45           46           48          150          152          147           61           63           61            0           65         2000         1963         1902         2003         1872         1897            0            0           78         2011
damage-1e6             SEEN      3563               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0         1822         1741            0            0            0            0
health-1e6             SEEN     11491              25           18           21           84           81           88           29           28           30            0            3         1875         1895         1843         1734         1835         1902            0            0            0            0
housing-always-hut     SEEN      1228               0            0            0            0            0            0            0            0            0         1012            0            0            0            0            0            0            0           29          187            0            0
housing-hut-divisor    SEEN        13               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0           13            0            0            0
rhypo-invert           SEEN       331               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0          331            0            0
equipment-noop         SEEN     12943              26           18           20           95           92           87           28           27           30            0            9         1935         1782         1910         1938         1561         1410            0            0            0         1975
jobs-ratio-flip        SEEN     14689              52           54           54          115          113          122           62           63           65            0           57         2003         2045         2050         2006         1827         1923            0            0           71         2007
warpstation-noop       SEEN      1931               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0         1931
gem-housing-rank       SEEN      2007               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0         2007
portal-noop            SEEN       517               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0          517            0
gather-always-metal    SEEN     14586              38           39           41          104          101           97           47           46           48            0           53         2024         2042         2044         2027         1891         1865            0            0           71         2008
```

## 🔴 Areas the gate CANNOT see

None — every injected bug produced a divergence.

## ✅ Areas the gate CAN see

- **buildings** `canary-buildings-noop` — 14564 divergences, on 18/21 runs
- **combat (calcOurDmg)** `damage-1e6` — 3563 divergences, on 2/21 runs (**only** 08-starved-u1.1, 08-starved-u1.2 — a single point of failure)
- **combat (calcOurHealth)** `health-1e6` — 11491 divergences, on 16/21 runs
- **buildings (mostEfficientHousing)** `housing-always-hut` — 1228 divergences, on 3/21 runs
- **buildings (mostEfficientHousing)** `housing-hut-divisor` — 13 divergences, on 1/21 runs (**only** 09-housing-u2.1 — a single point of failure)
- **challenge (Hypothermia wood)** `rhypo-invert` — 331 divergences, on 1/21 runs (**only** 10-hypo-u2.1 — a single point of failure)
- **equipment (autoLevelEquipment)** `equipment-noop` — 12943 divergences, on 17/21 runs
- **jobs (workerRatios)** `jobs-ratio-flip` — 14689 divergences, on 18/21 runs
- **buildings (Warpstation, deep)** `warpstation-noop` — 1931 divergences, on 1/21 runs (**only** 12-warp-u1.1 — a single point of failure)
- **buildings (buyGemEfficientHousing ranking, deep)** `gem-housing-rank` — 2007 divergences, on 1/21 runs (**only** 12-warp-u1.1 — a single point of failure)
- **portal (autoPortal)** `portal-noop` — 517 divergences, on 1/21 runs (**only** 11-portal-u1.1 — a single point of failure)
- **gather (manualLabor2)** `gather-always-metal` — 14586 divergences, on 18/21 runs
