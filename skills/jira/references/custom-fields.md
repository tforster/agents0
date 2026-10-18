# Jira Custom Fields Reference

## Table of Contents

- [Jira Custom Fields Reference](#jira-custom-fields-reference)
  - [Table of Contents](#table-of-contents)
  - [Why Custom Fields Are Tricky](#why-custom-fields-are-tricky)
  - [The Three Story Fields](#the-three-story-fields)
  - [Discovering Field IDs](#discovering-field-ids)
  - [Configuring the Scripts](#configuring-the-scripts)
  - [Atlassian Document Format (ADF)](#atlassian-document-format-adf)
  - [Advanced: OAuth 2.0](#advanced-oauth-20)

## Why Custom Fields Are Tricky

Jira stores custom fields by a generated ID (`customfield_XXXXX`) that is **unique per Jira instance**. The same field named "Acceptance Criteria" may be `customfield_10042` in one organisation and `customfield_10091` in another. You must discover the correct IDs for `https://your-base-url.atlassian.net` and export them as environment variables before the scripts can write to those fields.

## The Three Story Fields

| Script flag     | Field name          | Field type   | Notes                                 |
| :-------------- | :------------------ | :----------- | :------------------------------------ |
| `--description` | Description         | Built-in     | Standard Jira field, always available |
| `--story`       | User Story          | Custom (ADF) | Requires `JIRA_FIELD_STORY` env var   |
| `--ac`          | Acceptance Criteria | Custom (ADF) | Requires `JIRA_FIELD_AC` env var      |

All three accept **plain text**. Multi-line content uses `\n` as a separator:

```bash
--ac "Given the user is logged in\nWhen they click Save\nThen the record is persisted"
```

## Discovering Field IDs

Run the discovery script with a search term to filter results:

```bash
node scripts/discover-fields.mjs story        # find User Story
node scripts/discover-fields.mjs acceptance   # find Acceptance Criteria
node scripts/discover-fields.mjs              # list all custom fields
```

Example output:

```
Custom fields matching "story" (2):

  ID                    Name
  ─────────────────────────────────────────────────
  customfield_10042     User Story
  customfield_10016     Story Points
```

The field you want is named exactly **"User Story"** and **"Acceptance Criteria"** — match the display name precisely.

## Configuring the Scripts

Once you have the correct IDs, export them (and add to your shell profile):

```bash
export JIRA_BASE_URL=https://your-base-url.atlassian.net
export JIRA_EMAIL=you@example.com
export JIRA_API_TOKEN=<token>
export JIRA_FIELD_STORY=customfield_XXXXX   # replace with real ID
export JIRA_FIELD_AC=customfield_XXXXX      # replace with real ID
```

The scripts error early with a helpful message if a required env var is missing when you attempt to read or write that field.

## Atlassian Document Format (ADF)

Jira Cloud API v3 stores all rich-text fields as **Atlassian Document Format (ADF)** — a JSON tree, not a plain string. The scripts handle conversion automatically:

- **Writing** (`create`, `update`): plain text is converted automatically.
  - `--description`: newline-separated lines become separate paragraphs.
  - `--story`: text is split on "As a", "I want", and "So that" clause boundaries — each clause becomes its own paragraph, whether the input is inline or `\n`-separated.
  - `--ac`: each `\n`-separated line becomes an unchecked item in a Jira task list (`taskList` / `taskItem` ADF nodes).
- **Reading** (`get`): ADF is flattened to plain text; task list items are prefixed with `☐` or `☑`.

ADF paragraph structure (for reference):

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "Given the user is logged in" }]
    },
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "When they click Save" }]
    }
  ]
}
```

If you need richer formatting (bullet lists, headings, code blocks), construct the ADF manually and pass it directly to the API. The REST API v3 reference: `https://developer.atlassian.com/cloud/jira/platform/rest/v3/`

## Advanced: OAuth 2.0

API token auth is recommended. OAuth 2.0 (3LO) is available if you need to act as different users or require delegated scopes.

To use OAuth 2.0:

1. Register an app at `https://developer.atlassian.com/console/myapps/`
2. Add scopes: `read:jira-work`, `write:jira-work`
3. Set the redirect URI to `http://localhost:8080/callback`
4. Implement the authorisation code + PKCE flow, start a local HTTP server to capture the redirect, exchange the code for tokens, and store them locally

This is significantly more complex than API token auth and requires keeping a registered app in the Atlassian developer console. Use API token unless you have a specific reason for OAuth.
