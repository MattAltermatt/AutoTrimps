import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { REGIONS } from '../../src/modules/custom-ui/regions'
import { RESOURCES, POP } from '../../src/modules/custom-ui/tiles/sampler'

// Phase 1: the whole HUD is adopted as #wrapper, so every game HUD region is covered
// transitively (the game keeps rendering into its own containers inside our shell). This net
// asserts #wrapper (the adopted root) is registered and that it is a real element in the game's
// index.html — the mechanized form of "our UI is missing something". It grows to per-region
// granularity as regions graduate to AT-native rendering.
describe('custom-ui completeness', () => {
  it('the adopted HUD root #wrapper is registered', () => {
    const covered = new Set(REGIONS.map((r) => r.containerId))
    expect(covered.has('wrapper')).toBe(true)
  })

  it('#wrapper exists in the game index.html (the seam is real)', () => {
    // The SHA-PINNED clone (repo-root .trimps-game/), which npm ci materializes and which exists on
    // CI — NOT ../trimps-game (the dev workspace), which is absent on the runner (#67 hole).
    const html = readFileSync(resolve(process.cwd(), '.trimps-game/index.html'), 'utf8')
    expect(html).toMatch(/id=["']wrapper["']/)
  })

  // ⚠️ DERIVED, NOT RESTATED (2026-07-28 instrument audit). This assertion used to re-type the seven
  // resource ids as a literal, which made it a THIRD copy of a list that already exists twice:
  // sampler.ts:1 RESOURCES (what production actually samples and renders) and regions.ts:18
  // natives (the manifest this net polices). Nothing asserted the copies agreed, so adding a
  // resource to sampler.ts — a real production change — left REGIONS claiming the old seven and
  // this net green, because it only ever compared REGIONS against a hand-typed echo of itself.
  //
  // Deriving from RESOURCES makes the net catch that drift: the manifest must match what renders.
  // (See also: a corrected second copy of a code-owned fact just re-rots — BuyJobsNew's seven
  // hand-copied tiers were all wrong.)
  it('the resource region manifest MATCHES what the sampler actually renders', () => {
    const region = REGIONS.find((r) => r.id === 'resources')!
    expect(region.status).toBe('at-native')
    expect(region.natives).toEqual([...RESOURCES])
  })

  it('every rendered resource is a real container in the game index.html', () => {
    const html = readFileSync(resolve(process.cwd(), '.trimps-game/index.html'), 'utf8')
    // Anti-false-green: an empty RESOURCES would make the loop below vacuous.
    expect(RESOURCES.length).toBeGreaterThan(0)
    for (const id of RESOURCES) expect(html).toMatch(new RegExp(`id=["']${id}["']`))
  })

  it('the population region manifest MATCHES the sampler POP id, a real container', () => {
    const region = REGIONS.find((r) => r.id === 'population')!
    expect(region.status).toBe('at-native')
    expect(region.natives).toEqual([POP])
    const html = readFileSync(resolve(process.cwd(), '.trimps-game/index.html'), 'utf8')
    expect(html).toMatch(new RegExp(`id=["']${POP}["']`))
  })

  it('#149: the Turkimp tile mirrors a real native (#turkimpTime exists in the clone)', () => {
    // The turkimp tile reads #turkimpTime.textContent (drift-free mirror). If an upstream bump renamed
    // that span, the mirror would silently go blank — this net turns that into a red test instead.
    const html = readFileSync(resolve(process.cwd(), '.trimps-game/index.html'), 'utf8')
    expect(html).toMatch(/id=["']turkimpTime["']/)
  })
})
