#!/usr/bin/env bash
# PostToolUse hook: lint + typecheck TypeScript edits.
#
# Fires after Edit/Write/MultiEdit. When the edited file is a .ts under
# src/, tests/, or scripts/, it runs oxlint on that file and a full-project
# `tsc --noEmit`. The project's typecheck baseline is CLEAN, so any tsc error
# is a real regression introduced by the edit. oxlint exits 0 on warnings, so
# the pre-existing warnings never block — only oxlint *errors* do.
#
# On failure: prints details to stderr and exits 2, which feeds the output
# back to Claude so it can fix the regression before moving on.

set -uo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0

# Only TypeScript files in the typecheck scope.
case "$file" in
  *.ts) ;;
  *) exit 0 ;;
esac
case "$file" in
  */src/*|*/tests/*|*/scripts/*) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

report=""

if ! lint_out=$(npx --no-install oxlint "$file" 2>&1); then
  report="${report}oxlint errors in ${file}:
${lint_out}

"
fi

if ! tsc_out=$(npx --no-install tsc --noEmit 2>&1); then
  report="${report}tsc --noEmit failed (baseline is clean — this is a new type error):
${tsc_out}

"
fi

if [ -n "$report" ]; then
  printf '%s' "$report" >&2
  exit 2
fi

exit 0
