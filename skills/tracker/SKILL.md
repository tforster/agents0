---
name: tracker
description: Work stories in the project's issue tracker through one five-operation contract (next, get, comment, transition, create). Use when the user or a workflow says to pick up the next story, read a story and its epic, comment on or move an issue, create a story, or otherwise work tracker or Jira issues. Today the only recipe is Jira.
---

# Tracker

One contract, one recipe per backend, no adapter library. Callers use the five operations below and never a backend's own commands. Each backend's recipe maps them onto its tooling.

## Resolve the backend

Read the repo's `docs/agents/issue-tracker.md` (found by walking up from the current directory, stopping at the repo root). It must say, in prose on one line, which tracker the repo uses; only that line is read, for Jira: ``Issues are tracked in **Jira**, project key `CA`, on `https://example.atlassian.net`.``

```bash
node ${CLAUDE_SKILL_DIR}/../jira/scripts/jira.mjs resolve    # {"backend":"jira","project":"CA","baseUrl":"https://...","file":"..."}
```

- `backend: "jira"`: use the Jira recipe below.
- Any other backend, or `null` (no declaration): stop and tell the user. Paca and Azure DevOps recipes do not exist yet.
- Credentials are never in the declaration. They come from env vars (`JIRA_EMAIL`, `JIRA_API_TOKEN`; see the `jira` skill's setup). The declared project and site override `JIRA_PROJECT` and `JIRA_BASE_URL`; `--project` overrides the declaration.

## Contract

| Operation    | Does                                                                                          | Returns                                                                       |
| ------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `next`       | Picks the next story to work, in board order. Optional label filter, e.g. `ready-for-agent`   | One story (key, summary, source), or "No eligible story"                      |
| `get`        | Reads one story with its parent epic                                                          | Story fields, epic description, and each one's blueprint path if linked       |
| `comment`    | Adds a comment to a story                                                                     | Confirmation                                                                  |
| `transition` | Moves a story to a named status                                                               | Confirmation, or the available statuses when the name is wrong                |
| `create`     | Creates a story, optionally under an epic and with blocking links to other stories            | The new key and URL                                                           |

After `get`, read every blueprint file it reports (the repo path, relative to the repo root) before building: each holds the decisions of the story or epic it is labelled with.

## Jira recipe

The recipe is the `jira` skill's script. It is the one Jira client; there is no second one. `J` below is `node ${CLAUDE_SKILL_DIR}/../jira/scripts/jira.mjs`, run from inside the repo.

| Operation    | Command                                                                              |
| ------------ | ------------------------------------------------------------------------------------ |
| `next`       | `J next [--label ready-for-agent]`                                                   |
| `get`        | `J get CA-123`                                                                       |
| `comment`    | `J comment add CA-123 "text"`                                                        |
| `transition` | `J update CA-123 --status "In Progress"`                                             |
| `create`     | `J create --type Story --summary "..." --ac "..." [--parent CA-1]`                   |
| (create, follow-up) | `J set-parent CA-123 CA-1` to re-parent; `J link CA-10 CA-11` so CA-10 blocks CA-11 |

### 1. next

Open sprint first, ordered by Rank ascending; if it has nothing, the backlog (no sprint, or only closed ones) by Rank. Always Story type and status category To Do, so `next` never returns a story already started. Rank is the order on the board, so the architect's ordering is the agent's ordering.

### 2. get

Prints the story, then its parent epic: type, key, summary and description. A subtask shows only its parent story's key and summary. When the story's own description or its parent's links to a repo blueprint (`docs/blueprints/<key>-<slug>.md`, as a link, a smart card, a typed URL or a bare path), it adds a `Blueprint:` line with that repo path, labelled with the issue it belongs to, e.g. `(Story CA-10)` or `(Epic CA-1)`; when both link one, both lines appear. Read each file: when a project keeps blueprints in the repo, that issue's description is only a summary and the file is the only copy of its decisions (Jira descriptions cap at 32,767 characters). The older `docs/epics/` folder is still recognised while projects migrate.

### 3. create and links

Follow the project's own conventions in its `docs/agents/issue-tracker.md` (field mapping, title rules, blocking edges). Blocking edges are Jira links: create the stories first, then `link` each pair.

## Out of scope

The paired wiki (Confluence). Paca and Azure DevOps recipes: a later story adds each as its own section here, mapping the same five operations.

For Jira setup, custom fields and the full command list, see the `jira` skill.
