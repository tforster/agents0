// inject-rule.js -- SessionStart and SubagentStart hook that adds one Agents0 rule to an agent's context
//
// Plugins cannot ship rules and have no install hook, so hooks/hooks.json gives each file in
// rules/ its own entry under both events, each running this script. SessionStart covers the main
// session and `claude -p` workers; SubagentStart covers subagents started with the Agent tool, which
// never see SessionStart context. One hook per rule, not one for all: hook context over 10,000
// characters is replaced by a file path and a 2,000-character preview, and all six rules together
// are about 17,000 (docs/scratch/2026-10-18-plugin-pinning-spike.md section 3).
//
// Output is the JSON form, hookSpecificOutput.additionalContext, for both events: SubagentStart
// documents only that form, and SessionStart accepts it too, so one shape serves both.
//
// Usage, in exec form from hooks/hooks.json:
//   node ${CLAUDE_PLUGIN_ROOT}/hooks/inject-rule.js <SessionStart|SubagentStart> ${CLAUDE_PLUGIN_ROOT}/rules/<rule>.md

// System dependencies
import { readFile } from "node:fs/promises";

const placeholder = "${CLAUDE_PLUGIN_ROOT}";
const [, , hookEventName, rulePath] = process.argv;
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;

// Claude Code exports CLAUDE_PLUGIN_ROOT to every plugin hook; without it, rule paths would be wrong.
if (!pluginRoot) {
  throw new Error("CLAUDE_PLUGIN_ROOT is not set; run this script as a Claude Code plugin hook.");
}

// Rules name plugin files as ${CLAUDE_PLUGIN_ROOT}/..., the variable Claude Code substitutes in
// skills, agents and hook arguments. It does not substitute hook output, so this script does.
const additionalContext = (await readFile(rulePath, "utf8")).replaceAll(placeholder, pluginRoot);
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName, additionalContext } }));
