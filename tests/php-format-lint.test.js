// php-format-lint.test.js -- guards the PHP format and lint PostToolUse hook (AGEN-24)
//
// Seams: readProductionPhp(repoRoot), and hooks/php-format-lint.js run as a real child process with the
// Claude Code event on stdin. Docker and php-cs-fixer are stubs first on PATH, so the suite needs neither.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

// Local dependencies
import { readProductionPhp } from "../hooks/php-format-lint.js";

const run = promisify(execFile);
const hookPath = path.resolve(import.meta.dirname, "..", "hooks", "php-format-lint.js");

/**
 * Makes a throwaway directory.
 *
 * @returns {Promise<string>} Absolute path of the new directory.
 */
const makeTempDir = () => mkdtemp(path.join(tmpdir(), "agents0-php-"));

/**
 * Writes an executable shell stub that appends its arguments to a log, then prints and exits as told by
 * the StubOutput and StubExit variables.
 *
 * @param {string} binDirectory - Directory placed first on PATH.
 * @param {string} name - Command to impersonate.
 * @returns {Promise<void>}
 */
async function writeStub(binDirectory, name) {
  const stubPath = path.join(binDirectory, name);
  await writeFile(stubPath, `#!/bin/sh\necho "$@" >> "$StubLog.${name}"\nprintf '%s' "$StubOutput"\nexit "\${StubExit:-0}"\n`);
  await chmod(stubPath, 0o755);
}

/**
 * Builds a git repo holding one PHP file and stubs for docker and php-cs-fixer, then runs the hook on it.
 *
 * @param {{ composer?: object, fixerConfigs?: string[], file?: string, tool?: string, env?: Record<string, string>, withStubs?: string[] }} [options]
 * @returns {Promise<{ root: string, log: (name: string) => Promise<string>, stdout: string, output: any }>} Hook result.
 */
async function runHook({
  composer,
  fixerConfigs = [],
  file = "src/Page.php",
  tool = "Edit",
  env = {},
  withStubs = ["docker", "php-cs-fixer"],
} = {}) {
  const root = await makeTempDir();
  await run("git", ["init", "-q"], { cwd: root });
  if (composer) await writeFile(path.join(root, "composer.json"), JSON.stringify(composer));
  for (const name of fixerConfigs) await writeFile(path.join(root, name), "<?php return new PhpCsFixer\\Config();");
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), "<?php echo 1;");

  const binDirectory = await makeTempDir();
  for (const name of withStubs) await writeStub(binDirectory, name);
  // PATH holds only the stubs plus node and git, so a real docker or php-cs-fixer on the machine is never reached
  // and a "missing binary" case is genuinely missing.
  for (const tool of [process.execPath, await which("git")]) await symlink(tool, path.join(binDirectory, path.basename(tool)));
  const stubbedPath = binDirectory;
  const stubLog = path.join(root, ".stub-log");

  const event = { hook_event_name: "PostToolUse", tool_name: tool, cwd: root, tool_input: { file_path: path.join(root, file) } };
  const child = run("node", [hookPath], { cwd: root, env: { ...process.env, PATH: stubbedPath, StubLog: stubLog, ...env } });
  child.child.stdin?.end(JSON.stringify(event));
  const { stdout } = await child;
  return {
    root,
    stdout,
    output: stdout ? JSON.parse(stdout) : undefined,
    log: (name) => readFile(`${stubLog}.${name}`, "utf8").catch(() => ""),
  };
}

/**
 * Finds an executable on the real PATH.
 *
 * @param {string} name - Command name.
 * @returns {Promise<string>} Absolute path.
 */
const which = async (name) => (await run("sh", ["-c", `command -v ${name}`])).stdout.trim();

const production74 = { config: { platform: { php: "7.4.33" } } };

