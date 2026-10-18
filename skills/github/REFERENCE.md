# GitHub Reference

## Command groups

| Group        | Purpose                                      |
|--------------|----------------------------------------------|
| `gh issue`   | Create, read, edit, close, comment on issues |
| `gh pr`      | Create, review, merge, check PRs             |
| `gh workflow`| List, enable, disable, trigger workflows     |
| `gh run`     | List, view, watch, rerun, cancel runs        |
| `gh repo`    | List, view, clone, edit repos                |
| `gh label`   | Create, edit, delete, clone labels           |
| `gh release` | Create, list, view, edit releases            |
| `gh api`     | Raw authenticated REST/GraphQL API calls     |

## Issue JSON fields

```
assignees, author, body, closed, closedAt, closingIssuesReferences,
comments, createdAt, id, isPinned, labels, milestone, number,
projectCards, projectItems, reactionGroups, state, stateReason,
title, updatedAt, url
```

## PR JSON fields

```
additions, assignees, author, autoMergeRequest, baseRefName, baseRefOid,
body, changedFiles, closed, closedAt, closingIssuesReferences, comments,
commits, createdAt, deletions, files, headRefName, headRefOid,
headRepository, headRepositoryOwner, id, isCrossRepository, isDraft,
labels, latestReviews, maintainerCanModify, mergeCommit, mergeStateStatus,
mergeable, mergedAt, mergedBy, milestone, number, reviewDecision,
reviewRequests, reviews, state, statusCheckRollup, title, updatedAt, url
```

## Issue commands

```bash
# List
gh issue list --state open
gh issue list --assignee "@me"
gh issue list --label bug
gh issue list --search "error no:assignee sort:created-asc"
gh issue list --state all --limit 50 --json number,title,state,labels

# View
gh issue view <number>
gh issue view <number> --json number,title,body,labels,assignees,state,comments

# Create
gh issue create --title "..." --body "..."
gh issue create --title "..." --body-file issue.md --label bug --assignee "@me"

# Edit
gh issue edit <number> --title "New title"
gh issue edit <number> --add-label enhancement --remove-label bug
gh issue edit <number> --add-assignee "@me"
gh issue edit <number> --milestone "v2.0"

# Comment
gh issue comment <number> --body "..."

# Close / reopen
gh issue close <number>
gh issue reopen <number>
```

## PR commands

```bash
# List
gh pr list
gh pr list --author "@me"
gh pr list --base main
gh pr list --state merged --limit 10
gh pr list --search "status:failure review:required"
gh pr list --json number,title,state,reviewDecision,headRefName

# View
gh pr view <number>
gh pr view <number> --json number,title,state,body,commits,reviews,statusCheckRollup
gh pr view <number> --comments

# Create
gh pr create --title "..." --body "..." --base main
gh pr create --title "..." --body-file pr.md --reviewer <username> --label enhancement
gh pr create --fill                          # autofill from commits
gh pr create --draft                         # open as draft

# Edit
gh pr edit <number> --title "..."
gh pr edit <number> --add-label enhancement --add-reviewer <username>

# Review
gh pr review <number> --approve
gh pr review <number> --request-changes --body "Please fix..."
gh pr review <number> --comment --body "..."

# CI checks
gh pr checks <number>

# Merge
gh pr merge <number> --merge                 # merge commit
gh pr merge <number> --squash --delete-branch
gh pr merge <number> --rebase

# Other
gh pr ready <number>                         # mark draft as ready
gh pr close <number>
gh pr reopen <number>
gh pr update-branch <number>                 # update with base branch
```

## Workflow and run commands

```bash
# Workflows
gh workflow list
gh workflow view <name-or-id>
gh workflow run <name-or-id>
gh workflow run <name-or-id> --field key=value   # pass inputs
gh workflow enable <name-or-id>
gh workflow disable <name-or-id>

# Runs
gh run list --limit 20
gh run list --workflow <name-or-id>
gh run list --branch main --status failure
gh run view <run-id>
gh run view <run-id> --log
gh run watch <run-id>
gh run rerun <run-id>
gh run rerun <run-id> --failed               # rerun only failed jobs
gh run cancel <run-id>
```

## Search syntax (--search flag)

```
is:open is:closed is:merged is:draft
author:<username> author:@me
assignee:@me
label:bug label:"help wanted"
no:assignee no:label
sort:created-asc sort:updated-desc
status:success status:failure status:pending
review:required review:approved review:changes-requested
```

## Raw API access

Use `gh api` for anything not covered by the CLI commands:

```bash
# GET
gh api repos/<owner>/<repo>

# GraphQL
gh api graphql -f query='
  query {
    repository(owner:"<owner>", name:"<repo>") {
      defaultBranchRef { name }
    }
  }
'

# Pagination
gh api --paginate /repos/<owner>/<repo>/issues
```

## Cross-repo flag

All commands accept `-R <owner>/<repo>` to target a different repository:

```bash
gh issue list -R <owner>/<repo> --state open
gh pr list    -R <owner>/<repo>
gh run list   -R <owner>/<repo> --limit 5
```

## jq filtering examples

```bash
# Open PR titles and numbers as TSV
gh pr list --json number,title --jq ".[] | [.number, .title] | @tsv"

# Issues with bug label, just URLs
gh issue list --label bug --json url --jq ".[].url"

# Latest run status per workflow
gh run list --json workflowName,status,conclusion   --jq "group_by(.workflowName) | .[] | .[0] | [.workflowName, .status, .conclusion] | @tsv"
```
