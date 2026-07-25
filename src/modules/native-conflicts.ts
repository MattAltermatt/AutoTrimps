// #150 — the native-automation conflict matrix.
//
// The game ships its own automation for jobs AT also automates, and nothing told the player when the
// two were fighting. This module is the ADVISORY table: which native setting conflicts with which AT
// setting, and what to say about it. It is deliberately DOM-free and mutation-free — the badge
// renderer (native-conflict-badges.ts) owns every element, and nothing here may change game state or
// a persisted setting. Auto-"fixing" the player's settings was rejected in #150: silently rewriting a
// persisted choice is the #69 seized-AutoStorage-button mistake in a new costume.
import { getPageSetting } from './utils'

export interface NativeConflict {
    /** Stable key. Also the badge element's id suffix. */
    key: string
    /** Element the badge anchors to — a native game button, or one of AT's own controls. */
    anchorId: string
    /** Tooltip heading. */
    title: string
    /** True while this conflict is live. Reads game state + AT settings; MUST NOT mutate either. */
    when: () => boolean
    /** Tooltip body (HTML). A function because the copy names the universe-correct setting. */
    body: () => string
}

const u2 = (): boolean => game.global.universe === 2

// EVERY setting read below is written inline, as `getPageSetting('<literal>') <op> <literal>`, with no
// helper and no intermediate variable. That is ugly on purpose — two nets depend on it, and both caught
// a tidier version of this file:
//   · tests/nets/settings-reverse.test.ts resolves the ID, so it must be a literal at the callsite. A
//     `num('BuyArmorNew')` helper hides it behind a parameter and the net can no longer prove the id was
//     ever createSetting'd (#68).
//   · tests/nets/dispatch-holes.test.ts (#81) classifies a read that is ASSIGNED or PASSED AS AN
//     ARGUMENT as "value-consumed" ⇒ every option index counts as routed. Wrapping the read in
//     `num(...)` therefore made `BuyArmorNew[0]` ("Armor: Buy Neither") look routed when it is
//     deliberately reachable only by falling through every guard — silencing the net's watch on a real
//     hole. Comparing to a literal routes exactly the indices meant, and leaves index 0 a hole.
// A key MISSING from the store returns `false` (#68), and `false == 1` / `false > 0` are both false, so
// a veteran whose localStorage lacks the key never gets a phantom conflict.

// The game's own universe-aware resolvers (main.js:18026, :18046). Guarded because the unit
// environment mounts this module without the game's script.
const structureOn = (): boolean =>
    typeof getAutoStructureSetting === 'function' && !!getAutoStructureSetting()?.enabled
const jobsMasteryOn = (): boolean =>
    typeof getAutoJobsSetting === 'function' && !!getAutoJobsSetting()?.enabled

// AT-side gates. U1 and U2 are separate settings trees, and reading the wrong one is a phantom
// conflict — `BuyArmorNew` is meaningless in U2, where AutoEquip is one boolean.
// Prestiges: options 1 ("Buy Both") and 2 ("Prestiges") buy them; 0 ("Buy Neither") and 3 ("Levels")
// do not. Compared per-index rather than as a set so #81 routes exactly {1,2} and index 0 stays a hole.
const atBuysPrestiges = (): boolean =>
    u2()
        ? getPageSetting('Requipon') === true
        : getPageSetting('BuyArmorNew') == 1 ||
          getPageSetting('BuyArmorNew') == 2 ||
          getPageSetting('BuyWeaponsNew') == 1 ||
          getPageSetting('BuyWeaponsNew') == 2
const atBuysUpgrades = (): boolean =>
    u2() ? getPageSetting('RBuyUpgradesNew') > 0 : getPageSetting('BuyUpgradesNew') > 0

// Buildings, and the index-3 subtlety that makes `> 0` WRONG here: `buyAutoStructures()`'s order list
// (.trimps-game/main.js:18247) is Tribute/Smithy/Nursery/Laboratory/Gym/Warpstation/housing/Collector/
// Wormhole — it contains NO Barn, Shed or Forge. So option 3 ("Buy Storage", which dispatches
// buyStorage ONLY, main-loop.ts:295) is COMPLEMENTARY to AutoStructure, not a conflict: native takes
// the buildings, AT takes the storage. Only 1 ("Buy Buildings & Storage") and 2 ("Buy Buildings")
// overlap. Index 0 is the handoff itself.
const atBuysBuildings = (): boolean =>
    u2()
        ? getPageSetting('RBuyBuildingsNew') === true
        : getPageSetting('BuyBuildingsNew') == 1 || getPageSetting('BuyBuildingsNew') == 2
