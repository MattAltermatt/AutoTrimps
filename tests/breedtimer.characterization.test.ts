// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

// Proof-net (#46) characterization net for breedtimer.ts — pins the breed-timing math + the U2
// force-abandon actuators (the #44 surface) BEFORE the byte-golden crutch is retired for this module.
// breedtimer does real decimal.js (v7.2.4) big-number math via a DecimalBreed clone assigned at IMPORT
// time (breedtimer.ts:112), and runs addBreedingBoxTimers() at load (breedtimer.ts:232) which reaches
// into `#trimps > div.row` — so the harness seeds both `globalThis.Decimal` and that DOM node BEFORE
// the dynamic import. Free identifiers (calcHeirloomBonusDecimal/challengeActive/dailyModifiers/
// getCurrentMapObject/mapsClicked/…) are stubbed to identity; each test overrides one lever.
// Golden Decimal values were captured from the current build (the faithful-port behaviour) and pinned;
// every assertion is a specific computed string, so none is vacuous.
const G = globalThis as any
let breedtimer: typeof import('../src/modules/breedtimer')

beforeAll(async () => {
  G.MODULES = {}
  G.Decimal = (await import('decimal.js')).default
  // addBreedingBoxTimers() (runs at import) needs `#trimps > div.row`; addToolTip needs #trimpsFighting.
  // APPEND (don't clobber) — setup.ts already seeded #logBtnGroup etc. that the utils import reaches for.
  document.body.insertAdjacentHTML('beforeend', `<div id="trimps"><div class="row"></div></div><div id="trimpsFighting"></div>`)
  breedtimer = await import('../src/modules/breedtimer')
})

// Minimal deep-merge (over wins; arrays/primitives replace). Local to avoid the fixture's newGame
// overlay path — breedtimer reads plain data + two trimps methods we provide directly.
function deepAssign(base: any, over: any): any {
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return over
  if (typeof over !== 'object' || over === null || Array.isArray(over)) return over
  const out: any = { ...base }
  for (const k of Object.keys(over)) out[k] = k in base ? deepAssign(base[k], over[k]) : over[k]
  return out
}

// A neutral breeding state: potency chain all-identity, no challenges, no heirloom/geneticist mods.
// Also (re)installs the free-identifier stubs to identity. `base` potency = 0.0085 → potencyMod 1.00085.
function neutralBreed(over: Record<string, any> = {}): void {
  G.calcHeirloomBonusDecimal = (_s: string, _t: string, v: any) => v // identity (no shield bonus)
  G.challengeActive = () => false
  G.dailyModifiers = { dysfunctional: { getMult: () => 1 }, toxic: { getMult: () => 1 } }
  G.autoTrimpSettings = {}
  const base = {
    resources: {
      trimps: { employed: 100, potency: 0.0085, owned: 1000, realMax: () => 1e6, getCurrentSend: () => 0 },
    },
    permaBoneBonuses: { multitasking: { owned: 0, mult: () => 0 } },
    upgrades: { Potency: { done: 0 } },
    buildings: { Nursery: { owned: 0 } },
    unlocks: { impCount: { Venimp: 0 } },
    portal: { Pheromones: { level: 0, modifier: 0.1 } },
    singleRunBonuses: { quickTrimps: { owned: false } },
    global: { challengeActive: '', brokenPlanet: false, voidBuff: '' },
    challenges: {
      Toxicity: { stacks: 0, stackMult: 1.05 },
      Archaeology: { getStatMult: () => 1 },
      Quagmire: { getExhaustMult: () => 1 },
    },
    jobs: { Geneticist: { owned: 0 } },
  }
  G.game = deepAssign(base, over)
}

const str = (d: any) => d.toString()

