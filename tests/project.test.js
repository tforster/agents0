// project.test.js -- guards the shared project-finding helpers in hooks/lib/project.js (AGEN-60)
//
// Seam: findProject and gitRoot, imported directly, against throwaway directory trees.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

// Local dependencies
import { findProject, gitRoot } from "../hooks/lib/project.js";

const run = promisify(execFile);

/**
 * Makes a throwaway directory, optionally a git repo, with a nested workspace directory inside it.
 *
 * @param {boolean} isGitRepo - Whether to git init the root.
 * @returns {Promise<{ root: string, workspace: string }>} The root and `packages/app/src` inside it.
 */
async function makeTree(isGitRepo) {
  // realpath, because git reports the resolved path and tmpdir may be a symlink.
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "agents0-project-")));
  if (isGitRepo) {
    await run("git", ["init", "-q"], { cwd: root });
  }
  const workspace = path.join(root, "packages", "app", "src");
  await mkdir(workspace, { recursive: true });
  return { root, workspace };
}

describe("findProject", () => {
  it("AGEN-60 AC3: prefers the git root over a nearer directory with the marker, as a workspace monorepo needs", async () => {
    const { root, workspace } = await makeTree(true);
    await writeFile(path.join(root, "package.json"), "{}");
    await writeFile(path.join(root, "packages", "app", "package.json"), "{}");
    assert.strictEqual(await findProject(workspace, "package.json"), root);
  });

  it("AGEN-60 AC3: falls back to the nearest directory with the marker when the git root lacks it", async () => {
    const { root, workspace } = await makeTree(true);
    await writeFile(path.join(root, "packages", "app", "package.json"), "{}");
    assert.strictEqual(await findProject(workspace, "package.json"), path.join(root, "packages", "app"));
  });

  it("AGEN-60 AC3: finds the nearest directory with the marker outside git", async () => {
    const { root, workspace } = await makeTree(false);
    await writeFile(path.join(root, "packages", "app", "package.json"), "{}");
    assert.strictEqual(await findProject(workspace, "package.json"), path.join(root, "packages", "app"));
  });

  it("AGEN-60 AC4: accepts a nested marker such as a tool in node_modules/.bin", async () => {
    const { root, workspace } = await makeTree(true);
    await mkdir(path.join(root, "node_modules", ".bin"), { recursive: true });
    await writeFile(path.join(root, "node_modules", ".bin", "oxfmt"), "");
    assert.strictEqual(await findProject(workspace, path.join("node_modules", ".bin", "oxfmt")), root);
  });

  it("AGEN-60 AC4: returns undefined when no directory holds the marker", async () => {
    const { workspace } = await makeTree(true);
    assert.strictEqual(await findProject(workspace, `no-such-marker-${process.pid}`), undefined);
  });
});

describe("gitRoot", () => {
  it("AGEN-60 AC4: returns the working tree root from a nested directory", async () => {
    const { root, workspace } = await makeTree(true);
    assert.strictEqual(await gitRoot(workspace), root);
  });

  it("AGEN-60 AC4: returns undefined outside git", async () => {
    const { workspace } = await makeTree(false);
    assert.strictEqual(await gitRoot(workspace), undefined);
  });
});

describe("shared project module", () => {
  it("AGEN-60 AC4: every hook that resolves a project imports it instead of keeping its own copy", async () => {
    const hooksDirectory = path.resolve(import.meta.dirname, "..", "hooks");
    for (const hook of ["completion-gate.js", "format-lint-oxc.js", "format-lint-php.js"]) {
      const source = await readFile(path.join(hooksDirectory, hook), "utf8");
      assert.match(source, /from "\.\/lib\/project\.js"/, `${hook} does not import lib/project.js`);
      assert.doesNotMatch(
        source,
        /rev-parse", "--show-toplevel"|function (findProject|gitRoot|exists)\(/,
        `${hook} keeps its own copy`
      );
    }
  });
});