const atBuysJobs = (): boolean =>
    u2() ? getPageSetting('RBuyJobsNew') > 0 : getPageSetting('BuyJobsNew') > 0

// Does AT buy STORAGE right now? Used only to keep the AutoStorage advisory honest — "AT buys storage
// ahead of time anyway" is false for options 0 and 2. Storage comes from buyStorage(), dispatched for
// options 1 and 3 (main-loop.ts:291-295).
const atBuysStorage = (): boolean =>
    u2()
        ? getPageSetting('RBuyBuildingsNew') === true
        : getPageSetting('BuyBuildingsNew') == 1 || getPageSetting('BuyBuildingsNew') == 3

// ── THE ORPHAN PREDICATES, and why they do NOT read hidebuildings/fuckjobs ────────────────────────
// The first draft gated these on `hidebuildings`/`fuckjobs` being on. That was backwards, both ways:
//   · `hidebuildings` does not stop AT buying. Its ONLY consumers conjoin it with BuyBuildingsNew==0
//     (main-loop.ts:290, buildings.ts:264, upgrades.ts:156, settings-visibility.ts:336) — and
//     main-loop.ts:290 dispatches buyBuildings() *because* both are set. Inside, `hidebuild` suppresses
//     housing/Wormhole/Tribute/Nursery but NOT Gym (buildings.ts:314) ⇒ that combination is "Gyms only".
//   · `fuckjobs` has no behavioural consumer at all — its only reads are the two render gates in
//     settings-visibility.ts:382-383. Hiring is stopped solely by BuyJobsNew == 0.
// So the state worth warning about is keyed on the DISPATCH setting, not the cosmetic one. Both orphan
// sub-cases collapse into one predicate: BuyBuildingsNew == 0 with AutoStructure off means either
// nothing at all is bought (Hide Buildings off ⇒ no branch matches) or Gyms only (Hide Buildings on).
//
// ⚠ STRICT equality, and this is not style. Everywhere else in this file a loose `==` is safe because
// the "missing key" value `false` never loosely equals 1, 2 or `true`. Against ZERO it does:
// `false == 0` is TRUE. So `== 0` would fire this advisory for every user whose localStorage predates
// the setting — the #68 phantom exactly, arriving through the one comparison where the usual reasoning
// inverts. `false === 0` is false, and getPageSetting returns a real `parseInt` number for a multitoggle
// that IS present, so strict equality is both safe and correct. (Caught by the #68 test, not by review.)
const atBuildingsHandedOff = (): boolean => getPageSetting('BuyBuildingsNew') === 0
const atJobsHandedOff = (): boolean => getPageSetting('BuyJobsNew') === 0

// ── AutoGold (#152), and why this row compares CHOICES instead of "both are on" ────────────────────
// Golden Upgrades are a scarce, permanent, run-defining purchase: getAvailableGoldenUpgrades()
// (main.js:14299) is a COUNT, and BOTH automations spend it through the same buyGoldenUpgrade(). So two
// automations that agree are harmless — the second call finds nothing left and no-ops — while two that
// disagree race for every golden the run produces. "Both are running" would therefore be the wrong
// claim, and the same overclaim #150's review had to strip out of four rows. The honest claim is that
// they disagree about which pool.
//
// The two vocabularies line up 1:1, which is what makes the comparison possible at all. Native's modes
// are toggleAutoGolden's own order (main.js:18116-18130), and its 3/4 differ ONLY in which fallback is
// used once the Void pool caps out — exactly how AT's 'Void' and 'Void + Battle' differ
// (other.ts:137-144, upgrades.ts:245-252):
//   native 1 Helium ("Radon" in U2)  ↔ AT 'Helium' / 'Radon'  → the Helium pool either way
//   native 2 Battle                  ↔ AT 'Battle'
//   native 3 Voidlium                ↔ AT 'Void'
//   native 4 Voidtle                 ↔ AT 'Void + Battle'
//   native 5 Custom (archoGolden)    ↔ nothing AT can express → always a disagreement
//
// ⚠ DELIBERATE FALSE NEGATIVE. AT's Helium↔Battle switch-over thresholds (radonbattle / battleradon and
// their d*/R* variants) mean AT's EFFECTIVE choice can drift from its configured one mid-run, so two
// sides configured alike can still diverge. Modelling that would mean re-implementing other.ts:128-133
// here, and a second copy of a code-owned rule is the thing that rots ([[reference-derive-dont-retype]]).
// An advisory that misses a case is a far smaller failure than one that invents a conflict.
const NATIVE_GOLDEN_POOL = ['Off', 'Helium', 'Battle', 'Void', 'Void + Battle', 'Custom']

