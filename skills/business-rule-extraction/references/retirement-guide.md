# Retirement Guide <!-- omit in toc -->

Step-by-step process for the wear mechanic. Nothing in this corpus is ever deleted — a rule or use case that no longer applies is retired, following exactly one of the two paths below depending on scope.

## Table of Contents <!-- omit in toc -->

- [1. Deciding which path applies](#1-deciding-which-path-applies)
- [2. Path A — retiring a single rule in place](#2-path-a--retiring-a-single-rule-in-place)
- [3. Path B — retiring a whole use case](#3-path-b--retiring-a-whole-use-case)
- [4. Required fields, either path](#4-required-fields-either-path)
- [5. What never changes](#5-what-never-changes)

## 1. Deciding which path applies

- Only some of a use case's rules no longer apply, and the rest of the workflow is still current → **Path A**, per rule.
- The entire workflow the use case describes no longer exists on the new platform (or has been fully superseded) → **Path B**, for the whole file.

If retiring rules one at a time eventually leaves a use case with zero active rules remaining, that use case itself should then go through Path B — a use case with no active rules is not a current workflow.

## 2. Path A — retiring a single rule in place

1. In the use case's frontmatter, find the rule's entry under `rules[]`.
2. Set that entry's `status: retired`.
3. Add a `retirement` block to that entry: `retiredAt`, `reason`, and `supersededBy` if a replacement rule exists elsewhere.
4. In the document body, add `@retired` to that scenario's tag line, alongside its existing `@id:...`, `@confidence:...`, and `@drift:...` tags. Do not delete or edit the `@id` tag or the `Given/When/Then` text itself — the scenario is historical record now, not a live rule, and its `@id` must still resolve back to the retired `rules[]` entry.
5. If `supersededBy` was set, open the replacement rule's entry (wherever it lives) and add `supersedes: <this rule's id>` back-reference.
6. Update the context's `_ledger.yml`: mark this rule's `issued` entry `status: retired`, add `retiredAt`/`reason`/`supersededBy`. The `file` path is unchanged — the rule never leaves its use-case file.
7. Leave the use case's own `status` and top-level `confidence` alone unless this retirement changes the rollup (see [use-case-template.md §3](./use-case-template.md#3-field-notes)).

## 3. Path B — retiring a whole use case

1. In the use case's frontmatter, set `status: retired` and add a `retirement` block: `retiredAt`, `reason`, `supersededBy` if applicable.
2. Move the entire file from `business-rules/<context>/UC-<CODE>-###-<slug>.md` to `business-rules/_archive/<context>/UC-<CODE>-###-<slug>.md`, preserving the filename.
3. If `supersededBy` was set, open the replacement use case and add `supersedes: <this use case's id>`.
4. Update the context's `_ledger.yml`:
   - Mark the use case's own `issued` entry `status: retired`, update its `file` path to the new archive location, add `retiredAt`/`reason`/`supersededBy`.
   - Mark every `rule`-type entry whose `parentUseCase` is this use case `status: retired` too, and update their `file` path to match the archived location — this cascade is required even though those individual rules were never given their own `@retired` tag in the body, since the whole file is now out of the active tree.
5. Do not add individual `@retired` tags to each rule's scenario inside the now-archived file — the file's own `status: retired` frontmatter and its location under `_archive/` already convey that; Path A's per-rule tagging is for rules retiring while their use case stays active, not for this case.

## 4. Required fields, either path

Every retirement, rule or use case, requires:

- `retiredAt` — date
- `reason` — free text; "unspecified" or blank is not acceptable. A retirement with no stated reason is barely more useful than deletion.
- `supersededBy` — only when something else now covers this behaviour; omit entirely (not `null`) when a rule or use case is simply gone with no replacement.

## 5. What never changes

- The retired item's ID. It is never reissued, reused, or renumbered — the ledger entry persists forever, per [ledger-format.md](./ledger-format.md).
- The `Given/When/Then` wording of a retired rule. It's a historical record of what the legacy system actually did; editing it after the fact defeats the purpose of keeping it.

[← Back to SKILL.md](../SKILL.md)
