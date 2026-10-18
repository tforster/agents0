// inject-rule.js -- SessionStart hook that prints one Agents0 rule as session context
//
// Plugins cannot ship rules and have no install hook, so hooks/hooks.json gives each file in
// rules/ its own SessionStart entry that runs this script; Claude Code adds a SessionStart hook's
// stdout to the session as context. One hook per rule, not one for all: hook output over 10,000
// characters is replaced by a file path and a 2,000-character preview, and all six rules together
// are about 17,000 (docs/scratch/2026-10-18-plugin-pinning-spike.md section 3).
//
// Usage, in exec form from hooks/hooks.json:
//   node ${CLAUDE_PLUGIN_ROOT}/hooks/inject-rule.js ${CLAUDE_PLUGIN_ROOT}/rules/<rule>.md

// System dependencies
import { readFile } from "node:fs/promises";

const placeholder = "${CLAUDE_PLUGIN_ROOT}";
const [, , rulePath] = process.argv;
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;

// Claude Code exports CLAUDE_PLUGIN_ROOT to every plugin hook; without it, rule paths would be wrong.
if (!pluginRoot) throw new Error("CLAUDE_PLUGIN_ROOT is not set; run this script as a Claude Code plugin hook.");

// Rules name plugin files as ${CLAUDE_PLUGIN_ROOT}/..., the variable Claude Code substitutes in
// skills, agents and hook arguments. It does not substitute hook output, so this script does.
process.stdout.write((await readFile(rulePath, "utf8")).replaceAll(placeholder, pluginRoot));
