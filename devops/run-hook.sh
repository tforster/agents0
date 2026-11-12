#!/usr/bin/env bash
# run-hook.sh -- run one hook from this working copy outside a Claude Code session
#
# Builds the JSON payload Claude Code would send on stdin, runs the hook with CLAUDE_PLUGIN_ROOT pointing at
# this repo, and reports stdout, stderr and the exit code with what Claude Code would make of them.
#
# Usage:
#   devops/run-hook.sh <hook> [-e event] [-d dir] [-p prompt] [-t tool] [-- hook-args...]
#   echo '{"cwd":"/some/repo"}' | devops/run-hook.sh account-gate     # payload from stdin instead
#
# Examples:
#   devops/run-hook.sh account-gate
#   devops/run-hook.sh account-gate -d ~/dev/SomeOwner/some-repo
#   devops/run-hook.sh inject-rule -e SessionStart -- SessionStart rules/dev0.md

set -euo pipefail

repoRoot="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

[[ $# -ge 1 && $1 != "-h" && $1 != "--help" ]] || usage 1

hook="${1%.js}"
hook="${hook##*/}"
shift
hookFile="$repoRoot/hooks/$hook.js"
[[ -f $hookFile ]] || { echo "No such hook: $hookFile" >&2; exit 1; }

# Default event per hook, from hooks.json, so the common case needs no -e.
event="$(node -e '
  const { hooks } = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const found = Object.entries(hooks).find(([, groups]) =>
    groups.some((group) => group.hooks.some((entry) => (entry.args ?? []).some((arg) => arg.endsWith(`/hooks/${process.argv[2]}.js`)))));
  process.stdout.write(found?.[0] ?? "UserPromptSubmit");
' "$repoRoot/hooks/hooks.json" "$hook")"
directory="$PWD"
prompt="hello from run-hook.sh"
tool="Bash"
hookArgs=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -e) event="$2"; shift 2 ;;
    -d) directory="$(cd "$2" && pwd)"; shift 2 ;;
    -p) prompt="$2"; shift 2 ;;
    -t) tool="$2"; shift 2 ;;
    -h|--help) usage 0 ;;
    --) shift; hookArgs=("$@"); break ;;
    *) echo "Unknown option: $1" >&2; usage 1 ;;
  esac
done

# Relative rule paths after -- resolve against the repo, as ${CLAUDE_PLUGIN_ROOT}/... would.
for index in "${!hookArgs[@]}"; do
  [[ -e "$repoRoot/${hookArgs[$index]}" ]] && hookArgs[$index]="$repoRoot/${hookArgs[$index]}"
done

# Piped stdin wins; an empty one (scripts, CI, editors run with no TTY) falls back to a built payload.
payload=""
[[ -t 0 ]] || payload="$(cat)"
if [[ -z $payload ]]; then
  payload="$(node -e '
    const [event, cwd, prompt, tool] = process.argv.slice(1);
    const payload = { session_id: "run-hook", transcript_path: "", cwd, hook_event_name: event };
    if (event === "UserPromptSubmit") payload.prompt = prompt;
    if (event === "PreToolUse" || event === "PostToolUse") Object.assign(payload, { tool_name: tool, tool_input: {} });
    if (event === "SessionStart") payload.source = "startup";
    process.stdout.write(JSON.stringify(payload));
  ' "$event" "$directory" "$prompt" "$tool")"
fi

stdoutFile="$(mktemp)"
stderrFile="$(mktemp)"
trap 'rm -f "$stdoutFile" "$stderrFile"' EXIT

set +e
printf '%s' "$payload" | CLAUDE_PLUGIN_ROOT="$repoRoot" node "$hookFile" "${hookArgs[@]}" >"$stdoutFile" 2>"$stderrFile"
exitCode=$?
set -e

echo "== hook:    $hook ($event)"
echo "== payload: $payload"
echo "== stdout:"
cat "$stdoutFile"
echo
echo "== stderr:"
cat "$stderrFile"
echo "== exit:    $exitCode"

if [[ $exitCode -eq 2 ]]; then
  echo "== verdict: BLOCKED (exit 2; stderr is the reason)"
elif grep -q '"decision" *: *"block"' "$stdoutFile"; then
  echo "== verdict: BLOCKED (decision: block on stdout)"
elif [[ $exitCode -ne 0 ]]; then
  echo "== verdict: non-blocking error (exit $exitCode)"
else
  echo "== verdict: passed"
fi
