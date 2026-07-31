# ATGA: Auto — a derived breed timer instead of eleven tuned numbers

**Issue:** [#313](https://github.com/MattAltermatt/AutoTrimps/issues/313) · **Module:**
`src/modules/breedtimer.ts`

**Status:** **Part 1 SHIPPED 2026-07-30** (`8f0a36f0`, v6.0.0.159) as the `ATGAanticipation` setting,
default OFF — but *not* with the actuator this design assumed; see
[The actuator](#the-actuator-genesend--3-not-geneticists) and the resolution of model-limit #6. The
proof-net rig it depends on shipped first (`c078a229`). **Parts 2–4 are designed and unbuilt**: the
turn-based lifetime measurement, the Spire override, and once-per-window actuation. The eleven timer
settings are all still present and still default `-1`, so nothing has been migrated or retired yet.

Design reached by a four-agent panel (ground-truth, advocate, alternative-designer, adversary). Every
mechanical claim below was re-verified by hand against the clone at `../trimps-game` before being
written down; where a panel finding did not survive that check it is recorded as such rather than
dropped. Line references are `main.js` / `config.js` in the clone unless prefixed.

## 🎯 The problem

`ATGA2()` (`src/modules/breedtimer.ts:105-213`) hires and fires Geneticists to drive the army's breed
time to a target, and picks that target from a flat cascade of **eleven** user-set constants: base
timer, Before-Z + its timer, After-Z + its timer, Spire, Daily Spire, Daily, Hard Daily, C², Hard C²,
and Hard non-C². Each is a number the user must guess, and re-guess per run type.

Two facts frame the work:

- **Both shipped settings profiles in `src/modules/utils.ts` contain ZERO ATGA keys.** All eleven sit at
  their `-1` defaults, and `ATGA2timer > 0` gates the whole subsystem — so ATGA has never run for either
  reference config. The configuration burden is not hypothetical.
- **The servo itself is not AT's contribution.** `ATGA2()` and the game's own vanilla GA
  (`main.js:5707-5731`) are the same algorithm: same `thresh = totalTime × 0.02`, same `compareTime`
  branch, same `log10(target/compareTime)/log10(1.02)`, same ±10/tick clamp. AT's genuine delta is the
  configurable food cap (`ATGA2gen`) and the eleven contextual targets. **Choosing the number is the
  whole of AT's value here**, which is exactly what this design automates.

## 🔬 Verified mechanics

### Geneticists

`+1%` army health compounding and `−2%` breed potency compounding (`config.js:11922`, applied at
`main.js:11747` and `main.js:5636`). Breed time is inversely proportional to potency in the operating
regime, so each Geneticist multiplies breed time `B` by `1/0.98`:

> **health ∝ B^0.4925** — army health is the square root of breed time.

The exponent is `ln 1.01 / ln 1.020408`. The approximation needs `potencyMod − 1 ≪ 1`, which the servo
itself enforces (a 10 s target at a 30% send ratio gives `potencyMod ≈ 1.0036`, under 1% error). ⚠️ It
degrades below ~1 s targets and is wrong right after the z70 unlock at high Potency — see
[Known model limits](#known-model-limits).

### The health bonus is priced at the *window minimum*, and the window is the breed window

`game.global.lowestGen` is a running minimum of `game.jobs.Geneticist.owned`, sampled on every breed tick
(`main.js:5794-5795`), consumed once at army creation (`main.js:11747`), then reset to `-1`
(`main.js:11749`). `breed()` early-returns at full population (`main.js:5755`), so **the window is the
refill period, not the whole cycle**.

Three consequences, and they drive Part 4 of the design:

- **Hiring mid-window buys zero health that cycle** — the minimum is already pinned lower — while
  immediately paying the slower breed.
- **Firing mid-window pins the minimum down at once**, after the slow breed has already been paid for.
- A second gate can void the bonus entirely: `main.js:11746` requires `breedBack <= 0` (set to
  `currentSend / 2` at each dispatch, `main.js:11753`); when it fails, `lastLowGen = 0` and the army gets
  **no Geneticist health at all** (`main.js:11751`).

### Anticipation

`+2%` damage per perk level per second of stacks, 10 levels, `modifier: 0.02` (`config.js:2664-2668`),
applied at `main.js:12277`. Cap is **30, or 45 with the `patience` talent** (`main.js:11684`,
`config.js:2257`). Stack source branches (`main.js:11683`):

- **No Amalgamator** — `floor(lastBreedTime / 1000)`. `lastBreedTime` stops accruing once population is
  full (`main.js:5787` sits below the early return), so stacks **are** the breed timer `B`, independent
  of how long the fight lasts.
- **≥1 Amalgamator** — `floor((gameTime − lastSoldierSentAt) / 1000)`, i.e. the whole previous cycle.

### An army spans many cells and ends only by dying

`battle()` short-circuits to `startFight()` whenever `soldiers > 0` (`main.js:11123`), and a pending map
switch is gated on `soldiers === 0` (`main.js:11115`). So "fight duration" is per-**army**, not per-enemy,
and a healthy push makes it unbounded. AT also ends many of its own armies deliberately —
`forceAbandonTrimps()` (`breedtimer.ts:266-295`) calls `mapsClicked()` twice to kill the army so it can
enter maps, and `ForceAbandon` is `true` in both shipped profiles.

**Both problems are dissolved by measuring in turns rather than seconds** — see Part 2.

## 🧮 The derivation

Let `m = 0.02 × getPerkLevel('Anticipation')`, `cap = patience ? 45 : 30`, and let **β** be the elasticity
of army lifetime with respect to army health (`β = d ln T / d ln H`). Throughput is
`T · A(B) / max(B, T)` with `A(B) = 1 + m · min(B, cap)` and `T ∝ B^(β/2)`:

```text
d ln(rate) / d ln(B)  =  mB/(1+mB)  +  β/2  −  1
```

Push `B` past the fight duration iff `mB/(1+mB) > 1 − β/2`. Two regimes:

| regime | condition | optimal target |
| --- | --- | --- |
| **β = 1** — normal combat, lifetime scales with health | reduces to `B > 50/L`, below the cap for `L ≥ 2` | **the Anticipation cap** |
| **β = 0** — enemy drains a fraction of *max* health per turn | unsatisfiable | **the measured lifetime** |

Modelling throughput this way is legitimate here because `cell.health` persists across army deaths (the
win branch is the only reset path), so chip damage is never wasted. ⚠️ The `bloodthirst` daily is the
exception — it restores `cell.health = cell.maxHealth` on death (`main.js:15447-15451`).

**Independently re-derived** (z190, Anticipation 10, `B(G=0) = 0.15 s`, `T` calibrated at the `B = T`
fixed point):

```text
Anticipation cap 45              Anticipation cap 30
   B     A     rate                 B     A     rate
  ---   ----   -----               ---   ----   -----
   4     1.8   1.800                4     1.8   1.800   ← "B = T"
  30     7.0   2.561               30     7.0   2.561   ← peak
  45    10.0   2.987  ← peak       45     7.0   2.091
  60    10.0   2.587               60     7.0   1.811
```

**1.659× at cap 45, 1.423× at cap 30.** The load-bearing check is not the ratio but that **the peak moves
with the talent** — optimum at 45 when `patience` is bought and 30 when it is not, falling off
immediately past either. That is only true if Anticipation is what drives the result, so it tests the
mechanism rather than the arithmetic.

## 🏗️ The design

### Part 1 — default target is the Anticipation cap ✅ SHIPPED 2026-07-30 (`ATGAanticipation`)

```ts
const cap = game.talents.patience.purchased ? 45 : 30   // main.js:11684
```

A derived game constant, not a tuning number. This is the optimum whenever `β = 1`, which is ordinary
play.

> **⚠️ The target survived; the ACTUATOR did not.** This section originally assumed the only way to
> reach the cap was to hire Geneticists until breeding genuinely *takes* `cap` seconds. Measured at the
> depth Geneticists unlock, that costs ~389 of them against a food cap of 72 — see
> [Known model limits](#known-model-limits) #6. The game carries a second lever that writes the
> Anticipation clock directly, and it is the one that ships. See
> [The actuator](#the-actuator-genesend--3-not-geneticists) below, which replaces what used to be the
> "Fallback" section.

**Corollary worth stating because it is checkable:** with Anticipation at level 0, Geneticists have zero
throughput value — `rate ∝ √B / max(B, k√B)` is flat below `T` and declining above it. That is not a
coincidence. Anticipation unlocks by clearing Trapper (`config.js:3576`) and Geneticists unlock at world
70 (`config.js:11182`); they are co-designed. **The value of a Geneticist is converting hidden breed time
into Anticipation stacks; the health is a free rider.**

### Part 2 — where lifetime does not respond to health, measure it in TURNS

**The class is a mechanical census, not folk knowledge.** `soldierHealth -= game.global.soldierHealthMax *`
returns exactly six sites:

```text
main.js:16069  plague                    main.js:16146  Nom / Toxicity
main.js:16079  bogged                    main.js:16151  Lead
main.js:16094  Electricity / Mapocalypse main.js:16208  Storm (U2 — inert, Geneticist is blockU2)
```

The census must be **derived from the clone at test time**, never restated as a list here — a finding's
own scoping claim is a claim (#208/#238). Two discrepancies with the current cascade fall straight out:

- **Lead is missing entirely** from the eleven settings.
- `dhATGA2timer` buckets **pressure** with bogged and plague, but pressure is `soldierHealthMax *=`
  (`main.js:11842`) — a health *multiplier*, so `β = 1`. Recorded as a modelling discrepancy rather than
  a defect: the setting's own tooltip also says "or Dailies with heavy negative mods," which arguably
  covers it.

**Measure in turns.** `game.global.armyAttackCount` is reset at dispatch (`main.js:11668`) and incremented
once per surviving exchange (`main.js:16339`). An overkilled cell returns at `main.js:15770` — *before*
that increment. Therefore:

> **A steamrolling army contributes ZERO turns.** "The army that never dies" becomes **"no sample"**
> rather than an unbounded `T`. Pure-overkill cycles are discarded; the degeneracy disappears.

This is also what makes the eleven settings indefensible rather than merely inconvenient. The hard caps
are constants **in turns** — Electricity ≤5, Toxicity/Nom ≤20, plague ~13→4, bogged 100→20 — while
seconds-per-turn moves **6.31×** across a player's progression. Verified: the interval is
`1000 × 0.95^Agility − 100(hyperspeed) − 100(hyperspeed2 | fa)` (`main.js:11089-11100`,
`config.js:2886-2892`: modifier 0.05, max 20), i.e. 1000 ms base down to a 158.5 ms floor.

> The correct `chATGA2timer` for Electricity is 5 turns — **5.0 s for a fresh player and 0.79 s at max
> Agility.** A seconds constant is wrong across most of that range and must be re-tuned every time
> Agility is bought.

Precedent: `dATGA2Auto` (`breedtimer.ts:179-184`) already solves a quadratic for Bogged/Plague
attacks-to-live and converts turns → seconds with exactly the `main.js:11089-11100` interval expression.
This generalises that arm from *predicted* to *measured*.

**Sampling** (details to be fixed in the plan, not here): accumulate `max(turnsHeld, armyAttackCount)`
within a cycle; close the cycle on `game.global.lastSoldierSentAt` changing; discard the sample when
`turnsHeld === 0` (overkill) or when `lastLowGen === 0` with Geneticists owned (`breedBack` voided the
bonus, so the cycle is not representative). Windows are kept **separately for maps and world** — Obsidian
force-kills in world only (`main.js:15921`), `mapHealth` doubles health in maps (`main.js:11736`), and map
`difficulty` scales both enemy attack and health (`main.js:11415-11419`); a mixed window would take the
world minimum and under-hire through the 67–70% of a zone spent in maps.

⚠️ **Do not read cycle length as `T`.** When `B > T` the cycle *is* `B`, so a controller reading it would
consume its own output and diverge. The dead-state detector (`soldierHealth <= 0 && soldiers === 0`) is
not optional.

### Part 3 — the Spire keeps an override

Not subsumable. The verified reason is the death budget: `deadInSpire()` increments `game.global.spireDeaths`
and ejects at `>= 10` (`main.js:13741-13743`), so a controller that learns `T` by dying would spend its
entire run budget on measurement. `sATGA2timer` / `dsATGA2timer` stay.

⚠️ The panel also reported a per-cell attack ramp of `1.17^cell` inside a Spire against ~`1.30×` across an
entire normal zone, which would make a cell-*N* measurement worthless by cell *N+5*. **I could not confirm
those figures** — the only `1.17` in the combat path is `main.js:11467`, which is a different multiplier —
so they are recorded here as unverified and the design does not rest on them. Confirm or drop during
planning; the death-budget argument stands alone either way.

### Part 4 — actuate once per breed window

Latch on `game.global.lastSoldierSentAt` changing; compute one `genDif`; apply it in a single batch at the
window boundary; then freeze until the next boundary. Emergency *firing* stays legal mid-window — it lands
on the same `lowestGen` either way and speeds the remaining breed, so the permitted direction is
asymmetric because the mechanic is.

**Honest sizing:** with a *fixed* target this costs one transient cycle during ramp-up and then converges,
so it is a modest win on its own. It becomes load-bearing the moment the target tracks — which is what
Parts 1–3 introduce. It is therefore a **prerequisite**, not an independent headline.

Free side benefit: it makes `game.jobs.Geneticist.owned === game.global.lastLowGen` hold for the whole
window, which makes `calcOurHealth` (`calc.ts:114-117`) and `survive()` (`stance.ts:265-266`) agree.
`survive()` carries a `1.01^(owned − lastLowGen)` correction term that exists precisely because today's
per-tick drift makes them disagree.

### The actuator: `geneSend = 3`, not Geneticists

⚠️ **This section previously read "Fallback: `geneSend = 3`" and called the option "strictly worse than
hiring to the cap when food allows." That was wrong in both directions and is corrected here.** The
measurement is below; the original claim was reasoned from the option's own description rather than from
its code.

Three lines decide it, and the third is the one nobody reads:

```text
main.js:5759   at FULL POPULATION, breed() runs
                 if (geneSend.enabled === 3 && lastBreedTime/1000 < GeneticistassistSetting)
                     lastBreedTime += 100
               ← no test of Geneticist.owned anywhere in this branch
main.js:11683  antiStacks = floor(lastBreedTime / 1000)      (no-Amalgamator arm)
main.js:11137  gensUp = (GeneticistassistSetting > 0 && Geneticist.owned > 0)
main.js:11147  the send is blocked only when enabled === 3 && gensUp
```

So the **clock pad** and the **send block** have different preconditions. Geneticists stretch breed
time; `geneSend = 3` writes the Anticipation clock itself. The cap is therefore reachable at *every*
depth, for no food — and the `1.01^N` health is not forfeited at all, because ATGA can still hire on top
up to its own food cap.

**Measured**, 8000 ticks, AT driving, both world-71 fixtures, `anti` = mean `antiStacks`
(control = neither lever; ATGA = `ATGA2timer 30`, `ATGA2gen 100`):

```text
15-geneticist-u1 (no Amalgamator)      world  anti   gens   food
-------------------------------------  -----  -----  -----  --------
control                                   76    0.0      0   4.76e16
ATGA only (the assumed actuator)          76    0.2    125   2.69e16
geneSend=3 only                           80   28.1      0   2.42e17
ATGA + geneSend=3                         80   27.0    174   3.37e16

16-amalg-u1 (Amalgamator)              world  anti   gens   food
-------------------------------------  -----  -----  -----  --------
control                                   78    0.9      0   6.37e16
ATGA only (the assumed actuator)          78    1.0    180   1.60e17
geneSend=3 only                           81   28.0      0   2.84e17
ATGA + geneSend=3                         82   27.3    225   1.84e17
```

Two readings, both reproducing across the independent fixtures. **Today's ATGA is a no-op on zone
progress at this depth** — 76 == 76 and 78 == 78 against the control — while spending the food economy
on 125–180 Geneticists. And the actuator that was filed as a fallback is worth **+4 / +3 zones**.

Sanity: the sim's breed clock tracks `game.global.time` at ratio **1.000** (`speed = 10`; the driver
advances 100 ms per tick and `breed()` adds 100 ms per `gameLoop`), so these stack counts are
browser-equivalent rather than a harness artifact. Single seed per fixture — the ±1-zone differences
between the two geneSend rows are inside noise; the 4-zone gap over the control is not.

**One honest caveat, and it is the user's call rather than the implementer's.** The zero-Geneticist path
looks like an upstream quirk: the option is named *Wait For Gene Send*, its description says "as long as
you have one Geneticist" twice, and that gate is real for the *wait* — but not for the *pad*. Getting
stacks with no Geneticists and no idle is not behaviour the option documents.

**Shipped as** `ATGAanticipation` ("ATGA: Anticipation"), boolean, **default OFF**, independent of the
`ATGA2` master switch and of the `ATGA2timer > 0` gate. It captures and restores both game-owned values
(`geneSend.enabled`, `GeneticistassistSetting`) on the `#113` pattern — module-scope latch, `null` means
nothing captured, and it refuses to restore over a value the player changed themselves. It stands down
from the timer while `spirebreeding` is true so it and `ATspirebreed()` never fight over one global.

## 🚧 Scope

**In:** Parts 1–4 above, plus a new mode on the existing `dATGA2Auto`-style multitoggle so the behaviour
is opt-in and default-OFF.

**Out:** re-tuning any existing default; U2/radon (Geneticist is `blockU2`, `config.js:11920`); the
Toxicity loot objective (its `0.15%`-per-stack loot multiplier, `config.js:3826`, rewards attacking more
rather than clearing faster — a third objective this model does not carry).

**Settings disposition.** The eleven ids are **hidden and migrated, never deleted and never re-minted**.
`createSetting` applies a default only when nothing is stored, and `serializeSettings` round-trips unknown
keys forever, so re-minting a retired id resurrects a veteran's years-old localStorage value (#68–#74).
Use the `settings-migrations.ts` id-migration mechanism (#151), which deletes the old key as it moves the
value, so the trigger is a key a migrated store no longer has (#194).

## 🧪 Verification

**The rig is a prerequisite and it does not exist.** All 15 corpus fixtures have `Geneticist.locked = 1`;
the deepest is `12-warp-u1` at world 62 against a world-70 unlock, and every one has
`Amalgamator.owned = 0`. `ATGA2()`'s outer guard is false in **15/15** — the subsystem is structurally
unreachable in L0, so `baseline-zero` is not evidence about any of it. A z70+ fixture with Geneticists
unlocked, plus an Amalgamator variant (the fork the stack formula turns on), is required before any
measured claim here can be believed.

**Falsifiers, each stated so it can fail:**

- In Electricity / Toxicity / Nom / bogged, the controller converges to 5 / 20 / 20 / (20–100) turns within
  one or two deaths and beats the hand-set constant. If it does not converge *in turns*, the turn-based
  premise is wrong.
- **Predicted to fail:** in a health-responsive zone with `T < cap`, a measure-only controller loses
  ~30–40% against the flat cap. If it does *not* lose, the throughput model is wrong and Part 1's floor
  should be dropped.
- **Predicted worse:** Spire without the override. If it is not worse, Part 3 can go.

**Sensitivity, not reach.** Verify by mutation — pin the target to a constant and confirm the corpus
reddens. Confirm first that L0 can observe `ATGA2()` at all; the `guiLoop` precedent (`setInterval` stubbed
dead in `scripts/sim/boot.mjs`) is exactly the shape of a gate that reports success while seeing nothing.

**This will move traces**, so it forces an oracle re-pin from `oracle/v5-post-review-campaign`. Count by
event via `scripts/sim/event-diff.mjs`, never by index, and ledger the rationale in the trace manifest.

## ⚠️ Known model limits

Recorded because a design that hides its assumptions cannot be falsified.

1. **`β = 1` assumes damage-per-hit is health-independent.** With block in play (`stance.ts:185`,
   `max(atk − block, pierce·atk)`) lifetime is *super*-linear in health near the block threshold, so
   `β > 1` and the rule under-hires. Conservative direction, still wrong.
2. **`H ∝ √B` is asymptotic.** Solve the target numerically against the real `potencyMod` already computed
   at `breedtimer.ts:110-137` rather than against the closed form. Cheap, and it must be done.
3. **`β` is a whitelist.** Grep-derivable today, but a new challenge or an upstream clone bump can add a
   member silently. Mechanising the census against the clone's source is the mitigation, not a claim of
   safety.
4. **Under-hiring interacts with AT's own decision layer.** `enoughHealth` is gated on
   `calcOurHealth()/FORMATION_MOD_1 > 8 × perHitDamage` (`maps.ts:474`), and a second, disagreeing copy
   uses 10 (`equipment.ts:395`). Hiring fewer Geneticists than a lifetime-chasing controller could flip AT
   from pushing to farming. **This is the first thing to test.**
5. **Part 3's Spire arm is asserted, not derived.** The objective demonstrably changes (deaths are the
   budget) but the optimum was not solved. So "eleven → one" is honestly "eleven → one + a Spire arm".
6. **🆕 Part 1's cap target is DEPTH-GATED — measured 2026-07-30 while building the rig, then
   re-derived after a broken probe forced a recheck.** On a real played-forward world-71 save the base
   breed time is **0.0138 s** (measured, with zero Geneticists). Geneticists cost `1e15 × 1.03^N`
   (`config.js:11932`), compounding, and the save holds **3.06e15** food — so ATGA food-caps at **72**
   Geneticists, where the next one costs 8.40e15. That yields a breed time of 0.0574 s and
   `antiStacks = 0` (measured directly from game state, not inferred).

   Reaching the Anticipation cap needs **N = 389** for 30 s, or **409** for 45 s — at which point a
   single Geneticist costs ~1e20 food. So where Geneticists first unlock, the cap is not merely
   suboptimal, it is **unreachable by two orders of magnitude**, and a controller targeting it would hire
   until food-capped and sit there. The panel's worked scenarios were all z190.

   ⚠️ An earlier version of this entry said 267 Geneticists, from a 0.15 s base breed time carried over
   from the panel's z190 scenario and never measured at this depth. The corrected figure makes the gate
   *worse*, not better. Either the controller states the depth gate as designed behaviour, or Part 1
   needs a floor that degrades gracefully when the cap cannot be paid for.

   ✅ **RESOLVED 2026-07-30 — it was neither.** Both of those dispositions accepted the premise that
   Geneticists are the only way to reach the cap, and that premise was never checked; it was inherited
   from the panel's scenarios along with the arithmetic. `geneSend = 3` writes the Anticipation clock
   directly and never consults `Geneticist.owned` (`main.js:5759`), so the target is reachable at every
   depth and the gate does not exist. See [The actuator](#the-actuator-genesend--3-not-geneticists).

   **The transferable lesson is about the shape of the error, not the mechanic.** A measurement can be
   entirely correct and still answer the wrong question, and it is at its most convincing exactly then —
   389-against-72 is a real number, re-derived after a first attempt got it wrong, and it made a false
   conclusion look thoroughly evidenced. What made it wrong was the unstated quantifier: it measured
   *one* actuator and was written up as a property of the *target*. Before accepting "X is unreachable,"
   enumerate the ways to reach X from the game's source; a limit measured on a single lever is a fact
   about that lever.
