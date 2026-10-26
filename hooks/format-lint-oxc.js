// format-lint-oxc.js -- PostToolUse hook that formats and lints the file Claude just wrote (AGEN-16)
//
// Both tools see every file and decide for themselves what they support: an unsupported type, or a path
// the project's config ignores, comes back as a sentinel message that is a silent no-op. Asking the tools,
// not an extension list, keeps new languages arriving with an upgrade rather than a hook change.
//
// Usage, from hooks/hooks.json: node ${CLAUDE_PLUGIN_ROOT}/hooks/format-lint-oxc.js

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

/**
 * Reports whether a path exists.
 *
 * @param {string} target - Absolute path.
 * @returns {Promise<boolean>} Whether it exists.
 */
async function exists(target) {
  return await access(target).then(
    () => true,
    () => false
  );
}

/**
 * Finds the nearest project above a file that has a tool installed in node_modules/.bin. Never npx: that
 * would download a tool the project has not approved (D3).
 *
 * @param {string} filePath - Absolute path of the changed file.
 * @param {string} tool - Binary name.
 * @returns {Promise<string | undefined>} Absolute path of the project directory, or undefined when none has it.
 */
async function findProject(filePath, tool) {
  for (let directory = path.dirname(filePath); ; directory = path.dirname(directory)) {
    if (await exists(path.join(directory, "node_modules", ".bin", tool))) {
      return directory;
    }
    if (directory === path.dirname(directory)) {
      return;
    }
  }
}

/**
 * Runs oxfmt on one file from its project, so the project's config and ignorePatterns apply.
 *
 * @param {string} filePath - Absolute path of the changed file.
 * @returns {Promise<{ problem?: string, reformatted: boolean }>} oxfmt's complaint, if any, and whether it
 *   rewrote the file.
 */
async function format(filePath) {
  const project = await findProject(filePath, "oxfmt");
  if (!project) {
    return { reformatted: false };
  }
  const before = await readFile(filePath, "utf8");
  try {
    await run(path.join(project, "node_modules", ".bin", "oxfmt"), ["--write", filePath], { cwd: project });
  } catch (error) {
    const { stdout, stderr } = /** @type {ExecError} */ (error);
    const report = `${stdout}${stderr}`.trim();
    if (report.includes("Expected at least one target file")) {
      return { reformatted: false };
    }
    return { problem: report, reformatted: false };
  }
  return { reformatted: before !== (await readFile(filePath, "utf8")) };
}

/**
 * Runs oxlint on one file from its project, so the project's config applies.
 *
 * @param {string} filePath - Absolute path of the changed file.
 * @returns {Promise<string | undefined>} oxlint's report when it finds errors; undefined when clean or not linted.
 */
async function lint(filePath) {
  const project = await findProject(filePath, "oxlint");
  if (!project) {
    return;
  }
  try {
    // --quiet drops warnings from the report: only errors block (architect, 2026-10-26), and a warning
    // printed beside an error reads as something the agent must also fix.
    await run(path.join(project, "node_modules", ".bin", "oxlint"), ["--quiet", filePath], { cwd: project });
  } catch (error) {
    const { stdout, stderr } = /** @type {ExecError} */ (error);
    const report = `${stdout}${stderr}`.trim();
    if (report.includes("No files found to lint")) {
      return;
    }
    return report;
  }
}

/**
 * Handles one PostToolUse event.
 *
 * @param {{ tool_input: { file_path: string } }} event - The Claude Code hook event.
 * @returns {Promise<object | undefined>} Hook JSON output, or undefined when there is nothing to say.
 */
async function handleEvent(event) {
  const filePath = event.tool_input.file_path;
  // Something else (another hook, a sandbox cleanup) may have removed the file since the write; there is
  // nothing left to format.
  if (!(await exists(filePath))) {
    return;
  }

  const problems = [];
  const { problem, reformatted } = await format(filePath);
  if (problem) {
    problems.push(`oxfmt failed on ${filePath}:\n${problem}`);
  }
  const lintReport = await lint(filePath);
  if (lintReport) {
    problems.push(`oxlint reports errors in ${filePath}:\n${lintReport}`);
  }

  // oxfmt rewrites the file after the Edit, so Claude's copy is stale: its next Edit would fail, or it would
  // reason about old content.
  const note = reformatted ? `oxfmt reformatted ${filePath}; re-read before editing it again` : undefined;
  if (problems.length > 0) {
    return { decision: "block", reason: [...problems, note].filter(Boolean).join("\n\n") };
  }
  if (note) {
    return { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: note } };
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
