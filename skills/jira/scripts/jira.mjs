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
 *   next [--label <l>]                   next story to work: open sprint then backlog, by Rank
 *   set-parent <issue-key> <epic-key>    set an issue's parent epic
 *   link <blocker-key> <blocked-key>     create a "Blocks" link (blocker blocks blocked)
 *   resolve                              print backend/project/site from docs/agents/issue-tracker.md
 *
 * Run inside a repo with docs/agents/issue-tracker.md and the declared project and site are used
 * (--project still wins); credentials always come from env vars.
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
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

// ── Environment ───────────────────────────────────────────────────────────────

// `let`: the repo's issue-tracker.md may override project and site once the CLI starts (see resolveTracker).
let { JIRA_BASE_URL, JIRA_PROJECT } = process.env;
const { JIRA_EMAIL, JIRA_API_TOKEN, JIRA_FIELD_STORY, JIRA_FIELD_AC } = process.env;

// ── Tracker declaration ───────────────────────────────────────────────────────

/**
 * Read the nearest docs/agents/issue-tracker.md, walking up from a directory to the repo root.
 *
 * Deliberately a few regexes, not a parser: the file is prose written for humans, and the one sentence
 * every declaration needs is "Issues are tracked in **Jira**, project key `CA`, on `https://x.atlassian.net`."
 * Only that declaration is read, from "tracked in" to the end of its line (prose is never hard-wrapped),
 * so a migration note naming another backend, or a Confluence link earlier in the file, cannot win.
 *
 * @param {string} startDir - Directory to start from (normally the current working directory).
 * @returns {{ backend: string, project?: string, baseUrl?: string, file: string } | null} Null when no declaration exists.
 */
function resolveTracker(startDir) {
  for (let dir = resolve(startDir); ; dir = dirname(dir)) {
    const file = join(dir, "docs", "agents", "issue-tracker.md");
    if (existsSync(file)) {
      const text = readFileSync(file, "utf8");
      const declaration = text.match(/tracked in \**(Jira|Paca|Azure DevOps)\**[^\n]*/i);
      const sentence = declaration?.[0] ?? "";
      return {
        backend: declaration ? declaration[1].toLowerCase() : "unknown",
        project: sentence.match(/project key\s+`([A-Z][A-Z0-9_]*)`/i)?.[1]?.toUpperCase(),
        // The host must end at .atlassian.net, so the declared site is always Atlassian's, never a lookalike.
        baseUrl: sentence.match(/https:\/\/[\w-]+(\.[\w-]+)*\.atlassian\.net(?![\w-]|\.[\w-])/)?.[0],
        file,
      };
    }
    // Stop at the repo root (git or jj): a declaration in a folder above the repo (~/dev, say) is not this repo's.
    if (existsSync(join(dir, ".git")) || existsSync(join(dir, ".jj")) || dirname(dir) === dir) return null;
  }
}

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
  // Computed per call: JIRA_BASE_URL can change after startup when the repo declares its own site.
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  const base = `${(JIRA_BASE_URL ?? "").replace(/\/$/, "")}/rest/api/3`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }

  // 204, and 201 from POST /issueLink, carry no body, so parse only what is there.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
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
  printBlueprint(f.description, `${f.issuetype?.name ?? "Issue"} ${issue.key}`);

  // A subtask's parent is a story, not an epic: name it from the fields already here and skip the
  // second request, which exists only to fetch the epic's description and any blueprint it links.
  if (f.parent && f.issuetype?.subtask) {
    console.log(`\nParent: ${f.parent.key}: ${f.parent.fields?.summary ?? ""}`);
  } else if (f.parent) {
    await printParent(f.parent.key);
  }
}

/**
 * Collect every URL in an ADF tree: link marks, smart-link cards and bare URLs typed into text.
 * `fromAdf` drops all of these, and a blueprint link would otherwise vanish from the output.
 *
 * @param {object|null} adf - ADF node.
 * @returns {string[]} URLs in document order.
 */
