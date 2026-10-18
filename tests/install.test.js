// install.test.js — behavioural tests for agents0 install/uninstall (symlink categories)
//
// Uses real temp directories rather than mocking fs: the behaviour under test
// is filesystem symlink manipulation, so a fake fs would test our own stub
// instead of real behaviour.
//
// All three trait categories (skills, agents, rules) use the same plain
// directory-symlink model — see prd.md §4.1.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mkdtemp, mkdir, rm, lstat, readlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Local dependencies
import { install, uninstall } from "../lib/install.js";

/**
 * Builds an isolated fixture: a fake agents0 repo root (with populated
 * install/{skills,agents,rules} content) and a fake home directory to install into.
 *
 * @returns {Promise<{root: string, toolkitRoot: string, home: string}>} Fixture paths.
 */
async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "agents0-"));
  const toolkitRoot = path.join(root, "repo");
  const home = path.join(root, "home");
  await mkdir(path.join(toolkitRoot, "install", "skills"), { recursive: true });
  await mkdir(path.join(toolkitRoot, "install", "agents"), { recursive: true });
  await mkdir(path.join(toolkitRoot, "install", "rules"), { recursive: true });
  return { root, toolkitRoot, home };
}

describe("install", () => {
  it("raises a clear error for an unknown harness", async () => {
    const { root, toolkitRoot } = await makeFixture();
    const config = { harnesses: {} };

    await assert.rejects(install("nonexistent", { config, toolkitRoot }), /unknown harness/i);

    await rm(root, { recursive: true, force: true });
  });

  it("symlinks the skills directory to the harness's configured path", async () => {
    const { root, toolkitRoot, home } = await makeFixture();
    const config = {
      harnesses: {
        testharness: {
          skills: path.join(home, ".testharness", "skills"),
        },
      },
    };

    await install("testharness", { config, toolkitRoot });

    const linkPath = path.join(home, ".testharness", "skills");
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink(), "expected a symlink");
    const target = await readlink(linkPath);
    assert.strictEqual(path.resolve(path.dirname(linkPath), target), path.join(toolkitRoot, "install", "skills"));

    await rm(root, { recursive: true, force: true });
  });

  it("symlinks the agents directory to the harness's configured path", async () => {
    const { root, toolkitRoot, home } = await makeFixture();
    const config = {
      harnesses: {
        testharness: {
          agents: path.join(home, ".testharness", "agents"),
        },
      },
    };

    await install("testharness", { config, toolkitRoot });

    const linkPath = path.join(home, ".testharness", "agents");
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink(), "expected a symlink");
    assert.strictEqual(path.resolve(path.dirname(linkPath), await readlink(linkPath)), path.join(toolkitRoot, "install", "agents"));

    await rm(root, { recursive: true, force: true });
  });

  it("symlinks the rules directory to the harness's configured path", async () => {
    const { root, toolkitRoot, home } = await makeFixture();
    const config = {
      harnesses: {
        testharness: {
          rules: path.join(home, ".testharness", "rules"),
        },
      },
    };

    await install("testharness", { config, toolkitRoot });

    const linkPath = path.join(home, ".testharness", "rules");
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink(), "expected a symlink");
    assert.strictEqual(path.resolve(path.dirname(linkPath), await readlink(linkPath)), path.join(toolkitRoot, "install", "rules"));

    await rm(root, { recursive: true, force: true });
  });

  it("skips categories that aren't configured for the harness", async () => {
    const { root, toolkitRoot, home } = await makeFixture();
    const config = {
      harnesses: {
        testharness: {
          skills: path.join(home, ".testharness", "skills"),
        },
      },
    };

    await install("testharness", { config, toolkitRoot });

    await assert.rejects(lstat(path.join(home, ".testharness", "agents")));
    await assert.rejects(lstat(path.join(home, ".testharness", "rules")));

    await rm(root, { recursive: true, force: true });
  });

  it("is a no-op when re-run on an already-installed harness", async () => {
    const { root, toolkitRoot, home } = await makeFixture();
    const config = {
      harnesses: {
        testharness: {
          skills: path.join(home, ".testharness", "skills"),
        },
      },
    };

    await install("testharness", { config, toolkitRoot });
    await install("testharness", { config, toolkitRoot });

    const linkPath = path.join(home, ".testharness", "skills");
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink(), "expected a symlink");
    assert.strictEqual(path.resolve(path.dirname(linkPath), await readlink(linkPath)), path.join(toolkitRoot, "install", "skills"));

    await rm(root, { recursive: true, force: true });
  });

  it("refuses and makes no changes when a target path is a real directory", async () => {
    const { root, toolkitRoot, home } = await makeFixture();
    const skillsTarget = path.join(home, ".testharness", "skills");
    const agentsTarget = path.join(home, ".testharness", "agents");
    await mkdir(skillsTarget, { recursive: true }); // pre-existing real directory, not a symlink

    const config = {
      harnesses: {
        testharness: {
          skills: skillsTarget,
          agents: agentsTarget,
        },
      },
    };

    await assert.rejects(install("testharness", { config, toolkitRoot }), /real file or directory/i);

    // The conflicting path is untouched, and the other category was never installed.
    const stats = await lstat(skillsTarget);
    assert.ok(!stats.isSymbolicLink(), "pre-existing real directory must be left alone");
    await assert.rejects(lstat(agentsTarget), /ENOENT/);

    await rm(root, { recursive: true, force: true });
  });
});

