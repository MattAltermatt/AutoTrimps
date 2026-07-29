// @vitest-environment node
//
// Regression net for #165 / #174 / #190 — one broken contract with three reported faces.
// `RABfarmstring` is declared `textValue` (settings-defs.ts:2776) and ab.ts stored a nested ARRAY
// into it. From that: ABfarmswitch indexed a real string CHARACTER-wise and wiped the loadout every
// tick (#165), the control rendered the infinity glyph because an array has no `.substring` (#190),
// and the "best-ever" scoreboard was never flushed to localStorage (#174).
//
// These tests boot the REAL v5.10.1 clone in jsdom and drive the REAL `autoBattle` — its own items
// table, its own equip()/resetCombat()/getMaxItems(), its own `loadHide` default. Nothing is mocked,
// so the semantics under test are the game's, not my model of them.
import { describe, it, expect, beforeEach } from 'vitest'
import { bootGame } from '../scripts/sim/boot.mjs'
import { TEST_BUNDLE } from './sim/bundle'

function boot() {
  const { window } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE }) as unknown as {
    window: Record<string, any>
  }
  return { window, ab: window.autoBattle }
}

const equippedNames = (ab: any): string[] =>
  Object.keys(ab.items).filter((i) => ab.items[i].equipped)

const ownedNames = (ab: any): string[] => Object.keys(ab.items).filter((i) => ab.items[i].owned)

/** Read the value straight off the store, so the test sees what is PERSISTED, not a parsed view. */
const storedValue = (window: Record<string, any>): any =>
  window.autoTrimpSettings.RABfarmstring.value

describe('parseABfarmstring — the one reader for a setting that used to have three', () => {
  let window: Record<string, any>

  beforeEach(() => {
    ;({ window } = boot())
  })

  it('POSITIVE CONTROL: the parser is really exported from the shipped bundle', () => {
    // Anti-false-green. Every test below routes through this function; if the bridge stopped
    // publishing it these would all "pass" by throwing somewhere the expectation never reached.
    expect(typeof window.parseABfarmstring).toBe('function')
    expect(window.parseABfarmstring('3,500,Sword,Pants')).toEqual({
      level: 3,
      dust: 500,
      items: ['Sword', 'Pants'],
    })
  })

  it('accepts the PRE-FIX nested array a veteran localStorage still holds', () => {
    // The whole point of accepting it: dropping this shape would silently wipe the scoreboard of
    // every existing user on upgrade. `String([5,1234,['Sword','Pants']])` is "5,1234,Sword,Pants",
    // so the two encodings are the same data and must parse to the same thing.
    const asArray = window.parseABfarmstring([5, 1234, ['Sword', 'Pants']])
    const asString = window.parseABfarmstring('5,1234,Sword,Pants')
    expect(asArray).toEqual({ level: 5, dust: 1234, items: ['Sword', 'Pants'] })
    expect(asArray).toEqual(asString)
  })

  it('rejects every unset encoding, so callers treat them as "no target"', () => {
    // '-1' is the declared default; `false` is what getPageSetting returns for a key absent from an
    // existing user's store (#68); 'undefined' is what a veteran's serialized store actually holds.
    for (const unset of ['-1', '', 'undefined', false, undefined, null, 0]) {
      expect(window.parseABfarmstring(unset)).toBeNull()
    }
  })

  it('rejects a level that is not a real enemy level rather than coercing it', () => {
    // This number is assigned STRAIGHT to autoBattle.enemyLevel, so leniency here is a live defect.
    // `parseFloat` would accept "12abc" as 12 — the near-miss fix this case exists to kill.
    expect(window.parseABfarmstring('12abc,500,Sword')).toBeNull()
    // Number('') and Number(null) are both 0, so a blank or nulled first field must not become 0.
    expect(window.parseABfarmstring('0,500,Sword')).toBeNull()
    expect(window.parseABfarmstring(',500,Sword')).toBeNull()
    expect(window.parseABfarmstring('-3,500,Sword')).toBeNull()
  })

  it('normalises a missing or non-finite dust figure to 0 instead of poisoning comparisons', () => {
    // ABfarmsave compares `current.dust < bestdust`. NaN loses that comparison in both directions,
    // which is exactly how the old code got stuck.
    expect(window.parseABfarmstring('5,,Sword')!.dust).toBe(0)
    expect(window.parseABfarmstring('5,NaN,Sword')!.dust).toBe(0)
    expect(window.parseABfarmstring('5,-9,Sword')!.dust).toBe(0)
  })

  it('tolerates a level-and-dust-only string (no items)', () => {
    expect(window.parseABfarmstring('7,42')).toEqual({ level: 7, dust: 42, items: [] })
  })
})

