// sandbox-placeholders.js -- removes the empty files Claude Code's Linux sandbox leaves in a repository
//
// On Linux and WSL2 the Bash sandbox holds a write denial on a protected path that does not exist yet by
// creating an empty read-only (0444) placeholder there, to bind-mount over. The sandbox's docs say it
// removes the placeholder afterwards; in practice (Claude Code 2.1.29x) it often does not. The bubblewrap
// cleanup is per process with no refcount, so concurrent sessions in one project root race
// (anthropics/claude-code#94008; also #78818, #101155, #102516). The one placeholder that breaks work is
// .git/config.lock, which git reads as a held lock. Hooks run outside the sandbox, so a hook can delete
// it. This file exists until upstream fixes that.
//
// Two callers: hooks/clean-config-lock.js (PostToolUse, the lock only) and hooks/sweep-placeholders.js
// (the manual sweep of the repo root and .claude/).

// System dependencies
import { execFile } from "node:child_process";
import { lstat, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Runs git and returns its trimmed stdout, or null when git exits non-zero (not a repository).
 *
 * @param {string} cwd - Directory to run in.
 * @param {string[]} args - git arguments.
 * @returns {Promise<string | null>} stdout, or null on a git failure.
 */
async function gitOutput(cwd, args) {
  try {
    return (await run("git", args, { cwd })).stdout.trim();
  } catch (error) {
    // A non-zero exit is git saying "not a repository" -- an expected no-op. Anything else (git missing) is real.
    if (typeof (/** @type {{ code?: unknown }} */ (error).code) === "number") return null;
    throw error;
  }
}

/**
 * Reports whether a path is shaped like a sandbox placeholder: a regular file, empty and read-only.
 *
 * Git creates its own locks writable and fills them, so a writable or non-empty file is never one of ours.
 * lstat, not stat, so a symlink is never followed and never counts.
 *
 * @param {string} file - Path to test.
 * @returns {Promise<boolean>} Whether it is an empty read-only regular file.
 */
async function isPlaceholder(file) {
  try {
    const stats = await lstat(file);
    return stats.isFile() && stats.size === 0 && (stats.mode & 0o222) === 0;
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return false;
    throw error;
  }
}

/**
 * Reports whether any git process is running, by name, anywhere on the machine.
 *
 * It cannot tell which repository a git process belongs to, so an unrelated git skips the delete; the next
 * Bash call tries again, which fails safe. Where pgrep is missing, none is reported running.
 *
 * @returns {Promise<boolean>} Whether `pgrep -x git` found one.
 */
async function isGitRunning() {
  try {
    await run("pgrep", ["-x", "git"]);
    return true;
  } catch (error) {
    // pgrep exits 1 when nothing matches; ENOENT means pgrep itself is absent. Both mean no git to wait for.
    const { code } = /** @type {NodeJS.ErrnoException} */ (error);
    if (code === "ENOENT" || String(code) === "1") return false;
    throw error;
  }
}

/**
 * Finds a stale sandbox placeholder at .git/config.lock, in the repository's common git directory.
 *
 * `git rev-parse --git-common-dir` is used because a linked worktree's `.git` is a file and the sandbox's
 * placeholder lands in the main repository's `.git`, which `$CLAUDE_PROJECT_DIR` may not even be.
 *
 * @param {string} cwd - A directory inside the repository or worktree.
 * @returns {Promise<string | null>} The lock's path, or null when it is absent, not placeholder-shaped, or git is running.
 */
async function findStaleConfigLock(cwd) {
  const commonDirectory = await gitOutput(cwd, ["rev-parse", "--git-common-dir"]);
  if (commonDirectory === null) return null;

  const lock = path.resolve(cwd, commonDirectory, "config.lock");
  return (await isPlaceholder(lock)) && !(await isGitRunning()) ? lock : null;
}

/**
 * Removes a stale sandbox placeholder at .git/config.lock. See {@link findStaleConfigLock}.
 *
 * @param {string} cwd - A directory inside the repository or worktree.
 * @returns {Promise<boolean>} Whether a placeholder was removed.
 */
export async function removeStaleConfigLock(cwd) {
  const lock = await findStaleConfigLock(cwd);
  if (lock === null) return false;

  await unlink(lock);
  return true;
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SweepResult
 * @property {string} path - Path relative to the repository root, or the absolute lock path.
 * @property {"removed" | "would remove" | "skip"} action - What happened.
 * @property {string} [reason] - Why a path was skipped.
 */

/**
 * Lists the top-level entries of a directory that look like placeholders: empty regular files, or
 * character devices (the sandbox mounts /dev/null over some, such as .claude/agents). Symlinks never count.
 *
 * @param {string} directory - Directory to scan, absolute.
 * @returns {Promise<string[]>} Names of the candidates.
 */
async function listCandidates(directory) {
  /** @type {string[]} */
  const names = [];
  const entries = await readdir(directory).catch((error) => {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return [];
    throw error;
  });
  for (const name of entries) {
    const stats = await lstat(path.join(directory, name));
    if ((stats.isFile() && stats.size === 0) || stats.isCharacterDevice()) names.push(name);
  }
  return names;
}

/**
 * Sweeps the empty placeholder files out of the repository root and `.claude/`, plus .git/config.lock.
 *
 * A candidate is removed only when git status shows it untracked, ignored or just added (an added one also
 * leaves the index). A tracked path is skipped, so a deliberately empty tracked file is never touched.
 * Run it from a normal shell, not a sandboxed command: inside the sandbox the placeholders are live mounts.
 *
 * @param {string} cwd - A directory inside the repository or worktree.
 * @param {{ dryRun: boolean }} options - With dryRun, report only.
 * @returns {Promise<SweepResult[]>} One result per candidate.
 */
export async function sweepPlaceholders(cwd, { dryRun }) {
  const root = await gitOutput(cwd, ["rev-parse", "--show-toplevel"]);
  if (root === null) throw new Error(`not a git repository: ${cwd}`);

  /** @type {SweepResult[]} */
  const results = [];
  for (const directory of [root, path.join(root, ".claude")]) {
    for (const name of await listCandidates(directory)) {
      const relative = path.relative(root, path.join(directory, name));
      // Not trimmed: the first status column is a space for an intent-to-add path.
      const { stdout } = await run("git", ["status", "--porcelain", "--ignored", "--", relative], { cwd: root });
      const state = stdout.slice(0, 2);

      if (state === "") results.push({ path: relative, action: "skip", reason: "tracked by git" });
      else if (!["??", "!!", " A", "A "].includes(state)) {
        results.push({ path: relative, action: "skip", reason: `git status '${state}', review by hand` });
      } else {
        // A broad `git add` sweeps placeholders into the index; the index entry has to go too or git reports a deletion.
        if (!dryRun && state.includes("A")) await run("git", ["rm", "--cached", "--quiet", "--", relative], { cwd: root });
        if (!dryRun) await unlink(path.join(root, relative));
        results.push({ path: relative, action: dryRun ? "would remove" : "removed" });
      }
    }
  }

  const lock = await findStaleConfigLock(cwd);
  if (lock !== null) {
    if (!dryRun) await unlink(lock);
    results.push({ path: lock, action: dryRun ? "would remove" : "removed" });
  }
  return results;
}
