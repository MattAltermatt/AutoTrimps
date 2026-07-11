// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// Regression net for #42: AutoMaps→Unique re-ran a COMPLETED unique map forever. Each unique has a
// "natural" selector branch (fires first, includes a one-time reward/completion check) and an
// AMU-checkbox branch (AutoMaps==2). The AMU branches lacked the completion check, so once the reward
// was earned the natural branch went false and the AMU branch re-selected the (non-recycling) map
// every tick — pure wasted time (unique rewards are one-time). Fix: AND the natural branch's
// completion flag into the AMU branch — but ONLY for the 4 one-time uniques (Wall, Anger, Block,
// Trimple). The Prison / Bionic Wonderland rewards are REPEATABLE and Imploding Star has no natural
// branch, so those AMU branches are intentionally left unguarded. selectUniqueMap was extracted from
// autoMap to make this testable (autoMap can't be driven to the loop without a deep progressed save).

let maps: typeof import('../src/modules/maps')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {} // maps.ts writes MODULES.maps at load
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).challengeActive = () => false // bare global used in the Prison branch
  ;(globalThis as any).getPlayerCritChance = () => 0 // maps.ts reads this at load (maps.ts:47)
  maps = await import('../src/modules/maps')
})

// Seed the real getPageSetting store (utils reads autoTrimpSettings). AutoMaps=2 arms AMU mode;
// each AMU flag + BuyShieldblock is boolean; TrimpleZ is a numeric value.
function setSettings(s: { autoMaps?: number; amu?: string[]; trimpleZ?: number; buyShieldblock?: boolean }) {
  const store: any = {
    AutoMaps: { type: 'multitoggle', value: String(s.autoMaps ?? 2) },
    TrimpleZ: { type: 'value', value: String(s.trimpleZ ?? 0) },
    BuyShieldblock: { type: 'boolean', enabled: s.buyShieldblock ?? false },
  }
  for (const f of ['AMUwall', 'AMUanger', 'AMUblock', 'AMUtrimple', 'AMUprison', 'AMUbw', 'AMUstar']) {
    store[f] = { type: 'boolean', enabled: (s.amu ?? []).includes(f) }
  }
  ;(globalThis as any).autoTrimpSettings = store
}

// A world past every unique's zone gate, one unique in mapsOwnedArray, and completion flags a test
// can flip. portalBtn display 'none' = Anger reward NOT yet earned (natural/AMU may fire).
function setGame(mapName: string, over: { bountyEarned?: boolean; shieldblockAllowed?: boolean; angerDone?: boolean; trimpleDone?: boolean; challengeActive?: string; runningC2?: boolean } = {}) {
  const portal = document.createElement('div')
  portal.id = 'portalBtn'
  portal.style.display = over.angerDone ? 'block' : 'none'
  document.body.innerHTML = ''
  document.body.appendChild(portal)
  ;(globalThis as any).game = {
    global: {
      world: 300,
      runningChallengeSquared: over.runningC2 ?? false,
      challengeActive: over.challengeActive ?? '',
      mapsOwnedArray: { 0: { name: mapName, noRecycle: true, id: `${mapName}-id`, difficulty: 2 } },
    },
    upgrades: {
      Bounty: { allowed: over.bountyEarned ? 1 : 0 },
      Shieldblock: { allowed: over.shieldblockAllowed ? 1 : 0 },
    },
    talents: { bounty: { purchased: false }, portal: { purchased: false } },
    mapUnlocks: { AncientTreasure: { canRunOnce: !over.trimpleDone } },
  }
}

beforeEach(() => setSettings({ autoMaps: 2 }))

describe('#42: completed one-time uniques are NOT re-selected by the AMU branch', () => {
  it('The Block: picked while unearned, SKIPPED once Shieldblock is allowed', () => {
    setSettings({ autoMaps: 2, amu: ['AMUblock'] })
    setGame('The Block', { shieldblockAllowed: false })
    expect(maps.selectUniqueMap()).toBe('The Block-id')
    setGame('The Block', { shieldblockAllowed: true }) // reward earned
    expect(maps.selectUniqueMap()).toBeUndefined()
  })

  it('Trimple Of Doom: picked while AncientTreasure runnable, SKIPPED once claimed', () => {
    // trimpleZ (500) > world (300) makes the natural branch's `world >= treasure` false, so control
    // reaches the AMU else-if — the case the AMU checkbox exists for (run Trimple before the zone gate).
    setSettings({ autoMaps: 2, amu: ['AMUtrimple'], trimpleZ: 500 })
    setGame('Trimple Of Doom', { trimpleDone: false })
    expect(maps.selectUniqueMap()).toBe('Trimple Of Doom-id')
    setGame('Trimple Of Doom', { trimpleDone: true }) // canRunOnce → false
    expect(maps.selectUniqueMap()).toBeUndefined()
  })

  // The Wall + Dimension of Anger have NO AMU branch (deleted as dead — the natural branch already
  // runs them until the reward is earned, regardless of the checkbox). The regression they guard —
  // a COMPLETED Wall/Anger must not be re-selected — is what matters here.
  it('The Wall: picked while Bounty unearned (natural), SKIPPED once Bounty is allowed', () => {
    setGame('The Wall', { bountyEarned: false })
    expect(maps.selectUniqueMap()).toBe('The Wall-id')
    setGame('The Wall', { bountyEarned: true })
    expect(maps.selectUniqueMap()).toBeUndefined()
  })

  it('Dimension of Anger: picked while portal unearned (natural), SKIPPED once portal obtained', () => {
    setGame('Dimension of Anger', { angerDone: false })
    expect(maps.selectUniqueMap()).toBe('Dimension of Anger-id')
    setGame('Dimension of Anger', { angerDone: true }) // portalBtn now visible
    expect(maps.selectUniqueMap()).toBeUndefined()
  })
})

describe('#42: repeatable / flagless uniques are still selected by AMU (NOT over-guarded)', () => {
  it('The Prison keeps being selectable (repeatable reward — no completion guard)', () => {
    setSettings({ autoMaps: 2, amu: ['AMUprison'] })
    setGame('The Prison')
    expect(maps.selectUniqueMap()).toBe('The Prison-id')
  })

  it('Bionic Wonderland keeps being selectable (repeatable reward)', () => {
    setSettings({ autoMaps: 2, amu: ['AMUbw'] })
    setGame('Bionic Wonderland')
    expect(maps.selectUniqueMap()).toBe('Bionic Wonderland-id')
  })

  it('Imploding Star keeps being selectable (no natural/completion branch)', () => {
    setSettings({ autoMaps: 2, amu: ['AMUstar'] })
    setGame('Imploding Star')
    expect(maps.selectUniqueMap()).toBe('Imploding Star-id')
  })
})

describe('#42: the natural (non-AMU) path is unchanged', () => {
  it('The Block natural branch still fires (BuyShieldblock) even without the AMU checkbox', () => {
    setSettings({ autoMaps: 1, buyShieldblock: true }) // AutoMaps=1 → no AMU flags at all
    setGame('The Block', { shieldblockAllowed: false })
    expect(maps.selectUniqueMap()).toBe('The Block-id')
  })
})
