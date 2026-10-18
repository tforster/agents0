// new-skill.test.js — behavioural tests for agents0 new skill <name>

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Local dependencies
import { newSkill } from "../lib/new-skill.js";

/**
 * Builds an isolated fixture: a fake agents0 repo root with a skills/ folder.
 *
 * @returns {Promise<{root: string, toolkitRoot: string}>} Fixture paths.
 */
async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "agents0-new-skill-"));
  const toolkitRoot = path.join(root, "repo");
  await mkdir(path.join(toolkitRoot, "install", "skills"), { recursive: true });
  return { root, toolkitRoot };
}

describe("newSkill", () => {
  it("creates install/skills/<name>/SKILL.md with valid frontmatter", async () => {
    const { root, toolkitRoot } = await makeFixture();

    await newSkill("my-new-skill", { toolkitRoot });

    const content = await readFile(path.join(toolkitRoot, "install", "skills", "my-new-skill", "SKILL.md"), "utf8");
    assert.match(content, /^---\nname: my-new-skill\ndescription: .+\n---\n/);

    await rm(root, { recursive: true, force: true });
  });

  it("refuses if a skill with that name already exists", async () => {
    const { root, toolkitRoot } = await makeFixture();
    await newSkill("existing-skill", { toolkitRoot });

    await assert.rejects(newSkill("existing-skill", { toolkitRoot }), /already exists/i);

    await rm(root, { recursive: true, force: true });
  });
});
