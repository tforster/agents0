# Business Rule Extraction — PRD <!-- omit in toc -->

Output format specification for a custom skill that reverse-engineers business rules out of a legacy monolith (PHP, SQL, JS, PHTML, MD, INI, and other file types as encountered) into a standard, structured artifact. This document captures the decisions reached during a grilling session on 2026-07-17, before any skill implementation begins.

## Table of Contents <!-- omit in toc -->

- [1. Purpose](#1-purpose)
- [2. Structure — Two Levels](#2-structure--two-levels)
- [3. Rule Syntax](#3-rule-syntax)
  - [3.1 Business-language-only discipline](#31-business-language-only-discipline)
  - [3.2 DDD alignment](#32-ddd-alignment)
- [4. Confidence Tiering (Hard Gate)](#4-confidence-tiering-hard-gate)
- [5. Drift Status (Hard Gate)](#5-drift-status-hard-gate)
- [6. Source Citations](#6-source-citations)
- [7. Filing by Bounded Context](#7-filing-by-bounded-context)
- [8. ID Scheme](#8-id-scheme)
- [9. File Granularity](#9-file-granularity)
- [10. Frontmatter Schema](#10-frontmatter-schema)
- [11. Repository Location](#11-repository-location)
- [12. Wear Mechanic — Retirement and Archival](#12-wear-mechanic--retirement-and-archival)
  - [12.1 Two retirement granularities](#121-two-retirement-granularities)
  - [12.2 ID permanence](#122-id-permanence)
  - [12.3 Retirement metadata](#123-retirement-metadata)
- [13. Worked Example](#13-worked-example)
- [14. Open Items — Deferred, Not Decided](#14-open-items--deferred-not-decided)
- [15. Next Steps](#15-next-steps)

## 1. Purpose

Decompose a legacy monolith codebase into documented business rules, using a standard format, so that:

1. Humans can understand what has actually been built into the system over the years — the primary and immediate goal.
2. The corpus is mechanically re-extractable later, without a redesign, to drive:
   - Jira story creation for reimplementation on the new platform
   - Automated test generation

Human documentation is the priority. Machine re-extractability is a design constraint on the format (consistent shape, stable IDs, structured metadata), not a feature to build now.

## 2. Structure — Two Levels

A rule without context is meaningless, so the corpus is organized in two levels:

- **Use Case** — a workflow-sized unit (actor, preconditions, outcome, narrative). Maps approximately 1:1 to a prospective Jira story or epic.
- **Rule** — an atomic condition → action statement nested under a use case. Maps approximately 1:1 to a Jira acceptance criterion or a single test case.

Rules are never authored or filed outside a use case.

## 3. Rule Syntax

Atomic rules are written as Gherkin `Given/When/Then` scenarios, chosen over EARS ("the system shall..."), plain prose ("when X, the system does Y, unless Z"), and numbered `REQ-###` constraints, because Gherkin has direct, tool-supported paths to both a Jira acceptance criterion and an automated test (Cucumber, Playwright-BDD, etc.) with no translation step required.

### 3.1 Business-language-only discipline

Every `Given/When/Then` step must stay true if the system were rewritten on a different stack. No framework names, class names, function names, table/column names as such, or other implementation detail belongs in the rule's wording.

**Allowed exceptions:**

- Entity/attribute names that carry real business meaning (e.g., "credit limit" — it's a business concept, even though it's also a field name)
- Named external integrations (e.g., "Stripe," "the ERP")

All other technical detail lives only in the rule's source citations (see [Section 6](#6-source-citations)), never in the prose.

### 3.2 DDD alignment

Rule wording should use the project's established DDD ubiquitous language for each bounded context, not legacy field/table naming, where the two differ. See [Section 14](#14-open-items--deferred-not-decided) for the unresolved question of how legacy terminology gets translated into that vocabulary during extraction.

## 4. Confidence Tiering (Hard Gate)

Every rule carries one of three confidence levels:

| Level       | Meaning                                                                     |
| ----------- | ---------------------------------------------------------------------------- |
| `confirmed` | Clear behaviour, backed by a test or explicit validation in the code        |
| `inferred`  | Reasonable deduction from code, no direct confirming test/evidence          |
| `ambiguous` | Confusing, contradictory, or likely-unintentional (dead code, apparent bug) |

**Hard gate:** only `confirmed` rules and reviewed `inferred` rules are eligible to auto-generate a Jira story. `ambiguous` rules block story generation until a human resolves them. Carrying forward a legacy bug as an "official" business rule, unflagged, is treated as the most expensive failure mode this format needs to prevent.

## 5. Drift Status (Hard Gate)

The same rule is frequently enforced redundantly across layers (e.g., a JS form validator, a PHP server-side check, and a DB constraint all enforcing "credit limit ≥ 0"). Because a rule can carry multiple source citations, each rule also records a drift status:

| Status        | Meaning                                     |
| ------------- | -------------------------------------------- |
| `agreement`   | All sources implement the same behaviour    |
| `partial`     | Sources overlap but aren't fully equivalent |
| `conflicting` | Sources actively disagree                   |

**Hard gate:** `conflicting` and `partial` rules join the confidence hard gate — they do not generate a Jira story until a human decides which behaviour is correct. Drift detection across sources is treated as one of the most valuable outputs of the extraction exercise, not an edge case to suppress.

## 6. Source Citations

Every rule requires, for each contributing source:

- File path (or DB object/constraint name, e.g., `DB CHECK constraint ORDERS.CREDIT_LIMIT`)
- Line range (where applicable)
- `sourceType` (the kind of file/object the citation comes from — not a fixed enum; the monolith is not assumed to be limited to PHP, SQL, JS, or MD. PHTML, INI, and other file types are expected and must be supported without hardcoding a closed list)
- Commit SHA, pinning the citation to the exact state of the code that was analyzed

Multiple citations per rule are expected and are how [drift status](#5-drift-status-hard-gate) gets computed.

## 7. Filing by Bounded Context

Use cases are filed under their **target DDD bounded context** (the new platform's domain structure), not the legacy monolith's own module/directory layout. The legacy structure is accretion-driven and is generally the reason the system is being rebuilt on DDD in the first place — filing extracted rules by legacy structure would just re-anchor the corpus to the boundaries the rebuild is trying to escape.

**Cross-context use cases:** where a legacy workflow genuinely spans more than one target bounded context, it is split into multiple use cases — one per context — that cross-reference each other, rather than forced into a single artificial home.

## 8. ID Scheme

Hybrid scheme, chosen to balance human browsability against standalone-citation clarity:

- **Folder** = full bounded context name (e.g., `ordering/`) — the human-navigable organizational unit.
- **ID** = short context code + sequential number (e.g., `ORD-014`) — self-describing and unambiguous the moment it's cited standalone in a Jira ticket, commit message, or test file name, without the verbosity of the full context name in every citation.

Use cases and rules share the same scheme: `UC-ORD-003`, `RULE-ORD-014`.

IDs are permanent once issued — see [Section 12](#12-wear-mechanic--retirement-and-archival) for how this is enforced across retirement/archival.

## 9. File Granularity

One file per use case, e.g. `ordering/UC-ORD-003-place-order.md`. The file contains:

- The use-case narrative (actor, preconditions, outcome) in the frontmatter and/or body
- All of that use case's atomic rules, as nested Gherkin scenarios in the body

One-file-per-atomic-rule was rejected: it fragments a use case (a conceptually single reviewable, story-sized unit) across dozens of tiny files, which fights the human-documentation priority from [Section 1](#1-purpose). One-file-per-bounded-context was rejected for the opposite reason: too coarse, and git diffs would mix unrelated use cases together.

## 10. Frontmatter Schema

```yaml
---
id: UC-ORD-003
title: Place Order
boundedContext: ordering
status: draft | reviewed | approved | retired
confidence: confirmed | inferred | ambiguous   # use-case-level rollup
jiraStory: null                                  # populated once a story is created
retirement:                                       # present only when status: retired
  retiredAt: 2026-08-01
  reason: "..."
  supersededBy: UC-ORD-011                        # optional
rules:
  - id: RULE-ORD-014
    status: active | retired
    confidence: confirmed | inferred | ambiguous
    driftStatus: agreement | conflicting | partial
    sourceType: php | sql | js | phtml | ini | md | other
    sources:
      - path: legacy/models/Order.php
        lines: 142-158
        commit: a3f9c2e
      - path: DB CHECK constraint ORDERS.CREDIT_LIMIT
        commit: a3f9c2e
    test: null                                    # populated once a test exists
    retirement:                                    # present only when status: retired
      retiredAt: 2026-08-01
      reason: "..."
      supersededBy: RULE-ORD-022                   # optional
---
```

Confidence and drift status are also echoed as Gherkin tags directly above each scenario in the document body (e.g., `@confidence:confirmed @drift:agreement`), so a human skimming the rendered markdown sees them without opening frontmatter, and so Cucumber-style tooling can act on them directly later. This is a deliberate duplication: frontmatter serves tooling, tags serve the reader.

`jiraStory` / `test` being non-null is treated as the signal that a use case/rule has progressed beyond documentation — no separate status values are added for "story created" or "test written," to avoid redundant state that can drift out of sync with the field it's meant to describe.

## 11. Repository Location

The corpus lives in its **own top-level location**, outside the Diátaxis-governed `docs/` structure entirely (e.g., `business-rules/` at the repository root) — it is explicitly not a Diátaxis document. Hundreds of frontmatter-plus-Gherkin files do not fit the "brief introduction, ToC, numbered sections" template that Diátaxis reference docs use, and stretching the category to fit was judged worse than being honest that this is a generated data corpus, not narrative documentation.

A short pointer/index page lives in `docs/reference/` for discoverability, linking into the `business-rules/` tree.

## 12. Wear Mechanic — Retirement and Archival

Proposed by Vic: rules must be able to wear out over time (business process changes, a feature is retired in the new platform, or a rule turns out to have documented a bug rather than intended behaviour). Retired content must leave the *current/active* view but must never be deleted, and a retired ID can never be reissued.

### 12.1 Two retirement granularities

- **Use-case retirement** — the entire use-case file is physically moved to `business-rules/_archive/<context>/UC-ORD-003-place-order.md`. This is the literal fix for "not distracting us" — a browse of the active folder tree shows zero retired content, not just filtered content.
- **Rule retirement** — an individual rule within an otherwise-active use case stays in place, inside its still-active use-case file, tagged `status: retired` in its frontmatter entry and `@retired` in its Gherkin scenario tag. The rest of the use case remains active.

### 12.2 ID permanence

A per-bounded-context **ID ledger** records every `UC-###` and `RULE-###` ID ever issued for that context, regardless of current status or location. This is required — not optional — because a naive "scan the active folder for the highest number" approach breaks the moment a whole use case archives: any rule IDs that were retired-in-place inside that file leave the active folder's scan scope along with it, and could otherwise be silently reissued to an unrelated new rule. The ledger is the single source of truth for "has this ID ever been used," independent of where (or whether) the corresponding file currently lives.

### 12.3 Retirement metadata

Every retirement — rule or use case — requires:

- `reason` — free text explaining why (e.g., "feature removed in new platform," "determined to be an unintentional legacy bug, not a real rule")
- `supersededBy` (on the retired item) / `supersedes` (on its replacement), where applicable — a bidirectional link so the history is traceable in both directions

A retirement with no reason and no supersession link was judged barely more useful than deletion, defeating the purpose of retiring rather than removing.

## 13. Worked Example

```gherkin
---
id: UC-ORD-003
title: Place Order
boundedContext: ordering
status: approved
confidence: confirmed
jiraStory: null
rules:
  - id: RULE-ORD-014
    status: active
    confidence: confirmed
    driftStatus: conflicting
    sourceType: php
    sources:
      - path: legacy/models/Order.php
        lines: 142-158
        commit: a3f9c2e
      - path: legacy/js/order-form-validation.js
        lines: 40-52
        commit: a3f9c2e
      - path: DB CHECK constraint ORDERS.CREDIT_LIMIT
        commit: a3f9c2e
    test: null
---

# Place Order

Actor: Customer. Preconditions: customer is authenticated and has an active account.

@confidence:confirmed @drift:conflicting
Scenario: Reject order when credit limit is insufficient
  Given a customer with a credit limit of $0
  When an order is submitted
  Then the order is rejected with "insufficient credit"
  # Note: PHP server check rejects at $0; JS client-side validation only
  # blocks orders below $0 — drift flagged, needs a human decision on
  # which threshold is correct before this becomes a Jira story.
```

## 14. Open Items — Deferred, Not Decided

These surfaced during the grilling session but were explicitly not resolved. They should be decided before or during skill implementation, not assumed:

- **Ubiquitous-language translation.** Legacy field/table naming will frequently not match the established DDD bounded-context vocabulary. An equivalent to the "anti-leakage checklist" pattern (from the `codebase-reverse-spec` skill researched as prior art) may be needed here — a translation/glossary step ensuring extracted rule wording uses the project's actual ubiquitous language rather than leaking legacy terminology into the new domain vocabulary.
- **Cross-context scenario representation.** For workflows that legitimately span bounded contexts, the split-and-cross-reference approach ([Section 7](#7-filing-by-bounded-context)) is agreed, but the mechanism for representing the cross-context effect itself (e.g., a scenario ending in "Then an `OrderPlaced` event is published" to represent a domain-event handoff to another context) has not been specified.

## 15. Next Steps

Build the `business-rule-extraction` skill itself (`SKILL.md`, references, templates, and any scripts) against this specification.
