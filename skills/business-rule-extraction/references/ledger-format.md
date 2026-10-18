# ID Ledger Format <!-- omit in toc -->

Concrete schema for the per-bounded-context ID ledger. The ledger is the single source of truth for "has this ID ever been used" — never compute the next ID by scanning the active folder, since retired-in-place rules and archived use cases can leave that scan's scope entirely while their IDs remain permanently reserved.

## Table of Contents <!-- omit in toc -->

- [1. Location](#1-location)
- [2. Why two counters](#2-why-two-counters)
- [3. Schema](#3-schema)
- [4. Worked example](#4-worked-example)
- [5. Update rules](#5-update-rules)

## 1. Location

One ledger per bounded context, at `business-rules/<context>/_ledger.yml`. Create it the first time a use case is filed under a new context.

## 2. Why two counters

The ID *scheme* (`UC-<CODE>-###`, `RULE-<CODE>-###`) doesn't by itself say whether use cases and rules share one counter or two — this design assumes two independent counters, on the reasoning that a context will typically accumulate far more rules than use cases, and a shared counter would mean every new rule also burns a number out of the use-case-ID space for no benefit. This is a filled-in implementation choice, not a foregone conclusion — worth confirming rather than treating as settled.

## 3. Schema

```yaml
context: <context>
code: <CODE>
nextUseCaseSequence: <int>
nextRuleSequence: <int>

issued:
  - id: <UC-CODE-### or RULE-CODE-###>
    type: useCase | rule
    title: <short title>
    status: active | retired
    issuedAt: <date>
    file: <path relative to business-rules/, current location>
    parentUseCase: <UC id>          # rule entries only
    retiredAt: <date>               # retired entries only
    reason: <string>                # retired entries only
    supersededBy: <id>               # retired entries only, optional
```

`issued` is append-only. An entry is never removed, even after retirement — removing it would defeat the entire point of the ledger.

## 4. Worked example

```yaml
context: ordering
code: ORD
nextUseCaseSequence: 4
nextRuleSequence: 15

issued:
  - id: UC-ORD-001
    type: useCase
    title: Register Customer
    status: active
    issuedAt: 2026-07-20
    file: ordering/UC-ORD-001-register-customer.md

  - id: UC-ORD-002
    type: useCase
    title: Cancel Order
    status: retired
    issuedAt: 2026-07-20
    retiredAt: 2026-08-01
    reason: Cancellation flow replaced by return/refund workflow in new platform
    supersededBy: UC-ORD-011
    file: _archive/ordering/UC-ORD-002-cancel-order.md

  - id: UC-ORD-003
    type: useCase
    title: Place Order
    status: active
    issuedAt: 2026-07-22
    file: ordering/UC-ORD-003-place-order.md

  - id: RULE-ORD-014
    type: rule
    title: Reject order when credit limit is insufficient
    status: active
    issuedAt: 2026-07-22
    parentUseCase: UC-ORD-003
    file: ordering/UC-ORD-003-place-order.md
```

## 5. Update rules

- **Issuing a new ID**: read `nextUseCaseSequence` or `nextRuleSequence` (matching the type being created), use that value, append a new `issued` entry with `status: active`, then increment the counter used. Do this before writing the use-case file itself, so a crash mid-extraction never produces two files claiming the same ID.
- **Rule retired in place** (see `retirement-guide.md` Path A): update that rule's `issued` entry — `status: retired`, add `retiredAt`, `reason`, and `supersededBy` if applicable. `file` is unchanged, since the rule stays in its original use-case file.
- **Use case retired** (see `retirement-guide.md` Path B): update the use case's `issued` entry the same way, and update its `file` path to the new `_archive/<context>/...` location. Also update the `file` path on every `rule`-type entry whose `parentUseCase` is this use case, and mark each of them `status: retired` too (with `reason` inherited from the use case, unless a rule already had its own more specific reason) — this cascade is what keeps the ledger accurate once the whole file leaves the active tree, even though those rules were never individually tagged `@retired` in the body.
- **Never**: decrement a counter, delete an `issued` entry, or reassign an existing ID to a different title/purpose.

[← Back to SKILL.md](../SKILL.md)
