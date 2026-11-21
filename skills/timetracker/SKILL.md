---
name: timetracker
description: Build paste-ready time-tracker entries -- client, service, ticket and title, bullet description, duration and date -- from the user's Jira and Paca activity, GitHub activity, Claude Code transcripts and Outlook and Teams, plus a per-day flow summary of how meetings and chats cut into focus time. Use when the user asks for a time report, timesheet, time entries, hours, or "what did I work on" for a day, days or period.
---

# Timetracker

Rebuilds what the user worked on from the record, not from memory. The result comes back in the shape their time tracker takes: one entry per day per ticket, with six fields each. Each day also gets a flow summary showing how much management work (meetings, Teams chats) interrupted development.

## 1. Timeframe

Settle the range before collecting anything.

- **The request names it**, as a date, dates, a weekday, `today`, `yesterday`, `this week`, `last week` or `since Monday`. Resolve it to an inclusive `FROM`..`TO` of local `YYYY-MM-DD` dates. A week is Monday to Friday unless the user says otherwise.
- **The request names none.** Ask which days with AskUserQuestion, offering Today, Yesterday, This week so far and Last week. Do not guess, and do not collect first.

State the resolved range in one line, e.g. `Mon 2026-10-13 to Fri 2026-10-17`, then collect.

## 2. Collect

Gather every source for the whole range, then bucket by local day. Jira, Paca and GitHub timestamps are often UTC. Convert them before bucketing, or late-evening work lands on the wrong day.

A source that cannot be reached (no credentials, MCP not connected) is skipped and named in the report. It does not stop the run. A source that comes back empty is not evidence of no work: transcripts get pruned, and in-person events are often missing from the calendar.

Keep work for every client. The Client field (section 4) lets the user filter. Drop work only when the request names one client.

### 2.1. Claude transcripts

```bash
node ${CLAUDE_SKILL_DIR}/scripts/claude-log.mjs FROM TO
```

The script prints JSON per day, per project directory:

- `branches`
- `tickets`: keys from prompts and branch names
- `sessions`
- `first` and `last` prompt times
- the human `prompts`, each cut to 300 characters

Run it first. Its ticket keys seed the Jira and Paca lookups, and its prompts say what each session was for. Some keys are false positives (`UTF-8`, `SHA-256`), so keep only those Jira or Paca confirm.

### 2.2. GitHub

```bash
login=$(gh api user --jq .login)
gh search commits --author="$login" --author-date="FROM..TO" --json repository,sha,commit --limit 200
gh search prs --involves="$login" --updated=">=FROM" --json repository,number,title,state,createdAt,updatedAt,closedAt,url --limit 200
```

- **PR search has no upper bound on purpose.** A PR worked on in the range and updated again after it would otherwise be missed. For each PR, keep only the activity whose date falls in the range: when it was created or closed, plus its commits.
- **Ticket keys** come from commit messages, PR titles (`(Re: AGEN-54)`) and branch names.
- **Commit search covers default branches only**, so open PRs carry the unmerged work.
- **Accounts:** search every account `gh auth status` lists, switching with `gh auth switch`.

### 2.3. Jira

`J` is `node ${CLAUDE_SKILL_DIR}/../jira/scripts/jira.mjs`; the `jira` skill covers its setup. Use plain JQL fields with `currentUser()`, as that skill does. Jira history functions such as `updatedBy()` reject `currentUser()`. Where `J` has no credentials, run the same JQL through the Atlassian MCP tools.

```bash
J search '(assignee = currentUser() OR reporter = currentUser()) AND updated >= "FROM" ORDER BY updated DESC' --max 100
J search 'worklogAuthor = currentUser() AND worklogDate >= "FROM" AND worklogDate <= "TO"' --max 100
J comment list ABC-123
```

Add the keys found in sections 2.1, 2.2 and 2.4 that these searches missed. For each issue, these say what the user did and when:

- the user's own comments
- status and field changes, from the Atlassian MCP `getJiraIssue` with the changelog expanded
- creation, for issues the user reported

Keep only actions that fall in the range.

### 2.4. Paca

Use the Paca MCP tools. `list_tasks` has no updated date, so do not scan by it. Candidates are:

- the Paca keys found in sections 2.1 and 2.2 (get the prefixes from `list_projects`)
- tasks from `list_tasks` that are assigned to the user and not in a backlog or to-do status

`get_task_by_number` returns a task's activities and comments with timestamps. Activities by the user may show as `Admin`.

### 2.5. Outlook and Teams

Use the Microsoft 365 MCP tools. `get_me` gives the user's address. Page through `nextOffset` until it runs out.

- **Calendar**: `outlook_calendar_search` with `query: "*"`, `order: "oldest"` and `limit: 25`, run one week at a time (`afterDateTime` and `beforeDateTime`). One search across a long range can come back short. Keep events whose start falls in the range, and skip cancelled ones and those marked `showAs: free`.
  - The results do not say whether the user declined an event. Ask about one only when it clashes with other evidence.
  - An all-day event (holiday, vacation) marks the day as off, not as a meeting.
  - When the evidence points to an in-person day that is not on the calendar (travel, an office visit), say so in that day's Flow line.
- **Teams**: `chat_message_search` with `query: "*"` and the same dates. A busy month runs to hundreds of messages at about 10k tokens a page. Hand the paging to a subagent, which writes one compact JSONL line per message to a scratch file: `at`, `chat`, `from`, `fromMe` and the first 120 characters of the summary.
  - Drop messages from bots and connectors (Jira, Confluence, Workflows, anything with no `from.email`).
  - `from.email` equal to the user's address marks a message as `fromMe`.
