# Reviewer Brief <!-- omit in toc -->

The template for the Opus reviewer's prompt in the `jira-ticket` skill.

## Table of Contents <!-- omit in toc -->

- [1. Template](#1-template)

## 1. Template

```markdown
Review PR <PR-URL> for Jira ticket <KEY>: "<Jira title>".

Check out <story-branch> and invoke the `mattpocock-skills:code-review` skill with `main` as the fixed point.

The spec is the ticket and its blueprints. Read them with the `tracker` skill's `get <KEY>`, and read every blueprint path it reports. The blueprint carries the architect's answers to every question raised before the build; treat it as settled, and report any finding that disputes it as a question for the architect, not a defect.

Report findings only. Do not edit, commit or push.

For each finding give: file and line, the standard or spec clause it breaks, why it matters, and a suggested fix. Rank most severe first. Say plainly when you find nothing.
```

[← Back to the skill](../SKILL.md)
