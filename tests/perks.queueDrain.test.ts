// @vitest-environment node
//
// Regression net for #171 — the priority queue that could not drain, and the four loops that assumed
// it always would.
//
// `legacy/FastPriorityQueue.js` was never a clean vendor drop. `git log --follow` shows the fork
// hand-adapted upstream in 2016 to strip its CommonJS tail and, in the same edit, rewrote poll()'s
// else-branch into `else if (this.size == 0) --this.size` — a construct that appears in ZERO upstream
// commits. It inverted both edge cases: at size 1 the element was returned WITHOUT decrementing (so
// the queue never drained and isEmpty() was permanently false), and at size 0 a stale element came
// back and `size` went to -1, after which `add` writes to `array[-1]` and drops it.
//
// perks.ts's four pass-1 loops drop a perk only by NOT re-adding it when it is maxed. So once the last
// queued perk hit its max, poll() handed back that same maxed object forever, the body became a no-op,
// and the tab FROZE mid-portal — unattended, because portal.ts calls clickAllocate() automatically when
// AutoAllocatePerks is on, and the triggering ratio config persists to localStorage and re-hangs on the
// next portal.
//
// ⚠️ WHY THE CAP, AND NOT A TIMEOUT. The failure is a synchronous infinite loop. Vitest's per-test
// timeout cannot interrupt one — it would hang the worker rather than fail the test, so a red would
// take CI down instead of reporting. Capping iterations at the consumer converts "runs forever" into
// a thrown, catchable, FAST assertion. And the cap is installed by replacing a PROPERTY on the
// AutoPerks object, which the call sites read at call time — not by reassigning a bare global, which
// would not intercept module-internal calls and would report a confident 0 (#127/#129).
import { describe, it, expect, beforeEach } from 'vitest'
import FastPriorityQueue from 'fastpriorityqueue'
import { bootGame } from '../scripts/sim/boot.mjs'
import { TEST_BUNDLE } from './sim/bundle'
import { readFileSync } from 'node:fs'

const ITERATION_CAP = 200_000

function boot(): Record<string, any> {
  const { window } = bootGame({}) as unknown as { window: Record<string, any> }
  Object.assign(window, {
    GM_getValue: () => undefined,
    GM_setValue: () => {},
    GM_xmlhttpRequest: () => {},
    unsafeWindow: window,
  })
  window.eval(readFileSync(TEST_BUNDLE, 'utf8'))
  window.loadPageVariables?.()
  return window
}

describe('#171 — the queue must actually drain', () => {
  it('poll() removes the last element and reports empty', () => {
    const q = new FastPriorityQueue<{ n: string; e: number }>((a, b) => a.e > b.e)
    q.add({ n: 'A', e: 2 })
    q.add({ n: 'B', e: 1 })

    expect(q.poll()!.n).toBe('A')
    expect(q.size).toBe(1)
    expect(q.poll()!.n).toBe('B')
    // The whole bug in one assertion: pre-fix `size` stuck at 1 here and B came back forever.
    expect(q.size).toBe(0)
    expect(q.isEmpty()).toBe(true)
  })

  it('poll() on an empty queue returns undefined and does NOT drive size negative', () => {
    // The second inverted edge case. A negative size made isEmpty() permanently false AND made the
    // next add() write to array[-1], silently dropping the element.
    const q = new FastPriorityQueue<number>((a, b) => a > b)
    expect(q.poll()).toBeUndefined()
    expect(q.size).toBe(0)
    q.add(7)
    expect(q.size).toBe(1)
    expect(q.poll()).toBe(7)
  })

  it('drains in comparator order, so the fix did not trade a hang for a scrambled heap', () => {
    // Parity guard. The adversarial pass measured zero allocation differences between the broken and
    // fixed queues across 4,240 perk configurations, so #171 is a pure bug fix — but that holds only
    // if the replacement really is a correct max-heap on the same comparator contract
    // (`outranks(a,b) === true` ⟺ a leaves first), which is NOT the Array#sort convention.
    const q = new FastPriorityQueue<number>((a, b) => a > b)
    const input = [5, 1, 9, 3, 9, 0, 7, 2]
    input.forEach((n) => q.add(n))

    const drained: number[] = []
    while (!q.isEmpty()) drained.push(q.poll()!)

    expect(drained).toEqual([...input].sort((a, b) => b - a))
    expect(q.size).toBe(0)
  })
})

