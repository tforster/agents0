#!/usr/bin/env node
/**
 * Jira CLI — create, read, update and search Jira Cloud issues.
 *
 * Prerequisites: set env vars JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN.
 * Set JIRA_PROJECT for a default project key, or pass --project on every call.
 * For User Story / Acceptance Criteria fields also set JIRA_FIELD_STORY and JIRA_FIELD_AC.
 * Run `node discover-fields.mjs` to find the correct customfield_XXXXX IDs.
 *
 * Commands:
 *   whoami                               verify credentials
 *   get    <issue-key>                   fetch a single issue
 *   create [options]                     create a new issue
 *   update <issue-key> [options]         update fields and/or transition status
 *   search "<jql>" [--max <n>]           run a JQL search (default: 20 results)
 *   comment add  <issue-key> <text>      add a comment
 *   comment list <issue-key>             list comments
 *
 * Options for create / update:
 *   --project     <key>   project key (or set JIRA_PROJECT)
 *   --type        <name>  issue type  (default: Story)
 *   --summary     <text>  issue summary
 *   --description <text>  description field (plain text; \n becomes a new paragraph)
 *   --story       <text>  User Story custom field
 *   --ac          <text>  Acceptance Criteria custom field
 *   --parent      <key>   parent issue key (required when --type Subtask)
 *   --assignee    <email> assignee email address, or "me" for the authenticated user
 *   --status      <name>  transition to this status name (update only)
 */

import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

// ── Environment ───────────────────────────────────────────────────────────────

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT, JIRA_FIELD_STORY, JIRA_FIELD_AC } = process.env;

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error("Missing required env vars: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN");
  console.error("See: https://id.atlassian.com/manage-api-tokens");
  process.exit(1);
}

const AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
const BASE = `${JIRA_BASE_URL.replace(/\/$/, "")}/rest/api/3`;

// ── HTTP helper ───────────────────────────────────────────────────────────────

/**
 * Make an authenticated request to the Jira REST API v3.
 *
 * @param {string} method - HTTP method.
 * @param {string} path - Path relative to /rest/api/3 (must start with /).
 * @param {object} [body] - Request body; omit for GET/DELETE.
 * @returns {Promise<object|null>} Parsed JSON response, or null for 204.
 */
async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Authorization": `Basic ${AUTH}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }

  return res.status === 204 ? null : res.json();
}

// ── ADF helpers ───────────────────────────────────────────────────────────────

/**
 * Normalise a CLI string: replace literal `\n` sequences with real newlines and trim.
 *
 * @param {string} text - Raw CLI input.
 * @returns {string} Normalised text.
 */
function normalise(text) {
  return text.replace(/\\n/g, "\n").trim();
}

/**
 * Convert plain text to an ADF doc of paragraphs.
 * Lines separated by newlines each become their own paragraph.
 *
 * @param {string} text - Plain text content.
 * @returns {object} ADF document node.
 */
function toAdf(text) {
  const content = normalise(text)
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    }));

  return { type: "doc", version: 1, content };
}

/**
 * Convert a user story to ADF, ensuring "As a", "I want", and "So that"
 * clauses each appear as their own paragraph.
 *
 * Accepts input that is already newline-separated or written as a single
 * inline sentence — both produce the same three-paragraph output.
 *
 * @param {string} text - User story text.
 * @returns {object} ADF document node.
 */
function toStoryAdf(text) {
  const raw = normalise(text);

  // Flatten to one line then inject breaks before "I want" and "So that".
  const split = raw
    .replace(/\n+/g, " ")
    .replace(/\b(i want|so that)\b/gi, "\n$1")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Fall back to plain newline splitting if no clause keywords were found.
  const lines = split.length >= 2 ? split : raw.split(/\n+/).filter(Boolean);

  const content = lines.map((line) => ({
    type: "paragraph",
    content: [{ type: "text", text: line }],
  }));

  return { type: "doc", version: 1, content };
}

/**
 * Convert acceptance criteria text to an ADF task list.
 * Each non-empty line becomes an unchecked task item.
 * Leading markdown task list syntax (`- [ ]`, `* [x]`, etc.) is stripped.
 *
 * @param {string} text - Acceptance criteria, one criterion per line.
 * @returns {object} ADF document node containing a taskList.
 */
function toAcAdf(text) {
  const items = normalise(text)
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s*\[\s*[x ]?\s*\]\s*/i, "").trim())
    .map((line) => ({
      type: "taskItem",
      attrs: { localId: randomUUID(), state: "TODO" },
      content: [{ type: "text", text: line }],
    }));

  return {
    type: "doc",
    version: 1,
    content: [{ type: "taskList", attrs: { localId: randomUUID() }, content: items }],
  };
}

/**
 * Flatten an ADF node tree into a plain-text string.
 * Task items are prefixed with a task list glyph for display.
 *
 * @param {object|string|null} adf - ADF node or plain string.
 * @returns {string} Extracted text.
 */
