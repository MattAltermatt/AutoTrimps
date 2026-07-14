# Settings tooltips: composed records, not prose blobs (#107)

**Status:** design · 2026-07-13 · supersedes the "just rewrite the wrong ones" reading of #107

## The problem is drift, not wording

#107 opens with four bad tooltips. The interesting fact is *how* they went bad: nobody
re-read the code they described. `BuyJobsNew`'s tooltip is wrong in six independent ways —

```text
tooltip claims               code (jobs.ts:10-21, 323-346)
---------------------------  ------------------------------------------
1/1/1   up to 300k trimps    autoRatio1 = [1.1, 1.15, 1.2]   (default tier)
3/3/5   up to 3mil           autoRatio2 = [3, 3.1, 5]        realMax > 300k
3/1/4   above 3mil           autoRatio3 = [3, 1, 4]          realMax > 3M
1/1/10  above 1000 tributes  autoRatio4 = [1, 1.1, 10]       Tribute > 1000
1/2/22  above 1500 tributes  autoRatio5 = [1, 2, 22]         Tribute > 1500
1/12/12 above 3000 tributes  autoRatio6 = [1, 7, 12]         Tribute > 3000 AND Magma
(absent)                     autoRatio7 = [1, 1, 98]         world >= 300  ← tested FIRST
(absent)                     Watch → tier 1 · Metal → [4, 5, 0]
```

Every number is wrong, a 7th tier is undocumented, and `world >= 300` is evaluated *before*
the tribute tiers, so it silently dominates the ordering the tooltip implies.

Retyping those numbers correctly fixes the symptom and rebuilds the cause. The tooltip would
be a hand-typed copy of a table it does not own, and it would start rotting the next time
someone edits `autoRatio2`. **A description must not be able to disagree with the code.**

## The design

A description stops being a free-text blob. It becomes a composed record where every fact
that *can* drift is derived from the code that owns it, and only human intent is typed.

```text
TYPED BY A HUMAN  (intent — does not rot)
  what         one sentence: what this does
  how          optional detail
  cannot       the asymmetry a user would otherwise file as a bug   (#107 rule 4)
  ignoredWhen  when this setting does nothing at all                (#107 rule 2)
  overwritten  AT rewrites this box — AND UNDER WHAT CONDITION
  noSpeedup    "control only — this does not make your run faster"  (#107 rule 3)

DERIVED FROM CODE  (cannot drift — it *is* the code)
  Default: <x>  composed at the seam from createSetting's own defaultValue arg
  live tables   autoRatio1..7 interpolate from MODULES["jobs"] at define time
```

### Why the seam, not a new wrapper

`createSetting(id, name, description, type, defaultValue, list, container)` already funnels
every tooltip through one function (`tipAttr`, `settings-engine.ts:103`, added by #110).
`defaultValue` is *in scope there*. So the "Default: x" footer is composed at that seam and
applies to all 574 settings **without touching a single call site**.

This matters: the ordered `createSetting` id list is the persistence contract (a dropped or
reordered call silently kills a setting). A wrapper rewriting 574 call sites would put that
contract at risk to buy nothing. The seam gets the same result at zero contract risk.

### The `overwritten` field carries its condition

My first draft of this design proposed an automatic badge on every `setPageSetting`'d id.
Checking the code falsified it. The 12 written ids are not one class:

| id                              | written by                | truth |
|---------------------------------|---------------------------|-------|
| `Farmer/Lumberjack/MinerRatio` (+`R`) | `workerRatios()`     | every tick, **but only while `BuyJobsNew == 1`** ("Auto Worker Ratios"). In mode 2 they are live controls. |
| `AutoMaps` / `RAutoMaps`        | `toggleAutoMaps()`        | a *user* clicking the AutoMaps button. Not a trap. |
| `FirstGigastation` / `DeltaGigastation` | `upgrades.ts:132`  | conditional — the auto-giga solver writes back what it chose. |
| `TrimpleZ`                      | `maps.ts:203`             | one-shot, when the Trimple treasure is taken. |
| `RABfarmstring`                 | `ab.ts:160`               | AT records its own best farm string. |

A universal badge would have been a *new* falsehood — the exact defect class #107 exists to
close. So `overwritten` is a hand-written condition, and the **net enforces its presence**,
not its wording.

## Nets (the correctness lives here, not in my prose)

1. **`overwritten` is mandatory** — every id passed to `setPageSetting` anywhere in `src/`
   must declare an `overwritten` condition in its tooltip. Adding a 13th write site without
   documenting it fails CI. This is the drift-proofing.
2. **Tooltip census snapshot** — all 574 descriptions in one snapshot, so no tooltip edit can
   land invisibly in review again.
3. **Tooltips compile** — already shipped (`tests/nets/settings-tooltips.test.ts`, #110).

Each net gets mutation-checked: break it on purpose, confirm it goes red. A net that cannot
fail is not a net (see #67).

## Scope

All 574 descriptions rewritten through the composer. Prioritised by defect, not by wordiness:
false claims first, then silent-trap settings (ignored-in-this-mode), then merely wordy.

Claims are verified against code *before* being written — several current tooltips are wrong
precisely because they were not.

## Non-goals / safety

- **No `createSetting` id, order, type, or default changes.** Descriptions only.
- **No behaviour change** ⇒ the L0 action traces do not move. `baseline-zero` must stay green;
  if it moves, something is wrong with the change, not with the oracle.
- The `src-bundle` golden moves (any `src/` edit changes the emit) — regen with `--reason`
  per #91.
- The settings-inventory dual snapshot (`.snap` + inline `toMatchInlineSnapshot`) carries
  descriptions; both must be committed together or CI goes red and blocks the deploy.