describe('#171 — AutoPerks pass 1 must terminate when every queued perk is maxed', () => {
  let window: Record<string, any>

  beforeEach(() => {
    window = boot()
  })

  /**
   * Cap iterations at the consumer. Returns the observed loop count, or throws if the cap trips.
   * Replacing the property works because every call site is `AutoPerks.calculatePrice(...)`, resolved
   * on the object at call time.
   */
  function withIterationCap(perks: Record<string, any>, run: () => void): number {
    const real = perks.calculatePrice.bind(perks)
    let calls = 0
    perks.calculatePrice = (perk: any, level: any) => {
      if (++calls > ITERATION_CAP) throw new Error('ITERATION_CAP_EXCEEDED')
      return real(perk, level)
    }
    try {
      run()
    } finally {
      perks.calculatePrice = real
    }
    return calls
  }

  /**
   * Put the perks in the state `spendHelium` is actually entered in.
   *
   * `initializePerks()` leaves every `updatedValue` holding the 11-element preset ARRAY, and
   * `initialise()` immediately overwrites it via `updatePerkRatios()` with the scalar from each DOM
   * ratio box — so production never calls `spendHelium` on the array state. Driving it there anyway
   * makes `calculateIncrease` return NaN, which #189's guard now correctly refuses, and the allocator
   * returns false after ONE calculatePrice call. A test written against that state is testing an
   * unreachable configuration, not the allocator.
   */
  function seedScalarRatios(perks: Record<string, any>, ratio = 1): void {
    for (const perk of perks.getVariablePerks()) perk.updatedValue = ratio
  }

  it('POSITIVE CONTROL: the allocator really runs, and the cap really can fire', () => {
    // Anti-false-green, both directions. If spendHelium bailed early on a guard, the termination test
    // below would "pass" by never entering the loop at all.
    const AutoPerks = window.AutoPerks
    expect(typeof AutoPerks.spendHelium).toBe('function')
    seedScalarRatios(AutoPerks)

    const calls = withIterationCap(AutoPerks, () => {
      expect(AutoPerks.spendHelium(1e6)).not.toBe(false) // it really allocated, not bailed
    })
    // Many calls, not one: one would mean it refused at the ratio guard before entering the loop.
    expect(calls).toBeGreaterThan(10)

    // And prove the instrument bites: a cap of 1 must throw, or a zero from it means nothing.
    seedScalarRatios(AutoPerks)
    const real = AutoPerks.calculatePrice.bind(AutoPerks)
    let n = 0
    AutoPerks.calculatePrice = (p: any, l: any) => {
      if (++n > 1) throw new Error('ITERATION_CAP_EXCEEDED')
      return real(p, l)
    }
    expect(() => AutoPerks.spendHelium(1e6)).toThrow('ITERATION_CAP_EXCEEDED')
    AutoPerks.calculatePrice = real
  })

  it('terminates with an all-maxed queue instead of spinning forever', () => {
    // #171's stated repro: an Overkill-only CUSTOM ratio. Only perks with a non-zero ratio are queued
    // (perks.ts), so zeroing every other ratio leaves a queue whose entire contents can hit `max` —
    // the precondition for the hang. Overkill's max is 30.
    const AutoPerks = window.AutoPerks

    // Every perk unlocked in a fresh fixture has `max === Number.MAX_VALUE`, so the all-maxed state is
    // unreachable there. Overkill (max 30) is the shallowest CAPPED one, and it is a perk players
    // genuinely unlock — `getVariablePerks` filters on `game.portal[X].locked` live, so flipping that
    // flag is the actual mechanism by which a real save reaches this state, not a forced shortcut.
    expect(window.game.portal.Overkill.locked).toBe(true) // the fixture's starting state
    window.game.portal.Overkill.locked = false

    const perks = AutoPerks.getVariablePerks()
    expect(perks.map((p: any) => p.name)).toContain('overkill')

    let capped: any
    for (const perk of perks) {
      if (perk.name === 'overkill') {
        perk.updatedValue = 1
        perk.level = perk.max
        capped = perk
      } else {
        perk.updatedValue = 0
      }
    }
    expect(capped).toBeDefined()
    expect(Number.isFinite(capped.max)).toBe(true)
    expect(capped.level).toBe(capped.max)

    // Pre-fix this never returned. Enough helium that `price <= helium` can never end the loop.
    const calls = withIterationCap(AutoPerks, () => {
      AutoPerks.spendHelium(1e12)
    })

    // Terminating is the assertion; the tiny call count is the evidence it terminated by draining
    // rather than by grinding to the cap.
    expect(calls).toBeLessThan(1000)
    expect(capped.level).toBe(capped.max) // and it bought nothing it could not buy
  })
})
