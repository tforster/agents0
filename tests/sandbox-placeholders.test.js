// sandbox-placeholders.test.js -- guards the stale .git/config.lock hook and the placeholder sweep (AGEN-23)
//
// Claude Code's Linux sandbox can leave a 0-byte read-only placeholder at .git/config.lock, which git
// reads as a held lock. The hook is run as a real child process, fed the PostToolUse JSON on stdin, against
// throwaway git repositories. No real sandbox is involved: a 0444 empty file stands in for its placeholder.

// System dependencies
import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";
import { execFile, spawn } from "node:child_process";
import { access, chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..");
const hookScript = path.join(repoRoot, "hooks", "clean-config-lock.js");
const sweepScript = path.join(repoRoot, "hooks", "sweep-placeholders.js");

/** @type {string[]} */
const temporaryDirectories = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

/**
 * Makes a throwaway directory, removed after the test.
 *
 * @returns {Promise<string>} Its real path.
 */
async function makeTemporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "agen-23-"));
  temporaryDirectories.push(directory);
  return directory;
}

/**
 * Runs git in a directory.
 *
 * @param {string} cwd - Working directory.
 * @param {string[]} args - git arguments.
 * @returns {Promise<string>} stdout.
 */
async function git(cwd, args) {
  const { stdout } = await run("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd });
  return stdout;
}

/**
 * Creates a git repository with one commit.
 *
 * @returns {Promise<string>} The repository root.
 */
async function makeRepository() {
  const root = await makeTemporaryDirectory();
  await git(root, ["init", "--quiet", "--initial-branch=main"]);
  await writeFile(path.join(root, "README.md"), "# fixture\n");
  await git(root, ["add", "README.md"]);
  await git(root, ["commit", "--quiet", "-m", "init"]);
  return root;
}

/**
 * Stands in for the sandbox's placeholder: empty and read-only.
 *
 * @param {string} file - Path to create.
 * @returns {Promise<void>}
 */
async function makePlaceholder(file) {
  await writeFile(file, "");
  await chmod(file, 0o444);
}

/**
 * Reports whether a path exists, without following a final symlink.
 *
 * @param {string} file - Path to test.
 * @returns {Promise<boolean>} Whether it exists.
 */
async function exists(file) {
  return await access(file).then(
    () => true,
    () => false
  );
}

/**
 * A PATH holding only git, so pgrep is absent and no unrelated git process can make the hook hold back.
 *
 * @returns {Promise<string>} The directory to use as PATH.
 */
async function makeGitOnlyPath() {
  const directory = await makeTemporaryDirectory();
  const { stdout } = await run("which", ["git"]);
  await symlink(stdout.trim(), path.join(directory, "git"));
  return directory;
}

/**
 * Runs the PostToolUse hook the way Claude Code does: JSON on stdin.
 *
 * @param {Record<string, unknown>} input - The hook input.
 * @param {string} [searchPath] - PATH for the hook; defaults to the real one.
 * @returns {Promise<{ stdout: string, stderr: string }>} The hook's output; rejects on a non-zero exit.
 */
function runHook(input, searchPath = process.env.PATH ?? "") {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [hookScript],
      { env: { ...process.env, PATH: searchPath } },
      (error, stdout, stderr) => (error ? reject(error) : resolve({ stdout, stderr }))
    );
    child.stdin?.end(JSON.stringify(input));
  });
}

