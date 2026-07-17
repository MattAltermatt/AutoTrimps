// Mutable cross-module holder for the custom-UI shell (mirrors graphs/state.ts).
// A bare `export let` can't be reassigned across modules, so state lives on one object.
export const customUIState = {
  active: false, // is the AT shell currently shown?
  adopted: false, // has #wrapper been reparented into #atWrapper?
}
