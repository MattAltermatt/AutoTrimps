#!/usr/bin/env bash
# PreToolUse hook: block hand-edits to vendored legacy files.
#
# legacy/highcharts.js (~293 KB) and legacy/FastPriorityQueue.js are pure
# third-party vendor drops. They must never be hand-edited — an accidental
# edit corrupts the concatenated userscript output (and highcharts must not
# even be bundled; Graphs.js CDN-injects it). The OTHER legacy/*.js files
# are active strangler-conversion targets and stay editable.
#
# Exit 2 with a reason on stderr denies the tool call and tells Claude why.

set -uo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0

base=$(basename "$file")
case "$base" in
  highcharts.js|FastPriorityQueue.js)
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
