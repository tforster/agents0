---
name: timetracker
description: Build paste-ready time-tracker entries -- date, ticket and title, up to 5 bullets of work done -- from the user's Jira and Paca activity, GitHub activity and Claude Code transcripts. Use when the user asks for a time report, timesheet, time entries, hours, or "what did I work on" for a day, days or period.
---

# Timetracker

Reconstructs what the user worked on from the record, not from memory, and hands it back in the shape their time tracker takes: one entry per day per ticket, three fields each.

## 1. Timeframe

Settle the range before collecting anything.

- The request names it -- a date, dates, a weekday, `today`, `yesterday`, `this week`, `last week`, `since Monday`: resolve it to an inclusive `FROM`..`TO` of local `YYYY-MM-DD` dates. A week is Monday to Friday unless the user says otherwise.
- The request names none: ask which days, with AskUserQuestion offering Today, Yesterday, This week so far and Last week. Do not guess and do not collect first.

State the resolved range in one line, e.g. `Mon 2026-10-13 to Fri 2026-10-17`, then collect.

## 2. Collect

Gather every source for the whole range, then bucket by local day. Timestamps from Jira, Paca and GitHub are often UTC; convert before bucketing, or late-evening work lands on the wrong day. A source that is unreachable (no credentials, MCP not connected) is skipped and named in the report, not fatal.

### 2.1. Claude transcripts

```bash
node ${CLAUDE_SKILL_DIR}/scripts/claude-log.mjs FROM TO
```

JSON per day, per project directory: `branches`, `tickets` (keys from prompts and branch names), `sessions`, `first` and `last` prompt times, and the human `prompts` (each cut to 300 characters). Run it first: its ticket keys seed the Jira and Paca lookups, and its prompts say what each session was for. Keys it finds can be false positives (`UTF-8`, `SHA-256`); keep only those Jira or Paca confirm.

### 2.2. GitHub

```bash
login=$(gh api user --jq .login)
gh search commits --author="$login" --author-date="FROM..TO" --json repository,sha,commit --limit 200
gh search prs --involves="$login" --updated="FROM..TO" --json repository,number,title,state,createdAt,closedAt,url --limit 200
```

Ticket keys come from commit messages and PR titles (`(Re: AGEN-54)`) and branch names. Commit search covers default branches only, so open PRs carry the unmerged work. Only the signed-in `gh` account is searched; if `gh auth status` lists others, ask whether to switch and search them too.

### 2.3. Jira

`J` is `node ${CLAUDE_SKILL_DIR}/../jira/scripts/jira.mjs` (setup in the `jira` skill). Where its credentials are missing, use the Atlassian MCP tools instead with the same JQL.

```bash
J search 'issuekey in updatedBy(currentUser(), "FROM", "TO_PLUS_ONE")' --max 100
J search 'worklogAuthor = currentUser() AND worklogDate >= "FROM" AND worklogDate <= "TO"' --max 100
J comment list CA-123
```

`TO_PLUS_ONE` is the day after `TO`, so the last day is included; filter to the range by timestamp afterwards. For each issue, the user's own comments and, through the Atlassian MCP `getJiraIssue` with the changelog expanded, their status and field changes say what was done.

### 2.4. Paca

Through the Paca MCP tools. Candidates are the Paca keys from 2.1 and 2.2 (prefixes from `list_projects`), plus each project's tasks from `list_tasks` whose `Updated` falls in the range. `get_task_by_number` returns a task's activities and comments with timestamps; activities by the user may show as `Admin`.

## 3. Build entries

One entry per day per ticket. A ticket touched on three days is three entries.

- **Title** is the ticket's own summary from Jira or Paca, not a paraphrase.
- **Bullets** say what was done that day, in past tense and outcome first: `Fixed trailing punctuation in blueprint URLs`, not `Worked on jira.mjs`. Merge evidence from every source into at most five; drop routine noise (board moves, re-runs) when real work fills the five.
- **Only evidenced work.** Every bullet traces to a commit, PR, comment, status change or prompt. Never pad a thin day.
- **Work with no ticket** gets an entry with ticket `NO-TICKET` and the project folder or repo as its title, so the user can assign it.

Order entries by date, then ticket key.

## 4. Output

The user's time tracker takes **Date**, **Ticket and title** and **Bullets** as separate fields, so each field is its own fenced block, copyable alone. Bold field labels, no table: a table cell cannot hold bullets that paste cleanly. Every entry has at most 5 bullets.

````markdown
### 2026-10-19 · AGEN-54

**Date**

```text
2026-10-19
```

**Ticket and title**

```text
AGEN-54 timetracker skill: daily time entries from Jira, Paca, GitHub and Claude logs
```

**Bullets**

```text
- Wrote the timetracker skill and its transcript digest script
- Added tests for the timeframe prompt, entry fields and day bucketing
- Opened PR #12
```
````

After the entries, one line names any source that was skipped and why, and any `NO-TICKET` entries to assign.
