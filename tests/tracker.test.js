// tracker.test.js — guards the tracker skill contract and its Jira recipe (AGEN-45)
//
// The Jira recipe is skills/jira/scripts/jira.mjs, run as a real child process with fetch replaced by
// tests/helpers/mock-fetch.js. Nothing here reaches a network, so write operations are safe to exercise.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const jiraScript = path.join(repoRoot, "skills", "jira", "scripts", "jira.mjs");
const mockFetch = path.join(import.meta.dirname, "helpers", "mock-fetch.js");

const trackerDeclaration =
  "# Issue Tracker\n\nIssues are tracked in **Jira**, project key `CA`, on `https://cpc-aws.atlassian.net`.\n";

/**
 * @typedef {Object} Route
 * @property {string} method
 * @property {string} path
 * @property {unknown} [json]
 * @property {number} [status]
 * @property {boolean} [once]
 */

/**
 * Makes a throwaway repo directory, optionally holding an issue-tracker.md.
 *
 * @param {string | null} declaration - File content, or null for a repo without one.
 * @returns {string} Directory path.
 */
function makeRepo(declaration) {
  const dir = mkdtempSync(path.join(tmpdir(), "tracker-test-"));
  if (declaration !== null) {
    mkdirSync(path.join(dir, "docs", "agents"), { recursive: true });
    writeFileSync(path.join(dir, "docs", "agents", "issue-tracker.md"), declaration);
  }
  return dir;
}

/**
 * Runs jira.mjs with mocked fetch.
 *
 * @param {string[]} args - CLI arguments.
 * @param {{ routes?: Route[], cwd?: string, env?: Record<string, string> }} [options]
 * @returns {{ status: number | null, stdout: string, stderr: string, requests: { method: string, url: string, body: any }[] }}
 */
function runJira(args, { routes = [], cwd = makeRepo(null), env = {} } = {}) {
  const log = path.join(mkdtempSync(path.join(tmpdir(), "tracker-log-")), "requests.jsonl");
  writeFileSync(log, "");
  const result = spawnSync(process.execPath, ["--import", mockFetch, jiraScript, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      JIRA_BASE_URL: "https://example.atlassian.net",
      JIRA_EMAIL: "me@example.com",
      JIRA_API_TOKEN: "token",
      JIRA_FIELD_STORY: "customfield_1",
      JIRA_FIELD_AC: "customfield_2",
      MockRoutes: JSON.stringify(routes),
      MockLog: log,
      ...env,
    },
  });
  const requests = readFileSync(log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, requests };
}

/**
 * Builds an ADF doc from paragraphs of plain text.
 *
 * @param {...string} paragraphs - Paragraph texts.
 * @returns {object} ADF document.
 */
function adf(...paragraphs) {
  return {
    type: "doc",
    version: 1,
    content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  };
}

/** @param {string} key */
const searchHit = (key) => ({
  method: "POST",
  path: "/search/jql",
  json: { issues: [{ key, fields: { summary: `Summary of ${key}`, status: { name: "To Do" } } }] },
});

