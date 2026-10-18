// plugin.test.js -- guards Agents0's shape as a Claude Code marketplace and plugin (DEV0-67)
//
// The repo root is both the `agents0` marketplace and the `agents0` plugin. Rules cannot ship in a
// plugin, so each one is injected by its own SessionStart hook; the 10,000-character limit is the
// hook output cap, past which Claude Code shows only a file path and a 2,000-character preview.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..");
const hookCap = 10_000;
const shaPattern = /^[0-9a-f]{40}$/;

// Skills that were vendored copies of upstream plugins. They stay deleted: most come from the pinned
// entries, and Cloudflare's are installed per project instead (architect's decision, DEV0-67).
const vendoredSkills = [
  "agents-sdk",
  "c4-architecture",
  "cloudflare",
  "cloudflare-email-service",
  "cloudflare-one",
  "cloudflare-one-migrations",
  "durable-objects",
  "sandbox-sdk",
  "tare",
  "turnstile-spin",
  "web-perf",
  "workers-best-practices",
  "wrangler",
  "write-a-skill",
];

/**
 * Reads and parses a JSON file under the repo root.
 *
 * @param {string} relativePath - Path from the repo root.
 * @returns {Promise<any>} Parsed JSON.
 */
async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

/**
 * Reports whether a path under the repo root exists.
 *
 * @param {string} relativePath - Path from the repo root.
 * @returns {Promise<boolean>} Whether it exists.
 */
async function exists(relativePath) {
  return await access(path.join(repoRoot, relativePath)).then(
    () => true,
    () => false
  );
}

/**
 * Lists every file under a repo directory, as paths from the repo root.
 *
 * @param {string} directory - Directory from the repo root.
 * @returns {Promise<string[]>} File paths.
 */
async function listFiles(directory) {
  const entries = await readdir(path.join(repoRoot, directory), { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => path.relative(repoRoot, path.join(entry.parentPath, entry.name)));
}

/**
 * Runs hooks/inject-rule.js the way Claude Code does, with the plugin root in the environment.
 *
 * @param {string} hookEventName - SessionStart or SubagentStart.
 * @param {string} rulePath - Absolute path of the rule file.
 * @param {string} pluginRoot - Value for CLAUDE_PLUGIN_ROOT.
 * @returns {Promise<string>} The hook's stdout.
 */
async function injectRule(hookEventName, rulePath, pluginRoot) {
  const { stdout } = await run("node", [path.join(repoRoot, "hooks", "inject-rule.js"), hookEventName, rulePath], {
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot },
  });
  return stdout;
}

