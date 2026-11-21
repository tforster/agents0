// timetracker.test.js — guards the timetracker skill (AGEN-54)
//
// skills/timetracker/scripts/claude-log.mjs runs as a real child process against a throwaway CLAUDE_CONFIG_DIR holding
// fabricated transcripts, and flow.mjs against a throwaway events file, both with TZ pinned so local-day bucketing is
// deterministic.

// System dependencies
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const skillFile = path.join(repoRoot, "skills", "timetracker", "SKILL.md");
const logScript = path.join(repoRoot, "skills", "timetracker", "scripts", "claude-log.mjs");
const flowScript = path.join(repoRoot, "skills", "timetracker", "scripts", "flow.mjs");

/**
 * Builds one transcript line as Claude Code writes it.
 *
 * @param {string} timestamp - ISO timestamp, UTC.
 * @param {unknown} content - The message content: a prompt string or an array of blocks.
 * @param {Record<string, unknown>} [extra] - Fields to add or override.
 * @returns {string} JSON line.
 */
function line(timestamp, content, extra = {}) {
  return JSON.stringify({
    type: "user",
    message: { role: "user", content },
    timestamp,
    cwd: "/home/me/dev/agents0",
    sessionId: "s1",
    gitBranch: "HEAD",
    origin: { kind: "human" },
    ...extra,
  });
}

/**
 * Writes transcripts into a throwaway config dir and runs the script over a range.
 *
 * @param {string[]} lines - Transcript lines for one session file.
 * @param {string[]} args - Script arguments.
 * @returns {import("node:child_process").SpawnSyncReturns<string>} The finished process.
 */
function run(lines, args) {
  const configDir = mkdtempSync(path.join(tmpdir(), "timetracker-test-"));
  const projectDir = path.join(configDir, "projects", "-home-me-dev-agents0");
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(path.join(projectDir, "s1.jsonl"), `${lines.join("\n")}\n`);
  return spawnSync("node", [logScript, ...args], {
    encoding: "utf8",
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, TZ: "America/Toronto" },
  });
}

