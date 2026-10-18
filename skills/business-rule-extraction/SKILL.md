---
name: business-rule-extraction
description: Reverse-engineers business rules out of a legacy monolith codebase (PHP, SQL, JS, PHTML, MD, INI, or any other source type present, not a fixed list) into a structured, two-level Gherkin corpus of use cases and rules, gated by confidence and cross-source drift status, designed to drive Jira story creation and test generation for reimplementation on a new DDD-based platform. Use when the user wants to decompose a legacy/brownfield monolith into business rules, document undocumented business logic before a rewrite or audit, reverse-engineer legacy code into a standard rule format, or extract business rules to seed Jira stories and tests.
---

# Business Rule Extraction

Reverse-engineering specialist that decomposes a legacy monolith into a structured, human-first, mechanically re-extractable corpus of business rules — designed to drive Jira story creation and automated tests for reimplementation on the new platform.

Detailed schema, templates, and checklists live in `references/` — load the one relevant to the step you're on (see the table at the end of this file).

## When to use

- Decomposing a legacy/brownfield monolith into documented business rules
- Preparing a reimplementation effort (new platform, DDD bounded contexts) that needs a rule inventory to seed Jira stories
- Documenting undocumented business logic before a rewrite or audit
- Re-running extraction on a bounded context already partially covered — adding, retiring, or updating rules

## Core workflow

1. **Scope** — confirm which bounded context(s) are in scope for this run. Check whether `business-rules/<context>/` and its `_ledger.yml` already exist; create the ledger if this is the first pass at that context.
2. **Reconnaissance** — map the legacy code relevant to this bounded context: entry points (routes, controllers, forms, jobs), validation/business-logic modules, DB schema/constraints, and existing tests (tests usually document intended behaviour better than production code does). Treat file type as open-ended — PHP, SQL, JS, PHTML, MD, INI, or anything else actually found — not a fixed list.
3. **Draft use cases** — for each distinct workflow, draft a use case: actor, preconditions, outcome. Where a workflow genuinely spans more than one target bounded context, split it into one use case per context and cross-reference them, rather than forcing a single artificial home.
4. **Extract atomic rules** — for each business decision inside a use case, write a `Given/When/Then` Gherkin scenario in business language only (see `references/anti-leakage-checklist.md` for the allowed-exception list — entity/attribute names with real business meaning, named external integrations). Attach every contributing source citation: file or DB-object path, line range, `sourceType`, and commit SHA.
5. **Assign confidence and drift** — mark each rule `confirmed`, `inferred`, or `ambiguous`, and mark `driftStatus` `agreement`, `partial`, or `conflicting` whenever a rule has more than one citation. Never promote contradictory or likely-unintentional behaviour to a confirmed rule without flagging it.
6. **Assign IDs** — pull the next `UC-<CODE>-###` or `RULE-<CODE>-###` from that context's ledger and record it there immediately. The ledger, not a folder scan, is the only source of truth for whether an ID has ever been used (`references/ledger-format.md`).
7. **Write the file** — one file per use case at `business-rules/<context>/UC-<CODE>-###-<slug>.md`, with frontmatter and the nested Gherkin body, per `references/use-case-template.md`. Every scenario's tag line must carry `@id:<rule id>` matching its `rules[]` entry exactly — this is what links a rule's metadata to its wording; never rely on body order matching frontmatter order.
8. **Gate before handoff** — only `confirmed` rules and reviewed `inferred` rules, with `agreement` drift status, are eligible to generate a Jira story. `ambiguous` confidence and `partial`/`conflicting` drift both block unconditionally — there is no reviewed exception for drift, only for confidence — until a human resolves which behaviour is correct. Everything blocked is flagged for review, never silently excluded or silently promoted.
9. **Handle retirement on re-runs** — if a rule or use case no longer applies, never delete it. Follow `references/retirement-guide.md`: rule-level retirement stays in its file tagged `@retired`; use-case-level retirement moves the whole file to `business-rules/_archive/<context>/`. Both require a `reason` and, where applicable, a bidirectional `supersededBy`/`supersedes` link. A retired ID is never reissued.

## Constraints

### MUST DO

- Ground every rule in actual code or schema evidence, with a citation
- Use business-language-only wording in `Given/When/Then` (`references/anti-leakage-checklist.md`)
- File under the target DDD bounded context, not the legacy module structure
- Check and update the per-context ID ledger before assigning any ID
- Tag every scenario with `@id:<rule id>` so frontmatter and body stay linkable
- Flag drift and ambiguity explicitly rather than silently picking one source

### MUST NOT DO

- Delete a rule or use case — retire it instead (`references/retirement-guide.md`)
- Reuse a retired ID
- Generate a Jira story for an ambiguous, unreviewed-inferred, or conflicting/partial-drift rule
- Leak class, function, framework, or table names into rule wording — that detail belongs only in citations
- Force a cross-context workflow into a single use case

## Output

New or updated files under `business-rules/<context>/`, and on retirement, moves into `business-rules/_archive/<context>/`. Update the context's `_ledger.yml` on every ID assignment, and add a pointer entry in `docs/reference/` the first time a new bounded context folder is created.

## Reference

| Topic                                  | Reference                                                                        | Load when                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| New use-case file skeleton             | [`references/use-case-template.md`](./references/use-case-template.md)           | Step 7 — writing a new use-case file                               |
| `_ledger.yml` schema and update rules  | [`references/ledger-format.md`](./references/ledger-format.md)                   | Step 6 — assigning any ID                                          |
| Business-language-only review          | [`references/anti-leakage-checklist.md`](./references/anti-leakage-checklist.md) | Before moving a use case from `draft` to `reviewed`                |
| Retiring a rule or use case            | [`references/retirement-guide.md`](./references/retirement-guide.md)             | Step 9 — re-running extraction on a context with obsolete content  |
