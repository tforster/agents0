---
name: github
description: Read and write GitHub issues, pull requests, workflows, runs, releases, and labels using the GitHub CLI (gh). Use when asked to create, update, search, merge, or review issues or PRs, check CI status, trigger or inspect workflow runs, or when the user references a GitHub repo, issue number, PR number, or branch.
---

# GitHub

## Quick start

```bash
# List open issues in the current repo
gh issue list

# View an issue
gh issue view 42 --json number,title,body,labels,assignees,state

# Create an issue
gh issue create --title "Bug: ..." --body "..." --label bug --assignee "@me"

# List open PRs
gh pr list

# View a PR with CI status
gh pr view 42 --json number,title,state,reviewDecision,statusCheckRollup

# Create a PR
gh pr create --title "..." --body "..." --base main --assignee "@me"

# Merge a PR
gh pr merge 42 --squash --delete-branch
```

## Auth

```bash
gh auth status
```

If not authenticated, run `gh auth login`. Most workflows need the `repo`, `read:org`, and `gist` token scopes.

Commands default to the repo in the current working directory. Use `-R <owner>/<repo>` to target any other repo.

## Output flags

Use `--json <fields>` for structured output, and `--jq <expression>` to filter it inline.

## Labels

GitHub's default label set: `bug` `documentation` `duplicate` `enhancement` `good first issue`
`help wanted` `invalid` `question` `wontfix`

See [REFERENCE.md](REFERENCE.md) for the full command reference (issues, PRs, workflows/runs, search syntax, raw API access, cross-repo targeting, `jq` filtering) and JSON field lists.