describe("AGEN-23 config.lock hook", () => {
  it("AGEN-23 AC1: after a Bash call, a sandbox placeholder at .git/config.lock is removed and git config works again", async () => {
    const root = await makeRepository();
    const lock = path.join(root, ".git", "config.lock");
    await makePlaceholder(lock);
    await assert.rejects(git(root, ["config", "branch.main.remote", "origin"]), /could not lock config file/);

    await runHook({ cwd: root, tool_name: "Bash", tool_input: { command: "ls" } }, await makeGitOnlyPath());

    assert.ok(!(await exists(lock)), "placeholder is still there");
    await git(root, ["config", "branch.main.remote", "origin"]);
    await git(root, ["branch", "topic"]);
    await git(root, ["branch", "--set-upstream-to=main", "topic"]);
  });

  it("AGEN-23 AC2: a real lock -- writable and holding content -- is never deleted", async () => {
    const root = await makeRepository();
    const lock = path.join(root, ".git", "config.lock");
    await writeFile(lock, "[core]\n\tbare = false\n");

    await runHook({ cwd: root, tool_input: {} }, await makeGitOnlyPath());

    assert.ok(await exists(lock), "a lock git wrote was deleted");
  });

  it("AGEN-23 AC2: an empty but writable lock is never deleted; git creates its locks writable", async () => {
    const root = await makeRepository();
    const lock = path.join(root, ".git", "config.lock");
    await writeFile(lock, "");

    await runHook({ cwd: root, tool_input: {} }, await makeGitOnlyPath());

    assert.ok(await exists(lock), "a writable lock was deleted");
  });

  it("AGEN-23 AC2: a read-only lock with content is never deleted", async () => {
    const root = await makeRepository();
    const lock = path.join(root, ".git", "config.lock");
    await writeFile(lock, "x");
    await chmod(lock, 0o444);

    await runHook({ cwd: root, tool_input: {} }, await makeGitOnlyPath());

    assert.ok(await exists(lock), "a lock with content was deleted");
  });

  it("AGEN-23 AC2: a placeholder-shaped lock is kept while a git process is running", async () => {
    const root = await makeRepository();
    const lock = path.join(root, ".git", "config.lock");
    await makePlaceholder(lock);
    // `git cat-file --batch` blocks reading stdin, so a real git process runs until the pipe closes.
    const running = spawn("git", ["cat-file", "--batch"], { cwd: root, stdio: ["pipe", "ignore", "ignore"] });
    try {
      await new Promise((resolve) => running.once("spawn", resolve));
      await runHook({ cwd: root, tool_input: {} });
      assert.ok(await exists(lock), "a lock was deleted under a running git process");
    } finally {
      running.stdin.end();
      await new Promise((resolve) => running.once("close", resolve));
    }

    // With git gone the same placeholder is removed, so the guard above is what held it back.
    await runHook({ cwd: root, tool_input: {} });
    assert.ok(!(await exists(lock)), "the placeholder stayed after git exited");
  });

  it("AGEN-23 AC2: a background Bash call is skipped, since its sandboxed command may still be live", async () => {
    const root = await makeRepository();
    const lock = path.join(root, ".git", "config.lock");
    await makePlaceholder(lock);

    await runHook({ cwd: root, tool_input: { command: "sleep 60", run_in_background: true } }, await makeGitOnlyPath());

    assert.ok(await exists(lock), "a background call's placeholder was deleted");
  });

  it("AGEN-23 scope: a repository with no lock, a non-git directory and a missing cwd are all silent no-ops", async () => {
    const searchPath = await makeGitOnlyPath();
    const root = await makeRepository();
    const plain = await makeTemporaryDirectory();

    for (const input of [{ cwd: root }, { cwd: plain }, {}]) {
      assert.deepStrictEqual(await runHook(input, searchPath), { stdout: "", stderr: "" });
    }
  });

  it("AGEN-23 AC1: from a linked worktree the placeholder in the main repository's .git is removed", async () => {
    const root = await makeRepository();
    const worktree = path.join(await makeTemporaryDirectory(), "linked");
    await git(root, ["worktree", "add", "--quiet", "-b", "linked", worktree]);
    const lock = path.join(root, ".git", "config.lock");
    await makePlaceholder(lock);

    // CLAUDE_PROJECT_DIR stays at the main repository; only the hook input's cwd names the worktree.
    await runHook({ cwd: worktree, tool_input: {} }, await makeGitOnlyPath());

    assert.ok(!(await exists(lock)), "the main repository's placeholder is still there");
  });

  it("AGEN-23 scope: the plugin registers the hook as a global PostToolUse on Bash, run with the plugin root", async () => {
    const { hooks } = JSON.parse(await readFile(path.join(repoRoot, "hooks", "hooks.json"), "utf8"));
    const group = hooks.PostToolUse.find((/** @type {{ hooks: { args: string[] }[] }} */ entry) =>
      entry.hooks.some((hook) => hook.args.includes("${CLAUDE_PLUGIN_ROOT}/hooks/clean-config-lock.js"))
    );
    assert.strictEqual(group?.matcher, "Bash");
    assert.deepStrictEqual(group.hooks, [
      { type: "command", command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/hooks/clean-config-lock.js"] },
    ]);
  });
});

/**
 * Runs the manual sweep from a directory.
 *
 * @param {string} cwd - Directory to run in.
 * @param {string[]} [args] - Command-line arguments.
 * @param {string} [searchPath] - PATH for the sweep; defaults to the real one.
 * @returns {Promise<{ stdout: string, stderr: string }>} The sweep's output; rejects on a non-zero exit.
 */
async function runSweep(cwd, args = [], searchPath = process.env.PATH ?? "") {
  return await run(process.execPath, [sweepScript, ...args], { cwd, env: { ...process.env, PATH: searchPath } });
}

/**
 * Reads the index's paths, to see what git would commit.
 *
 * @param {string} root - Repository root.
 * @returns {Promise<string[]>} Tracked paths.
 */
async function indexedPaths(root) {
  return (await git(root, ["ls-files"])).split("\n").filter(Boolean);
}

describe("AGEN-23 placeholder sweep", () => {
  it("AGEN-23 AC3: a tracked, deliberately empty file in the repo root is never removed", async () => {
    const root = await makeRepository();
    await writeFile(path.join(root, ".gitmodules"), "");
    await git(root, ["add", ".gitmodules"]);
    await git(root, ["commit", "--quiet", "-m", "empty on purpose"]);
    // Read-only too, so the file matches the placeholder shape and only being tracked protects it.
    await chmod(path.join(root, ".gitmodules"), 0o444);

    const { stdout } = await runSweep(root);

    assert.ok(await exists(path.join(root, ".gitmodules")), "a tracked empty file was removed");
    assert.match(stdout, /skip.*\.gitmodules.*tracked/);
  });

  it("AGEN-23 AC3: untracked and ignored empty files in the repo root and .claude/ are removed; content is kept", async () => {
    const root = await makeRepository();
    await writeFile(path.join(root, ".gitignore"), ".mcp.json\n");
    await git(root, ["add", ".gitignore"]);
    await git(root, ["commit", "--quiet", "-m", "ignore"]);
    await mkdir(path.join(root, ".claude"));
    await makePlaceholder(path.join(root, ".zshrc"));
    await makePlaceholder(path.join(root, ".mcp.json"));
    await makePlaceholder(path.join(root, ".claude", "skills"));
    await writeFile(path.join(root, ".bashrc"), "export A=1\n");
    await writeFile(path.join(root, ".claude", "settings.json"), "{}\n");

    await runSweep(root);

    for (const gone of [".zshrc", ".mcp.json", ".claude/skills"]) {
      assert.ok(!(await exists(path.join(root, gone))), `${gone} stayed`);
    }
    for (const kept of [".bashrc", ".claude/settings.json"]) {
      assert.ok(await exists(path.join(root, kept)), `${kept} was removed`);
    }
  });

  it("AGEN-23 AC3: an ignored, writable, empty file the user made (.env) survives; only read-only placeholders go", async () => {
    const root = await makeRepository();
    await writeFile(path.join(root, ".gitignore"), ".env\n");
    await git(root, ["add", ".gitignore"]);
    await git(root, ["commit", "--quiet", "-m", "ignore"]);
    await mkdir(path.join(root, ".claude"));
    await writeFile(path.join(root, ".env"), "");
    await writeFile(path.join(root, ".claude", "settings.local.json"), "");

    await runSweep(root);

    assert.ok(await exists(path.join(root, ".env")), "a writable empty .env was removed");
    assert.ok(await exists(path.join(root, ".claude", "settings.local.json")), "a writable empty settings file was removed");
  });

  it("AGEN-23 AC3: a placeholder swept into the index by a broad git add leaves the index too", async () => {
    const root = await makeRepository();
    await makePlaceholder(path.join(root, ".profile"));
    await git(root, ["add", ".profile"]);
    assert.ok((await indexedPaths(root)).includes(".profile"));

    await runSweep(root);

    assert.ok(!(await exists(path.join(root, ".profile"))), ".profile stayed on disk");
    assert.deepStrictEqual(await indexedPaths(root), ["README.md"]);
  });

  it("AGEN-23 AC3: --dry-run reports what would go and removes nothing", async () => {
    const root = await makeRepository();
    await makePlaceholder(path.join(root, ".zshrc"));

    const { stdout } = await runSweep(root, ["--dry-run"]);

    assert.match(stdout, /would remove.*\.zshrc/);
    assert.ok(await exists(path.join(root, ".zshrc")), "--dry-run removed a file");
  });

  it("AGEN-23 AC3: the sweep also removes a placeholder .git/config.lock, under the hook's guards, from a subdirectory", async () => {
    const root = await makeRepository();
    const lock = path.join(root, ".git", "config.lock");
    await mkdir(path.join(root, "src"));
    await makePlaceholder(lock);

    await runSweep(path.join(root, "src"), [], await makeGitOnlyPath());
    assert.ok(!(await exists(lock)), "the placeholder lock stayed");

    await writeFile(lock, "[core]\n");
    await runSweep(root, [], await makeGitOnlyPath());
    assert.ok(await exists(lock), "a real lock was removed");
  });

  it("AGEN-23 scope: the sweep refuses to run outside a git repository, and rejects an unknown option", async () => {
    const plain = await makeTemporaryDirectory();
    await assert.rejects(runSweep(plain), /not a git repository/);
    await assert.rejects(runSweep(plain, ["--nope"]), /Unknown option: --nope/);
  });
});
