// claude-log.mjs — digests Claude Code transcripts into what was worked on, per local day
//
// Node 24+. Reads every session transcript under $CLAUDE_CONFIG_DIR/projects (default: the .claude folder in the
// home directory) and prints JSON: for each local day in the range, each project directory worked in, with its
// branches, ticket keys, first and last prompt times, and the human prompts themselves. Tool results, hook output
// and other non-human turns are skipped, since they say what the agent did, not what was asked.
//
// Usage:
//   node claude-log.mjs 2026-10-18              # one day
//   node claude-log.mjs 2026-10-13 2026-10-17   # inclusive range

// System dependencies
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

/**
 * @typedef {Object} ProjectDay
 * @property {string} cwd
 * @property {Set<string>} branches
 * @property {Set<string>} tickets
 * @property {Set<string>} sessions
 * @property {string} first - Local HH:MM of the first prompt.
 * @property {string} last - Local HH:MM of the last prompt.
 * @property {string[]} prompts
 */

// Jira and Paca keys alike: PROJ-123. Branches carry them lower-case at the front: agen-54-timetracker-skill.
const ticketPattern = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const branchTicketPattern = /^([a-z][a-z0-9]+-\d+)\b/i;

// A prompt is evidence of intent, not a transcript to reread; long pastes are cut.
const promptLength = 300;

/**
 * Returns the human-typed text of a transcript entry, or null when it is not a human prompt.
 *
 * @param {any} entry - One parsed transcript line.
 * @returns {string | null} Prompt text with whitespace collapsed.
 */
function promptText(entry) {
  if (entry.type !== "user" || entry.isMeta || entry.isSidechain) return null;
  // Older transcripts carry neither field. Newer ones mark task notifications as a non-human origin, and SDK sessions
  // (claude-mem's observer, headless workers) with no origin but turnOrigin "sdk"; their prompts are not the user's.
  const kind = entry.origin?.kind ?? entry.turnOrigin;
  if (kind && kind !== "human") return null;
  const { content } = entry.message ?? {};
  // A block array holding a tool_result is the agent's own tool output coming back.
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content) && content.every((block) => block.type === "text" || block.type === "image")
        ? content.map((block) => block.text ?? "").join(" ")
        : "";
  const collapsed = text.replace(/\s+/g, " ").trim();
  // Slash-command wrappers and harness notices start with a tag; they are not typed prose.
  return collapsed && !collapsed.startsWith("<") ? collapsed : null;
}

/**
 * Lists the top-level session transcripts that may hold entries on or after a moment.
 *
 * @param {string} projectsDir - The projects folder of the Claude config dir.
 * @param {Date} since - Files last written before this cannot hold entries in range.
 * @returns {Promise<string[]>} Transcript paths.
 */
async function transcriptsSince(projectsDir, since) {
  const files = [];
  for (const project of await readdir(projectsDir, { withFileTypes: true })) {
    if (!project.isDirectory()) continue;
    const dir = path.join(projectsDir, project.name);
    // Subagent transcripts live in per-session subfolders and hold no human prompts, so only top-level files count.
    for (const file of await readdir(dir, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith(".jsonl")) continue;
      const fullPath = path.join(dir, file.name);
      if ((await stat(fullPath)).mtime >= since) files.push(fullPath);
    }
  }
  return files;
}

/**
 * Digests transcripts into per-day, per-project activity.
 *
 * @param {string} from - First local day, YYYY-MM-DD.
 * @param {string} to - Last local day, YYYY-MM-DD, inclusive.
 * @param {string} configDir - Claude config dir.
 * @returns {Promise<Map<string, Map<string, ProjectDay>>>} Day -> cwd -> activity.
 */
async function digest(from, to, configDir) {
  /** @type {Map<string, Map<string, ProjectDay>>} */
  const days = new Map();
  // A date-time string without an offset parses as local time, which is the day the user means.
  const files = await transcriptsSince(path.join(configDir, "projects"), new Date(`${from}T00:00`));

  for (const file of files) {
    for await (const raw of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
      let entry;
      try {
        entry = JSON.parse(raw);
      } catch {
        // A session still being written can end in a partial line.
        continue;
      }
      const prompt = promptText(entry);
      if (!prompt || !entry.timestamp) continue;

      const moment = new Date(entry.timestamp);
      // en-CA formats as YYYY-MM-DD, so local days compare as strings.
      const date = moment.toLocaleDateString("en-CA");
      if (date < from || date > to) continue;
      const time = moment.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

      const projects = days.get(date) ?? new Map();
      days.set(date, projects);
      const cwd = entry.cwd ?? "(unknown)";
      const project = projects.get(cwd) ?? {
        cwd,
        branches: new Set(),
        tickets: new Set(),
        sessions: new Set(),
        first: time,
        last: time,
        prompts: [],
      };
      projects.set(cwd, project);

      // A detached jj workspace reports HEAD, which names nothing.
      if (entry.gitBranch && entry.gitBranch !== "HEAD") {
        project.branches.add(entry.gitBranch);
        const branchTicket = entry.gitBranch.match(branchTicketPattern)?.[1];
        if (branchTicket) project.tickets.add(branchTicket.toUpperCase());
      }
      for (const [key] of prompt.matchAll(ticketPattern)) project.tickets.add(key);
      project.sessions.add(entry.sessionId);
      if (time < project.first) project.first = time;
      if (time > project.last) project.last = time;
      project.prompts.push(prompt.slice(0, promptLength));
    }
  }
  return days;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const [from, to = from] = process.argv.slice(2);
for (const date of [from, to]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
    console.error(`Expected dates as YYYY-MM-DD, got "${date ?? ""}". Usage: claude-log.mjs <from> [to]`);
    process.exit(1);
  }
}

const configDir = process.env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), ".claude");
const days = await digest(from, to, configDir);

const report = [...days.keys()].sort().map((date) => ({
  date,
  projects: [...days.get(date).values()].map((project) => ({
    ...project,
    branches: [...project.branches].sort(),
    tickets: [...project.tickets].sort(),
    sessions: project.sessions.size,
  })),
}));
console.log(JSON.stringify({ from, to, days: report }, null, 2));