function fromAdf(adf) {
  if (!adf) return "";
  if (typeof adf === "string") return adf;

  const parts = [];

  /** @param {object} node */
  const walk = (node) => {
    if (node.type === "taskItem") {
      const glyph = node.attrs?.state === "DONE" ? "☑" : "☐";
      parts.push(`\n    ${glyph} `);
    }
    if (node.type === "text") parts.push(node.text ?? "");
    if (node.content) node.content.forEach(walk);
  };

  walk(adf);
  return parts.join("").trim();
}

/**
 * Resolve the "me" shorthand to the authenticated user's email.
 *
 * @param {string} assignee - Email address, or "me" for the authenticated user.
 * @returns {string} Resolved email address.
 */
function resolveAssignee(assignee) {
  return assignee.toLowerCase() === "me" ? JIRA_EMAIL : assignee;
}

// ── Commands ──────────────────────────────────────────────────────────────────

/** Verify credentials and display the authenticated user. */
async function whoami() {
  const user = await api("GET", "/myself");
  console.log(`✓ Connected as ${user.displayName} (${user.emailAddress})`);
}

/**
 * Fetch and display a single Jira issue.
 *
 * @param {string} key - Issue key, e.g. CA-123.
 */
async function getIssue(key) {
  const issue = await api("GET", `/issue/${key}`);
  const f = issue.fields;

  console.log(`\n${issue.key}: ${f.summary}`);
  console.log(`  Type:     ${f.issuetype?.name ?? "?"}`);
  console.log(`  Status:   ${f.status?.name ?? "?"}`);
  console.log(`  Assignee: ${f.assignee?.displayName ?? "Unassigned"}`);
  if (f.description) console.log(`  Desc:     ${fromAdf(f.description)}`);

  if (JIRA_FIELD_STORY && f[JIRA_FIELD_STORY]) {
    console.log(`  Story:    ${fromAdf(f[JIRA_FIELD_STORY])}`);
  }
  if (JIRA_FIELD_AC && f[JIRA_FIELD_AC]) {
    console.log(`  AC:       ${fromAdf(f[JIRA_FIELD_AC])}`);
  }

  console.log(`  URL:      ${JIRA_BASE_URL}/browse/${issue.key}`);
}

/**
 * Create a new Jira issue.
 *
 * @param {object} opts - Parsed CLI options.
 * @param {string} [opts.project] - Project key (or set JIRA_PROJECT).
 * @param {string} [opts.type] - Issue type name (default: Story).
 * @param {string} [opts.summary] - Issue summary (required).
 * @param {string} [opts.description] - Description text.
 * @param {string} [opts.story] - User Story text.
 * @param {string} [opts.ac] - Acceptance Criteria text.
 * @param {string} [opts.parent] - Parent issue key (required when type is Subtask).
 * @param {string} [opts.assignee] - Assignee email, or "me".
 */
async function createIssue(opts) {
  const { project, type = "Story", summary, description, story, ac, parent, assignee } = opts;
  const projectKey = project || JIRA_PROJECT;

  if (!projectKey) throw new Error("Set --project <key> or the JIRA_PROJECT env var");
  if (!summary) throw new Error("--summary is required");
  if (story && !JIRA_FIELD_STORY) throw new Error("Set JIRA_FIELD_STORY. Run: node discover-fields.mjs story");
  if (ac && !JIRA_FIELD_AC) throw new Error("Set JIRA_FIELD_AC. Run: node discover-fields.mjs acceptance");
  if (type.toLowerCase() === "subtask" && !parent) throw new Error("--parent <key> is required when --type Subtask");

  const fields = {
    project: { key: projectKey },
    issuetype: { name: type },
    summary,
  };

  if (description) fields.description = toAdf(description);
  if (story) fields[JIRA_FIELD_STORY] = toStoryAdf(story);
  if (ac) fields[JIRA_FIELD_AC] = toAcAdf(ac);
  if (parent) fields.parent = { key: parent };
  if (assignee) fields.assignee = { emailAddress: resolveAssignee(assignee) };

  const result = await api("POST", "/issue", { fields });
  console.log(`✓ Created ${result.key}: ${JIRA_BASE_URL}/browse/${result.key}`);
}

/**
 * Update fields on an existing issue.
 *
 * @param {string} key - Issue key to update.
 * @param {object} opts - Fields to update.
 */
async function updateIssue(key, opts) {
  const { summary, description, story, ac, parent, assignee } = opts;

  if (story && !JIRA_FIELD_STORY) throw new Error("Set JIRA_FIELD_STORY. Run: node discover-fields.mjs story");
  if (ac && !JIRA_FIELD_AC) throw new Error("Set JIRA_FIELD_AC. Run: node discover-fields.mjs acceptance");

  const fields = {};

  if (summary) fields.summary = summary;
  if (description) fields.description = toAdf(description);
  if (story) fields[JIRA_FIELD_STORY] = toStoryAdf(story);
  if (ac) fields[JIRA_FIELD_AC] = toAcAdf(ac);
  if (parent) fields.parent = { key: parent };
  if (assignee) fields.assignee = { emailAddress: resolveAssignee(assignee) };

  if (Object.keys(fields).length === 0) {
    console.error("Nothing to update. Provide --summary, --description, --story, --ac, --parent, or --assignee.");
    process.exit(1);
  }

  await api("PUT", `/issue/${key}`, { fields });
  console.log(`✓ Updated ${key}: ${JIRA_BASE_URL}/browse/${key}`);
}