describe("Agents0 marketplace and plugin", () => {
  it("DEV0-67 AC1: the repo root is the agents0 marketplace, listing agents0 at ./ and pinned third-party plugins", async () => {
    const marketplace = await readJson(".claude-plugin/marketplace.json");
    assert.strictEqual(marketplace.name, "agents0");
    assert.ok(marketplace.owner?.name, "marketplace needs owner.name");

    const [own, ...thirdParty] = marketplace.plugins;
    assert.deepStrictEqual([own.name, own.source], ["agents0", "./"]);
    assert.ok(thirdParty.length > 0, "no third-party plugins listed");
    for (const { name, source } of thirdParty) {
      assert.match(source.sha ?? "", shaPattern, `${name} is not pinned to a 40-character sha`);
      // Pin to a release tag where upstream has one, so `claude plugin update` moves with releases.
      if (source.ref !== undefined) assert.match(source.ref, /^v\d+\.\d+\.\d+$/, `${name} ref is not a release tag`);
    }
  });

  it("DEV0-67 AC1: cloudflare is not in the marketplace; projects install it themselves", async () => {
    const { plugins } = await readJson(".claude-plugin/marketplace.json");
    assert.ok(!plugins.some((/** @type {{ name: string }} */ plugin) => plugin.name === "cloudflare"), "cloudflare is listed");
  });

  it("DEV0-67 AC1: vendored third-party skills are gone from skills/", async () => {
    for (const skill of vendoredSkills) {
      assert.ok(!(await exists(`skills/${skill}`)), `skills/${skill} is still vendored`);
    }
  });

  it("DEV0-67 AC2: plugin.json names the plugin agents0 and sets no version", async () => {
    const plugin = await readJson(".claude-plugin/plugin.json");
    assert.strictEqual(plugin.name, "agents0");
    // With no version, Claude Code keys the cache by commit, so every commit is an update.
    assert.ok(!("version" in plugin), "plugin.json must not set version");
  });

  it("DEV0-67 AC2: skills, agents, hooks and ADRs sit where a plugin expects them, not under install/", async () => {
    for (const directory of ["skills", "agents", "hooks", "rules", "adr"]) {
      assert.ok(await exists(directory), `${directory}/ is missing`);
    }
    assert.ok(await exists("hooks/hooks.json"), "hooks/hooks.json is missing");
    for (const skill of await readdir(path.join(repoRoot, "skills"))) {
      assert.ok(await exists(`skills/${skill}/SKILL.md`), `skills/${skill} has no SKILL.md`);
    }
    // install/skills/synced/ may linger, ignored, on a machine that has not migrated yet.
    for (const old of ["install/rules", "install/agents", "install/adr"]) {
      assert.ok(!(await exists(old)), `${old} still exists`);
    }
  });

  // SessionStart reaches the main session and `claude -p` workers; SubagentStart reaches Agent-tool subagents.
  const hookEvents = /** @type {const} */ ({ SessionStart: "startup|clear|compact", SubagentStart: "*" });

  it("DEV0-67 AC3: every rule is under 10,000 characters and has its own SessionStart and SubagentStart hook", async () => {
    const { hooks } = await readJson("hooks/hooks.json");
    const rules = (await readdir(path.join(repoRoot, "rules"))).map((name) => `rules/${name}`);
    assert.deepStrictEqual(Object.keys(hooks).sort(), Object.keys(hookEvents).sort());

    for (const [event, matcher] of Object.entries(hookEvents)) {
      const groups = hooks[event];
      assert.deepStrictEqual(
        groups.map((/** @type {{ matcher: string }} */ group) => group.matcher),
        [matcher]
      );

      /** @type {string[]} */
      const hooked = groups[0].hooks.map((/** @type {{ command: string, args: string[] }} */ hook) => {
        assert.deepStrictEqual(
          [hook.command, hook.args[0], hook.args[1]],
          ["node", "${CLAUDE_PLUGIN_ROOT}/hooks/inject-rule.js", event]
        );
        return hook.args[2].replace("${CLAUDE_PLUGIN_ROOT}/", "");
      });
      assert.deepStrictEqual([...hooked].sort(), [...rules].sort(), `each rule needs exactly one ${event} entry`);
    }

    for (const rule of rules) {
      const { length } = await readFile(path.join(repoRoot, rule), "utf8");
      assert.ok(length < hookCap, `${rule} is ${length} characters; the hook output cap is ${hookCap}`);
    }
  });

  it("DEV0-67 AC3: the hook returns the rule as additionalContext, plugin root substituted, within the cap", async () => {
    // A long root leaves headroom for real cache paths such as ~/.claude/plugins/cache/agents0/agents0/<sha>.
    const pluginRoot = `/${"p".repeat(200)}`;
    for (const hookEventName of Object.keys(hookEvents)) {
      for (const rule of await readdir(path.join(repoRoot, "rules"))) {
        const content = await readFile(path.join(repoRoot, "rules", rule), "utf8");
        const output = JSON.parse(await injectRule(hookEventName, path.join(repoRoot, "rules", rule), pluginRoot));
        const additionalContext = content.replaceAll("${CLAUDE_PLUGIN_ROOT}", pluginRoot);
        assert.deepStrictEqual(output, { hookSpecificOutput: { hookEventName, additionalContext } });
        assert.ok(additionalContext.length < hookCap, `rules/${rule} renders to ${additionalContext.length} characters`);
      }
    }
  });

  it("DEV0-67 AC3: the hook fails loudly outside Claude Code, with no plugin root", async () => {
    await assert.rejects(injectRule("SessionStart", path.join(repoRoot, "rules", "dev0.md"), ""), /CLAUDE_PLUGIN_ROOT is not set/);
  });

  it("DEV0-68 AC7: no rule carries frontmatter, since the hook injects the whole file and reads none", async () => {
    // applyTo: was GitHub Copilot's path scoping; Claude Code never honoured it, so it only misled.
    for (const rule of await readdir(path.join(repoRoot, "rules"))) {
      const content = await readFile(path.join(repoRoot, "rules", rule), "utf8");
      assert.ok(!content.startsWith("---"), `rules/${rule} carries frontmatter the hook does not use`);
    }
  });

  it("DEV0-67 AC4: no rule, skill or agent assumes ~/.claude/, and plugin paths resolve inside the plugin", async () => {
    const files = [...(await listFiles("rules")), ...(await listFiles("skills")), ...(await listFiles("agents"))];
    for (const file of files) {
      const content = await readFile(path.join(repoRoot, file), "utf8");
      assert.ok(!content.includes("~/.claude/"), `${file} assumes ~/.claude/`);

      for (const [, target] of content.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g)) {
        assert.ok(await exists(target), `${file} names \${CLAUDE_PLUGIN_ROOT}/${target}, which does not exist`);
      }
      // ${CLAUDE_SKILL_DIR} is the directory holding the skill's SKILL.md: skills/<name>/.
      const skillDir = file.split(path.sep).slice(0, 2).join("/");
      for (const [, target] of content.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([\w./-]+)/g)) {
        assert.ok(await exists(`${skillDir}/${target}`), `${file} names \${CLAUDE_SKILL_DIR}/${target}, which does not exist`);
      }
    }
  });

  it("DEV0-67 AC5: the CLI and installer are gone", async () => {
    for (const old of ["bin", "lib", "agents0.json"]) {
      assert.ok(!(await exists(old)), `${old} still exists`);
    }
    const packageJson = await readJson("package.json");
    assert.ok(!("bin" in packageJson) && !("engines" in packageJson), "package.json still carries the CLI's bin or engines");
  });

  it("DEV0-67 AC6: the README documents install, the edit loop and the pin policy", async () => {
    // DEV0-68 AC6 moved the edit loop and pin policy into a how-to, linked from the README.
    const readme = (
      await Promise.all(["README.md", "docs/how-to/develop-agents0.md"].map((file) => readFile(path.join(repoRoot, file), "utf8")))
    ).join("\n");
    for (const text of [
      "claude plugin marketplace add tforster/agents0",
      "claude plugin install agents0@agents0",
      '"extraKnownMarketplaces"',
      '"agents0@agents0": true',
      "claude plugin update agents0@agents0",
      "--plugin-dir",
      "release tag",
      "claude plugin uninstall",
    ]) {
      assert.ok(readme.includes(text), `README does not mention ${text}`);
    }
  });

  it("DEV0-67 AC7: claude plugin validate passes on the repo root", async (context) => {
    const hasClaude = await run("claude", ["--version"]).then(
      () => true,
      () => false
    );
    if (!hasClaude) return context.skip("claude is not on PATH");

    // A throwaway config directory, so validation never reads or writes the real ~/.claude.
    const configDir = await mkdtemp(path.join(tmpdir(), "agents0-validate-"));
    try {
      const { stdout } = await run("claude", ["plugin", "validate", repoRoot], {
        env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
      });
      assert.match(stdout, /Validation passed/);
    } finally {
      await rm(configDir, { recursive: true, force: true });
    }
  });
});