describe('breedtimer — pure breed-timing math (golden masters)', () => {
  it('trimpsEffectivelyEmployed: base returns employed; multitasking scales by (1 - mult)', () => {
    neutralBreed()
    expect(breedtimer.trimpsEffectivelyEmployed()).toBe(100)
    neutralBreed({ permaBoneBonuses: { multitasking: { owned: 1, mult: () => 0.3 } } })
    expect(breedtimer.trimpsEffectivelyEmployed()).toBe(70) // 100 * (1 - 0.3)
  })

  it('potencyMod: base = potency/10 + 1', () => {
    neutralBreed()
    expect(str(breedtimer.potencyMod())).toBe('1.00085')
  })

  it('potencyMod: Potency upgrade (×1.1^done)', () => {
    neutralBreed({ upgrades: { Potency: { done: 5 } } })
    // 1.1^done uses native Math.pow (breedtimer.ts:41); its last ULP is libm/platform-dependent,
    // so the full Decimal toString tail is not portable. Pin 15 sig figs (see Geneticist below).
    expect(breedtimer.potencyMod().toPrecision(15)).toBe('1.00136893350000')
  })

  it('potencyMod: Nursery (×1.01^owned)', () => {
    neutralBreed({ buildings: { Nursery: { owned: 10 } } })
    // 1.01^owned uses native Math.pow (breedtimer.ts:42) — pin 15 sig figs (see Geneticist below).
    expect(breedtimer.potencyMod().toPrecision(15)).toBe('1.00093892880660')
  })

  it('potencyMod: Venimp imp count (×1.003^count)', () => {
    neutralBreed({ unlocks: { impCount: { Venimp: 20 } } })
    // 1.003^count uses native Math.pow (breedtimer.ts:43) — pin 15 sig figs (see Geneticist below).
    expect(breedtimer.potencyMod().toPrecision(15)).toBe('1.00090247999980')
  })

  it('potencyMod: brokenPlanet divides potency by 10', () => {
    neutralBreed({ global: { brokenPlanet: true } })
    expect(str(breedtimer.potencyMod())).toBe('1.000085')
  })

  it('potencyMod: Pheromones (×(1 + level·modifier))', () => {
    neutralBreed({ portal: { Pheromones: { level: 4, modifier: 0.1 } } })
    expect(str(breedtimer.potencyMod())).toBe('1.00119') // 0.0085 · 1.4
  })

  it('potencyMod: quickTrimps single-run bonus (×2)', () => {
    neutralBreed({ singleRunBonuses: { quickTrimps: { owned: true } } })
    expect(str(breedtimer.potencyMod())).toBe('1.0017')
  })

  it('potencyMod: voidBuff slowBreed (×0.2)', () => {
    neutralBreed({ global: { voidBuff: 'slowBreed' } })
    expect(str(breedtimer.potencyMod())).toBe('1.00017')
  })

  it('potencyMod: Geneticists (×0.98^owned — slows breeding)', () => {
    neutralBreed({ jobs: { Geneticist: { owned: 10 } } })
    // 0.98^owned uses native Math.pow (breedtimer.ts:81); its last ULP is libm/platform-dependent,
    // so the full Decimal toString tail is NOT portable (CI vs local diverged at digit ~19). Pin
    // 15 significant figures — native-double-stable — instead of the full-precision string.
    expect(breedtimer.potencyMod().toPrecision(15)).toBe('1.00069451188585')
  })

  it('potencyMod: Toxicity challenge (×stackMult^stacks)', () => {
    neutralBreed({ challenges: { Toxicity: { stacks: 5, stackMult: 1.05 } } })
    G.challengeActive = (c: string) => c === 'Toxicity'
    // stackMult^stacks uses native Math.pow (breedtimer.ts:65) — pin 15 sig figs (see Geneticist above).
    expect(breedtimer.potencyMod().toPrecision(15)).toBe('1.00108483932813')
  })

  it('potencyMod: Archaeology challenge (×getStatMult("breed"))', () => {
    neutralBreed({ challenges: { Archaeology: { getStatMult: () => 1.2 } } })
    G.challengeActive = (c: string) => c === 'Archaeology'
    expect(str(breedtimer.potencyMod())).toBe('1.00102')
  })

  it('potencyMod: Quagmire challenge (×getExhaustMult)', () => {
    neutralBreed({ challenges: { Quagmire: { getExhaustMult: () => 0.5 } } })
    G.challengeActive = (c: string) => c === 'Quagmire'
    expect(str(breedtimer.potencyMod())).toBe('1.000425')
  })

  it('potencyMod: Daily dysfunctional modifier', () => {
    neutralBreed({ global: { challengeActive: 'Daily', dailyChallenge: { dysfunctional: { strength: 3 } } } })
    G.dailyModifiers = { dysfunctional: { getMult: () => 0.7 }, toxic: { getMult: () => 1 } }
    expect(str(breedtimer.potencyMod())).toBe('1.000595')
  })

  it('potencyMod: Shield heirloom breedSpeed bonus (calcHeirloomBonusDecimal)', () => {
    neutralBreed()
    G.calcHeirloomBonusDecimal = (_s: string, _t: string, v: any) => v.mul(1.5)
    expect(str(breedtimer.potencyMod())).toBe('1.001275')
  })

  it('breedingPS: (potencyMod - 1)·10·(owned - effectivelyEmployed)', () => {
    neutralBreed()
    expect(str(breedtimer.breedingPS())).toBe('7.65') // 0.0085 · (1000 - 100)
    neutralBreed({ resources: { trimps: { owned: 500000 } } })
    expect(str(breedtimer.breedingPS())).toBe('4249.15') // 0.0085 · 499900
  })

  it('breedTimeRemaining: log10(maxBreedable/breeding)/log10(potencyMod)/10', () => {
    neutralBreed()
    expect(str(breedtimer.breedTimeRemaining())).toBe('825.41128226912832973425698391')
    neutralBreed({ resources: { trimps: { owned: 500000 } } })
    expect(str(breedtimer.breedTimeRemaining())).toBe('81.5931510469252228824874459418')
  })

  it('breedTotalTime: uses getCurrentSend for the breeding denominator', () => {
    neutralBreed() // getCurrentSend=0 → breeding == maxBreedable → log10(1) == 0 (degenerate but pinned)
    expect(str(breedtimer.breedTotalTime())).toBe('0')
    neutralBreed({ resources: { trimps: { owned: 500000, getCurrentSend: () => 300000 } } })
    expect(str(breedtimer.breedTotalTime())).toBe('41.9846341042023282232932715212')
  })
})

