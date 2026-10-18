// install.js — symlink-based install/uninstall for every agents0 trait category
//
// All three trait categories (skills, agents, rules) use the same plain
// directory-symlink model — see prd.md §4.1.

// System dependencies
import { mkdir, symlink, lstat, unlink, readlink } from "node:fs/promises";
import path from "node:path";

/**
 * Maps each trait category to its source directory within the agents0
 * repo. Every category is a directory symlink (prd.md §4.1).
 *
 * @param {string} toolkitRoot - Absolute path to the agents0 repo root.
 * @returns {Record<string, string>} Category name to source directory.
 */
export function symlinkCategories(toolkitRoot) {
  return {
    skills: path.join(toolkitRoot, "install", "skills"),
    agents: path.join(toolkitRoot, "install", "agents"),
    rules: path.join(toolkitRoot, "install", "rules"),
  };
}

/**
 * Installs trait categories (skills, agents, rules) for one harness, or for
 * every harness when `harnessName` is omitted, and links the CLI itself to
 * `config.bin` when set. A category absent from a harness's config is treated
 * as not applicable and skipped.
 *
 * @param {string|undefined} harnessName - Key of the harness in `config.harnesses`, or undefined for all.
 * @param {{config: import("./types.js").Agents0Config, toolkitRoot: string}} options - Parsed agents0.json and repo root.
 * @returns {Promise<void>}
 */
export async function install(harnessName, { config, toolkitRoot }) {
  const links = plannedLinks(config, toolkitRoot, harnessName, true);

  // Validate every link before touching any of them, so a conflict
  // discovered partway through never leaves a partial install.
  const plan = [];
  for (const link of links) {
    const existing = await existingLinkTarget(link.targetPath);

    if (existing.isSymlink && existing.resolved === link.source) continue; // already correct, nothing to do
    if (existing.exists && !existing.isSymlink) {
      throw new Error(
        `Refusing to install ${link.label}: ${link.targetPath} already exists as a real file or directory, not a symlink. No changes made.`
      );
    }

    plan.push({ ...link, replace: existing.isSymlink });
  }

  for (const { targetPath, source, type, replace } of plan) {
    if (replace) await unlink(targetPath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await symlink(source, targetPath, type);
  }
}

/**
 * Removes symlinks previously created by `install`: one harness's categories,
 * or every harness's plus the CLI link when `harnessName` is omitted. Real
 * (non-symlink) files and directories are left untouched, and a missing path
 * is treated as already-uninstalled.
 *
 * @param {string|undefined} harnessName - Key of the harness in `config.harnesses`, or undefined for all.
 * @param {{config: import("./types.js").Agents0Config, toolkitRoot: string}} options - Parsed agents0.json and repo root.
 * @returns {Promise<void>}
 */
export async function uninstall(harnessName, { config, toolkitRoot }) {
  // Removing one harness keeps the CLI linked; only a full uninstall removes it.
  const links = plannedLinks(config, toolkitRoot, harnessName, harnessName === undefined);

  for (const { targetPath } of links) {
    const existing = await existingLinkTarget(targetPath);
    if (existing.isSymlink) await unlink(targetPath);
  }
}

/**
 * Lists every symlink `install`/`uninstall` would manage: the configured
 * categories of the selected harness (or of all harnesses), plus the CLI link.
 *
 * @param {import("./types.js").Agents0Config} config - Parsed agents0.json.
 * @param {string} toolkitRoot - Absolute path to the repo root.
 * @param {string|undefined} harnessName - Harness to select, or undefined for all.
 * @param {boolean} includeBin - Whether to include the `config.bin` CLI link.
 * @returns {import("./types.js").PlannedLink[]} Links to create or remove.
 */
function plannedLinks(config, toolkitRoot, harnessName, includeBin) {
  const categories = symlinkCategories(toolkitRoot);
  const harnessNames = harnessName === undefined ? Object.keys(config.harnesses) : [harnessName];

  /** @type {import("./types.js").PlannedLink[]} */
  const links = [];
  for (const name of harnessNames) {
    const harness = requireHarness(config, name);
    for (const [category, source] of Object.entries(categories)) {
      if (!harness[category]) continue;
      links.push({ label: `"${category}" for harness "${name}"`, targetPath: harness[category], source, type: "dir" });
    }
  }

  if (includeBin && config.bin) {
    links.push({
      label: "the agents0 CLI",
      targetPath: config.bin,
      source: path.join(toolkitRoot, "bin", "agents0"),
      type: "file",
    });
  }

  return links;
}

/**
 * Looks up a harness's config, raising a clear error if it isn't defined.
 *
 * @param {import("./types.js").Agents0Config} config - Parsed agents0.json.
 * @param {string} harnessName - Key of the harness in `config.harnesses`.
 * @returns {Record<string, string>} The harness's category map.
 */
function requireHarness(config, harnessName) {
  const harness = config.harnesses[harnessName];
  if (!harness) throw new Error(`Unknown harness: "${harnessName}"`);
  return harness;
}

/**
 * Inspects what, if anything, already sits at a symlink target path.
 *
 * @param {string} targetPath - Path a symlink category would be installed at.
 * @returns {Promise<{exists: boolean, isSymlink?: boolean, resolved?: string}>} Existing state.
 */
async function existingLinkTarget(targetPath) {
  let stats;
  try {
    stats = await lstat(targetPath);
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return { exists: false };
    throw err;
  }

  if (!stats.isSymbolicLink()) return { exists: true, isSymlink: false };

  const link = await readlink(targetPath);
  return { exists: true, isSymlink: true, resolved: path.resolve(path.dirname(targetPath), link) };
}