function collectUrls(adf) {
  const urls = [];

  /** @param {any} node */
  const walk = (node) => {
    for (const mark of node.marks ?? []) if (mark.type === "link") urls.push(mark.attrs?.href);
    if (node.type === "inlineCard" || node.type === "blockCard") urls.push(node.attrs?.url);
    if (node.type === "text") urls.push(...(node.text?.match(/https?:\/\/\S+/g) ?? []));
    node.content?.forEach(walk);
  };

  if (adf) walk(adf);
  return urls.filter(Boolean);
}

/**
 * Print the parent issue's description, and the repo blueprint file it links to if any.
 *
 * Blueprints, an epic's or a story's, may live in the repo (docs/blueprints/<key>-<slug>.md) rather
 * than in Jira: a description caps at 32,767 characters. The description is then a summary plus a
 * link, so the agent must read that file for the decisions; we report the path and leave the reading
 * to the agent.
 *
 * @param {string} parentKey - Parent epic's key (subtasks, whose parent is a story, never reach here).
 */
async function printParent(parentKey) {
  const parent = await api("GET", `/issue/${parentKey}?fields=summary,description,issuetype`);
  const pf = parent.fields;
  const kind = pf.issuetype?.name ?? "Parent";

  console.log(`\n${kind}: ${parent.key}: ${pf.summary}`);
  console.log(`  ${kind} description (the blueprint, or a summary linking to it):`);
  console.log(`    ${fromAdf(pf.description).replace(/\n/g, "\n    ")}`);
  printBlueprint(pf.description, `${kind} ${parent.key}`);
}

/**
 * Print the repo blueprint file a description links to, if any, labelled with the issue it belongs to
 * so a story's blueprint and its parent's stay distinguishable when both are printed.
 *
 * @param {object|null} description - ADF description of the issue or its parent.
 * @param {string} owner - Label for the issue, e.g. "Story CA-10".
 */
function printBlueprint(description, owner) {
  // URLs first, so the full link can be reported; then a bare repo path typed as plain text.
  // docs/epics/ is the folder's old name, transitional until consuming repos move to docs/blueprints/;
  // drop the alternative once they have.
  const blueprintPattern = /docs\/(?:blueprints|epics)\/[^\s)#?`'"]+\.md/;
  const blueprintUrl = collectUrls(description).find((u) => blueprintPattern.test(u));
  const blueprintPath = (blueprintUrl ?? fromAdf(description)).match(blueprintPattern)?.[0];
  if (blueprintPath) {
    console.log(`  Blueprint: ${blueprintPath} (${owner})`);
    const link = blueprintUrl ? ` Link: ${blueprintUrl}` : "";
    console.log(`    Read this file from the repo: it is the full blueprint, and the description only its summary.${link}`);
  }
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

const openSprintClause = "sprint in openSprints()";
// A story moved back to the backlog from a closed sprint keeps that sprint in its field, so "no sprint"
// alone would skip it. `not in` never matches an empty field, hence the explicit EMPTY.
const backlogClause = "(sprint is EMPTY OR sprint not in (openSprints(), futureSprints()))";

/**
 * Build the JQL for the next story. Rank order is board order. The sprint clause is a parameter
 * because the open sprint is tried first and the backlog only when it is empty.
 *
 * @param {string} project - Project key.
 * @param {string} sprintClause - `openSprintClause` or `backlogClause`.
 * @param {string} [label] - Optional label filter, e.g. ready-for-agent.
 * @returns {string} JQL.
 */
function nextJql(project, sprintClause, label) {
  // Quoted, like the label: a bare value that is a reserved word or holds an operator would rewrite the query.
  const clauses = [`project = ${JSON.stringify(project)}`, "issuetype = Story", 'statusCategory = "To Do"', sprintClause];
  if (label) clauses.push(`labels = ${JSON.stringify(label)}`);
  return `${clauses.join(" AND ")} ORDER BY Rank ASC`;
}

/**
 * Show the next story to work: first by Rank in the open sprint, else first by Rank in the backlog.
 *
 * @param {string} project - Project key.
 * @param {string} [label] - Optional label filter.
 */
async function nextIssue(project, label) {
  for (const sprintClause of [openSprintClause, backlogClause]) {
    const data = await api("POST", "/search/jql", {
      jql: nextJql(project, sprintClause, label),
      maxResults: 1,
      fields: ["summary", "status", "issuetype", "labels"],
    });
    const issue = data.issues?.[0];
    if (issue) {
      console.log(`${issue.key}: ${issue.fields.summary}`);
      console.log(`  Status: ${issue.fields.status?.name ?? "?"}`);
      console.log(`  Source: ${sprintClause === backlogClause ? "backlog" : "open sprint"}`);
      console.log(`  URL:    ${JIRA_BASE_URL}/browse/${issue.key}`);
      return;
    }
  }
  console.log("No eligible story.");
}

/**
 * Set an issue's parent epic.
 *
 * @param {string} key - Issue to re-parent.
 * @param {string} epicKey - Epic that becomes its parent.
 */
async function setParent(key, epicKey) {
  await api("PUT", `/issue/${key}`, { fields: { parent: { key: epicKey } } });
  console.log(`✓ ${key} is now a child of ${epicKey}`);
}

/**
 * Create a "Blocks" link. In Jira's Blocks type the outward side reads "blocks" and the inward side
 * "is blocked by", so the blocker is the outwardIssue and the blocked issue the inwardIssue.
 *
 * @param {string} blockerKey - Issue that blocks.
 * @param {string} blockedKey - Issue that is blocked.
 */
async function linkBlocks(blockerKey, blockedKey) {
  await api("POST", "/issueLink", {
    type: { name: "Blocks" },
    outwardIssue: { key: blockerKey },
    inwardIssue: { key: blockedKey },
  });
  console.log(`✓ ${blockerKey} blocks ${blockedKey}`);
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
    label: { type: "string" },
    assignee: { type: "string" },
    status: { type: "string" },
    max: { type: "string", default: "20" },
  },
});

