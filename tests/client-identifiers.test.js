// client-identifiers.test.js -- keeps client identifiers out of this public repo (AGEN-60)
//
// Examples need a Jira site, a GitHub owner and an email, and it is tempting to paste the real ones. The test
// cannot name what to keep out without publishing it, so it allows only placeholders: an Atlassian site or an
// email domain not on these lists fails, whoever it belongs to.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..");

const placeholderSites = new Set(["acme", "example", "other", "x", "your-base-url"]);
const placeholderEmailDomains = new Set(["example.com", "personal.example", "work.example", "github.com"]);

/**
 * Reads every tracked text file, skipping the lockfile, whose integrity hashes are noise to these patterns.
 *
 * @returns {Promise<{ file: string, content: string }[]>} Each tracked file and its content.
 */
async function trackedFiles() {
  const { stdout } = await run("git", ["ls-files", "-z"], { cwd: repoRoot });
  const files = stdout.split("\0").filter((file) => file && file !== "package-lock.json");
  return await Promise.all(files.map(async (file) => ({ file, content: await readFile(path.join(repoRoot, file), "utf8") })));
}

describe("client identifiers", () => {
  it("AGEN-60 AC6: every Atlassian site and email domain in the repo is a placeholder", async () => {
    const found = [];
    for (const { file, content } of await trackedFiles()) {
      // A site name preceded by `*` or `-` is already masked, as in `***-aws.atlassian.net`.
      for (const [, site] of content.matchAll(/(?<![\w*-])([a-z0-9][a-z0-9-]*)\.atlassian\.net/g)) {
        if (!placeholderSites.has(site)) {
          found.push(`${file}: ${site}.atlassian.net`);
        }
      }
      for (const [, domain] of content.matchAll(/[\w.%+-]+@([\w-]+(?:\.[\w-]+)*\.[a-z]{2,})/g)) {
        if (!placeholderEmailDomains.has(domain)) {
          found.push(`${file}: @${domain}`);
        }
      }
    }
    assert.deepStrictEqual(found, [], "replace these with placeholders");
  });
});