- **Email**: `outlook_email_search` with `sender` set to the user's address and the same dates, so sent mail only. Recipients come back empty, so work from the subject and summary rather than reading each message. Email can wait, so it adds evidence to descriptions but never counts as an interruption.

Times come as `{dateTime, timeZone}` wall clock. Convert them to ISO with a zone before using them: `2026-10-14T16:00:00` in UTC becomes `2026-10-14T16:00:00Z`.

## 3. Flow

The user splits their time between development and managing the dev team, and management work interrupts their focus. The metric shows how much. Write the range's events to a scratch JSON file and run:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/flow.mjs events.json
```

The input shape is in the script header. Sort each calendar event into one of three groups:

- **`meetings`**: any event with other attendees.
  - Set `dev: true` when it is development work: sprint ceremonies, backlog refinement, pairing, an architecture session, or a subject naming a ticket.
  - A dev meeting still breaks flow, but it does not count as management time.
- **`away`**: a personal block with no other attendees (dentist, lunch, errand). It takes time out of the day without counting as an interruption.
- **Dropped**: a block the user booked for themselves to focus or code. Leaving it out is what lets it count as focus time.

Every Teams message goes into `messages`, with the chat id as `chat`.

What the script does:

- It groups messages in the same chat less than 15 minutes apart into one episode, and keeps only episodes the user took part in.
- It adds 15 minutes of recovery after each meeting and episode.
- Inside a 09:00 to 17:00 workday, open gaps of 60 minutes or more count as focus time. Shorter gaps count as fragmented time.
- Pass `workday` in the input when the user names other hours.

The script prints no row for a day with no meetings or chats. That day's Flow line says so.

## 4. Build entries

One entry per day per ticket. A ticket touched on three days is three entries. Order entries by date, then ticket key.

- **Client/Project**: `CPC` or `Personal`, unless the evidence names a more specific one. Signs of CPC work:
  - a repo owned by `Canadian-Pork-Council`
  - a CPC Jira key
  - a folder under the CPC dev directory
  - a meeting with `cpc-ccp.com` attendees

  The user's own repos and Paca projects (agents0, dev0, side projects) are `Personal`.
- **Service**: the one most likely category, picked from `dev`, `documentation`, `debugging`, `design`, `devops`, `general admin` and `education`.
  - Choose by what the day's work was. Fixing a defect is `debugging`. Infrastructure, CI or a release is `devops`. Blueprints and ADRs are `design`. Docs and READMEs are `documentation`. Training, research or learning is `education`.
  - Management work is `general admin`.
- **Ticket**: the Jira or Paca key, then the ticket's own summary from Jira or Paca, not a paraphrase, all on one line.
  - Work with no ticket uses `NO-TICKET`, followed by the repo, folder or meeting subject, so the user can assign it.
  - Child tickets of one parent touched on the same day fold into one entry under the parent, with the child keys named in the description. This stops a day of closing subtasks from turning into dozens of entries.
- **Description**: Markdown bullets saying what was done that day, past tense and outcome first: `Fixed trailing punctuation in blueprint URLs`, not `Worked on jira.mjs`.
  - Use at most five bullets. Merge evidence from every source, and drop routine noise (board moves, re-runs) when real work fills the five.
  - Every bullet traces to a commit, PR, comment, status change, prompt, meeting or message. Never pad a thin day.
- **Duration**: time spent, when the evidence supports it, as `1h30`.
  - A meeting's calendar length is exact.
  - Other work is estimated: the span from the first to the last evidence for the ticket that day, minus meetings inside it, rounded to 15 minutes. Mark estimates with `~`.
  - With a single timestamp or none, leave the field blank. Never invent one.
- **Date**: local `YYYY-MM-DD`.

Meetings and chats go to entries as follows:

- One that names a ticket, or is clearly about one, adds to that ticket's entry, even hiring or policy work that has its own ticket.
- A dev meeting with no ticket is a `NO-TICKET` entry named after the meeting.
- All other management work for the day (non-dev meetings, team chats, sprint grooming with no meeting) goes into one entry: ticket `MANAGEMENT Team management: meetings and chat`, service `general admin`, with meeting subjects and chat topics as bullets.

## 5. Output

The tracker takes six fields. Each entry is one fenced `text` block with one field per line, in the tracker's order, so each value can be copied from its own line. Description bullets follow on the lines after their label. Use no table, because a table cell cannot hold bullets that paste cleanly.

````markdown
### 2026-10-19 · AGEN-54

```text
Client/Project: Personal
Service: dev
Ticket: AGEN-54 timetracker skill: daily time entries from Jira, Paca, GitHub and Claude logs
Description:
- Wrote the timetracker skill and its transcript digest script
- Added tests for the timeframe prompt, entry fields and day bucketing
- Opened PR #12
Duration: ~2h15
Date: 2026-10-19
```
````

After each day's entries comes a **Flow** line for that day, built from `flow.mjs`, in its own fenced `text` block:

```text
Flow 2026-10-14: 3 interruptions (2 meetings 55m, 1 chat 5m) · management 1h00 · focus 5h55 in 2 blocks, longest 4h15 · fragmented 50m
```

After the last day, add one range summary line, counted over workdays only (weekdays not marked off):

- total management hours
- total focus hours
- interruptions per day
- the share of the workday left as focus time

Finish with one line naming any source that was skipped and why, and any `NO-TICKET` entries to assign.
