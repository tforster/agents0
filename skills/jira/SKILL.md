---
name: jira
description: Create, read, update and query Jira issues via the Atlassian Cloud REST API v3. Use when the user wants to work with Jira issues, stories, bugs, tasks or epics — including reading issue details, creating new stories, updating fields, transitioning status, and running JQL searches. Handles the project's custom User Story and Acceptance Criteria fields.
---

# Jira

Interact with Jira Cloud (`https://your-base-url.atlassian.net`) via REST API v3.

## Setup

Run once, then add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export JIRA_BASE_URL=your-base-url.atlassian.net
export JIRA_EMAIL=you@example.com
export JIRA_API_TOKEN=<token>  # generate at: https://id.atlassian.com/manage-api-tokens
export JIRA_PROJECT=PROJ       # default project key; omit to pass --project on every call
```

**Custom field IDs** — run the discovery script once and export these two variables:

```bash
node scripts/discover-fields.mjs story        # find User Story field ID
node scripts/discover-fields.mjs acceptance   # find Acceptance Criteria field ID

export JIRA_FIELD_STORY=customfield_XXXXX
export JIRA_FIELD_AC=customfield_XXXXX
```

See [references/custom-fields.md](references/custom-fields.md) for full details.

Verify with:

```bash
node scripts/jira.mjs whoami
```

## Read an issue

```bash
node scripts/jira.mjs get PROJ-123
```

## Create an issue

```bash
node scripts/jira.mjs create \
  --project PROJ \
  --type Story \
  --summary "User can reset their password" \
  --description "Implement the forgot-password flow." \
  --story "As a user\nI want to reset my password\nSo that I can regain access to my account" \
  --ac "Given I am on the login page\nWhen I click Forgot Password\nThen I receive a reset email within 60 seconds" \
  --assignee me
```

`--project` can be omitted if `JIRA_PROJECT` is set. `--type` defaults to `Story`. Other values: `Bug`, `Task`, `Epic`, `Subtask`.
`--assignee` accepts an email address or `me` for the authenticated user.

Subtasks require `--parent <key>` and use `--type Subtask` (not `Task`, which ignores `parent`):

```bash
node scripts/jira.mjs create --type Subtask --parent PROJ-42 --summary "Write the migration script"
```

Some projects' permission schemes reject self-assignment on subtasks — if `--assignee` fails on a `Subtask`, omit it and assign separately.

## Update an issue

```bash
# Update fields
node scripts/jira.mjs update PROJ-123 \
  --summary "Revised summary" \
  --ac "Updated acceptance criteria"

# Transition status
node scripts/jira.mjs update PROJ-123 --status "In Progress"

# Both at once
node scripts/jira.mjs update PROJ-123 --status "In Review" --story "Revised story text"
```

## Search with JQL

```bash
node scripts/jira.mjs search "project = PROJ AND status = 'In Progress'" --max 20
```

Common patterns:

- `assignee = currentUser() AND status != Done`
- `sprint in openSprints() AND project = PROJ`
- `issuetype = Story AND labels = frontend ORDER BY created DESC`
- `updated >= -7d ORDER BY priority DESC`

## Comment on an issue

```bash
node scripts/jira.mjs comment add PROJ-123 "Deployed to staging, ready for QA."
node scripts/jira.mjs comment list PROJ-123
```

## Custom fields

Stories have three rich-text fields — `description`, `story` (User Story), and `ac` (Acceptance Criteria).

- `--story` text is split on "As a", "I want", and "So that" clauses — each becomes its own paragraph. Inline or `\n`-separated input both work.
- `--ac` text is converted to a Jira task list; each `\n`-separated line becomes an unchecked task item.

See [references/custom-fields.md](references/custom-fields.md) for field discovery, ADF details, and advanced configuration.
