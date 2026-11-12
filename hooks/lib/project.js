// project.js -- shared helpers for hooks that need to know which project a path belongs to
//
// Usage:
//   import { findProject, gitRoot } from "./lib/project.js";

// System dependencies
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Finds the top of the git working tree that holds a directory.
 *
 * @param {string} directory - An existing directory.
 * @returns {Promise<string | undefined>} The working tree's root; undefined outside git.
 */
export async function gitRoot(directory) {
  return await run("git", ["rev-parse", "--show-toplevel"], { cwd: directory }).then(
    ({ stdout }) => stdout.trim(),
    () => undefined
  );
}

/**
 * Reports whether a path exists.
 *
 * @param {string} target - Absolute path.
 * @returns {Promise<boolean>} Whether it exists.
 */
export async function exists(target) {
  return await access(target).then(
    () => true,
    () => false
  );
}

/**
 * Finds the project a directory belongs to: the git root when it holds `marker`, else the nearest directory at
 * or above `directory` that does. The git root comes first because an npm workspace monorepo installs its tools
 * and defines its scripts once, at the root, and a workspace's own package.json would otherwise shadow them. The
 * fallback covers a repo whose project sits in a subdirectory, and paths outside git.
 *
 * @param {string} directory - An existing directory to start from.
 * @param {string} marker - Path, relative to a candidate directory, whose presence makes it the project, such as
 *   "package.json" or "node_modules/.bin/oxfmt".
 * @returns {Promise<string | undefined>} The project directory; undefined when no directory holds the marker.
 */
export async function findProject(directory, marker) {
  const root = await gitRoot(directory);
  if (root && (await exists(path.join(root, marker)))) {
    return root;
  }
  for (let candidate = directory; ; candidate = path.dirname(candidate)) {
    if (await exists(path.join(candidate, marker))) {
      return candidate;
    }
    if (candidate === path.dirname(candidate)) {
      return;
    }
  }
}