// -1 (button hidden) and 0 (Off) both mean "not picking"; anything above 0 is an active strategy.
const nativeGoldenMode = (): number =>
    typeof getAutoGoldenSetting === 'function' ? Number(getAutoGoldenSetting()) : 0

const nativeGoldenPool = (): string => NATIVE_GOLDEN_POOL[nativeGoldenMode()] ?? 'Custom'

// AT itself normalises 'Radon' onto the Helium pool (upgrades.ts:231-232) — U2 has no golden pool of its
// own — so compare pools, never the labels the two universes happen to print.
const atGoldenPool = (raw: unknown): string => (raw === 'Radon' ? 'Helium' : String(raw))

/**
 * Every AT golden strategy DISPATCHING right now, as pool names.
 *
 * Mirrors main-loop.ts:424-426 (U1) and :585-587 (U2) exactly, including the part that looks like a bug
 * and is faithfully reproduced: those three guards are evaluated INDEPENDENTLY, not as an if/else chain,
 * so if a Daily and a Challenge2 are both flagged AT really does dispatch two strategies and either one
 * can be the one that disagrees. Hence a list rather than a single winner — inventing a precedence the
 * dispatcher does not have would be a claim about code that does not exist.
 *
 * The reads are assigned to locals, unlike the rest of this file: these are string DROPDOWNS, not
 * multitoggles, so there are no option indices for dispatch-holes (#81) to route, and main-loop.ts
 * already value-consumes the same six ids the same way. The literal id still sits at the callsite, which
 * is what settings-reverse (#68) resolves.
 */
const atGoldenChoices = (): string[] => {
    const normal = u2() ? getPageSetting('RAutoGoldenUpgrades') : getPageSetting('AutoGoldenUpgrades')
    const daily = u2() ? getPageSetting('RdAutoGoldenUpgrades') : getPageSetting('dAutoGoldenUpgrades')
    const c2 = u2() ? getPageSetting('RcAutoGoldenUpgrades') : getPageSetting('cAutoGoldenUpgrades')
    const out: string[] = []
    // `normal &&` before the != 'Off' compare is not redundant: a key absent from a veteran's store
    // returns `false` (#68), and `false != 'Off'` is TRUE. Same guard main-loop.ts uses, same reason.
    if (normal && normal != 'Off' && !game.global.runningChallengeSquared && game.global.challengeActive != 'Daily')
        out.push(atGoldenPool(normal))
    if (daily && daily != 'Off' && game.global.challengeActive == 'Daily') out.push(atGoldenPool(daily))
    if (c2 && c2 != 'Off' && game.global.runningChallengeSquared) out.push(atGoldenPool(c2))
    return out
}

// ── AutoEquip (#152), and the A/B that had to happen before this row could claim anything ─────────
// buyAutoEquip() (main.js:18326) buys equipment LEVELS by spending a configured percent of your
// resources per item, every tick, via calculateMaxAfford(..., value/100). AT's buyer does the opposite
// by design: it SATISFICES — it declines affordable levels once your gear is strong enough and banks
// the metal instead, which #108 measured as worth keeping (removing the brake cost -19.5%).
//
// Both being "on" is therefore not self-evidently wrong, which is why #152 declined to guess. Measured,
// ticks-to-gain-2-zones, 5 seeds, two fixtures (12-warp-u1, 06-deep-u1), control noise floor 1.5-2.2%:
//
//   native %    12-warp-u1     06-deep-u1     equipment levels bought (06-deep)
//   --------    -----------    -----------    ---------------------------------
//   off (ctl)   2900 ticks     5120 ticks     27
//   10%         2900 (0.0%)    5120 (0.0%)    78   <- 2.9x the gear, IDENTICAL progress
//   50%         3060 (+5.5%)   5400 (+5.5%)   89   <- reproducibly SLOWER on both
//
// So the honest claim is NOT "this slows you down" — at 10% the progression effect is exactly zero. It
// is that the extra levels buy nothing, and at aggressive percentages the metal drain turns negative.
// The +5.5% is identical to one decimal across two independent fixtures and ~3x the noise floor.
const nativeAutoEquipOn = (): boolean =>
    typeof getAutoEquipSetting === 'function' &&
    !!getAutoEquipSetting()?.enabled &&
    !!game.global.autoEquipUnlocked

