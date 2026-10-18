// config.js — loads, validates and normalizes agents0.json

// System dependencies
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/**
 * Loads agents0.json, expanding leading `~` in every harness category
 * path and in the optional `bin` path to the current user's home directory.
 *
 * @param {string} configPath - Absolute path to agents0.json.
 * @returns {Promise<import("./types.js").Agents0Config>} Normalized config.
 * @throws {Error} If the file is missing, is not valid JSON, or does not match the expected shape.
 */
export async function loadConfig(configPath) {
  let text;
  try {
    text = await readFile(configPath, "utf8");
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") throw new Error(`Config not found: ${configPath}`);
    throw error;
  }

  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`Malformed JSON in ${configPath}: ${/** @type {Error} */ (error).message}`);
  }

  if (!isPlainObject(raw) || !isPlainObject(raw.harnesses)) {
    throw new Error(`Invalid ${configPath}: expected a top-level "harnesses" object.`);
  }

  /** @type {Record<string, Record<string, string>>} */
  const harnesses = {};

  for (const [harnessName, categories] of Object.entries(raw.harnesses)) {
    if (!isPlainObject(categories)) {
      throw new Error(`Invalid ${configPath}: harness "${harnessName}" must be an object of category paths.`);
    }
    harnesses[harnessName] = {};
    for (const [category, value] of Object.entries(categories)) {
      if (typeof value !== "string") {
        throw new Error(`Invalid ${configPath}: "${harnessName}.${category}" must be a path string.`);
      }
      harnesses[harnessName][category] = expandHome(value);
    }
  }

  if (raw.bin === undefined) return { harnesses };
  if (typeof raw.bin !== "string") throw new Error(`Invalid ${configPath}: "bin" must be a path string.`);

  return { harnesses, bin: expandHome(raw.bin) };
}

/**
 * Reports whether a parsed JSON value is a non-array object.
 *
 * @param {unknown} value - Parsed JSON value.
 * @returns {value is Record<string, unknown>} True for `{...}`, false for arrays, null and primitives.
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Expands a leading `~` (or `~/`) to the current user's home directory.
 *
 * @param {string} inputPath - Path possibly starting with `~`.
 * @returns {string} Path with `~` expanded.
 */
function expandHome(inputPath) {
  if (inputPath === "~") return homedir();
  if (inputPath.startsWith("~/")) return path.join(homedir(), inputPath.slice(2));
  return inputPath;
}
