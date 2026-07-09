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
