// lint-config.test.js -- guards that oxlint enforces the javascript skill's mechanised rules (AGEN-55)
//
// Seam: the repo's own oxlint binary and .oxlintrc.json, run on a throwaway file, so the test fails if the
// rule leaves the config, not if its wording changes.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..");

/**
 * Lints one source text with the repo's oxlint config.
 *
 * @param {string} source - JavaScript to lint.
 * @returns {Promise<string>} oxlint's report; empty when the source is clean.
 */
async function lint(source) {
  const filePath = path.join(await mkdtemp(path.join(tmpdir(), "agents0-lint-config-")), "sample.js");
  await writeFile(filePath, source);
  const oxlint = path.join(repoRoot, "node_modules", ".bin", "oxlint");
  return await run(oxlint, ["--config", path.join(repoRoot, ".oxlintrc.json"), filePath]).then(
    () => "",
    (/** @type {{ stdout: string }} */ error) => error.stdout
  );
}

describe("oxlint config", () => {
  it("AGEN-55 AC1: a braceless if fails lint (javascript skill rule 12, D9)", async () => {
    assert.match(await lint("export function first(items) {\n  if (items.length === 0) return;\n  return items[0];\n}\n"), /curly/);
  });

  it("AGEN-55 AC1: an if with braces, in the multi-line form, passes", async () => {
    assert.strictEqual(
      await lint("export function first(items) {\n  if (items.length === 0) {\n    return;\n  }\n  return items[0];\n}\n"),
      ""
    );
  });
});
