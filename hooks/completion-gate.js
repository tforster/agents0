// completion-gate.js -- Stop hook that blocks until the project's lint, typecheck and test scripts pass (AGEN-17)
//
// Usage, from hooks/hooks.json: node ${CLAUDE_PLUGIN_ROOT}/hooks/completion-gate.js

// System dependencies
import { execFile } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

/**
 * What a failed execFile rejects with.
 *
 * @typedef {Error & { code?: string | number, stdout: string, stderr: string }} ExecError
 */

const run = promisify(execFile);

// The project's own scripts, in the order a human would run them: cheapest first, so a lint error does
// not wait on a full test run (D31).
const checks = [["run", "lint"], ["run", "typecheck"], ["test"]];

// Two retries, then the stop goes through red (D31): a gate that loops forever on a test the agent cannot
// fix burns the session instead of handing the problem to a human.
const retryCeiling = 2;

// Claude needs the end of a long test run, where the failures and summary are, not the whole log.
const outputTail = 8_000;

/**
 * Runs the checks in order and stops at the first that fails.
 *
 * @param {string} cwd - Project directory.
 * @returns {Promise<string | undefined>} The failing command and its output; undefined when all pass, or when
 *   the directory is not an npm project.
 */
async function firstFailure(cwd) {
  // No package.json is a dotfiles, PHP or docs repo, not a broken npm project; only that absence is
  // swallowed, not a malformed file.
  const text = await readFile(path.join(cwd, "package.json"), "utf8").catch((/** @type {ExecError} */ error) => {
    if (error.code === "ENOENT") {
      return;
    }
    throw error;
  });
  if (text === undefined) {
    return;
  }
  // An npm project without the scripts fails the gate rather than skipping them (D68): the template gives
  // every Dev0 project all three, so a missing one is the thing to fix.
  const scripts = JSON.parse(text).scripts ?? {};
  const missing = checks.map((args) => args.at(-1)).filter((name) => name && !scripts[name]);
  if (missing.length > 0) {
    return `package.json has no ${missing.join(", ")} script; add ${missing.length > 1 ? "them" : "it"} so the completion gate can run`;
  }
  for (const args of checks) {
    try {
      await run("npm", args, { cwd, maxBuffer: 64 * 1024 * 1024 });
    } catch (error) {
      const { stdout, stderr } = /** @type {ExecError} */ (error);
      return `npm ${args.join(" ")} failed:\n${`${stdout}${stderr}`.trim().slice(-outputTail)}`;
    }
  }
}

/**
 * Reports whether a directory is a git working tree with nothing to commit.
 *
 * @param {string} cwd - Project directory.
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
 * Handles one Stop event.
 *
 * @param {{ cwd: string, session_id: string, stop_hook_active: boolean }} event - The Claude Code hook event.
 * @returns {Promise<object | undefined>} Hook JSON output, or undefined when the gate is green.
 */
async function handleEvent(event) {
  // Nothing changed since the last commit means nothing new to verify: a question-only turn, or work already
  // committed, skips a full test run.
  if (await isCleanTree(event.cwd)) {
    return;
  }
  const attemptsFile = path.join(tmpdir(), `agents0-completion-gate-${event.session_id}`);
  const failure = await firstFailure(event.cwd);
  if (!failure) {
    await rm(attemptsFile, { force: true });
    return;
  }
  // stop_hook_active is false on the first stop of a turn, so each user prompt gets fresh retries; it is true
  // when Claude is stopping again after a block, which is the attempt being counted.
  const previous = event.stop_hook_active ? Number(await readFile(attemptsFile, "utf8").catch(() => "0")) : 0;
  const attempt = previous + 1;
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
for await (const chunk of process.stdin) chunks.push(chunk);
const output = await handleEvent(JSON.parse(Buffer.concat(chunks).toString("utf8")));
if (output) {
  process.stdout.write(JSON.stringify(output));
}
