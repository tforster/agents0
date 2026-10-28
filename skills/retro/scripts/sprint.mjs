// sprint.mjs — one Jira sprint's dates, goal and issues, as a retrospective needs them
//
// Node 24+. Reads the board's sprints through the Jira Agile API, picks one, and prints JSON: the sprint, its local
// FROM..TO date range, and its issues bucketed by Jira's own sprint report -- completed, not completed, removed
// mid-sprint and completed in another sprint -- each flagged when it was added after the sprint started. The sprint
// report endpoint is Jira's private greenhopper API, the same one the board's Sprint Report page reads; the public
// Agile API has no equivalent for "added during sprint".
//
// Prerequisites: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, as for the jira skill.
//
// Usage:
//   node sprint.mjs 1          # board 1, its most recently closed sprint
//   node sprint.mjs 1 73       # board 1, the sprint named "Sprint 73" (or with id 73)

/**
 * @typedef {Object} Sprint
 * @property {number} id
 * @property {string} name
 * @property {string} state
 * @property {string} [startDate]
 * @property {string} [endDate]
 * @property {string} [completeDate]
 * @property {string} [goal]
 */

/**
 * @typedef {Object} ReportIssue
 * @property {string} key
 * @property {string} summary
 * @property {string} typeName
 * @property {string} statusName
 * @property {string} [assigneeName]
 * @property {string} [epic]
 * @property {{ statFieldValue?: { value?: number } }} [currentEstimateStatistic]
 */

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

/**
 * GETs a Jira path and parses the JSON.
 *
 * @param {string} path - Path from the site root, starting with /rest.
 * @returns {Promise<any>} Parsed response.
 */
async function get(path) {
  // The jira skill's examples set the site without a scheme; this machine's sets it with one. Accept both.
  const base = (JIRA_BASE_URL ?? "").replace(/\/$/, "").replace(/^(?!https?:\/\/)/, "https://");
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}: ${await response.text()}`);
  return await response.json();
}

/**
 * Lists every sprint on a board, following the Agile API's pages.
 *
 * @param {string} board - Board id.
 * @returns {Promise<Sprint[]>} All sprints, in board order.
 */
async function sprints(board) {
  /** @type {Sprint[]} */
  const all = [];
  for (let startAt = 0; ; ) {
    const page = await get(`/rest/agile/1.0/board/${board}/sprint?startAt=${startAt}&maxResults=50`);
    all.push(...page.values);
    startAt += page.values.length;
    if (page.isLast || page.values.length === 0) return all;
  }
}

/**
 * Picks the sprint asked for: by name ("73" matches "Sprint 73") or id, else the most recently closed.
 *
 * @param {Sprint[]} list - The board's sprints.
 * @param {string | undefined} wanted - Sprint number, name or id.
 * @returns {Sprint | undefined} The sprint, or undefined when none matches.
 */
function pick(list, wanted) {
  if (!wanted) {
    return list.filter((sprint) => sprint.state === "closed").sort((a, b) => (a.completeDate ?? "").localeCompare(b.completeDate ?? "")).at(-1);
  }
  const name = /^\d+$/.test(wanted) ? new RegExp(`(^|\\s)${wanted}$`) : null;
  return list.find((sprint) => sprint.name === wanted || name?.test(sprint.name)) ?? list.find((sprint) => String(sprint.id) === wanted);
}

/**
 * Returns the local YYYY-MM-DD of a moment.
 *
 * @param {Date} moment - The moment.
 * @returns {string} Local date; en-CA formats as YYYY-MM-DD.
 */
function localDate(moment) {
  return moment.toLocaleDateString("en-CA");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const [board, wanted] = process.argv.slice(2);
if (!/^\d+$/.test(board ?? "")) {
  console.error(`Expected a board id, got "${board ?? ""}". Usage: sprint.mjs <board> [sprint]`);
  process.exit(1);
}

const sprint = pick(await sprints(board), wanted);
if (!sprint) {
  console.error(`No sprint "${wanted ?? "(latest closed)"}" on board ${board}.`);
  process.exit(1);
}

const { contents } = await get(`/rest/greenhopper/1.0/rapid/charts/sprintreport?rapidViewId=${board}&sprintId=${sprint.id}`);
const added = new Set(Object.keys(contents.issueKeysAddedDuringSprint ?? {}));

/**
 * Flattens a sprint report issue to what a retro reads.
 *
 * @param {ReportIssue} issue - Sprint report entry.
 * @returns {Record<string, unknown>} The issue.
 */
const flatten = (issue) => ({
  key: issue.key,
  summary: issue.summary,
  type: issue.typeName,
  status: issue.statusName,
  assignee: issue.assigneeName ?? null,
  epic: issue.epic ?? null,
  points: issue.currentEstimateStatistic?.statFieldValue?.value ?? null,
  addedDuringSprint: added.has(issue.key),
});

const issues = {
  completed: (contents.completedIssues ?? []).map(flatten),
  notCompleted: (contents.issuesNotCompletedInCurrentSprint ?? []).map(flatten),
  removed: (contents.puntedIssues ?? []).map(flatten),
  completedInAnotherSprint: (contents.issuesCompletedInAnotherSprint ?? []).map(flatten),
};

// A sprint ends at a moment (often 01:00 the next morning), so its last working day is the day before that moment;
// a sprint closed early ends the day it was closed.
const end = sprint.completeDate ? new Date(sprint.completeDate) : new Date(Date.parse(sprint.endDate ?? "") - 1);

console.log(
  JSON.stringify(
    {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        state: sprint.state,
        goal: sprint.goal ?? "",
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        completeDate: sprint.completeDate ?? null,
      },
      from: localDate(new Date(sprint.startDate ?? "")),
      to: localDate(end),
      counts: { ...Object.fromEntries(Object.entries(issues).map(([bucket, list]) => [bucket, list.length])), addedDuringSprint: added.size },
      issues,
    },
    null,
    2
  )
);
