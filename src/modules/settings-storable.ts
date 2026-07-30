// #237/#297 — "can this value survive a round trip through the settings store and come back as a
// number?" One predicate, guarding one store, from both directions: settings-engine.ts validates what
// the USER types into a value/multiValue input, and utils.ts's setPageSetting validates what AT writes
// PROGRAMMATICALLY. Until #297 only the first half existed, so AT protected the user from typing NaN
// into the box and then wrote NaN into the same store itself (autoGiga → DeltaGigastation).
//
// It has to tolerate strings, because 18 of the declared `value` defaults ARE strings ('-1', '0',
// '1e33', …) and getPageSetting reads them with parseFloat, not parseInt — so `'-1'` is a perfectly
// good stored value and must not be treated as damage. What it must reject is anything JSON cannot
// carry: NaN and ±Infinity both serialize to `null`, and `null` is what comes back on the next boot —
// where createSetting KEEPS it, because its unset test is `loaded === undefined` and `null !==
// undefined`. That is why one bad write is permanent rather than transient.
//
// This lives in its own leaf module rather than in either consumer because both of them need it and
// neither can import the other: utils.ts creates a DOM node at module scope (`ATbutton`), so importing
// it into settings-engine.ts would force every node-environment consumer of settings-engine into jsdom
// — which is exactly what happened when this predicate was first moved there (settings-engine's own
// tooltip test stopped LOADING, and a suite that cannot load reports as "no tests", not as a failure).
// No imports, no side effects, no DOM.
export const isStorableNumber = (v: any) => Number.isFinite(typeof v === 'number' ? v : parseFloat(v));
