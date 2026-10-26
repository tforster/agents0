// sweep-placeholders.js -- manual sweep of the empty placeholder files Claude Code's Linux sandbox leaves behind
//
// Run it from a normal shell once the agent session is done, from anywhere inside the repository or worktree.
// The sweep is manual on purpose: a hook on Stop would race another session's live sandboxed command, and
// SessionEnd gets 1.5 seconds and does not run when a session is killed, which is what leaves strays.
//
// Usage:
//   node hooks/sweep-placeholders.js [--dry-run]

// Local dependencies
import { sweepPlaceholders } from "./sandbox-placeholders.js";

const args = process.argv.slice(2);
const unknown = args.find((arg) => arg !== "--dry-run");
if (unknown) {
  console.error(`Unknown option: ${unknown}\nUsage: sweep-placeholders.js [--dry-run]`);
  process.exit(1);
}

try {
  const results = await sweepPlaceholders(process.cwd(), { dryRun: args.includes("--dry-run") });
  if (results.length === 0) {
    console.log("No sandbox placeholders found.");
  }
  for (const { path, action, reason } of results) {
    console.log(`${action.padEnd(12)} ${path}${reason ? `  (${reason})` : ""}`);
  }
} catch (error) {
  console.error(`Error: ${/** @type {Error} */ (error).message}`);
  process.exit(1);
}
