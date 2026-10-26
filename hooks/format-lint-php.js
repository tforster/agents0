// format-lint-php.js -- PostToolUse hook that formats and lints a PHP file Claude just wrote (AGEN-24)
//
// Usage, from hooks/hooks.json: node ${CLAUDE_PLUGIN_ROOT}/hooks/format-lint-php.js

// System dependencies
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

/**
 * What a failed execFile rejects with.
 *
 * @typedef {Error & { code?: string | number, stdout: string, stderr: string }} ExecError
 */

const run = promisify(execFile);

// php -l exits 255 on a syntax error. Any other failure of `docker run` (no binary, daemon down, image
// pull failed, exit 125) means the lint never ran, which is not a verdict on the file.
const phpSyntaxErrorStatus = 255;

/**
 * Reads the production PHP version a repo declares in composer.json config.platform.php.
 *
 * @param {string} repoRoot - Absolute path of the repo root.
 * @returns {Promise<string | undefined>} major.minor, such as "7.4"; undefined when the repo declares none.
 */
async function readProductionPhp(repoRoot) {
  // A repo without composer.json is normal (legacy PHP); only that absence is swallowed, not a malformed file.
  const text = await readFile(path.join(repoRoot, "composer.json"), "utf8").catch((/** @type {ExecError} */ error) => {
    if (error.code === "ENOENT") {
      return "{}";
    }
    throw error;
  });
  const declared = JSON.parse(text).config?.platform?.php;
  return declared?.split(".").slice(0, 2).join(".");
}

/**
 * Runs php -l on a file inside the production PHP image.
 *
 * @param {string} repoRoot - Absolute path of the repo root, mounted read-only.
 * @param {string} relativeFile - Changed file, relative to the root.
 * @param {string} version - major.minor of production PHP.
 * @returns {Promise<{ status: "ok" | "error" | "unavailable", output: string }>} Lint verdict.
 */
async function lintOnProduction(repoRoot, relativeFile, version) {
  const args = ["run", "--rm", "-v", `${repoRoot}:/app:ro`, "-w", "/app", `php:${version}-cli`, "php", "-l", relativeFile];
  try {
    await run("docker", args);
    return { status: "ok", output: "" };
  } catch (error) {
    const { code, stdout, stderr } = /** @type {ExecError} */ (error);
    if (code !== phpSyntaxErrorStatus) {
      return { status: "unavailable", output: "" };
    }
    return { status: "error", output: `${stdout}${stderr}`.trim() };
  }
}

/**
 * Runs php-cs-fixer, from the host, on a file with the repo's own config.
 *
 * @param {string} repoRoot - Absolute path of the repo root.
 * @param {string} relativeFile - Changed file, relative to the root.
 * @returns {Promise<{ problem?: string, reformatted: boolean }>} The fixer's complaint, if any, and whether it
 *   rewrote the file.
 */
async function formatWithRepoConfig(repoRoot, relativeFile) {
  // The same two names, in the same order, that php-cs-fixer looks for itself.
  for (const name of [".php-cs-fixer.php", ".php-cs-fixer.dist.php"]) {
    const config = path.join(repoRoot, name);
    if (
      !(await access(config).then(
        () => true,
        () => false
      ))
    ) {
      continue;
    }
    const before = await readFile(path.join(repoRoot, relativeFile), "utf8");
    try {
      await run("php-cs-fixer", ["fix", `--config=${config}`, "--quiet", relativeFile], { cwd: repoRoot });
    } catch (error) {
      const { code, stdout, stderr } = /** @type {ExecError} */ (error);
      // A missing binary is a machine without the fixer, not a problem with the file.
      if (code === "ENOENT") {
        return { reformatted: false };
      }
      return { problem: `${stdout}${stderr}`.trim(), reformatted: false };
    }
    return { reformatted: before !== (await readFile(path.join(repoRoot, relativeFile), "utf8")) };
  }
  return { reformatted: false };
}

/**
 * Handles one PostToolUse event: lints the written PHP file against production PHP.
 *
 * @param {{ tool_input: { file_path: string } }} event - The Claude Code hook event.
 * @returns {Promise<object | undefined>} Hook JSON output, or undefined when there is nothing to say.
 */
async function handleEvent(event) {
  const filePath = event.tool_input.file_path;
  // vendor/ is third-party code the repo does not own, wherever it sits in the tree.
  if (path.extname(filePath) !== ".php" || filePath.split(path.sep).includes("vendor")) {
    return;
  }
  // A PHP file outside any repo (a scratch file) has no config or declaration to honour: nothing to do.
  const repoRoot = await run("git", ["rev-parse", "--show-toplevel"], { cwd: path.dirname(filePath) }).then(
    ({ stdout }) => stdout.trim(),
    () => undefined
  );
  if (!repoRoot) {
    return;
  }
  const relativeFile = path.relative(repoRoot, filePath);

  const problems = [];
  const { problem, reformatted } = await formatWithRepoConfig(repoRoot, relativeFile);
  if (problem) {
    problems.push(`php-cs-fixer failed on ${relativeFile}:\n${problem}`);
  }
  // The fixer rewrites the file after the Edit, so Claude's copy is stale: its next Edit would fail, or it
  // would reason about old content.
  const notes = reformatted ? [`php-cs-fixer reformatted ${relativeFile}; re-read before editing it again`] : [];

  // No declared version means no known production target, so there is nothing to lint against.
  const version = await readProductionPhp(repoRoot);
  if (version) {
    const lint = await lintOnProduction(repoRoot, relativeFile, version);
    if (lint.status === "error") {
      problems.push(`php -l on php ${version} reports ${relativeFile}:\n${lint.output}`);
    }
    if (lint.status === "unavailable") {
      notes.push("php -l skipped: docker unavailable");
    }
  }
  if (problems.length > 0) {
    return { decision: "block", reason: [...problems, ...notes].join("\n\n") };
  }
  if (notes.length > 0) {
    return { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: notes.join("\n") } };
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
const output = await handleEvent(JSON.parse(Buffer.concat(chunks).toString("utf8")));
if (output) {
  process.stdout.write(JSON.stringify(output));
}
