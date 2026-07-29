import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  HEIRLOOM_RARITY_NAMES,
  HEIRLOOM_RARITY_OPTIONS,
  HEIRLOOM_RARITY_ANY,
  heirloomRarityThreshold,
} from '../../src/modules/heirloom-rarities'
import { SETTING_ID_MIGRATIONS, migrateLegacyId } from '../../src/modules/settings-migrations'

// #194 — heirloom-rarities.ts is a MIRROR of a game constant, so the thing that makes it safe is this
// net, not the comment on it. `game.heirlooms.rarityNames` is read out of the SHA-pinned clone (never
// ../trimps-game, which is absent on CI — the #67 hole) and compared element-for-element.
//
// The bug it exists to prevent already happened twice, independently: the "Rarity to Keep" dropdown
// hand-transcribed the ladder one way (missing 'Basic', inventing 'Uncommon') and heirlooms.ts's
// if/else chain hand-transcribed it the same wrong way — two copies of one fact, agreeing with each
// other and disagreeing with the game.

const ROOT = resolve(__dirname, '..', '..')
const GAME_DIR = process.env.TRIMPS_GAME_DIR || resolve(ROOT, '.trimps-game')
const config = readFileSync(resolve(GAME_DIR, 'config.js'), 'utf8')

/** `rarityNames: ['Basic', 'Common', …]` straight out of the clone. */
function cloneRarityNames(): string[] {
  const m = config.match(/rarityNames:\s*\[([^\]]*)\]/)
  if (!m) throw new Error('rarityNames not found in the clone config.js — the anchor moved, fix the net')
  return m[1]!
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

describe('heirloom rarity ladder mirrors the game (#194)', () => {
  const names = cloneRarityNames()

  it('anti-false-green: the clone really yielded a ladder', () => {
    expect(names.length).toBeGreaterThan(10)
    expect(names[0]).toBe('Basic')
  })

  it('every name and every INDEX matches the clone', () => {
    // Element-wise, not as a set: the index IS the rarity (createHeirloom, main.js:7967), so a
    // reordering that preserved membership would still silently re-point every threshold.
    expect(HEIRLOOM_RARITY_NAMES).toEqual(names)
  })

  it("does NOT contain the invented rarity the old dropdown offered", () => {
    expect(HEIRLOOM_RARITY_NAMES).not.toContain('Uncommon')
    expect(names).not.toContain('Uncommon')
  })

  it('the dropdown options are Any + the ladder, in order', () => {
    expect(HEIRLOOM_RARITY_OPTIONS).toEqual([HEIRLOOM_RARITY_ANY, ...names])
  })

  // settings-defs.ts spells the option list out as literals, because dispatch-holes (#208) reads
  // every dropdown's options off the AST and a spread would make them invisible — the same
  // constraint that keeps setting IDS literal at their callsites for settings-reverse (#68). That
  // makes it a second copy, so this is the assertion that stops it being an independent one.
  it('the literal list in settings-defs matches, element for element', () => {
    const defs = readFileSync(resolve(ROOT, 'src/modules/settings-defs.ts'), 'utf8')
    const m = defs.match(/createSetting\('HeirloomRarityToKeep'[\s\S]*?'dropdown',\s*'Any',\s*\[([^\]]*)\]/)
    expect(m, "could not find HeirloomRarityToKeep's option list — the anchor moved, fix the net").toBeTruthy()
    const literal = m![1]!
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
    expect(literal).toEqual([...HEIRLOOM_RARITY_OPTIONS])
  })
})

describe('heirloomRarityThreshold (#194)', () => {
  it('resolves each label to its game index', () => {
    expect(heirloomRarityThreshold('Basic')).toBe(0)
    expect(heirloomRarityThreshold('Common')).toBe(1)
    expect(heirloomRarityThreshold('Rare')).toBe(2)
    expect(heirloomRarityThreshold('Mutated')).toBe(12)
  })

  it("'Any' and 'Basic' agree, because Basic IS rarity 0", () => {
    expect(heirloomRarityThreshold('Any')).toBe(0)
    expect(heirloomRarityThreshold('Basic')).toBe(0)
  })

  // THE BUG. Under the old chain 'Common' resolved to 0, so selecting it filtered nothing at all —
  // every Basic heirloom still cleared `rarity >= raretokeep` and still collected the scoring bonus.
  it("'Common' now means Common, not 'everything'", () => {
    expect(heirloomRarityThreshold('Common')).toBe(1)
    expect(heirloomRarityThreshold('Common')).not.toBe(heirloomRarityThreshold('Any'))
  })

  it('an unrecognised value falls back to the permissive default', () => {
    expect(heirloomRarityThreshold('Uncommon')).toBe(0)
    expect(heirloomRarityThreshold(undefined)).toBe(0)
    expect(heirloomRarityThreshold(false)).toBe(0) // getPageSetting's answer for a missing key (#68)
  })

  it('every option the dropdown offers resolves without falling back', () => {
    for (const opt of HEIRLOOM_RARITY_OPTIONS) {
      if (opt === HEIRLOOM_RARITY_ANY || opt === 'Basic') continue
      expect(heirloomRarityThreshold(opt), opt).toBeGreaterThan(0)
    }
  })
})

