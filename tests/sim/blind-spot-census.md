# L0 proof-net BLIND-SPOT CENSUS

Each row injects a REAL bug into the built bundle and re-runs the L0 differential over the whole
corpus. A cell is that run's divergence count. **0 = the net saw NOTHING.**

> ⚠️ **A zero does NOT mean the code is safe — it means the NET IS BLIND there**, and a green
> `baseline-zero` for that region is worth nothing. This is the opposite of the usual reading of a
> green test, which is exactly why the blindness kept going unnoticed (#66, #98).

```text
mutation               VERDICT  total   01-early-u1.101-early-u1.201-early-u1.3  02-mid-u1.1  02-mid-u1.2  02-mid-u1.303-challenge-watch.103-challenge-watch.203-challenge-watch.304-u2-radon.1 05-maps-u1.1 06-deep-u1.1 06-deep-u1.2 06-deep-u1.307-map-cap-u1.108-starved-u1.108-starved-u1.2
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
canary-buildings-noop  SEEN     10790              32           32           32           94           94           96           29           29           29            0           19         1765         1737         1717         1768         1634         1683
damage-1e6             SEEN      2990               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0         1542         1448
health-1e6             SEEN      9688              12            7            7           44           43           62            3            5            8            0            0         1600         1562         1534         1603         1584         1614
housing-always-hut     SEEN       592               0            0            0            0            0            0            0            0            0          592            0            0            0            0            0            0            0
housing-hut-divisor    BLIND ⚠      0               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0
rhypo-invert           BLIND ⚠      0               0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0            0
equipment-noop         SEEN      1997              12            9            9           73           76           78            7            6            9            0            0            0            0            0            0          859          859
jobs-ratio-flip        SEEN     10715              42           45           42           85           85           91           39           39           39            0           16         1760         1732         1674         1763         1627         1636
```

## 🔴 Areas the gate CANNOT see

- **buildings (mostEfficientHousing)** `housing-hut-divisor` — #93's ACTUAL bug, restored verbatim: score every housing type by the Hut's increase.by. The proxy above (always return Hut) is a cruder break — this is the real one, and the difference between the two rows is the difference between REACH and SENSITIVITY.
- **challenge (Hypothermia wood)** `rhypo-invert` — #101's bug restored: conserve wood only AFTER exceeding the bonfire goal, instead of until it is achieved.

## ✅ Areas the gate CAN see

- **buildings** `canary-buildings-noop` — 10790 divergences, on 16/17 runs
- **combat (calcOurDmg)** `damage-1e6` — 2990 divergences, on 2/17 runs (**only** 08-starved-u1.1, 08-starved-u1.2 — a single point of failure)
- **combat (calcOurHealth)** `health-1e6` — 9688 divergences, on 15/17 runs
- **buildings (mostEfficientHousing)** `housing-always-hut` — 592 divergences, on 1/17 runs (**only** 04-u2-radon.1 — a single point of failure)
- **equipment (autoLevelEquipment)** `equipment-noop` — 1997 divergences, on 11/17 runs
- **jobs (workerRatios)** `jobs-ratio-flip` — 10715 divergences, on 16/17 runs

## Removed rows

**`coordinator-deny-all` (removed 2026-07-13 with #57).** It was false comfort, and it is worth saying why.
The mutation spliced `return false` in *ahead* of the `active` check, so it fired **even with the
coordinator setting OFF** — which means its 11,156 divergences proved only that *building buys* are
visible to the net, never that the *coordinator's own logic* was. The coordinator hardcoded Warpstation,
a `world: 60` unlock, and every corpus save is world 4-6: with `PurchaseCoordinator` forced ON across the
whole corpus, `topTarget` was null on 100% of ticks and the ON/OFF trace differential was **0**. A row
that reports SEEN for a feature the net cannot see is exactly the reach-vs-sensitivity trap this file
exists to teach — and this file was carrying one.