describe('#165 — ABfarmswitch must not treat a STRING as a positional array', () => {
  let window: Record<string, any>
  let ab: any

  beforeEach(() => {
    ;({ window, ab } = boot())
  })

  it('POSITIVE CONTROL: the fixture is the real game, with loadHide armed', () => {
    // loadHide defaulting to 1 (objects.js:1018-1021) is what turned #165 from "loadout blanked"
    // into "entire owned item list hidden". If it were off, the catastrophe test below would be
    // testing a weaker bug than the one that shipped.
    expect(typeof ab.resetCombat).toBe('function')
    expect(typeof ab.getMaxItems).toBe('function')
    expect(ab.settings.loadHide.enabled).toBe(1)
    expect(ownedNames(ab).length).toBeGreaterThan(1)
  })

  it('equips the items a pasted share string names, instead of wiping the loadout', () => {
    // The tooltip invites exactly this: "Safe to share with other AT users." Pre-fix, `[0]` was the
    // character "1" and `[2]` was ",", so `",".indexOf(item)` was -1 for every equipped item, the
    // apply block ran, and it unequipped everything and hid every owned item.
    const owned = ownedNames(ab)
    const want = owned.slice(0, Math.min(2, ab.getMaxItems()))
    window.setPageSetting('RABfarmstring', `3,0,${want.join(',')}`)

    window.ABfarmswitch()

    expect(equippedNames(ab).sort()).toEqual([...want].sort())
    // The load-bearing half: nothing the player OWNS may be left hidden by a successful switch.
    for (const name of want) expect(ab.items[name].hidden).toBe(false)
    expect(ab.enemyLevel).toBe(3)
  })

  it('does NOT blank-and-hide the whole owned list when the string is unparseable', () => {
    // The shipped behaviour for a bad value was: zero items equipped, every owned item hidden,
    // resetCombat(true) — every tick, forever, with no way back because resetStats() zeroes
    // sessionEnemiesKilled so ABfarmsave's `> 8` guard can never pass again.
    const before = equippedNames(ab)
    expect(before.length).toBeGreaterThan(0) // the game's real default loadout

    window.setPageSetting('RABfarmstring', 'total,garbage,not,a,farm,string')
    window.ABfarmswitch()

    expect(equippedNames(ab)).toEqual(before)
    expect(ownedNames(ab).filter((i) => ab.items[i].hidden)).toEqual([])
  })

  it('leaves combat alone entirely when the value is the untouched default', () => {
    const resets: number[] = []
    const realReset = ab.resetCombat.bind(ab)
    ab.resetCombat = (...args: unknown[]) => {
      resets.push(1)
      return realReset(...args)
    }

    expect(storedValue(window)).toBe('-1')
    window.ABfarmswitch()

    expect(resets).toEqual([])
  })
})

