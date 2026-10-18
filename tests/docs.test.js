// docs.test.js — guards the toolkit's own documentation after the Agents0 rebrand
//
// DEV0.md left with the philosophy (DEV0-66): its "How Work Is Shaped" and "Dev0 and Agents"
// sections now live in docs/explanation/, and the rest is the dev0 repo's job. The callout rule
// exists because oxfmt unwraps prose: without an empty `>` line it folds `> [!NOTE]` onto the
// text and GitHub stops rendering the callout.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("toolkit documentation", () => {
  it("DEV0-66 AC2: DEV0.md is gone and current docs no longer link to it", async () => {
    await assert.rejects(access(path.join(repoRoot, "DEV0.md")), /ENOENT/);

    // docs/scratch/ is a dated design log and keeps its historical mentions.
    const currentDocs = [
      "README.md",
      "CLAUDE.md",
      "docs/README.md",
      "docs/explanation/README.md",
      "docs/explanation/architecture.md",
    ];
    for (const file of currentDocs) {
      const content = await readFile(path.join(repoRoot, file), "utf8");
      assert.ok(!content.includes("DEV0.md"), `${file} references DEV0.md`);
    }
  });

  it("DEV0-66 AC2: the moved sections are indexed in docs/explanation/", async () => {
    const moved = await readFile(path.join(repoRoot, "docs/explanation/shaping-work-for-agents.md"), "utf8");
    assert.match(moved, /^## 1\. How Work Is Shaped$/m);
    assert.match(moved, /^## 2\. Dev0 and Agents$/m);

    const index = await readFile(path.join(repoRoot, "docs/explanation/README.md"), "utf8");
    assert.ok(index.includes("(./shaping-work-for-agents.md)"), "docs/explanation/README.md does not index the moved sections");
  });

  it("DEV0-66 AC3: every callout in the markdown rule and skill has an empty > line after its marker", async () => {
    for (const file of ["rules/markdown.md", "skills/markdown/SKILL.md"]) {
      const lines = (await readFile(path.join(repoRoot, file), "utf8")).split("\n");
      lines.forEach((line, index) => {
        const marker = line.match(/^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/)?.[0];
        if (!marker) return;
        assert.strictEqual(line, marker, `${file}:${index + 1} callout marker must be on its own line`);
        assert.strictEqual(lines[index + 1], ">", `${file}:${index + 1} callout marker is not followed by an empty > line`);
      });
    }
  });
});
