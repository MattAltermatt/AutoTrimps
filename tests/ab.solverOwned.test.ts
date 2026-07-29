// @vitest-environment node
//
// Regression net for #173 — ABsolver levelled and gated on items the player does not OWN.
//
// Two distinct harms from one missing guard. The dust is destroyed: the game's `save()` skips any
// item with `owned === false` (objects.js:791-793) and `load()` resets an item with no save entry to
// `level = 1` (objects.js:857-864), so those levels evaporate on the next page load and are re-bought
// next session. And the readiness gates lie: `Comfy_Boots.level >= 3` → buy Extra_Limbs was satisfied
// by levels on an item that cannot be equipped and contributes nothing to combat.
//
// The second describe block is the load-bearing one. The finding named two sites; a mechanical census
// of the real source found 7 upgrade calls and 13 level reads inside ABsolver. A fix scoped to the
// finding's own list would have closed 2 of 20 while making the class look handled — so the census is
// derived from the AST here, and it is what stops a new bare read from quietly rejoining the class.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { bootGame } from '../scripts/sim/boot.mjs'
import { TEST_BUNDLE } from './sim/bundle'

const ROOT = resolve(__dirname, '..')
const REL = 'src/modules/ab.ts'

function boot() {
  const { window } = bootGame({ withAutoTrimps: true, atBundlePath: TEST_BUNDLE }) as unknown as {
    window: Record<string, any>
  }
  return { window, ab: window.autoBattle }
}

describe('#173 — ABsolver must not level or gate on unowned items', () => {
  let window: Record<string, any>
  let ab: any

  beforeEach(() => {
    ;({ window, ab } = boot())
    ab.dust = 1e12
    ab.shards = 1e12
  })

  it('POSITIVE CONTROL: the game really does destroy levels on unowned items', () => {
    // Anti-false-green, and the whole justification for the fix. If the game preserved these levels
    // the finding would be about wasted dust only, not about dust that provably evaporates.
    expect(ab.items.Comfy_Boots.owned).toBe(false)
    expect(String(ab.upgrade)).not.toContain('owned') // upgrade() has no owned guard of its own

    ab.items.Comfy_Boots.level = 5
    ab.save()
    ab.load()
    expect(ab.items.Comfy_Boots.level).toBe(1)
  })

  it('spends no dust levelling an item the player has not contracted', () => {
    ab.maxEnemyLevel = 9
    ab.items.Comfy_Boots.owned = false

    const dustBefore = ab.dust
    const levelBefore = ab.items.Comfy_Boots.level

    window.ABsolver()

    expect(ab.items.Comfy_Boots.level).toBe(levelBefore)
    // The solver SHOULD still pursue the item — it accepts the 913-dust contract, which is the
    // correct way to end up owning it. So "no dust moved" is the wrong assertion; what must not
    // happen is dust going into LEVELS on the thing we do not have. Pre-fix that was 430 + 1290
    // = 1720 dust on top of the contract, all of it discarded by the next save/load cycle.
    expect(ab.activeContract).toBe('Comfy_Boots')
    expect(dustBefore - ab.dust).toBeLessThan(1000)
  })

  it('does NOT open the next progression gate on a phantom level', () => {
    // The readiness half. Pre-fix, `Comfy_Boots.level >= 3` was reachable without owning the item,
    // so Extra_Limbs was bought on the strength of levels that do nothing and will not survive a
    // reload. Seed the phantom level directly — that is exactly the state the old code created.
    ab.maxEnemyLevel = 9
    ab.items.Comfy_Boots.owned = false
    ab.items.Comfy_Boots.level = 5
    ab.bonuses.Extra_Limbs.level = 0

    window.ABsolver()

    expect(ab.bonuses.Extra_Limbs.level).toBe(0)
  })

  it('DOES level and gate normally once the item is genuinely owned', () => {
    // The parity half — the guard must not degrade into "never level anything".
    ab.maxEnemyLevel = 9
    ab.items.Comfy_Boots.owned = true
    ab.items.Comfy_Boots.level = 1

    window.ABsolver()

    expect(ab.items.Comfy_Boots.level).toBeGreaterThan(1)
  })

  it('the generic "Level items" loop skips unowned targets', () => {
    // ab.ts's tail loop walks EVERY item and upgrades any whose level is below the tier target, so
    // an uncontracted item named in a target list (case 6 names Putrid_Pouch/Chemistry_Set) was
    // levelled the same way. Same class, a different site from the one the finding named.
    ab.maxEnemyLevel = 6
    const unownedBefore = Object.keys(ab.items)
      .filter((i) => !ab.items[i].owned)
      .map((i) => [i, ab.items[i].level] as const)
    expect(unownedBefore.length).toBeGreaterThan(0)

    window.ABsolver()

    for (const [name, level] of unownedBefore) {
      expect([name, ab.items[name].level]).toEqual([name, level])
    }
  })
})