describe("PHP format and lint hook", () => {
  it("AGEN-24 AC1: the production PHP version is composer.json config.platform.php, reduced to major.minor", async () => {
    const root = await makeTempDir();
    await writeFile(path.join(root, "composer.json"), JSON.stringify({ config: { platform: { php: "7.4.33" } } }));
    assert.strictEqual(await readProductionPhp(root), "7.4");
  });

  it("AGEN-24 AC2: no composer.json, or no config.platform.php, means no declared version", async () => {
    const bare = await makeTempDir();
    assert.strictEqual(await readProductionPhp(bare), undefined);

    const undeclared = await makeTempDir();
    await writeFile(path.join(undeclared, "composer.json"), JSON.stringify({ require: { php: "^7.4" } }));
    assert.strictEqual(await readProductionPhp(undeclared), undefined);
  });

  it("AGEN-24 AC3: syntax valid locally but invalid on production PHP is fed back as a block decision naming the version", async () => {
    const parseError = 'PHP Parse error: syntax error, unexpected token "|" in src/Page.php on line 3';
    const { output } = await runHook({ composer: production74, env: { StubExit: "255", StubOutput: parseError } });
    assert.strictEqual(output.decision, "block");
    assert.match(output.reason, /php 7\.4/);
    assert.match(output.reason, /src\/Page\.php/);
    assert.match(output.reason, /unexpected token/);
  });

  it("AGEN-24 AC4: php -l runs in the php:<major.minor>-cli image on the changed file, with the repo mounted read-only", async () => {
    const { root, log } = await runHook({ composer: production74 });
    const realRoot = await realpath(root);
    assert.strictEqual((await log("docker")).trim(), `run --rm -v ${realRoot}:/app:ro -w /app php:7.4-cli php -l src/Page.php`);
  });

  it("AGEN-24 AC5: clean PHP produces no output", async () => {
    const { stdout } = await runHook({ composer: production74 });
    assert.strictEqual(stdout, "");
  });

  it("AGEN-24 AC6: no declared production version skips php -l silently", async () => {
    for (const composer of [undefined, { require: { php: "^7.4" } }]) {
      const { stdout, log } = await runHook({ composer, env: { StubExit: "255", StubOutput: "Parse error" } });
      assert.strictEqual(stdout, "");
      assert.strictEqual(await log("docker"), "");
    }
  });

  it("AGEN-24 AC7: docker unavailable skips php -l and feeds back one line, without blocking", async () => {
    // docker exits 125 when the daemon is down or the image cannot be pulled; a missing binary is the same case.
    for (const options of [{ env: { StubExit: "125" } }, { withStubs: ["php-cs-fixer"] }]) {
      const { output } = await runHook({ composer: production74, ...options });
      assert.deepStrictEqual(output, {
        hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "php -l skipped: docker unavailable" },
      });
    }
  });

  it("AGEN-24 AC8: php-cs-fixer runs on the changed file with the repo's .php-cs-fixer.php or .dist.php config", async () => {
    for (const fixerConfig of [".php-cs-fixer.php", ".php-cs-fixer.dist.php"]) {
      const { root, log } = await runHook({ fixerConfigs: [fixerConfig] });
      assert.strictEqual(
        (await log("php-cs-fixer")).trim(),
        `fix --config=${path.join(await realpath(root), fixerConfig)} --quiet src/Page.php`
      );
    }
  });

  it("AGEN-24 AC8: the root .php-cs-fixer.php wins over .dist.php, as php-cs-fixer itself prefers it", async () => {
    const { log } = await runHook({ fixerConfigs: [".php-cs-fixer.dist.php", ".php-cs-fixer.php"] });
    assert.match(await log("php-cs-fixer"), /\.php-cs-fixer\.php /);
  });

  it("AGEN-24 AC9: without a php-cs-fixer config, or without the binary, the fixer is skipped silently", async () => {
    const withoutConfig = await runHook({ composer: production74 });
    assert.strictEqual(await withoutConfig.log("php-cs-fixer"), "");

    const withoutBinary = await runHook({ composer: production74, fixerConfigs: [".php-cs-fixer.php"], withStubs: ["docker"] });
    assert.strictEqual(withoutBinary.stdout, "");
  });

  it("AGEN-24 AC10: a php-cs-fixer failure is fed back as a block decision", async () => {
    const { output } = await runHook({ fixerConfigs: [".php-cs-fixer.php"], env: { StubExit: "1", StubOutput: "bad config" } });
    assert.strictEqual(output.decision, "block");
    assert.match(output.reason, /php-cs-fixer/);
    assert.match(output.reason, /bad config/);
  });

  it("AGEN-24 AC11: only .php files outside vendor/ are checked", async () => {
    for (const file of ["README.md", "vendor/acme/lib/Thing.php", "src/vendor/Thing.php"]) {
      const { stdout, log } = await runHook({ composer: production74, fixerConfigs: [".php-cs-fixer.php"], file });
      assert.strictEqual(stdout, "");
      assert.strictEqual(await log("docker"), "");
      assert.strictEqual(await log("php-cs-fixer"), "");
    }
  });

  it("AGEN-24 AC12: hooks.json runs the hook after Edit and Write, with a 120 second timeout for an image pull", async () => {
    const { hooks } = JSON.parse(await readFile(path.resolve(import.meta.dirname, "..", "hooks", "hooks.json"), "utf8"));
    assert.deepStrictEqual(
      hooks.PostToolUse.filter((/** @type {{ hooks: { args?: string[] }[] }} */ group) =>
        group.hooks.some((hook) => hook.args?.[0]?.endsWith("php-format-lint.js"))
      ),
      [
        {
          matcher: "Edit|Write",
          hooks: [{ type: "command", command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/hooks/php-format-lint.js"], timeout: 120 }],
        },
      ]
    );
  });
});
