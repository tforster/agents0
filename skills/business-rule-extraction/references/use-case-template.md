# Use Case File Template <!-- omit in toc -->

Copy-paste starting point for a new use-case file. One file per use case, filed at `business-rules/<context>/UC-<CODE>-###-<slug>.md`.

## Table of Contents <!-- omit in toc -->

- [1. Frontmatter skeleton](#1-frontmatter-skeleton)
- [2. Body skeleton](#2-body-skeleton)
- [3. Field notes](#3-field-notes)

## 1. Frontmatter skeleton

```yaml
---
id: UC-<CODE>-###
title: <Use case title in business language>
boundedContext: <context>
status: draft
confidence: ambiguous
jiraStory: null
rules:
  - id: RULE-<CODE>-###
    status: active
    confidence: ambiguous
    driftStatus: agreement
    sourceType: <php|sql|js|phtml|ini|md|other>
    sources:
      - path: <file path, or "DB CHECK constraint <TABLE>.<COLUMN>", or similar>
        lines: <start>-<end>       # omit for non-line sources (DB objects, etc.)
        commit: <commit sha>
    test: null
---
```

Add one `rules[]` entry per atomic rule nested under this use case. Do not create a use case with an empty `rules[]` list — a use case with no rules yet is not ready to be filed.

## 2. Body skeleton

```markdown
# <Use Case Title>

Actor: <who performs this>. Preconditions: <what must be true before this starts>.

@id:RULE-<CODE>-### @confidence:<confirmed|inferred|ambiguous> @drift:<agreement|partial|conflicting>
Scenario: <short description of the rule, matching its rules[] entry title>
  Given <precondition, business language only>
  When <trigger, business language only>
  Then <expected outcome, business language only>
```

Repeat the `Scenario` block (with its tags) once per `rules[]` entry. The `@id` tag is what links a scenario back to its `rules[]` entry — it must exactly match that entry's `id`. This is the authoritative link; body order matching frontmatter order is a nice-to-have for readability, not something a reader or tool should rely on. The `@confidence`/`@drift` tag values must match that rule's `confidence`/`driftStatus` fields exactly — they are the same fact, expressed twice for two different audiences (frontmatter for tooling, tags for a human skimming the rendered file).

## 3. Field notes

- **`status`** (use case level): `draft` while still being extracted/reviewed, `reviewed` once a human has checked it, `approved` once it's cleared the confidence/drift hard gate and is eligible for Jira story generation, `retired` once archived (see [retirement-guide.md](./retirement-guide.md)).
- **`confidence`** (use case level): a rollup, not an independent judgement — set it to the lowest confidence of any rule nested inside. A use case containing one `ambiguous` rule is itself `ambiguous` until that rule is resolved.
- **`jiraStory`**: stays `null` until a story actually exists; its presence is the signal that this use case has moved past documentation, so no separate "story created" status value is used.
- **`sourceType`**: not a closed enum — record whatever the source actually is. The examples listed (`php`, `sql`, `js`, `phtml`, `ini`, `md`, `other`) are illustrations from what's been seen so far in this monolith, not a validation list.
- **`sources`**: list every contributing source, even when they agree — agreement across three sources is itself evidence worth recording, and is what lets `driftStatus` be computed rather than asserted.
- **`@id` tag**: every scenario's tag line must carry `@id:<rule id>`, matching one `rules[]` entry exactly. This is how a rule's metadata (frontmatter) and its wording (body) stay linkable — never rely on the scenarios appearing in the same order as `rules[]` as the mechanism for matching them up.

[← Back to SKILL.md](../SKILL.md)
