// lint-config.test.js -- guards that oxlint enforces the javascript skill's mechanised rules (AGEN-55)
//
// Seam: `npm run lint` on a probe file written into the real hooks/ and tests/ folders, so the test fails
// if the rule leaves the config, if ignorePatterns or a nested config stop covering a folder, or if the
// lint script changes -- not if the rule's wording changes.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..");

/**
 * Lints one source text as a file in a repo folder, through the project's own lint script.
 *
 * @param {string} folder - Repo folder to place the probe in, such as "hooks".
 * @param {string} source - JavaScript to lint.
 * @returns {Promise<string>} oxlint's report when it fails; empty when the source is clean.
 */
async function lintIn(folder, source) {
  // A unique name keeps a parallel run from linting or deleting this run's probe.
  const probe = path.join(folder, `lint-probe-${randomUUID()}.js`);
  await writeFile(path.join(repoRoot, probe), source);
  try {
    return await run("npm", ["run", "--silent", "lint", "--", probe], { cwd: repoRoot }).then(
      () => "",
      (/** @type {{ stdout: string }} */ error) => error.stdout
    );
  } finally {
    await rm(path.join(repoRoot, probe), { force: true });
  }
}

describe("oxlint config", () => {
  for (const folder of ["hooks", "tests"]) {
    it(`AGEN-55 AC1: a braceless if in ${folder}/ fails npm run lint (javascript skill rule 12, D9)`, async () => {
      const source = "export function first(items) {\n  if (items.length === 0) return;\n  return items[0];\n}\n";
      assert.match(await lintIn(folder, source), /curly/);
    });
  }

  it("AGEN-55 AC1: a braceless loop fails too, as D9's curly: all specifies", async () => {
    assert.match(await lintIn("hooks", "export function drain(items) {\n  while (items.length > 0) items.pop();\n}\n"), /curly/);
  });

  it("AGEN-55 AC1: an if with braces passes (oxfmt, not oxlint, puts the body on its own line)", async () => {
    const source = "export function first(items) {\n  if (items.length === 0) {\n    return;\n  }\n  return items[0];\n}\n";
    assert.strictEqual(await lintIn("hooks", source), "");
  });

  it("AGEN-55 AC2: npm run lint passes on the repo as it stands", async () => {
    await run("npm", ["run", "--silent", "lint"], { cwd: repoRoot });
  });
});