describe("timetracker skill", () => {
  const skill = readFileSync(skillFile, "utf8");

  it("AGEN-54 AC1: asks for a timeframe when the request names none, before collecting", () => {
    const [, ask = ""] = skill.split(/^## 1\. Timeframe$/m);
    assert.match(ask, /ask/i, "the Timeframe step does not ask for one");
    assert.ok(skill.indexOf("## 1. Timeframe") < skill.indexOf("## 2. Collect"), "the timeframe is not settled before collecting");
  });

  it("AGEN-54 AC2: each entry is client, service, ticket, description, duration and date, one field per line", () => {
    const [, output = ""] = skill.split(/^## \d+\. Output$/m);
    const fields = ["Client/Project", "Service", "Ticket", "Description", "Duration", "Date"];
    const positions = fields.map((field) => output.search(new RegExp(`^${field}:`, "m")));
    assert.ok(!positions.includes(-1), `the example lacks a field: ${fields.filter((_, i) => positions[i] === -1)}`);
    assert.deepStrictEqual([...positions].sort((a, b) => a - b), positions, "fields are out of the tracker's order");
    assert.match(output, /one field per line/i);
  });

  it("offers only the tracker's service categories", () => {
    for (const service of ["dev", "documentation", "debugging", "design", "devops", "general admin", "education"]) {
      assert.match(skill, new RegExp(`\`${service}\``), `no ${service} service`);
    }
  });

  it("searches Jira with currentUser() in plain fields, as the jira skill does, not updatedBy()", () => {
    const [, jira = ""] = skill.split(/^### 2\.3\. Jira$/m);
    const [commands = ""] = jira.split(/^### /m);
    assert.doesNotMatch(commands, /J search '[^']*updatedBy\(/, "updatedBy(currentUser()) is rejected by Jira");
    assert.match(commands, /assignee = currentUser\(\)/);
  });

  it("AGEN-54 AC3: names Jira, Paca, GitHub, Claude transcripts, Outlook and Teams as sources", () => {
    const [, collect = ""] = skill.split(/^## 2\. Collect$/m);
    for (const source of ["Jira", "Paca", "GitHub", "Claude transcripts", "Outlook and Teams"]) {
      assert.match(collect, new RegExp(`### 2\\.\\d+\\. ${source}`), `no ${source} source`);
    }
  });

  it("reports a per-day flow summary of meetings, chats and focus time", () => {
    const [, output = ""] = skill.split(/^## \d+\. Output$/m);
    assert.match(output, /\*\*Flow\*\*/, "the output has no Flow summary");
    assert.match(skill, /flow\.mjs/, "the skill does not run flow.mjs");
  });
});

describe("claude-log.mjs", () => {
  it("AGEN-54 AC4: groups prompts, branches and ticket keys by local day within the range", () => {
    const result = run(
      [
        // 02:00Z is 22:00 the previous day in Toronto, so it belongs to the 18th.
        line("2026-10-19T02:00:00.000Z", "Start ABC-1489 grilling", { gitBranch: "agen-54-timetracker-skill" }),
        line("2026-10-19T03:30:00.000Z", [{ type: "text", text: "and   check\nAGEN-53" }]),
        line("2026-10-19T14:00:00.000Z", "next day work"),
      ],
      ["2026-10-18", "2026-10-19"]
    );
    assert.strictEqual(result.status, 0, result.stderr);
    const { days } = JSON.parse(result.stdout);

    assert.deepStrictEqual(
      days.map((/** @type {{ date: string }} */ day) => day.date),
      ["2026-10-18", "2026-10-19"]
    );
    const [project] = days[0].projects;
    assert.strictEqual(project.cwd, "/home/me/dev/agents0");
    assert.deepStrictEqual(project.branches, ["agen-54-timetracker-skill"]);
    assert.deepStrictEqual(project.tickets, ["ABC-1489", "AGEN-53", "AGEN-54"]);
    assert.deepStrictEqual(project.prompts, ["Start ABC-1489 grilling", "and check AGEN-53"]);
    assert.strictEqual(project.first, "22:00");
    assert.strictEqual(project.last, "23:30");
  });

  it("AGEN-54 AC4: ignores tool results, non-human turns and entries outside the range", () => {
    const result = run(
      [
        line("2026-10-17T15:00:00.000Z", "too early"),
        line("2026-10-18T15:00:00.000Z", [{ type: "tool_result", tool_use_id: "t1", content: "PROJ-1 output" }]),
        line("2026-10-18T15:01:00.000Z", "<task-notification>done</task-notification>", { origin: { kind: "task" } }),
        // An SDK session (claude-mem's observer, a headless worker) carries no origin, only turnOrigin.
        line("2026-10-18T15:01:30.000Z", "observe PROJ-2", { origin: undefined, turnOrigin: "sdk" }),
        line("2026-10-18T15:02:00.000Z", "kept"),
        line("2026-10-20T15:00:00.000Z", "too late"),
      ],
      ["2026-10-18"]
    );
    assert.strictEqual(result.status, 0, result.stderr);
    const { days } = JSON.parse(result.stdout);
    assert.strictEqual(days.length, 1);
    assert.deepStrictEqual(days[0].projects[0].prompts, ["kept"]);
    assert.deepStrictEqual(days[0].projects[0].tickets, []);
  });

  it("AGEN-54 AC4: rejects a date that is not YYYY-MM-DD", () => {
    const result = run([], ["yesterday"]);
    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /YYYY-MM-DD/);
  });
});

/**
 * Writes an events file and runs flow.mjs over it.
 *
 * @param {unknown} events - The input document.
 * @returns {import("node:child_process").SpawnSyncReturns<string>} The finished process.
 */
function flow(events) {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "timetracker-flow-")), "events.json");
  writeFileSync(file, JSON.stringify(events));
  return spawnSync("node", [flowScript, file], { encoding: "utf8", env: { ...process.env, TZ: "America/Toronto" } });
}

describe("flow.mjs", () => {
  it("counts meetings and answered chats as interruptions and leaves focus time between them", () => {
    const result = flow({
      // Toronto is UTC-4 in October: 13:00Z is 09:00 local.
      meetings: [{ start: "2026-10-14T15:50:00Z", end: "2026-10-14T16:30:00Z", title: "Hiring brief" }],
      messages: [
        { at: "2026-10-14T14:40:00Z", chat: "c1", fromMe: false },
        { at: "2026-10-14T14:41:00Z", chat: "c1", fromMe: true },
        // Unanswered, so possibly never read: not an interruption.
        { at: "2026-10-14T19:00:00Z", chat: "c2", fromMe: false },
      ],
    });
    assert.strictEqual(result.status, 0, result.stderr);
    const [day] = JSON.parse(result.stdout).days;

    // Busy 10:40-11:00 (chat, minimum 5, plus 15 recovery) and 11:50-12:45 (meeting plus recovery).
    assert.deepStrictEqual(day, {
      date: "2026-10-14",
      meetings: { count: 1, minutes: 40 },
      chats: { episodes: 1, sent: 1, minutes: 5 },
      interruptions: 2,
      managementMinutes: 45,
      awayMinutes: 0,
      focusMinutes: 355,
      focusBlocks: 2,
      longestFocusMinutes: 255,
      fragmentedMinutes: 50,
    });
  });

  it("keeps dev meetings out of management time and away time out of focus time", () => {
    const result = flow({
      meetings: [{ start: "2026-10-15T13:00:00Z", end: "2026-10-15T14:00:00Z", title: "Sprint planning", dev: true }],
      away: [{ start: "2026-10-15T14:00:00Z", end: "2026-10-15T16:20:00Z", title: "Dentist" }],
    });
    assert.strictEqual(result.status, 0, result.stderr);
    const [day] = JSON.parse(result.stdout).days;
    assert.strictEqual(day.managementMinutes, 0);
    assert.strictEqual(day.awayMinutes, 140);
    assert.strictEqual(day.focusMinutes, 280);
    assert.strictEqual(day.interruptions, 1);
  });

  it("rejects a timestamp with no zone", () => {
    const result = flow({ meetings: [{ start: "2026-10-14T16:00:00.0000000", end: "2026-10-14T16:30:00Z" }] });
    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /no zone/);
  });
});
