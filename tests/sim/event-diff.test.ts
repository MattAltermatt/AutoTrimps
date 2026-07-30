import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { lcsDiff, compareTraceFiles } from '../../scripts/sim/event-diff.mjs'
import { diffTraces } from '../../scripts/sim/trace.mjs'

// The oracle re-pin ledger's headline numbers come out of this LCS, so an off-by-one here would
// publish a wrong "N inserted / M deleted" into the manifest and nothing downstream would notice —
// the ledger is prose to every other gate. These are the tool's own guards.
//
// The load-bearing case is #4: this module exists because `diffTraces` counts by INDEX, and the
// manifest's #69 entry had to hand-count "3 events inserted" against a positional report of "1167
// divergences". That contrast is asserted here rather than asserted in a comment.

const ev = (tick: number, fn: string, args: unknown[] = []) => ({ tick, fn, args })
const counts = (a: string[], b: string[]) => {
  const { script } = lcsDiff(a, b)
  return {
    ins: script.filter((s: { op: string }) => s.op === 'ins').length,
    del: script.filter((s: { op: string }) => s.op === 'del').length,
    keep: script.filter((s: { op: string }) => s.op === 'keep').length,
  }
}

describe('event-diff: LCS over event keys', () => {
  it('identical sequences produce no edits', () => {
    expect(counts(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual({ ins: 0, del: 0, keep: 3 })
  })

  it('one inserted event is ONE insertion, however early it lands', () => {
    const before = Array.from({ length: 40 }, (_, i) => `e${i}`)
    const after = [...before.slice(0, 2), 'NEW', ...before.slice(2)]
    expect(counts(before, after)).toEqual({ ins: 1, del: 0, keep: 40 })
  })

  it('one deleted event is ONE deletion', () => {
    const before = Array.from({ length: 40 }, (_, i) => `e${i}`)
    const after = [...before.slice(0, 2), ...before.slice(3)]
    expect(counts(before, after)).toEqual({ ins: 0, del: 1, keep: 39 })
  })

  it('a substitution is one insertion plus one deletion, not one "change"', () => {
    expect(counts(['a', 'b', 'c'], ['a', 'X', 'c'])).toEqual({ ins: 1, del: 1, keep: 2 })
  })

  it('THE REASON THIS TOOL EXISTS: 3 insertions read as 3 by event and as ~everything-after by index', () => {
    // The manifest's #69 entry, in miniature: three events inserted at index 9 of a 40-event trace.
    const before = Array.from({ length: 40 }, (_, i) => ev(i, 'buyJob', [`j${i}`]))
    const after = [
      ...before.slice(0, 9),
      ev(9, 'buyBuilding', ['Barn']),
      ev(9, 'buyBuilding', ['Shed']),
      ev(9, 'buyBuilding', ['House']),
      ...before.slice(9),
    ]
    const key = (e: { fn: string; args: unknown[] }) => `${e.fn}(${JSON.stringify(e.args)})`
    expect(counts(before.map(key), after.map(key))).toEqual({ ins: 3, del: 0, keep: 40 })
    // ...while the positional diff reports every index from 9 onward, plus the three new tail slots.
    expect(diffTraces(before, after).length).toBe(34)
  })

  it('reorderings are counted, not silently absorbed', () => {
    expect(counts(['a', 'b', 'c'], ['c', 'b', 'a'])).toEqual({ ins: 2, del: 2, keep: 1 })
  })
})

describe('event-diff: compareTraceFiles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'at-eventdiff-'))
  const write = (name: string, trace: unknown) => {
    const p = join(dir, name)
    writeFileSync(p, JSON.stringify(trace), 'utf8')
    return p
  }

  it('byte-identical files report identical with zero edits', () => {
    const trace = [ev(0, 'buyJob', ['Farmer']), ev(1, 'setGather', ['metal'])]
    const a = write('a.json', trace)
    const b = write('b.json', trace)
    expect(compareTraceFiles(a, b)).toMatchObject({ identical: true, inserted: 0, deleted: 0 })
  })

  it('a TICK-only shift is zero event edits but NOT byte-identical', () => {
    // The key deliberately omits `tick`: reaching the same decision a tick earlier changed WHEN, not
    // WHAT. The file still differs, so `identical` must stay false — otherwise a ledger built from
    // this tool could claim a pure-timing re-record was a no-op file-wise, which it is not.
    const a = write('t1.json', [ev(0, 'buyJob', ['Farmer']), ev(5, 'setGather', ['metal'])])
    const b = write('t2.json', [ev(0, 'buyJob', ['Farmer']), ev(4, 'setGather', ['metal'])])
    const r = compareTraceFiles(a, b)
    expect(r).toMatchObject({ identical: false, inserted: 0, deleted: 0 })
    // ...and the shift stays legible: the sample rows carry ticks even when the counts are zero.
    expect(r.sample).toEqual([])
  })

  it('the sample rows name the changed events with their ticks', () => {
    const a = write('s1.json', [ev(0, 'buyEquipment', ['Arbalest'])])
    const b = write('s2.json', [ev(0, 'buyEquipment', ['Dagger'])])
    const r = compareTraceFiles(a, b)
    expect(r.sample).toContain('- 0: buyEquipment(["Arbalest"])')
    expect(r.sample).toContain('+ 0: buyEquipment(["Dagger"])')
  })
})
