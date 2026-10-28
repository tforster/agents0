// retro.test.js — guards the retro skill (AGEN-58)
//
// skills/retro/scripts/sprint.mjs runs as a real child process with fetch replaced by tests/helpers/mock-fetch.js and
// TZ pinned, so sprint selection, local dates and issue buckets are deterministic and nothing reaches a network.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const skill = readFileSync(path.join(repoRoot, "skills", "retro", "SKILL.md"), "utf8");
const sprintScript = path.join(repoRoot, "skills", "retro", "scripts", "sprint.mjs");
const mockFetch = path.join(import.meta.dirname, "helpers", "mock-fetch.js");

/**
 * Returns the body of one numbered `##` section of the skill.
 *
 * @param {string} title - Section title without its number.
 * @returns {string} Text up to the next `##` heading.
 */
function section(title) {
  const [, body = ""] = skill.split(new RegExp(`^## \\d+\\. ${title}$`, "m"));
  return body.split(/^## /m)[0];
}

const sprints = {
  isLast: true,
  values: [
    {
      id: 10,
      name: "Sprint 72",
      state: "closed",
      startDate: "2026-10-01T05:00:00.000Z",
      endDate: "2026-10-15T05:00:00.000Z",
      completeDate: "2026-10-15T18:00:00.000Z",
      goal: "Plan",
    },
    {
      id: 11,
      name: "Sprint 73",
      state: "closed",
      startDate: "2026-10-15T05:00:00.000Z",
      endDate: "2026-10-29T05:00:00.000Z",
      completeDate: "2026-10-28T14:30:00.000Z",
      goal: "Embed",
    },
    { id: 12, name: "Sprint 74", state: "future", startDate: "2026-10-29T05:00:00.000Z", endDate: "2026-11-12T06:00:00.000Z" },
  ],
};

const report = {
  contents: {
    completedIssues: [
      {
        key: "CA-1",
        summary: "Planned",
        typeName: "Story",
        statusName: "Done",
        currentEstimateStatistic: { statFieldValue: { value: 3 } },
      },
      { key: "CA-2", summary: "Dropped", typeName: "Task", statusName: "Will not do" },
    ],
    issuesNotCompletedInCurrentSprint: [{ key: "CA-3", summary: "Carried", typeName: "Story", statusName: "To Do" }],
    puntedIssues: [{ key: "CA-4", summary: "Removed", typeName: "Bug", statusName: "To Do" }],
    issueKeysAddedDuringSprint: { "CA-2": true, "CA-4": true },
  },
};

/**
 * Runs sprint.mjs against mocked Jira.
 *
 * @param {string[]} args - Script arguments.
 * @returns {{ status: number | null, stdout: string, stderr: string, urls: string[] }} The finished process and the URLs it fetched.
 */
function runSprint(args) {
  const log = path.join(mkdtempSync(path.join(tmpdir(), "retro-test-")), "requests.jsonl");
  writeFileSync(log, "");
  const result = spawnSync(process.execPath, ["--import", mockFetch, sprintScript, ...args], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      TZ: "America/Toronto",
      JIRA_BASE_URL: "example.atlassian.net",
      JIRA_EMAIL: "me@example.com",
      JIRA_API_TOKEN: "token",
      MockLog: log,
      MockRoutes: JSON.stringify([
        { method: "GET", path: "/rest/agile/1.0/board/1/sprint", json: sprints },
        { method: "GET", path: "/sprintreport?rapidViewId=1&sprintId=11", json: report },
      ]),
    },
  });
  const urls = readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line).url);
  return { ...result, urls };
}

describe("retro skill", () => {
  it("AGEN-58 AC1: asks for the client first, defaulting to the config's default", () => {
    assert.ok(skill.indexOf("## 1. Client") < skill.indexOf("## 2. Sprint"), "the client is not settled first");
    const client = section("Client");
    assert.match(client, /AskUserQuestion/);
    assert.match(client, /"default": "CPC"/);
    assert.match(client, /`default` first/);
  });

  it("AGEN-58 AC2: asks for the user's highlights before collecting", () => {
    assert.ok(skill.indexOf("## 3. Highlights") < skill.indexOf("## 4. Collect"), "highlights do not come before collecting");
    assert.match(section("Highlights"), /before collecting anything, ask/i);
  });

  it("AGEN-58 AC3: names the Jira sprint report, git, GitHub and Claude transcripts as sources", () => {
    const collect = section("Collect");
    for (const source of ["Jira sprint report", "Git", "GitHub", "Claude transcripts"]) {
      assert.match(collect, new RegExp(`### 4\\.\\d+\\. ${source}$`, "m"), `no ${source} source`);
    }
  });

  it("AGEN-58 AC4: the retro covers went well, didn't and what's changing, saved to the client's retro folder", () => {
    // Output is the last section and holds the retro template, whose own `##` headings section() would stop at.
    const [, output = ""] = skill.split(/^## \d+\. Output$/m);
    for (const heading of ["What Went Well", "What Didn't Go Well", "What's Changing"]) {
      assert.match(output, new RegExp(`## \\d+\\. ${heading}`), `no ${heading} section`);
    }
    assert.match(output, /Write the retro to `RETROS\//);
  });
});

describe("sprint.mjs", () => {
  it("AGEN-58 AC5: picks a sprint by number and gives its local date range", () => {
    const result = runSprint(["1", "73"]);
    assert.strictEqual(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.sprint.name, "Sprint 73");
    assert.strictEqual(output.sprint.goal, "Embed");
    // Started 01:00 local on the 15th, closed mid-morning on the 28th.
    assert.strictEqual(output.from, "2026-10-15");
    assert.strictEqual(output.to, "2026-10-28");
    assert.ok(
      result.urls.every((url) => url.startsWith("https://example.atlassian.net/")),
      "a site without a scheme is not given https"
    );
  });

  it("AGEN-58 AC5: defaults to the most recently closed sprint", () => {
    const result = runSprint(["1"]);
    assert.strictEqual(result.status, 0, result.stderr);
    assert.strictEqual(JSON.parse(result.stdout).sprint.id, 11);
  });

  it("AGEN-58 AC5: buckets issues as Jira's sprint report does and flags those added mid-sprint", () => {
    const { issues, counts } = JSON.parse(runSprint(["1", "73"]).stdout);
    const keys = (/** @type {{ key: string }[]} */ list) => list.map((issue) => issue.key);
    assert.deepStrictEqual(keys(issues.completed), ["CA-1", "CA-2"]);
    assert.deepStrictEqual(keys(issues.notCompleted), ["CA-3"]);
    assert.deepStrictEqual(keys(issues.removed), ["CA-4"]);
    assert.strictEqual(issues.completed[0].points, 3);
    assert.strictEqual(issues.completed[0].addedDuringSprint, false);
    assert.strictEqual(issues.completed[1].addedDuringSprint, true);
    assert.strictEqual(counts.addedDuringSprint, 2);
  });

  it("AGEN-58 AC5: fails on a sprint the board does not have, and on a missing board", () => {
    const unknown = runSprint(["1", "99"]);
    assert.notStrictEqual(unknown.status, 0);
    assert.match(unknown.stderr, /No sprint "99"/);
    const noBoard = runSprint([]);
    assert.notStrictEqual(noBoard.status, 0);
    assert.match(noBoard.stderr, /board id/);
  });
});