describe('#174 / #190 — ABfarmsave must persist a STRING, and flush it', () => {
  let window: Record<string, any>
  let ab: any

  beforeEach(() => {
    ;({ window, ab } = boot())
    // Put the session past ABfarmsave's own kill/loss guards so the write path is reachable.
    ab.enemyLevel = 4
    ab.sessionEnemiesKilled = 50
    ab.sessionTrimpsKilled = 0
  })

  it('#190: stores a string, never an array, so the control can render it', () => {
    window.ABfarmsave()

    const value = storedValue(window)
    expect(Array.isArray(value)).toBe(false)
    expect(typeof value).toBe('string')
    // An array had no `.substring`, which is precisely why updateCustomButtons fell through to the
    // infinity face. Requiring the property is requiring the contract the type tag promises.
    expect(typeof value.substring).toBe('function')
    expect(window.parseABfarmstring(value)!.level).toBe(4)
  })

  it('#174: flushes to localStorage — the scoreboard survives a reload', () => {
    // setPageSetting only mutates the in-memory store (utils.ts:141-142). saveSettings() is the one
    // writer to localStorage (utils.ts:181-184) and ab.ts never called it, so the recorded best was
    // lost on every reload unless the user happened to click some unrelated AT control.
    window.localStorage.removeItem('autoTrimpSettings')
    window.ABfarmsave()

    const raw = window.localStorage.getItem('autoTrimpSettings')
    expect(raw).not.toBeNull()
    expect(raw).toContain(storedValue(window))
  })

  it('#190: updateCustomButtons renders the saved string, not the "unset" infinity glyph', () => {
    window.ABfarmsave()
    const saved = storedValue(window)

    // updateCustomButtons runs the VISIBILITY gate before its render loop, and the loop skips any
    // control whose parent is display:none — so the row has to be armed through the real gate
    // (settings-visibility.ts:944 wants radonsettings == 1 and RAB on). Forcing the parent's display
    // by hand instead would pre-seed the very value the assertion depends on, which is how a
    // visibility test comes to pass against a build with the show call deleted.
    window.setPageSetting('radonsettings', 1)
    window.setPageSetting('RAB', true)

    window.updateCustomButtons()

    const elem = window.document.getElementById(window.autoTrimpSettings.RABfarmstring.id)
    expect(elem).not.toBeNull()
    expect(elem.parentNode.style.display).toBe('inline-block') // the value only turnOn writes
    expect(elem.textContent).toContain(saved.substring(0, 21))
    expect(elem.innerHTML).not.toContain('icon-infinity')
  })

  it('#190: renders the PRE-FIX array a veteran still has stored, rather than claiming "unset"', () => {
    // This is the case the render hardening actually exists for, and the reason it is not redundant
    // with the write-side fix: an existing user upgrades carrying `[level, dust, [items]]` in
    // localStorage, and until ABfarmsave next beats their record, that array is what the control has
    // to render. Asserting only against a freshly-written string passes just as well with the render
    // branch reverted — the write fix alone satisfies it — so that assertion proves nothing here.
    window.autoTrimpSettings.RABfarmstring.value = [5, 1234, ['Sword', 'Pants']]
    window.setPageSetting('radonsettings', 1)
    window.setPageSetting('RAB', true)

    window.updateCustomButtons()

    const elem = window.document.getElementById(window.autoTrimpSettings.RABfarmstring.id)
    expect(elem.parentNode.style.display).toBe('inline-block') // the value only turnOn writes
    expect(elem.innerHTML).not.toContain('icon-infinity')
    expect(elem.textContent).toContain('5,1234,Sword,Pants')
  })

  it('recovers from an unparseable stored value instead of keeping it forever', () => {
    // The old first branch fired only on the exact literal '-1'; anything else fell through to a
    // comparison that a garbage value could never win, so a bad paste was permanent.
    window.setPageSetting('RABfarmstring', 'not a farm string')
    window.ABfarmsave()

    expect(window.parseABfarmstring(storedValue(window))).not.toBeNull()
  })

  it('does not overwrite a better recorded score with a worse one', () => {
    // The scoreboard semantic itself: only a genuine improvement replaces the record.
    window.setPageSetting('RABfarmstring', '9,999999999,Sword')
    window.ABfarmsave()

    expect(window.parseABfarmstring(storedValue(window))).toEqual({
      level: 9,
      dust: 999999999,
      items: ['Sword'],
    })
  })
})