// AT's LEVEL buying, which is the half of these multitoggles that overlaps AutoEquip: options 1
// ("Buy Both") and 3 ("Levels") buy levels; 0 ("Buy Neither") and 2 ("Prestiges") do not
// (equipment.ts:445-446). Note this is the SIBLING half of the same setting the autoPrestige row reads
// as {1,2} — the two rows partition the same multitoggle, and index 0 stays a hole in both (#81).
const atBuysLevels = (): boolean =>
    u2()
        ? getPageSetting('Requipon') === true
        : getPageSetting('BuyWeaponsNew') == 1 ||
          getPageSetting('BuyWeaponsNew') == 3 ||
          getPageSetting('BuyArmorNew') == 1 ||
          getPageSetting('BuyArmorNew') == 3

const atGoldenDisagrees = (): boolean => {
    const native = nativeGoldenPool()
    return atGoldenChoices().some((choice) => choice !== native)
}

const REC = '<br><br><b>Recommended:</b> '

export const CONFLICTS: readonly NativeConflict[] = [
    {
        key: 'autoPrestige',
        anchorId: 'autoPrestigeBtn',
        title: 'AutoPrestige fights AutoTrimps',
        // `autoUpgradesAvailable` is load-bearing, not belt-and-braces: autoPrestiges() is reachable
        // ONLY from autoUpgrades() (main.js:18464), which the game calls only under that flag
        // (main.js:19915). The BUTTON, though, is revealed on a different condition — Bone Shrine
        // sLevel >= 4 (updates.js:4804) — so a shrine-4 player below HZE 59 can have AutoPrestige set
        // to All with a visible button and zero prestige automation actually running.
        when: () =>
            game.global.autoPrestiges > 0 && !!game.global.autoUpgradesAvailable && atBuysPrestiges(),
        body: () =>
            "AT buys equipment prestiges on a strategy: it skips cheap ones (Prestige Skip), can delay them by zone (Force Prestige Zone), and spends the metal on equipment LEVELS instead when levels are worth more. The game's AutoPrestige buys every affordable prestige the moment it can — which spends the metal AT was saving for levels and defeats prestige-skipping entirely." +
            REC +
            'set AutoPrestige to <b>Off</b> and leave prestiges to AT&rsquo;s ' +
            (u2() ? '<b>AutoEquip</b> setting' : '<b>Armor</b> / <b>Weapons</b> settings') +
            '.',
    },
    {
        key: 'autoUpgrade',
        anchorId: 'autoUpgradeBtn',
        title: 'AutoUpgrade ignores AT&rsquo;s upgrade holds',
        // Mode 2 ("Auto No Coords", unlocked at 250 void maps) excludes Coordination and is compatible.
        when: () => game.global.autoUpgrades === 1 && atBuysUpgrades(),
        body: () =>
            "AT buys upgrades in a deliberate priority order, with holds the game's AutoUpgrade does not have: Coordination is held back when your population cannot fill the bigger squad, while Wind empowerment is stacking, and by the Amalgamator hold; wood and metal can also be reserved for foundational upgrades like Miners. The game's AutoUpgrade buys any affordable upgrade every tick, in arbitrary order, ignoring all of it." +
            REC +
            'switch AutoUpgrade to <b>Auto No Coords</b>, which leaves Coordination to AT &mdash; or turn it Off. (That third mode appears once you have cleared a Void Map at zone 250 or deeper, and the stat behind it is Universe&nbsp;1 only.)',
    },
    {
        key: 'autoStructure',
        anchorId: 'autoStructureBtn',
        title: 'Two building automations are running',
        when: () => structureOn() && atBuysBuildings(),
        // NOTE: no "AT still buys Gyms" claim here. AutoStructure's order list DOES include Gym
        // (main.js:18247, and Gym carries `AP: true` in config.js so it appears in the AutoStructure
        // config table). The `hidebuildings` tooltip asserted the opposite for a long time; that claim is
        // corrected in settings-defs.ts in this same change rather than copied forward.
        body: () =>
            'AutoStructure and AT&rsquo;s building automation are meant to be a <b>swap</b>, not a stack. Both are buying right now, so your build queue and resources are being scheduled twice, to two different plans.' +
            REC +
            'pick one. To keep AT in charge, turn AutoStructure Off. To hand buildings to AutoStructure, ' +
            (u2()
                ? 'turn AT&rsquo;s <b>AutoBuildings</b> off.'
                : 'set AT&rsquo;s <b>Buy Buildings</b> to <b>Buy Neither</b> <i>and</i> turn on <b>Hide Buildings</b> &mdash; AT keeps buying Gyms only in that exact combination. <b>Buy Neither</b> on its own stops Gym purchases too.'),
    },
    {
        key: 'autoJobs',
        anchorId: 'autoJobsBtn',
        title: 'Two job automations are running',
        when: () => jobsMasteryOn() && atBuysJobs(),
        body: () =>
            'AutoJobs and AT&rsquo;s job automation are meant to be a <b>swap</b>, not a stack. Both are hiring right now, and AT rewrites the worker-ratio boxes every tick, so the two will keep undoing each other.' +
            REC +
            'pick one. To hand jobs to AutoJobs, set AT&rsquo;s <b>Buy Jobs</b> to <b>Don&rsquo;t Buy Jobs</b>. To keep AT in charge, turn AutoJobs Off.',
    },
    {
        key: 'autoStorageOff',
        anchorId: 'autoStorageBtn',
        title: 'AutoStorage off is costing you resources',
        when: () => !!game.global.improvedAutoStorage && !game.global.autoStorage,
        body: () =>
            'You have <b>Auspicious Presence Part II</b>, which builds storage instantly and converts overflow into new storage with <b>zero waste</b> &mdash; but only while AutoStorage is on. With it off, everything you collect above your cap is simply lost.' +
            REC +
            'turn AutoStorage <b>On</b>.' +
            // Conditional, because "it costs nothing" is only true when AT is ALSO buying storage —
            // for Buy Neither / Buy Buildings there is no AT storage buyer to act as the backstop.
            (atBuysStorage()
                ? ' It costs nothing: AT buys storage ahead of time anyway, so AutoStorage only ever acts as a backstop.'
                : ' AT is not buying storage in its current mode, so right now AutoStorage is the only thing that would.'),
    },
    {
        key: 'autoGolden',
        anchorId: 'autoGoldenBtn',
        title: 'AutoGold and AT are buying different Golden Upgrades',
        // `autoUpgradesAvailable` is load-bearing for exactly the reason it is on the autoPrestige row:
        // autoGoldenUpgrades() is the FIRST statement inside autoUpgrades() (main.js:18435-18436), and
        // autoUpgrades() has a single caller, guarded (main.js:19915). Below HZE 59 and before the
        // Improbability, native AutoGold can read "AutoGold Battle" on a visible button and buy nothing.
        when: () => nativeGoldenMode() > 0 && !!game.global.autoUpgradesAvailable && atGoldenDisagrees(),
        body: () => {
            const native = nativeGoldenPool()
            const mine = atGoldenChoices().join(' / ')
            return (
                'Golden Upgrades are a fixed, permanent pool &mdash; the game grants a set number per run, and ' +
                'both automations spend from the same count through the same purchase. AT is set to buy <b>' +
                mine +
                '</b>, while the game&rsquo;s AutoGold is set to buy <b>' +
                native +
                '</b>. Whichever fires first on a given tick wins that golden, so you get an unpredictable ' +
                'mix of the two' +
                (native === 'Custom'
                    ? ' &mdash; and <b>Custom</b> AutoGold is a hand-built order AT cannot see or account for'
                    : '') +
                '. AT&rsquo;s switch-over rules (the ' +
                (u2() ? 'Radon' : 'Helium') +
                '/Battle purchase counts, the Void fallback zone) stop meaning anything once something else ' +
                'is spending the same pool.' +
                REC +
                'pick one owner. To keep AT in charge, set AutoGold to <b>Off</b>. To hand Golden Upgrades to ' +
                'the game, set AT&rsquo;s <b>AutoGoldenUpgrades</b> &mdash; and its <b>Daily</b> and <b>C2</b> ' +
                'variants, which are separate settings &mdash; to <b>Off</b>.'
            )
        },
    },
    {
        key: 'autoEquip',
        anchorId: 'autoEquipBtn',
        title: 'AutoEquip is spending metal AT banks on purpose',
        when: () => nativeAutoEquipOn() && atBuysLevels(),
        body: () =>
            'Both are buying equipment <b>levels</b>, but on opposite policies. AT stops once your gear is ' +
            'strong enough and banks the rest, because the metal is worth more spent later. The game&rsquo;s ' +
            'AutoEquip has no such rule &mdash; it spends a fixed percentage of your resources on every ' +
            'enabled item, every tick, however strong you already are.' +
            '<br><br>Measured over two saves, 5 seeds each: at <b>10%</b> it bought <b>2.9&times; the ' +
            'equipment levels</b> and reached the same zone in exactly the same time &mdash; the extra gear ' +
            'bought nothing. At <b>50%</b> it was <b>5.5% slower</b> to gain two zones, on both saves.' +
            REC +
            'turn AutoEquip <b>Off</b> and leave levels to AT&rsquo;s ' +
            (u2() ? '<b>AutoEquip</b> setting' : '<b>Armor</b> / <b>Weapons</b> settings') +
            '. If you would rather the game owned equipment, set ' +
            (u2()
                ? 'AT&rsquo;s <b>AutoEquip</b> off'
                : 'AT&rsquo;s <b>Armor</b> and <b>Weapons</b> to <b>Prestiges</b>, so AT keeps prestiges and ' +
                  'AutoEquip takes levels') +
            '.',
    },
    {
        key: 'buildingsOrphan',
        // Anchored to the game's Buildings panel header, which is always present — NOT to AT's own
        // `hidebuildings` control, which lives inside the settings window and is therefore closed
        // exactly when the player needs to be told that nothing is buying buildings.
        anchorId: 'buildingsTitleDiv',
        title: 'Nothing is buying buildings',
        when: () => atBuildingsHandedOff() && !structureOn(),
        body: () =>
            'AT&rsquo;s <b>Buy Buildings</b> is set to <b>Buy Neither</b>, which hands ordinary building purchases to the game&rsquo;s AutoStructure &mdash; but AutoStructure is currently <b>Off</b>, so ' +
            (getPageSetting('hidebuildings') === true
                ? 'only Gyms are being bought. Housing, storage, Tributes and Nurseries are not.'
                : 'nothing is being bought at all &mdash; not housing, not storage, not even Gyms.') +
            REC +
            'turn AutoStructure On, or set <b>Buy Buildings</b> back to <b>Buy Buildings &amp; Storage</b>.',
    },
    {
        key: 'jobsOrphan',
        // Same reasoning as buildingsOrphan: the game's Jobs panel header, not AT's settings window.
        // (This header carries its own inline display:none until Jobs unlock, which the renderer's
        // visibility check honours.)
        anchorId: 'jobsTitleDiv',
        title: 'Nothing is hiring workers',
        when: () => atJobsHandedOff() && !jobsMasteryOn(),
        body: () =>
            'AT&rsquo;s <b>Buy Jobs</b> is set to <b>Don&rsquo;t Buy Jobs</b>, which hands hiring to the game&rsquo;s AutoJobs mastery &mdash; but AutoJobs is currently <b>Off</b>, so no workers are being hired at all.' +
            REC +
            'turn AutoJobs On, or set <b>Buy Jobs</b> back to <b>Auto Worker Ratios</b>.',
    },
]

/**
 * The rows that are live right now. A row whose predicate throws is treated as inactive: a badge is
 * an advisory, and an advisory must never be the thing that breaks the GUI loop. (guiLoop's atGuard
 * would contain it, but that would take the whole sweep down with it, not one row.)
 */
export function activeConflicts(): NativeConflict[] {
    const out: NativeConflict[] = []
    for (const c of CONFLICTS) {
        try {
            if (c.when()) out.push(c)
        } catch {
            /* inactive */
        }
    }
    return out
}
