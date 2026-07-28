/**
 * The message of a caught value, whatever was actually thrown.
 *
 * A `catch (err)` binding is `unknown`, and `err.message` on a non-Error yields `undefined` — which
 * is silently worse than it looks in this repo, because in three of the four call sites the message
 * IS the evidence: `[census] <probe>: undefined` reads like a probe that failed for no reason,
 * exactly the "a failed probe reported as nothing" shape #197 was filed for.
 *
 * @param {unknown} err
 * @returns {string}
 */
export function errMessage(err) {
  return err instanceof Error ? err.message : String(err)
}
