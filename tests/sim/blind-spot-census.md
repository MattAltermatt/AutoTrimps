# L0 proof-net BLIND-SPOT CENSUS

Each row injects a REAL bug into the built bundle and re-runs the L0 differential over the whole
corpus. A cell is that run's divergence count. **0 = the net saw NOTHING.**

> ⚠️ **A zero does NOT mean the code is safe — it means the NET IS BLIND there**, and a green
> `baseline-zero` for that region is worth nothing. This is the opposite of the usual reading of a
> green test, which is exactly why the blindness kept going unnoticed (#66, #98).

```text
mutation               VERDICT  total   01-early-u1.101-early-u1.201-early-u1.3  02-mid-u1.1  02-mid-u1.2  02-mid-u1.303-challenge-watch.103-challenge-watch.203-challenge-watch.304-u2-radon.1 05-maps-u1.1 06-deep-u1.1 06-deep-u1.2 06-deep-u1.307-map-cap-u1.108-starved-u1.108-starved-u1.209-housing-u2.1 10-hypo-u2.111-portal-u1.1 12-warp-u1.1
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
canary-buildings-noop  SEEN     13850              32           32           32           96           94           95           29           29           29            0           27         1924         2033         1964         1927         1840         1826            0            0           64         1777
damage-1e6             SEEN      5601               0            0            0            0            0            0            0            0            0            0            0            0          420            8            0         1813         1676            0            0            0         1684
health-1e6             SEEN     11331              15           11           11           55           58           63            7            7           10            0            3         1824         1887         1867         1827         1855         1831            0            0            0            0
housing-always-hut     SEEN      1071               0            0            0            0            0            0            0            0            0         1012            0            0            0            0            0            0            0           24           35            0            0
housing-hut-divisor    SEEN        13               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0           13            0            0            0
rhypo-invert           SEEN        19               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0           19            0            0
equipment-noop         SEEN     12373              14           11           11           63           67           62            7            7           10            0            5         1893         1897         1879         1896         1432         1365            0            0            0         1754
jobs-ratio-flip        SEEN     14154              42           42           42           86           83           91           40           40           40            0           24         1990         2020         2034         1993         1860         1845            0            0           58         1824
warpstation-noop       SEEN      1722               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0         1722
gem-housing-rank       SEEN      1774               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0         1774
portal-noop            SEEN       510               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0          510            0
```

## 🔴 Areas the gate CANNOT see

None — every injected bug produced a divergence.

## ✅ Areas the gate CAN see

- **buildings** `canary-buildings-noop` — 13850 divergences, on 18/21 runs
- **combat (calcOurDmg)** `damage-1e6` — 5601 divergences, on 5/21 runs
- **combat (calcOurHealth)** `health-1e6` — 11331 divergences, on 16/21 runs
- **buildings (mostEfficientHousing)** `housing-always-hut` — 1071 divergences, on 3/21 runs
- **buildings (mostEfficientHousing)** `housing-hut-divisor` — 13 divergences, on 1/21 runs (**only** 09-housing-u2.1 — a single point of failure)
- **challenge (Hypothermia wood)** `rhypo-invert` — 19 divergences, on 1/21 runs (**only** 10-hypo-u2.1 — a single point of failure)
- **equipment (autoLevelEquipment)** `equipment-noop` — 12373 divergences, on 17/21 runs
- **jobs (workerRatios)** `jobs-ratio-flip` — 14154 divergences, on 18/21 runs
- **buildings (Warpstation, deep)** `warpstation-noop` — 1722 divergences, on 1/21 runs (**only** 12-warp-u1.1 — a single point of failure)
- **buildings (buyGemEfficientHousing ranking, deep)** `gem-housing-rank` — 1774 divergences, on 1/21 runs (**only** 12-warp-u1.1 — a single point of failure)
- **portal (autoPortal)** `portal-noop` — 510 divergences, on 1/21 runs (**only** 11-portal-u1.1 — a single point of failure)
