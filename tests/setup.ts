// Test-harness setup (Phase 0). Runs before each test file's imports.
//
// Game-coupled modules execute DOM code at IMPORT time — e.g. utils.ts appends a filter
// button into #logBtnGroup on load (utils.ts:159) and sets window.onerror. Under the jsdom
// test environment we seed the handful of elements that import-time code reaches for, so those
// modules can be imported in a unit test without throwing. This is the "jsdom mandatory"
// guardrail from the modernization design spec.
// Guarded: runs for every test file, but only the jsdom-environment files have a `document`.
// node-environment files (build/buystate/time) get a harmless no-op.
if (typeof document !== 'undefined' && document.body) {
  document.body.innerHTML = `
    <div id="logBtnGroup"></div>
    <div id="log"></div>
    <span id="versionNumber"></span>
    <div id="equippedHeirloomsBtnGroup"></div>
    <div id="carriedHeirloomsBtnGroup"></div>
    <div id="extraHeirloomsBtnGroup"></div>
  `
}

// #250 — a default `getPerkLevel`, transcribed from .trimps-game/main.js:2405.
//
// Perks carry BOTH `level` (U1) and `radLevel` (U2), and getPerkLevel is the ONLY thing that picks
// between them; reading `.level` directly gave a U2 run its U1 allocation, which is the drift #250
// fixed in three separate copies of the breed chain. Several harnesses stubbed `game.portal.X.level`
// and never needed the accessor, so the fix broke them all at once.
//
// Seeding it HERE rather than in each harness is deliberate: three hand-copied stubs would reproduce,
// in the tests, exactly the copy-drift this fix exists to remove. It reads whatever `game` fixture the
// test installed, so it stays correct as fixtures change, and a file that wants different behaviour
// can still assign over it.
;(globalThis as any).getPerkLevel = (what: string, usePortalUniverse?: boolean) => {
  const g = (globalThis as any).game
  const perk = g?.portal?.[what]
  if (!perk) return 0
  const universe = usePortalUniverse ? (globalThis as any).portalUniverse : g?.global?.universe
  return (universe === 2 ? perk.radLevel : perk.level) ?? 0
}

// #231 — getUberEmpowerment / getOverkillerCount, transcribed from .trimps-game/main.js:8193 and
// :12029. maxOneShotPower() now DELEGATES to getOverkillerCount() instead of hand-copying its body,
// so harnesses that armed the underlying fixture fields (talents.overkill, empowerments.Ice,
// uberNature) need the accessor to exist. Transcribing it — rather than returning a constant — keeps
// those fixtures meaningful: they still drive the answer through the same inputs the game uses.
//
// Note getUberEmpowerment returns "" below getNatureStartZone(); with no natureStartZone in a fixture
// it degrades to game.global.uberNature, which is what the pre-#231 code did unconditionally.
;(globalThis as any).getUberEmpowerment = () => {
  const g = (globalThis as any).game
  const start = typeof (globalThis as any).getNatureStartZone === 'function' ? (globalThis as any).getNatureStartZone() : undefined
  if (start !== undefined && g?.global?.world < start) return ''
  return g?.global?.uberNature ?? ''
}
;(globalThis as any).getOverkillerCount = (getNumber?: boolean) => {
  const g = (globalThis as any).game
  const F = (globalThis as any).Fluffy
  if (g?.global?.universe === 2) {
    const canU2 = typeof (globalThis as any).canU2Overkill === 'function' ? (globalThis as any).canU2Overkill() : false
    if (!canU2 && !getNumber) return 0
    return (globalThis as any).u2Mutations?.tree?.MaxOverkill?.purchased ? 1 : 0
  }
  let n = Number(F?.isRewardActive?.('overkiller') ?? 0)
  if (g?.talents?.overkill?.purchased) n++
  const ice = g?.empowerments?.Ice
  if ((globalThis as any).getEmpowerment?.() === 'Ice' && ice) {
    if (ice.getLevel() >= 50) n++
    if (ice.getLevel() >= 100) n++
  }
  if ((globalThis as any).getUberEmpowerment() === 'Ice') n += 2
  return n
}