describe("tracker skill", () => {
  it("AC1: SKILL.md defines the five-operation contract and the Jira recipe, model-invoked", () => {
    const skill = readFileSync(path.join(repoRoot, "skills", "tracker", "SKILL.md"), "utf8");
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";

    assert.match(frontmatter, /^name: tracker$/m);
    assert.match(frontmatter, /^description: .*(Jira|tracker)/m);
    assert.doesNotMatch(frontmatter, /disable-model-invocation/);
    for (const operation of ["next", "get", "comment", "transition", "create"]) {
      assert.match(skill, new RegExp(`^\\| \`${operation}\``, "m"), `contract table lists ${operation}`);
    }
    assert.match(skill, /jira\.mjs/);
    assert.match(skill, /\$\{CLAUDE_SKILL_DIR\}/);
    assert.doesNotMatch(skill, /~\/\.claude/);
  });

  it("AC2: next queries the open sprint by Rank first, with Story, To Do and label filters", () => {
    const { stdout, requests, status } = runJira(["next", "--label", "ready-for-agent"], {
      cwd: makeRepo(trackerDeclaration),
      routes: [searchHit("CA-7")],
    });

    assert.strictEqual(status, 0);
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(
      requests[0].body.jql,
      'project = "CA" AND issuetype = Story AND statusCategory = "To Do" AND sprint in openSprints() AND labels = "ready-for-agent" ORDER BY Rank ASC'
    );
    assert.strictEqual(requests[0].body.maxResults, 1);
    assert.match(stdout, /CA-7: Summary of CA-7/);
  });

  it("AC2: next falls back to the backlog by Rank, including stories returned from a closed sprint, when the open sprint has nothing", () => {
    const { stdout, requests } = runJira(["next"], {
      cwd: makeRepo(trackerDeclaration),
      routes: [{ method: "POST", path: "/search/jql", json: { issues: [] }, once: true }, searchHit("CA-9")],
    });

    assert.strictEqual(requests.length, 2);
    assert.strictEqual(
      requests[1].body.jql,
      'project = "CA" AND issuetype = Story AND statusCategory = "To Do" AND (sprint is EMPTY OR sprint not in (openSprints(), futureSprints())) ORDER BY Rank ASC'
    );
    assert.match(stdout, /CA-9/);
    assert.match(stdout, /backlog/);
  });

  it("AC2: next reports no eligible story when both queries are empty", () => {
    const { stdout, status } = runJira(["next"], {
      cwd: makeRepo(trackerDeclaration),
      routes: [{ method: "POST", path: "/search/jql", json: { issues: [] } }],
    });

    assert.strictEqual(status, 0);
    assert.match(stdout, /No eligible story/);
  });

  it("AC3: get returns the story with its parent epic's description", () => {
    const { stdout, requests } = runJira(["get", "CA-10"], {
      routes: [
        {
          method: "GET",
          path: "/issue/CA-10",
          json: {
            key: "CA-10",
            fields: {
              summary: "Build it",
              issuetype: { name: "Story" },
              status: { name: "To Do" },
              parent: { key: "CA-1" },
              description: adf("What to build"),
            },
          },
        },
        {
          method: "GET",
          path: "/issue/CA-1?",
          json: {
            key: "CA-1",
            fields: { summary: "The epic", issuetype: { name: "Epic" }, description: adf("Decision: use fetch. Rejected: axios.") },
          },
        },
      ],
    });

    assert.match(stdout, /CA-10: Build it/);
    assert.match(stdout, /Epic: CA-1: The epic/);
    assert.match(stdout, /Decision: use fetch\. Rejected: axios\./);
    assert.doesNotMatch(stdout, /Blueprint:/);
    assert.ok(requests.some((r) => r.url.includes("/issue/CA-1?fields=")));
  });

  it("AC3: get surfaces the epic's linked blueprint file, from a link mark, a card or plain text", () => {
    const blueprint = "https://github.com/Canadian-Pork-Council/cpc.platform/blob/main/docs/epics/CA-1-feature.md";
    const descriptions = [
      {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Blueprint", marks: [{ type: "link", attrs: { href: blueprint } }] }],
          },
        ],
      },
      { type: "doc", version: 1, content: [{ type: "inlineCard", attrs: { url: blueprint } }] },
      adf(`Summary. See ${blueprint}`),
    ];

    for (const description of descriptions) {
      const { stdout } = runJira(["get", "CA-10"], {
        routes: [
          {
            method: "GET",
            path: "/issue/CA-10",
            json: { key: "CA-10", fields: { summary: "S", parent: { key: "CA-1" } } },
          },
          { method: "GET", path: "/issue/CA-1?", json: { key: "CA-1", fields: { summary: "E", description } } },
        ],
      });

      assert.match(stdout, /Blueprint: docs\/epics\/CA-1-feature\.md/);
      assert.ok(stdout.includes(blueprint), "full link is reported too");
    }
  });

  it("AC4: comment adds a comment as ADF", () => {
    const { stdout, requests } = runJira(["comment", "add", "CA-10", "Ready", "for", "review"], {
      routes: [{ method: "POST", path: "/issue/CA-10/comment", json: {} }],
    });

    assert.deepStrictEqual(requests[0].body, { body: adf("Ready for review") });
    assert.match(stdout, /Commented on CA-10/);
  });

  it("AC5: transition moves an issue by status name", () => {
    const { requests, stdout } = runJira(["update", "CA-10", "--status", "in progress"], {
      routes: [
        { method: "GET", path: "/issue/CA-10/transitions", json: { transitions: [{ id: "21", name: "In Progress" }] } },
        { method: "POST", path: "/issue/CA-10/transitions", status: 204 },
      ],
    });

    assert.deepStrictEqual(requests[1].body, { transition: { id: "21" } });
    assert.match(stdout, /Transitioned CA-10/);
  });

  it("AC6: create makes a story with project, description and acceptance criteria", () => {
    const { requests, stdout } = runJira(["create", "--summary", "New thing", "--description", "Why", "--ac", "Given a\\nThen b"], {
      cwd: makeRepo(trackerDeclaration),
      routes: [{ method: "POST", path: "/issue", json: { key: "CA-11" } }],
    });

    const { fields } = requests[0].body;
    assert.deepStrictEqual(fields.project, { key: "CA" });
    assert.deepStrictEqual(fields.issuetype, { name: "Story" });
    assert.strictEqual(fields.summary, "New thing");
    assert.strictEqual(fields.customfield_2.content[0].content.length, 2);
    assert.match(stdout, /Created CA-11/);
  });

  it("AC7: set-parent sets an issue's parent epic", () => {
    const { requests, stdout } = runJira(["set-parent", "CA-10", "CA-1"], {
      routes: [{ method: "PUT", path: "/issue/CA-10", status: 204 }],
    });

    assert.strictEqual(requests[0].method, "PUT");
    assert.deepStrictEqual(requests[0].body, { fields: { parent: { key: "CA-1" } } });
    assert.match(stdout, /CA-10 is now a child of CA-1/);
  });

  it("AC8: link creates a Blocks link with the blocker outward and the blocked issue inward", () => {
    const { requests, stdout } = runJira(["link", "CA-10", "CA-11"], {
      routes: [{ method: "POST", path: "/issueLink", status: 201 }],
    });

    assert.deepStrictEqual(requests[0].body, {
      type: { name: "Blocks" },
      outwardIssue: { key: "CA-10" },
      inwardIssue: { key: "CA-11" },
    });
    assert.match(stdout, /CA-10 blocks CA-11/);
  });

  it("AC9: backend, project and site resolve from docs/agents/issue-tracker.md, even from a subdirectory", () => {
    const repo = makeRepo(trackerDeclaration);
    const sub = path.join(repo, "src", "deep");
    mkdirSync(sub, { recursive: true });

    const { stdout, status } = runJira(["resolve"], { cwd: sub });

    assert.strictEqual(status, 0);
    const resolved = JSON.parse(stdout);
    assert.strictEqual(resolved.backend, "jira");
    assert.strictEqual(resolved.project, "CA");
    assert.strictEqual(resolved.baseUrl, "https://cpc-aws.atlassian.net");
  });

  it("AC9: the declared site and project are used for requests, and --project still wins", () => {
    const repo = makeRepo(trackerDeclaration);
    const { requests } = runJira(["next", "--project", "OTHER"], { cwd: repo, routes: [searchHit("OTHER-1")] });

    assert.ok(requests[0].url.startsWith("https://cpc-aws.atlassian.net/rest/api/3/"));
    assert.match(requests[0].body.jql, /^project = "OTHER" AND /);
  });

  it("AC9: a repo that declares another backend is refused, and a repo with no declaration resolves to null", () => {
    const paca = runJira(["next"], { cwd: makeRepo("Issues are tracked in **Paca**, project `X`.\n") });
    assert.strictEqual(paca.status, 1);
    assert.match(paca.stderr, /declares paca/);
    assert.strictEqual(paca.requests.length, 0);

    const none = runJira(["resolve"]);
    assert.deepStrictEqual(JSON.parse(none.stdout), { backend: null });
  });

  it("AC9: only the declaration sentence is read, so a migration note or another site's link cannot win", () => {
    const declaration =
      "# Issue Tracker\n\nWe migrated from **Paca**; see https://other.atlassian.net/wiki and project key `OLD`.\n\n" +
      "Issues are tracked in Jira. Project key `CA`, on https://cpc-aws.atlassian.net.\n";
    const resolved = JSON.parse(runJira(["resolve"], { cwd: makeRepo(declaration) }).stdout);

    assert.strictEqual(resolved.backend, "jira");
    assert.strictEqual(resolved.project, "CA");
    assert.strictEqual(resolved.baseUrl, "https://cpc-aws.atlassian.net");
  });

  it("AC9: a lookalike host is not taken as the declared site", () => {
    const declaration = "Issues are tracked in **Jira**, project key `CA`, on https://x.atlassian.net.evil.com.\n";
    const resolved = JSON.parse(runJira(["resolve"], { cwd: makeRepo(declaration) }).stdout);

    assert.strictEqual(resolved.baseUrl, undefined);
  });

  it("AC9: the walk stops at the repo root, so a declaration above it is ignored", () => {
    const parent = makeRepo("Issues are tracked in **Paca**.\n");
    const repo = path.join(parent, "repo");
    mkdirSync(path.join(repo, ".git"), { recursive: true });

    assert.deepStrictEqual(JSON.parse(runJira(["resolve"], { cwd: repo }).stdout), { backend: null });
  });

  it("AC9: the walk also stops at a jj repo root that has no .git", () => {
    const parent = makeRepo("Issues are tracked in **Paca**.\n");
    const repo = path.join(parent, "repo");
    mkdirSync(path.join(repo, ".jj"), { recursive: true });

    assert.deepStrictEqual(JSON.parse(runJira(["resolve"], { cwd: repo }).stdout), { backend: null });
  });

  it("AC9: another backend's repo still allows get, search, whoami and --project", () => {
    const cwd = makeRepo("Issues are tracked in **Paca**, project `X`.\n");
    const whoami = runJira(["whoami"], {
      cwd,
      routes: [{ method: "GET", path: "/myself", json: { displayName: "Me", emailAddress: "me@example.com" } }],
    });
    assert.strictEqual(whoami.status, 0);

    const next = runJira(["next", "--project", "CA"], { cwd, routes: [searchHit("CA-1")] });
    assert.strictEqual(next.status, 0);
    assert.ok(next.requests[0].url.startsWith("https://example.atlassian.net/"), "Paca repo does not set the Jira site");
  });

  it("AC3: get finds a blueprint path typed as plain text, and tolerates a link mark without attrs", () => {
    const description = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Broken link", marks: [{ type: "link" }] },
            { type: "text", text: " Full blueprint: docs/epics/CA-1-feature.md" },
          ],
        },
      ],
    };
    const { stdout, status } = runJira(["get", "CA-10"], {
      routes: [
        { method: "GET", path: "/issue/CA-10", json: { key: "CA-10", fields: { summary: "S", parent: { key: "CA-1" } } } },
        { method: "GET", path: "/issue/CA-1?", json: { key: "CA-1", fields: { summary: "E", description } } },
      ],
    });

    assert.strictEqual(status, 0);
    assert.match(stdout, /Blueprint: docs\/epics\/CA-1-feature\.md/);
    assert.doesNotMatch(stdout, /Link:/);
  });

  it("AC3: get names a subtask's parent story without fetching it as an epic", () => {
    const { stdout, requests } = runJira(["get", "CA-15"], {
      routes: [
        {
          method: "GET",
          path: "/issue/CA-15",
          json: {
            key: "CA-15",
            fields: {
              summary: "Sub",
              issuetype: { name: "Subtask", subtask: true },
              parent: { key: "CA-10", fields: { summary: "The story" } },
            },
          },
        },
      ],
    });

    assert.strictEqual(requests.length, 1);
    assert.match(stdout, /Parent: CA-10: The story/);
    assert.doesNotMatch(stdout, /Implementation Decisions/);
  });

  it("AC5: update with --status and --label transitions without failing on the next-only label", () => {
    const { status, requests } = runJira(["update", "CA-10", "--status", "Done", "--label", "ready-for-agent"], {
      routes: [
        { method: "GET", path: "/issue/CA-10/transitions", json: { transitions: [{ id: "31", name: "Done" }] } },
        { method: "POST", path: "/issue/CA-10/transitions", status: 204 },
      ],
    });

    assert.strictEqual(status, 0);
    assert.strictEqual(requests.length, 2);
  });

  it("AC2: next quotes the project key in JQL", () => {
    const { requests } = runJira(["next", "--project", "CA OR project = HR"], { routes: [searchHit("CA-1")] });

    assert.match(requests[0].body.jql, /^project = "CA OR project = HR" AND /);
  });

  it("AC9: credentials come from env vars, and missing ones fail before any request", () => {
    const { status, stderr, requests } = runJira(["next"], { env: { JIRA_API_TOKEN: "" } });

    assert.strictEqual(status, 1);
    assert.match(stderr, /Missing required env vars/);
    assert.strictEqual(requests.length, 0);
  });
});
