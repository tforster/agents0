// account-gate.test.js -- AGEN-22: the UserPromptSubmit hook that refuses a prompt when the signed-in
// Claude account is not the one mapped to the repo's `origin` owner.
//
// Each case runs hooks/account-gate.js as a real child process, the way Claude Code does: hook input
// as JSON on stdin, the account map in the environment, and a throwaway CLAUDE_CONFIG_DIR holding a
// fake .claude.json, so no real account or configuration is read.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const hookPath = path.resolve(import.meta.dirname, "..", "hooks", "account-gate.js");
const personal = "troy.forster@gmail.com";
const work = "forster@cpc-ccp.com";
const accounts = JSON.stringify({ tforster: personal, "Canadian-Pork-Council": work });

/**
 * Creates a git repository in a temp directory, optionally with an origin remote.
 *
 * @param {string | null} originUrl - URL for `origin`, or null for no remote.
 * @returns {Promise<string>} The repository path.
 */
async function makeRepo(originUrl) {
  const repo = await mkdtemp(path.join(tmpdir(), "account-gate-repo-"));
  await run("git", ["init", "--quiet"], { cwd: repo });
  if (originUrl) await run("git", ["remote", "add", "origin", originUrl], { cwd: repo });
  return repo;
}

/**
 * Runs the hook for a prompt in `cwd`, signed in as `email`.
 *
 * @param {object} options - Scenario.
 * @param {string} options.cwd - Directory the prompt is submitted in.
 * @param {string | null} options.email - Signed-in account, or null for a config with no oauthAccount.
 * @param {string | undefined} options.accountMap - Value of ClaudeAccounts; undefined leaves it unset.
 * @param {boolean} [options.writeConfig] - False leaves the config directory without a .claude.json.
 * @returns {Promise<{ stdout: string, code: number }>} Hook output and exit code.
 */
async function runHook({ cwd, email, accountMap, writeConfig = true }) {
  const configDir = await mkdtemp(path.join(tmpdir(), "account-gate-config-"));
  if (writeConfig) {
    await writeFile(path.join(configDir, ".claude.json"), JSON.stringify(email ? { oauthAccount: { emailAddress: email } } : {}));
  }
  const { ClaudeAccounts: _inherited, ...env } = process.env;
  if (accountMap !== undefined) env.ClaudeAccounts = accountMap;
  env.CLAUDE_CONFIG_DIR = configDir;
  const hook = run("node", [hookPath], { env });
  hook.child.stdin?.end(JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "hello", cwd }));
  return await hook.then(
    ({ stdout }) => ({ stdout, code: 0 }),
    (error) => ({ stdout: error.stdout, code: error.code })
  );
}

describe("account gate hook", () => {
  it("AGEN-22 AC2: the plugin registers the hook on UserPromptSubmit, so every session gets it", async () => {
    const { hooks } = JSON.parse(await readFile(path.resolve(import.meta.dirname, "..", "hooks", "hooks.json"), "utf8"));
    const commands = (hooks.UserPromptSubmit ?? []).flatMap((/** @type {{ hooks: object[] }} */ entry) => entry.hooks);
    assert.ok(
      commands.some((/** @type {{ args?: string[] }} */ command) =>
        command.args?.includes("${CLAUDE_PLUGIN_ROOT}/hooks/account-gate.js")
      ),
      "hooks.json has no UserPromptSubmit entry running hooks/account-gate.js"
    );
  });

  it("AGEN-22 AC2: a prompt in a tforster repo is refused while signed in as the CPC account", async () => {
    const cwd = await makeRepo("git@github.com:tforster/agents0.git");
    const { stdout } = await runHook({ cwd, email: work, accountMap: accounts });
    const output = JSON.parse(stdout);
    assert.equal(output.decision, "block");
    assert.match(output.reason, new RegExp(personal));
    assert.match(output.reason, /\/logout/);
    assert.match(output.reason, /\/login/);
  });

  const mismatches = [
    ["SSH scp form", "git@github.com:tforster/agents0.git", work, personal],
    ["HTTPS", "https://github.com/tforster/agents0.git", work, personal],
    ["HTTPS without .git", "https://github.com/tforster/agents0", work, personal],
    ["HTTPS with a user", "https://tforster@github.com/tforster/agents0.git", work, personal],
    ["ssh:// URL", "ssh://git@github.com/tforster/agents0.git", work, personal],
    ["owner in another case", "git@github.com:TFORSTER/agents0.git", work, personal],
    ["CPC repo, personal account", "git@github.com:Canadian-Pork-Council/site.git", personal, work],
  ];
  for (const [name, remote, signedIn, expected] of mismatches) {
    it(`AGEN-22 AC1: ${name} is refused, naming ${expected}`, async () => {
      const cwd = await makeRepo(remote);
      const { stdout } = await runHook({ cwd, email: signedIn, accountMap: accounts });
      const output = JSON.parse(stdout);
      assert.equal(output.decision, "block");
      assert.ok(output.reason.includes(expected), output.reason);
    });
  }

  /** @type {[string, string | null, string | null, string | undefined][]} */
  const passes = [
    ["the account matches the owner", "git@github.com:tforster/agents0.git", personal, accounts],
    ["the account matches in another case", "git@github.com:tforster/agents0.git", personal.toUpperCase(), accounts],
    ["the owner is not in the map", "git@github.com:someone-else/repo.git", work, accounts],
    ["the remote has no owner segment", "https://example.com/repo.git", work, accounts],
    ["the variable is unset", "git@github.com:tforster/agents0.git", work, undefined],
    ["there is no origin", null, work, accounts],
    ["the session has no oauthAccount", "git@github.com:tforster/agents0.git", null, accounts],
  ];
  for (const [name, remote, signedIn, accountMap] of passes) {
    it(`AGEN-22 AC1: passes silently when ${name}`, async () => {
      const cwd = await makeRepo(remote);
      const { stdout, code } = await runHook({ cwd, email: signedIn, accountMap });
      assert.equal(code, 0);
      assert.equal(stdout, "");
    });
  }

  it("AGEN-22 AC1: passes silently outside a git repository", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "account-gate-plain-"));
    const { stdout, code } = await runHook({ cwd, email: work, accountMap: accounts });
    assert.equal(code, 0);
    assert.equal(stdout, "");
  });

  it("AGEN-22 AC1: passes silently when ~/.claude.json does not exist", async () => {
    const cwd = await makeRepo("git@github.com:tforster/agents0.git");
    const { stdout, code } = await runHook({ cwd, email: work, accountMap: accounts, writeConfig: false });
    assert.equal(code, 0);
    assert.equal(stdout, "");
  });

  it("AGEN-22 AC3: malformed ClaudeAccounts blocks, naming the variable and the parse error", async () => {
    const cwd = await makeRepo("git@github.com:tforster/agents0.git");
    const { stdout } = await runHook({ cwd, email: work, accountMap: "{tforster: nope" });
    const output = JSON.parse(stdout);
    assert.equal(output.decision, "block");
    assert.match(output.reason, /ClaudeAccounts/);
    assert.match(output.reason, /JSON/);
  });
});
