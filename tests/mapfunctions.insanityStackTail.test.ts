// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'

// Found by the code review of #162: the paired-cell fix OPENED a non-terminating path here.
//
// `Rinsanity` reads its stack target positionally, exactly as the cell list is read:
//
//     insanitystackszones = insanityfarmstacks[insanitystacksfarmindex]      (mapfunctions.ts:883)
//     if (should && insanityfarmzone.includes(world) && insanitystackszones != insanitystacks)
//         Rshouldinsanityfarm = true                                        (mapfunctions.ts:888)
//
// With a STACK list shorter than the zone list, `insanitystackszones` is `undefined`, the
// `> maxinsanity` clamp does not fire (`undefined > n` is false), and `undefined != <number>` is
// true for every possible stack count — so the farm target can never be met and the condition is
// permanently true.
//
// Before #162 that state was masked at the *caller*: the same short-list shape in the CELL setting
// closed the cell gate first, so `Rinsanity(true, …)` was never reached. Making the cell fallback
// per-index removed that accidental cover. This is the `-1`-is-not-Infinite family — a silent no-op
// converted into a non-terminating condition — so the guard belongs here, at the read.

let mapfunctions: typeof import('../src/modules/mapfunctions')

beforeAll(async () => {
  ;(globalThis as any).MODULES = {}
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).getPlayerCritChance = () => 0
  mapfunctions = await import('../src/modules/mapfunctions')
})

const setMV = (id: string, value: unknown) => {
  ;(globalThis as any).autoTrimpSettings[id] = { type: 'multiValue', value }
}

/** Two configured Insanity zones; `stacks` is the list under test. */
function arm(opts: { world: number; stacks: number[]; insanity: number }) {
  ;(globalThis as any).autoTrimpSettings = {}
  ;(globalThis as any).Rshouldinsanityfarm = false
  setMV('Rinsanityfarmzone', [50, 60])
  setMV('Rinsanityfarmlevel', [1, 1])
  setMV('Rinsanityfarmstack', opts.stacks)
  ;(globalThis as any).game = {
    global: { world: opts.world, lastClearedCell: 98, challengeActive: 'Insanity' },
    challenges: { Insanity: { insanity: opts.insanity, maxInsanity: 20 } },
  }
  mapfunctions.Rinsanity(true, false, false)
  return (globalThis as any).Rshouldinsanityfarm as boolean
}

describe('Rinsanity — a stack list shorter than the zone list must not farm forever', () => {
  it('ANTI-FALSE-GREEN: the harness really drives the farm decision', () => {
    // Zone 50 is index 0, which HAS a stack entry: 10 stacks wanted, 3 held → farm.
    expect(arm({ world: 50, stacks: [10, 10], insanity: 3 })).toBe(true)
    // ...and it stands down once the target is met, which is what "terminating" means here.
    expect(arm({ world: 50, stacks: [10, 10], insanity: 10 })).toBe(false)
  })

  it('THE HAZARD: an entry the user never filled in must not read as an unmeetable target', () => {
    // Zone 60 is index 1, and the list has one entry, so the target is `undefined`.
    // `undefined != 3`, `undefined != 10`, `undefined != 20` — true at EVERY stack count, so before
    // the guard this farm could never be satisfied.
    for (const insanity of [0, 3, 10, 20]) {
      expect(arm({ world: 60, stacks: [10], insanity }), `insanity ${insanity}`).toBe(false)
    }
  })

  it('a NaN entry is refused the same way', () => {
    // getPageSetting maps a multiValue through parseInt, so a non-numeric entry is NaN, and
    // `NaN != anything` is also always true.
    for (const insanity of [0, 10, 20]) {
      expect(arm({ world: 60, stacks: [10, NaN], insanity }), `insanity ${insanity}`).toBe(false)
    }
  })

  it('a REAL target at the same index still works, met and unmet', () => {
    // The guard must refuse only un-interpretable targets, not close the feature.
    expect(arm({ world: 60, stacks: [10, 15], insanity: 3 })).toBe(true)
    expect(arm({ world: 60, stacks: [10, 15], insanity: 15 })).toBe(false)
  })

  it('the maxInsanity clamp still applies, so an over-cap target is still reachable', () => {
    // 99 clamps to maxInsanity 20 (mapfunctions.ts:884), so at 20 held the target IS met — a guard
    // placed before the clamp instead of after it would break this.
    expect(arm({ world: 60, stacks: [10, 99], insanity: 20 })).toBe(false)
    expect(arm({ world: 60, stacks: [10, 99], insanity: 19 })).toBe(true)
  })
})
