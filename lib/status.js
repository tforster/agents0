// status.js — reports install state per harness/category (see PRD §10, `agents0 status`)

// System dependencies
import { lstat, readlink } from "node:fs/promises";
import path from "node:path";

// Local dependencies
import { symlinkCategories } from "./install.js";

/**
 * Reports, for every harness in config and every category it defines, one
 * of: "not-applicable", "missing", "broken", "correct".
 *
 * @param {{config: import("./types.js").Agents0Config, toolkitRoot: string}} options - Parsed agents0.json and repo root.
 * @returns {Promise<Record<string, Record<string, string>>>} Per-harness, per-category status.
 */
export async function status({ config, toolkitRoot }) {
  const categories = symlinkCategories(toolkitRoot);
  /** @type {Record<string, Record<string, string>>} */
  const report = {};

  for (const [harnessName, harness] of Object.entries(config.harnesses)) {
    report[harnessName] = {};
    for (const [name, source] of Object.entries(categories)) {
      report[harnessName][name] = await symlinkStatus(harness[name], source);
    }
  }

  return report;
}

/**
 * Determines the install state of a single symlink-based category.
 *
 * @param {string|undefined} targetPath - The harness's configured path for this category, if any.
 * @param {string} expectedSource - Where the symlink should point, within the agents0 repo.
 * @returns {Promise<string>} One of "not-applicable", "missing", "broken", "correct".
 */
async function symlinkStatus(targetPath, expectedSource) {
  if (!targetPath) return "not-applicable";

  let stats;
  try {
    stats = await lstat(targetPath);
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return "missing";
    throw err;
  }

  if (!stats.isSymbolicLink()) return "broken"; // a real file/directory sits where a symlink is expected

  const link = await readlink(targetPath);
  const resolved = path.resolve(path.dirname(targetPath), link);
  if (resolved !== expectedSource) return "broken"; // points somewhere other than the agents0 repo

  try {
    await lstat(resolved);
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return "broken"; // dangling — source no longer exists
    throw err;
  }

  return "correct";
}
