---
name: retro
description: Write a client-focused sprint retrospective -- what went well, what didn't, what is changing -- from the user's own highlights plus the client's Jira sprint report, local git commits, GitHub PRs and Claude Code transcripts. Use when the user asks for a retro, retrospective, sprint review or "how did the sprint go" for a client.
---

# Retro

Writes one sprint's retrospective for one client, from the record and the user's own view of it. The reader is the client: it speaks in outcomes they care about, not in the mechanics of how the work was done.

## 1. Client

Clients and their sources live in `${XDG_CONFIG_HOME:-$HOME/.config}/agents0/retro-clients.json`, outside this public repo:

```json
{
  "default": "CPC",
  "clients": {
    "CPC": {
      "name": "Canadian Pork Council",
      "jira": { "site": "https://example.atlassian.net", "project": "CA", "board": 1 },
      "paca": [],
      "github": ["Example-Org"],
      "repos": ["~/dev/CPC"],
      "retros": "~/dev/CPC/docs/retros",
      "cadence": { "anchor": "2026-10-15", "days": 14 }
    }
  }
}
```

Ask which client with AskUserQuestion, the config's `default` first and marked `(Recommended)`, before anything else, unless the request names one. A client missing from the config, or no config at all: ask for its entry's fields and write it.

## 2. Sprint

With a Jira board, the board is the authority on dates:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/sprint.mjs BOARD [SPRINT]
```

`SPRINT` is a number (`73` matches `Sprint 73`) or id; omitted, the most recently closed sprint. Set `JIRA_BASE_URL` to the client's `jira.site` for the call. It prints the sprint's goal, its local `from`..`to` days, and its issues bucketed as Jira's sprint report buckets them -- completed, not completed, removed, completed in another sprint -- each flagged `addedDuringSprint`. Jira counts a `Will not do` resolution as completed; report those apart from `Done`.

Without a board, count `cadence.days`-day sprints from `cadence.anchor` to the one the user names, or the last one ended.

State the sprint in one line, e.g. `CPC Sprint 73 · Thu 2026-10-15 to Wed 2026-10-28 · goal: Embed cpe.web`.

## 3. Highlights

Before collecting anything, ask the user in plain prose, not AskUserQuestion, and wait for the reply:

- What went well?
- What didn't?
- What is changing, or should?

Anything they say leads the retro: the record adds evidence and fills gaps, it never overrules them. `nothing` or `go` skips straight to collecting.

## 4. Collect

Gather every source for `from`..`to`. Timestamps from Jira and GitHub are UTC; convert before judging which day they fall on. An unreachable source is skipped and named in the report, not fatal.

### 4.1. Jira sprint report

The script's output from step 2. For the issues that carry the story -- the goal's, the large ones, those added mid-sprint, those carried over -- read comments and changelog with the `jira` skill's `get` and `comment list`, or the Atlassian MCP `getJiraIssue`. Then find work done for the client outside the sprint:

```bash
J search 'project = PROJECT AND issuekey in updatedBy(currentUser(), "FROM", "TO_PLUS_ONE") AND sprint != SPRINT_ID' --max 100
```

`J` is `node ${CLAUDE_SKILL_DIR}/../jira/scripts/jira.mjs`; `TO_PLUS_ONE` is the day after `to`.

### 4.2. Git

Every commit the user made on any branch of the client's local repos, merged or not:

```bash
for repo in $(find REPO_ROOTS -maxdepth 3 -name .git -prune | xargs -n1 dirname); do
  git -C "$repo" log --all --no-merges --author="$(git -C "$repo" config user.email)" \
    --since="FROM 00:00" --until="TO 23:59" --format="$repo%x09%h%x09%ad%x09%s" --date=short
done
```

`REPO_ROOTS` is the client's `repos`. Ticket keys in commit subjects tie commits to issues.

### 4.3. GitHub

```bash
login=$(gh api user --jq .login)
gh search prs --owner=OWNER --involves="$login" --updated="FROM..TO" --json repository,number,title,state,createdAt,closedAt,url --limit 200
```

Once per `github` owner. PRs show what shipped, what is still in review, and what review turned up.

### 4.4. Claude transcripts

```bash
node ${CLAUDE_SKILL_DIR}/../timetracker/scripts/claude-log.mjs FROM TO
```

Keep only projects whose `cwd` is under one of the client's `repos`. The prompts say what the user was trying to do and where it was hard: repeated attempts, reversals and blocked sessions are evidence for what didn't go well.

### 4.5. Previous retro

The newest file in the client's `retros` folder. Each item of its "What's changing" is checked against this sprint's evidence: did it happen, and did it help?

### 4.6. Meetings and mail

Where Microsoft 365 is connected, the client's meetings and threads in the range (`outlook_calendar_search`, `outlook_email_search`, `chat_message_search`). They hold decisions and client feedback no commit records.

## 5. Analyse

- **Goal first.** Was the sprint goal met? Say so plainly, with the evidence.
- **Planned against actual.** How much of the completed work was committed at the start against added mid-sprint, and what the additions were (support, security, client requests). A sprint that delivered mostly unplanned work is a finding, not a footnote.
- **Themes, not tickets.** Group issues, commits and PRs into the two to five things the sprint was really about. Name tickets as evidence under a theme.
- **Only evidenced claims.** Every point traces to the user's highlights, an issue, a commit, a PR, a comment or a transcript. Never pad.
- **For the client.** Outcomes and risks the client cares about. Leave out internal tooling, agent sessions and the mechanics of how work was done, unless they changed what the client got.
- **Changes are actions.** Each item under "What's changing" is a concrete change for next sprint with an owner, not an aspiration.

## 6. Output

Write the retro to `RETROS/YYYY-MM-DD-sprint-N.md`, dated the sprint's last day, then show it in full. `RETROS` is the client's `retros`; create it with a `README.md` index on first use, and add each retro to the index. The retro follows the house Markdown rules:

```markdown
# CPC Sprint 73 Retrospective <!-- omit in toc -->

Thu 2026-10-15 to Wed 2026-10-28 · Goal: Embed cpe.web · **Goal met / partly met / not met**

## Table of Contents <!-- omit in toc -->

## 1. Summary

Three to five sentences: what the sprint delivered for the client and the one thing to know.

## 2. By the Numbers

Committed, added mid-sprint, done, will not do, carried over; points where the board uses them.

## 3. What Went Well

## 4. What Didn't Go Well

## 5. What's Changing

| Change | Owner | Why |
| ------ | ----- | --- |

## 6. Last Sprint's Changes

What came of each previous "What's changing" item. Omit on a client's first retro.

## 7. Carried Over

Not-completed issues with a line each on why and what happens next.

[← Back to Retrospectives](./README.md)
```

After the retro, one line names any source that was skipped and why, and offers to publish it as a shareable page.
