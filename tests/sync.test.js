// sync.test.js — behavioural tests for agents0 sync (jj fetch -> integrate -> describe -> push)
//
// jj talking to a real remote is a genuine external dependency, so the jj
// runner is injected and faked here rather than exercised for real.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

// Local dependencies
import { sync } from "../lib/sync.js";

/**
 * @typedef {((args: string[]) => Promise<{stdout: string, stderr: string}>) & {calls: string[][]}} MockRunJj
 */

/**
 * Builds a fake jj runner keyed by the joined argv string, recording every
 * call it receives so tests can assert on sequencing.
 *
 * @param {Record<string, {stdout: string, stderr: string}>} responses - Canned output per command.
 * @returns {MockRunJj} Fake runner.
 */
function makeMockRunJj(responses) {
  /** @type {string[][]} */
  const calls = [];
  /** @type {MockRunJj} */
  const runJj = async (args) => {
    calls.push(args);
    return responses[args.join(" ")] ?? { stdout: "", stderr: "" };
  };
  runJj.calls = calls;
  return runJj;
}

describe("sync", () => {
  it("fetches, integrates, describes local changes, and pushes in sequence", async () => {
    const runJj = makeMockRunJj({
      "git fetch": { stdout: "", stderr: "" },
      "rebase -d main@origin": { stdout: "Nothing to rebase\n", stderr: "" },
      "diff --stat": { stdout: "1 file changed\n", stderr: "" },
      "describe -m sync": { stdout: "", stderr: "" },
      "git push": { stdout: "", stderr: "" },
    });

    await sync({ runJj });

    assert.deepStrictEqual(
      runJj.calls.map((a) => a.join(" ")),
      ["git fetch", "rebase -d main@origin", "diff --stat", "describe -m sync", "git push"]
    );
  });

  it("surfaces a conflict during integration clearly and stops before describe/push", async () => {
    const runJj = makeMockRunJj({
      "git fetch": { stdout: "", stderr: "" },
      "rebase -d main@origin": { stdout: "New conflicts appeared in these commits:\n  qtoqysvm\n", stderr: "" },
    });

    await assert.rejects(sync({ runJj }), /conflict/i);

    assert.deepStrictEqual(
      runJj.calls.map((a) => a.join(" ")),
      ["git fetch", "rebase -d main@origin"]
    );
  });

  it("is a clean no-op when there are no local changes and nothing new remotely", async () => {
    const runJj = makeMockRunJj({
      "git fetch": { stdout: "", stderr: "" },
      "rebase -d main@origin": { stdout: "Nothing changed.\n", stderr: "" },
      "diff --stat": { stdout: "", stderr: "" },
      "git push": { stdout: "Nothing changed.\n", stderr: "" },
    });

    await sync({ runJj });

    assert.deepStrictEqual(
      runJj.calls.map((a) => a.join(" ")),
      ["git fetch", "rebase -d main@origin", "diff --stat", "git push"],
      "describe should be skipped when there is nothing to describe"
    );
  });
});