describe("install: all harnesses and the CLI link", () => {
  it("installs every harness when no harness is named", async () => {
    const { root, toolkitRoot, home } = await makeFixture();
    const config = {
      harnesses: {
        first: { skills: path.join(home, ".first", "skills") },
        second: { rules: path.join(home, ".second", "rules") },
      },
    };

    await install(undefined, { config, toolkitRoot });

    assert.ok((await lstat(path.join(home, ".first", "skills"))).isSymbolicLink());
    assert.ok((await lstat(path.join(home, ".second", "rules"))).isSymbolicLink());

    await rm(root, { recursive: true, force: true });
  });

  it("DEV0-66 AC1: links bin/agents0 to config.bin, creating its directory", async () => {
    const { root, toolkitRoot, home } = await makeFixture();
    const binPath = path.join(home, "bin", "agents0");
    const config = { bin: binPath, harnesses: { testharness: {} } };

    await install("testharness", { config, toolkitRoot });

    assert.ok((await lstat(binPath)).isSymbolicLink());
    assert.strictEqual(path.resolve(path.dirname(binPath), await readlink(binPath)), path.join(toolkitRoot, "bin", "agents0"));

    await rm(root, { recursive: true, force: true });
  });

  it("refuses and makes no changes when a real file sits at config.bin", async () => {
    const { root, toolkitRoot, home } = await makeFixture();
    const binPath = path.join(home, "bin", "agents0");
    const skillsTarget = path.join(home, ".testharness", "skills");
    await mkdir(path.dirname(binPath), { recursive: true });
    await writeFile(binPath, "not ours");
    const config = { bin: binPath, harnesses: { testharness: { skills: skillsTarget } } };

    await assert.rejects(install("testharness", { config, toolkitRoot }), /the agents0 CLI.*real file or directory/);

    assert.ok(!(await lstat(binPath)).isSymbolicLink(), "pre-existing file must be left alone");
    await assert.rejects(lstat(skillsTarget), /ENOENT/);

    await rm(root, { recursive: true, force: true });
  });
});

describe("uninstall", () => {
  it("removes symlinks previously created by install", async () => {
    const { root, toolkitRoot, home } = await makeFixture();
    const config = {
      harnesses: {
        testharness: {
          skills: path.join(home, ".testharness", "skills"),
          agents: path.join(home, ".testharness", "agents"),
          rules: path.join(home, ".testharness", "rules"),
        },
      },
    };

    await install("testharness", { config, toolkitRoot });
    await uninstall("testharness", { config, toolkitRoot });

    await assert.rejects(lstat(path.join(home, ".testharness", "skills")), /ENOENT/);
    await assert.rejects(lstat(path.join(home, ".testharness", "agents")), /ENOENT/);
    await assert.rejects(lstat(path.join(home, ".testharness", "rules")), /ENOENT/);

    await rm(root, { recursive: true, force: true });
  });

  it("leaves a real directory alone rather than deleting it", async () => {
    const { root, toolkitRoot, home } = await makeFixture();
    const skillsTarget = path.join(home, ".testharness", "skills");
    await mkdir(skillsTarget, { recursive: true });

    const config = {
      harnesses: {
        testharness: { skills: skillsTarget },
      },
    };

    await uninstall("testharness", { config, toolkitRoot });

    const stats = await lstat(skillsTarget);
    assert.ok(stats.isDirectory() && !stats.isSymbolicLink(), "real directory must survive uninstall");

    await rm(root, { recursive: true, force: true });
  });

  it("raises a clear error for an unknown harness", async () => {
    const { root, toolkitRoot } = await makeFixture();
    const config = { harnesses: {} };

    await assert.rejects(uninstall("nonexistent", { config, toolkitRoot }), /unknown harness/i);

    await rm(root, { recursive: true, force: true });
  });

  it("is a no-op when nothing is installed", async () => {
    const { root, toolkitRoot, home } = await makeFixture();
    const config = {
      harnesses: {
        testharness: { skills: path.join(home, ".testharness", "skills") },
      },
    };

    await uninstall("testharness", { config, toolkitRoot });

    await rm(root, { recursive: true, force: true });
  });

  it("keeps the CLI link when uninstalling one harness, removes it when uninstalling all", async () => {
    const { root, toolkitRoot, home } = await makeFixture();
    const binPath = path.join(home, "bin", "agents0");
    const config = { bin: binPath, harnesses: { testharness: { skills: path.join(home, ".testharness", "skills") } } };

    await install(undefined, { config, toolkitRoot });
    await uninstall("testharness", { config, toolkitRoot });
    assert.ok((await lstat(binPath)).isSymbolicLink());
    await assert.rejects(lstat(path.join(home, ".testharness", "skills")), /ENOENT/);

    await uninstall(undefined, { config, toolkitRoot });
    await assert.rejects(lstat(binPath), /ENOENT/);

    await rm(root, { recursive: true, force: true });
  });
});
