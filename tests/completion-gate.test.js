// completion-gate.test.js -- guards the completion gate Stop hook (AGEN-17)
//
// Seam: hooks/completion-gate.js, run as a real child process with the Claude Code Stop event on stdin,
// against a throwaway git repo whose lint, typecheck and test scripts are one-line node commands.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..");
const hookPath = path.join(repoRoot, "hooks", "completion-gate.js");
const pass = "node -e 0";
const fail = "node -e \"console.log('1 test failed: adds numbers'); process.exit(1)\"";

/**
 * Makes a git repo with a package.json holding the given scripts, left uncommitted so the tree is dirty.
 *
 * @param {Record<string, string> | undefined} scripts - package.json scripts; undefined for no package.json.
 * @returns {Promise<string>} Absolute path of the repo.
 */
async function makeRepo(scripts) {
  const root = await mkdtemp(path.join(tmpdir(), "agents0-completion-gate-"));
  await run("git", ["init", "-q"], { cwd: root });
  if (scripts) await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "fixture", scripts }));
  return root;
}

/**
 * Runs the hook for one Stop event.
 *
 * @param {{ root: string, sessionId: string, isStopHookActive?: boolean }} options
 * @returns {Promise<any>} Parsed hook output, or undefined when it printed nothing.
 */
async function stop({ root, sessionId, isStopHookActive = false }) {
  const event = { hook_event_name: "Stop", session_id: sessionId, cwd: root, stop_hook_active: isStopHookActive };
  const child = run("node", [hookPath], { cwd: root });
  child.child.stdin?.end(JSON.stringify(event));
  const { stdout } = await child;
  return stdout ? JSON.parse(stdout) : undefined;
}

describe("completion gate hook", () => {
  it("AGEN-17 AC1: hooks.json runs the gate on Stop, with a 600 second timeout for slow suites", async () => {
    const { hooks } = JSON.parse(await readFile(path.join(repoRoot, "hooks", "hooks.json"), "utf8"));
    assert.deepStrictEqual(hooks.Stop, [
      { hooks: [{ type: "command", command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/hooks/completion-gate.js"], timeout: 600 }] },
    ]);
  });

  it("AGEN-17 AC2: no rule, skill, agent or CLAUDE.md instructs the agent to run lint, typecheck or test", async () => {
    const files = ["CLAUDE.md"];
    for (const folder of ["rules", "skills", "agents"]) {
      const entries = await readdir(path.join(repoRoot, folder), { recursive: true });
      files.push(...entries.filter((entry) => entry.endsWith(".md")).map((entry) => path.join(folder, entry)));
    }
    // An instruction names the project's own scripts in prose; a command listed in a code block is reference.
    const instruction = /\brun\b[^.\n]{0,60}`(npm (run )?(lint|typecheck|test)|lint|typecheck|test)`/i;
    for (const file of files) {
      const text = await readFile(path.join(repoRoot, file), "utf8");
      assert.doesNotMatch(text, instruction, `${file} still tells the agent to run the checks the gate runs (D24)`);
    }
  });

  it("AGEN-17 AC1: a failing test blocks the stop, with the failing output", async () => {
    const root = await makeRepo({ lint: pass, typecheck: pass, test: fail });
    const output = await stop({ root, sessionId: randomUUID() });
    assert.strictEqual(output?.decision, "block");
    assert.match(output.reason, /npm test/);
    assert.match(output.reason, /1 test failed: adds numbers/);
  });

  it("AGEN-17 AC1: a third consecutive failure allows the stop and reports red instead of looping", async () => {
    const root = await makeRepo({ lint: pass, typecheck: pass, test: fail });
    const sessionId = randomUUID();
    assert.strictEqual((await stop({ root, sessionId }))?.decision, "block");
    assert.strictEqual((await stop({ root, sessionId, isStopHookActive: true }))?.decision, "block");
    const third = await stop({ root, sessionId, isStopHookActive: true });
    assert.strictEqual(third?.decision, undefined);
    assert.match(third?.systemMessage, /Completion gate red after 3 attempts/);
    assert.match(third.systemMessage, /1 test failed: adds numbers/);
  });

  it("AGEN-17 scope: a repo with no package.json is not an npm project, so the gate passes silently", async () => {
    const root = await makeRepo(undefined);
    await writeFile(path.join(root, "notes.md"), "# Dirty\n");
    assert.strictEqual(await stop({ root, sessionId: randomUUID() }), undefined);
  });

  it("AGEN-17 scope: a package.json missing lint, typecheck or test blocks, naming the scripts to add (D68)", async () => {
    const root = await makeRepo({ test: pass });
    const output = await stop({ root, sessionId: randomUUID() });
    assert.strictEqual(output?.decision, "block");
    assert.match(output.reason, /package\.json has no lint, typecheck script/);
  });

  it("AGEN-17 scope: a clean working tree skips the gate, so a question-only turn costs no test run", async () => {
    const root = await makeRepo({ lint: pass, typecheck: pass, test: fail });
    await run("git", ["add", "-A"], { cwd: root });
    await run("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "fixture"], { cwd: root });
    assert.strictEqual(await stop({ root, sessionId: randomUUID() }), undefined);
  });

  it("AGEN-17 scope: outside a git repo there is no tree to inspect, so the gate runs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agents0-completion-gate-"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { lint: pass, typecheck: pass, test: fail } }));
    assert.strictEqual((await stop({ root, sessionId: randomUUID() }))?.decision, "block");
  });

  it("AGEN-17 scope: a new user turn gets two fresh retries", async () => {
    const root = await makeRepo({ lint: pass, typecheck: pass, test: fail });
    const sessionId = randomUUID();
    await stop({ root, sessionId });
    await stop({ root, sessionId, isStopHookActive: true });
    assert.strictEqual((await stop({ root, sessionId }))?.decision, "block");
    assert.strictEqual((await stop({ root, sessionId, isStopHookActive: true }))?.decision, "block");
  });

  it("AGEN-17 scope: a passing gate prints nothing and resets the count", async () => {
    const root = await makeRepo({ lint: pass, typecheck: pass, test: fail });
    const sessionId = randomUUID();
    await stop({ root, sessionId });
    await stop({ root, sessionId, isStopHookActive: true });
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { lint: pass, typecheck: pass, test: pass } }));
    assert.strictEqual(await stop({ root, sessionId, isStopHookActive: true }), undefined);
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { lint: pass, typecheck: pass, test: fail } }));
    assert.strictEqual((await stop({ root, sessionId, isStopHookActive: true }))?.decision, "block");
  });
});
