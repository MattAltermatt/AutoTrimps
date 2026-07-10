import { bootGame } from './boot.mjs'
import { installSeededRandom } from './seededRandom.mjs'

// runOne(window, game, value) => metric number. One fresh boot per (value, seed).
export function sweep({ values, seeds, runOne, bootOpts } = {}) {
  const results = []
  for (const value of values) {
    const samples = []
    for (const seed of seeds) {
      const { window, game } = bootGame(bootOpts)
      installSeededRandom(window, seed)
      samples.push(runOne(window, game, value))
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    results.push({ value, mean, samples })
  }
  return results
}
