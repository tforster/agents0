// sync.js — agents0 sync: jj fetch -> integrate -> describe -> push, in one command
//
// The jj runner is injected (see PRD §10 / issue 10) rather than shelled out
// to directly, since a real git remote is an external dependency callers
// should be able to fake in tests.

const DEFAULT_BOOKMARK = "main";
const DEFAULT_MESSAGE = "sync";

/**
 * Runs jj's fetch -> integrate -> describe -> push sequence in one call.
 * A conflict surfaced while integrating remote changes stops the sequence
 * before any local describe or push happens. Local changes are only
 * described if there actually are any, so a clean repo is a true no-op.
 *
 * @param {{runJj: (args: string[]) => Promise<{stdout: string, stderr: string}>, bookmark?: string, message?: string}} options - Injectable jj runner and config.
 * @returns {Promise<void>}
 */
export async function sync({ runJj, bookmark = DEFAULT_BOOKMARK, message = DEFAULT_MESSAGE }) {
  await runJj(["git", "fetch"]);

  const rebaseResult = await runJj(["rebase", "-d", `${bookmark}@origin`]);
  const rebaseOutput = `${rebaseResult.stdout}${rebaseResult.stderr}`;
  if (/conflict/i.test(rebaseOutput)) {
    throw new Error(`Sync stopped: conflict while integrating remote changes.\n${rebaseOutput}`);
  }

  const diffResult = await runJj(["diff", "--stat"]);
  if (diffResult.stdout.trim() !== "") {
    await runJj(["describe", "-m", message]);
  }

  await runJj(["git", "push"]);
}
