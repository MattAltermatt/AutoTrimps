// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { syncConflictBadges, removeConflictBadges } from '../src/modules/native-conflict-badges'

// The "does every conflict body COMPILE as a handler" check lives in a sibling NODE-env suite
// (tests/native-conflicts.tooltips.test.ts): esbuild cannot run under jsdom at all — its
// TextEncoder invariant breaks — exactly as tests/nets/settings-tooltips.test.ts documents.

// The anchors are real game ids (index.html:440-492) inside their real bootstrap cells, so the
// sibling insert is exercised against the shape it will meet in the browser.
function fixture() {
  // The `.autoUpgradeBtn` CLASS and its stylesheet rule are load-bearing parts of this fixture, not
  // decoration: that class is how the game hides all five buttons until they unlock
  // (.trimps-game/css/style.css:5459-5463), and the game reveals them with an inline display:block.
  // A fixture without the class/rule cannot distinguish "hidden by class" from "visible", which is
  // exactly how the first version of anchorVisible() shipped reading only the inline style.
  document.body.innerHTML = `
    <style>.autoUpgradeBtn{display:none}</style>
    <div class="col-xs-3"><div id="autoStructureBtn" class="autoUpgradeBtn"><div id="autoStructureText">AutoStructure</div></div></div>
    <div class="col-xs-3"><div id="autoStorageBtn" class="autoUpgradeBtn">AutoStorage</div></div>
    <div class="col-xs-3"><div id="autoUpgradeBtn" class="autoUpgradeBtn">AutoUpgrade</div></div>
    <div class="col-xs-3"><div id="autoPrestigeBtn" class="autoUpgradeBtn">AutoPrestige</div></div>
    <div class="col-xs-3"><div id="autoJobsBtn" class="autoUpgradeBtn"><div id="autoJobsText">AutoJobs</div></div></div>
    <div id="buildingsTitleDiv"><div class="row">Buildings</div></div>
    <div id="jobsTitleDiv" style="display: none"><div class="row">Jobs</div></div>`
  // Reveal the buttons the way the game does, so the default fixture state is "unlocked".
  for (const id of ['autoStructureBtn', 'autoStorageBtn', 'autoUpgradeBtn', 'autoPrestigeBtn', 'autoJobsBtn'])
    document.getElementById(id)!.style.display = 'block'
  ;(globalThis as any).game = {
    global: {
      universe: 1,
      autoPrestiges: 0,
      autoUpgrades: 0,
      autoStorage: true,
      improvedAutoStorage: false,
      autoStructureSetting: { enabled: false },
      autoJobsSetting: { enabled: false },
    },
  }
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).getAutoStructureSetting = () => (globalThis as any).game.global.autoStructureSetting
  ;(globalThis as any).getAutoJobsSetting = () => (globalThis as any).game.global.autoJobsSetting
}

/** Put the state into the AutoUpgrade conflict. */
function armAutoUpgrade() {
  ;(globalThis as any).game.global.autoUpgrades = 1
  ;(globalThis as any).autoTrimpSettings.BuyUpgradesNew = {
    id: 'BuyUpgradesNew',
    type: 'multitoggle',
    value: 1,
  }
}

