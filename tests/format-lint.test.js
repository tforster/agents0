// format-lint.test.js -- guards the format and lint PostToolUse hook (AGEN-16)
//
// Seam: hooks/format-lint.js, run as a real child process with the Claude Code event on stdin, against a
// throwaway project whose node_modules/.bin links to this repo's real oxfmt and oxlint.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..");
const hookPath = path.join(repoRoot, "hooks", "format-lint.js");

/**
 * Builds a project holding one file, optionally with oxfmt and oxlint installed, then runs the hook on it.
 *
 * @param {{ file: string, content?: string, hasTools?: boolean, rootFiles?: Record<string, string> }} options - The
 *   changed file, relative to the project, and its content (none leaves it missing); whether node_modules/.bin has
 *   the tools; and other files, such as tool configs, to write at the project root.
 * @returns {Promise<{ written: () => Promise<string>, output: any }>} The file's content after the hook, and the
 *   hook's parsed JSON output (undefined when it printed nothing).
 */
async function runHook({ file, content, hasTools = true, rootFiles = {} }) {
  const root = await mkdtemp(path.join(tmpdir(), "agents0-format-lint-"));
  if (hasTools) {
    await mkdir(path.join(root, "node_modules", ".bin"), { recursive: true });
    for (const tool of ["oxfmt", "oxlint"]) {
      await symlink(path.join(repoRoot, "node_modules", ".bin", tool), path.join(root, "node_modules", ".bin", tool));
    }
  }
  for (const [name, text] of Object.entries(rootFiles)) {
    await writeFile(path.join(root, name), text);
  }
  const filePath = path.join(root, file);
  await mkdir(path.dirname(filePath), { recursive: true });
  if (content !== undefined) {
    await writeFile(filePath, content);
  }

  const event = { hook_event_name: "PostToolUse", tool_name: "Write", cwd: root, tool_input: { file_path: filePath } };
  const child = run("node", [hookPath], { cwd: root });
  child.child.stdin?.end(JSON.stringify(event));
  const { stdout } = await child;
  return { output: stdout ? JSON.parse(stdout) : undefined, written: () => readFile(filePath, "utf8") };
}

describe("format-lint hook", () => {
  it("AGEN-16 AC1: hooks.json runs the hook after Edit and Write, so feedback lands in the same turn", async () => {
    const { hooks } = JSON.parse(await readFile(path.join(repoRoot, "hooks", "hooks.json"), "utf8"));
    assert.deepStrictEqual(
      hooks.PostToolUse.filter((/** @type {{ hooks: { args?: string[] }[] }} */ group) =>
        group.hooks.some((hook) => hook.args?.[0]?.endsWith("/format-lint.js"))
      ),
      [
        {
          matcher: "Edit|Write",
          hooks: [{ type: "command", command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/hooks/format-lint.js"] }],
        },
      ]
    );
  });

  it("AGEN-16 AC1: a lint error introduced by a .js edit reaches the agent in the same turn", async () => {
    const { output } = await runHook({
      file: "src/broken.js",
      content: "if (x = 1) {\n  debugger;\n}\n",
      rootFiles: { ".oxlintrc.json": JSON.stringify({ rules: { "no-debugger": "error" } }) },
    });
    assert.strictEqual(output?.decision, "block");
    assert.match(output.reason, /no-debugger/);
    assert.match(output.reason, /src\/broken\.js/);
  });

  for (const { file, content, formatted } of [
    { file: "config/app.yaml", content: "name:   app\nlist:\n    -   one\n", formatted: "name: app\nlist:\n  - one\n" },
    { file: "docs/note.md", content: "# Note\n* one\n* two\n", formatted: "# Note\n\n- one\n- two\n" },
    { file: "data/settings.json", content: '{"a":1,   "b":[1,2]}', formatted: '{ "a": 1, "b": [1, 2] }\n' },
  ]) {
    it(`AGEN-16 AC2: an unformatted ${path.extname(file)} edit is formatted in place, and the agent is told to re-read`, async () => {
      const { output, written } = await runHook({ file, content });
      assert.strictEqual(await written(), formatted);
      assert.match(output?.hookSpecificOutput?.additionalContext, new RegExp(`oxfmt reformatted .*${file}; re-read`));
    });
  }

  it("AGEN-16 scope: oxfmt's Markdown keeps the markdown rule's constraints: no hard wrap, empty > line in callouts", async () => {
    const longLine = `Prose ${"that runs on ".repeat(20)}well past the print width.`;
    const content = `# Note\n\n> [!NOTE]\n>\n> ${longLine}\n\n${longLine}\n`;
    const { output, written } = await runHook({ file: "docs/note.md", content });
    assert.strictEqual(await written(), content);
    assert.strictEqual(output, undefined);
  });

  it("AGEN-16 scope: lint warnings stay out of the report when an error blocks", async () => {
    const { output } = await runHook({
      file: "src/mixed.js",
      content: "const unused = 1;\ndebugger;\n",
      rootFiles: { ".oxlintrc.json": JSON.stringify({ rules: { "no-debugger": "error", "no-unused-vars": "warn" } }) },
    });
    assert.match(output?.reason, /no-debugger/);
    assert.doesNotMatch(output.reason, /no-unused-vars/);
  });

  it("AGEN-16 scope: a changed file that no longer exists is a quiet no-op", async () => {
    const { output } = await runHook({ file: "src/gone.js" });
    assert.strictEqual(output, undefined);
  });

  it("AGEN-16 AC3: a .sql edit is a no-op, not an error", async () => {
    const content = "select   1 ;\n";
    const { output, written } = await runHook({ file: "db/query.sql", content });
    assert.strictEqual(output, undefined);
    assert.strictEqual(await written(), content);
  });

  it("AGEN-16 scope: is a quiet no-op in a project without oxfmt and oxlint", async () => {
    const content = "if (x = 1) {debugger}";
    const { output, written } = await runHook({ file: "src/broken.js", content, hasTools: false });
    assert.strictEqual(output, undefined);
    assert.strictEqual(await written(), content);
  });

  it("AGEN-16 scope: does not block on lint warnings, only errors", async () => {
    const { output } = await runHook({
      file: "src/warned.js",
      content: "debugger;\n",
      rootFiles: { ".oxlintrc.json": JSON.stringify({ rules: { "no-debugger": "warn" } }) },
    });
    assert.strictEqual(output, undefined);
  });

  it("AGEN-16 scope: feeds an oxfmt failure, such as a syntax error, back to the agent", async () => {
    const { output } = await runHook({ file: "src/half.js", content: "const = ;\n" });
    assert.strictEqual(output?.decision, "block");
    assert.match(output.reason, /oxfmt failed on .*src\/half\.js/);
  });

  it("AGEN-16 scope: leaves a file the project's oxfmt and oxlint configs ignore untouched", async () => {
    const content = "debugger;if(x){}";
    const { output, written } = await runHook({
      file: "vendor/lib.js",
      content,
      rootFiles: {
        ".oxfmtrc.json": JSON.stringify({ ignorePatterns: ["vendor/**"] }),
        ".oxlintrc.json": JSON.stringify({ rules: { "no-debugger": "error" }, ignorePatterns: ["vendor/**"] }),
      },
    });
    assert.strictEqual(output, undefined);
    assert.strictEqual(await written(), content);
  });
});
