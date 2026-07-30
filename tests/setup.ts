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

// #291 — `challengeActive`, transcribed from .trimps-game/main.js:1753.
//
// A Challenge² stores the PARENT's name in `game.global.challengeActive` and puts the children in
// `game.global.multiChallenge` (updates.js:4673), so this helper — not a string compare — is the only
// correct way to ask "is challenge X in effect". query.ts's seven compares became helper calls, which
// means every harness driving those branches now needs the accessor to exist.
//
// It is TRANSCRIBED, not simplified to `game.global.challengeActive === what`. That shortcut would make
// every C²-path test pass while proving nothing about the case the fix is FOR — the multiChallenge
// lookup IS the behaviour under test.
//
// A missing `multiChallenge` degrades to the plain compare, which is what an ordinary single-challenge
// fixture wants, so existing harnesses keep their meaning without edits.
//
// ⚠️ Scope, corrected by review: this used to argue "one faithful copy beats N hand-written ones that
// drift" as though it had achieved that. It has not — thirteen test files install their own simplified
// `challengeActive` AFTER setup runs and therefore shadow this one. All thirteen are
// `game.global.challengeActive === c`, which is right for a single-challenge fixture, so nothing is
// broken. But two of them are the harnesses for the very functions #291 changed —
// `query.potencyMod.test.ts` (getPotencyMod) and `maps.finishExpOnBw.test.ts` — and they are therefore
// structurally blind to `multiChallenge`. A future C² case added there would silently test nothing.
// The Challenge² behaviour is covered in `query.challengeSquaredPredictions.test.ts`, which does NOT
// shadow this stub; that file is the one to extend rather than those.
;(globalThis as any).challengeActive = (what: string) => {
  const g = (globalThis as any).game
  if (g?.global?.multiChallenge?.[what]) return true
  return g?.global?.challengeActive === what
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
