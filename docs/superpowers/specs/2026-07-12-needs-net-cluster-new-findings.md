# New findings from the `needs-net` cluster (#68–#74, #88)

Found while fixing the cluster, **not fixed here**. Each needs its own issue. Filing is pending the
maintainer's approval (GitHub writes are gated).

---

## 1. 🎚️ TUNING-GATED — `mostEfficientHousing` scores every housing type with `Hut.increase.by`

`src/modules/buildings.ts:496-500`:

```js
let housingBonus = game.buildings.Hut.increase.by;   // <-- Hut. Always Hut.
if (!game.buildings.Hub.locked) { housingBonus += 500; }
worstTime = Math.max(baseCost * Math.pow(costScaling, currentOwned - 1) / (avgProduction * housingBonus), worstTime);
```

The divisor is `Hut.increase.by` for **every** housing type, so it is constant across the loop and
**cancels out of the comparison entirely**. The "efficiency" metric degenerates to plain time-to-afford,
and AT always buys the cheapest building.

Measured `increase.by`: `Hut 3 · House 5 · Mansion 10 · Hotel 20 · Resort 40 · Gateway 100 · Collector 5000`.
The model scores a **Collector (+5000 pop) as if it granted 3.** Measured `worstTime` with everything
unlocked: `Hut 127 · House 32 · Resort 5,747 · Collector 148,809,523,809` ⇒ **AT would functionally never
buy a Collector or Resort.**

The sibling `RbuyGemEfficientHousing` (`buildings.ts:442`) gets it right: `cost / building.increase.by`.
Fix is `game.buildings[housing].increase.by` — but it **changes which buildings AT buys**, so it is a
balance change and needs an explicit gate. Not a blocker for #69 ship C: a suboptimal housing model still
beats today's *zero* housing.

## 2. `RbuyBuildings` bypasses the Purchase Coordinator (#57) entirely

It makes **6 direct native `buyBuilding()` calls** and never routes through `safeBuyBuilding` → so
`coordinatorAllows` never sees them. It also never calls `preBuy2()`/`postBuy2()`, so unlike every other
AT buy path it does not save/restore the player's `buyAmt`. Harmless today (`PurchaseCoordinator` defaults
to a real `false`), but it is a coverage gap in #57's reservation guard that will bite when the coordinator
is turned on.

## 3. `for (const house **in** HousingTypes)` → 7 phantom settings, result never read

`buildings.ts:645-646`. `for..in` over an array yields index *strings*, so it calls
`getPageSetting('RMax0'..'RMax6')` — seven ids that do not exist, all returning `false`. The resulting
`housingTargets` array is then **never read**. Dead code — but a signature of never-executed code: the
identical loop 170 lines above (`mostEfficientHousing`, `:473`) correctly uses `of`.

## 4. `Rhypofarmstack` default is the string `'undefined'` → `[NaN × 9]`

`settings-defs.ts:660` declares it `multiValue` with the default **string `'undefined'`**, so
`getPageSetting` does `Array.from('undefined').map(parseInt)` → a **9-element `[NaN,…]` array**. Proven:
`targetprice` computes to `NaN`, `NaN >= 1e10` is false, so the Hypothermia Shed branch
(`buildings.ts:606`) is silently dead. Also consumed by `mapfunctions.ts:1288`. Same "sentinel typed as a
string" mistake as #69, in a different type arm.

## 5. 🆕 `Rdheirloomswap` is cross-wired — daily gates, non-daily equips

It **gates** on the daily ids (`Rdhsmapstaff` / `Rdhstributestaff` / `Rdhsz`) but then calls the
**non-daily** equip functions (`Rhsmapstaffequip`, `Rhstributestaffequip`, `Rhsequip1/2`), which resolve
the heirloom by the **non-daily** ids.

The five correct daily twins — `Rdhsequip1`, `Rdhsequip2`, `Rdhsworldstaffequip`, `Rdhsmapstaffequip`,
`Rdhstributestaffequip` — **exist, are fully written, read the daily ids correctly, and have ZERO callers.**

Net effect: a Daily player's daily staff names act only as on/off gates; the heirloom actually equipped is
whatever their *non-daily* config names. Reproducing test is already committed (a `FINDING (unfiled)`
describe block) so it cannot be fixed silently. The fix is a five-line re-point.

## 6. The corpus is far shallower than its filenames suggest — sharpens #90

Every corpus save decodes to **HZE = 3 / world = 4**, including `02-mid-u1`. Combined with the recorder
only emitting `buyJob`/`buyBuilding`/`buyEquipment`/`buyUpgrade` (#90), this means large parts of the
codebase are **structurally unreachable by the L0 net**, not merely uncovered.

Demonstrated, not argued: with a fix applied to `calcOurDmg`'s Anticipation arm, injecting a
**1,000,000× damage multiplier** still passes the entire sim suite **green**. Independently reproduced by
two agents.

**Consequence for every future change:** "I shipped it and the proof net stayed green" is a *meaningless*
sentence for anything touching combat math, mapping, or a zone-gated path. Run the positive control first;
if the net cannot see your change, go build the evidence by hand.

## 7. Test-harness lies of the #74 class, found and fixed in passing

- `maps.characterization.test.ts` **minted the nonexistent element `advExtraMapLevelselect`** in its own
  DOM fixture — which is exactly why #73 tested green for eight years. The fixture now builds the real
  `advExtraLevelSelect` with the game's real option list.
- `other.rarmormagic.test.ts` injected `MODULES.maps.RenoughDamageCutoff`, a field production never writes.
- `other.rbuyArms.test.ts` seeded the phantom `RCapEquiparm` and its comment called it "a real setting".

All three are now caught mechanically: `tests/nets/modules-fields.test.ts` and
`tests/nets/settings-reverse.test.ts` fail on any fixture that seeds state production cannot produce.
