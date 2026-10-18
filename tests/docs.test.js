// docs.test.js — guards the toolkit's own documentation after the Agents0 rebrand
//
// DEV0.md left with the philosophy (DEV0-66): its "How Work Is Shaped" and "Dev0 and Agents"
// sections now live in docs/explanation/, and the rest is the dev0 repo's job. The callout rule
// exists because oxfmt unwraps prose: without an empty `>` line it folds `> [!NOTE]` onto the
// text and GitHub stops rendering the callout.
//
// The root README shows how Agents0 reaches an agent (DEV0-68). It is written for a visitor who
// knows Claude Code but none of our context, so terms come before the diagrams, and the diagrams
// live there alone: the scratch context map keeps only the story keys the README leaves out.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

// About 240 words a minute, so five minutes of prose; code fences are skimmed, not read.
const readmeWordLimit = 1_200;

/**
 * Reads the root README.
 *
 * @returns {Promise<string>} README content.
 */
async function readReadme() {
  return await readFile(path.join(repoRoot, "README.md"), "utf8");
}

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

describe("root README", () => {
  it("DEV0-68 AC1: the context map diagrams sit after the Dev0 link and before install, each introduced by its question", async () => {
    const readme = await readReadme();
    const fences = [...readme.matchAll(/^```mermaid$/gm)].map((match) => match.index ?? -1);
    assert.strictEqual(fences.length, 3, "expected the always-loaded, on-demand and enforcement diagrams");

    const dev0Link = readme.indexOf("](https://github.com/tforster/dev0)");
    const install = readme.indexOf("claude plugin marketplace add tforster/agents0");
    assert.ok(dev0Link !== -1 && dev0Link < fences[0], "the Dev0 link does not come before the diagrams");
    assert.ok(fences[fences.length - 1] < install, "a diagram comes after the install instructions");

    for (const fence of fences) {
      const introduction = readme.slice(0, fence).trimEnd().split("\n").at(-1) ?? "";
      assert.match(introduction, /\?/, `diagram at ${fence} is not introduced by the question it answers`);
    }
  });

  it("DEV0-68 AC2: every term the diagrams use is defined before them, linking Claude Code's docs where it defines the term", async () => {
    const readme = await readReadme();
    const firstDiagram = readme.indexOf("```mermaid");
    const terms = ["Architect", "Doer", "Blueprint", "Agent", "Loop worker", "Rule", "Skill", "Hook", "ADR", "Glossary"];
    for (const term of [...terms, "Always loaded", "On demand"]) {
      const definition = readme.search(new RegExp(`^\\| \\*\\*\\[?${term}\\b`, "m"));
      assert.ok(definition !== -1 && definition < firstDiagram, `${term} is not defined before the diagrams`);
    }
    for (const page of ["skills", "hooks", "sub-agents", "memory", "mcp", "plugins"]) {
      assert.ok(
        readme.slice(0, firstDiagram).includes(`https://code.claude.com/docs/en/${page})`),
        `no link to Claude Code's ${page} docs`
      );
    }
  });

  it("DEV0-68 AC3: the README opens with what Agents0 gives you, links Dev0 for the philosophy and never mentions prompt.md", async () => {
    const readme = await readReadme();
    const opening = readme.split("## 1. About")[1]?.trim().split("\n")[0] ?? "";
    assert.match(opening, /^Agents0 gives /);
    assert.ok(opening.includes("](https://github.com/tforster/dev0)"), "the opening does not link Dev0");
    assert.ok(!readme.includes("prompt.md"), "the README mentions prompt.md");
  });

  it("DEV0-68 AC4: the diagrams have one home, the README, and the scratch context map links to it", async () => {
    const entries = await readdir(repoRoot, { recursive: true, withFileTypes: true });
    const markdown = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => path.relative(repoRoot, path.join(entry.parentPath, entry.name)))
      .filter((file) => !file.startsWith("node_modules") && !file.startsWith(".git"));
    for (const file of markdown) {
      if (file === "README.md") continue;
      const content = await readFile(path.join(repoRoot, file), "utf8");
      assert.ok(!content.includes("```mermaid"), `${file} carries a second copy of a diagram`);
    }

    const contextMap = await readFile(path.join(repoRoot, "docs/scratch/2026-10-04-agent-context-map.md"), "utf8");
    assert.ok(
      contextMap.includes("(../../README.md#3-how-agents0-reaches-an-agent)"),
      "the scratch context map does not link the README"
    );
  });

  it("DEV0-68 AC6: the README reads in five minutes, with development detail in docs/", async () => {
    const readme = await readReadme();
    const prose = readme.replace(/^```[\s\S]*?^```$/gm, "");
    const words = prose.split(/\s+/).filter(Boolean).length;
    assert.ok(words <= readmeWordLimit, `README prose is ${words} words; the limit is ${readmeWordLimit}`);
    assert.ok(readme.includes("(./docs/how-to/develop-agents0.md)"), "the README does not link the development how-to");
  });
});
