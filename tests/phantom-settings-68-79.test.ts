// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Regression net for the LIVE fixes in #68 (phantom setting ids) and #79 (the (R)doPortal `||` guard
// + settings-visibility's hson/dhson).
//
// Every phantom below shared one failure mode: getPageSetting returns the literal `false` for an id
// that was never createSetting'd — no throw, no warning, no type error. So the bug is always a SILENT
// degradation into a comparison against 0/false, and it can only be caught by driving the branch and
// asserting on the value that comes out. tests/nets/settings-reverse.test.ts owns the *mechanical*
// direction (no id may be read that is not defined); this file owns the *behavioural* one — it pins
// what each repaired branch now actually DOES, so that repointing an id back at a phantom, or
// reinstating a deleted reader, fails here and not only in the net.
//
// NOTE the two AutoTrimps2.js fixes ('DailyBWraid' → 'Dailybwraid', and the pasted-expression id
// `getPageSetting('game.global.universe == 1 && BWraid')`) are deliberately NOT here: they live in the
// legacy mainLoop, which is not importable in isolation. They are covered by settings-reverse's
// phantom net, which goes red on their exact ids — verified by mutation in the report.

const setText = (id: string, value: string) => {
  ;(globalThis as any).autoTrimpSettings[id] = { type: 'textValue', value }
}
const setValue = (id: string, value: number) => {
  ;(globalThis as any).autoTrimpSettings[id] = { type: 'value', value }
}
// 'dropdown' is the real type of AutoPortal / HeliumHourChallenge (settings-defs.ts:44-45), and
// getPageSetting returns `.selected` for it.
const setSelect = (id: string, selected: string) => {
  ;(globalThis as any).autoTrimpSettings[id] = { type: 'dropdown', selected }
}

// ────────────────────────────────────────────────────────────────────────────────────────────────
// #79 — the (R)doPortal heirloom guard was `name != highdmg || name != dhighdmg`: a TAUTOLOGY (a name
// cannot equal two distinct settings at once), whose body was then hard-wired to the NON-daily finder.
// The `||` is a mangled Daily dispatch; highHeirloom()/dhighHeirloom() are the intended twins.
// ────────────────────────────────────────────────────────────────────────────────────────────────
describe('#79 — (R)doPortal dispatches the heirloom equip on Daily, and no longer re-equips', () => {
  let portal: typeof import('../src/modules/portal')
  const worldLoom = { name: 'WorldShield' }
  const dailyLoom = { name: 'DailyShield' }

  beforeEach(async () => {
    ;(globalThis as any).MODULES = {}
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = {
      options: { menu: { showHeirloomAnimations: { enabled: false } } },
      global: {
        portalActive: true,
        challengeActive: '',
        heirloomsCarried: [{ name: 'Other' }, worldLoom, dailyLoom],
        ShieldEquipped: { name: 'Other' },
      },
    }
    const heirlooms = await import('../src/modules/heirlooms')
    Object.assign(globalThis, heirlooms) // highHeirloom / dhighHeirloom are reached by bare name.
    portal = await import('../src/modules/portal')

    ;(globalThis as any).selectHeirloom = vi.fn()
    ;(globalThis as any).equipHeirloom = vi.fn()
    for (const name of [
      'portalClicked', 'autoMagmiteSpender', 'autoheirlooms3', 'activateClicked', 'cancelPortal',
      'viewPortalUpgrades', 'numTab', 'buyPortalUpgrade', 'c2runner', 'selectChallenge',
      'checkCompleteDailies', 'getDailyChallenge', 'getDailyTimeString', 'swapPortalUniverse',
      'activatePortal', 'RactivatePortal', 'resetVars', 'RresetVars',
    ]) {
      ;(globalThis as any)[name] = vi.fn()
    }
    ;(globalThis as any).portalWindowOpen = false
    ;(globalThis as any).portalUniverse = 1
    ;(globalThis as any).lastHeliumZone = 0
    ;(globalThis as any).zonePostpone = 0
    ;(globalThis as any).lastRadonZone = 0
    ;(globalThis as any).RzonePostpone = 0

    setText('highdmg', 'WorldShield')
    setText('dhighdmg', 'DailyShield')
  })

  for (const fn of ['doPortal', 'RdoPortal'] as const) {
    it(`${fn}() on a DAILY equips the 'dhighdmg' heirloom, not the 'highdmg' one`, () => {
      ;(globalThis as any).game.global.challengeActive = 'Daily'
      ;(portal as any)[fn]()
      // index 2 = dailyLoom. Before the fix the body always ran highdmgshield(), so this was index 1 —
      // a Daily player got their NON-daily shield equipped at every portal, and 'dhighdmg' was inert.
      expect((globalThis as any).selectHeirloom).toHaveBeenCalledWith(2, 'heirloomsCarried', true)
      expect((globalThis as any).equipHeirloom).toHaveBeenCalledOnce()
    })

    it(`${fn}() off-daily still equips the 'highdmg' heirloom`, () => {
      ;(portal as any)[fn]()
      expect((globalThis as any).selectHeirloom).toHaveBeenCalledWith(1, 'heirloomsCarried', true)
    })

    it(`${fn}() does NOT re-equip a shield that is already the wanted one (the tautology is gone)`, () => {
      ;(globalThis as any).game.global.ShieldEquipped = { name: 'WorldShield' }
      ;(portal as any)[fn]()
      // The old `!=` || `!=` guard could not be false, so this re-selected + re-equipped the shield the
      // player was ALREADY wearing on every single portal.
      expect((globalThis as any).selectHeirloom).not.toHaveBeenCalled()
      expect((globalThis as any).equipHeirloom).not.toHaveBeenCalled()
    })
  }
})

