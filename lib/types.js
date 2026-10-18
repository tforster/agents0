// types.js — shared JSDoc type definitions, imported via `import("./types.js").TypeName`

/**
 * @typedef {Object} Agents0Config
 * @property {Record<string, Record<string, string>>} harnesses - Harness name to category-path map, as loaded by `loadConfig`.
 * @property {string} [bin] - Where `install` links `bin/agents0`, e.g. `~/.local/bin/agents0`; `~` already expanded.
 */

/**
 * @typedef {Object} PlannedLink
 * @property {string} label - Human-readable name used in error messages.
 * @property {string} targetPath - Where the symlink is created.
 * @property {string} source - What the symlink points at, inside the repo.
 * @property {"dir"|"file"} type - Symlink type (matters on Windows only).
 */

export {};
