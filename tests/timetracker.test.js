// timetracker.test.js — guards the timetracker skill (AGEN-54)
//
// skills/timetracker/scripts/claude-log.mjs runs as a real child process against a throwaway CLAUDE_CONFIG_DIR holding
// fabricated transcripts, with TZ pinned so local-day bucketing is deterministic.

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

  it("AGEN-54 AC2: each entry is date, ticket and title, and at most 5 bullets, as separate copyable fields", () => {
    const [, output = ""] = skill.split(/^## \d+\. Output$/m);
    for (const field of ["Date", "Ticket and title", "Bullets"]) {
      assert.match(output, new RegExp(`\\*\\*${field}\\*\\*`), `the output has no ${field} field`);
    }
    assert.match(output, /at most 5 bullets/i);
    assert.match(output, /own fenced block/i, "fields are not separately copyable");
  });

  it("AGEN-54 AC3: names Jira, Paca, GitHub and Claude transcripts as sources", () => {
    const [, collect = ""] = skill.split(/^## 2\. Collect$/m);
    for (const source of ["Jira", "Paca", "GitHub", "Claude transcripts"]) {
      assert.match(collect, new RegExp(`### 2\\.\\d+\\. ${source}`), `no ${source} source`);
    }
  });
});

describe("claude-log.mjs", () => {
  it("AGEN-54 AC4: groups prompts, branches and ticket keys by local day within the range", () => {
    const result = run(
      [
        // 02:00Z is 22:00 the previous day in Toronto, so it belongs to the 18th.
        line("2026-10-19T02:00:00.000Z", "Start CA-1489 grilling", { gitBranch: "agen-54-timetracker-skill" }),
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
    assert.deepStrictEqual(project.tickets, ["AGEN-53", "AGEN-54", "CA-1489"]);
    assert.deepStrictEqual(project.prompts, ["Start CA-1489 grilling", "and check AGEN-53"]);
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
