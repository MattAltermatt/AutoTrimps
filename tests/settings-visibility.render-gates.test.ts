// @vitest-environment jsdom
//
// #238 / #239 / #240 — three render-gate repairs in updateCustomButtons(), all sharing one shape:
// the gate that decides what the user can SEE had drifted away from the gate that decides what the
// code READS. CLAUDE.md's standing rule for this file exists because reasoning from the consumer
// alone got it wrong twice in one session (#115, #117), so each of these is pinned behaviourally.
//
// ⚠️ updateCustomButtons is dispatched from guiLoop, and scripts/sim/boot.mjs stubs setInterval dead,
// so NONE of this is visible to the L0 proof net. `baseline-zero` is not evidence here — this file is.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { row, def, dropdownScaffold, clearScaffoldRows, baseGame } from './harness/updateCustomButtons'

describe('settings-visibility render gates', () => {
  let vis: typeof import('../src/modules/settings-visibility')

  beforeEach(async () => {
    // Do NOT reset document.body — tests/setup.ts installs the shared scaffold that utils.ts and
    // heirlooms.ts append to at module load, and wiping it makes those imports throw.
    clearScaffoldRows()
    ;(globalThis as any).MODULES = {}
    ;(globalThis as any).autoTrimpSettings = {}
    ;(globalThis as any).game = baseGame()
    ;(globalThis as any).debug = vi.fn()
    ;(globalThis as any).bwRewardUnlocked = () => false
    ;(globalThis as any).renderControlFace = () => {}
    ;(globalThis as any).prettify = (n: unknown) => String(n)
    ;(globalThis as any).shouldFarm = false
    ;(globalThis as any).RshouldFarm = false
    Object.assign(globalThis, await import('../src/modules/utils'))
    vis = await import('../src/modules/settings-visibility')
  })

  const statusRow = (id: string) => row(id)

  /**
   * "The code ACTIVELY showed this", not merely "it isn't hidden".
   *
   * The obvious spelling — `parent.style.display !== 'none'` — reports a freshly created, never
   * touched row as VISIBLE, because its display is `''`. Every `.toBe(true)` below would then pass
   * just as well against a build where the show call was deleted entirely: the exact
   * disabled-gate-reports-success shape CLAUDE.md documents, and the reason `row()` in the shared
   * harness deliberately leaves the parent's display unset.
   *
   * So require a value that only the production code writes: `toggleElem` writes `inline-block` for
   * a settings row, `toggleStatusElem` writes `block` for the two status containers. Neither is
   * reachable without a real call.
   */
  const visible = (el: HTMLElement) =>
    el.style.display !== 'none' &&
    ['inline-block', 'block'].includes((el.parentNode as HTMLElement).style.display)

  // ── #238: a conditional hide must be reversible ────────────────────────────────────────────────

  describe('#238 — the status elements can be turned back on without a page reload', () => {
    it('breed timer: OFF hides it, ON shows it again', () => {
      const el = statusRow('hiddenBreedTimer')
      dropdownScaffold()
      def('showbreedtimer', 'boolean', { enabled: false })

      vis.updateCustomButtons()
      expect(visible(el)).toBe(false)

      // The second half is the bug. Nothing in src/ ever turned this id back on, so before the fix
      // the element stayed hidden for the rest of the session while main-loop.ts kept writing the
      // countdown into it. The setting's own description promises a reversible hide.
      ;(globalThis as any).autoTrimpSettings['showbreedtimer'].enabled = true
      vis.updateCustomButtons()
      expect(visible(el)).toBe(true)
    })

    it('breed timer: the restored container is `block`, not the settings-row `inline-block`', () => {
      // turnOn writes `inline-block` on the parent, which is right for a settings row and wrong here:
      // both status containers were authored `display: block` (breedtimer.ts:214, settings-menu.ts:48).
      // Restoring through turnOn would "show" the element in a layout it was never designed in — a
      // naive fix that looks correct in a boolean assertion and is visibly wrong on the page.
      const el = statusRow('hiddenBreedTimer')
      dropdownScaffold()
      def('showbreedtimer', 'boolean', { enabled: false })
      vis.updateCustomButtons()
      ;(globalThis as any).autoTrimpSettings['showbreedtimer'].enabled = true
      vis.updateCustomButtons()
      expect((el.parentNode as HTMLElement).style.display).toBe('block')
    })

    it('automap status: OFF hides it, ON shows it again', () => {
      const el = statusRow('autoMapStatus')
      dropdownScaffold()
      ;(globalThis as any).game.global.universe = 1
      def('showautomapstatus', 'boolean', { enabled: false })
      def('Rshowautomapstatus', 'boolean', { enabled: true })

      vis.updateCustomButtons()
      expect(visible(el)).toBe(false)

      ;(globalThis as any).autoTrimpSettings['showautomapstatus'].enabled = true
      vis.updateCustomButtons()
      expect(visible(el)).toBe(true)
    })
  })

  // ── #239: one element, two universes, one gate ─────────────────────────────────────────────────

  describe('#239 — the automap status hide dispatches on universe, like its writer does', () => {
    const armStatus = (universe: number, u1: boolean, u2: boolean) => {
      const el = statusRow('autoMapStatus')
      dropdownScaffold()
      ;(globalThis as any).game.global.universe = universe
      def('showautomapstatus', 'boolean', { enabled: u1 })
      def('Rshowautomapstatus', 'boolean', { enabled: u2 })
      return el
    }

    it('U2 + Rshowautomapstatus OFF: hidden (it used to stay visible and freeze)', () => {
      // main-loop.ts:454 gates the U2 writer on Rshowautomapstatus, so with the U1-only gate the
      // per-tick update stopped while the element stayed on screen — a permanently stale status line.
      const el = armStatus(2, true, false)
      vis.updateCustomButtons()
      expect(visible(el)).toBe(false)
    })

    it('U2 + Rshowautomapstatus ON, U1 key OFF from earlier play: visible', () => {
      // The inverse, and the nastier one: the line vanished in U2 because of a U1 setting, and the
      // control that would fix it is itself hidden whenever the settings page is in Radon view.
      const el = armStatus(2, false, true)
      vis.updateCustomButtons()
      expect(visible(el)).toBe(true)
    })

    it('U1 still reads the U1 key, in both directions', () => {
      // NB the assert comes AFTER the tick. It did not, originally: `expect(visible(armStatus(...)))`
      // asserted on a row nothing had touched yet, and passed only because the old `visible()` read
      // an unset display as "not hidden". Tightening the helper is what surfaced it.
      const on = armStatus(1, true, false) // U2 key off must not matter in U1
      vis.updateCustomButtons()
      expect(visible(on)).toBe(true)

      clearScaffoldRows()
      ;(globalThis as any).autoTrimpSettings = {}
      const off = armStatus(1, false, true)
      vis.updateCustomButtons()
      expect(visible(off)).toBe(false)
    })

    it('the dispatch is on universe, NOT on the radon settings-page view', () => {
      // `radonon` is which settings PAGE is being viewed. Keying the element off it would swap the
      // two invariants for a different mismatch: a U1 player browsing the radon page would have their
      // status line driven by a setting their universe never reads.
      const el = armStatus(1, true, false)
      def('radonsettings', 'multitoggle', { value: 1 }) // viewing the Radon page, still in U1
      vis.updateCustomButtons()
      expect(visible(el)).toBe(true)
    })
  })

  // ── #240: a hidden control that still decides something ────────────────────────────────────────

  describe('#240 — IgnoreCrits stays reachable while Dynamic Gyms can read it', () => {
    const armCrits = (autoStance: number, dynamicGyms: boolean) => {
      const el = row('IgnoreCrits')
      dropdownScaffold()
      def('radonsettings', 'multitoggle', { value: 0 }) // U1 settings page
      def('AutoStance', 'multitoggle', { value: autoStance })
      def('DynamicGyms', 'boolean', { enabled: dynamicGyms })
      return el
    }

    it('Windstacking + Dynamic Gyms ON: visible — it still drives the Gym buy decision', () => {
      // buildings.ts's Gym block reads DynamicGyms → calcSpecificEnemyAttack → badGuyCritMult, which
      // branches on IgnoreCrits and moves modelled enemy attack by 5x (corruptCrit) or 7x
      // (healthyCrit). Hiding the control never neutralized the value — turnOff only writes
      // display:none — so the setting stayed live and became unreachable at the same time.
      const el = armCrits(3, true)
      vis.updateCustomButtons()
      expect(visible(el)).toBe(true)
    })

    it('Windstacking + Dynamic Gyms OFF: hidden, as the original gate intended', () => {
      // The anti-over-fix. With no consumer left, the tooltip's stance rationale is correct and the
      // control should still get out of the way.
      const el = armCrits(3, false)
      vis.updateCustomButtons()
      expect(visible(el)).toBe(false)
    })

    it('any other stance: visible regardless of Dynamic Gyms', () => {
      for (const gyms of [true, false]) {
        clearScaffoldRows()
        ;(globalThis as any).autoTrimpSettings = {}
        const el = armCrits(1, gyms)
        vis.updateCustomButtons()
        expect(visible(el), `DynamicGyms=${gyms}`).toBe(true)
      }
    })

    it('U2 (radon settings page): hidden either way — IgnoreCrits is U1-only', () => {
      for (const gyms of [true, false]) {
        clearScaffoldRows()
        ;(globalThis as any).autoTrimpSettings = {}
        const el = row('IgnoreCrits')
        dropdownScaffold()
        def('radonsettings', 'multitoggle', { value: 1 })
        def('AutoStance', 'multitoggle', { value: 1 })
        def('DynamicGyms', 'boolean', { enabled: gyms })
        vis.updateCustomButtons()
        expect(visible(el), `DynamicGyms=${gyms}`).toBe(false)
      }
    })
  })
})
