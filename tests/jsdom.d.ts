// @types/jsdom is not installed (the sim harness reaches jsdom through the untyped
// scripts/sim/boot.mjs, so nothing in-tree ever needed the types). tests/graphs.darkTheme.test.ts
// constructs a JSDOM directly — it has to, because it evaluates the raw legacy/Graphs.js at global
// scope rather than booting the game. It only needs the runtime value. Same treatment as
// tests/decimal-js.d.ts.
declare module 'jsdom'