describe("#194's migration preserves every existing user's threshold", () => {
  const row = SETTING_ID_MIGRATIONS.find((r) => r.from === 'raretokeep')!

  // The old ladder, as shipped. Stated here so the assertion below compares two ERAS rather than
  // restating the new one against itself.
  const OLD_THRESHOLD: Record<string, number> = {
    Any: 0, Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Magnificent: 5,
    Ethereal: 6, Magmatic: 7, Plagued: 8, Radiating: 9, Hazardous: 10, Enigmatic: 11, Mutated: 12,
  }

  /** Drive the real migration over a store holding one stored pick, and read the result. */
  function migrated(stored: string): string {
    const store: Record<string, any> = { raretokeep: stored }
    migrateLegacyId(store, row.to)
    return store[row.to]
  }

  it('is registered as an id migration onto a fresh id', () => {
    expect(row.to).toBe('HeirloomRarityToKeep')
    expect(row.transform).toBeTypeOf('function')
  })

  it('EVERY old selection lands on the same rarity it meant before', () => {
    for (const [oldLabel, oldValue] of Object.entries(OLD_THRESHOLD)) {
      expect(heirloomRarityThreshold(migrated(oldLabel)), `${oldLabel} -> ${migrated(oldLabel)}`).toBe(oldValue)
    }
  })

  it('every migrated value is one the new dropdown actually offers', () => {
    for (const oldLabel of Object.keys(OLD_THRESHOLD)) {
      expect(HEIRLOOM_RARITY_OPTIONS, oldLabel).toContain(migrated(oldLabel))
    }
  })

  // THE PROPERTY A VALUE-KEYED MIGRATION COULD NOT HAVE. 'Common' survives into the new list with a
  // NEW meaning, so a migration triggered by the VALUE would re-fire on every boot and overwrite a
  // deliberate new-build selection — permanently, since the user could never make it stick. Riding
  // the id move means the trigger is the retired KEY, which is gone after the first run.
  it('is idempotent: a second pass does not touch an already-migrated store', () => {
    const store: Record<string, any> = { raretokeep: 'Common' }
    expect(migrateLegacyId(store, row.to)).toBe('raretokeep')
    expect(store[row.to]).toBe('Basic')
    expect(store).not.toHaveProperty('raretokeep')

    // Second pass — nothing left to move.
    expect(migrateLegacyId(store, row.to)).toBeNull()
    expect(store[row.to]).toBe('Basic')
  })

  it("a NEW user's deliberate 'Common' is never rewritten", () => {
    const store: Record<string, any> = { HeirloomRarityToKeep: 'Common' }
    expect(migrateLegacyId(store, row.to)).toBeNull()
    expect(store.HeirloomRarityToKeep).toBe('Common')
    expect(heirloomRarityThreshold(store.HeirloomRarityToKeep)).toBe(1)
  })

  // The frozen preset blobs carry a few settings as whole RECORDS rather than bare strings, so the
  // transform has to reach `.selected` as well.
  it('migrates the record form a preset import can carry', () => {
    const store: Record<string, any> = {
      raretokeep: { id: 'raretokeep', name: 'Rarity to Keep', selected: 'Uncommon' },
    }
    migrateLegacyId(store, row.to)
    expect(store[row.to].selected).toBe('Common')
    expect(store[row.to].id).toBe('HeirloomRarityToKeep')
    expect(heirloomRarityThreshold(store[row.to].selected)).toBe(1)
  })

  it('leaves a rarity whose meaning did not move completely alone', () => {
    for (const label of ['Rare', 'Legendary', 'Mutated', 'Any']) {
      expect(migrated(label), label).toBe(label)
    }
  })
})
