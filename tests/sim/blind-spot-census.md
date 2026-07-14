# L0 proof-net BLIND-SPOT CENSUS

Each row injects a REAL bug into the built bundle and re-runs the L0 differential over the whole
corpus. A cell is that run's divergence count. **0 = the net saw NOTHING.**

> ⚠️ **A zero does NOT mean the code is safe — it means the NET IS BLIND there**, and a green
> `baseline-zero` for that region is worth nothing. This is the opposite of the usual reading of a
> green test, which is exactly why the blindness kept going unnoticed (#66, #98).

```text
mutation               VERDICT  total   01-early-u1.101-early-u1.201-early-u1.3  02-mid-u1.1  02-mid-u1.2  02-mid-u1.303-challenge-watch.103-challenge-watch.203-challenge-watch.304-u2-radon.1 05-maps-u1.1 06-deep-u1.1 06-deep-u1.2 06-deep-u1.307-map-cap-u1.108-starved-u1.108-starved-u1.2
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
canary-buildings-noop  SEEN     12009              32           32           32           96           94           95           29           29           29            0           27         1924         2033         1964         1927         1840         1826
damage-1e6             SEEN      3917               0            0            0            0            0            0            0            0            0            0            0            0          420            8            0         1813         1676
health-1e6             SEEN     11331              15           11           11           55           58           63            7            7           10            0            3         1824         1887         1867         1827         1855         1831
housing-always-hut     SEEN      1012               0            0            0            0            0            0            0            0            0         1012            0            0            0            0            0            0            0
housing-hut-divisor    BLIND ⚠      0               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0
rhypo-invert           BLIND ⚠      0               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0
equipment-noop         SEEN     10619              14           11           11           63           67           62            7            7           10            0            5         1893         1897         1879         1896         1432         1365
jobs-ratio-flip        SEEN     12272              42           42           42           86           83           91           40           40           40            0           24         1990         2020         2034         1993         1860         1845
```

## 🔴 Areas the gate CANNOT see

- **buildings (mostEfficientHousing)** `housing-hut-divisor` — #93's ACTUAL bug, restored verbatim: score every housing type by the Hut's increase.by. The proxy above (always return Hut) is a cruder break — this is the real one, and the difference between the two rows is the difference between REACH and SENSITIVITY.
- **challenge (Hypothermia wood)** `rhypo-invert` — #101's bug restored: conserve wood only AFTER exceeding the bonfire goal, instead of until it is achieved.

## ✅ Areas the gate CAN see

- **buildings** `canary-buildings-noop` — 12009 divergences, on 16/17 runs
- **combat (calcOurDmg)** `damage-1e6` — 3917 divergences, on 4/17 runs
- **combat (calcOurHealth)** `health-1e6` — 11331 divergences, on 16/17 runs
- **buildings (mostEfficientHousing)** `housing-always-hut` — 1012 divergences, on 1/17 runs (**only** 04-u2-radon.1 — a single point of failure)
- **equipment (autoLevelEquipment)** `equipment-noop` — 10619 divergences, on 16/17 runs
- **jobs (workerRatios)** `jobs-ratio-flip` — 12272 divergences, on 16/17 runs