// The #44 surface: force-abandon actuators. Spy-log the ordered mapsClicked/runMap calls so a change
// to the abandon logic (or the coming #44 work) can't silently alter the click sequence.
describe('breedtimer — U2 force-abandon actuators (#44 surface, spy-log)', () => {
  let clicks: unknown[][]
  let ran: number
  function installAbandonStubs(mapObj: any, over: Record<string, any> = {}, settings: Record<string, boolean> = {}): void {
    clicks = []
    ran = 0
    G.mapsClicked = vi.fn((...a: unknown[]) => { clicks.push(a) })
    G.runMap = vi.fn(() => { ran++ })
    G.getCurrentMapObject = () => mapObj
    G.isActiveSpireAT = () => false
    G.disActiveSpireAT = () => false
    G.autoTrimpSettings = {}
    for (const [k, v] of Object.entries(settings)) G.autoTrimpSettings[k] = { type: 'boolean', enabled: v }
    const base = {
      global: {
        mapsActive: false, mapsUnlocked: true, preMapsActive: false,
        switchToMaps: false, switchToWorld: false, antiStacks: 0,
        lastBreedTime: 60000, lastSoldierSentAt: 0,
      },
      portal: { Anticipation: { level: 0 } },
      talents: { patience: { purchased: true } },
      jobs: { Amalgamator: { owned: 0 } },
    }
    G.game = deepAssign(base, over)
  }

  it('abandonVoidMap: no-op when ForceAbandon is off', () => {
    installAbandonStubs({ location: 'Void' }, { global: { mapsActive: true } }, { ForceAbandon: false })
    breedtimer.abandonVoidMap()
    expect(clicks).toEqual([])
  })

  it('abandonVoidMap: no-op when not in a Void map', () => {
    installAbandonStubs({ location: 'Map' }, { global: { mapsActive: true } }, { ForceAbandon: true })
    breedtimer.abandonVoidMap()
    expect(clicks).toEqual([])
  })

  it('abandonVoidMap: in Void with no Anticipation → mapsClicked(true) once', () => {
    installAbandonStubs({ location: 'Void' }, { global: { mapsActive: true }, portal: { Anticipation: { level: 0 } } }, { ForceAbandon: true })
    breedtimer.abandonVoidMap()
    expect(clicks).toEqual([[true]])
  })

  it('abandonVoidMap: Anticipation + antiStacks below limit and breedTime past limit → mapsClicked(true)', () => {
    // patience purchased → limit 45; lastBreedTime 60000/1000 = 60 ≥ 45; antiStacks 0 < 45
    installAbandonStubs({ location: 'Void' }, { global: { mapsActive: true }, portal: { Anticipation: { level: 1 } } }, { ForceAbandon: true })
    breedtimer.abandonVoidMap()
    expect(clicks).toEqual([[true]])
  })

  it('forceAbandonTrimps: no-op when ForceAbandon off / maps locked / in Void', () => {
    installAbandonStubs({ location: 'Map' }, {}, { ForceAbandon: false })
    breedtimer.forceAbandonTrimps()
    expect(clicks).toEqual([])
    installAbandonStubs({ location: 'Map' }, { global: { mapsUnlocked: false } }, { ForceAbandon: true })
    breedtimer.forceAbandonTrimps()
    expect(clicks).toEqual([])
    installAbandonStubs({ location: 'Void' }, { global: { mapsActive: true } }, { ForceAbandon: true })
    breedtimer.forceAbandonTrimps()
    expect(clicks).toEqual([])
  })

  it('forceAbandonTrimps: AutoMaps on → mapsClicked() once (no second click when switch flags clear)', () => {
    installAbandonStubs({ location: 'Map' }, {}, { ForceAbandon: true, AutoMaps: true })
    breedtimer.forceAbandonTrimps()
    expect(clicks).toEqual([[]])
    expect(ran).toBe(0)
  })

  it('forceAbandonTrimps: AutoMaps off + mapsActive → mapsClicked() then runMap()', () => {
    installAbandonStubs({ location: 'Map' }, { global: { mapsActive: true } }, { ForceAbandon: true, AutoMaps: false })
    breedtimer.forceAbandonTrimps()
    expect(clicks).toEqual([[]])
    expect(ran).toBe(1)
  })

  it('forceAbandonTrimps: AutoMaps off + not in maps → final else clicks twice, no runMap', () => {
    installAbandonStubs({ location: 'Map' }, { global: { mapsActive: false } }, { ForceAbandon: true, AutoMaps: false })
    breedtimer.forceAbandonTrimps()
    expect(clicks).toEqual([[], []]) // mapsClicked(); (switchToMaps false → skip); mapsClicked();
    expect(ran).toBe(0)
  })

  it('abandonVoidMap: Anticipation with antiStacks == limit → mapsClicked(true) via the equality elseif', () => {
    installAbandonStubs(
      { location: 'Void' },
      { global: { mapsActive: true, antiStacks: 45 }, portal: { Anticipation: { level: 1 } } },
      { ForceAbandon: true },
    ) // patience purchased → limit 45; antiStacks == 45 hits the elseif (not the time-gated first branch)
    breedtimer.abandonVoidMap()
    expect(clicks).toEqual([[true]])
  })
})