// ────────────────────────────────────────────────────────────────────────────────────────────────
// #68 — findOutCurrentPortalLevel() read the DELETED id 'Dailyportal' on the daily branch, so the
// zone it reported was `false + 1` === 1.
// ────────────────────────────────────────────────────────────────────────────────────────────────
describe("#68 — findOutCurrentPortalLevel reads 'dCustomAutoPortal' on a Daily", () => {
  let portal: typeof import('../src/modules/portal')

  beforeEach(async () => {
    ;(globalThis as any).MODULES = {}
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = { global: { challengeActive: '' } }
    portal = await import('../src/modules/portal')
    setSelect('AutoPortal', 'Custom')
    setSelect('HeliumHourChallenge', 'None')
    setValue('CustomAutoPortal', 300)
    setValue('dCustomAutoPortal', 575)
  })

  it('off-daily: level = CustomAutoPortal + 1', () => {
    expect(portal.findOutCurrentPortalLevel().level).toBe(301)
  })

  it('on a Daily: level = dCustomAutoPortal + 1 — NOT 1', () => {
    ;(globalThis as any).game.global.challengeActive = 'Daily'
    // The phantom 'Dailyportal' made this `false + 1`. A Daily player on AutoPortal=Custom was told the
    // estimated portal zone was 1, which also poisoned checkPortalSettings' void-map warning below.
    expect(portal.findOutCurrentPortalLevel().level).toBe(576)
    expect(portal.findOutCurrentPortalLevel().level).not.toBe(1)
  })
})

// ────────────────────────────────────────────────────────────────────────────────────────────────
// #68 — checkPortalSettings' daily branch read the never-defined 'dVoidMaps', so `false >= portalLevel`
// was always false and the "your voids run after your autoPortal" warning could not fire on a Daily.
// 'DailyVoidMod' is the live daily twin (upgrades.ts:35 already dispatches this exact pair correctly).
// ────────────────────────────────────────────────────────────────────────────────────────────────
describe("#68 — checkPortalSettings compares 'DailyVoidMod' on a Daily", () => {
  let vis: typeof import('../src/modules/settings-visibility')

  beforeEach(async () => {
    ;(globalThis as any).MODULES = {}
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = { global: { challengeActive: 'Daily' } }
    // settings-visibility reaches getPageSetting + findOutCurrentPortalLevel by BARE NAME, via the
    // legacy bridge's globalThis spread — not by import. Reproduce that seam.
    Object.assign(globalThis, await import('../src/modules/utils'))
    Object.assign(globalThis, await import('../src/modules/portal'))
    vis = await import('../src/modules/settings-visibility')
    ;(globalThis as any).tooltip = vi.fn()
    setSelect('AutoPortal', 'Custom')
    setSelect('HeliumHourChallenge', 'None')
    setValue('CustomAutoPortal', 300)
    setValue('dCustomAutoPortal', 575) // ⇒ portal level 576
  })

  it('warns when the daily void zone is at/after the daily portal zone', () => {
    setValue('DailyVoidMod', 600) // 600 >= 576 ⇒ the voids would never run
    vis.checkPortalSettings()
    expect((globalThis as any).tooltip).toHaveBeenCalledOnce()
  })

  it('stays quiet when the daily void zone lands before the portal zone', () => {
    setValue('DailyVoidMod', 500) // 500 < 576 ⇒ fine
    vis.checkPortalSettings()
    expect((globalThis as any).tooltip).not.toHaveBeenCalled()
  })
})