describe('native conflict badges (#150)', () => {
  beforeEach(() => {
    fixture()
    removeConflictBadges()
  })

  it('mounts nothing when there is no conflict', () => {
    syncConflictBadges()
    expect(document.querySelectorAll('.at-nc-badge').length).toBe(0)
  })

  it('mounts a badge as a SIBLING of the anchor, not a child', () => {
    armAutoUpgrade()
    syncConflictBadges()
    const badge = document.getElementById('atNC-autoUpgrade')!
    const anchor = document.getElementById('autoUpgradeBtn')!
    expect(badge).toBeTruthy()
    expect(anchor.contains(badge)).toBe(false)
    expect(anchor.nextElementSibling).toBe(badge)
  })

  it('survives the anchor rewriting its own innerHTML (the click path)', () => {
    armAutoUpgrade()
    syncConflictBadges()
    // main.js:18416 — toggleAutoUpgrades() does exactly this on every click.
    document.getElementById('autoUpgradeBtn')!.innerHTML = 'AutoUpgrade On'
    expect(document.getElementById('atNC-autoUpgrade')).toBeTruthy()
  })

  it('is idempotent — repeated syncs never duplicate a badge', () => {
    armAutoUpgrade()
    syncConflictBadges()
    syncConflictBadges()
    syncConflictBadges()
    expect(document.querySelectorAll('#atNC-autoUpgrade').length).toBe(1)
  })

  it('unmounts as soon as the conflict clears', () => {
    armAutoUpgrade()
    syncConflictBadges()
    expect(document.getElementById('atNC-autoUpgrade')).toBeTruthy()
    ;(globalThis as any).game.global.autoUpgrades = 2 // Auto No Coords — compatible
    syncConflictBadges()
    expect(document.getElementById('atNC-autoUpgrade')).toBeNull()
  })

  it('does not mount while the anchor is hidden by an inline display:none', () => {
    armAutoUpgrade()
    document.getElementById('autoUpgradeBtn')!.style.display = 'none'
    syncConflictBadges()
    expect(document.getElementById('atNC-autoUpgrade')).toBeNull()
    // ...and mounts the moment the game reveals it (main.js:1222).
    document.getElementById('autoUpgradeBtn')!.style.display = 'block'
    syncConflictBadges()
    expect(document.getElementById('atNC-autoUpgrade')).toBeTruthy()
  })

  it('does not mount while the anchor is hidden by the CLASS alone (never-revealed button)', () => {
    // The real pre-unlock state: `.autoUpgradeBtn { display:none }` applies and there is NO inline
    // style at all. Reading `anchor.style.display` here returns '' and reports the button visible —
    // the bug this test exists to keep out.
    armAutoUpgrade()
    const anchor = document.getElementById('autoUpgradeBtn')!
    anchor.style.display = '' // back to "the game has never revealed me"
    expect(anchor.style.display).toBe('') // the inline style genuinely says nothing
    expect(getComputedStyle(anchor).display).toBe('none') // ...while the class hides it
    syncConflictBadges()
    expect(document.getElementById('atNC-autoUpgrade')).toBeNull()
  })

  it("never touches the anchor's own onmouseover", () => {
    document
      .getElementById('autoUpgradeBtn')!
      .setAttribute('onmouseover', 'tooltip("AutoUpgrade", null, event)')
    armAutoUpgrade()
    syncConflictBadges()
    expect(document.getElementById('autoUpgradeBtn')!.getAttribute('onmouseover')).toBe(
      'tooltip("AutoUpgrade", null, event)',
    )
  })

  it('gives the badge its own escaped tooltip handler', () => {
    armAutoUpgrade()
    syncConflictBadges()
    const attr = document.getElementById('atNC-autoUpgrade')!.getAttribute('onmouseover')!
    expect(attr.startsWith('tooltip("')).toBe(true)
    expect(attr).toContain('customText')
    // #110: an unescaped quote would leave the handler uncompilable. Strip the legitimate escapes
    // and no stray quote may remain inside either string argument.
    const inner = attr.slice('tooltip('.length, -1)
    expect(inner.replace(/\\"/g, '')).not.toMatch(/"[^,)]*"[^,)]*"/)
  })

  it('adds no color* class to the game element (swapClass owns that namespace)', () => {
    armAutoUpgrade()
    syncConflictBadges()
    const cls = document.getElementById('autoUpgradeBtn')!.className
    expect(cls).not.toMatch(/\bcolor/)
  })

  it('removeConflictBadges clears every badge and the style block', () => {
    armAutoUpgrade()
    syncConflictBadges()
    removeConflictBadges()
    expect(document.querySelectorAll('.at-nc-badge').length).toBe(0)
    expect(document.getElementById('at-nc-style')).toBeNull()
  })

  it('a missing anchor is survivable, not fatal', () => {
    armAutoUpgrade()
    document.getElementById('autoUpgradeBtn')!.remove()
    expect(() => syncConflictBadges()).not.toThrow()
  })
})
