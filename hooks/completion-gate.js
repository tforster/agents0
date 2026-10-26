// completion-gate.js -- Stop hook that blocks until the project's lint, typecheck and test scripts pass (AGEN-17)
//
// Key behaviours:
//   - Runs only when the git working tree has changes; outside git it always runs
//   - The project is the nearest package.json above the session's directory, as npm resolves it; none means
//     not an npm project, and the gate passes
//   - Blocks with the first failing script's output; after two retries in one user turn the stop goes
//     through with a red systemMessage instead
//
// Usage, from hooks/hooks.json: node ${CLAUDE_PLUGIN_ROOT}/hooks/completion-gate.js

// System dependencies
import { execFile } from "node:child_process";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

/**
 * What a failed execFile rejects with.
 *
 * @typedef {Error & { stdout: string, stderr: string }} ExecError
 */

const run = promisify(execFile);

// The project's own scripts, cheapest first, so a lint error does not wait on a full test run (D31).
const scriptNames = ["lint", "typecheck", "test"];

// Two retries, then the stop goes through red (D31): a gate that loops forever on a test the agent cannot
// fix burns the session instead of handing the problem to a human.
const retryCeiling = 2;

// Claude needs the end of a long test run, where the failures and summary are, not the whole log.
const outputTailLength = 8_000;

/**
 * Reports whether a directory is a git working tree with nothing to commit.
 *
 * @param {string} cwd - Session directory.
 * @returns {Promise<boolean>} True when clean; false when dirty or not in a git repo, where there is no tree
 *   to inspect and the gate runs.
 */
async function isCleanTree(cwd) {
  return await run("git", ["status", "--porcelain"], { cwd }).then(
    ({ stdout }) => stdout === "",
    () => false
  );
}

/**
 * Finds the nearest directory at or above the session's that holds a package.json.
 *
 * @param {string} cwd - Session directory.
 * @returns {Promise<string | undefined>} The project directory; undefined when there is none, which is a
 *   dotfiles, PHP or docs repo rather than a broken npm project.
 */
async function findProject(cwd) {
  for (let directory = cwd; ; directory = path.dirname(directory)) {
    const hasPackage = await access(path.join(directory, "package.json")).then(
      () => true,
      () => false
    );
    if (hasPackage) {
      return directory;
    }
    if (directory === path.dirname(directory)) {
      return;
    }
  }
}

/**
 * Checks that package.json parses and declares all three scripts. A missing one fails the gate rather than
 * being skipped (D68): the JS template gives every Dev0 project all three, so a missing one is the thing to fix.
 *
 * @param {string} project - Project directory.
 * @returns {Promise<string | undefined>} What is wrong with package.json; undefined when it is usable.
 */
async function packageProblem(project) {
  let scripts;
  try {
    scripts = JSON.parse(await readFile(path.join(project, "package.json"), "utf8")).scripts ?? {};
  } catch (error) {
    return `package.json in ${project} cannot be read: ${/** @type {Error} */ (error).message}`;
  }
  const missing = scriptNames.filter((name) => !scripts[name]);
  if (missing.length > 0) {
    return `package.json has no ${missing.join(", ")} script; add ${missing.length > 1 ? "them" : "it"} so the completion gate can run`;
  }
}

/**
 * Runs the scripts in order and stops at the first that fails.
 *
 * @param {string} project - Project directory.
 * @returns {Promise<string | undefined>} The failing command and the tail of its output; undefined when all pass.
 */
async function firstFailingScript(project) {
  for (const name of scriptNames) {
    try {
      await run("npm", ["run", name], { cwd: project, maxBuffer: 64 * 1024 * 1024 });
    } catch (error) {
      const { stdout, stderr } = /** @type {ExecError} */ (error);
      return `npm run ${name} failed:\n${`${stdout}${stderr}`.trim().slice(-outputTailLength)}`;
    }
  }
}

/**
 * Reads how many consecutive failed stops this session has had in the current turn.
 *
 * @param {string} attemptsFile - The session's count file.
 * @returns {Promise<number>} The count; 0 when no count is kept.
 */
async function readAttempts(attemptsFile) {
  return await readFile(attemptsFile, "utf8").then(Number, (/** @type {NodeJS.ErrnoException} */ error) => {
    if (error.code === "ENOENT") {
      return 0;
    }
    throw error;
  });
}

/**
 * Handles one Stop event.
 *
 * @param {{ cwd: string, session_id: string, stop_hook_active: boolean }} event - The Claude Code hook event.
 * @returns {Promise<object | undefined>} Hook JSON output, or undefined when the gate is green.
 */
async function handleEvent(event) {
  // Keyed by session only, so a SubagentStop entry must not share this file: a subagent's stops would count
  // against its parent's retries.
  const attemptsFile = path.join(tmpdir(), `agents0-completion-gate-${event.session_id}`);
  // Nothing changed since the last commit means nothing new to verify: a question-only turn, or work already
  // committed, skips a full test run.
  const project = (await isCleanTree(event.cwd)) ? undefined : await findProject(event.cwd);
  const failure = project && ((await packageProblem(project)) ?? (await firstFailingScript(project)));
  if (!failure) {
    await rm(attemptsFile, { force: true });
    return;
  }
  // stop_hook_active is false on the first stop of a turn, so each user prompt gets fresh retries; it is true
  // when Claude is stopping again after a block, which is the attempt being counted.
  const attempt = (event.stop_hook_active ? await readAttempts(attemptsFile) : 0) + 1;
  if (attempt > retryCeiling) {
    await rm(attemptsFile, { force: true });
    return { systemMessage: `Completion gate red after ${attempt} attempts:\n${failure}` };
  }
  await writeFile(attemptsFile, String(attempt));
  return { decision: "block", reason: failure };
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
