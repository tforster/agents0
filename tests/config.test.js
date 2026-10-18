// config.test.js — behavioural tests for agents0.json loading, validation and ~ expansion

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import path from "node:path";

// Local dependencies
import { loadConfig } from "../lib/config.js";

describe("loadConfig", () => {
  /** @type {string} */
  let root;
  /** @type {string} */
  let configPath;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "agents0-config-"));
    configPath = path.join(root, "agents0.json");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("parses harnesses and expands ~ to the home directory", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ harnesses: { claude: { skills: "~/.claude/skills", agents: "~/.claude/agents", rules: "/abs/rules" } } })
    );

    const config = await loadConfig(configPath);

    assert.strictEqual(config.harnesses.claude.skills, path.join(homedir(), ".claude", "skills"));
    assert.strictEqual(config.harnesses.claude.agents, path.join(homedir(), ".claude", "agents"));
    assert.strictEqual(config.harnesses.claude.rules, "/abs/rules");
  });

  it("expands ~ in the optional bin path and leaves it undefined when absent", async () => {
    await writeFile(configPath, JSON.stringify({ bin: "~/.local/bin/agents0", harnesses: {} }));
    assert.strictEqual((await loadConfig(configPath)).bin, path.join(homedir(), ".local", "bin", "agents0"));

    await writeFile(configPath, JSON.stringify({ harnesses: {} }));
    assert.strictEqual((await loadConfig(configPath)).bin, undefined);
  });

  it("DEV0-66 AC1: the toolkit's own agents0.json links the CLI as ~/.local/bin/agents0", async () => {
    const toolkitConfig = path.resolve(import.meta.dirname, "..", "agents0.json");
    assert.strictEqual((await loadConfig(toolkitConfig)).bin, path.join(homedir(), ".local", "bin", "agents0"));
  });

  it("rejects a missing file with a clear message", async () => {
    await assert.rejects(loadConfig(configPath), { message: `Config not found: ${configPath}` });
  });

  it("rejects malformed JSON, naming the file", async () => {
    await writeFile(configPath, '{ "harnesses": { ');

    await assert.rejects(loadConfig(configPath), (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /^Malformed JSON in /);
      assert.ok(error.message.includes(configPath));
      return true;
    });
  });

  const invalidShapes = [
    { name: "a top-level array", value: [], pattern: /top-level "harnesses" object/ },
    { name: "no harnesses key", value: {}, pattern: /top-level "harnesses" object/ },
    { name: "harnesses as an array", value: { harnesses: [] }, pattern: /top-level "harnesses" object/ },
    { name: "a harness that is not an object", value: { harnesses: { claude: "x" } }, pattern: /harness "claude"/ },
    { name: "a non-string category path", value: { harnesses: { claude: { skills: 1 } } }, pattern: /"claude\.skills"/ },
    { name: "a non-string bin path", value: { bin: 1, harnesses: {} }, pattern: /"bin" must be a path string/ },
  ];

  for (const { name, value, pattern } of invalidShapes) {
    it(`rejects ${name}`, async () => {
      await writeFile(configPath, JSON.stringify(value));
      await assert.rejects(loadConfig(configPath), pattern);
    });
  }
});