try {
  const tracker = resolveTracker(process.cwd());

  if (command === "resolve") {
    console.log(JSON.stringify(tracker ?? { backend: null }));
    process.exit(0);
  }

  // A repo on another backend refuses only the commands that would act on the repo's project; get, search,
  // whoami and anything given --project name their target themselves. An unparseable declaration
  // ("unknown") is ignored, leaving the env defaults.
  const isRepoScoped = (command === "next" || command === "create") && !values.project;
  if (tracker && tracker.backend !== "jira" && tracker.backend !== "unknown" && isRepoScoped) {
    throw new Error(`${tracker.file} declares ${tracker.backend}, not Jira: this recipe does not apply`);
  }
  // Precedence: --project flag, then the repo declaration, then the JIRA_PROJECT default.
  if (tracker?.backend === "jira") {
    JIRA_PROJECT = tracker.project ?? JIRA_PROJECT;
    JIRA_BASE_URL = tracker.baseUrl ?? JIRA_BASE_URL;
  }
  if (values.project) JIRA_PROJECT = values.project;

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error("Missing required env vars: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN");
    console.error("See: https://id.atlassian.com/manage-api-tokens");
    process.exit(1);
  }

  switch (command) {
    case "next":
      if (!JIRA_PROJECT) throw new Error("Set --project <key>, the JIRA_PROJECT env var, or docs/agents/issue-tracker.md");
      await nextIssue(JIRA_PROJECT, values.label);
      break;

    case "set-parent":
      if (!positionals[1]) throw new Error("Usage: jira.mjs set-parent <issue-key> <epic-key>");
      await setParent(positionals[0], positionals[1]);
      break;

    case "link":
      if (!positionals[1]) throw new Error("Usage: jira.mjs link <blocker-key> <blocked-key>");
      await linkBlocks(positionals[0], positionals[1]);
      break;

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
      // label is a `next` filter, not an issue field: left in, it alone would trip "Nothing to update".
      const { status: _s, project: _p, type: _t, max: _m, label: _l, ...updateFields } = values;
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
      console.error("Commands: whoami | get | create | update | search | comment | next | set-parent | link | resolve");
      console.error("See SKILL.md for usage examples.");
      process.exit(1);
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