// ────────────────────────────────────────────────────────────────────────────────────────────────
// #79 — settings-visibility.ts gated the DAILY U2 staff-swap row on `hson` (the NON-daily variable),
// which at that point in the 976-line function is a hoisted `var` = undefined. So it always took the
// turnOff branch: 'Rdhsstaff' was permanently hidden, and with it the three settings it gates.
// ────────────────────────────────────────────────────────────────────────────────────────────────
describe("#79 — updateCustomButtons shows the daily U2 staff row (hson → dhson)", () => {
  let vis: typeof import('../src/modules/settings-visibility')

  const row = (id: string) => {
    const parent = document.createElement('div')
    parent.setAttribute('data-phantom-row', '')
    const el = document.createElement('div')
    el.id = id
    parent.appendChild(el)
    document.body.appendChild(parent)
    return el
  }

  beforeEach(async () => {
    // NB: do NOT reset document.body — tests/setup.ts installs the shared scaffold (#logBtnGroup et al)
    // that utils.ts/heirlooms.ts append to at module load. Wiping it makes those imports throw.
    for (const el of document.querySelectorAll('[data-phantom-row]')) el.remove()
    ;(globalThis as any).MODULES = {}
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = {
      options: { menu: { darkTheme: { enabled: false } } },
      permaBoneBonuses: { boosts: { owned: 0 } },
      global: { challengeActive: '', universe: 2, world: 1 },
      talents: {},
      upgrades: {},
      buildings: {},
      jobs: {},
      portal: {},
      stats: {},
      resources: {},
      unlocks: { imps: {} },
      worldUnlocks: { easterEgg: { locked: true } },
      mapUnlocks: {},
      achievements: {},
      c2: {},
      empowerments: {},
    }
    ;(globalThis as any).debug = vi.fn()
    // Game/bridge functions updateCustomButtons calls by bare name on its way to the row under test.
    ;(globalThis as any).bwRewardUnlocked = () => false
    ;(globalThis as any).renderControlFace = () => {}
    ;(globalThis as any).RshouldFarm = false
    Object.assign(globalThis, await import('../src/modules/utils')) // bare-name getPageSetting (bridge)
    vis = await import('../src/modules/settings-visibility')
  })

  // updateCustomButtons reaches these dropdowns through autoTrimpSettings DIRECTLY (`.selected`, not
  // getPageSetting) and writes each back onto a <select> by id. Every one must exist or the function
  // throws before it ever reaches the daily-staff row under test. Derived mechanically:
  //   grep -oE 'autoTrimpSettings\.[A-Za-z0-9_]+\.selected' src/modules/settings-visibility.ts
  const DIRECT_DROPDOWNS = [
    'AutoPortal', 'HeliumHourChallenge', 'RAutoPortal', 'RadonHourChallenge', 'dHeliumHourChallenge',
    'RdHeliumHourChallenge', 'AutoGoldenUpgrades', 'dAutoGoldenUpgrades', 'cAutoGoldenUpgrades',
    'RAutoGoldenUpgrades', 'RdAutoGoldenUpgrades', 'RcAutoGoldenUpgrades', 'AutoPoison', 'AutoWind',
    'AutoIce', 'Prestige', 'mapselection', 'Rmapselection', 'raretokeep',
    ...['1', '2', '3', '4', '5', '6', '7'].flatMap((n) => [`slot${n}modsh`, `slot${n}modst`]),
    ...['1', '2', '3', '4'].map((n) => `slot${n}modcr`),
  ]
  const dropdownScaffold = () => {
    for (const id of DIRECT_DROPDOWNS) {
      setSelect(id, 'Off')
      row(id)
    }
    // …and the handful of elements it dereferences with a non-null assertion, plus the two settings it
    // reads `.value` off directly (autoTrimpSettings.AutoMaps / .RAutoMaps at :944/:947).
    for (const id of ['autoMapBtn']) row(id)
    def('AutoMaps', 'multitoggle', { value: 0 })
    def('RAutoMaps', 'multitoggle', { value: 0 })
  }

  // updateCustomButtons' final pass (settings-visibility.ts:961-965) walks EVERY entry in
  // autoTrimpSettings and, for the value/multitoggle/multiValue/textValue types, does
  // `document.getElementById(item.id).parentNode` — with the null check one line too late. So any such
  // setting we stub must carry its own `id` AND have a live row, or the walk throws. (That misordered
  // null check is a real latent NPE in production too; out of scope here, reported separately.)
  const def = (id: string, type: string, extra: Record<string, unknown>) => {
    ;(globalThis as any).autoTrimpSettings[id] = { id, name: id, type, ...extra }
    if (!document.getElementById(id)) row(id)
  }

  it("turns 'Rdhsstaff' ON when radon + Rdhs are on — it was hard-off before", () => {
    const el = row('Rdhsstaff')
    dropdownScaffold()
    def('radonsettings', 'multitoggle', { value: 1 }) // radonon
    def('Rdhs', 'multitoggle', { value: 1 }) // dhson  ('DHS: On')
    vis.updateCustomButtons()
    // Before the fix: `radonon && hson` — hson is `undefined` here (its `var` is ~620 lines below), so
    // this was always turnOff('Rdhsstaff') ⇒ display:none, which forced dhsstaffon false and hid
    // Rdhsworldstaff / Rdhsmapstaff / Rdhstributestaff too. Four daily U2 settings, unreachable.
    expect(el.style.display).toBe('')
    expect((el.parentNode as HTMLElement).style.display).toBe('inline-block')
  })

  it("keeps 'Rdhsstaff' OFF when the daily master toggle Rdhs is off", () => {
    const el = row('Rdhsstaff')
    dropdownScaffold()
    def('radonsettings', 'multitoggle', { value: 1 })
    def('Rdhs', 'multitoggle', { value: 0 }) // 'DHS: Off'
    vis.updateCustomButtons()
    expect(el.style.display).toBe('none')
  })
})
