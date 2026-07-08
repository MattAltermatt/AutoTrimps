// Ambient declarations for AutoTrimps globals that still live in un-converted
// legacy modules (mostly AutoTrimps2.js). Converted code reads/writes these by
// bare name at runtime; this file only satisfies the type-checker. It SHRINKS as
// the owning modules convert — a global moves out of here the moment its module
// becomes a real import.
declare global {
  // Settings store — `var autoTrimpSettings = {}` in AutoTrimps2.js.
  var autoTrimpSettings: any
  // Logging/debug flags — `var` in AutoTrimps2.js.
  var enableDebug: boolean
  var ATmessageLogTabVisible: boolean
  var aWholeNewWorld: any
  // Log helpers defined in still-legacy modules.
  function getCurrentTime(): string
  function updatePortalTimer(flag?: boolean): string
  function getTabClass(displayed: boolean): string
  function trimMessages(b: string): void
}
export {}
