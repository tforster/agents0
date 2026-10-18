// cli.test.js — end-to-end tests for bin/agents0 as an actual executable,
// including invocation via a symlink (as it will be from ~/bin in real use).

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, readFile, cp, chmod, symlink, lstat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Builds a standalone copy of the CLI (bin + lib, no node_modules)
 * plus a fake agents0.json and install/{skills,agents,rules}, isolated
 * from the real repo.
 *
 * @returns {Promise<{root: string, cliPath: string, home: string}>} Fixture paths.
 */
async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "agents0-cli-"));
  await cp(path.join(repoRoot, "lib"), path.join(root, "lib"), { recursive: true });
  await mkdir(path.join(root, "bin"), { recursive: true });
  await cp(path.join(repoRoot, "bin", "agents0"), path.join(root, "bin", "agents0"));
  await chmod(path.join(root, "bin", "agents0"), 0o755);

  await mkdir(path.join(root, "install", "skills"), { recursive: true });
  await mkdir(path.join(root, "install", "agents"), { recursive: true });
  await mkdir(path.join(root, "install", "rules"), { recursive: true });

  const home = path.join(root, "home");
  await writeFile(
    path.join(root, "agents0.json"),
    JSON.stringify({
      bin: path.join(home, "bin", "agents0"),
      harnesses: {
        testharness: {
          skills: path.join(home, ".testharness", "skills"),
          agents: path.join(home, ".testharness", "agents"),
          rules: path.join(home, ".testharness", "rules"),
        },
      },
    })
  );

  return { root, cliPath: path.join(root, "bin", "agents0"), home };
}

describe("DEV0-66 AC1: bin/agents0", () => {
  it("installs a harness end-to-end when run directly", async () => {
    const { root, cliPath, home } = await makeFixture();

    const { stdout } = await run(process.execPath, [cliPath, "install", "testharness"]);
    assert.match(stdout, /Installed testharness/);

    for (const category of ["skills", "agents", "rules"]) {
      const stats = await lstat(path.join(home, ".testharness", category));
      assert.ok(stats.isSymbolicLink(), `expected ${category} to be a symlink`);
    }

    await rm(root, { recursive: true, force: true });
  });

  it("works when invoked via a symlink, as it will be from ~/bin", async () => {
    const { root, cliPath, home } = await makeFixture();
    const symlinkedCli = path.join(root, "agents0-symlink");
    await symlink(cliPath, symlinkedCli);

    const { stdout } = await run(process.execPath, [symlinkedCli, "install", "testharness"]);
    assert.match(stdout, /Installed testharness/);

    const linkPath = path.join(home, ".testharness", "skills");
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());

    await rm(root, { recursive: true, force: true });
  });

  it("uninstalls a harness end-to-end", async () => {
    const { root, cliPath, home } = await makeFixture();

    await run(process.execPath, [cliPath, "install", "testharness"]);
    const { stdout } = await run(process.execPath, [cliPath, "uninstall", "testharness"]);
    assert.match(stdout, /Uninstalled testharness/);

    for (const category of ["skills", "agents", "rules"]) {
      await assert.rejects(lstat(path.join(home, ".testharness", category)), /ENOENT/);
    }

    await rm(root, { recursive: true, force: true });
  });

  it("exits non-zero with a usage message when given no arguments", async () => {
    const { root, cliPath } = await makeFixture();

    await assert.rejects(run(process.execPath, [cliPath]), /Usage: agents0/);

    await rm(root, { recursive: true, force: true });
  });

  it("reports status for every harness", async () => {
    const { root, cliPath } = await makeFixture();

    const { stdout } = await run(process.execPath, [cliPath, "status"]);
    assert.match(stdout, /testharness/);
    assert.match(stdout, /skills: missing/);
    assert.match(stdout, /agents: missing/);
    assert.match(stdout, /rules: missing/);

    await rm(root, { recursive: true, force: true });
  });

  it("scaffolds a new skill", async () => {
    const { root, cliPath } = await makeFixture();

    const { stdout } = await run(process.execPath, [cliPath, "new", "skill", "my-skill"]);
    assert.match(stdout, /Created install\/skills\/my-skill\/SKILL\.md/);

    const content = await readFile(path.join(root, "install", "skills", "my-skill", "SKILL.md"), "utf8");
    assert.match(content, /name: my-skill/);

    await rm(root, { recursive: true, force: true });
  });

  it("with no harness, installs every harness and links the CLI, which then runs through that link", async () => {
    const { root, cliPath, home } = await makeFixture();

    const { stdout } = await run(process.execPath, [cliPath, "install"], { env: { ...process.env, PATH: "/usr/bin" } });
    assert.match(stdout, /Installed all harnesses/);
    assert.match(stdout, /is not on PATH yet/);

    const linkedCli = path.join(home, "bin", "agents0");
    assert.ok((await lstat(linkedCli)).isSymbolicLink());
    assert.ok((await lstat(path.join(home, ".testharness", "skills"))).isSymbolicLink());

    const { stdout: statusOut } = await run(process.execPath, [linkedCli, "status"]);
    assert.match(statusOut, /skills: correct/);

    await rm(root, { recursive: true, force: true });
  });

  it("stays quiet about PATH when the CLI's directory is already on it", async () => {
    const { root, cliPath, home } = await makeFixture();

    const env = { ...process.env, PATH: `${path.join(home, "bin")}${path.delimiter}/usr/bin` };
    const { stdout } = await run(process.execPath, [cliPath, "install"], { env });
    assert.doesNotMatch(stdout, /not on PATH/);

    await rm(root, { recursive: true, force: true });
  });

  it("uninstalling one harness keeps the CLI link; uninstalling everything removes it", async () => {
    const { root, cliPath, home } = await makeFixture();
    const linkedCli = path.join(home, "bin", "agents0");

    await run(process.execPath, [cliPath, "install"]);
    await run(process.execPath, [cliPath, "uninstall", "testharness"]);
    assert.ok((await lstat(linkedCli)).isSymbolicLink());

    const { stdout } = await run(process.execPath, [cliPath, "uninstall"]);
    assert.match(stdout, /Uninstalled all harnesses/);
    await assert.rejects(lstat(linkedCli), /ENOENT/);

    await rm(root, { recursive: true, force: true });
  });

  it("refuses to run on a Node older than the minimum, with a clear message", async () => {
    const { root, cliPath, home } = await makeFixture();
    const fakeOldNode = 'data:text/javascript,Object.defineProperty(process.versions,"node",{value:"18.0.0"})';

    await assert.rejects(
      run(process.execPath, ["--import", fakeOldNode, cliPath, "install"]),
      /needs Node 24 or later; this is Node 18\.0\.0/
    );
    await assert.rejects(lstat(path.join(home, "bin", "agents0")), /ENOENT/);

    await rm(root, { recursive: true, force: true });
  });
});
