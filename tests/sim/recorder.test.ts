import { describeSim } from './guard'
import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bootGame } from '../../scripts/sim/boot.mjs'
import { installFrozenClock } from '../../scripts/sim/clock.mjs'
import { installSeededRandom } from '../../scripts/sim/seededRandom.mjs'
import { installRecorder } from '../../scripts/sim/recorder.mjs'
import { stepWithAT } from '../../scripts/sim/driver.mjs'

const MUT = ['buyJob', 'buyBuilding', 'buyUpgrade', 'runMap', 'selectMap', 'buyEquipment', 'setFormation', 'recycleMap']
const SAVE = () => readFileSync(resolve('tests/fixtures/saves/01-early-u1.txt'), 'utf8')

function run(seed = 1, ticks = 800) {
  const { window } = bootGame({ withAutoTrimps: true, saveString: SAVE() })
  installSeededRandom(window, seed)
  installFrozenClock(window)
  let tick = 0
  const trace = installRecorder(window, () => tick)
  for (let i = 0; i < ticks; i++) {
    tick = i
    stepWithAT(window, 1)
  }
  return trace
}

describeSim('native-mutator recorder', () => {
  it('records native-mutator calls with fn + args + tick', () => {
    const trace = run()
    expect(trace.length).toBeGreaterThan(0)
    for (const e of trace) {
      expect(MUT).toContain(e.fn)
      expect(typeof e.tick).toBe('number')
      expect(Array.isArray(e.args)).toBe(true)
    }
  }, 30_000)

  it('is DETERMINISTIC across two identical runs (seed + save + frozen clock fixed)', () => {
    expect(run(7)).toEqual(run(7))
  }, 30_000)
})
