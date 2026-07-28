# L0 proof-net BLIND-SPOT CENSUS

Each row injects a REAL bug into the built bundle and re-runs the L0 differential over the whole
corpus. A cell is that run's divergence count. **0 = the net saw NOTHING.**

> ⚠️ **A zero does NOT mean the code is safe — it means the NET IS BLIND there**, and a green
> `baseline-zero` for that region is worth nothing. This is the opposite of the usual reading of a
> green test, which is exactly why the blindness kept going unnoticed (#66, #98).

```text
mutation               VERDICT  total   01-early-u1.101-early-u1.201-early-u1.3  02-mid-u1.1  02-mid-u1.2  02-mid-u1.303-challenge-watch.103-challenge-watch.203-challenge-watch.304-u2-radon.1 05-maps-u1.1 06-deep-u1.1 06-deep-u1.2 06-deep-u1.307-map-cap-u1.108-starved-u1.108-starved-u1.209-housing-u2.1 10-hypo-u2.111-portal-u1.1 12-warp-u1.1
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
canary-buildings-noop  SEEN     14609              45           47           47          152          151          154           61           63           62            0           65         1998         1995         1946         2001         1878         1866            0            0           78         2000
damage-1e6             SEEN      6297               0            0            0            0            0            0            0            0            0            0            0            0          719            8            0         1851         1728            0            0            0         1991
health-1e6             SEEN     11634              25           16           17           84           81           88           29           28           31            0            3         1862         1907         1865         1834         1893         1871            0            0            0            0
housing-always-hut     SEEN      1081               0            0            0            0            0            0            0            0            0         1012            0            0            0            0            0            0            0           29           40            0            0
housing-hut-divisor    SEEN        13               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0           13            0            0            0
rhypo-invert           SEEN        19               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0           19            0            0
equipment-noop         SEEN     12856              26           19           20           95           92           87           28           27           31            0            9         1935         1831         1929         1938         1441         1375            0            0            0         1973
jobs-ratio-flip        SEEN     14616              51           53           53          115          113          122           63           64           66            0           57         1960         2049         2061         1963         1900         1880            0            0           71         1975
warpstation-noop       SEEN      1921               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0         1921
gem-housing-rank       SEEN      1995               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0         1995
portal-noop            SEEN       517               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0          517            0
gather-always-metal    SEEN     14661              38           38           40          104          101           97           48           45           49            0           53         2035         2055         2053         2038         1905         1894            0            0           71         1997
```

## 🔴 Areas the gate CANNOT see

None — every injected bug produced a divergence.

## ✅ Areas the gate CAN see

- **buildings** `canary-buildings-noop` — 14609 divergences, on 18/21 runs
- **combat (calcOurDmg)** `damage-1e6` — 6297 divergences, on 5/21 runs
- **combat (calcOurHealth)** `health-1e6` — 11634 divergences, on 16/21 runs
- **buildings (mostEfficientHousing)** `housing-always-hut` — 1081 divergences, on 3/21 runs
- **buildings (mostEfficientHousing)** `housing-hut-divisor` — 13 divergences, on 1/21 runs (**only** 09-housing-u2.1 — a single point of failure)
- **challenge (Hypothermia wood)** `rhypo-invert` — 19 divergences, on 1/21 runs (**only** 10-hypo-u2.1 — a single point of failure)
- **equipment (autoLevelEquipment)** `equipment-noop` — 12856 divergences, on 17/21 runs
- **jobs (workerRatios)** `jobs-ratio-flip` — 14616 divergences, on 18/21 runs
- **buildings (Warpstation, deep)** `warpstation-noop` — 1921 divergences, on 1/21 runs (**only** 12-warp-u1.1 — a single point of failure)
- **buildings (buyGemEfficientHousing ranking, deep)** `gem-housing-rank` — 1995 divergences, on 1/21 runs (**only** 12-warp-u1.1 — a single point of failure)
- **portal (autoPortal)** `portal-noop` — 517 divergences, on 1/21 runs (**only** 11-portal-u1.1 — a single point of failure)
- **gather (manualLabor2)** `gather-always-metal` — 14661 divergences, on 18/21 runs
