// clean-config-lock.js -- PostToolUse hook on Bash that removes a stale sandbox placeholder at .git/config.lock
//
// Reads the hook input from stdin and works from its `cwd`, not $CLAUDE_PROJECT_DIR, which stays at the
// session's start directory when Claude enters a worktree. Silent, and a no-op outside a git repository.

// Local dependencies
import { removeStaleConfigLock } from "./sandbox-placeholders.js";

/**
 * Reads all of stdin.
 *
 * @returns {Promise<string>} The text.
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const { cwd, tool_input: toolInput } = JSON.parse(await readStdin());

// A background command's sandbox may still be running, and its placeholder is live until it ends.
if (cwd && !toolInput?.run_in_background) await removeStaleConfigLock(cwd);
