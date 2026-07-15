#!/usr/bin/env bash
# PreToolUse hook: block hand-edits to vendored legacy files.
#
# legacy/FastPriorityQueue.js is a pure third-party vendor drop. It must never
# be hand-edited — an accidental edit corrupts the concatenated userscript
# output. (legacy/highcharts.js was the other vendored file; it was deleted in
# #134 once Graphs moved to ECharts, so it no longer needs guarding.) The
# strangler is complete: no first-party legacy/*.js remain.
#
# Exit 2 with a reason on stderr denies the tool call and tells Claude why.

set -uo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0

base=$(basename "$file")
case "$base" in
  FastPriorityQueue.js)
    case "$file" in
      */legacy/*)
        printf 'Blocked: %s is a vendored third-party file and must not be hand-edited.\n' "$base" >&2
        printf 'Editing it corrupts the concatenated userscript build. If it genuinely needs\n' >&2
        printf 'updating, replace it with a fresh upstream vendor drop instead of editing in place.\n' >&2
        exit 2
        ;;
    esac
    ;;
esac

exit 0