describe('#173 census — no bare level read or upgrade may rejoin ABsolver', () => {
  const source = readFileSync(resolve(ROOT, REL), 'utf8')
  const sf = ts.createSourceFile(REL, source, ts.ScriptTarget.Latest, true)

  function solverBody(): ts.FunctionDeclaration {
    let found: ts.FunctionDeclaration | undefined
    sf.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === 'ABsolver') found = node
    })
    if (!found) throw new Error('ABsolver not found in ' + REL)
    return found
  }

  /** Every node inside ABsolver, so the census is the function's real contents, not a line range. */
  function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
    visit(node)
    node.forEachChild((c) => walk(c, visit))
  }

  it('POSITIVE CONTROL: the census can actually see the constructs it forbids', () => {
    // A census that matches nothing reports success. Prove the matchers fire against a known sample
    // before trusting a zero from them — this is the anti-false-green half of a mechanized net.
    const probe = ts.createSourceFile(
      'probe.ts',
      `function ABsolver() {
         autoBattle.upgrade('Comfy_Boots');
         if (autoBattle.items.Comfy_Boots.level < 3) {}
         if (autoBattle.items[equip].level < 2) {}
       }`,
      ts.ScriptTarget.Latest,
      true,
    )
    let upgrades = 0
    let levelReads = 0
    probe.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === 'ABsolver') {
        walk(node, (n) => {
          if (ts.isCallExpression(n) && n.expression.getText(probe) === 'autoBattle.upgrade') upgrades++
          if (
            ts.isPropertyAccessExpression(n) &&
            n.name.text === 'level' &&
            n.expression.getText(probe).startsWith('autoBattle.items')
          )
            levelReads++
        })
      }
    })
    expect(upgrades).toBe(1)
    expect(levelReads).toBe(2)
  })

  it('calls no bare autoBattle.upgrade() — every purchase goes through abUpgradeOwned', () => {
    const offenders: string[] = []
    walk(solverBody(), (n) => {
      if (ts.isCallExpression(n) && n.expression.getText(sf) === 'autoBattle.upgrade') {
        offenders.push(`${REL}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`)
      }
    })
    expect(offenders).toEqual([])
  })

  it('reads no bare autoBattle.items[...].level — every gate goes through abOwnedLevel', () => {
    const offenders: string[] = []
    walk(solverBody(), (n) => {
      if (
        ts.isPropertyAccessExpression(n) &&
        n.name.text === 'level' &&
        n.expression.getText(sf).startsWith('autoBattle.items')
      ) {
        offenders.push(
          `${REL}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1} ${n.getText(sf)}`,
        )
      }
    })
    expect(offenders).toEqual([])
  })

  it('the helpers exist and are the only owned-gate in play', () => {
    expect(source).toContain('function abOwnedLevel(')
    expect(source).toContain('function abUpgradeOwned(')
    // abOwnedLevel must actually consult `owned` — a helper that just forwards `.level` would pass
    // both census tests above while restoring the exact bug they exist to prevent.
    const helper = source.slice(source.indexOf('function abOwnedLevel('))
    expect(helper.slice(0, helper.indexOf('}'))).toContain('.owned')
  })
})