/**
 * Transition an issue to a new status by name.
 *
 * @param {string} key - Issue key.
 * @param {string} statusName - Target status name (case-insensitive).
 */
async function transitionIssue(key, statusName) {
  const { transitions } = await api("GET", `/issue/${key}/transitions`);
  const match = transitions.find((t) => t.name.toLowerCase() === statusName.toLowerCase());

  if (!match) {
    const available = transitions.map((t) => t.name).join(", ");
    throw new Error(`Transition "${statusName}" not found. Available: ${available}`);
  }

  await api("POST", `/issue/${key}/transitions`, { transition: { id: match.id } });
  console.log(`✓ Transitioned ${key} → ${match.name}`);
}

/**
 * Search for issues using JQL and display a summary table.
 *
 * Uses `/search/jql`, the replacement for the retired `/search` endpoint. The new endpoint is
 * token-paginated rather than offset-paginated and deliberately returns no `total`, so results are
 * reported as a plain count and a `nextPageToken` is surfaced when more remain.
 *
 * @param {string} jql - JQL query string.
 * @param {number} [max=20] - Maximum results to return.
 */
async function searchIssues(jql, max = 20) {
  const data = await api("POST", "/search/jql", {
    jql,
    maxResults: Number(max),
    fields: ["summary", "status", "assignee", "issuetype", "priority"],
  });

  const issues = data.issues ?? [];
  console.log(`\nFound ${issues.length} issue(s):\n`);

  for (const issue of issues) {
    const f = issue.fields;
    const status = (f.status?.name ?? "?").padEnd(16);
    const type = (f.issuetype?.name ?? "?").padEnd(8);
    console.log(`  ${issue.key.padEnd(12)} [${status}] ${type} ${f.summary}`);
  }

  if (data.nextPageToken) {
    console.log(`\n  … more results available — raise --max to see them.`);
  }
}

/**
 * Add a comment to an issue.
 *
 * @param {string} key - Issue key.
 * @param {string} body - Comment text.
 */
async function addComment(key, body) {
  await api("POST", `/issue/${key}/comment`, { body: toAdf(body) });
  console.log(`✓ Commented on ${key}`);
}

/**
 * List comments on an issue.
 *
 * @param {string} key - Issue key.
 */
async function listComments(key) {
  const data = await api("GET", `/issue/${key}/comment`);

  if (data.comments.length === 0) {
    console.log("No comments.");
    return;
  }

  for (const comment of data.comments) {
    console.log(`\n${comment.author?.displayName ?? "Unknown"} — ${comment.created}`);
    console.log(`  ${fromAdf(comment.body)}`);
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const [, , command, ...rest] = process.argv;

const { values, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  strict: false,
  options: {
    project: { type: "string" },
    type: { type: "string", default: "Story" },
    summary: { type: "string" },
    description: { type: "string" },
    story: { type: "string" },
    ac: { type: "string" },
    parent: { type: "string" },
    assignee: { type: "string" },
    status: { type: "string" },
    max: { type: "string", default: "20" },
  },
});

try {
  switch (command) {
    case "whoami":
      await whoami();
      break;

    case "get":
      if (!positionals[0]) throw new Error("Usage: jira.mjs get <issue-key>");
      await getIssue(positionals[0]);
      break;

    case "create":
      await createIssue(values);
      break;

    case "update": {
      if (!positionals[0]) throw new Error("Usage: jira.mjs update <issue-key> [options]");
      const key = positionals[0];
      if (values.status) await transitionIssue(key, values.status);
      const { status: _s, project: _p, type: _t, max: _m, ...updateFields } = values;
      if (Object.keys(updateFields).length) await updateIssue(key, updateFields);
      break;
    }

    case "search": {
      const jql = positionals.join(" ");
      if (!jql) throw new Error("Usage: jira.mjs search \"<jql>\" [--max N]");
      await searchIssues(jql, values.max);
      break;
    }

    case "comment": {
      const [sub, key, ...bodyParts] = positionals;
      if (sub === "add") {
        const body = bodyParts.join(" ");
        if (!key || !body) throw new Error("Usage: jira.mjs comment add <issue-key> \"<text>\"");
        await addComment(key, body);
      } else if (sub === "list") {
        if (!key) throw new Error("Usage: jira.mjs comment list <issue-key>");
        await listComments(key);
      } else {
        throw new Error('Usage: jira.mjs comment add <issue-key> "<text>" | jira.mjs comment list <issue-key>');
      }
      break;
    }

    default:
      console.error("Commands: whoami | get | create | update | search | comment");
      console.error("See SKILL.md for usage examples.");
      process.exit(1);
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
